-- =====================================================================================
-- OpMap · feat/zonas-por-linea (Zonas por línea para las líderes) · 0870 — Migración de DATOS: borrar las líneas
--   asignadas para redistribuir desde cero, con respaldo y dos restricciones iniciales
-- Proyecto: norvxqgohddgsdkggqzq · Generado: 2026-10-23 · NO EJECUTADO TODAVÍA
--
-- *** SOLO CON AUTORIZACIÓN EXPRESA DEL DUEÑO, EN LA VENTANA DEL DESPLIEGUE DE "Zonas por línea" Y SEGUIDA DEL
-- *** RECÁLCULO DE COBERTURA (`npm run fase2:recalculate` o el botón "Recalcular cobertura" en /lines; también la
-- *** página Zonas recalcula y guarda al abrirse si encuentra la tabla coverage desactualizada). Costo Google: 0.
--
-- Decisión del dueño (2026-10-23, docs/decisiones/2026-10-23-zonas-por-linea-las-lideres-asignan.md, puntos 2 y 4):
--   "yo diría que borrarla [la asignación de líneas] y que ellas tengan una opción de ver todas las zonas"; y, por
--   ahora, solo dos restricciones: la persona de Barranquilla puede tener Sustitutos óseos (code perossal) y Reemplazo
--   articular (reemplazo); la vacante de Barranquilla, las otras líneas (deportiva, columna y trauma). Las demás
--   personas quedan sin restricción mientras se redistribuye.
--
-- Qué hace (una sola transacción, todo o nada), en este orden:
--   1. Precondiciones: 0860 aplicada (executive_allowed_lines), executive_lines, kams, business_lines con los 5
--      códigos; disparador executive_lines_termina_visitantes de la 0820 presente (ver consecuencias).
--   2. Respaldo: CREATE TABLE IF NOT EXISTS public.executive_lines_respaldo_20261023 AS SELECT el.*, now() AS
--      respaldado_en FROM executive_lines; si la tabla ya existe pero está vacía, se llena. Nunca se pisa un respaldo
--      con filas (así la migración es re-ejecutable sin perder el respaldo original). RLS sin políticas y REVOKE a
--      anon/authenticated también en el respaldo.
--   3. Identifica, SIN NOMBRES DE PERSONA EN ESTE SQL (solo por zona base, estado y líneas del respaldo):
--        - la persona ACTIVE con zona base en la Zona cuyo area_id = '08001' (Barranquilla) que llevaba perossal en el
--          respaldo → se le permiten perossal y reemplazo;
--        - la vacante (status PLACEHOLDER) con zona base en esa misma Zona → deportiva, columna y trauma.
--      Si no encuentra EXACTAMENTE una fila en cada caso, RAISE EXCEPTION y no se aplica nada.
--   4. DELETE FROM executive_lines (todas las filas; NOTICE con la cifra).
--   5. INSERT en executive_allowed_lines (ON CONFLICT DO NOTHING; created_by NULL = lo puso la migración).
--   6. Comprobación final: executive_lines vacía, respaldo con filas, 2 + 3 restricciones.
--
-- Consecuencias que el dueño aceptó (spec, "Borrado inicial"):
--   - Hasta que cada líder asigne su línea desde Zonas, todas las celdas de coverage quedan "Sin cobertura" tras el
--     recálculo; los Ejecutivos Comerciales no ven líneas en el mapa ni en la app de visita.
--   - El disparador executive_lines_termina_visitantes (0820, AFTER DELETE ON executive_lines) termina los visitantes
--     abiertos de cada (persona, línea) borrada con hasta = greatest(desde, hoy en Bogotá − 1) y fin_motivo
--     'linea_quitada'. Hoy son los visitantes de los 10 médicos de prueba. El rollback 9947 NO los reabre.
--   - La tabla coverage queda desactualizada hasta el recálculo (de ahí el paso obligatorio que sigue).
--
-- Re-ejecutable: sí (el respaldo no se pisa; DELETE sobre una tabla vacía no hace nada; INSERT con ON CONFLICT).
-- Rollback: 2026-10-23_9947_borrar_lineas_para_redistribuir_rollback.sql (quita las dos restricciones y restaura
--   executive_lines desde el respaldo; no borra el respaldo). Después del rollback, recalcular la cobertura.
-- No cambia el esquema de PostgREST salvo la tabla de respaldo (que la API no usa): no hace falta NOTIFY.
-- =====================================================================================

BEGIN;

-- -------------------------------------------------------------------------------------
-- 1. Precondiciones
-- -------------------------------------------------------------------------------------

DO $$
DECLARE
  v_codigos int;
  v_zonas   int;
BEGIN
  IF to_regclass('public.executive_allowed_lines') IS NULL THEN
    RAISE EXCEPTION '0870 Redistribuir: falta public.executive_allowed_lines (aplicar primero la 0860)';
  END IF;
  IF to_regclass('public.executive_lines') IS NULL OR to_regclass('public.executives') IS NULL
     OR to_regclass('public.kams') IS NULL OR to_regclass('public.business_lines') IS NULL THEN
    RAISE EXCEPTION '0870 Redistribuir: faltan tablas de la Fase 1 (executive_lines, executives, kams, business_lines)';
  END IF;
  SELECT count(*) INTO v_codigos FROM public.business_lines
  WHERE code IN ('perossal', 'reemplazo', 'deportiva', 'columna', 'trauma');
  IF v_codigos <> 5 THEN
    RAISE EXCEPTION '0870 Redistribuir: business_lines tiene % de los 5 códigos esperados (perossal, reemplazo, deportiva, columna, trauma)', v_codigos;
  END IF;
  SELECT count(*) INTO v_zonas FROM public.kams WHERE area_id = '08001';
  IF v_zonas = 0 THEN
    RAISE EXCEPTION '0870 Redistribuir: no hay ninguna Zona con area_id 08001 (Barranquilla) en kams';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE NOT tgisinternal AND tgname = 'executive_lines_termina_visitantes') THEN
    -- Sin el disparador de la 0820 los visitantes de las líneas borradas quedarían abiertos sin nadie que los lleve.
    RAISE EXCEPTION '0870 Redistribuir: falta el disparador executive_lines_termina_visitantes (migración 0820)';
  END IF;
END;
$$;

-- -------------------------------------------------------------------------------------
-- 2. Respaldo de executive_lines (nunca se pisa un respaldo con filas)
-- -------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.executive_lines_respaldo_20261023 AS
  SELECT el.*, now() AS respaldado_en FROM public.executive_lines el;

-- Si la tabla ya existía vacía (p. ej. se creó cuando executive_lines estaba vacía), se llena ahora.
INSERT INTO public.executive_lines_respaldo_20261023 (executive_id, line_id, respaldado_en)
SELECT el.executive_id, el.line_id, now()
FROM public.executive_lines el
WHERE NOT EXISTS (SELECT 1 FROM public.executive_lines_respaldo_20261023);

ALTER TABLE public.executive_lines_respaldo_20261023 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.executive_lines_respaldo_20261023 FROM anon, authenticated;
GRANT SELECT ON TABLE public.executive_lines_respaldo_20261023 TO service_role;

COMMENT ON TABLE public.executive_lines_respaldo_20261023 IS
  'Respaldo de executive_lines tomado por la migración 0870 (2026-10-23) antes de borrar todas las líneas asignadas '
  'para redistribuirlas desde Zonas. Lo usa el rollback 9947 para restaurar. La app no lo lee. Conservar.';

DO $$
DECLARE
  v_respaldo bigint;
  v_actuales bigint;
BEGIN
  SELECT count(*) INTO v_respaldo FROM public.executive_lines_respaldo_20261023;
  SELECT count(*) INTO v_actuales FROM public.executive_lines;
  IF v_respaldo = 0 THEN
    RAISE EXCEPTION '0870 Redistribuir: el respaldo quedó vacío (executive_lines no tiene filas); no hay nada que redistribuir';
  END IF;
  RAISE NOTICE '0870 Redistribuir: respaldo executive_lines_respaldo_20261023 con % fila(s); executive_lines tiene hoy % fila(s)', v_respaldo, v_actuales;
END;
$$;

-- -------------------------------------------------------------------------------------
-- 3. La persona y la vacante de Barranquilla (por zona, estado y respaldo; sin nombres), 4. borrado, 5. restricciones
-- -------------------------------------------------------------------------------------

DO $$
DECLARE
  v_persona  uuid;
  v_vacante  uuid;
  v_n        int;
  v_borradas bigint;
  v_insert   int;
BEGIN
  -- Persona ACTIVE con base en la Zona 08001 que llevaba perossal según el respaldo: exactamente una.
  -- (array_agg(...))[1] y no min(): PostgreSQL no tiene min() para uuid. Con count = 1 es el único id.
  SELECT count(*), (array_agg(e.id))[1] INTO v_n, v_persona
  FROM public.executives e
  JOIN public.kams k ON k.id = e.base_kam_id
  WHERE k.area_id = '08001'
    AND e.status = 'active'
    AND EXISTS (
      SELECT 1 FROM public.executive_lines_respaldo_20261023 r
      JOIN public.business_lines bl ON bl.id = r.line_id
      WHERE r.executive_id = e.id AND bl.code = 'perossal');
  IF v_n <> 1 THEN
    RAISE EXCEPTION '0870 Redistribuir: se esperaba exactamente UNA persona activa con base en la Zona 08001 y perossal en el respaldo; hay %', v_n;
  END IF;

  -- Vacante (PLACEHOLDER) con base en la Zona 08001: exactamente una.
  SELECT count(*), (array_agg(e.id))[1] INTO v_n, v_vacante
  FROM public.executives e
  JOIN public.kams k ON k.id = e.base_kam_id
  WHERE k.area_id = '08001' AND e.status = 'placeholder';
  IF v_n <> 1 THEN
    RAISE EXCEPTION '0870 Redistribuir: se esperaba exactamente UNA vacante (placeholder) con base en la Zona 08001; hay %', v_n;
  END IF;

  -- 4. Borrado de todas las líneas asignadas (el disparador de la 0820 termina los visitantes de cada línea borrada).
  DELETE FROM public.executive_lines;
  GET DIAGNOSTICS v_borradas = ROW_COUNT;
  RAISE NOTICE '0870 Redistribuir: borradas % fila(s) de executive_lines (0 si se re-ejecuta)', v_borradas;

  -- 5. Restricciones iniciales (created_by NULL: las puso la migración, no un usuario de la app).
  INSERT INTO public.executive_allowed_lines (executive_id, line_id, created_by)
  SELECT v_persona, bl.id, NULL FROM public.business_lines bl WHERE bl.code IN ('perossal', 'reemplazo')
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_insert = ROW_COUNT;
  RAISE NOTICE '0870 Redistribuir: persona de Barranquilla → perossal y reemplazo (% fila(s) nueva(s))', v_insert;

  INSERT INTO public.executive_allowed_lines (executive_id, line_id, created_by)
  SELECT v_vacante, bl.id, NULL FROM public.business_lines bl WHERE bl.code IN ('deportiva', 'columna', 'trauma')
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_insert = ROW_COUNT;
  RAISE NOTICE '0870 Redistribuir: vacante de Barranquilla → deportiva, columna y trauma (% fila(s) nueva(s))', v_insert;
END;
$$;

-- -------------------------------------------------------------------------------------
-- 6. Comprobación final: si algo no cuadra, se deshace todo
-- -------------------------------------------------------------------------------------

DO $$
DECLARE
  v_n bigint;
BEGIN
  SELECT count(*) INTO v_n FROM public.executive_lines;
  IF v_n <> 0 THEN
    RAISE EXCEPTION '0870 Redistribuir: executive_lines debía quedar vacía y tiene % fila(s)', v_n;
  END IF;

  SELECT count(*) INTO v_n
  FROM public.executive_allowed_lines a
  JOIN public.executives e ON e.id = a.executive_id
  JOIN public.kams k ON k.id = e.base_kam_id
  JOIN public.business_lines bl ON bl.id = a.line_id
  WHERE k.area_id = '08001' AND e.status = 'active' AND bl.code IN ('perossal', 'reemplazo');
  IF v_n <> 2 THEN
    RAISE EXCEPTION '0870 Redistribuir: la persona de Barranquilla debía quedar con 2 líneas permitidas y tiene %', v_n;
  END IF;

  SELECT count(*) INTO v_n
  FROM public.executive_allowed_lines a
  JOIN public.executives e ON e.id = a.executive_id
  JOIN public.kams k ON k.id = e.base_kam_id
  JOIN public.business_lines bl ON bl.id = a.line_id
  WHERE k.area_id = '08001' AND e.status = 'placeholder' AND bl.code IN ('deportiva', 'columna', 'trauma');
  IF v_n <> 3 THEN
    RAISE EXCEPTION '0870 Redistribuir: la vacante de Barranquilla debía quedar con 3 líneas permitidas y tiene %', v_n;
  END IF;

  SELECT count(*) INTO v_n FROM public.executive_lines_respaldo_20261023;
  RAISE NOTICE '0870 Redistribuir OK: executive_lines vacía, respaldo con % fila(s), 5 restricciones en executive_allowed_lines. SIGUIENTE PASO OBLIGATORIO: recalcular la cobertura (npm run fase2:recalculate o "Recalcular cobertura" en /lines).', v_n;
END;
$$;

COMMIT;
