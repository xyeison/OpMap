/**
 * IPS nuevas o editadas · pruebas puras (SIN RED, sin Supabase, sin Google).
 *
 * Comprueba app/api/_lib/hospital-routes.ts y el criterio único de candidatas
 * (routeCandidateKams en lib/opmap-algorithm-simplified.ts):
 *  1. Candidatas de UPRES SANTANDER (68276), UPRES ANTIOQUIA (05266), HOCEN (Bogotá, 1100113) y una
 *     IPS de Chocó (27), con la matriz department_adjacency y las 16 zonas activas copiadas de Supabase
 *     el 2026-10-11 (solo lectura).
 *  2. ensureHospitalDistances con distanceMatrix y el guardado simulados: solo pide los pares que
 *     faltan, ≤ MAX_ORIGINS zonas por llamada, sentido zona→IPS, SEGUNDOS, source 'google_maps',
 *     GOOGLE_ROUTES_DISABLED, errores de Google, tiempo agotado y fallo al guardar.
 *  3. refreshHospitalZone con el recálculo simulado: avisos (incluido "Sin tiempos de viaje: la IPS
 *     quedará sin zona hasta calcular rutas"), plazos y tabla de municipios ausente.
 *  4. Validación zod de hospitales (Bogotá necesita localidad de 7 dígitos, coordenadas en Colombia).
 *  5. Cola de pendientes (app/api/_lib/pending-assignment.ts): clasificación sin asignación (a), pares
 *     que faltan o desactualizados (b), cambio de ubicación después de la asignación (c) y tiempos
 *     nuevos sin usar; fechas sin zona; resumen y orden por cursor.
 *  6. Acción masiva (process-pending): la fase A agrupa por lotes (pares y presupuesto de tiempo) y
 *     avanza con cursor; la fase B (recálculo completo) solo cuando en la pasada no quedan IPS con pares
 *     por calcular; GOOGLE_ROUTES_DISABLED salta la fase A.
 *  7. Rutas reales (POST /api/hospitals, PUT /api/hospitals/[id], POST activate, GET pending-assignment,
 *     POST process-pending) contra un Supabase FALSO en memoria: crear, editar o activar NO llama a
 *     Google ni al recálculo (no toca assignments, hospital_kam_distances ni kams) y responde
 *     pending/warnings.
 *
 * Garantía de "sin red": se borran del entorno las claves de Google y Supabase, se fuerza
 * GOOGLE_ROUTES_DISABLED=true y fetch se reemplaza por un despachador que falla salvo en la sección 7,
 * donde solo responde a http://supabase.test (un PostgREST falso en memoria) y registra cualquier otro
 * destino como intento de red; el resto de la E/S se inyecta con dobles.
 *
 * Uso (desde web/): npm run ips:check   (= npx tsx scripts/ips-routes-check.ts)
 * Código de salida 1 si alguna prueba falla.
 */
import {
  buildZoneWarnings,
  ensureHospitalDistances,
  formatCostEstimate,
  getHospitalRouteStatus,
  missingPairsForHospital,
  NO_TRAVEL_TIMES_WARNING,
  planHospitalRoutes,
  refreshHospitalZone,
  touchesZoneFields,
  zoneFieldsChanged,
  type DistanceUpsertRow,
  type EnsureHospitalDistancesResult,
  type HospitalRouteContext,
  type HospitalRoutesDeps,
  type RefreshDeps,
  type RouteHospital,
  type RouteKam,
} from '../app/api/_lib/hospital-routes'
import { MAX_ORIGINS, type LatLng, type MatrixResult } from '../app/api/_lib/google-distance-matrix'
import {
  BOGOTA_LOCALITY_REQUIRED,
  createHospitalSchema,
  patchHospitalSchema,
  updateHospitalSchema,
} from '../app/api/_lib/hospital-schemas'
import { eligibleKamsForHospital, isBogotaKam, routeCandidateKams } from '../lib/opmap-algorithm-simplified'
import { MunicipalityTableMissingError } from '../lib/municipality-coverage'
import {
  classifyPendingHospitals,
  ensurePendingHospitalDistances,
  locationChangeHistoryRow,
  PENDING_ASSIGNMENT_WARNING,
  pendingStatusFromSnapshot,
  pendingSummaryResponse,
  processPendingStep,
  routesQueue,
  runPendingRoutesStep,
  timestampMs,
  type PendingAssignDeps,
  type PendingRoutesDeps,
  type PendingSnapshot,
  type PendingSourceHospital,
} from '../app/api/_lib/pending-assignment'
import { NextRequest } from 'next/server'
import { POST as createHospitalRoute } from '../app/api/hospitals/route'
import { PUT as updateHospitalRoute } from '../app/api/hospitals/[id]/route'
import { POST as activateHospitalRoute } from '../app/api/hospitals/[id]/activate/route'
import { GET as pendingAssignmentRoute } from '../app/api/hospitals/pending-assignment/route'
import { POST as processPendingRoute } from '../app/api/hospitals/process-pending/route'
import { POST as createUserRoute } from '../app/api/users/route'
import { POST as importVisitsRoute } from '../app/api/visits/import/route'
import { DELETE as deleteImportRoute } from '../app/api/visits/imports/route'
import { PATCH as updateExecutiveRoute } from '../app/api/executives/[id]/route'
import { GET as planAccountsRoute, POST as createAccountsRoute } from '../app/api/users/from-executives/route'
import { generateTempPassword, planExecutiveAccounts } from '../lib/executive-accounts'
import bcrypt from 'bcryptjs'
import { passwordVersion, SESSION_COOKIE_NAME, signSession } from '../lib/session'

for (const key of [
  'GOOGLE_MAPS_API_KEY',
  'NEXT_PUBLIC_GOOGLE_MAPS_API_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_URL',
  'SESSION_SECRET',
]) {
  delete process.env[key]
}
process.env.GOOGLE_ROUTES_DISABLED = 'true'
// Despachador único: sin manejador (todas las secciones salvo la 7) cualquier fetch falla. El cliente de
// Supabase captura `fetch` al crearse, por eso se instala una sola vez y se cambia el manejador.
type FetchHandler = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
let fetchHandler: FetchHandler | null = null
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  if (!fetchHandler) throw new Error('ips-routes-check: la red está prohibida en estas pruebas')
  return fetchHandler(input, init)
}) as typeof fetch

// Los console.error / console.info del módulo (fallos simulados y traza de gasto en Google) se
// recogen aquí para comprobarlos sin ensuciar la salida.
const moduleLogs: string[] = []
const capture = (...args: unknown[]) => {
  moduleLogs.push(args.map(arg => (arg instanceof Error ? `${arg.name}: ${arg.message}` : String(arg))).join(' '))
}
console.error = capture
console.info = capture

// ---------------------------------------------------------------------------
// Mini marco de pruebas
// ---------------------------------------------------------------------------

const print = (line = '') => process.stdout.write(`${line}\n`)
let passed = 0
let failed = 0

function check(name: string, condition: boolean, detail?: string) {
  if (condition) {
    passed++
    print(`  OK    ${name}`)
  } else {
    failed++
    print(`  FALLA ${name}${detail ? ` -> ${detail}` : ''}`)
  }
}

function sameSet(actual: string[], expected: string[]): boolean {
  const a = [...actual].sort()
  const b = [...expected].sort()
  return a.length === b.length && a.every((value, index) => value === b[index])
}

// ---------------------------------------------------------------------------
// Datos de referencia (copiados de Supabase el 2026-10-11, solo lectura)
// ---------------------------------------------------------------------------

// department_adjacency tal cual (dirigida: department_code -> adjacent_department_code)
const ADJACENCY: Record<string, string[]> = {
  '05': ['13', '15', '17', '23', '27', '66', '68'],
  '08': ['13', '47'],
  '11': ['05', '15', '17', '25', '41', '50', '73', '85'],
  '13': ['08', '20', '23', '47', '68', '70'],
  '15': ['05', '17', '25', '54', '68', '81', '85'],
  '17': ['05', '15', '25', '66', '73'],
  '18': ['19', '41', '50', '86', '91', '95', '97'],
  '19': ['18', '41', '52', '73', '76', '86'],
  '20': ['13', '44', '47', '54', '68'],
  '23': ['05', '13', '70'],
  '25': ['05', '11', '15', '17', '41', '50', '73', '85'],
  '27': ['05', '66', '76'],
  '41': ['18', '19', '25', '50', '73'],
  '44': ['20', '47'],
  '47': ['08', '13', '20'],
  '50': ['11', '18', '25', '41', '85', '95', '99'],
  '52': ['18', '86'],
  '54': ['15', '20', '68', '81'],
  '63': ['66', '73', '76'],
  '66': ['05', '17', '27', '63', '73', '76'],
  '68': ['05', '13', '15', '20', '54'],
  '70': ['13', '23'],
  '73': ['17', '18', '25', '41', '63', '66', '76'],
  '76': ['18', '19', '27', '63', '66', '73'],
  '81': ['15', '54', '85', '99'],
  '85': ['15', '25', '50', '81', '99'],
  '86': ['18', '19', '52', '91'],
  '91': ['18', '86', '97'],
  '94': ['95', '97', '99'],
  '95': ['18', '50', '94', '97', '99'],
  '97': ['18', '91', '94', '95'],
  '99': ['50', '81', '85', '94', '95'],
}
const EXCLUDED = ['27', '88', '91', '94', '95', '97', '99']

// Las 16 zonas activas que participan en la asignación (kams). Coordenadas aproximadas de la ciudad base.
const zone = (name: string, area_id: string, lat: number, lng: number): RouteKam => ({
  id: `kam-${area_id}`,
  name,
  area_id,
  lat,
  lng,
  enable_level2: true,
})
const ZONES: RouteKam[] = [
  zone('Barranquilla', '08001', 10.9639, -74.7964),
  zone('Bucaramanga', '68001', 7.1193, -73.1227),
  zone('Cali', '76001', 3.4516, -76.532),
  zone('Cartagena', '13001', 10.391, -75.4794),
  zone('Chapinero', '1100102', 4.6486, -74.0628),
  zone('Cúcuta', '54001', 7.8939, -72.5078),
  zone('Engativá', '1100110', 4.7059, -74.1075),
  zone('Ibagué', '73001', 4.4389, -75.2322),
  zone('Kennedy', '1100108', 4.6269, -74.1517),
  zone('Medellín', '05001', 6.2442, -75.5812),
  zone('Montería', '23001', 8.7479, -75.8814),
  zone('Neiva', '41001', 2.9273, -75.2819),
  zone('Pasto', '52001', 1.2136, -77.2811),
  zone('Pereira', '66001', 4.8133, -75.6961),
  zone('San Cristóbal', '1100104', 4.5711, -74.0864),
  zone('Valledupar', '20001', 10.4631, -73.2532),
]
const zoneByName = new Map(ZONES.map(kam => [kam.name, kam]))
const nameOf = (id: string) => ZONES.find(kam => kam.id === id)?.name ?? id

const hospital = (overrides: Partial<RouteHospital> & Pick<RouteHospital, 'id'>): RouteHospital => ({
  name: overrides.id,
  active: true,
  department_id: '68',
  municipality_id: '68276',
  locality_id: null,
  lat: 7.07480292,
  lng: -73.10944495,
  ...overrides,
})

const UPRES_SANTANDER = hospital({ id: 'upres-santander', name: 'UPRES SANTANDER' })
const UPRES_ANTIOQUIA = hospital({
  id: 'upres-antioquia',
  name: 'UPRES ANTIOQUIA',
  department_id: '05',
  municipality_id: '05266',
  lat: 6.16204445,
  lng: -75.59868297,
})
const HOCEN = hospital({
  id: 'hocen',
  name: 'Hospital Central de la Policía (HOCEN)',
  department_id: '11',
  municipality_id: '11001',
  locality_id: '1100113',
  lat: 4.64723938,
  lng: -74.09742128,
})
const CHOCO = hospital({
  id: 'choco',
  name: 'IPS de Quibdó',
  department_id: '27',
  municipality_id: '27001',
  lat: 5.6919,
  lng: -76.6583,
})
const SIN_COORDENADAS = hospital({ id: 'sin-coords', lat: null, lng: null })

function context(h: RouteHospital, existing: string[] = [], kams: RouteKam[] = ZONES): HospitalRouteContext {
  return {
    hospital: h,
    kams,
    adjacency: ADJACENCY,
    excludedDepartments: EXCLUDED,
    existingKamIds: existing.map(name => zoneByName.get(name)?.id ?? name),
  }
}

const candidateNames = (h: RouteHospital) =>
  routeCandidateKams(ZONES, h, ADJACENCY, EXCLUDED).map(kam => kam.name)

// ---------------------------------------------------------------------------
// Dobles de E/S
// ---------------------------------------------------------------------------

interface MatrixCall {
  origins: LatLng[]
  destinations: LatLng[]
}

function fakeMatrix(options: { noRouteOrigins?: number[] } = {}) {
  const calls: MatrixCall[] = []
  const fn = async (origins: LatLng[], destinations: LatLng[]): Promise<MatrixResult> => {
    calls.push({ origins, destinations })
    const noRoute = new Set(options.noRouteOrigins ?? [])
    return {
      ok: true,
      status: 'OK',
      elementsBilled: origins.length * destinations.length,
      rows: origins.map((_origin, index) =>
        destinations.map(() =>
          noRoute.has(calls.length * 1000 + index)
            ? { ok: false, status: 'ZERO_RESULTS', durationSeconds: null, distanceKm: null }
            : { ok: true, status: 'OK', durationSeconds: 1800 + index * 60, distanceKm: 25 + index }
        )
      ),
    }
  }
  return { calls, fn }
}

function routesDeps(ctx: HospitalRouteContext | null, overrides: Partial<HospitalRoutesDeps> = {}) {
  const saved: DistanceUpsertRow[][] = []
  const deps: Partial<HospitalRoutesDeps> = {
    loadContext: async () => ctx,
    saveDistances: async rows => {
      saved.push(rows)
    },
    routesDisabled: () => false,
    now: () => Date.UTC(2026, 9, 11, 12, 0, 0),
    callTimeoutMs: 1000,
    budgetMs: 25_000,
    ...overrides,
  }
  return { deps, saved }
}

function ensureResult(overrides: Partial<EnsureHospitalDistancesResult> = {}): EnsureHospitalDistancesResult {
  return {
    candidates: 4,
    skipped: 0,
    missing: 4,
    calculated: 0,
    noRoute: 0,
    failed: 0,
    pending: 4,
    googleCalls: 0,
    googleElements: 0,
    costEstimate: formatCostEstimate(0),
    disabled: true,
    reason: null,
    error: null,
    ...overrides,
  }
}

function refreshDeps(overrides: Partial<RefreshDeps> & { assignment?: { kam_id: string; travel_time: number | null; assignment_type: string } | null } = {}) {
  const calls = { ensure: 0, recalculate: 0, municipalities: 0 }
  const { assignment = null, ...rest } = overrides
  const deps: Partial<RefreshDeps> = {
    ensure: async () => {
      calls.ensure++
      return ensureResult()
    },
    recalculate: async () => {
      calls.recalculate++
      return { totalAssignments: 767, assignmentFor: () => assignment ?? undefined }
    },
    recomputeMunicipalities: async () => {
      calls.municipalities++
    },
    kamName: async kamId => nameOf(kamId),
    now: () => 0,
    ...rest,
  }
  return { deps, calls }
}

// ---------------------------------------------------------------------------
// Cola de pendientes: datos de prueba
// ---------------------------------------------------------------------------

const LAST_RECALC = '2026-10-11T13:05:52.221625+00:00' // min(assignments.assigned_at)
const BEFORE_RECALC = '2026-10-01T10:00:00' // hospital_kam_distances.calculated_at (timestamp SIN zona, UTC)
const AFTER_RECALC_NO_TZ = '2026-10-11T14:00:00' // calculado después del último recálculo
const LONG_AGO = '2025-07-22T16:49:12.403608+00:00'
const AFTER_RECALC = '2026-10-11T15:00:00+00:00'

const pendingHospital = (
  overrides: Partial<PendingSourceHospital> & Pick<PendingSourceHospital, 'id'>
): PendingSourceHospital => ({
  ...hospital(overrides),
  created_at: LONG_AGO,
  municipality_name: 'Floridablanca',
  ...overrides,
})

function pairsFor(h: RouteHospital, calculatedAt: string, except: string[] = []) {
  return routeCandidateKams(ZONES, h, ADJACENCY, EXCLUDED)
    .filter(kam => !except.includes(kam.name))
    .map(kam => ({ hospital_id: h.id, kam_id: kam.id, calculated_at: calculatedAt, updated_at: calculatedAt }))
}

function snapshotOf(parts: Partial<PendingSnapshot>): PendingSnapshot {
  return {
    hospitals: [],
    kams: ZONES,
    adjacency: ADJACENCY,
    excludedDepartments: EXCLUDED,
    distances: [],
    assignments: [],
    history: [],
    lastRecalculationAt: LAST_RECALC,
    ...parts,
  }
}

// ---------------------------------------------------------------------------
// Supabase FALSO (PostgREST mínimo en memoria) para probar las rutas reales sin red
// ---------------------------------------------------------------------------

interface FakeRequest {
  method: string
  table: string
  params: URLSearchParams
  body: unknown
}

const FAKE_SUPABASE_URL = 'http://supabase.test'
const POSTGREST_CONTROL_PARAMS = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'])

function matchesFilters(row: Record<string, unknown>, params: URLSearchParams): boolean {
  for (const [key, raw] of Array.from(params.entries())) {
    if (POSTGREST_CONTROL_PARAMS.has(key)) continue
    const value = row[key] === null || row[key] === undefined ? 'null' : String(row[key])
    if (raw.startsWith('eq.')) {
      if (value !== raw.slice(3)) return false
    } else if (raw.startsWith('in.(') && raw.endsWith(')')) {
      const options = raw.slice(4, -1).split(',').map(option => option.replace(/^"|"$/g, ''))
      if (!options.includes(value)) return false
    } else if (raw.startsWith('neq.')) {
      if (value === raw.slice(4)) return false
    } else if (raw === 'is.null') {
      if (value !== 'null') return false
    } else if (raw.startsWith('ilike.')) {
      // Patrón ILIKE de PostgREST: % y _ comodines, \ escapa; comparación sin mayúsculas
      const pattern = raw.slice(6)
      let regex = ''
      for (let i = 0; i < pattern.length; i++) {
        const char = pattern[i]
        if (char === '\\' && i + 1 < pattern.length) regex += pattern[++i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        else if (char === '%') regex += '.*'
        else if (char === '_') regex += '.'
        else regex += char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      }
      if (value === 'null' || !new RegExp(`^${regex}$`, 'i').test(value)) return false
    } else {
      throw new Error(`Supabase falso: filtro no soportado ${key}=${raw}`)
    }
  }
  return true
}

function fakeSupabase(tables: Record<string, Array<Record<string, unknown>>>) {
  const requests: FakeRequest[] = []
  const external: string[] = []
  let sequence = 0
  const json = (payload: unknown, status = 200) =>
    new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json' } })

  const handler: FetchHandler = async (input, init) => {
    const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const url = new URL(href)
    if (url.origin !== FAKE_SUPABASE_URL) {
      external.push(url.origin)
      throw new Error(`ips-routes-check: intento de red a ${url.origin}`)
    }
    const method = (init?.method || 'GET').toUpperCase()
    const table = url.pathname.replace('/rest/v1/', '')
    const body = init?.body ? JSON.parse(String(init.body)) : undefined
    requests.push({ method, table, params: url.searchParams, body })
    const wantsObject = (new Headers(init?.headers).get('accept') || '').includes('vnd.pgrst.object')
    const store = (tables[table] = tables[table] ?? [])

    let rows: Array<Record<string, unknown>>
    if (method === 'GET') {
      rows = store.filter(row => matchesFilters(row, url.searchParams))
      const order = url.searchParams.get('order')
      if (order) {
        const [column, direction] = order.split(',')[0].split('.')
        rows = [...rows].sort((a, b) => {
          const x = String(a[column] ?? '')
          const y = String(b[column] ?? '')
          return (x < y ? -1 : x > y ? 1 : 0) * (direction === 'desc' ? -1 : 1)
        })
      }
      const offset = Number(url.searchParams.get('offset') ?? 0)
      const limit = url.searchParams.get('limit')
      rows = rows.slice(offset, limit === null ? undefined : offset + Number(limit))
    } else if (method === 'POST') {
      rows = (Array.isArray(body) ? body : [body]).map(row => ({
        id: `fake-${table}-${++sequence}`,
        created_at: new Date().toISOString(),
        ...row,
      }))
      store.push(...rows)
    } else if (method === 'PATCH') {
      rows = store.filter(row => matchesFilters(row, url.searchParams))
      rows.forEach(row => Object.assign(row, body))
    } else {
      throw new Error(`Supabase falso: método no soportado ${method}`)
    }

    if (wantsObject) {
      if (rows.length !== 1) {
        return json({ code: 'PGRST116', details: `The result contains ${rows.length} rows`, hint: null, message: 'JSON object requested, multiple (or no) rows returned' }, 406)
      }
      return json(rows[0], method === 'POST' ? 201 : 200)
    }
    return json(rows, method === 'POST' ? 201 : 200)
  }

  const touched = () => Array.from(new Set(requests.map(request => request.table)))
  const writes = () => requests.filter(request => request.method !== 'GET')
  return { handler, requests, external, touched, writes }
}

// Usuarios de la sesión simulada (la contraseña guardada solo sirve para el claim pv)
const ADMIN_ID = '11111111-1111-4111-8111-111111111111'
const VIEWER_ID = '22222222-2222-4222-8222-222222222222'
const fakeUsers = () => [
  { id: ADMIN_ID, email: 'admin@test.local', full_name: 'Admin', role: 'admin', active: true, password: 'hash-admin' },
  { id: VIEWER_ID, email: 'viewer@test.local', full_name: 'Viewer', role: 'viewer', active: true, password: 'hash-viewer' },
]

function apiRequest(path: string, options: { method?: string; body?: unknown; userId?: string; password?: string } = {}) {
  const token = signSession(options.userId ?? ADMIN_ID, passwordVersion(options.password ?? 'hash-admin'))
  return new NextRequest(`http://localhost:3000${path}`, {
    method: options.method ?? 'GET',
    headers: { cookie: `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`, 'content-type': 'application/json' },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  })
}

// Tablas que tocaría el recálculo completo, la capa de municipios o el cálculo de rutas
const RECALCULATION_TABLES = ['assignments', 'hospital_kam_distances', 'kams', 'department_adjacency', 'departments', 'municipality_zone', 'municipality_travel_times']

// ---------------------------------------------------------------------------
// Pruebas
// ---------------------------------------------------------------------------

async function main() {
  print('1. Candidatas (criterio único routeCandidateKams)')
  const santander = candidateNames(UPRES_SANTANDER)
  print(`        UPRES SANTANDER (68276): ${santander.join(', ')}`)
  check('UPRES SANTANDER incluye Bucaramanga', santander.includes('Bucaramanga'))
  check('UPRES SANTANDER incluye Cúcuta', santander.includes('Cúcuta'))
  check('UPRES SANTANDER no incluye Pasto', !santander.includes('Pasto'))

  const antioquia = candidateNames(UPRES_ANTIOQUIA)
  print(`        UPRES ANTIOQUIA (05266): ${antioquia.join(', ')}`)
  check('UPRES ANTIOQUIA incluye Medellín', antioquia.includes('Medellín'))
  check('UPRES ANTIOQUIA no incluye Pasto', !antioquia.includes('Pasto'))

  const hocen = candidateNames(HOCEN)
  print(`        HOCEN (11001, localidad 1100113): ${hocen.join(', ')}`)
  check(
    'HOCEN: solo las zonas de Bogotá (Chapinero, Engativá, Kennedy, San Cristóbal)',
    sameSet(hocen, ['Chapinero', 'Engativá', 'Kennedy', 'San Cristóbal']),
    hocen.join(', ')
  )
  check(
    'HOCEN: todas las candidatas son zonas de localidad de Bogotá',
    routeCandidateKams(ZONES, HOCEN, ADJACENCY, EXCLUDED).every(isBogotaKam)
  )
  check('IPS de Chocó (27): sin candidatas', candidateNames(CHOCO).length === 0)
  check('IPS sin coordenadas: sin candidatas', candidateNames(SIN_COORDENADAS).length === 0)
  check(
    'Fuera de departamentos excluidos coincide exactamente con el algoritmo (eligibleKamsForHospital)',
    [UPRES_SANTANDER, UPRES_ANTIOQUIA, HOCEN].every(h =>
      sameSet(candidateNames(h), eligibleKamsForHospital(ZONES, h, ADJACENCY).map(kam => kam.name))
    )
  )
  check(
    'Zonas sin coordenadas no son candidatas',
    !routeCandidateKams(
      [...ZONES, { ...zone('Sin coords', '68081', 0, 0), lat: null, lng: null }],
      UPRES_SANTANDER,
      ADJACENCY,
      EXCLUDED
    ).some(kam => kam.name === 'Sin coords')
  )

  print('\n2. Plan de rutas (planHospitalRoutes / missingPairsForHospital / getHospitalRouteStatus)')
  const plan = planHospitalRoutes(context(UPRES_SANTANDER, ['Bucaramanga', 'Cúcuta']))
  check(
    'Resta los pares que ya existen',
    plan.existing.length === 2 && plan.missing.length === santander.length - 2 && plan.reason === null,
    `existentes=${plan.existing.length} faltan=${plan.missing.length}`
  )
  check('IPS de Chocó: motivo excluded_department', planHospitalRoutes(context(CHOCO)).reason === 'excluded_department')
  check('IPS inactiva: motivo inactive y sin pares', (() => {
    const inactive = planHospitalRoutes(context({ ...UPRES_SANTANDER, active: false }))
    return inactive.reason === 'inactive' && inactive.missing.length === 0
  })())
  check('IPS sin coordenadas: motivo no_coordinates', planHospitalRoutes(context(SIN_COORDENADAS)).reason === 'no_coordinates')
  check(
    'IPS de Nariño sin zonas que puedan competir: motivo no_candidates',
    planHospitalRoutes(context(hospital({ id: 'narino', department_id: '52', municipality_id: '52356' }), [], [zoneByName.get('Barranquilla')!])).reason === 'no_candidates'
  )
  const pairs = await missingPairsForHospital(HOCEN.id, async () => context(HOCEN, ['Chapinero']))
  check(
    'missingPairsForHospital(HOCEN) con Chapinero ya calculado: Engativá, Kennedy y San Cristóbal',
    sameSet(pairs.map(pair => nameOf(pair.kam_id)), ['Engativá', 'Kennedy', 'San Cristóbal']) &&
      pairs.every(pair => pair.hospital_id === HOCEN.id)
  )
  const status = await getHospitalRouteStatus(HOCEN.id, async () => context(HOCEN, ['Chapinero']))
  check('getHospitalRouteStatus(HOCEN): 4 candidatas, faltan 3', status?.candidates === 4 && status?.missing === 3)

  print('\n3. ensureHospitalDistances (distanceMatrix y guardado simulados)')
  {
    const matrix = fakeMatrix({ noRouteOrigins: [1000 + 3] }) // 1.ª llamada, 4.º origen: sin ruta
    const { deps, saved } = routesDeps(context(UPRES_SANTANDER, ['Bucaramanga']), { distanceMatrix: matrix.fn })
    const result = await ensureHospitalDistances(UPRES_SANTANDER.id, { deps })
    const missing = santander.length - 1
    check('Una sola llamada para una IPS (≤ MAX_ORIGINS zonas)', matrix.calls.length === 1, `llamadas=${matrix.calls.length}`)
    check(
      'Sentido zona→IPS: orígenes = zonas que faltan, destino = la IPS',
      matrix.calls[0]?.origins.length === missing &&
        matrix.calls[0]?.destinations.length === 1 &&
        matrix.calls[0]?.destinations[0].lat === UPRES_SANTANDER.lat &&
        matrix.calls[0]?.destinations[0].lng === UPRES_SANTANDER.lng
    )
    check(
      'No pide el par que ya existía (Bucaramanga)',
      !matrix.calls[0]?.origins.some(origin => origin.lat === zoneByName.get('Bucaramanga')!.lat)
    )
    check(
      'Cuenta calculados, sin ruta, omitidos y pendientes',
      result.calculated === missing - 1 && result.noRoute === 1 && result.skipped === 1 && result.pending === 1 && result.failed === 0,
      JSON.stringify(result)
    )
    const rows = saved[0] ?? []
    check(
      'Guarda en SEGUNDOS con source google_maps, sin el par sin ruta',
      rows.length === missing - 1 &&
        rows.every(row => row.source === 'google_maps' && Number.isInteger(row.travel_time) && row.travel_time >= 1800 && row.hospital_id === UPRES_SANTANDER.id)
    )
    check(
      'Elementos facturados y coste estimado',
      result.googleElements === missing && result.costEstimate === formatCostEstimate(missing) && formatCostEstimate(2) === '$0.01 USD'
    )
    check(
      'Deja traza del gasto en Google (como calculate-batch-secure)',
      moduleLogs.includes(`[google-distance-matrix] hospital-routes hospital=${UPRES_SANTANDER.id} llamadas=1 elementos=${missing}`)
    )
  }
  {
    const many: RouteKam[] = Array.from({ length: 30 }, (_value, index) => zone(`Zona ${index + 1}`, `68${String(index + 100).padStart(3, '0')}`, 7 + index / 100, -73))
    const matrix = fakeMatrix()
    const { deps } = routesDeps(context(UPRES_SANTANDER, [], many), { distanceMatrix: matrix.fn })
    const result = await ensureHospitalDistances(UPRES_SANTANDER.id, { deps })
    check(
      `30 zonas que faltan: 2 llamadas (${MAX_ORIGINS} + 5), ≤ 100 elementos cada una`,
      matrix.calls.length === 2 &&
        matrix.calls[0].origins.length === MAX_ORIGINS &&
        matrix.calls[1].origins.length === 5 &&
        matrix.calls.every(call => call.origins.length * call.destinations.length <= 100) &&
        result.calculated === 30
    )
  }
  {
    const matrix = fakeMatrix()
    const { deps, saved } = routesDeps(context(HOCEN), { distanceMatrix: matrix.fn, routesDisabled: () => true })
    const result = await ensureHospitalDistances(HOCEN.id, { deps })
    check(
      'GOOGLE_ROUTES_DISABLED: no llama a Google, disabled = true y quedan pendientes',
      matrix.calls.length === 0 && saved.length === 0 && result.disabled && result.pending === 4 && result.googleElements === 0
    )
  }
  {
    const { deps, saved } = routesDeps(context(HOCEN), {
      distanceMatrix: async origins => ({ ok: false, status: 'OVER_QUERY_LIMIT', rows: [], elementsBilled: origins.length }),
    })
    const result = await ensureHospitalDistances(HOCEN.id, { deps })
    check(
      'Google responde con error: nada guardado, fallidos y mensaje',
      saved.length === 0 && result.calculated === 0 && result.failed === 4 && result.pending === 4 && /OVER_QUERY_LIMIT/.test(result.error ?? '')
    )
  }
  {
    const { deps } = routesDeps(context(HOCEN), {
      distanceMatrix: async () => {
        throw new Error('fallo de red simulado')
      },
    })
    const result = await ensureHospitalDistances(HOCEN.id, { deps })
    check(
      'distanceMatrix lanza: no se propaga, sin elementos facturados',
      result.failed === 4 && result.googleElements === 0 && result.error !== null
    )
  }
  {
    const { deps } = routesDeps(context(HOCEN), {
      distanceMatrix: () => new Promise<MatrixResult>(() => undefined), // nunca responde
      callTimeoutMs: 20,
    })
    const result = await ensureHospitalDistances(HOCEN.id, { deps })
    check(
      'Tiempo agotado: corta a los callTimeoutMs y cuenta el peor caso facturado',
      result.failed === 4 && result.googleElements === 4 && result.pending === 4
    )
  }
  {
    const { deps } = routesDeps(context(HOCEN), {
      distanceMatrix: fakeMatrix().fn,
      saveDistances: async () => {
        throw new Error('guardado simulado fallido')
      },
    })
    const result = await ensureHospitalDistances(HOCEN.id, { deps })
    check(
      'Falla el guardado: calculated = 0, pendientes y mensaje',
      result.calculated === 0 && result.pending === 4 && result.failed === 4 && result.error !== null
    )
  }
  {
    const matrix = fakeMatrix()
    const { deps } = routesDeps(context(HOCEN, ['Chapinero', 'Engativá', 'Kennedy', 'San Cristóbal']), { distanceMatrix: matrix.fn })
    const result = await ensureHospitalDistances(HOCEN.id, { deps })
    check('Sin pares que falten: no llama a Google', matrix.calls.length === 0 && result.pending === 0 && result.skipped === 4)
  }
  for (const [label, h] of [
    ['IPS inactiva', { ...UPRES_SANTANDER, active: false }],
    ['IPS de Chocó', CHOCO],
  ] as const) {
    const matrix = fakeMatrix()
    const { deps } = routesDeps(context(h), { distanceMatrix: matrix.fn })
    const result = await ensureHospitalDistances(h.id, { deps })
    check(`${label}: no llama a Google`, matrix.calls.length === 0 && result.missing === 0)
  }
  {
    const { deps } = routesDeps(null, { distanceMatrix: fakeMatrix().fn })
    const result = await ensureHospitalDistances('no-existe', { deps })
    check('IPS inexistente: error sin lanzar', result.error === 'IPS no encontrada')
  }

  print('\n4. refreshHospitalZone (recálculo y municipios simulados)')
  {
    const { deps, calls } = refreshDeps()
    const result = await refreshHospitalZone(HOCEN.id, { deps })
    check(
      'Google deshabilitado y sin zona: primer aviso = "Sin tiempos de viaje..."',
      result.warnings[0] === NO_TRAVEL_TIMES_WARNING && result.assignment === null,
      JSON.stringify(result.warnings)
    )
    check('Recalcula asignaciones y municipios', calls.recalculate === 1 && calls.municipalities === 1 && result.municipalitiesRecomputed)
  }
  {
    const { deps } = refreshDeps({
      ensure: async () => ensureResult({ disabled: false, missing: 4, calculated: 4, pending: 0, googleElements: 4 }),
      assignment: { kam_id: 'kam-1100108', travel_time: 1500, assignment_type: 'competitive' },
    })
    const result = await refreshHospitalZone(HOCEN.id, { deps })
    check(
      'Tiempos calculados y asignada: sin avisos y con nombre de zona',
      result.warnings.length === 0 && result.assignment?.kam_name === 'Kennedy' && result.assignment.travel_time === 1500,
      JSON.stringify(result)
    )
  }
  {
    const { deps } = refreshDeps({
      assignment: { kam_id: 'kam-1100108', travel_time: 0, assignment_type: 'base_territory' },
    })
    const result = await refreshHospitalZone(HOCEN.id, { deps })
    check(
      'Territorio base con tiempos pendientes: tiene zona, sin "Sin tiempos de viaje"',
      result.assignment !== null && !result.warnings.includes(NO_TRAVEL_TIMES_WARNING) && !result.warnings.some(w => w.includes('puede cambiar'))
    )
  }
  {
    const { deps } = refreshDeps({
      ensure: async () => ensureResult({ disabled: false, pending: 2, calculated: 2, error: null }),
      assignment: { kam_id: 'kam-1100108', travel_time: 1500, assignment_type: 'competitive' },
    })
    const result = await refreshHospitalZone(HOCEN.id, { deps })
    check('Competitiva con tiempos pendientes: avisa que la zona puede cambiar', result.warnings.some(w => w.startsWith('Faltan 2 tiempos')))
  }
  {
    const { deps, calls } = refreshDeps({
      recalculate: async () => {
        throw new Error('recálculo simulado fallido')
      },
    })
    const result = await refreshHospitalZone(HOCEN.id, { deps })
    check(
      'Falla el recálculo: aviso y no toca municipios',
      !result.recalculated && calls.municipalities === 0 && result.warnings.some(w => /no se pudo recalcular/i.test(w))
    )
  }
  {
    const { deps } = refreshDeps({
      recomputeMunicipalities: async () => {
        throw new MunicipalityTableMissingError('municipality_zone')
      },
    })
    const result = await refreshHospitalZone(HOCEN.id, { deps })
    check(
      'Sin migración de municipios (Fase 2b): no es un fallo, sin aviso de municipios',
      !result.municipalitiesRecomputed && !result.warnings.some(w => w.includes('municipios'))
    )
  }
  {
    const { deps } = refreshDeps({
      recomputeMunicipalities: async () => {
        throw new Error('municipios simulado fallido')
      },
    })
    const result = await refreshHospitalZone(HOCEN.id, { deps })
    check('Falla municipality_zone: aviso', result.warnings.some(w => w.includes('mapa de municipios')))
  }
  {
    let clock = 0
    const { deps, calls } = refreshDeps({
      ensure: async () => {
        clock = 31_000 // Google tardó más que el plazo del recálculo
        return ensureResult()
      },
      now: () => clock,
    })
    const result = await refreshHospitalZone(HOCEN.id, { deps })
    check(
      'Pasado el plazo (30 s) no recalcula y avisa',
      calls.recalculate === 0 && !result.recalculated && result.warnings.some(w => w.includes('No dio tiempo'))
    )
  }
  {
    const { deps, calls } = refreshDeps({ ensure: async () => ensureResult({ reason: 'inactive', missing: 0, pending: 0 }) })
    const result = await refreshHospitalZone(HOCEN.id, { deps })
    check('IPS inactiva: no recalcula nada', calls.recalculate === 0 && result.warnings.length === 0)
  }
  {
    const { deps } = refreshDeps({
      ensure: async () => {
        throw new Error('error inesperado')
      },
    })
    const result = await refreshHospitalZone(HOCEN.id, { deps })
    check('ensure lanza: sigue con el recálculo y avisa si queda sin zona', result.recalculated && result.warnings[0] === NO_TRAVEL_TIMES_WARNING)
  }
  check(
    'IPS de departamento excluido: aviso propio, sin "Sin tiempos de viaje"',
    (() => {
      const warnings = buildZoneWarnings({ routes: ensureResult({ reason: 'excluded_department', missing: 0, pending: 0 }), recalculated: true, assignment: null })
      return warnings.length === 1 && warnings[0].includes('departamento excluido')
    })()
  )

  print('\n5. Validación zod de hospitales')
  const base = {
    name: 'IPS de prueba',
    code: 'TEST-1',
    department_id: '11',
    municipality_id: '11001',
    lat: 4.65,
    lng: -74.1,
  }
  const issuesOf = (result: ReturnType<typeof createHospitalSchema.safeParse>) =>
    result.success ? [] : result.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`)
  {
    const result = createHospitalSchema.safeParse(base)
    check(
      'Bogotá sin localidad: "Las IPS de Bogotá necesitan localidad"',
      !result.success && result.error.issues.some(issue => issue.path[0] === 'locality_id' && issue.message === BOGOTA_LOCALITY_REQUIRED),
      issuesOf(result).join(' | ')
    )
  }
  check('Bogotá con localidad de 8 dígitos (11001013): rechazada', !createHospitalSchema.safeParse({ ...base, locality_id: '11001013' }).success)
  check('Bogotá con localidad 1100113: aceptada', createHospitalSchema.safeParse({ ...base, locality_id: '1100113' }).success)
  check(
    'Localidad fuera de Bogotá: rechazada',
    !createHospitalSchema.safeParse({ ...base, department_id: '68', municipality_id: '68276', locality_id: '1100113', lat: 7.07, lng: -73.1 }).success
  )
  check(
    'Municipio que no pertenece al departamento: rechazado',
    !createHospitalSchema.safeParse({ ...base, department_id: '05', municipality_id: '68276', locality_id: null, lat: 7.07, lng: -73.1 }).success
  )
  {
    const result = createHospitalSchema.safeParse({ ...base, locality_id: '1100113', lat: undefined })
    check('Latitud ausente: "La latitud es obligatoria"', issuesOf(result).some(issue => issue === 'lat: La latitud es obligatoria'), issuesOf(result).join(' | '))
  }
  {
    const result = createHospitalSchema.safeParse({ ...base, locality_id: '1100113', lat: 40.4, lng: -3.7 })
    check(
      'Coordenadas fuera de Colombia (Madrid): rechazadas',
      issuesOf(result).some(issue => issue.startsWith('lat: La latitud debe estar dentro de Colombia')) &&
        issuesOf(result).some(issue => issue.startsWith('lng: La longitud debe estar dentro de Colombia')),
      issuesOf(result).join(' | ')
    )
  }
  {
    const result = createHospitalSchema.safeParse({ ...base, locality_id: '1100113', lat: '4,65', lng: '-74.1' })
    check('Coordenadas como texto con coma decimal: aceptadas', result.success && result.data.lat === 4.65 && result.data.lng === -74.1)
  }
  check(
    'San Andrés (12,58; -81,70) y Leticia (-4,21; -69,94): dentro de Colombia',
    createHospitalSchema.safeParse({ ...base, department_id: '88', municipality_id: '88001', locality_id: null, lat: 12.58, lng: -81.7 }).success &&
      createHospitalSchema.safeParse({ ...base, department_id: '91', municipality_id: '91001', locality_id: null, lat: -4.21, lng: -69.94 }).success
  )
  check('PUT: latitud fuera de Colombia rechazada', !updateHospitalSchema.safeParse({ lat: 50 }).success)
  check('PUT: sin coordenadas sigue siendo válido', updateHospitalSchema.safeParse({ name: 'Otro nombre' }).success)

  // Fase 5 (spec 2026-10-12): "Compra pública (SECOP)" a mano. null = según REPS; true/false manda sobre el REPS.
  {
    const compraPublica = (body: Record<string, unknown>) => {
      const result = updateHospitalSchema.safeParse(body)
      return result.success ? result.data.compra_publica : 'rechazado'
    }
    check(
      'PUT compra_publica: true, false y null se aceptan y llegan tal cual al update',
      compraPublica({ compra_publica: true }) === true && compraPublica({ compra_publica: false }) === false && compraPublica({ compra_publica: null }) === null
    )
    check('PUT sin compra_publica: no toca la columna (queda undefined, no null)', compraPublica({ name: 'Otro nombre' }) === undefined)
    check(
      'PUT compra_publica: "true", 1, "si" y "" → 400 (solo booleano o null)',
      ['true', 1, 'si', ''].every(valor => compraPublica({ compra_publica: valor }) === 'rechazado')
    )
    check(
      'PATCH compra_publica: true/false/null se aceptan; "si" → 400',
      patchHospitalSchema.safeParse({ compra_publica: true }).success &&
        patchHospitalSchema.safeParse({ compra_publica: false }).success &&
        patchHospitalSchema.safeParse({ compra_publica: null }).success &&
        !patchHospitalSchema.safeParse({ compra_publica: 'si' }).success
    )
  }

  print('\n6. Cambios que obligan a recalcular la zona')
  check('touchesZoneFields({ name }) = false', !touchesZoneFields({ name: 'x' }))
  check('touchesZoneFields({ lat }) = true', touchesZoneFields({ lat: 4.6 }))
  const stored = { lat: 7.07480292, lng: -73.10944495, department_id: '68', municipality_id: '68276', locality_id: null, active: true }
  check('Mismas coordenadas (ruido de coma flotante): sin cambio', !zoneFieldsChanged(stored, { ...stored, lat: 7.074802920000001 }))
  check('Coordenadas movidas 0,001°: cambio', zoneFieldsChanged(stored, { ...stored, lat: 7.07580292 }))
  check('locality_id null frente a vacío: sin cambio', !zoneFieldsChanged(stored, { ...stored, locality_id: '' }))
  check('Cambio de municipio: cambio', zoneFieldsChanged(stored, { ...stored, municipality_id: '68001' }))
  check('Cambio de estado: cambio', zoneFieldsChanged(stored, { ...stored, active: false }))

  print('\n7. Cola de pendientes (classifyPendingHospitals, sin red)')
  check(
    'Fechas: timestamp sin zona se lee como UTC; "+00" y "+00:00" también',
    timestampMs('2025-08-07T01:06:11.362298') === Date.UTC(2025, 7, 7, 1, 6, 11, 362) &&
      timestampMs('2026-10-11 13:05:52.434876+00') === Date.UTC(2026, 9, 11, 13, 5, 52, 434) &&
      timestampMs('2026-10-11T13:05:52.434876+00:00') === Date.UTC(2026, 9, 11, 13, 5, 52, 434) &&
      timestampMs(null) === null
  )
  const NEW_IPS = pendingHospital({ id: 'p-01-nueva', name: 'A Nueva (sin rutas)', created_at: AFTER_RECALC })
  const OK_IPS = pendingHospital({ id: 'p-02-ok', name: 'B Asignada completa' })
  const MISSING_IPS = pendingHospital({ id: 'p-03-faltan', name: 'C Asignada con 2 faltantes' })
  const MOVED_IPS = pendingHospital({ id: 'p-04-movida', name: 'D Movida' })
  const LOCALITY_IPS = pendingHospital({ id: 'p-05-territorio', name: 'E Cambio sin coordenadas' })
  const FAR_IPS = pendingHospital({ id: 'p-06-lejana', name: 'F Fuera de alcance', department_id: '81', municipality_id: '81001', lat: 7.0847, lng: -70.7591 })
  const REACTIVATED_IPS = pendingHospital({ id: 'p-07-reactivada', name: 'G Reactivada' })
  const NEW_ROUTES_IPS = pendingHospital({ id: 'p-08-rutas-nuevas', name: 'H Con rutas nuevas' })
  const BEDS_IPS = pendingHospital({ id: 'p-09-camas', name: 'I Solo cambió camas' })
  const CHOCO_PENDING = pendingHospital({ ...CHOCO, id: 'p-10-choco', name: 'J Chocó' })
  const NO_COORDS_PENDING = pendingHospital({ id: 'p-11-sin-coords', name: 'K Sin coordenadas', lat: null, lng: null })
  const INACTIVE_PENDING = pendingHospital({ id: 'p-12-inactiva', name: 'L Inactiva', active: false, created_at: AFTER_RECALC })
  const assignedAt = LAST_RECALC
  const classificationSnapshot = snapshotOf({
    hospitals: [NEW_IPS, OK_IPS, MISSING_IPS, MOVED_IPS, LOCALITY_IPS, FAR_IPS, REACTIVATED_IPS, NEW_ROUTES_IPS, BEDS_IPS, CHOCO_PENDING, NO_COORDS_PENDING, INACTIVE_PENDING],
    distances: [
      ...pairsFor(OK_IPS, BEFORE_RECALC),
      ...pairsFor(MISSING_IPS, BEFORE_RECALC, ['Cúcuta', 'Medellín']),
      ...pairsFor(MOVED_IPS, BEFORE_RECALC),
      ...pairsFor(LOCALITY_IPS, BEFORE_RECALC),
      ...pairsFor(FAR_IPS, BEFORE_RECALC),
      ...pairsFor(REACTIVATED_IPS, BEFORE_RECALC),
      ...pairsFor(NEW_ROUTES_IPS, BEFORE_RECALC, ['Cúcuta']),
      ...pairsFor(NEW_ROUTES_IPS, AFTER_RECALC_NO_TZ).filter(row => row.kam_id === zoneByName.get('Cúcuta')!.id),
      ...pairsFor(BEDS_IPS, BEFORE_RECALC),
    ],
    assignments: [OK_IPS, MISSING_IPS, MOVED_IPS, LOCALITY_IPS, NEW_ROUTES_IPS, BEDS_IPS].map(h => ({ hospital_id: h.id, assigned_at: assignedAt })),
    history: [
      { hospital_id: MOVED_IPS.id, action: 'edited', created_at: AFTER_RECALC, changes: { zone_fields: { before: {}, after: {} }, coordinates_changed: true } },
      { hospital_id: LOCALITY_IPS.id, action: 'edited', created_at: AFTER_RECALC, changes: { zone_fields: { before: {}, after: {} }, coordinates_changed: false } },
      { hospital_id: REACTIVATED_IPS.id, action: 'activated', created_at: AFTER_RECALC, changes: null },
      { hospital_id: BEDS_IPS.id, action: 'edited', created_at: AFTER_RECALC, changes: { otra_cosa: true } },
      { hospital_id: OK_IPS.id, action: 'activated', created_at: LONG_AGO, changes: null },
    ],
  })
  const classification = classifyPendingHospitals(classificationSnapshot)
  const byId = new Map(classification.items.map(item => [item.id, item]))
  const santanderCandidates = candidateNames(UPRES_SANTANDER).length
  print(`        Pendientes: ${classification.items.map(item => `${item.name} [${item.reasons.join(', ')}]`).join(' | ')}`)
  check(
    '(a)+(b) IPS nueva sin asignación ni rutas: unassigned + missing_routes, faltan todas sus candidatas',
    sameSet(byId.get(NEW_IPS.id)?.reasons ?? [], ['unassigned', 'missing_routes']) &&
      byId.get(NEW_IPS.id)?.missingPairs === santanderCandidates &&
      byId.get(NEW_IPS.id)?.reason.includes(`Faltan ${santanderCandidates} tiempos de viaje`) === true,
    JSON.stringify(byId.get(NEW_IPS.id))
  )
  check('IPS asignada con todos sus tiempos: no está pendiente', !byId.has(OK_IPS.id))
  check(
    '(b) asignada con 2 pares faltantes (Cúcuta, Medellín): solo missing_routes, 2 pares',
    sameSet(byId.get(MISSING_IPS.id)?.reasons ?? [], ['missing_routes']) && byId.get(MISSING_IPS.id)?.missingPairs === 2
  )
  check(
    '(c) movida después de su asignación: location_changed + tiempos desactualizados (todos)',
    sameSet(byId.get(MOVED_IPS.id)?.reasons ?? [], ['missing_routes', 'location_changed']) &&
      byId.get(MOVED_IPS.id)?.stalePairs === santanderCandidates &&
      byId.get(MOVED_IPS.id)?.missingPairs === santanderCandidates &&
      /desactualizados por cambio de coordenadas/.test(byId.get(MOVED_IPS.id)?.reason ?? ''),
    JSON.stringify(byId.get(MOVED_IPS.id))
  )
  check(
    '(c) cambio de territorio sin mover coordenadas: location_changed sin pares que pedir',
    sameSet(byId.get(LOCALITY_IPS.id)?.reasons ?? [], ['location_changed']) && byId.get(LOCALITY_IPS.id)?.missingPairs === 0
  )
  check('Sin zona, con todos sus tiempos y ya recalculada (fuera de alcance): no pendiente', !byId.has(FAR_IPS.id))
  check('(a) reactivada después del último recálculo: unassigned', sameSet(byId.get(REACTIVATED_IPS.id)?.reasons ?? [], ['unassigned']))
  check('Tiempo calculado después del último recálculo: new_routes', sameSet(byId.get(NEW_ROUTES_IPS.id)?.reasons ?? [], ['new_routes']))
  check(
    'Editar otros campos (camas) no la deja pendiente (no se usa hospitals.updated_at)',
    !byId.has(BEDS_IPS.id)
  )
  check('Chocó (excluido), sin coordenadas e inactiva: fuera de la cola', !byId.has(CHOCO_PENDING.id) && !byId.has(NO_COORDS_PENDING.id) && !byId.has(INACTIVE_PENDING.id))
  check(
    'Contadores: withoutZone = 2 (fuera de alcance + Chocó), withoutCoordinates = 1',
    classification.withoutZone === 2 && classification.withoutCoordinates === 1,
    `withoutZone=${classification.withoutZone} withoutCoordinates=${classification.withoutCoordinates}`
  )
  check(
    'pairsMissing = suma de pares por pedir',
    classification.pairsMissing === santanderCandidates + 2 + santanderCandidates
  )
  {
    const summary = pendingSummaryResponse(classification, 2)
    check(
      'Resumen: count total, coste = pares × 0,005 USD, máx. N items y truncated',
      summary.count === classification.items.length &&
        summary.items.length === 2 &&
        summary.truncated &&
        summary.costEstimateUsd === Math.round(classification.pairsMissing * 0.005 * 100) / 100 &&
        summary.items[0].name === 'A Nueva (sin rutas)'
    )
  }
  check(
    'Cola de la fase A: solo IPS con pares por pedir, ordenadas por id',
    routesQueue(classification).map(item => item.id).join(',') === [NEW_IPS.id, MISSING_IPS.id, MOVED_IPS.id].join(',')
  )
  check(
    'Sin ninguna asignación (lastRecalculationAt = null): toda IPS sin zona con candidatas es (a)',
    classifyPendingHospitals(snapshotOf({ hospitals: [FAR_IPS], distances: pairsFor(FAR_IPS, BEFORE_RECALC), lastRecalculationAt: null })).items[0]?.reasons.join() === 'unassigned'
  )
  {
    const status = pendingStatusFromSnapshot(classificationSnapshot, MOVED_IPS.id)
    check(
      'Estado para la ficha: pendiente, motivo legible y pares desactualizados',
      status?.pending === true && status.stale === santanderCandidates && status.missing === santanderCandidates && status.pendingReason !== null
    )
  }
  {
    const before = { lat: 7.07, lng: -73.1, department_id: '68', municipality_id: '68276', locality_id: null, active: true }
    const row = locationChangeHistoryRow({ hospitalId: 'h', userId: 'u', before, after: { ...before, lat: 7.2 } })
    check(
      'Fila de historial al mover coordenadas: action edited, zone_fields y coordinates_changed',
      row?.action === 'edited' && row.changes.coordinates_changed === true && row.changes.zone_fields.before?.lat === 7.07
    )
    check('Sin cambio de ubicación: no hay fila de historial', locationChangeHistoryRow({ hospitalId: 'h', userId: 'u', before, after: { ...before } }) === null)
  }

  print('\n8. Rutas de una IPS pendiente (ensurePendingHospitalDistances)')
  {
    const matrix = fakeMatrix()
    const saves: Array<{ rows: number; overwrite: boolean }> = []
    const result = await ensurePendingHospitalDistances(MOVED_IPS.id, classificationSnapshot, {
      deps: { distanceMatrix: matrix.fn, routesDisabled: () => false, now: () => Date.UTC(2026, 9, 11, 16), callTimeoutMs: 1000, budgetMs: 25_000 },
      save: async (rows, overwrite) => {
        saves.push({ rows: rows.length, overwrite })
      },
    })
    check(
      'IPS movida: vuelve a pedir TODOS sus tiempos desactualizados y guarda sobrescribiendo',
      matrix.calls.length === 1 && matrix.calls[0].origins.length === santanderCandidates && saves[0]?.overwrite === true && result.calculated === santanderCandidates,
      JSON.stringify(saves)
    )
  }
  {
    const matrix = fakeMatrix()
    const saves: Array<{ rows: number; overwrite: boolean }> = []
    await ensurePendingHospitalDistances(MISSING_IPS.id, classificationSnapshot, {
      deps: { distanceMatrix: matrix.fn, routesDisabled: () => false, now: () => Date.UTC(2026, 9, 11, 16), callTimeoutMs: 1000, budgetMs: 25_000 },
      save: async (rows, overwrite) => {
        saves.push({ rows: rows.length, overwrite })
      },
    })
    check(
      'IPS con 2 faltantes: pide solo esos 2 y guarda SIN sobrescribir',
      matrix.calls[0]?.origins.length === 2 && saves[0]?.rows === 2 && saves[0]?.overwrite === false
    )
  }

  print('\n9. Acción masiva process-pending (fase A por lotes, fase B al final)')
  // 5 IPS nuevas de Bogotá (4 zonas candidatas cada una = 20 pares) + 1 sin ruta por carretera
  const bogotaIps = (index: number) =>
    pendingHospital({
      id: `b-${String(index).padStart(2, '0')}`,
      name: `IPS Bogotá ${index}`,
      department_id: '11',
      municipality_id: '11001',
      locality_id: '1100113',
      lat: 4.64 + index / 1000,
      lng: -74.09,
      created_at: AFTER_RECALC,
    })
  function processHarness(options: { noRouteIds?: string[]; maxPairs?: number; budgetMs?: number; disabled?: boolean; tickMs?: number } = {}) {
    const snapshot = snapshotOf({ hospitals: [1, 2, 3, 4, 5].map(bogotaIps) })
    const ensured: string[] = []
    const calls = { loadSnapshot: 0, recalculate: 0, municipalities: 0 }
    let clock = 0
    const routes: PendingRoutesDeps = {
      loadSnapshot: async () => {
        calls.loadSnapshot++
        return snapshot
      },
      ensure: async (hospitalId, current) => {
        ensured.push(hospitalId)
        clock += options.tickMs ?? 0
        const built = classifyPendingHospitals(current).items.find(item => item.id === hospitalId)!
        if (options.noRouteIds?.includes(hospitalId)) {
          return ensureResult({ disabled: false, candidates: 4, missing: 4, pending: 4, noRoute: 4, googleCalls: 1, googleElements: 4 })
        }
        // Simula el guardado: la siguiente petición ya ve estos pares
        for (const kam of ZONES.filter(zone => isBogotaKam(zone))) {
          snapshot.distances.push({ hospital_id: hospitalId, kam_id: kam.id, calculated_at: '2026-10-11T16:00:00', updated_at: null })
        }
        return ensureResult({ disabled: false, candidates: 4, missing: built.missingPairs, calculated: built.missingPairs, pending: 0, googleCalls: 1, googleElements: built.missingPairs })
      },
      routesDisabled: () => options.disabled === true,
      now: () => clock,
      budgetMs: options.budgetMs ?? 35_000,
      maxPairs: options.maxPairs ?? 200,
    }
    const assign: PendingAssignDeps = {
      recalculate: async () => {
        calls.recalculate++
        return { totalAssignments: 772, assignmentFor: () => undefined }
      },
      recomputeMunicipalities: async () => {
        calls.municipalities++
        return { counts: { ips: 136, reach: 975 } }
      },
    }
    return { snapshot, ensured, calls, deps: { routes, assign } }
  }
  {
    const harness = processHarness({ maxPairs: 10 })
    const steps: Array<Awaited<ReturnType<typeof processPendingStep>>> = []
    let cursor: string | null = null
    for (let index = 0; index < 10; index++) {
      const step = await processPendingStep({ cursor }, harness.deps)
      steps.push(step)
      if (step.phase !== 'routes') break
      cursor = step.nextCursor
    }
    const routeSteps = steps.filter((step): step is Extract<typeof step, { phase: 'routes' }> => step.phase === 'routes')
    print(`        Pasos: ${steps.map(step => (step.phase === 'routes' ? `rutas(${step.done} IPS, ${step.pairsDone} pares, hasMore=${step.hasMore})` : 'asignación')).join(' → ')}`)
    check(
      'Fase A en lotes de ≤ maxPairs (10): 2 + 2 + 1 IPS (8 + 8 + 4 pares)',
      routeSteps.map(step => step.done).join(',') === '2,2,1' && routeSteps.every(step => step.pairsDone <= 10),
      routeSteps.map(step => `${step.done}/${step.pairsDone}`).join(' ')
    )
    check(
      'Cada IPS se procesa una vez y en orden de id; hasMore solo en los lotes intermedios',
      harness.ensured.join(',') === 'b-01,b-02,b-03,b-04,b-05' && routeSteps.map(step => step.hasMore).join(',') === 'true,true,false'
    )
    check(
      'Fase B UNA vez y solo cuando no quedan IPS con pares por calcular',
      steps.length === 4 && steps[3].phase === 'assigned' && harness.calls.recalculate === 1 && harness.calls.municipalities === 1 &&
        routeSteps.length === 3 && harness.calls.recalculate === 1
    )
    const last = steps[3]
    check(
      'Fase B: asignaciones, municipios y sin pares pendientes',
      last.phase === 'assigned' && last.assignments === 772 && last.municipalities.recomputed && last.pairsMissing === 0 && last.routesDisabled === false
    )
    check(
      'Costo acumulado de la fase A = pares × 0,005',
      routeSteps.reduce((sum, step) => sum + step.costUsd, 0).toFixed(2) === (20 * 0.005).toFixed(2)
    )
  }
  {
    const harness = processHarness({ noRouteIds: ['b-02'] })
    const first = await processPendingStep({ cursor: null }, harness.deps)
    const second = first.phase === 'routes' ? await processPendingStep({ cursor: first.nextCursor }, harness.deps) : first
    check(
      'Pares sin ruta por carretera no bloquean: la pasada sigue con el cursor y la fase B informa los que faltan',
      first.phase === 'routes' && first.done === 5 && first.noRoute === 4 &&
        second.phase === 'assigned' && second.pairsMissing === 4 && harness.ensured.filter(id => id === 'b-02').length === 1,
      JSON.stringify(second)
    )
    const third = await processPendingStep({ cursor: null }, harness.deps)
    check(
      'Una nueva pasada (cursor vacío) vuelve a intentar solo la IPS sin ruta',
      third.phase === 'routes' && third.done === 1 && harness.ensured.slice(-1)[0] === 'b-02'
    )
  }
  {
    const harness = processHarness({ tickMs: 20_000, budgetMs: 35_000 })
    const step = await runPendingRoutesStep({ cursor: null }, harness.deps.routes)
    check(
      'Presupuesto de tiempo: con 20 s por IPS y 35 s de presupuesto, 2 IPS por petición',
      step.done === 2 && step.hasMore && step.remaining === 3
    )
  }
  {
    const harness = processHarness({ disabled: true })
    const auto = await processPendingStep({ cursor: null }, harness.deps)
    check(
      'GOOGLE_ROUTES_DISABLED: salta la fase A (sin Google) y hace la fase B con routesDisabled',
      auto.phase === 'assigned' && auto.routesDisabled && auto.pairsMissing === 20 && harness.ensured.length === 0 && harness.calls.recalculate === 1 &&
        auto.warnings.some(warning => warning.includes('GOOGLE_ROUTES_DISABLED'))
    )
    const routesOnly = await processPendingStep({ cursor: null, phase: 'routes' }, harness.deps)
    check(
      "phase 'routes' con Google deshabilitado: disabled = true, sin lotes y sin fase B",
      routesOnly.phase === 'routes' && routesOnly.disabled && routesOnly.done === 0 && !routesOnly.hasMore && harness.calls.recalculate === 1
    )
  }
  {
    const harness = processHarness()
    const assignOnly = await processPendingStep({ cursor: null, phase: 'assign' }, harness.deps)
    check(
      "phase 'assign': solo fase B (no lee la cola ni llama a Google)",
      assignOnly.phase === 'assigned' && harness.calls.loadSnapshot === 0 && harness.ensured.length === 0 && harness.calls.recalculate === 1
    )
  }
  {
    const harness = processHarness()
    harness.deps.assign.recomputeMunicipalities = async () => {
      throw new MunicipalityTableMissingError('municipality_zone')
    }
    const withoutTable = await processPendingStep({ cursor: null, phase: 'assign' }, harness.deps)
    harness.deps.assign.recomputeMunicipalities = async () => {
      throw new Error('municipios simulado fallido')
    }
    const failing = await processPendingStep({ cursor: null, phase: 'assign' }, harness.deps)
    check(
      'Fase B: sin tabla de municipios no avisa; otro fallo de municipios avisa',
      withoutTable.phase === 'assigned' && !withoutTable.municipalities.recomputed && withoutTable.warnings.length === 0 &&
        failing.phase === 'assigned' && failing.warnings.some(warning => warning.includes('mapa de municipios'))
    )
    harness.deps.assign.recalculate = async () => {
      throw new Error('recálculo simulado fallido')
    }
    let rejected = false
    try {
      await processPendingStep({ cursor: null, phase: 'assign' }, harness.deps)
    } catch {
      rejected = true
    }
    check('Fase B: si el recálculo falla, lanza (la ruta responde con un error JSON claro)', rejected)
  }

  print('\n10. Rutas reales contra un Supabase falso (crear, editar y activar no recalculan)')
  process.env.NEXT_PUBLIC_SUPABASE_URL = FAKE_SUPABASE_URL
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba'
  process.env.SESSION_SECRET = 'secreto-de-prueba-ips-routes-check-0123456789abcdefghijklmnopqrstuvwxyz'
  const HOSPITAL_ID = '33333333-3333-4333-8333-333333333333'
  const INACTIVE_ID = '44444444-4444-4444-8444-444444444444'
  const fakeTables = () => ({
    users: fakeUsers(),
    hospitals: [
      { id: HOSPITAL_ID, name: 'IPS existente', code: 'EX-1', department_id: '68', municipality_id: '68276', locality_id: null, lat: 7.07, lng: -73.1, active: true, beds: 10, created_at: LONG_AGO },
      { id: INACTIVE_ID, name: 'IPS inactiva', code: 'EX-2', department_id: '68', municipality_id: '68276', locality_id: null, lat: 7.08, lng: -73.11, active: false, beds: 5, created_at: LONG_AGO },
    ] as Array<Record<string, unknown>>,
  })
  const noRecalculation = (fake: ReturnType<typeof fakeSupabase>) =>
    fake.external.length === 0 && !fake.touched().some(table => RECALCULATION_TABLES.includes(table))
  try {
    {
      const fake = fakeSupabase(fakeTables())
      fetchHandler = fake.handler
      const response = await createHospitalRoute(
        apiRequest('/api/hospitals', {
          method: 'POST',
          body: { name: 'IPS nueva de prueba', code: 'NUEVA-1', department_id: '68', municipality_id: '68276', locality_id: null, lat: 7.07, lng: -73.1, active: true },
        })
      )
      const body = await response.json()
      check(
        'Crear IPS activa: 200, pending = true y el aviso de pendientes',
        response.status === 200 && body.pending === true && body.warnings?.[0] === PENDING_ASSIGNMENT_WARNING && body.zone === undefined,
        `${response.status} ${JSON.stringify(body)}`
      )
      check(
        'Crear IPS: no llama a Google ni al recálculo (solo users y el INSERT en hospitals)',
        noRecalculation(fake) && sameSet(fake.touched(), ['users', 'hospitals']) && fake.writes().length === 1 && fake.writes()[0].table === 'hospitals',
        `tablas=${fake.touched().join(',')} externos=${fake.external.join(',')}`
      )
    }
    {
      const fake = fakeSupabase(fakeTables())
      fetchHandler = fake.handler
      const response = await createHospitalRoute(
        apiRequest('/api/hospitals', {
          method: 'POST',
          body: { name: 'IPS inactiva nueva', code: 'NUEVA-2', department_id: '68', municipality_id: '68276', locality_id: null, lat: 7.07, lng: -73.1, active: false },
        })
      )
      const body = await response.json()
      check('Crear IPS inactiva: pending = false, sin avisos', response.status === 200 && body.pending === false && body.warnings.length === 0 && noRecalculation(fake))
    }
    {
      const fake = fakeSupabase(fakeTables())
      fetchHandler = fake.handler
      const response = await updateHospitalRoute(
        apiRequest(`/api/hospitals/${HOSPITAL_ID}`, { method: 'PUT', body: { name: 'IPS existente', lat: 7.2, lng: -73.1 } }),
        { params: { id: HOSPITAL_ID } }
      )
      const body = await response.json()
      const history = fake.writes().find(write => write.table === 'hospital_history')?.body as Record<string, any> | undefined
      check(
        'Editar coordenadas: pending = true, aviso y fila edited con coordinates_changed en hospital_history',
        response.status === 200 && body.pending === true && body.warnings?.[0] === PENDING_ASSIGNMENT_WARNING &&
          history?.action === 'edited' && history?.changes?.coordinates_changed === true && history?.user_id === ADMIN_ID,
        `${response.status} ${JSON.stringify(body)} ${JSON.stringify(history)}`
      )
      check('Editar coordenadas: no llama a Google ni al recálculo', noRecalculation(fake), fake.touched().join(','))
    }
    {
      const fake = fakeSupabase(fakeTables())
      fetchHandler = fake.handler
      const response = await updateHospitalRoute(
        apiRequest(`/api/hospitals/${HOSPITAL_ID}`, { method: 'PUT', body: { name: 'Otro nombre', beds: 40, lat: 7.07, lng: -73.1 } }),
        { params: { id: HOSPITAL_ID } }
      )
      const body = await response.json()
      check(
        'Editar camas y nombre (mismas coordenadas): pending = false y sin fila de historial',
        response.status === 200 && body.pending === false && body.warnings.length === 0 && !fake.touched().includes('hospital_history') && noRecalculation(fake)
      )
    }
    {
      const fake = fakeSupabase(fakeTables())
      fetchHandler = fake.handler
      const response = await activateHospitalRoute(
        apiRequest(`/api/hospitals/${INACTIVE_ID}/activate`, { method: 'POST', body: { reason: 'Reapertura' } }),
        { params: { id: INACTIVE_ID } }
      )
      const body = await response.json()
      check(
        'Activar: pending = true, aviso, historial activated y sin Google ni recálculo',
        response.status === 200 && body.pending === true && body.warnings?.[0] === PENDING_ASSIGNMENT_WARNING && body.zone === undefined &&
          fake.writes().some(write => write.table === 'hospital_history' && (write.body as { action?: string }).action === 'activated') &&
          noRecalculation(fake),
        `${response.status} ${JSON.stringify(body)} tablas=${fake.touched().join(',')}`
      )
    }
    {
      const assignedHospital = { ...fakeTables().hospitals[0] }
      const fake = fakeSupabase({
        users: fakeUsers(),
        hospitals: [
          assignedHospital,
          { id: '55555555-5555-4555-8555-555555555555', name: 'IPS recién creada', code: 'N-3', department_id: '68', municipality_id: '68276', locality_id: null, lat: 7.05, lng: -73.09, active: true, created_at: AFTER_RECALC, municipality_name: 'Floridablanca' },
        ],
        kams: ZONES.map(kam => ({ ...kam, active: true, participates_in_assignment: true })),
        department_adjacency: Object.entries(ADJACENCY).flatMap(([code, list]) => list.map(adjacent => ({ department_code: code, adjacent_department_code: adjacent }))),
        departments: EXCLUDED.map(code => ({ code, excluded: true })),
        hospital_kam_distances: pairsFor({ ...UPRES_SANTANDER, id: HOSPITAL_ID }, BEFORE_RECALC).map((row, index) => ({ id: `d-${String(index).padStart(3, '0')}`, ...row })),
        assignments: [{ id: 'a-1', hospital_id: HOSPITAL_ID, kam_id: 'kam-68001', assigned_at: LAST_RECALC }],
        hospital_history: [],
      })
      fetchHandler = fake.handler
      const response = await pendingAssignmentRoute(apiRequest('/api/hospitals/pending-assignment'))
      const body = await response.json()
      check(
        'GET pending-assignment: 1 pendiente (la recién creada), sus pares y el coste; solo lecturas',
        response.status === 200 && body.count === 1 && body.items[0]?.name === 'IPS recién creada' &&
          body.pairsMissing === santanderCandidates && body.costEstimateUsd === Math.round(santanderCandidates * 0.005 * 100) / 100 &&
          body.lastRecalculationAt === LAST_RECALC && fake.writes().length === 0 && fake.external.length === 0,
        `${response.status} ${JSON.stringify(body).slice(0, 400)}`
      )
    }
    {
      const fake = fakeSupabase({ users: fakeUsers() })
      fetchHandler = fake.handler
      const response = await processPendingRoute(apiRequest('/api/hospitals/process-pending', { method: 'POST', body: {}, userId: VIEWER_ID, password: 'hash-viewer' }))
      check('process-pending sin recalculate:complete (viewer): 403 sin tocar nada más', response.status === 403 && sameSet(fake.touched(), ['users']))
      const invalid = await processPendingRoute(apiRequest('/api/hospitals/process-pending', { method: 'POST', body: { cursor: 'no-es-uuid' } }))
      const invalidBody = await invalid.json()
      check('process-pending con cursor inválido: 400 con error JSON', invalid.status === 400 && typeof invalidBody.error === 'string' && sameSet(fake.touched(), ['users']))
    }

    print('\n6. Enlace de usuarios con Ejecutivas Comerciales (app de visita, Fase 0)')
    {
      const newUser = (email: string) => apiRequest('/api/users', { method: 'POST', body: { email, password: 'clave-de-prueba-1', full_name: 'Prueba', role: 'sales_manager' } })
      const executives = () => [
        { id: 'exe-1', full_name: 'Ana Prueba', email: 'Ana@Test.Local', status: 'active', user_id: null },
        { id: 'exe-2', full_name: 'Bea Inactiva', email: 'bea@test.local', status: 'inactive', user_id: null },
        { id: 'exe-3', full_name: 'Cata Enlazada', email: 'cata@test.local', status: 'active', user_id: 'otro-usuario' },
        { id: 'exe-4', full_name: 'Dup Uno', email: 'dup@test.local', status: 'active', user_id: null },
        { id: 'exe-5', full_name: 'Dup Dos', email: 'dup@test.local', status: 'placeholder', user_id: null },
      ]
      const tables = { users: fakeUsers(), executives: executives() } as Record<string, Array<Record<string, unknown>>>
      const fake = fakeSupabase(tables)
      fetchHandler = fake.handler

      const ok = await createUserRoute(newUser('ana@test.local'))
      const okBody = await ok.json()
      const ana = tables.executives.find(e => e.id === 'exe-1')
      check('usuario nuevo con el email de una ejecutiva sin usuario (la ejecutiva lo tiene con mayúsculas): queda enlazado',
        ok.status === 200 && okBody.linkedExecutive === 'Ana Prueba' && ana?.user_id === okBody.user?.id,
        `${ok.status} ${JSON.stringify(okBody).slice(0, 200)}`)

      const inactive = await createUserRoute(newUser('bea@test.local'))
      const inactiveBody = await inactive.json()
      check('ejecutiva inactiva: no se enlaza', inactive.status === 200 && inactiveBody.linkedExecutive === null && tables.executives.find(e => e.id === 'exe-2')?.user_id === null)

      const taken = await createUserRoute(newUser('cata@test.local'))
      const takenBody = await taken.json()
      check('ejecutiva ya enlazada con otro usuario: no se cambia', taken.status === 200 && takenBody.linkedExecutive === null && tables.executives.find(e => e.id === 'exe-3')?.user_id === 'otro-usuario')

      const dup = await createUserRoute(newUser('dup@test.local'))
      const dupBody = await dup.json()
      check('dos ejecutivas con el mismo email: no se adivina, ninguna se enlaza',
        dup.status === 200 && dupBody.linkedExecutive === null && tables.executives.filter(e => e.email === 'dup@test.local').every(e => e.user_id === null))

      const none = await createUserRoute(newUser('nadie@test.local'))
      const noneBody = await none.json()
      check('email sin ejecutiva: usuario creado sin enlace', none.status === 200 && noneBody.linkedExecutive === null && noneBody.message === 'Usuario creado exitosamente')
      check('el enlace no toca otras tablas que users y executives', sameSet(fake.touched(), ['users', 'executives']) && fake.external.length === 0)

      // Al guardar una ejecutiva sin usuario (aunque no cambie el email) se vuelve a intentar el enlace
      const EVA_EXE = '33333333-3333-4333-8333-333333333333'
      const EVA_USER = '44444444-4444-4444-8444-444444444444'
      const putTables = {
        users: [...fakeUsers(), { id: EVA_USER, email: 'eva@test.local', full_name: 'Eva', role: 'sales_manager', active: true, password: 'x' }],
        executives: [{ id: EVA_EXE, full_name: 'Eva Prueba', email: 'Eva@Test.Local', status: 'active', user_id: null, company: 'VG', base_kam_id: null, odoo_employee_id: null, notes: null, color: null }],
        executive_lines: [], kams: [], business_lines: [],
      } as Record<string, Array<Record<string, unknown>>>
      const putFake = fakeSupabase(putTables)
      fetchHandler = putFake.handler
      const put = await updateExecutiveRoute(apiRequest(`/api/executives/${EVA_EXE}`, { method: 'PATCH', body: { notes: 'sin cambio de email' } }), { params: { id: EVA_EXE } })
      check('PATCH de una ejecutiva sin usuario: se enlaza con el usuario de su email aunque el email no cambie',
        put.status === 200 && putTables.executives[0].user_id === EVA_USER, `${put.status} ${(await put.text()).slice(0, 200)}`)
    }

    print('\n7. Importador de VMO deshabilitado')
    {
      const fake = fakeSupabase({ users: fakeUsers(), visits: [{ id: 'v-app', visit_date: '2026-10-05' }], visit_imports: [] })
      fetchHandler = fake.handler
      const response = await importVisitsRoute(apiRequest('/api/visits/import', { method: 'POST', body: { month: 10, year: 2026, filename: 'vmo.xlsx', visits: [{ kam_name: 'X', visit_date: '2026-10-05' }] } }))
      const body = await response.json()
      check('POST /api/visits/import: 410 y no borra ni inserta visitas',
        response.status === 410 && typeof body.error === 'string' && fake.writes().length === 0 && sameSet(fake.touched(), ['users']),
        `${response.status} ${JSON.stringify(body).slice(0, 200)}`)
      const del = await deleteImportRoute(apiRequest('/api/visits/imports?id=11111111-1111-4111-8111-999999999999', { method: 'DELETE' }))
      check('DELETE /api/visits/imports: 410 y no borra el histórico de VMO', del.status === 410 && fake.writes().length === 0)
    }

    print('\n8. Usuarios para las Ejecutivas Comerciales sin cuenta')
    {
      const seq = (start: number) => (size: number) => Uint8Array.from({ length: size }, (_, i) => (start + i * 37) % 256)
      const pw = generateTempPassword(seq(7))
      check('contraseña temporal: 12 caracteres con minúscula, mayúscula y dígito, sin 0/O/1/l/I',
        pw.length === 12 && /[a-z]/.test(pw) && /[A-Z]/.test(pw) && /[2-9]/.test(pw) && !/[0O1lI]/.test(pw), pw)
      check('contraseña temporal determinista con la misma fuente y distinta con otra', generateTempPassword(seq(7)) === pw && generateTempPassword(seq(8)) !== pw)

      const plan = planExecutiveAccounts([
        { id: 'a', full_name: 'Ana', email: 'Ana@vg.co', status: 'active', user_id: null },
        { id: 'b', full_name: 'Bea', email: 'bea@vg.co', status: 'active', user_id: null },
        { id: 'c', full_name: 'Cata', email: null, status: 'active', user_id: null },
        { id: 'd', full_name: 'Vacante', email: 'vac@vg.co', status: 'placeholder', user_id: null },
        { id: 'e', full_name: 'Eli', email: 'eli@vg.co', status: 'active', user_id: 'u-eli' },
        { id: 'f', full_name: 'Fer', email: 'dup@vg.co', status: 'active', user_id: null },
        { id: 'g', full_name: 'Gabi', email: 'dup@vg.co', status: 'active', user_id: null },
        { id: 'h', full_name: 'Hilda', email: 'hilda@vg.co', status: 'inactive', user_id: null },
      ], [{ id: 'u-bea', email: 'bea@vg.co' }, { id: 'u-eli', email: 'eli@vg.co' }])
      const kinds = Object.fromEntries(plan.map(action => [action.executive.id, action.kind]))
      check('plan: crea a quien no tiene usuario, enlaza si ya existe, omite sin email y emails repetidos; no toca vacantes, inactivas ni enlazadas',
        kinds.a === 'create' && kinds.b === 'link' && kinds.c === 'skip' && kinds.f === 'skip' && kinds.g === 'skip' && !('d' in kinds) && !('e' in kinds) && !('h' in kinds),
        JSON.stringify(kinds))

      const tables = {
        users: fakeUsers(),
        executives: [
          { id: 'x1', full_name: 'Zoe Uno', email: 'zoe@vg.co', status: 'active', user_id: null },
          { id: 'x2', full_name: 'Yan Dos', email: 'yan@vg.co', status: 'active', user_id: null },
          { id: 'x3', full_name: 'Vacante', email: null, status: 'placeholder', user_id: null },
        ],
      } as Record<string, Array<Record<string, unknown>>>
      const fake = fakeSupabase(tables)
      fetchHandler = fake.handler
      const viewer = await planAccountsRoute(apiRequest('/api/users/from-executives', { userId: VIEWER_ID, password: 'hash-viewer' }))
      check('GET sin users:manage (viewer): 403', viewer.status === 403)
      const preview = await planAccountsRoute(apiRequest('/api/users/from-executives'))
      const previewBody = await preview.json()
      check('GET: simulación con 2 por crear y sin escribir nada', preview.status === 200 && previewBody.items.filter((i: { action: string }) => i.action === 'create').length === 2 && fake.writes().length === 0)
      const noConfirm = await createAccountsRoute(apiRequest('/api/users/from-executives', { method: 'POST', body: {} }))
      check('POST sin confirm: 400 y nada creado', noConfirm.status === 400 && fake.writes().length === 0)
      const run = await createAccountsRoute(apiRequest('/api/users/from-executives', { method: 'POST', body: { confirm: true } }))
      const runBody = await run.json()
      const zoe = tables.users.find(u => u.email === 'zoe@vg.co')
      const zoeResult = runBody.results?.find((r: { email: string }) => r.email === 'zoe@vg.co')
      check('POST: crea 2 usuarios sales_manager enlazados, devuelve la contraseña una vez y guarda solo el hash',
        run.status === 200 && runBody.created === 2 && zoe?.role === 'sales_manager' && tables.executives[0].user_id === zoe?.id &&
          typeof zoeResult?.tempPassword === 'string' && zoe?.password !== zoeResult.tempPassword && bcrypt.compareSync(zoeResult.tempPassword, String(zoe?.password)),
        `${run.status} ${JSON.stringify(runBody).slice(0, 300)}`)
      const again = await createAccountsRoute(apiRequest('/api/users/from-executives', { method: 'POST', body: { confirm: true } }))
      const againBody = await again.json()
      check('POST otra vez: no crea nada (idempotente)', again.status === 200 && againBody.created === 0 && tables.users.length === fakeUsers().length + 2)
    }
  } finally {
    fetchHandler = null
  }

  print('')
  print(`Mensajes del módulo recogidos (fallos simulados y trazas): ${moduleLogs.length}`)
  print(`Resultado: ${passed} OK, ${failed} con fallo`)
  if (failed > 0) process.exit(1)
}

main().catch(error => {
  process.stderr.write(`ips-routes-check: error inesperado: ${error instanceof Error ? error.stack : String(error)}\n`)
  process.exit(1)
})
