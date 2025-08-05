-- ========================================
-- AGREGAR CAMPO DE TIPO DE HOSPITAL
-- ========================================

-- 1. Agregar columna 'type' a la tabla hospitals
ALTER TABLE hospitals 
ADD COLUMN IF NOT EXISTS type VARCHAR(10) 
CHECK (type IN ('Publico', 'Privada', 'Mixta'));

-- 2. Agregar comentario descriptivo
COMMENT ON COLUMN hospitals.type IS 'Tipo de hospital: Publico, Privada o Mixta';

-- 3. Crear índice para búsquedas por tipo
CREATE INDEX IF NOT EXISTS idx_hospitals_type ON hospitals(type);

-- 4. Verificar que la columna se agregó correctamente
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'hospitals' 
AND column_name = 'type';

-- 5. Mostrar estadísticas actuales (antes de actualizar)
SELECT 
    'Estadísticas actuales de tipos de hospitales:' as info;

SELECT 
    type,
    COUNT(*) as cantidad,
    ROUND((COUNT(*) * 100.0 / (SELECT COUNT(*) FROM hospitals)), 2) as porcentaje
FROM hospitals
GROUP BY type
ORDER BY cantidad DESC;

-- 6. Contar hospitales sin tipo asignado
SELECT 
    'Hospitales sin tipo asignado:' as info,
    COUNT(*) as cantidad
FROM hospitals
WHERE type IS NULL;