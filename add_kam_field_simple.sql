-- Script simplificado para agregar campo participates_in_assignment
-- Ejecutar este script en Supabase SQL Editor

-- 1. Agregar la columna (si no existe)
ALTER TABLE kams 
ADD COLUMN IF NOT EXISTS participates_in_assignment boolean DEFAULT true;

-- 2. Asegurarse de que todos los KAMs existentes tengan valor true
UPDATE kams 
SET participates_in_assignment = true 
WHERE participates_in_assignment IS NULL;

-- 3. Mensaje de confirmación
SELECT 
    'Campo participates_in_assignment agregado exitosamente' as mensaje,
    COUNT(*) as total_kams,
    SUM(CASE WHEN participates_in_assignment = true THEN 1 ELSE 0 END) as kams_con_territorio,
    SUM(CASE WHEN participates_in_assignment = false THEN 1 ELSE 0 END) as kams_administrativos
FROM kams;