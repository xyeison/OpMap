-- ========================================
-- DIAGNÓSTICO SIMPLE DE HOSPITAL_CONTRACTS
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

-- 3. Verificar estado de RLS (versión compatible)
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables
WHERE tablename = 'hospital_contracts';

-- 4. Verificar si RLS está activo
SELECT 
    'RLS está ' || CASE WHEN relrowsecurity THEN 'HABILITADO' ELSE 'DESHABILITADO' END as rls_status
FROM pg_class
WHERE relname = 'hospital_contracts';

-- 5. Verificar políticas RLS (si existen)
SELECT 
    pol.polname as policy_name,
    CASE pol.polcmd 
        WHEN 'r' THEN 'SELECT'
        WHEN 'a' THEN 'INSERT'
        WHEN 'w' THEN 'UPDATE'
        WHEN 'd' THEN 'DELETE'
        ELSE 'ALL'
    END as command,
    pg_get_expr(pol.polqual, pol.polrelid) as using_expression,
    pg_get_expr(pol.polwithcheck, pol.polrelid) as with_check_expression
FROM pg_policy pol
JOIN pg_class cls ON pol.polrelid = cls.oid
WHERE cls.relname = 'hospital_contracts';

-- 6. Verificar triggers
SELECT 
    tgname as trigger_name,
    proname as function_name
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE tgrelid = 'hospital_contracts'::regclass;

-- 7. Verificar permisos básicos
SELECT 
    has_table_privilege('hospital_contracts', 'INSERT') as can_insert,
    has_table_privilege('hospital_contracts', 'SELECT') as can_select,
    has_table_privilege('hospital_contracts', 'UPDATE') as can_update,
    has_table_privilege('hospital_contracts', 'DELETE') as can_delete;

-- 8. Ver campos NOT NULL sin default
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'hospital_contracts'
AND is_nullable = 'NO'
AND column_default IS NULL
ORDER BY ordinal_position;

-- 9. Verificar si hay funciones/triggers de validación
SELECT 
    p.proname as function_name,
    pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_trigger t ON t.tgfoid = p.oid
WHERE t.tgrelid = 'hospital_contracts'::regclass;

-- 10. IMPORTANTE: Deshabilitar RLS completamente para pruebas
-- Si nada más funciona, ejecuta esto:
/*
BEGIN;
ALTER TABLE hospital_contracts DISABLE ROW LEVEL SECURITY;
-- Intenta insertar aquí
-- Si funciona, el problema es RLS
ROLLBACK; -- o COMMIT si quieres mantener el cambio
*/