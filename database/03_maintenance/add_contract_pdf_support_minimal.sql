-- ========================================
-- SOPORTE PARA PDFs - VERSIÓN MÍNIMA
-- ========================================
-- Solo ejecuta lo que tienes permisos para hacer

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

-- 3. Función helper para obtener URL del PDF
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

-- 4. Recrear la vista de contratos
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

-- 5. Comentarios descriptivos
COMMENT ON COLUMN hospital_contracts.pdf_url IS 'URL del archivo PDF del contrato en Supabase Storage';
COMMENT ON COLUMN hospital_contracts.pdf_filename IS 'Nombre original del archivo PDF subido';
COMMENT ON COLUMN hospital_contracts.pdf_uploaded_at IS 'Fecha y hora cuando se subió el PDF';

-- 6. Verificaciones
SELECT 'CONFIGURACIÓN COMPLETADA' as titulo;

SELECT 
    'Columnas PDF agregadas' as item,
    string_agg(column_name, ', ') as valor
FROM information_schema.columns 
WHERE table_name = 'hospital_contracts' 
AND column_name IN ('pdf_url', 'pdf_filename', 'pdf_uploaded_at')
GROUP BY table_name

UNION ALL

SELECT 
    'Función get_contract_end_date' as item,
    CASE WHEN COUNT(*) > 0 THEN 'Creada' ELSE 'Error' END as valor
FROM pg_proc 
WHERE proname = 'get_contract_end_date'

UNION ALL

SELECT 
    'Vista hospital_contracts_view' as item,
    CASE WHEN COUNT(*) > 0 THEN 'Creada' ELSE 'Error' END as valor
FROM information_schema.views
WHERE table_name = 'hospital_contracts_view';

-- ========================================
-- CONFIGURACIÓN MANUAL REQUERIDA:
-- ========================================
-- 
-- El bucket 'contracts' debe ser creado manualmente en el dashboard:
--
-- 1. Ve a Storage en Supabase Dashboard
-- 2. Click en "New Bucket"
-- 3. Configurar:
--    - Name: contracts
--    - Public: Desactivado (privado)
--    - File size limit: 10 MB
--    - Allowed file types: application/pdf
--
-- 4. Después de crear el bucket, configurar las políticas:
--    - Click en el bucket 'contracts'
--    - Ve a "Policies"
--    - Click en "New Policy"
--    - Selecciona "For full customization"
--    - Policy name: "Enable all for authenticated users"
--    - Target roles: authenticated
--    - WITH CHECK expression: true
--    - USING expression: true
--    - Allowed operations: SELECT, INSERT, UPDATE, DELETE
--
-- ========================================