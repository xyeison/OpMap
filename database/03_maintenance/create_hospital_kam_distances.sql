-- Crear tabla optimizada para distancias hospital-KAM
CREATE TABLE IF NOT EXISTS hospital_kam_distances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  kam_id UUID NOT NULL REFERENCES kams(id) ON DELETE CASCADE,
  travel_time INTEGER, -- segundos
  distance NUMERIC(10,2), -- km
  source VARCHAR(50) DEFAULT 'google_maps',
  calculated_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(hospital_id, kam_id)
);

-- Índices para búsquedas rápidas
CREATE INDEX idx_hospital_kam_distances_hospital ON hospital_kam_distances(hospital_id);
CREATE INDEX idx_hospital_kam_distances_kam ON hospital_kam_distances(kam_id);
CREATE INDEX idx_hospital_kam_distances_travel_time ON hospital_kam_distances(travel_time);

-- Migrar datos existentes de travel_time_cache
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
ON CONFLICT (hospital_id, kam_id) DO UPDATE
SET 
  travel_time = EXCLUDED.travel_time,
  distance = EXCLUDED.distance,
  updated_at = NOW();

-- Verificar migración
SELECT 
  COUNT(*) as total_registros,
  COUNT(DISTINCT hospital_id) as hospitales_unicos,
  COUNT(DISTINCT kam_id) as kams_unicos
FROM hospital_kam_distances;