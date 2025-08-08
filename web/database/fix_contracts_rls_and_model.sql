-- Script para arreglar RLS de hospital_contracts y agregar modelo de contratación con 3 opciones

-- 1. Primero agregar la columna si no existe
ALTER TABLE hospital_contracts 
ADD COLUMN IF NOT EXISTS contracting_model VARCHAR(30) DEFAULT 'contratacion_directa';

-- 2. Eliminar el constraint anterior si existe
ALTER TABLE hospital_contracts
DROP CONSTRAINT IF EXISTS check_contracting_model;

-- 3. Agregar nuevo constraint con las 3 opciones
ALTER TABLE hospital_contracts
ADD CONSTRAINT check_contracting_model 
CHECK (contracting_model IN ('contratacion_directa', 'licitacion', 'invitacion_privada'));

-- 4. Actualizar comentario de la columna
COMMENT ON COLUMN hospital_contracts.contracting_model IS 'Modelo de contratación: contratacion_directa, licitacion o invitacion_privada';

-- 5. Arreglar políticas RLS para hospital_contracts
-- Primero eliminar políticas existentes
DROP POLICY IF EXISTS "Users can view all contracts" ON hospital_contracts;
DROP POLICY IF EXISTS "Admin users can insert contracts" ON hospital_contracts;
DROP POLICY IF EXISTS "Admin users can update contracts" ON hospital_contracts;
DROP POLICY IF EXISTS "Admin users can delete contracts" ON hospital_contracts;
DROP POLICY IF EXISTS "Sales users can insert contracts" ON hospital_contracts;
DROP POLICY IF EXISTS "Sales users can update contracts" ON hospital_contracts;

-- 6. Crear nuevas políticas más permisivas
-- Permitir a todos los usuarios autenticados ver contratos
CREATE POLICY "Authenticated users can view contracts" 
ON hospital_contracts FOR SELECT 
TO authenticated
USING (true);

-- Permitir a usuarios autenticados insertar contratos
CREATE POLICY "Authenticated users can insert contracts" 
ON hospital_contracts FOR INSERT 
TO authenticated
WITH CHECK (true);

-- Permitir a usuarios autenticados actualizar contratos
CREATE POLICY "Authenticated users can update contracts" 
ON hospital_contracts FOR UPDATE 
TO authenticated
USING (true)
WITH CHECK (true);

-- Permitir a usuarios autenticados eliminar contratos
CREATE POLICY "Authenticated users can delete contracts" 
ON hospital_contracts FOR DELETE 
TO authenticated
USING (true);

-- 7. Asegurarse de que RLS esté habilitado
ALTER TABLE hospital_contracts ENABLE ROW LEVEL SECURITY;

-- 8. Verificar que la columna se agregó correctamente
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    column_default,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'hospital_contracts' 
AND column_name = 'contracting_model';

-- 9. Verificar las políticas RLS
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'hospital_contracts'
ORDER BY policyname;