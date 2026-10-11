-- =====================================================================================
-- OpMap · PR 7 (compras públicas SECOP y fuentes de datos automáticas) · 0710 — Esquema y semillas
-- Proyecto: norvxqgohddgsdkggqzq · Generado: 2026-10-11
--
-- Autorización del dueño (2026-10-11): "Dale. Pero… ¿estamos haciendo algo que consulte estas fuentes y
-- esté actualizado?". Es ADITIVA: 4 tablas, 1 vista y 2 funciones nuevas; no toca ninguna tabla existente
-- (hospitals solo se referencia desde secop_contratos.hospital_id con ON DELETE SET NULL).
--
-- Fuentes (datos abiertos de Colombia Compra Eficiente en datos.gov.co, API Socrata/SoQL, sin token):
--   - SECOP II Contratos (jbjy-vk9h), diario.                     → secop_contratos.fuente = 'secop2'
--   - SECOP Integrado (rpmr-utcd), SECOP I + II desde 2005.       → secop_contratos.fuente = 'integrado'
--   Carga: web/scripts/secop-load.ts (inicial) y GET /api/cron/secop_ii | secop_integrado (incremental).
--   Detalle de reglas, clasificación y privacidad: docs/fases/fase5-fuentes-automaticas.md.
--
-- Qué crea:
--   1. secop_proveedores_vigilados : NIT (9 dígitos) de los proveedores de material que se vigilan.
--                                    Semilla: 76 proveedores de Odoo (es_empresa y no intercompañía).
--   2. secop_contratos             : contratos de las entidades públicas objetivo (clasificados por línea,
--                                    de proveedores vigilados o de médicos especialistas) y TODOS los
--                                    contratos de los proveedores vigilados con cualquier entidad.
--                                    Personas naturales: SIN número de documento (solo proveedor_hash).
--   3. secop_ajustes               : una fila con la sal del hash de documentos de personas (aleatoria,
--                                    generada aquí; nunca sale de la base salvo hacia service_role).
--   4. fuentes_estado              : estado de cada carga automática (panel "Fuentes de datos").
--   5. secop_contratos_unicos      : vista que quita del Integrado los contratos de SECOP II que ya
--                                    vienen del dataset de SECOP II (mismo id CO1.PCCNTR…).
--   6. secop_nits_ips()            : NIT de las IPS activas → IPS principal (más camas) y si es pública o
--                                    mixta en el REPS (reps_sedes.naturaleza). Lo usa la carga.
--   7. secop_marcar_atipicos()     : marca atipico = valor > 50.000 M o > p99 de su entidad (entidades con
--                                    100 contratos o más). La llama la carga al cerrar cada pasada.
--   Todo con RLS activado, SIN políticas, sin privilegios para anon/authenticated/PUBLIC y GRANT
--   explícito a service_role. Funciones SECURITY INVOKER, search_path fijo, EXECUTE solo service_role.
--   Bloque DO final que comprueba todo y aborta si no cuadra.
--
-- Foto con SELECT antes de este script (2026-10-11):
--   - Ninguna de las 4 tablas existe. hospitals.nit (text, generada) y reps_sedes existen.
--   - IPS activas con NIT público o mixto en reps_sedes (cruce por NIT): 131 NIT (128 si se cruza por
--     hospitals.reps_code).
--   - gen_random_uuid() disponible (PostgreSQL 17).
--
-- Re-ejecutable: sí (IF NOT EXISTS / ON CONFLICT DO NOTHING / CREATE OR REPLACE / REVOKE-GRANT).
-- Rollback: 2026-10-11_9930_secop_rollback.sql
-- =====================================================================================

BEGIN;

-- -------------------------------------------------------------------------------------
-- 1. Tablas
-- -------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.secop_proveedores_vigilados (
  nit             text          PRIMARY KEY,
  dv              text,
  nombre          text,
  ciudad          text,
  origen          text          NOT NULL DEFAULT 'manual',
  compras_gcp_cop numeric(18,2),
  odoo_id         integer,
  activo          boolean       NOT NULL DEFAULT true,
  nota            text,
  created_at      timestamptz   NOT NULL DEFAULT now(),
  updated_at      timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT secop_vigilados_nit_check    CHECK (nit ~ '^[0-9]{9}$'),
  CONSTRAINT secop_vigilados_dv_check     CHECK (dv IS NULL OR dv ~ '^[0-9]$'),
  CONSTRAINT secop_vigilados_origen_check CHECK (origen IN ('odoo_gcp', 'manual'))
);

CREATE TABLE IF NOT EXISTS public.secop_contratos (
  id                     uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  fuente                 text          NOT NULL,
  origen                 text          NOT NULL,
  id_contrato            text          NOT NULL,
  numero_contrato        text,
  referencia             text,
  proceso                text,
  nit_entidad            text          NOT NULL,
  nombre_entidad         text,
  departamento_entidad   text,
  municipio_entidad      text,
  nivel_entidad          text,
  hospital_id            uuid          REFERENCES public.hospitals (id) ON DELETE SET NULL,
  documento_proveedor    text,
  proveedor_hash         text,
  tipo_doc_proveedor     text,
  proveedor_nombre       text,
  proveedor_vigilado_id  text          REFERENCES public.secop_proveedores_vigilados (nit) ON DELETE SET NULL,
  es_persona             boolean       NOT NULL DEFAULT false,
  tipo_contrato          text,
  modalidad              text,
  categoria_unspsc       text,
  objeto                 text,
  descripcion            text,
  linea                  text          NOT NULL DEFAULT 'no_clasificado',
  lineas                 text[]        NOT NULL DEFAULT '{}',
  especialidad_medico    text,
  clasificacion_version  text,
  valor                  numeric(18,2),
  valor_pagado           numeric(18,2),
  fecha_firma            date,
  fecha_inicio           date,
  fecha_fin              date,
  estado                 text,
  url                    text,
  ultima_actualizacion   date,
  atipico                boolean       NOT NULL DEFAULT false,
  imported_at            timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT secop_contratos_fuente_check  CHECK (fuente IN ('secop2', 'integrado')),
  CONSTRAINT secop_contratos_origen_check  CHECK (origen IN ('SECOPI', 'SECOPII')),
  CONSTRAINT secop_contratos_fuente_origen CHECK (fuente = 'integrado' OR origen = 'SECOPII'),
  CONSTRAINT secop_contratos_nit_check     CHECK (nit_entidad ~ '^[0-9]{5,12}$'),
  CONSTRAINT secop_contratos_linea_check   CHECK (linea IN ('trauma', 'reemplazo', 'columna', 'deportiva', 'neurocirugia', 'otros_implantes', 'no_clasificado')),
  CONSTRAINT secop_contratos_lineas_check  CHECK (lineas <@ ARRAY['trauma', 'reemplazo', 'columna', 'deportiva', 'neurocirugia', 'otros_implantes']::text[]),
  CONSTRAINT secop_contratos_espec_check   CHECK (especialidad_medico IS NULL OR especialidad_medico IN ('ortopedia', 'neurocirugia', 'columna', 'deportiva')),
  -- Privacidad: una persona natural nunca guarda su número de documento en claro
  CONSTRAINT secop_contratos_persona_check CHECK (NOT es_persona OR documento_proveedor IS NULL),
  CONSTRAINT secop_contratos_doc_check     CHECK (documento_proveedor IS NULL OR documento_proveedor ~ '^[0-9]{5,12}$'),
  CONSTRAINT secop_contratos_hash_check    CHECK (proveedor_hash IS NULL OR proveedor_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT secop_contratos_valor_check   CHECK ((valor IS NULL OR valor >= 0) AND (valor_pagado IS NULL OR valor_pagado >= 0)),
  CONSTRAINT secop_contratos_unq UNIQUE (fuente, id_contrato)
);

CREATE INDEX IF NOT EXISTS secop_contratos_entidad_idx   ON public.secop_contratos (nit_entidad, fecha_firma);
CREATE INDEX IF NOT EXISTS secop_contratos_hospital_idx  ON public.secop_contratos (hospital_id) WHERE hospital_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS secop_contratos_vigilado_idx  ON public.secop_contratos (proveedor_vigilado_id) WHERE proveedor_vigilado_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS secop_contratos_proveedor_idx ON public.secop_contratos (documento_proveedor) WHERE documento_proveedor IS NOT NULL;
CREATE INDEX IF NOT EXISTS secop_contratos_hash_idx      ON public.secop_contratos (proveedor_hash) WHERE proveedor_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS secop_contratos_linea_idx     ON public.secop_contratos (linea, fecha_firma);
CREATE INDEX IF NOT EXISTS secop_contratos_numero_idx    ON public.secop_contratos (numero_contrato);
-- Respaldo de búsqueda del Integrado (no es UNIQUE: SECOP I repite número de constancia por contratista)
CREATE INDEX IF NOT EXISTS secop_contratos_respaldo_idx  ON public.secop_contratos (fuente, numero_contrato, nit_entidad, fecha_firma);

CREATE TABLE IF NOT EXISTS public.secop_ajustes (
  id             smallint     PRIMARY KEY DEFAULT 1,
  sal_documentos text         NOT NULL,
  created_at     timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT secop_ajustes_una_fila CHECK (id = 1),
  CONSTRAINT secop_ajustes_sal_check CHECK (length(sal_documentos) >= 32)
);

CREATE TABLE IF NOT EXISTS public.fuentes_estado (
  fuente               text         PRIMARY KEY,
  nombre               text,
  programacion         text,
  ejecutor             text,
  ultimo_ok            timestamptz,
  ultimo_intento       timestamptz,
  estado               text,
  filas                integer,
  mensaje              text,
  cursor               jsonb        NOT NULL DEFAULT '{}'::jsonb,
  siguiente_programado timestamptz,
  bloqueo_hasta        timestamptz,
  updated_at           timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT fuentes_estado_fuente_check   CHECK (fuente ~ '^[a-z0-9_]+$'),
  CONSTRAINT fuentes_estado_estado_check   CHECK (estado IS NULL OR estado IN ('ok', 'error', 'corriendo')),
  CONSTRAINT fuentes_estado_ejecutor_check CHECK (ejecutor IS NULL OR ejecutor IN ('vercel_cron', 'github_actions', 'manual')),
  CONSTRAINT fuentes_estado_filas_check    CHECK (filas IS NULL OR filas >= 0)
);

-- -------------------------------------------------------------------------------------
-- 2. Vista y funciones
-- -------------------------------------------------------------------------------------

-- Contratos sin doble conteo: el Integrado repite los contratos de SECOP II (origen SECOPII, mismo
-- CO1.PCCNTR…). Se queda la fila del dataset de SECOP II, que trae más campos (valor pagado, UNSPSC…).
CREATE OR REPLACE VIEW public.secop_contratos_unicos
WITH (security_invoker = true) AS
SELECT c.*
FROM public.secop_contratos c
WHERE c.fuente = 'secop2'
   OR c.origen = 'SECOPI'
   OR NOT EXISTS (
     SELECT 1 FROM public.secop_contratos s
     WHERE s.fuente = 'secop2' AND s.id_contrato = c.numero_contrato
   );

CREATE OR REPLACE FUNCTION public.secop_nits_ips()
RETURNS TABLE (nit text, hospital_id uuid, publica boolean)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT DISTINCT ON (h.nit)
         h.nit,
         h.id,
         EXISTS (SELECT 1 FROM public.reps_sedes r WHERE r.nit = h.nit AND r.naturaleza IN ('Pública', 'Mixta'))
  FROM public.hospitals h
  WHERE h.active AND h.nit IS NOT NULL
  ORDER BY h.nit, h.beds DESC NULLS LAST, h.name, h.id
$$;

CREATE OR REPLACE FUNCTION public.secop_marcar_atipicos(
  p_umbral        numeric DEFAULT 50000000000,
  p_min_contratos integer DEFAULT 100
)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  n integer;
BEGIN
  WITH stats AS (
    SELECT u.nit_entidad, count(*) AS contratos, percentile_cont(0.99) WITHIN GROUP (ORDER BY u.valor) AS p99
    FROM public.secop_contratos_unicos u
    WHERE u.valor IS NOT NULL
    GROUP BY u.nit_entidad
  ), nuevo AS (
    SELECT c.id,
           COALESCE(c.valor > p_umbral OR (s.contratos >= p_min_contratos AND c.valor > s.p99), false) AS atipico
    FROM public.secop_contratos c
    LEFT JOIN stats s ON s.nit_entidad = c.nit_entidad
  )
  UPDATE public.secop_contratos c
  SET atipico = nuevo.atipico
  FROM nuevo
  WHERE nuevo.id = c.id AND c.atipico IS DISTINCT FROM nuevo.atipico;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

-- -------------------------------------------------------------------------------------
-- 3. RLS activado y SIN políticas; fuera todo privilegio de anon/authenticated/PUBLIC.
-- -------------------------------------------------------------------------------------

ALTER TABLE public.secop_proveedores_vigilados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.secop_contratos             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.secop_ajustes               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fuentes_estado              ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.secop_proveedores_vigilados, public.secop_contratos, public.secop_ajustes,
  public.fuentes_estado, public.secop_contratos_unicos FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.secop_proveedores_vigilados, public.secop_contratos, public.fuentes_estado TO service_role;
GRANT SELECT, INSERT ON TABLE public.secop_ajustes TO service_role;
GRANT SELECT ON TABLE public.secop_contratos_unicos TO service_role;

REVOKE ALL ON FUNCTION public.secop_nits_ips() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.secop_marcar_atipicos(numeric, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.secop_nits_ips() TO service_role;
GRANT EXECUTE ON FUNCTION public.secop_marcar_atipicos(numeric, integer) TO service_role;

-- -------------------------------------------------------------------------------------
-- 4. Documentación en el catálogo
-- -------------------------------------------------------------------------------------

COMMENT ON TABLE public.secop_proveedores_vigilados IS
  'Proveedores de material vigilados en SECOP (NIT de 9 dígitos, sin DV). Semilla: 76 proveedores de Odoo '
  '(es_empresa y no intercompañía, con compras GCP). Se cargan todos sus contratos con cualquier entidad.';
COMMENT ON TABLE public.secop_contratos IS
  'Contratos de SECOP II (jbjy-vk9h) y SECOP Integrado (rpmr-utcd): de las IPS públicas/mixtas objetivo '
  '(línea clasificada, proveedor vigilado o médico especialista) y de los proveedores vigilados. NIT a 9 '
  'dígitos. Personas naturales sin documento en claro (proveedor_hash). Lo cargan scripts/secop-load.ts y '
  'el cron. Para sumar sin doble conteo usar la vista secop_contratos_unicos.';
COMMENT ON COLUMN public.secop_contratos.id_contrato IS
  'secop2: id_contrato (CO1.PCCNTR…). integrado: origen|numero_del_contrato|proveedor|fecha de firma (SECOP I '
  'repite el número de constancia por contratista y trae filas duplicadas).';
COMMENT ON COLUMN public.secop_contratos.proveedor_hash IS
  'sha256(sal de secop_ajustes : dígitos del documento) para personas naturales; solo sirve para deduplicar.';
COMMENT ON COLUMN public.secop_contratos.linea IS
  'Línea principal (web/lib/secop.ts, clasificacion_version): trauma | reemplazo | columna | deportiva | '
  'neurocirugia | otros_implantes | no_clasificado. lineas = todas las detectadas.';
COMMENT ON COLUMN public.secop_contratos.especialidad_medico IS
  'Servicios profesionales de especialistas (persona o empresa): ortopedia | neurocirugia | columna | deportiva.';
COMMENT ON COLUMN public.secop_contratos.atipico IS 'valor > 50.000 M o > p99 de su entidad (si tiene 100+ contratos). Lo fija secop_marcar_atipicos().';
COMMENT ON TABLE public.secop_ajustes IS 'Sal aleatoria del hash de documentos de personas (secop_contratos.proveedor_hash). Solo service_role.';
COMMENT ON TABLE public.fuentes_estado IS
  'Estado de cada carga automática de datos (Vercel Cron, GitHub Actions o "Actualizar ahora"). '
  'estado: ok | error | corriendo (pasada en curso; sigue en la próxima invocación). cursor = avance.';

-- -------------------------------------------------------------------------------------
-- 5. Semillas
-- -------------------------------------------------------------------------------------

INSERT INTO public.secop_ajustes (id, sal_documentos)
VALUES (1, replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''))
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.secop_proveedores_vigilados (nit, dv, nombre, ciudad, origen, compras_gcp_cop, odoo_id) VALUES
  ('800038389', '6', 'Curvilco del Oriente SAS', 'FLORIDABLANCA', 'odoo_gcp', 677814842, 16194),
  ('800061357', '7', 'Implantes y Sistemas Ortopedicos SA (ISO)', 'BOGOTA', 'odoo_gcp', 1999835391, 6426),
  ('800082394', '1', 'Hospimport SAS', 'BOGOTA', 'odoo_gcp', 56763833, 39999),
  ('800116473', '1', 'Corpomedica SAS', 'CALI', 'odoo_gcp', 1135940946, 29276),
  ('800130856', '7', 'Rodriguez Angel y Cia SAS', NULL, 'odoo_gcp', 33209472, 4279),
  ('800174043', '5', 'Ortomac SAS', 'BOGOTA', 'odoo_gcp', 237728731, 3987),
  ('800227279', '5', 'Tecnitrauma SA', 'BARRANQUILLA', 'odoo_gcp', 1698721067, 8782),
  ('804010334', '4', 'Mediimplantes SA', 'BUCARAMANGA', 'odoo_gcp', 1515416718, 3950),
  ('805014047', '7', 'Avance Medico SA', 'CALI', 'odoo_gcp', 22522500, 16911),
  ('805026666', '8', 'Bioart SA', 'CALI', 'odoo_gcp', 2023392113, 3994),
  ('806007258', '9', 'Prosalud Medicamentos e Insumos SAS', 'MAGANGUE', 'odoo_gcp', 359470980, 4295),
  ('811022474', '4', 'Rp Dental SA', 'MEDELLIN', 'odoo_gcp', 573555922, 4296),
  ('811032919', '2', 'Industrias Medicas Sampedro SAS', 'LA ESTRELLA', 'odoo_gcp', 58203524, 16968),
  ('823004940', '2', 'Drug Store SAS', 'BOGOTA', 'odoo_gcp', 35971120, 4175),
  ('830006894', '6', 'La Instrumentadora Jox SAS', 'BELLO', 'odoo_gcp', 22176000, 28627),
  ('830035101', '8', 'Oseomed SAS', 'MEDELLIN', 'odoo_gcp', 1725365235, 6947),
  ('830091676', '9', 'Medirex BIC SAS', 'BOGOTA', 'odoo_gcp', 398871635, 17065),
  ('830500326', '2', 'Innomed SA', 'BOGOTA', 'odoo_gcp', 158584655, 4301),
  ('830512304', '2', 'Closter Pharma SAS', 'BOGOTA', 'odoo_gcp', 840689997, 4032),
  ('860506831', '7', 'Biotronitech Colombia SAS', 'BOGOTA', 'odoo_gcp', 86503274, 4306),
  ('860529890', '0', 'Disortho SAS', 'BOGOTA', 'odoo_gcp', 1540607751, 4308),
  ('900026143', '2', 'Promed Quirúrgicos EU', 'BOGOTA', 'odoo_gcp', 919884991, 3878),
  ('900044929', '0', 'Osteonorte SAS', 'BARRANQUILLA', 'odoo_gcp', 465286653, 5409),
  ('900124455', '5', 'Smith & Nephew Colombia SAS', 'BOGOTA', 'odoo_gcp', 104735731, 4031),
  ('900127147', '5', 'Exel Medical SAS', 'BOGOTA', 'odoo_gcp', 88252500, 5663),
  ('900131246', '1', 'Arthromeds SA', 'CALI', 'odoo_gcp', 99284415, 11314),
  ('900155383', '6', 'Suministros Integrales Mauro Sergio SAS', 'CARTAGENA', 'odoo_gcp', 38420278, 19655),
  ('900202395', '6', 'Fundación Fundonemos Banco de Tejidos', 'BUCARAMANGA', 'odoo_gcp', 555676900, 28628),
  ('900207526', '7', 'Sistemas y Soluciones Medicas SAS', 'BARRANQUILLA', 'odoo_gcp', 299571242, 4323),
  ('900252798', '4', 'Implantech Ltda', 'MEDELLIN', 'odoo_gcp', 111264115, 27611),
  ('900261089', '9', 'Impormedical Equipos y Suministros Medicos SA', 'CALI', 'odoo_gcp', 28036006, 20670),
  ('900294380', '1', 'LH SAS', 'BOGOTA', 'odoo_gcp', 1008093432, 4324),
  ('900303413', '4', 'Osteocol SAS', 'BOGOTA', 'odoo_gcp', 22030008, 6909),
  ('900327306', '8', 'Tienken SAS', 'BOGOTA', 'odoo_gcp', 118795309, 7490),
  ('900371464', '1', 'Osteomedical SAS', 'BOGOTA', 'odoo_gcp', 690036834, 4327),
  ('900399132', '1', 'EDM Equipos y Dispositivos Médicos SAS', 'BOGOTA', 'odoo_gcp', 2185981787, 4857),
  ('900418415', '3', 'Inbios SAS', 'MEDELLIN', 'odoo_gcp', 189654020, 7634),
  ('900449382', '1', 'Orthosystem SAS', 'CALI', 'odoo_gcp', 81499330, 9574),
  ('900472595', '1', 'Vegimed SAS', 'BARRANQUILLA', 'odoo_gcp', 29925736, 4786),
  ('900492874', '5', 'Dotacion & Suministros MRA SAS', 'BARRANQUILLA', 'odoo_gcp', 107197569, 6509),
  ('900515661', '4', 'Implameq SAS', 'CALI', 'odoo_gcp', 1861407304, 3879),
  ('900532977', '8', 'Eurociencia Colombia SAS', 'BOGOTA', 'odoo_gcp', 21950483, 13328),
  ('900547638', '1', 'Wholding SAS', 'BOGOTA', 'odoo_gcp', 75832986, 15514),
  ('900561912', '3', 'Suministros Cuarto Nivel SAS', 'BARRANQUILLA', 'odoo_gcp', 38683406, 12151),
  ('900577659', '4', 'Piemca SAS', 'BOGOTA', 'odoo_gcp', 782727636, 6641),
  ('900594445', '7', 'Medarthys SAS', 'BOGOTA', 'odoo_gcp', 35655529, 28673),
  ('900622371', '1', 'Fixmedical SAS BIC', 'BOGOTA', 'odoo_gcp', 610837244, 4331),
  ('900624583', '5', 'Durgical SAS', 'CALI', 'odoo_gcp', 24329662, 32005),
  ('900656724', '4', 'Jaimes Rueda & Compañia, Precimec SAS', 'BUCARAMANGA', 'odoo_gcp', 22058028, 19126),
  ('900691119', '6', 'QNA Medical SAS', 'BARRANQUILLA', 'odoo_gcp', 120631511, 4134),
  ('900731106', '3', 'Ortomed SAS', 'BARRANQUILLA', 'odoo_gcp', 49729653, 27289),
  ('900765180', '5', 'JP Trading SAS', 'BUCARAMANGA', 'odoo_gcp', 26602350, 14204),
  ('900854273', '3', 'Element Orthopedics SAS', 'BOGOTA', 'odoo_gcp', 336655137, 4339),
  ('900872826', '2', 'Innovacure SAS', 'BOGOTA', 'odoo_gcp', 25169625, 16433),
  ('900927644', '7', 'Insumedco Del Caribe SAS', 'BARRANQUILLA', 'odoo_gcp', 37869655, 33301),
  ('900954399', '1', 'Tocamedic Colombia SAS', 'BARRANQUILLA', 'odoo_gcp', 31704701, 6416),
  ('900962872', '8', 'Orthotecnologia SAS', 'BOGOTA', 'odoo_gcp', 839773982, 18508),
  ('901090486', '9', 'Tiendas Medicas Especializadas SAS', 'BOGOTA', 'odoo_gcp', 138900785, 24278),
  ('901107900', '3', 'Medical Surgical SAS', 'PEREIRA', 'odoo_gcp', 31025450, 4962),
  ('901143774', '4', 'Lepine Colombia SAS', 'BOGOTA', 'odoo_gcp', 2126824481, 5893),
  ('901182261', '4', 'Abumac Medical SAS', 'BARRANQUILLA', 'odoo_gcp', 418136055, 12918),
  ('901205722', '9', 'Nuvasive Colombia SAS', 'BOGOTA', 'odoo_gcp', 1017441875, 16958),
  ('901265731', '1', 'Osteotech Implantes Quirúrgicos SAS', 'CALI', 'odoo_gcp', 1014996059, 5346),
  ('901293908', '7', 'Traumedical Implantes Medicos SAS', 'BARRANQUILLA', 'odoo_gcp', 22242800, 15369),
  ('901362153', '1', 'Cure Latam SAS', 'BARRANQUILLA', 'odoo_gcp', 116913126, 4130),
  ('901366008', '8', 'Box Medical Group SAS', 'BOGOTA', 'odoo_gcp', 94649437, 20488),
  ('901444979', '9', 'Alpha Medical & Co S.A.S.', NULL, 'odoo_gcp', 334245244, 4352),
  ('901450116', '4', 'Fixamed SAS', 'BARRANQUILLA', 'odoo_gcp', 63121738, 4794),
  ('901451514', '7', 'Genefix SAS', 'ENVIGADO', 'odoo_gcp', 78981266, 17089),
  ('901553213', '3', 'CKC Suministros SAS', 'BARRANQUILLA', 'odoo_gcp', 195755474, 10710),
  ('901564338', '2', 'Atencion Integral En Salud Global Medical SAS', 'CARTAGENA', 'odoo_gcp', 109726893, 25993),
  ('901818888', '3', 'Czmeditech-co SAS', 'BARRANQUILLA', 'odoo_gcp', 318610928, 20248),
  ('901852103', '4', 'Smqs Colombia SAS', 'PASTO', 'odoo_gcp', 27336711, 29795),
  ('901955714', '7', 'Medgraft Solutions SAS', 'BARRANQUILLA', 'odoo_gcp', 104980000, 33056),
  ('902005122', '5', 'Soluciones Medicas y Quirúrgicas SAS', 'BARRANQUILLA', 'odoo_gcp', 117914749, 35292),
  ('902079086', '5', 'Novum Surgical SAS', 'BARRANQUILLA', 'odoo_gcp', 114771773, 43714)
ON CONFLICT (nit) DO NOTHING;

INSERT INTO public.fuentes_estado (fuente, nombre, programacion, ejecutor) VALUES
  ('secop_ii',         'SECOP II · Contratos',               '0 6 * * *', 'vercel_cron'),
  ('secop_integrado',  'SECOP Integrado (I + II)',           '0 7 * * 1', 'vercel_cron'),
  ('reps_sedes',       'REPS · Sedes',                       '0 8 2 * *', 'vercel_cron'),
  ('bdua',             'BDUA · Afiliados por municipio',     '0 8 4 * *', 'vercel_cron'),
  ('minsalud_cifras',  'MinSalud · Cifras de aseguramiento', '0 8 5 * *', 'vercel_cron'),
  ('adres_identifica', 'ADRES · Identifica tu Giro',         '0 7 3 * *', 'github_actions')
ON CONFLICT (fuente) DO NOTHING;

-- Cargas manuales previas (2026-10-11): último OK = la fecha de la carga que ya está en la base.
DO $$
BEGIN
  IF to_regclass('public.reps_sedes') IS NOT NULL THEN
    UPDATE public.fuentes_estado f SET ultimo_ok = s.t, ultimo_intento = s.t, estado = 'ok', filas = s.n,
           mensaje = 'Carga manual previa (scripts/reps-load-sedes.ts)'
    FROM (SELECT max(imported_at) AS t, count(*)::int AS n FROM public.reps_sedes) s
    WHERE f.fuente = 'reps_sedes' AND f.ultimo_ok IS NULL AND s.t IS NOT NULL;
  END IF;
  IF to_regclass('public.bdua_afiliados') IS NOT NULL THEN
    UPDATE public.fuentes_estado f SET ultimo_ok = s.t, ultimo_intento = s.t, estado = 'ok', filas = s.n,
           mensaje = 'Carga manual previa (scripts/bdua-load.ts)'
    FROM (SELECT max(loaded_at) AS t, count(*)::int AS n FROM public.bdua_afiliados) s
    WHERE f.fuente = 'bdua' AND f.ultimo_ok IS NULL AND s.t IS NOT NULL;
  END IF;
  IF to_regclass('public.afiliacion_cifras') IS NOT NULL THEN
    UPDATE public.fuentes_estado f SET ultimo_ok = s.t, ultimo_intento = s.t, estado = 'ok', filas = s.n,
           mensaje = 'Carga manual previa (scripts/minsalud-cifras-load.ts)'
    FROM (SELECT max(loaded_at) AS t, count(*)::int AS n FROM public.afiliacion_cifras) s
    WHERE f.fuente = 'minsalud_cifras' AND f.ultimo_ok IS NULL AND s.t IS NOT NULL;
  END IF;
  IF to_regclass('public.adres_fetch_log') IS NOT NULL THEN
    UPDATE public.fuentes_estado f SET ultimo_ok = s.t, ultimo_intento = s.t, estado = 'ok', filas = s.n,
           mensaje = 'Carga manual previa (scripts/adres-identifica-giro.mjs)'
    FROM (SELECT max(fetched_at) AS t, coalesce(sum(filas), 0)::int AS n FROM public.adres_fetch_log
          WHERE fuente = 'adres_identifica_giro' AND estado IN ('ok', 'sin_registros')) s
    WHERE f.fuente = 'adres_identifica' AND f.ultimo_ok IS NULL AND s.t IS NOT NULL;
  END IF;
END;
$$;

-- -------------------------------------------------------------------------------------
-- 6. Comprobaciones (aborta la transacción si algo no cuadra)
-- -------------------------------------------------------------------------------------

DO $$
DECLARE
  t text;
  n bigint;
BEGIN
  FOREACH t IN ARRAY ARRAY['secop_proveedores_vigilados', 'secop_contratos', 'secop_ajustes', 'fuentes_estado'] LOOP
    IF to_regclass('public.' || t) IS NULL THEN RAISE EXCEPTION 'PR 7 SECOP: falta la tabla %', t; END IF;
    IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = ('public.' || t)::regclass) THEN
      RAISE EXCEPTION 'PR 7 SECOP: % sin RLS', t;
    END IF;
    SELECT count(*) INTO n FROM pg_policies WHERE schemaname = 'public' AND tablename = t;
    IF n > 0 THEN RAISE EXCEPTION 'PR 7 SECOP: % tiene % política(s)', t, n; END IF;
    IF has_table_privilege('anon', 'public.' || t, 'SELECT') OR has_table_privilege('authenticated', 'public.' || t, 'SELECT') THEN
      RAISE EXCEPTION 'PR 7 SECOP: anon/authenticated pueden leer %', t;
    END IF;
    IF NOT has_table_privilege('service_role', 'public.' || t, 'SELECT') THEN
      RAISE EXCEPTION 'PR 7 SECOP: service_role no puede leer %', t;
    END IF;
  END LOOP;
  IF has_table_privilege('anon', 'public.secop_contratos_unicos', 'SELECT') THEN
    RAISE EXCEPTION 'PR 7 SECOP: anon puede leer secop_contratos_unicos';
  END IF;
  IF has_function_privilege('anon', 'public.secop_marcar_atipicos(numeric, integer)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.secop_nits_ips()', 'EXECUTE') THEN
    RAISE EXCEPTION 'PR 7 SECOP: anon puede ejecutar las funciones';
  END IF;
  SELECT count(*) INTO n FROM public.secop_proveedores_vigilados WHERE origen = 'odoo_gcp';
  IF n < 76 THEN RAISE EXCEPTION 'PR 7 SECOP: se esperaban 76 proveedores vigilados de Odoo, hay %', n; END IF;
  SELECT count(*) INTO n FROM public.secop_ajustes;
  IF n <> 1 THEN RAISE EXCEPTION 'PR 7 SECOP: secop_ajustes debe tener 1 fila, tiene %', n; END IF;
  SELECT count(*) INTO n FROM public.fuentes_estado;
  IF n < 6 THEN RAISE EXCEPTION 'PR 7 SECOP: fuentes_estado debe tener 6 fuentes, tiene %', n; END IF;
  RAISE NOTICE 'PR 7 SECOP OK: 4 tablas, vista y 2 funciones; % fuentes; 76 proveedores vigilados.', n;
END;
$$;

COMMIT;
