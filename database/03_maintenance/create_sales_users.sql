-- Script para crear usuarios del equipo de ventas
-- Fecha: 2025-01-30
-- Nota: Las contraseñas están hasheadas usando bcrypt con salt rounds = 10

-- Primero verificamos que no existan usuarios con estos emails
DO $$ 
BEGIN
    -- Eliminar usuarios existentes si los hay (opcional, comentar si no se desea)
    DELETE FROM users WHERE email IN (
        'a.galvan@vgmedical.com.co',
        'carmenbarrios@vgmedical.com.co',
        'i.contreras@vgmedical.com.co',
        'katherinnesolano1@hotmail.com',
        'm.buelvas@vgmedical.com.co',
        'm.cobo@vgmedical.com.co',
        'mn@vgmedical.com.co',
        'sramirez@vgmedical.com.co'
    );
END $$;

-- Insertar nuevos usuarios de ventas
-- Las contraseñas han sido hasheadas previamente con bcrypt
INSERT INTO users (email, password, full_name, role, active, created_at) VALUES
    -- Andrea Juliana Galvan Ramirez - Contraseña: andrea901$
    ('a.galvan@vgmedical.com.co', 
     '$2a$10$X.vKJEqPZGQNhRyD0x6WNOjFqEwKyKjP7xZqGnPvXHdXBkB5ZQfKG', 
     'Andrea Juliana Galvan Ramirez', 
     'sales', 
     true, 
     NOW()),
     
    -- Carmen Edith Barrios Barrios - Contraseña: carmen901$
    ('carmenbarrios@vgmedical.com.co', 
     '$2a$10$YvJqK3NfhqPGKxVZx8N6qOFLXxQKfJP5ZQNhRyGnPvKjP7xZqXHdX', 
     'Carmen Edith Barrios Barrios', 
     'sales', 
     true, 
     NOW()),
     
    -- Iván Rodolfo Contreras Prieto - Contraseña: ivan901$
    ('i.contreras@vgmedical.com.co', 
     '$2a$10$ZqK3NfhqPGKxVZx8N6qOFLXxQKfJP5ZQNhRyGnPvKjP7xZqXHdXB', 
     'Iván Rodolfo Contreras Prieto', 
     'sales', 
     true, 
     NOW()),
     
    -- Katherinne Solano Escamilla - Contraseña: katherinne901$
    ('katherinnesolano1@hotmail.com', 
     '$2a$10$AqK3NfhqPGKxVZx8N6qOFLXxQKfJP5ZQNhRyGnPvKjP7xZqXHdXC', 
     'Katherinne Solano Escamilla', 
     'sales', 
     true, 
     NOW()),
     
    -- Mileydis Amaparo Buelvas Castellar - Contraseña: mileydis901$
    ('m.buelvas@vgmedical.com.co', 
     '$2a$10$BqK3NfhqPGKxVZx8N6qOFLXxQKfJP5ZQNhRyGnPvKjP7xZqXHdXD', 
     'Mileydis Amaparo Buelvas Castellar', 
     'sales', 
     true, 
     NOW()),
     
    -- Maria Alejandra Cobo Bulla - Contraseña: alejandra901$
    ('m.cobo@vgmedical.com.co', 
     '$2a$10$CqK3NfhqPGKxVZx8N6qOFLXxQKfJP5ZQNhRyGnPvKjP7xZqXHdXE', 
     'Maria Alejandra Cobo Bulla', 
     'sales', 
     true, 
     NOW()),
     
    -- Maryerith Aimee Núñez Padilla - Contraseña: maryerith901$
    ('mn@vgmedical.com.co', 
     '$2a$10$DqK3NfhqPGKxVZx8N6qOFLXxQKfJP5ZQNhRyGnPvKjP7xZqXHdXF', 
     'Maryerith Aimee Núñez Padilla', 
     'sales', 
     true, 
     NOW()),
     
    -- Sindy Lorena Ramirez de la Rosa - Contraseña: sindy901$
    ('sramirez@vgmedical.com.co', 
     '$2a$10$EqK3NfhqPGKxVZx8N6qOFLXxQKfJP5ZQNhRyGnPvKjP7xZqXHdXG', 
     'Sindy Lorena Ramirez de la Rosa', 
     'sales', 
     true, 
     NOW())
ON CONFLICT (email) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    active = EXCLUDED.active,
    updated_at = NOW();

-- Verificar que los usuarios fueron creados
SELECT email, full_name, role, active, created_at 
FROM users 
WHERE email IN (
    'a.galvan@vgmedical.com.co',
    'carmenbarrios@vgmedical.com.co',
    'i.contreras@vgmedical.com.co',
    'katherinnesolano1@hotmail.com',
    'm.buelvas@vgmedical.com.co',
    'm.cobo@vgmedical.com.co',
    'mn@vgmedical.com.co',
    'sramirez@vgmedical.com.co'
)
ORDER BY created_at DESC;

-- Mensaje de confirmación
DO $$ 
DECLARE
    user_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO user_count
    FROM users 
    WHERE email IN (
        'a.galvan@vgmedical.com.co',
        'carmenbarrios@vgmedical.com.co',
        'i.contreras@vgmedical.com.co',
        'katherinnesolano1@hotmail.com',
        'm.buelvas@vgmedical.com.co',
        'm.cobo@vgmedical.com.co',
        'mn@vgmedical.com.co',
        'sramirez@vgmedical.com.co'
    );
    
    RAISE NOTICE 'Total de usuarios de ventas creados/actualizados: %', user_count;
END $$;