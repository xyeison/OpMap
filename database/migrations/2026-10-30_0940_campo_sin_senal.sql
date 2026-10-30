-- =====================================================================================
-- OpMap · feat/campo-sin-senal (la app de campo sin señal) · 0940 — Marcas en vez de rechazos, motivos de lista,
--   médico no listado, foto y hora del teléfono
-- Proyecto: norvxqgohddgsdkggqzq · Generado: 2026-10-30 · NO EJECUTADA TODAVÍA (se aplica solo con autorización del dueño,
--   en la misma ventana que el despliegue del código de la rama).
--
-- Spec: docs/specs/2026-10-30-campo-sin-senal-pwa.md. Decisión del dueño (2026-10-30):
--   docs/decisiones/2026-10-30-campo-sin-senal-marcas-en-vez-de-rechazos.md ("No bloquees a nadie por sospechas, solo
--   deja las marcas").
--
-- Qué hace (ADITIVA: columnas, una tabla, un bucket y una vigencia de configuración nuevas; ninguna fila existente cambia):
--   1. visits: tz (zona horaria del teléfono), gps_at (hora de la lectura del GPS), marcas text[] (en_sitio, lejos_de_ips,
--      sin_ubicacion, precision_baja, ips_sin_coordenadas, hora_inconsistente, medico_por_validar), en_sitio boolean,
--      foto_path (ruta en el bucket visitas-fotos), medico_no_listado jsonb {nombre, especialidad} y motivo_codigo.
--      created_at ya es la hora en que la visita llegó al servidor; reported_at y checked_in_at son las del teléfono.
--   2. visits_app_check: la médica va con medico_id O con medico_no_listado (exactamente uno); la presencial puede ir sin
--      distance_m (sin ubicación o sede sin coordenadas); las marcas son de la lista; lo demás igual que en la 0850.
--   3. public.motivos_no_efectiva: lista cerrada de motivos de la visita no efectiva (codigo, nombre, orden, activo) con
--      sus filas iniciales. Se administra en la base (no hay pantalla todavía). RLS sin políticas; solo service_role.
--   4. visitas_registrar (la de la 0850 con cambios puntuales, generada por web/scripts no: por el script de la rama,
--      scratch gen_0940.py, a partir del texto de la 0850): YA NO rechaza por otro día, por el radio, por falta de GPS ni
--      por sede sin coordenadas: deja las marcas. en_sitio = (distancia − precisión) ≤ radio vigente. Sigue rechazando
--      perfil, topes, telefónica no habilitada, líneas ajenas, médico que no atiende en la sede, reporte anterior a la
--      llegada y textos largos. Lee tz, gps_at, motivo_codigo (debe existir y estar activo; sin texto, pone el nombre) y
--      medico_no_listado. Devuelve además marcas y en_sitio (también en la repetida). Único rechazo nuevo por ubicación:
--      sin GPS y con una sede sin coordenadas ni municipio ubicado no hay punto para el mapa (visits.lat/lng NOT NULL).
--   5. Bucket privado 'visitas-fotos' (JPEG, 2 MB por archivo). Sin políticas de storage: solo service_role sube y firma.
--   6. radio_presencial_m pasa a 300 m desde hoy con config_registrar (set_by NULL = migración). Deja de ser un radio de
--      rechazo: es el radio de "en sitio".
--   7. Comentarios en el catálogo y bloque DO final que comprueba columnas, CHECK, tabla, función y bucket.
--
-- Requiere: 0830, 0840 y 0850 aplicadas (visits.user_id, visitas_agenda, persona_de_campo), 0810 (config_registrar).
-- Transaccional: todo o nada. Re-ejecutable: sí (IF NOT EXISTS / ON CONFLICT / DROP CONSTRAINT IF EXISTS; la vigencia de
--   300 m solo se registra si la vigente hoy no es ya 300).
-- Tras aplicar: NOTIFY pgrst, 'reload schema';
-- Rollback: 2026-10-30_9959_campo_sin_senal_rollback.sql. Costo Google: 0. No recalcula nada.
-- =====================================================================================

BEGIN;

-- -------------------------------------------------------------------------------------
-- 0. Precondiciones
-- -------------------------------------------------------------------------------------

DO $$
BEGIN
  IF to_regclass('public.visits') IS NULL OR to_regclass('public.visitas_agenda') IS NULL THEN
    RAISE EXCEPTION '0940: faltan visits o visitas_agenda (0830/0840)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'visits' AND column_name = 'user_id') THEN
    RAISE EXCEPTION '0940: falta visits.user_id (0850)';
  END IF;
  IF to_regprocedure('public.persona_de_campo(uuid)') IS NULL OR to_regprocedure('public.visitas_config_persona(uuid, date)') IS NULL THEN
    RAISE EXCEPTION '0940: faltan persona_de_campo o visitas_config_persona (0850)';
  END IF;
  IF to_regprocedure('public.config_registrar(text, jsonb, date, date, text, uuid)') IS NULL THEN
    RAISE EXCEPTION '0940: falta config_registrar (0810)';
  END IF;
END;
$$;

-- -------------------------------------------------------------------------------------
-- 1. visits: columnas nuevas
-- -------------------------------------------------------------------------------------

ALTER TABLE public.visits
  ADD COLUMN IF NOT EXISTS tz                text,
  ADD COLUMN IF NOT EXISTS gps_at            timestamptz,
  ADD COLUMN IF NOT EXISTS marcas            text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS en_sitio          boolean,
  ADD COLUMN IF NOT EXISTS foto_path         text,
  ADD COLUMN IF NOT EXISTS medico_no_listado jsonb,
  ADD COLUMN IF NOT EXISTS motivo_codigo     text;

CREATE INDEX IF NOT EXISTS visits_marcas_idx ON public.visits USING gin (marcas) WHERE source = 'app';

-- -------------------------------------------------------------------------------------
-- 2. Lista cerrada de motivos de la visita no efectiva
-- -------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.motivos_no_efectiva (
  codigo     text        PRIMARY KEY,
  nombre     text        NOT NULL,
  orden      integer     NOT NULL DEFAULT 0,
  activo     boolean     NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT motivos_no_efectiva_codigo_check CHECK (codigo ~ '^[a-z][a-z0-9_]{1,39}$'),
  CONSTRAINT motivos_no_efectiva_nombre_check CHECK (char_length(btrim(nombre)) BETWEEN 2 AND 80)
);

INSERT INTO public.motivos_no_efectiva (codigo, nombre, orden) VALUES
  ('medico_no_estaba',   'El médico no estaba',               10),
  ('sin_tiempo_medico',  'El médico no tuvo tiempo',          20),
  ('cita_cancelada',     'Cancelaron la cita',                30),
  ('en_cirugia',         'Estaba en cirugía',                 40),
  ('no_recibio',         'No recibió visitadores',            50),
  ('sede_cerrada',       'La sede estaba cerrada',            60),
  ('acceso_restringido', 'No dejaron entrar (acceso restringido)', 70),
  ('otro',               'Otro',                              99)
ON CONFLICT (codigo) DO NOTHING;

ALTER TABLE public.motivos_no_efectiva ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.motivos_no_efectiva FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.motivos_no_efectiva TO service_role;

-- -------------------------------------------------------------------------------------
-- 3. visits_app_check (la 0850 con los cambios de la 0940)
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
        user_id IS NOT NULL AND client_id IS NOT NULL AND tipo IS NOT NULL AND sede_id IS NOT NULL
        AND modalidad IS NOT NULL AND efectiva IS NOT NULL AND checked_in_at IS NOT NULL AND reported_at IS NOT NULL
        AND input_mode IS NOT NULL
        AND (executive_id IS NULL) = (kam_id IS NULL)
        AND (executive_id IS NOT NULL OR NOT out_of_territory)
        AND reported_at >= checked_in_at
        AND visit_date = (checked_in_at AT TIME ZONE 'America/Bogota')::date
        AND (next_step_date IS NULL OR next_step_date >= visit_date)
        AND (retry_date IS NULL OR retry_date >= visit_date)
        -- 0940: médica con el médico de OpMap O con el médico no listado (exactamente uno)
        AND CASE WHEN tipo = 'medica'
                 THEN (medico_id IS NOT NULL) <> (medico_no_listado IS NOT NULL)
                      AND subtipo_id IS NULL AND subtipo_codigo IS NULL AND contacto_id IS NULL
                 ELSE cuenta_id IS NOT NULL AND subtipo_id IS NOT NULL AND subtipo_codigo IS NOT NULL
                      AND medico_id IS NULL AND medico_no_listado IS NULL
            END
        -- 0940: la presencial puede ir sin distancia (sin ubicación o sede sin coordenadas); en_sitio solo con distancia
        AND CASE WHEN modalidad = 'presencial'
                 THEN medio IS NULL AND contact_type = 'Visita presencial'
                 ELSE medio IS NOT NULL AND contact_type = 'Visita virtual'
            END
        AND CASE WHEN efectiva
                 THEN failure_reason IS NULL AND retry_date IS NULL AND visit_type = 'Visita efectiva'
                 ELSE failure_reason IS NOT NULL AND visit_type = 'Visita no efectiva'
            END
      ))
  -- 0940: marcas de la lista cerrada; en_sitio solo con distancia; médico no listado con nombre; motivo solo en no efectiva
  AND marcas <@ ARRAY['en_sitio', 'lejos_de_ips', 'sin_ubicacion', 'precision_baja', 'ips_sin_coordenadas', 'hora_inconsistente', 'medico_por_validar']::text[]
  AND (en_sitio IS NULL OR distance_m IS NOT NULL)
  AND (medico_no_listado IS NULL OR (jsonb_typeof(medico_no_listado) = 'object' AND coalesce(medico_no_listado ->> 'nombre', '') <> ''))
  AND (motivo_codigo IS NULL OR efectiva IS FALSE)
  AND (foto_path IS NULL OR char_length(foto_path) BETWEEN 1 AND 300)
);

-- -------------------------------------------------------------------------------------
-- 4. visitas_registrar (texto de la 0850 con los cambios puntuales de la 0940)
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
  -- 0940 (app sin señal): hora del teléfono, lectura del GPS, motivo de lista, médico no listado y las marcas
  c_precision_baja constant integer := 100;   -- PRECISION_BAJA_M de la web
  c_dias_max       constant integer := 7;     -- DIAS_MAX_ATRAS de la web
  v_tz           text;
  v_gps_at       timestamptz;
  v_motivo_cod   text;
  v_no_listado   jsonb;
  v_marcas       text[] := '{}';
  v_en_sitio     boolean;
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
    v_tz          := left(nullif(btrim(p ->> 'tz'), ''), 64);
    v_gps_at      := nullif(btrim(p ->> 'gps_at'), '')::timestamptz;
    v_motivo_cod  := nullif(btrim(p ->> 'motivo_codigo'), '');
    v_no_listado  := CASE WHEN jsonb_typeof(p -> 'medico_no_listado') = 'object' THEN p -> 'medico_no_listado' END;
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
  -- 0940: médica con el médico de OpMap o con "médico no listado" (nombre y especialidad), nunca los dos ni ninguno.
  IF v_no_listado IS NOT NULL THEN
    v_no_listado := jsonb_build_object('nombre', left(btrim(coalesce(v_no_listado ->> 'nombre', '')), 200),
                                       'especialidad', nullif(left(btrim(coalesce(v_no_listado ->> 'especialidad', '')), 60), ''));
    IF coalesce(v_no_listado ->> 'nombre', '') = '' THEN
      RAISE EXCEPTION 'Escribe el nombre del médico no listado' USING ERRCODE = 'invalid_parameter_value';
    END IF;
  END IF;
  IF v_tipo = 'medica' AND v_medico IS NULL AND v_no_listado IS NULL THEN
    RAISE EXCEPTION 'Elige el médico' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF v_tipo = 'medica' AND v_medico IS NOT NULL AND v_no_listado IS NOT NULL THEN
    RAISE EXCEPTION 'Manda el médico de OpMap o el médico no listado, no los dos' USING ERRCODE = 'invalid_parameter_value';
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
    v_medico := NULL; v_no_listado := NULL;
  END IF;
  IF v_modalidad = 'presencial' THEN
    v_medio := NULL;
  ELSE
    -- Telefónica: la ubicación del teléfono no se usa ni se guarda (privacidad; el punto del mapa sale de la sede).
    v_lat := NULL; v_lng := NULL; v_precision := NULL;
  END IF;
  IF v_efectiva THEN
    v_failure := NULL; v_retry := NULL; v_motivo_cod := NULL;
  ELSE
    -- 0940: motivo de la lista cerrada (motivos_no_efectiva); sin texto, el nombre del motivo. Texto libre: respaldo.
    IF v_motivo_cod IS NOT NULL THEN
      IF NOT EXISTS (SELECT 1 FROM public.motivos_no_efectiva mo WHERE mo.codigo = v_motivo_cod AND mo.activo) THEN
        RAISE EXCEPTION 'Motivo de la visita no efectiva no válido' USING ERRCODE = 'check_violation';
      END IF;
      IF v_failure IS NULL THEN
        SELECT mo.nombre INTO v_failure FROM public.motivos_no_efectiva mo WHERE mo.codigo = v_motivo_cod;
      END IF;
    END IF;
    IF v_failure IS NULL THEN
      RAISE EXCEPTION '%', c_motivo_falla USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  -- 1. Candado por persona e idempotencia por client_id (0850: por user_id)
  PERFORM pg_advisory_xact_lock(hashtext('visitas_app:' || p_user::text));
  SELECT v.id, v.user_id, v.out_of_territory, v.distance_m, v.visit_date, v.agenda_id, v.agendada, v.marcas, v.en_sitio
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
                              'agenda_id', v_previa.agenda_id, 'agendada', v_previa.agendada,
                              'marcas', to_jsonb(coalesce(v_previa.marcas, '{}'::text[])), 'en_sitio', v_previa.en_sitio);
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
  -- 0940 (dueño, 2026-10-30): la visita de otro día se acepta (la cola sin señal puede tardar). La hora del teléfono
  -- posterior a la llegada al servidor (más de la tolerancia) o una visita de más de c_dias_max días → 'hora_inconsistente'.
  IF v_reported < v_checked THEN
    RAISE EXCEPTION 'La hora del reporte no puede ser anterior a la de llegada' USING ERRCODE = 'check_violation';
  END IF;
  IF v_checked > now() + c_tolerancia OR v_reported > now() + c_tolerancia OR v_fecha < v_hoy - c_dias_max THEN
    v_marcas := array_append(v_marcas, 'hora_inconsistente');
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

  IF v_tipo = 'medica' AND v_medico IS NULL THEN
    -- 0940: médico no listado (nombre y especialidad en la visita): nadie lo valida aquí; queda marcado.
    v_marcas := array_append(v_marcas, 'medico_por_validar');
  ELSIF v_tipo = 'medica' THEN
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
    -- 0940 (dueño, 2026-10-30): nunca se rechaza por la ubicación; se marca. en_sitio = la distancia a la sede menos la
    -- precisión del GPS cabe en el radio vigente (radio_m: 300 m por defecto desde la 0940).
    v_radio := (v_cfg ->> 'radio_m')::integer;
    IF v_lat IS NULL THEN
      v_marcas := array_append(v_marcas, 'sin_ubicacion');
    ELSIF v_precision IS NOT NULL AND v_precision > c_precision_baja THEN
      v_marcas := array_append(v_marcas, 'precision_baja');
    END IF;
    IF v_s_lat IS NULL OR v_s_lng IS NULL THEN
      v_marcas := array_append(v_marcas, 'ips_sin_coordenadas');
    ELSIF v_lat IS NOT NULL THEN
      v_dist     := public.visitas_distancia_m(v_lat, v_lng, v_s_lat::double precision, v_s_lng::double precision);
      v_en_sitio := greatest(v_dist - coalesce(v_precision, 0), 0) <= v_radio;
      IF NOT v_en_sitio THEN
        v_marcas := array_append(v_marcas, 'lejos_de_ips');
      END IF;
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
  IF v_modalidad = 'presencial' AND v_lat IS NOT NULL THEN
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
  IF v_lat_mapa IS NULL OR v_lng_mapa IS NULL THEN
    -- Único caso en que la ubicación detiene la visita: no hay ningún punto para el mapa (visits.lat/lng son NOT NULL).
    RAISE EXCEPTION 'Sin ubicación del teléfono, la sede % no tiene coordenadas ni municipio ubicado: toma la ubicación o elige otra sede', v_s_nombre
      USING ERRCODE = 'check_violation';
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
    agenda_id, agendada,
    tz, gps_at, marcas, en_sitio, medico_no_listado, motivo_codigo)
  VALUES (
    v_e_zona, left(v_e_nombre, 255),
    CASE WHEN v_efectiva THEN 'Visita efectiva' ELSE 'Visita no efectiva' END,
    CASE WHEN v_modalidad = 'presencial' THEN 'Visita presencial' ELSE 'Visita virtual' END,
    v_lat_mapa, v_lng_mapa, v_fecha, v_s_hospital,
    NULL, NULL, NULL,
    'app', p_user, v_exec, v_client, v_tipo, v_subtipo, v_subtipo_cod, v_medico, v_cuenta, v_sede, v_contacto,
    v_modalidad, v_medio, v_efectiva, v_failure, v_retry, v_checked, v_reported, v_dist, v_precision,
    v_conclusion, v_compromisos, v_next, v_transcript, v_input, v_oot, p_user, p_user,
    v_agenda, v_agendada,
    v_tz, v_gps_at, v_marcas, v_en_sitio, v_no_listado, v_motivo_cod)
  RETURNING id INTO v_id;

  INSERT INTO public.visit_lines (visit_id, line_id)
  SELECT v_id, l.id FROM unnest(v_lineas) AS l(id);

  IF v_agenda IS NOT NULL THEN
    UPDATE public.visitas_agenda SET estado = 'hecha', visita_id = v_id WHERE id = v_agenda;
  END IF;

  RETURN jsonb_build_object('visita_id', v_id, 'repetida', false, 'out_of_territory', v_oot,
                            'distance_m', v_dist, 'visit_date', v_fecha,
                            'agenda_id', v_agenda, 'agendada', v_agendada,
                            'marcas', to_jsonb(v_marcas), 'en_sitio', v_en_sitio);
END;
$$;

REVOKE ALL ON FUNCTION public.visitas_registrar(jsonb, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.visitas_registrar(jsonb, uuid) TO service_role;

-- -------------------------------------------------------------------------------------
-- 4b. visitas_foto: enlaza la foto subida al bucket con la visita (la única escritura de foto_path)
-- -------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.visitas_foto(p_client uuid, p_user uuid, p_path text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id    uuid;
  v_previa text;
BEGIN
  IF p_client IS NULL OR p_user IS NULL OR nullif(btrim(p_path), '') IS NULL OR char_length(p_path) > 300 THEN
    RAISE EXCEPTION 'Faltan la visita, el usuario o la ruta de la foto' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  SELECT v.id, v.foto_path INTO v_id, v_previa
  FROM public.visits v
  WHERE v.client_id = p_client AND v.source = 'app' AND v.user_id = p_user AND v.deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Esa visita no existe o no es tuya' USING ERRCODE = 'no_data_found';
  END IF;
  UPDATE public.visits SET foto_path = p_path, updated_by = p_user WHERE id = v_id;
  RETURN jsonb_build_object('visita_id', v_id, 'repetida', v_previa IS NOT NULL);
END;
$$;

REVOKE ALL ON FUNCTION public.visitas_foto(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.visitas_foto(uuid, uuid, text) TO service_role;
COMMENT ON FUNCTION public.visitas_foto(uuid, uuid, text) IS
  'Enlaza la foto (ruta en el bucket visitas-fotos) con la visita de la app de esa persona por client_id (0940). Idempotente: la segunda vez reemplaza y responde repetida. P0002 si la visita no existe, es ajena o está anulada.';

-- -------------------------------------------------------------------------------------
-- 5. Bucket privado para las fotos (solo service_role: sin políticas en storage.objects)
-- -------------------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('visitas-fotos', 'visitas-fotos', false, 2097152, ARRAY['image/jpeg'])
ON CONFLICT (id) DO NOTHING;

-- -------------------------------------------------------------------------------------
-- 6. Radio de "en sitio": 300 m desde hoy (dueño, 2026-10-30), con config_registrar (set_by NULL = migración)
-- -------------------------------------------------------------------------------------

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
  IF v_actual IS DISTINCT FROM '300'::jsonb THEN
    PERFORM public.config_registrar('config_general', jsonb_build_object('parametro', 'radio_presencial_m', 'valor', 300), v_hoy, NULL,
                                    'App sin señal (0940): el radio ya no rechaza, marca "en sitio"; 300 m (dueño, 2026-10-30)', NULL);
  END IF;
END;
$$;

-- -------------------------------------------------------------------------------------
-- 7. Documentación en el catálogo
-- -------------------------------------------------------------------------------------

COMMENT ON COLUMN public.visits.tz IS 'Zona horaria del teléfono al reportar (IANA, p. ej. America/Bogota). 0940.';
COMMENT ON COLUMN public.visits.gps_at IS 'Hora de la lectura del GPS con que se guardó lat/lng (la del teléfono). 0940.';
COMMENT ON COLUMN public.visits.marcas IS 'Marcas del servidor (0940): en_sitio, lejos_de_ips, sin_ubicacion, precision_baja (>100 m), ips_sin_coordenadas, hora_inconsistente (hora del teléfono posterior a la llegada o más de 7 días), medico_por_validar. Alimentan el tablero y el mapa de calor; nunca bloquean.';
COMMENT ON COLUMN public.visits.en_sitio IS '(distancia a la sede − precisión del GPS) ≤ radio_presencial_m vigente (300 m desde la 0940). NULL sin distancia.';
COMMENT ON COLUMN public.visits.foto_path IS 'Ruta en el bucket privado visitas-fotos (<user_id>/<client_id>.jpg); la sube POST /api/me/visitas/foto después de la visita.';
COMMENT ON COLUMN public.visits.medico_no_listado IS 'Médica a un médico que no está en OpMap: {nombre, especialidad}; medico_id NULL y marca medico_por_validar. Quien tiene terceros:create lo crea o lo cruza después.';
COMMENT ON COLUMN public.visits.motivo_codigo IS 'Motivo de la visita no efectiva (motivos_no_efectiva.codigo). failure_reason conserva el texto.';
COMMENT ON TABLE public.motivos_no_efectiva IS 'Lista cerrada de motivos de la visita no efectiva (0940). La app los descarga con el contexto y los guarda sin señal. Se administra en la base.';
COMMENT ON FUNCTION public.visitas_registrar(jsonb, uuid) IS
  'Registra una visita de la app de la persona de p_user (0850 + 0940): idempotente por client_id; líneas suyas; Ejecutivo Comercial según sus líneas (sin él, como líder); perfil, telefónica y topes por persona siguen rechazando. Desde la 0940 NO rechaza por otro día, radio, falta de GPS ni sede sin coordenadas: deja marcas (en_sitio, lejos_de_ips, sin_ubicacion, precision_baja, ips_sin_coordenadas, hora_inconsistente, medico_por_validar). Acepta medico_no_listado {nombre, especialidad}, motivo_codigo de motivos_no_efectiva, tz y gps_at. Devuelve { visita_id, repetida, out_of_territory, distance_m, visit_date, agenda_id, agendada, marcas, en_sitio }.';

-- -------------------------------------------------------------------------------------
-- 8. Comprobaciones (aborta si algo no quedó)
-- -------------------------------------------------------------------------------------

DO $$
DECLARE
  v_col text;
  v_def text;
BEGIN
  FOREACH v_col IN ARRAY ARRAY['tz', 'gps_at', 'marcas', 'en_sitio', 'foto_path', 'medico_no_listado', 'motivo_codigo'] LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'visits' AND column_name = v_col) THEN
      RAISE EXCEPTION '0940: falta visits.%', v_col;
    END IF;
  END LOOP;
  SELECT pg_get_constraintdef(c.oid) INTO v_def FROM pg_constraint c WHERE c.conrelid = 'public.visits'::regclass AND c.conname = 'visits_app_check';
  IF v_def IS NULL OR v_def NOT LIKE '%medico_no_listado%' OR v_def NOT LIKE '%marcas%' THEN
    RAISE EXCEPTION '0940: visits_app_check no quedó con medico_no_listado y marcas';
  END IF;
  IF (SELECT count(*) FROM public.motivos_no_efectiva WHERE activo) < 2 THEN
    RAISE EXCEPTION '0940: motivos_no_efectiva sin filas';
  END IF;
  SELECT pg_get_functiondef('public.visitas_registrar(jsonb, uuid)'::regprocedure) INTO v_def;
  IF v_def NOT LIKE '%hora_inconsistente%' OR v_def NOT LIKE '%lejos_de_ips%' OR v_def LIKE '%Solo se reportan visitas del mismo día%' THEN
    RAISE EXCEPTION '0940: visitas_registrar no es la de la 0940';
  END IF;
  IF to_regprocedure('public.visitas_foto(uuid, uuid, text)') IS NULL THEN
    RAISE EXCEPTION '0940: falta visitas_foto';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'visitas-fotos' AND public = false) THEN
    RAISE EXCEPTION '0940: el bucket visitas-fotos no existe o es público';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.config_general g WHERE g.parametro = 'radio_presencial_m' AND g.anulado_at IS NULL AND g.valor = '300'::jsonb
                 AND g.vigente_desde <= (now() AT TIME ZONE 'America/Bogota')::date AND (g.vigente_hasta IS NULL OR g.vigente_hasta >= (now() AT TIME ZONE 'America/Bogota')::date)) THEN
    RAISE EXCEPTION '0940: radio_presencial_m no quedó en 300 m';
  END IF;
  -- La función acepta el jsonb nuevo: una visita de forma inválida (sin client_id) sigue respondiendo 22023.
  BEGIN
    PERFORM public.visitas_registrar('{"tipo":"medica"}'::jsonb, gen_random_uuid());
    RAISE EXCEPTION '0940: visitas_registrar sin client_id debía fallar';
  EXCEPTION
    WHEN invalid_parameter_value THEN NULL;
  END;
  -- `text[] || 'literal'` lee el literal como un arreglo y falla (22P02 malformed array literal): las marcas van con array_append.
  IF pg_get_functiondef('public.visitas_registrar(jsonb, uuid)'::regprocedure) ~ 'v_marcas \|\|' THEN
    RAISE EXCEPTION '0940: visitas_registrar concatena marcas con || (22P02): usar array_append';
  END IF;
  IF array_append('{}'::text[], 'lejos_de_ips') <> ARRAY['lejos_de_ips']::text[] THEN
    RAISE EXCEPTION '0940: array_append no dejó la marca';
  END IF;
  RAISE NOTICE '0940 OK: visits con marcas, motivos_no_efectiva (% filas), visitas_registrar 0940, bucket visitas-fotos, radio 300 m',
    (SELECT count(*) FROM public.motivos_no_efectiva);
END;
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';
