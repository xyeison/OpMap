-- Script de verificación completo para el sistema de hospitales

-- 1. Verificar estructura de la tabla hospitals
SELECT '=== TABLA HOSPITALS ===' as verificacion;
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'hospitals'
AND column_name IN ('id', 'name', 'code', 'active', 'created_at', 'updated_at')
ORDER BY ordinal_position;

-- 2. Verificar estructura de la tabla hospital_history
SELECT '=== TABLA HOSPITAL_HISTORY ===' as verificacion;
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'hospital_history'
ORDER BY ordinal_position;

-- 3. Verificar políticas RLS de hospitals
SELECT '=== POLÍTICAS RLS - HOSPITALS ===' as verificacion;
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
WHERE schemaname = 'public' 
AND tablename = 'hospitals';

-- 4. Verificar políticas RLS de hospital_history
SELECT '=== POLÍTICAS RLS - HOSPITAL_HISTORY ===' as verificacion;
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
WHERE schemaname = 'public' 
AND tablename = 'hospital_history';

-- 5. Verificar si RLS está habilitado
SELECT '=== ESTADO DE RLS ===' as verificacion;
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables
WHERE schemaname = 'public' 
AND tablename IN ('hospitals', 'hospital_history');

-- 6. Verificar constraints
SELECT '=== CONSTRAINTS ===' as verificacion;
SELECT 
    conname AS constraint_name,
    contype AS constraint_type,
    conrelid::regclass AS table_name,
    pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid IN ('hospitals'::regclass, 'hospital_history'::regclass);

-- 7. Verificar índices
SELECT '=== ÍNDICES ===' as verificacion;
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public' 
AND tablename IN ('hospitals', 'hospital_history');

-- 8. Test de inserción simulado (sin ejecutar)
SELECT '=== TEST DE INSERCIÓN (SIMULADO) ===' as verificacion;
SELECT 
    'INSERT INTO hospital_history (hospital_id, action, reason, user_id, previous_state, new_state) VALUES (...)'
    AS ejemplo_insert;

-- 9. Verificar relaciones entre tablas
SELECT '=== RELACIONES FOREIGN KEY ===' as verificacion;
SELECT
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND tc.table_name IN ('hospitals', 'hospital_history');

-- 10. Contar registros existentes
SELECT '=== CONTEO DE REGISTROS ===' as verificacion;
SELECT 
    'hospitals' as tabla,
    COUNT(*) as total_registros,
    COUNT(CASE WHEN active = true THEN 1 END) as activos,
    COUNT(CASE WHEN active = false THEN 1 END) as inactivos
FROM hospitals
UNION ALL
SELECT 
    'hospital_history' as tabla,
    COUNT(*) as total_registros,
    COUNT(DISTINCT hospital_id) as hospitales_con_historial,
    0 as inactivos
FROM hospital_history;