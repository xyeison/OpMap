-- =====================================================================================
-- OpMap · Giros ADRES "Identifica tu Giro" (detalle por giro) · 0630 — Esquema
-- Proyecto: norvxqgohddgsdkggqzq · Generado: 2026-10-11
--
-- Pedido del dueño (2026-10-11): cargar los giros de "Identifica tu Giro" (ERP de la ADRES), que
--   incluyen el régimen CONTRIBUTIVO (compensación) y datos de 2026; el Reporte 29 (0610) solo
--   tiene subsidiado hasta jun-2025. Autorización: "Autorizo todo. Procede."
--
-- Fuente: https://aplicaciones.adres.gov.co/ERP/Default.aspx (visor SSRS "Consulta_Pagos_ERP",
--   público, sin login). Parámetros: Fecha Inicio, Fecha Fin (dd/mm/aaaa) y "NIT EPS o IPS
--   Beneficiaria" (sin DV). Una fila por giro: NIT beneficiario, fecha de transacción, valor (el
--   XML trae centavos; el CSV viene redondeado a pesos), concepto y entidad ordenadora
--   ("NIT-800251440-ENTIDAD PROMOTORA DE SALUD SANITAS S A S"). La carga la hace
--   web/scripts/adres-identifica-giro.mjs. Datos publicados desde abr-2025 (consultado el 2026-10-11).
--
-- Regla de régimen (la aplica el script con regimenDeConcepto() de web/lib/adres-identifica.mjs):
--   1. subsidiado   si el concepto (sin tildes, sin mayúsculas) contiene "subsidiado" o la palabra
--                   "lma" ("LMA_186_IPS", "PROCESO LMA"; no "palma") (LMA = Liquidación Mensual de
--                   Afiliados; incluye presupuesto máximo subsidiado);
--   2. contributivo si contiene "compensacion", "regimen contributivo", "cgd_proc" o "proceso_<n>_gd_"
--                   (giro directo de la compensación con el formato viejo, sin la palabra);
--   3. otro         en cualquier otro caso (recobros NO UPC, reclamaciones SOAT/ECAT, pruebas COVID,
--                   resoluciones del MSPS…).
--   En los giros LMA "CXP IPS" del subsidiado la ADRES registra como "entidad ordenadora" al ente
--   territorial (municipio o departamento) de la liquidación, no a la EPS (en "CXP EPS" y presupuestos
--   máximos sí figura la EPS): las columnas eps_ordenadora_* guardan lo que publica la ADRES.
--
-- Qué crea (todo ADITIVO; no toca ninguna tabla ni función existente):
--   1. adres_giros_detalle : una fila por giro (UNIQUE por huella sha256 estable, ver abajo).
--   2. adres_giros_mensual : vista (security_invoker) que agrega el detalle por NIT, mes, régimen y
--                            entidad ordenadora, con la forma de adres_giros.
--   3. adres_giros_intel(fuente, desde, hasta, regimen) : agregado por NIT (totales, por régimen, por
--                            tipo, por mes, por entidad ordenadora, último giro) en UN jsonb, para
--                            cualquiera de las dos fuentes ('identifica' = este detalle, 'reporte29' =
--                            adres_giros). La usa GET /api/intelligence/giros.
--   adres_fetch_log (0610) se reutiliza con fuente = 'adres_identifica_giro' y regimen = 'todos'
--   (esa columna no tiene CHECK).
--   Tabla y vista con RLS/privilegios: RLS activado SIN políticas, sin privilegios para anon/
--   authenticated/PUBLIC y GRANT explícito a service_role. La función: SECURITY INVOKER, search_path
--   fijo, EXECUTE solo para service_role. Bloque DO final que comprueba todo y aborta si no cuadra.
--
-- Huella (clave única): sha256 hex de
--   nit|fecha_giro|valor (2 decimales)|concepto (espacios colapsados)|NIT ordenadora (o su nombre si no
--   trae NIT)|ocurrencia
--   "ocurrencia" numera (1, 2…) los giros idénticos de una misma descarga, para no fundir dos pagos
--   iguales el mismo día. La calcula el script (detalleKey() de web/lib/adres-identifica.mjs).
--
-- Foto con SELECT antes de este script (2026-10-11):
--   - adres_giros: 62.992 filas, 556 NIT, periodos 2023-07-01 a 2025-06-01.
--   - adres_fetch_log: 704 filas, todas fuente adres_reporte_29 / régimen subsidiado.
--   - No existen adres_giros_detalle, adres_giros_mensual ni adres_giros_intel(). PostgreSQL 17.4.
--
-- Re-ejecutable: sí (IF NOT EXISTS / OR REPLACE / REVOKE-GRANT idempotentes).
-- Rollback: 2026-10-11_9930_adres_detalle_rollback.sql
-- =====================================================================================

BEGIN;

-- -------------------------------------------------------------------------------------
-- 1. Tabla de detalle
-- -------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.adres_giros_detalle (
  id                    uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  nit                   text          NOT NULL,
  fecha_giro            date          NOT NULL,
  valor                 numeric(18,2) NOT NULL,
  concepto              text          NOT NULL DEFAULT '',
  proceso               text,
  referencia            text,
  eps_ordenadora_nit    text,
  eps_ordenadora_nombre text,
  regimen               text          NOT NULL,
  fuente                text          NOT NULL DEFAULT 'adres_identifica_giro',
  ocurrencia            smallint      NOT NULL DEFAULT 1,
  huella                text          NOT NULL,
  fetched_at            timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT adres_giros_detalle_nit_check        CHECK (nit ~ '^[0-9]{5,12}$'),
  CONSTRAINT adres_giros_detalle_ordenadora_check CHECK (eps_ordenadora_nit IS NULL OR eps_ordenadora_nit ~ '^[0-9]{5,12}$'),
  CONSTRAINT adres_giros_detalle_regimen_check    CHECK (regimen IN ('contributivo', 'subsidiado', 'otro')),
  CONSTRAINT adres_giros_detalle_ocurrencia_check CHECK (ocurrencia >= 1),
  CONSTRAINT adres_giros_detalle_huella_check     CHECK (huella ~ '^[0-9a-f]{64}$'),
  CONSTRAINT adres_giros_detalle_huella_unq       UNIQUE (huella)
);

CREATE INDEX IF NOT EXISTS adres_giros_detalle_nit_fecha_idx ON public.adres_giros_detalle (nit, fecha_giro);
CREATE INDEX IF NOT EXISTS adres_giros_detalle_fecha_idx     ON public.adres_giros_detalle (fecha_giro);

-- -------------------------------------------------------------------------------------
-- 2. Vista mensual (forma de adres_giros: nit, periodo, regimen, entidad, valor)
-- -------------------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.adres_giros_mensual
WITH (security_invoker = true) AS
SELECT d.nit,
       date_trunc('month', d.fecha_giro)::date                              AS periodo,
       d.regimen,
       d.eps_ordenadora_nit,
       (array_agg(d.eps_ordenadora_nombre ORDER BY d.fecha_giro DESC))[1]   AS eps_ordenadora_nombre,
       sum(d.valor)                                                         AS valor,
       count(*)::integer                                                    AS giros,
       max(d.fecha_giro)                                                    AS ultima_fecha,
       'adres_identifica_giro'::text                                        AS fuente
FROM public.adres_giros_detalle d
GROUP BY d.nit, date_trunc('month', d.fecha_giro), d.regimen, d.eps_ordenadora_nit;

-- -------------------------------------------------------------------------------------
-- 3. Agregado por NIT para la API, de cualquiera de las dos fuentes, en un solo jsonb
--    { "nits": [ { "nit", "total", "capitacion", "evento", "contributivo", "subsidiado", "otro",
--                  "ultima": "YYYY-MM-DD", "meses": { "2026-01": { "t", "c", "e", "rc", "rs", "ro" } },
--                  "eps": { "<clave>": valor } } ],
--      "eps": { "<clave>": "<nombre más reciente>" } }
--    Clave de entidad: NIT de la ordenadora (identifica) o código de la EPS (reporte29); sin NIT,
--    'nombre:<texto>'. Las claves nulas se omiten (jsonb_strip_nulls): el lector las toma como 0.
--    p_regimen NULL = todos.
-- -------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.adres_giros_intel(
  p_fuente  text,
  p_desde   date,
  p_hasta   date,
  p_regimen text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  WITH base AS (
    SELECT d.nit,
           date_trunc('month', d.fecha_giro)::date AS periodo,
           d.fecha_giro AS fecha,
           d.regimen,
           NULL::text AS tipo,
           coalesce(d.eps_ordenadora_nit, 'nombre:' || coalesce(nullif(btrim(d.eps_ordenadora_nombre), ''), 'sin entidad')) AS eps_key,
           d.eps_ordenadora_nombre AS eps_nombre,
           d.valor
    FROM public.adres_giros_detalle d
    WHERE p_fuente = 'identifica'
      AND d.fecha_giro BETWEEN p_desde AND p_hasta
      AND (p_regimen IS NULL OR d.regimen = p_regimen)
    UNION ALL
    SELECT g.nit,
           g.periodo,
           g.periodo AS fecha,
           g.regimen,
           g.tipo_contratacion AS tipo,
           g.eps_codigo AS eps_key,
           g.eps_nombre,
           g.valor
    FROM public.adres_giros g
    WHERE p_fuente = 'reporte29'
      AND g.periodo BETWEEN p_desde AND p_hasta
      AND (p_regimen IS NULL OR g.regimen = p_regimen)
  ),
  mensual AS (
    SELECT b.nit,
           b.periodo,
           jsonb_strip_nulls(jsonb_build_object(
             't',  sum(b.valor),
             'c',  sum(b.valor) FILTER (WHERE lower(b.tipo) LIKE 'capitaci%'),
             'e',  sum(b.valor) FILTER (WHERE lower(b.tipo) = 'evento'),
             'rc', sum(b.valor) FILTER (WHERE b.regimen = 'contributivo'),
             'rs', sum(b.valor) FILTER (WHERE b.regimen = 'subsidiado'),
             'ro', sum(b.valor) FILTER (WHERE b.regimen = 'otro')
           )) AS obj
    FROM base b
    GROUP BY b.nit, b.periodo
  ),
  meses AS (
    SELECT m.nit, jsonb_object_agg(to_char(m.periodo, 'YYYY-MM'), m.obj) AS obj
    FROM mensual m
    GROUP BY m.nit
  ),
  eps_nit AS (
    SELECT x.nit, jsonb_object_agg(x.eps_key, x.v) AS obj
    FROM (SELECT b.nit, b.eps_key, sum(b.valor) AS v FROM base b GROUP BY b.nit, b.eps_key) x
    GROUP BY x.nit
  ),
  totales AS (
    SELECT b.nit,
           jsonb_strip_nulls(jsonb_build_object(
             'nit', b.nit,
             'total', sum(b.valor),
             'capitacion', sum(b.valor) FILTER (WHERE lower(b.tipo) LIKE 'capitaci%'),
             'evento', sum(b.valor) FILTER (WHERE lower(b.tipo) = 'evento'),
             'contributivo', sum(b.valor) FILTER (WHERE b.regimen = 'contributivo'),
             'subsidiado', sum(b.valor) FILTER (WHERE b.regimen = 'subsidiado'),
             'otro', sum(b.valor) FILTER (WHERE b.regimen = 'otro'),
             'ultima', to_char(max(b.fecha), 'YYYY-MM-DD')
           )) AS obj
    FROM base b
    GROUP BY b.nit
  ),
  nombres AS (
    SELECT jsonb_object_agg(n.eps_key, n.nombre) AS obj
    FROM (
      SELECT b.eps_key, (array_agg(b.eps_nombre ORDER BY b.fecha DESC) FILTER (WHERE b.eps_nombre IS NOT NULL))[1] AS nombre
      FROM base b
      GROUP BY b.eps_key
    ) n
    WHERE n.nombre IS NOT NULL
  )
  SELECT jsonb_build_object(
    'nits', coalesce((
      SELECT jsonb_agg(t.obj || jsonb_build_object('meses', coalesce(m.obj, '{}'::jsonb), 'eps', coalesce(e.obj, '{}'::jsonb)) ORDER BY t.nit)
      FROM totales t
      LEFT JOIN meses m ON m.nit = t.nit
      LEFT JOIN eps_nit e ON e.nit = t.nit
    ), '[]'::jsonb),
    'eps', coalesce((SELECT obj FROM nombres), '{}'::jsonb)
  );
$$;

REVOKE ALL ON FUNCTION public.adres_giros_intel(text, date, date, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.adres_giros_intel(text, date, date, text) TO service_role;

-- -------------------------------------------------------------------------------------
-- 4. RLS activado y SIN políticas; fuera todo privilegio de anon/authenticated/PUBLIC.
--    service_role (bypass de RLS) recibe GRANT explícito. La vista es security_invoker:
--    quien la consulta necesita privilegios sobre la tabla (solo service_role los tiene).
-- -------------------------------------------------------------------------------------

ALTER TABLE public.adres_giros_detalle ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.adres_giros_detalle FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.adres_giros_mensual FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.adres_giros_detalle TO service_role;
GRANT SELECT ON TABLE public.adres_giros_mensual TO service_role;

-- -------------------------------------------------------------------------------------
-- 5. Documentación en el catálogo
-- -------------------------------------------------------------------------------------

COMMENT ON TABLE public.adres_giros_detalle IS
  'Giros de la ADRES a IPS por giro ("Identifica tu Giro", ERP Consulta_Pagos_ERP): contributivo, '
  'subsidiado y otros conceptos, desde abr-2025. Lo carga web/scripts/adres-identifica-giro.mjs. '
  'El NIT es del prestador (sin DV), no de la sede.';
COMMENT ON COLUMN public.adres_giros_detalle.nit IS 'NIT beneficiario SIN dígito de verificación (Cuenta_Beneficiario).';
COMMENT ON COLUMN public.adres_giros_detalle.fecha_giro IS 'Fecha de la transacción (Fecha_Transaccion).';
COMMENT ON COLUMN public.adres_giros_detalle.valor IS 'Valor girado en pesos (del XML del reporte: con centavos).';
COMMENT ON COLUMN public.adres_giros_detalle.concepto IS 'Concepto tal como lo publica la ADRES, con los espacios colapsados.';
COMMENT ON COLUMN public.adres_giros_detalle.proceso IS 'Número de proceso extraído del concepto ("Proceso 12056" → 12056); NULL si no trae.';
COMMENT ON COLUMN public.adres_giros_detalle.referencia IS 'Referencia final del concepto (CGD_Proc_12041_EPS005_269_C, LMA_186_IPS…); NULL si no trae.';
COMMENT ON COLUMN public.adres_giros_detalle.eps_ordenadora_nit IS 'NIT de la entidad ordenadora (EPS; en la LMA del subsidiado, el ente territorial).';
COMMENT ON COLUMN public.adres_giros_detalle.eps_ordenadora_nombre IS 'Nombre de la entidad ordenadora tal como lo publica la ADRES.';
COMMENT ON COLUMN public.adres_giros_detalle.regimen IS 'contributivo | subsidiado | otro, derivado del concepto (regla en el encabezado de la migración 0630).';
COMMENT ON COLUMN public.adres_giros_detalle.ocurrencia IS 'Número de giro idéntico dentro de una misma descarga (1, 2…).';
COMMENT ON COLUMN public.adres_giros_detalle.huella IS 'sha256 de nit|fecha|valor|concepto|ordenadora|ocurrencia: clave única estable para el upsert.';

COMMENT ON VIEW public.adres_giros_mensual IS
  'adres_giros_detalle agregado por NIT, mes (periodo = día 1), régimen y entidad ordenadora.';

COMMENT ON FUNCTION public.adres_giros_intel(text, date, date, text) IS
  'Agregado por NIT (totales, régimen, tipo, meses, entidades, último giro) de adres_giros_detalle '
  '(p_fuente = identifica) o adres_giros (p_fuente = reporte29) entre p_desde y p_hasta, en un jsonb.';

-- -------------------------------------------------------------------------------------
-- 6. Comprobaciones (aborta la transacción si algo no cuadra)
-- -------------------------------------------------------------------------------------

DO $$
DECLARE
  n integer;
  probe jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace
    WHERE ns.nspname = 'public' AND c.relname = 'adres_giros_detalle' AND c.relkind = 'r' AND c.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'ADRES 0630: la tabla public.adres_giros_detalle no existe o no tiene RLS activado';
  END IF;

  SELECT count(*) INTO n FROM pg_policies WHERE schemaname = 'public' AND tablename = 'adres_giros_detalle';
  IF n > 0 THEN
    RAISE EXCEPTION 'ADRES 0630: adres_giros_detalle tiene % política(s); debe nacer sin políticas', n;
  END IF;

  SELECT count(*) INTO n
  FROM pg_class c, aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a
  WHERE c.oid IN ('public.adres_giros_detalle'::regclass, 'public.adres_giros_mensual'::regclass)
    AND (a.grantee = 0
         OR a.grantee IN (SELECT oid FROM pg_roles WHERE rolname IN ('anon', 'authenticated')));
  IF n > 0 THEN
    RAISE EXCEPTION 'ADRES 0630: la tabla o la vista conservan % privilegio(s) para anon/authenticated/PUBLIC', n;
  END IF;

  IF NOT has_table_privilege('service_role', 'public.adres_giros_detalle', 'SELECT')
     OR NOT has_table_privilege('service_role', 'public.adres_giros_detalle', 'INSERT')
     OR NOT has_table_privilege('service_role', 'public.adres_giros_detalle', 'UPDATE')
     OR NOT has_table_privilege('service_role', 'public.adres_giros_detalle', 'DELETE')
     OR NOT has_table_privilege('service_role', 'public.adres_giros_mensual', 'SELECT') THEN
    RAISE EXCEPTION 'ADRES 0630: service_role sin los privilegios esperados en la tabla o la vista';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    WHERE c.oid = 'public.adres_giros_mensual'::regclass
      AND c.relkind = 'v'
      AND coalesce(c.reloptions, '{}'::text[]) @> ARRAY['security_invoker=true']
  ) THEN
    RAISE EXCEPTION 'ADRES 0630: la vista adres_giros_mensual debe ser security_invoker';
  END IF;

  IF has_function_privilege('anon', 'public.adres_giros_intel(text, date, date, text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.adres_giros_intel(text, date, date, text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'ADRES 0630: adres_giros_intel() no debe ser ejecutable por anon/authenticated';
  END IF;
  IF NOT has_function_privilege('service_role', 'public.adres_giros_intel(text, date, date, text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'ADRES 0630: service_role no puede ejecutar adres_giros_intel()';
  END IF;

  SELECT count(*) INTO n FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'adres_giros_detalle';
  IF n <> 14 THEN
    RAISE EXCEPTION 'ADRES 0630: se esperaban 14 columnas en adres_giros_detalle; hay % (¿existía con otra forma?)', n;
  END IF;

  -- La función responde con la forma esperada en las dos fuentes (rango vacío: sin datos).
  probe := public.adres_giros_intel('identifica', DATE '1900-01-01', DATE '1900-01-31', NULL);
  IF probe IS NULL OR jsonb_typeof(probe -> 'nits') <> 'array' OR jsonb_typeof(probe -> 'eps') <> 'object' THEN
    RAISE EXCEPTION 'ADRES 0630: adres_giros_intel(identifica) no devuelve {nits:[], eps:{}}: %', probe;
  END IF;
  probe := public.adres_giros_intel('reporte29', DATE '1900-01-01', DATE '1900-01-31', 'subsidiado');
  IF probe IS NULL OR jsonb_typeof(probe -> 'nits') <> 'array' THEN
    RAISE EXCEPTION 'ADRES 0630: adres_giros_intel(reporte29) no devuelve {nits:[]}: %', probe;
  END IF;

  RAISE NOTICE 'ADRES 0630 OK: adres_giros_detalle con RLS, 0 políticas, 0 privilegios para anon/authenticated; vista adres_giros_mensual security_invoker; adres_giros_intel() solo service_role. SIGUIENTE PASO: cd web && node scripts/adres-identifica-giro.mjs --help';
END;
$$;

COMMIT;
