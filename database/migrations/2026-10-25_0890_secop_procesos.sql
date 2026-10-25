-- =====================================================================================
-- OpMap · feat/secop-procesos (procesos de SECOP II sin contrato como radar comercial) · 0890 — Tabla secop_procesos y vista del radar
-- Proyecto: norvxqgohddgsdkggqzq · Generado: 2026-10-25 · NO EJECUTADO TODAVÍA
--
-- Decisión del dueño (2026-10-25, docs/decisiones/2026-10-25-procesos-secop-radar-comercial.md): "Sí, entonces busquemos
--   la forma de presentarlos […] por lo menos le das herramienta al comercial para que se pregunte quién es VG Medical".
--   Spec: docs/specs/2026-10-25-secop-procesos-radar.md ("Impacto" y "Criterios de aceptación"). Se aplica SOLO con
--   autorización del dueño y en la misma ventana que el despliegue del código.
--
-- Qué hace (ADITIVA: una tabla y una vista nuevas, una fila nueva en fuentes_estado; ninguna fila existente cambia):
--   1. public.secop_procesos: procesos del dataset "SECOP II - Procesos de Contratación" (p6dx-8zbt) de las IPS públicas
--      objetivo, solo de material ortopédico o de neurocirugía (web/lib/secop-procesos.ts, mapSecopProceso). SIN columnas
--      `valor` ni `fecha_firma`: un proceso no es una compra y nadie debe sumarlo con el código de contratos. El precio
--      base se guarda por proceso y nunca se suma. Personas naturales: solo proveedor_hash (nunca documento ni nombre);
--      la descripción llega ya redactada (nombre y documento de pacientes omitidos).
--   2. Índices: (nit_entidad, fecha_publicacion) para las tarjetas del mapa y la ficha, (portafolio) y (hospital_id).
--   3. public.secop_procesos_radar (security_invoker): procesos en estado publicado, evaluacion, abierto o seleccionado
--      que NO tienen contrato cargado de la misma entidad en secop_contratos (mismo portafolio CO1.BDOS = proceso de
--      SECOP II, o el noticeUID CO1.NTC del proceso en la url del contrato, con borde: '&' o fin de texto, para que
--      CO1.NTC.123 no case con CO1.NTC.1234). Un proceso que ya tiene contrato está en "Compras" y no se repite.
--   4. RLS activado y SIN políticas; REVOKE a PUBLIC/anon/authenticated; GRANT a service_role (solo el servidor la usa).
--   5. Fila 'secop_procesos' en fuentes_estado (cron diario 06:30 UTC; la carga la hacen web/lib/secop-procesos-sync.ts y
--      el cron /api/cron/secop_procesos, que esta migración NO corre).
--   6. Comentarios en el catálogo y bloque DO final que comprueba todo (con INSERT de prueba que se deshacen) o aborta.
--
-- Por qué tabla aparte y no filas en secop_contratos: secop-reclasificar.ts borraría o reescribiría los procesos,
--   secop_marcar_atipicos() los actualizaría, `valor` de contratos es valor adjudicado y la vista secop_contratos_unicos
--   es una lista blanca de fuentes que alguien podría ampliar. Con tabla aparte, compras, ranking, /inteligencia y
--   secop_hechos no ven los procesos por construcción (no conocen la tabla).
--
-- Quién la lee: loadProcesosRadar (web/app/api/secop/_lib/secop-server.ts) lee la vista secop_procesos_radar desde las
--   tarjetas del mapa y la ficha de la IPS. Si la vista no existe, devuelve [] (las rutas responden 200 con
--   procesos: null): el código puede desplegarse antes que esta migración y el rollback no obliga a redesplegar.
--
-- Foto con SELECT antes de este script (2026-10-25): public.secop_procesos no existe; fuentes_estado tiene 7 fuentes
--   (adres_identifica, bdua, minsalud_cifras, reps_sedes, secop_i, secop_ii, secop_integrado) y ninguna 'secop_procesos';
--   secop_contratos.linea_check = las 6 líneas + 'no_clasificado' y secop_proveedores_vigilados tiene PK (nit).
--
-- Requiere: 2026-10-11_0710_secop.sql (hospitals, secop_contratos, secop_proveedores_vigilados, fuentes_estado) y
--   2026-10-12_0730_secop_i_y_compra_publica.sql (secop_hechos de 4 argumentos, que el bloque final usa si existe).
-- Transaccional: todo o nada. Re-ejecutable: sí (IF NOT EXISTS / CREATE OR REPLACE / ON CONFLICT DO NOTHING / REVOKE-GRANT).
-- Tras aplicar: NOTIFY pgrst, 'reload schema';  (PostgREST debe ver la tabla y la vista nuevas).
-- Rollback: 2026-10-25_9949_secop_procesos_rollback.sql. Costo Google: 0. No recalcula nada. No carga datos (la carga
--   inicial de 24 meses es web/scripts/secop-procesos-load.ts --inicial, también con autorización del dueño).
-- =====================================================================================

BEGIN;

-- -------------------------------------------------------------------------------------
-- 0. Precondiciones
-- -------------------------------------------------------------------------------------

DO $$
BEGIN
  IF to_regclass('public.hospitals') IS NULL OR to_regclass('public.secop_contratos') IS NULL
     OR to_regclass('public.secop_proveedores_vigilados') IS NULL OR to_regclass('public.fuentes_estado') IS NULL THEN
    RAISE EXCEPTION '0890 SECOP procesos: faltan hospitals, secop_contratos, secop_proveedores_vigilados o fuentes_estado (migración 2026-10-11_0710_secop.sql)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'secop_contratos'
                 AND column_name IN ('proceso')) THEN
    RAISE EXCEPTION '0890 SECOP procesos: falta secop_contratos.proceso (migración 0710)';
  END IF;
END;
$$;

-- -------------------------------------------------------------------------------------
-- 1. Tabla
-- -------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.secop_procesos (
  id                     uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  id_proceso             text          NOT NULL,
  portafolio             text,
  notice_uid             text,
  referencia             text,
  nit_entidad            text          NOT NULL,
  nombre_entidad         text,
  hospital_id            uuid          REFERENCES public.hospitals (id) ON DELETE SET NULL,
  modalidad              text,
  tipo_contrato          text,
  estado_secop           text,
  estado                 text          NOT NULL,
  adjudicado             boolean       NOT NULL DEFAULT false,
  precio_base            numeric(18,2),
  valor_adjudicado       numeric(18,2),
  fecha_publicacion      date,
  fecha_adjudicacion     date,
  proveedor_nit          text,
  proveedor_nombre       text,
  proveedor_origen       text,
  proveedor_hash         text,
  es_persona             boolean       NOT NULL DEFAULT false,
  proveedor_vigilado_id  text          REFERENCES public.secop_proveedores_vigilados (nit) ON DELETE SET NULL,
  descripcion            text,
  linea                  text          NOT NULL,
  lineas                 text[]        NOT NULL DEFAULT '{}',
  motivo                 text,
  clasificacion_version  text,
  categoria_unspsc       text,
  url                    text,
  imported_at            timestamptz   NOT NULL DEFAULT now(),
  ultima_lectura         timestamptz,
  CONSTRAINT secop_procesos_id_proceso_unq     UNIQUE (id_proceso),
  CONSTRAINT secop_procesos_id_proceso_check   CHECK (id_proceso ~ '^CO1\.REQ\.[0-9]+$'),
  CONSTRAINT secop_procesos_nit_check          CHECK (nit_entidad ~ '^[0-9]{5,12}$'),
  CONSTRAINT secop_procesos_estado_check       CHECK (estado IN ('publicado', 'evaluacion', 'abierto', 'seleccionado', 'adjudicado', 'cancelado')),
  CONSTRAINT secop_procesos_precio_check       CHECK (precio_base IS NULL OR precio_base >= 0),
  CONSTRAINT secop_procesos_adjudicado_check   CHECK (valor_adjudicado IS NULL OR valor_adjudicado >= 0),
  CONSTRAINT secop_procesos_proveedor_nit_check CHECK (proveedor_nit IS NULL OR proveedor_nit ~ '^[89][0-9]{8}$'),
  CONSTRAINT secop_procesos_origen_check       CHECK (proveedor_origen IS NULL OR proveedor_origen IN ('nit', 'nombre', 'titulo')),
  -- El origen existe si y solo si figura una empresa (con NIT o con nombre); 'nit' exige el NIT
  CONSTRAINT secop_procesos_origen_coherente_check CHECK (
    (proveedor_origen IS NULL) = (proveedor_nit IS NULL AND proveedor_nombre IS NULL)
    AND (proveedor_origen IS DISTINCT FROM 'nit' OR proveedor_nit IS NOT NULL)
  ),
  CONSTRAINT secop_procesos_hash_check         CHECK (proveedor_hash IS NULL OR (es_persona AND proveedor_hash ~ '^[0-9a-f]{64}$')),
  -- Privacidad: una persona natural nunca guarda NIT, documento ni nombre (solo el hash, si había documento)
  CONSTRAINT secop_procesos_persona_check      CHECK (NOT es_persona OR (proveedor_nit IS NULL AND proveedor_nombre IS NULL)),
  CONSTRAINT secop_procesos_linea_check        CHECK (linea IN ('trauma', 'reemplazo', 'columna', 'deportiva', 'neurocirugia', 'otros_implantes')),
  CONSTRAINT secop_procesos_lineas_check       CHECK (lineas <@ ARRAY['trauma', 'reemplazo', 'columna', 'deportiva', 'neurocirugia', 'otros_implantes']::text[])
);

-- -------------------------------------------------------------------------------------
-- 2. Índices (la UNIQUE de id_proceso ya cubre el upsert)
-- -------------------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS secop_procesos_entidad_idx    ON public.secop_procesos (nit_entidad, fecha_publicacion);
CREATE INDEX IF NOT EXISTS secop_procesos_portafolio_idx ON public.secop_procesos (portafolio);
CREATE INDEX IF NOT EXISTS secop_procesos_hospital_idx   ON public.secop_procesos (hospital_id);

-- -------------------------------------------------------------------------------------
-- 3. Vista del radar: estados del radar y sin contrato cargado de la misma entidad
-- -------------------------------------------------------------------------------------

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

-- -------------------------------------------------------------------------------------
-- 4. RLS activado y SIN políticas; fuera todo privilegio de PUBLIC/anon/authenticated; service_role explícito
-- -------------------------------------------------------------------------------------

ALTER TABLE public.secop_procesos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.secop_procesos, public.secop_procesos_radar FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.secop_procesos TO service_role;
GRANT SELECT ON TABLE public.secop_procesos_radar TO service_role;

-- -------------------------------------------------------------------------------------
-- 5. Fuente automática (la carga y el cron son código; aquí solo la fila de estado)
-- -------------------------------------------------------------------------------------

INSERT INTO public.fuentes_estado (fuente, nombre, programacion, ejecutor)
VALUES ('secop_procesos', 'SECOP II · Procesos sin contrato', '30 6 * * *', 'vercel_cron')
ON CONFLICT (fuente) DO NOTHING;

-- -------------------------------------------------------------------------------------
-- 6. Documentación en el catálogo
-- -------------------------------------------------------------------------------------

COMMENT ON TABLE public.secop_procesos IS
  'Procesos de SECOP II (p6dx-8zbt) de las IPS públicas objetivo, solo material ortopédico o de neurocirugía '
  '(web/lib/secop-procesos.ts). Radar comercial: NO son compras y nunca se suman (sin columnas valor ni fecha_firma; '
  'decisión del dueño 2026-10-25). Personas naturales sin documento ni nombre (proveedor_hash). Descripción redactada. '
  'Lo carga web/lib/secop-procesos-sync.ts (cron secop_procesos y scripts/secop-procesos-load.ts). Solo service_role.';
COMMENT ON COLUMN public.secop_procesos.id_proceso IS 'id_del_proceso (CO1.REQ.n): llave del upsert; los lotes de un proceso se agregan en una fila.';
COMMENT ON COLUMN public.secop_procesos.portafolio IS 'id_del_portafolio (CO1.BDOS.n) = secop_contratos.proceso de SECOP II: si casa, ya hay contrato cargado.';
COMMENT ON COLUMN public.secop_procesos.notice_uid IS 'noticeUID (CO1.NTC.n) de urlproceso = el de secop_contratos.url (SECOP II e Integrado origen SECOPII).';
COMMENT ON COLUMN public.secop_procesos.estado IS
  'publicado | evaluacion | abierto | seleccionado | adjudicado (Seleccionado con adjudicado = Si) | cancelado (Cancelado, '
  'Suspendido). Borrador, En aprobación y Aprobado no se guardan. En régimen especial "Publicado" no es una licitación abierta.';
COMMENT ON COLUMN public.secop_procesos.estado_secop IS 'estado_del_procedimiento tal cual lo publica SECOP.';
COMMENT ON COLUMN public.secop_procesos.precio_base IS 'Precio base de la convocatoria (estimado de la entidad). Se muestra por proceso y NUNCA se suma.';
COMMENT ON COLUMN public.secop_procesos.valor_adjudicado IS 'Suma de los lotes adjudicados; null sin adjudicación (régimen especial sin ofertas: siempre null).';
COMMENT ON COLUMN public.secop_procesos.proveedor_origen IS
  'De dónde sale la empresa que FIGURA (nunca "adjudicada"): nit (NIT de empresa), nombre (nombre del proveedor con marca '
  'jurídica, sin NIT) o titulo (el título del proceso con marca jurídica; se muestra "según el título del proceso").';
COMMENT ON COLUMN public.secop_procesos.proveedor_hash IS 'sha256(sal de secop_ajustes : dígitos del documento) de una persona natural; nunca el documento.';
COMMENT ON COLUMN public.secop_procesos.descripcion IS 'descripci_n_del_procedimiento con nombre y documento de pacientes reemplazados por "[dato personal omitido]".';
COMMENT ON COLUMN public.secop_procesos.ultima_lectura IS 'Última vez que la carga leyó el proceso (imported_at queda con la primera).';
COMMENT ON VIEW public.secop_procesos_radar IS
  'Procesos del radar: estado publicado, evaluacion, abierto o seleccionado y sin contrato cargado de la misma entidad '
  '(secop_contratos.proceso = portafolio, o el noticeUID en secop_contratos.url con borde). La leen las tarjetas del mapa '
  'y la ficha de la IPS (loadProcesosRadar). Solo service_role.';

-- -------------------------------------------------------------------------------------
-- 7. Comprobaciones: si algo no queda como se espera, se aborta toda la transacción. Las pruebas que escriben van en
--    sub-bloques que terminan con RAISE SQLSTATE 'P0890': PL/pgSQL deshace todo lo del sub-bloque, así que no queda ni
--    cambia ninguna fila. Cualquier otra excepción sale del bloque y aborta la migración.
-- -------------------------------------------------------------------------------------

DO $$
DECLARE
  nit_prueba constant text := '999999999';
  n          bigint;
  r          jsonb;
BEGIN
  -- 7.1 Tabla, RLS, políticas y privilegios
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace
    WHERE ns.nspname = 'public' AND c.relname = 'secop_procesos' AND c.relkind = 'r' AND c.relrowsecurity
  ) THEN
    RAISE EXCEPTION '0890 SECOP procesos: public.secop_procesos no existe o no tiene RLS activado';
  END IF;
  SELECT count(*) INTO n FROM pg_policies WHERE schemaname = 'public' AND tablename = 'secop_procesos';
  IF n > 0 THEN RAISE EXCEPTION '0890 SECOP procesos: la tabla tiene % política(s); debe nacer sin políticas', n; END IF;
  IF has_table_privilege('anon', 'public.secop_procesos', 'SELECT') OR has_table_privilege('authenticated', 'public.secop_procesos', 'SELECT') THEN
    RAISE EXCEPTION '0890 SECOP procesos: anon/authenticated pueden leer secop_procesos';
  END IF;
  SELECT count(*) INTO n FROM information_schema.role_table_grants
  WHERE table_schema = 'public' AND table_name = 'secop_procesos' AND grantee = 'service_role'
    AND privilege_type IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE');
  IF n <> 4 THEN RAISE EXCEPTION '0890 SECOP procesos: service_role tiene % de los 4 privilegios esperados', n; END IF;

  -- 7.2 Sin columnas de compra: nadie debe poder sumarla con el código de contratos
  SELECT count(*) INTO n FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'secop_procesos' AND column_name IN ('valor', 'fecha_firma', 'valor_pagado');
  IF n > 0 THEN RAISE EXCEPTION '0890 SECOP procesos: la tabla no debe tener columnas valor, valor_pagado ni fecha_firma'; END IF;

  -- 7.3 Índices
  IF to_regclass('public.secop_procesos_entidad_idx') IS NULL OR to_regclass('public.secop_procesos_portafolio_idx') IS NULL
     OR to_regclass('public.secop_procesos_hospital_idx') IS NULL THEN
    RAISE EXCEPTION '0890 SECOP procesos: faltan índices (entidad, portafolio u hospital)';
  END IF;

  -- 7.4 Vista: security_invoker y privilegios
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace
    WHERE ns.nspname = 'public' AND c.relname = 'secop_procesos_radar' AND c.relkind = 'v'
      AND coalesce(c.reloptions, ARRAY[]::text[]) @> ARRAY['security_invoker=true']
  ) THEN
    RAISE EXCEPTION '0890 SECOP procesos: la vista secop_procesos_radar no existe o no es security_invoker';
  END IF;
  IF has_table_privilege('anon', 'public.secop_procesos_radar', 'SELECT') OR has_table_privilege('authenticated', 'public.secop_procesos_radar', 'SELECT') THEN
    RAISE EXCEPTION '0890 SECOP procesos: anon/authenticated pueden leer secop_procesos_radar';
  END IF;
  IF NOT has_table_privilege('service_role', 'public.secop_procesos_radar', 'SELECT') THEN
    RAISE EXCEPTION '0890 SECOP procesos: service_role no puede leer secop_procesos_radar';
  END IF;

  -- 7.5 Fuente
  IF NOT EXISTS (SELECT 1 FROM public.fuentes_estado WHERE fuente = 'secop_procesos' AND programacion = '30 6 * * *' AND ejecutor = 'vercel_cron') THEN
    RAISE EXCEPTION '0890 SECOP procesos: fuentes_estado no tiene la fuente secop_procesos (30 6 * * *, vercel_cron)';
  END IF;

  -- 7.6 Constraints y vista, con INSERT reales que se deshacen. El NIT de prueba no debe existir.
  IF EXISTS (SELECT 1 FROM public.secop_procesos WHERE nit_entidad = nit_prueba)
     OR EXISTS (SELECT 1 FROM public.secop_contratos WHERE nit_entidad = nit_prueba) THEN
    RAISE EXCEPTION '0890 SECOP procesos: el NIT de prueba % ya tiene filas; no se puede probar', nit_prueba;
  END IF;

  -- acepta un proceso publicado con empresa por NIT, otro sin proveedor y otro con persona (solo hash); la vista los
  -- muestra mientras no haya contrato; secop_hechos y secop_contratos_unicos no cambian; un contrato de la MISMA
  -- entidad con el mismo portafolio o el mismo noticeUID (con borde) lo saca; uno de OTRA entidad o con un noticeUID
  -- que solo comparte el prefijo, no.
  BEGIN
    INSERT INTO public.secop_procesos (id_proceso, portafolio, notice_uid, nit_entidad, estado, adjudicado, precio_base, linea, lineas,
                                       proveedor_nit, proveedor_nombre, proveedor_origen, es_persona, url)
    VALUES ('CO1.REQ.999000001', 'CO1.BDOS.999000001', 'CO1.NTC.999000001', nit_prueba, 'publicado', false, 1760000000, 'trauma', ARRAY['trauma', 'neurocirugia'],
            '901080496', 'EMPRESA DE PRUEBA SAS', 'nit', false, 'https://community.secop.gov.co/Public/Tendering/OpportunityDetail/Index?noticeUID=CO1.NTC.999000001');
    INSERT INTO public.secop_procesos (id_proceso, portafolio, notice_uid, nit_entidad, estado, linea, lineas)
    VALUES ('CO1.REQ.999000002', 'CO1.BDOS.999000002', 'CO1.NTC.999000002', nit_prueba, 'evaluacion', 'trauma', ARRAY['trauma']);
    INSERT INTO public.secop_procesos (id_proceso, portafolio, notice_uid, nit_entidad, estado, linea, lineas, es_persona, proveedor_hash)
    VALUES ('CO1.REQ.999000003', 'CO1.BDOS.999000003', 'CO1.NTC.999000003', nit_prueba, 'seleccionado', 'otros_implantes', ARRAY['otros_implantes'], true, repeat('a', 64));
    INSERT INTO public.secop_procesos (id_proceso, portafolio, nit_entidad, estado, linea, lineas)
    VALUES ('CO1.REQ.999000004', 'CO1.BDOS.999000004', nit_prueba, 'cancelado', 'trauma', ARRAY['trauma']),
           ('CO1.REQ.999000005', 'CO1.BDOS.999000005', nit_prueba, 'adjudicado', 'trauma', ARRAY['trauma']);

    SELECT count(*) INTO n FROM public.secop_procesos_radar WHERE nit_entidad = nit_prueba;
    IF n <> 3 THEN RAISE EXCEPTION '0890 SECOP procesos: la vista debe mostrar 3 procesos (publicado, evaluacion, seleccionado; sin cancelado ni adjudicado) y mostró %', n; END IF;

    SELECT count(*) INTO n FROM public.secop_contratos_unicos WHERE nit_entidad = nit_prueba;
    IF n <> 0 THEN RAISE EXCEPTION '0890 SECOP procesos: secop_contratos_unicos cambió con los procesos de prueba (% filas)', n; END IF;
    IF to_regprocedure('public.secop_hechos(date, date, text[], text[])') IS NOT NULL THEN
      r := public.secop_hechos(NULL, NULL, ARRAY[nit_prueba], NULL);
      IF jsonb_array_length(coalesce(r, '[]'::jsonb)) <> 0 THEN
        RAISE EXCEPTION '0890 SECOP procesos: secop_hechos() cambió con los procesos de prueba: %', r;
      END IF;
    END IF;

    -- contrato de OTRA entidad con el mismo portafolio y noticeUID: no saca el proceso
    INSERT INTO public.secop_contratos (fuente, origen, id_contrato, nit_entidad, proceso, url)
    VALUES ('secop2', 'SECOPII', '__prueba_0890_otra__', '999999998', 'CO1.BDOS.999000001',
            'https://community.secop.gov.co/Public/Tendering/OpportunityDetail/Index?noticeUID=CO1.NTC.999000001&isFromPublicArea=True');
    -- contrato de la misma entidad con un noticeUID que solo comparte el prefijo (CO1.NTC.9990000021): no saca el 999000002
    INSERT INTO public.secop_contratos (fuente, origen, id_contrato, nit_entidad, url)
    VALUES ('integrado', 'SECOPII', '__prueba_0890_prefijo__', nit_prueba,
            'https://community.secop.gov.co/Public/Tendering/OpportunityDetail/Index?noticeUID=CO1.NTC.9990000021&isFromPublicArea=True');
    SELECT count(*) INTO n FROM public.secop_procesos_radar WHERE nit_entidad = nit_prueba;
    IF n <> 3 THEN RAISE EXCEPTION '0890 SECOP procesos: un contrato de otra entidad o con un noticeUID de solo prefijo sacó procesos de la vista (quedan %)', n; END IF;

    -- contrato de la misma entidad por portafolio (SECOP II) y otro por noticeUID (Integrado origen SECOPII): salen los dos
    INSERT INTO public.secop_contratos (fuente, origen, id_contrato, nit_entidad, proceso, url)
    VALUES ('secop2', 'SECOPII', '__prueba_0890_portafolio__', nit_prueba, 'CO1.BDOS.999000001', NULL);
    INSERT INTO public.secop_contratos (fuente, origen, id_contrato, nit_entidad, url)
    VALUES ('integrado', 'SECOPII', '__prueba_0890_notice__', nit_prueba,
            'https://community.secop.gov.co/Public/Tendering/OpportunityDetail/Index?noticeUID=CO1.NTC.999000002&isFromPublicArea=True&isModal=true');
    SELECT count(*) INTO n FROM public.secop_procesos_radar WHERE nit_entidad = nit_prueba;
    IF n <> 1 THEN RAISE EXCEPTION '0890 SECOP procesos: con contrato por portafolio y por noticeUID la vista debe dejar 1 proceso y dejó %', n; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.secop_procesos_radar WHERE id_proceso = 'CO1.REQ.999000003') THEN
      RAISE EXCEPTION '0890 SECOP procesos: la vista sacó el proceso que no tiene contrato';
    END IF;

    RAISE SQLSTATE 'P0890';
  EXCEPTION
    WHEN SQLSTATE 'P0890' THEN NULL;  -- filas de prueba deshechas
    WHEN check_violation OR unique_violation OR foreign_key_violation THEN
      RAISE EXCEPTION '0890 SECOP procesos: los constraints rechazan una fila válida de prueba: %', SQLERRM;
  END;

  -- rechaza: persona con nombre, persona con NIT, estado borrador, línea no_clasificado, precio negativo, id que no es
  -- CO1.REQ, hash inválido, hash de una empresa, origen 'nit' sin NIT y origen sin empresa
  BEGIN
    -- con origen 'nombre' (coherente): solo secop_procesos_persona_check puede rechazarla
    INSERT INTO public.secop_procesos (id_proceso, nit_entidad, estado, linea, es_persona, proveedor_nombre, proveedor_origen)
    VALUES ('CO1.REQ.999000011', nit_prueba, 'publicado', 'trauma', true, 'NOMBRE DE PERSONA', 'nombre');
    RAISE EXCEPTION '0890 SECOP procesos: aceptó una persona natural con nombre';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO public.secop_procesos (id_proceso, nit_entidad, estado, linea, es_persona, proveedor_nit, proveedor_origen)
    VALUES ('CO1.REQ.999000012', nit_prueba, 'publicado', 'trauma', true, '901080496', 'nit');
    RAISE EXCEPTION '0890 SECOP procesos: aceptó una persona natural con NIT';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO public.secop_procesos (id_proceso, nit_entidad, estado, linea) VALUES ('CO1.REQ.999000013', nit_prueba, 'borrador', 'trauma');
    RAISE EXCEPTION '0890 SECOP procesos: aceptó el estado borrador';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO public.secop_procesos (id_proceso, nit_entidad, estado, linea) VALUES ('CO1.REQ.999000014', nit_prueba, 'publicado', 'no_clasificado');
    RAISE EXCEPTION '0890 SECOP procesos: aceptó la línea no_clasificado';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO public.secop_procesos (id_proceso, nit_entidad, estado, linea, precio_base) VALUES ('CO1.REQ.999000015', nit_prueba, 'publicado', 'trauma', -1);
    RAISE EXCEPTION '0890 SECOP procesos: aceptó un precio base negativo';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO public.secop_procesos (id_proceso, nit_entidad, estado, linea) VALUES ('CO1.BDOS.999000016', nit_prueba, 'publicado', 'trauma');
    RAISE EXCEPTION '0890 SECOP procesos: aceptó un id_proceso que no es CO1.REQ';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO public.secop_procesos (id_proceso, nit_entidad, estado, linea, es_persona, proveedor_hash)
    VALUES ('CO1.REQ.999000017', nit_prueba, 'publicado', 'trauma', true, '1234567');
    RAISE EXCEPTION '0890 SECOP procesos: aceptó un hash que no es sha256 (¿un documento?)';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO public.secop_procesos (id_proceso, nit_entidad, estado, linea, proveedor_nit, proveedor_origen, proveedor_hash)
    VALUES ('CO1.REQ.999000018', nit_prueba, 'publicado', 'trauma', '901080496', 'nit', repeat('b', 64));
    RAISE EXCEPTION '0890 SECOP procesos: aceptó un hash de persona en una empresa';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO public.secop_procesos (id_proceso, nit_entidad, estado, linea, proveedor_nombre, proveedor_origen)
    VALUES ('CO1.REQ.999000019', nit_prueba, 'publicado', 'trauma', 'EMPRESA DE PRUEBA SAS', 'nit');
    RAISE EXCEPTION '0890 SECOP procesos: aceptó origen nit sin NIT';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO public.secop_procesos (id_proceso, nit_entidad, estado, linea, proveedor_origen)
    VALUES ('CO1.REQ.999000020', nit_prueba, 'publicado', 'trauma', 'titulo');
    RAISE EXCEPTION '0890 SECOP procesos: aceptó un origen sin empresa';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  -- rechaza el mismo id_proceso dos veces (el upsert de la carga actualiza en su sitio)
  BEGIN
    INSERT INTO public.secop_procesos (id_proceso, nit_entidad, estado, linea)
    VALUES ('CO1.REQ.999000021', nit_prueba, 'publicado', 'trauma'), ('CO1.REQ.999000021', nit_prueba, 'evaluacion', 'trauma');
    RAISE EXCEPTION '0890 SECOP procesos: aceptó dos filas con el mismo id_proceso';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  IF EXISTS (SELECT 1 FROM public.secop_procesos WHERE nit_entidad = nit_prueba)
     OR EXISTS (SELECT 1 FROM public.secop_contratos WHERE nit_entidad IN (nit_prueba, '999999998')) THEN
    RAISE EXCEPTION '0890 SECOP procesos: quedaron filas de prueba';
  END IF;

  SELECT count(*) INTO n FROM public.fuentes_estado;
  RAISE NOTICE '0890 SECOP procesos OK: secop_procesos (RLS, sin políticas, solo service_role, sin columnas de compra), vista secop_procesos_radar (security_invoker) y fuente secop_procesos (% fuentes). SIGUIENTE PASO: NOTIFY pgrst, ''reload schema''; luego la carga inicial con autorización del dueño.', n;
END;
$$;

COMMIT;
