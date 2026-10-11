-- =====================================================================================
-- OpMap · Fase 1 (zonas y equipo) · 0200 — Datos iniciales: líneas, ejecutivas, matriz
-- Proyecto: norvxqgohddgsdkggqzq · Generado: 2026-10-10 · NO EJECUTADO TODAVÍA
--
-- Requiere: 2026-10-10_0100_fase1_schema.sql ya aplicado.
-- Puede ejecutarse antes o después de 0300: Cartagena (13001) e Ibagué (73001) se incluyen
--   explícitamente en line_zones aunque hoy estén inactivas.
--
-- Qué carga:
--   1. 5 líneas (business_lines), con líder resuelto por users.email.
--   2. 11 ejecutivas con correo + 2 placeholders ("Nueva Barranquilla", "Nueva Bogotá").
--      Zona base resuelta por kams.area_id; user_id = users.id si existe un usuario con ese
--      correo (si no, NULL); odoo_employee_id = hr.employee.id de Odoo.
--   3. executive_lines según la asignación de líneas del 5 de octubre (por negociar entre
--      líderes; se edita desde la app).
--   4. line_zones: todas las líneas × todas las zonas activas (+ Cartagena e Ibagué) con
--      has_equipment = true. Las líderes desmarcan después.
--
-- Resolución de zonas por area_id: HOY hay dos area_id con dos filas en kams
--   (08001: "KAM Barranquilla" y "KAM Barranquilla MD"; 20001: "KAM Valledupar" y
--   "Kam Valledupar MD"). La función temporal fase1_zona() descarta las filas cuyo nombre
--   termina en " MD" (0300 las borra) y exige exactamente una coincidencia; si no, aborta.
--
-- Comprobado con SELECT el 2026-10-10:
--   - kams: existen y son únicos (sin MD) los area_id 05001, 08001, 1100102, 13001, 20001,
--     23001, 52001, 54001, 66001, 68001, 73001, 76001.
--   - users: existen m.cobo@, sramirez@, mn@ (líderes) y carmenbarrios@, m.buelvas@
--     (ejecutivas). No existen en users: a.ocampo@, l.santiago@, d.caicedo@, l.barrera@,
--     v.delgado@, m.diaz@, j.galvez@, d.guerrero@, y.jimenez@ → user_id NULL (se liga
--     cuando se les cree usuario).
--
-- Re-ejecución (idempotente):
--   - business_lines ON CONFLICT (code): actualiza name y sort_order; leader_user_id solo se
--     rellena si está NULL (no pisa cambios hechos desde la app); max_reach_minutes y active
--     no se tocan.
--   - executives ON CONFLICT (email): actualiza full_name, company, odoo_employee_id y
--     base_kam_id; user_id y notes solo se rellenan si están NULL; status, started_at y
--     left_at no se tocan (una ejecutiva inactivada sigue inactiva).
--   - Placeholders: se insertan solo si no existe una ejecutiva con ese full_name. OJO: si
--     al contratar se renombra el placeholder (lo recomendado), volver a correr este archivo
--     crearía otro "Nueva …". No re-ejecutar después de empezar a editar desde la app.
--   - executive_lines y line_zones: ON CONFLICT DO NOTHING (solo añaden; nunca quitan lo que
--     se haya desmarcado o retirado).
--
-- Transaccional: todo o nada. Rollback: 9900 (sección A borra las tablas y con ellas estos datos).
-- =====================================================================================

BEGIN;

-- -------------------------------------------------------------------------------------
-- 0. Ayudante temporal (vive solo en esta sesión): zona por area_id, sin las filas "MD".
-- -------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION pg_temp.fase1_zona(p_area_id text)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_ids uuid[];
BEGIN
  SELECT array_agg(k.id) INTO v_ids
  FROM public.kams k
  WHERE k.area_id = p_area_id
    AND k.name !~* '\sMD$';

  IF v_ids IS NULL OR array_length(v_ids, 1) <> 1 THEN
    RAISE EXCEPTION 'Fase 1: area_id % debe corresponder a exactamente una zona (sin MD); encontradas: %',
      p_area_id, coalesce(array_length(v_ids, 1), 0);
  END IF;

  RETURN v_ids[1];
END;
$$;

-- -------------------------------------------------------------------------------------
-- 1. Líneas de negocio
-- -------------------------------------------------------------------------------------

INSERT INTO public.business_lines AS bl (code, name, leader_user_id, max_reach_minutes, sort_order)
SELECT s.code, s.name,
       (SELECT u.id FROM public.users u WHERE lower(u.email) = lower(s.leader_email)),
       240, s.sort_order
FROM (VALUES
  ('perossal',  'PerOssal',            'm.cobo@vgmedical.com.co',   1),
  ('reemplazo', 'Reemplazo articular', 'sramirez@vgmedical.com.co', 2),
  ('deportiva', 'Medicina deportiva',  NULL,                        3),
  ('columna',   'Columna',             'mn@vgmedical.com.co',       4),
  ('trauma',    'Trauma',              NULL,                        5)
) AS s(code, name, leader_email, sort_order)
ON CONFLICT (code) DO UPDATE
  SET name           = EXCLUDED.name,
      sort_order     = EXCLUDED.sort_order,
      leader_user_id = COALESCE(bl.leader_user_id, EXCLUDED.leader_user_id);

-- -------------------------------------------------------------------------------------
-- 2. Ejecutivas con correo
-- -------------------------------------------------------------------------------------

INSERT INTO public.executives AS ex (full_name, email, company, base_kam_id, odoo_employee_id,
                                     status, user_id, notes)
SELECT s.full_name, s.email, 'VG Medical', pg_temp.fase1_zona(s.area_id), s.odoo_id,
       'active',
       (SELECT u.id FROM public.users u WHERE lower(u.email) = lower(s.email)),
       s.notes
FROM (VALUES
  ('Carmen Edith Barrios Barrios',      'carmenbarrios@vgmedical.com.co', '08001',    20, NULL),
  ('Alexa Maryoli Ocampo Padilla',      'a.ocampo@vgmedical.com.co',      '13001',    71, NULL),
  ('Mileydis Amparo Buelvas Castellar', 'm.buelvas@vgmedical.com.co',     '23001',    78, NULL),
  ('Leyda Santiago Salcedo',            'l.santiago@vgmedical.com.co',    '20001',   141, NULL),
  ('Diana Carolina Caicedo Ramírez',    'd.caicedo@vgmedical.com.co',     '68001',   128, NULL),
  ('Linda Valentina Barrera Andrade',   'l.barrera@vgmedical.com.co',     '54001',    52,
     'Odoo la ubica en Barranquilla como Analista Comercial; confirmar'),
  ('Surley Viviana Delgado Franco',     'v.delgado@vgmedical.com.co',     '05001',   133, NULL),
  ('María Isabel Díaz Ahumada',         'm.diaz@vgmedical.com.co',        '66001',   125, NULL),
  ('Joana Andrea Gálvez Ortiz',         'j.galvez@vgmedical.com.co',      '76001',   106, NULL),
  ('Diana Cecilia Guerrero Bastidas',   'd.guerrero@vgmedical.com.co',    '52001',   102, NULL),
  ('Yineth Paola Jiménez Escobar',      'y.jimenez@vgmedical.com.co',     '1100102', 122,
     'Localidad base por confirmar; Chapinero por defecto')
) AS s(full_name, email, area_id, odoo_id, notes)
ON CONFLICT (email) DO UPDATE
  SET full_name        = EXCLUDED.full_name,
      company          = EXCLUDED.company,
      base_kam_id      = EXCLUDED.base_kam_id,
      odoo_employee_id = EXCLUDED.odoo_employee_id,
      user_id          = COALESCE(ex.user_id, EXCLUDED.user_id),
      notes            = COALESCE(ex.notes, EXCLUDED.notes);

-- -------------------------------------------------------------------------------------
-- 3. Placeholders (sin correo: no hay UNIQUE que sirva, se usa IF NOT EXISTS por full_name)
-- -------------------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.executives WHERE full_name = 'Nueva Barranquilla') THEN
    INSERT INTO public.executives (full_name, email, company, base_kam_id, status, notes)
    VALUES ('Nueva Barranquilla', NULL, 'VG Medical', pg_temp.fase1_zona('08001'),
            'placeholder', 'Vacante por contratar (asignación de líneas del 5 de octubre)');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.executives WHERE full_name = 'Nueva Bogotá') THEN
    INSERT INTO public.executives (full_name, email, company, base_kam_id, status, notes)
    VALUES ('Nueva Bogotá', NULL, 'VG Medical', pg_temp.fase1_zona('1100102'),
            'placeholder', 'Vacante por contratar (asignación de líneas del 5 de octubre)');
  END IF;
END $$;

-- -------------------------------------------------------------------------------------
-- 4. Líneas por ejecutiva (asignación del 5 de octubre)
--    Se identifica a la ejecutiva por correo o, en los placeholders, por full_name.
-- -------------------------------------------------------------------------------------

INSERT INTO public.executive_lines (executive_id, line_id)
SELECT e.id, l.id
FROM (VALUES
  ('carmenbarrios@vgmedical.com.co', NULL::text, 'perossal'),
  ('carmenbarrios@vgmedical.com.co', NULL,       'reemplazo'),
  ('a.ocampo@vgmedical.com.co',      NULL,       'perossal'),
  ('a.ocampo@vgmedical.com.co',      NULL,       'reemplazo'),
  ('m.buelvas@vgmedical.com.co',     NULL,       'perossal'),
  ('m.buelvas@vgmedical.com.co',     NULL,       'deportiva'),
  ('m.buelvas@vgmedical.com.co',     NULL,       'columna'),
  ('l.santiago@vgmedical.com.co',    NULL,       'perossal'),
  ('l.santiago@vgmedical.com.co',    NULL,       'reemplazo'),
  ('d.caicedo@vgmedical.com.co',     NULL,       'reemplazo'),
  ('d.caicedo@vgmedical.com.co',     NULL,       'deportiva'),
  ('d.caicedo@vgmedical.com.co',     NULL,       'columna'),
  ('l.barrera@vgmedical.com.co',     NULL,       'perossal'),
  ('v.delgado@vgmedical.com.co',     NULL,       'perossal'),
  ('v.delgado@vgmedical.com.co',     NULL,       'reemplazo'),
  ('m.diaz@vgmedical.com.co',        NULL,       'perossal'),
  ('j.galvez@vgmedical.com.co',      NULL,       'perossal'),
  ('j.galvez@vgmedical.com.co',      NULL,       'deportiva'),
  ('j.galvez@vgmedical.com.co',      NULL,       'columna'),
  ('d.guerrero@vgmedical.com.co',    NULL,       'perossal'),
  ('d.guerrero@vgmedical.com.co',    NULL,       'deportiva'),
  ('y.jimenez@vgmedical.com.co',     NULL,       'perossal'),
  (NULL, 'Nueva Barranquilla', 'deportiva'),
  (NULL, 'Nueva Barranquilla', 'columna'),
  (NULL, 'Nueva Bogotá',       'reemplazo'),
  (NULL, 'Nueva Bogotá',       'deportiva'),
  (NULL, 'Nueva Bogotá',       'columna')
) AS s(email, placeholder_name, line_code)
JOIN public.executives e
  ON (s.email IS NOT NULL AND e.email = s.email)
  OR (s.email IS NULL AND e.email IS NULL AND e.full_name = s.placeholder_name)
JOIN public.business_lines l ON l.code = s.line_code
ON CONFLICT (executive_id, line_id) DO NOTHING;

-- -------------------------------------------------------------------------------------
-- 5. Matriz línea × zona: todas las zonas activas + Cartagena e Ibagué (explícitas, aunque
--    hoy estén inactivas), con equipo. Nunca las filas "MD" (inactivas; 0300 las borra).
-- -------------------------------------------------------------------------------------

INSERT INTO public.line_zones (line_id, kam_id, has_equipment)
SELECT l.id, k.id, true
FROM public.business_lines l
CROSS JOIN public.kams k
WHERE (k.active IS TRUE OR k.area_id IN ('13001', '73001'))
  AND k.name !~* '\sMD$'
ON CONFLICT (line_id, kam_id) DO NOTHING;

-- -------------------------------------------------------------------------------------
-- 6. Comprobaciones (aborta todo si algo no cuadra)
-- -------------------------------------------------------------------------------------

DO $$
DECLARE
  n           int;
  n_zonas     int;
  faltan      text;
BEGIN
  SELECT count(*) INTO n FROM public.business_lines
  WHERE code IN ('perossal','reemplazo','deportiva','columna','trauma');
  IF n <> 5 THEN
    RAISE EXCEPTION 'Fase 1: se esperaban 5 líneas, hay %', n;
  END IF;

  SELECT string_agg(code, ', ') INTO faltan FROM public.business_lines
  WHERE code IN ('perossal','reemplazo','columna') AND leader_user_id IS NULL;
  IF faltan IS NOT NULL THEN
    RAISE EXCEPTION 'Fase 1: líneas sin líder resuelto (el correo no está en users): %', faltan;
  END IF;

  SELECT count(*) INTO n FROM public.executives
  WHERE email IN ('carmenbarrios@vgmedical.com.co','a.ocampo@vgmedical.com.co',
                  'm.buelvas@vgmedical.com.co','l.santiago@vgmedical.com.co',
                  'd.caicedo@vgmedical.com.co','l.barrera@vgmedical.com.co',
                  'v.delgado@vgmedical.com.co','m.diaz@vgmedical.com.co',
                  'j.galvez@vgmedical.com.co','d.guerrero@vgmedical.com.co',
                  'y.jimenez@vgmedical.com.co')
     OR (email IS NULL AND full_name IN ('Nueva Barranquilla','Nueva Bogotá'));
  IF n <> 13 THEN
    RAISE EXCEPTION 'Fase 1: se esperaban 13 ejecutivas sembradas, hay %', n;
  END IF;

  SELECT count(*) INTO n FROM public.executives WHERE base_kam_id IS NULL AND status <> 'inactive';
  IF n > 0 THEN
    RAISE EXCEPTION 'Fase 1: % ejecutiva(s) activa(s)/placeholder sin zona base', n;
  END IF;

  SELECT count(*) INTO n
  FROM public.executive_lines el
  JOIN public.executives e ON e.id = el.executive_id
  WHERE e.email IS NOT NULL OR e.full_name IN ('Nueva Barranquilla','Nueva Bogotá');
  IF n < 27 THEN
    RAISE EXCEPTION 'Fase 1: se esperaban al menos 27 filas en executive_lines, hay %', n;
  END IF;

  SELECT count(*) INTO n_zonas FROM public.kams k
  WHERE (k.active IS TRUE OR k.area_id IN ('13001','73001')) AND k.name !~* '\sMD$';
  SELECT count(*) INTO n FROM public.line_zones lz
  JOIN public.kams k ON k.id = lz.kam_id
  WHERE (k.active IS TRUE OR k.area_id IN ('13001','73001')) AND k.name !~* '\sMD$';
  IF n < 5 * n_zonas THEN
    RAISE EXCEPTION 'Fase 1: line_zones incompleta: % filas para % zonas × 5 líneas', n, n_zonas;
  END IF;

  RAISE NOTICE 'Fase 1 seed OK: 5 líneas, 13 ejecutivas, % zonas en la matriz (% filas)', n_zonas, n;
END $$;

COMMIT;
