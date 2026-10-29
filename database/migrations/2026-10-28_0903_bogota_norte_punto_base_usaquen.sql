-- =====================================================================================
-- OpMap · feat/bogota-4-sectores · 0903 — Migración de DATOS: el punto base de Bogotá Norte pasa a Usaquén
-- Proyecto: norvxqgohddgsdkggqzq · Generado: 2026-10-28
--
-- *** Autorizada por el dueño ("Recalculalo asumo el costo", 2026-10-28). Va DESPUÉS de la 0902 (nombres) y del
-- *** despliegue del motor por sectores, y la siguen, desde web/:
-- ***   npx tsx scripts/zona-punto-base-tiempos.ts --zona <id de Bogotá Norte> --run --max-elements 1500
-- ***       (Google: 676 IPS + 795 municipios = 1.471 elementos ≈ 7,36 USD; reemplaza los tiempos de la zona)
-- ***   GOOGLE_ROUTES_DISABLED=true npx tsx scripts/fase1-recalculate.ts --yes      (IPS, sin Google)
-- ***   GOOGLE_ROUTES_DISABLED=true npx tsx scripts/fase2b-municipios.ts --assign   (municipios, sin Google)
--
-- Por qué: con los 4 sectores, la localidad de Chapinero es del sector Oriente, pero ahí estaba el punto base de la
-- zona del Norte (su insignia quedaba en el morado del Oriente y sus tiempos salían de Chapinero). El punto nuevo es
-- el centro de las 32 IPS activas de Usaquén (promedio de sus coordenadas): 4.706782, -74.039973.
-- Decisión: docs/decisiones/2026-10-28-bogota-4-sectores.md · Spec: docs/specs/2026-10-28-bogota-4-sectores.md
--
-- Qué hace (una sola transacción, todo o nada):
--   1. Precondiciones: existe UNA zona 'Bogotá Norte' con area_id 1100102 (0902 aplicada) y los respaldos de hoy
--      (_norte) no existen con filas (si existen, ya corrió: se aborta sin tocar nada).
--   2. Respaldos: kams_punto_base_respaldo_20261028 (id, area_id, base_city, lat, lng),
--      hospital_kam_distances_respaldo_20261028_norte y municipality_travel_times_respaldo_20261028_norte (todas las
--      filas de la zona), con RLS sin políticas y sin permisos para anon/authenticated.
--   3. kams: area_id 1100101 (Usaquén), base_city 'Usaquén', lat 4.706782, lng -74.039973. Nombre, color, gente y
--      grupos de bogota_config no cambian.
--   4. Comprobación final.
--
-- Los tiempos guardados siguen siendo los de Chapinero hasta correr el script de Google; NO recalcular antes.
-- Rollback: 2026-10-28_9954_bogota_norte_punto_base_usaquen_rollback.sql (punto y tiempos de antes).
-- =====================================================================================

BEGIN;

DO $$
DECLARE
  respaldo text;
  tiene_filas boolean;
BEGIN
  IF (SELECT count(*) FROM public.kams WHERE area_id = '1100102' AND name = 'Bogotá Norte') <> 1 THEN
    RAISE EXCEPTION '0903: no hay UNA zona "Bogotá Norte" con area_id 1100102 (¿falta la 0902 o ya se movió?)';
  END IF;
  -- Con EXECUTE: un SELECT directo sobre una tabla que aún no existe falla al planear, aunque el IF no llegue a él
  FOREACH respaldo IN ARRAY ARRAY['kams_punto_base_respaldo_20261028', 'hospital_kam_distances_respaldo_20261028_norte', 'municipality_travel_times_respaldo_20261028_norte'] LOOP
    IF to_regclass('public.' || respaldo) IS NOT NULL THEN
      EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I)', respaldo) INTO tiene_filas;
      IF tiene_filas THEN
        RAISE EXCEPTION '0903: % ya tiene filas: la migración ya se aplicó', respaldo;
      END IF;
    END IF;
  END LOOP;
END $$;

CREATE TABLE IF NOT EXISTS public.kams_punto_base_respaldo_20261028 AS
  SELECT k.id, k.area_id, k.base_city, k.lat, k.lng, now() AS respaldado_en FROM public.kams k WITH NO DATA;
INSERT INTO public.kams_punto_base_respaldo_20261028
  SELECT k.id, k.area_id, k.base_city, k.lat, k.lng, now() FROM public.kams k WHERE k.area_id = '1100102' AND k.name = 'Bogotá Norte';

CREATE TABLE IF NOT EXISTS public.hospital_kam_distances_respaldo_20261028_norte AS
  SELECT d.*, now() AS respaldado_en FROM public.hospital_kam_distances d WITH NO DATA;
INSERT INTO public.hospital_kam_distances_respaldo_20261028_norte
  SELECT d.*, now() FROM public.hospital_kam_distances d
  WHERE d.kam_id = (SELECT id FROM public.kams_punto_base_respaldo_20261028);

CREATE TABLE IF NOT EXISTS public.municipality_travel_times_respaldo_20261028_norte AS
  SELECT t.*, now() AS respaldado_en FROM public.municipality_travel_times t WITH NO DATA;
INSERT INTO public.municipality_travel_times_respaldo_20261028_norte
  SELECT t.*, now() FROM public.municipality_travel_times t
  WHERE t.kam_id = (SELECT id FROM public.kams_punto_base_respaldo_20261028);

ALTER TABLE public.kams_punto_base_respaldo_20261028 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospital_kam_distances_respaldo_20261028_norte ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.municipality_travel_times_respaldo_20261028_norte ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.kams_punto_base_respaldo_20261028 FROM anon, authenticated;
REVOKE ALL ON public.hospital_kam_distances_respaldo_20261028_norte FROM anon, authenticated;
REVOKE ALL ON public.municipality_travel_times_respaldo_20261028_norte FROM anon, authenticated;

UPDATE public.kams
   SET area_id = '1100101', base_city = 'Usaquén', lat = 4.706782, lng = -74.039973
 WHERE id = (SELECT id FROM public.kams_punto_base_respaldo_20261028);

DO $$
DECLARE
  zona uuid;
  n_ips bigint;
  n_ips_resp bigint;
  n_mun bigint;
  n_mun_resp bigint;
BEGIN
  SELECT id INTO zona FROM public.kams_punto_base_respaldo_20261028;
  SELECT count(*) INTO n_ips FROM public.hospital_kam_distances WHERE kam_id = zona;
  SELECT count(*) INTO n_ips_resp FROM public.hospital_kam_distances_respaldo_20261028_norte;
  SELECT count(*) INTO n_mun FROM public.municipality_travel_times WHERE kam_id = zona;
  SELECT count(*) INTO n_mun_resp FROM public.municipality_travel_times_respaldo_20261028_norte;
  IF n_ips <> n_ips_resp OR n_mun <> n_mun_resp OR n_ips_resp = 0 OR n_mun_resp = 0 THEN
    RAISE EXCEPTION '0903: respaldo incompleto (IPS %/%, municipios %/%)', n_ips_resp, n_ips, n_mun_resp, n_mun;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.kams WHERE id = zona AND area_id = '1100101' AND lat = 4.706782 AND lng = -74.039973) THEN
    RAISE EXCEPTION '0903: el punto base no quedó en Usaquén';
  END IF;
  RAISE NOTICE '0903: Bogotá Norte con punto base en Usaquén; respaldados % pares de IPS y % de municipios', n_ips_resp, n_mun_resp;
END $$;

COMMIT;
