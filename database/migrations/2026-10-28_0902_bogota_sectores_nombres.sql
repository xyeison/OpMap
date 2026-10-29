-- =====================================================================================
-- OpMap · feat/bogota-4-sectores · 0902 — Migración de DATOS: respaldo y nombres de las 4 Zonas de Bogotá por sector
-- Proyecto: norvxqgohddgsdkggqzq · Generado: 2026-10-28
--
-- *** Autorizada por el dueño ("Si, hazlo. Norte, Occidente, Sur y Oriente.", 2026-10-28). Se aplica DESPUÉS del
-- *** despliegue del motor por sectores y va seguida del recálculo (sin Google, costo 0), desde web/:
-- ***   GOOGLE_ROUTES_DISABLED=true npx tsx scripts/fase1-recalculate.ts --yes      (IPS)
-- ***   GOOGLE_ROUTES_DISABLED=true npx tsx scripts/fase2b-municipios.ts --assign   (municipios)
--
-- Decisión del dueño: docs/decisiones/2026-10-28-bogota-4-sectores.md
-- Spec: docs/specs/2026-10-28-bogota-4-sectores.md
--
-- Qué hace (una sola transacción, todo o nada):
--   1. Precondiciones: las 4 celdas existen con su area_id (1100102, 1100110, 1100108, 1100104) y los respaldos de hoy
--      (sufijo _sectores) no existen con filas (si existen, ya corrió: se aborta sin tocar nada).
--   2. Respaldos: assignments_respaldo_20261028_sectores, municipality_zone_respaldo_20261028_sectores y
--      kams_nombres_respaldo_20261028 (id, name, base_city), con RLS sin políticas y sin permisos para
--      anon/authenticated, como los demás respaldos.
--   3. Nombres: Chapinero → Bogotá Norte, Engativá → Bogotá Occidente, Kennedy → Bogotá Sur, San Cristóbal →
--      Bogotá Oriente. base_city, punto base, color, gente y grupos de bogota_config no cambian.
--   4. Comprobación final: respaldos completos y los 4 nombres nuevos.
--
-- Renombrar NO recalcula: hasta correr los dos scripts de arriba, las asignaciones siguen como estaban.
-- Rollback: 2026-10-28_9953_bogota_sectores_nombres_rollback.sql (nombres y, si se pide, asignaciones y municipios).
-- =====================================================================================

BEGIN;

DO $$
DECLARE
  respaldo text;
  tiene_filas boolean;
BEGIN
  IF (SELECT count(*) FROM public.kams WHERE area_id IN ('1100102', '1100110', '1100108', '1100104')) <> 4 THEN
    RAISE EXCEPTION '0902: no están las 4 celdas de Bogotá (1100102, 1100110, 1100108, 1100104)';
  END IF;
  -- Con EXECUTE: un SELECT directo sobre una tabla que aún no existe falla al planear, aunque el IF no llegue a él
  FOREACH respaldo IN ARRAY ARRAY['assignments_respaldo_20261028_sectores', 'municipality_zone_respaldo_20261028_sectores', 'kams_nombres_respaldo_20261028'] LOOP
    IF to_regclass('public.' || respaldo) IS NOT NULL THEN
      EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I)', respaldo) INTO tiene_filas;
      IF tiene_filas THEN
        RAISE EXCEPTION '0902: % ya tiene filas: la migración ya se aplicó', respaldo;
      END IF;
    END IF;
  END LOOP;
END $$;

CREATE TABLE IF NOT EXISTS public.assignments_respaldo_20261028_sectores AS
  SELECT a.*, now() AS respaldado_en FROM public.assignments a WITH NO DATA;
INSERT INTO public.assignments_respaldo_20261028_sectores SELECT a.*, now() FROM public.assignments a;

CREATE TABLE IF NOT EXISTS public.municipality_zone_respaldo_20261028_sectores AS
  SELECT m.*, now() AS respaldado_en FROM public.municipality_zone m WITH NO DATA;
INSERT INTO public.municipality_zone_respaldo_20261028_sectores SELECT m.*, now() FROM public.municipality_zone m;

CREATE TABLE IF NOT EXISTS public.kams_nombres_respaldo_20261028 AS
  SELECT k.id, k.name, k.base_city, now() AS respaldado_en FROM public.kams k WITH NO DATA;
INSERT INTO public.kams_nombres_respaldo_20261028
  SELECT k.id, k.name, k.base_city, now() FROM public.kams k WHERE k.area_id IN ('1100102', '1100110', '1100108', '1100104');

ALTER TABLE public.assignments_respaldo_20261028_sectores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.municipality_zone_respaldo_20261028_sectores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kams_nombres_respaldo_20261028 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.assignments_respaldo_20261028_sectores FROM anon, authenticated;
REVOKE ALL ON public.municipality_zone_respaldo_20261028_sectores FROM anon, authenticated;
REVOKE ALL ON public.kams_nombres_respaldo_20261028 FROM anon, authenticated;

UPDATE public.kams SET name = 'Bogotá Norte' WHERE area_id = '1100102';
UPDATE public.kams SET name = 'Bogotá Occidente' WHERE area_id = '1100110';
UPDATE public.kams SET name = 'Bogotá Sur' WHERE area_id = '1100108';
UPDATE public.kams SET name = 'Bogotá Oriente' WHERE area_id = '1100104';

DO $$
DECLARE
  n_asig bigint;
  n_asig_resp bigint;
  n_mun bigint;
  n_mun_resp bigint;
BEGIN
  SELECT count(*) INTO n_asig FROM public.assignments;
  SELECT count(*) INTO n_asig_resp FROM public.assignments_respaldo_20261028_sectores;
  SELECT count(*) INTO n_mun FROM public.municipality_zone;
  SELECT count(*) INTO n_mun_resp FROM public.municipality_zone_respaldo_20261028_sectores;
  IF n_asig <> n_asig_resp OR n_mun <> n_mun_resp OR n_asig_resp = 0 OR n_mun_resp = 0
     OR (SELECT count(*) FROM public.kams_nombres_respaldo_20261028) <> 4 THEN
    RAISE EXCEPTION '0902: respaldo incompleto (assignments %/%, municipality_zone %/%)', n_asig_resp, n_asig, n_mun_resp, n_mun;
  END IF;
  IF (SELECT count(*) FROM public.kams WHERE name IN ('Bogotá Norte', 'Bogotá Occidente', 'Bogotá Sur', 'Bogotá Oriente')) <> 4 THEN
    RAISE EXCEPTION '0902: los 4 nombres nuevos no quedaron';
  END IF;
  RAISE NOTICE '0902: respaldos listos (% asignaciones, % municipios) y Zonas renombradas por sector', n_asig_resp, n_mun_resp;
END $$;

COMMIT;
