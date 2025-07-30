-- Script para ver qué roles acepta actualmente la base de datos

-- Opción 1: Ver el constraint actual
SELECT 
    pg_get_constraintdef(oid) as constraint_actual
FROM pg_constraint
WHERE conrelid = 'public.users'::regclass
AND contype = 'c'
AND conname LIKE '%role%';

-- Opción 2: Probar qué roles funcionan
-- Intenta con 'admin'
INSERT INTO users (id, email, password, full_name, role, active)
VALUES (gen_random_uuid(), 'test1@example.com', 'test', 'Test', 'admin', true);
DELETE FROM users WHERE email = 'test1@example.com';

-- Si funciona, mostrará "INSERT 0 1" y "DELETE 1"
-- Si no funciona, mostrará un error

-- Valores probables que acepta:
-- 'admin' - Administrador
-- 'user' o 'viewer' - Usuario básico
-- Otros roles según tu configuración