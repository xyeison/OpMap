-- =====================================================================================
-- OpMap · PR 7 (compras públicas SECOP) · 0720 — Función de lectura para la API de compras públicas
-- Proyecto: norvxqgohddgsdkggqzq · Generado: 2026-10-11
--
-- Autorización del dueño (2026-10-11): "Dale. Pero… ¿estamos haciendo algo que consulte estas fuentes y
--   esté actualizado?". Es ADITIVA: 1 función nueva de solo lectura; no crea ni modifica tablas ni datos.
--   Depende de 0710 (vista secop_contratos_unicos).
--
-- Por qué: PostgREST corta en 1.000 filas por petición. El ranking de /inteligencia ("Compras públicas")
--   y el detalle de un proveedor leían contrato por contrato (20.000+ filas = 20+ peticiones, ≈ 6 s con el
--   histórico completo). Esta función agrega en la base y devuelve UN jsonb con un hecho por grupo.
--
-- Qué crea:
--   secop_hechos(p_desde date, p_hasta date, p_nits text[], p_proveedores text[]) → jsonb
--     [ { "e": nit_entidad, "en": nombre_entidad (el más frecuente), "d": documento_proveedor,
--         "h": proveedor_hash, "pn": proveedor_nombre (el más frecuente), "p": es_persona,
--         "es": especialidad_medico, "l": linea, "a": atipico, "x": fuera de escala (valor del contrato
--         > 50.000 millones = VALOR_ATIPICO_COP de web/lib/secop.ts; la API no lo suma),
--         "f": última fecha de firma, "v": suma de valor (ajustado, ver abajo), "n": nº de contratos } … ]
--     SECOP I repite el valor del PROCESO en cada contratista (misma constancia numero_contrato, mismo
--     valor): esas filas se cuentan una vez, repartiendo el valor por partes iguales entre los contratistas
--     (valor / nº de filas con la misma entidad, constancia y valor). El 2026-10-11 esto bajaba SECOP I de
--     $ 3,94 a $ 2,66 billones; en la Samaritana (899999032), trauma de $ 780 mil M a $ 43 mil M.
--     Un objeto por (entidad, proveedor, persona, especialidad, línea, atípico, fuera de escala, año de
--     firma). El proveedor
--     es documento_proveedor (empresa, 9 dígitos), proveedor_hash (persona natural) o, si no hay ninguno, el
--     nombre. Filtros opcionales (NULL = sin filtro): rango de fecha de firma (inclusive; con rango, los
--     contratos sin fecha quedan fuera), NIT de entidad y documento de proveedor.
--   SECURITY INVOKER (service_role ya lee la vista; anon/authenticated no tienen privilegios sobre ella),
--   search_path fijo, EXECUTE solo para service_role.
--
-- Foto con SELECT antes de este script (2026-10-11): 0710 aplicada (secop_contratos con 15.729 filas
--   durante la carga inicial). No existe secop_hechos(). PostgreSQL 17.
--
-- Re-ejecutable: sí (CREATE OR REPLACE / REVOKE-GRANT idempotentes).
-- Rollback: 2026-10-11_9929_secop_api_rollback.sql (va ANTES de 9930_secop_rollback).
-- =====================================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.secop_hechos(
  p_desde       date   DEFAULT NULL,
  p_hasta       date   DEFAULT NULL,
  p_nits        text[] DEFAULT NULL,
  p_proveedores text[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'e', g.nit_entidad, 'en', g.nombre_entidad, 'd', g.documento_proveedor, 'h', g.proveedor_hash,
           'pn', g.proveedor_nombre, 'p', g.es_persona, 'es', g.especialidad_medico, 'l', g.linea,
           'a', g.atipico, 'x', g.fuera_escala, 'f', g.fecha, 'v', g.valor, 'n', g.contratos)), '[]'::jsonb)
  FROM (
    SELECT u.nit_entidad,
           mode() WITHIN GROUP (ORDER BY u.nombre_entidad)   AS nombre_entidad,
           u.documento_proveedor,
           u.proveedor_hash,
           mode() WITHIN GROUP (ORDER BY u.proveedor_nombre) AS proveedor_nombre,
           u.es_persona,
           u.especialidad_medico,
           u.linea,
           u.atipico,
           coalesce(u.valor_ajustado > 50000000000, false) AS fuera_escala,
           max(u.fecha_firma)                   AS fecha,
           coalesce(sum(u.valor_ajustado), 0)   AS valor,
           count(*)                             AS contratos
    FROM (
      -- El reparto se calcula ANTES de filtrar por fecha o proveedor (un proceso no se parte por el filtro).
      SELECT c.*,
             CASE WHEN c.origen = 'SECOPI' AND c.numero_contrato IS NOT NULL AND c.valor > 0
                  THEN c.valor / count(*) OVER (PARTITION BY c.nit_entidad, c.origen, c.numero_contrato, c.valor)
                  ELSE c.valor END AS valor_ajustado
      FROM public.secop_contratos_unicos c
      WHERE (p_nits IS NULL OR c.nit_entidad = ANY (p_nits))
    ) u
    WHERE (p_desde IS NULL OR u.fecha_firma >= p_desde)
      AND (p_hasta IS NULL OR u.fecha_firma <= p_hasta)
      AND (p_proveedores IS NULL OR u.documento_proveedor = ANY (p_proveedores))
    GROUP BY u.nit_entidad, u.documento_proveedor, u.proveedor_hash,
             CASE WHEN u.documento_proveedor IS NULL AND u.proveedor_hash IS NULL THEN u.proveedor_nombre END,
             u.es_persona, u.especialidad_medico, u.linea, u.atipico,
             coalesce(u.valor_ajustado > 50000000000, false),
             date_part('year', u.fecha_firma)
  ) g;
$$;

REVOKE ALL ON FUNCTION public.secop_hechos(date, date, text[], text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.secop_hechos(date, date, text[], text[]) TO service_role;

COMMENT ON FUNCTION public.secop_hechos(date, date, text[], text[]) IS
  'Contratos de secop_contratos_unicos agregados por entidad, proveedor, persona, especialidad, línea, '
  'atípico, fuera de escala (> 50.000 M) y año de firma, en un jsonb. SECOP I: el valor del proceso repetido '
  'por contratista se reparte por partes iguales. Lo usan GET /api/secop/ranking, /api/secop/proveedor/[nit] y '
  '/api/secop/vigilados (app/api/secop/_lib/secop-server.ts). Solo service_role.';

-- Comprobaciones (aborta si algo no cuadra)
DO $$
DECLARE
  r jsonb;
BEGIN
  IF has_function_privilege('anon', 'public.secop_hechos(date, date, text[], text[])', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.secop_hechos(date, date, text[], text[])', 'EXECUTE') THEN
    RAISE EXCEPTION 'PR 7 SECOP API: anon/authenticated pueden ejecutar secop_hechos()';
  END IF;
  IF NOT has_function_privilege('service_role', 'public.secop_hechos(date, date, text[], text[])', 'EXECUTE') THEN
    RAISE EXCEPTION 'PR 7 SECOP API: service_role no puede ejecutar secop_hechos()';
  END IF;
  r := public.secop_hechos(DATE '2099-01-01', DATE '2099-12-31', NULL, NULL);
  IF jsonb_typeof(r) <> 'array' OR jsonb_array_length(r) <> 0 THEN
    RAISE EXCEPTION 'PR 7 SECOP API: secop_hechos() con rango vacío debe devolver []';
  END IF;
  RAISE NOTICE 'PR 7 SECOP API OK: secop_hechos() solo para service_role.';
END;
$$;

COMMIT;
