-- =====================================================
-- Script para agregar tabla de historial de importaciones
-- =====================================================

BEGIN;

-- 1. Crear tabla de historial de importaciones
CREATE TABLE IF NOT EXISTS visit_imports (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Información del archivo
    filename varchar(255) NOT NULL,
    month integer NOT NULL CHECK (month >= 1 AND month <= 12),
    year integer NOT NULL CHECK (year >= 2020 AND year <= 2100),
    
    -- Estadísticas de la importación
    total_records integer NOT NULL DEFAULT 0,
    successful_records integer NOT NULL DEFAULT 0,
    failed_records integer NOT NULL DEFAULT 0,
    
    -- Metadatos
    imported_by uuid REFERENCES users(id),
    imported_at timestamptz DEFAULT now(),
    
    -- Para identificar único por mes/año
    UNIQUE(month, year)
);

-- 2. Crear índices
CREATE INDEX idx_visit_imports_month_year ON visit_imports(year, month);
CREATE INDEX idx_visit_imports_imported_at ON visit_imports(imported_at DESC);

-- 3. Agregar columna a visits para referenciar la importación
ALTER TABLE visits 
ADD COLUMN IF NOT EXISTS import_id uuid REFERENCES visit_imports(id);

-- 4. Crear índice en la nueva columna
CREATE INDEX IF NOT EXISTS idx_visits_import_id ON visits(import_id);

-- 5. Crear vista para ver el resumen de importaciones con estadísticas actuales
CREATE OR REPLACE VIEW visit_imports_summary AS
SELECT 
    vi.id,
    vi.filename,
    vi.month,
    vi.year,
    TO_CHAR(TO_DATE(vi.month::text || '-' || vi.year::text, 'MM-YYYY'), 'TMMonth YYYY') as month_name,
    vi.total_records as original_total,
    vi.successful_records as original_successful,
    vi.failed_records as original_failed,
    COUNT(v.id) as current_visits,
    COUNT(DISTINCT v.kam_id) as kams_count,
    vi.imported_by,
    u.full_name as imported_by_name,
    vi.imported_at
FROM visit_imports vi
LEFT JOIN visits v ON v.import_id = vi.id
LEFT JOIN users u ON u.id = vi.imported_by
GROUP BY 
    vi.id, 
    vi.filename, 
    vi.month, 
    vi.year,
    vi.total_records,
    vi.successful_records,
    vi.failed_records,
    vi.imported_by,
    vi.imported_at,
    u.full_name
ORDER BY vi.year DESC, vi.month DESC;

-- 6. Comentarios de documentación
COMMENT ON TABLE visit_imports IS 'Historial de archivos de visitas importados';
COMMENT ON COLUMN visit_imports.filename IS 'Nombre del archivo Excel importado';
COMMENT ON COLUMN visit_imports.month IS 'Mes de las visitas (1-12)';
COMMENT ON COLUMN visit_imports.year IS 'Año de las visitas';
COMMENT ON COLUMN visit_imports.total_records IS 'Total de registros en el archivo';
COMMENT ON COLUMN visit_imports.successful_records IS 'Registros importados exitosamente';
COMMENT ON COLUMN visit_imports.failed_records IS 'Registros que fallaron';
COMMENT ON COLUMN visit_imports.imported_by IS 'Usuario que realizó la importación';
COMMENT ON COLUMN visit_imports.imported_at IS 'Fecha y hora de importación';

COMMENT ON VIEW visit_imports_summary IS 'Vista resumen de importaciones con estadísticas actuales';

COMMIT;

-- Mensaje de confirmación
DO $$
BEGIN
    RAISE NOTICE 'Tabla de historial de importaciones creada exitosamente';
    RAISE NOTICE 'Ahora las importaciones se registrarán con:';
    RAISE NOTICE '- Nombre del archivo';
    RAISE NOTICE '- Mes y año de las visitas';
    RAISE NOTICE '- Estadísticas de importación';
    RAISE NOTICE '- Usuario que importó';
    RAISE NOTICE '- Posibilidad de eliminar por importación';
END;
$$;