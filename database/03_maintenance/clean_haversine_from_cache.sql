-- Script para limpiar cálculos Haversine de la tabla travel_time_cache
-- Solo mantiene tiempos reales de Google Maps

-- Primero, crear una tabla temporal con los cálculos Haversine identificados
CREATE TEMP TABLE haversine_calculations AS
WITH calculated_times AS (
  SELECT 
    origin_lat,
    origin_lng,
    destination_lat,
    destination_lng,
    travel_time_minutes,
    -- Calcular distancia Haversine
    6371 * 2 * ASIN(SQRT(
      POWER(SIN(RADIANS(destination_lat - origin_lat) / 2), 2) +
      COS(RADIANS(origin_lat)) * COS(RADIANS(destination_lat)) *
      POWER(SIN(RADIANS(destination_lng - origin_lng) / 2), 2)
    )) AS distance_km,
    -- Estimar tiempo basado en 60 km/h
    (6371 * 2 * ASIN(SQRT(
      POWER(SIN(RADIANS(destination_lat - origin_lat) / 2), 2) +
      COS(RADIANS(origin_lat)) * COS(RADIANS(destination_lat)) *
      POWER(SIN(RADIANS(destination_lng - origin_lng) / 2), 2)
    )) / 60) * 60 AS haversine_time_estimate
  FROM travel_time_cache
  WHERE travel_time_minutes IS NOT NULL
)
SELECT 
  origin_lat,
  origin_lng,
  destination_lat,
  destination_lng,
  travel_time_minutes,
  haversine_time_estimate,
  ABS(travel_time_minutes - haversine_time_estimate) / haversine_time_estimate * 100 AS diff_percent
FROM calculated_times
WHERE ABS(travel_time_minutes - haversine_time_estimate) / haversine_time_estimate * 100 <= 10;

-- Ver cuántos registros se identificaron como Haversine
SELECT COUNT(*) as haversine_count FROM haversine_calculations;

-- Ver algunos ejemplos de los registros que se eliminarán
SELECT 
  origin_lat,
  origin_lng,
  destination_lat,
  destination_lng,
  travel_time_minutes,
  haversine_time_estimate,
  diff_percent
FROM haversine_calculations
LIMIT 10;

-- Crear backup de los registros que se eliminarán (opcional)
-- CREATE TABLE travel_time_cache_haversine_backup AS 
-- SELECT * FROM travel_time_cache 
-- WHERE (origin_lat, origin_lng, destination_lat, destination_lng) IN 
--   (SELECT origin_lat, origin_lng, destination_lat, destination_lng FROM haversine_calculations);

-- IMPORTANTE: Descomentar la siguiente línea para ejecutar la eliminación
-- DELETE FROM travel_time_cache 
-- WHERE (origin_lat, origin_lng, destination_lat, destination_lng) IN 
--   (SELECT origin_lat, origin_lng, destination_lat, destination_lng FROM haversine_calculations);

-- Verificar el resultado
-- SELECT COUNT(*) as remaining_count FROM travel_time_cache WHERE travel_time_minutes IS NOT NULL;