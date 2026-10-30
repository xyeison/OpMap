-- =====================================================================================
-- OpMap · feat/agente-sia-observa · 9958 — Rollback de 0930 (SIA Observa)
-- Proyecto: norvxqgohddgsdkggqzq · Generado: 2026-10-30 · NO EJECUTADO TODAVÍA
--
-- ANTES DE EJECUTAR: parar el launchd de scripts/sia-load.ts en el Mac del dueño y desplegar el código sin las rutas
--   /api/sia/* (o dejarlas: responden 503 "falta la migración 0930" si las tablas no existen). Vaciar el bucket desde el
--   panel de Supabase (Storage → contratos-sia → seleccionar todo → borrar): Supabase no deja borrar un bucket con
--   objetos. Supabase además prohíbe borrar en storage.buckets por SQL (trigger protect_buckets_delete, visto el 2026-10-30):
--   este script NO borra el bucket; después de correrlo, borrar el bucket vacío desde el panel (Storage → contratos-sia →
--   Delete bucket).
--
-- Qué deshace (una transacción, todo o nada):
--   1. hospital_contracts.sia_contrato_id, secop_contrato_id y lineas (se pierde el enlace de los contratos importados;
--      los contratos quedan intactos).
--   2. Las tablas secop_descartes_bandeja, contrato_extracciones, contrato_documentos, sia_contratos y sia_entidades.
--   3. hospitals.sia_entidad_id y sia_mapeado_at.
--   4. La fila sia_observa de fuentes_estado (el bucket se borra desde el panel, ver arriba).
--   5. check_contracting_model vuelve a (contratacion_directa, licitacion, invitacion_privada) SOLO si ningún contrato
--      quedó con subasta_inversa; si hay, aborta y dice cuántos (hay que cambiarlos a mano antes).
--
-- PÉRDIDAS: datos públicos de SIA (se recuperan con sia-load.ts si se vuelve a aplicar 0930), las lecturas de la IA
--   (cuestan dinero volver a hacerlas) y las revisiones de la bandeja (descartes con su motivo).
-- Re-ejecutable: sí (IF EXISTS). Tras aplicar: NOTIFY pgrst, 'reload schema';
-- =====================================================================================

BEGIN;

DO $$
DECLARE
  n_contratos bigint := 0;
  n_docs      bigint := 0;
  n_ia        bigint := 0;
  n_objetos   bigint := 0;
  n_subasta   bigint := 0;
BEGIN
  IF to_regclass('public.sia_contratos') IS NOT NULL THEN EXECUTE 'SELECT count(*) FROM public.sia_contratos' INTO n_contratos; END IF;
  IF to_regclass('public.contrato_documentos') IS NOT NULL THEN EXECUTE 'SELECT count(*) FROM public.contrato_documentos' INTO n_docs; END IF;
  IF to_regclass('public.contrato_extracciones') IS NOT NULL THEN EXECUTE 'SELECT count(*) FROM public.contrato_extracciones' INTO n_ia; END IF;
  SELECT count(*) INTO n_objetos FROM storage.objects WHERE bucket_id = 'contratos-sia';
  SELECT count(*) INTO n_subasta FROM public.hospital_contracts WHERE contracting_model = 'subasta_inversa';
  IF n_objetos > 0 THEN
    RAISE EXCEPTION 'Rollback 0930: el bucket contratos-sia tiene % archivos; vaciarlo primero desde el panel de Supabase', n_objetos;
  END IF;
  IF n_subasta > 0 THEN
    RAISE EXCEPTION 'Rollback 0930: % contratos usan subasta_inversa; cambiarlos antes de restaurar el CHECK anterior', n_subasta;
  END IF;
  RAISE NOTICE 'Rollback 0930: se borran % contratos de SIA, % documentos y % lecturas de la IA', n_contratos, n_docs, n_ia;
END;
$$;

ALTER TABLE public.hospital_contracts
  DROP COLUMN IF EXISTS sia_contrato_id,
  DROP COLUMN IF EXISTS secop_contrato_id,
  DROP COLUMN IF EXISTS lineas;

DROP TABLE IF EXISTS public.secop_descartes_bandeja;
DROP TABLE IF EXISTS public.contrato_extracciones;
DROP TABLE IF EXISTS public.contrato_documentos;
DROP TABLE IF EXISTS public.sia_contratos;

ALTER TABLE public.hospitals
  DROP COLUMN IF EXISTS sia_entidad_id,
  DROP COLUMN IF EXISTS sia_mapeado_at;

DROP TABLE IF EXISTS public.sia_entidades;

DELETE FROM public.fuentes_estado WHERE fuente = 'sia_observa';

ALTER TABLE public.hospital_contracts DROP CONSTRAINT IF EXISTS check_contracting_model;
ALTER TABLE public.hospital_contracts ADD CONSTRAINT check_contracting_model
  CHECK (((contracting_model)::text = ANY ((ARRAY['contratacion_directa'::character varying, 'licitacion'::character varying, 'invitacion_privada'::character varying])::text[])));

DO $$
BEGIN
  IF to_regclass('public.sia_contratos') IS NOT NULL OR to_regclass('public.sia_entidades') IS NOT NULL
     OR to_regclass('public.contrato_documentos') IS NOT NULL OR to_regclass('public.contrato_extracciones') IS NOT NULL
     OR to_regclass('public.secop_descartes_bandeja') IS NOT NULL THEN
    RAISE EXCEPTION 'Rollback 0930: siguen existiendo tablas de SIA';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name IN ('hospitals', 'hospital_contracts')
             AND column_name IN ('sia_entidad_id', 'sia_mapeado_at', 'sia_contrato_id', 'secop_contrato_id', 'lineas')) THEN
    RAISE EXCEPTION 'Rollback 0930: siguen existiendo columnas de SIA';
  END IF;
  RAISE NOTICE 'Rollback 0930 OK. SIGUIENTE PASO: NOTIFY pgrst, ''reload schema'';';
END;
$$;

COMMIT;
