-- =====================================================================================
-- OpMap · perf/tarjeta-mapa-una-ronda · 0891 — Vista secop_procesos_radar rápida (índices para "ya tiene contrato")
-- Proyecto: norvxqgohddgsdkggqzq · Generado: 2026-10-25 · APLICADA el 2026-10-25 (decisión delegada del dueño: "Toma tú la decisión"); Medellín 7.850 ms → 2,9 ms
--
-- Por qué: la vista de la 0890 decide "ya tiene contrato cargado" con un NOT EXISTS cuyo filtro es
--   (c.proceso = p.portafolio OR c.url LIKE '%' || p.notice_uid || '&%' OR c.url LIKE '%' || p.notice_uid). Con el OR y el
--   LIKE ningún índice sirve: por cada proceso se recorren TODOS los contratos de la entidad. Medido el 2026-10-25 con
--   EXPLAIN ANALYZE: Medellín (49 NIT, 324 procesos; el Hospital General tiene 18.068 contratos) = 7.850 ms y 3,8 M de
--   buffers. Es la tarjeta del mapa y la ficha de la IPS (loadProcesosRadar).
--
-- Qué hace (ADITIVA: dos índices y la misma vista reescrita; ninguna fila cambia; MISMO resultado):
--   1. Índice parcial (nit_entidad, proceso) en secop_contratos donde proceso no es nulo.
--   2. Índice de expresión (nit_entidad, substring(url from 'noticeUID=(CO1\.NTC\.[0-9]+)')) en secop_contratos donde la
--      url trae noticeUID: el noticeUID exacto de cada contrato.
--   3. secop_procesos_radar (security_invoker) con DOS NOT EXISTS de igualdad exacta que usan esos índices. El borde del
--      noticeUID ('&' o fin de texto) de la 0890 queda implícito en la expresión regular: captura los dígitos completos,
--      así que CO1.NTC.123 no casa con CO1.NTC.1234.
--   4. Comprobación final con los mismos casos de prueba de la 0890 (INSERT que se deshacen) y la equivalencia de la vista
--      nueva con la regla anterior sobre las filas reales.
--
-- Rollback: 2026-10-25_9950_secop_procesos_radar_rapida_rollback.sql (vista de la 0890 y fuera los índices).
-- Transaccional. Re-ejecutable (IF NOT EXISTS / CREATE OR REPLACE). Costo Google: 0. No carga datos.
-- =====================================================================================

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.secop_procesos') IS NULL OR to_regclass('public.secop_procesos_radar') IS NULL THEN
    RAISE EXCEPTION '0891: falta la 0890 (secop_procesos y secop_procesos_radar)';
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS secop_contratos_entidad_proceso_idx
  ON public.secop_contratos (nit_entidad, proceso)
  WHERE proceso IS NOT NULL;

CREATE INDEX IF NOT EXISTS secop_contratos_entidad_notice_idx
  ON public.secop_contratos (nit_entidad, (substring(url from 'noticeUID=(CO1\.NTC\.[0-9]+)')))
  WHERE url LIKE '%noticeUID=%';

CREATE OR REPLACE VIEW public.secop_procesos_radar
WITH (security_invoker = true) AS
SELECT p.*
FROM public.secop_procesos p
WHERE p.estado IN ('publicado', 'evaluacion', 'abierto', 'seleccionado')
  AND NOT EXISTS (
    SELECT 1 FROM public.secop_contratos c
    WHERE c.nit_entidad = p.nit_entidad AND c.proceso IS NOT NULL AND c.proceso = p.portafolio
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.secop_contratos c
    WHERE p.notice_uid IS NOT NULL
      AND c.nit_entidad = p.nit_entidad
      AND c.url LIKE '%noticeUID=%'
      AND substring(c.url from 'noticeUID=(CO1\.NTC\.[0-9]+)') = p.notice_uid
  );

REVOKE ALL ON TABLE public.secop_procesos_radar FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.secop_procesos_radar TO service_role;

COMMENT ON VIEW public.secop_procesos_radar IS
  'Procesos del radar: estado publicado, evaluacion, abierto o seleccionado y sin contrato cargado de la misma entidad '
  '(secop_contratos.proceso = portafolio, o el mismo noticeUID exacto en secop_contratos.url). Usa los índices '
  'secop_contratos_entidad_proceso_idx y secop_contratos_entidad_notice_idx (0891). Solo service_role.';

DO $$
DECLARE
  nit_prueba constant text := '999999999';
  n bigint;
BEGIN
  -- Privilegios y security_invoker
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace
    WHERE ns.nspname = 'public' AND c.relname = 'secop_procesos_radar' AND c.relkind = 'v'
      AND coalesce(c.reloptions, ARRAY[]::text[]) @> ARRAY['security_invoker=true']
  ) THEN
    RAISE EXCEPTION '0891: la vista no es security_invoker';
  END IF;
  IF has_table_privilege('anon', 'public.secop_procesos_radar', 'SELECT') OR has_table_privilege('authenticated', 'public.secop_procesos_radar', 'SELECT') THEN
    RAISE EXCEPTION '0891: anon/authenticated pueden leer la vista';
  END IF;

  -- Equivalencia con la regla de la 0890 sobre las filas reales: mismas filas en el radar (la regla vieja, que es la
  -- lenta, se calcula una sola vez en una tabla temporal)
  CREATE TEMP TABLE _radar_0890 ON COMMIT DROP AS
    SELECT p.id_proceso FROM public.secop_procesos p
    WHERE p.estado IN ('publicado', 'evaluacion', 'abierto', 'seleccionado')
      AND NOT EXISTS (SELECT 1 FROM public.secop_contratos c WHERE c.nit_entidad = p.nit_entidad
            AND (c.proceso = p.portafolio OR (p.notice_uid IS NOT NULL AND (c.url LIKE '%' || p.notice_uid || '&%' OR c.url LIKE '%' || p.notice_uid))));
  SELECT count(*) INTO n FROM (SELECT id_proceso FROM _radar_0890 EXCEPT SELECT id_proceso FROM public.secop_procesos_radar) a;
  IF n <> 0 THEN RAISE EXCEPTION '0891: la vista nueva deja fuera % procesos que la regla anterior mostraba', n; END IF;
  SELECT count(*) INTO n FROM (SELECT id_proceso FROM public.secop_procesos_radar EXCEPT SELECT id_proceso FROM _radar_0890) b;
  IF n <> 0 THEN RAISE EXCEPTION '0891: la vista nueva muestra % procesos que la regla anterior sacaba', n; END IF;

  -- Los casos de la 0890, con INSERT que se deshacen
  IF EXISTS (SELECT 1 FROM public.secop_procesos WHERE nit_entidad = nit_prueba) OR EXISTS (SELECT 1 FROM public.secop_contratos WHERE nit_entidad = nit_prueba) THEN
    RAISE EXCEPTION '0891: el NIT de prueba ya tiene filas';
  END IF;
  BEGIN
    INSERT INTO public.secop_procesos (id_proceso, portafolio, notice_uid, nit_entidad, estado, linea, lineas)
    VALUES ('CO1.REQ.999100001', 'CO1.BDOS.999100001', 'CO1.NTC.999100001', nit_prueba, 'publicado', 'trauma', ARRAY['trauma']),
           ('CO1.REQ.999100002', 'CO1.BDOS.999100002', 'CO1.NTC.999100002', nit_prueba, 'evaluacion', 'trauma', ARRAY['trauma']),
           ('CO1.REQ.999100003', 'CO1.BDOS.999100003', 'CO1.NTC.999100003', nit_prueba, 'seleccionado', 'trauma', ARRAY['trauma']),
           ('CO1.REQ.999100004', 'CO1.BDOS.999100004', NULL, nit_prueba, 'cancelado', 'trauma', ARRAY['trauma']);
    SELECT count(*) INTO n FROM public.secop_procesos_radar WHERE nit_entidad = nit_prueba;
    IF n <> 3 THEN RAISE EXCEPTION '0891: sin contratos la vista debe mostrar 3 y mostró %', n; END IF;
    -- otra entidad con el mismo portafolio y noticeUID, y un noticeUID que solo comparte el prefijo: no sacan nada
    INSERT INTO public.secop_contratos (fuente, origen, id_contrato, nit_entidad, proceso, url)
    VALUES ('secop2', 'SECOPII', '__prueba_0891_otra__', '999999998', 'CO1.BDOS.999100001',
            'https://community.secop.gov.co/Public/Tendering/OpportunityDetail/Index?noticeUID=CO1.NTC.999100001&isFromPublicArea=True');
    INSERT INTO public.secop_contratos (fuente, origen, id_contrato, nit_entidad, url)
    VALUES ('integrado', 'SECOPII', '__prueba_0891_prefijo__', nit_prueba,
            'https://community.secop.gov.co/Public/Tendering/OpportunityDetail/Index?noticeUID=CO1.NTC.9991000021&isFromPublicArea=True');
    SELECT count(*) INTO n FROM public.secop_procesos_radar WHERE nit_entidad = nit_prueba;
    IF n <> 3 THEN RAISE EXCEPTION '0891: otra entidad o un prefijo sacaron procesos (quedan %)', n; END IF;
    -- misma entidad por portafolio y por noticeUID (al final de la url y con más parámetros): salen esos dos
    INSERT INTO public.secop_contratos (fuente, origen, id_contrato, nit_entidad, proceso, url)
    VALUES ('secop2', 'SECOPII', '__prueba_0891_portafolio__', nit_prueba, 'CO1.BDOS.999100001', NULL);
    INSERT INTO public.secop_contratos (fuente, origen, id_contrato, nit_entidad, url)
    VALUES ('integrado', 'SECOPII', '__prueba_0891_notice__', nit_prueba,
            'https://community.secop.gov.co/Public/Tendering/OpportunityDetail/Index?noticeUID=CO1.NTC.999100002');
    SELECT count(*) INTO n FROM public.secop_procesos_radar WHERE nit_entidad = nit_prueba;
    IF n <> 1 OR NOT EXISTS (SELECT 1 FROM public.secop_procesos_radar WHERE id_proceso = 'CO1.REQ.999100003') THEN
      RAISE EXCEPTION '0891: con contrato por portafolio y por noticeUID debe quedar solo CO1.REQ.999100003 (quedan %)', n;
    END IF;
    RAISE SQLSTATE 'P0891';
  EXCEPTION
    WHEN SQLSTATE 'P0891' THEN NULL;
  END;
  IF EXISTS (SELECT 1 FROM public.secop_procesos WHERE nit_entidad = nit_prueba)
     OR EXISTS (SELECT 1 FROM public.secop_contratos WHERE nit_entidad IN (nit_prueba, '999999998')) THEN
    RAISE EXCEPTION '0891: quedaron filas de prueba';
  END IF;
  RAISE NOTICE '0891 OK: vista secop_procesos_radar con índices de igualdad; mismo resultado que la 0890.';
END;
$$;

COMMIT;
