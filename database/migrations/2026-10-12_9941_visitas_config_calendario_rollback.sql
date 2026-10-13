-- =====================================================================================
-- OpMap · feat/visitas-f2-config-calendario (app de visita · F2 Configuración y calendario) · 9941 — Rollback de 0810
-- Proyecto: norvxqgohddgsdkggqzq · Generado: 2026-10-12
--
-- ANTES DE EJECUTAR: volver a desplegar el código anterior a este PR (sin /configuracion, /calendario,
--   /api/config-visitas/**, /api/calendario/**, /api/dias-libres/** ni /api/me/*): el código nuevo lee y escribe
--   estas tablas y llama a config_registrar(), config_cerrar() y calendario_cargar_festivos(); con el esquema viejo
--   fallaría. Si ya se aplicaron fases posteriores de la app de visita que referencian estas tablas o funciones
--   (visitas, KPIs), deshacerlas antes: los DROP van SIN CASCADE a propósito y abortan si algo más depende de ellos.
--   0820 (traspaso) usa config_registrar y las tablas config_* dentro de funciones, que el DROP no detecta: este
--   rollback aborta al inicio si 0820 sigue aplicada (correr antes 9942).
--
-- Qué deshace (una sola transacción, todo o nada), en orden inverso a 0810:
--   1. Rol hr: quien lo tenga pasa a 'viewer' (NOTICE con cada usuario) y users_role_check vuelve a los 8 roles
--      de antes (admin, user, viewer, sales_manager, contract_manager, data_manager, line_leader,
--      commercial_director).
--   2. Disparadores: config_inmutable (en las 4 tablas config_*), calendario_sin_borrar, dias_libres_sin_borrar y
--      update_dias_libres_updated_at.
--   3. Funciones: config_cerrar, config_registrar, calendario_cargar_festivos, calendario_festivos_colombia,
--      visitas_sin_borrar, config_inmutable. NO borra public.update_updated_at_column() (existía antes de 0810).
--   4. Tablas: dias_libres, calendario, config_personas, config_general, config_conteo, config_metas (sus índices,
--      restricciones de exclusión y comentarios se van con ellas).
--   NO borra la extensión btree_gist (puede usarla otra cosa; quitarla no es necesario para volver atrás).
--
-- PÉRDIDAS (NOTICE con las cifras antes de borrar):
--   - Toda la configuración registrada después de la semilla (metas, conteos, parámetros y excepciones por
--     persona, con su historia de vigencias, motivos y quién los cambió). Exportar antes si importa.
--   - Los días de empresa y de ciudad y las correcciones a festivos (anulaciones) hechas por recursos humanos o
--     la directora. Los festivos calculados vuelven re-aplicando 0810.
--   - Todos los días libres (registrados, por aprobar, aprobados, rechazados y anulados) con sus aprobaciones.
--   - El rol de recursos humanos de quien lo tenga (pasa a 'viewer').
--
-- Re-ejecutable: sí (IF EXISTS en todo; los avisos solo cuentan lo que exista).
-- =====================================================================================

BEGIN;

-- -------------------------------------------------------------------------------------
-- Guarda: si 0820 (traspaso de Ejecutivos Comerciales) sigue aplicada, aborta antes de tocar nada. Sus funciones y
-- disparadores usan config_registrar, config_personas y config_metas dentro de cuerpos PL/pgSQL, que no crean dependencias: el DROP sin CASCADE no lo
-- detectaría y quedarían disparadores rotos en executives y executive_lines (toda baja o línea quitada fallaría).
-- Orden obligatorio: 9942 (rollback de 0820) antes que este.
-- -------------------------------------------------------------------------------------

-- [guarda 0820: inicio]
DO $$
BEGIN
  IF to_regprocedure('public.ejecutivas_traspasar(jsonb, uuid)') IS NOT NULL
     OR to_regclass('public.ejecutivas_traspasos') IS NOT NULL
     OR EXISTS (SELECT 1 FROM pg_trigger t
                WHERE NOT t.tgisinternal
                  AND t.tgname IN ('executive_lines_termina_visitantes', 'executives_baja_termina_visitantes')) THEN
    RAISE EXCEPTION 'Rollback 0810: 0820 (traspaso de Ejecutivos Comerciales) sigue aplicada; deshazla antes con 2026-10-12_9942_traspaso_ejecutivas_rollback.sql (usa config_registrar, config_personas y config_metas)';
  END IF;
END;
$$;
-- [guarda 0820: fin]

-- -------------------------------------------------------------------------------------
-- 0. Aviso de lo que se pierde
-- -------------------------------------------------------------------------------------

DO $$
DECLARE
  v_tabla text;
  v_n     bigint;
  v_m     bigint;
BEGIN
  FOREACH v_tabla IN ARRAY ARRAY['config_metas', 'config_conteo', 'config_general', 'config_personas'] LOOP
    IF to_regclass('public.' || v_tabla) IS NOT NULL THEN
      EXECUTE format('SELECT count(*), count(*) FILTER (WHERE motivo IS DISTINCT FROM %L) FROM public.%I',
                     'Valor inicial (decisión del dueño 2026-10-12)', v_tabla)
        INTO v_n, v_m;
      RAISE NOTICE 'Rollback 0810: se borran % fila(s) de % (% registradas después de la semilla)', v_n, v_tabla, v_m;
    END IF;
  END LOOP;
  IF to_regclass('public.calendario') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FILTER (WHERE origen = ''manual''), count(*) FILTER (WHERE anulado_at IS NOT NULL)
             FROM public.calendario'
      INTO v_n, v_m;
    RAISE NOTICE 'Rollback 0810: se borran % día(s) manuales del calendario y % anulación(es) (los festivos calculados vuelven re-aplicando 0810)',
      v_n, v_m;
  END IF;
  IF to_regclass('public.dias_libres') IS NOT NULL THEN
    EXECUTE 'SELECT count(*), count(*) FILTER (WHERE estado IN (''registrado'', ''por_aprobar'', ''aprobado''))
             FROM public.dias_libres'
      INTO v_n, v_m;
    RAISE NOTICE 'Rollback 0810: se borran % día(s) libres (% vigentes) con sus aprobaciones', v_n, v_m;
  END IF;
  RAISE NOTICE 'Rollback 0810: la extensión btree_gist NO se borra';
END;
$$;

-- -------------------------------------------------------------------------------------
-- 1. Rol hr: a 'viewer' y users_role_check con los 8 roles de antes
-- -------------------------------------------------------------------------------------

DO $$
DECLARE
  v_fila record;
  v_n    bigint := 0;
BEGIN
  FOR v_fila IN SELECT u.id, u.email FROM public.users u WHERE u.role = 'hr' ORDER BY u.email LOOP
    RAISE NOTICE 'Rollback 0810: el usuario % (%) tenía el rol hr (recursos humanos) y pasa a viewer', v_fila.email, v_fila.id;
    v_n := v_n + 1;
  END LOOP;
  UPDATE public.users SET role = 'viewer' WHERE role = 'hr';
  RAISE NOTICE 'Rollback 0810: % usuario(s) con rol hr pasados a viewer', v_n;
END;
$$;

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_role_check,
  ADD CONSTRAINT users_role_check
    CHECK (role IN ('admin', 'user', 'viewer', 'sales_manager', 'contract_manager', 'data_manager', 'line_leader',
                    'commercial_director'));

-- -------------------------------------------------------------------------------------
-- 2. Disparadores (solo si la tabla sigue existiendo: re-ejecutable)
-- -------------------------------------------------------------------------------------

DO $$
DECLARE
  v_par text[];
BEGIN
  FOREACH v_par SLICE 1 IN ARRAY ARRAY[
    ARRAY['update_dias_libres_updated_at', 'dias_libres'],
    ARRAY['dias_libres_sin_borrar',        'dias_libres'],
    ARRAY['calendario_sin_borrar',         'calendario'],
    ARRAY['config_inmutable',              'config_personas'],
    ARRAY['config_inmutable',              'config_general'],
    ARRAY['config_inmutable',              'config_conteo'],
    ARRAY['config_inmutable',              'config_metas']]
  LOOP
    IF to_regclass('public.' || v_par[2]) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', v_par[1], v_par[2]);
    END IF;
  END LOOP;
END;
$$;

-- -------------------------------------------------------------------------------------
-- 3. Funciones (update_updated_at_column() NO: existía antes de 0810)
-- -------------------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.config_cerrar(text, uuid, date, text, uuid);
DROP FUNCTION IF EXISTS public.config_registrar(text, jsonb, date, date, text, uuid);
DROP FUNCTION IF EXISTS public.calendario_cargar_festivos(int, uuid);
DROP FUNCTION IF EXISTS public.calendario_festivos_colombia(int);
DROP FUNCTION IF EXISTS public.visitas_sin_borrar();
DROP FUNCTION IF EXISTS public.config_inmutable();

-- -------------------------------------------------------------------------------------
-- 4. Tablas (sin CASCADE: si algo más depende de ellas, aborta)
-- -------------------------------------------------------------------------------------

DROP TABLE IF EXISTS public.dias_libres;
DROP TABLE IF EXISTS public.calendario;
DROP TABLE IF EXISTS public.config_personas;
DROP TABLE IF EXISTS public.config_general;
DROP TABLE IF EXISTS public.config_conteo;
DROP TABLE IF EXISTS public.config_metas;

-- -------------------------------------------------------------------------------------
-- 5. Comprobación: no queda nada de 0810 y users_role_check volvió a los 8 roles
-- -------------------------------------------------------------------------------------

DO $$
DECLARE
  v_tabla text;
  v_roles text[];
  v_ocho  constant text[] := ARRAY['admin', 'user', 'viewer', 'sales_manager', 'contract_manager', 'data_manager',
                                   'line_leader', 'commercial_director'];
BEGIN
  FOREACH v_tabla IN ARRAY ARRAY['config_metas', 'config_conteo', 'config_general', 'config_personas', 'calendario',
                                 'dias_libres']
  LOOP
    IF to_regclass('public.' || v_tabla) IS NOT NULL THEN
      RAISE EXCEPTION 'Rollback 0810: sigue existiendo public.%', v_tabla;
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public'
               AND p.proname IN ('config_registrar', 'config_cerrar', 'calendario_festivos_colombia',
                                 'calendario_cargar_festivos', 'config_inmutable', 'visitas_sin_borrar')) THEN
    RAISE EXCEPTION 'Rollback 0810: sigue existiendo alguna función de 0810';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger
             WHERE NOT tgisinternal
               AND tgname IN ('config_inmutable', 'calendario_sin_borrar', 'dias_libres_sin_borrar',
                              'update_dias_libres_updated_at')) THEN
    RAISE EXCEPTION 'Rollback 0810: sigue existiendo algún disparador de 0810';
  END IF;
  SELECT array_agg(x.r[1]) INTO v_roles
  FROM pg_constraint c
  CROSS JOIN LATERAL regexp_matches(pg_get_constraintdef(c.oid), '''([a-z_]+)''', 'g') AS x(r)
  WHERE c.conrelid = 'public.users'::regclass AND c.conname = 'users_role_check';
  IF v_roles IS NULL OR NOT (v_roles @> v_ocho AND v_roles <@ v_ocho) THEN
    RAISE EXCEPTION 'Rollback 0810: users_role_check no volvió a los 8 roles (tiene %)', v_roles;
  END IF;
  IF EXISTS (SELECT 1 FROM public.users WHERE role = 'hr') THEN
    RAISE EXCEPTION 'Rollback 0810: quedan usuarios con el rol hr';
  END IF;
  IF to_regprocedure('public.update_updated_at_column()') IS NULL THEN
    RAISE EXCEPTION 'Rollback 0810: se perdió public.update_updated_at_column() (no debía tocarse)';
  END IF;
  RAISE NOTICE 'Rollback 0810 OK: 6 tablas, 6 funciones y 7 disparadores quitados; users_role_check con los 8 roles de antes; btree_gist se conserva.';
END;
$$;

COMMIT;
