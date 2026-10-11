// Cola de IPS pendientes de rutas y asignación (2026-10-11, pedido del dueño: "cada vez que yo creo una
// IPS no debería correrse automáticamente la asignación").
//
// Crear, editar la ubicación o activar una IPS ya NO llama a Google ni recalcula el territorio: la IPS se
// guarda y queda "pendiente". La cola NO tiene columna propia; se deriva de lo que ya hay en la BD:
//   - unassigned       IPS activa sin asignación que no ha pasado por un recálculo desde que se creó o
//                      se activó (created_at / hospital_history 'activated' posteriores al último recálculo).
//   - missing_routes   le faltan pares candidatos en hospital_kam_distances (routeCandidateKams) o los que
//                      tiene están desactualizados porque sus coordenadas cambiaron después de calcularlos.
//   - location_changed tiene asignación, pero su ubicación cambió después de esa asignación.
//   - new_routes       hay tiempos de viaje de la IPS calculados después del último recálculo (aún sin usar).
//
// Por qué no basta con hospitals.updated_at > assignments.assigned_at: hospitals tiene el disparador
// update_hospitals_updated_at, que cambia updated_at con CUALQUIER edición (camas, doctores, URL de
// documentos...). Una carga masiva de camas marcaría todas las IPS como pendientes. Por eso los cambios de
// ubicación se registran en hospital_history (action 'edited', changes.zone_fields), que la vista
// hospital_activity no muestra, y la cola compara contra esa fecha.
//
// "Último recálculo" = min(assignments.assigned_at): el recálculo completo borra y vuelve a insertar
// todas las asignaciones, y las asignaciones manuales posteriores (assign-to-kam, forzadas) solo añaden
// filas más nuevas, así que el mínimo es el inicio del último recálculo completo.
//
// Fuera de la cola (no hay acción que las asigne): IPS sin coordenadas, de departamentos excluidos, sin
// ninguna zona candidata y las que, con todos sus tiempos y ya recalculadas, quedan fuera del tiempo
// máximo de todas las zonas (se cuentan en `withoutZone`).
//
// Acción masiva (POST /api/hospitals/process-pending, permiso recalculate:complete):
//   Fase A: tiempos que faltan o están desactualizados de TODAS las pendientes, una IPS por llamada a
//           Google (ensureHospitalDistances), en lotes de hasta PROCESS_MAX_PAIRS_PER_REQUEST pares y con
//           presupuesto de tiempo por petición (como calculate-batch-secure). Un cursor (id de la última IPS
//           procesada) evita volver a pedir en la misma pasada los pares sin ruta por carretera.
//   Fase B: cuando en la pasada ya no quedan IPS con pares por calcular: runFullRecalculation UNA vez y
//           recomputeAndSaveMunicipalityZones (sin Google).
// Con GOOGLE_ROUTES_DISABLED=true se salta la fase A (disabled: true) y la fase B sigue disponible.

import { supabaseAdmin } from '@/lib/supabase-admin'
import type { AdjacencyMatrix } from '@/lib/opmap-algorithm-simplified'
import { MunicipalityTableMissingError, recomputeAndSaveMunicipalityZones } from '@/lib/municipality-coverage'
import { fetchAllRows } from './api-error'
import { googleRoutesDisabled } from './google-distance-matrix'
import { runFullRecalculation, type FullRecalculationResult } from './full-recalculation'
import {
  ensureHospitalDistances,
  GOOGLE_COST_PER_ELEMENT_USD,
  planHospitalRoutes,
  upsertHospitalDistances,
  zoneFieldsChanged,
  type DistanceUpsertRow,
  type EnsureHospitalDistancesResult,
  type HospitalRouteContext,
  type HospitalRoutesDeps,
  type RouteHospital,
  type RouteKam,
  type RouteStatusReason,
  type ZoneFieldValues,
} from './hospital-routes'

export const PENDING_ASSIGNMENT_WARNING =
  "La IPS queda pendiente de rutas y asignación; usa 'Calcular rutas y asignar pendientes' en la lista de IPS"
export const PENDING_ITEMS_LIMIT = 500
export const PROCESS_MAX_PAIRS_PER_REQUEST = 200 // mismo tamaño de ventana que calculate-batch-secure
// No se empieza otra IPS pasado este tiempo; cada llamada a Google tiene además su tope de 15 s
// (GOOGLE_CALL_TIMEOUT_MS), así que la petición queda por debajo de maxDuration = 60 s.
export const PROCESS_ROUTES_BUDGET_MS = 35_000
/** Texto de hospital_history.reason al registrar un cambio de ubicación. */
export const LOCATION_CHANGE_REASON = 'Cambio de ubicación: la IPS queda pendiente de rutas y asignación'

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface PendingSourceHospital extends RouteHospital {
  created_at: string | null
  municipality_name?: string | null
}

export interface PendingDistanceRow {
  hospital_id: string
  kam_id: string
  calculated_at: string | null
  updated_at?: string | null
}

export interface PendingAssignmentRow {
  hospital_id: string
  assigned_at: string | null
}

export interface PendingHistoryRow {
  hospital_id: string
  action: string
  created_at: string | null
  changes: unknown
}

export interface PendingSnapshot {
  /** IPS activas. */
  hospitals: PendingSourceHospital[]
  /** Zonas activas que participan en la asignación. */
  kams: RouteKam[]
  adjacency: AdjacencyMatrix
  excludedDepartments: string[]
  distances: PendingDistanceRow[]
  assignments: PendingAssignmentRow[]
  /** hospital_history con action 'activated' o 'edited'. */
  history: PendingHistoryRow[]
  /** min(assignments.assigned_at) de toda la tabla: inicio del último recálculo completo. */
  lastRecalculationAt: string | null
}

export type PendingReason = 'unassigned' | 'missing_routes' | 'location_changed' | 'new_routes'

export interface PendingHospital {
  id: string
  name: string
  municipality_name: string | null
  reasons: PendingReason[]
  /** Motivo legible (los motivos unidos con " · "). */
  reason: string
  /** Pares que hay que pedir a Google: los que faltan + los desactualizados. */
  missingPairs: number
  /** De missingPairs, los que existen pero se calcularon antes del último cambio de coordenadas. */
  stalePairs: number
}

export interface PendingClassification {
  /** Todas las pendientes, ordenadas por nombre. */
  items: PendingHospital[]
  pairsMissing: number
  /** Activas sin zona que ninguna acción de la cola puede asignar. */
  withoutZone: number
  /** Activas sin coordenadas válidas (no entran en la cola). */
  withoutCoordinates: number
  lastRecalculationAt: string | null
}

export interface PendingRouteContext {
  context: HospitalRouteContext
  /** Zonas candidatas cuyo tiempo ya guardado quedó desactualizado por un cambio de coordenadas. */
  staleKamIds: string[]
}

export interface PendingHospitalStatus {
  candidates: number
  /** Pares que hay que pedir (faltan + desactualizados). */
  missing: number
  stale: number
  reason: RouteStatusReason
  pending: boolean
  pendingReason: string | null
  reasons: PendingReason[]
}

// ---------------------------------------------------------------------------
// Funciones puras
// ---------------------------------------------------------------------------

/**
 * Milisegundos desde una marca de tiempo de Supabase. timestamptz llega con zona ("+00:00"); las columnas
 * timestamp sin zona (hospital_kam_distances.calculated_at) guardan la hora UTC y llegan sin zona: se leen
 * como UTC, nunca con la zona del servidor.
 */
export function timestampMs(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  let text = String(value).trim().replace(' ', 'T')
  if (/T\d{2}:\d{2}.*[+-]\d{2}$/.test(text)) text += ':00'
  else if (/T\d{2}:\d{2}.*[+-]\d{4}$/.test(text)) text = `${text.slice(0, -2)}:${text.slice(-2)}`
  else if (!/(?:z|[+-]\d{2}:\d{2})$/i.test(text)) text += 'Z'
  const ms = Date.parse(text)
  return Number.isFinite(ms) ? ms : null
}

function maxOf(map: Map<string, number>, key: string, value: number | null) {
  if (value === null) return
  const current = map.get(key)
  if (current === undefined || value > current) map.set(key, value)
}

/** Datos de un cambio de ubicación guardados en hospital_history.changes. */
export function locationChangeDetails(changes: unknown): { coordinatesChanged: boolean } | null {
  if (!changes || typeof changes !== 'object') return null
  const record = changes as Record<string, unknown>
  if (!record.zone_fields || typeof record.zone_fields !== 'object') return null
  return { coordinatesChanged: record.coordinates_changed === true }
}

interface SnapshotIndex {
  snapshot: PendingSnapshot
  lastRecalculationMs: number | null
  assignedAt: Map<string, number | null>
  lastActivation: Map<string, number>
  lastLocation: Map<string, number>
  lastCoordinates: Map<string, number>
  pairs: Map<string, Map<string, number | null>>
}

function indexSnapshot(snapshot: PendingSnapshot): SnapshotIndex {
  const assignedAt = new Map<string, number | null>()
  for (const row of snapshot.assignments) assignedAt.set(row.hospital_id, timestampMs(row.assigned_at))

  const lastActivation = new Map<string, number>()
  const lastLocation = new Map<string, number>()
  const lastCoordinates = new Map<string, number>()
  for (const row of snapshot.history) {
    const at = timestampMs(row.created_at)
    if (row.action === 'activated') {
      maxOf(lastActivation, row.hospital_id, at)
    } else if (row.action === 'edited') {
      const details = locationChangeDetails(row.changes)
      if (!details) continue
      maxOf(lastLocation, row.hospital_id, at)
      if (details.coordinatesChanged) maxOf(lastCoordinates, row.hospital_id, at)
    }
  }

  const pairs = new Map<string, Map<string, number | null>>()
  for (const row of snapshot.distances) {
    let byKam = pairs.get(row.hospital_id)
    if (!byKam) {
      byKam = new Map()
      pairs.set(row.hospital_id, byKam)
    }
    byKam.set(String(row.kam_id), timestampMs(row.calculated_at) ?? timestampMs(row.updated_at))
  }

  return {
    snapshot,
    lastRecalculationMs: timestampMs(snapshot.lastRecalculationAt),
    assignedAt,
    lastActivation,
    lastLocation,
    lastCoordinates,
    pairs,
  }
}

function contextFromIndex(index: SnapshotIndex, hospital: PendingSourceHospital): PendingRouteContext {
  const { snapshot } = index
  const byKam = index.pairs.get(hospital.id) ?? new Map<string, number | null>()
  const coordinatesChangedAt = index.lastCoordinates.get(hospital.id)
  const staleKamIds: string[] = []
  const existingKamIds: string[] = []
  for (const [kamId, calculatedAt] of Array.from(byKam.entries())) {
    // Un tiempo calculado antes de mover la IPS no sirve: se trata como faltante y se vuelve a pedir
    if (coordinatesChangedAt !== undefined && (calculatedAt === null || calculatedAt < coordinatesChangedAt)) {
      staleKamIds.push(kamId)
    } else {
      existingKamIds.push(kamId)
    }
  }
  return {
    context: {
      hospital,
      kams: snapshot.kams,
      adjacency: snapshot.adjacency,
      excludedDepartments: snapshot.excludedDepartments,
      existingKamIds,
    },
    staleKamIds,
  }
}

/** Contexto de rutas de una IPS del snapshot, con los pares desactualizados contados como faltantes. */
export function buildPendingRouteContext(snapshot: PendingSnapshot, hospitalId: string): PendingRouteContext | null {
  const hospital = snapshot.hospitals.find(h => h.id === hospitalId)
  if (!hospital) return null
  return contextFromIndex(indexSnapshot(snapshot), hospital)
}

const plural = (count: number, singular: string, pluralForm: string) => (count === 1 ? singular : pluralForm)

export function pendingReasonText(input: {
  reasons: PendingReason[]
  absentPairs: number
  stalePairs: number
}): string {
  const parts: string[] = []
  for (const reason of input.reasons) {
    if (reason === 'unassigned') {
      parts.push('Sin zona: no ha pasado por un recálculo desde que se creó o activó')
    } else if (reason === 'location_changed') {
      parts.push('Cambió de ubicación después de su última asignación')
    } else if (reason === 'new_routes') {
      parts.push('Tiene tiempos de viaje nuevos que la asignación aún no usa')
    } else if (reason === 'missing_routes') {
      if (input.absentPairs > 0) {
        parts.push(`Faltan ${input.absentPairs} ${plural(input.absentPairs, 'tiempo de viaje', 'tiempos de viaje')}`)
      }
      if (input.stalePairs > 0) {
        parts.push(
          `${input.stalePairs} ${plural(input.stalePairs, 'tiempo desactualizado', 'tiempos desactualizados')} por cambio de coordenadas`
        )
      }
    }
  }
  return parts.join(' · ')
}

/** Clasifica las IPS activas del snapshot. Pura: no lee la BD ni llama a Google. */
export function classifyPendingHospitals(snapshot: PendingSnapshot): PendingClassification {
  const index = indexSnapshot(snapshot)
  const items: PendingHospital[] = []
  let withoutZone = 0
  let withoutCoordinates = 0

  for (const hospital of snapshot.hospitals) {
    if (hospital.active !== true) continue
    const { context, staleKamIds } = contextFromIndex(index, hospital)
    const plan = planHospitalRoutes(context)
    const assigned = index.assignedAt.has(hospital.id)

    if (plan.reason === 'no_coordinates') {
      withoutCoordinates++
      continue
    }
    if (plan.reason === 'excluded_department' || plan.reason === 'no_candidates' || plan.reason === 'inactive') {
      if (!assigned) withoutZone++
      continue
    }

    const candidateIds = new Set(plan.candidates.map(kam => kam.id))
    const stale = staleKamIds.filter(kamId => candidateIds.has(kamId)).length
    const lastRecalc = index.lastRecalculationMs
    const lastLocation = index.lastLocation.get(hospital.id)
    const lastChange = Math.max(
      timestampMs(hospital.created_at) ?? 0,
      index.lastActivation.get(hospital.id) ?? 0,
      lastLocation ?? 0
    )

    const reasons: PendingReason[] = []
    if (!assigned && (lastRecalc === null || lastChange > lastRecalc)) reasons.push('unassigned')
    if (plan.missing.length > 0) reasons.push('missing_routes')
    if (assigned && lastLocation !== undefined) {
      const assignedAt = index.assignedAt.get(hospital.id)
      if (assignedAt === null || assignedAt === undefined || lastLocation > assignedAt) reasons.push('location_changed')
    }
    if (lastRecalc !== null && !reasons.includes('unassigned') && !reasons.includes('location_changed')) {
      const byKam = index.pairs.get(hospital.id)
      const hasNewRoutes = plan.existing.some(kam => {
        const calculatedAt = byKam?.get(kam.id)
        return calculatedAt !== null && calculatedAt !== undefined && calculatedAt > lastRecalc
      })
      if (hasNewRoutes) reasons.push('new_routes')
    }

    if (reasons.length === 0) {
      // Con todos sus tiempos y ya recalculada: si sigue sin zona es porque ninguna zona llega a tiempo
      if (!assigned) withoutZone++
      continue
    }

    items.push({
      id: hospital.id,
      name: hospital.name ?? hospital.id,
      municipality_name: hospital.municipality_name ?? hospital.municipality_id ?? null,
      reasons,
      reason: pendingReasonText({ reasons, absentPairs: plan.missing.length - stale, stalePairs: stale }),
      missingPairs: plan.missing.length,
      stalePairs: stale,
    })
  }

  items.sort((a, b) => a.name.localeCompare(b.name, 'es') || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  return {
    items,
    pairsMissing: items.reduce((sum, item) => sum + item.missingPairs, 0),
    withoutZone,
    withoutCoordinates,
    lastRecalculationAt: snapshot.lastRecalculationAt,
  }
}

export function costEstimateUsd(pairs: number): number {
  return Math.round(pairs * GOOGLE_COST_PER_ELEMENT_USD * 100) / 100
}

/** Respuesta de GET /api/hospitals/pending-assignment. */
export function pendingSummaryResponse(classification: PendingClassification, limit = PENDING_ITEMS_LIMIT) {
  const items = classification.items.slice(0, limit).map(item => ({
    id: item.id,
    name: item.name,
    municipality_name: item.municipality_name,
    reason: item.reason,
    reasons: item.reasons,
    missingPairs: item.missingPairs,
  }))
  return {
    count: classification.items.length,
    pairsMissing: classification.pairsMissing,
    costEstimateUsd: costEstimateUsd(classification.pairsMissing),
    items,
    truncated: classification.items.length > items.length,
    withoutZone: classification.withoutZone,
    withoutCoordinates: classification.withoutCoordinates,
    lastRecalculationAt: classification.lastRecalculationAt,
  }
}

/** IPS con pares por pedir a Google, en orden estable (id) para poder avanzar con un cursor. */
export function routesQueue(classification: PendingClassification): PendingHospital[] {
  return classification.items
    .filter(item => item.missingPairs > 0)
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

// ---------------------------------------------------------------------------
// Fila de hospital_history para un cambio de ubicación (PUT/PATCH /api/hospitals/[id])
// ---------------------------------------------------------------------------

function sameCoordinates(before: ZoneFieldValues, after: ZoneFieldValues): boolean {
  return !zoneFieldsChanged(
    { lat: before.lat, lng: before.lng },
    { lat: after.lat, lng: after.lng }
  )
}

/**
 * Fila a insertar en hospital_history si la edición cambió algún campo que decide la zona, o null.
 * `before` = null cuando no se pudo leer el estado anterior: se registra igual (la IPS queda pendiente)
 * pero sin marcar los tiempos como desactualizados, porque no se sabe si las coordenadas cambiaron.
 */
export function locationChangeHistoryRow(input: {
  hospitalId: string
  userId: string
  before: ZoneFieldValues | null
  after: ZoneFieldValues & { active?: boolean | null }
}) {
  const { before, after } = input
  if (before && !zoneFieldsChanged(before, after)) return null
  const pick = (values: ZoneFieldValues | null) =>
    values
      ? {
          lat: values.lat ?? null,
          lng: values.lng ?? null,
          department_id: values.department_id ?? null,
          municipality_id: values.municipality_id ?? null,
          locality_id: values.locality_id ?? null,
        }
      : null
  return {
    hospital_id: input.hospitalId,
    user_id: input.userId,
    created_by: input.userId,
    action: 'edited' as const,
    reason: LOCATION_CHANGE_REASON,
    previous_state: before ? Boolean(before.active) : null,
    new_state: Boolean(after.active),
    changes: {
      zone_fields: { before: pick(before), after: pick(after) },
      coordinates_changed: before ? !sameCoordinates(before, after) : null,
    },
  }
}

// ---------------------------------------------------------------------------
// E/S con Supabase (solo SELECT)
// ---------------------------------------------------------------------------

const HOSPITAL_SELECT =
  'id, name, active, department_id, municipality_id, locality_id, lat, lng, created_at, municipality_name'

/** Lee lo necesario para clasificar. Con hospitalId solo esa IPS (las zonas y el último recálculo, globales). */
export async function loadPendingSnapshot(options: { hospitalId?: string } = {}): Promise<PendingSnapshot> {
  const { hospitalId } = options

  const [hospitalsRes, kamsRes, adjacencyRes, excludedRes, distancesRes, assignmentsRes, firstAssignmentRes, historyRes] =
    await Promise.all([
      fetchAllRows<PendingSourceHospital>((from, to) => {
        let query = supabaseAdmin.from('hospitals').select(HOSPITAL_SELECT).eq('active', true)
        if (hospitalId) query = query.eq('id', hospitalId)
        return query.order('id').range(from, to)
      }),
      supabaseAdmin
        .from('kams')
        .select('id, name, area_id, lat, lng, enable_level2')
        .eq('active', true)
        .eq('participates_in_assignment', true)
        .order('name'),
      supabaseAdmin.from('department_adjacency').select('department_code, adjacent_department_code'),
      supabaseAdmin.from('departments').select('code').eq('excluded', true),
      fetchAllRows<PendingDistanceRow>((from, to) => {
        let query = supabaseAdmin.from('hospital_kam_distances').select('hospital_id, kam_id, calculated_at, updated_at')
        if (hospitalId) query = query.eq('hospital_id', hospitalId)
        return query.order('id').range(from, to)
      }),
      fetchAllRows<PendingAssignmentRow>((from, to) => {
        let query = supabaseAdmin.from('assignments').select('hospital_id, assigned_at')
        if (hospitalId) query = query.eq('hospital_id', hospitalId)
        return query.order('id').range(from, to)
      }),
      supabaseAdmin.from('assignments').select('assigned_at').order('assigned_at', { ascending: true }).limit(1),
      fetchAllRows<PendingHistoryRow>((from, to) => {
        let query = supabaseAdmin
          .from('hospital_history')
          .select('hospital_id, action, created_at, changes')
          .in('action', ['activated', 'edited'])
        if (hospitalId) query = query.eq('hospital_id', hospitalId)
        return query.order('id').range(from, to)
      }),
    ])

  const failures: Array<[string, unknown]> = [
    ['hospitals', hospitalsRes.error],
    ['kams', kamsRes.error],
    ['department_adjacency', adjacencyRes.error],
    ['departments', excludedRes.error],
    ['hospital_kam_distances', distancesRes.error],
    ['assignments', assignmentsRes.error ?? firstAssignmentRes.error],
    ['hospital_history', historyRes.error],
  ]
  for (const [table, error] of failures) {
    if (error) {
      const message = error instanceof Error ? error.message : (error as { message?: string }).message ?? String(error)
      throw new Error(`pending-assignment: error leyendo ${table}: ${message}`)
    }
  }

  const adjacency: AdjacencyMatrix = {}
  for (const row of adjacencyRes.data || []) {
    if (!adjacency[row.department_code]) adjacency[row.department_code] = []
    adjacency[row.department_code].push(row.adjacent_department_code)
  }

  // Algunas IPS creadas por la app no tienen municipality_name: se completa con la tabla municipalities
  const hospitals = hospitalsRes.data
  const codesWithoutName = Array.from(
    new Set(hospitals.filter(h => !h.municipality_name && h.municipality_id).map(h => String(h.municipality_id)))
  )
  if (codesWithoutName.length > 0) {
    const { data: municipalities, error } = await supabaseAdmin
      .from('municipalities')
      .select('code, name')
      .in('code', codesWithoutName)
    if (error) {
      console.error('[pending-assignment] no se pudieron leer los nombres de municipio', error)
    } else {
      const names = new Map((municipalities || []).map(row => [String(row.code), String(row.name)]))
      for (const h of hospitals) {
        if (!h.municipality_name && names.has(String(h.municipality_id))) h.municipality_name = names.get(String(h.municipality_id))
      }
    }
  }

  return {
    hospitals,
    kams: (kamsRes.data || []) as RouteKam[],
    adjacency,
    excludedDepartments: (excludedRes.data || []).map(row => String(row.code)),
    distances: distancesRes.data,
    assignments: assignmentsRes.data,
    history: historyRes.data,
    lastRecalculationAt: (firstAssignmentRes.data?.[0]?.assigned_at as string | undefined) ?? null,
  }
}

/** Estado de una IPS para su ficha (null si no existe o está inactiva). Solo lectura. */
export async function getHospitalPendingStatus(hospitalId: string): Promise<PendingHospitalStatus | null> {
  const snapshot = await loadPendingSnapshot({ hospitalId })
  return pendingStatusFromSnapshot(snapshot, hospitalId)
}

export function pendingStatusFromSnapshot(snapshot: PendingSnapshot, hospitalId: string): PendingHospitalStatus | null {
  const built = buildPendingRouteContext(snapshot, hospitalId)
  if (!built) return null
  const plan = planHospitalRoutes(built.context)
  const item = classifyPendingHospitals(snapshot).items.find(entry => entry.id === hospitalId)
  return {
    candidates: plan.candidates.length,
    missing: plan.missing.length,
    stale: item?.stalePairs ?? 0,
    reason: plan.reason,
    pending: Boolean(item),
    pendingReason: item?.reason ?? null,
    reasons: item?.reasons ?? [],
  }
}

// ---------------------------------------------------------------------------
// Rutas de una IPS pendiente (fase A y botón de la ficha)
// ---------------------------------------------------------------------------

/**
 * ensureHospitalDistances con el contexto del snapshot: pide los pares que faltan y los desactualizados.
 * Si hay desactualizados guarda sobrescribiendo (solo se piden pares que faltan o están desactualizados).
 * No lanza (como ensureHospitalDistances).
 */
export async function ensurePendingHospitalDistances(
  hospitalId: string,
  snapshot: PendingSnapshot,
  options: {
    actorId?: string
    deps?: Partial<HospitalRoutesDeps>
    save?: (rows: DistanceUpsertRow[], overwrite: boolean) => Promise<void>
  } = {}
): Promise<EnsureHospitalDistancesResult> {
  const built = buildPendingRouteContext(snapshot, hospitalId)
  const overwrite = (built?.staleKamIds.length ?? 0) > 0
  const save =
    options.save ??
    (async (rows: DistanceUpsertRow[], overwriteRows: boolean) => {
      const { failedChunks } = await upsertHospitalDistances(rows, { overwrite: overwriteRows, context: 'process-pending' })
      if (failedChunks > 0) throw new Error(`process-pending: ${failedChunks} lote(s) sin guardar`)
    })
  return ensureHospitalDistances(hospitalId, {
    actorId: options.actorId,
    deps: {
      loadContext: async () => built?.context ?? null,
      saveDistances: rows => save(rows, overwrite),
      ...options.deps,
    },
  })
}

// ---------------------------------------------------------------------------
// Acción masiva: fase A (rutas) y fase B (asignación)
// ---------------------------------------------------------------------------

export interface PendingRoutesDeps {
  loadSnapshot: () => Promise<PendingSnapshot>
  ensure: (hospitalId: string, snapshot: PendingSnapshot) => Promise<EnsureHospitalDistancesResult>
  routesDisabled: () => boolean
  now: () => number
  budgetMs: number
  maxPairs: number
}

export interface PendingRoutesStepResult {
  phase: 'routes'
  /** IPS procesadas en esta petición. */
  done: number
  /** IPS que siguen en la pasada (después del cursor). */
  remaining: number
  hasMore: boolean
  /** Id de la última IPS procesada; el cliente lo devuelve en la siguiente petición. */
  nextCursor: string | null
  pairsDone: number
  /** Pares por pedir en lo que queda de la pasada (después del cursor). */
  pairsRemaining: number
  /** Pares por pedir en toda la cola al empezar esta petición (incluye los ya intentados sin éxito). */
  pairsMissingTotal: number
  calculated: number
  noRoute: number
  failed: number
  googleCalls: number
  googleElements: number
  costUsd: number
  disabled: boolean
  warnings: string[]
}

export interface PendingAssignStepResult {
  phase: 'assigned'
  assignments: number
  municipalities: { recomputed: boolean; counts: Record<string, number> | null }
  warnings: string[]
}

export interface PendingAssignDeps {
  recalculate: () => Promise<FullRecalculationResult>
  recomputeMunicipalities: () => Promise<unknown>
}

export async function runPendingRoutesStep(
  input: { cursor: string | null },
  deps: PendingRoutesDeps
): Promise<PendingRoutesStepResult> {
  const snapshot = await deps.loadSnapshot()
  const queue = routesQueue(classifyPendingHospitals(snapshot))
  const cursor = input.cursor
  const pass = cursor ? queue.filter(item => item.id > cursor) : queue
  const result: PendingRoutesStepResult = {
    phase: 'routes',
    done: 0,
    remaining: pass.length,
    hasMore: false,
    nextCursor: cursor,
    pairsDone: 0,
    pairsRemaining: pass.reduce((sum, item) => sum + item.missingPairs, 0),
    pairsMissingTotal: queue.reduce((sum, item) => sum + item.missingPairs, 0),
    calculated: 0,
    noRoute: 0,
    failed: 0,
    googleCalls: 0,
    googleElements: 0,
    costUsd: 0,
    disabled: false,
    warnings: [],
  }

  if (deps.routesDisabled()) {
    result.disabled = true
    if (pass.length > 0) {
      result.warnings.push('El cálculo de rutas con Google está deshabilitado temporalmente (GOOGLE_ROUTES_DISABLED)')
    }
    return result
  }

  const started = deps.now()
  const errors = new Set<string>()
  for (const item of pass) {
    // Siempre al menos una IPS por petición, para que la pasada avance aunque la lectura haya tardado
    if (result.done > 0) {
      if (deps.now() - started > deps.budgetMs) break
      if (result.pairsDone + item.missingPairs > deps.maxPairs) break
    }
    let routes: EnsureHospitalDistancesResult | null = null
    try {
      routes = await deps.ensure(item.id, snapshot)
    } catch (error) {
      console.error('[process-pending] rutas de una IPS fallaron', error)
      result.failed += item.missingPairs
    }
    if (routes) {
      result.calculated += routes.calculated
      result.noRoute += routes.noRoute
      result.failed += routes.failed
      result.googleCalls += routes.googleCalls
      result.googleElements += routes.googleElements
      if (routes.error) errors.add(routes.error)
    }
    result.done++
    result.pairsDone += item.missingPairs
    result.nextCursor = item.id
  }

  result.remaining = pass.length - result.done
  result.pairsRemaining -= result.pairsDone
  result.hasMore = result.remaining > 0
  result.costUsd = costEstimateUsd(result.googleElements)
  if (result.noRoute > 0) {
    result.warnings.push(`Google no encontró ruta por carretera para ${result.noRoute} par(es) zona→IPS`)
  }
  result.warnings.push(...Array.from(errors))
  return result
}

export async function runPendingAssignStep(deps: PendingAssignDeps): Promise<PendingAssignStepResult> {
  // Si el recálculo falla, lanza: la ruta responde con un error JSON claro
  const recalculation = await deps.recalculate()
  const result: PendingAssignStepResult = {
    phase: 'assigned',
    assignments: recalculation.totalAssignments,
    municipalities: { recomputed: false, counts: null },
    warnings: [],
  }
  try {
    const recomputed = (await deps.recomputeMunicipalities()) as { counts?: Record<string, number> } | undefined
    result.municipalities = { recomputed: true, counts: recomputed?.counts ?? null }
  } catch (error) {
    // Sin la migración de la Fase 2b no hay capa de municipios que actualizar: no es un fallo
    if (!(error instanceof MunicipalityTableMissingError)) {
      console.error('[process-pending] recálculo de municipality_zone falló', error)
      result.warnings.push('No se pudo actualizar el mapa de municipios; un administrador puede recalcularlo')
    }
  }
  return result
}

export type ProcessPendingResult =
  | PendingRoutesStepResult
  | (PendingAssignStepResult & { routesDisabled: boolean; pairsMissing: number | null })

/**
 * Un paso de POST /api/hospitals/process-pending.
 *  - phase 'routes': solo fase A.  - phase 'assign': solo fase B.
 *  - sin phase (lo que usa la lista de IPS): fase A mientras queden IPS con pares por calcular después del
 *    cursor; cuando no queda ninguna (o Google está deshabilitado), fase B en esa misma petición.
 */
export async function processPendingStep(
  input: { cursor: string | null; phase?: 'routes' | 'assign' },
  deps: { routes: PendingRoutesDeps; assign: PendingAssignDeps }
): Promise<ProcessPendingResult> {
  if (input.phase === 'assign') {
    return { ...(await runPendingAssignStep(deps.assign)), routesDisabled: deps.routes.routesDisabled(), pairsMissing: null }
  }
  const routes = await runPendingRoutesStep({ cursor: input.cursor }, deps.routes)
  if (input.phase === 'routes' || routes.done > 0) return routes
  const assigned = await runPendingAssignStep(deps.assign)
  return {
    ...assigned,
    warnings: [...routes.warnings, ...assigned.warnings],
    routesDisabled: routes.disabled,
    // Pares que siguen faltando en toda la cola (p. ej. sin ruta por carretera): esas IPS pueden quedar sin zona
    pairsMissing: routes.pairsMissingTotal,
  }
}

/** Dependencias reales (Supabase, Google, algoritmo). */
export function defaultProcessPendingDeps(actorId: string): { routes: PendingRoutesDeps; assign: PendingAssignDeps } {
  return {
    routes: {
      loadSnapshot: () => loadPendingSnapshot(),
      ensure: (hospitalId, snapshot) => ensurePendingHospitalDistances(hospitalId, snapshot, { actorId }),
      routesDisabled: googleRoutesDisabled,
      now: () => Date.now(),
      budgetMs: PROCESS_ROUTES_BUDGET_MS,
      maxPairs: PROCESS_MAX_PAIRS_PER_REQUEST,
    },
    assign: {
      recalculate: runFullRecalculation,
      recomputeMunicipalities: () => recomputeAndSaveMunicipalityZones(),
    },
  }
}
