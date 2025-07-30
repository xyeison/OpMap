-- Script para crear usuario administrador
-- Email: yxiquesm@gmail.com
-- Nombre: Yeison Xiques
-- Rol: admin

-- Primero verificar si el usuario ya existe
SELECT id, email, full_name, role, active 
FROM users 
WHERE email = 'yxiquesm@gmail.com';

-- Insertar el nuevo usuario admin
-- NOTA: La contraseña aquí es 'admin123' - cámbiala después del primer login
INSERT INTO users (
    email, 
    password, 
    full_name, 
    role, 
    active,
    created_at
) VALUES (
    'yxiquesm@gmail.com',
    'admin123',  -- IMPORTANTE: Cambiar esta contraseña después del primer login
    'Yeison Xiques',
    'admin',
    true,
    NOW()
)
ON CONFLICT (email) 
DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    active = EXCLUDED.active;

-- Verificar que el usuario fue creado correctamente
SELECT id, email, full_name, role, active, created_at
FROM users 
WHERE email = 'yxiquesm@gmail.com';

-- Mostrar total de usuarios admin activos
SELECT COUNT(*) as total_admins
FROM users
WHERE role = 'admin' AND active = true;