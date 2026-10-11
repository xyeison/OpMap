-- =====================================================================================
-- OpMap · Fase 4 (población: afiliados BDUA, cifras de afiliación de MinSalud y proyecciones
-- DANE) · 0640 — Esquema y semilla de alias
-- Proyecto: norvxqgohddgsdkggqzq · Generado: 2026-10-11
--
-- Autorización del dueño (2026-10-11): "Autorizo todo. Procede." Es ADITIVA: 4 tablas nuevas, sin
-- tocar ninguna tabla existente (municipalities solo se referencia desde municipio_alias).
--
-- Fuentes (detalle de la estructura real en docs/fases/fase4-poblacion.md):
--   - BDUA (ADRES) en datos.gov.co: tq4m-hmg2 (régimen contributivo) y d7a5-cnra (subsidiado).
--     Publica NOMBRES de departamento y municipio, no códigos DANE. Carga: web/scripts/bdua-load.ts.
--   - MinSalud, "Cifras de aseguramiento en salud" (un ZIP mensual con "CIFRAS <MES>-<AÑO>.xlsx").
--     Hoja CoberturaMunicipio. Desde feb-2026 trae IdMunicipio; de jul-2025 a ene-2026 solo nombres.
--     Carga: web/scripts/minsalud-cifras-load.ts.
--   - DANE, proyecciones municipales por área 2020-2035 (actualización post COVID-19).
--     Carga: web/scripts/dane-proyecciones-load.ts.
--
-- Qué crea:
--   1. municipio_alias   : nombre normalizado + departamento → código DANE, por fuente.
--                          FK a municipalities(code). Semilla: 55 alias de la BDUA verificados.
--   2. bdua_afiliados    : afiliados BDUA por corte, municipio, régimen, EPS, estado y zona.
--   3. afiliacion_cifras : cifras mensuales de MinSalud por municipio (corte = último día del mes).
--   4. dane_proyecciones : población proyectada por municipio y año (total, cabecera, resto).
--   Las 4 con RLS activado, SIN políticas, sin privilegios para anon/authenticated/PUBLIC y GRANT
--   explícito a service_role. Bloque DO final que comprueba todo y aborta si no cuadra.
--
-- Códigos sin FOREIGN KEY ("FK suave", como hospitals.reps_code): bdua_afiliados,
--   afiliacion_cifras y dane_proyecciones guardan el código tal como lo publica la fuente, y las
--   fuentes usan códigos que no están en municipalities: MinSalud '00000' (SIN UBICACIÓN, régimen de
--   excepción sin municipio), "<DEPTO>-SM" (sin municipio: '<dd>000', y 19856 para CAUCA-SM),
--   27086 / 27493 (Belén y Nuevo Belén de Bajirá) y 94663 (Mapiripana); el DANE, 94663.
--
-- Foto con SELECT antes de este script (2026-10-11):
--   - Ninguna de las 4 tablas existe.
--   - municipalities: 1.121 filas (PK code varchar), 33 departamentos; suma de population_2025 =
--     53.110.609 (igual al total 2025 del archivo DANE 2020-2035).
--   - Los 55 códigos de la semilla existen en municipalities (verificados uno a uno; ver la nota de
--     cada fila y docs/fases/fase4-poblacion.md, "Alias de la BDUA").
--   - gen_random_uuid() disponible (PostgreSQL 17.4).
--
-- Re-ejecutable: sí (IF NOT EXISTS / ON CONFLICT DO NOTHING / REVOKE-GRANT idempotentes).
-- Rollback: 2026-10-11_9930_poblacion_rollback.sql
-- =====================================================================================

BEGIN;

-- -------------------------------------------------------------------------------------
-- 1. Tablas
-- -------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.municipio_alias (
  fuente             text        NOT NULL,
  department_code    text        NOT NULL,
  nombre_normalizado text        NOT NULL,
  municipality_code  text        NOT NULL REFERENCES public.municipalities (code) ON UPDATE CASCADE,
  nota               text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT municipio_alias_pkey PRIMARY KEY (fuente, department_code, nombre_normalizado),
  CONSTRAINT municipio_alias_fuente_check CHECK (fuente ~ '^[a-z0-9_]+$'),
  CONSTRAINT municipio_alias_dept_check   CHECK (department_code ~ '^[0-9]{2}$'),
  CONSTRAINT municipio_alias_code_check   CHECK (municipality_code ~ '^[0-9]{5}$' AND left(municipality_code, 2) = department_code),
  CONSTRAINT municipio_alias_nombre_check CHECK (nombre_normalizado ~ '^[A-Z0-9]+( [A-Z0-9]+)*$')
);

CREATE TABLE IF NOT EXISTS public.bdua_afiliados (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  corte             date        NOT NULL,
  regimen           text        NOT NULL,
  departamento_bdua text        NOT NULL,
  municipio_bdua    text        NOT NULL,
  department_code   text,
  municipality_code text,
  eps_id            text        NOT NULL,
  eps_nombre        text,
  estado            text        NOT NULL,
  zona              text        NOT NULL,
  afiliados         integer     NOT NULL,
  fuente            text        NOT NULL,
  loaded_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bdua_afiliados_regimen_check   CHECK (regimen IN ('contributivo', 'subsidiado')),
  CONSTRAINT bdua_afiliados_dept_check      CHECK (department_code IS NULL OR department_code ~ '^[0-9]{2}$'),
  CONSTRAINT bdua_afiliados_code_check      CHECK (municipality_code IS NULL OR municipality_code ~ '^[0-9]{5}$'),
  CONSTRAINT bdua_afiliados_afiliados_check CHECK (afiliados >= 0),
  CONSTRAINT bdua_afiliados_unq UNIQUE (corte, regimen, departamento_bdua, municipio_bdua, eps_id, estado, zona)
);

CREATE INDEX IF NOT EXISTS bdua_afiliados_corte_mun_idx ON public.bdua_afiliados (corte, municipality_code);

CREATE TABLE IF NOT EXISTS public.afiliacion_cifras (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  corte                date        NOT NULL,
  municipality_code    text        NOT NULL,
  department_code      text,
  departamento_nombre  text,
  municipio_nombre     text,
  contributivo         integer,
  subsidiado           integer,
  excepcion_especiales integer,
  afiliados            integer     NOT NULL,
  poblacion_dane       integer,
  cobertura            numeric,
  codigo_origen        text        NOT NULL DEFAULT 'archivo',
  archivo              text,
  fuente               text        NOT NULL DEFAULT 'minsalud_cifras',
  loaded_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT afiliacion_cifras_corte_check  CHECK (corte = (date_trunc('month', corte) + interval '1 month - 1 day')::date),
  CONSTRAINT afiliacion_cifras_code_check   CHECK (municipality_code ~ '^[0-9]{5}$'),
  CONSTRAINT afiliacion_cifras_dept_check   CHECK (department_code IS NULL OR department_code ~ '^[0-9]{2}$'),
  CONSTRAINT afiliacion_cifras_origen_check CHECK (codigo_origen IN ('archivo', 'nombre', 'alias', 'aprendido')),
  CONSTRAINT afiliacion_cifras_valores_check CHECK (
    afiliados >= 0
    AND (contributivo IS NULL OR contributivo >= 0)
    AND (subsidiado IS NULL OR subsidiado >= 0)
    AND (excepcion_especiales IS NULL OR excepcion_especiales >= 0)
    AND (poblacion_dane IS NULL OR poblacion_dane >= 0)
    AND (cobertura IS NULL OR (cobertura >= 0 AND cobertura <= 1))
  ),
  CONSTRAINT afiliacion_cifras_unq UNIQUE (corte, municipality_code)
);

CREATE INDEX IF NOT EXISTS afiliacion_cifras_mun_idx ON public.afiliacion_cifras (municipality_code, corte);

CREATE TABLE IF NOT EXISTS public.dane_proyecciones (
  municipality_code text        NOT NULL,
  anio              integer     NOT NULL,
  total             integer     NOT NULL,
  cabecera          integer,
  resto             integer,
  fuente            text        NOT NULL DEFAULT 'dane_2020_2035_postcovid',
  loaded_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dane_proyecciones_pkey       PRIMARY KEY (municipality_code, anio),
  CONSTRAINT dane_proyecciones_code_check CHECK (municipality_code ~ '^[0-9]{5}$'),
  CONSTRAINT dane_proyecciones_anio_check CHECK (anio BETWEEN 1985 AND 2100),
  CONSTRAINT dane_proyecciones_valores_check CHECK (
    total >= 0
    AND (cabecera IS NULL OR cabecera >= 0)
    AND (resto IS NULL OR resto >= 0)
    AND (cabecera IS NULL OR resto IS NULL OR cabecera + resto = total)
  )
);

-- -------------------------------------------------------------------------------------
-- 2. RLS activado y SIN políticas; fuera todo privilegio de anon/authenticated/PUBLIC.
--    service_role (bypass de RLS) recibe GRANT explícito.
-- -------------------------------------------------------------------------------------

ALTER TABLE public.municipio_alias   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bdua_afiliados    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.afiliacion_cifras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dane_proyecciones ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.municipio_alias, public.bdua_afiliados, public.afiliacion_cifras, public.dane_proyecciones
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.municipio_alias, public.bdua_afiliados, public.afiliacion_cifras, public.dane_proyecciones
  TO service_role;

-- -------------------------------------------------------------------------------------
-- 3. Documentación en el catálogo
-- -------------------------------------------------------------------------------------

COMMENT ON TABLE public.municipio_alias IS
  'Alias de nombre de municipio por fuente: (fuente, departamento, nombre normalizado) → código DANE. '
  'Normalización de web/lib/municipio-alias.ts (sin tildes, mayúsculas, sin puntuación; ¥ → Ñ). '
  'Solo para nombres que no coinciden con municipalities.name; cada alias se verifica antes de entrar.';
COMMENT ON COLUMN public.municipio_alias.fuente IS 'bdua | minsalud_cifras (los aprende minsalud-cifras-load.ts de los archivos con IdMunicipio) | otras futuras.';

COMMENT ON TABLE public.bdua_afiliados IS
  'Afiliados de la BDUA (ADRES, datos.gov.co tq4m-hmg2 contributivo y d7a5-cnra subsidiado) agregados '
  'por corte, municipio, régimen, EPS, estado y zona. La clave es la identidad en la fuente (nombres '
  'tal como vienen); municipality_code es derivado (NULL = sin cruce) y se actualiza al recargar. '
  'Lo carga web/scripts/bdua-load.ts. Varias filas pueden compartir municipio: siempre sumar.';
COMMENT ON COLUMN public.bdua_afiliados.corte IS 'Fecha (hora de Bogotá) de rowsUpdatedAt del dataset, o la que se pase con --corte.';
COMMENT ON COLUMN public.bdua_afiliados.estado IS 'Estado del afiliado tal como lo publica la BDUA (Activo, Protección Laboral C…).';
COMMENT ON COLUMN public.bdua_afiliados.zona IS 'Zona de afiliación tal como la publica la BDUA (Urbana, Rural - Dispersal…).';
COMMENT ON COLUMN public.bdua_afiliados.fuente IS 'Id del dataset en datos.gov.co.';

COMMENT ON TABLE public.afiliacion_cifras IS
  'Cifras de aseguramiento de MinSalud por municipio (hoja CoberturaMunicipio del XLSX mensual). '
  'corte = último día del mes del archivo. Incluye filas que no son municipio: 00000 SIN UBICACIÓN y '
  '"<DEPTO>-SM" (<dd>000; 19856 en Cauca). Lo carga web/scripts/minsalud-cifras-load.ts.';
COMMENT ON COLUMN public.afiliacion_cifras.cobertura IS 'Como la publica MinSalud: afiliados / población DANE con tope en 1.';
COMMENT ON COLUMN public.afiliacion_cifras.codigo_origen IS 'archivo (IdMunicipio del XLSX) | aprendido (mismo nombre en un archivo con IdMunicipio) | nombre (municipalities.name) | alias (municipio_alias).';

COMMENT ON TABLE public.dane_proyecciones IS
  'Proyecciones de población municipal del DANE por año: total, cabecera municipal y centros poblados '
  'y rural disperso (resto). Lo carga web/scripts/dane-proyecciones-load.ts. No modifica municipalities.';

-- -------------------------------------------------------------------------------------
-- 4. Semilla: 55 alias de la BDUA. Cada uno verificado el 2026-10-11 contra municipalities y
--    comparando afiliados activos de la BDUA con los afiliados de MinSalud (agosto-2026) del mismo
--    código: razón entre 0,95 y 1,00 en los 55 (la BDUA no incluye el régimen de excepción).
--    Fuera, sin certeza o sin código en municipalities: CHOCO / NUEVO BELÉN DE BAJIRÁ y BELEN DE
--    BAJIRA (27493 / 27086 no están en municipalities), VAUPES / DPTO. VAUPES y GUAINIA / DPTO.
--    GUAINIA (no son un municipio).
-- -------------------------------------------------------------------------------------

INSERT INTO public.municipio_alias (fuente, department_code, nombre_normalizado, municipality_code, nota) VALUES
  ('bdua', '66', 'DOS QUEBRADAS', '66170', 'BDUA "DOS QUEBRADAS" = Dosquebradas'),
  ('bdua', '76', 'BUGA', '76111', 'BDUA "BUGA" = Guadalajara de Buga'),
  ('bdua', '13', 'MOMPOS', '13468', 'BDUA "MOMPOS" = Santa Cruz de Mompox'),
  ('bdua', '70', 'TOLU', '70820', 'BDUA "TOLU" = Santiago de Tolú'),
  ('bdua', '27', 'ITSMINA', '27361', 'BDUA "ITSMINA" = Istmina'),
  ('bdua', '70', 'SINCE', '70742', 'BDUA "SINCE" = San Luis de Sincé'),
  ('bdua', '05', 'SAN PEDRO', '05664', 'BDUA "SAN PEDRO" = San Pedro de los Milagros (San Pedro de Urabá viene aparte)'),
  ('bdua', '05', 'DON MATIAS', '05237', 'BDUA "DON MATIAS" = Donmatías'),
  ('bdua', '47', 'SAN SEBASTIAN BUENAVIST', '47692', 'BDUA "SAN SEBASTIAN BUENAVIST" = San Sebastián de Buenavista'),
  ('bdua', '50', 'VISTA HERMOSA', '50711', 'BDUA "VISTA HERMOSA" = Vistahermosa'),
  ('bdua', '08', 'POLO NUEVO', '08558', 'BDUA "POLO NUEVO" = Polonuevo'),
  ('bdua', '47', 'SABANA DE SAN ANGEL', '47660', 'BDUA "SABANA DE SAN ANGEL" = Sabanas de San Ángel'),
  ('bdua', '18', 'SAN JOSE DE FRAGUA', '18610', 'BDUA "SAN JOSE DE FRAGUA" = San José del Fragua'),
  ('bdua', '50', 'SAN CARLOS GUAROA', '50680', 'BDUA "SAN CARLOS GUAROA" = San Carlos de Guaroa'),
  ('bdua', '47', 'EL PIJINO DEL CARMEN', '47545', 'BDUA "EL PIJI¥O DEL CARMEN" = Pijiño del Carmen'),
  ('bdua', '73', 'GUAYABAL', '73055', 'BDUA "GUAYABAL" = Armero (Armero Guayabal)'),
  ('bdua', '52', 'LEYVA', '52405', 'BDUA "LEYVA" = Leiva'),
  ('bdua', '47', 'CERRO SAN ANTONIO', '47161', 'BDUA "CERRO SAN ANTONIO" = Cerro de San Antonio'),
  ('bdua', '94', 'BARRANCO MINAS', '94343', 'BDUA "BARRANCO MINAS" = Barrancominas'),
  ('bdua', '73', 'VILLA HERMOSA', '73870', 'BDUA "VILLA HERMOSA" = Villahermosa'),
  ('bdua', '52', 'FRANCIS PIZARRO', '52520', 'BDUA "FRANCIS PIZARRO" = Francisco Pizarro'),
  ('bdua', '25', 'S ANTONIO TEQUENDAMA', '25645', 'BDUA "S.ANTONIO TEQUENDAMA" = San Antonio del Tequendama'),
  ('bdua', '25', 'SAN JUAN DE RIO SECO', '25662', 'BDUA "SAN JUAN DE RIO SECO" = San Juan de Rioseco'),
  ('bdua', '27', 'CANTON DE SAN PABLO', '27135', 'BDUA "CANTON DE SAN PABLO" = El Cantón del San Pablo'),
  ('bdua', '25', 'EL PENOL', '25258', 'BDUA "EL PEÑOL" (Cundinamarca) = El Peñón, único de ese nombre en el departamento'),
  ('bdua', '91', 'PTO SANTANDER', '91669', 'BDUA "PTO SANTANDER" = Puerto Santander (Amazonas)'),
  ('bdua', '91', 'MIRITINPARANA', '91460', 'BDUA "MIRITIÑPARANA" = Mirití - Paraná'),
  ('bdua', '76', 'SANTIAGO DE CALI', '76001', 'BDUA "SANTIAGO DE CALI" = Cali'),
  ('bdua', '13', 'CARTAGENA', '13001', 'BDUA "CARTAGENA" = Cartagena de Indias'),
  ('bdua', '54', 'CUCUTA', '54001', 'BDUA "CUCUTA" = San José de Cúcuta'),
  ('bdua', '52', 'TUMACO', '52835', 'BDUA "TUMACO" = San Andrés de Tumaco'),
  ('bdua', '20', 'CODAZZI', '20013', 'BDUA "CODAZZI" = Agustín Codazzi'),
  ('bdua', '05', 'CARMEN DE VIBORAL', '05148', 'BDUA "CARMEN DE VIBORAL" = El Carmen de Viboral'),
  ('bdua', '25', 'UBATE', '25843', 'BDUA "UBATE" = Villa de San Diego de Ubaté'),
  ('bdua', '19', 'PIENDAMO', '19548', 'BDUA "PIENDAMO" = Piendamó - Tunía'),
  ('bdua', '05', 'SANTUARIO', '05697', 'BDUA "SANTUARIO" = El Santuario'),
  ('bdua', '73', 'MARIQUITA', '73443', 'BDUA "MARIQUITA" = San Sebastián de Mariquita'),
  ('bdua', '19', 'PATIA EL BORDO', '19532', 'BDUA "PATIA (EL BORDO)" = Patía'),
  ('bdua', '05', 'ANTIOQUIA', '05042', 'BDUA "ANTIOQUIA" (municipio) = Santa Fe de Antioquia'),
  ('bdua', '05', 'BOLIVAR', '05101', 'BDUA "BOLIVAR" (Antioquia) = Ciudad Bolívar'),
  ('bdua', '20', 'LA PAZ ROBLES', '20621', 'BDUA "LA PAZ  ROBLES" = La Paz'),
  ('bdua', '70', 'TOLUVIEJO', '70823', 'BDUA "TOLUVIEJO" = San José de Toluviejo'),
  ('bdua', '23', 'PURISIMA', '23586', 'BDUA "PURISIMA" = Purísima de la Concepción'),
  ('bdua', '05', 'SAN VICENTE', '05674', 'BDUA "SAN VICENTE" = San Vicente Ferrer'),
  ('bdua', '68', 'EL CARMEN', '68235', 'BDUA "EL CARMEN" (Santander) = El Carmen de Chucurí'),
  ('bdua', '52', 'EL TABLON', '52258', 'BDUA "EL TABLON" = El Tablón de Gómez'),
  ('bdua', '50', 'LA URIBE', '50370', 'BDUA "LA URIBE" = Uribe'),
  ('bdua', '52', 'CUASPUD', '52224', 'BDUA "CUASPUD" = Cuaspud Carlosama'),
  ('bdua', '19', 'SOTARA', '19760', 'BDUA "SOTARA" = Sotará Paispamba'),
  ('bdua', '27', 'EL CARMEN', '27245', 'BDUA "EL CARMEN" (Chocó) = El Carmen de Atrato (Carmen del Darién viene aparte)'),
  ('bdua', '05', 'SAN ANDRES', '05647', 'BDUA "SAN ANDRES" (Antioquia) = San Andrés de Cuerquía'),
  ('bdua', '15', 'GUICAN', '15332', 'BDUA "GUICAN" = Güicán de la Sierra'),
  ('bdua', '17', 'SAN JOSE DE CALDAS', '17665', 'BDUA "SAN JOSE DE CALDAS" = San José'),
  ('bdua', '15', 'TUTASA', '15839', 'BDUA "TUTASA" = Tutazá'),
  ('bdua', '94', 'MORICHAL NUEVO', '94888', 'BDUA "MORICHAL NUEVO" = Morichal')
ON CONFLICT (fuente, department_code, nombre_normalizado) DO NOTHING;

-- -------------------------------------------------------------------------------------
-- 5. Comprobaciones (aborta la transacción si algo no cuadra)
-- -------------------------------------------------------------------------------------

DO $$
DECLARE
  t text;
  n integer;
BEGIN
  FOREACH t IN ARRAY ARRAY['municipio_alias', 'bdua_afiliados', 'afiliacion_cifras', 'dane_proyecciones'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace
      WHERE ns.nspname = 'public' AND c.relname = t AND c.relkind = 'r' AND c.relrowsecurity
    ) THEN
      RAISE EXCEPTION 'Fase 4 población: la tabla public.% no existe o no tiene RLS activado', t;
    END IF;

    SELECT count(*) INTO n FROM pg_policies WHERE schemaname = 'public' AND tablename = t;
    IF n > 0 THEN
      RAISE EXCEPTION 'Fase 4 población: public.% tiene % política(s); debe nacer sin políticas', t, n;
    END IF;

    SELECT count(*) INTO n
    FROM pg_class c, aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a
    WHERE c.oid = ('public.' || t)::regclass
      AND (a.grantee = 0
           OR a.grantee IN (SELECT oid FROM pg_roles WHERE rolname IN ('anon', 'authenticated')));
    IF n > 0 THEN
      RAISE EXCEPTION 'Fase 4 población: public.% conserva % privilegio(s) para anon/authenticated/PUBLIC', t, n;
    END IF;

    IF NOT has_table_privilege('service_role', 'public.' || t, 'SELECT')
       OR NOT has_table_privilege('service_role', 'public.' || t, 'INSERT')
       OR NOT has_table_privilege('service_role', 'public.' || t, 'UPDATE')
       OR NOT has_table_privilege('service_role', 'public.' || t, 'DELETE') THEN
      RAISE EXCEPTION 'Fase 4 población: service_role sin SELECT/INSERT/UPDATE/DELETE en public.%', t;
    END IF;
  END LOOP;

  SELECT count(*) INTO n
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name IN ('municipio_alias', 'bdua_afiliados', 'afiliacion_cifras', 'dane_proyecciones');
  IF n <> 43 THEN
    RAISE EXCEPTION 'Fase 4 población: se esperaban 43 columnas en las 4 tablas; hay % (¿existían con otra forma?)', n;
  END IF;

  SELECT count(*) INTO n FROM public.municipio_alias WHERE fuente = 'bdua';
  IF n < 55 THEN
    RAISE EXCEPTION 'Fase 4 población: la semilla de municipio_alias (bdua) tiene % filas; se esperaban 55', n;
  END IF;

  RAISE NOTICE 'Fase 4 población OK: 4 tablas con RLS, 0 políticas, 0 privilegios para anon/authenticated; % alias bdua. SIGUIENTE PASO: cd web && npx tsx scripts/dane-proyecciones-load.ts && npx tsx scripts/minsalud-cifras-load.ts && npx tsx scripts/bdua-load.ts', n;
END;
$$;

COMMIT;
