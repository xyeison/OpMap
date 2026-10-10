-- =====================================================================================
-- OpMap · Endurecimiento Supabase · 99 — ROLLBACK de 01–05
-- Proyecto: norvxqgohddgsdkggqzq · Generado: 2026-10-10 · NO EJECUTADO
--
-- Devuelve la base EXACTAMENTE al estado inseguro del 2026-10-10 (antes de 01–05). Úsese solo
-- si el endurecimiento rompe producción y no hay arreglo rápido en el código. Cada sección es
-- una transacción independiente: ejecutar solo la del script que haya que deshacer, en orden
-- inverso (05 -> 01) si se deshacen varias.
--
-- Fuente: respaldo del Paso 0 (backup-2026-10-10/rollback_*.sql y functions.sql), volcado del
-- estado vivo con SELECT. Este archivo contiene solo lo que 01–05 cambian; los rollback_*.sql
-- del respaldo recrean TODO (54 políticas, 18 vistas, 86 grants + 120 default privileges) y
-- sirven como referencia o para una restauración completa. Ojo: rollback_grants.sql incluye
-- líneas "FOR ROLE supabase_admin" que postgres no puede ejecutar; saltarlas.
-- =====================================================================================


-- ---------------------------------------------------------------------------------
-- Sección 05 — funciones: quitar search_path fijo y devolver EXECUTE a PUBLIC/anon/authenticated
-- ---------------------------------------------------------------------------------
BEGIN;
ALTER FUNCTION public.analizar_competencia_departamento(character varying)       RESET search_path;
ALTER FUNCTION public.calcular_indicadores_financieros()                         RESET search_path;
ALTER FUNCTION public.calcular_indicadores_mi_empresa()                          RESET search_path;
ALTER FUNCTION public.find_nearest_hospital(numeric, numeric, numeric)           RESET search_path;
ALTER FUNCTION public.get_contract_end_date(date, integer)                       RESET search_path;
ALTER FUNCTION public.get_territory_stats(character varying)                     RESET search_path;
ALTER FUNCTION public.obtener_proveedores_calificados(numeric, numeric, numeric) RESET search_path;
ALTER FUNCTION public.update_updated_at_column()                                 RESET search_path;
ALTER FUNCTION public.update_visits_updated_at()                                 RESET search_path;
ALTER FUNCTION public.validar_cumplimiento_contrato(uuid)                        RESET search_path;
ALTER FUNCTION public.validar_todos_contratos()                                  RESET search_path;

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
TO PUBLIC, anon, authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;


-- ---------------------------------------------------------------------------------
-- Sección 04 — storage: recrear "Public Upload" y "Public Update" en el bucket geojson
-- ---------------------------------------------------------------------------------
BEGIN;
DROP POLICY IF EXISTS "Public Upload" ON storage.objects;
CREATE POLICY "Public Upload" ON storage.objects AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((bucket_id = 'geojson'::text));

DROP POLICY IF EXISTS "Public Update" ON storage.objects;
CREATE POLICY "Public Update" ON storage.objects AS PERMISSIVE FOR UPDATE TO public
  USING ((bucket_id = 'geojson'::text))
  WITH CHECK ((bucket_id = 'geojson'::text));
COMMIT;


-- ---------------------------------------------------------------------------------
-- Sección 03 — grants: devolver arwdDxtm a anon/authenticated, default privileges y la función
-- get_contract_pdf_url (rota: lee una columna inexistente; se recrea solo por fidelidad).
-- ---------------------------------------------------------------------------------
BEGIN;
-- Estado original: anon y authenticated con ALL en todas las tablas y vistas propias de public.
-- (Para las 3 tablas de PostGIS saldrá un WARNING: no se tocaron y siguen como estaban.)
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES    TO anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated;

-- Definición original (backup-2026-10-10/functions.sql:292-307)
CREATE OR REPLACE FUNCTION public.get_contract_pdf_url(contract_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    pdf_path TEXT;
BEGIN
    SELECT pdf_url INTO pdf_path
    FROM hospital_contracts
    WHERE id = contract_id;
    
    RETURN pdf_path;
END;
$function$;
GRANT EXECUTE ON FUNCTION public.get_contract_pdf_url(uuid) TO PUBLIC, anon, authenticated, service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;


-- ---------------------------------------------------------------------------------
-- Sección 02 — RLS: desactivar en visits/visit_imports y recrear las 12 políticas eliminadas
-- ---------------------------------------------------------------------------------
BEGIN;
ALTER TABLE public.visits        DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.visit_imports DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations" ON public.hospital_history;
CREATE POLICY "Allow all operations" ON public.hospital_history AS PERMISSIVE FOR ALL TO public
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS users_all ON public.users;
CREATE POLICY users_all ON public.users AS PERMISSIVE FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS mi_empresa_read_all ON public.mi_empresa_config;
CREATE POLICY mi_empresa_read_all ON public.mi_empresa_config AS PERMISSIVE FOR SELECT TO public
  USING (true);

DROP POLICY IF EXISTS proveedores_read_public ON public.proveedores;
CREATE POLICY proveedores_read_public ON public.proveedores AS PERMISSIVE FOR SELECT TO public
  USING (true);

DROP POLICY IF EXISTS finanzas_read_public ON public.proveedor_finanzas;
CREATE POLICY finanzas_read_public ON public.proveedor_finanzas AS PERMISSIVE FOR SELECT TO public
  USING (true);

DROP POLICY IF EXISTS indicadores_read_public ON public.proveedor_indicadores;
CREATE POLICY indicadores_read_public ON public.proveedor_indicadores AS PERMISSIVE FOR SELECT TO public
  USING (true);

DROP POLICY IF EXISTS contactos_read_public ON public.proveedor_contactos;
CREATE POLICY contactos_read_public ON public.proveedor_contactos AS PERMISSIVE FOR SELECT TO public
  USING (true);

DROP POLICY IF EXISTS enlaces_read_public ON public.proveedor_enlaces;
CREATE POLICY enlaces_read_public ON public.proveedor_enlaces AS PERMISSIVE FOR SELECT TO public
  USING (true);

DROP POLICY IF EXISTS "Todos pueden ver comentarios" ON public.hospital_comments;
CREATE POLICY "Todos pueden ver comentarios" ON public.hospital_comments AS PERMISSIVE FOR SELECT TO public
  USING (true);

DROP POLICY IF EXISTS "Allow public read access" ON public.forced_assignments;
CREATE POLICY "Allow public read access" ON public.forced_assignments AS PERMISSIVE FOR SELECT TO public
  USING (true);

DROP POLICY IF EXISTS zones_read_all ON public.zones;
CREATE POLICY zones_read_all ON public.zones AS PERMISSIVE FOR SELECT TO public
  USING (true);

DROP POLICY IF EXISTS "Allow public read access" ON public.hospital_kam_distances;
CREATE POLICY "Allow public read access" ON public.hospital_kam_distances AS PERMISSIVE FOR SELECT TO public
  USING (true);
COMMIT;


-- ---------------------------------------------------------------------------------
-- Sección 01 — vistas: quitar security_invoker de las 15 que no lo tenían
-- (kam_statistics, territory_assignments y territory_statistics ya lo tenían: no se tocan)
-- ---------------------------------------------------------------------------------
BEGIN;
ALTER VIEW public.contract_compliance               RESET (security_invoker);
ALTER VIEW public.hospital_activity                 RESET (security_invoker);
ALTER VIEW public.hospital_contracts_view           RESET (security_invoker);
ALTER VIEW public.kams_with_zones                   RESET (security_invoker);
ALTER VIEW public.territory_stats                   RESET (security_invoker);
ALTER VIEW public.v_competencia_hospitales          RESET (security_invoker);
ALTER VIEW public.v_cumplimiento_contratos          RESET (security_invoker);
ALTER VIEW public.v_hospital_contracts_extended     RESET (security_invoker);
ALTER VIEW public.v_proveedor_resumen_contratos     RESET (security_invoker);
ALTER VIEW public.v_proveedores_ultimos_indicadores RESET (security_invoker);
ALTER VIEW public.v_ranking_proveedores             RESET (security_invoker);
ALTER VIEW public.visit_imports_summary             RESET (security_invoker);
ALTER VIEW public.visit_summary                     RESET (security_invoker);
ALTER VIEW public.zone_statistics                   RESET (security_invoker);
ALTER VIEW public.zone_territory_assignments        RESET (security_invoker);
COMMIT;
