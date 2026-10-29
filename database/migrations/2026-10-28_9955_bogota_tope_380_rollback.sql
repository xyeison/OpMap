-- =====================================================================================
-- OpMap · Rollback de 0904 (2026-10-28_0904_bogota_tope_380.sql)
-- Proyecto: norvxqgohddgsdkggqzq · Generado: 2026-10-28
--
-- Vuelve al tope de 360 min y al reparto de antes, en una sola transacción:
--   1. bogota_config.max_travel_minutes = 360.
--   2. assignments y municipality_zone se reemplazan por sus respaldos _tope380 (sin la columna respaldado_en).
--   3. Los respaldos NO se borran (se borran a mano cuando el dueño dé por bueno el resultado).
-- =====================================================================================

BEGIN;

DO $$
DECLARE
  respaldo text;
  tiene_filas boolean;
BEGIN
  -- Con EXECUTE: un SELECT directo sobre una tabla que no existe falla al planear
  FOREACH respaldo IN ARRAY ARRAY['assignments_respaldo_20261028_tope380', 'municipality_zone_respaldo_20261028_tope380'] LOOP
    IF to_regclass('public.' || respaldo) IS NULL THEN
      RAISE EXCEPTION '9955: no existe % (¿se aplicó la 0904?)', respaldo;
    END IF;
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I)', respaldo) INTO tiene_filas;
    IF NOT tiene_filas THEN
      RAISE EXCEPTION '9955: % está vacío', respaldo;
    END IF;
  END LOOP;
END $$;

UPDATE public.bogota_config SET max_travel_minutes = 360 WHERE id = 1;

DELETE FROM public.assignments;
INSERT INTO public.assignments (id, kam_id, hospital_id, travel_time, assignment_type, assigned_at, is_base_territory, detail)
  SELECT id, kam_id, hospital_id, travel_time, assignment_type, assigned_at, is_base_territory, detail
  FROM public.assignments_respaldo_20261028_tope380;

DELETE FROM public.municipality_zone;
INSERT INTO public.municipality_zone (municipality_code, kam_id, kind, travel_minutes, nearest_kam_id, nearest_minutes, ips_count, computed_at)
  SELECT municipality_code, kam_id, kind, travel_minutes, nearest_kam_id, nearest_minutes, ips_count, computed_at
  FROM public.municipality_zone_respaldo_20261028_tope380;

DO $$
BEGIN
  IF (SELECT count(*) FROM public.assignments) <> (SELECT count(*) FROM public.assignments_respaldo_20261028_tope380)
     OR (SELECT count(*) FROM public.municipality_zone) <> (SELECT count(*) FROM public.municipality_zone_respaldo_20261028_tope380) THEN
    RAISE EXCEPTION '9955: la restauración no cuadra con los respaldos';
  END IF;
  RAISE NOTICE '9955: tope de Bogotá en 360; assignments y municipality_zone restaurados desde los respaldos _tope380';
END $$;

COMMIT;
