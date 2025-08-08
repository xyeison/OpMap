-- Script para arreglar la secuencia de IDs en hospital_contracts

-- 1. Verificar si la tabla usa UUID o SERIAL
SELECT 
    column_name,
    data_type,
    column_default
FROM information_schema.columns
WHERE table_name = 'hospital_contracts' 
AND column_name = 'id';

-- 2. Si la tabla usa UUID (lo más probable en Supabase), asegurarse de que tenga el default correcto
ALTER TABLE hospital_contracts 
ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- 3. Si por alguna razón usa SERIAL/BIGSERIAL, crear la secuencia
-- (Normalmente Supabase usa UUID, pero por si acaso)
-- CREATE SEQUENCE IF NOT EXISTS hospital_contracts_id_seq;
-- ALTER TABLE hospital_contracts ALTER COLUMN id SET DEFAULT nextval('hospital_contracts_id_seq');
-- ALTER SEQUENCE hospital_contracts_id_seq OWNED BY hospital_contracts.id;

-- 4. Verificar que la columna created_at tenga default
ALTER TABLE hospital_contracts 
ALTER COLUMN created_at SET DEFAULT now();

-- 5. Verificar la estructura completa de la tabla
SELECT 
    column_name,
    data_type,
    column_default,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'hospital_contracts'
ORDER BY ordinal_position;

-- 6. Agregar la columna contracting_model si no existe
ALTER TABLE hospital_contracts 
ADD COLUMN IF NOT EXISTS contracting_model VARCHAR(30) DEFAULT 'contratacion_directa';

-- 7. Eliminar constraint anterior si existe
ALTER TABLE hospital_contracts
DROP CONSTRAINT IF EXISTS check_contracting_model;

-- 8. Agregar nuevo constraint con las 3 opciones
ALTER TABLE hospital_contracts
ADD CONSTRAINT check_contracting_model 
CHECK (contracting_model IN ('contratacion_directa', 'licitacion', 'invitacion_privada'));

-- 9. IMPORTANTE: Desactivar RLS temporalmente para testing
ALTER TABLE hospital_contracts DISABLE ROW LEVEL SECURITY;

-- 10. Test de inserción directa (ajusta el hospital_id a uno válido)
/*
INSERT INTO hospital_contracts (
    hospital_id,
    contract_number,
    contract_type,
    contracting_model,
    contract_value,
    start_date,
    end_date,
    duration_months,
    active,
    current_provider
) VALUES (
    (SELECT id FROM hospitals WHERE active = true LIMIT 1),
    'TEST-CONTRACT-001',
    'capita',
    'contratacion_directa',
    1000000,
    '2024-01-01',
    '2024-12-31',
    12,
    true,
    'Proveedor Test'
) RETURNING *;
*/

-- Si el test funciona, elimina el registro de prueba:
-- DELETE FROM hospital_contracts WHERE contract_number = 'TEST-CONTRACT-001';

-- 11. Si todo funciona bien y quieres volver a habilitar RLS con políticas permisivas:
/*
ALTER TABLE hospital_contracts ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas existentes
DROP POLICY IF EXISTS "Allow all for authenticated" ON hospital_contracts;

-- Crear política super permisiva
CREATE POLICY "Allow all for authenticated" 
ON hospital_contracts 
FOR ALL 
TO authenticated
USING (true)
WITH CHECK (true);
*/