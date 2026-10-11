# Spec: Fase 3 – sedes del REPS, servicios y capacidad, giros ADRES  (2026-10-11)

**Estado**: implementada (PR pendiente). Rama `feat/fase3-reps-adres`. Las migraciones 0600, 0610 y 0620
ya están **aplicadas** en Supabase, con autorización del dueño (las tres son aditivas).

Detalle de modelo, scripts, comandos y límites: `docs/fases/fase3-reps-adres.md`. Decisiones del dueño:
`docs/decisiones/2026-10-11-sedes-reps-y-coordenadas.md`. El importador de servicios tiene además su
spec propia, más detallada: `docs/specs/2026-10-11-reps-servicios-capacidad.md`.

## Problema
Hoy una IPS de OpMap se identifica por NIT (`hospitals.code` = NIT-sufijo). Un NIT puede tener varias
sedes, así que no se sabe qué sede es cada IPS, qué servicios tiene habilitados ni qué tan grande es.
Tampoco hay datos de cuánto dinero recibe cada IPS.

Pedido literal del dueño (2026-10-11):
- "un NIT puede tener varias sedes… debe ser por código de habilitación y debe tener servicios
  habilitados e info que me dé a entender qué tan grande es; también podemos hacer inteligencia de
  negocio con los giros directos de la ADRES por NIT".
- "Dale procede".
- Sobre coordenadas: "Yo no confiaría incluso en la dirección que esté en el REPS. Yo buscaría en Google
  Maps y si hay certeza de que esa es la dirección [se usa], si se coloca de otra forma, no".

## Resultado esperado
- Cada IPS queda vinculada a una **sede del REPS** por su código de habilitación (12 dígitos), o marcada
  como ambigua o sin cruce. Las pendientes se resuelven a mano desde la ficha ("Sede REPS") o desde
  `/hospitals/reps` ("Cruce REPS").
- Un admin o un gestor de datos importa del portal del REPS los **servicios habilitados** y la
  **capacidad instalada** (Excel, CSV o PDF con texto). Primero ve una simulación y después aplica. La
  lista de IPS y el mapa filtran por quirófano, ortopedia, neurocirugía, columna y camas.
- `/inteligencia` muestra los **giros directos de la ADRES** (régimen subsidiado) por IPS, municipio,
  zona y Ejecutivo Comercial. La ficha de cada IPS trae la tarjeta "Giros ADRES".
- Nada de esto recalcula asignaciones, llama a Google ni cambia la estética del mapa.

## Criterios de aceptación (pruebas reales, puras y sin red; todas dentro de `npm run test`)

**Sedes del REPS: `web/scripts/reps-check.ts` (`npm run reps:check`, 55 pruebas)**
- [x] Con una sola sede para el NIT, la IPS queda `matched`, aunque la sede esté en otro municipio; en ese
      caso avisa ("a) 1 sede → matched…", "a) avisa municipio distinto").
- [x] Con varias sedes y solo una en el municipio de la IPS, queda `matched` ("b)").
- [x] Con varias sedes en el municipio, gana la única con el mismo nombre ("c)", "l1)", "l2)") o con un
      nombre muy parecido sin rival ("i)", "j)").
- [x] Si hay empate, queda `ambiguous`; la sugerida es la de código más bajo cuando las sedes tienen el
      mismo nombre ("d)"), y sin sugerida cuando empata el parecido ("e)").
- [x] Si el NIT no tiene sedes, o `code` no tiene forma de NIT, queda `unmatched` ("f)", "x)").
- [x] Una sede, una IPS: si dos IPS la piden con la misma fuerza, las dos quedan ambiguas ("g)", "k)",
      "una sede, una IPS (sin códigos repetidos)").
- [x] Un vínculo existente (automático o manual) no se toca y su sede no se ofrece a otra IPS ("h1)",
      "h2)").
- [x] El cruce es idempotente y converge en varias vueltas ("segunda pasada…", "varias vueltas…").
- [x] El NIT sale de `hospitals.code` con la misma regla que la columna generada `hospitals.nit`
      (sección 2). El sufijo tras el guion no se usa como DV.
- [x] El CSV del REPS se lee bien (comillas, CRLF, fecha de corte). Se cargan solo las clases IPS,
      objeto social diferente y transporte, nunca profesionales independientes (sección 3).

**Servicios y capacidad: `web/scripts/reps-import-check.ts` (`npm run reps-import:check`, 90 pruebas)**
- [x] Lee encabezados con tildes, guion bajo y sinónimos; CSV con `;`, `,`, tabulador o `|`;
      Windows-1252 y UTF-8 con BOM; cantidades "12", "1.500" y "doce" (sección 1).
- [x] Normaliza códigos de 11 a 12 dígitos (Excel quita el 0 inicial), prestador + sede y NIT con DV
      (sección 2).
- [x] Clasifica según la Res. 3100/2019 por nombre del servicio: ortopedia, cirugía ortopédica, trauma,
      neurocirugía, columna, deporte, UCI y urgencias. "Ortodoncia" no cuenta como ortopedia. Cuenta
      quirófanos y camas desde la capacidad (sección 3).
- [x] Cruce sede → IPS por `hospitals.reps_code`, por importación previa o por NIT inequívoco. Las
      ambiguas y las sin cruce no se guardan (sección 4).
- [x] Simulación: "Reemplazar" retira solo dentro de los grupos que trae el archivo y "Solo añadir" nunca
      retira. Calcula `service_flags`, quirófanos y camas del REPS (sección 5).
- [x] Un PDF con texto se convierte en tabla. Un PDF escaneado responde "PDF sin texto (escaneado):
      requiere OCR" (sección 6).
- [x] El filtro de IPS es el mismo en la lista y en el mapa (Y lógico; "Columna" = columna o
      neurocirugía; las camas salen del REPS y, si no hay, de la ficha) (sección 7).
- [x] La aplicación ocurre en una sola transacción y una segunda aplicación queda bloqueada (OPM11). Esto
      se probó contra Supabase en una transacción deshecha (ver `database/migrations/README.md`), no en
      el script.

**Giros ADRES: `web/scripts/adres-check.ts` (`npm run adres:check`, 112 pruebas)**
- [x] Lee el CSV y el XML del Reporte 29 con muestras literales de la ADRES. La suma de las filas cuadra
      con el total del reporte; si no cuadra, el script reintenta o registra un error (secciones 2 y 3).
- [x] Reconoce las columnas por nombre o, si no, por contenido. Lee valores es-CO, meses en español y el
      NIT con o sin DV (secciones 1 y 2).
- [x] Detecta la página del firewall (`isBlockedPage`) para detenerse sin evadirla (sección 4).
- [x] El giro de un NIT con varias sedes se reparte por camas (75/25) o a partes iguales si ninguna tiene
      camas. El total no cuenta dos veces un NIT compartido (sección 5).
- [x] Agrega por IPS, municipio, zona y Ejecutivo Comercial (vacante incluida, "Sin zona asignada"
      aparte) y filtra por departamento y municipio (sección 5).
- [x] Parámetros de la API: `group=ejecutivo` exige línea, meses válidos, `desde ≤ hasta`, máximo 60
      meses; por defecto toma los 12 meses que terminan en el último mes con datos (secciones 4 y 6).

## Fuera de alcance
- **D4: geocodificar sedes nuevas.** Se hará solo desde Google Maps por nombre y con certeza (decisión
  del dueño). Necesita una spec propia, un dry-run con cifra y autorización de gasto. En esta fase no se
  crean IPS desde el REPS ni se cambian coordenadas.
- OCR de PDF escaneados y descarga automática del portal del REPS (pide login humano).
- Régimen contributivo de la ADRES (el servicio daba error el 2026-10-11) y giros posteriores a
  junio-2025 (la ADRES no los publica).
- Cambios al algoritmo de asignación, a la cobertura por línea o al estilo del mapa.

## Impacto
- **Datos / migración**: sí, las tres **ya aplicadas en Supabase el 2026-10-11 con autorización del
  dueño** (aditivas: no borran ni reescriben datos existentes):
  - `database/migrations/2026-10-11_0600_fase3_reps.sql` (rollback `2026-10-11_9930_reps_rollback.sql`).
  - `database/migrations/2026-10-11_0610_fase3_adres.sql` (rollback `2026-10-11_9930_adres_rollback.sql`).
  - `database/migrations/2026-10-11_0620_fase3_servicios.sql` (rollback
    `2026-10-11_9930_servicios_rollback.sql`).
  - Cargas hechas: 22.164 sedes (corte 12-mar-2026); cruce aplicado (730 / 35 / 22); giros de 701 NIT
    (62.480 filas) en la carga completa; con los 3 NIT de la prueba previa, la base tiene 704 NIT en
    `adres_fetch_log` (556 con giros, 148 sin registros, 0 errores) y 62.992 filas en `adres_giros`
    (verificado con SQL de solo lectura el 2026-10-11). La nota de `/inteligencia` muestra las cifras de
    la base (704 / 556 / 148). Todavía no se ha importado ningún archivo de servicios ni de capacidad.
- **Costo Google Maps**: 0 elementos (US$ 0). Ningún script ni ruta nueva llama a Google.
- **Estética del mapa**: no cambia. Solo se añade el bloque de filtros "IPS" en "Filtros y visitas", que
  oculta puntos sin cambiar colores, territorios, insignias ni leyenda (autorizado dentro de la Fase 3;
  ver `docs/mapa-estetica.md`).
- **Permisos / roles**:
  - Nuevo `intelligence:view` para admin, commercial_director, line_leader, data_manager y viewer
    (sales_manager, contract_manager y user no lo tienen).
  - Importar del REPS requiere `hospitals:edit` y rol admin o data_manager.
  - Vincular o desvincular una sede requiere `hospitals:edit`; ver el cruce, `hospitals:view`.

## Plan (archivos e interfaces)
- Lógica pura: `web/lib/reps-match.ts`, `web/lib/reps-import.ts`, `web/lib/reps-import-fields.ts`,
  `web/lib/reps-pdf.ts`, `web/lib/hospital-service-filters.ts`, `web/lib/adres-parse.mjs`,
  `web/lib/adres-intelligence.ts`, `web/lib/giros-format.ts`.
- Scripts: `web/scripts/reps-load-sedes.ts`, `web/scripts/reps-match.ts`, `web/scripts/adres-giros.mjs`, y
  las pruebas `reps-check.ts`, `reps-import-check.ts` y `adres-check.ts`.
- API: `/api/hospitals/reps/{summary,sedes}`, `/api/hospitals/[id]/reps-link` (GET y PATCH),
  `/api/hospitals/[id]/reps-services`, `/api/hospitals/import/{preview,apply}`,
  `/api/intelligence/giros` y `/api/intelligence/giros/hospital/[id]`. También cambian
  `/api/hospitals` (acepta `reps_code`) y `/api/map/data` (banderas de servicio).
- UI: `app/hospitals/reps`, `app/hospitals/import`, `app/inteligencia`, `components/RepsSedeSection.tsx`,
  `components/HospitalRepsPanel.tsx`, `components/HospitalGirosCard.tsx`,
  `components/GirosMonthlyChart.tsx`, y los filtros en `app/hospitals/page.tsx` y
  `components/MapControls.tsx`.
- Transversal: `web/lib/supabase-admin.ts` consulta con `cache: 'no-store'`. Next 14 guardaba en caché
  las lecturas de las rutas `force-dynamic`; afectaba también a la cola de pendientes, a usuarios y al
  territorio.
- Patrones seguidos: `requirePermission`, `service_role` en el servidor, tablas con RLS sin políticas, y
  pruebas puras en `scripts/*-check.ts`.

## Verificación final
- `cd web && npm run check` (typecheck, lint y las 4 suites: 109 + 55 + 90 + 112). La salida literal va
  en el PR.
- Capturas de escritorio y de celular de `/hospitals/reps`, la ficha (sección "Sede REPS" y tarjeta
  "Giros ADRES"), `/hospitals/import` (simulación), `/inteligencia` y el bloque "IPS" del mapa.
- Datos reales (solo lectura, 2026-10-11): `reps_sedes` = 22.164; estados 730 `matched`, 35 `ambiguous`
  y 22 `unmatched`; `adres_fetch_log` = 556 NIT con datos y 148 sin registros (incluye los 3 NIT de la
  prueba previa).
