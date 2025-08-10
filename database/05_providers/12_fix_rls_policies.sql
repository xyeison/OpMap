-- ==================================================================
-- CORRECCIÓN DE POLÍTICAS RLS PARA PROVEEDORES
-- ==================================================================
-- Permite acceso temporal para desarrollo
-- ==================================================================

-- 1. POLÍTICAS PARA TABLA proveedores
-- ==================================================================
-- Eliminar políticas restrictivas existentes
DROP POLICY IF EXISTS "admin_all_proveedores" ON proveedores;
DROP POLICY IF EXISTS "sales_read_proveedores" ON proveedores;
DROP POLICY IF EXISTS "sales_write_proveedores" ON proveedores;

-- Crear política permisiva temporal para desarrollo
CREATE POLICY "public_access_proveedores" ON proveedores
    FOR ALL TO PUBLIC
    USING (true)
    WITH CHECK (true);

-- 2. POLÍTICAS PARA TABLA proveedor_finanzas  
-- ==================================================================
-- Eliminar política restrictiva existente
DROP POLICY IF EXISTS "admin_all_finanzas" ON proveedor_finanzas;

-- Crear política permisiva temporal para desarrollo
CREATE POLICY "public_access_finanzas" ON proveedor_finanzas
    FOR ALL TO PUBLIC
    USING (true)
    WITH CHECK (true);

-- 3. VERIFICAR POLÍTICAS
-- ==================================================================
SELECT 
    tablename AS "Tabla",
    policyname AS "Política",
    cmd AS "Comando",
    roles AS "Roles"
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('proveedores', 'proveedor_finanzas', 'proveedor_enlaces')
ORDER BY tablename, policyname;

-- 4. MENSAJE DE CONFIRMACIÓN
-- ==================================================================
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ POLÍTICAS RLS ACTUALIZADAS';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Las políticas ahora permiten acceso completo';
    RAISE NOTICE 'para desarrollo. Recuerda restringirlas en';
    RAISE NOTICE 'producción según los roles de usuario.';
    RAISE NOTICE '';
END $$;