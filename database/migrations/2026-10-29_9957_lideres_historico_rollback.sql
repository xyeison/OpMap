-- =====================================================================================
-- OpMap · feat/lideres-seguimiento · 9957 — Rollback de 0920 (histórico del Excel "Tracker Líderes")
-- Proyecto: norvxqgohddgsdkggqzq · Generado: 2026-10-29
--
-- Qué hace: quita la función lideres_historico_reemplazar y las tablas lideres_historico y lideres_historico_cargas.
-- PÉRDIDAS: la copia del Excel que haya en OpMap (se avisa cuántas filas y cargas). La fuente sigue siendo el archivo
--   de la directora: se puede volver a cargar después de aplicar otra vez la 0920.
-- Re-ejecutable: sí (IF EXISTS en todo). Después: NOTIFY pgrst, 'reload schema';
-- =====================================================================================

BEGIN;

DO $$
DECLARE
  v_filas  bigint := 0;
  v_cargas bigint := 0;
BEGIN
  IF to_regclass('public.lideres_historico') IS NOT NULL THEN
    SELECT count(*) INTO v_filas FROM public.lideres_historico;
  END IF;
  IF to_regclass('public.lideres_historico_cargas') IS NOT NULL THEN
    SELECT count(*) INTO v_cargas FROM public.lideres_historico_cargas;
  END IF;
  RAISE NOTICE 'Rollback 0920: se quitan % fila(s) del histórico y % carga(s); el Excel sigue siendo la fuente.', v_filas, v_cargas;
END;
$$;

DROP FUNCTION IF EXISTS public.lideres_historico_reemplazar(jsonb, jsonb, uuid);
DROP TABLE IF EXISTS public.lideres_historico;
DROP TABLE IF EXISTS public.lideres_historico_cargas;

DO $$
BEGIN
  IF to_regclass('public.lideres_historico') IS NOT NULL OR to_regclass('public.lideres_historico_cargas') IS NOT NULL
     OR to_regprocedure('public.lideres_historico_reemplazar(jsonb, jsonb, uuid)') IS NOT NULL THEN
    RAISE EXCEPTION 'Rollback 0920: quedaron objetos de la 0920';
  END IF;
  RAISE NOTICE 'Rollback 0920 OK: sin lideres_historico, su bitácora ni su función.';
END;
$$;

COMMIT;
