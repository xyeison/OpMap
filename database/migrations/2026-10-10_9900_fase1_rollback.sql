-- =====================================================================================
-- OpMap · Fase 1 (zonas y equipo) · 9900 — Rollback de 0100, 0200 y 0300
-- Proyecto: norvxqgohddgsdkggqzq · Generado: 2026-10-10 · NO EJECUTADO TODAVÍA
--
-- Dos secciones independientes, cada una en su propia transacción. Ejecutar solo la que haga
-- falta (en el SQL Editor: seleccionar el bloque BEGIN … COMMIT y ejecutar la selección).
--
--   A. Deshace 0100 + 0200: borra las 6 tablas nuevas (y con ellas todos sus datos:
--      líneas, ejecutivas, matriz línea × zona, cobertura y ajustes manuales) y quita el
--      comentario que 0100 puso en public.kams (antes era NULL). DESTRUCTIVO: si ya se
--      editaron datos desde la app, se pierden. Antes, exportarlos si interesan.
--      Antes de ejecutar A, retirar del despliegue (o no usar) las pantallas y rutas
--      /api/business-lines y /api/executives, que fallarán al no encontrar las tablas.
--
--   B. Deshace 0300 en lo que es reversible: vuelve a desactivar Cartagena (13001) e
--      Ibagué (73001). DESPUÉS HAY QUE RECALCULAR desde la app (botón de la página principal
--      → POST /api/recalculate-simplified) para devolver sus IPS a Barranquilla / Pereira /
--      Neiva; hasta entonces public.assignments conserva filas de zonas inactivas.
--      Las zonas "KAM Barranquilla MD" y "Kam Valledupar MD" NO se recuperan con un simple
--      UPDATE: 0300 las borró. No tenían asignaciones, distancias, forzadas ni visitas, así
--      que no hay datos dependientes que perder. Si de verdad hicieran falta, al final de B
--      va (COMENTADO) el INSERT con sus valores exactos tomados con SELECT el 2026-10-10.
--      Copia completa de kams también en el respaldo del Paso 0
--      (scratchpad/backup-2026-10-10/data).
--
-- Re-ejecutable: sí (IF EXISTS / UPDATE idempotente).
-- =====================================================================================


-- =====================================================================================
-- A. Rollback de 0100 + 0200 (tablas nuevas), en orden inverso de dependencias
-- =====================================================================================

BEGIN;

DROP TABLE IF EXISTS public.coverage_overrides;
DROP TABLE IF EXISTS public.coverage;
DROP TABLE IF EXISTS public.line_zones;
DROP TABLE IF EXISTS public.executive_lines;
DROP TABLE IF EXISTS public.executives;
DROP TABLE IF EXISTS public.business_lines;
-- (Los triggers e índices caen con sus tablas. La función update_updated_at_column() es
--  previa a la Fase 1 y la usan otras tablas: NO se borra.)

COMMENT ON TABLE public.kams IS NULL;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['business_lines','executives','executive_lines',
                           'line_zones','coverage','coverage_overrides'] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      RAISE EXCEPTION 'Rollback Fase 1: public.% sigue existiendo', t;
    END IF;
  END LOOP;
END $$;

COMMIT;


-- =====================================================================================
-- B. Rollback de 0300 (zonas): re-desactivar Cartagena e Ibagué
-- =====================================================================================

BEGIN;

UPDATE public.kams
SET active = false
WHERE area_id IN ('13001', '73001')
  AND active IS DISTINCT FROM false;

DO $$
DECLARE
  n int;
BEGIN
  SELECT count(*) INTO n FROM public.kams WHERE area_id IN ('13001', '73001') AND active IS TRUE;
  IF n <> 0 THEN
    RAISE EXCEPTION 'Rollback Fase 1: Cartagena/Ibagué siguen activas (%)', n;
  END IF;
  RAISE NOTICE 'Rollback 0300 OK. SIGUIENTE PASO: recalcular asignaciones desde la app.';
END $$;

-- Solo si hace falta recuperar las zonas MD borradas (valores exactos del 2026-10-10).
-- Descomentar a propósito; quedan inactivas y fuera de la asignación, como estaban.
-- INSERT INTO public.kams (id, name, area_id, lat, lng, enable_level2, max_travel_time, priority,
--                          color, active, created_at, updated_at, participates_in_assignment, zone_id)
-- VALUES
--   ('48433774-399d-40b5-b80f-0fec699fea6a', 'KAM Barranquilla MD', '08001', 11.00410377, -74.80690357,
--    false, 240, 2, '#F39C12', false, '2025-08-22 20:22:58.204+00', '2026-09-18 20:02:57.280632+00', false, NULL),
--   ('34e0c44b-4f2c-4ea3-ad17-698e2a89abbf', 'Kam Valledupar MD', '20001', 10.47424767, -73.24362964,
--    false, 240, 2, '#3498DB', false, '2025-08-22 20:35:22.428+00', '2025-11-07 23:26:16.317729+00', false, NULL)
-- ON CONFLICT (id) DO NOTHING;
-- Nota: si la sección A no se ha ejecutado, 0200 ignora las filas MD (regex '\sMD$'), así que
-- recuperarlas no rompe la siembra.

COMMIT;
