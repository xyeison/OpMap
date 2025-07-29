-- Agregar columna created_by a hospital_history si no existe
DO $$
BEGIN
    -- Verificar si la columna created_by no existe
    IF NOT EXISTS (SELECT FROM information_schema.columns 
                  WHERE table_schema = 'public' 
                  AND table_name = 'hospital_history' 
                  AND column_name = 'created_by') THEN
        -- Agregar la columna
        ALTER TABLE hospital_history 
        ADD COLUMN created_by UUID REFERENCES users(id);
    END IF;
END $$;

-- Agregar comentario a la columna
COMMENT ON COLUMN hospital_history.created_by IS 'Usuario que realizó la acción';

-- Verificar todas las columnas necesarias
-- Esta consulta te mostrará todas las columnas de la tabla
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'hospital_history'
ORDER BY ordinal_position;