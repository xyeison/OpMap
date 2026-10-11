-- =====================================================================================
-- OpMap · Fase 1 (zonas y equipo) · 0100 — Esquema: líneas, ejecutivas y cobertura
-- Proyecto: norvxqgohddgsdkggqzq · Generado: 2026-10-10 · NO EJECUTADO TODAVÍA
--
-- Modelo (ver documento "OpMap, zonas por línea y visitas médicas"):
--   ZONA    = una fila de public.kams. La tabla NO se renombra: cada fila de kams es una zona
--             geográfica con su ciudad base (kams.area_id, kams.lat/lng). En la UI "KAM" pasa a
--             llamarse "Zona"; la tabla public.zones actual se muestra como "Región". En el
--             código los identificadores siguen siendo kam_id / kams.
--   PERSONA = public.executives (ejecutiva comercial). Vive en una zona base, puede estar
--             ligada a un usuario de la app y a un empleado de Odoo.
--   LÍNEA   = public.business_lines (PerOssal, Reemplazo articular, Medicina deportiva,
--             Columna, Trauma).
--   executive_lines   : qué líneas lleva cada ejecutiva.
--   line_zones        : en qué zonas opera cada línea según los equipos (sets).
--   coverage          : quién cubre cada zona en cada línea (local / alcance / manual / vacante).
--   coverage_overrides: ajustes manuales del líder de línea (ganan sobre el cálculo).
--   coverage y coverage_overrides se CREAN en Fase 1 pero se llenan en Fase 2.
--
-- Seguridad: las 6 tablas nacen con RLS activado y SIN políticas, y sin privilegios para
--   anon/authenticated (coherente con database/hardening/02 y 03). Solo el servidor las usa,
--   con service_role (bypass de RLS). Hace falta el REVOKE explícito porque hoy
--   pg_default_acl de postgres en public concede arwdDxtm a anon/authenticated en cada tabla
--   nueva (confirmado con SELECT el 2026-10-10; hardening/03 lo corrige, pero puede no haberse
--   ejecutado aún).
--
-- Comprobado con SELECT el 2026-10-10: ninguna de las 6 tablas existe; existe
--   public.update_updated_at_column() (plpgsql, NEW.updated_at = now()); users.email es UNIQUE;
--   kams.id y users.id son uuid. PostgreSQL 17.4 (CREATE OR REPLACE TRIGGER disponible).
--
-- Transaccional: todo o nada. Re-ejecutable: sí (IF NOT EXISTS / OR REPLACE / idempotentes).
-- Rollback: 2026-10-10_9900_fase1_rollback.sql (sección A).
-- =====================================================================================

BEGIN;

-- -------------------------------------------------------------------------------------
-- 1. Tablas
-- -------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.business_lines (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  code              text        NOT NULL UNIQUE,
  name              text        NOT NULL,
  leader_user_id    uuid        NULL REFERENCES public.users(id),
  max_reach_minutes int         NOT NULL DEFAULT 240,
  active            boolean     NOT NULL DEFAULT true,
  sort_order        int         NOT NULL DEFAULT 0,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.executives (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid        NULL UNIQUE REFERENCES public.users(id),
  full_name        text        NOT NULL,
  email            text        UNIQUE,
  company          text        NOT NULL DEFAULT 'VG Medical',
  base_kam_id      uuid        NULL REFERENCES public.kams(id),
  odoo_employee_id int         NULL,
  status           text        NOT NULL DEFAULT 'active'
                               CHECK (status IN ('active', 'placeholder', 'inactive')),
  started_at       date,
  left_at          date,
  notes            text,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.executive_lines (
  executive_id uuid REFERENCES public.executives(id)     ON DELETE CASCADE,
  line_id      uuid REFERENCES public.business_lines(id) ON DELETE CASCADE,
  PRIMARY KEY (executive_id, line_id)
);

CREATE TABLE IF NOT EXISTS public.line_zones (
  line_id       uuid    REFERENCES public.business_lines(id) ON DELETE CASCADE,
  kam_id        uuid    REFERENCES public.kams(id)           ON DELETE CASCADE,
  has_equipment boolean NOT NULL DEFAULT true,
  PRIMARY KEY (line_id, kam_id)
);

CREATE TABLE IF NOT EXISTS public.coverage (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  line_id        uuid        NOT NULL REFERENCES public.business_lines(id) ON DELETE CASCADE,
  kam_id         uuid        NOT NULL REFERENCES public.kams(id)           ON DELETE CASCADE,
  executive_id   uuid        NULL     REFERENCES public.executives(id)     ON DELETE SET NULL,
  kind           text        NOT NULL CHECK (kind IN ('local', 'reach', 'manual', 'vacant')),
  travel_minutes int         NULL,
  source_kam_id  uuid        NULL     REFERENCES public.kams(id),
  computed_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (line_id, kam_id)
);

CREATE TABLE IF NOT EXISTS public.coverage_overrides (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  line_id      uuid        NOT NULL REFERENCES public.business_lines(id) ON DELETE CASCADE,
  kam_id       uuid        NOT NULL REFERENCES public.kams(id)           ON DELETE CASCADE,
  executive_id uuid        NOT NULL REFERENCES public.executives(id)     ON DELETE CASCADE,
  reason       text        NOT NULL,
  created_by   uuid        NULL     REFERENCES public.users(id),
  active       boolean     NOT NULL DEFAULT true,
  created_at   timestamptz DEFAULT now()
);

-- -------------------------------------------------------------------------------------
-- 2. Índices
--    (Las PK y los UNIQUE ya crean índice; aquí van los de claves foráneas de consulta
--     frecuente que no quedan cubiertos por la columna inicial de una PK/UNIQUE.)
-- -------------------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS executives_base_kam_id_idx       ON public.executives (base_kam_id);
CREATE INDEX IF NOT EXISTS executives_status_idx            ON public.executives (status);
CREATE INDEX IF NOT EXISTS executive_lines_line_id_idx      ON public.executive_lines (line_id);
CREATE INDEX IF NOT EXISTS line_zones_kam_id_idx            ON public.line_zones (kam_id);
CREATE INDEX IF NOT EXISTS coverage_kam_id_idx              ON public.coverage (kam_id);
CREATE INDEX IF NOT EXISTS coverage_executive_id_idx        ON public.coverage (executive_id);
CREATE INDEX IF NOT EXISTS coverage_overrides_executive_idx ON public.coverage_overrides (executive_id);

-- Un solo ajuste manual activo por (línea, zona).
CREATE UNIQUE INDEX IF NOT EXISTS coverage_overrides_active_uidx
  ON public.coverage_overrides (line_id, kam_id) WHERE active;

-- -------------------------------------------------------------------------------------
-- 3. Triggers updated_at (función existente public.update_updated_at_column())
--    Solo las tablas que tienen columna updated_at.
-- -------------------------------------------------------------------------------------

CREATE OR REPLACE TRIGGER update_business_lines_updated_at
  BEFORE UPDATE ON public.business_lines
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER update_executives_updated_at
  BEFORE UPDATE ON public.executives
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- -------------------------------------------------------------------------------------
-- 4. RLS activado y SIN políticas; fuera todo privilegio de anon/authenticated.
--    service_role conserva acceso (bypass de RLS); el GRANT explícito no depende de los
--    privilegios por defecto del esquema.
-- -------------------------------------------------------------------------------------

ALTER TABLE public.business_lines     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.executives         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.executive_lines    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.line_zones         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coverage           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coverage_overrides ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
  public.business_lines,
  public.executives,
  public.executive_lines,
  public.line_zones,
  public.coverage,
  public.coverage_overrides
FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.business_lines,
  public.executives,
  public.executive_lines,
  public.line_zones,
  public.coverage,
  public.coverage_overrides
TO service_role;

-- -------------------------------------------------------------------------------------
-- 5. Documentación en el catálogo
-- -------------------------------------------------------------------------------------

COMMENT ON TABLE public.kams IS
  'ZONA geográfica (en la UI: "Zona"). Cada fila es una zona con su ciudad base (area_id = '
  'municipio DANE o localidad de Bogotá; lat/lng = punto base). Desde la Fase 1 ya NO representa '
  'a una persona: las personas están en executives. El nombre de la tabla se conserva por '
  'compatibilidad (kam_id en todo el código).';

COMMENT ON TABLE public.business_lines IS
  'Líneas de negocio (PerOssal, Reemplazo articular, Medicina deportiva, Columna, Trauma). '
  'La cobertura de zonas se calcula por separado para cada línea.';
COMMENT ON COLUMN public.business_lines.code IS 'Código estable de la línea (perossal, reemplazo, deportiva, columna, trauma).';
COMMENT ON COLUMN public.business_lines.leader_user_id IS 'Usuario líder de la línea (puede ajustar cobertura y equipos). NULL si aún no tiene usuario en la app.';
COMMENT ON COLUMN public.business_lines.max_reach_minutes IS 'Tope de alcance en minutos de carro, de ciudad base a ciudad base. Más allá, la zona queda vacante para la línea.';
COMMENT ON COLUMN public.business_lines.sort_order IS 'Orden de presentación en la UI.';

COMMENT ON TABLE public.executives IS
  'PERSONA: ejecutiva comercial. Vive en una zona base (base_kam_id → kams) y lleva una o '
  'varias líneas (executive_lines). status = placeholder para vacantes por contratar '
  '("Nueva Barranquilla", "Nueva Bogotá"). Nunca se borra físicamente: al salir pasa a '
  'inactive con left_at.';
COMMENT ON COLUMN public.executives.user_id IS 'Usuario de la app (public.users) si la ejecutiva tiene acceso; NULL si no.';
COMMENT ON COLUMN public.executives.email IS 'Correo corporativo. Único. NULL en placeholders.';
COMMENT ON COLUMN public.executives.company IS 'Empresa a la que pertenece (VG Medical por defecto).';
COMMENT ON COLUMN public.executives.base_kam_id IS 'Zona base (fila de kams) donde vive la ejecutiva.';
COMMENT ON COLUMN public.executives.odoo_employee_id IS 'hr.employee.id en Odoo, para cruzar con nómina/comisiones.';
COMMENT ON COLUMN public.executives.status IS 'active | placeholder (vacante por contratar) | inactive (ya no está; ver left_at).';

COMMENT ON TABLE public.executive_lines IS 'Qué líneas de negocio lleva cada ejecutiva (N:M).';

COMMENT ON TABLE public.line_zones IS
  'En qué zonas opera cada línea según los equipos (sets). has_equipment = false: la línea '
  'aparece "sin equipo" en esa zona aunque haya quien la cubra. Por defecto todas las zonas '
  'activas con equipo; las líderes desmarcan.';

COMMENT ON TABLE public.coverage IS
  'Resultado del cálculo de cobertura (Fase 2): para cada (línea, zona) quién responde. '
  'kind: local (vive en la zona y lleva la línea), reach (la más cercana que lleva la línea, '
  'dentro de max_reach_minutes), manual (ajuste del líder), vacant (nadie a menos del tope). '
  'Se recalcula completo; no editar a mano (usar coverage_overrides).';
COMMENT ON COLUMN public.coverage.executive_id IS 'Ejecutiva que cubre. NULL cuando kind = vacant.';
COMMENT ON COLUMN public.coverage.travel_minutes IS 'Minutos de carro desde la zona base de la ejecutiva (o de la más cercana, si es vacante).';
COMMENT ON COLUMN public.coverage.source_kam_id IS 'Zona base desde la que se mide el alcance.';

COMMENT ON TABLE public.coverage_overrides IS
  'Ajustes manuales de cobertura hechos por el líder de línea (p. ej. dar una zona vacante a '
  'quien la atiende por viaje). Ganan sobre el cálculo. Solo uno activo por (línea, zona); '
  'los anteriores quedan con active = false como historial.';

-- -------------------------------------------------------------------------------------
-- 6. Comprobaciones: si algo no queda como se espera, se aborta toda la transacción.
-- -------------------------------------------------------------------------------------

DO $$
DECLARE
  t   text;
  n   int;
BEGIN
  FOREACH t IN ARRAY ARRAY['business_lines','executives','executive_lines',
                           'line_zones','coverage','coverage_overrides'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace
      WHERE ns.nspname = 'public' AND c.relname = t AND c.relrowsecurity
    ) THEN
      RAISE EXCEPTION 'Fase 1: la tabla public.% no existe o no tiene RLS activado', t;
    END IF;

    SELECT count(*) INTO n FROM pg_policies WHERE schemaname = 'public' AND tablename = t;
    IF n > 0 THEN
      RAISE EXCEPTION 'Fase 1: public.% tiene % política(s); debe nacer sin políticas', t, n;
    END IF;

    SELECT count(*) INTO n FROM information_schema.role_table_grants
    WHERE table_schema = 'public' AND table_name = t AND grantee IN ('anon', 'authenticated');
    IF n > 0 THEN
      RAISE EXCEPTION 'Fase 1: public.% conserva % privilegio(s) para anon/authenticated', t, n;
    END IF;
  END LOOP;
END $$;

COMMIT;
