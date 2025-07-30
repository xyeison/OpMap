-- Script para corregir el constraint de roles en la tabla users
-- Este script actualiza el check constraint para aceptar los nuevos tipos de roles

-- 1. Ver el constraint actual
SELECT 
    conname,
    pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'users'::regclass
AND contype = 'c';

-- 2. Eliminar el constraint antiguo (ajusta el nombre según lo que muestre la consulta anterior)
ALTER TABLE users 
DROP CONSTRAINT IF EXISTS users_role_check;

-- 3. Crear el nuevo constraint con todos los roles
ALTER TABLE users 
ADD CONSTRAINT users_role_check 
CHECK (role IN ('admin', 'sales_manager', 'contract_manager', 'data_manager', 'viewer'));

-- 4. Verificar que el constraint se creó correctamente
SELECT 
    conname,
    pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'users'::regclass
AND contype = 'c';

-- 5. Probar que ahora funciona insertando un usuario de prueba
-- INSERT INTO users (id, email, password, full_name, role, active)
-- VALUES (gen_random_uuid(), 'test_constraint@example.com', 'test123', 'Test Constraint', 'viewer', true);

-- 6. Limpiar el usuario de prueba
-- DELETE FROM users WHERE email = 'test_constraint@example.com';