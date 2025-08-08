-- Script para migrar documentos y arreglar la vista que depende de las columnas PDF

-- 1. Primero eliminar la vista que depende de las columnas
DROP VIEW IF EXISTS hospital_contracts_view CASCADE;

-- 2. Ahora sí eliminar las columnas PDF de hospital_contracts
ALTER TABLE hospital_contracts 
DROP COLUMN IF EXISTS pdf_url CASCADE,
DROP COLUMN IF EXISTS pdf_filename CASCADE,
DROP COLUMN IF EXISTS pdf_uploaded_at CASCADE;

-- 3. Recrear la vista sin las columnas PDF
CREATE OR REPLACE VIEW hospital_contracts_view AS
SELECT 
    hc.id,
    hc.hospital_id,
    hc.contract_number,
    hc.contract_type,
    hc.contracting_model,
    hc.contract_value,
    hc.start_date,
    hc.end_date,
    hc.duration_months,
    hc.current_provider,
    hc.provider,
    hc.description,
    hc.active,
    hc.created_by,
    hc.created_at,
    hc.updated_at,
    h.name as hospital_name,
    h.code as hospital_code,
    h.municipality_name,
    h.department_name,
    h.documents_url as hospital_documents_url  -- Ahora la URL viene del hospital
FROM hospital_contracts hc
LEFT JOIN hospitals h ON h.id = hc.hospital_id;

-- 4. Agregar columna documents_url a hospitals si no existe
ALTER TABLE hospitals
ADD COLUMN IF NOT EXISTS documents_url TEXT;

-- 5. Agregar comentario descriptivo
COMMENT ON COLUMN hospitals.documents_url IS 'URL de la carpeta en Zoho Docs o Google Drive con todos los contratos y documentos del hospital';

-- 6. Verificar que las columnas se eliminaron de hospital_contracts
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'hospital_contracts'
AND column_name IN ('pdf_url', 'pdf_filename', 'pdf_uploaded_at');

-- 7. Verificar que la columna se agregó a hospitals
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'hospitals'
AND column_name = 'documents_url';

-- 8. Verificar que la vista se recreó correctamente
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'hospital_contracts_view'
ORDER BY ordinal_position;

-- 9. Crear índice para búsquedas más rápidas (opcional)
CREATE INDEX IF NOT EXISTS idx_hospitals_documents_url 
ON hospitals(documents_url) 
WHERE documents_url IS NOT NULL;

-- 10. Mensaje de confirmación
SELECT 
    'Migración completada' as mensaje,
    COUNT(*) as total_hospitales,
    COUNT(documents_url) as hospitales_con_url
FROM hospitals;