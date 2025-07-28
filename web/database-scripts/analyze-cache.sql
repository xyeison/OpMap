-- Análisis del caché de tiempos de viaje

-- 1. Total de entradas en caché
SELECT 
  COUNT(*) as total_cache_entries,
  COUNT(DISTINCT CONCAT(origin_lat, ',', origin_lng)) as unique_origins,
  COUNT(DISTINCT CONCAT(dest_lat, ',', dest_lng)) as unique_destinations
FROM travel_time_cache;

-- 2. Distribución por fuente
SELECT 
  source,
  COUNT(*) as count,
  AVG(travel_time/60) as avg_minutes,
  MIN(travel_time/60) as min_minutes,
  MAX(travel_time/60) as max_minutes
FROM travel_time_cache
GROUP BY source;

-- 3. Entradas más recientes
SELECT 
  created_at,
  source,
  travel_time/60 as minutes,
  distance/1000 as km
FROM travel_time_cache
ORDER BY created_at DESC
LIMIT 10;

-- 4. KAMs y hospitales actuales para referencia
SELECT 
  (SELECT COUNT(*) FROM kams WHERE active = true) as active_kams,
  (SELECT COUNT(*) FROM hospitals WHERE active = true) as active_hospitals,
  (SELECT COUNT(*) FROM assignments) as total_assignments;

-- 5. Verificar si hay duplicados en el caché
SELECT 
  origin_lat, 
  origin_lng, 
  dest_lat, 
  dest_lng,
  COUNT(*) as duplicates
FROM travel_time_cache
GROUP BY origin_lat, origin_lng, dest_lat, dest_lng
HAVING COUNT(*) > 1
LIMIT 10;