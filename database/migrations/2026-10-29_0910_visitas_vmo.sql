-- =====================================================================================
-- OpMap · 0910 — Visitas de VMO para el mapa de calor: llaves con VMO y fuera el histórico viejo
-- Proyecto: norvxqgohddgsdkggqzq · Generado: 2026-10-29
--
-- Autorización del dueño (2026-10-29): "Yo solo requiero que se guarde las visitas georeferenciadas por comercial y si
-- ya no existe igual crear la persona. Ver qué dato podemos guardar aquí en OpMap con un dato que haya en VMO para hacer
-- una llave y poder importar solo las visitas efectivas y ya. Hazlo, si tienes que recrear todo desde 0 pues hazlo.
-- Borrar lo viejo pues hazlo." Decisión: docs/decisiones/2026-10-29-visitas-vmo-mapa-de-calor.md.
--
-- Qué hace (una sola transacción):
--   1. Si ya existe el respaldo o visits.vmo_id, aborta (ya se aplicó).
--   2. Llaves con VMO:
--      - visits.vmo_id bigint UNIQUE: el ID de la visita en VMO (columna "ID" de VMO › Visitas), solo en las importadas
--        (source = 'vmo_import'). Importar dos veces el mismo período actualiza, no duplica.
--      - executives.vmo_nombre text UNIQUE: el nombre del Ejecutivo Comercial como lo escribe VMO, normalizado
--        (minúsculas, sin tildes ni signos, espacios simples: claveComercial en web/lib/vmo-visitas.ts). La exportación
--        de VMO no trae otro dato de la persona.
--   3. Respaldos (copia + respaldado_en; RLS sin políticas, sin permisos para anon/authenticated):
--      visits_vmo_respaldo_20261029 (las visitas importadas de VMO) y visit_imports_respaldo_20261029 (registro mensual).
--   4. Borra lo viejo: las visitas importadas de VMO (7.033, enero a octubre de 2025, con el día al azar desde el
--      2025-08-22) y visit_imports (la importación nueva no lo usa). Las visitas de la app (source = 'app') no se tocan.
-- Después: en /visits, subir el Excel de VMO › Visitas (Excel → Todo) desde la primera fecha que tenga VMO hasta hoy.
-- Rollback: 2026-10-29_9956_visitas_vmo_rollback.sql
-- =====================================================================================

BEGIN;

-- Ya aplicada si existe el respaldo (aunque esté vacío) o la llave visits.vmo_id: volver a correrla borraría las
-- visitas importadas con la importación nueva
DO $$
BEGIN
  IF to_regclass('public.visits_vmo_respaldo_20261029') IS NOT NULL
     OR EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'visits' AND column_name = 'vmo_id') THEN
    RAISE EXCEPTION '0910: la migración ya se aplicó (existe el respaldo o visits.vmo_id)';
  END IF;
END $$;

CREATE TEMP TABLE conteo_0910 ON COMMIT DROP AS
  SELECT count(*) FILTER (WHERE source = 'vmo_import') AS vmo, count(*) FILTER (WHERE source = 'app') AS app
  FROM public.visits;

-- 2. Llaves con VMO
ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS vmo_id bigint;
ALTER TABLE public.visits DROP CONSTRAINT IF EXISTS visits_vmo_id_key;
ALTER TABLE public.visits ADD CONSTRAINT visits_vmo_id_key UNIQUE (vmo_id);
ALTER TABLE public.visits DROP CONSTRAINT IF EXISTS visits_vmo_id_check;
ALTER TABLE public.visits ADD CONSTRAINT visits_vmo_id_check CHECK (vmo_id IS NULL OR (vmo_id > 0 AND source = 'vmo_import'));
COMMENT ON COLUMN public.visits.vmo_id IS
  'ID de la visita en VMO (columna "ID" de VMO › Visitas). Llave de la importación (2026-10-29): solo en source = vmo_import.';

ALTER TABLE public.executives ADD COLUMN IF NOT EXISTS vmo_nombre text;
ALTER TABLE public.executives DROP CONSTRAINT IF EXISTS executives_vmo_nombre_key;
ALTER TABLE public.executives ADD CONSTRAINT executives_vmo_nombre_key UNIQUE (vmo_nombre);
ALTER TABLE public.executives DROP CONSTRAINT IF EXISTS executives_vmo_nombre_check;
ALTER TABLE public.executives ADD CONSTRAINT executives_vmo_nombre_check
  CHECK (vmo_nombre IS NULL OR vmo_nombre ~ '^[a-z0-9]+( [a-z0-9]+)*$');
COMMENT ON COLUMN public.executives.vmo_nombre IS
  'Nombre del Ejecutivo Comercial como lo escribe VMO, normalizado (minúsculas, sin tildes ni signos, espacios simples). Llave de la importación de visitas (2026-10-29).';

-- 3. Respaldos
CREATE TABLE IF NOT EXISTS public.visits_vmo_respaldo_20261029 AS
  SELECT v.*, now() AS respaldado_en FROM public.visits v WITH NO DATA;
INSERT INTO public.visits_vmo_respaldo_20261029 SELECT v.*, now() FROM public.visits v WHERE v.source = 'vmo_import';

CREATE TABLE IF NOT EXISTS public.visit_imports_respaldo_20261029 AS
  SELECT i.*, now() AS respaldado_en FROM public.visit_imports i WITH NO DATA;
INSERT INTO public.visit_imports_respaldo_20261029 SELECT i.*, now() FROM public.visit_imports i;

ALTER TABLE public.visits_vmo_respaldo_20261029 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visit_imports_respaldo_20261029 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.visits_vmo_respaldo_20261029 FROM anon, authenticated;
REVOKE ALL ON public.visit_imports_respaldo_20261029 FROM anon, authenticated;

-- 4. Borrar lo viejo (primero las visitas: visits.import_id apunta a visit_imports)
DELETE FROM public.visits WHERE source = 'vmo_import';
DELETE FROM public.visit_imports;

DO $$
DECLARE
  antes record;
  respaldadas bigint;
  quedan_vmo bigint;
  app_ahora bigint;
BEGIN
  SELECT * INTO antes FROM conteo_0910;
  SELECT count(*) INTO respaldadas FROM public.visits_vmo_respaldo_20261029;
  SELECT count(*) FILTER (WHERE source = 'vmo_import'), count(*) FILTER (WHERE source = 'app')
    INTO quedan_vmo, app_ahora FROM public.visits;
  IF respaldadas <> antes.vmo THEN
    RAISE EXCEPTION '0910: se respaldaron % visitas de VMO y había %', respaldadas, antes.vmo;
  END IF;
  IF quedan_vmo <> 0 THEN
    RAISE EXCEPTION '0910: quedaron % visitas importadas de VMO', quedan_vmo;
  END IF;
  IF app_ahora <> antes.app THEN
    RAISE EXCEPTION '0910: las visitas de la app cambiaron (% antes, % ahora)', antes.app, app_ahora;
  END IF;
  RAISE NOTICE '0910: llaves vmo_id y vmo_nombre creadas; % visitas viejas de VMO respaldadas y borradas; % de la app intactas',
    respaldadas, app_ahora;
END $$;

COMMIT;
