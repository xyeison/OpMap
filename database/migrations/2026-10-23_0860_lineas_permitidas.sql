-- =====================================================================================
-- OpMap · feat/zonas-por-linea (Zonas por línea para las líderes) · 0860 — Líneas permitidas por persona
-- Proyecto: norvxqgohddgsdkggqzq · Generado: 2026-10-23 · NO EJECUTADO TODAVÍA
--
-- Decisión del dueño (2026-10-23, docs/decisiones/2026-10-23-zonas-por-linea-las-lideres-asignan.md, punto 4):
--   "los ejecutivos comerciales tienen que tener [un campo]: esta persona nada más puede tener estas unidades de
--   negocio, de forma restrictiva, para que no puedan asignarle por error". Es una restricción de la dirección para
--   que una líder, al dar su línea desde la página Zonas, no se la dé a quien no debe. Sin filas = sin restricción.
--   Spec: docs/specs/2026-10-23-zonas-por-linea-para-lideres.md ("Líneas permitidas").
--
-- Qué hace (ADITIVA: una tabla nueva, ninguna fila existente cambia):
--   1. public.executive_allowed_lines (executive_id → executives, line_id → business_lines, created_by → users NULL,
--      created_at). PK (executive_id, line_id). ON DELETE CASCADE en ambas llaves: si desaparece la persona o la línea,
--      la restricción se va con ella.
--   2. Índice por line_id (la PK ya cubre executive_id).
--   3. RLS activado y SIN políticas; REVOKE ALL a anon/authenticated; GRANT a service_role (solo el servidor la usa,
--      igual que las 6 tablas de la Fase 1: database/hardening/02 y 03).
--   4. Comentarios en el catálogo.
--   5. Bloque DO final que comprueba todo y aborta la transacción si algo no cuadra.
--
-- Quién la lee y escribe: GET/POST/PATCH /api/executives (campo lineas_permitidas; permiso executives:edit para
--   escribir) y PUT /api/executives/[id]/lineas/[lineId] (409 si la línea no está permitida). Si la tabla no existe
--   todavía, la API responde lineas_permitidas = null (sin 500): el código puede desplegarse antes que esta migración.
--
-- Requiere: Fase 1 aplicada (0100: executives, business_lines) y public.users.
-- Transaccional: todo o nada. Re-ejecutable: sí (IF NOT EXISTS; REVOKE/GRANT idempotentes).
-- Tras aplicar: NOTIFY pgrst, 'reload schema';  (PostgREST debe ver la tabla nueva).
-- Rollback: 2026-10-23_9946_lineas_permitidas_rollback.sql. Costo Google: 0. No recalcula nada.
-- Datos iniciales: los pone la migración 0870 (dos restricciones de Barranquilla), no esta.
-- =====================================================================================

BEGIN;

-- -------------------------------------------------------------------------------------
-- 0. Precondiciones
-- -------------------------------------------------------------------------------------

DO $$
BEGIN
  IF to_regclass('public.executives') IS NULL OR to_regclass('public.business_lines') IS NULL THEN
    RAISE EXCEPTION '0860 Líneas permitidas: faltan executives o business_lines (Fase 1, migración 0100)';
  END IF;
  IF to_regclass('public.users') IS NULL THEN
    RAISE EXCEPTION '0860 Líneas permitidas: falta public.users';
  END IF;
END;
$$;

-- -------------------------------------------------------------------------------------
-- 1. Tabla
-- -------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.executive_allowed_lines (
  executive_id uuid        NOT NULL REFERENCES public.executives(id)     ON DELETE CASCADE,
  line_id      uuid        NOT NULL REFERENCES public.business_lines(id) ON DELETE CASCADE,
  created_by   uuid        NULL     REFERENCES public.users(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (executive_id, line_id)
);

-- -------------------------------------------------------------------------------------
-- 2. Índice (la PK ya cubre las consultas por executive_id)
-- -------------------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS executive_allowed_lines_line_id_idx ON public.executive_allowed_lines (line_id);

-- -------------------------------------------------------------------------------------
-- 3. RLS activado y SIN políticas; fuera todo privilegio de anon/authenticated; service_role explícito
-- -------------------------------------------------------------------------------------

ALTER TABLE public.executive_allowed_lines ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.executive_allowed_lines FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.executive_allowed_lines TO service_role;

-- -------------------------------------------------------------------------------------
-- 4. Documentación en el catálogo
-- -------------------------------------------------------------------------------------

COMMENT ON TABLE public.executive_allowed_lines IS
  'Líneas que la dirección permite a un Ejecutivo Comercial o vacante. Sin filas = sin restricción '
  '(decisión del dueño 2026-10-23). Con filas, la API solo deja asignarle esas líneas (executive_lines ⊆ '
  'executive_allowed_lines): PATCH /api/executives/[id] responde 400 y PUT /api/executives/[id]/lineas/[lineId] 409.';
COMMENT ON COLUMN public.executive_allowed_lines.executive_id IS 'Persona o vacante (executives) a la que aplica la restricción.';
COMMENT ON COLUMN public.executive_allowed_lines.line_id      IS 'Línea de negocio permitida para esa persona.';
COMMENT ON COLUMN public.executive_allowed_lines.created_by   IS 'Usuario de la app que fijó la restricción; NULL si la puso una migración.';
COMMENT ON COLUMN public.executive_allowed_lines.created_at   IS 'Cuándo se fijó.';

-- -------------------------------------------------------------------------------------
-- 5. Comprobaciones: si algo no queda como se espera, se aborta toda la transacción
-- -------------------------------------------------------------------------------------

DO $$
DECLARE
  n int;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace
    WHERE ns.nspname = 'public' AND c.relname = 'executive_allowed_lines' AND c.relrowsecurity
  ) THEN
    RAISE EXCEPTION '0860 Líneas permitidas: public.executive_allowed_lines no existe o no tiene RLS activado';
  END IF;

  SELECT count(*) INTO n FROM pg_policies WHERE schemaname = 'public' AND tablename = 'executive_allowed_lines';
  IF n > 0 THEN
    RAISE EXCEPTION '0860 Líneas permitidas: la tabla tiene % política(s); debe nacer sin políticas', n;
  END IF;

  SELECT count(*) INTO n FROM information_schema.role_table_grants
  WHERE table_schema = 'public' AND table_name = 'executive_allowed_lines' AND grantee IN ('anon', 'authenticated');
  IF n > 0 THEN
    RAISE EXCEPTION '0860 Líneas permitidas: la tabla conserva % privilegio(s) para anon/authenticated', n;
  END IF;

  SELECT count(*) INTO n FROM information_schema.role_table_grants
  WHERE table_schema = 'public' AND table_name = 'executive_allowed_lines' AND grantee = 'service_role'
    AND privilege_type IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE');
  IF n <> 4 THEN
    RAISE EXCEPTION '0860 Líneas permitidas: service_role tiene % de los 4 privilegios esperados', n;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'executive_allowed_lines'
                 AND indexname = 'executive_allowed_lines_line_id_idx') THEN
    RAISE EXCEPTION '0860 Líneas permitidas: falta el índice executive_allowed_lines_line_id_idx';
  END IF;

  SELECT count(*) INTO n FROM information_schema.table_constraints
  WHERE table_schema = 'public' AND table_name = 'executive_allowed_lines' AND constraint_type = 'FOREIGN KEY';
  IF n <> 3 THEN
    RAISE EXCEPTION '0860 Líneas permitidas: la tabla tiene % llave(s) foránea(s), se esperaban 3', n;
  END IF;

  RAISE NOTICE '0860 Líneas permitidas OK: public.executive_allowed_lines con RLS, sin políticas, solo service_role. SIGUIENTE PASO: NOTIFY pgrst, ''reload schema''; los datos iniciales los pone la 0870 (solo con autorización del dueño).';
END;
$$;

COMMIT;
