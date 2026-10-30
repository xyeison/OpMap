-- =====================================================================================
-- OpMap · feat/medicos-contactos · 9959 — Rollback de 0940 (médicos y contactos sin duplicados)
-- Proyecto: norvxqgohddgsdkggqzq · Generado: 2026-10-30
--
-- Qué hace:
--   1. medico_de_lineas vuelve a la versión de la 0850 (solo visitantes).
--   2. Quita medico_lineas. PÉRDIDA: qué médicos creó cada líder para sus líneas (se avisa cuántos); esos médicos
--      siguen, pero sin visitante dejan de ser "de sus líneas".
--   3. Quita el CHECK "teléfono o correo", los índices únicos y la columna telefono_digitos de contactos.
--   4. Devuelve lo de prueba borrado desde las tablas *_respaldo_20261030 (médicos, sus sedes y visitantes, citas,
--      visitas y sus líneas) y deja las tablas de respaldo.
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
  RAISE NOTICE 'Rollback 0940: se quitan % fila(s) de medico_lineas (médicos creados por una líder para sus líneas).', v_filas;
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

-- 2. medico_lineas
DROP TABLE IF EXISTS public.medico_lineas;

-- 3. contactos
ALTER TABLE public.contactos DROP CONSTRAINT IF EXISTS contactos_telefono_o_correo;
DROP INDEX IF EXISTS public.contactos_cuenta_telefono_uidx;
DROP INDEX IF EXISTS public.contactos_cuenta_email_uidx;
ALTER TABLE public.contactos DROP COLUMN IF EXISTS telefono_digitos;

-- 4. Lo de prueba, desde el respaldo (en orden de dependencias)
DO $$
BEGIN
  IF to_regclass('public.medicos_respaldo_20261030') IS NULL THEN
    RAISE NOTICE 'Rollback 0940: no hay respaldo de lo de prueba; nada que devolver.';
    RETURN;
  END IF;
  INSERT INTO public.medicos SELECT * FROM public.medicos_respaldo_20261030 r
    WHERE NOT EXISTS (SELECT 1 FROM public.medicos m WHERE m.id = r.id);
  INSERT INTO public.medico_sedes SELECT * FROM public.medico_sedes_respaldo_20261030 r
    WHERE NOT EXISTS (SELECT 1 FROM public.medico_sedes s WHERE s.medico_id = r.medico_id AND s.sede_id = r.sede_id);
  INSERT INTO public.medico_visitantes SELECT * FROM public.medico_visitantes_respaldo_20261030 r
    WHERE NOT EXISTS (SELECT 1 FROM public.medico_visitantes v WHERE v.id = r.id);
  INSERT INTO public.visitas_agenda SELECT * FROM public.visitas_agenda_respaldo_20261030 r
    WHERE NOT EXISTS (SELECT 1 FROM public.visitas_agenda a WHERE a.id = r.id);
  INSERT INTO public.visits SELECT * FROM public.visits_respaldo_20261030 r
    WHERE NOT EXISTS (SELECT 1 FROM public.visits v WHERE v.id = r.id);
  INSERT INTO public.visit_lines SELECT * FROM public.visit_lines_respaldo_20261030 r
    WHERE NOT EXISTS (SELECT 1 FROM public.visit_lines l WHERE l.visit_id = r.visit_id AND l.line_id = r.line_id);
  RAISE NOTICE 'Rollback 0940: lo de prueba volvió desde las tablas *_respaldo_20261030 (quedan como estaban).';
END
$$;

COMMIT;
