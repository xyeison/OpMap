-- Buscar distancias de respaldo en travel_time_cache para hospitales que ya tienen KAM asignado
-- Esto asegura que si se desactiva su KAM, tengan alternativas

-- 1. Para cada hospital asignado, buscar tiempos a OTROS KAMs en travel_time_cache
INSERT INTO hospital_kam_distances (hospital_id, kam_id, travel_time, distance, source)
SELECT DISTINCT
  h.id as hospital_id,
  k.id as kam_id,
  ttc.travel_time,
  ttc.distance,
  'google_maps'
FROM hospitals h
INNER JOIN travel_time_cache ttc ON 
  ROUND(h.lat::numeric, 6) = ttc.dest_lat AND 
  ROUND(h.lng::numeric, 6) = ttc.dest_lng
INNER JOIN kams k ON 
  ROUND(k.lat::numeric, 6) = ttc.origin_lat AND 
  ROUND(k.lng::numeric, 6) = ttc.origin_lng
WHERE h.active = true
  AND ttc.travel_time IS NOT NULL
  AND ttc.source = 'google_maps'
  -- Solo si no existe ya en hospital_kam_distances
  AND NOT EXISTS (
    SELECT 1 FROM hospital_kam_distances hkd 
    WHERE hkd.hospital_id = h.id AND hkd.kam_id = k.id
  )
  -- Solo para hospitales que YA tienen alguna asignación (pero necesitan backups)
  AND EXISTS (
    SELECT 1 FROM assignments a 
    WHERE a.hospital_id = h.id
  );

-- Ver cuántas rutas de respaldo encontramos
SELECT 
  COUNT(*) as rutas_respaldo_agregadas;

-- 2. Ver estadística de cobertura después de esta migración
WITH coverage AS (
  SELECT 
    h.id,
    h.name,
    h.municipality_name,
    COUNT(DISTINCT hkd.kam_id) as kams_con_distancia
  FROM hospitals h
  LEFT JOIN hospital_kam_distances hkd ON h.id = hkd.hospital_id
  WHERE h.active = true
  GROUP BY h.id, h.name, h.municipality_name
)
SELECT 
  kams_con_distancia,
  COUNT(*) as hospitales
FROM coverage
GROUP BY kams_con_distancia
ORDER BY kams_con_distancia DESC;