-- =====================================================
-- TRIGGERS PARA RECÁLCULO AUTOMÁTICO
-- =====================================================
-- Detecta cambios críticos y marca cuando se necesita recálculo
-- =====================================================

-- 1. Crear tabla para marcar cuando se necesita recálculo
CREATE TABLE IF NOT EXISTS recalculation_needed (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    reason text NOT NULL,
    triggered_by text NOT NULL,
    triggered_at timestamp with time zone DEFAULT NOW(),
    processed boolean DEFAULT false,
    processed_at timestamp with time zone
);

-- 2. Función para marcar que se necesita recálculo
CREATE OR REPLACE FUNCTION mark_recalculation_needed()
RETURNS TRIGGER AS $$
DECLARE
    reason_text text;
    table_name text;
BEGIN
    table_name := TG_TABLE_NAME;
    
    -- Construir razón según la tabla y operación
    CASE table_name
        WHEN 'hospitals' THEN
            IF TG_OP = 'INSERT' THEN
                reason_text := 'Nuevo hospital creado: ' || NEW.name;
            ELSIF TG_OP = 'UPDATE' THEN
                -- Solo si cambian campos críticos
                IF OLD.active != NEW.active THEN
                    reason_text := 'Hospital ' || NEW.name || ' ' || 
                                  CASE WHEN NEW.active THEN 'activado' ELSE 'desactivado' END;
                ELSIF OLD.lat != NEW.lat OR OLD.lng != NEW.lng THEN
                    reason_text := 'Ubicación de hospital ' || NEW.name || ' modificada';
                ELSIF OLD.department_id != NEW.department_id OR 
                      OLD.municipality_id != NEW.municipality_id OR
                      COALESCE(OLD.locality_id, '') != COALESCE(NEW.locality_id, '') THEN
                    reason_text := 'Ubicación administrativa de ' || NEW.name || ' modificada';
                ELSE
                    RETURN NEW; -- No es un cambio crítico
                END IF;
            ELSIF TG_OP = 'DELETE' THEN
                reason_text := 'Hospital eliminado: ' || OLD.name;
            END IF;
            
        WHEN 'kams' THEN
            IF TG_OP = 'INSERT' THEN
                reason_text := 'Nuevo KAM creado: ' || NEW.name;
            ELSIF TG_OP = 'UPDATE' THEN
                -- Solo si cambian campos críticos
                IF OLD.active != NEW.active THEN
                    reason_text := 'KAM ' || NEW.name || ' ' || 
                                  CASE WHEN NEW.active THEN 'activado' ELSE 'desactivado' END;
                ELSIF OLD.lat != NEW.lat OR OLD.lng != NEW.lng THEN
                    reason_text := 'Ubicación de KAM ' || NEW.name || ' modificada';
                ELSIF OLD.area_id != NEW.area_id THEN
                    reason_text := 'Área base de KAM ' || NEW.name || ' modificada';
                ELSIF OLD.enable_level2 != NEW.enable_level2 THEN
                    reason_text := 'Nivel 2 de KAM ' || NEW.name || ' ' ||
                                  CASE WHEN NEW.enable_level2 THEN 'activado' ELSE 'desactivado' END;
                ELSIF OLD.max_travel_time != NEW.max_travel_time THEN
                    reason_text := 'Tiempo máximo de KAM ' || NEW.name || 
                                  ' cambiado de ' || OLD.max_travel_time || 
                                  ' a ' || NEW.max_travel_time || ' minutos';
                ELSE
                    RETURN NEW; -- No es un cambio crítico
                END IF;
            ELSIF TG_OP = 'DELETE' THEN
                reason_text := 'KAM eliminado: ' || OLD.name;
            END IF;
            
        WHEN 'department_adjacency' THEN
            IF TG_OP = 'INSERT' THEN
                reason_text := 'Nueva adyacencia departamental agregada';
            ELSIF TG_OP = 'DELETE' THEN
                reason_text := 'Adyacencia departamental eliminada';
            END IF;
            
        WHEN 'departments' THEN
            IF TG_OP = 'UPDATE' THEN
                IF OLD.excluded != NEW.excluded THEN
                    reason_text := 'Departamento ' || NEW.name || ' ' ||
                                  CASE WHEN NEW.excluded THEN 'excluido' ELSE 'incluido' END;
                ELSE
                    RETURN NEW; -- No es un cambio crítico
                END IF;
            END IF;
    END CASE;
    
    -- Insertar registro de recálculo necesario
    IF reason_text IS NOT NULL THEN
        INSERT INTO recalculation_needed (reason, triggered_by)
        VALUES (reason_text, table_name || '.' || TG_OP);
        
        -- Notificar a la aplicación (opcional - para websockets)
        PERFORM pg_notify('recalculation_needed', json_build_object(
            'reason', reason_text,
            'table', table_name,
            'operation', TG_OP,
            'timestamp', NOW()
        )::text);
    END IF;
    
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 3. Crear triggers en las tablas críticas

-- Trigger para hospitals
DROP TRIGGER IF EXISTS trg_hospital_changes ON hospitals;
CREATE TRIGGER trg_hospital_changes
AFTER INSERT OR UPDATE OR DELETE ON hospitals
FOR EACH ROW
EXECUTE FUNCTION mark_recalculation_needed();

-- Trigger para kams
DROP TRIGGER IF EXISTS trg_kam_changes ON kams;
CREATE TRIGGER trg_kam_changes
AFTER INSERT OR UPDATE OR DELETE ON kams
FOR EACH ROW
EXECUTE FUNCTION mark_recalculation_needed();

-- Trigger para department_adjacency
DROP TRIGGER IF EXISTS trg_adjacency_changes ON department_adjacency;
CREATE TRIGGER trg_adjacency_changes
AFTER INSERT OR DELETE ON department_adjacency
FOR EACH ROW
EXECUTE FUNCTION mark_recalculation_needed();

-- Trigger para departments (solo cuando cambia excluded)
DROP TRIGGER IF EXISTS trg_department_changes ON departments;
CREATE TRIGGER trg_department_changes
AFTER UPDATE ON departments
FOR EACH ROW
WHEN (OLD.excluded IS DISTINCT FROM NEW.excluded)
EXECUTE FUNCTION mark_recalculation_needed();

-- 4. Función para obtener y limpiar recálculos pendientes
CREATE OR REPLACE FUNCTION get_pending_recalculations()
RETURNS TABLE (
    id uuid,
    reason text,
    triggered_by text,
    triggered_at timestamp with time zone
) AS $$
BEGIN
    RETURN QUERY
    SELECT r.id, r.reason, r.triggered_by, r.triggered_at
    FROM recalculation_needed r
    WHERE r.processed = false
    ORDER BY r.triggered_at ASC;
END;
$$ LANGUAGE plpgsql;

-- 5. Función para marcar recálculos como procesados
CREATE OR REPLACE FUNCTION mark_recalculations_processed(
    recalc_ids uuid[]
)
RETURNS void AS $$
BEGIN
    UPDATE recalculation_needed
    SET processed = true,
        processed_at = NOW()
    WHERE id = ANY(recalc_ids);
END;
$$ LANGUAGE plpgsql;

-- 6. Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_recalculation_needed_processed 
ON recalculation_needed(processed) 
WHERE processed = false;

CREATE INDEX IF NOT EXISTS idx_recalculation_needed_triggered_at 
ON recalculation_needed(triggered_at DESC);

-- 7. Comentarios
COMMENT ON TABLE recalculation_needed IS 'Registro de cambios que requieren recálculo del algoritmo de asignación';
COMMENT ON FUNCTION mark_recalculation_needed() IS 'Detecta cambios críticos y marca cuando se necesita recálculo';
COMMENT ON FUNCTION get_pending_recalculations() IS 'Obtiene recálculos pendientes de procesar';
COMMENT ON FUNCTION mark_recalculations_processed(uuid[]) IS 'Marca recálculos como procesados';

-- Mensaje de confirmación
DO $$
BEGIN
    RAISE NOTICE '✅ Triggers de recálculo automático creados exitosamente';
    RAISE NOTICE 'Los siguientes cambios dispararán recálculo automático:';
    RAISE NOTICE '  - Crear/activar/desactivar/eliminar hospitales';
    RAISE NOTICE '  - Crear/activar/desactivar/eliminar KAMs';
    RAISE NOTICE '  - Modificar ubicación (lat/lng) de hospitales o KAMs';
    RAISE NOTICE '  - Modificar enable_level2 o max_travel_time de KAMs';
    RAISE NOTICE '  - Modificar adyacencias departamentales';
    RAISE NOTICE '  - Cambiar estado de exclusión de departamentos';
END $$;