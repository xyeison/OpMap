-- =====================================================
-- Script para agregar campo de participación en asignación territorial
-- =====================================================

BEGIN;

-- 1. Agregar campo a la tabla kams
ALTER TABLE kams 
ADD COLUMN IF NOT EXISTS participates_in_assignment boolean DEFAULT true;

-- 2. Agregar comentario explicativo
COMMENT ON COLUMN kams.participates_in_assignment IS 'Indica si el KAM participa en la asignación territorial y aparece en el mapa. FALSE para KAMs administrativos o de apoyo que no tienen territorio asignado.';

-- 3. Actualizar todos los KAMs existentes para que participen por defecto
UPDATE kams 
SET participates_in_assignment = true 
WHERE participates_in_assignment IS NULL;

-- 4. Crear índice para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_kams_participates_in_assignment 
ON kams(participates_in_assignment) 
WHERE participates_in_assignment = true;

-- 5. Actualizar la vista kam_statistics para incluir solo KAMs participantes
DROP VIEW IF EXISTS kam_statistics CASCADE;

CREATE VIEW kam_statistics AS
SELECT 
    k.id,
    k.name,
    k.participates_in_assignment,
    COUNT(DISTINCT a.hospital_id) as total_hospitals,
    COUNT(DISTINCT h.municipality_id) as total_municipalities,
    COALESCE(SUM(hc.contract_value), 0) as total_opportunity_value,
    AVG(a.travel_time) as avg_travel_time
FROM kams k
LEFT JOIN assignments a ON a.kam_id = k.id
LEFT JOIN hospitals h ON h.id = a.hospital_id
LEFT JOIN hospital_contracts hc ON hc.hospital_id = h.id AND hc.active = true
WHERE k.active = true
GROUP BY k.id, k.name, k.participates_in_assignment;

-- 6. Crear vista para KAMs que SÍ participan en asignación
CREATE OR REPLACE VIEW active_territory_kams AS
SELECT * 
FROM kams 
WHERE active = true 
  AND participates_in_assignment = true;

-- 7. Crear vista para KAMs administrativos (NO participan en territorio)
CREATE OR REPLACE VIEW administrative_kams AS
SELECT * 
FROM kams 
WHERE active = true 
  AND participates_in_assignment = false;

COMMIT;

-- Mensaje de confirmación
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '✅ Campo participates_in_assignment agregado exitosamente';
    RAISE NOTICE '';
    RAISE NOTICE 'Uso del campo:';
    RAISE NOTICE '- TRUE (defecto): KAM participa en asignación territorial y aparece en el mapa';
    RAISE NOTICE '- FALSE: KAM administrativo/apoyo, NO tiene territorio, NO aparece en mapa';
    RAISE NOTICE '';
    RAISE NOTICE 'Vistas creadas:';
    RAISE NOTICE '- active_territory_kams: Solo KAMs con territorio';
    RAISE NOTICE '- administrative_kams: Solo KAMs administrativos';
    RAISE NOTICE '';
    RAISE NOTICE 'Para marcar un KAM como administrativo:';
    RAISE NOTICE 'UPDATE kams SET participates_in_assignment = false WHERE id = ''<kam_id>'';';
END;
$$;