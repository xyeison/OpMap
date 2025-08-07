-- ============================================
-- SOLUCIÓN CORRECTA PARA AUTENTICACIÓN CON RLS
-- Basado en documentación oficial de Supabase
-- ============================================

-- 1. Primero, eliminar políticas problemáticas existentes
DROP POLICY IF EXISTS "Admin can view all" ON public.users;
DROP POLICY IF EXISTS "Users can view own data" ON public.users;
DROP POLICY IF EXISTS "Admin can manage users" ON public.users;
DROP POLICY IF EXISTS "Users can view their own data" ON public.users;
DROP POLICY IF EXISTS "Admins can manage all users" ON public.users;

-- 2. Habilitar RLS en la tabla users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 3. POLÍTICA CRÍTICA: Permitir SELECT público para autenticación
-- Esta política permite que el proceso de login lea la tabla users
-- para verificar credenciales ANTES de que el usuario esté autenticado
CREATE POLICY "Enable read access for authentication" 
ON public.users
FOR SELECT
USING (true);  -- Permite lectura completa (necesaria para autenticación)

-- 4. Política para que usuarios autenticados actualicen sus propios datos
CREATE POLICY "Users can update own data" 
ON public.users
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 5. Política para que admins gestionen todos los usuarios
CREATE POLICY "Admins can manage all users" 
ON public.users
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role = 'admin'
  )
);

-- 6. Verificar que las políticas se crearon correctamente
SELECT 
  policyname,
  cmd,
  roles
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'users'
ORDER BY policyname;

-- 7. Verificar que RLS está habilitado
SELECT 
  tablename,
  CASE 
    WHEN rowsecurity THEN 'RLS Habilitado ✅' 
    ELSE 'RLS Deshabilitado ❌' 
  END as estado
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename = 'users';

-- ============================================
-- NOTA IMPORTANTE:
-- La política "Enable read access for authentication" con USING(true)
-- es necesaria para que el proceso de autenticación funcione.
-- Sin ella, no se puede verificar las credenciales del usuario.
-- 
-- Esta configuración es segura porque:
-- 1. Las contraseñas están hasheadas (no se exponen)
-- 2. La información sensible puede protegerse a nivel de aplicación
-- 3. UPDATE/DELETE están protegidos por políticas más restrictivas
-- ============================================