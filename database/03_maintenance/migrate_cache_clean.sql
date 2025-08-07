-- Migración limpia de travel_time_cache a hospital_kam_distances
-- Solo migra rutas válidas que no existan ya

INSERT INTO hospital_kam_distances (hospital_id, kam_id, travel_time, distance, source)
SELECT DISTINCT
  h.id as hospital_id,
  k.id as kam_id,
  ttc.travel_time,
  ttc.distance,
  'google_maps'
FROM travel_time_cache ttc
INNER JOIN hospitals h ON 
  ROUND(h.lat::numeric, 6) = ttc.dest_lat AND 
  ROUND(h.lng::numeric, 6) = ttc.dest_lng AND
  h.active = true
INNER JOIN kams k ON 
  ROUND(k.lat::numeric, 6) = ttc.origin_lat AND 
  ROUND(k.lng::numeric, 6) = ttc.origin_lng
WHERE ttc.travel_time IS NOT NULL
  AND ttc.source = 'google_maps'
  AND NOT EXISTS (
    SELECT 1 FROM hospital_kam_distances hkd 
    WHERE hkd.hospital_id = h.id AND hkd.kam_id = k.id
  );

-- Ver resultado
SELECT COUNT(*) as nuevos_registros_migrados;