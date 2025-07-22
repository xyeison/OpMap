-- Script completo para corregir las longitudes de los campos
-- Elimina todas las vistas, modifica las tablas y recrea las vistas

-- 1. PRIMERO: Eliminar TODAS las vistas que dependen de estas columnas
DROP VIEW IF EXISTS kam_statistics CASCADE;
DROP VIEW IF EXISTS territory_assignments CASCADE;

-- 2. SEGUNDO: Modificar las longitudes de las columnas
ALTER TABLE hospitals 
  ALTER COLUMN municipality_id TYPE VARCHAR(10),
  ALTER COLUMN locality_id TYPE VARCHAR(10);

ALTER TABLE municipalities 
  ALTER COLUMN code TYPE VARCHAR(10);

-- 3. TERCERO: Recrear las vistas con las definiciones correctas

-- Vista de estadísticas de KAM
CREATE VIEW kam_statistics AS
SELECT 
    k.id,
    k.name,
    COUNT(DISTINCT a.hospital_id) as total_hospitals,
    COUNT(DISTINCT h.municipality_id) as total_municipalities,
    SUM(o.annual_contract_value) as total_opportunity_value,
    AVG(a.travel_time) as avg_travel_time
FROM kams k
LEFT JOIN assignments a ON k.id = a.kam_id
LEFT JOIN hospitals h ON a.hospital_id = h.id
LEFT JOIN opportunities o ON h.id = o.hospital_id
WHERE k.active = true
GROUP BY k.id, k.name;

-- Vista de asignaciones territoriales
CREATE VIEW territory_assignments AS
SELECT 
    h.municipality_id,
    h.locality_id,
    h.department_id,
    k.id as kam_id,
    k.name as kam_name,
    k.color as kam_color,
    COUNT(h.id) as hospital_count
FROM hospitals h
JOIN assignments a ON h.id = a.hospital_id
JOIN kams k ON a.kam_id = k.id
WHERE h.active = true AND k.active = true
GROUP BY h.municipality_id, h.locality_id, h.department_id, k.id, k.name, k.color;