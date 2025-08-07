-- =====================================================
-- CONSULTA MAESTRA - TODA LA ESTRUCTURA
-- Para Supabase SQL Editor
-- =====================================================
-- Esta consulta muestra TODA la información de estructura
-- en una sola ejecución con múltiples resultsets
-- =====================================================

-- RESULTADO 1: Resumen de tablas
WITH table_summary AS (
    SELECT 
        t.table_name,
        COUNT(c.column_name) as column_count,
        COUNT(fk.constraint_name) as fk_count,
        pg_size_pretty(pg_total_relation_size('public.' || t.table_name)) as size
    FROM information_schema.tables t
    LEFT JOIN information_schema.columns c 
        ON t.table_name = c.table_name 
        AND t.table_schema = c.table_schema
    LEFT JOIN information_schema.table_constraints fk
        ON t.table_name = fk.table_name 
        AND t.table_schema = fk.table_schema
        AND fk.constraint_type = 'FOREIGN KEY'
    WHERE t.table_schema = 'public' 
        AND t.table_type = 'BASE TABLE'
    GROUP BY t.table_name
),
-- RESULTADO 2: Todas las columnas
all_columns AS (
    SELECT 
        table_name,
        array_agg(
            column_name || ':' || data_type || 
            CASE 
                WHEN is_nullable = 'NO' THEN '*' 
                ELSE '' 
            END
            ORDER BY ordinal_position
        ) as columns
    FROM information_schema.columns
    WHERE table_schema = 'public'
    GROUP BY table_name
)
-- COMBINACIÓN FINAL
SELECT 
    '📊 ' || ts.table_name AS "Tabla",
    ts.column_count AS "Cols",
    ts.fk_count AS "FKs",
    ts.size AS "Tamaño",
    ac.columns AS "Columnas (* = NOT NULL)"
FROM table_summary ts
JOIN all_columns ac ON ts.table_name = ac.table_name
ORDER BY 
    CASE 
        WHEN ts.table_name LIKE 'hospital%' THEN 1
        WHEN ts.table_name LIKE 'kam%' THEN 2
        WHEN ts.table_name LIKE 'assignment%' THEN 3
        WHEN ts.table_name LIKE 'travel_%' THEN 4
        WHEN ts.table_name LIKE 'department%' THEN 5
        WHEN ts.table_name LIKE 'municipalit%' THEN 6
        WHEN ts.table_name LIKE 'user%' THEN 7
        ELSE 8
    END,
    ts.table_name;