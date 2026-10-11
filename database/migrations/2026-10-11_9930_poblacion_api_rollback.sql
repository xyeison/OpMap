-- =====================================================================================
-- OpMap · Fase 4 (población) · 9930 — Rollback de 0660 (funciones de lectura de la API)
-- Proyecto: norvxqgohddgsdkggqzq · Generado: 2026-10-11
--
-- ANTES DE EJECUTAR: GET /api/intelligence/poblacion y GET /api/intelligence/poblacion/hospital/[id]
--   llaman a estas funciones. Sin ellas responden igual, pero sin la BDUA (afiliados por régimen solo
--   de afiliacion_cifras, sin EPS dominantes) y con el corte más reciente que encuentren paginando.
--
-- Qué deshace: borra poblacion_cortes() y poblacion_bdua_resumen(date, integer). No toca ninguna
--   tabla ni dato.
-- Orden respecto a otros rollbacks: va ANTES del rollback de 0640 (2026-10-11_9930_poblacion_rollback.sql)
--   si se deshacen los dos; si 0640 ya no está, este script igual funciona (DROP IF EXISTS).
-- Re-ejecutable: sí.
-- =====================================================================================

BEGIN;

DROP FUNCTION IF EXISTS public.poblacion_bdua_resumen(date, integer);
DROP FUNCTION IF EXISTS public.poblacion_cortes();

DO $$
BEGIN
  IF to_regprocedure('public.poblacion_bdua_resumen(date, integer)') IS NOT NULL
     OR to_regprocedure('public.poblacion_cortes()') IS NOT NULL THEN
    RAISE EXCEPTION 'Rollback 0660: las funciones siguen existiendo';
  END IF;
  RAISE NOTICE 'Rollback 0660 OK: poblacion_cortes() y poblacion_bdua_resumen() eliminadas.';
END;
$$;

COMMIT;
