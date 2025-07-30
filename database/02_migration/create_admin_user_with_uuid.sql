-- Script mejorado para crear usuario administrador con UUID
-- Email: yxiquesm@gmail.com
-- Nombre: Yeison Xiques
-- Rol: admin

-- Primero eliminar cualquier usuario anterior con ese email (para testing)
DELETE FROM users WHERE email = 'yxiquesm@gmail.com';

-- Insertar el nuevo usuario admin con UUID generado
INSERT INTO users (
    id,
    email, 
    password, 
    full_name, 
    role, 
    active,
    created_at
) VALUES (
    gen_random_uuid(),  -- Generar UUID automáticamente
    'yxiquesm@gmail.com',
    'admin123',  -- Contraseña sin espacios
    'Yeison Xiques',
    'admin',
    true,
    NOW()
);

-- Verificar que el usuario fue creado correctamente
SELECT 
    id,
    email,
    password,  -- Solo para verificación, quitar en producción
    full_name,
    role,
    active,
    created_at
FROM users 
WHERE email = 'yxiquesm@gmail.com';

-- Verificar que la autenticación funcionaría
SELECT COUNT(*) as auth_check
FROM users 
WHERE email = 'yxiquesm@gmail.com' 
  AND password = 'admin123'
  AND active = true;

-- Si el resultado de auth_check es 1, entonces las credenciales son correctas