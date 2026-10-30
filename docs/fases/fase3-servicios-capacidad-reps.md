# Fase 3 (2026-10-11): servicios habilitados y capacidad instalada del REPS

Pedido del dueño: la IPS debe "tener servicios habilitados e info que me dé a entender qué tan grande
es". Y sobre el PDF mensual: "investiga si podemos capturar la data de un PDF que se genera por mes".

Migración `database/migrations/2026-10-11_0620_fase3_servicios.sql` (rollback
`2026-10-11_9930_servicios_rollback.sql`). **Aplicada** en Supabase el 2026-10-11 (aditiva: 3 tablas,
5 columnas en `hospitals`, 1 función; el CHECK de `hospital_history.action` solo se amplía con `import`).
Importar **nunca** recalcula asignaciones ni llama a Google (las IPS no cambian de ubicación).

## Procedimiento (lo hace una persona: el portal del REPS pide entrar)

1. Portal del REPS del Ministerio de Salud, perfil **invitado**.
2. Consulta **Servicios** (criterios: NIT, departamento, municipio, código de sede…) y exporta a
   **Excel** o a texto separado por `;`. Consulta **Capacidades instaladas** (grupo camas / salas /
   ambulancias, concepto, cantidad) y exporta igual. Mejor por departamento o municipio, **sin**
   filtrar por grupo ni por servicio (si se filtra, aplicar con "Solo añadir").
3. En OpMap: IPS → **Importar del REPS** (solo `admin` y `data_manager`) → subir el archivo
   (máx. **4 MB**: Vercel corta el cuerpo en 4,5 MB; un Excel comprime mucho más que el texto) →
   "Analizar (simulación)". Revisar las columnas detectadas (se pueden cambiar a mano y volver a
   analizar) y la simulación por sede (filtros "Con cambios" y "Sin cruce").
4. "Aplicar" (confirmación con cifras). La simulación caduca a los 30 minutos y solo la puede aplicar
   quien la subió.
5. Las sedes **ambiguas** (un NIT con varias sedes) se vinculan en la ficha de la IPS (sección "Sede
   REPS", Fase 3 de sedes: `docs/fases/fase3-reps.md`) y se vuelve a importar el mismo archivo.

**PDF**: se lee un PDF **con texto** (que se pueda seleccionar), con pdf.js en el servidor: filas por
posición vertical y columnas por la posición de los encabezados (también encabezados partidos en dos
renglones, encabezado repetido por página, celdas partidas y pies "Página n de m"). Un PDF escaneado
(imágenes) responde "PDF sin texto (escaneado): requiere OCR"; si hay texto pero no se reconoce ningún
encabezado, avisa y separa columnas por posición para mapearlas a mano. No tenemos una muestra del
"PDF que se genera por mes": cuando el dueño lo comparta hay que probarlo en la simulación (sin
aplicar) y, si es escaneado, decidir si vale la pena OCR (no incluido) o usar el Excel del portal.

## Modelo

- **`hospital_services`**: `reps_code` (código de habilitación de la sede, 12 dígitos; 10 si el archivo
  solo trae el del prestador y el REPS no permite resolver la sede; `NIT-<nit>` si solo trae NIT y una
  sede), `hospital_id` (NULL permitido, `ON DELETE SET NULL`), `service_code`, `service_name`,
  `group_name`, `complexity`, `modality` ('' si no hay), `source` ('reps-servicios'), `imported_at`.
  UNIQUE (`reps_code`, `service_code`, `modality`): una fila por servicio y modalidad.
- **`hospital_capacity`**: `reps_code`, `hospital_id`, `group_name` ∈ camas | salas | ambulancias |
  otros, `concept` (en "otros" lleva el grupo original: "SILLAS: Hemodiálisis"), `quantity` (suma por
  sede, grupo y concepto: cada ambulancia del REPS es una fila con su placa), UNIQUE (`reps_code`,
  `group_name`, `concept`).
- **`hospital_import_jobs`**: token de la simulación (id), tipo, modo, archivo (nombre, tipo, sha256),
  `rows` (filas normalizadas de las sedes con cruce; se vacía al aplicar o caducar), `summary`,
  `result`, `created_by`, `expires_at` (30 min), `status` ∈ previewed | applied | expired | failed.
  Se guarda en tabla y no en memoria porque en Vercel la vista previa y la aplicación pueden caer en
  instancias distintas.
- **`hospitals`** (resumen para filtrar): `quirofanos`, `reps_beds` (no reemplaza a `beds`, que es dato
  manual), `service_flags` jsonb (default `{}` = sin dato; tras importar trae las 9 claves true/false),
  `reps_services_count`, `reps_updated_at`.
- **`reps_import_apply(job, payload)`**: aplica todo en UNA transacción (enlaza filas, borra retiradas,
  upserts, columnas de `hospitals`, `hospital_history` con action `import` por IPS con cambios, cierra
  el job). Bloquea el job (`FOR UPDATE`): una segunda aplicación falla con OPM11. Solo `service_role`.
  Medido el 2026-10-11 (transacción deshecha): 30.000 servicios en 729 ms (el límite de PostgREST es 8 s).
- Las 3 tablas: RLS activado, sin políticas, sin privilegios para anon/authenticated.

## Reglas

- **Solo se guardan las sedes con cruce.** Las ambiguas y sin cruce se listan en la simulación y no
  se tocan (vincularlas y volver a importar).
- **Cruce sede → IPS** (`matchSedes` en `web/lib/reps-import.ts`):
  1. `hospitals.reps_code` = código de la sede (vínculo de la Fase 3 de sedes) → "Código de habilitación vinculado".
  2. La sede ya quedó enlazada en una importación anterior → "Vínculo de una importación anterior".
  3. Por NIT (del archivo o de `reps_sedes`) entre las IPS **sin** `reps_code`: el NIT tiene una sola sede
     en el REPS (o en el archivo si `reps_sedes` no lo conoce) y una sola IPS → "NIT (única sede)", con
     aviso si el municipio no coincide; varias sedes → solo si esta es la **única sede del NIT en el
     municipio de la IPS** ("NIT + municipio"); si no, **ambigua**.
  4. Una IPS = una sede: si varias la piden, gana el método más fuerte; con empate, todas ambiguas.
  - Código de prestador (10 dígitos) con una sola sede en `reps_sedes` → se usa el código de esa sede.
  - Excel quita el 0 inicial (Antioquia, Atlántico…): 11 dígitos → 12, 9 → 10.
- **Modo "Reemplazar"** (por defecto): de cada sede con cruce se retiran los servicios (o capacidades)
  guardados que no están en el archivo, **solo en los grupos que trae el archivo** (si el archivo no
  trae grupo de servicio, todos). Así un archivo de solo "Quirúrgicos" no borra la consulta externa, y
  un archivo de capacidad sin ambulancias no borra las ambulancias. **"Solo añadir"** nunca retira.
  Las filas guardadas de la IPS bajo otra sede (vínculo anterior) cuentan como reemplazables.
- `quirofanos` = suma de "salas" cuyo concepto contiene "quirófano" o "sala(s) de cirugía" (no partos
  ni procedimientos); solo se recalcula si el archivo trae el grupo salas (o la IPS ya tenía salas).
  `reps_beds` = suma del grupo camas, con la misma condición.
- **Clasificación** (Res. 3100 de 2019, por NOMBRE del servicio sin tildes; el código solo si la fila
  no trae nombre): `cirugia_ortopedica` (cirugía ortopédica; 207), `ortopedia` (ortopedia, traumatología;
  207, 339), `trauma` (traumatología, trauma, politrauma; 339), `neurocirugia` (neurocirugía, cirugía
  neurológica; 206, 387), `columna` (columna, raquis, vertebral), `medicina_deportiva` (deporte),
  `cirugia_mano`, `urgencias`, `uci_adultos` (cuidado intensivo adulto). "Ortodoncia" no es ortopedia.
- **Filtros** (`web/lib/hospital-service-filters.ts`, misma regla en la lista y en el mapa, Y lógico):
  "Con quirófano" (`quirofanos` > 0), "Ortopedia" (ortopedia o cirugía ortopédica), "Neurocirugía",
  "Columna" (cirugía de columna **o neurocirugía**, porque la Res. 3100 no siempre la trae como servicio
  propio), rango de camas (camas del REPS o, si no hay, las de la ficha). Una IPS sin datos del REPS no
  pasa un filtro de servicio.
- Detección de columnas tolerante (tildes, mayúsculas, guion bajo, sinónimos de la consulta del portal
  y de datos abiertos: "Código Habilitación", `codigo_habilitacion`, "Código Sede", `serv_nombre`,
  `grse_nombre`, `coca_nombre`, "Grupo Capacidad", "Cantidad"…), fila de encabezados bajo títulos,
  columnas SI/NO de modalidad (intramural, telemedicina…) y de complejidad (baja/media/alta), "207 -
  NOMBRE" en una sola columna, CSV con `;` `,` tabulador o `|`, UTF-8/UTF-16/Windows-1252, y los
  ".xls" del portal que en realidad son HTML.

## API y permisos

- `POST /api/hospitals/import/preview` (multipart: `file`, `kind` auto|servicios|capacidad, `mode`
  replace|merge, `mapping` JSON opcional) → simulación + `token`. Si faltan columnas obligatorias:
  `needsMapping: true` sin token.
- `POST /api/hospitals/import/apply` `{token}` → 200 con conteos; 404 no existe o no es suya, 409 ya
  aplicada, 410 caducada.
- `GET /api/hospitals/[id]/reps-services` (`hospitals:view`): servicios y capacidad para la ficha
  (`components/HospitalRepsPanel.tsx`).
- `GET /api/map/data`: cada hospital trae además `service_flags`, `quirofanos`, `reps_beds` (con
  respaldo a las columnas antiguas si la migración no está).
- Importar: `hospitals:edit` **y** rol `admin` o `data_manager` (contract_manager no).

## UI

- `/hospitals/import`: archivo, tipo, modo, columnas (editables), filas inválidas, simulación por sede
  con filtros, barra fija "Aplicar" con confirmación.
- `/hospitals`: botón "Importar del REPS" (admin/data_manager), fila "Servicios (REPS)" con las 4
  casillas y el rango de camas, y chips (quirófanos, camas REPS, ortopedia, neurocirugía, columna).
- Mapa → "Filtros y visitas" → bloque **IPS** (mismas casillas y camas): solo oculta puntos; los
  territorios, colores e insignias no cambian.
- Ficha de la IPS: tarjeta "Servicios y capacidad (REPS)".

## Seguridad y límites

- El parseo de Excel en el servidor usa `xlsx` 0.18.5 (la última del registro npm), con avisos
  conocidos de contaminación de prototipo y ReDoS ante archivos manipulados (corregidos en SheetJS
  0.19.3 / 0.20.2, que se publican en cdn.sheetjs.com, no en npm). Mitigación actual: solo admin y
  data_manager suben archivos, máx. 4 MB / 200.000 filas. Pendiente: actualizar SheetJS desde su CDN
  oficial (también lo usa la importación de visitas en el navegador).
- PDF: pdf.js 4.10.38 con `isEvalSupported: false`, sin red, máx. 400 páginas. `next.config.js` deja
  `pdfjs-dist` fuera del bundle (`serverComponentsExternalPackages`); el worker se carga en el mismo
  hilo (`globalThis.pdfjsWorker`).

## Pruebas

`cd web && npm run reps-import:check` (= `npx tsx scripts/reps-import-check.ts`, también dentro de
`npm run test`): 90 pruebas puras el 2026-10-11 — encabezados con tildes, `;` y `,`, valores "12",
Excel con códigos numéricos, clasificación, cruce, simulación sobre datos ficticios (reemplazar / solo
añadir / alcance por grupo / capacidad) y un PDF con texto hecho a mano (encabezado en dos renglones y
repetido, celda partida) más uno sin texto ("requiere OCR").
