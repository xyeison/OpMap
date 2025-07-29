-- Script para insertar tiempos estimados para hospitales sin asignar
-- Esto permitirá que el director vea cuántas horas están los KAMs de estos hospitales

-- Primero, veamos algunos ejemplos de hospitales lejanos
WITH unassigned_hospitals AS (
  SELECT h.*
  FROM hospitals h
  WHERE h.active = true
    AND NOT EXISTS (
      SELECT 1 FROM assignments a 
      WHERE a.hospital_id = h.id
    )
),
sample_times AS (
  -- Insertar algunos tiempos de ejemplo basados en las estimaciones del script
  VALUES
    -- Hospital en Leticia (extremadamente lejos)
    ('KAM Neiva', 2.932486149243003, -75.28494502446691, 'Hospital San Rafael Leticia', -4.2153, -69.9408, 2231), -- 37h 11min
    ('KAM Pasto', 1.222545892365123, -77.28277453386823, 'Hospital San Rafael Leticia', -4.2153, -69.9408, 2283), -- 38h 3min
    
    -- Hospital en San Andrés (isla)
    ('KAM Cartagena', 10.420495819286762, -75.53385812286801, 'Hospital San Andrés', 12.5847, -81.7006, 1607), -- 26h 47min
    ('KAM Montería', 8.751549528798737, -75.88373388085706, 'Hospital San Andrés', 12.5847, -81.7006, 1722), -- 28h 42min
    
    -- Hospital en Mitú
    ('KAM San Cristóbal', 4.570360700521882, -74.0884026481501, 'Hospital Mitú', 1.2547, -70.2347, 1270), -- 21h 10min
    ('KAM Chapinero', 4.633794896229732, -74.06733995774036, 'Hospital Mitú', 1.2547, -70.2347, 1276), -- 21h 16min
    
    -- Hospitales en Arauca
    ('KAM Cúcuta', 7.89752044391865, -72.5062011718628, 'Hospital Arauca', 7.0847, -70.7591, 481), -- 8h 1min
    ('KAM Bucaramanga', 7.126714307270854, -73.11446761061566, 'Hospital Arauca', 7.0847, -70.7591, 587), -- 9h 47min
    
    -- Hospitales en Putumayo
    ('KAM Pasto', 1.222545892365123, -77.28277453386823, 'Hospital Puerto Asís', 0.5117, -76.4967, 214), -- 3h 34min
    ('KAM Neiva', 2.932486149243003, -75.28494502446691, 'Hospital Puerto Asís', 0.5117, -76.4967, 681), -- 11h 21min
    
    -- Hospitales en Quibdó
    ('KAM Medellín', 6.262431895656156, -75.56404755453853, 'Hospital Quibdó', 5.6947, -76.6611, 307), -- 5h 7min
    ('KAM Pereira', 4.817888136171111, -75.69976105300874, 'Hospital Quibdó', 5.6947, -76.6611, 324), -- 5h 24min
    
    -- Hospitales en Tumaco
    ('KAM Pasto', 1.222545892365123, -77.28277453386823, 'Hospital Tumaco', 1.7999, -78.8018, 398), -- 6h 38min
    ('KAM Cali', 3.452424382685351, -76.4931246763714, 'Hospital Tumaco', 1.7999, -78.8018, 701) -- 11h 41min
)
SELECT 
  kam_name,
  origin_lat,
  origin_lng,
  hospital_name,
  dest_lat,
  dest_lng,
  travel_time_min,
  ROUND(travel_time_min::numeric / 60, 1) as hours
FROM sample_times
ORDER BY travel_time_min DESC;

-- Nota: Para un sistema completo, necesitaríamos:
-- 1. Acceso a Google Maps API para tiempos reales
-- 2. O ejecutar el algoritmo OpMap sin límite de 4 horas para obtener todos los tiempos
-- 3. Por ahora, los tiempos mostrados son estimaciones basadas en distancia euclidiana