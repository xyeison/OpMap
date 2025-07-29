-- Script para actualizar los tiempos de viaje en las asignaciones
-- usando los datos del travel_time_cache

-- Actualizar tiempos de viaje para asignaciones automáticas
UPDATE assignments a
SET travel_time = (
    SELECT ttc.travel_time
    FROM travel_time_cache ttc
    JOIN kams k ON k.id = a.kam_id
    JOIN hospitals h ON h.id = a.hospital_id
    WHERE 
        ttc.origin_lat = k.lat 
        AND ttc.origin_lng = k.lng
        AND ttc.dest_lat = h.lat
        AND ttc.dest_lng = h.lng
        AND ttc.source = 'google_maps'
    LIMIT 1
)
WHERE a.assignment_type = 'automatic'
  AND a.travel_time IS NULL
  AND EXISTS (
    SELECT 1
    FROM travel_time_cache ttc
    JOIN kams k ON k.id = a.kam_id
    JOIN hospitals h ON h.id = a.hospital_id
    WHERE 
        ttc.origin_lat = k.lat 
        AND ttc.origin_lng = k.lng
        AND ttc.dest_lat = h.lat
        AND ttc.dest_lng = h.lng
        AND ttc.source = 'google_maps'
);

-- Para territory_base (mismo municipio), el tiempo es 0
UPDATE assignments
SET travel_time = 0
WHERE assignment_type = 'territory_base'
  AND travel_time IS NULL;

-- Verificar cuántas asignaciones se actualizaron
SELECT 
    assignment_type,
    COUNT(*) as total,
    COUNT(travel_time) as con_tiempo,
    COUNT(*) - COUNT(travel_time) as sin_tiempo
FROM assignments
GROUP BY assignment_type;

-- Ver estadísticas de tiempos
SELECT 
    k.name as kam_name,
    COUNT(a.id) as total_hospitales,
    AVG(a.travel_time) as tiempo_promedio,
    MIN(a.travel_time) as tiempo_minimo,
    MAX(a.travel_time) as tiempo_maximo
FROM assignments a
JOIN kams k ON k.id = a.kam_id
WHERE a.travel_time IS NOT NULL
GROUP BY k.name
ORDER BY COUNT(a.id) DESC;