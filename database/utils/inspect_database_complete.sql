-- ==================================================================
-- SCRIPT COMPLETO DE INSPECCIÓN DE BASE DE DATOS
-- ==================================================================
-- Muestra información detallada de todas las tablas incluyendo:
-- - Estructura de columnas
-- - Políticas RLS
-- - Índices
-- - Claves foráneas
-- - Triggers
-- - Estadísticas
-- ==================================================================

-- ============================================
-- 1. RESUMEN GENERAL DE LA BASE DE DATOS
-- ============================================
\echo '========================================='
\echo 'RESUMEN GENERAL DE LA BASE DE DATOS'
\echo '========================================='

SELECT 
    current_database() AS "Base de Datos",
    pg_size_pretty(pg_database_size(current_database())) AS "Tamaño Total",
    (SELECT count(*) FROM pg_tables WHERE schemaname = 'public') AS "Total Tablas",
    (SELECT count(*) FROM pg_views WHERE schemaname = 'public') AS "Total Vistas",
    (SELECT count(*) FROM pg_indexes WHERE schemaname = 'public') AS "Total Índices",
    (SELECT count(DISTINCT tablename) FROM pg_policies WHERE schemaname = 'public') AS "Tablas con RLS"
;

-- ============================================
-- 2. LISTADO DE TABLAS CON INFORMACIÓN BÁSICA
-- ============================================
\echo ''
\echo '========================================='
\echo 'TABLAS Y SU INFORMACIÓN BÁSICA'
\echo '========================================='

WITH table_info AS (
    SELECT 
        t.tablename,
        t.tableowner,
        COALESCE(d.description, '') AS comentario,
        pg_size_pretty(pg_total_relation_size(c.oid)) AS tamaño,
        pg_stat_get_live_tuples(c.oid) AS filas_estimadas,
        CASE 
            WHEN rls.oid IS NOT NULL THEN 'Sí'
            ELSE 'No'
        END AS rls_habilitado,
        (SELECT COUNT(*) FROM pg_policies p WHERE p.tablename = t.tablename) AS num_politicas
    FROM pg_tables t
    LEFT JOIN pg_class c ON c.relname = t.tablename AND c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LEFT JOIN pg_description d ON d.objoid = c.oid AND d.objsubid = 0
    LEFT JOIN (
        SELECT oid FROM pg_class 
        WHERE relrowsecurity = true 
        AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    ) rls ON rls.oid = c.oid
    WHERE t.schemaname = 'public'
)
SELECT 
    tablename AS "Tabla",
    tamaño AS "Tamaño",
    filas_estimadas AS "Filas (aprox)",
    rls_habilitado AS "RLS",
    num_politicas AS "Políticas",
    CASE 
        WHEN comentario != '' THEN substring(comentario, 1, 40) || '...'
        ELSE '-'
    END AS "Descripción"
FROM table_info
ORDER BY tablename;

-- ============================================
-- 3. ESTRUCTURA DETALLADA DE COLUMNAS
-- ============================================
\echo ''
\echo '========================================='
\echo 'ESTRUCTURA DETALLADA DE COLUMNAS'
\echo '========================================='

SELECT 
    t.table_name AS "Tabla",
    c.ordinal_position AS "#",
    c.column_name AS "Columna",
    CASE 
        WHEN c.data_type = 'character varying' THEN 
            'varchar(' || c.character_maximum_length || ')'
        WHEN c.data_type = 'numeric' THEN 
            'numeric(' || c.numeric_precision || ',' || c.numeric_scale || ')'
        WHEN c.data_type = 'timestamp with time zone' THEN 'timestamptz'
        WHEN c.data_type = 'timestamp without time zone' THEN 'timestamp'
        ELSE c.data_type
    END AS "Tipo",
    CASE c.is_nullable 
        WHEN 'YES' THEN '✓'
        ELSE '✗'
    END AS "Null?",
    CASE 
        WHEN pk.column_name IS NOT NULL THEN 'PK'
        WHEN fk.column_name IS NOT NULL THEN 'FK'
        WHEN uk.column_name IS NOT NULL THEN 'UK'
        ELSE ''
    END AS "Key",
    CASE 
        WHEN c.column_default LIKE 'nextval%' THEN 'AUTO_INCREMENT'
        WHEN c.column_default IS NOT NULL THEN 
            CASE 
                WHEN length(c.column_default) > 20 THEN substring(c.column_default, 1, 17) || '...'
                ELSE c.column_default
            END
        ELSE ''
    END AS "Default"
FROM information_schema.tables t
JOIN information_schema.columns c ON t.table_name = c.table_name AND t.table_schema = c.table_schema
LEFT JOIN (
    SELECT ku.table_name, ku.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage ku ON tc.constraint_name = ku.constraint_name
    WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = 'public'
) pk ON c.table_name = pk.table_name AND c.column_name = pk.column_name
LEFT JOIN (
    SELECT ku.table_name, ku.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage ku ON tc.constraint_name = ku.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
) fk ON c.table_name = fk.table_name AND c.column_name = fk.column_name
LEFT JOIN (
    SELECT ku.table_name, ku.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage ku ON tc.constraint_name = ku.constraint_name
    WHERE tc.constraint_type = 'UNIQUE' AND tc.table_schema = 'public'
) uk ON c.table_name = uk.table_name AND c.column_name = uk.column_name
WHERE t.table_schema = 'public' 
    AND t.table_type = 'BASE TABLE'
ORDER BY t.table_name, c.ordinal_position;

-- ============================================
-- 4. POLÍTICAS RLS POR TABLA
-- ============================================
\echo ''
\echo '========================================='
\echo 'POLÍTICAS RLS POR TABLA'
\echo '========================================='

SELECT 
    tablename AS "Tabla",
    policyname AS "Política",
    CASE permissive 
        WHEN 'PERMISSIVE' THEN 'Permisiva'
        ELSE 'Restrictiva'
    END AS "Tipo",
    cmd AS "Comando",
    roles AS "Roles",
    CASE 
        WHEN length(qual) > 50 THEN substring(qual, 1, 47) || '...'
        ELSE COALESCE(qual, 'true')
    END AS "Condición USING",
    CASE 
        WHEN length(with_check) > 50 THEN substring(with_check, 1, 47) || '...'
        ELSE COALESCE(with_check, 'true')
    END AS "Condición CHECK"
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- ============================================
-- 5. CLAVES FORÁNEAS (RELACIONES)
-- ============================================
\echo ''
\echo '========================================='
\echo 'RELACIONES ENTRE TABLAS (FOREIGN KEYS)'
\echo '========================================='

SELECT 
    tc.table_name AS "Tabla Origen",
    kcu.column_name AS "Columna",
    '→' AS " ",
    ccu.table_name AS "Tabla Destino",
    ccu.column_name AS "Columna Ref",
    tc.constraint_name AS "Nombre Constraint"
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;

-- ============================================
-- 6. ÍNDICES
-- ============================================
\echo ''
\echo '========================================='
\echo 'ÍNDICES'
\echo '========================================='

SELECT 
    tablename AS "Tabla",
    indexname AS "Índice",
    CASE 
        WHEN indexdef LIKE '%UNIQUE%' THEN 'ÚNICO'
        WHEN indexdef LIKE '%PRIMARY KEY%' THEN 'PRIMARY'
        ELSE 'NORMAL'
    END AS "Tipo",
    pg_size_pretty(pg_relation_size(indexname::regclass)) AS "Tamaño",
    CASE 
        WHEN length(indexdef) > 60 THEN substring(indexdef, 1, 57) || '...'
        ELSE indexdef
    END AS "Definición"
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- ============================================
-- 7. TRIGGERS
-- ============================================
\echo ''
\echo '========================================='
\echo 'TRIGGERS'
\echo '========================================='

SELECT 
    trigger_schema AS "Esquema",
    event_object_table AS "Tabla",
    trigger_name AS "Trigger",
    event_manipulation AS "Evento",
    action_timing AS "Momento",
    action_orientation AS "Orientación"
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- ============================================
-- 8. VISTAS
-- ============================================
\echo ''
\echo '========================================='
\echo 'VISTAS'
\echo '========================================='

SELECT 
    table_name AS "Vista",
    CASE 
        WHEN is_updatable = 'YES' THEN 'Sí'
        ELSE 'No'
    END AS "Actualizable",
    CASE 
        WHEN is_insertable_into = 'YES' THEN 'Sí'
        ELSE 'No'
    END AS "Insertable"
FROM information_schema.views
WHERE table_schema = 'public'
ORDER BY table_name;

-- ============================================
-- 9. FUNCIONES ALMACENADAS
-- ============================================
\echo ''
\echo '========================================='
\echo 'FUNCIONES ALMACENADAS'
\echo '========================================='

SELECT 
    routine_name AS "Función",
    routine_type AS "Tipo",
    data_type AS "Retorno",
    external_language AS "Lenguaje"
FROM information_schema.routines
WHERE routine_schema = 'public'
ORDER BY routine_name;

-- ============================================
-- 10. RESUMEN DE SEGURIDAD RLS
-- ============================================
\echo ''
\echo '========================================='
\echo 'RESUMEN DE SEGURIDAD RLS'
\echo '========================================='

WITH rls_summary AS (
    SELECT 
        c.relname AS tabla,
        c.relrowsecurity AS rls_enabled,
        c.relforcerowsecurity AS rls_forced,
        COUNT(p.policyname) AS num_policies
    FROM pg_class c
    LEFT JOIN pg_policies p ON p.tablename = c.relname AND p.schemaname = 'public'
    WHERE c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
        AND c.relkind = 'r'
    GROUP BY c.relname, c.relrowsecurity, c.relforcerowsecurity
)
SELECT 
    tabla AS "Tabla",
    CASE 
        WHEN rls_enabled THEN '✓ Habilitado'
        ELSE '✗ Deshabilitado'
    END AS "RLS Estado",
    CASE 
        WHEN rls_forced THEN '✓ Forzado'
        ELSE '✗ No forzado'
    END AS "RLS Forzado",
    num_policies AS "# Políticas",
    CASE 
        WHEN rls_enabled AND num_policies = 0 THEN '⚠️  RLS sin políticas!'
        WHEN rls_enabled AND num_policies > 0 THEN '✅ Configurado'
        ELSE '➖ N/A'
    END AS "Estado"
FROM rls_summary
WHERE rls_enabled = true OR num_policies > 0
ORDER BY tabla;

-- ============================================
-- 11. TABLAS SIN ÍNDICES (POSIBLE PROBLEMA DE RENDIMIENTO)
-- ============================================
\echo ''
\echo '========================================='
\echo 'ADVERTENCIAS Y RECOMENDACIONES'
\echo '========================================='

-- Tablas sin índices (excepto PK)
SELECT 
    'Tabla sin índices adicionales' AS "Tipo",
    t.tablename AS "Tabla",
    'Considerar agregar índices para mejorar rendimiento' AS "Recomendación"
FROM pg_tables t
WHERE t.schemaname = 'public'
    AND NOT EXISTS (
        SELECT 1 FROM pg_indexes i 
        WHERE i.tablename = t.tablename 
        AND i.schemaname = 'public'
        AND i.indexname NOT LIKE '%_pkey'
    )
UNION ALL
-- Tablas con RLS habilitado pero sin políticas
SELECT 
    'RLS sin políticas' AS "Tipo",
    c.relname AS "Tabla",
    'RLS habilitado pero sin políticas - nadie puede acceder!' AS "Recomendación"
FROM pg_class c
WHERE c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    AND c.relkind = 'r'
    AND c.relrowsecurity = true
    AND NOT EXISTS (
        SELECT 1 FROM pg_policies p 
        WHERE p.tablename = c.relname 
        AND p.schemaname = 'public'
    )
ORDER BY "Tipo", "Tabla";

-- ============================================
-- 12. INFORMACIÓN ESPECÍFICA PARA TABLAS SELECCIONADAS
-- ============================================
-- Descomenta y modifica para inspeccionar tablas específicas

/*
\echo ''
\echo '========================================='
\echo 'INSPECCIÓN DETALLADA DE TABLA ESPECÍFICA'
\echo '========================================='

-- Cambia 'proveedores' por la tabla que quieras inspeccionar
\d+ proveedores
*/

-- ==================================================================
-- FIN DEL SCRIPT DE INSPECCIÓN
-- ==================================================================