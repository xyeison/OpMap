-- Agregar campo hospital_type a la tabla hospitals
-- Este campo permite clasificar los hospitales como Público, Privado o Mixto

-- Agregar la columna hospital_type si no existe
ALTER TABLE hospitals 
ADD COLUMN IF NOT EXISTS hospital_type VARCHAR(50) DEFAULT 'Publico';

-- Agregar comentario descriptivo
COMMENT ON COLUMN hospitals.hospital_type IS 'Tipo de hospital: Publico, Privado o Mixto';

-- Crear índice para búsquedas por tipo
CREATE INDEX IF NOT EXISTS idx_hospitals_hospital_type ON hospitals(hospital_type);

-- Actualizar algunos hospitales de ejemplo (opcional - ajustar según necesidad)
-- UPDATE hospitals SET hospital_type = 'Privado' WHERE name ILIKE '%Clínica%';
-- UPDATE hospitals SET hospital_type = 'Mixto' WHERE name ILIKE '%Fundación%';

-- Verificar que el campo fue agregado correctamente
SELECT 
    column_name,
    data_type,
    column_default,
    is_nullable
FROM 
    information_schema.columns
WHERE 
    table_name = 'hospitals' 
    AND column_name = 'hospital_type';