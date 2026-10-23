/**
 * Zonas por línea (spec 2026-10-23) · pruebas de PUT/DELETE /api/executives/[id]/lineas/[lineId] y de
 * POST /api/coverage/simular (SIN RED, sin Supabase real, sin Google).
 *
 * Llama a los handlers reales contra un Supabase FALSO en memoria (PostgREST mínimo con insert, upsert y delete solo en
 * executive_lines y coverage; emula el disparador executive_lines_termina_visitantes de la migración 0820, que cierra
 * los visitantes de la persona en la línea que pierde) y comprueba:
 *   - Simular nunca escribe; recorta el diff y el resumen a las líneas del usuario; 403 si un cambio es de otra línea
 *     (también en quitar_ajuste, por la línea del ajuste); máximo 20 cambios y mínimo 1; el diff trae nombres (línea,
 *     Zona, quién antes y después y sus estados): dar la línea a Beto en Neiva, donde ya vive Vacante Neiva con ella →
 *     conflicto, y Garzón pasa de la vacante a Beto por alcance (empate a 95 min, orden alfabético); quitar el ajuste de
 *     Pitalito → Ana por alcance. Por cada linea_quitar trae medicosQuePierdenVisitante (la cuenta de médicos vigentes de
 *     esa persona en esa línea, que el disparador 0820 terminaría): 2 para Sofía; 0 sin leer nada si no lleva la línea;
 *     0 si la tabla medico_visitantes no existe; nada en un 403.
 *   - Dar la línea: executives:lines (viewer, user, hr y sales_manager → 403); la líder solo en la que lidera (403 en
 *     otra); ejecutivo inactivo o sin zona base → 400; línea inactiva → 400; inexistentes → 404; ids no válidos → 400;
 *     200 inserta la fila, recalcula la cobertura (upsert + delete en coverage) y responde las líneas por código;
 *     repetir es idempotente (no vuelve a insertar); una vacante (placeholder) también.
 *   - Líneas permitidas: a Ana la dirección la limitó a Reemplazo articular → darle Sustitutos óseos responde 409 con el
 *     mensaje y lineasPermitidas: ['reemplazo'], sin escribir; darle la permitida sigue en 200.
 *   - Quitar la línea: cuenta antes los médicos vigentes de esa persona en esa línea (dos médicos, uno con dos filas y
 *     una ya cerrada no cuentan de más) → medicosTerminados: 2; el disparador los cierra; repetir devuelve 0; recalcula.
 *   - Nada sale del Supabase falso y ninguna escritura toca otra tabla.
 *
 * El patrón del Supabase falso viene de scripts/zonas-api-check.ts y terceros-api-check.ts (copiado).
 * Uso (desde web/): npx tsx scripts/lineas-api-check.ts      Código de salida 1 si alguna prueba falla.
 */
import { randomUUID } from 'node:crypto'
import { NextRequest } from 'next/server'
import { passwordVersion, SESSION_COOKIE_NAME, signSession } from '../lib/session'
import type { SimularResponse } from '../lib/types/zonas'
import { DELETE as quitarLinea, PUT as darLinea, type LineaEjecutivoResponse } from '../app/api/executives/[id]/lineas/[lineId]/route'
import { POST as simular } from '../app/api/coverage/simular/route'

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
process.env.SESSION_SECRET = 'secreto-de-prueba-lineas-api-check-0123456789abcdefghijklmnopqrstuvwxyz'

// Despachador único: sin manejador cualquier fetch falla; con él, solo responde el Supabase falso.
type FetchHandler = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
let fetchHandler: FetchHandler | null = null
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  if (!fetchHandler) throw new Error('lineas-api-check: la red está prohibida en estas pruebas')
  return fetchHandler(input, init)
}) as typeof fetch

// Los console.error de las rutas (errores simulados) se recogen aquí para no ensuciar la salida.
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
// Supabase FALSO (PostgREST mínimo en memoria; escrituras solo en las tablas indicadas)
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
    } else if (raw === 'not.is.null') {
      if (value === 'null') return false
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

const UNICAS: Record<string, { nombre: string; columnas: string[] }[]> = {
  coverage: [{ nombre: 'coverage_line_id_kam_id_key', columnas: ['line_id', 'kam_id'] }],
  executive_lines: [{ nombre: 'executive_lines_pkey', columnas: ['executive_id', 'line_id'] }],
}
const SIN_ID = new Set(['executive_lines', 'executive_allowed_lines'])

const HOY = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })

function fakeSupabase(tablas: Tablas, escribibles: ReadonlySet<string>) {
  const requests: FakeRequest[] = []
  const external: string[] = []
  const json = (payload: unknown, status = 200) => new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json' } })
  const pgError = (code: string, message: string, status: number) => json({ code, message, details: null, hint: null }, status)
  const store = (table: string) => (tablas[table] = tablas[table] ?? [])

  /** Disparador executive_lines_termina_visitantes (0820): al borrar la fila, cierra los visitantes abiertos de esa línea. */
  const alBorrar = (table: string, borradas: Fila[]) => {
    if (table !== 'executive_lines') return
    for (const fila of borradas) {
      for (const visitante of store('medico_visitantes')) {
        if (visitante.executive_id === fila.executive_id && visitante.line_id === fila.line_id && (visitante.hasta === null || visitante.hasta === undefined)) {
          visitante.hasta = HOY
          visitante.fin_motivo = 'linea_quitada'
        }
      }
    }
  }

  const handler: FetchHandler = async (input, init) => {
    const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const url = new URL(href)
    if (url.origin !== FAKE_SUPABASE_URL) {
      external.push(url.origin)
      throw new Error(`lineas-api-check: intento de red a ${url.origin}`)
    }
    const method = (init?.method || 'GET').toUpperCase()
    const table = url.pathname.replace('/rest/v1/', '')
    const body = init?.body ? JSON.parse(String(init.body)) : undefined
    requests.push({ method, table, params: url.searchParams, body })
    const select = url.searchParams.get('select')

    if (table.startsWith('rpc/')) return pgError('PGRST202', `Could not find the function public.${table.slice(4)}`, 404)
    if (!(table in tablas)) return pgError('PGRST205', `Could not find the table 'public.${table}' in the schema cache`, 404)

    if (method === 'GET') {
      let rows = store(table).filter(row => matchesFilters(row, url.searchParams))
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
      return json(rows.map(row => project(row, select)))
    }

    if (!escribibles.has(table)) return pgError('42501', `Supabase falso: escritura no permitida (${method} ${table})`, 403)

    if (method === 'POST') {
      const nuevas = (Array.isArray(body) ? body : [body]) as Fila[]
      const onConflict = url.searchParams.get('on_conflict')?.split(',').map(part => part.trim()) ?? null
      const out: Fila[] = []
      for (const nueva of nuevas) {
        if (onConflict) {
          const existente = store(table).find(row => onConflict.every(column => (row[column] ?? null) === (nueva[column] ?? null)))
          if (existente) {
            Object.assign(existente, nueva)
            out.push(existente)
            continue
          }
        } else {
          for (const unica of UNICAS[table] ?? []) {
            if (store(table).some(row => unica.columnas.every(column => (row[column] ?? null) === (nueva[column] ?? null)))) {
              return pgError('23505', `duplicate key value violates unique constraint "${unica.nombre}"`, 409)
            }
          }
        }
        const fila: Fila = { ...(SIN_ID.has(table) ? {} : { id: randomUUID() }), ...nueva }
        store(table).push(fila)
        out.push(fila)
      }
      return json(out.map(row => project(row, select)), 201)
    }
    if (method === 'DELETE') {
      const borradas = store(table).filter(row => matchesFilters(row, url.searchParams))
      tablas[table] = store(table).filter(row => !borradas.includes(row))
      alBorrar(table, borradas)
      return json(borradas.map(row => project(row, select)))
    }
    throw new Error(`Supabase falso: método no soportado ${method}`)
  }

  const writes = () => requests.filter(request => request.method !== 'GET' && !request.table.startsWith('rpc/'))
  return { handler, requests, external, writes, tablas }
}

// ---------------------------------------------------------------------------
// Datos: dos líneas activas y una inactiva; tres Zonas del Huila y una apagada
// ---------------------------------------------------------------------------
// Sustitutos óseos (líder LIDER_A): Neiva → Vacante Neiva (local), Garzón → Vacante Neiva (alcance 95), Pitalito → Sofía.
// Reemplazo articular (líder LIDER_B): Neiva → Vacante Neiva (local), Garzón → Ana (local), Pitalito → ajuste a la vacante.
// Beto vive en Neiva sin líneas; Luis está inactivo; Carla no tiene zona base; a Ana la dirección la limitó a Reemplazo.

const id = (prefix: string, n: number) => `${prefix}-0000-4000-8000-${String(n).padStart(12, '0')}`

const ADMIN = id('00000000', 1)
const LIDER_A = id('00000000', 2) // line_leader de Sustitutos óseos
const LIDER_B = id('00000000', 3) // line_leader de Reemplazo articular
const VISOR = id('00000000', 4) // viewer
const USUARIO = id('00000000', 5) // user
const RRHH = id('00000000', 6) // hr
const VENDEDOR = id('00000000', 7) // sales_manager enlazado a Sofía (lleva Sustitutos óseos)
const DIRECTORA = id('00000000', 8) // commercial_director

const LA = id('10000000', 1)
const LB = id('10000000', 2)
const LX = id('10000000', 3) // inactiva
const L_NADIE = id('10000000', 9) // no existe

const NEI = id('20000000', 1)
const GAR = id('20000000', 2)
const PIT = id('20000000', 3)
const APAGADA = id('20000000', 4)

const VACANTE = id('30000000', 1) // Vacante · Neiva (placeholder, Neiva): A y B
const ANA = id('30000000', 2) // Garzón: B (limitada a B)
const SOFIA = id('30000000', 3) // Pitalito: A
const BETO = id('30000000', 4) // Neiva: sin líneas
const LUIS = id('30000000', 5) // Neiva, inactivo
const CARLA = id('30000000', 6) // sin zona base
const E_NADIE = id('30000000', 9) // no existe

const H_NEI = id('40000000', 1)
const H_GAR = id('40000000', 2)
const H_PIT = id('40000000', 3)

const OVR_PIT_B = id('50000000', 1) // ajuste: Reemplazo articular × Pitalito → Vacante Neiva
const OVR_NADIE = id('50000000', 9)

function usuario(uid: string, role: string, nombre: string): Fila {
  return { id: uid, email: `${role}-${uid.slice(-4)}@prueba.test`, full_name: nombre, role, active: true, password: `hash-${uid}` }
}

let distanciaId = 0
function distancia(kam_id: string, hospital_id: string, minutos: number): Fila {
  return { id: ++distanciaId, kam_id, hospital_id, travel_time: minutos * 60 }
}

function datosIniciales(): Tablas {
  return {
    users: [
      usuario(ADMIN, 'admin', 'Admin'),
      usuario(LIDER_A, 'line_leader', 'Líder de Sustitutos óseos'),
      usuario(LIDER_B, 'line_leader', 'Líder de Reemplazo articular'),
      usuario(VISOR, 'viewer', 'Visor'),
      usuario(USUARIO, 'user', 'Usuario'),
      usuario(RRHH, 'hr', 'Recursos humanos'),
      usuario(VENDEDOR, 'sales_manager', 'Sofía Gómez'),
      usuario(DIRECTORA, 'commercial_director', 'Dirección comercial'),
    ],
    business_lines: [
      { id: LA, code: 'sustitutos', name: 'Sustitutos óseos', leader_user_id: LIDER_A, max_reach_minutes: 240, sort_order: 1, active: true },
      { id: LB, code: 'reemplazo', name: 'Reemplazo articular', leader_user_id: LIDER_B, max_reach_minutes: 240, sort_order: 2, active: true },
      { id: LX, code: 'legacy', name: 'Línea antigua', leader_user_id: null, max_reach_minutes: 240, sort_order: 3, active: false },
    ],
    kams: [
      { id: NEI, name: 'Neiva', area_id: '41001', base_city: 'Neiva', color: '#d62728', active: true },
      { id: GAR, name: 'Garzón', area_id: '41298', base_city: 'Garzón', color: '#1f77b4', active: true },
      { id: PIT, name: 'Pitalito', area_id: '41551', base_city: 'Pitalito', color: '#2ca02c', active: true },
      { id: APAGADA, name: 'Zona apagada', area_id: '41020', base_city: 'Algeciras', color: '#ff7f0e', active: false },
    ],
    executives: [
      { id: VACANTE, full_name: 'Vacante · Neiva', status: 'placeholder', base_kam_id: NEI, user_id: null, color: null },
      { id: ANA, full_name: 'Ana Ruiz', status: 'active', base_kam_id: GAR, user_id: null, color: null },
      { id: SOFIA, full_name: 'Sofía Gómez', status: 'active', base_kam_id: PIT, user_id: VENDEDOR, color: null },
      { id: BETO, full_name: 'Beto Pérez', status: 'active', base_kam_id: NEI, user_id: null, color: null },
      { id: LUIS, full_name: 'Luis Mora', status: 'inactive', base_kam_id: NEI, user_id: null, color: null },
      { id: CARLA, full_name: 'Carla Díaz', status: 'active', base_kam_id: null, user_id: null, color: null },
    ],
    executive_lines: [
      { executive_id: VACANTE, line_id: LA },
      { executive_id: VACANTE, line_id: LB },
      { executive_id: ANA, line_id: LB },
      { executive_id: SOFIA, line_id: LA },
      { executive_id: LUIS, line_id: LA },
      { executive_id: CARLA, line_id: LB },
    ],
    executive_allowed_lines: [{ executive_id: ANA, line_id: LB }],
    line_zones: [],
    coverage_overrides: [
      { id: OVR_PIT_B, line_id: LB, kam_id: PIT, executive_id: VACANTE, reason: 'Pitalito lo atiende la vacante', active: true, created_at: '2026-10-05T00:00:00.000Z' },
    ],
    coverage: [],
    hospitals: [
      { id: H_NEI, code: '891180008-1', name: 'Hospital de Neiva', municipality_id: '41001', locality_id: null, beds: 300, active: true },
      { id: H_GAR, code: '891180009-1', name: 'Hospital de Garzón', municipality_id: '41298', locality_id: null, beds: 80, active: true },
      { id: H_PIT, code: '891180010-1', name: 'Hospital de Pitalito', municipality_id: '41551', locality_id: null, beds: 120, active: true },
    ],
    hospital_kam_distances: [
      distancia(NEI, H_GAR, 95),
      distancia(NEI, H_PIT, 150),
      distancia(GAR, H_NEI, 95),
      distancia(GAR, H_PIT, 120),
      distancia(PIT, H_NEI, 150),
      distancia(PIT, H_GAR, 120),
    ],
    // Médicos que visita Sofía en Sustitutos óseos: dos vigentes (uno con dos filas no cuenta doble), uno ya cerrado;
    // y uno de la vacante que no debe tocarse.
    medico_visitantes: [
      { id: 'mv-1', medico_id: 'medico-1', executive_id: SOFIA, line_id: LA, municipality_id: '41551', desde: '2026-09-01', hasta: null, fin_motivo: null },
      { id: 'mv-2', medico_id: 'medico-2', executive_id: SOFIA, line_id: LA, municipality_id: '41551', desde: '2026-09-01', hasta: null, fin_motivo: null },
      { id: 'mv-3', medico_id: 'medico-2', executive_id: SOFIA, line_id: LA, municipality_id: '41001', desde: '2026-09-01', hasta: null, fin_motivo: null },
      { id: 'mv-4', medico_id: 'medico-3', executive_id: SOFIA, line_id: LA, municipality_id: null, desde: '2026-08-01', hasta: '2026-09-30', fin_motivo: 'manual' },
      { id: 'mv-5', medico_id: 'medico-4', executive_id: VACANTE, line_id: LA, municipality_id: null, desde: '2026-09-01', hasta: null, fin_motivo: null },
    ],
  }
}

// Solo executive_lines (la ruta) y coverage (recomputeAndSaveCoverage) se escriben.
const ESCRIBIBLES = new Set(['executive_lines', 'coverage'])

const fake = fakeSupabase(datosIniciales(), ESCRIBIBLES)
fetchHandler = fake.handler

function cookie(userId: string | null): Record<string, string> {
  if (!userId) return {}
  return { cookie: `${SESSION_COOKIE_NAME}=${encodeURIComponent(signSession(userId, passwordVersion(`hash-${userId}`)))}` }
}

interface Resultado {
  status: number
  body: any
  text: string
  requests: FakeRequest[]
}

async function leer(response: Response, antes: number): Promise<Resultado> {
  const text = await response.text()
  let body: any = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = text
  }
  return { status: response.status, body, text, requests: fake.requests.slice(antes) }
}

async function dar(userId: string | null, executiveId: string, lineId: string): Promise<Resultado> {
  const antes = fake.requests.length
  const request = new NextRequest(`http://localhost:3000/api/executives/${executiveId}/lineas/${lineId}`, { method: 'PUT', headers: cookie(userId) })
  return leer(await darLinea(request, { params: { id: executiveId, lineId } }), antes)
}

async function quitar(userId: string | null, executiveId: string, lineId: string): Promise<Resultado> {
  const antes = fake.requests.length
  const request = new NextRequest(`http://localhost:3000/api/executives/${executiveId}/lineas/${lineId}`, { method: 'DELETE', headers: cookie(userId) })
  return leer(await quitarLinea(request, { params: { id: executiveId, lineId } }), antes)
}

async function previsualizar(userId: string | null, payload: unknown): Promise<Resultado> {
  const antes = fake.requests.length
  const request = new NextRequest('http://localhost:3000/api/coverage/simular', {
    method: 'POST',
    headers: { ...cookie(userId), 'content-type': 'application/json' },
    body: payload === undefined ? undefined : typeof payload === 'string' ? payload : JSON.stringify(payload),
  })
  return leer(await simular(request), antes)
}

const escrituras = (requests: FakeRequest[]) => requests.filter(request => request.method !== 'GET').map(request => `${request.method} ${request.table}`)
const resumenDiff = (body: SimularResponse) =>
  body.diff.map(celda => `${celda.line_code}/${celda.zona}: ${celda.antesEstado}(${celda.antesNombre ?? '-'}) → ${celda.despuesEstado}(${celda.despuesNombre ?? '-'})`)
const celdaGuardada = (lineId: string, kamId: string) => fake.tablas.coverage.find(row => row.line_id === lineId && row.kam_id === kamId)
const filasLinea = (executiveId: string, lineId: string) => fake.tablas.executive_lines.filter(row => row.executive_id === executiveId && row.line_id === lineId).length

// ---------------------------------------------------------------------------
// Pruebas
// ---------------------------------------------------------------------------

async function main() {
  print('\nPOST /api/coverage/simular · vista previa sin escribir')
  {
    const r = await previsualizar(LIDER_A, { cambios: [{ tipo: 'linea_agregar', executive_id: BETO, line_id: LA }] })
    const body = r.body as SimularResponse
    check('200', r.status === 200, r.body)
    eq('diff con nombres: Garzón pasa de la vacante a Beto por alcance (empate a 95, orden alfabético); Neiva entra en conflicto', resumenDiff(body), [
      'sustitutos/Garzón: alcance(Vacante · Neiva) → alcance(Beto Pérez)',
      'sustitutos/Neiva: reservada(Vacante · Neiva) → conflicto(-)',
    ])
    eq('cada celda trae kind y persona antes y después', body.diff.map(celda => [celda.antes.kind, celda.antes.executive_id, celda.despues.kind, celda.despues.executive_id, celda.line_name]), [
      ['reach', VACANTE, 'reach', BETO, 'Sustitutos óseos'],
      ['local', VACANTE, 'conflict', null, 'Sustitutos óseos'],
    ])
    eq('resumen DESPUÉS del cambio, solo de su línea', body.resumen, { sustitutos: { ocupada: 1, reservada: 0, alcance: 1, sin_cobertura: 0, conflicto: 1 } })
    eq('dar una línea: nadie pierde visitante (lista vacía) y no lee medico_visitantes', [body.medicosQuePierdenVisitante, r.requests.some(request => request.table === 'medico_visitantes')], [[], false])
    eq('no escribe nada', escrituras(r.requests), [])

    const ajena = await previsualizar(LIDER_A, { cambios: [{ tipo: 'linea_agregar', executive_id: BETO, line_id: LB }] })
    check('un cambio de otra línea: 403', ajena.status === 403, ajena.body)
    const quitarAjena = await previsualizar(LIDER_A, { cambios: [{ tipo: 'linea_quitar', executive_id: ANA, line_id: LB }] })
    check('quitar en otra línea: 403 sin contar médicos', quitarAjena.status === 403 && !quitarAjena.requests.some(request => request.table === 'medico_visitantes'), quitarAjena.body)
    const ajusteAjeno = await previsualizar(LIDER_A, { cambios: [{ tipo: 'quitar_ajuste', override_id: OVR_PIT_B }] })
    check('quitar un ajuste de otra línea: 403 (la línea es la del ajuste)', ajusteAjeno.status === 403, ajusteAjeno.body)
    const sinAjuste = await previsualizar(LIDER_B, { cambios: [{ tipo: 'quitar_ajuste', override_id: OVR_NADIE }] })
    check('quitar un ajuste que no existe: 400', sinAjuste.status === 400, sinAjuste.body)

    const propio = await previsualizar(LIDER_B, { cambios: [{ tipo: 'quitar_ajuste', override_id: OVR_PIT_B }] })
    eq('la líder de Reemplazo quita el ajuste de Pitalito: la vacante (reservada) deja paso a Ana por alcance', [propio.status, resumenDiff(propio.body)], [200, ['reemplazo/Pitalito: reservada(Vacante · Neiva) → alcance(Ana Ruiz)']])
    eq('su resumen: Garzón ocupada, Neiva reservada, Pitalito por alcance', propio.body.resumen, { reemplazo: { ocupada: 1, reservada: 1, alcance: 1, sin_cobertura: 0, conflicto: 0 } })

    const ambos = await previsualizar(ADMIN, { cambios: [{ tipo: 'linea_agregar', executive_id: BETO, line_id: LA }, { tipo: 'quitar_ajuste', override_id: OVR_PIT_B }] })
    eq('admin: las dos líneas, diff en orden de línea y Zona, resumen de ambas', [ambos.status, resumenDiff(ambos.body), Object.keys(ambos.body.resumen)], [
      200,
      ['sustitutos/Garzón: alcance(Vacante · Neiva) → alcance(Beto Pérez)', 'sustitutos/Neiva: reservada(Vacante · Neiva) → conflicto(-)', 'reemplazo/Pitalito: reservada(Vacante · Neiva) → alcance(Ana Ruiz)'],
      ['sustitutos', 'reemplazo'],
    ])
    const nada = await previsualizar(ADMIN, { cambios: [{ tipo: 'linea_quitar', executive_id: BETO, line_id: LA }] })
    eq('un cambio que no cambia nada: diff vacío', [nada.status, nada.body.diff], [200, []])
    eq('quitar una línea que no lleva: 0 médicos sin leer medico_visitantes (el disparador no correría)', [nada.body.medicosQuePierdenVisitante, nada.requests.some(request => request.table === 'medico_visitantes')], [
      [{ executive_id: BETO, line_id: LA, medicos: 0 }],
      false,
    ])
    const ajuste = await previsualizar(LIDER_A, { cambios: [{ tipo: 'ajuste', line_id: LA, kam_id: GAR, executive_id: SOFIA }] })
    eq('forzar a Sofía en Garzón: ocupada por ajuste (antes la vacante por alcance)', [ajuste.status, resumenDiff(ajuste.body)], [200, ['sustitutos/Garzón: alcance(Vacante · Neiva) → ocupada(Sofía Gómez)']])

    const vendedora = await previsualizar(VENDEDOR, { cambios: [{ tipo: 'linea_quitar', executive_id: SOFIA, line_id: LA }] })
    eq('sales_manager que lleva la línea: puede ver la vista previa de su línea (Pitalito queda por alcance de la vacante)', [vendedora.status, resumenDiff(vendedora.body)], [200, ['sustitutos/Pitalito: ocupada(Sofía Gómez) → alcance(Vacante · Neiva)']])
    eq('quitarle Sustitutos óseos a Sofía: la vista previa cuenta los 2 médicos que perderían visitante (dos filas del mismo médico cuentan una; la cerrada no) y no escribe', [vendedora.body.medicosQuePierdenVisitante, escrituras(vendedora.requests)], [
      [{ executive_id: SOFIA, line_id: LA, medicos: 2 }],
      [],
    ])
    const repetido = await previsualizar(LIDER_A, { cambios: [{ tipo: 'linea_quitar', executive_id: SOFIA, line_id: LA }, { tipo: 'linea_quitar', executive_id: SOFIA, line_id: LA }, { tipo: 'linea_agregar', executive_id: BETO, line_id: LA }] })
    eq('el mismo quitar dos veces cuenta una sola vez; el agregar no suma', repetido.body.medicosQuePierdenVisitante, [{ executive_id: SOFIA, line_id: LA, medicos: 2 }])
    {
      // Sin la migración 0800 (tabla medico_visitantes ausente): 0, nunca 500
      const visitantes = fake.tablas.medico_visitantes
      delete fake.tablas.medico_visitantes
      const sinTabla = await previsualizar(LIDER_A, { cambios: [{ tipo: 'linea_quitar', executive_id: SOFIA, line_id: LA }] })
      fake.tablas.medico_visitantes = visitantes
      eq('sin la tabla medico_visitantes: 200 y 0 médicos', [sinTabla.status, sinTabla.body.medicosQuePierdenVisitante], [200, [{ executive_id: SOFIA, line_id: LA, medicos: 0 }]])
    }
    const vendedoraAjena = await previsualizar(VENDEDOR, { cambios: [{ tipo: 'linea_agregar', executive_id: SOFIA, line_id: LB }] })
    check('sales_manager en una línea que no lleva: 403', vendedoraAjena.status === 403, vendedoraAjena.body)
    const sinLineas = await previsualizar(USUARIO, { cambios: [{ tipo: 'linea_agregar', executive_id: BETO, line_id: LA }] })
    check('user sin líneas: 403', sinLineas.status === 403, sinLineas.body)
    const sinSesion = await previsualizar(null, { cambios: [{ tipo: 'linea_agregar', executive_id: BETO, line_id: LA }] })
    check('sin sesión: 401', sinSesion.status === 401, sinSesion.body)

    const muchos = await previsualizar(ADMIN, { cambios: Array.from({ length: 21 }, () => ({ tipo: 'linea_agregar', executive_id: BETO, line_id: LA })) })
    eq('21 cambios: 400 con el tope', [muchos.status, muchos.body?.error], [400, 'Máximo 20 cambios por vista previa'])
    const veinte = await previsualizar(ADMIN, { cambios: Array.from({ length: 20 }, () => ({ tipo: 'linea_agregar', executive_id: BETO, line_id: LA })) })
    check('20 cambios: 200', veinte.status === 200, veinte.body)
    const vacio = await previsualizar(ADMIN, { cambios: [] })
    check('sin cambios: 400', vacio.status === 400, vacio.body)
    const sinCuerpo = await previsualizar(ADMIN, 'esto no es json')
    check('cuerpo que no es JSON: 400', sinCuerpo.status === 400, sinCuerpo.body)
    const tipoRaro = await previsualizar(ADMIN, { cambios: [{ tipo: 'borrar_todo', executive_id: BETO, line_id: LA }] })
    eq('tipo de cambio desconocido: 400 en español', [tipoRaro.status, tipoRaro.body?.error], [400, 'Tipo de cambio no válido (linea_agregar, linea_quitar, ajuste o quitar_ajuste)'])
    const idRaro = await previsualizar(ADMIN, { cambios: [{ tipo: 'linea_agregar', executive_id: 'beto', line_id: LA }] })
    check('id que no es UUID: 400', idRaro.status === 400, idRaro.body)
    eq('ninguna vista previa escribió nada', fake.writes().length, 0)
  }

  print('\nPUT /api/executives/[id]/lineas/[lineId] · permisos')
  {
    const ajena = await dar(LIDER_A, BETO, LB)
    eq('la líder en una línea que no lidera: 403', [ajena.status, ajena.body?.error], [403, 'Solo puedes asignar la línea que lideras'])
    for (const [quien, uid] of [['viewer', VISOR], ['user', USUARIO], ['hr', RRHH], ['sales_manager', VENDEDOR]] as const) {
      const r = await dar(uid, BETO, LA)
      check(`${quien}: 403 (sin executives:lines)`, r.status === 403 && r.requests.every(request => request.table === 'users'), { status: r.status, tablas: r.requests.map(request => request.table) })
    }
    const sinSesion = await dar(null, BETO, LA)
    check('sin sesión: 401', sinSesion.status === 401, sinSesion.body)
    eq('nada escrito todavía', fake.writes().length, 0)
  }

  print('\nPUT · darle Sustitutos óseos a Beto (vive en Neiva)')
  {
    const r = await dar(LIDER_A, BETO, LA)
    const body = r.body as LineaEjecutivoResponse
    check('200', r.status === 200, r.body)
    eq('respuesta: ejecutivo con sus líneas por código, 0 médicos, cobertura recalculada', body, { ejecutivo: { id: BETO, nombre: 'Beto Pérez', status: 'active', lineas: ['sustitutos'] }, medicosTerminados: 0, cobertura: { recalculada: true } })
    eq('escribe la fila y recalcula la cobertura (upsert + limpieza), nada más', escrituras(r.requests), ['POST executive_lines', 'POST coverage', 'DELETE coverage'])
    eq('la cobertura guardada ya refleja el cambio: Neiva en conflicto; Garzón de Beto por alcance', [celdaGuardada(LA, NEI)?.kind, celdaGuardada(LA, GAR)?.kind, celdaGuardada(LA, GAR)?.executive_id, fake.tablas.coverage.length], ['conflict', 'reach', BETO, 6])

    const otraVez = await dar(LIDER_A, BETO, LA)
    eq('repetir es idempotente: 200, una sola fila, sin volver a insertar', [otraVez.status, filasLinea(BETO, LA), escrituras(otraVez.requests).includes('POST executive_lines')], [200, 1, false])
  }

  print('\nPUT · validaciones')
  {
    const inactivo = await dar(LIDER_A, LUIS, LA)
    eq('ejecutivo inactivo: 400', [inactivo.status, inactivo.body?.error], [400, 'El Ejecutivo Comercial está inactivo: ya no está'])
    const sinZona = await dar(LIDER_A, CARLA, LA)
    eq('sin zona base: 400', [sinZona.status, sinZona.body?.error], [400, 'El Ejecutivo Comercial no tiene zona base'])
    const nadie = await dar(LIDER_A, E_NADIE, LA)
    check('ejecutivo que no existe: 404', nadie.status === 404, nadie.body)
    const lineaInactiva = await dar(ADMIN, BETO, LX)
    eq('línea inactiva: 400', [lineaInactiva.status, lineaInactiva.body?.error], [400, 'La línea está inactiva'])
    const lineaNadie = await dar(ADMIN, BETO, L_NADIE)
    check('línea que no existe: 404', lineaNadie.status === 404, lineaNadie.body)
    const lineaInactivaLider = await dar(LIDER_A, BETO, LX)
    check('la líder en la línea inactiva (no la lidera): 403', lineaInactivaLider.status === 403, lineaInactivaLider.body)
    const idMalo = await dar(ADMIN, 'beto', LA)
    const lineaMala = await dar(ADMIN, BETO, 'sustitutos')
    eq('ids que no son UUID: 400', [idMalo.status, lineaMala.status], [400, 400])
    eq('ninguna de estas escribió', fake.writes().filter(request => request.table === 'executive_lines').length, 1)
  }

  print('\nPUT · líneas permitidas por la dirección')
  {
    const r = await dar(LIDER_A, ANA, LA)
    eq('Ana está limitada a Reemplazo articular: 409 con el mensaje y lineasPermitidas por código', [r.status, r.body?.error, r.body?.lineasPermitidas], [
      409, 'La dirección limitó a Ana Ruiz a: Reemplazo articular', ['reemplazo'],
    ])
    eq('no escribe', escrituras(r.requests), [])
    const permitida = await dar(ADMIN, ANA, LB)
    eq('darle la permitida (ya la tiene): 200 idempotente', [permitida.status, (permitida.body as LineaEjecutivoResponse).ejecutivo.lineas], [200, ['reemplazo']])
    const vacante = await dar(DIRECTORA, VACANTE, LA)
    eq('la dirección le da a una vacante (placeholder) una línea que ya lleva: 200', [vacante.status, (vacante.body as LineaEjecutivoResponse).ejecutivo], [200, { id: VACANTE, nombre: 'Vacante · Neiva', status: 'placeholder', lineas: ['sustitutos', 'reemplazo'] }])
  }

  print('\nDELETE /api/executives/[id]/lineas/[lineId] · quitarle Sustitutos óseos a Sofía')
  {
    const ajena = await quitar(LIDER_B, SOFIA, LA)
    check('la líder de otra línea: 403', ajena.status === 403, ajena.body)
    const r = await quitar(LIDER_A, SOFIA, LA)
    const body = r.body as LineaEjecutivoResponse
    check('200', r.status === 200, r.body)
    eq('dos médicos pierden visitante (dos filas del mismo médico cuentan una; la cerrada no cuenta); Sofía queda sin líneas', body, { ejecutivo: { id: SOFIA, nombre: 'Sofía Gómez', status: 'active', lineas: [] }, medicosTerminados: 2, cobertura: { recalculada: true } })
    eq('borra la fila y recalcula', escrituras(r.requests), ['DELETE executive_lines', 'POST coverage', 'DELETE coverage'])
    eq('el disparador cerró sus visitantes de esa línea y no tocó el de la vacante', fake.tablas.medico_visitantes.map(row => [row.id, row.hasta === null ? null : 'cerrado']), [
      ['mv-1', 'cerrado'], ['mv-2', 'cerrado'], ['mv-3', 'cerrado'], ['mv-4', 'cerrado'], ['mv-5', null],
    ])
    eq('la cobertura guardada: Pitalito pasa a Beto por alcance (empate a 150 con la vacante, orden alfabético)', [celdaGuardada(LA, PIT)?.kind, celdaGuardada(LA, PIT)?.executive_id], ['reach', BETO])
    const otraVez = await quitar(LIDER_A, SOFIA, LA)
    eq('repetir: 200 y 0 médicos (ya no llevaba la línea)', [otraVez.status, (otraVez.body as LineaEjecutivoResponse).medicosTerminados], [200, 0])
    const inactivo = await quitar(ADMIN, LUIS, LA)
    check('quitarle a un inactivo: 400', inactivo.status === 400, inactivo.body)
  }

  print('\nGenerales')
  {
    check('las escrituras solo tocan executive_lines y coverage', fake.writes().every(request => request.table === 'executive_lines' || request.table === 'coverage'), fake.writes().map(request => `${request.method} ${request.table}`))
    check('ninguna petición salió del Supabase falso (nada de Google)', fake.external.length === 0, fake.external)
  }

  print(`\n${passed} pruebas pasaron, ${failed} fallaron`)
  if (failed > 0) process.exit(1)
}

main().catch(error => {
  print(`FALLA inesperada: ${error instanceof Error ? error.stack : String(error)}`)
  if (moduleLogs.length > 0) print(`últimos mensajes: ${moduleLogs.slice(-5).join(' | ')}`)
  process.exit(1)
})
