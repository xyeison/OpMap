-- ============================================
-- SOLUCIÓN INMEDIATA PARA PROBLEMA DE LOGIN
-- ============================================

-- 1. DESHABILITAR RLS TEMPORALMENTE PARA RESOLVER EL PROBLEMA
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;

-- 2. Verificar que ahora puedes ver usuarios
SELECT 'Usuarios en el sistema:' as info, COUNT(*) as total FROM public.users;

-- 3. Verificar que RLS está deshabilitado
SELECT 
  tablename,
  CASE 
    WHEN rowsecurity THEN 'RLS Habilitado ❌' 
    ELSE 'RLS Deshabilitado ✅' 
  END as estado
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename = 'users';

-- ============================================
-- AHORA PRUEBA HACER LOGIN EN TU APLICACIÓN
-- Si funciona, puedes dejar RLS deshabilitado en users
-- o ejecutar la siguiente sección para una solución con RLS
-- ============================================

/*
-- OPCIONAL: Habilitar RLS con políticas correctas (ejecutar solo si necesitas RLS en users)

-- Primero eliminar políticas problemáticas
DROP POLICY IF EXISTS "Admin can view all" ON public.users;
DROP POLICY IF EXISTS "Users can view own data" ON public.users;

-- Habilitar RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Crear política permisiva para SELECT (necesaria para login)
CREATE POLICY "Allow public read for authentication" ON public.users
  FOR SELECT
  TO public
  USING (true);  -- Permite lectura completa para autenticación

-- Política para que usuarios autenticados solo actualicen sus datos
CREATE POLICY "Users can update own data" ON public.users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- Política para admins
CREATE POLICY "Admins full access" ON public.users
  FOR ALL
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT id FROM public.users WHERE role = 'admin'
    )
  );
*/