-- ==================================================================
-- CONFIGURACIÓN CORRECTA DE POLÍTICAS RLS PARA PROVEEDORES
-- ==================================================================
-- Este script configura políticas RLS apropiadas que permiten:
-- 1. Lectura pública (para consultas sin autenticación)
-- 2. Escritura solo para usuarios autenticados
-- 3. Service key bypasea todas las restricciones
-- ==================================================================

-- ============================================
-- 1. TABLA: proveedores
-- ============================================
-- Eliminar políticas existentes
DROP POLICY IF EXISTS "public_access_proveedores" ON proveedores;
DROP POLICY IF EXISTS "admin_all_proveedores" ON proveedores;
DROP POLICY IF EXISTS "sales_read_proveedores" ON proveedores;
DROP POLICY IF EXISTS "sales_write_proveedores" ON proveedores;

-- Crear nuevas políticas
-- Lectura: Pública (todos pueden ver proveedores)
CREATE POLICY "proveedores_read_public" ON proveedores
    FOR SELECT
    USING (true);

-- Inserción: Solo usuarios autenticados o service role
CREATE POLICY "proveedores_insert_authenticated" ON proveedores
    FOR INSERT
    WITH CHECK (
        auth.role() = 'authenticated' OR 
        auth.role() = 'service_role'
    );

-- Actualización: Solo usuarios autenticados o service role
CREATE POLICY "proveedores_update_authenticated" ON proveedores
    FOR UPDATE
    USING (
        auth.role() = 'authenticated' OR 
        auth.role() = 'service_role'
    )
    WITH CHECK (
        auth.role() = 'authenticated' OR 
        auth.role() = 'service_role'
    );

-- Eliminación: Solo usuarios autenticados o service role
CREATE POLICY "proveedores_delete_authenticated" ON proveedores
    FOR DELETE
    USING (
        auth.role() = 'authenticated' OR 
        auth.role() = 'service_role'
    );

-- ============================================
-- 2. TABLA: proveedor_finanzas
-- ============================================
-- Eliminar políticas existentes
DROP POLICY IF EXISTS "public_access_finanzas" ON proveedor_finanzas;
DROP POLICY IF EXISTS "admin_all_finanzas" ON proveedor_finanzas;

-- Crear nuevas políticas
-- Lectura: Pública (todos pueden ver datos financieros)
CREATE POLICY "finanzas_read_public" ON proveedor_finanzas
    FOR SELECT
    USING (true);

-- Inserción: Solo usuarios autenticados o service role
CREATE POLICY "finanzas_insert_authenticated" ON proveedor_finanzas
    FOR INSERT
    WITH CHECK (
        auth.role() = 'authenticated' OR 
        auth.role() = 'service_role'
    );

-- Actualización: Solo usuarios autenticados o service role
CREATE POLICY "finanzas_update_authenticated" ON proveedor_finanzas
    FOR UPDATE
    USING (
        auth.role() = 'authenticated' OR 
        auth.role() = 'service_role'
    )
    WITH CHECK (
        auth.role() = 'authenticated' OR 
        auth.role() = 'service_role'
    );

-- Eliminación: Solo usuarios autenticados o service role
CREATE POLICY "finanzas_delete_authenticated" ON proveedor_finanzas
    FOR DELETE
    USING (
        auth.role() = 'authenticated' OR 
        auth.role() = 'service_role'
    );

-- ============================================
-- 3. TABLA: proveedor_indicadores
-- ============================================
-- Eliminar políticas existentes si existen
DROP POLICY IF EXISTS "public_access_indicadores" ON proveedor_indicadores;

-- Crear nuevas políticas
-- Lectura: Pública (todos pueden ver indicadores)
CREATE POLICY "indicadores_read_public" ON proveedor_indicadores
    FOR SELECT
    USING (true);

-- Inserción: Solo service role (se calculan automáticamente por trigger)
CREATE POLICY "indicadores_insert_service" ON proveedor_indicadores
    FOR INSERT
    WITH CHECK (auth.role() = 'service_role');

-- Actualización: Solo service role (se calculan automáticamente)
CREATE POLICY "indicadores_update_service" ON proveedor_indicadores
    FOR UPDATE
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- Eliminación: Solo service role
CREATE POLICY "indicadores_delete_service" ON proveedor_indicadores
    FOR DELETE
    USING (auth.role() = 'service_role');

-- ============================================
-- 4. TABLA: proveedor_enlaces
-- ============================================
-- Ya tiene política pública, pero la mejoramos
DROP POLICY IF EXISTS "public_access_proveedor_enlaces" ON proveedor_enlaces;

-- Crear nuevas políticas
-- Lectura: Pública
CREATE POLICY "enlaces_read_public" ON proveedor_enlaces
    FOR SELECT
    USING (true);

-- Inserción: Solo usuarios autenticados o service role
CREATE POLICY "enlaces_insert_authenticated" ON proveedor_enlaces
    FOR INSERT
    WITH CHECK (
        auth.role() = 'authenticated' OR 
        auth.role() = 'service_role'
    );

-- Actualización: Solo usuarios autenticados o service role
CREATE POLICY "enlaces_update_authenticated" ON proveedor_enlaces
    FOR UPDATE
    USING (
        auth.role() = 'authenticated' OR 
        auth.role() = 'service_role'
    )
    WITH CHECK (
        auth.role() = 'authenticated' OR 
        auth.role() = 'service_role'
    );

-- Eliminación: Solo usuarios autenticados o service role
CREATE POLICY "enlaces_delete_authenticated" ON proveedor_enlaces
    FOR DELETE
    USING (
        auth.role() = 'authenticated' OR 
        auth.role() = 'service_role'
    );

-- ============================================
-- 5. TABLA: proveedor_contactos (si existe)
-- ============================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'proveedor_contactos') THEN
        -- Eliminar políticas existentes
        DROP POLICY IF EXISTS "public_access_contactos" ON proveedor_contactos;
        
        -- Lectura: Pública
        CREATE POLICY "contactos_read_public" ON proveedor_contactos
            FOR SELECT
            USING (true);
        
        -- Inserción: Solo usuarios autenticados o service role
        CREATE POLICY "contactos_insert_authenticated" ON proveedor_contactos
            FOR INSERT
            WITH CHECK (
                auth.role() = 'authenticated' OR 
                auth.role() = 'service_role'
            );
        
        -- Actualización: Solo usuarios autenticados o service role
        CREATE POLICY "contactos_update_authenticated" ON proveedor_contactos
            FOR UPDATE
            USING (
                auth.role() = 'authenticated' OR 
                auth.role() = 'service_role'
            )
            WITH CHECK (
                auth.role() = 'authenticated' OR 
                auth.role() = 'service_role'
            );
        
        -- Eliminación: Solo usuarios autenticados o service role
        CREATE POLICY "contactos_delete_authenticated" ON proveedor_contactos
            FOR DELETE
            USING (
                auth.role() = 'authenticated' OR 
                auth.role() = 'service_role'
            );
    END IF;
END $$;

-- ============================================
-- 6. VERIFICACIÓN FINAL
-- ============================================
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'VERIFICACIÓN DE POLÍTICAS RLS';
    RAISE NOTICE '========================================';
    
    -- Contar políticas por tabla
    SELECT COUNT(*) INTO v_count 
    FROM pg_policies 
    WHERE tablename = 'proveedores' AND schemaname = 'public';
    RAISE NOTICE 'Políticas en proveedores: %', v_count;
    
    SELECT COUNT(*) INTO v_count 
    FROM pg_policies 
    WHERE tablename = 'proveedor_finanzas' AND schemaname = 'public';
    RAISE NOTICE 'Políticas en proveedor_finanzas: %', v_count;
    
    SELECT COUNT(*) INTO v_count 
    FROM pg_policies 
    WHERE tablename = 'proveedor_indicadores' AND schemaname = 'public';
    RAISE NOTICE 'Políticas en proveedor_indicadores: %', v_count;
    
    SELECT COUNT(*) INTO v_count 
    FROM pg_policies 
    WHERE tablename = 'proveedor_enlaces' AND schemaname = 'public';
    RAISE NOTICE 'Políticas en proveedor_enlaces: %', v_count;
    
    RAISE NOTICE '';
    RAISE NOTICE '✅ Políticas RLS configuradas correctamente';
    RAISE NOTICE '';
    RAISE NOTICE 'NOTA IMPORTANTE:';
    RAISE NOTICE '========================================';
    RAISE NOTICE '1. Las APIs ahora usan service_role key que bypasea RLS';
    RAISE NOTICE '2. Lectura es pública (sin autenticación requerida)';
    RAISE NOTICE '3. Escritura requiere autenticación o service_role';
    RAISE NOTICE '4. Para testing sin autenticación, use service_role key';
    RAISE NOTICE '';
END $$;

-- ============================================
-- 7. MOSTRAR POLÍTICAS CONFIGURADAS
-- ============================================
SELECT 
    tablename AS "Tabla",
    policyname AS "Política",
    cmd AS "Comando",
    CASE 
        WHEN qual = 'true' THEN 'Público'
        WHEN qual LIKE '%authenticated%' THEN 'Autenticado'
        WHEN qual LIKE '%service_role%' THEN 'Service Role'
        ELSE 'Personalizado'
    END AS "Acceso"
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('proveedores', 'proveedor_finanzas', 'proveedor_indicadores', 'proveedor_enlaces', 'proveedor_contactos')
ORDER BY tablename, cmd;

-- ==================================================================
-- FIN DEL SCRIPT DE CONFIGURACIÓN DE RLS
-- ==================================================================