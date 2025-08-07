-- =====================================================
-- ESTRUCTURA COMPACTA - TODAS LAS COLUMNAS POR TABLA
-- Para Supabase SQL Editor
-- =====================================================

-- Vista compacta: Una fila por tabla con todas sus columnas
WITH tabla_columnas AS (
    SELECT 
        table_name,
        string_agg(
            column_name || ' (' || 
            data_type || 
            CASE 
                WHEN character_maximum_length IS NOT NULL 
                THEN ':' || character_maximum_length
                WHEN numeric_precision IS NOT NULL 
                THEN ':' || numeric_precision
                ELSE ''
            END || ')',
            ', ' ORDER BY ordinal_position
        ) AS columnas
    FROM information_schema.columns 
    WHERE table_schema = 'public'
    GROUP BY table_name
)
SELECT 
    table_name AS "Tabla",
    columnas AS "Columnas (tipo)"
FROM tabla_columnas
WHERE table_name IN (
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
)
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