-- =====================================================================================
-- OpMap · feat/visitas-f1-terceros (app de visita · F1 Terceros) · 0800
-- Proyecto: norvxqgohddgsdkggqzq · Generado: 2026-10-12 · NO APLICADA TODAVÍA
--
-- Contrato: docs/fases/fase6-visitas-f1-terceros.md (sección "Base de datos"; fuente de verdad de nombres).
--   Spec aprobada: docs/specs/2026-10-12-app-de-visita-opmap.md (secciones 3, 9 y 11).
--   Decisiones del dueño: docs/decisiones/2026-10-12-app-de-visita.md.
--   Es ADITIVA: 7 tablas nuevas, 5 funciones, 1 disparador nuevo sobre hospitals y una semilla. NO cambia
--   ninguna fila ni columna de hospitals (solo lee) ni de otra tabla existente.
--
-- Por qué:
--   La app de visita necesita terceros completos: cuentas (clínicas, consultorios, EPS, operadores) con sus
--   sedes, médicos que no se crean a medias (documento, nombre, especialidad, municipio y al menos una sede),
--   los visitantes de cada médico por línea y ciudad, contactos con cargo y los subtipos de visita
--   institucional. Nada se trae de VMO: la única carga automática son las IPS activas de hospitals, como
--   sedes agrupadas en una cuenta por NIT. hospitals NO cambia y las sedes nuevas NO entran a hospitals
--   (no mueven zonas, mapa ni rutas de Google).
--
-- Qué hace:
--   1. Tablas (RLS sin políticas; REVOKE a PUBLIC/anon/authenticated; GRANT a service_role; COMMENT;
--      created_at/updated_at con disparador update_updated_at_column(); created_by → users ON DELETE SET NULL):
--        cuentas, sedes, medicos, medico_sedes, medico_visitantes, contactos, subtipos_institucionales.
--   2. Reglas en la base:
--        - medicos_requiere_sede / medico_sedes_requiere_sede: CONSTRAINT TRIGGER DEFERRABLE INITIALLY
--          DEFERRED (medicos: INSERT y UPDATE OF activo; medico_sedes: DELETE y UPDATE): al cerrar la
--          transacción, un médico ACTIVO sin ninguna fila en medico_sedes se rechaza (SQLSTATE 23514).
--        - contactos_sede_de_la_cuenta: si contactos.sede_id no es NULL, la sede debe ser de la misma cuenta
--          (23514).
--   3. terceros_crear_medico(p_medico jsonb, p_sedes jsonb, p_user uuid) → uuid: médico + medico_sedes en una
--      transacción (PostgREST no tiene transacciones). Error 23514 si p_sedes no es un arreglo con al menos una
--      sede. Sedes repetidas: cuenta la primera. Principal: la primera marcada; si ninguna viene marcada, la
--      primera de la lista. Documento repetido → 23505 (medicos_documento_key).
--   4. terceros_sincronizar_hospitals(p_hospital_id uuid DEFAULT NULL) → jsonb, idempotente. Sin argumento
--      sincroniza todas las IPS (es la llamada del contrato, terceros_sincronizar_hospitals()); con un id,
--      solo esa IPS (lo usa el disparador). Toda IPS activa de hospitals con NIT tiene su sede (origen
--      'hospitals', hospital_id, reps_code, nombre = name, direccion = address, municipality_id, ciudad =
--      municipality_name, lat/lng, ubicacion_confirmada) en la cuenta de su NIT (tipo 'NIT', clase 'clinica',
--      origen 'hospitals'), que crea si no existe: nombre = el nombre_prestador más frecuente en reps_sedes
--      para ese NIT o, si no hay, el de la IPS con más camas; codigo_prestador = el más frecuente del REPS.
--      Si la IPS se renombra, se mueve o cambia de código de habilitación, actualiza la sede; si se desactiva,
--      sedes.activo = false (y vuelve a true si se reactiva). Si cambia de NIT (hospitals.code), la sede pasa
--      a la cuenta del NIT nuevo (sus contactos quedan sin sede, con aviso). Nunca borra. La principal de cada
--      cuenta sin principal es su sede activa con más camas (desempate por nombre); una principal ya puesta
--      no se toca (es editable).
--      Datos que no caben en las restricciones de sedes NO hacen fallar la escritura en hospitals: coordenadas
--      fuera de Colombia o incompletas → lat/lng NULL y ubicacion_confirmada = false; municipality_id que no
--      es de 5 dígitos → NULL; reps_code que ya tiene OTRA sede (creada a mano) → la sede de la IPS queda sin
--      código y sale un WARNING para unirlas a mano. IPS activa sin NIT legible → sin sede, con WARNING.
--   5. Disparador hospitals_terceros_sync: AFTER INSERT OR UPDATE OF active, name, code, reps_code, lat, lng,
--      address, municipality_id, municipality_name ON hospitals FOR EACH ROW → sincroniza esa IPS. (El
--      contrato pide active, name, reps_code, lat, lng, address, municipality_id; se añaden code, por el
--      cambio de NIT, y municipality_name, porque alimenta sedes.ciudad.) No recalcula asignaciones ni llama
--      a Google.
--   6. Semilla de 5 subtipos institucionales (vigentes desde 2026-10-12; igual que SUBTIPOS_SEMILLA de
--      web/lib/terceros.ts) y carga inicial: terceros_sincronizar_hospitals() una vez.
--   7. Bloque DO final que comprueba todo y aborta si algo no cuadra: estructura, RLS, privilegios (solo
--      service_role), conteos derivados de hospitals (cuentas = count(DISTINCT nit) de IPS activas, sedes =
--      count(*) de IPS activas con NIT, cuentas con más de una sede = NIT con más de una IPS activa; aviso si
--      no da 703 / 783 / 47 como en la foto del contrato), una sola principal por cuenta y la de más camas en
--      las cuentas recién creadas, idempotencia, restricciones y unicidades con INSERT de prueba, médico sin
--      sede rechazado, terceros_crear_medico con sedes vacías rechazado, disparador sobre hospitals (cambio de
--      nombre, desactivación y cambio de NIT) — todo en sub-bloques que terminan con RAISE SQLSTATE 'P0800' y
--      se deshacen: no queda ni cambia ninguna fila.
--
-- Restricciones con nombre (la API puede traducirlas): cuentas_identificacion_key (23505, cuenta repetida),
--   sedes_reps_code_key (23505, código de habilitación repetido), sedes_hospital_id_key, sedes_una_principal_uidx,
--   medicos_documento_key (23505, médico repetido), medico_sedes_pkey, medico_sedes_una_principal_uidx,
--   medico_visitantes_vigente_uidx (23505, visitante vigente repetido), subtipos_institucionales_codigo_key.
--   Reglas de negocio → 23514 (check_violation): médico activo sin sede, sede de otra cuenta en un contacto,
--   terceros_crear_medico sin sedes, y todos los CHECK.
--
-- Además de lo que fija el contrato (no lo contradice): NIT de cuenta a 9 dígitos (como hospitals.nit);
--   municipality_id de 5 dígitos donde lo hay; nombre no vacío en sedes y contactos; roles_sugeridos dentro de
--   los roles de contacto; created_by también en medico_sedes y subtipos_institucionales.
--
-- Para la API: las sedes con hospital_id son una IPS de OpMap; su nombre, dirección, municipio, ciudad, lat/lng,
--   ubicacion_confirmada, reps_code y activo los PISA la sincronización cuando la IPS cambia en hospitals (se
--   editan desde la ficha de la IPS, no desde /terceros). Cambiar cuentas.clase de 'eps' a otra exige poner
--   modalidad_facturacion en NULL (CHECK cuentas_modalidad_check).
--
-- Foto de hospitals (contrato, 2026-10-12): 783 IPS activas con 703 NIT distintos; 47 NIT con más de una IPS.
--   hospitals.nit es la columna GENERADA de 0600 (9 dígitos sin DV desde code); reps_code UNIQUE de 12 dígitos.
--   hospitals tiene un solo disparador previo (update_hospitals_updated_at, BEFORE UPDATE).
--   Quién escribe en hospitals: el servidor con service_role y el SQL del dueño (postgres); anon/authenticated
--   solo tienen SELECT (database/hardening/03). El disparador es SECURITY INVOKER: quien escribe en hospitals
--   necesita EXECUTE sobre terceros_sincronizar_hospitals y escritura en cuentas/sedes/contactos
--   (service_role y el dueño de las funciones la tienen).
--
-- Depende de: 0100 (executives, business_lines), 0600 (hospitals.nit, hospitals.reps_code, reps_sedes) y de
--   public.update_updated_at_column() (existente).
--
-- Después de aplicar (misma ventana que el despliegue del código de /terceros):
--   NOTIFY pgrst, 'reload schema';   -- PostgREST debe ver las tablas y las funciones nuevas
--   Costo Google: 0 (no llama a nada). No recalcula asignaciones.
--
-- Transaccional: todo o nada. Re-ejecutable: sí (IF NOT EXISTS, CREATE OR REPLACE, DROP TRIGGER IF EXISTS +
--   CREATE CONSTRAINT TRIGGER, ON CONFLICT DO NOTHING; la sincronización es idempotente).
-- Rollback: 2026-10-12_9940_visitas_terceros_rollback.sql.
-- =====================================================================================

BEGIN;

-- -------------------------------------------------------------------------------------
-- 0. Precondiciones
-- -------------------------------------------------------------------------------------

DO $$
DECLARE
  v_par text[];
BEGIN
  IF to_regclass('public.hospitals') IS NULL OR to_regclass('public.users') IS NULL
     OR to_regclass('public.executives') IS NULL OR to_regclass('public.business_lines') IS NULL
     OR to_regclass('public.reps_sedes') IS NULL THEN
    RAISE EXCEPTION '0800 Terceros: faltan tablas previas (hospitals, users, executives, business_lines, reps_sedes)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'hospitals' AND column_name = 'nit'
                   AND is_generated = 'ALWAYS') THEN
    RAISE EXCEPTION '0800 Terceros: hospitals.nit debe ser la columna GENERADA de 0600';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'hospitals' AND column_name = 'reps_code') THEN
    RAISE EXCEPTION '0800 Terceros: falta hospitals.reps_code (0600)';
  END IF;
  IF to_regprocedure('public.update_updated_at_column()') IS NULL THEN
    RAISE EXCEPTION '0800 Terceros: falta la función public.update_updated_at_column()';
  END IF;
  -- Si alguna tabla ya existe, debe ser la de esta migración (re-ejecución), no otra con el mismo nombre.
  FOREACH v_par SLICE 1 IN ARRAY ARRAY[
    ARRAY['cuentas', 'numero_identificacion'], ARRAY['sedes', 'ubicacion_confirmada'],
    ARRAY['medicos', 'especialidades'], ARRAY['medico_sedes', 'principal'],
    ARRAY['medico_visitantes', 'desde'], ARRAY['contactos', 'cargo_texto'],
    ARRAY['subtipos_institucionales', 'roles_sugeridos']]
  LOOP
    IF to_regclass('public.' || v_par[1]) IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_schema = 'public' AND table_name = v_par[1] AND column_name = v_par[2]) THEN
      RAISE EXCEPTION '0800 Terceros: ya existe una tabla public.% que no es la de esta migración (sin columna %)',
        v_par[1], v_par[2];
    END IF;
  END LOOP;
END;
$$;

-- -------------------------------------------------------------------------------------
-- 1. Tablas
-- -------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.cuentas (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre                text        NOT NULL,
  clase                 text        NOT NULL,
  es_cliente            boolean     NOT NULL DEFAULT false,
  tipo_identificacion   text        NOT NULL,
  numero_identificacion text        NOT NULL,
  codigo_prestador      text        NULL,
  modalidad_facturacion text        NULL,
  notas                 text        NULL,
  activo                boolean     NOT NULL DEFAULT true,
  origen                text        NOT NULL DEFAULT 'manual',
  created_by            uuid        NULL REFERENCES public.users(id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cuentas_identificacion_key UNIQUE (tipo_identificacion, numero_identificacion),
  CONSTRAINT cuentas_nombre_check CHECK (length(btrim(nombre)) >= 2),
  CONSTRAINT cuentas_clase_check
    CHECK (clase IN ('clinica', 'consultorio', 'eps', 'operador_logistico', 'otra')),
  CONSTRAINT cuentas_tipo_identificacion_check
    CHECK (tipo_identificacion IN ('NIT', 'CC', 'CE', 'PA', 'otro')),
  -- NIT a 9 dígitos sin DV (como hospitals.nit); el resto, letras y números en mayúsculas.
  CONSTRAINT cuentas_numero_identificacion_check
    CHECK (numero_identificacion ~ '^[0-9A-Z]{3,20}$'
           AND (tipo_identificacion <> 'NIT' OR numero_identificacion ~ '^[0-9]{9}$')),
  CONSTRAINT cuentas_modalidad_check
    CHECK (modalidad_facturacion IS NULL
           OR (clase = 'eps' AND modalidad_facturacion IN ('directa', 'via_clinica'))),
  CONSTRAINT cuentas_origen_check CHECK (origen IN ('hospitals', 'manual'))
);

CREATE TABLE IF NOT EXISTS public.sedes (
  id                   uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  cuenta_id            uuid         NOT NULL REFERENCES public.cuentas(id) ON DELETE RESTRICT,
  nombre               text         NOT NULL,
  es_principal         boolean      NOT NULL DEFAULT false,
  reps_code            text         NULL,
  hospital_id          uuid         NULL REFERENCES public.hospitals(id) ON DELETE SET NULL,
  direccion            text         NULL,
  municipality_id      varchar(5)   NULL,
  ciudad               text         NULL,
  lat                  numeric(9,6) NULL,
  lng                  numeric(9,6) NULL,
  ubicacion_confirmada boolean      NOT NULL DEFAULT false,
  activo               boolean      NOT NULL DEFAULT true,
  origen               text         NOT NULL DEFAULT 'manual',
  created_by           uuid         NULL REFERENCES public.users(id) ON DELETE SET NULL,
  created_at           timestamptz  NOT NULL DEFAULT now(),
  updated_at           timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT sedes_reps_code_key   UNIQUE (reps_code),
  CONSTRAINT sedes_hospital_id_key UNIQUE (hospital_id),
  CONSTRAINT sedes_nombre_check    CHECK (btrim(nombre) <> ''),
  CONSTRAINT sedes_reps_code_check CHECK (reps_code IS NULL OR reps_code ~ '^[0-9]{12}$'),
  CONSTRAINT sedes_municipio_check CHECK (municipality_id IS NULL OR municipality_id ~ '^[0-9]{5}$'),
  CONSTRAINT sedes_origen_check    CHECK (origen IN ('hospitals', 'manual', 'gps_app')),
  -- lat/lng los dos o ninguno, y dentro de Colombia (incluye San Andrés y Leticia).
  CONSTRAINT sedes_coordenadas_check
    CHECK ((lat IS NULL) = (lng IS NULL)
           AND (lat IS NULL OR (lat BETWEEN -5 AND 14 AND lng BETWEEN -82 AND -66)))
);

CREATE TABLE IF NOT EXISTS public.medicos (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_documento   text        NOT NULL,
  numero_documento text        NOT NULL,
  nombre           text        NOT NULL,
  especialidades   text[]      NOT NULL,
  municipality_id  varchar(5)  NOT NULL,
  telefono         text        NULL,
  email            text        NULL,
  notas            text        NULL,
  activo           boolean     NOT NULL DEFAULT true,
  created_by       uuid        NULL REFERENCES public.users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT medicos_documento_key UNIQUE (tipo_documento, numero_documento),
  CONSTRAINT medicos_tipo_documento_check
    CHECK (tipo_documento IN ('CC', 'CE', 'PA', 'PEP', 'PPT', 'otro')),
  CONSTRAINT medicos_numero_documento_check CHECK (numero_documento ~ '^[0-9A-Z]{3,20}$'),
  CONSTRAINT medicos_nombre_check CHECK (length(btrim(nombre)) >= 3),
  CONSTRAINT medicos_especialidades_check
    CHECK (cardinality(especialidades) >= 1
           AND especialidades <@ ARRAY['ortopedia', 'neurocirugia', 'columna', 'deportiva', 'maxilofacial',
                                       'fisiatria', 'cirugia_general', 'otra']::text[]),
  CONSTRAINT medicos_municipio_check CHECK (municipality_id ~ '^[0-9]{5}$')
);

CREATE TABLE IF NOT EXISTS public.medico_sedes (
  medico_id  uuid        NOT NULL REFERENCES public.medicos(id) ON DELETE CASCADE,
  sede_id    uuid        NOT NULL REFERENCES public.sedes(id)   ON DELETE RESTRICT,
  rol        text        NOT NULL,
  principal  boolean     NOT NULL DEFAULT false,
  created_by uuid        NULL REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT medico_sedes_pkey PRIMARY KEY (medico_id, sede_id),
  CONSTRAINT medico_sedes_rol_check CHECK (rol IN ('consultorio', 'atiende'))
);

CREATE TABLE IF NOT EXISTS public.medico_visitantes (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  medico_id       uuid        NOT NULL REFERENCES public.medicos(id) ON DELETE CASCADE,
  executive_id    uuid        NOT NULL REFERENCES public.executives(id),
  line_id         uuid        NOT NULL REFERENCES public.business_lines(id),
  municipality_id varchar(5)  NULL,
  desde           date        NOT NULL DEFAULT ((now() AT TIME ZONE 'America/Bogota')::date),
  hasta           date        NULL,
  created_by      uuid        NULL REFERENCES public.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT medico_visitantes_fechas_check CHECK (hasta IS NULL OR hasta >= desde),
  CONSTRAINT medico_visitantes_municipio_check
    CHECK (municipality_id IS NULL OR municipality_id ~ '^[0-9]{5}$')
);

CREATE TABLE IF NOT EXISTS public.contactos (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  cuenta_id   uuid        NOT NULL REFERENCES public.cuentas(id) ON DELETE RESTRICT,
  sede_id     uuid        NULL     REFERENCES public.sedes(id)   ON DELETE SET NULL,
  nombre      text        NOT NULL,
  cargo_texto text        NULL,
  rol         text        NOT NULL DEFAULT 'otro',
  telefono    text        NULL,
  email       text        NULL,
  activo      boolean     NOT NULL DEFAULT true,
  created_by  uuid        NULL REFERENCES public.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contactos_nombre_check CHECK (btrim(nombre) <> ''),
  CONSTRAINT contactos_rol_check
    CHECK (rol IN ('compras', 'gerencia', 'direccion_medica', 'quimico_farmaceutico', 'almacen_farmacia',
                   'autorizaciones', 'auditoria_medica', 'programacion_cirugia', 'quirofano', 'esterilizacion',
                   'instrumentacion', 'cartera_facturacion', 'otro'))
);

CREATE TABLE IF NOT EXISTS public.subtipos_institucionales (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo          text        NOT NULL,
  nombre          text        NOT NULL,
  para_que        text        NOT NULL,
  roles_sugeridos text[]      NOT NULL DEFAULT '{}',
  orden           int         NOT NULL,
  vigente_desde   date        NOT NULL,
  vigente_hasta   date        NULL,
  created_by      uuid        NULL REFERENCES public.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT subtipos_institucionales_codigo_key UNIQUE (codigo),
  CONSTRAINT subtipos_institucionales_vigencia_check CHECK (vigente_hasta IS NULL OR vigente_hasta >= vigente_desde),
  CONSTRAINT subtipos_institucionales_roles_check
    CHECK (roles_sugeridos <@ ARRAY['compras', 'gerencia', 'direccion_medica', 'quimico_farmaceutico',
                                    'almacen_farmacia', 'autorizaciones', 'auditoria_medica',
                                    'programacion_cirugia', 'quirofano', 'esterilizacion', 'instrumentacion',
                                    'cartera_facturacion', 'otro']::text[])
);

-- -------------------------------------------------------------------------------------
-- 2. Índices (las PK y los UNIQUE ya crean el suyo)
-- -------------------------------------------------------------------------------------

-- Una sola sede principal por cuenta y una sola sede principal por médico.
CREATE UNIQUE INDEX IF NOT EXISTS sedes_una_principal_uidx        ON public.sedes (cuenta_id) WHERE es_principal;
CREATE UNIQUE INDEX IF NOT EXISTS medico_sedes_una_principal_uidx ON public.medico_sedes (medico_id) WHERE principal;
-- Un visitante vigente por (médico, ejecutiva, línea, ciudad); dos de la misma línea en ciudades distintas sí.
CREATE UNIQUE INDEX IF NOT EXISTS medico_visitantes_vigente_uidx
  ON public.medico_visitantes (medico_id, executive_id, line_id, (coalesce(municipality_id, '')))
  WHERE hasta IS NULL;

CREATE INDEX IF NOT EXISTS sedes_cuenta_id_idx              ON public.sedes (cuenta_id);
CREATE INDEX IF NOT EXISTS sedes_municipality_id_idx        ON public.sedes (municipality_id);
CREATE INDEX IF NOT EXISTS medicos_municipality_id_idx      ON public.medicos (municipality_id);
CREATE INDEX IF NOT EXISTS medico_sedes_sede_id_idx         ON public.medico_sedes (sede_id);
CREATE INDEX IF NOT EXISTS medico_visitantes_medico_id_idx  ON public.medico_visitantes (medico_id);
CREATE INDEX IF NOT EXISTS medico_visitantes_executive_idx  ON public.medico_visitantes (executive_id);
CREATE INDEX IF NOT EXISTS medico_visitantes_line_id_idx    ON public.medico_visitantes (line_id);
CREATE INDEX IF NOT EXISTS contactos_cuenta_id_idx          ON public.contactos (cuenta_id);
CREATE INDEX IF NOT EXISTS contactos_sede_id_idx            ON public.contactos (sede_id);

-- -------------------------------------------------------------------------------------
-- 3. updated_at (función existente public.update_updated_at_column())
-- -------------------------------------------------------------------------------------

CREATE OR REPLACE TRIGGER update_cuentas_updated_at
  BEFORE UPDATE ON public.cuentas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE OR REPLACE TRIGGER update_sedes_updated_at
  BEFORE UPDATE ON public.sedes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE OR REPLACE TRIGGER update_medicos_updated_at
  BEFORE UPDATE ON public.medicos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE OR REPLACE TRIGGER update_medico_sedes_updated_at
  BEFORE UPDATE ON public.medico_sedes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE OR REPLACE TRIGGER update_medico_visitantes_updated_at
  BEFORE UPDATE ON public.medico_visitantes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE OR REPLACE TRIGGER update_contactos_updated_at
  BEFORE UPDATE ON public.contactos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE OR REPLACE TRIGGER update_subtipos_institucionales_updated_at
  BEFORE UPDATE ON public.subtipos_institucionales
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- -------------------------------------------------------------------------------------
-- 4. Reglas: médico activo con al menos una sede; contacto con sede de su cuenta
-- -------------------------------------------------------------------------------------

-- Diferida al cierre de la transacción: así terceros_crear_medico puede insertar el médico y después sus sedes.
CREATE OR REPLACE FUNCTION public.terceros_medico_requiere_sede()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_medico uuid;
BEGIN
  IF TG_TABLE_NAME = 'medicos' THEN
    v_medico := NEW.id;
  ELSE
    v_medico := OLD.medico_id;  -- medico_sedes: DELETE o UPDATE (el médico de antes puede quedar sin sede)
  END IF;
  IF EXISTS (SELECT 1 FROM public.medicos m WHERE m.id = v_medico AND m.activo)
     AND NOT EXISTS (SELECT 1 FROM public.medico_sedes ms WHERE ms.medico_id = v_medico) THEN
    RAISE EXCEPTION 'Un médico activo debe tener al menos una sede donde atiende (médico %)', v_medico
      USING ERRCODE = 'check_violation',
            HINT = 'Crea el médico con terceros_crear_medico() o vincula otra sede antes de quitar la última.';
  END IF;
  RETURN NULL;
END;
$$;

-- CREATE OR REPLACE no vale para un CONSTRAINT TRIGGER: se borra y se crea (re-ejecutable).
DROP TRIGGER IF EXISTS medicos_requiere_sede ON public.medicos;
CREATE CONSTRAINT TRIGGER medicos_requiere_sede
  AFTER INSERT OR UPDATE OF activo ON public.medicos
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.terceros_medico_requiere_sede();

DROP TRIGGER IF EXISTS medico_sedes_requiere_sede ON public.medico_sedes;
CREATE CONSTRAINT TRIGGER medico_sedes_requiere_sede
  AFTER DELETE OR UPDATE ON public.medico_sedes
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.terceros_medico_requiere_sede();

CREATE OR REPLACE FUNCTION public.terceros_contacto_sede_de_la_cuenta()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.sede_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.sedes s WHERE s.id = NEW.sede_id AND s.cuenta_id = NEW.cuenta_id) THEN
    RAISE EXCEPTION 'La sede % no es de la cuenta % del contacto', NEW.sede_id, NEW.cuenta_id
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER contactos_sede_de_la_cuenta
  BEFORE INSERT OR UPDATE OF cuenta_id, sede_id ON public.contactos
  FOR EACH ROW EXECUTE FUNCTION public.terceros_contacto_sede_de_la_cuenta();

-- -------------------------------------------------------------------------------------
-- 5. terceros_crear_medico: médico y sus sedes en una sola transacción
-- -------------------------------------------------------------------------------------

-- p_medico: { tipo_documento, numero_documento, nombre, especialidades: [..], municipality_id,
--             telefono?, email?, notas? }   (la API ya los normalizó y validó con zod)
-- p_sedes:  [ { sede_id, rol: 'consultorio'|'atiende', principal?: bool }, ... ]   (al menos una)
CREATE OR REPLACE FUNCTION public.terceros_crear_medico(p_medico jsonb, p_sedes jsonb, p_user uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_medico IS NULL OR jsonb_typeof(p_medico) <> 'object' THEN
    RAISE EXCEPTION 'Faltan los datos del médico' USING ERRCODE = 'check_violation';
  END IF;
  IF p_sedes IS NULL OR jsonb_typeof(p_sedes) <> 'array' OR jsonb_array_length(p_sedes) = 0 THEN
    RAISE EXCEPTION 'El médico necesita al menos una sede donde atiende' USING ERRCODE = 'check_violation';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_sedes) AS t(e)
             WHERE jsonb_typeof(t.e) <> 'object' OR nullif(btrim(t.e ->> 'sede_id'), '') IS NULL) THEN
    RAISE EXCEPTION 'Cada sede del médico necesita su sede_id' USING ERRCODE = 'check_violation';
  END IF;
  IF jsonb_typeof(p_medico -> 'especialidades') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'El médico necesita al menos una especialidad' USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.medicos (tipo_documento, numero_documento, nombre, especialidades, municipality_id,
                              telefono, email, notas, created_by)
  VALUES (p_medico ->> 'tipo_documento',
          p_medico ->> 'numero_documento',
          p_medico ->> 'nombre',
          ARRAY(SELECT jsonb_array_elements_text(p_medico -> 'especialidades')),
          p_medico ->> 'municipality_id',
          nullif(btrim(p_medico ->> 'telefono'), ''),
          nullif(btrim(p_medico ->> 'email'), ''),
          nullif(btrim(p_medico ->> 'notas'), ''),
          p_user)
  RETURNING id INTO v_id;

  -- Sedes sin repetir (cuenta la primera aparición). Principal: la primera marcada o, si ninguna viene
  -- marcada, la primera de la lista.
  WITH recibidas AS (
    SELECT (t.e ->> 'sede_id')::uuid                        AS sede_id,
           t.e ->> 'rol'                                     AS rol,
           coalesce((t.e ->> 'principal')::boolean, false)   AS principal,
           t.o                                               AS o
    FROM jsonb_array_elements(p_sedes) WITH ORDINALITY AS t(e, o)
  ), unicas AS (
    SELECT DISTINCT ON (r.sede_id) r.sede_id, r.rol, r.principal, r.o
    FROM recibidas r
    ORDER BY r.sede_id, r.o
  ), elegida AS (
    SELECT coalesce(min(u.o) FILTER (WHERE u.principal), min(u.o)) AS o FROM unicas u
  )
  INSERT INTO public.medico_sedes (medico_id, sede_id, rol, principal, created_by)
  SELECT v_id, u.sede_id, u.rol, (u.o = el.o), p_user
  FROM unicas u
  CROSS JOIN elegida el;

  RETURN v_id;
END;
$$;

-- -------------------------------------------------------------------------------------
-- 6. terceros_sincronizar_hospitals: IPS activas de hospitals → sedes en la cuenta de su NIT
-- -------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.terceros_sincronizar_hospitals(p_hospital_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_codigo_ips        text;
  v_cuentas_creadas   bigint := 0;
  v_sedes_creadas     bigint := 0;
  v_sedes_actualizadas bigint := 0;
  v_codigos_quitados  bigint := 0;
  v_codigos_puestos   bigint := 0;
  v_sedes_movidas     bigint := 0;
  v_contactos_sueltos bigint := 0;
  v_principales       bigint := 0;
  v_sin_nit           bigint := 0;
  v_conflictos        bigint := 0;
  v_n                 bigint;
  v_cuentas_viejas    uuid[] := '{}';
  v_mov               record;
BEGIN
  IF p_hospital_id IS NOT NULL THEN
    SELECT h.reps_code INTO v_codigo_ips FROM public.hospitals h WHERE h.id = p_hospital_id;
  END IF;

  -- 6.1 Cuenta de cada NIT con IPS activa, si no existe (tipo NIT, clase clínica, origen hospitals).
  --     Nombre: el nombre_prestador más frecuente del REPS para ese NIT; si no hay, el de la IPS con más camas.
  INSERT INTO public.cuentas (nombre, clase, es_cliente, tipo_identificacion, numero_identificacion,
                              codigo_prestador, origen)
  SELECT CASE WHEN length(btrim(coalesce(rp.nombre, ''))) >= 2 THEN btrim(rp.nombre)
              WHEN length(btrim(coalesce(hp.name, ''))) >= 2 THEN btrim(hp.name)
              ELSE 'NIT ' || n.nit END,
         'clinica', false, 'NIT', n.nit,
         CASE WHEN rp.codigo ~ '^[0-9]{10}$' THEN rp.codigo END,
         'hospitals'
  FROM (SELECT DISTINCT h.nit
        FROM public.hospitals h
        WHERE h.active AND h.nit IS NOT NULL
          AND (p_hospital_id IS NULL OR h.id = p_hospital_id)) n
  LEFT JOIN LATERAL (
    SELECT mode() WITHIN GROUP (ORDER BY btrim(rs.nombre_prestador)) AS nombre,
           mode() WITHIN GROUP (ORDER BY rs.codigo_prestador)        AS codigo
    FROM public.reps_sedes rs
    WHERE rs.nit = n.nit AND btrim(rs.nombre_prestador) <> ''
  ) rp ON true
  LEFT JOIN LATERAL (
    SELECT h2.name
    FROM public.hospitals h2
    WHERE h2.active AND h2.nit = n.nit
    ORDER BY h2.beds DESC NULLS LAST, h2.name, h2.id
    LIMIT 1
  ) hp ON true
  WHERE NOT EXISTS (SELECT 1 FROM public.cuentas c
                    WHERE c.tipo_identificacion = 'NIT' AND c.numero_identificacion = n.nit)
  ON CONFLICT (tipo_identificacion, numero_identificacion) DO NOTHING;
  GET DIAGNOSTICS v_cuentas_creadas = ROW_COUNT;

  -- 6.2 Código de habilitación viejo: se suelta el de toda sede de IPS cuyo reps_code ya no es ese (incluida
  --     otra sede que aún tenga el código nuevo de esta IPS), para que la IPS que lo tiene ahora pueda tomarlo.
  UPDATE public.sedes s
  SET reps_code = NULL
  FROM public.hospitals h
  WHERE s.hospital_id = h.id
    AND s.reps_code IS NOT NULL
    AND s.reps_code IS DISTINCT FROM h.reps_code
    AND (p_hospital_id IS NULL OR h.id = p_hospital_id OR s.reps_code = v_codigo_ips);
  GET DIAGNOSTICS v_codigos_quitados = ROW_COUNT;

  -- 6.3 Datos de la sede desde la IPS: actualiza las que existen (activas o no) y crea las que faltan
  --     (solo IPS activas con NIT y cuenta). Lo que no cabe en las restricciones de sedes queda en NULL.
  WITH d AS (
    SELECT h.id                                                              AS hospital_id,
           h.nit                                                             AS nit,
           coalesce(h.active, false)                                         AS activo,
           coalesce(nullif(btrim(h.name), ''), 'IPS ' || coalesce(h.nit, h.id::text)) AS nombre,
           CASE WHEN h.reps_code ~ '^[0-9]{12}$' THEN h.reps_code END        AS reps_code,
           nullif(btrim(h.address), '')                                      AS direccion,
           CASE WHEN h.municipality_id ~ '^[0-9]{5}$' THEN h.municipality_id::varchar(5) END AS municipality_id,
           nullif(btrim(h.municipality_name), '')                            AS ciudad,
           CASE WHEN g.ok THEN g.lat END                                     AS lat,
           CASE WHEN g.ok THEN g.lng END                                     AS lng,
           coalesce(g.ok, false)                                             AS confirmada
    FROM public.hospitals h
    CROSS JOIN LATERAL (
      SELECT round(h.lat::numeric, 6) AS lat,
             round(h.lng::numeric, 6) AS lng,
             (round(h.lat::numeric, 6) BETWEEN -5 AND 14 AND round(h.lng::numeric, 6) BETWEEN -82 AND -66) AS ok
    ) g
    WHERE p_hospital_id IS NULL OR h.id = p_hospital_id
  ), actualizadas AS (
    UPDATE public.sedes s
    SET nombre = d.nombre, direccion = d.direccion, municipality_id = d.municipality_id, ciudad = d.ciudad,
        lat = d.lat, lng = d.lng, ubicacion_confirmada = d.confirmada, activo = d.activo
    FROM d
    WHERE s.hospital_id = d.hospital_id
      AND (s.nombre, s.direccion, s.municipality_id, s.ciudad, s.lat, s.lng, s.ubicacion_confirmada, s.activo)
          IS DISTINCT FROM
          (d.nombre, d.direccion, d.municipality_id, d.ciudad, d.lat, d.lng, d.confirmada, d.activo)
    RETURNING s.id
  ), nuevas AS (
    INSERT INTO public.sedes (cuenta_id, nombre, es_principal, reps_code, hospital_id, direccion, municipality_id,
                              ciudad, lat, lng, ubicacion_confirmada, activo, origen)
    SELECT c.id, d.nombre, false,
           CASE WHEN NOT EXISTS (SELECT 1 FROM public.sedes o WHERE o.reps_code = d.reps_code) THEN d.reps_code END,
           d.hospital_id, d.direccion, d.municipality_id, d.ciudad, d.lat, d.lng, d.confirmada, true, 'hospitals'
    FROM d
    JOIN public.cuentas c ON c.tipo_identificacion = 'NIT' AND c.numero_identificacion = d.nit
    WHERE d.activo
      AND NOT EXISTS (SELECT 1 FROM public.sedes s2 WHERE s2.hospital_id = d.hospital_id)
    ON CONFLICT DO NOTHING
    RETURNING id
  )
  SELECT (SELECT count(*) FROM actualizadas), (SELECT count(*) FROM nuevas)
  INTO v_sedes_actualizadas, v_sedes_creadas;

  -- 6.4 Código de habilitación actual a las sedes de IPS que no lo tienen, si ninguna otra sede lo tiene.
  UPDATE public.sedes s
  SET reps_code = h.reps_code
  FROM public.hospitals h
  WHERE s.hospital_id = h.id
    AND s.reps_code IS NULL
    AND h.reps_code ~ '^[0-9]{12}$'
    AND (p_hospital_id IS NULL OR h.id = p_hospital_id)
    AND NOT EXISTS (SELECT 1 FROM public.sedes o WHERE o.reps_code = h.reps_code);
  GET DIAGNOSTICS v_codigos_puestos = ROW_COUNT;

  -- 6.5 IPS que cambió de NIT (hospitals.code): su sede pasa a la cuenta del NIT nuevo. Sus contactos son de la
  --     cuenta vieja: quedan sin sede (no se borran). Caso raro; avisa con WARNING.
  FOR v_mov IN
    SELECT s.id AS sede_id, s.cuenta_id AS cuenta_vieja, c.id AS cuenta_nueva, h.id AS hospital_id, h.nit AS nit
    FROM public.sedes s
    JOIN public.hospitals h ON h.id = s.hospital_id
    JOIN public.cuentas c ON c.tipo_identificacion = 'NIT' AND c.numero_identificacion = h.nit
    WHERE h.active
      AND (p_hospital_id IS NULL OR h.id = p_hospital_id)
      AND s.cuenta_id <> c.id
  LOOP
    UPDATE public.contactos SET sede_id = NULL WHERE sede_id = v_mov.sede_id;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    UPDATE public.sedes SET cuenta_id = v_mov.cuenta_nueva, es_principal = false WHERE id = v_mov.sede_id;
    v_cuentas_viejas    := v_cuentas_viejas || v_mov.cuenta_vieja;
    v_sedes_movidas     := v_sedes_movidas + 1;
    v_contactos_sueltos := v_contactos_sueltos + v_n;
    RAISE WARNING 'Terceros: la IPS % cambió de NIT (%): su sede % pasa de la cuenta % a la %; % contacto(s) quedan sin sede',
      v_mov.hospital_id, v_mov.nit, v_mov.sede_id, v_mov.cuenta_vieja, v_mov.cuenta_nueva, v_n;
  END LOOP;

  -- 6.6 Principal de cada cuenta tocada que no la tiene: su sede activa con más camas (desempate por nombre).
  --     Una principal ya puesta (cargada o editada a mano) no se toca.
  WITH afectadas AS (
    SELECT s.cuenta_id
    FROM public.sedes s
    JOIN public.hospitals h ON h.id = s.hospital_id
    WHERE p_hospital_id IS NULL OR h.id = p_hospital_id
    UNION
    SELECT unnest(v_cuentas_viejas)
  ), elegidas AS (
    SELECT DISTINCT ON (s.cuenta_id) s.id
    FROM public.sedes s
    LEFT JOIN public.hospitals h ON h.id = s.hospital_id
    WHERE s.cuenta_id IN (SELECT a.cuenta_id FROM afectadas a)
      AND s.activo
      AND NOT EXISTS (SELECT 1 FROM public.sedes p WHERE p.cuenta_id = s.cuenta_id AND p.es_principal)
    ORDER BY s.cuenta_id, h.beds DESC NULLS LAST, s.nombre, s.id
  )
  UPDATE public.sedes s
  SET es_principal = true
  FROM elegidas e
  WHERE s.id = e.id;
  GET DIAGNOSTICS v_principales = ROW_COUNT;

  -- 6.7 Avisos (no abortan: una escritura en hospitals nunca falla por esto)
  SELECT count(*) INTO v_sin_nit
  FROM public.hospitals h
  WHERE h.active AND h.nit IS NULL AND (p_hospital_id IS NULL OR h.id = p_hospital_id);
  IF v_sin_nit > 0 THEN
    RAISE WARNING 'Terceros: % IPS activa(s) sin NIT legible en hospitals.code: no tienen sede hasta corregir el código', v_sin_nit;
  END IF;

  SELECT count(*) INTO v_conflictos
  FROM public.sedes s
  JOIN public.hospitals h ON h.id = s.hospital_id
  WHERE (p_hospital_id IS NULL OR h.id = p_hospital_id)
    AND h.reps_code IS NOT NULL
    AND s.reps_code IS DISTINCT FROM h.reps_code;
  IF v_conflictos > 0 THEN
    RAISE WARNING 'Terceros: % sede(s) de IPS sin su código de habilitación porque otra sede (creada a mano) ya lo tiene: unirlas a mano', v_conflictos;
  END IF;

  RETURN jsonb_build_object(
    'cuentas_creadas',      v_cuentas_creadas,
    'sedes_creadas',        v_sedes_creadas,
    'sedes_actualizadas',   v_sedes_actualizadas,
    'codigos_quitados',     v_codigos_quitados,
    'codigos_puestos',      v_codigos_puestos,
    'sedes_movidas',        v_sedes_movidas,
    'contactos_sin_sede',   v_contactos_sueltos,
    'principales_marcadas', v_principales,
    'ips_sin_nit',          v_sin_nit,
    'codigos_en_conflicto', v_conflictos
  );
END;
$$;

-- Disparador sobre hospitals: sincroniza solo la IPS que cambió (y solo si cambió algo de lo que copia).
CREATE OR REPLACE FUNCTION public.terceros_hospitals_sync_trg()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND (OLD.active, OLD.name, OLD.code, OLD.reps_code, OLD.lat, OLD.lng, OLD.address,
          OLD.municipality_id, OLD.municipality_name)
         IS NOT DISTINCT FROM
         (NEW.active, NEW.name, NEW.code, NEW.reps_code, NEW.lat, NEW.lng, NEW.address,
          NEW.municipality_id, NEW.municipality_name) THEN
    RETURN NULL;
  END IF;
  PERFORM public.terceros_sincronizar_hospitals(NEW.id);
  RETURN NULL;
END;
$$;

-- -------------------------------------------------------------------------------------
-- 7. Seguridad: RLS sin políticas; nada para PUBLIC/anon/authenticated; service_role sí
-- -------------------------------------------------------------------------------------

ALTER TABLE public.cuentas                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sedes                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medicos                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medico_sedes             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medico_visitantes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contactos                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subtipos_institucionales ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.cuentas, public.sedes, public.medicos, public.medico_sedes, public.medico_visitantes,
                    public.contactos, public.subtipos_institucionales
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.cuentas, public.sedes, public.medicos, public.medico_sedes, public.medico_visitantes,
           public.contactos, public.subtipos_institucionales
  TO service_role;

REVOKE ALL ON FUNCTION public.terceros_crear_medico(jsonb, jsonb, uuid)  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.terceros_sincronizar_hospitals(uuid)       FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.terceros_hospitals_sync_trg()              FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.terceros_medico_requiere_sede()            FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.terceros_contacto_sede_de_la_cuenta()      FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.terceros_crear_medico(jsonb, jsonb, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.terceros_sincronizar_hospitals(uuid)      TO service_role;

-- -------------------------------------------------------------------------------------
-- 8. Documentación en el catálogo
-- -------------------------------------------------------------------------------------

COMMENT ON TABLE public.cuentas IS
  'Terceros-organización (app de visita, F1): clínicas, consultorios, EPS, operadores logísticos y otras, una fila '
  'por identificación (UNIQUE tipo + número; NIT a 9 dígitos sin DV como hospitals.nit). Una cuenta puede ser '
  'clínica y cliente a la vez (clase + es_cliente). origen hospitals = creada por terceros_sincronizar_hospitals '
  'para el NIT de IPS activas de OpMap; manual = creada en /terceros. Contrato: docs/fases/fase6-visitas-f1-terceros.md. '
  'Solo service_role.';
COMMENT ON COLUMN public.cuentas.numero_identificacion IS
  'NIT (9 dígitos sin DV) o documento del profesional de un consultorio. El de un consultorio con CC/CE/PA solo se '
  'muestra con terceros:manage.';
COMMENT ON COLUMN public.cuentas.codigo_prestador IS
  'Código de prestador del REPS (10 dígitos) si lo tiene; en las cuentas cargadas desde hospitals, el más frecuente '
  'de reps_sedes para el NIT.';
COMMENT ON COLUMN public.cuentas.modalidad_facturacion IS
  'Solo EPS: directa | via_clinica (a través de la clínica). NULL en las demás clases (CHECK).';

COMMENT ON TABLE public.sedes IS
  'Lugares de cada cuenta, con una sola principal (sedes_una_principal_uidx). Las IPS activas de hospitals se cargan '
  'aquí por NIT (origen hospitals, hospital_id) y las mantiene terceros_sincronizar_hospitals (disparador '
  'hospitals_terceros_sync): nombre, dirección, municipio, ciudad, lat/lng, ubicacion_confirmada, reps_code y '
  'activo vienen de la IPS y se editan en la ficha de la IPS, no aquí. Las sedes manuales o de la app NO entran a '
  'hospitals (no mueven zonas, mapa ni rutas). Solo service_role.';
COMMENT ON COLUMN public.sedes.reps_code IS
  'Código de habilitación del REPS (12 dígitos), UNIQUE: llave contra sedes repetidas.';
COMMENT ON COLUMN public.sedes.hospital_id IS
  'IPS de OpMap que ES esta sede (UNIQUE). NULL en consultorios y sedes nuevas.';
COMMENT ON COLUMN public.sedes.ubicacion_confirmada IS
  'true en las IPS de OpMap con coordenadas válidas; las sedes nuevas nacen en false hasta que alguien con '
  'terceros:manage las confirma.';

COMMENT ON TABLE public.medicos IS
  'Médicos completos o no se crean: documento, nombre, al menos una especialidad, municipio y al menos una sede '
  '(medicos_requiere_sede, diferido al cierre de la transacción; se crean con terceros_crear_medico). Documento '
  'repetido → 23505 medicos_documento_key. Solo service_role.';
COMMENT ON COLUMN public.medicos.numero_documento IS
  'Dato protegido: solo lo ve quien tiene terceros:manage; nunca sale en listas, exportaciones ni voz.';

COMMENT ON TABLE public.medico_sedes IS
  'Sedes donde atiende cada médico: rol consultorio | atiende; una sola principal por médico. No se puede quitar la '
  'última sede de un médico activo (medico_sedes_requiere_sede). Solo service_role.';

COMMENT ON TABLE public.medico_visitantes IS
  'Ejecutivas Comerciales que visitan a cada médico, cada una por una línea y opcionalmente una ciudad (dos de la '
  'misma línea en ciudades distintas sí). Se terminan con hasta, nunca se borran. Un visitante vigente por '
  '(médico, ejecutiva, línea, ciudad). Solo service_role.';

COMMENT ON TABLE public.contactos IS
  'Personas de una cuenta (y, si aplica, de una de sus sedes: contactos_sede_de_la_cuenta), con cargo escrito y rol; '
  'el rol sugiere el subtipo de visita institucional. Solo service_role.';

COMMENT ON TABLE public.subtipos_institucionales IS
  'Subtipos de visita institucional. Semilla 0800 (vigente desde 2026-10-12): compras, quimico_farmaceutico, '
  'autorizaciones, programacion, otro. Un subtipo se apaga cerrando vigente_hasta, nunca se borra. Solo service_role.';

COMMENT ON FUNCTION public.terceros_crear_medico(jsonb, jsonb, uuid) IS
  'Crea un médico y sus medico_sedes en una sola transacción (la API la usa porque PostgREST no tiene '
  'transacciones). 23514 si p_sedes no trae al menos una sede; principal = la primera marcada o la primera. '
  'SECURITY INVOKER; solo service_role.';
COMMENT ON FUNCTION public.terceros_sincronizar_hospitals(uuid) IS
  'Idempotente. Sin argumento: todas las IPS; con un id: esa IPS (disparador hospitals_terceros_sync). Toda IPS '
  'activa de hospitals con NIT tiene su sede (origen hospitals) en la cuenta de su NIT, que crea si falta; copia '
  'nombre, dirección, municipio, ciudad, coordenadas, código de habilitación y activo; nunca borra. Devuelve un '
  'jsonb con lo que hizo. SECURITY INVOKER; solo service_role.';
COMMENT ON FUNCTION public.terceros_hospitals_sync_trg() IS
  'Disparador AFTER INSERT OR UPDATE OF active, name, code, reps_code, lat, lng, address, municipality_id, '
  'municipality_name ON hospitals: terceros_sincronizar_hospitals(NEW.id). No recalcula asignaciones ni llama a Google.';
COMMENT ON FUNCTION public.terceros_medico_requiere_sede() IS
  'Constraint triggers diferidos medicos_requiere_sede y medico_sedes_requiere_sede: un médico activo sin sede se '
  'rechaza al cerrar la transacción (23514).';
COMMENT ON FUNCTION public.terceros_contacto_sede_de_la_cuenta() IS
  'Disparador contactos_sede_de_la_cuenta: la sede de un contacto debe ser de su misma cuenta (23514).';

-- -------------------------------------------------------------------------------------
-- 9. Semilla de subtipos (igual que SUBTIPOS_SEMILLA de web/lib/terceros.ts) y carga inicial desde hospitals
-- -------------------------------------------------------------------------------------

INSERT INTO public.subtipos_institucionales (codigo, nombre, para_que, roles_sugeridos, orden, vigente_desde)
VALUES
  ('compras', 'Compras', 'Que nos compren: precio, condiciones, contrato',
   ARRAY['compras', 'gerencia', 'direccion_medica'], 1, DATE '2026-10-12'),
  ('quimico_farmaceutico', 'Químico farmacéutico', 'Que acepten y codifiquen el producto',
   ARRAY['quimico_farmaceutico', 'almacen_farmacia'], 2, DATE '2026-10-12'),
  ('autorizaciones', 'Autorizaciones', 'Que la EPS acepte y autorice el producto o el procedimiento',
   ARRAY['autorizaciones', 'auditoria_medica'], 3, DATE '2026-10-12'),
  ('programacion', 'Programación', 'Que programen al paciente',
   ARRAY['programacion_cirugia', 'quirofano', 'esterilizacion', 'instrumentacion'], 4, DATE '2026-10-12'),
  ('otro', 'Otro', 'Lo que aparezca',
   ARRAY['otro'], 5, DATE '2026-10-12')
ON CONFLICT (codigo) DO NOTHING;

DO $$
DECLARE
  v_resultado jsonb;
BEGIN
  v_resultado := public.terceros_sincronizar_hospitals();
  RAISE NOTICE '0800 Terceros: carga inicial desde hospitals: %', v_resultado;
END;
$$;

-- El disparador se crea DESPUÉS de la carga inicial.
CREATE OR REPLACE TRIGGER hospitals_terceros_sync
  AFTER INSERT OR UPDATE OF active, name, code, reps_code, lat, lng, address, municipality_id, municipality_name
  ON public.hospitals
  FOR EACH ROW EXECUTE FUNCTION public.terceros_hospitals_sync_trg();

-- -------------------------------------------------------------------------------------
-- 10. Comprobaciones (aborta la transacción si algo no cuadra). Las pruebas que escriben van en sub-bloques que
--     terminan con RAISE SQLSTATE 'P0800': PL/pgSQL deshace todo lo del sub-bloque (no queda ni cambia ninguna
--     fila). Cualquier otra excepción sale del bloque y aborta la migración.
-- -------------------------------------------------------------------------------------

DO $$
DECLARE
  v_tablas      constant text[] := ARRAY['cuentas', 'sedes', 'medicos', 'medico_sedes', 'medico_visitantes',
                                         'contactos', 'subtipos_institucionales'];
  v_fn_service  constant text[] := ARRAY['public.terceros_crear_medico(jsonb, jsonb, uuid)',
                                         'public.terceros_sincronizar_hospitals(uuid)'];
  v_fn_internas constant text[] := ARRAY['public.terceros_hospitals_sync_trg()',
                                         'public.terceros_medico_requiere_sede()',
                                         'public.terceros_contacto_sede_de_la_cuenta()'];
  v_todos_priv  constant text   := 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER';
  v_nit_prueba  constant text   := '999999998';
  v_tabla       text;
  v_fn          text;
  v_n           bigint;
  v_h_ips       bigint;
  v_h_nits      bigint;
  v_h_multi     bigint;
  v_h_sin_nit   bigint;
  v_s_ips       bigint;
  v_c_ips       bigint;
  v_c_multi     bigint;
  v_c_hosp      bigint;
  v_c_manual    bigint;
  v_sin_coord   bigint;
  v_sin_mun     bigint;
  v_res         jsonb;
  v_cuenta      uuid;
  v_cuenta2     uuid;
  v_cuenta_vieja uuid;
  v_sede        uuid;
  v_sede2       uuid;
  v_medico      uuid;
  v_contacto    uuid;
  v_exec        uuid;
  v_linea       uuid;
  v_hosp        uuid;
  v_texto       text;
  v_bool        boolean;
  v_rol_ok      boolean;
  v_princ       bigint;
  v_fecha       date;
  v_probada     boolean := false;
BEGIN
  -- 10.1 Estructura, RLS sin políticas y privilegios de las 7 tablas
  FOREACH v_tabla IN ARRAY v_tablas LOOP
    IF to_regclass('public.' || v_tabla) IS NULL THEN
      RAISE EXCEPTION '0800 Terceros: falta la tabla public.%', v_tabla;
    END IF;
    IF NOT (SELECT c.relrowsecurity FROM pg_class c WHERE c.oid = ('public.' || v_tabla)::regclass) THEN
      RAISE EXCEPTION '0800 Terceros: public.% sin RLS', v_tabla;
    END IF;
    SELECT count(*) INTO v_n FROM pg_policies WHERE schemaname = 'public' AND tablename = v_tabla;
    IF v_n > 0 THEN
      RAISE EXCEPTION '0800 Terceros: public.% tiene % política(s) RLS; debe tener 0', v_tabla, v_n;
    END IF;
    IF has_table_privilege('anon', 'public.' || v_tabla, v_todos_priv)
       OR has_table_privilege('authenticated', 'public.' || v_tabla, v_todos_priv) THEN
      RAISE EXCEPTION '0800 Terceros: anon/authenticated tienen privilegios sobre public.%', v_tabla;
    END IF;
    IF NOT (has_table_privilege('service_role', 'public.' || v_tabla, 'SELECT')
            AND has_table_privilege('service_role', 'public.' || v_tabla, 'INSERT')
            AND has_table_privilege('service_role', 'public.' || v_tabla, 'UPDATE')
            AND has_table_privilege('service_role', 'public.' || v_tabla, 'DELETE')) THEN
      RAISE EXCEPTION '0800 Terceros: service_role no puede leer o escribir public.%', v_tabla;
    END IF;
  END LOOP;

  FOREACH v_fn IN ARRAY v_fn_service || v_fn_internas LOOP
    IF has_function_privilege('anon', v_fn, 'EXECUTE') OR has_function_privilege('authenticated', v_fn, 'EXECUTE') THEN
      RAISE EXCEPTION '0800 Terceros: anon/authenticated pueden ejecutar %', v_fn;
    END IF;
  END LOOP;
  FOREACH v_fn IN ARRAY v_fn_service LOOP
    IF NOT has_function_privilege('service_role', v_fn, 'EXECUTE') THEN
      RAISE EXCEPTION '0800 Terceros: service_role no puede ejecutar %', v_fn;
    END IF;
  END LOOP;

  -- 10.2 Disparadores
  SELECT count(*) INTO v_n FROM pg_trigger t
  WHERE t.tgname IN ('medicos_requiere_sede', 'medico_sedes_requiere_sede')
    AND t.tgconstraint <> 0 AND t.tgdeferrable AND t.tginitdeferred;
  IF v_n <> 2 THEN
    RAISE EXCEPTION '0800 Terceros: faltan los constraint triggers diferidos de médico con sede (hay %)', v_n;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.contactos'::regclass
                 AND tgname = 'contactos_sede_de_la_cuenta' AND NOT tgisinternal) THEN
    RAISE EXCEPTION '0800 Terceros: falta el disparador contactos_sede_de_la_cuenta';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.hospitals'::regclass
                 AND tgname = 'hospitals_terceros_sync' AND NOT tgisinternal) THEN
    RAISE EXCEPTION '0800 Terceros: falta el disparador hospitals_terceros_sync';
  END IF;

  -- 10.3 Carga desde hospitals: conteos DERIVADOS de las IPS activas (no constantes)
  SELECT count(*) FILTER (WHERE h.nit IS NOT NULL), count(DISTINCT h.nit), count(*) FILTER (WHERE h.nit IS NULL)
  INTO v_h_ips, v_h_nits, v_h_sin_nit
  FROM public.hospitals h
  WHERE h.active;
  SELECT count(*) INTO v_h_multi
  FROM (SELECT h.nit FROM public.hospitals h WHERE h.active AND h.nit IS NOT NULL
        GROUP BY h.nit HAVING count(*) > 1) x;

  -- Sedes activas de origen hospitals de IPS activas, en la cuenta de su NIT.
  SELECT count(*), count(DISTINCT s.cuenta_id),
         count(DISTINCT s.cuenta_id) FILTER (WHERE c.origen = 'hospitals'),
         count(DISTINCT s.cuenta_id) FILTER (WHERE c.origen <> 'hospitals')
  INTO v_s_ips, v_c_ips, v_c_hosp, v_c_manual
  FROM public.sedes s
  JOIN public.hospitals h ON h.id = s.hospital_id
  JOIN public.cuentas c ON c.id = s.cuenta_id
  WHERE h.active AND h.nit IS NOT NULL AND s.activo AND s.origen = 'hospitals'
    AND c.tipo_identificacion = 'NIT' AND c.numero_identificacion = h.nit;
  SELECT count(*) INTO v_c_multi
  FROM (SELECT s.cuenta_id
        FROM public.sedes s
        JOIN public.hospitals h ON h.id = s.hospital_id
        JOIN public.cuentas c ON c.id = s.cuenta_id
        WHERE h.active AND h.nit IS NOT NULL AND s.activo AND s.origen = 'hospitals'
          AND c.tipo_identificacion = 'NIT' AND c.numero_identificacion = h.nit
        GROUP BY s.cuenta_id HAVING count(*) > 1) x;

  IF v_s_ips <> v_h_ips THEN
    RAISE EXCEPTION '0800 Terceros: % IPS activas con NIT en hospitals y % sedes (origen hospitals) en la cuenta de su NIT',
      v_h_ips, v_s_ips;
  END IF;
  IF v_c_ips <> v_h_nits THEN
    RAISE EXCEPTION '0800 Terceros: % NIT distintos de IPS activas y % cuentas con sus sedes', v_h_nits, v_c_ips;
  END IF;
  IF v_c_multi <> v_h_multi THEN
    RAISE EXCEPTION '0800 Terceros: % NIT con más de una IPS activa y % cuentas con más de una sede de IPS',
      v_h_multi, v_c_multi;
  END IF;
  IF v_c_manual > 0 THEN
    RAISE WARNING '0800 Terceros: % cuenta(s) creadas a mano (origen manual) tienen sedes de IPS de OpMap de su mismo NIT', v_c_manual;
  END IF;
  -- Ninguna sede de una IPS inactiva queda activa.
  SELECT count(*) INTO v_n FROM public.sedes s JOIN public.hospitals h ON h.id = s.hospital_id
  WHERE s.activo AND NOT coalesce(h.active, false);
  IF v_n > 0 THEN
    RAISE EXCEPTION '0800 Terceros: % sede(s) activas de IPS inactivas', v_n;
  END IF;
  -- Foto del contrato (2026-10-12): 703 cuentas, 783 sedes, 47 cuentas con más de una sede.
  IF (v_c_hosp, v_s_ips, v_c_multi) IS DISTINCT FROM (703::bigint, 783::bigint, 47::bigint) THEN
    RAISE WARNING '0800 Terceros: el contrato esperaba 703 cuentas / 783 sedes / 47 cuentas con más de una sede; hoy hospitals da % / % / % (cuadra con hospitals; revisar si cambió)',
      v_c_hosp, v_s_ips, v_c_multi;
  END IF;
  IF v_h_sin_nit > 0 THEN
    RAISE WARNING '0800 Terceros: % IPS activa(s) sin NIT legible en hospitals.code: quedan sin sede', v_h_sin_nit;
  END IF;
  SELECT count(*) FILTER (WHERE NOT s.ubicacion_confirmada), count(*) FILTER (WHERE s.municipality_id IS NULL)
  INTO v_sin_coord, v_sin_mun
  FROM public.sedes s JOIN public.hospitals h ON h.id = s.hospital_id
  WHERE h.active;
  IF v_sin_coord > 0 THEN
    RAISE WARNING '0800 Terceros: % sede(s) de IPS sin coordenadas válidas en Colombia (lat/lng NULL, sin confirmar)', v_sin_coord;
  END IF;
  IF v_sin_mun > 0 THEN
    RAISE WARNING '0800 Terceros: % sede(s) de IPS sin municipality_id de 5 dígitos', v_sin_mun;
  END IF;

  -- 10.4 Principal: una sola por cuenta; toda cuenta con sedes activas tiene la suya; en las cuentas creadas en
  --      esta transacción (created_at = now()), la de más camas con desempate por nombre.
  SELECT count(*) INTO v_n
  FROM (SELECT s.cuenta_id FROM public.sedes s WHERE s.es_principal GROUP BY s.cuenta_id HAVING count(*) > 1) x;
  IF v_n > 0 THEN
    RAISE EXCEPTION '0800 Terceros: % cuenta(s) con más de una sede principal', v_n;
  END IF;
  SELECT count(*) INTO v_n
  FROM public.cuentas c
  WHERE EXISTS (SELECT 1 FROM public.sedes s WHERE s.cuenta_id = c.id AND s.activo)
    AND NOT EXISTS (SELECT 1 FROM public.sedes s WHERE s.cuenta_id = c.id AND s.es_principal);
  IF v_n > 0 THEN
    RAISE EXCEPTION '0800 Terceros: % cuenta(s) con sedes activas y sin sede principal', v_n;
  END IF;
  SELECT count(*) INTO v_n
  FROM public.cuentas c
  JOIN public.sedes p ON p.cuenta_id = c.id AND p.es_principal
  CROSS JOIN LATERAL (
    SELECT s.id
    FROM public.sedes s
    LEFT JOIN public.hospitals h ON h.id = s.hospital_id
    WHERE s.cuenta_id = c.id AND s.activo
    ORDER BY h.beds DESC NULLS LAST, s.nombre, s.id
    LIMIT 1
  ) e
  WHERE c.origen = 'hospitals' AND c.created_at = now() AND p.id <> e.id;
  IF v_n > 0 THEN
    RAISE EXCEPTION '0800 Terceros: en % cuenta(s) cargadas la principal no es la sede con más camas', v_n;
  END IF;

  -- 10.5 Idempotencia: una segunda pasada no cambia nada
  v_res := public.terceros_sincronizar_hospitals();
  IF (v_res ->> 'cuentas_creadas')::int + (v_res ->> 'sedes_creadas')::int + (v_res ->> 'sedes_actualizadas')::int
     + (v_res ->> 'codigos_quitados')::int + (v_res ->> 'codigos_puestos')::int + (v_res ->> 'sedes_movidas')::int
     + (v_res ->> 'principales_marcadas')::int <> 0 THEN
    RAISE EXCEPTION '0800 Terceros: la sincronización no es idempotente; la segunda pasada hizo: %', v_res;
  END IF;

  -- 10.6 Semilla de subtipos
  SELECT count(*) INTO v_n FROM public.subtipos_institucionales
  WHERE codigo IN ('compras', 'quimico_farmaceutico', 'autorizaciones', 'programacion', 'otro');
  IF v_n <> 5 THEN
    RAISE EXCEPTION '0800 Terceros: faltan subtipos de la semilla (hay % de 5)', v_n;
  END IF;
  SELECT count(*) INTO v_n
  FROM public.subtipos_institucionales s
  JOIN (VALUES ('compras',              ARRAY['compras', 'gerencia', 'direccion_medica']),
               ('quimico_farmaceutico', ARRAY['quimico_farmaceutico', 'almacen_farmacia']),
               ('autorizaciones',       ARRAY['autorizaciones', 'auditoria_medica']),
               ('programacion',         ARRAY['programacion_cirugia', 'quirofano', 'esterilizacion', 'instrumentacion']),
               ('otro',                 ARRAY['otro'])) AS e(codigo, roles)
    ON e.codigo = s.codigo
  WHERE s.roles_sugeridos @> e.roles::text[] AND s.roles_sugeridos <@ e.roles::text[];
  IF v_n <> 5 THEN
    RAISE WARNING '0800 Terceros: % de 5 subtipos de la semilla tienen roles_sugeridos distintos a los de la semilla (¿editados?)', 5 - v_n;
  END IF;

  -- 10.7 Restricciones, unicidades y reglas con filas de prueba (todo se deshace)
  IF EXISTS (SELECT 1 FROM public.cuentas WHERE tipo_identificacion = 'otro' AND numero_identificacion LIKE 'PRUEBA0800%')
     OR EXISTS (SELECT 1 FROM public.medicos WHERE tipo_documento = 'otro' AND numero_documento LIKE 'PRUEBA0800%') THEN
    RAISE EXCEPTION '0800 Terceros: ya hay datos con la identificación de prueba PRUEBA0800…; no se puede probar';
  END IF;

  BEGIN
    INSERT INTO public.cuentas (nombre, clase, tipo_identificacion, numero_identificacion)
    VALUES ('Consultorio de prueba 0800', 'consultorio', 'otro', 'PRUEBA0800A') RETURNING id INTO v_cuenta;
    INSERT INTO public.cuentas (nombre, clase, tipo_identificacion, numero_identificacion)
    VALUES ('Cuenta de prueba 0800', 'otra', 'otro', 'PRUEBA0800B') RETURNING id INTO v_cuenta2;
    INSERT INTO public.sedes (cuenta_id, nombre, es_principal, municipality_id, lat, lng)
    VALUES (v_cuenta, 'Sede de prueba 0800', true, '11001', 4.711000, -74.072000) RETURNING id INTO v_sede;
    INSERT INTO public.sedes (cuenta_id, nombre, es_principal)
    VALUES (v_cuenta2, 'Sede de prueba 0800 B', true) RETURNING id INTO v_sede2;

    -- Cuentas
    BEGIN
      INSERT INTO public.cuentas (nombre, clase, tipo_identificacion, numero_identificacion)
      VALUES ('Repetida', 'otra', 'otro', 'PRUEBA0800A');
      RAISE EXCEPTION '0800 Terceros: se aceptó una cuenta con identificación repetida';
    EXCEPTION WHEN unique_violation THEN NULL;
    END;
    SELECT c.numero_identificacion INTO v_texto FROM public.cuentas c
    WHERE c.tipo_identificacion = 'NIT' ORDER BY c.numero_identificacion LIMIT 1;
    IF v_texto IS NOT NULL THEN
      BEGIN
        INSERT INTO public.cuentas (nombre, clase, tipo_identificacion, numero_identificacion)
        VALUES ('NIT repetido', 'clinica', 'NIT', v_texto);
        RAISE EXCEPTION '0800 Terceros: se aceptó una segunda cuenta con el NIT %', v_texto;
      EXCEPTION WHEN unique_violation THEN NULL;
      END;
    END IF;
    BEGIN
      INSERT INTO public.cuentas (nombre, clase, tipo_identificacion, numero_identificacion)
      VALUES ('NIT con DV', 'clinica', 'NIT', '9001234567');
      RAISE EXCEPTION '0800 Terceros: se aceptó un NIT de 10 dígitos';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
      INSERT INTO public.cuentas (nombre, clase, tipo_identificacion, numero_identificacion)
      VALUES ('Minúsculas', 'otra', 'otro', 'prueba0800c');
      RAISE EXCEPTION '0800 Terceros: se aceptó una identificación con minúsculas';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
      INSERT INTO public.cuentas (nombre, clase, tipo_identificacion, numero_identificacion)
      VALUES ('Clase rara', 'hospital', 'otro', 'PRUEBA0800C');
      RAISE EXCEPTION '0800 Terceros: se aceptó una clase de cuenta fuera de la lista';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
      INSERT INTO public.cuentas (nombre, clase, tipo_identificacion, numero_identificacion)
      VALUES (' X ', 'otra', 'otro', 'PRUEBA0800C');
      RAISE EXCEPTION '0800 Terceros: se aceptó una cuenta con nombre de una letra';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
      UPDATE public.cuentas SET modalidad_facturacion = 'directa' WHERE id = v_cuenta;
      RAISE EXCEPTION '0800 Terceros: se aceptó modalidad de facturación en una cuenta que no es EPS';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    UPDATE public.cuentas SET clase = 'eps', modalidad_facturacion = 'via_clinica' WHERE id = v_cuenta2;  -- EPS: sí
    UPDATE public.cuentas SET clase = 'otra', modalidad_facturacion = NULL WHERE id = v_cuenta2;

    -- Sedes
    BEGIN
      INSERT INTO public.sedes (cuenta_id, nombre, es_principal) VALUES (v_cuenta, 'Otra principal', true);
      RAISE EXCEPTION '0800 Terceros: se aceptó una segunda sede principal en la misma cuenta';
    EXCEPTION WHEN unique_violation THEN NULL;
    END;
    SELECT s.reps_code INTO v_texto FROM public.sedes s WHERE s.reps_code IS NOT NULL ORDER BY s.reps_code LIMIT 1;
    IF v_texto IS NOT NULL THEN
      BEGIN
        INSERT INTO public.sedes (cuenta_id, nombre, reps_code) VALUES (v_cuenta, 'Código repetido', v_texto);
        RAISE EXCEPTION '0800 Terceros: se aceptó una sede con el código de habilitación repetido %', v_texto;
      EXCEPTION WHEN unique_violation THEN NULL;
      END;
    END IF;
    SELECT s.hospital_id INTO v_hosp FROM public.sedes s WHERE s.hospital_id IS NOT NULL ORDER BY s.hospital_id LIMIT 1;
    IF v_hosp IS NOT NULL THEN
      BEGIN
        INSERT INTO public.sedes (cuenta_id, nombre, hospital_id) VALUES (v_cuenta, 'IPS repetida', v_hosp);
        RAISE EXCEPTION '0800 Terceros: se aceptó una segunda sede para la misma IPS de OpMap';
      EXCEPTION WHEN unique_violation THEN NULL;
      END;
    END IF;
    BEGIN
      INSERT INTO public.sedes (cuenta_id, nombre, reps_code) VALUES (v_cuenta, 'Código corto', '12345678901');
      RAISE EXCEPTION '0800 Terceros: se aceptó un código de habilitación de 11 dígitos';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
      INSERT INTO public.sedes (cuenta_id, nombre, lat) VALUES (v_cuenta, 'Solo latitud', 4.7);
      RAISE EXCEPTION '0800 Terceros: se aceptó una sede con lat y sin lng';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
      INSERT INTO public.sedes (cuenta_id, nombre, lat, lng) VALUES (v_cuenta, 'Fuera de Colombia', 40.4, -3.7);
      RAISE EXCEPTION '0800 Terceros: se aceptó una sede fuera de Colombia';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
      INSERT INTO public.sedes (cuenta_id, nombre, origen) VALUES (v_cuenta, 'Origen raro', 'vmo');
      RAISE EXCEPTION '0800 Terceros: se aceptó un origen de sede fuera de la lista';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    -- Médico sin sede: rechazado al cerrar la transacción (aquí, al forzar el chequeo con SET CONSTRAINTS)
    BEGIN
      INSERT INTO public.medicos (tipo_documento, numero_documento, nombre, especialidades, municipality_id)
      VALUES ('otro', 'PRUEBA0800X', 'Médico sin sede', ARRAY['ortopedia'], '11001');
      SET CONSTRAINTS public.medicos_requiere_sede, public.medico_sedes_requiere_sede IMMEDIATE;
      RAISE EXCEPTION '0800 Terceros: se aceptó un médico activo sin sede';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    SET CONSTRAINTS public.medicos_requiere_sede, public.medico_sedes_requiere_sede DEFERRED;

    -- terceros_crear_medico: sin sedes falla
    BEGIN
      PERFORM public.terceros_crear_medico(
        jsonb_build_object('tipo_documento', 'otro', 'numero_documento', 'PRUEBA0800Y', 'nombre', 'Médico de prueba',
                           'especialidades', jsonb_build_array('ortopedia'), 'municipality_id', '11001'),
        '[]'::jsonb, NULL);
      RAISE EXCEPTION '0800 Terceros: terceros_crear_medico aceptó un médico sin sedes ([])';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
      PERFORM public.terceros_crear_medico(
        jsonb_build_object('tipo_documento', 'otro', 'numero_documento', 'PRUEBA0800Y', 'nombre', 'Médico de prueba',
                           'especialidades', jsonb_build_array('ortopedia'), 'municipality_id', '11001'),
        NULL, NULL);
      RAISE EXCEPTION '0800 Terceros: terceros_crear_medico aceptó un médico sin sedes (NULL)';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    -- terceros_crear_medico: con dos sedes (de cuentas distintas) crea médico y vínculos; principal = la primera
    v_medico := public.terceros_crear_medico(
      jsonb_build_object('tipo_documento', 'otro', 'numero_documento', 'PRUEBA0800M',
                         'nombre', 'Médico de prueba 0800', 'especialidades', jsonb_build_array('ortopedia', 'columna'),
                         'municipality_id', '11001', 'telefono', ' '),
      jsonb_build_array(jsonb_build_object('sede_id', v_sede, 'rol', 'consultorio'),
                        jsonb_build_object('sede_id', v_sede2, 'rol', 'atiende'),
                        jsonb_build_object('sede_id', v_sede2, 'rol', 'consultorio')),  -- repetida: cuenta la primera
      NULL);
    SET CONSTRAINTS public.medicos_requiere_sede, public.medico_sedes_requiere_sede IMMEDIATE;  -- debe pasar
    SET CONSTRAINTS public.medicos_requiere_sede, public.medico_sedes_requiere_sede DEFERRED;
    SELECT count(*), count(*) FILTER (WHERE ms.principal), bool_and(ms.principal = (ms.sede_id = v_sede)),
           bool_or(ms.sede_id = v_sede2 AND ms.rol = 'atiende')
    INTO v_n, v_princ, v_bool, v_rol_ok
    FROM public.medico_sedes ms WHERE ms.medico_id = v_medico;
    IF v_n <> 2 OR v_princ <> 1 OR NOT v_bool OR NOT v_rol_ok THEN
      RAISE EXCEPTION '0800 Terceros: terceros_crear_medico debía dejar 2 sedes (principal la primera, la repetida una vez con su primer rol); dejó % (principales %)',
        v_n, v_princ;
    END IF;
    IF (SELECT m.telefono FROM public.medicos m WHERE m.id = v_medico) IS NOT NULL THEN
      RAISE EXCEPTION '0800 Terceros: terceros_crear_medico guardó un teléfono vacío';
    END IF;
    BEGIN
      PERFORM public.terceros_crear_medico(
        jsonb_build_object('tipo_documento', 'otro', 'numero_documento', 'PRUEBA0800M', 'nombre', 'Mismo documento',
                           'especialidades', jsonb_build_array('fisiatria'), 'municipality_id', '05001'),
        jsonb_build_array(jsonb_build_object('sede_id', v_sede, 'rol', 'atiende')), NULL);
      RAISE EXCEPTION '0800 Terceros: se aceptó un segundo médico con el mismo documento';
    EXCEPTION WHEN unique_violation THEN NULL;
    END;
    BEGIN
      INSERT INTO public.medicos (tipo_documento, numero_documento, nombre, especialidades, municipality_id)
      VALUES ('otro', 'PRUEBA0800E', 'Especialidad rara', ARRAY['cardiologia'], '11001');
      RAISE EXCEPTION '0800 Terceros: se aceptó una especialidad fuera de la lista';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
      INSERT INTO public.medicos (tipo_documento, numero_documento, nombre, especialidades, municipality_id)
      VALUES ('otro', 'PRUEBA0800E', 'Sin especialidad', ARRAY[]::text[], '11001');
      RAISE EXCEPTION '0800 Terceros: se aceptó un médico sin especialidades';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
      INSERT INTO public.medicos (tipo_documento, numero_documento, nombre, especialidades, municipality_id)
      VALUES ('CC', '79.123.456', 'Documento con puntos', ARRAY['ortopedia'], '11001');
      RAISE EXCEPTION '0800 Terceros: se aceptó un documento sin normalizar';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
      UPDATE public.medico_sedes SET principal = true WHERE medico_id = v_medico AND sede_id = v_sede2;
      RAISE EXCEPTION '0800 Terceros: se aceptó una segunda sede principal para el mismo médico';
    EXCEPTION WHEN unique_violation THEN NULL;
    END;
    BEGIN
      UPDATE public.medico_sedes SET rol = 'opera' WHERE medico_id = v_medico AND sede_id = v_sede2;
      RAISE EXCEPTION '0800 Terceros: se aceptó un rol de médico en sede fuera de la lista';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    -- Quitar la última sede de un médico activo: rechazado
    BEGIN
      DELETE FROM public.medico_sedes WHERE medico_id = v_medico;
      SET CONSTRAINTS public.medicos_requiere_sede, public.medico_sedes_requiere_sede IMMEDIATE;
      RAISE EXCEPTION '0800 Terceros: se aceptó dejar a un médico activo sin sedes';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    SET CONSTRAINTS public.medicos_requiere_sede, public.medico_sedes_requiere_sede DEFERRED;
    -- Quitar una de dos: sí
    DELETE FROM public.medico_sedes WHERE medico_id = v_medico AND sede_id = v_sede2;
    SET CONSTRAINTS public.medicos_requiere_sede, public.medico_sedes_requiere_sede IMMEDIATE;
    SET CONSTRAINTS public.medicos_requiere_sede, public.medico_sedes_requiere_sede DEFERRED;
    -- Una sede con médicos no se borra (ON DELETE RESTRICT)
    BEGIN
      DELETE FROM public.sedes WHERE id = v_sede;
      RAISE EXCEPTION '0800 Terceros: se borró una sede con médicos';
    EXCEPTION WHEN foreign_key_violation THEN NULL;
    END;

    -- Visitantes (si hay al menos una ejecutiva y una línea)
    SELECT e.id INTO v_exec FROM public.executives e ORDER BY e.id LIMIT 1;
    SELECT b.id INTO v_linea FROM public.business_lines b ORDER BY b.id LIMIT 1;
    IF v_exec IS NOT NULL AND v_linea IS NOT NULL THEN
      INSERT INTO public.medico_visitantes (medico_id, executive_id, line_id)
      VALUES (v_medico, v_exec, v_linea) RETURNING desde INTO v_fecha;
      IF v_fecha <> (now() AT TIME ZONE 'America/Bogota')::date THEN
        RAISE EXCEPTION '0800 Terceros: medico_visitantes.desde no es la fecha de hoy en Bogotá (%)', v_fecha;
      END IF;
      BEGIN
        INSERT INTO public.medico_visitantes (medico_id, executive_id, line_id) VALUES (v_medico, v_exec, v_linea);
        RAISE EXCEPTION '0800 Terceros: se aceptó un visitante vigente repetido';
      EXCEPTION WHEN unique_violation THEN NULL;
      END;
      -- Misma ejecutiva y línea en otra ciudad: sí
      INSERT INTO public.medico_visitantes (medico_id, executive_id, line_id, municipality_id)
      VALUES (v_medico, v_exec, v_linea, '08001');
      BEGIN
        INSERT INTO public.medico_visitantes (medico_id, executive_id, line_id, municipality_id, desde, hasta)
        VALUES (v_medico, v_exec, v_linea, '05001', DATE '2026-10-12', DATE '2026-10-11');
        RAISE EXCEPTION '0800 Terceros: se aceptó un visitante con hasta antes de desde';
      EXCEPTION WHEN check_violation THEN NULL;
      END;
      -- Terminado (hasta) libera el cupo: se puede volver a asignar
      UPDATE public.medico_visitantes SET hasta = desde
      WHERE medico_id = v_medico AND municipality_id IS NULL AND hasta IS NULL;
      INSERT INTO public.medico_visitantes (medico_id, executive_id, line_id) VALUES (v_medico, v_exec, v_linea);
    ELSE
      RAISE NOTICE '0800 Terceros: sin ejecutivas o líneas; no se probaron los visitantes';
    END IF;

    -- Contactos
    INSERT INTO public.contactos (cuenta_id, sede_id, nombre) VALUES (v_cuenta, v_sede, 'Contacto de prueba')
    RETURNING id, rol INTO v_contacto, v_texto;
    IF v_texto <> 'otro' THEN
      RAISE EXCEPTION '0800 Terceros: el rol por defecto de un contacto debe ser otro (fue %)', v_texto;
    END IF;
    BEGIN
      INSERT INTO public.contactos (cuenta_id, sede_id, nombre) VALUES (v_cuenta, v_sede2, 'Sede ajena');
      RAISE EXCEPTION '0800 Terceros: se aceptó un contacto con una sede de otra cuenta';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
      UPDATE public.contactos SET sede_id = v_sede2 WHERE id = v_contacto;
      RAISE EXCEPTION '0800 Terceros: se aceptó cambiar un contacto a una sede de otra cuenta';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
      INSERT INTO public.contactos (cuenta_id, nombre, rol) VALUES (v_cuenta, 'Rol raro', 'cirujano');
      RAISE EXCEPTION '0800 Terceros: se aceptó un rol de contacto fuera de la lista';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    -- Subtipos
    BEGIN
      INSERT INTO public.subtipos_institucionales (codigo, nombre, para_que, orden, vigente_desde)
      VALUES ('compras', 'Compras 2', 'Repetido', 9, DATE '2026-10-12');
      RAISE EXCEPTION '0800 Terceros: se aceptó un subtipo con código repetido';
    EXCEPTION WHEN unique_violation THEN NULL;
    END;
    BEGIN
      INSERT INTO public.subtipos_institucionales (codigo, nombre, para_que, roles_sugeridos, orden, vigente_desde)
      VALUES ('prueba_0800', 'Prueba', 'Prueba', ARRAY['cirujano'], 9, DATE '2026-10-12');
      RAISE EXCEPTION '0800 Terceros: se aceptó un subtipo con un rol sugerido que no es rol de contacto';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    RAISE SQLSTATE 'P0800';
  EXCEPTION
    WHEN SQLSTATE 'P0800' THEN NULL;  -- filas de prueba deshechas
  END;
  IF EXISTS (SELECT 1 FROM public.cuentas WHERE tipo_identificacion = 'otro' AND numero_identificacion LIKE 'PRUEBA0800%')
     OR EXISTS (SELECT 1 FROM public.medicos WHERE tipo_documento = 'otro' AND numero_documento LIKE 'PRUEBA0800%') THEN
    RAISE EXCEPTION '0800 Terceros: quedaron filas de prueba';
  END IF;

  -- 10.8 Disparador sobre hospitals con una IPS real (todo se deshace): renombrar, desactivar, reactivar.
  SELECT h.id INTO v_hosp
  FROM public.hospitals h
  JOIN public.sedes s ON s.hospital_id = h.id
  WHERE h.active AND h.nit IS NOT NULL
  ORDER BY length(h.name), h.id
  LIMIT 1;
  IF v_hosp IS NOT NULL THEN
    BEGIN
      UPDATE public.hospitals SET name = name || ' (p0800)' WHERE id = v_hosp;
      SELECT s.nombre INTO v_texto FROM public.sedes s WHERE s.hospital_id = v_hosp;
      IF v_texto NOT LIKE '% (p0800)' THEN
        RAISE EXCEPTION '0800 Terceros: el disparador no copió el nombre nuevo de la IPS a su sede (%)', v_texto;
      END IF;
      UPDATE public.hospitals SET active = false WHERE id = v_hosp;
      IF (SELECT s.activo FROM public.sedes s WHERE s.hospital_id = v_hosp) THEN
        RAISE EXCEPTION '0800 Terceros: desactivar la IPS no desactivó su sede';
      END IF;
      UPDATE public.hospitals SET active = true WHERE id = v_hosp;
      IF NOT (SELECT s.activo FROM public.sedes s WHERE s.hospital_id = v_hosp) THEN
        RAISE EXCEPTION '0800 Terceros: reactivar la IPS no reactivó su sede';
      END IF;
      RAISE SQLSTATE 'P0800';
    EXCEPTION
      WHEN SQLSTATE 'P0800' THEN NULL;  -- cambios de prueba deshechos
    END;
  END IF;

  -- 10.9 Cambio de NIT de una IPS (todo se deshace): la sede pasa a la cuenta del NIT nuevo (creada por el
  --      disparador), su contacto queda sin sede, la cuenta nueva tiene principal y la vieja la conserva si le
  --      quedan sedes activas. Si hospitals rechaza el código de prueba por una regla propia, se avisa y se salta.
  v_probada := false;
  SELECT h.id, s.cuenta_id INTO v_hosp, v_cuenta_vieja
  FROM public.hospitals h
  JOIN public.sedes s ON s.hospital_id = h.id
  WHERE h.active AND h.nit IS NOT NULL
  ORDER BY s.es_principal DESC,
           (SELECT count(*) FROM public.sedes o WHERE o.cuenta_id = s.cuenta_id AND o.activo) DESC,
           h.id
  LIMIT 1;
  IF v_hosp IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.hospitals WHERE nit = v_nit_prueba)
     AND NOT EXISTS (SELECT 1 FROM public.cuentas WHERE tipo_identificacion = 'NIT' AND numero_identificacion = v_nit_prueba) THEN
    RAISE NOTICE '0800 Terceros: prueba de cambio de NIT con la IPS % (se deshace; el WARNING de cambio de NIT que sigue es de la prueba)', v_hosp;
    BEGIN
      SELECT s.id INTO v_sede FROM public.sedes s WHERE s.hospital_id = v_hosp;
      INSERT INTO public.contactos (cuenta_id, sede_id, nombre)
      VALUES (v_cuenta_vieja, v_sede, 'Contacto de prueba 0800') RETURNING id INTO v_contacto;
      BEGIN
        UPDATE public.hospitals SET code = v_nit_prueba || '-0' WHERE id = v_hosp;
        v_probada := true;
      EXCEPTION WHEN check_violation OR unique_violation OR foreign_key_violation THEN
        GET STACKED DIAGNOSTICS v_texto = TABLE_NAME;
        IF v_texto IS DISTINCT FROM 'hospitals' THEN
          RAISE;  -- el error vino de la sincronización, no de hospitals: aborta
        END IF;
        RAISE WARNING '0800 Terceros: hospitals no aceptó el código de prueba (%); no se probó el cambio de NIT', SQLERRM;
      END;
      IF v_probada THEN
        SELECT s.cuenta_id, s.es_principal INTO v_cuenta, v_bool FROM public.sedes s WHERE s.id = v_sede;
        IF NOT EXISTS (SELECT 1 FROM public.cuentas c WHERE c.id = v_cuenta AND c.tipo_identificacion = 'NIT'
                       AND c.numero_identificacion = v_nit_prueba AND c.origen = 'hospitals' AND c.clase = 'clinica') THEN
          RAISE EXCEPTION '0800 Terceros: al cambiar de NIT, la sede no pasó a una cuenta nueva del NIT %', v_nit_prueba;
        END IF;
        IF NOT v_bool THEN
          RAISE EXCEPTION '0800 Terceros: la única sede de la cuenta nueva debía quedar como principal';
        END IF;
        IF (SELECT c.sede_id FROM public.contactos c WHERE c.id = v_contacto) IS NOT NULL THEN
          RAISE EXCEPTION '0800 Terceros: el contacto de la cuenta vieja siguió apuntando a la sede movida';
        END IF;
        IF EXISTS (SELECT 1 FROM public.sedes s WHERE s.cuenta_id = v_cuenta_vieja AND s.activo)
           AND NOT EXISTS (SELECT 1 FROM public.sedes s WHERE s.cuenta_id = v_cuenta_vieja AND s.es_principal) THEN
          RAISE EXCEPTION '0800 Terceros: la cuenta vieja se quedó sin principal teniendo sedes activas';
        END IF;
      END IF;
      RAISE SQLSTATE 'P0800';
    EXCEPTION
      WHEN SQLSTATE 'P0800' THEN NULL;  -- cambios de prueba deshechos
    END;
  END IF;
  IF EXISTS (SELECT 1 FROM public.cuentas WHERE tipo_identificacion = 'NIT' AND numero_identificacion = v_nit_prueba)
     OR EXISTS (SELECT 1 FROM public.contactos WHERE nombre = 'Contacto de prueba 0800') THEN
    RAISE EXCEPTION '0800 Terceros: quedaron filas de la prueba de cambio de NIT';
  END IF;

  RAISE NOTICE '0800 Terceros OK: % cuentas (% origen hospitals) y % sedes de IPS activas, % cuentas con más de una sede (hospitals: % NIT, % IPS activas con NIT, % NIT con varias IPS); una principal por cuenta.',
    v_c_ips, v_c_hosp, v_s_ips, v_c_multi, v_h_nits, v_h_ips, v_h_multi;
  RAISE NOTICE '0800 Terceros OK: 7 tablas con RLS sin políticas y solo service_role; sincronización idempotente; restricciones y unicidades probadas; médico sin sede rechazado; terceros_crear_medico sin sedes rechazado; disparador de hospitals probado (cambio de NIT probado: %).',
    v_probada;
END;
$$;

COMMIT;
