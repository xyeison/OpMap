-- Script para corregir el constraint NOT NULL de duration_months
-- Ejecutar en Supabase SQL Editor

-- 1. Ver la definición actual de la columna duration_months
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM 
    information_schema.columns
WHERE 
    table_schema = 'public' 
    AND table_name = 'hospital_contracts'
    AND column_name = 'duration_months';

-- 2. Hacer que duration_months sea opcional (nullable)
ALTER TABLE hospital_contracts 
ALTER COLUMN duration_months DROP NOT NULL;

-- 3. Si prefieres, puedes agregar un valor por defecto
-- ALTER TABLE hospital_contracts 
-- ALTER COLUMN duration_months SET DEFAULT 12;

-- 4. También verificar si hay otras columnas que no deberían ser NOT NULL
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM 
    information_schema.columns
WHERE 
    table_schema = 'public' 
    AND table_name = 'hospital_contracts'
    AND is_nullable = 'NO'
ORDER BY 
    ordinal_position;

-- 5. Si current_provider también es NOT NULL, hacerlo opcional
ALTER TABLE hospital_contracts 
ALTER COLUMN current_provider DROP NOT NULL;

-- 6. Si description es NOT NULL, hacerlo opcional
ALTER TABLE hospital_contracts 
ALTER COLUMN description DROP NOT NULL;

-- 7. Verificar el resultado final
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM 
    information_schema.columns
WHERE 
    table_schema = 'public' 
    AND table_name = 'hospital_contracts'
ORDER BY 
    ordinal_position;