-- =====================================================================================
-- OpMap · feat/secop-i-valores-reales (SECOP I con valor adjudicado y "Compra pública" manual) · 9931 — Rollback de 0730
-- Proyecto: norvxqgohddgsdkggqzq · Generado: 2026-10-12
--
-- ORDEN: va ANTES de 2026-10-11_9929_secop_api_rollback.sql y de 2026-10-11_9930_secop_rollback.sql si se
--   deshacen los tres. Deja la vista secop_contratos_unicos, secop_nits_ips() y secop_hechos() EXACTAMENTE
--   con su definición de 0710 / 0720 (copiadas de esos archivos), así que 9929 y 9930 siguen valiendo tal cual.
--
-- ANTES DE EJECUTAR: volver a desplegar el código anterior a este PR y quitar el cron /api/cron/secop_i de
--   web/vercel.json. El código nuevo escribe fuente = 'secop1' y las columnas valor_proceso/valor_adiciones,
--   lee hospitals.compra_publica y la clave 'est' de secop_hechos(): con el esquema viejo fallaría.
--
-- Qué deshace (una sola transacción, todo o nada):
--   1. Borra las filas de secop_contratos con fuente = 'secop1' (obligatorio antes de restaurar el constraint
--      secop_contratos_fuente_check de 0710, que no admite 'secop1').
--   2. Borra la vista secop_contratos_unicos (CREATE OR REPLACE no puede quitar la columna estimado, y la vista
--      depende de las columnas que se van), el índice secop_contratos_secop1_constancia_idx, el constraint
--      secop_contratos_valor_proceso_check y las columnas valor_proceso / valor_adiciones; restaura
--      secop_contratos_fuente_check y secop_contratos_fuente_origen como en 0710 y los COMMENT de 0710.
--   3. Vuelve a crear la vista (0710), secop_nits_ips() (0710) y secop_hechos() (0720) con su definición
--      original y re-aplica REVOKE/GRANT (solo service_role).
--   4. Pone hospitals.compra_publica a NULL (NOTICE con cuántas marcas manuales se pierden) y borra la columna.
--   5. Borra la fila 'secop_i' de fuentes_estado.
--
-- PÉRDIDAS:
--   - Los contratos de SECOP I (f789-7hwg) descargados: datos públicos; se recuperan re-aplicando 0730 y
--     corriendo `cd web && npx tsx scripts/secop-load.ts --fuente secop1 --inicial` (minutos, sin costo).
--   - Las marcas manuales "Compra pública" (incluidas las 10 de la semilla) y el historial/cursor de la fuente
--     secop_i. Exportar antes `SELECT code, name, nit, compra_publica FROM hospitals WHERE compra_publica IS
--     NOT NULL` si importan.
--   - Los contratos de SECOP II / Integrado de las 10 entidades nuevas NO se borran (siguen en secop_contratos
--     con el código viejo; el cron deja de traer los nuevos si la entidad no tiene REPS pública/mixta).
--
-- Re-ejecutable: sí (IF EXISTS / DROP IF EXISTS + ADD / CREATE OR REPLACE; el UPDATE de compra_publica solo si
--   la columna existe).
-- =====================================================================================

BEGIN;

-- Aviso de lo que se pierde; compra_publica a NULL mientras la columna existe (luego se borra).
DO $$
DECLARE
  n bigint;
BEGIN
  SELECT count(*) INTO n FROM public.secop_contratos WHERE fuente = 'secop1';
  RAISE NOTICE 'Rollback 0730: se borran % contrato(s) de SECOP I (fuente secop1)', n;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public'
             AND table_name = 'hospitals' AND column_name = 'compra_publica') THEN
    EXECUTE 'SELECT count(*) FROM public.hospitals WHERE compra_publica IS NOT NULL' INTO n;
    RAISE NOTICE 'Rollback 0730: se pierden % marca(s) manual(es) de compra pública (hospitals.compra_publica)', n;
    EXECUTE 'UPDATE public.hospitals SET compra_publica = NULL WHERE compra_publica IS NOT NULL';
  END IF;
END;
$$;

-- -------------------------------------------------------------------------------------
-- 1. Filas de SECOP I (f789-7hwg)
-- -------------------------------------------------------------------------------------

DELETE FROM public.secop_contratos WHERE fuente = 'secop1';

-- -------------------------------------------------------------------------------------
-- 2. Vista (depende de las columnas), índice, constraint y columnas nuevas; constraints y COMMENT como en 0710
-- -------------------------------------------------------------------------------------

DROP VIEW IF EXISTS public.secop_contratos_unicos;
DROP INDEX IF EXISTS public.secop_contratos_secop1_constancia_idx;

ALTER TABLE public.secop_contratos DROP CONSTRAINT IF EXISTS secop_contratos_valor_proceso_check;
ALTER TABLE public.secop_contratos DROP COLUMN IF EXISTS valor_proceso;
ALTER TABLE public.secop_contratos DROP COLUMN IF EXISTS valor_adiciones;

ALTER TABLE public.secop_contratos DROP CONSTRAINT IF EXISTS secop_contratos_fuente_check;
ALTER TABLE public.secop_contratos ADD  CONSTRAINT secop_contratos_fuente_check  CHECK (fuente IN ('secop2', 'integrado'));
ALTER TABLE public.secop_contratos DROP CONSTRAINT IF EXISTS secop_contratos_fuente_origen;
ALTER TABLE public.secop_contratos ADD  CONSTRAINT secop_contratos_fuente_origen CHECK (fuente = 'integrado' OR origen = 'SECOPII');

COMMENT ON COLUMN public.secop_contratos.fuente IS NULL;
COMMENT ON TABLE public.secop_contratos IS
  'Contratos de SECOP II (jbjy-vk9h) y SECOP Integrado (rpmr-utcd): de las IPS públicas/mixtas objetivo '
  '(línea clasificada, proveedor vigilado o médico especialista) y de los proveedores vigilados. NIT a 9 '
  'dígitos. Personas naturales sin documento en claro (proveedor_hash). Lo cargan scripts/secop-load.ts y '
  'el cron. Para sumar sin doble conteo usar la vista secop_contratos_unicos.';
COMMENT ON COLUMN public.secop_contratos.id_contrato IS
  'secop2: id_contrato (CO1.PCCNTR…). integrado: origen|numero_del_contrato|proveedor|fecha de firma (SECOP I '
  'repite el número de constancia por contratista y trae filas duplicadas).';

-- -------------------------------------------------------------------------------------
-- 3. Vista y funciones con su definición original (0710 / 0720, copiadas tal cual)
-- -------------------------------------------------------------------------------------

-- 0710: Contratos sin doble conteo: el Integrado repite los contratos de SECOP II (origen SECOPII, mismo
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

-- 0710
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

COMMENT ON FUNCTION public.secop_nits_ips() IS NULL;  -- 0710 no le ponía comentario

-- 0720
CREATE OR REPLACE FUNCTION public.secop_hechos(
  p_desde       date   DEFAULT NULL,
  p_hasta       date   DEFAULT NULL,
  p_nits        text[] DEFAULT NULL,
  p_proveedores text[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'e', g.nit_entidad, 'en', g.nombre_entidad, 'd', g.documento_proveedor, 'h', g.proveedor_hash,
           'pn', g.proveedor_nombre, 'p', g.es_persona, 'es', g.especialidad_medico, 'l', g.linea,
           'a', g.atipico, 'x', g.fuera_escala, 'f', g.fecha, 'v', g.valor, 'n', g.contratos)), '[]'::jsonb)
  FROM (
    SELECT u.nit_entidad,
           mode() WITHIN GROUP (ORDER BY u.nombre_entidad)   AS nombre_entidad,
           u.documento_proveedor,
           u.proveedor_hash,
           mode() WITHIN GROUP (ORDER BY u.proveedor_nombre) AS proveedor_nombre,
           u.es_persona,
           u.especialidad_medico,
           u.linea,
           u.atipico,
           coalesce(u.valor_ajustado > 50000000000, false) AS fuera_escala,
           max(u.fecha_firma)                   AS fecha,
           coalesce(sum(u.valor_ajustado), 0)   AS valor,
           count(*)                             AS contratos
    FROM (
      -- El reparto se calcula ANTES de filtrar por fecha o proveedor (un proceso no se parte por el filtro).
      SELECT c.*,
             CASE WHEN c.origen = 'SECOPI' AND c.numero_contrato IS NOT NULL AND c.valor > 0
                  THEN c.valor / count(*) OVER (PARTITION BY c.nit_entidad, c.origen, c.numero_contrato, c.valor)
                  ELSE c.valor END AS valor_ajustado
      FROM public.secop_contratos_unicos c
      WHERE (p_nits IS NULL OR c.nit_entidad = ANY (p_nits))
    ) u
    WHERE (p_desde IS NULL OR u.fecha_firma >= p_desde)
      AND (p_hasta IS NULL OR u.fecha_firma <= p_hasta)
      AND (p_proveedores IS NULL OR u.documento_proveedor = ANY (p_proveedores))
    GROUP BY u.nit_entidad, u.documento_proveedor, u.proveedor_hash,
             CASE WHEN u.documento_proveedor IS NULL AND u.proveedor_hash IS NULL THEN u.proveedor_nombre END,
             u.es_persona, u.especialidad_medico, u.linea, u.atipico,
             coalesce(u.valor_ajustado > 50000000000, false),
             date_part('year', u.fecha_firma)
  ) g;
$$;

COMMENT ON FUNCTION public.secop_hechos(date, date, text[], text[]) IS
  'Contratos de secop_contratos_unicos agregados por entidad, proveedor, persona, especialidad, línea, '
  'atípico, fuera de escala (> 50.000 M) y año de firma, en un jsonb. SECOP I: el valor del proceso repetido '
  'por contratista se reparte por partes iguales. Lo usan GET /api/secop/ranking, /api/secop/proveedor/[nit] y '
  '/api/secop/vigilados (app/api/secop/_lib/secop-server.ts). Solo service_role.';

-- Privilegios (la vista se creó de nuevo: sin GRANT quedaría sin acceso para service_role)
REVOKE ALL ON TABLE public.secop_contratos_unicos FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.secop_contratos_unicos TO service_role;
REVOKE ALL ON FUNCTION public.secop_nits_ips() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.secop_nits_ips() TO service_role;
REVOKE ALL ON FUNCTION public.secop_hechos(date, date, text[], text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.secop_hechos(date, date, text[], text[]) TO service_role;

-- -------------------------------------------------------------------------------------
-- 4. hospitals.compra_publica (ya puesta a NULL arriba)
-- -------------------------------------------------------------------------------------

ALTER TABLE public.hospitals DROP COLUMN IF EXISTS compra_publica;

-- -------------------------------------------------------------------------------------
-- 5. Fuente secop_i
-- -------------------------------------------------------------------------------------

DELETE FROM public.fuentes_estado WHERE fuente = 'secop_i';

-- -------------------------------------------------------------------------------------
-- 6. Comprobaciones (aborta si algo no cuadra)
-- -------------------------------------------------------------------------------------

DO $$
DECLARE
  n     bigint;
  n_tab bigint;
  def   text;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'hospitals'
             AND column_name = 'compra_publica') THEN
    RAISE EXCEPTION 'Rollback 0730: hospitals.compra_publica sigue existiendo';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'secop_contratos'
             AND column_name IN ('valor_proceso', 'valor_adiciones')) THEN
    RAISE EXCEPTION 'Rollback 0730: secop_contratos.valor_proceso / valor_adiciones siguen existiendo';
  END IF;
  IF to_regclass('public.secop_contratos_secop1_constancia_idx') IS NOT NULL THEN
    RAISE EXCEPTION 'Rollback 0730: el índice secop_contratos_secop1_constancia_idx sigue existiendo';
  END IF;
  IF EXISTS (SELECT 1 FROM public.secop_contratos WHERE fuente = 'secop1') THEN
    RAISE EXCEPTION 'Rollback 0730: quedan filas con fuente = secop1';
  END IF;

  -- Vista como en 0710: existe, sin estimado y con las mismas columnas que la tabla (c.*)
  IF to_regclass('public.secop_contratos_unicos') IS NULL THEN
    RAISE EXCEPTION 'Rollback 0730: falta la vista secop_contratos_unicos';
  END IF;
  SELECT count(*) INTO n     FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'secop_contratos_unicos';
  SELECT count(*) INTO n_tab FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'secop_contratos';
  IF n <> n_tab OR EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public'
                           AND table_name = 'secop_contratos_unicos' AND column_name = 'estimado') THEN
    RAISE EXCEPTION 'Rollback 0730: la vista no quedó como en 0710 (% columnas frente a % de la tabla)', n, n_tab;
  END IF;

  -- Constraints de 0710: (secop1, SECOPI) debe rechazarse (el INSERT, si pasara, se deshace con la excepción)
  BEGIN
    INSERT INTO public.secop_contratos (fuente, origen, id_contrato, nit_entidad)
    VALUES ('secop1', 'SECOPI', '__prueba_9931__', '999999999');
    RAISE EXCEPTION 'Rollback 0730: el constraint sigue aceptando fuente = secop1';
  EXCEPTION
    WHEN check_violation THEN NULL;  -- rechazado: correcto
  END;

  -- Funciones con su definición de 0710 / 0720
  def := pg_get_functiondef('public.secop_hechos(date, date, text[], text[])'::regprocedure);
  IF strpos(def, '''est''') > 0 OR strpos(def, 'fuente = ''integrado''') > 0 THEN
    RAISE EXCEPTION 'Rollback 0730: secop_hechos() no quedó como en 0720';
  END IF;
  def := pg_get_functiondef('public.secop_nits_ips()'::regprocedure);
  IF strpos(def, 'compra_publica') > 0 THEN
    RAISE EXCEPTION 'Rollback 0730: secop_nits_ips() no quedó como en 0710';
  END IF;

  -- Privilegios
  IF has_table_privilege('anon', 'public.secop_contratos_unicos', 'SELECT')
     OR has_table_privilege('authenticated', 'public.secop_contratos_unicos', 'SELECT')
     OR has_function_privilege('anon', 'public.secop_hechos(date, date, text[], text[])', 'EXECUTE')
     OR has_function_privilege('anon', 'public.secop_nits_ips()', 'EXECUTE') THEN
    RAISE EXCEPTION 'Rollback 0730: anon/authenticated tienen acceso a la vista o a las funciones';
  END IF;
  IF NOT has_table_privilege('service_role', 'public.secop_contratos_unicos', 'SELECT')
     OR NOT has_function_privilege('service_role', 'public.secop_hechos(date, date, text[], text[])', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.secop_nits_ips()', 'EXECUTE') THEN
    RAISE EXCEPTION 'Rollback 0730: service_role perdió el acceso a la vista o a las funciones';
  END IF;

  IF EXISTS (SELECT 1 FROM public.fuentes_estado WHERE fuente = 'secop_i') THEN
    RAISE EXCEPTION 'Rollback 0730: fuentes_estado sigue teniendo secop_i';
  END IF;

  RAISE NOTICE 'Rollback 0730 OK: sin secop1, sin valor_proceso/valor_adiciones, sin compra_publica, sin secop_i; vista, secop_nits_ips() y secop_hechos() como en 0710/0720.';
END;
$$;

COMMIT;
