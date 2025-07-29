-- Script específico para depurar políticas RLS

-- 1. Ver estado de RLS
SELECT 
    'hospitals' as tabla,
    relrowsecurity as rls_enabled,
    relforcerowsecurity as rls_forced
FROM pg_class
WHERE relname = 'hospitals'
UNION ALL
SELECT 
    'hospital_history' as tabla,
    relrowsecurity as rls_enabled,
    relforcerowsecurity as rls_forced
FROM pg_class
WHERE relname = 'hospital_history';

-- 2. Ver TODAS las políticas detalladas
SELECT 
    tablename,
    policyname,
    permissive,
    array_to_string(roles, ', ') as roles,
    cmd as operation,
    qual as using_expression,
    with_check as with_check_expression
FROM pg_policies
WHERE schemaname = 'public' 
AND tablename IN ('hospitals', 'hospital_history')
ORDER BY tablename, policyname;

-- 3. Verificar rol actual y contexto
SELECT 
    current_user,
    current_role,
    session_user,
    (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) as is_superuser;

-- 4. Probar si el usuario actual puede hacer SELECT
SELECT 'Can SELECT from hospitals:' as test, 
    CASE WHEN EXISTS (SELECT 1 FROM hospitals LIMIT 1) 
    THEN 'YES' ELSE 'NO' END as result;

SELECT 'Can SELECT from hospital_history:' as test,
    CASE WHEN EXISTS (SELECT 1 FROM hospital_history LIMIT 1) 
    THEN 'YES' ELSE 'NO' END as result;

-- 5. Ver estructura específica de columnas problemáticas
SELECT 
    column_name,
    is_nullable,
    data_type,
    column_default
FROM information_schema.columns
WHERE table_name = 'hospital_history'
AND column_name IN ('user_id', 'reason', 'created_by')
ORDER BY ordinal_position;