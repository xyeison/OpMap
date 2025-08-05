-- ========================================
-- AGREGAR CAMPO PARA ENLACE DE DOCUMENTOS
-- ========================================

-- 1. Agregar campo documents_link a hospital_contracts
ALTER TABLE hospital_contracts 
ADD COLUMN IF NOT EXISTS documents_link TEXT;

-- 2. Agregar comentario descriptivo
COMMENT ON COLUMN hospital_contracts.documents_link IS 'Enlace a carpeta de Google Drive o Zoho Docs con documentos del contrato';

-- 3. Verificar que se agregó
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'hospital_contracts'
AND column_name = 'documents_link';

-- 4. Opcional: Eliminar columnas de PDF que ya no usaremos
-- ALTER TABLE hospital_contracts DROP COLUMN IF EXISTS pdf_url;
-- ALTER TABLE hospital_contracts DROP COLUMN IF EXISTS pdf_filename;
-- ALTER TABLE hospital_contracts DROP COLUMN IF EXISTS pdf_uploaded_at;