-- =====================================================================================
-- OpMap · Fase 3 (D3: servicios y capacidad del REPS) · 9930 — ROLLBACK de 0620
-- Proyecto: norvxqgohddgsdkggqzq · Generado: 2026-10-11
--
-- Deshace 2026-10-11_0620_fase3_servicios.sql:
--   - Borra reps_import_apply(uuid, jsonb).
--   - Borra hospital_services, hospital_capacity y hospital_import_jobs (CON SUS DATOS: lo
--     importado del REPS se pierde; se puede volver a importar desde los archivos del REPS).
--   - Quita de hospitals las columnas quirofanos, reps_beds, service_flags,
--     reps_services_count y reps_updated_at (y sus CHECK).
--   - hospital_history: las filas con action = 'import' se conservan como auditoría pero pasan a
--     action = 'edited' con changes.original_action = 'import' (no tienen changes.zone_fields,
--     así que la cola de pendientes las ignora); luego se quita 'import' del CHECK, conservando
--     cualquier otro valor que admita.
--
-- Orden de despliegue: primero volver a desplegar el código anterior a la Fase 3 (servicios)
-- (sin las columnas fallan /api/hospitals/import/** y el filtro IPS del mapa); luego este script.
-- Independiente de los rollbacks de D1 (_reps) y D2 (_adres) salvo por el CHECK de
-- hospital_history, que aquí solo pierde 'import'.
-- Transaccional: todo o nada.
-- =====================================================================================

BEGIN;

DROP FUNCTION IF EXISTS public.reps_import_apply(uuid, jsonb);

DROP TABLE IF EXISTS public.hospital_import_jobs;
DROP TABLE IF EXISTS public.hospital_capacity;
DROP TABLE IF EXISTS public.hospital_services;

ALTER TABLE public.hospitals DROP CONSTRAINT IF EXISTS hospitals_reps_counts_check;
ALTER TABLE public.hospitals DROP CONSTRAINT IF EXISTS hospitals_service_flags_object;
ALTER TABLE public.hospitals DROP COLUMN IF EXISTS quirofanos;
ALTER TABLE public.hospitals DROP COLUMN IF EXISTS reps_beds;
ALTER TABLE public.hospitals DROP COLUMN IF EXISTS service_flags;
ALTER TABLE public.hospitals DROP COLUMN IF EXISTS reps_services_count;
ALTER TABLE public.hospitals DROP COLUMN IF EXISTS reps_updated_at;

DO $$
DECLARE
  v_def text;
  v_values text[];
  v_list text;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO v_def
  FROM pg_constraint
  WHERE conrelid = 'public.hospital_history'::regclass AND conname = 'hospital_history_action_check';

  -- Primero las filas: si no, el CHECK sin 'import' no se podría crear
  UPDATE public.hospital_history
  SET action = 'edited',
      changes = coalesce(changes, '{}'::jsonb) || jsonb_build_object('original_action', 'import')
  WHERE action = 'import';

  IF v_def IS NOT NULL AND v_def ~ '''import''' THEN
    SELECT array_agg(DISTINCT m[1] ORDER BY m[1]) INTO v_values
    FROM regexp_matches(v_def, '''([^'']+)''', 'g') AS m;
    v_values := array_remove(v_values, 'import');
    SELECT string_agg(quote_literal(v), ', ' ORDER BY v) INTO v_list FROM unnest(v_values) AS v;
    EXECUTE 'ALTER TABLE public.hospital_history DROP CONSTRAINT hospital_history_action_check';
    EXECUTE format('ALTER TABLE public.hospital_history ADD CONSTRAINT hospital_history_action_check CHECK (action = ANY (ARRAY[%s]::text[]))', v_list);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'hospitals'
             AND column_name IN ('quirofanos', 'reps_beds', 'service_flags', 'reps_services_count', 'reps_updated_at')) THEN
    RAISE EXCEPTION 'Quedan columnas de la Fase 3 en hospitals';
  END IF;
  IF to_regclass('public.hospital_services') IS NOT NULL OR to_regclass('public.hospital_capacity') IS NOT NULL
     OR to_regclass('public.hospital_import_jobs') IS NOT NULL THEN
    RAISE EXCEPTION 'Quedan tablas de la Fase 3';
  END IF;
  RAISE NOTICE 'Rollback Fase 3 servicios OK.';
END $$;

COMMIT;
