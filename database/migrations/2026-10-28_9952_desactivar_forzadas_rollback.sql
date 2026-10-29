-- =====================================================================================
-- OpMap · Rollback de 0901 (2026-10-28_0901_desactivar_forzadas.sql)
-- Proyecto: norvxqgohddgsdkggqzq · Generado: 2026-10-28
--
-- 1. Devuelve a cada asignación forzada el campo active que tenía en el respaldo.
-- 2. Devuelve los tiempos de las celdas de Bogotá a las IPS de Meta y Casanare a los valores respaldados (los del
--    2025-08-07), deshaciendo el refresco con Google.
-- No borra los respaldos. Después hay que recalcular IPS y municipios para que el mapa lo refleje.
-- =====================================================================================

BEGIN;

DO $$
DECLARE
  respaldo text;
  tiene_filas boolean;
BEGIN
  FOREACH respaldo IN ARRAY ARRAY['forced_assignments_respaldo_20261028', 'hospital_kam_distances_respaldo_20261028'] LOOP
    IF to_regclass('public.' || respaldo) IS NULL THEN
      RAISE EXCEPTION '9952: no existe % (¿se aplicó la 0901?)', respaldo;
    END IF;
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I)', respaldo) INTO tiene_filas;
    IF NOT tiene_filas THEN
      RAISE EXCEPTION '9952: % está vacío', respaldo;
    END IF;
  END LOOP;
END $$;

UPDATE public.forced_assignments f SET active = r.active
  FROM public.forced_assignments_respaldo_20261028 r
  WHERE r.id = f.id AND f.active IS DISTINCT FROM r.active;

UPDATE public.hospital_kam_distances d
  SET travel_time = r.travel_time, distance = r.distance, source = r.source,
      calculated_at = r.calculated_at, updated_at = r.updated_at
  FROM public.hospital_kam_distances_respaldo_20261028 r
  WHERE r.hospital_id = d.hospital_id AND r.kam_id = d.kam_id;

DO $$
BEGIN
  RAISE NOTICE '9952: % asignaciones forzadas activas otra vez; tiempos de Bogotá a Meta y Casanare restaurados',
    (SELECT count(*) FROM public.forced_assignments WHERE active);
END $$;

COMMIT;
