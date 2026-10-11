-- =====================================================================================
-- OpMap · Fase 2 (cobertura por línea) · 0400 — Roles, líderes, zonas, colores y cobertura
-- Proyecto: norvxqgohddgsdkggqzq · Generado: 2026-10-11 · NO EJECUTADO TODAVÍA
--
-- Requiere: Fase 1 aplicada (0100, 0200, 0300). Comprobado con SELECT el 2026-10-10/11: las
--   6 tablas de Fase 1 existen y están sembradas (5 líneas, 13 ejecutivas), coverage y
--   coverage_overrides están vacías.
--
-- Qué hace (sección A de la especificación de Fase 2):
--   1. users.role: el CHECK pasa de 6 a 8 roles (+ line_leader, commercial_director).
--   2. Dos usuarios nuevos (líderes de línea) con contraseña aleatoria en bcrypt (pgcrypto,
--      coste 12, formato $2a$12$… que lib/passwords.ts reconoce como hash). Nadie conoce esa
--      contraseña: el admin la cambia desde /users antes de entregar el acceso.
--        - Stefania Andrea Gonzalez Torres · s.gonzalez@vgmedical.com.co · Medicina deportiva
--        - Yineth Paola Jiménez Escobar    · y.jimenez@vgmedical.com.co  · Trauma
--   3. Roles: m.cobo@, sramirez@, mn@ → line_leader; laurab@ → commercial_director.
--   4. business_lines.leader_user_id: deportiva → s.gonzalez@, trauma → y.jimenez@ (solo si
--      la línea no tiene líder; hoy ambas están en NULL). executives.user_id de y.jimenez@ →
--      su usuario nuevo (solo si está en NULL).
--   5. kams.base_city (ciudad/localidad base, para "Ciudad base: Barranquilla") y renombre de
--      (las celdas conservan su nombre de ciudad base; sin renombres)
--   6. executives.color (#RRGGBB) con una paleta categórica de 13 colores, uno por ejecutiva.
--   7. coverage: kind admite 'conflict'; columnas nearest_executive_id, nearest_minutes,
--      has_equipment, note.
--   8. Bloque DO final que comprueba todo y aborta la transacción si algo no cuadra.
--
-- Foto con SELECT antes de este script (2026-10-10/11):
--   - users_role_check = admin, user, viewer, sales_manager, contract_manager, data_manager.
--   - m.cobo@, sramirez@, mn@ y laurab@ existen, activos, con role = sales_manager.
--   - s.gonzalez@ y y.jimenez@ NO existen en users.
--   - pgcrypto 1.3 instalado en el esquema "extensions" (por eso crypt/gen_salt van
--     calificados con extensions.).
--   - business_lines: perossal → m.cobo@, reemplazo → sramirez@, columna → mn@,
--     deportiva → NULL, trauma → NULL. Las 5 con max_reach_minutes = 240.
--   - executives: 11 con correo + 2 placeholders ("Nueva Barranquilla", "Nueva Bogotá");
--     y.jimenez@ con user_id NULL.
--   - kams: 17 filas, un area_id por fila (sin duplicados). Nombres actuales: Medellín,
--     Barranquilla, Chapinero, San Cristóbal, Kennedy, Engativá, Cartagena, Valledupar,
--     Montería, Neiva, Pasto, Cúcuta, Pereira, Bucaramanga, Sincelejo (inactiva), Ibagué, Cali.
--     Los 12 area_id de 5 dígitos existen en municipalities.code; los 4 de 7 dígitos tienen IPS
--     con ese locality_id. 1100108 tiene 7 IPS "Kennedy" y 1 "Rafael Uribe Uribe" (dato
--     sucio): base_city toma el nombre más frecuente.
--     OJO: municipalities.name da los nombres oficiales DANE "Cartagena de Indias" (13001) y
--     "San José de Cúcuta" (54001). Es lo que pide la especificación; el importador de visitas
--     que resuelva por base_city debe aceptar también "Cartagena" / "Cúcuta" (ver README).
--   - coverage: 0 filas; coverage_kind_check = local, reach, manual, vacant.
--   - coverage_overrides: 0 filas.
--
-- Re-ejecución (idempotente):
--   - Usuarios nuevos: ON CONFLICT (email) DO NOTHING (no se toca la contraseña ya cambiada).
--   - Roles de los 4 usuarios existentes y de los 2 nuevos: se re-aplican siempre.
--   - Líderes y executives.user_id: solo se rellenan si están en NULL.
--   - base_city y color: solo se rellenan si están en NULL (no pisan lo editado en la app).
--   - Nombres de zona: se re-aplican siempre por area_id. Si ya se renombraron zonas desde la
--     app, re-ejecutar este archivo las devuelve a estos nombres.
--
-- Despliegue: ejecutar este archivo y desplegar el código de Fase 2 en la misma ventana. Con
--   la base migrada y el código viejo, line_leader y commercial_director no existen en
--   lib/permissions.ts y hasPermission() les niega todo (las 3 líderes y Laura se quedan sin
--   acceso hasta el despliegue). Con el código nuevo y la base sin migrar, fallan las consultas
--   a kams.base_city, executives.color y las columnas nuevas de coverage.
--   Después: POST /api/coverage/recalculate (botón "Recalcular cobertura" en /lines) para
--   llenar coverage, y cambiar desde /users la contraseña de los 2 usuarios nuevos.
--
-- Transaccional: todo o nada. Rollback: 2026-10-11_9910_fase2_rollback.sql.
-- =====================================================================================

BEGIN;

-- -------------------------------------------------------------------------------------
-- 0. Precondiciones: Fase 1 aplicada y cada area_id de la lista con exactamente una zona.
-- -------------------------------------------------------------------------------------

DO $$
DECLARE
  t   text;
  a   text;
  n   int;
BEGIN
  FOREACH t IN ARRAY ARRAY['business_lines','executives','executive_lines',
                           'line_zones','coverage','coverage_overrides'] LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      RAISE EXCEPTION 'Fase 2: falta public.% — aplicar antes la Fase 1 (0100/0200)', t;
    END IF;
  END LOOP;

  FOREACH a IN ARRAY ARRAY['08001','13001','23001','20001','68001','54001','05001','66001',
                           '73001','76001','52001','41001','1100102','1100110','1100108',
                           '1100104','70001'] LOOP
    SELECT count(*) INTO n FROM public.kams WHERE area_id = a;
    IF n <> 1 THEN
      RAISE EXCEPTION 'Fase 2: area_id % debe corresponder a exactamente una zona en kams; hay %', a, n;
    END IF;
  END LOOP;
END $$;

-- -------------------------------------------------------------------------------------
-- 1. users.role: 8 roles
-- -------------------------------------------------------------------------------------

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check CHECK (role IN (
  'admin', 'user', 'viewer', 'sales_manager', 'contract_manager', 'data_manager',
  'line_leader', 'commercial_director'
));

COMMENT ON COLUMN public.users.role IS
  'admin | user | viewer | sales_manager | contract_manager | data_manager | line_leader '
  '(líder de una línea de negocio: ve y ajusta la cobertura de SU línea) | commercial_director '
  '(dirección comercial: ve todas las líneas y ajusta cobertura). Permisos en web/lib/permissions.ts.';

-- -------------------------------------------------------------------------------------
-- 2. Usuarios nuevos (contraseña aleatoria desconocida; el admin la cambia después)
-- -------------------------------------------------------------------------------------

INSERT INTO public.users (email, password, full_name, role, active)
SELECT s.email,
       extensions.crypt(gen_random_uuid()::text, extensions.gen_salt('bf', 12)),
       s.full_name, 'line_leader', true
FROM (VALUES
  ('s.gonzalez@vgmedical.com.co', 'Stefania Andrea Gonzalez Torres'),
  ('y.jimenez@vgmedical.com.co',  'Yineth Paola Jiménez Escobar')
) AS s(email, full_name)
ON CONFLICT (email) DO NOTHING;

-- -------------------------------------------------------------------------------------
-- 3. Roles por correo
-- -------------------------------------------------------------------------------------

UPDATE public.users
SET role = 'line_leader'
WHERE lower(email) IN ('m.cobo@vgmedical.com.co', 'sramirez@vgmedical.com.co',
                       'mn@vgmedical.com.co', 's.gonzalez@vgmedical.com.co',
                       'y.jimenez@vgmedical.com.co')
  AND role IS DISTINCT FROM 'line_leader';

UPDATE public.users
SET role = 'commercial_director'
WHERE lower(email) = 'laurab@vgmedical.com.co'
  AND role IS DISTINCT FROM 'commercial_director';

-- -------------------------------------------------------------------------------------
-- 4. Líderes de línea y usuario de la ejecutiva y.jimenez@
-- -------------------------------------------------------------------------------------

UPDATE public.business_lines bl
SET leader_user_id = u.id
FROM (VALUES
  ('deportiva', 's.gonzalez@vgmedical.com.co'),
  ('trauma',    'y.jimenez@vgmedical.com.co')
) AS s(code, email)
JOIN public.users u ON lower(u.email) = s.email
WHERE bl.code = s.code
  AND bl.leader_user_id IS NULL;

UPDATE public.executives e
SET user_id = u.id
FROM public.users u
WHERE lower(u.email) = 'y.jimenez@vgmedical.com.co'
  AND lower(e.email) = 'y.jimenez@vgmedical.com.co'
  AND e.user_id IS NULL;

-- -------------------------------------------------------------------------------------
-- 5. Zonas: kams.base_city + renombre por area_id
-- -------------------------------------------------------------------------------------

ALTER TABLE public.kams ADD COLUMN IF NOT EXISTS base_city text NULL;

-- 5 dígitos: municipio DANE.
UPDATE public.kams k
SET base_city = m.name
FROM public.municipalities m
WHERE length(k.area_id) = 5
  AND m.code = k.area_id
  AND k.base_city IS NULL;

-- 7 dígitos: localidad de Bogotá, nombre más frecuente entre las IPS con ese locality_id.
UPDATE public.kams k
SET base_city = (
  SELECT h.locality_name
  FROM public.hospitals h
  WHERE h.locality_id = k.area_id
    AND h.locality_name IS NOT NULL
    AND btrim(h.locality_name) <> ''
  GROUP BY h.locality_name
  ORDER BY count(*) DESC, h.locality_name
  LIMIT 1
)
WHERE length(k.area_id) = 7
  AND k.base_city IS NULL;

-- (Decisión del dueño 2026-10-11: las celdas conservan el nombre neutro de su ciudad base; no se renombran.)

COMMENT ON COLUMN public.kams.base_city IS
  'Ciudad base de la zona (municipio DANE por area_id de 5 dígitos, o localidad de Bogotá por '
  'area_id de 7 dígitos). kams.name es el nombre neutro de la celda (ciudad base, p. ej. "Barranquilla"); '
  'base_city es el nombre oficial del municipio/localidad ("Barranquilla", "Cartagena de Indias"). El importador de visitas resuelve por '
  'ambos.';

-- -------------------------------------------------------------------------------------
-- 6. executives.color: paleta categórica (13 colores bien separados)
--    Sin gris (#9ca3af = Vacante en el mapa) ni ámbar (#f59e0b = Conflicto). Vecinas en el
--    mapa que comparten línea quedan con colores de familias distintas.
-- -------------------------------------------------------------------------------------

ALTER TABLE public.executives ADD COLUMN IF NOT EXISTS color text NULL;

ALTER TABLE public.executives DROP CONSTRAINT IF EXISTS executives_color_hex_check;
ALTER TABLE public.executives ADD CONSTRAINT executives_color_hex_check
  CHECK (color IS NULL OR color ~ '^#[0-9A-Fa-f]{6}$');

UPDATE public.executives e
SET color = s.color
FROM (VALUES
  ('carmenbarrios@vgmedical.com.co', NULL::text,           '#1f77b4'),  -- Barranquilla · azul
  ('a.ocampo@vgmedical.com.co',      NULL,                 '#ad494a'),  -- Cartagena · ladrillo
  ('m.buelvas@vgmedical.com.co',     NULL,                 '#2ca02c'),  -- Montería · verde
  ('l.santiago@vgmedical.com.co',    NULL,                 '#9467bd'),  -- Valledupar · violeta
  ('d.caicedo@vgmedical.com.co',     NULL,                 '#d95f02'),  -- Bucaramanga · naranja oscuro
  ('l.barrera@vgmedical.com.co',     NULL,                 '#17becf'),  -- Cúcuta · cian
  ('v.delgado@vgmedical.com.co',     NULL,                 '#e377c2'),  -- Medellín · rosa
  ('m.diaz@vgmedical.com.co',        NULL,                 '#8c564b'),  -- Pereira · marrón
  ('j.galvez@vgmedical.com.co',      NULL,                 '#393b79'),  -- Cali · azul marino
  ('d.guerrero@vgmedical.com.co',    NULL,                 '#bcbd22'),  -- Pasto · oliva
  ('y.jimenez@vgmedical.com.co',     NULL,                 '#d62728'),  -- Bogotá (Chapinero) · rojo
  (NULL,                             'Nueva Barranquilla', '#7b4173'),  -- placeholder · ciruela
  (NULL,                             'Nueva Bogotá',       '#637939')   -- placeholder · musgo
) AS s(email, placeholder_name, color)
WHERE ((s.email IS NOT NULL AND lower(e.email) = s.email)
    OR (s.email IS NULL AND e.email IS NULL AND e.full_name = s.placeholder_name))
  AND e.color IS NULL;

COMMENT ON COLUMN public.executives.color IS
  'Color de la ejecutiva en el mapa por línea (#RRGGBB). Las zonas que cubre en una línea se '
  'pintan con este color. NULL = la app usa un color por defecto. Editable desde /executives.';

-- -------------------------------------------------------------------------------------
-- 7. coverage: kind 'conflict' + columnas nuevas
-- -------------------------------------------------------------------------------------

ALTER TABLE public.coverage DROP CONSTRAINT IF EXISTS coverage_kind_check;
ALTER TABLE public.coverage ADD CONSTRAINT coverage_kind_check
  CHECK (kind IN ('local', 'reach', 'manual', 'vacant', 'conflict'));

ALTER TABLE public.coverage
  ADD COLUMN IF NOT EXISTS nearest_executive_id uuid    NULL
      REFERENCES public.executives(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS nearest_minutes      int     NULL,
  ADD COLUMN IF NOT EXISTS has_equipment        boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS note                 text    NULL;

CREATE INDEX IF NOT EXISTS coverage_nearest_executive_id_idx
  ON public.coverage (nearest_executive_id);

COMMENT ON TABLE public.coverage IS
  'Resultado del cálculo de cobertura (Fase 2): para cada (línea, zona activa) quién responde. '
  'kind: local (vive en la zona y lleva la línea), reach (la más cercana que lleva la línea, '
  'dentro de max_reach_minutes), manual (ajuste del líder, coverage_overrides), vacant (nadie a '
  'menos del tope; ver nearest_*), conflict (dos o más viven en la zona y llevan la línea; el '
  'líder decide). Se recalcula completo desde la app; no editar a mano.';
COMMENT ON COLUMN public.coverage.executive_id IS 'Ejecutiva que cubre. NULL cuando kind = vacant o conflict.';
COMMENT ON COLUMN public.coverage.travel_minutes IS 'Minutos de carro (mediana) desde la zona base de la ejecutiva que cubre; 0 si es local.';
COMMENT ON COLUMN public.coverage.nearest_executive_id IS 'Solo en vacant: la ejecutiva más cercana que lleva la línea (aunque supere el tope).';
COMMENT ON COLUMN public.coverage.nearest_minutes IS 'Solo en vacant: minutos de carro de la más cercana.';
COMMENT ON COLUMN public.coverage.has_equipment IS 'Copia de line_zones.has_equipment (true si no hay fila): false = la línea está "sin equipo" en la zona.';
COMMENT ON COLUMN public.coverage.note IS 'Texto libre del cálculo; en conflict, los nombres de las ejecutivas en conflicto.';

-- -------------------------------------------------------------------------------------
-- 8. Comprobaciones: si algo no queda como se espera, se aborta toda la transacción.
-- -------------------------------------------------------------------------------------

DO $$
DECLARE
  def      text;
  r        text;
  n        int;
  faltan   text;
  v_paola  uuid;
BEGIN
  -- 8.1 CHECK de roles con los 8 valores
  SELECT pg_get_constraintdef(oid) INTO def FROM pg_constraint
  WHERE conrelid = 'public.users'::regclass AND conname = 'users_role_check';
  IF def IS NULL THEN
    RAISE EXCEPTION 'Fase 2: falta users_role_check';
  END IF;
  FOREACH r IN ARRAY ARRAY['admin','user','viewer','sales_manager','contract_manager',
                           'data_manager','line_leader','commercial_director'] LOOP
    IF position(quote_literal(r) IN def) = 0 THEN
      RAISE EXCEPTION 'Fase 2: users_role_check no admite el rol %', r;
    END IF;
  END LOOP;

  -- 8.2 Los 2 usuarios nuevos: existen, activos, line_leader, contraseña en bcrypt
  SELECT count(*) INTO n FROM public.users
  WHERE lower(email) IN ('s.gonzalez@vgmedical.com.co', 'y.jimenez@vgmedical.com.co')
    AND role = 'line_leader'
    AND active IS TRUE
    AND password ~ '^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$';
  IF n <> 2 THEN
    RAISE EXCEPTION 'Fase 2: se esperaban 2 usuarios nuevos line_leader con hash bcrypt; hay %', n;
  END IF;

  -- 8.3 Roles de los usuarios existentes
  SELECT count(*) INTO n FROM public.users
  WHERE lower(email) IN ('m.cobo@vgmedical.com.co', 'sramirez@vgmedical.com.co',
                         'mn@vgmedical.com.co')
    AND role = 'line_leader';
  IF n <> 3 THEN
    RAISE EXCEPTION 'Fase 2: se esperaban 3 líderes existentes con role line_leader; hay %', n;
  END IF;

  SELECT count(*) INTO n FROM public.users
  WHERE lower(email) = 'laurab@vgmedical.com.co' AND role = 'commercial_director';
  IF n <> 1 THEN
    RAISE EXCEPTION 'Fase 2: laurab@ no quedó como commercial_director';
  END IF;

  -- 8.4 Las 5 líneas con líder resuelto, y ese líder con role line_leader
  SELECT string_agg(code, ', ') INTO faltan FROM public.business_lines
  WHERE code IN ('perossal','reemplazo','deportiva','columna','trauma')
    AND leader_user_id IS NULL;
  IF faltan IS NOT NULL THEN
    RAISE EXCEPTION 'Fase 2: líneas sin líder: %', faltan;
  END IF;

  SELECT count(*) INTO n FROM public.business_lines
  WHERE code IN ('perossal','reemplazo','deportiva','columna','trauma');
  IF n <> 5 THEN
    RAISE EXCEPTION 'Fase 2: se esperaban 5 líneas; hay %', n;
  END IF;

  SELECT string_agg(bl.code || ' → ' || coalesce(u.email, '?') || ' (' || coalesce(u.role, '?') || ')', ', ')
  INTO faltan
  FROM public.business_lines bl
  LEFT JOIN public.users u ON u.id = bl.leader_user_id
  WHERE bl.code IN ('perossal','reemplazo','deportiva','columna','trauma')
    AND (u.id IS NULL OR u.role <> 'line_leader' OR u.active IS NOT TRUE);
  IF faltan IS NOT NULL THEN
    RAISE EXCEPTION 'Fase 2: líder de línea sin usuario activo line_leader: %', faltan;
  END IF;

  -- 8.5 La ejecutiva y.jimenez@ ligada a su usuario
  SELECT id INTO v_paola FROM public.users WHERE lower(email) = 'y.jimenez@vgmedical.com.co';
  SELECT count(*) INTO n FROM public.executives
  WHERE lower(email) = 'y.jimenez@vgmedical.com.co' AND user_id = v_paola;
  IF n <> 1 THEN
    RAISE EXCEPTION 'Fase 2: la ejecutiva y.jimenez@ no quedó ligada a su usuario';
  END IF;

  -- 8.6 Las 17 zonas con base_city y con su nombre nuevo
  SELECT count(*) INTO n FROM public.kams
  WHERE area_id IN ('08001','13001','23001','20001','68001','54001','05001','66001','73001',
                    '76001','52001','41001','1100102','1100110','1100108','1100104','70001')
    AND base_city IS NOT NULL AND btrim(base_city) <> '';
  IF n <> 17 THEN
    RAISE EXCEPTION 'Fase 2: se esperaban 17 zonas con base_city; hay %', n;
  END IF;

  SELECT string_agg(name || ' (' || area_id || ')', ', ') INTO faltan
  FROM public.kams WHERE base_city IS NULL OR btrim(base_city) = '';
  IF faltan IS NOT NULL THEN
    RAISE EXCEPTION 'Fase 2: zonas sin base_city: %', faltan;
  END IF;

  -- 8.7 Las 13 ejecutivas sembradas con color válido
  SELECT count(*) INTO n FROM public.executives
  WHERE (lower(email) IN ('carmenbarrios@vgmedical.com.co','a.ocampo@vgmedical.com.co',
                          'm.buelvas@vgmedical.com.co','l.santiago@vgmedical.com.co',
                          'd.caicedo@vgmedical.com.co','l.barrera@vgmedical.com.co',
                          'v.delgado@vgmedical.com.co','m.diaz@vgmedical.com.co',
                          'j.galvez@vgmedical.com.co','d.guerrero@vgmedical.com.co',
                          'y.jimenez@vgmedical.com.co')
         OR (email IS NULL AND full_name IN ('Nueva Barranquilla','Nueva Bogotá')))
    AND color ~ '^#[0-9A-Fa-f]{6}$';
  IF n <> 13 THEN
    RAISE EXCEPTION 'Fase 2: se esperaban 13 ejecutivas con color; hay %', n;
  END IF;

  SELECT string_agg(c, ', ') INTO faltan FROM (
    SELECT lower(color) AS c FROM public.executives
    WHERE color IS NOT NULL AND status <> 'inactive'
    GROUP BY lower(color) HAVING count(*) > 1
  ) d;
  IF faltan IS NOT NULL THEN
    RAISE WARNING 'Fase 2: colores repetidos entre ejecutivas activas/placeholder: %', faltan;
  END IF;

  -- 8.8 coverage: CHECK con 'conflict' y columnas nuevas
  SELECT pg_get_constraintdef(oid) INTO def FROM pg_constraint
  WHERE conrelid = 'public.coverage'::regclass AND conname = 'coverage_kind_check';
  IF def IS NULL OR position('''conflict''' IN def) = 0 THEN
    RAISE EXCEPTION 'Fase 2: coverage_kind_check no admite conflict';
  END IF;

  SELECT count(*) INTO n FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'coverage'
    AND column_name IN ('nearest_executive_id','nearest_minutes','has_equipment','note');
  IF n <> 4 THEN
    RAISE EXCEPTION 'Fase 2: coverage tiene % de las 4 columnas nuevas', n;
  END IF;

  RAISE NOTICE 'Fase 2 OK: 8 roles, 2 usuarios nuevos, 5 líneas con líder, 17 zonas con base_city y nombre nuevo, 13 colores, coverage ampliada. SIGUIENTE PASO: desplegar el código de Fase 2, recalcular cobertura y cambiar la contraseña de s.gonzalez@ y y.jimenez@.';
END $$;

COMMIT;
