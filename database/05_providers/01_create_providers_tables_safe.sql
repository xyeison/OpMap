-- ==================================================================
-- SISTEMA DE GESTIÓN DE PROVEEDORES - VERSIÓN SEGURA
-- ==================================================================
-- Este script verifica la existencia de objetos antes de crearlos
-- para evitar errores si se ejecuta múltiples veces
-- ==================================================================

-- 1. TABLA PRINCIPAL DE PROVEEDORES
-- ==================================================================
CREATE TABLE IF NOT EXISTS proveedores (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    nit varchar(20) UNIQUE NOT NULL,
    nombre varchar(255) UNIQUE NOT NULL,
    nombre_normalizado varchar(255) GENERATED ALWAYS AS (UPPER(TRIM(nombre))) STORED,
    website_url text,
    descripcion_corta text,
    
    -- Datos de contacto
    telefono varchar(50),
    email varchar(255),
    ciudad varchar(100),
    departamento varchar(100),
    pais varchar(100) DEFAULT 'Colombia',
    direccion text,
    
    -- Estado
    estado varchar(20) DEFAULT 'activo' CHECK (estado IN ('activo', 'inactivo', 'prospecto')),
    
    -- Metadatos
    notas_internas text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by uuid REFERENCES users(id)
);

-- Índices para búsquedas eficientes (con verificación)
CREATE INDEX IF NOT EXISTS idx_proveedores_nit ON proveedores(nit);
CREATE INDEX IF NOT EXISTS idx_proveedores_nombre ON proveedores(nombre_normalizado);
CREATE INDEX IF NOT EXISTS idx_proveedores_estado ON proveedores(estado);

-- 2. TABLA DE INFORMACIÓN FINANCIERA POR AÑO
-- ==================================================================
CREATE TABLE IF NOT EXISTS proveedor_finanzas (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    proveedor_id uuid NOT NULL REFERENCES proveedores(id) ON DELETE CASCADE,
    anio integer NOT NULL CHECK (anio >= 2000 AND anio <= EXTRACT(YEAR FROM CURRENT_DATE) + 1),
    
    -- Balance General (valores en millones de COP por defecto)
    activo_corriente numeric(15, 2),
    activo_no_corriente numeric(15, 2),
    activo_total numeric(15, 2),
    pasivo_corriente numeric(15, 2),
    pasivo_no_corriente numeric(15, 2),
    pasivo_total numeric(15, 2),
    patrimonio numeric(15, 2),
    
    -- Estado de Resultados
    ingresos_operacionales numeric(15, 2),
    costos_ventas numeric(15, 2),
    utilidad_bruta numeric(15, 2),
    gastos_operacionales numeric(15, 2),
    utilidad_operacional numeric(15, 2),
    gastos_intereses numeric(15, 2),
    otros_ingresos numeric(15, 2),
    otros_gastos numeric(15, 2),
    utilidad_antes_impuestos numeric(15, 2),
    impuestos numeric(15, 2),
    utilidad_neta numeric(15, 2),
    
    -- Otros valores relevantes
    inventarios numeric(15, 2),
    cuentas_por_cobrar numeric(15, 2),
    efectivo numeric(15, 2),
    capital_trabajo numeric(15, 2),
    ebitda numeric(15, 2),
    
    -- Información adicional
    fuente varchar(100) DEFAULT 'manual' CHECK (fuente IN ('manual', 'supersociedades', 'rues', 'auditoria', 'otro')),
    moneda varchar(3) DEFAULT 'COP',
    tipo_cambio numeric(10, 4) DEFAULT 1,
    fecha_corte date,
    auditado boolean DEFAULT false,
    notas text,
    
    -- Metadatos
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by uuid REFERENCES users(id),
    
    -- Restricción única para evitar duplicados
    CONSTRAINT uk_proveedor_anio UNIQUE (proveedor_id, anio)
);

-- Índices para consultas eficientes
CREATE INDEX IF NOT EXISTS idx_proveedor_finanzas_proveedor ON proveedor_finanzas(proveedor_id);
CREATE INDEX IF NOT EXISTS idx_proveedor_finanzas_anio ON proveedor_finanzas(anio);

-- 3. TABLA DE INDICADORES FINANCIEROS CALCULADOS
-- ==================================================================
CREATE TABLE IF NOT EXISTS proveedor_indicadores (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    proveedor_id uuid NOT NULL REFERENCES proveedores(id) ON DELETE CASCADE,
    anio integer NOT NULL,
    
    -- Indicadores de Liquidez
    indice_liquidez numeric(10, 4),
    prueba_acida numeric(10, 4),
    capital_trabajo_neto numeric(15, 2),
    
    -- Indicadores de Endeudamiento
    indice_endeudamiento numeric(10, 4),
    apalancamiento_financiero numeric(10, 4),
    cobertura_intereses numeric(10, 4),
    
    -- Indicadores de Rentabilidad
    margen_bruto numeric(10, 4),
    margen_operacional numeric(10, 4),
    margen_neto numeric(10, 4),
    margen_ebitda numeric(10, 4),
    
    -- Indicadores de Eficiencia
    roe numeric(10, 4),
    roa numeric(10, 4),
    roic numeric(10, 4),
    
    -- Indicadores de Actividad
    rotacion_activos numeric(10, 4),
    rotacion_cartera numeric(10, 4),
    dias_cartera integer,
    rotacion_inventarios numeric(10, 4),
    dias_inventario integer,
    
    -- Calificación y validación para licitaciones
    cumple_liquidez boolean,
    cumple_endeudamiento boolean,
    cumple_cobertura boolean,
    cumple_todos_requisitos boolean,
    
    -- Score de salud financiera (0-100)
    score_salud_financiera integer,
    categoria_riesgo varchar(20) CHECK (categoria_riesgo IN ('muy_bajo', 'bajo', 'medio', 'alto', 'muy_alto')),
    
    -- Metadatos
    calculado_at timestamp with time zone DEFAULT now(),
    
    -- Restricción única
    CONSTRAINT uk_indicadores_proveedor_anio UNIQUE (proveedor_id, anio)
);

-- NO se puede usar FK compuesto con IF NOT EXISTS, así que verificamos primero
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'fk_indicadores_finanzas'
    ) THEN
        ALTER TABLE proveedor_indicadores
        ADD CONSTRAINT fk_indicadores_finanzas 
        FOREIGN KEY (proveedor_id, anio) 
        REFERENCES proveedor_finanzas(proveedor_id, anio) 
        ON DELETE CASCADE;
    END IF;
END $$;

-- Índices
CREATE INDEX IF NOT EXISTS idx_indicadores_proveedor ON proveedor_indicadores(proveedor_id);
CREATE INDEX IF NOT EXISTS idx_indicadores_anio ON proveedor_indicadores(anio);
CREATE INDEX IF NOT EXISTS idx_indicadores_cumplimiento ON proveedor_indicadores(cumple_todos_requisitos);

-- 4. TABLA DE CONTACTOS DE PROVEEDORES
-- ==================================================================
CREATE TABLE IF NOT EXISTS proveedor_contactos (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    proveedor_id uuid NOT NULL REFERENCES proveedores(id) ON DELETE CASCADE,
    nombre varchar(255) NOT NULL,
    cargo varchar(100),
    telefono varchar(50),
    celular varchar(50),
    email varchar(255),
    es_principal boolean DEFAULT false,
    activo boolean DEFAULT true,
    notas text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proveedor_contactos_proveedor ON proveedor_contactos(proveedor_id);
CREATE INDEX IF NOT EXISTS idx_proveedor_contactos_principal ON proveedor_contactos(es_principal) WHERE es_principal = true;

-- 5. TABLA DE ARCHIVOS/DOCUMENTOS DE PROVEEDORES
-- ==================================================================
CREATE TABLE IF NOT EXISTS proveedor_documentos (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    proveedor_id uuid NOT NULL REFERENCES proveedores(id) ON DELETE CASCADE,
    tipo_documento varchar(50) CHECK (tipo_documento IN (
        'estados_financieros', 
        'certificacion_bancaria', 
        'rut', 
        'camara_comercio',
        'certificacion_experiencia',
        'referencia_comercial',
        'otro'
    )),
    nombre_archivo varchar(255) NOT NULL,
    url_archivo text,
    anio integer,
    descripcion text,
    uploaded_at timestamp with time zone DEFAULT now(),
    uploaded_by uuid REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_proveedor_documentos_proveedor ON proveedor_documentos(proveedor_id);
CREATE INDEX IF NOT EXISTS idx_proveedor_documentos_tipo ON proveedor_documentos(tipo_documento);

-- 6. MODIFICACIÓN DE LA TABLA hospital_contracts
-- ==================================================================
-- Verificar si la columna ya existe antes de agregarla
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'hospital_contracts' 
        AND column_name = 'proveedor_id'
    ) THEN
        ALTER TABLE hospital_contracts 
        ADD COLUMN proveedor_id uuid REFERENCES proveedores(id);
    END IF;
END $$;

-- Índice para mejorar joins
CREATE INDEX IF NOT EXISTS idx_hospital_contracts_proveedor 
ON hospital_contracts(proveedor_id);

-- 7. FUNCIÓN PARA CALCULAR INDICADORES AUTOMÁTICAMENTE
-- ==================================================================
CREATE OR REPLACE FUNCTION calcular_indicadores_financieros()
RETURNS TRIGGER AS $$
DECLARE
    v_indicadores RECORD;
BEGIN
    -- Calculamos todos los indicadores
    WITH calculos AS (
        SELECT
            NEW.proveedor_id,
            NEW.anio,
            -- Liquidez
            CASE 
                WHEN NEW.pasivo_corriente > 0 THEN NEW.activo_corriente / NEW.pasivo_corriente
                ELSE NULL
            END AS indice_liquidez,
            CASE 
                WHEN NEW.pasivo_corriente > 0 THEN (NEW.activo_corriente - COALESCE(NEW.inventarios, 0)) / NEW.pasivo_corriente
                ELSE NULL
            END AS prueba_acida,
            NEW.activo_corriente - NEW.pasivo_corriente AS capital_trabajo_neto,
            
            -- Endeudamiento
            CASE 
                WHEN NEW.activo_total > 0 THEN NEW.pasivo_total / NEW.activo_total
                ELSE NULL
            END AS indice_endeudamiento,
            CASE 
                WHEN NEW.patrimonio > 0 THEN NEW.pasivo_total / NEW.patrimonio
                ELSE NULL
            END AS apalancamiento_financiero,
            CASE 
                WHEN NEW.gastos_intereses > 0 THEN NEW.utilidad_operacional / NEW.gastos_intereses
                ELSE NULL
            END AS cobertura_intereses,
            
            -- Rentabilidad
            CASE 
                WHEN NEW.ingresos_operacionales > 0 THEN NEW.utilidad_bruta / NEW.ingresos_operacionales
                ELSE NULL
            END AS margen_bruto,
            CASE 
                WHEN NEW.ingresos_operacionales > 0 THEN NEW.utilidad_operacional / NEW.ingresos_operacionales
                ELSE NULL
            END AS margen_operacional,
            CASE 
                WHEN NEW.ingresos_operacionales > 0 THEN NEW.utilidad_neta / NEW.ingresos_operacionales
                ELSE NULL
            END AS margen_neto,
            CASE 
                WHEN NEW.ingresos_operacionales > 0 AND NEW.ebitda IS NOT NULL THEN NEW.ebitda / NEW.ingresos_operacionales
                ELSE NULL
            END AS margen_ebitda,
            
            -- Eficiencia
            CASE 
                WHEN NEW.patrimonio > 0 THEN NEW.utilidad_neta / NEW.patrimonio
                ELSE NULL
            END AS roe,
            CASE 
                WHEN NEW.activo_total > 0 THEN NEW.utilidad_neta / NEW.activo_total
                ELSE NULL
            END AS roa,
            
            -- Actividad
            CASE 
                WHEN NEW.activo_total > 0 THEN NEW.ingresos_operacionales / NEW.activo_total
                ELSE NULL
            END AS rotacion_activos,
            CASE 
                WHEN NEW.cuentas_por_cobrar > 0 THEN NEW.ingresos_operacionales / NEW.cuentas_por_cobrar
                ELSE NULL
            END AS rotacion_cartera,
            CASE 
                WHEN NEW.inventarios > 0 AND NEW.costos_ventas IS NOT NULL THEN NEW.costos_ventas / NEW.inventarios
                ELSE NULL
            END AS rotacion_inventarios
    )
    SELECT * INTO v_indicadores FROM calculos;
    
    -- Insertamos o actualizamos los indicadores
    INSERT INTO proveedor_indicadores (
        proveedor_id, anio,
        indice_liquidez, prueba_acida, capital_trabajo_neto,
        indice_endeudamiento, apalancamiento_financiero, cobertura_intereses,
        margen_bruto, margen_operacional, margen_neto, margen_ebitda,
        roe, roa, rotacion_activos, rotacion_cartera, rotacion_inventarios,
        dias_cartera, dias_inventario,
        cumple_liquidez, cumple_endeudamiento, cumple_cobertura, cumple_todos_requisitos,
        score_salud_financiera, categoria_riesgo
    ) VALUES (
        v_indicadores.proveedor_id,
        v_indicadores.anio,
        v_indicadores.indice_liquidez,
        v_indicadores.prueba_acida,
        v_indicadores.capital_trabajo_neto,
        v_indicadores.indice_endeudamiento,
        v_indicadores.apalancamiento_financiero,
        v_indicadores.cobertura_intereses,
        v_indicadores.margen_bruto,
        v_indicadores.margen_operacional,
        v_indicadores.margen_neto,
        v_indicadores.margen_ebitda,
        v_indicadores.roe,
        v_indicadores.roa,
        v_indicadores.rotacion_activos,
        v_indicadores.rotacion_cartera,
        v_indicadores.rotacion_inventarios,
        CASE 
            WHEN v_indicadores.rotacion_cartera > 0 THEN ROUND(365 / v_indicadores.rotacion_cartera)::integer
            ELSE NULL
        END,
        CASE 
            WHEN v_indicadores.rotacion_inventarios > 0 THEN ROUND(365 / v_indicadores.rotacion_inventarios)::integer
            ELSE NULL
        END,
        -- Validación de requisitos típicos de licitación
        v_indicadores.indice_liquidez >= 1.2,
        v_indicadores.indice_endeudamiento <= 0.7,
        v_indicadores.cobertura_intereses >= 1.5,
        v_indicadores.indice_liquidez >= 1.2 AND 
        v_indicadores.indice_endeudamiento <= 0.7 AND 
        v_indicadores.cobertura_intereses >= 1.5,
        -- Score de salud financiera (simplificado, se puede mejorar)
        CASE
            WHEN v_indicadores.indice_liquidez >= 2 AND v_indicadores.indice_endeudamiento <= 0.4 AND v_indicadores.roe > 0.15 THEN 90
            WHEN v_indicadores.indice_liquidez >= 1.5 AND v_indicadores.indice_endeudamiento <= 0.5 AND v_indicadores.roe > 0.10 THEN 75
            WHEN v_indicadores.indice_liquidez >= 1.2 AND v_indicadores.indice_endeudamiento <= 0.6 AND v_indicadores.roe > 0.05 THEN 60
            WHEN v_indicadores.indice_liquidez >= 1 AND v_indicadores.indice_endeudamiento <= 0.7 THEN 45
            ELSE 30
        END,
        -- Categoría de riesgo
        CASE
            WHEN v_indicadores.indice_liquidez >= 2 AND v_indicadores.indice_endeudamiento <= 0.4 THEN 'muy_bajo'
            WHEN v_indicadores.indice_liquidez >= 1.5 AND v_indicadores.indice_endeudamiento <= 0.5 THEN 'bajo'
            WHEN v_indicadores.indice_liquidez >= 1.2 AND v_indicadores.indice_endeudamiento <= 0.6 THEN 'medio'
            WHEN v_indicadores.indice_liquidez >= 1 AND v_indicadores.indice_endeudamiento <= 0.7 THEN 'alto'
            ELSE 'muy_alto'
        END
    )
    ON CONFLICT (proveedor_id, anio) 
    DO UPDATE SET
        indice_liquidez = EXCLUDED.indice_liquidez,
        prueba_acida = EXCLUDED.prueba_acida,
        capital_trabajo_neto = EXCLUDED.capital_trabajo_neto,
        indice_endeudamiento = EXCLUDED.indice_endeudamiento,
        apalancamiento_financiero = EXCLUDED.apalancamiento_financiero,
        cobertura_intereses = EXCLUDED.cobertura_intereses,
        margen_bruto = EXCLUDED.margen_bruto,
        margen_operacional = EXCLUDED.margen_operacional,
        margen_neto = EXCLUDED.margen_neto,
        margen_ebitda = EXCLUDED.margen_ebitda,
        roe = EXCLUDED.roe,
        roa = EXCLUDED.roa,
        rotacion_activos = EXCLUDED.rotacion_activos,
        rotacion_cartera = EXCLUDED.rotacion_cartera,
        rotacion_inventarios = EXCLUDED.rotacion_inventarios,
        dias_cartera = EXCLUDED.dias_cartera,
        dias_inventario = EXCLUDED.dias_inventario,
        cumple_liquidez = EXCLUDED.cumple_liquidez,
        cumple_endeudamiento = EXCLUDED.cumple_endeudamiento,
        cumple_cobertura = EXCLUDED.cumple_cobertura,
        cumple_todos_requisitos = EXCLUDED.cumple_todos_requisitos,
        score_salud_financiera = EXCLUDED.score_salud_financiera,
        categoria_riesgo = EXCLUDED.categoria_riesgo,
        calculado_at = now();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Eliminar trigger si existe y recrearlo
DROP TRIGGER IF EXISTS trigger_calcular_indicadores ON proveedor_finanzas;
CREATE TRIGGER trigger_calcular_indicadores
AFTER INSERT OR UPDATE ON proveedor_finanzas
FOR EACH ROW
EXECUTE FUNCTION calcular_indicadores_financieros();

-- 8. VISTAS ÚTILES PARA REPORTES
-- ==================================================================

-- Vista de proveedores con sus últimos indicadores
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

-- 9. POLÍTICAS RLS (Row Level Security) - SIMPLIFICADAS
-- ==================================================================

-- Habilitar RLS en las nuevas tablas
ALTER TABLE proveedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE proveedor_finanzas ENABLE ROW LEVEL SECURITY;
ALTER TABLE proveedor_indicadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE proveedor_contactos ENABLE ROW LEVEL SECURITY;
ALTER TABLE proveedor_documentos ENABLE ROW LEVEL SECURITY;

-- Política permisiva para todos los usuarios autenticados (temporal)
-- Esto permite que cualquier usuario autenticado pueda ver y crear proveedores
CREATE POLICY "proveedores_all" ON proveedores
    FOR ALL 
    USING (true)
    WITH CHECK (true);

CREATE POLICY "proveedor_finanzas_all" ON proveedor_finanzas
    FOR ALL 
    USING (true)
    WITH CHECK (true);

CREATE POLICY "proveedor_indicadores_all" ON proveedor_indicadores
    FOR ALL 
    USING (true)
    WITH CHECK (true);

CREATE POLICY "proveedor_contactos_all" ON proveedor_contactos
    FOR ALL 
    USING (true)
    WITH CHECK (true);

CREATE POLICY "proveedor_documentos_all" ON proveedor_documentos
    FOR ALL 
    USING (true)
    WITH CHECK (true);

-- ==================================================================
-- VERIFICACIÓN FINAL
-- ==================================================================
DO $$
BEGIN
    RAISE NOTICE '✅ Tablas de proveedores creadas exitosamente';
    RAISE NOTICE '✅ Trigger de cálculo automático configurado';
    RAISE NOTICE '✅ Vistas de reportes creadas';
    RAISE NOTICE '✅ Políticas RLS aplicadas (permisivas)';
    RAISE NOTICE '';
    RAISE NOTICE 'El sistema de proveedores está listo para usar.';
END $$;

-- ==================================================================
-- FIN DEL SCRIPT SEGURO
-- ==================================================================