-- =====================================================================================
-- OpMap · feat/actividades-de-campo (actividades de campo · F1a: persona de campo y agenda con resultado) · 0850
-- Proyecto: norvxqgohddgsdkggqzq · Generado: 2026-10-15 · Puesta al día: 2026-10-29 · ESTADO: NO APLICADA
--
-- Puesta al día del 2026-10-29: la 0910 (visitas de VMO por persona, aplicada ese día) añadió visits.vmo_id, así que
--   visits tiene 46 columnas antes de esta migración (no 45) y vmo_id es conocida. Comprobado ese día con una consulta
--   de solo lectura: el visits_app_check nuevo lo cumplen las 4 visitas de la app y las 23.930 de VMO; las 27 citas y
--   las 4 visitas de la app tienen un Ejecutivo Comercial con usuario (el relleno de user_id no se detiene); las
--   funciones que se reemplazan siguen con el md5 de la 0840.
--
-- Spec (fuente de verdad de nombres): docs/specs/2026-10-15-actividades-de-campo.md (secciones "Modelo de datos",
--   "Ciclo de vida de lo programado" y "0850"). Decisiones del dueño: docs/decisiones/2026-10-15-actividades-de-campo.md
--   (A1, A2, A4, A7, A8, A16 y "dos citas no se cruzan en su media hora"). Contrato de la API: sección "F4.2" de
--   docs/fases/fase8-visitas-f3-f4-reporte-y-app-movil.md.
--
-- Por qué:
--   El dueño (2026-10-15): una sola app para los Ejecutivos Comerciales y las líderes; la directora comercial no agenda
--   ni reporta (A1); lo programado no se mueve de fecha: se cierra con su resultado (hecha, no se hizo con motivo,
--   cancelada con motivo) o se elimina si se programó por error, y otra fecha es una cita nueva enlazada (A7, A8); dos
--   citas no se cruzan en su media hora; no hay tope para agendar hacia adelante (A4); al salir alguien de la empresa se
--   cancela lo que tenía planeado (A16). Hasta la 0840 solo agendaba y reportaba un Ejecutivo Comercial con zona: las
--   funciones sacaban a la persona de executives.user_id. Desde aquí quien hace la visita o la cita es el USUARIO
--   (users.id) y el Ejecutivo Comercial es opcional (decisión C1 de la spec).
--
-- Qué hace:
--   1. visits:
--      - user_id uuid → users (NULL en las de VMO). Relleno: las de la app toman executives.user_id (hoy 1 fila); si
--        alguna de la app queda sin user_id, la migración se detiene.
--      - visits_app_check igual que en la 0830 salvo las de la app: exige user_id; ya no exige executive_id ni kam_id
--        sino (executive_id IS NULL) = (kam_id IS NULL); sin Ejecutivo Comercial, out_of_territory es false.
--      - Índices visits_user_date_idx (user_id, visit_date) y visits_user_next_step_idx (user_id, next_step_date),
--        solo de la app. Se conservan los de executive_id.
--   2. visitas_agenda:
--      - user_id uuid NOT NULL → users, relleno desde executives.user_id (hoy 20 filas de una persona; NO desde
--        created_by: las creó un admin en la simulación). executive_id pasa a NULL (cita como líder, C12).
--      - motivo_codigo (cliente | prioridad | falta_tiempo | fuerza_mayor | otro | salida), no_realizada_at,
--        no_realizada_motivo (≤ 300), eliminada_at, eliminada_por → users y viene_de → visitas_agenda ("otra fecha").
--      - Estados: pendiente | hecha | no_realizada | cancelada | eliminada (visitas_agenda_estado_check) y su
--        coherencia (visitas_agenda_estado_datos_check); con motivo 'otro' el texto es obligatorio.
--      - Disparador visitas_agenda_cancelar_con_motivo: una cita que PASA a cancelada sin motivo_codigo se rechaza
--        (A8). Las canceladas de antes (hoy 0) pueden no tenerlo.
--      - Índices únicos rehechos por persona y solo entre pendientes y hechas: visitas_agenda_medico_uidx
--        (user_id, fecha, medico_id) y visitas_agenda_cuenta_uidx (user_id, fecha, cuenta_id, subtipo_id);
--        visitas_agenda_viene_de_uidx (una sucesora no eliminada por cita) y visitas_agenda_user_fecha_idx. Se
--        conservan visitas_agenda_executive_fecha_idx y visitas_agenda_visita_uidx. No hay EXCLUDE para el choque
--        (pediría btree_gist): el candado por persona serializa y agenda_crear decide.
--   3. Funciones nuevas (service_role, SECURITY INVOKER, search_path fijo):
--      persona_lineas(p_user) → uuid[]; persona_de_campo(p_user) → jsonb; ejecutivo_de_la_visita(p_user, p_lineas)
--      → uuid; medico_de_lineas(p_medico, p_lineas, p_fecha) → boolean (C9); visitas_config_persona(p_executive,
--      p_fecha) → jsonb; agenda_choque(p_user, p_fecha, p_hora, p_excluir) → jsonb; agenda_cerrar(p_id, p, p_user)
--      ("no se hizo"); agenda_eliminar(p_id, p_user) (por error); agenda_otra_fecha(p_id, p, p_user); y las de
--      disparador agenda_cancelar_por_salida() (users_salida_cancela_agenda, executives_baja_cancela_agenda) y
--      visitas_agenda_cancelar_con_motivo().
--   4. Funciones reemplazadas, con las MISMAS firmas salvo agenda_cancelar (la API de hoy sigue funcionando):
--      visitas_registrar, visitas_editar, visitas_anular y agenda_crear pasan a la persona (user_id); agenda_cancelar
--      (uuid, text, uuid) se reemplaza por (uuid, text, uuid, p_motivo_codigo text DEFAULT 'otro'): la llamada de hoy,
--      con 3 argumentos por nombre, sigue valiendo, pero el motivo es obligatorio (A8).
--   5. Privilegios: nada para PUBLIC/anon/authenticated; EXECUTE a service_role. Sin políticas RLS nuevas.
--   6. Bloque DO final con las comprobaciones y las pruebas que se deshacen (RAISE SQLSTATE 'P0850'), con personas,
--      líneas, Ejecutivos Comerciales, médicos, cuentas y sedes DE PRUEBA (no depende de quién exista en la base); las
--      personas reales solo se leen.
--
-- Persona de campo (spec, "Quién es quién"): usuario activo que no es commercial_director, con persona_lineas no
--   vacío = las executive_lines de su Ejecutivo Comercial activo ∪ las líneas activas que lidera
--   (business_lines.leader_user_id). El Ejecutivo Comercial de una visita es el suyo solo si alguna línea de la visita
--   está en sus executive_lines; si no, la visita es "como líder": kam_id NULL, kam_name = users.full_name,
--   out_of_territory false, configuración general (médica e institucional, radio general, sin telefónica) y el médico
--   debe ser de sus líneas (C9). Candado, topes, idempotencia y duplicados van por persona:
--   pg_advisory_xact_lock(hashtext('visitas_app:' || user_id)). La cita lleva executive_id si es "como Ejecutivo
--   Comercial" y NULL si es "como líder" (p.como; por defecto, como Ejecutivo Comercial si lo tiene).
--
-- Ciclo de vida de la cita (A7): pendiente → hecha (reportando la visita) | no_realizada (agenda_cerrar, desde su día,
--   con motivo) | cancelada (agenda_cancelar, de hoy en adelante, con motivo; o la salida) | eliminada (agenda_eliminar,
--   pendiente y de hoy en adelante; la fila se queda y ninguna lectura la muestra). Otra fecha = agenda_otra_fecha: una
--   cita nueva con viene_de = la anterior, que debe estar cerrada (no_realizada, cancelada no por salida, o hecha con una
--   visita no efectiva) y sin otra sucesora. Con otra fecha, la cita queda cerrada: visitas_anular no anula su visita y
--   visitas_editar no la pasa a efectiva hasta que se elimine la otra fecha.
--
-- Salida (A16, C11): users.active pasa de true a false → se cancelan sus citas pendientes de hoy en adelante
--   (motivo_codigo 'salida', "Salió de la empresa"). Un Ejecutivo Comercial pasa a inactive → si su usuario se queda sin
--   líneas, igual; si sigue siendo persona de campo (una líder que también era Ejecutivo Comercial), solo las citas que
--   tenía como Ejecutivo Comercial, con motivo 'otro' ("Dejó de ser Ejecutivo Comercial": no salió de la empresa, así
--   que admiten otra fecha). Lo de días pasados queda como está ("Sin cerrar"). La salida toma el candado por persona
--   de agenda_crear. No se toca el cuerpo de ejecutivas_traspasar (0820): sus pasos j y k disparan esto.
--
-- Errores para la API: 22023 forma (400); 23514 regla con mensaje para la persona (400); 23505 repetida (cita con el
--   mismo médico ese día, segunda "otra fecha", client_id ajeno) (409); 23P01 choque de media hora (409, con el error en
--   `hora`); P0002 inexistente o ajena (404). Cualquier error deshace la cita o la visita.
--
-- Depende de: 0830, 0840 (aplicadas el 2026-10-14) y 0910 (2026-10-29: visits.vmo_id → visits con 46 columnas),
--   visitas_agenda con 17 columnas, y las funciones con
--   el md5 de sus archivos), 0820 (ejecutivas_traspasar, no se toca), 0810 (dias_libres, config_personas,
--   config_general, config_registrar, visitas_sin_borrar), 0800 (medicos, medico_sedes, medico_visitantes, cuentas,
--   sedes, subtipos_institucionales, terceros_crear_medico), users, executives, executive_lines, business_lines, kams y
--   public.update_updated_at_column(). Rollback: 2026-10-15_9945_persona_de_campo_y_agenda_rollback.sql (se detiene si
--   hay filas que la 0840 no admite).
--
-- Después de aplicar (misma ventana que el despliegue del código de F1a):
--   NOTIFY pgrst, 'reload schema';   -- PostgREST debe ver las columnas, la firma nueva de agenda_cancelar y las funciones
--   Costo Google: 0 (no llama a nada). No recalcula asignaciones ni cobertura.
--   La 0850 conserva las llamadas de la API de hoy (mismas firmas; agenda_cancelar acepta los 3 argumentos), así que
--   puede ir antes que el código. Lo que cambia para la app de hoy: una cita que se cruza en su media hora se rechaza
--   (23P01), cancelar sin motivo se rechaza y la cita lleva hora.
--
-- Transaccional: todo o nada. Re-ejecutable: sí (IF NOT EXISTS, DROP ... IF EXISTS + ADD/CREATE, CREATE OR REPLACE;
--   las precondiciones aceptan la 0850 ya aplicada y los rellenos solo tocan filas sin user_id).
-- =====================================================================================

BEGIN;

-- -------------------------------------------------------------------------------------
-- 0. Precondiciones y huellas (importadas de VMO, citas y visitas de la app existentes)
-- -------------------------------------------------------------------------------------

DO $$
DECLARE
  v_tabla     text;
  v_fn        text;
  v_col       record;
  v_n         bigint;
  v_nuevas    bigint;
  v_md5       text;
  v_md5_todo  text;
  v_visits    constant text[] := ARRAY['id', 'kam_id', 'kam_name', 'visit_type', 'contact_type', 'lat', 'lng',
                                       'visit_date', 'hospital_id', 'imported_by', 'imported_at', 'created_at',
                                       'updated_at', 'import_id',
                                       'source', 'executive_id', 'client_id', 'tipo', 'subtipo_id', 'subtipo_codigo',
                                       'medico_id', 'cuenta_id', 'sede_id', 'contacto_id', 'modalidad', 'medio',
                                       'efectiva', 'failure_reason', 'retry_date', 'checked_in_at', 'reported_at',
                                       'distance_m', 'gps_accuracy_m', 'conclusion', 'compromisos', 'next_step_date',
                                       'transcript', 'input_mode', 'out_of_territory', 'created_by', 'updated_by',
                                       'deleted_at', 'deleted_reason',
                                       'agenda_id', 'agendada',
                                       'vmo_id',
                                       'user_id'];
  v_agenda    constant text[] := ARRAY['id', 'executive_id', 'fecha', 'hora', 'tipo', 'medico_id', 'cuenta_id',
                                       'subtipo_id', 'sede_id', 'nota', 'estado', 'visita_id', 'cancelada_at',
                                       'cancelada_motivo', 'created_by', 'created_at', 'updated_at',
                                       'user_id', 'motivo_codigo', 'no_realizada_at', 'no_realizada_motivo',
                                       'eliminada_at', 'eliminada_por', 'viene_de'];
BEGIN
  FOREACH v_tabla IN ARRAY ARRAY['users', 'executives', 'executive_lines', 'business_lines', 'kams', 'municipalities',
                                 'visits', 'visit_lines', 'visitas_agenda', 'cuentas', 'sedes', 'medicos',
                                 'medico_sedes', 'medico_visitantes', 'contactos', 'subtipos_institucionales',
                                 'config_personas', 'config_general', 'dias_libres'] LOOP
    IF to_regclass('public.' || v_tabla) IS NULL THEN
      RAISE EXCEPTION '0850 Persona de campo: falta la tabla previa public.% (0800, 0810, 0830 y 0840 deben estar aplicadas)', v_tabla;
    END IF;
  END LOOP;
  FOREACH v_fn IN ARRAY ARRAY['public.update_updated_at_column()', 'public.visitas_sin_borrar()',
                              'public.terceros_crear_medico(jsonb, jsonb, uuid)',
                              'public.config_registrar(text, jsonb, date, date, text, uuid)',
                              'public.visitas_registrar(jsonb, uuid)', 'public.visitas_editar(uuid, jsonb, uuid)',
                              'public.visitas_anular(uuid, text, uuid)', 'public.visitas_config_vigente(uuid, date)',
                              'public.visitas_distancia_m(double precision, double precision, double precision, double precision)',
                              'public.agenda_crear(jsonb, uuid)', 'public.ejecutivas_traspasar(jsonb, uuid)'] LOOP
    IF to_regprocedure(v_fn) IS NULL THEN
      RAISE EXCEPTION '0850 Persona de campo: falta la función previa % (la 0820, la 0830 y la 0840 deben estar aplicadas)', v_fn;
    END IF;
  END LOOP;
  IF to_regprocedure('public.agenda_cancelar(uuid, text, uuid)') IS NULL
     AND to_regprocedure('public.agenda_cancelar(uuid, text, uuid, text)') IS NULL THEN
    RAISE EXCEPTION '0850: falta public.agenda_cancelar (la 0840 debe estar aplicada)';
  END IF;
  SELECT count(*) INTO v_n FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname = 'agenda_cancelar';
  IF v_n <> 1 THEN
    RAISE EXCEPTION '0850: hay % versiones de public.agenda_cancelar; se esperaba una (la de la 0840 o la de la 0850)', v_n;
  END IF;

  -- visits: las 45 columnas de la 0840 y vmo_id de la 0910 (más user_id si la 0850 ya se aplicó) y ninguna desconocida.
  SELECT count(*) INTO v_nuevas FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'visits' AND column_name = 'user_id';
  SELECT count(*) INTO v_n FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'visits';
  IF v_n <> 46 + v_nuevas THEN
    RAISE EXCEPTION '0850: visits tiene % columnas; se esperaban 46 (las 45 de la 0840 y vmo_id de la 0910) más % de la 0850 ya presente', v_n, v_nuevas;
  END IF;
  SELECT count(*) INTO v_n FROM information_schema.columns c
  WHERE c.table_schema = 'public' AND c.table_name = 'visits' AND c.column_name <> ALL (v_visits);
  IF v_n > 0 THEN
    RAISE EXCEPTION '0850: visits tiene % columna(s) que ni la 0840 ni la 0850 conocen; revisar antes de migrar', v_n;
  END IF;
  -- visitas_agenda: las 17 de la 0840 (más las 7 de la 0850 si ya se aplicó) y ninguna desconocida.
  SELECT count(*) INTO v_nuevas FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'visitas_agenda'
    AND column_name IN ('user_id', 'motivo_codigo', 'no_realizada_at', 'no_realizada_motivo', 'eliminada_at',
                        'eliminada_por', 'viene_de');
  IF v_nuevas NOT IN (0, 7) THEN
    RAISE EXCEPTION '0850: visitas_agenda tiene % de las 7 columnas de la 0850 (a medias); revisar antes de migrar', v_nuevas;
  END IF;
  -- Primera vez (sin las columnas de la 0850): al final se comprueba que el relleno de user_id fue el de executives.
  PERFORM set_config('opmap0850.primera', CASE WHEN v_nuevas = 0 THEN '1' ELSE '0' END, true);
  SELECT count(*) INTO v_n FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'visitas_agenda';
  IF v_n <> 17 + v_nuevas THEN
    RAISE EXCEPTION '0850: visitas_agenda tiene % columnas; se esperaban 17 (las de la 0840) más % de la 0850', v_n, v_nuevas;
  END IF;
  SELECT count(*) INTO v_n FROM information_schema.columns c
  WHERE c.table_schema = 'public' AND c.table_name = 'visitas_agenda' AND c.column_name <> ALL (v_agenda);
  IF v_n > 0 THEN
    RAISE EXCEPTION '0850: visitas_agenda tiene % columna(s) que ni la 0840 ni la 0850 conocen; revisar antes de migrar', v_n;
  END IF;
  FOREACH v_fn IN ARRAY ARRAY['visits_app_check', 'visits_agenda_check', 'visits_source_check'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.visits'::regclass AND conname = v_fn AND contype = 'c') THEN
      RAISE EXCEPTION '0850: falta el CHECK % de visits (0830 / 0840)', v_fn;
    END IF;
  END LOOP;

  -- Las funciones que se reemplazan son las de la 0840 (visitas_editar, de la 0830) o ya las de la 0850 si se
  -- re-ejecuta; las demás no cambian. md5 del cuerpo (pg_proc.prosrc) = el texto entre las comillas de dólar de cada
  -- CREATE FUNCTION del archivo (aquí no se escriben: dentro de este DO cerrarían el bloque).
  FOR v_col IN
    SELECT * FROM (VALUES
      ('visitas_registrar', ARRAY['eeae55de7196179daa686cc9bd11da7c', 'e915ea728b393ba6dd677a109d09faf5']),
      ('visitas_editar', ARRAY['f7948c247b88575f4695943f4c9bad45', 'ef8c1f875cd58a30f72fdcf6bbf3b9f6']),
      ('visitas_anular', ARRAY['462a121cfde8802c4a830bd3c61c05e4', 'b1ab633c3949a21f75ae887bee68bcda']),
      ('agenda_crear', ARRAY['68e92a28d606fd2b45b57530db87558c', '0bb1da4a0d377040d79eccb5f6c3a16f']),
      ('agenda_cancelar', ARRAY['cf3d768d58654ec1e767144fafb62be5', '2ee5183731a93220a107aea059dbf0ef']),
      ('visitas_config_vigente', ARRAY['b5ce2f997fc50012ebc3e8d61463bc1c']),
      ('visitas_distancia_m', ARRAY['de6fd102ba79b9d0b59dc94ea9d4b60b']),
      ('ejecutivas_traspasar', ARRAY['ff6344693b3256a125f12b3222910e5b'])
    ) AS t(nombre, huellas)
  LOOP
    SELECT md5(p.prosrc) INTO v_md5 FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace AND p.proname = v_col.nombre;
    IF v_md5 IS NULL OR v_md5 <> ALL (v_col.huellas) THEN
      RAISE EXCEPTION '0850: public.% no es la de su migración (md5 %); alguien la cambió: revisar antes de reemplazarla', v_col.nombre, v_md5;
    END IF;
  END LOOP;

  -- Huella de las importadas de VMO (la misma fórmula que la 0830 y la 0840): se compara al final.
  SELECT count(*),
         md5(string_agg(v.id::text || v.visit_type || v.contact_type || v.visit_date::text, ',' ORDER BY v.id)),
         md5(string_agg(ROW(v.id, v.kam_id, v.kam_name, v.visit_type, v.contact_type, v.lat, v.lng, v.visit_date,
                            v.hospital_id, v.imported_by, v.imported_at, v.created_at, v.updated_at,
                            v.import_id)::text, ',' ORDER BY v.id))
  INTO v_n, v_md5, v_md5_todo
  FROM public.visits v
  WHERE v.source = 'vmo_import';
  PERFORM set_config('opmap0850.importadas', v_n::text || '|' || coalesce(v_md5, '-') || '|' || coalesce(v_md5_todo, '-'),
                     true);
  RAISE NOTICE '0850: % visita(s) importada(s) de VMO antes de migrar (huella %)', v_n, coalesce(v_md5, '-');

  -- Huella de las citas y de las visitas de la app que ya existen (sus columnas de la 0840, sin updated_at, que el
  -- relleno de user_id mueve): después de migrar deben ser idénticas, con su vínculo.
  SELECT count(*),
         md5(coalesce(string_agg(ROW(a.id, a.executive_id, a.fecha, a.hora, a.tipo, a.medico_id, a.cuenta_id, a.subtipo_id,
                                     a.sede_id, a.nota, a.estado, a.visita_id, a.cancelada_at, a.cancelada_motivo,
                                     a.created_by, a.created_at)::text, ',' ORDER BY a.id), ''))
  INTO v_n, v_md5
  FROM public.visitas_agenda a;
  PERFORM set_config('opmap0850.citas', v_n::text || '|' || v_md5, true);
  SELECT count(*),
         md5(coalesce(string_agg(ROW(v.id, v.executive_id, v.kam_id, v.kam_name, v.client_id, v.tipo, v.medico_id,
                                     v.cuenta_id, v.sede_id, v.efectiva, v.visit_date, v.out_of_territory, v.deleted_at,
                                     v.agenda_id, v.agendada)::text, ',' ORDER BY v.id), ''))
  INTO v_n, v_md5
  FROM public.visits v
  WHERE v.source = 'app';
  PERFORM set_config('opmap0850.visitas_app', v_n::text || '|' || v_md5, true);
  RAISE NOTICE '0850: % cita(s) y % visita(s) de la app antes de migrar',
    split_part(current_setting('opmap0850.citas', true), '|', 1), v_n;
END;
$$;

-- -------------------------------------------------------------------------------------
-- 1. visits: la persona (user_id) y la visita "como líder" (sin Ejecutivo Comercial ni zona)
-- -------------------------------------------------------------------------------------

ALTER TABLE public.visits
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES public.users (id);

-- Relleno: las de la app toman el usuario de su Ejecutivo Comercial (hoy 1 fila). No desde created_by.
UPDATE public.visits v
SET user_id = e.user_id
FROM public.executives e
WHERE v.source = 'app' AND v.user_id IS NULL AND e.id = v.executive_id AND e.user_id IS NOT NULL;

DO $$
DECLARE
  v_n bigint;
BEGIN
  SELECT count(*) INTO v_n FROM public.visits v WHERE v.source = 'app' AND v.user_id IS NULL;
  IF v_n > 0 THEN
    RAISE EXCEPTION '0850: % visita(s) de la app quedan sin user_id (su Ejecutivo Comercial no tiene usuario); revisar antes de migrar', v_n;
  END IF;
END;
$$;

-- Igual que la 0830 salvo las de la app: user_id obligatorio; executive_id y kam_id van juntos (los dos o ninguno:
-- sin Ejecutivo Comercial, la visita es "como líder"); sin Ejecutivo Comercial, out_of_territory es false.
ALTER TABLE public.visits DROP CONSTRAINT IF EXISTS visits_app_check;
ALTER TABLE public.visits ADD CONSTRAINT visits_app_check CHECK (
  (tipo IS NULL OR tipo IN ('medica', 'institucional'))
  AND (modalidad IS NULL OR modalidad IN ('presencial', 'telefonica'))
  AND (medio IS NULL OR medio IN ('llamada', 'videollamada'))
  AND (input_mode IS NULL OR input_mode IN ('voz', 'toques'))
  AND (failure_reason IS NULL OR (btrim(failure_reason) <> '' AND char_length(failure_reason) <= 300))
  AND (conclusion IS NULL OR char_length(conclusion) <= 2000)
  AND (compromisos IS NULL OR char_length(compromisos) <= 2000)
  AND (transcript IS NULL OR char_length(transcript) <= 8000)
  AND (distance_m IS NULL OR distance_m >= 0)
  AND (gps_accuracy_m IS NULL OR gps_accuracy_m >= 0)
  AND ((deleted_at IS NULL) = (deleted_reason IS NULL))
  AND (deleted_reason IS NULL OR char_length(btrim(deleted_reason)) BETWEEN 5 AND 300)
  AND (source <> 'app' OR (
        user_id IS NOT NULL AND client_id IS NOT NULL AND tipo IS NOT NULL AND sede_id IS NOT NULL
        AND modalidad IS NOT NULL AND efectiva IS NOT NULL AND checked_in_at IS NOT NULL AND reported_at IS NOT NULL
        AND input_mode IS NOT NULL
        AND (executive_id IS NULL) = (kam_id IS NULL)
        AND (executive_id IS NOT NULL OR NOT out_of_territory)
        AND reported_at >= checked_in_at
        AND visit_date = (checked_in_at AT TIME ZONE 'America/Bogota')::date
        AND (next_step_date IS NULL OR next_step_date >= visit_date)
        AND (retry_date IS NULL OR retry_date >= visit_date)
        AND CASE WHEN tipo = 'medica'
                 THEN medico_id IS NOT NULL AND subtipo_id IS NULL AND subtipo_codigo IS NULL AND contacto_id IS NULL
                 ELSE cuenta_id IS NOT NULL AND subtipo_id IS NOT NULL AND subtipo_codigo IS NOT NULL
                      AND medico_id IS NULL
            END
        AND CASE WHEN modalidad = 'presencial'
                 THEN medio IS NULL AND distance_m IS NOT NULL AND contact_type = 'Visita presencial'
                 ELSE medio IS NOT NULL AND contact_type = 'Visita virtual'
            END
        AND CASE WHEN efectiva
                 THEN failure_reason IS NULL AND retry_date IS NULL AND visit_type = 'Visita efectiva'
                 ELSE failure_reason IS NOT NULL AND visit_type = 'Visita no efectiva'
            END
      ))
);

CREATE INDEX IF NOT EXISTS visits_user_date_idx ON public.visits (user_id, visit_date) WHERE source = 'app';
CREATE INDEX IF NOT EXISTS visits_user_next_step_idx ON public.visits (user_id, next_step_date)
  WHERE source = 'app' AND next_step_date IS NOT NULL;

-- -------------------------------------------------------------------------------------
-- 2. visitas_agenda: la persona, el ciclo de vida (A7) y "otra fecha"
-- -------------------------------------------------------------------------------------

ALTER TABLE public.visitas_agenda
  ADD COLUMN IF NOT EXISTS user_id             uuid        REFERENCES public.users (id),
  ADD COLUMN IF NOT EXISTS motivo_codigo       text,
  ADD COLUMN IF NOT EXISTS no_realizada_at     timestamptz,
  ADD COLUMN IF NOT EXISTS no_realizada_motivo text,
  ADD COLUMN IF NOT EXISTS eliminada_at        timestamptz,
  ADD COLUMN IF NOT EXISTS eliminada_por       uuid        REFERENCES public.users (id),
  ADD COLUMN IF NOT EXISTS viene_de            uuid        REFERENCES public.visitas_agenda (id);

-- Relleno desde el usuario de su Ejecutivo Comercial (hoy 20 filas, todas de una persona). No desde created_by: las
-- 20 las creó un admin en la simulación.
UPDATE public.visitas_agenda a
SET user_id = e.user_id
FROM public.executives e
WHERE a.user_id IS NULL AND e.id = a.executive_id AND e.user_id IS NOT NULL;

DO $$
DECLARE
  v_n bigint;
BEGIN
  SELECT count(*) INTO v_n FROM public.visitas_agenda a WHERE a.user_id IS NULL;
  IF v_n > 0 THEN
    RAISE EXCEPTION '0850: % cita(s) quedan sin user_id (su Ejecutivo Comercial no tiene usuario); revisar antes de migrar', v_n;
  END IF;
END;
$$;

ALTER TABLE public.visitas_agenda ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.visitas_agenda ALTER COLUMN executive_id DROP NOT NULL;

ALTER TABLE public.visitas_agenda DROP CONSTRAINT IF EXISTS visitas_agenda_estado_check;
ALTER TABLE public.visitas_agenda ADD CONSTRAINT visitas_agenda_estado_check
  CHECK (estado IN ('pendiente', 'hecha', 'no_realizada', 'cancelada', 'eliminada'));
ALTER TABLE public.visitas_agenda DROP CONSTRAINT IF EXISTS visitas_agenda_motivo_codigo_check;
ALTER TABLE public.visitas_agenda ADD CONSTRAINT visitas_agenda_motivo_codigo_check
  CHECK (motivo_codigo IS NULL OR motivo_codigo IN ('cliente', 'prioridad', 'falta_tiempo', 'fuerza_mayor', 'otro', 'salida'));
ALTER TABLE public.visitas_agenda DROP CONSTRAINT IF EXISTS visitas_agenda_no_realizada_motivo_check;
ALTER TABLE public.visitas_agenda ADD CONSTRAINT visitas_agenda_no_realizada_motivo_check
  CHECK (no_realizada_motivo IS NULL OR (btrim(no_realizada_motivo) <> '' AND char_length(no_realizada_motivo) <= 300));
ALTER TABLE public.visitas_agenda DROP CONSTRAINT IF EXISTS visitas_agenda_viene_de_check;
ALTER TABLE public.visitas_agenda ADD CONSTRAINT visitas_agenda_viene_de_check
  CHECK (viene_de IS NULL OR viene_de <> id);
-- Coherencia por estado (A7): pendiente sin cierre; hecha con su visita; no_realizada con su fecha y motivo (no
-- 'salida'); cancelada con su fecha (el motivo lo exige el disparador en las nuevas); eliminada con fecha y quién. Con
-- motivo 'otro', el texto es obligatorio.
ALTER TABLE public.visitas_agenda DROP CONSTRAINT IF EXISTS visitas_agenda_estado_datos_check;
ALTER TABLE public.visitas_agenda ADD CONSTRAINT visitas_agenda_estado_datos_check CHECK (
  CASE estado
    WHEN 'pendiente' THEN visita_id IS NULL AND cancelada_at IS NULL AND cancelada_motivo IS NULL
                          AND no_realizada_at IS NULL AND no_realizada_motivo IS NULL AND eliminada_at IS NULL
                          AND eliminada_por IS NULL AND motivo_codigo IS NULL
    WHEN 'hecha'     THEN visita_id IS NOT NULL AND cancelada_at IS NULL AND cancelada_motivo IS NULL
                          AND no_realizada_at IS NULL AND no_realizada_motivo IS NULL AND eliminada_at IS NULL
                          AND eliminada_por IS NULL AND motivo_codigo IS NULL
    WHEN 'no_realizada' THEN visita_id IS NULL AND no_realizada_at IS NOT NULL AND motivo_codigo IS NOT NULL
                          AND motivo_codigo <> 'salida' AND cancelada_at IS NULL AND cancelada_motivo IS NULL
                          AND eliminada_at IS NULL AND eliminada_por IS NULL
    WHEN 'cancelada' THEN visita_id IS NULL AND cancelada_at IS NOT NULL AND no_realizada_at IS NULL
                          AND no_realizada_motivo IS NULL AND eliminada_at IS NULL AND eliminada_por IS NULL
    ELSE visita_id IS NULL AND eliminada_at IS NOT NULL AND eliminada_por IS NOT NULL AND cancelada_at IS NULL
         AND cancelada_motivo IS NULL AND no_realizada_at IS NULL AND no_realizada_motivo IS NULL AND motivo_codigo IS NULL
  END
  AND (motivo_codigo IS DISTINCT FROM 'otro' OR coalesce(cancelada_motivo, no_realizada_motivo) IS NOT NULL));

-- Sin duplicados por PERSONA (una sola agenda aunque tenga dos papeles), solo entre pendientes y hechas: lo cancelado,
-- lo que no se hizo y lo eliminado no ocupa el día.
DROP INDEX IF EXISTS public.visitas_agenda_medico_uidx;
CREATE UNIQUE INDEX visitas_agenda_medico_uidx
  ON public.visitas_agenda (user_id, fecha, medico_id) WHERE tipo = 'medica' AND estado IN ('pendiente', 'hecha');
DROP INDEX IF EXISTS public.visitas_agenda_cuenta_uidx;
CREATE UNIQUE INDEX visitas_agenda_cuenta_uidx
  ON public.visitas_agenda (user_id, fecha, cuenta_id, subtipo_id) WHERE tipo = 'institucional' AND estado IN ('pendiente', 'hecha');
-- Una cita tiene a lo sumo una sucesora ("otra fecha") no eliminada: si la sucesora se eliminó por error, se puede
-- pedir otra fecha de nuevo. Puede haber cadena.
DROP INDEX IF EXISTS public.visitas_agenda_viene_de_uidx;
CREATE UNIQUE INDEX visitas_agenda_viene_de_uidx
  ON public.visitas_agenda (viene_de) WHERE viene_de IS NOT NULL AND estado <> 'eliminada';
CREATE INDEX IF NOT EXISTS visitas_agenda_user_fecha_idx ON public.visitas_agenda (user_id, fecha);

-- Cancelar exige motivo (A8): una cita que PASA a cancelada sin motivo_codigo se rechaza. Las canceladas de antes de la
-- 0850 (hoy 0) pueden no tenerlo; el CHECK no lo puede distinguir, el disparador sí.
CREATE OR REPLACE FUNCTION public.visitas_agenda_cancelar_con_motivo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.estado = 'cancelada' AND NEW.motivo_codigo IS NULL THEN
    IF TG_OP = 'INSERT' THEN
      RAISE EXCEPTION 'Cancelar exige motivo (motivo_codigo)' USING ERRCODE = 'check_violation';
    END IF;
    IF OLD.estado IS DISTINCT FROM 'cancelada' THEN
      RAISE EXCEPTION 'Cancelar exige motivo (motivo_codigo)' USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER visitas_agenda_cancelar_con_motivo
  BEFORE INSERT OR UPDATE OF estado, motivo_codigo ON public.visitas_agenda
  FOR EACH ROW EXECUTE FUNCTION public.visitas_agenda_cancelar_con_motivo();

-- -------------------------------------------------------------------------------------
-- 3. Funciones nuevas: quién es quién, el médico de las líneas, la configuración y el choque
-- -------------------------------------------------------------------------------------

-- Las líneas con las que la persona reporta y agenda: las executive_lines de su Ejecutivo Comercial ACTIVO ∪ las
-- líneas activas que lidera. '{}' si el usuario no existe, está inactivo o es commercial_director (A1). Espejo:
-- lineasParaReportar de web/lib/persona-campo.ts.
CREATE OR REPLACE FUNCTION public.persona_lineas(p_user uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN NOT EXISTS (SELECT 1 FROM public.users u
                     WHERE u.id = p_user AND u.active IS TRUE AND u.role <> 'commercial_director')
      THEN '{}'::uuid[]
    ELSE ARRAY(
      SELECT x.id
      FROM (
        SELECT el.line_id AS id
        FROM public.executives e
        JOIN public.executive_lines el ON el.executive_id = e.id
        WHERE e.user_id = p_user AND e.status = 'active'
        UNION
        SELECT b.id
        FROM public.business_lines b
        WHERE b.leader_user_id = p_user AND b.active
      ) AS x
      ORDER BY x.id)
  END
$$;

-- La persona de campo del usuario (spec, "Quién es quién"), o 23514 con el mensaje para la persona. Espejo:
-- personaDeCampo de web/lib/persona-campo.ts.
CREATE OR REPLACE FUNCTION public.persona_de_campo(p_user uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_nombre text;
  v_rol    text;
  v_activo boolean;
  v_exec   uuid;
  v_zona   uuid;
  v_ec     uuid[] := '{}';
  v_lider  uuid[];
BEGIN
  IF p_user IS NULL THEN
    RAISE EXCEPTION 'Falta el usuario' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  SELECT u.full_name, u.role, u.active INTO v_nombre, v_rol, v_activo
  FROM public.users u
  WHERE u.id = p_user;
  IF v_rol = 'commercial_director' THEN
    RAISE EXCEPTION 'La dirección comercial no agenda ni reporta: sigue a tu equipo en Equipo' USING ERRCODE = 'check_violation';
  END IF;
  SELECT e.id, e.base_kam_id INTO v_exec, v_zona
  FROM public.executives e
  WHERE e.user_id = p_user AND e.status = 'active';
  IF v_exec IS NOT NULL THEN
    v_ec := ARRAY(SELECT el.line_id FROM public.executive_lines el WHERE el.executive_id = v_exec ORDER BY el.line_id);
  END IF;
  v_lider := ARRAY(SELECT b.id FROM public.business_lines b WHERE b.leader_user_id = p_user AND b.active ORDER BY b.id);
  IF v_activo IS NOT TRUE OR (cardinality(v_ec) = 0 AND cardinality(v_lider) = 0) THEN
    RAISE EXCEPTION 'Tu usuario no tiene líneas para reportar' USING ERRCODE = 'check_violation';
  END IF;
  IF v_exec IS NOT NULL AND v_zona IS NULL THEN
    RAISE EXCEPTION 'Tu Ejecutivo Comercial no tiene zona base' USING ERRCODE = 'check_violation';
  END IF;
  RETURN jsonb_build_object(
    'user_id', p_user,
    'nombre', v_nombre,
    'rol', CASE WHEN cardinality(v_lider) = 0 THEN 'ejecutivo'
                WHEN cardinality(v_ec) = 0 THEN 'lider'
                ELSE 'lider_y_ejecutivo' END,
    'executive_id', v_exec,
    'kam_id', v_zona,
    'lineas_ec', to_jsonb(v_ec),
    'lineas_lider', to_jsonb(v_lider));
END;
$$;

-- El Ejecutivo Comercial de una visita: el de la persona si alguna de las líneas de la visita está en sus
-- executive_lines; si no, NULL (la visita es "como líder"). Espejo: ejecutivoDeLaVisita.
CREATE OR REPLACE FUNCTION public.ejecutivo_de_la_visita(p_user uuid, p_lineas uuid[])
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT e.id
  FROM public.executives e
  WHERE e.user_id = p_user AND e.status = 'active'
    AND EXISTS (SELECT 1 FROM public.executive_lines el
                WHERE el.executive_id = e.id AND el.line_id = ANY (coalesce(p_lineas, '{}'::uuid[])))
  LIMIT 1
$$;

-- C9: "médico de las líneas L" = con un visitante vigente en esa fecha en alguna línea de L, o cuyo visitante vigente
-- es un Ejecutivo Comercial activo con alguna línea de L. Espejo: medicoDeLineas.
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

-- Configuración de visitas de la persona en una fecha: con Ejecutivo Comercial, visitas_config_vigente (no se toca);
-- sin él (como líder), la general: perfil médica e institucional, radio y tope generales y telefónica deshabilitada.
-- (visitas_config_vigente con un id que ningún Ejecutivo Comercial tiene devuelve justo la general; el perfil y la
-- telefónica se fijan además aquí.)
CREATE OR REPLACE FUNCTION public.visitas_config_persona(p_executive uuid, p_fecha date)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  c_sin_persona constant uuid := '00000000-0000-0000-0000-000000000000';
BEGIN
  IF p_fecha IS NULL THEN
    RAISE EXCEPTION 'Falta la fecha de la configuración' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF p_executive IS NOT NULL THEN
    RETURN public.visitas_config_vigente(p_executive, p_fecha);
  END IF;
  RETURN jsonb_set(jsonb_set(public.visitas_config_vigente(c_sin_persona, p_fecha),
                             '{perfil}', '["medica", "institucional"]'::jsonb),
                   '{telefonica,habilitada}', 'false'::jsonb);
END;
$$;

-- El choque de media hora: la primera cita de la persona ese día, pendiente o hecha, con hora, a menos de 30 minutos
-- de p_hora (sin contar p_excluir), como { cita_id, hora, con_quien }; NULL si no hay. Las citas sin hora, las que no
-- se hicieron, las canceladas y las eliminadas no chocan. La misma regla que sePisan (mobile/lib/agenda.ts) y
-- agendaChoca (web/lib/agenda-ciclo.ts): 09:00 y 09:15 sí; 09:00 y 09:30 no.
CREATE OR REPLACE FUNCTION public.agenda_choque(p_user uuid, p_fecha date, p_hora time, p_excluir uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
           'cita_id', a.id,
           'hora', left(a.hora::text, 5),
           'con_quien', coalesce(m.nombre, c.nombre || coalesce(' · ' || si.nombre, ''), 'otra cita'))
  FROM public.visitas_agenda a
  LEFT JOIN public.medicos m ON m.id = a.medico_id
  LEFT JOIN public.cuentas c ON c.id = a.cuenta_id
  LEFT JOIN public.subtipos_institucionales si ON si.id = a.subtipo_id
  WHERE p_hora IS NOT NULL
    AND a.user_id = p_user
    AND a.fecha = p_fecha
    AND a.estado IN ('pendiente', 'hecha')
    AND a.hora IS NOT NULL
    AND (p_excluir IS NULL OR a.id <> p_excluir)
    AND abs(extract(epoch FROM (a.hora - p_hora))) < 1800
  ORDER BY a.hora, a.id
  LIMIT 1
$$;

-- -------------------------------------------------------------------------------------
-- 4. agenda_crear y agenda_cancelar (reemplazadas), agenda_cerrar, agenda_eliminar y agenda_otra_fecha (nuevas)
-- -------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.agenda_crear(p jsonb, p_user uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ahora    constant timestamp := now() AT TIME ZONE 'America/Bogota';
  v_hoy      constant date := (now() AT TIME ZONE 'America/Bogota')::date;
  v_fecha    date;
  v_hora     time;
  v_tipo     text;
  v_medico   uuid;
  v_cuenta   uuid;
  v_subtipo  uuid;
  v_sede     uuid;
  v_nota     text;
  v_como     text;
  v_viene_de uuid;
  v_persona  jsonb;
  v_exec     uuid;
  v_lider    uuid[];
  v_cfg      jsonb;
  v_s_cuenta uuid;
  v_s_activa boolean;
  v_c_activa boolean;
  v_origen   record;
  v_choque   jsonb;
  v_id       uuid;
BEGIN
  IF p IS NULL OR jsonb_typeof(p) <> 'object' THEN
    RAISE EXCEPTION 'Faltan los datos de la cita' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF p_user IS NULL THEN
    RAISE EXCEPTION 'Falta el usuario que agenda' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- 0. Forma (la API ya validó con zod; aquí se revisa otra vez para que la base no dependa de la API)
  BEGIN
    v_fecha    := nullif(btrim(p ->> 'fecha'), '')::date;
    v_hora     := nullif(btrim(p ->> 'hora'), '')::time;
    v_tipo     := nullif(btrim(p ->> 'tipo'), '');
    v_medico   := nullif(btrim(p ->> 'medico_id'), '')::uuid;
    v_cuenta   := nullif(btrim(p ->> 'cuenta_id'), '')::uuid;
    v_subtipo  := nullif(btrim(p ->> 'subtipo_id'), '')::uuid;
    v_sede     := nullif(btrim(p ->> 'sede_id'), '')::uuid;
    v_nota     := nullif(btrim(p ->> 'nota'), '');
    v_como     := nullif(btrim(p ->> 'como'), '');
    v_viene_de := nullif(btrim(p ->> 'viene_de'), '')::uuid;
  EXCEPTION
    WHEN invalid_text_representation OR invalid_datetime_format OR datetime_field_overflow THEN
      RAISE EXCEPTION 'Datos de la cita no válidos: %', SQLERRM USING ERRCODE = 'invalid_parameter_value';
  END;
  IF v_fecha IS NULL THEN
    RAISE EXCEPTION 'Elige la fecha de la cita' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF v_hora IS NULL THEN
    RAISE EXCEPTION 'Elige la hora de la cita' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF v_hora > time '23:59:59' THEN
    RAISE EXCEPTION 'Hora no válida: usa HH:MM (de 00:00 a 23:59)' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF v_tipo IS NULL OR v_tipo NOT IN ('medica', 'institucional') THEN
    RAISE EXCEPTION 'Tipo de visita no válido: medica o institucional' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF v_sede IS NULL THEN
    RAISE EXCEPTION 'Elige la sede' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF v_tipo = 'medica' AND v_medico IS NULL THEN
    RAISE EXCEPTION 'Elige el médico' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF v_tipo = 'institucional' AND v_cuenta IS NULL THEN
    RAISE EXCEPTION 'Elige la cuenta' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF v_tipo = 'institucional' AND v_subtipo IS NULL THEN
    RAISE EXCEPTION 'Elige el subtipo de la visita institucional' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF char_length(v_nota) > 300 THEN
    RAISE EXCEPTION 'La nota no puede superar 300 caracteres' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF v_como IS NOT NULL AND v_como NOT IN ('ejecutivo', 'lider') THEN
    RAISE EXCEPTION 'Como no válido: ejecutivo o lider' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  -- Solo lo que aplica al tipo
  IF v_tipo = 'medica' THEN
    v_cuenta := NULL; v_subtipo := NULL;
  ELSE
    v_medico := NULL;
  END IF;

  -- 1. Candado por persona (el mismo de las visitas y de la salida: agendar, cerrar, cancelar, vincular y cancelar por
  --    salida no se cruzan) y, ya con él, la persona (persona_de_campo: la directora, sin líneas o Ejecutivo Comercial
  --    sin zona → 23514). Leerla después del candado evita agendar para quien se está desactivando (A16).
  PERFORM pg_advisory_xact_lock(hashtext('visitas_app:' || p_user::text));
  v_persona := public.persona_de_campo(p_user);

  -- 2. Otra fecha (A7): la anterior es propia y está cerrada (no_realizada, cancelada no por salida, o hecha con una
  --    visita no efectiva), sin otra sucesora, y la nueva es con el mismo médico o la misma cuenta y subtipo.
  IF v_viene_de IS NOT NULL THEN
    SELECT a.id, a.user_id, a.estado, a.tipo, a.medico_id, a.cuenta_id, a.subtipo_id, a.motivo_codigo, a.visita_id
    INTO v_origen
    FROM public.visitas_agenda a
    WHERE a.id = v_viene_de
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Esa cita no existe' USING ERRCODE = 'no_data_found';
    END IF;
    IF v_origen.user_id IS DISTINCT FROM p_user OR v_origen.estado = 'eliminada' THEN
      RAISE EXCEPTION 'Esa cita no existe' USING ERRCODE = 'no_data_found';
    END IF;
    IF v_origen.estado = 'pendiente' THEN
      RAISE EXCEPTION 'Esa cita sigue programada: ciérrala o cancélala antes' USING ERRCODE = 'check_violation';
    END IF;
    IF v_origen.estado = 'cancelada' AND v_origen.motivo_codigo = 'salida' THEN
      RAISE EXCEPTION 'Esa cita se canceló por la salida de la persona: no tiene otra fecha' USING ERRCODE = 'check_violation';
    END IF;
    IF v_origen.estado = 'hecha' AND EXISTS (SELECT 1 FROM public.visits v WHERE v.id = v_origen.visita_id AND v.efectiva) THEN
      RAISE EXCEPTION 'Esa cita ya se hizo (visita efectiva): agenda una cita nueva' USING ERRCODE = 'check_violation';
    END IF;
    IF EXISTS (SELECT 1 FROM public.visitas_agenda s WHERE s.viene_de = v_viene_de AND s.estado <> 'eliminada') THEN
      RAISE EXCEPTION 'Esa cita ya tiene otra fecha' USING ERRCODE = 'unique_violation';
    END IF;
    IF v_origen.tipo IS DISTINCT FROM v_tipo OR v_origen.medico_id IS DISTINCT FROM v_medico
       OR v_origen.cuenta_id IS DISTINCT FROM v_cuenta OR v_origen.subtipo_id IS DISTINCT FROM v_subtipo THEN
      RAISE EXCEPTION 'La otra fecha debe ser con el mismo médico o la misma cuenta y subtipo' USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  -- 2b. "Como qué" (C12): como Ejecutivo Comercial, la cita lleva su executive_id; como líder, NULL. Por defecto, como
  --     Ejecutivo Comercial si lo tiene.
  v_lider := ARRAY(SELECT t.x::uuid FROM jsonb_array_elements_text(v_persona -> 'lineas_lider') AS t(x));
  v_como := coalesce(v_como, CASE WHEN v_persona ->> 'executive_id' IS NOT NULL THEN 'ejecutivo' ELSE 'lider' END);
  IF v_como = 'ejecutivo' THEN
    v_exec := (v_persona ->> 'executive_id')::uuid;
    IF v_exec IS NULL THEN
      RAISE EXCEPTION 'Tu usuario no está enlazado con un Ejecutivo Comercial' USING ERRCODE = 'check_violation';
    END IF;
  ELSIF cardinality(v_lider) = 0 THEN
    RAISE EXCEPTION 'No lideras ninguna línea: agenda como Ejecutivo Comercial' USING ERRCODE = 'check_violation';
  END IF;

  -- 3. Ventana: de hoy en adelante, sin tope (A4); hoy, no a una hora que ya pasó (C13); con Ejecutivo Comercial, no
  --    en un día libre aprobado de día completo (en F3, también por persona).
  IF v_fecha < v_hoy THEN
    RAISE EXCEPTION 'No se agenda en el pasado: elige hoy o una fecha posterior' USING ERRCODE = 'check_violation';
  END IF;
  IF v_fecha = v_hoy AND v_hora < date_trunc('minute', v_ahora)::time THEN
    RAISE EXCEPTION 'Esa hora ya pasó' USING ERRCODE = 'check_violation';
  END IF;
  IF v_exec IS NOT NULL AND EXISTS (SELECT 1 FROM public.dias_libres d
                                    WHERE d.executive_id = v_exec AND d.fecha = v_fecha
                                      AND d.estado IN ('registrado', 'aprobado') AND d.fraccion >= 1) THEN
    RAISE EXCEPTION 'Ese día lo tienes libre (día libre aprobado): no se agenda' USING ERRCODE = 'check_violation';
  END IF;

  -- 4. Perfil vigente en la fecha de la cita (como líder: la configuración general)
  v_cfg := public.visitas_config_persona(v_exec, v_fecha);
  IF NOT ((v_cfg -> 'perfil') ? v_tipo) THEN
    RAISE EXCEPTION '%', CASE WHEN v_tipo = 'medica' THEN 'Tu perfil no incluye visitas médicas'
                              ELSE 'Tu perfil no incluye visitas institucionales' END
      USING ERRCODE = 'check_violation';
  END IF;

  -- 5. Sede activa de una cuenta activa; médico activo que atiende ahí (como líder, además de sus líneas: C9), o sede
  --    de la cuenta y subtipo vigente
  SELECT s.cuenta_id, s.activo INTO v_s_cuenta, v_s_activa
  FROM public.sedes s
  WHERE s.id = v_sede;
  IF NOT FOUND OR NOT v_s_activa THEN
    RAISE EXCEPTION 'Esa sede no existe' USING ERRCODE = 'check_violation';
  END IF;
  SELECT c.activo INTO v_c_activa FROM public.cuentas c WHERE c.id = v_s_cuenta;
  IF NOT coalesce(v_c_activa, false) THEN
    RAISE EXCEPTION 'La cuenta de esa sede está inactiva' USING ERRCODE = 'check_violation';
  END IF;
  IF v_tipo = 'medica' THEN
    IF NOT EXISTS (SELECT 1 FROM public.medicos m WHERE m.id = v_medico AND m.activo) THEN
      RAISE EXCEPTION 'Ese médico no existe o está inactivo' USING ERRCODE = 'check_violation';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.medico_sedes ms WHERE ms.medico_id = v_medico AND ms.sede_id = v_sede) THEN
      RAISE EXCEPTION 'El médico no atiende en esa sede' USING ERRCODE = 'check_violation';
    END IF;
    IF v_exec IS NULL AND NOT public.medico_de_lineas(v_medico, v_lider, v_fecha) THEN
      RAISE EXCEPTION 'Ese médico no es de tus líneas' USING ERRCODE = 'check_violation';
    END IF;
  ELSE
    IF v_s_cuenta IS DISTINCT FROM v_cuenta THEN
      RAISE EXCEPTION 'Esa sede no es de la cuenta elegida' USING ERRCODE = 'check_violation';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.subtipos_institucionales si
                   WHERE si.id = v_subtipo AND si.vigente_desde <= v_fecha
                     AND (si.vigente_hasta IS NULL OR si.vigente_hasta >= v_fecha)) THEN
      RAISE EXCEPTION 'Ese subtipo no está vigente' USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  -- 6. Sin duplicados por persona entre pendientes y hechas: 23505 → 409 (los índices únicos son la última barrera)
  IF v_tipo = 'medica' AND EXISTS (
       SELECT 1 FROM public.visitas_agenda a
       WHERE a.user_id = p_user AND a.fecha = v_fecha AND a.tipo = 'medica' AND a.medico_id = v_medico
         AND a.estado IN ('pendiente', 'hecha')) THEN
    RAISE EXCEPTION 'Ya tienes una cita con ese médico ese día' USING ERRCODE = 'unique_violation';
  END IF;
  IF v_tipo = 'institucional' AND EXISTS (
       SELECT 1 FROM public.visitas_agenda a
       WHERE a.user_id = p_user AND a.fecha = v_fecha AND a.tipo = 'institucional' AND a.cuenta_id = v_cuenta
         AND a.subtipo_id = v_subtipo AND a.estado IN ('pendiente', 'hecha')) THEN
    RAISE EXCEPTION 'Ya tienes una cita con esa cuenta y ese subtipo ese día' USING ERRCODE = 'unique_violation';
  END IF;

  -- 7. Dos citas no se cruzan en su media hora (decisión del dueño 2026-10-15): 23P01 → 409 con el error en `hora`
  v_choque := public.agenda_choque(p_user, v_fecha, v_hora, NULL);
  IF v_choque IS NOT NULL THEN
    RAISE EXCEPTION 'A las % ya tienes cita con %: elige otra hora', v_choque ->> 'hora', v_choque ->> 'con_quien'
      USING ERRCODE = 'exclusion_violation';
  END IF;

  INSERT INTO public.visitas_agenda (user_id, executive_id, fecha, hora, tipo, medico_id, cuenta_id, subtipo_id, sede_id,
                                     nota, estado, viene_de, created_by)
  VALUES (p_user, v_exec, v_fecha, v_hora, v_tipo, v_medico, v_cuenta, v_subtipo, v_sede, v_nota, 'pendiente', v_viene_de,
          p_user)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('cita_id', v_id);
END;
$$;

-- La firma cambia (cuarto argumento con valor por defecto): DROP de la de 3 + CREATE en la misma transacción. La
-- llamada de hoy de la API (p_id, p_motivo, p_user por nombre) sigue valiendo y usa 'otro'.
DROP FUNCTION IF EXISTS public.agenda_cancelar(uuid, text, uuid);

CREATE OR REPLACE FUNCTION public.agenda_cancelar(p_id uuid, p_motivo text, p_user uuid, p_motivo_codigo text DEFAULT 'otro')
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_hoy    constant date := (now() AT TIME ZONE 'America/Bogota')::date;
  v_motivo constant text := nullif(btrim(p_motivo), '');
  v_codigo constant text := coalesce(nullif(btrim(p_motivo_codigo), ''), 'otro');
  v_cita   record;
BEGIN
  IF p_id IS NULL THEN
    RAISE EXCEPTION 'Falta la cita' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF p_user IS NULL THEN
    RAISE EXCEPTION 'Falta el usuario que cancela' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF v_codigo NOT IN ('cliente', 'prioridad', 'falta_tiempo', 'fuerza_mayor', 'otro', 'salida') THEN
    RAISE EXCEPTION 'Elige el motivo: cliente, prioridad, falta_tiempo, fuerza_mayor u otro' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF v_codigo = 'salida' THEN
    RAISE EXCEPTION 'El motivo "salida" lo pone el sistema' USING ERRCODE = 'check_violation';
  END IF;
  IF char_length(v_motivo) > 300 THEN
    RAISE EXCEPTION 'El motivo no puede superar 300 caracteres' USING ERRCODE = 'check_violation';
  END IF;
  IF v_codigo = 'otro' AND char_length(coalesce(v_motivo, '')) < 3 THEN
    RAISE EXCEPTION 'Escribe el motivo de la cancelación' USING ERRCODE = 'check_violation';
  END IF;

  PERFORM public.persona_de_campo(p_user);
  PERFORM pg_advisory_xact_lock(hashtext('visitas_app:' || p_user::text));
  SELECT a.id, a.user_id, a.estado, a.fecha INTO v_cita
  FROM public.visitas_agenda a
  WHERE a.id = p_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Esa cita no existe' USING ERRCODE = 'no_data_found';
  END IF;
  IF v_cita.user_id IS DISTINCT FROM p_user OR v_cita.estado = 'eliminada' THEN
    RAISE EXCEPTION 'Esa cita no existe' USING ERRCODE = 'no_data_found';
  END IF;
  IF v_cita.estado = 'cancelada' THEN
    RAISE EXCEPTION 'Esa cita ya está cancelada' USING ERRCODE = 'check_violation';
  END IF;
  IF v_cita.estado = 'hecha' THEN
    RAISE EXCEPTION 'Esa cita ya tiene su visita: no se cancela' USING ERRCODE = 'check_violation';
  END IF;
  IF v_cita.estado = 'no_realizada' THEN
    RAISE EXCEPTION 'Esa cita ya está cerrada' USING ERRCODE = 'check_violation';
  END IF;
  IF v_cita.fecha < v_hoy THEN
    RAISE EXCEPTION 'Solo se cancelan las citas de hoy en adelante' USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.visitas_agenda
  SET estado = 'cancelada', cancelada_at = now(), cancelada_motivo = v_motivo, motivo_codigo = v_codigo
  WHERE id = p_id;
END;
$$;

-- "No se hizo" (A7, C7): la cita propia y pendiente de su día o anterior, con motivo de la lista (sin 'salida'; con
-- 'otro', texto de 3 a 300). Devuelve { cita_id, estado }.
CREATE OR REPLACE FUNCTION public.agenda_cerrar(p_id uuid, p jsonb, p_user uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_hoy    constant date := (now() AT TIME ZONE 'America/Bogota')::date;
  v_codigo text;
  v_motivo text;
  v_cita   record;
BEGIN
  IF p_id IS NULL THEN
    RAISE EXCEPTION 'Falta la cita' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF p_user IS NULL THEN
    RAISE EXCEPTION 'Falta el usuario que cierra la cita' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF p IS NULL OR jsonb_typeof(p) <> 'object' THEN
    RAISE EXCEPTION 'Faltan los datos del cierre' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  v_codigo := nullif(btrim(p ->> 'motivo_codigo'), '');
  v_motivo := nullif(btrim(p ->> 'motivo'), '');
  IF v_codigo IS NULL OR v_codigo NOT IN ('cliente', 'prioridad', 'falta_tiempo', 'fuerza_mayor', 'otro', 'salida') THEN
    RAISE EXCEPTION 'Elige el motivo: cliente, prioridad, falta_tiempo, fuerza_mayor u otro' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF v_codigo = 'salida' THEN
    RAISE EXCEPTION 'El motivo "salida" lo pone el sistema' USING ERRCODE = 'check_violation';
  END IF;
  IF char_length(v_motivo) > 300 THEN
    RAISE EXCEPTION 'El motivo no puede superar 300 caracteres' USING ERRCODE = 'check_violation';
  END IF;
  IF v_codigo = 'otro' AND char_length(coalesce(v_motivo, '')) < 3 THEN
    RAISE EXCEPTION 'Escribe por qué no se hizo' USING ERRCODE = 'check_violation';
  END IF;

  PERFORM public.persona_de_campo(p_user);
  PERFORM pg_advisory_xact_lock(hashtext('visitas_app:' || p_user::text));
  SELECT a.id, a.user_id, a.estado, a.fecha INTO v_cita
  FROM public.visitas_agenda a
  WHERE a.id = p_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Esa cita no existe' USING ERRCODE = 'no_data_found';
  END IF;
  IF v_cita.user_id IS DISTINCT FROM p_user OR v_cita.estado = 'eliminada' THEN
    RAISE EXCEPTION 'Esa cita no existe' USING ERRCODE = 'no_data_found';
  END IF;
  IF v_cita.estado <> 'pendiente' THEN
    RAISE EXCEPTION 'Esa cita ya está cerrada' USING ERRCODE = 'check_violation';
  END IF;
  IF v_cita.fecha > v_hoy THEN
    RAISE EXCEPTION 'Esa cita todavía no llega: cancélala' USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.visitas_agenda
  SET estado = 'no_realizada', no_realizada_at = now(), no_realizada_motivo = v_motivo, motivo_codigo = v_codigo
  WHERE id = p_id;
  RETURN jsonb_build_object('cita_id', p_id, 'estado', 'no_realizada');
END;
$$;

-- Eliminar por error (C8): la cita propia, pendiente y de hoy en adelante. La fila se queda (estado eliminada, con
-- cuándo y quién) para auditoría; ninguna lectura ni indicador la cuenta. Devuelve { cita_id }.
CREATE OR REPLACE FUNCTION public.agenda_eliminar(p_id uuid, p_user uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_hoy  constant date := (now() AT TIME ZONE 'America/Bogota')::date;
  v_cita record;
BEGIN
  IF p_id IS NULL THEN
    RAISE EXCEPTION 'Falta la cita' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF p_user IS NULL THEN
    RAISE EXCEPTION 'Falta el usuario que elimina la cita' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  PERFORM public.persona_de_campo(p_user);
  PERFORM pg_advisory_xact_lock(hashtext('visitas_app:' || p_user::text));
  SELECT a.id, a.user_id, a.estado, a.fecha INTO v_cita
  FROM public.visitas_agenda a
  WHERE a.id = p_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Esa cita no existe' USING ERRCODE = 'no_data_found';
  END IF;
  IF v_cita.user_id IS DISTINCT FROM p_user OR v_cita.estado = 'eliminada' THEN
    RAISE EXCEPTION 'Esa cita no existe' USING ERRCODE = 'no_data_found';
  END IF;
  IF v_cita.estado <> 'pendiente' THEN
    RAISE EXCEPTION 'Solo se elimina una cita pendiente' USING ERRCODE = 'check_violation';
  END IF;
  IF v_cita.fecha < v_hoy THEN
    RAISE EXCEPTION 'Solo se eliminan las citas de hoy en adelante: ciérrala con "No se hizo"' USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.visitas_agenda
  SET estado = 'eliminada', eliminada_at = now(), eliminada_por = p_user
  WHERE id = p_id;
  RETURN jsonb_build_object('cita_id', p_id);
END;
$$;

-- Otra fecha (A7): una cita NUEVA con viene_de = la anterior; copia tipo, médico o cuenta, subtipo y sede (la sede y la
-- nota pueden cambiar), con la fecha y la hora nuevas y, por defecto, el mismo papel. Pasa por TODAS las reglas de
-- agenda_crear (que revisa también que la anterior esté cerrada y sin otra sucesora). Devuelve { cita_id, viene_de }.
CREATE OR REPLACE FUNCTION public.agenda_otra_fecha(p_id uuid, p jsonb, p_user uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_origen record;
  v_p      jsonb;
  v_r      jsonb;
BEGIN
  IF p_id IS NULL THEN
    RAISE EXCEPTION 'Falta la cita' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF p_user IS NULL THEN
    RAISE EXCEPTION 'Falta el usuario que agenda' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF p IS NULL OR jsonb_typeof(p) <> 'object' THEN
    RAISE EXCEPTION 'Faltan los datos de la otra fecha' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  SELECT a.user_id, a.estado, a.executive_id, a.tipo, a.medico_id, a.cuenta_id, a.subtipo_id, a.sede_id, a.nota
  INTO v_origen
  FROM public.visitas_agenda a
  WHERE a.id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Esa cita no existe' USING ERRCODE = 'no_data_found';
  END IF;
  IF v_origen.user_id IS DISTINCT FROM p_user OR v_origen.estado = 'eliminada' THEN
    RAISE EXCEPTION 'Esa cita no existe' USING ERRCODE = 'no_data_found';
  END IF;

  v_p := jsonb_build_object(
    'fecha', p -> 'fecha',
    'hora', p -> 'hora',
    'tipo', v_origen.tipo,
    'medico_id', v_origen.medico_id,
    'cuenta_id', v_origen.cuenta_id,
    'subtipo_id', v_origen.subtipo_id,
    'sede_id', CASE WHEN nullif(btrim(p ->> 'sede_id'), '') IS NULL THEN to_jsonb(v_origen.sede_id) ELSE p -> 'sede_id' END,
    'nota', CASE WHEN p ? 'nota' THEN p -> 'nota' ELSE to_jsonb(v_origen.nota) END,
    'como', coalesce(nullif(btrim(p ->> 'como'), ''), CASE WHEN v_origen.executive_id IS NULL THEN 'lider' ELSE 'ejecutivo' END),
    'viene_de', p_id);
  v_r := public.agenda_crear(v_p, p_user);
  RETURN jsonb_build_object('cita_id', v_r -> 'cita_id', 'viene_de', p_id);
END;
$$;

-- -------------------------------------------------------------------------------------
-- 5. visitas_registrar, visitas_editar y visitas_anular: la persona (user_id) en lugar del Ejecutivo Comercial
-- -------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.visitas_registrar(p jsonb, p_user uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  c_tolerancia   constant interval := interval '5 minutes';  -- reloj del teléfono (TOLERANCIA_RELOJ_SEGUNDOS)
  c_motivo_falla constant text := 'Indica el motivo de la visita no efectiva (hasta 300 caracteres)';
  v_hoy          constant date := (now() AT TIME ZONE 'America/Bogota')::date;
  v_client       uuid;
  v_exec_p       uuid;            -- 0850: el que manda la API (opcional; si viene, debe ser el de la persona)
  v_tipo         text;
  v_subtipo      uuid;
  v_medico       uuid;
  v_cuenta       uuid;
  v_sede         uuid;
  v_contacto     uuid;
  v_modalidad    text;
  v_medio        text;
  v_efectiva     boolean;
  v_failure      text;
  v_retry        date;
  v_checked      timestamptz;
  v_reported     timestamptz;
  v_lat          double precision;
  v_lng          double precision;
  v_precision    integer;
  v_conclusion   text;
  v_compromisos  text;
  v_next         date;
  v_transcript   text;
  v_input        text;
  v_lineas       uuid[];
  v_previa       record;
  v_persona      jsonb;           -- 0850: persona_de_campo(p_user)
  v_mis_lineas   uuid[];          -- 0850: persona_lineas(p_user)
  v_exec         uuid;            -- 0850: el Ejecutivo Comercial de la visita (NULL = como líder)
  v_e_nombre     text;
  v_e_zona       uuid;
  v_fecha        date;
  v_cfg          jsonb;
  v_s_cuenta     uuid;
  v_s_nombre     text;
  v_s_lat        numeric;
  v_s_lng        numeric;
  v_s_hospital   uuid;
  v_s_municipio  text;
  v_s_activa     boolean;
  v_c_activa     boolean;
  v_k_cuenta     uuid;
  v_k_activo     boolean;
  v_subtipo_cod  text;
  v_oot          boolean := false;
  v_dist         integer;
  v_radio        integer;
  v_tope         integer;
  v_medios       text;
  v_n            bigint;
  v_lat_mapa     numeric;
  v_lng_mapa     numeric;
  v_id           uuid;
  v_agenda       uuid;
  v_cita         record;
  v_agendada     boolean := false;
  v_relevo       uuid;
BEGIN
  IF p IS NULL OR jsonb_typeof(p) <> 'object' THEN
    RAISE EXCEPTION 'Faltan los datos de la visita' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF p_user IS NULL THEN
    RAISE EXCEPTION 'Falta el usuario que reporta' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- 0. Forma (la API ya validó con zod; aquí se revisa otra vez para que la base no dependa de la API)
  BEGIN
    v_client      := nullif(btrim(p ->> 'client_id'), '')::uuid;
    v_exec_p      := nullif(btrim(p ->> 'executive_id'), '')::uuid;
    v_tipo        := nullif(btrim(p ->> 'tipo'), '');
    v_subtipo     := nullif(btrim(p ->> 'subtipo_id'), '')::uuid;
    v_medico      := nullif(btrim(p ->> 'medico_id'), '')::uuid;
    v_cuenta      := nullif(btrim(p ->> 'cuenta_id'), '')::uuid;
    v_sede        := nullif(btrim(p ->> 'sede_id'), '')::uuid;
    v_contacto    := nullif(btrim(p ->> 'contacto_id'), '')::uuid;
    v_modalidad   := nullif(btrim(p ->> 'modalidad'), '');
    v_medio       := nullif(btrim(p ->> 'medio'), '');
    v_efectiva    := (p ->> 'efectiva')::boolean;
    v_failure     := nullif(btrim(p ->> 'failure_reason'), '');
    v_retry       := nullif(btrim(p ->> 'retry_date'), '')::date;
    v_checked     := nullif(btrim(p ->> 'checked_in_at'), '')::timestamptz;
    v_reported    := nullif(btrim(p ->> 'reported_at'), '')::timestamptz;
    v_lat         := nullif(btrim(p ->> 'lat'), '')::double precision;
    v_lng         := nullif(btrim(p ->> 'lng'), '')::double precision;
    v_precision   := round(nullif(btrim(p ->> 'gps_accuracy_m'), '')::numeric)::integer;
    v_conclusion  := nullif(btrim(p ->> 'conclusion'), '');
    v_compromisos := nullif(btrim(p ->> 'compromisos'), '');
    v_next        := nullif(btrim(p ->> 'next_step_date'), '')::date;
    v_transcript  := nullif(btrim(p ->> 'transcript'), '');
    v_input       := nullif(btrim(p ->> 'input_mode'), '');
    v_agenda      := nullif(btrim(p ->> 'agenda_id'), '')::uuid;
    IF jsonb_typeof(p -> 'lineas') = 'array' THEN
      v_lineas := ARRAY(SELECT DISTINCT t.x::uuid FROM jsonb_array_elements_text(p -> 'lineas') AS t(x));
    END IF;
  EXCEPTION
    WHEN invalid_text_representation OR invalid_datetime_format OR datetime_field_overflow
         OR numeric_value_out_of_range OR invalid_parameter_value THEN
      RAISE EXCEPTION 'Datos de la visita no válidos: %', SQLERRM USING ERRCODE = 'invalid_parameter_value';
  END;

  IF v_client IS NULL THEN
    RAISE EXCEPTION 'Falta el client_id de la visita (uuid que genera la app)' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF v_tipo IS NULL OR v_tipo NOT IN ('medica', 'institucional') THEN
    RAISE EXCEPTION 'Tipo de visita no válido: medica o institucional' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF v_sede IS NULL THEN
    RAISE EXCEPTION 'Elige la sede' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF v_modalidad IS NULL OR v_modalidad NOT IN ('presencial', 'telefonica') THEN
    RAISE EXCEPTION 'Modalidad no válida: presencial o telefonica' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF v_efectiva IS NULL THEN
    RAISE EXCEPTION 'Indica si la visita fue efectiva (sí o no)' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF v_checked IS NULL THEN
    RAISE EXCEPTION 'Falta la hora de llegada' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF v_reported IS NULL THEN
    RAISE EXCEPTION 'Falta la hora del reporte' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF v_input IS NULL OR v_input NOT IN ('voz', 'toques') THEN
    RAISE EXCEPTION 'Modo de entrada no válido: voz o toques' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF v_lineas IS NULL THEN
    RAISE EXCEPTION 'Elige al menos una línea' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF array_position(v_lineas, NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'Línea no válida' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF cardinality(v_lineas) > 10 THEN
    RAISE EXCEPTION 'Como máximo 10 líneas por visita' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF (v_lat IS NULL) <> (v_lng IS NULL) THEN
    RAISE EXCEPTION 'Manda latitud y longitud juntas' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF v_lat IS NOT NULL AND (v_lat NOT BETWEEN -90 AND 90 OR v_lng NOT BETWEEN -180 AND 180) THEN
    RAISE EXCEPTION 'Ubicación del teléfono no válida' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF v_precision IS NOT NULL AND v_precision < 0 THEN
    RAISE EXCEPTION 'Precisión del GPS no válida' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF v_tipo = 'medica' AND v_medico IS NULL THEN
    RAISE EXCEPTION 'Elige el médico' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF v_tipo = 'institucional' AND v_cuenta IS NULL THEN
    RAISE EXCEPTION 'Elige la cuenta' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF v_tipo = 'institucional' AND v_subtipo IS NULL THEN
    RAISE EXCEPTION 'Elige el subtipo de la visita institucional' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF v_modalidad = 'telefonica' AND v_medio IS NULL THEN
    RAISE EXCEPTION 'Indica el medio: llamada o videollamada' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF char_length(v_failure) > 300 THEN
    RAISE EXCEPTION 'El motivo de la visita no efectiva no puede superar 300 caracteres' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF char_length(v_conclusion) > 2000 THEN
    RAISE EXCEPTION 'La conclusión no puede superar 2000 caracteres' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF char_length(v_compromisos) > 2000 THEN
    RAISE EXCEPTION 'Los compromisos no pueden superar 2000 caracteres' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF char_length(v_transcript) > 8000 THEN
    RAISE EXCEPTION 'La transcripción no puede superar 8000 caracteres' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- Solo lo que aplica al tipo, a la modalidad y al resultado (como normalizarVisita de la web).
  IF v_tipo = 'medica' THEN
    v_cuenta := NULL; v_subtipo := NULL; v_contacto := NULL;
  ELSE
    v_medico := NULL;
  END IF;
  IF v_modalidad = 'presencial' THEN
    v_medio := NULL;
  ELSE
    -- Telefónica: la ubicación del teléfono no se usa ni se guarda (privacidad; el punto del mapa sale de la sede).
    v_lat := NULL; v_lng := NULL; v_precision := NULL;
  END IF;
  IF v_efectiva THEN
    v_failure := NULL; v_retry := NULL;
  ELSIF v_failure IS NULL THEN
    RAISE EXCEPTION '%', c_motivo_falla USING ERRCODE = 'check_violation';
  END IF;

  -- 1. Candado por persona e idempotencia por client_id (0850: por user_id)
  PERFORM pg_advisory_xact_lock(hashtext('visitas_app:' || p_user::text));
  SELECT v.id, v.user_id, v.out_of_territory, v.distance_m, v.visit_date, v.agenda_id, v.agendada
  INTO v_previa
  FROM public.visits v
  WHERE v.client_id = v_client;
  IF FOUND THEN
    IF v_previa.user_id IS DISTINCT FROM p_user THEN
      RAISE EXCEPTION 'Ese client_id ya se usó en otra visita' USING ERRCODE = 'unique_violation';
    END IF;
    RETURN jsonb_build_object('visita_id', v_previa.id, 'repetida', true,
                              'out_of_territory', v_previa.out_of_territory,
                              'distance_m', v_previa.distance_m, 'visit_date', v_previa.visit_date,
                              'agenda_id', v_previa.agenda_id, 'agendada', v_previa.agendada);
  END IF;

  -- 2. Persona de campo (0850): la directora, sin líneas o Ejecutivo Comercial sin zona → 23514. Las líneas, todas
  --    suyas. El Ejecutivo Comercial de la visita: el suyo si alguna línea es suya como Ejecutivo Comercial; si no, la
  --    visita es "como líder" (sin zona; kam_name = su nombre). Mismo día (Bogotá) y horas coherentes.
  v_persona := public.persona_de_campo(p_user);
  IF v_exec_p IS NOT NULL AND v_exec_p IS DISTINCT FROM (v_persona ->> 'executive_id')::uuid THEN
    RAISE EXCEPTION 'Ese Ejecutivo Comercial no es el tuyo' USING ERRCODE = 'check_violation';
  END IF;
  IF cardinality(v_lineas) = 0 THEN
    RAISE EXCEPTION 'Elige al menos una línea' USING ERRCODE = 'check_violation';
  END IF;
  v_mis_lineas := public.persona_lineas(p_user);
  IF EXISTS (SELECT 1 FROM unnest(v_lineas) AS l(id) WHERE l.id <> ALL (v_mis_lineas)) THEN
    RAISE EXCEPTION 'Alguna de las líneas no es tuya' USING ERRCODE = 'check_violation';
  END IF;
  v_exec := public.ejecutivo_de_la_visita(p_user, v_lineas);
  IF v_exec IS NOT NULL THEN
    SELECT e.full_name, e.base_kam_id INTO v_e_nombre, v_e_zona
    FROM public.executives e
    WHERE e.id = v_exec;
    IF v_e_zona IS NULL THEN
      RAISE EXCEPTION 'Tu Ejecutivo Comercial no tiene zona base' USING ERRCODE = 'check_violation';
    END IF;
  ELSE
    v_e_nombre := v_persona ->> 'nombre';
  END IF;
  v_fecha := (v_checked AT TIME ZONE 'America/Bogota')::date;
  IF v_fecha IS DISTINCT FROM v_hoy THEN
    RAISE EXCEPTION 'Solo se reportan visitas del mismo día' USING ERRCODE = 'check_violation';
  END IF;
  IF v_checked > now() + c_tolerancia THEN
    RAISE EXCEPTION 'La hora de llegada está en el futuro' USING ERRCODE = 'check_violation';
  END IF;
  IF v_reported < v_checked THEN
    RAISE EXCEPTION 'La hora del reporte no puede ser anterior a la de llegada' USING ERRCODE = 'check_violation';
  END IF;
  IF v_reported > now() + c_tolerancia THEN
    RAISE EXCEPTION 'La hora del reporte está en el futuro' USING ERRCODE = 'check_violation';
  END IF;
  IF v_next IS NOT NULL AND v_next < v_fecha THEN
    RAISE EXCEPTION 'La próxima reunión no puede ser anterior a la fecha de la visita' USING ERRCODE = 'check_violation';
  END IF;
  IF v_retry IS NOT NULL AND v_retry < v_fecha THEN
    RAISE EXCEPTION 'La fecha para reintentar no puede ser anterior a la fecha de la visita' USING ERRCODE = 'check_violation';
  END IF;

  -- 3. Perfil vigente en la fecha (como líder: la configuración general, sin telefónica)
  v_cfg := public.visitas_config_persona(v_exec, v_fecha);
  IF NOT ((v_cfg -> 'perfil') ? v_tipo) THEN
    RAISE EXCEPTION '%', CASE WHEN v_tipo = 'medica' THEN 'Tu perfil no incluye visitas médicas'
                              ELSE 'Tu perfil no incluye visitas institucionales' END
      USING ERRCODE = 'check_violation';
  END IF;

  -- 4. Sede; médica o institucional
  SELECT s.cuenta_id, s.nombre, s.lat, s.lng, s.hospital_id, s.municipality_id, s.activo
  INTO v_s_cuenta, v_s_nombre, v_s_lat, v_s_lng, v_s_hospital, v_s_municipio, v_s_activa
  FROM public.sedes s
  WHERE s.id = v_sede;
  IF NOT FOUND OR NOT v_s_activa THEN
    RAISE EXCEPTION 'Esa sede no existe' USING ERRCODE = 'check_violation';
  END IF;
  SELECT c.activo INTO v_c_activa FROM public.cuentas c WHERE c.id = v_s_cuenta;
  IF NOT coalesce(v_c_activa, false) THEN
    RAISE EXCEPTION 'La cuenta de esa sede está inactiva' USING ERRCODE = 'check_violation';
  END IF;

  IF v_tipo = 'medica' THEN
    IF NOT EXISTS (SELECT 1 FROM public.medicos m WHERE m.id = v_medico AND m.activo) THEN
      RAISE EXCEPTION 'Ese médico no existe o está inactivo' USING ERRCODE = 'check_violation';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.medico_sedes ms WHERE ms.medico_id = v_medico AND ms.sede_id = v_sede) THEN
      RAISE EXCEPTION 'El médico no atiende en esa sede' USING ERRCODE = 'check_violation';
    END IF;
    IF v_exec IS NULL THEN
      -- Como líder (C9): solo médicos de las líneas de la visita; nunca fuera de territorio.
      IF NOT public.medico_de_lineas(v_medico, v_lineas, v_fecha) THEN
        RAISE EXCEPTION 'Ese médico no es de tus líneas' USING ERRCODE = 'check_violation';
      END IF;
    ELSE
      v_oot := NOT EXISTS (SELECT 1 FROM public.medico_visitantes mv
                           WHERE mv.medico_id = v_medico AND mv.executive_id = v_exec
                             AND mv.desde <= v_fecha AND (mv.hasta IS NULL OR mv.hasta >= v_fecha));
    END IF;
  ELSE
    IF v_s_cuenta IS DISTINCT FROM v_cuenta THEN
      RAISE EXCEPTION 'Esa sede no es de la cuenta elegida' USING ERRCODE = 'check_violation';
    END IF;
    SELECT si.codigo INTO v_subtipo_cod
    FROM public.subtipos_institucionales si
    WHERE si.id = v_subtipo AND si.vigente_desde <= v_fecha AND (si.vigente_hasta IS NULL OR si.vigente_hasta >= v_fecha);
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Ese subtipo no está vigente' USING ERRCODE = 'check_violation';
    END IF;
    IF v_contacto IS NOT NULL THEN
      SELECT c.cuenta_id, c.activo INTO v_k_cuenta, v_k_activo FROM public.contactos c WHERE c.id = v_contacto;
      IF NOT FOUND OR v_k_cuenta IS DISTINCT FROM v_cuenta THEN
        RAISE EXCEPTION 'Ese contacto no es de la cuenta elegida' USING ERRCODE = 'check_violation';
      END IF;
      IF NOT coalesce(v_k_activo, false) THEN
        RAISE EXCEPTION 'Ese contacto está inactivo' USING ERRCODE = 'check_violation';
      END IF;
    END IF;
  END IF;

  -- 5. Presencial (radio con Haversine contra la sede) o telefónica (habilitada, medio, tope del día por persona)
  IF v_modalidad = 'presencial' THEN
    IF v_lat IS NULL THEN
      RAISE EXCEPTION 'La ubicación del teléfono es obligatoria en una visita presencial' USING ERRCODE = 'check_violation';
    END IF;
    IF v_s_lat IS NULL OR v_s_lng IS NULL THEN
      RAISE EXCEPTION 'Esta sede no tiene ubicación: confírmala o crea la sede' USING ERRCODE = 'check_violation';
    END IF;
    v_dist  := public.visitas_distancia_m(v_lat, v_lng, v_s_lat::double precision, v_s_lng::double precision);
    v_radio := (v_cfg ->> 'radio_m')::integer;
    IF v_dist > v_radio THEN
      RAISE EXCEPTION 'Estás a % m de %; el radio es % m', v_dist, v_s_nombre, v_radio USING ERRCODE = 'check_violation';
    END IF;
  ELSE
    IF NOT coalesce((v_cfg #>> '{telefonica,habilitada}')::boolean, false) THEN
      RAISE EXCEPTION 'No tienes habilitada la visita telefónica' USING ERRCODE = 'check_violation';
    END IF;
    IF NOT coalesce((v_cfg #> '{telefonica,medios}') ? v_medio, false) THEN
      SELECT string_agg(t.x, ' o ' ORDER BY t.o) INTO v_medios
      FROM jsonb_array_elements_text(v_cfg #> '{telefonica,medios}') WITH ORDINALITY AS t(x, o);
      RAISE EXCEPTION '%', CASE WHEN v_medios IS NULL THEN 'No tienes medios habilitados para la visita telefónica'
                                ELSE 'Medio no válido: ' || v_medios END
        USING ERRCODE = 'check_violation';
    END IF;
    v_tope := (v_cfg #>> '{telefonica,tope_dia}')::integer;
    SELECT count(*) INTO v_n
    FROM public.visits v
    WHERE v.source = 'app' AND v.user_id = p_user AND v.visit_date = v_fecha
      AND v.modalidad = 'telefonica' AND v.efectiva AND v.deleted_at IS NULL;
    IF v_n >= v_tope THEN
      RAISE EXCEPTION '%', CASE WHEN v_tope = 1 THEN 'Ya reportaste tu visita telefónica de hoy'
                                ELSE format('Ya reportaste las %s visitas telefónicas de hoy', v_tope) END
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  -- 6. Tope por médico, por persona (solo si suma: efectiva; presencial y telefónica cuentan igual)
  IF v_tipo = 'medica' AND v_efectiva THEN
    SELECT count(*) INTO v_n
    FROM public.visits v
    WHERE v.source = 'app' AND v.user_id = p_user AND v.visit_date = v_fecha
      AND v.medico_id = v_medico AND v.efectiva AND v.deleted_at IS NULL;
    IF v_n >= (v_cfg ->> 'tope_visitas_medico_dia')::integer THEN
      RAISE EXCEPTION 'Ya reportaste una visita a este médico hoy' USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  -- 7b. Agenda (0840, decisiones 6 y 7; 0850: por persona y con el mismo papel): la cita que trae la visita o, si no
  --     trae, la pendiente suya de ese día, del mismo papel (C12) y del mismo tipo con el mismo médico (institucional:
  --     la misma cuenta, prefiriendo el mismo subtipo; entre varias, la de hora más temprana —sin hora al final—, la
  --     creada primero y por id). La no efectiva también cumple la cita; una EFECTIVA suya posterior de ese día la toma
  --     (relevo). agendada = la cita se creó ANTES del día de la visita en Bogotá.
  IF v_agenda IS NOT NULL THEN
    SELECT a.id, a.user_id, a.executive_id, a.fecha, a.tipo, a.medico_id, a.cuenta_id, a.estado, a.created_at, a.visita_id
    INTO v_cita
    FROM public.visitas_agenda a
    WHERE a.id = v_agenda
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Esa cita no existe o no es tuya' USING ERRCODE = 'check_violation';
    END IF;
    IF v_cita.user_id IS DISTINCT FROM p_user OR v_cita.estado = 'eliminada' THEN
      RAISE EXCEPTION 'Esa cita no existe o no es tuya' USING ERRCODE = 'check_violation';
    END IF;
    IF v_cita.estado = 'cancelada' THEN
      RAISE EXCEPTION 'Esa cita está cancelada' USING ERRCODE = 'check_violation';
    END IF;
    IF v_cita.estado = 'no_realizada' THEN
      RAISE EXCEPTION 'Esa cita ya está cerrada' USING ERRCODE = 'check_violation';
    END IF;
    IF v_cita.estado = 'hecha' THEN
      -- Relevo: solo una efectiva toma la cita, y solo si la cumplió una no efectiva suya no anulada.
      IF NOT v_efectiva OR NOT EXISTS (SELECT 1 FROM public.visits v
                                       WHERE v.id = v_cita.visita_id AND v.source = 'app' AND v.user_id = p_user
                                         AND v.deleted_at IS NULL AND NOT v.efectiva) THEN
        RAISE EXCEPTION 'Esa cita ya tiene su visita' USING ERRCODE = 'check_violation';
      END IF;
      v_relevo := v_cita.visita_id;
    END IF;
    IF v_cita.fecha IS DISTINCT FROM v_fecha THEN
      RAISE EXCEPTION 'Esa cita es de otro día' USING ERRCODE = 'check_violation';
    END IF;
    IF v_cita.tipo IS DISTINCT FROM v_tipo THEN
      RAISE EXCEPTION 'Esa cita es de otro tipo de visita' USING ERRCODE = 'check_violation';
    END IF;
    IF v_tipo = 'medica' AND v_cita.medico_id IS DISTINCT FROM v_medico THEN
      RAISE EXCEPTION 'Esa cita es con otro médico' USING ERRCODE = 'check_violation';
    END IF;
    IF v_tipo = 'institucional' AND v_cita.cuenta_id IS DISTINCT FROM v_cuenta THEN
      RAISE EXCEPTION 'Esa cita es con otra cuenta' USING ERRCODE = 'check_violation';
    END IF;
    IF v_cita.executive_id IS DISTINCT FROM v_exec THEN
      RAISE EXCEPTION 'Esa cita es de tu otro papel (como líder o como Ejecutivo Comercial)' USING ERRCODE = 'check_violation';
    END IF;
    v_agendada := (v_cita.created_at AT TIME ZONE 'America/Bogota')::date < v_fecha;
  ELSE
    SELECT a.id, a.created_at, a.estado, a.visita_id
    INTO v_cita
    FROM public.visitas_agenda a
    WHERE a.user_id = p_user AND a.executive_id IS NOT DISTINCT FROM v_exec AND a.fecha = v_fecha AND a.tipo = v_tipo
      AND CASE WHEN v_tipo = 'medica' THEN a.medico_id = v_medico ELSE a.cuenta_id = v_cuenta END
      AND (a.estado = 'pendiente'
           OR (v_efectiva AND a.estado = 'hecha'
               AND EXISTS (SELECT 1 FROM public.visits v
                           WHERE v.id = a.visita_id AND v.source = 'app' AND v.user_id = p_user
                             AND v.deleted_at IS NULL AND NOT v.efectiva)))
    ORDER BY (a.subtipo_id IS NOT DISTINCT FROM v_subtipo) DESC, (a.estado = 'pendiente') DESC, a.hora NULLS LAST,
             a.created_at, a.id
    LIMIT 1
    FOR UPDATE;
    IF FOUND THEN
      v_agenda   := v_cita.id;
      v_agendada := (v_cita.created_at AT TIME ZONE 'America/Bogota')::date < v_fecha;
      IF v_cita.estado = 'hecha' THEN
        v_relevo := v_cita.visita_id;
      END IF;
    END IF;
  END IF;

  -- 8. Punto del mapa de calor (visits.lat/lng son NOT NULL). Telefónica: la sede, su municipio o la zona; nunca el
  --    teléfono (v_lat ya es NULL en una telefónica). Como líder no hay telefónica (configuración general).
  IF v_modalidad = 'presencial' THEN
    v_lat_mapa := round(v_lat::numeric, 6);
    v_lng_mapa := round(v_lng::numeric, 6);
  ELSIF v_s_lat IS NOT NULL AND v_s_lng IS NOT NULL THEN
    v_lat_mapa := v_s_lat;
    v_lng_mapa := v_s_lng;
  ELSE
    SELECT round(m.lat, 6), round(m.lng, 6) INTO v_lat_mapa, v_lng_mapa
    FROM public.municipalities m
    WHERE m.code = v_s_municipio AND m.lat IS NOT NULL AND m.lng IS NOT NULL;
    IF v_lat_mapa IS NULL AND v_e_zona IS NOT NULL THEN
      SELECT round(k.lat, 6), round(k.lng, 6) INTO v_lat_mapa, v_lng_mapa FROM public.kams k WHERE k.id = v_e_zona;
    END IF;
  END IF;

  -- En un relevo la no efectiva suelta la cita antes (una cita la cumple a lo sumo una visita no anulada).
  IF v_relevo IS NOT NULL THEN
    UPDATE public.visits SET agenda_id = NULL, agendada = false WHERE id = v_relevo;
  END IF;

  INSERT INTO public.visits (
    kam_id, kam_name, visit_type, contact_type, lat, lng, visit_date, hospital_id,
    imported_by, imported_at, import_id,
    source, user_id, executive_id, client_id, tipo, subtipo_id, subtipo_codigo, medico_id, cuenta_id, sede_id, contacto_id,
    modalidad, medio, efectiva, failure_reason, retry_date, checked_in_at, reported_at, distance_m, gps_accuracy_m,
    conclusion, compromisos, next_step_date, transcript, input_mode, out_of_territory, created_by, updated_by,
    agenda_id, agendada)
  VALUES (
    v_e_zona, left(v_e_nombre, 255),
    CASE WHEN v_efectiva THEN 'Visita efectiva' ELSE 'Visita no efectiva' END,
    CASE WHEN v_modalidad = 'presencial' THEN 'Visita presencial' ELSE 'Visita virtual' END,
    v_lat_mapa, v_lng_mapa, v_fecha, v_s_hospital,
    NULL, NULL, NULL,
    'app', p_user, v_exec, v_client, v_tipo, v_subtipo, v_subtipo_cod, v_medico, v_cuenta, v_sede, v_contacto,
    v_modalidad, v_medio, v_efectiva, v_failure, v_retry, v_checked, v_reported, v_dist, v_precision,
    v_conclusion, v_compromisos, v_next, v_transcript, v_input, v_oot, p_user, p_user,
    v_agenda, v_agendada)
  RETURNING id INTO v_id;

  INSERT INTO public.visit_lines (visit_id, line_id)
  SELECT v_id, l.id FROM unnest(v_lineas) AS l(id);

  IF v_agenda IS NOT NULL THEN
    UPDATE public.visitas_agenda SET estado = 'hecha', visita_id = v_id WHERE id = v_agenda;
  END IF;

  RETURN jsonb_build_object('visita_id', v_id, 'repetida', false, 'out_of_territory', v_oot,
                            'distance_m', v_dist, 'visit_date', v_fecha,
                            'agenda_id', v_agenda, 'agendada', v_agendada);
END;
$$;

CREATE OR REPLACE FUNCTION public.visitas_editar(p_id uuid, p jsonb, p_user uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  c_editables     constant text[] := ARRAY['conclusion', 'compromisos', 'next_step_date', 'efectiva',
                                           'failure_reason', 'retry_date', 'lineas'];
  c_no_editable   constant text := 'Solo puedes corregir o anular tus visitas del mismo día';
  c_motivo_falla  constant text := 'Indica el motivo de la visita no efectiva (hasta 300 caracteres)';
  v_hoy           constant date := (now() AT TIME ZONE 'America/Bogota')::date;
  v_ajenas        text;
  v_efectiva_p    boolean;
  v_retry_p       date;
  v_next_p        date;
  v_lineas        uuid[];
  v_v             record;
  v_efectiva      boolean;
  v_failure       text;
  v_retry         date;
  v_conclusion    text;
  v_compromisos   text;
  v_next          date;
  v_cfg           jsonb;
  v_tope          integer;
  v_n             bigint;
BEGIN
  IF p_id IS NULL THEN
    RAISE EXCEPTION 'Falta la visita' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF p IS NULL OR jsonb_typeof(p) <> 'object' THEN
    RAISE EXCEPTION 'Faltan los datos de la corrección' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF p_user IS NULL THEN
    RAISE EXCEPTION 'Falta el usuario que corrige' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  SELECT string_agg(t.k, ', ' ORDER BY t.k) INTO v_ajenas
  FROM jsonb_object_keys(p) AS t(k)
  WHERE t.k <> 'executive_id' AND t.k <> ALL (c_editables);
  IF v_ajenas IS NOT NULL THEN
    RAISE EXCEPTION 'Solo se corrigen la conclusión, los compromisos, la próxima reunión, si fue efectiva (con su motivo) y las líneas; para cambiar el tipo, el médico, la cuenta o la sede, anula la visita y repórtala de nuevo (%)',
      v_ajenas USING ERRCODE = 'check_violation';
  END IF;
  IF NOT (p ?| c_editables) THEN
    RAISE EXCEPTION 'No hay campos para corregir' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  BEGIN
    -- executive_id: la API de la 0830 lo mandaba; desde la 0850 se acepta y no se usa (la visita es de quien la
    -- reportó: user_id).
    PERFORM nullif(btrim(p ->> 'executive_id'), '')::uuid;
    v_efectiva_p := (p ->> 'efectiva')::boolean;
    v_retry_p    := nullif(btrim(p ->> 'retry_date'), '')::date;
    v_next_p     := nullif(btrim(p ->> 'next_step_date'), '')::date;
    IF p ? 'lineas' THEN
      IF jsonb_typeof(p -> 'lineas') IS DISTINCT FROM 'array' THEN
        RAISE EXCEPTION 'Elige al menos una línea' USING ERRCODE = 'invalid_parameter_value';
      END IF;
      v_lineas := ARRAY(SELECT DISTINCT t.x::uuid FROM jsonb_array_elements_text(p -> 'lineas') AS t(x));
    END IF;
  EXCEPTION
    WHEN invalid_text_representation OR invalid_datetime_format OR datetime_field_overflow THEN
      RAISE EXCEPTION 'Datos de la corrección no válidos: %', SQLERRM USING ERRCODE = 'invalid_parameter_value';
  END;
  IF p ? 'efectiva' AND v_efectiva_p IS NULL THEN
    RAISE EXCEPTION 'Indica si la visita fue efectiva (sí o no)' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF v_lineas IS NOT NULL AND (array_position(v_lineas, NULL) IS NOT NULL OR cardinality(v_lineas) > 10) THEN
    RAISE EXCEPTION 'Líneas no válidas (de 1 a 10)' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('visitas_app:' || p_user::text));
  SELECT v.id, v.source, v.user_id, v.executive_id, v.deleted_at, v.visit_date, v.tipo, v.medico_id, v.modalidad,
         v.efectiva, v.failure_reason, v.retry_date, v.conclusion, v.compromisos, v.next_step_date
  INTO v_v
  FROM public.visits v
  WHERE v.id = p_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Esa visita no existe' USING ERRCODE = 'no_data_found';
  END IF;
  IF v_v.source IS DISTINCT FROM 'app' THEN
    RAISE EXCEPTION '%', c_no_editable USING ERRCODE = 'check_violation';
  END IF;
  IF v_v.user_id IS DISTINCT FROM p_user THEN
    RAISE EXCEPTION 'Esa visita no existe' USING ERRCODE = 'no_data_found';
  END IF;
  IF v_v.deleted_at IS NOT NULL OR v_v.visit_date IS DISTINCT FROM v_hoy THEN
    RAISE EXCEPTION '%', c_no_editable USING ERRCODE = 'check_violation';
  END IF;
  PERFORM public.persona_de_campo(p_user);

  -- Valores nuevos: clave presente = cambia; ausente = queda como estaba
  v_efectiva    := CASE WHEN p ? 'efectiva' THEN v_efectiva_p ELSE v_v.efectiva END;
  v_conclusion  := CASE WHEN p ? 'conclusion' THEN nullif(btrim(p ->> 'conclusion'), '') ELSE v_v.conclusion END;
  v_compromisos := CASE WHEN p ? 'compromisos' THEN nullif(btrim(p ->> 'compromisos'), '') ELSE v_v.compromisos END;
  v_next        := CASE WHEN p ? 'next_step_date' THEN v_next_p ELSE v_v.next_step_date END;
  IF v_efectiva THEN
    v_failure := NULL;
    v_retry   := NULL;
  ELSE
    v_failure := CASE WHEN p ? 'failure_reason' THEN nullif(btrim(p ->> 'failure_reason'), '') ELSE v_v.failure_reason END;
    v_retry   := CASE WHEN p ? 'retry_date' THEN v_retry_p ELSE v_v.retry_date END;
    IF v_failure IS NULL THEN
      RAISE EXCEPTION '%', c_motivo_falla USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  IF char_length(v_failure) > 300 THEN
    RAISE EXCEPTION 'El motivo de la visita no efectiva no puede superar 300 caracteres' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF char_length(v_conclusion) > 2000 THEN
    RAISE EXCEPTION 'La conclusión no puede superar 2000 caracteres' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF char_length(v_compromisos) > 2000 THEN
    RAISE EXCEPTION 'Los compromisos no pueden superar 2000 caracteres' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF v_next IS NOT NULL AND v_next < v_v.visit_date THEN
    RAISE EXCEPTION 'La próxima reunión no puede ser anterior a la fecha de la visita' USING ERRCODE = 'check_violation';
  END IF;
  IF v_retry IS NOT NULL AND v_retry < v_v.visit_date THEN
    RAISE EXCEPTION 'La fecha para reintentar no puede ser anterior a la fecha de la visita' USING ERRCODE = 'check_violation';
  END IF;

  -- Pasar a efectiva: la cita que cumplió no debe tener otra fecha (A7: una hecha efectiva no tiene sucesora); luego
  -- vuelve a mirar los topes de la persona (sin contarse a sí misma)
  IF v_efectiva AND NOT v_v.efectiva THEN
    IF EXISTS (SELECT 1 FROM public.visitas_agenda a JOIN public.visitas_agenda s ON s.viene_de = a.id
               WHERE a.visita_id = p_id AND a.estado = 'hecha' AND s.estado <> 'eliminada') THEN
      RAISE EXCEPTION 'La cita de esta visita ya tiene otra fecha: elimina primero esa otra fecha' USING ERRCODE = 'check_violation';
    END IF;
    v_cfg := public.visitas_config_persona(v_v.executive_id, v_v.visit_date);
    IF v_v.tipo = 'medica' THEN
      SELECT count(*) INTO v_n
      FROM public.visits v
      WHERE v.source = 'app' AND v.user_id = p_user AND v.visit_date = v_v.visit_date
        AND v.medico_id = v_v.medico_id AND v.efectiva AND v.deleted_at IS NULL AND v.id <> p_id;
      IF v_n >= (v_cfg ->> 'tope_visitas_medico_dia')::integer THEN
        RAISE EXCEPTION 'Ya reportaste una visita a este médico hoy' USING ERRCODE = 'check_violation';
      END IF;
    END IF;
    IF v_v.modalidad = 'telefonica' THEN
      v_tope := (v_cfg #>> '{telefonica,tope_dia}')::integer;
      SELECT count(*) INTO v_n
      FROM public.visits v
      WHERE v.source = 'app' AND v.user_id = p_user AND v.visit_date = v_v.visit_date
        AND v.modalidad = 'telefonica' AND v.efectiva AND v.deleted_at IS NULL AND v.id <> p_id;
      IF v_n >= v_tope THEN
        RAISE EXCEPTION '%', CASE WHEN v_tope = 1 THEN 'Ya reportaste tu visita telefónica de hoy'
                                  ELSE format('Ya reportaste las %s visitas telefónicas de hoy', v_tope) END
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;
  END IF;

  -- Líneas: todas suyas y sin cambiar el papel de la visita (como líder o como Ejecutivo Comercial); como líder, el
  -- médico sigue siendo de las líneas nuevas (C9).
  IF v_lineas IS NOT NULL THEN
    IF cardinality(v_lineas) = 0 THEN
      RAISE EXCEPTION 'Elige al menos una línea' USING ERRCODE = 'check_violation';
    END IF;
    IF EXISTS (SELECT 1 FROM unnest(v_lineas) AS l(id) WHERE l.id <> ALL (public.persona_lineas(p_user))) THEN
      RAISE EXCEPTION 'Alguna de las líneas no es tuya' USING ERRCODE = 'check_violation';
    END IF;
    IF public.ejecutivo_de_la_visita(p_user, v_lineas) IS DISTINCT FROM v_v.executive_id THEN
      RAISE EXCEPTION 'Para cambiar el papel de la visita (como líder o como Ejecutivo Comercial), anúlala y repórtala de nuevo'
        USING ERRCODE = 'check_violation';
    END IF;
    IF v_v.executive_id IS NULL AND v_v.tipo = 'medica'
       AND NOT public.medico_de_lineas(v_v.medico_id, v_lineas, v_v.visit_date) THEN
      RAISE EXCEPTION 'Ese médico no es de tus líneas' USING ERRCODE = 'check_violation';
    END IF;
    DELETE FROM public.visit_lines vl WHERE vl.visit_id = p_id;
    INSERT INTO public.visit_lines (visit_id, line_id)
    SELECT p_id, l.id FROM unnest(v_lineas) AS l(id);
  END IF;

  UPDATE public.visits
  SET conclusion     = v_conclusion,
      compromisos    = v_compromisos,
      next_step_date = v_next,
      efectiva       = v_efectiva,
      failure_reason = v_failure,
      retry_date     = v_retry,
      visit_type     = CASE WHEN v_efectiva THEN 'Visita efectiva' ELSE 'Visita no efectiva' END,
      updated_by     = p_user
  WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.visitas_anular(p_id uuid, p_motivo text, p_user uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  c_no_editable constant text := 'Solo puedes corregir o anular tus visitas del mismo día';
  v_hoy         constant date := (now() AT TIME ZONE 'America/Bogota')::date;
  v_motivo      constant text := nullif(btrim(p_motivo), '');
  v_v           record;
  v_cita        record;
  v_otra        uuid;
BEGIN
  IF p_id IS NULL THEN
    RAISE EXCEPTION 'Falta la visita' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF char_length(coalesce(v_motivo, '')) < 5 THEN
    RAISE EXCEPTION 'Escribe el motivo (al menos 5 caracteres)' USING ERRCODE = 'check_violation';
  END IF;
  IF char_length(v_motivo) > 300 THEN
    RAISE EXCEPTION 'El motivo no puede superar 300 caracteres' USING ERRCODE = 'check_violation';
  END IF;
  IF p_user IS NULL THEN
    RAISE EXCEPTION 'Falta el usuario que anula' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- La persona de campo del usuario (0850; antes, su Ejecutivo Comercial activo).
  PERFORM public.persona_de_campo(p_user);

  PERFORM pg_advisory_xact_lock(hashtext('visitas_app:' || p_user::text));
  SELECT v.id, v.source, v.user_id, v.deleted_at, v.visit_date INTO v_v
  FROM public.visits v
  WHERE v.id = p_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Esa visita no existe' USING ERRCODE = 'no_data_found';
  END IF;
  IF v_v.source IS DISTINCT FROM 'app' THEN
    RAISE EXCEPTION '%', c_no_editable USING ERRCODE = 'check_violation';
  END IF;
  IF v_v.user_id IS DISTINCT FROM p_user THEN
    RAISE EXCEPTION 'Esa visita no existe' USING ERRCODE = 'no_data_found';
  END IF;
  IF v_v.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Esa visita ya está anulada' USING ERRCODE = 'check_violation';
  END IF;
  IF v_v.visit_date IS DISTINCT FROM v_hoy THEN
    RAISE EXCEPTION '%', c_no_editable USING ERRCODE = 'check_violation';
  END IF;
  -- La cita que cumplió ya tiene otra fecha (A7): anularla la devolvería a pendiente (o la pasaría a otra visita) con su
  -- sucesora colgando. Primero se elimina la otra fecha.
  IF EXISTS (SELECT 1 FROM public.visitas_agenda a JOIN public.visitas_agenda s ON s.viene_de = a.id
             WHERE a.visita_id = p_id AND a.estado = 'hecha' AND s.estado <> 'eliminada') THEN
    RAISE EXCEPTION 'La cita de esta visita ya tiene otra fecha: elimina primero esa otra fecha' USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.visits
  SET deleted_at = now(), deleted_reason = v_motivo, updated_by = p_user
  WHERE id = p_id;

  -- La cita que cumplía pasa a otra visita suya no anulada de ese día, del mismo papel, del mismo tipo y con el mismo
  -- médico o cuenta, que no tenga cita (la efectiva primero, luego el mismo subtipo, la llegada más temprana y por id);
  -- si no hay, vuelve a pendiente. La visita anulada conserva agenda_id como rastro.
  SELECT a.id, a.executive_id, a.fecha, a.tipo, a.medico_id, a.cuenta_id, a.subtipo_id, a.created_at
  INTO v_cita
  FROM public.visitas_agenda a
  WHERE a.visita_id = p_id AND a.estado = 'hecha'
  FOR UPDATE;
  IF FOUND THEN
    SELECT v.id INTO v_otra
    FROM public.visits v
    WHERE v.source = 'app' AND v.user_id = p_user AND v.executive_id IS NOT DISTINCT FROM v_cita.executive_id
      AND v.deleted_at IS NULL AND v.agenda_id IS NULL
      AND v.id <> p_id AND v.visit_date = v_cita.fecha AND v.tipo = v_cita.tipo
      AND CASE WHEN v_cita.tipo = 'medica' THEN v.medico_id = v_cita.medico_id ELSE v.cuenta_id = v_cita.cuenta_id END
    ORDER BY v.efectiva DESC, (v.subtipo_id IS NOT DISTINCT FROM v_cita.subtipo_id) DESC, v.checked_in_at, v.id
    LIMIT 1
    FOR UPDATE;
    IF FOUND THEN
      UPDATE public.visits
      SET agenda_id = v_cita.id, agendada = (v_cita.created_at AT TIME ZONE 'America/Bogota')::date < v_cita.fecha
      WHERE id = v_otra;
      UPDATE public.visitas_agenda SET visita_id = v_otra WHERE id = v_cita.id;
    ELSE
      UPDATE public.visitas_agenda SET estado = 'pendiente', visita_id = NULL WHERE id = v_cita.id;
    END IF;
  END IF;
END;
$$;

-- -------------------------------------------------------------------------------------
-- 6. Salida (A16, C11): lo pendiente de hoy en adelante de quien sale se cancela con motivo 'salida'
-- -------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.agenda_cancelar_por_salida()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_hoy constant date := (now() AT TIME ZONE 'America/Bogota')::date;
BEGIN
  -- El candado por persona de agenda_crear: una cita que se está agendando en ese momento termina antes (y aquí se
  -- cancela) o espera y ya no encuentra a la persona.
  IF TG_TABLE_NAME = 'users' THEN
    IF OLD.active IS TRUE AND NEW.active IS NOT TRUE THEN
      PERFORM pg_advisory_xact_lock(hashtext('visitas_app:' || NEW.id::text));
      UPDATE public.visitas_agenda a
      SET estado = 'cancelada', cancelada_at = now(), cancelada_motivo = 'Salió de la empresa', motivo_codigo = 'salida'
      WHERE a.user_id = NEW.id AND a.estado = 'pendiente' AND a.fecha >= v_hoy;
    END IF;
  ELSIF TG_TABLE_NAME = 'executives' THEN
    IF NEW.status = 'inactive' AND OLD.status IS DISTINCT FROM 'inactive' AND NEW.user_id IS NOT NULL THEN
      PERFORM pg_advisory_xact_lock(hashtext('visitas_app:' || NEW.user_id::text));
      IF cardinality(public.persona_lineas(NEW.user_id)) = 0 THEN
        -- Su usuario se queda sin líneas: deja de ser persona de campo (todo lo suyo).
        UPDATE public.visitas_agenda a
        SET estado = 'cancelada', cancelada_at = now(), cancelada_motivo = 'Salió de la empresa', motivo_codigo = 'salida'
        WHERE a.user_id = NEW.user_id AND a.estado = 'pendiente' AND a.fecha >= v_hoy;
      ELSE
        -- Sigue como líder: solo lo que tenía agendado como Ejecutivo Comercial (lo de líder se queda). No salió de la
        -- empresa: motivo 'otro' (no 'salida'), así esas citas sí admiten otra fecha como líder (con un médico de sus
        -- líneas, C9). Decisión de implementación pendiente del visto bueno del dueño (fase 8, F4.2).
        UPDATE public.visitas_agenda a
        SET estado = 'cancelada', cancelada_at = now(), cancelada_motivo = 'Dejó de ser Ejecutivo Comercial',
            motivo_codigo = 'otro'
        WHERE a.executive_id = NEW.id AND a.estado = 'pendiente' AND a.fecha >= v_hoy;
      END IF;
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE TRIGGER users_salida_cancela_agenda
  AFTER UPDATE OF active ON public.users
  FOR EACH ROW
  WHEN (OLD.active IS TRUE AND NEW.active IS NOT TRUE)
  EXECUTE FUNCTION public.agenda_cancelar_por_salida();

CREATE OR REPLACE TRIGGER executives_baja_cancela_agenda
  AFTER UPDATE OF status ON public.executives
  FOR EACH ROW
  WHEN (NEW.status = 'inactive' AND OLD.status IS DISTINCT FROM 'inactive')
  EXECUTE FUNCTION public.agenda_cancelar_por_salida();

-- -------------------------------------------------------------------------------------
-- 7. Seguridad: nada para PUBLIC/anon/authenticated; service_role ejecuta (sin políticas RLS nuevas)
-- -------------------------------------------------------------------------------------

REVOKE ALL ON TABLE public.visitas_agenda FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.visits FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.persona_lineas(uuid)                              FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.persona_de_campo(uuid)                            FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ejecutivo_de_la_visita(uuid, uuid[])              FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.medico_de_lineas(uuid, uuid[], date)              FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.visitas_config_persona(uuid, date)                FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agenda_choque(uuid, date, time, uuid)             FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agenda_crear(jsonb, uuid)                         FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agenda_cancelar(uuid, text, uuid, text)           FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agenda_cerrar(uuid, jsonb, uuid)                  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agenda_eliminar(uuid, uuid)                       FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agenda_otra_fecha(uuid, jsonb, uuid)              FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.visitas_registrar(jsonb, uuid)                    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.visitas_editar(uuid, jsonb, uuid)                 FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.visitas_anular(uuid, text, uuid)                  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agenda_cancelar_por_salida()                      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.visitas_agenda_cancelar_con_motivo()              FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.persona_lineas(uuid)                           TO service_role;
GRANT EXECUTE ON FUNCTION public.persona_de_campo(uuid)                         TO service_role;
GRANT EXECUTE ON FUNCTION public.ejecutivo_de_la_visita(uuid, uuid[])           TO service_role;
GRANT EXECUTE ON FUNCTION public.medico_de_lineas(uuid, uuid[], date)           TO service_role;
GRANT EXECUTE ON FUNCTION public.visitas_config_persona(uuid, date)             TO service_role;
GRANT EXECUTE ON FUNCTION public.agenda_choque(uuid, date, time, uuid)          TO service_role;
GRANT EXECUTE ON FUNCTION public.agenda_crear(jsonb, uuid)                      TO service_role;
GRANT EXECUTE ON FUNCTION public.agenda_cancelar(uuid, text, uuid, text)        TO service_role;
GRANT EXECUTE ON FUNCTION public.agenda_cerrar(uuid, jsonb, uuid)               TO service_role;
GRANT EXECUTE ON FUNCTION public.agenda_eliminar(uuid, uuid)                    TO service_role;
GRANT EXECUTE ON FUNCTION public.agenda_otra_fecha(uuid, jsonb, uuid)           TO service_role;
GRANT EXECUTE ON FUNCTION public.visitas_registrar(jsonb, uuid)                 TO service_role;
GRANT EXECUTE ON FUNCTION public.visitas_editar(uuid, jsonb, uuid)              TO service_role;
GRANT EXECUTE ON FUNCTION public.visitas_anular(uuid, text, uuid)               TO service_role;

-- -------------------------------------------------------------------------------------
-- 8. Documentación en el catálogo
-- -------------------------------------------------------------------------------------

COMMENT ON COLUMN public.visits.user_id IS
  'Persona que reportó la visita (0850): obligatoria en las de la app; NULL en las importadas de VMO. Candado, topes, idempotencia y "mis visitas" van por persona.';
COMMENT ON COLUMN public.visits.executive_id IS
  'Ejecutivo Comercial de la visita (0850: opcional). NULL = visita como líder (sin zona: kam_id NULL, kam_name = la persona, nunca fuera de territorio). El mapa de asignación no muestra las de la app sin Ejecutivo Comercial.';
COMMENT ON TABLE public.visitas_agenda IS
  'Agenda de la persona de campo (F4.1, 0850): una fila por cita (día, hora, médico en una sede o cuenta y subtipo en una sede). Se crea con agenda_crear (de hoy en adelante, sin tope; sin cruzarse en su media hora), se cierra con su resultado: hecha (visitas_registrar), no_realizada (agenda_cerrar), cancelada (agenda_cancelar o la salida) o eliminada por error (agenda_eliminar). Otra fecha = una cita nueva con viene_de. No se borra ni se mueve de fecha. RLS sin políticas; solo service_role.';
COMMENT ON COLUMN public.visitas_agenda.user_id IS 'Persona dueña de la cita (0850): su agenda, sus duplicados y su choque de media hora.';
COMMENT ON COLUMN public.visitas_agenda.executive_id IS 'Ejecutivo Comercial con el que agenda (como Ejecutivo Comercial); NULL = como líder (C12).';
COMMENT ON COLUMN public.visitas_agenda.fecha IS 'Día de la cita (Bogotá): de hoy en adelante al agendar, sin tope (A4).';
COMMENT ON COLUMN public.visitas_agenda.hora IS 'Hora de la cita: obligatoria en las nuevas (decisión del dueño 2026-10-15); NULL solo en las viejas. Dos citas pendientes o hechas de la persona no se cruzan en su media hora.';
COMMENT ON COLUMN public.visitas_agenda.estado IS 'pendiente | hecha (con visita_id) | no_realizada (no se hizo, con motivo) | cancelada (con cancelada_at y, desde la 0850, motivo) | eliminada (por error; no se muestra ni cuenta).';
COMMENT ON COLUMN public.visitas_agenda.motivo_codigo IS 'Motivo del cierre (no_realizada o cancelada): cliente | prioridad | falta_tiempo | fuerza_mayor | otro (con texto) | salida (solo el sistema, A16).';
COMMENT ON COLUMN public.visitas_agenda.no_realizada_at IS 'Cuándo se marcó "no se hizo".';
COMMENT ON COLUMN public.visitas_agenda.no_realizada_motivo IS 'Texto del motivo de "no se hizo" (≤ 300; obligatorio con motivo otro).';
COMMENT ON COLUMN public.visitas_agenda.cancelada_motivo IS 'Texto del motivo de la cancelación (≤ 300; obligatorio con motivo otro).';
COMMENT ON COLUMN public.visitas_agenda.eliminada_at IS 'Cuándo se eliminó por error (la fila se queda para auditoría).';
COMMENT ON COLUMN public.visitas_agenda.eliminada_por IS 'Quién la eliminó por error.';
COMMENT ON COLUMN public.visitas_agenda.viene_de IS 'Otra fecha: la cita anterior (cerrada) de la que esta es la nueva fecha. A lo sumo una sucesora no eliminada.';
COMMENT ON FUNCTION public.persona_lineas(uuid) IS
  'Líneas con las que la persona reporta y agenda: executive_lines de su Ejecutivo Comercial activo ∪ líneas activas que lidera; {} si está inactiva o es commercial_director (A1).';
COMMENT ON FUNCTION public.persona_de_campo(uuid) IS
  'La persona de campo del usuario: { user_id, nombre, rol (ejecutivo | lider | lider_y_ejecutivo), executive_id, kam_id, lineas_ec, lineas_lider }. 23514: la dirección comercial (A1), sin líneas, Ejecutivo Comercial sin zona.';
COMMENT ON FUNCTION public.ejecutivo_de_la_visita(uuid, uuid[]) IS
  'Ejecutivo Comercial de una visita: el de la persona si alguna línea de la visita está en sus executive_lines; si no, NULL (como líder).';
COMMENT ON FUNCTION public.medico_de_lineas(uuid, uuid[], date) IS
  'C9: el médico tiene un visitante vigente en la fecha en alguna de esas líneas, o su visitante vigente es un Ejecutivo Comercial activo con alguna de ellas.';
COMMENT ON FUNCTION public.visitas_config_persona(uuid, date) IS
  'Configuración de visitas en una fecha: con Ejecutivo Comercial, visitas_config_vigente; sin él, la general (médica e institucional, sin telefónica).';
COMMENT ON FUNCTION public.agenda_choque(uuid, date, time, uuid) IS
  'Primera cita pendiente o hecha, con hora, de la persona ese día a menos de 30 minutos de la hora dada (sin contar p_excluir): { cita_id, hora, con_quien } o NULL.';
COMMENT ON FUNCTION public.agenda_crear(jsonb, uuid) IS
  'Agenda una cita de la persona de p_user (0850): p = { fecha, hora, tipo, medico_id?, cuenta_id?, subtipo_id?, sede_id, nota?, como?, viene_de? }; hora obligatoria, de hoy en adelante sin tope y no a una hora que ya pasó, día libre (con Ejecutivo Comercial), perfil, sede, médico (como líder, de sus líneas) o cuenta y subtipo, sin duplicados (23505) ni choque de media hora (23P01); con viene_de, las reglas de otra fecha. Devuelve { cita_id }.';
COMMENT ON FUNCTION public.agenda_cancelar(uuid, text, uuid, text) IS
  'Cancela una cita pendiente de hoy en adelante de la persona de p_user con motivo obligatorio (A8): código de la lista sin salida (por defecto otro, que exige texto de 3 a 300). P0002 inexistente o ajena; 23514 cancelada, hecha, cerrada o pasada.';
COMMENT ON FUNCTION public.agenda_cerrar(uuid, jsonb, uuid) IS
  '"No se hizo" (A7): la cita propia y pendiente de su día o anterior pasa a no_realizada con motivo (p = { motivo_codigo, motivo? }). Devuelve { cita_id, estado }.';
COMMENT ON FUNCTION public.agenda_eliminar(uuid, uuid) IS
  'Elimina por error (C8) la cita propia, pendiente y de hoy en adelante: estado eliminada (la fila se queda). Devuelve { cita_id }.';
COMMENT ON FUNCTION public.agenda_otra_fecha(uuid, jsonb, uuid) IS
  'Otra fecha (A7): cita nueva con viene_de = la anterior (cerrada y sin otra sucesora), mismo médico o cuenta y subtipo; p = { fecha, hora, sede_id?, nota?, como? }. Pasa por agenda_crear. Devuelve { cita_id, viene_de }.';
COMMENT ON FUNCTION public.visitas_registrar(jsonb, uuid) IS
  'Registra una visita de la app de la persona de p_user (0850): idempotente por client_id; líneas suyas; Ejecutivo Comercial de la visita según sus líneas (sin él, como líder: sin zona, configuración general y médico de sus líneas); mismo día, perfil, sede, radio, telefónica y topes por persona; vínculo con la agenda (del mismo papel). Devuelve { visita_id, repetida, out_of_territory, distance_m, visit_date, agenda_id, agendada }.';
COMMENT ON FUNCTION public.visitas_editar(uuid, jsonb, uuid) IS
  'Corrige una visita de la app de la persona de p_user y del mismo día (conclusión, compromisos, próxima reunión, efectiva y motivo, líneas sin cambiar el papel); a efectiva revalida los topes. P0002 inexistente o ajena; 23514 no editable.';
COMMENT ON FUNCTION public.visitas_anular(uuid, text, uuid) IS
  'Anula con motivo (5..300) una visita de la app de la persona de p_user y del mismo día; su cita pasa a otra visita suya del mismo papel o vuelve a pendiente. P0002 inexistente o ajena; 23514 no editable o ya anulada.';
COMMENT ON FUNCTION public.agenda_cancelar_por_salida() IS
  'Disparador de la salida (A16): users.active a false o un Ejecutivo Comercial a inactive cancelan lo pendiente de hoy en adelante con motivo salida.';
COMMENT ON FUNCTION public.visitas_agenda_cancelar_con_motivo() IS
  'Disparador: una cita que pasa a cancelada sin motivo_codigo se rechaza (A8).';

-- -------------------------------------------------------------------------------------
-- 9. Comprobaciones (aborta la transacción si algo no cuadra). Las pruebas que escriben van en sub-bloques que
--    terminan con RAISE SQLSTATE 'P0850': PL/pgSQL deshace todo lo del sub-bloque (no queda ni cambia ninguna
--    fila). Cualquier otra excepción sale del bloque y aborta la migración.
-- -------------------------------------------------------------------------------------

DO $$
DECLARE
  v_hoy          constant date := (now() AT TIME ZONE 'America/Bogota')::date;
  v_todos_priv   constant text := 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER';
  c_sin_ejec     constant text := 'Tu usuario no está enlazado con un Ejecutivo Comercial';
  c_sin_lineas   constant text := 'Tu usuario no tiene líneas para reportar';
  c_direccion    constant text := 'La dirección comercial no agenda ni reporta: sigue a tu equipo en Equipo';
  c_medico_ajeno constant text := 'Ese médico no es de tus líneas';
  c_lineas       constant text := 'Alguna de las líneas no es tuya';
  c_no_existe    constant text := 'Esa cita no existe';
  c_cerrada      constant text := 'Esa cita ya está cerrada';
  c_otra_fecha_v constant text := 'La cita de esta visita ya tiene otra fecha: elimina primero esa otra fecha';
  v_fn           text;
  v_col          record;
  v_caso         record;
  v_fila         record;
  v_casos        text[] := '{}';
  v_estado       text;
  v_msg          text;
  v_n            bigint;
  v_md5          text;
  v_md5_todo     text;
  v_antes        text[];
  v_citas_antes  bigint;
  v_visitas_antes bigint;
  v_cfg_antes    text;
  v_cfg_despues  text;
  v_r            jsonb;
  v_rol_ok       boolean;
  v_kam          uuid;
  v_u_lider      uuid;
  v_u_paola      uuid;
  v_u_ec         uuid;
  v_u_sin        uuid;
  v_u_dir        uuid;
  v_u_sale       uuid;
  v_l_dep        uuid;
  v_l_tra        uuid;
  v_l_sus        uuid;
  v_l_dir        uuid;
  v_l_inactiva   uuid;
  v_e_paola      uuid;
  v_e_ec         uuid;
  v_e_sale       uuid;
  v_c1           uuid;
  v_s1           uuid;
  v_sub          uuid;
  v_m_dep1       uuid;
  v_m_dep2       uuid;
  v_m_ajeno      uuid;
  v_m_vencido    uuid;
  v_m_tra        uuid;
  v_m_sus        uuid;
  v_m_x1         uuid;
  v_m_x2         uuid;
  v_m_x3         uuid;
  v_d_libre      date;
  v_cita         jsonb;
  v_visita       jsonb;
  v_id1          uuid;
  v_id2          uuid;
  v_id3          uuid;
  v_cita_l1      uuid;
  v_cita_l_hoy   uuid;
  v_visita_l     uuid;
  v_visita_tra   uuid;
  v_visita_sus   uuid;
  v_c_p_lider    uuid;
  v_c_p_ec       uuid;
  v_cita_ayer    uuid;
  v_cita_ayer2   uuid;
  v_c_manana     uuid;
  v_cita_hoy_h   uuid;
  v_cita_hoy_p   uuid;
  v_cita_hoy_ne  uuid;
  v_visita_ne    uuid;
  v_suc_ne       uuid;
  v_c_cancel     uuid;
  v_c_cancel2    uuid;
  v_c_el         uuid;
  v_sucesora     uuid;
  v_sucesora2    uuid;
  v_c_o          uuid;
  v_s_ayer       uuid;
  v_s1c          uuid;
  v_s2c          uuid;
BEGIN
  -- 9.1 Estructura ----------------------------------------------------------------------------------------------
  FOR v_col IN
    SELECT * FROM (VALUES
      ('visitas_agenda', 'user_id', 'uuid', 'NO'), ('visitas_agenda', 'executive_id', 'uuid', 'YES'),
      ('visitas_agenda', 'motivo_codigo', 'text', 'YES'),
      ('visitas_agenda', 'no_realizada_at', 'timestamp with time zone', 'YES'),
      ('visitas_agenda', 'no_realizada_motivo', 'text', 'YES'),
      ('visitas_agenda', 'eliminada_at', 'timestamp with time zone', 'YES'),
      ('visitas_agenda', 'eliminada_por', 'uuid', 'YES'), ('visitas_agenda', 'viene_de', 'uuid', 'YES'),
      ('visitas_agenda', 'hora', 'time without time zone', 'YES'),
      ('visits', 'user_id', 'uuid', 'YES'), ('visits', 'executive_id', 'uuid', 'YES'), ('visits', 'kam_id', 'uuid', 'YES')
    ) AS t(tabla, nombre, tipo, nulo)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns c
                   WHERE c.table_schema = 'public' AND c.table_name = v_col.tabla AND c.column_name = v_col.nombre
                     AND c.data_type = v_col.tipo AND c.is_nullable = v_col.nulo) THEN
      RAISE EXCEPTION '0850: falta %.% (%, NULL: %)', v_col.tabla, v_col.nombre, v_col.tipo, v_col.nulo;
    END IF;
  END LOOP;
  SELECT count(*) INTO v_n FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'visitas_agenda';
  IF v_n <> 24 THEN
    RAISE EXCEPTION '0850: visitas_agenda tiene % columnas; se esperaban 24 (17 de la 0840 + 7)', v_n;
  END IF;
  SELECT count(*) INTO v_n FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'visits';
  IF v_n <> 47 THEN
    RAISE EXCEPTION '0850: visits tiene % columnas; se esperaban 47 (45 de la 0840 + vmo_id de la 0910 + user_id)', v_n;
  END IF;
  FOR v_col IN
    SELECT * FROM (VALUES
      ('public.visits', 'user_id', 'public.users'), ('public.visitas_agenda', 'user_id', 'public.users'),
      ('public.visitas_agenda', 'eliminada_por', 'public.users'),
      ('public.visitas_agenda', 'viene_de', 'public.visitas_agenda'),
      ('public.visitas_agenda', 'executive_id', 'public.executives')
    ) AS t(tabla, columna, destino)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_constraint c
                   JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
                   WHERE c.conrelid = v_col.tabla::regclass AND c.contype = 'f' AND a.attname = v_col.columna
                     AND c.confrelid = v_col.destino::regclass) THEN
      RAISE EXCEPTION '0850: falta la llave de %.% hacia %', v_col.tabla, v_col.columna, v_col.destino;
    END IF;
  END LOOP;
  FOR v_col IN
    SELECT * FROM (VALUES
      ('public.visits', 'visits_app_check'), ('public.visits', 'visits_agenda_check'),
      ('public.visits', 'visits_source_check'),
      ('public.visitas_agenda', 'visitas_agenda_estado_check'),
      ('public.visitas_agenda', 'visitas_agenda_estado_datos_check'),
      ('public.visitas_agenda', 'visitas_agenda_motivo_codigo_check'),
      ('public.visitas_agenda', 'visitas_agenda_no_realizada_motivo_check'),
      ('public.visitas_agenda', 'visitas_agenda_viene_de_check'),
      ('public.visitas_agenda', 'visitas_agenda_tipo_check'), ('public.visitas_agenda', 'visitas_agenda_tipo_datos_check'),
      ('public.visitas_agenda', 'visitas_agenda_nota_check'), ('public.visitas_agenda', 'visitas_agenda_motivo_check')
    ) AS t(tabla, nombre)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conrelid = v_col.tabla::regclass AND c.conname = v_col.nombre
                     AND c.contype = 'c') THEN
      RAISE EXCEPTION '0850: falta el CHECK % en %', v_col.nombre, v_col.tabla;
    END IF;
  END LOOP;
  FOR v_col IN
    SELECT * FROM (VALUES
      ('public.visits', 'visits_user_date_idx', false, true),
      ('public.visits', 'visits_user_next_step_idx', false, true),
      ('public.visits', 'visits_executive_date_idx', false, true),
      ('public.visits', 'visits_agenda_id_uidx', true, true),
      ('public.visitas_agenda', 'visitas_agenda_medico_uidx', true, true),
      ('public.visitas_agenda', 'visitas_agenda_cuenta_uidx', true, true),
      ('public.visitas_agenda', 'visitas_agenda_viene_de_uidx', true, true),
      ('public.visitas_agenda', 'visitas_agenda_visita_uidx', true, true),
      ('public.visitas_agenda', 'visitas_agenda_user_fecha_idx', false, false),
      ('public.visitas_agenda', 'visitas_agenda_executive_fecha_idx', false, false)
    ) AS t(tabla, nombre, unico, parcial)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid
                   WHERE i.indrelid = v_col.tabla::regclass AND c.relname = v_col.nombre
                     AND i.indisunique = v_col.unico AND (i.indpred IS NOT NULL) = v_col.parcial) THEN
      RAISE EXCEPTION '0850: falta el índice % (único: %, parcial: %)', v_col.nombre, v_col.unico, v_col.parcial;
    END IF;
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid
                 JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = i.indkey[0]
                 WHERE c.relname = 'visitas_agenda_medico_uidx' AND a.attname = 'user_id') THEN
    RAISE EXCEPTION '0850: visitas_agenda_medico_uidx no es por persona (user_id)';
  END IF;
  FOR v_col IN
    SELECT * FROM (VALUES
      ('public.visitas_agenda', 'visitas_agenda_cancelar_con_motivo'), ('public.visitas_agenda', 'visitas_agenda_sin_borrar'),
      ('public.visitas_agenda', 'update_visitas_agenda_updated_at'), ('public.users', 'users_salida_cancela_agenda'),
      ('public.executives', 'executives_baja_cancela_agenda'), ('public.executives', 'executives_baja_termina_visitantes')
    ) AS t(tabla, nombre)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_trigger t
                   WHERE t.tgrelid = v_col.tabla::regclass AND t.tgname = v_col.nombre AND NOT t.tgisinternal) THEN
      RAISE EXCEPTION '0850: falta el disparador % en %', v_col.nombre, v_col.tabla;
    END IF;
  END LOOP;
  IF to_regprocedure('public.agenda_cancelar(uuid, text, uuid)') IS NOT NULL THEN
    RAISE EXCEPTION '0850: sigue existiendo agenda_cancelar(uuid, text, uuid) de la 0840';
  END IF;

  -- RLS sin políticas y privilegios
  SELECT count(*) INTO v_n FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('visitas_agenda', 'visits');
  IF v_n > 0 THEN
    RAISE EXCEPTION '0850: visitas_agenda o visits tienen % política(s) RLS; deben tener 0', v_n;
  END IF;
  IF has_table_privilege('anon', 'public.visitas_agenda', v_todos_priv)
     OR has_table_privilege('authenticated', 'public.visitas_agenda', v_todos_priv)
     OR has_table_privilege('anon', 'public.visits', v_todos_priv)
     OR has_table_privilege('authenticated', 'public.visits', v_todos_priv) THEN
    RAISE EXCEPTION '0850: anon/authenticated tienen privilegios sobre visitas_agenda o visits';
  END IF;
  IF has_table_privilege('service_role', 'public.visitas_agenda', 'DELETE') THEN
    RAISE EXCEPTION '0850: service_role no debe poder borrar citas';
  END IF;
  FOREACH v_fn IN ARRAY ARRAY['public.persona_lineas(uuid)', 'public.persona_de_campo(uuid)',
                              'public.ejecutivo_de_la_visita(uuid, uuid[])', 'public.medico_de_lineas(uuid, uuid[], date)',
                              'public.visitas_config_persona(uuid, date)', 'public.agenda_choque(uuid, date, time, uuid)',
                              'public.agenda_crear(jsonb, uuid)', 'public.agenda_cancelar(uuid, text, uuid, text)',
                              'public.agenda_cerrar(uuid, jsonb, uuid)', 'public.agenda_eliminar(uuid, uuid)',
                              'public.agenda_otra_fecha(uuid, jsonb, uuid)', 'public.visitas_registrar(jsonb, uuid)',
                              'public.visitas_editar(uuid, jsonb, uuid)', 'public.visitas_anular(uuid, text, uuid)'] LOOP
    IF to_regprocedure(v_fn) IS NULL THEN
      RAISE EXCEPTION '0850: falta la función %', v_fn;
    END IF;
    IF has_function_privilege('anon', v_fn, 'EXECUTE') OR has_function_privilege('authenticated', v_fn, 'EXECUTE') THEN
      RAISE EXCEPTION '0850: anon/authenticated pueden ejecutar %', v_fn;
    END IF;
    IF NOT has_function_privilege('service_role', v_fn, 'EXECUTE') THEN
      RAISE EXCEPTION '0850: service_role no puede ejecutar %', v_fn;
    END IF;
  END LOOP;
  FOREACH v_fn IN ARRAY ARRAY['public.persona_lineas(uuid)', 'public.persona_de_campo(uuid)',
                              'public.ejecutivo_de_la_visita(uuid, uuid[])', 'public.medico_de_lineas(uuid, uuid[], date)',
                              'public.visitas_config_persona(uuid, date)', 'public.agenda_choque(uuid, date, time, uuid)',
                              'public.agenda_crear(jsonb, uuid)', 'public.agenda_cancelar(uuid, text, uuid, text)',
                              'public.agenda_cerrar(uuid, jsonb, uuid)', 'public.agenda_eliminar(uuid, uuid)',
                              'public.agenda_otra_fecha(uuid, jsonb, uuid)', 'public.visitas_registrar(jsonb, uuid)',
                              'public.visitas_editar(uuid, jsonb, uuid)', 'public.visitas_anular(uuid, text, uuid)',
                              'public.agenda_cancelar_por_salida()', 'public.visitas_agenda_cancelar_con_motivo()'] LOOP
    IF (SELECT p.prosecdef FROM pg_proc p WHERE p.oid = to_regprocedure(v_fn)) THEN
      RAISE EXCEPTION '0850: % debe ser SECURITY INVOKER', v_fn;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.oid = to_regprocedure(v_fn)
                     AND p.proconfig @> ARRAY['search_path=public, pg_temp']) THEN
      RAISE EXCEPTION '0850: % debe fijar search_path = public, pg_temp', v_fn;
    END IF;
    IF has_function_privilege('anon', v_fn, 'EXECUTE') OR has_function_privilege('authenticated', v_fn, 'EXECUTE') THEN
      RAISE EXCEPTION '0850: anon/authenticated pueden ejecutar %', v_fn;
    END IF;
  END LOOP;
  -- Huellas: las de este archivo; visitas_config_vigente, visitas_distancia_m y ejecutivas_traspasar no cambiaron.
  FOR v_col IN
    SELECT * FROM (VALUES
      ('visitas_registrar', 'e915ea728b393ba6dd677a109d09faf5'), ('visitas_editar', 'ef8c1f875cd58a30f72fdcf6bbf3b9f6'),
      ('visitas_anular', 'b1ab633c3949a21f75ae887bee68bcda'), ('agenda_crear', '0bb1da4a0d377040d79eccb5f6c3a16f'),
      ('agenda_cancelar', '2ee5183731a93220a107aea059dbf0ef'), ('agenda_cerrar', 'f3da99531f4668d61f5c3e8c643a5f9a'),
      ('agenda_eliminar', '9040ff2a61415c9a6927dc3ed38ae33b'), ('agenda_otra_fecha', 'd0c2265e2f17489e7f04d224c98121ab'),
      ('persona_lineas', '3c6b3795f2aea8e3d71bc65794e2ee70'), ('persona_de_campo', '1179a6c038c84b574cfb53f17d520557'),
      ('ejecutivo_de_la_visita', 'd32c6b8997884544fa7ac9ca7830abdb'), ('medico_de_lineas', '3db2304d37e1a535a0ffd8e984cec343'),
      ('visitas_config_persona', 'b5adc709c7fc776c1b1e0578bfb25862'), ('agenda_choque', '32d88b6e2ec71eedb13a5be493caa6f3'),
      ('agenda_cancelar_por_salida', '9ffce5ac59c878fb051bef1dcb9b5d95'),
      ('visitas_agenda_cancelar_con_motivo', 'bfe89a3ee621c592aad98f0646d10e59'),
      ('visitas_config_vigente', 'b5ce2f997fc50012ebc3e8d61463bc1c'),
      ('visitas_distancia_m', 'de6fd102ba79b9d0b59dc94ea9d4b60b'),
      ('ejecutivas_traspasar', 'ff6344693b3256a125f12b3222910e5b')
    ) AS t(nombre, huella)
  LOOP
    IF (SELECT md5(p.prosrc) FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname = v_col.nombre)
       IS DISTINCT FROM v_col.huella THEN
      RAISE EXCEPTION '0850: public.% no tiene la huella esperada (%)', v_col.nombre, v_col.huella;
    END IF;
  END LOOP;
  v_casos := v_casos || 'estructura, privilegios y huellas de las funciones'::text;

  -- 9.2 Lo que ya existía: las citas y las visitas de la app conservan todo (y su vínculo) y tienen su user_id -----
  v_antes := string_to_array(current_setting('opmap0850.citas', true), '|');
  SELECT count(*),
         md5(coalesce(string_agg(ROW(a.id, a.executive_id, a.fecha, a.hora, a.tipo, a.medico_id, a.cuenta_id, a.subtipo_id,
                                     a.sede_id, a.nota, a.estado, a.visita_id, a.cancelada_at, a.cancelada_motivo,
                                     a.created_by, a.created_at)::text, ',' ORDER BY a.id), ''))
  INTO v_n, v_md5
  FROM public.visitas_agenda a;
  IF v_antes IS NULL OR v_n::text <> v_antes[1] OR v_md5 <> v_antes[2] THEN
    RAISE EXCEPTION '0850: las citas existentes cambiaron (antes %, después % / %)', array_to_string(v_antes, ' / '), v_n, v_md5;
  END IF;
  v_citas_antes := v_n;
  IF current_setting('opmap0850.primera', true) = '1'
     AND EXISTS (SELECT 1 FROM public.visitas_agenda a JOIN public.executives e ON e.id = a.executive_id
                 WHERE a.user_id IS DISTINCT FROM e.user_id) THEN
    RAISE EXCEPTION '0850: hay citas cuyo user_id no es el usuario de su Ejecutivo Comercial';
  END IF;
  v_antes := string_to_array(current_setting('opmap0850.visitas_app', true), '|');
  SELECT count(*),
         md5(coalesce(string_agg(ROW(v.id, v.executive_id, v.kam_id, v.kam_name, v.client_id, v.tipo, v.medico_id,
                                     v.cuenta_id, v.sede_id, v.efectiva, v.visit_date, v.out_of_territory, v.deleted_at,
                                     v.agenda_id, v.agendada)::text, ',' ORDER BY v.id), ''))
  INTO v_n, v_md5
  FROM public.visits v
  WHERE v.source = 'app';
  IF v_antes IS NULL OR v_n::text <> v_antes[1] OR v_md5 <> v_antes[2] THEN
    RAISE EXCEPTION '0850: las visitas de la app cambiaron (antes %, después % / %)', array_to_string(v_antes, ' / '), v_n, v_md5;
  END IF;
  v_visitas_antes := v_n;
  IF current_setting('opmap0850.primera', true) = '1'
     AND EXISTS (SELECT 1 FROM public.visits v JOIN public.executives e ON e.id = v.executive_id
                 WHERE v.source = 'app' AND v.user_id IS DISTINCT FROM e.user_id) THEN
    RAISE EXCEPTION '0850: hay visitas de la app cuyo user_id no es el usuario de su Ejecutivo Comercial';
  END IF;
  v_casos := v_casos || format('las %s cita(s) y %s visita(s) de la app existentes: idénticas, con su vínculo y su user_id', v_citas_antes, v_visitas_antes);

  -- 9.3 Personas reales (solo lectura): ninguna persona de campo falla de forma inesperada; la dirección no reporta.
  SELECT count(*) INTO v_n
  FROM public.users u
  WHERE u.active IS TRUE AND u.role = 'commercial_director' AND cardinality(public.persona_lineas(u.id)) > 0;
  IF v_n > 0 THEN
    RAISE EXCEPTION '0850: persona_lineas devuelve líneas a % usuario(s) de la dirección comercial (A1)', v_n;
  END IF;
  v_n := 0;
  FOR v_fila IN
    SELECT u.id FROM public.users u
    WHERE u.active IS TRUE AND u.role <> 'commercial_director' AND cardinality(public.persona_lineas(u.id)) > 0
    ORDER BY u.id
  LOOP
    BEGIN
      v_r := public.persona_de_campo(v_fila.id);
      IF (v_r ->> 'rol') NOT IN ('ejecutivo', 'lider', 'lider_y_ejecutivo') THEN
        RAISE EXCEPTION '0850: persona_de_campo devolvió un rol inesperado: %', v_r ->> 'rol';
      END IF;
      v_n := v_n + 1;
    EXCEPTION WHEN check_violation THEN
      GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
      IF v_msg <> 'Tu Ejecutivo Comercial no tiene zona base' THEN
        RAISE EXCEPTION '0850: persona_de_campo falló para una persona con líneas: %', v_msg;
      END IF;
    END;
  END LOOP;
  RAISE NOTICE '0850: % persona(s) de campo real(es) leída(s) sin error', v_n;

  -- 9.4 Pruebas con datos de prueba (se deshacen con P0850) -----------------------------------------------------
  IF EXISTS (SELECT 1 FROM public.users WHERE email LIKE 'prueba0850-%')
     OR EXISTS (SELECT 1 FROM public.business_lines WHERE code LIKE 'prueba\_0850\_%')
     OR EXISTS (SELECT 1 FROM public.medicos WHERE numero_documento LIKE 'PRUEBA0850M%')
     OR EXISTS (SELECT 1 FROM public.cuentas WHERE numero_identificacion LIKE 'PRUEBA0850C%')
     OR EXISTS (SELECT 1 FROM public.subtipos_institucionales WHERE codigo LIKE 'prueba\_0850\_%') THEN
    RAISE EXCEPTION '0850: ya hay datos con la identificación de las pruebas (prueba0850-…, prueba_0850_…, PRUEBA0850M…, PRUEBA0850C…); no se puede probar';
  END IF;
  SELECT k.id INTO v_kam FROM public.kams k ORDER BY k.id LIMIT 1;
  IF v_kam IS NULL THEN
    RAISE EXCEPTION '0850: no hay ninguna zona (kams) para los Ejecutivos Comerciales de prueba; no se puede probar';
  END IF;
  SELECT md5(coalesce(string_agg(to_jsonb(cg)::text, ',' ORDER BY cg.id), '')) INTO v_cfg_antes FROM public.config_general cg;
  v_d_libre := v_hoy + 20;

  BEGIN
    -- Preparación -----------------------------------------------------------------------------------------------
    PERFORM public.config_registrar('config_general', jsonb_build_object('parametro', 'radio_presencial_m', 'valor', 500),
                                    v_hoy, NULL, NULL, NULL);
    PERFORM public.config_registrar('config_general', jsonb_build_object('parametro', 'tope_visitas_medico_dia', 'valor', 1),
                                    v_hoy, NULL, NULL, NULL);

    INSERT INTO public.users (email, password, full_name, role, active)
    VALUES ('prueba0850-lider@opmap.invalid', 'x', 'Líder de prueba 0850', 'line_leader', true) RETURNING id INTO v_u_lider;
    INSERT INTO public.users (email, password, full_name, role, active)
    VALUES ('prueba0850-paola@opmap.invalid', 'x', 'Líder y Ejecutiva de prueba 0850', 'line_leader', true) RETURNING id INTO v_u_paola;
    INSERT INTO public.users (email, password, full_name, role, active)
    VALUES ('prueba0850-ec@opmap.invalid', 'x', 'Usuario Ejecutivo de prueba 0850', 'sales_manager', true) RETURNING id INTO v_u_ec;
    INSERT INTO public.users (email, password, full_name, role, active)
    VALUES ('prueba0850-sin@opmap.invalid', 'x', 'Sin líneas de prueba 0850', 'sales_manager', true) RETURNING id INTO v_u_sin;
    INSERT INTO public.users (email, password, full_name, role, active)
    VALUES ('prueba0850-dir@opmap.invalid', 'x', 'Directora de prueba 0850', 'commercial_director', true) RETURNING id INTO v_u_dir;
    INSERT INTO public.users (email, password, full_name, role, active)
    VALUES ('prueba0850-sale@opmap.invalid', 'x', 'Ejecutivo que sale de prueba 0850', 'sales_manager', true) RETURNING id INTO v_u_sale;

    INSERT INTO public.business_lines (code, name, leader_user_id, active)
    VALUES ('prueba_0850_dep', 'Prueba 0850 deportiva', v_u_lider, true) RETURNING id INTO v_l_dep;
    INSERT INTO public.business_lines (code, name, leader_user_id, active)
    VALUES ('prueba_0850_tra', 'Prueba 0850 trauma', v_u_paola, true) RETURNING id INTO v_l_tra;
    INSERT INTO public.business_lines (code, name, leader_user_id, active)
    VALUES ('prueba_0850_sus', 'Prueba 0850 sustitutos', NULL, true) RETURNING id INTO v_l_sus;
    INSERT INTO public.business_lines (code, name, leader_user_id, active)
    VALUES ('prueba_0850_dir', 'Prueba 0850 de la directora', v_u_dir, true) RETURNING id INTO v_l_dir;
    INSERT INTO public.business_lines (code, name, leader_user_id, active)
    VALUES ('prueba_0850_inactiva', 'Prueba 0850 inactiva', v_u_lider, false) RETURNING id INTO v_l_inactiva;

    INSERT INTO public.executives (full_name, user_id, base_kam_id, status, started_at)
    VALUES ('Ejecutiva Paola de prueba 0850', v_u_paola, v_kam, 'active', v_hoy - 100) RETURNING id INTO v_e_paola;
    INSERT INTO public.executives (full_name, user_id, base_kam_id, status, started_at)
    VALUES ('Ejecutivo de prueba 0850', v_u_ec, v_kam, 'active', v_hoy - 100) RETURNING id INTO v_e_ec;
    INSERT INTO public.executives (full_name, user_id, base_kam_id, status, started_at)
    VALUES ('Ejecutivo que sale de prueba 0850', v_u_sale, v_kam, 'active', v_hoy - 100) RETURNING id INTO v_e_sale;
    INSERT INTO public.executive_lines (executive_id, line_id)
    VALUES (v_e_paola, v_l_sus), (v_e_ec, v_l_dep), (v_e_sale, v_l_sus);

    INSERT INTO public.cuentas (nombre, clase, tipo_identificacion, numero_identificacion)
    VALUES ('Cuenta de prueba 0850', 'clinica', 'otro', 'PRUEBA0850C1') RETURNING id INTO v_c1;
    INSERT INTO public.sedes (cuenta_id, nombre, es_principal, municipality_id, ciudad, lat, lng)
    VALUES (v_c1, 'Sede de prueba 0850', true, '11001', 'Bogotá', 4.6, -74.08) RETURNING id INTO v_s1;
    INSERT INTO public.subtipos_institucionales (codigo, nombre, para_que, roles_sugeridos, orden, vigente_desde)
    VALUES ('prueba_0850_vigente', 'Prueba 0850 vigente', 'Prueba de la migración 0850', '{compras}', 994, v_hoy - 10)
    RETURNING id INTO v_sub;

    v_m_dep1 := public.terceros_crear_medico(jsonb_build_object('tipo_documento', 'otro', 'numero_documento', 'PRUEBA0850M1',
                  'nombre', 'Médico de prueba 0850 DEP1', 'especialidades', jsonb_build_array('ortopedia'), 'municipality_id', '11001'),
                  jsonb_build_array(jsonb_build_object('sede_id', v_s1, 'rol', 'atiende', 'principal', true)), v_u_lider);
    v_m_dep2 := public.terceros_crear_medico(jsonb_build_object('tipo_documento', 'otro', 'numero_documento', 'PRUEBA0850M2',
                  'nombre', 'Médico de prueba 0850 DEP2', 'especialidades', jsonb_build_array('ortopedia'), 'municipality_id', '11001'),
                  jsonb_build_array(jsonb_build_object('sede_id', v_s1, 'rol', 'atiende', 'principal', true)), v_u_lider);
    v_m_ajeno := public.terceros_crear_medico(jsonb_build_object('tipo_documento', 'otro', 'numero_documento', 'PRUEBA0850M3',
                  'nombre', 'Médico de prueba 0850 AJENO', 'especialidades', jsonb_build_array('ortopedia'), 'municipality_id', '11001'),
                  jsonb_build_array(jsonb_build_object('sede_id', v_s1, 'rol', 'atiende', 'principal', true)), v_u_lider);
    v_m_vencido := public.terceros_crear_medico(jsonb_build_object('tipo_documento', 'otro', 'numero_documento', 'PRUEBA0850M4',
                  'nombre', 'Médico de prueba 0850 VENCIDO', 'especialidades', jsonb_build_array('ortopedia'), 'municipality_id', '11001'),
                  jsonb_build_array(jsonb_build_object('sede_id', v_s1, 'rol', 'atiende', 'principal', true)), v_u_lider);
    v_m_tra := public.terceros_crear_medico(jsonb_build_object('tipo_documento', 'otro', 'numero_documento', 'PRUEBA0850M5',
                  'nombre', 'Médico de prueba 0850 TRA', 'especialidades', jsonb_build_array('ortopedia'), 'municipality_id', '11001'),
                  jsonb_build_array(jsonb_build_object('sede_id', v_s1, 'rol', 'atiende', 'principal', true)), v_u_lider);
    v_m_sus := public.terceros_crear_medico(jsonb_build_object('tipo_documento', 'otro', 'numero_documento', 'PRUEBA0850M6',
                  'nombre', 'Médico de prueba 0850 SUS', 'especialidades', jsonb_build_array('ortopedia'), 'municipality_id', '11001'),
                  jsonb_build_array(jsonb_build_object('sede_id', v_s1, 'rol', 'atiende', 'principal', true)), v_u_lider);
    v_m_x1 := public.terceros_crear_medico(jsonb_build_object('tipo_documento', 'otro', 'numero_documento', 'PRUEBA0850M7',
                  'nombre', 'Médico de prueba 0850 X1', 'especialidades', jsonb_build_array('ortopedia'), 'municipality_id', '11001'),
                  jsonb_build_array(jsonb_build_object('sede_id', v_s1, 'rol', 'atiende', 'principal', true)), v_u_lider);
    v_m_x2 := public.terceros_crear_medico(jsonb_build_object('tipo_documento', 'otro', 'numero_documento', 'PRUEBA0850M8',
                  'nombre', 'Médico de prueba 0850 X2', 'especialidades', jsonb_build_array('ortopedia'), 'municipality_id', '11001'),
                  jsonb_build_array(jsonb_build_object('sede_id', v_s1, 'rol', 'atiende', 'principal', true)), v_u_lider);
    v_m_x3 := public.terceros_crear_medico(jsonb_build_object('tipo_documento', 'otro', 'numero_documento', 'PRUEBA0850M9',
                  'nombre', 'Médico de prueba 0850 X3', 'especialidades', jsonb_build_array('ortopedia'), 'municipality_id', '11001'),
                  jsonb_build_array(jsonb_build_object('sede_id', v_s1, 'rol', 'atiende', 'principal', true)), v_u_lider);
    -- Visitantes (C9): DEP1 en la línea deportiva (de la líder); DEP2 por un Ejecutivo Comercial de la deportiva en
    -- otra línea; AJENO de otra línea y de otro Ejecutivo Comercial; VENCIDO en la deportiva hasta ayer; TRA en trauma;
    -- SUS, de Paola como Ejecutiva; X1..X3 del Ejecutivo de la deportiva.
    INSERT INTO public.medico_visitantes (medico_id, executive_id, line_id, desde, hasta)
    VALUES (v_m_dep1, v_e_ec, v_l_dep, v_hoy - 30, NULL),
           (v_m_dep2, v_e_ec, v_l_sus, v_hoy - 30, NULL),
           (v_m_ajeno, v_e_sale, v_l_sus, v_hoy - 30, NULL),
           (v_m_vencido, v_e_sale, v_l_dep, v_hoy - 30, v_hoy - 1),
           (v_m_tra, v_e_sale, v_l_tra, v_hoy - 30, NULL),
           (v_m_sus, v_e_paola, v_l_sus, v_hoy - 30, NULL),
           (v_m_x1, v_e_ec, v_l_dep, v_hoy - 30, NULL),
           (v_m_x2, v_e_ec, v_l_dep, v_hoy - 30, NULL),
           (v_m_x3, v_e_ec, v_l_dep, v_hoy - 30, NULL);
    INSERT INTO public.dias_libres (executive_id, fecha, fraccion, motivo, estado, revisado_at)
    VALUES (v_e_ec, v_d_libre, 1, 'vacaciones', 'aprobado', now());

    -- A. Quién es quién -----------------------------------------------------------------------------------------------
    v_r := public.persona_de_campo(v_u_lider);
    IF v_r ->> 'rol' <> 'lider' OR v_r ->> 'executive_id' IS NOT NULL OR v_r -> 'lineas_lider' <> jsonb_build_array(v_l_dep)
       OR v_r -> 'lineas_ec' <> '[]'::jsonb OR v_r ->> 'nombre' <> 'Líder de prueba 0850' THEN
      RAISE EXCEPTION '0850 persona: la líder sin Ejecutivo Comercial no quedó como se esperaba (la línea inactiva no cuenta): %', v_r;
    END IF;
    v_r := public.persona_de_campo(v_u_paola);
    IF v_r ->> 'rol' <> 'lider_y_ejecutivo' OR (v_r ->> 'executive_id')::uuid <> v_e_paola OR (v_r ->> 'kam_id')::uuid <> v_kam
       OR v_r -> 'lineas_ec' <> jsonb_build_array(v_l_sus) OR v_r -> 'lineas_lider' <> jsonb_build_array(v_l_tra) THEN
      RAISE EXCEPTION '0850 persona: la líder que también es Ejecutiva no quedó como se esperaba: %', v_r;
    END IF;
    v_r := public.persona_de_campo(v_u_ec);
    IF v_r ->> 'rol' <> 'ejecutivo' OR (v_r ->> 'executive_id')::uuid <> v_e_ec THEN
      RAISE EXCEPTION '0850 persona: el Ejecutivo Comercial no quedó como se esperaba: %', v_r;
    END IF;
    IF cardinality(public.persona_lineas(v_u_sin)) <> 0 OR cardinality(public.persona_lineas(v_u_dir)) <> 0
       OR public.persona_lineas(v_u_paola) IS DISTINCT FROM ARRAY(SELECT x FROM unnest(ARRAY[v_l_sus, v_l_tra]) AS t(x) ORDER BY x) THEN
      RAISE EXCEPTION '0850 persona_lineas: sin líneas o la directora con líneas, o Paola sin la unión';
    END IF;
    IF public.ejecutivo_de_la_visita(v_u_paola, ARRAY[v_l_tra]) IS NOT NULL
       OR public.ejecutivo_de_la_visita(v_u_paola, ARRAY[v_l_sus]) IS DISTINCT FROM v_e_paola
       OR public.ejecutivo_de_la_visita(v_u_paola, ARRAY[v_l_tra, v_l_sus]) IS DISTINCT FROM v_e_paola
       OR public.ejecutivo_de_la_visita(v_u_lider, ARRAY[v_l_dep]) IS NOT NULL THEN
      RAISE EXCEPTION '0850 ejecutivo_de_la_visita: no da el Ejecutivo Comercial según las líneas';
    END IF;
    IF NOT public.medico_de_lineas(v_m_dep1, ARRAY[v_l_dep], v_hoy) OR NOT public.medico_de_lineas(v_m_dep2, ARRAY[v_l_dep], v_hoy)
       OR public.medico_de_lineas(v_m_vencido, ARRAY[v_l_dep], v_hoy) OR public.medico_de_lineas(v_m_ajeno, ARRAY[v_l_dep], v_hoy)
       OR NOT public.medico_de_lineas(v_m_tra, ARRAY[v_l_tra], v_hoy) OR NOT public.medico_de_lineas(v_m_vencido, ARRAY[v_l_dep], v_hoy - 1) THEN
      RAISE EXCEPTION '0850 medico_de_lineas: no cumple la regla C9';
    END IF;
    v_r := public.visitas_config_persona(NULL, v_hoy);
    IF v_r -> 'perfil' <> '["medica", "institucional"]'::jsonb OR (v_r #>> '{telefonica,habilitada}')::boolean
       OR (v_r ->> 'radio_m')::int <> 500 THEN
      RAISE EXCEPTION '0850 visitas_config_persona sin Ejecutivo Comercial: debía ser la general sin telefónica: %', v_r;
    END IF;
    FOR v_caso IN
      SELECT * FROM (VALUES
        ('persona sin líneas', format('SELECT public.persona_de_campo(%L::uuid)', v_u_sin), '23514', c_sin_lineas),
        ('persona: la directora aunque lidere una línea', format('SELECT public.persona_de_campo(%L::uuid)', v_u_dir), '23514', c_direccion),
        ('persona: usuario inexistente', format('SELECT public.persona_de_campo(%L::uuid)', gen_random_uuid()), '23514', c_sin_lineas)
      ) AS t(nombre, sentencia, estado, mensaje)
    LOOP
      BEGIN
        EXECUTE v_caso.sentencia;
        RAISE EXCEPTION '0850: se aceptó %', v_caso.nombre;
      EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_estado = RETURNED_SQLSTATE, v_msg = MESSAGE_TEXT;
        IF v_estado IS DISTINCT FROM v_caso.estado OR NOT (v_msg LIKE v_caso.mensaje) THEN
          RAISE EXCEPTION '0850: el caso "%" devolvió % (%) y se esperaba % (%)', v_caso.nombre, v_estado, v_msg, v_caso.estado, v_caso.mensaje;
        END IF;
      END;
    END LOOP;
    v_casos := v_casos || 'quién es quién: líder, líder y Ejecutiva, Ejecutivo, sin líneas, directora (A1), papel por líneas, médico de las líneas (C9) y configuración general'::text;

    -- B. Una líder sin Ejecutivo Comercial agenda y reporta ----------------------------------------------------------
    v_cita := jsonb_build_object('fecha', v_hoy + 1, 'hora', '09:00', 'tipo', 'medica', 'medico_id', v_m_dep1, 'sede_id', v_s1);
    v_cita_l1 := (public.agenda_crear(v_cita, v_u_lider) ->> 'cita_id')::uuid;
    SELECT * INTO v_fila FROM public.visitas_agenda a WHERE a.id = v_cita_l1;
    IF v_fila.user_id <> v_u_lider OR v_fila.executive_id IS NOT NULL OR v_fila.estado <> 'pendiente' OR v_fila.hora <> time '09:00'
       OR v_fila.created_by <> v_u_lider THEN
      RAISE EXCEPTION '0850 líder: la cita no quedó como se esperaba: %', to_jsonb(v_fila);
    END IF;
    FOR v_caso IN
      SELECT * FROM (VALUES
        ('líder: médico de otra línea', format('SELECT public.agenda_crear(%L::jsonb, %L::uuid)', v_cita || jsonb_build_object('medico_id', v_m_ajeno, 'hora', '11:00'), v_u_lider), '23514', c_medico_ajeno),
        ('líder: médico con el visitante vencido', format('SELECT public.agenda_crear(%L::jsonb, %L::uuid)', v_cita || jsonb_build_object('medico_id', v_m_vencido, 'hora', '11:00'), v_u_lider), '23514', c_medico_ajeno),
        ('agenda: usuario sin líneas', format('SELECT public.agenda_crear(%L::jsonb, %L::uuid)', v_cita, v_u_sin), '23514', c_sin_lineas),
        ('agenda: la directora', format('SELECT public.agenda_crear(%L::jsonb, %L::uuid)', v_cita, v_u_dir), '23514', c_direccion),
        ('líder: como Ejecutivo Comercial sin serlo', format('SELECT public.agenda_crear(%L::jsonb, %L::uuid)', v_cita || '{"como": "ejecutivo"}'::jsonb, v_u_lider), '23514', c_sin_ejec),
        ('Ejecutivo: como líder sin liderar', format('SELECT public.agenda_crear(%L::jsonb, %L::uuid)', v_cita || '{"como": "lider", "hora": "13:00"}'::jsonb, v_u_ec), '23514', 'No lideras ninguna línea: agenda como Ejecutivo Comercial'),
        ('como no válido', format('SELECT public.agenda_crear(%L::jsonb, %L::uuid)', v_cita || '{"como": "jefe"}'::jsonb, v_u_lider), '22023', 'Como no válido: ejecutivo o lider'),
        ('sin hora', format('SELECT public.agenda_crear(%L::jsonb, %L::uuid)', v_cita - 'hora', v_u_lider), '22023', 'Elige la hora de la cita')
      ) AS t(nombre, sentencia, estado, mensaje)
    LOOP
      BEGIN
        EXECUTE v_caso.sentencia;
        RAISE EXCEPTION '0850: se aceptó %', v_caso.nombre;
      EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_estado = RETURNED_SQLSTATE, v_msg = MESSAGE_TEXT;
        IF v_estado IS DISTINCT FROM v_caso.estado OR NOT (v_msg LIKE v_caso.mensaje) THEN
          RAISE EXCEPTION '0850: el caso "%" devolvió % (%) y se esperaba % (%)', v_caso.nombre, v_estado, v_msg, v_caso.estado, v_caso.mensaje;
        END IF;
      END;
    END LOOP;
    -- Una cita de hoy de la líder, creada ayer (directa): su visita la cumple y cuenta como agendada.
    INSERT INTO public.visitas_agenda (user_id, executive_id, fecha, tipo, medico_id, sede_id, created_by, created_at)
    VALUES (v_u_lider, NULL, v_hoy, 'medica', v_m_dep1, v_s1, v_u_lider, now() - interval '1 day') RETURNING id INTO v_cita_l_hoy;
    v_visita := jsonb_build_object('tipo', 'medica', 'medico_id', v_m_dep1, 'sede_id', v_s1, 'modalidad', 'presencial',
                                   'efectiva', true, 'checked_in_at', now(), 'reported_at', now(), 'lat', 4.603, 'lng', -74.08,
                                   'input_mode', 'toques', 'lineas', jsonb_build_array(v_l_dep));
    v_r := public.visitas_registrar(v_visita || jsonb_build_object('client_id', gen_random_uuid()), v_u_lider);
    v_visita_l := (v_r ->> 'visita_id')::uuid;
    SELECT * INTO v_fila FROM public.visits v WHERE v.id = v_visita_l;
    IF v_fila.user_id <> v_u_lider OR v_fila.executive_id IS NOT NULL OR v_fila.kam_id IS NOT NULL
       OR v_fila.kam_name <> 'Líder de prueba 0850' OR v_fila.out_of_territory OR v_fila.distance_m <> 334
       OR v_fila.agenda_id IS DISTINCT FROM v_cita_l_hoy OR NOT v_fila.agendada THEN
      RAISE EXCEPTION '0850 líder: la visita no quedó como se esperaba (sin Ejecutivo Comercial ni zona, con su cita): %', to_jsonb(v_fila);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.visit_lines vl WHERE vl.visit_id = v_visita_l AND vl.line_id = v_l_dep)
       OR NOT EXISTS (SELECT 1 FROM public.visitas_agenda a WHERE a.id = v_cita_l_hoy AND a.estado = 'hecha' AND a.visita_id = v_visita_l) THEN
      RAISE EXCEPTION '0850 líder: faltan la línea de la visita o la cita hecha';
    END IF;
    FOR v_caso IN
      SELECT * FROM (VALUES
        ('visita de líder con una línea ajena', format('SELECT public.visitas_registrar(%L::jsonb, %L::uuid)', v_visita || jsonb_build_object('client_id', gen_random_uuid(), 'lineas', jsonb_build_array(v_l_sus)), v_u_lider), '23514', c_lineas),
        ('visita de líder con un médico ajeno', format('SELECT public.visitas_registrar(%L::jsonb, %L::uuid)', v_visita || jsonb_build_object('client_id', gen_random_uuid(), 'medico_id', v_m_ajeno), v_u_lider), '23514', c_medico_ajeno),
        ('visita de líder telefónica', format('SELECT public.visitas_registrar(%L::jsonb, %L::uuid)', v_visita || jsonb_build_object('client_id', gen_random_uuid(), 'medico_id', v_m_dep2, 'modalidad', 'telefonica', 'medio', 'llamada'), v_u_lider), '23514', 'No tienes habilitada la visita telefónica'),
        ('visita de un usuario sin líneas', format('SELECT public.visitas_registrar(%L::jsonb, %L::uuid)', v_visita || jsonb_build_object('client_id', gen_random_uuid()), v_u_sin), '23514', c_sin_lineas),
        ('visita de la directora', format('SELECT public.visitas_registrar(%L::jsonb, %L::uuid)', v_visita || jsonb_build_object('client_id', gen_random_uuid()), v_u_dir), '23514', c_direccion),
        ('visita con el Ejecutivo Comercial de otra persona', format('SELECT public.visitas_registrar(%L::jsonb, %L::uuid)', v_visita || jsonb_build_object('client_id', gen_random_uuid(), 'executive_id', v_e_ec), v_u_lider), '23514', 'Ese Ejecutivo Comercial no es el tuyo'),
        ('client_id de la visita de otra persona', format('SELECT public.visitas_registrar(%L::jsonb, %L::uuid)', v_visita || jsonb_build_object('client_id', (SELECT v.client_id FROM public.visits v WHERE v.id = v_visita_l), 'lineas', jsonb_build_array(v_l_dep)), v_u_ec), '23505', 'Ese client_id ya se usó en otra visita'),
        ('corregir la visita de otra persona', format('SELECT public.visitas_editar(%L::uuid, %L::jsonb, %L::uuid)', v_visita_l, '{"conclusion": "Prueba 0850"}', v_u_ec), 'P0002', 'Esa visita no existe'),
        ('corregir la visita con una línea ajena', format('SELECT public.visitas_editar(%L::uuid, %L::jsonb, %L::uuid)', v_visita_l, jsonb_build_object('lineas', jsonb_build_array(v_l_sus)), v_u_lider), '23514', c_lineas),
        ('anular la visita de otra persona', format('SELECT public.visitas_anular(%L::uuid, %L, %L::uuid)', v_visita_l, 'Prueba 0850 ajena', v_u_ec), 'P0002', 'Esa visita no existe')
      ) AS t(nombre, sentencia, estado, mensaje)
    LOOP
      BEGIN
        EXECUTE v_caso.sentencia;
        RAISE EXCEPTION '0850: se aceptó %', v_caso.nombre;
      EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_estado = RETURNED_SQLSTATE, v_msg = MESSAGE_TEXT;
        IF v_estado IS DISTINCT FROM v_caso.estado OR NOT (v_msg LIKE v_caso.mensaje) THEN
          RAISE EXCEPTION '0850: el caso "%" devolvió % (%) y se esperaba % (%)', v_caso.nombre, v_estado, v_msg, v_caso.estado, v_caso.mensaje;
        END IF;
      END;
    END LOOP;
    PERFORM public.visitas_editar(v_visita_l, '{"conclusion": "Prueba 0850: corregida", "executive_id": null}'::jsonb, v_u_lider);
    IF (SELECT v.conclusion FROM public.visits v WHERE v.id = v_visita_l) IS DISTINCT FROM 'Prueba 0850: corregida' THEN
      RAISE EXCEPTION '0850 líder: no pudo corregir su visita';
    END IF;
    PERFORM public.visitas_anular(v_visita_l, 'Prueba 0850: anular la de la líder', v_u_lider);
    IF NOT EXISTS (SELECT 1 FROM public.visitas_agenda a WHERE a.id = v_cita_l_hoy AND a.estado = 'pendiente' AND a.visita_id IS NULL) THEN
      RAISE EXCEPTION '0850 líder: al anular, su cita debía volver a pendiente';
    END IF;
    v_casos := v_casos || 'una líder sin Ejecutivo Comercial agenda y reporta (sin zona, nunca fuera de territorio, con su cita); línea ajena, médico ajeno, telefónica, sin líneas, directora, Ejecutivo ajeno, client_id ajeno; corrige y anula lo suyo, no lo ajeno'::text;

    -- C. Paola: líder de trauma y Ejecutiva de sustitutos, una sola agenda ------------------------------------------
    v_r := public.visitas_registrar(v_visita || jsonb_build_object('client_id', gen_random_uuid(), 'medico_id', v_m_tra,
                                      'lineas', jsonb_build_array(v_l_tra)), v_u_paola);
    v_visita_tra := (v_r ->> 'visita_id')::uuid;
    v_r := public.visitas_registrar(v_visita || jsonb_build_object('client_id', gen_random_uuid(), 'medico_id', v_m_sus,
                                      'lineas', jsonb_build_array(v_l_sus)), v_u_paola);
    v_visita_sus := (v_r ->> 'visita_id')::uuid;
    IF NOT EXISTS (SELECT 1 FROM public.visits v WHERE v.id = v_visita_tra AND v.executive_id IS NULL AND v.kam_id IS NULL
                     AND v.user_id = v_u_paola AND NOT v.out_of_territory)
       OR NOT EXISTS (SELECT 1 FROM public.visits v WHERE v.id = v_visita_sus AND v.executive_id = v_e_paola AND v.kam_id = v_kam
                        AND v.user_id = v_u_paola AND v.kam_name = 'Ejecutiva Paola de prueba 0850' AND NOT v.out_of_territory) THEN
      RAISE EXCEPTION '0850 Paola: la de trauma debía quedar sin Ejecutivo Comercial y la de sustitutos con el suyo';
    END IF;
    v_c_p_lider := (public.agenda_crear(jsonb_build_object('fecha', v_hoy + 1, 'hora', '10:00', 'tipo', 'medica',
                      'medico_id', v_m_tra, 'sede_id', v_s1, 'como', 'lider'), v_u_paola) ->> 'cita_id')::uuid;
    v_c_p_ec := (public.agenda_crear(jsonb_build_object('fecha', v_hoy + 1, 'hora', '11:00', 'tipo', 'medica',
                   'medico_id', v_m_sus, 'sede_id', v_s1), v_u_paola) ->> 'cita_id')::uuid;
    IF (SELECT a.executive_id FROM public.visitas_agenda a WHERE a.id = v_c_p_lider) IS NOT NULL
       OR (SELECT a.executive_id FROM public.visitas_agenda a WHERE a.id = v_c_p_ec) IS DISTINCT FROM v_e_paola THEN
      RAISE EXCEPTION '0850 Paola: la cita como líder va sin Ejecutivo Comercial y la de por defecto con el suyo';
    END IF;
    FOR v_caso IN
      SELECT * FROM (VALUES
        ('Paola: el mismo médico como Ejecutiva el mismo día (un solo tope)', format('SELECT public.visitas_registrar(%L::jsonb, %L::uuid)', v_visita || jsonb_build_object('client_id', gen_random_uuid(), 'medico_id', v_m_tra, 'lineas', jsonb_build_array(v_l_sus)), v_u_paola), '23514', 'Ya reportaste una visita a este médico hoy'),
        ('Paola: corregir la de trauma a sustitutos (cambia el papel)', format('SELECT public.visitas_editar(%L::uuid, %L::jsonb, %L::uuid)', v_visita_tra, jsonb_build_object('lineas', jsonb_build_array(v_l_sus)), v_u_paola), '23514', 'Para cambiar el papel de la visita%'),
        ('Paola: una cita como Ejecutiva que se cruza con la de líder (una sola agenda)', format('SELECT public.agenda_crear(%L::jsonb, %L::uuid)', jsonb_build_object('fecha', v_hoy + 1, 'hora', '10:15', 'tipo', 'medica', 'medico_id', v_m_dep1, 'sede_id', v_s1, 'como', 'ejecutivo'), v_u_paola), '23P01', 'A las 10:00 ya tienes cita con Médico de prueba 0850 TRA: elige otra hora'),
        ('Paola: el mismo médico el mismo día con el otro papel', format('SELECT public.agenda_crear(%L::jsonb, %L::uuid)', jsonb_build_object('fecha', v_hoy + 1, 'hora', '15:00', 'tipo', 'medica', 'medico_id', v_m_tra, 'sede_id', v_s1, 'como', 'ejecutivo'), v_u_paola), '23505', 'Ya tienes una cita con ese médico ese día')
      ) AS t(nombre, sentencia, estado, mensaje)
    LOOP
      BEGIN
        EXECUTE v_caso.sentencia;
        RAISE EXCEPTION '0850: se aceptó %', v_caso.nombre;
      EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_estado = RETURNED_SQLSTATE, v_msg = MESSAGE_TEXT;
        IF v_estado IS DISTINCT FROM v_caso.estado OR NOT (v_msg LIKE v_caso.mensaje) THEN
          RAISE EXCEPTION '0850: el caso "%" devolvió % (%) y se esperaba % (%)', v_caso.nombre, v_estado, v_msg, v_caso.estado, v_caso.mensaje;
        END IF;
      END;
    END LOOP;
    v_casos := v_casos || 'Paola: trauma sin Ejecutivo Comercial y sustitutos con el suyo, una sola agenda (choque y duplicado entre papeles) y un solo tope por médico; no cambia el papel al corregir'::text;

    -- D. Choque de media hora, ventana sin tope y hora pasada (el Ejecutivo de la deportiva) ------------------------
    v_cita := jsonb_build_object('fecha', v_hoy + 2, 'hora', '09:00', 'tipo', 'medica', 'medico_id', v_m_x1, 'sede_id', v_s1);
    PERFORM public.agenda_crear(v_cita, v_u_ec);
    FOR v_caso IN
      SELECT * FROM (VALUES
        ('choque: 09:00 contra 09:15', format('SELECT public.agenda_crear(%L::jsonb, %L::uuid)', v_cita || jsonb_build_object('medico_id', v_m_x2, 'hora', '09:15'), v_u_ec), '23P01', 'A las 09:00 ya tienes cita con Médico de prueba 0850 X1: elige otra hora'),
        ('choque: 09:00 contra 08:31', format('SELECT public.agenda_crear(%L::jsonb, %L::uuid)', v_cita || jsonb_build_object('medico_id', v_m_x2, 'hora', '08:31'), v_u_ec), '23P01', 'A las 09:00 ya tienes cita%'),
        ('en el pasado (ayer)', format('SELECT public.agenda_crear(%L::jsonb, %L::uuid)', v_cita || jsonb_build_object('medico_id', v_m_x2, 'fecha', v_hoy - 1), v_u_ec), '23514', 'No se agenda en el pasado: elige hoy o una fecha posterior'),
        ('en un día libre aprobado (con Ejecutivo Comercial)', format('SELECT public.agenda_crear(%L::jsonb, %L::uuid)', v_cita || jsonb_build_object('fecha', v_d_libre), v_u_ec), '23514', 'Ese día lo tienes libre (día libre aprobado): no se agenda')
      ) AS t(nombre, sentencia, estado, mensaje)
    LOOP
      BEGIN
        EXECUTE v_caso.sentencia;
        RAISE EXCEPTION '0850: se aceptó %', v_caso.nombre;
      EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_estado = RETURNED_SQLSTATE, v_msg = MESSAGE_TEXT;
        IF v_estado IS DISTINCT FROM v_caso.estado OR NOT (v_msg LIKE v_caso.mensaje) THEN
          RAISE EXCEPTION '0850: el caso "%" devolvió % (%) y se esperaba % (%)', v_caso.nombre, v_estado, v_msg, v_caso.estado, v_caso.mensaje;
        END IF;
      END;
    END LOOP;
    PERFORM public.agenda_crear(v_cita || jsonb_build_object('medico_id', v_m_x2, 'hora', '09:30'), v_u_ec);  -- 30 min: sí
    PERFORM public.agenda_crear(v_cita || jsonb_build_object('medico_id', v_m_x3, 'hora', '08:30'), v_u_ec);  -- 30 min antes: sí
    -- Las citas sin hora (viejas), las que no se hicieron y las canceladas no chocan.
    INSERT INTO public.visitas_agenda (user_id, executive_id, fecha, tipo, medico_id, sede_id, created_by)
    VALUES (v_u_ec, v_e_ec, v_hoy + 3, 'medica', v_m_x1, v_s1, v_u_ec);
    INSERT INTO public.visitas_agenda (user_id, executive_id, fecha, hora, tipo, medico_id, sede_id, estado, no_realizada_at,
                                       motivo_codigo, created_by)
    VALUES (v_u_ec, v_e_ec, v_hoy + 3, '13:00', 'medica', v_m_x2, v_s1, 'no_realizada', now(), 'cliente', v_u_ec);
    v_id1 := (public.agenda_crear(jsonb_build_object('fecha', v_hoy + 3, 'hora', '15:00', 'tipo', 'medica', 'medico_id', v_m_x3,
                                                     'sede_id', v_s1), v_u_ec) ->> 'cita_id')::uuid;
    PERFORM public.agenda_cancelar(v_id1, NULL, v_u_ec, 'cliente');
    IF public.agenda_choque(v_u_ec, v_hoy + 3, time '13:00', NULL) IS NOT NULL
       OR public.agenda_choque(v_u_ec, v_hoy + 3, time '15:00', NULL) IS NOT NULL THEN
      RAISE EXCEPTION '0850 choque: una cita sin hora, una no_realizada o una cancelada no debían chocar';
    END IF;
    PERFORM public.agenda_crear(jsonb_build_object('fecha', v_hoy + 3, 'hora', '13:00', 'tipo', 'medica', 'medico_id', v_m_dep1,
                                                   'sede_id', v_s1), v_u_ec);
    PERFORM public.agenda_crear(jsonb_build_object('fecha', v_hoy + 3, 'hora', '15:00', 'tipo', 'medica', 'medico_id', v_m_x2,
                                                   'sede_id', v_s1), v_u_ec);
    -- Sin tope hacia adelante (A4); hoy a una hora que ya pasó, no (C13).
    PERFORM public.agenda_crear(jsonb_build_object('fecha', v_hoy + 400, 'hora', '10:00', 'tipo', 'medica', 'medico_id', v_m_x1,
                                                   'sede_id', v_s1), v_u_ec);
    IF (now() AT TIME ZONE 'America/Bogota')::time >= time '00:01' THEN
      BEGIN
        PERFORM public.agenda_crear(jsonb_build_object('fecha', v_hoy, 'hora', '00:00', 'tipo', 'medica', 'medico_id', v_m_x1,
                                                       'sede_id', v_s1), v_u_ec);
        RAISE EXCEPTION '0850: se aceptó una cita de hoy a una hora que ya pasó';
      EXCEPTION WHEN check_violation THEN
        GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
        IF v_msg <> 'Esa hora ya pasó' THEN
          RAISE EXCEPTION '0850 hora pasada: mensaje inesperado (%)', v_msg;
        END IF;
      END;
    ELSE
      RAISE NOTICE '0850: son las 00:00 en Bogotá; no se prueba la hora pasada';
    END IF;
    -- Como líder no se mira el día libre (no tiene Ejecutivo Comercial): la líder sí agenda ese día.
    PERFORM public.agenda_crear(jsonb_build_object('fecha', v_d_libre, 'hora', '09:00', 'tipo', 'medica', 'medico_id', v_m_dep1,
                                                   'sede_id', v_s1), v_u_lider);
    v_casos := v_casos || 'choque de media hora (09:15 y 08:31 no; 09:30 y 08:30 sí; sin hora, no_realizada y cancelada no chocan), hoy + 400 sí, ayer y hora pasada no, día libre solo con Ejecutivo Comercial'::text;

    -- E. Ciclo de vida: cerrar, cancelar con motivo, eliminar por error y otra fecha ---------------------------------
    INSERT INTO public.visitas_agenda (user_id, executive_id, fecha, hora, tipo, medico_id, sede_id, created_by, created_at)
    VALUES (v_u_ec, v_e_ec, v_hoy - 1, '09:00', 'medica', v_m_x1, v_s1, v_u_ec, now() - interval '3 days') RETURNING id INTO v_cita_ayer;
    INSERT INTO public.visitas_agenda (user_id, executive_id, fecha, hora, tipo, medico_id, sede_id, created_by, created_at)
    VALUES (v_u_ec, v_e_ec, v_hoy - 1, '11:00', 'medica', v_m_x2, v_s1, v_u_ec, now() - interval '3 days') RETURNING id INTO v_cita_ayer2;
    v_c_manana := (public.agenda_crear(jsonb_build_object('fecha', v_hoy + 1, 'hora', '16:00', 'tipo', 'medica',
                     'medico_id', v_m_x1, 'sede_id', v_s1), v_u_ec) ->> 'cita_id')::uuid;
    -- Hoy: una (M X2, creada ayer) que su visita efectiva cumple; otra (M X3) que se cierra el mismo día.
    INSERT INTO public.visitas_agenda (user_id, executive_id, fecha, tipo, medico_id, sede_id, created_by, created_at)
    VALUES (v_u_ec, v_e_ec, v_hoy, 'medica', v_m_x2, v_s1, v_u_ec, now() - interval '1 day') RETURNING id INTO v_cita_hoy_h;
    INSERT INTO public.visitas_agenda (user_id, executive_id, fecha, tipo, medico_id, sede_id, created_by, created_at)
    VALUES (v_u_ec, v_e_ec, v_hoy, 'medica', v_m_x3, v_s1, v_u_ec, now() - interval '1 day') RETURNING id INTO v_cita_hoy_p;
    v_r := public.visitas_registrar(v_visita || jsonb_build_object('client_id', gen_random_uuid(), 'medico_id', v_m_x2), v_u_ec);
    IF (v_r ->> 'agenda_id')::uuid IS DISTINCT FROM v_cita_hoy_h OR NOT (v_r ->> 'agendada')::boolean THEN
      RAISE EXCEPTION '0850 vínculo por persona: la visita del Ejecutivo debía cumplir su cita de hoy: %', v_r;
    END IF;

    v_r := public.agenda_cerrar(v_cita_ayer, '{"motivo_codigo": "cliente"}'::jsonb, v_u_ec);
    SELECT * INTO v_fila FROM public.visitas_agenda a WHERE a.id = v_cita_ayer;
    IF v_r ->> 'estado' <> 'no_realizada' OR v_fila.estado <> 'no_realizada' OR v_fila.no_realizada_at IS NULL
       OR v_fila.motivo_codigo <> 'cliente' OR v_fila.no_realizada_motivo IS NOT NULL THEN
      RAISE EXCEPTION '0850 cerrar: la de ayer debía quedar "no se hizo" con su motivo: %', to_jsonb(v_fila);
    END IF;
    PERFORM public.agenda_cerrar(v_cita_hoy_p, '{"motivo_codigo": "otro", "motivo": "  El cliente cambió la agenda  "}'::jsonb, v_u_ec);
    IF (SELECT a.no_realizada_motivo FROM public.visitas_agenda a WHERE a.id = v_cita_hoy_p) IS DISTINCT FROM 'El cliente cambió la agenda' THEN
      RAISE EXCEPTION '0850 cerrar: la de hoy con motivo otro debía guardar el texto';
    END IF;
    v_c_cancel := (public.agenda_crear(jsonb_build_object('fecha', v_hoy + 5, 'hora', '09:00', 'tipo', 'medica',
                     'medico_id', v_m_x1, 'sede_id', v_s1), v_u_ec) ->> 'cita_id')::uuid;
    FOR v_caso IN
      SELECT * FROM (VALUES
        ('cerrar la de mañana', format('SELECT public.agenda_cerrar(%L::uuid, %L::jsonb, %L::uuid)', v_c_manana, '{"motivo_codigo": "cliente"}', v_u_ec), '23514', 'Esa cita todavía no llega: cancélala'),
        ('cerrar la de otra persona', format('SELECT public.agenda_cerrar(%L::uuid, %L::jsonb, %L::uuid)', v_cita_l1, '{"motivo_codigo": "cliente"}', v_u_ec), 'P0002', c_no_existe),
        ('cerrar una ya cerrada', format('SELECT public.agenda_cerrar(%L::uuid, %L::jsonb, %L::uuid)', v_cita_ayer, '{"motivo_codigo": "cliente"}', v_u_ec), '23514', c_cerrada),
        ('cerrar una hecha', format('SELECT public.agenda_cerrar(%L::uuid, %L::jsonb, %L::uuid)', v_cita_hoy_h, '{"motivo_codigo": "cliente"}', v_u_ec), '23514', c_cerrada),
        ('cerrar con el motivo de salida', format('SELECT public.agenda_cerrar(%L::uuid, %L::jsonb, %L::uuid)', v_cita_ayer2, '{"motivo_codigo": "salida"}', v_u_ec), '23514', 'El motivo "salida" lo pone el sistema'),
        ('cerrar con un motivo que no existe', format('SELECT public.agenda_cerrar(%L::uuid, %L::jsonb, %L::uuid)', v_cita_ayer2, '{"motivo_codigo": "raro"}', v_u_ec), '22023', 'Elige el motivo:%'),
        ('cerrar con otro y sin texto', format('SELECT public.agenda_cerrar(%L::uuid, %L::jsonb, %L::uuid)', v_cita_ayer2, '{"motivo_codigo": "otro", "motivo": "ab"}', v_u_ec), '23514', 'Escribe por qué no se hizo'),
        ('cerrar con un texto de 301', format('SELECT public.agenda_cerrar(%L::uuid, %L::jsonb, %L::uuid)', v_cita_ayer2, jsonb_build_object('motivo_codigo', 'otro', 'motivo', repeat('x', 301)), v_u_ec), '23514', 'El motivo no puede superar 300 caracteres'),
        ('cancelar sin motivo (3 argumentos, como la app de hoy)', format('SELECT public.agenda_cancelar(p_id => %L::uuid, p_motivo => NULL, p_user => %L::uuid)', v_c_cancel, v_u_ec), '23514', 'Escribe el motivo de la cancelación'),
        ('cancelar con un texto muy corto', format('SELECT public.agenda_cancelar(%L::uuid, %L, %L::uuid)', v_c_cancel, 'ab', v_u_ec), '23514', 'Escribe el motivo de la cancelación'),
        ('cancelar con el motivo de salida', format('SELECT public.agenda_cancelar(%L::uuid, NULL, %L::uuid, %L)', v_c_cancel, v_u_ec, 'salida'), '23514', 'El motivo "salida" lo pone el sistema'),
        ('cancelar con un motivo que no existe', format('SELECT public.agenda_cancelar(%L::uuid, NULL, %L::uuid, %L)', v_c_cancel, v_u_ec, 'raro'), '22023', 'Elige el motivo:%'),
        ('cancelar la de ayer', format('SELECT public.agenda_cancelar(%L::uuid, %L, %L::uuid)', v_cita_ayer2, 'Prueba 0850', v_u_ec), '23514', 'Solo se cancelan las citas de hoy en adelante'),
        ('cancelar una que no se hizo', format('SELECT public.agenda_cancelar(%L::uuid, %L, %L::uuid)', v_cita_hoy_p, 'Prueba 0850', v_u_ec), '23514', c_cerrada),
        ('cancelar una hecha', format('SELECT public.agenda_cancelar(%L::uuid, %L, %L::uuid)', v_cita_hoy_h, 'Prueba 0850', v_u_ec), '23514', 'Esa cita ya tiene su visita: no se cancela'),
        ('cancelar la de otra persona', format('SELECT public.agenda_cancelar(%L::uuid, %L, %L::uuid)', v_cita_l1, 'Prueba 0850', v_u_ec), 'P0002', c_no_existe),
        ('eliminar una hecha', format('SELECT public.agenda_eliminar(%L::uuid, %L::uuid)', v_cita_hoy_h, v_u_ec), '23514', 'Solo se elimina una cita pendiente'),
        ('eliminar una de ayer', format('SELECT public.agenda_eliminar(%L::uuid, %L::uuid)', v_cita_ayer2, v_u_ec), '23514', 'Solo se eliminan las citas de hoy en adelante%'),
        ('eliminar la de otra persona', format('SELECT public.agenda_eliminar(%L::uuid, %L::uuid)', v_cita_l1, v_u_ec), 'P0002', c_no_existe),
        ('otra fecha de una pendiente', format('SELECT public.agenda_otra_fecha(%L::uuid, %L::jsonb, %L::uuid)', v_c_manana, jsonb_build_object('fecha', v_hoy + 7, 'hora', '09:00'), v_u_ec), '23514', 'Esa cita sigue programada: ciérrala o cancélala antes'),
        ('otra fecha de una hecha con visita efectiva', format('SELECT public.agenda_otra_fecha(%L::uuid, %L::jsonb, %L::uuid)', v_cita_hoy_h, jsonb_build_object('fecha', v_hoy + 7, 'hora', '09:00'), v_u_ec), '23514', 'Esa cita ya se hizo (visita efectiva): agenda una cita nueva'),
        ('otra fecha de la de otra persona', format('SELECT public.agenda_otra_fecha(%L::uuid, %L::jsonb, %L::uuid)', v_cita_l1, jsonb_build_object('fecha', v_hoy + 7, 'hora', '09:00'), v_u_ec), 'P0002', c_no_existe),
        ('otra fecha con otro médico', format('SELECT public.agenda_crear(%L::jsonb, %L::uuid)', jsonb_build_object('fecha', v_hoy + 7, 'hora', '12:00', 'tipo', 'medica', 'medico_id', v_m_x2, 'sede_id', v_s1, 'viene_de', v_cita_ayer), v_u_ec), '23514', 'La otra fecha debe ser con el mismo médico o la misma cuenta y subtipo')
      ) AS t(nombre, sentencia, estado, mensaje)
    LOOP
      BEGIN
        EXECUTE v_caso.sentencia;
        RAISE EXCEPTION '0850: se aceptó %', v_caso.nombre;
      EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_estado = RETURNED_SQLSTATE, v_msg = MESSAGE_TEXT;
        IF v_estado IS DISTINCT FROM v_caso.estado OR NOT (v_msg LIKE v_caso.mensaje) THEN
          RAISE EXCEPTION '0850: el caso "%" devolvió % (%) y se esperaba % (%)', v_caso.nombre, v_estado, v_msg, v_caso.estado, v_caso.mensaje;
        END IF;
      END;
    END LOOP;
    -- Cancelar con otro y texto (3 argumentos); con un código sin texto.
    PERFORM public.agenda_cancelar(p_id => v_c_cancel, p_motivo => '  El médico viaja  ', p_user => v_u_ec);
    SELECT * INTO v_fila FROM public.visitas_agenda a WHERE a.id = v_c_cancel;
    IF v_fila.estado <> 'cancelada' OR v_fila.motivo_codigo <> 'otro' OR v_fila.cancelada_motivo <> 'El médico viaja' THEN
      RAISE EXCEPTION '0850 cancelar: con 3 argumentos debía quedar cancelada con motivo otro y su texto: %', to_jsonb(v_fila);
    END IF;
    v_c_cancel2 := (public.agenda_crear(jsonb_build_object('fecha', v_hoy + 5, 'hora', '10:00', 'tipo', 'medica',
                      'medico_id', v_m_x2, 'sede_id', v_s1), v_u_ec) ->> 'cita_id')::uuid;
    PERFORM public.agenda_cancelar(v_c_cancel2, NULL, v_u_ec, 'prioridad');
    IF (SELECT a.motivo_codigo || '|' || coalesce(a.cancelada_motivo, '-') FROM public.visitas_agenda a WHERE a.id = v_c_cancel2) <> 'prioridad|-' THEN
      RAISE EXCEPTION '0850 cancelar: con el código prioridad no hace falta texto';
    END IF;
    -- Eliminar por error: deja de ocupar el día (índice único y choque) y no se puede tocar más.
    v_c_el := (public.agenda_crear(jsonb_build_object('fecha', v_hoy + 6, 'hora', '09:00', 'tipo', 'medica',
                 'medico_id', v_m_x1, 'sede_id', v_s1), v_u_ec) ->> 'cita_id')::uuid;
    v_r := public.agenda_eliminar(v_c_el, v_u_ec);
    SELECT * INTO v_fila FROM public.visitas_agenda a WHERE a.id = v_c_el;
    IF (v_r ->> 'cita_id')::uuid <> v_c_el OR v_fila.estado <> 'eliminada' OR v_fila.eliminada_at IS NULL OR v_fila.eliminada_por <> v_u_ec THEN
      RAISE EXCEPTION '0850 eliminar: la cita debía quedar eliminada, con cuándo y quién: %', to_jsonb(v_fila);
    END IF;
    PERFORM public.agenda_crear(jsonb_build_object('fecha', v_hoy + 6, 'hora', '09:00', 'tipo', 'medica', 'medico_id', v_m_x1,
                                                   'sede_id', v_s1), v_u_ec);
    FOR v_caso IN
      SELECT * FROM (VALUES
        ('eliminar dos veces', format('SELECT public.agenda_eliminar(%L::uuid, %L::uuid)', v_c_el, v_u_ec), 'P0002', c_no_existe),
        ('cerrar una eliminada', format('SELECT public.agenda_cerrar(%L::uuid, %L::jsonb, %L::uuid)', v_c_el, '{"motivo_codigo": "cliente"}', v_u_ec), 'P0002', c_no_existe),
        ('cancelar una eliminada', format('SELECT public.agenda_cancelar(%L::uuid, %L, %L::uuid)', v_c_el, 'Prueba 0850', v_u_ec), 'P0002', c_no_existe)
      ) AS t(nombre, sentencia, estado, mensaje)
    LOOP
      BEGIN
        EXECUTE v_caso.sentencia;
        RAISE EXCEPTION '0850: se aceptó %', v_caso.nombre;
      EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_estado = RETURNED_SQLSTATE, v_msg = MESSAGE_TEXT;
        IF v_estado IS DISTINCT FROM v_caso.estado OR NOT (v_msg LIKE v_caso.mensaje) THEN
          RAISE EXCEPTION '0850: el caso "%" devolvió % (%) y se esperaba % (%)', v_caso.nombre, v_estado, v_msg, v_caso.estado, v_caso.mensaje;
        END IF;
      END;
    END LOOP;
    -- Otra fecha: de la que no se hizo; dos veces no; en cadena sí; de una hecha no efectiva sí; tras eliminar la
    -- sucesora por error, otra vez sí.
    v_r := public.agenda_otra_fecha(v_cita_ayer, jsonb_build_object('fecha', v_hoy + 7, 'hora', '09:00'), v_u_ec);
    v_sucesora := (v_r ->> 'cita_id')::uuid;
    SELECT * INTO v_fila FROM public.visitas_agenda a WHERE a.id = v_sucesora;
    IF (v_r ->> 'viene_de')::uuid <> v_cita_ayer OR v_fila.viene_de <> v_cita_ayer OR v_fila.medico_id <> v_m_x1
       OR v_fila.sede_id <> v_s1 OR v_fila.executive_id <> v_e_ec OR v_fila.user_id <> v_u_ec OR v_fila.estado <> 'pendiente'
       OR v_fila.fecha <> v_hoy + 7 OR v_fila.hora <> time '09:00' THEN
      RAISE EXCEPTION '0850 otra fecha: la nueva no quedó como se esperaba: %', to_jsonb(v_fila);
    END IF;
    BEGIN
      PERFORM public.agenda_otra_fecha(v_cita_ayer, jsonb_build_object('fecha', v_hoy + 8, 'hora', '09:00'), v_u_ec);
      RAISE EXCEPTION '0850: se pidió dos veces otra fecha de la misma cita';
    EXCEPTION WHEN unique_violation THEN
      GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
      IF v_msg <> 'Esa cita ya tiene otra fecha' THEN
        RAISE EXCEPTION '0850 otra fecha dos veces: mensaje inesperado (%)', v_msg;
      END IF;
    END;
    PERFORM public.agenda_cancelar(v_sucesora, NULL, v_u_ec, 'cliente');
    v_sucesora2 := (public.agenda_otra_fecha(v_sucesora, jsonb_build_object('fecha', v_hoy + 8, 'hora', '09:00'), v_u_ec) ->> 'cita_id')::uuid;
    IF (SELECT a.viene_de FROM public.visitas_agenda a WHERE a.id = v_sucesora2) IS DISTINCT FROM v_sucesora THEN
      RAISE EXCEPTION '0850 otra fecha en cadena: la tercera debía venir de la segunda';
    END IF;
    INSERT INTO public.visitas_agenda (user_id, executive_id, fecha, tipo, medico_id, sede_id, created_by, created_at)
    VALUES (v_u_ec, v_e_ec, v_hoy, 'medica', v_m_dep2, v_s1, v_u_ec, now() - interval '1 day') RETURNING id INTO v_cita_hoy_ne;
    v_r := public.visitas_registrar(v_visita || jsonb_build_object('client_id', gen_random_uuid(), 'medico_id', v_m_dep2,
                                      'efectiva', false, 'failure_reason', 'Prueba 0850: no estaba'), v_u_ec);
    IF (v_r ->> 'agenda_id')::uuid IS DISTINCT FROM v_cita_hoy_ne THEN
      RAISE EXCEPTION '0850: la no efectiva debía cumplir su cita de hoy: %', v_r;
    END IF;
    v_visita_ne := (v_r ->> 'visita_id')::uuid;
    v_suc_ne := (public.agenda_otra_fecha(v_cita_hoy_ne, jsonb_build_object('fecha', v_hoy + 9, 'hora', '09:00'), v_u_ec) ->> 'cita_id')::uuid;
    -- Con otra fecha la cita queda cerrada (A7): ni anular su visita (volvería a pendiente con la sucesora colgando) ni
    -- pasarla a efectiva (hecha efectiva con otra fecha). Lo demás de la visita sí se corrige; sin la otra fecha, se anula.
    FOR v_caso IN
      SELECT * FROM (VALUES
        ('anular la visita de una cita con otra fecha', format('SELECT public.visitas_anular(%L::uuid, %L, %L::uuid)', v_visita_ne, 'Prueba 0850: me equivoqué', v_u_ec), '23514', c_otra_fecha_v),
        ('pasar a efectiva la visita de una cita con otra fecha', format('SELECT public.visitas_editar(%L::uuid, %L::jsonb, %L::uuid)', v_visita_ne, '{"efectiva": true}', v_u_ec), '23514', c_otra_fecha_v)
      ) AS t(nombre, sentencia, estado, mensaje)
    LOOP
      BEGIN
        EXECUTE v_caso.sentencia;
        RAISE EXCEPTION '0850: se aceptó %', v_caso.nombre;
      EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_estado = RETURNED_SQLSTATE, v_msg = MESSAGE_TEXT;
        IF v_estado IS DISTINCT FROM v_caso.estado OR NOT (v_msg LIKE v_caso.mensaje) THEN
          RAISE EXCEPTION '0850: el caso "%" devolvió % (%) y se esperaba % (%)', v_caso.nombre, v_estado, v_msg, v_caso.estado, v_caso.mensaje;
        END IF;
      END;
    END LOOP;
    PERFORM public.visitas_editar(v_visita_ne, '{"compromisos": "Prueba 0850: lo demás sí se corrige"}'::jsonb, v_u_ec);
    SELECT * INTO v_fila FROM public.visitas_agenda a WHERE a.id = v_cita_hoy_ne;
    IF v_fila.estado <> 'hecha' OR v_fila.visita_id IS DISTINCT FROM v_visita_ne
       OR NOT EXISTS (SELECT 1 FROM public.visits v WHERE v.id = v_visita_ne AND v.deleted_at IS NULL AND NOT v.efectiva) THEN
      RAISE EXCEPTION '0850: la cita con otra fecha debía seguir hecha con su visita no efectiva y sin anular: %', to_jsonb(v_fila);
    END IF;
    PERFORM public.agenda_eliminar(v_suc_ne, v_u_ec);
    PERFORM public.visitas_anular(v_visita_ne, 'Prueba 0850: sin otra fecha sí se anula', v_u_ec);
    IF EXISTS (SELECT 1 FROM public.visitas_agenda a WHERE a.id = v_cita_hoy_ne AND a.visita_id IS NOT DISTINCT FROM v_visita_ne)
       OR NOT EXISTS (SELECT 1 FROM public.visits v WHERE v.id = v_visita_ne AND v.deleted_at IS NOT NULL) THEN
      RAISE EXCEPTION '0850: tras eliminar la otra fecha, la visita se anula y la cita la suelta';
    END IF;
    v_c_o := (public.agenda_crear(jsonb_build_object('fecha', v_hoy + 10, 'hora', '09:00', 'tipo', 'medica',
                'medico_id', v_m_x3, 'sede_id', v_s1), v_u_ec) ->> 'cita_id')::uuid;
    PERFORM public.agenda_cancelar(v_c_o, NULL, v_u_ec, 'fuerza_mayor');
    v_id2 := (public.agenda_otra_fecha(v_c_o, jsonb_build_object('fecha', v_hoy + 11, 'hora', '09:00'), v_u_ec) ->> 'cita_id')::uuid;
    PERFORM public.agenda_eliminar(v_id2, v_u_ec);
    v_id3 := (public.agenda_otra_fecha(v_c_o, jsonb_build_object('fecha', v_hoy + 12, 'hora', '09:00', 'nota', 'Prueba 0850: nota nueva'), v_u_ec) ->> 'cita_id')::uuid;
    IF (SELECT a.viene_de FROM public.visitas_agenda a WHERE a.id = v_id3) IS DISTINCT FROM v_c_o
       OR (SELECT a.nota FROM public.visitas_agenda a WHERE a.id = v_id3) IS DISTINCT FROM 'Prueba 0850: nota nueva' THEN
      RAISE EXCEPTION '0850 otra fecha tras eliminar la sucesora: debía crearse con su nota';
    END IF;
    v_casos := v_casos || 'ciclo de vida: cerrar (de ayer y de hoy sí; de mañana, ajena, cerrada, hecha, salida, motivo raro, otro sin texto y texto largo no), cancelar con motivo (3 argumentos con texto, código sin texto; sin motivo, corto, salida, raro, de ayer, cerrada, hecha y ajena no), eliminar (sí; hecha, de ayer, ajena, dos veces no; libera el día), otra fecha (de no_realizada, en cadena, de hecha no efectiva y tras eliminar la sucesora sí; dos veces 23505, pendiente, hecha efectiva, ajena y con otro médico no), con otra fecha la visita de la cita no se anula ni pasa a efectiva (lo demás sí; sin la otra fecha, se anula)'::text;

    -- F0. Como service_role (el rol de la API), antes de la salida, que cambia los datos de prueba --------------------
    BEGIN
      BEGIN
        PERFORM set_config('role', 'service_role', true);
        v_rol_ok := true;
      EXCEPTION WHEN insufficient_privilege OR invalid_parameter_value THEN
        v_rol_ok := false;
      END;
      IF v_rol_ok THEN
        v_r := public.persona_de_campo(v_u_lider);
        v_id1 := (public.agenda_crear(jsonb_build_object('fecha', v_hoy + 2, 'hora', '09:00', 'tipo', 'medica',
                    'medico_id', v_m_dep1, 'sede_id', v_s1), v_u_lider) ->> 'cita_id')::uuid;
        PERFORM public.agenda_cancelar(p_id => v_id1, p_motivo => 'Prueba 0850 service_role', p_user => v_u_lider);
        PERFORM public.agenda_otra_fecha(v_id1, jsonb_build_object('fecha', v_hoy + 3, 'hora', '09:00'), v_u_lider);
        v_id2 := (public.agenda_crear(jsonb_build_object('fecha', v_hoy + 4, 'hora', '09:00', 'tipo', 'medica',
                    'medico_id', v_m_dep1, 'sede_id', v_s1), v_u_lider) ->> 'cita_id')::uuid;
        PERFORM public.agenda_eliminar(v_id2, v_u_lider);
        PERFORM public.agenda_cerrar(v_cita_l_hoy, '{"motivo_codigo": "prioridad"}'::jsonb, v_u_lider);
        v_r := public.visitas_registrar(v_visita || jsonb_build_object('client_id', gen_random_uuid(), 'medico_id', v_m_dep2), v_u_lider);
        PERFORM public.visitas_editar((v_r ->> 'visita_id')::uuid, '{"compromisos": "Prueba 0850"}'::jsonb, v_u_lider);
        PERFORM public.visitas_anular((v_r ->> 'visita_id')::uuid, 'Prueba 0850 service_role', v_u_lider);
        BEGIN
          DELETE FROM public.visitas_agenda WHERE id = v_id2;
          RAISE EXCEPTION '0850: service_role borró una cita';
        EXCEPTION WHEN insufficient_privilege OR check_violation THEN NULL;
        END;
        v_casos := v_casos || 'como service_role (persona, agendar, cancelar con 3 argumentos, otra fecha, eliminar, cerrar, registrar, corregir y anular; borrar no)'::text;
      ELSE
        RAISE NOTICE '0850: no se pudo cambiar a service_role; sus privilegios se comprobaron solo con has_*_privilege';
      END IF;
      RAISE SQLSTATE 'P0850';
    EXCEPTION
      WHEN SQLSTATE 'P0850' THEN NULL;
    END;
    IF current_user = 'service_role' THEN
      RAISE EXCEPTION '0850: el rol no volvió después de la prueba como service_role';
    END IF;

    -- F. Salida (A16, C11) -------------------------------------------------------------------------------------------
    INSERT INTO public.visitas_agenda (user_id, executive_id, fecha, hora, tipo, medico_id, sede_id, created_by, created_at)
    VALUES (v_u_sale, v_e_sale, v_hoy - 1, '09:00', 'medica', v_m_ajeno, v_s1, v_u_sale, now() - interval '3 days') RETURNING id INTO v_s_ayer;
    v_s1c := (public.agenda_crear(jsonb_build_object('fecha', v_hoy + 1, 'hora', '09:00', 'tipo', 'medica', 'medico_id', v_m_ajeno,
                'sede_id', v_s1), v_u_sale) ->> 'cita_id')::uuid;
    v_s2c := (public.agenda_crear(jsonb_build_object('fecha', v_hoy + 2, 'hora', '09:00', 'tipo', 'medica', 'medico_id', v_m_ajeno,
                'sede_id', v_s1), v_u_sale) ->> 'cita_id')::uuid;
    UPDATE public.users SET active = false WHERE id = v_u_sale;
    IF (SELECT count(*) FROM public.visitas_agenda a WHERE a.id IN (v_s1c, v_s2c) AND a.estado = 'cancelada'
          AND a.motivo_codigo = 'salida' AND a.cancelada_motivo = 'Salió de la empresa') <> 2
       OR NOT EXISTS (SELECT 1 FROM public.visitas_agenda a WHERE a.id = v_s_ayer AND a.estado = 'pendiente') THEN
      RAISE EXCEPTION '0850 salida: al desactivar el usuario se cancelan sus citas de hoy en adelante (salida) y la de ayer se queda';
    END IF;
    -- Una cancelada por salida no tiene otra fecha, aunque la persona vuelva (se reactiva solo para probarlo).
    UPDATE public.users SET active = true WHERE id = v_u_sale;
    BEGIN
      PERFORM public.agenda_otra_fecha(v_s1c, jsonb_build_object('fecha', v_hoy + 3, 'hora', '09:00'), v_u_sale);
      RAISE EXCEPTION '0850: se pidió otra fecha de una cita cancelada por salida';
    EXCEPTION WHEN check_violation THEN
      GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
      IF v_msg <> 'Esa cita se canceló por la salida de la persona: no tiene otra fecha' THEN
        RAISE EXCEPTION '0850 otra fecha de salida: mensaje inesperado (%)', v_msg;
      END IF;
    END;
    UPDATE public.executives SET status = 'inactive', left_at = v_hoy - 1 WHERE id = v_e_paola;
    IF NOT EXISTS (SELECT 1 FROM public.visitas_agenda a WHERE a.id = v_c_p_lider AND a.estado = 'pendiente')
       OR NOT EXISTS (SELECT 1 FROM public.visitas_agenda a WHERE a.id = v_c_p_ec AND a.estado = 'cancelada'
                        AND a.motivo_codigo = 'otro' AND a.cancelada_motivo = 'Dejó de ser Ejecutivo Comercial') THEN
      RAISE EXCEPTION '0850 salida: dar de baja al Ejecutivo Comercial de Paola cancela lo suyo como Ejecutiva (motivo otro) y deja su cita de líder';
    END IF;
    v_r := public.persona_de_campo(v_u_paola);
    IF v_r ->> 'rol' <> 'lider' OR v_r ->> 'executive_id' IS NOT NULL THEN
      RAISE EXCEPTION '0850 salida: Paola sigue como líder: %', v_r;
    END IF;
    -- No salió de la empresa: la otra fecha no se bloquea por salida. Como Ejecutiva ya no puede (no lo es) y como
    -- líder, solo con un médico de sus líneas (C9).
    FOR v_caso IN
      SELECT * FROM (VALUES
        ('otra fecha como Ejecutiva de quien dejó de serlo', format('SELECT public.agenda_otra_fecha(%L::uuid, %L::jsonb, %L::uuid)', v_c_p_ec, jsonb_build_object('fecha', v_hoy + 3, 'hora', '09:00'), v_u_paola), '23514', c_sin_ejec),
        ('otra fecha como líder con un médico que no es de sus líneas', format('SELECT public.agenda_otra_fecha(%L::uuid, %L::jsonb, %L::uuid)', v_c_p_ec, jsonb_build_object('fecha', v_hoy + 3, 'hora', '09:00', 'como', 'lider'), v_u_paola), '23514', c_medico_ajeno)
      ) AS t(nombre, sentencia, estado, mensaje)
    LOOP
      BEGIN
        EXECUTE v_caso.sentencia;
        RAISE EXCEPTION '0850: se aceptó %', v_caso.nombre;
      EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_estado = RETURNED_SQLSTATE, v_msg = MESSAGE_TEXT;
        IF v_estado IS DISTINCT FROM v_caso.estado OR NOT (v_msg LIKE v_caso.mensaje) THEN
          RAISE EXCEPTION '0850: el caso "%" devolvió % (%) y se esperaba % (%)', v_caso.nombre, v_estado, v_msg, v_caso.estado, v_caso.mensaje;
        END IF;
      END;
    END LOOP;
    UPDATE public.executives SET status = 'inactive', left_at = v_hoy - 1 WHERE id = v_e_ec;
    IF EXISTS (SELECT 1 FROM public.visitas_agenda a WHERE a.user_id = v_u_ec AND a.estado = 'pendiente' AND a.fecha >= v_hoy)
       OR NOT EXISTS (SELECT 1 FROM public.visitas_agenda a WHERE a.user_id = v_u_ec AND a.estado = 'cancelada'
                        AND a.motivo_codigo = 'salida' AND a.cancelada_motivo = 'Salió de la empresa') THEN
      RAISE EXCEPTION '0850 salida: un Ejecutivo Comercial dado de baja que se queda sin líneas pierde todo lo pendiente desde hoy';
    END IF;
    v_casos := v_casos || 'salida: desactivar el usuario cancela desde hoy (la de ayer se queda); una cancelada por salida no tiene otra fecha; la baja del Ejecutivo de Paola cancela solo lo suyo como Ejecutiva, con motivo otro (otra fecha como líder sí, con un médico de sus líneas); la baja de un Ejecutivo sin más líneas, todo'::text;

    -- G. Últimas barreras: CHECK, índices y disparador ---------------------------------------------------------------
    BEGIN
      UPDATE public.visits SET kam_id = v_kam WHERE id = v_visita_tra;
      RAISE EXCEPTION '0850: visits_app_check aceptó una visita sin Ejecutivo Comercial con zona';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
      UPDATE public.visits SET out_of_territory = true WHERE id = v_visita_tra;
      RAISE EXCEPTION '0850: visits_app_check aceptó una visita sin Ejecutivo Comercial fuera de territorio';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
      UPDATE public.visits SET user_id = NULL WHERE id = v_visita_tra;
      RAISE EXCEPTION '0850: visits_app_check aceptó una visita de la app sin user_id';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    FOR v_caso IN
      SELECT * FROM (VALUES
        ('no_realizada sin motivo', 'no_realizada', now(), NULL::text, NULL::timestamptz, NULL::text, NULL::timestamptz),
        ('no_realizada por salida', 'no_realizada', now(), 'salida', NULL, NULL, NULL),
        ('eliminada sin fecha', 'eliminada', NULL, NULL, NULL, NULL, NULL),
        ('cancelada con un motivo que no existe', 'cancelada', NULL, 'raro', now(), NULL, NULL),
        ('cancelada con otro y sin texto', 'cancelada', NULL, 'otro', now(), NULL, NULL),
        ('pendiente con motivo', 'pendiente', NULL, 'cliente', NULL, NULL, NULL),
        ('estado no válido', 'movida', NULL, NULL, NULL, NULL, NULL)
      ) AS t(nombre, estado, no_realizada_at, motivo_codigo, cancelada_at, cancelada_motivo, eliminada_at)
    LOOP
      BEGIN
        INSERT INTO public.visitas_agenda (user_id, executive_id, fecha, tipo, medico_id, sede_id, estado, no_realizada_at,
                                           motivo_codigo, cancelada_at, cancelada_motivo, eliminada_at)
        VALUES (v_u_lider, NULL, v_hoy + 30, 'medica', v_m_dep2, v_s1, v_caso.estado, v_caso.no_realizada_at,
                v_caso.motivo_codigo, v_caso.cancelada_at, v_caso.cancelada_motivo, v_caso.eliminada_at);
        RAISE EXCEPTION '0850: los CHECK de visitas_agenda aceptaron una cita %', v_caso.nombre;
      EXCEPTION WHEN check_violation THEN NULL;
      END;
    END LOOP;
    BEGIN
      UPDATE public.visitas_agenda SET viene_de = id WHERE id = v_cita_l1;
      RAISE EXCEPTION '0850: visitas_agenda_viene_de_check aceptó una cita que viene de sí misma';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
      UPDATE public.visitas_agenda SET estado = 'cancelada', cancelada_at = now() WHERE id = v_cita_l1;
      RAISE EXCEPTION '0850: se canceló una cita sin motivo_codigo';
    EXCEPTION WHEN check_violation THEN
      GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
      IF v_msg <> 'Cancelar exige motivo (motivo_codigo)' THEN
        RAISE EXCEPTION '0850 disparador del motivo: mensaje inesperado (%)', v_msg;
      END IF;
    END;
    BEGIN
      INSERT INTO public.visitas_agenda (user_id, fecha, tipo, medico_id, sede_id) VALUES (v_u_lider, v_hoy + 1, 'medica', v_m_dep1, v_s1);
      RAISE EXCEPTION '0850: visitas_agenda_medico_uidx aceptó una cita repetida de la misma persona';
    EXCEPTION WHEN unique_violation THEN NULL;
    END;
    BEGIN
      INSERT INTO public.visitas_agenda (user_id, executive_id, fecha, tipo, medico_id, sede_id, viene_de)
      VALUES (v_u_ec, v_e_ec, v_hoy + 40, 'medica', v_m_x1, v_s1, v_cita_ayer);
      RAISE EXCEPTION '0850: visitas_agenda_viene_de_uidx aceptó una segunda sucesora';
    EXCEPTION WHEN unique_violation THEN NULL;
    END;
    BEGIN
      INSERT INTO public.visitas_agenda (fecha, tipo, medico_id, sede_id) VALUES (v_hoy + 41, 'medica', v_m_x1, v_s1);
      RAISE EXCEPTION '0850: visitas_agenda aceptó una cita sin persona';
    EXCEPTION WHEN not_null_violation THEN NULL;
    END;
    BEGIN
      DELETE FROM public.visitas_agenda WHERE id = v_cita_l1;
      RAISE EXCEPTION '0850: se borró una cita';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    v_casos := v_casos || 'CHECK de visits (zona, fuera de territorio y user_id) y de visitas_agenda (estados, motivos, viene_de), disparador del motivo, índices únicos por persona y de sucesora, user_id NOT NULL y borrado prohibido'::text;

    RAISE SQLSTATE 'P0850';
  EXCEPTION
    WHEN SQLSTATE 'P0850' THEN NULL;  -- preparación y pruebas deshechas
  END;

  -- 9.5 No quedó nada de las pruebas; la configuración está como antes ------------------------------------------
  IF (SELECT count(*) FROM public.visitas_agenda) <> v_citas_antes
     OR (SELECT count(*) FROM public.visits WHERE source = 'app') <> v_visitas_antes
     OR EXISTS (SELECT 1 FROM public.users WHERE email LIKE 'prueba0850-%')
     OR EXISTS (SELECT 1 FROM public.business_lines WHERE code LIKE 'prueba\_0850\_%')
     OR EXISTS (SELECT 1 FROM public.medicos WHERE numero_documento LIKE 'PRUEBA0850M%')
     OR EXISTS (SELECT 1 FROM public.cuentas WHERE numero_identificacion LIKE 'PRUEBA0850C%')
     OR EXISTS (SELECT 1 FROM public.subtipos_institucionales WHERE codigo LIKE 'prueba\_0850\_%') THEN
    RAISE EXCEPTION '0850: quedaron filas de las pruebas';
  END IF;
  SELECT md5(coalesce(string_agg(to_jsonb(cg)::text, ',' ORDER BY cg.id), '')) INTO v_cfg_despues FROM public.config_general cg;
  IF v_cfg_despues IS DISTINCT FROM v_cfg_antes THEN
    RAISE EXCEPTION '0850: la configuración general no quedó como estaba';
  END IF;
  IF cardinality(v_casos) < (CASE WHEN v_rol_ok THEN 10 ELSE 9 END) THEN
    RAISE EXCEPTION '0850: solo se probaron % grupos de casos: %', cardinality(v_casos), array_to_string(v_casos, '; ');
  END IF;

  -- 9.6 Las importadas de VMO siguen idénticas (conteo y huellas de antes de migrar) y sin persona -------------------
  v_antes := string_to_array(current_setting('opmap0850.importadas', true), '|');
  IF v_antes IS NULL OR cardinality(v_antes) <> 3 THEN
    RAISE EXCEPTION '0850: falta la huella de las importadas tomada antes de migrar';
  END IF;
  SELECT count(*),
         coalesce(md5(string_agg(v.id::text || v.visit_type || v.contact_type || v.visit_date::text, ',' ORDER BY v.id)), '-'),
         coalesce(md5(string_agg(ROW(v.id, v.kam_id, v.kam_name, v.visit_type, v.contact_type, v.lat, v.lng, v.visit_date,
                                     v.hospital_id, v.imported_by, v.imported_at, v.created_at, v.updated_at,
                                     v.import_id)::text, ',' ORDER BY v.id)), '-')
  INTO v_n, v_md5, v_md5_todo
  FROM public.visits v
  WHERE v.source = 'vmo_import';
  IF v_n::text <> v_antes[1] OR v_md5 <> v_antes[2] OR v_md5_todo <> v_antes[3] THEN
    RAISE EXCEPTION '0850: las visitas importadas cambiaron (antes % / %, después % / %)', v_antes[1], v_antes[2], v_n, v_md5;
  END IF;
  IF EXISTS (SELECT 1 FROM public.visits v WHERE v.source = 'vmo_import' AND v.user_id IS NOT NULL) THEN
    RAISE EXCEPTION '0850: hay visitas importadas con persona';
  END IF;

  RAISE NOTICE '0850 OK: visits con user_id (las de la app rellenadas; % importadas intactas, huella %); visitas_agenda con la persona, el ciclo de vida, motivos y otra fecha; funciones nuevas y reemplazadas solo para service_role.',
    v_antes[1], v_antes[2];
  RAISE NOTICE '0850 OK: % grupos de casos probados con datos que se deshacen: %', cardinality(v_casos), array_to_string(v_casos, '; ');
END;
$$;

COMMIT;
