-- ==================================================================
-- SCRIPT RÁPIDO PARA RESOLVER CONFLICTOS DE POLÍTICAS
-- ==================================================================
-- Ejecute este script si obtiene errores de políticas duplicadas
-- ==================================================================

-- Eliminar políticas conflictivas si existen
DO $$
BEGIN
    -- Intentar eliminar cada política, ignorando si no existe
    BEGIN
        DROP POLICY IF EXISTS "public_access_proveedores" ON proveedores;
    EXCEPTION WHEN OTHERS THEN
        NULL; -- Ignorar error si no existe
    END;
    
    BEGIN
        DROP POLICY IF EXISTS "public_access_proveedor_finanzas" ON proveedor_finanzas;
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;
    
    BEGIN
        DROP POLICY IF EXISTS "public_access_proveedor_indicadores" ON proveedor_indicadores;
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;
    
    BEGIN
        DROP POLICY IF EXISTS "public_access_proveedor_contactos" ON proveedor_contactos;
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;
    
    BEGIN
        DROP POLICY IF EXISTS "public_access_proveedor_enlaces" ON proveedor_enlaces;
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;
    
    RAISE NOTICE '✅ Políticas conflictivas eliminadas (si existían)';
END $$;

-- Verificar qué políticas existen actualmente
SELECT 
    'Tabla: ' || tablename || ' - Política: ' || policyname as info
FROM pg_policies 
WHERE tablename LIKE 'proveedor%'
ORDER BY tablename, policyname;

-- Mensaje final
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Limpieza completada';
    RAISE NOTICE 'Ahora puede ejecutar el script 06_update_contracts_links.sql';
    RAISE NOTICE '========================================';
END $$;