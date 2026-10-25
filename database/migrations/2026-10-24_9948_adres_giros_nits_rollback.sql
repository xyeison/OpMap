-- =====================================================================================
-- OpMap · feat/mapa-giros-compras (giros ADRES y compras SECOP de 12 meses en el mapa) · 9948 — Rollback de 0880
-- Proyecto: norvxqgohddgsdkggqzq · Generado: 2026-10-24
--
-- Qué deshace (una sola transacción, todo o nada):
--   1. La función public.adres_giros_nits(date, date, text[]) (su comentario y sus privilegios se van con ella).
--   NO toca adres_giros_detalle, adres_giros_intel ni ninguna tabla: la 0880 no cargó datos.
--
-- PÉRDIDAS: ninguna. Las tarjetas del mapa siguen funcionando sin redesplegar: loadGirosNits
--   (web/app/api/intelligence/_lib/giros-server.ts) detecta que la función no existe y usa adres_giros_intel filtrado por
--   NIT (misma suma; ≈740 ms y 1,5 MB por clic en vez de ≈1 ms).
--
-- Re-ejecutable: sí (IF EXISTS). Tras aplicar: NOTIFY pgrst, 'reload schema';
-- =====================================================================================

BEGIN;

-- -------------------------------------------------------------------------------------
-- 0. Aviso
-- -------------------------------------------------------------------------------------

DO $$
BEGIN
  IF to_regprocedure('public.adres_giros_nits(date, date, text[])') IS NULL THEN
    RAISE NOTICE 'Rollback 0880: public.adres_giros_nits no existe; nada que borrar';
  ELSE
    RAISE NOTICE 'Rollback 0880: se borra public.adres_giros_nits(date, date, text[]); el mapa vuelve al respaldo adres_giros_intel sin redesplegar';
  END IF;
END;
$$;

-- -------------------------------------------------------------------------------------
-- 1. Función (sin CASCADE: si algo más dependiera de ella, aborta)
-- -------------------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.adres_giros_nits(date, date, text[]);

-- -------------------------------------------------------------------------------------
-- 2. Comprobación: no queda nada de 0880
-- -------------------------------------------------------------------------------------

DO $$
BEGIN
  IF to_regprocedure('public.adres_giros_nits(date, date, text[])') IS NOT NULL THEN
    RAISE EXCEPTION 'Rollback 0880: sigue existiendo public.adres_giros_nits(date, date, text[])';
  END IF;
  RAISE NOTICE 'Rollback 0880 OK: sin adres_giros_nits. SIGUIENTE PASO: NOTIFY pgrst, ''reload schema''.';
END;
$$;

COMMIT;
