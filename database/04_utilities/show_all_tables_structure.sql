-- Script para obtener la estructura completa de todas las tablas en Supabase
-- Ejecutar en el SQL Editor de Supabase

-- 1. Listar todas las tablas con sus descripciones
SELECT 
    schemaname AS schema,
    tablename AS table_name,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables 
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY schemaname, tablename;

-- 2. Obtener estructura detallada de cada tabla
WITH table_columns AS (
    SELECT 
        t.table_schema,
        t.table_name,
        c.column_name,
        c.ordinal_position,
        c.data_type,
        c.character_maximum_length,
        c.numeric_precision,
        c.numeric_scale,
        c.is_nullable,
        c.column_default,
        CASE 
            WHEN pk.column_name IS NOT NULL THEN 'PK'
            WHEN fk.column_name IS NOT NULL THEN 'FK'
            ELSE ''
        END AS key_type,
        fk.foreign_table_name,
        fk.foreign_column_name
    FROM information_schema.tables t
    JOIN information_schema.columns c 
        ON t.table_schema = c.table_schema 
        AND t.table_name = c.table_name
    LEFT JOIN (
        SELECT 
            tc.table_schema,
            tc.table_name,
            kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'PRIMARY KEY'
    ) pk ON c.table_schema = pk.table_schema 
        AND c.table_name = pk.table_name 
        AND c.column_name = pk.column_name
    LEFT JOIN (
        SELECT 
            kcu.table_schema,
            kcu.table_name,
            kcu.column_name,
            ccu.table_name AS foreign_table_name,
            ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
    ) fk ON c.table_schema = fk.table_schema 
        AND c.table_name = fk.table_name 
        AND c.column_name = fk.column_name
    WHERE t.table_schema NOT IN ('pg_catalog', 'information_schema')
    AND t.table_type = 'BASE TABLE'
)
SELECT 
    table_schema AS schema,
    table_name,
    column_name,
    ordinal_position AS pos,
    CASE 
        WHEN data_type = 'character varying' THEN 
            'varchar(' || COALESCE(character_maximum_length::text, 'max') || ')'
        WHEN data_type = 'numeric' THEN 
            'numeric(' || numeric_precision || ',' || numeric_scale || ')'
        ELSE data_type
    END AS data_type,
    is_nullable,
    column_default,
    key_type,
    CASE 
        WHEN foreign_table_name IS NOT NULL THEN 
            foreign_table_name || '.' || foreign_column_name
        ELSE ''
    END AS references
FROM table_columns
ORDER BY table_schema, table_name, ordinal_position;

-- 3. Mostrar todos los índices
SELECT 
    schemaname AS schema,
    tablename AS table_name,
    indexname AS index_name,
    indexdef AS index_definition
FROM pg_indexes
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY schemaname, tablename, indexname;

-- 4. Mostrar todas las restricciones (constraints)
SELECT
    n.nspname AS schema,
    c.relname AS table_name,
    con.conname AS constraint_name,
    pg_get_constraintdef(con.oid) AS constraint_definition,
    CASE con.contype
        WHEN 'c' THEN 'CHECK'
        WHEN 'f' THEN 'FOREIGN KEY'
        WHEN 'p' THEN 'PRIMARY KEY'
        WHEN 'u' THEN 'UNIQUE'
        WHEN 'x' THEN 'EXCLUSION'
    END AS constraint_type
FROM pg_constraint con
JOIN pg_class c ON con.conrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
ORDER BY n.nspname, c.relname, con.conname;

-- 5. Resumen de tablas con conteo de registros
DO $$
DECLARE
    r RECORD;
    v_count INTEGER;
BEGIN
    CREATE TEMP TABLE IF NOT EXISTS table_counts (
        schema_name TEXT,
        table_name TEXT,
        row_count INTEGER
    );
    
    FOR r IN 
        SELECT schemaname, tablename 
        FROM pg_tables 
        WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
    LOOP
        EXECUTE format('SELECT COUNT(*) FROM %I.%I', r.schemaname, r.tablename) INTO v_count;
        INSERT INTO table_counts VALUES (r.schemaname, r.tablename, v_count);
    END LOOP;
END $$;

SELECT * FROM table_counts ORDER BY schema_name, table_name;