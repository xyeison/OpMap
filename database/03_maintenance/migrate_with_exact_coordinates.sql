-- Migrar usando las coordenadas EXACTAS sin redondear

INSERT INTO hospital_kam_distances (hospital_id, kam_id, travel_time, distance, source)
SELECT DISTINCT
  h.id as hospital_id,
  k.id as kam_id,
  ttc.travel_time,
  ttc.distance,
  'google_maps'
FROM hospitals h
INNER JOIN travel_time_cache ttc ON 
  ttc.dest_lat = h.lat  -- Sin redondear
  AND ttc.dest_lng = h.lng  -- Sin redondear
INNER JOIN kams k ON 
  ttc.origin_lat = k.lat  -- Sin redondear
  AND ttc.origin_lng = k.lng  -- Sin redondear
WHERE h.active = true
  AND ttc.travel_time IS NOT NULL
  AND ttc.source = 'google_maps'
  AND NOT EXISTS (
    SELECT 1 FROM hospital_kam_distances hkd 
    WHERE hkd.hospital_id = h.id AND hkd.kam_id = k.id
  );

-- Ver cuántas rutas se migraron
SELECT COUNT(*) as rutas_migradas_exactas;