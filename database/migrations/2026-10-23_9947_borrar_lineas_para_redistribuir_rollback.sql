-- =====================================================================================
-- OpMap · feat/zonas-por-linea (Zonas por línea para las líderes) · 9947 — Rollback de 0870
-- Proyecto: norvxqgohddgsdkggqzq · Generado: 2026-10-23
--
-- Qué deshace (una sola transacción, todo o nada), en orden inverso a la 0870:
--   1. Quita de executive_allowed_lines las dos restricciones que puso la 0870, identificadas igual que allí (SIN
--      NOMBRES DE PERSONA EN ESTE SQL): la persona ACTIVE con base en la Zona area_id = '08001' que llevaba perossal
--      en el respaldo → perossal y reemplazo; la vacante PLACEHOLDER con base en esa Zona → deportiva, columna y
--      trauma. Cualquier otra restricción que la dirección haya fijado después desde Ejecutivos Comerciales se queda.
--   2. Restaura executive_lines desde public.executive_lines_respaldo_20261023 (INSERT … ON CONFLICT DO NOTHING):
--      lo que las líderes hayan asignado desde Zonas entre la 0870 y este rollback se CONSERVA (no se borra nada).
--   3. NO borra el respaldo (queda como historial de cómo estaban las líneas el 2026-10-23).
--
-- Lo que NO se deshace:
--   - Los visitantes (medico_visitantes) que el disparador de la 0820 terminó al borrar las líneas quedan terminados
--     con fin_motivo 'linea_quitada': volver a insertar en executive_lines no los reabre (el disparador es solo
--     AFTER DELETE). Si hace falta, se reasignan desde /terceros.
--   - La tabla coverage queda desactualizada hasta recalcular: después de este rollback, `npm run fase2:recalculate`
--     o "Recalcular cobertura" en /lines (sin Google).
--
-- Requiere: el respaldo executive_lines_respaldo_20261023 (aborta si no existe) y executive_allowed_lines (0860);
--   si la 9946 ya quitó esa tabla, el paso 1 se omite con un NOTICE.
-- Re-ejecutable: sí (DELETE y INSERT idempotentes). Orden: 9947 ANTES que 9946.
-- =====================================================================================

BEGIN;

-- -------------------------------------------------------------------------------------
-- 0. Precondiciones y aviso
-- -------------------------------------------------------------------------------------

DO $$
DECLARE
  v_respaldo bigint;
  v_actuales bigint;
BEGIN
  IF to_regclass('public.executive_lines_respaldo_20261023') IS NULL THEN
    RAISE EXCEPTION 'Rollback 0870: no existe public.executive_lines_respaldo_20261023; sin respaldo no hay qué restaurar';
  END IF;
  IF to_regclass('public.executive_lines') IS NULL THEN
    RAISE EXCEPTION 'Rollback 0870: no existe public.executive_lines';
  END IF;
  SELECT count(*) INTO v_respaldo FROM public.executive_lines_respaldo_20261023;
  SELECT count(*) INTO v_actuales FROM public.executive_lines;
  RAISE NOTICE 'Rollback 0870: se restauran % fila(s) del respaldo sobre las % que hay hoy en executive_lines (las de hoy se conservan); los visitantes terminados por el disparador NO se reabren', v_respaldo, v_actuales;
END;
$$;

-- -------------------------------------------------------------------------------------
-- 1. Quitar las dos restricciones que puso la 0870 (si la tabla sigue existiendo)
-- -------------------------------------------------------------------------------------

DO $$
DECLARE
  v_borradas bigint;
BEGIN
  IF to_regclass('public.executive_allowed_lines') IS NULL THEN
    RAISE NOTICE 'Rollback 0870: executive_allowed_lines ya no existe (9946 aplicada); no hay restricciones que quitar';
    RETURN;
  END IF;

  -- Persona activa de la Zona 08001 que llevaba perossal en el respaldo → perossal y reemplazo
  DELETE FROM public.executive_allowed_lines a
  USING public.executives e, public.kams k, public.business_lines bl
  WHERE a.executive_id = e.id AND e.base_kam_id = k.id AND a.line_id = bl.id
    AND k.area_id = '08001' AND e.status = 'active'
    AND bl.code IN ('perossal', 'reemplazo')
    AND EXISTS (
      SELECT 1 FROM public.executive_lines_respaldo_20261023 r
      JOIN public.business_lines b2 ON b2.id = r.line_id
      WHERE r.executive_id = e.id AND b2.code = 'perossal');
  GET DIAGNOSTICS v_borradas = ROW_COUNT;
  RAISE NOTICE 'Rollback 0870: quitadas % restricción(es) de la persona de Barranquilla', v_borradas;

  -- Vacante (placeholder) de la Zona 08001 → deportiva, columna y trauma
  DELETE FROM public.executive_allowed_lines a
  USING public.executives e, public.kams k, public.business_lines bl
  WHERE a.executive_id = e.id AND e.base_kam_id = k.id AND a.line_id = bl.id
    AND k.area_id = '08001' AND e.status = 'placeholder'
    AND bl.code IN ('deportiva', 'columna', 'trauma');
  GET DIAGNOSTICS v_borradas = ROW_COUNT;
  RAISE NOTICE 'Rollback 0870: quitadas % restricción(es) de la vacante de Barranquilla', v_borradas;
END;
$$;

-- -------------------------------------------------------------------------------------
-- 2. Restaurar executive_lines desde el respaldo (solo personas y líneas que sigan existiendo)
-- -------------------------------------------------------------------------------------

DO $$
DECLARE
  v_insertadas bigint;
BEGIN
  INSERT INTO public.executive_lines (executive_id, line_id)
  SELECT r.executive_id, r.line_id
  FROM public.executive_lines_respaldo_20261023 r
  WHERE EXISTS (SELECT 1 FROM public.executives e WHERE e.id = r.executive_id)
    AND EXISTS (SELECT 1 FROM public.business_lines bl WHERE bl.id = r.line_id)
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_insertadas = ROW_COUNT;
  RAISE NOTICE 'Rollback 0870: restauradas % fila(s) en executive_lines (0 si ya estaban)', v_insertadas;
END;
$$;

-- -------------------------------------------------------------------------------------
-- 3. Comprobación: todo lo del respaldo (que siga existiendo) está en executive_lines; el respaldo sigue ahí
-- -------------------------------------------------------------------------------------

DO $$
DECLARE
  v_faltan bigint;
  v_total  bigint;
BEGIN
  SELECT count(*) INTO v_faltan
  FROM public.executive_lines_respaldo_20261023 r
  WHERE EXISTS (SELECT 1 FROM public.executives e WHERE e.id = r.executive_id)
    AND EXISTS (SELECT 1 FROM public.business_lines bl WHERE bl.id = r.line_id)
    AND NOT EXISTS (SELECT 1 FROM public.executive_lines el WHERE el.executive_id = r.executive_id AND el.line_id = r.line_id);
  IF v_faltan > 0 THEN
    RAISE EXCEPTION 'Rollback 0870: % fila(s) del respaldo no quedaron en executive_lines', v_faltan;
  END IF;
  IF to_regclass('public.executive_lines_respaldo_20261023') IS NULL THEN
    RAISE EXCEPTION 'Rollback 0870: el respaldo no debía borrarse';
  END IF;
  SELECT count(*) INTO v_total FROM public.executive_lines;
  RAISE NOTICE 'Rollback 0870 OK: executive_lines con % fila(s); el respaldo se conserva. SIGUIENTE PASO: recalcular la cobertura (npm run fase2:recalculate o "Recalcular cobertura" en /lines).', v_total;
END;
$$;

COMMIT;
