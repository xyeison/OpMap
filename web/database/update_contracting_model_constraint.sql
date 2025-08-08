-- Script para actualizar el constraint y agregar la opción 'invitacion_privada'

-- 1. Eliminar el constraint existente
ALTER TABLE hospital_contracts
DROP CONSTRAINT IF EXISTS check_contracting_model;

-- 2. Crear un nuevo constraint con las tres opciones
ALTER TABLE hospital_contracts
ADD CONSTRAINT check_contracting_model 
CHECK (contracting_model IN ('contratacion_directa', 'licitacion', 'invitacion_privada'));

-- 3. Actualizar el comentario de la columna
COMMENT ON COLUMN hospital_contracts.contracting_model IS 'Modelo de contratación: contratacion_directa, licitacion o invitacion_privada';

-- 4. Verificar que el constraint se actualizó correctamente
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'hospital_contracts'::regclass
AND conname = 'check_contracting_model';