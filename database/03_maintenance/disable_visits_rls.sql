-- Desactivar RLS para las tablas de visitas
-- NOTA: Esto es una solución temporal mientras se migra a autenticación real de Supabase

-- Desactivar RLS en las tablas de visitas
ALTER TABLE visits DISABLE ROW LEVEL SECURITY;
ALTER TABLE visit_imports DISABLE ROW LEVEL SECURITY;

-- Verificar el estado
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('visits', 'visit_imports');