-- ============================================
-- SOLUCIÓN PARA ADVERTENCIA DE spatial_ref_sys
-- Mueve las tablas de PostGIS a un esquema separado
-- ============================================

-- 1. Crear esquema dedicado para PostGIS si no existe
CREATE SCHEMA IF NOT EXISTS postgis;

-- 2. Dar permisos necesarios al esquema
GRANT USAGE ON SCHEMA postgis TO postgres, anon, authenticated, service_role;

-- 3. Mover las tablas de PostGIS al nuevo esquema
-- IMPORTANTE: Esto requiere ser superusuario o owner de las tablas
BEGIN;

-- Verificar si las tablas existen antes de moverlas
DO $$
BEGIN
    -- spatial_ref_sys
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'spatial_ref_sys') THEN
        ALTER TABLE public.spatial_ref_sys SET SCHEMA postgis;
        RAISE NOTICE 'Tabla spatial_ref_sys movida a esquema postgis';
    END IF;
    
    -- geography_columns (si existe)
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'geography_columns') THEN
        ALTER TABLE public.geography_columns SET SCHEMA postgis;
        RAISE NOTICE 'Tabla geography_columns movida a esquema postgis';
    END IF;
    
    -- geometry_columns (si existe)
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'geometry_columns') THEN
        ALTER TABLE public.geometry_columns SET SCHEMA postgis;
        RAISE NOTICE 'Tabla geometry_columns movida a esquema postgis';
    END IF;
END$$;

COMMIT;

-- 4. Crear vistas en el esquema public que apunten a las tablas en postgis
-- Esto mantiene la compatibilidad con aplicaciones que esperan estas tablas en public
CREATE OR REPLACE VIEW public.spatial_ref_sys AS 
SELECT * FROM postgis.spatial_ref_sys;

GRANT SELECT ON public.spatial_ref_sys TO PUBLIC;

-- 5. Verificar que las tablas se movieron correctamente
SELECT 
    'PostGIS tables status:' as info,
    schemaname,
    tablename,
    CASE 
        WHEN schemaname = 'postgis' THEN '✅ En esquema seguro'
        WHEN schemaname = 'public' THEN '❌ Aún en public'
        ELSE '❓ En otro esquema'
    END as status
FROM pg_tables 
WHERE tablename IN ('spatial_ref_sys', 'geography_columns', 'geometry_columns')
ORDER BY tablename;

-- 6. Verificar que no quedan advertencias de RLS en tablas de PostGIS
SELECT 
    'Tablas en public sin RLS:' as info,
    tablename
FROM pg_tables 
WHERE schemaname = 'public' 
    AND NOT rowsecurity
    AND tablename NOT IN (
        SELECT viewname FROM pg_views WHERE schemaname = 'public'
    )
ORDER BY tablename;

-- ============================================
-- NOTA: Si el script falla con error de permisos,
-- es posible que necesites ejecutarlo como superusuario
-- o simplemente ignorar la advertencia de Supabase
-- ya que spatial_ref_sys es una tabla del sistema.
-- ============================================