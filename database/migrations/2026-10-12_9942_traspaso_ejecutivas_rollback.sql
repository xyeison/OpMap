-- =====================================================================================
-- OpMap · feat/traspaso-ejecutivas (traspaso de Ejecutivos Comerciales) · 9942 — Rollback de 0820
-- Proyecto: norvxqgohddgsdkggqzq · Generado: 2026-10-12
--
-- ANTES DE EJECUTAR: volver a desplegar el código anterior a este PR (sin /api/executives/[id]/traspaso,
--   /api/executives/[id]/contratar, /api/executives/traspasos ni el asistente de traspaso): el código nuevo llama a
--   ejecutivas_traspasar(), lee ejecutivas_traspasos y medico_visitantes.fin_motivo / traspaso_id; con el esquema
--   viejo fallaría. Los DROP van SIN CASCADE a propósito y abortan si algo más depende de lo que se quita.
--
-- Qué deshace (una sola transacción, todo o nada), en orden inverso a 0820:
--   1. Disparadores: executives_baja_termina_visitantes (executives), executive_lines_termina_visitantes
--      (executive_lines), medico_visitantes_fin_motivo (medico_visitantes) y los dos de inmutabilidad del historial.
--   2. Funciones: ejecutivas_traspasar, ejecutivas_baja_trg, ejecutivas_linea_quitada_trg,
--      medico_visitantes_fin_motivo_trg, ejecutivas_traspasos_inmutable.
--   3. medico_visitantes: CHECK medico_visitantes_fin_motivo_check, llave medico_visitantes_traspaso_id_fkey, índice
--      medico_visitantes_traspaso_id_idx y las columnas fin_motivo y traspaso_id (vuelve a las columnas de 0800).
--   4. Tabla ejecutivas_traspasos (sus índices, restricciones y comentarios se van con ella).
--   NO toca 0800 ni 0810 (medico_visitantes, config_*, config_registrar siguen como estaban) ni
--   update_updated_at_column().
--
-- PÉRDIDAS (NOTICE con las cifras antes de borrar):
--   - El historial de traspasos (quién entregó, quién recibió, líneas, fecha, motivo, resumen). Exportar antes si
--     importa.
--   - En medico_visitantes, POR QUÉ terminó cada asignación (fin_motivo) y qué traspaso la terminó o la creó
--     (traspaso_id). Las asignaciones (desde/hasta) se quedan.
--   - Lo que hicieron los traspasos NO se deshace: personas nuevas y vacantes creadas, líneas sumadas y quitadas,
--     bajas, usuarios desactivados, ajustes manuales y visitantes movidos, nombres de territorio y excepciones
--     copiadas se quedan como están.
--   - Desde aquí, quitar una línea o dar de baja ya no termina los visitantes solos (vuelve el aviso "Revisar").
--
-- Re-ejecutable: sí (IF EXISTS en todo; los avisos solo cuentan lo que exista).
-- =====================================================================================

BEGIN;

-- -------------------------------------------------------------------------------------
-- 0. Aviso de lo que se pierde
-- -------------------------------------------------------------------------------------

DO $$
DECLARE
  v_n bigint;
  v_m bigint;
  v_k bigint;
BEGIN
  IF to_regclass('public.ejecutivas_traspasos') IS NOT NULL THEN
    EXECUTE 'SELECT count(*), count(*) FILTER (WHERE dar_de_baja) FROM public.ejecutivas_traspasos' INTO v_n, v_m;
    RAISE NOTICE 'Rollback 0820: se borra el historial de % traspaso(s) (% con baja); lo que hicieron NO se deshace', v_n, v_m;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'medico_visitantes' AND column_name = 'fin_motivo') THEN
    EXECUTE 'SELECT count(*) FILTER (WHERE fin_motivo IS NOT NULL),
                    count(*) FILTER (WHERE fin_motivo IN (''traspaso'', ''baja'', ''linea_quitada'')),
                    count(*) FILTER (WHERE traspaso_id IS NOT NULL)
             FROM public.medico_visitantes'
      INTO v_n, v_m, v_k;
    RAISE NOTICE 'Rollback 0820: se pierde el motivo de fin de % asignación(es) de visitante (% por traspaso, baja o línea quitada) y el traspaso_id de %; las asignaciones se quedan',
      v_n, v_m, v_k;
  END IF;
  RAISE NOTICE 'Rollback 0820: desde aquí quitar una línea o dar de baja ya no termina los visitantes solos';
END;
$$;

-- -------------------------------------------------------------------------------------
-- 1. Disparadores (solo si la tabla sigue existiendo: re-ejecutable)
-- -------------------------------------------------------------------------------------

DO $$
DECLARE
  v_par text[];
BEGIN
  FOREACH v_par SLICE 1 IN ARRAY ARRAY[
    ARRAY['executives_baja_termina_visitantes',      'executives'],
    ARRAY['executive_lines_termina_visitantes',      'executive_lines'],
    ARRAY['medico_visitantes_fin_motivo',            'medico_visitantes'],
    ARRAY['ejecutivas_traspasos_inmutable_truncate', 'ejecutivas_traspasos'],
    ARRAY['ejecutivas_traspasos_inmutable',          'ejecutivas_traspasos']]
  LOOP
    IF to_regclass('public.' || v_par[2]) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', v_par[1], v_par[2]);
    END IF;
  END LOOP;
END;
$$;

-- -------------------------------------------------------------------------------------
-- 2. Funciones
-- -------------------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.ejecutivas_traspasar(jsonb, uuid);
DROP FUNCTION IF EXISTS public.ejecutivas_baja_trg();
DROP FUNCTION IF EXISTS public.ejecutivas_linea_quitada_trg();
DROP FUNCTION IF EXISTS public.medico_visitantes_fin_motivo_trg();
DROP FUNCTION IF EXISTS public.ejecutivas_traspasos_inmutable();

-- -------------------------------------------------------------------------------------
-- 3. medico_visitantes vuelve a sus columnas de 0800
-- -------------------------------------------------------------------------------------

DO $$
BEGIN
  IF to_regclass('public.medico_visitantes') IS NOT NULL THEN
    ALTER TABLE public.medico_visitantes DROP CONSTRAINT IF EXISTS medico_visitantes_fin_motivo_check;
    ALTER TABLE public.medico_visitantes DROP CONSTRAINT IF EXISTS medico_visitantes_traspaso_id_fkey;
    DROP INDEX IF EXISTS public.medico_visitantes_traspaso_id_idx;
    ALTER TABLE public.medico_visitantes DROP COLUMN IF EXISTS fin_motivo;
    ALTER TABLE public.medico_visitantes DROP COLUMN IF EXISTS traspaso_id;
  END IF;
END;
$$;

-- -------------------------------------------------------------------------------------
-- 4. Tabla (sin CASCADE: si algo más depende de ella, aborta)
-- -------------------------------------------------------------------------------------

DROP TABLE IF EXISTS public.ejecutivas_traspasos;

-- -------------------------------------------------------------------------------------
-- 5. Comprobación: no queda nada de 0820
-- -------------------------------------------------------------------------------------

DO $$
DECLARE
  v_fn text;
  v_n  bigint;
BEGIN
  IF to_regclass('public.ejecutivas_traspasos') IS NOT NULL THEN
    RAISE EXCEPTION 'Rollback 0820: sigue existiendo public.ejecutivas_traspasos';
  END IF;
  FOREACH v_fn IN ARRAY ARRAY['public.ejecutivas_traspasar(jsonb, uuid)', 'public.ejecutivas_baja_trg()',
                              'public.ejecutivas_linea_quitada_trg()', 'public.medico_visitantes_fin_motivo_trg()',
                              'public.ejecutivas_traspasos_inmutable()'] LOOP
    IF to_regprocedure(v_fn) IS NOT NULL THEN
      RAISE EXCEPTION 'Rollback 0820: sigue existiendo la función %', v_fn;
    END IF;
  END LOOP;
  SELECT count(*) INTO v_n FROM pg_trigger
  WHERE NOT tgisinternal
    AND tgname IN ('executives_baja_termina_visitantes', 'executive_lines_termina_visitantes',
                   'medico_visitantes_fin_motivo', 'ejecutivas_traspasos_inmutable',
                   'ejecutivas_traspasos_inmutable_truncate');
  IF v_n > 0 THEN
    RAISE EXCEPTION 'Rollback 0820: quedan % disparador(es) de 0820', v_n;
  END IF;
  SELECT count(*) INTO v_n FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'medico_visitantes' AND column_name IN ('fin_motivo', 'traspaso_id');
  IF v_n > 0 THEN
    RAISE EXCEPTION 'Rollback 0820: medico_visitantes sigue con fin_motivo o traspaso_id';
  END IF;
  RAISE NOTICE 'Rollback 0820 OK: sin historial de traspasos, sin ejecutivas_traspasar ni sus disparadores; medico_visitantes con sus columnas de 0800.';
END;
$$;

COMMIT;
