-- ============================================
-- DIAGNÓSTICO Y CORRECCIÓN COMPLETA DE RLS
-- Para permitir que admins inactiven usuarios
-- ============================================

-- 1. VER ESTADO ACTUAL DE RLS EN TODAS LAS TABLAS
-- ============================================
SELECT 
    schemaname,
    tablename,
    CASE 
        WHEN rowsecurity THEN '✅ RLS Habilitado'
        ELSE '❌ RLS Deshabilitado'
    END as rls_status,
    CASE 
        WHEN tablename IN ('spatial_ref_sys', 'geography_columns', 'geometry_columns') 
        THEN '⚠️ Tabla PostGIS (ignorar)'
        ELSE 'Tabla de aplicación'
    END as tipo_tabla
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY 
    CASE WHEN rowsecurity THEN 1 ELSE 0 END,
    tablename;

-- 2. VER TODAS LAS POLÍTICAS RLS EXISTENTES
-- ============================================
SELECT 
    '\n=== POLÍTICAS RLS ACTUALES ===' as separator;

SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 3. ESPECÍFICAMENTE: VER POLÍTICAS DE LA TABLA USERS
-- ============================================
SELECT 
    '\n=== POLÍTICAS EN TABLA USERS ===' as separator;

SELECT 
    policyname,
    cmd as operacion,
    roles,
    qual as condicion_using,
    with_check as condicion_with_check
FROM pg_policies
WHERE schemaname = 'public' 
    AND tablename = 'users'
ORDER BY policyname;

-- 4. VERIFICAR SI EL USUARIO ACTUAL ES ADMIN
-- ============================================
SELECT 
    '\n=== TU USUARIO ACTUAL ===' as separator;

SELECT 
    id,
    email,
    role,
    active,
    CASE 
        WHEN role = 'admin' THEN '✅ Eres admin'
        ELSE '❌ No eres admin'
    END as puede_gestionar_usuarios
FROM public.users
WHERE id = auth.uid();

-- 5. FIX: RECREAR POLÍTICAS DE USERS CORRECTAMENTE
-- ============================================
SELECT 
    '\n=== APLICANDO CORRECCIONES ===' as separator;

-- Eliminar todas las políticas existentes de users
DROP POLICY IF EXISTS "Enable read access for authentication" ON public.users;
DROP POLICY IF EXISTS "Users can update own data" ON public.users;
DROP POLICY IF EXISTS "Admins can manage all users" ON public.users;
DROP POLICY IF EXISTS "Admin can view all" ON public.users;
DROP POLICY IF EXISTS "Users can view own data" ON public.users;
DROP POLICY IF EXISTS "Admin can manage users" ON public.users;
DROP POLICY IF EXISTS "Users can view their own data" ON public.users;
DROP POLICY IF EXISTS "Allow public read for authentication" ON public.users;
DROP POLICY IF EXISTS "Admins full access" ON public.users;

-- Asegurarse de que RLS esté habilitado
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- POLÍTICA 1: Permitir SELECT para autenticación (CRÍTICA)
CREATE POLICY "Anyone can read for auth" 
ON public.users
FOR SELECT
USING (true);  -- Necesario para que funcione el login

-- POLÍTICA 2: Usuarios pueden ver y actualizar sus propios datos
CREATE POLICY "Users can update themselves" 
ON public.users
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- POLÍTICA 3: Admins pueden hacer TODO (INSERT, UPDATE, DELETE)
CREATE POLICY "Admins full control" 
ON public.users
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role = 'admin'
        AND active = true  -- El admin debe estar activo
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role = 'admin'
        AND active = true
    )
);

-- 6. VERIFICAR QUE LAS NUEVAS POLÍTICAS SE CREARON
-- ============================================
SELECT 
    '\n=== POLÍTICAS DESPUÉS DE LA CORRECCIÓN ===' as separator;

SELECT 
    policyname,
    cmd,
    roles,
    CASE 
        WHEN policyname LIKE '%auth%' THEN '🔐 Autenticación'
        WHEN policyname LIKE '%Admin%' THEN '👨‍💼 Administración'
        WHEN policyname LIKE '%Users%' THEN '👤 Usuario normal'
        ELSE '❓ Otro'
    END as tipo
FROM pg_policies
WHERE schemaname = 'public' 
    AND tablename = 'users'
ORDER BY policyname;

-- 7. PRUEBA: Verificar que un admin puede actualizar otros usuarios
-- ============================================
SELECT 
    '\n=== PRUEBA DE PERMISOS ===' as separator;

-- Esta consulta simula lo que puede hacer el usuario actual
SELECT 
    u.id,
    u.email,
    u.role,
    u.active,
    CASE 
        WHEN current_user_role.role = 'admin' THEN '✅ Puedes modificar este usuario'
        WHEN u.id = auth.uid() THEN '✅ Puedes modificar (eres tú)'
        ELSE '❌ No puedes modificar'
    END as permiso
FROM public.users u
CROSS JOIN (
    SELECT role FROM public.users WHERE id = auth.uid()
) current_user_role
LIMIT 5;

-- 8. INFORMACIÓN ADICIONAL PARA DEBUGGING
-- ============================================
SELECT 
    '\n=== INFORMACIÓN DE SESIÓN ===' as separator;

SELECT 
    auth.uid() as tu_user_id,
    current_user as database_user,
    current_role as database_role,
    current_setting('request.jwt.claims', true)::json->>'role' as jwt_role;

-- ============================================
-- NOTA IMPORTANTE:
-- Si después de ejecutar este script sigues teniendo
-- el error "Error al actualizar usuario", verifica:
-- 
-- 1. Que el usuario que intenta hacer la actualización tiene role='admin'
-- 2. Que ese usuario admin tiene active=true
-- 3. Que estás enviando el token JWT correcto en las peticiones
-- 4. Revisa los logs de Supabase para ver el error exacto
-- ============================================