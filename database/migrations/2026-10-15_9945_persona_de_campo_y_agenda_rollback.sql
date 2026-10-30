-- =====================================================================================
-- OpMap · feat/actividades-de-campo (actividades de campo · F1a) · 9945 — Rollback de 0850
-- Proyecto: norvxqgohddgsdkggqzq · Generado: 2026-10-15 · ESTADO: NO APLICADA
--
-- ANTES DE EJECUTAR: volver a desplegar el código anterior a F1a (sin requirePersonaDeCampo, sin
--   /api/me/agenda/[id]/{cerrar,eliminar,otra-fecha} y con las lecturas por executive_id): el código de F1a lee
--   visits.user_id y visitas_agenda.user_id y llama a agenda_cerrar, agenda_eliminar y agenda_otra_fecha. Los DROP van
--   SIN CASCADE a propósito y abortan si algo más depende de lo que se quita.
--
-- SE DETIENE (y no cambia nada) si hay filas que las reglas de la 0840 no admiten, con el conteo de cada caso:
--   - citas en estado no_realizada o eliminada;
--   - citas con viene_de ("otra fecha");
--   - citas sin Ejecutivo Comercial (agendadas como líder);
--   - visitas de la app sin Ejecutivo Comercial (reportadas como líder).
--   El dueño decide antes qué hacer con ellas (exportarlas, cancelarlas, anularlas…): este rollback no las toca.
--
-- Qué deshace (una sola transacción, todo o nada), en orden inverso a 0850:
--   1. Los disparadores users_salida_cancela_agenda, executives_baja_cancela_agenda y visitas_agenda_cancelar_con_motivo.
--   2. visitas_registrar, visitas_anular y agenda_crear vuelven EXACTAMENTE a la 0840 y visitas_editar a la 0830 (copia
--      literal del cuerpo; se comprueba con el md5 de pg_proc.prosrc); agenda_cancelar vuelve a su firma de 3 argumentos
--      (DROP de la de 4 + CREATE de la de la 0840).
--   3. Las funciones nuevas: persona_lineas, persona_de_campo, ejecutivo_de_la_visita, medico_de_lineas,
--      visitas_config_persona, agenda_choque, agenda_cerrar, agenda_eliminar, agenda_otra_fecha, agenda_cancelar_por_salida
--      y visitas_agenda_cancelar_con_motivo.
--   4. visitas_agenda: los índices únicos vuelven a ser por executive_id (sin las canceladas), se quitan
--      visitas_agenda_viene_de_uidx y visitas_agenda_user_fecha_idx, los CHECK de estado vuelven a los de la 0840, se
--      quitan los CHECK nuevos y las columnas user_id, motivo_codigo, no_realizada_at, no_realizada_motivo,
--      eliminada_at, eliminada_por y viene_de, y executive_id vuelve a NOT NULL (17 columnas, como la 0840).
--   5. visits: visits_app_check vuelve al de la 0830, se quitan visits_user_date_idx y visits_user_next_step_idx y la
--      columna user_id (46 columnas: las 45 de la 0840 y vmo_id de la 0910, que este rollback no toca).
--   NO toca la 0840 ni la 0830 en lo demás, ni 0800, 0810 ni 0820.
--
-- PÉRDIDAS (NOTICE con las cifras antes de quitar): el motivo_codigo de las citas canceladas (el texto del motivo se
--   queda en cancelada_motivo) y la columna user_id (se puede volver a calcular desde executives.user_id). Las visitas
--   importadas de VMO (23.930 el 2026-10-29) NO cambian (se comprueba al final).
--
-- Orden: primero los rollbacks de las fases siguientes de actividades de campo, si se aplicaron (sus números serán
--   nuevos: 9946 y 9947 ya son de las líneas permitidas y de borrar líneas, 2026-10-23), luego este, y después 9944 si
--   se quisiera deshacer también la 0840.
-- Re-ejecutable: sí (IF EXISTS en todo; si la 0850 no está, solo vuelve a dejar las funciones de la 0840).
-- =====================================================================================

BEGIN;

-- -------------------------------------------------------------------------------------
-- 0. Guardas: lo que la 0840 no admite detiene el rollback; aviso de lo que se pierde y huella de las importadas
-- -------------------------------------------------------------------------------------

DO $$
DECLARE
  v_no_realizadas bigint := 0;
  v_eliminadas    bigint := 0;
  v_otra_fecha    bigint := 0;
  v_citas_lider   bigint := 0;
  v_visitas_lider bigint := 0;
  v_codigos       bigint := 0;
  v_imp           bigint;
  v_md5           text;
  v_md5_t         text;
BEGIN
  IF to_regclass('public.visitas_agenda') IS NULL OR to_regprocedure('public.visitas_registrar(jsonb, uuid)') IS NULL THEN
    RAISE EXCEPTION 'Rollback 0850: faltan visitas_agenda o visitas_registrar (¿se deshizo ya la 0840?). Este rollback va antes que 9944';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'visitas_agenda' AND column_name = 'viene_de') THEN
    EXECUTE 'SELECT count(*) FILTER (WHERE estado = ''no_realizada''), count(*) FILTER (WHERE estado = ''eliminada''),
                    count(*) FILTER (WHERE viene_de IS NOT NULL), count(*) FILTER (WHERE executive_id IS NULL),
                    count(*) FILTER (WHERE motivo_codigo IS NOT NULL AND estado = ''cancelada'')
             FROM public.visitas_agenda'
      INTO v_no_realizadas, v_eliminadas, v_otra_fecha, v_citas_lider, v_codigos;
  END IF;
  SELECT count(*) INTO v_visitas_lider FROM public.visits v WHERE v.source = 'app' AND v.executive_id IS NULL;
  IF v_no_realizadas + v_eliminadas + v_otra_fecha + v_citas_lider + v_visitas_lider > 0 THEN
    RAISE EXCEPTION 'Rollback 0850 detenido: hay filas que la 0840 no admite (citas no_realizada: %, eliminadas: %, con otra fecha: %, sin Ejecutivo Comercial: %; visitas de la app sin Ejecutivo Comercial: %). El dueño decide antes qué hacer con ellas',
      v_no_realizadas, v_eliminadas, v_otra_fecha, v_citas_lider, v_visitas_lider;
  END IF;
  RAISE NOTICE 'Rollback 0850: % cita(s) cancelada(s) pierden su motivo_codigo (el texto se queda); se quitan las columnas user_id', v_codigos;

  SELECT count(*),
         md5(string_agg(v.id::text || v.visit_type || v.contact_type || v.visit_date::text, ',' ORDER BY v.id)),
         md5(string_agg(ROW(v.id, v.kam_id, v.kam_name, v.visit_type, v.contact_type, v.lat, v.lng, v.visit_date,
                            v.hospital_id, v.imported_by, v.imported_at, v.created_at, v.updated_at,
                            v.import_id)::text, ',' ORDER BY v.id))
  INTO v_imp, v_md5, v_md5_t
  FROM public.visits v
  WHERE v.source = 'vmo_import';
  PERFORM set_config('opmap9945.importadas', v_imp::text || '|' || coalesce(v_md5, '-') || '|' || coalesce(v_md5_t, '-'), true);
  RAISE NOTICE 'Rollback 0850: % visita(s) importada(s) de VMO se quedan (huella %)', v_imp, coalesce(v_md5, '-');
END;
$$;

-- -------------------------------------------------------------------------------------
-- 1. Disparadores de la 0850
-- -------------------------------------------------------------------------------------

DROP TRIGGER IF EXISTS users_salida_cancela_agenda ON public.users;
DROP TRIGGER IF EXISTS executives_baja_cancela_agenda ON public.executives;
DROP TRIGGER IF EXISTS visitas_agenda_cancelar_con_motivo ON public.visitas_agenda;

-- -------------------------------------------------------------------------------------
-- 2. Funciones reemplazadas: EXACTAMENTE las de la 0840 (visitas_editar, la de la 0830)
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
  v_agenda       uuid;            -- 0840: la cita que trae la visita (agenda_id) o la del vínculo automático
  v_cita         record;
  v_agendada     boolean := false;
  v_relevo       uuid;            -- 0840: la no efectiva suya que suelta la cita porque esta efectiva la toma
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
    v_agenda      := nullif(btrim(p ->> 'agenda_id'), '')::uuid;
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
  SELECT v.id, v.executive_id, v.out_of_territory, v.distance_m, v.visit_date, v.agenda_id, v.agendada
  INTO v_previa
  FROM public.visits v
  WHERE v.client_id = v_client;
  IF FOUND THEN
    IF v_previa.executive_id IS DISTINCT FROM v_exec THEN
      RAISE EXCEPTION 'Ese client_id ya se usó en otra visita' USING ERRCODE = 'unique_violation';
    END IF;
    RETURN jsonb_build_object('visita_id', v_previa.id, 'repetida', true,
                              'out_of_territory', v_previa.out_of_territory,
                              'distance_m', v_previa.distance_m, 'visit_date', v_previa.visit_date,
                              'agenda_id', v_previa.agenda_id, 'agendada', v_previa.agendada);
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

  -- 7b. Agenda (0840, decisiones 6 y 7): la cita que trae la visita o, si no trae, la pendiente suya de ese día y del
  --     mismo tipo con el mismo médico (institucional: la misma cuenta, prefiriendo el mismo subtipo; entre varias, la
  --     de hora más temprana —sin hora al final—, la creada primero y por id). La no efectiva también cumple la cita;
  --     si después llega una EFECTIVA suya con el mismo médico o cuenta ese día, esta toma la cita (relevo: la no
  --     efectiva la suelta), así la efectiva planeada cuenta como agendada. agendada = la cita se creó ANTES del día
  --     de la visita en Bogotá.
  IF v_agenda IS NOT NULL THEN
    SELECT a.id, a.executive_id, a.fecha, a.tipo, a.medico_id, a.cuenta_id, a.estado, a.created_at, a.visita_id
    INTO v_cita
    FROM public.visitas_agenda a
    WHERE a.id = v_agenda
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Esa cita no existe o no es tuya' USING ERRCODE = 'check_violation';
    END IF;
    IF v_cita.executive_id IS DISTINCT FROM v_exec THEN
      RAISE EXCEPTION 'Esa cita no existe o no es tuya' USING ERRCODE = 'check_violation';
    END IF;
    IF v_cita.estado = 'cancelada' THEN
      RAISE EXCEPTION 'Esa cita está cancelada' USING ERRCODE = 'check_violation';
    END IF;
    IF v_cita.estado = 'hecha' THEN
      -- Relevo: solo una efectiva toma la cita, y solo si la cumplió una no efectiva suya no anulada.
      IF NOT v_efectiva OR NOT EXISTS (SELECT 1 FROM public.visits v
                                       WHERE v.id = v_cita.visita_id AND v.source = 'app' AND v.executive_id = v_exec
                                         AND v.deleted_at IS NULL AND NOT v.efectiva) THEN
        RAISE EXCEPTION 'Esa cita ya tiene su visita' USING ERRCODE = 'check_violation';
      END IF;
      v_relevo := v_cita.visita_id;
    END IF;
    IF v_cita.fecha IS DISTINCT FROM v_fecha THEN
      RAISE EXCEPTION 'Esa cita es de otro día' USING ERRCODE = 'check_violation';
    END IF;
    IF v_cita.tipo IS DISTINCT FROM v_tipo THEN
      RAISE EXCEPTION 'Esa cita es de otro tipo de visita' USING ERRCODE = 'check_violation';
    END IF;
    IF v_tipo = 'medica' AND v_cita.medico_id IS DISTINCT FROM v_medico THEN
      RAISE EXCEPTION 'Esa cita es con otro médico' USING ERRCODE = 'check_violation';
    END IF;
    IF v_tipo = 'institucional' AND v_cita.cuenta_id IS DISTINCT FROM v_cuenta THEN
      RAISE EXCEPTION 'Esa cita es con otra cuenta' USING ERRCODE = 'check_violation';
    END IF;
    v_agendada := (v_cita.created_at AT TIME ZONE 'America/Bogota')::date < v_fecha;
  ELSE
    -- La pendiente o, si esta es efectiva, también la que cumplió una no efectiva suya (relevo); el mismo subtipo
    -- primero y, a igual subtipo, la pendiente antes que el relevo.
    SELECT a.id, a.created_at, a.estado, a.visita_id
    INTO v_cita
    FROM public.visitas_agenda a
    WHERE a.executive_id = v_exec AND a.fecha = v_fecha AND a.tipo = v_tipo
      AND CASE WHEN v_tipo = 'medica' THEN a.medico_id = v_medico ELSE a.cuenta_id = v_cuenta END
      AND (a.estado = 'pendiente'
           OR (v_efectiva AND a.estado = 'hecha'
               AND EXISTS (SELECT 1 FROM public.visits v
                           WHERE v.id = a.visita_id AND v.source = 'app' AND v.executive_id = v_exec
                             AND v.deleted_at IS NULL AND NOT v.efectiva)))
    ORDER BY (a.subtipo_id IS NOT DISTINCT FROM v_subtipo) DESC, (a.estado = 'pendiente') DESC, a.hora NULLS LAST,
             a.created_at, a.id
    LIMIT 1
    FOR UPDATE;
    IF FOUND THEN
      v_agenda   := v_cita.id;
      v_agendada := (v_cita.created_at AT TIME ZONE 'America/Bogota')::date < v_fecha;
      IF v_cita.estado = 'hecha' THEN
        v_relevo := v_cita.visita_id;
      END IF;
    END IF;
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

  -- 0840: en un relevo la no efectiva suelta la cita antes (una cita la cumple a lo sumo una visita no anulada).
  IF v_relevo IS NOT NULL THEN
    UPDATE public.visits SET agenda_id = NULL, agendada = false WHERE id = v_relevo;
  END IF;

  INSERT INTO public.visits (
    kam_id, kam_name, visit_type, contact_type, lat, lng, visit_date, hospital_id,
    imported_by, imported_at, import_id,
    source, executive_id, client_id, tipo, subtipo_id, subtipo_codigo, medico_id, cuenta_id, sede_id, contacto_id,
    modalidad, medio, efectiva, failure_reason, retry_date, checked_in_at, reported_at, distance_m, gps_accuracy_m,
    conclusion, compromisos, next_step_date, transcript, input_mode, out_of_territory, created_by, updated_by,
    agenda_id, agendada)
  VALUES (
    v_e_zona, left(v_e_nombre, 255),
    CASE WHEN v_efectiva THEN 'Visita efectiva' ELSE 'Visita no efectiva' END,
    CASE WHEN v_modalidad = 'presencial' THEN 'Visita presencial' ELSE 'Visita virtual' END,
    v_lat_mapa, v_lng_mapa, v_fecha, v_s_hospital,
    NULL, NULL, NULL,
    'app', v_exec, v_client, v_tipo, v_subtipo, v_subtipo_cod, v_medico, v_cuenta, v_sede, v_contacto,
    v_modalidad, v_medio, v_efectiva, v_failure, v_retry, v_checked, v_reported, v_dist, v_precision,
    v_conclusion, v_compromisos, v_next, v_transcript, v_input, v_oot, p_user, p_user,
    v_agenda, v_agendada)
  RETURNING id INTO v_id;

  INSERT INTO public.visit_lines (visit_id, line_id)
  SELECT v_id, l.id FROM unnest(v_lineas) AS l(id);

  -- 0840: la cita queda hecha con esta visita
  IF v_agenda IS NOT NULL THEN
    UPDATE public.visitas_agenda SET estado = 'hecha', visita_id = v_id WHERE id = v_agenda;
  END IF;

  RETURN jsonb_build_object('visita_id', v_id, 'repetida', false, 'out_of_territory', v_oot,
                            'distance_m', v_dist, 'visit_date', v_fecha,
                            'agenda_id', v_agenda, 'agendada', v_agendada);
END;
$$;

CREATE OR REPLACE FUNCTION public.visitas_editar(p_id uuid, p jsonb, p_user uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  c_editables     constant text[] := ARRAY['conclusion', 'compromisos', 'next_step_date', 'efectiva',
                                           'failure_reason', 'retry_date', 'lineas'];
  c_no_editable   constant text := 'Solo puedes corregir o anular tus visitas del mismo día';
  c_motivo_falla  constant text := 'Indica el motivo de la visita no efectiva (hasta 300 caracteres)';
  v_hoy           constant date := (now() AT TIME ZONE 'America/Bogota')::date;
  v_ajenas        text;
  v_exec          uuid;
  v_efectiva_p    boolean;
  v_retry_p       date;
  v_next_p        date;
  v_lineas        uuid[];
  v_v             record;
  v_estado        text;
  v_efectiva      boolean;
  v_failure       text;
  v_retry         date;
  v_conclusion    text;
  v_compromisos   text;
  v_next          date;
  v_cfg           jsonb;
  v_tope          integer;
  v_n             bigint;
BEGIN
  IF p_id IS NULL THEN
    RAISE EXCEPTION 'Falta la visita' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF p IS NULL OR jsonb_typeof(p) <> 'object' THEN
    RAISE EXCEPTION 'Faltan los datos de la corrección' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  SELECT string_agg(t.k, ', ' ORDER BY t.k) INTO v_ajenas
  FROM jsonb_object_keys(p) AS t(k)
  WHERE t.k <> 'executive_id' AND t.k <> ALL (c_editables);
  IF v_ajenas IS NOT NULL THEN
    RAISE EXCEPTION 'Solo se corrigen la conclusión, los compromisos, la próxima reunión, si fue efectiva (con su motivo) y las líneas; para cambiar el tipo, el médico, la cuenta o la sede, anula la visita y repórtala de nuevo (%)',
      v_ajenas USING ERRCODE = 'check_violation';
  END IF;
  IF NOT (p ?| c_editables) THEN
    RAISE EXCEPTION 'No hay campos para corregir' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  BEGIN
    v_exec       := nullif(btrim(p ->> 'executive_id'), '')::uuid;
    v_efectiva_p := (p ->> 'efectiva')::boolean;
    v_retry_p    := nullif(btrim(p ->> 'retry_date'), '')::date;
    v_next_p     := nullif(btrim(p ->> 'next_step_date'), '')::date;
    IF p ? 'lineas' THEN
      IF jsonb_typeof(p -> 'lineas') IS DISTINCT FROM 'array' THEN
        RAISE EXCEPTION 'Elige al menos una línea' USING ERRCODE = 'invalid_parameter_value';
      END IF;
      v_lineas := ARRAY(SELECT DISTINCT t.x::uuid FROM jsonb_array_elements_text(p -> 'lineas') AS t(x));
    END IF;
  EXCEPTION
    WHEN invalid_text_representation OR invalid_datetime_format OR datetime_field_overflow THEN
      RAISE EXCEPTION 'Datos de la corrección no válidos: %', SQLERRM USING ERRCODE = 'invalid_parameter_value';
  END;
  IF v_exec IS NULL THEN
    RAISE EXCEPTION 'Falta el Ejecutivo Comercial de la visita' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF p ? 'efectiva' AND v_efectiva_p IS NULL THEN
    RAISE EXCEPTION 'Indica si la visita fue efectiva (sí o no)' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF v_lineas IS NOT NULL AND (array_position(v_lineas, NULL) IS NOT NULL OR cardinality(v_lineas) > 10) THEN
    RAISE EXCEPTION 'Líneas no válidas (de 1 a 10)' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('visitas_app:' || v_exec::text));
  SELECT v.id, v.source, v.executive_id, v.deleted_at, v.visit_date, v.tipo, v.medico_id, v.modalidad,
         v.efectiva, v.failure_reason, v.retry_date, v.conclusion, v.compromisos, v.next_step_date
  INTO v_v
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
  IF v_v.deleted_at IS NOT NULL OR v_v.visit_date IS DISTINCT FROM v_hoy THEN
    RAISE EXCEPTION '%', c_no_editable USING ERRCODE = 'check_violation';
  END IF;
  SELECT e.status INTO v_estado FROM public.executives e WHERE e.id = v_exec;
  IF v_estado IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'Tu usuario no está enlazado con un Ejecutivo Comercial' USING ERRCODE = 'check_violation';
  END IF;

  -- Valores nuevos: clave presente = cambia; ausente = queda como estaba
  v_efectiva    := CASE WHEN p ? 'efectiva' THEN v_efectiva_p ELSE v_v.efectiva END;
  v_conclusion  := CASE WHEN p ? 'conclusion' THEN nullif(btrim(p ->> 'conclusion'), '') ELSE v_v.conclusion END;
  v_compromisos := CASE WHEN p ? 'compromisos' THEN nullif(btrim(p ->> 'compromisos'), '') ELSE v_v.compromisos END;
  v_next        := CASE WHEN p ? 'next_step_date' THEN v_next_p ELSE v_v.next_step_date END;
  IF v_efectiva THEN
    v_failure := NULL;
    v_retry   := NULL;
  ELSE
    v_failure := CASE WHEN p ? 'failure_reason' THEN nullif(btrim(p ->> 'failure_reason'), '') ELSE v_v.failure_reason END;
    v_retry   := CASE WHEN p ? 'retry_date' THEN v_retry_p ELSE v_v.retry_date END;
    IF v_failure IS NULL THEN
      RAISE EXCEPTION '%', c_motivo_falla USING ERRCODE = 'check_violation';
    END IF;
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
  IF v_next IS NOT NULL AND v_next < v_v.visit_date THEN
    RAISE EXCEPTION 'La próxima reunión no puede ser anterior a la fecha de la visita' USING ERRCODE = 'check_violation';
  END IF;
  IF v_retry IS NOT NULL AND v_retry < v_v.visit_date THEN
    RAISE EXCEPTION 'La fecha para reintentar no puede ser anterior a la fecha de la visita' USING ERRCODE = 'check_violation';
  END IF;

  -- Pasar a efectiva: vuelve a mirar los topes (sin contarse a sí misma)
  IF v_efectiva AND NOT v_v.efectiva THEN
    v_cfg := public.visitas_config_vigente(v_exec, v_v.visit_date);
    IF v_v.tipo = 'medica' THEN
      SELECT count(*) INTO v_n
      FROM public.visits v
      WHERE v.source = 'app' AND v.executive_id = v_exec AND v.visit_date = v_v.visit_date
        AND v.medico_id = v_v.medico_id AND v.efectiva AND v.deleted_at IS NULL AND v.id <> p_id;
      IF v_n >= (v_cfg ->> 'tope_visitas_medico_dia')::integer THEN
        RAISE EXCEPTION 'Ya reportaste una visita a este médico hoy' USING ERRCODE = 'check_violation';
      END IF;
    END IF;
    IF v_v.modalidad = 'telefonica' THEN
      v_tope := (v_cfg #>> '{telefonica,tope_dia}')::integer;
      SELECT count(*) INTO v_n
      FROM public.visits v
      WHERE v.source = 'app' AND v.executive_id = v_exec AND v.visit_date = v_v.visit_date
        AND v.modalidad = 'telefonica' AND v.efectiva AND v.deleted_at IS NULL AND v.id <> p_id;
      IF v_n >= v_tope THEN
        RAISE EXCEPTION '%', CASE WHEN v_tope = 1 THEN 'Ya reportaste tu visita telefónica de hoy'
                                  ELSE format('Ya reportaste las %s visitas telefónicas de hoy', v_tope) END
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;
  END IF;

  IF v_lineas IS NOT NULL THEN
    IF cardinality(v_lineas) = 0 THEN
      RAISE EXCEPTION 'Elige al menos una línea' USING ERRCODE = 'check_violation';
    END IF;
    IF EXISTS (SELECT 1 FROM unnest(v_lineas) AS l(id)
               WHERE NOT EXISTS (SELECT 1 FROM public.executive_lines el
                                 WHERE el.executive_id = v_exec AND el.line_id = l.id)) THEN
      RAISE EXCEPTION 'Alguna de las líneas no es tuya' USING ERRCODE = 'check_violation';
    END IF;
    DELETE FROM public.visit_lines vl WHERE vl.visit_id = p_id;
    INSERT INTO public.visit_lines (visit_id, line_id)
    SELECT p_id, l.id FROM unnest(v_lineas) AS l(id);
  END IF;

  UPDATE public.visits
  SET conclusion     = v_conclusion,
      compromisos    = v_compromisos,
      next_step_date = v_next,
      efectiva       = v_efectiva,
      failure_reason = v_failure,
      retry_date     = v_retry,
      visit_type     = CASE WHEN v_efectiva THEN 'Visita efectiva' ELSE 'Visita no efectiva' END,
      updated_by     = p_user
  WHERE id = p_id;
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
  v_cita        record;           -- 0840: la cita que cumplía la visita anulada
  v_otra        uuid;             -- 0840: otra visita suya de ese día que la retoma
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

  -- 0840: la cita que cumplía pasa a otra visita suya no anulada de ese día, del mismo tipo y con el mismo médico o
  -- cuenta, que no tenga cita (la efectiva primero, luego el mismo subtipo, la llegada más temprana y por id; p. ej. la
  -- no efectiva que la había cumplido antes de un relevo); si no hay, vuelve a pendiente. La visita anulada conserva
  -- agenda_id como rastro (el índice único de visits.agenda_id no cuenta las anuladas).
  SELECT a.id, a.fecha, a.tipo, a.medico_id, a.cuenta_id, a.subtipo_id, a.created_at
  INTO v_cita
  FROM public.visitas_agenda a
  WHERE a.visita_id = p_id AND a.estado = 'hecha'
  FOR UPDATE;
  IF FOUND THEN
    SELECT v.id INTO v_otra
    FROM public.visits v
    WHERE v.source = 'app' AND v.executive_id = v_exec AND v.deleted_at IS NULL AND v.agenda_id IS NULL
      AND v.id <> p_id AND v.visit_date = v_cita.fecha AND v.tipo = v_cita.tipo
      AND CASE WHEN v_cita.tipo = 'medica' THEN v.medico_id = v_cita.medico_id ELSE v.cuenta_id = v_cita.cuenta_id END
    ORDER BY v.efectiva DESC, (v.subtipo_id IS NOT DISTINCT FROM v_cita.subtipo_id) DESC, v.checked_in_at, v.id
    LIMIT 1
    FOR UPDATE;
    IF FOUND THEN
      UPDATE public.visits
      SET agenda_id = v_cita.id, agendada = (v_cita.created_at AT TIME ZONE 'America/Bogota')::date < v_cita.fecha
      WHERE id = v_otra;
      UPDATE public.visitas_agenda SET visita_id = v_otra WHERE id = v_cita.id;
    ELSE
      UPDATE public.visitas_agenda SET estado = 'pendiente', visita_id = NULL WHERE id = v_cita.id;
    END IF;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.agenda_crear(p jsonb, p_user uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  c_dias_adelante constant integer := 30;  -- DIAS_AGENDA_ADELANTE de web/lib/reporte-visitas.ts
  v_hoy           constant date := (now() AT TIME ZONE 'America/Bogota')::date;
  v_fecha         date;
  v_hora          time;
  v_tipo          text;
  v_medico        uuid;
  v_cuenta        uuid;
  v_subtipo       uuid;
  v_sede          uuid;
  v_nota          text;
  v_exec          uuid;
  v_estado        text;
  v_zona          uuid;
  v_cfg           jsonb;
  v_s_cuenta      uuid;
  v_s_activa      boolean;
  v_c_activa      boolean;
  v_id            uuid;
BEGIN
  IF p IS NULL OR jsonb_typeof(p) <> 'object' THEN
    RAISE EXCEPTION 'Faltan los datos de la cita' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF p_user IS NULL THEN
    RAISE EXCEPTION 'Falta el usuario que agenda' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- 0. Forma (la API ya validó con zod; aquí se revisa otra vez para que la base no dependa de la API)
  BEGIN
    v_fecha   := nullif(btrim(p ->> 'fecha'), '')::date;
    v_hora    := nullif(btrim(p ->> 'hora'), '')::time;
    v_tipo    := nullif(btrim(p ->> 'tipo'), '');
    v_medico  := nullif(btrim(p ->> 'medico_id'), '')::uuid;
    v_cuenta  := nullif(btrim(p ->> 'cuenta_id'), '')::uuid;
    v_subtipo := nullif(btrim(p ->> 'subtipo_id'), '')::uuid;
    v_sede    := nullif(btrim(p ->> 'sede_id'), '')::uuid;
    v_nota    := nullif(btrim(p ->> 'nota'), '');
  EXCEPTION
    WHEN invalid_text_representation OR invalid_datetime_format OR datetime_field_overflow THEN
      RAISE EXCEPTION 'Datos de la cita no válidos: %', SQLERRM USING ERRCODE = 'invalid_parameter_value';
  END;
  IF v_fecha IS NULL THEN
    RAISE EXCEPTION 'Elige la fecha de la cita' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF v_hora IS NOT NULL AND v_hora > time '23:59:59' THEN
    RAISE EXCEPTION 'Hora no válida: usa HH:MM (de 00:00 a 23:59)' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF v_tipo IS NULL OR v_tipo NOT IN ('medica', 'institucional') THEN
    RAISE EXCEPTION 'Tipo de visita no válido: medica o institucional' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF v_sede IS NULL THEN
    RAISE EXCEPTION 'Elige la sede' USING ERRCODE = 'invalid_parameter_value';
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
  IF char_length(v_nota) > 300 THEN
    RAISE EXCEPTION 'La nota no puede superar 300 caracteres' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  -- Solo lo que aplica al tipo
  IF v_tipo = 'medica' THEN
    v_cuenta := NULL; v_subtipo := NULL;
  ELSE
    v_medico := NULL;
  END IF;

  -- 1. La persona es la del usuario (executives.user_id es UNIQUE), activa y con zona; candado por persona (el mismo
  --    de las visitas: agendar, cancelar y vincular no se cruzan).
  SELECT e.id, e.status, e.base_kam_id INTO v_exec, v_estado, v_zona
  FROM public.executives e
  WHERE e.user_id = p_user;
  IF NOT FOUND OR v_estado IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'Tu usuario no está enlazado con un Ejecutivo Comercial' USING ERRCODE = 'check_violation';
  END IF;
  IF v_zona IS NULL THEN
    RAISE EXCEPTION 'Tu Ejecutivo Comercial no tiene zona base' USING ERRCODE = 'check_violation';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('visitas_app:' || v_exec::text));

  -- 2. Ventana (decisión 3): de hoy a hoy + 30 en Bogotá; no en un día libre aprobado de día completo
  IF v_fecha < v_hoy THEN
    RAISE EXCEPTION 'No se agenda en el pasado: elige hoy o una fecha posterior' USING ERRCODE = 'check_violation';
  END IF;
  IF v_fecha > v_hoy + c_dias_adelante THEN
    RAISE EXCEPTION 'Solo se agenda hasta % días adelante', c_dias_adelante USING ERRCODE = 'check_violation';
  END IF;
  IF EXISTS (SELECT 1 FROM public.dias_libres d
             WHERE d.executive_id = v_exec AND d.fecha = v_fecha
               AND d.estado IN ('registrado', 'aprobado') AND d.fraccion >= 1) THEN
    RAISE EXCEPTION 'Ese día lo tienes libre (día libre aprobado): no se agenda' USING ERRCODE = 'check_violation';
  END IF;

  -- 3. Perfil vigente en la fecha de la cita
  v_cfg := public.visitas_config_vigente(v_exec, v_fecha);
  IF NOT ((v_cfg -> 'perfil') ? v_tipo) THEN
    RAISE EXCEPTION '%', CASE WHEN v_tipo = 'medica' THEN 'Tu perfil no incluye visitas médicas'
                              ELSE 'Tu perfil no incluye visitas institucionales' END
      USING ERRCODE = 'check_violation';
  END IF;

  -- 4. Sede activa de una cuenta activa; médico activo que atiende ahí, o sede de la cuenta y subtipo vigente
  SELECT s.cuenta_id, s.activo INTO v_s_cuenta, v_s_activa
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
  ELSE
    IF v_s_cuenta IS DISTINCT FROM v_cuenta THEN
      RAISE EXCEPTION 'Esa sede no es de la cuenta elegida' USING ERRCODE = 'check_violation';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.subtipos_institucionales si
                   WHERE si.id = v_subtipo AND si.vigente_desde <= v_fecha
                     AND (si.vigente_hasta IS NULL OR si.vigente_hasta >= v_fecha)) THEN
      RAISE EXCEPTION 'Ese subtipo no está vigente' USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  -- 5. Sin duplicados (decisión 4): 23505 → 409 en la API (los índices únicos son la última barrera)
  IF v_tipo = 'medica' AND EXISTS (
       SELECT 1 FROM public.visitas_agenda a
       WHERE a.executive_id = v_exec AND a.fecha = v_fecha AND a.tipo = 'medica' AND a.medico_id = v_medico
         AND a.estado <> 'cancelada') THEN
    RAISE EXCEPTION 'Ya tienes una cita con ese médico ese día' USING ERRCODE = 'unique_violation';
  END IF;
  IF v_tipo = 'institucional' AND EXISTS (
       SELECT 1 FROM public.visitas_agenda a
       WHERE a.executive_id = v_exec AND a.fecha = v_fecha AND a.tipo = 'institucional' AND a.cuenta_id = v_cuenta
         AND a.subtipo_id = v_subtipo AND a.estado <> 'cancelada') THEN
    RAISE EXCEPTION 'Ya tienes una cita con esa cuenta y ese subtipo ese día' USING ERRCODE = 'unique_violation';
  END IF;

  INSERT INTO public.visitas_agenda (executive_id, fecha, hora, tipo, medico_id, cuenta_id, subtipo_id, sede_id, nota,
                                     estado, created_by)
  VALUES (v_exec, v_fecha, v_hora, v_tipo, v_medico, v_cuenta, v_subtipo, v_sede, v_nota, 'pendiente', p_user)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('cita_id', v_id);
END;
$$;

DROP FUNCTION IF EXISTS public.agenda_cancelar(uuid, text, uuid, text);

CREATE OR REPLACE FUNCTION public.agenda_cancelar(p_id uuid, p_motivo text, p_user uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_hoy    constant date := (now() AT TIME ZONE 'America/Bogota')::date;
  v_motivo constant text := nullif(btrim(p_motivo), '');
  v_exec   uuid;
  v_estado text;
  v_cita   record;
BEGIN
  IF p_id IS NULL THEN
    RAISE EXCEPTION 'Falta la cita' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF p_user IS NULL THEN
    RAISE EXCEPTION 'Falta el usuario que cancela' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF char_length(v_motivo) > 300 THEN
    RAISE EXCEPTION 'El motivo no puede superar 300 caracteres' USING ERRCODE = 'check_violation';
  END IF;

  SELECT e.id, e.status INTO v_exec, v_estado FROM public.executives e WHERE e.user_id = p_user;
  IF NOT FOUND OR v_estado IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'Tu usuario no está enlazado con un Ejecutivo Comercial' USING ERRCODE = 'check_violation';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('visitas_app:' || v_exec::text));
  SELECT a.id, a.executive_id, a.estado, a.fecha INTO v_cita
  FROM public.visitas_agenda a
  WHERE a.id = p_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Esa cita no existe' USING ERRCODE = 'no_data_found';
  END IF;
  IF v_cita.executive_id IS DISTINCT FROM v_exec THEN
    RAISE EXCEPTION 'Esa cita no existe' USING ERRCODE = 'no_data_found';
  END IF;
  IF v_cita.estado = 'cancelada' THEN
    RAISE EXCEPTION 'Esa cita ya está cancelada' USING ERRCODE = 'check_violation';
  END IF;
  IF v_cita.estado = 'hecha' THEN
    RAISE EXCEPTION 'Esa cita ya tiene su visita: no se cancela' USING ERRCODE = 'check_violation';
  END IF;
  IF v_cita.fecha < v_hoy THEN
    RAISE EXCEPTION 'Solo se cancelan las citas de hoy en adelante' USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.visitas_agenda
  SET estado = 'cancelada', cancelada_at = now(), cancelada_motivo = v_motivo
  WHERE id = p_id;
END;
$$;

REVOKE ALL ON FUNCTION public.visitas_registrar(jsonb, uuid)         FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.visitas_editar(uuid, jsonb, uuid)      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.visitas_anular(uuid, text, uuid)       FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agenda_crear(jsonb, uuid)              FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agenda_cancelar(uuid, text, uuid)      FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.visitas_registrar(jsonb, uuid)      TO service_role;
GRANT EXECUTE ON FUNCTION public.visitas_editar(uuid, jsonb, uuid)   TO service_role;
GRANT EXECUTE ON FUNCTION public.visitas_anular(uuid, text, uuid)    TO service_role;
GRANT EXECUTE ON FUNCTION public.agenda_crear(jsonb, uuid)           TO service_role;
GRANT EXECUTE ON FUNCTION public.agenda_cancelar(uuid, text, uuid)   TO service_role;

COMMENT ON FUNCTION public.agenda_crear(jsonb, uuid) IS
  'Agenda una cita de la persona de p_user (F4.1): de hoy a hoy + 30 en Bogotá, no en un día libre aprobado de día completo, perfil vigente en la fecha, sede activa de una cuenta activa, médico activo que atiende en la sede o sede de la cuenta y subtipo vigente; sin duplicados. 22023 forma, 23514 regla, 23505 repetida. Devuelve { cita_id }.';
COMMENT ON FUNCTION public.agenda_cancelar(uuid, text, uuid) IS
  'Cancela una cita pendiente de hoy o futura de la persona de p_user (motivo opcional ≤ 300); la fila no se borra. P0002 inexistente o ajena; 23514 cancelada, hecha o pasada.';
COMMENT ON FUNCTION public.visitas_registrar(jsonb, uuid) IS
  'Registra una visita de la app en una transacción (contrato fase 8, pasos 1 a 8, y 7b de la 0840): idempotente por client_id; mismo día en Bogotá, perfil, sede, médico o cuenta, radio presencial, telefónica, topes y líneas; vínculo con la agenda (agenda_id validado o la cita pendiente de ese día con el mismo médico o cuenta; una efectiva toma la cita que cumplió una no efectiva suya) y agendada si la cita se creó antes del día; 22023 forma, 23514 regla, 23505 client_id ajeno. Devuelve { visita_id, repetida, out_of_territory, distance_m, visit_date, agenda_id, agendada }.';
COMMENT ON FUNCTION public.visitas_editar(uuid, jsonb, uuid) IS
  'Corrige una visita de la app de la misma ejecutiva y del mismo día (conclusión, compromisos, próxima reunión, efectiva y motivo, líneas); a efectiva revalida los topes. P0002 inexistente o ajena; 23514 no editable.';
COMMENT ON FUNCTION public.visitas_anular(uuid, text, uuid) IS
  'Anula con motivo (5..300) una visita de la app de la ejecutiva de p_user y del mismo día (deleted_at); la fila no se borra y su cita pasa a otra visita suya de ese día con el mismo médico o cuenta (la efectiva primero) o vuelve a pendiente. P0002 inexistente o ajena; 23514 no editable o ya anulada.';

-- -------------------------------------------------------------------------------------
-- 3. Funciones nuevas de la 0850
-- -------------------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.agenda_cancelar_por_salida();
DROP FUNCTION IF EXISTS public.visitas_agenda_cancelar_con_motivo();
DROP FUNCTION IF EXISTS public.agenda_otra_fecha(uuid, jsonb, uuid);
DROP FUNCTION IF EXISTS public.agenda_eliminar(uuid, uuid);
DROP FUNCTION IF EXISTS public.agenda_cerrar(uuid, jsonb, uuid);
DROP FUNCTION IF EXISTS public.agenda_choque(uuid, date, time, uuid);
DROP FUNCTION IF EXISTS public.visitas_config_persona(uuid, date);
DROP FUNCTION IF EXISTS public.medico_de_lineas(uuid, uuid[], date);
DROP FUNCTION IF EXISTS public.ejecutivo_de_la_visita(uuid, uuid[]);
DROP FUNCTION IF EXISTS public.persona_de_campo(uuid);
DROP FUNCTION IF EXISTS public.persona_lineas(uuid);

-- -------------------------------------------------------------------------------------
-- 4. visitas_agenda vuelve a la 0840 (17 columnas)
-- -------------------------------------------------------------------------------------

DROP INDEX IF EXISTS public.visitas_agenda_viene_de_uidx;
DROP INDEX IF EXISTS public.visitas_agenda_user_fecha_idx;
DROP INDEX IF EXISTS public.visitas_agenda_medico_uidx;
CREATE UNIQUE INDEX visitas_agenda_medico_uidx
  ON public.visitas_agenda (executive_id, fecha, medico_id) WHERE tipo = 'medica' AND estado <> 'cancelada';
DROP INDEX IF EXISTS public.visitas_agenda_cuenta_uidx;
CREATE UNIQUE INDEX visitas_agenda_cuenta_uidx
  ON public.visitas_agenda (executive_id, fecha, cuenta_id, subtipo_id) WHERE tipo = 'institucional' AND estado <> 'cancelada';

ALTER TABLE public.visitas_agenda DROP CONSTRAINT IF EXISTS visitas_agenda_estado_check;
ALTER TABLE public.visitas_agenda ADD CONSTRAINT visitas_agenda_estado_check
  CHECK (estado IN ('pendiente', 'hecha', 'cancelada'));
ALTER TABLE public.visitas_agenda DROP CONSTRAINT IF EXISTS visitas_agenda_estado_datos_check;
ALTER TABLE public.visitas_agenda ADD CONSTRAINT visitas_agenda_estado_datos_check CHECK (
  CASE estado
    WHEN 'pendiente' THEN visita_id IS NULL AND cancelada_at IS NULL AND cancelada_motivo IS NULL
    WHEN 'hecha'     THEN visita_id IS NOT NULL AND cancelada_at IS NULL AND cancelada_motivo IS NULL
    ELSE visita_id IS NULL AND cancelada_at IS NOT NULL
  END);
ALTER TABLE public.visitas_agenda DROP CONSTRAINT IF EXISTS visitas_agenda_motivo_codigo_check;
ALTER TABLE public.visitas_agenda DROP CONSTRAINT IF EXISTS visitas_agenda_no_realizada_motivo_check;
ALTER TABLE public.visitas_agenda DROP CONSTRAINT IF EXISTS visitas_agenda_viene_de_check;
ALTER TABLE public.visitas_agenda
  DROP COLUMN IF EXISTS viene_de,
  DROP COLUMN IF EXISTS eliminada_por,
  DROP COLUMN IF EXISTS eliminada_at,
  DROP COLUMN IF EXISTS no_realizada_motivo,
  DROP COLUMN IF EXISTS no_realizada_at,
  DROP COLUMN IF EXISTS motivo_codigo,
  DROP COLUMN IF EXISTS user_id;
ALTER TABLE public.visitas_agenda ALTER COLUMN executive_id SET NOT NULL;

COMMENT ON TABLE public.visitas_agenda IS
  'Agenda de visitas (F4.1): una fila por cita de un Ejecutivo Comercial (día, hora opcional, médico en una sede o cuenta y subtipo en una sede). Se crea con agenda_crear (de hoy a 30 días, no en un día libre aprobado), se cancela con agenda_cancelar y pasa a hecha cuando visitas_registrar la vincula. No se borra. RLS sin políticas; solo service_role.';
COMMENT ON COLUMN public.visitas_agenda.executive_id IS 'Ejecutivo Comercial dueño de la cita (sale del usuario que agenda).';
COMMENT ON COLUMN public.visitas_agenda.fecha IS 'Día de la cita (Bogotá): de hoy a hoy + 30 al agendar.';
COMMENT ON COLUMN public.visitas_agenda.hora IS 'Hora de la cita (opcional; sin medias horas ni ruteros).';
COMMENT ON COLUMN public.visitas_agenda.estado IS 'pendiente | hecha (con visita_id) | cancelada (con cancelada_at). Anular la visita la pasa a otra visita suya de ese día con el mismo médico o cuenta, o la devuelve a pendiente.';
COMMENT ON COLUMN public.visitas_agenda.cancelada_motivo IS 'Motivo de la cancelación (opcional, ≤ 300).';

-- -------------------------------------------------------------------------------------
-- 5. visits vuelve a la 0840 y la 0910 (46 columnas; visits_app_check de la 0830)
-- -------------------------------------------------------------------------------------

ALTER TABLE public.visits DROP CONSTRAINT IF EXISTS visits_app_check;
ALTER TABLE public.visits ADD CONSTRAINT visits_app_check CHECK (
  (tipo IS NULL OR tipo IN ('medica', 'institucional'))
  AND (modalidad IS NULL OR modalidad IN ('presencial', 'telefonica'))
  AND (medio IS NULL OR medio IN ('llamada', 'videollamada'))
  AND (input_mode IS NULL OR input_mode IN ('voz', 'toques'))
  AND (failure_reason IS NULL OR (btrim(failure_reason) <> '' AND char_length(failure_reason) <= 300))
  AND (conclusion IS NULL OR char_length(conclusion) <= 2000)
  AND (compromisos IS NULL OR char_length(compromisos) <= 2000)
  AND (transcript IS NULL OR char_length(transcript) <= 8000)
  AND (distance_m IS NULL OR distance_m >= 0)
  AND (gps_accuracy_m IS NULL OR gps_accuracy_m >= 0)
  AND ((deleted_at IS NULL) = (deleted_reason IS NULL))
  AND (deleted_reason IS NULL OR char_length(btrim(deleted_reason)) BETWEEN 5 AND 300)
  AND (source <> 'app' OR (
        executive_id IS NOT NULL AND client_id IS NOT NULL AND tipo IS NOT NULL AND sede_id IS NOT NULL
        AND modalidad IS NOT NULL AND efectiva IS NOT NULL AND checked_in_at IS NOT NULL AND reported_at IS NOT NULL
        AND input_mode IS NOT NULL AND kam_id IS NOT NULL
        AND reported_at >= checked_in_at
        AND visit_date = (checked_in_at AT TIME ZONE 'America/Bogota')::date
        AND (next_step_date IS NULL OR next_step_date >= visit_date)
        AND (retry_date IS NULL OR retry_date >= visit_date)
        AND CASE WHEN tipo = 'medica'
                 THEN medico_id IS NOT NULL AND subtipo_id IS NULL AND subtipo_codigo IS NULL AND contacto_id IS NULL
                 ELSE cuenta_id IS NOT NULL AND subtipo_id IS NOT NULL AND subtipo_codigo IS NOT NULL
                      AND medico_id IS NULL
            END
        AND CASE WHEN modalidad = 'presencial'
                 THEN medio IS NULL AND distance_m IS NOT NULL AND contact_type = 'Visita presencial'
                 ELSE medio IS NOT NULL AND contact_type = 'Visita virtual'
            END
        AND CASE WHEN efectiva
                 THEN failure_reason IS NULL AND retry_date IS NULL AND visit_type = 'Visita efectiva'
                 ELSE failure_reason IS NOT NULL AND visit_type = 'Visita no efectiva'
            END
      ))
);
DROP INDEX IF EXISTS public.visits_user_date_idx;
DROP INDEX IF EXISTS public.visits_user_next_step_idx;
ALTER TABLE public.visits DROP COLUMN IF EXISTS user_id;
COMMENT ON COLUMN public.visits.executive_id IS 'Ejecutivo Comercial que reporta (obligatorio en las de la app).';

-- -------------------------------------------------------------------------------------
-- 6. Comprobación: no queda nada de 0850, las funciones son las de la 0840 y las importadas siguen
-- -------------------------------------------------------------------------------------

DO $$
DECLARE
  v_col   record;
  v_fn    text;
  v_n     bigint;
  v_md5   text;
  v_md5_t text;
  v_antes text[];
BEGIN
  FOREACH v_fn IN ARRAY ARRAY['public.persona_lineas(uuid)', 'public.persona_de_campo(uuid)',
                              'public.ejecutivo_de_la_visita(uuid, uuid[])', 'public.medico_de_lineas(uuid, uuid[], date)',
                              'public.visitas_config_persona(uuid, date)', 'public.agenda_choque(uuid, date, time, uuid)',
                              'public.agenda_cerrar(uuid, jsonb, uuid)', 'public.agenda_eliminar(uuid, uuid)',
                              'public.agenda_otra_fecha(uuid, jsonb, uuid)', 'public.agenda_cancelar(uuid, text, uuid, text)',
                              'public.agenda_cancelar_por_salida()', 'public.visitas_agenda_cancelar_con_motivo()'] LOOP
    IF to_regprocedure(v_fn) IS NOT NULL THEN
      RAISE EXCEPTION 'Rollback 0850: sigue existiendo %', v_fn;
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_trigger t WHERE NOT t.tgisinternal
               AND t.tgname IN ('users_salida_cancela_agenda', 'executives_baja_cancela_agenda', 'visitas_agenda_cancelar_con_motivo')) THEN
    RAISE EXCEPTION 'Rollback 0850: quedan disparadores de la 0850';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public'
               AND ((table_name = 'visits' AND column_name = 'user_id')
                    OR (table_name = 'visitas_agenda' AND column_name IN ('user_id', 'motivo_codigo', 'no_realizada_at',
                        'no_realizada_motivo', 'eliminada_at', 'eliminada_por', 'viene_de'))))
     OR to_regclass('public.visits_user_date_idx') IS NOT NULL OR to_regclass('public.visits_user_next_step_idx') IS NOT NULL
     OR to_regclass('public.visitas_agenda_viene_de_uidx') IS NOT NULL OR to_regclass('public.visitas_agenda_user_fecha_idx') IS NOT NULL THEN
    RAISE EXCEPTION 'Rollback 0850: quedan columnas o índices de la 0850';
  END IF;
  SELECT count(*) INTO v_n FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'visits';
  IF v_n <> 46 THEN
    RAISE EXCEPTION 'Rollback 0850: visits tiene % columnas; debían quedar 46 (las 45 de la 0840 y vmo_id de la 0910)', v_n;
  END IF;
  SELECT count(*) INTO v_n FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'visitas_agenda';
  IF v_n <> 17 THEN
    RAISE EXCEPTION 'Rollback 0850: visitas_agenda tiene % columnas; debían quedar las 17 de la 0840', v_n;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'visitas_agenda'
                   AND column_name = 'executive_id' AND is_nullable = 'NO') THEN
    RAISE EXCEPTION 'Rollback 0850: visitas_agenda.executive_id debía volver a NOT NULL';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid
                 JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = i.indkey[0]
                 WHERE c.relname = 'visitas_agenda_medico_uidx' AND i.indisunique AND a.attname = 'executive_id') THEN
    RAISE EXCEPTION 'Rollback 0850: visitas_agenda_medico_uidx debía volver a ser por executive_id';
  END IF;
  -- Las funciones de la 0840 (y visitas_editar, visitas_config_vigente y visitas_distancia_m de la 0830), idénticas a
  -- su archivo (md5 del cuerpo).
  FOR v_col IN
    SELECT * FROM (VALUES
      ('visitas_registrar', 'eeae55de7196179daa686cc9bd11da7c'), ('visitas_anular', '462a121cfde8802c4a830bd3c61c05e4'),
      ('agenda_crear', '68e92a28d606fd2b45b57530db87558c'), ('agenda_cancelar', 'cf3d768d58654ec1e767144fafb62be5'),
      ('visitas_editar', 'f7948c247b88575f4695943f4c9bad45'), ('visitas_config_vigente', 'b5ce2f997fc50012ebc3e8d61463bc1c'),
      ('visitas_distancia_m', 'de6fd102ba79b9d0b59dc94ea9d4b60b'), ('ejecutivas_traspasar', 'ff6344693b3256a125f12b3222910e5b')
    ) AS t(nombre, huella)
  LOOP
    SELECT md5(p.prosrc) INTO v_md5 FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname = v_col.nombre;
    IF v_md5 IS DISTINCT FROM v_col.huella THEN
      RAISE EXCEPTION 'Rollback 0850: public.% no quedó como en su migración (md5 %, se esperaba %)', v_col.nombre, v_md5, v_col.huella;
    END IF;
  END LOOP;
  FOREACH v_fn IN ARRAY ARRAY['public.visitas_registrar(jsonb, uuid)', 'public.visitas_editar(uuid, jsonb, uuid)',
                              'public.visitas_anular(uuid, text, uuid)', 'public.agenda_crear(jsonb, uuid)',
                              'public.agenda_cancelar(uuid, text, uuid)'] LOOP
    IF has_function_privilege('anon', v_fn, 'EXECUTE') OR has_function_privilege('authenticated', v_fn, 'EXECUTE')
       OR NOT has_function_privilege('service_role', v_fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'Rollback 0850: los privilegios de % no quedaron como en la 0840', v_fn;
    END IF;
  END LOOP;

  v_antes := string_to_array(current_setting('opmap9945.importadas', true), '|');
  SELECT count(*),
         coalesce(md5(string_agg(v.id::text || v.visit_type || v.contact_type || v.visit_date::text, ',' ORDER BY v.id)), '-'),
         coalesce(md5(string_agg(ROW(v.id, v.kam_id, v.kam_name, v.visit_type, v.contact_type, v.lat, v.lng, v.visit_date,
                                     v.hospital_id, v.imported_by, v.imported_at, v.created_at, v.updated_at,
                                     v.import_id)::text, ',' ORDER BY v.id)), '-')
  INTO v_n, v_md5, v_md5_t
  FROM public.visits v
  WHERE v.source = 'vmo_import';
  IF v_antes IS NULL OR v_n::text <> v_antes[1] OR v_md5 <> v_antes[2] OR v_md5_t <> v_antes[3] THEN
    RAISE EXCEPTION 'Rollback 0850: las visitas importadas cambiaron (antes %, después % / %)', array_to_string(v_antes, ' / '), v_n, v_md5;
  END IF;
  RAISE NOTICE 'Rollback 0850 OK: sin las funciones, disparadores, columnas ni índices de la 0850; visits con 46 columnas y visitas_agenda con 17; las funciones son las de la 0840 (md5); % importada(s) intactas (huella %).',
    v_n, v_md5;
END;
$$;

COMMIT;
