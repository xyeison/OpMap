-- =====================================================
-- ESTRUCTURA COMPLETA DE LA BASE DE DATOS
-- Para ejecutar en Supabase SQL Editor
-- =====================================================

-- 1. LISTA DE TODAS LAS TABLAS CON CONTEO DE COLUMNAS
SELECT 
    t.table_name AS "Tabla",
    COUNT(c.column_name) AS "Columnas",
    pg_size_pretty(pg_total_relation_size('public.' || t.table_name)) AS "Tamaño",
    CASE 
        WHEN t.table_name LIKE 'travel_%' THEN '📍 Caché/Viajes'
        WHEN t.table_name LIKE 'hospital%' THEN '🏥 Hospitales'
        WHEN t.table_name LIKE 'kam%' THEN '👤 KAMs'
        WHEN t.table_name LIKE 'assignment%' THEN '📋 Asignaciones'
        WHEN t.table_name LIKE 'department%' THEN '🗺️ Geografía'
        WHEN t.table_name LIKE 'municipalit%' THEN '🏘️ Geografía'
        WHEN t.table_name LIKE 'user%' THEN '👥 Usuarios'
        WHEN t.table_name IN ('opportunities', 'visits') THEN '💼 Comercial'
        ELSE '📁 Sistema'
    END AS "Categoría"
FROM information_schema.tables t
LEFT JOIN information_schema.columns c 
    ON t.table_name = c.table_name 
    AND t.table_schema = c.table_schema
WHERE t.table_schema = 'public' 
    AND t.table_type = 'BASE TABLE'
GROUP BY t.table_name
ORDER BY 
    CASE 
        WHEN t.table_name LIKE 'hospital%' THEN 1
        WHEN t.table_name LIKE 'kam%' THEN 2
        WHEN t.table_name LIKE 'assignment%' THEN 3
        WHEN t.table_name LIKE 'travel_%' THEN 4
        ELSE 5
    END,
    t.table_name;