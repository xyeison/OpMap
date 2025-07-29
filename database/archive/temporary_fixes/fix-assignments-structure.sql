-- Verificar y corregir estructura de assignments
-- Ejecutar en Supabase SQL Editor

-- 1. Verificar estructura actual de assignments
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM 
    information_schema.columns
WHERE 
    table_schema = 'public' 
    AND table_name = 'assignments'
ORDER BY 
    ordinal_position;

-- 2. Verificar constraints únicos
SELECT
    conname AS constraint_name,
    contype AS constraint_type,
    pg_get_constraintdef(oid) AS definition
FROM
    pg_constraint
WHERE
    conrelid = 'assignments'::regclass
    AND contype IN ('u', 'p');

-- 3. Si existe el constraint de hospital_id único, eliminarlo temporalmente
-- NOTA: Descomentar y ejecutar si es necesario
-- ALTER TABLE assignments DROP CONSTRAINT IF EXISTS assignments_hospital_id_key;

-- 4. Recrear el constraint correcto (cada hospital solo puede tener una asignación)
-- ALTER TABLE assignments ADD CONSTRAINT assignments_hospital_id_unique UNIQUE (hospital_id);

-- 5. Verificar si existe la columna assigned_kam_id en hospitals
SELECT 
    column_name
FROM 
    information_schema.columns
WHERE 
    table_schema = 'public' 
    AND table_name = 'hospitals'
    AND column_name = 'assigned_kam_id';

-- 6. Si no existe, crearla (NOTA: descomentar si es necesario)
-- ALTER TABLE hospitals ADD COLUMN assigned_kam_id UUID REFERENCES kams(id);

-- 7. Crear índice para mejorar performance
-- CREATE INDEX IF NOT EXISTS idx_hospitals_assigned_kam_id ON hospitals(assigned_kam_id);

-- 8. Verificar datos duplicados actuales
SELECT 
    hospital_id,
    COUNT(*) as count
FROM 
    assignments
GROUP BY 
    hospital_id
HAVING 
    COUNT(*) > 1
ORDER BY 
    count DESC;

-- 9. Si hay duplicados, eliminar dejando solo el más reciente
-- WITH duplicates AS (
--     SELECT 
--         id,
--         hospital_id,
--         ROW_NUMBER() OVER (PARTITION BY hospital_id ORDER BY created_at DESC) as rn
--     FROM 
--         assignments
-- )
-- DELETE FROM assignments
-- WHERE id IN (
--     SELECT id 
--     FROM duplicates 
--     WHERE rn > 1
-- );

-- 10. Verificar integridad después de la limpieza
SELECT 
    'Total hospitales' as metric,
    COUNT(*) as value
FROM 
    hospitals
WHERE 
    active = true
UNION ALL
SELECT 
    'Total asignaciones' as metric,
    COUNT(*) as value
FROM 
    assignments
UNION ALL
SELECT 
    'Hospitales sin asignar' as metric,
    COUNT(*) as value
FROM 
    hospitals h
WHERE 
    h.active = true
    AND NOT EXISTS (
        SELECT 1 
        FROM assignments a 
        WHERE a.hospital_id = h.id
    );