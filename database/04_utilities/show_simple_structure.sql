-- =====================================================
-- ESTRUCTURA SIMPLE: TABLAS Y COLUMNAS
-- =====================================================
-- Lista compacta de todas las tablas con sus columnas
-- =====================================================

-- Formato simple: tabla.columna (tipo)
SELECT 
    table_name || '.' || column_name AS "tabla.columna",
    data_type || 
    CASE 
        WHEN character_maximum_length IS NOT NULL 
        THEN '(' || character_maximum_length || ')'
        WHEN numeric_precision IS NOT NULL 
        THEN '(' || numeric_precision || ')'
        ELSE ''
    END AS tipo,
    CASE 
        WHEN is_nullable = 'NO' THEN 'NOT NULL'
        ELSE ''
    END AS restriccion
FROM information_schema.columns 
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;

-- Alternativa: Agrupado por tabla
\echo ''
\echo 'ESTRUCTURA AGRUPADA POR TABLA:'
\echo '================================'
\echo ''

WITH table_columns AS (
    SELECT 
        table_name,
        string_agg(
            column_name || ' (' || 
            data_type || 
            CASE 
                WHEN character_maximum_length IS NOT NULL 
                THEN ',' || character_maximum_length
                WHEN numeric_precision IS NOT NULL 
                THEN ',' || numeric_precision
                ELSE ''
            END || ')',
            ', ' ORDER BY ordinal_position
        ) AS columnas
    FROM information_schema.columns 
    WHERE table_schema = 'public'
    GROUP BY table_name
)
SELECT 
    '📌 ' || table_name AS tabla,
    columnas
FROM table_columns
ORDER BY table_name;

-- Solo nombres de tablas
\echo ''
\echo 'LISTA DE TABLAS:'
\echo '================'
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- Resumen ultra-compacto
\echo ''
\echo 'RESUMEN COMPLETO EN UNA CONSULTA:'
\echo '=================================='
WITH tabla_info AS (
    SELECT 
        t.table_name,
        COUNT(c.column_name) as num_columnas,
        array_agg(c.column_name ORDER BY c.ordinal_position) as columnas
    FROM information_schema.tables t
    JOIN information_schema.columns c ON t.table_name = c.table_name
    WHERE t.table_schema = 'public' 
        AND t.table_type = 'BASE TABLE'
        AND c.table_schema = 'public'
    GROUP BY t.table_name
)
SELECT 
    table_name AS "Tabla",
    num_columnas AS "# Cols",
    array_to_string(columnas, ', ') AS "Columnas"
FROM tabla_info
ORDER BY 
    CASE 
        WHEN table_name LIKE 'hospital%' THEN 1
        WHEN table_name LIKE 'kam%' THEN 2
        WHEN table_name LIKE 'assignment%' THEN 3
        WHEN table_name LIKE 'travel_%' THEN 4
        WHEN table_name LIKE 'department%' THEN 5
        WHEN table_name LIKE 'municipalit%' THEN 6
        WHEN table_name LIKE 'user%' THEN 7
        ELSE 8
    END,
    table_name;