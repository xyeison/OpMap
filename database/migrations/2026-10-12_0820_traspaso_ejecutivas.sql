-- =====================================================================================
-- OpMap · feat/traspaso-ejecutivas (traspaso de lo de un Ejecutivo Comercial a otra persona) · 0820
-- Proyecto: norvxqgohddgsdkggqzq · Generado: 2026-10-12 · ESTADO: APLICADA 2026-10-12 (PR #15)
--
-- Spec (fuente de verdad de nombres): docs/specs/2026-10-12-traspaso-ejecutivo-comercial.md ("Impacto · Datos" y
--   "Plan · SQL"). Decisión del dueño: docs/decisiones/2026-10-12-traspaso-de-ejecutivas.md ("si alguien se va o se
--   le quita, pues ya no está; lo que toca más bien es una solución para que todo eso pase fácilmente a uno nuevo").
--   Es ADITIVA: 1 tabla nueva, 2 columnas nuevas en medico_visitantes, 5 funciones y 5 disparadores. No cambia
--   ninguna fila existente (salvo medico_visitantes ya terminados sin motivo, que pasan a fin_motivo 'manual';
--   hoy en producción hay 0 visitantes).
--
-- Por qué:
--   Cuando una Ejecutiva Comercial se va o le quitan una línea, lo suyo queda colgado (cobertura, ajustes
--   manuales, nombre del territorio, médicos). El traspaso pasa todo a otra persona, a una persona nueva o a una
--   vacante en UNA transacción, y si alguien da de baja o quita una línea por otro camino, sus visitantes de esa
--   línea se terminan solos ("ya no está").
--
-- Qué hace:
--   1. ejecutivas_traspasos: historial INMUTABLE de cada traspaso (quién entregó, quién recibió, qué líneas, fecha,
--      opciones, motivo, resumen jsonb, quién lo hizo). RLS sin políticas; service_role solo SELECT e INSERT;
--      disparadores que impiden UPDATE, DELETE y TRUNCATE (23514).
--   2. medico_visitantes:
--        - fin_motivo text: 'manual' | 'traspaso' | 'baja' | 'linea_quitada'. CHECK: NULL en las abiertas
--          (hasta IS NULL) y uno de la lista en las terminadas. Disparador medico_visitantes_fin_motivo (BEFORE
--          INSERT OR UPDATE OF hasta, fin_motivo): quien termina una asignación sin decir el motivo (la ruta PATCH
--          de /terceros, que solo manda hasta) deja 'manual'. Las ya terminadas sin motivo pasan a 'manual'.
--        - traspaso_id uuid → ejecutivas_traspasos (DEFERRABLE INITIALLY DEFERRED: la función escribe los
--          visitantes antes que el historial, que es inmutable y se inserta al final con su resumen). Lo llevan la
--          asignación que el traspaso terminó y la que creó para quien recibe.
--   3. ejecutivas_traspasar(p jsonb, p_user uuid) RETURNS jsonb, atómica (una transacción; PostgREST no tiene
--      transacciones). p = { origen_id, destino: { tipo: 'existente'|'nueva'|'vacante'|'nadie', id?, full_name?,
--      email? }, lineas: uuid[] | null (null = todas), fecha: 'AAAA-MM-DD' | null (null = hoy en Bogotá),
--      dar_de_baja, desactivar_usuario, copiar_excepciones, motivo }. Pasos, en este orden:
--        a. Valida los parámetros (22023).
--        b. Bloquea las filas de origen y destino (FOR UPDATE, en orden de id) y valida contra la base: origen y
--           destino existentes (P0002), origen no inactivo, destino distinto y no inactivo, origen con al menos
--           una línea, líneas ⊆ las de origen, baja ⇒ todas sus líneas y destino ≠ nadie, fecha en [hoy − 90, hoy]
--           (23514).
--        c. Crea el destino si es 'nueva' (status active, started_at = fecha, zona base y empresa de origen, email
--           en minúsculas; email que ya tiene otro Ejecutivo Comercial → 23505) o 'vacante' (status placeholder,
--           nombre "Vacante · <zona de origen>" sin el prefijo "KAM " como zoneDisplayName de web/lib/zone-names.ts,
--           o "Vacante" si no tiene zona; zona base de origen). Con baja, los dos heredan además executives.color de
--           origen (el mapa por línea no cambia de color; origen queda inactivo, así que no hay dos activos con el
--           mismo color); sin baja quedan sin color (origen lo sigue usando).
--        d. Suma las líneas al destino (ON CONFLICT DO NOTHING).
--        e. Ajustes manuales de cobertura activos de origen en esas líneas: desactiva el de origen y crea el mismo
--           (línea, zona, motivo) para el destino; con 'nadie' solo los desactiva. Respeta
--           coverage_overrides_active_uidx (un activo por línea y zona): primero desactiva, luego inserta.
--        f. Copia line_territory_names de esas líneas al destino si no tiene uno (ON CONFLICT DO NOTHING).
--        g. Visitantes abiertos de origen en esas líneas: los termina con hasta = greatest(desde, fecha − 1),
--           fin_motivo 'traspaso' y traspaso_id; crea la misma asignación (médico, línea, ciudad) para el destino
--           desde greatest(fecha, desde de la de origen), con traspaso_id: con una fecha pasada, el destino nunca
--           tiene al médico desde antes de que existiera la asignación. Omitidos (solo se terminan; salen en
--           "omitidos" con su razón):
--           'ya_lo_visita' (el destino ya tiene esa asignación abierta) y 'medico_inactivo'. Con 'nadie' solo se
--           terminan (no salen en omitidos).
--        h. Si copiar_excepciones (y hay destino): config_personas vigente de origen en la fecha y sus config_metas
--           de scope 'ejecutiva' vigentes en la fecha se registran para el destino desde la fecha, con
--           config_registrar (motivo "Copiado por traspaso de <nombre>"); si la de origen tenía fin, el mismo fin
--           (recortado al día antes del siguiente valor del destino, para no chocar).
--        i. Quita a origen las líneas traspasadas (con baja, todas). El disparador de executive_lines no encuentra
--           visitantes abiertos en ellas: ya quedaron terminados en g.
--        j. Si dar_de_baja: status 'inactive', left_at = fecha − 1 (el disparador de executives termina con
--           fin_motivo 'baja' los visitantes abiertos que le quedaran en líneas que ya no llevaba; se cuentan en
--           visitantes_terminados).
--        k. Si desactivar_usuario y dar_de_baja: users.active = false SOLO si origen tiene user_id, ese usuario está
--           activo, su rol es de Ejecutivo Comercial ('sales_manager' o 'user', como ROLES_USUARIO_DESACTIVABLES de
--           web/lib/traspaso.ts) y no es p_user (quien hace el traspaso). Un admin, un líder de línea o cualquier
--           otro rol solo se desactiva desde Usuarios (users:manage, con sus guardas: nadie se desactiva a sí mismo
--           ni deja el sistema sin administrador). Sin baja se ignora (no se le quita el acceso a quien se queda).
--           El historial guarda lo que de verdad se hizo (desactivar_usuario = true solo si se desactivó).
--        l. Guarda el historial con el resumen y lo devuelve:
--           { traspaso_id, destino_id, lineas, ajustes_movidos, ajustes_desactivados, nombres_copiados,
--             visitantes_movidos, visitantes_terminados, omitidos: [{ medico_id, razon }], excepciones_copiadas }
--           ajustes_movidos = pasaron al destino; ajustes_desactivados = solo desactivados ('nadie');
--           visitantes_movidos = terminados y creados para el destino; visitantes_terminados = terminados que quedan
--           sin visitante ('nadie', médico inactivo y, con baja, los de líneas que ya no llevaba); los 'ya_lo_visita'
--           no cuentan en ninguno de los dos (el médico sigue con el destino): solo salen en omitidos. Así
--           movidos + terminados + omitidos 'ya_lo_visita' = asignaciones terminadas, sin solapes (igual que la
--           vista previa de web/lib/traspaso.ts); los 'medico_inactivo' cuentan en terminados y además salen en
--           omitidos con su razón.
--      No recalcula la cobertura (lo hace la ruta de la API después, sin Google) ni guarda versiones del anexo.
--   4. Disparadores que terminan visitantes ("ya no está"):
--        - executive_lines_termina_visitantes: AFTER DELETE ON executive_lines → termina los visitantes abiertos de
--          (ejecutiva, línea) con hasta = greatest(desde, hoy en Bogotá − 1) y fin_motivo 'linea_quitada'.
--        - executives_baja_termina_visitantes: AFTER UPDATE OF status ON executives, cuando pasa a 'inactive' →
--          termina todos sus visitantes abiertos con hasta = greatest(desde, coalesce(left_at, hoy − 1)) y
--          fin_motivo 'baja'.
--   5. RLS sin políticas; nada para PUBLIC/anon/authenticated; service_role SELECT e INSERT en el historial y
--      EXECUTE de ejecutivas_traspasar.
--   6. Bloque DO final que comprueba todo y aborta si algo no cuadra; las pruebas que escriben usan una
--      ejecutiva activa real y médicos, visitantes, ajustes y excepciones de prueba en sub-bloques que terminan
--      con RAISE SQLSTATE 'P0820' y se deshacen (no queda ni cambia ninguna fila).
--
-- Errores para la API: 22023 (parámetro no válido: forma de p, uuid, tipo de destino, nombre, email, fecha mal
--   escrita, booleanos, motivo de más de 500), 23514 (regla: origen o destino inactivo, destino igual al origen,
--   origen sin líneas, líneas que el origen no lleva, baja sin todas las líneas o con 'nadie', fecha fuera de
--   [hoy − 90, hoy]; también el historial inmutable y el CHECK de fin_motivo), 23505 (email de la persona nueva
--   repetido; CONSTRAINT executives_email_key), P0002 (origen o destino inexistente), 23503 (p_user inexistente).
--   Cualquier error deshace todo el traspaso.
--
-- Depende de: 0100 (executives, executive_lines, coverage_overrides, business_lines), 0500
--   (line_territory_names), 0800 (medicos, medico_visitantes), 0810 (config_personas, config_metas,
--   config_registrar), users, kams y public.update_updated_at_column() (existentes).
--
-- Después de aplicar (misma ventana que el despliegue del código del traspaso):
--   NOTIFY pgrst, 'reload schema';   -- PostgREST debe ver la tabla, las columnas y la función nuevas
--   Costo Google: 0 (no llama a nada). No recalcula asignaciones ni cobertura.
--
-- Transaccional: todo o nada. Re-ejecutable: sí (IF NOT EXISTS, CREATE OR REPLACE, DROP CONSTRAINT IF EXISTS +
--   ADD, el relleno de fin_motivo solo toca filas sin motivo).
-- Rollback: 2026-10-12_9942_traspaso_ejecutivas_rollback.sql.
-- =====================================================================================

BEGIN;

-- -------------------------------------------------------------------------------------
-- 0. Precondiciones
-- -------------------------------------------------------------------------------------

DO $$
DECLARE
  v_tabla text;
  v_tipo  text;
BEGIN
  FOREACH v_tabla IN ARRAY ARRAY['users', 'kams', 'business_lines', 'executives', 'executive_lines',
                                 'coverage_overrides', 'line_territory_names', 'medicos', 'medico_visitantes',
                                 'config_personas', 'config_metas'] LOOP
    IF to_regclass('public.' || v_tabla) IS NULL THEN
      RAISE EXCEPTION '0820 Traspaso: falta la tabla previa public.% (0100, 0500, 0800 y 0810 deben estar aplicadas)',
        v_tabla;
    END IF;
  END LOOP;
  IF to_regprocedure('public.config_registrar(text, jsonb, date, date, text, uuid)') IS NULL THEN
    RAISE EXCEPTION '0820 Traspaso: falta public.config_registrar (0810)';
  END IF;
  IF to_regprocedure('public.update_updated_at_column()') IS NULL THEN
    RAISE EXCEPTION '0820 Traspaso: falta la función public.update_updated_at_column()';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes
                 WHERE schemaname = 'public' AND tablename = 'coverage_overrides'
                   AND indexname = 'coverage_overrides_active_uidx') THEN
    RAISE EXCEPTION '0820 Traspaso: falta coverage_overrides_active_uidx (un ajuste activo por línea y zona, 0100)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes
                 WHERE schemaname = 'public' AND tablename = 'medico_visitantes'
                   AND indexname = 'medico_visitantes_vigente_uidx') THEN
    RAISE EXCEPTION '0820 Traspaso: falta medico_visitantes_vigente_uidx (0800)';
  END IF;
  -- Si la tabla o las columnas ya existen, deben ser las de esta migración (re-ejecución).
  IF to_regclass('public.ejecutivas_traspasos') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns
                     WHERE table_schema = 'public' AND table_name = 'ejecutivas_traspasos'
                       AND column_name = 'destino_tipo') THEN
    RAISE EXCEPTION '0820 Traspaso: ya existe una tabla public.ejecutivas_traspasos que no es la de esta migración';
  END IF;
  SELECT c.data_type INTO v_tipo FROM information_schema.columns c
  WHERE c.table_schema = 'public' AND c.table_name = 'medico_visitantes' AND c.column_name = 'fin_motivo';
  IF v_tipo IS NOT NULL AND v_tipo <> 'text' THEN
    RAISE EXCEPTION '0820 Traspaso: medico_visitantes.fin_motivo ya existe con tipo %', v_tipo;
  END IF;
  SELECT c.data_type INTO v_tipo FROM information_schema.columns c
  WHERE c.table_schema = 'public' AND c.table_name = 'medico_visitantes' AND c.column_name = 'traspaso_id';
  IF v_tipo IS NOT NULL AND v_tipo <> 'uuid' THEN
    RAISE EXCEPTION '0820 Traspaso: medico_visitantes.traspaso_id ya existe con tipo %', v_tipo;
  END IF;
END;
$$;

-- -------------------------------------------------------------------------------------
-- 1. Historial de traspasos (inmutable)
-- -------------------------------------------------------------------------------------

-- Llaves sin ON DELETE (NO ACTION): ejecutivas y usuarios no se borran (se desactivan) y un SET NULL chocaría con
-- el disparador de inmutabilidad.
CREATE TABLE IF NOT EXISTS public.ejecutivas_traspasos (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  origen_id          uuid        NOT NULL REFERENCES public.executives(id),
  destino_id         uuid        NULL     REFERENCES public.executives(id),
  destino_tipo       text        NOT NULL,
  lineas             uuid[]      NOT NULL,
  fecha              date        NOT NULL,
  dar_de_baja        boolean     NOT NULL DEFAULT false,
  desactivar_usuario boolean     NOT NULL DEFAULT false,
  copiar_excepciones boolean     NOT NULL DEFAULT false,
  motivo             text        NULL,
  resumen            jsonb       NOT NULL,
  created_by         uuid        NULL     REFERENCES public.users(id),
  created_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ejecutivas_traspasos_destino_tipo_check
    CHECK (destino_tipo IN ('existente', 'nueva', 'vacante', 'nadie')),
  CONSTRAINT ejecutivas_traspasos_destino_check CHECK ((destino_tipo = 'nadie') = (destino_id IS NULL)),
  CONSTRAINT ejecutivas_traspasos_distintos_check CHECK (destino_id IS NULL OR destino_id <> origen_id),
  CONSTRAINT ejecutivas_traspasos_lineas_check
    CHECK (cardinality(lineas) >= 1 AND array_position(lineas, NULL::uuid) IS NULL),
  CONSTRAINT ejecutivas_traspasos_baja_check CHECK (NOT dar_de_baja OR destino_tipo <> 'nadie'),
  CONSTRAINT ejecutivas_traspasos_usuario_check CHECK (NOT desactivar_usuario OR dar_de_baja),
  CONSTRAINT ejecutivas_traspasos_excepciones_check CHECK (NOT copiar_excepciones OR destino_tipo <> 'nadie'),
  CONSTRAINT ejecutivas_traspasos_motivo_check
    CHECK (motivo IS NULL OR (btrim(motivo) <> '' AND length(motivo) <= 500)),
  CONSTRAINT ejecutivas_traspasos_resumen_check CHECK (jsonb_typeof(resumen) = 'object')
);

CREATE INDEX IF NOT EXISTS ejecutivas_traspasos_origen_idx     ON public.ejecutivas_traspasos (origen_id);
CREATE INDEX IF NOT EXISTS ejecutivas_traspasos_destino_idx    ON public.ejecutivas_traspasos (destino_id);
CREATE INDEX IF NOT EXISTS ejecutivas_traspasos_created_at_idx ON public.ejecutivas_traspasos (created_at DESC);

CREATE OR REPLACE FUNCTION public.ejecutivas_traspasos_inmutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'El historial de traspasos no se edita ni se borra (%)', TG_OP
    USING ERRCODE = 'check_violation',
          HINT = 'Cada traspaso queda como constancia; un traspaso nuevo se registra aparte.';
END;
$$;

CREATE OR REPLACE TRIGGER ejecutivas_traspasos_inmutable
  BEFORE UPDATE OR DELETE ON public.ejecutivas_traspasos
  FOR EACH ROW EXECUTE FUNCTION public.ejecutivas_traspasos_inmutable();
CREATE OR REPLACE TRIGGER ejecutivas_traspasos_inmutable_truncate
  BEFORE TRUNCATE ON public.ejecutivas_traspasos
  FOR EACH STATEMENT EXECUTE FUNCTION public.ejecutivas_traspasos_inmutable();

-- -------------------------------------------------------------------------------------
-- 2. medico_visitantes: fin_motivo y traspaso_id
-- -------------------------------------------------------------------------------------

ALTER TABLE public.medico_visitantes
  ADD COLUMN IF NOT EXISTS fin_motivo  text NULL,
  ADD COLUMN IF NOT EXISTS traspaso_id uuid NULL;

-- Las asignaciones ya terminadas sin motivo (antes de 0820) quedan como 'manual' (hoy en producción: 0 filas).
UPDATE public.medico_visitantes SET fin_motivo = 'manual' WHERE hasta IS NOT NULL AND fin_motivo IS NULL;

ALTER TABLE public.medico_visitantes DROP CONSTRAINT IF EXISTS medico_visitantes_fin_motivo_check;
ALTER TABLE public.medico_visitantes ADD CONSTRAINT medico_visitantes_fin_motivo_check
  CHECK ((hasta IS NULL AND fin_motivo IS NULL)
         OR (hasta IS NOT NULL AND fin_motivo IN ('manual', 'traspaso', 'baja', 'linea_quitada')));

-- Diferida: ejecutivas_traspasar escribe los visitantes con su traspaso_id antes de insertar el historial (que es
-- inmutable y se guarda al final, con el resumen). Se comprueba al cerrar la transacción.
ALTER TABLE public.medico_visitantes DROP CONSTRAINT IF EXISTS medico_visitantes_traspaso_id_fkey;
ALTER TABLE public.medico_visitantes ADD CONSTRAINT medico_visitantes_traspaso_id_fkey
  FOREIGN KEY (traspaso_id) REFERENCES public.ejecutivas_traspasos(id) DEFERRABLE INITIALLY DEFERRED;

CREATE INDEX IF NOT EXISTS medico_visitantes_traspaso_id_idx
  ON public.medico_visitantes (traspaso_id) WHERE traspaso_id IS NOT NULL;

-- Quien termina una asignación sin decir por qué (la ruta PATCH de /terceros solo manda hasta) deja 'manual'.
CREATE OR REPLACE FUNCTION public.medico_visitantes_fin_motivo_trg()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.hasta IS NOT NULL AND NEW.fin_motivo IS NULL THEN
    NEW.fin_motivo := 'manual';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER medico_visitantes_fin_motivo
  BEFORE INSERT OR UPDATE OF hasta, fin_motivo ON public.medico_visitantes
  FOR EACH ROW EXECUTE FUNCTION public.medico_visitantes_fin_motivo_trg();

-- -------------------------------------------------------------------------------------
-- 3. Disparadores "ya no está": línea quitada y baja terminan los visitantes abiertos
-- -------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.ejecutivas_linea_quitada_trg()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_hoy constant date := (now() AT TIME ZONE 'America/Bogota')::date;
BEGIN
  UPDATE public.medico_visitantes mv
  SET hasta = greatest(mv.desde, v_hoy - 1),
      fin_motivo = 'linea_quitada'
  WHERE mv.executive_id = OLD.executive_id
    AND mv.line_id = OLD.line_id
    AND mv.hasta IS NULL;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE TRIGGER executive_lines_termina_visitantes
  AFTER DELETE ON public.executive_lines
  FOR EACH ROW EXECUTE FUNCTION public.ejecutivas_linea_quitada_trg();

CREATE OR REPLACE FUNCTION public.ejecutivas_baja_trg()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_hoy constant date := (now() AT TIME ZONE 'America/Bogota')::date;
BEGIN
  UPDATE public.medico_visitantes mv
  SET hasta = greatest(mv.desde, coalesce(NEW.left_at, v_hoy - 1)),
      fin_motivo = 'baja'
  WHERE mv.executive_id = NEW.id
    AND mv.hasta IS NULL;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE TRIGGER executives_baja_termina_visitantes
  AFTER UPDATE OF status ON public.executives
  FOR EACH ROW
  WHEN (NEW.status = 'inactive' AND OLD.status IS DISTINCT FROM 'inactive')
  EXECUTE FUNCTION public.ejecutivas_baja_trg();

-- -------------------------------------------------------------------------------------
-- 4. ejecutivas_traspasar: el traspaso completo en una transacción
-- -------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.ejecutivas_traspasar(p jsonb, p_user uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_hoy        constant date := (now() AT TIME ZONE 'America/Bogota')::date;
  v_uuid_re    constant text := '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
  v_email_re   constant text := '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$';
  v_traspaso   constant uuid := gen_random_uuid();
  v_txt        text;
  v_clave      text;
  v_destino_j  jsonb;
  v_tipo       text;
  v_origen_id  uuid;
  v_destino_id uuid;
  v_lineas_p   uuid[];        -- las pedidas (NULL = todas las de origen)
  v_lineas_a   uuid[];        -- las que lleva origen
  v_lineas     uuid[];        -- las que se traspasan
  v_fuera      uuid[];
  v_fecha      date;
  v_baja       boolean;
  v_desactivar boolean;
  v_copiar     boolean;
  v_motivo     text;
  v_nombre     text;
  v_email      text;
  v_zona       text;
  v_origen     public.executives%ROWTYPE;
  v_dest       public.executives%ROWTYPE;
  v_fila       record;
  v_n          bigint;
  v_hasta      date;
  v_choque     date;
  v_motivo_exc text;
  v_aj_mov     int   := 0;
  v_aj_des     int   := 0;
  v_nombres    int   := 0;
  v_vis_mov    int   := 0;
  v_vis_term   int   := 0;
  v_exc        int   := 0;
  v_omitidos   jsonb := '[]'::jsonb;
  v_resumen    jsonb;
BEGIN
  -- a. Parámetros -----------------------------------------------------------------------------------------------
  IF p IS NULL OR jsonb_typeof(p) <> 'object' THEN
    RAISE EXCEPTION 'Faltan los datos del traspaso' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  v_txt := p ->> 'origen_id';
  IF v_txt IS NULL OR v_txt !~ v_uuid_re THEN
    RAISE EXCEPTION 'Falta el Ejecutivo Comercial que entrega (origen_id no válido)'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;
  v_origen_id := v_txt::uuid;

  v_destino_j := p -> 'destino';
  IF v_destino_j IS NULL OR jsonb_typeof(v_destino_j) <> 'object' THEN
    RAISE EXCEPTION 'Falta quién recibe (destino)' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  v_tipo := v_destino_j ->> 'tipo';
  IF v_tipo IS NULL OR v_tipo NOT IN ('existente', 'nueva', 'vacante', 'nadie') THEN
    RAISE EXCEPTION 'Quién recibe no es válido: %', coalesce(v_tipo, '(vacío)')
      USING ERRCODE = 'invalid_parameter_value',
            HINT = 'destino.tipo: existente, nueva, vacante o nadie.';
  END IF;
  IF v_tipo = 'existente' THEN
    v_txt := v_destino_j ->> 'id';
    IF v_txt IS NULL OR v_txt !~ v_uuid_re THEN
      RAISE EXCEPTION 'Falta el Ejecutivo Comercial que recibe (destino.id no válido)'
        USING ERRCODE = 'invalid_parameter_value';
    END IF;
    v_destino_id := v_txt::uuid;
  ELSIF v_tipo = 'nueva' THEN
    v_nombre := btrim(coalesce(v_destino_j ->> 'full_name', ''));
    IF length(v_nombre) < 2 OR length(v_nombre) > 120 THEN
      RAISE EXCEPTION 'El nombre de la persona nueva debe tener entre 2 y 120 caracteres'
        USING ERRCODE = 'invalid_parameter_value';
    END IF;
    v_email := nullif(lower(btrim(coalesce(v_destino_j ->> 'email', ''))), '');
    IF v_email IS NOT NULL AND (length(v_email) > 254 OR v_email !~ v_email_re) THEN
      RAISE EXCEPTION 'El email de la persona nueva no es válido: %', v_email
        USING ERRCODE = 'invalid_parameter_value';
    END IF;
  END IF;

  IF p -> 'lineas' IS NULL OR jsonb_typeof(p -> 'lineas') = 'null' THEN
    v_lineas_p := NULL;
  ELSIF jsonb_typeof(p -> 'lineas') <> 'array' OR jsonb_array_length(p -> 'lineas') = 0 THEN
    RAISE EXCEPTION 'Las líneas deben ser una lista con al menos una línea (o null para todas)'
      USING ERRCODE = 'invalid_parameter_value';
  ELSE
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(p -> 'lineas') AS t(e)
               WHERE jsonb_typeof(t.e) <> 'string' OR (t.e #>> '{}') !~ v_uuid_re) THEN
      RAISE EXCEPTION 'Alguna línea no es un identificador válido' USING ERRCODE = 'invalid_parameter_value';
    END IF;
    SELECT array_agg(DISTINCT (t.e #>> '{}')::uuid ORDER BY (t.e #>> '{}')::uuid)
    INTO v_lineas_p
    FROM jsonb_array_elements(p -> 'lineas') AS t(e);
  END IF;

  v_txt := p ->> 'fecha';
  IF v_txt IS NULL OR btrim(v_txt) = '' THEN
    v_fecha := v_hoy;
  ELSIF v_txt !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN
    RAISE EXCEPTION 'La fecha del traspaso no es válida: % (AAAA-MM-DD)', v_txt USING ERRCODE = 'invalid_parameter_value';
  ELSE
    BEGIN
      v_fecha := v_txt::date;
    EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
      RAISE EXCEPTION 'La fecha del traspaso no existe: %', v_txt USING ERRCODE = 'invalid_parameter_value';
    END;
  END IF;

  FOREACH v_clave IN ARRAY ARRAY['dar_de_baja', 'desactivar_usuario', 'copiar_excepciones'] LOOP
    IF jsonb_typeof(p -> v_clave) NOT IN ('boolean', 'null') THEN
      RAISE EXCEPTION '% debe ser verdadero o falso', v_clave USING ERRCODE = 'invalid_parameter_value';
    END IF;
  END LOOP;
  v_baja       := coalesce((p ->> 'dar_de_baja')::boolean, false);
  -- Pedido. Sin baja no se le quita el acceso a quien se queda: se ignora. Lo efectivo se decide al leer origen.
  v_desactivar := v_baja AND coalesce((p ->> 'desactivar_usuario')::boolean, false);
  v_copiar     := coalesce((p ->> 'copiar_excepciones')::boolean, false) AND v_tipo <> 'nadie';

  IF jsonb_typeof(p -> 'motivo') NOT IN ('string', 'null') THEN
    RAISE EXCEPTION 'El motivo debe ser un texto' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  v_motivo := nullif(btrim(p ->> 'motivo'), '');
  IF length(v_motivo) > 500 THEN
    RAISE EXCEPTION 'El motivo no puede pasar de 500 caracteres' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- Reglas que no necesitan la base
  IF v_baja AND v_tipo = 'nadie' THEN
    RAISE EXCEPTION 'Al dar de baja hay que elegir quién recibe: otra persona, una persona nueva o una vacante'
      USING ERRCODE = 'check_violation';
  END IF;
  IF v_fecha > v_hoy OR v_fecha < v_hoy - 90 THEN
    RAISE EXCEPTION 'La fecha del traspaso (%) debe estar entre % y hoy (%): no se programan traspasos futuros',
      to_char(v_fecha, 'YYYY-MM-DD'), to_char(v_hoy - 90, 'YYYY-MM-DD'), to_char(v_hoy, 'YYYY-MM-DD')
      USING ERRCODE = 'check_violation';
  END IF;

  -- b. Bloqueo de origen y destino (en orden de id, contra interbloqueos) y reglas contra la base ---------------
  PERFORM 1 FROM public.executives e WHERE e.id IN (v_origen_id, v_destino_id) ORDER BY e.id FOR UPDATE;

  SELECT * INTO v_origen FROM public.executives e WHERE e.id = v_origen_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe el Ejecutivo Comercial que entrega (%)', v_origen_id USING ERRCODE = 'no_data_found';
  END IF;
  IF v_origen.status = 'inactive' THEN
    RAISE EXCEPTION '% ya está inactivo: no tiene nada que traspasar', v_origen.full_name
      USING ERRCODE = 'check_violation';
  END IF;

  -- Usuario de OpMap de origen (paso k): solo el de un Ejecutivo Comercial, activo y que no sea quien hace el
  -- traspaso. Cualquier otro rol se maneja en Usuarios (users:manage). Se decide aquí para que el historial guarde
  -- lo que de verdad se hace.
  IF v_desactivar THEN
    v_desactivar := false;
    IF v_origen.user_id IS NOT NULL AND v_origen.user_id IS DISTINCT FROM p_user THEN
      PERFORM 1 FROM public.users u
      WHERE u.id = v_origen.user_id AND u.active AND u.role IN ('sales_manager', 'user')
      FOR UPDATE;
      v_desactivar := FOUND;
    END IF;
  END IF;

  IF v_tipo = 'existente' THEN
    IF v_destino_id = v_origen_id THEN
      RAISE EXCEPTION 'Quien recibe debe ser otra persona' USING ERRCODE = 'check_violation';
    END IF;
    SELECT * INTO v_dest FROM public.executives e WHERE e.id = v_destino_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'No existe el Ejecutivo Comercial que recibe (%)', v_destino_id USING ERRCODE = 'no_data_found';
    END IF;
    IF v_dest.status = 'inactive' THEN
      RAISE EXCEPTION '% está inactivo: no puede recibir un traspaso', v_dest.full_name
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  SELECT coalesce(array_agg(el.line_id ORDER BY el.line_id), '{}'::uuid[])
  INTO v_lineas_a
  FROM public.executive_lines el
  WHERE el.executive_id = v_origen_id;
  IF cardinality(v_lineas_a) = 0 THEN
    RAISE EXCEPTION '% no lleva ninguna línea: no hay nada que traspasar', v_origen.full_name
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_lineas_p IS NULL THEN
    v_lineas := v_lineas_a;
  ELSE
    SELECT array_agg(x ORDER BY x) INTO v_fuera FROM unnest(v_lineas_p) AS x WHERE x <> ALL (v_lineas_a);
    IF v_fuera IS NOT NULL THEN
      SELECT string_agg(coalesce(bl.name, x::text), ', ' ORDER BY coalesce(bl.name, x::text))
      INTO v_txt
      FROM unnest(v_fuera) AS x
      LEFT JOIN public.business_lines bl ON bl.id = x;
      RAISE EXCEPTION '% no lleva estas líneas: %', v_origen.full_name, v_txt USING ERRCODE = 'check_violation';
    END IF;
    v_lineas := v_lineas_p;
  END IF;
  IF v_baja AND NOT (v_lineas @> v_lineas_a) THEN
    RAISE EXCEPTION 'Al dar de baja se traspasan todas sus líneas' USING ERRCODE = 'check_violation';
  END IF;

  -- c. Destino nuevo: persona nueva o vacante, con la zona base de origen (y su color si hay baja) ----------------
  IF v_tipo = 'nueva' THEN
    IF v_email IS NOT NULL
       AND EXISTS (SELECT 1 FROM public.executives e WHERE lower(btrim(e.email)) = v_email) THEN
      RAISE EXCEPTION 'Ya hay un Ejecutivo Comercial con el email %', v_email
        USING ERRCODE = 'unique_violation', CONSTRAINT = 'executives_email_key';
    END IF;
    INSERT INTO public.executives (full_name, email, company, base_kam_id, status, started_at, color)
    VALUES (v_nombre, v_email, v_origen.company, v_origen.base_kam_id, 'active', v_fecha,
            CASE WHEN v_baja THEN v_origen.color END)
    RETURNING id INTO v_destino_id;
  ELSIF v_tipo = 'vacante' THEN
    -- Nombre de la zona como lo muestra la app (zoneDisplayName: sin el prefijo "KAM ").
    SELECT btrim(regexp_replace(coalesce(k.name, ''), '^\s*KAM\s+', '', 'i')) INTO v_zona
    FROM public.kams k WHERE k.id = v_origen.base_kam_id;
    INSERT INTO public.executives (full_name, company, base_kam_id, status, color)
    VALUES (CASE WHEN coalesce(v_zona, '') = '' THEN 'Vacante' ELSE 'Vacante · ' || v_zona END,
            v_origen.company, v_origen.base_kam_id, 'placeholder', CASE WHEN v_baja THEN v_origen.color END)
    RETURNING id INTO v_destino_id;
  END IF;

  -- d. Líneas al destino -----------------------------------------------------------------------------------------
  IF v_destino_id IS NOT NULL THEN
    INSERT INTO public.executive_lines (executive_id, line_id)
    SELECT v_destino_id, x FROM unnest(v_lineas) AS x
    ON CONFLICT DO NOTHING;
  END IF;

  -- e. Ajustes manuales de cobertura (primero se desactiva el de origen: un activo por línea y zona) ------------
  FOR v_fila IN
    SELECT o.id, o.line_id, o.kam_id, o.reason
    FROM public.coverage_overrides o
    WHERE o.executive_id = v_origen_id AND o.active AND o.line_id = ANY (v_lineas)
    ORDER BY o.line_id, o.kam_id, o.id
    FOR UPDATE
  LOOP
    UPDATE public.coverage_overrides SET active = false WHERE id = v_fila.id;
    IF v_destino_id IS NOT NULL THEN
      INSERT INTO public.coverage_overrides (line_id, kam_id, executive_id, reason, created_by, active)
      VALUES (v_fila.line_id, v_fila.kam_id, v_destino_id, v_fila.reason, p_user, true);
      v_aj_mov := v_aj_mov + 1;
    ELSE
      v_aj_des := v_aj_des + 1;
    END IF;
  END LOOP;

  -- f. Nombre del territorio, si el destino no tiene uno en esa línea ---------------------------------------------
  IF v_destino_id IS NOT NULL THEN
    INSERT INTO public.line_territory_names (line_id, executive_id, name, updated_by)
    SELECT n.line_id, v_destino_id, n.name, p_user
    FROM public.line_territory_names n
    WHERE n.executive_id = v_origen_id AND n.line_id = ANY (v_lineas)
    ON CONFLICT (line_id, executive_id) DO NOTHING;
    GET DIAGNOSTICS v_nombres = ROW_COUNT;
  END IF;

  -- g. Visitantes (médicos) ---------------------------------------------------------------------------------------
  FOR v_fila IN
    SELECT mv.id, mv.medico_id, mv.line_id, mv.municipality_id, mv.desde, m.activo
    FROM public.medico_visitantes mv
    JOIN public.medicos m ON m.id = mv.medico_id
    WHERE mv.executive_id = v_origen_id AND mv.hasta IS NULL AND mv.line_id = ANY (v_lineas)
    ORDER BY mv.line_id, mv.medico_id, mv.municipality_id NULLS FIRST, mv.id
    FOR UPDATE OF mv
  LOOP
    UPDATE public.medico_visitantes
    SET hasta = greatest(v_fila.desde, v_fecha - 1), fin_motivo = 'traspaso', traspaso_id = v_traspaso
    WHERE id = v_fila.id;

    IF v_destino_id IS NULL THEN
      v_vis_term := v_vis_term + 1;
    ELSIF NOT v_fila.activo THEN
      v_vis_term := v_vis_term + 1;
      v_omitidos := v_omitidos
                    || jsonb_build_array(jsonb_build_object('medico_id', v_fila.medico_id, 'razon', 'medico_inactivo'));
    ELSIF EXISTS (SELECT 1 FROM public.medico_visitantes d
                  WHERE d.medico_id = v_fila.medico_id AND d.executive_id = v_destino_id
                    AND d.line_id = v_fila.line_id
                    AND coalesce(d.municipality_id, '') = coalesce(v_fila.municipality_id, '')
                    AND d.hasta IS NULL) THEN
      -- El médico sigue con el destino: no cuenta como terminado, solo sale en omitidos.
      v_omitidos := v_omitidos
                    || jsonb_build_array(jsonb_build_object('medico_id', v_fila.medico_id, 'razon', 'ya_lo_visita'));
    ELSE
      -- Desde la fecha, pero nunca antes de que existiera la asignación de origen (fecha pasada).
      INSERT INTO public.medico_visitantes (medico_id, executive_id, line_id, municipality_id, desde, created_by,
                                            traspaso_id)
      VALUES (v_fila.medico_id, v_destino_id, v_fila.line_id, v_fila.municipality_id,
              greatest(v_fecha, v_fila.desde), p_user, v_traspaso);
      v_vis_mov := v_vis_mov + 1;
    END IF;
  END LOOP;

  -- h. Excepciones personales (solo si se pide): perfil y metas propias vigentes en la fecha ----------------------
  IF v_copiar THEN
    v_motivo_exc := 'Copiado por traspaso de ' || v_origen.full_name;

    FOR v_fila IN
      SELECT cp.perfil, cp.telefonica_habilitada, cp.tope_telefonicas_dia, cp.radio_m, cp.vigente_hasta
      FROM public.config_personas cp
      WHERE cp.executive_id = v_origen_id AND cp.anulado_at IS NULL
        AND cp.vigente_desde <= v_fecha AND (cp.vigente_hasta IS NULL OR cp.vigente_hasta >= v_fecha)
      ORDER BY cp.vigente_desde, cp.id
    LOOP
      v_hasta := v_fila.vigente_hasta;
      IF v_hasta IS NOT NULL THEN
        SELECT min(c.vigente_desde) INTO v_choque
        FROM public.config_personas c
        WHERE c.clave = v_destino_id::text AND c.anulado_at IS NULL AND c.vigente_desde > v_fecha;
        IF v_choque IS NOT NULL AND v_choque <= v_hasta THEN
          v_hasta := v_choque - 1;
        END IF;
      END IF;
      PERFORM public.config_registrar('config_personas',
                jsonb_build_object('executive_id', v_destino_id,
                                   'perfil', to_jsonb(v_fila.perfil),
                                   'telefonica_habilitada', v_fila.telefonica_habilitada,
                                   'tope_telefonicas_dia', v_fila.tope_telefonicas_dia,
                                   'radio_m', v_fila.radio_m),
                v_fecha, v_hasta, v_motivo_exc, p_user);
      v_exc := v_exc + 1;
    END LOOP;

    FOR v_fila IN
      SELECT cm.tipo, cm.subtipo_id, cm.periodo, cm.cantidad, cm.vigente_hasta
      FROM public.config_metas cm
      WHERE cm.scope = 'ejecutiva' AND cm.executive_id = v_origen_id AND cm.anulado_at IS NULL
        AND cm.vigente_desde <= v_fecha AND (cm.vigente_hasta IS NULL OR cm.vigente_hasta >= v_fecha)
      ORDER BY cm.tipo, cm.subtipo_id NULLS FIRST, cm.vigente_desde, cm.id
    LOOP
      v_hasta := v_fila.vigente_hasta;
      IF v_hasta IS NOT NULL THEN
        SELECT min(c.vigente_desde) INTO v_choque
        FROM public.config_metas c
        WHERE c.clave = 'ejecutiva:' || v_destino_id::text || ':' || v_fila.tipo || ':'
                        || coalesce(v_fila.subtipo_id::text, '-')
          AND c.anulado_at IS NULL AND c.vigente_desde > v_fecha;
        IF v_choque IS NOT NULL AND v_choque <= v_hasta THEN
          v_hasta := v_choque - 1;
        END IF;
      END IF;
      PERFORM public.config_registrar('config_metas',
                jsonb_build_object('scope', 'ejecutiva',
                                   'executive_id', v_destino_id,
                                   'tipo', v_fila.tipo,
                                   'subtipo_id', v_fila.subtipo_id,
                                   'periodo', v_fila.periodo,
                                   'cantidad', v_fila.cantidad),
                v_fecha, v_hasta, v_motivo_exc, p_user);
      v_exc := v_exc + 1;
    END LOOP;
  END IF;

  -- i. Quitar a origen las líneas traspasadas (sus visitantes en ellas ya quedaron terminados en g) ---------------
  DELETE FROM public.executive_lines WHERE executive_id = v_origen_id AND line_id = ANY (v_lineas);

  -- j. Baja: deja de tener todo el día anterior a la fecha -------------------------------------------------------
  IF v_baja THEN
    -- Visitantes abiertos que le queden (de líneas que ya no llevaba): los termina el disparador con 'baja'.
    SELECT count(*) INTO v_n FROM public.medico_visitantes mv WHERE mv.executive_id = v_origen_id AND mv.hasta IS NULL;
    v_vis_term := v_vis_term + v_n;
    UPDATE public.executives SET status = 'inactive', left_at = v_fecha - 1 WHERE id = v_origen_id;
  END IF;

  -- k. Usuario de OpMap de quien se va (v_desactivar ya dice si es de Ejecutivo Comercial, activo y no p_user) ---
  IF v_desactivar THEN
    UPDATE public.users SET active = false WHERE id = v_origen.user_id;
  END IF;

  -- l. Historial y resumen ---------------------------------------------------------------------------------------
  v_resumen := jsonb_build_object(
    'traspaso_id',           v_traspaso,
    'destino_id',            v_destino_id,
    'lineas',                to_jsonb(v_lineas),
    'ajustes_movidos',       v_aj_mov,
    'ajustes_desactivados',  v_aj_des,
    'nombres_copiados',      v_nombres,
    'visitantes_movidos',    v_vis_mov,
    'visitantes_terminados', v_vis_term,
    'omitidos',              v_omitidos,
    'excepciones_copiadas',  v_exc
  );

  INSERT INTO public.ejecutivas_traspasos (id, origen_id, destino_id, destino_tipo, lineas, fecha, dar_de_baja,
                                           desactivar_usuario, copiar_excepciones, motivo, resumen, created_by)
  VALUES (v_traspaso, v_origen_id, v_destino_id, v_tipo, v_lineas, v_fecha, v_baja, v_desactivar, v_copiar, v_motivo,
          v_resumen, p_user);

  RETURN v_resumen;
END;
$$;

-- -------------------------------------------------------------------------------------
-- 5. Seguridad: RLS sin políticas; nada para PUBLIC/anon/authenticated; service_role solo SELECT e INSERT en el
--    historial (además del disparador) y EXECUTE de la función llamable.
-- -------------------------------------------------------------------------------------

ALTER TABLE public.ejecutivas_traspasos ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.ejecutivas_traspasos FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON TABLE public.ejecutivas_traspasos TO service_role;

REVOKE ALL ON FUNCTION public.ejecutivas_traspasar(jsonb, uuid)     FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ejecutivas_traspasos_inmutable()      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.medico_visitantes_fin_motivo_trg()    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ejecutivas_linea_quitada_trg()        FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ejecutivas_baja_trg()                 FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ejecutivas_traspasar(jsonb, uuid) TO service_role;

-- -------------------------------------------------------------------------------------
-- 6. Documentación en el catálogo
-- -------------------------------------------------------------------------------------

COMMENT ON TABLE public.ejecutivas_traspasos IS
  'Historial INMUTABLE de traspasos de lo de un Ejecutivo Comercial (líneas, zona, ajustes manuales de cobertura, '
  'nombre del territorio, médicos y, si se pidió, excepciones) a otra persona, a una persona nueva, a una vacante o '
  'a nadie. Lo escribe solo ejecutivas_traspasar(). Disparadores impiden UPDATE, DELETE y TRUNCATE (23514). Spec: '
  'docs/specs/2026-10-12-traspaso-ejecutivo-comercial.md. Solo service_role (SELECT, INSERT).';
COMMENT ON COLUMN public.ejecutivas_traspasos.destino_tipo IS
  'existente (otra persona que ya estaba), nueva (persona creada en el traspaso), vacante (placeholder creado en el '
  'traspaso) o nadie (solo al quitar líneas a quien se queda; destino_id NULL).';
COMMENT ON COLUMN public.ejecutivas_traspasos.lineas IS 'Líneas traspasadas (business_lines.id), al menos una.';
COMMENT ON COLUMN public.ejecutivas_traspasos.fecha IS
  'Desde esta fecha lo tiene quien recibe; quien entrega lo deja el día anterior (y, con baja, left_at = fecha − 1).';
COMMENT ON COLUMN public.ejecutivas_traspasos.desactivar_usuario IS
  'true si se desactivó el usuario de OpMap de quien se fue (solo con dar_de_baja, y solo un usuario activo de '
  'Ejecutivo Comercial, rol sales_manager o user, distinto de quien hizo el traspaso).';
COMMENT ON COLUMN public.ejecutivas_traspasos.resumen IS
  'Lo que movió: { traspaso_id, destino_id, lineas, ajustes_movidos, ajustes_desactivados, nombres_copiados, '
  'visitantes_movidos, visitantes_terminados, omitidos: [{ medico_id, razon: ya_lo_visita | medico_inactivo }], '
  'excepciones_copiadas }.';

COMMENT ON COLUMN public.medico_visitantes.fin_motivo IS
  'Por qué terminó la asignación: manual (alguien la terminó; valor por defecto del disparador '
  'medico_visitantes_fin_motivo), traspaso (ejecutivas_traspasar), baja (la ejecutiva pasó a inactive) o '
  'linea_quitada (le quitaron la línea). NULL mientras está abierta (CHECK medico_visitantes_fin_motivo_check).';
COMMENT ON COLUMN public.medico_visitantes.traspaso_id IS
  'Traspaso que terminó esta asignación o que la creó para quien recibe (ejecutivas_traspasos.id; llave diferida al '
  'cierre de la transacción).';

COMMENT ON FUNCTION public.ejecutivas_traspasar(jsonb, uuid) IS
  'Traspaso atómico de lo de un Ejecutivo Comercial: valida, bloquea origen y destino, crea la persona nueva o la '
  'vacante (con su color si hay baja), suma las líneas, pasa ajustes manuales, nombre del territorio y visitantes '
  '(desde greatest(fecha, desde de origen)), copia excepciones si se pide (config_registrar), quita las líneas a quien '
  'entrega, la da de baja y desactiva su usuario si se pide y es de Ejecutivo Comercial (sales_manager o user, activo, '
  'no p_user), guarda el historial y devuelve el resumen. No recalcula la cobertura. Errores 22023, 23514, 23505, '
  'P0002. SECURITY INVOKER; solo service_role.';
COMMENT ON FUNCTION public.ejecutivas_linea_quitada_trg() IS
  'Disparador executive_lines_termina_visitantes (AFTER DELETE ON executive_lines): termina los visitantes abiertos de '
  'esa ejecutiva en esa línea (hasta = greatest(desde, hoy en Bogotá − 1), fin_motivo linea_quitada).';
COMMENT ON FUNCTION public.ejecutivas_baja_trg() IS
  'Disparador executives_baja_termina_visitantes (AFTER UPDATE OF status ON executives, al pasar a inactive): termina '
  'todos sus visitantes abiertos (hasta = greatest(desde, coalesce(left_at, hoy − 1)), fin_motivo baja).';
COMMENT ON FUNCTION public.medico_visitantes_fin_motivo_trg() IS
  'Disparador medico_visitantes_fin_motivo: al terminar una asignación sin motivo deja fin_motivo = manual.';
COMMENT ON FUNCTION public.ejecutivas_traspasos_inmutable() IS
  'Disparadores ejecutivas_traspasos_inmutable(_truncate): el historial de traspasos no se edita ni se borra (23514).';

-- -------------------------------------------------------------------------------------
-- 7. Comprobaciones (aborta la transacción si algo no cuadra). Las pruebas que escriben van en sub-bloques que
--    terminan con RAISE SQLSTATE 'P0820': PL/pgSQL deshace todo lo del sub-bloque (no queda ni cambia ninguna
--    fila). Cualquier otra excepción sale del bloque y aborta la migración.
-- -------------------------------------------------------------------------------------

DO $$
DECLARE
  v_hoy         constant date   := (now() AT TIME ZONE 'America/Bogota')::date;
  v_claves      constant text[] := ARRAY['traspaso_id', 'destino_id', 'lineas', 'ajustes_movidos',
                                         'ajustes_desactivados', 'nombres_copiados', 'visitantes_movidos',
                                         'visitantes_terminados', 'omitidos', 'excepciones_copiadas'];
  v_fn_service  constant text[] := ARRAY['public.ejecutivas_traspasar(jsonb, uuid)'];
  v_fn_internas constant text[] := ARRAY['public.ejecutivas_traspasos_inmutable()',
                                         'public.medico_visitantes_fin_motivo_trg()',
                                         'public.ejecutivas_linea_quitada_trg()',
                                         'public.ejecutivas_baja_trg()'];
  v_todos_priv  constant text   := 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER';
  v_motivo_aj   constant text   := 'Prueba 0820: ajuste manual';
  v_a_color     constant text   := '#0820aa';
  v_fn          text;
  v_par         text[];
  v_txt         text;
  v_msg         text;
  v_estado      text;
  v_keys        text[];
  v_casos       text[] := '{}';
  v_caso        record;
  v_n           bigint;
  v_n2          bigint;
  v_a           uuid;
  v_a_zona      uuid;
  v_a_user      uuid;
  v_a_lineas    uuid[];
  v_a_estado    text;
  v_a_left      date;
  v_b           uuid;
  v_l1          uuid;
  v_l2          uuid;
  v_kam         uuid;
  v_sede        uuid;
  v_cuenta      uuid;
  v_m           uuid[] := '{}';
  v_inactiva    uuid;
  v_sin_lineas  uuid;
  v_r           jsonb;
  v_t           uuid;
  v_d           uuid;
  v_fecha       date;
  v_esp_mov     bigint;
  v_esp_term    bigint;
  v_esp_aj      bigint;
  v_esp_nom     bigint;
  v_esp_exc     bigint;
  v_esp_omit    bigint;
  v_rol_ok      boolean;
BEGIN
  -- 7.1 Estructura, RLS sin políticas y privilegios ---------------------------------------------------------------
  IF to_regclass('public.ejecutivas_traspasos') IS NULL THEN
    RAISE EXCEPTION '0820: falta la tabla public.ejecutivas_traspasos';
  END IF;
  IF NOT (SELECT c.relrowsecurity FROM pg_class c WHERE c.oid = 'public.ejecutivas_traspasos'::regclass) THEN
    RAISE EXCEPTION '0820: public.ejecutivas_traspasos sin RLS';
  END IF;
  SELECT count(*) INTO v_n FROM pg_policies WHERE schemaname = 'public' AND tablename = 'ejecutivas_traspasos';
  IF v_n > 0 THEN
    RAISE EXCEPTION '0820: public.ejecutivas_traspasos tiene % política(s) RLS; debe tener 0', v_n;
  END IF;
  IF has_table_privilege('anon', 'public.ejecutivas_traspasos', v_todos_priv)
     OR has_table_privilege('authenticated', 'public.ejecutivas_traspasos', v_todos_priv) THEN
    RAISE EXCEPTION '0820: anon/authenticated tienen privilegios sobre public.ejecutivas_traspasos';
  END IF;
  IF NOT (has_table_privilege('service_role', 'public.ejecutivas_traspasos', 'SELECT')
          AND has_table_privilege('service_role', 'public.ejecutivas_traspasos', 'INSERT')) THEN
    RAISE EXCEPTION '0820: service_role no puede leer o insertar en public.ejecutivas_traspasos';
  END IF;
  IF has_table_privilege('service_role', 'public.ejecutivas_traspasos', 'UPDATE,DELETE,TRUNCATE') THEN
    RAISE EXCEPTION '0820: service_role puede editar, borrar o vaciar public.ejecutivas_traspasos';
  END IF;

  FOREACH v_fn IN ARRAY v_fn_service || v_fn_internas LOOP
    IF to_regprocedure(v_fn) IS NULL THEN
      RAISE EXCEPTION '0820: falta la función %', v_fn;
    END IF;
    IF has_function_privilege('anon', v_fn, 'EXECUTE') OR has_function_privilege('authenticated', v_fn, 'EXECUTE') THEN
      RAISE EXCEPTION '0820: anon/authenticated pueden ejecutar %', v_fn;
    END IF;
  END LOOP;
  FOREACH v_fn IN ARRAY v_fn_service LOOP
    IF NOT has_function_privilege('service_role', v_fn, 'EXECUTE') THEN
      RAISE EXCEPTION '0820: service_role no puede ejecutar %', v_fn;
    END IF;
  END LOOP;
  IF NOT has_function_privilege('service_role', 'public.config_registrar(text, jsonb, date, date, text, uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION '0820: service_role no puede ejecutar config_registrar (lo usa el traspaso al copiar excepciones)';
  END IF;

  -- Disparadores
  FOREACH v_par SLICE 1 IN ARRAY ARRAY[
    ARRAY['ejecutivas_traspasos_inmutable',          'public.ejecutivas_traspasos'],
    ARRAY['ejecutivas_traspasos_inmutable_truncate', 'public.ejecutivas_traspasos'],
    ARRAY['medico_visitantes_fin_motivo',            'public.medico_visitantes'],
    ARRAY['executive_lines_termina_visitantes',      'public.executive_lines'],
    ARRAY['executives_baja_termina_visitantes',      'public.executives']]
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_trigger t
                   WHERE t.tgrelid = v_par[2]::regclass AND t.tgname = v_par[1] AND NOT t.tgisinternal) THEN
      RAISE EXCEPTION '0820: falta el disparador % en %', v_par[1], v_par[2];
    END IF;
  END LOOP;

  -- Columnas nuevas, CHECK y llave diferida
  SELECT count(*) INTO v_n FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'medico_visitantes'
    AND ((column_name = 'fin_motivo' AND data_type = 'text') OR (column_name = 'traspaso_id' AND data_type = 'uuid'));
  IF v_n <> 2 THEN
    RAISE EXCEPTION '0820: faltan medico_visitantes.fin_motivo (text) o traspaso_id (uuid)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c
                 WHERE c.conrelid = 'public.medico_visitantes'::regclass
                   AND c.conname = 'medico_visitantes_traspaso_id_fkey' AND c.contype = 'f'
                   AND c.confrelid = 'public.ejecutivas_traspasos'::regclass
                   AND c.condeferrable AND c.condeferred) THEN
    RAISE EXCEPTION '0820: medico_visitantes_traspaso_id_fkey debe ser una llave a ejecutivas_traspasos DEFERRABLE INITIALLY DEFERRED';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c
                 WHERE c.conrelid = 'public.medico_visitantes'::regclass
                   AND c.conname = 'medico_visitantes_fin_motivo_check' AND c.contype = 'c') THEN
    RAISE EXCEPTION '0820: falta medico_visitantes_fin_motivo_check';
  END IF;
  SELECT count(*) INTO v_n FROM public.medico_visitantes WHERE (hasta IS NULL) <> (fin_motivo IS NULL);
  IF v_n > 0 THEN
    RAISE EXCEPTION '0820: % visitante(s) con fin_motivo que no cuadra con hasta', v_n;
  END IF;

  -- 7.2 Ejecutivas para las pruebas: A = activa real con zona y al menos 2 líneas (la de más líneas); B = otra
  --     activa de otra zona. Médicos, visitantes, ajustes, nombres y excepciones de prueba se crean y se deshacen.
  SELECT e.id, e.base_kam_id, e.status, e.left_at
  INTO v_a, v_a_zona, v_a_estado, v_a_left
  FROM public.executives e
  WHERE e.status = 'active' AND e.base_kam_id IS NOT NULL
    AND (SELECT count(*) FROM public.executive_lines el WHERE el.executive_id = e.id) >= 2
  ORDER BY (SELECT count(*) FROM public.executive_lines el WHERE el.executive_id = e.id) DESC, e.id
  LIMIT 1;
  IF v_a IS NOT NULL THEN
    SELECT e.id INTO v_b
    FROM public.executives e
    WHERE e.status = 'active' AND e.id <> v_a AND e.base_kam_id IS DISTINCT FROM v_a_zona
    ORDER BY e.id
    LIMIT 1;
  END IF;

  IF v_a IS NULL OR v_b IS NULL THEN
    RAISE WARNING '0820: no hay dos ejecutivas activas (una con zona y 2 líneas y otra de otra zona); no se probó ejecutivas_traspasar ni los disparadores';
  ELSE
    SELECT array_agg(el.line_id ORDER BY el.line_id) INTO v_a_lineas
    FROM public.executive_lines el WHERE el.executive_id = v_a;
    -- L1: una línea de A que B no lleve (para ver que B la suma); L2: otra de A.
    SELECT x INTO v_l1 FROM unnest(v_a_lineas) AS x
    ORDER BY EXISTS (SELECT 1 FROM public.executive_lines el WHERE el.executive_id = v_b AND el.line_id = x), x
    LIMIT 1;
    SELECT x INTO v_l2 FROM unnest(v_a_lineas) AS x WHERE x <> v_l1 ORDER BY x LIMIT 1;

    IF EXISTS (SELECT 1 FROM public.medicos WHERE tipo_documento = 'otro' AND numero_documento LIKE 'PRUEBA0820%')
       OR EXISTS (SELECT 1 FROM public.executives WHERE email LIKE 'prueba-0820-%@opmap.invalid')
       OR EXISTS (SELECT 1 FROM public.users WHERE email LIKE 'prueba-0820-%@opmap.invalid')
       OR EXISTS (SELECT 1 FROM public.cuentas WHERE tipo_identificacion = 'otro' AND numero_identificacion LIKE 'PRUEBA0820%') THEN
      RAISE EXCEPTION '0820: ya hay datos con la identificación de prueba (PRUEBA0820… o prueba-0820-…@opmap.invalid); no se puede probar';
    END IF;

    BEGIN
      -- 7.3 Preparación (se deshace al final con P0820) ---------------------------------------------------------
      -- A con un usuario de prueba de Ejecutivo Comercial (rol sales_manager, activo) y un color de prueba: las
      -- pruebas no dependen del usuario real de A (podría tener otro rol, que el traspaso no desactiva) ni de su color.
      INSERT INTO public.users (email, password, full_name, role)
      VALUES ('prueba-0820-a@opmap.invalid', 'sin-clave', 'Prueba 0820 usuario de A', 'sales_manager')
      RETURNING id INTO v_a_user;
      UPDATE public.executives SET user_id = v_a_user, color = v_a_color WHERE id = v_a;
      UPDATE public.users SET active = true WHERE id = v_a_user;

      SELECT s.id INTO v_sede FROM public.sedes s WHERE s.activo ORDER BY s.id LIMIT 1;
      IF v_sede IS NULL THEN
        INSERT INTO public.cuentas (nombre, clase, tipo_identificacion, numero_identificacion)
        VALUES ('Cuenta de prueba 0820', 'otra', 'otro', 'PRUEBA0820A') RETURNING id INTO v_cuenta;
        INSERT INTO public.sedes (cuenta_id, nombre, es_principal)
        VALUES (v_cuenta, 'Sede de prueba 0820', true) RETURNING id INTO v_sede;
      END IF;

      FOR i IN 1..6 LOOP
        v_m := v_m || public.terceros_crear_medico(
                        jsonb_build_object('tipo_documento', 'otro', 'numero_documento', 'PRUEBA0820M' || i,
                                           'nombre', 'Médico de prueba 0820 ' || i,
                                           'especialidades', jsonb_build_array('ortopedia'),
                                           'municipality_id', '11001'),
                        jsonb_build_array(jsonb_build_object('sede_id', v_sede, 'rol', 'atiende', 'principal', true)),
                        NULL);
      END LOOP;

      -- A visita a M1, M2 y M5 por L1 y a M3 y M4 por L2 desde hace 10 días.
      INSERT INTO public.medico_visitantes (medico_id, executive_id, line_id, desde)
      VALUES (v_m[1], v_a, v_l1, v_hoy - 10), (v_m[2], v_a, v_l1, v_hoy - 10), (v_m[5], v_a, v_l1, v_hoy - 10),
             (v_m[3], v_a, v_l2, v_hoy - 10), (v_m[4], v_a, v_l2, v_hoy - 10);

      -- Un ajuste manual de A en L1 (zona sin ajuste activo en esa línea; de preferencia la suya).
      SELECT k.id INTO v_kam
      FROM public.kams k
      WHERE k.active
        AND NOT EXISTS (SELECT 1 FROM public.coverage_overrides o WHERE o.line_id = v_l1 AND o.kam_id = k.id AND o.active)
      ORDER BY (k.id = v_a_zona) DESC, k.id
      LIMIT 1;
      INSERT INTO public.coverage_overrides (line_id, kam_id, executive_id, reason)
      VALUES (v_l1, v_kam, v_a, v_motivo_aj);

      INSERT INTO public.line_territory_names (line_id, executive_id, name)
      VALUES (v_l1, v_a, 'Territorio de prueba 0820')
      ON CONFLICT (line_id, executive_id) DO NOTHING;

      -- Excepciones de A vigentes desde hace 30 días (radio 777 y meta propia de 5 visitas médicas al día).
      PERFORM public.config_registrar('config_personas', jsonb_build_object('executive_id', v_a, 'radio_m', 777),
                                      v_hoy - 30, NULL, 'Prueba 0820: excepción de radio', NULL);
      PERFORM public.config_registrar('config_metas',
                                      jsonb_build_object('scope', 'ejecutiva', 'executive_id', v_a, 'tipo', 'medica',
                                                         'periodo', 'dia', 'cantidad', 5),
                                      v_hoy - 30, NULL, 'Prueba 0820: meta propia', NULL);

      -- 7.4 Baja con traspaso a una persona nueva (fecha = hace 2 días; copia excepciones y desactiva el usuario) -
      BEGIN
        v_fecha := v_hoy - 2;
        SELECT count(*) FILTER (WHERE mv.line_id = ANY (v_a_lineas) AND m.activo),
               count(*) FILTER (WHERE NOT (mv.line_id = ANY (v_a_lineas) AND m.activo))
        INTO v_esp_mov, v_esp_term
        FROM public.medico_visitantes mv JOIN public.medicos m ON m.id = mv.medico_id
        WHERE mv.executive_id = v_a AND mv.hasta IS NULL;
        SELECT count(*) INTO v_esp_aj FROM public.coverage_overrides o
        WHERE o.executive_id = v_a AND o.active AND o.line_id = ANY (v_a_lineas);
        SELECT count(*) INTO v_esp_nom FROM public.line_territory_names n
        WHERE n.executive_id = v_a AND n.line_id = ANY (v_a_lineas);
        SELECT (SELECT count(*) FROM public.config_personas c
                WHERE c.executive_id = v_a AND c.anulado_at IS NULL AND c.vigente_desde <= v_fecha
                  AND (c.vigente_hasta IS NULL OR c.vigente_hasta >= v_fecha))
             + (SELECT count(*) FROM public.config_metas c
                WHERE c.scope = 'ejecutiva' AND c.executive_id = v_a AND c.anulado_at IS NULL
                  AND c.vigente_desde <= v_fecha AND (c.vigente_hasta IS NULL OR c.vigente_hasta >= v_fecha))
        INTO v_esp_exc;

        v_r := public.ejecutivas_traspasar(jsonb_build_object(
                 'origen_id', v_a,
                 'destino', jsonb_build_object('tipo', 'nueva', 'full_name', '  Persona de prueba 0820  ',
                                               'email', ' Prueba-0820-Nueva@OpMap.INVALID '),
                 'lineas', NULL,
                 'fecha', v_fecha,
                 'dar_de_baja', true,
                 'desactivar_usuario', true,
                 'copiar_excepciones', true,
                 'motivo', '  Prueba 0820: se va  '), NULL);

        SELECT array_agg(k) INTO v_keys FROM jsonb_object_keys(v_r) AS k;
        IF NOT (v_keys @> v_claves AND v_keys <@ v_claves) THEN
          RAISE EXCEPTION '0820 baja/nueva: el resumen no trae exactamente las claves de la spec: %', v_keys;
        END IF;
        v_t := (v_r ->> 'traspaso_id')::uuid;
        v_d := (v_r ->> 'destino_id')::uuid;

        IF NOT EXISTS (SELECT 1 FROM public.executives e
                       WHERE e.id = v_d AND e.status = 'active' AND e.started_at = v_fecha AND e.left_at IS NULL
                         AND e.base_kam_id = v_a_zona AND e.full_name = 'Persona de prueba 0820'
                         AND e.email = 'prueba-0820-nueva@opmap.invalid' AND e.color = v_a_color) THEN
          RAISE EXCEPTION '0820 baja/nueva: la persona nueva no quedó activa con zona y color de A, nombre, email en minúsculas y started_at = fecha';
        END IF;
        IF (SELECT array_agg(el.line_id ORDER BY el.line_id) FROM public.executive_lines el WHERE el.executive_id = v_d)
           IS DISTINCT FROM v_a_lineas THEN
          RAISE EXCEPTION '0820 baja/nueva: la persona nueva no quedó con las líneas de A';
        END IF;
        IF (v_r -> 'lineas') IS DISTINCT FROM to_jsonb(v_a_lineas) THEN
          RAISE EXCEPTION '0820 baja/nueva: lineas del resumen (%) no son las de A', v_r -> 'lineas';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM public.executives e
                       WHERE e.id = v_a AND e.status = 'inactive' AND e.left_at = v_fecha - 1) THEN
          RAISE EXCEPTION '0820 baja/nueva: A no quedó inactiva con left_at = fecha − 1';
        END IF;
        IF EXISTS (SELECT 1 FROM public.executive_lines el WHERE el.executive_id = v_a) THEN
          RAISE EXCEPTION '0820 baja/nueva: A quedó con líneas';
        END IF;
        SELECT count(*) INTO v_n FROM public.medico_visitantes mv
        WHERE mv.executive_id = v_a AND mv.medico_id = ANY (v_m)
          AND mv.hasta = v_fecha - 1 AND mv.fin_motivo = 'traspaso' AND mv.traspaso_id = v_t;
        IF v_n <> 5 THEN
          RAISE EXCEPTION '0820 baja/nueva: % de 5 visitantes de A terminados en fecha − 1 con fin_motivo traspaso', v_n;
        END IF;
        SELECT count(*) INTO v_n FROM public.medico_visitantes mv
        JOIN public.medico_visitantes o ON o.medico_id = mv.medico_id AND o.line_id = mv.line_id
                                       AND o.executive_id = v_a AND o.traspaso_id = v_t
        WHERE mv.executive_id = v_d AND mv.medico_id = ANY (v_m)
          AND mv.hasta IS NULL AND mv.fin_motivo IS NULL AND mv.desde = v_fecha AND mv.traspaso_id = v_t;
        IF v_n <> 5 THEN
          RAISE EXCEPTION '0820 baja/nueva: % de 5 visitantes nuevos (mismo médico y línea, desde la fecha) para la persona nueva', v_n;
        END IF;
        IF EXISTS (SELECT 1 FROM public.medico_visitantes mv WHERE mv.executive_id = v_a AND mv.hasta IS NULL) THEN
          RAISE EXCEPTION '0820 baja/nueva: A quedó con visitantes abiertos';
        END IF;
        IF (v_r ->> 'visitantes_movidos')::bigint <> v_esp_mov OR (v_r ->> 'visitantes_terminados')::bigint <> v_esp_term
           OR v_r -> 'omitidos' <> '[]'::jsonb THEN
          RAISE EXCEPTION '0820 baja/nueva: visitantes del resumen % / % / % y se esperaba % / % / []',
            v_r ->> 'visitantes_movidos', v_r ->> 'visitantes_terminados', v_r -> 'omitidos', v_esp_mov, v_esp_term;
        END IF;
        -- Solo los de sus líneas (un ajuste viejo en una línea que A ya no lleva no es del traspaso).
        IF EXISTS (SELECT 1 FROM public.coverage_overrides o
                   WHERE o.executive_id = v_a AND o.active AND o.line_id = ANY (v_a_lineas)) THEN
          RAISE EXCEPTION '0820 baja/nueva: A quedó con ajustes manuales activos en sus líneas';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM public.coverage_overrides o
                       WHERE o.executive_id = v_d AND o.active AND o.line_id = v_l1 AND o.kam_id = v_kam
                         AND o.reason = v_motivo_aj) THEN
          RAISE EXCEPTION '0820 baja/nueva: el ajuste manual no pasó a la persona nueva con su motivo';
        END IF;
        IF (v_r ->> 'ajustes_movidos')::bigint <> v_esp_aj OR (v_r ->> 'ajustes_desactivados')::int <> 0 THEN
          RAISE EXCEPTION '0820 baja/nueva: ajustes del resumen % / % y se esperaba % / 0',
            v_r ->> 'ajustes_movidos', v_r ->> 'ajustes_desactivados', v_esp_aj;
        END IF;
        IF (SELECT n.name FROM public.line_territory_names n WHERE n.executive_id = v_d AND n.line_id = v_l1)
           IS DISTINCT FROM (SELECT n.name FROM public.line_territory_names n WHERE n.executive_id = v_a AND n.line_id = v_l1)
           OR (v_r ->> 'nombres_copiados')::bigint <> v_esp_nom THEN
          RAISE EXCEPTION '0820 baja/nueva: el nombre del territorio no se copió (resumen %, se esperaba %)',
            v_r ->> 'nombres_copiados', v_esp_nom;
        END IF;
        -- Lo copiado es lo que A tenía vigente en la fecha (la excepción de prueba o, si A ya tenía una real de la
        -- misma clave que la corta, esa): mismos valores y mismo fin, desde la fecha. Así no depende de los datos vivos.
        IF (v_r ->> 'excepciones_copiadas')::bigint <> v_esp_exc OR v_esp_exc < 2
           OR EXISTS (SELECT 1 FROM public.config_personas a
                      WHERE a.executive_id = v_a AND a.anulado_at IS NULL AND a.vigente_desde <= v_fecha
                        AND (a.vigente_hasta IS NULL OR a.vigente_hasta >= v_fecha)
                        AND NOT EXISTS (SELECT 1 FROM public.config_personas d
                                        WHERE d.executive_id = v_d AND d.anulado_at IS NULL
                                          AND d.vigente_desde = v_fecha
                                          AND d.vigente_hasta IS NOT DISTINCT FROM a.vigente_hasta
                                          AND d.perfil IS NOT DISTINCT FROM a.perfil
                                          AND d.telefonica_habilitada IS NOT DISTINCT FROM a.telefonica_habilitada
                                          AND d.tope_telefonicas_dia IS NOT DISTINCT FROM a.tope_telefonicas_dia
                                          AND d.radio_m IS NOT DISTINCT FROM a.radio_m))
           OR EXISTS (SELECT 1 FROM public.config_metas a
                      WHERE a.scope = 'ejecutiva' AND a.executive_id = v_a AND a.anulado_at IS NULL
                        AND a.vigente_desde <= v_fecha AND (a.vigente_hasta IS NULL OR a.vigente_hasta >= v_fecha)
                        AND NOT EXISTS (SELECT 1 FROM public.config_metas d
                                        WHERE d.scope = 'ejecutiva' AND d.executive_id = v_d
                                          AND d.anulado_at IS NULL AND d.vigente_desde = v_fecha
                                          AND d.vigente_hasta IS NOT DISTINCT FROM a.vigente_hasta
                                          AND d.tipo = a.tipo AND d.subtipo_id IS NOT DISTINCT FROM a.subtipo_id
                                          AND d.periodo IS NOT DISTINCT FROM a.periodo
                                          AND d.cantidad IS NOT DISTINCT FROM a.cantidad)) THEN
          RAISE EXCEPTION '0820 baja/nueva: excepciones no copiadas desde la fecha con los valores de A (resumen %, se esperaba %)',
            v_r ->> 'excepciones_copiadas', v_esp_exc;
        END IF;
        IF (SELECT u.active FROM public.users u WHERE u.id = v_a_user) IS DISTINCT FROM false THEN
          RAISE EXCEPTION '0820 baja/nueva: el usuario de A no quedó desactivado';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM public.ejecutivas_traspasos t
                       WHERE t.id = v_t AND t.origen_id = v_a AND t.destino_id = v_d AND t.destino_tipo = 'nueva'
                         AND t.lineas = v_a_lineas AND t.fecha = v_fecha AND t.dar_de_baja
                         AND t.desactivar_usuario AND t.copiar_excepciones AND t.motivo = 'Prueba 0820: se va'
                         AND t.resumen = v_r AND t.created_by IS NULL) THEN
          RAISE EXCEPTION '0820 baja/nueva: el historial no guardó el traspaso con su resumen';
        END IF;
        -- La llave diferida de traspaso_id se cumple (se fuerza la comprobación aquí y se vuelve a diferir).
        EXECUTE 'SET CONSTRAINTS public.medico_visitantes_traspaso_id_fkey IMMEDIATE';
        EXECUTE 'SET CONSTRAINTS public.medico_visitantes_traspaso_id_fkey DEFERRED';
        -- Historial inmutable
        BEGIN
          UPDATE public.ejecutivas_traspasos SET motivo = 'Editado' WHERE id = v_t;
          RAISE EXCEPTION '0820: se editó el historial de traspasos';
        EXCEPTION WHEN check_violation THEN NULL;
        END;
        BEGIN
          DELETE FROM public.ejecutivas_traspasos WHERE id = v_t;
          RAISE EXCEPTION '0820: se borró el historial de traspasos';
        EXCEPTION WHEN check_violation THEN NULL;
        END;
        BEGIN
          TRUNCATE public.ejecutivas_traspasos;
          RAISE EXCEPTION '0820: se vació el historial de traspasos';
        EXCEPTION WHEN check_violation OR feature_not_supported THEN NULL;
        END;
        v_casos := v_casos || 'baja a persona nueva'::text;
        RAISE SQLSTATE 'P0820';
      EXCEPTION
        WHEN SQLSTATE 'P0820' THEN NULL;
      END;

      -- 7.4b Usuario de quien se va: solo se desactiva el de un Ejecutivo Comercial (rol sales_manager o user),
      --      activo y que no sea quien hace el traspaso; el historial dice false si no se desactivó -----------------
      FOREACH v_txt IN ARRAY ARRAY['admin', 'line_leader', 'commercial_director', 'propio', 'sin_usuario', 'inactivo'] LOOP
        BEGIN
          IF v_txt IN ('admin', 'line_leader', 'commercial_director') THEN
            UPDATE public.users SET role = v_txt WHERE id = v_a_user;
          ELSIF v_txt = 'sin_usuario' THEN
            UPDATE public.executives SET user_id = NULL WHERE id = v_a;
          ELSIF v_txt = 'inactivo' THEN
            UPDATE public.users SET active = false WHERE id = v_a_user;
          END IF;
          v_r := public.ejecutivas_traspasar(jsonb_build_object(
                   'origen_id', v_a, 'destino', jsonb_build_object('tipo', 'vacante'),
                   'dar_de_baja', true, 'desactivar_usuario', true),
                 CASE WHEN v_txt = 'propio' THEN v_a_user END);
          v_t := (v_r ->> 'traspaso_id')::uuid;
          IF NOT EXISTS (SELECT 1 FROM public.ejecutivas_traspasos t
                         WHERE t.id = v_t AND t.dar_de_baja AND NOT t.desactivar_usuario) THEN
            RAISE EXCEPTION '0820 usuario (%): el historial dice que se desactivó un usuario que no se desactivó', v_txt;
          END IF;
          IF v_txt <> 'inactivo' AND (SELECT u.active FROM public.users u WHERE u.id = v_a_user) IS DISTINCT FROM true THEN
            RAISE EXCEPTION '0820 usuario (%): el traspaso desactivó un usuario que no es de Ejecutivo Comercial o el de quien lo hace', v_txt;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM public.executives e WHERE e.id = v_a AND e.status = 'inactive') THEN
            RAISE EXCEPTION '0820 usuario (%): la baja no se hizo', v_txt;
          END IF;
          RAISE SQLSTATE 'P0820';
        EXCEPTION
          WHEN SQLSTATE 'P0820' THEN NULL;
        END;
      END LOOP;
      v_casos := v_casos || 'usuario: no se desactiva un admin, un líder de línea, la dirección, el propio, sin usuario ni ya inactivo'::text;

      -- 7.4c Color: sin baja, la vacante no hereda el color (quien entrega lo sigue usando) --------------------------
      BEGIN
        v_r := public.ejecutivas_traspasar(jsonb_build_object(
                 'origen_id', v_a, 'destino', jsonb_build_object('tipo', 'vacante'), 'lineas', jsonb_build_array(v_l1)),
               NULL);
        v_d := (v_r ->> 'destino_id')::uuid;
        IF NOT EXISTS (SELECT 1 FROM public.executives e WHERE e.id = v_d AND e.status = 'placeholder' AND e.color IS NULL)
           OR NOT EXISTS (SELECT 1 FROM public.executives e WHERE e.id = v_a AND e.status = v_a_estado AND e.color = v_a_color) THEN
          RAISE EXCEPTION '0820 color: sin baja la vacante no debe heredar el color de A, que sigue activa con el suyo';
        END IF;
        v_casos := v_casos || 'sin baja, la vacante no hereda el color'::text;
        RAISE SQLSTATE 'P0820';
      EXCEPTION
        WHEN SQLSTATE 'P0820' THEN NULL;
      END;

      -- 7.5 Quitar L1 a A (se queda) hacia B existente de otra zona; B ya visita a M2 por L1; M5 inactivo -------
      BEGIN
        INSERT INTO public.medico_visitantes (medico_id, executive_id, line_id, desde)
        VALUES (v_m[2], v_b, v_l1, v_hoy - 20);
        UPDATE public.medicos SET activo = false WHERE id = v_m[5];
        v_fecha := v_hoy;
        SELECT count(*) FILTER (WHERE m.activo AND NOT EXISTS (
                                  SELECT 1 FROM public.medico_visitantes d
                                  WHERE d.medico_id = mv.medico_id AND d.executive_id = v_b AND d.line_id = mv.line_id
                                    AND coalesce(d.municipality_id, '') = coalesce(mv.municipality_id, '')
                                    AND d.hasta IS NULL)),
               count(*) FILTER (WHERE NOT m.activo),
               count(*)
        INTO v_esp_mov, v_esp_term, v_n
        FROM public.medico_visitantes mv JOIN public.medicos m ON m.id = mv.medico_id
        WHERE mv.executive_id = v_a AND mv.hasta IS NULL AND mv.line_id = v_l1;
        v_esp_omit := v_n - v_esp_mov;  -- ya_lo_visita + medico_inactivo
        SELECT count(*) INTO v_esp_aj FROM public.coverage_overrides o
        WHERE o.executive_id = v_a AND o.active AND o.line_id = v_l1;
        SELECT count(*) INTO v_esp_nom FROM public.line_territory_names n
        WHERE n.executive_id = v_a AND n.line_id = v_l1
          AND NOT EXISTS (SELECT 1 FROM public.line_territory_names x WHERE x.executive_id = v_b AND x.line_id = v_l1);
        SELECT count(*) INTO v_n2 FROM public.executive_lines el WHERE el.executive_id = v_a;

        v_r := public.ejecutivas_traspasar(jsonb_build_object(
                 'origen_id', v_a,
                 'destino', jsonb_build_object('tipo', 'existente', 'id', v_b),
                 'lineas', jsonb_build_array(v_l1),
                 'dar_de_baja', false,
                 'desactivar_usuario', true,   -- sin baja se ignora
                 'copiar_excepciones', false), NULL);
        v_t := (v_r ->> 'traspaso_id')::uuid;

        IF (v_r ->> 'destino_id')::uuid IS DISTINCT FROM v_b THEN
          RAISE EXCEPTION '0820 quitar línea: destino_id del resumen no es B';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM public.executive_lines el WHERE el.executive_id = v_b AND el.line_id = v_l1) THEN
          RAISE EXCEPTION '0820 quitar línea: B no sumó la línea';
        END IF;
        IF EXISTS (SELECT 1 FROM public.executive_lines el WHERE el.executive_id = v_a AND el.line_id = v_l1)
           OR NOT EXISTS (SELECT 1 FROM public.executive_lines el WHERE el.executive_id = v_a AND el.line_id = v_l2)
           OR (SELECT count(*) FROM public.executive_lines el WHERE el.executive_id = v_a) <> v_n2 - 1 THEN
          RAISE EXCEPTION '0820 quitar línea: A no perdió solo esa línea';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM public.executives e
                       WHERE e.id = v_a AND e.status = v_a_estado AND e.left_at IS NOT DISTINCT FROM v_a_left) THEN
          RAISE EXCEPTION '0820 quitar línea: A cambió de estado o de left_at sin darla de baja';
        END IF;
        IF (SELECT u.active FROM public.users u WHERE u.id = v_a_user) IS DISTINCT FROM true THEN
          RAISE EXCEPTION '0820 quitar línea: se desactivó el usuario de quien se queda';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM public.medico_visitantes mv
                       WHERE mv.executive_id = v_b AND mv.medico_id = v_m[1] AND mv.line_id = v_l1
                         AND mv.hasta IS NULL AND mv.desde = v_hoy AND mv.traspaso_id = v_t) THEN
          RAISE EXCEPTION '0820 quitar línea: B no recibió el médico 1 desde hoy';
        END IF;
        IF (SELECT count(*) FROM public.medico_visitantes mv
            WHERE mv.executive_id = v_b AND mv.medico_id = v_m[2] AND mv.line_id = v_l1 AND mv.hasta IS NULL) <> 1
           OR EXISTS (SELECT 1 FROM public.medico_visitantes mv
                      WHERE mv.executive_id = v_b AND mv.medico_id = v_m[2] AND mv.traspaso_id = v_t) THEN
          RAISE EXCEPTION '0820 quitar línea: el médico que B ya visitaba se duplicó';
        END IF;
        IF EXISTS (SELECT 1 FROM public.medico_visitantes mv WHERE mv.executive_id = v_b AND mv.medico_id = v_m[5]) THEN
          RAISE EXCEPTION '0820 quitar línea: se creó un visitante para un médico inactivo';
        END IF;
        SELECT count(*) INTO v_n FROM public.medico_visitantes mv
        WHERE mv.executive_id = v_a AND mv.medico_id IN (v_m[1], v_m[2], v_m[5]) AND mv.line_id = v_l1
          AND mv.hasta = v_hoy - 1 AND mv.fin_motivo = 'traspaso' AND mv.traspaso_id = v_t;
        IF v_n <> 3 THEN
          RAISE EXCEPTION '0820 quitar línea: % de 3 visitantes de A en la línea terminados ayer con fin_motivo traspaso', v_n;
        END IF;
        SELECT count(*) INTO v_n FROM public.medico_visitantes mv
        WHERE mv.executive_id = v_a AND mv.medico_id IN (v_m[3], v_m[4]) AND mv.line_id = v_l2 AND mv.hasta IS NULL;
        IF v_n <> 2 THEN
          RAISE EXCEPTION '0820 quitar línea: A no conservó sus médicos de la otra línea (% de 2 abiertos)', v_n;
        END IF;
        IF NOT (v_r -> 'omitidos' @> jsonb_build_array(jsonb_build_object('medico_id', v_m[2], 'razon', 'ya_lo_visita'))
                AND v_r -> 'omitidos' @> jsonb_build_array(jsonb_build_object('medico_id', v_m[5], 'razon', 'medico_inactivo'))) THEN
          RAISE EXCEPTION '0820 quitar línea: omitidos no traen el duplicado y el médico inactivo con su razón: %', v_r -> 'omitidos';
        END IF;
        IF (v_r ->> 'visitantes_movidos')::bigint <> v_esp_mov OR (v_r ->> 'visitantes_terminados')::bigint <> v_esp_term
           OR jsonb_array_length(v_r -> 'omitidos') <> v_esp_omit THEN
          RAISE EXCEPTION '0820 quitar línea: visitantes del resumen % / % (omitidos %) y se esperaba % / % (omitidos %)',
            v_r ->> 'visitantes_movidos', v_r ->> 'visitantes_terminados', jsonb_array_length(v_r -> 'omitidos'),
            v_esp_mov, v_esp_term, v_esp_omit;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM public.coverage_overrides o
                       WHERE o.executive_id = v_b AND o.active AND o.line_id = v_l1 AND o.kam_id = v_kam)
           OR EXISTS (SELECT 1 FROM public.coverage_overrides o WHERE o.executive_id = v_a AND o.active AND o.line_id = v_l1)
           OR (v_r ->> 'ajustes_movidos')::bigint <> v_esp_aj THEN
          RAISE EXCEPTION '0820 quitar línea: el ajuste manual no pasó a B';
        END IF;
        IF (v_r ->> 'nombres_copiados')::bigint <> v_esp_nom OR (v_r ->> 'excepciones_copiadas')::int <> 0 THEN
          RAISE EXCEPTION '0820 quitar línea: nombres % (se esperaba %) o excepciones % (se esperaba 0)',
            v_r ->> 'nombres_copiados', v_esp_nom, v_r ->> 'excepciones_copiadas';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM public.ejecutivas_traspasos t
                       WHERE t.id = v_t AND t.destino_id = v_b AND t.destino_tipo = 'existente' AND NOT t.dar_de_baja
                         AND NOT t.desactivar_usuario AND NOT t.copiar_excepciones AND t.fecha = v_hoy
                         AND t.lineas = ARRAY[v_l1] AND t.motivo IS NULL) THEN
          RAISE EXCEPTION '0820 quitar línea: el historial no guardó lo que de verdad se hizo';
        END IF;
        v_casos := v_casos || 'quitar una línea a quien se queda, con duplicado y médico inactivo omitidos'::text;
        RAISE SQLSTATE 'P0820';
      EXCEPTION
        WHEN SQLSTATE 'P0820' THEN NULL;
      END;

      -- 7.6 Quitar L1 a A sin que nadie la reciba: visitantes terminados y ajustes desactivados -------------------
      BEGIN
        SELECT count(*) INTO v_esp_term FROM public.medico_visitantes mv
        WHERE mv.executive_id = v_a AND mv.hasta IS NULL AND mv.line_id = v_l1;
        SELECT count(*) INTO v_esp_aj FROM public.coverage_overrides o
        WHERE o.executive_id = v_a AND o.active AND o.line_id = v_l1;
        v_r := public.ejecutivas_traspasar(jsonb_build_object(
                 'origen_id', v_a, 'destino', jsonb_build_object('tipo', 'nadie'),
                 'lineas', jsonb_build_array(v_l1), 'fecha', v_hoy, 'copiar_excepciones', true), NULL);
        v_t := (v_r ->> 'traspaso_id')::uuid;
        IF v_r -> 'destino_id' <> 'null'::jsonb THEN
          RAISE EXCEPTION '0820 nadie: destino_id debía ser null (%)', v_r -> 'destino_id';
        END IF;
        IF EXISTS (SELECT 1 FROM public.executive_lines el WHERE el.executive_id = v_a AND el.line_id = v_l1)
           OR NOT EXISTS (SELECT 1 FROM public.executives e WHERE e.id = v_a AND e.status = v_a_estado) THEN
          RAISE EXCEPTION '0820 nadie: A no perdió la línea o cambió de estado';
        END IF;
        SELECT count(*) INTO v_n FROM public.medico_visitantes mv
        WHERE mv.executive_id = v_a AND mv.medico_id IN (v_m[1], v_m[2], v_m[5])
          AND mv.hasta = v_hoy - 1 AND mv.fin_motivo = 'traspaso' AND mv.traspaso_id = v_t;
        IF v_n <> 3 OR EXISTS (SELECT 1 FROM public.medico_visitantes mv
                               WHERE mv.traspaso_id = v_t AND mv.executive_id <> v_a) THEN
          RAISE EXCEPTION '0820 nadie: los visitantes de la línea no quedaron solo terminados (% de 3)', v_n;
        END IF;
        IF (v_r ->> 'visitantes_movidos')::int <> 0 OR (v_r ->> 'visitantes_terminados')::bigint <> v_esp_term
           OR v_r -> 'omitidos' <> '[]'::jsonb
           OR (v_r ->> 'ajustes_movidos')::int <> 0 OR (v_r ->> 'ajustes_desactivados')::bigint <> v_esp_aj
           OR (v_r ->> 'nombres_copiados')::int <> 0 OR (v_r ->> 'excepciones_copiadas')::int <> 0 THEN
          RAISE EXCEPTION '0820 nadie: resumen inesperado %', v_r;
        END IF;
        IF EXISTS (SELECT 1 FROM public.coverage_overrides o WHERE o.line_id = v_l1 AND o.kam_id = v_kam AND o.active) THEN
          RAISE EXCEPTION '0820 nadie: el ajuste manual no quedó desactivado';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM public.ejecutivas_traspasos t
                       WHERE t.id = v_t AND t.destino_id IS NULL AND t.destino_tipo = 'nadie'
                         AND NOT t.copiar_excepciones) THEN
          RAISE EXCEPTION '0820 nadie: el historial no guardó el traspaso a nadie';
        END IF;
        v_casos := v_casos || 'quitar una línea sin que nadie la reciba'::text;
        RAISE SQLSTATE 'P0820';
      EXCEPTION
        WHEN SQLSTATE 'P0820' THEN NULL;
      END;

      -- 7.7 Email repetido para la persona nueva: 23505 y la base igual que antes ---------------------------------
      BEGIN
        INSERT INTO public.executives (full_name, email, status)
        VALUES ('Prueba 0820 email repetido', 'prueba-0820-rep@opmap.invalid', 'placeholder');
        SELECT count(*) INTO v_n FROM public.executives;
        SELECT count(*) INTO v_n2 FROM public.ejecutivas_traspasos;
        BEGIN
          PERFORM public.ejecutivas_traspasar(jsonb_build_object(
                    'origen_id', v_a,
                    'destino', jsonb_build_object('tipo', 'nueva', 'full_name', 'Persona repetida 0820',
                                                  'email', 'PRUEBA-0820-REP@OPMAP.INVALID'),
                    'dar_de_baja', true, 'desactivar_usuario', true, 'copiar_excepciones', true), NULL);
          RAISE EXCEPTION '0820: se aceptó una persona nueva con un email que ya tiene otro Ejecutivo Comercial';
        EXCEPTION WHEN unique_violation THEN NULL;
        END;
        IF (SELECT count(*) FROM public.executives) <> v_n
           OR (SELECT count(*) FROM public.ejecutivas_traspasos) <> v_n2
           OR NOT EXISTS (SELECT 1 FROM public.executives e
                          WHERE e.id = v_a AND e.status = v_a_estado AND e.left_at IS NOT DISTINCT FROM v_a_left)
           OR (SELECT array_agg(el.line_id ORDER BY el.line_id) FROM public.executive_lines el WHERE el.executive_id = v_a)
              IS DISTINCT FROM v_a_lineas
           OR (SELECT count(*) FROM public.medico_visitantes mv
               WHERE mv.executive_id = v_a AND mv.medico_id = ANY (v_m) AND mv.hasta IS NULL) <> 5
           OR NOT EXISTS (SELECT 1 FROM public.coverage_overrides o
                          WHERE o.executive_id = v_a AND o.active AND o.line_id = v_l1 AND o.kam_id = v_kam)
           OR (SELECT u.active FROM public.users u WHERE u.id = v_a_user) IS DISTINCT FROM true THEN
          RAISE EXCEPTION '0820 email repetido: quedó algo a medias tras el error';
        END IF;
        v_casos := v_casos || 'email repetido (23505) sin dejar nada a medias'::text;
        RAISE SQLSTATE 'P0820';
      EXCEPTION
        WHEN SQLSTATE 'P0820' THEN NULL;
      END;

      -- 7.8 Baja con traspaso a una vacante (fecha = hace 90 días, el límite) --------------------------------------
      BEGIN
        v_fecha := v_hoy - 90;
        v_r := public.ejecutivas_traspasar(jsonb_build_object(
                 'origen_id', v_a, 'destino', jsonb_build_object('tipo', 'vacante'),
                 'fecha', v_fecha, 'dar_de_baja', true), NULL);
        v_d := (v_r ->> 'destino_id')::uuid;
        v_t := (v_r ->> 'traspaso_id')::uuid;
        IF NOT EXISTS (SELECT 1 FROM public.executives e
                       WHERE e.id = v_d AND e.status = 'placeholder' AND e.base_kam_id = v_a_zona
                         AND e.email IS NULL AND e.started_at IS NULL AND e.user_id IS NULL AND e.color = v_a_color
                         AND e.full_name = 'Vacante · ' || (SELECT btrim(regexp_replace(k.name, '^\s*KAM\s+', '', 'i'))
                                                            FROM public.kams k WHERE k.id = v_a_zona)) THEN
          RAISE EXCEPTION '0820 vacante: no se creó la vacante "Vacante · <zona>" en estado placeholder con la zona y el color de A';
        END IF;
        IF (SELECT array_agg(el.line_id ORDER BY el.line_id) FROM public.executive_lines el WHERE el.executive_id = v_d)
           IS DISTINCT FROM v_a_lineas THEN
          RAISE EXCEPTION '0820 vacante: la vacante no quedó con las líneas de A';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM public.executives e
                       WHERE e.id = v_a AND e.status = 'inactive' AND e.left_at = v_fecha - 1) THEN
          RAISE EXCEPTION '0820 vacante: A no quedó inactiva con left_at = fecha − 1';
        END IF;
        -- hasta = greatest(desde, fecha − 1) = desde (empezaron hace 10 días); los nuevos desde greatest(fecha, desde)
        -- = su desde: la vacante no "visita" a nadie desde antes de que existiera la asignación.
        SELECT count(*) INTO v_n FROM public.medico_visitantes mv
        WHERE mv.executive_id = v_a AND mv.medico_id = ANY (v_m) AND mv.hasta = v_hoy - 10 AND mv.fin_motivo = 'traspaso';
        SELECT count(*) INTO v_n2 FROM public.medico_visitantes mv
        WHERE mv.executive_id = v_d AND mv.medico_id = ANY (v_m) AND mv.hasta IS NULL AND mv.desde = v_hoy - 10
          AND mv.traspaso_id = v_t;
        IF v_n <> 5 OR v_n2 <> 5 THEN
          RAISE EXCEPTION '0820 vacante: visitantes terminados % de 5 (hasta = su desde) y creados % de 5 (desde su desde, no la fecha)', v_n, v_n2;
        END IF;
        IF (SELECT u.active FROM public.users u WHERE u.id = v_a_user) IS DISTINCT FROM true
           OR NOT EXISTS (SELECT 1 FROM public.ejecutivas_traspasos t
                          WHERE t.id = v_t AND t.destino_tipo = 'vacante' AND t.dar_de_baja AND NOT t.desactivar_usuario) THEN
          RAISE EXCEPTION '0820 vacante: se desactivó el usuario sin pedirlo o el historial no cuadra';
        END IF;
        v_casos := v_casos || 'baja a una vacante (placeholder) con fecha de hace 90 días'::text;
        RAISE SQLSTATE 'P0820';
      EXCEPTION
        WHEN SQLSTATE 'P0820' THEN NULL;
      END;

      -- 7.9 Disparador de línea quitada (por la API vieja: borrar de executive_lines) -----------------------------
      BEGIN
        INSERT INTO public.medico_visitantes (medico_id, executive_id, line_id, desde)
        VALUES (v_m[6], v_a, v_l1, v_hoy);
        DELETE FROM public.executive_lines WHERE executive_id = v_a AND line_id = v_l1;
        SELECT count(*) INTO v_n FROM public.medico_visitantes mv
        WHERE mv.executive_id = v_a AND mv.medico_id IN (v_m[1], v_m[2], v_m[5]) AND mv.line_id = v_l1
          AND mv.hasta = v_hoy - 1 AND mv.fin_motivo = 'linea_quitada' AND mv.traspaso_id IS NULL;
        IF v_n <> 3 THEN
          RAISE EXCEPTION '0820 línea quitada: % de 3 visitantes terminados ayer con fin_motivo linea_quitada', v_n;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM public.medico_visitantes mv
                       WHERE mv.executive_id = v_a AND mv.medico_id = v_m[6] AND mv.hasta = v_hoy
                         AND mv.fin_motivo = 'linea_quitada') THEN
          RAISE EXCEPTION '0820 línea quitada: el visitante que empezó hoy debía terminar hoy (greatest(desde, hoy − 1))';
        END IF;
        IF (SELECT count(*) FROM public.medico_visitantes mv
            WHERE mv.executive_id = v_a AND mv.medico_id IN (v_m[3], v_m[4]) AND mv.hasta IS NULL) <> 2 THEN
          RAISE EXCEPTION '0820 línea quitada: se terminaron visitantes de otra línea';
        END IF;
        v_casos := v_casos || 'disparador de línea quitada'::text;
        RAISE SQLSTATE 'P0820';
      EXCEPTION
        WHEN SQLSTATE 'P0820' THEN NULL;
      END;

      -- 7.10 Disparador de baja (por la API vieja: status inactive) con left_at y sin left_at -----------------------
      BEGIN
        INSERT INTO public.medico_visitantes (medico_id, executive_id, line_id, desde)
        VALUES (v_m[6], v_a, v_l2, v_hoy);
        UPDATE public.executives SET notes = notes WHERE id = v_a;  -- otro cambio no termina nada
        IF (SELECT count(*) FROM public.medico_visitantes mv WHERE mv.executive_id = v_a AND mv.medico_id = ANY (v_m)
                                                               AND mv.hasta IS NULL) <> 6 THEN
          RAISE EXCEPTION '0820 baja: un UPDATE sin cambio de estado terminó visitantes';
        END IF;
        UPDATE public.executives SET status = 'inactive', left_at = v_hoy - 3 WHERE id = v_a;
        SELECT count(*) INTO v_n FROM public.medico_visitantes mv
        WHERE mv.executive_id = v_a AND mv.medico_id = ANY (v_m[1:5]) AND mv.hasta = v_hoy - 3 AND mv.fin_motivo = 'baja';
        IF v_n <> 5
           OR NOT EXISTS (SELECT 1 FROM public.medico_visitantes mv
                          WHERE mv.executive_id = v_a AND mv.medico_id = v_m[6] AND mv.hasta = v_hoy AND mv.fin_motivo = 'baja')
           OR EXISTS (SELECT 1 FROM public.medico_visitantes mv WHERE mv.executive_id = v_a AND mv.hasta IS NULL) THEN
          RAISE EXCEPTION '0820 baja: visitantes no terminados con greatest(desde, left_at) y fin_motivo baja (% de 5)', v_n;
        END IF;
        -- Sin left_at: termina ayer.
        INSERT INTO public.medico_visitantes (medico_id, executive_id, line_id, desde)
        VALUES (v_m[1], v_b, v_l2, v_hoy - 10);
        UPDATE public.executives SET status = 'inactive', left_at = NULL WHERE id = v_b;
        IF NOT EXISTS (SELECT 1 FROM public.medico_visitantes mv
                       WHERE mv.executive_id = v_b AND mv.medico_id = v_m[1] AND mv.hasta = v_hoy - 1
                         AND mv.fin_motivo = 'baja') THEN
          RAISE EXCEPTION '0820 baja: sin left_at el visitante debía terminar ayer';
        END IF;
        v_casos := v_casos || 'disparador de baja'::text;
        RAISE SQLSTATE 'P0820';
      EXCEPTION
        WHEN SQLSTATE 'P0820' THEN NULL;
      END;

      -- 7.11 fin_motivo: abierta sin motivo, terminada con uno de la lista, 'manual' por defecto -------------------
      BEGIN
        BEGIN
          INSERT INTO public.medico_visitantes (medico_id, executive_id, line_id, fin_motivo)
          VALUES (v_m[6], v_a, v_l1, 'traspaso');
          RAISE EXCEPTION '0820: se aceptó un visitante abierto con fin_motivo';
        EXCEPTION WHEN check_violation THEN NULL;
        END;
        UPDATE public.medico_visitantes SET hasta = v_hoy
        WHERE executive_id = v_a AND medico_id = v_m[3] AND hasta IS NULL;
        IF NOT EXISTS (SELECT 1 FROM public.medico_visitantes mv
                       WHERE mv.executive_id = v_a AND mv.medico_id = v_m[3] AND mv.hasta = v_hoy
                         AND mv.fin_motivo = 'manual') THEN
          RAISE EXCEPTION '0820: terminar una asignación sin motivo no dejó fin_motivo manual';
        END IF;
        BEGIN
          UPDATE public.medico_visitantes SET fin_motivo = 'otro'
          WHERE executive_id = v_a AND medico_id = v_m[3] AND hasta = v_hoy;
          RAISE EXCEPTION '0820: se aceptó un fin_motivo fuera de la lista';
        EXCEPTION WHEN check_violation THEN NULL;
        END;
        INSERT INTO public.medico_visitantes (medico_id, executive_id, line_id, desde, hasta)
        VALUES (v_m[6], v_a, v_l1, v_hoy - 5, v_hoy - 1);
        IF NOT EXISTS (SELECT 1 FROM public.medico_visitantes mv
                       WHERE mv.executive_id = v_a AND mv.medico_id = v_m[6] AND mv.hasta = v_hoy - 1
                         AND mv.fin_motivo = 'manual') THEN
          RAISE EXCEPTION '0820: un visitante ya terminado al insertarlo no quedó con fin_motivo manual';
        END IF;
        v_casos := v_casos || 'fin_motivo (CHECK y manual por defecto)'::text;
        RAISE SQLSTATE 'P0820';
      EXCEPTION
        WHEN SQLSTATE 'P0820' THEN NULL;
      END;

      -- 7.12 Validaciones: cada caso con su SQLSTATE ---------------------------------------------------------------
      BEGIN
        INSERT INTO public.executives (full_name, status) VALUES ('Prueba 0820 inactiva', 'inactive')
        RETURNING id INTO v_inactiva;
        INSERT INTO public.executives (full_name, status) VALUES ('Prueba 0820 sin líneas', 'placeholder')
        RETURNING id INTO v_sin_lineas;
        FOR v_caso IN
          SELECT c.nombre, c.payload, c.estado
          FROM (VALUES
            ('p no es objeto',          '[]'::jsonb,                                                                    '22023'),
            ('origen_id no válido',     jsonb_build_object('origen_id', 'abc', 'destino', jsonb_build_object('tipo', 'vacante')), '22023'),
            ('origen inexistente',      jsonb_build_object('origen_id', gen_random_uuid(), 'destino', jsonb_build_object('tipo', 'vacante')), 'P0002'),
            ('origen inactivo',         jsonb_build_object('origen_id', v_inactiva, 'destino', jsonb_build_object('tipo', 'vacante')), '23514'),
            ('origen sin líneas',       jsonb_build_object('origen_id', v_sin_lineas, 'destino', jsonb_build_object('tipo', 'vacante')), '23514'),
            ('sin destino',             jsonb_build_object('origen_id', v_a), '22023'),
            ('tipo de destino raro',    jsonb_build_object('origen_id', v_a, 'destino', jsonb_build_object('tipo', 'otra')), '22023'),
            ('existente sin id',        jsonb_build_object('origen_id', v_a, 'destino', jsonb_build_object('tipo', 'existente')), '22023'),
            ('existente inexistente',   jsonb_build_object('origen_id', v_a, 'destino', jsonb_build_object('tipo', 'existente', 'id', gen_random_uuid())), 'P0002'),
            ('destino igual a origen',  jsonb_build_object('origen_id', v_a, 'destino', jsonb_build_object('tipo', 'existente', 'id', v_a)), '23514'),
            ('destino inactivo',        jsonb_build_object('origen_id', v_a, 'destino', jsonb_build_object('tipo', 'existente', 'id', v_inactiva)), '23514'),
            ('líneas vacías',           jsonb_build_object('origen_id', v_a, 'destino', jsonb_build_object('tipo', 'vacante'), 'lineas', '[]'::jsonb), '22023'),
            ('línea no uuid',           jsonb_build_object('origen_id', v_a, 'destino', jsonb_build_object('tipo', 'vacante'), 'lineas', jsonb_build_array('x')), '22023'),
            ('línea que A no lleva',    jsonb_build_object('origen_id', v_a, 'destino', jsonb_build_object('tipo', 'vacante'), 'lineas', jsonb_build_array(gen_random_uuid())), '23514'),
            ('baja con algunas líneas', jsonb_build_object('origen_id', v_a, 'destino', jsonb_build_object('tipo', 'vacante'), 'lineas', jsonb_build_array(v_l1), 'dar_de_baja', true), '23514'),
            ('baja con nadie',          jsonb_build_object('origen_id', v_a, 'destino', jsonb_build_object('tipo', 'nadie'), 'dar_de_baja', true), '23514'),
            ('fecha futura',            jsonb_build_object('origen_id', v_a, 'destino', jsonb_build_object('tipo', 'vacante'), 'fecha', v_hoy + 1), '23514'),
            ('fecha de hace 91 días',   jsonb_build_object('origen_id', v_a, 'destino', jsonb_build_object('tipo', 'vacante'), 'fecha', v_hoy - 91), '23514'),
            ('fecha que no existe',     jsonb_build_object('origen_id', v_a, 'destino', jsonb_build_object('tipo', 'vacante'), 'fecha', '2026-02-30'), '22023'),
            ('fecha mal escrita',       jsonb_build_object('origen_id', v_a, 'destino', jsonb_build_object('tipo', 'vacante'), 'fecha', '12/10/2026'), '22023'),
            ('nueva sin nombre',        jsonb_build_object('origen_id', v_a, 'destino', jsonb_build_object('tipo', 'nueva', 'full_name', ' A ')), '22023'),
            ('nueva con email raro',    jsonb_build_object('origen_id', v_a, 'destino', jsonb_build_object('tipo', 'nueva', 'full_name', 'Persona 0820', 'email', 'no-es-email')), '22023'),
            ('baja como texto',         jsonb_build_object('origen_id', v_a, 'destino', jsonb_build_object('tipo', 'vacante'), 'dar_de_baja', 'si'), '22023'),
            ('motivo de 501',           jsonb_build_object('origen_id', v_a, 'destino', jsonb_build_object('tipo', 'vacante'), 'motivo', repeat('x', 501)), '22023')
          ) AS c(nombre, payload, estado)
        LOOP
          BEGIN
            PERFORM public.ejecutivas_traspasar(v_caso.payload, NULL);
            RAISE EXCEPTION '0820: se aceptó un traspaso no válido (%)', v_caso.nombre;
          EXCEPTION WHEN OTHERS THEN
            GET STACKED DIAGNOSTICS v_estado = RETURNED_SQLSTATE, v_msg = MESSAGE_TEXT;
            IF v_estado IS DISTINCT FROM v_caso.estado THEN
              RAISE EXCEPTION '0820: el caso "%" devolvió % (%) y se esperaba %', v_caso.nombre, v_estado, v_msg, v_caso.estado;
            END IF;
          END;
        END LOOP;
        IF NOT EXISTS (SELECT 1 FROM public.executives e WHERE e.id = v_a AND e.status = v_a_estado)
           OR (SELECT array_agg(el.line_id ORDER BY el.line_id) FROM public.executive_lines el WHERE el.executive_id = v_a)
              IS DISTINCT FROM v_a_lineas THEN
          RAISE EXCEPTION '0820: un traspaso rechazado cambió a A';
        END IF;
        v_casos := v_casos || 'validaciones 22023 / 23514 / P0002'::text;
        RAISE SQLSTATE 'P0820';
      EXCEPTION
        WHEN SQLSTATE 'P0820' THEN NULL;
      END;

      -- 7.13 Como service_role (el rol de la API): el traspaso funciona y el historial no se puede editar ni borrar -
      BEGIN
        BEGIN
          PERFORM set_config('role', 'service_role', true);
          v_rol_ok := true;
        EXCEPTION WHEN insufficient_privilege OR invalid_parameter_value THEN
          v_rol_ok := false;
        END;
        IF v_rol_ok THEN
          v_r := public.ejecutivas_traspasar(jsonb_build_object(
                   'origen_id', v_a, 'destino', jsonb_build_object('tipo', 'existente', 'id', v_b),
                   'lineas', jsonb_build_array(v_l2), 'copiar_excepciones', true), NULL);
          v_t := (v_r ->> 'traspaso_id')::uuid;
          IF (v_r ->> 'visitantes_movidos')::int < 2 OR (v_r ->> 'excepciones_copiadas')::int < 2 THEN
            RAISE EXCEPTION '0820 service_role: el traspaso no movió lo esperado: %', v_r;
          END IF;
          BEGIN
            UPDATE public.ejecutivas_traspasos SET motivo = 'Editado' WHERE id = v_t;
            RAISE EXCEPTION '0820: service_role editó el historial de traspasos';
          EXCEPTION WHEN insufficient_privilege THEN NULL;
          END;
          BEGIN
            DELETE FROM public.ejecutivas_traspasos WHERE id = v_t;
            RAISE EXCEPTION '0820: service_role borró el historial de traspasos';
          EXCEPTION WHEN insufficient_privilege THEN NULL;
          END;
          v_casos := v_casos || 'como service_role (traspaso con excepciones; historial sin UPDATE ni DELETE)'::text;
        ELSE
          RAISE NOTICE '0820: no se pudo cambiar a service_role; sus privilegios se comprobaron solo con has_*_privilege';
        END IF;
        RAISE SQLSTATE 'P0820';
      EXCEPTION
        WHEN SQLSTATE 'P0820' THEN NULL;
      END;
      IF current_user = 'service_role' THEN
        RAISE EXCEPTION '0820: el rol no volvió después de la prueba como service_role';
      END IF;

      RAISE SQLSTATE 'P0820';
    EXCEPTION
      WHEN SQLSTATE 'P0820' THEN NULL;  -- preparación y pruebas deshechas
    END;

    -- 7.14 No quedó nada de las pruebas y A está como antes
    IF EXISTS (SELECT 1 FROM public.medicos WHERE tipo_documento = 'otro' AND numero_documento LIKE 'PRUEBA0820%')
       OR EXISTS (SELECT 1 FROM public.executives WHERE email LIKE 'prueba-0820-%@opmap.invalid'
                                                      OR full_name LIKE 'Prueba 0820%' OR full_name = 'Persona de prueba 0820')
       OR EXISTS (SELECT 1 FROM public.users WHERE email LIKE 'prueba-0820-%@opmap.invalid')
       OR EXISTS (SELECT 1 FROM public.executives WHERE created_at = now())
       OR EXISTS (SELECT 1 FROM public.coverage_overrides WHERE reason = v_motivo_aj OR created_at = now())
       OR EXISTS (SELECT 1 FROM public.medico_visitantes WHERE created_at = now())
       OR EXISTS (SELECT 1 FROM public.ejecutivas_traspasos WHERE created_at = now())
       OR EXISTS (SELECT 1 FROM public.config_personas WHERE created_at = now())
       OR EXISTS (SELECT 1 FROM public.config_metas WHERE created_at = now()) THEN
      RAISE EXCEPTION '0820: quedaron filas de las pruebas';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.executives e
                   WHERE e.id = v_a AND e.status = v_a_estado AND e.left_at IS NOT DISTINCT FROM v_a_left)
       OR (SELECT array_agg(el.line_id ORDER BY el.line_id) FROM public.executive_lines el WHERE el.executive_id = v_a)
          IS DISTINCT FROM v_a_lineas THEN
      RAISE EXCEPTION '0820: la ejecutiva de las pruebas no quedó como estaba';
    END IF;
    IF cardinality(v_casos) < 11 THEN
      RAISE EXCEPTION '0820: solo se probaron % casos: %', cardinality(v_casos), array_to_string(v_casos, '; ');
    END IF;
  END IF;

  RAISE NOTICE '0820 OK: ejecutivas_traspasos con RLS sin políticas, solo service_role (SELECT, INSERT) e inmutable; medico_visitantes.fin_motivo (CHECK, manual por defecto) y traspaso_id (llave diferida); ejecutivas_traspasar y 2 disparadores que terminan visitantes; anon/authenticated sin acceso.';
  RAISE NOTICE '0820 OK: % casos probados con datos que se deshacen: %', cardinality(v_casos), array_to_string(v_casos, '; ');
END;
$$;

COMMIT;
