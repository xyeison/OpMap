-- Script completo para corregir la estructura de la tabla hospital_contracts
-- Ejecutar en Supabase SQL Editor

-- 1. Primero, verificar qué columnas existen actualmente
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

-- 2. Agregar TODAS las columnas necesarias si no existen
ALTER TABLE hospital_contracts 
ADD COLUMN IF NOT EXISTS contract_number VARCHAR(100),
ADD COLUMN IF NOT EXISTS contract_type VARCHAR(50) DEFAULT 'capita',
ADD COLUMN IF NOT EXISTS end_date DATE,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS created_by UUID;

-- 3. Si la tabla tiene columnas antiguas que ya no usamos, mantenerlas pero no las eliminamos
-- para no perder datos históricos

-- 4. Asegurar que todas las columnas básicas existan
-- Si alguna de estas columnas no existe, el script fallará y sabremos qué falta
DO $$ 
BEGIN
    -- Verificar columnas esenciales
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'hospital_contracts' 
                   AND column_name = 'hospital_id') THEN
        RAISE EXCEPTION 'La columna hospital_id no existe';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'hospital_contracts' 
                   AND column_name = 'contract_value') THEN
        RAISE EXCEPTION 'La columna contract_value no existe';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'hospital_contracts' 
                   AND column_name = 'start_date') THEN
        RAISE EXCEPTION 'La columna start_date no existe';
    END IF;
END $$;

-- 5. Migrar datos de campos antiguos a nuevos (si existen)
-- Generar contract_number para registros que no lo tengan
UPDATE hospital_contracts 
SET contract_number = CASE
    WHEN contract_number IS NOT NULL THEN contract_number
    WHEN current_provider IS NOT NULL THEN current_provider || '-' || EXTRACT(YEAR FROM COALESCE(start_date, created_at))::TEXT
    ELSE 'CONT-' || EXTRACT(YEAR FROM COALESCE(start_date, created_at, NOW()))::TEXT || '-' || id::TEXT
END
WHERE contract_number IS NULL;

-- Calcular end_date basado en duration_months si existe
UPDATE hospital_contracts 
SET end_date = CASE
    WHEN end_date IS NOT NULL THEN end_date
    WHEN duration_months IS NOT NULL AND start_date IS NOT NULL THEN start_date + INTERVAL '1 month' * duration_months
    WHEN start_date IS NOT NULL THEN start_date + INTERVAL '12 months'
    ELSE CURRENT_DATE + INTERVAL '12 months'
END
WHERE end_date IS NULL;

-- 6. Asegurar que contract_type tenga un valor válido
UPDATE hospital_contracts 
SET contract_type = 'capita'
WHERE contract_type IS NULL OR contract_type = '';

-- 7. Crear trigger para actualizar updated_at automáticamente (si no existe)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Eliminar trigger si existe y recrearlo
DROP TRIGGER IF EXISTS update_hospital_contracts_updated_at ON hospital_contracts;

CREATE TRIGGER update_hospital_contracts_updated_at 
BEFORE UPDATE ON hospital_contracts 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

-- 8. Verificar el resultado final
SELECT 
    COUNT(*) as total_contracts,
    COUNT(contract_number) as with_contract_number,
    COUNT(contract_type) as with_contract_type,
    COUNT(contract_value) as with_value,
    COUNT(start_date) as with_start_date,
    COUNT(end_date) as with_end_date,
    COUNT(CASE WHEN active IS NOT NULL THEN 1 END) as with_active_status
FROM 
    hospital_contracts;

-- 9. Mostrar algunos registros de ejemplo para verificar
SELECT 
    id,
    hospital_id,
    contract_number,
    contract_type,
    contract_value,
    start_date,
    end_date,
    active,
    created_at,
    updated_at
FROM 
    hospital_contracts
ORDER BY created_at DESC
LIMIT 5;

-- 10. Verificar que no haya registros con campos críticos nulos
SELECT 
    'Contratos sin hospital_id' as issue,
    COUNT(*) as count
FROM hospital_contracts
WHERE hospital_id IS NULL
UNION ALL
SELECT 
    'Contratos sin contract_number' as issue,
    COUNT(*) as count
FROM hospital_contracts
WHERE contract_number IS NULL
UNION ALL
SELECT 
    'Contratos sin contract_value' as issue,
    COUNT(*) as count
FROM hospital_contracts
WHERE contract_value IS NULL
UNION ALL
SELECT 
    'Contratos sin start_date' as issue,
    COUNT(*) as count
FROM hospital_contracts
WHERE start_date IS NULL
UNION ALL
SELECT 
    'Contratos sin end_date' as issue,
    COUNT(*) as count
FROM hospital_contracts
WHERE end_date IS NULL;