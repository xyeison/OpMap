-- =====================================================================================
-- OpMap · Fase 3 (giros directos de la ADRES) · 9930 — Rollback de 0610
-- Proyecto: norvxqgohddgsdkggqzq · Generado: 2026-10-11
--
-- ANTES DE EJECUTAR: volver a desplegar el código anterior a la Fase 3 ADRES. La página
--   /inteligencia, GET /api/intelligence/giros(/hospital/[id]) y la tarjeta "Giros ADRES" de la
--   ficha de IPS consultan estas tablas y la función; tras el rollback fallarían (la tarjeta
--   muestra el error, el resto de la ficha sigue funcionando).
--
-- Qué deshace (una sola transacción, todo o nada):
--   1. Borra la función public.adres_giros_resumen(date, date, text).
--   2. Borra adres_giros y adres_fetch_log con todos sus datos.
--
-- PÉRDIDAS: solo datos descargados de la ADRES (públicos). Se recuperan volviendo a aplicar 0610
--   y corriendo otra vez `cd web && node scripts/adres-giros.mjs` (unos minutos, sin costo).
--
-- Orden respecto a otros rollbacks: independiente (las tablas no tienen FKs hacia ni desde
--   otras tablas).
-- Re-ejecutable: sí (IF EXISTS).
-- =====================================================================================

BEGIN;

DO $$
DECLARE
  n_giros bigint := 0;
  n_log   bigint := 0;
BEGIN
  IF to_regclass('public.adres_giros') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.adres_giros' INTO n_giros;
  END IF;
  IF to_regclass('public.adres_fetch_log') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.adres_fetch_log' INTO n_log;
  END IF;
  RAISE NOTICE 'Rollback Fase 3 ADRES: se borran % fila(s) de adres_giros y % de adres_fetch_log', n_giros, n_log;
END;
$$;

DROP FUNCTION IF EXISTS public.adres_giros_resumen(date, date, text);
DROP TABLE IF EXISTS public.adres_giros;
DROP TABLE IF EXISTS public.adres_fetch_log;

DO $$
BEGIN
  IF to_regclass('public.adres_giros') IS NOT NULL OR to_regclass('public.adres_fetch_log') IS NOT NULL THEN
    RAISE EXCEPTION 'Rollback Fase 3 ADRES: alguna tabla sigue existiendo';
  END IF;
  IF to_regprocedure('public.adres_giros_resumen(date, date, text)') IS NOT NULL THEN
    RAISE EXCEPTION 'Rollback Fase 3 ADRES: la función adres_giros_resumen sigue existiendo';
  END IF;
  RAISE NOTICE 'Rollback Fase 3 ADRES OK: tablas y función borradas.';
END;
$$;

COMMIT;
