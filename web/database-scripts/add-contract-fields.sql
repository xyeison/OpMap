-- Script para agregar campos faltantes a la tabla hospital_contracts
-- Ejecutar en Supabase SQL Editor

-- 1. Agregar columnas nuevas si no existen
ALTER TABLE hospital_contracts 
ADD COLUMN IF NOT EXISTS contract_number VARCHAR(100),
ADD COLUMN IF NOT EXISTS contract_type VARCHAR(50) DEFAULT 'capita',
ADD COLUMN IF NOT EXISTS end_date DATE,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 2. Migrar datos existentes (si hay campos antiguos)
-- Si tienes contratos con duration_months, calcular end_date
UPDATE hospital_contracts 
SET end_date = start_date + INTERVAL '1 month' * duration_months
WHERE end_date IS NULL 
  AND duration_months IS NOT NULL 
  AND start_date IS NOT NULL;

-- Si tienes contratos con current_provider, usarlo como contract_number temporal
UPDATE hospital_contracts 
SET contract_number = COALESCE(
    contract_number, 
    current_provider || '-' || EXTRACT(YEAR FROM start_date)::TEXT
)
WHERE contract_number IS NULL 
  AND current_provider IS NOT NULL;

-- 3. Para contratos sin contract_number, generar uno automático
UPDATE hospital_contracts 
SET contract_number = 'CONT-' || EXTRACT(YEAR FROM COALESCE(start_date, created_at))::TEXT || '-' || id::TEXT
WHERE contract_number IS NULL;

-- 4. Para contratos sin end_date, asumir 12 meses desde start_date
UPDATE hospital_contracts 
SET end_date = start_date + INTERVAL '12 months'
WHERE end_date IS NULL 
  AND start_date IS NOT NULL;

-- 5. Verificar resultados
SELECT 
    COUNT(*) as total_contracts,
    COUNT(contract_number) as with_contract_number,
    COUNT(contract_type) as with_contract_type,
    COUNT(end_date) as with_end_date,
    COUNT(CASE WHEN contract_number IS NOT NULL AND contract_type IS NOT NULL AND end_date IS NOT NULL THEN 1 END) as complete_contracts
FROM 
    hospital_contracts;

-- 6. Ver algunos ejemplos de contratos actualizados
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
ORDER BY created_at DESC
LIMIT 10;