-- Tabla para asignaciones forzadas de territorios a KAMs
CREATE TABLE IF NOT EXISTS forced_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  territory_id VARCHAR(10) NOT NULL, -- Código del municipio (5 dígitos) o localidad (7 dígitos)
  territory_type VARCHAR(20) NOT NULL CHECK (territory_type IN ('municipality', 'locality')),
  territory_name VARCHAR(100) NOT NULL,
  kam_id UUID NOT NULL REFERENCES kams(id) ON DELETE CASCADE,
  reason TEXT, -- Razón de la asignación forzada
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  active BOOLEAN DEFAULT true
);

-- Crear índice único parcial para evitar duplicados de territorio activo
CREATE UNIQUE INDEX idx_forced_assignments_unique_active 
ON forced_assignments(territory_id) 
WHERE active = true;

-- Índices para mejorar rendimiento
CREATE INDEX idx_forced_assignments_territory ON forced_assignments(territory_id);
CREATE INDEX idx_forced_assignments_kam ON forced_assignments(kam_id);
CREATE INDEX idx_forced_assignments_active ON forced_assignments(active);

-- Vista para estadísticas de territorios
CREATE OR REPLACE VIEW territory_statistics AS
WITH territory_data AS (
  SELECT 
    COALESCE(h.locality_id, h.municipality_id) as territory_id,
    CASE 
      WHEN h.locality_id IS NOT NULL THEN 'locality'
      ELSE 'municipality'
    END as territory_type,
    COALESCE(h.locality_name, h.municipality_name) as territory_name,
    COUNT(DISTINCT h.id) as hospital_count,
    SUM(COALESCE(h.beds, 0)) as total_beds,
    COUNT(DISTINCT CASE WHEN h.service_level >= 3 THEN h.id END) as high_level_hospitals,
    SUM(CASE WHEN h.active THEN 1 ELSE 0 END) as active_hospitals
  FROM hospitals h
  WHERE h.active = true
  GROUP BY 
    COALESCE(h.locality_id, h.municipality_id),
    CASE WHEN h.locality_id IS NOT NULL THEN 'locality' ELSE 'municipality' END,
    COALESCE(h.locality_name, h.municipality_name)
),
forced_data AS (
  SELECT 
    fa.territory_id,
    fa.territory_type,
    fa.territory_name,
    fa.kam_id,
    k.name as kam_name,
    k.color as kam_color,
    fa.reason,
    fa.created_at as forced_at
  FROM forced_assignments fa
  JOIN kams k ON k.id = fa.kam_id
  WHERE fa.active = true
)
SELECT 
  td.*,
  fd.kam_id as forced_kam_id,
  fd.kam_name as forced_kam_name,
  fd.kam_color as forced_kam_color,
  fd.reason as forced_reason,
  fd.forced_at,
  CASE WHEN fd.kam_id IS NOT NULL THEN true ELSE false END as is_forced
FROM territory_data td
LEFT JOIN forced_data fd ON td.territory_id = fd.territory_id;

-- Función para obtener estadísticas de un territorio específico
CREATE OR REPLACE FUNCTION get_territory_stats(p_territory_id VARCHAR)
RETURNS TABLE (
  territory_id VARCHAR,
  territory_type VARCHAR,
  territory_name VARCHAR,
  hospital_count INTEGER,
  total_beds INTEGER,
  high_level_hospitals INTEGER,
  active_hospitals INTEGER,
  is_forced BOOLEAN,
  forced_kam_name VARCHAR,
  forced_reason TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ts.territory_id::VARCHAR,
    ts.territory_type::VARCHAR,
    ts.territory_name::VARCHAR,
    ts.hospital_count::INTEGER,
    ts.total_beds::INTEGER,
    ts.high_level_hospitals::INTEGER,
    ts.active_hospitals::INTEGER,
    ts.is_forced,
    ts.forced_kam_name::VARCHAR,
    ts.forced_reason
  FROM territory_statistics ts
  WHERE ts.territory_id = p_territory_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_forced_assignments_updated_at 
BEFORE UPDATE ON forced_assignments 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

-- Comentarios para documentación
COMMENT ON TABLE forced_assignments IS 'Asignaciones forzadas de territorios (municipios o localidades) a KAMs específicos';
COMMENT ON COLUMN forced_assignments.territory_id IS 'Código DANE del municipio (5 dígitos) o localidad (7 dígitos)';
COMMENT ON COLUMN forced_assignments.territory_type IS 'Tipo de territorio: municipality o locality';
COMMENT ON COLUMN forced_assignments.reason IS 'Razón o justificación de la asignación forzada';
COMMENT ON VIEW territory_statistics IS 'Vista con estadísticas de hospitales y camas por territorio, incluyendo asignaciones forzadas';

-- Permisos para el rol anon (si es necesario)
GRANT SELECT ON forced_assignments TO anon;
GRANT SELECT ON territory_statistics TO anon;
GRANT INSERT, UPDATE ON forced_assignments TO anon;