-- Modificar estructura para que cada KAM pertenezca a UNA zona
-- Primero eliminar la tabla de relación muchos a muchos si existe
DROP TABLE IF EXISTS zone_kams CASCADE;

-- Agregar campo zone_id a la tabla kams
ALTER TABLE kams
ADD COLUMN IF NOT EXISTS zone_id uuid REFERENCES zones(id) ON DELETE SET NULL;

-- Crear índice para mejorar performance
CREATE INDEX IF NOT EXISTS idx_kams_zone_id ON kams(zone_id);

-- Actualizar vista de estadísticas de zonas
CREATE OR REPLACE VIEW zone_statistics AS
SELECT
    z.id as zone_id,
    z.code as zone_code,
    z.name as zone_name,
    z.coordinator_name,
    z.color as zone_color,
    COUNT(DISTINCT k.id) as total_kams,
    COUNT(DISTINCT a.hospital_id) as total_hospitals,
    COUNT(DISTINCT h.municipality_id) as total_municipalities,
    COUNT(DISTINCT h.department_id) as total_departments,
    SUM(h.beds) as total_beds,
    COUNT(DISTINCT CASE WHEN h.service_level >= 3 THEN h.id END) as high_level_hospitals,
    COUNT(DISTINCT CASE WHEN h.active = true THEN h.id END) as active_hospitals,
    COALESCE(SUM(hc.contract_value), 0) as total_contract_value
FROM zones z
LEFT JOIN kams k ON z.id = k.zone_id
LEFT JOIN assignments a ON k.id = a.kam_id
LEFT JOIN hospitals h ON a.hospital_id = h.id
LEFT JOIN hospital_contracts hc ON h.id = hc.hospital_id AND hc.active = true
WHERE z.active = true
GROUP BY z.id, z.code, z.name, z.coordinator_name, z.color;

-- Actualizar vista de asignaciones territoriales por zona
CREATE OR REPLACE VIEW zone_territory_assignments AS
SELECT
    z.id as zone_id,
    z.code as zone_code,
    z.name as zone_name,
    z.color as zone_color,
    h.municipality_id as territory_id,
    h.municipality_name as territory_name,
    h.department_id,
    h.department_name,
    COUNT(DISTINCT h.id) as hospital_count,
    SUM(h.beds) as total_beds
FROM zones z
INNER JOIN kams k ON z.id = k.zone_id
INNER JOIN assignments a ON k.id = a.kam_id
INNER JOIN hospitals h ON a.hospital_id = h.id
WHERE z.active = true AND k.active = true AND h.active = true
GROUP BY
    z.id, z.code, z.name, z.color,
    h.municipality_id, h.municipality_name,
    h.department_id, h.department_name;

-- Vista para obtener KAMs con su zona
CREATE OR REPLACE VIEW kams_with_zones AS
SELECT
    k.*,
    z.id as zone_id_view,
    z.code as zone_code,
    z.name as zone_name,
    z.color as zone_color
FROM kams k
LEFT JOIN zones z ON k.zone_id = z.id;

-- Asignar zonas iniciales a los KAMs existentes basado en su ubicación
UPDATE kams SET zone_id = (SELECT id FROM zones WHERE code = 'ZONA_NORTE')
WHERE name IN ('barranquilla', 'cartagena', 'monteria', 'sincelejo', 'valledupar');

UPDATE kams SET zone_id = (SELECT id FROM zones WHERE code = 'ZONA_CENTRO')
WHERE name IN ('chapinero', 'engativa', 'sancristobal', 'kennedy', 'neiva');

UPDATE kams SET zone_id = (SELECT id FROM zones WHERE code = 'ZONA_OCCIDENTE')
WHERE name IN ('cali', 'pereira', 'medellin');

UPDATE kams SET zone_id = (SELECT id FROM zones WHERE code = 'ZONA_ORIENTE')
WHERE name IN ('bucaramanga', 'cucuta');

UPDATE kams SET zone_id = (SELECT id FROM zones WHERE code = 'ZONA_SUR')
WHERE name = 'pasto';

-- Comentario en la columna
COMMENT ON COLUMN kams.zone_id IS 'Zona comercial a la que pertenece el KAM';

-- Verificar las asignaciones
SELECT
    k.name as kam_name,
    z.code as zone_code,
    z.name as zone_name,
    z.color as zone_color
FROM kams k
LEFT JOIN zones z ON k.zone_id = z.id
ORDER BY z.name, k.name;