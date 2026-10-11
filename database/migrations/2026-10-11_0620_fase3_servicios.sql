-- =====================================================================================
-- OpMap · Fase 3 (D3: servicios habilitados y capacidad instalada del REPS) · 0620
-- Proyecto: norvxqgohddgsdkggqzq · Generado: 2026-10-11
--
-- Pedido del dueño (2026-10-11): la IPS se identifica por código de habilitación de la sede
-- (no por NIT) y debe tener "servicios habilitados e info que me dé a entender qué tan grande
-- es". Este script crea el almacén de lo que se importa del REPS (portal del Ministerio,
-- consultas "Servicios" y "Capacidades instaladas", exportadas a Excel/texto o PDF con texto) y
-- unas columnas resumen en hospitals para filtrar en la lista y en el mapa.
--
-- Qué crea / cambia (TODO ADITIVO: no borra ni modifica datos existentes):
--   1. hospital_services    : servicios habilitados por sede REPS (reps_code = código de
--                             habilitación de la sede, 12 dígitos; 10 si el archivo solo trae
--                             el del prestador; "NIT-<nit>" si solo trae NIT y una única sede).
--                             UNIQUE (reps_code, service_code, modality).
--   2. hospital_capacity    : capacidad instalada por sede (camas | salas | ambulancias | otros).
--                             UNIQUE (reps_code, group_name, concept).
--   3. hospital_import_jobs : simulaciones de importación (token = id) con las filas ya
--                             normalizadas, caducan a los 30 minutos; al aplicar se vacía
--                             "rows" y queda el resumen como auditoría.
--   4. hospitals            : columnas nuevas quirofanos, reps_beds, service_flags (jsonb,
--                             default '{}'), reps_services_count, reps_updated_at. NO se toca
--                             hospitals.beds (camas declaradas a mano): reps_beds es aparte.
--   5. hospital_history     : el CHECK de action admite además 'import' (se conserva cualquier
--                             valor que ya admita; solo se amplía).
--   6. reps_import_apply(uuid, jsonb): aplica una importación en UNA transacción (upserts,
--                             borrados de servicios retirados, columnas de hospitals,
--                             hospital_history 'import' y cierre del job). Solo service_role.
--   Las 3 tablas con RLS activado, SIN políticas, sin privilegios para anon/authenticated/PUBLIC
--   y GRANT explícito a service_role (mismo patrón que database/hardening y Fases 1–2b).
--
-- Importar NUNCA recalcula asignaciones ni llama a Google: solo guarda datos del REPS.
--
-- Foto con SELECT antes de este script (2026-10-11):
--   - Ninguna de las 3 tablas existe; hospitals no tiene ninguna de las 5 columnas.
--   - hospital_history_action_check = action IN ('activated','deactivated','edited').
--   - hospitals: 1 trigger (update_hospitals_updated_at, BEFORE UPDATE): actualizar las columnas
--     nuevas cambia updated_at, que la cola de pendientes NO usa (ver docs/ips-pendientes.md).
--   - service_role sin statement_timeout; authenticator 8 s (las RPC van por PostgREST).
--
-- Re-ejecutable: sí (IF NOT EXISTS / OR REPLACE / REVOKE-GRANT idempotentes; el CHECK de
-- hospital_history solo se reescribe si aún no admite 'import').
-- Transaccional: todo o nada. Rollback: 2026-10-11_9930_servicios_rollback.sql.
-- =====================================================================================

BEGIN;

-- -------------------------------------------------------------------------------------
-- 1. hospital_services
-- -------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hospital_services (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reps_code     text NOT NULL,
  hospital_id   uuid NULL REFERENCES public.hospitals(id) ON DELETE SET NULL,
  service_code  text NOT NULL,
  service_name  text NULL,
  group_name    text NULL,
  complexity    text NULL,
  modality      text NOT NULL DEFAULT '',
  source        text NOT NULL DEFAULT 'reps',
  imported_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hospital_services_reps_code_format
    CHECK (reps_code ~ '^([0-9]{10}|[0-9]{12}|NIT-[0-9]{5,15})$'),
  CONSTRAINT hospital_services_service_code_len CHECK (char_length(service_code) BETWEEN 1 AND 80),
  CONSTRAINT hospital_services_unique UNIQUE (reps_code, service_code, modality)
);
CREATE INDEX IF NOT EXISTS hospital_services_hospital_idx ON public.hospital_services (hospital_id);

COMMENT ON TABLE public.hospital_services IS
  'Fase 3: servicios habilitados del REPS por sede (reps_code = código de habilitación de la sede). Se llena desde /hospitals/import (servicios). hospital_id NULL = sede sin cruce con una IPS de OpMap.';

-- -------------------------------------------------------------------------------------
-- 2. hospital_capacity
-- -------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hospital_capacity (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reps_code     text NOT NULL,
  hospital_id   uuid NULL REFERENCES public.hospitals(id) ON DELETE SET NULL,
  group_name    text NOT NULL,
  concept       text NOT NULL,
  quantity      integer NOT NULL,
  source        text NOT NULL DEFAULT 'reps',
  imported_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hospital_capacity_reps_code_format
    CHECK (reps_code ~ '^([0-9]{10}|[0-9]{12}|NIT-[0-9]{5,15})$'),
  CONSTRAINT hospital_capacity_group_check CHECK (group_name IN ('camas', 'salas', 'ambulancias', 'otros')),
  CONSTRAINT hospital_capacity_concept_len CHECK (char_length(concept) BETWEEN 1 AND 300),
  CONSTRAINT hospital_capacity_quantity_check CHECK (quantity >= 0),
  CONSTRAINT hospital_capacity_unique UNIQUE (reps_code, group_name, concept)
);
CREATE INDEX IF NOT EXISTS hospital_capacity_hospital_idx ON public.hospital_capacity (hospital_id);

COMMENT ON TABLE public.hospital_capacity IS
  'Fase 3: capacidad instalada del REPS por sede (camas, salas, ambulancias, otros). Cantidades sumadas por (sede, grupo, concepto). Se llena desde /hospitals/import (capacidad).';

-- -------------------------------------------------------------------------------------
-- 3. hospital_import_jobs (token de la simulación; lo usa POST /api/hospitals/import/apply)
-- -------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hospital_import_jobs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind         text NOT NULL,
  mode         text NOT NULL DEFAULT 'replace',
  status       text NOT NULL DEFAULT 'previewed',
  file_name    text NULL,
  file_kind    text NULL,
  file_sha256  text NULL,
  rows         jsonb NULL,
  summary      jsonb NOT NULL DEFAULT '{}'::jsonb,
  result       jsonb NULL,
  error        text NULL,
  created_by   uuid NULL REFERENCES public.users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL DEFAULT (now() + interval '30 minutes'),
  applied_at   timestamptz NULL,
  CONSTRAINT hospital_import_jobs_kind_check CHECK (kind IN ('servicios', 'capacidad')),
  CONSTRAINT hospital_import_jobs_mode_check CHECK (mode IN ('replace', 'merge')),
  CONSTRAINT hospital_import_jobs_status_check CHECK (status IN ('previewed', 'applied', 'failed', 'expired')),
  CONSTRAINT hospital_import_jobs_file_kind_check CHECK (file_kind IS NULL OR file_kind IN ('xlsx', 'xls', 'csv', 'pdf'))
);
CREATE INDEX IF NOT EXISTS hospital_import_jobs_created_idx ON public.hospital_import_jobs (created_by, created_at DESC);
CREATE INDEX IF NOT EXISTS hospital_import_jobs_status_idx ON public.hospital_import_jobs (status, expires_at);

COMMENT ON TABLE public.hospital_import_jobs IS
  'Fase 3: simulaciones de importación del REPS (id = token). Caducan a los 30 min; al aplicar se vacía rows y queda summary/result como auditoría.';

-- -------------------------------------------------------------------------------------
-- 4. hospitals: columnas resumen (aditivas)
-- -------------------------------------------------------------------------------------
ALTER TABLE public.hospitals ADD COLUMN IF NOT EXISTS quirofanos integer NULL;
ALTER TABLE public.hospitals ADD COLUMN IF NOT EXISTS reps_beds integer NULL;
ALTER TABLE public.hospitals ADD COLUMN IF NOT EXISTS service_flags jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.hospitals ADD COLUMN IF NOT EXISTS reps_services_count integer NULL;
ALTER TABLE public.hospitals ADD COLUMN IF NOT EXISTS reps_updated_at timestamptz NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.hospitals'::regclass AND conname = 'hospitals_reps_counts_check') THEN
    ALTER TABLE public.hospitals ADD CONSTRAINT hospitals_reps_counts_check CHECK (
      (quirofanos IS NULL OR quirofanos >= 0)
      AND (reps_beds IS NULL OR reps_beds >= 0)
      AND (reps_services_count IS NULL OR reps_services_count >= 0)
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.hospitals'::regclass AND conname = 'hospitals_service_flags_object') THEN
    ALTER TABLE public.hospitals ADD CONSTRAINT hospitals_service_flags_object CHECK (jsonb_typeof(service_flags) = 'object');
  END IF;
END $$;

COMMENT ON COLUMN public.hospitals.quirofanos IS 'Fase 3: quirófanos según la capacidad instalada del REPS (grupo salas, concepto quirófano / sala de cirugía). NULL = sin dato.';
COMMENT ON COLUMN public.hospitals.reps_beds IS 'Fase 3: total de camas según la capacidad instalada del REPS. No reemplaza a hospitals.beds (dato manual).';
COMMENT ON COLUMN public.hospitals.service_flags IS 'Fase 3: servicios prioritarios habilitados (ortopedia, cirugia_ortopedica, trauma, neurocirugia, columna, medicina_deportiva, cirugia_mano, urgencias, uci_adultos). {} = sin dato del REPS.';
COMMENT ON COLUMN public.hospitals.reps_services_count IS 'Fase 3: número de servicios habilitados distintos en el REPS (sede).';
COMMENT ON COLUMN public.hospitals.reps_updated_at IS 'Fase 3: última importación del REPS que tocó la IPS.';

-- -------------------------------------------------------------------------------------
-- 5. hospital_history: admitir action = 'import' (solo amplía el CHECK existente)
-- -------------------------------------------------------------------------------------
DO $$
DECLARE
  v_def text;
  v_values text[];
  v_list text;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO v_def
  FROM pg_constraint
  WHERE conrelid = 'public.hospital_history'::regclass AND conname = 'hospital_history_action_check';

  IF v_def IS NULL THEN
    -- Sin CHECK: no hay nada que ampliar (cualquier action ya es válida)
    RAISE NOTICE 'hospital_history_action_check no existe: no se crea';
  ELSIF v_def ~ '''import''' THEN
    RAISE NOTICE 'hospital_history_action_check ya admite import';
  ELSE
    SELECT array_agg(DISTINCT m[1] ORDER BY m[1]) INTO v_values
    FROM regexp_matches(v_def, '''([^'']+)''', 'g') AS m;
    v_values := array_append(coalesce(v_values, ARRAY[]::text[]), 'import');
    SELECT string_agg(quote_literal(v), ', ' ORDER BY v) INTO v_list FROM unnest(v_values) AS v;
    EXECUTE 'ALTER TABLE public.hospital_history DROP CONSTRAINT hospital_history_action_check';
    EXECUTE format('ALTER TABLE public.hospital_history ADD CONSTRAINT hospital_history_action_check CHECK (action = ANY (ARRAY[%s]::text[]))', v_list);
    RAISE NOTICE 'hospital_history_action_check ampliado: %', v_list;
  END IF;
END $$;

-- -------------------------------------------------------------------------------------
-- 6. reps_import_apply: aplica una importación en una sola transacción
--    p_payload (lo arma app/api/_lib/reps-import-server.ts):
--      services_upsert  [{reps_code, hospital_id, service_code, service_name, group_name, complexity, modality}]
--      services_delete  [uuid]
--      capacity_upsert  [{reps_code, hospital_id, group_name, concept, quantity}]
--      capacity_delete  [uuid]
--      link_hospital    [{reps_code, hospital_id}]   (enlaza filas ya guardadas de esa sede)
--      hospital_updates [{id, set_services, service_flags, reps_services_count,
--                         set_quirofanos, quirofanos, set_beds, reps_beds}]
--      history          [{hospital_id, changes}]
--      source, reason, result (jsonb que se guarda en el job)
-- -------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reps_import_apply(p_job_id uuid, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_job     public.hospital_import_jobs%ROWTYPE;
  v_now     timestamptz := now();
  v_source  text := coalesce(nullif(p_payload->>'source', ''), 'reps');
  v_reason  text := nullif(p_payload->>'reason', '');
  n_link    integer := 0;
  n_su      integer := 0;
  n_sd      integer := 0;
  n_cu      integer := 0;
  n_cd      integer := 0;
  n_h       integer := 0;
  n_hist    integer := 0;
  n_tmp     integer := 0;
  v_counts  jsonb;
BEGIN
  SELECT * INTO v_job FROM public.hospital_import_jobs WHERE id = p_job_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Importación no encontrada' USING ERRCODE = 'OPM10';
  END IF;
  IF v_job.status <> 'previewed' THEN
    RAISE EXCEPTION 'La importación ya no está disponible (estado %)', v_job.status USING ERRCODE = 'OPM11';
  END IF;
  IF v_job.expires_at < v_now THEN
    RAISE EXCEPTION 'La simulación caducó; vuelve a subir el archivo' USING ERRCODE = 'OPM12';
  END IF;

  -- Enlazar con la IPS las filas ya guardadas de las sedes con cruce
  UPDATE public.hospital_services s SET hospital_id = x.hospital_id
  FROM jsonb_to_recordset(coalesce(p_payload->'link_hospital', '[]'::jsonb)) AS x(reps_code text, hospital_id uuid)
  WHERE s.reps_code = x.reps_code AND s.hospital_id IS DISTINCT FROM x.hospital_id;
  GET DIAGNOSTICS n_link = ROW_COUNT;
  UPDATE public.hospital_capacity c SET hospital_id = x.hospital_id
  FROM jsonb_to_recordset(coalesce(p_payload->'link_hospital', '[]'::jsonb)) AS x(reps_code text, hospital_id uuid)
  WHERE c.reps_code = x.reps_code AND c.hospital_id IS DISTINCT FROM x.hospital_id;
  GET DIAGNOSTICS n_tmp = ROW_COUNT;
  n_link := n_link + n_tmp;

  -- Servicios retirados (antes de insertar: evita conflictos con filas que se reemplazan)
  DELETE FROM public.hospital_services
  WHERE id IN (SELECT value::uuid FROM jsonb_array_elements_text(coalesce(p_payload->'services_delete', '[]'::jsonb)));
  GET DIAGNOSTICS n_sd = ROW_COUNT;

  INSERT INTO public.hospital_services AS s
    (reps_code, hospital_id, service_code, service_name, group_name, complexity, modality, source, imported_at)
  SELECT DISTINCT ON (x.reps_code, x.service_code, coalesce(x.modality, ''))
         x.reps_code, x.hospital_id, x.service_code, x.service_name, x.group_name, x.complexity,
         coalesce(x.modality, ''), v_source, v_now
  FROM jsonb_to_recordset(coalesce(p_payload->'services_upsert', '[]'::jsonb)) AS x(
    reps_code text, hospital_id uuid, service_code text, service_name text, group_name text,
    complexity text, modality text)
  ON CONFLICT (reps_code, service_code, modality) DO UPDATE SET
    hospital_id  = EXCLUDED.hospital_id,
    service_name = EXCLUDED.service_name,
    group_name   = EXCLUDED.group_name,
    complexity   = EXCLUDED.complexity,
    source       = EXCLUDED.source,
    imported_at  = EXCLUDED.imported_at;
  GET DIAGNOSTICS n_su = ROW_COUNT;

  DELETE FROM public.hospital_capacity
  WHERE id IN (SELECT value::uuid FROM jsonb_array_elements_text(coalesce(p_payload->'capacity_delete', '[]'::jsonb)));
  GET DIAGNOSTICS n_cd = ROW_COUNT;

  INSERT INTO public.hospital_capacity AS c
    (reps_code, hospital_id, group_name, concept, quantity, source, imported_at)
  SELECT DISTINCT ON (x.reps_code, x.group_name, x.concept)
         x.reps_code, x.hospital_id, x.group_name, x.concept, x.quantity, v_source, v_now
  FROM jsonb_to_recordset(coalesce(p_payload->'capacity_upsert', '[]'::jsonb)) AS x(
    reps_code text, hospital_id uuid, group_name text, concept text, quantity integer)
  ON CONFLICT (reps_code, group_name, concept) DO UPDATE SET
    hospital_id = EXCLUDED.hospital_id,
    quantity    = EXCLUDED.quantity,
    source      = EXCLUDED.source,
    imported_at = EXCLUDED.imported_at;
  GET DIAGNOSTICS n_cu = ROW_COUNT;

  -- Columnas resumen de hospitals (solo las que la importación sabe calcular)
  UPDATE public.hospitals h SET
    service_flags       = CASE WHEN x.set_services THEN coalesce(x.service_flags, '{}'::jsonb) ELSE h.service_flags END,
    reps_services_count = CASE WHEN x.set_services THEN x.reps_services_count ELSE h.reps_services_count END,
    quirofanos          = CASE WHEN x.set_quirofanos THEN x.quirofanos ELSE h.quirofanos END,
    reps_beds           = CASE WHEN x.set_beds THEN x.reps_beds ELSE h.reps_beds END,
    reps_updated_at     = v_now
  FROM jsonb_to_recordset(coalesce(p_payload->'hospital_updates', '[]'::jsonb)) AS x(
    id uuid, set_services boolean, service_flags jsonb, reps_services_count integer,
    set_quirofanos boolean, quirofanos integer, set_beds boolean, reps_beds integer)
  WHERE h.id = x.id;
  GET DIAGNOSTICS n_h = ROW_COUNT;

  INSERT INTO public.hospital_history (hospital_id, user_id, action, reason, changes, created_by)
  SELECT x.hospital_id, v_job.created_by, 'import', v_reason, x.changes, v_job.created_by
  FROM jsonb_to_recordset(coalesce(p_payload->'history', '[]'::jsonb)) AS x(hospital_id uuid, changes jsonb)
  WHERE x.hospital_id IS NOT NULL;
  GET DIAGNOSTICS n_hist = ROW_COUNT;

  v_counts := jsonb_build_object(
    'linked_rows', n_link,
    'services_upserted', n_su,
    'services_deleted', n_sd,
    'capacity_upserted', n_cu,
    'capacity_deleted', n_cd,
    'hospitals_updated', n_h,
    'history_rows', n_hist
  );

  UPDATE public.hospital_import_jobs SET
    status     = 'applied',
    applied_at = v_now,
    rows       = NULL,
    result     = coalesce(p_payload->'result', '{}'::jsonb) || v_counts
  WHERE id = p_job_id;

  RETURN v_counts;
END;
$$;

COMMENT ON FUNCTION public.reps_import_apply(uuid, jsonb) IS
  'Fase 3: aplica una importación del REPS (servicios o capacidad) en una transacción. Solo service_role. No recalcula asignaciones.';

-- -------------------------------------------------------------------------------------
-- 7. Seguridad: RLS sin políticas, sin privilegios para anon/authenticated/PUBLIC
-- -------------------------------------------------------------------------------------
ALTER TABLE public.hospital_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospital_capacity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospital_import_jobs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.hospital_services, public.hospital_capacity, public.hospital_import_jobs FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hospital_services, public.hospital_capacity, public.hospital_import_jobs TO service_role;

REVOKE ALL ON FUNCTION public.reps_import_apply(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reps_import_apply(uuid, jsonb) TO service_role;

-- -------------------------------------------------------------------------------------
-- 8. Comprobaciones (abortan la transacción si algo no cuadra)
-- -------------------------------------------------------------------------------------
DO $$
DECLARE
  v_cols integer;
  v_policies integer;
  v_bad_privs integer;
  v_def text;
BEGIN
  SELECT count(*) INTO v_cols FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'hospitals'
    AND column_name IN ('quirofanos', 'reps_beds', 'service_flags', 'reps_services_count', 'reps_updated_at');
  IF v_cols <> 5 THEN
    RAISE EXCEPTION 'hospitals: faltan columnas de la Fase 3 (hay %)', v_cols;
  END IF;

  IF (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname IN ('hospital_services', 'hospital_capacity', 'hospital_import_jobs')
        AND c.relrowsecurity) <> 3 THEN
    RAISE EXCEPTION 'RLS no está activado en las 3 tablas de la Fase 3';
  END IF;

  SELECT count(*) INTO v_policies FROM pg_policies
  WHERE schemaname = 'public' AND tablename IN ('hospital_services', 'hospital_capacity', 'hospital_import_jobs');
  IF v_policies <> 0 THEN
    RAISE EXCEPTION 'Las tablas de la Fase 3 no deben tener políticas (hay %)', v_policies;
  END IF;

  SELECT count(*) INTO v_bad_privs
  FROM unnest(ARRAY['hospital_services', 'hospital_capacity', 'hospital_import_jobs']) AS t(name),
       unnest(ARRAY['anon', 'authenticated']) AS r(role),
       unnest(ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) AS p(priv)
  WHERE has_table_privilege(r.role, 'public.' || t.name, p.priv);
  IF v_bad_privs <> 0 THEN
    RAISE EXCEPTION 'anon/authenticated tienen % privilegios sobre las tablas de la Fase 3', v_bad_privs;
  END IF;

  IF has_function_privilege('anon', 'public.reps_import_apply(uuid, jsonb)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.reps_import_apply(uuid, jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'reps_import_apply no debe ser ejecutable por anon/authenticated';
  END IF;
  IF NOT has_function_privilege('service_role', 'public.reps_import_apply(uuid, jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'service_role debe poder ejecutar reps_import_apply';
  END IF;

  SELECT pg_get_constraintdef(oid) INTO v_def FROM pg_constraint
  WHERE conrelid = 'public.hospital_history'::regclass AND conname = 'hospital_history_action_check';
  IF v_def IS NOT NULL AND v_def !~ '''import''' THEN
    RAISE EXCEPTION 'hospital_history_action_check no admite import: %', v_def;
  END IF;
  IF v_def IS NOT NULL AND (v_def !~ '''activated''' OR v_def !~ '''deactivated''' OR v_def !~ '''edited''') THEN
    RAISE EXCEPTION 'hospital_history_action_check perdió algún valor anterior: %', v_def;
  END IF;

  RAISE NOTICE 'Fase 3 servicios OK: 3 tablas con RLS, 0 políticas, 0 privilegios para anon/authenticated, 5 columnas en hospitals, hospital_history admite import, reps_import_apply solo service_role.';
END $$;

COMMIT;
