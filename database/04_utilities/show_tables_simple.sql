-- Versión simplificada para ver todas las tablas y su estructura
-- Ejecutar cada sección por separado en Supabase SQL Editor

-- 1. Ver todas las tablas
SELECT 
    table_schema,
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns WHERE columns.table_name = tables.table_name AND columns.table_schema = tables.table_schema) as column_count
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- 2. Ver estructura de una tabla específica (cambiar 'nombre_tabla')
-- Para hospitals:
SELECT 
    column_name,
    ordinal_position,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'hospitals'
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 3. Ver todas las columnas de todas las tablas
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;

-- 4. Script para generar la descripción de todas las tablas
WITH table_info AS (
    SELECT 
        c.table_name,
        STRING_AGG(
            c.column_name || ' ' || 
            c.data_type || 
            CASE WHEN c.is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END,
            ', ' ORDER BY c.ordinal_position
        ) AS columns
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
    GROUP BY c.table_name
)
SELECT 
    table_name,
    columns
FROM table_info
ORDER BY table_name;