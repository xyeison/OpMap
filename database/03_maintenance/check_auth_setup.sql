-- ========================================
-- VERIFICAR CONFIGURACIÓN DE AUTENTICACIÓN
-- ========================================

-- 1. Ver si estás usando Supabase Auth
SELECT EXISTS (
    SELECT 1 
    FROM information_schema.schemata 
    WHERE schema_name = 'auth'
) as auth_schema_exists;

-- 2. Verificar el usuario actual
SELECT 
    current_user,
    session_user,
    auth.uid() as auth_uid,
    auth.role() as auth_role;

-- 3. Ver estructura de la tabla users
SELECT 
    column_name,
    data_type,
    column_default
FROM information_schema.columns
WHERE table_name = 'users'
AND column_name IN ('id', 'email', 'role')
ORDER BY ordinal_position;

-- 4. Ver algunos usuarios de ejemplo
SELECT 
    id,
    email,
    role,
    active
FROM users
LIMIT 5;

-- 5. Verificar si el problema es que no hay un usuario autenticado
-- Intenta insertar con un user_id específico
DO $$
DECLARE
    test_user_id UUID;
    test_hospital_id UUID;
BEGIN
    -- Obtener un usuario admin
    SELECT id INTO test_user_id
    FROM users
    WHERE role = 'admin' OR email LIKE '%admin%'
    LIMIT 1;
    
    -- Obtener un hospital activo
    SELECT id INTO test_hospital_id
    FROM hospitals
    WHERE active = true
    LIMIT 1;
    
    RAISE NOTICE 'Usuario de prueba: %', test_user_id;
    RAISE NOTICE 'Hospital de prueba: %', test_hospital_id;
    
    -- Intentar insertar con este usuario
    BEGIN
        INSERT INTO hospital_contracts (
            hospital_id,
            contract_number,
            contract_type,
            contract_value,
            start_date,
            end_date,
            duration_months,
            current_provider,
            active,
            created_by
        ) VALUES (
            test_hospital_id,
            'TEST-AUTH-' || substring(gen_random_uuid()::text from 1 for 8),
            'capita',
            1000000,
            '2024-01-01',
            '2024-12-31',
            12,
            'Test Provider',
            true,
            test_user_id
        );
        
        RAISE NOTICE 'INSERT exitoso con usuario específico';
        
        -- Limpiar
        DELETE FROM hospital_contracts 
        WHERE contract_number LIKE 'TEST-AUTH-%';
        
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Error en INSERT: %', SQLERRM;
    END;
END $$;