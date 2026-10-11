# Fase 4 (2026-10-11): población, afiliados y cobertura

Rama `feat/giros-bdua-cifras`. Autorización del dueño: "Autorizo todo. Procede." (2026-10-11).

Qué hay: afiliados de la BDUA (ADRES), cifras mensuales de afiliación de MinSalud y proyecciones de
población del DANE, cargadas en 4 tablas nuevas (migración `2026-10-11_0640_poblacion.sql`, **aplicada**
el 2026-10-11, aditiva), y la API, la vista "Población y cobertura" de `/inteligencia` y la tarjeta
"Entorno del municipio" de la ficha de IPS (sección "API y vista", más abajo). Nada de esto recalcula
asignaciones ni llama a Google.

> Nota del revisor (2026-10-11): esta primera parte (fuentes, tablas, alias, cargas y cifras) se
> reconstruyó a partir del código, la migración, la base y el informe del agente de datos, porque el
> archivo se sobrescribió al escribir la sección "API y vista".

## Fuentes: estructura real (inspeccionada el 2026-10-11)

### MinSalud, "Cifras de aseguramiento en salud"
- Un ZIP por mes con un solo `CIFRAS <MES>-<AÑO>.xlsx` (14 meses descargados: jul-2025 a ago-2026).
- 9 hojas: `CoberturaDepartamento`, `CoberturaMunicipio`, `EPSMunicipio`, `EPS`, `Caracterización01`
  a `Caracterización05`. Se usa **CoberturaMunicipio**.
- Fila 1: título ("CIFRAS AGOSTO-2026"). Fila 2: encabezados. Una fila por municipio y una final
  "Total general" (o "Total"), con la que se cuadra cada archivo.
- Desde **feb-2026**: `IdDepartamento, Departamento, IdMunicipio, Municipio, Contributivo, Subsidiado,
  Excepción & Especiales, Afiliados, Población, Cobertura` + 4 columnas de SISBEN IV (no se cargan).
- De **jul-2025 a ene-2026**: las mismas columnas **sin** `IdDepartamento` ni `IdMunicipio` (solo
  nombres en mayúsculas con tildes: "MEDELLÍN", "MIRITÍ - PARANÁ").
- Filas que no son municipio, necesarias para que el total nacional cuadre: `00000 SIN UBICACIÓN`
  (régimen de excepción sin municipio), `"<DEPTO>-SM"` (sin municipio: `<dd>000`; `19856` en Cauca),
  `27086` / `27493` (Belén y Nuevo Belén de Bajirá) y `94663` (Mapiripana). Las "-SM" vacías de jul y
  ago-2026 se saltan.
- `Cobertura` viene como fracción con **tope en 1** (afiliados / población DANE).
- `Población` es la serie **DANE 2018-2042** (no la 2020-2035): en jun-2026 coincide exacta con el año
  2026 de esa serie en 1.123 de 1.128 filas.

### DANE, proyecciones municipales por área
- `DCD-area-proypoblacion-Mun-2020-2035-ActPostCOVID-19.xlsx` (actualización post COVID-19): hoja
  `Hoja1`, encabezados en la fila 9: `DP, DPNOM, MPIO, DPMP, AÑO, ÁREA GEOGRÁFICA, Población`. Una fila por
  municipio, año y área ("Cabecera Municipal", "Centros Poblados y Rural Disperso", "Total"). Ojo: `MPIO`
  trae el código de 5 dígitos y `DPMP` el nombre del municipio.
- `PPED-AreaMun-2018-2042_VP.xlsx` (actualizado el 30-jul-2025): hojas `Índice`, `PPED`,
  `PobMunicipalxÁrea`; esta última con encabezados en la fila 8 y la columna `TOTAL` en lugar de
  `Población`. El script la lee con `--fuente dane_2018_2042_vp`, pero **no está cargada**.

### BDUA (ADRES) en datos.gov.co
- `tq4m-hmg2` (régimen contributivo; `cantidad` numérica) y `d7a5-cnra` (subsidiado; `cantidad` es
  **texto**: se agrega con `sum(cantidad::number)`).
- Cada fila del dataset es un grupo (género, edad, EPS, tipo de afiliado, estado, zona, departamento,
  municipio…). Publica **nombres** de departamento y municipio, no códigos DANE ("VALLE / BUGA"); la Ñ
  llega como `¥` ("PIJI¥O"). Columnas usadas: `dpr_nombre`, `mnc_nombre`, régimen, `ent_id`,
  `ent_nombre`, `tps_est_afl_nombre` (estado: Activo, Protección Laboral C…), `zns_nombre` (zona).
- No trae el régimen de excepción.

## Tablas (0640; RLS activado, sin políticas, solo `service_role`)

| Tabla | Clave | Qué guarda |
| --- | --- | --- |
| `municipio_alias` | PK (fuente, department_code, nombre_normalizado); FK a `municipalities` | Nombre normalizado de una fuente → código DANE. Semilla: 55 alias `bdua` verificados |
| `bdua_afiliados` | UNIQUE (corte, regimen, departamento_bdua, municipio_bdua, eps_id, estado, zona) | Afiliados por corte, municipio, régimen, EPS, estado y zona. `municipality_code` es derivado (NULL = sin cruce). Varias filas por municipio: **siempre sumar** |
| `afiliacion_cifras` | UNIQUE (corte, municipality_code); corte = último día del mes (CHECK) | Contributivo, subsidiado, excepción y especiales, afiliados, población y cobertura de MinSalud; `codigo_origen` = archivo / nombre / alias / aprendido |
| `dane_proyecciones` | PK (municipality_code, anio); CHECK cabecera + resto = total | Población total, cabecera y resto por municipio y año (fuente `dane_2020_2035_postcovid`) |

Los códigos de las 3 tablas de datos no tienen FOREIGN KEY: las fuentes usan 00000, "-SM", 27086,
27493 y 94663, que no están en `municipalities`.

## Normalización y alias (`web/lib/municipio-alias.ts`, puro)

1. Normalizar: `¥` → Ñ; sin tildes; mayúsculas; lo que no sea letra o dígito → espacio; espacios
   colapsados ("BOGOTÁ, D.C." → "BOGOTA D C").
2. Departamento por nombre normalizado o alias fijo (VALLE → 76, SAN ANDRES → 88…).
3. Municipio dentro del departamento: alias de la misma fuente → nombre exacto normalizado (si dos
   municipios normalizan igual es ambiguo y no se resuelve) → alias de otra fuente. **Nunca** hay
   coincidencia aproximada.

### Alias de la BDUA (55, en la semilla de 0640)
`sin-cruce.json` listaba 33 nombres, pero salía de una prueba con coincidencia aproximada. Con la regla
estricta fueron 59 nombres sin cruce; entraron 55 (27 de los 33 y 28 que solo aparecieron con la regla
estricta, como Cali, Cartagena, Cúcuta y Tumaco). Cada uno se comprobó contra `municipalities` y
comparando los activos de la BDUA con los afiliados de MinSalud (ago-2026) del mismo código: razón entre
0,95 y 1,00 en los 55.

ANTIOQUIA→05042 Santa Fe de Antioquia; BOLIVAR→05101 Ciudad Bolívar; CARMEN DE VIBORAL→05148; DON
MATIAS→05237 Donmatías; SAN ANDRES (Antioquia)→05647 San Andrés de Cuerquía; SAN PEDRO (Antioquia)→05664
San Pedro de los Milagros; SAN VICENTE→05674; SANTUARIO→05697; POLO NUEVO→08558; CARTAGENA→13001;
MOMPOS→13468 Santa Cruz de Mompox; GUICAN→15332; TUTASA→15839 Tutazá; SAN JOSE DE CALDAS→17665; SAN JOSE
DE FRAGUA→18610; PATIA EL BORDO→19532; PIENDAMO→19548; SOTARA→19760; CODAZZI→20013; LA PAZ ROBLES→20621;
PURISIMA→23586; EL PENOL (Cundinamarca)→25258 El Peñón; S ANTONIO TEQUENDAMA→25645; SAN JUAN DE RIO
SECO→25662; UBATE→25843; CANTON DE SAN PABLO→27135; EL CARMEN (Chocó)→27245 El Carmen de Atrato;
ITSMINA→27361 Istmina; CERRO SAN ANTONIO→47161; EL PIJINO DEL CARMEN→47545; SABANA DE SAN ANGEL→47660;
SAN SEBASTIAN BUENAVIST→47692; LA URIBE→50370; SAN CARLOS GUAROA→50680; VISTA HERMOSA→50711;
CUASPUD→52224; EL TABLON→52258; FRANCIS PIZARRO→52520; LEYVA→52405 Leiva; TUMACO→52835; CUCUTA→54001;
DOS QUEBRADAS→66170; EL CARMEN (Santander)→68235 El Carmen de Chucurí; SINCE→70742; TOLU→70820;
TOLUVIEJO→70823; GUAYABAL (Tolima)→73055 Armero; MARIQUITA→73443; VILLA HERMOSA→73870; BUGA→76111;
SANTIAGO DE CALI→76001; MIRITINPARANA→91460; PTO SANTANDER (Amazonas)→91669; BARRANCO MINAS→94343;
MORICHAL NUEVO→94888.

Fuera (sin certeza o sin código en `municipalities`): NUEVO BELÉN DE BAJIRÁ y BELEN DE BAJIRA (Chocó;
27493 / 27086 no están en `municipalities`), DPTO. VAUPES y DPTO. GUAINIA (no son un municipio). Suman
los 7.469 afiliados sin cruce (3.695 + 8 + 2.448 + 1.318).

## Scripts de carga (desde `web/`; idempotentes; sin Google)

- `npx tsx scripts/dane-proyecciones-load.ts --file <xlsx 2020-2035>` → años 2024-2030 por defecto;
  compara 2025 con `municipalities.population_2025` y reporta diferencias > 5 % (no modifica
  `municipalities`).
- `npx tsx scripts/minsalud-cifras-load.ts --dir <carpeta de ZIP>` (o `--file <zip>`; `--dry-run`).
  Código DANE por fila: IdMunicipio del archivo → nombre o alias → "aprendido" (mismo departamento y
  nombre en un archivo con IdMunicipio). Si nombre y aprendido discrepan, la fila no se carga. Exige que
  cada archivo cuadre con su fila de total.
- `npx tsx scripts/bdua-load.ts` (`--dataset`, `--corte`, `--dry-run`): SoQL agregada y paginada; corte
  = fecha de `rowsUpdatedAt` en hora de Colombia. Si la suma de las páginas no es igual al total del
  dataset, no escribe nada. Poda lo que no vino en la carga del mismo corte.
- Utilidades compartidas: `scripts/_poblacion-db.ts`; lectura pura: `lib/poblacion-parse.ts`.
- Pruebas puras: `scripts/poblacion-check.ts` (89; dentro de `npm run test`).

## Cifras cargadas (2026-10-11)

- **DANE 2020-2035, 2024-2030**: 7.854 filas (1.122 códigos × 7 años; 94663 Mapiripana no está en
  `municipalities`). El año 2025 coincide exacto con `population_2025` en los 1.121 municipios; ninguno
  difiere más de 5 %.
- **MinSalud**: 14 cortes (2025-07-31 a 2026-08-31) × 1.128 filas = 15.792; cada uno cuadra con su total.
  Ago-2026: **52.553.613 afiliados y 53.451.430 de población**, igual que el tablero. Origen del código:
  archivo 7.896, nombre 7.840, aprendido 49, alias 7; sin código 0; conflictos 0.
- **BDUA, corte 2026-10-02**: 53.634 filas, 50.137.787 afiliados (contributivo 23.120.347 en 28.301 filas;
  subsidiado 27.017.440 en 25.333 filas), igual a la suma de cada dataset. Cruzados 50.130.318 (99,985 %);
  sin cruce 7.469 en 4 nombres (18 filas).
- Cruce BDUA (activos) ↔ MinSalud ago-2026 por municipio: p5 0,994, mediana 0,999, p95 1,002; ninguno
  fuera de 0,8–1,2.

## Pendientes del dueño

- Serie DANE: 2018-2042 (la que usa MinSalud) o 2020-2035 (la de OpMap hoy). `dane_proyecciones` guarda
  una sola serie por (municipio, año); la cobertura calculada con 2020-2035 no da igual que la publicada.
- Añadir 27493 Nuevo Belén de Bajirá a `municipalities` (y luego su alias de la BDUA).
- Carga mensual: el ZIP nuevo de MinSalud con `--file`; la BDUA cuando cambie `rowsUpdatedAt`.

## API y vista

### Qué responde

- **`/inteligencia` → sección "Población y cobertura"** (debajo de los giros): por municipio, zona o
  Ejecutivo Comercial, cuántos afiliados hay por régimen, cuánta población, qué cobertura, qué EPS
  dominan, cuánto giró la ADRES a las IPS del grupo en 12 meses y un índice "potencial" para priorizar.
- **Ficha de IPS → tarjeta "Entorno del municipio"** (después de "Giros ADRES"): afiliados por régimen,
  cobertura y las 3 EPS dominantes del municipio de la IPS, y en qué puesto está la IPS en el ranking de
  giros de su municipio.
- Nada de esto recalcula asignaciones, ni llama a Google, ni escribe en ninguna tabla.

### Reglas

1. **Afiliados por régimen** (contributivo, subsidiado, excepción y especiales): `afiliacion_cifras`
   (MinSalud, hoja CoberturaMunicipio) del corte elegido. Si un municipio no tiene fila en ese corte, se
   usa la BDUA (solo afiliados en estado "Activo", contributivo y subsidiado; la BDUA no trae el régimen
   de excepción). Las filas de MinSalud que no son municipio (`00000` SIN UBICACIÓN y `<dd>000` "-SM")
   no se atribuyen a nadie: en ago-2026 son 1.260.849 de 52.553.613 afiliados (2,4 %, casi todo
   régimen de excepción sin municipio). Por eso el total del país en la vista es 51.292.764.
2. **Población**: `dane_proyecciones.total` del año del corte (si ese año no está cargado, el más
   cercano). Si el municipio no tiene proyección, la `poblacion_dane` de MinSalud; si tampoco,
   `municipalities.population_2025`.
3. **Cobertura** = afiliados / población × 100, sumando solo la población de los municipios que tienen
   cifras de afiliación (si no, quedaría subestimada). **Puede pasar de 100 %** (Barranquilla 118 %,
   Medellín 111,5 % en ago-2026): MinSalud publica la misma razón con tope en 100 %; aquí no se recorta
   para no esconder el desajuste entre afiliados y proyección.
4. **EPS dominantes**: BDUA del corte más cercano al de MinSalud, afiliados activos de todos los
   regímenes. La BDUA da un código por régimen y por movilidad (Nueva EPS = EPS037, EPSS41, EPSS37,
   EPS041): se unen por nombre (sin "-CM", comillas ni tildes) y se muestran con nombre corto
   (`epsDisplayName`). El % es sobre los afiliados de la BDUA del grupo. Por municipio se guardan las 12
   EPS más grandes (función `poblacion_bdua_resumen`); para una zona se suman las de sus municipios.
5. **Municipio → zona** (para agrupar por zona o por Ejecutivo Comercial):
   - Con IPS asignadas hoy: se reparte entre las zonas de esas IPS **en proporción a sus camas**
     (`hospitals.beds`, el mismo peso de la regla de mayoría; por número de IPS si ninguna tiene camas).
     Hoy solo se reparten Bogotá (4 zonas: Chapinero, Engativá, Kennedy, San Cristóbal) y Sogamoso (2).
     Es distinto del coloreado del mapa a propósito: el mapa necesita un solo color por territorio; aquí
     se mide mercado y Bogotá entera en una zona deformaría el ranking.
   - Sin IPS asignadas: entero a la zona de `municipality_zone` (Fase 2b, "de alcance").
   - Sin acceso terrestre o fuera de alcance: "Sin zona asignada".
   - La suma de todas las zonas da el total del país: nada se cuenta dos veces.
   - Zona → Ejecutivo Comercial: la cobertura de la línea elegida (`coverage`), igual que el ranking de
     giros (Vacante en gris, Conflicto en ámbar).
6. **Giros ADRES** (12 meses que terminan en el último mes cargado de la fuente): la misma elección
   automática que `/api/intelligence/giros` (`chooseGirosSource`): "Identifica tu Giro"
   (`adres_giros_detalle`, contributivo + subsidiado; no entra "otro": recobros, SOAT, pruebas COVID)
   cuando esté cargado para el 90 % de los NIT activos; si no, el Reporte 29 (`adres_giros`, solo
   subsidiado). El giro va al NIT y se reparte entre las sedes activas por camas
   (`sedeShares`). Por municipio cuenta el municipio de la IPS; por zona, su zona asignada.
7. **Capacidad**: camas (`reps_beds` si la IPS tiene capacidad importada del REPS; si no, `beds` de la
   ficha) y quirófanos (`quirofanos` del REPS). Hoy ninguna IPS tiene datos del REPS importados, así que
   la capacidad es solo camas de la ficha.

### Índice potencial (0-100)

```
potencial = 100 × (0,5 × A + 0,3 × G + 0,2 × C)

A = afiliados ponderados / máximo        afiliados ponderados = contributivo × 1,0 + subsidiado × 0,6
G = giros ADRES 12 meses / máximo
C = (camas / máximo + quirófanos / máximo) / 2   si algún grupo tiene quirófanos del REPS
    camas / máximo                               si no
```

- "Máximo" = el valor más alto entre las filas devueltas con los filtros actuales. Cambiar de filtro
  cambia el índice: es un orden relativo para priorizar, no una cifra de mercado.
- Excepción y especiales no pondera (contratan por fuera de las EPS). El subsidiado pesa 0,6 porque
  paga menos por afiliado que el contributivo.
- Un máximo en 0 deja ese término en 0 (nunca se divide por cero). Una sola fila con todo vale 100.
- La UI lo explica en "¿Cómo se calcula el potencial?" y cada fila muestra sus tres términos al pasar
  el cursor. Constantes: `POTENCIAL_PESOS` y `AFILIADOS_PESOS` en `web/lib/poblacion-intelligence.ts`.
- Ejemplo real (ago-2026, todo el país, por municipio): Bogotá 100; Medellín 40,5 (A 0,36, G 0,48,
  C 0,39); Cali 30,1; Barranquilla 22,3.

### API

| Ruta | Permiso | Respuesta |
| --- | --- | --- |
| `GET /api/intelligence/poblacion?group=municipio\|zona\|ejecutivo&line=<code>&departamento=<DANE 2>&municipio=<DANE 5>&corte=YYYY-MM` | `intelligence:view` | `PoblacionApiResponse`: `kpis`, `rows`, `corte`, `cortes`, `bduaCorte`, `poblacionAnio`, `giros` (fuente y rango), `sources`, `filters`, `formula`, `notes`, `capacidadConQuirofanos` |
| `GET /api/intelligence/poblacion/hospital/[id]` | `hospitals:view` | `HospitalEntornoResponse`: `municipio` (afiliados, cobertura, top 3 EPS), `ranking` (posición, IPS con giro, IPS activas, giro de la IPS y del municipio, %), cortes y fuentes |

- Mismas reglas de líneas que `/api/intelligence/giros`: `line` es opcional salvo para `group=ejecutivo`
  (400 "Elige una línea…"); 403 si la línea no está entre las del usuario (`findAccessibleLine`).
- Sin `corte`: el más reciente de `afiliacion_cifras`. Un corte que no existe → 400.
- Si falta una tabla o función (migración no aplicada o revertida), esa fuente queda en
  `sources.<fuente> = false` y el resto responde.
- La ruta de la ficha no devuelve nombres ni cifras de otras IPS: solo la posición y el total del
  municipio.
- Tiempos medidos en local (dev, 2026-10-11): 1,5-2,6 s por consulta; la de todo el país por municipio
  pesa ~1 MB sin comprimir (1.121 filas con sus 5 EPS).

### Migración 0660 (aplicada el 2026-10-11, aditiva)

`database/migrations/2026-10-11_0660_poblacion_api.sql` (rollback
`2026-10-11_9930_poblacion_api_rollback.sql`): dos funciones de solo lectura, SECURITY INVOKER,
`search_path` fijo, EXECUTE solo para `service_role`.

- `poblacion_cortes()` → cortes de `afiliacion_cifras` y `bdua_afiliados` y años de
  `dane_proyecciones` (PostgREST no tiene DISTINCT).
- `poblacion_bdua_resumen(p_corte, p_top_eps = 12)` → afiliados activos por municipio y régimen, las N
  EPS más grandes por municipio y los nombres. Hace falta porque `bdua_afiliados` tiene 53.634 filas en
  el corte del 2026-10-02 (paginar de a 1.000 serían 54 peticiones); devuelve ~470 KB. Comprobación:
  contributivo 22.925.548 + subsidiado 27.009.982 = 49.935.530 = activos 49.942.999 − 7.469 sin cruce de
  municipio.

### Código

| Archivo | Qué hace |
| --- | --- |
| `web/lib/poblacion-intelligence.ts` | Funciones puras: fuentes por municipio (`resolveMunicipios`), reparto municipio → zona (`municipioZoneShares`), giro por IPS (`hospitalGiroMap`), agregación (`aggregatePoblacion`), potencial (`computePotencial`), EPS (`epsGroupKey`, `epsDisplayName`, `mergeBduaEps`, `topEps`), ficha (`summarizeEntorno`, `rankInMunicipio`, `summarizeBduaRows`), parámetros, cortes y CSV |
| `web/app/api/intelligence/_lib/poblacion-server.ts` | Lecturas de Supabase (service_role), con cada fuente opcional |
| `web/app/api/intelligence/poblacion/route.ts` y `.../poblacion/hospital/[id]/route.ts` | Las dos rutas |
| `web/components/IntelligencePoblacion.tsx` | La sección de `/inteligencia` (una línea en `app/inteligencia/page.tsx`) |
| `web/components/HospitalEntornoCard.tsx` | La tarjeta de la ficha (una línea en `app/hospitals/[id]/page.tsx`) |
| `web/scripts/poblacion-api-check.ts` | Pruebas puras (`npm run poblacion-api:check`, también dentro de `npm run test`) |

### UI

- Filtros en una fila: línea, departamento, municipio, corte de afiliación (los 14 meses cargados),
  Restablecer y Exportar CSV.
- KPIs: afiliados (con contributivo / subsidiado / excepción), cobertura (con la población DANE),
  % contributivo (con municipios con cifras y corte) y giros ADRES de 12 meses (con fuente y rango).
- Ranking: pestañas Municipio / Zona / Ejecutivo Comercial (esta pide línea); columnas ordenables por
  afiliados, población, cobertura, giros y potencial (por defecto potencial); barra apilada por
  régimen (azul contributivo, naranja subsidiado, gris excepción; paleta validada con el validador de
  dataviz, con leyenda); 3 EPS dominantes en la tabla y las 5 en el título; potencial con barra.
  Un municipio repartido entre zonas aparece como "(compartido)".
- Celular: tarjetas (como el ranking de giros) con un selector "Ordenar por". Sin desbordamiento
  horizontal a 390 px.
- CSV para Excel en español (BOM, `;`, CRLF, decimales con coma, protección contra fórmulas), con las
  filas en el orden que se ve.

### Límites

- La BDUA es una foto (un corte: 2026-10-02); las cifras de MinSalud van de jul-2025 a ago-2026. Las EPS
  dominantes usan la BDUA más cercana al corte elegido, aunque sea de otro mes.
- No hay cifras por localidad: Bogotá se reparte entre sus zonas por camas, no por población de cada
  localidad.
- Los giros del Reporte 29 llegan hasta jun-2025; con Identifica tu Giro (cuando cubra el 90 % de los
  NIT) la ventana de 12 meses se mueve a 2026.
- El potencial es relativo al filtro y no mide precios, competencia ni el portafolio por línea.

### Pruebas

`cd web && npm run poblacion-api:check` (sin red ni base): reparto por camas, por número de IPS y por
alcance; que la suma por zonas sea el total; fuentes (MinSalud → BDUA; DANE → MinSalud →
municipalities); agregación por municipio, zona y ejecutivo con datos ficticios; potencial (pesos,
normalización, todo en cero, una fila, quirófanos); top EPS y unión de códigos; filtros; ranking de
giros en el municipio; parámetros, cortes, año DANE y CSV.
