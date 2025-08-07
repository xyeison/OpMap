-- Limpiar duplicados en hospital_kam_distances
-- Mantener solo el registro más reciente para cada par hospital-kam

-- Ver duplicados
WITH duplicates AS (
    SELECT 
        hospital_id,
        kam_id,
        COUNT(*) as count,
        MIN(id) as keep_id,
        ARRAY_AGG(id ORDER BY created_at DESC) as all_ids
    FROM hospital_kam_distances
    GROUP BY hospital_id, kam_id
    HAVING COUNT(*) > 1
)
SELECT 
    COUNT(*) as pares_duplicados,
    SUM(count - 1) as registros_a_eliminar
FROM duplicates;

-- Eliminar duplicados (mantener el más antiguo que es el primero insertado)
DELETE FROM hospital_kam_distances
WHERE id IN (
    SELECT unnest(all_ids[2:])
    FROM (
        SELECT 
            hospital_id,
            kam_id,
            ARRAY_AGG(id ORDER BY created_at) as all_ids
        FROM hospital_kam_distances
        GROUP BY hospital_id, kam_id
        HAVING COUNT(*) > 1
    ) duplicates
);

-- Verificar resultado
SELECT 
    COUNT(*) as total_registros,
    COUNT(DISTINCT (hospital_id, kam_id)) as pares_unicos
FROM hospital_kam_distances;