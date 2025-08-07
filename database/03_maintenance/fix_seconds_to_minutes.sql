-- Convertir tiempos de segundos a minutos
-- Solo para registros que claramente están en segundos (> 1440)

-- Primero, verificar cuántos registros necesitan conversión
SELECT COUNT(*) as total,
       COUNT(CASE WHEN travel_time > 1440 THEN 1 END) as needs_conversion,
       MIN(travel_time) as min_time,
       MAX(travel_time) as max_time,
       AVG(travel_time) as avg_time
FROM hospital_kam_distances;

-- Hacer backup antes de actualizar
CREATE TABLE IF NOT EXISTS hospital_kam_distances_backup AS
SELECT * FROM hospital_kam_distances;

-- Actualizar tiempos que están claramente en segundos (> 1440 minutos = 24 horas)
UPDATE hospital_kam_distances
SET travel_time = ROUND(travel_time / 60)
WHERE travel_time > 1440;

-- Verificar resultados
SELECT COUNT(*) as updated_records
FROM hospital_kam_distances
WHERE travel_time <= 1440;

-- Verificar casos específicos
SELECT h.code, h.name, k.name as kam_name, hkd.travel_time
FROM hospital_kam_distances hkd
JOIN hospitals h ON h.id = hkd.hospital_id
JOIN kams k ON k.id = hkd.kam_id
WHERE h.code IN ('900958564-2', '890701718-1')
ORDER BY h.code, hkd.travel_time;