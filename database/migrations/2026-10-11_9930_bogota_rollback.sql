-- =====================================================================================
-- OpMap · Bogotá hacia afuera: una ciudad, cuatro corredores · 9930 — Rollback de 0700
-- Proyecto: norvxqgohddgsdkggqzq · Generado: 2026-10-11
--
-- ANTES DE EJECUTAR: volver a desplegar el código anterior a este cambio. El motor de asignación,
--   /api/kams/bogota-config, la simulación y la ficha de la IPS leen bogota_config,
--   bogota_corredores y assignments.detail; tras el rollback esas consultas fallarían.
--
-- Qué deshace (una sola transacción, todo o nada):
--   1. Las asignaciones guardadas con assignment_type = 'bogota_corredor' pasan a 'competitive'
--      (siguen en la misma zona y con el mismo tiempo; solo pierden la etiqueta y el detalle). Lo
--      correcto después es recalcular desde la app con el código anterior.
--   2. Quita assignments.detail (y su CHECK assignments_detail_object_check).
--   3. Borra bogota_config y bogota_corredores con sus datos.
--   Si 0700 amplió un CHECK de assignment_type (el 2026-10-11 no existía ninguno), se deja como
--   está: admite un valor más y no estorba.
--
-- PÉRDIDAS: la configuración de Bogotá (k, tope, celda por corredor) y las excepciones por
--   municipio que el dueño haya editado después de la semilla. Exportarlas antes si importan:
--     SELECT * FROM public.bogota_config;  SELECT * FROM public.bogota_corredores ORDER BY 1, 2;
--
-- Orden respecto a otros rollbacks: independiente (nada tiene FKs hacia estas tablas;
--   bogota_config.updated_by apunta a users y se va con la tabla). Re-ejecutable: sí (IF EXISTS).
-- =====================================================================================

BEGIN;

DO $$
DECLARE
  n bigint;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'assignments' AND column_name = 'detail'
  ) THEN
    SELECT count(*) INTO n FROM public.assignments WHERE assignment_type = 'bogota_corredor';
    RAISE NOTICE 'Rollback Bogotá corredores: % asignación(es) bogota_corredor pasan a competitive', n;
  END IF;
  IF to_regclass('public.bogota_corredores') IS NOT NULL THEN
    SELECT count(*) INTO n FROM public.bogota_corredores;
    RAISE NOTICE 'Rollback Bogotá corredores: se borran % fila(s) de bogota_corredores', n;
  END IF;
END;
$$;

UPDATE public.assignments SET assignment_type = 'competitive' WHERE assignment_type = 'bogota_corredor';

ALTER TABLE public.assignments DROP CONSTRAINT IF EXISTS assignments_detail_object_check;
ALTER TABLE public.assignments DROP COLUMN IF EXISTS detail;

DROP TABLE IF EXISTS public.bogota_config;
DROP TABLE IF EXISTS public.bogota_corredores;

DO $$
BEGIN
  IF to_regclass('public.bogota_config') IS NOT NULL OR to_regclass('public.bogota_corredores') IS NOT NULL THEN
    RAISE EXCEPTION 'Rollback Bogotá corredores: alguna tabla sigue existiendo';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'assignments' AND column_name = 'detail'
  ) THEN
    RAISE EXCEPTION 'Rollback Bogotá corredores: assignments.detail sigue existiendo';
  END IF;
  RAISE NOTICE 'Rollback Bogotá corredores OK: 2 tablas y assignments.detail borradas. SIGUIENTE PASO: recalcular desde la app con el código anterior.';
END;
$$;

COMMIT;
