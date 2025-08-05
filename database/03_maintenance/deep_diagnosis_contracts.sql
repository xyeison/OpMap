-- ========================================
-- DIAGNÓSTICO PROFUNDO DE CONTRATOS
-- ========================================

-- 1. Verificar TODOS los campos NOT NULL
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default,
    CASE 
        WHEN is_nullable = 'NO' AND column_default IS NULL THEN '⚠️ REQUERIDO'
        WHEN is_nullable = 'NO' AND column_default IS NOT NULL THEN '✓ Tiene default'
        ELSE '✓ Acepta NULL'
    END as status
FROM information_schema.columns
WHERE table_name = 'hospital_contracts'
ORDER BY ordinal_position;

-- 2. Verificar si hay CHECK constraints
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'hospital_contracts'::regclass
AND contype = 'c';

-- 3. Verificar Foreign Keys
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'hospital_contracts'::regclass
AND contype = 'f';

-- 4. Probar inserción con TODOS los campos mínimos requeridos
DO $$
DECLARE
    v_hospital_id UUID;
    v_user_id UUID;
BEGIN
    -- Obtener IDs válidos
    SELECT id INTO v_hospital_id FROM hospitals WHERE active = true LIMIT 1;
    SELECT id INTO v_user_id FROM users LIMIT 1;
    
    RAISE NOTICE 'Hospital ID: %', v_hospital_id;
    RAISE NOTICE 'User ID: %', v_user_id;
    
    -- Lista todos los campos NOT NULL sin default
    RAISE NOTICE '';
    RAISE NOTICE 'Campos requeridos sin default:';
    FOR r IN 
        SELECT column_name 
        FROM information_schema.columns
        WHERE table_name = 'hospital_contracts'
        AND is_nullable = 'NO'
        AND column_default IS NULL
    LOOP
        RAISE NOTICE '- %', r.column_name;
    END LOOP;
END $$;

-- 5. Ver si hay alguna vista o regla que interfiera
SELECT 
    schemaname,
    tablename,
    rulename,
    definition
FROM pg_rules
WHERE tablename = 'hospital_contracts';

-- 6. Verificar si es un problema de permisos de Supabase
SELECT 
    grantee,
    privilege_type
FROM information_schema.role_table_grants
WHERE table_name = 'hospital_contracts'
AND grantee IN ('anon', 'authenticated', 'service_role');

-- 7. PRUEBA MANUAL: Intenta este INSERT con valores mínimos
-- Primero ejecuta estas consultas para obtener IDs:
SELECT id, name FROM hospitals WHERE active = true LIMIT 1;
SELECT id, email FROM users LIMIT 1;

-- Luego usa los IDs en este INSERT:
/*
INSERT INTO hospital_contracts (
    id,
    hospital_id,
    contract_value,
    start_date,
    duration_months,
    current_provider,
    active,
    created_by,
    created_at
) VALUES (
    gen_random_uuid(),
    'HOSPITAL_ID_AQUI',
    1000000,
    '2024-01-01',
    12,
    'Test',
    true,
    'USER_ID_AQUI',
    NOW()
) RETURNING *;
*/