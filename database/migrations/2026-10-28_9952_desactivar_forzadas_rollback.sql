-- =====================================================================================
-- OpMap · Rollback de 0901 (2026-10-28_0901_desactivar_forzadas.sql)
-- Proyecto: norvxqgohddgsdkggqzq · Generado: 2026-10-28
--
-- Devuelve a cada asignación forzada el campo active que tenía en el respaldo. No borra el respaldo. Después hay
-- que recalcular IPS y municipios para que el mapa vuelva a mostrarlas.
-- =====================================================================================

BEGIN;

DO $$
DECLARE
  tiene_filas boolean;
BEGIN
  IF to_regclass('public.forced_assignments_respaldo_20261028') IS NULL THEN
    RAISE EXCEPTION '9952: no existe forced_assignments_respaldo_20261028 (¿se aplicó la 0901?)';
  END IF;
  EXECUTE 'SELECT EXISTS (SELECT 1 FROM public.forced_assignments_respaldo_20261028)' INTO tiene_filas;
  IF NOT tiene_filas THEN
    RAISE EXCEPTION '9952: forced_assignments_respaldo_20261028 está vacío';
  END IF;
END $$;

UPDATE public.forced_assignments f SET active = r.active
  FROM public.forced_assignments_respaldo_20261028 r
  WHERE r.id = f.id AND f.active IS DISTINCT FROM r.active;

DO $$
BEGIN
  RAISE NOTICE '9952: % asignaciones forzadas activas otra vez',
    (SELECT count(*) FROM public.forced_assignments WHERE active);
END $$;

COMMIT;
