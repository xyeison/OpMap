-- Verificar cobertura actual de hospital_kam_distances

-- 1. Estado general
SELECT 
  (SELECT COUNT(*) FROM hospitals WHERE active = true) as hospitales_activos,
  (SELECT COUNT(*) FROM kams WHERE active = true) as kams_activos,
  (SELECT COUNT(*) FROM hospital_kam_distances) as distancias_calculadas,
  (SELECT COUNT(DISTINCT hospital_id) FROM hospital_kam_distances) as hospitales_con_distancias,
  (SELECT COUNT(*) FROM travel_time_cache) as cache_total;

-- 2. Hospitales SIN ninguna distancia calculada
SELECT COUNT(*) as hospitales_sin_distancias
FROM hospitals h
WHERE h.active = true
  AND NOT EXISTS (
    SELECT 1 FROM hospital_kam_distances hkd 
    WHERE hkd.hospital_id = h.id
  );

-- 3. Ver algunos ejemplos de hospitales sin distancias
SELECT h.code, h.name, h.municipality_name, h.department_id
FROM hospitals h
WHERE h.active = true
  AND NOT EXISTS (
    SELECT 1 FROM hospital_kam_distances hkd 
    WHERE hkd.hospital_id = h.id
  )
LIMIT 10;