/**
 * "Datos de la zona" (ventana de /executives) · pruebas de la ruta GET /api/executives/[id]/estadisticas (SIN RED, sin
 * Supabase real, sin Google).
 *
 * Llama al handler real contra un Supabase FALSO de solo lectura en memoria (PostgREST mínimo: eq/neq/in/is/gte/lte,
 * orden, rango; las tablas que no se sembraron responden "no existe", como una migración sin aplicar) y comprueba quién
 * ve qué, con las mismas reglas de las páginas de donde salen las cifras:
 *   - La ventana exige executives:view y hospitals:view: recursos humanos (hr) recibe 403 y no se lee nada más.
 *   - Compras públicas (SECOP y VG Medical) solo con intelligence:view, como /api/secop/*: sales_manager y user no las
 *     reciben y la ruta ni siquiera llama a secop_hechos ni lee fuentes_estado.
 *   - Cobertura y territorio solo en las líneas de resolveUserLines (como /api/coverage?line=, que da 403 en las demás):
 *     el líder de una línea y el vendedor que la lleva no reciben filas de la otra línea, ni su zona en el territorio,
 *     ni la persona que cubre la zona en esa línea; la cobertura de esa línea ni se lee. Un usuario sin líneas no recibe
 *     cobertura. admin y viewer (map:all-lines) ven todas.
 *   - Funciona para una vacante (status placeholder) y nunca escribe en la base.
 *
 * El patrón del Supabase falso viene de scripts/terceros-api-check.ts (copiado y recortado a solo lectura).
 * Uso (desde web/): npx tsx scripts/zona-estadisticas-api-check.ts      Código de salida 1 si alguna prueba falla.
 */
import { NextRequest } from 'next/server'
import { passwordVersion, SESSION_COOKIE_NAME, signSession } from '../lib/session'
import type { ZonaEstadisticasResponse } from '../lib/zona-estadisticas'
import { GET as estadisticas } from '../app/api/executives/[id]/estadisticas/route'

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
process.env.SESSION_SECRET = 'secreto-de-prueba-zona-estadisticas-api-check-0123456789abcdefghijklmnop'

// Despachador único: sin manejador cualquier fetch falla; con él, solo responde el Supabase falso.
type FetchHandler = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
let fetchHandler: FetchHandler | null = null
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  if (!fetchHandler) throw new Error('zona-estadisticas-api-check: la red está prohibida en estas pruebas')
  return fetchHandler(input, init)
}) as typeof fetch

// Los console.error de la ruta (fuentes opcionales ausentes) se recogen aquí para no ensuciar la salida.
const moduleLogs: string[] = []
console.error = (...args: unknown[]) => {
  moduleLogs.push(args.map(arg => (arg instanceof Error ? `${arg.name}: ${arg.message}` : typeof arg === 'object' ? JSON.stringify(arg) : String(arg))).join(' '))
}

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
  body: unknown
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
    } else if (/^(gte|lte|gt|lt)\./.test(raw)) {
      const [op, ...rest] = raw.split('.')
      const target = rest.join('.')
      if (value === 'null') return false
      if (op === 'gte' && !(value >= target)) return false
      if (op === 'lte' && !(value <= target)) return false
      if (op === 'gt' && !(value > target)) return false
      if (op === 'lt' && !(value < target)) return false
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
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b)
  const x = String(a)
  const y = String(b)
  return x < y ? -1 : x > y ? 1 : 0
}

function project(row: Fila, select: string | null): Fila {
  if (!select || select === '*' || select.includes('(')) return { ...row }
  const out: Fila = {}
  for (const column of select.split(',').map(part => part.trim()).filter(Boolean)) out[column] = row[column] ?? null
  return out
}

/** RPC sembradas: nombre → respuesta. Las demás responden "no existe" (PGRST202). */
type Rpcs = Record<string, (body: unknown) => unknown>

function fakeSupabase(tablas: Tablas, rpcs: Rpcs) {
  const requests: FakeRequest[] = []
  const external: string[] = []
  const json = (payload: unknown, status = 200) => new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json' } })

  const handler: FetchHandler = async (input, init) => {
    const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const url = new URL(href)
    if (url.origin !== FAKE_SUPABASE_URL) {
      external.push(url.origin)
      throw new Error(`zona-estadisticas-api-check: intento de red a ${url.origin}`)
    }
    const method = (init?.method || 'GET').toUpperCase()
    const table = url.pathname.replace('/rest/v1/', '')
    const body = init?.body ? JSON.parse(String(init.body)) : undefined
    requests.push({ method, table, params: url.searchParams, body })

    if (table.startsWith('rpc/')) {
      const rpc = rpcs[table.slice(4)]
      if (!rpc) return json({ code: 'PGRST202', message: `Could not find the function public.${table.slice(4)}`, details: null, hint: null }, 404)
      return json(rpc(body))
    }
    // Solo lectura: cualquier escritura es un error de la prueba (y queda en requests).
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

  const writes = () => requests.filter(request => request.method !== 'GET' && !request.table.startsWith('rpc/'))
  return { handler, requests, external, writes }
}

// ---------------------------------------------------------------------------
// Datos: dos líneas, tres zonas del Huila, una vacante
// ---------------------------------------------------------------------------
// Línea A (Sustitutos óseos, líder LIDER): Neiva → Vacante Neiva (local), Garzón → Vacante Neiva (alcance 95 min),
//   Pitalito → Sofía (local).
// Línea B (Reemplazo articular, sin líder): Neiva → Ana (alcance 80 min), Garzón → Ana (local), Pitalito → Vacante
//   Neiva (manual). Quien solo ve A no debe recibir nada de B: ni a Ana, ni Pitalito en el territorio de la vacante.

const ADMIN = '00000000-0000-4000-8000-000000000001'
const LIDER = '00000000-0000-4000-8000-000000000002' // line_leader de A
const VENDEDOR = '00000000-0000-4000-8000-000000000003' // sales_manager enlazado a Sofía (lleva A)
const USUARIO = '00000000-0000-4000-8000-000000000004' // user sin ejecutiva enlazada
const RRHH = '00000000-0000-4000-8000-000000000005' // hr
const VISOR = '00000000-0000-4000-8000-000000000006' // viewer (map:all-lines, intelligence:view)

const LA = '10000000-0000-4000-8000-00000000000a'
const LB = '10000000-0000-4000-8000-00000000000b'

const NEI = '20000000-0000-4000-8000-000000000001'
const GAR = '20000000-0000-4000-8000-000000000002'
const PIT = '20000000-0000-4000-8000-000000000003'

const VACANTE = '30000000-0000-4000-8000-000000000001' // Vacante Neiva (placeholder, base Neiva)
const ANA = '30000000-0000-4000-8000-000000000002'
const SOFIA = '30000000-0000-4000-8000-000000000003'

const H_NEI = '40000000-0000-4000-8000-000000000001'
const H_GAR = '40000000-0000-4000-8000-000000000002'
const H_PIT = '40000000-0000-4000-8000-000000000003'

const CALCULO = '2026-10-13T12:00:00.000Z'

function usuario(id: string, role: string, nombre: string): Fila {
  return { id, email: `${role}@prueba.test`, full_name: nombre, role, active: true, password: `hash-${id}` }
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
    has_equipment: false,
    note: null,
    computed_at: CALCULO,
  }
}

function hospital(id: string, code: string, name: string, municipality_id: string, municipality_name: string, beds: number): Fila {
  return {
    id,
    code,
    name,
    municipality_id,
    municipality_name,
    department_id: '41',
    department_name: 'Huila',
    beds,
    reps_beds: null,
    quirofanos: null,
    active: true,
    service_flags: { cirugia_ortopedica: true },
    reps_updated_at: '2026-10-01T00:00:00.000Z',
  }
}

function datosIniciales(): Tablas {
  return {
    users: [
      usuario(ADMIN, 'admin', 'Admin'),
      usuario(LIDER, 'line_leader', 'Líder de Sustitutos óseos'),
      usuario(VENDEDOR, 'sales_manager', 'Sofía Gómez'),
      usuario(USUARIO, 'user', 'Usuario'),
      usuario(RRHH, 'hr', 'Recursos humanos'),
      usuario(VISOR, 'viewer', 'Visor'),
    ],
    business_lines: [
      { id: LA, code: 'perossal', name: 'Sustitutos óseos', leader_user_id: LIDER, max_reach_minutes: 240, sort_order: 1, active: true },
      { id: LB, code: 'reemplazo', name: 'Reemplazo articular', leader_user_id: null, max_reach_minutes: 240, sort_order: 2, active: true },
    ],
    kams: [
      { id: NEI, name: 'Neiva', base_city: 'Neiva', active: true },
      { id: GAR, name: 'Garzón', base_city: 'Garzón', active: true },
      { id: PIT, name: 'Pitalito', base_city: 'Pitalito', active: true },
    ],
    executives: [
      { id: VACANTE, full_name: 'Vacante Neiva', status: 'placeholder', base_kam_id: NEI, user_id: null, color: null, created_at: '2026-10-01T00:00:00.000Z' },
      { id: ANA, full_name: 'Ana Ruiz', status: 'active', base_kam_id: GAR, user_id: null, color: null, created_at: '2026-01-01T00:00:00.000Z' },
      { id: SOFIA, full_name: 'Sofía Gómez', status: 'active', base_kam_id: PIT, user_id: VENDEDOR, color: null, created_at: '2026-01-01T00:00:00.000Z' },
    ],
    executive_lines: [
      { executive_id: VACANTE, line_id: LA },
      { executive_id: VACANTE, line_id: LB },
      { executive_id: ANA, line_id: LB },
      { executive_id: SOFIA, line_id: LA },
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
    hospitals: [
      hospital(H_NEI, '891180008-1', 'Hospital Universitario de Neiva', '41001', 'Neiva', 300),
      hospital(H_GAR, '891180009-1', 'Hospital de Garzón', '41298', 'Garzón', 80),
      hospital(H_PIT, '891180010-1', 'Hospital de Pitalito', '41551', 'Pitalito', 120),
    ],
    assignments: [
      { hospital_id: H_NEI, kam_id: NEI, assigned_at: '2026-10-01T00:00:00.000Z' },
      { hospital_id: H_GAR, kam_id: GAR, assigned_at: '2026-10-01T00:00:00.000Z' },
      { hospital_id: H_PIT, kam_id: PIT, assigned_at: '2026-10-01T00:00:00.000Z' },
    ],
    municipalities: [
      { code: '41001', name: 'Neiva', department_code: '41', population_2025: 370000 },
      { code: '41298', name: 'Garzón', department_code: '41', population_2025: 95000 },
      { code: '41551', name: 'Pitalito', department_code: '41', population_2025: 140000 },
    ],
    departments: [{ code: '41', name: 'Huila' }],
    municipality_zone: [
      { municipality_code: '41001', kam_id: NEI, kind: 'ips', computed_at: CALCULO },
      { municipality_code: '41298', kam_id: GAR, kind: 'ips', computed_at: CALCULO },
      { municipality_code: '41551', kam_id: PIT, kind: 'ips', computed_at: CALCULO },
    ],
    dane_proyecciones: [],
    medico_visitantes: [{ id: 'mv-1', medico_id: 'medico-1', line_id: LA, executive_id: VACANTE, hasta: null }],
    visits: [],
    fuentes_estado: [
      { fuente: 'secop2', nombre: 'SECOP II', programacion: null, ejecutor: null, ultimo_ok: '2026-10-13T06:00:00.000Z', ultimo_intento: null, estado: 'ok', filas: 10, mensaje: null, siguiente_programado: null },
    ],
  }
}

// Un contrato de VG Medical con el hospital de Neiva (línea trauma: entra en el total ortopédico)
const RPCS: Rpcs = {
  poblacion_cortes: () => ({ cifras: [], bdua: [], dane: [] }),
  secop_hechos: () => [
    { e: '891180008', en: 'Hospital Universitario de Neiva', d: '901080496', h: null, pn: 'VG MEDICAL SAS', p: false, es: null, l: 'trauma', a: false, f: '2026-09-01', v: 50000000, n: 1 },
  ],
}

function apiRequest(executiveId: string, userId: string) {
  const headers: Record<string, string> = {
    cookie: `${SESSION_COOKIE_NAME}=${encodeURIComponent(signSession(userId, passwordVersion(`hash-${userId}`)))}`,
  }
  return new NextRequest(`http://localhost:3000/api/executives/${executiveId}/estadisticas`, { method: 'GET', headers })
}

async function pedir(userId: string, executiveId = VACANTE): Promise<{ status: number; body: any; requests: FakeRequest[] }> {
  const antes = fake.requests.length
  const response = await estadisticas(apiRequest(executiveId, userId), { params: { id: executiveId } })
  const text = await response.text()
  let body: any = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = text
  }
  return { status: response.status, body, requests: fake.requests.slice(antes) }
}

const llamaSecop = (requests: FakeRequest[]) => requests.some(request => request.table === 'rpc/secop_hechos' || request.table === 'fuentes_estado')
const leeCoberturaDe = (requests: FakeRequest[], lineId: string) =>
  requests.some(request => request.table === 'coverage' && request.params.get('line_id') === `eq.${lineId}`)
const lineasDe = (filas: Array<{ line: { code: string } }>) => filas.map(fila => fila.line.code)
const zonasTerritorio = (body: ZonaEstadisticasResponse) => (body.territorio ? body.territorio.zonas.map(zona => zona.nombre) : null)
const texto = (value: unknown) => JSON.stringify(value)

const fake = fakeSupabase(datosIniciales(), RPCS)
fetchHandler = fake.handler

// ---------------------------------------------------------------------------
// Pruebas
// ---------------------------------------------------------------------------

async function main() {
  print('\nadmin (todas las líneas, Inteligencia)')
  {
    const r = await pedir(ADMIN)
    const body = r.body as ZonaEstadisticasResponse
    check('200 para una vacante (placeholder)', r.status === 200 && body.executive?.status === 'placeholder', r.body)
    check('con terceros:view: trae los médicos asignados', body.medicos !== null && typeof body.medicos?.total === 'number', body.medicos)
    eq('acceso: compras públicas y todas las líneas', [body.acceso.comprasPublicas, body.acceso.todasLasLineas, lineasDe(body.acceso.lineasCobertura.map(line => ({ line })))], [true, true, ['perossal', 'reemplazo']])
    eq('territorio: Neiva y Garzón (A) y Pitalito (B)', zonasTerritorio(body), ['Garzón', 'Neiva', 'Pitalito'])
    eq('quién cubre Neiva: las dos líneas', lineasDe(body.coberturaBase), ['perossal', 'reemplazo'])
    check('quién cubre Neiva en B: Ana, por alcance', body.coberturaBase[1]?.executive?.full_name === 'Ana Ruiz' && body.coberturaBase[1]?.kind === 'reach', body.coberturaBase)
    check('SECOP de la zona base: el contrato de VG Medical', body.base?.secop?.valor === 50000000 && body.base?.secop?.vg.valor === 50000000, body.base?.secop)
    check('lee SECOP (secop_hechos y la fecha de actualización)', llamaSecop(r.requests))
    check('lee la cobertura de las dos líneas', leeCoberturaDe(r.requests, LA) && leeCoberturaDe(r.requests, LB))
    check('nota de compras públicas presente', body.notas.some(nota => nota.startsWith('Compras públicas (SECOP)')), body.notas)
  }

  print('\nline_leader de Sustitutos óseos (solo su línea; sí Inteligencia)')
  {
    const r = await pedir(LIDER)
    const body = r.body as ZonaEstadisticasResponse
    check('200', r.status === 200, r.body)
    eq('acceso: compras públicas, solo la línea A', [body.acceso.comprasPublicas, body.acceso.todasLasLineas, body.acceso.lineasCobertura.map(line => line.code)], [true, false, ['perossal']])
    eq('quién cubre Neiva: solo la línea A', lineasDe(body.coberturaBase), ['perossal'])
    eq('zonas que cubre por línea: solo A', lineasDe(body.coberturaEjecutivo), ['perossal'])
    eq('territorio: Neiva y Garzón (Pitalito lo da B, que no ve)', zonasTerritorio(body), ['Garzón', 'Neiva'])
    check('nada de la línea B en la respuesta (ni Ana ni el nombre de la línea en la cobertura)', !texto(body.coberturaBase).includes('Ana Ruiz') && !texto(body.coberturaEjecutivo).includes('reemplazo'), body.coberturaBase)
    check('no lee la cobertura de la línea B', leeCoberturaDe(r.requests, LA) && !leeCoberturaDe(r.requests, LB))
    check('sí recibe SECOP (tiene intelligence:view)', body.base?.secop !== null && llamaSecop(r.requests))
    check('lleva las dos líneas igual que en /api/executives (dato público de la página)', body.executive.lineas.map(line => line.code).join(',') === 'perossal,reemplazo', body.executive.lineas)
    check('nota: cobertura solo en sus líneas', body.notas.some(nota => nota.includes('solo en las líneas que lideras o llevas (Sustitutos óseos)')), body.notas)
  }

  print('\nsales_manager enlazado a Sofía (lleva A; sin Inteligencia)')
  {
    const r = await pedir(VENDEDOR)
    const body = r.body as ZonaEstadisticasResponse
    check('200', r.status === 200, r.body)
    eq('acceso: sin compras públicas, solo la línea A', [body.acceso.comprasPublicas, body.acceso.todasLasLineas, body.acceso.lineasCobertura.map(line => line.code)], [false, false, ['perossal']])
    eq('SECOP: null en la zona base y en el territorio', [body.base ? body.base.secop : 'falta base', body.territorio ? body.territorio.secop : 'falta territorio'], [null, null])
    check('no llama a secop_hechos ni lee fuentes_estado', !llamaSecop(r.requests), r.requests.map(request => request.table))
    check('la respuesta no trae ninguna cifra de VG Medical', !texto(body).includes('"vg"'))
    check('sin la nota de cómo se suma SECOP; con la de que se ve con Inteligencia', !body.notas.some(nota => nota.startsWith('Compras públicas (SECOP)')) && body.notas.some(nota => nota.includes('acceso a Inteligencia')), body.notas)
    eq('quién cubre Neiva: solo la línea A', lineasDe(body.coberturaBase), ['perossal'])
    eq('territorio: Neiva y Garzón', zonasTerritorio(body), ['Garzón', 'Neiva'])
    check('no lee la cobertura de la línea B', !leeCoberturaDe(r.requests, LB))
    check('el resto de cifras sí (municipios e IPS de Neiva)', body.base?.municipios.total === 1 && body.base?.ips.total === 1, body.base)
  }

  print('\nuser sin ejecutiva enlazada (sin líneas, sin Inteligencia)')
  {
    const r = await pedir(USUARIO)
    const body = r.body as ZonaEstadisticasResponse
    check('200', r.status === 200, r.body)
    eq('acceso: nada de SECOP ni de cobertura', [body.acceso.comprasPublicas, body.acceso.todasLasLineas, body.acceso.lineasCobertura], [false, false, []])
    eq('cobertura y territorio vacíos', [body.coberturaBase, body.coberturaEjecutivo, body.territorio, body.coberturaCalculada], [[], [], null, null])
    check('no lee ninguna cobertura ni SECOP', !r.requests.some(request => request.table === 'coverage') && !llamaSecop(r.requests))
    check('la zona base sí (municipios, IPS)', body.base?.ips.total === 1, body.base)
    check('nota: no tiene líneas', body.notas.some(nota => nota.includes('tu usuario no tiene ninguna')), body.notas)
    check('sin terceros:view: no recibe cuántos médicos visita ni lee medico_visitantes', body.medicos === null && !r.requests.some(request => request.table === 'medico_visitantes'), body.medicos)
  }

  print('\nviewer (todas las líneas, Inteligencia)')
  {
    const r = await pedir(VISOR)
    const body = r.body as ZonaEstadisticasResponse
    check('200 con todas las líneas y SECOP', r.status === 200 && body.acceso.todasLasLineas && body.acceso.comprasPublicas && body.base?.secop !== null, body.acceso)
    eq('territorio completo', zonasTerritorio(body), ['Garzón', 'Neiva', 'Pitalito'])
  }

  print('\nhr (sin hospitals:view)')
  {
    const r = await pedir(RRHH)
    check('403 sin leer nada más que su sesión', r.status === 403 && r.requests.every(request => request.table === 'users'), { status: r.status, tablas: r.requests.map(request => request.table) })
  }

  print('\nGenerales')
  {
    const r = await pedir(ADMIN, 'no-es-un-uuid')
    check('id no válido: 400', r.status === 400, r)
    const otra = await pedir(ADMIN, '30000000-0000-4000-8000-0000000000ff')
    check('persona inexistente: 404', otra.status === 404, otra)
    check('ninguna escritura en la base', fake.writes().length === 0, fake.writes())
    check('ninguna petición salió del Supabase falso', fake.external.length === 0, fake.external)
  }

  print(`\n${passed} pruebas pasaron, ${failed} fallaron`)
  if (failed > 0) process.exit(1)
}

main().catch(error => {
  print(`FALLA inesperada: ${error instanceof Error ? error.stack : String(error)}`)
  if (moduleLogs.length > 0) print(`últimos mensajes: ${moduleLogs.slice(-5).join(' | ')}`)
  process.exit(1)
})
