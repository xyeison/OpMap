-- Verificar que la columna zone_id existe en la tabla kams
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'kams'
AND column_name = 'zone_id';

-- Verificar las restricciones de clave foránea
SELECT
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.table_name = 'kams'
    AND kcu.column_name = 'zone_id';

-- Ver cuántos KAMs tienen zonas asignadas
SELECT
    COUNT(*) as total_kams,
    COUNT(zone_id) as kams_with_zone,
    COUNT(*) - COUNT(zone_id) as kams_without_zone
FROM kams
WHERE active = true;

-- Listar KAMs con sus zonas
SELECT
    k.id,
    k.name as kam_name,
    k.area_id,
    z.name as zone_name,
    z.code as zone_code,
    z.coordinator_name
FROM kams k
LEFT JOIN zones z ON k.zone_id = z.id
WHERE k.active = true
ORDER BY z.name, k.name;