-- Análisis detallado de hospitales sin distancias

-- 1. ¿Cuántos hospitales están en ciudades con KAM local?
WITH hospitals_in_kam_cities AS (
  SELECT h.*, k.name as kam_local
  FROM hospitals h
  INNER JOIN kams k ON 
    -- Hospital en el mismo municipio que el KAM
    h.municipality_id = k.area_id
    OR h.municipality_id = SUBSTRING(k.area_id, 1, 5)
  WHERE h.active = true
)
SELECT 
  'Hospitales en ciudades con KAM local' as categoria,
  COUNT(*) as total
FROM hospitals_in_kam_cities
UNION ALL
SELECT 
  'De estos, SIN distancias en hospital_kam_distances',
  COUNT(*)
FROM hospitals_in_kam_cities h
WHERE NOT EXISTS (
  SELECT 1 FROM hospital_kam_distances hkd 
  WHERE hkd.hospital_id = h.id
);

-- 2. Verificar si estos hospitales existen en travel_time_cache
SELECT 
  h.code,
  h.name,
  h.municipality_name,
  h.lat,
  h.lng,
  EXISTS (
    SELECT 1 FROM travel_time_cache ttc 
    WHERE ttc.dest_lat = h.lat AND ttc.dest_lng = h.lng
  ) as existe_en_cache
FROM hospitals h
WHERE h.active = true
  AND h.code IN (
    '806015201-2',  -- Cartagena
    '900753224-1',  -- Cali
    '900959048-1',  -- Bogotá
    '892115010-1',  -- San Juan del Cesar
    '900464965-1'   -- Cali
  );

-- 3. ¿Cuántos registros hay en travel_time_cache para KAMs de estas ciudades?
SELECT 
  k.name,
  k.area_id,
  COUNT(ttc.*) as rutas_en_cache
FROM kams k
LEFT JOIN travel_time_cache ttc ON 
  ttc.origin_lat = k.lat AND ttc.origin_lng = k.lng
WHERE k.name IN ('KAM Cartagena', 'KAM Cali', 'KAM Sincelejo', 'KAM Pasto')
GROUP BY k.name, k.area_id
ORDER BY k.name;