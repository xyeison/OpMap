-- ==================================================================
-- SCRIPT OPCIONAL: ELIMINAR RESTRICCIÓN DE UNICIDAD EN NOMBRE
-- ==================================================================
-- NOTA: Este script es OPCIONAL. Solo ejecutarlo si deseas permitir
-- proveedores con nombres duplicados. Por defecto, el sistema no
-- permite nombres duplicados para evitar confusiones.
-- ==================================================================

-- 1. VERIFICAR SI LA RESTRICCIÓN EXISTE
-- ==================================================================
DO $$
BEGIN
    -- Intentar eliminar la restricción si existe
    IF EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'proveedores_nombre_key' 
        AND table_name = 'proveedores'
    ) THEN
        ALTER TABLE proveedores DROP CONSTRAINT proveedores_nombre_key;
        RAISE NOTICE '✅ Restricción de unicidad en nombre eliminada';
        RAISE NOTICE 'Ahora se permiten proveedores con nombres duplicados';
    ELSE
        RAISE NOTICE 'ℹ️ La restricción de unicidad en nombre no existe o ya fue eliminada';
    END IF;
END $$;

-- 2. CREAR UN ÍNDICE NO ÚNICO PARA MANTENER PERFORMANCE EN BÚSQUEDAS
-- ==================================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_indexes 
        WHERE indexname = 'idx_proveedores_nombre' 
        AND tablename = 'proveedores'
    ) THEN
        CREATE INDEX idx_proveedores_nombre ON proveedores(nombre);
        RAISE NOTICE '✅ Índice de búsqueda creado en campo nombre';
    ELSE
        RAISE NOTICE 'ℹ️ El índice ya existe';
    END IF;
END $$;

-- 3. VERIFICAR ESTADO FINAL
-- ==================================================================
SELECT 
    '========================================' as info
UNION ALL
SELECT 'ESTADO DE RESTRICCIONES EN TABLA proveedores:'
UNION ALL
SELECT '========================================';

SELECT 
    tc.constraint_name AS "Restricción",
    tc.constraint_type AS "Tipo",
    kcu.column_name AS "Columna"
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name = 'proveedores'
ORDER BY tc.constraint_type, kcu.column_name;

-- 4. ADVERTENCIA
-- ==================================================================
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  ADVERTENCIA:';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Al permitir nombres duplicados, es importante';
    RAISE NOTICE 'diferenciar proveedores mediante otros campos';
    RAISE NOTICE 'como NIT, ciudad, o información adicional.';
    RAISE NOTICE '';
    RAISE NOTICE 'Considera usar nombres descriptivos como:';
    RAISE NOTICE '- "Proveedor ABC - Bogotá"';
    RAISE NOTICE '- "Proveedor ABC - Medellín"';
    RAISE NOTICE '- "Proveedor ABC (División Médica)"';
    RAISE NOTICE '';
END $$;

-- ==================================================================
-- FIN DEL SCRIPT OPCIONAL
-- ==================================================================