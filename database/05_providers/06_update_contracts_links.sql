-- ==================================================================
-- ACTUALIZACIÓN PARA INTEGRACIÓN DE PROVEEDORES CON CONTRATOS
-- Y CAMBIO DE DOCUMENTOS A ENLACES
-- ==================================================================

-- 1. VERIFICAR SI LA COLUMNA proveedor_id YA EXISTE EN hospital_contracts
-- ==================================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'hospital_contracts' 
        AND column_name = 'proveedor_id'
    ) THEN
        ALTER TABLE hospital_contracts 
        ADD COLUMN proveedor_id uuid REFERENCES proveedores(id);
        
        CREATE INDEX idx_hospital_contracts_proveedor 
        ON hospital_contracts(proveedor_id);
        
        RAISE NOTICE '✅ Columna proveedor_id agregada a hospital_contracts';
    ELSE
        RAISE NOTICE 'ℹ️  Columna proveedor_id ya existe en hospital_contracts';
    END IF;
END $$;

-- 2. MIGRAR DATOS DE current_provider (texto) A proveedor_id
-- ==================================================================
DO $$
DECLARE
    v_contract RECORD;
    v_proveedor_id UUID;
    v_migrated INTEGER := 0;
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'MIGRANDO PROVEEDORES EXISTENTES';
    RAISE NOTICE '========================================';
    
    FOR v_contract IN 
        SELECT id, current_provider 
        FROM hospital_contracts 
        WHERE current_provider IS NOT NULL 
        AND current_provider != ''
        AND proveedor_id IS NULL
    LOOP
        -- Buscar proveedor por nombre
        SELECT id INTO v_proveedor_id
        FROM proveedores
        WHERE LOWER(TRIM(nombre)) = LOWER(TRIM(v_contract.current_provider))
        LIMIT 1;
        
        -- Si no existe, crear el proveedor
        IF v_proveedor_id IS NULL THEN
            INSERT INTO proveedores (
                nit, 
                nombre, 
                estado,
                notas_internas
            ) VALUES (
                'MIGRADO-' || v_contract.id::text,
                v_contract.current_provider,
                'activo',
                'Proveedor migrado automáticamente desde contratos. Completar información.'
            ) RETURNING id INTO v_proveedor_id;
            
            RAISE NOTICE 'Proveedor creado: %', v_contract.current_provider;
        END IF;
        
        -- Actualizar el contrato con el proveedor_id
        UPDATE hospital_contracts 
        SET proveedor_id = v_proveedor_id
        WHERE id = v_contract.id;
        
        v_migrated := v_migrated + 1;
    END LOOP;
    
    RAISE NOTICE '✅ Migrados % contratos con proveedores', v_migrated;
END $$;

-- 3. REEMPLAZAR TABLA proveedor_documentos CON proveedor_enlaces
-- ==================================================================
DROP TABLE IF EXISTS proveedor_documentos CASCADE;

CREATE TABLE proveedor_enlaces (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    proveedor_id uuid NOT NULL REFERENCES proveedores(id) ON DELETE CASCADE,
    tipo_enlace varchar(50) CHECK (tipo_enlace IN (
        'estados_financieros',
        'certificacion_bancaria',
        'rut',
        'camara_comercio',
        'certificacion_experiencia',
        'referencia_comercial',
        'sitio_web',
        'catalogo',
        'presentacion',
        'otro'
    )),
    titulo varchar(255) NOT NULL,
    url text NOT NULL,
    descripcion text,
    anio integer,
    activo boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by uuid REFERENCES users(id)
);

-- Índices
CREATE INDEX idx_proveedor_enlaces_proveedor ON proveedor_enlaces(proveedor_id);
CREATE INDEX idx_proveedor_enlaces_tipo ON proveedor_enlaces(tipo_enlace);
CREATE INDEX idx_proveedor_enlaces_activo ON proveedor_enlaces(activo);

-- Habilitar RLS
ALTER TABLE proveedor_enlaces ENABLE ROW LEVEL SECURITY;

-- Política permisiva temporal (solo si no existe)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'proveedor_enlaces' 
        AND policyname = 'public_access_proveedor_enlaces'
    ) THEN
        CREATE POLICY "public_access_proveedor_enlaces" ON proveedor_enlaces
            FOR ALL TO PUBLIC
            USING (true)
            WITH CHECK (true);
        RAISE NOTICE '✅ Política RLS creada para proveedor_enlaces';
    ELSE
        RAISE NOTICE 'ℹ️  Política RLS ya existe para proveedor_enlaces';
    END IF;
END $$;

COMMENT ON TABLE proveedor_enlaces IS 'Enlaces y URLs relacionados con proveedores';

-- 4. CREAR VISTA EXTENDIDA DE CONTRATOS CON PROVEEDORES
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
    CASE 
        WHEN hc.end_date >= CURRENT_DATE THEN 
            EXTRACT(DAY FROM hc.end_date - CURRENT_DATE)
        ELSE 
            -EXTRACT(DAY FROM CURRENT_DATE - hc.end_date)
    END AS dias_vigencia
FROM hospital_contracts hc
LEFT JOIN hospitals h ON h.id = hc.hospital_id
LEFT JOIN proveedores p ON p.id = hc.proveedor_id
ORDER BY hc.end_date DESC;

COMMENT ON VIEW v_hospital_contracts_extended IS 'Vista extendida de contratos con información de hospitales y proveedores';

-- 5. CREAR VISTA DE RESUMEN DE PROVEEDORES CON CONTRATOS
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

-- 6. AGREGAR DATOS DE EJEMPLO DE ENLACES
-- ==================================================================
DO $$
DECLARE
    v_proveedor_id UUID;
BEGIN
    -- Obtener el primer proveedor activo
    SELECT id INTO v_proveedor_id
    FROM proveedores
    WHERE estado = 'activo'
    LIMIT 1;
    
    IF v_proveedor_id IS NOT NULL THEN
        -- Insertar enlaces de ejemplo
        INSERT INTO proveedor_enlaces (
            proveedor_id, tipo_enlace, titulo, url, descripcion, anio
        ) VALUES 
        (v_proveedor_id, 'estados_financieros', 'Estados Financieros 2024', 
         'https://drive.google.com/file/example1', 'Estados financieros auditados', 2024),
        (v_proveedor_id, 'rut', 'RUT Actualizado', 
         'https://drive.google.com/file/example2', 'RUT con última actualización DIAN', NULL),
        (v_proveedor_id, 'catalogo', 'Catálogo de Productos 2024', 
         'https://ejemplo.com/catalogo', 'Catálogo completo de productos médicos', 2024),
        (v_proveedor_id, 'sitio_web', 'Sitio Web Corporativo', 
         'https://www.ejemplo.com', 'Página web oficial de la empresa', NULL);
        
        RAISE NOTICE '✅ Enlaces de ejemplo creados para proveedor';
    END IF;
END $$;

-- 7. VERIFICACIÓN FINAL
-- ==================================================================
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'VERIFICACIÓN DE ACTUALIZACIÓN';
    RAISE NOTICE '========================================';
    
    -- Verificar contratos con proveedores
    SELECT COUNT(*) INTO v_count 
    FROM hospital_contracts 
    WHERE proveedor_id IS NOT NULL;
    RAISE NOTICE 'Contratos con proveedor asignado: %', v_count;
    
    -- Verificar enlaces
    SELECT COUNT(*) INTO v_count 
    FROM proveedor_enlaces;
    RAISE NOTICE 'Enlaces de proveedores: %', v_count;
    
    -- Verificar vistas
    IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'v_hospital_contracts_extended') THEN
        RAISE NOTICE '✅ Vista v_hospital_contracts_extended creada';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'v_proveedor_resumen_contratos') THEN
        RAISE NOTICE '✅ Vista v_proveedor_resumen_contratos creada';
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '✅ Sistema actualizado correctamente';
    RAISE NOTICE '';
END $$;

-- ==================================================================
-- FIN DEL SCRIPT DE ACTUALIZACIÓN
-- ==================================================================