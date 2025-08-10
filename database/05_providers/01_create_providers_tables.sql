-- ==================================================================
-- SISTEMA DE GESTIÓN DE PROVEEDORES Y ANÁLISIS FINANCIERO
-- ==================================================================
-- Este script crea las tablas necesarias para gestionar proveedores,
-- sus estados financieros e indicadores calculados automáticamente
-- para licitaciones y análisis estratégico.
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
    
    -- Estado y clasificación
    estado varchar(20) DEFAULT 'activo' CHECK (estado IN ('activo', 'inactivo', 'prospecto')),
    tipo_empresa varchar(50) CHECK (tipo_empresa IN ('competidor', 'cliente_potencial', 'proveedor_nuestro', 'otro')),
    tamano_empresa varchar(20) CHECK (tamano_empresa IN ('micro', 'pequena', 'mediana', 'grande')),
    
    -- Metadatos
    notas_internas text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by uuid REFERENCES users(id)
);

-- Índices para búsquedas eficientes
CREATE INDEX idx_proveedores_nit ON proveedores(nit);
CREATE INDEX idx_proveedores_nombre ON proveedores(nombre_normalizado);
CREATE INDEX idx_proveedores_estado ON proveedores(estado);
CREATE INDEX idx_proveedores_tipo ON proveedores(tipo_empresa);

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
CREATE INDEX idx_proveedor_finanzas_proveedor ON proveedor_finanzas(proveedor_id);
CREATE INDEX idx_proveedor_finanzas_anio ON proveedor_finanzas(anio);

-- 3. TABLA DE INDICADORES FINANCIEROS CALCULADOS
-- ==================================================================
CREATE TABLE IF NOT EXISTS proveedor_indicadores (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    proveedor_id uuid NOT NULL REFERENCES proveedores(id) ON DELETE CASCADE,
    anio integer NOT NULL,
    
    -- Indicadores de Liquidez
    indice_liquidez numeric(10, 4),               -- Activo Corriente / Pasivo Corriente
    prueba_acida numeric(10, 4),                  -- (Activo Corriente - Inventarios) / Pasivo Corriente
    capital_trabajo_neto numeric(15, 2),          -- Activo Corriente - Pasivo Corriente
    
    -- Indicadores de Endeudamiento
    indice_endeudamiento numeric(10, 4),          -- Pasivo Total / Activo Total
    apalancamiento_financiero numeric(10, 4),     -- Pasivo Total / Patrimonio
    cobertura_intereses numeric(10, 4),           -- Utilidad Operacional / Gastos Intereses
    
    -- Indicadores de Rentabilidad
    margen_bruto numeric(10, 4),                  -- Utilidad Bruta / Ingresos
    margen_operacional numeric(10, 4),            -- Utilidad Operacional / Ingresos
    margen_neto numeric(10, 4),                   -- Utilidad Neta / Ingresos
    margen_ebitda numeric(10, 4),                 -- EBITDA / Ingresos
    
    -- Indicadores de Eficiencia
    roe numeric(10, 4),                           -- Utilidad Neta / Patrimonio (Return on Equity)
    roa numeric(10, 4),                           -- Utilidad Neta / Activo Total (Return on Assets)
    roic numeric(10, 4),                          -- Return on Invested Capital
    
    -- Indicadores de Actividad
    rotacion_activos numeric(10, 4),              -- Ingresos / Activo Total
    rotacion_cartera numeric(10, 4),              -- Ingresos / Cuentas por Cobrar
    dias_cartera integer,                         -- 365 / Rotación Cartera
    rotacion_inventarios numeric(10, 4),          -- Costo Ventas / Inventarios
    dias_inventario integer,                      -- 365 / Rotación Inventarios
    
    -- Calificación y validación para licitaciones
    cumple_liquidez boolean,                      -- >= 1.2 típicamente requerido
    cumple_endeudamiento boolean,                 -- <= 0.7 típicamente requerido
    cumple_cobertura boolean,                     -- >= 1.5 típicamente requerido
    cumple_todos_requisitos boolean,              -- Los 3 anteriores
    
    -- Score de salud financiera (0-100)
    score_salud_financiera integer,
    categoria_riesgo varchar(20) CHECK (categoria_riesgo IN ('muy_bajo', 'bajo', 'medio', 'alto', 'muy_alto')),
    
    -- Metadatos
    calculado_at timestamp with time zone DEFAULT now(),
    
    -- Restricción única
    CONSTRAINT uk_indicadores_proveedor_anio UNIQUE (proveedor_id, anio),
    
    -- FK con finanzas
    CONSTRAINT fk_indicadores_finanzas 
        FOREIGN KEY (proveedor_id, anio) 
        REFERENCES proveedor_finanzas(proveedor_id, anio) 
        ON DELETE CASCADE
);

-- Índices
CREATE INDEX idx_indicadores_proveedor ON proveedor_indicadores(proveedor_id);
CREATE INDEX idx_indicadores_anio ON proveedor_indicadores(anio);
CREATE INDEX idx_indicadores_cumplimiento ON proveedor_indicadores(cumple_todos_requisitos);

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

CREATE INDEX idx_proveedor_contactos_proveedor ON proveedor_contactos(proveedor_id);
CREATE INDEX idx_proveedor_contactos_principal ON proveedor_contactos(es_principal) WHERE es_principal = true;

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

CREATE INDEX idx_proveedor_documentos_proveedor ON proveedor_documentos(proveedor_id);
CREATE INDEX idx_proveedor_documentos_tipo ON proveedor_documentos(tipo_documento);

-- 6. MODIFICACIÓN DE LA TABLA hospital_contracts
-- ==================================================================
-- Primero agregamos la columna de proveedor_id
ALTER TABLE hospital_contracts 
ADD COLUMN IF NOT EXISTS proveedor_id uuid REFERENCES proveedores(id);

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

-- Trigger para calcular indicadores automáticamente
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

-- Vista de competencia por hospital
CREATE OR REPLACE VIEW v_competencia_hospitales AS
SELECT 
    h.id AS hospital_id,
    h.name AS hospital_nombre,
    h.municipality_name,
    h.department_name,
    p.id AS proveedor_id,
    p.nombre AS proveedor_nombre,
    p.tipo_empresa,
    hc.contract_value,
    hc.start_date,
    hc.end_date,
    hc.active AS contrato_activo,
    CASE 
        WHEN hc.end_date < CURRENT_DATE THEN 'vencido'
        WHEN hc.end_date < CURRENT_DATE + INTERVAL '90 days' THEN 'por_vencer'
        ELSE 'vigente'
    END AS estado_contrato
FROM hospitals h
LEFT JOIN hospital_contracts hc ON hc.hospital_id = h.id
LEFT JOIN proveedores p ON p.id = hc.proveedor_id
WHERE h.active = true;

-- Vista de ranking de proveedores por tamaño
CREATE OR REPLACE VIEW v_ranking_proveedores AS
WITH contratos_totales AS (
    SELECT 
        proveedor_id,
        COUNT(*) AS total_contratos,
        SUM(contract_value) AS valor_total_contratos,
        COUNT(DISTINCT hospital_id) AS hospitales_atendidos
    FROM hospital_contracts
    WHERE active = true
    GROUP BY proveedor_id
)
SELECT 
    p.id,
    p.nombre,
    p.tipo_empresa,
    pf.ingresos_operacionales,
    pf.activo_total,
    pf.patrimonio,
    pf.anio,
    ct.total_contratos,
    ct.valor_total_contratos,
    ct.hospitales_atendidos,
    pi.score_salud_financiera,
    pi.categoria_riesgo,
    RANK() OVER (ORDER BY pf.ingresos_operacionales DESC NULLS LAST) AS ranking_ingresos,
    RANK() OVER (ORDER BY pf.patrimonio DESC NULLS LAST) AS ranking_patrimonio,
    RANK() OVER (ORDER BY ct.valor_total_contratos DESC NULLS LAST) AS ranking_contratos
FROM proveedores p
LEFT JOIN LATERAL (
    SELECT * FROM proveedor_finanzas
    WHERE proveedor_id = p.id
    ORDER BY anio DESC
    LIMIT 1
) pf ON true
LEFT JOIN proveedor_indicadores pi ON pi.proveedor_id = p.id AND pi.anio = pf.anio
LEFT JOIN contratos_totales ct ON ct.proveedor_id = p.id
WHERE p.estado = 'activo';

-- 9. POLÍTICAS RLS (Row Level Security)
-- ==================================================================

-- Habilitar RLS en las nuevas tablas
ALTER TABLE proveedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE proveedor_finanzas ENABLE ROW LEVEL SECURITY;
ALTER TABLE proveedor_indicadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE proveedor_contactos ENABLE ROW LEVEL SECURITY;
ALTER TABLE proveedor_documentos ENABLE ROW LEVEL SECURITY;

-- Políticas para admin (acceso total)
CREATE POLICY admin_all_proveedores ON proveedores
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    );

CREATE POLICY admin_all_finanzas ON proveedor_finanzas
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    );

-- Políticas para sales (lectura general, escritura propia)
CREATE POLICY sales_read_proveedores ON proveedores
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role IN ('admin', 'sales', 'viewer')
        )
    );

CREATE POLICY sales_write_proveedores ON proveedores
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role IN ('admin', 'sales')
        )
    );

-- Políticas similares para las demás tablas...

-- 10. FUNCIONES DE UTILIDAD
-- ==================================================================

-- Función para obtener proveedores que cumplen requisitos de licitación
CREATE OR REPLACE FUNCTION obtener_proveedores_calificados(
    p_indice_liquidez numeric DEFAULT 1.2,
    p_indice_endeudamiento numeric DEFAULT 0.7,
    p_cobertura_intereses numeric DEFAULT 1.5
)
RETURNS TABLE (
    proveedor_id uuid,
    nombre varchar,
    nit varchar,
    indice_liquidez numeric,
    indice_endeudamiento numeric,
    cobertura_intereses numeric,
    score_salud_financiera integer,
    anio integer
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.nombre,
        p.nit,
        pi.indice_liquidez,
        pi.indice_endeudamiento,
        pi.cobertura_intereses,
        pi.score_salud_financiera,
        pi.anio
    FROM proveedores p
    INNER JOIN proveedor_indicadores pi ON pi.proveedor_id = p.id
    WHERE pi.indice_liquidez >= p_indice_liquidez
      AND pi.indice_endeudamiento <= p_indice_endeudamiento
      AND pi.cobertura_intereses >= p_cobertura_intereses
      AND pi.anio = (
          SELECT MAX(anio) 
          FROM proveedor_indicadores 
          WHERE proveedor_id = p.id
      )
    ORDER BY pi.score_salud_financiera DESC;
END;
$$ LANGUAGE plpgsql;

-- Función para análisis de competencia por departamento
CREATE OR REPLACE FUNCTION analizar_competencia_departamento(p_department_id varchar)
RETURNS TABLE (
    proveedor_nombre varchar,
    tipo_empresa varchar,
    hospitales_count bigint,
    valor_contratos_total numeric,
    participacion_mercado numeric
) AS $$
BEGIN
    RETURN QUERY
    WITH contratos_dept AS (
        SELECT 
            p.nombre AS proveedor_nombre,
            p.tipo_empresa,
            COUNT(DISTINCT h.id) AS hospitales_count,
            SUM(hc.contract_value) AS valor_contratos_total
        FROM hospitals h
        INNER JOIN hospital_contracts hc ON hc.hospital_id = h.id
        INNER JOIN proveedores p ON p.id = hc.proveedor_id
        WHERE h.department_id = p_department_id
          AND hc.active = true
        GROUP BY p.id, p.nombre, p.tipo_empresa
    ),
    total_mercado AS (
        SELECT SUM(valor_contratos_total) AS total
        FROM contratos_dept
    )
    SELECT 
        cd.proveedor_nombre,
        cd.tipo_empresa,
        cd.hospitales_count,
        cd.valor_contratos_total,
        ROUND((cd.valor_contratos_total / tm.total * 100)::numeric, 2) AS participacion_mercado
    FROM contratos_dept cd
    CROSS JOIN total_mercado tm
    ORDER BY cd.valor_contratos_total DESC;
END;
$$ LANGUAGE plpgsql;

-- ==================================================================
-- FIN DEL SCRIPT DE CREACIÓN DE TABLAS DE PROVEEDORES
-- ==================================================================