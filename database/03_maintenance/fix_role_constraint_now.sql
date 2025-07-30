-- Fix role constraint to accept 'user' value
-- Problema: La tabla users tiene un check constraint que no acepta 'viewer', solo acepta 'user'

-- 1. Primero, verificar el constraint actual
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'users'::regclass
AND contype = 'c';

-- 2. Eliminar el constraint existente
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

-- 3. Crear el nuevo constraint que acepta todos los roles necesarios
ALTER TABLE users 
ADD CONSTRAINT users_role_check 
CHECK (role IN ('admin', 'sales_manager', 'contract_manager', 'data_manager', 'viewer', 'user'));

-- 4. Verificar que el constraint se aplicó correctamente
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'users'::regclass
AND contype = 'c';

-- 5. Mostrar los roles válidos
SELECT 'Roles válidos ahora:' AS info;
SELECT unnest(ARRAY['admin', 'sales_manager', 'contract_manager', 'data_manager', 'viewer', 'user']) AS valid_roles;