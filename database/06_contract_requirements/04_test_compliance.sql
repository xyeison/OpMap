-- ==================================================================
-- PROBAR EL SISTEMA DE CUMPLIMIENTO DE REQUISITOS
-- ==================================================================

-- 1. Verificar si hay datos en mi_empresa_config
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM mi_empresa_config LIMIT 1) THEN
        RAISE NOTICE 'No hay configuración de Mi Empresa. Insertando datos de ejemplo...';
        
        INSERT INTO mi_empresa_config (
            nombre,
            nit,
            anio_fiscal,
            activo_corriente,
            activo_total,
            pasivo_corriente,
            pasivo_total,
            patrimonio,
            ingresos_anuales,
            utilidad_neta,
            gastos_intereses,
            utilidad_operacional,
            anos_experiencia
        ) VALUES (
            'Mi Empresa SAS',
            '900123456-1',
            2024,
            5000,  -- 5,000 millones
            15000, -- 15,000 millones
            3000,  -- 3,000 millones  
            7000,  -- 7,000 millones
            8000,  -- 8,000 millones
            20000, -- 20,000 millones
            1500,  -- 1,500 millones
            500,   -- 500 millones
            2500,  -- 2,500 millones
            10     -- 10 años de experiencia
        );
        
        RAISE NOTICE 'Datos de Mi Empresa insertados correctamente';
    ELSE
        RAISE NOTICE 'Ya existe configuración de Mi Empresa';
    END IF;
END $$;

-- 2. Mostrar los indicadores calculados de Mi Empresa
SELECT 
    '=== INDICADORES DE MI EMPRESA ===' as titulo,
    nombre,
    anio_fiscal,
    ROUND(indice_liquidez::numeric, 2) as indice_liquidez,
    ROUND((indice_endeudamiento * 100)::numeric, 1) || '%' as endeudamiento,
    ROUND(cobertura_intereses::numeric, 2) as cobertura,
    patrimonio || 'M' as patrimonio,
    capital_trabajo || 'M' as capital_trabajo
FROM mi_empresa_config
ORDER BY anio_fiscal DESC
LIMIT 1;

-- 3. Agregar requisitos a algunos contratos si no tienen
DO $$
DECLARE
    v_count integer;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM hospital_contracts
    WHERE indice_liquidez_requerido IS NOT NULL;
    
    IF v_count = 0 THEN
        RAISE NOTICE 'Agregando requisitos de ejemplo a contratos...';
        
        -- Agregar requisitos fáciles de cumplir
        UPDATE hospital_contracts
        SET 
            indice_liquidez_requerido = 1.0,
            indice_endeudamiento_maximo = 0.8,
            cobertura_intereses_minimo = 1.0,
            patrimonio_minimo = 3000,
            capital_trabajo_minimo = 1000
        WHERE id IN (
            SELECT id FROM hospital_contracts 
            WHERE active = true 
            LIMIT 3
        );
        
        -- Agregar requisitos difíciles de cumplir
        UPDATE hospital_contracts
        SET 
            indice_liquidez_requerido = 2.5,
            indice_endeudamiento_maximo = 0.3,
            cobertura_intereses_minimo = 10.0,
            patrimonio_minimo = 15000,
            capital_trabajo_minimo = 8000
        WHERE id IN (
            SELECT id FROM hospital_contracts 
            WHERE active = true 
            AND indice_liquidez_requerido IS NULL
            LIMIT 2
        );
        
        RAISE NOTICE 'Requisitos agregados a contratos';
    ELSE
        RAISE NOTICE 'Ya existen % contratos con requisitos', v_count;
    END IF;
END $$;

-- 4. Validar cumplimiento de un contrato específico
SELECT 
    '=== VALIDACIÓN DE CUMPLIMIENTO (Primer contrato con requisitos) ===' as titulo;

SELECT 
    validar_cumplimiento_contrato(id) as resultado_validacion
FROM hospital_contracts
WHERE indice_liquidez_requerido IS NOT NULL
LIMIT 1;

-- 5. Mostrar vista de cumplimiento
SELECT 
    '=== DASHBOARD DE CUMPLIMIENTO ===' as titulo,
    contract_number,
    contract_value || 'M' as valor,
    hospital_name,
    CASE 
        WHEN cumple_requisitos = true THEN '✅ CUMPLE'
        WHEN cumple_requisitos = false THEN '❌ NO CUMPLE'
        ELSE '⚠️ SIN VALIDAR'
    END as estado,
    ROUND(mi_indice_liquidez::numeric, 2) || ' / ' || ROUND(indice_liquidez_requerido::numeric, 2) as "Liquidez (Actual/Req)",
    ROUND((mi_indice_endeudamiento * 100)::numeric, 1) || '% / ' || ROUND((indice_endeudamiento_maximo * 100)::numeric, 1) || '%' as "Endeud (Actual/Max)",
    cumple_liquidez,
    cumple_endeudamiento
FROM v_cumplimiento_contratos
WHERE indice_liquidez_requerido IS NOT NULL
   OR indice_endeudamiento_maximo IS NOT NULL
LIMIT 10;

-- 6. Resumen estadístico
SELECT 
    '=== RESUMEN DE CUMPLIMIENTO ===' as titulo,
    COUNT(*) as total_contratos,
    COUNT(CASE WHEN cumple_requisitos = true THEN 1 END) as cumple,
    COUNT(CASE WHEN cumple_requisitos = false THEN 1 END) as no_cumple,
    COUNT(CASE WHEN cumple_requisitos IS NULL THEN 1 END) as sin_validar,
    ROUND(
        COUNT(CASE WHEN cumple_requisitos = true THEN 1 END)::numeric * 100 / 
        NULLIF(COUNT(CASE WHEN cumple_requisitos IS NOT NULL THEN 1 END), 0),
        1
    ) || '%' as porcentaje_cumplimiento
FROM v_cumplimiento_contratos
WHERE indice_liquidez_requerido IS NOT NULL
   OR indice_endeudamiento_maximo IS NOT NULL;

-- 7. Validar todos los contratos
SELECT 
    '=== VALIDANDO TODOS LOS CONTRATOS ===' as titulo,
    validar_todos_contratos() as resultado;

-- ==================================================================
-- FIN DEL SCRIPT DE PRUEBAS
-- ==================================================================