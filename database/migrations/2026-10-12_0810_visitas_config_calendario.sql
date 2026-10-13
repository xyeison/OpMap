-- =====================================================================================
-- OpMap · feat/visitas-f2-config-calendario (app de visita · F2 Configuración y calendario) · 0810
-- Proyecto: norvxqgohddgsdkggqzq · Generado: 2026-10-12 · ESTADO: APLICADA 2026-10-12 (PR #14)
--
-- Contrato: docs/fases/fase7-visitas-f2-config-calendario.md (sección "Base de datos"; fuente de verdad de
--   nombres). Spec aprobada: docs/specs/2026-10-12-app-de-visita-opmap.md (secciones 6, 7, 9, 11 y 12).
--   Decisiones del dueño: docs/decisiones/2026-10-12-app-de-visita.md.
--   Es ADITIVA salvo un cambio: amplía users_role_check con el rol 'hr' (recursos humanos). No cambia ninguna
--   fila de otra tabla.
--
-- Por qué:
--   Todo lo que mide la app de visita es configurable y con vigencias por rango de fechas (cambiar algo no edita
--   el valor anterior: cierra su rango y abre uno nuevo; los cálculos usan el valor que regía cada día). La cuota
--   del periodo = meta × días hábiles del calendario de cada persona − días libres aprobados, así que hacen falta
--   el calendario (festivos de Colombia calculados, días de empresa y de ciudad) y los días libres con plazo de
--   gracia y aprobación en bloque por la directora o recursos humanos.
--
-- Qué hace:
--   1. Extensión btree_gist en el schema extensions (para las restricciones de exclusión con texto + rango).
--   2. Cuatro tablas de configuración con vigencias: config_metas, config_conteo, config_general,
--      config_personas. Columnas comunes: vigente_desde, vigente_hasta (inclusive; NULL = abierto), motivo,
--      set_by, created_at, anulado_at, anulado_por, anulado_motivo, anterior_id, anterior_hasta (el valor que esta
--      fila cortó o reemplazó al registrarse) y la clave GENERADA de cada tabla. set_by y anulado_por sin ON
--      DELETE (quien dejó rastro no se borra; SET NULL chocaría con config_inmutable).
--        - <tabla>_sin_superposicion: EXCLUDE USING gist (clave =, daterange(desde, hasta, '[]') &&) WHERE
--          (anulado_at IS NULL) → dos rangos activos de la misma clave no se superponen (23P01).
--        - Disparador config_inmutable (BEFORE UPDATE OR DELETE): DELETE siempre falla; UPDATE solo cambia
--          vigente_hasta, anulado_at, anulado_por y anulado_motivo, y nunca en una fila ya anulada (23514).
--   3. calendario (festivos nacionales calculados, días de empresa y de ciudad; se anulan, no se borran; uno
--      activo por fecha + alcance + municipio) y dias_libres (día completo o medio día; uno vigente por persona y
--      fecha; fuera de plazo exige justificación; se anulan, no se borran).
--   4. calendario_festivos_colombia(p_anio) (IMMUTABLE; Ley 51 de 1983: Pascua por el algoritmo gregoriano
--      anónimo, fijos, trasladados al lunes y de Pascua) y calendario_cargar_festivos(p_anio, p_user) (inserta
--      los que falten como nacional · no_habil · calculado; nunca revive uno anulado). Carga 2026 y 2027.
--   5. Rol 'hr' en users_role_check (9 roles).
--   6. config_registrar(...) y config_cerrar(...): las escrituras de la API en las 4 tablas pasan siempre por
--      aquí (cortes, anulaciones del mismo día y continuación de un valor temporal; contrato, pasos 1 a 7). Al
--      cancelar o acortar un valor, config_cerrar devuelve el valor que ese había cortado o reemplazado
--      (decisión 12 del contrato): no queda un hueco con el valor por defecto o sin meta.
--   7. Semillas vigentes desde 2026-10-12 (motivo 'Valor inicial (decisión del dueño 2026-10-12)'): 2 metas
--      generales, 5 conteos (por código de subtipo) y 9 parámetros generales.
--   8. RLS sin políticas; nada para PUBLIC/anon/authenticated; service_role SELECT, INSERT y UPDATE (sin DELETE
--      ni TRUNCATE: estas filas nunca se borran) y EXECUTE de las 4 funciones llamables.
--   9. Bloque DO final que comprueba todo y aborta si algo no cuadra; las pruebas que escriben van en
--      sub-bloques que terminan con RAISE SQLSTATE 'P0810' y se deshacen (no queda ni cambia ninguna fila).
--
-- Errores para la API: 22023 (tabla o parámetro no válido), 23514 (motivo que falta, hasta < desde, CHECK,
--   config_inmutable, borrado prohibido), 23P01 (superposición: "El rango se superpone con un valor que
--   empieza el AAAA-MM-DD" o la restricción <tabla>_sin_superposicion), P0002 (config_cerrar sobre una fila
--   anulada o inexistente), 23505 (calendario_dia_activo_uidx, dias_libres_vigente_uidx), 23503 (llave foránea).
--
-- Además de lo que fija el contrato (no lo contradice): anulado_por/anulado_motivo solo con anulado_at; en
--   config_general, además del tipo jsonb, los rangos de los parámetros numéricos y las 7 claves de
--   dias_habiles_semana; motivo de día libre con forma de código (^[a-z_]{2,40}$); nombre del calendario no
--   vacío; calendario.municipality_id con llave foránea a municipalities(code) (es PK; comprobado 2026-10-12)
--   y CHECK de 5 dígitos; en un año en que dos festivos caen el mismo lunes (p. ej. 2038-07-05),
--   calendario_cargar_festivos guarda UNA fila con los dos nombres unidos por " y ".
--
-- Depende de: 0800 (subtipos_institucionales), 0100 (executives), kams, users, municipalities y
--   public.update_updated_at_column() (existente).
--
-- Después de aplicar (misma ventana que el despliegue del código de /configuracion y /calendario):
--   NOTIFY pgrst, 'reload schema';   -- PostgREST debe ver las tablas y las funciones nuevas
--   Costo Google: 0 (no llama a nada). No recalcula asignaciones.
--
-- Transaccional: todo o nada. Re-ejecutable: sí (IF NOT EXISTS, CREATE OR REPLACE, semillas con NOT EXISTS por
--   clave, users_role_check DROP IF EXISTS + ADD, carga de festivos idempotente).
-- Rollback: 2026-10-12_9941_visitas_config_calendario_rollback.sql.
-- =====================================================================================

BEGIN;

-- -------------------------------------------------------------------------------------
-- 0. Precondiciones
-- -------------------------------------------------------------------------------------

DO $$
DECLARE
  v_par   text[];
  v_roles text[];
  v_n     bigint;
  v_ocho  constant text[] := ARRAY['admin', 'user', 'viewer', 'sales_manager', 'contract_manager', 'data_manager',
                                   'line_leader', 'commercial_director'];
BEGIN
  IF to_regclass('public.users') IS NULL OR to_regclass('public.executives') IS NULL
     OR to_regclass('public.kams') IS NULL OR to_regclass('public.municipalities') IS NULL
     OR to_regclass('public.subtipos_institucionales') IS NULL THEN
    RAISE EXCEPTION '0810 Configuración: faltan tablas previas (users, executives, kams, municipalities, subtipos_institucionales de 0800)';
  END IF;
  IF to_regprocedure('public.update_updated_at_column()') IS NULL THEN
    RAISE EXCEPTION '0810 Configuración: falta la función public.update_updated_at_column()';
  END IF;
  IF to_regnamespace('extensions') IS NULL THEN
    RAISE EXCEPTION '0810 Configuración: falta el schema extensions (btree_gist va ahí)';
  END IF;

  -- calendario.municipality_id lleva llave foránea a municipalities(code): code debe ser PK o UNIQUE.
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    WHERE c.conrelid = 'public.municipalities'::regclass
      AND c.contype IN ('p', 'u')
      AND c.conkey = ARRAY[(SELECT a.attnum FROM pg_attribute a
                            WHERE a.attrelid = 'public.municipalities'::regclass AND a.attname = 'code')]::int2[]) THEN
    RAISE EXCEPTION '0810 Configuración: municipalities.code no es PK ni UNIQUE; la llave foránea de calendario.municipality_id no se puede crear';
  END IF;

  -- La semilla de conteo busca los 5 subtipos de 0800 por código.
  SELECT count(*) INTO v_n FROM public.subtipos_institucionales
  WHERE codigo IN ('compras', 'quimico_farmaceutico', 'autorizaciones', 'programacion', 'otro');
  IF v_n <> 5 THEN
    RAISE EXCEPTION '0810 Configuración: faltan subtipos institucionales de 0800 (hay % de 5)', v_n;
  END IF;

  -- users_role_check debe tener los 8 roles de hoy (o los 9 si ya se aplicó): no se pierde ningún rol al cambiarlo.
  SELECT array_agg(x.r[1]) INTO v_roles
  FROM pg_constraint c
  CROSS JOIN LATERAL regexp_matches(pg_get_constraintdef(c.oid), '''([a-z_]+)''', 'g') AS x(r)
  WHERE c.conrelid = 'public.users'::regclass AND c.conname = 'users_role_check';
  IF v_roles IS NULL THEN
    RAISE EXCEPTION '0810 Configuración: falta la restricción users_role_check';
  END IF;
  IF NOT (v_roles @> v_ocho AND v_roles <@ (v_ocho || 'hr'::text)) THEN
    RAISE EXCEPTION '0810 Configuración: users_role_check tiene roles distintos a los esperados (%); revisar antes de cambiarla', v_roles;
  END IF;
  IF EXISTS (SELECT 1 FROM public.users u WHERE u.role <> ALL (v_ocho || 'hr'::text)) THEN
    RAISE EXCEPTION '0810 Configuración: hay usuarios con un rol fuera de la lista de 9';
  END IF;

  -- Si alguna tabla ya existe, debe ser la de esta migración (re-ejecución), no otra con el mismo nombre.
  FOREACH v_par SLICE 1 IN ARRAY ARRAY[
    ARRAY['config_metas', 'cantidad'], ARRAY['config_conteo', 'modo'], ARRAY['config_general', 'parametro'],
    ARRAY['config_personas', 'telefonica_habilitada'], ARRAY['calendario', 'alcance'],
    ARRAY['dias_libres', 'fuera_de_plazo']]
  LOOP
    IF to_regclass('public.' || v_par[1]) IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_schema = 'public' AND table_name = v_par[1] AND column_name = v_par[2]) THEN
      RAISE EXCEPTION '0810 Configuración: ya existe una tabla public.% que no es la de esta migración (sin columna %)',
        v_par[1], v_par[2];
    END IF;
  END LOOP;
END;
$$;

-- -------------------------------------------------------------------------------------
-- 1. Extensión para las restricciones de exclusión (texto = y rango &&). El rollback no la borra.
-- -------------------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;

-- -------------------------------------------------------------------------------------
-- 2. Configuración con vigencias (4 tablas)
-- -------------------------------------------------------------------------------------

-- Columnas comunes de las 4 tablas (además de las de vigencia):
--   set_by y anulado_por referencian users SIN ON DELETE (NO ACTION): quien dejó rastro en la configuración no se
--   borra (la app solo desactiva usuarios); un ON DELETE SET NULL chocaría con config_inmutable y nunca se cumpliría.
--   anterior_id / anterior_hasta: la fila que este valor cortó o reemplazó al registrarse (la que regía en su
--   vigente_desde) y el vigente_hasta que esa tenía; las escribe config_registrar y las usa config_cerrar para que,
--   al cancelar o acortar este valor, vuelva a regir el anterior (decisión 12 del contrato). Inmutables.

-- Metas por tipo (y subtipo con meta propia), para toda la empresa, por zona (valor por defecto) o por persona
-- (excepción), por día o por semana.
CREATE TABLE IF NOT EXISTS public.config_metas (
  id             uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  scope          text         NOT NULL,
  kam_id         uuid         NULL REFERENCES public.kams(id),
  executive_id   uuid         NULL REFERENCES public.executives(id),
  tipo           text         NOT NULL,
  subtipo_id     uuid         NULL REFERENCES public.subtipos_institucionales(id),
  periodo        text         NOT NULL,
  cantidad       numeric(6,2) NOT NULL,
  vigente_desde  date         NOT NULL,
  vigente_hasta  date         NULL,
  motivo         text         NULL,
  set_by         uuid         NULL REFERENCES public.users(id),
  created_at     timestamptz  NOT NULL DEFAULT now(),
  anulado_at     timestamptz  NULL,
  anulado_por    uuid         NULL REFERENCES public.users(id),
  anulado_motivo text         NULL,
  anterior_id    uuid         NULL REFERENCES public.config_metas(id),
  anterior_hasta date         NULL,
  clave          text         GENERATED ALWAYS AS (
                   scope || ':' || coalesce(kam_id::text, executive_id::text, '-') || ':' || tipo || ':'
                   || coalesce(subtipo_id::text, '-')) STORED,
  CONSTRAINT config_metas_vigencia_check CHECK (vigente_hasta IS NULL OR vigente_hasta >= vigente_desde),
  CONSTRAINT config_metas_scope_check
    CHECK ((scope = 'general'      AND kam_id IS NULL     AND executive_id IS NULL)
           OR (scope = 'zona'      AND kam_id IS NOT NULL AND executive_id IS NULL)
           OR (scope = 'ejecutiva' AND kam_id IS NULL     AND executive_id IS NOT NULL)),
  CONSTRAINT config_metas_tipo_check     CHECK (tipo IN ('medica', 'institucional')),
  CONSTRAINT config_metas_subtipo_check  CHECK (subtipo_id IS NULL OR tipo = 'institucional'),
  CONSTRAINT config_metas_periodo_check  CHECK (periodo IN ('dia', 'semana')),
  CONSTRAINT config_metas_cantidad_check CHECK (cantidad BETWEEN 0 AND 100),
  CONSTRAINT config_metas_anulado_check
    CHECK (anulado_at IS NOT NULL OR (anulado_por IS NULL AND anulado_motivo IS NULL)),
  CONSTRAINT config_metas_anterior_check CHECK (anterior_id IS NOT NULL OR anterior_hasta IS NULL),
  CONSTRAINT config_metas_sin_superposicion EXCLUDE USING gist
    (clave WITH =, (daterange(vigente_desde, vigente_hasta, '[]')) WITH &&) WHERE (anulado_at IS NULL)
);

-- Qué subtipo institucional suma a qué meta y con qué peso.
CREATE TABLE IF NOT EXISTS public.config_conteo (
  id             uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  subtipo_id     uuid         NOT NULL REFERENCES public.subtipos_institucionales(id),
  modo           text         NOT NULL,
  peso           numeric(4,2) NOT NULL DEFAULT 1,
  vigente_desde  date         NOT NULL,
  vigente_hasta  date         NULL,
  motivo         text         NULL,
  set_by         uuid         NULL REFERENCES public.users(id),
  created_at     timestamptz  NOT NULL DEFAULT now(),
  anulado_at     timestamptz  NULL,
  anulado_por    uuid         NULL REFERENCES public.users(id),
  anulado_motivo text         NULL,
  anterior_id    uuid         NULL REFERENCES public.config_conteo(id),
  anterior_hasta date         NULL,
  clave          text         GENERATED ALWAYS AS (subtipo_id::text) STORED,
  CONSTRAINT config_conteo_vigencia_check CHECK (vigente_hasta IS NULL OR vigente_hasta >= vigente_desde),
  CONSTRAINT config_conteo_modo_check     CHECK (modo IN ('suma_institucional', 'meta_propia', 'seguimiento')),
  CONSTRAINT config_conteo_peso_check     CHECK (peso > 0 AND peso <= 10),
  CONSTRAINT config_conteo_anulado_check
    CHECK (anulado_at IS NOT NULL OR (anulado_por IS NULL AND anulado_motivo IS NULL)),
  CONSTRAINT config_conteo_anterior_check CHECK (anterior_id IS NOT NULL OR anterior_hasta IS NULL),
  CONSTRAINT config_conteo_sin_superposicion EXCLUDE USING gist
    (clave WITH =, (daterange(vigente_desde, vigente_hasta, '[]')) WITH &&) WHERE (anulado_at IS NULL)
);

-- Parámetros generales (uno por clave). La forma completa de cada valor la valida la API con zod; aquí, el tipo
-- jsonb y los rangos de los numéricos.
CREATE TABLE IF NOT EXISTS public.config_general (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  parametro      text        NOT NULL,
  valor          jsonb       NOT NULL,
  vigente_desde  date        NOT NULL,
  vigente_hasta  date        NULL,
  motivo         text        NULL,
  set_by         uuid        NULL REFERENCES public.users(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  anulado_at     timestamptz NULL,
  anulado_por    uuid        NULL REFERENCES public.users(id),
  anulado_motivo text        NULL,
  anterior_id    uuid        NULL REFERENCES public.config_general(id),
  anterior_hasta date        NULL,
  clave          text        GENERATED ALWAYS AS (parametro) STORED,
  CONSTRAINT config_general_vigencia_check CHECK (vigente_hasta IS NULL OR vigente_hasta >= vigente_desde),
  CONSTRAINT config_general_parametro_check
    CHECK (parametro IN ('radio_presencial_m', 'plazo_gracia_horas', 'dias_habiles_semana', 'tope_visitas_medico_dia',
                         'telefonicas', 'aprobacion_dias_libres', 'motivos_dia_libre', 'primer_mes_factor',
                         'alertas_mezcla')),
  -- CASE anidado: el cast a numeric solo se evalúa si el valor es un número.
  CONSTRAINT config_general_valor_check
    CHECK (CASE parametro
             WHEN 'radio_presencial_m' THEN
               CASE WHEN jsonb_typeof(valor) = 'number' THEN valor::numeric BETWEEN 50 AND 5000 ELSE false END
             WHEN 'plazo_gracia_horas' THEN
               CASE WHEN jsonb_typeof(valor) = 'number' THEN valor::numeric BETWEEN 0 AND 720 ELSE false END
             WHEN 'tope_visitas_medico_dia' THEN
               CASE WHEN jsonb_typeof(valor) = 'number' THEN valor::numeric BETWEEN 1 AND 10 ELSE false END
             WHEN 'primer_mes_factor' THEN
               CASE WHEN jsonb_typeof(valor) = 'number' THEN valor::numeric BETWEEN 0 AND 1 ELSE false END
             WHEN 'dias_habiles_semana' THEN
               CASE WHEN jsonb_typeof(valor) = 'object' THEN valor ?& ARRAY['1', '2', '3', '4', '5', '6', '7'] ELSE false END
             WHEN 'motivos_dia_libre' THEN
               CASE WHEN jsonb_typeof(valor) = 'array' THEN jsonb_array_length(valor) BETWEEN 1 AND 30 ELSE false END
             WHEN 'telefonicas'            THEN jsonb_typeof(valor) = 'object'
             WHEN 'aprobacion_dias_libres' THEN jsonb_typeof(valor) = 'object'
             WHEN 'alertas_mezcla'         THEN jsonb_typeof(valor) = 'object'
             ELSE false
           END),
  CONSTRAINT config_general_anulado_check
    CHECK (anulado_at IS NOT NULL OR (anulado_por IS NULL AND anulado_motivo IS NULL)),
  CONSTRAINT config_general_anterior_check CHECK (anterior_id IS NOT NULL OR anterior_hasta IS NULL),
  CONSTRAINT config_general_sin_superposicion EXCLUDE USING gist
    (clave WITH =, (daterange(vigente_desde, vigente_hasta, '[]')) WITH &&) WHERE (anulado_at IS NULL)
);

-- Perfil y excepciones por Ejecutivo Comercial. Sin fila vigente: perfil médica e institucional, telefónica no
-- habilitada, radio y tope de telefónicas los generales.
CREATE TABLE IF NOT EXISTS public.config_personas (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  executive_id          uuid        NOT NULL REFERENCES public.executives(id),
  perfil                text[]      NOT NULL DEFAULT '{medica,institucional}',
  telefonica_habilitada boolean     NOT NULL DEFAULT false,
  tope_telefonicas_dia  int         NULL,
  radio_m               int         NULL,
  vigente_desde         date        NOT NULL,
  vigente_hasta         date        NULL,
  motivo                text        NULL,
  set_by                uuid        NULL REFERENCES public.users(id),
  created_at            timestamptz NOT NULL DEFAULT now(),
  anulado_at            timestamptz NULL,
  anulado_por           uuid        NULL REFERENCES public.users(id),
  anulado_motivo        text        NULL,
  anterior_id           uuid        NULL REFERENCES public.config_personas(id),
  anterior_hasta        date        NULL,
  clave                 text        GENERATED ALWAYS AS (executive_id::text) STORED,
  CONSTRAINT config_personas_vigencia_check CHECK (vigente_hasta IS NULL OR vigente_hasta >= vigente_desde),
  CONSTRAINT config_personas_perfil_check
    CHECK (cardinality(perfil) >= 1 AND perfil <@ ARRAY['medica', 'institucional']::text[]),
  CONSTRAINT config_personas_tope_check  CHECK (tope_telefonicas_dia IS NULL OR tope_telefonicas_dia BETWEEN 0 AND 20),
  CONSTRAINT config_personas_radio_check CHECK (radio_m IS NULL OR radio_m BETWEEN 50 AND 5000),
  CONSTRAINT config_personas_anulado_check
    CHECK (anulado_at IS NOT NULL OR (anulado_por IS NULL AND anulado_motivo IS NULL)),
  CONSTRAINT config_personas_anterior_check CHECK (anterior_id IS NOT NULL OR anterior_hasta IS NULL),
  CONSTRAINT config_personas_sin_superposicion EXCLUDE USING gist
    (clave WITH =, (daterange(vigente_desde, vigente_hasta, '[]')) WITH &&) WHERE (anulado_at IS NULL)
);

-- -------------------------------------------------------------------------------------
-- 3. Calendario y días libres
-- -------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.calendario (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha           date        NOT NULL,
  alcance         text        NOT NULL,
  municipality_id varchar(5)  NULL REFERENCES public.municipalities(code),
  tipo            text        NOT NULL,
  nombre          text        NOT NULL,
  origen          text        NOT NULL DEFAULT 'manual',
  created_by      uuid        NULL REFERENCES public.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  anulado_at      timestamptz NULL,
  anulado_por     uuid        NULL REFERENCES public.users(id) ON DELETE SET NULL,
  anulado_motivo  text        NULL,
  CONSTRAINT calendario_alcance_check   CHECK (alcance IN ('nacional', 'empresa', 'ciudad')),
  CONSTRAINT calendario_tipo_check      CHECK (tipo IN ('no_habil', 'habil')),
  CONSTRAINT calendario_origen_check    CHECK (origen IN ('calculado', 'manual')),
  CONSTRAINT calendario_municipio_check
    CHECK ((alcance = 'ciudad') = (municipality_id IS NOT NULL)
           AND (municipality_id IS NULL OR municipality_id ~ '^[0-9]{5}$')),
  CONSTRAINT calendario_nacional_check  CHECK (alcance <> 'nacional' OR tipo = 'no_habil'),
  CONSTRAINT calendario_calculado_check CHECK (origen <> 'calculado' OR alcance = 'nacional'),
  CONSTRAINT calendario_nombre_check    CHECK (btrim(nombre) <> ''),
  CONSTRAINT calendario_anulado_check
    CHECK ((anulado_at IS NULL AND anulado_por IS NULL AND anulado_motivo IS NULL)
           OR (anulado_at IS NOT NULL AND btrim(coalesce(anulado_motivo, '')) <> ''))
);

CREATE TABLE IF NOT EXISTS public.dias_libres (
  id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  executive_id    uuid         NOT NULL REFERENCES public.executives(id),
  fecha           date         NOT NULL,
  fraccion        numeric(2,1) NOT NULL,
  motivo          text         NOT NULL,
  nota            text         NULL,
  estado          text         NOT NULL,
  registrado_por  uuid         NULL REFERENCES public.users(id) ON DELETE SET NULL,
  registrado_at   timestamptz  NOT NULL DEFAULT now(),
  fuera_de_plazo  boolean      NOT NULL DEFAULT false,
  justificacion   text         NULL,
  revisado_por    uuid         NULL REFERENCES public.users(id) ON DELETE SET NULL,
  revisado_at     timestamptz  NULL,
  motivo_revision text         NULL,
  created_at      timestamptz  NOT NULL DEFAULT now(),
  updated_at      timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT dias_libres_fraccion_check CHECK (fraccion IN (0.5, 1)),
  CONSTRAINT dias_libres_motivo_check   CHECK (motivo ~ '^[a-z_]{2,40}$'),
  CONSTRAINT dias_libres_nota_check     CHECK (nota IS NULL OR length(nota) <= 500),
  CONSTRAINT dias_libres_estado_check
    CHECK (estado IN ('registrado', 'por_aprobar', 'aprobado', 'rechazado', 'anulado')),
  CONSTRAINT dias_libres_fuera_de_plazo_check
    CHECK (NOT fuera_de_plazo OR length(btrim(coalesce(justificacion, ''))) >= 5),
  CONSTRAINT dias_libres_revision_check
    CHECK (estado NOT IN ('aprobado', 'rechazado', 'anulado') OR revisado_at IS NOT NULL),
  CONSTRAINT dias_libres_motivo_revision_check
    CHECK (estado NOT IN ('rechazado', 'anulado') OR btrim(coalesce(motivo_revision, '')) <> '')
);

-- -------------------------------------------------------------------------------------
-- 4. Índices (las PK y las restricciones de exclusión ya crean el suyo)
-- -------------------------------------------------------------------------------------

-- Un día activo por fecha + alcance + municipio (anular libera el cupo).
CREATE UNIQUE INDEX IF NOT EXISTS calendario_dia_activo_uidx
  ON public.calendario (fecha, alcance, (coalesce(municipality_id, '')))
  WHERE anulado_at IS NULL;
-- Un día libre vigente por persona y fecha (409 en la API).
CREATE UNIQUE INDEX IF NOT EXISTS dias_libres_vigente_uidx
  ON public.dias_libres (executive_id, fecha)
  WHERE estado IN ('registrado', 'por_aprobar', 'aprobado');
CREATE INDEX IF NOT EXISTS dias_libres_fecha_idx       ON public.dias_libres (fecha);
CREATE INDEX IF NOT EXISTS dias_libres_por_aprobar_idx ON public.dias_libres (fecha) WHERE estado = 'por_aprobar';

-- -------------------------------------------------------------------------------------
-- 5. Disparadores: configuración inmutable, nada se borra, updated_at
-- -------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.config_inmutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  -- clave es generada: se recalcula sola a partir de columnas que sí se comparan.
  v_libres constant text[] := ARRAY['vigente_hasta', 'anulado_at', 'anulado_por', 'anulado_motivo', 'clave'];
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'La configuración no se borra: se cierra o se anula (% %)', TG_TABLE_NAME, OLD.id
      USING ERRCODE = 'check_violation';
  END IF;
  IF OLD.anulado_at IS NOT NULL THEN
    RAISE EXCEPTION 'Un valor de configuración anulado no se modifica (% %)', TG_TABLE_NAME, OLD.id
      USING ERRCODE = 'check_violation';
  END IF;
  IF (to_jsonb(NEW) - v_libres) IS DISTINCT FROM (to_jsonb(OLD) - v_libres) THEN
    RAISE EXCEPTION 'La configuración no se edita: solo se cierra (vigente_hasta) o se anula; un valor nuevo se registra aparte (% %)',
      TG_TABLE_NAME, OLD.id
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.visitas_sin_borrar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'Las filas de % no se borran: se anulan con motivo', TG_TABLE_NAME
    USING ERRCODE = 'check_violation';
END;
$$;

CREATE OR REPLACE TRIGGER config_inmutable
  BEFORE UPDATE OR DELETE ON public.config_metas
  FOR EACH ROW EXECUTE FUNCTION public.config_inmutable();
CREATE OR REPLACE TRIGGER config_inmutable
  BEFORE UPDATE OR DELETE ON public.config_conteo
  FOR EACH ROW EXECUTE FUNCTION public.config_inmutable();
CREATE OR REPLACE TRIGGER config_inmutable
  BEFORE UPDATE OR DELETE ON public.config_general
  FOR EACH ROW EXECUTE FUNCTION public.config_inmutable();
CREATE OR REPLACE TRIGGER config_inmutable
  BEFORE UPDATE OR DELETE ON public.config_personas
  FOR EACH ROW EXECUTE FUNCTION public.config_inmutable();

CREATE OR REPLACE TRIGGER calendario_sin_borrar
  BEFORE DELETE ON public.calendario
  FOR EACH ROW EXECUTE FUNCTION public.visitas_sin_borrar();
CREATE OR REPLACE TRIGGER dias_libres_sin_borrar
  BEFORE DELETE ON public.dias_libres
  FOR EACH ROW EXECUTE FUNCTION public.visitas_sin_borrar();

CREATE OR REPLACE TRIGGER update_dias_libres_updated_at
  BEFORE UPDATE ON public.dias_libres
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- -------------------------------------------------------------------------------------
-- 6. Festivos de Colombia (Ley 51 de 1983)
-- -------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.calendario_festivos_colombia(p_anio int)
RETURNS TABLE (fecha date, nombre text)
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_a      int;
  v_b      int;
  v_c      int;
  v_d      int;
  v_e      int;
  v_f      int;
  v_g      int;
  v_h      int;
  v_i      int;
  v_k      int;
  v_l      int;
  v_m      int;
  v_mes    int;
  v_dia    int;
  v_pascua date;
BEGIN
  IF p_anio IS NULL OR p_anio < 1900 OR p_anio > 2200 THEN
    RAISE EXCEPTION 'Año fuera de rango para calcular festivos: % (de 1900 a 2200)', p_anio
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- Domingo de Pascua: algoritmo gregoriano anónimo (Meeus/Jones/Butcher). División entera.
  v_a   := p_anio % 19;
  v_b   := p_anio / 100;
  v_c   := p_anio % 100;
  v_d   := v_b / 4;
  v_e   := v_b % 4;
  v_f   := (v_b + 8) / 25;
  v_g   := (v_b - v_f + 1) / 3;
  v_h   := (19 * v_a + v_b - v_d - v_g + 15) % 30;
  v_i   := v_c / 4;
  v_k   := v_c % 4;
  v_l   := (32 + 2 * v_e + 2 * v_i - v_h - v_k) % 7;
  v_m   := (v_a + 11 * v_h + 22 * v_l) / 451;
  v_mes := (v_h + v_l - 7 * v_m + 114) / 31;
  v_dia := ((v_h + v_l - 7 * v_m + 114) % 31) + 1;
  v_pascua := make_date(p_anio, v_mes, v_dia);

  -- al_lunes: se traslada al lunes siguiente si no cae en lunes (isodow 1 = lunes … 7 = domingo).
  RETURN QUERY
  SELECT CASE WHEN b.al_lunes THEN b.base + ((8 - extract(isodow FROM b.base)::int) % 7) ELSE b.base END,
         b.nom
  FROM (VALUES
    (make_date(p_anio, 1, 1),   'Año Nuevo'::text,                  false),
    (make_date(p_anio, 5, 1),   'Día del Trabajo'::text,            false),
    (make_date(p_anio, 7, 20),  'Día de la Independencia'::text,    false),
    (make_date(p_anio, 8, 7),   'Batalla de Boyacá'::text,          false),
    (make_date(p_anio, 12, 8),  'Inmaculada Concepción'::text,      false),
    (make_date(p_anio, 12, 25), 'Navidad'::text,                    false),
    (make_date(p_anio, 1, 6),   'Día de los Reyes Magos'::text,     true),
    (make_date(p_anio, 3, 19),  'Día de San José'::text,            true),
    (make_date(p_anio, 6, 29),  'San Pedro y San Pablo'::text,      true),
    (make_date(p_anio, 8, 15),  'Asunción de la Virgen'::text,      true),
    (make_date(p_anio, 10, 12), 'Día de la Raza'::text,             true),
    (make_date(p_anio, 11, 1),  'Todos los Santos'::text,           true),
    (make_date(p_anio, 11, 11), 'Independencia de Cartagena'::text, true),
    (v_pascua - 3,              'Jueves Santo'::text,               false),
    (v_pascua - 2,              'Viernes Santo'::text,              false),
    (v_pascua + 43,             'Ascensión del Señor'::text,        true),
    (v_pascua + 64,             'Corpus Christi'::text,             true),
    (v_pascua + 71,             'Sagrado Corazón de Jesús'::text,   true)
  ) AS b(base, nom, al_lunes)
  ORDER BY 1, 2;
END;
$$;

-- Inserta los festivos del año como nacional · no_habil · calculado. Salta las fechas que ya tienen una fila
-- nacional (activa o ANULADA: una corrección de recursos humanos no se revive). Si dos festivos caen el mismo
-- día (p. ej. 2038-07-05), guarda una sola fila con los dos nombres. Devuelve cuántas filas insertó.
CREATE OR REPLACE FUNCTION public.calendario_cargar_festivos(p_anio int, p_user uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_n int;
BEGIN
  IF p_anio IS NULL OR p_anio < 1900 OR p_anio > 2200 THEN
    RAISE EXCEPTION 'Año fuera de rango para cargar festivos: % (de 1900 a 2200)', p_anio
      USING ERRCODE = 'invalid_parameter_value';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('calendario_festivos:' || p_anio::text));

  INSERT INTO public.calendario (fecha, alcance, tipo, nombre, origen, created_by)
  SELECT f.fecha, 'nacional', 'no_habil', string_agg(f.nombre, ' y ' ORDER BY f.nombre), 'calculado', p_user
  FROM public.calendario_festivos_colombia(p_anio) AS f
  WHERE NOT EXISTS (SELECT 1 FROM public.calendario c WHERE c.fecha = f.fecha AND c.alcance = 'nacional')
  GROUP BY f.fecha
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;

-- -------------------------------------------------------------------------------------
-- 7. Escrituras de configuración (la API pasa SIEMPRE por aquí)
-- -------------------------------------------------------------------------------------

-- config_registrar: registra un valor nuevo [p_desde, p_hasta] para la clave que sale de p_valores.
-- p_valores por tabla (la API ya lo validó con zod):
--   config_metas:    { scope, kam_id?, executive_id?, tipo, subtipo_id?, periodo, cantidad }
--   config_conteo:   { subtipo_id, modo, peso? (1) }
--   config_general:  { parametro, valor }
--   config_personas: { executive_id, perfil? (['medica','institucional']), telefonica_habilitada? (false),
--                      tope_telefonicas_dia?, radio_m? }
CREATE OR REPLACE FUNCTION public.config_registrar(p_tabla text, p_valores jsonb, p_desde date, p_hasta date,
                                                   p_motivo text, p_user uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_hoy    constant date := (now() AT TIME ZONE 'America/Bogota')::date;
  v_motivo constant text := nullif(btrim(p_motivo), '');
  v_clave  text;
  v_cols   text;
  v_fila   record;
  v_choque date;
  v_hasta  date;
  v_id     uuid;
  v_ant_id    uuid;  -- la fila que regía en p_desde (a lo sumo una: no hay rangos activos superpuestos)
  v_ant_hasta date;  -- su vigente_hasta antes del cambio (NULL = abierta)
BEGIN
  -- 1. Tabla válida (y datos mínimos para seguir)
  IF p_tabla IS NULL OR p_tabla NOT IN ('config_metas', 'config_conteo', 'config_general', 'config_personas') THEN
    RAISE EXCEPTION 'Tabla de configuración no válida: %', coalesce(p_tabla, '(vacía)')
      USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF p_valores IS NULL OR jsonb_typeof(p_valores) <> 'object' THEN
    RAISE EXCEPTION 'Faltan los valores del cambio' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF p_desde IS NULL THEN
    RAISE EXCEPTION 'Falta la fecha "Rige desde"' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- 2. Clave de la fila nueva (misma expresión que la columna generada; los uuid en su forma canónica) y
  --    candado de la clave hasta el final de la transacción.
  IF p_tabla = 'config_metas' THEN
    v_clave := (p_valores ->> 'scope') || ':'
               || coalesce(nullif(btrim(p_valores ->> 'kam_id'), '')::uuid::text,
                           nullif(btrim(p_valores ->> 'executive_id'), '')::uuid::text, '-') || ':'
               || (p_valores ->> 'tipo') || ':'
               || coalesce(nullif(btrim(p_valores ->> 'subtipo_id'), '')::uuid::text, '-');
    v_cols  := 'scope, kam_id, executive_id, tipo, subtipo_id, periodo, cantidad';
  ELSIF p_tabla = 'config_conteo' THEN
    v_clave := nullif(btrim(p_valores ->> 'subtipo_id'), '')::uuid::text;
    v_cols  := 'subtipo_id, modo, peso';
  ELSIF p_tabla = 'config_general' THEN
    v_clave := p_valores ->> 'parametro';
    v_cols  := 'parametro, valor';
  ELSE
    v_clave := nullif(btrim(p_valores ->> 'executive_id'), '')::uuid::text;
    v_cols  := 'executive_id, perfil, telefonica_habilitada, tope_telefonicas_dia, radio_m';
  END IF;
  IF v_clave IS NULL THEN
    RAISE EXCEPTION 'Faltan los valores que identifican la clave en %', p_tabla
      USING ERRCODE = 'invalid_parameter_value';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext(p_tabla || ':' || v_clave));

  -- 3. Cambiar el pasado exige motivo
  IF p_desde < v_hoy AND length(coalesce(v_motivo, '')) < 5 THEN
    RAISE EXCEPTION 'Para cambiar el pasado hace falta un motivo' USING ERRCODE = 'check_violation';
  END IF;

  -- 4. "hasta" no antes de "desde"
  IF p_hasta IS NOT NULL AND p_hasta < p_desde THEN
    RAISE EXCEPTION 'La fecha "hasta" (%) no puede ser anterior a "Rige desde" (%)',
      to_char(p_hasta, 'YYYY-MM-DD'), to_char(p_desde, 'YYYY-MM-DD')
      USING ERRCODE = 'check_violation';
  END IF;

  -- 5. Filas activas de la clave que rigen en p_desde: la que empieza ese mismo día se anula; la que empieza
  --    antes se corta al día anterior. Si seguía vigente después de p_hasta, se crea su continuación
  --    [p_hasta + 1, su fin original] con sus mismos valores (vuelve a regir al terminar el valor temporal).
  --    La fila nueva guarda cuál era y su fin original (anterior_id, anterior_hasta) para config_cerrar.
  FOR v_fila IN EXECUTE format(
      'SELECT id, vigente_desde, vigente_hasta FROM public.%I
        WHERE clave = $1 AND anulado_at IS NULL
          AND vigente_desde <= $2 AND (vigente_hasta IS NULL OR vigente_hasta >= $2)
        ORDER BY vigente_desde
        FOR UPDATE', p_tabla)
    USING v_clave, p_desde
  LOOP
    v_ant_id    := v_fila.id;
    v_ant_hasta := v_fila.vigente_hasta;
    IF v_fila.vigente_desde = p_desde THEN
      EXECUTE format('UPDATE public.%I SET anulado_at = now(), anulado_por = $1, anulado_motivo = $2 WHERE id = $3',
                     p_tabla)
        USING p_user, 'Reemplazado por un valor nuevo con la misma fecha de inicio', v_fila.id;
    ELSE
      EXECUTE format('UPDATE public.%I SET vigente_hasta = $1 WHERE id = $2', p_tabla)
        USING p_desde - 1, v_fila.id;
    END IF;
    IF p_hasta IS NOT NULL AND (v_fila.vigente_hasta IS NULL OR v_fila.vigente_hasta > p_hasta) THEN
      EXECUTE format('INSERT INTO public.%1$I (%2$s, vigente_desde, vigente_hasta, motivo, set_by)
                      SELECT %2$s, $1, $2, $3, $4 FROM public.%1$I WHERE id = $5', p_tabla, v_cols)
        USING p_hasta + 1, v_fila.vigente_hasta, 'Continúa después de un valor temporal', p_user, v_fila.id;
    END IF;
  END LOOP;

  -- 6. "hasta" efectivo: p_hasta (si no choca con un valor que empieza después de p_desde) o, sin p_hasta, el día
  --    anterior al inicio de la siguiente fila activa de la clave (NULL si no hay).
  EXECUTE format('SELECT min(vigente_desde) FROM public.%I
                   WHERE clave = $1 AND anulado_at IS NULL AND vigente_desde > $2', p_tabla)
    INTO v_choque
    USING v_clave, p_desde;
  IF p_hasta IS NOT NULL THEN
    IF v_choque IS NOT NULL AND v_choque <= p_hasta THEN
      RAISE EXCEPTION 'El rango se superpone con un valor que empieza el %', to_char(v_choque, 'YYYY-MM-DD')
        USING ERRCODE = 'exclusion_violation';
    END IF;
    v_hasta := p_hasta;
  ELSE
    v_hasta := v_choque - 1;
  END IF;

  -- 7. Fila nueva
  IF p_tabla = 'config_metas' THEN
    INSERT INTO public.config_metas (scope, kam_id, executive_id, tipo, subtipo_id, periodo, cantidad,
                                     vigente_desde, vigente_hasta, motivo, set_by, anterior_id, anterior_hasta)
    VALUES (p_valores ->> 'scope',
            nullif(btrim(p_valores ->> 'kam_id'), '')::uuid,
            nullif(btrim(p_valores ->> 'executive_id'), '')::uuid,
            p_valores ->> 'tipo',
            nullif(btrim(p_valores ->> 'subtipo_id'), '')::uuid,
            p_valores ->> 'periodo',
            (p_valores ->> 'cantidad')::numeric,
            p_desde, v_hasta, v_motivo, p_user, v_ant_id, v_ant_hasta)
    RETURNING id INTO v_id;
  ELSIF p_tabla = 'config_conteo' THEN
    INSERT INTO public.config_conteo (subtipo_id, modo, peso, vigente_desde, vigente_hasta, motivo, set_by, anterior_id,
                                      anterior_hasta)
    VALUES (nullif(btrim(p_valores ->> 'subtipo_id'), '')::uuid,
            p_valores ->> 'modo',
            coalesce((p_valores ->> 'peso')::numeric, 1),
            p_desde, v_hasta, v_motivo, p_user, v_ant_id, v_ant_hasta)
    RETURNING id INTO v_id;
  ELSIF p_tabla = 'config_general' THEN
    INSERT INTO public.config_general (parametro, valor, vigente_desde, vigente_hasta, motivo, set_by, anterior_id,
                                       anterior_hasta)
    VALUES (p_valores ->> 'parametro', p_valores -> 'valor', p_desde, v_hasta, v_motivo, p_user, v_ant_id, v_ant_hasta)
    RETURNING id INTO v_id;
  ELSE
    INSERT INTO public.config_personas (executive_id, perfil, telefonica_habilitada, tope_telefonicas_dia, radio_m,
                                        vigente_desde, vigente_hasta, motivo, set_by, anterior_id, anterior_hasta)
    VALUES (nullif(btrim(p_valores ->> 'executive_id'), '')::uuid,
            CASE WHEN jsonb_typeof(p_valores -> 'perfil') = 'array'
                 THEN ARRAY(SELECT jsonb_array_elements_text(p_valores -> 'perfil'))
                 ELSE ARRAY['medica', 'institucional']::text[] END,
            coalesce((p_valores ->> 'telefonica_habilitada')::boolean, false),
            (p_valores ->> 'tope_telefonicas_dia')::int,
            (p_valores ->> 'radio_m')::int,
            p_desde, v_hasta, v_motivo, p_user, v_ant_id, v_ant_hasta)
    RETURNING id INTO v_id;
  END IF;

  RETURN v_id;
END;
$$;

-- config_cerrar: termina un valor (vigente_hasta = p_hasta) o, si p_hasta es anterior a su inicio, lo anula.
-- Motivo (5+) obligatorio si p_hasta es anterior a hoy. Fila anulada o inexistente → P0002.
-- Después, si quedó un hueco [h, fin original] (h = su inicio al anular, p_hasta + 1 al acortar) y el valor había
-- cortado o reemplazado otro al registrarse (anterior_id), en el hueco vuelve a regir ese valor anterior, hasta
-- min(fin original, anterior_hasta) (decisión 12 del contrato; espejo: planearCierre de lib/visits-rules.ts):
--   - si el anterior empezaba el mismo día (este lo reemplazó y quedó anulado), se copian sus valores;
--   - si no, vuelve la fila activa de la clave que termina justo el día antes de este valor (la que cortó, o la
--     que la reemplazó o alargó después): se alarga si termina el día antes del hueco (al anular) o se copian sus
--     valores (al acortar), con motivo 'Vuelve a regir el valor anterior'.
--   Sin anterior_id (se registró sobre un hueco, es una continuación o una semilla) no vuelve nada.
CREATE OR REPLACE FUNCTION public.config_cerrar(p_tabla text, p_id uuid, p_hasta date, p_motivo text, p_user uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_hoy        constant date := (now() AT TIME ZONE 'America/Bogota')::date;
  v_motivo     constant text := nullif(btrim(p_motivo), '');
  v_clave      text;
  v_cols       text;
  v_desde      date;
  v_hasta      date;
  v_anulado    timestamptz;
  v_ant_id     uuid;
  v_ant_hasta  date;
  v_ant_desde  date;
  v_hueco      date;         -- primer día que este valor deja libre (NULL = no deja hueco)
  v_fin        date;         -- último día en que vuelve a regir el anterior (NULL = abierto)
  v_fuente     uuid;         -- fila cuyos valores vuelven a regir
  v_fuente_fin date;
  v_fuente_anu timestamptz;
BEGIN
  IF p_tabla IS NULL OR p_tabla NOT IN ('config_metas', 'config_conteo', 'config_general', 'config_personas') THEN
    RAISE EXCEPTION 'Tabla de configuración no válida: %', coalesce(p_tabla, '(vacía)')
      USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF p_hasta IS NULL THEN
    RAISE EXCEPTION 'Falta la fecha "hasta"' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  v_cols := CASE p_tabla
              WHEN 'config_metas'   THEN 'scope, kam_id, executive_id, tipo, subtipo_id, periodo, cantidad'
              WHEN 'config_conteo'  THEN 'subtipo_id, modo, peso'
              WHEN 'config_general' THEN 'parametro, valor'
              ELSE 'executive_id, perfil, telefonica_habilitada, tope_telefonicas_dia, radio_m'
            END;

  EXECUTE format('SELECT clave FROM public.%I WHERE id = $1', p_tabla) INTO v_clave USING p_id;
  IF v_clave IS NULL THEN
    RAISE EXCEPTION 'No existe ese valor de configuración' USING ERRCODE = 'no_data_found';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext(p_tabla || ':' || v_clave));

  EXECUTE format('SELECT vigente_desde, vigente_hasta, anulado_at, anterior_id, anterior_hasta
                    FROM public.%I WHERE id = $1 FOR UPDATE', p_tabla)
    INTO v_desde, v_hasta, v_anulado, v_ant_id, v_ant_hasta
    USING p_id;
  IF v_desde IS NULL OR v_anulado IS NOT NULL THEN
    RAISE EXCEPTION 'Ese valor de configuración ya está anulado' USING ERRCODE = 'no_data_found';
  END IF;

  IF p_hasta < v_hoy AND length(coalesce(v_motivo, '')) < 5 THEN
    RAISE EXCEPTION 'Para cerrar o anular un valor en el pasado hace falta un motivo' USING ERRCODE = 'check_violation';
  END IF;

  IF p_hasta >= v_desde THEN
    IF v_hasta IS NULL OR v_hasta > p_hasta THEN
      EXECUTE format('UPDATE public.%I SET vigente_hasta = $1 WHERE id = $2', p_tabla) USING p_hasta, p_id;
      v_hueco := p_hasta + 1;
    END IF;
  ELSE
    EXECUTE format('UPDATE public.%I SET anulado_at = now(), anulado_por = $1, anulado_motivo = $2 WHERE id = $3',
                   p_tabla)
      USING p_user, coalesce(v_motivo, 'Cerrado antes de empezar a regir'), p_id;
    v_hueco := v_desde;
  END IF;

  -- Vuelve a regir el valor anterior en el hueco [v_hueco, v_fin]
  IF v_hueco IS NULL OR v_ant_id IS NULL THEN
    RETURN;
  END IF;
  v_fin := CASE WHEN v_hasta IS NULL     THEN v_ant_hasta
                WHEN v_ant_hasta IS NULL THEN v_hasta
                ELSE least(v_hasta, v_ant_hasta) END;
  IF v_fin IS NOT NULL AND v_fin < v_hueco THEN
    RETURN;
  END IF;
  EXECUTE format('SELECT vigente_desde FROM public.%I WHERE id = $1', p_tabla) INTO v_ant_desde USING v_ant_id;
  IF v_ant_desde = v_desde THEN
    v_fuente := v_ant_id;  -- lo reemplazó el mismo día (quedó anulado): vuelven sus valores
  ELSE
    EXECUTE format('SELECT id FROM public.%I
                     WHERE clave = $1 AND anulado_at IS NULL AND id <> $2 AND vigente_hasta = $3
                     ORDER BY vigente_desde DESC LIMIT 1 FOR UPDATE', p_tabla)
      INTO v_fuente
      USING v_clave, p_id, v_desde - 1;
  END IF;
  IF v_fuente IS NULL THEN
    RETURN;
  END IF;
  EXECUTE format('SELECT vigente_hasta, anulado_at FROM public.%I WHERE id = $1', p_tabla)
    INTO v_fuente_fin, v_fuente_anu
    USING v_fuente;
  IF v_fuente_anu IS NULL AND v_fuente_fin = v_hueco - 1 THEN
    EXECUTE format('UPDATE public.%I SET vigente_hasta = $1 WHERE id = $2', p_tabla) USING v_fin, v_fuente;
  ELSE
    EXECUTE format('INSERT INTO public.%1$I (%2$s, vigente_desde, vigente_hasta, motivo, set_by)
                    SELECT %2$s, $1, $2, $3, $4 FROM public.%1$I WHERE id = $5', p_tabla, v_cols)
      USING v_hueco, v_fin, 'Vuelve a regir el valor anterior', p_user, v_fuente;
  END IF;
END;
$$;

-- -------------------------------------------------------------------------------------
-- 8. Rol de recursos humanos
-- -------------------------------------------------------------------------------------

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_role_check,
  ADD CONSTRAINT users_role_check
    CHECK (role IN ('admin', 'user', 'viewer', 'sales_manager', 'contract_manager', 'data_manager', 'line_leader',
                    'commercial_director', 'hr'));

-- -------------------------------------------------------------------------------------
-- 9. Seguridad: RLS sin políticas; nada para PUBLIC/anon/authenticated; service_role lee, inserta y actualiza
--    (sin DELETE ni TRUNCATE: estas filas nunca se borran; TRUNCATE saltaría los disparadores).
-- -------------------------------------------------------------------------------------

ALTER TABLE public.config_metas    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.config_conteo   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.config_general  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.config_personas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendario      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dias_libres     ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.config_metas, public.config_conteo, public.config_general, public.config_personas,
                    public.calendario, public.dias_libres
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE
  ON TABLE public.config_metas, public.config_conteo, public.config_general, public.config_personas,
           public.calendario, public.dias_libres
  TO service_role;

REVOKE ALL ON FUNCTION public.config_registrar(text, jsonb, date, date, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.config_cerrar(text, uuid, date, text, uuid)          FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.calendario_festivos_colombia(int)                    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.calendario_cargar_festivos(int, uuid)                FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.config_inmutable()                                   FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.visitas_sin_borrar()                                 FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.config_registrar(text, jsonb, date, date, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.config_cerrar(text, uuid, date, text, uuid)          TO service_role;
GRANT EXECUTE ON FUNCTION public.calendario_festivos_colombia(int)                    TO service_role;
GRANT EXECUTE ON FUNCTION public.calendario_cargar_festivos(int, uuid)                TO service_role;

-- -------------------------------------------------------------------------------------
-- 10. Documentación en el catálogo
-- -------------------------------------------------------------------------------------

COMMENT ON TABLE public.config_metas IS
  'Metas de visitas con vigencias (app de visita, F2): por tipo (medica | institucional) y subtipo con meta propia; '
  'scope general (toda la empresa), zona (kam_id, valor por defecto) o ejecutiva (executive_id, excepción); periodo '
  'dia | semana; cantidad 0..100. Sin rangos activos superpuestos por clave (config_metas_sin_superposicion); no se '
  'edita ni se borra (config_inmutable): se escribe con config_registrar y se cierra con config_cerrar. Contrato: '
  'docs/fases/fase7-visitas-f2-config-calendario.md. Solo service_role.';
COMMENT ON COLUMN public.config_metas.clave IS
  'Generada: scope:kam_id|executive_id|-:tipo:subtipo_id|-. Dos filas activas de la misma clave no se superponen.';
COMMENT ON COLUMN public.config_metas.vigente_hasta IS
  'Inclusive; NULL = abierto (rige hasta el siguiente cambio o indefinidamente).';
COMMENT ON COLUMN public.config_metas.anulado_at IS
  'Fila anulada (reemplazada el mismo día, cerrada antes de empezar o corregida): no cuenta para ningún cálculo.';
COMMENT ON COLUMN public.config_metas.anterior_id IS
  'La fila que este valor cortó o reemplazó al registrarse (config_registrar); con anterior_hasta (su fin de antes, '
  'NULL = abierta) config_cerrar la hace volver a regir si este valor se cancela o se acorta. Igual en config_conteo, '
  'config_general y config_personas.';

COMMENT ON TABLE public.config_conteo IS
  'Qué cuenta cada subtipo institucional, con vigencias: modo suma_institucional (suma a la meta institucional con su '
  'peso) | meta_propia (cuenta para la meta del subtipo) | seguimiento (no suma); peso >0..10. Semilla 0810: compras y '
  'autorizaciones suman con peso 1; quimico_farmaceutico, programacion y otro solo seguimiento. Clave = subtipo_id. '
  'Solo service_role.';

COMMENT ON TABLE public.config_general IS
  'Parámetros generales con vigencias (clave = parametro): radio_presencial_m, plazo_gracia_horas, dias_habiles_semana, '
  'tope_visitas_medico_dia, telefonicas, aprobacion_dias_libres, motivos_dia_libre, primer_mes_factor, alertas_mezcla. '
  'Aquí se comprueban el tipo jsonb y los rangos numéricos; la forma completa la valida la API con zod. Solo service_role.';

COMMENT ON TABLE public.config_personas IS
  'Perfil y excepciones por Ejecutivo Comercial con vigencias (clave = executive_id): perfil (medica, institucional), '
  'telefónica habilitada, tope de telefónicas al día y radio propio. Sin fila vigente: perfil médica e institucional, '
  'telefónica no habilitada, radio y tope los generales. Solo service_role.';

COMMENT ON TABLE public.calendario IS
  'Días que cambian lo hábil: festivos nacionales (origen calculado por calendario_cargar_festivos o manual), días de '
  'empresa y días por ciudad (municipality_id, solo para quienes trabajan en ese municipio). tipo no_habil | habil '
  '(nacional solo no_habil). Uno activo por fecha + alcance + municipio (calendario_dia_activo_uidx); nunca se borra '
  '(calendario_sin_borrar): se anula con motivo. Solo service_role.';

COMMENT ON TABLE public.dias_libres IS
  'Días libres de cada Ejecutivo Comercial: fraccion 1 (día completo) o 0.5 (medio día), motivo (código de '
  'motivos_dia_libre, lo valida la API), estado registrado | por_aprobar | aprobado | rechazado | anulado. Uno vigente '
  'por persona y fecha (dias_libres_vigente_uidx); fuera_de_plazo exige justificación; nunca se borra '
  '(dias_libres_sin_borrar). Para la cuota cuentan registrado (cuando no se exige aprobación) y aprobado. Solo service_role.';
COMMENT ON COLUMN public.dias_libres.fuera_de_plazo IS
  'Registrado después del plazo de gracia por quien aprueba (directora, recursos humanos o admin), con justificación '
  'obligatoria (5+ caracteres).';

COMMENT ON FUNCTION public.config_registrar(text, jsonb, date, date, text, uuid) IS
  'Registra un valor nuevo de configuración [p_desde, p_hasta] (contrato F2, pasos 1 a 7): tabla válida (22023); '
  'candado por clave; pasado sin motivo de 5+ → 23514; hasta < desde → 23514; la fila activa que empieza el mismo día '
  'se anula y la que empieza antes se corta; si seguía después de p_hasta se crea su continuación; sin p_hasta rige '
  'hasta el día antes del siguiente valor; p_hasta que choca con un valor que empieza después → 23P01 "El rango se '
  'superpone con un valor que empieza el AAAA-MM-DD". La fila nueva guarda en anterior_id / anterior_hasta la que '
  'cortó o reemplazó y su fin. Devuelve el id nuevo. SECURITY INVOKER; solo service_role.';
COMMENT ON FUNCTION public.config_cerrar(text, uuid, date, text, uuid) IS
  'Cierra un valor (vigente_hasta = p_hasta, solo si estaba abierto o terminaba después) o lo anula si p_hasta es '
  'anterior a su inicio. Motivo de 5+ obligatorio si p_hasta < hoy (23514). Fila anulada o inexistente → P0002. En el '
  'hueco que deja vuelve a regir el valor que ese había cortado o reemplazado (anterior_id), hasta min(su fin, '
  'anterior_hasta): alarga la fila que termina justo antes o copia sus valores (motivo "Vuelve a regir el valor '
  'anterior"). SECURITY INVOKER; solo service_role.';
COMMENT ON FUNCTION public.calendario_festivos_colombia(int) IS
  'Festivos de Colombia del año (Ley 51 de 1983): Pascua por el algoritmo gregoriano anónimo; fijos; trasladados al '
  'lunes; Jueves y Viernes Santo; Ascensión, Corpus Christi y Sagrado Corazón al lunes. 18 filas por año (dos pueden '
  'caer el mismo día). IMMUTABLE.';
COMMENT ON FUNCTION public.calendario_cargar_festivos(int, uuid) IS
  'Inserta los festivos del año como nacional · no_habil · calculado, saltando las fechas con fila nacional activa o '
  'anulada (no revive correcciones). Dos festivos el mismo día → una fila con los dos nombres. Devuelve cuántas '
  'insertó. SECURITY INVOKER; solo service_role.';
COMMENT ON FUNCTION public.config_inmutable() IS
  'Disparador config_inmutable de las 4 tablas config_*: DELETE siempre falla; UPDATE solo cambia vigente_hasta y '
  'anulado_*, nunca en una fila anulada (23514).';
COMMENT ON FUNCTION public.visitas_sin_borrar() IS
  'Disparadores calendario_sin_borrar y dias_libres_sin_borrar: DELETE prohibido (se anulan con motivo; 23514).';

-- -------------------------------------------------------------------------------------
-- 11. Semillas (vigentes desde 2026-10-12) y festivos 2026 y 2027
-- -------------------------------------------------------------------------------------

-- Metas generales: médica 6 al día e institucional 1 al día. Solo si la clave no tiene ninguna fila.
INSERT INTO public.config_metas (scope, tipo, periodo, cantidad, vigente_desde, motivo)
SELECT 'general', s.tipo, 'dia', s.cantidad, DATE '2026-10-12', 'Valor inicial (decisión del dueño 2026-10-12)'
FROM (VALUES ('medica', 6::numeric), ('institucional', 1::numeric)) AS s(tipo, cantidad)
WHERE NOT EXISTS (SELECT 1 FROM public.config_metas m WHERE m.clave = 'general:-:' || s.tipo || ':-');

-- Conteo por subtipo (buscado por código): compras y autorizaciones suman a la institucional con peso 1; el resto
-- es solo seguimiento.
INSERT INTO public.config_conteo (subtipo_id, modo, peso, vigente_desde, motivo)
SELECT st.id, s.modo, 1, DATE '2026-10-12', 'Valor inicial (decisión del dueño 2026-10-12)'
FROM (VALUES ('compras',              'suma_institucional'),
             ('autorizaciones',       'suma_institucional'),
             ('quimico_farmaceutico', 'seguimiento'),
             ('programacion',         'seguimiento'),
             ('otro',                 'seguimiento')) AS s(codigo, modo)
JOIN public.subtipos_institucionales st ON st.codigo = s.codigo
WHERE NOT EXISTS (SELECT 1 FROM public.config_conteo c WHERE c.subtipo_id = st.id);

-- Parámetros generales (valores literales del contrato).
INSERT INTO public.config_general (parametro, valor, vigente_desde, motivo)
SELECT s.parametro, s.valor, DATE '2026-10-12', 'Valor inicial (decisión del dueño 2026-10-12)'
FROM (VALUES
  ('radio_presencial_m',      '500'::jsonb),
  ('plazo_gracia_horas',      '24'::jsonb),
  ('dias_habiles_semana',     '{"1":1,"2":1,"3":1,"4":1,"5":1,"6":0,"7":0}'::jsonb),
  ('tope_visitas_medico_dia', '1'::jsonb),
  ('telefonicas',             '{"tope_dia":1,"peso":1,"medios":["llamada","videollamada"]}'::jsonb),
  ('aprobacion_dias_libres',  '{"requiere":true,"aprueban":["commercial_director","hr"]}'::jsonb),
  ('motivos_dia_libre',       '[{"codigo":"vacaciones","nombre":"Vacaciones"},{"codigo":"incapacidad","nombre":"Incapacidad"},{"codigo":"cita_medica","nombre":"Cita médica"},{"codigo":"capacitacion","nombre":"Capacitación"},{"codigo":"congreso","nombre":"Congreso"},{"codigo":"acompanamiento_cirugia","nombre":"Acompañamiento de cirugía"},{"codigo":"administrativo","nombre":"Administrativo"},{"codigo":"otro","nombre":"Otro"}]'::jsonb),
  ('primer_mes_factor',       '0.5'::jsonb),
  ('alertas_mezcla',          '{}'::jsonb)
) AS s(parametro, valor)
WHERE NOT EXISTS (SELECT 1 FROM public.config_general g WHERE g.parametro = s.parametro);

DO $$
DECLARE
  v_2026 int;
  v_2027 int;
BEGIN
  v_2026 := public.calendario_cargar_festivos(2026, NULL);
  v_2027 := public.calendario_cargar_festivos(2027, NULL);
  RAISE NOTICE '0810 Calendario: festivos insertados: 2026 → %, 2027 → % (0 si ya estaban)', v_2026, v_2027;
END;
$$;

-- -------------------------------------------------------------------------------------
-- 12. Comprobaciones (aborta la transacción si algo no cuadra). Las pruebas que escriben van en sub-bloques que
--     terminan con RAISE SQLSTATE 'P0810': PL/pgSQL deshace todo lo del sub-bloque (no queda ni cambia ninguna
--     fila). Cualquier otra excepción sale del bloque y aborta la migración.
-- -------------------------------------------------------------------------------------

DO $$
DECLARE
  v_tablas      constant text[] := ARRAY['config_metas', 'config_conteo', 'config_general', 'config_personas',
                                         'calendario', 'dias_libres'];
  v_config      constant text[] := ARRAY['config_metas', 'config_conteo', 'config_general', 'config_personas'];
  v_fn_service  constant text[] := ARRAY['public.config_registrar(text, jsonb, date, date, text, uuid)',
                                         'public.config_cerrar(text, uuid, date, text, uuid)',
                                         'public.calendario_festivos_colombia(integer)',
                                         'public.calendario_cargar_festivos(integer, uuid)'];
  v_fn_internas constant text[] := ARRAY['public.config_inmutable()', 'public.visitas_sin_borrar()'];
  v_todos_priv  constant text   := 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER';
  v_semilla     constant text   := 'Valor inicial (decisión del dueño 2026-10-12)';
  v_nueve       constant text[] := ARRAY['admin', 'user', 'viewer', 'sales_manager', 'contract_manager', 'data_manager',
                                         'line_leader', 'commercial_director', 'hr'];
  -- Oráculo del contrato (no la propia función):
  v_fest_2026   constant date[] := ARRAY['2026-01-01', '2026-01-12', '2026-03-23', '2026-04-02', '2026-04-03',
                                         '2026-05-01', '2026-05-18', '2026-06-08', '2026-06-15', '2026-06-29',
                                         '2026-07-20', '2026-08-07', '2026-08-17', '2026-10-12', '2026-11-02',
                                         '2026-11-16', '2026-12-08', '2026-12-25']::date[];
  v_fest_2027   constant date[] := ARRAY['2027-01-01', '2027-01-11', '2027-03-22', '2027-03-25', '2027-03-26',
                                         '2027-05-01', '2027-05-10', '2027-05-31', '2027-06-07', '2027-07-05',
                                         '2027-07-20', '2027-08-07', '2027-08-16', '2027-10-18', '2027-11-01',
                                         '2027-11-15', '2027-12-08', '2027-12-25']::date[];
  v_nombres     constant text[] := ARRAY['Año Nuevo', 'Día del Trabajo', 'Día de la Independencia', 'Batalla de Boyacá',
                                         'Inmaculada Concepción', 'Navidad', 'Día de los Reyes Magos', 'Día de San José',
                                         'San Pedro y San Pablo', 'Asunción de la Virgen', 'Día de la Raza',
                                         'Todos los Santos', 'Independencia de Cartagena', 'Jueves Santo',
                                         'Viernes Santo', 'Ascensión del Señor', 'Corpus Christi',
                                         'Sagrado Corazón de Jesús'];
  v_hoy         constant date := (now() AT TIME ZONE 'America/Bogota')::date;
  v_d           constant date := (now() AT TIME ZONE 'America/Bogota')::date + 3650;  -- pruebas lejos en el futuro
  v_tabla       text;
  v_fn          text;
  v_sql         text;
  v_msg         text;
  v_texto       text;
  v_textos      text[];
  v_fechas      date[];
  v_n           bigint;
  v_exec        uuid;
  v_sub         uuid;
  v_sub_prog    uuid;
  v_mun1        text;
  v_mun2        text;
  v_id          uuid;
  v_id1         uuid;
  v_id2         uuid;
  v_id3         uuid;
  v_idc         uuid;
  v_idm         uuid;
  v_desde       date;
  v_hasta       date;
  v_anulado     timestamptz;
  v_radio       int;
  v_perfil      text[];
  v_periodo     text;
  v_cant        numeric;
  v_valor       jsonb;
  v_k1          text;
  v_k2          text;
  v_ma          uuid;
  v_mr          uuid;
  v_mx          uuid;
  v_my          uuid;
  v_mp          uuid;
  v_md          uuid;
  v_user        uuid;
BEGIN
  -- 12.1 Estructura, RLS sin políticas y privilegios de las 6 tablas
  FOREACH v_tabla IN ARRAY v_tablas LOOP
    IF to_regclass('public.' || v_tabla) IS NULL THEN
      RAISE EXCEPTION '0810: falta la tabla public.%', v_tabla;
    END IF;
    IF NOT (SELECT c.relrowsecurity FROM pg_class c WHERE c.oid = ('public.' || v_tabla)::regclass) THEN
      RAISE EXCEPTION '0810: public.% sin RLS', v_tabla;
    END IF;
    SELECT count(*) INTO v_n FROM pg_policies WHERE schemaname = 'public' AND tablename = v_tabla;
    IF v_n > 0 THEN
      RAISE EXCEPTION '0810: public.% tiene % política(s) RLS; debe tener 0', v_tabla, v_n;
    END IF;
    IF has_table_privilege('anon', 'public.' || v_tabla, v_todos_priv)
       OR has_table_privilege('authenticated', 'public.' || v_tabla, v_todos_priv) THEN
      RAISE EXCEPTION '0810: anon/authenticated tienen privilegios sobre public.%', v_tabla;
    END IF;
    IF NOT (has_table_privilege('service_role', 'public.' || v_tabla, 'SELECT')
            AND has_table_privilege('service_role', 'public.' || v_tabla, 'INSERT')
            AND has_table_privilege('service_role', 'public.' || v_tabla, 'UPDATE')) THEN
      RAISE EXCEPTION '0810: service_role no puede leer, insertar o actualizar public.%', v_tabla;
    END IF;
    IF has_table_privilege('service_role', 'public.' || v_tabla, 'DELETE')
       OR has_table_privilege('service_role', 'public.' || v_tabla, 'TRUNCATE') THEN
      RAISE EXCEPTION '0810: service_role puede borrar o vaciar public.% (estas filas nunca se borran)', v_tabla;
    END IF;
  END LOOP;

  FOREACH v_fn IN ARRAY v_fn_service || v_fn_internas LOOP
    IF has_function_privilege('anon', v_fn, 'EXECUTE') OR has_function_privilege('authenticated', v_fn, 'EXECUTE') THEN
      RAISE EXCEPTION '0810: anon/authenticated pueden ejecutar %', v_fn;
    END IF;
  END LOOP;
  FOREACH v_fn IN ARRAY v_fn_service LOOP
    IF NOT has_function_privilege('service_role', v_fn, 'EXECUTE') THEN
      RAISE EXCEPTION '0810: service_role no puede ejecutar %', v_fn;
    END IF;
  END LOOP;

  -- 12.2 Extensión, columnas generadas, exclusiones y disparadores
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'btree_gist') THEN
    RAISE EXCEPTION '0810: falta la extensión btree_gist';
  END IF;
  IF (SELECT n.nspname FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace WHERE e.extname = 'btree_gist')
     <> 'extensions' THEN
    RAISE WARNING '0810: btree_gist ya estaba instalada fuera del schema extensions';
  END IF;
  FOREACH v_tabla IN ARRAY v_config LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = v_tabla AND column_name = 'clave'
                     AND is_generated = 'ALWAYS') THEN
      RAISE EXCEPTION '0810: public.%.clave debe ser una columna generada', v_tabla;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                   WHERE conrelid = ('public.' || v_tabla)::regclass AND contype = 'x'
                     AND conname = v_tabla || '_sin_superposicion') THEN
      RAISE EXCEPTION '0810: falta la restricción de exclusión %_sin_superposicion', v_tabla;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger
                   WHERE tgrelid = ('public.' || v_tabla)::regclass AND tgname = 'config_inmutable' AND NOT tgisinternal) THEN
      RAISE EXCEPTION '0810: falta el disparador config_inmutable en public.%', v_tabla;
    END IF;
    -- set_by y anulado_por sin ON DELETE (SET NULL chocaría con config_inmutable: el borrado nunca se completaría)
    SELECT count(*) INTO v_n FROM pg_constraint c
    WHERE c.conrelid = ('public.' || v_tabla)::regclass AND c.contype = 'f' AND c.confrelid = 'public.users'::regclass;
    IF v_n <> 2 OR EXISTS (SELECT 1 FROM pg_constraint c
                           WHERE c.conrelid = ('public.' || v_tabla)::regclass AND c.contype = 'f'
                             AND c.confrelid = 'public.users'::regclass AND c.confdeltype <> 'a') THEN
      RAISE EXCEPTION '0810: public.% debe tener set_by y anulado_por hacia users sin ON DELETE (hay % llave(s))', v_tabla, v_n;
    END IF;
    -- anterior_id: llave foránea a la misma tabla (el valor que cortó o reemplazó al registrarse)
    IF NOT EXISTS (SELECT 1 FROM pg_constraint c
                   JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
                   WHERE c.conrelid = ('public.' || v_tabla)::regclass AND c.contype = 'f'
                     AND c.confrelid = ('public.' || v_tabla)::regclass AND a.attname = 'anterior_id')
       OR NOT EXISTS (SELECT 1 FROM information_schema.columns
                      WHERE table_schema = 'public' AND table_name = v_tabla AND column_name = 'anterior_hasta'
                        AND data_type = 'date') THEN
      RAISE EXCEPTION '0810: public.% sin anterior_id (llave a sí misma) o anterior_hasta', v_tabla;
    END IF;
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.calendario'::regclass
                 AND tgname = 'calendario_sin_borrar' AND NOT tgisinternal)
     OR NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.dias_libres'::regclass
                    AND tgname = 'dias_libres_sin_borrar' AND NOT tgisinternal)
     OR NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.dias_libres'::regclass
                    AND tgname = 'update_dias_libres_updated_at' AND NOT tgisinternal) THEN
    RAISE EXCEPTION '0810: faltan disparadores de calendario o dias_libres';
  END IF;
  IF to_regclass('public.calendario_dia_activo_uidx') IS NULL OR to_regclass('public.dias_libres_vigente_uidx') IS NULL THEN
    RAISE EXCEPTION '0810: faltan los índices únicos de calendario o dias_libres';
  END IF;

  -- 12.3 Rol hr: users_role_check con exactamente los 9 roles
  SELECT array_agg(x.r[1]) INTO v_textos
  FROM pg_constraint c
  CROSS JOIN LATERAL regexp_matches(pg_get_constraintdef(c.oid), '''([a-z_]+)''', 'g') AS x(r)
  WHERE c.conrelid = 'public.users'::regclass AND c.conname = 'users_role_check';
  IF v_textos IS NULL OR NOT (v_textos @> v_nueve AND v_textos <@ v_nueve) THEN
    RAISE EXCEPTION '0810: users_role_check debía tener los 9 roles (con hr); tiene %', v_textos;
  END IF;

  -- 12.4 Semillas (filas inmutables: se comprueban aunque después se hayan cerrado o anulado)
  SELECT count(*) INTO v_n FROM public.config_metas
  WHERE scope = 'general' AND kam_id IS NULL AND executive_id IS NULL AND subtipo_id IS NULL AND periodo = 'dia'
    AND vigente_desde = DATE '2026-10-12' AND motivo = v_semilla
    AND ((tipo = 'medica' AND cantidad = 6) OR (tipo = 'institucional' AND cantidad = 1));
  IF v_n <> 2 THEN
    RAISE EXCEPTION '0810: semilla de metas incompleta (hay % de 2)', v_n;
  END IF;
  SELECT count(*) INTO v_n
  FROM public.config_conteo c
  JOIN public.subtipos_institucionales st ON st.id = c.subtipo_id
  JOIN (VALUES ('compras', 'suma_institucional'), ('autorizaciones', 'suma_institucional'),
               ('quimico_farmaceutico', 'seguimiento'), ('programacion', 'seguimiento'),
               ('otro', 'seguimiento')) AS e(codigo, modo)
    ON e.codigo = st.codigo AND e.modo = c.modo
  WHERE c.peso = 1 AND c.vigente_desde = DATE '2026-10-12' AND c.motivo = v_semilla;
  IF v_n <> 5 THEN
    RAISE EXCEPTION '0810: semilla de conteo incompleta (hay % de 5)', v_n;
  END IF;
  SELECT count(*) INTO v_n
  FROM public.config_general g
  JOIN (VALUES
    ('radio_presencial_m',      '500'::jsonb),
    ('plazo_gracia_horas',      '24'::jsonb),
    ('dias_habiles_semana',     '{"1":1,"2":1,"3":1,"4":1,"5":1,"6":0,"7":0}'::jsonb),
    ('tope_visitas_medico_dia', '1'::jsonb),
    ('telefonicas',             '{"tope_dia":1,"peso":1,"medios":["llamada","videollamada"]}'::jsonb),
    ('aprobacion_dias_libres',  '{"requiere":true,"aprueban":["commercial_director","hr"]}'::jsonb),
    ('motivos_dia_libre',       '[{"codigo":"vacaciones","nombre":"Vacaciones"},{"codigo":"incapacidad","nombre":"Incapacidad"},{"codigo":"cita_medica","nombre":"Cita médica"},{"codigo":"capacitacion","nombre":"Capacitación"},{"codigo":"congreso","nombre":"Congreso"},{"codigo":"acompanamiento_cirugia","nombre":"Acompañamiento de cirugía"},{"codigo":"administrativo","nombre":"Administrativo"},{"codigo":"otro","nombre":"Otro"}]'::jsonb),
    ('primer_mes_factor',       '0.5'::jsonb),
    ('alertas_mezcla',          '{}'::jsonb)) AS e(parametro, valor)
    ON e.parametro = g.parametro AND e.valor = g.valor
  WHERE g.vigente_desde = DATE '2026-10-12' AND g.motivo = v_semilla;
  IF v_n <> 9 THEN
    RAISE EXCEPTION '0810: semilla de parámetros generales incompleta o con valores distintos (hay % de 9)', v_n;
  END IF;

  -- 12.5 Festivos: la función contra la lista literal del contrato; lo guardado en calendario
  SELECT array_agg(f.fecha ORDER BY f.fecha), count(*) INTO v_fechas, v_n FROM public.calendario_festivos_colombia(2026) f;
  IF v_n <> 18 OR v_fechas IS DISTINCT FROM v_fest_2026 THEN
    RAISE EXCEPTION '0810: festivos 2026 distintos a los del contrato: %', v_fechas;
  END IF;
  SELECT array_agg(f.fecha ORDER BY f.fecha), count(*) INTO v_fechas, v_n FROM public.calendario_festivos_colombia(2027) f;
  IF v_n <> 18 OR v_fechas IS DISTINCT FROM v_fest_2027 THEN
    RAISE EXCEPTION '0810: festivos 2027 distintos a los del contrato: %', v_fechas;
  END IF;
  FOREACH v_n IN ARRAY ARRAY[2026, 2027] LOOP
    SELECT array_agg(f.nombre ORDER BY f.nombre) INTO v_textos FROM public.calendario_festivos_colombia(v_n::int) f;
    IF v_textos IS DISTINCT FROM (SELECT array_agg(x ORDER BY x) FROM unnest(v_nombres) AS x) THEN
      RAISE EXCEPTION '0810: nombres de los festivos % distintos a los del contrato: %', v_n, v_textos;
    END IF;
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM public.calendario_festivos_colombia(2026) f WHERE f.fecha = DATE '2026-11-02')
     OR EXISTS (SELECT 1 FROM public.calendario_festivos_colombia(2026) f WHERE f.fecha = DATE '2026-07-13') THEN
    RAISE EXCEPTION '0810: el 2 de noviembre de 2026 debe ser festivo y el 13 de julio no';
  END IF;
  -- Año con dos festivos el mismo lunes (2038-07-05: San Pedro trasladado y Sagrado Corazón): 18 filas.
  SELECT count(*) INTO v_n FROM public.calendario_festivos_colombia(2038) f WHERE f.fecha = DATE '2038-07-05';
  IF v_n <> 2 THEN
    RAISE EXCEPTION '0810: en 2038 San Pedro y San Pablo y el Sagrado Corazón caen el 5 de julio (hay % fila(s))', v_n;
  END IF;

  SELECT count(*) INTO v_n
  FROM unnest(v_fest_2026 || v_fest_2027) AS e(f)
  WHERE NOT EXISTS (SELECT 1 FROM public.calendario c WHERE c.fecha = e.f AND c.alcance = 'nacional');
  IF v_n > 0 THEN
    RAISE EXCEPTION '0810: faltan % festivo(s) de 2026-2027 en calendario', v_n;
  END IF;
  SELECT array_agg(c.fecha ORDER BY c.fecha) INTO v_fechas
  FROM public.calendario c
  WHERE c.alcance = 'nacional' AND c.anulado_at IS NULL AND c.fecha BETWEEN DATE '2026-01-01' AND DATE '2027-12-31';
  IF v_fechas IS DISTINCT FROM v_fest_2026 || v_fest_2027 THEN
    RAISE WARNING '0810: los festivos nacionales activos de 2026-2027 en calendario no son exactamente los calculados (¿corregidos por recursos humanos?): %', v_fechas;
  END IF;
  -- Los festivos que insertó esta ejecución llevan el nombre de la función.
  IF EXISTS (SELECT 1 FROM public.calendario c
             WHERE c.alcance = 'nacional' AND c.origen = 'calculado' AND c.created_at = now()
               AND c.fecha BETWEEN DATE '2026-01-01' AND DATE '2027-12-31'
               AND c.nombre IS DISTINCT FROM (SELECT string_agg(f.nombre, ' y ' ORDER BY f.nombre)
                                              FROM public.calendario_festivos_colombia(extract(year FROM c.fecha)::int) f
                                              WHERE f.fecha = c.fecha)) THEN
    RAISE EXCEPTION '0810: hay festivos calculados de 2026-2027 con un nombre distinto al de la función';
  END IF;

  -- 12.6 config_registrar, config_cerrar, config_inmutable, exclusión y CHECK de las tablas config_* (todo se deshace)
  SELECT e.id INTO v_exec FROM public.executives e ORDER BY (e.status = 'active') DESC, e.id LIMIT 1;
  SELECT st.id INTO v_sub_prog FROM public.subtipos_institucionales st WHERE st.codigo = 'programacion';
  SELECT st.id INTO v_sub      FROM public.subtipos_institucionales st WHERE st.codigo = 'compras';
  IF v_exec IS NULL THEN
    RAISE WARNING '0810: no hay ejecutivas; no se probaron config_registrar, config_cerrar ni dias_libres';
  ELSE
    BEGIN
      -- a) Valor abierto
      v_id1 := public.config_registrar('config_personas',
                 jsonb_build_object('executive_id', v_exec, 'perfil', jsonb_build_array('medica'), 'radio_m', 600),
                 v_d, NULL, NULL, NULL);
      SELECT p.vigente_desde, p.vigente_hasta, p.radio_m, p.perfil INTO v_desde, v_hasta, v_radio, v_perfil
      FROM public.config_personas p WHERE p.id = v_id1;
      IF v_desde IS DISTINCT FROM v_d OR v_hasta IS NOT NULL OR v_radio IS DISTINCT FROM 600
         OR v_perfil IS DISTINCT FROM ARRAY['medica']::text[] THEN
        RAISE EXCEPTION '0810: config_registrar no guardó el valor abierto (% a %, radio %, perfil %)',
          v_desde, v_hasta, v_radio, v_perfil;
      END IF;

      -- b) Valor temporal: corta el anterior y crea su continuación con los mismos valores
      v_id2 := public.config_registrar('config_personas', jsonb_build_object('executive_id', v_exec, 'radio_m', 800),
                 v_d + 10, v_d + 19, NULL, NULL);
      IF (SELECT p.vigente_hasta FROM public.config_personas p WHERE p.id = v_id1) IS DISTINCT FROM v_d + 9 THEN
        RAISE EXCEPTION '0810: el valor temporal no cortó el anterior al día previo';
      END IF;
      SELECT p.vigente_desde, p.vigente_hasta, p.perfil, p.anterior_id INTO v_desde, v_hasta, v_perfil, v_id
      FROM public.config_personas p WHERE p.id = v_id2;
      IF v_desde IS DISTINCT FROM v_d + 10 OR v_hasta IS DISTINCT FROM v_d + 19
         OR v_perfil IS DISTINCT FROM ARRAY['medica', 'institucional']::text[]
         OR v_id IS DISTINCT FROM v_id1
         OR (SELECT p.anterior_hasta FROM public.config_personas p WHERE p.id = v_id2) IS NOT NULL THEN
        RAISE EXCEPTION '0810: el valor temporal no quedó [desde, hasta] con el perfil por defecto (% a %, %)',
          v_desde, v_hasta, v_perfil;
      END IF;
      SELECT p.id, p.vigente_hasta, p.radio_m, p.perfil, p.motivo INTO v_idc, v_hasta, v_radio, v_perfil, v_texto
      FROM public.config_personas p
      WHERE p.executive_id = v_exec AND p.anulado_at IS NULL AND p.vigente_desde = v_d + 20;
      IF v_idc IS NULL OR v_hasta IS NOT NULL OR v_radio IS DISTINCT FROM 600
         OR v_perfil IS DISTINCT FROM ARRAY['medica']::text[]
         OR v_texto IS DISTINCT FROM 'Continúa después de un valor temporal' THEN
        RAISE EXCEPTION '0810: falta o no cuadra la continuación después del valor temporal (id %, hasta %, radio %, perfil %, motivo %)',
          v_idc, v_hasta, v_radio, v_perfil, v_texto;
      END IF;
      SELECT count(*) INTO v_n FROM public.config_personas p
      WHERE p.executive_id = v_exec AND p.anulado_at IS NULL AND p.vigente_desde >= v_d;
      IF v_n <> 3 THEN
        RAISE EXCEPTION '0810: tras el valor temporal debía haber 3 filas activas (hay %)', v_n;
      END IF;

      -- c) Mismo día de inicio: anula el anterior; sin "hasta" rige hasta el día antes del siguiente valor
      v_id3 := public.config_registrar('config_personas', jsonb_build_object('executive_id', v_exec, 'radio_m', 900),
                 v_d + 10, NULL, NULL, NULL);
      SELECT p.anulado_at, p.anulado_motivo INTO v_anulado, v_texto FROM public.config_personas p WHERE p.id = v_id2;
      IF v_anulado IS NULL OR v_texto IS DISTINCT FROM 'Reemplazado por un valor nuevo con la misma fecha de inicio' THEN
        RAISE EXCEPTION '0810: el valor que empezaba el mismo día no quedó anulado (motivo %)', v_texto;
      END IF;
      IF (SELECT p.vigente_hasta FROM public.config_personas p WHERE p.id = v_id3) IS DISTINCT FROM v_d + 19 THEN
        RAISE EXCEPTION '0810: sin "hasta", el valor debía regir hasta el día antes del siguiente valor';
      END IF;
      IF (SELECT p.anterior_id FROM public.config_personas p WHERE p.id = v_id3) IS DISTINCT FROM v_id2
         OR (SELECT p.anterior_hasta FROM public.config_personas p WHERE p.id = v_id3) IS DISTINCT FROM v_d + 19 THEN
        RAISE EXCEPTION '0810: el valor que reemplazó a otro el mismo día no guardó cuál (anterior_id, anterior_hasta)';
      END IF;
      SELECT count(*) INTO v_n FROM public.config_personas p
      WHERE p.executive_id = v_exec AND p.anulado_at IS NULL AND p.vigente_desde >= v_d;
      IF v_n <> 3 THEN
        RAISE EXCEPTION '0810: tras el cambio del mismo día debía haber 3 filas activas (hay %)', v_n;
      END IF;

      -- d) Rango que se superpone con un valor futuro: 23P01 con la fecha, sin dejar cambios
      BEGIN
        PERFORM public.config_registrar('config_personas', jsonb_build_object('executive_id', v_exec, 'radio_m', 700),
                  v_d + 5, v_d + 25, NULL, NULL);
        RAISE EXCEPTION '0810: config_registrar aceptó un rango que se superpone con un valor futuro';
      EXCEPTION WHEN exclusion_violation THEN
        GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
        IF v_msg IS DISTINCT FROM 'El rango se superpone con un valor que empieza el ' || to_char(v_d + 10, 'YYYY-MM-DD') THEN
          RAISE EXCEPTION '0810: mensaje de superposición inesperado: %', v_msg;
        END IF;
      END;
      IF (SELECT p.vigente_hasta FROM public.config_personas p WHERE p.id = v_id1) IS DISTINCT FROM v_d + 9 THEN
        RAISE EXCEPTION '0810: el cambio rechazado por superposición dejó cambios';
      END IF;

      -- e) Pasado: sin motivo (o con menos de 5 caracteres) se rechaza; con motivo, sí
      BEGIN
        PERFORM public.config_registrar('config_personas', jsonb_build_object('executive_id', v_exec, 'radio_m', 700),
                  v_hoy - 1, v_hoy - 1, NULL, NULL);
        RAISE EXCEPTION '0810: config_registrar aceptó cambiar el pasado sin motivo';
      EXCEPTION WHEN check_violation THEN
        GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
        IF v_msg IS DISTINCT FROM 'Para cambiar el pasado hace falta un motivo' THEN
          RAISE EXCEPTION '0810: mensaje inesperado al cambiar el pasado sin motivo: %', v_msg;
        END IF;
      END;
      BEGIN
        PERFORM public.config_registrar('config_personas', jsonb_build_object('executive_id', v_exec, 'radio_m', 700),
                  v_hoy - 1, v_hoy - 1, '  abc  ', NULL);
        RAISE EXCEPTION '0810: config_registrar aceptó cambiar el pasado con un motivo de 3 caracteres';
      EXCEPTION WHEN check_violation THEN NULL;
      END;
      v_id := public.config_registrar('config_personas', jsonb_build_object('executive_id', v_exec, 'radio_m', 700),
                v_hoy - 1, v_hoy - 1, 'Corrección de prueba 0810', NULL);
      IF (SELECT p.motivo FROM public.config_personas p WHERE p.id = v_id) IS DISTINCT FROM 'Corrección de prueba 0810' THEN
        RAISE EXCEPTION '0810: la corrección del pasado no guardó su motivo';
      END IF;

      -- f) hasta < desde; tabla no válida
      BEGIN
        PERFORM public.config_registrar('config_personas', jsonb_build_object('executive_id', v_exec, 'radio_m', 700),
                  v_d + 50, v_d + 49, NULL, NULL);
        RAISE EXCEPTION '0810: config_registrar aceptó "hasta" antes de "desde"';
      EXCEPTION WHEN check_violation THEN NULL;
      END;
      BEGIN
        PERFORM public.config_registrar('users', '{}'::jsonb, v_d, NULL, NULL, NULL);
        RAISE EXCEPTION '0810: config_registrar aceptó una tabla que no es de configuración';
      EXCEPTION WHEN invalid_parameter_value THEN NULL;
      END;

      -- g) config_metas por ejecutiva: clave, y cambio de periodo (misma clave) que corta el anterior
      v_idm := public.config_registrar('config_metas',
                 jsonb_build_object('scope', 'ejecutiva', 'executive_id', v_exec, 'tipo', 'medica', 'periodo', 'dia',
                                    'cantidad', 4),
                 v_d, NULL, NULL, NULL);
      IF (SELECT m.clave FROM public.config_metas m WHERE m.id = v_idm)
         IS DISTINCT FROM 'ejecutiva:' || v_exec::text || ':medica:-' THEN
        RAISE EXCEPTION '0810: clave de config_metas inesperada';
      END IF;
      v_id := public.config_registrar('config_metas',
                jsonb_build_object('scope', 'ejecutiva', 'executive_id', upper(v_exec::text), 'tipo', 'medica',
                                   'periodo', 'semana', 'cantidad', 20),
                v_d + 7, NULL, NULL, NULL);
      IF (SELECT m.vigente_hasta FROM public.config_metas m WHERE m.id = v_idm) IS DISTINCT FROM v_d + 6 THEN
        RAISE EXCEPTION '0810: la meta semanal no cortó la diaria de la misma clave (uuid en mayúsculas)';
      END IF;
      SELECT m.periodo, m.cantidad INTO v_periodo, v_cant FROM public.config_metas m WHERE m.id = v_id;
      IF v_periodo IS DISTINCT FROM 'semana' OR v_cant IS DISTINCT FROM 20::numeric THEN
        RAISE EXCEPTION '0810: la meta semanal no quedó como se registró (%, %)', v_periodo, v_cant;
      END IF;
      BEGIN
        PERFORM public.config_registrar('config_metas',
                  jsonb_build_object('scope', 'general', 'executive_id', v_exec, 'tipo', 'institucional',
                                     'periodo', 'dia', 'cantidad', 1),
                  v_d, NULL, NULL, NULL);
        RAISE EXCEPTION '0810: se aceptó una meta general con ejecutiva';
      EXCEPTION WHEN check_violation THEN NULL;
      END;

      -- h) config_conteo y config_general sobre la semilla: corte y continuación con los valores (jsonb) de antes
      IF v_sub_prog IS NOT NULL THEN
        v_id := public.config_registrar('config_conteo',
                  jsonb_build_object('subtipo_id', v_sub_prog, 'modo', 'meta_propia', 'peso', 0.5), v_d, NULL, NULL, NULL);
        SELECT c.modo, c.peso INTO v_texto, v_cant FROM public.config_conteo c WHERE c.id = v_id;
        IF v_texto IS DISTINCT FROM 'meta_propia' OR v_cant IS DISTINCT FROM 0.5 THEN
          RAISE EXCEPTION '0810: config_conteo no quedó como se registró (%, %)', v_texto, v_cant;
        END IF;
        IF EXISTS (SELECT 1 FROM public.config_conteo c
                   WHERE c.subtipo_id = v_sub_prog AND c.anulado_at IS NULL AND c.id <> v_id
                     AND c.vigente_desde < v_d AND (c.vigente_hasta IS NULL OR c.vigente_hasta >= v_d)) THEN
          RAISE EXCEPTION '0810: el conteo anterior de programación no quedó cortado';
        END IF;
      END IF;
      SELECT g.valor INTO v_valor
      FROM public.config_general g
      WHERE g.parametro = 'plazo_gracia_horas' AND g.anulado_at IS NULL
        AND g.vigente_desde <= v_d AND (g.vigente_hasta IS NULL OR g.vigente_hasta >= v_d);
      v_id := public.config_registrar('config_general',
                jsonb_build_object('parametro', 'plazo_gracia_horas', 'valor', 48), v_d, v_d + 30, NULL, NULL);
      IF v_valor IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM public.config_general g
                         WHERE g.parametro = 'plazo_gracia_horas' AND g.anulado_at IS NULL AND g.vigente_desde = v_d + 31
                           AND g.valor = v_valor AND g.motivo = 'Continúa después de un valor temporal') THEN
        RAISE EXCEPTION '0810: el plazo de gracia temporal no dejó la continuación con el valor anterior (%)', v_valor;
      END IF;
      IF (SELECT g.valor FROM public.config_general g WHERE g.id = v_id) IS DISTINCT FROM '48'::jsonb THEN
        RAISE EXCEPTION '0810: config_general no guardó el valor jsonb registrado';
      END IF;

      -- i) config_cerrar
      PERFORM public.config_cerrar('config_personas', v_idc, v_d + 30, NULL, NULL);
      IF (SELECT p.vigente_hasta FROM public.config_personas p WHERE p.id = v_idc) IS DISTINCT FROM v_d + 30 THEN
        RAISE EXCEPTION '0810: config_cerrar no cerró el valor abierto';
      END IF;
      PERFORM public.config_cerrar('config_personas', v_idc, v_d + 40, NULL, NULL);  -- ya termina antes: no cambia
      IF (SELECT p.vigente_hasta FROM public.config_personas p WHERE p.id = v_idc) IS DISTINCT FROM v_d + 30 THEN
        RAISE EXCEPTION '0810: config_cerrar alargó un valor que ya terminaba antes';
      END IF;
      PERFORM public.config_cerrar('config_personas', v_id3, v_d + 5, 'Cerrado antes de empezar (prueba)', NULL);
      SELECT p.anulado_at INTO v_anulado FROM public.config_personas p WHERE p.id = v_id3;
      IF v_anulado IS NULL THEN
        RAISE EXCEPTION '0810: config_cerrar con "hasta" antes del inicio debía anular el valor';
      END IF;
      -- v_id3 había reemplazado a v_id2 el mismo día: al cancelarlo vuelven los valores de v_id2 (copia)
      SELECT count(*) INTO v_n FROM public.config_personas p
      WHERE p.executive_id = v_exec AND p.anulado_at IS NULL AND p.vigente_desde = v_d + 10 AND p.vigente_hasta = v_d + 19
        AND p.radio_m = 800 AND p.motivo = 'Vuelve a regir el valor anterior' AND p.anterior_id IS NULL;
      IF v_n <> 1 THEN
        RAISE EXCEPTION '0810: al cancelar el valor que reemplazó a otro el mismo día no volvió el reemplazado (hay % copia(s))', v_n;
      END IF;
      BEGIN
        PERFORM public.config_cerrar('config_personas', v_id3, v_d + 15, NULL, NULL);
        RAISE EXCEPTION '0810: config_cerrar aceptó una fila anulada';
      EXCEPTION WHEN no_data_found THEN NULL;
      END;
      BEGIN
        PERFORM public.config_cerrar('config_personas', gen_random_uuid(), v_d, NULL, NULL);
        RAISE EXCEPTION '0810: config_cerrar aceptó una fila inexistente';
      EXCEPTION WHEN no_data_found THEN NULL;
      END;
      BEGIN
        PERFORM public.config_cerrar('config_personas', v_id1, v_hoy - 1, NULL, NULL);
        RAISE EXCEPTION '0810: config_cerrar aceptó anular en el pasado sin motivo';
      EXCEPTION WHEN check_violation THEN NULL;
      END;
      BEGIN
        PERFORM public.config_cerrar('calendario', v_id1, v_d, NULL, NULL);
        RAISE EXCEPTION '0810: config_cerrar aceptó una tabla que no es de configuración';
      EXCEPTION WHEN invalid_parameter_value THEN NULL;
      END;

      -- j) config_inmutable
      BEGIN
        UPDATE public.config_metas SET cantidad = cantidad + 1 WHERE id = v_idm;
        RAISE EXCEPTION '0810: config_inmutable dejó cambiar la cantidad de una meta';
      EXCEPTION WHEN check_violation THEN NULL;
      END;
      BEGIN
        DELETE FROM public.config_metas WHERE id = v_idm;
        RAISE EXCEPTION '0810: config_inmutable dejó borrar una meta';
      EXCEPTION WHEN check_violation THEN NULL;
      END;
      BEGIN
        UPDATE public.config_personas SET vigente_hasta = v_d + 60 WHERE id = v_id2;
        RAISE EXCEPTION '0810: config_inmutable dejó modificar una fila anulada';
      EXCEPTION WHEN check_violation THEN NULL;
      END;
      BEGIN
        UPDATE public.config_general SET valor = '600'::jsonb
        WHERE parametro = 'radio_presencial_m' AND vigente_desde = DATE '2026-10-12' AND motivo = v_semilla;
        RAISE EXCEPTION '0810: config_inmutable dejó cambiar el valor de la semilla';
      EXCEPTION WHEN check_violation THEN NULL;
      END;
      UPDATE public.config_personas SET vigente_hasta = v_d + 35 WHERE id = v_idc;  -- cerrar/mover el fin: permitido

      -- k) Exclusión directa (sin pasar por config_registrar): 23P01; una fila anulada no cuenta.
      --    Re-ejecución con datos reales: si v_exec ya tiene una excepción institucional (aquí se crea una abierta
      --    para probarlo), se anulan sus filas activas dentro de esta prueba (se deshace) para que no estorben.
      PERFORM public.config_registrar('config_metas',
                jsonb_build_object('scope', 'ejecutiva', 'executive_id', v_exec, 'tipo', 'institucional', 'periodo', 'dia',
                                   'cantidad', 2),
                v_d + 50, NULL, NULL, NULL);
      UPDATE public.config_metas SET anulado_at = now(), anulado_motivo = 'Prueba 0810: deja libre la clave'
      WHERE clave = 'ejecutiva:' || v_exec::text || ':institucional:-' AND anulado_at IS NULL;
      INSERT INTO public.config_metas (scope, executive_id, tipo, periodo, cantidad, vigente_desde, vigente_hasta)
      VALUES ('ejecutiva', v_exec, 'institucional', 'dia', 2, v_d + 100, v_d + 120);
      BEGIN
        INSERT INTO public.config_metas (scope, executive_id, tipo, periodo, cantidad, vigente_desde)
        VALUES ('ejecutiva', v_exec, 'institucional', 'dia', 3, v_d + 110);
        RAISE EXCEPTION '0810: se aceptaron dos rangos superpuestos de la misma clave';
      EXCEPTION WHEN exclusion_violation THEN NULL;
      END;
      INSERT INTO public.config_metas (scope, executive_id, tipo, periodo, cantidad, vigente_desde)
      VALUES ('ejecutiva', v_exec, 'institucional', 'dia', 3, v_d + 121);  -- contiguo: sí
      INSERT INTO public.config_metas (scope, executive_id, tipo, periodo, cantidad, vigente_desde, vigente_hasta,
                                       anulado_at, anulado_motivo)
      VALUES ('ejecutiva', v_exec, 'institucional', 'dia', 5, v_d + 105, v_d + 106, now(), 'Prueba 0810');  -- anulada: sí

      -- l) CHECK de las tablas de configuración
      FOREACH v_sql IN ARRAY ARRAY[
        format('INSERT INTO public.config_metas (scope, executive_id, tipo, periodo, cantidad, vigente_desde) VALUES (''ejecutiva'', %L, ''medica'', ''dia'', 101, %L)', v_exec, v_d + 200),
        format('INSERT INTO public.config_metas (scope, executive_id, tipo, periodo, cantidad, vigente_desde) VALUES (''ejecutiva'', %L, ''medica'', ''dia'', -1, %L)', v_exec, v_d + 200),
        format('INSERT INTO public.config_metas (scope, executive_id, tipo, subtipo_id, periodo, cantidad, vigente_desde) VALUES (''ejecutiva'', %L, ''medica'', %L, ''dia'', 1, %L)', v_exec, v_sub, v_d + 200),
        format('INSERT INTO public.config_metas (scope, executive_id, tipo, periodo, cantidad, vigente_desde) VALUES (''ejecutiva'', %L, ''medica'', ''mes'', 1, %L)', v_exec, v_d + 200),
        format('INSERT INTO public.config_metas (scope, executive_id, tipo, periodo, cantidad, vigente_desde) VALUES (''zona'', %L, ''medica'', ''dia'', 1, %L)', v_exec, v_d + 200),
        format('INSERT INTO public.config_metas (scope, executive_id, tipo, periodo, cantidad, vigente_desde) VALUES (''ejecutiva'', %L, ''otra'', ''dia'', 1, %L)', v_exec, v_d + 200),
        format('INSERT INTO public.config_metas (scope, executive_id, tipo, periodo, cantidad, vigente_desde, vigente_hasta) VALUES (''ejecutiva'', %L, ''medica'', ''dia'', 1, %L, %L)', v_exec, v_d + 300, v_d + 299),
        format('INSERT INTO public.config_metas (scope, executive_id, tipo, periodo, cantidad, vigente_desde, anulado_motivo) VALUES (''ejecutiva'', %L, ''medica'', ''dia'', 1, %L, ''sin anular'')', v_exec, v_d + 200),
        format('INSERT INTO public.config_conteo (subtipo_id, modo, peso, vigente_desde) VALUES (%L, ''seguimiento'', 0, %L)', v_sub, v_d + 200),
        format('INSERT INTO public.config_conteo (subtipo_id, modo, peso, vigente_desde) VALUES (%L, ''seguimiento'', 11, %L)', v_sub, v_d + 200),
        format('INSERT INTO public.config_conteo (subtipo_id, modo, peso, vigente_desde) VALUES (%L, ''cuenta_doble'', 1, %L)', v_sub, v_d + 200),
        format('INSERT INTO public.config_general (parametro, valor, vigente_desde) VALUES (''parametro_raro'', ''1'', %L)', v_d + 200),
        format('INSERT INTO public.config_general (parametro, valor, vigente_desde) VALUES (''radio_presencial_m'', ''"500"'', %L)', v_d + 200),
        format('INSERT INTO public.config_general (parametro, valor, vigente_desde) VALUES (''radio_presencial_m'', ''10'', %L)', v_d + 200),
        format('INSERT INTO public.config_general (parametro, valor, vigente_desde) VALUES (''plazo_gracia_horas'', ''721'', %L)', v_d + 200),
        format('INSERT INTO public.config_general (parametro, valor, vigente_desde) VALUES (''tope_visitas_medico_dia'', ''0'', %L)', v_d + 200),
        format('INSERT INTO public.config_general (parametro, valor, vigente_desde) VALUES (''primer_mes_factor'', ''1.5'', %L)', v_d + 200),
        format('INSERT INTO public.config_general (parametro, valor, vigente_desde) VALUES (''dias_habiles_semana'', ''[]'', %L)', v_d + 200),
        format('INSERT INTO public.config_general (parametro, valor, vigente_desde) VALUES (''dias_habiles_semana'', ''{"1":1}'', %L)', v_d + 200),
        format('INSERT INTO public.config_general (parametro, valor, vigente_desde) VALUES (''motivos_dia_libre'', ''[]'', %L)', v_d + 200),
        format('INSERT INTO public.config_general (parametro, valor, vigente_desde) VALUES (''telefonicas'', ''1'', %L)', v_d + 200),
        format('INSERT INTO public.config_general (parametro, valor, vigente_desde) VALUES (''aprobacion_dias_libres'', ''true'', %L)', v_d + 200),
        format('INSERT INTO public.config_personas (executive_id, perfil, vigente_desde) VALUES (%L, ''{}'', %L)', v_exec, v_d + 200),
        format('INSERT INTO public.config_personas (executive_id, perfil, vigente_desde) VALUES (%L, ''{medica,otro}'', %L)', v_exec, v_d + 200),
        format('INSERT INTO public.config_personas (executive_id, radio_m, vigente_desde) VALUES (%L, 10, %L)', v_exec, v_d + 200),
        format('INSERT INTO public.config_personas (executive_id, tope_telefonicas_dia, vigente_desde) VALUES (%L, 21, %L)', v_exec, v_d + 200)]
      LOOP
        BEGIN
          EXECUTE v_sql;
          RAISE EXCEPTION '0810: se aceptó una fila que viola un CHECK: %', v_sql;
        EXCEPTION WHEN check_violation THEN NULL;
        END;
      END LOOP;

      -- m) Cancelar o acortar un valor devuelve el que había antes (decisión 12). Dos claves de prueba (metas por
      --    persona de Compras y de Programación); sus filas activas reales, si las hubiera, se anulan aquí (se deshace).
      v_k1 := 'ejecutiva:' || v_exec::text || ':institucional:' || v_sub::text;
      v_k2 := 'ejecutiva:' || v_exec::text || ':institucional:' || coalesce(v_sub_prog, v_sub)::text;
      UPDATE public.config_metas SET anulado_at = now(), anulado_motivo = 'Prueba 0810: deja libre la clave'
      WHERE clave IN (v_k1, v_k2) AND anulado_at IS NULL;
      -- m1) A abierto; R programado después lo corta; cancelar R → A vuelve a quedar abierto (se alarga)
      v_ma := public.config_registrar('config_metas',
                jsonb_build_object('scope', 'ejecutiva', 'executive_id', v_exec, 'tipo', 'institucional', 'subtipo_id', v_sub,
                                   'periodo', 'dia', 'cantidad', 2), v_d + 400, NULL, NULL, NULL);
      v_mr := public.config_registrar('config_metas',
                jsonb_build_object('scope', 'ejecutiva', 'executive_id', v_exec, 'tipo', 'institucional', 'subtipo_id', v_sub,
                                   'periodo', 'dia', 'cantidad', 3), v_d + 410, NULL, NULL, NULL);
      IF (SELECT m.vigente_hasta FROM public.config_metas m WHERE m.id = v_ma) IS DISTINCT FROM v_d + 409
         OR (SELECT m.anterior_id FROM public.config_metas m WHERE m.id = v_mr) IS DISTINCT FROM v_ma
         OR (SELECT m.anterior_hasta FROM public.config_metas m WHERE m.id = v_mr) IS NOT NULL THEN
        RAISE EXCEPTION '0810: el valor programado no cortó el anterior o no guardó cuál cortó (anterior_id, anterior_hasta)';
      END IF;
      PERFORM public.config_cerrar('config_metas', v_mr, v_d + 405, NULL, NULL);
      IF (SELECT m.anulado_at FROM public.config_metas m WHERE m.id = v_mr) IS NULL
         OR (SELECT m.vigente_hasta FROM public.config_metas m WHERE m.id = v_ma) IS NOT NULL THEN
        RAISE EXCEPTION '0810: cancelar un valor programado no devolvió el anterior (sigue cortado: queda un hueco)';
      END IF;
      -- m2) Acortar: R2 desde +410 abierto, se acorta al +415 → desde el +416 vuelve A (copia, abierta)
      v_mr := public.config_registrar('config_metas',
                jsonb_build_object('scope', 'ejecutiva', 'executive_id', v_exec, 'tipo', 'institucional', 'subtipo_id', v_sub,
                                   'periodo', 'dia', 'cantidad', 4), v_d + 410, NULL, NULL, NULL);
      PERFORM public.config_cerrar('config_metas', v_mr, v_d + 415, NULL, NULL);
      SELECT count(*) INTO v_n FROM public.config_metas m
      WHERE m.clave = v_k1 AND m.anulado_at IS NULL AND m.vigente_desde = v_d + 416 AND m.vigente_hasta IS NULL
        AND m.cantidad = 2 AND m.motivo = 'Vuelve a regir el valor anterior' AND m.anterior_id IS NULL;
      IF v_n <> 1 OR (SELECT m.vigente_hasta FROM public.config_metas m WHERE m.id = v_mr) IS DISTINCT FROM v_d + 415 THEN
        RAISE EXCEPTION '0810: acortar un valor no devolvió el anterior después (copias: %)', v_n;
      END IF;
      -- m3) Mismo día: X desde +430 y Y desde +430 (anula X); cancelar Y → vuelven los valores de X (copia)
      v_mx := public.config_registrar('config_metas',
                jsonb_build_object('scope', 'ejecutiva', 'executive_id', v_exec, 'tipo', 'institucional', 'subtipo_id', v_sub,
                                   'periodo', 'dia', 'cantidad', 5), v_d + 430, NULL, NULL, NULL);
      v_my := public.config_registrar('config_metas',
                jsonb_build_object('scope', 'ejecutiva', 'executive_id', v_exec, 'tipo', 'institucional', 'subtipo_id', v_sub,
                                   'periodo', 'dia', 'cantidad', 6), v_d + 430, NULL, NULL, NULL);
      PERFORM public.config_cerrar('config_metas', v_my, v_d + 420, NULL, NULL);
      SELECT count(*) INTO v_n FROM public.config_metas m
      WHERE m.clave = v_k1 AND m.anulado_at IS NULL AND m.vigente_desde = v_d + 430 AND m.vigente_hasta IS NULL
        AND m.cantidad = 5 AND m.motivo = 'Vuelve a regir el valor anterior';
      IF v_n <> 1 THEN
        RAISE EXCEPTION '0810: cancelar el valor que reemplazó a otro el mismo día no devolvió el reemplazado (copias: %)', v_n;
      END IF;
      -- m4) Un valor registrado en un hueco (no cortó nada) no revive al que terminaba antes: T temporal y S después
      v_mp := public.config_registrar('config_metas',
                jsonb_build_object('scope', 'ejecutiva', 'executive_id', v_exec, 'tipo', 'institucional',
                                   'subtipo_id', coalesce(v_sub_prog, v_sub), 'periodo', 'dia', 'cantidad', 2),
                v_d + 500, v_d + 509, NULL, NULL);
      v_md := public.config_registrar('config_metas',
                jsonb_build_object('scope', 'ejecutiva', 'executive_id', v_exec, 'tipo', 'institucional',
                                   'subtipo_id', coalesce(v_sub_prog, v_sub), 'periodo', 'dia', 'cantidad', 3),
                v_d + 510, NULL, NULL, NULL);
      PERFORM public.config_cerrar('config_metas', v_md, v_d + 505, NULL, NULL);
      IF (SELECT m.anterior_id FROM public.config_metas m WHERE m.id = v_md) IS NOT NULL
         OR (SELECT m.vigente_hasta FROM public.config_metas m WHERE m.id = v_mp) IS DISTINCT FROM v_d + 509
         OR EXISTS (SELECT 1 FROM public.config_metas m
                    WHERE m.clave = v_k2 AND m.anulado_at IS NULL AND m.vigente_desde > v_d + 509) THEN
        RAISE EXCEPTION '0810: cancelar un valor registrado en un hueco alargó o copió el que terminaba antes';
      END IF;
      -- m5) En cadena: P abierto, D desde +530, R desde +540; cancelar D (P hasta +539) y luego R → P sin fin
      v_mp := public.config_registrar('config_metas',
                jsonb_build_object('scope', 'ejecutiva', 'executive_id', v_exec, 'tipo', 'institucional',
                                   'subtipo_id', coalesce(v_sub_prog, v_sub), 'periodo', 'dia', 'cantidad', 7),
                v_d + 520, NULL, NULL, NULL);
      v_md := public.config_registrar('config_metas',
                jsonb_build_object('scope', 'ejecutiva', 'executive_id', v_exec, 'tipo', 'institucional',
                                   'subtipo_id', coalesce(v_sub_prog, v_sub), 'periodo', 'dia', 'cantidad', 8),
                v_d + 530, NULL, NULL, NULL);
      v_mr := public.config_registrar('config_metas',
                jsonb_build_object('scope', 'ejecutiva', 'executive_id', v_exec, 'tipo', 'institucional',
                                   'subtipo_id', coalesce(v_sub_prog, v_sub), 'periodo', 'dia', 'cantidad', 9),
                v_d + 540, NULL, NULL, NULL);
      PERFORM public.config_cerrar('config_metas', v_md, v_d + 525, NULL, NULL);
      IF (SELECT m.vigente_hasta FROM public.config_metas m WHERE m.id = v_mp) IS DISTINCT FROM v_d + 539 THEN
        RAISE EXCEPTION '0810: cancelar D no alargó P hasta el día antes de R';
      END IF;
      PERFORM public.config_cerrar('config_metas', v_mr, v_d + 535, NULL, NULL);
      IF (SELECT m.vigente_hasta FROM public.config_metas m WHERE m.id = v_mp) IS NOT NULL THEN
        RAISE EXCEPTION '0810: cancelar R después de D no devolvió P sin fin';
      END IF;

      RAISE SQLSTATE 'P0810';
    EXCEPTION
      WHEN SQLSTATE 'P0810' THEN NULL;  -- filas de prueba deshechas
    END;

    -- Filas creadas en esta transacción (created_at = now()) con fechas de prueba, o la corrección de prueba.
    IF EXISTS (SELECT 1 FROM public.config_personas p WHERE p.created_at = now() AND p.vigente_desde >= v_d)
       OR EXISTS (SELECT 1 FROM public.config_metas m WHERE m.created_at = now() AND m.vigente_desde >= v_d)
       OR EXISTS (SELECT 1 FROM public.config_general g WHERE g.created_at = now() AND g.vigente_desde >= v_d)
       OR EXISTS (SELECT 1 FROM public.config_conteo c WHERE c.created_at = now() AND c.vigente_desde >= v_d)
       OR EXISTS (SELECT 1 FROM public.config_personas p WHERE p.motivo = 'Corrección de prueba 0810')
       OR EXISTS (SELECT 1 FROM public.config_general g
                  WHERE g.anulado_at IS NULL AND g.vigente_hasta = v_d - 1 AND g.parametro = 'plazo_gracia_horas') THEN
      RAISE EXCEPTION '0810: quedaron filas o cortes de la prueba de configuración';
    END IF;
  END IF;

  -- 12.7 Calendario: carga idempotente, no revive anulados, dos festivos el mismo día, restricciones (todo se deshace)
  SELECT m.code INTO v_mun1 FROM public.municipalities m ORDER BY (m.code = '11001') DESC, m.code LIMIT 1;
  SELECT m.code INTO v_mun2 FROM public.municipalities m WHERE m.code <> v_mun1 ORDER BY (m.code = '05001') DESC, m.code LIMIT 1;
  BEGIN
    v_n := public.calendario_cargar_festivos(2026, NULL);
    IF v_n <> 0 THEN
      RAISE EXCEPTION '0810: calendario_cargar_festivos(2026) no es idempotente (insertó % de nuevo)', v_n;
    END IF;
    UPDATE public.calendario SET anulado_at = now(), anulado_motivo = 'Prueba 0810'
    WHERE fecha = DATE '2027-01-01' AND alcance = 'nacional' AND anulado_at IS NULL;
    v_n := public.calendario_cargar_festivos(2027, NULL);
    IF v_n <> 0 OR EXISTS (SELECT 1 FROM public.calendario
                           WHERE fecha = DATE '2027-01-01' AND alcance = 'nacional' AND anulado_at IS NULL) THEN
      RAISE EXCEPTION '0810: calendario_cargar_festivos revivió un festivo anulado (insertó %)', v_n;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.calendario
                   WHERE alcance = 'nacional' AND fecha BETWEEN DATE '2038-01-01' AND DATE '2038-12-31') THEN
      v_n := public.calendario_cargar_festivos(2038, NULL);
      SELECT c.nombre INTO v_texto FROM public.calendario c
      WHERE c.fecha = DATE '2038-07-05' AND c.alcance = 'nacional' AND c.anulado_at IS NULL;
      IF v_n <> 17 OR v_texto IS DISTINCT FROM 'Sagrado Corazón de Jesús y San Pedro y San Pablo' THEN
        RAISE EXCEPTION '0810: 2038 debía cargar 17 fechas con una sola fila para el 5 de julio (insertó %, nombre %)',
          v_n, v_texto;
      END IF;
    END IF;
    BEGIN
      PERFORM public.calendario_cargar_festivos(1800, NULL);
      RAISE EXCEPTION '0810: calendario_cargar_festivos aceptó el año 1800';
    EXCEPTION WHEN invalid_parameter_value THEN NULL;
    END;

    INSERT INTO public.calendario (fecha, alcance, tipo, nombre)
    VALUES (v_d, 'empresa', 'no_habil', 'Día de prueba 0810') RETURNING id INTO v_id;
    BEGIN
      INSERT INTO public.calendario (fecha, alcance, tipo, nombre) VALUES (v_d, 'empresa', 'habil', 'Repetido');
      RAISE EXCEPTION '0810: se aceptaron dos días de empresa activos en la misma fecha';
    EXCEPTION WHEN unique_violation THEN NULL;
    END;
    INSERT INTO public.calendario (fecha, alcance, municipality_id, tipo, nombre)
    VALUES (v_d, 'ciudad', v_mun1, 'no_habil', 'Día cívico de prueba');
    INSERT INTO public.calendario (fecha, alcance, municipality_id, tipo, nombre)
    VALUES (v_d, 'ciudad', v_mun2, 'no_habil', 'Día cívico de prueba');  -- otra ciudad, misma fecha: sí
    BEGIN
      INSERT INTO public.calendario (fecha, alcance, municipality_id, tipo, nombre)
      VALUES (v_d, 'ciudad', v_mun1, 'habil', 'Repetido');
      RAISE EXCEPTION '0810: se aceptaron dos días activos de la misma ciudad en la misma fecha';
    EXCEPTION WHEN unique_violation THEN NULL;
    END;
    IF NOT EXISTS (SELECT 1 FROM public.municipalities WHERE code = '00000') THEN
      BEGIN
        INSERT INTO public.calendario (fecha, alcance, municipality_id, tipo, nombre)
        VALUES (v_d, 'ciudad', '00000', 'no_habil', 'Municipio inexistente');
        RAISE EXCEPTION '0810: se aceptó un día de ciudad con un municipio que no existe';
      EXCEPTION WHEN foreign_key_violation THEN NULL;
      END;
    END IF;
    FOREACH v_sql IN ARRAY ARRAY[
      format('INSERT INTO public.calendario (fecha, alcance, tipo, nombre) VALUES (%L, ''ciudad'', ''no_habil'', ''Sin municipio'')', v_d + 1),
      format('INSERT INTO public.calendario (fecha, alcance, municipality_id, tipo, nombre) VALUES (%L, ''empresa'', %L, ''no_habil'', ''Empresa con municipio'')', v_d + 1, v_mun1),
      format('INSERT INTO public.calendario (fecha, alcance, municipality_id, tipo, nombre) VALUES (%L, ''ciudad'', ''1100'', ''no_habil'', ''Municipio de 4 dígitos'')', v_d + 1),
      format('INSERT INTO public.calendario (fecha, alcance, tipo, nombre) VALUES (%L, ''nacional'', ''habil'', ''Nacional hábil'')', v_d + 1),
      format('INSERT INTO public.calendario (fecha, alcance, tipo, nombre, origen) VALUES (%L, ''empresa'', ''no_habil'', ''Calculado de empresa'', ''calculado'')', v_d + 1),
      format('INSERT INTO public.calendario (fecha, alcance, tipo, nombre) VALUES (%L, ''region'', ''no_habil'', ''Alcance raro'')', v_d + 1),
      format('INSERT INTO public.calendario (fecha, alcance, tipo, nombre) VALUES (%L, ''empresa'', ''medio'', ''Tipo raro'')', v_d + 1),
      format('INSERT INTO public.calendario (fecha, alcance, tipo, nombre) VALUES (%L, ''empresa'', ''no_habil'', ''  '')', v_d + 1),
      format('INSERT INTO public.calendario (fecha, alcance, tipo, nombre, anulado_at) VALUES (%L, ''empresa'', ''no_habil'', ''Anulado sin motivo'', now())', v_d + 1)]
    LOOP
      BEGIN
        EXECUTE v_sql;
        RAISE EXCEPTION '0810: se aceptó un día de calendario que viola un CHECK: %', v_sql;
      EXCEPTION WHEN check_violation THEN NULL;
      END;
    END LOOP;
    BEGIN
      DELETE FROM public.calendario WHERE id = v_id;
      RAISE EXCEPTION '0810: se borró un día del calendario';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    UPDATE public.calendario SET anulado_at = now(), anulado_motivo = 'Prueba 0810' WHERE id = v_id;
    INSERT INTO public.calendario (fecha, alcance, tipo, nombre)
    VALUES (v_d, 'empresa', 'habil', 'Día de prueba 0810 corregido');  -- anular libera el cupo

    RAISE SQLSTATE 'P0810';
  EXCEPTION
    WHEN SQLSTATE 'P0810' THEN NULL;  -- filas de prueba deshechas
  END;
  IF EXISTS (SELECT 1 FROM public.calendario WHERE (created_at = now() AND fecha >= v_d) OR anulado_motivo = 'Prueba 0810')
     OR NOT EXISTS (SELECT 1 FROM public.calendario WHERE fecha = DATE '2027-01-01' AND alcance = 'nacional') THEN
    RAISE EXCEPTION '0810: quedaron (o se perdieron) filas de la prueba de calendario';
  END IF;

  -- 12.8 Días libres: uno vigente por persona y fecha, CHECK, sin borrar (todo se deshace)
  IF v_exec IS NOT NULL THEN
    BEGIN
      INSERT INTO public.dias_libres (executive_id, fecha, fraccion, motivo, estado)
      VALUES (v_exec, v_d, 1, 'vacaciones', 'registrado') RETURNING id INTO v_id;
      BEGIN
        INSERT INTO public.dias_libres (executive_id, fecha, fraccion, motivo, estado)
        VALUES (v_exec, v_d, 0.5, 'otro', 'por_aprobar');
        RAISE EXCEPTION '0810: se aceptaron dos días libres vigentes de la misma persona en la misma fecha';
      EXCEPTION WHEN unique_violation THEN NULL;
      END;
      UPDATE public.dias_libres SET estado = 'anulado', revisado_at = now(), motivo_revision = 'Prueba 0810' WHERE id = v_id;
      INSERT INTO public.dias_libres (executive_id, fecha, fraccion, motivo, estado)
      VALUES (v_exec, v_d, 0.5, 'otro', 'por_aprobar');  -- anulado libera la fecha
      INSERT INTO public.dias_libres (executive_id, fecha, fraccion, motivo, estado, fuera_de_plazo, justificacion,
                                      revisado_at)
      VALUES (v_exec, v_d + 1, 1, 'incapacidad', 'aprobado', true, 'Incapacidad que llegó tarde', now());
      FOREACH v_sql IN ARRAY ARRAY[
        format('INSERT INTO public.dias_libres (executive_id, fecha, fraccion, motivo, estado) VALUES (%L, %L, 0.7, ''vacaciones'', ''registrado'')', v_exec, v_d + 2),
        format('INSERT INTO public.dias_libres (executive_id, fecha, fraccion, motivo, estado) VALUES (%L, %L, 2, ''vacaciones'', ''registrado'')', v_exec, v_d + 2),
        format('INSERT INTO public.dias_libres (executive_id, fecha, fraccion, motivo, estado) VALUES (%L, %L, 1, ''vacaciones'', ''pendiente'')', v_exec, v_d + 2),
        format('INSERT INTO public.dias_libres (executive_id, fecha, fraccion, motivo, estado) VALUES (%L, %L, 1, ''Vacaciones'', ''registrado'')', v_exec, v_d + 2),
        format('INSERT INTO public.dias_libres (executive_id, fecha, fraccion, motivo, estado, fuera_de_plazo) VALUES (%L, %L, 1, ''vacaciones'', ''registrado'', true)', v_exec, v_d + 2),
        format('INSERT INTO public.dias_libres (executive_id, fecha, fraccion, motivo, estado, fuera_de_plazo, justificacion) VALUES (%L, %L, 1, ''vacaciones'', ''registrado'', true, '' abc '')', v_exec, v_d + 2),
        format('INSERT INTO public.dias_libres (executive_id, fecha, fraccion, motivo, estado) VALUES (%L, %L, 1, ''vacaciones'', ''aprobado'')', v_exec, v_d + 2),
        format('INSERT INTO public.dias_libres (executive_id, fecha, fraccion, motivo, estado, revisado_at) VALUES (%L, %L, 1, ''vacaciones'', ''rechazado'', now())', v_exec, v_d + 2),
        format('INSERT INTO public.dias_libres (executive_id, fecha, fraccion, motivo, estado, revisado_at, motivo_revision) VALUES (%L, %L, 1, ''vacaciones'', ''anulado'', now(), ''  '')', v_exec, v_d + 2),
        format('INSERT INTO public.dias_libres (executive_id, fecha, fraccion, motivo, estado, nota) VALUES (%L, %L, 1, ''vacaciones'', ''registrado'', %L)', v_exec, v_d + 2, repeat('x', 501))]
      LOOP
        BEGIN
          EXECUTE v_sql;
          RAISE EXCEPTION '0810: se aceptó un día libre que viola un CHECK: %', v_sql;
        EXCEPTION WHEN check_violation THEN NULL;
        END;
      END LOOP;
      BEGIN
        DELETE FROM public.dias_libres WHERE id = v_id;
        RAISE EXCEPTION '0810: se borró un día libre';
      EXCEPTION WHEN check_violation THEN NULL;
      END;

      RAISE SQLSTATE 'P0810';
    EXCEPTION
      WHEN SQLSTATE 'P0810' THEN NULL;  -- filas de prueba deshechas
    END;
    IF EXISTS (SELECT 1 FROM public.dias_libres WHERE created_at = now() AND fecha >= v_d) THEN
      RAISE EXCEPTION '0810: quedaron filas de la prueba de días libres';
    END IF;
  END IF;

  -- 12.9 Rol hr aceptado en users y un rol fuera de la lista rechazado (todo se deshace)
  IF EXISTS (SELECT 1 FROM public.users WHERE email LIKE 'prueba-0810-%@opmap.invalid') THEN
    RAISE EXCEPTION '0810: ya hay usuarios con el correo de prueba prueba-0810-…@opmap.invalid; no se puede probar';
  END IF;
  BEGIN
    INSERT INTO public.users (email, password, full_name, role)
    VALUES ('prueba-0810-hr@opmap.invalid', 'sin-clave', 'Prueba 0810 recursos humanos', 'hr')
    RETURNING id INTO v_user;
    BEGIN
      INSERT INTO public.users (email, password, full_name, role)
      VALUES ('prueba-0810-x@opmap.invalid', 'sin-clave', 'Prueba 0810 rol raro', 'rrhh');
      RAISE EXCEPTION '0810: users aceptó un rol fuera de la lista';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    -- Quien registró y anuló configuración no se borra: la llave (sin ON DELETE) responde 23503, no config_inmutable
    v_id := public.config_registrar('config_general', jsonb_build_object('parametro', 'radio_presencial_m', 'valor', 700),
              v_d + 900, NULL, NULL, v_user);
    PERFORM public.config_cerrar('config_general', v_id, v_d + 800, NULL, v_user);
    IF (SELECT g.set_by FROM public.config_general g WHERE g.id = v_id) IS DISTINCT FROM v_user
       OR (SELECT g.anulado_por FROM public.config_general g WHERE g.id = v_id) IS DISTINCT FROM v_user THEN
      RAISE EXCEPTION '0810: config_registrar/config_cerrar no guardaron quién registró y quién anuló';
    END IF;
    BEGIN
      DELETE FROM public.users WHERE id = v_user;
      RAISE EXCEPTION '0810: se borró un usuario que dejó rastro en la configuración';
    EXCEPTION WHEN foreign_key_violation THEN NULL;
    END;
    RAISE SQLSTATE 'P0810';
  EXCEPTION
    WHEN SQLSTATE 'P0810' THEN NULL;  -- usuario de prueba deshecho
  END;
  IF EXISTS (SELECT 1 FROM public.users WHERE email LIKE 'prueba-0810-%@opmap.invalid') THEN
    RAISE EXCEPTION '0810: quedó el usuario de prueba';
  END IF;

  SELECT count(*) INTO v_n FROM public.calendario WHERE alcance = 'nacional' AND anulado_at IS NULL;
  RAISE NOTICE '0810 OK: 6 tablas con RLS sin políticas y solo service_role (sin DELETE ni TRUNCATE); btree_gist; 4 exclusiones <tabla>_sin_superposicion y config_inmutable; semillas 2 metas, 5 conteos y 9 parámetros; % festivos nacionales activos (2026 y 2027 iguales al contrato); rol hr en users_role_check.', v_n;
  RAISE NOTICE '0810 OK: config_registrar probado (valor abierto, temporal con continuación, mismo día, superposición con valor futuro 23P01, pasado sin motivo 23514, anterior_id), config_cerrar (cancelar o acortar devuelve el valor anterior: alarga, copia, mismo día, en cadena; no revive lo que se registró en un hueco), config_inmutable, CHECK, llaves a users sin ON DELETE (23503 al borrar a quien dejó rastro), índices únicos de calendario y días libres y borrado prohibido; todas las filas de prueba deshechas.';
END;
$$;

COMMIT;
