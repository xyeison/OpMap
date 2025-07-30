-- Script para corregir el constraint de roles INMEDIATAMENTE
-- Ejecutar este script en Supabase SQL Editor

-- 1. Primero ver qué constraint existe actualmente
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.users'::regclass
AND contype = 'c';

-- 2. Eliminar el constraint existente (el nombre puede variar)
ALTER TABLE users 
DROP CONSTRAINT IF EXISTS users_role_check;

-- 3. Crear el nuevo constraint que incluye 'user'
ALTER TABLE users 
ADD CONSTRAINT users_role_check 
CHECK (role IN ('admin', 'user', 'viewer', 'sales_manager', 'contract_manager', 'data_manager'));

-- 4. Verificar que funcionó
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as nuevo_constraint
FROM pg_constraint
WHERE conrelid = 'public.users'::regclass
AND contype = 'c';

-- 5. Probar insertando un usuario con rol 'user'
-- Solo para verificar, luego puedes eliminarlo
INSERT INTO users (id, email, password, full_name, role, active)
VALUES (gen_random_uuid(), 'test_role@example.com', 'test123', 'Test Role User', 'user', true);

-- 6. Ver si se insertó correctamente
SELECT * FROM users WHERE email = 'test_role@example.com';

-- 7. Limpiar el usuario de prueba
DELETE FROM users WHERE email = 'test_role@example.com';

-- 8. Mostrar mensaje de éxito
SELECT 'Constraint actualizado exitosamente. Ahora acepta el rol "user"' as mensaje;