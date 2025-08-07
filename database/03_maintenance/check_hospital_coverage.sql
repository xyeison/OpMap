-- Verificar cobertura de hospitales (cuántos KAMs alternativos tiene cada uno)

-- 1. Resumen de cobertura
WITH coverage AS (
  SELECT 
    h.id,
    h.name,
    h.municipality_name,
    COUNT(DISTINCT hkd.kam_id) as kams_con_distancia
  FROM hospitals h
  LEFT JOIN hospital_kam_distances hkd ON h.id = hkd.hospital_id
  WHERE h.active = true
  GROUP BY h.id, h.name, h.municipality_name
)
SELECT 
  kams_con_distancia as num_kams_alternativos,
  COUNT(*) as cantidad_hospitales
FROM coverage
GROUP BY kams_con_distancia
ORDER BY kams_con_distancia DESC;

-- 2. Total de registros en hospital_kam_distances
SELECT 
  COUNT(*) as total_distancias,
  COUNT(DISTINCT hospital_id) as hospitales_unicos,
  COUNT(DISTINCT kam_id) as kams_unicos
FROM hospital_kam_distances;

-- 3. Hospitales críticos (con 0 o 1 sola distancia)
SELECT h.code, h.name, h.municipality_name, 
       COUNT(hkd.kam_id) as alternativas
FROM hospitals h
LEFT JOIN hospital_kam_distances hkd ON h.id = hkd.hospital_id
WHERE h.active = true
GROUP BY h.id, h.code, h.name, h.municipality_name
HAVING COUNT(hkd.kam_id) <= 1
ORDER BY COUNT(hkd.kam_id), h.municipality_name
LIMIT 20;