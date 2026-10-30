-- =====================================================================================
-- OpMap · feat/medicos-contactos · 0940 — Médicos y contactos sin duplicados
-- Proyecto: norvxqgohddgsdkggqzq · Generado: 2026-10-30 · ESTADO: NO APLICADA (se aplica solo con autorización del dueño)
-- Spec: docs/specs/2026-10-30-medicos-y-contactos-sin-duplicados.md · Rollback: 2026-10-30_9959_medicos_contactos_rollback.sql
--
-- Qué hace:
--   1. medico_lineas (medico_id, line_id, user_id, desde): el médico que crea una líder queda de sus líneas de líder
--      desde ese día (C9), para agendarlo y reportarlo enseguida; la dirección le asigna el visitante después.
--   2. medico_de_lineas (MISMA firma): además de los visitantes, mira medico_lineas. Espejo: medicoDeLineas.
--   3. contactos: telefono_digitos (generada: los dígitos, sin el +57 de Colombia; espejo de digitosTelefono), índices
--      únicos por cuenta del teléfono y del correo (sin mayúsculas) y un CHECK "teléfono o correo" NOT VALID (rige para
--      lo nuevo y lo que se corrija; los 2 contactos de prueba sin ninguno quedan como están).
--   4. Limpieza de lo de prueba (dueño, 2026-10-29: "el tema de médicos, bórralos"): los médicos con documento 'otro'
--      (10 el 2026-10-30) y lo que los usa —sus sedes y visitantes (cascada), 23 citas canceladas y 4 visitas anuladas
--      de la app— se copian a tablas *_respaldo_20261030 y se borran. Se detiene si algo AJENO los referencia.
--   5. Bloque DO de pruebas que se deshace (SQLSTATE 'P0940').
-- Transaccional: todo o nada. Re-ejecutable: sí (IF NOT EXISTS / CREATE OR REPLACE; la limpieza no encuentra nada la
--   segunda vez). Costo Google: 0. No recalcula asignaciones. Después: NOTIFY pgrst, 'reload schema';
-- =====================================================================================

BEGIN;

-- -------------------------------------------------------------------------------------
-- 0. Precondiciones
-- -------------------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regprocedure('public.medico_de_lineas(uuid, uuid[], date)') IS NULL THEN
    RAISE EXCEPTION '0940: falta la 0850 (medico_de_lineas)';
  END IF;
  IF to_regclass('public.contactos') IS NULL OR to_regclass('public.medicos') IS NULL THEN
    RAISE EXCEPTION '0940: faltan las tablas de terceros (0800)';
  END IF;
END
$$;

-- -------------------------------------------------------------------------------------
-- 1. medico_lineas: el médico que crea una líder es de sus líneas de líder
-- -------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.medico_lineas (
  medico_id  uuid        NOT NULL REFERENCES public.medicos(id) ON DELETE CASCADE,
  line_id    uuid        NOT NULL REFERENCES public.business_lines(id) ON DELETE CASCADE,
  user_id    uuid        NULL     REFERENCES public.users(id) ON DELETE SET NULL,
  desde      date        NOT NULL DEFAULT (now() AT TIME ZONE 'America/Bogota')::date,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (medico_id, line_id)
);
COMMENT ON TABLE public.medico_lineas IS
  'Médico de una línea porque lo creó su líder (dueño, 2026-10-30): cuenta para medico_de_lineas desde "desde", aunque aún no tenga visitante.';
CREATE INDEX IF NOT EXISTS medico_lineas_line_idx ON public.medico_lineas (line_id);
ALTER TABLE public.medico_lineas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.medico_lineas FROM PUBLIC;
REVOKE ALL ON public.medico_lineas FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.medico_lineas TO service_role;

-- C9: "médico de las líneas L" = con un visitante vigente en esa fecha en alguna línea de L, o cuyo visitante vigente
-- es un Ejecutivo Comercial activo con alguna línea de L, o (0940) creado por la líder de una línea de L desde su
-- fecha. Espejo: medicoDeLineas (web/lib/persona-campo.ts).
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
  OR EXISTS (
    SELECT 1
    FROM public.medico_lineas ml
    WHERE ml.medico_id = p_medico
      AND ml.desde <= p_fecha
      AND ml.line_id = ANY (coalesce(p_lineas, '{}'::uuid[])))
$$;

-- -------------------------------------------------------------------------------------
-- 2. contactos: teléfono o correo, y sin repetir en la cuenta
-- -------------------------------------------------------------------------------------
-- Los dígitos del teléfono, sin el +57 de Colombia (espejo de digitosTelefono de web/lib/terceros.ts)
ALTER TABLE public.contactos
  ADD COLUMN IF NOT EXISTS telefono_digitos text GENERATED ALWAYS AS (
    CASE
      WHEN regexp_replace(coalesce(telefono, ''), '\D', '', 'g') = '' THEN NULL
      WHEN length(regexp_replace(telefono, '\D', '', 'g')) = 12 AND regexp_replace(telefono, '\D', '', 'g') LIKE '57%'
        THEN substr(regexp_replace(telefono, '\D', '', 'g'), 3)
      ELSE regexp_replace(telefono, '\D', '', 'g')
    END
  ) STORED;

DO $$
BEGIN
  -- Antes de los índices: que no haya repetidos ya (el 2026-10-30 hay 2 contactos, sin teléfono ni correo)
  IF EXISTS (SELECT 1 FROM public.contactos WHERE telefono_digitos IS NOT NULL
             GROUP BY cuenta_id, telefono_digitos HAVING count(*) > 1) THEN
    RAISE EXCEPTION '0940: hay contactos repetidos por teléfono en una misma cuenta; resolverlos antes';
  END IF;
  IF EXISTS (SELECT 1 FROM public.contactos WHERE email IS NOT NULL AND btrim(email) <> ''
             GROUP BY cuenta_id, lower(btrim(email)) HAVING count(*) > 1) THEN
    RAISE EXCEPTION '0940: hay contactos repetidos por correo en una misma cuenta; resolverlos antes';
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS contactos_cuenta_telefono_uidx
  ON public.contactos (cuenta_id, telefono_digitos) WHERE telefono_digitos IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS contactos_cuenta_email_uidx
  ON public.contactos (cuenta_id, lower(btrim(email))) WHERE email IS NOT NULL AND btrim(email) <> '';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contactos_telefono_o_correo'
                 AND conrelid = 'public.contactos'::regclass) THEN
    ALTER TABLE public.contactos ADD CONSTRAINT contactos_telefono_o_correo
      CHECK (nullif(btrim(coalesce(telefono, '')), '') IS NOT NULL OR nullif(btrim(coalesce(email, '')), '') IS NOT NULL)
      NOT VALID;
  END IF;
END
$$;

-- -------------------------------------------------------------------------------------
-- 3. Limpieza de lo de prueba, con respaldo
-- -------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.medicos_respaldo_20261030 AS SELECT * FROM public.medicos WHERE false;
CREATE TABLE IF NOT EXISTS public.medico_sedes_respaldo_20261030 AS SELECT * FROM public.medico_sedes WHERE false;
CREATE TABLE IF NOT EXISTS public.medico_visitantes_respaldo_20261030 AS SELECT * FROM public.medico_visitantes WHERE false;
CREATE TABLE IF NOT EXISTS public.visitas_agenda_respaldo_20261030 AS SELECT * FROM public.visitas_agenda WHERE false;
CREATE TABLE IF NOT EXISTS public.visits_respaldo_20261030 AS SELECT * FROM public.visits WHERE false;
CREATE TABLE IF NOT EXISTS public.visit_lines_respaldo_20261030 AS SELECT * FROM public.visit_lines WHERE false;
ALTER TABLE public.medicos_respaldo_20261030 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medico_sedes_respaldo_20261030 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medico_visitantes_respaldo_20261030 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visitas_agenda_respaldo_20261030 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visits_respaldo_20261030 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visit_lines_respaldo_20261030 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.medicos_respaldo_20261030, public.medico_sedes_respaldo_20261030,
  public.medico_visitantes_respaldo_20261030, public.visitas_agenda_respaldo_20261030,
  public.visits_respaldo_20261030, public.visit_lines_respaldo_20261030 FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  v_medicos bigint;
  v_citas   bigint;
  v_visitas bigint;
BEGIN
  CREATE TEMP TABLE _m ON COMMIT DROP AS SELECT id FROM public.medicos WHERE tipo_documento = 'otro';
  CREATE TEMP TABLE _v ON COMMIT DROP AS SELECT id FROM public.visits WHERE medico_id IN (SELECT id FROM _m);
  CREATE TEMP TABLE _c ON COMMIT DROP AS SELECT id FROM public.visitas_agenda WHERE medico_id IN (SELECT id FROM _m);

  -- Nada ajeno puede quedar apuntando a lo que se borra
  IF EXISTS (SELECT 1 FROM public.visitas_agenda WHERE visita_id IN (SELECT id FROM _v) AND id NOT IN (SELECT id FROM _c))
     OR EXISTS (SELECT 1 FROM public.visits WHERE agenda_id IN (SELECT id FROM _c) AND id NOT IN (SELECT id FROM _v))
     OR EXISTS (SELECT 1 FROM public.visitas_agenda WHERE viene_de IN (SELECT id FROM _c) AND id NOT IN (SELECT id FROM _c)) THEN
    RAISE EXCEPTION '0940: algo que no es de prueba apunta a las citas o visitas de los médicos de prueba; no se borra nada';
  END IF;

  SELECT count(*) INTO v_medicos FROM _m;
  SELECT count(*) INTO v_citas FROM _c;
  SELECT count(*) INTO v_visitas FROM _v;

  INSERT INTO public.medicos_respaldo_20261030 SELECT * FROM public.medicos WHERE id IN (SELECT id FROM _m);
  INSERT INTO public.medico_sedes_respaldo_20261030 SELECT * FROM public.medico_sedes WHERE medico_id IN (SELECT id FROM _m);
  INSERT INTO public.medico_visitantes_respaldo_20261030 SELECT * FROM public.medico_visitantes WHERE medico_id IN (SELECT id FROM _m);
  INSERT INTO public.visitas_agenda_respaldo_20261030 SELECT * FROM public.visitas_agenda WHERE id IN (SELECT id FROM _c);
  INSERT INTO public.visits_respaldo_20261030 SELECT * FROM public.visits WHERE id IN (SELECT id FROM _v);
  INSERT INTO public.visit_lines_respaldo_20261030 SELECT * FROM public.visit_lines WHERE visit_id IN (SELECT id FROM _v);

  -- Primero las visitas (sus líneas van en cascada), luego las citas y al final los médicos (sedes y visitantes en cascada)
  UPDATE public.visitas_agenda SET viene_de = NULL WHERE id IN (SELECT id FROM _c) AND viene_de IS NOT NULL;
  DELETE FROM public.visits WHERE id IN (SELECT id FROM _v);
  DELETE FROM public.visitas_agenda WHERE id IN (SELECT id FROM _c);
  DELETE FROM public.medicos WHERE id IN (SELECT id FROM _m);

  RAISE NOTICE '0940: borrados (con respaldo) % médico(s) de prueba, % cita(s) y % visita(s) de la app', v_medicos, v_citas, v_visitas;
END
$$;

-- -------------------------------------------------------------------------------------
-- 4. Pruebas que se deshacen (SQLSTATE 'P0940')
-- -------------------------------------------------------------------------------------
DO $$
DECLARE
  v_linea  uuid;
  v_otra   uuid;
  v_medico uuid;
  v_cuenta uuid;
  v_hoy    date := (now() AT TIME ZONE 'America/Bogota')::date;
BEGIN
  BEGIN
    SELECT id INTO v_linea FROM public.business_lines ORDER BY id LIMIT 1;
    SELECT id INTO v_otra FROM public.business_lines WHERE id <> v_linea ORDER BY id LIMIT 1;
    INSERT INTO public.medicos (tipo_documento, numero_documento, nombre, especialidades, municipality_id)
      VALUES ('CC', '9409400940', 'Prueba 0940', ARRAY['ortopedia'], '11001') RETURNING id INTO v_medico;
    IF public.medico_de_lineas(v_medico, ARRAY[v_linea], v_hoy) THEN
      RAISE EXCEPTION '0940 prueba: un médico sin visitante ni medico_lineas no debe ser de la línea';
    END IF;
    INSERT INTO public.medico_lineas (medico_id, line_id, desde) VALUES (v_medico, v_linea, v_hoy);
    IF NOT public.medico_de_lineas(v_medico, ARRAY[v_linea], v_hoy) THEN
      RAISE EXCEPTION '0940 prueba: el médico creado por la líder debe ser de su línea';
    END IF;
    IF v_otra IS NOT NULL AND public.medico_de_lineas(v_medico, ARRAY[v_otra], v_hoy) THEN
      RAISE EXCEPTION '0940 prueba: no debe ser de otra línea';
    END IF;
    IF public.medico_de_lineas(v_medico, ARRAY[v_linea], v_hoy - 1) THEN
      RAISE EXCEPTION '0940 prueba: antes de "desde" no es de la línea';
    END IF;

    SELECT id INTO v_cuenta FROM public.cuentas ORDER BY id LIMIT 1;
    INSERT INTO public.contactos (cuenta_id, nombre, telefono) VALUES (v_cuenta, 'Prueba 0940 A', '+57 300 940 0940');
    IF (SELECT telefono_digitos FROM public.contactos WHERE cuenta_id = v_cuenta AND nombre = 'Prueba 0940 A') <> '3009400940' THEN
      RAISE EXCEPTION '0940 prueba: telefono_digitos debe quitar el +57 y lo que no es dígito';
    END IF;
    BEGIN
      INSERT INTO public.contactos (cuenta_id, nombre, telefono) VALUES (v_cuenta, 'Prueba 0940 B', '300-940-0940');
      RAISE EXCEPTION '0940 prueba: el mismo teléfono en la misma cuenta debió rechazarse';
    EXCEPTION WHEN unique_violation THEN NULL;
    END;
    BEGIN
      INSERT INTO public.contactos (cuenta_id, nombre) VALUES (v_cuenta, 'Prueba 0940 C');
      RAISE EXCEPTION '0940 prueba: un contacto sin teléfono ni correo debió rechazarse';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    RAISE SQLSTATE 'P0940';
  EXCEPTION
    WHEN SQLSTATE 'P0940' THEN NULL;
  END;
END
$$;

COMMIT;
