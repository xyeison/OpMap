/**
 * Líneas permitidas (restricción de la dirección, tabla executive_allowed_lines de la migración 0860) · pruebas de
 * GET y POST /api/executives y PATCH /api/executives/[id] (SIN RED, sin Supabase real, sin Google).
 *
 * Llama a los handlers reales contra un Supabase FALSO en memoria (PostgREST mínimo con lectura y escritura: eq/neq/
 * in/is/not/gte/lte/ilike, orden, rango, insert, upsert con on_conflict, update, delete; las tablas que no se sembraron
 * responden "no existe", como una migración sin aplicar) y comprueba la regla del dueño del 2026-10-23 ("esta persona
 * nada más puede tener estas unidades de negocio, de forma restrictiva, para que no puedan asignarle por error"):
 *   - GET trae lineas_permitidas (ids de business_lines) o null = sin restricción.
 *   - PATCH con lines fuera de la restricción → 400 "Las líneas asignadas deben estar entre las permitidas"; nada se
 *     escribe. Dentro de la restricción → 200.
 *   - PATCH que fija la restricción (filas con created_by = quien lo pide, sin pisar las que ya estaban), que la
 *     encoge, y que la quita con null o [] (0 filas). Fijar restricción y líneas en el mismo PATCH se valida sobre el
 *     estado final. Cambiar solo la restricción no recalcula la cobertura.
 *   - POST con lineas_permitidas: 400 si lines no cabe; 201 con la restricción guardada.
 *   - Permisos: executives:edit sigue mandando (data_manager y admin pueden; line_leader y viewer reciben 403 sin
 *     escribir nada).
 *   - Tabla ausente (0860 sin aplicar): GET responde lineas_permitidas = null sin 500 y editar sigue funcionando; fijar
 *     una restricción responde un error claro sin tocar la ejecutiva; quitarla es un no-op.
 *
 * El patrón del Supabase falso viene de scripts/zona-estadisticas-api-check.ts (lectura) y terceros-api-check.ts
 * (escritura). Uso (desde web/): npx tsx scripts/lineas-permitidas-api-check.ts   Código de salida 1 si algo falla.
 */
import { randomUUID } from 'node:crypto'
import { NextRequest } from 'next/server'
import { passwordVersion, SESSION_COOKIE_NAME, signSession } from '../lib/session'
import type { Executive, ExecutivesResponse } from '../lib/types/lines'
import { GET as listarEjecutivos, POST as crearEjecutivo } from '../app/api/executives/route'
import { PATCH as editarEjecutivo } from '../app/api/executives/[id]/route'

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
process.env.SESSION_SECRET = 'secreto-de-prueba-lineas-permitidas-api-check-0123456789abcdefghijklmnop'

// Despachador único: sin manejador cualquier fetch falla; con él, solo responde el Supabase falso.
type FetchHandler = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
let fetchHandler: FetchHandler | null = null
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  if (!fetchHandler) throw new Error('lineas-permitidas-api-check: la red está prohibida en estas pruebas')
  return fetchHandler(input, init)
}) as typeof fetch

// Los console.error de las rutas (p. ej. el recálculo de cobertura contra el falso) se recogen aquí.
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
// Supabase FALSO con lectura y escritura
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

/** Llaves primarias de las tablas N:M, para devolver 23505 en un insert repetido sin upsert. */
const CLAVES: Record<string, string[]> = {
  executive_lines: ['executive_id', 'line_id'],
  executive_allowed_lines: ['executive_id', 'line_id'],
  coverage: ['line_id', 'kam_id'],
}
/** Tablas con columna id que el falso rellena si el insert no la trae. */
const CON_ID = new Set(['executives', 'coverage', 'coverage_overrides', 'users', 'kams', 'business_lines'])

function likeToRegExp(pattern: string, flags: string): RegExp {
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.')
  return new RegExp(`^${escaped}$`, flags)
}

function matchesOne(value: string, raw: string): boolean {
  if (raw.startsWith('not.')) return !matchesOne(value, raw.slice(4))
  if (raw.startsWith('eq.')) return value === raw.slice(3)
  if (raw.startsWith('neq.')) return value !== raw.slice(4)
  if (raw.startsWith('in.(') && raw.endsWith(')')) {
    const options = raw.slice(4, -1).split(',').map(option => option.replace(/^"|"$/g, ''))
    return options.includes(value)
  }
  if (raw === 'is.null') return value === 'null'
  if (raw === 'is.true') return value === 'true'
  if (raw === 'is.false') return value === 'false'
  if (raw.startsWith('ilike.')) return value !== 'null' && likeToRegExp(raw.slice(6).replace(/\\(.)/g, '$1'), 'i').test(value)
  if (raw.startsWith('like.')) return value !== 'null' && likeToRegExp(raw.slice(5).replace(/\\(.)/g, '$1'), '').test(value)
  if (/^(gte|lte|gt|lt)\./.test(raw)) {
    const [op, ...rest] = raw.split('.')
    const target = rest.join('.')
    if (value === 'null') return false
    if (op === 'gte') return value >= target
    if (op === 'lte') return value <= target
    if (op === 'gt') return value > target
    return value < target
  }
  throw new Error(`Supabase falso: filtro no soportado ${raw}`)
}

function matchesFilters(row: Fila, params: URLSearchParams): boolean {
  for (const [key, raw] of Array.from(params.entries())) {
    if (POSTGREST_CONTROL_PARAMS.has(key)) continue
    const value = row[key] === null || row[key] === undefined ? 'null' : String(row[key])
    if (!matchesOne(value, raw)) return false
  }
  return true
}

function compareValues(a: unknown, b: unknown): number {
  if (a === b) return 0
  if (a === null || a === undefined) return 1
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

function fakeSupabase(tablas: Tablas) {
  const requests: FakeRequest[] = []
  const external: string[] = []
  const json = (payload: unknown, status = 200) => new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json' } })
  const pgError = (code: string, message: string, status: number) => json({ code, message, details: null, hint: null }, status)

  const handler: FetchHandler = async (input, init) => {
    const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const url = new URL(href)
    if (url.origin !== FAKE_SUPABASE_URL) {
      external.push(url.origin)
      throw new Error(`lineas-permitidas-api-check: intento de red a ${url.origin}`)
    }
    const method = (init?.method || 'GET').toUpperCase()
    const table = url.pathname.replace('/rest/v1/', '')
    const body = init?.body ? JSON.parse(String(init.body)) : undefined
    requests.push({ method, table, params: url.searchParams, body })
    const headers = new Headers(init?.headers)
    const prefer = headers.get('prefer') || ''
    const select = url.searchParams.get('select')

    if (table.startsWith('rpc/')) return pgError('PGRST202', `Could not find the function public.${table.slice(4)}`, 404)
    if (!(table in tablas)) return pgError('PGRST205', `Could not find the table 'public.${table}' in the schema cache`, 404)
    const store = tablas[table]

    let rows: Fila[]
    if (method === 'GET') {
      rows = store.filter(row => matchesFilters(row, url.searchParams))
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
    } else if (method === 'POST') {
      const nuevas: Fila[] = (Array.isArray(body) ? body : [body]).map((row: Fila): Fila => ({
        ...(CON_ID.has(table) ? { id: randomUUID() } : {}),
        created_at: '2026-10-23T12:00:00.000Z',
        ...row,
      }))
      const conflicto = (url.searchParams.get('on_conflict') || '').split(',').map(part => part.trim()).filter(Boolean)
      const merge = prefer.includes('resolution=merge-duplicates')
      const claves = conflicto.length > 0 ? conflicto : CLAVES[table] || ['id']
      for (const nueva of nuevas) {
        const existente = store.find(row => claves.every(key => String(row[key]) === String(nueva[key])))
        if (existente) {
          if (!merge) return pgError('23505', `duplicate key value violates unique constraint "${table}_pkey"`, 409)
          Object.assign(existente, nueva)
        } else {
          store.push(nueva)
        }
      }
      rows = nuevas
    } else if (method === 'PATCH') {
      rows = store.filter(row => matchesFilters(row, url.searchParams))
      for (const row of rows) Object.assign(row, body)
    } else if (method === 'DELETE') {
      rows = store.filter(row => matchesFilters(row, url.searchParams))
      tablas[table] = store.filter(row => !rows.includes(row))
    } else {
      throw new Error(`Supabase falso: método no soportado ${method}`)
    }
    return json(rows.map(row => project(row, select)), method === 'POST' ? 201 : 200)
  }

  const writes = (desde = 0) => requests.slice(desde).filter(request => request.method !== 'GET')
  return { handler, requests, external, writes }
}

// ---------------------------------------------------------------------------
// Datos: 5 líneas, dos Zonas, una persona con restricción, una vacante sin restricción, una persona de Bogotá
// ---------------------------------------------------------------------------

const ADMIN = '00000000-0000-4000-8000-000000000001'
const DATOS = '00000000-0000-4000-8000-000000000002' // data_manager (executives:edit)
const LIDER = '00000000-0000-4000-8000-000000000003' // line_leader de Sustitutos óseos (sin executives:edit)
const VISOR = '00000000-0000-4000-8000-000000000004' // viewer (executives:view)

const L_PEROSSAL = '10000000-0000-4000-8000-000000000001'
const L_REEMPLAZO = '10000000-0000-4000-8000-000000000002'
const L_DEPORTIVA = '10000000-0000-4000-8000-000000000003'
const L_COLUMNA = '10000000-0000-4000-8000-000000000004'
const L_TRAUMA = '10000000-0000-4000-8000-000000000005'
const L_INEXISTENTE = '10000000-0000-4000-8000-0000000000ff'

const BAQ = '20000000-0000-4000-8000-000000000001'
const CHA = '20000000-0000-4000-8000-000000000002'

const PERSONA_BAQ = '30000000-0000-4000-8000-000000000001' // activa en Barranquilla: solo perossal y reemplazo
const VACANTE_BAQ = '30000000-0000-4000-8000-000000000002' // placeholder en Barranquilla: sin restricción al inicio
const PERSONA_CHA = '30000000-0000-4000-8000-000000000003' // activa en Chapinero: sin restricción

function usuario(id: string, role: string, nombre: string): Fila {
  return { id, email: `${role}@prueba.test`, full_name: nombre, role, active: true, password: `hash-${id}` }
}

function linea(id: string, code: string, name: string, sort_order: number, leader_user_id: string | null = null): Fila {
  return { id, code, name, leader_user_id, max_reach_minutes: 240, active: true, sort_order }
}

function persona(id: string, full_name: string, status: string, base_kam_id: string): Fila {
  return {
    id, full_name, email: null, company: 'VG Medical', status, base_kam_id, user_id: null, odoo_employee_id: null,
    notes: null, color: null, created_at: '2026-10-01T00:00:00.000Z', updated_at: null,
  }
}

function datosIniciales(): Tablas {
  return {
    users: [
      usuario(ADMIN, 'admin', 'Admin'),
      usuario(DATOS, 'data_manager', 'Datos'),
      usuario(LIDER, 'line_leader', 'Líder de Sustitutos óseos'),
      usuario(VISOR, 'viewer', 'Visor'),
    ],
    business_lines: [
      linea(L_PEROSSAL, 'perossal', 'Sustitutos óseos', 1, LIDER),
      linea(L_REEMPLAZO, 'reemplazo', 'Reemplazo articular', 2),
      linea(L_DEPORTIVA, 'deportiva', 'Medicina deportiva', 3),
      linea(L_COLUMNA, 'columna', 'Columna', 4),
      linea(L_TRAUMA, 'trauma', 'Trauma', 5),
    ],
    kams: [
      { id: BAQ, name: 'Barranquilla', base_city: 'Barranquilla', area_id: '08001', active: true, color: '#2563eb' },
      { id: CHA, name: 'Chapinero', base_city: 'Chapinero', area_id: '1100102', active: true, color: '#dc2626' },
    ],
    executives: [
      persona(PERSONA_BAQ, 'Persona Barranquilla', 'active', BAQ),
      persona(VACANTE_BAQ, 'Vacante · Barranquilla', 'placeholder', BAQ),
      persona(PERSONA_CHA, 'Persona Chapinero', 'active', CHA),
    ],
    executive_lines: [
      { executive_id: PERSONA_BAQ, line_id: L_PEROSSAL },
      { executive_id: PERSONA_BAQ, line_id: L_REEMPLAZO },
      { executive_id: PERSONA_CHA, line_id: L_COLUMNA },
    ],
    // Restricción inicial como la deja la migración 0870: la persona de Barranquilla solo perossal y reemplazo
    executive_allowed_lines: [
      { executive_id: PERSONA_BAQ, line_id: L_PEROSSAL, created_by: null, created_at: '2026-10-23T00:00:00.000Z' },
      { executive_id: PERSONA_BAQ, line_id: L_REEMPLAZO, created_by: null, created_at: '2026-10-23T00:00:00.000Z' },
    ],
    // Lo que lee el recálculo de cobertura cuando cambian las líneas (sin IPS: todo local o sin cobertura)
    hospitals: [],
    hospital_kam_distances: [],
    line_zones: [],
    coverage_overrides: [],
    coverage: [],
  }
}

const tablas = datosIniciales()
const fake = fakeSupabase(tablas)
fetchHandler = fake.handler

function apiRequest(path: string, options: { method?: string; body?: unknown; userId?: string } = {}) {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (options.userId) {
    headers.cookie = `${SESSION_COOKIE_NAME}=${encodeURIComponent(signSession(options.userId, passwordVersion(`hash-${options.userId}`)))}`
  }
  return new NextRequest(`http://localhost:3000${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  })
}

async function leer(response: Response): Promise<{ status: number; body: any }> {
  const text = await response.text()
  let body: any = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = text
  }
  return { status: response.status, body }
}

const listar = async (userId: string) => leer(await listarEjecutivos(apiRequest('/api/executives', { userId })))
const crear = async (userId: string, body: unknown) => leer(await crearEjecutivo(apiRequest('/api/executives', { method: 'POST', body, userId })))
const editar = async (userId: string, id: string, body: unknown) =>
  leer(await editarEjecutivo(apiRequest(`/api/executives/${id}`, { method: 'PATCH', body, userId }), { params: { id } }))

const ordenado = (ids: string[] | null | undefined) => (ids ? [...ids].sort() : ids)
const permitidasDe = (executiveId: string) => tablas.executive_allowed_lines.filter(row => row.executive_id === executiveId)
const buscar = (body: ExecutivesResponse, id: string): Executive | undefined => body.executives.find(executive => executive.id === id)
const escribioEn = (desde: number, table: string, method?: string) =>
  fake.writes(desde).some(request => request.table === table && (!method || request.method === method))

// ---------------------------------------------------------------------------
// Pruebas
// ---------------------------------------------------------------------------

async function main() {
  print('\nGET /api/executives: lineas_permitidas en la respuesta')
  {
    const r = await listar(ADMIN)
    const body = r.body as ExecutivesResponse
    check('admin: 200 con las tres personas', r.status === 200 && body.executives?.length === 3, r)
    eq('persona de Barranquilla: perossal y reemplazo', ordenado(buscar(body, PERSONA_BAQ)?.lineas_permitidas), [L_PEROSSAL, L_REEMPLAZO].sort())
    eq('vacante de Barranquilla: null (sin restricción)', buscar(body, VACANTE_BAQ)?.lineas_permitidas, null)
    eq('persona de Chapinero: null (sin restricción)', buscar(body, PERSONA_CHA)?.lineas_permitidas, null)
    eq('las líneas asignadas siguen igual', ordenado(buscar(body, PERSONA_BAQ)?.lines), [L_PEROSSAL, L_REEMPLAZO].sort())
    const visor = await listar(VISOR)
    check('viewer (executives:view): 200 y trae el campo', visor.status === 200 && 'lineas_permitidas' in (buscar(visor.body, PERSONA_BAQ) ?? {}), visor)
  }

  print('\nPATCH lines contra la restricción guardada (admin)')
  {
    const marca = fake.requests.length
    const r = await editar(ADMIN, PERSONA_BAQ, { lines: [L_PEROSSAL, L_COLUMNA] })
    check('columna no está permitida → 400', r.status === 400, r)
    eq('mensaje exacto', r.body?.error, 'Las líneas asignadas deben estar entre las permitidas')
    check('nada se escribió', fake.writes(marca).length === 0, fake.writes(marca).map(w => `${w.method} ${w.table}`))
    eq('las líneas siguen igual en la base', ordenado(tablas.executive_lines.filter(row => row.executive_id === PERSONA_BAQ).map(row => String(row.line_id))), [L_PEROSSAL, L_REEMPLAZO].sort())

    const dentro = await editar(ADMIN, PERSONA_BAQ, { lines: [L_PEROSSAL] })
    check('solo perossal (dentro de la restricción) → 200', dentro.status === 200, dentro)
    eq('queda con una línea', dentro.body?.executive?.lines, [L_PEROSSAL])
    eq('la restricción no cambia', ordenado(dentro.body?.executive?.lineas_permitidas), [L_PEROSSAL, L_REEMPLAZO].sort())
    check('cambiar líneas sí intenta recalcular la cobertura', 'cobertura_recalculada' in (dentro.body ?? {}), dentro.body)

    const libre = await editar(ADMIN, VACANTE_BAQ, { lines: [L_DEPORTIVA] })
    check('sin restricción, cualquier línea → 200', libre.status === 200 && libre.body?.executive?.lines?.[0] === L_DEPORTIVA, libre)
  }

  print('\nPATCH lineas_permitidas: fijar, encoger, quitar (admin)')
  {
    const marca = fake.requests.length
    const fijar = await editar(ADMIN, VACANTE_BAQ, { lineas_permitidas: [L_DEPORTIVA, L_COLUMNA, L_TRAUMA] })
    check('fijar deportiva, columna y trauma → 200', fijar.status === 200, fijar)
    eq('la respuesta trae la restricción', ordenado(fijar.body?.executive?.lineas_permitidas), [L_DEPORTIVA, L_COLUMNA, L_TRAUMA].sort())
    eq('tres filas en executive_allowed_lines con created_by = quien lo pidió', permitidasDe(VACANTE_BAQ).map(row => row.created_by), [ADMIN, ADMIN, ADMIN])
    check('solo la restricción: no recalcula la cobertura', !('cobertura_recalculada' in (fijar.body ?? {})) && !escribioEn(marca, 'coverage'), fijar.body)
    check('deja constancia en updated_at de la ejecutiva', escribioEn(marca, 'executives', 'PATCH'))

    const fuera = await editar(ADMIN, VACANTE_BAQ, { lines: [L_DEPORTIVA, L_PEROSSAL] })
    check('ahora perossal ya no cabe → 400', fuera.status === 400 && fuera.body?.error === 'Las líneas asignadas deben estar entre las permitidas', fuera)

    const marcaMixto = fake.requests.length
    const mixto = await editar(ADMIN, VACANTE_BAQ, { lineas_permitidas: [L_DEPORTIVA], lines: [L_DEPORTIVA, L_COLUMNA] })
    check('restricción y líneas en el mismo PATCH se validan sobre el estado final → 400', mixto.status === 400, mixto)
    check('y no se escribe nada a medias', fake.writes(marcaMixto).length === 0 && permitidasDe(VACANTE_BAQ).length === 3, fake.writes(marcaMixto).map(w => `${w.method} ${w.table}`))

    const marcaEncoger = fake.requests.length
    const encoger = await editar(ADMIN, VACANTE_BAQ, { lineas_permitidas: [L_DEPORTIVA, L_COLUMNA] })
    check('encoger a deportiva y columna → 200 (la línea asignada, deportiva, cabe)', encoger.status === 200, encoger)
    eq('quedan dos filas', ordenado(permitidasDe(VACANTE_BAQ).map(row => String(row.line_id))), [L_DEPORTIVA, L_COLUMNA].sort())
    check('solo se borró trauma: ningún insert, un delete', !escribioEn(marcaEncoger, 'executive_allowed_lines', 'POST') && escribioEn(marcaEncoger, 'executive_allowed_lines', 'DELETE'), fake.writes(marcaEncoger).map(w => `${w.method} ${w.table}`))

    const ambos = await editar(ADMIN, VACANTE_BAQ, { lineas_permitidas: [L_COLUMNA, L_TRAUMA], lines: [L_COLUMNA] })
    check('cambiar restricción y líneas a la vez, coherentes → 200', ambos.status === 200 && ambos.body?.executive?.lines?.[0] === L_COLUMNA, ambos)
    eq('restricción nueva guardada', ordenado(ambos.body?.executive?.lineas_permitidas), [L_COLUMNA, L_TRAUMA].sort())

    const quitar = await editar(ADMIN, VACANTE_BAQ, { lineas_permitidas: null })
    check('null quita la restricción → 200 y lineas_permitidas null', quitar.status === 200 && quitar.body?.executive?.lineas_permitidas === null, quitar)
    eq('cero filas', permitidasDe(VACANTE_BAQ).length, 0)

    const otraVez = await editar(ADMIN, VACANTE_BAQ, { lineas_permitidas: [L_COLUMNA] })
    const vacia = await editar(ADMIN, VACANTE_BAQ, { lineas_permitidas: [] })
    check('[] también la quita', otraVez.status === 200 && vacia.status === 200 && vacia.body?.executive?.lineas_permitidas === null && permitidasDe(VACANTE_BAQ).length === 0, vacia)

    const desconocida = await editar(ADMIN, VACANTE_BAQ, { lineas_permitidas: [L_INEXISTENTE] })
    check('línea permitida inexistente → 400', desconocida.status === 400 && /permitidas indicadas no existe/.test(desconocida.body?.error ?? ''), desconocida)
    const noLista = await editar(ADMIN, VACANTE_BAQ, { lineas_permitidas: 'columna' })
    check('lineas_permitidas que no es lista → 400 (zod)', noLista.status === 400, noLista)
    const noUuid = await editar(ADMIN, VACANTE_BAQ, { lineas_permitidas: ['no-es-uuid'] })
    check('id que no es uuid → 400 (zod)', noUuid.status === 400, noUuid)
    const repetidas = await editar(ADMIN, VACANTE_BAQ, { lineas_permitidas: [L_COLUMNA, L_COLUMNA.toUpperCase()] })
    check('ids repetidos o en mayúsculas se normalizan a uno', repetidas.status === 200 && repetidas.body?.executive?.lineas_permitidas?.length === 1, repetidas)
    await editar(ADMIN, VACANTE_BAQ, { lineas_permitidas: null })
  }

  print('\nPOST /api/executives con lineas_permitidas (admin)')
  {
    const marca = fake.requests.length
    const antes = tablas.executives.length
    const fuera = await crear(ADMIN, { full_name: 'Nueva Persona', base_kam_id: CHA, lines: [L_COLUMNA, L_TRAUMA], lineas_permitidas: [L_COLUMNA] })
    check('lines fuera de lineas_permitidas → 400 sin crear nada', fuera.status === 400 && fuera.body?.error === 'Las líneas asignadas deben estar entre las permitidas' && tablas.executives.length === antes && fake.writes(marca).length === 0, fuera)

    const ok = await crear(ADMIN, { full_name: 'Nueva Persona', base_kam_id: CHA, lines: [L_COLUMNA], lineas_permitidas: [L_COLUMNA] })
    check('dentro → 201 con la restricción', ok.status === 201 && JSON.stringify(ok.body?.executive?.lineas_permitidas) === JSON.stringify([L_COLUMNA]), ok)
    eq('fila con created_by = quien la creó', permitidasDe(ok.body?.executive?.id).map(row => row.created_by), [ADMIN])

    const libre = await crear(ADMIN, { full_name: 'Otra Persona', base_kam_id: CHA, lines: [], lineas_permitidas: null })
    check('lineas_permitidas null → 201 y null', libre.status === 201 && libre.body?.executive?.lineas_permitidas === null, libre)
  }

  print('\nPermisos: executives:edit sigue mandando')
  {
    const datos = await editar(DATOS, PERSONA_BAQ, { lineas_permitidas: [L_PEROSSAL, L_REEMPLAZO, L_COLUMNA] })
    check('data_manager puede fijar la restricción → 200', datos.status === 200, datos)
    eq('las filas nuevas llevan su created_by y las viejas conservan el suyo', permitidasDe(PERSONA_BAQ).map(row => row.created_by).sort(), [null, null, DATOS].sort())

    const marcaLider = fake.requests.length
    const lider = await editar(LIDER, PERSONA_BAQ, { lineas_permitidas: [L_PEROSSAL] })
    check('line_leader → 403 (no tiene executives:edit)', lider.status === 403, lider)
    check('y no leyó ni escribió nada más que su sesión', fake.requests.slice(marcaLider).every(request => request.table === 'users'), fake.requests.slice(marcaLider).map(r => `${r.method} ${r.table}`))
    const visor = await editar(VISOR, PERSONA_BAQ, { lineas_permitidas: [L_PEROSSAL] })
    check('viewer → 403', visor.status === 403, visor)
    const sinSesion = await editar('', PERSONA_BAQ, { lineas_permitidas: [L_PEROSSAL] })
    check('sin sesión → 401', sinSesion.status === 401, sinSesion)
  }

  print('\nTabla executive_allowed_lines ausente (migración 0860 sin aplicar)')
  {
    const respaldo = tablas.executive_allowed_lines
    delete tablas.executive_allowed_lines
    const r = await listar(ADMIN)
    const body = r.body as ExecutivesResponse
    check('GET → 200, sin 500', r.status === 200, r)
    check('todas con lineas_permitidas = null', body.executives?.every(executive => executive.lineas_permitidas === null), body.executives?.map(e => e.lineas_permitidas))

    const notas = await editar(ADMIN, PERSONA_BAQ, { notes: 'Sigue editable sin la tabla' })
    check('editar otros campos sigue funcionando → 200', notas.status === 200 && notas.body?.executive?.notes === 'Sigue editable sin la tabla', notas)
    const lineas = await editar(ADMIN, PERSONA_BAQ, { lines: [L_PEROSSAL, L_COLUMNA] })
    check('sin tabla no hay restricción que aplicar: cambiar líneas → 200', lineas.status === 200, lineas)

    const marca = fake.requests.length
    const fijar = await editar(ADMIN, VACANTE_BAQ, { lineas_permitidas: [L_DEPORTIVA] })
    check('fijar una restricción → error claro (no 200) y sin tocar la ejecutiva', fijar.status === 500 && /migración 0860/.test(fijar.body?.error ?? '') && fake.writes(marca).length === 0, fijar)
    const quitar = await editar(ADMIN, VACANTE_BAQ, { lineas_permitidas: null })
    check('quitar una restricción que no puede existir → 200 (no-op)', quitar.status === 200 && quitar.body?.executive?.lineas_permitidas === null, quitar)
    const antes = tablas.executives.length
    const crearConRestriccion = await crear(ADMIN, { full_name: 'Sin Tabla', base_kam_id: CHA, lines: [L_COLUMNA], lineas_permitidas: [L_COLUMNA] })
    check('POST con restricción → error claro sin crear la ejecutiva', crearConRestriccion.status === 500 && tablas.executives.length === antes, crearConRestriccion)
    tablas.executive_allowed_lines = respaldo
  }

  print('\nGenerales')
  {
    check('ninguna petición salió del Supabase falso', fake.external.length === 0, fake.external)
    check('ninguna petición a Google ni a otro origen en los mensajes', !moduleLogs.some(log => /googleapis|routes\.googleapis/i.test(log)), moduleLogs.slice(-3))
  }

  print(`\n${passed} pruebas pasaron, ${failed} fallaron`)
  if (failed > 0) process.exit(1)
}

main().catch(error => {
  print(`FALLA inesperada: ${error instanceof Error ? error.stack : String(error)}`)
  if (moduleLogs.length > 0) print(`últimos mensajes: ${moduleLogs.slice(-5).join(' | ')}`)
  process.exit(1)
})
