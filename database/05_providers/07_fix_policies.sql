-- ==================================================================
-- SCRIPT PARA LIMPIAR Y RECREAR POLÍTICAS RLS
-- ==================================================================
-- Este script elimina todas las políticas existentes y las recrea
-- ==================================================================

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'LIMPIANDO POLÍTICAS RLS EXISTENTES';
    RAISE NOTICE '========================================';
END $$;

-- 1. ELIMINAR TODAS LAS POLÍTICAS EXISTENTES
-- ==================================================================

-- Políticas de proveedores
DROP POLICY IF EXISTS "proveedores_all" ON proveedores;
DROP POLICY IF EXISTS "allow_all_proveedores" ON proveedores;
DROP POLICY IF EXISTS "public_access_proveedores" ON proveedores;

-- Políticas de proveedor_finanzas
DROP POLICY IF EXISTS "proveedor_finanzas_all" ON proveedor_finanzas;
DROP POLICY IF EXISTS "allow_all_proveedor_finanzas" ON proveedor_finanzas;
DROP POLICY IF EXISTS "public_access_proveedor_finanzas" ON proveedor_finanzas;

-- Políticas de proveedor_indicadores
DROP POLICY IF EXISTS "proveedor_indicadores_all" ON proveedor_indicadores;
DROP POLICY IF EXISTS "allow_all_proveedor_indicadores" ON proveedor_indicadores;
DROP POLICY IF EXISTS "public_access_proveedor_indicadores" ON proveedor_indicadores;

-- Políticas de proveedor_contactos
DROP POLICY IF EXISTS "proveedor_contactos_all" ON proveedor_contactos;
DROP POLICY IF EXISTS "allow_all_proveedor_contactos" ON proveedor_contactos;
DROP POLICY IF EXISTS "public_access_proveedor_contactos" ON proveedor_contactos;

-- Políticas de proveedor_documentos (si existe)
DROP POLICY IF EXISTS "proveedor_documentos_all" ON proveedor_documentos;
DROP POLICY IF EXISTS "allow_all_proveedor_documentos" ON proveedor_documentos;
DROP POLICY IF EXISTS "public_access_proveedor_documentos" ON proveedor_documentos;

-- Políticas de proveedor_enlaces
DROP POLICY IF EXISTS "proveedor_enlaces_all" ON proveedor_enlaces;
DROP POLICY IF EXISTS "allow_all_proveedor_enlaces" ON proveedor_enlaces;
DROP POLICY IF EXISTS "public_access_proveedor_enlaces" ON proveedor_enlaces;

DO $$
BEGIN
    RAISE NOTICE '✅ Políticas existentes eliminadas';
END $$;

-- 2. ASEGURAR QUE RLS ESTÉ HABILITADO
-- ==================================================================

-- Solo intentar si las tablas existen
DO $$
BEGIN
    -- proveedores
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'proveedores') THEN
        ALTER TABLE proveedores ENABLE ROW LEVEL SECURITY;
        RAISE NOTICE '✅ RLS habilitado para proveedores';
    END IF;
    
    -- proveedor_finanzas
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'proveedor_finanzas') THEN
        ALTER TABLE proveedor_finanzas ENABLE ROW LEVEL SECURITY;
        RAISE NOTICE '✅ RLS habilitado para proveedor_finanzas';
    END IF;
    
    -- proveedor_indicadores
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'proveedor_indicadores') THEN
        ALTER TABLE proveedor_indicadores ENABLE ROW LEVEL SECURITY;
        RAISE NOTICE '✅ RLS habilitado para proveedor_indicadores';
    END IF;
    
    -- proveedor_contactos
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'proveedor_contactos') THEN
        ALTER TABLE proveedor_contactos ENABLE ROW LEVEL SECURITY;
        RAISE NOTICE '✅ RLS habilitado para proveedor_contactos';
    END IF;
    
    -- proveedor_enlaces
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'proveedor_enlaces') THEN
        ALTER TABLE proveedor_enlaces ENABLE ROW LEVEL SECURITY;
        RAISE NOTICE '✅ RLS habilitado para proveedor_enlaces';
    END IF;
END $$;

-- 3. CREAR NUEVAS POLÍTICAS UNIFICADAS
-- ==================================================================
-- Usamos un nombre único y consistente para todas las políticas

-- Política para proveedores
CREATE POLICY "providers_policy_all" ON proveedores
    FOR ALL 
    TO PUBLIC
    USING (true)
    WITH CHECK (true);

-- Política para proveedor_finanzas
CREATE POLICY "providers_finances_policy_all" ON proveedor_finanzas
    FOR ALL 
    TO PUBLIC
    USING (true)
    WITH CHECK (true);

-- Política para proveedor_indicadores
CREATE POLICY "providers_indicators_policy_all" ON proveedor_indicadores
    FOR ALL 
    TO PUBLIC
    USING (true)
    WITH CHECK (true);

-- Política para proveedor_contactos
CREATE POLICY "providers_contacts_policy_all" ON proveedor_contactos
    FOR ALL 
    TO PUBLIC
    USING (true)
    WITH CHECK (true);

-- Política para proveedor_enlaces
CREATE POLICY "providers_links_policy_all" ON proveedor_enlaces
    FOR ALL 
    TO PUBLIC
    USING (true)
    WITH CHECK (true);

DO $$
BEGIN
    RAISE NOTICE '✅ Nuevas políticas creadas con nombres únicos';
END $$;

-- 4. VERIFICAR QUE TODO FUNCIONA
-- ==================================================================
DO $$
DECLARE
    v_count INTEGER;
    v_test_id UUID;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'VERIFICANDO ACCESO A TABLAS';
    RAISE NOTICE '========================================';
    
    -- Probar acceso a proveedores
    BEGIN
        SELECT COUNT(*) INTO v_count FROM proveedores;
        RAISE NOTICE '✅ Acceso a proveedores OK (%s registros)', v_count;
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '❌ Error accediendo a proveedores: %', SQLERRM;
    END;
    
    -- Probar inserción
    BEGIN
        INSERT INTO proveedores (nit, nombre, estado) 
        VALUES ('TEST-' || EXTRACT(EPOCH FROM NOW())::text, 'Proveedor de Prueba RLS', 'activo')
        RETURNING id INTO v_test_id;
        
        -- Eliminar el registro de prueba
        DELETE FROM proveedores WHERE id = v_test_id;
        
        RAISE NOTICE '✅ Inserción y eliminación de prueba exitosa';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '⚠️  No se pudo probar inserción: %', SQLERRM;
    END;
    
    -- Probar acceso a proveedor_finanzas
    BEGIN
        SELECT COUNT(*) INTO v_count FROM proveedor_finanzas;
        RAISE NOTICE '✅ Acceso a proveedor_finanzas OK (%s registros)', v_count;
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '❌ Error accediendo a proveedor_finanzas: %', SQLERRM;
    END;
    
    -- Probar acceso a proveedor_indicadores
    BEGIN
        SELECT COUNT(*) INTO v_count FROM proveedor_indicadores;
        RAISE NOTICE '✅ Acceso a proveedor_indicadores OK (%s registros)', v_count;
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '❌ Error accediendo a proveedor_indicadores: %', SQLERRM;
    END;
    
    -- Probar acceso a proveedor_enlaces
    BEGIN
        SELECT COUNT(*) INTO v_count FROM proveedor_enlaces;
        RAISE NOTICE '✅ Acceso a proveedor_enlaces OK (%s registros)', v_count;
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '❌ Error accediendo a proveedor_enlaces: %', SQLERRM;
    END;
END $$;

-- 5. MOSTRAR POLÍTICAS ACTUALES
-- ==================================================================
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'POLÍTICAS RLS CONFIGURADAS';
    RAISE NOTICE '========================================';
END $$;

SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE tablename LIKE 'proveedor%'
ORDER BY tablename, policyname;

-- 6. RESUMEN FINAL
-- ==================================================================
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'CONFIGURACIÓN COMPLETADA';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '✅ Políticas RLS limpiadas y recreadas';
    RAISE NOTICE '✅ Acceso público habilitado para desarrollo';
    RAISE NOTICE '';
    RAISE NOTICE 'NOTA: Las políticas actuales permiten acceso completo.';
    RAISE NOTICE 'Para producción, implemente políticas basadas en roles.';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;

-- ==================================================================
-- FIN DEL SCRIPT
-- ==================================================================