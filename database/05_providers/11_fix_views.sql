-- ==================================================================
-- CORRECCIÓN DE VISTAS CON ERRORES DE TIPOS
-- ==================================================================
-- Corrige el error de EXTRACT en las vistas
-- ==================================================================

-- 1. ELIMINAR VISTAS EXISTENTES SI TIENEN ERRORES
-- ==================================================================
DROP VIEW IF EXISTS v_hospital_contracts_extended CASCADE;
DROP VIEW IF EXISTS v_proveedor_resumen_contratos CASCADE;

-- 2. RECREAR VISTA v_hospital_contracts_extended CORREGIDA
-- ==================================================================
CREATE OR REPLACE VIEW v_hospital_contracts_extended AS
SELECT 
    hc.*,
    h.name AS hospital_name,
    h.municipality_name,
    h.department_name,
    h.beds AS hospital_beds,
    p.nombre AS proveedor_nombre,
    p.nit AS proveedor_nit,
    p.estado AS proveedor_estado,
    CASE 
        WHEN hc.end_date >= CURRENT_DATE THEN 'vigente'
        WHEN hc.end_date >= CURRENT_DATE - INTERVAL '30 days' THEN 'vencido_reciente'
        WHEN hc.end_date >= CURRENT_DATE - INTERVAL '90 days' THEN 'vencido'
        ELSE 'vencido_antiguo'
    END AS estado_vigencia,
    -- Corregido: calcular días correctamente
    CASE 
        WHEN hc.end_date IS NOT NULL THEN 
            DATE_PART('day', hc.end_date::timestamp - CURRENT_DATE::timestamp)::integer
        ELSE 
            NULL
    END AS dias_vigencia
FROM hospital_contracts hc
LEFT JOIN hospitals h ON h.id = hc.hospital_id
LEFT JOIN proveedores p ON p.id = hc.proveedor_id
ORDER BY hc.end_date DESC;

COMMENT ON VIEW v_hospital_contracts_extended IS 'Vista extendida de contratos con información de hospitales y proveedores';

-- 3. RECREAR VISTA v_proveedor_resumen_contratos
-- ==================================================================
CREATE OR REPLACE VIEW v_proveedor_resumen_contratos AS
WITH contratos_stats AS (
    SELECT 
        proveedor_id,
        COUNT(*) AS total_contratos,
        COUNT(DISTINCT hospital_id) AS total_hospitales,
        SUM(contract_value) AS valor_total_contratos,
        SUM(CASE WHEN end_date >= CURRENT_DATE THEN contract_value ELSE 0 END) AS valor_contratos_vigentes,
        COUNT(CASE WHEN end_date >= CURRENT_DATE THEN 1 END) AS contratos_vigentes,
        COUNT(CASE WHEN end_date < CURRENT_DATE THEN 1 END) AS contratos_vencidos,
        MAX(end_date) AS fecha_ultimo_contrato,
        MIN(start_date) AS fecha_primer_contrato
    FROM hospital_contracts
    WHERE proveedor_id IS NOT NULL
    GROUP BY proveedor_id
)
SELECT 
    p.*,
    COALESCE(cs.total_contratos, 0) AS total_contratos,
    COALESCE(cs.total_hospitales, 0) AS total_hospitales,
    COALESCE(cs.valor_total_contratos, 0) AS valor_total_contratos,
    COALESCE(cs.valor_contratos_vigentes, 0) AS valor_contratos_vigentes,
    COALESCE(cs.contratos_vigentes, 0) AS contratos_vigentes,
    COALESCE(cs.contratos_vencidos, 0) AS contratos_vencidos,
    cs.fecha_ultimo_contrato,
    cs.fecha_primer_contrato
FROM proveedores p
LEFT JOIN contratos_stats cs ON cs.proveedor_id = p.id;

COMMENT ON VIEW v_proveedor_resumen_contratos IS 'Resumen de proveedores con estadísticas de contratos';

-- 4. VERIFICAR QUE LAS VISTAS FUNCIONAN
-- ==================================================================
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'VERIFICANDO VISTAS CORREGIDAS';
    RAISE NOTICE '========================================';
    
    -- Probar v_hospital_contracts_extended
    BEGIN
        SELECT COUNT(*) INTO v_count FROM v_hospital_contracts_extended LIMIT 1;
        RAISE NOTICE '✅ Vista v_hospital_contracts_extended funciona correctamente';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '❌ Error en v_hospital_contracts_extended: %', SQLERRM;
    END;
    
    -- Probar v_proveedor_resumen_contratos
    BEGIN
        SELECT COUNT(*) INTO v_count FROM v_proveedor_resumen_contratos LIMIT 1;
        RAISE NOTICE '✅ Vista v_proveedor_resumen_contratos funciona correctamente';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '❌ Error en v_proveedor_resumen_contratos: %', SQLERRM;
    END;
    
    -- Mostrar ejemplo de días de vigencia
    BEGIN
        PERFORM 
            hospital_name,
            estado_vigencia,
            dias_vigencia
        FROM v_hospital_contracts_extended
        WHERE dias_vigencia IS NOT NULL
        LIMIT 5;
        RAISE NOTICE '✅ Cálculo de días de vigencia funcionando';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '⚠️  No se pudo verificar días de vigencia: %', SQLERRM;
    END;
END $$;

-- 5. MOSTRAR EJEMPLOS DE LAS VISTAS
-- ==================================================================
SELECT 
    '========================================' as info
UNION ALL
SELECT 'EJEMPLO DE CONTRATOS CON DÍAS DE VIGENCIA:'
UNION ALL
SELECT '========================================';

SELECT 
    hospital_name AS "Hospital",
    proveedor_nombre AS "Proveedor",
    end_date AS "Fecha Fin",
    estado_vigencia AS "Estado",
    dias_vigencia AS "Días"
FROM v_hospital_contracts_extended
WHERE proveedor_id IS NOT NULL
ORDER BY dias_vigencia DESC NULLS LAST
LIMIT 10;

SELECT 
    '========================================' as info
UNION ALL
SELECT 'RESUMEN DE PROVEEDORES CON CONTRATOS:'
UNION ALL
SELECT '========================================';

SELECT 
    nombre AS "Proveedor",
    total_contratos AS "Total Contratos",
    contratos_vigentes AS "Vigentes",
    contratos_vencidos AS "Vencidos",
    valor_total_contratos AS "Valor Total"
FROM v_proveedor_resumen_contratos
WHERE total_contratos > 0
ORDER BY total_contratos DESC
LIMIT 10;

-- ==================================================================
-- FIN DEL SCRIPT DE CORRECCIÓN DE VISTAS
-- ==================================================================