-- ========================================
-- DIAGNÓSTICO COMPLETO DE HOSPITAL_CONTRACTS
-- ========================================

-- 1. Verificar estructura de la tabla
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'hospital_contracts'
ORDER BY ordinal_position;

-- 2. Verificar constraints
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'hospital_contracts'::regclass;

-- 3. Verificar estado de RLS
SELECT 
    schemaname,
    tablename,
    rowsecurity,
    forcerowsecurity
FROM pg_tables
WHERE tablename = 'hospital_contracts';

-- 4. Verificar políticas RLS
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'hospital_contracts';

-- 5. Verificar triggers
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE event_object_table = 'hospital_contracts';

-- 6. Verificar permisos del usuario actual
SELECT 
    has_table_privilege('hospital_contracts', 'INSERT') as can_insert,
    has_table_privilege('hospital_contracts', 'SELECT') as can_select,
    has_table_privilege('hospital_contracts', 'UPDATE') as can_update,
    has_table_privilege('hospital_contracts', 'DELETE') as can_delete;

-- 7. Verificar si created_by acepta NULL
SELECT 
    column_name,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'hospital_contracts'
AND column_name = 'created_by';

-- 8. Intentar una inserción de prueba simple
-- Descomenta y ajusta el hospital_id para probar
/*
INSERT INTO hospital_contracts (
    hospital_id,
    contract_number,
    contract_type,
    contract_value,
    start_date,
    end_date,
    active
) VALUES (
    'AJUSTA_ESTE_UUID', -- Reemplaza con un hospital_id válido
    'TEST-001',
    'capita',
    1000000,
    '2024-01-01',
    '2024-12-31',
    true
);
*/

-- 9. Ver últimos errores (si hay logs habilitados)
-- SELECT * FROM pg_stat_activity WHERE state = 'idle in transaction' AND query LIKE '%hospital_contracts%';

-- 10. Verificar si hay reglas (RULES) en la tabla
SELECT 
    schemaname,
    tablename,
    rulename,
    definition
FROM pg_rules
WHERE tablename = 'hospital_contracts';