-- =====================================================================================
-- OpMap · Fase 2 (cobertura por línea) · 9910 — Rollback de 0400
-- Proyecto: norvxqgohddgsdkggqzq · Generado: 2026-10-11 · NO EJECUTADO TODAVÍA
--
-- ANTES DE EJECUTAR: volver a desplegar el código anterior a la Fase 2. El código de Fase 2
--   consulta kams.base_city, executives.color, coverage.nearest_* / has_equipment / note y los
--   roles line_leader / commercial_director; tras este rollback esas consultas fallarían.
--
-- Qué deshace (una sola transacción, todo o nada):
--   1. coverage: borra TODAS las filas (es un resultado recalculable; con el código anterior
--      no se usa), quita las 4 columnas nuevas y deja el CHECK de kind con los 4 valores de
--      Fase 1 (sin 'conflict').
--   2. executives: quita el CHECK y la columna color (se pierden los colores editados).
--   3. kams: devuelve los nombres que tenían el 2026-10-10 (foto con SELECT, por area_id) y
--      quita la columna base_city. Si después de 0400 se renombró alguna zona desde la app,
--      ese cambio también se pierde.
--   4. Desliga a los 2 usuarios nuevos: business_lines.leader_user_id → NULL (deportiva,
--      trauma u otra línea que lideren) y executives.user_id → NULL.
--   5. Roles: TODO usuario con role line_leader o commercial_director pasa a sales_manager (el
--      rol que tenían m.cobo@, sramirez@, mn@ y laurab@ antes de 0400; si desde la app se dio
--      uno de esos roles a otra persona, también queda como sales_manager: revisar en /users).
--      Los 2 usuarios nuevos (s.gonzalez@, y.jimenez@) se BORRAN si nada los referencia; si ya
--      tienen datos ligados (comentarios, ajustes de cobertura, historial…), no se borran: se
--      desactivan (active = false) y quedan como viewer.
--   6. users.role: el CHECK vuelve a los 6 roles de antes.
--
-- coverage_overrides NO se toca (es de Fase 1). Si contiene ajustes creados por los usuarios
--   nuevos, esos usuarios quedarán desactivados en lugar de borrados (ver punto 5).
--
-- Re-ejecutable: sí (IF EXISTS / UPDATE idempotentes).
-- =====================================================================================

BEGIN;

-- -------------------------------------------------------------------------------------
-- 1. coverage
-- -------------------------------------------------------------------------------------

DELETE FROM public.coverage;

DROP INDEX IF EXISTS public.coverage_nearest_executive_id_idx;

ALTER TABLE public.coverage
  DROP COLUMN IF EXISTS nearest_executive_id,
  DROP COLUMN IF EXISTS nearest_minutes,
  DROP COLUMN IF EXISTS has_equipment,
  DROP COLUMN IF EXISTS note;

ALTER TABLE public.coverage DROP CONSTRAINT IF EXISTS coverage_kind_check;
ALTER TABLE public.coverage ADD CONSTRAINT coverage_kind_check
  CHECK (kind IN ('local', 'reach', 'manual', 'vacant'));

-- Comentarios tal como los dejó la Fase 1 (0100).
COMMENT ON TABLE public.coverage IS
  'Resultado del cálculo de cobertura (Fase 2): para cada (línea, zona) quién responde. '
  'kind: local (vive en la zona y lleva la línea), reach (la más cercana que lleva la línea, '
  'dentro de max_reach_minutes), manual (ajuste del líder), vacant (nadie a menos del tope). '
  'Se recalcula completo; no editar a mano (usar coverage_overrides).';
COMMENT ON COLUMN public.coverage.executive_id IS 'Ejecutiva que cubre. NULL cuando kind = vacant.';
COMMENT ON COLUMN public.coverage.travel_minutes IS 'Minutos de carro desde la zona base de la ejecutiva (o de la más cercana, si es vacante).';

-- -------------------------------------------------------------------------------------
-- 2. executives.color
-- -------------------------------------------------------------------------------------

ALTER TABLE public.executives DROP CONSTRAINT IF EXISTS executives_color_hex_check;
ALTER TABLE public.executives DROP COLUMN IF EXISTS color;

-- -------------------------------------------------------------------------------------
-- 3. kams: nombres del 2026-10-10 y fuera base_city
-- -------------------------------------------------------------------------------------

UPDATE public.kams k
SET name = s.name
FROM (VALUES
  ('05001',   'Medellín'),
  ('08001',   'Barranquilla'),
  ('1100102', 'Chapinero'),
  ('1100104', 'San Cristóbal'),
  ('1100108', 'Kennedy'),
  ('1100110', 'Engativá'),
  ('13001',   'Cartagena'),
  ('20001',   'Valledupar'),
  ('23001',   'Montería'),
  ('41001',   'Neiva'),
  ('52001',   'Pasto'),
  ('54001',   'Cúcuta'),
  ('66001',   'Pereira'),
  ('68001',   'Bucaramanga'),
  ('70001',   'Sincelejo'),
  ('73001',   'Ibagué'),
  ('76001',   'Cali')
) AS s(area_id, name)
WHERE k.area_id = s.area_id
  AND k.name IS DISTINCT FROM s.name;

ALTER TABLE public.kams DROP COLUMN IF EXISTS base_city;

-- -------------------------------------------------------------------------------------
-- 4. Desligar a los usuarios nuevos de líneas y ejecutivas
-- -------------------------------------------------------------------------------------

UPDATE public.business_lines bl
SET leader_user_id = NULL
FROM public.users u
WHERE u.id = bl.leader_user_id
  AND lower(u.email) IN ('s.gonzalez@vgmedical.com.co', 'y.jimenez@vgmedical.com.co');

UPDATE public.executives e
SET user_id = NULL
FROM public.users u
WHERE u.id = e.user_id
  AND lower(u.email) IN ('s.gonzalez@vgmedical.com.co', 'y.jimenez@vgmedical.com.co');

-- -------------------------------------------------------------------------------------
-- 5. Usuarios nuevos (borrar o desactivar) y roles
-- -------------------------------------------------------------------------------------

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT id, email FROM public.users
    WHERE lower(email) IN ('s.gonzalez@vgmedical.com.co', 'y.jimenez@vgmedical.com.co')
  LOOP
    BEGIN
      DELETE FROM public.users WHERE id = r.id;
      RAISE NOTICE 'Rollback Fase 2: usuario % borrado', r.email;
    EXCEPTION WHEN foreign_key_violation THEN
      UPDATE public.users SET active = false, role = 'viewer' WHERE id = r.id;
      RAISE NOTICE 'Rollback Fase 2: usuario % tiene datos ligados; queda desactivado (viewer)', r.email;
    END;
  END LOOP;
END $$;

UPDATE public.users
SET role = 'sales_manager'
WHERE role IN ('line_leader', 'commercial_director');

-- -------------------------------------------------------------------------------------
-- 6. users.role: los 6 roles de antes
-- -------------------------------------------------------------------------------------

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check CHECK (role IN (
  'admin', 'user', 'viewer', 'sales_manager', 'contract_manager', 'data_manager'
));

COMMENT ON COLUMN public.users.role IS NULL;

-- -------------------------------------------------------------------------------------
-- 7. Comprobaciones
-- -------------------------------------------------------------------------------------

DO $$
DECLARE
  n int;
BEGIN
  SELECT count(*) INTO n FROM information_schema.columns
  WHERE table_schema = 'public'
    AND ((table_name = 'kams'       AND column_name = 'base_city')
      OR (table_name = 'executives' AND column_name = 'color')
      OR (table_name = 'coverage'   AND column_name IN ('nearest_executive_id','nearest_minutes',
                                                        'has_equipment','note')));
  IF n <> 0 THEN
    RAISE EXCEPTION 'Rollback Fase 2: quedan % columna(s) de 0400', n;
  END IF;

  SELECT count(*) INTO n FROM public.users WHERE role IN ('line_leader', 'commercial_director');
  IF n <> 0 THEN
    RAISE EXCEPTION 'Rollback Fase 2: quedan % usuario(s) con roles de Fase 2', n;
  END IF;

  SELECT count(*) INTO n FROM public.users
  WHERE lower(email) IN ('m.cobo@vgmedical.com.co', 'sramirez@vgmedical.com.co',
                         'mn@vgmedical.com.co', 'laurab@vgmedical.com.co')
    AND role = 'sales_manager';
  IF n <> 4 THEN
    RAISE EXCEPTION 'Rollback Fase 2: se esperaban 4 usuarios devueltos a sales_manager; hay %', n;
  END IF;

  SELECT count(*) INTO n FROM public.kams k
  JOIN (VALUES
    ('05001','Medellín'), ('08001','Barranquilla'), ('1100102','Chapinero'),
    ('1100104','San Cristóbal'), ('1100108','Kennedy'), ('1100110','Engativá'),
    ('13001','Cartagena'), ('20001','Valledupar'), ('23001','Montería'), ('41001','Neiva'),
    ('52001','Pasto'), ('54001','Cúcuta'), ('66001','Pereira'), ('68001','Bucaramanga'),
    ('70001','Sincelejo'), ('73001','Ibagué'), ('76001','Cali')
  ) AS s(area_id, name) ON s.area_id = k.area_id AND s.name = k.name;
  IF n <> 17 THEN
    RAISE EXCEPTION 'Rollback Fase 2: se esperaban 17 zonas con su nombre anterior; hay %', n;
  END IF;

  RAISE NOTICE 'Rollback Fase 2 OK. Las líneas deportiva y trauma vuelven a quedar sin líder.';
END $$;

COMMIT;
