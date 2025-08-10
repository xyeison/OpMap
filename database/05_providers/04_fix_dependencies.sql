-- ==================================================================
-- SCRIPT PARA RESOLVER DEPENDENCIAS Y ELIMINAR tipo_empresa
-- ==================================================================
-- Este script elimina las vistas dependientes, quita las columnas
-- innecesarias y recrea las vistas sin esas columnas
-- ==================================================================

-- 1. ELIMINAR VISTAS QUE DEPENDEN DE tipo_empresa
-- ==================================================================
DROP VIEW IF EXISTS v_competencia_hospitales CASCADE;
DROP VIEW IF EXISTS v_ranking_proveedores CASCADE;
DROP VIEW IF EXISTS v_proveedores_ultimos_indicadores CASCADE;

-- 2. ELIMINAR COLUMNAS INNECESARIAS
-- ==================================================================
DO $$
BEGIN
    -- Eliminar tipo_empresa si existe
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'proveedores' 
        AND column_name = 'tipo_empresa'
    ) THEN
        ALTER TABLE proveedores DROP COLUMN tipo_empresa CASCADE;
        RAISE NOTICE '✅ Columna tipo_empresa eliminada';
    ELSE
        RAISE NOTICE 'ℹ️  Columna tipo_empresa no existe';
    END IF;
    
    -- Eliminar tamano_empresa si existe
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'proveedores' 
        AND column_name = 'tamano_empresa'
    ) THEN
        ALTER TABLE proveedores DROP COLUMN tamano_empresa CASCADE;
        RAISE NOTICE '✅ Columna tamano_empresa eliminada';
    ELSE
        RAISE NOTICE 'ℹ️  Columna tamano_empresa no existe';
    END IF;
END $$;

-- 3. RECREAR VISTA v_proveedores_ultimos_indicadores (sin tipo_empresa)
-- ==================================================================
CREATE OR REPLACE VIEW v_proveedores_ultimos_indicadores AS
SELECT 
    p.*,
    f.anio AS ultimo_anio_financiero,
    i.indice_liquidez,
    i.indice_endeudamiento,
    i.cobertura_intereses,
    i.margen_operacional,
    i.margen_neto,
    i.roe,
    i.roa,
    i.cumple_todos_requisitos,
    i.score_salud_financiera,
    i.categoria_riesgo,
    f.ingresos_operacionales AS ultimos_ingresos,
    f.activo_total AS ultimo_activo_total,
    f.patrimonio AS ultimo_patrimonio
FROM proveedores p
LEFT JOIN LATERAL (
    SELECT * FROM proveedor_finanzas pf
    WHERE pf.proveedor_id = p.id
    ORDER BY pf.anio DESC
    LIMIT 1
) f ON true
LEFT JOIN proveedor_indicadores i ON i.proveedor_id = p.id AND i.anio = f.anio;

COMMENT ON VIEW v_proveedores_ultimos_indicadores IS 
'Vista de proveedores con sus últimos indicadores financieros';

-- 4. RECREAR VISTA v_competencia_hospitales (sin tipo_empresa)
-- ==================================================================
CREATE OR REPLACE VIEW v_competencia_hospitales AS
SELECT 
    h.id AS hospital_id,
    h.name AS hospital_nombre,
    h.municipality_name,
    h.department_name,
    hc.proveedor_id,
    p.nombre AS proveedor_nombre,
    hc.contract_value,
    hc.start_date,
    hc.end_date,
    CASE 
        WHEN hc.end_date >= CURRENT_DATE THEN true
        ELSE false
    END AS contrato_activo,
    CASE 
        WHEN hc.end_date < CURRENT_DATE THEN 'vencido'
        WHEN hc.end_date <= CURRENT_DATE + INTERVAL '90 days' THEN 'por_vencer'
        ELSE 'vigente'
    END AS estado_contrato
FROM hospitals h
LEFT JOIN hospital_contracts hc ON hc.hospital_id = h.id
LEFT JOIN proveedores p ON p.id = hc.proveedor_id
WHERE h.active = true
ORDER BY h.department_name, h.municipality_name, h.name;

COMMENT ON VIEW v_competencia_hospitales IS 
'Vista de hospitales con información de contratos y proveedores actuales';

-- 5. RECREAR VISTA v_ranking_proveedores (sin tipo_empresa)
-- ==================================================================
CREATE OR REPLACE VIEW v_ranking_proveedores AS
WITH ultimos_datos AS (
    SELECT 
        p.id,
        p.nombre,
        p.estado,
        f.anio,
        f.ingresos_operacionales,
        f.activo_total,
        f.patrimonio,
        i.score_salud_financiera,
        i.categoria_riesgo
    FROM proveedores p
    LEFT JOIN LATERAL (
        SELECT * FROM proveedor_finanzas pf
        WHERE pf.proveedor_id = p.id
        ORDER BY pf.anio DESC
        LIMIT 1
    ) f ON true
    LEFT JOIN proveedor_indicadores i ON i.proveedor_id = p.id AND i.anio = f.anio
),
contratos_stats AS (
    SELECT 
        proveedor_id,
        COUNT(DISTINCT hospital_id) AS hospitales_atendidos,
        COUNT(*) AS total_contratos,
        SUM(contract_value) AS valor_total_contratos
    FROM hospital_contracts
    WHERE proveedor_id IS NOT NULL
    GROUP BY proveedor_id
)
SELECT 
    ud.id,
    ud.nombre,
    ud.estado,
    ud.anio,
    ud.ingresos_operacionales,
    ud.activo_total,
    ud.patrimonio,
    ud.score_salud_financiera,
    ud.categoria_riesgo,
    COALESCE(cs.hospitales_atendidos, 0) AS hospitales_atendidos,
    COALESCE(cs.total_contratos, 0) AS total_contratos,
    COALESCE(cs.valor_total_contratos, 0) AS valor_total_contratos,
    RANK() OVER (ORDER BY ud.ingresos_operacionales DESC NULLS LAST) AS ranking_ingresos,
    RANK() OVER (ORDER BY ud.patrimonio DESC NULLS LAST) AS ranking_patrimonio,
    RANK() OVER (ORDER BY cs.valor_total_contratos DESC NULLS LAST) AS ranking_contratos
FROM ultimos_datos ud
LEFT JOIN contratos_stats cs ON cs.proveedor_id = ud.id
ORDER BY ud.ingresos_operacionales DESC NULLS LAST;

COMMENT ON VIEW v_ranking_proveedores IS 
'Ranking de proveedores por diferentes métricas financieras y comerciales';

-- 6. ELIMINAR Y RECREAR POLÍTICAS RLS
-- ==================================================================
-- Eliminar políticas existentes
DROP POLICY IF EXISTS "proveedores_all" ON proveedores;
DROP POLICY IF EXISTS "proveedor_finanzas_all" ON proveedor_finanzas;
DROP POLICY IF EXISTS "proveedor_indicadores_all" ON proveedor_indicadores;
DROP POLICY IF EXISTS "proveedor_contactos_all" ON proveedor_contactos;
DROP POLICY IF EXISTS "proveedor_documentos_all" ON proveedor_documentos;
DROP POLICY IF EXISTS "allow_all_proveedores" ON proveedores;
DROP POLICY IF EXISTS "allow_all_proveedor_finanzas" ON proveedor_finanzas;
DROP POLICY IF EXISTS "allow_all_proveedor_indicadores" ON proveedor_indicadores;
DROP POLICY IF EXISTS "allow_all_proveedor_contactos" ON proveedor_contactos;
DROP POLICY IF EXISTS "allow_all_proveedor_documentos" ON proveedor_documentos;

-- Habilitar RLS
ALTER TABLE proveedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE proveedor_finanzas ENABLE ROW LEVEL SECURITY;
ALTER TABLE proveedor_indicadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE proveedor_contactos ENABLE ROW LEVEL SECURITY;
ALTER TABLE proveedor_documentos ENABLE ROW LEVEL SECURITY;

-- Crear nuevas políticas públicas (acceso completo temporal)
CREATE POLICY "public_access_proveedores" ON proveedores
    FOR ALL TO PUBLIC
    USING (true)
    WITH CHECK (true);

CREATE POLICY "public_access_proveedor_finanzas" ON proveedor_finanzas
    FOR ALL TO PUBLIC
    USING (true)
    WITH CHECK (true);

CREATE POLICY "public_access_proveedor_indicadores" ON proveedor_indicadores
    FOR ALL TO PUBLIC
    USING (true)
    WITH CHECK (true);

CREATE POLICY "public_access_proveedor_contactos" ON proveedor_contactos
    FOR ALL TO PUBLIC
    USING (true)
    WITH CHECK (true);

CREATE POLICY "public_access_proveedor_documentos" ON proveedor_documentos
    FOR ALL TO PUBLIC
    USING (true)
    WITH CHECK (true);

-- 7. VERIFICACIÓN FINAL
-- ==================================================================
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'VERIFICACIÓN FINAL DEL SISTEMA';
    RAISE NOTICE '========================================';
    
    -- Verificar que las columnas fueron eliminadas
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'proveedores' 
        AND column_name IN ('tipo_empresa', 'tamano_empresa')
    ) THEN
        RAISE NOTICE '✅ Columnas innecesarias eliminadas correctamente';
    ELSE
        RAISE NOTICE '❌ Aún existen columnas que deberían haberse eliminado';
    END IF;
    
    -- Verificar vistas
    IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'v_proveedores_ultimos_indicadores') THEN
        RAISE NOTICE '✅ Vista v_proveedores_ultimos_indicadores recreada';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'v_competencia_hospitales') THEN
        RAISE NOTICE '✅ Vista v_competencia_hospitales recreada';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'v_ranking_proveedores') THEN
        RAISE NOTICE '✅ Vista v_ranking_proveedores recreada';
    END IF;
    
    -- Contar proveedores
    SELECT COUNT(*) INTO v_count FROM proveedores;
    RAISE NOTICE '✅ Total de proveedores en el sistema: %', v_count;
    
    -- Probar acceso
    BEGIN
        PERFORM * FROM proveedores LIMIT 1;
        RAISE NOTICE '✅ Acceso a tabla proveedores funcionando';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '❌ Error al acceder a proveedores: %', SQLERRM;
    END;
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'SISTEMA DE PROVEEDORES REPARADO';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'IMPORTANTE: Las políticas RLS actuales permiten';
    RAISE NOTICE 'acceso completo para facilitar el desarrollo.';
    RAISE NOTICE 'Para producción, implemente políticas más restrictivas.';
    RAISE NOTICE '';
END $$;

-- ==================================================================
-- FIN DEL SCRIPT DE REPARACIÓN DE DEPENDENCIAS
-- ==================================================================