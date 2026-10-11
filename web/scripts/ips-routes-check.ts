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
 *
 * Garantía de "sin red": se borran del entorno las claves de Google y Supabase, se fuerza
 * GOOGLE_ROUTES_DISABLED=true y fetch se reemplaza por uno que falla; toda la E/S se inyecta con dobles.
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
  updateHospitalSchema,
} from '../app/api/_lib/hospital-schemas'
import { eligibleKamsForHospital, isBogotaKam, routeCandidateKams } from '../lib/opmap-algorithm-simplified'
import { MunicipalityTableMissingError } from '../lib/municipality-coverage'

for (const key of [
  'GOOGLE_MAPS_API_KEY',
  'NEXT_PUBLIC_GOOGLE_MAPS_API_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_URL',
]) {
  delete process.env[key]
}
process.env.GOOGLE_ROUTES_DISABLED = 'true'
globalThis.fetch = (async () => {
  throw new Error('ips-routes-check: la red está prohibida en estas pruebas')
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
      !result.recalculated && calls.municipalities === 0 && result.warnings.some(w => w.includes('no se pudo recalcular'))
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

  print('\n6. Cambios que obligan a recalcular la zona')
  check('touchesZoneFields({ name }) = false', !touchesZoneFields({ name: 'x' }))
  check('touchesZoneFields({ lat }) = true', touchesZoneFields({ lat: 4.6 }))
  const stored = { lat: 7.07480292, lng: -73.10944495, department_id: '68', municipality_id: '68276', locality_id: null, active: true }
  check('Mismas coordenadas (ruido de coma flotante): sin cambio', !zoneFieldsChanged(stored, { ...stored, lat: 7.074802920000001 }))
  check('Coordenadas movidas 0,001°: cambio', zoneFieldsChanged(stored, { ...stored, lat: 7.07580292 }))
  check('locality_id null frente a vacío: sin cambio', !zoneFieldsChanged(stored, { ...stored, locality_id: '' }))
  check('Cambio de municipio: cambio', zoneFieldsChanged(stored, { ...stored, municipality_id: '68001' }))
  check('Cambio de estado: cambio', zoneFieldsChanged(stored, { ...stored, active: false }))

  print('')
  print(`Mensajes del módulo recogidos (fallos simulados y trazas): ${moduleLogs.length}`)
  print(`Resultado: ${passed} OK, ${failed} con fallo`)
  if (failed > 0) process.exit(1)
}

main().catch(error => {
  process.stderr.write(`ips-routes-check: error inesperado: ${error instanceof Error ? error.stack : String(error)}\n`)
  process.exit(1)
})
