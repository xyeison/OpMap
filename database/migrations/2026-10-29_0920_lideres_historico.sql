-- =====================================================================================
-- OpMap · feat/lideres-seguimiento · 0920 · Histórico del Excel "Tracker Líderes"
-- Proyecto: norvxqgohddgsdkggqzq · Generado: 2026-10-29 · ESTADO: NO APLICADA
--
-- Decisión del dueño: docs/decisiones/2026-10-29-historico-tracker-lideres.md ("Sí, podemos dejar también la data que
--   está en el Excel en la solución que propongas en la app"). Reemplaza la A15 del 2026-10-15 (no importar el
--   histórico). Spec: docs/specs/2026-10-29-lideres-historico.md.
--
-- Qué hace:
--   1. lideres_historico_cargas: una fila por cada vez que la directora (o el administrador) sube el Excel: nombre del
--      archivo, su sha256, la fecha de corte, cuántas filas y quién.
--   2. lideres_historico: la copia del Excel para el seguimiento: fecha (o el texto si no se lee), líder (users.id y
--      el nombre como está en el Excel), ciudad (código DANE si se reconoce y el texto), tipo, estado, CUÁNTOS
--      contactos y si tenía observación. Sin nombres de médicos o contactos ni texto de observaciones: no hay columnas
--      para eso.
--   3. lideres_historico_reemplazar(p_carga jsonb, p_filas jsonb, p_user uuid): en una transacción, registra la carga,
--      borra las filas anteriores y escribe las nuevas (el Excel manda: si la directora corrige una fila, OpMap la
--      corrige). Solo service_role.
--   4. RLS activado sin políticas; nada para PUBLIC/anon/authenticated.
--   5. Bloque DO final: comprueba lo creado y prueba la función con un usuario de prueba; todo se deshace (P0920).
--
-- Borrar en el reemplazo: lideres_historico es una copia derivada del Excel (la fuente sigue siendo el archivo de la
--   directora) y cada carga queda en lideres_historico_cargas. No se borra ninguna otra tabla.
--
-- Depende de: users, municipalities (code). Rollback: 2026-10-29_9957_lideres_historico_rollback.sql.
-- Después de aplicar: NOTIFY pgrst, 'reload schema';  Costo Google: 0. No recalcula nada.
-- Transaccional: todo o nada. Re-ejecutable: sí (IF NOT EXISTS, CREATE OR REPLACE, REVOKE/GRANT idempotentes).
-- =====================================================================================

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.users') IS NULL OR to_regclass('public.municipalities') IS NULL THEN
    RAISE EXCEPTION '0920: faltan las tablas users o municipalities';
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.lideres_historico_cargas (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  archivo       text        NOT NULL,
  huella        text        NOT NULL,
  corte         date        NOT NULL,
  filas         integer     NOT NULL,
  importado_por uuid        NOT NULL REFERENCES public.users(id),
  importado_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lideres_historico_cargas_archivo_check CHECK (char_length(btrim(archivo)) BETWEEN 1 AND 200),
  CONSTRAINT lideres_historico_cargas_huella_check  CHECK (huella ~ '^[0-9a-f]{64}$'),
  CONSTRAINT lideres_historico_cargas_filas_check   CHECK (filas BETWEEN 0 AND 5000)
);

CREATE TABLE IF NOT EXISTS public.lideres_historico (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  carga_id        uuid        NOT NULL REFERENCES public.lideres_historico_cargas(id),
  fila            integer     NOT NULL,
  user_id         uuid        NOT NULL REFERENCES public.users(id),
  lider_texto     text        NOT NULL,
  fecha           date,
  fecha_texto     text,
  municipio_id    varchar(5)  REFERENCES public.municipalities(code),
  ciudad_texto    text        NOT NULL,
  tipo            text        NOT NULL,
  tipo_texto      text,
  estado          text        NOT NULL,
  contactos       smallint    NOT NULL DEFAULT 0,
  con_observacion boolean     NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lideres_historico_fila_check     CHECK (fila >= 2),
  CONSTRAINT lideres_historico_lider_check    CHECK (char_length(btrim(lider_texto)) BETWEEN 1 AND 120),
  CONSTRAINT lideres_historico_fecha_check    CHECK ((fecha IS NULL) = (fecha_texto IS NOT NULL)
                                                     AND (fecha_texto IS NULL OR char_length(fecha_texto) BETWEEN 1 AND 40)),
  CONSTRAINT lideres_historico_ciudad_check   CHECK (char_length(ciudad_texto) <= 120),
  CONSTRAINT lideres_historico_tipo_check     CHECK (tipo IN ('visita_medico', 'correria', 'reunion_clinica', 'congreso',
                                                               'capacitacion', 'cena', 'almuerzo', 'cirugia', 'otro')
                                                     AND (tipo_texto IS NULL OR char_length(tipo_texto) <= 120)),
  CONSTRAINT lideres_historico_estado_check   CHECK (estado IN ('realizada', 'cancelada', 'sin_cerrar', 'planificada')
                                                     AND (estado <> 'planificada' OR fecha IS NOT NULL)),
  CONSTRAINT lideres_historico_contactos_check CHECK (contactos BETWEEN 0 AND 200),
  CONSTRAINT lideres_historico_fila_key       UNIQUE (carga_id, fila)
);

CREATE INDEX IF NOT EXISTS lideres_historico_user_fecha_idx ON public.lideres_historico (user_id, fecha);
CREATE INDEX IF NOT EXISTS lideres_historico_fecha_idx ON public.lideres_historico (fecha);

ALTER TABLE public.lideres_historico_cargas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lideres_historico ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.lideres_historico_cargas FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.lideres_historico FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lideres_historico_cargas TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lideres_historico TO service_role;

COMMENT ON TABLE public.lideres_historico IS
  'Copia del Excel "Tracker Líderes" de la directora comercial (decisión 2026-10-29-historico-tracker-lideres). Sin nombres de médicos ni observaciones. Se reemplaza entera en cada carga (lideres_historico_reemplazar).';
COMMENT ON TABLE public.lideres_historico_cargas IS
  'Cada carga del Excel "Tracker Líderes": archivo, sha256, corte, filas y quién la subió.';

-- Reemplaza el histórico con una carga. p_carga: {archivo, huella, corte}. p_filas: arreglo de
-- {fila, user_id, lider_texto, fecha, fecha_texto, municipio_id, ciudad_texto, tipo, tipo_texto, estado, contactos,
--  con_observacion}. Devuelve {carga_id, filas}. 22023 si p_user no es un usuario activo o la carga no trae filas.
CREATE OR REPLACE FUNCTION public.lideres_historico_reemplazar(p_carga jsonb, p_filas jsonb, p_user uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_carga uuid;
  v_n     integer;
BEGIN
  IF p_user IS NULL OR NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = p_user AND coalesce(u.active, true)) THEN
    RAISE EXCEPTION 'Usuario inválido' USING ERRCODE = '22023';
  END IF;
  IF p_filas IS NULL OR jsonb_typeof(p_filas) <> 'array' OR jsonb_array_length(p_filas) = 0 THEN
    RAISE EXCEPTION 'La carga no trae filas' USING ERRCODE = '22023';
  END IF;
  -- Dos cargas a la vez: la segunda espera a la primera
  PERFORM pg_advisory_xact_lock(hashtext('lideres_historico'));

  INSERT INTO public.lideres_historico_cargas (archivo, huella, corte, filas, importado_por)
  VALUES (p_carga->>'archivo', p_carga->>'huella', (p_carga->>'corte')::date, jsonb_array_length(p_filas), p_user)
  RETURNING id INTO v_carga;

  DELETE FROM public.lideres_historico;

  INSERT INTO public.lideres_historico (carga_id, fila, user_id, lider_texto, fecha, fecha_texto, municipio_id,
                                        ciudad_texto, tipo, tipo_texto, estado, contactos, con_observacion)
  SELECT v_carga, f.fila, f.user_id, f.lider_texto, f.fecha, f.fecha_texto, f.municipio_id, f.ciudad_texto, f.tipo,
         f.tipo_texto, f.estado, f.contactos, f.con_observacion
  FROM jsonb_to_recordset(p_filas) AS f(fila integer, user_id uuid, lider_texto text, fecha date, fecha_texto text,
                                         municipio_id varchar(5), ciudad_texto text, tipo text, tipo_texto text,
                                         estado text, contactos smallint, con_observacion boolean);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN jsonb_build_object('carga_id', v_carga, 'filas', v_n);
END;
$fn$;

REVOKE ALL ON FUNCTION public.lideres_historico_reemplazar(jsonb, jsonb, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lideres_historico_reemplazar(jsonb, jsonb, uuid) TO service_role;

-- -------------------------------------------------------------------------------------
-- Comprobaciones y pruebas que se deshacen (P0920)
-- -------------------------------------------------------------------------------------
DO $$
DECLARE
  v_user      uuid;
  v_antes     bigint;
  v_cargas    bigint;
  v_res       jsonb;
  v_n         bigint;
  v_casos     text[] := ARRAY[]::text[];
BEGIN
  IF (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.lideres_historico'::regclass) IS NOT TRUE THEN
    RAISE EXCEPTION '0920: lideres_historico sin RLS';
  END IF;
  IF has_table_privilege('anon', 'public.lideres_historico', 'SELECT') OR has_table_privilege('authenticated', 'public.lideres_historico', 'SELECT')
     OR has_function_privilege('anon', 'public.lideres_historico_reemplazar(jsonb, jsonb, uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.lideres_historico_reemplazar(jsonb, jsonb, uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION '0920: anon o authenticated tienen acceso';
  END IF;
  -- Ninguna columna para nombres de médicos u observaciones
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'lideres_historico'
             AND column_name IN ('contactos_texto', 'medicos', 'observaciones', 'observacion')) THEN
    RAISE EXCEPTION '0920: lideres_historico no debe tener columnas de nombres ni de observaciones';
  END IF;

  SELECT count(*) INTO v_antes FROM public.lideres_historico;
  SELECT count(*) INTO v_cargas FROM public.lideres_historico_cargas;
  BEGIN
    INSERT INTO public.users (email, password, full_name, role, active)
    VALUES ('prueba0920-lider@opmap.invalid', 'x', 'Prueba Cero Novecientos Veinte', 'line_leader', true)
    RETURNING id INTO v_user;

    v_res := public.lideres_historico_reemplazar(
      jsonb_build_object('archivo', 'Tracker Líderes.xlsx', 'huella', repeat('a', 64), 'corte', '2026-10-29'),
      jsonb_build_array(
        jsonb_build_object('fila', 2, 'user_id', v_user, 'lider_texto', 'Prueba Novecientos', 'fecha', '2026-10-20',
                           'fecha_texto', NULL, 'municipio_id', '11001', 'ciudad_texto', 'Bogota', 'tipo', 'correria',
                           'tipo_texto', NULL, 'estado', 'realizada', 'contactos', 3, 'con_observacion', true),
        jsonb_build_object('fila', 3, 'user_id', v_user, 'lider_texto', 'Prueba Novecientos', 'fecha', NULL,
                           'fecha_texto', '31/02/2026', 'municipio_id', NULL, 'ciudad_texto', 'Verona', 'tipo', 'otro',
                           'tipo_texto', 'Congreso Verona', 'estado', 'sin_cerrar', 'contactos', 0, 'con_observacion', false)
      ),
      v_user);
    IF (v_res->>'filas')::int <> 2 OR (SELECT count(*) FROM public.lideres_historico) <> 2 THEN
      RAISE EXCEPTION '0920: la primera carga no dejó 2 filas (%)', v_res;
    END IF;
    v_casos := v_casos || 'primera carga'::text;

    -- Una segunda carga reemplaza todo (la fila 3 ya no está) y queda en la bitácora
    v_res := public.lideres_historico_reemplazar(
      jsonb_build_object('archivo', 'Tracker Líderes (2).xlsx', 'huella', repeat('b', 64), 'corte', '2026-10-30'),
      jsonb_build_array(jsonb_build_object('fila', 2, 'user_id', v_user, 'lider_texto', 'Prueba Novecientos', 'fecha', '2026-11-05',
                           'fecha_texto', NULL, 'municipio_id', '13001', 'ciudad_texto', 'Cartagena', 'tipo', 'congreso',
                           'tipo_texto', NULL, 'estado', 'planificada', 'contactos', 0, 'con_observacion', false)),
      v_user);
    IF (SELECT count(*) FROM public.lideres_historico) <> 1 OR (SELECT count(*) FROM public.lideres_historico_cargas) <> v_cargas + 2 THEN
      RAISE EXCEPTION '0920: la segunda carga no reemplazó (o no quedó en la bitácora)';
    END IF;
    v_casos := v_casos || 'reemplazo y bitácora'::text;

    -- Rechazos
    BEGIN
      PERFORM public.lideres_historico_reemplazar(jsonb_build_object('archivo', 'x.xlsx', 'huella', repeat('c', 64), 'corte', '2026-10-29'), '[]'::jsonb, v_user);
      RAISE EXCEPTION '0920: aceptó una carga sin filas';
    EXCEPTION WHEN invalid_parameter_value THEN NULL;
    END;
    BEGIN
      PERFORM public.lideres_historico_reemplazar(
        jsonb_build_object('archivo', 'x.xlsx', 'huella', repeat('c', 64), 'corte', '2026-10-29'),
        jsonb_build_array(jsonb_build_object('fila', 2, 'user_id', v_user, 'lider_texto', 'P', 'fecha', NULL, 'fecha_texto', NULL,
                             'municipio_id', NULL, 'ciudad_texto', '', 'tipo', 'otro', 'tipo_texto', NULL, 'estado', 'sin_cerrar',
                             'contactos', 0, 'con_observacion', false)),
        v_user);
      RAISE EXCEPTION '0920: aceptó una fila sin fecha ni texto de la fecha';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
      PERFORM public.lideres_historico_reemplazar(
        jsonb_build_object('archivo', 'x.xlsx', 'huella', repeat('c', 64), 'corte', '2026-10-29'),
        jsonb_build_array(jsonb_build_object('fila', 2, 'user_id', v_user, 'lider_texto', 'P', 'fecha', '2026-10-01', 'fecha_texto', NULL,
                             'municipio_id', NULL, 'ciudad_texto', 'x', 'tipo', 'visita_paciente', 'tipo_texto', NULL, 'estado', 'realizada',
                             'contactos', 0, 'con_observacion', false)),
        v_user);
      RAISE EXCEPTION '0920: aceptó un tipo que no existe';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
      PERFORM public.lideres_historico_reemplazar(jsonb_build_object('archivo', 'x.xlsx', 'huella', repeat('c', 64), 'corte', '2026-10-29'),
        jsonb_build_array(jsonb_build_object('fila', 2)), NULL);
      RAISE EXCEPTION '0920: aceptó un usuario nulo';
    EXCEPTION WHEN invalid_parameter_value THEN NULL;
    END;
    v_casos := v_casos || 'rechazos (sin filas, sin fecha, tipo, usuario)'::text;

    RAISE SQLSTATE 'P0920';
  EXCEPTION
    WHEN SQLSTATE 'P0920' THEN NULL;  -- pruebas deshechas
  END;

  SELECT count(*) INTO v_n FROM public.lideres_historico;
  IF v_n <> v_antes OR (SELECT count(*) FROM public.lideres_historico_cargas) <> v_cargas
     OR EXISTS (SELECT 1 FROM public.users WHERE email LIKE 'prueba0920-%') THEN
    RAISE EXCEPTION '0920: quedaron filas de las pruebas';
  END IF;
  IF cardinality(v_casos) < 3 THEN
    RAISE EXCEPTION '0920: solo se probaron % grupos de casos', cardinality(v_casos);
  END IF;
  RAISE NOTICE '0920 OK: lideres_historico y su bitácora con RLS y solo service_role; lideres_historico_reemplazar probada (%). SIGUIENTE PASO: NOTIFY pgrst, ''reload schema'';',
    array_to_string(v_casos, '; ');
END;
$$;

COMMIT;
