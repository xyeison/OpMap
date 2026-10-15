-- =====================================================================================
-- OpMap · feat/visitas-agenda-dictado-marca (app de visita · F4.1: agenda de visitas) · 0840
-- Proyecto: norvxqgohddgsdkggqzq · Generado: 2026-10-14 · ESTADO: NO APLICADA
--
-- Contrato (fuente de verdad de nombres): docs/fases/fase8-visitas-f3-f4-reporte-y-app-movil.md, sección "F4.1 Agenda,
--   dictado por campo y marca". Spec: docs/specs/2026-10-14-agenda-dictado-y-marca.md (decisiones 1 a 8). Decisión del
--   dueño: docs/decisiones/2026-10-14-agenda-de-visitas.md.
--   Es ADITIVA: 1 tabla nueva (visitas_agenda), 2 columnas nuevas en visits (agenda_id NULL y agendada con valor por
--   defecto false), 2 funciones nuevas (agenda_crear y agenda_cancelar) y 2 reemplazadas (visitas_registrar y
--   visitas_anular: copia EXACTA de la 0830 más el vínculo con la agenda). No cambia ninguna fila existente: las 7.033
--   visitas importadas de VMO quedan con agenda_id NULL y agendada false (conteo y huellas antes y después).
--
-- Por qué:
--   El dueño (2026-10-14): "tengo un agendamiento y tengo que elegir el médico con el cual hablé… si no está en la
--   agenda, puede ser una visita extra… visitas agendadas, visitas no agendadas, y eso es un indicador". Cada Ejecutivo
--   Comercial planea sus visitas por día (hora opcional) y, al reportar, la visita se vincula a su cita. Lo que no puede
--   depender del teléfono (ventana de fechas, días libres, perfil, médico en la sede, duplicados, el vínculo y cuándo
--   cuenta como "agendada") se decide aquí, en una transacción por cita o por visita, con el mismo candado por persona
--   que ya usan las visitas (pg_advisory_xact_lock de 'visitas_app:' || executive_id).
--
-- Qué hace:
--   1. visitas_agenda (una fila por cita; decisión 1): id, executive_id, fecha, hora (time, NULL = sin hora), tipo
--      (medica | institucional), medico_id (médica), cuenta_id y subtipo_id (institucional), sede_id (NOT NULL), nota
--      (≤ 300), estado (pendiente | hecha | cancelada), visita_id (la visita que la cumplió), cancelada_at,
--      cancelada_motivo (≤ 300), created_by, created_at, updated_at.
--      CHECK por tipo (médica: médico y nada de cuenta ni subtipo; institucional: cuenta y subtipo, sin médico) y por
--      estado (pendiente: sin visita ni cancelación; hecha: con visita; cancelada: con cancelada_at y sin visita).
--      Índices únicos parciales contra duplicados (decisión 4): una cita no cancelada por persona, fecha y médico
--      (visitas_agenda_medico_uidx) y, en las institucionales, por persona, fecha, cuenta y subtipo
--      (visitas_agenda_cuenta_uidx); una visita cumple a lo sumo una cita (visitas_agenda_visita_uidx); y
--      visitas_agenda_executive_fecha_idx (executive_id, fecha) para la agenda del día.
--      Disparadores: update_visitas_agenda_updated_at y visitas_agenda_sin_borrar (una cita no se borra: se cancela;
--      con public.visitas_sin_borrar() de la 0810). RLS activado SIN políticas; nada para PUBLIC/anon/authenticated;
--      service_role SELECT, INSERT y UPDATE (sin DELETE ni TRUNCATE).
--   2. visits: agenda_id uuid NULL → visitas_agenda (índice único parcial visits_agenda_id_uidx: una cita la cumple a
--      lo sumo UNA visita no anulada; la anulada conserva su agenda_id como rastro) y agendada boolean NOT NULL DEFAULT
--      false, con CHECK visits_agenda_check (agendada ⇒ agenda_id; agenda_id solo en las de la app).
--   3. agenda_crear(p jsonb, p_user uuid) → jsonb { cita_id }. p = { fecha, hora?, tipo, medico_id?, cuenta_id?,
--      subtipo_id?, sede_id, nota? }. La persona sale de p_user (executives.user_id, como visitas_anular):
--        0. Forma (22023): fecha y hora legibles (hora de 00:00 a 23:59), tipo de la lista, sede, médico (médica) o
--           cuenta y subtipo (institucional), nota ≤ 300. Lo que no aplica al tipo se descarta.
--        1. Persona activa ("Tu usuario no está enlazado con un Ejecutivo Comercial") con zona base ("Tu Ejecutivo
--           Comercial no tiene zona base"); candado por persona.
--        2. Ventana (decisión 3): de hoy a hoy + 30 en Bogotá ("No se agenda en el pasado: elige hoy o una fecha
--           posterior" / "Solo se agenda hasta 30 días adelante"); no en un día libre aprobado de día completo
--           (dias_libres en registrado o aprobado —lo que la cuota cuenta como libre— y fraccion 1: "Ese día lo tienes
--           libre (día libre aprobado): no se agenda"); medio día no bloquea; los festivos se permiten.
--        3. Perfil vigente EN LA FECHA de la cita (visitas_config_vigente) que incluya el tipo.
--        4. Sede activa ("Esa sede no existe") de una cuenta activa ("La cuenta de esa sede está inactiva"). Médica:
--           médico activo ("Ese médico no existe o está inactivo") que atiende en esa sede ("El médico no atiende en
--           esa sede"). Institucional: la sede es de la cuenta ("Esa sede no es de la cuenta elegida") y el subtipo
--           está vigente en la fecha ("Ese subtipo no está vigente").
--        5. Duplicado (23505): "Ya tienes una cita con ese médico ese día" / "Ya tienes una cita con esa cuenta y ese
--           subtipo ese día" (y los índices únicos como última barrera).
--   4. agenda_cancelar(p_id uuid, p_motivo text, p_user uuid): la persona de p_user cancela SU cita pendiente de hoy o
--      futura (motivo opcional ≤ 300). Inexistente o ajena → P0002 "Esa cita no existe"; ya cancelada → 23514 "Esa
--      cita ya está cancelada"; hecha → 23514 "Esa cita ya tiene su visita: no se cancela"; de ayer o antes → 23514
--      "Solo se cancelan las citas de hoy en adelante". La fila no se borra.
--   5. visitas_registrar (reemplazo): el cuerpo de la 0830 tal cual, más:
--        - agenda_id opcional en p (forma 22023 si no es uuid);
--        - paso 7b (después de las líneas, así los rechazos de la 0830 salen igual y en el mismo orden): con agenda_id,
--          la cita debe ser de ella ("Esa cita no existe o no es tuya"), no cancelada ("Esa cita está cancelada"), no
--          hecha ("Esa cita ya tiene su visita"), del mismo día ("Esa cita es de otro día"), del mismo tipo ("Esa cita
--          es de otro tipo de visita") y con el mismo médico ("Esa cita es con otro médico") o la misma cuenta ("Esa
--          cita es con otra cuenta"; el subtipo puede cambiar), todo 23514. Sin agenda_id, vínculo automático
--          (decisión 7): la cita pendiente suya de ese día y del mismo tipo con el mismo médico, o con la misma cuenta
--          prefiriendo el mismo subtipo; entre varias, la de hora más temprana (sin hora al final), la creada primero
--          y por id. La visita no efectiva también cumple la cita, y una EFECTIVA suya posterior de ese día con el
--          mismo médico o cuenta la toma (relevo: la no efectiva queda sin cita y la efectiva planeada cuenta como
--          agendada), con agenda_id o sin él;
--        - agendada (decisión 6) = la cita se creó ANTES del día de la visita en Bogotá (la creada el mismo día vincula,
--          pero la visita cuenta como no agendada);
--        - la cita pasa a hecha con visita_id; la respuesta (también la del camino idempotente por client_id) trae
--          agenda_id y agendada.
--   6. visitas_anular (reemplazo): el cuerpo de la 0830 tal cual y, al final, la cita que cumplía pasa a otra visita
--      suya no anulada de ese día con el mismo médico o cuenta y sin cita (la efectiva primero; p. ej. la no efectiva
--      de antes de un relevo) o, si no hay, vuelve a pendiente (visita_id NULL). La visita anulada conserva agenda_id y
--      agendada como rastro (no cuenta: está anulada).
--   7. Bloque DO final con las comprobaciones y las pruebas que se deshacen (RAISE SQLSTATE 'P0840'): estructura,
--      privilegios y huellas md5 de las funciones (visitas_editar, visitas_config_vigente y visitas_distancia_m siguen
--      iguales a la 0830); con una persona activa real (si ninguna cumple el filtro, la migración ABORTA: no se aplica
--      sin probar la agenda) y médicos, sedes, cuentas, subtipos, días libres y configuración
--      de prueba, los criterios de aceptación de la spec: agendar válido, del pasado, a más de 30 días, en día libre
--      (registrado y aprobado; medio día y por aprobar sí), médico que no atiende en la sede, cuenta ajena a la sede,
--      cuenta inactiva, subtipo vencido, perfil sin el tipo, repetida; cancelar la propia pendiente, la ajena, la
--      hecha, la de ayer y dos veces; registrar con agenda_id (agendada si se creó antes; ajena, de otro día, de otro
--      médico, de otra cuenta, de otro tipo, cancelada y ya hecha rechazadas con 23514), sin agenda_id con vínculo
--      automático (y la preferencia por el subtipo), sin cita no agendada, la no efectiva también cumple, el relevo
--      (la efectiva posterior toma la cita de la no efectiva, con y sin agenda_id; otra no efectiva no), la repetida
--      por client_id devuelve el vínculo, anular pasa la cita a la otra visita del día o la devuelve a pendiente y otra
--      visita la vuelve a cumplir; CHECK
--      e índices únicos; borrado prohibido; todo de nuevo como service_role; y al final las 7.033 de VMO idénticas.
--
-- Errores para la API: 22023 forma; 23514 regla (mensaje para la persona, 400); 23505 cita repetida (409); P0002
--   cita inexistente o ajena al cancelar (404). Cualquier error deshace la cita o la visita.
--
-- Depende de: 0830 (aplicada el 2026-10-14: visits con 43 columnas, visit_lines y las 5 funciones con el md5 del
--   archivo), 0810 (dias_libres, config_personas, config_general, config_registrar, visitas_sin_borrar), 0800 (medicos,
--   medico_sedes, cuentas, sedes, subtipos_institucionales, terceros_crear_medico), executives, users y
--   public.update_updated_at_column() (existentes). Rollback: 2026-10-14_9944_visitas_agenda_rollback.sql (va ANTES
--   que 9943).
--
-- Después de aplicar (misma ventana que el despliegue de /api/me/agenda*, /api/me/voz/campos y la app):
--   NOTIFY pgrst, 'reload schema';   -- PostgREST debe ver la tabla, las columnas y las funciones nuevas
--   Costo Google: 0 (no llama a nada). No recalcula asignaciones ni cobertura.
--   Sin la 0840, la API responde 503 en las rutas de la agenda y el resto sigue como hoy (contexto con agenda_hoy [],
--   visitas sin vínculo, Mis números con agenda null).
--
-- Transaccional: todo o nada. Re-ejecutable: sí (IF NOT EXISTS, DROP CONSTRAINT IF EXISTS + ADD, CREATE OR REPLACE;
--   las precondiciones aceptan la 0840 ya aplicada).
-- =====================================================================================

BEGIN;

-- -------------------------------------------------------------------------------------
-- 0. Precondiciones y huella de las visitas importadas
-- -------------------------------------------------------------------------------------

DO $$
DECLARE
  v_tabla      text;
  v_fn         text;
  v_col        record;
  v_n          bigint;
  v_nuevas     bigint;
  v_md5        text;
  v_md5_todo   text;
  v_conocidas  constant text[] := ARRAY['id', 'kam_id', 'kam_name', 'visit_type', 'contact_type', 'lat', 'lng',
                                        'visit_date', 'hospital_id', 'imported_by', 'imported_at', 'created_at',
                                        'updated_at', 'import_id',
                                        'source', 'executive_id', 'client_id', 'tipo', 'subtipo_id', 'subtipo_codigo',
                                        'medico_id', 'cuenta_id', 'sede_id', 'contacto_id', 'modalidad', 'medio',
                                        'efectiva', 'failure_reason', 'retry_date', 'checked_in_at', 'reported_at',
                                        'distance_m', 'gps_accuracy_m', 'conclusion', 'compromisos', 'next_step_date',
                                        'transcript', 'input_mode', 'out_of_territory', 'created_by', 'updated_by',
                                        'deleted_at', 'deleted_reason',
                                        'agenda_id', 'agendada'];
BEGIN
  FOREACH v_tabla IN ARRAY ARRAY['users', 'executives', 'executive_lines', 'business_lines', 'kams', 'municipalities',
                                 'visits', 'visit_lines', 'cuentas', 'sedes', 'medicos', 'medico_sedes',
                                 'medico_visitantes', 'contactos', 'subtipos_institucionales', 'config_personas',
                                 'config_general', 'dias_libres'] LOOP
    IF to_regclass('public.' || v_tabla) IS NULL THEN
      RAISE EXCEPTION '0840 Agenda: falta la tabla previa public.% (0800, 0810 y 0830 deben estar aplicadas)', v_tabla;
    END IF;
  END LOOP;
  FOREACH v_fn IN ARRAY ARRAY['public.update_updated_at_column()', 'public.visitas_sin_borrar()',
                              'public.terceros_crear_medico(jsonb, jsonb, uuid)',
                              'public.config_registrar(text, jsonb, date, date, text, uuid)',
                              'public.visitas_registrar(jsonb, uuid)', 'public.visitas_editar(uuid, jsonb, uuid)',
                              'public.visitas_anular(uuid, text, uuid)', 'public.visitas_config_vigente(uuid, date)',
                              'public.visitas_distancia_m(double precision, double precision, double precision, double precision)'] LOOP
    IF to_regprocedure(v_fn) IS NULL THEN
      RAISE EXCEPTION '0840 Agenda: falta la función previa % (la 0830 debe estar aplicada)', v_fn;
    END IF;
  END LOOP;

  -- visits: las 43 columnas de la 0830 (más las 2 de la 0840 si ya se aplicó) y ninguna desconocida.
  SELECT count(*) INTO v_nuevas FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'visits' AND column_name IN ('agenda_id', 'agendada');
  SELECT count(*) INTO v_n FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'visits';
  IF v_n <> 43 + v_nuevas THEN
    RAISE EXCEPTION '0840: visits tiene % columnas; se esperaban 43 (las de la 0830) más las % de la 0840 ya presentes', v_n, v_nuevas;
  END IF;
  SELECT count(*) INTO v_n FROM information_schema.columns c
  WHERE c.table_schema = 'public' AND c.table_name = 'visits' AND c.column_name <> ALL (v_conocidas);
  IF v_n > 0 THEN
    RAISE EXCEPTION '0840: visits tiene % columna(s) que ni la 0830 ni la 0840 conocen; revisar antes de migrar', v_n;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.visits'::regclass AND conname = 'visits_app_check') THEN
    RAISE EXCEPTION '0840: falta visits_app_check de la 0830';
  END IF;

  -- Las funciones que se reemplazan son las de la 0830 (o ya las de la 0840 si se re-ejecuta); las demás de la 0830
  -- no cambian. md5 del cuerpo (pg_proc.prosrc), el mismo que da el cuerpo de cada CREATE FUNCTION del archivo (el
  -- texto entre sus dos comillas de dólar; aquí no se escriben: dentro de este DO cerrarían el bloque).
  FOR v_col IN
    SELECT * FROM (VALUES
      ('visitas_registrar', ARRAY['0e43cd1432a3c933b820bdf815a02566', 'eeae55de7196179daa686cc9bd11da7c']),
      ('visitas_anular', ARRAY['9f4389cca280e89af80afdebc3f57ea9', '462a121cfde8802c4a830bd3c61c05e4']),
      ('visitas_editar', ARRAY['f7948c247b88575f4695943f4c9bad45']),
      ('visitas_config_vigente', ARRAY['b5ce2f997fc50012ebc3e8d61463bc1c']),
      ('visitas_distancia_m', ARRAY['de6fd102ba79b9d0b59dc94ea9d4b60b'])
    ) AS t(nombre, huellas)
  LOOP
    SELECT md5(p.prosrc) INTO v_md5 FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace AND p.proname = v_col.nombre;
    IF v_md5 IS NULL OR v_md5 <> ALL (v_col.huellas) THEN
      RAISE EXCEPTION '0840: public.% no es la de la 0830 (md5 %); alguien la cambió: revisar antes de reemplazarla', v_col.nombre, v_md5;
    END IF;
  END LOOP;

  -- Huella de las importadas de VMO (la misma fórmula que la 0830): se compara al final del bloque DO.
  SELECT count(*),
         md5(string_agg(v.id::text || v.visit_type || v.contact_type || v.visit_date::text, ',' ORDER BY v.id)),
         md5(string_agg(ROW(v.id, v.kam_id, v.kam_name, v.visit_type, v.contact_type, v.lat, v.lng, v.visit_date,
                            v.hospital_id, v.imported_by, v.imported_at, v.created_at, v.updated_at,
                            v.import_id)::text, ',' ORDER BY v.id))
  INTO v_n, v_md5, v_md5_todo
  FROM public.visits v
  WHERE v.source = 'vmo_import';
  PERFORM set_config('opmap0840.importadas', v_n::text || '|' || coalesce(v_md5, '-') || '|' || coalesce(v_md5_todo, '-'),
                     true);
  RAISE NOTICE '0840: % visita(s) importada(s) de VMO antes de migrar (huella %)', v_n, coalesce(v_md5, '-');
END;
$$;

-- -------------------------------------------------------------------------------------
-- 1. visitas_agenda: una fila por cita (decisión 1)
-- -------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.visitas_agenda (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  executive_id     uuid        NOT NULL REFERENCES public.executives (id),
  fecha            date        NOT NULL,
  hora             time        NULL,
  tipo             text        NOT NULL,
  medico_id        uuid        NULL REFERENCES public.medicos (id),
  cuenta_id        uuid        NULL REFERENCES public.cuentas (id),
  subtipo_id       uuid        NULL REFERENCES public.subtipos_institucionales (id),
  sede_id          uuid        NOT NULL REFERENCES public.sedes (id),
  nota             text        NULL,
  estado           text        NOT NULL DEFAULT 'pendiente',
  visita_id        uuid        NULL REFERENCES public.visits (id),
  cancelada_at     timestamptz NULL,
  cancelada_motivo text        NULL,
  created_by       uuid        NULL REFERENCES public.users (id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.visitas_agenda DROP CONSTRAINT IF EXISTS visitas_agenda_tipo_check;
ALTER TABLE public.visitas_agenda ADD CONSTRAINT visitas_agenda_tipo_check CHECK (tipo IN ('medica', 'institucional'));
ALTER TABLE public.visitas_agenda DROP CONSTRAINT IF EXISTS visitas_agenda_estado_check;
ALTER TABLE public.visitas_agenda ADD CONSTRAINT visitas_agenda_estado_check
  CHECK (estado IN ('pendiente', 'hecha', 'cancelada'));
ALTER TABLE public.visitas_agenda DROP CONSTRAINT IF EXISTS visitas_agenda_nota_check;
ALTER TABLE public.visitas_agenda ADD CONSTRAINT visitas_agenda_nota_check
  CHECK (nota IS NULL OR (btrim(nota) <> '' AND char_length(nota) <= 300));
ALTER TABLE public.visitas_agenda DROP CONSTRAINT IF EXISTS visitas_agenda_motivo_check;
ALTER TABLE public.visitas_agenda ADD CONSTRAINT visitas_agenda_motivo_check
  CHECK (cancelada_motivo IS NULL OR (btrim(cancelada_motivo) <> '' AND char_length(cancelada_motivo) <= 300));
-- Coherencia por tipo: médica con médico (sin cuenta ni subtipo); institucional con cuenta y subtipo (sin médico).
ALTER TABLE public.visitas_agenda DROP CONSTRAINT IF EXISTS visitas_agenda_tipo_datos_check;
ALTER TABLE public.visitas_agenda ADD CONSTRAINT visitas_agenda_tipo_datos_check CHECK (
  CASE WHEN tipo = 'medica'
       THEN medico_id IS NOT NULL AND cuenta_id IS NULL AND subtipo_id IS NULL
       ELSE cuenta_id IS NOT NULL AND subtipo_id IS NOT NULL AND medico_id IS NULL
  END);
-- Coherencia por estado: pendiente sin visita ni cancelación; hecha con su visita; cancelada con su fecha y sin visita.
ALTER TABLE public.visitas_agenda DROP CONSTRAINT IF EXISTS visitas_agenda_estado_datos_check;
ALTER TABLE public.visitas_agenda ADD CONSTRAINT visitas_agenda_estado_datos_check CHECK (
  CASE estado
    WHEN 'pendiente' THEN visita_id IS NULL AND cancelada_at IS NULL AND cancelada_motivo IS NULL
    WHEN 'hecha'     THEN visita_id IS NOT NULL AND cancelada_at IS NULL AND cancelada_motivo IS NULL
    ELSE visita_id IS NULL AND cancelada_at IS NOT NULL
  END);

-- Sin duplicados (decisión 4): una cita no cancelada por persona, fecha y médico; en las institucionales, por persona,
-- fecha, cuenta y subtipo. Una visita cumple a lo sumo una cita.
CREATE UNIQUE INDEX IF NOT EXISTS visitas_agenda_medico_uidx
  ON public.visitas_agenda (executive_id, fecha, medico_id) WHERE tipo = 'medica' AND estado <> 'cancelada';
CREATE UNIQUE INDEX IF NOT EXISTS visitas_agenda_cuenta_uidx
  ON public.visitas_agenda (executive_id, fecha, cuenta_id, subtipo_id) WHERE tipo = 'institucional' AND estado <> 'cancelada';
CREATE UNIQUE INDEX IF NOT EXISTS visitas_agenda_visita_uidx
  ON public.visitas_agenda (visita_id) WHERE visita_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS visitas_agenda_executive_fecha_idx ON public.visitas_agenda (executive_id, fecha);

CREATE OR REPLACE TRIGGER update_visitas_agenda_updated_at
  BEFORE UPDATE ON public.visitas_agenda
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE OR REPLACE TRIGGER visitas_agenda_sin_borrar
  BEFORE DELETE ON public.visitas_agenda
  FOR EACH ROW EXECUTE FUNCTION public.visitas_sin_borrar();

ALTER TABLE public.visitas_agenda ENABLE ROW LEVEL SECURITY;

-- -------------------------------------------------------------------------------------
-- 2. visits: el vínculo con la cita y si cuenta como agendada (las importadas quedan NULL / false)
-- -------------------------------------------------------------------------------------

ALTER TABLE public.visits
  ADD COLUMN IF NOT EXISTS agenda_id uuid REFERENCES public.visitas_agenda (id),
  ADD COLUMN IF NOT EXISTS agendada  boolean NOT NULL DEFAULT false;

ALTER TABLE public.visits DROP CONSTRAINT IF EXISTS visits_agenda_check;
ALTER TABLE public.visits ADD CONSTRAINT visits_agenda_check
  CHECK ((NOT agendada OR agenda_id IS NOT NULL) AND (agenda_id IS NULL OR source = 'app'));

-- Una cita la cumple a lo sumo UNA visita no anulada (la anulada conserva su agenda_id como rastro).
CREATE UNIQUE INDEX IF NOT EXISTS visits_agenda_id_uidx
  ON public.visits (agenda_id) WHERE agenda_id IS NOT NULL AND deleted_at IS NULL;

-- -------------------------------------------------------------------------------------
-- 3. agenda_crear y agenda_cancelar
-- -------------------------------------------------------------------------------------

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

-- -------------------------------------------------------------------------------------
-- 4. visitas_registrar: el cuerpo de la 0830 tal cual + el vínculo con la agenda (agenda_id, paso 7b, agendada)
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

-- -------------------------------------------------------------------------------------
-- 5. visitas_anular: el cuerpo de la 0830 tal cual + la cita vuelve a pendiente
-- -------------------------------------------------------------------------------------

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

-- -------------------------------------------------------------------------------------
-- 6. Seguridad: RLS sin políticas en visitas_agenda; nada para PUBLIC/anon/authenticated; service_role lo que usa
-- -------------------------------------------------------------------------------------

REVOKE ALL ON TABLE public.visitas_agenda FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.visitas_agenda TO service_role;
-- visits: sin cambios para service_role; se asegura que PUBLIC, anon y authenticated sigan sin nada.
REVOKE ALL ON TABLE public.visits FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.agenda_crear(jsonb, uuid)              FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agenda_cancelar(uuid, text, uuid)      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.visitas_registrar(jsonb, uuid)         FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.visitas_anular(uuid, text, uuid)       FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agenda_crear(jsonb, uuid)           TO service_role;
GRANT EXECUTE ON FUNCTION public.agenda_cancelar(uuid, text, uuid)   TO service_role;
GRANT EXECUTE ON FUNCTION public.visitas_registrar(jsonb, uuid)      TO service_role;
GRANT EXECUTE ON FUNCTION public.visitas_anular(uuid, text, uuid)    TO service_role;

-- -------------------------------------------------------------------------------------
-- 7. Documentación en el catálogo
-- -------------------------------------------------------------------------------------

COMMENT ON TABLE public.visitas_agenda IS
  'Agenda de visitas (F4.1): una fila por cita de un Ejecutivo Comercial (día, hora opcional, médico en una sede o cuenta y subtipo en una sede). Se crea con agenda_crear (de hoy a 30 días, no en un día libre aprobado), se cancela con agenda_cancelar y pasa a hecha cuando visitas_registrar la vincula. No se borra. RLS sin políticas; solo service_role.';
COMMENT ON COLUMN public.visitas_agenda.executive_id IS 'Ejecutivo Comercial dueño de la cita (sale del usuario que agenda).';
COMMENT ON COLUMN public.visitas_agenda.fecha IS 'Día de la cita (Bogotá): de hoy a hoy + 30 al agendar.';
COMMENT ON COLUMN public.visitas_agenda.hora IS 'Hora de la cita (opcional; sin medias horas ni ruteros).';
COMMENT ON COLUMN public.visitas_agenda.tipo IS 'medica (médico en una sede donde atiende) | institucional (cuenta y subtipo en una sede de la cuenta).';
COMMENT ON COLUMN public.visitas_agenda.medico_id IS 'Médico de la cita (médica); NULL en las institucionales.';
COMMENT ON COLUMN public.visitas_agenda.cuenta_id IS 'Cuenta de la cita (institucional); NULL en las médicas.';
COMMENT ON COLUMN public.visitas_agenda.subtipo_id IS 'Subtipo institucional vigente en la fecha de la cita; NULL en las médicas.';
COMMENT ON COLUMN public.visitas_agenda.sede_id IS 'Sede de la cita (donde atiende el médico, o de la cuenta).';
COMMENT ON COLUMN public.visitas_agenda.nota IS 'Nota de la persona (≤ 300).';
COMMENT ON COLUMN public.visitas_agenda.estado IS 'pendiente | hecha (con visita_id) | cancelada (con cancelada_at). Anular la visita la pasa a otra visita suya de ese día con el mismo médico o cuenta, o la devuelve a pendiente.';
COMMENT ON COLUMN public.visitas_agenda.visita_id IS 'Visita de la app que cumplió la cita (estado hecha).';
COMMENT ON COLUMN public.visitas_agenda.cancelada_at IS 'Cuándo se canceló.';
COMMENT ON COLUMN public.visitas_agenda.cancelada_motivo IS 'Motivo de la cancelación (opcional, ≤ 300).';
COMMENT ON COLUMN public.visitas_agenda.created_at IS 'Cuándo se agendó: si es antes del día de la visita (Bogotá), la visita cuenta como agendada.';
COMMENT ON COLUMN public.visits.agenda_id IS 'Cita de la agenda que cumplió la visita (0840). Una cita la cumple a lo sumo una visita no anulada; la anulada lo conserva como rastro.';
COMMENT ON COLUMN public.visits.agendada IS 'La visita cumplió una cita creada antes del día de la visita (Bogotá): indicador de visitas agendadas. false en las importadas y en las no agendadas.';
COMMENT ON FUNCTION public.agenda_crear(jsonb, uuid) IS
  'Agenda una cita de la persona de p_user (F4.1): de hoy a hoy + 30 en Bogotá, no en un día libre aprobado de día completo, perfil vigente en la fecha, sede activa de una cuenta activa, médico activo que atiende en la sede o sede de la cuenta y subtipo vigente; sin duplicados. 22023 forma, 23514 regla, 23505 repetida. Devuelve { cita_id }.';
COMMENT ON FUNCTION public.agenda_cancelar(uuid, text, uuid) IS
  'Cancela una cita pendiente de hoy o futura de la persona de p_user (motivo opcional ≤ 300); la fila no se borra. P0002 inexistente o ajena; 23514 cancelada, hecha o pasada.';
COMMENT ON FUNCTION public.visitas_registrar(jsonb, uuid) IS
  'Registra una visita de la app en una transacción (contrato fase 8, pasos 1 a 8, y 7b de la 0840): idempotente por client_id; mismo día en Bogotá, perfil, sede, médico o cuenta, radio presencial, telefónica, topes y líneas; vínculo con la agenda (agenda_id validado o la cita pendiente de ese día con el mismo médico o cuenta; una efectiva toma la cita que cumplió una no efectiva suya) y agendada si la cita se creó antes del día; 22023 forma, 23514 regla, 23505 client_id ajeno. Devuelve { visita_id, repetida, out_of_territory, distance_m, visit_date, agenda_id, agendada }.';
COMMENT ON FUNCTION public.visitas_anular(uuid, text, uuid) IS
  'Anula con motivo (5..300) una visita de la app de la ejecutiva de p_user y del mismo día (deleted_at); la fila no se borra y su cita pasa a otra visita suya de ese día con el mismo médico o cuenta (la efectiva primero) o vuelve a pendiente. P0002 inexistente o ajena; 23514 no editable o ya anulada.';

-- -------------------------------------------------------------------------------------
-- 8. Comprobaciones (aborta la transacción si algo no cuadra). Las pruebas que escriben van en sub-bloques que
--    terminan con RAISE SQLSTATE 'P0840': PL/pgSQL deshace todo lo del sub-bloque (no queda ni cambia ninguna
--    fila). Cualquier otra excepción sale del bloque y aborta la migración.
-- -------------------------------------------------------------------------------------

DO $$
DECLARE
  v_hoy          constant date := (now() AT TIME ZONE 'America/Bogota')::date;
  v_todos_priv   constant text := 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER';
  c_sin_ejec     constant text := 'Tu usuario no está enlazado con un Ejecutivo Comercial';
  v_fn           text;
  v_col          record;
  v_caso         record;
  v_fila         record;
  v_casos        text[] := '{}';
  v_estado       text;
  v_msg          text;
  v_n            bigint;
  v_md5          text;
  v_md5_todo     text;
  v_antes        text[];
  v_citas_antes  bigint;
  v_cfg_antes    text;
  v_cfg_despues  text;
  v_libres_antes text;
  v_r            jsonb;
  v_r2           jsonb;
  v_rol_ok       boolean;
  v_a            uuid;
  v_a_user       uuid;
  v_a_fila       text;
  v_a_lineas     uuid[];
  v_l1           uuid;
  v_b            uuid;
  v_b_user       uuid;
  v_c1           uuid;
  v_c2           uuid;
  v_c3           uuid;
  v_s1           uuid;
  v_s2           uuid;
  v_s3           uuid;
  v_m1           uuid;
  v_m2           uuid;
  v_m3           uuid;
  v_m4           uuid;
  v_m5           uuid;
  v_m6           uuid;
  v_sub          uuid;
  v_sub_corto    uuid;
  v_d_libre      date;
  v_d_aprobado   date;
  v_d_medio      date;
  v_d_por_aprobar date;
  v_d            date;
  v_base         jsonb;
  v_base_inst    jsonb;
  v_visita       jsonb;
  v_visita_inst  jsonb;
  v_cita1        uuid;
  v_cita2        uuid;
  v_cita3        uuid;
  v_cita_m1      uuid;
  v_cita_m2      uuid;
  v_cita_m4      uuid;
  v_cita_m5      uuid;
  v_cita_cancelada uuid;
  v_cita_b       uuid;
  v_cita_ayer    uuid;
  v_cita_manana  uuid;
  v_cita_i_vig   uuid;
  v_cita_i_corto uuid;
  v_cliente      uuid;
  v_id1          uuid;
  v_id2          uuid;
  v_id3          uuid;
  v_cita_m6      uuid;
  v_id_ne        uuid;
  v_id_ef        uuid;
  v_id_ne5       uuid;
BEGIN
  -- 8.1 Estructura -----------------------------------------------------------------------------------------------
  FOR v_col IN
    SELECT * FROM (VALUES
      ('id', 'uuid', 'NO'), ('executive_id', 'uuid', 'NO'), ('fecha', 'date', 'NO'),
      ('hora', 'time without time zone', 'YES'), ('tipo', 'text', 'NO'), ('medico_id', 'uuid', 'YES'),
      ('cuenta_id', 'uuid', 'YES'), ('subtipo_id', 'uuid', 'YES'), ('sede_id', 'uuid', 'NO'), ('nota', 'text', 'YES'),
      ('estado', 'text', 'NO'), ('visita_id', 'uuid', 'YES'), ('cancelada_at', 'timestamp with time zone', 'YES'),
      ('cancelada_motivo', 'text', 'YES'), ('created_by', 'uuid', 'YES'),
      ('created_at', 'timestamp with time zone', 'NO'), ('updated_at', 'timestamp with time zone', 'NO')
    ) AS t(nombre, tipo, nulo)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns c
                   WHERE c.table_schema = 'public' AND c.table_name = 'visitas_agenda' AND c.column_name = v_col.nombre
                     AND c.data_type = v_col.tipo AND c.is_nullable = v_col.nulo) THEN
      RAISE EXCEPTION '0840: falta visitas_agenda.% (%, NULL: %)', v_col.nombre, v_col.tipo, v_col.nulo;
    END IF;
  END LOOP;
  SELECT count(*) INTO v_n FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'visitas_agenda';
  IF v_n <> 17 THEN
    RAISE EXCEPTION '0840: visitas_agenda tiene % columnas; se esperaban 17', v_n;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns c WHERE c.table_schema = 'public' AND c.table_name = 'visits'
                   AND c.column_name = 'agenda_id' AND c.data_type = 'uuid' AND c.is_nullable = 'YES')
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns c WHERE c.table_schema = 'public' AND c.table_name = 'visits'
                      AND c.column_name = 'agendada' AND c.data_type = 'boolean' AND c.is_nullable = 'NO'
                      AND c.column_default = 'false') THEN
    RAISE EXCEPTION '0840: faltan visits.agenda_id (uuid NULL) o visits.agendada (boolean NOT NULL DEFAULT false)';
  END IF;
  SELECT count(*) INTO v_n FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'visits';
  IF v_n <> 45 THEN
    RAISE EXCEPTION '0840: visits tiene % columnas; se esperaban 45 (43 de la 0830 + 2)', v_n;
  END IF;

  FOR v_col IN
    SELECT * FROM (VALUES
      ('public.visitas_agenda', 'executive_id', 'public.executives'), ('public.visitas_agenda', 'medico_id', 'public.medicos'),
      ('public.visitas_agenda', 'cuenta_id', 'public.cuentas'),
      ('public.visitas_agenda', 'subtipo_id', 'public.subtipos_institucionales'),
      ('public.visitas_agenda', 'sede_id', 'public.sedes'), ('public.visitas_agenda', 'visita_id', 'public.visits'),
      ('public.visitas_agenda', 'created_by', 'public.users'), ('public.visits', 'agenda_id', 'public.visitas_agenda')
    ) AS t(tabla, columna, destino)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_constraint c
                   JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
                   WHERE c.conrelid = v_col.tabla::regclass AND c.contype = 'f' AND a.attname = v_col.columna
                     AND c.confrelid = v_col.destino::regclass) THEN
      RAISE EXCEPTION '0840: falta la llave de %.% hacia %', v_col.tabla, v_col.columna, v_col.destino;
    END IF;
  END LOOP;
  FOR v_col IN
    SELECT * FROM (VALUES
      ('public.visitas_agenda', 'visitas_agenda_tipo_check'), ('public.visitas_agenda', 'visitas_agenda_estado_check'),
      ('public.visitas_agenda', 'visitas_agenda_nota_check'), ('public.visitas_agenda', 'visitas_agenda_motivo_check'),
      ('public.visitas_agenda', 'visitas_agenda_tipo_datos_check'),
      ('public.visitas_agenda', 'visitas_agenda_estado_datos_check'), ('public.visits', 'visits_agenda_check'),
      ('public.visits', 'visits_app_check'), ('public.visits', 'visits_source_check')
    ) AS t(tabla, nombre)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conrelid = v_col.tabla::regclass AND c.conname = v_col.nombre
                     AND c.contype = 'c') THEN
      RAISE EXCEPTION '0840: falta el CHECK % en %', v_col.nombre, v_col.tabla;
    END IF;
  END LOOP;
  FOR v_col IN
    SELECT * FROM (VALUES
      ('public.visitas_agenda', 'visitas_agenda_medico_uidx', true, true),
      ('public.visitas_agenda', 'visitas_agenda_cuenta_uidx', true, true),
      ('public.visitas_agenda', 'visitas_agenda_visita_uidx', true, true),
      ('public.visitas_agenda', 'visitas_agenda_executive_fecha_idx', false, false),
      ('public.visits', 'visits_agenda_id_uidx', true, true)
    ) AS t(tabla, nombre, unico, parcial)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid
                   WHERE i.indrelid = v_col.tabla::regclass AND c.relname = v_col.nombre
                     AND i.indisunique = v_col.unico AND (i.indpred IS NOT NULL) = v_col.parcial) THEN
      RAISE EXCEPTION '0840: falta el índice % (único: %, parcial: %)', v_col.nombre, v_col.unico, v_col.parcial;
    END IF;
  END LOOP;
  FOR v_col IN
    SELECT * FROM (VALUES ('update_visitas_agenda_updated_at'), ('visitas_agenda_sin_borrar')) AS t(nombre)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_trigger t
                   WHERE t.tgrelid = 'public.visitas_agenda'::regclass AND t.tgname = v_col.nombre AND NOT t.tgisinternal) THEN
      RAISE EXCEPTION '0840: falta el disparador % en visitas_agenda', v_col.nombre;
    END IF;
  END LOOP;

  -- RLS sin políticas y privilegios
  IF NOT (SELECT c.relrowsecurity FROM pg_class c WHERE c.oid = 'public.visitas_agenda'::regclass) THEN
    RAISE EXCEPTION '0840: public.visitas_agenda sin RLS';
  END IF;
  SELECT count(*) INTO v_n FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('visitas_agenda', 'visits');
  IF v_n > 0 THEN
    RAISE EXCEPTION '0840: visitas_agenda o visits tienen % política(s) RLS; deben tener 0', v_n;
  END IF;
  IF has_table_privilege('anon', 'public.visitas_agenda', v_todos_priv)
     OR has_table_privilege('authenticated', 'public.visitas_agenda', v_todos_priv)
     OR has_table_privilege('anon', 'public.visits', v_todos_priv)
     OR has_table_privilege('authenticated', 'public.visits', v_todos_priv) THEN
    RAISE EXCEPTION '0840: anon/authenticated tienen privilegios sobre visitas_agenda o visits';
  END IF;
  IF NOT has_table_privilege('service_role', 'public.visitas_agenda', 'SELECT')
     OR NOT has_table_privilege('service_role', 'public.visitas_agenda', 'INSERT')
     OR NOT has_table_privilege('service_role', 'public.visitas_agenda', 'UPDATE')
     OR has_table_privilege('service_role', 'public.visitas_agenda', 'DELETE')
     OR has_table_privilege('service_role', 'public.visitas_agenda', 'TRUNCATE') THEN
    RAISE EXCEPTION '0840: service_role debe tener SELECT, INSERT y UPDATE (sin DELETE ni TRUNCATE) en visitas_agenda';
  END IF;

  FOREACH v_fn IN ARRAY ARRAY['public.agenda_crear(jsonb, uuid)', 'public.agenda_cancelar(uuid, text, uuid)',
                              'public.visitas_registrar(jsonb, uuid)', 'public.visitas_editar(uuid, jsonb, uuid)',
                              'public.visitas_anular(uuid, text, uuid)', 'public.visitas_config_vigente(uuid, date)',
                              'public.visitas_distancia_m(double precision, double precision, double precision, double precision)'] LOOP
    IF to_regprocedure(v_fn) IS NULL THEN
      RAISE EXCEPTION '0840: falta la función %', v_fn;
    END IF;
    IF has_function_privilege('anon', v_fn, 'EXECUTE') OR has_function_privilege('authenticated', v_fn, 'EXECUTE') THEN
      RAISE EXCEPTION '0840: anon/authenticated pueden ejecutar %', v_fn;
    END IF;
    IF NOT has_function_privilege('service_role', v_fn, 'EXECUTE') THEN
      RAISE EXCEPTION '0840: service_role no puede ejecutar %', v_fn;
    END IF;
    IF (SELECT p.prosecdef FROM pg_proc p WHERE p.oid = to_regprocedure(v_fn)) THEN
      RAISE EXCEPTION '0840: % debe ser SECURITY INVOKER', v_fn;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.oid = to_regprocedure(v_fn)
                     AND p.proconfig @> ARRAY['search_path=public, pg_temp']) THEN
      RAISE EXCEPTION '0840: % debe fijar search_path = public, pg_temp', v_fn;
    END IF;
  END LOOP;
  -- Huellas: las dos reemplazadas son las de este archivo; las otras tres de la 0830 no cambiaron.
  FOR v_col IN
    SELECT * FROM (VALUES
      ('visitas_registrar', 'eeae55de7196179daa686cc9bd11da7c'), ('visitas_anular', '462a121cfde8802c4a830bd3c61c05e4'),
      ('visitas_editar', 'f7948c247b88575f4695943f4c9bad45'), ('visitas_config_vigente', 'b5ce2f997fc50012ebc3e8d61463bc1c'),
      ('visitas_distancia_m', 'de6fd102ba79b9d0b59dc94ea9d4b60b')
    ) AS t(nombre, huella)
  LOOP
    IF (SELECT md5(p.prosrc) FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname = v_col.nombre)
       IS DISTINCT FROM v_col.huella THEN
      RAISE EXCEPTION '0840: public.% no tiene la huella esperada (%)', v_col.nombre, v_col.huella;
    END IF;
  END LOOP;
  v_casos := v_casos || 'estructura, privilegios y huellas de las funciones'::text;

  BEGIN
    PERFORM public.agenda_crear('[]'::jsonb, gen_random_uuid());
    RAISE EXCEPTION '0840: agenda_crear aceptó un p que no es objeto';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;

  -- 8.2 Persona A para las pruebas: activa real con zona, usuario y alguna línea, sin visitas de la app hoy (si se
  --     re-ejecuta con datos reales, los topes no se mezclan). B: otra persona activa con usuario (citas ajenas).
  SELECT e.id, e.user_id INTO v_a, v_a_user
  FROM public.executives e
  WHERE e.status = 'active' AND e.base_kam_id IS NOT NULL AND e.user_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.executive_lines el WHERE el.executive_id = e.id)
    AND NOT EXISTS (SELECT 1 FROM public.visits v
                    WHERE v.source = 'app' AND v.executive_id = e.id AND v.visit_date = v_hoy)
    -- Las fechas fijas de las pruebas (hoy a hoy + 7 y hoy + 30) sin días libres suyos, y sin configuración propia que
    -- empiece después de hoy (la de prueba rige desde hoy hasta la siguiente).
    AND NOT EXISTS (SELECT 1 FROM public.dias_libres d
                    WHERE d.executive_id = e.id AND d.estado IN ('registrado', 'por_aprobar', 'aprobado')
                      AND (d.fecha BETWEEN v_hoy AND v_hoy + 7 OR d.fecha = v_hoy + 30))
    AND NOT EXISTS (SELECT 1 FROM public.config_personas cp
                    WHERE cp.executive_id = e.id AND cp.anulado_at IS NULL AND cp.vigente_desde > v_hoy)
  ORDER BY (SELECT count(*) FROM public.executive_lines el WHERE el.executive_id = e.id) DESC, e.id
  LIMIT 1;

  IF v_a IS NULL THEN
    -- Sin persona no se prueba nada de la agenda: la migración no se confirma sin sus criterios de aceptación.
    RAISE EXCEPTION '0840: no hay una persona activa con zona, usuario y líneas, sin visitas de la app hoy, sin días libres en las fechas de prueba (hoy a hoy + 7 y hoy + 30) y sin configuración propia que empiece después de hoy; no se pueden probar agenda_crear, agenda_cancelar ni el vínculo, así que la 0840 no se aplica. Vuelve a correrla cuando alguna persona cumpla (por ejemplo, mañana)';
  ELSE
    SELECT array_agg(el.line_id ORDER BY el.line_id) INTO v_a_lineas
    FROM public.executive_lines el WHERE el.executive_id = v_a;
    v_l1 := v_a_lineas[1];
    SELECT to_jsonb(e)::text INTO v_a_fila FROM public.executives e WHERE e.id = v_a;
    SELECT e.id, e.user_id INTO v_b, v_b_user FROM public.executives e
    WHERE e.status = 'active' AND e.id <> v_a AND e.user_id IS NOT NULL ORDER BY e.id LIMIT 1;
    SELECT count(*) INTO v_citas_antes FROM public.visitas_agenda;
    SELECT md5(coalesce(string_agg(to_jsonb(cg)::text, ',' ORDER BY cg.id), '')) INTO v_cfg_antes FROM public.config_general cg;
    SELECT v_cfg_antes || md5(coalesce(string_agg(to_jsonb(cp)::text, ',' ORDER BY cp.id), '')) INTO v_cfg_antes
    FROM public.config_personas cp;
    SELECT md5(coalesce(string_agg(to_jsonb(d)::text, ',' ORDER BY d.id), '')) INTO v_libres_antes FROM public.dias_libres d;

    -- Solo los de ESTAS pruebas (PRUEBA0840M…, PRUEBA0840C…, prueba_0840…): los médicos de la simulación de Carmen
    -- (web/scripts/simulacion-carmen.ts, PRUEBA0840 + dos dígitos) no cuentan, así la 0840 se puede re-ejecutar.
    IF EXISTS (SELECT 1 FROM public.medicos WHERE numero_documento LIKE 'PRUEBA0840M%')
       OR EXISTS (SELECT 1 FROM public.cuentas WHERE numero_identificacion LIKE 'PRUEBA0840C%')
       OR EXISTS (SELECT 1 FROM public.subtipos_institucionales WHERE codigo LIKE 'prueba\_0840\_%') THEN
      RAISE EXCEPTION '0840: ya hay datos con la identificación de las pruebas (PRUEBA0840M…, PRUEBA0840C… o prueba_0840_…); no se puede probar';
    END IF;

    -- Cuatro días entre hoy + 10 y hoy + 29 sin ningún día libre de A (para los días libres de prueba; las demás
    -- pruebas usan hoy a hoy + 7 y hoy + 30).
    FOR v_d IN SELECT v_hoy + k FROM generate_series(10, 29) AS k LOOP
      CONTINUE WHEN EXISTS (SELECT 1 FROM public.dias_libres d WHERE d.executive_id = v_a AND d.fecha = v_d);
      IF v_d_libre IS NULL THEN v_d_libre := v_d;
      ELSIF v_d_aprobado IS NULL THEN v_d_aprobado := v_d;
      ELSIF v_d_medio IS NULL THEN v_d_medio := v_d;
      ELSIF v_d_por_aprobar IS NULL THEN v_d_por_aprobar := v_d;
      END IF;
    END LOOP;
    IF v_d_por_aprobar IS NULL THEN
      RAISE EXCEPTION '0840: la persona de prueba no tiene 4 días sin días libres entre hoy + 10 y hoy + 29';
    END IF;

    BEGIN
      -- 8.3 Preparación (se deshace al final con P0840) ---------------------------------------------------------
      -- Configuración conocida desde hoy: radio 500, una por médico, telefónicas 1; A con perfil médica e
      -- institucional y sin telefónica.
      PERFORM public.config_registrar('config_general', jsonb_build_object('parametro', 'radio_presencial_m', 'valor', 500),
                                      v_hoy, NULL, NULL, NULL);
      PERFORM public.config_registrar('config_general', jsonb_build_object('parametro', 'tope_visitas_medico_dia', 'valor', 1),
                                      v_hoy, NULL, NULL, NULL);
      PERFORM public.config_registrar('config_personas', jsonb_build_object('executive_id', v_a,
                                        'perfil', jsonb_build_array('medica', 'institucional'),
                                        'telefonica_habilitada', false),
                                      v_hoy, NULL, NULL, NULL);

      -- Cuentas y sedes: S1 en (4.6, -74.08) de C1, S2 en (4.61, -74.09) de C2, S3 de C3 (se desactiva la cuenta).
      INSERT INTO public.cuentas (nombre, clase, tipo_identificacion, numero_identificacion)
      VALUES ('Cuenta de prueba 0840 uno', 'clinica', 'otro', 'PRUEBA0840C1') RETURNING id INTO v_c1;
      INSERT INTO public.cuentas (nombre, clase, tipo_identificacion, numero_identificacion)
      VALUES ('Cuenta de prueba 0840 dos', 'clinica', 'otro', 'PRUEBA0840C2') RETURNING id INTO v_c2;
      INSERT INTO public.cuentas (nombre, clase, tipo_identificacion, numero_identificacion)
      VALUES ('Cuenta de prueba 0840 inactiva', 'clinica', 'otro', 'PRUEBA0840C3') RETURNING id INTO v_c3;
      INSERT INTO public.sedes (cuenta_id, nombre, es_principal, municipality_id, ciudad, lat, lng)
      VALUES (v_c1, 'Sede de prueba 0840 uno', true, '11001', 'Bogotá', 4.6, -74.08) RETURNING id INTO v_s1;
      INSERT INTO public.sedes (cuenta_id, nombre, es_principal, municipality_id, ciudad, lat, lng)
      VALUES (v_c2, 'Sede de prueba 0840 dos', true, '11001', 'Bogotá', 4.61, -74.09) RETURNING id INTO v_s2;
      INSERT INTO public.sedes (cuenta_id, nombre, es_principal, municipality_id, ciudad, lat, lng)
      VALUES (v_c3, 'Sede de prueba 0840 de cuenta inactiva', true, '11001', 'Bogotá', 4.6, -74.08) RETURNING id INTO v_s3;

      -- Subtipos: uno vigente y uno que termina pasado mañana (vencido para una cita en 5 días).
      INSERT INTO public.subtipos_institucionales (codigo, nombre, para_que, roles_sugeridos, orden, vigente_desde)
      VALUES ('prueba_0840_vigente', 'Prueba 0840 vigente', 'Prueba de la migración 0840', '{compras}', 992, v_hoy - 10)
      RETURNING id INTO v_sub;
      INSERT INTO public.subtipos_institucionales (codigo, nombre, para_que, roles_sugeridos, orden, vigente_desde, vigente_hasta)
      VALUES ('prueba_0840_corto', 'Prueba 0840 corto', 'Prueba de la migración 0840', '{compras}', 993, v_hoy - 10, v_hoy + 2)
      RETURNING id INTO v_sub_corto;

      -- Médicos (reglas de la 0800: completos y con sede): M1, M2, M4, M5 y M6 atienden en S1 (M1 también en S3); M3
      -- inactivo. A es visitante de M1 y M2 (los demás quedan fuera de territorio: igual se agendan y se vinculan).
      v_m1 := public.terceros_crear_medico(
                jsonb_build_object('tipo_documento', 'otro', 'numero_documento', 'PRUEBA0840M1',
                                   'nombre', 'Médico de prueba 0840 uno', 'especialidades', jsonb_build_array('ortopedia'),
                                   'municipality_id', '11001'),
                jsonb_build_array(jsonb_build_object('sede_id', v_s1, 'rol', 'atiende', 'principal', true),
                                  jsonb_build_object('sede_id', v_s3, 'rol', 'atiende')),
                v_a_user);
      v_m2 := public.terceros_crear_medico(
                jsonb_build_object('tipo_documento', 'otro', 'numero_documento', 'PRUEBA0840M2',
                                   'nombre', 'Médico de prueba 0840 dos', 'especialidades', jsonb_build_array('columna'),
                                   'municipality_id', '11001'),
                jsonb_build_array(jsonb_build_object('sede_id', v_s1, 'rol', 'atiende', 'principal', true)), v_a_user);
      v_m3 := public.terceros_crear_medico(
                jsonb_build_object('tipo_documento', 'otro', 'numero_documento', 'PRUEBA0840M3',
                                   'nombre', 'Médico de prueba 0840 tres', 'especialidades', jsonb_build_array('ortopedia'),
                                   'municipality_id', '11001'),
                jsonb_build_array(jsonb_build_object('sede_id', v_s1, 'rol', 'atiende', 'principal', true)), v_a_user);
      v_m4 := public.terceros_crear_medico(
                jsonb_build_object('tipo_documento', 'otro', 'numero_documento', 'PRUEBA0840M4',
                                   'nombre', 'Médico de prueba 0840 cuatro', 'especialidades', jsonb_build_array('ortopedia'),
                                   'municipality_id', '11001'),
                jsonb_build_array(jsonb_build_object('sede_id', v_s1, 'rol', 'atiende', 'principal', true)), v_a_user);
      v_m5 := public.terceros_crear_medico(
                jsonb_build_object('tipo_documento', 'otro', 'numero_documento', 'PRUEBA0840M5',
                                   'nombre', 'Médico de prueba 0840 cinco', 'especialidades', jsonb_build_array('ortopedia'),
                                   'municipality_id', '11001'),
                jsonb_build_array(jsonb_build_object('sede_id', v_s1, 'rol', 'atiende', 'principal', true)), v_a_user);
      v_m6 := public.terceros_crear_medico(
                jsonb_build_object('tipo_documento', 'otro', 'numero_documento', 'PRUEBA0840M6',
                                   'nombre', 'Médico de prueba 0840 seis', 'especialidades', jsonb_build_array('ortopedia'),
                                   'municipality_id', '11001'),
                jsonb_build_array(jsonb_build_object('sede_id', v_s1, 'rol', 'atiende', 'principal', true)), v_a_user);
      UPDATE public.medicos SET activo = false WHERE id = v_m3;
      UPDATE public.cuentas SET activo = false WHERE id = v_c3;
      INSERT INTO public.medico_visitantes (medico_id, executive_id, line_id, desde)
      VALUES (v_m1, v_a, v_l1, v_hoy - 10), (v_m2, v_a, v_l1, v_hoy - 10);

      -- Días libres de A: completo registrado, completo aprobado, medio día registrado y completo por aprobar.
      INSERT INTO public.dias_libres (executive_id, fecha, fraccion, motivo, estado)
      VALUES (v_a, v_d_libre, 1, 'vacaciones', 'registrado');
      INSERT INTO public.dias_libres (executive_id, fecha, fraccion, motivo, estado, revisado_at)
      VALUES (v_a, v_d_aprobado, 1, 'vacaciones', 'aprobado', now());
      INSERT INTO public.dias_libres (executive_id, fecha, fraccion, motivo, estado)
      VALUES (v_a, v_d_medio, 0.5, 'vacaciones', 'registrado');
      INSERT INTO public.dias_libres (executive_id, fecha, fraccion, motivo, estado)
      VALUES (v_a, v_d_por_aprobar, 1, 'vacaciones', 'por_aprobar');

      v_base := jsonb_build_object('fecha', v_hoy + 1, 'hora', '09:30', 'tipo', 'medica', 'medico_id', v_m1, 'sede_id', v_s1,
                                   'nota', 'Prueba 0840: llevar muestras');
      v_base_inst := jsonb_build_object('fecha', v_hoy + 1, 'tipo', 'institucional', 'cuenta_id', v_c1, 'subtipo_id', v_sub,
                                        'sede_id', v_s1);

      -- 8.4 Rechazos de agenda_crear (cada uno se deshace solo) ------------------------------------------------
      FOR v_caso IN
        SELECT * FROM (VALUES
          ('del pasado (ayer)', v_base || jsonb_build_object('fecha', v_hoy - 1), NULL::text[], v_a_user, '23514',
           'No se agenda en el pasado: elige hoy o una fecha posterior'),
          ('a más de 30 días', v_base || jsonb_build_object('fecha', v_hoy + 31), NULL, v_a_user, '23514',
           'Solo se agenda hasta 30 días adelante'),
          ('en un día libre registrado', v_base || jsonb_build_object('fecha', v_d_libre), NULL, v_a_user, '23514',
           'Ese día lo tienes libre (día libre aprobado): no se agenda'),
          ('en un día libre aprobado', v_base || jsonb_build_object('fecha', v_d_aprobado), NULL, v_a_user, '23514',
           'Ese día lo tienes libre (día libre aprobado): no se agenda'),
          ('médico que no atiende en la sede', v_base || jsonb_build_object('sede_id', v_s2), NULL, v_a_user, '23514',
           'El médico no atiende en esa sede'),
          ('médico inactivo', v_base || jsonb_build_object('medico_id', v_m3), NULL, v_a_user, '23514',
           'Ese médico no existe o está inactivo'),
          ('médico inexistente', v_base || jsonb_build_object('medico_id', gen_random_uuid()), NULL, v_a_user, '23514',
           'Ese médico no existe o está inactivo'),
          ('sede inexistente', v_base || jsonb_build_object('sede_id', gen_random_uuid()), NULL, v_a_user, '23514',
           'Esa sede no existe'),
          ('médica en una sede de cuenta inactiva', v_base || jsonb_build_object('sede_id', v_s3), NULL, v_a_user, '23514',
           'La cuenta de esa sede está inactiva'),
          ('institucional: cuenta ajena a la sede', v_base_inst || jsonb_build_object('sede_id', v_s2), NULL, v_a_user, '23514',
           'Esa sede no es de la cuenta elegida'),
          ('institucional: cuenta inactiva', v_base_inst || jsonb_build_object('cuenta_id', v_c3, 'sede_id', v_s3), NULL, v_a_user,
           '23514', 'La cuenta de esa sede está inactiva'),
          ('institucional: subtipo vencido en la fecha', v_base_inst || jsonb_build_object('subtipo_id', v_sub_corto, 'fecha', v_hoy + 5),
           NULL, v_a_user, '23514', 'Ese subtipo no está vigente'),
          ('institucional: subtipo inexistente', v_base_inst || jsonb_build_object('subtipo_id', gen_random_uuid()), NULL, v_a_user,
           '23514', 'Ese subtipo no está vigente'),
          ('usuario sin Ejecutivo Comercial', v_base, NULL, gen_random_uuid(), '23514', c_sin_ejec),
          ('tipo no válido', v_base || '{"tipo": "visita"}'::jsonb, NULL, v_a_user, '22023', 'Tipo de visita no válido: medica o institucional'),
          ('fecha no válida', v_base || '{"fecha": "2026-13-40"}'::jsonb, NULL, v_a_user, '22023', 'Datos de la cita no válidos%'),
          ('sin fecha', v_base, ARRAY['fecha'], v_a_user, '22023', 'Elige la fecha de la cita'),
          ('hora no válida (25:00)', v_base || '{"hora": "25:00"}'::jsonb, NULL, v_a_user, '22023', 'Datos de la cita no válidos%'),
          ('hora 24:00', v_base || '{"hora": "24:00"}'::jsonb, NULL, v_a_user, '22023', 'Hora no válida: usa HH:MM (de 00:00 a 23:59)'),
          ('médica sin médico', v_base, ARRAY['medico_id'], v_a_user, '22023', 'Elige el médico'),
          ('institucional sin subtipo', v_base_inst, ARRAY['subtipo_id'], v_a_user, '22023', 'Elige el subtipo de la visita institucional'),
          ('institucional sin cuenta', v_base_inst, ARRAY['cuenta_id'], v_a_user, '22023', 'Elige la cuenta'),
          ('sin sede', v_base, ARRAY['sede_id'], v_a_user, '22023', 'Elige la sede'),
          ('nota muy larga', v_base || jsonb_build_object('nota', repeat('x', 301)), NULL, v_a_user, '22023',
           'La nota no puede superar 300 caracteres')
        ) AS t(nombre, cuerpo, quitar, usuario, estado, mensaje)
      LOOP
        BEGIN
          PERFORM public.agenda_crear(v_caso.cuerpo - coalesce(v_caso.quitar, '{}'::text[]), v_caso.usuario);
          RAISE EXCEPTION '0840: se aceptó una cita no válida (%)', v_caso.nombre;
        EXCEPTION WHEN OTHERS THEN
          GET STACKED DIAGNOSTICS v_estado = RETURNED_SQLSTATE, v_msg = MESSAGE_TEXT;
          IF v_estado IS DISTINCT FROM v_caso.estado OR NOT (v_msg LIKE ANY (string_to_array(v_caso.mensaje, ' | '))) THEN
            RAISE EXCEPTION '0840: el caso "%" devolvió % (%) y se esperaba % (%)',
              v_caso.nombre, v_estado, v_msg, v_caso.estado, v_caso.mensaje;
          END IF;
        END;
      END LOOP;
      -- Perfil vigente EN LA FECHA de la cita: solo institucional desde dentro de 6 días.
      BEGIN
        PERFORM public.config_registrar('config_personas', jsonb_build_object('executive_id', v_a,
                  'perfil', jsonb_build_array('institucional')), v_hoy + 6, NULL, NULL, NULL);
        BEGIN
          PERFORM public.agenda_crear(v_base || jsonb_build_object('fecha', v_hoy + 7), v_a_user);
          RAISE EXCEPTION '0840: se aceptó una cita médica en una fecha con perfil solo institucional';
        EXCEPTION WHEN check_violation THEN
          GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
          IF v_msg <> 'Tu perfil no incluye visitas médicas' THEN
            RAISE EXCEPTION '0840 perfil en la fecha: mensaje inesperado (%)', v_msg;
          END IF;
        END;
        v_r := public.agenda_crear(v_base || jsonb_build_object('fecha', v_hoy + 5), v_a_user);  -- antes del cambio: sí
        IF v_r ->> 'cita_id' IS NULL THEN
          RAISE EXCEPTION '0840 perfil en la fecha: antes del cambio debía agendar: %', v_r;
        END IF;
        RAISE SQLSTATE 'P0840';
      EXCEPTION
        WHEN SQLSTATE 'P0840' THEN NULL;
      END;
      IF (SELECT count(*) FROM public.visitas_agenda) <> v_citas_antes THEN
        RAISE EXCEPTION '0840: un rechazo dejó una cita guardada';
      END IF;
      v_casos := v_casos || 'agendar rechazado: pasado, más de 30 días, día libre registrado y aprobado, médico que no atiende en la sede o inactivo, sede, cuenta ajena o inactiva, subtipo vencido en la fecha, perfil en la fecha, sin persona y forma (25)'::text;

      -- 8.5 Agendar válido; repetida; borde de 30 días; medio día y por aprobar sí; la fila --------------------
      v_r := public.agenda_crear(v_base, v_a_user);
      v_cita1 := (v_r ->> 'cita_id')::uuid;
      SELECT * INTO v_fila FROM public.visitas_agenda a WHERE a.id = v_cita1;
      IF v_fila.executive_id <> v_a OR v_fila.fecha <> v_hoy + 1 OR v_fila.hora <> time '09:30' OR v_fila.tipo <> 'medica'
         OR v_fila.medico_id <> v_m1 OR v_fila.cuenta_id IS NOT NULL OR v_fila.subtipo_id IS NOT NULL OR v_fila.sede_id <> v_s1
         OR v_fila.nota <> 'Prueba 0840: llevar muestras' OR v_fila.estado <> 'pendiente' OR v_fila.visita_id IS NOT NULL
         OR v_fila.cancelada_at IS NOT NULL OR v_fila.created_by <> v_a_user OR v_fila.created_at <> now() THEN
        RAISE EXCEPTION '0840 agendar: la fila no quedó como se esperaba: %', to_jsonb(v_fila);
      END IF;
      BEGIN
        PERFORM public.agenda_crear(v_base || jsonb_build_object('hora', '15:00', 'nota', NULL), v_a_user);
        RAISE EXCEPTION '0840: se aceptó una cita repetida (mismo médico y día)';
      EXCEPTION WHEN unique_violation THEN
        GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
        IF v_msg <> 'Ya tienes una cita con ese médico ese día' THEN
          RAISE EXCEPTION '0840 repetida: mensaje inesperado (%)', v_msg;
        END IF;
      END;
      v_r := public.agenda_crear(v_base_inst, v_a_user);
      v_cita2 := (v_r ->> 'cita_id')::uuid;
      IF (SELECT a.medico_id IS NULL AND a.cuenta_id = v_c1 AND a.subtipo_id = v_sub AND a.hora IS NULL
          FROM public.visitas_agenda a WHERE a.id = v_cita2) IS NOT TRUE THEN
        RAISE EXCEPTION '0840 agendar institucional: la fila no quedó como se esperaba';
      END IF;
      BEGIN
        PERFORM public.agenda_crear(v_base_inst || '{"hora": "11:00"}'::jsonb, v_a_user);
        RAISE EXCEPTION '0840: se aceptó una cita institucional repetida (misma cuenta, subtipo y día)';
      EXCEPTION WHEN unique_violation THEN
        GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
        IF v_msg <> 'Ya tienes una cita con esa cuenta y ese subtipo ese día' THEN
          RAISE EXCEPTION '0840 repetida institucional: mensaje inesperado (%)', v_msg;
        END IF;
      END;
      PERFORM public.agenda_crear(v_base_inst || jsonb_build_object('subtipo_id', v_sub_corto), v_a_user);  -- otro subtipo: sí
      PERFORM public.agenda_crear(v_base || jsonb_build_object('fecha', v_hoy + 30, 'medico_id', v_m2, 'hora', NULL), v_a_user);
      PERFORM public.agenda_crear(v_base || jsonb_build_object('fecha', v_d_medio), v_a_user);
      PERFORM public.agenda_crear(v_base || jsonb_build_object('fecha', v_d_por_aprobar), v_a_user);
      PERFORM public.agenda_crear(v_base || jsonb_build_object('fecha', v_hoy, 'medico_id', v_m6), v_a_user);  -- hoy: sí
      -- Los índices únicos son la última barrera (una cita insertada directo, saltándose agenda_crear).
      BEGIN
        INSERT INTO public.visitas_agenda (executive_id, fecha, tipo, medico_id, sede_id)
        VALUES (v_a, v_hoy + 1, 'medica', v_m1, v_s1);
        RAISE EXCEPTION '0840: visitas_agenda_medico_uidx aceptó una cita repetida';
      EXCEPTION WHEN unique_violation THEN NULL;
      END;
      -- CHECK de coherencia
      FOR v_caso IN
        SELECT * FROM (VALUES
          ('médica con cuenta', 'medica', v_m1, v_c1, NULL::uuid, 'pendiente', NULL::timestamptz),
          ('institucional sin subtipo', 'institucional', NULL, v_c1, NULL, 'pendiente', NULL),
          ('hecha sin visita', 'medica', v_m4, NULL, NULL, 'hecha', NULL),
          ('cancelada sin fecha de cancelación', 'medica', v_m4, NULL, NULL, 'cancelada', NULL),
          ('estado no válido', 'medica', v_m4, NULL, NULL, 'borrada', NULL)
        ) AS t(nombre, tipo, medico, cuenta, subtipo, estado, cancelada)
      LOOP
        BEGIN
          INSERT INTO public.visitas_agenda (executive_id, fecha, tipo, medico_id, cuenta_id, subtipo_id, sede_id, estado, cancelada_at)
          VALUES (v_a, v_hoy + 2, v_caso.tipo, v_caso.medico, v_caso.cuenta, v_caso.subtipo, v_s1, v_caso.estado, v_caso.cancelada);
          RAISE EXCEPTION '0840: los CHECK de visitas_agenda aceptaron una cita %', v_caso.nombre;
        EXCEPTION WHEN check_violation THEN NULL;
        END;
      END LOOP;
      v_casos := v_casos || 'agendar válido (médica e institucional), repetida 23505, otro subtipo, borde de 30 días, medio día y por aprobar, hoy, índices y CHECK'::text;

      -- 8.6 Cancelar: la propia pendiente; dos veces; la ajena; la de ayer; motivo largo; re-agendar; no se borra ---
      PERFORM public.agenda_cancelar(v_cita1, '  Prueba 0840: el médico viaja  ', v_a_user);
      SELECT * INTO v_fila FROM public.visitas_agenda a WHERE a.id = v_cita1;
      IF v_fila.estado <> 'cancelada' OR v_fila.cancelada_at IS NULL OR v_fila.cancelada_motivo <> 'Prueba 0840: el médico viaja' THEN
        RAISE EXCEPTION '0840 cancelar: la fila no quedó cancelada con su motivo: %', to_jsonb(v_fila);
      END IF;
      v_r := public.agenda_crear(v_base, v_a_user);  -- cancelada: el mismo médico ese día se vuelve a agendar
      v_cita3 := (v_r ->> 'cita_id')::uuid;
      PERFORM public.agenda_cancelar(v_cita3, NULL, v_a_user);  -- sin motivo también
      INSERT INTO public.visitas_agenda (executive_id, fecha, tipo, medico_id, sede_id, created_by, created_at)
      VALUES (v_a, v_hoy - 1, 'medica', v_m4, v_s1, v_a_user, now() - interval '3 days') RETURNING id INTO v_cita_ayer;
      IF v_b IS NOT NULL THEN
        INSERT INTO public.visitas_agenda (executive_id, fecha, tipo, medico_id, sede_id)
        VALUES (v_b, v_hoy, 'medica', v_m1, v_s1) RETURNING id INTO v_cita_b;
      END IF;
      FOR v_caso IN
        SELECT * FROM (VALUES
          ('dos veces', v_cita1, NULL::text, v_a_user, '23514', 'Esa cita ya está cancelada'),
          ('de ayer', v_cita_ayer, NULL, v_a_user, '23514', 'Solo se cancelan las citas de hoy en adelante'),
          ('inexistente', gen_random_uuid(), NULL, v_a_user, 'P0002', 'Esa cita no existe'),
          ('la de A por B', v_cita2, NULL, coalesce(v_b_user, gen_random_uuid()), CASE WHEN v_b_user IS NULL THEN '23514' ELSE 'P0002' END,
           'Esa cita no existe | ' || c_sin_ejec),
          ('la de B por A', coalesce(v_cita_b, gen_random_uuid()), NULL, v_a_user, 'P0002', 'Esa cita no existe'),
          ('motivo muy largo', v_cita2, repeat('x', 301), v_a_user, '23514', 'El motivo no puede superar 300 caracteres'),
          ('sin usuario', v_cita2, NULL, NULL::uuid, '22023', 'Falta el usuario que cancela'),
          ('usuario sin Ejecutivo Comercial', v_cita2, NULL, gen_random_uuid(), '23514', c_sin_ejec)
        ) AS t(nombre, id, motivo, usuario, estado, mensaje)
      LOOP
        BEGIN
          PERFORM public.agenda_cancelar(v_caso.id, v_caso.motivo, v_caso.usuario);
          RAISE EXCEPTION '0840: se aceptó una cancelación no válida (%)', v_caso.nombre;
        EXCEPTION WHEN OTHERS THEN
          GET STACKED DIAGNOSTICS v_estado = RETURNED_SQLSTATE, v_msg = MESSAGE_TEXT;
          IF v_estado IS DISTINCT FROM v_caso.estado OR NOT (v_msg LIKE ANY (string_to_array(v_caso.mensaje, ' | '))) THEN
            RAISE EXCEPTION '0840: el caso de cancelar "%" devolvió % (%) y se esperaba % (%)',
              v_caso.nombre, v_estado, v_msg, v_caso.estado, v_caso.mensaje;
          END IF;
        END;
      END LOOP;
      IF (SELECT a.estado FROM public.visitas_agenda a WHERE a.id = v_cita2) <> 'pendiente' THEN
        RAISE EXCEPTION '0840 cancelar: un rechazo cambió la cita';
      END IF;
      BEGIN
        DELETE FROM public.visitas_agenda WHERE id = v_cita1;
        RAISE EXCEPTION '0840: se borró una cita';
      EXCEPTION WHEN check_violation THEN NULL;
      END;
      v_casos := v_casos || 'cancelar la propia (con y sin motivo) y re-agendar; dos veces, de ayer, inexistente, ajena (de A por B y de B por A), motivo largo y sin persona rechazados; borrar no'::text;

      -- 8.7 El vínculo con la visita (visitas_registrar con y sin agenda_id; anular la devuelve a pendiente) -------
      -- Citas de HOY: M2 creada AYER (cuenta como agendada) y M1 creada hoy (vincula pero no cuenta); M4 (otro
      -- médico), M5 (la cumple una no efectiva) y una cancelada; dos institucionales de C1 con subtipos distintos; y
      -- M1 mañana (otro día).
      INSERT INTO public.visitas_agenda (executive_id, fecha, hora, tipo, medico_id, sede_id, created_by, created_at)
      VALUES (v_a, v_hoy, '08:00', 'medica', v_m2, v_s1, v_a_user, now() - interval '1 day') RETURNING id INTO v_cita_m2;
      v_cita_m1 := (public.agenda_crear(v_base || jsonb_build_object('fecha', v_hoy, 'hora', '10:00'), v_a_user) ->> 'cita_id')::uuid;
      v_cita_m4 := (public.agenda_crear(v_base || jsonb_build_object('fecha', v_hoy, 'medico_id', v_m4), v_a_user) ->> 'cita_id')::uuid;
      v_cita_m5 := (public.agenda_crear(v_base || jsonb_build_object('fecha', v_hoy, 'medico_id', v_m5), v_a_user) ->> 'cita_id')::uuid;
      v_cita_manana := (public.agenda_crear(v_base, v_a_user) ->> 'cita_id')::uuid;  -- M1 mañana (las otras se cancelaron)
      INSERT INTO public.visitas_agenda (executive_id, fecha, hora, tipo, cuenta_id, subtipo_id, sede_id, created_by, created_at)
      VALUES (v_a, v_hoy, '08:00', 'institucional', v_c1, v_sub, v_s1, v_a_user, now() - interval '2 days') RETURNING id INTO v_cita_i_vig;
      INSERT INTO public.visitas_agenda (executive_id, fecha, hora, tipo, cuenta_id, subtipo_id, sede_id, created_by)
      VALUES (v_a, v_hoy, '10:00', 'institucional', v_c1, v_sub_corto, v_s1, v_a_user) RETURNING id INTO v_cita_i_corto;
      -- Una cancelada de hoy con M4 (M4 ya tiene una pendiente hoy: las canceladas no cuentan en el índice único).
      INSERT INTO public.visitas_agenda (executive_id, fecha, tipo, medico_id, sede_id, estado, cancelada_at, created_by)
      VALUES (v_a, v_hoy, 'medica', v_m4, v_s1, 'cancelada', now(), v_a_user) RETURNING id INTO v_cita_cancelada;

      -- Visitas de A hoy, presenciales a 334 m de S1 (radio 500)
      v_visita := jsonb_build_object(
        'executive_id', v_a, 'tipo', 'medica', 'medico_id', v_m2, 'sede_id', v_s1, 'modalidad', 'presencial',
        'efectiva', true, 'checked_in_at', now(), 'reported_at', now(), 'lat', 4.603, 'lng', -74.08,
        'input_mode', 'toques', 'lineas', jsonb_build_array(v_l1));
      v_visita_inst := v_visita - 'medico_id' || jsonb_build_object('tipo', 'institucional', 'cuenta_id', v_c1, 'subtipo_id', v_sub);

      -- Rechazos con agenda_id (23514; nada queda)
      FOR v_caso IN
        SELECT * FROM (VALUES
          ('cita inexistente', v_visita || jsonb_build_object('agenda_id', gen_random_uuid()), '23514', 'Esa cita no existe o no es tuya'),
          ('cita de otra persona', v_visita || jsonb_build_object('medico_id', v_m1, 'agenda_id', coalesce(v_cita_b, gen_random_uuid())),
           '23514', 'Esa cita no existe o no es tuya'),
          ('cita de otro día', v_visita || jsonb_build_object('medico_id', v_m1, 'agenda_id', v_cita_manana), '23514', 'Esa cita es de otro día'),
          ('cita con otro médico', v_visita || jsonb_build_object('medico_id', v_m1, 'agenda_id', v_cita_m4), '23514', 'Esa cita es con otro médico'),
          ('cita cancelada', v_visita || jsonb_build_object('medico_id', v_m4, 'agenda_id', v_cita_cancelada), '23514', 'Esa cita está cancelada'),
          ('cita médica para una institucional', v_visita_inst || jsonb_build_object('agenda_id', v_cita_m1), '23514',
           'Esa cita es de otro tipo de visita'),
          ('cita de otra cuenta', v_visita_inst || jsonb_build_object('cuenta_id', v_c2, 'sede_id', v_s2, 'lat', 4.61, 'lng', -74.09,
                                                                     'agenda_id', v_cita_i_vig), '23514', 'Esa cita es con otra cuenta'),
          ('agenda_id no válido', v_visita || '{"agenda_id": "xyz"}'::jsonb, '22023', 'Datos de la visita no válidos%')
        ) AS t(nombre, cuerpo, estado, mensaje)
      LOOP
        BEGIN
          PERFORM public.visitas_registrar(jsonb_build_object('client_id', gen_random_uuid()) || v_caso.cuerpo, v_a_user);
          RAISE EXCEPTION '0840: se aceptó una visita con una cita que no sirve (%)', v_caso.nombre;
        EXCEPTION WHEN OTHERS THEN
          GET STACKED DIAGNOSTICS v_estado = RETURNED_SQLSTATE, v_msg = MESSAGE_TEXT;
          IF v_estado IS DISTINCT FROM v_caso.estado OR NOT (v_msg LIKE ANY (string_to_array(v_caso.mensaje, ' | '))) THEN
            RAISE EXCEPTION '0840: el caso de vínculo "%" devolvió % (%) y se esperaba % (%)',
              v_caso.nombre, v_estado, v_msg, v_caso.estado, v_caso.mensaje;
          END IF;
        END;
      END LOOP;
      IF EXISTS (SELECT 1 FROM public.visits v WHERE v.executive_id = v_a AND v.visit_date = v_hoy) THEN
        RAISE EXCEPTION '0840: un rechazo del vínculo dejó una visita guardada';
      END IF;

      -- Con agenda_id: M2 (creada ayer) → agendada; la cita pasa a hecha con la visita
      v_cliente := gen_random_uuid();
      v_r := public.visitas_registrar(v_visita || jsonb_build_object('client_id', v_cliente, 'agenda_id', v_cita_m2), v_a_user);
      v_id1 := (v_r ->> 'visita_id')::uuid;
      IF (v_r ->> 'agenda_id')::uuid IS DISTINCT FROM v_cita_m2 OR NOT (v_r ->> 'agendada')::boolean
         OR (v_r ->> 'repetida')::boolean OR (v_r ->> 'distance_m')::int <> 334 THEN
        RAISE EXCEPTION '0840 vínculo con agenda_id: respuesta inesperada %', v_r;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM public.visits v WHERE v.id = v_id1 AND v.agenda_id = v_cita_m2 AND v.agendada)
         OR NOT EXISTS (SELECT 1 FROM public.visitas_agenda a WHERE a.id = v_cita_m2 AND a.estado = 'hecha' AND a.visita_id = v_id1) THEN
        RAISE EXCEPTION '0840 vínculo con agenda_id: la visita o la cita no quedaron vinculadas';
      END IF;
      -- La repetida por client_id devuelve el mismo vínculo
      v_r2 := public.visitas_registrar(v_visita || jsonb_build_object('client_id', v_cliente), v_a_user);
      IF NOT (v_r2 ->> 'repetida')::boolean OR (v_r2 ->> 'visita_id')::uuid <> v_id1
         OR (v_r2 ->> 'agenda_id')::uuid IS DISTINCT FROM v_cita_m2 OR NOT (v_r2 ->> 'agendada')::boolean THEN
        RAISE EXCEPTION '0840 repetida: debe devolver agenda_id y agendada de la visita: %', v_r2;
      END IF;
      -- Una cita ya hecha no se vuelve a cumplir (una no efectiva a M2 con esa cita: pasa los topes y choca aquí)
      BEGIN
        PERFORM public.visitas_registrar(v_visita || jsonb_build_object('client_id', gen_random_uuid(), 'efectiva', false,
                                           'failure_reason', 'Prueba 0840', 'agenda_id', v_cita_m2), v_a_user);
        RAISE EXCEPTION '0840: se cumplió dos veces la misma cita';
      EXCEPTION WHEN check_violation THEN
        GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
        IF v_msg <> 'Esa cita ya tiene su visita' THEN
          RAISE EXCEPTION '0840 cita ya hecha: mensaje inesperado (%)', v_msg;
        END IF;
      END;
      -- Una cita hecha no se cancela
      BEGIN
        PERFORM public.agenda_cancelar(v_cita_m2, NULL, v_a_user);
        RAISE EXCEPTION '0840: se canceló una cita hecha';
      EXCEPTION WHEN check_violation THEN
        GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
        IF v_msg <> 'Esa cita ya tiene su visita: no se cancela' THEN
          RAISE EXCEPTION '0840 cancelar hecha: mensaje inesperado (%)', v_msg;
        END IF;
      END;

      -- Sin agenda_id: vínculo automático con la de M1 (creada hoy → vincula, no cuenta como agendada)
      v_r := public.visitas_registrar(v_visita || jsonb_build_object('client_id', gen_random_uuid(), 'medico_id', v_m1), v_a_user);
      v_id2 := (v_r ->> 'visita_id')::uuid;
      IF (v_r ->> 'agenda_id')::uuid IS DISTINCT FROM v_cita_m1 OR (v_r ->> 'agendada')::boolean THEN
        RAISE EXCEPTION '0840 vínculo automático: debía tomar la cita de M1 de hoy sin contar como agendada: %', v_r;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM public.visitas_agenda a WHERE a.id = v_cita_m1 AND a.estado = 'hecha' AND a.visita_id = v_id2)
         OR NOT EXISTS (SELECT 1 FROM public.visitas_agenda a WHERE a.id = v_cita_manana AND a.estado = 'pendiente') THEN
        RAISE EXCEPTION '0840 vínculo automático: la cita de hoy no quedó hecha o se tocó la de mañana';
      END IF;
      -- Otra a M1 hoy (no efectiva: el tope es de efectivas) sin cita pendiente: no agendada
      v_r := public.visitas_registrar(v_visita || jsonb_build_object('client_id', gen_random_uuid(), 'medico_id', v_m1,
                                        'efectiva', false, 'failure_reason', 'Prueba 0840: no estaba'), v_a_user);
      IF v_r ->> 'agenda_id' IS NOT NULL OR (v_r ->> 'agendada')::boolean
         OR EXISTS (SELECT 1 FROM public.visits v WHERE v.id = (v_r ->> 'visita_id')::uuid AND (v.agenda_id IS NOT NULL OR v.agendada)) THEN
        RAISE EXCEPTION '0840 sin cita: la visita debía quedar no agendada: %', v_r;
      END IF;
      -- La no efectiva también cumple la cita (M5)
      v_r := public.visitas_registrar(v_visita || jsonb_build_object('client_id', gen_random_uuid(), 'medico_id', v_m5,
                                        'efectiva', false, 'failure_reason', 'Prueba 0840: salió a cirugía'), v_a_user);
      v_id_ne5 := (v_r ->> 'visita_id')::uuid;
      IF (v_r ->> 'agenda_id')::uuid IS DISTINCT FROM v_cita_m5
         OR NOT EXISTS (SELECT 1 FROM public.visitas_agenda a WHERE a.id = v_cita_m5 AND a.estado = 'hecha') THEN
        RAISE EXCEPTION '0840: la visita no efectiva debía cumplir la cita de M5: %', v_r;
      END IF;
      -- Relevo con agenda_id: otra no efectiva no la toma; la efectiva sí (la no efectiva la suelta)
      BEGIN
        PERFORM public.visitas_registrar(v_visita || jsonb_build_object('client_id', gen_random_uuid(), 'medico_id', v_m5,
                                           'efectiva', false, 'failure_reason', 'Prueba 0840: seguía en cirugía',
                                           'agenda_id', v_cita_m5), v_a_user);
        RAISE EXCEPTION '0840: una no efectiva tomó la cita que ya cumplió otra no efectiva';
      EXCEPTION WHEN check_violation THEN
        GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
        IF v_msg <> 'Esa cita ya tiene su visita' THEN
          RAISE EXCEPTION '0840 relevo no efectiva: mensaje inesperado (%)', v_msg;
        END IF;
      END;
      v_r := public.visitas_registrar(v_visita || jsonb_build_object('client_id', gen_random_uuid(), 'medico_id', v_m5,
                                        'agenda_id', v_cita_m5), v_a_user);
      IF (v_r ->> 'agenda_id')::uuid IS DISTINCT FROM v_cita_m5 OR (v_r ->> 'agendada')::boolean
         OR NOT EXISTS (SELECT 1 FROM public.visitas_agenda a WHERE a.id = v_cita_m5 AND a.estado = 'hecha'
                          AND a.visita_id = (v_r ->> 'visita_id')::uuid)
         OR NOT EXISTS (SELECT 1 FROM public.visits v WHERE v.id = v_id_ne5 AND v.agenda_id IS NULL AND NOT v.agendada) THEN
        RAISE EXCEPTION '0840 relevo con agenda_id: la efectiva debía tomar la cita de M5 (creada hoy: no agendada): %', v_r;
      END IF;
      -- Relevo automático (M6, cita de hoy creada ayer): la no efectiva la cumple y cuenta como agendada; la efectiva
      -- de después la toma y cuenta como agendada; la no efectiva queda sin cita. Anular la efectiva se la devuelve a la
      -- no efectiva (agendada otra vez); anular esa la deja pendiente.
      UPDATE public.visitas_agenda SET created_at = now() - interval '1 day'
      WHERE executive_id = v_a AND fecha = v_hoy AND tipo = 'medica' AND medico_id = v_m6 AND estado = 'pendiente'
      RETURNING id INTO v_cita_m6;
      IF v_cita_m6 IS NULL THEN
        RAISE EXCEPTION '0840 relevo: falta la cita pendiente de hoy con M6';
      END IF;
      v_r := public.visitas_registrar(v_visita || jsonb_build_object('client_id', gen_random_uuid(), 'medico_id', v_m6,
                                        'efectiva', false, 'failure_reason', 'Prueba 0840: no estaba'), v_a_user);
      v_id_ne := (v_r ->> 'visita_id')::uuid;
      IF (v_r ->> 'agenda_id')::uuid IS DISTINCT FROM v_cita_m6 OR NOT (v_r ->> 'agendada')::boolean THEN
        RAISE EXCEPTION '0840 relevo: la no efectiva debía cumplir la cita de M6 (creada ayer: agendada): %', v_r;
      END IF;
      v_r := public.visitas_registrar(v_visita || jsonb_build_object('client_id', gen_random_uuid(), 'medico_id', v_m6), v_a_user);
      v_id_ef := (v_r ->> 'visita_id')::uuid;
      IF (v_r ->> 'agenda_id')::uuid IS DISTINCT FROM v_cita_m6 OR NOT (v_r ->> 'agendada')::boolean
         OR NOT EXISTS (SELECT 1 FROM public.visitas_agenda a WHERE a.id = v_cita_m6 AND a.estado = 'hecha' AND a.visita_id = v_id_ef)
         OR NOT EXISTS (SELECT 1 FROM public.visits v WHERE v.id = v_id_ne AND v.agenda_id IS NULL AND NOT v.agendada) THEN
        RAISE EXCEPTION '0840 relevo: la efectiva debía tomar la cita de M6 (agendada) y la no efectiva soltarla: %', v_r;
      END IF;
      PERFORM public.visitas_anular(v_id_ef, 'Prueba 0840: reporté mal la efectiva', v_a_user);
      IF NOT EXISTS (SELECT 1 FROM public.visitas_agenda a WHERE a.id = v_cita_m6 AND a.estado = 'hecha' AND a.visita_id = v_id_ne)
         OR NOT EXISTS (SELECT 1 FROM public.visits v WHERE v.id = v_id_ne AND v.agenda_id = v_cita_m6 AND v.agendada)
         OR NOT EXISTS (SELECT 1 FROM public.visits v WHERE v.id = v_id_ef AND v.deleted_at IS NOT NULL AND v.agenda_id = v_cita_m6) THEN
        RAISE EXCEPTION '0840 anular tras el relevo: la cita debía volver a la no efectiva (agendada)';
      END IF;
      PERFORM public.visitas_anular(v_id_ne, 'Prueba 0840: reporté mal la no efectiva', v_a_user);
      IF NOT EXISTS (SELECT 1 FROM public.visitas_agenda a WHERE a.id = v_cita_m6 AND a.estado = 'pendiente' AND a.visita_id IS NULL) THEN
        RAISE EXCEPTION '0840 anular sin otra visita: la cita de M6 debía volver a pendiente';
      END IF;
      -- Institucional: prefiere el mismo subtipo aunque su hora sea más tarde (corto 10:00 frente a vigente 08:00)
      v_r := public.visitas_registrar(v_visita_inst || jsonb_build_object('client_id', gen_random_uuid(), 'subtipo_id', v_sub_corto), v_a_user);
      IF (v_r ->> 'agenda_id')::uuid IS DISTINCT FROM v_cita_i_corto OR (v_r ->> 'agendada')::boolean THEN
        RAISE EXCEPTION '0840 vínculo institucional: debía tomar la del mismo subtipo (creada hoy: no agendada): %', v_r;
      END IF;
      -- Con otro subtipo que ninguna cita tiene… aquí el vigente: toma la que queda de la cuenta (creada hace 2 días)
      v_r := public.visitas_registrar(v_visita_inst || jsonb_build_object('client_id', gen_random_uuid()), v_a_user);
      v_id3 := (v_r ->> 'visita_id')::uuid;
      IF (v_r ->> 'agenda_id')::uuid IS DISTINCT FROM v_cita_i_vig OR NOT (v_r ->> 'agendada')::boolean THEN
        RAISE EXCEPTION '0840 vínculo institucional: debía tomar la que queda de la cuenta y contar como agendada: %', v_r;
      END IF;
      v_r := public.visitas_registrar(v_visita_inst || jsonb_build_object('client_id', gen_random_uuid()), v_a_user);
      IF v_r ->> 'agenda_id' IS NOT NULL THEN
        RAISE EXCEPTION '0840 vínculo institucional: sin citas pendientes de la cuenta no se vincula: %', v_r;
      END IF;

      -- Anular la visita de M2 devuelve su cita a pendiente; otra visita la vuelve a cumplir (agendada)
      PERFORM public.visitas_anular(v_id1, 'Prueba 0840: reporté mal la visita', v_a_user);
      IF NOT EXISTS (SELECT 1 FROM public.visitas_agenda a WHERE a.id = v_cita_m2 AND a.estado = 'pendiente' AND a.visita_id IS NULL)
         OR NOT EXISTS (SELECT 1 FROM public.visits v WHERE v.id = v_id1 AND v.deleted_at IS NOT NULL AND v.agenda_id = v_cita_m2) THEN
        RAISE EXCEPTION '0840 anular: la cita debía volver a pendiente y la visita anulada conservar su agenda_id';
      END IF;
      v_r := public.visitas_registrar(v_visita || jsonb_build_object('client_id', gen_random_uuid()), v_a_user);
      IF (v_r ->> 'agenda_id')::uuid IS DISTINCT FROM v_cita_m2 OR NOT (v_r ->> 'agendada')::boolean
         OR NOT EXISTS (SELECT 1 FROM public.visitas_agenda a WHERE a.id = v_cita_m2 AND a.estado = 'hecha'
                          AND a.visita_id = (v_r ->> 'visita_id')::uuid) THEN
        RAISE EXCEPTION '0840 anular y volver a reportar: la nueva visita debía cumplir la cita: %', v_r;
      END IF;
      -- Anular una visita sin cita no toca ninguna cita
      PERFORM public.visitas_anular((SELECT v.id FROM public.visits v WHERE v.executive_id = v_a AND v.visit_date = v_hoy
                                       AND v.agenda_id IS NULL AND v.deleted_at IS NULL ORDER BY v.id LIMIT 1),
                                    'Prueba 0840: anular sin cita', v_a_user);

      -- CHECK e índice único de visits
      BEGIN
        UPDATE public.visits SET agenda_id = NULL WHERE id = v_id3;  -- agendada sin cita
        RAISE EXCEPTION '0840: visits_agenda_check aceptó agendada sin agenda_id';
      EXCEPTION WHEN check_violation THEN NULL;
      END;
      BEGIN
        UPDATE public.visits SET agenda_id = v_cita_m1, agendada = false WHERE id = v_id3;  -- la cita de M1 ya la cumple otra
        RAISE EXCEPTION '0840: visits_agenda_id_uidx aceptó dos visitas para una cita';
      EXCEPTION WHEN unique_violation THEN NULL;
      END;
      BEGIN
        UPDATE public.visits SET agenda_id = v_cita_m4 WHERE id = (SELECT v.id FROM public.visits v WHERE v.source = 'vmo_import' LIMIT 1);
        IF FOUND THEN
          RAISE EXCEPTION '0840: visits_agenda_check aceptó una cita en una visita importada';
        END IF;
      EXCEPTION WHEN check_violation THEN NULL;
      END;
      v_casos := v_casos || 'vínculo: con agenda_id (agendada si se creó antes), rechazos (inexistente, ajena, otro día, otro médico, cancelada, otro tipo, otra cuenta, ya hecha, forma), automático (médico y cuenta con preferencia de subtipo), sin cita no agendada, la no efectiva cumple, relevo de la no efectiva por la efectiva (con y sin agenda_id; otra no efectiva no), repetida con el vínculo, anular devuelve la cita a la otra visita o a pendiente y se vuelve a cumplir, CHECK e índice único'::text;

      -- 8.8 Como service_role (el rol de la API): agendar, cancelar, registrar con cita y anular; borrar no ------
      BEGIN
        BEGIN
          PERFORM set_config('role', 'service_role', true);
          v_rol_ok := true;
        EXCEPTION WHEN insufficient_privilege OR invalid_parameter_value THEN
          v_rol_ok := false;
        END;
        IF v_rol_ok THEN
          v_r := public.agenda_crear(v_base || jsonb_build_object('fecha', v_hoy + 2, 'medico_id', v_m2), v_a_user);
          PERFORM public.agenda_cancelar((v_r ->> 'cita_id')::uuid, 'Prueba 0840 service_role', v_a_user);
          v_r := public.visitas_registrar(v_visita || jsonb_build_object('client_id', gen_random_uuid(), 'medico_id', v_m4,
                                            'agenda_id', v_cita_m4), v_a_user);
          IF (v_r ->> 'agenda_id')::uuid IS DISTINCT FROM v_cita_m4 THEN
            RAISE EXCEPTION '0840 service_role: la visita debía cumplir la cita de M4: %', v_r;
          END IF;
          PERFORM public.visitas_anular((v_r ->> 'visita_id')::uuid, 'Prueba 0840 service_role', v_a_user);
          IF NOT EXISTS (SELECT 1 FROM public.visitas_agenda a WHERE a.id = v_cita_m4 AND a.estado = 'pendiente') THEN
            RAISE EXCEPTION '0840 service_role: la cita de M4 debía volver a pendiente';
          END IF;
          BEGIN
            DELETE FROM public.visitas_agenda WHERE id = v_cita_m4;
            RAISE EXCEPTION '0840: service_role borró una cita';
          EXCEPTION WHEN insufficient_privilege OR check_violation THEN NULL;
          END;
          v_casos := v_casos || 'como service_role (agendar, cancelar, registrar con cita, anular; borrar no)'::text;
        ELSE
          RAISE NOTICE '0840: no se pudo cambiar a service_role; sus privilegios se comprobaron solo con has_*_privilege';
        END IF;
        RAISE SQLSTATE 'P0840';
      EXCEPTION
        WHEN SQLSTATE 'P0840' THEN NULL;
      END;
      IF current_user = 'service_role' THEN
        RAISE EXCEPTION '0840: el rol no volvió después de la prueba como service_role';
      END IF;

      RAISE SQLSTATE 'P0840';
    EXCEPTION
      WHEN SQLSTATE 'P0840' THEN NULL;  -- preparación y pruebas deshechas
    END;

    -- 8.9 No quedó nada de las pruebas; A, la configuración y los días libres están como antes
    IF (SELECT count(*) FROM public.visitas_agenda) <> v_citas_antes
       OR EXISTS (SELECT 1 FROM public.visitas_agenda WHERE created_at = now())
       OR EXISTS (SELECT 1 FROM public.medicos WHERE numero_documento LIKE 'PRUEBA0840M%')
       OR EXISTS (SELECT 1 FROM public.cuentas WHERE numero_identificacion LIKE 'PRUEBA0840C%')
       OR EXISTS (SELECT 1 FROM public.subtipos_institucionales WHERE codigo LIKE 'prueba\_0840\_%')
       OR EXISTS (SELECT 1 FROM public.visits WHERE source = 'app' AND created_at = now())
       OR EXISTS (SELECT 1 FROM public.dias_libres WHERE created_at = now()) THEN
      RAISE EXCEPTION '0840: quedaron filas de las pruebas';
    END IF;
    SELECT md5(coalesce(string_agg(to_jsonb(cg)::text, ',' ORDER BY cg.id), '')) INTO v_cfg_despues FROM public.config_general cg;
    SELECT v_cfg_despues || md5(coalesce(string_agg(to_jsonb(cp)::text, ',' ORDER BY cp.id), '')) INTO v_cfg_despues
    FROM public.config_personas cp;
    IF v_cfg_despues IS DISTINCT FROM v_cfg_antes THEN
      RAISE EXCEPTION '0840: la configuración (config_general o config_personas) no quedó como estaba';
    END IF;
    IF (SELECT md5(coalesce(string_agg(to_jsonb(d)::text, ',' ORDER BY d.id), '')) FROM public.dias_libres d) IS DISTINCT FROM v_libres_antes THEN
      RAISE EXCEPTION '0840: los días libres no quedaron como estaban';
    END IF;
    IF (SELECT to_jsonb(e)::text FROM public.executives e WHERE e.id = v_a) IS DISTINCT FROM v_a_fila THEN
      RAISE EXCEPTION '0840: la persona de las pruebas no quedó como estaba';
    END IF;
    IF cardinality(v_casos) < (CASE WHEN v_rol_ok THEN 6 ELSE 5 END) THEN
      RAISE EXCEPTION '0840: solo se probaron % grupos de casos: %', cardinality(v_casos), array_to_string(v_casos, '; ');
    END IF;
  END IF;

  -- 8.10 Las importadas de VMO siguen idénticas (conteo y huellas de antes de migrar), sin cita ni agendada -------
  v_antes := string_to_array(current_setting('opmap0840.importadas', true), '|');
  IF v_antes IS NULL OR cardinality(v_antes) <> 3 THEN
    RAISE EXCEPTION '0840: falta la huella de las importadas tomada antes de migrar';
  END IF;
  SELECT count(*),
         coalesce(md5(string_agg(v.id::text || v.visit_type || v.contact_type || v.visit_date::text, ',' ORDER BY v.id)), '-'),
         coalesce(md5(string_agg(ROW(v.id, v.kam_id, v.kam_name, v.visit_type, v.contact_type, v.lat, v.lng, v.visit_date,
                                     v.hospital_id, v.imported_by, v.imported_at, v.created_at, v.updated_at,
                                     v.import_id)::text, ',' ORDER BY v.id)), '-')
  INTO v_n, v_md5, v_md5_todo
  FROM public.visits v
  WHERE v.source = 'vmo_import';
  IF v_n::text <> v_antes[1] OR v_md5 <> v_antes[2] OR v_md5_todo <> v_antes[3] THEN
    RAISE EXCEPTION '0840: las visitas importadas cambiaron (antes % / %, después % / %)', v_antes[1], v_antes[2], v_n, v_md5;
  END IF;
  IF EXISTS (SELECT 1 FROM public.visits v WHERE v.source = 'vmo_import' AND (v.agenda_id IS NOT NULL OR v.agendada)) THEN
    RAISE EXCEPTION '0840: hay visitas importadas con cita o agendadas';
  END IF;

  RAISE NOTICE '0840 OK: visitas_agenda (17 columnas, CHECK por tipo y estado, 4 índices, sin borrado, RLS sin políticas, solo service_role); visits con agenda_id y agendada; agenda_crear y agenda_cancelar; visitas_registrar y visitas_anular con el vínculo; % importadas intactas (huella %).',
    v_antes[1], v_antes[2];
  RAISE NOTICE '0840 OK: % grupos de casos probados con datos que se deshacen: %', cardinality(v_casos), array_to_string(v_casos, '; ');
END;
$$;

COMMIT;
