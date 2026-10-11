-- =====================================================================================
-- OpMap · Fase 2b (municipios y anexos de territorio) · 0500 — Esquema
-- Proyecto: norvxqgohddgsdkggqzq · Generado: 2026-10-11 · NO EJECUTADO TODAVÍA
--
-- Requiere: Fases 1 y 2 aplicadas (0100–0400). Comprobado con SELECT el 2026-10-10/11.
--
-- REGLA DE NEGOCIO (decisión del dueño, va al contrato con cada ejecutivo comercial):
--   El mapa cubre TODOS los municipios del país, pero con dos intensidades:
--     - Municipios CON IPS objetivo: se pintan fuerte. Son los que hay que visitar. La zona
--       sale de la asignación de IPS (misma regla de mayoría que el mapa).
--     - Municipios SIN IPS hoy: se reparten por TIEMPO REAL DE CARRETERA (Google Distance
--       Matrix, modo driving) desde la ciudad base de cada zona. NUNCA por distancia en línea
--       recta: dos municipios vecinos en el mapa pueden no tener carretera entre sí, y no se
--       puede entregar a nadie un municipio al que no puede llegar. Se pintan suave: si mañana
--       abre una clínica allí, ya se sabe qué zona la atiende.
--       · Google no encuentra ruta  → "sin acceso terrestre" (no_road): NO se asigna a nadie.
--       · La ruta supera el tope de la zona (kams.max_travel_time, minutos) → "fuera de
--         alcance" (out_of_reach): NO se asigna; la zona más cercana se guarda solo como dato.
--       · Candidatas: zonas activas cuyo departamento es el del municipio o uno adyacente de
--         nivel 1 o 2 (department_adjacency, leída en los dos sentidos). Es el mismo criterio
--         que usa el algoritmo de asignación de IPS.
--
-- Qué crea (sección A de la especificación de Fase 2b):
--   1. municipality_travel_times : caché PERMANENTE de tiempos zona → municipio (Google).
--   2. municipality_zone         : zona resultante de cada municipio (ips / reach /
--                                  out_of_reach / no_road / pending).
--   3. territory_snapshots       : versiones INMUTABLES del territorio de un ejecutivo
--                                  comercial en una línea (anexos A y B del contrato). Un
--                                  trigger impide UPDATE, DELETE y TRUNCATE.
--   4. line_territory_names      : nombre comercial de la zona de cada ejecutivo por línea.
--   Las 4 con RLS activado, SIN políticas, sin privilegios para anon/authenticated/PUBLIC y
--   con GRANT explícito a service_role (en territory_snapshots solo SELECT e INSERT).
--   Bloque DO final que comprueba todo (incluida una prueba real de inmutabilidad que se
--   deshace sola) y aborta la transacción si algo no cuadra.
--
-- Foto con SELECT antes de este script (2026-10-10/11):
--   - Ninguna de las 4 tablas existe. No existe ninguna función llamada
--     territory_snapshots_immutable.
--   - municipalities: PRIMARY KEY (code) = municipalities_pkey; code es varchar(10) NOT NULL
--     (1.121 filas, todas de 5 dígitos, 0 sin lat/lng; 11001 = Bogotá existe). La FK desde
--     una columna text funciona (varchar se compara con el operador de text).
--   - kams.id, business_lines.id, executives.id y users.id: uuid, PRIMARY KEY.
--   - business_lines: 5 filas; executives: 13 filas; coverage con RLS activado.
--   - gen_random_uuid() disponible (PostgreSQL 17.4, núcleo). pgcrypto 1.3 en "extensions"
--     (no se usa aquí: el sha256 del anexo lo calcula la app).
--   - pg_default_acl de postgres en public: tablas → postgres y service_role (arwdDxtm);
--     funciones → postgres y service_role (X). Ya no concede nada a anon/authenticated
--     (hardening/03 aplicado), pero el REVOKE explícito se deja igual por si se ejecuta
--     sobre una copia sin endurecer. Ojo: ese default SÍ da UPDATE/DELETE/TRUNCATE a
--     service_role en tablas nuevas; para territory_snapshots se revocan explícitamente.
--
-- Decisiones de diseño (además de la especificación):
--   - municipality_zone.nearest_kam_id con ON DELETE SET NULL (como kam_id): es un dato
--     recalculable y no debe impedir borrar una zona.
--   - CHECKs de coherencia: status 'ok' ⇔ travel_minutes NOT NULL; minutos/km ≥ 0;
--     ips_count ≥ 0; kind out_of_reach / no_road / pending ⇒ kam_id NULL (son municipios
--     que NO se asignan a nadie). En 'ips' y 'reach' no se exige kam_id NOT NULL porque
--     ON DELETE SET NULL puede dejarlo vacío hasta el siguiente recálculo.
--   - territory_snapshots: FKs sin acción (NO ACTION). Una versión firmada no puede perder
--     su línea, su ejecutivo ni su autor; ON DELETE SET NULL/CASCADE además chocaría con el
--     trigger de inmutabilidad. Por eso no se puede borrar un usuario que haya guardado una
--     versión (los usuarios se desactivan, no se borran) y executives nunca se borra.
--   - El trigger de inmutabilidad también bloquea TRUNCATE (nivel sentencia). Ni service_role
--     ni postgres lo saltan (los triggers no se omiten por RLS bypass); solo
--     session_replication_role = replica o DROP TABLE (rollback 9920) lo evitan.
--   - Trigger updated_at en line_territory_names con la función existente
--     public.update_updated_at_column().
--
-- Re-ejecutable: sí (IF NOT EXISTS / OR REPLACE / REVOKE-GRANT idempotentes). Si una tabla ya
--   existe con otra forma, CREATE TABLE IF NOT EXISTS no la cambia: el bloque final lo detecta.
-- Transaccional: todo o nada. Rollback: 2026-10-11_9920_fase2b_rollback.sql.
-- Despliegue: antes del código de Fase 2b (las rutas /api/municipality-coverage y
--   /api/territory/** fallan sin estas tablas). Después: `npx tsx scripts/fase2b-municipios.ts`
--   (dry-run, sin Google) para conocer la cifra exacta; el dueño autoriza el gasto.
-- =====================================================================================

BEGIN;

-- -------------------------------------------------------------------------------------
-- 0. Precondiciones
-- -------------------------------------------------------------------------------------

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['kams','municipalities','users','business_lines','executives',
                           'department_adjacency','coverage'] LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      RAISE EXCEPTION 'Fase 2b: falta public.% — aplicar antes las Fases 1 y 2', t;
    END IF;
  END LOOP;

  -- La FK municipality_code → municipalities(code) necesita PK o UNIQUE sobre code.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    WHERE con.conrelid = 'public.municipalities'::regclass
      AND con.contype IN ('p', 'u')
      AND con.conkey = ARRAY[(SELECT attnum FROM pg_attribute
                              WHERE attrelid = 'public.municipalities'::regclass
                                AND attname = 'code')]::int2[]
  ) THEN
    RAISE EXCEPTION 'Fase 2b: municipalities.code no es PRIMARY KEY ni UNIQUE';
  END IF;

  IF to_regprocedure('public.update_updated_at_column()') IS NULL THEN
    RAISE EXCEPTION 'Fase 2b: falta public.update_updated_at_column()';
  END IF;
END $$;

-- -------------------------------------------------------------------------------------
-- 1. Tablas
-- -------------------------------------------------------------------------------------

-- 1.1 Caché permanente de tiempos por carretera: ciudad base de la zona → municipio.
CREATE TABLE IF NOT EXISTS public.municipality_travel_times (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  kam_id            uuid        NOT NULL REFERENCES public.kams(id) ON DELETE CASCADE,
  municipality_code text        NOT NULL REFERENCES public.municipalities(code),
  travel_minutes    int         NULL,
  distance_km       numeric     NULL,
  status            text        NOT NULL,
  source            text        NOT NULL DEFAULT 'google_maps',
  calculated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT municipality_travel_times_kam_municipality_key UNIQUE (kam_id, municipality_code),
  CONSTRAINT municipality_travel_times_status_check
    CHECK (status IN ('ok', 'no_route', 'error')),
  CONSTRAINT municipality_travel_times_minutes_status_check
    CHECK ((status = 'ok') = (travel_minutes IS NOT NULL)),
  CONSTRAINT municipality_travel_times_minutes_check
    CHECK (travel_minutes IS NULL OR travel_minutes >= 0),
  CONSTRAINT municipality_travel_times_distance_check
    CHECK (distance_km IS NULL OR distance_km >= 0)
);

CREATE INDEX IF NOT EXISTS municipality_travel_times_municipality_code_idx
  ON public.municipality_travel_times (municipality_code);

-- 1.2 Zona resultante de cada municipio.
CREATE TABLE IF NOT EXISTS public.municipality_zone (
  municipality_code text        PRIMARY KEY REFERENCES public.municipalities(code),
  kam_id            uuid        NULL REFERENCES public.kams(id) ON DELETE SET NULL,
  kind              text        NOT NULL,
  travel_minutes    int         NULL,
  nearest_kam_id    uuid        NULL REFERENCES public.kams(id) ON DELETE SET NULL,
  nearest_minutes   int         NULL,
  ips_count         int         NOT NULL DEFAULT 0,
  computed_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT municipality_zone_kind_check
    CHECK (kind IN ('ips', 'reach', 'out_of_reach', 'no_road', 'pending')),
  CONSTRAINT municipality_zone_unassigned_check
    CHECK (kind IN ('ips', 'reach') OR kam_id IS NULL),
  CONSTRAINT municipality_zone_ips_count_check
    CHECK (ips_count >= 0),
  CONSTRAINT municipality_zone_minutes_check
    CHECK ((travel_minutes IS NULL OR travel_minutes >= 0)
       AND (nearest_minutes IS NULL OR nearest_minutes >= 0))
);

CREATE INDEX IF NOT EXISTS municipality_zone_kam_id_idx
  ON public.municipality_zone (kam_id);

-- 1.3 Versiones inmutables del territorio (anexos del contrato).
CREATE TABLE IF NOT EXISTS public.territory_snapshots (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  line_id       uuid        NOT NULL REFERENCES public.business_lines(id),
  executive_id  uuid        NOT NULL REFERENCES public.executives(id),
  version_label text        NOT NULL,
  note          text        NULL,
  created_by    uuid        NULL REFERENCES public.users(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  summary       jsonb       NOT NULL,
  annex_a       jsonb       NOT NULL,
  annex_b       jsonb       NOT NULL,
  content_hash  text        NOT NULL,
  CONSTRAINT territory_snapshots_line_executive_version_key
    UNIQUE (line_id, executive_id, version_label),
  CONSTRAINT territory_snapshots_version_label_check
    CHECK (btrim(version_label) <> ''),
  CONSTRAINT territory_snapshots_content_hash_check
    CHECK (btrim(content_hash) <> '')
);

-- 1.4 Nombre comercial de la zona de cada ejecutivo comercial en cada línea.
CREATE TABLE IF NOT EXISTS public.line_territory_names (
  line_id      uuid        NOT NULL REFERENCES public.business_lines(id) ON DELETE CASCADE,
  executive_id uuid        NOT NULL REFERENCES public.executives(id) ON DELETE CASCADE,
  name         text        NOT NULL,
  updated_by   uuid        NULL REFERENCES public.users(id),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (line_id, executive_id),
  CONSTRAINT line_territory_names_name_check CHECK (btrim(name) <> '')
);

-- -------------------------------------------------------------------------------------
-- 2. Triggers
-- -------------------------------------------------------------------------------------

-- 2.1 Inmutabilidad de territory_snapshots (UPDATE, DELETE y TRUNCATE).
--     SQLSTATE propio OPM01 para que la app (y la prueba del bloque final) lo reconozcan.
CREATE OR REPLACE FUNCTION public.territory_snapshots_immutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $fn$
BEGIN
  RAISE EXCEPTION 'territory_snapshots es inmutable: no se permite % (guarde una versión nueva)', TG_OP
    USING ERRCODE = 'OPM01',
          HINT = 'Cada versión del anexo de territorio es un documento contractual; para cambiarla se crea otra con otra etiqueta.';
END
$fn$;

REVOKE ALL ON FUNCTION public.territory_snapshots_immutable() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE TRIGGER territory_snapshots_immutable_row
  BEFORE UPDATE OR DELETE ON public.territory_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.territory_snapshots_immutable();

CREATE OR REPLACE TRIGGER territory_snapshots_immutable_truncate
  BEFORE TRUNCATE ON public.territory_snapshots
  FOR EACH STATEMENT EXECUTE FUNCTION public.territory_snapshots_immutable();

-- 2.2 updated_at en line_territory_names.
CREATE OR REPLACE TRIGGER update_line_territory_names_updated_at
  BEFORE UPDATE ON public.line_territory_names
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- -------------------------------------------------------------------------------------
-- 3. RLS activado y SIN políticas; fuera todo privilegio de anon/authenticated/PUBLIC.
--    service_role (bypass de RLS) recibe GRANT explícito. territory_snapshots: solo
--    SELECT e INSERT (defensa en profundidad además del trigger).
-- -------------------------------------------------------------------------------------

ALTER TABLE public.municipality_travel_times ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.municipality_zone         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.territory_snapshots       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.line_territory_names      ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
  public.municipality_travel_times,
  public.municipality_zone,
  public.territory_snapshots,
  public.line_territory_names
FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.municipality_travel_times,
  public.municipality_zone,
  public.line_territory_names
TO service_role;

REVOKE ALL ON TABLE public.territory_snapshots FROM service_role;
GRANT SELECT, INSERT ON TABLE public.territory_snapshots TO service_role;

-- -------------------------------------------------------------------------------------
-- 4. Documentación en el catálogo
-- -------------------------------------------------------------------------------------

COMMENT ON TABLE public.municipality_travel_times IS
  'Caché PERMANENTE de tiempos por carretera desde la ciudad base de cada zona (kams.lat/lng) '
  'hasta cada municipio (municipalities.lat/lng), medidos con Google Distance Matrix en modo '
  'driving. Regla de negocio: los municipios sin IPS se reparten por TIEMPO REAL DE CARRETERA, '
  'nunca por distancia en línea recta. Un par con status ok o no_route no se vuelve a pedir a '
  'Google; los error sí se reintentan. Solo se calculan pares candidatos: zonas activas del '
  'departamento del municipio o de departamentos adyacentes de nivel 1 o 2.';
COMMENT ON COLUMN public.municipality_travel_times.kam_id IS 'Zona (kams) desde cuya ciudad base se mide.';
COMMENT ON COLUMN public.municipality_travel_times.municipality_code IS 'Código DANE del municipio destino.';
COMMENT ON COLUMN public.municipality_travel_times.travel_minutes IS 'Minutos de carro según Google (redondeados). Solo con status ok.';
COMMENT ON COLUMN public.municipality_travel_times.distance_km IS 'Kilómetros por carretera según Google. Solo informativo; NO se usa para asignar.';
COMMENT ON COLUMN public.municipality_travel_times.status IS
  'ok = hay ruta (minutos y km); no_route = Google no encontró ruta por carretera (ZERO_RESULTS / '
  'NOT_FOUND): el municipio no es accesible por tierra desde esa zona; error = fallo de la '
  'consulta, se reintenta en la próxima ejecución.';
COMMENT ON COLUMN public.municipality_travel_times.source IS 'Origen del dato (google_maps).';

COMMENT ON TABLE public.municipality_zone IS
  'Zona de cada municipio del país. kind: ips = tiene IPS objetivo activas asignadas; la zona es '
  'la que gana por la misma regla de mayoría con la que el mapa colorea territorios (Bogotá 11001 '
  'guarda la zona ganadora global; el mapa pinta sus localidades por separado). reach = sin IPS '
  'hoy; la zona candidata con MENOR tiempo real por carretera, dentro de su tope '
  '(kams.max_travel_time). out_of_reach = la más cercana por carretera supera su tope: NO se '
  'asigna a nadie (nearest_* solo como dato). no_road = ninguna candidata tiene ruta por '
  'carretera (sin acceso terrestre): NO se asigna a nadie. pending = faltan tiempos por calcular. '
  'Nunca se usa distancia en línea recta. Se recalcula completo (scripts/fase2b-municipios.ts '
  '--assign o POST /api/municipality-coverage/recompute); no editar a mano.';
COMMENT ON COLUMN public.municipality_zone.kam_id IS 'Zona asignada. Solo en kind ips o reach; NULL en out_of_reach, no_road y pending.';
COMMENT ON COLUMN public.municipality_zone.travel_minutes IS 'En reach: minutos por carretera desde la ciudad base de la zona asignada.';
COMMENT ON COLUMN public.municipality_zone.nearest_kam_id IS 'En out_of_reach: la zona más cercana por carretera (aunque supere su tope). Solo dato.';
COMMENT ON COLUMN public.municipality_zone.nearest_minutes IS 'En out_of_reach: minutos por carretera de la zona más cercana.';
COMMENT ON COLUMN public.municipality_zone.ips_count IS 'IPS activas asignadas en el municipio (0 salvo en kind ips).';

COMMENT ON TABLE public.territory_snapshots IS
  'Versiones INMUTABLES del territorio de un ejecutivo comercial en una línea: anexo A (IPS '
  'objetivo a visitar) y anexo B (municipios por departamento: con IPS = visitar; de alcance = '
  'sin IPS hoy pero accesibles por carretera dentro del tope, repartidos por tiempo real de '
  'carretera, nunca por línea recta). Es el soporte contractual de lo que se entregó: un '
  'trigger impide UPDATE, DELETE y TRUNCATE (SQLSTATE OPM01). Para cambiar, se guarda otra '
  'versión con otra etiqueta.';
COMMENT ON COLUMN public.territory_snapshots.version_label IS 'Etiqueta de la versión (por defecto v<fecha>). Única por (línea, ejecutivo).';
COMMENT ON COLUMN public.territory_snapshots.summary IS 'Resumen: zonas, municipios con IPS, de alcance, IPS y camas.';
COMMENT ON COLUMN public.territory_snapshots.annex_a IS 'Anexo A: IPS activas asignadas a las zonas del ejecutivo en la línea.';
COMMENT ON COLUMN public.territory_snapshots.annex_b IS 'Anexo B: municipios (ips / reach) de esas zonas agrupados por departamento.';
COMMENT ON COLUMN public.territory_snapshots.content_hash IS 'sha256 del JSON canónico de annex_a + annex_b, calculado por la app (lib/territory.ts).';
COMMENT ON COLUMN public.territory_snapshots.created_by IS 'Usuario que guardó la versión.';

COMMENT ON TABLE public.line_territory_names IS
  'Nombre comercial de la zona de cada ejecutivo comercial en cada línea (p. ej. "Caribe Norte"). '
  'Si no hay fila, la app usa "<nombre del ejecutivo> – <línea>". El territorio que nombra se '
  'compone de sus zonas en coverage y de los municipios de municipality_zone (con IPS = visitar; '
  'de alcance = repartidos por tiempo real de carretera).';

-- -------------------------------------------------------------------------------------
-- 5. Comprobaciones: si algo no queda como se espera, se aborta toda la transacción.
-- -------------------------------------------------------------------------------------

DO $$
DECLARE
  t           text;
  n           int;
  v_line      uuid;
  v_exec      uuid;
  v_id        uuid;
  upd_blocked boolean := false;
  del_blocked boolean := false;
  trn_blocked boolean := false;
BEGIN
  -- 5.1 Las 4 tablas: RLS, 0 políticas, 0 privilegios para anon/authenticated/PUBLIC,
  --     service_role con SELECT e INSERT.
  FOREACH t IN ARRAY ARRAY['municipality_travel_times','municipality_zone',
                           'territory_snapshots','line_territory_names'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace
      WHERE ns.nspname = 'public' AND c.relname = t AND c.relkind = 'r' AND c.relrowsecurity
    ) THEN
      RAISE EXCEPTION 'Fase 2b: la tabla public.% no existe o no tiene RLS activado', t;
    END IF;

    SELECT count(*) INTO n FROM pg_policies WHERE schemaname = 'public' AND tablename = t;
    IF n > 0 THEN
      RAISE EXCEPTION 'Fase 2b: public.% tiene % política(s); debe nacer sin políticas', t, n;
    END IF;

    SELECT count(*) INTO n
    FROM pg_class c, aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a
    WHERE c.oid = ('public.' || t)::regclass
      AND (a.grantee = 0
           OR a.grantee IN (SELECT oid FROM pg_roles WHERE rolname IN ('anon', 'authenticated')));
    IF n > 0 THEN
      RAISE EXCEPTION 'Fase 2b: public.% conserva % privilegio(s) para anon/authenticated/PUBLIC', t, n;
    END IF;

    IF NOT has_table_privilege('service_role', 'public.' || t, 'SELECT')
       OR NOT has_table_privilege('service_role', 'public.' || t, 'INSERT') THEN
      RAISE EXCEPTION 'Fase 2b: service_role sin SELECT/INSERT en public.%', t;
    END IF;
  END LOOP;

  -- 5.2 service_role: UPDATE/DELETE donde toca y NUNCA en territory_snapshots.
  FOREACH t IN ARRAY ARRAY['municipality_travel_times','municipality_zone',
                           'line_territory_names'] LOOP
    IF NOT has_table_privilege('service_role', 'public.' || t, 'UPDATE')
       OR NOT has_table_privilege('service_role', 'public.' || t, 'DELETE') THEN
      RAISE EXCEPTION 'Fase 2b: service_role sin UPDATE/DELETE en public.%', t;
    END IF;
  END LOOP;

  IF has_table_privilege('service_role', 'public.territory_snapshots', 'UPDATE')
     OR has_table_privilege('service_role', 'public.territory_snapshots', 'DELETE')
     OR has_table_privilege('service_role', 'public.territory_snapshots', 'TRUNCATE') THEN
    RAISE EXCEPTION 'Fase 2b: service_role no debe tener UPDATE/DELETE/TRUNCATE en territory_snapshots';
  END IF;

  -- 5.3 Triggers de inmutabilidad presentes y habilitados.
  SELECT count(*) INTO n FROM pg_trigger
  WHERE tgrelid = 'public.territory_snapshots'::regclass
    AND tgname IN ('territory_snapshots_immutable_row', 'territory_snapshots_immutable_truncate')
    AND tgenabled IN ('O', 'A')
    AND tgfoid = 'public.territory_snapshots_immutable()'::regprocedure;
  IF n <> 2 THEN
    RAISE EXCEPTION 'Fase 2b: faltan los triggers de inmutabilidad de territory_snapshots (hay % de 2)', n;
  END IF;

  IF has_function_privilege('anon', 'public.territory_snapshots_immutable()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.territory_snapshots_immutable()', 'EXECUTE') THEN
    RAISE EXCEPTION 'Fase 2b: territory_snapshots_immutable() no debe ser ejecutable por anon/authenticated';
  END IF;

  -- 5.4 Prueba real de inmutabilidad: inserta una versión de prueba, intenta UPDATE, DELETE y
  --     TRUNCATE, y deshace todo (excepción OPM99 capturada = rollback al punto de guardado).
  --     Las variables PL/pgSQL conservan su valor tras el rollback del sub-bloque.
  SELECT id INTO v_line FROM public.business_lines ORDER BY id LIMIT 1;
  SELECT id INTO v_exec FROM public.executives ORDER BY id LIMIT 1;
  IF v_line IS NULL OR v_exec IS NULL THEN
    RAISE EXCEPTION 'Fase 2b: no hay líneas/ejecutivos para probar la inmutabilidad (¿Fase 1 sin sembrar?)';
  END IF;

  BEGIN
    INSERT INTO public.territory_snapshots
      (line_id, executive_id, version_label, summary, annex_a, annex_b, content_hash)
    VALUES (v_line, v_exec, '__autoprueba_0500__', '{}'::jsonb, '[]'::jsonb, '[]'::jsonb, 'autoprueba')
    RETURNING id INTO v_id;

    BEGIN
      UPDATE public.territory_snapshots SET note = 'x' WHERE id = v_id;
    EXCEPTION WHEN SQLSTATE 'OPM01' THEN upd_blocked := true;
    END;

    BEGIN
      DELETE FROM public.territory_snapshots WHERE id = v_id;
    EXCEPTION WHEN SQLSTATE 'OPM01' THEN del_blocked := true;
    END;

    BEGIN
      TRUNCATE public.territory_snapshots;
    EXCEPTION WHEN SQLSTATE 'OPM01' THEN trn_blocked := true;
    END;

    RAISE EXCEPTION USING ERRCODE = 'OPM99', MESSAGE = 'deshacer autoprueba';
  EXCEPTION WHEN SQLSTATE 'OPM99' THEN
    NULL;
  END;

  IF NOT (upd_blocked AND del_blocked AND trn_blocked) THEN
    RAISE EXCEPTION 'Fase 2b: territory_snapshots NO es inmutable (UPDATE bloqueado: %, DELETE: %, TRUNCATE: %)',
      upd_blocked, del_blocked, trn_blocked;
  END IF;

  SELECT count(*) INTO n FROM public.territory_snapshots WHERE version_label = '__autoprueba_0500__';
  IF n <> 0 THEN
    RAISE EXCEPTION 'Fase 2b: la versión de autoprueba no se deshizo';
  END IF;

  -- 5.5 Forma mínima esperada (detecta tablas preexistentes con otra definición).
  SELECT count(*) INTO n FROM information_schema.columns
  WHERE table_schema = 'public'
    AND (table_name::text, column_name::text) IN (
      ('municipality_travel_times','kam_id'), ('municipality_travel_times','municipality_code'),
      ('municipality_travel_times','travel_minutes'), ('municipality_travel_times','distance_km'),
      ('municipality_travel_times','status'), ('municipality_travel_times','source'),
      ('municipality_travel_times','calculated_at'),
      ('municipality_zone','municipality_code'), ('municipality_zone','kam_id'),
      ('municipality_zone','kind'), ('municipality_zone','travel_minutes'),
      ('municipality_zone','nearest_kam_id'), ('municipality_zone','nearest_minutes'),
      ('municipality_zone','ips_count'), ('municipality_zone','computed_at'),
      ('territory_snapshots','line_id'), ('territory_snapshots','executive_id'),
      ('territory_snapshots','version_label'), ('territory_snapshots','note'),
      ('territory_snapshots','created_by'), ('territory_snapshots','created_at'),
      ('territory_snapshots','summary'), ('territory_snapshots','annex_a'),
      ('territory_snapshots','annex_b'), ('territory_snapshots','content_hash'),
      ('line_territory_names','line_id'), ('line_territory_names','executive_id'),
      ('line_territory_names','name'), ('line_territory_names','updated_by'),
      ('line_territory_names','updated_at'));
  IF n <> 30 THEN
    RAISE EXCEPTION 'Fase 2b: se esperaban 30 columnas en las 4 tablas; hay %', n;
  END IF;

  SELECT count(*) INTO n FROM pg_constraint
  WHERE contype = 'f'
    AND conrelid IN ('public.municipality_travel_times'::regclass, 'public.municipality_zone'::regclass,
                     'public.territory_snapshots'::regclass, 'public.line_territory_names'::regclass);
  IF n <> 11 THEN
    RAISE EXCEPTION 'Fase 2b: se esperaban 11 claves foráneas en las 4 tablas; hay %', n;
  END IF;

  RAISE NOTICE 'Fase 2b OK: 4 tablas con RLS, 0 políticas, 0 privilegios para anon/authenticated, territory_snapshots inmutable (UPDATE/DELETE/TRUNCATE bloqueados). SIGUIENTE PASO: desplegar el código de Fase 2b y correr scripts/fase2b-municipios.ts en modo --dry-run.';
END $$;

COMMIT;
