-- =====================================================================================
-- OpMap · feat/zonas-por-linea (Zonas por línea para las líderes) · 9946 — Rollback de 0860
-- Proyecto: norvxqgohddgsdkggqzq · Generado: 2026-10-23
--
-- ANTES DE EJECUTAR: si la 0870 (borrado de executive_lines con sus dos restricciones) ya se aplicó, correr primero
--   su rollback 9947 si se quiere restaurar las líneas desde el respaldo (la 9947 borra filas de
--   executive_allowed_lines; con la tabla ya quitada no tendría dónde). El código con lineas_permitidas sigue
--   funcionando sin la tabla (la API responde lineas_permitidas = null y no acepta fijar restricciones), así que no
--   hace falta volver a desplegar.
--
-- Qué deshace (una sola transacción, todo o nada):
--   1. Tabla public.executive_allowed_lines (su índice, llaves, RLS y comentarios se van con ella). Sin CASCADE: si
--      algo más dependiera de ella, aborta.
--   NO toca executives, business_lines, executive_lines ni el respaldo executive_lines_respaldo_20261023.
--
-- PÉRDIDAS (NOTICE con la cifra antes de borrar): todas las restricciones "esta persona solo puede tener estas
--   líneas" fijadas por la dirección. Las líneas asignadas (executive_lines) se quedan como están.
--
-- Re-ejecutable: sí (IF EXISTS en todo). Tras aplicar: NOTIFY pgrst, 'reload schema';
-- =====================================================================================

BEGIN;

-- -------------------------------------------------------------------------------------
-- 0. Aviso de lo que se pierde
-- -------------------------------------------------------------------------------------

DO $$
DECLARE
  v_filas    bigint;
  v_personas bigint;
BEGIN
  IF to_regclass('public.executive_allowed_lines') IS NOT NULL THEN
    EXECUTE 'SELECT count(*), count(DISTINCT executive_id) FROM public.executive_allowed_lines' INTO v_filas, v_personas;
    RAISE NOTICE 'Rollback 0860: se borran % restricción(es) de líneas permitidas de % persona(s) o vacante(s); las líneas asignadas (executive_lines) no cambian', v_filas, v_personas;
  ELSE
    RAISE NOTICE 'Rollback 0860: public.executive_allowed_lines no existe; nada que borrar';
  END IF;
END;
$$;

-- -------------------------------------------------------------------------------------
-- 1. Tabla (sin CASCADE: si algo más depende de ella, aborta)
-- -------------------------------------------------------------------------------------

DROP TABLE IF EXISTS public.executive_allowed_lines;

-- -------------------------------------------------------------------------------------
-- 2. Comprobación: no queda nada de 0860
-- -------------------------------------------------------------------------------------

DO $$
BEGIN
  IF to_regclass('public.executive_allowed_lines') IS NOT NULL THEN
    RAISE EXCEPTION 'Rollback 0860: sigue existiendo public.executive_allowed_lines';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'executive_allowed_lines_line_id_idx') THEN
    RAISE EXCEPTION 'Rollback 0860: sigue existiendo el índice executive_allowed_lines_line_id_idx';
  END IF;
  RAISE NOTICE 'Rollback 0860 OK: sin executive_allowed_lines. SIGUIENTE PASO: NOTIFY pgrst, ''reload schema''.';
END;
$$;

COMMIT;
