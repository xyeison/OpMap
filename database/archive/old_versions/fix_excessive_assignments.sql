-- Script para corregir asignaciones que exceden 4 horas

-- 1. Crear tabla temporal con hospitales que necesitan reasignación
CREATE TEMP TABLE hospitals_to_reassign AS
SELECT 
    a.id as assignment_id,
    a.hospital_id,
    h.code,
    h.name,
    h.municipality_id,
    h.department_id,
    h.lat,
    h.lng,
    a.travel_time as current_travel_time
FROM assignments a
JOIN hospitals h ON a.hospital_id = h.id
WHERE a.travel_time > 240;

-- Mostrar hospitales a reasignar
SELECT COUNT(*) as hospitals_exceeding_limit FROM hospitals_to_reassign;

-- 2. Buscar el KAM más cercano para cada hospital (dentro del límite de 240 min)
CREATE TEMP TABLE new_assignments AS
WITH potential_assignments AS (
    SELECT 
        htr.hospital_id,
        k.id as kam_id,
        k.name as kam_name,
        ttc.travel_time,
        ROW_NUMBER() OVER (PARTITION BY htr.hospital_id ORDER BY ttc.travel_time) as rn
    FROM hospitals_to_reassign htr
    CROSS JOIN kams k
    JOIN travel_time_cache ttc ON 
        ABS(ttc.origin_lat - k.lat) < 0.0001 AND
        ABS(ttc.origin_lng - k.lng) < 0.0001 AND
        ABS(ttc.dest_lat - htr.lat) < 0.0001 AND
        ABS(ttc.dest_lng - htr.lng) < 0.0001
    WHERE ttc.travel_time <= 240
        AND k.active = true
)
SELECT 
    hospital_id,
    kam_id,
    travel_time
FROM potential_assignments
WHERE rn = 1;

-- Mostrar nuevas asignaciones propuestas
SELECT 
    h.name as hospital_name,
    h.municipality_id,
    k.name as new_kam,
    na.travel_time as new_travel_time_minutes,
    ROUND(na.travel_time::numeric / 60, 1) as new_travel_time_hours
FROM new_assignments na
JOIN hospitals h ON na.hospital_id = h.id
JOIN kams k ON na.kam_id = k.id
ORDER BY na.travel_time DESC;

-- 3. Identificar hospitales sin cobertura (ningún KAM puede llegar en 4 horas)
CREATE TEMP TABLE uncovered_hospitals AS
SELECT 
    h.id,
    h.code,
    h.name,
    h.municipality_id,
    h.department_id,
    m.name as municipality_name,
    d.name as department_name
FROM hospitals_to_reassign htr
JOIN hospitals h ON htr.hospital_id = h.id
LEFT JOIN municipalities m ON h.municipality_id = m.code
LEFT JOIN departments d ON h.department_id = d.code
WHERE NOT EXISTS (
    SELECT 1 FROM new_assignments na 
    WHERE na.hospital_id = h.id
);

-- Mostrar hospitales sin cobertura
SELECT 
    department_name,
    COUNT(*) as uncovered_hospitals
FROM uncovered_hospitals
GROUP BY department_name
ORDER BY uncovered_hospitals DESC;

-- 4. Actualizar asignaciones (COMENTADO - descomentar para ejecutar)
/*
-- Eliminar asignaciones que exceden el límite
DELETE FROM assignments
WHERE id IN (SELECT assignment_id FROM hospitals_to_reassign);

-- Insertar nuevas asignaciones dentro del límite
INSERT INTO assignments (kam_id, hospital_id, travel_time, assignment_type)
SELECT 
    kam_id,
    hospital_id,
    travel_time,
    'competitive'
FROM new_assignments;
*/

-- 5. Mostrar resumen de cambios propuestos
SELECT 
    'Hospitales que exceden 4 horas' as metric,
    (SELECT COUNT(*) FROM hospitals_to_reassign) as count
UNION ALL
SELECT 
    'Hospitales que se pueden reasignar',
    (SELECT COUNT(*) FROM new_assignments)
UNION ALL
SELECT 
    'Hospitales sin cobertura (zonas vacantes)',
    (SELECT COUNT(*) FROM uncovered_hospitals);

-- 6. Listar hospitales sin cobertura por departamento/municipio para formar zonas vacantes
SELECT 
    department_id,
    department_name,
    municipality_id,
    municipality_name,
    COUNT(*) as hospitals_count,
    STRING_AGG(name, ', ') as hospital_names
FROM uncovered_hospitals
GROUP BY department_id, department_name, municipality_id, municipality_name
ORDER BY department_id, municipality_id;