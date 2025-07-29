-- Verificar asignaciones que exceden 4 horas (240 minutos)
SELECT 
    k.name as kam_name,
    k.area_id as kam_base,
    h.name as hospital_name,
    h.code as hospital_code,
    h.municipality_id,
    m.name as municipality_name,
    a.travel_time as minutes,
    ROUND(a.travel_time::numeric / 60, 1) as hours,
    a.assignment_type
FROM assignments a
JOIN kams k ON a.kam_id = k.id
JOIN hospitals h ON a.hospital_id = h.id
LEFT JOIN municipalities m ON h.municipality_id = m.code
WHERE a.travel_time > 240
ORDER BY a.travel_time DESC;

-- Contar cuántas asignaciones exceden el límite
SELECT 
    'Total asignaciones' as metric,
    COUNT(*) as count
FROM assignments
UNION ALL
SELECT 
    'Exceden 4 horas (240 min)',
    COUNT(*)
FROM assignments
WHERE travel_time > 240
UNION ALL
SELECT 
    'Entre 3-4 horas (180-240 min)',
    COUNT(*)
FROM assignments
WHERE travel_time BETWEEN 180 AND 240
UNION ALL
SELECT 
    'Entre 2-3 horas (120-180 min)',
    COUNT(*)
FROM assignments
WHERE travel_time BETWEEN 120 AND 180;

-- Ver distribución por KAM
SELECT 
    k.name as kam_name,
    COUNT(*) as total_hospitals,
    COUNT(CASE WHEN a.travel_time > 240 THEN 1 END) as exceeds_limit,
    MAX(a.travel_time) as max_travel_time_minutes,
    ROUND(MAX(a.travel_time)::numeric / 60, 1) as max_travel_time_hours
FROM assignments a
JOIN kams k ON a.kam_id = k.id
GROUP BY k.name
HAVING MAX(a.travel_time) > 240
ORDER BY max_travel_time_minutes DESC;