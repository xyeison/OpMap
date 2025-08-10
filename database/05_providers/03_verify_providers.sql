-- ==================================================================
-- VERIFICACIÓN RÁPIDA DEL SISTEMA DE PROVEEDORES
-- ==================================================================
-- Ejecute este script para verificar el estado del sistema
-- ==================================================================

-- 1. Verificar tablas
SELECT 
    table_name,
    CASE 
        WHEN table_name IN ('proveedores', 'proveedor_finanzas', 'proveedor_indicadores', 
                           'proveedor_contactos', 'proveedor_documentos')
        THEN '✅ Existe'
        ELSE '❌ No encontrada'
    END as estado
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'proveedor%'
ORDER BY table_name;

-- 2. Verificar políticas RLS
SELECT 
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE tablename LIKE 'proveedor%'
ORDER BY tablename, policyname;

-- 3. Contar registros
SELECT 
    'proveedores' as tabla,
    COUNT(*) as registros
FROM proveedores
UNION ALL
SELECT 
    'proveedor_finanzas' as tabla,
    COUNT(*) as registros
FROM proveedor_finanzas
UNION ALL
SELECT 
    'proveedor_indicadores' as tabla,
    COUNT(*) as registros
FROM proveedor_indicadores;

-- 4. Ver estructura de la tabla proveedores
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'proveedores'
ORDER BY ordinal_position;

-- 5. Probar inserción (opcional - descomentar para ejecutar)
/*
INSERT INTO proveedores (nit, nombre, estado) 
VALUES ('TEST-' || NOW()::text, 'Proveedor de Prueba', 'activo')
RETURNING id, nit, nombre;
*/