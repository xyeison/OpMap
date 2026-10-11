// IPS nuevas o editadas: que nunca queden "Sin zona asignada" por falta de tiempos de viaje.
//
// Antecedente (2026-10-11): UPRES SANTANDER, UPRES ANTIOQUIA y HOCEN se crearon por la app en agosto
// de 2025 y pasaron meses sin zona porque hospital_kam_distances no tenía sus pares y el algoritmo
// (lib/opmap-algorithm-simplified.ts) solo asigna con tiempos reales.
//
// Flujo único (refreshHospitalZone). Se ejecuta tras crear una IPS (POST /api/hospitals), al cambiar
// sus coordenadas, territorio o estado (PUT/PATCH /api/hospitals/[id]), al activarla
// (POST /api/hospitals/[id]/activate) y desde el botón "Calcular rutas y asignar" de la ficha
// (POST /api/hospitals/[id]/ensure-routes):
//   1. ensureHospitalDistances: pide a Google Distance Matrix SOLO los pares zona→IPS que faltan en
//      hospital_kam_distances. Candidatas = routeCandidateKams (lib/opmap-algorithm-simplified.ts), el
//      mismo criterio que /api/routes/analyze-missing-optimized. Guarda igual que
//      /api/routes/calculate-batch-secure (upsertHospitalDistances: SEGUNDOS, source 'google_maps',
//      sin sobrescribir pares existentes). Con GOOGLE_ROUTES_DISABLED=true no llama a Google.
//   2. runFullRecalculation: el mismo recálculo completo de /api/recalculate-simplified (asignaciones
//      forzadas, territorio base, competencia por tiempo y regla de mayoría de Bogotá), para que la IPS
//      entre con las mismas reglas que todas las demás.
//   3. recomputeAndSaveMunicipalityZones: el mismo recálculo de municipality_zone que
//      POST /api/municipality-coverage/recompute (SIN Google).
// Nada de esto lanza: cada fallo se convierte en un aviso (warnings) y la IPS queda guardada igual.
//
// Tiempo (decisión documentada): en Vercel la función tiene maxDuration = 60 s y en serverless no se
// puede seguir trabajando después de responder, así que todo ocurre dentro de la petición. Medido en
// solo lectura el 2026-10-11 (783 IPS activas, 9.891 distancias): el algoritmo carga en ~3 s y calcula
// en ~0,1 s; el motor de municipios carga en ~2,7 s y calcula en ~0,03 s. Con una sola llamada a
// Google (una IPS = un destino y hasta 25 zonas como orígenes) y los guardados, el total queda muy por
// debajo de 60 s, por lo que se usa el recálculo completo y no una asignación parcial. Salvaguardas:
// cada llamada a Google tiene un tope (GOOGLE_CALL_TIMEOUT_MS) y, si el reloj pasa RECALCULATE_DEADLINE_MS
// o MUNICIPALITIES_DEADLINE_MS antes del paso correspondiente, ese paso se omite con un aviso para no
// cortar la función a mitad de un guardado.

import { supabaseAdmin } from '@/lib/supabase-admin'
import { routeCandidateKams, type AdjacencyMatrix } from '@/lib/opmap-algorithm-simplified'
import {
  MunicipalityTableMissingError,
  recomputeAndSaveMunicipalityZones,
} from '@/lib/municipality-coverage'
import {
  distanceMatrix as googleDistanceMatrix,
  googleRoutesDisabled,
  MAX_ORIGINS,
  type LatLng,
  type MatrixResult,
} from './google-distance-matrix'
import { runFullRecalculation, type FullRecalculationResult } from './full-recalculation'

export const GOOGLE_COST_PER_ELEMENT_USD = 0.005 // mismo precio que calculate-batch-secure
export const GOOGLE_CALL_TIMEOUT_MS = 15_000
export const GOOGLE_BUDGET_MS = 25_000
// Desde el inicio del flujo: después de estos plazos el paso se omite (con aviso) para no acercarse a 60 s
export const RECALCULATE_DEADLINE_MS = 30_000
export const MUNICIPALITIES_DEADLINE_MS = 45_000

export const NO_TRAVEL_TIMES_WARNING = 'Sin tiempos de viaje: la IPS quedará sin zona hasta calcular rutas'

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface RouteHospital {
  id: string
  name: string | null
  active: boolean | null
  department_id: string
  municipality_id: string
  locality_id: string | null
  lat: number | string | null
  lng: number | string | null
}

export interface RouteKam {
  id: string
  name: string
  area_id: string
  lat: number | string | null
  lng: number | string | null
  enable_level2: boolean | null
}

export interface HospitalRouteContext {
  hospital: RouteHospital
  /** Zonas activas que participan en la asignación (las mismas que carga el algoritmo). */
  kams: RouteKam[]
  adjacency: AdjacencyMatrix
  excludedDepartments: string[]
  /** kam_id con fila en hospital_kam_distances para esta IPS. */
  existingKamIds: string[]
}

export interface MissingPair {
  hospital_id: string
  kam_id: string
}

export type RouteStatusReason = 'inactive' | 'no_coordinates' | 'excluded_department' | 'no_candidates' | null

export interface HospitalRoutePlan {
  candidates: RouteKam[]
  existing: RouteKam[]
  missing: RouteKam[]
  reason: RouteStatusReason
}

export interface DistanceUpsertRow {
  hospital_id: string
  kam_id: string
  travel_time: number // SEGUNDOS
  distance: number | null // km
  source: 'google_maps'
  calculated_at: string
  updated_at: string
}

export interface EnsureHospitalDistancesResult {
  /** Zonas candidatas (routeCandidateKams). */
  candidates: number
  /** Pares candidatos que ya estaban en hospital_kam_distances (no se piden). */
  skipped: number
  /** Pares que faltaban antes de llamar a Google. */
  missing: number
  /** Pares calculados con Google y guardados. */
  calculated: number
  /** Google no encontró ruta por carretera (ZERO_RESULTS / NOT_FOUND); no se guardan. */
  noRoute: number
  /** Otros fallos: error de Google, tiempo agotado o guardado fallido. */
  failed: number
  /** Pares que siguen faltando: missing - calculated. */
  pending: number
  googleCalls: number
  /** Elementos que Google pudo facturar (peor caso si una llamada se agotó por tiempo). */
  googleElements: number
  costEstimate: string
  /** GOOGLE_ROUTES_DISABLED=true: no se llamó a Google. */
  disabled: boolean
  reason: RouteStatusReason
  /** Mensaje para el usuario si algo falló (sin detalles internos). */
  error: string | null
}

export interface HospitalRoutesDeps {
  loadContext: (hospitalId: string) => Promise<HospitalRouteContext | null>
  distanceMatrix: (origins: LatLng[], destinations: LatLng[]) => Promise<MatrixResult>
  /** Guarda sin sobrescribir; lanza si algún lote falla. */
  saveDistances: (rows: DistanceUpsertRow[]) => Promise<void>
  routesDisabled: () => boolean
  now: () => number
  callTimeoutMs: number
  budgetMs: number
}

export interface HospitalZoneAssignment {
  kam_id: string
  kam_name: string | null
  assignment_type: string
  travel_time: number | null // SEGUNDOS
}

export interface HospitalZoneRefreshResult {
  routes: EnsureHospitalDistancesResult | null
  recalculated: boolean
  totalAssignments: number | null
  assignment: HospitalZoneAssignment | null
  municipalitiesRecomputed: boolean
  warnings: string[]
  timeMs: number
}

export interface RefreshDeps {
  ensure: (hospitalId: string) => Promise<EnsureHospitalDistancesResult>
  recalculate: () => Promise<FullRecalculationResult>
  recomputeMunicipalities: () => Promise<unknown>
  kamName: (kamId: string) => Promise<string | null>
  now: () => number
  recalculateDeadlineMs: number
  municipalitiesDeadlineMs: number
}

// ---------------------------------------------------------------------------
// Funciones puras
// ---------------------------------------------------------------------------

function hasCoordinates(point: { lat: number | string | null; lng: number | string | null }): boolean {
  if (point.lat === null || point.lat === '' || point.lng === null || point.lng === '') return false
  return Number.isFinite(Number(point.lat)) && Number.isFinite(Number(point.lng))
}

/** Qué pares zona→IPS hacen falta para esta IPS y por qué no hay ninguno, si es el caso. */
export function planHospitalRoutes(context: HospitalRouteContext): HospitalRoutePlan {
  const { hospital } = context
  const empty = (reason: RouteStatusReason): HospitalRoutePlan => ({ candidates: [], existing: [], missing: [], reason })

  if (hospital.active !== true) return empty('inactive')
  if (!hasCoordinates(hospital)) return empty('no_coordinates')
  if (context.excludedDepartments.includes(hospital.department_id)) return empty('excluded_department')

  const candidates = routeCandidateKams(context.kams, hospital, context.adjacency, context.excludedDepartments)
  if (candidates.length === 0) return empty('no_candidates')

  const existingIds = new Set(context.existingKamIds)
  return {
    candidates,
    existing: candidates.filter(kam => existingIds.has(kam.id)),
    missing: candidates.filter(kam => !existingIds.has(kam.id)),
    reason: null,
  }
}

/** Campos de la IPS que deciden su zona (si cambia alguno hay que recalcular). */
export const ZONE_FIELDS = ['lat', 'lng', 'department_id', 'municipality_id', 'locality_id', 'active'] as const
type ZoneField = (typeof ZONE_FIELDS)[number]
export type ZoneFieldValues = Partial<Record<ZoneField, unknown>>

/** true si el cuerpo de una edición incluye algún campo que decide la zona. */
export function touchesZoneFields(payload: Record<string, unknown>): boolean {
  return ZONE_FIELDS.some(field => Object.prototype.hasOwnProperty.call(payload, field))
}

const COORDINATE_TOLERANCE = 1e-7 // las coordenadas se guardan con 6 decimales

function sameCoordinate(a: unknown, b: unknown): boolean {
  const empty = (value: unknown) => value === null || value === undefined || value === ''
  if (empty(a) || empty(b)) return empty(a) && empty(b)
  const x = Number(a)
  const y = Number(b)
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false
  return Math.abs(x - y) < COORDINATE_TOLERANCE
}

function sameText(a: unknown, b: unknown): boolean {
  const normalize = (value: unknown) => (value === null || value === undefined ? '' : String(value).trim())
  return normalize(a) === normalize(b)
}

/** true si entre el estado anterior y el nuevo cambió algún campo que decide la zona. */
export function zoneFieldsChanged(before: ZoneFieldValues, after: ZoneFieldValues): boolean {
  return (
    !sameCoordinate(before.lat, after.lat) ||
    !sameCoordinate(before.lng, after.lng) ||
    !sameText(before.department_id, after.department_id) ||
    !sameText(before.municipality_id, after.municipality_id) ||
    !sameText(before.locality_id, after.locality_id) ||
    Boolean(before.active) !== Boolean(after.active)
  )
}

export function formatCostEstimate(elements: number): string {
  return `$${(elements * GOOGLE_COST_PER_ELEMENT_USD).toFixed(2)} USD`
}

/**
 * Avisos para el usuario a partir del resultado del flujo. El primero es siempre el más importante;
 * NO_TRAVEL_TIMES_WARNING aparece cuando faltan tiempos y la IPS quedó sin zona.
 */
export function buildZoneWarnings(input: {
  routes: EnsureHospitalDistancesResult | null
  recalculated: boolean
  assignment: HospitalZoneAssignment | null
}): string[] {
  const { routes, recalculated, assignment } = input
  const warnings: string[] = []
  const pending = routes?.pending ?? 0
  const competitive = assignment !== null && assignment.assignment_type !== 'base_territory' && assignment.assignment_type !== 'forced'

  if (!routes) {
    if (recalculated && !assignment) warnings.push(NO_TRAVEL_TIMES_WARNING)
    return warnings
  }

  if (routes.reason === 'excluded_department') {
    if (!assignment) warnings.push('La IPS está en un departamento excluido del análisis: no se asigna a ninguna zona')
    return warnings
  }
  if (routes.reason === 'no_candidates') {
    if (!assignment) warnings.push('Ninguna zona puede competir por esta IPS según los departamentos limítrofes: queda sin zona')
    return warnings
  }

  if (pending > 0 && !assignment) {
    warnings.push(NO_TRAVEL_TIMES_WARNING)
  } else if (pending > 0 && competitive) {
    warnings.push(`Faltan ${pending} tiempos de viaje: la zona asignada puede cambiar cuando se calculen`)
  }

  if (pending > 0) {
    if (routes.disabled) {
      warnings.push('El cálculo de rutas con Google está deshabilitado temporalmente (GOOGLE_ROUTES_DISABLED)')
    } else if (routes.error) {
      warnings.push(routes.error)
    }
  }
  if (routes.noRoute > 0) {
    warnings.push(`Google no encontró ruta por carretera desde ${routes.noRoute} zona(s)`)
  }
  if (recalculated && !assignment && pending === 0 && routes.candidates > 0) {
    warnings.push('Ninguna zona elegible llega a esta IPS dentro de su tiempo máximo de viaje: queda sin zona')
  }
  return warnings
}

// ---------------------------------------------------------------------------
// E/S con Supabase
// ---------------------------------------------------------------------------

/** Lee la IPS, las zonas, la adyacencia, los departamentos excluidos y los pares ya calculados. Solo SELECT. */
export async function loadHospitalRouteContext(hospitalId: string): Promise<HospitalRouteContext | null> {
  const [hospitalRes, kamsRes, adjacencyRes, excludedRes, existingRes] = await Promise.all([
    supabaseAdmin
      .from('hospitals')
      .select('id, name, active, department_id, municipality_id, locality_id, lat, lng')
      .eq('id', hospitalId)
      .maybeSingle(),
    supabaseAdmin
      .from('kams')
      .select('id, name, area_id, lat, lng, enable_level2')
      .eq('active', true)
      .eq('participates_in_assignment', true)
      .order('name'),
    supabaseAdmin.from('department_adjacency').select('department_code, adjacent_department_code'),
    supabaseAdmin.from('departments').select('code').eq('excluded', true),
    supabaseAdmin.from('hospital_kam_distances').select('kam_id').eq('hospital_id', hospitalId),
  ])

  const failures: Array<[string, { message: string } | null]> = [
    ['hospitals', hospitalRes.error],
    ['kams', kamsRes.error],
    ['department_adjacency', adjacencyRes.error],
    ['departments', excludedRes.error],
    ['hospital_kam_distances', existingRes.error],
  ]
  for (const [table, error] of failures) {
    if (error) throw new Error(`hospital-routes: error leyendo ${table}: ${error.message}`)
  }
  if (!hospitalRes.data) return null

  const adjacency: AdjacencyMatrix = {}
  for (const row of adjacencyRes.data || []) {
    if (!adjacency[row.department_code]) adjacency[row.department_code] = []
    adjacency[row.department_code].push(row.adjacent_department_code)
  }

  return {
    hospital: hospitalRes.data as RouteHospital,
    kams: (kamsRes.data || []) as RouteKam[],
    adjacency,
    excludedDepartments: (excludedRes.data || []).map(row => String(row.code)),
    existingKamIds: (existingRes.data || []).map(row => String(row.kam_id)),
  }
}

/**
 * Guarda tiempos en hospital_kam_distances como lo hace /api/routes/calculate-batch-secure: lotes de
 * 100, onConflict (hospital_id, kam_id) y, salvo overwrite, sin tocar los pares que ya existen.
 */
export async function upsertHospitalDistances(
  rows: DistanceUpsertRow[],
  options: { overwrite?: boolean; context?: string } = {}
): Promise<{ saved: number; failedChunks: number }> {
  let saved = 0
  let failedChunks = 0
  for (let index = 0; index < rows.length; index += 100) {
    const chunk = rows.slice(index, index + 100)
    const { data, error } = await supabaseAdmin
      .from('hospital_kam_distances')
      .upsert(chunk, { onConflict: 'hospital_id,kam_id', ignoreDuplicates: !options.overwrite })
      .select('id')
    if (error) {
      failedChunks++
      console.error(`${options.context ?? 'hospital-routes'}: error guardando lote de hospital_kam_distances`, error)
    } else {
      saved += data?.length || 0
    }
  }
  return { saved, failedChunks }
}

async function saveDistancesOrThrow(rows: DistanceUpsertRow[]): Promise<void> {
  const { failedChunks } = await upsertHospitalDistances(rows, { context: 'hospital-routes' })
  if (failedChunks > 0) throw new Error(`hospital-routes: ${failedChunks} lote(s) sin guardar`)
}

async function loadKamName(kamId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin.from('kams').select('name').eq('id', kamId).maybeSingle()
  if (error) throw error
  return data?.name ?? null
}

function defaultRoutesDeps(): HospitalRoutesDeps {
  return {
    loadContext: loadHospitalRouteContext,
    distanceMatrix: googleDistanceMatrix,
    saveDistances: saveDistancesOrThrow,
    routesDisabled: googleRoutesDisabled,
    now: () => Date.now(),
    callTimeoutMs: GOOGLE_CALL_TIMEOUT_MS,
    budgetMs: GOOGLE_BUDGET_MS,
  }
}

class GoogleTimeoutError extends Error {
  constructor(ms: number) {
    super(`Distance Matrix: sin respuesta en ${ms} ms`)
    this.name = 'GoogleTimeoutError'
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new GoogleTimeoutError(ms)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer)
  })
}

// ---------------------------------------------------------------------------
// API del módulo
// ---------------------------------------------------------------------------

/** Pares {hospital_id, kam_id} que faltan en hospital_kam_distances para esta IPS. Solo lectura. */
export async function missingPairsForHospital(
  hospitalId: string,
  loadContext: HospitalRoutesDeps['loadContext'] = loadHospitalRouteContext
): Promise<MissingPair[]> {
  const context = await loadContext(hospitalId)
  if (!context) return []
  return planHospitalRoutes(context).missing.map(kam => ({ hospital_id: hospitalId, kam_id: kam.id }))
}

/** Resumen para la ficha de la IPS: cuántas zonas candidatas hay y cuántos tiempos faltan. Solo lectura. */
export async function getHospitalRouteStatus(
  hospitalId: string,
  loadContext: HospitalRoutesDeps['loadContext'] = loadHospitalRouteContext
): Promise<{ candidates: number; missing: number; reason: RouteStatusReason } | null> {
  const context = await loadContext(hospitalId)
  if (!context) return null
  const plan = planHospitalRoutes(context)
  return { candidates: plan.candidates.length, missing: plan.missing.length, reason: plan.reason }
}

/**
 * Calcula con Google SOLO los pares zona→IPS que faltan y los guarda (SEGUNDOS, source 'google_maps').
 * Una IPS es un único destino: cada petición lleva hasta MAX_ORIGINS zonas como orígenes (sentido
 * zona→IPS, igual que calculate-batch-secure); Google factura por elemento, así que cuesta lo mismo
 * que agrupar por zona y hace menos llamadas. No lanza: los fallos quedan en `error` y `failed`.
 */
export async function ensureHospitalDistances(
  hospitalId: string,
  options: { actorId?: string; deps?: Partial<HospitalRoutesDeps> } = {}
): Promise<EnsureHospitalDistancesResult> {
  const deps: HospitalRoutesDeps = { ...defaultRoutesDeps(), ...options.deps }
  const result: EnsureHospitalDistancesResult = {
    candidates: 0,
    skipped: 0,
    missing: 0,
    calculated: 0,
    noRoute: 0,
    failed: 0,
    pending: 0,
    googleCalls: 0,
    googleElements: 0,
    costEstimate: formatCostEstimate(0),
    disabled: false,
    reason: null,
    error: null,
  }

  let context: HospitalRouteContext | null
  try {
    context = await deps.loadContext(hospitalId)
  } catch (error) {
    console.error('[hospital-routes] no se pudieron leer los datos de la IPS', error)
    result.error = 'No se pudieron leer los datos para calcular rutas'
    return result
  }
  if (!context) {
    result.error = 'IPS no encontrada'
    return result
  }

  const plan = planHospitalRoutes(context)
  result.reason = plan.reason
  result.candidates = plan.candidates.length
  result.skipped = plan.existing.length
  result.missing = plan.missing.length
  result.pending = plan.missing.length
  if (plan.missing.length === 0) return result

  if (deps.routesDisabled()) {
    result.disabled = true
    return result
  }

  const destination: LatLng = { lat: Number(context.hospital.lat), lng: Number(context.hospital.lng) }
  const rows: DistanceUpsertRow[] = []
  const started = deps.now()

  for (let index = 0; index < plan.missing.length; index += MAX_ORIGINS) {
    const chunk = plan.missing.slice(index, index + MAX_ORIGINS)
    if (deps.now() - started > deps.budgetMs) {
      result.failed += plan.missing.length - index
      result.error = 'Se agotó el tiempo para calcular rutas; vuelve a intentarlo'
      break
    }

    let matrix: MatrixResult
    try {
      matrix = await withTimeout(
        deps.distanceMatrix(
          chunk.map(kam => ({ lat: Number(kam.lat), lng: Number(kam.lng) })),
          [destination]
        ),
        deps.callTimeoutMs
      )
    } catch (error) {
      console.error('[hospital-routes] Distance Matrix falló', error)
      result.googleCalls++
      // Si se agotó el tiempo, Google pudo facturar igualmente: se cuenta el peor caso
      if (error instanceof GoogleTimeoutError) result.googleElements += chunk.length
      result.failed += chunk.length
      result.error = 'Google Maps no respondió; vuelve a intentarlo más tarde'
      continue
    }

    result.googleCalls++
    result.googleElements += matrix.elementsBilled
    if (!matrix.ok) {
      result.failed += chunk.length
      result.error = `Google Maps respondió ${matrix.status}; vuelve a intentarlo más tarde`
      continue
    }

    const now = new Date(deps.now()).toISOString()
    chunk.forEach((kam, position) => {
      const element = matrix.rows[position]?.[0]
      if (element?.ok && element.durationSeconds !== null) {
        rows.push({
          hospital_id: hospitalId,
          kam_id: kam.id,
          travel_time: element.durationSeconds, // SEGUNDOS
          distance: element.distanceKm,
          source: 'google_maps',
          calculated_at: now,
          updated_at: now,
        })
      } else if (element && (element.status === 'ZERO_RESULTS' || element.status === 'NOT_FOUND')) {
        result.noRoute++
      } else {
        result.failed++
      }
    })
  }

  if (result.googleElements > 0) {
    console.info(
      `[google-distance-matrix] hospital-routes hospital=${hospitalId}` +
        `${options.actorId ? ` usuario=${options.actorId}` : ''} llamadas=${result.googleCalls} elementos=${result.googleElements}`
    )
  }

  if (rows.length > 0) {
    try {
      await deps.saveDistances(rows)
      result.calculated = rows.length
    } catch (error) {
      console.error('[hospital-routes] no se pudieron guardar los tiempos de viaje', error)
      result.failed += rows.length
      result.error = 'No se pudieron guardar los tiempos de viaje; vuelve a intentarlo'
    }
  }

  result.pending = result.missing - result.calculated
  result.costEstimate = formatCostEstimate(result.googleElements)
  return result
}

/**
 * Flujo completo tras crear/editar/activar una IPS: tiempos que faltan → recálculo completo de
 * asignaciones → municipality_zone. Nunca lanza; devuelve la zona resultante y los avisos.
 */
export async function refreshHospitalZone(
  hospitalId: string,
  options: { actorId?: string; deps?: Partial<RefreshDeps> } = {}
): Promise<HospitalZoneRefreshResult> {
  try {
    return await runHospitalZoneRefresh(hospitalId, options)
  } catch (error) {
    // Red de seguridad: la IPS ya está guardada y la respuesta no debe fallar por este paso
    console.error('[hospital-routes] refreshHospitalZone falló', error)
    return {
      routes: null,
      recalculated: false,
      totalAssignments: null,
      assignment: null,
      municipalitiesRecomputed: false,
      warnings: [
        'La IPS se guardó, pero no se pudo actualizar su zona; vuelve a intentarlo con "Calcular rutas y asignar"',
      ],
      timeMs: 0,
    }
  }
}

async function runHospitalZoneRefresh(
  hospitalId: string,
  options: { actorId?: string; deps?: Partial<RefreshDeps> }
): Promise<HospitalZoneRefreshResult> {
  const deps: RefreshDeps = {
    ensure: id => ensureHospitalDistances(id, { actorId: options.actorId }),
    recalculate: runFullRecalculation,
    recomputeMunicipalities: () => recomputeAndSaveMunicipalityZones(),
    kamName: loadKamName,
    now: () => Date.now(),
    recalculateDeadlineMs: RECALCULATE_DEADLINE_MS,
    municipalitiesDeadlineMs: MUNICIPALITIES_DEADLINE_MS,
    ...options.deps,
  }
  const started = deps.now()
  const extraWarnings: string[] = []

  let routes: EnsureHospitalDistancesResult | null = null
  try {
    routes = await deps.ensure(hospitalId)
  } catch (error) {
    console.error('[hospital-routes] ensureHospitalDistances falló', error)
  }

  const result: HospitalZoneRefreshResult = {
    routes,
    recalculated: false,
    totalAssignments: null,
    assignment: null,
    municipalitiesRecomputed: false,
    warnings: [],
    timeMs: 0,
  }

  // Una IPS inactiva no se asigna: no hay nada que recalcular
  if (routes?.reason === 'inactive') {
    result.timeMs = deps.now() - started
    return result
  }

  if (deps.now() - started > deps.recalculateDeadlineMs) {
    extraWarnings.push('No dio tiempo a recalcular las zonas; usa "Calcular rutas y asignar" en la ficha de la IPS')
  } else {
    try {
      const recalculation = await deps.recalculate()
      result.recalculated = true
      result.totalAssignments = recalculation.totalAssignments
      const assignment = recalculation.assignmentFor(hospitalId)
      if (assignment) {
        let kamName: string | null = null
        try {
          kamName = await deps.kamName(assignment.kam_id)
        } catch (error) {
          console.error('[hospital-routes] no se pudo leer el nombre de la zona', error)
        }
        result.assignment = {
          kam_id: assignment.kam_id,
          kam_name: kamName,
          assignment_type: assignment.assignment_type,
          travel_time: assignment.travel_time,
        }
      }
    } catch (error) {
      console.error('[hospital-routes] recálculo completo falló', error)
      extraWarnings.push(
        'La IPS se guardó, pero no se pudo recalcular la asignación de zonas; vuelve a intentarlo con "Calcular rutas y asignar"'
      )
    }
  }

  // municipality_zone depende de las asignaciones: solo se recalcula si estas se actualizaron
  if (result.recalculated) {
    if (deps.now() - started > deps.municipalitiesDeadlineMs) {
      extraWarnings.push('No dio tiempo a actualizar los municipios del mapa; un administrador puede recalcularlos')
    } else {
      try {
        await deps.recomputeMunicipalities()
        result.municipalitiesRecomputed = true
      } catch (error) {
        // Sin la migración de la Fase 2b no hay capa de municipios que actualizar: no es un fallo
        if (!(error instanceof MunicipalityTableMissingError)) {
          console.error('[hospital-routes] recálculo de municipality_zone falló', error)
          extraWarnings.push('No se pudo actualizar el mapa de municipios; un administrador puede recalcularlo')
        }
      }
    }
  }

  result.warnings = [
    ...buildZoneWarnings({ routes, recalculated: result.recalculated, assignment: result.assignment }),
    ...extraWarnings,
  ]
  result.timeMs = deps.now() - started
  return result
}

/** Forma pública (JSON) del resultado para las respuestas de la API. */
export function zoneRefreshResponse(result: HospitalZoneRefreshResult | null) {
  if (!result) return null
  const routes = result.routes
  return {
    assignment: result.assignment,
    recalculated: result.recalculated,
    municipalitiesRecomputed: result.municipalitiesRecomputed,
    routes: routes
      ? {
          candidates: routes.candidates,
          skipped: routes.skipped,
          missing: routes.missing,
          calculated: routes.calculated,
          noRoute: routes.noRoute,
          failed: routes.failed,
          pending: routes.pending,
          googleElements: routes.googleElements,
          costEstimate: routes.costEstimate,
          disabled: routes.disabled,
        }
      : null,
    timeMs: result.timeMs,
  }
}
