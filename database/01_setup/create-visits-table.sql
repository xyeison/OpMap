-- Crear tabla para almacenar visitas georeferenciadas de KAMs
-- Esta tabla permite tracking de visitas mensuales con información geográfica

-- 1. Crear tabla de visitas
CREATE TABLE IF NOT EXISTS visits (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    kam_id UUID REFERENCES kams(id) ON DELETE CASCADE,
    kam_name VARCHAR(255) NOT NULL, -- Guardamos el nombre por si el KAM se elimina
    visit_type VARCHAR(50) NOT NULL CHECK (visit_type IN ('Visita efectiva', 'Visita extra', 'Visita no efectiva')),
    contact_type VARCHAR(50) NOT NULL CHECK (contact_type IN ('Visita presencial', 'Visita virtual')),
    lat NUMERIC(10, 6) NOT NULL,
    lng NUMERIC(10, 6) NOT NULL,
    visit_date DATE NOT NULL,
    hospital_name VARCHAR(255),
    hospital_id UUID REFERENCES hospitals(id) ON DELETE SET NULL,
    observations TEXT,
    import_batch UUID NOT NULL, -- Para agrupar visitas importadas juntas
    imported_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    imported_by UUID REFERENCES users(id),
    deleted_at TIMESTAMP WITH TIME ZONE, -- Para soft delete
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Crear índices para mejorar performance
CREATE INDEX idx_visits_kam_id ON visits(kam_id);
CREATE INDEX idx_visits_visit_date ON visits(visit_date);
CREATE INDEX idx_visits_visit_type ON visits(visit_type);
CREATE INDEX idx_visits_import_batch ON visits(import_batch);
CREATE INDEX idx_visits_lat_lng ON visits(lat, lng);

-- 3. Crear tabla para historial de importaciones
CREATE TABLE IF NOT EXISTS visit_imports (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    import_batch UUID UNIQUE NOT NULL,
    filename VARCHAR(255) NOT NULL,
    month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
    year INTEGER NOT NULL CHECK (year >= 2020 AND year <= 2100),
    total_records INTEGER NOT NULL,
    successful_records INTEGER NOT NULL,
    failed_records INTEGER NOT NULL,
    error_details JSONB,
    imported_by UUID REFERENCES users(id),
    imported_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- 4. Crear función para actualizar updated_at
CREATE OR REPLACE FUNCTION update_visits_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Crear trigger para updated_at
CREATE TRIGGER trigger_update_visits_updated_at
    BEFORE UPDATE ON visits
    FOR EACH ROW
    EXECUTE FUNCTION update_visits_updated_at();

-- 6. Crear vista para estadísticas de visitas por KAM y mes
CREATE OR REPLACE VIEW visit_statistics AS
SELECT 
    k.id as kam_id,
    k.name as kam_name,
    k.color as kam_color,
    DATE_TRUNC('month', v.visit_date) as month,
    v.visit_type,
    v.contact_type,
    COUNT(*) as visit_count,
    COUNT(DISTINCT v.hospital_id) as unique_hospitals_visited,
    COUNT(CASE WHEN v.visit_type = 'Visita efectiva' THEN 1 END) as effective_visits,
    COUNT(CASE WHEN v.contact_type = 'Visita presencial' THEN 1 END) as in_person_visits,
    COUNT(CASE WHEN v.contact_type = 'Visita virtual' THEN 1 END) as virtual_visits
FROM visits v
JOIN kams k ON v.kam_id = k.id
WHERE v.deleted_at IS NULL
GROUP BY k.id, k.name, k.color, DATE_TRUNC('month', v.visit_date), v.visit_type, v.contact_type;

-- 7. La columna deleted_at ya fue agregada en la creación de la tabla

-- 8. Crear políticas RLS
ALTER TABLE visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_imports ENABLE ROW LEVEL SECURITY;

-- Política para ver visitas (todos los usuarios autenticados)
CREATE POLICY "Users can view visits" ON visits
    FOR SELECT
    USING (auth.role() IS NOT NULL);

-- Política para insertar visitas (solo data_manager y admin)
CREATE POLICY "Data managers can insert visits" ON visits
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role IN ('admin', 'data_manager')
        )
    );

-- Política para actualizar visitas (solo data_manager y admin)
CREATE POLICY "Data managers can update visits" ON visits
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role IN ('admin', 'data_manager')
        )
    );

-- Política para soft delete de visitas (solo data_manager y admin)
CREATE POLICY "Data managers can delete visits" ON visits
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role IN ('admin', 'data_manager')
        )
    );

-- Políticas para visit_imports
CREATE POLICY "Users can view import history" ON visit_imports
    FOR SELECT
    USING (auth.role() IS NOT NULL);

CREATE POLICY "Data managers can manage imports" ON visit_imports
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role IN ('admin', 'data_manager')
        )
    );

-- 9. Crear función para buscar hospital más cercano
CREATE OR REPLACE FUNCTION find_nearest_hospital(visit_lat NUMERIC, visit_lng NUMERIC, max_distance_km NUMERIC DEFAULT 5)
RETURNS UUID AS $$
DECLARE
    nearest_hospital_id UUID;
BEGIN
    SELECT id INTO nearest_hospital_id
    FROM hospitals
    WHERE active = true
    AND (
        6371 * acos(
            cos(radians(visit_lat)) * cos(radians(lat)) *
            cos(radians(lng) - radians(visit_lng)) +
            sin(radians(visit_lat)) * sin(radians(lat))
        )
    ) <= max_distance_km
    ORDER BY 
        6371 * acos(
            cos(radians(visit_lat)) * cos(radians(lat)) *
            cos(radians(lng) - radians(visit_lng)) +
            sin(radians(visit_lat)) * sin(radians(lat))
        )
    LIMIT 1;
    
    RETURN nearest_hospital_id;
END;
$$ LANGUAGE plpgsql;

-- 10. Índice para búsquedas geoespaciales eficientes
CREATE INDEX idx_hospitals_lat_lng_active ON hospitals(lat, lng) WHERE active = true;