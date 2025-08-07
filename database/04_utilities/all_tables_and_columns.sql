-- =====================================================
-- TODAS LAS TABLAS Y SUS COLUMNAS
-- Para Supabase SQL Editor
-- =====================================================

-- OPCIÓN 1: Vista detallada con tipos de datos
SELECT 
    table_name AS "Tabla",
    column_name AS "Columna",
    data_type || 
    CASE 
        WHEN character_maximum_length IS NOT NULL 
        THEN '(' || character_maximum_length || ')'
        WHEN numeric_precision IS NOT NULL 
        THEN '(' || numeric_precision || ',' || COALESCE(numeric_scale, 0) || ')'
        ELSE ''
    END AS "Tipo",
    CASE 
        WHEN is_nullable = 'NO' THEN 'NO'
        ELSE 'SI'
    END AS "Permite NULL",
    COALESCE(column_default, '') AS "Valor Default"
FROM information_schema.columns 
WHERE table_schema = 'public'
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
    table_name, 
    ordinal_position;