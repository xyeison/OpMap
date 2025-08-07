-- Script para corregir errores de seguridad RLS en Supabase (Versión Segura)
-- Fecha: 2025-01-07
-- Propósito: Habilitar RLS en tablas que tienen políticas pero RLS deshabilitado
-- NOTA: Excluye spatial_ref_sys que es una tabla del sistema PostGIS

-- ============================================
-- 1. HABILITAR RLS EN TABLAS CON POLÍTICAS
-- ============================================

-- Tablas que tienen políticas pero RLS está deshabilitado
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visit_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 2. HABILITAR RLS EN TABLAS PÚBLICAS
-- ============================================

-- Tablas públicas sin RLS (datos de referencia - solo lectura pública)
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.municipalities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.department_adjacency ENABLE ROW LEVEL SECURITY;

-- Crear políticas de solo lectura para tablas de referencia (si no existen)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'departments' 
    AND policyname = 'Allow public read access on departments'
  ) THEN
    CREATE POLICY "Allow public read access on departments" ON public.departments
      FOR SELECT USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'municipalities' 
    AND policyname = 'Allow public read access on municipalities'
  ) THEN
    CREATE POLICY "Allow public read access on municipalities" ON public.municipalities
      FOR SELECT USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'department_adjacency' 
    AND policyname = 'Allow public read access on department_adjacency'
  ) THEN
    CREATE POLICY "Allow public read access on department_adjacency" ON public.department_adjacency
      FOR SELECT USING (true);
  END IF;
END $$;

-- Tablas de datos operativos
ALTER TABLE public.hospital_kam_distances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forced_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospital_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Políticas para hospital_kam_distances (solo lectura pública)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'hospital_kam_distances' 
    AND policyname = 'Allow public read access on hospital_kam_distances'
  ) THEN
    CREATE POLICY "Allow public read access on hospital_kam_distances" ON public.hospital_kam_distances
      FOR SELECT USING (true);
  END IF;
END $$;

-- Políticas para forced_assignments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'forced_assignments' 
    AND policyname = 'Allow public read access on forced_assignments'
  ) THEN
    CREATE POLICY "Allow public read access on forced_assignments" ON public.forced_assignments
      FOR SELECT USING (true);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'forced_assignments' 
    AND policyname = 'Admin can manage forced_assignments'
  ) THEN
    CREATE POLICY "Admin can manage forced_assignments" ON public.forced_assignments
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM public.users
          WHERE users.id = auth.uid()
          AND users.role IN ('admin', 'sales_manager')
        )
      );
  END IF;
END $$;

-- Políticas para hospital_contracts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'hospital_contracts' 
    AND policyname = 'Allow public read access on hospital_contracts'
  ) THEN
    CREATE POLICY "Allow public read access on hospital_contracts" ON public.hospital_contracts
      FOR SELECT USING (true);
  END IF;
END $$;

-- Políticas para users (protección especial)
DO $$
BEGIN
  -- Eliminar políticas existentes que puedan entrar en conflicto
  DROP POLICY IF EXISTS "Users can view their own data" ON public.users;
  DROP POLICY IF EXISTS "Admin can view all users" ON public.users;
  DROP POLICY IF EXISTS "Admin can manage users" ON public.users;
  
  -- Crear nuevas políticas
  CREATE POLICY "Users can view their own data" ON public.users
    FOR SELECT USING (auth.uid() = id);

  CREATE POLICY "Admin can view all users" ON public.users
    FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid()
        AND users.role = 'admin'
      )
    );

  CREATE POLICY "Admin can manage users" ON public.users
    FOR ALL USING (
      EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid()
        AND users.role = 'admin'
      )
    );
END $$;

-- ============================================
-- NOTA: spatial_ref_sys es una tabla del sistema PostGIS
-- No podemos modificarla directamente
-- Supabase debe manejarla internamente
-- ============================================

-- ============================================
-- 4. RECREAR VISTAS SIN SECURITY DEFINER
-- ============================================

-- Vista: visit_statistics
DROP VIEW IF EXISTS public.visit_statistics CASCADE;
CREATE VIEW public.visit_statistics AS
SELECT 
  v.visit_date,
  v.visit_type,
  v.visit_status,
  v.hospital_id,
  h.name AS hospital_name,
  h.municipality_name,
  h.department_name,
  v.kam_id,
  k.name AS kam_name,
  v.notes,
  COUNT(*) OVER (PARTITION BY v.kam_id) AS total_visits_by_kam,
  COUNT(*) OVER (PARTITION BY v.hospital_id) AS total_visits_to_hospital
FROM public.visits v
LEFT JOIN public.hospitals h ON v.hospital_id = h.id
LEFT JOIN public.kams k ON v.kam_id = k.id;

-- Vista: kam_statistics
DROP VIEW IF EXISTS public.kam_statistics CASCADE;
CREATE VIEW public.kam_statistics AS
SELECT 
  k.id,
  k.name,
  COUNT(DISTINCT a.hospital_id) AS total_hospitals,
  COUNT(DISTINCT h.municipality_id) AS total_municipalities,
  SUM(hc.contract_value) AS total_opportunity_value,
  AVG(a.travel_time) AS avg_travel_time
FROM public.kams k
LEFT JOIN public.assignments a ON k.id = a.kam_id
LEFT JOIN public.hospitals h ON a.hospital_id = h.id
LEFT JOIN public.hospital_contracts hc ON h.id = hc.hospital_id AND hc.active = true
WHERE k.active = true
GROUP BY k.id, k.name;

-- Vista: territory_statistics
DROP VIEW IF EXISTS public.territory_statistics CASCADE;
CREATE VIEW public.territory_statistics AS
WITH territory_data AS (
  SELECT 
    COALESCE(h.locality_id, h.municipality_id) AS territory_id,
    COALESCE(h.locality_name, h.municipality_name) AS territory_name,
    CASE 
      WHEN h.locality_id IS NOT NULL THEN 'locality'
      ELSE 'municipality'
    END AS territory_type,
    h.id AS hospital_id,
    h.beds,
    h.service_level,
    h.active
  FROM public.hospitals h
),
forced_data AS (
  SELECT 
    fa.territory_id,
    fa.kam_id AS forced_kam_id,
    k.name AS forced_kam_name,
    k.color AS forced_kam_color,
    fa.reason AS forced_reason
  FROM public.forced_assignments fa
  JOIN public.kams k ON fa.kam_id = k.id
  WHERE fa.active = true
)
SELECT 
  td.territory_id,
  td.territory_name,
  td.territory_type,
  COUNT(DISTINCT td.hospital_id) AS hospital_count,
  COALESCE(SUM(td.beds), 0) AS total_beds,
  COUNT(DISTINCT CASE WHEN td.service_level >= 3 THEN td.hospital_id END) AS high_level_hospitals,
  COUNT(DISTINCT CASE WHEN td.active = true THEN td.hospital_id END) AS active_hospitals,
  BOOL_OR(fd.forced_kam_id IS NOT NULL) AS is_forced,
  MAX(fd.forced_kam_id) AS forced_kam_id,
  MAX(fd.forced_kam_name) AS forced_kam_name,
  MAX(fd.forced_kam_color) AS forced_kam_color,
  MAX(fd.forced_reason) AS forced_reason
FROM territory_data td
LEFT JOIN forced_data fd ON td.territory_id = fd.territory_id
GROUP BY td.territory_id, td.territory_name, td.territory_type;

-- Vista: hospital_contracts_view
DROP VIEW IF EXISTS public.hospital_contracts_view CASCADE;
CREATE VIEW public.hospital_contracts_view AS
SELECT 
  hc.*,
  h.name AS hospital_name,
  h.municipality_name,
  h.department_name,
  get_contract_end_date(hc.id) AS calculated_end_date,
  get_contract_pdf_url(hc.id) AS pdf_url
FROM public.hospital_contracts hc
JOIN public.hospitals h ON hc.hospital_id = h.id;

-- Vista: territory_assignments
DROP VIEW IF EXISTS public.territory_assignments CASCADE;
CREATE VIEW public.territory_assignments AS
SELECT DISTINCT
  COALESCE(h.locality_id, h.municipality_id) AS territory_id,
  COALESCE(h.locality_name, h.municipality_name) AS territory_name,
  h.department_id,
  h.department_name,
  a.kam_id,
  k.name AS kam_name,
  k.color AS kam_color,
  COUNT(DISTINCT h.id) AS hospital_count
FROM public.assignments a
JOIN public.hospitals h ON a.hospital_id = h.id
JOIN public.kams k ON a.kam_id = k.id
GROUP BY 
  COALESCE(h.locality_id, h.municipality_id),
  COALESCE(h.locality_name, h.municipality_name),
  h.department_id,
  h.department_name,
  a.kam_id,
  k.name,
  k.color;

-- ============================================
-- 5. GRANT PERMISOS A VISTAS
-- ============================================

GRANT SELECT ON public.visit_statistics TO anon, authenticated;
GRANT SELECT ON public.kam_statistics TO anon, authenticated;
GRANT SELECT ON public.territory_statistics TO anon, authenticated;
GRANT SELECT ON public.hospital_contracts_view TO anon, authenticated;
GRANT SELECT ON public.territory_assignments TO anon, authenticated;

-- ============================================
-- 6. VERIFICACIÓN FINAL
-- ============================================

-- Mostrar estado de RLS en todas las tablas (excepto spatial_ref_sys)
SELECT 
  'Tabla: ' || tablename || ' - RLS: ' || 
  CASE WHEN rowsecurity THEN 'HABILITADO ✓' ELSE 'DESHABILITADO ✗' END AS estado_rls
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename != 'spatial_ref_sys'  -- Excluir tabla del sistema PostGIS
ORDER BY 
  CASE WHEN rowsecurity THEN 1 ELSE 0 END DESC,
  tablename;

-- Contar políticas por tabla
SELECT 
  tablename,
  COUNT(*) as num_politicas
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;