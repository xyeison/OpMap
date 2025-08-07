-- SCRIPT COMPLETO: Migrar TODAS las rutas de respaldo desde travel_time_cache

-- 1. MIGRAR TODAS LAS RUTAS QUE FALTAN
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
  AND NOT EXISTS (
    SELECT 1 FROM hospital_kam_distances hkd 
    WHERE hkd.hospital_id = h.id AND hkd.kam_id = k.id
  );