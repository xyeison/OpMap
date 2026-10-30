-- =====================================================================================
-- OpMap · feat/medicos-contactos · 0950 — Médicos y contactos sin duplicados
-- Proyecto: norvxqgohddgsdkggqzq · Generado: 2026-10-30 · ESTADO: NO APLICADA (se aplica solo con autorización del dueño)
-- Spec: docs/specs/2026-10-30-medicos-y-contactos-sin-duplicados.md · Rollback: 2026-10-30_9960_medicos_contactos_rollback.sql
--
-- Qué hace:
--   1. medico_lineas (medico_id, line_id, user_id, desde): el médico que crea una líder queda de sus líneas de líder
--      desde ese día (C9), para agendarlo y reportarlo enseguida; la dirección le asigna el visitante después.
--   2. medico_de_lineas (MISMA firma): además de los visitantes, mira medico_lineas. Espejo: medicoDeLineas.
--   3. contactos: telefono_digitos (generada: los dígitos, sin el +57 de Colombia; espejo de digitosTelefono). Entre los
--      contactos ACTIVOS de una cuenta no se repiten el teléfono ni el correo (índices únicos parciales) y uno activo lleva
--      teléfono o correo (CHECK). Los dados de baja son historia: no cuentan (así el teléfono de uno dado de baja se puede
--      usar en uno nuevo; revisión 2026-10-30). Los 2 contactos de prueba sin ninguno de los dos están inactivos.
--   4. Limpieza de lo de prueba (dueño, 2026-10-29: "el tema de médicos, bórralos"): los 10 médicos de prueba (por su id:
--      documento 'otro', del 2026-10-15, inactivos) y lo que los usa —sus 11 sedes y 20 visitantes (cascada), 23 citas
--      canceladas y 4 visitas anuladas de la app con sus 6 líneas— se copian a tablas *_respaldo_20261030 y se borran.
--      Las visitas de la app y las citas nunca se borran (visitas_sin_borrar): solo aquí, con esos disparadores apagados
--      dentro de esta transacción. Se detiene si algo no cuadra (otro número de médicos, una visita viva, una cita no
--      cancelada, algo ajeno que los referencie).
--   5. El comentario de medico_de_lineas dice lo de medico_lineas.
--   6. Bloque DO de pruebas que se deshace (SQLSTATE 'P0950'), con filas: también la limpieza (una cita de prueba).
-- Transaccional: todo o nada. Re-ejecutable: sí (IF NOT EXISTS / CREATE OR REPLACE; la limpieza no encuentra nada la
--   segunda vez y el respaldo no se duplica). Costo Google: 0. No recalcula asignaciones. Después: NOTIFY pgrst, 'reload schema';
-- =====================================================================================

BEGIN;

-- -------------------------------------------------------------------------------------
-- 0. Precondiciones
-- -------------------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regprocedure('public.medico_de_lineas(uuid, uuid[], date)') IS NULL THEN
    RAISE EXCEPTION '0950: falta la 0850 (medico_de_lineas)';
  END IF;
  IF to_regclass('public.contactos') IS NULL OR to_regclass('public.medicos') IS NULL THEN
    RAISE EXCEPTION '0950: faltan las tablas de terceros (0800)';
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
-- es un Ejecutivo Comercial activo con alguna línea de L, o (0950) creado por la líder de una línea de L desde su
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
  -- Antes de los índices: que no haya repetidos ya entre los activos (el 2026-10-30 no hay)
  IF EXISTS (SELECT 1 FROM public.contactos WHERE activo AND telefono_digitos IS NOT NULL
             GROUP BY cuenta_id, telefono_digitos HAVING count(*) > 1) THEN
    RAISE EXCEPTION '0950: hay contactos activos repetidos por teléfono en una misma cuenta; resolverlos antes';
  END IF;
  IF EXISTS (SELECT 1 FROM public.contactos WHERE activo AND email IS NOT NULL AND btrim(email) <> ''
             GROUP BY cuenta_id, lower(btrim(email)) HAVING count(*) > 1) THEN
    RAISE EXCEPTION '0950: hay contactos activos repetidos por correo en una misma cuenta; resolverlos antes';
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS contactos_cuenta_telefono_uidx
  ON public.contactos (cuenta_id, telefono_digitos) WHERE activo AND telefono_digitos IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS contactos_cuenta_email_uidx
  ON public.contactos (cuenta_id, lower(btrim(email))) WHERE activo AND email IS NOT NULL AND btrim(email) <> '';

-- Uno activo lleva teléfono o correo. NOT VALID y luego VALIDATE: si mientras tanto alguien creó uno activo sin ninguno
-- de los dos, la restricción igual rige para lo nuevo y lo que se corrija, y se avisa en vez de abortar.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contactos_telefono_o_correo'
                 AND conrelid = 'public.contactos'::regclass) THEN
    ALTER TABLE public.contactos ADD CONSTRAINT contactos_telefono_o_correo
      CHECK (activo IS NOT TRUE OR nullif(btrim(coalesce(telefono, '')), '') IS NOT NULL OR nullif(btrim(coalesce(email, '')), '') IS NOT NULL)
      NOT VALID;
  END IF;
  BEGIN
    ALTER TABLE public.contactos VALIDATE CONSTRAINT contactos_telefono_o_correo;
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE '0950: hay contactos activos sin teléfono ni correo; contactos_telefono_o_correo queda NOT VALID (rige para lo nuevo)';
  END;
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

-- Borra con respaldo unos médicos y lo que los usa: sus visitas de la app (sus líneas van en cascada), sus citas y, en
-- cascada, sus sedes, visitantes y medico_lineas. Las visitas de la app y las citas nunca se borran (visitas_sin_borrar,
-- 0830 y 0840): solo aquí, con esos dos disparadores apagados dentro de esta transacción. Visitas y citas se borran en
-- UNA sentencia (se apuntan entre sí: visits.agenda_id y visitas_agenda.visita_id). Devuelve {médicos, citas, visitas}.
-- Vive solo en esta sesión (pg_temp): la usan la limpieza y su prueba.
CREATE OR REPLACE FUNCTION pg_temp.borrar_medicos_con_respaldo(p_medicos uuid[])
RETURNS integer[]
LANGUAGE plpgsql
AS $$
DECLARE
  v_medicos integer;
  v_citas   integer;
  v_visitas integer;
BEGIN
  -- Nada ajeno puede quedar apuntando a lo que se borra
  IF EXISTS (SELECT 1 FROM public.visitas_agenda a
             WHERE a.visita_id IN (SELECT v.id FROM public.visits v WHERE v.medico_id = ANY (p_medicos))
               AND (a.medico_id IS NULL OR NOT (a.medico_id = ANY (p_medicos))))
     OR EXISTS (SELECT 1 FROM public.visits v
                WHERE v.agenda_id IN (SELECT a.id FROM public.visitas_agenda a WHERE a.medico_id = ANY (p_medicos))
                  AND (v.medico_id IS NULL OR NOT (v.medico_id = ANY (p_medicos))))
     OR EXISTS (SELECT 1 FROM public.visitas_agenda a
                WHERE a.viene_de IN (SELECT b.id FROM public.visitas_agenda b WHERE b.medico_id = ANY (p_medicos))
                  AND (a.medico_id IS NULL OR NOT (a.medico_id = ANY (p_medicos)))) THEN
    RAISE EXCEPTION '0950: algo ajeno apunta a las citas o visitas de esos médicos; no se borra nada';
  END IF;

  -- Respaldo, sin repetir (migrar, deshacer y volver a migrar no duplica filas)
  INSERT INTO public.medicos_respaldo_20261030 SELECT m.* FROM public.medicos m
    WHERE m.id = ANY (p_medicos) AND NOT EXISTS (SELECT 1 FROM public.medicos_respaldo_20261030 r WHERE r.id = m.id);
  INSERT INTO public.medico_sedes_respaldo_20261030 SELECT s.* FROM public.medico_sedes s
    WHERE s.medico_id = ANY (p_medicos)
      AND NOT EXISTS (SELECT 1 FROM public.medico_sedes_respaldo_20261030 r WHERE r.medico_id = s.medico_id AND r.sede_id = s.sede_id);
  INSERT INTO public.medico_visitantes_respaldo_20261030 SELECT x.* FROM public.medico_visitantes x
    WHERE x.medico_id = ANY (p_medicos) AND NOT EXISTS (SELECT 1 FROM public.medico_visitantes_respaldo_20261030 r WHERE r.id = x.id);
  INSERT INTO public.visitas_agenda_respaldo_20261030 SELECT a.* FROM public.visitas_agenda a
    WHERE a.medico_id = ANY (p_medicos) AND NOT EXISTS (SELECT 1 FROM public.visitas_agenda_respaldo_20261030 r WHERE r.id = a.id);
  INSERT INTO public.visits_respaldo_20261030 SELECT v.* FROM public.visits v
    WHERE v.medico_id = ANY (p_medicos) AND NOT EXISTS (SELECT 1 FROM public.visits_respaldo_20261030 r WHERE r.id = v.id);
  INSERT INTO public.visit_lines_respaldo_20261030 SELECT l.* FROM public.visit_lines l
    WHERE l.visit_id IN (SELECT v.id FROM public.visits v WHERE v.medico_id = ANY (p_medicos))
      AND NOT EXISTS (SELECT 1 FROM public.visit_lines_respaldo_20261030 r WHERE r.visit_id = l.visit_id AND r.line_id = l.line_id);

  ALTER TABLE public.visits DISABLE TRIGGER visits_app_sin_borrar;
  ALTER TABLE public.visitas_agenda DISABLE TRIGGER visitas_agenda_sin_borrar;
  WITH v AS (DELETE FROM public.visits WHERE medico_id = ANY (p_medicos) RETURNING 1),
       c AS (DELETE FROM public.visitas_agenda WHERE medico_id = ANY (p_medicos) RETURNING 1)
  SELECT (SELECT count(*) FROM v), (SELECT count(*) FROM c) INTO v_visitas, v_citas;
  ALTER TABLE public.visits ENABLE TRIGGER visits_app_sin_borrar;
  ALTER TABLE public.visitas_agenda ENABLE TRIGGER visitas_agenda_sin_borrar;

  DELETE FROM public.medicos WHERE id = ANY (p_medicos);
  GET DIAGNOSTICS v_medicos = ROW_COUNT;
  RETURN ARRAY[v_medicos, v_citas, v_visitas];
END
$$;

DO $$
DECLARE
  -- Los 10 médicos de prueba (consultados el 2026-10-30): documento 'otro', creados el 2026-10-15, inactivos
  v_ids uuid[] := ARRAY[
    '8f7e35ec-b548-4ae3-9342-a441d5d2c9ad', '9bc7b2ff-93ae-4cb5-9016-7ffa5bd6aa69', '852348f6-5209-4ce3-b2a6-59dbf749543c',
    '983f2fa6-1160-4bcc-8544-1014de77260d', 'c0dd608e-a934-428f-bf93-83cbd28b5a53', 'b4faf9e6-465d-4f00-a91e-768e809e1515',
    '4aa56505-1eb0-471c-9bcb-278feaf2a5dc', 'b2cf3d81-e418-46b1-9680-6a29f55dab76', '74919099-6ed8-4525-b228-1bedc43cde59',
    '6562f2c0-e721-4ea1-93c8-5077a858805d'
  ]::uuid[];
  v_hay integer;
  v_r   integer[];
BEGIN
  SELECT count(*) INTO v_hay FROM public.medicos WHERE id = ANY (v_ids);
  IF v_hay = 0 THEN
    RAISE NOTICE '0950: los médicos de prueba ya no están (se limpió antes): nada que borrar';
    RETURN;
  END IF;
  IF v_hay <> cardinality(v_ids) THEN
    RAISE EXCEPTION '0950: están % de los % médicos de prueba; revisar antes de borrar', v_hay, cardinality(v_ids);
  END IF;
  IF EXISTS (SELECT 1 FROM public.medicos WHERE id = ANY (v_ids)
             AND (tipo_documento <> 'otro' OR activo IS TRUE
                  OR created_at < timestamptz '2026-10-13 00:00:00+00' OR created_at >= timestamptz '2026-10-17 00:00:00+00')) THEN
    RAISE EXCEPTION '0950: un médico de la lista no es de prueba (documento, activo o fecha); no se borra nada';
  END IF;
  IF EXISTS (SELECT 1 FROM public.visits WHERE medico_id = ANY (v_ids) AND deleted_at IS NULL) THEN
    RAISE EXCEPTION '0950: una visita de los médicos de prueba no está anulada; no se borra nada';
  END IF;
  IF EXISTS (SELECT 1 FROM public.visitas_agenda WHERE medico_id = ANY (v_ids) AND estado <> 'cancelada') THEN
    RAISE EXCEPTION '0950: una cita de los médicos de prueba no está cancelada; no se borra nada';
  END IF;

  v_r := pg_temp.borrar_medicos_con_respaldo(v_ids);
  RAISE NOTICE '0950: borrados (con respaldo) % médico(s) de prueba, % cita(s) y % visita(s) de la app', v_r[1], v_r[2], v_r[3];
END
$$;

-- -------------------------------------------------------------------------------------
-- 4. El comentario de medico_de_lineas
-- -------------------------------------------------------------------------------------
COMMENT ON FUNCTION public.medico_de_lineas(uuid, uuid[], date) IS
  'C9: el médico tiene un visitante vigente en la fecha en alguna de esas líneas, o su visitante vigente es un Ejecutivo Comercial activo con alguna de ellas, o (0950) lo creó la líder de una de ellas y la fecha es desde su "desde" (medico_lineas).';

-- -------------------------------------------------------------------------------------
-- 5. Pruebas que se deshacen (SQLSTATE 'P0950')
-- -------------------------------------------------------------------------------------
DO $$
DECLARE
  v_linea  uuid;
  v_otra   uuid;
  v_medico uuid;
  v_cuenta uuid;
  v_hoy    date := (now() AT TIME ZONE 'America/Bogota')::date;
  v_prueba uuid;
  v_cita   uuid;
  v_sede   uuid;
  v_user   uuid;
  v_r      integer[];
BEGIN
  BEGIN
    SELECT id INTO v_linea FROM public.business_lines ORDER BY id LIMIT 1;
    SELECT id INTO v_otra FROM public.business_lines WHERE id <> v_linea ORDER BY id LIMIT 1;
    INSERT INTO public.medicos (tipo_documento, numero_documento, nombre, especialidades, municipality_id)
      VALUES ('CC', '9409500950', 'Prueba 0950', ARRAY['ortopedia'], '11001') RETURNING id INTO v_medico;
    IF public.medico_de_lineas(v_medico, ARRAY[v_linea], v_hoy) THEN
      RAISE EXCEPTION '0950 prueba: un médico sin visitante ni medico_lineas no debe ser de la línea';
    END IF;
    INSERT INTO public.medico_lineas (medico_id, line_id, desde) VALUES (v_medico, v_linea, v_hoy);
    IF NOT public.medico_de_lineas(v_medico, ARRAY[v_linea], v_hoy) THEN
      RAISE EXCEPTION '0950 prueba: el médico creado por la líder debe ser de su línea';
    END IF;
    IF v_otra IS NOT NULL AND public.medico_de_lineas(v_medico, ARRAY[v_otra], v_hoy) THEN
      RAISE EXCEPTION '0950 prueba: no debe ser de otra línea';
    END IF;
    IF public.medico_de_lineas(v_medico, ARRAY[v_linea], v_hoy - 1) THEN
      RAISE EXCEPTION '0950 prueba: antes de "desde" no es de la línea';
    END IF;

    SELECT id INTO v_cuenta FROM public.cuentas ORDER BY id LIMIT 1;
    INSERT INTO public.contactos (cuenta_id, nombre, telefono) VALUES (v_cuenta, 'Prueba 0950 A', '+57 300 940 0950');
    IF (SELECT telefono_digitos FROM public.contactos WHERE cuenta_id = v_cuenta AND nombre = 'Prueba 0950 A') <> '3009400950' THEN
      RAISE EXCEPTION '0950 prueba: telefono_digitos debe quitar el +57 y lo que no es dígito';
    END IF;
    BEGIN
      INSERT INTO public.contactos (cuenta_id, nombre, telefono) VALUES (v_cuenta, 'Prueba 0950 B', '300-940-0950');
      RAISE EXCEPTION '0950 prueba: el mismo teléfono en la misma cuenta debió rechazarse';
    EXCEPTION WHEN unique_violation THEN NULL;
    END;
    BEGIN
      INSERT INTO public.contactos (cuenta_id, nombre) VALUES (v_cuenta, 'Prueba 0950 C');
      RAISE EXCEPTION '0950 prueba: un contacto activo sin teléfono ni correo debió rechazarse';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    -- Los dados de baja son historia: el mismo teléfono en uno inactivo, y uno inactivo sin teléfono ni correo, entran
    INSERT INTO public.contactos (cuenta_id, nombre, telefono, activo) VALUES (v_cuenta, 'Prueba 0950 D', '3009400950', false);
    INSERT INTO public.contactos (cuenta_id, nombre, activo) VALUES (v_cuenta, 'Prueba 0950 E', false);

    -- La limpieza con filas: un médico de prueba con una cita cancelada. Borrar la cita a mano no se puede
    -- (visitas_sin_borrar); con borrar_medicos_con_respaldo sí, y queda en el respaldo.
    SELECT id INTO v_sede FROM public.sedes ORDER BY id LIMIT 1;
    SELECT id INTO v_user FROM public.users ORDER BY id LIMIT 1;
    INSERT INTO public.medicos (tipo_documento, numero_documento, nombre, especialidades, municipality_id, activo)
      VALUES ('otro', 'P0950LIMPIEZA', 'Prueba 0950 limpieza', ARRAY['ortopedia'], '11001', false) RETURNING id INTO v_prueba;
    INSERT INTO public.visitas_agenda (fecha, tipo, medico_id, sede_id, estado, cancelada_at, motivo_codigo, user_id)
      VALUES (v_hoy, 'medica', v_prueba, v_sede, 'cancelada', now(), 'cliente', v_user) RETURNING id INTO v_cita;
    BEGIN
      DELETE FROM public.visitas_agenda WHERE id = v_cita;
      RAISE EXCEPTION '0950 prueba: borrar una cita a mano debió rechazarse (visitas_sin_borrar)';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    v_r := pg_temp.borrar_medicos_con_respaldo(ARRAY[v_prueba]);
    IF v_r IS DISTINCT FROM ARRAY[1, 1, 0]
       OR EXISTS (SELECT 1 FROM public.visitas_agenda WHERE id = v_cita)
       OR NOT EXISTS (SELECT 1 FROM public.visitas_agenda_respaldo_20261030 WHERE id = v_cita)
       OR NOT EXISTS (SELECT 1 FROM public.medicos_respaldo_20261030 WHERE id = v_prueba) THEN
      RAISE EXCEPTION '0950 prueba: la limpieza debió borrar el médico y su cita, con respaldo (devolvió %)', v_r;
    END IF;
    BEGIN
      DELETE FROM public.visitas_agenda WHERE id = (SELECT id FROM public.visitas_agenda ORDER BY id LIMIT 1);
      IF FOUND THEN
        RAISE EXCEPTION '0950 prueba: después de la limpieza, borrar una cita a mano debió rechazarse otra vez';
      END IF;
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    RAISE SQLSTATE 'P0950';
  EXCEPTION
    WHEN SQLSTATE 'P0950' THEN NULL;
  END;
END
$$;

COMMIT;
