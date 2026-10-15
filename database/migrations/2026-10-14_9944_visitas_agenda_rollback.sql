-- =====================================================================================
-- OpMap · feat/visitas-agenda-dictado-marca (app de visita · F4.1: agenda) · 9944 — Rollback de 0840
-- Proyecto: norvxqgohddgsdkggqzq · Generado: 2026-10-14 · ESTADO: NO APLICADA
--
-- ANTES DE EJECUTAR: volver a desplegar el código anterior a este PR (sin /api/me/agenda*, /api/me/voz/campos ni la
--   agenda de la app): el código nuevo llama a agenda_crear() y agenda_cancelar() y lee visitas_agenda y las columnas
--   visits.agenda_id y visits.agendada. (El código de este PR sí aguanta sin la 0840: responde 503 en la agenda y el
--   resto sigue; aun así, lo prudente es volver al anterior.) Los DROP van SIN CASCADE a propósito y abortan si algo
--   más depende de lo que se quita.
--
-- Qué deshace (una sola transacción, todo o nada), en orden inverso a 0840:
--   1. visitas_registrar y visitas_anular vuelven EXACTAMENTE a la 0830 (copia literal del cuerpo; se comprueba con el
--      md5 de pg_proc.prosrc: 0e43cd1432a3c933b820bdf815a02566 y 9f4389cca280e89af80afdebc3f57ea9).
--   2. Funciones nuevas: agenda_crear y agenda_cancelar.
--   3. visits: índice visits_agenda_id_uidx, CHECK visits_agenda_check y las columnas agenda_id y agendada (su llave
--      hacia visitas_agenda se va con la columna). visits vuelve a sus 43 columnas de la 0830.
--   4. Tabla visitas_agenda (con sus índices, CHECK, disparadores y su llave hacia visits).
--   NO toca la 0830 (visits, visit_lines, visitas_editar, visitas_config_vigente, visitas_distancia_m), ni 0800, 0810
--   ni 0820, ni update_updated_at_column() ni visitas_sin_borrar().
--
-- PÉRDIDAS (NOTICE con las cifras antes de borrar):
--   - TODA la agenda (citas pendientes, hechas y canceladas, con sus notas).
--   - El vínculo de cada visita de la app con su cita y la marca "agendada" (las visitas se quedan; solo pierden esas
--     dos columnas). Exportar antes si importan.
--   - Las 7.033 visitas importadas de VMO NO cambian (se comprueba al final: mismas filas y mismos valores en las 14
--     columnas originales).
--
-- Orden: 9944 antes que 9943 (la 9943 borra las visitas de la app, que visitas_agenda.visita_id referencia, y quita
--   columnas de visits que el cuerpo de la 0840 usa), y por tanto antes que 9942, 9941 y 9940.
-- Re-ejecutable: sí (IF EXISTS en todo; si la 0840 no está, solo vuelve a dejar las funciones de la 0830).
-- =====================================================================================

BEGIN;

-- -------------------------------------------------------------------------------------
-- 0. Aviso de lo que se pierde y huella de las importadas
-- -------------------------------------------------------------------------------------

DO $$
DECLARE
  v_citas  bigint;
  v_pend   bigint;
  v_hechas bigint;
  v_vinc   bigint;
  v_imp    bigint;
  v_md5    text;
  v_md5_t  text;
BEGIN
  IF to_regprocedure('public.visitas_registrar(jsonb, uuid)') IS NULL
     OR to_regprocedure('public.visitas_anular(uuid, text, uuid)') IS NULL THEN
    RAISE EXCEPTION 'Rollback 0840: faltan visitas_registrar o visitas_anular (¿se deshizo ya la 0830?). Este rollback va antes que 9943';
  END IF;
  IF to_regclass('public.visitas_agenda') IS NOT NULL THEN
    EXECUTE 'SELECT count(*), count(*) FILTER (WHERE estado = ''pendiente''), count(*) FILTER (WHERE estado = ''hecha'')
             FROM public.visitas_agenda'
      INTO v_citas, v_pend, v_hechas;
    RAISE NOTICE 'Rollback 0840: se BORRAN % cita(s) de la agenda (% pendiente(s), % hecha(s))', v_citas, v_pend, v_hechas;
  ELSE
    RAISE NOTICE 'Rollback 0840: visitas_agenda ya no existe';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'visits' AND column_name = 'agenda_id') THEN
    EXECUTE 'SELECT count(*) FROM public.visits WHERE agenda_id IS NOT NULL' INTO v_vinc;
    RAISE NOTICE 'Rollback 0840: % visita(s) de la app pierden su vínculo con la cita (las visitas se quedan)', v_vinc;
  END IF;
  SELECT count(*),
         md5(string_agg(v.id::text || v.visit_type || v.contact_type || v.visit_date::text, ',' ORDER BY v.id)),
         md5(string_agg(ROW(v.id, v.kam_id, v.kam_name, v.visit_type, v.contact_type, v.lat, v.lng, v.visit_date,
                            v.hospital_id, v.imported_by, v.imported_at, v.created_at, v.updated_at,
                            v.import_id)::text, ',' ORDER BY v.id))
  INTO v_imp, v_md5, v_md5_t
  FROM public.visits v
  WHERE v.source = 'vmo_import';
  PERFORM set_config('opmap9944.importadas', v_imp::text || '|' || coalesce(v_md5, '-') || '|' || coalesce(v_md5_t, '-'), true);
  RAISE NOTICE 'Rollback 0840: % visita(s) importada(s) de VMO se quedan (huella %)', v_imp, coalesce(v_md5, '-');
END;
$$;

-- -------------------------------------------------------------------------------------
-- 1. visitas_registrar y visitas_anular: EXACTAMENTE las de la 0830
-- -------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.visitas_registrar(p jsonb, p_user uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  c_tolerancia   constant interval := interval '5 minutes';  -- reloj del teléfono (TOLERANCIA_RELOJ_SEGUNDOS)
  c_motivo_falla constant text := 'Indica el motivo de la visita no efectiva (hasta 300 caracteres)';
  v_hoy          constant date := (now() AT TIME ZONE 'America/Bogota')::date;
  v_client       uuid;
  v_exec         uuid;
  v_tipo         text;
  v_subtipo      uuid;
  v_medico       uuid;
  v_cuenta       uuid;
  v_sede         uuid;
  v_contacto     uuid;
  v_modalidad    text;
  v_medio        text;
  v_efectiva     boolean;
  v_failure      text;
  v_retry        date;
  v_checked      timestamptz;
  v_reported     timestamptz;
  v_lat          double precision;
  v_lng          double precision;
  v_precision    integer;
  v_conclusion   text;
  v_compromisos  text;
  v_next         date;
  v_transcript   text;
  v_input        text;
  v_lineas       uuid[];
  v_previa       record;
  v_e_nombre     text;
  v_e_estado     text;
  v_e_zona       uuid;
  v_fecha        date;
  v_cfg          jsonb;
  v_s_cuenta     uuid;
  v_s_nombre     text;
  v_s_lat        numeric;
  v_s_lng        numeric;
  v_s_hospital   uuid;
  v_s_municipio  text;
  v_s_activa     boolean;
  v_c_activa     boolean;
  v_k_cuenta     uuid;
  v_k_activo     boolean;
  v_subtipo_cod  text;
  v_oot          boolean := false;
  v_dist         integer;
  v_radio        integer;
  v_tope         integer;
  v_medios       text;
  v_n            bigint;
  v_lat_mapa     numeric;
  v_lng_mapa     numeric;
  v_id           uuid;
BEGIN
  IF p IS NULL OR jsonb_typeof(p) <> 'object' THEN
    RAISE EXCEPTION 'Faltan los datos de la visita' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- 0. Forma (la API ya validó con zod; aquí se revisa otra vez para que la base no dependa de la API)
  BEGIN
    v_client      := nullif(btrim(p ->> 'client_id'), '')::uuid;
    v_exec        := nullif(btrim(p ->> 'executive_id'), '')::uuid;
    v_tipo        := nullif(btrim(p ->> 'tipo'), '');
    v_subtipo     := nullif(btrim(p ->> 'subtipo_id'), '')::uuid;
    v_medico      := nullif(btrim(p ->> 'medico_id'), '')::uuid;
    v_cuenta      := nullif(btrim(p ->> 'cuenta_id'), '')::uuid;
    v_sede        := nullif(btrim(p ->> 'sede_id'), '')::uuid;
    v_contacto    := nullif(btrim(p ->> 'contacto_id'), '')::uuid;
    v_modalidad   := nullif(btrim(p ->> 'modalidad'), '');
    v_medio       := nullif(btrim(p ->> 'medio'), '');
    v_efectiva    := (p ->> 'efectiva')::boolean;
    v_failure     := nullif(btrim(p ->> 'failure_reason'), '');
    v_retry       := nullif(btrim(p ->> 'retry_date'), '')::date;
    v_checked     := nullif(btrim(p ->> 'checked_in_at'), '')::timestamptz;
    v_reported    := nullif(btrim(p ->> 'reported_at'), '')::timestamptz;
    v_lat         := nullif(btrim(p ->> 'lat'), '')::double precision;
    v_lng         := nullif(btrim(p ->> 'lng'), '')::double precision;
    v_precision   := round(nullif(btrim(p ->> 'gps_accuracy_m'), '')::numeric)::integer;
    v_conclusion  := nullif(btrim(p ->> 'conclusion'), '');
    v_compromisos := nullif(btrim(p ->> 'compromisos'), '');
    v_next        := nullif(btrim(p ->> 'next_step_date'), '')::date;
    v_transcript  := nullif(btrim(p ->> 'transcript'), '');
    v_input       := nullif(btrim(p ->> 'input_mode'), '');
    IF jsonb_typeof(p -> 'lineas') = 'array' THEN
      v_lineas := ARRAY(SELECT DISTINCT t.x::uuid FROM jsonb_array_elements_text(p -> 'lineas') AS t(x));
    END IF;
  EXCEPTION
    WHEN invalid_text_representation OR invalid_datetime_format OR datetime_field_overflow
         OR numeric_value_out_of_range OR invalid_parameter_value THEN
      RAISE EXCEPTION 'Datos de la visita no válidos: %', SQLERRM USING ERRCODE = 'invalid_parameter_value';
  END;

  IF v_client IS NULL THEN
    RAISE EXCEPTION 'Falta el client_id de la visita (uuid que genera la app)' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF v_exec IS NULL THEN
    RAISE EXCEPTION 'Falta el Ejecutivo Comercial de la visita' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF v_tipo IS NULL OR v_tipo NOT IN ('medica', 'institucional') THEN
    RAISE EXCEPTION 'Tipo de visita no válido: medica o institucional' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF v_sede IS NULL THEN
    RAISE EXCEPTION 'Elige la sede' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF v_modalidad IS NULL OR v_modalidad NOT IN ('presencial', 'telefonica') THEN
    RAISE EXCEPTION 'Modalidad no válida: presencial o telefonica' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF v_efectiva IS NULL THEN
    RAISE EXCEPTION 'Indica si la visita fue efectiva (sí o no)' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF v_checked IS NULL THEN
    RAISE EXCEPTION 'Falta la hora de llegada' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF v_reported IS NULL THEN
    RAISE EXCEPTION 'Falta la hora del reporte' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF v_input IS NULL OR v_input NOT IN ('voz', 'toques') THEN
    RAISE EXCEPTION 'Modo de entrada no válido: voz o toques' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF v_lineas IS NULL THEN
    RAISE EXCEPTION 'Elige al menos una línea' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF array_position(v_lineas, NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'Línea no válida' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF cardinality(v_lineas) > 10 THEN
    RAISE EXCEPTION 'Como máximo 10 líneas por visita' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF (v_lat IS NULL) <> (v_lng IS NULL) THEN
    RAISE EXCEPTION 'Manda latitud y longitud juntas' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF v_lat IS NOT NULL AND (v_lat NOT BETWEEN -90 AND 90 OR v_lng NOT BETWEEN -180 AND 180) THEN
    RAISE EXCEPTION 'Ubicación del teléfono no válida' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF v_precision IS NOT NULL AND v_precision < 0 THEN
    RAISE EXCEPTION 'Precisión del GPS no válida' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF v_tipo = 'medica' AND v_medico IS NULL THEN
    RAISE EXCEPTION 'Elige el médico' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF v_tipo = 'institucional' AND v_cuenta IS NULL THEN
    RAISE EXCEPTION 'Elige la cuenta' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF v_tipo = 'institucional' AND v_subtipo IS NULL THEN
    RAISE EXCEPTION 'Elige el subtipo de la visita institucional' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF v_modalidad = 'telefonica' AND v_medio IS NULL THEN
    RAISE EXCEPTION 'Indica el medio: llamada o videollamada' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF char_length(v_failure) > 300 THEN
    RAISE EXCEPTION 'El motivo de la visita no efectiva no puede superar 300 caracteres' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF char_length(v_conclusion) > 2000 THEN
    RAISE EXCEPTION 'La conclusión no puede superar 2000 caracteres' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF char_length(v_compromisos) > 2000 THEN
    RAISE EXCEPTION 'Los compromisos no pueden superar 2000 caracteres' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF char_length(v_transcript) > 8000 THEN
    RAISE EXCEPTION 'La transcripción no puede superar 8000 caracteres' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- Solo lo que aplica al tipo, a la modalidad y al resultado (como normalizarVisita de la web).
  IF v_tipo = 'medica' THEN
    v_cuenta := NULL; v_subtipo := NULL; v_contacto := NULL;
  ELSE
    v_medico := NULL;
  END IF;
  IF v_modalidad = 'presencial' THEN
    v_medio := NULL;
  ELSE
    -- Telefónica: la ubicación del teléfono no se usa ni se guarda (privacidad; el punto del mapa sale de la sede).
    v_lat := NULL; v_lng := NULL; v_precision := NULL;
  END IF;
  IF v_efectiva THEN
    v_failure := NULL; v_retry := NULL;
  ELSIF v_failure IS NULL THEN
    RAISE EXCEPTION '%', c_motivo_falla USING ERRCODE = 'check_violation';
  END IF;

  -- 1. Candado por ejecutiva e idempotencia por client_id
  PERFORM pg_advisory_xact_lock(hashtext('visitas_app:' || v_exec::text));
  SELECT v.id, v.executive_id, v.out_of_territory, v.distance_m, v.visit_date
  INTO v_previa
  FROM public.visits v
  WHERE v.client_id = v_client;
  IF FOUND THEN
    IF v_previa.executive_id IS DISTINCT FROM v_exec THEN
      RAISE EXCEPTION 'Ese client_id ya se usó en otra visita' USING ERRCODE = 'unique_violation';
    END IF;
    RETURN jsonb_build_object('visita_id', v_previa.id, 'repetida', true,
                              'out_of_territory', v_previa.out_of_territory,
                              'distance_m', v_previa.distance_m, 'visit_date', v_previa.visit_date);
  END IF;

  -- 2. Ejecutiva activa con zona; mismo día (Bogotá); horas coherentes
  SELECT e.full_name, e.status, e.base_kam_id INTO v_e_nombre, v_e_estado, v_e_zona
  FROM public.executives e
  WHERE e.id = v_exec;
  IF NOT FOUND OR v_e_estado IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'Tu usuario no está enlazado con un Ejecutivo Comercial' USING ERRCODE = 'check_violation';
  END IF;
  IF v_e_zona IS NULL THEN
    RAISE EXCEPTION 'Tu Ejecutivo Comercial no tiene zona base' USING ERRCODE = 'check_violation';
  END IF;
  v_fecha := (v_checked AT TIME ZONE 'America/Bogota')::date;
  IF v_fecha IS DISTINCT FROM v_hoy THEN
    RAISE EXCEPTION 'Solo se reportan visitas del mismo día' USING ERRCODE = 'check_violation';
  END IF;
  IF v_checked > now() + c_tolerancia THEN
    RAISE EXCEPTION 'La hora de llegada está en el futuro' USING ERRCODE = 'check_violation';
  END IF;
  IF v_reported < v_checked THEN
    RAISE EXCEPTION 'La hora del reporte no puede ser anterior a la de llegada' USING ERRCODE = 'check_violation';
  END IF;
  IF v_reported > now() + c_tolerancia THEN
    RAISE EXCEPTION 'La hora del reporte está en el futuro' USING ERRCODE = 'check_violation';
  END IF;
  IF v_next IS NOT NULL AND v_next < v_fecha THEN
    RAISE EXCEPTION 'La próxima reunión no puede ser anterior a la fecha de la visita' USING ERRCODE = 'check_violation';
  END IF;
  IF v_retry IS NOT NULL AND v_retry < v_fecha THEN
    RAISE EXCEPTION 'La fecha para reintentar no puede ser anterior a la fecha de la visita' USING ERRCODE = 'check_violation';
  END IF;

  -- 3. Perfil vigente en la fecha
  v_cfg := public.visitas_config_vigente(v_exec, v_fecha);
  IF NOT ((v_cfg -> 'perfil') ? v_tipo) THEN
    RAISE EXCEPTION '%', CASE WHEN v_tipo = 'medica' THEN 'Tu perfil no incluye visitas médicas'
                              ELSE 'Tu perfil no incluye visitas institucionales' END
      USING ERRCODE = 'check_violation';
  END IF;

  -- 4. Sede; médica o institucional
  SELECT s.cuenta_id, s.nombre, s.lat, s.lng, s.hospital_id, s.municipality_id, s.activo
  INTO v_s_cuenta, v_s_nombre, v_s_lat, v_s_lng, v_s_hospital, v_s_municipio, v_s_activa
  FROM public.sedes s
  WHERE s.id = v_sede;
  IF NOT FOUND OR NOT v_s_activa THEN
    RAISE EXCEPTION 'Esa sede no existe' USING ERRCODE = 'check_violation';
  END IF;
  SELECT c.activo INTO v_c_activa FROM public.cuentas c WHERE c.id = v_s_cuenta;
  IF NOT coalesce(v_c_activa, false) THEN
    RAISE EXCEPTION 'La cuenta de esa sede está inactiva' USING ERRCODE = 'check_violation';
  END IF;

  IF v_tipo = 'medica' THEN
    IF NOT EXISTS (SELECT 1 FROM public.medicos m WHERE m.id = v_medico AND m.activo) THEN
      RAISE EXCEPTION 'Ese médico no existe o está inactivo' USING ERRCODE = 'check_violation';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.medico_sedes ms WHERE ms.medico_id = v_medico AND ms.sede_id = v_sede) THEN
      RAISE EXCEPTION 'El médico no atiende en esa sede' USING ERRCODE = 'check_violation';
    END IF;
    v_oot := NOT EXISTS (SELECT 1 FROM public.medico_visitantes mv
                         WHERE mv.medico_id = v_medico AND mv.executive_id = v_exec
                           AND mv.desde <= v_fecha AND (mv.hasta IS NULL OR mv.hasta >= v_fecha));
  ELSE
    IF v_s_cuenta IS DISTINCT FROM v_cuenta THEN
      RAISE EXCEPTION 'Esa sede no es de la cuenta elegida' USING ERRCODE = 'check_violation';
    END IF;
    SELECT si.codigo INTO v_subtipo_cod
    FROM public.subtipos_institucionales si
    WHERE si.id = v_subtipo AND si.vigente_desde <= v_fecha AND (si.vigente_hasta IS NULL OR si.vigente_hasta >= v_fecha);
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Ese subtipo no está vigente' USING ERRCODE = 'check_violation';
    END IF;
    IF v_contacto IS NOT NULL THEN
      SELECT c.cuenta_id, c.activo INTO v_k_cuenta, v_k_activo FROM public.contactos c WHERE c.id = v_contacto;
      IF NOT FOUND OR v_k_cuenta IS DISTINCT FROM v_cuenta THEN
        RAISE EXCEPTION 'Ese contacto no es de la cuenta elegida' USING ERRCODE = 'check_violation';
      END IF;
      IF NOT coalesce(v_k_activo, false) THEN
        RAISE EXCEPTION 'Ese contacto está inactivo' USING ERRCODE = 'check_violation';
      END IF;
    END IF;
  END IF;

  -- 5. Presencial (radio con Haversine contra la sede) o telefónica (habilitada, medio, tope del día)
  IF v_modalidad = 'presencial' THEN
    IF v_lat IS NULL THEN
      RAISE EXCEPTION 'La ubicación del teléfono es obligatoria en una visita presencial' USING ERRCODE = 'check_violation';
    END IF;
    IF v_s_lat IS NULL OR v_s_lng IS NULL THEN
      RAISE EXCEPTION 'Esta sede no tiene ubicación: confírmala o crea la sede' USING ERRCODE = 'check_violation';
    END IF;
    v_dist  := public.visitas_distancia_m(v_lat, v_lng, v_s_lat::double precision, v_s_lng::double precision);
    v_radio := (v_cfg ->> 'radio_m')::integer;
    IF v_dist > v_radio THEN
      RAISE EXCEPTION 'Estás a % m de %; el radio es % m', v_dist, v_s_nombre, v_radio USING ERRCODE = 'check_violation';
    END IF;
  ELSE
    IF NOT coalesce((v_cfg #>> '{telefonica,habilitada}')::boolean, false) THEN
      RAISE EXCEPTION 'No tienes habilitada la visita telefónica' USING ERRCODE = 'check_violation';
    END IF;
    IF NOT coalesce((v_cfg #> '{telefonica,medios}') ? v_medio, false) THEN
      SELECT string_agg(t.x, ' o ' ORDER BY t.o) INTO v_medios
      FROM jsonb_array_elements_text(v_cfg #> '{telefonica,medios}') WITH ORDINALITY AS t(x, o);
      RAISE EXCEPTION '%', CASE WHEN v_medios IS NULL THEN 'No tienes medios habilitados para la visita telefónica'
                                ELSE 'Medio no válido: ' || v_medios END
        USING ERRCODE = 'check_violation';
    END IF;
    v_tope := (v_cfg #>> '{telefonica,tope_dia}')::integer;
    SELECT count(*) INTO v_n
    FROM public.visits v
    WHERE v.source = 'app' AND v.executive_id = v_exec AND v.visit_date = v_fecha
      AND v.modalidad = 'telefonica' AND v.efectiva AND v.deleted_at IS NULL;
    IF v_n >= v_tope THEN
      RAISE EXCEPTION '%', CASE WHEN v_tope = 1 THEN 'Ya reportaste tu visita telefónica de hoy'
                                ELSE format('Ya reportaste las %s visitas telefónicas de hoy', v_tope) END
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  -- 6. Tope por médico (solo si suma: efectiva; presencial y telefónica cuentan igual)
  IF v_tipo = 'medica' AND v_efectiva THEN
    SELECT count(*) INTO v_n
    FROM public.visits v
    WHERE v.source = 'app' AND v.executive_id = v_exec AND v.visit_date = v_fecha
      AND v.medico_id = v_medico AND v.efectiva AND v.deleted_at IS NULL;
    IF v_n >= (v_cfg ->> 'tope_visitas_medico_dia')::integer THEN
      RAISE EXCEPTION 'Ya reportaste una visita a este médico hoy' USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  -- 7. Líneas: al menos una y todas suyas
  IF cardinality(v_lineas) = 0 THEN
    RAISE EXCEPTION 'Elige al menos una línea' USING ERRCODE = 'check_violation';
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(v_lineas) AS l(id)
             WHERE NOT EXISTS (SELECT 1 FROM public.executive_lines el
                               WHERE el.executive_id = v_exec AND el.line_id = l.id)) THEN
    RAISE EXCEPTION 'Alguna de las líneas no es tuya' USING ERRCODE = 'check_violation';
  END IF;

  -- 8. Punto del mapa de calor (visits.lat/lng son NOT NULL). Telefónica: la sede, su municipio o la zona; nunca el
  --    teléfono (v_lat ya es NULL en una telefónica).
  IF v_modalidad = 'presencial' THEN
    v_lat_mapa := round(v_lat::numeric, 6);
    v_lng_mapa := round(v_lng::numeric, 6);
  ELSIF v_s_lat IS NOT NULL AND v_s_lng IS NOT NULL THEN
    v_lat_mapa := v_s_lat;
    v_lng_mapa := v_s_lng;
  ELSE
    SELECT round(m.lat, 6), round(m.lng, 6) INTO v_lat_mapa, v_lng_mapa
    FROM public.municipalities m
    WHERE m.code = v_s_municipio AND m.lat IS NOT NULL AND m.lng IS NOT NULL;
    IF v_lat_mapa IS NULL THEN
      SELECT round(k.lat, 6), round(k.lng, 6) INTO v_lat_mapa, v_lng_mapa FROM public.kams k WHERE k.id = v_e_zona;
    END IF;
  END IF;

  INSERT INTO public.visits (
    kam_id, kam_name, visit_type, contact_type, lat, lng, visit_date, hospital_id,
    imported_by, imported_at, import_id,
    source, executive_id, client_id, tipo, subtipo_id, subtipo_codigo, medico_id, cuenta_id, sede_id, contacto_id,
    modalidad, medio, efectiva, failure_reason, retry_date, checked_in_at, reported_at, distance_m, gps_accuracy_m,
    conclusion, compromisos, next_step_date, transcript, input_mode, out_of_territory, created_by, updated_by)
  VALUES (
    v_e_zona, left(v_e_nombre, 255),
    CASE WHEN v_efectiva THEN 'Visita efectiva' ELSE 'Visita no efectiva' END,
    CASE WHEN v_modalidad = 'presencial' THEN 'Visita presencial' ELSE 'Visita virtual' END,
    v_lat_mapa, v_lng_mapa, v_fecha, v_s_hospital,
    NULL, NULL, NULL,
    'app', v_exec, v_client, v_tipo, v_subtipo, v_subtipo_cod, v_medico, v_cuenta, v_sede, v_contacto,
    v_modalidad, v_medio, v_efectiva, v_failure, v_retry, v_checked, v_reported, v_dist, v_precision,
    v_conclusion, v_compromisos, v_next, v_transcript, v_input, v_oot, p_user, p_user)
  RETURNING id INTO v_id;

  INSERT INTO public.visit_lines (visit_id, line_id)
  SELECT v_id, l.id FROM unnest(v_lineas) AS l(id);

  RETURN jsonb_build_object('visita_id', v_id, 'repetida', false, 'out_of_territory', v_oot,
                            'distance_m', v_dist, 'visit_date', v_fecha);
END;
$$;

CREATE OR REPLACE FUNCTION public.visitas_anular(p_id uuid, p_motivo text, p_user uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  c_no_editable constant text := 'Solo puedes corregir o anular tus visitas del mismo día';
  v_hoy         constant date := (now() AT TIME ZONE 'America/Bogota')::date;
  v_motivo      constant text := nullif(btrim(p_motivo), '');
  v_exec        uuid;
  v_estado      text;
  v_v           record;
BEGIN
  IF p_id IS NULL THEN
    RAISE EXCEPTION 'Falta la visita' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF char_length(coalesce(v_motivo, '')) < 5 THEN
    RAISE EXCEPTION 'Escribe el motivo (al menos 5 caracteres)' USING ERRCODE = 'check_violation';
  END IF;
  IF char_length(v_motivo) > 300 THEN
    RAISE EXCEPTION 'El motivo no puede superar 300 caracteres' USING ERRCODE = 'check_violation';
  END IF;
  IF p_user IS NULL THEN
    RAISE EXCEPTION 'Falta el usuario que anula' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- La ejecutiva es la del usuario (executives.user_id es UNIQUE), como personaDelUsuario de la API.
  SELECT e.id, e.status INTO v_exec, v_estado FROM public.executives e WHERE e.user_id = p_user;
  IF NOT FOUND OR v_estado IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'Tu usuario no está enlazado con un Ejecutivo Comercial' USING ERRCODE = 'check_violation';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('visitas_app:' || v_exec::text));
  SELECT v.id, v.source, v.executive_id, v.deleted_at, v.visit_date INTO v_v
  FROM public.visits v
  WHERE v.id = p_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Esa visita no existe' USING ERRCODE = 'no_data_found';
  END IF;
  IF v_v.source IS DISTINCT FROM 'app' THEN
    RAISE EXCEPTION '%', c_no_editable USING ERRCODE = 'check_violation';
  END IF;
  IF v_v.executive_id IS DISTINCT FROM v_exec THEN
    RAISE EXCEPTION 'Esa visita no existe' USING ERRCODE = 'no_data_found';
  END IF;
  IF v_v.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Esa visita ya está anulada' USING ERRCODE = 'check_violation';
  END IF;
  IF v_v.visit_date IS DISTINCT FROM v_hoy THEN
    RAISE EXCEPTION '%', c_no_editable USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.visits
  SET deleted_at = now(), deleted_reason = v_motivo, updated_by = p_user
  WHERE id = p_id;
END;
$$;

REVOKE ALL ON FUNCTION public.visitas_registrar(jsonb, uuid)         FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.visitas_anular(uuid, text, uuid)       FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.visitas_registrar(jsonb, uuid)      TO service_role;
GRANT EXECUTE ON FUNCTION public.visitas_anular(uuid, text, uuid)    TO service_role;

COMMENT ON FUNCTION public.visitas_registrar(jsonb, uuid) IS
  'Registra una visita de la app en una transacción (contrato fase 8, pasos 1 a 8): idempotente por client_id; mismo día en Bogotá, perfil, sede, médico o cuenta, radio presencial, telefónica, topes y líneas; 22023 forma, 23514 regla, 23505 client_id ajeno. Devuelve { visita_id, repetida, out_of_territory, distance_m, visit_date }.';
COMMENT ON FUNCTION public.visitas_anular(uuid, text, uuid) IS
  'Anula con motivo (5..300) una visita de la app de la ejecutiva de p_user y del mismo día (deleted_at); la fila no se borra. P0002 inexistente o ajena; 23514 no editable o ya anulada.';

-- -------------------------------------------------------------------------------------
-- 2. Funciones nuevas de la 0840
-- -------------------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.agenda_crear(jsonb, uuid);
DROP FUNCTION IF EXISTS public.agenda_cancelar(uuid, text, uuid);

-- -------------------------------------------------------------------------------------
-- 3. visits vuelve a sus 43 columnas de la 0830
-- -------------------------------------------------------------------------------------

DROP INDEX IF EXISTS public.visits_agenda_id_uidx;
ALTER TABLE public.visits DROP CONSTRAINT IF EXISTS visits_agenda_check;
ALTER TABLE public.visits
  DROP COLUMN IF EXISTS agenda_id,
  DROP COLUMN IF EXISTS agendada;

-- -------------------------------------------------------------------------------------
-- 4. visitas_agenda (sin CASCADE: si algo más depende de ella, aborta). Sus disparadores, índices y CHECK se van con
--    ella; el disparador de borrado no se dispara con DROP TABLE.
-- -------------------------------------------------------------------------------------

DROP TABLE IF EXISTS public.visitas_agenda;

-- -------------------------------------------------------------------------------------
-- 5. Comprobación: no queda nada de 0840, las funciones son las de la 0830 y las importadas siguen
-- -------------------------------------------------------------------------------------

DO $$
DECLARE
  v_col   record;
  v_n     bigint;
  v_md5   text;
  v_md5_t text;
  v_antes text[];
BEGIN
  IF to_regclass('public.visitas_agenda') IS NOT NULL THEN
    RAISE EXCEPTION 'Rollback 0840: sigue existiendo public.visitas_agenda';
  END IF;
  IF to_regprocedure('public.agenda_crear(jsonb, uuid)') IS NOT NULL
     OR to_regprocedure('public.agenda_cancelar(uuid, text, uuid)') IS NOT NULL THEN
    RAISE EXCEPTION 'Rollback 0840: siguen existiendo agenda_crear o agenda_cancelar';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'visits' AND column_name IN ('agenda_id', 'agendada'))
     OR EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.visits'::regclass AND conname = 'visits_agenda_check')
     OR to_regclass('public.visits_agenda_id_uidx') IS NOT NULL THEN
    RAISE EXCEPTION 'Rollback 0840: quedan columnas, CHECK o índices de la 0840 en visits';
  END IF;
  SELECT count(*) INTO v_n FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'visits';
  IF v_n <> 43 THEN
    RAISE EXCEPTION 'Rollback 0840: visits tiene % columnas; debían quedar las 43 de la 0830', v_n;
  END IF;
  -- Las 5 funciones de la 0830, idénticas a su archivo (md5 del cuerpo)
  FOR v_col IN
    SELECT * FROM (VALUES
      ('visitas_registrar', '0e43cd1432a3c933b820bdf815a02566'), ('visitas_anular', '9f4389cca280e89af80afdebc3f57ea9'),
      ('visitas_editar', 'f7948c247b88575f4695943f4c9bad45'), ('visitas_config_vigente', 'b5ce2f997fc50012ebc3e8d61463bc1c'),
      ('visitas_distancia_m', 'de6fd102ba79b9d0b59dc94ea9d4b60b')
    ) AS t(nombre, huella)
  LOOP
    SELECT md5(p.prosrc) INTO v_md5 FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname = v_col.nombre;
    IF v_md5 IS DISTINCT FROM v_col.huella THEN
      RAISE EXCEPTION 'Rollback 0840: public.% no quedó como en la 0830 (md5 %, se esperaba %)', v_col.nombre, v_md5, v_col.huella;
    END IF;
  END LOOP;
  IF has_function_privilege('anon', 'public.visitas_registrar(jsonb, uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.visitas_anular(uuid, text, uuid)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.visitas_registrar(jsonb, uuid)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.visitas_anular(uuid, text, uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Rollback 0840: los privilegios de visitas_registrar o visitas_anular no quedaron como en la 0830';
  END IF;

  v_antes := string_to_array(current_setting('opmap9944.importadas', true), '|');
  SELECT count(*),
         coalesce(md5(string_agg(v.id::text || v.visit_type || v.contact_type || v.visit_date::text, ',' ORDER BY v.id)), '-'),
         coalesce(md5(string_agg(ROW(v.id, v.kam_id, v.kam_name, v.visit_type, v.contact_type, v.lat, v.lng, v.visit_date,
                                     v.hospital_id, v.imported_by, v.imported_at, v.created_at, v.updated_at,
                                     v.import_id)::text, ',' ORDER BY v.id)), '-')
  INTO v_n, v_md5, v_md5_t
  FROM public.visits v
  WHERE v.source = 'vmo_import';
  IF v_antes IS NULL OR v_n::text <> v_antes[1] OR v_md5 <> v_antes[2] OR v_md5_t <> v_antes[3] THEN
    RAISE EXCEPTION 'Rollback 0840: las visitas importadas cambiaron (antes %, después % / %)', array_to_string(v_antes, ' / '), v_n, v_md5;
  END IF;
  RAISE NOTICE 'Rollback 0840 OK: sin visitas_agenda ni agenda_crear/agenda_cancelar; visits con sus 43 columnas; visitas_registrar y visitas_anular iguales a la 0830 (md5); % importada(s) intactas (huella %).',
    v_n, v_md5;
END;
$$;

COMMIT;
