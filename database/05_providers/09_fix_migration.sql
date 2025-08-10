-- ==================================================================
-- CORRECCIÓN DE MIGRACIÓN DE PROVEEDORES
-- ==================================================================
-- Corrige el problema del NIT muy largo en la migración
-- ==================================================================

-- 1. PRIMERO, VERIFICAR SI YA HAY PROVEEDORES MIGRADOS
-- ==================================================================
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count 
    FROM proveedores 
    WHERE nit LIKE 'MIG-%';
    
    IF v_count > 0 THEN
        RAISE NOTICE 'ℹ️  Ya hay % proveedores migrados anteriormente', v_count;
    END IF;
END $$;

-- 2. MIGRAR DATOS DE current_provider A proveedor_id (VERSIÓN CORREGIDA)
-- ==================================================================
DO $$
DECLARE
    v_contract RECORD;
    v_proveedor_id UUID;
    v_migrated INTEGER := 0;
    v_nit_counter INTEGER := 1;
    v_temp_nit VARCHAR(20);
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'MIGRANDO PROVEEDORES EXISTENTES';
    RAISE NOTICE '========================================';
    
    -- Obtener el siguiente número disponible para NITs migrados
    SELECT COALESCE(MAX(
        CASE 
            WHEN nit LIKE 'MIG-%' 
            THEN SUBSTRING(nit FROM 5)::INTEGER 
            ELSE 0 
        END
    ), 0) + 1 INTO v_nit_counter
    FROM proveedores;
    
    FOR v_contract IN 
        SELECT id, current_provider 
        FROM hospital_contracts 
        WHERE current_provider IS NOT NULL 
        AND current_provider != ''
        AND proveedor_id IS NULL
    LOOP
        -- Buscar proveedor por nombre (exacto o similar)
        SELECT id INTO v_proveedor_id
        FROM proveedores
        WHERE LOWER(TRIM(nombre)) = LOWER(TRIM(v_contract.current_provider))
           OR LOWER(TRIM(nombre)) LIKE LOWER(TRIM(v_contract.current_provider)) || '%'
        LIMIT 1;
        
        -- Si no existe, crear el proveedor con un NIT corto
        IF v_proveedor_id IS NULL THEN
            -- Generar un NIT temporal corto
            v_temp_nit := 'MIG-' || v_nit_counter::text;
            
            -- Verificar que el NIT no exista
            WHILE EXISTS (SELECT 1 FROM proveedores WHERE nit = v_temp_nit) LOOP
                v_nit_counter := v_nit_counter + 1;
                v_temp_nit := 'MIG-' || v_nit_counter::text;
            END LOOP;
            
            INSERT INTO proveedores (
                nit, 
                nombre, 
                estado,
                notas_internas
            ) VALUES (
                v_temp_nit,
                v_contract.current_provider,
                'activo',
                'Proveedor migrado automáticamente desde contratos. NIT temporal, actualizar con el real.'
            ) RETURNING id INTO v_proveedor_id;
            
            RAISE NOTICE 'Proveedor creado: % (NIT: %)', v_contract.current_provider, v_temp_nit;
            v_nit_counter := v_nit_counter + 1;
        ELSE
            RAISE NOTICE 'Proveedor encontrado: %', v_contract.current_provider;
        END IF;
        
        -- Actualizar el contrato con el proveedor_id
        UPDATE hospital_contracts 
        SET proveedor_id = v_proveedor_id
        WHERE id = v_contract.id;
        
        v_migrated := v_migrated + 1;
    END LOOP;
    
    RAISE NOTICE '✅ Migrados % contratos con proveedores', v_migrated;
END $$;

-- 3. VERIFICAR RESULTADOS
-- ==================================================================
DO $$
DECLARE
    v_count_total INTEGER;
    v_count_migrated INTEGER;
    v_count_pending INTEGER;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'RESUMEN DE MIGRACIÓN';
    RAISE NOTICE '========================================';
    
    -- Total de contratos con proveedor
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
    
    RAISE NOTICE 'Total contratos con proveedor (texto): %', v_count_total;
    RAISE NOTICE 'Contratos migrados (con proveedor_id): %', v_count_migrated;
    RAISE NOTICE 'Contratos pendientes de migrar: %', v_count_pending;
    
    -- Mostrar proveedores creados en esta migración
    RAISE NOTICE '';
    RAISE NOTICE 'Proveedores migrados (requieren actualización de NIT):';
    FOR v_count_total IN 
        SELECT nit, nombre 
        FROM proveedores 
        WHERE nit LIKE 'MIG-%'
        ORDER BY nit
        LIMIT 10
    LOOP
        RAISE NOTICE '  - % | %', 
            (SELECT nit FROM proveedores WHERE nit LIKE 'MIG-%' ORDER BY nit LIMIT 1),
            (SELECT nombre FROM proveedores WHERE nit LIKE 'MIG-%' ORDER BY nit LIMIT 1);
    END LOOP;
END $$;

-- 4. MOSTRAR PROVEEDORES QUE NECESITAN ACTUALIZACIÓN
-- ==================================================================
SELECT 
    'Proveedores que necesitan actualización de NIT:' as info;

SELECT 
    nit,
    nombre,
    created_at::date as fecha_creacion
FROM proveedores
WHERE nit LIKE 'MIG-%'
ORDER BY nit;

-- ==================================================================
-- FIN DEL SCRIPT DE CORRECCIÓN
-- ==================================================================