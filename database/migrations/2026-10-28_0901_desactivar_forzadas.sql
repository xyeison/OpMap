-- =====================================================================================
-- OpMap · 0901 — Migración de DATOS: desactivar las asignaciones forzadas (con respaldo)
-- Proyecto: norvxqgohddgsdkggqzq · Generado: 2026-10-28 · NO APLICADA TODAVÍA
--
-- Pedido del dueño (2026-10-28): "Quita todo lo que son a la fuerza, porque quiero revisar el propio sistema que
-- propone". Hoy hay tres activas: Villavicencio y Granada → San Cristóbal, Yopal → Kennedy ("Trayecto aereo").
--
-- *** ANTES DE APLICAR: los tiempos guardados (hospital_kam_distances) de las IPS de Meta y Casanare desde las celdas
-- *** de Bogotá son del 2025-08-07, con la vía al Llano cerrada (Villavicencio a 441–471 min y ~375 km; lo normal es
-- *** ~2 h 30 y ~120 km). Sin recalcularlos (Google, con dry-run y autorización del dueño), al desactivar las forzadas
-- *** las 22 IPS de Villavicencio, Granada y Yopal quedan sin zona. Seguida del recálculo de IPS y municipios.
--
-- Qué hace (una sola transacción):
--   1. Si el respaldo ya tiene filas, aborta (ya se aplicó).
--   2. Respaldo forced_assignments_respaldo_20261028 (copia + respaldado_en; RLS sin políticas, sin permisos para
--      anon/authenticated).
--   3. UPDATE forced_assignments SET active = false (no se borra nada).
-- Rollback: 2026-10-28_9952_desactivar_forzadas_rollback.sql
-- =====================================================================================

BEGIN;

DO $$
DECLARE
  tiene_filas boolean;
BEGIN
  IF to_regclass('public.forced_assignments_respaldo_20261028') IS NOT NULL THEN
    EXECUTE 'SELECT EXISTS (SELECT 1 FROM public.forced_assignments_respaldo_20261028)' INTO tiene_filas;
    IF tiene_filas THEN
      RAISE EXCEPTION '0901: forced_assignments_respaldo_20261028 ya tiene filas: la migración ya se aplicó';
    END IF;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.forced_assignments_respaldo_20261028 AS
  SELECT f.*, now() AS respaldado_en FROM public.forced_assignments f WITH NO DATA;
INSERT INTO public.forced_assignments_respaldo_20261028 SELECT f.*, now() FROM public.forced_assignments f;
ALTER TABLE public.forced_assignments_respaldo_20261028 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.forced_assignments_respaldo_20261028 FROM anon, authenticated;

UPDATE public.forced_assignments SET active = false WHERE active = true;

DO $$
DECLARE
  activas bigint;
  desactivadas bigint;
BEGIN
  SELECT count(*) INTO activas FROM public.forced_assignments WHERE active;
  SELECT count(*) FILTER (WHERE active) INTO desactivadas FROM public.forced_assignments_respaldo_20261028;
  IF activas <> 0 THEN
    RAISE EXCEPTION '0901: quedaron % asignaciones forzadas activas', activas;
  END IF;
  RAISE NOTICE '0901: % asignaciones forzadas desactivadas (respaldo en forced_assignments_respaldo_20261028)', desactivadas;
END $$;

COMMIT;
