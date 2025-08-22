-- =====================================================
-- Script de limpieza de tablas de visitas
-- Elimina tablas y vistas relacionadas con visitas
-- que no se utilizarán en el sistema simplificado
-- =====================================================

-- IMPORTANTE: Este script ELIMINARÁ permanentemente las siguientes tablas/vistas
-- Ejecutar con precaución y solo después de respaldar los datos si es necesario

BEGIN;

-- 1. Eliminar vistas dependientes primero
DROP VIEW IF EXISTS visit_statistics CASCADE;

-- 2. Eliminar tablas de visitas
DROP TABLE IF EXISTS visit_imports CASCADE;
DROP TABLE IF EXISTS visits CASCADE;

-- 3. Recrear solo la tabla visits simplificada
CREATE TABLE IF NOT EXISTS visits (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Datos del representante (KAM)
    kam_id uuid REFERENCES kams(id),
    kam_name varchar(255) NOT NULL,
    
    -- Datos de la visita
    visit_type varchar(50) NOT NULL CHECK (visit_type IN (
        'Visita efectiva', 
        'Visita extra', 
        'Visita no efectiva'
    )),
    contact_type varchar(50) NOT NULL CHECK (contact_type IN (
        'Visita presencial', 
        'Visita virtual'
    )),
    
    -- Ubicación
    lat numeric(10, 6) NOT NULL,
    lng numeric(10, 6) NOT NULL,
    
    -- Fecha
    visit_date date NOT NULL,
    
    -- Hospital asociado (calculado automáticamente por proximidad)
    hospital_id uuid REFERENCES hospitals(id),
    
    -- Metadatos
    imported_by uuid REFERENCES users(id),
    imported_at timestamptz DEFAULT now(),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 4. Crear índices para optimizar consultas
CREATE INDEX idx_visits_kam_id ON visits(kam_id);
CREATE INDEX idx_visits_visit_date ON visits(visit_date);
CREATE INDEX idx_visits_hospital_id ON visits(hospital_id);
CREATE INDEX idx_visits_location ON visits(lat, lng);
CREATE INDEX idx_visits_type ON visits(visit_type, contact_type);

-- 5. Crear función para encontrar hospital más cercano (si no existe)
CREATE OR REPLACE FUNCTION find_nearest_hospital(
    visit_lat numeric,
    visit_lng numeric,
    max_distance_km numeric DEFAULT 5
)
RETURNS uuid AS $$
DECLARE
    nearest_hospital_id uuid;
BEGIN
    SELECT id INTO nearest_hospital_id
    FROM hospitals
    WHERE active = true
    ORDER BY 
        -- Fórmula Haversine simplificada para distancia
        acos(
            sin(radians(lat)) * sin(radians(visit_lat)) +
            cos(radians(lat)) * cos(radians(visit_lat)) * 
            cos(radians(lng - visit_lng))
        ) * 6371 -- Radio de la Tierra en km
    LIMIT 1;
    
    RETURN nearest_hospital_id;
END;
$$ LANGUAGE plpgsql;

-- 6. Crear vista simple para estadísticas de visitas
CREATE OR REPLACE VIEW visit_summary AS
SELECT 
    v.kam_id,
    v.kam_name,
    v.visit_type,
    v.contact_type,
    DATE_TRUNC('month', v.visit_date) as month,
    COUNT(*) as visit_count,
    COUNT(DISTINCT v.hospital_id) as hospitals_visited,
    COUNT(CASE WHEN v.contact_type = 'Visita presencial' THEN 1 END) as presencial_count,
    COUNT(CASE WHEN v.contact_type = 'Visita virtual' THEN 1 END) as virtual_count,
    COUNT(CASE WHEN v.visit_type = 'Visita efectiva' THEN 1 END) as efectiva_count
FROM visits v
GROUP BY 
    v.kam_id,
    v.kam_name,
    v.visit_type,
    v.contact_type,
    DATE_TRUNC('month', v.visit_date);

-- 7. Comentarios de documentación
COMMENT ON TABLE visits IS 'Registro simplificado de visitas de KAMs';
COMMENT ON COLUMN visits.kam_id IS 'ID del KAM que realizó la visita';
COMMENT ON COLUMN visits.kam_name IS 'Nombre del KAM (redundante para reportes rápidos)';
COMMENT ON COLUMN visits.visit_type IS 'Tipo de visita: efectiva, extra o no efectiva';
COMMENT ON COLUMN visits.contact_type IS 'Modalidad: presencial o virtual';
COMMENT ON COLUMN visits.lat IS 'Latitud de la ubicación de la visita';
COMMENT ON COLUMN visits.lng IS 'Longitud de la ubicación de la visita';
COMMENT ON COLUMN visits.visit_date IS 'Fecha en que se realizó la visita';
COMMENT ON COLUMN visits.hospital_id IS 'Hospital más cercano (calculado automáticamente)';

COMMIT;

-- Mensaje de confirmación
DO $$
BEGIN
    RAISE NOTICE 'Limpieza de tablas de visitas completada exitosamente';
    RAISE NOTICE 'Se ha creado una estructura simplificada con los siguientes campos del Excel:';
    RAISE NOTICE '- Representante (kam_id, kam_name)';
    RAISE NOTICE '- Tipo de visitas (visit_type)';
    RAISE NOTICE '- Tipo de contacto (contact_type)';
    RAISE NOTICE '- Ubicación (lat, lng)';
    RAISE NOTICE '';
    RAISE NOTICE 'Campos generados automáticamente:';
    RAISE NOTICE '- Fecha de la visita (visit_date) - del mes/año seleccionado en la UI';
    RAISE NOTICE '- Hospital asociado (hospital_id) - calculado por proximidad';
END;
$$;