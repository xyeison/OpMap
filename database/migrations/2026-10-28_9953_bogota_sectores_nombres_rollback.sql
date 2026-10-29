-- =====================================================================================
-- OpMap · Rollback de 0902 (2026-10-28_0902_bogota_sectores_nombres.sql)
-- Proyecto: norvxqgohddgsdkggqzq · Generado: 2026-10-28
--
-- Vuelve al estado de antes de los sectores, en una sola transacción:
--   0. Si se aplicó la 0903 (Bogotá Norte con punto base en Usaquén), aborta: primero va su rollback 9954.
--   1. Los nombres de las 4 Zonas de Bogotá vuelven a los del respaldo (Chapinero, Engativá, Kennedy, San Cristóbal);
--      solo el nombre (la 0902 no tocó nada más).
--   2. assignments y municipality_zone se reemplazan por sus respaldos _sectores (sin la columna respaldado_en).
--   3. Los respaldos NO se borran (se borran a mano cuando el dueño dé por bueno el resultado).
--
-- OJO: el motor desplegado reparte Bogotá por sectores; si alguien vuelve a recalcular después de este rollback, las
-- IPS de Bogotá vuelven a ir por sector. Para volver del todo hay que revertir también el código (PR de
-- feat/bogota-4-sectores).
-- =====================================================================================

BEGIN;

DO $$
DECLARE
  respaldo text;
  tiene_filas boolean;
BEGIN
  -- Con EXECUTE: un SELECT directo sobre una tabla que no existe falla al planear
  FOREACH respaldo IN ARRAY ARRAY['assignments_respaldo_20261028_sectores', 'municipality_zone_respaldo_20261028_sectores', 'kams_nombres_respaldo_20261028'] LOOP
    IF to_regclass('public.' || respaldo) IS NULL THEN
      RAISE EXCEPTION '9953: no existe % (¿se aplicó la 0902?)', respaldo;
    END IF;
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I)', respaldo) INTO tiene_filas;
    IF NOT tiene_filas THEN
      RAISE EXCEPTION '9953: % está vacío', respaldo;
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM public.kams WHERE name = 'Bogotá Norte' AND area_id <> '1100102') THEN
    RAISE EXCEPTION '9953: Bogotá Norte tiene el punto base en Usaquén (0903): aplica antes su rollback 9954';
  END IF;
END $$;

UPDATE public.kams k SET name = r.name
  FROM public.kams_nombres_respaldo_20261028 r
  WHERE r.id = k.id;

DELETE FROM public.assignments;
INSERT INTO public.assignments (id, kam_id, hospital_id, travel_time, assignment_type, assigned_at, is_base_territory, detail)
  SELECT id, kam_id, hospital_id, travel_time, assignment_type, assigned_at, is_base_territory, detail
  FROM public.assignments_respaldo_20261028_sectores;

DELETE FROM public.municipality_zone;
INSERT INTO public.municipality_zone (municipality_code, kam_id, kind, travel_minutes, nearest_kam_id, nearest_minutes, ips_count, computed_at)
  SELECT municipality_code, kam_id, kind, travel_minutes, nearest_kam_id, nearest_minutes, ips_count, computed_at
  FROM public.municipality_zone_respaldo_20261028_sectores;

DO $$
BEGIN
  IF (SELECT count(*) FROM public.assignments) <> (SELECT count(*) FROM public.assignments_respaldo_20261028_sectores)
     OR (SELECT count(*) FROM public.municipality_zone) <> (SELECT count(*) FROM public.municipality_zone_respaldo_20261028_sectores) THEN
    RAISE EXCEPTION '9953: la restauración no cuadra con los respaldos';
  END IF;
  RAISE NOTICE '9953: nombres, assignments y municipality_zone restaurados desde los respaldos del 2026-10-28 (sectores)';
END $$;

COMMIT;
