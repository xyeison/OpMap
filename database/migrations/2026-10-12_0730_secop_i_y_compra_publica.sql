-- =====================================================================================
-- OpMap · feat/secop-i-valores-reales (SECOP I con valor adjudicado y "Compra pública" manual) · 0730
-- Proyecto: norvxqgohddgsdkggqzq · Generado: 2026-10-12
--
-- Decisión del dueño (2026-10-11): "Pero el SECOP uno no dice quién fue el adjudicado y el valor
--   adjudicado. Toma todas las decisiones adicionales tú; tú tomas la buena decisión"
--   (docs/decisiones/2026-10-12-secop-i-valores-reales-y-compra-publica.md).
--   Spec: docs/specs/2026-10-12-secop-i-valores-reales-y-compra-publica.md.
--   Es ADITIVA: 3 columnas nuevas, 1 índice, 2 constraints ampliados (admiten más, nunca menos), la vista y
--   2 funciones reemplazadas con la MISMA firma (solo añaden una columna / una clave) y 2 semillas. No borra
--   ni modifica datos existentes. Depende de 0710 (tablas, vista, secop_nits_ips) y 0720 (secop_hechos).
--
-- Por qué:
--   1. SECOP I entraba solo por el SECOP Integrado (rpmr-utcd), que repite el VALOR DEL PROCESO en cada
--      contratista. El dataset "SECOP I - Procesos de Compra Pública" (f789-7hwg) sí trae el contratista y el
--      valor adjudicado a cada uno (cuantia_contrato / valor_contrato_con_adiciones) además del valor del
--      proceso (cuantia_proceso). Comprobado el 2026-10-11: La Samaritana suma 3,63 billones por proceso y
--      0,90 billones adjudicados (4 a 5 veces menos). f789-7hwg solo tiene detalle desde 2017-2018.
--      → Entra como fuente = 'secop1' (origen 'SECOPI'). El Integrado queda de RESPALDO para las constancias
--        que f789-7hwg no trae (en la práctica, antes de 2018): siguen repartidas por partes iguales y se
--        marcan ESTIMADAS (columna estimado de la vista, clave 'est' de secop_hechos()).
--   2. Una IPS solo era entidad objetivo de SECOP si su NIT tenía alguna sede en reps_sedes con naturaleza
--      Pública o Mixta (secop_nits_ips() de 0710 cruza por NIT, no por hospitals.reps_code). Las 6 UPRES de la
--      Policía (régimen de excepción, no existen en el REPS con su NIT), HOCEN, HONAC, la ESE San Marcos y la
--      ESE de Corozal no tienen ninguna sede así y quedaban fuera (UPRES Santander: 4.438 contratos en SECOP II).
--      Revisión 2026-10-12 (SELECT de solo lectura en producción): otras 3 ESE sin reps_code (HU de Sincelejo
--      892280033, ESE N. S. del Carmen 900196346, ESE Universitaria del Atlántico 901536799) SÍ tienen sedes
--      Públicas en reps_sedes con su NIT, ya eran entidad objetivo y NO se siembran: siguen "según el REPS".
--      → hospitals.compra_publica: NULL = según el REPS; true/false = marca manual (hospitals:edit).
--
-- Qué hace:
--   1. hospitals.compra_publica boolean NULL.
--   2. secop_contratos.valor_proceso y valor_adiciones numeric(18,2) (>= 0 o NULL). fuente admite 'secop1'
--      (solo con origen 'SECOPI'). Índice parcial (nit_entidad, numero_contrato) WHERE fuente = 'secop1'
--      (lo usa la vista para descartar el Integrado de la misma constancia).
--   3. Vista secop_contratos_unicos: mismas columnas (c.*) + estimado boolean AL FINAL
--      (= fuente = 'integrado' AND origen = 'SECOPI'). Entran: secop2 y secop1 siempre; integrado/SECOPII solo
--      si no vino ya de secop2 (regla de 0710); integrado/SECOPI solo si NO hay fila secop1 con la misma
--      (nit_entidad, numero_contrato) = misma constancia (f789-7hwg trae TODOS los contratistas de la
--      constancia, así que se descartan todas las filas del Integrado de esa constancia).
--   4. secop_hechos(): misma firma y mismo jsonb + clave 'est' (estimado). El reparto por partes iguales del
--      valor del proceso SOLO para fuente = 'integrado' AND origen = 'SECOPI'; secop1 ya trae el valor por
--      contratista y secop2 es un contrato por fila.
--   5. secop_nits_ips(): publica = marca manual del NIT y, sin marca, el REPS (como en 0710). La marca del
--      NIT se toma de TODAS sus IPS activas (bool_or de compra_publica): true si alguna dice sí, false si
--      todas las marcadas dicen no, sin marca si ninguna está marcada. Así la marca puesta en una sede que
--      no es la principal (más camas) no se pierde. Decisión propia; con una sola IPS por NIT es
--      exactamente COALESCE(h.compra_publica, REPS).
--   6. Semillas: compra_publica = true en los 10 NIT sin sede REPS pública/mixta (solo donde sigue NULL: no
--      pisa marcas manuales): 6 UPRES de la Policía (901363087, 901362090, 901362454, 901362725, 901361090,
--      901361882), HOCEN (830041314), HONAC (901541021), ESE San Marcos (800191643), ESE Corozal (890480113).
--      HU de Sincelejo ESE (892280033), ESE Nuestra Señora del Carmen (900196346) y ESE Universitaria del
--      Atlántico (901536799) NO se siembran: el REPS ya las da públicas (regla "NULL = según el REPS").
--      Fuente 'secop_i' ("SECOP I · Contratos", cron 0 7 * * 2) en fuentes_estado.
--   7. Bloque DO final que comprueba todo (constraints con INSERT de prueba, vista y reparto con filas de
--      prueba, semántica de la marca con una IPS real) dentro de sub-bloques que se deshacen (no queda ni
--      cambia ninguna fila) y aborta si algo no cuadra.
--
-- Foto con SELECT antes de este script (2026-10-11): 0710 y 0720 aplicadas (secop_contratos con las dos
--   fuentes, fuentes_estado con 6 fuentes); hospitals sin compra_publica; secop_contratos sin
--   valor_proceso/valor_adiciones. hospitals.nit es columna GENERADA (0600): se filtra sin problema.
--
-- Después de aplicar (misma ventana que el despliegue del código; orden 0710 → 0720 → 0730):
--   NOTIFY pgrst, 'reload schema';   -- PostgREST debe ver las columnas y la clave nuevas
--   cd web && npx tsx scripts/secop-load.ts --fuente secop1 --inicial   (histórico de f789-7hwg)
--   cd web && npx tsx scripts/secop-load.ts --fuente todas              (histórico de las 10 entidades nuevas)
--   secop_marcar_atipicos() corre sola al cerrar cada pasada. Costo Google: 0 (datos.gov.co es gratis).
--
-- Re-ejecutable: sí (IF NOT EXISTS / DROP IF EXISTS + ADD / CREATE OR REPLACE / ON CONFLICT DO NOTHING /
--   UPDATE solo donde compra_publica IS NULL). CREATE OR REPLACE VIEW vale porque solo AÑADE columnas al
--   final (valor_proceso y valor_adiciones vienen con c.* detrás de las de 0710; estimado la última).
-- Rollback: 2026-10-12_9931_secop_i_rollback.sql (va ANTES de 9929_secop_api_rollback y 9930_secop_rollback).
-- =====================================================================================

BEGIN;

-- -------------------------------------------------------------------------------------
-- 1. hospitals.compra_publica
-- -------------------------------------------------------------------------------------

ALTER TABLE public.hospitals ADD COLUMN IF NOT EXISTS compra_publica boolean NULL;

COMMENT ON COLUMN public.hospitals.compra_publica IS
  'Compra pública (SECOP). NULL = según el REPS (sede vinculada con naturaleza Pública o Mixta); true/false = '
  'marca manual (quien tenga hospitals:edit). Decide si la IPS es entidad objetivo de la carga de SECOP '
  '(secop_nits_ips(), por NIT: true si alguna IPS activa del NIT dice sí). Cambiarla no recalcula ni llama a '
  'nada: la carga semanal trae su histórico. Semilla 0730: 6 UPRES, HOCEN, HONAC, ESE San Marcos y ESE Corozal '
  '(10 NIT sin sede REPS pública/mixta).';

-- -------------------------------------------------------------------------------------
-- 2. secop_contratos: valor del proceso y adiciones de SECOP I; fuente 'secop1'; índice por constancia
-- -------------------------------------------------------------------------------------

ALTER TABLE public.secop_contratos ADD COLUMN IF NOT EXISTS valor_proceso   numeric(18,2) NULL;
ALTER TABLE public.secop_contratos ADD COLUMN IF NOT EXISTS valor_adiciones numeric(18,2) NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.secop_contratos'::regclass AND conname = 'secop_contratos_valor_proceso_check'
  ) THEN
    ALTER TABLE public.secop_contratos ADD CONSTRAINT secop_contratos_valor_proceso_check
      CHECK ((valor_proceso IS NULL OR valor_proceso >= 0) AND (valor_adiciones IS NULL OR valor_adiciones >= 0));
  END IF;
END;
$$;

-- Los dos constraints se reemplazan (DROP + ADD): admiten 'secop1' y exigen que vaya con origen 'SECOPI'.
-- Las filas existentes (secop2/SECOPII, integrado/*) cumplen las dos reglas nuevas.
ALTER TABLE public.secop_contratos DROP CONSTRAINT IF EXISTS secop_contratos_fuente_check;
ALTER TABLE public.secop_contratos ADD  CONSTRAINT secop_contratos_fuente_check
  CHECK (fuente IN ('secop2', 'secop1', 'integrado'));

ALTER TABLE public.secop_contratos DROP CONSTRAINT IF EXISTS secop_contratos_fuente_origen;
ALTER TABLE public.secop_contratos ADD  CONSTRAINT secop_contratos_fuente_origen
  CHECK ((fuente = 'secop2' AND origen = 'SECOPII')
      OR (fuente = 'secop1' AND origen = 'SECOPI')
      OR  fuente = 'integrado');

-- Misma constancia en secop1: lo usa la vista para descartar las filas del Integrado de esa constancia.
CREATE INDEX IF NOT EXISTS secop_contratos_secop1_constancia_idx
  ON public.secop_contratos (nit_entidad, numero_contrato) WHERE fuente = 'secop1';

COMMENT ON COLUMN public.secop_contratos.valor_proceso IS
  'secop1: cuantia_proceso de f789-7hwg (valor del PROCESO, común a todos los contratistas de la constancia). '
  'Dato informativo ("Proceso: X · adjudicado: Y"); la API suma valor, que es lo adjudicado al contratista. '
  'NULL en secop2 e integrado.';
COMMENT ON COLUMN public.secop_contratos.valor_adiciones IS
  'secop1: valor_total_de_adiciones de f789-7hwg. valor ya las incluye (valor_contrato_con_adiciones si es > 0; '
  'si no, cuantia_contrato). NULL en secop2 e integrado.';
COMMENT ON COLUMN public.secop_contratos.fuente IS
  'secop2 = SECOP II Contratos (jbjy-vk9h, origen SECOPII). secop1 = SECOP I - Procesos de Compra Pública '
  '(f789-7hwg, origen SECOPI, valor adjudicado por contratista). integrado = SECOP Integrado (rpmr-utcd, origen '
  'SECOPI o SECOPII): respaldo; sus filas SECOP I traen el valor del PROCESO y la vista las marca estimado.';
COMMENT ON TABLE public.secop_contratos IS
  'Contratos de SECOP II (jbjy-vk9h), SECOP I (f789-7hwg, desde 2017-2018, valor adjudicado por contratista) y '
  'SECOP Integrado (rpmr-utcd, respaldo): de las IPS objetivo (REPS pública/mixta o hospitals.compra_publica) '
  'con línea clasificada, proveedor vigilado o médico especialista, y de los proveedores vigilados. NIT a 9 '
  'dígitos. Personas naturales sin documento en claro (proveedor_hash). Lo cargan scripts/secop-load.ts y el '
  'cron. Para sumar sin doble conteo usar la vista secop_contratos_unicos.';
COMMENT ON COLUMN public.secop_contratos.id_contrato IS
  'secop2: id_contrato (CO1.PCCNTR…). secop1: SECOPI|id_adjudicacion de f789-7hwg (uno por contratista). '
  'integrado: origen|numero_del_contrato|proveedor|fecha de firma (SECOP I repite el número de constancia por '
  'contratista y trae filas duplicadas).';

-- -------------------------------------------------------------------------------------
-- 3. Vista secop_contratos_unicos: + estimado; el Integrado SECOP I solo si secop1 no trae la constancia
-- -------------------------------------------------------------------------------------

-- Sin doble conteo:
--   - secop2 y secop1 entran siempre (un contrato / un contratista por fila, valor adjudicado).
--   - integrado/SECOPII solo si el dataset de SECOP II no trae ya ese contrato (mismo CO1.PCCNTR…): 0710.
--   - integrado/SECOPI solo si secop1 no trae esa constancia (misma nit_entidad y numero_contrato). f789-7hwg
--     trae todos los contratistas de la constancia, así que basta una fila secop1 para descartar todas las
--     del Integrado. Las que quedan son ESTIMADAS (valor del proceso; secop_hechos() lo reparte).
CREATE OR REPLACE VIEW public.secop_contratos_unicos
WITH (security_invoker = true) AS
SELECT c.*,
       (c.fuente = 'integrado' AND c.origen = 'SECOPI') AS estimado
FROM public.secop_contratos c
WHERE c.fuente IN ('secop2', 'secop1')
   OR (c.fuente = 'integrado' AND c.origen = 'SECOPII' AND NOT EXISTS (
         SELECT 1 FROM public.secop_contratos s
         WHERE s.fuente = 'secop2' AND s.id_contrato = c.numero_contrato))
   OR (c.fuente = 'integrado' AND c.origen = 'SECOPI' AND NOT EXISTS (
         SELECT 1 FROM public.secop_contratos s1
         WHERE s1.fuente = 'secop1'
           AND s1.nit_entidad = c.nit_entidad
           AND s1.numero_contrato = c.numero_contrato));

COMMENT ON VIEW public.secop_contratos_unicos IS
  'secop_contratos sin doble conteo: secop2 y secop1 siempre; del Integrado, SECOP II solo si no vino de secop2 '
  'y SECOP I solo si secop1 no trae la constancia (nit_entidad + numero_contrato). estimado = Integrado SECOP I '
  '(valor del proceso repetido por contratista; secop_hechos() lo reparte por partes iguales). security_invoker; '
  'solo service_role.';

-- -------------------------------------------------------------------------------------
-- 4. secop_hechos(): reparto solo para el Integrado SECOP I; clave 'est' (estimado)
-- -------------------------------------------------------------------------------------

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
           'a', g.atipico, 'x', g.fuera_escala, 'est', g.estimado, 'f', g.fecha, 'v', g.valor,
           'n', g.contratos)), '[]'::jsonb)
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
           u.estimado,
           max(u.fecha_firma)                   AS fecha,
           coalesce(sum(u.valor_ajustado), 0)   AS valor,
           count(*)                             AS contratos
    FROM (
      -- El reparto se calcula ANTES de filtrar por fecha o proveedor (un proceso no se parte por el filtro).
      -- Solo el Integrado SECOP I (estimado) repite el valor del PROCESO en cada contratista de la constancia:
      -- se reparte por partes iguales. secop1 ya trae el valor adjudicado a cada contratista y secop2 es un
      -- contrato por fila: no se tocan. fuente va en la partición por si la vista dejara coexistir ambas.
      SELECT c.*,
             CASE WHEN c.fuente = 'integrado' AND c.origen = 'SECOPI'
                   AND c.numero_contrato IS NOT NULL AND c.valor > 0
                  THEN c.valor / count(*) OVER (PARTITION BY c.fuente, c.nit_entidad, c.origen, c.numero_contrato, c.valor)
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
             u.estimado,
             date_part('year', u.fecha_firma)
  ) g;
$$;

COMMENT ON FUNCTION public.secop_hechos(date, date, text[], text[]) IS
  'Contratos de secop_contratos_unicos agregados por entidad, proveedor, persona, especialidad, línea, '
  'atípico, fuera de escala (> 50.000 M), estimado (clave est) y año de firma, en un jsonb. Solo el Integrado '
  'SECOP I (est = true) reparte el valor del proceso por partes iguales entre los contratistas de la constancia; '
  'secop1 y secop2 suman tal cual. Lo usan GET /api/secop/ranking, /api/secop/proveedor/[nit], '
  '/api/secop/hospital/[id] y /api/secop/vigilados (app/api/secop/_lib/secop-server.ts). Solo service_role.';

-- -------------------------------------------------------------------------------------
-- 5. secop_nits_ips(): la marca manual del NIT manda; sin marca, el REPS
-- -------------------------------------------------------------------------------------

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
         COALESCE(
           -- Marca manual del NIT (hospitals.compra_publica de sus IPS activas): true si alguna dice sí,
           -- false si todas las marcadas dicen no, NULL si ninguna está marcada.
           (SELECT bool_or(m.compra_publica) FROM public.hospitals m
             WHERE m.active AND m.nit = h.nit AND m.compra_publica IS NOT NULL),
           -- Sin marca: según el REPS (sede Pública o Mixta con ese NIT), como en 0710.
           EXISTS (SELECT 1 FROM public.reps_sedes r WHERE r.nit = h.nit AND r.naturaleza IN ('Pública', 'Mixta'))
         )
  FROM public.hospitals h
  WHERE h.active AND h.nit IS NOT NULL
  ORDER BY h.nit, h.beds DESC NULLS LAST, h.name, h.id
$$;

COMMENT ON FUNCTION public.secop_nits_ips() IS
  'NIT de las IPS activas → IPS principal (más camas) y publica: si alguna IPS activa del NIT tiene '
  'hospitals.compra_publica = true → true; si todas las marcadas dicen false → false; sin marca → el REPS '
  '(reps_sedes.naturaleza Pública o Mixta). Lo usa la carga de SECOP (lib/secop-sync.ts). Solo service_role.';

-- -------------------------------------------------------------------------------------
-- 6. Privilegios: vista y funciones solo para service_role (CREATE OR REPLACE los conserva; se re-aplican)
-- -------------------------------------------------------------------------------------

REVOKE ALL ON TABLE public.secop_contratos_unicos FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.secop_contratos_unicos TO service_role;

REVOKE ALL ON FUNCTION public.secop_hechos(date, date, text[], text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.secop_hechos(date, date, text[], text[]) TO service_role;

REVOKE ALL ON FUNCTION public.secop_nits_ips() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.secop_nits_ips() TO service_role;

-- -------------------------------------------------------------------------------------
-- 7. Semillas
-- -------------------------------------------------------------------------------------

-- 10 entidades públicas sin ninguna sede Pública/Mixta en reps_sedes con su NIT (decisión 2026-10-12, revisada
-- el mismo día: HU de Sincelejo 892280033, ESE N. S. del Carmen 900196346 y ESE Universitaria del Atlántico
-- 901536799 ya son públicas por el REPS y se dejan en NULL para que siga mandando el REPS). Solo donde sigue
-- NULL: una marca manual posterior (true o false) no se pisa al re-ejecutar.
UPDATE public.hospitals
SET compra_publica = true
WHERE compra_publica IS NULL
  AND nit IN (
    '901363087', '901362090', '901362454', '901362725', '901361090', '901361882',  -- 6 UPRES de la Policía
    '830041314',  -- Hospital Central de la Policía (HOCEN)
    '901541021',  -- Hospital Naval de Cartagena (HONAC)
    '800191643',  -- ESE Hospital San Marcos
    '890480113'   -- ESE Hospital de Corozal
  );

INSERT INTO public.fuentes_estado (fuente, nombre, programacion, ejecutor)
VALUES ('secop_i', 'SECOP I · Contratos', '0 7 * * 2', 'vercel_cron')
ON CONFLICT (fuente) DO NOTHING;

-- -------------------------------------------------------------------------------------
-- 8. Comprobaciones (aborta la transacción si algo no cuadra). Las pruebas que escriben van en sub-bloques
--    que terminan con RAISE SQLSTATE 'P0730': PL/pgSQL deshace todo lo del sub-bloque, así que no queda ni
--    cambia ninguna fila. Cualquier otra excepción sale del bloque y aborta la migración.
-- -------------------------------------------------------------------------------------

DO $$
DECLARE
  nits        constant text[] := ARRAY['901363087', '901362090', '901362454', '901362725', '901361090', '901361882',
                                       '830041314', '901541021', '800191643', '890480113'];
  -- ESE sin reps_code que el REPS ya da públicas (revisión 2026-10-12): no se siembran; deben salir públicas por el REPS.
  nits_reps   constant text[] := ARRAY['892280033', '900196346', '901536799'];
  nit_prueba  constant text   := '999999999';
  n           bigint;
  n_ips       bigint;
  n_nits      bigint;
  n_pub       bigint;
  n_fuentes   bigint;
  def         text;
  r           jsonb;
  v_sum       numeric;
  v_est       numeric;
  v_nit       text;
  v_pub       boolean;
BEGIN
  -- 8.1 Columnas nuevas
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'hospitals'
                 AND column_name = 'compra_publica' AND data_type = 'boolean') THEN
    RAISE EXCEPTION '0730 SECOP I: falta hospitals.compra_publica (boolean)';
  END IF;
  SELECT count(*) INTO n FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'secop_contratos'
    AND column_name IN ('valor_proceso', 'valor_adiciones') AND data_type = 'numeric';
  IF n <> 2 THEN RAISE EXCEPTION '0730 SECOP I: faltan secop_contratos.valor_proceso / valor_adiciones (numeric)'; END IF;
  IF to_regclass('public.secop_contratos_secop1_constancia_idx') IS NULL THEN
    RAISE EXCEPTION '0730 SECOP I: falta el índice secop_contratos_secop1_constancia_idx';
  END IF;

  -- 8.2 Constraints: con INSERT reales. El NIT de prueba no debe existir en secop_contratos.
  IF EXISTS (SELECT 1 FROM public.secop_contratos WHERE nit_entidad = nit_prueba) THEN
    RAISE EXCEPTION '0730 SECOP I: el NIT de prueba % ya tiene contratos; no se puede probar', nit_prueba;
  END IF;
  -- acepta (secop1, SECOPI) con valor_proceso y valor_adiciones; se deshace
  BEGIN
    INSERT INTO public.secop_contratos (fuente, origen, id_contrato, nit_entidad, valor, valor_proceso, valor_adiciones)
    VALUES ('secop1', 'SECOPI', '__prueba_0730__', nit_prueba, 1, 2, 0);
    RAISE SQLSTATE 'P0730';
  EXCEPTION
    WHEN SQLSTATE 'P0730' THEN NULL;  -- aceptado y deshecho
    WHEN check_violation THEN RAISE EXCEPTION '0730 SECOP I: los constraints rechazan (secop1, SECOPI): %', SQLERRM;
  END;
  -- rechaza (secop1, SECOPII)
  BEGIN
    INSERT INTO public.secop_contratos (fuente, origen, id_contrato, nit_entidad)
    VALUES ('secop1', 'SECOPII', '__prueba_0730__', nit_prueba);
    RAISE EXCEPTION '0730 SECOP I: los constraints aceptan (secop1, SECOPII)';
  EXCEPTION
    WHEN check_violation THEN NULL;  -- rechazado: correcto
  END;
  -- rechaza (secop2, SECOPI) (regla de 0710 que se conserva)
  BEGIN
    INSERT INTO public.secop_contratos (fuente, origen, id_contrato, nit_entidad)
    VALUES ('secop2', 'SECOPI', '__prueba_0730__', nit_prueba);
    RAISE EXCEPTION '0730 SECOP I: los constraints aceptan (secop2, SECOPI)';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;
  -- rechaza valor_proceso negativo
  BEGIN
    INSERT INTO public.secop_contratos (fuente, origen, id_contrato, nit_entidad, valor_proceso)
    VALUES ('secop1', 'SECOPI', '__prueba_0730__', nit_prueba, -1);
    RAISE EXCEPTION '0730 SECOP I: valor_proceso negativo aceptado';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;

  -- 8.3 Vista: columna estimado y regla de la constancia; secop_hechos(): reparto solo del Integrado y clave est.
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public'
                 AND table_name = 'secop_contratos_unicos' AND column_name = 'estimado' AND data_type = 'boolean') THEN
    RAISE EXCEPTION '0730 SECOP I: la vista secop_contratos_unicos no tiene la columna estimado (boolean)';
  END IF;
  BEGIN
    INSERT INTO public.secop_contratos (fuente, origen, id_contrato, numero_contrato, nit_entidad, valor) VALUES
      -- constancia que f789-7hwg SÍ trae: 2 filas del Integrado (valor del proceso) + 1 de secop1 (adjudicado)
      ('integrado', 'SECOPI', '__prueba_0730_int_a__', '__PRUEBA-0730-A__', nit_prueba, 1000),
      ('integrado', 'SECOPI', '__prueba_0730_int_b__', '__PRUEBA-0730-A__', nit_prueba, 1000),
      ('secop1',    'SECOPI', '__prueba_0730_s1__',    '__PRUEBA-0730-A__', nit_prueba, 300),
      -- constancia que solo trae el Integrado: 2 contratistas con el mismo valor del proceso (500 → 250 + 250)
      ('integrado', 'SECOPI', '__prueba_0730_int_c__', '__PRUEBA-0730-B__', nit_prueba, 500),
      ('integrado', 'SECOPI', '__prueba_0730_int_d__', '__PRUEBA-0730-B__', nit_prueba, 500);
    SELECT count(*), bool_or(u.estimado) INTO n, v_pub FROM public.secop_contratos_unicos u
    WHERE u.nit_entidad = nit_prueba AND u.numero_contrato = '__PRUEBA-0730-A__';
    IF n <> 1 OR v_pub THEN
      RAISE EXCEPTION '0730 SECOP I: la vista debe dejar 1 fila (secop1, no estimada) de la constancia que trae secop1; dejó % (estimada = %)', n, v_pub;
    END IF;
    SELECT count(*), bool_and(u.estimado) INTO n, v_pub FROM public.secop_contratos_unicos u
    WHERE u.nit_entidad = nit_prueba AND u.numero_contrato = '__PRUEBA-0730-B__';
    IF n <> 2 OR NOT v_pub THEN
      RAISE EXCEPTION '0730 SECOP I: la vista debe dejar 2 filas estimadas de la constancia que solo trae el Integrado; dejó % (estimadas = %)', n, v_pub;
    END IF;
    r := public.secop_hechos(NULL, NULL, ARRAY[nit_prueba], NULL);
    IF jsonb_typeof(r) <> 'array' THEN RAISE EXCEPTION '0730 SECOP I: secop_hechos() no devuelve un array'; END IF;
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(r) e WHERE NOT jsonb_exists(e, 'est')) THEN
      RAISE EXCEPTION '0730 SECOP I: secop_hechos() no trae la clave est en todos los hechos';
    END IF;
    SELECT coalesce(sum((e->>'v')::numeric), 0), coalesce(sum((e->>'n')::int), 0) INTO v_sum, n FROM jsonb_array_elements(r) e;
    SELECT coalesce(sum((e->>'v')::numeric), 0) INTO v_est FROM jsonb_array_elements(r) e WHERE (e->>'est')::boolean;
    -- 300 (secop1, sin reparto) + 500 (Integrado: 500 repartido entre 2) = 800 en 3 contratos; estimado = 500
    IF n <> 3 OR v_sum <> 800 OR v_est <> 500 THEN
      RAISE EXCEPTION '0730 SECOP I: secop_hechos() debe sumar 800 en 3 contratos con 500 estimados; dio % en % (estimados %)', v_sum, n, v_est;
    END IF;
    RAISE SQLSTATE 'P0730';
  EXCEPTION
    WHEN SQLSTATE 'P0730' THEN NULL;  -- filas de prueba deshechas
  END;
  IF EXISTS (SELECT 1 FROM public.secop_contratos WHERE nit_entidad = nit_prueba) THEN
    RAISE EXCEPTION '0730 SECOP I: quedaron filas de prueba en secop_contratos';
  END IF;

  -- 8.4 Definiciones de las funciones
  def := pg_get_functiondef('public.secop_hechos(date, date, text[], text[])'::regprocedure);
  IF strpos(def, 'fuente = ''integrado''') = 0 OR strpos(def, '''est''') = 0 THEN
    RAISE EXCEPTION '0730 SECOP I: secop_hechos() no reparte solo el Integrado o no trae la clave est';
  END IF;
  def := pg_get_functiondef('public.secop_nits_ips()'::regprocedure);
  IF strpos(def, 'compra_publica') = 0 THEN
    RAISE EXCEPTION '0730 SECOP I: secop_nits_ips() no usa hospitals.compra_publica';
  END IF;

  -- 8.5 Semántica de secop_nits_ips() con una IPS real, deshecha al final (no cambia ningún dato)
  BEGIN
    -- NIT con REPS pública/mixta: NULL → true; false → false (la marca manda sobre el REPS)
    SELECT h.nit INTO v_nit FROM public.hospitals h
    WHERE h.active AND h.nit IS NOT NULL
      AND EXISTS (SELECT 1 FROM public.reps_sedes r WHERE r.nit = h.nit AND r.naturaleza IN ('Pública', 'Mixta'))
    ORDER BY h.nit LIMIT 1;
    IF v_nit IS NOT NULL THEN
      UPDATE public.hospitals SET compra_publica = NULL WHERE nit = v_nit;
      SELECT s.publica INTO v_pub FROM public.secop_nits_ips() s WHERE s.nit = v_nit;
      IF v_pub IS DISTINCT FROM true THEN
        RAISE EXCEPTION '0730 SECOP I: con compra_publica NULL y REPS pública, secop_nits_ips() debe dar true (NIT %)', v_nit;
      END IF;
      UPDATE public.hospitals SET compra_publica = false WHERE nit = v_nit;
      SELECT s.publica INTO v_pub FROM public.secop_nits_ips() s WHERE s.nit = v_nit;
      IF v_pub IS DISTINCT FROM false THEN
        RAISE EXCEPTION '0730 SECOP I: con compra_publica false, secop_nits_ips() debe dar false aunque el REPS diga Pública (NIT %)', v_nit;
      END IF;
    END IF;
    -- NIT sin REPS pública/mixta: NULL → false; true → true
    SELECT h.nit INTO v_nit FROM public.hospitals h
    WHERE h.active AND h.nit IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.reps_sedes r WHERE r.nit = h.nit AND r.naturaleza IN ('Pública', 'Mixta'))
    ORDER BY h.nit LIMIT 1;
    IF v_nit IS NOT NULL THEN
      UPDATE public.hospitals SET compra_publica = NULL WHERE nit = v_nit;
      SELECT s.publica INTO v_pub FROM public.secop_nits_ips() s WHERE s.nit = v_nit;
      IF v_pub IS DISTINCT FROM false THEN
        RAISE EXCEPTION '0730 SECOP I: con compra_publica NULL y sin REPS pública, secop_nits_ips() debe dar false (NIT %)', v_nit;
      END IF;
      UPDATE public.hospitals SET compra_publica = true WHERE nit = v_nit;
      SELECT s.publica INTO v_pub FROM public.secop_nits_ips() s WHERE s.nit = v_nit;
      IF v_pub IS DISTINCT FROM true THEN
        RAISE EXCEPTION '0730 SECOP I: con compra_publica true y sin REPS, secop_nits_ips() debe dar true (NIT %)', v_nit;
      END IF;
    END IF;
    RAISE SQLSTATE 'P0730';
  EXCEPTION
    WHEN SQLSTATE 'P0730' THEN NULL;  -- marcas de prueba deshechas
  END;

  -- 8.6 Privilegios: anon/authenticated nada; service_role sí
  IF has_table_privilege('anon', 'public.secop_contratos_unicos', 'SELECT')
     OR has_table_privilege('authenticated', 'public.secop_contratos_unicos', 'SELECT') THEN
    RAISE EXCEPTION '0730 SECOP I: anon/authenticated pueden leer secop_contratos_unicos';
  END IF;
  IF has_function_privilege('anon', 'public.secop_hechos(date, date, text[], text[])', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.secop_hechos(date, date, text[], text[])', 'EXECUTE')
     OR has_function_privilege('anon', 'public.secop_nits_ips()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.secop_nits_ips()', 'EXECUTE') THEN
    RAISE EXCEPTION '0730 SECOP I: anon/authenticated pueden ejecutar secop_hechos() o secop_nits_ips()';
  END IF;
  IF NOT has_table_privilege('service_role', 'public.secop_contratos_unicos', 'SELECT')
     OR NOT has_function_privilege('service_role', 'public.secop_hechos(date, date, text[], text[])', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.secop_nits_ips()', 'EXECUTE') THEN
    RAISE EXCEPTION '0730 SECOP I: service_role no puede leer la vista o ejecutar las funciones';
  END IF;

  -- 8.7 Semilla de las 10 entidades: las que existen en hospitals quedan marcadas (ninguna sigue NULL)
  SELECT count(*), count(DISTINCT nit), count(*) FILTER (WHERE compra_publica IS NULL), count(*) FILTER (WHERE compra_publica)
  INTO n_ips, n_nits, n, n_pub
  FROM public.hospitals WHERE nit = ANY (nits);
  IF n > 0 THEN RAISE EXCEPTION '0730 SECOP I: % IPS de los 10 NIT siguen con compra_publica NULL', n; END IF;
  IF n_pub < n_ips THEN
    RAISE WARNING '0730 SECOP I: % IPS de los 10 NIT tienen compra_publica = false (marca manual posterior; la semilla no la pisa)', n_ips - n_pub;
  END IF;
  IF n_nits < 10 THEN
    RAISE WARNING '0730 SECOP I: solo % de los 10 NIT existen en hospitals; los que faltan se marcan a mano al crear la IPS', n_nits;
  END IF;
  -- La semilla es para NIT SIN sede REPS pública/mixta: si alguno ya la tiene, la marca es redundante y fija a
  -- mano lo que el REPS ya resuelve (avisa, no aborta: el REPS puede haber cambiado desde que se escribió).
  SELECT count(DISTINCT h.nit) INTO n FROM public.hospitals h
  WHERE h.nit = ANY (nits)
    AND EXISTS (SELECT 1 FROM public.reps_sedes r WHERE r.nit = h.nit AND r.naturaleza IN ('Pública', 'Mixta'));
  IF n > 0 THEN
    RAISE WARNING '0730 SECOP I: % de los 10 NIT sembrados ya tienen sede REPS pública/mixta (marca redundante; revisar si debe quedar NULL)', n;
  END IF;
  -- y secop_nits_ips() devuelve como públicas las que tienen una IPS activa marcada true
  SELECT count(*) INTO n FROM public.secop_nits_ips() s
  WHERE s.nit = ANY (nits) AND NOT s.publica
    AND EXISTS (SELECT 1 FROM public.hospitals h WHERE h.active AND h.nit = s.nit AND h.compra_publica);
  IF n > 0 THEN RAISE EXCEPTION '0730 SECOP I: secop_nits_ips() devuelve % de los 10 NIT marcados como no públicos', n; END IF;
  SELECT count(*) INTO n_pub FROM public.secop_nits_ips() s WHERE s.nit = ANY (nits) AND s.publica;
  -- Las 3 ESE que se dejan al REPS deben salir públicas SIN marca; si el REPS ya no las da así, hay que marcarlas
  -- a mano en la ficha para que se carguen (avisa, no aborta).
  SELECT count(*) INTO n FROM unnest(nits_reps) AS x(nit)
  WHERE EXISTS (SELECT 1 FROM public.hospitals h WHERE h.active AND h.nit = x.nit)
    AND NOT EXISTS (SELECT 1 FROM public.secop_nits_ips() s WHERE s.nit = x.nit AND s.publica);
  IF n > 0 THEN
    RAISE WARNING '0730 SECOP I: % de las 3 ESE que se dejan "según el REPS" (892280033, 900196346, 901536799) NO salen públicas en secop_nits_ips(); marcarlas a mano en la ficha si deben cargarse', n;
  END IF;

  -- 8.8 Fuente secop_i
  IF NOT EXISTS (SELECT 1 FROM public.fuentes_estado WHERE fuente = 'secop_i' AND ejecutor = 'vercel_cron') THEN
    RAISE EXCEPTION '0730 SECOP I: fuentes_estado no tiene la fuente secop_i';
  END IF;
  SELECT count(*) INTO n_fuentes FROM public.fuentes_estado;

  RAISE NOTICE '0730 SECOP I OK: hospitals.compra_publica (% IPS / % NIT de la semilla marcados; % NIT públicos en secop_nits_ips()); % fuentes en fuentes_estado (secop_i incluida).', n_ips, n_nits, n_pub, n_fuentes;
  RAISE NOTICE '0730 SECOP I OK: secop_contratos.valor_proceso/valor_adiciones y fuente secop1 (constraints probados); vista con estimado (regla de constancia probada); secop_hechos() con est y reparto solo del Integrado (probado); privilegios solo service_role.';
END;
$$;

COMMIT;
