-- =====================================================================================
-- OpMap · Endurecimiento Supabase · 03 — Privilegios (GRANT) de anon y authenticated
-- Proyecto: norvxqgohddgsdkggqzq · Generado: 2026-10-10 · NO EJECUTADO TODAVÍA
--
-- Qué cierra:
--   1. anon y authenticated tienen arwdDxtm (SELECT, INSERT, UPDATE, DELETE, TRUNCATE,
--      REFERENCES, TRIGGER, MAINTAIN) sobre TODAS las tablas y vistas de public (confirmado con
--      information_schema.role_table_grants: 43 objetos × 2 roles). TRUNCATE no respeta RLS:
--      con la anon key se podía vaciar cualquier tabla.                            -> C-03, SEC-DB-09
--   2. pg_default_acl de postgres en public concede ALL a anon/authenticated en tablas,
--      secuencias (rwU) y funciones (X): cada objeto nuevo nace abierto.                -> C-03
--   3. Tablas internas y vistas legibles por anon (además del RLS de 02, se quita el GRANT,
--      defensa en profundidad).                                               -> C-04, C-05, A-01
--   4. get_contract_pdf_url(uuid): SECURITY DEFINER, ejecutable por anon, y rota (lee la columna
--      hospital_contracts.pdf_url, que no existe; confirmado: 0 columnas). Sin llamadores en
--      web/ ni en los scripts Python.                                                    -> B-12
--
-- Estado final esperado para anon/authenticated en public:
--   SOLO SELECT en departments, municipalities, department_adjacency, hospitals, kams.
--   Nada en el resto de tablas ni en ninguna vista.
--   Por qué ninguna vista queda para el navegador: la única vista leída desde un componente
--   'use client' era territory_statistics (app/territories/page.tsx), que la rama
--   audit/hardening-semana1 pasa a una ruta de servidor. Las demás (contract_compliance,
--   hospital_activity, v_cumplimiento_contratos, visit_imports_summary, zone_statistics,
--   zone_territory_assignments) solo se leen desde rutas API, que deben usar service_role.
--
-- Avisos esperados al ejecutar (WARNING, no error): "no privileges could be revoked" para
--   spatial_ref_sys, geometry_columns y geography_columns. Son de PostGIS (dueño
--   supabase_admin, que concedió esos privilegios) y postgres no puede revocarlos. Ver 00_README.
--
-- PRERREQUISITO: desplegar antes el código de la rama audit/hardening-semana1 (ninguna ruta de
--   servidor con la anon key ni componente de navegador leyendo tablas internas). Ver 00_README.
-- Idempotente: sí. Rollback: ver 99_rollback.sql (sección 03).
-- =====================================================================================

BEGIN;

-- 1. Escritura fuera para anon/authenticated en TODO public (tablas y vistas). MAINTAIN es
--    el privilegio 'm' de Postgres 17 (VACUUM/ANALYZE/REINDEX/...).
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
  ON ALL TABLES IN SCHEMA public FROM anon, authenticated;

-- 2. Tablas internas: fuera también SELECT (C-03, C-05, A-01).
--    Lista del encargo + users, visits, visit_imports, hospital_contracts, opportunities y
--    assignments: el navegador no puede leerlas hoy (RLS solo para authenticated, que no
--    existe sin Supabase Auth, o RLS activado en 02), así que el SELECT solo sirve de puerta
--    si alguien añade una política permisiva por error.
REVOKE ALL ON TABLE
  public.mi_empresa_config,
  public.proveedores,
  public.proveedor_finanzas,
  public.proveedor_indicadores,
  public.proveedor_contactos,
  public.proveedor_enlaces,
  public.hospital_comments,
  public.forced_assignments,
  public.zones,
  public.hospital_kam_distances,
  public.hospital_history,
  public.users,
  public.visits,
  public.visit_imports,
  public.hospital_contracts,
  public.opportunities,
  public.assignments
FROM anon, authenticated;

-- 3. Vistas propias: fuera todo (C-04). Se leen solo desde el servidor con service_role.
REVOKE ALL ON TABLE
  public.contract_compliance,
  public.hospital_activity,
  public.hospital_contracts_view,
  public.kam_statistics,
  public.kams_with_zones,
  public.territory_assignments,
  public.territory_statistics,
  public.territory_stats,
  public.v_competencia_hospitales,
  public.v_cumplimiento_contratos,
  public.v_hospital_contracts_extended,
  public.v_proveedor_resumen_contratos,
  public.v_proveedores_ultimos_indicadores,
  public.v_ranking_proveedores,
  public.visit_imports_summary,
  public.visit_summary,
  public.zone_statistics,
  public.zone_territory_assignments
FROM anon, authenticated;

-- 4. Lectura pública que se conserva (idempotente; ya existe hoy). El RLS de estas tablas ya
--    tiene políticas SELECT para anon/authenticated.
GRANT SELECT ON TABLE
  public.departments,
  public.municipalities,
  public.department_adjacency,
  public.hospitals,
  public.kams
TO anon, authenticated;

-- 5. Privilegios por defecto de los objetos que cree postgres en public (C-03).
--    Los de supabase_admin (también conceden ALL) no se pueden cambiar como postgres: postgres
--    no es miembro de supabase_admin y el ALTER fallaría abortando la transacción. Solo afectan
--    a objetos que cree supabase_admin (extensiones, internos de la plataforma).
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;
-- Nota: las funciones nuevas siguen recibiendo EXECUTE para PUBLIC por el valor por defecto
-- global de Postgres. Quitarlo exige un ALTER DEFAULT PRIVILEGES sin IN SCHEMA, que afecta a
-- todos los esquemas de postgres; se deja como opción consciente (descomentar si se acepta):
-- ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- 6. get_contract_pdf_url (B-12): revocar y eliminar, solo si la columna pdf_url sigue sin
--    existir (si existiera, la función no estaría rota y hay que revisarla antes de borrarla).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'hospital_contracts' AND column_name = 'pdf_url'
  ) THEN
    RAISE EXCEPTION 'hospital_contracts.pdf_url existe: revisar get_contract_pdf_url antes de eliminarla';
  END IF;

  IF to_regprocedure('public.get_contract_pdf_url(uuid)') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.get_contract_pdf_url(uuid) FROM PUBLIC, anon, authenticated;
    DROP FUNCTION public.get_contract_pdf_url(uuid);
  END IF;
END $$;

-- Comprobaciones: se aborta la transacción si anon/authenticated conservan algo indebido en los
-- objetos propios (dueño postgres) de public.
DO $$
DECLARE
  indebidos text;
BEGIN
  SELECT string_agg(r.rolname || ':' || c.relname || ':' || p.priv, ', ' ORDER BY c.relname)
    INTO indebidos
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    CROSS JOIN (VALUES ('anon'), ('authenticated')) AS r(rolname)
    CROSS JOIN (VALUES ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'),
                       ('REFERENCES'), ('TRIGGER'), ('MAINTAIN')) AS p(priv)
   WHERE n.nspname = 'public'
     AND c.relkind IN ('r', 'p', 'v', 'm')
     AND pg_get_userbyid(c.relowner) = 'postgres'
     -- Se mira la ACL directa (no la herencia): postgres es miembro de anon/authenticated.
     AND EXISTS (
       SELECT 1 FROM aclexplode(c.relacl) a
        WHERE a.grantee = (SELECT oid FROM pg_roles WHERE rolname = r.rolname)
          AND a.privilege_type = p.priv
     )
     AND NOT (p.priv = 'SELECT'
              AND c.relname IN ('departments', 'municipalities', 'department_adjacency', 'hospitals', 'kams'));
  IF indebidos IS NOT NULL THEN
    RAISE EXCEPTION 'Privilegios indebidos de anon/authenticated: %', indebidos;
  END IF;
END $$;

-- Pedir a PostgREST que recargue su caché de esquema (la función eliminada deja de anunciarse).
NOTIFY pgrst, 'reload schema';

COMMIT;
