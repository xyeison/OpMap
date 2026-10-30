-- =====================================================================================
-- OpMap · feat/agente-sia-observa (contratos y documentos de SIA Observa) · 0930 — Tablas de SIA, enlaces y bucket
-- Proyecto: norvxqgohddgsdkggqzq · Generado: 2026-10-30 · APLICADA el 2026-10-30 con autorización del dueño ("Aplicar y
--   desplegar"), en la misma ventana que el despliegue del PR #50.
--
-- Spec: docs/specs/2026-10-29-agente-sia-observa.md (sección 6 "Migración propuesta", ajustada a las convenciones del
--   repo y a lo visto con SELECT el 2026-10-30; ver "Notas de implementación").
--
-- Qué hace (ADITIVA salvo el punto 7: tablas, columnas y una fila nuevas; ninguna fila existente cambia):
--   1. public.sia_entidades: catálogo de entidades del portal de invitado (GUID de la cascada departamento → municipio →
--      entidad, o el `ide` de los enlaces a la ficha que ya hay en hospital_contracts). nit validado con Get_CTOs_Base.
--   2. hospitals.sia_entidad_id y hospitals.sia_mapeado_at.
--   3. public.sia_contratos: contratos reportados a SIA de las IPS de OpMap, SOLO de empresas (NIT de persona jurídica;
--      CHECK) y con objeto de las líneas (o ya registrados en hospital_contracts: alcance 'enlazado'). Sin columnas de
--      personas: el dueño no quiere datos de médicos de SIA, así que no hay es_persona ni proveedor_hash (la spec los
--      proponía; no hacen falta si nunca se guarda una persona). No se suma con secop_contratos: se enlaza por
--      secop_contrato_id (ON DELETE SET NULL: la reclasificación de SECOP puede reescribir filas).
--      Columnas de control de la carga: ficha_intentos/ficha_error (una ficha que falla no frena a las demás) e
--      ia_intentos/ia_lote_id/ia_ultimo_error (la lectura con IA no se repite ni se paga dos veces por el mismo lote).
--   4. public.contrato_documentos: documentos de la ficha (uno por (contrato, ianx, ianxa)) con su estado: descargado
--      (copia en el bucket), solo_enlace, anonimizacion_pendiente, restringido o error.
--   5. public.contrato_extracciones: lo que leyó Claude de los PDF (modelo, version_prompt, datos, discrepancias), y
--      public.secop_descartes_bandeja: los contratos de SECOP que alguien descartó en la bandeja /contracts/detectados
--      (con motivo). Tabla aparte porque secop_contratos no se toca (spec, sección 8).
--   6. hospital_contracts.sia_contrato_id, secop_contrato_id y lineas (los llena el formulario al importar).
--   7. hospital_contracts.check_contracting_model admite además 'subasta_inversa': el formulario ya ofrece "Subasta
--      Inversa" y hoy guardar con esa opción FALLA (el CHECK solo tenía directa, licitación e invitación privada).
--   8. RLS activado y SIN políticas en las 4 tablas; REVOKE a PUBLIC/anon/authenticated; GRANT a service_role.
--   9. Bucket privado 'contratos-sia' (solo PDF, 50 MB por archivo). Sin políticas de storage: solo service_role sube y
--      firma enlaces de 10 minutos (las rutas /api/sia/*).
--  10. Fila 'sia_observa' en fuentes_estado con ejecutor 'manual': SIA corta conexiones fuera de Colombia, así que la
--      carga corre en el Mac del dueño (scripts/sia-load.ts con launchd a las 02:00 de Bogotá = '0 7 * * *' UTC), no
--      en Vercel. El CHECK de ejecutor ya admite 'manual'.
--  11. Comentarios en el catálogo y bloque DO final que comprueba todo (con INSERT de prueba que se deshacen) o aborta.
--
-- Foto con SELECT antes de este script (2026-10-30): no existe ninguna de las 4 tablas; hospital_contracts tiene 93 filas
--   (53 con la ficha de SIA en documents_link) y check_contracting_model = (contratacion_directa, licitacion,
--   invitacion_privada); fuentes_estado tiene 8 fuentes y ninguna 'sia_observa'; storage.buckets solo tiene 'geojson'.
--
-- Requiere: hospitals, hospital_contracts, secop_contratos, fuentes_estado (0710) y update_updated_at_column().
-- Transaccional: todo o nada. Re-ejecutable: sí (IF NOT EXISTS / ON CONFLICT DO NOTHING / DROP CONSTRAINT IF EXISTS).
-- Tras aplicar: NOTIFY pgrst, 'reload schema';
-- Rollback: 2026-10-30_9958_sia_observa_rollback.sql. Costo Google: 0. No recalcula nada. No carga datos (la carga es
--   web/scripts/sia-entidades.ts y web/scripts/sia-load.ts, en el Mac del dueño).
-- =====================================================================================

BEGIN;

-- -------------------------------------------------------------------------------------
-- 0. Precondiciones
-- -------------------------------------------------------------------------------------

DO $$
BEGIN
  IF to_regclass('public.hospitals') IS NULL OR to_regclass('public.hospital_contracts') IS NULL
     OR to_regclass('public.secop_contratos') IS NULL OR to_regclass('public.fuentes_estado') IS NULL THEN
    RAISE EXCEPTION '0930 SIA: faltan hospitals, hospital_contracts, secop_contratos o fuentes_estado';
  END IF;
  IF to_regprocedure('public.update_updated_at_column()') IS NULL THEN
    RAISE EXCEPTION '0930 SIA: falta la función update_updated_at_column()';
  END IF;
END;
$$;

-- -------------------------------------------------------------------------------------
-- 1. Catálogo de entidades
-- -------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.sia_entidades (
  guid                 uuid         PRIMARY KEY,
  nombre               text         NOT NULL,
  departamento_sia_id  integer,
  departamento         text,
  municipio_sia_id     integer,
  municipio            text,
  nit                  text,
  hospital_id          uuid         REFERENCES public.hospitals (id) ON DELETE SET NULL,
  origen               text         NOT NULL DEFAULT 'cascada',
  prioridad            integer      NOT NULL DEFAULT 0,
  validado_at          timestamptz,
  created_at           timestamptz  NOT NULL DEFAULT now(),
  updated_at           timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT sia_entidades_nit_check     CHECK (nit IS NULL OR nit ~ '^[0-9]{9}$'),
  CONSTRAINT sia_entidades_origen_check  CHECK (origen IN ('cascada', 'contratos')),
  CONSTRAINT sia_entidades_validado_check CHECK (validado_at IS NULL OR nit IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS sia_entidades_nit_idx ON public.sia_entidades (nit);

-- -------------------------------------------------------------------------------------
-- 2. hospitals → entidad de SIA
-- -------------------------------------------------------------------------------------

ALTER TABLE public.hospitals
  ADD COLUMN IF NOT EXISTS sia_entidad_id uuid REFERENCES public.sia_entidades (guid) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sia_mapeado_at timestamptz;

-- -------------------------------------------------------------------------------------
-- 3. Contratos de SIA (solo empresas)
-- -------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.sia_contratos (
  id                       uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  sia_idc                  bigint        NOT NULL,
  entidad_guid             uuid          NOT NULL REFERENCES public.sia_entidades (guid),
  nit_entidad              text          NOT NULL,
  nombre_entidad           text,
  hospital_id              uuid          REFERENCES public.hospitals (id) ON DELETE SET NULL,
  anio                     integer,
  codigo                   text,
  codigo_norm              text,
  objeto                   text,
  fecha_firma              date,
  fecha_inicio             date,
  fecha_fin                date,
  fecha_fin_ampliada       date,
  dias                     integer,
  valor_inicial            numeric(18,2),
  adiciones                numeric(18,2),
  liberaciones             numeric(18,2),
  valor_vigente            numeric(18,2),
  modalidad                text,
  tipologia                text,
  tipo_contrato            text,
  nit_contratista          text          NOT NULL,
  contratista              text,
  tipo_contratista         text,
  contratistas             jsonb         NOT NULL DEFAULT '[]'::jsonb,
  linea                    text          NOT NULL,
  lineas                   text[]        NOT NULL DEFAULT '{}',
  clasificacion_version    text,
  alcance                  text          NOT NULL DEFAULT 'linea',
  estado_sia               text,
  fecha_creacion_sia       timestamptz,
  secop_contrato_id        uuid          REFERENCES public.secop_contratos (id) ON DELETE SET NULL,
  secop_cruce              text,
  hospital_contract_id     uuid          REFERENCES public.hospital_contracts (id) ON DELETE SET NULL,
  ficha_url                text          NOT NULL,
  ficha                    jsonb,
  ficha_leida_at           timestamptz,
  ficha_intentos           integer       NOT NULL DEFAULT 0,
  ficha_error              text,
  refrescar_solicitado_at  timestamptz,
  estado_revision          text          NOT NULL DEFAULT 'nuevo',
  motivo_descarte          text,
  revisado_por             uuid,
  revisado_at              timestamptz,
  ia_intentos              integer       NOT NULL DEFAULT 0,
  ia_lote_id               text,
  ia_ultimo_error          text,
  raw                      jsonb,
  imported_at              timestamptz   NOT NULL DEFAULT now(),
  updated_at               timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT sia_contratos_idc_unq              UNIQUE (sia_idc),
  CONSTRAINT sia_contratos_idc_check            CHECK (sia_idc > 0),
  CONSTRAINT sia_contratos_nit_entidad_check    CHECK (nit_entidad ~ '^[0-9]{5,12}$'),
  -- Privacidad: solo empresas (persona jurídica: 9 dígitos que empieza por 8 o 9, la regla de SECOP)
  CONSTRAINT sia_contratos_nit_contratista_check CHECK (nit_contratista ~ '^[89][0-9]{8}$'),
  CONSTRAINT sia_contratos_valores_check        CHECK (
    (valor_inicial IS NULL OR valor_inicial >= 0) AND (adiciones IS NULL OR adiciones >= 0)
    AND (liberaciones IS NULL OR liberaciones >= 0) AND (valor_vigente IS NULL OR valor_vigente >= 0)
  ),
  CONSTRAINT sia_contratos_alcance_check        CHECK (alcance IN ('linea', 'enlazado')),
  -- 'no_clasificado' solo si ya está en hospital_contracts (alcance enlazado): lo demás entra por su línea
  CONSTRAINT sia_contratos_linea_check          CHECK (
    linea IN ('trauma', 'reemplazo', 'columna', 'deportiva', 'neurocirugia', 'otros_implantes')
    OR (linea = 'no_clasificado' AND alcance = 'enlazado')
  ),
  CONSTRAINT sia_contratos_lineas_check         CHECK (lineas <@ ARRAY['trauma', 'reemplazo', 'columna', 'deportiva', 'neurocirugia', 'otros_implantes']::text[]),
  -- Con cruce siempre se sabe cómo. Al revés no se exige: si la reclasificación de SECOP borra la fila, el ON DELETE SET NULL
  -- deja secop_cruce sin id y el DELETE de secop_contratos no debe fallar (la próxima carga lo recalcula).
  CONSTRAINT sia_contratos_cruce_check          CHECK (
    (secop_cruce IS NULL OR secop_cruce IN ('codigo', 'contratista_fecha')) AND (secop_contrato_id IS NULL OR secop_cruce IS NOT NULL)
  ),
  CONSTRAINT sia_contratos_revision_check       CHECK (estado_revision IN ('nuevo', 'importado', 'descartado')),
  CONSTRAINT sia_contratos_descarte_check       CHECK (estado_revision <> 'descartado' OR length(trim(coalesce(motivo_descarte, ''))) > 0),
  CONSTRAINT sia_contratos_ficha_url_check      CHECK (ficha_url LIKE 'https://siaobserva.auditoria.gov.co/guess/cto_ficha_resumen_guess.aspx?idc=%')
);
CREATE INDEX IF NOT EXISTS sia_contratos_entidad_codigo_idx ON public.sia_contratos (nit_entidad, codigo_norm);
CREATE INDEX IF NOT EXISTS sia_contratos_hospital_idx       ON public.sia_contratos (hospital_id, fecha_firma);
CREATE INDEX IF NOT EXISTS sia_contratos_linea_idx          ON public.sia_contratos (linea);
CREATE INDEX IF NOT EXISTS sia_contratos_revision_idx       ON public.sia_contratos (estado_revision, fecha_firma);
CREATE INDEX IF NOT EXISTS sia_contratos_hc_idx             ON public.sia_contratos (hospital_contract_id);

-- -------------------------------------------------------------------------------------
-- 4. Documentos de la ficha
-- -------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.contrato_documentos (
  id               uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  sia_contrato_id  uuid         NOT NULL REFERENCES public.sia_contratos (id) ON DELETE CASCADE,
  nombre_archivo   text         NOT NULL,
  tipo             text         NOT NULL,
  ianx             bigint       NOT NULL,
  ianxa            bigint       NOT NULL,
  fuente_url       text         NOT NULL,
  fecha_cargue_sia date,
  estado           text         NOT NULL,
  error            text,
  storage_path     text,
  sha256           text,
  bytes            bigint,
  paginas          integer,
  tiene_texto      boolean,
  descargado_at    timestamptz,
  revisado_at      timestamptz  NOT NULL DEFAULT now(),
  created_at       timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT contrato_documentos_unq          UNIQUE (sia_contrato_id, ianx, ianxa),
  CONSTRAINT contrato_documentos_tipo_check   CHECK (tipo IN (
    'contrato', 'estudio_previo', 'anexo_tecnico', 'propuesta', 'poliza', 'cdp', 'rp',
    'acta_inicio', 'designacion_supervisor', 'novedad', 'liquidacion', 'otro')),
  CONSTRAINT contrato_documentos_estado_check CHECK (estado IN (
    'descargado', 'solo_enlace', 'anonimizacion_pendiente', 'restringido', 'error')),
  CONSTRAINT contrato_documentos_url_check    CHECK (fuente_url LIKE 'https://siaobserva.auditoria.gov.co/handlers/filehandler_guess_anonimo.ashx?%'),
  -- descargado ⇔ hay copia en el bucket con su sha256
  CONSTRAINT contrato_documentos_copia_check  CHECK (
    (estado = 'descargado') = (storage_path IS NOT NULL)
    AND (storage_path IS NULL OR (sha256 ~ '^[0-9a-f]{64}$' AND storage_path ~ ('^[0-9]{5,12}/[0-9]+/' || sha256 || '\.pdf$')))
  ),
  CONSTRAINT contrato_documentos_numeros_check CHECK ((bytes IS NULL OR bytes >= 0) AND (paginas IS NULL OR paginas >= 0))
);
CREATE INDEX IF NOT EXISTS contrato_documentos_contrato_idx ON public.contrato_documentos (sia_contrato_id);

-- -------------------------------------------------------------------------------------
-- 5. Lecturas de la IA
-- -------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.contrato_extracciones (
  id               uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  sia_contrato_id  uuid         NOT NULL REFERENCES public.sia_contratos (id) ON DELETE CASCADE,
  documento_ids    uuid[]       NOT NULL,
  modelo           text         NOT NULL,
  version_prompt   text         NOT NULL,
  lote_id          text,
  datos            jsonb        NOT NULL,
  items            jsonb,
  confianza        numeric,
  discrepancias    jsonb        NOT NULL DEFAULT '[]'::jsonb,
  uso              jsonb,
  revisado_por     uuid,
  revisado_at      timestamptz,
  created_at       timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT contrato_extracciones_docs_check      CHECK (cardinality(documento_ids) > 0),
  CONSTRAINT contrato_extracciones_confianza_check CHECK (confianza IS NULL OR (confianza >= 0 AND confianza <= 1))
);
CREATE INDEX IF NOT EXISTS contrato_extracciones_contrato_idx ON public.contrato_extracciones (sia_contrato_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.secop_descartes_bandeja (
  secop_contrato_id  uuid         PRIMARY KEY REFERENCES public.secop_contratos (id) ON DELETE CASCADE,
  motivo             text         NOT NULL,
  descartado_por     uuid,
  descartado_at      timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT secop_descartes_bandeja_motivo_check CHECK (length(trim(motivo)) > 0)
);

-- -------------------------------------------------------------------------------------
-- 6. Enlaces desde el módulo de contratos
-- -------------------------------------------------------------------------------------

ALTER TABLE public.hospital_contracts
  ADD COLUMN IF NOT EXISTS sia_contrato_id   uuid   REFERENCES public.sia_contratos (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS secop_contrato_id uuid   REFERENCES public.secop_contratos (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS lineas            text[];

-- -------------------------------------------------------------------------------------
-- 7. Modelo de contratación: el formulario ofrece "Subasta Inversa" y el CHECK no la admitía
-- -------------------------------------------------------------------------------------

ALTER TABLE public.hospital_contracts DROP CONSTRAINT IF EXISTS check_contracting_model;
ALTER TABLE public.hospital_contracts ADD CONSTRAINT check_contracting_model
  CHECK (contracting_model IS NULL OR contracting_model IN ('contratacion_directa', 'licitacion', 'invitacion_privada', 'subasta_inversa'));

-- -------------------------------------------------------------------------------------
-- 8. updated_at, RLS y privilegios
-- -------------------------------------------------------------------------------------

DROP TRIGGER IF EXISTS sia_entidades_updated_at ON public.sia_entidades;
CREATE TRIGGER sia_entidades_updated_at BEFORE UPDATE ON public.sia_entidades FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS sia_contratos_updated_at ON public.sia_contratos;
CREATE TRIGGER sia_contratos_updated_at BEFORE UPDATE ON public.sia_contratos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.sia_entidades         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sia_contratos         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contrato_documentos   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contrato_extracciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.secop_descartes_bandeja ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.sia_entidades, public.sia_contratos, public.contrato_documentos, public.contrato_extracciones, public.secop_descartes_bandeja FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.sia_entidades, public.sia_contratos, public.contrato_documentos, public.contrato_extracciones, public.secop_descartes_bandeja TO service_role;

-- -------------------------------------------------------------------------------------
-- 9. Bucket privado para los PDF (solo service_role: sin políticas en storage.objects)
-- -------------------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('contratos-sia', 'contratos-sia', false, 52428800, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- -------------------------------------------------------------------------------------
-- 10. Fuente (la carga es código local; aquí solo la fila de estado)
-- -------------------------------------------------------------------------------------

INSERT INTO public.fuentes_estado (fuente, nombre, programacion, ejecutor)
VALUES ('sia_observa', 'SIA Observa · Contratos y documentos', '0 7 * * *', 'manual')
ON CONFLICT (fuente) DO NOTHING;

-- -------------------------------------------------------------------------------------
-- 11. Documentación en el catálogo
-- -------------------------------------------------------------------------------------

COMMENT ON TABLE public.sia_entidades IS
  'Entidades del portal de invitado de SIA Observa (GUID de la cascada departamento → municipio → entidad, o el ide de los '
  'enlaces a la ficha de hospital_contracts). nit (9 dígitos sin DV) validado con Get_CTOs_Base. Lo carga '
  'web/scripts/sia-entidades.ts (local). Solo service_role.';
COMMENT ON COLUMN public.sia_entidades.prioridad IS 'Contratos clasificados de la entidad en secop_contratos: el sync recorre primero las de mayor prioridad.';
COMMENT ON COLUMN public.hospitals.sia_entidad_id IS 'Entidad de SIA Observa con el mismo NIT (la llena web/scripts/sia-entidades.ts).';
COMMENT ON TABLE public.sia_contratos IS
  'Contratos reportados a SIA Observa (Get_CTOs_Base) de las IPS de OpMap: solo empresas (CHECK del NIT) con objeto de las '
  'líneas (clasificador de SECOP) o ya registrados en hospital_contracts (alcance enlazado). De personas naturales no se guarda '
  'nada. No se suma con secop_contratos: se enlaza por secop_contrato_id. Lo carga web/scripts/sia-load.ts en el Mac del dueño '
  '(SIA corta conexiones fuera de Colombia). La carga nunca pisa estado_revision, motivo_descarte ni hospital_contract_id. '
  'Solo service_role.';
COMMENT ON COLUMN public.sia_contratos.codigo_norm IS 'cto_code en mayúsculas sin espacios, /, -, . ni _ (CD/26-1262 → CD261262): cruce con secop_contratos.referencia y hospital_contracts.contract_number.';
COMMENT ON COLUMN public.sia_contratos.valor_vigente IS 'cto_valor_vigente de SIA (inicial + adiciones − liberaciones): el valor que se propone al importar.';
COMMENT ON COLUMN public.sia_contratos.secop_cruce IS 'Cómo casó con SECOP: codigo (misma entidad y código) o contratista_fecha (NIT, firma ±7 días y valor).';
COMMENT ON COLUMN public.sia_contratos.ficha IS 'Ficha leída (sin personas: solo contratistas empresa; sin supervisores): publicación en SECOP, novedades.';
COMMENT ON COLUMN public.sia_contratos.refrescar_solicitado_at IS '"Actualizar desde SIA" en un contrato: la próxima corrida local relee la ficha si es posterior a ficha_leida_at.';
COMMENT ON COLUMN public.sia_contratos.ficha_intentos IS 'Lecturas fallidas de la ficha; a la tercera deja de intentarse sola (no frena a los demás cada noche). "Actualizar desde SIA" la vuelve a pedir.';
COMMENT ON COLUMN public.sia_contratos.ia_intentos IS 'Veces que se mandaron sus documentos a la IA (web/scripts/sia-extraer.ts no reintenta más de 2: cada intento cuesta).';
COMMENT ON COLUMN public.sia_contratos.ia_lote_id IS 'Lote de la Batch API en vuelo con este contrato (no se vuelve a mandar hasta recogerlo).';
COMMENT ON COLUMN public.sia_contratos.raw IS 'Fila original de Get_CTOs_Base sin el botón de detalle y con los contratistas reducidos a las empresas.';
COMMENT ON TABLE public.contrato_documentos IS
  'Documentos de la ficha de SIA (deduplicados por ianx, ianxa). descargado = copia en el bucket privado contratos-sia '
  '({nit_entidad}/{sia_idc}/{sha256}.pdf); solo_enlace = PDF que no se copia (no es de los tipos clave); '
  'anonimizacion_pendiente = el portal pide un correo (NUNCA se envía); restringido = Ley 1581. Solo service_role.';
COMMENT ON TABLE public.contrato_extracciones IS
  'Lectura de los PDF con Claude (web/scripts/sia-extraer.ts): datos con su página fuente, discrepancias con SIA, modelo y '
  'version_prompt. Sin cédulas ni nombres de personas naturales. Nada pasa a hospital_contracts sin aprobación humana. Solo service_role.';
COMMENT ON TABLE public.secop_descartes_bandeja IS
  'Contratos de SECOP descartados en la bandeja /contracts/detectados (con motivo): ya no se proponen para importar. No cambia secop_contratos. Solo service_role.';
COMMENT ON COLUMN public.hospital_contracts.sia_contrato_id IS 'Contrato de SIA del que se importó o con el que se enlazó (lo llena el formulario o el enlace de web/scripts/sia-load.ts).';
COMMENT ON COLUMN public.hospital_contracts.secop_contrato_id IS 'Contrato de SECOP del que se importó (o el cruce del de SIA).';
COMMENT ON COLUMN public.hospital_contracts.lineas IS 'Líneas del clasificador de SECOP del contrato importado.';

-- -------------------------------------------------------------------------------------
-- 12. Comprobaciones. Las pruebas que escriben van en sub-bloques que terminan con RAISE SQLSTATE 'P0930': PL/pgSQL
--     deshace todo lo del sub-bloque. Cualquier otra excepción aborta la migración.
-- -------------------------------------------------------------------------------------

DO $$
DECLARE
  t        text;
  n        bigint;
  guid_p   constant uuid := '00000000-0000-4000-8000-000000000930';
  nit_p    constant text := '999999920';
  sc_id    uuid;
BEGIN
  FOREACH t IN ARRAY ARRAY['sia_entidades', 'sia_contratos', 'contrato_documentos', 'contrato_extracciones', 'secop_descartes_bandeja'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace
      WHERE ns.nspname = 'public' AND c.relname = t AND c.relkind = 'r' AND c.relrowsecurity
    ) THEN
      RAISE EXCEPTION '0930 SIA: public.% no existe o no tiene RLS activado', t;
    END IF;
    SELECT count(*) INTO n FROM pg_policies WHERE schemaname = 'public' AND tablename = t;
    IF n > 0 THEN RAISE EXCEPTION '0930 SIA: % tiene % política(s); debe nacer sin políticas', t, n; END IF;
    IF has_table_privilege('anon', 'public.' || t, 'SELECT') OR has_table_privilege('authenticated', 'public.' || t, 'SELECT') THEN
      RAISE EXCEPTION '0930 SIA: anon/authenticated pueden leer %', t;
    END IF;
    IF NOT has_table_privilege('service_role', 'public.' || t, 'INSERT') THEN
      RAISE EXCEPTION '0930 SIA: service_role no puede escribir %', t;
    END IF;
  END LOOP;

  -- Sin columnas de personas en sia_contratos
  SELECT count(*) INTO n FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'sia_contratos' AND column_name IN ('es_persona', 'proveedor_hash', 'documento_proveedor');
  IF n > 0 THEN RAISE EXCEPTION '0930 SIA: sia_contratos no debe tener columnas de personas'; END IF;

  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'contratos-sia' AND public = false) THEN
    RAISE EXCEPTION '0930 SIA: el bucket contratos-sia no existe o es público';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.fuentes_estado WHERE fuente = 'sia_observa' AND programacion = '0 7 * * *' AND ejecutor = 'manual') THEN
    RAISE EXCEPTION '0930 SIA: falta la fuente sia_observa (0 7 * * *, manual)';
  END IF;
  SELECT count(*) INTO n FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'hospital_contracts' AND column_name IN ('sia_contrato_id', 'secop_contrato_id', 'lineas');
  IF n <> 3 THEN RAISE EXCEPTION '0930 SIA: faltan columnas en hospital_contracts (% de 3)', n; END IF;
  SELECT count(*) INTO n FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'hospitals' AND column_name IN ('sia_entidad_id', 'sia_mapeado_at');
  IF n <> 2 THEN RAISE EXCEPTION '0930 SIA: faltan columnas en hospitals (% de 2)', n; END IF;

  IF EXISTS (SELECT 1 FROM public.sia_entidades WHERE guid = guid_p) THEN
    RAISE EXCEPTION '0930 SIA: la entidad de prueba ya existe; no se puede probar';
  END IF;

  -- acepta una empresa con línea, una enlazada no clasificada y sus documentos; los valores existentes de
  -- contracting_model siguen siendo válidos
  BEGIN
    INSERT INTO public.sia_entidades (guid, nombre, nit, origen, validado_at) VALUES (guid_p, 'ENTIDAD DE PRUEBA 0930', nit_p, 'contratos', now());
    INSERT INTO public.sia_contratos (sia_idc, entidad_guid, nit_entidad, codigo, codigo_norm, nit_contratista, linea, lineas, ficha_url)
    VALUES (999000930, guid_p, nit_p, 'CD/26-0930', 'CD260930', '901386177', 'neurocirugia', ARRAY['neurocirugia'],
            'https://siaobserva.auditoria.gov.co/guess/cto_ficha_resumen_guess.aspx?idc=999000930')
    RETURNING id INTO sc_id;
    INSERT INTO public.sia_contratos (sia_idc, entidad_guid, nit_entidad, nit_contratista, linea, alcance, ficha_url)
    VALUES (999000921, guid_p, nit_p, '900078411', 'no_clasificado', 'enlazado',
            'https://siaobserva.auditoria.gov.co/guess/cto_ficha_resumen_guess.aspx?idc=999000921');
    INSERT INTO public.contrato_documentos (sia_contrato_id, nombre_archivo, tipo, ianx, ianxa, fuente_url, estado, storage_path, sha256)
    VALUES (sc_id, '13_contrato_prueba.pdf', 'contrato', 1, 2,
            'https://siaobserva.auditoria.gov.co/handlers/filehandler_guess_anonimo.ashx?ianx=1&ianxa=2&eid=' || guid_p,
            'descargado', nit_p || '/999000930/' || repeat('a', 64) || '.pdf', repeat('a', 64)),
           (sc_id, 'acta_inicio.pdf', 'acta_inicio', 3, 4,
            'https://siaobserva.auditoria.gov.co/handlers/filehandler_guess_anonimo.ashx?ianx=3&ianxa=4&eid=' || guid_p,
            'anonimizacion_pendiente', NULL, NULL);
    INSERT INTO public.contrato_extracciones (sia_contrato_id, documento_ids, modelo, version_prompt, datos)
    SELECT sc_id, array_agg(id), 'modelo-prueba', 'v-prueba', '{}'::jsonb FROM public.contrato_documentos WHERE sia_contrato_id = sc_id;
    -- la reclasificación de SECOP puede borrar una fila cruzada: el DELETE no debe fallar
    INSERT INTO public.secop_contratos (id, fuente, origen, id_contrato, nit_entidad)
    VALUES ('00000000-0000-4000-8000-000000000921', 'secop2', 'SECOPII', '__prueba_0930__', nit_p);
    UPDATE public.sia_contratos SET secop_contrato_id = '00000000-0000-4000-8000-000000000921', secop_cruce = 'codigo' WHERE id = sc_id;
    DELETE FROM public.secop_contratos WHERE id = '00000000-0000-4000-8000-000000000921';
    IF EXISTS (SELECT 1 FROM public.sia_contratos WHERE id = sc_id AND secop_contrato_id IS NOT NULL) THEN
      RAISE EXCEPTION '0930 SIA: borrar la fila de SECOP no dejó el cruce en null';
    END IF;
    SELECT count(*) INTO n FROM public.hospital_contracts
    WHERE contracting_model IS NOT NULL AND contracting_model NOT IN ('contratacion_directa', 'licitacion', 'invitacion_privada', 'subasta_inversa');
    IF n > 0 THEN RAISE EXCEPTION '0930 SIA: hay % contratos con un modelo fuera del CHECK nuevo', n; END IF;
    RAISE SQLSTATE 'P0930';
  EXCEPTION
    WHEN SQLSTATE 'P0930' THEN NULL;
    WHEN check_violation OR unique_violation OR foreign_key_violation THEN
      RAISE EXCEPTION '0930 SIA: los constraints rechazan una fila válida de prueba: %', SQLERRM;
  END;

  -- rechaza: contratista persona natural (cédula), no_clasificado con alcance linea, descarte sin motivo, documento
  -- descargado sin copia, URL de documento de otro handler, idc repetido
  BEGIN
    INSERT INTO public.sia_entidades (guid, nombre, nit) VALUES (guid_p, 'ENTIDAD DE PRUEBA 0930', nit_p);
    BEGIN
      INSERT INTO public.sia_contratos (sia_idc, entidad_guid, nit_entidad, nit_contratista, linea, ficha_url)
      VALUES (999000930, guid_p, nit_p, '1052345678', 'trauma', 'https://siaobserva.auditoria.gov.co/guess/cto_ficha_resumen_guess.aspx?idc=999000930');
      RAISE EXCEPTION '0930 SIA: aceptó un contratista persona natural';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
      INSERT INTO public.sia_contratos (sia_idc, entidad_guid, nit_entidad, nit_contratista, linea, ficha_url)
      VALUES (999000931, guid_p, nit_p, '901386177', 'no_clasificado', 'https://siaobserva.auditoria.gov.co/guess/cto_ficha_resumen_guess.aspx?idc=999000931');
      RAISE EXCEPTION '0930 SIA: aceptó no_clasificado con alcance linea';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
      INSERT INTO public.sia_contratos (sia_idc, entidad_guid, nit_entidad, nit_contratista, linea, estado_revision, ficha_url)
      VALUES (999000932, guid_p, nit_p, '901386177', 'trauma', 'descartado', 'https://siaobserva.auditoria.gov.co/guess/cto_ficha_resumen_guess.aspx?idc=999000932');
      RAISE EXCEPTION '0930 SIA: aceptó un descarte sin motivo';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    INSERT INTO public.sia_contratos (sia_idc, entidad_guid, nit_entidad, nit_contratista, linea, ficha_url)
    VALUES (999000933, guid_p, nit_p, '901386177', 'trauma', 'https://siaobserva.auditoria.gov.co/guess/cto_ficha_resumen_guess.aspx?idc=999000933')
    RETURNING id INTO sc_id;
    BEGIN
      INSERT INTO public.contrato_documentos (sia_contrato_id, nombre_archivo, tipo, ianx, ianxa, fuente_url, estado)
      VALUES (sc_id, 'x.pdf', 'contrato', 1, 2, 'https://siaobserva.auditoria.gov.co/handlers/filehandler_guess_anonimo.ashx?ianx=1&ianxa=2', 'descargado');
      RAISE EXCEPTION '0930 SIA: aceptó un documento descargado sin copia en el bucket';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
      INSERT INTO public.contrato_documentos (sia_contrato_id, nombre_archivo, tipo, ianx, ianxa, fuente_url, estado)
      VALUES (sc_id, 'x.pdf', 'contrato', 1, 2, 'https://siaobserva.auditoria.gov.co/handlers/otro_handler.ashx?id=1', 'solo_enlace');
      RAISE EXCEPTION '0930 SIA: aceptó un documento de otro handler';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
      INSERT INTO public.sia_contratos (sia_idc, entidad_guid, nit_entidad, nit_contratista, linea, ficha_url)
      VALUES (999000933, guid_p, nit_p, '901386177', 'trauma', 'https://siaobserva.auditoria.gov.co/guess/cto_ficha_resumen_guess.aspx?idc=999000933');
      RAISE EXCEPTION '0930 SIA: aceptó un idc repetido';
    EXCEPTION WHEN unique_violation THEN NULL;
    END;
    RAISE SQLSTATE 'P0930';
  EXCEPTION
    WHEN SQLSTATE 'P0930' THEN NULL;
  END;

  IF EXISTS (SELECT 1 FROM public.sia_entidades WHERE guid = guid_p) OR EXISTS (SELECT 1 FROM public.sia_contratos WHERE nit_entidad = nit_p) THEN
    RAISE EXCEPTION '0930 SIA: quedaron filas de prueba';
  END IF;

  RAISE NOTICE '0930 SIA OK: sia_entidades, sia_contratos, contrato_documentos, contrato_extracciones y secop_descartes_bandeja (RLS, sin políticas, solo service_role), columnas en hospitals y hospital_contracts, subasta_inversa en check_contracting_model, bucket privado contratos-sia y fuente sia_observa. SIGUIENTE PASO: NOTIFY pgrst, ''reload schema''; luego web/scripts/sia-entidades.ts en el Mac del dueño.';
END;
$$;

COMMIT;
