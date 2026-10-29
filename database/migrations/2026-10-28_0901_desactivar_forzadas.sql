-- =====================================================================================
-- OpMap · 0901 — Migración de DATOS: desactivar las asignaciones forzadas y respaldar los tiempos desde Bogotá a
--   Meta y Casanare antes de recalcularlos
-- Proyecto: norvxqgohddgsdkggqzq · Generado: 2026-10-28
--
-- Autorización del dueño (2026-10-28): "Sí, autorizo los 0,44 USD y quita las forzadas". Antes: "Quita todo lo que
-- son a la fuerza, porque quiero revisar el propio sistema que propone". Hoy hay tres forzadas activas: Villavicencio y
-- Granada → San Cristóbal, Yopal → Kennedy ("Trayecto aereo").
--
-- Por qué van juntas: los tiempos guardados (hospital_kam_distances) desde las 4 celdas de Bogotá a las IPS de Meta y
-- Casanare son del 2025-08-07, con la vía al Llano cerrada (Villavicencio a 441–471 min y ~375 km; lo normal es ~2 h 30).
-- Sin forzadas y con esos tiempos, las 22 IPS de Villavicencio, Granada y Yopal quedarían sin zona.
--
-- Orden (todo desde web/, el mismo día):
--   1. Esta migración (respaldos + forzadas desactivadas).
--   2. npx tsx scripts/tiempos-bogota-refrescar.ts --departamentos 50,85 --run --max-elements 88   (Google, 0,44 USD)
--   3. GOOGLE_ROUTES_DISABLED=true npx tsx scripts/fase1-recalculate.ts --yes
--   4. GOOGLE_ROUTES_DISABLED=true npx tsx scripts/fase2b-municipios.ts --assign
--
-- Qué hace (una sola transacción):
--   1. Si algún respaldo ya tiene filas, aborta (ya se aplicó).
--   2. Respaldos (copia + respaldado_en; RLS sin políticas, sin permisos para anon/authenticated):
--      - forced_assignments_respaldo_20261028: todas las forzadas;
--      - hospital_kam_distances_respaldo_20261028: los pares celda de Bogotá → IPS activa de Meta (50) y Casanare (85).
--   3. UPDATE forced_assignments SET active = false (no se borra nada).
-- Rollback: 2026-10-28_9952_desactivar_forzadas_rollback.sql
-- =====================================================================================

BEGIN;

DO $$
DECLARE
  respaldo text;
  tiene_filas boolean;
BEGIN
  FOREACH respaldo IN ARRAY ARRAY['forced_assignments_respaldo_20261028', 'hospital_kam_distances_respaldo_20261028'] LOOP
    IF to_regclass('public.' || respaldo) IS NOT NULL THEN
      EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I)', respaldo) INTO tiene_filas;
      IF tiene_filas THEN
        RAISE EXCEPTION '0901: % ya tiene filas: la migración ya se aplicó', respaldo;
      END IF;
    END IF;
  END LOOP;
END $$;

CREATE TABLE IF NOT EXISTS public.forced_assignments_respaldo_20261028 AS
  SELECT f.*, now() AS respaldado_en FROM public.forced_assignments f WITH NO DATA;
INSERT INTO public.forced_assignments_respaldo_20261028 SELECT f.*, now() FROM public.forced_assignments f;

CREATE TABLE IF NOT EXISTS public.hospital_kam_distances_respaldo_20261028 AS
  SELECT d.*, now() AS respaldado_en FROM public.hospital_kam_distances d WITH NO DATA;
INSERT INTO public.hospital_kam_distances_respaldo_20261028
  SELECT d.*, now()
  FROM public.hospital_kam_distances d
  JOIN public.hospitals h ON h.id = d.hospital_id
  JOIN public.kams k ON k.id = d.kam_id
  WHERE h.active AND h.department_id IN ('50', '85') AND k.area_id LIKE '11001%' AND length(k.area_id) = 7;

ALTER TABLE public.forced_assignments_respaldo_20261028 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospital_kam_distances_respaldo_20261028 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.forced_assignments_respaldo_20261028 FROM anon, authenticated;
REVOKE ALL ON public.hospital_kam_distances_respaldo_20261028 FROM anon, authenticated;

UPDATE public.forced_assignments SET active = false WHERE active = true;

DO $$
DECLARE
  activas bigint;
  desactivadas bigint;
  tiempos bigint;
BEGIN
  SELECT count(*) INTO activas FROM public.forced_assignments WHERE active;
  SELECT count(*) FILTER (WHERE active) INTO desactivadas FROM public.forced_assignments_respaldo_20261028;
  SELECT count(*) INTO tiempos FROM public.hospital_kam_distances_respaldo_20261028;
  IF activas <> 0 THEN
    RAISE EXCEPTION '0901: quedaron % asignaciones forzadas activas', activas;
  END IF;
  IF tiempos = 0 THEN
    RAISE EXCEPTION '0901: el respaldo de tiempos quedó vacío';
  END IF;
  RAISE NOTICE '0901: % forzadas desactivadas; % tiempos de Bogotá a Meta y Casanare respaldados', desactivadas, tiempos;
END $$;

COMMIT;
