-- ==================================================================
-- SCRIPT DE DIAGNÓSTICO Y REPARACIÓN DE TABLAS DE PROVEEDORES
-- ==================================================================
-- Este script diagnostica y repara problemas con las tablas de proveedores
-- ==================================================================

-- 1. VERIFICAR QUÉ TABLAS EXISTEN
-- ==================================================================
DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'DIAGNÓSTICO DE TABLAS DE PROVEEDORES';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    
    -- Verificar tabla proveedores
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'proveedores') THEN
        RAISE NOTICE '✅ Tabla proveedores existe';
    ELSE
        RAISE NOTICE '❌ Tabla proveedores NO existe';
    END IF;
    
    -- Verificar tabla proveedor_finanzas
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'proveedor_finanzas') THEN
        RAISE NOTICE '✅ Tabla proveedor_finanzas existe';
    ELSE
        RAISE NOTICE '❌ Tabla proveedor_finanzas NO existe';
    END IF;
    
    -- Verificar tabla proveedor_indicadores
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'proveedor_indicadores') THEN
        RAISE NOTICE '✅ Tabla proveedor_indicadores existe';
    ELSE
        RAISE NOTICE '❌ Tabla proveedor_indicadores NO existe';
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;

-- 2. ELIMINAR POLÍTICAS RLS EXISTENTES (si existen)
-- ==================================================================
DROP POLICY IF EXISTS "proveedores_all" ON proveedores;
DROP POLICY IF EXISTS "proveedor_finanzas_all" ON proveedor_finanzas;
DROP POLICY IF EXISTS "proveedor_indicadores_all" ON proveedor_indicadores;
DROP POLICY IF EXISTS "proveedor_contactos_all" ON proveedor_contactos;
DROP POLICY IF EXISTS "proveedor_documentos_all" ON proveedor_documentos;

-- 3. VERIFICAR Y ELIMINAR COLUMNA tipo_empresa SI EXISTE
-- ==================================================================
DO $$
BEGIN
    -- Verificar si existe la columna tipo_empresa y eliminarla
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'proveedores' 
        AND column_name = 'tipo_empresa'
    ) THEN
        ALTER TABLE proveedores DROP COLUMN tipo_empresa;
        RAISE NOTICE '✅ Columna tipo_empresa eliminada';
    END IF;
    
    -- Verificar si existe la columna tamano_empresa y eliminarla
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'proveedores' 
        AND column_name = 'tamano_empresa'
    ) THEN
        ALTER TABLE proveedores DROP COLUMN tamano_empresa;
        RAISE NOTICE '✅ Columna tamano_empresa eliminada';
    END IF;
END $$;

-- 4. CREAR POLÍTICAS RLS PERMISIVAS PARA ACCESO PÚBLICO
-- ==================================================================
-- Estas políticas permiten acceso completo a cualquier usuario
-- (incluyendo usuarios anónimos para desarrollo)

-- Primero, asegurarse de que RLS esté habilitado
DO $$
BEGIN
    -- Solo intentar habilitar RLS si las tablas existen
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'proveedores') THEN
        ALTER TABLE proveedores ENABLE ROW LEVEL SECURITY;
        
        -- Crear política permisiva
        CREATE POLICY "allow_all_proveedores" ON proveedores
            FOR ALL 
            TO PUBLIC
            USING (true)
            WITH CHECK (true);
        
        RAISE NOTICE '✅ RLS configurado para proveedores con acceso público';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'proveedor_finanzas') THEN
        ALTER TABLE proveedor_finanzas ENABLE ROW LEVEL SECURITY;
        
        CREATE POLICY "allow_all_proveedor_finanzas" ON proveedor_finanzas
            FOR ALL 
            TO PUBLIC
            USING (true)
            WITH CHECK (true);
        
        RAISE NOTICE '✅ RLS configurado para proveedor_finanzas con acceso público';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'proveedor_indicadores') THEN
        ALTER TABLE proveedor_indicadores ENABLE ROW LEVEL SECURITY;
        
        CREATE POLICY "allow_all_proveedor_indicadores" ON proveedor_indicadores
            FOR ALL 
            TO PUBLIC
            USING (true)
            WITH CHECK (true);
        
        RAISE NOTICE '✅ RLS configurado para proveedor_indicadores con acceso público';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'proveedor_contactos') THEN
        ALTER TABLE proveedor_contactos ENABLE ROW LEVEL SECURITY;
        
        CREATE POLICY "allow_all_proveedor_contactos" ON proveedor_contactos
            FOR ALL 
            TO PUBLIC
            USING (true)
            WITH CHECK (true);
        
        RAISE NOTICE '✅ RLS configurado para proveedor_contactos con acceso público';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'proveedor_documentos') THEN
        ALTER TABLE proveedor_documentos ENABLE ROW LEVEL SECURITY;
        
        CREATE POLICY "allow_all_proveedor_documentos" ON proveedor_documentos
            FOR ALL 
            TO PUBLIC
            USING (true)
            WITH CHECK (true);
        
        RAISE NOTICE '✅ RLS configurado para proveedor_documentos con acceso público';
    END IF;
END $$;

-- 5. VERIFICAR ACCESO A LAS TABLAS
-- ==================================================================
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'VERIFICACIÓN DE ACCESO A TABLAS';
    RAISE NOTICE '========================================';
    
    -- Intentar contar registros en proveedores
    BEGIN
        SELECT COUNT(*) INTO v_count FROM proveedores;
        RAISE NOTICE '✅ Acceso a proveedores OK (%s registros)', v_count;
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '❌ No se puede acceder a proveedores: %', SQLERRM;
    END;
    
    -- Intentar contar registros en proveedor_finanzas
    BEGIN
        SELECT COUNT(*) INTO v_count FROM proveedor_finanzas;
        RAISE NOTICE '✅ Acceso a proveedor_finanzas OK (%s registros)', v_count;
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '❌ No se puede acceder a proveedor_finanzas: %', SQLERRM;
    END;
    
    -- Intentar contar registros en proveedor_indicadores
    BEGIN
        SELECT COUNT(*) INTO v_count FROM proveedor_indicadores;
        RAISE NOTICE '✅ Acceso a proveedor_indicadores OK (%s registros)', v_count;
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '❌ No se puede acceder a proveedor_indicadores: %', SQLERRM;
    END;
END $$;

-- 6. CREAR DATOS DE PRUEBA SI NO HAY PROVEEDORES
-- ==================================================================
DO $$
DECLARE
    v_count INTEGER;
    v_proveedor_id UUID;
BEGIN
    SELECT COUNT(*) INTO v_count FROM proveedores;
    
    IF v_count = 0 THEN
        RAISE NOTICE '';
        RAISE NOTICE '========================================';
        RAISE NOTICE 'CREANDO DATOS DE PRUEBA';
        RAISE NOTICE '========================================';
        
        -- Crear un proveedor de ejemplo
        INSERT INTO proveedores (
            nit, 
            nombre, 
            email, 
            telefono, 
            ciudad, 
            departamento,
            estado,
            descripcion_corta
        ) VALUES (
            '900123456-1',
            'Proveedor de Ejemplo S.A.S',
            'contacto@ejemplo.com',
            '(1) 234-5678',
            'Bogotá',
            'Cundinamarca',
            'activo',
            'Proveedor de prueba para verificar el sistema'
        ) RETURNING id INTO v_proveedor_id;
        
        RAISE NOTICE '✅ Proveedor de ejemplo creado con ID: %', v_proveedor_id;
        
        -- Crear datos financieros de ejemplo
        INSERT INTO proveedor_finanzas (
            proveedor_id,
            anio,
            activo_corriente,
            activo_no_corriente,
            activo_total,
            pasivo_corriente,
            pasivo_no_corriente,
            pasivo_total,
            patrimonio,
            ingresos_operacionales,
            utilidad_operacional,
            gastos_intereses,
            utilidad_neta,
            fuente
        ) VALUES (
            v_proveedor_id,
            2024,
            1000000,  -- 1,000 millones
            500000,   -- 500 millones
            1500000,  -- 1,500 millones
            400000,   -- 400 millones
            200000,   -- 200 millones
            600000,   -- 600 millones
            900000,   -- 900 millones
            2000000,  -- 2,000 millones
            300000,   -- 300 millones
            50000,    -- 50 millones
            200000,   -- 200 millones
            'manual'
        );
        
        RAISE NOTICE '✅ Datos financieros de ejemplo creados para 2024';
    ELSE
        RAISE NOTICE '';
        RAISE NOTICE 'ℹ️  Ya existen %s proveedores en la base de datos', v_count;
    END IF;
END $$;

-- 7. RESUMEN FINAL
-- ==================================================================
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'RESUMEN DE LA REPARACIÓN';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '✅ Políticas RLS configuradas para acceso público';
    RAISE NOTICE '✅ Columnas innecesarias eliminadas';
    RAISE NOTICE '✅ Sistema de proveedores listo para usar';
    RAISE NOTICE '';
    RAISE NOTICE 'NOTA: Las políticas actuales permiten acceso completo.';
    RAISE NOTICE 'Para producción, considere implementar políticas más restrictivas.';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;

-- ==================================================================
-- FIN DEL SCRIPT DE REPARACIÓN
-- ==================================================================