-- Script para migrar documentos de contratos a hospitals
-- Elimina columnas PDF de hospital_contracts y agrega URL a hospitals

-- 1. Eliminar columnas PDF de hospital_contracts (si existen)
ALTER TABLE hospital_contracts 
DROP COLUMN IF EXISTS pdf_url,
DROP COLUMN IF EXISTS pdf_filename,
DROP COLUMN IF EXISTS pdf_uploaded_at;

-- 2. Agregar columna documents_url a hospitals
ALTER TABLE hospitals
ADD COLUMN IF NOT EXISTS documents_url TEXT;

-- 3. Agregar comentario descriptivo
COMMENT ON COLUMN hospitals.documents_url IS 'URL de la carpeta en Zoho Docs o Google Drive con todos los contratos y documentos del hospital';

-- 4. Verificar que las columnas se eliminaron de hospital_contracts
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'hospital_contracts'
AND column_name IN ('pdf_url', 'pdf_filename', 'pdf_uploaded_at');

-- 5. Verificar que la columna se agregó a hospitals
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'hospitals'
AND column_name = 'documents_url';

-- 6. Ejemplo de actualización de URL para un hospital (opcional)
/*
UPDATE hospitals
SET documents_url = 'https://drive.google.com/drive/folders/ejemplo'
WHERE id = 'hospital-id-aqui';
*/

-- 7. Crear índice para búsquedas más rápidas (opcional)
CREATE INDEX IF NOT EXISTS idx_hospitals_documents_url 
ON hospitals(documents_url) 
WHERE documents_url IS NOT NULL;

-- 8. Mensaje de confirmación
SELECT 
    'Migración completada' as mensaje,
    COUNT(*) as total_hospitales,
    COUNT(documents_url) as hospitales_con_url
FROM hospitals;