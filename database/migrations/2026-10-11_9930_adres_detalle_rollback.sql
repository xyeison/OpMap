-- =====================================================================================
-- OpMap · Giros ADRES "Identifica tu Giro" · 9930 — Rollback de 0630
-- Proyecto: norvxqgohddgsdkggqzq · Generado: 2026-10-11
--
-- ANTES DE EJECUTAR: volver a desplegar el código anterior a "Identifica tu Giro". GET
--   /api/intelligence/giros usa adres_giros_intel() (sin ella responde 503 con mensaje claro) y la
--   tarjeta "Giros ADRES" de la ficha lee adres_giros_mensual (sin ella vuelve al Reporte 29).
--
-- Qué deshace (una sola transacción, todo o nada):
--   1. Borra la función public.adres_giros_intel(text, date, date, text).
--   2. Borra la vista public.adres_giros_mensual.
--   3. Borra la tabla public.adres_giros_detalle con todos sus datos.
--   4. Borra de adres_fetch_log SOLO las filas de esta fuente (fuente = 'adres_identifica_giro');
--      las del Reporte 29 se conservan.
--
-- NO toca adres_giros, adres_fetch_log del Reporte 29 ni adres_giros_resumen() (migración 0610).
-- PÉRDIDAS: solo datos públicos descargados de la ADRES. Se recuperan volviendo a aplicar 0630 y
--   corriendo `cd web && node scripts/adres-identifica-giro.mjs` (sin costo).
--
-- Orden respecto a otros rollbacks: va ANTES de 2026-10-11_9930_adres_rollback.sql (0610) si se
--   deshacen los dos: adres_giros_intel() lee adres_giros. Independiente del resto.
-- Re-ejecutable: sí (IF EXISTS).
-- =====================================================================================

BEGIN;

DO $$
DECLARE
  n_detalle bigint := 0;
  n_log     bigint := 0;
BEGIN
  IF to_regclass('public.adres_giros_detalle') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.adres_giros_detalle' INTO n_detalle;
  END IF;
  IF to_regclass('public.adres_fetch_log') IS NOT NULL THEN
    EXECUTE $q$SELECT count(*) FROM public.adres_fetch_log WHERE fuente = 'adres_identifica_giro'$q$ INTO n_log;
  END IF;
  RAISE NOTICE 'Rollback ADRES 0630: se borran % fila(s) de adres_giros_detalle y % de adres_fetch_log (fuente adres_identifica_giro)', n_detalle, n_log;
END;
$$;

DROP FUNCTION IF EXISTS public.adres_giros_intel(text, date, date, text);
DROP VIEW IF EXISTS public.adres_giros_mensual;
DROP TABLE IF EXISTS public.adres_giros_detalle;

DO $$
BEGIN
  IF to_regclass('public.adres_fetch_log') IS NOT NULL THEN
    DELETE FROM public.adres_fetch_log WHERE fuente = 'adres_identifica_giro';
  END IF;
  IF to_regclass('public.adres_giros_detalle') IS NOT NULL OR to_regclass('public.adres_giros_mensual') IS NOT NULL THEN
    RAISE EXCEPTION 'Rollback ADRES 0630: la tabla o la vista siguen existiendo';
  END IF;
  IF to_regprocedure('public.adres_giros_intel(text, date, date, text)') IS NOT NULL THEN
    RAISE EXCEPTION 'Rollback ADRES 0630: la función adres_giros_intel sigue existiendo';
  END IF;
  RAISE NOTICE 'Rollback ADRES 0630 OK: tabla, vista y función borradas; bitácora de Identifica tu Giro limpiada.';
END;
$$;

COMMIT;
