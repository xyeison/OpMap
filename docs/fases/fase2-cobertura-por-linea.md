# Fase 2 (2026-10-11): cobertura por línea y mapa por línea

Rama `fase2/cobertura-por-linea`. Migración `database/migrations/2026-10-11_0400_fase2_cobertura.sql`
(rollback `2026-10-11_9910_fase2_rollback.sql`; ver README). **Escrita, no aplicada**: aplicarla y
desplegar el código en la misma ventana, luego "Recalcular cobertura" en `/lines` y cambiar la
contraseña de los 2 usuarios nuevos desde `/users`.

- **Idea**: el país se reparte **por línea de negocio**. Una zona puede estar cubierta por una
  ejecutiva en una línea y por otra en otra línea (ej.: Cartagena líneas 1-2 → la de Cartagena;
  líneas 3-4 → la segunda de Barranquilla por alcance). El mapa siempre se ve por línea.
- **Modelo (0400)**:
  - `kams.name` pasa a nombre comercial de la zona ("Atlántico y Magdalena", "Bogotá – Chapinero",
    "Tolima"…) y `kams.base_city` guarda la ciudad base ("Barranquilla", "Chapinero", "Ibagué").
  - `executives.color` (#RRGGBB, paleta categórica de 13): era el color de la ejecutiva en el mapa por línea.
    *Superado el 2026-10-28* (`docs/decisiones/2026-10-28-mapa-un-color-por-zona.md`): el mapa pinta cada Zona con
    `kams.color` en las dos vistas; `executives.color` sigue guardado pero el mapa no lo usa.
  - `coverage`: `kind` ∈ local | reach | manual | vacant | conflict; columnas `nearest_executive_id`,
    `nearest_minutes`, `has_equipment`, `note`. Una fila por (línea activa, zona activa), también vacantes.
  - Roles nuevos `line_leader` (m.cobo@ – PerOssal, sramirez@ – Reemplazo, mn@ – Columna,
    s.gonzalez@ – Medicina deportiva, y.jimenez@ – Trauma; las dos últimas son usuarias nuevas) y
    `commercial_director` (laurab@, directora comercial).
- **Reglas de cobertura** (`web/lib/coverage.ts`, por línea L y zona Z, en este orden):
  1. Ajuste manual activo (`coverage_overrides`) a la ejecutiva X → `manual` solo si X sigue
     active/placeholder, lleva L y ADEMÁS: X vive en Z (resuelve un conflicto entre residentes o confirma
     a la local) **o** ninguna residente elegible de Z (active/placeholder, `base_kam_id` = Z) lleva L.
     Si Z ya tiene residente(s) con L y X es de otra zona, el ajuste queda sin efecto con `note`
     "Ajuste manual sin efecto: la zona ya tiene a <nombres> con esta línea" y siguen las reglas 2-3
     (local/conflict). También queda sin efecto (y se avisa en `note`) si X ya no existe, está inactiva
     o no lleva L. `POST /api/coverage/overrides` valida lo mismo antes de guardar: 400 si X no lleva L,
     409 "No se puede forzar: <zona> ya tiene a <nombre> con la línea <línea>…" si la zona ya tiene
     residente con L y X es de otra ciudad. Regla compartida: `overrideBlockingResidents()`.
     **Regla del dueño (2026-10-11):** "La solución debe permitir que una persona de otra ciudad, por
     distancia o por fuerza, tome otra zona si en esa zona no hay alguien con esa línea y si esa línea
     por supuesto está asignada a ese comercial." (por distancia = regla 3; por fuerza = este ajuste).
  2. Ejecutivas active/placeholder que viven en Z (`base_kam_id`) y llevan L: 1 → `local`; >1 → `conflict`.
  3. Si no: la más cercana que lleva L según la matriz zona→zona; ≤ `max_reach_minutes` (240) →
     `reach`; si no → `vacant` con `nearest_*`. Empates: orden alfabético y nota.
  4. `has_equipment` = `line_zones.has_equipment` (true si no hay fila).
  Matriz zona→zona = mediana de `hospital_kam_distances.travel_time/60` desde la zona origen hacia las
  IPS activas de la zona destino (municipality_id = area_id de 5 dígitos, locality_id = de 7).
  Funciones puras `computeZoneMatrix()` / `computeCoverage()`; `recomputeAndSaveCoverage()` reemplaza
  la tabla completa. No usa Google Maps (solo distancias ya guardadas).
- **Permisos** (`web/lib/permissions.ts`): `coverage:view`, `coverage:edit`, `map:all-lines`.
  admin todo; commercial_director todos los `:view` + lines/executives/coverage edit + map:all-lines;
  line_leader = sales_manager + lines:edit + coverage:view/edit (las APIs limitan la edición a la línea
  donde `business_lines.leader_user_id` = ella; no puede cambiar líder ni estado de la línea);
  data_manager y viewer: coverage:view + map:all-lines; sales_manager: coverage:view (sus líneas).
- **Qué líneas ve cada usuario** (`resolveUserLines`, única regla para `/api/me/lines`, `/api/coverage`
  y `/api/map/data`): map:all-lines → todas; líder → las que lidera; usuario enlazado a una ejecutiva
  (`executives.user_id`, active/placeholder) → sus `executive_lines`.
- **API**: `GET /api/me/lines`; `GET /api/coverage?line=<code>` (403 si no es suya);
  `POST /api/coverage/recalculate` (coverage:edit, global e idempotente);
  `POST /api/coverage/overrides` {line_id, kam_id, executive_id, reason} y
  `DELETE /api/coverage/overrides/[id]` (coverage:edit; line_leader solo su línea; recalculan);
  `GET /api/map/data?line=<code>` añade `coverage` (misma forma que /api/coverage) y `executives`;
  sin `?line` (vista "Zonas"), sin cobertura. Desde el 2026-10-14 la ruta pide `map:view` y la vista de zonas es
  para todos; sin map:all-lines, `kams[].executives` solo trae a quienes llevan alguna de sus líneas, y quien no
  tiene líneas ni contracts:view no recibe contratos (`contractsIncluded: false`) (`scripts/mapa-zonas-api-check.ts`).
- **Mapa** (`/map?line=<code>`): en la vista por Ejecutivos Comerciales elegir línea es obligatorio (modal si hay
  varias; "No tienes líneas asignadas" si ninguna, con el botón "Ver el mapa por zonas"); la vista de zonas
  (`?mode=zones`, dueño 2026-10-14) abre sin elegir línea. Territorios e IPS de una zona cubierta con el color de la Zona
  (`kams.color`, desde el 2026-10-28; antes, el de la ejecutiva que la cubría en esa línea);
  vacante: polígono pizarra #94a3b8 (0.5 con IPS, 0.3 de alcance) con borde #64748b, insignia hueca
  pizarra con "—" e IPS #64748b; conflicto ámbar #f59e0b; sin equipo con
  trama y opacidad baja. Tooltip con zona, ciudad base, línea y tipo de cobertura. Todo el que ve el mapa
  puede pasar a la vista "Zonas" con "Ver por" de la leyenda (`&mode=zones`, colores de zona de siempre; antes
  solo map:all-lines, cambio del 2026-10-14). Pines,
  racimos y tarjetas: ver "Estética del Mapa".
- **Páginas**: `/lines` con panel "Cobertura por línea" (tabla, Recalcular, Ajuste manual con motivo
  obligatorio, Quitar ajuste); `/kams` muestra nombre + "Ciudad base"; `EditKamModal` edita el nombre;
  `/executives` muestra y edita el color; `/users` ofrece los roles nuevos. El importador de visitas
  resuelve la zona por nombre, por `base_city` y por su forma corta ("Cartagena", "Cúcuta").
- **Aceptación** (solo lectura): `cd web && npm run fase2:check` (= `npx tsx scripts/fase2-check.ts`):
  20 pruebas puras (incluye la regla del dueño para ajustes y el escenario Bucaramanga ↔ Cúcuta con
  Diana Caicedo y Linda Barrera) + comparación con la tabla "El equipo actual sobre el mapa" del
  documento de producto (64/64 celdas el 2026-10-10; 58/64 el 2026-10-11: las 6 diferencias son
  porque en la BD Diana Caicedo ya lleva PerOssal + Columna, sin Reemplazo ni Medicina deportiva,
  y la tabla del documento es anterior; el motor no cambia esas celdas).

## 2026-10-23: las líderes asignan su línea por Zona (spec `docs/specs/2026-10-23-zonas-por-linea-para-lideres.md`)

Decisión del dueño en `docs/decisiones/2026-10-23-zonas-por-linea-las-lideres-asignan.md`. El motor de cobertura NO
cambia (manual → local/conflicto → alcance → sin cobertura; la vacante elegible como una persona; matriz por mediana).
Lo que sí cambia alrededor:

- **Etiqueta "Sin cobertura"**: la celda `coverage.kind = 'vacant'` (nadie lleva la línea dentro del tope) se llama
  "Sin cobertura" en `/kams`, `/lines` (`KIND_LABELS.vacant` en `app/lines/coverage-shared.ts`) y en la leyenda,
  tooltips y tarjetas del mapa. "Vacante" queda solo para la persona por contratar (`executives.status =
  'placeholder'`), que es una plaza autorizada por la gerencia y cuenta como una persona.
- **Pantalla Zonas (`/kams`)**: entrada de las líderes. Una fila por Zona activa (Bogotá agrupada en "Bogotá (4
  zonas)") con las cifras de la Zona (IPS, camas, municipios, departamentos, población DANE, afiliados BDUA, giros
  ADRES de 12 meses; `construirBloque` de `lib/zona-estadisticas.ts`), quién vive en ella (personas y vacantes con sus
  líneas y, si la dirección la limitó, "solo puede tener: …") y el estado en la línea elegida, derivado de la
  cobertura calculada en memoria (`estadoDePlaza`: Ocupada · Reservada · Por alcance · Sin cobertura · Conflicto;
  insignia "Sin equipo"). Si la tabla `coverage` no coincide con el cálculo, la ruta recalcula y guarda (sin Google) y
  la página lo dice. Acciones solo en la línea propia y con vista previa simulada (`POST /api/coverage/simular`, puro
  sobre `computeCoverage`, nunca escribe): "Darle <línea> a…", "Quitarle <línea>", "Forzar a alguien de otra ciudad…"
  (ajuste manual existente), "Quitar ajuste". Tipos en `lib/types/zonas.ts`; motor puro en
  `lib/cobertura-simulacion.ts` (`scripts/cobertura-simulacion-check.ts`).
- **Permiso `executives:lines`** (`lib/permissions.ts`): dar o quitar una línea a un Ejecutivo Comercial o vacante de
  la Zona (`PUT`/`DELETE /api/executives/[id]/lineas/[lineId]`). Lo tienen exactamente `admin`, `commercial_director`
  y `line_leader` (esta solo en su línea; lo limita la API con `canEditCoverageLine`). Inserta o borra en
  `executive_lines` y recalcula la cobertura; al quitar, el disparador de la 0820 termina los visitantes de esa línea
  (`medicosTerminados` en la respuesta). Detalle en `web/docs/ROLES_AND_PERMISSIONS.md`.
- **Líneas permitidas** (tabla `executive_allowed_lines`, migración `2026-10-23_0860_lineas_permitidas.sql`, rollback
  9946): restricción de la dirección "esta persona nada más puede tener estas unidades de negocio" para que una líder
  no asigne por error. Sin filas = sin restricción. Se fija en Ejecutivos Comerciales (`executives:edit`): `GET
  /api/executives` trae `lineas_permitidas` (ids, o `null`; también `null` mientras la tabla no exista, sin 500);
  `POST` y `PATCH /api/executives[/id]` aceptan `lineas_permitidas` (`null` o `[]` = quitar; valores = dejar
  exactamente esas, con `created_by` = quien lo pide) y responden 400 "Las líneas asignadas deben estar entre las
  permitidas" si las líneas finales no caben en la restricción final. `PUT /api/executives/[id]/lineas/[lineId]`
  responde 409 con `lineasPermitidas` si la línea no está permitida. Pruebas: `scripts/lineas-permitidas-api-check.ts`
  (Supabase falso, sin red).
- **Redistribución inicial** (migración de datos `2026-10-23_0870_borrar_lineas_para_redistribuir.sql`, rollback 9947):
  copia `executive_lines` a `executive_lines_respaldo_20261023`, borra todas las filas y deja dos restricciones
  (persona activa de Barranquilla → Sustitutos óseos y Reemplazo articular; Vacante Barranquilla → Medicina deportiva,
  Columna y Trauma), identificadas por zona base, estado y respaldo (sin nombres en el SQL; `RAISE` si no encuentra
  exactamente una de cada). **Solo con autorización del dueño, en la ventana del despliegue y seguida del recálculo de
  cobertura.** El disparador 0820 termina los visitantes de las líneas borradas; el rollback restaura las líneas desde
  el respaldo (sin borrarlo) pero no reabre esos visitantes. **No es re-ejecutable**: si el respaldo ya tiene filas,
  aborta con `RAISE` antes de tocar nada (volver a correrla después de que las líderes asignen borraría lo asignado sin
  respaldarlo y el rollback no lo recuperaría); para repetirla a conciencia, primero el rollback 9947 y luego renombrar
  o borrar el respaldo a mano, con autorización del dueño.
- **Mapa por línea**: Zonas sin cobertura en gris con un tono por Zona (`grisDeZona`; `docs/mapa-estetica.md`,
  sección "2026-10-23 · Grises por Zona"). Nada más de la estética cambia.

_Extraído de CLAUDE.md el 2026-10-11 (texto íntegro, solo reubicado); sección del 2026-10-23 añadida después._
