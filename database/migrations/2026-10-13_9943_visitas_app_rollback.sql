-- =====================================================================================
-- OpMap · feat/visitas-f3-f4-app-movil (app de visita · F3) · 9943 — Rollback de 0830
-- Proyecto: norvxqgohddgsdkggqzq · Generado: 2026-10-13 · ESTADO: NO APLICADA
--
-- ANTES DE EJECUTAR: volver a desplegar el código anterior a este PR (sin /api/me/contexto, /api/me/visitas*,
--   /api/me/voz/*, /api/me/numeros ni la app móvil): el código nuevo llama a visitas_registrar(), visitas_editar(),
--   visitas_anular(), visitas_config_vigente() y lee visit_lines y las columnas nuevas de visits; con el esquema
--   viejo fallaría. Los DROP van SIN CASCADE a propósito y abortan si algo más depende de lo que se quita.
--
-- Qué deshace (una sola transacción, todo o nada), en orden inverso a 0830:
--   1. Disparadores de visits: visits_app_sin_borrar y update_visits_updated_at.
--   2. Las visitas de la app (source = 'app') se BORRAN de visits (sus visit_lines se van en cascada): sin las
--      columnas nuevas quedarían como si fueran de VMO, con el nombre de la ejecutiva en kam_name.
--   3. Funciones: visitas_registrar, visitas_editar, visitas_anular, visitas_config_vigente, visitas_distancia_m.
--   4. Tabla visit_lines.
--   5. visits: CHECK visits_app_check y visits_source_check, los 5 índices, las 29 columnas (sus llaves se van con
--      ellas) y el comentario original de la tabla. Vuelve a sus 14 columnas.
--   NO toca 0800, 0810 ni 0820 (medicos, sedes, cuentas, contactos, subtipos, config_*, config_registrar,
--   visitas_sin_borrar() y los traspasos siguen como estaban) ni update_updated_at_column().
--
-- PÉRDIDAS (NOTICE con las cifras antes de borrar):
--   - TODAS las visitas reportadas desde la app (efectivas, no efectivas y anuladas), con su transcripción,
--     conclusión, compromisos, próxima reunión, distancia y líneas. Exportar antes si importan.
--   - Las 7.033 visitas importadas de VMO NO cambian (se comprueba al final: mismas filas y mismos valores en las 14
--     columnas originales).
--
-- Orden: 9943 antes que 9942, 9941 y 9940 (las funciones de 0830 usan tablas de 0800 y 0810 dentro de su cuerpo,
--   que un DROP no detecta; las llaves de visits hacia medicos, sedes, cuentas, contactos y subtipos sí lo detienen).
-- Re-ejecutable: sí (IF EXISTS en todo; los avisos solo cuentan lo que exista).
-- =====================================================================================

BEGIN;

-- -------------------------------------------------------------------------------------
-- 0. Aviso de lo que se pierde y huella de las importadas
-- -------------------------------------------------------------------------------------

DO $$
DECLARE
  v_n     bigint;
  v_anul  bigint;
  v_lin   bigint;
  v_imp   bigint;
  v_md5   text;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'visits' AND column_name = 'source') THEN
    EXECUTE 'SELECT count(*) FILTER (WHERE source = ''app''),
                    count(*) FILTER (WHERE source = ''app'' AND deleted_at IS NOT NULL),
                    count(*) FILTER (WHERE source <> ''app'')
             FROM public.visits'
      INTO v_n, v_anul, v_imp;
    EXECUTE 'SELECT md5(string_agg(v.id::text || v.visit_type || v.contact_type || v.visit_date::text, '','' ORDER BY v.id))
             FROM public.visits v WHERE v.source <> ''app'''
      INTO v_md5;
    RAISE NOTICE 'Rollback 0830: se BORRAN % visita(s) de la app (% anulada(s)); las % importadas de VMO se quedan (huella %)',
      v_n, v_anul, v_imp, coalesce(v_md5, '-');
  ELSE
    SELECT count(*), md5(string_agg(v.id::text || v.visit_type || v.contact_type || v.visit_date::text, ',' ORDER BY v.id))
    INTO v_imp, v_md5
    FROM public.visits v;
    RAISE NOTICE 'Rollback 0830: visits ya no tiene las columnas de 0830; % visita(s) se quedan (huella %)', v_imp, coalesce(v_md5, '-');
  END IF;
  PERFORM set_config('opmap9943.importadas', coalesce(v_imp, 0)::text || '|' || coalesce(v_md5, '-'), true);
  IF to_regclass('public.visit_lines') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.visit_lines' INTO v_lin;
    RAISE NOTICE 'Rollback 0830: se pierden % fila(s) de visit_lines (líneas de las visitas de la app)', v_lin;
  END IF;
END;
$$;

-- -------------------------------------------------------------------------------------
-- 1. Disparadores de visits (el de borrado primero: el paso 2 borra las visitas de la app)
-- -------------------------------------------------------------------------------------

DROP TRIGGER IF EXISTS visits_app_sin_borrar ON public.visits;
DROP TRIGGER IF EXISTS update_visits_updated_at ON public.visits;

-- -------------------------------------------------------------------------------------
-- 2. Visitas de la app (y sus visit_lines, en cascada)
-- -------------------------------------------------------------------------------------

DO $$
DECLARE
  v_n bigint;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'visits' AND column_name = 'source') THEN
    EXECUTE 'DELETE FROM public.visits WHERE source = ''app''';
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RAISE NOTICE 'Rollback 0830: % visita(s) de la app borrada(s)', v_n;
  END IF;
END;
$$;

-- -------------------------------------------------------------------------------------
-- 3. Funciones
-- -------------------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.visitas_registrar(jsonb, uuid);
DROP FUNCTION IF EXISTS public.visitas_editar(uuid, jsonb, uuid);
DROP FUNCTION IF EXISTS public.visitas_anular(uuid, text, uuid);
DROP FUNCTION IF EXISTS public.visitas_config_vigente(uuid, date);
DROP FUNCTION IF EXISTS public.visitas_distancia_m(double precision, double precision, double precision, double precision);

-- -------------------------------------------------------------------------------------
-- 4. visit_lines (sin CASCADE: si algo más depende de ella, aborta)
-- -------------------------------------------------------------------------------------

DROP TABLE IF EXISTS public.visit_lines;

-- -------------------------------------------------------------------------------------
-- 5. visits vuelve a sus 14 columnas
-- -------------------------------------------------------------------------------------

ALTER TABLE public.visits DROP CONSTRAINT IF EXISTS visits_app_check;
ALTER TABLE public.visits DROP CONSTRAINT IF EXISTS visits_source_check;
DROP INDEX IF EXISTS public.visits_client_id_uidx;
DROP INDEX IF EXISTS public.visits_executive_date_idx;
DROP INDEX IF EXISTS public.visits_medico_idx;
DROP INDEX IF EXISTS public.visits_cuenta_idx;
DROP INDEX IF EXISTS public.visits_next_step_idx;

ALTER TABLE public.visits
  DROP COLUMN IF EXISTS source,
  DROP COLUMN IF EXISTS executive_id,
  DROP COLUMN IF EXISTS client_id,
  DROP COLUMN IF EXISTS tipo,
  DROP COLUMN IF EXISTS subtipo_id,
  DROP COLUMN IF EXISTS subtipo_codigo,
  DROP COLUMN IF EXISTS medico_id,
  DROP COLUMN IF EXISTS cuenta_id,
  DROP COLUMN IF EXISTS sede_id,
  DROP COLUMN IF EXISTS contacto_id,
  DROP COLUMN IF EXISTS modalidad,
  DROP COLUMN IF EXISTS medio,
  DROP COLUMN IF EXISTS efectiva,
  DROP COLUMN IF EXISTS failure_reason,
  DROP COLUMN IF EXISTS retry_date,
  DROP COLUMN IF EXISTS checked_in_at,
  DROP COLUMN IF EXISTS reported_at,
  DROP COLUMN IF EXISTS distance_m,
  DROP COLUMN IF EXISTS gps_accuracy_m,
  DROP COLUMN IF EXISTS conclusion,
  DROP COLUMN IF EXISTS compromisos,
  DROP COLUMN IF EXISTS next_step_date,
  DROP COLUMN IF EXISTS transcript,
  DROP COLUMN IF EXISTS input_mode,
  DROP COLUMN IF EXISTS out_of_territory,
  DROP COLUMN IF EXISTS created_by,
  DROP COLUMN IF EXISTS updated_by,
  DROP COLUMN IF EXISTS deleted_at,
  DROP COLUMN IF EXISTS deleted_reason;

COMMENT ON TABLE public.visits IS 'Registro simplificado de visitas de KAMs';

-- -------------------------------------------------------------------------------------
-- 6. Comprobación: no queda nada de 0830 y las importadas siguen
-- -------------------------------------------------------------------------------------

DO $$
DECLARE
  v_fn    text;
  v_n     bigint;
  v_md5   text;
  v_antes text[];
BEGIN
  IF to_regclass('public.visit_lines') IS NOT NULL THEN
    RAISE EXCEPTION 'Rollback 0830: sigue existiendo public.visit_lines';
  END IF;
  FOREACH v_fn IN ARRAY ARRAY['public.visitas_registrar(jsonb, uuid)', 'public.visitas_editar(uuid, jsonb, uuid)',
                              'public.visitas_anular(uuid, text, uuid)', 'public.visitas_config_vigente(uuid, date)',
                              'public.visitas_distancia_m(double precision, double precision, double precision, double precision)'] LOOP
    IF to_regprocedure(v_fn) IS NOT NULL THEN
      RAISE EXCEPTION 'Rollback 0830: sigue existiendo la función %', v_fn;
    END IF;
  END LOOP;
  SELECT count(*) INTO v_n FROM pg_trigger
  WHERE tgrelid = 'public.visits'::regclass AND NOT tgisinternal
    AND tgname IN ('visits_app_sin_borrar', 'update_visits_updated_at');
  IF v_n > 0 THEN
    RAISE EXCEPTION 'Rollback 0830: quedan % disparador(es) de 0830 en visits', v_n;
  END IF;
  SELECT count(*) INTO v_n FROM information_schema.columns c
  WHERE c.table_schema = 'public' AND c.table_name = 'visits'
    AND c.column_name = ANY (ARRAY['id', 'kam_id', 'kam_name', 'visit_type', 'contact_type', 'lat', 'lng', 'visit_date',
                                   'hospital_id', 'imported_by', 'imported_at', 'created_at', 'updated_at', 'import_id']);
  IF v_n <> 14 OR (SELECT count(*) FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'visits') <> 14 THEN
    RAISE EXCEPTION 'Rollback 0830: visits no volvió a sus 14 columnas originales';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.visits'::regclass
               AND conname IN ('visits_app_check', 'visits_source_check'))
     OR EXISTS (SELECT 1 FROM pg_class WHERE relname IN ('visits_client_id_uidx', 'visits_executive_date_idx',
                  'visits_medico_idx', 'visits_cuenta_idx', 'visits_next_step_idx') AND relnamespace = 'public'::regnamespace) THEN
    RAISE EXCEPTION 'Rollback 0830: quedan restricciones o índices de 0830 en visits';
  END IF;

  v_antes := string_to_array(current_setting('opmap9943.importadas', true), '|');
  SELECT count(*), coalesce(md5(string_agg(v.id::text || v.visit_type || v.contact_type || v.visit_date::text, ',' ORDER BY v.id)), '-')
  INTO v_n, v_md5
  FROM public.visits v;
  IF v_antes IS NULL OR v_n::text <> v_antes[1] OR v_md5 <> v_antes[2] THEN
    RAISE EXCEPTION 'Rollback 0830: las visitas importadas cambiaron (antes %, después % / %)',
      array_to_string(v_antes, ' / '), v_n, v_md5;
  END IF;
  RAISE NOTICE 'Rollback 0830 OK: sin visit_lines, sin las 5 funciones ni los 2 disparadores; visits con sus 14 columnas y % visita(s) importada(s) intactas (huella %).',
    v_n, v_md5;
END;
$$;

COMMIT;
