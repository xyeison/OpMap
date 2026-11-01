-- =====================================================================================
-- OpMap · feat/empresas-papeles-asignaciones · 0960 — Empresas, papeles por empresa y asignaciones (capa 1)
-- Proyecto: norvxqgohddgsdkggqzq · Generado: 2026-10-31 · ESTADO: NO APLICADA (se aplica solo con autorización del dueño)
-- Spec: docs/specs/2026-10-31-empresas-papeles-y-asignaciones.md · Decisión: docs/decisiones/2026-10-31-empresas-papeles-y-asignaciones.md
-- Plan: docs/planes/2026-10-31-empresas-capa-1-modelo-y-sesion.md (tarea 2) · Rollback: 2026-10-31_9961_empresas_papeles_asignaciones_rollback.sql
--
-- Qué hace:
--   1. empresas (VG Medical y Medix, con ids fijos: VG a0000000-0000-4000-8000-000000000001, Medix …0002; espejo de
--      EMPRESA_VG_ID y EMPRESA_MEDIX_ID de web/lib/empresas-reglas.ts). Se siembran ANTES de las columnas empresa_id:
--      el DEFAULT de esas columnas apunta a VG y la llave foránea se valida sobre las filas que ya existen.
--   2. linea_empresas: en qué empresas está cada línea. Semilla: todas las business_lines en VG.
--   3. papeles: persona · empresa · papel · (línea, solo para line_leader). Los 9 papeles son los roles de hoy. Disparador
--      papeles_linea_en_empresa: la línea del papel debe estar en esa empresa ('Esa línea no está en esta empresa').
--   4. papel_zonas: Zonas de una líder de línea. Sin filas = líder nacional. Disparador DIFERIDO papeles_lider_unico (en
--      papeles y en papel_zonas, se revisa al cerrar la transacción, así una líder con Zonas entra con sus Zonas en una
--      sola transacción): por empresa y línea, entre papeles line_leader ACTIVOS de personas distintas, o una sola
--      nacional y nadie más ('Esa línea ya tiene líder nacional en esta empresa') o todas con Zonas que no se solapan
--      ('Otra líder de esa línea ya tiene alguna de esas Zonas'). Espejo de validarLiderDeLinea.
--   5. executive_empresas: a qué empresas pertenece cada persona del equipo comercial (también las vacantes). Semilla:
--      todas en VG; activo = (status <> 'inactive').
--   6. asignaciones: persona · Zona · línea · empresa. Disparador asignaciones_coherentes: la línea está en la empresa y
--      la persona también. Semilla: una por fila de executive_lines, en la zona base de la persona (base_kam_id) y en VG,
--      de personas de cualquier status: lo mismo que hay hoy.
--   7. odoo_enlaces: id de cada fila de OpMap en el Odoo de cada empresa. Semilla: executives.odoo_employee_id → (VG,
--      'executives', id, 'hr.employee', odoo_employee_id).
--   8. users.empresa_activa_id (NULL = la única o la primera; ON DELETE SET NULL).
--   9. empresa_id uuid NOT NULL DEFAULT VG → empresas en coverage, coverage_overrides, territory_snapshots, visits,
--      visitas_agenda y medico_visitantes (columna nueva con DEFAULT constante: no reescribe filas ni dispara nada, así
--      que no choca con la inmutabilidad de territory_snapshots ni con visitas_sin_borrar). El DEFAULT se quita en la capa
--      4, cuando las funciones de la base y el importador de VMO manden la empresa.
--      coverage gana la UNIQUE (empresa_id, line_id, kam_id). La UNIQUE vieja coverage_line_id_kam_id_key SE QUEDA en la
--      capa 1: el recálculo (web/lib/coverage.ts) hace upsert con onConflict 'line_id,kam_id' y PostgreSQL exige un
--      índice único con EXACTAMENTE esas columnas; sin ella "Recalcular cobertura" fallaría con el código de la capa 1.
--      La 0970 (capa 2) la quita cuando el recálculo upserte por (empresa_id, line_id, kam_id). Mientras todo es VG, las
--      dos dicen lo mismo.
--  10. Semillas, en este orden: linea_empresas, papeles, executive_empresas, asignaciones, odoo_enlaces. Cada una (salvo
--      odoo_enlaces) corre SOLO si su tabla está vacía: volver a ejecutar la 0960 después de que el dueño editó papeles o
--      líneas no le devuelve lo que quitó. Todas con ON CONFLICT DO NOTHING.
--      papeles (espejo de papelesDeSemilla): por cada usuario ACTIVO con role distinto de 'line_leader', una fila en VG
--      con su role, y otra en Medix si es admin o commercial_director; por cada línea cuyo leader_user_id es un usuario
--      ACTIVO, una fila line_leader en VG con esa línea (un leader_user_id inactivo o inexistente no produce fila).
--  11. users.role y business_lines.leader_user_id quedan como CACHÉ que escribe el servidor (users.role = el papel más
--      alto en VG; leader_user_id = la líder nacional de VG) hasta la capa 4. Esta migración no los toca.
--  12. Bloque DO de pruebas que se deshace (SQLSTATE 'P0960').
--
-- Precondiciones (RAISE y no se aplica nada): faltan tablas (users, business_lines, executives, executive_lines, kams,
--   coverage, coverage_overrides, territory_snapshots, visits, visitas_agenda, medico_visitantes); y, solo si se van a
--   sembrar (tablas vacías o sin crear): algún usuario activo con role fuera de los 9; algún usuario activo
--   'line_leader' que no lidera ninguna línea (se dice cuántos: cambiarle el rol en /users antes de este despliegue o
--   poner business_lines.leader_user_id por SQL con autorización del dueño; en Líneas no hay selector de líder); alguna
--   fila de executive_lines de una persona sin base_kam_id.
--
-- Consulta de SOLO LECTURA que el dueño corre ANTES de aplicar (no escribe nada):
--   SELECT u.id, u.full_name, u.role, string_agg(bl.name, ', ' ORDER BY bl.name) AS lidera
--   FROM public.users u
--   LEFT JOIN public.business_lines bl ON bl.leader_user_id = u.id
--   WHERE u.active IS TRUE AND (u.role = 'line_leader' OR bl.id IS NOT NULL)
--   GROUP BY u.id, u.full_name, u.role
--   ORDER BY u.role, u.full_name;
--   · role = 'line_leader' y lidera NULL → la 0960 se detiene (precondición de arriba).
--   · role <> 'line_leader' y lidera algo → recibe ADEMÁS el papel line_leader de esas líneas (si es director comercial,
--     verá también "Agendamiento"); la 0960 lo avisa con un NOTICE que dice cuántos y sus ids.
--
-- Transaccional: todo o nada. Re-ejecutable: sí (IF NOT EXISTS / CREATE OR REPLACE / DROP TRIGGER IF EXISTS + CREATE;
--   semillas solo sobre tablas vacías y con ON CONFLICT DO NOTHING). Costo Google: 0. No recalcula cobertura ni
--   asignaciones. Después: NOTIFY pgrst, 'reload schema'; (va al final del archivo).
-- =====================================================================================

BEGIN;

-- -------------------------------------------------------------------------------------
-- 0. Precondiciones
-- -------------------------------------------------------------------------------------
DO $$
DECLARE
  v_tabla      text;
  v_sembrar    boolean;
  v_rol_raro   integer;
  v_sin_linea  integer;
  v_sin_base   integer;
BEGIN
  FOREACH v_tabla IN ARRAY ARRAY['users', 'business_lines', 'executives', 'executive_lines', 'kams', 'coverage',
                                 'coverage_overrides', 'territory_snapshots', 'visits', 'visitas_agenda', 'medico_visitantes']
  LOOP
    IF to_regclass('public.' || v_tabla) IS NULL THEN
      RAISE EXCEPTION '0960: falta la tabla public.%', v_tabla;
    END IF;
  END LOOP;

  -- Las semillas de papeles solo corren si la tabla no existe o está vacía (primera aplicación)
  v_sembrar := to_regclass('public.papeles') IS NULL;
  IF NOT v_sembrar THEN
    EXECUTE 'SELECT NOT EXISTS (SELECT 1 FROM public.papeles)' INTO v_sembrar;
  END IF;
  IF v_sembrar THEN
    SELECT count(*) INTO v_rol_raro
    FROM public.users u
    WHERE u.active IS TRUE
      AND (u.role IS NULL OR u.role NOT IN ('admin', 'commercial_director', 'line_leader', 'sales_manager',
                                            'contract_manager', 'data_manager', 'hr', 'viewer', 'user'));
    IF v_rol_raro > 0 THEN
      RAISE EXCEPTION '0960: hay % usuario(s) activo(s) con un role que no es uno de los 9 papeles; corregirlos antes', v_rol_raro;
    END IF;

    SELECT count(*) INTO v_sin_linea
    FROM public.users u
    WHERE u.active IS TRUE
      AND u.role = 'line_leader'
      AND NOT EXISTS (SELECT 1 FROM public.business_lines bl WHERE bl.leader_user_id = u.id);
    IF v_sin_linea > 0 THEN
      RAISE EXCEPTION '0960: hay % líder(es) de negocio activo(s) sin línea (users.role = line_leader y ninguna business_lines.leader_user_id lo apunta)', v_sin_linea
        USING HINT = 'Cambiarle el rol en /users antes de este despliegue o poner business_lines.leader_user_id por SQL con autorización del dueño (en Líneas no hay selector de líder); luego se vuelve a correr la 0960.';
    END IF;
  END IF;

  -- La semilla de asignaciones solo corre si la tabla no existe o está vacía
  v_sembrar := to_regclass('public.asignaciones') IS NULL;
  IF NOT v_sembrar THEN
    EXECUTE 'SELECT NOT EXISTS (SELECT 1 FROM public.asignaciones)' INTO v_sembrar;
  END IF;
  IF v_sembrar THEN
    SELECT count(*) INTO v_sin_base
    FROM public.executive_lines el
    JOIN public.executives e ON e.id = el.executive_id
    WHERE e.base_kam_id IS NULL;
    IF v_sin_base > 0 THEN
      RAISE EXCEPTION '0960: hay % fila(s) de executive_lines de personas sin zona base (base_kam_id NULL)', v_sin_base
        USING HINT = 'Ponerles Zona en Ejecutivos Comerciales o quitarles esas líneas; luego se vuelve a correr la 0960.';
    END IF;
  END IF;
END
$$;

-- -------------------------------------------------------------------------------------
-- 1. empresas (y su semilla, antes de cualquier columna empresa_id)
-- -------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.empresas (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo       text        NOT NULL UNIQUE,
  nombre       text        NOT NULL,
  nombre_corto text        NOT NULL,
  nit          text        NULL,
  activa       boolean     NOT NULL DEFAULT true,
  odoo_url     text        NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.empresas FROM PUBLIC;
REVOKE ALL ON public.empresas FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.empresas TO service_role;

INSERT INTO public.empresas (id, codigo, nombre, nombre_corto, nit, activa)
VALUES ('a0000000-0000-4000-8000-000000000001'::uuid, 'vg', 'VG Medical SAS', 'VG', '901080496', true),
       ('a0000000-0000-4000-8000-000000000002'::uuid, 'medix', 'Medix', 'Medix', NULL, true)
ON CONFLICT DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.empresas WHERE id = 'a0000000-0000-4000-8000-000000000001'::uuid AND codigo = 'vg')
     OR NOT EXISTS (SELECT 1 FROM public.empresas WHERE id = 'a0000000-0000-4000-8000-000000000002'::uuid AND codigo = 'medix') THEN
    RAISE EXCEPTION '0960: VG (…0001, vg) o Medix (…0002, medix) no quedaron con su id fijo (¿un código ya usado con otro id?)';
  END IF;
END
$$;

-- -------------------------------------------------------------------------------------
-- 2. linea_empresas
-- -------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.linea_empresas (
  line_id    uuid NOT NULL REFERENCES public.business_lines(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL DEFAULT 'a0000000-0000-4000-8000-000000000001'::uuid REFERENCES public.empresas(id),
  PRIMARY KEY (line_id, empresa_id)
);
CREATE INDEX IF NOT EXISTS linea_empresas_empresa_idx ON public.linea_empresas (empresa_id);
ALTER TABLE public.linea_empresas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.linea_empresas FROM PUBLIC;
REVOKE ALL ON public.linea_empresas FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.linea_empresas TO service_role;

-- -------------------------------------------------------------------------------------
-- 3. papeles
-- -------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.papeles (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  empresa_id uuid        NOT NULL DEFAULT 'a0000000-0000-4000-8000-000000000001'::uuid REFERENCES public.empresas(id),
  papel      text        NOT NULL CHECK (papel IN ('admin', 'commercial_director', 'line_leader', 'sales_manager',
                                                   'contract_manager', 'data_manager', 'hr', 'viewer', 'user')),
  line_id    uuid        NULL     REFERENCES public.business_lines(id),
  activo     boolean     NOT NULL DEFAULT true,
  created_by uuid        NULL     REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT papeles_linea_solo_lider CHECK ((papel = 'line_leader') = (line_id IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS papeles_unico_idx
  ON public.papeles (user_id, empresa_id, papel, (coalesce(line_id, '00000000-0000-0000-0000-000000000000'::uuid)));
CREATE INDEX IF NOT EXISTS papeles_lider_linea_idx
  ON public.papeles (empresa_id, line_id) WHERE papel = 'line_leader';
CREATE INDEX IF NOT EXISTS papeles_line_idx ON public.papeles (line_id) WHERE line_id IS NOT NULL;
ALTER TABLE public.papeles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.papeles FROM PUBLIC;
REVOKE ALL ON public.papeles FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.papeles TO service_role;

-- La línea de un papel de líder debe estar en esa empresa. Corre en todo UPDATE (no solo de line_id/empresa_id): así no
-- se reactiva el papel de una línea que ya salió de la empresa.
CREATE OR REPLACE FUNCTION public.papeles_linea_en_empresa_trg()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.line_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.linea_empresas le
                     WHERE le.line_id = NEW.line_id AND le.empresa_id = NEW.empresa_id) THEN
    RAISE EXCEPTION 'Esa línea no está en esta empresa'
      USING ERRCODE = 'check_violation',
            DETAIL = format('papeles: línea %s, empresa %s', NEW.line_id, NEW.empresa_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER papeles_linea_en_empresa
  BEFORE INSERT OR UPDATE ON public.papeles
  FOR EACH ROW EXECUTE FUNCTION public.papeles_linea_en_empresa_trg();

-- -------------------------------------------------------------------------------------
-- 4. papel_zonas y la regla de líder por línea y empresa
-- -------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.papel_zonas (
  papel_id uuid NOT NULL REFERENCES public.papeles(id) ON DELETE CASCADE,
  kam_id   uuid NOT NULL REFERENCES public.kams(id),
  PRIMARY KEY (papel_id, kam_id)
);
CREATE INDEX IF NOT EXISTS papel_zonas_kam_idx ON public.papel_zonas (kam_id);
ALTER TABLE public.papel_zonas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.papel_zonas FROM PUBLIC;
REVOKE ALL ON public.papel_zonas FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.papel_zonas TO service_role;

-- Espejo de validarLiderDeLinea (web/lib/empresas-reglas.ts). Diferida: mira el estado al cerrar la transacción, sobre
-- TODO el grupo (empresa, línea) del papel tocado: entre los papeles line_leader activos de personas distintas, si hay
-- más de uno, ninguno puede ser nacional (sin Zonas) y ninguna Zona puede estar en dos. Un candado por (empresa, línea)
-- hace que dos transacciones simultáneas se revisen una después de la otra (en READ COMMITTED, la consulta posterior
-- al candado ve lo que la otra ya confirmó).
CREATE OR REPLACE FUNCTION public.papeles_lider_unico_trg()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_papeles uuid[];
  v_papel   uuid;
  v_empresa uuid;
  v_linea   uuid;
BEGIN
  IF TG_TABLE_NAME = 'papeles' THEN
    v_papeles := ARRAY[NEW.id];
  ELSIF TG_OP = 'INSERT' THEN
    v_papeles := ARRAY[NEW.papel_id];
  ELSIF TG_OP = 'DELETE' THEN
    v_papeles := ARRAY[OLD.papel_id];          -- quitar la última Zona vuelve nacional a la líder
  ELSE
    v_papeles := ARRAY[OLD.papel_id, NEW.papel_id];
  END IF;

  FOREACH v_papel IN ARRAY v_papeles LOOP
    v_empresa := NULL;
    v_linea := NULL;
    -- El papel ya puede no existir (borrado en cascada) o no ser una líder activa: entonces no hay nada que revisar
    SELECT p.empresa_id, p.line_id INTO v_empresa, v_linea
    FROM public.papeles p
    WHERE p.id = v_papel AND p.papel = 'line_leader' AND p.activo;
    CONTINUE WHEN v_linea IS NULL;

    PERFORM pg_advisory_xact_lock(hashtextextended('papeles_lider_unico:' || v_empresa::text || ':' || v_linea::text, 0));

    IF (SELECT count(DISTINCT p.user_id) FROM public.papeles p
        WHERE p.empresa_id = v_empresa AND p.line_id = v_linea AND p.papel = 'line_leader' AND p.activo) > 1 THEN
      IF EXISTS (SELECT 1 FROM public.papeles p
                 WHERE p.empresa_id = v_empresa AND p.line_id = v_linea AND p.papel = 'line_leader' AND p.activo
                   AND NOT EXISTS (SELECT 1 FROM public.papel_zonas z WHERE z.papel_id = p.id)) THEN
        RAISE EXCEPTION 'Esa línea ya tiene líder nacional en esta empresa'
          USING ERRCODE = 'check_violation',
                DETAIL = format('papeles: línea %s, empresa %s', v_linea, v_empresa);
      END IF;
      IF EXISTS (SELECT 1
                 FROM public.papel_zonas z
                 JOIN public.papeles p ON p.id = z.papel_id
                 WHERE p.empresa_id = v_empresa AND p.line_id = v_linea AND p.papel = 'line_leader' AND p.activo
                 GROUP BY z.kam_id
                 HAVING count(DISTINCT p.user_id) > 1) THEN
        RAISE EXCEPTION 'Otra líder de esa línea ya tiene alguna de esas Zonas'
          USING ERRCODE = 'check_violation',
                DETAIL = format('papeles: línea %s, empresa %s', v_linea, v_empresa);
      END IF;
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$;

-- CREATE OR REPLACE no vale para un CONSTRAINT TRIGGER: se borra y se crea (re-ejecutable). El mismo nombre en las dos
-- tablas: SET CONSTRAINTS public.papeles_lider_unico IMMEDIATE las adelanta a las dos.
DROP TRIGGER IF EXISTS papeles_lider_unico ON public.papeles;
CREATE CONSTRAINT TRIGGER papeles_lider_unico
  AFTER INSERT OR UPDATE ON public.papeles
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.papeles_lider_unico_trg();

DROP TRIGGER IF EXISTS papeles_lider_unico ON public.papel_zonas;
CREATE CONSTRAINT TRIGGER papeles_lider_unico
  AFTER INSERT OR UPDATE OR DELETE ON public.papel_zonas
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.papeles_lider_unico_trg();

-- -------------------------------------------------------------------------------------
-- 5. executive_empresas
-- -------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.executive_empresas (
  executive_id uuid    NOT NULL REFERENCES public.executives(id) ON DELETE CASCADE,
  empresa_id   uuid    NOT NULL DEFAULT 'a0000000-0000-4000-8000-000000000001'::uuid REFERENCES public.empresas(id),
  activo       boolean NOT NULL DEFAULT true,
  PRIMARY KEY (executive_id, empresa_id)
);
CREATE INDEX IF NOT EXISTS executive_empresas_empresa_idx ON public.executive_empresas (empresa_id);
ALTER TABLE public.executive_empresas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.executive_empresas FROM PUBLIC;
REVOKE ALL ON public.executive_empresas FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.executive_empresas TO service_role;

-- -------------------------------------------------------------------------------------
-- 6. asignaciones
-- -------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.asignaciones (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  executive_id uuid        NOT NULL REFERENCES public.executives(id) ON DELETE CASCADE,
  kam_id       uuid        NOT NULL REFERENCES public.kams(id) ON DELETE CASCADE,
  line_id      uuid        NOT NULL REFERENCES public.business_lines(id) ON DELETE CASCADE,
  empresa_id   uuid        NOT NULL DEFAULT 'a0000000-0000-4000-8000-000000000001'::uuid REFERENCES public.empresas(id),
  created_by   uuid        NULL     REFERENCES public.users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT asignaciones_unica UNIQUE (executive_id, kam_id, line_id, empresa_id)
);
CREATE INDEX IF NOT EXISTS asignaciones_kam_idx ON public.asignaciones (kam_id);
CREATE INDEX IF NOT EXISTS asignaciones_linea_empresa_idx ON public.asignaciones (line_id, empresa_id);
ALTER TABLE public.asignaciones ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.asignaciones FROM PUBLIC;
REVOKE ALL ON public.asignaciones FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.asignaciones TO service_role;

-- La línea está en la empresa y la persona también (activa o no: las inactivas conservan su historia). Corre en todo
-- UPDATE por la misma razón que papeles_linea_en_empresa.
CREATE OR REPLACE FUNCTION public.asignaciones_coherentes_trg()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.linea_empresas le
                 WHERE le.line_id = NEW.line_id AND le.empresa_id = NEW.empresa_id) THEN
    RAISE EXCEPTION 'Esa línea no está en esta empresa'
      USING ERRCODE = 'check_violation',
            DETAIL = format('asignaciones: línea %s, empresa %s', NEW.line_id, NEW.empresa_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.executive_empresas ee
                 WHERE ee.executive_id = NEW.executive_id AND ee.empresa_id = NEW.empresa_id) THEN
    RAISE EXCEPTION 'Esa persona no está en esta empresa'
      USING ERRCODE = 'check_violation',
            DETAIL = format('asignaciones: persona %s, empresa %s', NEW.executive_id, NEW.empresa_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER asignaciones_coherentes
  BEFORE INSERT OR UPDATE ON public.asignaciones
  FOR EACH ROW EXECUTE FUNCTION public.asignaciones_coherentes_trg();

-- -------------------------------------------------------------------------------------
-- 7. odoo_enlaces
-- -------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.odoo_enlaces (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid        NOT NULL DEFAULT 'a0000000-0000-4000-8000-000000000001'::uuid REFERENCES public.empresas(id),
  tabla      text        NOT NULL CHECK (btrim(tabla) <> ''),
  fila_id    uuid        NOT NULL,
  modelo     text        NOT NULL CHECK (btrim(modelo) <> ''),
  odoo_id    integer     NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT odoo_enlaces_fila_unica UNIQUE (empresa_id, tabla, fila_id),
  CONSTRAINT odoo_enlaces_odoo_unico UNIQUE (empresa_id, modelo, odoo_id)
);
ALTER TABLE public.odoo_enlaces ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.odoo_enlaces FROM PUBLIC;
REVOKE ALL ON public.odoo_enlaces FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.odoo_enlaces TO service_role;

-- -------------------------------------------------------------------------------------
-- 8. users.empresa_activa_id
-- -------------------------------------------------------------------------------------
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS empresa_activa_id uuid NULL REFERENCES public.empresas(id) ON DELETE SET NULL;

-- -------------------------------------------------------------------------------------
-- 9. empresa_id en lo que es de cada empresa (DEFAULT VG hasta la capa 4)
-- -------------------------------------------------------------------------------------
ALTER TABLE public.coverage
  ADD COLUMN IF NOT EXISTS empresa_id uuid NOT NULL DEFAULT 'a0000000-0000-4000-8000-000000000001'::uuid REFERENCES public.empresas(id);
ALTER TABLE public.coverage_overrides
  ADD COLUMN IF NOT EXISTS empresa_id uuid NOT NULL DEFAULT 'a0000000-0000-4000-8000-000000000001'::uuid REFERENCES public.empresas(id);
ALTER TABLE public.territory_snapshots
  ADD COLUMN IF NOT EXISTS empresa_id uuid NOT NULL DEFAULT 'a0000000-0000-4000-8000-000000000001'::uuid REFERENCES public.empresas(id);
ALTER TABLE public.visits
  ADD COLUMN IF NOT EXISTS empresa_id uuid NOT NULL DEFAULT 'a0000000-0000-4000-8000-000000000001'::uuid REFERENCES public.empresas(id);
ALTER TABLE public.visitas_agenda
  ADD COLUMN IF NOT EXISTS empresa_id uuid NOT NULL DEFAULT 'a0000000-0000-4000-8000-000000000001'::uuid REFERENCES public.empresas(id);
ALTER TABLE public.medico_visitantes
  ADD COLUMN IF NOT EXISTS empresa_id uuid NOT NULL DEFAULT 'a0000000-0000-4000-8000-000000000001'::uuid REFERENCES public.empresas(id);

-- coverage: única por (empresa_id, line_id, kam_id). La vieja (line_id, kam_id) se queda hasta la 0970 (ver encabezado).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid = 'public.coverage'::regclass AND conname = 'coverage_empresa_line_kam_key') THEN
    ALTER TABLE public.coverage
      ADD CONSTRAINT coverage_empresa_line_kam_key UNIQUE (empresa_id, line_id, kam_id);
  END IF;
END
$$;

-- -------------------------------------------------------------------------------------
-- 10. Semillas (cada una solo sobre su tabla vacía; ver encabezado). Toda la estructura ya está creada: después de
--     escribir en papeles quedan eventos diferidos pendientes y PostgreSQL no deja ALTER ni CREATE INDEX sobre ella.
-- -------------------------------------------------------------------------------------
DO $$
DECLARE
  v_vg     constant uuid := 'a0000000-0000-4000-8000-000000000001'::uuid;
  v_medix  constant uuid := 'a0000000-0000-4000-8000-000000000002'::uuid;
  v_n      bigint;
  v_espera bigint;
  v_ids    text;
BEGIN
  -- 10.1 linea_empresas: todas las líneas en VG
  IF EXISTS (SELECT 1 FROM public.linea_empresas) THEN
    RAISE NOTICE '0960: linea_empresas ya tiene filas; no se siembra';
  ELSE
    INSERT INTO public.linea_empresas (line_id, empresa_id)
    SELECT bl.id, v_vg FROM public.business_lines bl
    ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RAISE NOTICE '0960: linea_empresas: % línea(s) en VG', v_n;
  END IF;

  -- 10.2 papeles (espejo de papelesDeSemilla)
  IF EXISTS (SELECT 1 FROM public.papeles) THEN
    RAISE NOTICE '0960: papeles ya tiene filas; no se siembra';
  ELSE
    INSERT INTO public.papeles (user_id, empresa_id, papel, line_id)
    SELECT u.id, e.empresa_id, u.role, NULL::uuid
    FROM public.users u
    CROSS JOIN (VALUES (v_vg), (v_medix)) AS e(empresa_id)
    WHERE u.active IS TRUE
      AND u.role <> 'line_leader'
      AND (e.empresa_id = v_vg OR u.role IN ('admin', 'commercial_director'))
    UNION ALL
    SELECT bl.leader_user_id, v_vg, 'line_leader', bl.id
    FROM public.business_lines bl
    JOIN public.users u ON u.id = bl.leader_user_id AND u.active IS TRUE
    ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS v_n = ROW_COUNT;

    SELECT (SELECT count(*) FROM public.users u WHERE u.active IS TRUE AND u.role <> 'line_leader')
         + (SELECT count(*) FROM public.users u WHERE u.active IS TRUE AND u.role IN ('admin', 'commercial_director'))
         + (SELECT count(*) FROM public.business_lines bl JOIN public.users u ON u.id = bl.leader_user_id AND u.active IS TRUE)
      INTO v_espera;
    IF v_n <> v_espera THEN
      RAISE EXCEPTION '0960: la semilla de papeles insertó % fila(s) y se esperaban %', v_n, v_espera;
    END IF;
    RAISE NOTICE '0960: papeles: % fila(s) (% en VG, % en Medix; % de líder de línea)', v_n,
      (SELECT count(*) FROM public.papeles WHERE empresa_id = v_vg),
      (SELECT count(*) FROM public.papeles WHERE empresa_id = v_medix),
      (SELECT count(*) FROM public.papeles WHERE papel = 'line_leader');

    -- La caché users.role, reescrita desde los papeles (papel más alto en VG), ¿cambiaría para alguien? Solo pasa si un
    -- usuario que NO es line_leader lidera una línea (su papel más alto en VG pasa a ser line_leader). Se avisa.
    SELECT count(*) INTO v_n
    FROM public.users u
    WHERE u.active IS TRUE
      AND u.role IS DISTINCT FROM (
        SELECT p.papel FROM public.papeles p
        WHERE p.user_id = u.id AND p.empresa_id = v_vg AND p.activo
        ORDER BY array_position(ARRAY['admin', 'commercial_director', 'line_leader', 'sales_manager', 'contract_manager',
                                      'data_manager', 'hr', 'viewer', 'user'], p.papel)
        LIMIT 1);
    IF v_n > 0 THEN
      RAISE NOTICE '0960: AVISO: para % usuario(s) activo(s) el papel más alto en VG no es su users.role de hoy (lideran una línea sin ser line_leader); el servidor reescribirá esa caché cuando se editen sus papeles', v_n;
    END IF;

    -- Y SIEMPRE (cambie o no su papel más alto): todo usuario activo que no es line_leader y figura como leader_user_id
    -- recibe también el papel line_leader de esa línea; un director comercial verá además "Agendamiento". Cuántos e ids.
    SELECT count(DISTINCT u.id), string_agg(DISTINCT u.id::text, ', ')
      INTO v_n, v_ids
    FROM public.users u
    JOIN public.business_lines bl ON bl.leader_user_id = u.id
    WHERE u.active IS TRUE
      AND u.role <> 'line_leader';
    IF v_n > 0 THEN
      RAISE NOTICE '0960: AVISO: % usuario(s) activo(s) que no son line_leader figuran como leader_user_id y reciben también el papel line_leader de esa línea (un director comercial verá además "Agendamiento"): %', v_n, v_ids;
    END IF;
  END IF;

  -- 10.3 executive_empresas: todas en VG; activo = no inactiva
  IF EXISTS (SELECT 1 FROM public.executive_empresas) THEN
    RAISE NOTICE '0960: executive_empresas ya tiene filas; no se siembra';
  ELSE
    INSERT INTO public.executive_empresas (executive_id, empresa_id, activo)
    SELECT e.id, v_vg, e.status <> 'inactive' FROM public.executives e
    ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n <> (SELECT count(*) FROM public.executives) THEN
      RAISE EXCEPTION '0960: executive_empresas sembró % fila(s) y hay % persona(s)', v_n, (SELECT count(*) FROM public.executives);
    END IF;
    RAISE NOTICE '0960: executive_empresas: % persona(s) en VG (% activas)', v_n,
      (SELECT count(*) FROM public.executive_empresas WHERE activo);
  END IF;

  -- 10.4 asignaciones: una por fila de executive_lines, en la zona base y en VG (personas de cualquier status)
  IF EXISTS (SELECT 1 FROM public.asignaciones) THEN
    RAISE NOTICE '0960: asignaciones ya tiene filas; no se siembra';
  ELSE
    INSERT INTO public.asignaciones (executive_id, kam_id, line_id, empresa_id)
    SELECT el.executive_id, e.base_kam_id, el.line_id, v_vg
    FROM public.executive_lines el
    JOIN public.executives e ON e.id = el.executive_id
    ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n <> (SELECT count(*) FROM public.executive_lines) THEN
      RAISE EXCEPTION '0960: asignaciones sembró % fila(s) y executive_lines tiene %', v_n, (SELECT count(*) FROM public.executive_lines);
    END IF;
    RAISE NOTICE '0960: asignaciones: % fila(s) (una por fila de executive_lines, en la zona base, en VG)', v_n;
  END IF;

  -- 10.5 odoo_enlaces: el hr.employee de VG de cada persona que lo tiene
  INSERT INTO public.odoo_enlaces (empresa_id, tabla, fila_id, modelo, odoo_id)
  SELECT v_vg, 'executives', e.id, 'hr.employee', e.odoo_employee_id
  FROM public.executives e
  WHERE e.odoo_employee_id IS NOT NULL
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  SELECT count(*) INTO v_espera
  FROM public.executives e
  WHERE e.odoo_employee_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.odoo_enlaces o
                    WHERE o.empresa_id = v_vg AND o.tabla = 'executives' AND o.fila_id = e.id);
  RAISE NOTICE '0960: odoo_enlaces: % enlace(s) nuevo(s) a hr.employee de VG', v_n;
  IF v_espera > 0 THEN
    RAISE NOTICE '0960: AVISO: % persona(s) con odoo_employee_id quedaron sin enlace (ese hr.employee ya está enlazado a otra fila)', v_espera;
  END IF;
END
$$;

-- -------------------------------------------------------------------------------------
-- 11. Documentación en el catálogo
-- -------------------------------------------------------------------------------------
COMMENT ON TABLE public.empresas IS
  'Empresas del grupo (0960): VG Medical (id a0000000-0000-4000-8000-000000000001, codigo vg) y Medix (…0002, medix). Zonas, médicos, cuentas, sedes e IPS son compartidos; visitas, cobertura y anexos son de cada empresa. No se borran: se desactivan (activa).';
COMMENT ON COLUMN public.empresas.codigo IS 'Código corto y único (vg, medix).';
COMMENT ON COLUMN public.empresas.nombre_corto IS 'Lo que se ve al lado del nombre de la persona en la barra (VG, Medix).';
COMMENT ON COLUMN public.empresas.odoo_url IS 'URL del Odoo de la empresa (un Odoo por empresa). NULL hasta que se conecte.';

COMMENT ON TABLE public.linea_empresas IS
  'En qué empresas existe cada línea de negocio (0960). Semilla: todas las líneas en VG; las de Medix las carga el dueño en Líneas.';

COMMENT ON TABLE public.papeles IS
  'Papeles de una persona por empresa (0960): persona · empresa · papel · (línea si es line_leader). Lo que puede hacer es la SUMA de sus papeles activos en la empresa activa. users.role (papel más alto en VG) y business_lines.leader_user_id (líder nacional de VG) son CACHÉ que escribe el servidor hasta la capa 4.';
COMMENT ON COLUMN public.papeles.papel IS 'Uno de los 9 roles de hoy: admin, commercial_director, line_leader, sales_manager, contract_manager, data_manager, hr, viewer, user.';
COMMENT ON COLUMN public.papeles.line_id IS 'Solo para line_leader (y obligatoria ahí): la línea que lidera; debe estar en esa empresa (disparador papeles_linea_en_empresa).';
COMMENT ON COLUMN public.papeles.created_by IS 'Quién lo dio (NULL = la semilla de la 0960).';

COMMENT ON TABLE public.papel_zonas IS
  'Zonas de una líder de línea (0960). Sin filas = líder nacional. Por línea y empresa: una nacional y nadie más, o varias con Zonas que no se solapan (disparador diferido papeles_lider_unico, espejo de validarLiderDeLinea).';

COMMENT ON TABLE public.executive_empresas IS
  'A qué empresas pertenece cada persona del equipo comercial, también las vacantes (0960). Reemplaza executives.company (texto). Semilla: todas en VG, activo = status <> inactive.';

COMMENT ON TABLE public.asignaciones IS
  'Qué línea lleva cada persona (o vacante) en cada Zona y empresa (0960). Reemplaza executive_lines y executive_allowed_lines desde la capa 2; la línea y la persona deben estar en la empresa (disparador asignaciones_coherentes). Semilla: una por fila de executive_lines, en la zona base y en VG.';

COMMENT ON TABLE public.odoo_enlaces IS
  'Id de una fila de OpMap (tabla, fila_id) en el Odoo de una empresa (modelo, odoo_id) (0960). Solo enlaces: no se sincroniza nada. Semilla: executives.odoo_employee_id → hr.employee de VG.';

COMMENT ON COLUMN public.users.empresa_activa_id IS
  'Empresa con la que está la persona en la web y en la app (0960). NULL = la única o la primera (VG). El claim emp del token es solo caché: manda esta columna.';

COMMENT ON COLUMN public.coverage.empresa_id IS 'Empresa de esta cobertura (0960; DEFAULT VG hasta la capa 4). Única por (empresa_id, line_id, kam_id).';
COMMENT ON COLUMN public.coverage_overrides.empresa_id IS 'Empresa del ajuste (0960; DEFAULT VG hasta la capa 4).';
COMMENT ON COLUMN public.territory_snapshots.empresa_id IS 'Empresa del anexo (0960; DEFAULT VG hasta la capa 4).';
COMMENT ON COLUMN public.visits.empresa_id IS 'Empresa de la visita: cada empresa ve solo las suyas (0960; DEFAULT VG hasta la capa 4).';
COMMENT ON COLUMN public.visitas_agenda.empresa_id IS 'Empresa de la cita (0960; DEFAULT VG hasta la capa 4).';
COMMENT ON COLUMN public.medico_visitantes.empresa_id IS 'Empresa del visitante (0960; DEFAULT VG hasta la capa 4).';

-- -------------------------------------------------------------------------------------
-- 12. Pruebas que se deshacen (SQLSTATE 'P0960')
-- -------------------------------------------------------------------------------------
DO $$
DECLARE
  v_vg     constant uuid := 'a0000000-0000-4000-8000-000000000001'::uuid;
  v_medix  constant uuid := 'a0000000-0000-4000-8000-000000000002'::uuid;
  v_tabla  text;
  v_linea  uuid;
  v_user_a uuid;
  v_user_b uuid;
  v_kam_1  uuid;
  v_kam_2  uuid;
  v_exec   uuid;
  v_pa     uuid;
  v_pb     uuid;
  v_asig   uuid;
BEGIN
  BEGIN
    -- Estructura: las 6 columnas empresa_id, NOT NULL y con DEFAULT VG
    FOREACH v_tabla IN ARRAY ARRAY['coverage', 'coverage_overrides', 'territory_snapshots', 'visits', 'visitas_agenda',
                                   'medico_visitantes']
    LOOP
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                     WHERE table_schema = 'public' AND table_name = v_tabla AND column_name = 'empresa_id'
                       AND is_nullable = 'NO' AND column_default LIKE '%a0000000-0000-4000-8000-000000000001%') THEN
        RAISE EXCEPTION '0960 prueba: %.empresa_id debe ser NOT NULL con DEFAULT VG', v_tabla;
      END IF;
    END LOOP;

    -- papeles_lider_unico: diferida por defecto en las dos tablas (así la API inserta la líder y sus Zonas en una
    -- transacción sin SET CONSTRAINTS)
    IF (SELECT count(*) FROM pg_trigger
        WHERE tgname = 'papeles_lider_unico' AND tgdeferrable AND tginitdeferred
          AND tgrelid IN ('public.papeles'::regclass, 'public.papel_zonas'::regclass)) <> 2 THEN
      RAISE EXCEPTION '0960 prueba: papeles_lider_unico debe ser DEFERRABLE INITIALLY DEFERRED en papeles y en papel_zonas';
    END IF;

    -- coverage: las dos UNIQUE, la de siempre (line_id, kam_id) y la nueva (empresa_id, line_id, kam_id)
    IF NOT EXISTS (SELECT 1 FROM pg_constraint c
                   WHERE c.conrelid = 'public.coverage'::regclass AND c.contype = 'u'
                     AND (SELECT array_agg(a.attname::text ORDER BY a.attname)
                          FROM unnest(c.conkey) AS k(attnum)
                          JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum) = ARRAY['kam_id', 'line_id'])
       OR NOT EXISTS (SELECT 1 FROM pg_constraint c
                      WHERE c.conrelid = 'public.coverage'::regclass AND c.contype = 'u'
                        AND (SELECT array_agg(a.attname::text ORDER BY a.attname)
                             FROM unnest(c.conkey) AS k(attnum)
                             JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum) = ARRAY['empresa_id', 'kam_id', 'line_id']) THEN
      RAISE EXCEPTION '0960 prueba: coverage debe tener UNIQUE (line_id, kam_id) y UNIQUE (empresa_id, line_id, kam_id)';
    END IF;

    SELECT id INTO v_user_a FROM public.users ORDER BY id LIMIT 1;
    SELECT id INTO v_user_b FROM public.users WHERE id <> v_user_a ORDER BY id LIMIT 1;
    SELECT id INTO v_kam_1 FROM public.kams ORDER BY id LIMIT 1;
    SELECT id INTO v_kam_2 FROM public.kams WHERE id <> v_kam_1 ORDER BY id LIMIT 1;
    SELECT ee.executive_id INTO v_exec
    FROM public.executive_empresas ee
    WHERE ee.empresa_id = v_vg
      AND NOT EXISTS (SELECT 1 FROM public.executive_empresas x WHERE x.executive_id = ee.executive_id AND x.empresa_id = v_medix)
    ORDER BY ee.executive_id LIMIT 1;
    IF v_user_b IS NULL OR v_kam_2 IS NULL OR v_exec IS NULL THEN
      RAISE EXCEPTION '0960 prueba: hacen falta 2 usuarios, 2 Zonas y una persona solo de VG para probar';
    END IF;

    -- Una línea de prueba, solo en VG
    INSERT INTO public.business_lines (code, name, active)
      VALUES ('prueba_0960', 'Prueba 0960', false) RETURNING id INTO v_linea;
    INSERT INTO public.linea_empresas (line_id, empresa_id) VALUES (v_linea, v_vg);

    -- line_leader exige línea, y solo line_leader la lleva
    BEGIN
      INSERT INTO public.papeles (user_id, empresa_id, papel, line_id) VALUES (v_user_a, v_vg, 'line_leader', NULL);
      RAISE EXCEPTION '0960 prueba: un line_leader sin línea debió rechazarse';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
      INSERT INTO public.papeles (user_id, empresa_id, papel, line_id) VALUES (v_user_a, v_vg, 'viewer', v_linea);
      RAISE EXCEPTION '0960 prueba: un papel que no es line_leader con línea debió rechazarse';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    -- La línea del papel debe estar en esa empresa
    BEGIN
      INSERT INTO public.papeles (user_id, empresa_id, papel, line_id) VALUES (v_user_a, v_medix, 'line_leader', v_linea);
      RAISE EXCEPTION '0960 prueba: una líder de una línea que no está en Medix debió rechazarse';
    EXCEPTION WHEN check_violation THEN
      IF SQLERRM <> 'Esa línea no está en esta empresa' THEN
        RAISE EXCEPTION '0960 prueba: mensaje inesperado para la línea fuera de la empresa: %', SQLERRM;
      END IF;
    END;

    -- Dos líderes nacionales de la misma línea y empresa: la segunda se rechaza (al revisar, SET CONSTRAINTS IMMEDIATE)
    INSERT INTO public.papeles (user_id, empresa_id, papel, line_id)
      VALUES (v_user_a, v_vg, 'line_leader', v_linea) RETURNING id INTO v_pa;
    SET CONSTRAINTS public.papeles_lider_unico IMMEDIATE;
    SET CONSTRAINTS public.papeles_lider_unico DEFERRED;
    BEGIN
      INSERT INTO public.papeles (user_id, empresa_id, papel, line_id) VALUES (v_user_b, v_vg, 'line_leader', v_linea);
      SET CONSTRAINTS public.papeles_lider_unico IMMEDIATE;
      RAISE EXCEPTION '0960 prueba: una segunda líder nacional de la misma línea y empresa debió rechazarse';
    EXCEPTION WHEN check_violation THEN
      IF SQLERRM <> 'Esa línea ya tiene líder nacional en esta empresa' THEN
        RAISE EXCEPTION '0960 prueba: mensaje inesperado para dos nacionales: %', SQLERRM;
      END IF;
    END;

    -- Diferido: dos líderes con Zonas disjuntas entran en una transacción aunque cada papel nazca un momento sin Zonas
    INSERT INTO public.papel_zonas (papel_id, kam_id) VALUES (v_pa, v_kam_1);
    INSERT INTO public.papeles (user_id, empresa_id, papel, line_id)
      VALUES (v_user_b, v_vg, 'line_leader', v_linea) RETURNING id INTO v_pb;
    INSERT INTO public.papel_zonas (papel_id, kam_id) VALUES (v_pb, v_kam_2);
    SET CONSTRAINTS public.papeles_lider_unico IMMEDIATE;
    SET CONSTRAINTS public.papeles_lider_unico DEFERRED;

    -- Una Zona en común: se rechaza
    BEGIN
      INSERT INTO public.papel_zonas (papel_id, kam_id) VALUES (v_pb, v_kam_1);
      SET CONSTRAINTS public.papeles_lider_unico IMMEDIATE;
      RAISE EXCEPTION '0960 prueba: dos líderes con una Zona en común debió rechazarse';
    EXCEPTION WHEN check_violation THEN
      IF SQLERRM <> 'Otra líder de esa línea ya tiene alguna de esas Zonas' THEN
        RAISE EXCEPTION '0960 prueba: mensaje inesperado para Zonas solapadas: %', SQLERRM;
      END IF;
    END;

    -- Quitarle sus Zonas a una de las dos la vuelve nacional junto a otra: se rechaza
    BEGIN
      DELETE FROM public.papel_zonas WHERE papel_id = v_pb;
      SET CONSTRAINTS public.papeles_lider_unico IMMEDIATE;
      RAISE EXCEPTION '0960 prueba: una nacional junto a una por Zonas debió rechazarse';
    EXCEPTION WHEN check_violation THEN
      IF SQLERRM <> 'Esa línea ya tiene líder nacional en esta empresa' THEN
        RAISE EXCEPTION '0960 prueba: mensaje inesperado al quitar las Zonas: %', SQLERRM;
      END IF;
    END;

    -- Una líder inactiva no cuenta; reactivarla junto a una nacional se rechaza
    UPDATE public.papeles SET activo = false WHERE id = v_pb;
    DELETE FROM public.papel_zonas WHERE papel_id IN (v_pa, v_pb);
    SET CONSTRAINTS public.papeles_lider_unico IMMEDIATE;
    SET CONSTRAINTS public.papeles_lider_unico DEFERRED;
    BEGIN
      UPDATE public.papeles SET activo = true WHERE id = v_pb;
      SET CONSTRAINTS public.papeles_lider_unico IMMEDIATE;
      RAISE EXCEPTION '0960 prueba: reactivar una segunda nacional debió rechazarse';
    EXCEPTION WHEN check_violation THEN
      IF SQLERRM <> 'Esa línea ya tiene líder nacional en esta empresa' THEN
        RAISE EXCEPTION '0960 prueba: mensaje inesperado al reactivar: %', SQLERRM;
      END IF;
    END;

    -- Asignaciones: sin empresa va a VG; la línea fuera de la empresa y la persona fuera de la empresa se rechazan
    INSERT INTO public.asignaciones (executive_id, kam_id, line_id)
      VALUES (v_exec, v_kam_1, v_linea) RETURNING id INTO v_asig;
    IF (SELECT empresa_id FROM public.asignaciones WHERE id = v_asig) IS DISTINCT FROM v_vg THEN
      RAISE EXCEPTION '0960 prueba: una asignación sin empresa debe quedar en VG';
    END IF;
    BEGIN
      INSERT INTO public.asignaciones (executive_id, kam_id, line_id, empresa_id) VALUES (v_exec, v_kam_1, v_linea, v_medix);
      RAISE EXCEPTION '0960 prueba: una asignación con una línea que no está en Medix debió rechazarse';
    EXCEPTION WHEN check_violation THEN
      IF SQLERRM <> 'Esa línea no está en esta empresa' THEN
        RAISE EXCEPTION '0960 prueba: mensaje inesperado para la asignación fuera de la empresa: %', SQLERRM;
      END IF;
    END;
    INSERT INTO public.linea_empresas (line_id, empresa_id) VALUES (v_linea, v_medix);
    BEGIN
      INSERT INTO public.asignaciones (executive_id, kam_id, line_id, empresa_id) VALUES (v_exec, v_kam_1, v_linea, v_medix);
      RAISE EXCEPTION '0960 prueba: una asignación de una persona que no está en Medix debió rechazarse';
    EXCEPTION WHEN check_violation THEN
      IF SQLERRM <> 'Esa persona no está en esta empresa' THEN
        RAISE EXCEPTION '0960 prueba: mensaje inesperado para la persona fuera de la empresa: %', SQLERRM;
      END IF;
    END;
    BEGIN
      INSERT INTO public.asignaciones (executive_id, kam_id, line_id) VALUES (v_exec, v_kam_1, v_linea);
      RAISE EXCEPTION '0960 prueba: la misma asignación dos veces debió rechazarse';
    EXCEPTION WHEN unique_violation THEN NULL;
    END;

    -- Mismo papel dos veces para la misma persona y empresa: el índice único lo impide (también sin línea)
    BEGIN
      INSERT INTO public.papeles (user_id, empresa_id, papel) VALUES (v_user_a, v_medix, 'viewer');
      INSERT INTO public.papeles (user_id, empresa_id, papel) VALUES (v_user_a, v_medix, 'viewer');
      RAISE EXCEPTION '0960 prueba: el mismo papel dos veces debió rechazarse';
    EXCEPTION WHEN unique_violation THEN NULL;
    END;

    RAISE SQLSTATE 'P0960';
  EXCEPTION
    WHEN SQLSTATE 'P0960' THEN NULL;
  END;
END
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';
