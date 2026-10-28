-- =====================================================================================
-- OpMap · fix/municipios-regla-bogota · 0900 — Migración de DATOS: respaldo de asignaciones y municipios, y tope
--   único de Bogotá en 360 min (6 h)
-- Proyecto: norvxqgohddgsdkggqzq · Generado: 2026-10-28
--
-- *** SOLO CON AUTORIZACIÓN DEL DUEÑO ("Si dale.", 2026-10-28). Se aplica ANTES del merge del motor de municipios
-- *** (así ningún recálculo intermedio usa 240) y, DESPUÉS DEL DESPLIEGUE, va seguida del recálculo (sin Google,
-- *** costo 0), desde web/:
-- ***   GOOGLE_ROUTES_DISABLED=true npx tsx scripts/fase1-recalculate.ts --yes      (IPS)
-- ***   GOOGLE_ROUTES_DISABLED=true npx tsx scripts/fase2b-municipios.ts --assign   (municipios)
--
-- Decisión del dueño: docs/decisiones/2026-10-28-municipios-por-corredor-de-bogota.md
-- Spec: docs/specs/2026-10-28-municipios-regla-bogota.md
--
-- Qué hace (una sola transacción, todo o nada):
--   1. Precondiciones: bogota_config tiene la fila id = 1 y los respaldos no existen con filas (si existen, esta
--      migración ya corrió: se aborta sin tocar nada).
--   2. Respaldo: assignments_respaldo_20261028 y municipality_zone_respaldo_20261028 (copia completa + respaldado_en),
--      con RLS sin políticas y sin permisos para anon/authenticated (solo service_role), como los demás respaldos.
--   3. bogota_config.max_travel_minutes = 360 (antes 240). k, grupos, corredores y forzadas no cambian.
--   4. Comprobación final: respaldos con las mismas filas que las tablas y tope en 360.
--
-- Guardar el tope NO recalcula: hasta correr los dos scripts de arriba, el mapa sigue igual.
-- Rollback: 2026-10-28_9951_bogota_tope_360_respaldo_rollback.sql (vuelve a 240 y restaura las dos tablas).
-- =====================================================================================

BEGIN;

DO $$
DECLARE
  respaldo text;
  tiene_filas boolean;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.bogota_config WHERE id = 1) THEN
    RAISE EXCEPTION '0900: falta la fila id = 1 de bogota_config (migración 0700)';
  END IF;
  -- Con EXECUTE: un SELECT directo sobre una tabla que aún no existe falla al planear, aunque el IF no llegue a él
  FOREACH respaldo IN ARRAY ARRAY['assignments_respaldo_20261028', 'municipality_zone_respaldo_20261028'] LOOP
    IF to_regclass('public.' || respaldo) IS NOT NULL THEN
      EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I)', respaldo) INTO tiene_filas;
      IF tiene_filas THEN
        RAISE EXCEPTION '0900: % ya tiene filas: la migración ya se aplicó', respaldo;
      END IF;
    END IF;
  END LOOP;
END $$;

CREATE TABLE IF NOT EXISTS public.assignments_respaldo_20261028 AS
  SELECT a.*, now() AS respaldado_en FROM public.assignments a WITH NO DATA;
INSERT INTO public.assignments_respaldo_20261028 SELECT a.*, now() FROM public.assignments a;

CREATE TABLE IF NOT EXISTS public.municipality_zone_respaldo_20261028 AS
  SELECT m.*, now() AS respaldado_en FROM public.municipality_zone m WITH NO DATA;
INSERT INTO public.municipality_zone_respaldo_20261028 SELECT m.*, now() FROM public.municipality_zone m;

ALTER TABLE public.assignments_respaldo_20261028 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.municipality_zone_respaldo_20261028 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.assignments_respaldo_20261028 FROM anon, authenticated;
REVOKE ALL ON public.municipality_zone_respaldo_20261028 FROM anon, authenticated;

UPDATE public.bogota_config SET max_travel_minutes = 360 WHERE id = 1;

DO $$
DECLARE
  n_asig bigint;
  n_asig_resp bigint;
  n_mun bigint;
  n_mun_resp bigint;
  tope integer;
BEGIN
  SELECT count(*) INTO n_asig FROM public.assignments;
  SELECT count(*) INTO n_asig_resp FROM public.assignments_respaldo_20261028;
  SELECT count(*) INTO n_mun FROM public.municipality_zone;
  SELECT count(*) INTO n_mun_resp FROM public.municipality_zone_respaldo_20261028;
  SELECT max_travel_minutes INTO tope FROM public.bogota_config WHERE id = 1;
  IF n_asig <> n_asig_resp OR n_mun <> n_mun_resp OR n_asig_resp = 0 OR n_mun_resp = 0 THEN
    RAISE EXCEPTION '0900: respaldo incompleto (assignments %/%, municipality_zone %/%)', n_asig_resp, n_asig, n_mun_resp, n_mun;
  END IF;
  IF tope <> 360 THEN
    RAISE EXCEPTION '0900: el tope de Bogotá quedó en %', tope;
  END IF;
  RAISE NOTICE '0900: respaldadas % asignaciones y % municipios; tope de Bogotá = 360 min', n_asig_resp, n_mun_resp;
END $$;

COMMIT;
