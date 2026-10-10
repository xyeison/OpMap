-- =====================================================================================
-- OpMap · Endurecimiento Supabase · 01 — Vistas con security_invoker
-- Proyecto: norvxqgohddgsdkggqzq · Generado: 2026-10-10 · NO EJECUTADO TODAVÍA
--
-- Qué cierra: 15 vistas propias (dueño postgres) se ejecutan con los privilegios de su dueño
--   (security definer implícito) y saltan el RLS de las tablas base. Con la anon key se leen
--   hospital_contracts (93 contratos con valores), users (email/rol/UUID vía hospital_activity)
--   y visits a través de ellas. Advisor: ERROR security_definer_view ×15.
-- Hallazgos: C-04 [SEC-DB-01, SEC-13, PERF-09].
--
-- Lista confirmada con SELECT el 2026-10-10 (pg_class.relkind='v', schema public, dueño postgres):
--   15 sin reloptions + 3 que ya tienen security_invoker=true (kam_statistics,
--   territory_assignments, territory_statistics). Las 3 se vuelven a fijar (idempotente).
--   geography_columns y geometry_columns son de PostGIS (dueño supabase_admin): no se tocan.
--
-- Efecto: la vista pasa a evaluarse con los permisos y el RLS de QUIEN consulta. service_role
--   (servidor) sigue leyéndolas igual porque hace bypass de RLS. El REVOKE de las vistas a
--   anon/authenticated está en 03_revoke_grants.sql.
-- Idempotente: sí. Rollback: ver 99_rollback.sql (sección 01).
-- =====================================================================================

BEGIN;

-- 15 vistas sin security_invoker (C-04)
ALTER VIEW public.contract_compliance               SET (security_invoker = true);
ALTER VIEW public.hospital_activity                 SET (security_invoker = true);
ALTER VIEW public.hospital_contracts_view           SET (security_invoker = true);
ALTER VIEW public.kams_with_zones                   SET (security_invoker = true);
ALTER VIEW public.territory_stats                   SET (security_invoker = true);
ALTER VIEW public.v_competencia_hospitales          SET (security_invoker = true);
ALTER VIEW public.v_cumplimiento_contratos          SET (security_invoker = true);
ALTER VIEW public.v_hospital_contracts_extended     SET (security_invoker = true);
ALTER VIEW public.v_proveedor_resumen_contratos     SET (security_invoker = true);
ALTER VIEW public.v_proveedores_ultimos_indicadores SET (security_invoker = true);
ALTER VIEW public.v_ranking_proveedores             SET (security_invoker = true);
ALTER VIEW public.visit_imports_summary             SET (security_invoker = true);
ALTER VIEW public.visit_summary                     SET (security_invoker = true);
ALTER VIEW public.zone_statistics                   SET (security_invoker = true);
ALTER VIEW public.zone_territory_assignments        SET (security_invoker = true);

-- 3 vistas que ya lo tenían (se fija de nuevo por si alguien lo quitó; no cambia nada)
ALTER VIEW public.kam_statistics                    SET (security_invoker = true);
ALTER VIEW public.territory_assignments             SET (security_invoker = true);
ALTER VIEW public.territory_statistics              SET (security_invoker = true);

-- Comprobación: ninguna vista propia (dueño postgres) de public queda sin security_invoker.
-- Si aparece una vista nueva que no está en la lista, la transacción se aborta para revisarla.
DO $$
DECLARE
  pendientes text;
BEGIN
  SELECT string_agg(c.relname, ', ' ORDER BY c.relname)
    INTO pendientes
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
     AND c.relkind = 'v'
     AND pg_get_userbyid(c.relowner) = 'postgres'
     AND NOT coalesce(c.reloptions @> ARRAY['security_invoker=true'], false);
  IF pendientes IS NOT NULL THEN
    RAISE EXCEPTION 'Vistas propias sin security_invoker: %', pendientes;
  END IF;
END $$;

COMMIT;
