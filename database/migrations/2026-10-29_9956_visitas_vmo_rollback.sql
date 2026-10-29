-- =====================================================================================
-- OpMap · 9956 — Rollback de 0910 (visitas de VMO para el mapa de calor)
-- Proyecto: norvxqgohddgsdkggqzq · Generado: 2026-10-29
--
-- Qué hace (una sola transacción):
--   1. Exige los respaldos de la 0910.
--   2. Borra las visitas importadas con la importación nueva (source = 'vmo_import').
--   3. Devuelve visit_imports y las visitas viejas de VMO desde sus respaldos (mismas filas e ids).
--   4. Borra las personas que creó la importación (notas "Creada al importar visitas de VMO…"), salvo las que ya se
--      usan en otra parte (líneas, cobertura, app…): esas se quedan y se avisa con un NOTICE.
--   5. Quita vmo_id y vmo_nombre con sus restricciones, y los respaldos.
-- Las visitas de la app (source = 'app') no se tocan.
-- =====================================================================================

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.visits_vmo_respaldo_20261029') IS NULL OR to_regclass('public.visit_imports_respaldo_20261029') IS NULL THEN
    RAISE EXCEPTION '9956: faltan los respaldos de la 0910';
  END IF;
END $$;

CREATE TEMP TABLE conteo_9956 ON COMMIT DROP AS
  SELECT (SELECT count(*) FROM public.visits WHERE source = 'app') AS app,
         (SELECT count(*) FROM public.visits_vmo_respaldo_20261029) AS respaldadas;

DELETE FROM public.visits WHERE source = 'vmo_import';

-- Devolver visit_imports y las visitas viejas con las columnas que tengan en común (los respaldos traen respaldado_en)
DO $$
DECLARE
  tabla text;
  respaldo text;
  columnas text;
BEGIN
  FOREACH tabla IN ARRAY ARRAY['visit_imports', 'visits'] LOOP
    respaldo := CASE tabla WHEN 'visits' THEN 'visits_vmo_respaldo_20261029' ELSE 'visit_imports_respaldo_20261029' END;
    SELECT string_agg(quote_ident(c.column_name), ', ' ORDER BY c.ordinal_position) INTO columnas
    FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.table_name = tabla
      AND EXISTS (SELECT 1 FROM information_schema.columns r
                  WHERE r.table_schema = 'public' AND r.table_name = respaldo AND r.column_name = c.column_name);
    EXECUTE format('INSERT INTO public.%I (%s) SELECT %s FROM public.%I', tabla, columnas, columnas, respaldo);
  END LOOP;
END $$;

-- Personas creadas por la importación: se borran si nada más las usa
DO $$
DECLARE
  persona record;
BEGIN
  FOR persona IN
    SELECT id, full_name FROM public.executives WHERE notes LIKE 'Creada al importar visitas de VMO%'
  LOOP
    BEGIN
      DELETE FROM public.executives WHERE id = persona.id;
    EXCEPTION WHEN foreign_key_violation THEN
      RAISE NOTICE '9956: % se queda (ya se usa en otra parte)', persona.full_name;
    END;
  END LOOP;
END $$;

ALTER TABLE public.visits DROP CONSTRAINT IF EXISTS visits_vmo_id_check;
ALTER TABLE public.visits DROP CONSTRAINT IF EXISTS visits_vmo_id_key;
ALTER TABLE public.visits DROP COLUMN IF EXISTS vmo_id;
ALTER TABLE public.executives DROP CONSTRAINT IF EXISTS executives_vmo_nombre_check;
ALTER TABLE public.executives DROP CONSTRAINT IF EXISTS executives_vmo_nombre_key;
ALTER TABLE public.executives DROP COLUMN IF EXISTS vmo_nombre;

DO $$
DECLARE
  antes record;
  vmo bigint;
  app bigint;
BEGIN
  SELECT * INTO antes FROM conteo_9956;
  SELECT count(*) FILTER (WHERE source = 'vmo_import'), count(*) FILTER (WHERE source = 'app') INTO vmo, app FROM public.visits;
  IF vmo <> antes.respaldadas THEN
    RAISE EXCEPTION '9956: se devolvieron % visitas de VMO y el respaldo tenía %', vmo, antes.respaldadas;
  END IF;
  IF app <> antes.app THEN
    RAISE EXCEPTION '9956: las visitas de la app cambiaron (% antes, % ahora)', antes.app, app;
  END IF;
  RAISE NOTICE '9956: % visitas viejas de VMO devueltas; % de la app intactas', vmo, app;
END $$;

DROP TABLE public.visits_vmo_respaldo_20261029;
DROP TABLE public.visit_imports_respaldo_20261029;

COMMIT;
