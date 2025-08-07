-- Script minimalista para habilitar RLS en las tablas esenciales
-- Solo habilitamos RLS, sin tocar las vistas ni crear políticas duplicadas

-- ============================================
-- 1. HABILITAR RLS EN TODAS LAS TABLAS NECESARIAS
-- ============================================

-- Habilitar RLS en las tablas principales
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visit_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.municipalities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.department_adjacency ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospital_kam_distances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forced_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospital_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 2. CREAR POLÍTICAS SOLO SI NO EXISTEN
-- ============================================

-- Para tablas de referencia (departments, municipalities, department_adjacency)
DO $$
BEGIN
  -- departments
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'departments'
  ) THEN
    CREATE POLICY "Allow public read access" ON public.departments
      FOR SELECT USING (true);
  END IF;

  -- municipalities  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'municipalities'
  ) THEN
    CREATE POLICY "Allow public read access" ON public.municipalities
      FOR SELECT USING (true);
  END IF;

  -- department_adjacency
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'department_adjacency'
  ) THEN
    CREATE POLICY "Allow public read access" ON public.department_adjacency
      FOR SELECT USING (true);
  END IF;

  -- hospital_kam_distances
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'hospital_kam_distances'
  ) THEN
    CREATE POLICY "Allow public read access" ON public.hospital_kam_distances
      FOR SELECT USING (true);
  END IF;

  -- forced_assignments
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'forced_assignments'
  ) THEN
    CREATE POLICY "Allow public read access" ON public.forced_assignments
      FOR SELECT USING (true);
  END IF;

  -- hospital_contracts (si no tiene políticas)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'hospital_contracts'
  ) THEN
    CREATE POLICY "Allow public read access" ON public.hospital_contracts
      FOR SELECT USING (true);
  END IF;

  -- users (políticas especiales)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'users'
  ) THEN
    CREATE POLICY "Users can view own data" ON public.users
      FOR SELECT USING (auth.uid() = id);
    
    CREATE POLICY "Admin can view all" ON public.users
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.id = auth.uid()
          AND u.role = 'admin'
        )
      );
  END IF;
END $$;

-- ============================================
-- 3. VERIFICACIÓN FINAL
-- ============================================

-- Mostrar estado de RLS
SELECT 
  tablename,
  CASE WHEN rowsecurity THEN '✓ RLS Habilitado' ELSE '✗ RLS Deshabilitado' END AS estado
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename NOT IN ('spatial_ref_sys') -- Excluir tabla del sistema
ORDER BY tablename;

-- Contar políticas por tabla
SELECT 
  tablename,
  COUNT(*) as num_politicas
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;