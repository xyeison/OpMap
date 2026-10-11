-- =====================================================================================
-- OpMap · Bogotá hacia afuera: una ciudad, cuatro corredores · 0700 — Esquema y semilla
-- Proyecto: norvxqgohddgsdkggqzq · Generado: 2026-10-11
--
-- Autorización del dueño (2026-10-11): "Autorizo todo. Procede." Spec aprobada:
--   docs/specs/2026-10-11-bogota-corredores.md. Decisión: docs/decisiones/2026-10-11-bogota-corredores.md.
--
-- Es ADITIVA: 2 tablas nuevas y 1 columna nueva (NULL) en assignments. No cambia ninguna asignación
-- ni kams.max_travel_time (eso lo decide el dueño al ver la simulación en /kams y recalcular).
--
-- Qué crea:
--   1. bogota_config      : una sola fila (id = 1). k = en cuántas celdas se reparte el cupo de Bogotá
--                           hacia afuera (1..4), max_travel_minutes = tope ÚNICO de Bogotá hacia afuera
--                           (ignora kams.max_travel_time de las celdas), grupos = corredor → kam_id de
--                           la celda que recibe ese corredor. Con k = 2 dos corredores apuntan a la
--                           misma celda; con k = 1, los cuatro.
--   2. bogota_corredores  : corredor de salida de Bogotá por departamento (municipality_code NULL) o
--                           por municipio (excepción). Resolución: primero la fila del municipio de la
--                           IPS; si no, la del departamento; si no, la IPS no tiene corredor (se asigna
--                           a la celda con menor tiempo real y la simulación la lista).
--   3. assignments.detail : jsonb NULL. Para assignment_type = 'bogota_corredor':
--                           {"corredor":"norte","bogota_min_segundos":12345,"celda_min":"<kam_id>"}.
--   4. assignment_type 'bogota_corredor': la columna NO tiene CHECK hoy (comprobado con SELECT); si
--                           alguien lo hubiera creado, el bloque 4 lo amplía conservando sus valores.
--   Tablas nuevas con RLS activado, SIN políticas, sin privilegios para anon/authenticated/PUBLIC y
--   GRANT explícito a service_role. Bloque DO final que comprueba todo y aborta si no cuadra.
--
-- Semilla de corredores (lista completa y razones en docs/algoritmo-asignacion.md, sección
-- "Bogotá hacia afuera: una ciudad, cuatro corredores"):
--   norte     : 15 Boyacá, 68 Santander, 54 Norte de Santander, 20 Cesar, 44 La Guajira, 47 Magdalena,
--               08 Atlántico, 13 Bolívar, 70 Sucre, 23 Córdoba.
--   occidente : 73 Tolima, 17 Caldas, 66 Risaralda, 63 Quindío, 05 Antioquia, 76 Valle, 19 Cauca, 52 Nariño.
--   sur       : 41 Huila, 18 Caquetá, 86 Putumayo.
--   oriente   : 50 Meta, 85 Casanare (el dueño puede pasarlo a norte), 81 Arauca, 95 Guaviare,
--               99 Vichada, 97 Vaupés, 94 Guainía, 91 Amazonas.
--   Cundinamarca (25) por municipio según su provincia (116 municipios, uno por fila):
--     norte     : Sabana Centro, Ubaté, Almeidas, Guavio norte (Guasca, Guatavita) y La Calera.
--     occidente : Sabana Occidente, Gualivá, Rionegro, Magdalena Centro, Bajo Magdalena.
--     sur       : Soacha, Sumapaz, Alto Magdalena, Tequendama.
--     oriente   : Oriente, Medina, Guavio sur (Gachetá, Junín, Gama, Ubalá, Gachalá).
--   La Calera va a norte por criterio documentado: se sale por la vía a La Calera desde Chapinero
--   (la celda del corredor Norte) y es la puerta de Guasca y Guatavita, que también son norte.
--   Sin fila para 11 (Bogotá: dentro de Bogotá manda la regla de mayoría por localidad), 27 Chocó ni
--   88 San Andrés (excluidos y fuera del alcance de las celdas de Bogotá).
--
-- Foto con SELECT antes de este script (2026-10-11):
--   - Ninguna de las 2 tablas existe; assignments no tiene columna detail ni CHECK de assignment_type
--     (valores en uso: forced 22, competitive 389, base_territory 351, majority_rule 4).
--   - Celdas de Bogotá (kams activas, participates_in_assignment, area_id 11001xx): 1100102 Chapinero
--     (max_travel_time 360), 1100110 Engativá (240), 1100108 Kennedy (240), 1100104 San Cristóbal (240).
--   - municipalities: 116 municipios de Cundinamarca (25xxx), todos los de la semilla existen.
--   - PostgreSQL 17.4 (UNIQUE NULLS NOT DISTINCT disponible). update_updated_at_column() existe.
--
-- Re-ejecutable: sí (IF NOT EXISTS / ON CONFLICT DO NOTHING: no pisa lo editado desde la app).
-- Rollback: 2026-10-11_9930_bogota_rollback.sql
-- =====================================================================================

BEGIN;

-- -------------------------------------------------------------------------------------
-- 1. Tablas
-- -------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.bogota_config (
  id                 integer     NOT NULL DEFAULT 1,
  k                  integer     NOT NULL DEFAULT 4,
  max_travel_minutes integer     NOT NULL DEFAULT 240,
  grupos             jsonb       NOT NULL DEFAULT '{}'::jsonb,
  updated_at         timestamptz NOT NULL DEFAULT now(),
  updated_by         uuid        NULL REFERENCES public.users (id) ON DELETE SET NULL,
  CONSTRAINT bogota_config_pkey        PRIMARY KEY (id),
  CONSTRAINT bogota_config_single_row  CHECK (id = 1),
  CONSTRAINT bogota_config_k_check     CHECK (k BETWEEN 1 AND 4),
  CONSTRAINT bogota_config_max_check   CHECK (max_travel_minutes BETWEEN 60 AND 600),
  CONSTRAINT bogota_config_grupos_obj  CHECK (jsonb_typeof(grupos) = 'object')
);

CREATE TABLE IF NOT EXISTS public.bogota_corredores (
  department_code   text NOT NULL,
  municipality_code text NULL,
  corredor          text NOT NULL,
  nota              text,
  CONSTRAINT bogota_corredores_unique UNIQUE NULLS NOT DISTINCT (department_code, municipality_code),
  CONSTRAINT bogota_corredores_corredor_check CHECK (corredor IN ('norte', 'occidente', 'sur', 'oriente')),
  CONSTRAINT bogota_corredores_dept_check CHECK (department_code ~ '^[0-9]{2}$'),
  CONSTRAINT bogota_corredores_muni_check CHECK (
    municipality_code IS NULL
    OR (municipality_code ~ '^[0-9]{5}$' AND left(municipality_code, 2) = department_code)
  )
);

DROP TRIGGER IF EXISTS update_bogota_config_updated_at ON public.bogota_config;
CREATE TRIGGER update_bogota_config_updated_at
  BEFORE UPDATE ON public.bogota_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS detail jsonb NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.assignments'::regclass AND conname = 'assignments_detail_object_check'
  ) THEN
    ALTER TABLE public.assignments
      ADD CONSTRAINT assignments_detail_object_check CHECK (detail IS NULL OR jsonb_typeof(detail) = 'object');
  END IF;
END;
$$;

-- -------------------------------------------------------------------------------------
-- 2. RLS activado y SIN políticas; fuera todo privilegio de anon/authenticated/PUBLIC.
--    service_role (bypass de RLS) recibe GRANT explícito.
-- -------------------------------------------------------------------------------------

ALTER TABLE public.bogota_config     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bogota_corredores ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.bogota_config, public.bogota_corredores FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.bogota_config, public.bogota_corredores TO service_role;

-- -------------------------------------------------------------------------------------
-- 3. Documentación en el catálogo
-- -------------------------------------------------------------------------------------

COMMENT ON TABLE public.bogota_config IS
  'Bogotá hacia afuera (una fila, id = 1). k = celdas en que se reparte el cupo de Bogotá; max_travel_minutes = tope único de Bogotá hacia afuera (ignora kams.max_travel_time de las celdas); grupos = corredor -> kam_id de la celda. Se edita en /kams (solo admin); no recalcula: aplica al próximo recálculo.';
COMMENT ON COLUMN public.bogota_config.grupos IS
  'Objeto {"norte":"<kam_id>","occidente":"<kam_id>","sur":"<kam_id>","oriente":"<kam_id>"} con celdas activas de Bogotá (area_id 11001xx). Con k = 2: norte = oriente y sur = occidente; con k = 1 los cuatro iguales.';
COMMENT ON TABLE public.bogota_corredores IS
  'Corredor de salida de Bogotá (norte | occidente | sur | oriente) por departamento (municipality_code NULL) o por municipio (excepción, gana sobre el departamento). Sin fila = sin corredor: la IPS va a la celda de Bogotá con menor tiempo real.';
COMMENT ON COLUMN public.assignments.detail IS
  'jsonb opcional. assignment_type = bogota_corredor: {"corredor","bogota_min_segundos","celda_min"} (tiempo mínimo de Bogotá en SEGUNDOS y la celda que lo tiene).';

-- -------------------------------------------------------------------------------------
-- 4. assignment_type 'bogota_corredor': ampliar el CHECK solo si existe (hoy no existe)
-- -------------------------------------------------------------------------------------

DO $$
DECLARE
  c record;
  found_check boolean := false;
  vals text;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.assignments'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%assignment_type%'
      AND pg_get_constraintdef(oid) NOT ILIKE '%bogota_corredor%'
  LOOP
    EXECUTE format('ALTER TABLE public.assignments DROP CONSTRAINT %I', c.conname);
    found_check := true;
  END LOOP;

  IF found_check THEN
    SELECT string_agg(quote_literal(v), ', ' ORDER BY v) INTO vals
    FROM (
      SELECT unnest(ARRAY['automatic', 'forced', 'base_territory', 'competitive', 'majority_rule', 'bogota_corredor']) AS v
      UNION
      SELECT DISTINCT assignment_type FROM public.assignments WHERE assignment_type IS NOT NULL
    ) s;
    EXECUTE format(
      'ALTER TABLE public.assignments ADD CONSTRAINT assignments_assignment_type_check CHECK (assignment_type IS NULL OR assignment_type IN (%s))',
      vals
    );
    RAISE NOTICE 'Bogotá corredores: CHECK de assignment_type ampliado con bogota_corredor (%)', vals;
  ELSE
    RAISE NOTICE 'Bogotá corredores: assignments.assignment_type no tiene CHECK; nada que ampliar';
  END IF;
END;
$$;

-- -------------------------------------------------------------------------------------
-- 5. Semilla
-- -------------------------------------------------------------------------------------

-- 5.1 Configuración: k = 4, tope 240 y la celda de cada corredor leída de kams por area_id.
INSERT INTO public.bogota_config (id, k, max_travel_minutes, grupos)
SELECT 1, 4, 240, jsonb_strip_nulls(jsonb_build_object(
  'norte',     (SELECT id::text FROM public.kams WHERE area_id = '1100102' AND active AND participates_in_assignment LIMIT 1),
  'occidente', (SELECT id::text FROM public.kams WHERE area_id = '1100110' AND active AND participates_in_assignment LIMIT 1),
  'sur',       (SELECT id::text FROM public.kams WHERE area_id = '1100108' AND active AND participates_in_assignment LIMIT 1),
  'oriente',   (SELECT id::text FROM public.kams WHERE area_id = '1100104' AND active AND participates_in_assignment LIMIT 1)
))
ON CONFLICT (id) DO NOTHING;

-- 5.2 Corredores por departamento
INSERT INTO public.bogota_corredores (department_code, municipality_code, corredor, nota) VALUES
  ('15', NULL, 'norte',     'Boyacá: semilla por departamento (spec 2026-10-11)'),
  ('68', NULL, 'norte',     'Santander: semilla por departamento'),
  ('54', NULL, 'norte',     'Norte de Santander: semilla por departamento'),
  ('20', NULL, 'norte',     'Cesar: semilla por departamento'),
  ('44', NULL, 'norte',     'La Guajira: semilla por departamento'),
  ('47', NULL, 'norte',     'Magdalena: semilla por departamento'),
  ('08', NULL, 'norte',     'Atlántico: semilla por departamento'),
  ('13', NULL, 'norte',     'Bolívar: semilla por departamento'),
  ('70', NULL, 'norte',     'Sucre: semilla por departamento'),
  ('23', NULL, 'norte',     'Córdoba: semilla por departamento'),
  ('73', NULL, 'occidente', 'Tolima: semilla por departamento'),
  ('17', NULL, 'occidente', 'Caldas: semilla por departamento'),
  ('66', NULL, 'occidente', 'Risaralda: semilla por departamento'),
  ('63', NULL, 'occidente', 'Quindío: semilla por departamento'),
  ('05', NULL, 'occidente', 'Antioquia: semilla por departamento'),
  ('76', NULL, 'occidente', 'Valle del Cauca: semilla por departamento'),
  ('19', NULL, 'occidente', 'Cauca: semilla por departamento'),
  ('52', NULL, 'occidente', 'Nariño: semilla por departamento'),
  ('41', NULL, 'sur',       'Huila: semilla por departamento'),
  ('18', NULL, 'sur',       'Caquetá: semilla por departamento'),
  ('86', NULL, 'sur',       'Putumayo: semilla por departamento'),
  ('50', NULL, 'oriente',   'Meta: semilla por departamento'),
  ('85', NULL, 'oriente',   'Casanare: semilla oriente; el dueño puede pasarlo a norte (Yopal hoy es asignación forzada)'),
  ('81', NULL, 'oriente',   'Arauca: semilla por departamento'),
  ('95', NULL, 'oriente',   'Guaviare: semilla por departamento (excluido del análisis)'),
  ('99', NULL, 'oriente',   'Vichada: semilla por departamento (excluido del análisis)'),
  ('97', NULL, 'oriente',   'Vaupés: semilla por departamento (excluido del análisis)'),
  ('94', NULL, 'oriente',   'Guainía: semilla por departamento (excluido del análisis)'),
  ('91', NULL, 'oriente',   'Amazonas: semilla por departamento (excluido del análisis)')
ON CONFLICT ON CONSTRAINT bogota_corredores_unique DO NOTHING;

-- 5.3 Cundinamarca por municipio, según su provincia
INSERT INTO public.bogota_corredores (department_code, municipality_code, corredor, nota) VALUES
  -- Sabana Centro -> norte (11)
  ('25', '25126', 'norte', 'Cajicá · provincia Sabana Centro'),
  ('25', '25175', 'norte', 'Chía · provincia Sabana Centro'),
  ('25', '25200', 'norte', 'Cogua · provincia Sabana Centro'),
  ('25', '25214', 'norte', 'Cota · provincia Sabana Centro'),
  ('25', '25295', 'norte', 'Gachancipá · provincia Sabana Centro'),
  ('25', '25486', 'norte', 'Nemocón · provincia Sabana Centro'),
  ('25', '25758', 'norte', 'Sopó · provincia Sabana Centro'),
  ('25', '25785', 'norte', 'Tabio · provincia Sabana Centro'),
  ('25', '25799', 'norte', 'Tenjo · provincia Sabana Centro'),
  ('25', '25817', 'norte', 'Tocancipá · provincia Sabana Centro'),
  ('25', '25899', 'norte', 'Zipaquirá · provincia Sabana Centro'),
  -- Ubaté -> norte (10)
  ('25', '25154', 'norte', 'Carmen de Carupa · provincia Ubaté'),
  ('25', '25224', 'norte', 'Cucunubá · provincia Ubaté'),
  ('25', '25288', 'norte', 'Fúquene · provincia Ubaté'),
  ('25', '25317', 'norte', 'Guachetá · provincia Ubaté'),
  ('25', '25407', 'norte', 'Lenguazaque · provincia Ubaté'),
  ('25', '25745', 'norte', 'Simijaca · provincia Ubaté'),
  ('25', '25779', 'norte', 'Susa · provincia Ubaté'),
  ('25', '25781', 'norte', 'Sutatausa · provincia Ubaté'),
  ('25', '25793', 'norte', 'Tausa · provincia Ubaté'),
  ('25', '25843', 'norte', 'Villa de San Diego de Ubaté · provincia Ubaté'),
  -- Almeidas -> norte (7)
  ('25', '25183', 'norte', 'Chocontá · provincia Almeidas'),
  ('25', '25426', 'norte', 'Machetá · provincia Almeidas'),
  ('25', '25436', 'norte', 'Manta · provincia Almeidas'),
  ('25', '25736', 'norte', 'Sesquilé · provincia Almeidas'),
  ('25', '25772', 'norte', 'Suesca · provincia Almeidas'),
  ('25', '25807', 'norte', 'Tibirita · provincia Almeidas'),
  ('25', '25873', 'norte', 'Villapinzón · provincia Almeidas'),
  -- Guavio norte y La Calera -> norte (3)
  ('25', '25322', 'norte', 'Guasca · provincia Guavio (Guavio norte)'),
  ('25', '25326', 'norte', 'Guatavita · provincia Guavio (Guavio norte)'),
  ('25', '25377', 'norte', 'La Calera · provincia Guavio; norte por criterio: se sale por la vía a La Calera desde Chapinero'),
  -- Sabana Occidente -> occidente (8)
  ('25', '25099', 'occidente', 'Bojacá · provincia Sabana Occidente'),
  ('25', '25260', 'occidente', 'El Rosal · provincia Sabana Occidente'),
  ('25', '25269', 'occidente', 'Facatativá · provincia Sabana Occidente'),
  ('25', '25286', 'occidente', 'Funza · provincia Sabana Occidente'),
  ('25', '25430', 'occidente', 'Madrid · provincia Sabana Occidente'),
  ('25', '25473', 'occidente', 'Mosquera · provincia Sabana Occidente'),
  ('25', '25769', 'occidente', 'Subachoque · provincia Sabana Occidente'),
  ('25', '25898', 'occidente', 'Zipacón · provincia Sabana Occidente'),
  -- Gualivá -> occidente (12)
  ('25', '25019', 'occidente', 'Albán · provincia Gualivá'),
  ('25', '25398', 'occidente', 'La Peña · provincia Gualivá'),
  ('25', '25402', 'occidente', 'La Vega · provincia Gualivá'),
  ('25', '25489', 'occidente', 'Nimaima · provincia Gualivá'),
  ('25', '25491', 'occidente', 'Nocaima · provincia Gualivá'),
  ('25', '25592', 'occidente', 'Quebradanegra · provincia Gualivá'),
  ('25', '25658', 'occidente', 'San Francisco · provincia Gualivá'),
  ('25', '25718', 'occidente', 'Sasaima · provincia Gualivá'),
  ('25', '25777', 'occidente', 'Supatá · provincia Gualivá'),
  ('25', '25851', 'occidente', 'Útica · provincia Gualivá'),
  ('25', '25862', 'occidente', 'Vergara · provincia Gualivá'),
  ('25', '25875', 'occidente', 'Villeta · provincia Gualivá'),
  -- Rionegro -> occidente (8)
  ('25', '25258', 'occidente', 'El Peñón · provincia Rionegro'),
  ('25', '25394', 'occidente', 'La Palma · provincia Rionegro'),
  ('25', '25513', 'occidente', 'Pacho · provincia Rionegro'),
  ('25', '25518', 'occidente', 'Paime · provincia Rionegro'),
  ('25', '25653', 'occidente', 'San Cayetano · provincia Rionegro'),
  ('25', '25823', 'occidente', 'Topaipí · provincia Rionegro'),
  ('25', '25871', 'occidente', 'Villagómez · provincia Rionegro'),
  ('25', '25885', 'occidente', 'Yacopí · provincia Rionegro'),
  -- Magdalena Centro -> occidente (7)
  ('25', '25086', 'occidente', 'Beltrán · provincia Magdalena Centro'),
  ('25', '25095', 'occidente', 'Bituima · provincia Magdalena Centro'),
  ('25', '25168', 'occidente', 'Chaguaní · provincia Magdalena Centro'),
  ('25', '25328', 'occidente', 'Guayabal de Síquima · provincia Magdalena Centro'),
  ('25', '25580', 'occidente', 'Pulí · provincia Magdalena Centro'),
  ('25', '25662', 'occidente', 'San Juan de Rioseco · provincia Magdalena Centro'),
  ('25', '25867', 'occidente', 'Vianí · provincia Magdalena Centro'),
  -- Bajo Magdalena -> occidente (3)
  ('25', '25148', 'occidente', 'Caparrapí · provincia Bajo Magdalena'),
  ('25', '25320', 'occidente', 'Guaduas · provincia Bajo Magdalena'),
  ('25', '25572', 'occidente', 'Puerto Salgar · provincia Bajo Magdalena'),
  -- Soacha -> sur (2)
  ('25', '25740', 'sur', 'Sibaté · provincia Soacha'),
  ('25', '25754', 'sur', 'Soacha · provincia Soacha'),
  -- Sumapaz -> sur (10)
  ('25', '25053', 'sur', 'Arbeláez · provincia Sumapaz'),
  ('25', '25120', 'sur', 'Cabrera · provincia Sumapaz'),
  ('25', '25290', 'sur', 'Fusagasugá · provincia Sumapaz'),
  ('25', '25312', 'sur', 'Granada · provincia Sumapaz'),
  ('25', '25524', 'sur', 'Pandi · provincia Sumapaz'),
  ('25', '25535', 'sur', 'Pasca · provincia Sumapaz'),
  ('25', '25649', 'sur', 'San Bernardo · provincia Sumapaz'),
  ('25', '25743', 'sur', 'Silvania · provincia Sumapaz'),
  ('25', '25805', 'sur', 'Tibacuy · provincia Sumapaz'),
  ('25', '25506', 'sur', 'Venecia · provincia Sumapaz'),
  -- Alto Magdalena -> sur (8)
  ('25', '25001', 'sur', 'Agua de Dios · provincia Alto Magdalena'),
  ('25', '25307', 'sur', 'Girardot · provincia Alto Magdalena'),
  ('25', '25324', 'sur', 'Guataquí · provincia Alto Magdalena'),
  ('25', '25368', 'sur', 'Jerusalén · provincia Alto Magdalena'),
  ('25', '25483', 'sur', 'Nariño · provincia Alto Magdalena'),
  ('25', '25488', 'sur', 'Nilo · provincia Alto Magdalena'),
  ('25', '25612', 'sur', 'Ricaurte · provincia Alto Magdalena'),
  ('25', '25815', 'sur', 'Tocaima · provincia Alto Magdalena'),
  -- Tequendama -> sur (10)
  ('25', '25035', 'sur', 'Anapoima · provincia Tequendama'),
  ('25', '25040', 'sur', 'Anolaima · provincia Tequendama'),
  ('25', '25599', 'sur', 'Apulo · provincia Tequendama'),
  ('25', '25123', 'sur', 'Cachipay · provincia Tequendama'),
  ('25', '25245', 'sur', 'El Colegio · provincia Tequendama'),
  ('25', '25386', 'sur', 'La Mesa · provincia Tequendama'),
  ('25', '25596', 'sur', 'Quipile · provincia Tequendama'),
  ('25', '25645', 'sur', 'San Antonio del Tequendama · provincia Tequendama'),
  ('25', '25797', 'sur', 'Tena · provincia Tequendama'),
  ('25', '25878', 'sur', 'Viotá · provincia Tequendama'),
  -- Oriente -> oriente (10)
  ('25', '25151', 'oriente', 'Cáqueza · provincia Oriente'),
  ('25', '25178', 'oriente', 'Chipaque · provincia Oriente'),
  ('25', '25181', 'oriente', 'Choachí · provincia Oriente'),
  ('25', '25279', 'oriente', 'Fómeque · provincia Oriente'),
  ('25', '25281', 'oriente', 'Fosca · provincia Oriente'),
  ('25', '25335', 'oriente', 'Guayabetal · provincia Oriente'),
  ('25', '25339', 'oriente', 'Gutiérrez · provincia Oriente'),
  ('25', '25594', 'oriente', 'Quetame · provincia Oriente'),
  ('25', '25841', 'oriente', 'Ubaque · provincia Oriente'),
  ('25', '25845', 'oriente', 'Une · provincia Oriente'),
  -- Medina -> oriente (2)
  ('25', '25438', 'oriente', 'Medina · provincia Medina'),
  ('25', '25530', 'oriente', 'Paratebueno · provincia Medina'),
  -- Guavio sur -> oriente (5)
  ('25', '25293', 'oriente', 'Gachalá · provincia Guavio (Guavio sur)'),
  ('25', '25297', 'oriente', 'Gachetá · provincia Guavio (Guavio sur)'),
  ('25', '25299', 'oriente', 'Gama · provincia Guavio (Guavio sur)'),
  ('25', '25372', 'oriente', 'Junín · provincia Guavio (Guavio sur)'),
  ('25', '25839', 'oriente', 'Ubalá · provincia Guavio (Guavio sur)')
ON CONFLICT ON CONSTRAINT bogota_corredores_unique DO NOTHING;

-- -------------------------------------------------------------------------------------
-- 6. Comprobaciones (aborta la transacción si algo no cuadra)
-- -------------------------------------------------------------------------------------

DO $$
DECLARE
  t text;
  n integer;
  cfg record;
  corr text;
  cell text;
BEGIN
  FOREACH t IN ARRAY ARRAY['bogota_config', 'bogota_corredores'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace
      WHERE ns.nspname = 'public' AND c.relname = t AND c.relkind = 'r' AND c.relrowsecurity
    ) THEN
      RAISE EXCEPTION 'Bogotá corredores: la tabla public.% no existe o no tiene RLS activado', t;
    END IF;

    SELECT count(*) INTO n FROM pg_policies WHERE schemaname = 'public' AND tablename = t;
    IF n > 0 THEN
      RAISE EXCEPTION 'Bogotá corredores: public.% tiene % política(s); debe nacer sin políticas', t, n;
    END IF;

    SELECT count(*) INTO n
    FROM pg_class c, aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a
    WHERE c.oid = ('public.' || t)::regclass
      AND (a.grantee = 0
           OR a.grantee IN (SELECT oid FROM pg_roles WHERE rolname IN ('anon', 'authenticated')));
    IF n > 0 THEN
      RAISE EXCEPTION 'Bogotá corredores: public.% conserva % privilegio(s) para anon/authenticated/PUBLIC', t, n;
    END IF;

    IF NOT has_table_privilege('service_role', 'public.' || t, 'SELECT')
       OR NOT has_table_privilege('service_role', 'public.' || t, 'INSERT')
       OR NOT has_table_privilege('service_role', 'public.' || t, 'UPDATE')
       OR NOT has_table_privilege('service_role', 'public.' || t, 'DELETE') THEN
      RAISE EXCEPTION 'Bogotá corredores: service_role sin SELECT/INSERT/UPDATE/DELETE en public.%', t;
    END IF;
  END LOOP;

  SELECT count(*) INTO n
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name IN ('bogota_config', 'bogota_corredores');
  IF n <> 10 THEN
    RAISE EXCEPTION 'Bogotá corredores: se esperaban 10 columnas en las 2 tablas; hay % (¿existían con otra forma?)', n;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'assignments' AND column_name = 'detail' AND data_type = 'jsonb'
  ) THEN
    RAISE EXCEPTION 'Bogotá corredores: falta assignments.detail (jsonb)';
  END IF;

  SELECT * INTO cfg FROM public.bogota_config WHERE id = 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bogotá corredores: bogota_config no tiene la fila 1';
  END IF;
  FOREACH corr IN ARRAY ARRAY['norte', 'occidente', 'sur', 'oriente'] LOOP
    cell := cfg.grupos ->> corr;
    IF cell IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.kams
      WHERE id::text = cell AND active AND participates_in_assignment
        AND area_id LIKE '11001%' AND length(area_id) = 7
    ) THEN
      RAISE EXCEPTION 'Bogotá corredores: el corredor % no apunta a una celda activa de Bogotá (%)', corr, coalesce(cell, 'vacío');
    END IF;
  END LOOP;

  SELECT count(*) INTO n FROM public.bogota_corredores WHERE municipality_code IS NULL;
  IF n < 29 THEN
    RAISE EXCEPTION 'Bogotá corredores: se esperaban 29 departamentos sembrados; hay %', n;
  END IF;
  SELECT count(*) INTO n FROM public.bogota_corredores WHERE department_code = '25' AND municipality_code IS NOT NULL;
  IF n < 116 THEN
    RAISE EXCEPTION 'Bogotá corredores: se esperaban 116 municipios de Cundinamarca; hay %', n;
  END IF;
  SELECT count(*) INTO n
  FROM public.bogota_corredores bc
  WHERE bc.municipality_code IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.municipalities m WHERE m.code = bc.municipality_code);
  IF n > 0 THEN
    RAISE EXCEPTION 'Bogotá corredores: % municipio(s) de la semilla no existen en municipalities', n;
  END IF;
  SELECT count(*) INTO n
  FROM public.municipalities m
  WHERE m.code LIKE '25%'
    AND NOT EXISTS (SELECT 1 FROM public.bogota_corredores bc WHERE bc.municipality_code = m.code);
  IF n > 0 THEN
    RAISE EXCEPTION 'Bogotá corredores: % municipio(s) de Cundinamarca sin corredor', n;
  END IF;

  RAISE NOTICE 'Bogotá corredores OK: 2 tablas con RLS, 0 políticas, 0 privilegios para anon/authenticated; config k=%, tope % min; % filas de corredores; assignments.detail creada. Nada se recalcula: simular en /kams y recalcular cuando el dueño decida.',
    cfg.k, cfg.max_travel_minutes, (SELECT count(*) FROM public.bogota_corredores);
END;
$$;

COMMIT;
