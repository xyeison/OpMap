-- Actualizar estructura de la tabla hospital_contracts
-- Para unificar los campos entre diferentes implementaciones

-- 1. Verificar estructura actual
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM 
    information_schema.columns
WHERE 
    table_schema = 'public' 
    AND table_name = 'hospital_contracts'
ORDER BY 
    ordinal_position;

-- 2. Agregar campos faltantes si no existen
-- NOTA: Ejecutar solo los ALTER TABLE necesarios según la estructura actual

-- Si no existe contract_number
-- ALTER TABLE hospital_contracts ADD COLUMN IF NOT EXISTS contract_number VARCHAR(100);

-- Si no existe contract_type
-- ALTER TABLE hospital_contracts ADD COLUMN IF NOT EXISTS contract_type VARCHAR(50) DEFAULT 'capita';

-- Si no existe end_date
-- ALTER TABLE hospital_contracts ADD COLUMN IF NOT EXISTS end_date DATE;

-- 3. Migrar datos de campos antiguos a nuevos (si aplica)
-- Si existe duration_months pero no end_date, calcular end_date
-- UPDATE hospital_contracts 
-- SET end_date = start_date + INTERVAL '1 month' * duration_months
-- WHERE end_date IS NULL AND duration_months IS NOT NULL;

-- Si existe current_provider pero no contract_number, usar como número temporal
-- UPDATE hospital_contracts 
-- SET contract_number = current_provider || '-' || EXTRACT(YEAR FROM start_date)
-- WHERE contract_number IS NULL AND current_provider IS NOT NULL;

-- 4. Verificar que todos los contratos tengan los campos necesarios
SELECT 
    COUNT(*) as total_contracts,
    COUNT(contract_number) as with_contract_number,
    COUNT(contract_type) as with_contract_type,
    COUNT(end_date) as with_end_date
FROM 
    hospital_contracts;

-- 5. Ejemplo de cómo se ve un contrato completo
SELECT 
    id,
    hospital_id,
    contract_number,
    contract_type,
    contract_value,
    start_date,
    end_date,
    active
FROM 
    hospital_contracts
LIMIT 5;