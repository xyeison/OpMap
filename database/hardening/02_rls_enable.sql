-- =====================================================================================
-- OpMap · Endurecimiento Supabase · 02 — RLS y políticas abiertas
-- Proyecto: norvxqgohddgsdkggqzq · Generado: 2026-10-10 · NO EJECUTADO TODAVÍA
--
-- Qué cierra:
--   1. visits (7.033 filas) y visit_imports (10) no tienen RLS: con la anon key se leen,
--      modifican, borran y truncan directamente contra PostgREST.            -> C-03, SEC-DB-09
--   2. hospital_history tiene "Allow all operations" (ALL, rol public, true/true).  -> C-03
--   3. users tiene users_all (ALL para authenticated, true/true): con el signup de Supabase
--      Auth abierto, cualquiera que se registre lee y escribe toda la tabla users.   -> A-01
--   4. Lectura pública (SELECT USING true para public) de tablas internas: estados financieros
--      de la empresa, balances/contactos/notas de proveedores, comentarios, asignaciones
--      forzadas, zonas (email/teléfono de coordinadores) y la matriz de distancias pagada. -> C-05
--
-- Por qué no se crean políticas nuevas: la app usa auth propia (tabla public.users, sin
--   Supabase Auth) y el servidor accede SIEMPRE con service_role, que hace bypass de RLS.
--   Una tabla con RLS activo y sin políticas queda cerrada para anon/authenticated y abierta
--   para service_role, que es exactamente lo que se quiere.
--
-- Se CONSERVA la lectura pública (anon) SOLO en: departments, municipalities,
--   department_adjacency, hospitals y kams. No se tocan sus políticas.
--   kams: columnas confirmadas por SELECT (id, name, area_id, lat, lng, enable_level2,
--   max_travel_time, priority, color, active, created_at, updated_at,
--   participates_in_assignment, zone_id). No hay columnas sensibles (sin email/teléfono);
--   lat/lng son la ubicación base que el mapa ya dibuja. Por eso NO se crea kams_public.
--
-- PRERREQUISITO (R2-M-04): desplegar antes el código de la rama audit/hardening-semana1.
--   Si visits/import sigue usando la anon key, activar RLS rompe la importación de visitas
--   (INSERT en visit_imports -> 42501). Ver 00_README.md.
--
-- Políticas confirmadas con SELECT sobre pg_policies el 2026-10-10: 51 en public + 3 en
--   storage. Este script elimina 12; quedan 39 en public (todas para authenticated, o para
--   public con condición auth.role()/auth.uid()/auth.jwt() que anon no cumple, o lectura de
--   las 5 tablas públicas).
-- Idempotente: sí. Rollback: ver 99_rollback.sql (sección 02).
-- =====================================================================================

BEGIN;

-- 1. RLS en visits y visit_imports (C-03, SEC-DB-09). Sin políticas: solo service_role.
ALTER TABLE public.visits        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visit_imports ENABLE ROW LEVEL SECURITY;

-- 2. hospital_history: fuera la política ALL para public (C-03).
--    Queda history_all_authenticated (inerte tras 03: authenticated no tendrá privilegios).
DROP POLICY IF EXISTS "Allow all operations" ON public.hospital_history;

-- 3. users: fuera users_all (A-01). users queda con RLS y sin políticas: solo service_role.
DROP POLICY IF EXISTS users_all ON public.users;

-- 4. Lectura pública de tablas internas (C-05)
DROP POLICY IF EXISTS mi_empresa_read_all            ON public.mi_empresa_config;
DROP POLICY IF EXISTS proveedores_read_public        ON public.proveedores;
DROP POLICY IF EXISTS finanzas_read_public           ON public.proveedor_finanzas;
DROP POLICY IF EXISTS indicadores_read_public        ON public.proveedor_indicadores;
DROP POLICY IF EXISTS contactos_read_public          ON public.proveedor_contactos;
DROP POLICY IF EXISTS enlaces_read_public            ON public.proveedor_enlaces;
DROP POLICY IF EXISTS "Todos pueden ver comentarios" ON public.hospital_comments;
DROP POLICY IF EXISTS "Allow public read access"     ON public.forced_assignments;
DROP POLICY IF EXISTS zones_read_all                 ON public.zones;
DROP POLICY IF EXISTS "Allow public read access"     ON public.hospital_kam_distances;
-- hospital_history no tiene política *_read_public propia: su exposición era "Allow all
-- operations" (punto 2).

-- Comprobaciones: se aborta la transacción si algo no quedó como se espera.
DO $$
DECLARE
  sin_rls  text;
  abiertas text;
BEGIN
  -- a) Todas las tablas propias de public con RLS (spatial_ref_sys es de PostGIS y no es nuestra).
  SELECT string_agg(c.relname, ', ' ORDER BY c.relname)
    INTO sin_rls
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
     AND c.relkind IN ('r', 'p')
     AND pg_get_userbyid(c.relowner) = 'postgres'
     AND NOT c.relrowsecurity;
  IF sin_rls IS NOT NULL THEN
    RAISE EXCEPTION 'Tablas propias sin RLS: %', sin_rls;
  END IF;

  -- b) Ninguna política para public/anon con USING true fuera de las 5 tablas públicas.
  SELECT string_agg(tablename || '.' || policyname, ', ' ORDER BY tablename, policyname)
    INTO abiertas
    FROM pg_policies
   WHERE schemaname = 'public'
     AND (roles && ARRAY['public', 'anon']::name[])
     AND coalesce(qual, with_check) = 'true'
     AND tablename NOT IN ('departments', 'municipalities', 'department_adjacency', 'hospitals', 'kams');
  IF abiertas IS NOT NULL THEN
    RAISE EXCEPTION 'Quedan políticas abiertas a public/anon en tablas internas: %', abiertas;
  END IF;

  -- c) users sin políticas.
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'users') THEN
    RAISE EXCEPTION 'La tabla users todavía tiene políticas';
  END IF;
END $$;

COMMIT;
