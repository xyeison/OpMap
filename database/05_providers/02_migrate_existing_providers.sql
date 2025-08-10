-- ==================================================================
-- MIGRACIÓN DE PROVEEDORES EXISTENTES
-- ==================================================================
-- Este script migra los proveedores existentes desde el campo de texto
-- current_provider en hospital_contracts a la nueva tabla proveedores
-- ==================================================================

-- 1. CREAR TABLA TEMPORAL PARA MAPEO
-- ==================================================================
CREATE TEMP TABLE IF NOT EXISTS provider_migration_map (
    old_name text,
    normalized_name text,
    nit varchar(20),
    new_provider_id uuid
);

-- 2. EXTRAER Y NORMALIZAR PROVEEDORES ÚNICOS
-- ==================================================================
INSERT INTO provider_migration_map (old_name, normalized_name)
SELECT DISTINCT 
    current_provider,
    UPPER(TRIM(current_provider)) AS normalized_name
FROM hospital_contracts
WHERE current_provider IS NOT NULL 
  AND TRIM(current_provider) != ''
ON CONFLICT DO NOTHING;

-- 3. GENERAR NITs TEMPORALES (se actualizarán manualmente después)
-- ==================================================================
UPDATE provider_migration_map
SET nit = 'TEMP-' || LPAD(ROW_NUMBER() OVER (ORDER BY normalized_name)::text, 6, '0')
WHERE nit IS NULL;

-- 4. INSERTAR PROVEEDORES EN LA TABLA PRINCIPAL
-- ==================================================================
WITH inserted_providers AS (
    INSERT INTO proveedores (
        nit,
        nombre,
        estado,
        tipo_empresa,
        notas_internas
    )
    SELECT 
        m.nit,
        m.old_name AS nombre,
        'activo' AS estado,
        'competidor' AS tipo_empresa,  -- Por defecto, se actualizará después
        'Proveedor migrado automáticamente desde hospital_contracts. Requiere actualización de NIT y datos.' AS notas_internas
    FROM provider_migration_map m
    WHERE NOT EXISTS (
        SELECT 1 FROM proveedores p 
        WHERE UPPER(TRIM(p.nombre)) = m.normalized_name
    )
    RETURNING id, UPPER(TRIM(nombre)) AS normalized_name
)
UPDATE provider_migration_map m
SET new_provider_id = ip.id
FROM inserted_providers ip
WHERE m.normalized_name = ip.normalized_name;

-- También actualizar los que ya existían
UPDATE provider_migration_map m
SET new_provider_id = p.id
FROM proveedores p
WHERE m.normalized_name = UPPER(TRIM(p.nombre))
  AND m.new_provider_id IS NULL;

-- 5. ACTUALIZAR hospital_contracts CON LAS REFERENCIAS
-- ==================================================================
UPDATE hospital_contracts hc
SET proveedor_id = m.new_provider_id
FROM provider_migration_map m
WHERE UPPER(TRIM(hc.current_provider)) = m.normalized_name
  AND hc.proveedor_id IS NULL;

-- 6. REPORTE DE MIGRACIÓN
-- ==================================================================
DO $$
DECLARE
    v_total_contracts integer;
    v_migrated_contracts integer;
    v_new_providers integer;
    v_unmigrated_contracts integer;
BEGIN
    -- Total de contratos con proveedor
    SELECT COUNT(*) INTO v_total_contracts
    FROM hospital_contracts
    WHERE current_provider IS NOT NULL AND TRIM(current_provider) != '';
    
    -- Contratos migrados exitosamente
    SELECT COUNT(*) INTO v_migrated_contracts
    FROM hospital_contracts
    WHERE proveedor_id IS NOT NULL;
    
    -- Nuevos proveedores creados
    SELECT COUNT(*) INTO v_new_providers
    FROM proveedores
    WHERE nit LIKE 'TEMP-%';
    
    -- Contratos no migrados
    v_unmigrated_contracts := v_total_contracts - v_migrated_contracts;
    
    RAISE NOTICE '===========================================';
    RAISE NOTICE 'REPORTE DE MIGRACIÓN DE PROVEEDORES';
    RAISE NOTICE '===========================================';
    RAISE NOTICE 'Total contratos con proveedor: %', v_total_contracts;
    RAISE NOTICE 'Contratos migrados exitosamente: %', v_migrated_contracts;
    RAISE NOTICE 'Nuevos proveedores creados: %', v_new_providers;
    RAISE NOTICE 'Contratos no migrados: %', v_unmigrated_contracts;
    RAISE NOTICE '===========================================';
    
    IF v_unmigrated_contracts > 0 THEN
        RAISE NOTICE 'ADVERTENCIA: Hay % contratos que no pudieron ser migrados', v_unmigrated_contracts;
        RAISE NOTICE 'Revise los siguientes proveedores:';
        
        FOR rec IN 
            SELECT DISTINCT current_provider
            FROM hospital_contracts
            WHERE proveedor_id IS NULL
              AND current_provider IS NOT NULL
              AND TRIM(current_provider) != ''
            LIMIT 10
        LOOP
            RAISE NOTICE '  - %', rec.current_provider;
        END LOOP;
    END IF;
    
    IF v_new_providers > 0 THEN
        RAISE NOTICE '';
        RAISE NOTICE 'ACCIÓN REQUERIDA:';
        RAISE NOTICE 'Se crearon % proveedores con NIT temporal (TEMP-XXXXXX)', v_new_providers;
        RAISE NOTICE 'Por favor actualice los NITs reales ejecutando:';
        RAISE NOTICE '';
        RAISE NOTICE 'UPDATE proveedores SET nit = ''NIT_REAL'' WHERE nombre = ''NOMBRE_PROVEEDOR'';';
    END IF;
END $$;

-- 7. VERIFICACIÓN DE INTEGRIDAD
-- ==================================================================

-- Contratos sin proveedor_id pero con current_provider
SELECT 
    'Contratos no migrados' AS tipo,
    COUNT(*) AS cantidad,
    STRING_AGG(DISTINCT current_provider, ', ' ORDER BY current_provider) AS proveedores
FROM hospital_contracts
WHERE proveedor_id IS NULL
  AND current_provider IS NOT NULL
  AND TRIM(current_provider) != '';

-- Proveedores creados con NIT temporal
SELECT 
    'Proveedores con NIT temporal' AS tipo,
    COUNT(*) AS cantidad,
    STRING_AGG(nombre || ' (' || nit || ')', ', ' ORDER BY nombre) AS lista
FROM proveedores
WHERE nit LIKE 'TEMP-%';

-- 8. QUERIES ÚTILES POST-MIGRACIÓN
-- ==================================================================

-- Ver proveedores y sus contratos
SELECT 
    p.nombre AS proveedor,
    p.nit,
    COUNT(hc.id) AS total_contratos,
    SUM(hc.contract_value) AS valor_total,
    STRING_AGG(DISTINCT h.name, ', ' ORDER BY h.name) AS hospitales
FROM proveedores p
LEFT JOIN hospital_contracts hc ON hc.proveedor_id = p.id
LEFT JOIN hospitals h ON h.id = hc.hospital_id
GROUP BY p.id, p.nombre, p.nit
ORDER BY COUNT(hc.id) DESC;

-- Actualizar tipo de empresa basado en análisis inicial
-- (Este es un ejemplo, ajustar según criterios de negocio)
UPDATE proveedores
SET tipo_empresa = CASE
    WHEN nombre ILIKE '%medtronic%' OR nombre ILIKE '%johnson%' OR nombre ILIKE '%siemens%' 
        THEN 'competidor'
    WHEN nombre ILIKE '%distribuidor%' OR nombre ILIKE '%comercializadora%'
        THEN 'cliente_potencial'
    ELSE tipo_empresa
END
WHERE tipo_empresa = 'competidor';  -- Solo actualiza los migrados

-- ==================================================================
-- FIN DEL SCRIPT DE MIGRACIÓN
-- ==================================================================

-- NOTA: Después de ejecutar este script:
-- 1. Actualice los NITs reales de los proveedores
-- 2. Complete la información de contacto y descripción
-- 3. Agregue los estados financieros para análisis
-- 4. Clasifique correctamente el tipo_empresa
-- 5. Considere eliminar o archivar el campo current_provider