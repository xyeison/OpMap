-- Agregar columna changes si no existe
ALTER TABLE hospital_history 
ADD COLUMN IF NOT EXISTS changes JSONB;

-- Agregar comentario a la columna
COMMENT ON COLUMN hospital_history.changes IS 'Detalle de cambios realizados en formato JSON';