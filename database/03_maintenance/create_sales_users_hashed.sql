-- Script para crear usuarios del equipo de ventas
-- Fecha: 2025-01-30
-- IMPORTANTE: Ejecutar este script en Supabase SQL Editor

-- Primero verificamos que no existan usuarios con estos emails (opcional)
-- DELETE FROM users WHERE email IN (
--     'a.galvan@vgmedical.com.co',
--     'carmenbarrios@vgmedical.com.co',
--     'i.contreras@vgmedical.com.co',
--     'katherinnesolano1@hotmail.com',
--     'm.buelvas@vgmedical.com.co',
--     'm.cobo@vgmedical.com.co',
--     'mn@vgmedical.com.co',
--     'sramirez@vgmedical.com.co'
-- );

-- Insertar nuevos usuarios de ventas
INSERT INTO users (email, password, full_name, role, active, created_at) VALUES
    ('a.galvan@vgmedical.com.co',
     '$2b$10$N/4fhlpOA82oltMpkiVSTOVXZXpC/ftdjjgw4KRXTbWhFR0J0BA0K',
     'Andrea Juliana Galvan Ramirez',
     'sales_manager',
     true,
     NOW()),
    -- Contraseña: andrea901$

    ('carmenbarrios@vgmedical.com.co',
     '$2b$10$7zdL/Li7j1rPhTGrtMqXN.ZTnxza/CLNiHdCDbKXdztIrDA2tSoay',
     'Carmen Edith Barrios Barrios',
     'sales_manager',
     true,
     NOW()),
    -- Contraseña: carmen901$

    ('i.contreras@vgmedical.com.co',
     '$2b$10$Mj3liqVwfH6oq9ih/TCDxuZV0qjgx2VKQonOooEO8oSSujmR.EzKe',
     'Iván Rodolfo Contreras Prieto',
     'sales_manager',
     true,
     NOW()),
    -- Contraseña: ivan901$

    ('katherinnesolano1@hotmail.com',
     '$2b$10$UiLft4EGZ.iEKLv42UF.ee12PL5EkRXVKASketzdN62uxah76k1cm',
     'Katherinne Solano Escamilla',
     'sales_manager',
     true,
     NOW()),
    -- Contraseña: katherinne901$

    ('m.buelvas@vgmedical.com.co',
     '$2b$10$h9rwwCiC56Xm/CCjygxxouFuKtgEUiINwA.EpbHELy.9U2gKB0H.G',
     'Mileydis Amaparo Buelvas Castellar',
     'sales_manager',
     true,
     NOW()),
    -- Contraseña: mileydis901$

    ('m.cobo@vgmedical.com.co',
     '$2b$10$qSTIPI3fKO8CGWa0F0DzMOZHPtI.3OLq9selCPZlkE0bj.AMEQQgu',
     'Maria Alejandra Cobo Bulla',
     'sales_manager',
     true,
     NOW()),
    -- Contraseña: alejandra901$

    ('mn@vgmedical.com.co',
     '$2b$10$VERwb992/ueswsAwPmW5PukMdFqIxqlsy9IDVCFVYRgk/MYX.r9le',
     'Maryerith Aimee Núñez Padilla',
     'sales_manager',
     true,
     NOW()),
    -- Contraseña: maryerith901$

    ('sramirez@vgmedical.com.co',
     '$2b$10$.nxIkF4k3zYytohsi2qoJ.YdTdnQRpvD2dObiapvnjfO6a0VYBp4C',
     'Sindy Lorena Ramirez de la Rosa',
     'sales_manager',
     true,
     NOW())
    -- Contraseña: sindy901$
ON CONFLICT (email) DO UPDATE SET
    password = EXCLUDED.password,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    active = EXCLUDED.active;

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
    WHERE role = 'sales_manager' AND active = true;
    
    RAISE NOTICE 'Total de usuarios de ventas activos: %', user_count;
END $$;
