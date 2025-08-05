-- ========================================
-- SOPORTE PARA PDFs - VERSIÓN FINAL CORREGIDA
-- ========================================

-- 1. Crear la función get_contract_end_date si no existe
CREATE OR REPLACE FUNCTION get_contract_end_date(start_date DATE, duration_months INTEGER)
RETURNS DATE AS $$
BEGIN
  IF duration_months IS NULL OR duration_months = 0 THEN
    RETURN NULL;
  END IF;
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

-- 4. Recrear la vista de contratos (sin duplicar end_date)
DROP VIEW IF EXISTS hospital_contracts_view CASCADE;

CREATE OR REPLACE VIEW hospital_contracts_view AS
SELECT 
  hc.id,
  hc.hospital_id,
  hc.contract_number,
  hc.contract_type,
  hc.contract_value,
  hc.start_date,
  hc.end_date,  -- Usar la columna física end_date que ya existe
  hc.duration_months,
  hc.current_provider,
  hc.description,
  hc.active,
  hc.created_by,
  hc.created_at,
  hc.updated_at,
  hc.pdf_url,
  hc.pdf_filename,
  hc.pdf_uploaded_at,
  -- Columna calculada para end_date basada en duration_months (si no hay end_date física)
  COALESCE(
    hc.end_date, 
    get_contract_end_date(hc.start_date, hc.duration_months)
  ) as calculated_end_date,
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
SELECT 'VERIFICACIÓN DE CONFIGURACIÓN' as titulo;

SELECT 
    'Columnas PDF agregadas' as verificacion,
    string_agg(column_name, ', ') as resultado
FROM information_schema.columns 
WHERE table_name = 'hospital_contracts' 
AND column_name IN ('pdf_url', 'pdf_filename', 'pdf_uploaded_at')
GROUP BY table_name

UNION ALL

SELECT 
    'Columna end_date existe' as verificacion,
    CASE WHEN COUNT(*) > 0 THEN 'Sí' ELSE 'No' END as resultado
FROM information_schema.columns 
WHERE table_name = 'hospital_contracts' 
AND column_name = 'end_date'

UNION ALL

SELECT 
    'Función get_contract_end_date' as verificacion,
    CASE WHEN COUNT(*) > 0 THEN 'Creada' ELSE 'No existe' END as resultado
FROM pg_proc 
WHERE proname = 'get_contract_end_date'

UNION ALL

SELECT 
    'Vista hospital_contracts_view' as verificacion,
    CASE WHEN COUNT(*) > 0 THEN 'Creada' ELSE 'No existe' END as resultado
FROM information_schema.views
WHERE table_name = 'hospital_contracts_view';

-- ========================================
-- IMPORTANTE - CONFIGURACIÓN MANUAL DEL BUCKET:
-- ========================================
-- 
-- 1. Ve a tu proyecto en https://app.supabase.com
-- 2. Ve a Storage → New Bucket
-- 3. Configurar:
--    - Bucket name: contracts
--    - Public: Desactivado
--    - File size limit: 10
--    - Allowed MIME types: application/pdf
-- 4. Crear el bucket
-- 5. En Policies del bucket, agregar política:
--    - Name: Allow authenticated users
--    - Target roles: authenticated
--    - WITH CHECK: true
--    - USING: true
--    - Operations: Todas
-- ========================================