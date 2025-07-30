-- Fix RLS policies for visits tables
-- Este script corrige las políticas de seguridad para las tablas de visitas

-- 1. Primero, eliminar políticas existentes si las hay
DROP POLICY IF EXISTS "visit_imports_admin_all" ON visit_imports;
DROP POLICY IF EXISTS "visit_imports_data_manager_all" ON visit_imports;
DROP POLICY IF EXISTS "visits_admin_all" ON visits;
DROP POLICY IF EXISTS "visits_data_manager_all" ON visits;
DROP POLICY IF EXISTS "visits_viewer_read" ON visits;

-- 2. Crear políticas para visit_imports
-- Admin: acceso completo
CREATE POLICY "visit_imports_admin_all" ON visit_imports
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
  )
);

-- Data Manager: acceso completo
CREATE POLICY "visit_imports_data_manager_all" ON visit_imports
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role = 'data_manager'
  )
);

-- 3. Crear políticas para visits
-- Admin: acceso completo
CREATE POLICY "visits_admin_all" ON visits
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
  )
);

-- Data Manager: acceso completo
CREATE POLICY "visits_data_manager_all" ON visits
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role = 'data_manager'
  )
);

-- Viewer y otros: solo lectura
CREATE POLICY "visits_viewer_read" ON visits
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role IN ('viewer', 'sales_manager', 'contract_manager')
  )
);

-- 4. Asegurarse de que RLS esté habilitado
ALTER TABLE visit_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE visits ENABLE ROW LEVEL SECURITY;