-- Script para agregar el campo de modelo de contratación a hospital_contracts
-- Puede ser: 'contratacion_directa' o 'licitacion'

-- 1. Agregar la columna contracting_model a la tabla hospital_contracts
ALTER TABLE hospital_contracts 
ADD COLUMN IF NOT EXISTS contracting_model VARCHAR(30) DEFAULT 'contratacion_directa';

-- 2. Agregar un constraint para validar solo los valores permitidos
ALTER TABLE hospital_contracts
ADD CONSTRAINT check_contracting_model 
CHECK (contracting_model IN ('contratacion_directa', 'licitacion'));

-- 3. Comentario descriptivo para la columna
COMMENT ON COLUMN hospital_contracts.contracting_model IS 'Modelo de contratación: contratacion_directa o licitacion';

-- 4. Actualizar algunos registros existentes de ejemplo (opcional)
-- UPDATE hospital_contracts 
-- SET contracting_model = 'licitacion' 
-- WHERE contract_value > 1000000000; -- Contratos mayores a 1000 millones

-- 5. Verificar que la columna se agregó correctamente
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    column_default,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'hospital_contracts' 
AND column_name = 'contracting_model';