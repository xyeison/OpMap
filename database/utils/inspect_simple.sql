-- ==================================================================
-- SCRIPT SIMPLE DE INSPECCIÓN CON RLS Y MÁS INFORMACIÓN
-- ==================================================================

-- ============================================
-- 1. VISTA RÁPIDA: TABLAS, COLUMNAS Y RLS
-- ============================================
WITH table_rls AS (
    SELECT 
        c.relname AS tabla,
        CASE c.relrowsecurity 
            WHEN true THEN 'Sí' 
            ELSE 'No' 
        END AS rls_enabled,
        COUNT(p.policyname) AS policies_count
    FROM pg_class c
    LEFT JOIN pg_policies p ON p.tablename = c.relname AND p.schemaname = 'public'
    WHERE c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
        AND c.relkind = 'r'
    GROUP BY c.relname, c.relrowsecurity
),
table_columns AS (
    SELECT 
        table_name,
        COUNT(*) AS column_count,
        string_agg(
            column_name || ':' || 
            CASE 
                WHEN data_type = 'character varying' THEN 'varchar'
                WHEN data_type = 'timestamp with time zone' THEN 'timestamptz'
                ELSE data_type
            END,
            ', ' ORDER BY ordinal_position
        ) AS columns_list
    FROM information_schema.columns
    WHERE table_schema = 'public'
    GROUP BY table_name
)
SELECT 
    tc.table_name AS "Tabla",
    tc.column_count AS "Cols",
    tr.rls_enabled AS "RLS",
    tr.policies_count AS "Pol",
    CASE 
        WHEN LENGTH(tc.columns_list) > 80 THEN 
            SUBSTRING(tc.columns_list, 1, 77) || '...'
        ELSE tc.columns_list
    END AS "Columnas"
FROM table_columns tc
LEFT JOIN table_rls tr ON tc.table_name = tr.tabla
ORDER BY tc.table_name;

-- ============================================
-- 2. POLÍTICAS RLS DETALLADAS
-- ============================================
SELECT 
    '--- POLÍTICAS RLS ---' AS info;

SELECT 
    tablename AS "Tabla",
    policyname AS "Política",
    cmd AS "Cmd",
    roles AS "Roles",
    CASE permissive 
        WHEN 'PERMISSIVE' THEN 'Perm'
        ELSE 'Rest'
    END AS "Tipo"
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- ============================================
-- 3. RELACIONES (FOREIGN KEYS)
-- ============================================
SELECT 
    '--- RELACIONES ENTRE TABLAS ---' AS info;

SELECT 
    tc.table_name || '.' || kcu.column_name AS "De",
    '→' AS "",
    ccu.table_name || '.' || ccu.column_name AS "A"
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_schema = 'public'
ORDER BY tc.table_name;

-- ============================================
-- 4. ESTADÍSTICAS RÁPIDAS
-- ============================================
SELECT 
    '--- ESTADÍSTICAS ---' AS info;

SELECT 
    t.tablename AS "Tabla",
    pg_size_pretty(pg_total_relation_size(c.oid)) AS "Tamaño",
    pg_stat_get_live_tuples(c.oid) AS "Filas",
    (SELECT COUNT(*) FROM pg_indexes WHERE tablename = t.tablename) AS "Índices"
FROM pg_tables t
LEFT JOIN pg_class c ON c.relname = t.tablename 
    AND c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
WHERE t.schemaname = 'public'
ORDER BY pg_total_relation_size(c.oid) DESC NULLS LAST
LIMIT 15;

-- ============================================
-- 5. ADVERTENCIAS DE SEGURIDAD
-- ============================================
SELECT 
    '--- ADVERTENCIAS ---' AS info;

-- Tablas con RLS habilitado pero sin políticas
SELECT 
    'RLS sin políticas' AS "Problema",
    c.relname AS "Tabla",
    'Nadie puede acceder a esta tabla!' AS "Impacto"
FROM pg_class c
WHERE c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    AND c.relkind = 'r'
    AND c.relrowsecurity = true
    AND NOT EXISTS (
        SELECT 1 FROM pg_policies p 
        WHERE p.tablename = c.relname 
        AND p.schemaname = 'public'
    )
UNION ALL
-- Políticas que dan acceso a todos
SELECT 
    'Política muy permisiva' AS "Problema",
    tablename AS "Tabla",
    'Acceso completo a PUBLIC' AS "Impacto"
FROM pg_policies
WHERE schemaname = 'public'
    AND roles = '{public}'
    AND (qual = 'true' OR qual IS NULL)
    AND (with_check = 'true' OR with_check IS NULL)
LIMIT 10;