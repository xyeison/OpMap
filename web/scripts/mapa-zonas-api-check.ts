/**
 * Mapa · "Ver por: Zonas" para todos (spec 2026-10-14) · pruebas de GET /api/map/data (SIN RED, sin Supabase real,
 * sin Google).
 *
 * Llama al handler real contra un Supabase FALSO de solo lectura en memoria (PostgREST mínimo: eq/neq/in/is/not.is,
 * orden, rango; las tablas que no se sembraron responden "no existe") y comprueba:
 *   - Quién abre la vista de zonas: todo rol con map:view (todos menos recursos humanos), no solo map:all-lines.
 *     Sin ?line la ruta responde 200 a cada uno de esos roles y 403 a hr.
 *   - Qué NO trae la vista de zonas a quien no tiene map:all-lines: ni la cobertura ni los nombres o colores de
 *     Ejecutivos Comerciales de las líneas que no ve. Sin ?line no hay cobertura en absoluto; con ?line=<su línea>
 *     solo la de esa línea; y de las personas que viven en cada zona (kams[].executives) solo las de SUS líneas.
 *   - Lo que sí trae: todas las zonas activas con su color (kams.color), las IPS y las IPS sin zona, igual que hoy.
 *   - Quien ve todas las líneas (admin, viewer) recibe lo de siempre. Nunca escribe en la base.
 *   - Contratos cargados a mano (hospital_contracts): desde la spec 2026-10-24 (giros ADRES y compras SECOP por tarjeta
 *     en /api/map/detalle/*) el mapa ya no los manda a NADIE: la ruta nunca lee hospital_contracts (aunque haya filas)
 *     ni responde contractValuesByHospital, contractProvidersByHospital, contractsIncluded ni providers en
 *     territoryStats; en su lugar trae inteligenciaIncluida (intelligence:view), que decide si la tarjeta pide el detalle.
 *   - Reglas puras de la página (lib/map-view.ts): ?mode=zones abre la vista de zonas, la línea con que se vuelve a
 *     "Ejecutivos Comerciales" y qué datos se conservan mientras llega otra línea.
 *   - Sin Regiones (spec docs/specs/2026-10-14-quitar-regiones.md): /api/map/data no lee la tabla zones ni manda
 *     kams.zone_id, y ni la página /map ni MapComponent leen ?viewMode ni llaman a /api/zones.
 *
 * El patrón del Supabase falso viene de scripts/zona-estadisticas-api-check.ts (copiado y recortado).
 * Uso (desde web/): npx tsx scripts/mapa-zonas-api-check.ts      Código de salida 1 si alguna prueba falla.
 */
import { readFileSync } from 'fs'
import path from 'path'
import { NextRequest } from 'next/server'
import { passwordVersion, SESSION_COOKIE_NAME, signSession } from '../lib/session'
import { hasPermission, rolePermissions, type Role } from '../lib/permissions'
import { GET as mapData } from '../app/api/map/data/route'
import { lineForExecutivesView, mapDataPlaceholder, resolveMapView } from '../lib/map-view'

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
const FAKE_SUPABASE_URL = 'http://supabase.test'
process.env.NEXT_PUBLIC_SUPABASE_URL = FAKE_SUPABASE_URL
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba'
process.env.SESSION_SECRET = 'secreto-de-prueba-mapa-zonas-api-check-0123456789abcdefghijklmnopqrs'

// Despachador único: sin manejador cualquier fetch falla; con él, solo responde el Supabase falso.
type FetchHandler = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
let fetchHandler: FetchHandler | null = null
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  if (!fetchHandler) throw new Error('mapa-zonas-api-check: la red está prohibida en estas pruebas')
  return fetchHandler(input, init)
}) as typeof fetch

// Los console.log / console.error de la ruta se recogen aquí para no ensuciar la salida.
const moduleLogs: string[] = []
const collect = (...args: unknown[]) => {
  moduleLogs.push(args.map(arg => (arg instanceof Error ? `${arg.name}: ${arg.message}` : typeof arg === 'object' ? JSON.stringify(arg) : String(arg))).join(' '))
}
console.error = collect
console.log = collect

// ---------------------------------------------------------------------------
// Mini marco de pruebas
// ---------------------------------------------------------------------------

const print = (line = '') => process.stdout.write(`${line}\n`)
let passed = 0
let failed = 0

function check(name: string, condition: boolean, detail?: unknown) {
  if (condition) {
    passed++
    print(`  OK    ${name}`)
  } else {
    failed++
    const texto = detail === undefined ? '' : typeof detail === 'string' ? detail : JSON.stringify(detail)
    print(`  FALLA ${name}${texto ? ` -> ${texto.slice(0, 600)}` : ''}`)
    if (moduleLogs.length > 0) print(`        últimos mensajes: ${moduleLogs.slice(-3).join(' | ').slice(0, 600)}`)
  }
}

function eq(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  check(name, a === e, a === e ? undefined : { actual, expected })
}

// ---------------------------------------------------------------------------
// Supabase FALSO de solo lectura
// ---------------------------------------------------------------------------

type Fila = Record<string, unknown>
type Tablas = Record<string, Fila[]>

interface FakeRequest {
  method: string
  table: string
  params: URLSearchParams
}

const POSTGREST_CONTROL_PARAMS = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'])

function matchesFilters(row: Fila, params: URLSearchParams): boolean {
  for (const [key, raw] of Array.from(params.entries())) {
    if (POSTGREST_CONTROL_PARAMS.has(key)) continue
    const value = row[key] === null || row[key] === undefined ? 'null' : String(row[key])
    if (raw.startsWith('eq.')) {
      if (value !== raw.slice(3)) return false
    } else if (raw.startsWith('neq.')) {
      if (value === raw.slice(4)) return false
    } else if (raw.startsWith('in.(') && raw.endsWith(')')) {
      const options = raw.slice(4, -1).split(',').map(option => option.replace(/^"|"$/g, ''))
      if (!options.includes(value)) return false
    } else if (raw === 'is.null') {
      if (value !== 'null') return false
    } else if (raw === 'not.is.null') {
      if (value === 'null') return false
    } else {
      throw new Error(`Supabase falso: filtro no soportado ${key}=${raw}`)
    }
  }
  return true
}

function compareValues(a: unknown, b: unknown): number {
  if (a === b) return 0
  if (a === null || a === undefined) return 1 // NULLS LAST (ascendente)
  if (b === null || b === undefined) return -1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  const x = String(a)
  const y = String(b)
  return x < y ? -1 : x > y ? 1 : 0
}

// Con un select de recursos anidados (hospitals!inner(...)) la fila sembrada ya trae lo anidado: va entera
function project(row: Fila, select: string | null): Fila {
  if (!select || select === '*' || select.includes('(')) return { ...row }
  const out: Fila = {}
  for (const column of select.split(',').map(part => part.trim()).filter(Boolean)) out[column] = row[column] ?? null
  return out
}

function fakeSupabase(tablas: Tablas) {
  const requests: FakeRequest[] = []
  const external: string[] = []
  const json = (payload: unknown, status = 200) => new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json' } })

  const handler: FetchHandler = async (input, init) => {
    const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const url = new URL(href)
    if (url.origin !== FAKE_SUPABASE_URL) {
      external.push(url.origin)
      throw new Error(`mapa-zonas-api-check: intento de red a ${url.origin}`)
    }
    const method = (init?.method || 'GET').toUpperCase()
    const table = url.pathname.replace('/rest/v1/', '')
    requests.push({ method, table, params: url.searchParams })

    // Solo lectura: cualquier escritura (o RPC) es un error de la prueba (y queda en requests).
    if (method !== 'GET') return json({ code: '42501', message: `Supabase falso: escritura no permitida (${method} ${table})`, details: null, hint: null }, 403)
    if (!(table in tablas)) return json({ code: 'PGRST205', message: `Could not find the table 'public.${table}' in the schema cache`, details: null, hint: null }, 404)

    let rows = tablas[table].filter(row => matchesFilters(row, url.searchParams))
    const order = url.searchParams.get('order')
    if (order) {
      const keys = order.split(',').map(part => {
        const [column, direction] = part.split('.')
        return { column, desc: direction === 'desc' }
      })
      rows = [...rows].sort((a, b) => {
        for (const key of keys) {
          const result = compareValues(a[key.column], b[key.column])
          if (result !== 0) return key.desc ? -result : result
        }
        return 0
      })
    }
    const offset = Number(url.searchParams.get('offset') ?? 0)
    const limit = url.searchParams.get('limit')
    rows = rows.slice(offset, limit === null ? undefined : offset + Number(limit))
    return json(rows.map(row => project(row, url.searchParams.get('select'))))
  }

  const writes = () => requests.filter(request => request.method !== 'GET')
  return { handler, requests, external, writes }
}

// ---------------------------------------------------------------------------
// Datos: dos líneas, tres zonas del Huila con su color, una zona inactiva y una sin territorio
// ---------------------------------------------------------------------------
// Línea A (perossal, líder LIDER): Neiva → Vacante Neiva (local), Garzón → Vacante Neiva (alcance), Pitalito → Sofía.
// Línea B (reemplazo, sin líder): Neiva → Ana (alcance), Garzón → Ana (local), Pitalito → Vacante Neiva (manual).
// Viven en Neiva: Vacante Neiva (A y B) y Beto (solo B); en Garzón: Ana (solo B); en Pitalito: Sofía (solo A).
// Quien solo ve A no debe recibir a Ana ni a Beto (ni sus colores), ni nada de la cobertura de B.

const ADMIN = '00000000-0000-4000-8000-000000000001'
const LIDER = '00000000-0000-4000-8000-000000000002' // line_leader de A
const VENDEDOR = '00000000-0000-4000-8000-000000000003' // sales_manager enlazado a Sofía (lleva A)
const USUARIO = '00000000-0000-4000-8000-000000000004' // user sin ejecutiva enlazada (sin líneas)
const RRHH = '00000000-0000-4000-8000-000000000005' // hr (sin map:view)
const VISOR = '00000000-0000-4000-8000-000000000006' // viewer (map:all-lines)
const USUARIO_B = '00000000-0000-4000-8000-000000000007' // user enlazado a Carla (lleva B), sin contracts:view

const LA = '10000000-0000-4000-8000-00000000000a'
const LB = '10000000-0000-4000-8000-00000000000b'

const NEI = '20000000-0000-4000-8000-000000000001'
const GAR = '20000000-0000-4000-8000-000000000002'
const PIT = '20000000-0000-4000-8000-000000000003'
const INACTIVA = '20000000-0000-4000-8000-000000000004'
const SIN_TERRITORIO = '20000000-0000-4000-8000-000000000005'

const VACANTE = '30000000-0000-4000-8000-000000000001' // Vacante Neiva (placeholder, base Neiva)
const ANA = '30000000-0000-4000-8000-000000000002'
const SOFIA = '30000000-0000-4000-8000-000000000003'
const BETO = '30000000-0000-4000-8000-000000000004'
const CARLA = '30000000-0000-4000-8000-000000000005' // lleva B, sin zona base (no vive en ninguna zona)

const H_NEI = '40000000-0000-4000-8000-000000000001'
const H_GAR = '40000000-0000-4000-8000-000000000002'
const H_PIT = '40000000-0000-4000-8000-000000000003'
const H_SIN = '40000000-0000-4000-8000-000000000004' // IPS sin zona

const COLOR_ZONA: Record<string, string> = { [NEI]: '#d62728', [GAR]: '#1f77b4', [PIT]: '#2ca02c' }
// Colores de las personas: los de la línea B no pueden salir a quien solo ve A
const COLOR_ANA = '#9467bd'
const COLOR_BETO = '#17becf'
const COLOR_SOFIA = '#8c564b'

const CALCULO = '2026-10-14T12:00:00.000Z'

function usuario(id: string, role: string, nombre: string): Fila {
  return { id, email: `${role}-${id.slice(-4)}@prueba.test`, full_name: nombre, role, active: true, password: `hash-${id}` }
}

function cobertura(line_id: string, kam_id: string, executive_id: string | null, kind: string, travel_minutes: number | null = null): Fila {
  return {
    line_id,
    kam_id,
    executive_id,
    kind,
    travel_minutes,
    source_kam_id: null,
    nearest_executive_id: null,
    nearest_minutes: null,
    has_equipment: true,
    note: null,
    computed_at: CALCULO,
  }
}

function hospital(id: string, code: string, name: string, municipality_id: string, municipality_name: string, beds: number): Fila {
  return {
    id,
    code,
    name,
    department_id: '41',
    municipality_id,
    locality_id: null,
    lat: 2.9,
    lng: -75.3,
    beds,
    service_level: 2,
    surgeries: 0,
    ambulances: 0,
    municipality_name,
    department_name: 'Huila',
    locality_name: null,
    type: 'Publico',
    doctors: 0,
    service_flags: null,
    quirofanos: null,
    reps_beds: null,
    active: true,
  }
}

function zona(id: string, name: string, area_id: string, color: string | null, extra: Fila = {}): Fila {
  return { id, name, area_id, lat: 2.9, lng: -75.3, color, zone_id: null, base_city: name, active: true, participates_in_assignment: true, ...extra }
}

function asignacion(n: number, hospitalRow: Fila, kam: Fila): Fila {
  return {
    id: n,
    kam_id: kam.id,
    hospital_id: hospitalRow.id,
    travel_time: 1800,
    assignment_type: 'automatic',
    is_base_territory: true,
    hospitals: hospitalRow,
    kams: { id: kam.id, name: kam.name, color: kam.color },
  }
}

const ROLES = Object.keys(rolePermissions) as Role[]
// Un usuario por rol, sin líneas (ni líder ni ejecutiva enlazada), para la prueba de quién abre la vista de zonas
const usuarioDeRol = (role: Role) => `50000000-0000-4000-8000-${String(ROLES.indexOf(role) + 1).padStart(12, '0')}`

function datosIniciales(): Tablas {
  const zonaNeiva = zona(NEI, 'Neiva', '41001', COLOR_ZONA[NEI])
  const zonaGarzon = zona(GAR, 'Garzón', '41298', COLOR_ZONA[GAR])
  const zonaPitalito = zona(PIT, 'Pitalito', '41551', COLOR_ZONA[PIT])
  const hNei = hospital(H_NEI, '891180008-1', 'Hospital Universitario de Neiva', '41001', 'Neiva', 300)
  const hGar = hospital(H_GAR, '891180009-1', 'Hospital de Garzón', '41298', 'Garzón', 80)
  const hPit = hospital(H_PIT, '891180010-1', 'Hospital de Pitalito', '41551', 'Pitalito', 120)
  const hSin = hospital(H_SIN, '891180011-1', 'Clínica sin zona', '41396', 'La Plata', 40)
  return {
    users: [
      usuario(ADMIN, 'admin', 'Admin'),
      usuario(LIDER, 'line_leader', 'Líder de PerOssal'),
      usuario(VENDEDOR, 'sales_manager', 'Sofía Gómez'),
      usuario(USUARIO, 'user', 'Usuario'),
      usuario(RRHH, 'hr', 'Recursos humanos'),
      usuario(VISOR, 'viewer', 'Visor'),
      usuario(USUARIO_B, 'user', 'Carla Díaz'),
      ...ROLES.map(role => usuario(usuarioDeRol(role), role, `Rol ${role}`)),
    ],
    business_lines: [
      { id: LA, code: 'perossal', name: 'PerOssal', leader_user_id: LIDER, max_reach_minutes: 240, sort_order: 1, active: true },
      { id: LB, code: 'reemplazo', name: 'Reemplazo articular', leader_user_id: null, max_reach_minutes: 240, sort_order: 2, active: true },
    ],
    kams: [
      zonaNeiva,
      zonaGarzon,
      zonaPitalito,
      zona(INACTIVA, 'Zona apagada', '41020', '#ff7f0e', { active: false }),
      zona(SIN_TERRITORIO, 'Zona sin territorio', '41030', '#bcbd22', { participates_in_assignment: false }),
    ],
    executives: [
      { id: VACANTE, full_name: 'Vacante Neiva', status: 'placeholder', base_kam_id: NEI, user_id: null, color: null },
      { id: ANA, full_name: 'Ana Ruiz', status: 'active', base_kam_id: GAR, user_id: null, color: COLOR_ANA },
      { id: SOFIA, full_name: 'Sofía Gómez', status: 'active', base_kam_id: PIT, user_id: VENDEDOR, color: COLOR_SOFIA },
      { id: BETO, full_name: 'Beto Pérez', status: 'active', base_kam_id: NEI, user_id: null, color: COLOR_BETO },
      { id: CARLA, full_name: 'Carla Díaz', status: 'active', base_kam_id: null, user_id: USUARIO_B, color: null },
    ],
    executive_lines: [
      { executive_id: VACANTE, line_id: LA },
      { executive_id: VACANTE, line_id: LB },
      { executive_id: ANA, line_id: LB },
      { executive_id: SOFIA, line_id: LA },
      { executive_id: BETO, line_id: LB },
      { executive_id: CARLA, line_id: LB },
    ],
    coverage: [
      cobertura(LA, NEI, VACANTE, 'local'),
      cobertura(LA, GAR, VACANTE, 'reach', 95),
      cobertura(LA, PIT, SOFIA, 'local'),
      cobertura(LB, NEI, ANA, 'reach', 80),
      cobertura(LB, GAR, ANA, 'local'),
      cobertura(LB, PIT, VACANTE, 'manual'),
    ],
    coverage_overrides: [],
    hospitals: [hNei, hGar, hPit, hSin],
    assignments: [asignacion(1, hNei, zonaNeiva), asignacion(2, hGar, zonaGarzon), asignacion(3, hPit, zonaPitalito)],
    municipalities: [
      { code: '41001', name: 'Neiva', population_2025: 370000 },
      { code: '41298', name: 'Garzón', population_2025: 95000 },
      { code: '41396', name: 'La Plata', population_2025: 65000 },
      { code: '41551', name: 'Pitalito', population_2025: 140000 },
    ],
    // Sembrado SOLO para comprobar que la ruta ya no lo lee ni lo manda (si lo leyera, quedaría en requests y en el texto)
    hospital_contracts: [{ hospital_id: H_NEI, contract_value: 50000000, provider: 'Proveedor X', active: true }],
  }
}

function apiRequest(query: string, userId: string | null) {
  const headers: Record<string, string> = {}
  if (userId) headers.cookie = `${SESSION_COOKIE_NAME}=${encodeURIComponent(signSession(userId, passwordVersion(`hash-${userId}`)))}`
  return new NextRequest(`http://localhost:3000/api/map/data${query}`, { method: 'GET', headers })
}

async function pedir(userId: string | null, query = ''): Promise<{ status: number; body: any; text: string; requests: FakeRequest[] }> {
  const antes = fake.requests.length
  const response = await mapData(apiRequest(query, userId))
  const text = await response.text()
  let body: any = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = text
  }
  return { status: response.status, body, text, requests: fake.requests.slice(antes) }
}

// Personas que viven en cada zona, por nombre de zona (kams[].executives)
function personasPorZona(body: any): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const kam of (body?.kams || []) as any[]) out[kam.name] = (kam.executives || []).map((e: any) => e.full_name)
  return out
}
const coloresDeZona = (body: any): Record<string, string> =>
  Object.fromEntries(((body?.kams || []) as any[]).map(kam => [kam.id, kam.color]))
const leeCoberturaDe = (requests: FakeRequest[], lineId: string) =>
  requests.some(request => request.table === 'coverage' && request.params.get('line_id') === `eq.${lineId}`)
const leeCobertura = (requests: FakeRequest[]) => requests.some(request => request.table === 'coverage')
// Nada de la línea B ni de sus personas en la respuesta (nombres, ids ni colores)
const NADA_DE_B = ['Ana Ruiz', 'Beto Pérez', ANA, BETO, COLOR_ANA, COLOR_BETO, LB, 'reemplazo', 'Reemplazo articular']
const queTraeDeB = (text: string) => NADA_DE_B.filter(token => text.includes(token))
// Contratos cargados a mano: el sembrado es 50.000.000 con 'Proveedor X' en la IPS de Neiva y NO debe salir a nadie
const leeContratos = (requests: FakeRequest[]) => requests.some(request => request.table === 'hospital_contracts')
const CAMPOS_CONTRATOS = ['contractValuesByHospital', 'contractProvidersByHospital', 'contractsIncluded']
const CAMPOS_CONTRATOS_TERRITORIO = ['totalContracts', 'contractValue', 'providers']
// Campos de contratos que aún trae la respuesta (arriba o en territoryStats), rastros del sembrado en el texto y si se leyó la tabla
const rastroDeContratos = (r: { body: any; text: string; requests: FakeRequest[] }) => ({
  campos: CAMPOS_CONTRATOS.filter(campo => campo in (r.body || {})),
  territorio: Object.values((r.body?.territoryStats || {}) as Record<string, any>).flatMap(stats => CAMPOS_CONTRATOS_TERRITORIO.filter(campo => campo in stats)),
  texto: ['Proveedor X', '50000000', '"providers"'].filter(token => r.text.includes(token)),
  leyo: leeContratos(r.requests),
})
const SIN_RASTRO = { campos: [], territorio: [], texto: [], leyo: false }

const fake = fakeSupabase(datosIniciales())
fetchHandler = fake.handler

// ---------------------------------------------------------------------------
// Pruebas
// ---------------------------------------------------------------------------

async function main() {
  print('\nQuién abre la vista de zonas (sin ?line): todo rol con map:view')
  {
    const conMapa = ROLES.filter(role => hasPermission(role, 'map:view'))
    eq('map:view: todos los roles menos hr', conMapa, ROLES.filter(role => role !== 'hr'))
    const estados: Record<string, number> = {}
    const inteligencia: Record<string, unknown> = {}
    const conRastro: string[] = []
    for (const role of ROLES) {
      const r = await pedir(usuarioDeRol(role))
      estados[role] = r.status
      if (r.status === 200) {
        inteligencia[role] = r.body.inteligenciaIncluida
        if (JSON.stringify(rastroDeContratos(r)) !== JSON.stringify(SIN_RASTRO)) conRastro.push(role)
      }
    }
    eq('GET /api/map/data sin ?line: 200 con map:view, 403 sin él', estados, Object.fromEntries(ROLES.map(role => [role, hasPermission(role, 'map:view') ? 200 : 403])))
    eq(
      'inteligenciaIncluida según intelligence:view (admin, line_leader, commercial_director, data_manager, viewer)',
      inteligencia,
      Object.fromEntries(ROLES.filter(role => hasPermission(role, 'map:view')).map(role => [role, hasPermission(role, 'intelligence:view')]))
    )
    eq('ningún rol recibe contratos cargados a mano ni se lee hospital_contracts (spec 2026-10-24)', conRastro, [])
    const sinTodas = ROLES.filter(role => hasPermission(role, 'map:view') && !hasPermission(role, 'map:all-lines'))
    eq('incluye roles sin map:all-lines (antes 403 "Debes elegir una línea")', sinTodas, ['sales_manager', 'line_leader', 'contract_manager', 'user'])
    const sinSesion = await pedir(null)
    check('sin sesión: 401', sinSesion.status === 401, sinSesion.body)
  }

  print('\nline_leader de PerOssal · vista de zonas sin línea elegida')
  {
    const r = await pedir(LIDER)
    check('200', r.status === 200, r.body)
    check('sin cobertura ni lista de Ejecutivos Comerciales de una línea', !('coverage' in r.body) && !('executives' in r.body), Object.keys(r.body))
    check('no lee la tabla coverage', !leeCobertura(r.requests), r.requests.map(request => request.table))
    eq('todas las zonas activas con territorio (ni la apagada ni la que no participa)', (r.body.kams as any[]).map(kam => kam.name).sort(), ['Garzón', 'Neiva', 'Pitalito'])
    eq('cada zona con su color de kams.color', coloresDeZona(r.body), COLOR_ZONA)
    eq('personas por zona: solo las de PerOssal', personasPorZona(r.body), { Neiva: ['Vacante Neiva'], 'Garzón': [], Pitalito: ['Sofía Gómez'] })
    eq('nada de la línea B (ni Ana ni Beto, sus ids, sus colores ni la línea)', queTraeDeB(r.text), [])
    eq('IPS asignadas y sin zona, como hoy', [r.body.assignments.length, r.body.hospitals.length, r.body.unassignedHospitals.map((h: any) => h.name)], [3, 4, ['Clínica sin zona']])
    check('busca las personas de sus líneas en executive_lines (línea A)', r.requests.some(request => request.table === 'executive_lines' && request.params.get('line_id') === `in.(${LA})`), r.requests.map(request => `${request.table}?${request.params}`))
    eq('sin contratos cargados a mano aunque tenga contracts:view (ya no van en el mapa)', rastroDeContratos(r), SIN_RASTRO)
  }

  print('\nline_leader de PerOssal · vista de zonas con su línea elegida (?line=perossal)')
  {
    const r = await pedir(LIDER, '?line=perossal')
    check('200', r.status === 200, r.body)
    check('la cobertura es solo la de su línea', r.body.coverage?.line?.code === 'perossal' && r.body.coverage.rows.length === 3, r.body.coverage)
    eq('quién cubre cada zona en su línea', (r.body.coverage.rows as any[]).map(row => `${row.zone_name}:${row.executive?.full_name ?? '-'}`), ['Garzón:Vacante Neiva', 'Neiva:Vacante Neiva', 'Pitalito:Sofía Gómez'])
    eq('Ejecutivos Comerciales de la leyenda: los de su línea', (r.body.executives as any[]).map(e => e.full_name), ['Sofía Gómez', 'Vacante Neiva'])
    eq('personas por zona: solo las de PerOssal', personasPorZona(r.body), { Neiva: ['Vacante Neiva'], 'Garzón': [], Pitalito: ['Sofía Gómez'] })
    eq('nada de la línea B', queTraeDeB(r.text), [])
    check('no lee la cobertura de la línea B', leeCoberturaDe(r.requests, LA) && !leeCoberturaDe(r.requests, LB))
    const ajena = await pedir(LIDER, '?line=reemplazo')
    check('la línea que no ve: 403', ajena.status === 403, ajena.body)
  }

  print('\nsales_manager enlazado a Sofía (lleva PerOssal)')
  {
    const r = await pedir(VENDEDOR)
    check('200 sin línea', r.status === 200 && !('coverage' in r.body), r.body)
    eq('personas por zona: solo las de PerOssal', personasPorZona(r.body), { Neiva: ['Vacante Neiva'], 'Garzón': [], Pitalito: ['Sofía Gómez'] })
    eq('nada de la línea B', queTraeDeB(r.text), [])
  }

  print('\nuser sin líneas (map:view, sin map:all-lines)')
  {
    const r = await pedir(USUARIO)
    check('200: también ve la vista de zonas', r.status === 200, r.body)
    eq('todas las zonas con su color', coloresDeZona(r.body), COLOR_ZONA)
    eq('ninguna persona (no lleva ni lidera ninguna línea)', personasPorZona(r.body), { Neiva: [], 'Garzón': [], Pitalito: [] })
    eq('ningún nombre de Ejecutivo Comercial en la respuesta', ['Vacante Neiva', 'Sofía Gómez', 'Ana Ruiz', 'Beto Pérez'].filter(name => r.text.includes(name)), [])
    check('no lee coverage ni executive_lines', !r.requests.some(request => request.table === 'coverage' || request.table === 'executive_lines'), r.requests.map(request => request.table))
    eq('sin contratos cargados a mano: ni campos, ni territoryStats, ni rastro, ni lectura de hospital_contracts', rastroDeContratos(r), SIN_RASTRO)
    eq('inteligenciaIncluida: false (user no tiene intelligence:view)', r.body.inteligenciaIncluida, false)
    eq('las IPS sí, como a los demás', [r.body.assignments.length, r.body.hospitals.length, r.body.unassignedHospitals.length], [3, 4, 1])
    const conLinea = await pedir(USUARIO, '?line=perossal')
    check('con ?line de una línea que no tiene: 403', conLinea.status === 403, conLinea.body)
  }

  print('\nuser enlazado a una ejecutiva de Reemplazo (tiene línea, sin contracts:view): no pierde nada')
  {
    const zonas = await pedir(USUARIO_B)
    check('vista de zonas: 200', zonas.status === 200, zonas.body)
    eq('sin contratos cargados a mano (tampoco quien antes los recibía con ?line)', rastroDeContratos(zonas), SIN_RASTRO)
    eq('personas por zona: solo las de Reemplazo', personasPorZona(zonas.body), { Neiva: ['Beto Pérez', 'Vacante Neiva'], 'Garzón': ['Ana Ruiz'], Pitalito: [] })
    const linea = await pedir(USUARIO_B, '?line=reemplazo')
    check('su línea: 200 con su cobertura', linea.status === 200 && linea.body.coverage?.line?.code === 'reemplazo', linea.body)
    eq('su línea: tampoco contratos cargados a mano', rastroDeContratos(linea), SIN_RASTRO)
  }

  print('\nviewer y admin (map:all-lines): lo de siempre')
  {
    const visor = await pedir(VISOR)
    check('viewer: 200 sin cobertura', visor.status === 200 && !('coverage' in visor.body), visor.body)
    eq('viewer: todas las personas de cada zona', personasPorZona(visor.body), { Neiva: ['Beto Pérez', 'Vacante Neiva'], 'Garzón': ['Ana Ruiz'], Pitalito: ['Sofía Gómez'] })
    check('viewer: no lee executive_lines (no hace falta filtrar)', !visor.requests.some(request => request.table === 'executive_lines'), visor.requests.map(request => request.table))
    eq('viewer: sin contratos cargados a mano; inteligenciaIncluida true', [rastroDeContratos(visor), visor.body.inteligenciaIncluida], [SIN_RASTRO, true])
    const admin = await pedir(ADMIN, '?line=reemplazo')
    check('admin: cualquier línea, con su cobertura', admin.status === 200 && admin.body.coverage?.line?.code === 'reemplazo', admin.body)
    eq('admin: personas por zona completas', personasPorZona(admin.body), { Neiva: ['Beto Pérez', 'Vacante Neiva'], 'Garzón': ['Ana Ruiz'], Pitalito: ['Sofía Gómez'] })
  }

  print('\nhr (sin map:view)')
  {
    const r = await pedir(RRHH)
    check('403 sin leer nada más que su sesión', r.status === 403 && r.requests.every(request => request.table === 'users'), { status: r.status, tablas: r.requests.map(request => request.table) })
    const conLinea = await pedir(RRHH, '?line=perossal')
    check('también con ?line: 403', conLinea.status === 403, conLinea.body)
  }

  print('\nPágina /map: reglas puras (lib/map-view.ts)')
  {
    const vista = (mode: string | null) => resolveMapView({ mode })
    eq('sin parámetros: vista por Ejecutivos Comerciales', vista(null), { mapMode: 'line' })
    eq('?mode=zones: vista de zonas (para todo el que ve el mapa)', vista('zones'), { mapMode: 'zones' })
    eq('otro valor de mode: vista por línea', vista('ZONES'), { mapMode: 'line' })

    const lineas = [{ code: 'perossal' }, { code: 'reemplazo' }]
    eq('volver a Ejecutivos Comerciales: la línea elegida', lineForExecutivesView('reemplazo', lineas), 'reemplazo')
    eq('sin línea elegida: la primera de sus líneas', lineForExecutivesView(null, lineas), 'perossal')
    eq('con una línea que no es suya en la URL: la primera de las suyas', lineForExecutivesView('otra', lineas), 'perossal')
    eq('sin líneas: ninguna', lineForExecutivesView(null, []), null)

    const deZonas = { kams: [] }
    const deLinea = { kams: [], coverage: { line: { code: 'perossal' }, rows: [] } }
    eq('primera carga: nada que conservar', mapDataPlaceholder(undefined, 'perossal'), undefined)
    eq('de una línea a otra: se conserva el mapa anterior (como siempre)', mapDataPlaceholder(deLinea, 'reemplazo'), deLinea)
    eq('de zonas sin línea a una línea: no se conserva (sale "Cargando mapa...")', mapDataPlaceholder(deZonas, 'perossal'), undefined)
    eq('a la vista de zonas sin línea: se conserva (las zonas no dependen de la línea)', mapDataPlaceholder(deLinea, null), deLinea)
  }

  print('\nSin Regiones (dueño, 2026-10-14)')
  {
    const admin = await pedir(ADMIN)
    const lider = await pedir(LIDER)
    for (const [quien, r] of [['admin', admin], ['line_leader', lider]] as const) {
      check(`${quien}: 200`, r.status === 200, r.body)
      check(`${quien}: no lee la tabla zones`, !r.requests.some(request => request.table === 'zones'), r.requests.map(request => request.table))
      check(`${quien}: las zonas no traen zone_id (Región)`, ((r.body?.kams || []) as any[]).every(kam => !('zone_id' in kam)), r.body?.kams)
    }
    // Página y componente del mapa: sin modo Regiones (lectura del código, sin red)
    const WEB = path.join(__dirname, '..')
    const fuente = (archivo: string) => readFileSync(path.join(WEB, archivo), 'utf8')
    const pagina = fuente('app/map/page.tsx')
    const componente = fuente('components/MapComponent.tsx')
    const leyenda = fuente('components/MapLegend.tsx')
    check('/map no lee ?viewMode (un enlace viejo con ?viewMode=zones no hace nada)', !/viewMode/.test(pagina))
    check('MapComponent no tiene viewMode', !/viewMode/.test(componente))
    check('el mapa no llama a /api/zones', ![pagina, componente, leyenda].some(texto => /\/api\/zones\b/.test(texto)))
    check(
      'sin textos de Regiones en el mapa ("Vista de regiones", leyenda "Regiones")',
      ![pagina, componente, leyenda].some(texto => /['"`]Vista de regiones['"`]|['"`]Regiones['"`]/i.test(texto))
    )
    check('la vista de zonas sigue con su título "Vista de zonas"', componente.includes("'Vista de zonas'"))
  }

  print('\nGenerales')
  {
    const r = await pedir(ADMIN, '?line=NO%20VALE!')
    check('código de línea no válido: 400', r.status === 400, r.body)
    check('ninguna escritura en la base', fake.writes().length === 0, fake.writes())
    check('ninguna petición salió del Supabase falso', fake.external.length === 0, fake.external)
    check('en toda la corrida nunca se leyó hospital_contracts', !fake.requests.some(request => request.table === 'hospital_contracts'))
  }

  print(`\n${passed} pruebas pasaron, ${failed} fallaron`)
  if (failed > 0) process.exit(1)
}

main().catch(error => {
  print(`FALLA inesperada: ${error instanceof Error ? error.stack : String(error)}`)
  if (moduleLogs.length > 0) print(`últimos mensajes: ${moduleLogs.slice(-5).join(' | ')}`)
  process.exit(1)
})
