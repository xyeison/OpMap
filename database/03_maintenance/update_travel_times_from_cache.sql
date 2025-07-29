-- Actualizar tiempos de viaje desde el caché para todas las asignaciones
UPDATE assignments a
SET travel_time = COALESCE(
    -- Primero intentar coincidencia exacta
    (SELECT ttc.travel_time 
     FROM travel_time_cache ttc
     JOIN kams k ON a.kam_id = k.id
     JOIN hospitals h ON a.hospital_id = h.id
     WHERE ABS(ttc.origin_lat - k.lat) < 0.0001
       AND ABS(ttc.origin_lng - k.lng) < 0.0001
       AND ABS(ttc.dest_lat - h.lat) < 0.0001
       AND ABS(ttc.dest_lng - h.lng) < 0.0001
     LIMIT 1),
    -- Si no hay coincidencia y es el mismo municipio/localidad, es territorio base (0 minutos)
    CASE 
        WHEN EXISTS (
            SELECT 1 
            FROM kams k, hospitals h 
            WHERE a.kam_id = k.id 
              AND a.hospital_id = h.id
              AND (k.area_id = h.municipality_id OR k.area_id = h.locality_id)
        ) THEN 0
        ELSE a.travel_time  -- Mantener el valor actual si no se puede actualizar
    END
)
WHERE a.travel_time IS NULL;

-- Actualizar el tipo de asignación basado en el tiempo
UPDATE assignments
SET assignment_type = CASE
    WHEN travel_time = 0 OR travel_time IS NULL THEN 'base'
    ELSE 'competitive'
END;

-- Mostrar estadísticas
SELECT 
    'Total asignaciones' as metric,
    COUNT(*) as value
FROM assignments
UNION ALL
SELECT 
    'Con tiempo de viaje',
    COUNT(*)
FROM assignments
WHERE travel_time IS NOT NULL
UNION ALL
SELECT 
    'Territorio base (0 min)',
    COUNT(*)
FROM assignments
WHERE travel_time = 0
UNION ALL
SELECT 
    'Con tiempo > 0',
    COUNT(*)
FROM assignments
WHERE travel_time > 0;