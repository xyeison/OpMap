-- Script de diagnóstico para entender por qué faltan tiempos de viaje

-- 1. Ver cuántas asignaciones hay por tipo
SELECT 
    assignment_type,
    COUNT(*) as total,
    COUNT(travel_time) as con_tiempo,
    COUNT(*) - COUNT(travel_time) as sin_tiempo
FROM assignments
GROUP BY assignment_type;

-- 2. Ver ejemplos de asignaciones sin tiempo
SELECT 
    a.id,
    k.name as kam_name,
    h.name as hospital_name,
    k.lat as kam_lat,
    k.lng as kam_lng,
    h.lat as hospital_lat,
    h.lng as hospital_lng,
    a.assignment_type
FROM assignments a
JOIN kams k ON k.id = a.kam_id
JOIN hospitals h ON h.id = a.hospital_id
WHERE a.travel_time IS NULL
LIMIT 10;

-- 3. Verificar si existen en el caché (con tolerancia de decimales)
WITH missing_times AS (
    SELECT 
        a.id as assignment_id,
        k.name as kam_name,
        h.name as hospital_name,
        k.lat as kam_lat,
        k.lng as kam_lng,
        h.lat as hospital_lat,
        h.lng as hospital_lng,
        a.assignment_type
    FROM assignments a
    JOIN kams k ON k.id = a.kam_id
    JOIN hospitals h ON h.id = a.hospital_id
    WHERE a.travel_time IS NULL
    LIMIT 5
)
SELECT 
    mt.*,
    ttc.travel_time as cached_time,
    ABS(ttc.origin_lat - mt.kam_lat) as lat_diff,
    ABS(ttc.origin_lng - mt.kam_lng) as lng_diff,
    ABS(ttc.dest_lat - mt.hospital_lat) as dest_lat_diff,
    ABS(ttc.dest_lng - mt.hospital_lng) as dest_lng_diff
FROM missing_times mt
LEFT JOIN travel_time_cache ttc ON 
    ABS(ttc.origin_lat - mt.kam_lat) < 0.0001
    AND ABS(ttc.origin_lng - mt.kam_lng) < 0.0001
    AND ABS(ttc.dest_lat - mt.hospital_lat) < 0.0001
    AND ABS(ttc.dest_lng - mt.hospital_lng) < 0.0001;

-- 4. Actualizar con tolerancia de coordenadas
UPDATE assignments a
SET travel_time = (
    SELECT ttc.travel_time
    FROM travel_time_cache ttc
    JOIN kams k ON k.id = a.kam_id
    JOIN hospitals h ON h.id = a.hospital_id
    WHERE 
        ABS(ttc.origin_lat - k.lat) < 0.0001
        AND ABS(ttc.origin_lng - k.lng) < 0.0001
        AND ABS(ttc.dest_lat - h.lat) < 0.0001
        AND ABS(ttc.dest_lng - h.lng) < 0.0001
        AND ttc.source = 'google_maps'
    LIMIT 1
)
WHERE a.assignment_type = 'automatic'
  AND a.travel_time IS NULL;

-- 5. Para territory_base, poner 0
UPDATE assignments
SET travel_time = 0
WHERE assignment_type = 'territory_base'
  AND travel_time IS NULL;

-- 6. Ver resultado final
SELECT 
    assignment_type,
    COUNT(*) as total,
    COUNT(travel_time) as con_tiempo,
    COUNT(*) - COUNT(travel_time) as sin_tiempo,
    ROUND(100.0 * COUNT(travel_time) / COUNT(*), 1) as porcentaje_con_tiempo
FROM assignments
GROUP BY assignment_type;

-- 7. Para las que aún faltan, calcular con Haversine
-- (esto es un respaldo para las que no están en caché)
UPDATE assignments a
SET travel_time = (
    SELECT ROUND(
        (2 * 6371 * ASIN(SQRT(
            POWER(SIN(RADIANS((h.lat - k.lat) / 2)), 2) +
            COS(RADIANS(k.lat)) * COS(RADIANS(h.lat)) *
            POWER(SIN(RADIANS((h.lng - k.lng) / 2)), 2)
        ))) / 60 * 60  -- Convertir km a minutos (asumiendo 60 km/h)
    )
    FROM kams k, hospitals h
    WHERE k.id = a.kam_id AND h.id = a.hospital_id
)
WHERE a.travel_time IS NULL
  AND a.assignment_type = 'automatic';

-- 8. Resultado final después de todos los updates
SELECT 
    'RESULTADO FINAL' as estado,
    COUNT(*) as total_asignaciones,
    COUNT(travel_time) as con_tiempo,
    COUNT(*) - COUNT(travel_time) as sin_tiempo,
    ROUND(AVG(travel_time), 1) as tiempo_promedio_minutos
FROM assignments;