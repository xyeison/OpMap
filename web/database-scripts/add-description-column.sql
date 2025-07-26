-- Script para agregar columna description a hospital_contracts
-- Ejecutar en Supabase SQL Editor

-- 1. Verificar si la columna ya existe
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
    AND column_name = 'description';

-- 2. Si no existe, agregar la columna description
ALTER TABLE hospital_contracts 
ADD COLUMN IF NOT EXISTS description TEXT;

-- 3. Verificar que se agregó correctamente
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