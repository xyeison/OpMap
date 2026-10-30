-- =====================================================================================
-- OpMap · feat/campo-sin-senal · 9959 — Rollback de 0940 (la app de campo sin señal)
-- Proyecto: norvxqgohddgsdkggqzq · Generado: 2026-10-30 · NO EJECUTADO TODAVÍA
--
-- ANTES DE EJECUTAR: desplegar el código anterior a la rama (la API de la 0940 manda tz, gps_at, marcas… que la
--   visitas_registrar de la 0850 ignora, así que el código nuevo con la base vieja sigue funcionando; al revés, la app
--   vieja con la 0940 también). Vaciar el bucket visitas-fotos desde el panel de Supabase: no se puede borrar por SQL
--   (trigger protect_buckets_delete) y este script no lo intenta.
--
-- Qué deshace (una transacción, todo o nada):
--   1. Vuelve a la visitas_registrar de la 0850 (texto literal) y al visits_app_check de la 0850. ABORTA si hay visitas de
--      la app sin medico_id (médico no listado) o presenciales sin distance_m: el CHECK viejo no las admite. Hay que
--      resolverlas a mano antes (anularlas con motivo o completarlas).
--   2. Quita visits.tz, gps_at, marcas, en_sitio, foto_path, medico_no_listado y motivo_codigo (PÉRDIDA: las marcas, las
--      fotos enlazadas, el motivo de lista y el médico no listado; failure_reason conserva el texto del motivo).
--   3. Borra public.motivos_no_efectiva.
--   4. Devuelve radio_presencial_m a 500 m desde hoy con config_registrar (si la vigente es 300).
-- Re-ejecutable: sí. Tras aplicar: NOTIFY pgrst, 'reload schema';
-- =====================================================================================

BEGIN;

DO $$
DECLARE
  n_no_listado bigint;
  n_sin_dist   bigint;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'visits' AND column_name = 'medico_no_listado') THEN
    EXECUTE $q$SELECT count(*) FROM public.visits WHERE source = 'app' AND tipo = 'medica' AND medico_id IS NULL$q$ INTO n_no_listado;
    EXECUTE $q$SELECT count(*) FROM public.visits WHERE source = 'app' AND modalidad = 'presencial' AND distance_m IS NULL$q$ INTO n_sin_dist;
    IF n_no_listado > 0 OR n_sin_dist > 0 THEN
      RAISE EXCEPTION '9959: % visita(s) con médico no listado y % presencial(es) sin distancia: el CHECK de la 0850 no las admite (también las anuladas); resolverlas antes', n_no_listado, n_sin_dist;
    END IF;
  END IF;
END;
$$;

-- 1. La función y el CHECK de la 0850 (texto literal)
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
  v_exec_p       uuid;            -- 0850: el que manda la API (opcional; si viene, debe ser el de la persona)
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
  v_persona      jsonb;           -- 0850: persona_de_campo(p_user)
  v_mis_lineas   uuid[];          -- 0850: persona_lineas(p_user)
  v_exec         uuid;            -- 0850: el Ejecutivo Comercial de la visita (NULL = como líder)
  v_e_nombre     text;
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
  v_agenda       uuid;
  v_cita         record;
  v_agendada     boolean := false;
  v_relevo       uuid;
BEGIN
  IF p IS NULL OR jsonb_typeof(p) <> 'object' THEN
    RAISE EXCEPTION 'Faltan los datos de la visita' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF p_user IS NULL THEN
    RAISE EXCEPTION 'Falta el usuario que reporta' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- 0. Forma (la API ya validó con zod; aquí se revisa otra vez para que la base no dependa de la API)
  BEGIN
    v_client      := nullif(btrim(p ->> 'client_id'), '')::uuid;
    v_exec_p      := nullif(btrim(p ->> 'executive_id'), '')::uuid;
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

  -- 1. Candado por persona e idempotencia por client_id (0850: por user_id)
  PERFORM pg_advisory_xact_lock(hashtext('visitas_app:' || p_user::text));
  SELECT v.id, v.user_id, v.out_of_territory, v.distance_m, v.visit_date, v.agenda_id, v.agendada
  INTO v_previa
  FROM public.visits v
  WHERE v.client_id = v_client;
  IF FOUND THEN
    IF v_previa.user_id IS DISTINCT FROM p_user THEN
      RAISE EXCEPTION 'Ese client_id ya se usó en otra visita' USING ERRCODE = 'unique_violation';
    END IF;
    RETURN jsonb_build_object('visita_id', v_previa.id, 'repetida', true,
                              'out_of_territory', v_previa.out_of_territory,
                              'distance_m', v_previa.distance_m, 'visit_date', v_previa.visit_date,
                              'agenda_id', v_previa.agenda_id, 'agendada', v_previa.agendada);
  END IF;

  -- 2. Persona de campo (0850): la directora, sin líneas o Ejecutivo Comercial sin zona → 23514. Las líneas, todas
  --    suyas. El Ejecutivo Comercial de la visita: el suyo si alguna línea es suya como Ejecutivo Comercial; si no, la
  --    visita es "como líder" (sin zona; kam_name = su nombre). Mismo día (Bogotá) y horas coherentes.
  v_persona := public.persona_de_campo(p_user);
  IF v_exec_p IS NOT NULL AND v_exec_p IS DISTINCT FROM (v_persona ->> 'executive_id')::uuid THEN
    RAISE EXCEPTION 'Ese Ejecutivo Comercial no es el tuyo' USING ERRCODE = 'check_violation';
  END IF;
  IF cardinality(v_lineas) = 0 THEN
    RAISE EXCEPTION 'Elige al menos una línea' USING ERRCODE = 'check_violation';
  END IF;
  v_mis_lineas := public.persona_lineas(p_user);
  IF EXISTS (SELECT 1 FROM unnest(v_lineas) AS l(id) WHERE l.id <> ALL (v_mis_lineas)) THEN
    RAISE EXCEPTION 'Alguna de las líneas no es tuya' USING ERRCODE = 'check_violation';
  END IF;
  v_exec := public.ejecutivo_de_la_visita(p_user, v_lineas);
  IF v_exec IS NOT NULL THEN
    SELECT e.full_name, e.base_kam_id INTO v_e_nombre, v_e_zona
    FROM public.executives e
    WHERE e.id = v_exec;
    IF v_e_zona IS NULL THEN
      RAISE EXCEPTION 'Tu Ejecutivo Comercial no tiene zona base' USING ERRCODE = 'check_violation';
    END IF;
  ELSE
    v_e_nombre := v_persona ->> 'nombre';
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

  -- 3. Perfil vigente en la fecha (como líder: la configuración general, sin telefónica)
  v_cfg := public.visitas_config_persona(v_exec, v_fecha);
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
    IF v_exec IS NULL THEN
      -- Como líder (C9): solo médicos de las líneas de la visita; nunca fuera de territorio.
      IF NOT public.medico_de_lineas(v_medico, v_lineas, v_fecha) THEN
        RAISE EXCEPTION 'Ese médico no es de tus líneas' USING ERRCODE = 'check_violation';
      END IF;
    ELSE
      v_oot := NOT EXISTS (SELECT 1 FROM public.medico_visitantes mv
                           WHERE mv.medico_id = v_medico AND mv.executive_id = v_exec
                             AND mv.desde <= v_fecha AND (mv.hasta IS NULL OR mv.hasta >= v_fecha));
    END IF;
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

  -- 5. Presencial (radio con Haversine contra la sede) o telefónica (habilitada, medio, tope del día por persona)
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
    WHERE v.source = 'app' AND v.user_id = p_user AND v.visit_date = v_fecha
      AND v.modalidad = 'telefonica' AND v.efectiva AND v.deleted_at IS NULL;
    IF v_n >= v_tope THEN
      RAISE EXCEPTION '%', CASE WHEN v_tope = 1 THEN 'Ya reportaste tu visita telefónica de hoy'
                                ELSE format('Ya reportaste las %s visitas telefónicas de hoy', v_tope) END
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  -- 6. Tope por médico, por persona (solo si suma: efectiva; presencial y telefónica cuentan igual)
  IF v_tipo = 'medica' AND v_efectiva THEN
    SELECT count(*) INTO v_n
    FROM public.visits v
    WHERE v.source = 'app' AND v.user_id = p_user AND v.visit_date = v_fecha
      AND v.medico_id = v_medico AND v.efectiva AND v.deleted_at IS NULL;
    IF v_n >= (v_cfg ->> 'tope_visitas_medico_dia')::integer THEN
      RAISE EXCEPTION 'Ya reportaste una visita a este médico hoy' USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  -- 7b. Agenda (0840, decisiones 6 y 7; 0850: por persona y con el mismo papel): la cita que trae la visita o, si no
  --     trae, la pendiente suya de ese día, del mismo papel (C12) y del mismo tipo con el mismo médico (institucional:
  --     la misma cuenta, prefiriendo el mismo subtipo; entre varias, la de hora más temprana —sin hora al final—, la
  --     creada primero y por id). La no efectiva también cumple la cita; una EFECTIVA suya posterior de ese día la toma
  --     (relevo). agendada = la cita se creó ANTES del día de la visita en Bogotá.
  IF v_agenda IS NOT NULL THEN
    SELECT a.id, a.user_id, a.executive_id, a.fecha, a.tipo, a.medico_id, a.cuenta_id, a.estado, a.created_at, a.visita_id
    INTO v_cita
    FROM public.visitas_agenda a
    WHERE a.id = v_agenda
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Esa cita no existe o no es tuya' USING ERRCODE = 'check_violation';
    END IF;
    IF v_cita.user_id IS DISTINCT FROM p_user OR v_cita.estado = 'eliminada' THEN
      RAISE EXCEPTION 'Esa cita no existe o no es tuya' USING ERRCODE = 'check_violation';
    END IF;
    IF v_cita.estado = 'cancelada' THEN
      RAISE EXCEPTION 'Esa cita está cancelada' USING ERRCODE = 'check_violation';
    END IF;
    IF v_cita.estado = 'no_realizada' THEN
      RAISE EXCEPTION 'Esa cita ya está cerrada' USING ERRCODE = 'check_violation';
    END IF;
    IF v_cita.estado = 'hecha' THEN
      -- Relevo: solo una efectiva toma la cita, y solo si la cumplió una no efectiva suya no anulada.
      IF NOT v_efectiva OR NOT EXISTS (SELECT 1 FROM public.visits v
                                       WHERE v.id = v_cita.visita_id AND v.source = 'app' AND v.user_id = p_user
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
    IF v_cita.executive_id IS DISTINCT FROM v_exec THEN
      RAISE EXCEPTION 'Esa cita es de tu otro papel (como líder o como Ejecutivo Comercial)' USING ERRCODE = 'check_violation';
    END IF;
    v_agendada := (v_cita.created_at AT TIME ZONE 'America/Bogota')::date < v_fecha;
  ELSE
    SELECT a.id, a.created_at, a.estado, a.visita_id
    INTO v_cita
    FROM public.visitas_agenda a
    WHERE a.user_id = p_user AND a.executive_id IS NOT DISTINCT FROM v_exec AND a.fecha = v_fecha AND a.tipo = v_tipo
      AND CASE WHEN v_tipo = 'medica' THEN a.medico_id = v_medico ELSE a.cuenta_id = v_cuenta END
      AND (a.estado = 'pendiente'
           OR (v_efectiva AND a.estado = 'hecha'
               AND EXISTS (SELECT 1 FROM public.visits v
                           WHERE v.id = a.visita_id AND v.source = 'app' AND v.user_id = p_user
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
  --    teléfono (v_lat ya es NULL en una telefónica). Como líder no hay telefónica (configuración general).
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
    IF v_lat_mapa IS NULL AND v_e_zona IS NOT NULL THEN
      SELECT round(k.lat, 6), round(k.lng, 6) INTO v_lat_mapa, v_lng_mapa FROM public.kams k WHERE k.id = v_e_zona;
    END IF;
  END IF;

  -- En un relevo la no efectiva suelta la cita antes (una cita la cumple a lo sumo una visita no anulada).
  IF v_relevo IS NOT NULL THEN
    UPDATE public.visits SET agenda_id = NULL, agendada = false WHERE id = v_relevo;
  END IF;

  INSERT INTO public.visits (
    kam_id, kam_name, visit_type, contact_type, lat, lng, visit_date, hospital_id,
    imported_by, imported_at, import_id,
    source, user_id, executive_id, client_id, tipo, subtipo_id, subtipo_codigo, medico_id, cuenta_id, sede_id, contacto_id,
    modalidad, medio, efectiva, failure_reason, retry_date, checked_in_at, reported_at, distance_m, gps_accuracy_m,
    conclusion, compromisos, next_step_date, transcript, input_mode, out_of_territory, created_by, updated_by,
    agenda_id, agendada)
  VALUES (
    v_e_zona, left(v_e_nombre, 255),
    CASE WHEN v_efectiva THEN 'Visita efectiva' ELSE 'Visita no efectiva' END,
    CASE WHEN v_modalidad = 'presencial' THEN 'Visita presencial' ELSE 'Visita virtual' END,
    v_lat_mapa, v_lng_mapa, v_fecha, v_s_hospital,
    NULL, NULL, NULL,
    'app', p_user, v_exec, v_client, v_tipo, v_subtipo, v_subtipo_cod, v_medico, v_cuenta, v_sede, v_contacto,
    v_modalidad, v_medio, v_efectiva, v_failure, v_retry, v_checked, v_reported, v_dist, v_precision,
    v_conclusion, v_compromisos, v_next, v_transcript, v_input, v_oot, p_user, p_user,
    v_agenda, v_agendada)
  RETURNING id INTO v_id;

  INSERT INTO public.visit_lines (visit_id, line_id)
  SELECT v_id, l.id FROM unnest(v_lineas) AS l(id);

  IF v_agenda IS NOT NULL THEN
    UPDATE public.visitas_agenda SET estado = 'hecha', visita_id = v_id WHERE id = v_agenda;
  END IF;

  RETURN jsonb_build_object('visita_id', v_id, 'repetida', false, 'out_of_territory', v_oot,
                            'distance_m', v_dist, 'visit_date', v_fecha,
                            'agenda_id', v_agenda, 'agendada', v_agendada);
END;
$$;

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
        user_id IS NOT NULL AND client_id IS NOT NULL AND tipo IS NOT NULL AND sede_id IS NOT NULL
        AND modalidad IS NOT NULL AND efectiva IS NOT NULL AND checked_in_at IS NOT NULL AND reported_at IS NOT NULL
        AND input_mode IS NOT NULL
        AND (executive_id IS NULL) = (kam_id IS NULL)
        AND (executive_id IS NOT NULL OR NOT out_of_territory)
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

REVOKE ALL ON FUNCTION public.visitas_registrar(jsonb, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.visitas_registrar(jsonb, uuid) TO service_role;

-- 2. Columnas de la 0940
DROP INDEX IF EXISTS public.visits_marcas_idx;
ALTER TABLE public.visits
  DROP COLUMN IF EXISTS tz,
  DROP COLUMN IF EXISTS gps_at,
  DROP COLUMN IF EXISTS marcas,
  DROP COLUMN IF EXISTS en_sitio,
  DROP COLUMN IF EXISTS foto_path,
  DROP COLUMN IF EXISTS medico_no_listado,
  DROP COLUMN IF EXISTS motivo_codigo;

-- 3. La lista de motivos y la función de la foto
DROP TABLE IF EXISTS public.motivos_no_efectiva;
DROP FUNCTION IF EXISTS public.visitas_foto(uuid, uuid, text);

-- 4. Radio a 500 m desde hoy (solo si la vigente es la de la 0940)
DO $$
DECLARE
  v_hoy    constant date := (now() AT TIME ZONE 'America/Bogota')::date;
  v_actual jsonb;
BEGIN
  SELECT g.valor INTO v_actual
  FROM public.config_general g
  WHERE g.parametro = 'radio_presencial_m' AND g.anulado_at IS NULL
    AND g.vigente_desde <= v_hoy AND (g.vigente_hasta IS NULL OR g.vigente_hasta >= v_hoy)
  ORDER BY g.vigente_desde DESC
  LIMIT 1;
  IF v_actual = '300'::jsonb THEN
    PERFORM public.config_registrar('config_general', jsonb_build_object('parametro', 'radio_presencial_m', 'valor', 500), v_hoy, NULL,
                                    'Rollback 9959: vuelve el radio de 500 m de la 0810', NULL);
  END IF;
END;
$$;

COMMENT ON FUNCTION public.visitas_registrar(jsonb, uuid) IS
  'Registra una visita de la app de la persona de p_user (0850): idempotente por client_id; líneas suyas; Ejecutivo Comercial de la visita según sus líneas (sin él, como líder: sin zona, configuración general y médico de sus líneas); mismo día, perfil, sede, radio, telefónica y topes por persona; vincula la cita del mismo papel. Devuelve { visita_id, repetida, out_of_territory, distance_m, visit_date, agenda_id, agendada }.';

COMMIT;

NOTIFY pgrst, 'reload schema';
