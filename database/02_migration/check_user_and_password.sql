-- Script para verificar el usuario y su contraseña en la base de datos
-- Este script te ayudará a diagnosticar el problema de autenticación

-- 1. Verificar si el usuario existe
SELECT 
    id,
    email,
    full_name,
    role,
    active,
    created_at,
    LENGTH(password) as password_length,
    password as stored_password -- Solo para debugging, eliminar en producción
FROM users 
WHERE email = 'yxiquesm@gmail.com';

-- 2. Verificar si hay espacios o caracteres ocultos en el email
SELECT 
    email,
    LENGTH(email) as email_length,
    TRIM(email) = email as no_spaces
FROM users 
WHERE email LIKE '%yxiquesm@gmail.com%';

-- 3. Intentar buscar con ILIKE (case insensitive)
SELECT 
    id,
    email,
    full_name,
    active
FROM users 
WHERE email ILIKE 'yxiquesm@gmail.com';

-- 4. Verificar todos los usuarios activos
SELECT 
    email,
    full_name,
    role,
    active,
    created_at
FROM users 
WHERE active = true
ORDER BY created_at DESC;

-- 5. Si necesitas actualizar la contraseña directamente
-- UPDATE users 
-- SET password = 'admin123'
-- WHERE email = 'yxiquesm@gmail.com';

-- 6. Verificar la configuración de RLS (Row Level Security)
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables
WHERE tablename = 'users';