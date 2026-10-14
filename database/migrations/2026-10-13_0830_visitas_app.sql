-- =====================================================================================
-- OpMap · feat/visitas-f3-f4-app-movil (app de visita · F3: la visita como dato) · 0830
-- Proyecto: norvxqgohddgsdkggqzq · Generado: 2026-10-13 · ESTADO: NO APLICADA
--
-- Contrato (fuente de verdad de nombres): docs/fases/fase8-visitas-f3-f4-reporte-y-app-movil.md (sección "Base de
--   datos" y decisiones 3 a 10). Spec: docs/specs/2026-10-12-app-de-visita-opmap.md (secciones 9, 11 y 12).
--   Decisiones del dueño: docs/decisiones/2026-10-12-app-de-visita.md.
--   Es ADITIVA: 29 columnas nuevas en visits (todas NULL o con valor por defecto), 1 tabla nueva, 5 funciones y
--   2 disparadores. No cambia ninguna fila existente: las 7.033 visitas importadas de VMO quedan
--   source = 'vmo_import' y el resto de columnas nuevas en NULL (out_of_territory en false).
--
-- Por qué:
--   La ejecutiva reporta desde el teléfono (voz o toques) visitas médicas (médico + sede donde atiende) e
--   institucionales (cuenta + sede + subtipo). Las reglas que no pueden depender del teléfono (mismo día, radio
--   presencial con Haversine en el servidor, topes, perfil, telefónica habilitada, líneas propias, idempotencia) se
--   aplican aquí, en UNA transacción por visita (PostgREST no tiene transacciones). La visita vive en visits, la
--   tabla del mapa de calor: las de la app llenan también kam_id, kam_name, visit_type, contact_type, lat/lng,
--   visit_date y hospital_id, así el mapa las muestra igual que las de VMO.
--
-- Qué hace:
--   1. visits: columnas nuevas (source, executive_id, client_id, tipo, subtipo_id, subtipo_codigo, medico_id,
--      cuenta_id, sede_id, contacto_id, modalidad, medio, efectiva, failure_reason, retry_date, checked_in_at,
--      reported_at, distance_m, gps_accuracy_m, conclusion, compromisos, next_step_date, transcript, input_mode,
--      out_of_territory, created_by, updated_by, deleted_at, deleted_reason). NO hay columna de audio.
--      CHECK visits_source_check (vmo_import | app) y visits_app_check (dominios, longitudes, anulación con motivo y
--      todas las reglas "app ⇒ …" del contrato, incluida la coherencia con visit_type y contact_type del mapa).
--      Índices: visits_client_id_uidx (UNIQUE parcial), visits_executive_date_idx, visits_medico_idx,
--      visits_cuenta_idx, visits_next_step_idx.
--      Disparadores: update_visits_updated_at (updated_at, que visits no tenía) y visits_app_sin_borrar (BEFORE
--      DELETE de una visita de la app → 23514 "se anulan con motivo", con public.visitas_sin_borrar() de 0810).
--   2. visit_lines (visit_id → visits ON DELETE CASCADE, line_id → business_lines, PK): líneas de cada visita.
--   3. Funciones (SECURITY INVOKER, solo service_role):
--        - visitas_distancia_m(lat1, lng1, lat2, lng2) → int: Haversine, radio 6371008.8 m, metros enteros
--          redondeados al más cercano (misma fórmula y orden de operaciones que haversineM de
--          web/lib/reporte-visitas.ts).
--        - visitas_config_vigente(executive_id, fecha) → jsonb { perfil, radio_m, tope_visitas_medico_dia,
--          telefonica: { habilitada, tope_dia, medios } }: config_personas vigente en la fecha (la de vigente_desde
--          más reciente, no anulada) o, sin fila, perfil médica e institucional y telefónica no habilitada; radio,
--          tope y medios de config_general vigente o, sin fila, los de GENERAL_POR_DEFECTO de web/lib/visits-rules.ts
--          (500 m, 1 por médico, telefónicas 1 al día por llamada o videollamada). Espejo de configPersonaVigente,
--          radioEfectivo y telefonicaEfectiva. La API puede llamarla para /api/me/contexto.
--        - visitas_registrar(p jsonb, p_user uuid) → jsonb: pasos 1 a 8 del contrato (abajo).
--        - visitas_editar(p_id uuid, p jsonb, p_user uuid): corrección del mismo día.
--        - visitas_anular(p_id uuid, p_motivo text, p_user uuid): anulación del mismo día con motivo.
--   4. RLS sin políticas en visit_lines; nada para PUBLIC/anon/authenticated; service_role SELECT, INSERT, UPDATE y
--      DELETE en visit_lines (DELETE: corregir las líneas reemplaza las filas) y EXECUTE de las 5 funciones.
--      visits conserva sus privilegios de hoy (service_role todo, incluido DELETE que usa la importación de VMO;
--      anon/authenticated nada).
--   5. Bloque DO final con todas las comprobaciones y pruebas que se deshacen (RAISE SQLSTATE 'P0830'): estructura y
--      privilegios; Haversine con cifras exactas; filas importadas idénticas (conteo y huellas md5 antes y después);
--      con una ejecutiva activa real y médicos, sedes, cuentas, contactos, visitantes, subtipos y configuración de
--      prueba: médica presencial dentro del radio, repetida por client_id, lejos (rechazo con la distancia), sede
--      sin coordenadas, telefónica sin habilitar, medio no válido y tope de telefónicas, tope por médico, perfil sin
--      médica o sin institucional, institucional con subtipo y contacto, out_of_territory, líneas ajenas, ayer
--      rechazado, editar y anular el mismo día, anular dos veces, importada y de ayer no editables, borrado
--      prohibido y todo de nuevo como service_role.
--
-- visitas_registrar(p, p_user). p = { client_id, executive_id, tipo, subtipo_id?, medico_id?, cuenta_id?, sede_id,
--   contacto_id?, modalidad, medio?, efectiva, failure_reason?, retry_date?, checked_in_at, reported_at, lat?, lng?,
--   gps_accuracy_m?, conclusion?, compromisos?, next_step_date?, transcript?, input_mode, lineas: uuid[] }
--   0. Forma (22023): uuid, fechas e instantes legibles, tipo/modalidad/medio/input_mode de la lista, lat y lng
--      juntas y en rango, textos con tope (failure 300, conclusión 2000, compromisos 2000, transcripción 8000),
--      1..10 líneas. Lo que no aplica al tipo o a la modalidad se descarta (médica: sin cuenta, subtipo ni contacto;
--      presencial: sin medio; telefónica: sin la ubicación ni la precisión del teléfono, que no se usan ni se
--      guardan; efectiva: sin motivo ni fecha de reintento). No efectiva sin motivo → 23514.
--   1. Candado por ejecutiva (pg_advisory_xact_lock): dos reportes suyos a la vez no se saltan los topes. Si ya existe
--      ese client_id → { visita_id, repetida: true, out_of_territory, distance_m, visit_date } sin tocar nada (de
--      otra ejecutiva → 23505).
--   2. Ejecutiva activa con zona base (23514 "Tu usuario no está enlazado con un Ejecutivo Comercial" / "Tu Ejecutivo
--      Comercial no tiene zona base"); visit_date = (checked_in_at AT TIME ZONE 'America/Bogota')::date debe ser hoy
--      en Bogotá (23514 "Solo se reportan visitas del mismo día"); checked_in_at y reported_at no más de 5 minutos
--      en el futuro ("La hora de llegada está en el futuro" / "La hora del reporte está en el futuro");
--      reported_at >= checked_in_at; next_step_date y retry_date no antes de visit_date ("La próxima reunión no puede
--      ser anterior a la fecha de la visita" / "La fecha para reintentar no puede ser anterior a la fecha de la
--      visita": si no, nacería como compromiso vencido).
--   3. El perfil vigente incluye el tipo (23514 "Tu perfil no incluye visitas médicas|institucionales").
--   4. Sede activa ("Esa sede no existe") de una cuenta activa ("La cuenta de esa sede está inactiva": desactivar una
--      cuenta no desactiva sus sedes). Médica: médico activo, sede ∈ medico_sedes; out_of_territory = no hay
--      medico_visitantes de ella vigente en la fecha para ese médico (cualquier línea). Institucional: sede de la
--      cuenta, subtipo vigente en la fecha (copia subtipo_codigo), contacto de la cuenta si viene ("Ese contacto no es
--      de la cuenta elegida") y activo ("Ese contacto está inactivo").
--      La sede por confirmar (sedes.ubicacion_confirmada = false) SÍ se acepta: la visita se guarda y NO suma hasta que
--      data manager la confirme (decisión 9 del dueño). Eso lo decide la API al contar (valorReporte de
--      web/lib/reporte-visitas.ts mira la sede en ese momento), no esta función: así, al confirmarla, sus visitas
--      suman solas.
--   5. Presencial: lat/lng del teléfono obligatorios; sede con coordenadas ("Esta sede no tiene ubicación: confírmala
--      o crea la sede"); distance_m = visitas_distancia_m(teléfono, sede) <= radio efectivo ("Estás a N m de <sede>;
--      el radio es R m"). Telefónica: habilitada ("No tienes habilitada la visita telefónica"), medio en los medios
--      vigentes ("Medio no válido: llamada o videollamada"), telefónicas efectivas suyas de hoy (no anuladas) < tope
--      ("Ya reportaste tu visita telefónica de hoy" / "Ya reportaste las N visitas telefónicas de hoy").
--   6. Solo si es efectiva y médica: efectivas suyas a ese médico hoy (no anuladas, presencial o telefónica) <
--      tope_visitas_medico_dia ("Ya reportaste una visita a este médico hoy").
--   7. Líneas: al menos una ("Elige al menos una línea"), todas suyas en executive_lines ("Alguna de las líneas no es
--      tuya"); se insertan en visit_lines.
--   8. Inserta con los campos del mapa de calor: kam_id = zona base, kam_name = nombre de la ejecutiva,
--      visit_type 'Visita efectiva' | 'Visita no efectiva', contact_type 'Visita presencial' | 'Visita virtual'
--      (telefónica), visit_date, hospital_id = sedes.hospital_id (IPS de OpMap) y lat/lng: presencial = el punto
--      del teléfono (está a menos del radio de la sede); telefónica = la sede, o si no tiene, el municipio de la sede,
--      o la ciudad base de la zona — NUNCA el GPS del teléfono: en una telefónica la ejecutiva no está en la sede
--      (puede estar en su casa) y el mapa de calor lo ve todo el que tiene sesión (visits.lat/lng son NOT NULL y
--      numeric(10,6): 6 decimales).
--      imported_by, imported_at e import_id quedan NULL. Devuelve { visita_id, repetida: false, out_of_territory,
--      distance_m, visit_date }.
--   Los mensajes 23514 son los mismos de web/lib/reporte-visitas.ts (validarVisita los repite antes de la RPC).
--
-- visitas_editar(p_id, p, p_user). p = { executive_id, conclusion?, compromisos?, next_step_date?, efectiva?,
--   failure_reason?, retry_date?, lineas? } (clave presente = cambia; ausente = queda). Otra clave (tipo, médico,
--   cuenta, sede, modalidad…) → 23514 "anula la visita y repórtala de nuevo"; ninguna editable → 22023. Visita
--   inexistente o de otra ejecutiva → P0002 "Esa visita no existe"; importada, anulada o de otro día → 23514 "Solo
--   puedes corregir o anular tus visitas del mismo día". Pasar a efectiva revalida los topes (por médico y de
--   telefónicas, sin contarse a sí misma); a no efectiva exige motivo; la próxima reunión y el reintento no pueden
--   quedar antes de visit_date (mismos mensajes que registrar). Ajusta visit_type y updated_by.
--
-- visitas_anular(p_id, p_motivo, p_user). La ejecutiva sale de p_user (executives.user_id, activa; como
--   personaDelUsuario de la API): mismas condiciones que editar; motivo de 5 a 300 caracteres (23514); dos veces →
--   23514 "Esa visita ya está anulada". Deja deleted_at, deleted_reason y updated_by; la fila no se borra.
--
-- Errores para la API: 22023 forma de p; 23514 regla (mensaje para la ejecutiva, 400); P0002 visita inexistente o
--   ajena (404); 23505 client_id de otra ejecutiva; 23503 p_user inexistente. Cualquier error deshace la visita.
--
-- Depende de: 0800 (cuentas, sedes, medicos, medico_sedes, medico_visitantes, contactos, subtipos_institucionales,
--   terceros_crear_medico), 0810 (config_personas, config_general, config_registrar, visitas_sin_borrar), 0820
--   (aplicada: el orden de rollback es 9943 antes que 9942, 9941 y 9940), visits, executives, executive_lines,
--   business_lines, kams, municipalities, users y public.update_updated_at_column() (existentes).
--
-- Después de aplicar (misma ventana que el despliegue de /api/me/* y la app):
--   NOTIFY pgrst, 'reload schema';   -- PostgREST debe ver las columnas, la tabla y las funciones nuevas
--   Costo Google: 0 (no llama a nada). No recalcula asignaciones ni cobertura. La voz (OpenAI y Claude) vive en la
--   API, no aquí: la base nunca recibe audio.
--   Código que hay que ajustar en la misma ventana (fuera de esta migración): la importación de VMO
--   (web/app/api/visits/import) borra las visitas del mes sin mirar source: debe filtrar source = 'vmo_import' (el
--   disparador visits_app_sin_borrar hace fallar ese DELETE si el mes tiene visitas de la app); el mapa
--   (web/app/api/visits/filtered) debe excluir las anuladas (deleted_at) y no devolver transcript, conclusion ni
--   compromisos (la transcripción es interna: ejecutiva, su líder, dirección); las estadísticas
--   (web/app/api/visits/stats) y la cobertura (web/app/api/visits/unvisited-zones) también deben excluir las
--   anuladas (si no, una visita anulada sigue sumando y marca como visitadas las IPS a menos de 5 km). Las cuatro
--   rutas funcionan antes y después de la 0830. La vista visit_summary (sin uso en la web) contará también las de la
--   app, anuladas incluidas.
--
-- Transaccional: todo o nada. Re-ejecutable: sí (ADD COLUMN IF NOT EXISTS, DROP CONSTRAINT IF EXISTS + ADD, IF NOT
--   EXISTS, CREATE OR REPLACE). Rollback: 2026-10-13_9943_visitas_app_rollback.sql.
-- =====================================================================================

BEGIN;

-- -------------------------------------------------------------------------------------
-- 0. Precondiciones y huella de las visitas importadas
-- -------------------------------------------------------------------------------------

DO $$
DECLARE
  v_tabla     text;
  v_fn        text;
  v_col       record;
  v_n         bigint;
  v_md5       text;
  v_md5_todo  text;
  v_source    boolean;
  v_originales constant text[] := ARRAY['id', 'kam_id', 'kam_name', 'visit_type', 'contact_type', 'lat', 'lng',
                                        'visit_date', 'hospital_id', 'imported_by', 'imported_at', 'created_at',
                                        'updated_at', 'import_id'];
  v_nuevas constant text[] := ARRAY['source', 'executive_id', 'client_id', 'tipo', 'subtipo_id', 'subtipo_codigo',
                                    'medico_id', 'cuenta_id', 'sede_id', 'contacto_id', 'modalidad', 'medio',
                                    'efectiva', 'failure_reason', 'retry_date', 'checked_in_at', 'reported_at',
                                    'distance_m', 'gps_accuracy_m', 'conclusion', 'compromisos', 'next_step_date',
                                    'transcript', 'input_mode', 'out_of_territory', 'created_by', 'updated_by',
                                    'deleted_at', 'deleted_reason'];
BEGIN
  FOREACH v_tabla IN ARRAY ARRAY['users', 'kams', 'municipalities', 'hospitals', 'business_lines', 'executives',
                                 'executive_lines', 'visits', 'visit_imports', 'cuentas', 'sedes', 'medicos',
                                 'medico_sedes', 'medico_visitantes', 'contactos', 'subtipos_institucionales',
                                 'config_personas', 'config_general', 'ejecutivas_traspasos'] LOOP
    IF to_regclass('public.' || v_tabla) IS NULL THEN
      RAISE EXCEPTION '0830 Visitas de la app: falta la tabla previa public.% (0800, 0810 y 0820 deben estar aplicadas)',
        v_tabla;
    END IF;
  END LOOP;
  FOREACH v_fn IN ARRAY ARRAY['public.update_updated_at_column()', 'public.visitas_sin_borrar()',
                              'public.terceros_crear_medico(jsonb, jsonb, uuid)',
                              'public.config_registrar(text, jsonb, date, date, text, uuid)',
                              'public.ejecutivas_traspasar(jsonb, uuid)'] LOOP
    IF to_regprocedure(v_fn) IS NULL THEN
      RAISE EXCEPTION '0830 Visitas de la app: falta la función previa %', v_fn;
    END IF;
  END LOOP;

  -- Las 14 columnas reales de visits (comprobadas con SELECT el 2026-10-13), con su tipo y si aceptan NULL.
  FOR v_col IN
    SELECT * FROM (VALUES
      ('id', 'uuid', 'NO'), ('kam_id', 'uuid', 'YES'), ('kam_name', 'character varying', 'NO'),
      ('visit_type', 'character varying', 'NO'), ('contact_type', 'character varying', 'NO'),
      ('lat', 'numeric', 'NO'), ('lng', 'numeric', 'NO'), ('visit_date', 'date', 'NO'),
      ('hospital_id', 'uuid', 'YES'), ('imported_by', 'uuid', 'YES'),
      ('imported_at', 'timestamp with time zone', 'YES'), ('created_at', 'timestamp with time zone', 'YES'),
      ('updated_at', 'timestamp with time zone', 'YES'), ('import_id', 'uuid', 'YES')
    ) AS t(nombre, tipo, nulo)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns c
                   WHERE c.table_schema = 'public' AND c.table_name = 'visits' AND c.column_name = v_col.nombre
                     AND c.data_type = v_col.tipo AND c.is_nullable = v_col.nulo) THEN
      RAISE EXCEPTION '0830: visits.% no es % (NULL: %) como en producción; revisar antes de migrar',
        v_col.nombre, v_col.tipo, v_col.nulo;
    END IF;
  END LOOP;
  SELECT count(*) INTO v_n FROM information_schema.columns c
  WHERE c.table_schema = 'public' AND c.table_name = 'visits'
    AND c.column_name <> ALL (v_originales || v_nuevas);
  IF v_n > 0 THEN
    RAISE EXCEPTION '0830: visits tiene % columna(s) que ni 0830 ni el esquema original conocen; revisar antes de migrar', v_n;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.visits'::regclass AND conname = 'visits_visit_type_check')
     OR NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.visits'::regclass AND conname = 'visits_contact_type_check') THEN
    RAISE EXCEPTION '0830: faltan visits_visit_type_check o visits_contact_type_check (valores del mapa de calor)';
  END IF;

  -- Huella de las importadas (todas si la columna source aún no existe): se compara al final del bloque DO.
  v_source := EXISTS (SELECT 1 FROM information_schema.columns
                      WHERE table_schema = 'public' AND table_name = 'visits' AND column_name = 'source');
  EXECUTE format(
    'SELECT count(*),
            md5(string_agg(v.id::text || v.visit_type || v.contact_type || v.visit_date::text, '','' ORDER BY v.id)),
            md5(string_agg(ROW(v.id, v.kam_id, v.kam_name, v.visit_type, v.contact_type, v.lat, v.lng, v.visit_date,
                               v.hospital_id, v.imported_by, v.imported_at, v.created_at, v.updated_at,
                               v.import_id)::text, '','' ORDER BY v.id))
       FROM public.visits v %s',
    CASE WHEN v_source THEN 'WHERE v.source = ''vmo_import''' ELSE '' END)
    INTO v_n, v_md5, v_md5_todo;
  PERFORM set_config('opmap0830.importadas', v_n::text || '|' || coalesce(v_md5, '-') || '|' || coalesce(v_md5_todo, '-'),
                     true);
  RAISE NOTICE '0830: % visita(s) importada(s) antes de migrar (huella %)', v_n, coalesce(v_md5, '-');
END;
$$;

-- -------------------------------------------------------------------------------------
-- 1. visits: columnas nuevas (las filas importadas quedan source = 'vmo_import' y lo demás en NULL)
-- -------------------------------------------------------------------------------------

ALTER TABLE public.visits
  ADD COLUMN IF NOT EXISTS source           text NOT NULL DEFAULT 'vmo_import',
  ADD COLUMN IF NOT EXISTS executive_id     uuid REFERENCES public.executives (id),
  ADD COLUMN IF NOT EXISTS client_id        uuid,
  ADD COLUMN IF NOT EXISTS tipo             text,
  ADD COLUMN IF NOT EXISTS subtipo_id       uuid REFERENCES public.subtipos_institucionales (id),
  ADD COLUMN IF NOT EXISTS subtipo_codigo   text,
  ADD COLUMN IF NOT EXISTS medico_id        uuid REFERENCES public.medicos (id),
  ADD COLUMN IF NOT EXISTS cuenta_id        uuid REFERENCES public.cuentas (id),
  ADD COLUMN IF NOT EXISTS sede_id          uuid REFERENCES public.sedes (id),
  ADD COLUMN IF NOT EXISTS contacto_id      uuid REFERENCES public.contactos (id),
  ADD COLUMN IF NOT EXISTS modalidad        text,
  ADD COLUMN IF NOT EXISTS medio            text,
  ADD COLUMN IF NOT EXISTS efectiva         boolean,
  ADD COLUMN IF NOT EXISTS failure_reason   text,
  ADD COLUMN IF NOT EXISTS retry_date       date,
  ADD COLUMN IF NOT EXISTS checked_in_at    timestamptz,
  ADD COLUMN IF NOT EXISTS reported_at      timestamptz,
  ADD COLUMN IF NOT EXISTS distance_m       integer,
  ADD COLUMN IF NOT EXISTS gps_accuracy_m   integer,
  ADD COLUMN IF NOT EXISTS conclusion       text,
  ADD COLUMN IF NOT EXISTS compromisos      text,
  ADD COLUMN IF NOT EXISTS next_step_date   date,
  ADD COLUMN IF NOT EXISTS transcript       text,
  ADD COLUMN IF NOT EXISTS input_mode       text,
  ADD COLUMN IF NOT EXISTS out_of_territory boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_by       uuid REFERENCES public.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by       uuid REFERENCES public.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_at       timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_reason   text;

ALTER TABLE public.visits DROP CONSTRAINT IF EXISTS visits_source_check;
ALTER TABLE public.visits ADD CONSTRAINT visits_source_check CHECK (source IN ('vmo_import', 'app'));

-- Reglas de la tabla del contrato. Los dominios aceptan NULL (las importadas los tienen en NULL); "app ⇒ …" solo
-- obliga a las de la app. Las funciones validan antes con mensajes para la ejecutiva: esto es la última barrera.
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
        executive_id IS NOT NULL AND client_id IS NOT NULL AND tipo IS NOT NULL AND sede_id IS NOT NULL
        AND modalidad IS NOT NULL AND efectiva IS NOT NULL AND checked_in_at IS NOT NULL AND reported_at IS NOT NULL
        AND input_mode IS NOT NULL AND kam_id IS NOT NULL
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

CREATE UNIQUE INDEX IF NOT EXISTS visits_client_id_uidx    ON public.visits (client_id) WHERE client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS visits_executive_date_idx       ON public.visits (executive_id, visit_date) WHERE source = 'app';
CREATE INDEX IF NOT EXISTS visits_medico_idx               ON public.visits (medico_id, visit_date);
CREATE INDEX IF NOT EXISTS visits_cuenta_idx               ON public.visits (cuenta_id, visit_date);
CREATE INDEX IF NOT EXISTS visits_next_step_idx            ON public.visits (executive_id, next_step_date)
  WHERE deleted_at IS NULL;

-- updated_at (visits no tenía disparador) y una visita de la app no se borra: se anula con motivo.
CREATE OR REPLACE TRIGGER update_visits_updated_at
  BEFORE UPDATE ON public.visits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE OR REPLACE TRIGGER visits_app_sin_borrar
  BEFORE DELETE ON public.visits
  FOR EACH ROW WHEN (OLD.source = 'app') EXECUTE FUNCTION public.visitas_sin_borrar();

-- -------------------------------------------------------------------------------------
-- 2. visit_lines: líneas de cada visita
-- -------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.visit_lines (
  visit_id uuid NOT NULL REFERENCES public.visits (id) ON DELETE CASCADE,
  line_id  uuid NOT NULL REFERENCES public.business_lines (id),
  PRIMARY KEY (visit_id, line_id)
);
CREATE INDEX IF NOT EXISTS visit_lines_line_id_idx ON public.visit_lines (line_id);
ALTER TABLE public.visit_lines ENABLE ROW LEVEL SECURITY;

-- -------------------------------------------------------------------------------------
-- 3. Funciones de apoyo: distancia y configuración vigente
-- -------------------------------------------------------------------------------------

-- Haversine en metros enteros (radio medio IUGG 6371008.8 m). Mismo orden de operaciones que haversineM de
-- web/lib/reporte-visitas.ts: grados·π/180, c = 2·atan2(√a, √max(0, 1 − a)), redondeo al más cercano (x ≥ 0).
CREATE OR REPLACE FUNCTION public.visitas_distancia_m(p_lat1 double precision, p_lng1 double precision,
                                                      p_lat2 double precision, p_lng2 double precision)
RETURNS integer
LANGUAGE sql
IMMUTABLE
STRICT
PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
  SELECT floor(6371008.8::double precision
               * (2 * atan2(sqrt(x.a), sqrt(greatest(0::double precision, 1 - x.a)))) + 0.5)::integer
  FROM (
    SELECT sin(((p_lat2 - p_lat1) * pi() / 180) / 2) ^ 2
           + cos(p_lat1 * pi() / 180) * cos(p_lat2 * pi() / 180) * sin(((p_lng2 - p_lng1) * pi() / 180) / 2) ^ 2 AS a
  ) AS x
$$;

-- Configuración de visitas que rige para una persona en una fecha (espejo de configPersonaVigente, radioEfectivo y
-- telefonicaEfectiva de la web). Sin fila de config_personas: perfil médica e institucional, telefónica no
-- habilitada; tope y radio propios en NULL → los generales; sin config_general vigente → GENERAL_POR_DEFECTO.
CREATE OR REPLACE FUNCTION public.visitas_config_vigente(p_executive_id uuid, p_fecha date)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_perfil   text[];
  v_tel_hab  boolean;
  v_tel_tope integer;
  v_radio    integer;
  v_tiene    boolean;
  v_radio_g  jsonb;
  v_tope_g   jsonb;
  v_tel_g    jsonb;
  v_medios   jsonb;
BEGIN
  IF p_executive_id IS NULL OR p_fecha IS NULL THEN
    RAISE EXCEPTION 'Faltan la persona o la fecha de la configuración' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  SELECT cp.perfil, cp.telefonica_habilitada, cp.tope_telefonicas_dia, cp.radio_m
  INTO v_perfil, v_tel_hab, v_tel_tope, v_radio
  FROM public.config_personas cp
  WHERE cp.executive_id = p_executive_id AND cp.anulado_at IS NULL
    AND cp.vigente_desde <= p_fecha AND (cp.vigente_hasta IS NULL OR cp.vigente_hasta >= p_fecha)
  ORDER BY cp.vigente_desde DESC
  LIMIT 1;
  v_tiene := FOUND;

  SELECT cg.valor INTO v_radio_g FROM public.config_general cg
  WHERE cg.parametro = 'radio_presencial_m' AND cg.anulado_at IS NULL
    AND cg.vigente_desde <= p_fecha AND (cg.vigente_hasta IS NULL OR cg.vigente_hasta >= p_fecha)
  ORDER BY cg.vigente_desde DESC LIMIT 1;
  SELECT cg.valor INTO v_tope_g FROM public.config_general cg
  WHERE cg.parametro = 'tope_visitas_medico_dia' AND cg.anulado_at IS NULL
    AND cg.vigente_desde <= p_fecha AND (cg.vigente_hasta IS NULL OR cg.vigente_hasta >= p_fecha)
  ORDER BY cg.vigente_desde DESC LIMIT 1;
  SELECT cg.valor INTO v_tel_g FROM public.config_general cg
  WHERE cg.parametro = 'telefonicas' AND cg.anulado_at IS NULL
    AND cg.vigente_desde <= p_fecha AND (cg.vigente_hasta IS NULL OR cg.vigente_hasta >= p_fecha)
  ORDER BY cg.vigente_desde DESC LIMIT 1;

  v_medios := CASE WHEN jsonb_typeof(v_tel_g -> 'medios') = 'array' THEN v_tel_g -> 'medios'
                   ELSE '["llamada", "videollamada"]'::jsonb END;

  RETURN jsonb_build_object(
    'perfil', CASE WHEN v_tiene
                   THEN to_jsonb(ARRAY(SELECT t.tipo FROM unnest(ARRAY['medica', 'institucional']) AS t(tipo)
                                       WHERE t.tipo = ANY (v_perfil)))
                   ELSE '["medica", "institucional"]'::jsonb END,
    'radio_m', coalesce(v_radio,
                        CASE WHEN jsonb_typeof(v_radio_g) = 'number' THEN round((v_radio_g #>> '{}')::numeric)::int END,
                        500),
    'tope_visitas_medico_dia', coalesce(
                        CASE WHEN jsonb_typeof(v_tope_g) = 'number' THEN round((v_tope_g #>> '{}')::numeric)::int END,
                        1),
    'telefonica', jsonb_build_object(
      'habilitada', coalesce(v_tel_hab, false),
      'tope_dia', coalesce(v_tel_tope,
                           CASE WHEN jsonb_typeof(v_tel_g -> 'tope_dia') = 'number'
                                THEN round((v_tel_g ->> 'tope_dia')::numeric)::int END,
                           1),
      'medios', v_medios));
END;
$$;

-- -------------------------------------------------------------------------------------
-- 4. visitas_registrar: una visita de la app en una transacción
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
  v_exec         uuid;
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
  v_e_nombre     text;
  v_e_estado     text;
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
BEGIN
  IF p IS NULL OR jsonb_typeof(p) <> 'object' THEN
    RAISE EXCEPTION 'Faltan los datos de la visita' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- 0. Forma (la API ya validó con zod; aquí se revisa otra vez para que la base no dependa de la API)
  BEGIN
    v_client      := nullif(btrim(p ->> 'client_id'), '')::uuid;
    v_exec        := nullif(btrim(p ->> 'executive_id'), '')::uuid;
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
  IF v_exec IS NULL THEN
    RAISE EXCEPTION 'Falta el Ejecutivo Comercial de la visita' USING ERRCODE = 'invalid_parameter_value';
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

  -- 1. Candado por ejecutiva e idempotencia por client_id
  PERFORM pg_advisory_xact_lock(hashtext('visitas_app:' || v_exec::text));
  SELECT v.id, v.executive_id, v.out_of_territory, v.distance_m, v.visit_date
  INTO v_previa
  FROM public.visits v
  WHERE v.client_id = v_client;
  IF FOUND THEN
    IF v_previa.executive_id IS DISTINCT FROM v_exec THEN
      RAISE EXCEPTION 'Ese client_id ya se usó en otra visita' USING ERRCODE = 'unique_violation';
    END IF;
    RETURN jsonb_build_object('visita_id', v_previa.id, 'repetida', true,
                              'out_of_territory', v_previa.out_of_territory,
                              'distance_m', v_previa.distance_m, 'visit_date', v_previa.visit_date);
  END IF;

  -- 2. Ejecutiva activa con zona; mismo día (Bogotá); horas coherentes
  SELECT e.full_name, e.status, e.base_kam_id INTO v_e_nombre, v_e_estado, v_e_zona
  FROM public.executives e
  WHERE e.id = v_exec;
  IF NOT FOUND OR v_e_estado IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'Tu usuario no está enlazado con un Ejecutivo Comercial' USING ERRCODE = 'check_violation';
  END IF;
  IF v_e_zona IS NULL THEN
    RAISE EXCEPTION 'Tu Ejecutivo Comercial no tiene zona base' USING ERRCODE = 'check_violation';
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

  -- 3. Perfil vigente en la fecha
  v_cfg := public.visitas_config_vigente(v_exec, v_fecha);
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
    v_oot := NOT EXISTS (SELECT 1 FROM public.medico_visitantes mv
                         WHERE mv.medico_id = v_medico AND mv.executive_id = v_exec
                           AND mv.desde <= v_fecha AND (mv.hasta IS NULL OR mv.hasta >= v_fecha));
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

  -- 5. Presencial (radio con Haversine contra la sede) o telefónica (habilitada, medio, tope del día)
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
    WHERE v.source = 'app' AND v.executive_id = v_exec AND v.visit_date = v_fecha
      AND v.modalidad = 'telefonica' AND v.efectiva AND v.deleted_at IS NULL;
    IF v_n >= v_tope THEN
      RAISE EXCEPTION '%', CASE WHEN v_tope = 1 THEN 'Ya reportaste tu visita telefónica de hoy'
                                ELSE format('Ya reportaste las %s visitas telefónicas de hoy', v_tope) END
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  -- 6. Tope por médico (solo si suma: efectiva; presencial y telefónica cuentan igual)
  IF v_tipo = 'medica' AND v_efectiva THEN
    SELECT count(*) INTO v_n
    FROM public.visits v
    WHERE v.source = 'app' AND v.executive_id = v_exec AND v.visit_date = v_fecha
      AND v.medico_id = v_medico AND v.efectiva AND v.deleted_at IS NULL;
    IF v_n >= (v_cfg ->> 'tope_visitas_medico_dia')::integer THEN
      RAISE EXCEPTION 'Ya reportaste una visita a este médico hoy' USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  -- 7. Líneas: al menos una y todas suyas
  IF cardinality(v_lineas) = 0 THEN
    RAISE EXCEPTION 'Elige al menos una línea' USING ERRCODE = 'check_violation';
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(v_lineas) AS l(id)
             WHERE NOT EXISTS (SELECT 1 FROM public.executive_lines el
                               WHERE el.executive_id = v_exec AND el.line_id = l.id)) THEN
    RAISE EXCEPTION 'Alguna de las líneas no es tuya' USING ERRCODE = 'check_violation';
  END IF;

  -- 8. Punto del mapa de calor (visits.lat/lng son NOT NULL). Telefónica: la sede, su municipio o la zona; nunca el
  --    teléfono (v_lat ya es NULL en una telefónica).
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
    IF v_lat_mapa IS NULL THEN
      SELECT round(k.lat, 6), round(k.lng, 6) INTO v_lat_mapa, v_lng_mapa FROM public.kams k WHERE k.id = v_e_zona;
    END IF;
  END IF;

  INSERT INTO public.visits (
    kam_id, kam_name, visit_type, contact_type, lat, lng, visit_date, hospital_id,
    imported_by, imported_at, import_id,
    source, executive_id, client_id, tipo, subtipo_id, subtipo_codigo, medico_id, cuenta_id, sede_id, contacto_id,
    modalidad, medio, efectiva, failure_reason, retry_date, checked_in_at, reported_at, distance_m, gps_accuracy_m,
    conclusion, compromisos, next_step_date, transcript, input_mode, out_of_territory, created_by, updated_by)
  VALUES (
    v_e_zona, left(v_e_nombre, 255),
    CASE WHEN v_efectiva THEN 'Visita efectiva' ELSE 'Visita no efectiva' END,
    CASE WHEN v_modalidad = 'presencial' THEN 'Visita presencial' ELSE 'Visita virtual' END,
    v_lat_mapa, v_lng_mapa, v_fecha, v_s_hospital,
    NULL, NULL, NULL,
    'app', v_exec, v_client, v_tipo, v_subtipo, v_subtipo_cod, v_medico, v_cuenta, v_sede, v_contacto,
    v_modalidad, v_medio, v_efectiva, v_failure, v_retry, v_checked, v_reported, v_dist, v_precision,
    v_conclusion, v_compromisos, v_next, v_transcript, v_input, v_oot, p_user, p_user)
  RETURNING id INTO v_id;

  INSERT INTO public.visit_lines (visit_id, line_id)
  SELECT v_id, l.id FROM unnest(v_lineas) AS l(id);

  RETURN jsonb_build_object('visita_id', v_id, 'repetida', false, 'out_of_territory', v_oot,
                            'distance_m', v_dist, 'visit_date', v_fecha);
END;
$$;

-- -------------------------------------------------------------------------------------
-- 5. visitas_editar y visitas_anular: solo el mismo día, solo las suyas
-- -------------------------------------------------------------------------------------

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
  v_exec          uuid;
  v_efectiva_p    boolean;
  v_retry_p       date;
  v_next_p        date;
  v_lineas        uuid[];
  v_v             record;
  v_estado        text;
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
    v_exec       := nullif(btrim(p ->> 'executive_id'), '')::uuid;
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
  IF v_exec IS NULL THEN
    RAISE EXCEPTION 'Falta el Ejecutivo Comercial de la visita' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF p ? 'efectiva' AND v_efectiva_p IS NULL THEN
    RAISE EXCEPTION 'Indica si la visita fue efectiva (sí o no)' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF v_lineas IS NOT NULL AND (array_position(v_lineas, NULL) IS NOT NULL OR cardinality(v_lineas) > 10) THEN
    RAISE EXCEPTION 'Líneas no válidas (de 1 a 10)' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('visitas_app:' || v_exec::text));
  SELECT v.id, v.source, v.executive_id, v.deleted_at, v.visit_date, v.tipo, v.medico_id, v.modalidad,
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
  IF v_v.executive_id IS DISTINCT FROM v_exec THEN
    RAISE EXCEPTION 'Esa visita no existe' USING ERRCODE = 'no_data_found';
  END IF;
  IF v_v.deleted_at IS NOT NULL OR v_v.visit_date IS DISTINCT FROM v_hoy THEN
    RAISE EXCEPTION '%', c_no_editable USING ERRCODE = 'check_violation';
  END IF;
  SELECT e.status INTO v_estado FROM public.executives e WHERE e.id = v_exec;
  IF v_estado IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'Tu usuario no está enlazado con un Ejecutivo Comercial' USING ERRCODE = 'check_violation';
  END IF;

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

  -- Pasar a efectiva: vuelve a mirar los topes (sin contarse a sí misma)
  IF v_efectiva AND NOT v_v.efectiva THEN
    v_cfg := public.visitas_config_vigente(v_exec, v_v.visit_date);
    IF v_v.tipo = 'medica' THEN
      SELECT count(*) INTO v_n
      FROM public.visits v
      WHERE v.source = 'app' AND v.executive_id = v_exec AND v.visit_date = v_v.visit_date
        AND v.medico_id = v_v.medico_id AND v.efectiva AND v.deleted_at IS NULL AND v.id <> p_id;
      IF v_n >= (v_cfg ->> 'tope_visitas_medico_dia')::integer THEN
        RAISE EXCEPTION 'Ya reportaste una visita a este médico hoy' USING ERRCODE = 'check_violation';
      END IF;
    END IF;
    IF v_v.modalidad = 'telefonica' THEN
      v_tope := (v_cfg #>> '{telefonica,tope_dia}')::integer;
      SELECT count(*) INTO v_n
      FROM public.visits v
      WHERE v.source = 'app' AND v.executive_id = v_exec AND v.visit_date = v_v.visit_date
        AND v.modalidad = 'telefonica' AND v.efectiva AND v.deleted_at IS NULL AND v.id <> p_id;
      IF v_n >= v_tope THEN
        RAISE EXCEPTION '%', CASE WHEN v_tope = 1 THEN 'Ya reportaste tu visita telefónica de hoy'
                                  ELSE format('Ya reportaste las %s visitas telefónicas de hoy', v_tope) END
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;
  END IF;

  IF v_lineas IS NOT NULL THEN
    IF cardinality(v_lineas) = 0 THEN
      RAISE EXCEPTION 'Elige al menos una línea' USING ERRCODE = 'check_violation';
    END IF;
    IF EXISTS (SELECT 1 FROM unnest(v_lineas) AS l(id)
               WHERE NOT EXISTS (SELECT 1 FROM public.executive_lines el
                                 WHERE el.executive_id = v_exec AND el.line_id = l.id)) THEN
      RAISE EXCEPTION 'Alguna de las líneas no es tuya' USING ERRCODE = 'check_violation';
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
  v_exec        uuid;
  v_estado      text;
  v_v           record;
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

  -- La ejecutiva es la del usuario (executives.user_id es UNIQUE), como personaDelUsuario de la API.
  SELECT e.id, e.status INTO v_exec, v_estado FROM public.executives e WHERE e.user_id = p_user;
  IF NOT FOUND OR v_estado IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'Tu usuario no está enlazado con un Ejecutivo Comercial' USING ERRCODE = 'check_violation';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('visitas_app:' || v_exec::text));
  SELECT v.id, v.source, v.executive_id, v.deleted_at, v.visit_date INTO v_v
  FROM public.visits v
  WHERE v.id = p_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Esa visita no existe' USING ERRCODE = 'no_data_found';
  END IF;
  IF v_v.source IS DISTINCT FROM 'app' THEN
    RAISE EXCEPTION '%', c_no_editable USING ERRCODE = 'check_violation';
  END IF;
  IF v_v.executive_id IS DISTINCT FROM v_exec THEN
    RAISE EXCEPTION 'Esa visita no existe' USING ERRCODE = 'no_data_found';
  END IF;
  IF v_v.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Esa visita ya está anulada' USING ERRCODE = 'check_violation';
  END IF;
  IF v_v.visit_date IS DISTINCT FROM v_hoy THEN
    RAISE EXCEPTION '%', c_no_editable USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.visits
  SET deleted_at = now(), deleted_reason = v_motivo, updated_by = p_user
  WHERE id = p_id;
END;
$$;

-- -------------------------------------------------------------------------------------
-- 6. Seguridad: RLS sin políticas en visit_lines; nada para PUBLIC/anon/authenticated; service_role lo que usa
-- -------------------------------------------------------------------------------------

REVOKE ALL ON TABLE public.visit_lines FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.visit_lines TO service_role;
-- visits: sin cambios para service_role (todo, como hoy: la importación de VMO borra por mes e import_id); se
-- asegura que PUBLIC, anon y authenticated sigan sin nada.
REVOKE ALL ON TABLE public.visits FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.visitas_registrar(jsonb, uuid)                FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.visitas_editar(uuid, jsonb, uuid)             FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.visitas_anular(uuid, text, uuid)              FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.visitas_config_vigente(uuid, date)            FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.visitas_distancia_m(double precision, double precision, double precision, double precision)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.visitas_registrar(jsonb, uuid)             TO service_role;
GRANT EXECUTE ON FUNCTION public.visitas_editar(uuid, jsonb, uuid)          TO service_role;
GRANT EXECUTE ON FUNCTION public.visitas_anular(uuid, text, uuid)           TO service_role;
GRANT EXECUTE ON FUNCTION public.visitas_config_vigente(uuid, date)         TO service_role;
GRANT EXECUTE ON FUNCTION public.visitas_distancia_m(double precision, double precision, double precision, double precision)
  TO service_role;

-- -------------------------------------------------------------------------------------
-- 7. Documentación en el catálogo
-- -------------------------------------------------------------------------------------

COMMENT ON TABLE public.visits IS
  'Visitas: las importadas de VMO (source vmo_import, histórico del mapa de calor) y las que reporta la app (source app, con visitas_registrar). Las de la app no se borran: se anulan (deleted_at).';
COMMENT ON COLUMN public.visits.source IS 'vmo_import (las 7.033 de VMO, intactas) | app (reportada desde el teléfono).';
COMMENT ON COLUMN public.visits.executive_id IS 'Ejecutivo Comercial que reporta (obligatorio en las de la app).';
COMMENT ON COLUMN public.visits.client_id IS 'uuid que genera la app por visita: el mismo dos veces devuelve la misma fila (reintento sin señal).';
COMMENT ON COLUMN public.visits.tipo IS 'medica (médico + sede donde atiende) | institucional (cuenta + sede + subtipo).';
COMMENT ON COLUMN public.visits.subtipo_id IS 'Subtipo institucional vigente en la fecha; NULL en las médicas.';
COMMENT ON COLUMN public.visits.subtipo_codigo IS 'Copia de subtipos_institucionales.codigo al registrar.';
COMMENT ON COLUMN public.visits.medico_id IS 'Médico visitado (médicas); NULL en las institucionales.';
COMMENT ON COLUMN public.visits.cuenta_id IS 'Cuenta visitada (institucionales).';
COMMENT ON COLUMN public.visits.sede_id IS 'Sede donde fue la visita (de la cuenta, o donde atiende el médico).';
COMMENT ON COLUMN public.visits.contacto_id IS 'Contacto de la cuenta (solo institucionales, opcional).';
COMMENT ON COLUMN public.visits.modalidad IS 'presencial (a menos del radio de la sede) | telefonica (si la persona la tiene habilitada).';
COMMENT ON COLUMN public.visits.medio IS 'llamada | videollamada (solo telefónica).';
COMMENT ON COLUMN public.visits.efectiva IS 'Solo la efectiva suma; la no efectiva lleva failure_reason. visit_type la refleja para el mapa.';
COMMENT ON COLUMN public.visits.failure_reason IS 'Motivo de la visita no efectiva (≤ 300).';
COMMENT ON COLUMN public.visits.retry_date IS 'Fecha para reintentar una visita no efectiva.';
COMMENT ON COLUMN public.visits.checked_in_at IS 'Instante en el sitio (teléfono); visit_date es su fecha en Bogotá y debe ser hoy al registrar.';
COMMENT ON COLUMN public.visits.reported_at IS 'Instante en que la ejecutiva confirmó el reporte (≥ checked_in_at).';
COMMENT ON COLUMN public.visits.distance_m IS 'Metros del teléfono a la sede (Haversine en el servidor, visitas_distancia_m); obligatorio en presencial.';
COMMENT ON COLUMN public.visits.gps_accuracy_m IS 'Precisión que reporta el GPS del teléfono, en metros (referencia).';
COMMENT ON COLUMN public.visits.conclusion IS 'Conclusión de la visita (≤ 2000).';
COMMENT ON COLUMN public.visits.compromisos IS 'Compromisos acordados (≤ 2000).';
COMMENT ON COLUMN public.visits.next_step_date IS 'Próxima reunión; vencida sin visita posterior al mismo médico o cuenta = compromiso vencido.';
COMMENT ON COLUMN public.visits.transcript IS 'Transcripción del dictado (≤ 8000). Interna: ejecutiva, su líder y dirección. No hay columna de audio: el audio nunca se guarda.';
COMMENT ON COLUMN public.visits.input_mode IS 'voz | toques.';
COMMENT ON COLUMN public.visits.out_of_territory IS 'Médica a un médico del que no es visitante vigente: suma a su meta y queda marcada.';
COMMENT ON COLUMN public.visits.created_by IS 'Usuario que registró la visita.';
COMMENT ON COLUMN public.visits.updated_by IS 'Último usuario que la corrigió o la anuló.';
COMMENT ON COLUMN public.visits.deleted_at IS 'Anulada (la fila se queda; no suma).';
COMMENT ON COLUMN public.visits.deleted_reason IS 'Motivo de la anulación (5..300), obligatorio si deleted_at.';
COMMENT ON TABLE public.visit_lines IS 'Líneas de negocio de cada visita (al menos una, todas de la ejecutiva). RLS sin políticas; solo service_role.';
COMMENT ON FUNCTION public.visitas_distancia_m(double precision, double precision, double precision, double precision) IS
  'Haversine en metros enteros (radio 6371008.8 m, redondeo al más cercano); misma fórmula que haversineM de web/lib/reporte-visitas.ts.';
COMMENT ON FUNCTION public.visitas_config_vigente(uuid, date) IS
  'Configuración de visitas vigente para una persona en una fecha: { perfil, radio_m, tope_visitas_medico_dia, telefonica: { habilitada, tope_dia, medios } } (config_personas y config_general, o GENERAL_POR_DEFECTO).';
COMMENT ON FUNCTION public.visitas_registrar(jsonb, uuid) IS
  'Registra una visita de la app en una transacción (contrato fase 8, pasos 1 a 8): idempotente por client_id; mismo día en Bogotá, perfil, sede, médico o cuenta, radio presencial, telefónica, topes y líneas; 22023 forma, 23514 regla, 23505 client_id ajeno. Devuelve { visita_id, repetida, out_of_territory, distance_m, visit_date }.';
COMMENT ON FUNCTION public.visitas_editar(uuid, jsonb, uuid) IS
  'Corrige una visita de la app de la misma ejecutiva y del mismo día (conclusión, compromisos, próxima reunión, efectiva y motivo, líneas); a efectiva revalida los topes. P0002 inexistente o ajena; 23514 no editable.';
COMMENT ON FUNCTION public.visitas_anular(uuid, text, uuid) IS
  'Anula con motivo (5..300) una visita de la app de la ejecutiva de p_user y del mismo día (deleted_at); la fila no se borra. P0002 inexistente o ajena; 23514 no editable o ya anulada.';

-- -------------------------------------------------------------------------------------
-- 8. Comprobaciones (aborta la transacción si algo no cuadra). Las pruebas que escriben van en sub-bloques que
--    terminan con RAISE SQLSTATE 'P0830': PL/pgSQL deshace todo lo del sub-bloque (no queda ni cambia ninguna
--    fila). Cualquier otra excepción sale del bloque y aborta la migración.
-- -------------------------------------------------------------------------------------

DO $$
DECLARE
  v_hoy         constant date := (now() AT TIME ZONE 'America/Bogota')::date;
  v_todos_priv  constant text := 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER';
  c_no_editable constant text := 'Solo puedes corregir o anular tus visitas del mismo día';
  c_sin_ejec    constant text := 'Tu usuario no está enlazado con un Ejecutivo Comercial';
  c_motivo      constant text := 'Indica el motivo de la visita no efectiva (hasta 300 caracteres)';
  v_fn          text;
  v_col         record;
  v_caso        record;
  v_fila        record;
  v_casos       text[] := '{}';
  v_estado      text;
  v_msg         text;
  v_n           bigint;
  v_antes       text[];
  v_md5         text;
  v_md5_todo    text;
  v_cfg_antes   text;
  v_cfg_despues text;
  v_cfg         jsonb;
  v_r           jsonb;
  v_r2          jsonb;
  v_rol_ok      boolean;
  v_a           uuid;
  v_a_nombre    text;
  v_a_zona      uuid;
  v_a_user      uuid;
  v_a_fila      text;
  v_a_lineas    uuid[];
  v_l1          uuid;
  v_l2          uuid;
  v_l_ajena     uuid;
  v_b           uuid;
  v_vacante     uuid;
  v_c1          uuid;
  v_c2          uuid;
  v_c3          uuid;
  v_s1          uuid;
  v_s0          uuid;
  v_s2          uuid;
  v_s3          uuid;
  v_k1          uuid;
  v_k2          uuid;
  v_k3          uuid;
  v_m1          uuid;
  v_m2          uuid;
  v_m3          uuid;
  v_m4          uuid;
  v_sub         uuid;
  v_sub_viejo   uuid;
  v_sede_ips    uuid;
  v_hosp_ips    uuid;
  v_lat_ips     numeric;
  v_lng_ips     numeric;
  v_mlat        numeric;
  v_mlng        numeric;
  v_importada   uuid;
  v_base        jsonb;
  v_base_inst   jsonb;
  v_cliente     uuid;
  v_id1         uuid;
  v_id2         uuid;
  v_id3         uuid;
  v_ayer        uuid;
BEGIN
  -- 8.1 Estructura: 14 columnas originales + 29 nuevas, sin columna de audio ---------------------------------------
  FOR v_col IN
    SELECT * FROM (VALUES
      ('source', 'text', 'NO'), ('executive_id', 'uuid', 'YES'), ('client_id', 'uuid', 'YES'),
      ('tipo', 'text', 'YES'), ('subtipo_id', 'uuid', 'YES'), ('subtipo_codigo', 'text', 'YES'),
      ('medico_id', 'uuid', 'YES'), ('cuenta_id', 'uuid', 'YES'), ('sede_id', 'uuid', 'YES'),
      ('contacto_id', 'uuid', 'YES'), ('modalidad', 'text', 'YES'), ('medio', 'text', 'YES'),
      ('efectiva', 'boolean', 'YES'), ('failure_reason', 'text', 'YES'), ('retry_date', 'date', 'YES'),
      ('checked_in_at', 'timestamp with time zone', 'YES'), ('reported_at', 'timestamp with time zone', 'YES'),
      ('distance_m', 'integer', 'YES'), ('gps_accuracy_m', 'integer', 'YES'), ('conclusion', 'text', 'YES'),
      ('compromisos', 'text', 'YES'), ('next_step_date', 'date', 'YES'), ('transcript', 'text', 'YES'),
      ('input_mode', 'text', 'YES'), ('out_of_territory', 'boolean', 'NO'), ('created_by', 'uuid', 'YES'),
      ('updated_by', 'uuid', 'YES'), ('deleted_at', 'timestamp with time zone', 'YES'),
      ('deleted_reason', 'text', 'YES')
    ) AS t(nombre, tipo, nulo)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns c
                   WHERE c.table_schema = 'public' AND c.table_name = 'visits' AND c.column_name = v_col.nombre
                     AND c.data_type = v_col.tipo AND c.is_nullable = v_col.nulo) THEN
      RAISE EXCEPTION '0830: falta visits.% (% , NULL: %)', v_col.nombre, v_col.tipo, v_col.nulo;
    END IF;
  END LOOP;
  SELECT count(*) INTO v_n FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'visits';
  IF v_n <> 43 THEN
    RAISE EXCEPTION '0830: visits tiene % columnas; se esperaban 43 (14 + 29)', v_n;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name IN ('visits', 'visit_lines') AND column_name ILIKE '%audio%') THEN
    RAISE EXCEPTION '0830: hay una columna de audio; el audio nunca se guarda';
  END IF;

  FOR v_col IN
    SELECT * FROM (VALUES
      ('visits_executive_id_fkey', 'public.executives'), ('visits_subtipo_id_fkey', 'public.subtipos_institucionales'),
      ('visits_medico_id_fkey', 'public.medicos'), ('visits_cuenta_id_fkey', 'public.cuentas'),
      ('visits_sede_id_fkey', 'public.sedes'), ('visits_contacto_id_fkey', 'public.contactos'),
      ('visits_created_by_fkey', 'public.users'), ('visits_updated_by_fkey', 'public.users')
    ) AS t(nombre, destino)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_constraint c
                   WHERE c.conrelid = 'public.visits'::regclass AND c.conname = v_col.nombre AND c.contype = 'f'
                     AND c.confrelid = v_col.destino::regclass) THEN
      RAISE EXCEPTION '0830: falta la llave % hacia %', v_col.nombre, v_col.destino;
    END IF;
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.visits'::regclass AND conname = 'visits_app_check' AND contype = 'c')
     OR NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.visits'::regclass AND conname = 'visits_source_check' AND contype = 'c') THEN
    RAISE EXCEPTION '0830: faltan visits_app_check o visits_source_check';
  END IF;
  FOR v_col IN
    SELECT * FROM (VALUES
      ('visits_client_id_uidx', true, true), ('visits_executive_date_idx', false, true),
      ('visits_medico_idx', false, false), ('visits_cuenta_idx', false, false), ('visits_next_step_idx', false, true)
    ) AS t(nombre, unico, parcial)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid
                   WHERE i.indrelid = 'public.visits'::regclass AND c.relname = v_col.nombre
                     AND i.indisunique = v_col.unico AND (i.indpred IS NOT NULL) = v_col.parcial) THEN
      RAISE EXCEPTION '0830: falta el índice % (único: %, parcial: %)', v_col.nombre, v_col.unico, v_col.parcial;
    END IF;
  END LOOP;
  FOR v_col IN
    SELECT * FROM (VALUES ('update_visits_updated_at'), ('visits_app_sin_borrar')) AS t(nombre)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_trigger t
                   WHERE t.tgrelid = 'public.visits'::regclass AND t.tgname = v_col.nombre AND NOT t.tgisinternal) THEN
      RAISE EXCEPTION '0830: falta el disparador % en visits', v_col.nombre;
    END IF;
  END LOOP;

  -- visit_lines: PK, llaves, RLS sin políticas, privilegios
  IF to_regclass('public.visit_lines') IS NULL THEN
    RAISE EXCEPTION '0830: falta la tabla public.visit_lines';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conrelid = 'public.visit_lines'::regclass AND c.contype = 'p')
     OR NOT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conrelid = 'public.visit_lines'::regclass AND c.contype = 'f'
                      AND c.confrelid = 'public.visits'::regclass AND c.confdeltype = 'c')
     OR NOT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conrelid = 'public.visit_lines'::regclass AND c.contype = 'f'
                      AND c.confrelid = 'public.business_lines'::regclass) THEN
    RAISE EXCEPTION '0830: visit_lines necesita PK, llave a visits ON DELETE CASCADE y llave a business_lines';
  END IF;
  IF NOT (SELECT c.relrowsecurity FROM pg_class c WHERE c.oid = 'public.visit_lines'::regclass) THEN
    RAISE EXCEPTION '0830: public.visit_lines sin RLS';
  END IF;
  SELECT count(*) INTO v_n FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('visit_lines', 'visits');
  IF v_n > 0 THEN
    RAISE EXCEPTION '0830: visits o visit_lines tienen % política(s) RLS; deben tener 0', v_n;
  END IF;
  IF NOT (SELECT c.relrowsecurity FROM pg_class c WHERE c.oid = 'public.visits'::regclass) THEN
    RAISE EXCEPTION '0830: public.visits sin RLS';
  END IF;
  IF has_table_privilege('anon', 'public.visit_lines', v_todos_priv)
     OR has_table_privilege('authenticated', 'public.visit_lines', v_todos_priv)
     OR has_table_privilege('anon', 'public.visits', v_todos_priv)
     OR has_table_privilege('authenticated', 'public.visits', v_todos_priv) THEN
    RAISE EXCEPTION '0830: anon/authenticated tienen privilegios sobre visits o visit_lines';
  END IF;
  IF NOT has_table_privilege('service_role', 'public.visit_lines', 'SELECT')
     OR NOT has_table_privilege('service_role', 'public.visit_lines', 'INSERT')
     OR NOT has_table_privilege('service_role', 'public.visit_lines', 'UPDATE')
     OR NOT has_table_privilege('service_role', 'public.visit_lines', 'DELETE')
     OR has_table_privilege('service_role', 'public.visit_lines', 'TRUNCATE') THEN
    RAISE EXCEPTION '0830: service_role debe tener SELECT, INSERT, UPDATE y DELETE (sin TRUNCATE) en visit_lines';
  END IF;
  IF NOT has_table_privilege('service_role', 'public.visits', 'SELECT')
     OR NOT has_table_privilege('service_role', 'public.visits', 'INSERT')
     OR NOT has_table_privilege('service_role', 'public.visits', 'UPDATE')
     OR NOT has_table_privilege('service_role', 'public.visits', 'DELETE') THEN
    RAISE EXCEPTION '0830: service_role perdió SELECT, INSERT, UPDATE o DELETE en visits (la importación de VMO los usa)';
  END IF;

  FOREACH v_fn IN ARRAY ARRAY['public.visitas_registrar(jsonb, uuid)', 'public.visitas_editar(uuid, jsonb, uuid)',
                              'public.visitas_anular(uuid, text, uuid)', 'public.visitas_config_vigente(uuid, date)',
                              'public.visitas_distancia_m(double precision, double precision, double precision, double precision)'] LOOP
    IF to_regprocedure(v_fn) IS NULL THEN
      RAISE EXCEPTION '0830: falta la función %', v_fn;
    END IF;
    IF has_function_privilege('anon', v_fn, 'EXECUTE') OR has_function_privilege('authenticated', v_fn, 'EXECUTE') THEN
      RAISE EXCEPTION '0830: anon/authenticated pueden ejecutar %', v_fn;
    END IF;
    IF NOT has_function_privilege('service_role', v_fn, 'EXECUTE') THEN
      RAISE EXCEPTION '0830: service_role no puede ejecutar %', v_fn;
    END IF;
    IF (SELECT p.prosecdef FROM pg_proc p WHERE p.oid = to_regprocedure(v_fn)) THEN
      RAISE EXCEPTION '0830: % debe ser SECURITY INVOKER', v_fn;
    END IF;
  END LOOP;

  -- 8.2 Haversine con las cifras de web/lib/reporte-visitas.ts (haversineM, mismos puntos) ---------------------------
  IF public.visitas_distancia_m(4.6, -74.08, 4.603, -74.08) <> 334
     OR public.visitas_distancia_m(4.6, -74.08, 4.6072, -74.08) <> 801
     OR public.visitas_distancia_m(4.6, -74.08, 4.601234, -74.081234) <> 194
     OR public.visitas_distancia_m(4.6, -74.08, 4.6045, -74.08) <> 500
     OR public.visitas_distancia_m(4.711, -74.0721, 6.2442, -75.5812) <> 238673
     OR public.visitas_distancia_m(6.2442, -75.5812, 4.711, -74.0721) <> 238673
     OR public.visitas_distancia_m(4.711, -74.0721, 4.711, -74.0721) <> 0
     OR public.visitas_distancia_m(0, 0, 0, 0.009) NOT BETWEEN 1000 AND 1002
     OR public.visitas_distancia_m(NULL, -74.08, 4.6, -74.08) IS NOT NULL THEN
    RAISE EXCEPTION '0830: visitas_distancia_m no da las cifras de haversineM (334, 801, 194, 500, 238673, 0)';
  END IF;
  v_casos := v_casos || 'Haversine igual que la web'::text;

  -- 8.3 Configuración por defecto de quien no tiene fila propia ----------------------------------------------------
  v_cfg := public.visitas_config_vigente(gen_random_uuid(), v_hoy);
  IF v_cfg -> 'perfil' <> '["medica", "institucional"]'::jsonb
     OR (v_cfg #>> '{telefonica,habilitada}')::boolean
     OR NOT (v_cfg ? 'radio_m' AND v_cfg ? 'tope_visitas_medico_dia' AND v_cfg #> '{telefonica,tope_dia}' IS NOT NULL
             AND jsonb_typeof(v_cfg #> '{telefonica,medios}') = 'array') THEN
    RAISE EXCEPTION '0830: visitas_config_vigente sin fila propia no da el perfil y la telefónica por defecto: %', v_cfg;
  END IF;
  BEGIN
    PERFORM public.visitas_registrar('[]'::jsonb, NULL);
    RAISE EXCEPTION '0830: visitas_registrar aceptó un p que no es objeto';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;

  -- 8.4 Ejecutiva A para las pruebas: activa real con zona, usuario, alguna línea, una línea que no lleva y sin
  --     visitas de la app hoy (si se re-ejecuta con datos reales, los topes no se mezclan).
  SELECT e.id, e.full_name, e.base_kam_id, e.user_id
  INTO v_a, v_a_nombre, v_a_zona, v_a_user
  FROM public.executives e
  WHERE e.status = 'active' AND e.base_kam_id IS NOT NULL AND e.user_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.executive_lines el WHERE el.executive_id = e.id)
    AND EXISTS (SELECT 1 FROM public.business_lines bl
                WHERE NOT EXISTS (SELECT 1 FROM public.executive_lines el
                                  WHERE el.executive_id = e.id AND el.line_id = bl.id))
    AND NOT EXISTS (SELECT 1 FROM public.visits v
                    WHERE v.source = 'app' AND v.executive_id = e.id AND v.visit_date = v_hoy)
  ORDER BY (SELECT count(*) FROM public.executive_lines el WHERE el.executive_id = e.id) DESC, e.id
  LIMIT 1;

  IF v_a IS NULL THEN
    RAISE WARNING '0830: no hay una ejecutiva activa con zona, usuario y líneas; no se probaron visitas_registrar, visitas_editar ni visitas_anular con datos';
  ELSE
    SELECT array_agg(el.line_id ORDER BY el.line_id) INTO v_a_lineas
    FROM public.executive_lines el WHERE el.executive_id = v_a;
    v_l1 := v_a_lineas[1];
    v_l2 := v_a_lineas[2];
    SELECT bl.id INTO v_l_ajena FROM public.business_lines bl
    WHERE bl.id <> ALL (v_a_lineas) ORDER BY bl.sort_order, bl.id LIMIT 1;
    SELECT to_jsonb(e)::text INTO v_a_fila FROM public.executives e WHERE e.id = v_a;
    SELECT e.id INTO v_b FROM public.executives e WHERE e.status = 'active' AND e.id <> v_a ORDER BY e.id LIMIT 1;
    SELECT e.id INTO v_vacante FROM public.executives e WHERE e.status = 'placeholder' ORDER BY e.id LIMIT 1;
    SELECT s.id, s.hospital_id, s.lat, s.lng INTO v_sede_ips, v_hosp_ips, v_lat_ips, v_lng_ips
    FROM public.sedes s
    WHERE s.activo AND s.hospital_id IS NOT NULL AND s.lat IS NOT NULL
    ORDER BY s.id LIMIT 1;
    SELECT v.id INTO v_importada FROM public.visits v WHERE v.source = 'vmo_import' ORDER BY v.id LIMIT 1;
    SELECT md5(coalesce(string_agg(to_jsonb(cg)::text, ',' ORDER BY cg.id), '')) INTO v_cfg_antes
    FROM public.config_general cg;
    SELECT v_cfg_antes || md5(coalesce(string_agg(to_jsonb(cp)::text, ',' ORDER BY cp.id), '')) INTO v_cfg_antes
    FROM public.config_personas cp;

    IF EXISTS (SELECT 1 FROM public.medicos WHERE numero_documento LIKE 'PRUEBA0830%')
       OR EXISTS (SELECT 1 FROM public.cuentas WHERE numero_identificacion LIKE 'PRUEBA0830%')
       OR EXISTS (SELECT 1 FROM public.subtipos_institucionales WHERE codigo LIKE 'prueba_0830%') THEN
      RAISE EXCEPTION '0830: ya hay datos con la identificación de prueba (PRUEBA0830… o prueba_0830…); no se puede probar';
    END IF;

    BEGIN
      -- 8.5 Preparación (se deshace al final con P0830) ---------------------------------------------------------
      -- Configuración conocida desde hoy: radio 500, una por médico, telefónicas 1 por llamada o videollamada; A
      -- con perfil médica e institucional y sin telefónica (las pruebas no dependen de la configuración real).
      PERFORM public.config_registrar('config_general', jsonb_build_object('parametro', 'radio_presencial_m', 'valor', 500),
                                      v_hoy, NULL, NULL, NULL);
      PERFORM public.config_registrar('config_general', jsonb_build_object('parametro', 'tope_visitas_medico_dia', 'valor', 1),
                                      v_hoy, NULL, NULL, NULL);
      PERFORM public.config_registrar('config_general', jsonb_build_object('parametro', 'telefonicas', 'valor',
                                        jsonb_build_object('tope_dia', 1, 'peso', 1,
                                                           'medios', jsonb_build_array('llamada', 'videollamada'))),
                                      v_hoy, NULL, NULL, NULL);
      PERFORM public.config_registrar('config_personas', jsonb_build_object('executive_id', v_a,
                                        'perfil', jsonb_build_array('medica', 'institucional'),
                                        'telefonica_habilitada', false),
                                      v_hoy, NULL, NULL, NULL);
      v_cfg := public.visitas_config_vigente(v_a, v_hoy);
      IF v_cfg <> jsonb_build_object('perfil', jsonb_build_array('medica', 'institucional'), 'radio_m', 500,
                                     'tope_visitas_medico_dia', 1,
                                     'telefonica', jsonb_build_object('habilitada', false, 'tope_dia', 1,
                                                                      'medios', jsonb_build_array('llamada', 'videollamada'))) THEN
        RAISE EXCEPTION '0830: visitas_config_vigente no lee la configuración registrada: %', v_cfg;
      END IF;

      -- Cuentas, sedes y contactos de prueba: S1 en (4.6, -74.08), S0 sin coordenadas, S2 de otra cuenta.
      INSERT INTO public.cuentas (nombre, clase, tipo_identificacion, numero_identificacion)
      VALUES ('Cuenta de prueba 0830 uno', 'clinica', 'otro', 'PRUEBA0830C1') RETURNING id INTO v_c1;
      INSERT INTO public.cuentas (nombre, clase, tipo_identificacion, numero_identificacion)
      VALUES ('Cuenta de prueba 0830 dos', 'clinica', 'otro', 'PRUEBA0830C2') RETURNING id INTO v_c2;
      INSERT INTO public.sedes (cuenta_id, nombre, es_principal, municipality_id, ciudad, lat, lng)
      VALUES (v_c1, 'Sede de prueba 0830 uno', true, '11001', 'Bogotá', 4.6, -74.08) RETURNING id INTO v_s1;
      INSERT INTO public.sedes (cuenta_id, nombre, es_principal, municipality_id, ciudad)
      VALUES (v_c1, 'Sede de prueba 0830 sin ubicación', false, '11001', 'Bogotá') RETURNING id INTO v_s0;
      INSERT INTO public.sedes (cuenta_id, nombre, es_principal, municipality_id, ciudad, lat, lng)
      VALUES (v_c2, 'Sede de prueba 0830 dos', true, '11001', 'Bogotá', 4.61, -74.09) RETURNING id INTO v_s2;
      INSERT INTO public.contactos (cuenta_id, nombre, cargo_texto, rol)
      VALUES (v_c1, 'Contacto de prueba 0830 uno', 'Jefe de compras', 'compras') RETURNING id INTO v_k1;
      INSERT INTO public.contactos (cuenta_id, nombre, cargo_texto, rol)
      VALUES (v_c2, 'Contacto de prueba 0830 dos', 'Jefe de compras', 'compras') RETURNING id INTO v_k2;
      -- Contacto dado de baja en C1; C3 con su sede S3 (activa, en el mismo punto que S1) se desactiva más abajo.
      INSERT INTO public.contactos (cuenta_id, nombre, cargo_texto, rol, activo)
      VALUES (v_c1, 'Contacto de prueba 0830 inactivo', 'Jefe de compras', 'compras', false) RETURNING id INTO v_k3;
      INSERT INTO public.cuentas (nombre, clase, tipo_identificacion, numero_identificacion)
      VALUES ('Cuenta de prueba 0830 inactiva', 'clinica', 'otro', 'PRUEBA0830C3') RETURNING id INTO v_c3;
      INSERT INTO public.sedes (cuenta_id, nombre, es_principal, municipality_id, ciudad, lat, lng)
      VALUES (v_c3, 'Sede de prueba 0830 de cuenta inactiva', true, '11001', 'Bogotá', 4.6, -74.08) RETURNING id INTO v_s3;

      -- Subtipos de prueba: uno vigente y uno que terminó ayer.
      INSERT INTO public.subtipos_institucionales (codigo, nombre, para_que, roles_sugeridos, orden, vigente_desde)
      VALUES ('prueba_0830_vigente', 'Prueba 0830 vigente', 'Prueba de la migración 0830', '{compras}', 990, v_hoy - 10)
      RETURNING id INTO v_sub;
      INSERT INTO public.subtipos_institucionales (codigo, nombre, para_que, roles_sugeridos, orden, vigente_desde, vigente_hasta)
      VALUES ('prueba_0830_viejo', 'Prueba 0830 viejo', 'Prueba de la migración 0830', '{compras}', 991, v_hoy - 10, v_hoy - 1)
      RETURNING id INTO v_sub_viejo;

      -- Médicos de prueba (reglas de 0800: completos y con sede): M1 atiende en S1 y S0 y A lo visita; M2 atiende
      -- en S1 y A lo visitó hasta hace 5 días (fuera de territorio); M3 atiende en S1 y en una IPS real y A lo
      -- visita; M4 inactivo.
      v_m1 := public.terceros_crear_medico(
                jsonb_build_object('tipo_documento', 'otro', 'numero_documento', 'PRUEBA0830M1',
                                   'nombre', 'Médico de prueba 0830 uno', 'especialidades', jsonb_build_array('ortopedia'),
                                   'municipality_id', '11001'),
                jsonb_build_array(jsonb_build_object('sede_id', v_s1, 'rol', 'atiende', 'principal', true),
                                  jsonb_build_object('sede_id', v_s0, 'rol', 'consultorio')),
                v_a_user);
      v_m2 := public.terceros_crear_medico(
                jsonb_build_object('tipo_documento', 'otro', 'numero_documento', 'PRUEBA0830M2',
                                   'nombre', 'Médico de prueba 0830 dos', 'especialidades', jsonb_build_array('columna'),
                                   'municipality_id', '11001'),
                jsonb_build_array(jsonb_build_object('sede_id', v_s1, 'rol', 'atiende', 'principal', true)),
                v_a_user);
      v_m3 := public.terceros_crear_medico(
                jsonb_build_object('tipo_documento', 'otro', 'numero_documento', 'PRUEBA0830M3',
                                   'nombre', 'Médico de prueba 0830 tres', 'especialidades', jsonb_build_array('ortopedia'),
                                   'municipality_id', '11001'),
                jsonb_build_array(jsonb_build_object('sede_id', v_s1, 'rol', 'atiende', 'principal', true))
                || CASE WHEN v_sede_ips IS NOT NULL
                        THEN jsonb_build_array(jsonb_build_object('sede_id', v_sede_ips, 'rol', 'atiende'))
                        ELSE '[]'::jsonb END,
                v_a_user);
      v_m4 := public.terceros_crear_medico(
                jsonb_build_object('tipo_documento', 'otro', 'numero_documento', 'PRUEBA0830M4',
                                   'nombre', 'Médico de prueba 0830 cuatro', 'especialidades', jsonb_build_array('ortopedia'),
                                   'municipality_id', '11001'),
                jsonb_build_array(jsonb_build_object('sede_id', v_s1, 'rol', 'atiende', 'principal', true)),
                v_a_user);
      UPDATE public.medicos SET activo = false WHERE id = v_m4;
      -- M1 atiende también en S3 (la de la cuenta que se desactiva): la médica ahí se rechaza por la cuenta.
      INSERT INTO public.medico_sedes (medico_id, sede_id, rol) VALUES (v_m1, v_s3, 'atiende');
      UPDATE public.cuentas SET activo = false WHERE id = v_c3;
      INSERT INTO public.medico_visitantes (medico_id, executive_id, line_id, desde)
      VALUES (v_m1, v_a, v_l1, v_hoy - 10), (v_m3, v_a, v_l1, v_hoy - 10);
      INSERT INTO public.medico_visitantes (medico_id, executive_id, line_id, desde, hasta)
      VALUES (v_m2, v_a, v_l1, v_hoy - 30, v_hoy - 5);

      v_base := jsonb_build_object(
        'executive_id', v_a, 'tipo', 'medica', 'medico_id', v_m1, 'sede_id', v_s1, 'modalidad', 'presencial',
        'efectiva', true, 'checked_in_at', now(), 'reported_at', now(), 'lat', 4.603, 'lng', -74.08,
        'gps_accuracy_m', 12, 'input_mode', 'toques', 'lineas', jsonb_build_array(v_l1));
      v_base_inst := jsonb_build_object(
        'executive_id', v_a, 'tipo', 'institucional', 'cuenta_id', v_c1, 'subtipo_id', v_sub, 'contacto_id', v_k1,
        'sede_id', v_s1, 'modalidad', 'presencial', 'efectiva', true, 'checked_in_at', now(), 'reported_at', now(),
        'lat', 4.6, 'lng', -74.08, 'input_mode', 'voz', 'transcript', 'Prueba 0830: visita a compras',
        'lineas', jsonb_build_array(v_l1));

      -- 8.6 Rechazos de visitas_registrar (cada uno se deshace solo: el error aborta su sub-bloque) -----------------
      FOR v_caso IN
        SELECT * FROM (VALUES
          ('lejos (801 m)', v_base || '{"lat": 4.6072, "lng": -74.08}'::jsonb, NULL::text[], '23514',
           'Estás a 801 m de Sede de prueba 0830 uno; el radio es 500 m'),
          ('sede sin coordenadas', v_base || jsonb_build_object('sede_id', v_s0), NULL, '23514',
           'Esta sede no tiene ubicación: confírmala o crea la sede'),
          ('presencial sin ubicación del teléfono', v_base, ARRAY['lat', 'lng'], '23514',
           'La ubicación del teléfono es obligatoria en una visita presencial'),
          ('telefónica sin habilitar', v_base || jsonb_build_object('modalidad', 'telefonica', 'medio', 'llamada', 'sede_id', v_s0),
           ARRAY['lat', 'lng'], '23514', 'No tienes habilitada la visita telefónica'),
          ('médico inexistente', v_base || jsonb_build_object('medico_id', gen_random_uuid()), NULL, '23514',
           'Ese médico no existe o está inactivo'),
          ('médico inactivo', v_base || jsonb_build_object('medico_id', v_m4), NULL, '23514',
           'Ese médico no existe o está inactivo'),
          ('sede donde el médico no atiende', v_base || jsonb_build_object('sede_id', v_s2), NULL, '23514',
           'El médico no atiende en esa sede'),
          ('sede inexistente', v_base || jsonb_build_object('sede_id', gen_random_uuid()), NULL, '23514', 'Esa sede no existe'),
          ('líneas ajenas', v_base || jsonb_build_object('lineas', jsonb_build_array(coalesce(v_l_ajena, gen_random_uuid()))),
           NULL, '23514', 'Alguna de las líneas no es tuya'),
          ('sin líneas', v_base || '{"lineas": []}'::jsonb, NULL, '23514', 'Elige al menos una línea'),
          ('ayer', v_base || jsonb_build_object('checked_in_at', now() - interval '1 day'), NULL, '23514',
           'Solo se reportan visitas del mismo día'),
          ('reporte antes de la llegada', v_base || jsonb_build_object('reported_at', now() - interval '1 minute'), NULL,
           '23514', 'La hora del reporte no puede ser anterior a la de llegada'),
          ('llegada en el futuro', v_base || jsonb_build_object('checked_in_at', now() + interval '6 minutes',
                                                                'reported_at', now() + interval '7 minutes'),
           NULL, '23514', 'La hora de llegada está en el futuro | Solo se reportan visitas del mismo día'),
          ('no efectiva sin motivo', v_base || '{"efectiva": false}'::jsonb, NULL, '23514', c_motivo),
          ('tipo no válido', v_base || '{"tipo": "visita"}'::jsonb, NULL, '22023', 'Tipo de visita no válido: medica o institucional'),
          ('client_id no válido', v_base || '{"client_id": "xyz"}'::jsonb, NULL, '22023', 'Datos de la visita no válidos%'),
          ('fecha no válida', v_base || '{"next_step_date": "2026-13-40"}'::jsonb, NULL, '22023', 'Datos de la visita no válidos%'),
          ('ejecutiva inexistente', v_base || jsonb_build_object('executive_id', gen_random_uuid()), NULL, '23514', c_sin_ejec),
          ('vacante', v_base || jsonb_build_object('executive_id', coalesce(v_vacante, gen_random_uuid())), NULL, '23514', c_sin_ejec),
          ('médica sin médico', v_base, ARRAY['medico_id'], '22023', 'Elige el médico'),
          ('telefónica sin medio', v_base || '{"modalidad": "telefonica"}'::jsonb, NULL, '22023',
           'Indica el medio: llamada o videollamada'),
          ('latitud sin longitud', v_base, ARRAY['lng'], '22023', 'Manda latitud y longitud juntas'),
          ('conclusión muy larga', v_base || jsonb_build_object('conclusion', repeat('x', 2001)), NULL, '22023',
           'La conclusión no puede superar 2000 caracteres'),
          ('modo de entrada no válido', v_base || '{"input_mode": "teclado"}'::jsonb, NULL, '22023',
           'Modo de entrada no válido: voz o toques'),
          ('institucional: sede de otra cuenta', v_base_inst || jsonb_build_object('sede_id', v_s2), NULL, '23514',
           'Esa sede no es de la cuenta elegida'),
          ('institucional: subtipo no vigente', v_base_inst || jsonb_build_object('subtipo_id', v_sub_viejo), NULL, '23514',
           'Ese subtipo no está vigente'),
          ('institucional: contacto de otra cuenta', v_base_inst || jsonb_build_object('contacto_id', v_k2), NULL, '23514',
           'Ese contacto no es de la cuenta elegida'),
          ('institucional sin subtipo', v_base_inst, ARRAY['subtipo_id'], '22023', 'Elige el subtipo de la visita institucional'),
          ('institucional sin cuenta', v_base_inst, ARRAY['cuenta_id'], '22023', 'Elige la cuenta'),
          ('reporte en el futuro', v_base || jsonb_build_object('reported_at', now() + interval '6 minutes'), NULL, '23514',
           'La hora del reporte está en el futuro'),
          ('próxima reunión antes de la visita', v_base || jsonb_build_object('next_step_date', v_hoy - 1), NULL, '23514',
           'La próxima reunión no puede ser anterior a la fecha de la visita'),
          ('reintento antes de la visita', v_base || jsonb_build_object('efectiva', false, 'failure_reason', 'No estaba',
                                                                          'retry_date', v_hoy - 1), NULL, '23514',
           'La fecha para reintentar no puede ser anterior a la fecha de la visita'),
          ('médica en una sede de cuenta inactiva', v_base || jsonb_build_object('sede_id', v_s3), NULL, '23514',
           'La cuenta de esa sede está inactiva'),
          ('institucional en una cuenta inactiva', v_base_inst || jsonb_build_object('cuenta_id', v_c3, 'sede_id', v_s3),
           ARRAY['contacto_id'], '23514', 'La cuenta de esa sede está inactiva'),
          ('institucional con un contacto inactivo', v_base_inst || jsonb_build_object('contacto_id', v_k3), NULL, '23514',
           'Ese contacto está inactivo')
        ) AS t(nombre, cuerpo, quitar, estado, mensaje)
      LOOP
        BEGIN
          PERFORM public.visitas_registrar((jsonb_build_object('client_id', gen_random_uuid()) || v_caso.cuerpo)
                                           - coalesce(v_caso.quitar, '{}'::text[]), v_a_user);
          RAISE EXCEPTION '0830: se aceptó una visita no válida (%)', v_caso.nombre;
        EXCEPTION WHEN OTHERS THEN
          GET STACKED DIAGNOSTICS v_estado = RETURNED_SQLSTATE, v_msg = MESSAGE_TEXT;
          IF v_estado IS DISTINCT FROM v_caso.estado OR NOT (v_msg LIKE ANY (string_to_array(v_caso.mensaje, ' | '))) THEN
            RAISE EXCEPTION '0830: el caso "%" devolvió % (%) y se esperaba % (%)',
              v_caso.nombre, v_estado, v_msg, v_caso.estado, v_caso.mensaje;
          END IF;
        END;
      END LOOP;
      IF EXISTS (SELECT 1 FROM public.visits v WHERE v.executive_id = v_a AND v.visit_date = v_hoy) THEN
        RAISE EXCEPTION '0830: un rechazo dejó una visita guardada';
      END IF;
      v_casos := v_casos || 'rechazos: lejos con la distancia, sede sin coordenadas, telefónica sin habilitar, ayer, reporte en el futuro, próxima reunión y reintento antes de la visita, líneas ajenas, médico, sede, cuenta inactiva, subtipo, contacto ajeno o inactivo y forma (35)'::text;

      -- 8.7 Médica presencial dentro del radio; repetida; tope por médico; borde del radio; editar y anular ---------
      BEGIN
        v_cliente := gen_random_uuid();
        v_r := public.visitas_registrar(v_base || jsonb_build_object(
                 'client_id', v_cliente, 'conclusion', 'Prueba 0830: presentó el tornillo canulado',
                 'compromisos', 'Enviar muestras', 'input_mode', 'voz', 'transcript', 'Prueba 0830: dictado'), v_a_user);
        v_id1 := (v_r ->> 'visita_id')::uuid;
        IF (v_r ->> 'repetida')::boolean OR (v_r ->> 'distance_m')::int <> 334
           OR (v_r ->> 'out_of_territory')::boolean OR (v_r ->> 'visit_date')::date <> v_hoy THEN
          RAISE EXCEPTION '0830 médica presencial: respuesta inesperada %', v_r;
        END IF;
        SELECT * INTO v_fila FROM public.visits v WHERE v.id = v_id1;
        IF v_fila.source <> 'app' OR v_fila.visit_type <> 'Visita efectiva' OR v_fila.contact_type <> 'Visita presencial'
           OR v_fila.kam_id <> v_a_zona OR v_fila.kam_name <> left(v_a_nombre, 255) OR v_fila.visit_date <> v_hoy
           OR v_fila.lat <> 4.603 OR v_fila.lng <> -74.08 OR v_fila.hospital_id IS NOT NULL
           OR v_fila.executive_id <> v_a OR v_fila.client_id <> v_cliente OR v_fila.tipo <> 'medica'
           OR v_fila.medico_id <> v_m1 OR v_fila.sede_id <> v_s1 OR v_fila.cuenta_id IS NOT NULL
           OR v_fila.subtipo_id IS NOT NULL OR v_fila.modalidad <> 'presencial' OR v_fila.medio IS NOT NULL
           OR NOT v_fila.efectiva OR v_fila.failure_reason IS NOT NULL OR v_fila.distance_m <> 334
           OR v_fila.gps_accuracy_m <> 12 OR v_fila.input_mode <> 'voz' OR v_fila.transcript <> 'Prueba 0830: dictado'
           OR v_fila.out_of_territory OR v_fila.created_by <> v_a_user OR v_fila.updated_by <> v_a_user
           OR v_fila.imported_by IS NOT NULL OR v_fila.imported_at IS NOT NULL OR v_fila.import_id IS NOT NULL
           OR v_fila.deleted_at IS NOT NULL OR v_fila.checked_in_at <> now() OR v_fila.reported_at <> now() THEN
          RAISE EXCEPTION '0830 médica presencial: la fila no quedó como se esperaba: %', to_jsonb(v_fila) - 'transcript';
        END IF;
        IF (SELECT array_agg(vl.line_id) FROM public.visit_lines vl WHERE vl.visit_id = v_id1) IS DISTINCT FROM ARRAY[v_l1] THEN
          RAISE EXCEPTION '0830 médica presencial: visit_lines no tiene la línea de la visita';
        END IF;

        -- Repetida por client_id: la misma fila, nada nuevo (aunque cambie el resto del cuerpo o sea otro día)
        v_r2 := public.visitas_registrar(v_base || jsonb_build_object('client_id', v_cliente, 'conclusion', 'otra',
                                                                      'checked_in_at', now() - interval '1 day'), v_a_user);
        IF NOT (v_r2 ->> 'repetida')::boolean OR (v_r2 ->> 'visita_id')::uuid <> v_id1
           OR (v_r2 ->> 'distance_m')::int <> 334 THEN
          RAISE EXCEPTION '0830 repetida: respuesta inesperada %', v_r2;
        END IF;
        IF (SELECT count(*) FROM public.visits v WHERE v.client_id = v_cliente) <> 1
           OR (SELECT count(*) FROM public.visit_lines vl WHERE vl.visit_id = v_id1) <> 1
           OR (SELECT v.conclusion FROM public.visits v WHERE v.id = v_id1) <> 'Prueba 0830: presentó el tornillo canulado' THEN
          RAISE EXCEPTION '0830 repetida: el mismo client_id duplicó o cambió la visita';
        END IF;
        BEGIN
          PERFORM public.visitas_registrar(v_base || jsonb_build_object('client_id', v_cliente,
                                             'executive_id', coalesce(v_b, gen_random_uuid())), v_a_user);
          RAISE EXCEPTION '0830: otra ejecutiva reutilizó un client_id ajeno';
        EXCEPTION WHEN unique_violation THEN NULL;
        END;

        -- Tope por médico: otra efectiva a M1 hoy no; una no efectiva sí (solo suma la efectiva)
        BEGIN
          PERFORM public.visitas_registrar(v_base || jsonb_build_object('client_id', gen_random_uuid()), v_a_user);
          RAISE EXCEPTION '0830: se aceptó una segunda visita efectiva al mismo médico el mismo día';
        EXCEPTION WHEN check_violation THEN
          GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
          IF v_msg <> 'Ya reportaste una visita a este médico hoy' THEN
            RAISE EXCEPTION '0830 tope por médico: mensaje inesperado (%)', v_msg;
          END IF;
        END;
        v_r := public.visitas_registrar(v_base || jsonb_build_object('client_id', gen_random_uuid(), 'efectiva', false,
                                          'failure_reason', 'No estaba en consulta', 'retry_date', v_hoy + 2), v_a_user);
        v_id2 := (v_r ->> 'visita_id')::uuid;
        SELECT * INTO v_fila FROM public.visits v WHERE v.id = v_id2;
        IF v_fila.visit_type <> 'Visita no efectiva' OR v_fila.efectiva OR v_fila.failure_reason <> 'No estaba en consulta'
           OR v_fila.retry_date <> v_hoy + 2 THEN
          RAISE EXCEPTION '0830 no efectiva: la fila no quedó como se esperaba: %', to_jsonb(v_fila);
        END IF;
        -- Una efectiva con motivo o fecha de reintento los descarta
        v_r := public.visitas_registrar(v_base || jsonb_build_object('client_id', gen_random_uuid(), 'medico_id', v_m3,
                                          'lat', 4.6045, 'failure_reason', 'no aplica', 'retry_date', v_hoy), v_a_user);
        v_id3 := (v_r ->> 'visita_id')::uuid;
        IF (v_r ->> 'distance_m')::int <> 500
           OR EXISTS (SELECT 1 FROM public.visits v WHERE v.id = v_id3 AND (v.failure_reason IS NOT NULL OR v.retry_date IS NOT NULL)) THEN
          RAISE EXCEPTION '0830 borde del radio: a 500 m debe aceptarse y la efectiva no guarda motivo: %', v_r;
        END IF;

        -- Editar el mismo día: textos, próxima reunión y líneas
        PERFORM public.visitas_editar(v_id1, jsonb_build_object('executive_id', v_a,
                   'conclusion', 'Prueba 0830: corregida', 'compromisos', NULL, 'next_step_date', v_hoy + 7,
                   'lineas', to_jsonb(array_remove(ARRAY[v_l1, v_l2], NULL))), v_a_user);
        SELECT * INTO v_fila FROM public.visits v WHERE v.id = v_id1;
        IF v_fila.conclusion <> 'Prueba 0830: corregida' OR v_fila.compromisos IS NOT NULL
           OR v_fila.next_step_date <> v_hoy + 7 OR NOT v_fila.efectiva OR v_fila.updated_by <> v_a_user
           OR v_fila.transcript <> 'Prueba 0830: dictado' OR v_fila.medico_id <> v_m1 THEN
          RAISE EXCEPTION '0830 editar: la fila no quedó como se esperaba: %', to_jsonb(v_fila) - 'transcript';
        END IF;
        IF (SELECT count(*) FROM public.visit_lines vl WHERE vl.visit_id = v_id1)
           <> cardinality(array_remove(ARRAY[v_l1, v_l2], NULL)) THEN
          RAISE EXCEPTION '0830 editar: no se reemplazaron las líneas';
        END IF;
        -- A no efectiva con motivo; luego la no efectiva de M1 pasa a efectiva (ya no hay otra efectiva a M1); luego
        -- volver la primera a efectiva choca con el tope por médico.
        PERFORM public.visitas_editar(v_id1, jsonb_build_object('executive_id', v_a, 'efectiva', false,
                                                                'failure_reason', 'Se canceló la cita'), v_a_user);
        IF (SELECT v.visit_type FROM public.visits v WHERE v.id = v_id1) <> 'Visita no efectiva' THEN
          RAISE EXCEPTION '0830 editar: visit_type no siguió a efectiva = false';
        END IF;
        PERFORM public.visitas_editar(v_id2, jsonb_build_object('executive_id', v_a, 'efectiva', true), v_a_user);
        IF EXISTS (SELECT 1 FROM public.visits v WHERE v.id = v_id2
                     AND (NOT v.efectiva OR v.failure_reason IS NOT NULL OR v.retry_date IS NOT NULL
                          OR v.visit_type <> 'Visita efectiva')) THEN
          RAISE EXCEPTION '0830 editar: pasar a efectiva debe limpiar el motivo y la fecha de reintento';
        END IF;

        FOR v_caso IN
          SELECT * FROM (VALUES
            ('a efectiva con el tope por médico lleno', 'editar', v_id1,
             jsonb_build_object('executive_id', v_a, 'efectiva', true), NULL::text, '23514',
             'Ya reportaste una visita a este médico hoy'),
            ('a no efectiva sin motivo', 'editar', v_id2, jsonb_build_object('executive_id', v_a, 'efectiva', false),
             NULL, '23514', c_motivo),
            ('cambiar la sede', 'editar', v_id2, jsonb_build_object('executive_id', v_a, 'sede_id', v_s0), NULL, '23514',
             'Solo se corrigen la conclusión%anula la visita y repórtala de nuevo (sede_id)'),
            ('sin campos', 'editar', v_id2, jsonb_build_object('executive_id', v_a), NULL, '22023', 'No hay campos para corregir'),
            ('de otra ejecutiva', 'editar', v_id2,
             jsonb_build_object('executive_id', coalesce(v_b, gen_random_uuid()), 'conclusion', 'x'), NULL, 'P0002',
             'Esa visita no existe'),
            ('inexistente', 'editar', gen_random_uuid(), jsonb_build_object('executive_id', v_a, 'conclusion', 'x'), NULL,
             'P0002', 'Esa visita no existe'),
            ('líneas ajenas', 'editar', v_id2,
             jsonb_build_object('executive_id', v_a, 'lineas', jsonb_build_array(coalesce(v_l_ajena, gen_random_uuid()))),
             NULL, '23514', 'Alguna de las líneas no es tuya'),
            ('sin líneas', 'editar', v_id2, jsonb_build_object('executive_id', v_a, 'lineas', '[]'::jsonb), NULL, '23514',
             'Elige al menos una línea'),
            ('próxima reunión antes de la visita', 'editar', v_id2,
             jsonb_build_object('executive_id', v_a, 'next_step_date', v_hoy - 1), NULL, '23514',
             'La próxima reunión no puede ser anterior a la fecha de la visita'),
            ('reintento antes de la visita', 'editar', v_id1,
             jsonb_build_object('executive_id', v_a, 'retry_date', v_hoy - 1), NULL, '23514',
             'La fecha para reintentar no puede ser anterior a la fecha de la visita'),
            ('importada', 'editar', coalesce(v_importada, gen_random_uuid()),
             jsonb_build_object('executive_id', v_a, 'conclusion', 'x'), NULL,
             CASE WHEN v_importada IS NULL THEN 'P0002' ELSE '23514' END,
             c_no_editable || ' | Esa visita no existe'),
            ('anular importada', 'anular', coalesce(v_importada, gen_random_uuid()), NULL::jsonb, 'Prueba 0830 importada',
             CASE WHEN v_importada IS NULL THEN 'P0002' ELSE '23514' END, c_no_editable || ' | Esa visita no existe'),
            ('anular con motivo corto', 'anular', v_id2, NULL::jsonb, 'abc', '23514', 'Escribe el motivo (al menos 5 caracteres)'),
            ('anular sin usuario de ejecutiva', 'anular_sin_usuario', v_id2, NULL::jsonb, 'Prueba 0830 sin usuario',
             '22023', 'Falta el usuario que anula')
          ) AS t(nombre, accion, id, cuerpo, motivo, estado, mensaje)
        LOOP
          BEGIN
            IF v_caso.accion = 'editar' THEN
              PERFORM public.visitas_editar(v_caso.id, v_caso.cuerpo, v_a_user);
            ELSIF v_caso.accion = 'anular' THEN
              PERFORM public.visitas_anular(v_caso.id, v_caso.motivo, v_a_user);
            ELSE
              PERFORM public.visitas_anular(v_caso.id, v_caso.motivo, NULL);
            END IF;
            RAISE EXCEPTION '0830: se aceptó una corrección no válida (%)', v_caso.nombre;
          EXCEPTION WHEN OTHERS THEN
            GET STACKED DIAGNOSTICS v_estado = RETURNED_SQLSTATE, v_msg = MESSAGE_TEXT;
            IF v_estado IS DISTINCT FROM v_caso.estado OR NOT (v_msg LIKE ANY (string_to_array(v_caso.mensaje, ' | '))) THEN
              RAISE EXCEPTION '0830: el caso "%" devolvió % (%) y se esperaba % (%)',
                v_caso.nombre, v_estado, v_msg, v_caso.estado, v_caso.mensaje;
            END IF;
          END;
        END LOOP;

        -- Anular el mismo día; dos veces no; anulada no se corrige; la anulada deja de contar en el tope
        PERFORM public.visitas_anular(v_id2, '  Prueba 0830: reporté el médico equivocado  ', v_a_user);
        SELECT * INTO v_fila FROM public.visits v WHERE v.id = v_id2;
        IF v_fila.deleted_at IS NULL OR v_fila.deleted_reason <> 'Prueba 0830: reporté el médico equivocado'
           OR v_fila.updated_by <> v_a_user THEN
          RAISE EXCEPTION '0830 anular: la fila no quedó anulada con su motivo: %', to_jsonb(v_fila) - 'transcript';
        END IF;
        BEGIN
          PERFORM public.visitas_anular(v_id2, 'Prueba 0830 otra vez', v_a_user);
          RAISE EXCEPTION '0830: se anuló dos veces la misma visita';
        EXCEPTION WHEN check_violation THEN
          GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
          IF v_msg <> 'Esa visita ya está anulada' THEN
            RAISE EXCEPTION '0830 anular dos veces: mensaje inesperado (%)', v_msg;
          END IF;
        END;
        BEGIN
          PERFORM public.visitas_editar(v_id2, jsonb_build_object('executive_id', v_a, 'conclusion', 'x'), v_a_user);
          RAISE EXCEPTION '0830: se corrigió una visita anulada';
        EXCEPTION WHEN check_violation THEN
          GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
          IF v_msg <> c_no_editable THEN
            RAISE EXCEPTION '0830 editar anulada: mensaje inesperado (%)', v_msg;
          END IF;
        END;
        PERFORM public.visitas_editar(v_id1, jsonb_build_object('executive_id', v_a, 'efectiva', true), v_a_user);
        IF NOT (SELECT v.efectiva FROM public.visits v WHERE v.id = v_id1) THEN
          RAISE EXCEPTION '0830: la visita anulada siguió contando en el tope por médico';
        END IF;

        -- Una visita de la app no se borra (disparador), ni como service_role
        BEGIN
          DELETE FROM public.visits WHERE id = v_id1;
          RAISE EXCEPTION '0830: se borró una visita de la app';
        EXCEPTION WHEN check_violation THEN NULL;
        END;

        -- Visita de ayer (insertada directo, cumple visits_app_check): ni se corrige ni se anula
        INSERT INTO public.visits (kam_id, kam_name, visit_type, contact_type, lat, lng, visit_date, source,
                                   executive_id, client_id, tipo, medico_id, sede_id, modalidad, efectiva,
                                   checked_in_at, reported_at, distance_m, input_mode)
        VALUES (v_a_zona, 'Prueba 0830', 'Visita efectiva', 'Visita presencial', 4.6, -74.08,
                ((now() - interval '1 day') AT TIME ZONE 'America/Bogota')::date, 'app', v_a, gen_random_uuid(),
                'medica', v_m1, v_s1, 'presencial', true, now() - interval '1 day', now() - interval '1 day', 0, 'toques')
        RETURNING id INTO v_ayer;
        BEGIN
          PERFORM public.visitas_editar(v_ayer, jsonb_build_object('executive_id', v_a, 'conclusion', 'x'), v_a_user);
          RAISE EXCEPTION '0830: se corrigió una visita de ayer';
        EXCEPTION WHEN check_violation THEN NULL;
        END;
        BEGIN
          PERFORM public.visitas_anular(v_ayer, 'Prueba 0830 ayer', v_a_user);
          RAISE EXCEPTION '0830: se anuló una visita de ayer';
        EXCEPTION WHEN check_violation THEN NULL;
        END;
        -- visits_app_check: una de la app sin client_id, con fecha que no es la de su llegada o con visit_type que
        -- no cuadra no entra
        FOR v_caso IN
          SELECT * FROM (VALUES
            ('sin client_id', NULL::uuid, v_hoy, 'Visita efectiva'),
            ('visit_date distinta de la llegada', gen_random_uuid(), v_hoy - 3, 'Visita efectiva'),
            ('visit_type que no cuadra', gen_random_uuid(), v_hoy, 'Visita no efectiva')
          ) AS t(nombre, cliente, fecha, tipo_visita)
        LOOP
          BEGIN
            INSERT INTO public.visits (kam_id, kam_name, visit_type, contact_type, lat, lng, visit_date, source,
                                       executive_id, client_id, tipo, medico_id, sede_id, modalidad, efectiva,
                                       checked_in_at, reported_at, distance_m, input_mode)
            VALUES (v_a_zona, 'Prueba 0830', v_caso.tipo_visita, 'Visita presencial', 4.6, -74.08, v_caso.fecha, 'app',
                    v_a, v_caso.cliente, 'medica', v_m1, v_s1, 'presencial', true, now(), now(), 0, 'toques');
            RAISE EXCEPTION '0830: visits_app_check aceptó una fila de la app %', v_caso.nombre;
          EXCEPTION WHEN check_violation THEN NULL;
          END;
        END LOOP;
        BEGIN
          INSERT INTO public.visits (kam_id, kam_name, visit_type, contact_type, lat, lng, visit_date, source,
                                     executive_id, client_id, tipo, medico_id, sede_id, modalidad, efectiva,
                                     checked_in_at, reported_at, distance_m, input_mode, next_step_date)
          VALUES (v_a_zona, 'Prueba 0830', 'Visita efectiva', 'Visita presencial', 4.6, -74.08, v_hoy, 'app',
                  v_a, gen_random_uuid(), 'medica', v_m1, v_s1, 'presencial', true, now(), now(), 0, 'toques', v_hoy - 1);
          RAISE EXCEPTION '0830: visits_app_check aceptó una próxima reunión anterior a la visita';
        EXCEPTION WHEN check_violation THEN NULL;
        END;
        v_casos := v_casos || 'médica presencial dentro del radio, repetida por client_id, tope por médico, borde del radio, editar y anular el mismo día, anular dos veces, importada y de ayer no editables, borrado prohibido, visits_app_check'::text;
        RAISE SQLSTATE 'P0830';
      EXCEPTION
        WHEN SQLSTATE 'P0830' THEN NULL;
      END;

      -- 8.8 Fuera de territorio (visitante terminado hace 5 días) y sede IPS de OpMap (hospital_id) ----------------
      BEGIN
        v_r := public.visitas_registrar(v_base || jsonb_build_object('client_id', gen_random_uuid(), 'medico_id', v_m2),
                                        v_a_user);
        IF NOT (v_r ->> 'out_of_territory')::boolean
           OR NOT (SELECT v.out_of_territory FROM public.visits v WHERE v.id = (v_r ->> 'visita_id')::uuid) THEN
          RAISE EXCEPTION '0830 fuera de territorio: debe quedar marcada: %', v_r;
        END IF;
        IF v_sede_ips IS NOT NULL THEN
          v_r := public.visitas_registrar(v_base || jsonb_build_object('client_id', gen_random_uuid(), 'medico_id', v_m3,
                                            'sede_id', v_sede_ips, 'lat', v_lat_ips, 'lng', v_lng_ips), v_a_user);
          SELECT * INTO v_fila FROM public.visits v WHERE v.id = (v_r ->> 'visita_id')::uuid;
          IF (v_r ->> 'distance_m')::int <> 0 OR (v_r ->> 'out_of_territory')::boolean
             OR v_fila.hospital_id IS DISTINCT FROM v_hosp_ips OR v_fila.lat <> round(v_lat_ips, 6) OR v_fila.lng <> round(v_lng_ips, 6) THEN
            RAISE EXCEPTION '0830 sede IPS: hospital_id y punto del mapa no cuadran: %', to_jsonb(v_fila) - 'transcript';
          END IF;
        END IF;
        v_casos := v_casos || 'fuera de territorio y sede IPS con hospital_id'::text;
        RAISE SQLSTATE 'P0830';
      EXCEPTION
        WHEN SQLSTATE 'P0830' THEN NULL;
      END;

      -- 8.9 Telefónica habilitada: punto del mapa, medio no válido, tope del día, anulada no cuenta ----------------
      BEGIN
        PERFORM public.config_registrar('config_personas', jsonb_build_object('executive_id', v_a,
                  'perfil', jsonb_build_array('medica', 'institucional'), 'telefonica_habilitada', true,
                  'tope_telefonicas_dia', 2), v_hoy, NULL, NULL, NULL);
        -- T1: médica a M1 en S0 (sin coordenadas) CON el GPS del teléfono → punto del municipio de la sede, nunca el
        --     del teléfono (la ejecutiva puede estar en su casa), y sin la precisión del GPS
        v_r := public.visitas_registrar(v_base || jsonb_build_object('client_id', gen_random_uuid(), 'sede_id', v_s0,
                                          'modalidad', 'telefonica', 'medio', 'llamada'), v_a_user);
        v_id1 := (v_r ->> 'visita_id')::uuid;
        SELECT * INTO v_fila FROM public.visits v WHERE v.id = v_id1;
        SELECT m.lat, m.lng INTO v_mlat, v_mlng FROM public.municipalities m WHERE m.code = '11001';
        IF v_fila.contact_type <> 'Visita virtual' OR v_fila.medio <> 'llamada' OR v_fila.distance_m IS NOT NULL
           OR (v_r ->> 'distance_m') IS NOT NULL OR v_fila.gps_accuracy_m IS NOT NULL
           OR (v_fila.lat = 4.603 AND v_fila.lng = -74.08)
           OR v_fila.lat IS DISTINCT FROM round(v_mlat, 6) OR v_fila.lng IS DISTINCT FROM round(v_mlng, 6) THEN
          RAISE EXCEPTION '0830 telefónica: la fila no quedó como se esperaba: %', to_jsonb(v_fila) - 'transcript';
        END IF;
        -- Presencial o telefónica cuentan igual para el tope por médico
        BEGIN
          PERFORM public.visitas_registrar(v_base || jsonb_build_object('client_id', gen_random_uuid()), v_a_user);
          RAISE EXCEPTION '0830: la telefónica efectiva a M1 no contó en el tope por médico';
        EXCEPTION WHEN check_violation THEN
          GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
          IF v_msg <> 'Ya reportaste una visita a este médico hoy' THEN
            RAISE EXCEPTION '0830 telefónica y tope por médico: mensaje inesperado (%)', v_msg;
          END IF;
        END;
        -- T2: institucional en S1 por videollamada con el GPS lejos → punto de la sede
        v_r := public.visitas_registrar(v_base_inst || jsonb_build_object('client_id', gen_random_uuid(),
                                          'modalidad', 'telefonica', 'medio', 'videollamada', 'lat', 5.0, 'lng', -74.5), v_a_user);
        v_id2 := (v_r ->> 'visita_id')::uuid;
        SELECT * INTO v_fila FROM public.visits v WHERE v.id = v_id2;
        IF v_fila.lat <> 4.6 OR v_fila.lng <> -74.08 OR v_fila.contact_type <> 'Visita virtual'
           OR v_fila.subtipo_codigo <> 'prueba_0830_vigente' OR v_fila.contacto_id <> v_k1 OR v_fila.cuenta_id <> v_c1 THEN
          RAISE EXCEPTION '0830 telefónica institucional: la fila no quedó como se esperaba: %', to_jsonb(v_fila) - 'transcript';
        END IF;
        FOR v_caso IN
          SELECT * FROM (VALUES
            ('medio no válido', v_base || jsonb_build_object('medico_id', v_m3, 'modalidad', 'telefonica', 'medio', 'whatsapp'),
             'Medio no válido: llamada o videollamada'),
            ('tope de telefónicas', v_base || jsonb_build_object('medico_id', v_m3, 'modalidad', 'telefonica', 'medio', 'llamada'),
             'Ya reportaste las 2 visitas telefónicas de hoy'),
            ('tope de telefónicas aunque no sea efectiva',
             v_base || jsonb_build_object('medico_id', v_m3, 'modalidad', 'telefonica', 'medio', 'llamada',
                                          'efectiva', false, 'failure_reason', 'No contestó'),
             'Ya reportaste las 2 visitas telefónicas de hoy')
          ) AS t(nombre, cuerpo, mensaje)
        LOOP
          BEGIN
            PERFORM public.visitas_registrar(jsonb_build_object('client_id', gen_random_uuid()) || v_caso.cuerpo, v_a_user);
            RAISE EXCEPTION '0830: se aceptó una telefónica no válida (%)', v_caso.nombre;
          EXCEPTION WHEN OTHERS THEN
            GET STACKED DIAGNOSTICS v_estado = RETURNED_SQLSTATE, v_msg = MESSAGE_TEXT;
            IF v_estado <> '23514' OR v_msg <> v_caso.mensaje THEN
              RAISE EXCEPTION '0830: el caso "%" devolvió % (%) y se esperaba 23514 (%)', v_caso.nombre, v_estado, v_msg, v_caso.mensaje;
            END IF;
          END;
        END LOOP;
        -- La anulada deja de contar: T3 entra; luego T3 a no efectiva y T4 entra; T3 a efectiva choca con el tope
        PERFORM public.visitas_anular(v_id1, 'Prueba 0830: era otra persona', v_a_user);
        v_r := public.visitas_registrar(v_base || jsonb_build_object('client_id', gen_random_uuid(), 'medico_id', v_m3,
                                          'modalidad', 'telefonica', 'medio', 'llamada'), v_a_user);
        v_id3 := (v_r ->> 'visita_id')::uuid;
        IF (SELECT v.lat FROM public.visits v WHERE v.id = v_id3) <> 4.6 THEN
          RAISE EXCEPTION '0830 telefónica: con GPS y sede ubicada, el punto del mapa es la sede';
        END IF;
        PERFORM public.visitas_editar(v_id3, jsonb_build_object('executive_id', v_a, 'efectiva', false,
                                                                'failure_reason', 'Se cortó la llamada'), v_a_user);
        PERFORM public.visitas_registrar(v_base || jsonb_build_object('client_id', gen_random_uuid(), 'medico_id', v_m2,
                                           'modalidad', 'telefonica', 'medio', 'videollamada'), v_a_user);
        BEGIN
          PERFORM public.visitas_editar(v_id3, jsonb_build_object('executive_id', v_a, 'efectiva', true), v_a_user);
          RAISE EXCEPTION '0830: pasar a efectiva se saltó el tope de telefónicas';
        EXCEPTION WHEN check_violation THEN
          GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
          IF v_msg <> 'Ya reportaste las 2 visitas telefónicas de hoy' THEN
            RAISE EXCEPTION '0830 editar telefónica: mensaje inesperado (%)', v_msg;
          END IF;
        END;
        v_casos := v_casos || 'telefónica habilitada: punto del mapa sin el GPS del teléfono, medio, tope del día, anulada no cuenta, editar revalida'::text;
        RAISE SQLSTATE 'P0830';
      EXCEPTION
        WHEN SQLSTATE 'P0830' THEN NULL;
      END;

      -- 8.10 Perfil: sin médica (institucional con subtipo y contacto sí entra) y sin institucional ---------------
      BEGIN
        PERFORM public.config_registrar('config_personas', jsonb_build_object('executive_id', v_a,
                  'perfil', jsonb_build_array('institucional')), v_hoy, NULL, NULL, NULL);
        BEGIN
          PERFORM public.visitas_registrar(v_base || jsonb_build_object('client_id', gen_random_uuid()), v_a_user);
          RAISE EXCEPTION '0830: se aceptó una médica con perfil solo institucional';
        EXCEPTION WHEN check_violation THEN
          GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
          IF v_msg <> 'Tu perfil no incluye visitas médicas' THEN
            RAISE EXCEPTION '0830 perfil sin médica: mensaje inesperado (%)', v_msg;
          END IF;
        END;
        v_r := public.visitas_registrar(v_base_inst || jsonb_build_object('client_id', gen_random_uuid()), v_a_user);
        SELECT * INTO v_fila FROM public.visits v WHERE v.id = (v_r ->> 'visita_id')::uuid;
        IF v_fila.tipo <> 'institucional' OR v_fila.cuenta_id <> v_c1 OR v_fila.subtipo_id <> v_sub
           OR v_fila.subtipo_codigo <> 'prueba_0830_vigente' OR v_fila.contacto_id <> v_k1 OR v_fila.medico_id IS NOT NULL
           OR v_fila.distance_m <> 0 OR v_fila.out_of_territory OR v_fila.input_mode <> 'voz'
           OR v_fila.transcript <> 'Prueba 0830: visita a compras' THEN
          RAISE EXCEPTION '0830 institucional: la fila no quedó como se esperaba: %', to_jsonb(v_fila) - 'transcript';
        END IF;
        PERFORM public.config_registrar('config_personas', jsonb_build_object('executive_id', v_a,
                  'perfil', jsonb_build_array('medica')), v_hoy, NULL, NULL, NULL);
        BEGIN
          PERFORM public.visitas_registrar(v_base_inst || jsonb_build_object('client_id', gen_random_uuid()), v_a_user);
          RAISE EXCEPTION '0830: se aceptó una institucional con perfil solo médica';
        EXCEPTION WHEN check_violation THEN
          GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
          IF v_msg <> 'Tu perfil no incluye visitas institucionales' THEN
            RAISE EXCEPTION '0830 perfil sin institucional: mensaje inesperado (%)', v_msg;
          END IF;
        END;
        -- Radio propio de la persona (1000 m): a 801 m entra
        PERFORM public.config_registrar('config_personas', jsonb_build_object('executive_id', v_a,
                  'perfil', jsonb_build_array('medica', 'institucional'), 'radio_m', 1000), v_hoy, NULL, NULL, NULL);
        v_r := public.visitas_registrar(v_base || jsonb_build_object('client_id', gen_random_uuid(), 'lat', 4.6072), v_a_user);
        IF (v_r ->> 'distance_m')::int <> 801 THEN
          RAISE EXCEPTION '0830 radio propio: a 801 m con radio 1000 debe entrar: %', v_r;
        END IF;
        v_casos := v_casos || 'perfil sin médica y sin institucional, institucional con subtipo y contacto, radio propio'::text;
        RAISE SQLSTATE 'P0830';
      EXCEPTION
        WHEN SQLSTATE 'P0830' THEN NULL;
      END;

      -- 8.11 Como service_role (el rol de la API): registrar, editar líneas y anular; borrar no --------------------
      BEGIN
        BEGIN
          PERFORM set_config('role', 'service_role', true);
          v_rol_ok := true;
        EXCEPTION WHEN insufficient_privilege OR invalid_parameter_value THEN
          v_rol_ok := false;
        END;
        IF v_rol_ok THEN
          v_r := public.visitas_registrar(v_base || jsonb_build_object('client_id', gen_random_uuid()), v_a_user);
          v_id1 := (v_r ->> 'visita_id')::uuid;
          PERFORM public.visitas_editar(v_id1, jsonb_build_object('executive_id', v_a, 'conclusion', 'Prueba 0830 service_role',
                     'lineas', to_jsonb(array_remove(ARRAY[v_l2, v_l1], NULL))), v_a_user);
          PERFORM public.visitas_anular(v_id1, 'Prueba 0830 service_role', v_a_user);
          IF NOT EXISTS (SELECT 1 FROM public.visits v WHERE v.id = v_id1 AND v.deleted_at IS NOT NULL
                           AND v.conclusion = 'Prueba 0830 service_role') THEN
            RAISE EXCEPTION '0830 service_role: la visita no quedó corregida y anulada';
          END IF;
          BEGIN
            DELETE FROM public.visits WHERE id = v_id1;
            RAISE EXCEPTION '0830: service_role borró una visita de la app';
          EXCEPTION WHEN check_violation THEN NULL;
          END;
          v_casos := v_casos || 'como service_role (registrar, editar líneas, anular; borrar no)'::text;
        ELSE
          RAISE NOTICE '0830: no se pudo cambiar a service_role; sus privilegios se comprobaron solo con has_*_privilege';
        END IF;
        RAISE SQLSTATE 'P0830';
      EXCEPTION
        WHEN SQLSTATE 'P0830' THEN NULL;
      END;
      IF current_user = 'service_role' THEN
        RAISE EXCEPTION '0830: el rol no volvió después de la prueba como service_role';
      END IF;

      RAISE SQLSTATE 'P0830';
    EXCEPTION
      WHEN SQLSTATE 'P0830' THEN NULL;  -- preparación y pruebas deshechas
    END;

    -- 8.12 No quedó nada de las pruebas; A y la configuración están como antes
    IF EXISTS (SELECT 1 FROM public.medicos WHERE numero_documento LIKE 'PRUEBA0830%' OR created_at = now())
       OR EXISTS (SELECT 1 FROM public.cuentas WHERE numero_identificacion LIKE 'PRUEBA0830%' OR created_at = now())
       OR EXISTS (SELECT 1 FROM public.sedes WHERE created_at = now())
       OR EXISTS (SELECT 1 FROM public.contactos WHERE created_at = now())
       OR EXISTS (SELECT 1 FROM public.subtipos_institucionales WHERE codigo LIKE 'prueba_0830%')
       OR EXISTS (SELECT 1 FROM public.medico_visitantes WHERE created_at = now())
       OR EXISTS (SELECT 1 FROM public.visits WHERE source = 'app' AND created_at = now())
       OR EXISTS (SELECT 1 FROM public.visits WHERE kam_name = 'Prueba 0830') THEN
      RAISE EXCEPTION '0830: quedaron filas de las pruebas';
    END IF;
    SELECT md5(coalesce(string_agg(to_jsonb(cg)::text, ',' ORDER BY cg.id), '')) INTO v_cfg_despues
    FROM public.config_general cg;
    SELECT v_cfg_despues || md5(coalesce(string_agg(to_jsonb(cp)::text, ',' ORDER BY cp.id), '')) INTO v_cfg_despues
    FROM public.config_personas cp;
    IF v_cfg_despues IS DISTINCT FROM v_cfg_antes THEN
      RAISE EXCEPTION '0830: la configuración (config_general o config_personas) no quedó como estaba';
    END IF;
    IF (SELECT to_jsonb(e)::text FROM public.executives e WHERE e.id = v_a) IS DISTINCT FROM v_a_fila
       OR (SELECT array_agg(el.line_id ORDER BY el.line_id) FROM public.executive_lines el WHERE el.executive_id = v_a)
          IS DISTINCT FROM v_a_lineas THEN
      RAISE EXCEPTION '0830: la ejecutiva de las pruebas no quedó como estaba';
    END IF;
    IF cardinality(v_casos) < (CASE WHEN v_rol_ok THEN 7 ELSE 6 END) THEN
      RAISE EXCEPTION '0830: solo se probaron % grupos de casos: %', cardinality(v_casos), array_to_string(v_casos, '; ');
    END IF;
  END IF;

  -- 8.13 Las importadas de VMO siguen idénticas (conteo y huellas de antes de migrar) -------------------------------
  v_antes := string_to_array(current_setting('opmap0830.importadas', true), '|');
  IF v_antes IS NULL OR cardinality(v_antes) <> 3 THEN
    RAISE EXCEPTION '0830: falta la huella de las importadas tomada antes de migrar';
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
    RAISE EXCEPTION '0830: las visitas importadas cambiaron (antes % / %, después % / %)', v_antes[1], v_antes[2], v_n, v_md5;
  END IF;
  SELECT count(*) INTO v_n FROM public.visits v
  WHERE v.source = 'vmo_import'
    AND (v.executive_id IS NOT NULL OR v.client_id IS NOT NULL OR v.tipo IS NOT NULL OR v.sede_id IS NOT NULL
         OR v.efectiva IS NOT NULL OR v.transcript IS NOT NULL OR v.deleted_at IS NOT NULL OR v.out_of_territory);
  IF v_n > 0 THEN
    RAISE EXCEPTION '0830: % visita(s) importada(s) con datos de la app', v_n;
  END IF;

  RAISE NOTICE '0830 OK: visits con 29 columnas nuevas (sin audio), visits_app_check, 5 índices, updated_at y borrado prohibido en las de la app; visit_lines con RLS sin políticas; 5 funciones solo para service_role; % importadas intactas (huella %).',
    v_antes[1], v_antes[2];
  RAISE NOTICE '0830 OK: % grupos de casos probados con datos que se deshacen: %', cardinality(v_casos), array_to_string(v_casos, '; ');
END;
$$;

COMMIT;
