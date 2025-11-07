-- Crear tabla de zonas
CREATE TABLE IF NOT EXISTS zones (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    code varchar(20) NOT NULL UNIQUE,
    name varchar(255) NOT NULL,
    description text,
    coordinator_name varchar(255),
    coordinator_email varchar(255),
    coordinator_phone varchar(50),
    color varchar(7), -- Color hex para visualización
    active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    created_by uuid REFERENCES users(id)
);

-- Crear índices para zones
CREATE INDEX idx_zones_code ON zones(code);
CREATE INDEX idx_zones_active ON zones(active);

-- Crear tabla de relación zona-KAM
CREATE TABLE IF NOT EXISTS zone_kams (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    zone_id uuid NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
    kam_id uuid NOT NULL REFERENCES kams(id) ON DELETE CASCADE,
    is_primary boolean DEFAULT false, -- Si es el KAM principal de la zona
    assigned_at timestamptz DEFAULT now(),
    assigned_by uuid REFERENCES users(id),
    UNIQUE(zone_id, kam_id)
);

-- Crear índices para zone_kams
CREATE INDEX idx_zone_kams_zone_id ON zone_kams(zone_id);
CREATE INDEX idx_zone_kams_kam_id ON zone_kams(kam_id);

-- Crear vista para estadísticas de zonas
CREATE OR REPLACE VIEW zone_statistics AS
SELECT
    z.id as zone_id,
    z.code as zone_code,
    z.name as zone_name,
    z.coordinator_name,
    z.color as zone_color,
    COUNT(DISTINCT zk.kam_id) as total_kams,
    COUNT(DISTINCT a.hospital_id) as total_hospitals,
    COUNT(DISTINCT h.municipality_id) as total_municipalities,
    COUNT(DISTINCT h.department_id) as total_departments,
    SUM(h.beds) as total_beds,
    COUNT(DISTINCT CASE WHEN h.service_level >= 3 THEN h.id END) as high_level_hospitals,
    COUNT(DISTINCT CASE WHEN h.active = true THEN h.id END) as active_hospitals,
    COALESCE(SUM(hc.contract_value), 0) as total_contract_value
FROM zones z
LEFT JOIN zone_kams zk ON z.id = zk.zone_id
LEFT JOIN kams k ON zk.kam_id = k.id
LEFT JOIN assignments a ON k.id = a.kam_id
LEFT JOIN hospitals h ON a.hospital_id = h.id
LEFT JOIN hospital_contracts hc ON h.id = hc.hospital_id AND hc.active = true
WHERE z.active = true
GROUP BY z.id, z.code, z.name, z.coordinator_name, z.color;

-- Crear vista para asignaciones por zona
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
INNER JOIN zone_kams zk ON z.id = zk.zone_id
INNER JOIN kams k ON zk.kam_id = k.id
INNER JOIN assignments a ON k.id = a.kam_id
INNER JOIN hospitals h ON a.hospital_id = h.id
WHERE z.active = true AND k.active = true AND h.active = true
GROUP BY
    z.id, z.code, z.name, z.color,
    h.municipality_id, h.municipality_name,
    h.department_id, h.department_name;

-- Añadir trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_zones_updated_at
BEFORE UPDATE ON zones
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Insertar datos de ejemplo para zonas
INSERT INTO zones (code, name, description, coordinator_name, color) VALUES
('ZONA_NORTE', 'Zona Norte', 'Comprende Costa Atlántica y región Caribe', 'Por Asignar', '#FF6B6B'),
('ZONA_CENTRO', 'Zona Centro', 'Comprende Bogotá, Cundinamarca y alrededores', 'Por Asignar', '#4ECDC4'),
('ZONA_OCCIDENTE', 'Zona Occidente', 'Comprende Valle del Cauca, Eje Cafetero y Pacífico', 'Por Asignar', '#45B7D1'),
('ZONA_ORIENTE', 'Zona Oriente', 'Comprende Santanderes, Norte de Santander y frontera', 'Por Asignar', '#96CEB4'),
('ZONA_SUR', 'Zona Sur', 'Comprende Nariño, Cauca y sur del país', 'Por Asignar', '#FECA57')
ON CONFLICT (code) DO NOTHING;

-- Políticas RLS para las nuevas tablas
ALTER TABLE zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE zone_kams ENABLE ROW LEVEL SECURITY;

-- Política para zones: todos pueden leer, solo admin puede modificar
CREATE POLICY zones_read_all ON zones
    FOR SELECT
    USING (true);

CREATE POLICY zones_modify_admin ON zones
    FOR ALL
    USING (auth.jwt() ->> 'role' = 'admin');

-- Política para zone_kams: todos pueden leer, solo admin puede modificar
CREATE POLICY zone_kams_read_all ON zone_kams
    FOR SELECT
    USING (true);

CREATE POLICY zone_kams_modify_admin ON zone_kams
    FOR ALL
    USING (auth.jwt() ->> 'role' = 'admin');

-- Comentarios en las tablas
COMMENT ON TABLE zones IS 'Tabla de zonas comerciales que agrupan KAMs';
COMMENT ON TABLE zone_kams IS 'Tabla de relación entre zonas y KAMs';
COMMENT ON COLUMN zones.code IS 'Código único de la zona';
COMMENT ON COLUMN zones.coordinator_name IS 'Nombre del coordinador de zona';
COMMENT ON COLUMN zone_kams.is_primary IS 'Indica si es el KAM principal de la zona';