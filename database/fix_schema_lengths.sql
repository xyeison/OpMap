-- Script para corregir las longitudes de los campos en las tablas
-- Ejecutar ANTES de la migración de datos

-- Aumentar la longitud de los campos de código para soportar localidades de Bogotá
ALTER TABLE hospitals 
  ALTER COLUMN municipality_id TYPE VARCHAR(10),
  ALTER COLUMN locality_id TYPE VARCHAR(10);

ALTER TABLE municipalities 
  ALTER COLUMN code TYPE VARCHAR(10);

-- También actualizar las vistas que dependen de estos campos
DROP VIEW IF EXISTS territory_assignments;

-- Recrear la vista con los tipos correctos
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