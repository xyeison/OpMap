-- =====================================================================================
-- OpMap · Fase 2b (municipios y anexos de territorio) · 9920 — Rollback de 0500
-- Proyecto: norvxqgohddgsdkggqzq · Generado: 2026-10-11 · NO EJECUTADO TODAVÍA
--
-- ANTES DE EJECUTAR: volver a desplegar el código anterior a la Fase 2b. Las rutas
--   /api/municipality-coverage y /api/territory/** y el panel "Territorio por ejecutivo
--   comercial" de /lines consultan estas tablas; tras el rollback fallarían.
--
-- Qué deshace (una sola transacción, todo o nada):
--   1. Borra las 4 tablas con todos sus datos:
--        territory_snapshots, line_territory_names, municipality_zone,
--        municipality_travel_times
--   2. Borra la función de inmutabilidad public.territory_snapshots_immutable().
--
-- PÉRDIDAS:
--   - municipality_travel_times es la caché de Google Maps: borrarla obliga a PAGAR DE NUEVO
--     esas consultas si se vuelve a aplicar la Fase 2b. Si solo se quiere desactivar la
--     funcionalidad, es mejor revertir el código y dejar las tablas.
--   - territory_snapshots son versiones contractuales de los anexos de territorio. DROP TABLE
--     no lo bloquea el trigger de inmutabilidad, así que este script SE NIEGA a borrarlas si
--     hay alguna, salvo que se confirme explícitamente en la misma sesión:
--         SET opmap.rollback_drop_snapshots = 'on';
--     (en el SQL Editor de Supabase: pegar esa línea encima del script y ejecutar todo junto).
--     Antes, exportarlas (p. ej. COPY (SELECT * FROM public.territory_snapshots) TO STDOUT
--     desde psql, o descargar la tabla desde el Dashboard).
--
-- Orden respecto a otros rollbacks: este va PRIMERO. Las 4 tablas tienen FKs hacia
--   business_lines, executives (Fase 1), kams, municipalities y users; los rollbacks 9900
--   (borra business_lines/executives) y 9910 (puede borrar usuarios) fallan mientras existan.
--
-- Re-ejecutable: sí (IF EXISTS).
-- =====================================================================================

BEGIN;

-- -------------------------------------------------------------------------------------
-- 0. Salvaguarda de versiones contractuales y recuento de lo que se pierde
-- -------------------------------------------------------------------------------------

DO $$
DECLARE
  n_snap  bigint := 0;
  n_tt    bigint := 0;
  n_ok    bigint := 0;
  n_zone  bigint := 0;
  n_names bigint := 0;
BEGIN
  IF to_regclass('public.territory_snapshots') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.territory_snapshots' INTO n_snap;
  END IF;
  IF to_regclass('public.municipality_travel_times') IS NOT NULL THEN
    EXECUTE 'SELECT count(*), count(*) FILTER (WHERE status = ''ok'') FROM public.municipality_travel_times'
      INTO n_tt, n_ok;
  END IF;
  IF to_regclass('public.municipality_zone') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.municipality_zone' INTO n_zone;
  END IF;
  IF to_regclass('public.line_territory_names') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.line_territory_names' INTO n_names;
  END IF;

  IF n_snap > 0 AND coalesce(current_setting('opmap.rollback_drop_snapshots', true), '') <> 'on' THEN
    RAISE EXCEPTION 'Fase 2b rollback: territory_snapshots tiene % versión(es) contractual(es). Exportarlas y, si de verdad se quieren borrar, ejecutar antes en la misma sesión: SET opmap.rollback_drop_snapshots = ''on'';', n_snap;
  END IF;

  RAISE NOTICE 'Fase 2b rollback: se borran % versiones de territorio, % tiempos en caché (% con ruta, pagados a Google), % municipios con zona y % nombres comerciales.',
    n_snap, n_tt, n_ok, n_zone, n_names;
END $$;

-- -------------------------------------------------------------------------------------
-- 1. Tablas (sin CASCADE: nada de fuera de la Fase 2b depende de ellas)
-- -------------------------------------------------------------------------------------

DROP TABLE IF EXISTS public.territory_snapshots;
DROP TABLE IF EXISTS public.line_territory_names;
DROP TABLE IF EXISTS public.municipality_zone;
DROP TABLE IF EXISTS public.municipality_travel_times;

-- -------------------------------------------------------------------------------------
-- 2. Función de inmutabilidad (sus triggers desaparecen con la tabla)
-- -------------------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.territory_snapshots_immutable();

-- -------------------------------------------------------------------------------------
-- 3. Comprobación
-- -------------------------------------------------------------------------------------

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['territory_snapshots','line_territory_names',
                           'municipality_zone','municipality_travel_times'] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      RAISE EXCEPTION 'Fase 2b rollback: public.% sigue existiendo', t;
    END IF;
  END LOOP;
  IF to_regprocedure('public.territory_snapshots_immutable()') IS NOT NULL THEN
    RAISE EXCEPTION 'Fase 2b rollback: public.territory_snapshots_immutable() sigue existiendo';
  END IF;
  RAISE NOTICE 'Fase 2b rollback OK: 4 tablas y la función de inmutabilidad eliminadas.';
END $$;

COMMIT;
