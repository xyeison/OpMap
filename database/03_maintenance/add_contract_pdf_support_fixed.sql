-- ========================================
-- SOPORTE PARA PDFs EN CONTRATOS - VERSION CORREGIDA
-- ========================================
-- Compatible con la estructura actual de Supabase

-- 1. Crear la función get_contract_end_date si no existe
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

-- 3. Verificar si el bucket existe antes de intentar eliminarlo
DO $$ 
BEGIN
    -- Intentar eliminar el bucket si existe
    DELETE FROM storage.buckets WHERE id = 'contracts';
EXCEPTION
    WHEN OTHERS THEN
        -- Si falla, no hacer nada
        NULL;
END $$;

-- 4. Crear bucket para archivos de contratos
INSERT INTO storage.buckets (
    id, 
    name, 
    public, 
    file_size_limit, 
    allowed_mime_types
)
VALUES (
    'contracts',
    'contracts', 
    false,  -- Bucket privado
    10485760, -- 10MB limit
    ARRAY['application/pdf']::text[]
)
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['application/pdf']::text[];

-- 5. Habilitar RLS en storage.objects si no está habilitado
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 6. Eliminar políticas existentes del bucket contracts
DO $$ 
BEGIN
    -- Intentar eliminar políticas existentes
    DROP POLICY IF EXISTS "contracts_insert_policy" ON storage.objects;
    DROP POLICY IF EXISTS "contracts_select_policy" ON storage.objects;
    DROP POLICY IF EXISTS "contracts_update_policy" ON storage.objects;
    DROP POLICY IF EXISTS "contracts_delete_policy" ON storage.objects;
    DROP POLICY IF EXISTS "Authenticated users can upload contract PDFs" ON storage.objects;
    DROP POLICY IF EXISTS "Authenticated users can view contract PDFs" ON storage.objects;
    DROP POLICY IF EXISTS "Users can delete their own contract PDFs" ON storage.objects;
EXCEPTION
    WHEN OTHERS THEN
        NULL;
END $$;

-- 7. Crear políticas RLS para el bucket
-- Permitir INSERT a usuarios autenticados
CREATE POLICY "contracts_insert_policy" 
ON storage.objects 
FOR INSERT 
TO authenticated
WITH CHECK (bucket_id = 'contracts');

-- Permitir SELECT a usuarios autenticados
CREATE POLICY "contracts_select_policy" 
ON storage.objects 
FOR SELECT 
TO authenticated
USING (bucket_id = 'contracts');

-- Permitir UPDATE a usuarios autenticados
CREATE POLICY "contracts_update_policy" 
ON storage.objects 
FOR UPDATE 
TO authenticated
USING (bucket_id = 'contracts');

-- Permitir DELETE a usuarios autenticados
CREATE POLICY "contracts_delete_policy" 
ON storage.objects 
FOR DELETE 
TO authenticated
USING (bucket_id = 'contracts');

-- 8. Función helper para obtener URL del PDF
CREATE OR REPLACE FUNCTION get_contract_pdf_url(contract_id UUID)
RETURNS TEXT AS $$
DECLARE
    pdf_path TEXT;
BEGIN
    SELECT pdf_url INTO pdf_path
    FROM hospital_contracts
    WHERE id = contract_id;
    
    RETURN pdf_path;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Recrear la vista de contratos
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

-- 10. Verificaciones finales
SELECT 'VERIFICACIÓN DE CONFIGURACIÓN' as titulo;

-- Verificar columnas
SELECT 
    'Columnas PDF en hospital_contracts' as verificacion,
    string_agg(column_name, ', ') as resultado
FROM information_schema.columns 
WHERE table_name = 'hospital_contracts' 
AND column_name IN ('pdf_url', 'pdf_filename', 'pdf_uploaded_at')
GROUP BY table_name;

-- Verificar bucket
SELECT 
    'Bucket contracts' as verificacion,
    CASE WHEN COUNT(*) > 0 THEN 'Creado exitosamente' ELSE 'No existe' END as resultado
FROM storage.buckets 
WHERE id = 'contracts';

-- Verificar políticas RLS
SELECT 
    'Políticas RLS para contracts' as verificacion,
    COUNT(*)::text || ' políticas creadas' as resultado
FROM pg_policies 
WHERE tablename = 'objects' 
AND schemaname = 'storage'
AND policyname LIKE 'contracts_%';

-- Verificar función
SELECT 
    'Función get_contract_end_date' as verificacion,
    CASE WHEN COUNT(*) > 0 THEN 'Existe' ELSE 'No existe' END as resultado
FROM pg_proc 
WHERE proname = 'get_contract_end_date';

-- 11. Comentarios descriptivos
COMMENT ON COLUMN hospital_contracts.pdf_url IS 'URL del archivo PDF del contrato en Supabase Storage';
COMMENT ON COLUMN hospital_contracts.pdf_filename IS 'Nombre original del archivo PDF subido';
COMMENT ON COLUMN hospital_contracts.pdf_uploaded_at IS 'Fecha y hora cuando se subió el PDF';

-- ========================================
-- NOTA IMPORTANTE:
-- ========================================
-- Si aún hay errores, verifica en el dashboard de Supabase:
-- 1. Storage > Crear nuevo bucket manualmente:
--    - Name: contracts
--    - Public: Desactivado
--    - File size limit: 10MB
--    - Allowed MIME types: application/pdf
-- 2. En las políticas del bucket, permitir todas las operaciones
--    para usuarios autenticados