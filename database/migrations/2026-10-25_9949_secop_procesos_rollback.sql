-- =====================================================================================
-- OpMap · feat/secop-procesos (procesos de SECOP II sin contrato como radar comercial) · 9949 — Rollback de 0890
-- Proyecto: norvxqgohddgsdkggqzq · Generado: 2026-10-25 · NO EJECUTADO TODAVÍA
--
-- ANTES DE EJECUTAR: quitar el cron /api/cron/secop_procesos de web/vercel.json (si no, el cron fallará cada día y
--   dejará la fuente en error hasta que se quite; la fila de fuentes_estado se borra aquí). Las tarjetas del mapa y la
--   ficha NO necesitan redesplegarse: loadProcesosRadar (web/app/api/secop/_lib/secop-server.ts) devuelve [] si la vista
--   no existe y las rutas responden 200 con procesos: null.
--
-- Qué deshace (una sola transacción, todo o nada):
--   1. La vista public.secop_procesos_radar.
--   2. La tabla public.secop_procesos (sus índices, constraints, comentarios y privilegios se van con ella).
--   3. La fila 'secop_procesos' de public.fuentes_estado.
--   NO toca secop_contratos, secop_contratos_unicos, secop_hechos ni ninguna otra fuente.
--
-- PÉRDIDAS: los procesos cargados (datos públicos de datos.gov.co, p6dx-8zbt): se recuperan con la carga inicial
--   (web/scripts/secop-procesos-load.ts --inicial) si se vuelve a aplicar la 0890. El cursor y el estado de la fuente se
--   pierden con su fila.
--
-- Re-ejecutable: sí (IF EXISTS). Tras aplicar: NOTIFY pgrst, 'reload schema';
-- =====================================================================================

BEGIN;

-- -------------------------------------------------------------------------------------
-- 0. Aviso con lo que se va a borrar
-- -------------------------------------------------------------------------------------

DO $$
DECLARE
  n bigint := 0;
BEGIN
  IF to_regclass('public.secop_procesos') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.secop_procesos' INTO n;
  END IF;
  RAISE NOTICE 'Rollback 0890: se borran la vista secop_procesos_radar, la tabla secop_procesos (% filas) y la fuente secop_procesos de fuentes_estado', n;
END;
$$;

-- -------------------------------------------------------------------------------------
-- 1. Vista y tabla (sin CASCADE: si algo más dependiera de ellas, aborta)
-- -------------------------------------------------------------------------------------

DROP VIEW IF EXISTS public.secop_procesos_radar;
DROP TABLE IF EXISTS public.secop_procesos;

-- -------------------------------------------------------------------------------------
-- 2. Fila de la fuente
-- -------------------------------------------------------------------------------------

DELETE FROM public.fuentes_estado WHERE fuente = 'secop_procesos';

-- -------------------------------------------------------------------------------------
-- 3. Comprobación: no queda nada de 0890
-- -------------------------------------------------------------------------------------

DO $$
BEGIN
  IF to_regclass('public.secop_procesos_radar') IS NOT NULL THEN
    RAISE EXCEPTION 'Rollback 0890: sigue existiendo public.secop_procesos_radar';
  END IF;
  IF to_regclass('public.secop_procesos') IS NOT NULL THEN
    RAISE EXCEPTION 'Rollback 0890: sigue existiendo public.secop_procesos';
  END IF;
  IF EXISTS (SELECT 1 FROM public.fuentes_estado WHERE fuente = 'secop_procesos') THEN
    RAISE EXCEPTION 'Rollback 0890: sigue la fila secop_procesos en fuentes_estado';
  END IF;
  RAISE NOTICE 'Rollback 0890 OK: sin secop_procesos, sin secop_procesos_radar y sin la fuente secop_procesos. SIGUIENTE PASO: NOTIFY pgrst, ''reload schema''.';
END;
$$;

COMMIT;
