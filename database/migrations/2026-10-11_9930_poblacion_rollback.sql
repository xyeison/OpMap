-- =====================================================================================
-- OpMap · Fase 4 (población) · 9930 — Rollback de 0640
-- Proyecto: norvxqgohddgsdkggqzq · Generado: 2026-10-11
--
-- ANTES DE EJECUTAR: volver a desplegar el código anterior a la Fase 4 si alguna página o API ya
--   consulta estas tablas (la parte de app/ la hace G3; tras el rollback esas consultas fallarían).
--
-- Qué deshace (una sola transacción, todo o nada): borra bdua_afiliados, afiliacion_cifras,
--   dane_proyecciones y municipio_alias con todos sus datos. No toca municipalities ni ninguna
--   otra tabla.
--
-- PÉRDIDAS: datos públicos descargados (BDUA de datos.gov.co, cifras de MinSalud, proyecciones del
--   DANE) y los alias de municipio. Se recuperan volviendo a aplicar 0640 (trae la semilla de 55
--   alias de la BDUA) y corriendo otra vez los 3 scripts de carga (minutos, sin costo). Los alias que
--   se añadan a mano después de la semilla se pierden: exportarlos antes si importan.
--
-- Orden respecto a otros rollbacks: independiente (ninguna tabla tiene FKs desde otras tablas;
--   municipio_alias tiene una FK HACIA municipalities, que se va con la tabla).
-- Re-ejecutable: sí (IF EXISTS).
-- =====================================================================================

BEGIN;

DO $$
DECLARE
  t text;
  n bigint;
BEGIN
  FOREACH t IN ARRAY ARRAY['bdua_afiliados', 'afiliacion_cifras', 'dane_proyecciones', 'municipio_alias'] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('SELECT count(*) FROM public.%I', t) INTO n;
      RAISE NOTICE 'Rollback Fase 4 población: se borran % fila(s) de %', n, t;
    END IF;
  END LOOP;
END;
$$;

DROP TABLE IF EXISTS public.bdua_afiliados;
DROP TABLE IF EXISTS public.afiliacion_cifras;
DROP TABLE IF EXISTS public.dane_proyecciones;
DROP TABLE IF EXISTS public.municipio_alias;

DO $$
BEGIN
  IF to_regclass('public.bdua_afiliados') IS NOT NULL
     OR to_regclass('public.afiliacion_cifras') IS NOT NULL
     OR to_regclass('public.dane_proyecciones') IS NOT NULL
     OR to_regclass('public.municipio_alias') IS NOT NULL THEN
    RAISE EXCEPTION 'Rollback Fase 4 población: alguna tabla sigue existiendo';
  END IF;
  RAISE NOTICE 'Rollback Fase 4 población OK: 4 tablas borradas.';
END;
$$;

COMMIT;
