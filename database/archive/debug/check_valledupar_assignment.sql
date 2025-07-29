-- Investigar la asignación de Valledupar al hospital 900008328-2

-- 1. Ver los detalles de esta asignación específica
SELECT 
    a.id,
    a.assignment_type,
    a.travel_time,
    k.name as kam_name,
    k.area_id as kam_area,
    k.lat as kam_lat,
    k.lng as kam_lng,
    h.code as hospital_code,
    h.name as hospital_name,
    h.municipality_id as hospital_municipality,
    h.department_id as hospital_department,
    h.lat as hospital_lat,
    h.lng as hospital_lng
FROM assignments a
JOIN kams k ON k.id = a.kam_id
JOIN hospitals h ON h.id = a.hospital_id
WHERE k.name LIKE '%Valledupar%'
  AND h.code = '900008328-2';

-- 2. Verificar si es territorio base (mismo municipio)
SELECT 
    k.name as kam_name,
    k.area_id as kam_municipality,
    h.name as hospital_name,
    h.municipality_id as hospital_municipality,
    CASE 
        WHEN k.area_id = h.municipality_id THEN 'SI - ES TERRITORIO BASE'
        ELSE 'NO - MUNICIPIOS DIFERENTES'
    END as mismo_municipio
FROM kams k, hospitals h
WHERE k.name LIKE '%Valledupar%'
  AND h.code = '900008328-2';

-- 3. Buscar en el caché de tiempos
SELECT 
    ttc.*,
    'Encontrado en cache' as estado
FROM travel_time_cache ttc
WHERE EXISTS (
    SELECT 1 
    FROM kams k, hospitals h
    WHERE k.name LIKE '%Valledupar%'
      AND h.code = '900008328-2'
      AND ABS(ttc.origin_lat - k.lat) < 0.001
      AND ABS(ttc.origin_lng - k.lng) < 0.001
      AND ABS(ttc.dest_lat - h.lat) < 0.001
      AND ABS(ttc.dest_lng - h.lng) < 0.001
);

-- 4. Calcular distancia Haversine para verificar
SELECT 
    k.name as kam_name,
    h.name as hospital_name,
    ROUND(
        CAST(2 * 6371 * ASIN(SQRT(
            POWER(SIN(RADIANS((h.lat - k.lat) / 2)), 2) +
            COS(RADIANS(k.lat)) * COS(RADIANS(h.lat)) *
            POWER(SIN(RADIANS((h.lng - k.lng) / 2)), 2)
        )) AS numeric)
    , 2) as distancia_km,
    ROUND(
        CAST((2 * 6371 * ASIN(SQRT(
            POWER(SIN(RADIANS((h.lat - k.lat) / 2)), 2) +
            COS(RADIANS(k.lat)) * COS(RADIANS(h.lat)) *
            POWER(SIN(RADIANS((h.lng - k.lng) / 2)), 2)
        ))) / 60 * 60 AS numeric)
    ) as tiempo_estimado_minutos
FROM kams k, hospitals h
WHERE k.name LIKE '%Valledupar%'
  AND h.code = '900008328-2';

-- 5. Ver todos los hospitales asignados a Valledupar
SELECT 
    h.code,
    h.name,
    h.municipality_id,
    h.department_id,
    a.assignment_type,
    a.travel_time,
    CASE 
        WHEN a.travel_time = 0 THEN 'Territorio Base o Error'
        WHEN a.travel_time < 30 THEN 'Muy Cerca'
        WHEN a.travel_time < 120 THEN 'Distancia Media'
        ELSE 'Lejos'
    END as categoria
FROM assignments a
JOIN kams k ON k.id = a.kam_id
JOIN hospitals h ON h.id = a.hospital_id
WHERE k.name LIKE '%Valledupar%'
ORDER BY a.travel_time;