# IPS nuevas o editadas (2026-10-11): cola de pendientes, NO automático

Pedido del dueño (2026-10-11): "cada vez que yo creo una IPS no debería correrse automáticamente la
asignación" (va a hacer cargas masivas y quiere decidir cuándo se recalcula el territorio).
Antecedente: UPRES SANTANDER, UPRES ANTIOQUIA y HOCEN pasaron meses "Sin zona asignada" porque
`hospital_kam_distances` no tenía sus pares; el algoritmo solo asigna con tiempos reales.
- **Crear** (`POST /api/hospitals`), **editar** (`PUT`/`PATCH /api/hospitals/[id]`) y **activar**
  (`POST /api/hospitals/[id]/activate`) solo guardan: NO llaman a Google ni recalculan. Si la IPS queda
  activa (y, al editar, si cambió su ubicación) la respuesta trae `pending: true` y `warnings: ["La IPS queda
  pendiente de rutas y asignación; usa 'Calcular rutas y asignar pendientes' en la lista de IPS"]`; los
  formularios muestran ese aviso. Editar camas, nombre, doctores, etc. no la deja pendiente.
- **Cola de pendientes** (`web/app/api/_lib/pending-assignment.ts`, sin columna nueva; se deriva). IPS activa
  con coordenadas que cumple alguno de:
  (a) `unassigned`: sin asignación y creada (`created_at`) o activada (`hospital_history` 'activated')
  después del último recálculo; (b) `missing_routes`: le faltan pares candidatos (`routeCandidateKams`) o
  los que tiene se calcularon antes de un cambio de coordenadas (desactualizados: se vuelven a pedir y se
  sobrescriben); (c) `location_changed`: tiene asignación y su ubicación cambió después de esa
  asignación; (d) `new_routes`: tiene tiempos calculados después del último recálculo, aún sin usar.
  "Último recálculo" = `min(assignments.assigned_at)` (el recálculo completo borra y reinserta todo; las
  asignaciones manuales solo añaden filas más nuevas). **Limitación documentada**: `hospitals.updated_at`
  NO sirve para (c) porque el disparador `update_hospitals_updated_at` lo cambia con cualquier edición; por
  eso PUT/PATCH registran el cambio de ubicación en `hospital_history` (action `'edited'`,
  `changes.zone_fields {before, after}` y `changes.coordinates_changed`; la vista `hospital_activity` no lo
  muestra). Fuera de la cola (no hay acción que las asigne): sin coordenadas, departamentos excluidos, sin
  zona candidata y las que, con todos sus tiempos y ya recalculadas, quedan fuera del tiempo máximo de
  todas las zonas (`withoutZone`; 17 el 2026-10-11: 9 de departamentos excluidos + 8 de Arauca/Putumayo).
  `GET /api/hospitals/pending-assignment` (`hospitals:view`, solo lectura) → `{count, pairsMissing,
  costEstimateUsd (pares × 0,005), items (máx. 500: id, name, municipality_name, reason), truncated,
  withoutZone, withoutCoordinates, lastRecalculationAt, routesDisabled}`. Datos reales 2026-10-11: 5
  pendientes (HONAC y 4 UPRES, todas asignadas con pares faltantes), 47 rutas ≈ US$0,24.
- **Acción masiva** "Calcular rutas y asignar pendientes" (banner de `/hospitals`,
  `components/PendingAssignmentBanner.tsx`, solo con `recalculate:complete`, confirma con el costo) →
  `POST /api/hospitals/process-pending` `{cursor?, phase?}`. Fase A: rutas faltantes/desactualizadas de
  todas las pendientes con `ensureHospitalDistances` (una IPS por llamada a Google), lotes de ≤ 200 pares
  y 35 s por petición → `{phase:'routes', done, remaining, hasMore, nextCursor, googleElements, costUsd,
  disabled}`; el cliente repite con `cursor = nextCursor`. El cursor (id) evita repetir en la misma pasada
  los pares sin ruta por carretera (no se guardan; se reintentan en la siguiente pasada). Fase B, cuando en
  la pasada no queda ninguna IPS con pares por calcular: `runFullRecalculation` UNA vez +
  `recomputeAndSaveMunicipalityZones` (sin Google) → `{phase:'assigned', assignments, municipalities,
  pairsMissing}`. Con `GOOGLE_ROUTES_DISABLED=true` se salta la fase A y la B sigue disponible. Errores
  siempre como JSON `{error}`.
- **Botón individual** en la ficha: "Calcular rutas y recalcular territorio" (o "Recalcular territorio" si
  no faltan tiempos), permiso `recalculate:complete`, con confirmación de costo →
  `POST /api/hospitals/[id]/ensure-routes` (`refreshHospitalZone`: tiempos faltantes o desactualizados de
  ESA IPS + recálculo completo de TODAS + municipios). `GET /api/hospitals/[id]` devuelve `routeStatus
  {candidates, missing, stale, reason, pending, pendingReason}` para toda IPS activa con coordenadas; la
  ficha muestra el motivo si está pendiente o sin zona.
- Rutas: candidatas = `routeCandidateKams` (`web/lib/opmap-algorithm-simplified.ts`), criterio ÚNICO del
  algoritmo, `/api/routes/analyze-missing-optimized` y la cola. Guardado con `upsertHospitalDistances`
  (SEGUNDOS, source `google_maps`; sin sobrescribir salvo pares desactualizados). Topes: 15 s por llamada a
  Google; `maxDuration = 60` en process-pending y ensure-routes.
- **Validación** (`createHospitalSchema`): lat/lng obligatorias y dentro de Colombia (lat -4,3..13,5; lng
  -82..-66,8; también en PUT), el municipio pertenece al departamento, en Bogotá (11001) localidad
  obligatoria de 7 dígitos `11001xx` ("Las IPS de Bogotá necesitan localidad") y fuera de Bogotá sin
  localidad. `/api/locations/localities` devuelve ya códigos de 7 dígitos.
- Desactivar sigue quitando la asignación de la IPS (la ficha llama después a
  `/api/recalculate-smart-hospital` con 'deactivated', que no recalcula nada más). Al activar, la ficha ya
  no llama a ese endpoint. `/api/hospitals/assign-to-kam` sigue existiendo, sin uso desde la UI.
- Pruebas (sin red; Supabase falso en memoria para las rutas): `cd web && GOOGLE_ROUTES_DISABLED=true npm
  run ips:check` (109 pruebas el 2026-10-11).

_Extraído de CLAUDE.md el 2026-10-11 (texto íntegro, solo reubicado)._
