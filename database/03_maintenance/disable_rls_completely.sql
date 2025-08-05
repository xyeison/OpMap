-- ========================================
-- DESHABILITAR RLS COMPLETAMENTE
-- ========================================

-- 1. Ver estado actual de RLS en todas las tablas relevantes
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('hospital_contracts', 'hospitals', 'users', 'assignments', 'kams')
ORDER BY tablename;

-- 2. DESHABILITAR RLS en hospital_contracts
ALTER TABLE hospital_contracts DISABLE ROW LEVEL SECURITY;

-- 3. DESHABILITAR RLS en todas las tablas relacionadas (por si acaso)
ALTER TABLE hospitals DISABLE ROW LEVEL SECURITY;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE assignments DISABLE ROW LEVEL SECURITY;
ALTER TABLE kams DISABLE ROW LEVEL SECURITY;

-- 4. Verificar que se deshabilitó
SELECT 
    'DESPUÉS DE DESHABILITAR:' as estado,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('hospital_contracts', 'hospitals', 'users', 'assignments', 'kams')
ORDER BY tablename;

-- 5. Eliminar TODAS las políticas de hospital_contracts
DO $$ 
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'hospital_contracts'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON hospital_contracts', pol.policyname);
    END LOOP;
END $$;

-- 6. Verificar que no quedan políticas
SELECT 
    'Políticas restantes en hospital_contracts:' as info,
    COUNT(*) as cantidad
FROM pg_policies
WHERE tablename = 'hospital_contracts';

-- 7. Ahora intenta crear un contrato desde la aplicación
-- Si funciona, el problema era definitivamente RLS

-- ========================================
-- PARA REVERTIR (si necesitas volver a habilitar RLS):
-- ========================================
/*
ALTER TABLE hospital_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE hospitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE kams ENABLE ROW LEVEL SECURITY;
*/