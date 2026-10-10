-- =====================================================================================
-- OpMap · Endurecimiento Supabase · 05 — Funciones: search_path fijo y sin EXECUTE para anon
-- Proyecto: norvxqgohddgsdkggqzq · Generado: 2026-10-10 · NO EJECUTADO TODAVÍA
--
-- Qué cierra:
--   1. 12 funciones propias con search_path mutable (advisor WARN function_search_path_mutable).
--      Un search_path controlable permite que un objeto homónimo en otro esquema suplante a una
--      tabla o función dentro del cuerpo.                                     -> B-12, SEC-DB-12
--   2. Todas son ejecutables por anon/authenticated (y por PUBLIC, el valor por defecto de
--      Postgres) vía /rest/v1/rpc. Ninguna la llama el navegador.                       -> B-12
--
-- Lista confirmada con SELECT el 2026-10-10 (pg_proc, schema public, sin dependencia de
-- extensión, todas plpgsql, dueño postgres, proconfig NULL):
--   analizar_competencia_departamento(character varying)
--   calcular_indicadores_financieros()                 -- trigger
--   calcular_indicadores_mi_empresa()                  -- trigger
--   find_nearest_hospital(numeric, numeric, numeric)   -- RPC desde /api/visits/import
--   get_contract_end_date(date, integer)
--   get_contract_pdf_url(uuid)                         -- eliminada en 03 (se trata si existe)
--   get_territory_stats(character varying)
--   obtener_proveedores_calificados(numeric, numeric, numeric)
--   update_updated_at_column()                         -- trigger
--   update_visits_updated_at()                         -- trigger
--   validar_cumplimiento_contrato(uuid)                -- RPC desde rutas de contratos
--   validar_todos_contratos()                          -- RPC desde /api/mi-empresa
--
-- search_path = public, pg_temp: los cuerpos (backup-2026-10-10/functions.sql) solo usan
--   tablas de public sin calificar y funciones de pg_catalog (radians, acos, ...); PostGIS
--   también vive en public. pg_temp al final evita que una tabla temporal suplante a una real.
--
-- Revocar EXECUTE no afecta a los triggers: Postgres comprueba EXECUTE sobre la función de
--   trigger al crear el trigger, no al dispararlo. Las RPC del servidor van con service_role,
--   que recibe EXECUTE explícito.
-- PRERREQUISITO: /api/visits/import debe llamar a find_nearest_hospital con service_role
--   (rama audit/hardening-semana1); con la anon key fallaría con 42501.
-- Idempotente: sí. Rollback: ver 99_rollback.sql (sección 05).
-- =====================================================================================

BEGIN;

-- 1. search_path fijo
ALTER FUNCTION public.analizar_competencia_departamento(character varying)          SET search_path = public, pg_temp;
ALTER FUNCTION public.calcular_indicadores_financieros()                            SET search_path = public, pg_temp;
ALTER FUNCTION public.calcular_indicadores_mi_empresa()                             SET search_path = public, pg_temp;
ALTER FUNCTION public.find_nearest_hospital(numeric, numeric, numeric)              SET search_path = public, pg_temp;
ALTER FUNCTION public.get_contract_end_date(date, integer)                          SET search_path = public, pg_temp;
ALTER FUNCTION public.get_territory_stats(character varying)                        SET search_path = public, pg_temp;
ALTER FUNCTION public.obtener_proveedores_calificados(numeric, numeric, numeric)    SET search_path = public, pg_temp;
ALTER FUNCTION public.update_updated_at_column()                                    SET search_path = public, pg_temp;
ALTER FUNCTION public.update_visits_updated_at()                                    SET search_path = public, pg_temp;
ALTER FUNCTION public.validar_cumplimiento_contrato(uuid)                           SET search_path = public, pg_temp;
ALTER FUNCTION public.validar_todos_contratos()                                     SET search_path = public, pg_temp;

-- get_contract_pdf_url solo si 03 no se ha ejecutado todavía (lo normal es que ya no exista).
DO $$
BEGIN
  IF to_regprocedure('public.get_contract_pdf_url(uuid)') IS NOT NULL THEN
    ALTER FUNCTION public.get_contract_pdf_url(uuid) SET search_path = public, pg_temp;
    REVOKE EXECUTE ON FUNCTION public.get_contract_pdf_url(uuid) FROM PUBLIC, anon, authenticated;
  END IF;
END $$;

-- 2. EXECUTE solo para service_role (B-12: "revocar EXECUTE a anon en el resto de funciones")
REVOKE EXECUTE ON FUNCTION
  public.analizar_competencia_departamento(character varying),
  public.calcular_indicadores_financieros(),
  public.calcular_indicadores_mi_empresa(),
  public.find_nearest_hospital(numeric, numeric, numeric),
  public.get_contract_end_date(date, integer),
  public.get_territory_stats(character varying),
  public.obtener_proveedores_calificados(numeric, numeric, numeric),
  public.update_updated_at_column(),
  public.update_visits_updated_at(),
  public.validar_cumplimiento_contrato(uuid),
  public.validar_todos_contratos()
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.analizar_competencia_departamento(character varying),
  public.calcular_indicadores_financieros(),
  public.calcular_indicadores_mi_empresa(),
  public.find_nearest_hospital(numeric, numeric, numeric),
  public.get_contract_end_date(date, integer),
  public.get_territory_stats(character varying),
  public.obtener_proveedores_calificados(numeric, numeric, numeric),
  public.update_updated_at_column(),
  public.update_visits_updated_at(),
  public.validar_cumplimiento_contrato(uuid),
  public.validar_todos_contratos()
TO service_role;

-- Comprobaciones
DO $$
DECLARE
  mutables  text;
  ejecutables text;
BEGIN
  SELECT string_agg(p.oid::regprocedure::text, ', ')
    INTO mutables
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND pg_get_userbyid(p.proowner) = 'postgres'
     AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
     AND NOT coalesce(p.proconfig::text LIKE '%search_path=%', false);
  IF mutables IS NOT NULL THEN
    RAISE EXCEPTION 'Funciones propias con search_path mutable: %', mutables;
  END IF;

  SELECT string_agg(p.oid::regprocedure::text, ', ')
    INTO ejecutables
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND pg_get_userbyid(p.proowner) = 'postgres'
     AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
     AND (has_function_privilege('anon', p.oid, 'EXECUTE')
          OR has_function_privilege('authenticated', p.oid, 'EXECUTE'));
  IF ejecutables IS NOT NULL THEN
    RAISE EXCEPTION 'Funciones propias ejecutables por anon/authenticated: %', ejecutables;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;
