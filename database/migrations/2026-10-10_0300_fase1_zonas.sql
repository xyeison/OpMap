-- =====================================================================================
-- OpMap · Fase 1 (zonas y equipo) · 0300 — Cambios en zonas (tabla kams)
-- Proyecto: norvxqgohddgsdkggqzq · Generado: 2026-10-10 · NO EJECUTADO TODAVÍA
--
-- Qué hace:
--   1. Activa Cartagena (13001) e Ibagué (73001). Ya tienen participates_in_assignment = true
--      y distancias calculadas (580 y 577 filas en hospital_kam_distances).
--   2. Borra "KAM Barranquilla MD" y "Kam Valledupar MD": inactivas, sin asignaciones, sin
--      distancias, sin asignaciones forzadas y sin visitas. Antes de borrar se comprueba;
--      si alguna cuenta no es 0, RAISE EXCEPTION y no se aplica nada.
--   No se toca: Neiva (41001) sigue ACTIVA (zona vacante = sin ejecutiva, pero la zona existe
--   y sigue recibiendo IPS). Sincelejo (70001) sigue INACTIVA (dentro de Montería).
--
-- Foto con SELECT el 2026-10-10 (antes de este script):
--   KAM Cartagena       13001  active=false participates=true  asig=0  dist=580 (191 visitas)
--   KAM Ibagué          73001  active=false participates=true  asig=0  dist=577
--   KAM Barranquilla MD 08001  active=false participates=false asig=0  dist=0  forced=0 visitas=0
--   Kam Valledupar MD   20001  active=false participates=false asig=0  dist=0  forced=0 visitas=0
--   Tablas con FK a kams: assignments (CASCADE), hospital_kam_distances (CASCADE),
--   forced_assignments (CASCADE), visits (sin acción: un DELETE con visitas fallaría).
--
-- IMPORTANTE — DESPUÉS DE EJECUTAR HAY QUE RECALCULAR DESDE LA APP.
--   Este script no toca public.assignments. Hasta recalcular, Cartagena e Ibagué aparecen en
--   el mapa (kams es de lectura pública) con 0 IPS y sus IPS siguen asignadas a Barranquilla /
--   Pereira / Neiva. Recalcular con el botón de recálculo de la página principal (componente
--   RecalculateUnified → POST /api/recalculate-simplified, que carga las zonas con
--   participates_in_assignment = true AND active = true) en cuanto termine este script.
--   Criterio de aceptación de
--   la Fase 1: el mapa base queda igual al de hoy salvo Cartagena e Ibagué.
--
-- Orden: independiente de 0100/0200 (puede ir antes o después). Recomendado: 0100 → 0200 → 0300.
-- Transaccional: todo o nada. Re-ejecutable: sí (si las MD ya no existen, se omite el borrado).
-- Rollback: 9900, sección B (re-desactivar Cartagena/Ibagué y recalcular). Las filas MD no se
--   recuperan automáticamente: ver la sección B del rollback.
-- =====================================================================================

BEGIN;

-- -------------------------------------------------------------------------------------
-- 1. Comprobación previa de las zonas "MD" y borrado
-- -------------------------------------------------------------------------------------

-- Foto informativa (se ve en el resultado del SQL Editor / psql).
SELECT k.id, k.name, k.area_id, k.active, k.participates_in_assignment,
       (SELECT count(*) FROM public.assignments a            WHERE a.kam_id = k.id) AS asignaciones,
       (SELECT count(*) FROM public.hospital_kam_distances d WHERE d.kam_id = k.id) AS distancias,
       (SELECT count(*) FROM public.forced_assignments f     WHERE f.kam_id = k.id) AS forzadas,
       (SELECT count(*) FROM public.visits v                 WHERE v.kam_id = k.id) AS visitas
FROM public.kams k
WHERE k.name IN ('KAM Barranquilla MD', 'Kam Valledupar MD', 'KAM Cartagena', 'KAM Ibagué')
ORDER BY k.name;

DO $$
DECLARE
  r       record;
  n_asig  bigint;
  n_dist  bigint;
  n_forz  bigint;
  n_vis   bigint;
  n_md    int := 0;
BEGIN
  FOR r IN
    SELECT k.id, k.name, k.active
    FROM public.kams k
    WHERE k.name IN ('KAM Barranquilla MD', 'Kam Valledupar MD')
    FOR UPDATE
  LOOP
    n_md := n_md + 1;

    SELECT count(*) INTO n_asig FROM public.assignments            WHERE kam_id = r.id;
    SELECT count(*) INTO n_dist FROM public.hospital_kam_distances WHERE kam_id = r.id;
    SELECT count(*) INTO n_forz FROM public.forced_assignments     WHERE kam_id = r.id;
    SELECT count(*) INTO n_vis  FROM public.visits                 WHERE kam_id = r.id;

    IF r.active IS TRUE THEN
      RAISE EXCEPTION 'Fase 1: "%" está ACTIVA; no se borra una zona activa', r.name;
    END IF;
    IF n_asig <> 0 OR n_dist <> 0 OR n_forz <> 0 OR n_vis <> 0 THEN
      RAISE EXCEPTION 'Fase 1: "%" tiene datos ligados (asignaciones %, distancias %, forzadas %, visitas %); no se borra',
        r.name, n_asig, n_dist, n_forz, n_vis;
    END IF;

    -- Ninguna ejecutiva debe tener esta zona como base (0200 resuelve sin las MD).
    IF to_regclass('public.executives') IS NOT NULL THEN
      EXECUTE 'SELECT count(*) FROM public.executives WHERE base_kam_id = $1' INTO n_asig USING r.id;
      IF n_asig <> 0 THEN
        RAISE EXCEPTION 'Fase 1: "%" es zona base de % ejecutiva(s); no se borra', r.name, n_asig;
      END IF;
    END IF;
  END LOOP;

  IF n_md = 0 THEN
    RAISE NOTICE 'Fase 1: las zonas MD ya no existen; se omite el borrado';
  ELSE
    -- line_zones / coverage / coverage_overrides (si existen) se limpian por ON DELETE CASCADE.
    DELETE FROM public.kams
    WHERE name IN ('KAM Barranquilla MD', 'Kam Valledupar MD');
    RAISE NOTICE 'Fase 1: borradas % zona(s) MD', n_md;
  END IF;
END $$;

-- -------------------------------------------------------------------------------------
-- 2. Activar Cartagena e Ibagué
-- -------------------------------------------------------------------------------------

UPDATE public.kams
SET active = true
WHERE area_id IN ('13001', '73001')
  AND active IS DISTINCT FROM true;

-- -------------------------------------------------------------------------------------
-- 3. Comprobaciones finales
-- -------------------------------------------------------------------------------------

DO $$
DECLARE
  n int;
BEGIN
  SELECT count(*) INTO n FROM public.kams
  WHERE area_id IN ('13001', '73001') AND active IS TRUE AND participates_in_assignment IS TRUE;
  IF n <> 2 THEN
    RAISE EXCEPTION 'Fase 1: se esperaban Cartagena e Ibagué activas y participando, hay %', n;
  END IF;

  SELECT count(*) INTO n FROM public.kams WHERE name IN ('KAM Barranquilla MD', 'Kam Valledupar MD');
  IF n <> 0 THEN
    RAISE EXCEPTION 'Fase 1: siguen existiendo % zona(s) MD', n;
  END IF;

  SELECT count(*) INTO n FROM public.kams WHERE area_id = '41001' AND active IS TRUE;
  IF n <> 1 THEN
    RAISE EXCEPTION 'Fase 1: Neiva (41001) debe seguir activa (zona vacante), hay % activas', n;
  END IF;

  SELECT count(*) INTO n FROM public.kams WHERE area_id = '70001' AND active IS TRUE;
  IF n <> 0 THEN
    RAISE EXCEPTION 'Fase 1: Sincelejo (70001) debe seguir inactiva';
  END IF;

  RAISE NOTICE 'Fase 1 zonas OK. SIGUIENTE PASO: recalcular asignaciones desde la app.';
END $$;

COMMIT;
