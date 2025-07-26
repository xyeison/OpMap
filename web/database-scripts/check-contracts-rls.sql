-- Script para verificar y configurar las políticas RLS de hospital_contracts
-- Ejecutar en Supabase SQL Editor

-- 1. Verificar si RLS está habilitado
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM 
    pg_tables
WHERE 
    schemaname = 'public' 
    AND tablename = 'hospital_contracts';

-- 2. Ver las políticas actuales
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM 
    pg_policies
WHERE 
    schemaname = 'public' 
    AND tablename = 'hospital_contracts';

-- 3. Si RLS está habilitado pero no hay políticas, crear políticas básicas
-- IMPORTANTE: Solo ejecutar si necesitas habilitar RLS

-- Habilitar RLS (descomentar si necesario)
-- ALTER TABLE hospital_contracts ENABLE ROW LEVEL SECURITY;

-- Política para SELECT - todos pueden ver todos los contratos
CREATE POLICY "Todos pueden ver contratos" 
ON hospital_contracts 
FOR SELECT 
TO authenticated 
USING (true);

-- Política para INSERT - usuarios autenticados pueden crear contratos
CREATE POLICY "Usuarios autenticados pueden crear contratos" 
ON hospital_contracts 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- Política para UPDATE - usuarios autenticados pueden actualizar contratos
CREATE POLICY "Usuarios autenticados pueden actualizar contratos" 
ON hospital_contracts 
FOR UPDATE 
TO authenticated 
USING (true)
WITH CHECK (true);

-- Política para DELETE - usuarios autenticados pueden eliminar contratos
CREATE POLICY "Usuarios autenticados pueden eliminar contratos" 
ON hospital_contracts 
FOR DELETE 
TO authenticated 
USING (true);

-- 4. Si prefieres deshabilitar RLS temporalmente para probar
-- ALTER TABLE hospital_contracts DISABLE ROW LEVEL SECURITY;

-- 5. Verificar permisos de la tabla
SELECT 
    grantee, 
    privilege_type 
FROM 
    information_schema.role_table_grants 
WHERE 
    table_name = 'hospital_contracts';

-- 6. Asegurar que el rol anon y authenticated tengan permisos básicos
GRANT SELECT, INSERT, UPDATE, DELETE ON hospital_contracts TO anon, authenticated;

-- 7. Verificar la estructura final de la tabla
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM 
    information_schema.columns
WHERE 
    table_schema = 'public' 
    AND table_name = 'hospital_contracts'
ORDER BY 
    ordinal_position;