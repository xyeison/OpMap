-- Script de migración para actualizar roles de usuarios
-- Este script actualiza la columna 'role' en la tabla users para incluir los nuevos tipos de roles

-- Primero, verificar la estructura actual
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'users' AND column_name = 'role';

-- Actualizar la columna role para aceptar los nuevos valores
-- Nota: Esto mantendrá los valores existentes 'admin' y 'user'
ALTER TABLE users 
ALTER COLUMN role TYPE TEXT;

-- Opcional: Si quieres usar un ENUM más estricto
-- CREATE TYPE user_role AS ENUM ('admin', 'sales_manager', 'contract_manager', 'data_manager', 'viewer');
-- ALTER TABLE users ALTER COLUMN role TYPE user_role USING role::user_role;

-- Actualizar usuarios existentes según sea necesario
-- Por defecto, los usuarios 'user' se convierten en 'viewer'
UPDATE users 
SET role = 'viewer' 
WHERE role = 'user';

-- Verificar los cambios
SELECT email, full_name, role, active 
FROM users 
ORDER BY role, email;

-- Crear índice en role para mejorar performance
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Mostrar estadísticas de roles
SELECT 
    role, 
    COUNT(*) as count,
    COUNT(CASE WHEN active = true THEN 1 END) as active_count
FROM users 
GROUP BY role
ORDER BY role;