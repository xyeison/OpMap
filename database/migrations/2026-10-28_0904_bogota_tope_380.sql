-- =====================================================================================
-- OpMap · chore/bogota-tope-380 · 0904 — Migración de DATOS: tope único de Bogotá en 380 min (6 h 20), con respaldo
-- Proyecto: norvxqgohddgsdkggqzq · Generado: 2026-10-28
--
-- *** Autorizada por el dueño ("Procede a cambiar a 6.20 bogota", 2026-10-28). Va seguida del recálculo (sin Google,
-- *** costo 0), desde web/:
-- ***   GOOGLE_ROUTES_DISABLED=true npx tsx scripts/fase1-recalculate.ts --yes      (IPS)
-- ***   GOOGLE_ROUTES_DISABLED=true npx tsx scripts/fase2b-municipios.ts --assign   (municipios)
--
-- Por qué: Yopal quedaba sin Zona. Bogotá Norte (punto base en Usaquén) llega en 6 h 17 al municipio y en 6 h 15 a la
-- más cercana de sus IPS, por encima del tope de 6 h. Simulación con 380 (scripts/bogota-simulate.ts --tope 380): entran
-- 5 de las 7 IPS de Yopal (a Bogotá Oriente por el corredor de Casanare) y ninguna otra IPS cambia; de los municipios
-- sin IPS asignadas entran Yopal y Recetor (Casanare, Oriente) y Labranzagrande y Boavita (Boyacá, Norte).
-- Decisión: docs/decisiones/2026-10-28-bogota-tope-380.md
--
-- Qué hace (una sola transacción, todo o nada):
--   1. Precondiciones: bogota_config tiene la fila id = 1 con tope 360 y los respaldos de hoy (_tope380) no existen con
--      filas (si existen, ya corrió: se aborta sin tocar nada).
--   2. Respaldo: assignments_respaldo_20261028_tope380 y municipality_zone_respaldo_20261028_tope380, con RLS sin
--      políticas y sin permisos para anon/authenticated.
--   3. bogota_config.max_travel_minutes = 380. k, grupos y corredores no cambian.
-- Rollback: 2026-10-28_9955_bogota_tope_380_rollback.sql (vuelve a 360 y restaura las dos tablas).
-- =====================================================================================

BEGIN;

DO $$
DECLARE
  respaldo text;
  tiene_filas boolean;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.bogota_config WHERE id = 1 AND max_travel_minutes = 360) THEN
    RAISE EXCEPTION '0904: bogota_config (id = 1) no tiene el tope de 360 que se espera';
  END IF;
  -- Con EXECUTE: un SELECT directo sobre una tabla que aún no existe falla al planear, aunque el IF no llegue a él
  FOREACH respaldo IN ARRAY ARRAY['assignments_respaldo_20261028_tope380', 'municipality_zone_respaldo_20261028_tope380'] LOOP
    IF to_regclass('public.' || respaldo) IS NOT NULL THEN
      EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I)', respaldo) INTO tiene_filas;
      IF tiene_filas THEN
        RAISE EXCEPTION '0904: % ya tiene filas: la migración ya se aplicó', respaldo;
      END IF;
    END IF;
  END LOOP;
END $$;

CREATE TABLE IF NOT EXISTS public.assignments_respaldo_20261028_tope380 AS
  SELECT a.*, now() AS respaldado_en FROM public.assignments a WITH NO DATA;
INSERT INTO public.assignments_respaldo_20261028_tope380 SELECT a.*, now() FROM public.assignments a;

CREATE TABLE IF NOT EXISTS public.municipality_zone_respaldo_20261028_tope380 AS
  SELECT m.*, now() AS respaldado_en FROM public.municipality_zone m WITH NO DATA;
INSERT INTO public.municipality_zone_respaldo_20261028_tope380 SELECT m.*, now() FROM public.municipality_zone m;

ALTER TABLE public.assignments_respaldo_20261028_tope380 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.municipality_zone_respaldo_20261028_tope380 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.assignments_respaldo_20261028_tope380 FROM anon, authenticated;
REVOKE ALL ON public.municipality_zone_respaldo_20261028_tope380 FROM anon, authenticated;

UPDATE public.bogota_config SET max_travel_minutes = 380 WHERE id = 1;

DO $$
DECLARE
  n_asig bigint;
  n_asig_resp bigint;
  n_mun bigint;
  n_mun_resp bigint;
BEGIN
  SELECT count(*) INTO n_asig FROM public.assignments;
  SELECT count(*) INTO n_asig_resp FROM public.assignments_respaldo_20261028_tope380;
  SELECT count(*) INTO n_mun FROM public.municipality_zone;
  SELECT count(*) INTO n_mun_resp FROM public.municipality_zone_respaldo_20261028_tope380;
  IF n_asig <> n_asig_resp OR n_mun <> n_mun_resp OR n_asig_resp = 0 OR n_mun_resp = 0 THEN
    RAISE EXCEPTION '0904: respaldo incompleto (assignments %/%, municipality_zone %/%)', n_asig_resp, n_asig, n_mun_resp, n_mun;
  END IF;
  IF (SELECT max_travel_minutes FROM public.bogota_config WHERE id = 1) <> 380 THEN
    RAISE EXCEPTION '0904: el tope de Bogotá no quedó en 380';
  END IF;
  RAISE NOTICE '0904: tope de Bogotá en 380 min; respaldadas % asignaciones y % municipios', n_asig_resp, n_mun_resp;
END $$;

COMMIT;
