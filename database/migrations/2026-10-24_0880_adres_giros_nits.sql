-- =====================================================================================
-- OpMap · feat/mapa-giros-compras (giros ADRES y compras SECOP de 12 meses en el mapa) · 0880 — Giros por NIT
-- Proyecto: norvxqgohddgsdkggqzq · Generado: 2026-10-24 · APLICADA el 2026-10-25 en la ventana del despliegue (dueño)
--
-- Spec: docs/specs/2026-10-24-mapa-giros-y-compras-12-meses.md (E4 "Carga perezosa por clic" e "Impacto"); aprobada por
--   el dueño el 2026-10-24, punto 7 de "Para decidir": "aplicarla con el despliegue; el código funciona antes y después".
--
-- Qué hace (ADITIVA y OPCIONAL: una función nueva, ninguna tabla ni fila cambia):
--   1. public.adres_giros_nits(p_desde date, p_hasta date, p_nits text[] DEFAULT NULL) → jsonb: totales de giros de
--      Identifica tu Giro (adres_giros_detalle) por NIT y régimen entre p_desde y p_hasta (inclusive), SOLO para los NIT
--      de p_nits (NULL = todos), con la misma forma que cada elemento de adres_giros_intel()->'nits' (la lee parseResumen
--      de web/lib/adres-intelligence.ts): [{ nit, total, contributivo, subsidiado, otro, ultima }], sin meses ni EPS.
--   2. REVOKE a PUBLIC/anon/authenticated y GRANT EXECUTE a service_role: solo el servidor la llama.
--   3. Comentario en el catálogo y bloque DO final que comprueba todo (y una llamada de humo) o aborta la transacción.
--
-- Por qué: cada clic en una tarjeta del mapa necesita los giros de unos pocos NIT (los de las IPS del municipio, la
--   localidad o la sede). adres_giros_intel() no filtra por NIT: devuelve los ≈600 NIT con meses y entidades ordenadoras
--   (1,56 MB, ≈740 ms). Esta función tarda ≈1 ms con 3 NIT y 42 ms con todo el país (comprobado el 2026-10-25 con el
--   cuerpo como SELECT: 600 NIT y $49,102 billones, igual que la suma por régimen de adres_giros_intel).
--
-- Quién la llama: loadGirosNits (web/app/api/intelligence/_lib/giros-server.ts), desde GET /api/map/detalle/territorio
--   y GET /api/map/detalle/ips/[id] (permiso intelligence:view). Si la función NO existe (PGRST202 / 42883), loadGirosNits
--   usa adres_giros_intel filtrado por NIT en memoria y responde lo mismo: el código puede desplegarse antes o después
--   que esta migración y el rollback no obliga a redesplegar.
--
-- Requiere: 2026-10-11_0630_adres_detalle.sql (public.adres_giros_detalle con nit, fecha_giro, valor, regimen).
-- STABLE, SECURITY INVOKER, search_path fijo (como adres_giros_intel y secop_hechos). Usa el índice (nit, fecha_giro).
-- Transaccional: todo o nada. Re-ejecutable: sí (CREATE OR REPLACE; REVOKE/GRANT idempotentes).
-- Tras aplicar: NOTIFY pgrst, 'reload schema';  (PostgREST debe ver la función nueva).
-- Rollback: 2026-10-24_9948_adres_giros_nits_rollback.sql. Costo Google: 0. No recalcula nada. No carga datos.
-- =====================================================================================

BEGIN;

-- -------------------------------------------------------------------------------------
-- 0. Precondiciones
-- -------------------------------------------------------------------------------------

DO $$
BEGIN
  IF to_regclass('public.adres_giros_detalle') IS NULL THEN
    RAISE EXCEPTION '0880 Giros por NIT: falta public.adres_giros_detalle (migración 2026-10-11_0630_adres_detalle.sql)';
  END IF;
END;
$$;

-- -------------------------------------------------------------------------------------
-- 1. Función: totales por NIT y régimen en la ventana, solo para los NIT pedidos
-- -------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.adres_giros_nits(
  p_desde date,
  p_hasta date,
  p_nits  text[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'nit', x.nit, 'total', x.total, 'contributivo', x.c, 'subsidiado', x.s, 'otro', x.o,
           'ultima', to_char(x.ultima, 'YYYY-MM-DD')) ORDER BY x.nit), '[]'::jsonb)
  FROM (
    SELECT d.nit,
           sum(d.valor) AS total,
           coalesce(sum(d.valor) FILTER (WHERE d.regimen = 'contributivo'), 0) AS c,
           coalesce(sum(d.valor) FILTER (WHERE d.regimen = 'subsidiado'), 0)   AS s,
           coalesce(sum(d.valor) FILTER (WHERE d.regimen = 'otro'), 0)         AS o,
           max(d.fecha_giro) AS ultima
    FROM public.adres_giros_detalle d
    WHERE d.fecha_giro BETWEEN p_desde AND p_hasta
      AND (p_nits IS NULL OR d.nit = ANY (p_nits))
    GROUP BY d.nit
  ) x;
$$;

-- -------------------------------------------------------------------------------------
-- 2. Privilegios: solo service_role (el servidor); fuera PUBLIC, anon y authenticated
-- -------------------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.adres_giros_nits(date, date, text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.adres_giros_nits(date, date, text[]) TO service_role;

-- -------------------------------------------------------------------------------------
-- 3. Documentación en el catálogo
-- -------------------------------------------------------------------------------------

COMMENT ON FUNCTION public.adres_giros_nits(date, date, text[]) IS
  'Giros de Identifica tu Giro (adres_giros_detalle) por NIT y régimen entre p_desde y p_hasta, solo para los NIT de '
  'p_nits (NULL = todos): [{nit, total, contributivo, subsidiado, otro, ultima}], misma forma que adres_giros_intel()->nits '
  'sin meses ni EPS. Para las tarjetas del mapa (GET /api/map/detalle/*, spec 2026-10-24). Solo service_role.';

-- -------------------------------------------------------------------------------------
-- 4. Comprobaciones: si algo no queda como se espera, se aborta toda la transacción
-- -------------------------------------------------------------------------------------

DO $$
DECLARE
  v_firma text := 'public.adres_giros_nits(date, date, text[])';
  v_vacio jsonb;
BEGIN
  IF to_regprocedure(v_firma) IS NULL THEN
    RAISE EXCEPTION '0880 Giros por NIT: la función % no existe', v_firma;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'adres_giros_nits' AND (p.prosecdef OR p.provolatile <> 's')
  ) THEN
    RAISE EXCEPTION '0880 Giros por NIT: la función debe ser STABLE y SECURITY INVOKER';
  END IF;

  IF has_function_privilege('anon', v_firma, 'EXECUTE') THEN
    RAISE EXCEPTION '0880 Giros por NIT: anon conserva EXECUTE sobre %', v_firma;
  END IF;
  IF has_function_privilege('authenticated', v_firma, 'EXECUTE') THEN
    RAISE EXCEPTION '0880 Giros por NIT: authenticated conserva EXECUTE sobre %', v_firma;
  END IF;
  IF NOT has_function_privilege('service_role', v_firma, 'EXECUTE') THEN
    RAISE EXCEPTION '0880 Giros por NIT: service_role no tiene EXECUTE sobre %', v_firma;
  END IF;

  -- Humo: con una lista vacía de NIT devuelve [] (nunca NULL: parseResumen espera un arreglo)
  SELECT public.adres_giros_nits(current_date, current_date, ARRAY[]::text[]) INTO v_vacio;
  IF v_vacio IS DISTINCT FROM '[]'::jsonb THEN
    RAISE EXCEPTION '0880 Giros por NIT: con lista vacía debe devolver [] y devolvió %', v_vacio;
  END IF;

  RAISE NOTICE '0880 Giros por NIT OK: % STABLE, SECURITY INVOKER, solo service_role. SIGUIENTE PASO: NOTIFY pgrst, ''reload schema''; el código ya la usa en cuanto PostgREST la vea (antes responde igual con adres_giros_intel).', v_firma;
END;
$$;

COMMIT;
