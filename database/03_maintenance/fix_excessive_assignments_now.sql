-- Script para corregir asignaciones que exceden 4 horas y crear zonas vacantes

-- 1. Ver cuántos hospitales exceden el límite
SELECT COUNT(*) as assignments_over_4_hours
FROM assignments
WHERE travel_time > 240;

-- 2. Eliminar asignaciones que exceden 4 horas
DELETE FROM assignments
WHERE travel_time > 240;

-- 3. Intentar reasignar hospitales si hay algún KAM dentro del límite
WITH hospitals_to_reassign AS (
    SELECT DISTINCT h.*
    FROM hospitals h
    WHERE NOT EXISTS (
        SELECT 1 FROM assignments a 
        WHERE a.hospital_id = h.id
    )
    AND h.active = true
),
potential_assignments AS (
    SELECT 
        h.id as hospital_id,
        k.id as kam_id,
        ttc.travel_time,
        ROW_NUMBER() OVER (PARTITION BY h.id ORDER BY ttc.travel_time) as rn
    FROM hospitals_to_reassign h
    CROSS JOIN kams k
    JOIN travel_time_cache ttc ON 
        ABS(ttc.origin_lat - k.lat) < 0.0001 AND
        ABS(ttc.origin_lng - k.lng) < 0.0001 AND
        ABS(ttc.dest_lat - h.lat) < 0.0001 AND
        ABS(ttc.dest_lng - h.lng) < 0.0001
    WHERE ttc.travel_time <= 240
        AND k.active = true
)
INSERT INTO assignments (hospital_id, kam_id, travel_time, assignment_type)
SELECT 
    hospital_id,
    kam_id,
    travel_time,
    'competitive'
FROM potential_assignments
WHERE rn = 1;

-- 4. Ver resumen final
SELECT 
    'Total hospitales activos' as metric,
    COUNT(*) as count
FROM hospitals
WHERE active = true
UNION ALL
SELECT 
    'Hospitales asignados',
    COUNT(DISTINCT hospital_id)
FROM assignments
UNION ALL
SELECT 
    'Hospitales sin cobertura (zonas vacantes)',
    COUNT(*)
FROM hospitals h
WHERE NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
)
AND h.active = true;

-- 5. Ver zonas vacantes por departamento
SELECT 
    d.name as department_name,
    COUNT(*) as uncovered_hospitals,
    SUM(h.beds) as total_beds
FROM hospitals h
LEFT JOIN departments d ON h.department_id = d.code
WHERE NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
)
AND h.active = true
GROUP BY d.name
ORDER BY uncovered_hospitals DESC;