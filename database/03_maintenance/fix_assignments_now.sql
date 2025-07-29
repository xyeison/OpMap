-- PASO 1: Ver hospitales específicos que exceden 4 horas
SELECT 
    k.name as kam_name,
    h.name as hospital_name,
    h.municipality_id,
    m.name as municipality_name,
    d.name as department_name,
    a.travel_time as minutes,
    ROUND(a.travel_time::numeric / 60, 1) as hours
FROM assignments a
JOIN kams k ON a.kam_id = k.id
JOIN hospitals h ON a.hospital_id = h.id
LEFT JOIN municipalities m ON h.municipality_id = m.code
LEFT JOIN departments d ON h.department_id = d.code
WHERE a.travel_time > 240
ORDER BY a.travel_time DESC
LIMIT 20;

-- PASO 2: Eliminar TODAS las asignaciones que exceden 4 horas
DELETE FROM assignments
WHERE travel_time > 240;

-- PASO 3: Intentar reasignar solo si hay un KAM dentro del límite
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

-- PASO 4: Ver hospitales que quedaron sin asignar (ZONAS VACANTES)
SELECT 
    h.code,
    h.name as hospital_name,
    h.municipality_id,
    m.name as municipality_name,
    d.name as department_name,
    h.beds,
    h.lat,
    h.lng
FROM hospitals h
LEFT JOIN municipalities m ON h.municipality_id = m.code
LEFT JOIN departments d ON h.department_id = d.code
WHERE NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
)
AND h.active = true
ORDER BY h.department_id, h.municipality_id;

-- PASO 5: Resumen final
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
AND h.active = true
UNION ALL
SELECT 
    'Hospitales con tiempo > 3 horas',
    COUNT(*)
FROM assignments
WHERE travel_time > 180;

-- PASO 6: Agrupar zonas vacantes por departamento
SELECT 
    d.name as department_name,
    COUNT(*) as uncovered_hospitals,
    SUM(h.beds) as total_beds,
    STRING_AGG(m.name, ', ' ORDER BY m.name) as municipalities
FROM hospitals h
LEFT JOIN municipalities m ON h.municipality_id = m.code
LEFT JOIN departments d ON h.department_id = d.code
WHERE NOT EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
)
AND h.active = true
GROUP BY d.name
ORDER BY uncovered_hospitals DESC;