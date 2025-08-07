-- VERIFICACIÓN COMPLETA DEL ESTADO DE hospital_kam_distances

-- 1. Resumen general
SELECT 
  'Total hospitales activos' as metrica,
  COUNT(*) as cantidad
FROM hospitals WHERE active = true
UNION ALL
SELECT 
  'Total KAMs activos',
  COUNT(*) 
FROM kams WHERE active = true
UNION ALL
SELECT 
  'Total distancias en hospital_kam_distances',
  COUNT(*) 
FROM hospital_kam_distances
UNION ALL
SELECT 
  'Total distancias en travel_time_cache',
  COUNT(*) 
FROM travel_time_cache WHERE source = 'google_maps'
UNION ALL
SELECT 
  'Hospitales CON distancias',
  COUNT(DISTINCT hospital_id) 
FROM hospital_kam_distances
UNION ALL
SELECT 
  'Hospitales SIN distancias',
  COUNT(*) 
FROM hospitals h 
WHERE h.active = true 
  AND NOT EXISTS (SELECT 1 FROM hospital_kam_distances hkd WHERE hkd.hospital_id = h.id);

-- 2. Distribución de cobertura
SELECT 
  'Distribución de KAMs por hospital:' as info;
  
WITH coverage AS (
  SELECT 
    COUNT(DISTINCT hkd.kam_id) as num_kams,
    COUNT(*) as hospitales
  FROM hospitals h
  LEFT JOIN hospital_kam_distances hkd ON h.id = hkd.hospital_id
  WHERE h.active = true
  GROUP BY h.id
)
SELECT 
  num_kams as kams_con_ruta,
  COUNT(*) as cantidad_hospitales
FROM coverage
GROUP BY num_kams
ORDER BY num_kams DESC;

-- 3. ¿Por qué no se migraron más rutas?
SELECT 
  'Rutas en cache sin match de hospital:' as razon,
  COUNT(*) as cantidad
FROM travel_time_cache ttc
WHERE source = 'google_maps'
  AND NOT EXISTS (
    SELECT 1 FROM hospitals h 
    WHERE ROUND(h.lat::numeric, 6) = ttc.dest_lat 
      AND ROUND(h.lng::numeric, 6) = ttc.dest_lng
      AND h.active = true
  )
UNION ALL
SELECT 
  'Rutas en cache sin match de KAM:',
  COUNT(*)
FROM travel_time_cache ttc
WHERE source = 'google_maps'
  AND NOT EXISTS (
    SELECT 1 FROM kams k 
    WHERE ROUND(k.lat::numeric, 6) = ttc.origin_lat 
      AND ROUND(k.lng::numeric, 6) = ttc.origin_lng
  );

-- 4. Hospitales críticos sin cobertura
SELECT 
  'Hospitales sin ninguna distancia (primeros 10):' as titulo;
  
SELECT h.code, h.name, h.municipality_name, h.department_id
FROM hospitals h
WHERE h.active = true
  AND NOT EXISTS (
    SELECT 1 FROM hospital_kam_distances hkd 
    WHERE hkd.hospital_id = h.id
  )
LIMIT 10;