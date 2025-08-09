-- Sistema de comentarios/mensajes para hospitales
-- Extiende la funcionalidad de hospital_history para incluir comentarios manuales

-- Agregar columna para tipo de entrada (automático o manual)
ALTER TABLE hospital_history 
ADD COLUMN IF NOT EXISTS entry_type VARCHAR(50) DEFAULT 'system';

-- entry_type puede ser: 'system' (automático), 'comment' (comentario manual), 'note' (nota), 'warning' (advertencia)
COMMENT ON COLUMN hospital_history.entry_type IS 'Tipo de entrada: system, comment, note, warning';

-- Agregar columna para categoría del comentario
ALTER TABLE hospital_history 
ADD COLUMN IF NOT EXISTS category VARCHAR(100);

-- category puede ser: 'general', 'operational', 'commercial', 'maintenance', 'alert', etc.
COMMENT ON COLUMN hospital_history.category IS 'Categoría del comentario: general, operational, commercial, maintenance, alert';

-- Agregar columna para prioridad/importancia
ALTER TABLE hospital_history 
ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'normal';

-- priority puede ser: 'low', 'normal', 'high', 'urgent'
COMMENT ON COLUMN hospital_history.priority IS 'Prioridad del mensaje: low, normal, high, urgent';

-- Hacer que la columna 'action' sea opcional para comentarios manuales
ALTER TABLE hospital_history 
ALTER COLUMN action DROP NOT NULL;

-- Actualizar entradas existentes para marcarlas como sistema
UPDATE hospital_history 
SET entry_type = 'system' 
WHERE entry_type IS NULL;

-- Crear índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_hospital_history_entry_type ON hospital_history(entry_type);
CREATE INDEX IF NOT EXISTS idx_hospital_history_category ON hospital_history(category);
CREATE INDEX IF NOT EXISTS idx_hospital_history_priority ON hospital_history(priority);
CREATE INDEX IF NOT EXISTS idx_hospital_history_hospital_created ON hospital_history(hospital_id, created_at DESC);

-- Vista para obtener solo comentarios manuales
CREATE OR REPLACE VIEW hospital_comments AS
SELECT 
    hh.id,
    hh.hospital_id,
    hh.user_id,
    hh.reason as comment,
    hh.category,
    hh.priority,
    hh.created_at,
    u.full_name as user_name,
    u.email as user_email,
    u.role as user_role
FROM hospital_history hh
LEFT JOIN users u ON hh.user_id = u.id
WHERE hh.entry_type IN ('comment', 'note', 'warning')
ORDER BY hh.created_at DESC;

-- Vista para obtener toda la actividad del hospital (sistema + comentarios)
CREATE OR REPLACE VIEW hospital_activity_log AS
SELECT 
    hh.id,
    hh.hospital_id,
    hh.user_id,
    hh.action,
    hh.reason,
    hh.entry_type,
    hh.category,
    hh.priority,
    hh.previous_state,
    hh.new_state,
    hh.created_at,
    u.full_name as user_name,
    u.email as user_email,
    u.role as user_role,
    CASE 
        WHEN hh.entry_type = 'system' THEN 'Sistema'
        WHEN hh.entry_type = 'comment' THEN 'Comentario'
        WHEN hh.entry_type = 'note' THEN 'Nota'
        WHEN hh.entry_type = 'warning' THEN 'Advertencia'
        ELSE hh.entry_type
    END as entry_type_label,
    CASE
        WHEN hh.priority = 'urgent' THEN 1
        WHEN hh.priority = 'high' THEN 2
        WHEN hh.priority = 'normal' THEN 3
        WHEN hh.priority = 'low' THEN 4
        ELSE 5
    END as priority_order
FROM hospital_history hh
LEFT JOIN users u ON hh.user_id = u.id
ORDER BY hh.created_at DESC;

-- Función para agregar un comentario
CREATE OR REPLACE FUNCTION add_hospital_comment(
    p_hospital_id UUID,
    p_user_id UUID,
    p_comment TEXT,
    p_category VARCHAR DEFAULT 'general',
    p_priority VARCHAR DEFAULT 'normal',
    p_entry_type VARCHAR DEFAULT 'comment'
)
RETURNS UUID AS $$
DECLARE
    v_comment_id UUID;
BEGIN
    INSERT INTO hospital_history (
        hospital_id,
        user_id,
        reason,
        entry_type,
        category,
        priority,
        created_at
    ) VALUES (
        p_hospital_id,
        p_user_id,
        p_comment,
        p_entry_type,
        p_category,
        p_priority,
        NOW()
    ) RETURNING id INTO v_comment_id;
    
    RETURN v_comment_id;
END;
$$ LANGUAGE plpgsql;

-- Ejemplo de uso:
-- SELECT add_hospital_comment(
--     'hospital-uuid-here'::uuid,
--     'user-uuid-here'::uuid,
--     'Este hospital fue cerrado definitivamente hace 2 meses',
--     'operational',
--     'high',
--     'warning'
-- );