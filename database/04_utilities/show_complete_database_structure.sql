-- =====================================================
-- ESTRUCTURA COMPLETA DE LA BASE DE DATOS
-- =====================================================
-- Este script muestra TODAS las tablas con sus columnas,
-- tipos de datos, restricciones y comentarios
-- =====================================================

-- Limpiar pantalla
\echo '\n======================================================'
\echo 'ESTRUCTURA COMPLETA DE LA BASE DE DATOS OPMAP'
\echo '======================================================'
\echo ''

-- 1. RESUMEN DE TABLAS
\echo '📊 RESUMEN DE TABLAS'
\echo '--------------------'
SELECT 
    schemaname AS esquema,
    tablename AS tabla,
    CASE 
        WHEN tablename LIKE 'travel_%' THEN '📍 Caché/Viajes'
        WHEN tablename LIKE 'hospital%' THEN '🏥 Hospitales'
        WHEN tablename LIKE 'kam%' THEN '👤 KAMs'
        WHEN tablename LIKE 'assignment%' THEN '📋 Asignaciones'
        WHEN tablename LIKE 'department%' THEN '🗺️ Geografía'
        WHEN tablename LIKE 'municipalit%' THEN '🏘️ Geografía'
        WHEN tablename LIKE 'user%' THEN '👥 Usuarios'
        WHEN tablename IN ('opportunities', 'visits') THEN '💼 Comercial'
        ELSE '📁 Sistema'
    END AS categoria,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS tamaño
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY 
    CASE 
        WHEN tablename LIKE 'hospital%' THEN 1
        WHEN tablename LIKE 'kam%' THEN 2
        WHEN tablename LIKE 'assignment%' THEN 3
        WHEN tablename LIKE 'travel_%' THEN 4
        WHEN tablename LIKE 'department%' THEN 5
        WHEN tablename LIKE 'municipalit%' THEN 6
        WHEN tablename LIKE 'user%' THEN 7
        ELSE 8
    END,
    tablename;

\echo ''
\echo '======================================================'
\echo '📋 ESTRUCTURA DETALLADA DE CADA TABLA'
\echo '======================================================'

-- 2. ESTRUCTURA DETALLADA POR TABLA

-- HOSPITALS
\echo ''
\echo '🏥 TABLA: hospitals'
\echo '-------------------'
SELECT 
    ordinal_position AS pos,
    column_name AS columna,
    data_type AS tipo,
    CASE 
        WHEN character_maximum_length IS NOT NULL 
        THEN '(' || character_maximum_length || ')'
        WHEN numeric_precision IS NOT NULL 
        THEN '(' || numeric_precision || ',' || COALESCE(numeric_scale, 0) || ')'
        ELSE ''
    END AS longitud,
    CASE 
        WHEN is_nullable = 'NO' THEN '❌ NOT NULL'
        ELSE '✅ NULL'
    END AS nulo,
    COALESCE(column_default, '') AS valor_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
    AND table_name = 'hospitals'
ORDER BY ordinal_position;

-- KAMS
\echo ''
\echo '👤 TABLA: kams'
\echo '--------------'
SELECT 
    ordinal_position AS pos,
    column_name AS columna,
    data_type AS tipo,
    CASE 
        WHEN character_maximum_length IS NOT NULL 
        THEN '(' || character_maximum_length || ')'
        WHEN numeric_precision IS NOT NULL 
        THEN '(' || numeric_precision || ',' || COALESCE(numeric_scale, 0) || ')'
        ELSE ''
    END AS longitud,
    CASE 
        WHEN is_nullable = 'NO' THEN '❌ NOT NULL'
        ELSE '✅ NULL'
    END AS nulo,
    COALESCE(column_default, '') AS valor_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
    AND table_name = 'kams'
ORDER BY ordinal_position;

-- ASSIGNMENTS
\echo ''
\echo '📋 TABLA: assignments'
\echo '--------------------'
SELECT 
    ordinal_position AS pos,
    column_name AS columna,
    data_type AS tipo,
    CASE 
        WHEN character_maximum_length IS NOT NULL 
        THEN '(' || character_maximum_length || ')'
        WHEN numeric_precision IS NOT NULL 
        THEN '(' || numeric_precision || ',' || COALESCE(numeric_scale, 0) || ')'
        ELSE ''
    END AS longitud,
    CASE 
        WHEN is_nullable = 'NO' THEN '❌ NOT NULL'
        ELSE '✅ NULL'
    END AS nulo,
    COALESCE(column_default, '') AS valor_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
    AND table_name = 'assignments'
ORDER BY ordinal_position;

-- TRAVEL_TIME_CACHE
\echo ''
\echo '🚗 TABLA: travel_time_cache'
\echo '---------------------------'
SELECT 
    ordinal_position AS pos,
    column_name AS columna,
    data_type AS tipo,
    CASE 
        WHEN character_maximum_length IS NOT NULL 
        THEN '(' || character_maximum_length || ')'
        WHEN numeric_precision IS NOT NULL 
        THEN '(' || numeric_precision || ',' || COALESCE(numeric_scale, 0) || ')'
        ELSE ''
    END AS longitud,
    CASE 
        WHEN is_nullable = 'NO' THEN '❌ NOT NULL'
        ELSE '✅ NULL'
    END AS nulo,
    COALESCE(column_default, '') AS valor_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
    AND table_name = 'travel_time_cache'
ORDER BY ordinal_position;

-- HOSPITAL_CONTRACTS
\echo ''
\echo '📄 TABLA: hospital_contracts'
\echo '----------------------------'
SELECT 
    ordinal_position AS pos,
    column_name AS columna,
    data_type AS tipo,
    CASE 
        WHEN character_maximum_length IS NOT NULL 
        THEN '(' || character_maximum_length || ')'
        WHEN numeric_precision IS NOT NULL 
        THEN '(' || numeric_precision || ',' || COALESCE(numeric_scale, 0) || ')'
        ELSE ''
    END AS longitud,
    CASE 
        WHEN is_nullable = 'NO' THEN '❌ NOT NULL'
        ELSE '✅ NULL'
    END AS nulo,
    COALESCE(column_default, '') AS valor_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
    AND table_name = 'hospital_contracts'
ORDER BY ordinal_position;

-- HOSPITAL_HISTORY
\echo ''
\echo '📜 TABLA: hospital_history'
\echo '--------------------------'
SELECT 
    ordinal_position AS pos,
    column_name AS columna,
    data_type AS tipo,
    CASE 
        WHEN character_maximum_length IS NOT NULL 
        THEN '(' || character_maximum_length || ')'
        WHEN numeric_precision IS NOT NULL 
        THEN '(' || numeric_precision || ',' || COALESCE(numeric_scale, 0) || ')'
        ELSE ''
    END AS longitud,
    CASE 
        WHEN is_nullable = 'NO' THEN '❌ NOT NULL'
        ELSE '✅ NULL'
    END AS nulo,
    COALESCE(column_default, '') AS valor_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
    AND table_name = 'hospital_history'
ORDER BY ordinal_position;

-- USERS
\echo ''
\echo '👥 TABLA: users'
\echo '---------------'
SELECT 
    ordinal_position AS pos,
    column_name AS columna,
    data_type AS tipo,
    CASE 
        WHEN character_maximum_length IS NOT NULL 
        THEN '(' || character_maximum_length || ')'
        WHEN numeric_precision IS NOT NULL 
        THEN '(' || numeric_precision || ',' || COALESCE(numeric_scale, 0) || ')'
        ELSE ''
    END AS longitud,
    CASE 
        WHEN is_nullable = 'NO' THEN '❌ NOT NULL'
        ELSE '✅ NULL'
    END AS nulo,
    COALESCE(column_default, '') AS valor_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
    AND table_name = 'users'
ORDER BY ordinal_position;

-- DEPARTMENTS
\echo ''
\echo '🗺️ TABLA: departments'
\echo '---------------------'
SELECT 
    ordinal_position AS pos,
    column_name AS columna,
    data_type AS tipo,
    CASE 
        WHEN character_maximum_length IS NOT NULL 
        THEN '(' || character_maximum_length || ')'
        WHEN numeric_precision IS NOT NULL 
        THEN '(' || numeric_precision || ',' || COALESCE(numeric_scale, 0) || ')'
        ELSE ''
    END AS longitud,
    CASE 
        WHEN is_nullable = 'NO' THEN '❌ NOT NULL'
        ELSE '✅ NULL'
    END AS nulo,
    COALESCE(column_default, '') AS valor_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
    AND table_name = 'departments'
ORDER BY ordinal_position;

-- MUNICIPALITIES
\echo ''
\echo '🏘️ TABLA: municipalities'
\echo '------------------------'
SELECT 
    ordinal_position AS pos,
    column_name AS columna,
    data_type AS tipo,
    CASE 
        WHEN character_maximum_length IS NOT NULL 
        THEN '(' || character_maximum_length || ')'
        WHEN numeric_precision IS NOT NULL 
        THEN '(' || numeric_precision || ',' || COALESCE(numeric_scale, 0) || ')'
        ELSE ''
    END AS longitud,
    CASE 
        WHEN is_nullable = 'NO' THEN '❌ NOT NULL'
        ELSE '✅ NULL'
    END AS nulo,
    COALESCE(column_default, '') AS valor_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
    AND table_name = 'municipalities'
ORDER BY ordinal_position;

-- DEPARTMENT_ADJACENCY
\echo ''
\echo '🔗 TABLA: department_adjacency'
\echo '------------------------------'
SELECT 
    ordinal_position AS pos,
    column_name AS columna,
    data_type AS tipo,
    CASE 
        WHEN character_maximum_length IS NOT NULL 
        THEN '(' || character_maximum_length || ')'
        WHEN numeric_precision IS NOT NULL 
        THEN '(' || numeric_precision || ',' || COALESCE(numeric_scale, 0) || ')'
        ELSE ''
    END AS longitud,
    CASE 
        WHEN is_nullable = 'NO' THEN '❌ NOT NULL'
        ELSE '✅ NULL'
    END AS nulo,
    COALESCE(column_default, '') AS valor_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
    AND table_name = 'department_adjacency'
ORDER BY ordinal_position;

-- OPPORTUNITIES (si existe)
\echo ''
\echo '💼 TABLA: opportunities'
\echo '----------------------'
SELECT 
    ordinal_position AS pos,
    column_name AS columna,
    data_type AS tipo,
    CASE 
        WHEN character_maximum_length IS NOT NULL 
        THEN '(' || character_maximum_length || ')'
        WHEN numeric_precision IS NOT NULL 
        THEN '(' || numeric_precision || ',' || COALESCE(numeric_scale, 0) || ')'
        ELSE ''
    END AS longitud,
    CASE 
        WHEN is_nullable = 'NO' THEN '❌ NOT NULL'
        ELSE '✅ NULL'
    END AS nulo,
    COALESCE(column_default, '') AS valor_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
    AND table_name = 'opportunities'
ORDER BY ordinal_position;

-- VISITS (si existe)
\echo ''
\echo '📍 TABLA: visits'
\echo '----------------'
SELECT 
    ordinal_position AS pos,
    column_name AS columna,
    data_type AS tipo,
    CASE 
        WHEN character_maximum_length IS NOT NULL 
        THEN '(' || character_maximum_length || ')'
        WHEN numeric_precision IS NOT NULL 
        THEN '(' || numeric_precision || ',' || COALESCE(numeric_scale, 0) || ')'
        ELSE ''
    END AS longitud,
    CASE 
        WHEN is_nullable = 'NO' THEN '❌ NOT NULL'
        ELSE '✅ NULL'
    END AS nulo,
    COALESCE(column_default, '') AS valor_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
    AND table_name = 'visits'
ORDER BY ordinal_position;

-- 3. RESUMEN DE CLAVES FORÁNEAS
\echo ''
\echo '======================================================'
\echo '🔑 RELACIONES Y CLAVES FORÁNEAS'
\echo '======================================================'
SELECT 
    tc.table_name AS tabla_origen,
    kcu.column_name AS columna_origen,
    '→' AS flecha,
    ccu.table_name AS tabla_destino,
    ccu.column_name AS columna_destino,
    tc.constraint_name AS nombre_constraint
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;

-- 4. ÍNDICES
\echo ''
\echo '======================================================'
\echo '⚡ ÍNDICES PARA OPTIMIZACIÓN'
\echo '======================================================'
SELECT 
    schemaname AS esquema,
    tablename AS tabla,
    indexname AS indice,
    pg_size_pretty(pg_relation_size(indexrelid)) AS tamaño
FROM pg_indexes 
JOIN pg_stat_user_indexes ON indexrelname = indexname
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- 5. VISTAS
\echo ''
\echo '======================================================'
\echo '👁️ VISTAS'
\echo '======================================================'
SELECT 
    table_name AS vista,
    CASE 
        WHEN table_name LIKE 'kam_%' THEN '📊 Estadísticas KAM'
        WHEN table_name LIKE 'territory_%' THEN '🗺️ Territorios'
        ELSE '📁 General'
    END AS tipo
FROM information_schema.views
WHERE table_schema = 'public'
ORDER BY table_name;

-- 6. ESTADÍSTICAS GENERALES
\echo ''
\echo '======================================================'
\echo '📊 ESTADÍSTICAS GENERALES'
\echo '======================================================'
SELECT 
    'Total de tablas' AS metrica,
    COUNT(*)::text AS valor
FROM information_schema.tables 
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
UNION ALL
SELECT 
    'Total de columnas' AS metrica,
    COUNT(*)::text AS valor
FROM information_schema.columns 
WHERE table_schema = 'public'
UNION ALL
SELECT 
    'Total de índices' AS metrica,
    COUNT(*)::text AS valor
FROM pg_indexes 
WHERE schemaname = 'public'
UNION ALL
SELECT 
    'Total de claves foráneas' AS metrica,
    COUNT(*)::text AS valor
FROM information_schema.table_constraints 
WHERE constraint_type = 'FOREIGN KEY' AND table_schema = 'public'
UNION ALL
SELECT 
    'Total de vistas' AS metrica,
    COUNT(*)::text AS valor
FROM information_schema.views 
WHERE table_schema = 'public'
UNION ALL
SELECT 
    'Tamaño total de la BD' AS metrica,
    pg_size_pretty(pg_database_size(current_database())) AS valor;

\echo ''
\echo '======================================================'
\echo '✅ ESTRUCTURA COMPLETA GENERADA'
\echo '======================================================'\echo ''