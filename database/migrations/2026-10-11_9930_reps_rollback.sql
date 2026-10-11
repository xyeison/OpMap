-- =====================================================================================
-- OpMap · Fase 3 (IPS por código de habilitación) · 9930 — Rollback de 0600 (REPS)
-- Proyecto: norvxqgohddgsdkggqzq · Generado: 2026-10-11
--
-- ANTES DE EJECUTAR: volver a desplegar el código anterior a la Fase 3 (REPS). La ficha de IPS
--   (sección "Sede REPS"), /hospitals/reps, /api/hospitals/[id]/reps-link y /api/hospitals/reps/**
--   consultan estas columnas y la tabla; tras el rollback fallarían.
--
-- Qué deshace (una sola transacción, todo o nada):
--   1. hospitals: quita las restricciones y las columnas reps_code, reps_matched_at,
--      reps_match_status y nit (generada) y el índice idx_hospitals_nit. Los vínculos IPS ↔ sede
--      hechos a mano desde la ficha SE PIERDEN (exportarlos antes si importan:
--      SELECT id, code, name, reps_code, reps_match_status, reps_matched_at FROM hospitals
--      WHERE reps_code IS NOT NULL).
--   2. Borra reps_sedes con todos sus datos (se puede recargar desde el CSV del REPS con
--      scripts/reps-load-sedes.ts).
--
-- Orden respecto a otros rollbacks de la Fase 3: si otra migración de la Fase 3 (servicios
--   habilitados, ADRES…) creó FOREIGN KEY hacia reps_sedes o hacia hospitals.reps_code, su
--   rollback va ANTES que este (DROP TABLE sin CASCADE falla mientras existan esas FK, a
--   propósito). No afecta a 9920/9910/9900.
--
-- Re-ejecutable: sí (IF EXISTS).
-- =====================================================================================

BEGIN;

DO $$
DECLARE
  n_sedes  bigint := 0;
  n_linked bigint := 0;
BEGIN
  IF to_regclass('public.reps_sedes') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.reps_sedes' INTO n_sedes;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'hospitals' AND column_name = 'reps_code') THEN
    EXECUTE 'SELECT count(*) FROM public.hospitals WHERE reps_code IS NOT NULL' INTO n_linked;
  END IF;
  RAISE NOTICE 'Fase 3 (REPS) rollback: se borran % sedes del REPS y se pierden % vínculos IPS ↔ sede.', n_sedes, n_linked;
END $$;

ALTER TABLE public.hospitals DROP CONSTRAINT IF EXISTS hospitals_reps_match_coherence_check;
ALTER TABLE public.hospitals DROP CONSTRAINT IF EXISTS hospitals_reps_match_status_check;
ALTER TABLE public.hospitals DROP CONSTRAINT IF EXISTS hospitals_reps_code_check;
ALTER TABLE public.hospitals DROP CONSTRAINT IF EXISTS hospitals_reps_code_key;
DROP INDEX IF EXISTS public.idx_hospitals_nit;

ALTER TABLE public.hospitals DROP COLUMN IF EXISTS reps_code;
ALTER TABLE public.hospitals DROP COLUMN IF EXISTS reps_matched_at;
ALTER TABLE public.hospitals DROP COLUMN IF EXISTS reps_match_status;
ALTER TABLE public.hospitals DROP COLUMN IF EXISTS nit;

DROP TABLE IF EXISTS public.reps_sedes;

DO $$
BEGIN
  IF to_regclass('public.reps_sedes') IS NOT NULL THEN
    RAISE EXCEPTION 'Fase 3 (REPS) rollback: public.reps_sedes sigue existiendo';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'hospitals'
               AND column_name IN ('reps_code', 'nit', 'reps_matched_at', 'reps_match_status')) THEN
    RAISE EXCEPTION 'Fase 3 (REPS) rollback: quedan columnas REPS en hospitals';
  END IF;
  RAISE NOTICE 'Fase 3 (REPS) rollback OK: reps_sedes y las 4 columnas de hospitals eliminadas.';
END $$;

COMMIT;
