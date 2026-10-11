-- =====================================================================================
-- OpMap · Fase 3 (IPS por código de habilitación) · 0600 — Sedes del REPS
-- Proyecto: norvxqgohddgsdkggqzq · Generado: 2026-10-11
--
-- Pedido del dueño (2026-10-11): "un NIT puede tener varias sedes, eso está mal… debe ser por
--   código de habilitación". La IPS correcta es la SEDE del REPS (Registro Especial de
--   Prestadores de Servicios de Salud), identificada por su código de habilitación de 12
--   dígitos (= código de prestador de 10 dígitos + número de sede de 2).
--
-- Qué hace (solo ADITIVO: tablas, columnas, índices y restricciones nuevas; no toca datos):
--   1. reps_sedes: copia de las sedes del REPS (corte mensual del Ministerio de Salud). PK =
--      codigo_habilitacion. La carga la hace scripts/reps-load-sedes.ts (upsert por lotes).
--      Se cargan las clases IPS, "Objeto Social Diferente" y "Transporte Especial de Pacientes"
--      (todas con NIT); los "Profesionales Independientes" (personas naturales con cédula,
--      54.657 filas en el corte del 12-mar-2026) NO se cargan: no son IPS objetivo y son datos
--      personales (minimización).
--   2. hospitals: 4 columnas nuevas
--        - reps_code        text NULL UNIQUE, 12 dígitos. Sede del REPS que ES esta IPS.
--                           "FK suave": NO hay FOREIGN KEY a reps_sedes porque reps_sedes se
--                           recarga cada mes y una sede puede desaparecer de un corte; la app
--                           valida que exista al vincular y el informe de cruce avisa de los
--                           vínculos huérfanos.
--        - nit              text GENERATED ALWAYS (STORED): 9 dígitos sin DV, derivado de
--                           hospitals.code con la misma regla que lib/reps-match.ts
--                           (nitFromCode). NO se escribe nunca: Postgres lo recalcula solo al
--                           cambiar code. Acepta "890303208-5", " 900959048-4", "9013620904"
--                           (NIT+DV sin guion) y "800149384-10" (DV de 2 cifras, dato sucio).
--        - reps_matched_at  timestamptz NULL: cuándo se vinculó reps_code.
--        - reps_match_status text NULL CHECK ('matched','ambiguous','unmatched'); NULL = sin
--                           evaluar. matched ⇔ reps_code NOT NULL (CHECK de coherencia).
--      Columna extra nombre_busqueda: nombre de sede + prestador normalizados (sin tildes) que
--      escribe el script de carga, para el buscador de sedes de la ficha.
--   3. Índices: reps_sedes(nit), reps_sedes(municipio_sede), hospitals(nit) (más el UNIQUE de
--      hospitals.reps_code).
--   4. reps_sedes con RLS activado, SIN políticas, sin privilegios para anon/authenticated/
--      PUBLIC y GRANT explícito a service_role (patrón de las Fases 1, 2 y 2b).
--
-- Foto con SELECT antes de este script (2026-10-11):
--   - No existe ninguna tabla con "reps" en el nombre. hospitals: 787 filas, 783 con code
--     ^\d{9}-\d$ y 4 con formas sucias (" 900959048-4", "901361882-6 ", "9013620904",
--     "800149384-10"); la regla de nit da NIT a las 787. 47 NIT se repiten en hospitals.
--   - hospitals tiene el disparador update_hospitals_updated_at (BEFORE UPDATE). Añadir una
--     columna generada reescribe la tabla SIN disparar triggers de fila: updated_at no cambia.
--   - hospitals conserva SELECT para anon/authenticated y 2 políticas heredadas (fuera del
--     alcance de este script): las columnas nuevas son códigos públicos del REPS.
--   - substring(text, text) y btrim(text) son IMMUTABLE (pg_proc.provolatile = 'i'), requisito
--     de una columna generada.
--
-- Re-ejecutable: sí (IF NOT EXISTS; las restricciones se crean solo si faltan).
-- Transaccional: todo o nada. Rollback: 2026-10-11_9930_reps_rollback.sql.
-- Después: scripts/reps-load-sedes.ts (carga) y scripts/reps-match.ts (informe; --apply).
-- =====================================================================================

BEGIN;

-- -------------------------------------------------------------------------------------
-- 0. Precondiciones
-- -------------------------------------------------------------------------------------

DO $$
BEGIN
  IF to_regclass('public.hospitals') IS NULL THEN
    RAISE EXCEPTION 'Fase 3 (REPS): falta public.hospitals';
  END IF;
  -- Si nit ya existe y NO es generada, alguien la creó a mano: no se pisa.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'hospitals' AND column_name = 'nit'
      AND is_generated <> 'ALWAYS'
  ) THEN
    RAISE EXCEPTION 'Fase 3 (REPS): hospitals.nit ya existe y no es una columna generada; revisar a mano';
  END IF;
END $$;

-- -------------------------------------------------------------------------------------
-- 1. reps_sedes
-- -------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.reps_sedes (
  codigo_habilitacion        text        PRIMARY KEY,
  codigo_prestador           text        NOT NULL,
  nombre_prestador           text        NOT NULL,
  nombre_sede                text        NOT NULL,
  tipo_id                    text        NULL,
  nit                        text        NOT NULL,
  naturaleza                 text        NULL,
  ese                        boolean     NOT NULL DEFAULT false,
  municipio_prestador        text        NULL,
  departamento_prestador     text        NULL,
  municipio_prestador_nombre text        NULL,
  direccion_prestador        text        NULL,
  email_prestador            text        NULL,
  telefono_prestador         text        NULL,
  municipio_sede             text        NOT NULL,
  departamento_sede          text        NULL,
  municipio_sede_nombre      text        NULL,
  direccion_sede             text        NULL,
  email_sede                 text        NULL,
  telefono_sede              text        NULL,
  clase_prestador            text        NOT NULL,
  fecha_corte                date        NULL,
  imported_at                timestamptz NOT NULL DEFAULT now(),
  nombre_busqueda            text        NULL,
  CONSTRAINT reps_sedes_codigo_habilitacion_check CHECK (codigo_habilitacion ~ '^\d{12}$'),
  CONSTRAINT reps_sedes_codigo_prestador_check    CHECK (codigo_prestador ~ '^\d{10}$'),
  CONSTRAINT reps_sedes_municipio_sede_check      CHECK (municipio_sede ~ '^\d{5}$'),
  CONSTRAINT reps_sedes_nit_check                 CHECK (btrim(nit) <> '')
);

-- Si la tabla ya existía sin la columna de búsqueda (primera versión de este script), se añade.
ALTER TABLE public.reps_sedes ADD COLUMN IF NOT EXISTS nombre_busqueda text NULL;

CREATE INDEX IF NOT EXISTS reps_sedes_nit_idx            ON public.reps_sedes (nit);
CREATE INDEX IF NOT EXISTS reps_sedes_municipio_sede_idx ON public.reps_sedes (municipio_sede);

-- -------------------------------------------------------------------------------------
-- 2. hospitals: columnas nuevas
-- -------------------------------------------------------------------------------------

ALTER TABLE public.hospitals ADD COLUMN IF NOT EXISTS reps_code         text        NULL;
ALTER TABLE public.hospitals ADD COLUMN IF NOT EXISTS reps_matched_at   timestamptz NULL;
ALTER TABLE public.hospitals ADD COLUMN IF NOT EXISTS reps_match_status text        NULL;
ALTER TABLE public.hospitals ADD COLUMN IF NOT EXISTS nit               text
  GENERATED ALWAYS AS (substring(btrim(code::text) from '^(\d{9})(?:-\d{1,2}|\d)$')) STORED;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.hospitals'::regclass
                 AND conname = 'hospitals_reps_code_key') THEN
    ALTER TABLE public.hospitals ADD CONSTRAINT hospitals_reps_code_key UNIQUE (reps_code);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.hospitals'::regclass
                 AND conname = 'hospitals_reps_code_check') THEN
    ALTER TABLE public.hospitals ADD CONSTRAINT hospitals_reps_code_check
      CHECK (reps_code IS NULL OR reps_code ~ '^\d{12}$');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.hospitals'::regclass
                 AND conname = 'hospitals_reps_match_status_check') THEN
    ALTER TABLE public.hospitals ADD CONSTRAINT hospitals_reps_match_status_check
      CHECK (reps_match_status IS NULL OR reps_match_status IN ('matched', 'ambiguous', 'unmatched'));
  END IF;
  -- matched ⇔ hay reps_code (ambiguous / unmatched / sin evaluar ⇒ reps_code NULL)
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.hospitals'::regclass
                 AND conname = 'hospitals_reps_match_coherence_check') THEN
    ALTER TABLE public.hospitals ADD CONSTRAINT hospitals_reps_match_coherence_check
      CHECK ((reps_match_status IS NOT DISTINCT FROM 'matched') = (reps_code IS NOT NULL));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_hospitals_nit ON public.hospitals (nit);

-- -------------------------------------------------------------------------------------
-- 3. Seguridad de reps_sedes: RLS sin políticas, nada para anon/authenticated/PUBLIC
-- -------------------------------------------------------------------------------------

ALTER TABLE public.reps_sedes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.reps_sedes FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.reps_sedes TO service_role;

-- -------------------------------------------------------------------------------------
-- 4. Documentación en el catálogo
-- -------------------------------------------------------------------------------------

COMMENT ON TABLE public.reps_sedes IS
  'Sedes del REPS (Registro Especial de Prestadores, MinSalud). Una fila por código de '
  'habilitación (12 dígitos = código de prestador + número de sede). Un NIT puede tener muchas '
  'sedes: la IPS objetivo es la SEDE (hospitals.reps_code). Se cargan las clases IPS, Objeto '
  'Social Diferente y Transporte Especial de Pacientes; no los Profesionales Independientes '
  '(personas naturales). Carga: scripts/reps-load-sedes.ts (upsert idempotente por lotes).';
COMMENT ON COLUMN public.reps_sedes.codigo_habilitacion IS 'Código de habilitación de la sede (12 dígitos). PK.';
COMMENT ON COLUMN public.reps_sedes.codigo_prestador IS 'Código del prestador (10 dígitos); la sede principal suele ser codigo_prestador || ''01''.';
COMMENT ON COLUMN public.reps_sedes.nit IS 'Número de identificación del prestador (NIT sin dígito de verificación). Se cruza con hospitals.nit.';
COMMENT ON COLUMN public.reps_sedes.ese IS 'Empresa Social del Estado (REPS: SI/NO).';
COMMENT ON COLUMN public.reps_sedes.municipio_sede IS 'Código DANE (5 dígitos) del municipio de la sede.';
COMMENT ON COLUMN public.reps_sedes.departamento_prestador IS 'Nombre del departamento del prestador (departamentoprestadordesc).';
COMMENT ON COLUMN public.reps_sedes.departamento_sede IS 'Nombre del departamento de la sede (departamentodededesc).';
COMMENT ON COLUMN public.reps_sedes.fecha_corte IS 'Fecha de corte del REPS de la que salió la fila.';
COMMENT ON COLUMN public.reps_sedes.imported_at IS 'Última vez que el script de carga escribió la fila.';
COMMENT ON COLUMN public.reps_sedes.nombre_busqueda IS
  'nombre_sede + nombre_prestador normalizados (mayúsculas, sin tildes ni signos; normalizeName() de '
  'web/lib/reps-match.ts). Lo escribe el script de carga; lo usa el buscador de sedes de la ficha.';

COMMENT ON COLUMN public.hospitals.reps_code IS
  'Código de habilitación (12 dígitos) de la sede del REPS que ES esta IPS. UNIQUE: una sede, una '
  'IPS. FK suave a reps_sedes (sin FOREIGN KEY: el REPS se recarga cada mes). Lo escriben '
  'scripts/reps-match.ts --apply (solo vínculos seguros) y PATCH /api/hospitals/[id]/reps-link.';
COMMENT ON COLUMN public.hospitals.nit IS
  'NIT (9 dígitos, sin DV) derivado de code. Columna GENERADA: no se escribe. Misma regla que '
  'nitFromCode() en web/lib/reps-match.ts.';
COMMENT ON COLUMN public.hospitals.reps_matched_at IS 'Cuándo se vinculó reps_code (automático o manual).';
COMMENT ON COLUMN public.hospitals.reps_match_status IS
  'Cruce con el REPS: matched = vinculada a una sede (reps_code); ambiguous = el NIT tiene varias '
  'sedes y no se pudo decidir cuál (vincular a mano desde la ficha); unmatched = ninguna sede del '
  'REPS con ese NIT. NULL = sin evaluar.';

-- -------------------------------------------------------------------------------------
-- 5. Comprobaciones: si algo no queda como se espera, se aborta toda la transacción.
-- -------------------------------------------------------------------------------------

DO $$
DECLARE
  n int;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace
    WHERE ns.nspname = 'public' AND c.relname = 'reps_sedes' AND c.relkind = 'r' AND c.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'Fase 3 (REPS): reps_sedes no existe o no tiene RLS activado';
  END IF;

  SELECT count(*) INTO n FROM pg_policies WHERE schemaname = 'public' AND tablename = 'reps_sedes';
  IF n > 0 THEN
    RAISE EXCEPTION 'Fase 3 (REPS): reps_sedes tiene % política(s); debe nacer sin políticas', n;
  END IF;

  SELECT count(*) INTO n
  FROM pg_class c, aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a
  WHERE c.oid = 'public.reps_sedes'::regclass
    AND (a.grantee = 0
         OR a.grantee IN (SELECT oid FROM pg_roles WHERE rolname IN ('anon', 'authenticated')));
  IF n > 0 THEN
    RAISE EXCEPTION 'Fase 3 (REPS): reps_sedes conserva % privilegio(s) para anon/authenticated/PUBLIC', n;
  END IF;

  IF NOT has_table_privilege('service_role', 'public.reps_sedes', 'SELECT')
     OR NOT has_table_privilege('service_role', 'public.reps_sedes', 'INSERT')
     OR NOT has_table_privilege('service_role', 'public.reps_sedes', 'UPDATE') THEN
    RAISE EXCEPTION 'Fase 3 (REPS): service_role sin SELECT/INSERT/UPDATE en reps_sedes';
  END IF;

  SELECT count(*) INTO n FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'reps_sedes';
  IF n <> 24 THEN
    RAISE EXCEPTION 'Fase 3 (REPS): se esperaban 24 columnas en reps_sedes; hay %', n;
  END IF;

  SELECT count(*) INTO n FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'hospitals'
    AND column_name IN ('reps_code', 'nit', 'reps_matched_at', 'reps_match_status');
  IF n <> 4 THEN
    RAISE EXCEPTION 'Fase 3 (REPS): faltan columnas nuevas en hospitals (hay % de 4)', n;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'hospitals'
                   AND column_name = 'nit' AND is_generated = 'ALWAYS') THEN
    RAISE EXCEPTION 'Fase 3 (REPS): hospitals.nit no es una columna generada';
  END IF;

  SELECT count(*) INTO n FROM pg_constraint
  WHERE conrelid = 'public.hospitals'::regclass
    AND conname IN ('hospitals_reps_code_key', 'hospitals_reps_code_check',
                    'hospitals_reps_match_status_check', 'hospitals_reps_match_coherence_check');
  IF n <> 4 THEN
    RAISE EXCEPTION 'Fase 3 (REPS): faltan restricciones en hospitals (hay % de 4)', n;
  END IF;

  -- La regla del NIT da un valor a todas las IPS cuyo code tiene forma de NIT
  SELECT count(*) INTO n FROM public.hospitals
  WHERE btrim(code) ~ '^\d{9}(-\d{1,2}|\d)$' AND nit IS NULL;
  IF n > 0 THEN
    RAISE EXCEPTION 'Fase 3 (REPS): % IPS con code de NIT quedaron sin nit', n;
  END IF;

  SELECT count(*) INTO n FROM public.hospitals WHERE nit IS NOT NULL;
  RAISE NOTICE 'Fase 3 (REPS) OK: reps_sedes con RLS, 0 políticas, 0 privilegios para anon/authenticated; hospitals con reps_code (UNIQUE), nit generado (% IPS con NIT), reps_matched_at y reps_match_status. SIGUIENTE PASO: scripts/reps-load-sedes.ts y scripts/reps-match.ts.', n;
END $$;

COMMIT;
