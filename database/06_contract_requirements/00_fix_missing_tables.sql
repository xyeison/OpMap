-- ==================================================================
-- CREAR SOLO LO QUE FALTA - SCRIPT DE REPARACIÓN
-- ==================================================================

-- 1. VERIFICAR Y AGREGAR CAMPOS A hospital_contracts SI NO EXISTEN
-- ==================================================================
DO $$
BEGIN
    -- Verificar cada columna individualmente
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'hospital_contracts' 
                   AND column_name = 'requisitos_financieros') THEN
        ALTER TABLE hospital_contracts ADD COLUMN requisitos_financieros jsonb DEFAULT '{}'::jsonb;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'hospital_contracts' 
                   AND column_name = 'indice_liquidez_requerido') THEN
        ALTER TABLE hospital_contracts ADD COLUMN indice_liquidez_requerido numeric(10,2);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'hospital_contracts' 
                   AND column_name = 'indice_endeudamiento_maximo') THEN
        ALTER TABLE hospital_contracts ADD COLUMN indice_endeudamiento_maximo numeric(10,2);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'hospital_contracts' 
                   AND column_name = 'cobertura_intereses_minimo') THEN
        ALTER TABLE hospital_contracts ADD COLUMN cobertura_intereses_minimo numeric(10,2);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'hospital_contracts' 
                   AND column_name = 'patrimonio_minimo') THEN
        ALTER TABLE hospital_contracts ADD COLUMN patrimonio_minimo numeric(15,2);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'hospital_contracts' 
                   AND column_name = 'capital_trabajo_minimo') THEN
        ALTER TABLE hospital_contracts ADD COLUMN capital_trabajo_minimo numeric(15,2);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'hospital_contracts' 
                   AND column_name = 'experiencia_anos_minimo') THEN
        ALTER TABLE hospital_contracts ADD COLUMN experiencia_anos_minimo integer;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'hospital_contracts' 
                   AND column_name = 'facturacion_anual_minima') THEN
        ALTER TABLE hospital_contracts ADD COLUMN facturacion_anual_minima numeric(15,2);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'hospital_contracts' 
                   AND column_name = 'rentabilidad_minima') THEN
        ALTER TABLE hospital_contracts ADD COLUMN rentabilidad_minima numeric(10,2);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'hospital_contracts' 
                   AND column_name = 'otros_requisitos') THEN
        ALTER TABLE hospital_contracts ADD COLUMN otros_requisitos text;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'hospital_contracts' 
                   AND column_name = 'cumple_requisitos') THEN
        ALTER TABLE hospital_contracts ADD COLUMN cumple_requisitos boolean;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'hospital_contracts' 
                   AND column_name = 'fecha_validacion_requisitos') THEN
        ALTER TABLE hospital_contracts ADD COLUMN fecha_validacion_requisitos timestamp with time zone;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'hospital_contracts' 
                   AND column_name = 'notas_cumplimiento') THEN
        ALTER TABLE hospital_contracts ADD COLUMN notas_cumplimiento text;
    END IF;
    
    RAISE NOTICE 'Campos de hospital_contracts verificados/agregados';
END $$;

-- 2. CREAR TABLA mi_empresa_config SI NO EXISTE
-- ==================================================================
CREATE TABLE IF NOT EXISTS mi_empresa_config (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    nombre varchar(255) NOT NULL DEFAULT 'Mi Empresa',
    nit varchar(50),
    
    -- Datos financieros actuales
    anio_fiscal integer NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
    activo_corriente numeric(15,2),
    activo_total numeric(15,2),
    pasivo_corriente numeric(15,2),
    pasivo_total numeric(15,2),
    patrimonio numeric(15,2),
    capital_trabajo numeric(15,2),
    ingresos_anuales numeric(15,2),
    utilidad_neta numeric(15,2),
    gastos_intereses numeric(15,2),
    utilidad_operacional numeric(15,2),
    
    -- Indicadores calculados
    indice_liquidez numeric(10,3),
    indice_endeudamiento numeric(10,3),
    cobertura_intereses numeric(10,3),
    roe numeric(10,3),
    margen_neto numeric(10,3),
    
    -- Otros datos
    anos_experiencia integer,
    certificaciones text[],
    
    -- Metadata
    actualizado_por uuid REFERENCES users(id),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Crear índice si no existe
CREATE INDEX IF NOT EXISTS idx_mi_empresa_anio ON mi_empresa_config(anio_fiscal);

-- Habilitar RLS
ALTER TABLE mi_empresa_config ENABLE ROW LEVEL SECURITY;

-- Crear políticas RLS si no existen
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'mi_empresa_config' 
        AND policyname = 'mi_empresa_read_all'
    ) THEN
        CREATE POLICY "mi_empresa_read_all" ON mi_empresa_config
            FOR SELECT
            USING (true);
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'mi_empresa_config' 
        AND policyname = 'mi_empresa_write_authenticated'
    ) THEN
        CREATE POLICY "mi_empresa_write_authenticated" ON mi_empresa_config
            FOR ALL
            USING (auth.role() = 'authenticated' OR auth.role() = 'service_role')
            WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');
    END IF;
END $$;

-- 3. CREAR FUNCIÓN PARA ACTUALIZAR INDICADORES
-- ==================================================================
CREATE OR REPLACE FUNCTION calcular_indicadores_mi_empresa()
RETURNS TRIGGER AS $$
BEGIN
    -- Calcular capital de trabajo
    NEW.capital_trabajo = COALESCE(NEW.activo_corriente, 0) - COALESCE(NEW.pasivo_corriente, 0);
    
    -- Calcular índice de liquidez
    IF NEW.pasivo_corriente IS NOT NULL AND NEW.pasivo_corriente > 0 THEN
        NEW.indice_liquidez = NEW.activo_corriente / NEW.pasivo_corriente;
    END IF;
    
    -- Calcular índice de endeudamiento
    IF NEW.activo_total IS NOT NULL AND NEW.activo_total > 0 THEN
        NEW.indice_endeudamiento = COALESCE(NEW.pasivo_total, 0) / NEW.activo_total;
    END IF;
    
    -- Calcular cobertura de intereses
    IF NEW.gastos_intereses IS NOT NULL AND NEW.gastos_intereses > 0 THEN
        NEW.cobertura_intereses = COALESCE(NEW.utilidad_operacional, 0) / NEW.gastos_intereses;
    END IF;
    
    -- Calcular ROE
    IF NEW.patrimonio IS NOT NULL AND NEW.patrimonio > 0 THEN
        NEW.roe = COALESCE(NEW.utilidad_neta, 0) / NEW.patrimonio;
    END IF;
    
    -- Calcular margen neto
    IF NEW.ingresos_anuales IS NOT NULL AND NEW.ingresos_anuales > 0 THEN
        NEW.margen_neto = COALESCE(NEW.utilidad_neta, 0) / NEW.ingresos_anuales;
    END IF;
    
    NEW.updated_at = now();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger
DROP TRIGGER IF EXISTS trigger_calcular_indicadores_mi_empresa ON mi_empresa_config;
CREATE TRIGGER trigger_calcular_indicadores_mi_empresa
    BEFORE INSERT OR UPDATE ON mi_empresa_config
    FOR EACH ROW
    EXECUTE FUNCTION calcular_indicadores_mi_empresa();

-- 4. CREAR FUNCIÓN DE VALIDACIÓN DE CUMPLIMIENTO
-- ==================================================================
CREATE OR REPLACE FUNCTION validar_cumplimiento_contrato(p_contract_id uuid)
RETURNS jsonb AS $$
DECLARE
    v_contract RECORD;
    v_mi_empresa RECORD;
    v_resultado jsonb;
    v_cumple_todos boolean := true;
    v_detalles jsonb := '[]'::jsonb;
BEGIN
    -- Obtener datos del contrato
    SELECT * INTO v_contract
    FROM hospital_contracts
    WHERE id = p_contract_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'error', 'Contrato no encontrado',
            'cumple', false
        );
    END IF;
    
    -- Obtener datos de mi empresa (más reciente)
    SELECT * INTO v_mi_empresa
    FROM mi_empresa_config
    ORDER BY anio_fiscal DESC, updated_at DESC
    LIMIT 1;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'error', 'No hay configuración de mi empresa',
            'cumple', false
        );
    END IF;
    
    -- Validar índice de liquidez
    IF v_contract.indice_liquidez_requerido IS NOT NULL THEN
        IF v_mi_empresa.indice_liquidez IS NULL OR 
           v_mi_empresa.indice_liquidez < v_contract.indice_liquidez_requerido THEN
            v_cumple_todos := false;
            v_detalles := v_detalles || jsonb_build_object(
                'requisito', 'Índice de Liquidez',
                'requerido', v_contract.indice_liquidez_requerido,
                'actual', COALESCE(v_mi_empresa.indice_liquidez, 0),
                'cumple', false
            );
        ELSE
            v_detalles := v_detalles || jsonb_build_object(
                'requisito', 'Índice de Liquidez',
                'requerido', v_contract.indice_liquidez_requerido,
                'actual', v_mi_empresa.indice_liquidez,
                'cumple', true
            );
        END IF;
    END IF;
    
    -- Validar índice de endeudamiento
    IF v_contract.indice_endeudamiento_maximo IS NOT NULL THEN
        IF v_mi_empresa.indice_endeudamiento IS NULL OR 
           v_mi_empresa.indice_endeudamiento > v_contract.indice_endeudamiento_maximo THEN
            v_cumple_todos := false;
            v_detalles := v_detalles || jsonb_build_object(
                'requisito', 'Índice de Endeudamiento',
                'maximo', v_contract.indice_endeudamiento_maximo,
                'actual', COALESCE(v_mi_empresa.indice_endeudamiento, 0),
                'cumple', false
            );
        ELSE
            v_detalles := v_detalles || jsonb_build_object(
                'requisito', 'Índice de Endeudamiento',
                'maximo', v_contract.indice_endeudamiento_maximo,
                'actual', v_mi_empresa.indice_endeudamiento,
                'cumple', true
            );
        END IF;
    END IF;
    
    -- Validar cobertura de intereses
    IF v_contract.cobertura_intereses_minimo IS NOT NULL THEN
        IF v_mi_empresa.cobertura_intereses IS NULL OR 
           v_mi_empresa.cobertura_intereses < v_contract.cobertura_intereses_minimo THEN
            v_cumple_todos := false;
            v_detalles := v_detalles || jsonb_build_object(
                'requisito', 'Cobertura de Intereses',
                'minimo', v_contract.cobertura_intereses_minimo,
                'actual', COALESCE(v_mi_empresa.cobertura_intereses, 0),
                'cumple', false
            );
        ELSE
            v_detalles := v_detalles || jsonb_build_object(
                'requisito', 'Cobertura de Intereses',
                'minimo', v_contract.cobertura_intereses_minimo,
                'actual', v_mi_empresa.cobertura_intereses,
                'cumple', true
            );
        END IF;
    END IF;
    
    -- Validar patrimonio mínimo
    IF v_contract.patrimonio_minimo IS NOT NULL THEN
        IF v_mi_empresa.patrimonio IS NULL OR 
           v_mi_empresa.patrimonio < v_contract.patrimonio_minimo THEN
            v_cumple_todos := false;
            v_detalles := v_detalles || jsonb_build_object(
                'requisito', 'Patrimonio Mínimo',
                'minimo', v_contract.patrimonio_minimo,
                'actual', COALESCE(v_mi_empresa.patrimonio, 0),
                'cumple', false
            );
        ELSE
            v_detalles := v_detalles || jsonb_build_object(
                'requisito', 'Patrimonio Mínimo',
                'minimo', v_contract.patrimonio_minimo,
                'actual', v_mi_empresa.patrimonio,
                'cumple', true
            );
        END IF;
    END IF;
    
    -- Validar capital de trabajo
    IF v_contract.capital_trabajo_minimo IS NOT NULL THEN
        IF v_mi_empresa.capital_trabajo IS NULL OR 
           v_mi_empresa.capital_trabajo < v_contract.capital_trabajo_minimo THEN
            v_cumple_todos := false;
            v_detalles := v_detalles || jsonb_build_object(
                'requisito', 'Capital de Trabajo',
                'minimo', v_contract.capital_trabajo_minimo,
                'actual', COALESCE(v_mi_empresa.capital_trabajo, 0),
                'cumple', false
            );
        ELSE
            v_detalles := v_detalles || jsonb_build_object(
                'requisito', 'Capital de Trabajo',
                'minimo', v_contract.capital_trabajo_minimo,
                'actual', v_mi_empresa.capital_trabajo,
                'cumple', true
            );
        END IF;
    END IF;
    
    -- Actualizar el contrato con el resultado
    UPDATE hospital_contracts
    SET cumple_requisitos = v_cumple_todos,
        fecha_validacion_requisitos = now()
    WHERE id = p_contract_id;
    
    -- Construir resultado
    v_resultado := jsonb_build_object(
        'cumple', v_cumple_todos,
        'fecha_validacion', now(),
        'mi_empresa', jsonb_build_object(
            'nombre', v_mi_empresa.nombre,
            'anio_fiscal', v_mi_empresa.anio_fiscal,
            'indice_liquidez', v_mi_empresa.indice_liquidez,
            'indice_endeudamiento', v_mi_empresa.indice_endeudamiento,
            'cobertura_intereses', v_mi_empresa.cobertura_intereses,
            'patrimonio', v_mi_empresa.patrimonio,
            'capital_trabajo', v_mi_empresa.capital_trabajo
        ),
        'detalles', v_detalles
    );
    
    RETURN v_resultado;
END;
$$ LANGUAGE plpgsql;

-- 5. CREAR VISTA DE CUMPLIMIENTO
-- ==================================================================
CREATE OR REPLACE VIEW v_cumplimiento_contratos AS
WITH mi_empresa_actual AS (
    SELECT *
    FROM mi_empresa_config
    ORDER BY anio_fiscal DESC, updated_at DESC
    LIMIT 1
)
SELECT 
    hc.id,
    hc.contract_number,
    hc.contract_value,
    h.name AS hospital_name,
    h.municipality_name,
    h.department_name,
    
    -- Requisitos
    hc.indice_liquidez_requerido,
    hc.indice_endeudamiento_maximo,
    hc.cobertura_intereses_minimo,
    hc.patrimonio_minimo,
    hc.capital_trabajo_minimo,
    
    -- Valores actuales de mi empresa
    me.indice_liquidez AS mi_indice_liquidez,
    me.indice_endeudamiento AS mi_indice_endeudamiento,
    me.cobertura_intereses AS mi_cobertura_intereses,
    me.patrimonio AS mi_patrimonio,
    me.capital_trabajo AS mi_capital_trabajo,
    
    -- Cumplimiento individual
    CASE 
        WHEN hc.indice_liquidez_requerido IS NULL THEN NULL
        WHEN me.indice_liquidez IS NULL THEN false
        ELSE me.indice_liquidez >= hc.indice_liquidez_requerido
    END AS cumple_liquidez,
    
    CASE 
        WHEN hc.indice_endeudamiento_maximo IS NULL THEN NULL
        WHEN me.indice_endeudamiento IS NULL THEN false
        ELSE me.indice_endeudamiento <= hc.indice_endeudamiento_maximo
    END AS cumple_endeudamiento,
    
    CASE 
        WHEN hc.cobertura_intereses_minimo IS NULL THEN NULL
        WHEN me.cobertura_intereses IS NULL THEN false
        ELSE me.cobertura_intereses >= hc.cobertura_intereses_minimo
    END AS cumple_cobertura,
    
    CASE 
        WHEN hc.patrimonio_minimo IS NULL THEN NULL
        WHEN me.patrimonio IS NULL THEN false
        ELSE me.patrimonio >= hc.patrimonio_minimo
    END AS cumple_patrimonio,
    
    CASE 
        WHEN hc.capital_trabajo_minimo IS NULL THEN NULL
        WHEN me.capital_trabajo IS NULL THEN false
        ELSE me.capital_trabajo >= hc.capital_trabajo_minimo
    END AS cumple_capital_trabajo,
    
    -- Cumplimiento general
    hc.cumple_requisitos,
    hc.fecha_validacion_requisitos,
    hc.notas_cumplimiento,
    
    -- Datos del contrato
    hc.start_date,
    hc.end_date,
    hc.active,
    
    -- Prioridad por valor y fecha
    CASE 
        WHEN hc.end_date >= CURRENT_DATE THEN 1
        WHEN hc.end_date >= CURRENT_DATE - INTERVAL '90 days' THEN 2
        ELSE 3
    END AS prioridad_temporal,
    
    hc.contract_value AS valor_oportunidad
    
FROM hospital_contracts hc
LEFT JOIN hospitals h ON h.id = hc.hospital_id
CROSS JOIN mi_empresa_actual me
WHERE hc.active = true
ORDER BY prioridad_temporal, hc.contract_value DESC NULLS LAST;

-- 6. CREAR FUNCIÓN PARA VALIDAR TODOS LOS CONTRATOS
-- ==================================================================
CREATE OR REPLACE FUNCTION validar_todos_contratos()
RETURNS jsonb AS $$
DECLARE
    v_contract RECORD;
    v_result jsonb;
    v_count_validated integer := 0;
    v_count_cumple integer := 0;
    v_count_no_cumple integer := 0;
    v_errors jsonb := '[]'::jsonb;
BEGIN
    -- Iterate through all active contracts
    FOR v_contract IN 
        SELECT id 
        FROM hospital_contracts 
        WHERE active = true
    LOOP
        BEGIN
            -- Validate each contract
            SELECT validar_cumplimiento_contrato(v_contract.id) INTO v_result;
            
            v_count_validated := v_count_validated + 1;
            
            IF (v_result->>'cumple')::boolean = true THEN
                v_count_cumple := v_count_cumple + 1;
            ELSE
                v_count_no_cumple := v_count_no_cumple + 1;
            END IF;
            
        EXCEPTION WHEN OTHERS THEN
            -- Log error but continue with other contracts
            v_errors := v_errors || jsonb_build_object(
                'contract_id', v_contract.id,
                'error', SQLERRM
            );
        END;
    END LOOP;
    
    -- Return summary
    RETURN jsonb_build_object(
        'validated', v_count_validated,
        'cumple', v_count_cumple,
        'no_cumple', v_count_no_cumple,
        'errors', v_errors,
        'timestamp', now()
    );
END;
$$ LANGUAGE plpgsql;

-- 7. INSERTAR DATOS DE EJEMPLO EN MI_EMPRESA_CONFIG
-- ==================================================================
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
) ON CONFLICT DO NOTHING;

-- 8. MENSAJE FINAL
-- ==================================================================
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ SISTEMA DE REQUISITOS REPARADO';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Componentes creados/verificados:';
    RAISE NOTICE '1. Campos de requisitos en hospital_contracts';
    RAISE NOTICE '2. Tabla mi_empresa_config';
    RAISE NOTICE '3. Funciones de cálculo y validación';
    RAISE NOTICE '4. Vista v_cumplimiento_contratos';
    RAISE NOTICE '5. Datos de ejemplo insertados';
    RAISE NOTICE '';
    RAISE NOTICE 'Ahora puedes ejecutar los scripts de verificación';
    RAISE NOTICE '';
END $$;

-- ==================================================================
-- FIN DEL SCRIPT DE REPARACIÓN
-- ==================================================================