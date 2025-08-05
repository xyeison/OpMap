-- ========================================
-- AGREGAR SOPORTE COMPLETO PARA PDFs EN CONTRATOS
-- ========================================
-- Este script incluye todas las dependencias necesarias

-- 1. Primero crear la función get_contract_end_date si no existe
CREATE OR REPLACE FUNCTION get_contract_end_date(start_date DATE, duration_months INTEGER)
RETURNS DATE AS $$
BEGIN
  RETURN start_date + INTERVAL '1 month' * duration_months;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 2. Agregar columnas para almacenar la URL del PDF
ALTER TABLE hospital_contracts 
ADD COLUMN IF NOT EXISTS pdf_url TEXT,
ADD COLUMN IF NOT EXISTS pdf_filename TEXT,
ADD COLUMN IF NOT EXISTS pdf_uploaded_at TIMESTAMP WITH TIME ZONE;

-- 3. Eliminar bucket si existe (para recrearlo correctamente)
DELETE FROM storage.buckets WHERE id = 'contracts';

-- 4. Crear bucket para archivos de contratos
INSERT INTO storage.buckets (
    id, 
    name, 
    public, 
    file_size_limit, 
    allowed_mime_types,
    avif_autodetection
)
VALUES (
    'contracts',
    'contracts', 
    false,  -- Bucket privado
    10485760, -- 10MB limit
    ARRAY['application/pdf']::text[],
    false
);

-- 5. Eliminar políticas existentes si las hay
DELETE FROM storage.policies WHERE bucket_id = 'contracts';

-- 6. Crear políticas RLS más permisivas para el bucket
-- Política para permitir INSERT
CREATE POLICY "contracts_insert_policy" 
ON storage.objects 
FOR INSERT 
TO authenticated
WITH CHECK (bucket_id = 'contracts');

-- Política para permitir SELECT
CREATE POLICY "contracts_select_policy" 
ON storage.objects 
FOR SELECT 
TO authenticated
USING (bucket_id = 'contracts');

-- Política para permitir UPDATE
CREATE POLICY "contracts_update_policy" 
ON storage.objects 
FOR UPDATE 
TO authenticated
USING (bucket_id = 'contracts');

-- Política para permitir DELETE
CREATE POLICY "contracts_delete_policy" 
ON storage.objects 
FOR DELETE 
TO authenticated
USING (bucket_id = 'contracts');

-- 7. Función helper para generar URL pública temporal (opcional)
CREATE OR REPLACE FUNCTION get_contract_pdf_url(contract_id UUID)
RETURNS TEXT AS $$
DECLARE
    pdf_path TEXT;
BEGIN
    SELECT pdf_url INTO pdf_path
    FROM hospital_contracts
    WHERE id = contract_id;
    
    IF pdf_path IS NULL THEN
        RETURN NULL;
    END IF;
    
    -- Retornar la URL del archivo
    RETURN pdf_path;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Actualizar la vista de contratos para incluir información del PDF
DROP VIEW IF EXISTS hospital_contracts_view CASCADE;

CREATE OR REPLACE VIEW hospital_contracts_view AS
SELECT 
  hc.*,
  get_contract_end_date(hc.start_date, hc.duration_months) as end_date,
  h.name as hospital_name,
  h.code as hospital_code,
  h.municipality_name,
  h.department_name,
  u.full_name as created_by_name,
  CASE 
    WHEN hc.pdf_url IS NOT NULL THEN true 
    ELSE false 
  END as has_pdf
FROM hospital_contracts hc
LEFT JOIN hospitals h ON hc.hospital_id = h.id
LEFT JOIN users u ON hc.created_by = u.id;

-- 9. Verificar que todo se creó correctamente
SELECT 'Verificación de la configuración:' as info;

-- Verificar columnas
SELECT 
    'Columnas PDF agregadas' as descripcion,
    COUNT(*) as cantidad
FROM information_schema.columns 
WHERE table_name = 'hospital_contracts' 
AND column_name IN ('pdf_url', 'pdf_filename', 'pdf_uploaded_at');

-- Verificar bucket
SELECT 
    'Bucket contracts existe' as descripcion,
    COUNT(*) as cantidad
FROM storage.buckets 
WHERE id = 'contracts';

-- Verificar políticas
SELECT 
    'Políticas RLS creadas' as descripcion,
    COUNT(*) as cantidad
FROM storage.policies 
WHERE bucket_id = 'contracts';

-- Verificar función
SELECT 
    'Función get_contract_end_date existe' as descripcion,
    COUNT(*) as cantidad
FROM pg_proc 
WHERE proname = 'get_contract_end_date';

-- 10. Comentarios descriptivos
COMMENT ON COLUMN hospital_contracts.pdf_url IS 'URL del archivo PDF del contrato en Supabase Storage';
COMMENT ON COLUMN hospital_contracts.pdf_filename IS 'Nombre original del archivo PDF subido';
COMMENT ON COLUMN hospital_contracts.pdf_uploaded_at IS 'Fecha y hora cuando se subió el PDF';

-- ========================================
-- RESULTADO ESPERADO:
-- ========================================
-- Columnas PDF agregadas: 3
-- Bucket contracts existe: 1
-- Políticas RLS creadas: 4
-- Función get_contract_end_date existe: 1