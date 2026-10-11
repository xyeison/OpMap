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
  - `executives.color` (#RRGGBB, paleta categórica de 13): color de la ejecutiva en el mapa por línea.
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
  sin `?line` (vista "Zonas") solo para map:all-lines.
- **Mapa** (`/map?line=<code>`): elegir línea es obligatorio (modal si hay varias; "No tienes líneas
  asignadas" si ninguna). Territorios e IPS con el color de la ejecutiva que cubre la zona en esa línea;
  vacante: polígono pizarra #94a3b8 (0.5 con IPS, 0.3 de alcance) con borde #64748b, insignia hueca
  pizarra con "—" e IPS #64748b; conflicto ámbar #f59e0b; sin equipo con
  trama y opacidad baja. Tooltip con zona, ciudad base, línea y tipo de cobertura. Quien tiene
  map:all-lines puede pasar a la vista "Zonas" (`&mode=zones`, colores de zona de siempre). Pines,
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

_Extraído de CLAUDE.md el 2026-10-11 (texto íntegro, solo reubicado)._
