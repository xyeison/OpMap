-- =====================================================================================
-- OpMap · feat/medicos-contactos · 9960 — Rollback de 0950 (médicos y contactos sin duplicados)
-- Proyecto: norvxqgohddgsdkggqzq · Generado: 2026-10-30
--
-- Qué hace:
--   1. medico_de_lineas vuelve a la versión de la 0850 (solo visitantes), con su comentario de entonces.
--   2. Quita medico_lineas. PÉRDIDA: qué médicos creó cada líder para sus líneas (se avisa cuántos); esos médicos
--      siguen, pero sin visitante dejan de ser "de sus líneas".
--   3. Quita el CHECK "teléfono o correo", los índices únicos y la columna telefono_digitos de contactos.
--   4. Devuelve lo de prueba borrado desde las tablas *_respaldo_20261030 (médicos, sus sedes y visitantes, citas,
--      visitas y sus líneas), una vez por llave, con las columnas del respaldo, y deja las tablas de respaldo. Las 23
--      citas canceladas de prueba no tienen motivo (son de antes de la 0850): visitas_agenda_cancelar_con_motivo se apaga
--      solo mientras se devuelven, en esta transacción (y medico_visitantes_fin_motivo, para devolver tal cual).
-- Re-ejecutable: sí (IF EXISTS; lo de prueba solo se devuelve si no está). Después: NOTIFY pgrst, 'reload schema';
-- =====================================================================================

BEGIN;

DO $$
DECLARE
  v_filas bigint := 0;
BEGIN
  IF to_regclass('public.medico_lineas') IS NOT NULL THEN
    SELECT count(*) INTO v_filas FROM public.medico_lineas;
  END IF;
  RAISE NOTICE 'Rollback 0950: se quitan % fila(s) de medico_lineas (médicos creados por una líder para sus líneas).', v_filas;
END
$$;

-- 1. medico_de_lineas como en la 0850
CREATE OR REPLACE FUNCTION public.medico_de_lineas(p_medico uuid, p_lineas uuid[], p_fecha date)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.medico_visitantes mv
    WHERE mv.medico_id = p_medico
      AND mv.desde <= p_fecha AND (mv.hasta IS NULL OR mv.hasta >= p_fecha)
      AND (mv.line_id = ANY (coalesce(p_lineas, '{}'::uuid[]))
           OR EXISTS (SELECT 1
                      FROM public.executives e
                      JOIN public.executive_lines el ON el.executive_id = e.id
                      WHERE e.id = mv.executive_id AND e.status = 'active'
                        AND el.line_id = ANY (coalesce(p_lineas, '{}'::uuid[])))))
$$;
COMMENT ON FUNCTION public.medico_de_lineas(uuid, uuid[], date) IS
  'C9: el médico tiene un visitante vigente en la fecha en alguna de esas líneas, o su visitante vigente es un Ejecutivo Comercial activo con alguna de ellas.';

-- 2. medico_lineas
DROP TABLE IF EXISTS public.medico_lineas;

-- 3. contactos
ALTER TABLE public.contactos DROP CONSTRAINT IF EXISTS contactos_telefono_o_correo;
DROP INDEX IF EXISTS public.contactos_cuenta_telefono_uidx;
DROP INDEX IF EXISTS public.contactos_cuenta_email_uidx;
ALTER TABLE public.contactos DROP COLUMN IF EXISTS telefono_digitos;

-- 4. Lo de prueba, desde el respaldo (en orden de dependencias)
-- Inserta las filas del respaldo que no estén en la tabla (por su llave, una por llave), con las columnas que tienen
-- los dos (si la tabla ganó columnas después de la 0950, esas quedan con su valor por defecto). Vive solo en esta sesión.
CREATE OR REPLACE FUNCTION pg_temp.devolver(p_tabla text, p_respaldo text, p_llave text[])
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_cols text;
  v_sel  text;
  v_on   text;
  v_dist text;
  v_n    integer;
BEGIN
  IF to_regclass('public.' || p_respaldo) IS NULL THEN
    RETURN 0;
  END IF;
  SELECT string_agg(quote_ident(r.column_name), ', ' ORDER BY r.ordinal_position),
         string_agg('r.' || quote_ident(r.column_name), ', ' ORDER BY r.ordinal_position)
    INTO v_cols, v_sel
    FROM information_schema.columns r
    JOIN information_schema.columns t
      ON t.table_schema = 'public' AND t.table_name = p_tabla AND t.column_name = r.column_name AND t.is_generated = 'NEVER'
   WHERE r.table_schema = 'public' AND r.table_name = p_respaldo;
  SELECT string_agg(format('t.%1$I = r.%1$I', k), ' AND '), string_agg(format('r.%I', k), ', ')
    INTO v_on, v_dist
    FROM unnest(p_llave) AS k;
  EXECUTE format('INSERT INTO public.%I (%s) SELECT DISTINCT ON (%s) %s FROM public.%I r WHERE NOT EXISTS (SELECT 1 FROM public.%I t WHERE %s)',
                 p_tabla, v_cols, v_dist, v_sel, p_respaldo, p_tabla, v_on);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END
$$;

DO $$
DECLARE
  v_medicos integer;
  v_citas   integer;
  v_visitas integer;
BEGIN
  IF to_regclass('public.medicos_respaldo_20261030') IS NULL THEN
    RAISE NOTICE 'Rollback 0950: no hay respaldo de lo de prueba; nada que devolver.';
    RETURN;
  END IF;
  ALTER TABLE public.visitas_agenda DISABLE TRIGGER visitas_agenda_cancelar_con_motivo;
  ALTER TABLE public.medico_visitantes DISABLE TRIGGER medico_visitantes_fin_motivo;
  v_medicos := pg_temp.devolver('medicos', 'medicos_respaldo_20261030', ARRAY['id']);
  PERFORM pg_temp.devolver('medico_sedes', 'medico_sedes_respaldo_20261030', ARRAY['medico_id', 'sede_id']);
  PERFORM pg_temp.devolver('medico_visitantes', 'medico_visitantes_respaldo_20261030', ARRAY['id']);
  v_citas := pg_temp.devolver('visitas_agenda', 'visitas_agenda_respaldo_20261030', ARRAY['id']);
  v_visitas := pg_temp.devolver('visits', 'visits_respaldo_20261030', ARRAY['id']);
  PERFORM pg_temp.devolver('visit_lines', 'visit_lines_respaldo_20261030', ARRAY['visit_id', 'line_id']);
  ALTER TABLE public.visitas_agenda ENABLE TRIGGER visitas_agenda_cancelar_con_motivo;
  ALTER TABLE public.medico_visitantes ENABLE TRIGGER medico_visitantes_fin_motivo;
  RAISE NOTICE 'Rollback 0950: volvieron % médico(s), % cita(s) y % visita(s) de prueba desde *_respaldo_20261030 (las tablas de respaldo quedan).', v_medicos, v_citas, v_visitas;
END
$$;

COMMIT;
