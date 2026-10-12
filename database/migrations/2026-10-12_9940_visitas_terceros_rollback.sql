-- =====================================================================================
-- OpMap · feat/visitas-f1-terceros (app de visita · F1 Terceros) · 9940 — Rollback de 0800
-- Proyecto: norvxqgohddgsdkggqzq · Generado: 2026-10-12
--
-- ANTES DE EJECUTAR: volver a desplegar el código anterior a este PR (sin /terceros ni /api/terceros/**): el
--   código nuevo lee y escribe estas tablas y llama a terceros_crear_medico(); con el esquema viejo fallaría.
--   Si ya se aplicaron fases posteriores de la app de visita que referencian estas tablas (visitas con
--   medico_id, sede_id, cuenta_id, contacto_id o subtipo_id), deshacerlas antes: los DROP TABLE van SIN
--   CASCADE a propósito y abortan si algo más depende de ellas.
--
-- Qué deshace (una sola transacción, todo o nada), en orden inverso a 0800:
--   1. Disparadores: hospitals_terceros_sync (sobre hospitals), contactos_sede_de_la_cuenta, los constraint
--      triggers medicos_requiere_sede y medico_sedes_requiere_sede y los 7 update_*_updated_at.
--   2. Funciones: terceros_hospitals_sync_trg(), terceros_sincronizar_hospitals(uuid),
--      terceros_crear_medico(jsonb, jsonb, uuid), terceros_contacto_sede_de_la_cuenta(),
--      terceros_medico_requiere_sede(). NO borra public.update_updated_at_column() (existía antes de 0800).
--   3. Tablas, de las que dependen a las que no: medico_visitantes, medico_sedes, contactos, medicos, sedes,
--      cuentas, subtipos_institucionales (sus índices, constraints y comentarios se van con ellas).
--   hospitals queda exactamente como antes de 0800: 0800 nunca escribió en hospitals (solo le puso el
--   disparador, que aquí se quita).
--
-- PÉRDIDAS (NOTICE con las cifras antes de borrar):
--   - Todo lo creado a mano en /terceros: médicos (con su documento), sus sedes y visitantes, contactos, cuentas
--     y sedes manuales o de la app, marcas de cliente, modalidades, sedes principales y ubicaciones confirmadas.
--     Exportar antes si importa. No se pueden reconstruir.
--   - Las cuentas y sedes cargadas desde hospitals se recuperan solas re-aplicando 0800 (salen de hospitals).
--   - Los subtipos editados por la directora (la semilla vuelve con 0800).
--
-- Re-ejecutable: sí (IF EXISTS en todo; el aviso inicial solo cuenta lo que exista).
-- =====================================================================================

BEGIN;

-- Aviso de lo que se pierde
DO $$
DECLARE
  v_n bigint;
BEGIN
  IF to_regclass('public.medicos') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.medicos' INTO v_n;
    RAISE NOTICE 'Rollback 0800: se borran % médico(s) (con su documento) y sus sedes', v_n;
  END IF;
  IF to_regclass('public.medico_visitantes') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.medico_visitantes' INTO v_n;
    RAISE NOTICE 'Rollback 0800: se borran % asignación(es) de visitantes', v_n;
  END IF;
  IF to_regclass('public.contactos') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.contactos' INTO v_n;
    RAISE NOTICE 'Rollback 0800: se borran % contacto(s)', v_n;
  END IF;
  IF to_regclass('public.cuentas') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.cuentas WHERE origen <> ''hospitals''' INTO v_n;
    RAISE NOTICE 'Rollback 0800: se borran % cuenta(s) creadas a mano (las de hospitals vuelven re-aplicando 0800)', v_n;
  END IF;
  IF to_regclass('public.sedes') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.sedes WHERE origen <> ''hospitals''' INTO v_n;
    RAISE NOTICE 'Rollback 0800: se borran % sede(s) creadas a mano o desde la app', v_n;
  END IF;
END;
$$;

-- -------------------------------------------------------------------------------------
-- 1. Disparadores
-- -------------------------------------------------------------------------------------

DROP TRIGGER IF EXISTS hospitals_terceros_sync ON public.hospitals;

-- Los de las tablas nuevas, solo si la tabla sigue existiendo (re-ejecutable).
DO $$
DECLARE
  v_par text[];
BEGIN
  FOREACH v_par SLICE 1 IN ARRAY ARRAY[
    ARRAY['contactos_sede_de_la_cuenta',                'contactos'],
    ARRAY['medico_sedes_requiere_sede',                 'medico_sedes'],
    ARRAY['medicos_requiere_sede',                      'medicos'],
    ARRAY['update_subtipos_institucionales_updated_at', 'subtipos_institucionales'],
    ARRAY['update_contactos_updated_at',                'contactos'],
    ARRAY['update_medico_visitantes_updated_at',        'medico_visitantes'],
    ARRAY['update_medico_sedes_updated_at',             'medico_sedes'],
    ARRAY['update_medicos_updated_at',                  'medicos'],
    ARRAY['update_sedes_updated_at',                    'sedes'],
    ARRAY['update_cuentas_updated_at',                  'cuentas']]
  LOOP
    IF to_regclass('public.' || v_par[2]) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', v_par[1], v_par[2]);
    END IF;
  END LOOP;
END;
$$;

-- -------------------------------------------------------------------------------------
-- 2. Funciones (update_updated_at_column() NO: existía antes de 0800)
-- -------------------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.terceros_hospitals_sync_trg();
DROP FUNCTION IF EXISTS public.terceros_sincronizar_hospitals(uuid);
DROP FUNCTION IF EXISTS public.terceros_crear_medico(jsonb, jsonb, uuid);
DROP FUNCTION IF EXISTS public.terceros_contacto_sede_de_la_cuenta();
DROP FUNCTION IF EXISTS public.terceros_medico_requiere_sede();

-- -------------------------------------------------------------------------------------
-- 3. Tablas (sin CASCADE: si algo más depende de ellas, aborta)
-- -------------------------------------------------------------------------------------

DROP TABLE IF EXISTS public.medico_visitantes;
DROP TABLE IF EXISTS public.medico_sedes;
DROP TABLE IF EXISTS public.contactos;
DROP TABLE IF EXISTS public.medicos;
DROP TABLE IF EXISTS public.sedes;
DROP TABLE IF EXISTS public.cuentas;
DROP TABLE IF EXISTS public.subtipos_institucionales;

-- -------------------------------------------------------------------------------------
-- 4. Comprobación: no queda nada de 0800 y hospitals sigue con solo su disparador previo
-- -------------------------------------------------------------------------------------

DO $$
DECLARE
  v_tabla text;
BEGIN
  FOREACH v_tabla IN ARRAY ARRAY['cuentas', 'sedes', 'medicos', 'medico_sedes', 'medico_visitantes', 'contactos',
                                 'subtipos_institucionales']
  LOOP
    IF to_regclass('public.' || v_tabla) IS NOT NULL THEN
      RAISE EXCEPTION 'Rollback 0800: sigue existiendo public.%', v_tabla;
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public'
               AND p.proname IN ('terceros_hospitals_sync_trg', 'terceros_sincronizar_hospitals',
                                 'terceros_crear_medico', 'terceros_contacto_sede_de_la_cuenta',
                                 'terceros_medico_requiere_sede')) THEN
    RAISE EXCEPTION 'Rollback 0800: sigue existiendo alguna función terceros_*';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.hospitals'::regclass AND tgname = 'hospitals_terceros_sync') THEN
    RAISE EXCEPTION 'Rollback 0800: sigue el disparador hospitals_terceros_sync';
  END IF;
  IF to_regprocedure('public.update_updated_at_column()') IS NULL THEN
    RAISE EXCEPTION 'Rollback 0800: se perdió public.update_updated_at_column() (no debía tocarse)';
  END IF;
  RAISE NOTICE 'Rollback 0800 OK: 7 tablas, 5 funciones y el disparador de hospitals quitados; hospitals sin cambios.';
END;
$$;

COMMIT;
