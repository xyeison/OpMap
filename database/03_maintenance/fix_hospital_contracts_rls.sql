-- ========================================
-- FIX: POLÍTICAS RLS PARA HOSPITAL_CONTRACTS
-- ========================================

-- 1. Verificar si RLS está habilitado
SELECT 
    'RLS habilitado en hospital_contracts' as info,
    relrowsecurity as rls_enabled
FROM pg_class
WHERE relname = 'hospital_contracts';

-- 2. Ver políticas existentes
SELECT 
    pol.polname as policy_name,
    pol.polcmd as command,
    pol.polroles::regrole[] as roles,
    pg_get_expr(pol.polqual, pol.polrelid) as using_expression,
    pg_get_expr(pol.polwithcheck, pol.polrelid) as with_check_expression
FROM pg_policy pol
JOIN pg_class cls ON pol.polrelid = cls.oid
WHERE cls.relname = 'hospital_contracts';

-- 3. Eliminar políticas problemáticas existentes
DROP POLICY IF EXISTS "All authenticated users can view contracts" ON hospital_contracts;
DROP POLICY IF EXISTS "All authenticated users can insert contracts" ON hospital_contracts;
DROP POLICY IF EXISTS "Users can update own contracts, admins can update all" ON hospital_contracts;
DROP POLICY IF EXISTS "Only admins can delete contracts" ON hospital_contracts;

-- 4. Crear políticas más permisivas para hospital_contracts

-- Permitir a usuarios autenticados ver todos los contratos
CREATE POLICY "Enable read access for authenticated users" 
ON hospital_contracts 
FOR SELECT 
TO authenticated
USING (true);

-- Permitir a usuarios autenticados insertar contratos
CREATE POLICY "Enable insert for authenticated users" 
ON hospital_contracts 
FOR INSERT 
TO authenticated
WITH CHECK (true);

-- Permitir a usuarios autenticados actualizar contratos
CREATE POLICY "Enable update for authenticated users" 
ON hospital_contracts 
FOR UPDATE 
TO authenticated
USING (true)
WITH CHECK (true);

-- Permitir a usuarios autenticados eliminar sus propios contratos
CREATE POLICY "Enable delete for authenticated users" 
ON hospital_contracts 
FOR DELETE 
TO authenticated
USING (
    created_by = auth.uid() OR 
    EXISTS (
        SELECT 1 FROM users 
        WHERE users.id = auth.uid() 
        AND users.role IN ('admin', 'sales_manager')
    )
);

-- 5. Verificar las nuevas políticas
SELECT 
    'Políticas creadas para hospital_contracts' as info,
    COUNT(*) as total_policies
FROM pg_policy pol
JOIN pg_class cls ON pol.polrelid = cls.oid
WHERE cls.relname = 'hospital_contracts';

-- ========================================
-- ALTERNATIVA: DESHABILITAR RLS TEMPORALMENTE
-- ========================================
-- Si las políticas siguen causando problemas, puedes deshabilitar RLS:
-- ALTER TABLE hospital_contracts DISABLE ROW LEVEL SECURITY;
-- 
-- Para volver a habilitarlo después:
-- ALTER TABLE hospital_contracts ENABLE ROW LEVEL SECURITY;
-- ========================================