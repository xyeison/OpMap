-- Agregar campo link a la tabla hospital_contracts
ALTER TABLE hospital_contracts 
ADD COLUMN IF NOT EXISTS link TEXT;

-- Agregar comentario descriptivo
COMMENT ON COLUMN hospital_contracts.link IS 'Enlace externo relacionado con el contrato (documentos, portales, etc.)';

-- Verificar que el campo se agregó correctamente
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'hospital_contracts'
AND column_name = 'link';