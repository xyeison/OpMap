-- ============================================
-- SCRIPT PARA CORREGIR PROBLEMAS DE LOGIN
-- ============================================

-- 1. Verificar el estado actual de la tabla users
SELECT 
  'Estado de RLS en users:' as info,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename = 'users';

-- 2. Ver las políticas actuales en users
SELECT 
  policyname,
  cmd,
  roles
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'users';

-- 3. SOLUCIÓN RÁPIDA: Deshabilitar RLS temporalmente en users
-- Esto permitirá que el login funcione mientras arreglamos las políticas
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;

-- 4. Verificar que puedes ver los usuarios
SELECT 
  id,
  email,
  role,
  active
FROM public.users
LIMIT 5;

-- ============================================
-- SOLUCIÓN PERMANENTE (ejecutar después de verificar que funciona)
-- ============================================

/*
-- Opción A: RLS habilitado con políticas correctas para login
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas problemáticas
DROP POLICY IF EXISTS "Users can view their own data" ON public.users;
DROP POLICY IF EXISTS "Users can view own data" ON public.users;
DROP POLICY IF EXISTS "Admin can view all users" ON public.users;
DROP POLICY IF EXISTS "Admin can view all" ON public.users;
DROP POLICY IF EXISTS "Admin can manage users" ON public.users;

-- Crear política que permite login (lectura durante autenticación)
CREATE POLICY "Enable read access for all users during auth" ON public.users
  FOR SELECT
  USING (true);  -- Permite lectura para autenticación

-- Crear política para que usuarios vean sus propios datos después de login
CREATE POLICY "Users can update own record" ON public.users
  FOR UPDATE
  USING (auth.uid() = id);

-- Crear política para que admin gestione usuarios
CREATE POLICY "Admins can manage all users" ON public.users
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );
*/