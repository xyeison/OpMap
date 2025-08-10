-- ==================================================================
-- VERIFICAR QUE TODO SE CREÓ CORRECTAMENTE
-- ==================================================================

-- 1. Verificar que las columnas se agregaron a hospital_contracts
SELECT 
    'hospital_contracts columns' as check_item,
    COUNT(*) as columns_added
FROM information_schema.columns 
WHERE table_name = 'hospital_contracts' 
AND column_name IN (
    'indice_liquidez_requerido',
    'indice_endeudamiento_maximo', 
    'cobertura_intereses_minimo',
    'patrimonio_minimo',
    'capital_trabajo_minimo',
    'cumple_requisitos'
);

-- 2. Verificar que la tabla mi_empresa_config existe
SELECT 
    'mi_empresa_config table' as check_item,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_name = 'mi_empresa_config'
        ) THEN 'EXISTS'
        ELSE 'NOT EXISTS'
    END as status;

-- 3. Verificar datos en mi_empresa_config
SELECT 
    'mi_empresa_config data' as check_item,
    COUNT(*) as records
FROM mi_empresa_config;

-- 4. Verificar que la vista v_cumplimiento_contratos existe
SELECT 
    'v_cumplimiento_contratos view' as check_item,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.views 
            WHERE table_name = 'v_cumplimiento_contratos'
        ) THEN 'EXISTS'
        ELSE 'NOT EXISTS'
    END as status;

-- 5. Verificar funciones creadas
SELECT 
    'Functions created' as check_item,
    COUNT(*) as function_count
FROM information_schema.routines
WHERE routine_name IN (
    'calcular_indicadores_mi_empresa',
    'validar_cumplimiento_contrato',
    'validar_todos_contratos'
)
AND routine_type = 'FUNCTION';

-- 6. Verificar contratos con requisitos
SELECT 
    'Contracts with requirements' as check_item,
    COUNT(*) as contracts_count
FROM hospital_contracts
WHERE indice_liquidez_requerido IS NOT NULL
   OR indice_endeudamiento_maximo IS NOT NULL
   OR cobertura_intereses_minimo IS NOT NULL;

-- 7. Mostrar configuración de Mi Empresa si existe
SELECT 
    'Mi Empresa Config' as section,
    nombre,
    nit,
    anio_fiscal,
    indice_liquidez,
    indice_endeudamiento,
    cobertura_intereses,
    patrimonio,
    capital_trabajo
FROM mi_empresa_config
ORDER BY anio_fiscal DESC, updated_at DESC
LIMIT 1;

-- 8. Mostrar algunos contratos con requisitos
SELECT 
    'Sample contracts with requirements' as section,
    id,
    contract_number,
    indice_liquidez_requerido,
    indice_endeudamiento_maximo,
    patrimonio_minimo,
    cumple_requisitos
FROM hospital_contracts
WHERE indice_liquidez_requerido IS NOT NULL
LIMIT 5;

-- ==================================================================
-- FIN DEL SCRIPT DE VERIFICACIÓN
-- ==================================================================