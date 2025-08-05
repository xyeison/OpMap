-- ========================================
-- AGREGAR SOPORTE PARA PDFs EN CONTRATOS
-- ========================================

-- 1. Agregar columna para almacenar la URL del PDF
ALTER TABLE hospital_contracts 
ADD COLUMN IF NOT EXISTS pdf_url TEXT,
ADD COLUMN IF NOT EXISTS pdf_filename TEXT,
ADD COLUMN IF NOT EXISTS pdf_uploaded_at TIMESTAMP WITH TIME ZONE;

-- 2. Crear bucket para archivos de contratos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'contracts',
  'contracts', 
  false,  -- Bucket privado (requiere autenticación)
  10485760, -- 10MB limit para PDFs
  ARRAY['application/pdf']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- 3. Políticas RLS para el bucket de contratos
-- Permitir a usuarios autenticados subir archivos
CREATE POLICY "Authenticated users can upload contract PDFs" ON storage.objects
FOR INSERT 
TO authenticated
WITH CHECK (bucket_id = 'contracts');

-- Permitir a usuarios autenticados ver sus propios archivos
CREATE POLICY "Authenticated users can view contract PDFs" ON storage.objects
FOR SELECT 
TO authenticated
USING (bucket_id = 'contracts');

-- Permitir a usuarios eliminar sus propios archivos
CREATE POLICY "Users can delete their own contract PDFs" ON storage.objects
FOR DELETE 
TO authenticated
USING (
    bucket_id = 'contracts' AND 
    auth.uid()::text = (storage.foldername(name))[1]
);

-- 4. Función helper para generar URL pública temporal
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
    -- Nota: En producción, esto debería generar una URL firmada temporal
    RETURN pdf_path;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Actualizar la vista de contratos para incluir información del PDF
DROP VIEW IF EXISTS hospital_contracts_view;

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

-- 6. Verificar que todo se creó correctamente
SELECT 'Columnas agregadas:' as mensaje;
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'hospital_contracts' 
AND column_name IN ('pdf_url', 'pdf_filename', 'pdf_uploaded_at');

SELECT 'Bucket creado:' as mensaje;
SELECT * FROM storage.buckets WHERE id = 'contracts';

-- 7. Comentarios descriptivos
COMMENT ON COLUMN hospital_contracts.pdf_url IS 'URL del archivo PDF del contrato en Supabase Storage';
COMMENT ON COLUMN hospital_contracts.pdf_filename IS 'Nombre original del archivo PDF subido';
COMMENT ON COLUMN hospital_contracts.pdf_uploaded_at IS 'Fecha y hora cuando se subió el PDF';