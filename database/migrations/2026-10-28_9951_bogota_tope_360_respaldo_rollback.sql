-- =====================================================================================
-- OpMap · Rollback de 0900 (2026-10-28_0900_bogota_tope_360_respaldo.sql)
-- Proyecto: norvxqgohddgsdkggqzq · Generado: 2026-10-28
--
-- Vuelve al estado de antes del recálculo del 2026-10-28, en una sola transacción:
--   1. bogota_config.max_travel_minutes = 240.
--   2. assignments y municipality_zone se reemplazan por sus respaldos (sin la columna respaldado_en).
--   3. Los respaldos NO se borran (se borran a mano cuando el dueño dé por bueno el resultado).
--
-- OJO: el motor de municipios desplegado ya aplica la regla de Bogotá; si alguien vuelve a correr
-- "Calcular rutas y asignar pendientes" o el recálculo de municipios después de este rollback, el resultado
-- vuelve a seguir los corredores (con tope 240). Para volver del todo al comportamiento anterior hay que revertir
-- también el código (PR de fix/municipios-regla-bogota).
-- =====================================================================================

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.assignments_respaldo_20261028') IS NULL
     OR NOT EXISTS (SELECT 1 FROM public.assignments_respaldo_20261028) THEN
    RAISE EXCEPTION '9951: no hay respaldo de assignments (¿se aplicó la 0900?)';
  END IF;
  IF to_regclass('public.municipality_zone_respaldo_20261028') IS NULL
     OR NOT EXISTS (SELECT 1 FROM public.municipality_zone_respaldo_20261028) THEN
    RAISE EXCEPTION '9951: no hay respaldo de municipality_zone (¿se aplicó la 0900?)';
  END IF;
END $$;

UPDATE public.bogota_config SET max_travel_minutes = 240 WHERE id = 1;

DELETE FROM public.assignments;
INSERT INTO public.assignments (id, kam_id, hospital_id, travel_time, assignment_type, assigned_at, is_base_territory, detail)
  SELECT id, kam_id, hospital_id, travel_time, assignment_type, assigned_at, is_base_territory, detail
  FROM public.assignments_respaldo_20261028;

DELETE FROM public.municipality_zone;
INSERT INTO public.municipality_zone (municipality_code, kam_id, kind, travel_minutes, nearest_kam_id, nearest_minutes, ips_count, computed_at)
  SELECT municipality_code, kam_id, kind, travel_minutes, nearest_kam_id, nearest_minutes, ips_count, computed_at
  FROM public.municipality_zone_respaldo_20261028;

DO $$
BEGIN
  IF (SELECT count(*) FROM public.assignments) <> (SELECT count(*) FROM public.assignments_respaldo_20261028)
     OR (SELECT count(*) FROM public.municipality_zone) <> (SELECT count(*) FROM public.municipality_zone_respaldo_20261028) THEN
    RAISE EXCEPTION '9951: la restauración no cuadra con los respaldos';
  END IF;
  RAISE NOTICE '9951: tope de Bogotá en 240; assignments y municipality_zone restaurados desde los respaldos del 2026-10-28';
END $$;

COMMIT;
