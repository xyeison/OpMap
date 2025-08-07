-- Buscar distancias a KAMs COMPETIDORES en travel_time_cache
-- Para hospitales que están en territorio base de un KAM, buscar distancias a otros KAMs

-- Ejemplo: Hospital en Cartagena debe tener distancias a:
-- - Barranquilla (departamento vecino)
-- - Montería (departamento vecino) 
-- - Sincelejo (departamento vecino)
-- NO necesita distancia a KAM Cartagena (es su territorio base)

-- Intentar match más flexible con coordenadas
INSERT INTO hospital_kam_distances (hospital_id, kam_id, travel_time, distance, source)
SELECT DISTINCT
  h.id as hospital_id,
  k.id as kam_id,
  ttc.travel_time,
  ttc.distance,
  'google_maps'
FROM hospitals h
CROSS JOIN LATERAL (
  SELECT * FROM travel_time_cache ttc
  WHERE 
    -- Match más flexible: 5 decimales en lugar de 6
    ROUND(ttc.dest_lat::numeric, 5) = ROUND(h.lat::numeric, 5)
    AND ROUND(ttc.dest_lng::numeric, 5) = ROUND(h.lng::numeric, 5)
    AND ttc.source = 'google_maps'
    AND ttc.travel_time IS NOT NULL
) ttc
INNER JOIN kams k ON 
  ROUND(k.lat::numeric, 5) = ROUND(ttc.origin_lat::numeric, 5)
  AND ROUND(k.lng::numeric, 5) = ROUND(ttc.origin_lng::numeric, 5)
WHERE h.active = true
  AND NOT EXISTS (
    SELECT 1 FROM hospital_kam_distances hkd 
    WHERE hkd.hospital_id = h.id AND hkd.kam_id = k.id
  );

-- Ver cuántas rutas nuevas encontramos
SELECT COUNT(*) as nuevas_rutas_competidores;