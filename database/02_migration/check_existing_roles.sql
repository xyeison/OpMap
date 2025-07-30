-- Script para verificar qué roles existen actualmente en la base de datos

-- 1. Ver todos los roles únicos que ya están en uso
SELECT DISTINCT role, COUNT(*) as count
FROM users
GROUP BY role
ORDER BY role;

-- 2. Ver el constraint actual de roles
SELECT 
    table_name,
    constraint_name,
    pg_get_constraintdef(c.oid) as constraint_definition
FROM information_schema.table_constraints tc
JOIN pg_constraint c ON c.conname = tc.constraint_name
WHERE tc.table_name = 'users' 
AND tc.constraint_type = 'CHECK';

-- 3. Ver la estructura completa de la columna role
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'users' 
AND column_name = 'role';

-- 4. Si el constraint espera 'user' en lugar de 'viewer', actualizamos los registros existentes
-- UPDATE users SET role = 'viewer' WHERE role = 'user';

-- 5. O si prefieres mantener compatibilidad, puedes agregar ambos valores al constraint
-- ALTER TABLE users 
-- DROP CONSTRAINT IF EXISTS users_role_check;
-- 
-- ALTER TABLE users 
-- ADD CONSTRAINT users_role_check 
-- CHECK (role IN ('admin', 'user', 'viewer', 'sales_manager', 'contract_manager', 'data_manager'));