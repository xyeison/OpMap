-- =====================================================================================
-- OpMap · 9950 — Rollback de 0891: vuelve la vista secop_procesos_radar de la 0890 y se borran los dos índices.
-- Proyecto: norvxqgohddgsdkggqzq · Generado: 2026-10-25
-- PÉRDIDAS: ninguna (la 0891 no cambió filas). La vista vuelve a ser lenta en entidades con muchos contratos.
-- =====================================================================================

BEGIN;

CREATE OR REPLACE VIEW public.secop_procesos_radar
WITH (security_invoker = true) AS
SELECT p.*
FROM public.secop_procesos p
WHERE p.estado IN ('publicado', 'evaluacion', 'abierto', 'seleccionado')
  AND NOT EXISTS (
    SELECT 1
    FROM public.secop_contratos c
    WHERE c.nit_entidad = p.nit_entidad
      AND (
        c.proceso = p.portafolio
        OR (p.notice_uid IS NOT NULL AND (c.url LIKE '%' || p.notice_uid || '&%' OR c.url LIKE '%' || p.notice_uid))
      )
  );

REVOKE ALL ON TABLE public.secop_procesos_radar FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.secop_procesos_radar TO service_role;

DROP INDEX IF EXISTS public.secop_contratos_entidad_proceso_idx;
DROP INDEX IF EXISTS public.secop_contratos_entidad_notice_idx;

DO $$
BEGIN
  IF to_regclass('public.secop_contratos_entidad_proceso_idx') IS NOT NULL OR to_regclass('public.secop_contratos_entidad_notice_idx') IS NOT NULL THEN
    RAISE EXCEPTION 'Rollback 0891: quedaron índices';
  END IF;
  RAISE NOTICE 'Rollback 0891 OK. SIGUIENTE PASO: NOTIFY pgrst, ''reload schema''.';
END;
$$;

COMMIT;
