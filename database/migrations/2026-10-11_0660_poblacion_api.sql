-- =====================================================================================
-- OpMap · Fase 4 (población) · 0660 — Funciones de lectura para la API "Población y cobertura"
-- Proyecto: norvxqgohddgsdkggqzq · Generado: 2026-10-11
--
-- Autorización del dueño (2026-10-11): "Autorizo todo. Procede." Es ADITIVA: 2 funciones nuevas de
--   solo lectura; no crea ni modifica tablas ni datos. Depende de 0640 (bdua_afiliados,
--   afiliacion_cifras, dane_proyecciones).
--
-- Por qué: PostgREST corta en 1.000 filas por petición. bdua_afiliados tiene una fila por corte,
--   municipio, régimen, EPS, estado y zona (decenas de miles), y no hay DISTINCT en PostgREST para
--   listar los cortes. Estas funciones agregan en la base y devuelven UN jsonb.
--
-- Qué crea:
--   1. poblacion_cortes()  → { "cifras": ["YYYY-MM-DD"…], "bdua": ["YYYY-MM-DD"…], "dane": [2025…] }
--      Cortes de afiliacion_cifras, de bdua_afiliados y años de dane_proyecciones, ascendentes.
--   2. poblacion_bdua_resumen(p_corte date, p_top_eps integer DEFAULT 12)
--      → { "corte": "YYYY-MM-DD",
--          "municipios": [ { "m": "05001", "c": <contributivo>, "s": <subsidiado> } … ],
--          "eps":        [ { "m": "05001", "e": "<eps_id>", "a": <afiliados> } … ],
--          "nombres":    { "<eps_id>": "<eps_nombre más frecuente>" } }
--      Solo afiliados en estado "Activo" (sin tildes ni mayúsculas) y con municipio cruzado
--      (municipality_code no nulo). "eps" trae las p_top_eps EPS con más afiliados de cada municipio
--      (todos los regímenes sumados por eps_id); la app une los códigos de una misma EPS
--      (EPS037 / EPSS37 / EPS041 = Nueva EPS) por nombre.
--   Las dos: SECURITY INVOKER (service_role ya lee las tablas; anon/authenticated no tienen
--   privilegios sobre ellas), search_path fijo, EXECUTE solo para service_role.
--
-- Foto con SELECT antes de este script (2026-10-11): las 4 tablas de 0640 existen (RLS, sin
--   políticas). No existen poblacion_cortes() ni poblacion_bdua_resumen(). PostgreSQL 17.4.
--
-- Re-ejecutable: sí (CREATE OR REPLACE / REVOKE-GRANT idempotentes).
-- Rollback: 2026-10-11_9930_poblacion_api_rollback.sql
-- =====================================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.poblacion_cortes()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'cifras', coalesce((SELECT jsonb_agg(c ORDER BY c) FROM (SELECT DISTINCT corte AS c FROM public.afiliacion_cifras) x), '[]'::jsonb),
    'bdua',   coalesce((SELECT jsonb_agg(c ORDER BY c) FROM (SELECT DISTINCT corte AS c FROM public.bdua_afiliados) x), '[]'::jsonb),
    'dane',   coalesce((SELECT jsonb_agg(a ORDER BY a) FROM (SELECT DISTINCT anio AS a FROM public.dane_proyecciones) x), '[]'::jsonb)
  );
$$;

CREATE OR REPLACE FUNCTION public.poblacion_bdua_resumen(p_corte date, p_top_eps integer DEFAULT 12)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  WITH activos AS (
    SELECT b.municipality_code AS m, b.regimen, b.eps_id, b.eps_nombre, b.afiliados
    FROM public.bdua_afiliados b
    WHERE b.corte = p_corte
      AND b.municipality_code IS NOT NULL
      AND lower(translate(b.estado, 'ÁÉÍÓÚáéíóú', 'AEIOUaeiou')) = 'activo'
  ),
  por_municipio AS (
    SELECT a.m,
           sum(a.afiliados) FILTER (WHERE a.regimen = 'contributivo')::bigint AS c,
           sum(a.afiliados) FILTER (WHERE a.regimen = 'subsidiado')::bigint   AS s
    FROM activos a
    GROUP BY a.m
  ),
  por_eps AS (
    SELECT a.m, a.eps_id AS e, sum(a.afiliados)::bigint AS total,
           row_number() OVER (PARTITION BY a.m ORDER BY sum(a.afiliados) DESC, a.eps_id) AS rk
    FROM activos a
    GROUP BY a.m, a.eps_id
  ),
  nombres AS (
    SELECT x.eps_id, (array_agg(x.eps_nombre ORDER BY x.n DESC, x.eps_nombre))[1] AS nombre
    FROM (
      SELECT a.eps_id, a.eps_nombre, count(*) AS n
      FROM activos a
      WHERE a.eps_nombre IS NOT NULL AND btrim(a.eps_nombre) <> ''
      GROUP BY a.eps_id, a.eps_nombre
    ) x
    GROUP BY x.eps_id
  )
  SELECT jsonb_build_object(
    'corte', to_char(p_corte, 'YYYY-MM-DD'),
    'municipios', coalesce((
      SELECT jsonb_agg(jsonb_build_object('m', p.m, 'c', coalesce(p.c, 0), 's', coalesce(p.s, 0)) ORDER BY p.m)
      FROM por_municipio p
    ), '[]'::jsonb),
    'eps', coalesce((
      SELECT jsonb_agg(jsonb_build_object('m', e.m, 'e', e.e, 'a', e.total) ORDER BY e.m, e.rk)
      FROM por_eps e
      WHERE e.rk <= greatest(coalesce(p_top_eps, 12), 1) AND e.total > 0
    ), '[]'::jsonb),
    'nombres', coalesce((SELECT jsonb_object_agg(n.eps_id, n.nombre) FROM nombres n), '{}'::jsonb)
  );
$$;

REVOKE ALL ON FUNCTION public.poblacion_cortes() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.poblacion_bdua_resumen(date, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.poblacion_cortes() TO service_role;
GRANT EXECUTE ON FUNCTION public.poblacion_bdua_resumen(date, integer) TO service_role;

COMMENT ON FUNCTION public.poblacion_cortes() IS
  'Fase 4: cortes de afiliacion_cifras y bdua_afiliados y años de dane_proyecciones (jsonb). Lo usa GET /api/intelligence/poblacion.';
COMMENT ON FUNCTION public.poblacion_bdua_resumen(date, integer) IS
  'Fase 4: afiliados ACTIVOS de la BDUA en un corte, por municipio y régimen, y las N EPS con más afiliados por municipio (jsonb). Lo usa GET /api/intelligence/poblacion.';

DO $$
DECLARE
  probe jsonb;
BEGIN
  IF has_function_privilege('anon', 'public.poblacion_cortes()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.poblacion_cortes()', 'EXECUTE')
     OR has_function_privilege('anon', 'public.poblacion_bdua_resumen(date, integer)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.poblacion_bdua_resumen(date, integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Población 0660: las funciones no deben ser ejecutables por anon/authenticated';
  END IF;
  IF NOT has_function_privilege('service_role', 'public.poblacion_cortes()', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.poblacion_bdua_resumen(date, integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Población 0660: service_role no puede ejecutar las funciones';
  END IF;

  probe := public.poblacion_cortes();
  IF jsonb_typeof(probe -> 'cifras') <> 'array' OR jsonb_typeof(probe -> 'bdua') <> 'array' OR jsonb_typeof(probe -> 'dane') <> 'array' THEN
    RAISE EXCEPTION 'Población 0660: poblacion_cortes() no devuelve {cifras:[], bdua:[], dane:[]}: %', probe;
  END IF;
  probe := public.poblacion_bdua_resumen(DATE '1900-01-01');
  IF jsonb_typeof(probe -> 'municipios') <> 'array' OR jsonb_typeof(probe -> 'eps') <> 'array' OR jsonb_typeof(probe -> 'nombres') <> 'object' THEN
    RAISE EXCEPTION 'Población 0660: poblacion_bdua_resumen() no devuelve {municipios:[], eps:[], nombres:{}}: %', probe;
  END IF;

  RAISE NOTICE 'Población 0660 OK: poblacion_cortes() y poblacion_bdua_resumen() solo para service_role.';
END;
$$;

COMMIT;
