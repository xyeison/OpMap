-- ==================================================================
-- CORRECCIÓN DE MIGRACIÓN DE PROVEEDORES V2
-- ==================================================================
-- Versión mejorada que maneja correctamente los NITs
-- ==================================================================

-- 1. LIMPIAR PROVEEDORES MAL MIGRADOS (OPCIONAL)
-- ==================================================================
-- Si necesitas limpiar intentos anteriores, descomenta estas líneas:
/*
DELETE FROM hospital_contracts WHERE proveedor_id IN (
    SELECT id FROM proveedores WHERE nit LIKE 'MIG-%'
);
DELETE FROM proveedores WHERE nit LIKE 'MIG-%';
*/

-- 2. MIGRAR DATOS DE current_provider A proveedor_id (VERSIÓN CORREGIDA V2)
-- ==================================================================
DO $$
DECLARE
    v_contract RECORD;
    v_proveedor_id UUID;
    v_migrated INTEGER := 0;
    v_nit_counter INTEGER;
    v_temp_nit VARCHAR(20);
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'MIGRANDO PROVEEDORES EXISTENTES V2';
    RAISE NOTICE '========================================';
    
    -- Obtener el siguiente número disponible para NITs migrados
    -- Versión corregida que maneja correctamente los NITs existentes
    SELECT COALESCE(MAX(
        CAST(
            SUBSTRING(nit FROM 5) AS INTEGER
        )
    ), 0) + 1 INTO v_nit_counter
    FROM proveedores
    WHERE nit LIKE 'MIG-%'
    AND SUBSTRING(nit FROM 5) ~ '^\d+$';  -- Solo considerar los que tienen números después de MIG-
    
    -- Si no hay ninguno, empezar desde 1
    IF v_nit_counter IS NULL THEN
        v_nit_counter := 1;
    END IF;
    
    RAISE NOTICE 'Iniciando contador de NIT desde: MIG-%', v_nit_counter;
    
    FOR v_contract IN 
        SELECT id, current_provider 
        FROM hospital_contracts 
        WHERE current_provider IS NOT NULL 
        AND current_provider != ''
        AND proveedor_id IS NULL
        ORDER BY current_provider  -- Ordenar para agrupar proveedores similares
    LOOP
        -- Buscar proveedor por nombre (exacto primero, luego similar)
        SELECT id INTO v_proveedor_id
        FROM proveedores
        WHERE LOWER(TRIM(nombre)) = LOWER(TRIM(v_contract.current_provider))
        LIMIT 1;
        
        -- Si no existe exacto, buscar similar
        IF v_proveedor_id IS NULL THEN
            SELECT id INTO v_proveedor_id
            FROM proveedores
            WHERE LOWER(TRIM(nombre)) LIKE '%' || LOWER(TRIM(v_contract.current_provider)) || '%'
               OR LOWER(TRIM(v_contract.current_provider)) LIKE '%' || LOWER(TRIM(nombre)) || '%'
            LIMIT 1;
        END IF;
        
        -- Si no existe, crear el proveedor con un NIT temporal
        IF v_proveedor_id IS NULL THEN
            -- Generar un NIT temporal corto
            v_temp_nit := 'MIG-' || v_nit_counter::text;
            
            -- Asegurarse de que el NIT no exista
            WHILE EXISTS (SELECT 1 FROM proveedores WHERE nit = v_temp_nit) LOOP
                v_nit_counter := v_nit_counter + 1;
                v_temp_nit := 'MIG-' || v_nit_counter::text;
            END LOOP;
            
            BEGIN
                INSERT INTO proveedores (
                    nit, 
                    nombre, 
                    estado,
                    notas_internas
                ) VALUES (
                    v_temp_nit,
                    v_contract.current_provider,
                    'activo',
                    'Proveedor migrado automáticamente desde contratos. NIT temporal, actualizar con el NIT real.'
                ) RETURNING id INTO v_proveedor_id;
                
                RAISE NOTICE '✅ Proveedor creado: % (NIT: %)', v_contract.current_provider, v_temp_nit;
                v_nit_counter := v_nit_counter + 1;
            EXCEPTION
                WHEN unique_violation THEN
                    -- Si el nombre ya existe, buscar el proveedor existente
                    SELECT id INTO v_proveedor_id
                    FROM proveedores
                    WHERE nombre = v_contract.current_provider
                    LIMIT 1;
                    RAISE NOTICE 'ℹ️  Proveedor ya existente: %', v_contract.current_provider;
            END;
        ELSE
            RAISE NOTICE 'ℹ️  Proveedor encontrado: %', v_contract.current_provider;
        END IF;
        
        -- Actualizar el contrato con el proveedor_id
        IF v_proveedor_id IS NOT NULL THEN
            UPDATE hospital_contracts 
            SET proveedor_id = v_proveedor_id
            WHERE id = v_contract.id;
            
            v_migrated := v_migrated + 1;
        END IF;
    END LOOP;
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ MIGRACIÓN COMPLETADA';
    RAISE NOTICE '✅ Contratos migrados: %', v_migrated;
    RAISE NOTICE '========================================';
END $$;

-- 3. VERIFICAR RESULTADOS
-- ==================================================================
DO $$
DECLARE
    v_count_total INTEGER;
    v_count_migrated INTEGER;
    v_count_pending INTEGER;
    v_count_providers INTEGER;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'RESUMEN DE MIGRACIÓN';
    RAISE NOTICE '========================================';
    
    -- Total de contratos con proveedor (texto)
    SELECT COUNT(*) INTO v_count_total
    FROM hospital_contracts
    WHERE current_provider IS NOT NULL 
    AND current_provider != '';
    
    -- Contratos migrados (con proveedor_id)
    SELECT COUNT(*) INTO v_count_migrated
    FROM hospital_contracts
    WHERE proveedor_id IS NOT NULL;
    
    -- Contratos pendientes
    SELECT COUNT(*) INTO v_count_pending
    FROM hospital_contracts
    WHERE current_provider IS NOT NULL 
    AND current_provider != ''
    AND proveedor_id IS NULL;
    
    -- Proveedores migrados
    SELECT COUNT(*) INTO v_count_providers
    FROM proveedores
    WHERE nit LIKE 'MIG-%';
    
    RAISE NOTICE 'Total contratos con proveedor (texto): %', v_count_total;
    RAISE NOTICE 'Contratos migrados (con proveedor_id): %', v_count_migrated;
    RAISE NOTICE 'Contratos pendientes de migrar: %', v_count_pending;
    RAISE NOTICE 'Proveedores creados con NIT temporal: %', v_count_providers;
END $$;

-- 4. MOSTRAR PROVEEDORES QUE NECESITAN ACTUALIZACIÓN
-- ==================================================================
SELECT 
    '========================================' as info
UNION ALL
SELECT 'PROVEEDORES CON NIT TEMPORAL (requieren actualización):'
UNION ALL
SELECT '========================================';

SELECT 
    nit AS "NIT Temporal",
    nombre AS "Nombre del Proveedor",
    created_at::date AS "Fecha Creación"
FROM proveedores
WHERE nit LIKE 'MIG-%'
ORDER BY 
    CAST(SUBSTRING(nit FROM 5) AS INTEGER)
LIMIT 20;

-- Mostrar cantidad total si hay muchos
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM proveedores
    WHERE nit LIKE 'MIG-%';
    
    IF v_count > 20 THEN
        RAISE NOTICE '';
        RAISE NOTICE 'Nota: Se muestran solo los primeros 20 de % proveedores con NIT temporal', v_count;
    END IF;
END $$;

-- 5. VERIFICAR INTEGRIDAD
-- ==================================================================
SELECT 
    '========================================' as info
UNION ALL
SELECT 'VERIFICACIÓN DE INTEGRIDAD:'
UNION ALL
SELECT '========================================';

-- Verificar si hay contratos huérfanos
SELECT 
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ No hay contratos con proveedor_id inválido'
        ELSE '❌ Hay ' || COUNT(*) || ' contratos con proveedor_id inválido'
    END as verificacion
FROM hospital_contracts hc
WHERE hc.proveedor_id IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM proveedores p WHERE p.id = hc.proveedor_id
);

-- Verificar duplicados de proveedores
WITH duplicados AS (
    SELECT 
        LOWER(TRIM(nombre)) as nombre_normalizado,
        COUNT(*) as cantidad
    FROM proveedores
    GROUP BY LOWER(TRIM(nombre))
    HAVING COUNT(*) > 1
)
SELECT 
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ No hay proveedores duplicados por nombre'
        ELSE '⚠️  Hay ' || COUNT(*) || ' nombres de proveedores duplicados'
    END as verificacion
FROM duplicados;

-- ==================================================================
-- FIN DEL SCRIPT DE MIGRACIÓN V2
-- ==================================================================