-- Script para verificar y temporalmente deshabilitar RLS en la tabla users
-- Esto es solo para debugging, NO usar en producción

-- 1. Verificar el estado actual de RLS
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename = 'users';

-- 2. Ver las políticas actuales
SELECT 
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'users';

-- 3. Si necesitas deshabilitar RLS temporalmente para testing
-- ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- 4. Para volver a habilitar RLS
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- 5. Crear una política simple que permita lectura a todos (para testing)
-- CREATE POLICY "Enable read access for all users" ON users
-- FOR SELECT USING (true);

-- 6. Verificar que el anon key puede leer la tabla
-- Esto simula lo que hace la aplicación
SELECT 
    COUNT(*) as total_users,
    COUNT(CASE WHEN active = true THEN 1 END) as active_users
FROM users;