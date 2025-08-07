-- Migración completa de travel_time_cache a hospital_kam_distances
-- Esta vez asegurándonos de capturar TODOS los registros

-- Primero ver cuántos registros tenemos
SELECT COUNT(*) as total_en_cache FROM travel_time_cache;

-- Insertar TODOS los registros que podamos emparejar
INSERT INTO hospital_kam_distances (hospital_id, kam_id, travel_time, distance, source, calculated_at)
SELECT DISTINCT
  h.id as hospital_id,
  k.id as kam_id,
  ttc.travel_time,
  ttc.distance,
  COALESCE(ttc.source, 'google_maps'),
  ttc.calculated_at
FROM travel_time_cache ttc
INNER JOIN hospitals h ON 
  ROUND(h.lat::numeric, 6) = ttc.dest_lat AND 
  ROUND(h.lng::numeric, 6) = ttc.dest_lng
INNER JOIN kams k ON 
  ROUND(k.lat::numeric, 6) = ttc.origin_lat AND 
  ROUND(k.lng::numeric, 6) = ttc.origin_lng
WHERE ttc.travel_time IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM hospital_kam_distances hkd 
    WHERE hkd.hospital_id = h.id AND hkd.kam_id = k.id
  );

-- Ver cuántos registros se migraron
SELECT 
  COUNT(*) as total_registros,
  COUNT(DISTINCT hospital_id) as hospitales_unicos,
  COUNT(DISTINCT kam_id) as kams_unicos,
  MIN(travel_time/60) as min_minutos,
  MAX(travel_time/60) as max_minutos,
  AVG(travel_time/60)::integer as promedio_minutos
FROM hospital_kam_distances;

-- Verificar qué hospitales activos NO tienen ninguna distancia
SELECT h.code, h.name, h.municipality_name, h.department_name
FROM hospitals h
WHERE h.active = true
  AND NOT EXISTS (
    SELECT 1 FROM hospital_kam_distances hkd 
    WHERE hkd.hospital_id = h.id
  )
ORDER BY h.department_name, h.municipality_name;