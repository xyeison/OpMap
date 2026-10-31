-- =====================================================================================
-- OpMap · feat/empresas-papeles-asignaciones · 9961 — Rollback de 0960 (empresas, papeles, asignaciones)
-- Proyecto: norvxqgohddgsdkggqzq · Generado: 2026-10-31 · ESTADO: NO APLICADA (se aplica solo con autorización del dueño)
-- Spec: docs/specs/2026-10-31-empresas-papeles-y-asignaciones.md · Migración: 2026-10-31_0960_empresas_papeles_asignaciones.sql
--
-- Qué hace (el inverso exacto de la 0960):
--   1. Avisa cuántas filas se pierden: papeles (y sus Zonas), asignaciones, linea_empresas, executive_empresas y
--      odoo_enlaces, y cuántas personas tenían empresa activa.
--   2. Se DETIENE si hay visitas, citas, visitantes, ajustes de cobertura o anexos de otra empresa que no sea VG: al
--      quitar empresa_id quedarían como de VG (y los anexos son inmutables, no se pueden borrar). Con la capa 1 no hay
--      ninguno (todo nace VG por el DEFAULT); si los hay, primero va el rollback de la capa que los creó.
--   3. coverage: borra las filas de otra empresa (la cobertura se recalcula; avisa cuántas), quita la UNIQUE
--      (empresa_id, line_id, kam_id) y deja la UNIQUE (line_id, kam_id) de siempre (la 0960 no la quitó; si alguien la
--      quitó después, la vuelve a crear con su nombre coverage_line_id_kam_id_key).
--   4. Quita empresa_id de coverage, coverage_overrides, territory_snapshots, visits, visitas_agenda y medico_visitantes
--      y users.empresa_activa_id (quitar una columna no reescribe filas ni dispara la inmutabilidad de los anexos).
--   5. Borra odoo_enlaces, asignaciones, executive_empresas, papel_zonas, papeles, linea_empresas y empresas, con sus
--      disparadores y funciones.
-- NO toca users.role, business_lines.leader_user_id, executive_lines, executive_allowed_lines, executives.company ni
--   executives.odoo_employee_id: siguen siendo la verdad de antes (la capa 1 los mantiene como caché).
-- Transaccional: todo o nada. Re-ejecutable: sí (IF EXISTS; sin la 0960 solo avisa ceros). Costo Google: 0.
-- Después: NOTIFY pgrst, 'reload schema'; (va al final del archivo).
-- =====================================================================================

BEGIN;

-- -------------------------------------------------------------------------------------
-- 1. Lo que se pierde, y lo que no se puede perder sin decidirlo antes
-- -------------------------------------------------------------------------------------
DO $$
DECLARE
  v_vg      constant uuid := 'a0000000-0000-4000-8000-000000000001'::uuid;
  v_tabla   text;
  v_n       bigint;
  v_ajenas  text := '';
  v_papeles bigint := 0;
  v_zonas   bigint := 0;
  v_asig    bigint := 0;
  v_lineas  bigint := 0;
  v_execs   bigint := 0;
  v_odoo    bigint := 0;
  v_activa  bigint := 0;
BEGIN
  -- Filas de otra empresa en lo que no se recalcula: se detiene
  FOREACH v_tabla IN ARRAY ARRAY['visits', 'visitas_agenda', 'medico_visitantes', 'coverage_overrides', 'territory_snapshots']
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = 'public' AND table_name = v_tabla AND column_name = 'empresa_id') THEN
      EXECUTE format('SELECT count(*) FROM public.%I WHERE empresa_id <> $1', v_tabla) INTO v_n USING v_vg;
      IF v_n > 0 THEN
        v_ajenas := v_ajenas || format(' %s: %s;', v_tabla, v_n);
      END IF;
    END IF;
  END LOOP;
  IF v_ajenas <> '' THEN
    RAISE EXCEPTION 'Rollback 0960: hay filas de otra empresa que no es VG (%) y al quitar empresa_id quedarían como de VG', btrim(v_ajenas)
      USING HINT = 'Primero el rollback de la capa que las creó (9962/9963), o anularlas o moverlas a VG con autorización del dueño.';
  END IF;

  IF to_regclass('public.papeles') IS NOT NULL THEN
    SELECT count(*) INTO v_papeles FROM public.papeles;
  END IF;
  IF to_regclass('public.papel_zonas') IS NOT NULL THEN
    SELECT count(*) INTO v_zonas FROM public.papel_zonas;
  END IF;
  IF to_regclass('public.asignaciones') IS NOT NULL THEN
    SELECT count(*) INTO v_asig FROM public.asignaciones;
  END IF;
  IF to_regclass('public.linea_empresas') IS NOT NULL THEN
    SELECT count(*) INTO v_lineas FROM public.linea_empresas;
  END IF;
  IF to_regclass('public.executive_empresas') IS NOT NULL THEN
    SELECT count(*) INTO v_execs FROM public.executive_empresas;
  END IF;
  IF to_regclass('public.odoo_enlaces') IS NOT NULL THEN
    SELECT count(*) INTO v_odoo FROM public.odoo_enlaces;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'empresa_activa_id') THEN
    EXECUTE 'SELECT count(*) FROM public.users WHERE empresa_activa_id IS NOT NULL' INTO v_activa;
  END IF;

  RAISE NOTICE 'Rollback 0960: se pierden % fila(s) de papeles (con % Zona(s) de líder) y % fila(s) de asignaciones.', v_papeles, v_zonas, v_asig;
  RAISE NOTICE 'Rollback 0960: también % de linea_empresas, % de executive_empresas, % de odoo_enlaces y la empresa activa de % persona(s). users.role, leader_user_id y executive_lines no se tocan.', v_lineas, v_execs, v_odoo, v_activa;
END
$$;

-- -------------------------------------------------------------------------------------
-- 2. coverage: fuera lo de otra empresa y la UNIQUE por empresa; queda la de siempre
-- -------------------------------------------------------------------------------------
DO $$
DECLARE
  v_n bigint;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'coverage' AND column_name = 'empresa_id') THEN
    EXECUTE 'DELETE FROM public.coverage WHERE empresa_id <> ''a0000000-0000-4000-8000-000000000001''::uuid';
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n > 0 THEN
      RAISE NOTICE 'Rollback 0960: se borraron % fila(s) de coverage de otra empresa (se recalcula)', v_n;
    END IF;
  END IF;
END
$$;

ALTER TABLE public.coverage DROP CONSTRAINT IF EXISTS coverage_empresa_line_kam_key;

-- -------------------------------------------------------------------------------------
-- 3. Columnas empresa_id y users.empresa_activa_id
-- -------------------------------------------------------------------------------------
ALTER TABLE public.coverage            DROP COLUMN IF EXISTS empresa_id;
ALTER TABLE public.coverage_overrides  DROP COLUMN IF EXISTS empresa_id;
ALTER TABLE public.territory_snapshots DROP COLUMN IF EXISTS empresa_id;
ALTER TABLE public.visits              DROP COLUMN IF EXISTS empresa_id;
ALTER TABLE public.visitas_agenda      DROP COLUMN IF EXISTS empresa_id;
ALTER TABLE public.medico_visitantes   DROP COLUMN IF EXISTS empresa_id;
ALTER TABLE public.users               DROP COLUMN IF EXISTS empresa_activa_id;

-- La UNIQUE (line_id, kam_id) de coverage, como la creó la 0100 (si faltara; se busca por columnas, no por nombre)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c
                 WHERE c.conrelid = 'public.coverage'::regclass AND c.contype = 'u'
                   AND (SELECT array_agg(a.attname::text ORDER BY a.attname)
                        FROM unnest(c.conkey) AS k(attnum)
                        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum) = ARRAY['kam_id', 'line_id']) THEN
    ALTER TABLE public.coverage ADD CONSTRAINT coverage_line_id_kam_id_key UNIQUE (line_id, kam_id);
  END IF;
END
$$;

-- -------------------------------------------------------------------------------------
-- 4. Tablas nuevas (de la que depende de otra a la que no depende de nadie), disparadores y funciones
-- -------------------------------------------------------------------------------------
DROP TABLE IF EXISTS public.odoo_enlaces;
DROP TABLE IF EXISTS public.asignaciones;
DROP TABLE IF EXISTS public.executive_empresas;
DROP TABLE IF EXISTS public.papel_zonas;
DROP TABLE IF EXISTS public.papeles;
DROP TABLE IF EXISTS public.linea_empresas;
DROP TABLE IF EXISTS public.empresas;

DROP FUNCTION IF EXISTS public.asignaciones_coherentes_trg();
DROP FUNCTION IF EXISTS public.papeles_lider_unico_trg();
DROP FUNCTION IF EXISTS public.papeles_linea_en_empresa_trg();

-- -------------------------------------------------------------------------------------
-- 5. Comprobación
-- -------------------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.empresas') IS NOT NULL OR to_regclass('public.papeles') IS NOT NULL
     OR to_regclass('public.asignaciones') IS NOT NULL
     OR EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND column_name IN ('empresa_id', 'empresa_activa_id')
                  AND table_name IN ('coverage', 'coverage_overrides', 'territory_snapshots', 'visits', 'visitas_agenda',
                                     'medico_visitantes', 'users')) THEN
    RAISE EXCEPTION 'Rollback 0960: quedó algo de la 0960';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c
                 WHERE c.conrelid = 'public.coverage'::regclass AND c.contype = 'u'
                   AND (SELECT array_agg(a.attname::text ORDER BY a.attname)
                        FROM unnest(c.conkey) AS k(attnum)
                        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum) = ARRAY['kam_id', 'line_id']) THEN
    RAISE EXCEPTION 'Rollback 0960: coverage quedó sin su UNIQUE (line_id, kam_id)';
  END IF;
  RAISE NOTICE 'Rollback 0960 OK: sin empresas, papeles ni asignaciones; coverage con su UNIQUE (line_id, kam_id).';
END
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';
