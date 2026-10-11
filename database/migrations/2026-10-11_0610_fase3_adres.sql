-- =====================================================================================
-- OpMap · Fase 3 (giros directos de la ADRES) · 0610 — Esquema
-- Proyecto: norvxqgohddgsdkggqzq · Generado: 2026-10-11
--
-- Pedido del dueño (2026-10-11): "podemos hacer inteligencia de negocio con los giros directos
--   de la ADRES por NIT, así vemos qué IPS reciben más recursos por municipio".
--
-- Fuente: ADRES · SII_LMA_WEB · frmReportes.aspx?Reporte=29 ("Liquidación Mensual de Afiliados
--   Régimen Subsidiado" → "Reporte Giro a IPS"). Página pública, sin login. Por NIT del
--   PRESTADOR (sin dígito de verificación), por mes de proceso, tipo de contratación
--   (Capitación / Evento) y EPS. La carga la hace web/scripts/adres-giros.mjs.
--
-- LIMITACIONES (documentadas también en CLAUDE.md):
--   - Solo régimen SUBSIDIADO. El contributivo (servicios.adres.gov.co) devolvía error el
--     2026-10-11; la columna regimen ya admite 'contributivo' para cuando se pueda cargar.
--   - El giro es por NIT (prestador), NO por sede. Un NIT con varias sedes en OpMap (47 NIT el
--     2026-10-11, p. ej. Colsanitas con 10) recibe un solo valor; la app lo reparte entre sus
--     sedes en proporción a las camas solo para agregar por municipio/zona/ejecutivo.
--
-- Qué crea (todo ADITIVO; no toca ninguna tabla existente):
--   1. adres_giros      : una fila por (NIT, mes, régimen, tipo de contratación, EPS).
--   2. adres_fetch_log  : bitácora de cada consulta a la ADRES (ok / sin_registros / error).
--   3. adres_giros_resumen(desde, hasta, regimen) : agregado por NIT y mes en un solo jsonb
--      (la API lo usa para no paginar decenas de miles de filas por PostgREST).
--   Las 2 tablas con RLS activado, SIN políticas, sin privilegios para anon/authenticated/
--   PUBLIC y GRANT explícito a service_role. La función: SECURITY INVOKER, search_path fijo,
--   EXECUTE solo para service_role. Bloque DO final que comprueba todo y aborta si no cuadra.
--
-- Foto con SELECT antes de este script (2026-10-11):
--   - Ni adres_giros ni adres_fetch_log existen.
--   - hospitals: 787 filas (783 activas); 783 con code "NIT-DV"; 701 NIT distintos entre las
--     activas; 47 NIT repetidos (128 filas), 25 de ellos en varios municipios.
--   - gen_random_uuid() disponible (PostgreSQL 17.4).
--
-- Re-ejecutable: sí (IF NOT EXISTS / OR REPLACE / REVOKE-GRANT idempotentes).
-- Rollback: 2026-10-11_9930_adres_rollback.sql
-- =====================================================================================

BEGIN;

-- -------------------------------------------------------------------------------------
-- 1. Tablas
-- -------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.adres_giros (
  id                uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  nit               text          NOT NULL,
  periodo           date          NOT NULL,
  regimen           text          NOT NULL DEFAULT 'subsidiado',
  tipo_contratacion text          NOT NULL,
  eps_codigo        text          NOT NULL,
  eps_nombre        text,
  valor             numeric(18,2) NOT NULL,
  fuente            text          NOT NULL DEFAULT 'adres_reporte_29',
  fetched_at        timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT adres_giros_nit_check     CHECK (nit ~ '^[0-9]{5,12}$'),
  CONSTRAINT adres_giros_periodo_check CHECK (EXTRACT(DAY FROM periodo) = 1),
  CONSTRAINT adres_giros_regimen_check CHECK (regimen IN ('subsidiado', 'contributivo')),
  CONSTRAINT adres_giros_tipo_check    CHECK (length(btrim(tipo_contratacion)) > 0),
  CONSTRAINT adres_giros_eps_check     CHECK (length(btrim(eps_codigo)) > 0),
  CONSTRAINT adres_giros_unq UNIQUE (nit, periodo, regimen, tipo_contratacion, eps_codigo)
);

-- El UNIQUE ya indexa por nit (primera columna). Para filtrar por rango de meses:
CREATE INDEX IF NOT EXISTS adres_giros_periodo_idx ON public.adres_giros (periodo);

CREATE TABLE IF NOT EXISTS public.adres_fetch_log (
  id               uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  nit              text          NOT NULL,
  desde            date          NOT NULL,
  hasta            date          NOT NULL,
  estado           text          NOT NULL,
  mensaje          text,
  filas            integer,
  total            numeric(18,2),
  nombre_prestador text,
  regimen          text          NOT NULL DEFAULT 'subsidiado',
  fuente           text          NOT NULL DEFAULT 'adres_reporte_29',
  fetched_at       timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT adres_fetch_log_estado_check CHECK (estado IN ('ok', 'sin_registros', 'error')),
  CONSTRAINT adres_fetch_log_rango_check  CHECK (desde <= hasta),
  CONSTRAINT adres_fetch_log_filas_check  CHECK (filas IS NULL OR filas >= 0)
);

CREATE INDEX IF NOT EXISTS adres_fetch_log_nit_idx ON public.adres_fetch_log (nit, fetched_at DESC);

-- -------------------------------------------------------------------------------------
-- 2. Agregado por NIT y mes (un solo jsonb: evita el límite de filas de PostgREST)
--    [{ "nit": "891200679", "total": 123.00, "capitacion": 1.00, "evento": 2.00,
--       "meses": { "2025-01": { "t": 1023297295.00, "c": 120193764.00, "e": 903103531.00 } } }]
-- -------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.adres_giros_resumen(
  p_desde   date,
  p_hasta   date,
  p_regimen text DEFAULT 'subsidiado'
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  WITH mensual AS (
    SELECT g.nit,
           g.periodo,
           sum(g.valor) AS t,
           coalesce(sum(g.valor) FILTER (WHERE lower(g.tipo_contratacion) LIKE 'capitaci%'), 0) AS c,
           coalesce(sum(g.valor) FILTER (WHERE lower(g.tipo_contratacion) = 'evento'), 0) AS e
    FROM public.adres_giros g
    WHERE g.periodo BETWEEN p_desde AND p_hasta
      AND (p_regimen IS NULL OR g.regimen = p_regimen)
    GROUP BY g.nit, g.periodo
  ),
  por_nit AS (
    SELECT m.nit,
           jsonb_build_object(
             'nit', m.nit,
             'total', sum(m.t),
             'capitacion', sum(m.c),
             'evento', sum(m.e),
             'meses', jsonb_object_agg(to_char(m.periodo, 'YYYY-MM'),
                                       jsonb_build_object('t', m.t, 'c', m.c, 'e', m.e))
           ) AS obj
    FROM mensual m
    GROUP BY m.nit
  )
  SELECT coalesce(jsonb_agg(obj ORDER BY nit), '[]'::jsonb) FROM por_nit;
$$;

REVOKE ALL ON FUNCTION public.adres_giros_resumen(date, date, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.adres_giros_resumen(date, date, text) TO service_role;

-- -------------------------------------------------------------------------------------
-- 3. RLS activado y SIN políticas; fuera todo privilegio de anon/authenticated/PUBLIC.
--    service_role (bypass de RLS) recibe GRANT explícito.
-- -------------------------------------------------------------------------------------

ALTER TABLE public.adres_giros     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adres_fetch_log ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.adres_giros, public.adres_fetch_log FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.adres_giros, public.adres_fetch_log TO service_role;

-- -------------------------------------------------------------------------------------
-- 4. Documentación en el catálogo
-- -------------------------------------------------------------------------------------

COMMENT ON TABLE public.adres_giros IS
  'Giros directos de la ADRES a IPS (Reporte 29, régimen subsidiado) por NIT del prestador, mes de '
  'proceso, tipo de contratación y EPS. Lo carga web/scripts/adres-giros.mjs. El NIT es del '
  'prestador (sin DV), no de la sede.';
COMMENT ON COLUMN public.adres_giros.nit IS 'NIT del prestador SIN dígito de verificación (hospitals.code = "NIT-DV").';
COMMENT ON COLUMN public.adres_giros.periodo IS 'Mes de proceso del giro: primer día del mes.';
COMMENT ON COLUMN public.adres_giros.regimen IS 'subsidiado (Reporte 29). contributivo queda previsto, sin cargar.';
COMMENT ON COLUMN public.adres_giros.tipo_contratacion IS 'Tal como lo publica la ADRES: Capitacion, Evento…';
COMMENT ON COLUMN public.adres_giros.eps_codigo IS 'Código de la EPS pagadora (p. ej. EPSS41).';
COMMENT ON COLUMN public.adres_giros.valor IS 'Giro total en pesos colombianos.';
COMMENT ON COLUMN public.adres_giros.fetched_at IS 'Cuándo se descargó de la ADRES (las filas más viejas del rango se podan al recargar).';

COMMENT ON TABLE public.adres_fetch_log IS
  'Bitácora de consultas a la ADRES por NIT y rango (ok / sin_registros / error). El script la usa '
  'para reanudar: salta los NIT consultados con éxito hace poco salvo --force.';

COMMENT ON FUNCTION public.adres_giros_resumen(date, date, text) IS
  'Agregado por NIT y mes de adres_giros entre p_desde y p_hasta (primer día de mes), en un solo jsonb.';

-- -------------------------------------------------------------------------------------
-- 5. Comprobaciones (aborta la transacción si algo no cuadra)
-- -------------------------------------------------------------------------------------

DO $$
DECLARE
  t text;
  n integer;
BEGIN
  FOREACH t IN ARRAY ARRAY['adres_giros', 'adres_fetch_log'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace
      WHERE ns.nspname = 'public' AND c.relname = t AND c.relkind = 'r' AND c.relrowsecurity
    ) THEN
      RAISE EXCEPTION 'Fase 3 ADRES: la tabla public.% no existe o no tiene RLS activado', t;
    END IF;

    SELECT count(*) INTO n FROM pg_policies WHERE schemaname = 'public' AND tablename = t;
    IF n > 0 THEN
      RAISE EXCEPTION 'Fase 3 ADRES: public.% tiene % política(s); debe nacer sin políticas', t, n;
    END IF;

    SELECT count(*) INTO n
    FROM pg_class c, aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a
    WHERE c.oid = ('public.' || t)::regclass
      AND (a.grantee = 0
           OR a.grantee IN (SELECT oid FROM pg_roles WHERE rolname IN ('anon', 'authenticated')));
    IF n > 0 THEN
      RAISE EXCEPTION 'Fase 3 ADRES: public.% conserva % privilegio(s) para anon/authenticated/PUBLIC', t, n;
    END IF;

    IF NOT has_table_privilege('service_role', 'public.' || t, 'SELECT')
       OR NOT has_table_privilege('service_role', 'public.' || t, 'INSERT')
       OR NOT has_table_privilege('service_role', 'public.' || t, 'UPDATE')
       OR NOT has_table_privilege('service_role', 'public.' || t, 'DELETE') THEN
      RAISE EXCEPTION 'Fase 3 ADRES: service_role sin SELECT/INSERT/UPDATE/DELETE en public.%', t;
    END IF;
  END LOOP;

  IF has_function_privilege('anon', 'public.adres_giros_resumen(date, date, text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.adres_giros_resumen(date, date, text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Fase 3 ADRES: adres_giros_resumen() no debe ser ejecutable por anon/authenticated';
  END IF;
  IF NOT has_function_privilege('service_role', 'public.adres_giros_resumen(date, date, text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Fase 3 ADRES: service_role no puede ejecutar adres_giros_resumen()';
  END IF;

  SELECT count(*) INTO n
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name IN ('adres_giros', 'adres_fetch_log');
  IF n <> 22 THEN
    RAISE EXCEPTION 'Fase 3 ADRES: se esperaban 22 columnas en las 2 tablas; hay % (¿existían con otra forma?)', n;
  END IF;

  RAISE NOTICE 'Fase 3 ADRES OK: adres_giros y adres_fetch_log con RLS, 0 políticas, 0 privilegios para anon/authenticated; adres_giros_resumen() solo service_role. SIGUIENTE PASO: cd web && node scripts/adres-giros.mjs';
END;
$$;

COMMIT;
