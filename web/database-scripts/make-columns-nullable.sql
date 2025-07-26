-- Script para hacer opcionales las columnas que no deberían ser obligatorias
-- Ejecutar en Supabase SQL Editor

-- 1. Ver todas las columnas NOT NULL actuales
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

-- 2. Hacer opcionales las columnas que no son críticas
ALTER TABLE hospital_contracts 
ALTER COLUMN duration_months DROP NOT NULL,
ALTER COLUMN current_provider DROP NOT NULL,
ALTER COLUMN description DROP NOT NULL;

-- 3. Verificar el resultado
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

-- 4. Las únicas columnas que deberían ser NOT NULL son:
-- - id (primary key)
-- - hospital_id (relación con hospital)
-- - contract_value (valor del contrato)
-- - start_date (fecha de inicio)
-- - active (estado del contrato)

-- 5. Verificar que solo estas columnas sean NOT NULL
SELECT 
    column_name,
    is_nullable
FROM 
    information_schema.columns
WHERE 
    table_schema = 'public' 
    AND table_name = 'hospital_contracts'
    AND is_nullable = 'NO'
    AND column_name NOT IN ('id', 'hospital_id', 'contract_value', 'start_date', 'active');