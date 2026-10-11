# Fase 3 (2026-10-11): sedes del REPS, servicios y capacidad, giros ADRES

Rama `feat/fase3-reps-adres`. Spec: `docs/specs/2026-10-11-fase3-reps-adres.md`. Decisiones del dueño:
`docs/decisiones/2026-10-11-sedes-reps-y-coordenadas.md`. Este archivo es la vista de conjunto. El
detalle de cada parte está en:

| Parte | Documento | Código principal |
| --- | --- | --- |
| Sedes del REPS (IPS por código de habilitación) | `docs/fases/fase3-reps.md` | `lib/reps-match.ts`, `scripts/reps-load-sedes.ts`, `scripts/reps-match.ts` |
| Servicios habilitados y capacidad instalada | `docs/fases/fase3-servicios-capacidad-reps.md` | `lib/reps-import.ts`, `/hospitals/import` |
| Giros directos de la ADRES | `docs/fases/fase3-adres.md` | `lib/adres-parse.mjs`, `lib/adres-intelligence.ts`, `scripts/adres-giros.mjs` |

Pedido del dueño (2026-10-11): "un NIT puede tener varias sedes… debe ser por código de habilitación y
debe tener servicios habilitados e info que me dé a entender qué tan grande es; también podemos hacer
inteligencia de negocio con los giros directos de la ADRES por NIT". Autorización: "Dale procede".
Coordenadas: "Yo no confiaría incluso en la dirección que esté en el REPS. Yo buscaría en Google Maps y
si hay certeza de que esa es la dirección [se usa], si se coloca de otra forma, no".

## Reglas (resumen de la decisión)

1. **Una IPS = una sede del REPS** (`hospitals.reps_code`, 12 dígitos, UNIQUE). El NIT es del
   prestador. `hospitals.nit` es una columna GENERADA desde `code` y nunca se escribe. El sufijo tras
   el guion de `code` no es el DV de la DIAN ni el número de sede: de las 79 IPS vinculadas con sufijo
   distinto de 1, solo 9 coinciden con el número de sede.
2. **Coordenadas de sedes nuevas: solo desde Google Maps, buscando por el nombre y con certeza.** Nunca
   se usa la dirección del REPS. Sin certeza, la sede queda "sin ubicar" (pendiente D4, ver abajo).
3. **Nada de la Fase 3 recalcula asignaciones ni llama a Google**: ni vincular una sede, ni importar
   servicios o capacidad, ni cargar giros. Crear o editar una IPS sigue la cola de pendientes
   (`docs/ips-pendientes.md`).
4. **El giro de la ADRES es por NIT.** Entre las sedes activas del mismo NIT se reparte por camas
   (`hospitals.beds`), o a partes iguales si ninguna tiene camas. Así nunca se cuenta dos veces.

## Migraciones (las tres APLICADAS el 2026-10-11 con autorización del dueño; aditivas)

| Archivo | Rollback | Qué crea |
| --- | --- | --- |
| `2026-10-11_0600_fase3_reps.sql` | `2026-10-11_9930_reps_rollback.sql` | `reps_sedes`. En `hospitals`: `reps_code`, `nit` (generada), `reps_match_status`, `reps_matched_at` |
| `2026-10-11_0610_fase3_adres.sql` | `2026-10-11_9930_adres_rollback.sql` | `adres_giros`, `adres_fetch_log` y la función `adres_giros_resumen()` |
| `2026-10-11_0620_fase3_servicios.sql` | `2026-10-11_9930_servicios_rollback.sql` | `hospital_services`, `hospital_capacity`, `hospital_import_jobs`, la función `reps_import_apply()`. En `hospitals`: `quirofanos`, `reps_beds`, `service_flags`, `reps_services_count`, `reps_updated_at` |

Las 6 tablas nuevas tienen RLS activado, sin políticas y sin privilegios para anon/authenticated; solo
las usa `service_role`. Los rollbacks son independientes entre sí. Detalle de la aplicación y de las
comprobaciones: `database/migrations/README.md`.

## Modelo en una página

- `reps_sedes` (PK `codigo_habilitacion`) es la copia del CSV de sedes del REPS (datos abiertos de
  MinSalud, datos.gov.co `c36g-9fc2`). Se cargan las clases IPS, objeto social diferente y transporte
  especial; **nunca** los profesionales independientes (personas naturales con datos personales). Su
  `direccion_sede` es solo un dato: no sirve para ubicar.
- `hospitals.reps_code` es una "FK suave": no tiene FOREIGN KEY porque `reps_sedes` se recarga cada mes.
  `reps_match_status` ∈ `matched` | `ambiguous` | `unmatched` (NULL = sin evaluar).
- `hospital_services` tiene una fila por sede, servicio y modalidad. `hospital_capacity` tiene una fila
  por sede, grupo (camas, salas, ambulancias, otros) y concepto. `hospital_import_jobs` guarda la
  simulación (token de 30 min; vive en una tabla porque en Vercel la vista previa y la aplicación pueden
  caer en instancias distintas).
- `adres_giros` tiene una fila por NIT, mes, régimen, tipo (Capitación o Evento) y EPS, en COP.
  `adres_fetch_log` es la bitácora de cada consulta y la usa el script para reanudar.

## Scripts y comandos (desde `web/`, ninguno llama a Google)

```bash
# Sedes del REPS (cada corte mensual)
npx tsx scripts/reps-load-sedes.ts --file <reps_sedes.csv> --dry-run   # solo cuenta
npx tsx scripts/reps-load-sedes.ts --file <reps_sedes.csv> --prune     # upsert y borra sedes que ya no vienen
npx tsx scripts/reps-match.ts                 # informe de solo lectura en REPS_OUTPUT_DIR/reps-match-report.md
npx tsx scripts/reps-match.ts --apply         # escribe vínculos; nunca pisa un reps_code existente

# Giros ADRES (régimen subsidiado)
node scripts/adres-giros.mjs --desde 2023-07  # primera carga: todos los NIT de IPS activas (reanudable)
node scripts/adres-giros.mjs                  # recarga: 24 meses hasta fin del mes pasado
node scripts/adres-giros.mjs --nit 891200679 --dry-run   # probar sin escribir

# Pruebas puras sin red (también dentro de npm run test / npm run check)
npm run reps:check          # 55
npm run reps-import:check   # 90
npm run adres:check         # 112
```

El script de la ADRES hace peticiones HTTP normales con un User-Agent propio que se identifica
(`OpMap-giros-ADRES/1.0`). El firewall de la ADRES bloquea Chrome headless y **no se evade**: si bloquea
al script, este se detiene sin reintentar.

## Procedimiento humano: exportar servicios y capacidad del REPS (perfil invitado)

El portal del REPS pide entrar, así que esta exportación la hace una persona:

1. Entrar al portal del REPS del Ministerio de Salud con el perfil **invitado**.
2. Abrir la consulta **Servicios** y filtrar por departamento o municipio, **sin** filtrar por grupo ni
   por servicio. Exportar a **Excel** o a texto separado por `;`.
3. Repetir con la consulta **Capacidades instaladas** (camas, salas, ambulancias).
4. En OpMap: Hospitales → **Importar del REPS** (solo `admin` y `data_manager`). Subir el archivo (máx.
   **4 MB**; el Excel comprime más que el texto) → "Analizar (simulación)". Revisar las columnas
   detectadas y la simulación por sede ("Con cambios", "Sin cruce").
5. "Aplicar" (pide confirmar con cifras). La simulación caduca a los 30 minutos y solo la puede aplicar
   quien la subió.
6. Las sedes **ambiguas** se vinculan en la ficha de la IPS (sección "Sede REPS") y después se vuelve a
   importar el mismo archivo. Si el archivo se exportó filtrado por grupo, aplicar con "Solo añadir".

Mantenimiento mensual de sedes: descargar el CSV nuevo de datos.gov.co → `reps-load-sedes.ts --prune` →
`reps-match.ts` (revisar el informe) → `reps-match.ts --apply`. Las IPS nuevas quedan "Sin evaluar" hasta
el siguiente `--apply`, o se vinculan a mano.

## Estado real de los datos (2026-10-11)

- **Sedes**: 22.164 (corte del 12-mar-2026). Cruce aplicado: **730 vinculadas** (332 NIT con una sede,
  66 con una sola sede en el municipio, 321 con el mismo nombre, 11 con nombre parecido), **35 ambiguas**
  (29 con sugerida) y **22 sin cruce** (UPRES, hospitales militares y de policía, y NIT que no aparecen
  en el corte). 2 vinculadas tienen la sede en otro municipio.
- **Giros**: carga completa de **701 NIT** sin errores: 553 con datos, 148 sin registros, **62.480
  filas**, **$ 26,96 billones COP** entre jul-2023 y jun-2025. La tabla tiene además los 3 NIT de la
  prueba previa (512 filas), así que `adres_fetch_log` muestra 556 con datos y 148 sin registros.
- **Servicios y capacidad**: la migración está aplicada, pero todavía no se ha importado ningún archivo
  real (0 filas). Tampoco hay una muestra del "PDF mensual" del dueño.

## API, permisos y UI

| Ruta | Permiso | Para qué |
| --- | --- | --- |
| `GET /api/hospitals/reps/summary`, `GET /api/hospitals/reps/sedes` | `hospitals:view` | Conteos del cruce y buscador de sedes |
| `GET` y `PATCH /api/hospitals/[id]/reps-link` | `hospitals:view` / `hospitals:edit` | Ver candidatas; vincular o desvincular (con `hospital_history`) |
| `POST /api/hospitals/import/preview`, `/apply` | `hospitals:edit` + rol admin o data_manager | Simulación y aplicación del importador |
| `GET /api/hospitals/[id]/reps-services` | `hospitals:view` | Servicios y capacidad para la ficha |
| `GET /api/intelligence/giros` | `intelligence:view` (nuevo) | Ranking por IPS, municipio, zona o ejecutivo |
| `GET /api/intelligence/giros/hospital/[id]` | `hospitals:view` | Tarjeta "Giros ADRES" de la ficha |

`intelligence:view` lo tienen admin, commercial_director, line_leader, data_manager y viewer.

- **Páginas**: `/hospitals/reps` ("Cruce REPS"), `/hospitals/import`, `/inteligencia`.
- **Ficha de IPS**: secciones "Sede REPS", "Servicios y capacidad (REPS)" y "Giros ADRES".
- **Filtros**: en `/hospitals` y en el bloque **IPS** de "Filtros y visitas" del mapa, que solo oculta
  puntos (no cambia estilos; ver `docs/mapa-estetica.md`).

## Corrección transversal: caché de Next.js

`web/lib/supabase-admin.ts` hace todas sus consultas con `cache: 'no-store'`. En Next 14, las rutas GET
con `dynamic = 'force-dynamic'` guardaban para siempre el fetch de supabase-js en la Data Cache. Afectaba
a los giros y también a la cola de pendientes, a los usuarios (sesión) y al territorio. No se debe quitar.

## Límites (decirlos siempre que se muestren estas cifras)

- **PDF solo con texto**: un PDF escaneado responde "requiere OCR" y no hay OCR. El portal del REPS
  exige login, así que no hay descarga automática.
- **ADRES**:
  - Solo régimen **subsidiado** (el contributivo daba error el 2026-10-11).
  - Datos publicados hasta **junio-2025**; por defecto se muestran los 12 meses que terminan en el último
    mes cargado.
  - El giro es por NIT: en un NIT compartido, el reparto por camas es una estimación.
- **Excel**: `xlsx` 0.18.5 de npm tiene avisos conocidos (contaminación de prototipo y ReDoS). Se mitiga
  con solo admin y data_manager, máx. 4 MB y 200.000 filas. Queda pendiente actualizar desde el CDN de
  SheetJS.
- La sugerida de una sede ambigua nunca se aplica sola.

## Pendientes

- **D4, geocodificación de sedes nuevas**: solo desde Google Maps, buscando por el nombre, con un
  criterio de certeza explícito; sin certeza → "sin ubicar" (sin coordenadas, fuera de la cola de rutas
  y de cualquier territorio). Necesita una spec propia, un dry-run con cifra y la autorización de gasto
  del dueño. Gasto de Google en esta fase: ninguno.
- Vincular a mano las 35 ambiguas y revisar las 22 sin cruce.
- Primera importación real de servicios y capacidad. Probar el PDF mensual del dueño cuando lo comparta.
- Régimen contributivo de la ADRES y giros posteriores a junio-2025.
- Actualizar SheetJS.
