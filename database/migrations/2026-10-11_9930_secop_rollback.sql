-- =====================================================================================
-- OpMap · PR 7 (compras públicas SECOP y fuentes de datos automáticas) · 9930 — Rollback de 0710
-- Proyecto: norvxqgohddgsdkggqzq · Generado: 2026-10-11
--
-- ANTES DE EJECUTAR: volver a desplegar el código anterior al PR 7 (las rutas /api/secop/*, /api/fuentes/*
--   y /api/cron/* consultan estas tablas; tras el rollback responderían 503) y quitar los "crons" de
--   web/vercel.json (si no, Vercel seguiría llamando a /api/cron/* cada día).
--
-- Qué deshace (una sola transacción, todo o nada): borra la vista secop_contratos_unicos, las funciones
--   secop_nits_ips() y secop_marcar_atipicos(), y las tablas secop_contratos, secop_proveedores_vigilados,
--   secop_ajustes y fuentes_estado con todos sus datos. No toca hospitals ni ninguna otra tabla.
--
-- PÉRDIDAS:
--   - Contratos descargados de SECOP (datos públicos; se recuperan re-aplicando 0710 y corriendo
--     scripts/secop-load.ts, minutos y sin costo).
--   - La sal de secop_ajustes: al re-aplicar 0710 se genera otra, así que los proveedor_hash nuevos no
--     coinciden con los viejos (da igual: los contratos también se recargan).
--   - Los proveedores vigilados añadidos a mano (origen 'manual') y las notas: exportarlos antes si importan.
--   - El historial de fuentes_estado (último OK, cursores). Las tablas cargadas por esas fuentes (BDUA,
--     cifras, REPS, ADRES) NO se tocan.
--
-- Orden respecto a otros rollbacks: independiente (secop_contratos tiene FKs HACIA hospitals y hacia
--   secop_proveedores_vigilados, que se van con la tabla; nada apunta a estas tablas).
-- Re-ejecutable: sí (IF EXISTS).
-- =====================================================================================

BEGIN;

DO $$
DECLARE
  t text;
  n bigint;
BEGIN
  FOREACH t IN ARRAY ARRAY['secop_contratos', 'secop_proveedores_vigilados', 'secop_ajustes', 'fuentes_estado'] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('SELECT count(*) FROM public.%I', t) INTO n;
      RAISE NOTICE 'Rollback PR 7 SECOP: se borran % fila(s) de %', n, t;
    END IF;
  END LOOP;
END;
$$;

DROP VIEW IF EXISTS public.secop_contratos_unicos;
DROP FUNCTION IF EXISTS public.secop_marcar_atipicos(numeric, integer);
DROP FUNCTION IF EXISTS public.secop_nits_ips();
DROP TABLE IF EXISTS public.secop_contratos;
DROP TABLE IF EXISTS public.secop_proveedores_vigilados;
DROP TABLE IF EXISTS public.secop_ajustes;
DROP TABLE IF EXISTS public.fuentes_estado;

DO $$
BEGIN
  IF to_regclass('public.secop_contratos') IS NOT NULL
     OR to_regclass('public.secop_proveedores_vigilados') IS NOT NULL
     OR to_regclass('public.secop_ajustes') IS NOT NULL
     OR to_regclass('public.fuentes_estado') IS NOT NULL
     OR to_regclass('public.secop_contratos_unicos') IS NOT NULL THEN
    RAISE EXCEPTION 'Rollback PR 7 SECOP: algún objeto sigue existiendo';
  END IF;
  RAISE NOTICE 'Rollback PR 7 SECOP OK: 4 tablas, 1 vista y 2 funciones borradas.';
END;
$$;

COMMIT;
