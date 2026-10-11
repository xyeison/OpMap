-- =====================================================================================
-- OpMap · PR 7 (compras públicas SECOP) · 9929 — Rollback de 0720
-- Proyecto: norvxqgohddgsdkggqzq · Generado: 2026-10-11
--
-- Qué deshace: borra la función secop_hechos(). No toca tablas ni datos.
-- Sin la función la API sigue respondiendo: app/api/secop/_lib/secop-server.ts vuelve a leer contrato por
--   contrato desde secop_contratos_unicos (más lento con el histórico completo).
-- Orden: ANTES de 2026-10-11_9930_secop_rollback.sql si se deshacen los dos.
-- Re-ejecutable: sí (IF EXISTS).
-- =====================================================================================

BEGIN;

DROP FUNCTION IF EXISTS public.secop_hechos(date, date, text[], text[]);

DO $$
BEGIN
  IF to_regprocedure('public.secop_hechos(date, date, text[], text[])') IS NOT NULL THEN
    RAISE EXCEPTION 'Rollback 0720: secop_hechos() sigue existiendo';
  END IF;
  RAISE NOTICE 'Rollback 0720 OK: secop_hechos() eliminada.';
END;
$$;

COMMIT;
