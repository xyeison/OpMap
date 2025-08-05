-- ========================================
-- FIX: COLUMNA created_by EN hospital_contracts
-- ========================================

-- 1. Ver la definición actual de la columna
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'hospital_contracts'
AND column_name = 'created_by';

-- 2. Hacer que created_by acepte NULL
ALTER TABLE hospital_contracts 
ALTER COLUMN created_by DROP NOT NULL;

-- 3. Verificar el cambio
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'hospital_contracts'
AND column_name = 'created_by';

-- 4. Ahora intenta el INSERT de nuevo (con el hospital_id correcto):
/*
INSERT INTO hospital_contracts (
    hospital_id,
    contract_value,
    start_date,
    duration_months,
    current_provider,
    active
) VALUES (
    'TU_HOSPITAL_ID_AQUI',
    1000000,
    '2024-01-01',
    12,
    'Proveedor Test',
    true
) RETURNING *;
*/

-- ========================================
-- ALTERNATIVA: Si prefieres mantener created_by NOT NULL
-- ========================================
-- Puedes crear un usuario "sistema" por defecto:

-- 1. Verificar si existe la tabla users
-- SELECT * FROM users LIMIT 1;

-- 2. Si existe, obtener un user_id válido para usar como default
-- SELECT id FROM users WHERE email = 'admin@opmap.com' OR role = 'admin' LIMIT 1;

-- 3. Establecer un valor por defecto (ajusta el UUID):
-- ALTER TABLE hospital_contracts 
-- ALTER COLUMN created_by SET DEFAULT 'UUID_DEL_USUARIO_ADMIN';