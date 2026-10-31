/**
 * Empresas y papeles (capa 1) · pruebas de la sesión y de lib/empresas.ts (SIN RED, sin Supabase real, sin Google).
 *
 * Llama a getUserFromRequest y a las funciones de lib/empresas.ts contra un Supabase FALSO en memoria (PostgREST
 * mínimo: eq/neq/in/is, orden, rango, insert y update; las tablas que no se sembraron responden "no existe", como la
 * 0960 sin aplicar) y comprueba:
 *   A. Sesión: el claim emp del token (solo uuid; los tokens viejos sin emp siguen valiendo); la sesión trae la
 *      empresa activa (manda users.empresa_activa_id, luego el claim, luego VG), los papeles de esa empresa y el
 *      papel más alto como role; sin papeles → 'user' sin empresa; sin la tabla papeles → users.role sin 500;
 *      cambiarEmpresaActiva escribe la columna solo si la persona tiene papel activo en esa empresa.
 *   B. Permisos: requirePermission y requireAnyPermission deciden por la SUMA de los papeles de la empresa activa
 *      (Paola: líder + ejecutiva concede campo:app y visits:report y niega executives:lines), mismos 401 y 403 de antes.
 *      Y lo que se decide DESPUÉS de la puerta también suma: GET /api/dias-libres (verTodos) y GET /api/me/lines
 *      (map:all-lines) con quien tiene dos papeles.
 *
 * El patrón del Supabase falso viene de scripts/lineas-permitidas-api-check.ts.
 * Uso (desde web/): npx tsx scripts/empresas-api-check.ts   Código de salida 1 si algo falla.
 */
import { createHmac, randomUUID } from 'node:crypto'
import { NextRequest } from 'next/server'
import { passwordVersion, SESSION_COOKIE_NAME, signSession, verifySession } from '../lib/session'
import { getUserFromRequest } from '../lib/auth-server'
import { cambiarEmpresaActiva } from '../lib/empresas'
import { requireAnyPermission, requirePermission } from '../lib/require-role'
import { EMPRESA_MEDIX_ID, EMPRESA_VG_ID } from '../lib/empresas-reglas'
import { GET as diasLibresGet } from '../app/api/dias-libres/route'
import { GET as meLinesGet } from '../app/api/me/lines/route'

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
const SECRETO = 'secreto-de-prueba-empresas-api-check-0123456789abcdefghijklmnopqrstuv'
process.env.SESSION_SECRET = SECRETO

// Despachador único: sin manejador cualquier fetch falla; con él, solo responde el Supabase falso.
type FetchHandler = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
let fetchHandler: FetchHandler | null = null
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  if (!fetchHandler) throw new Error('empresas-api-check: la red está prohibida en estas pruebas')
  return fetchHandler(input, init)
}) as typeof fetch

// Los console.error del código (p. ej. "Error obteniendo el usuario de la petición") se recogen aquí.
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
  papel_zonas: ['papel_id', 'kam_id'],
}
/** Tablas con columna id que el falso rellena si el insert no la trae. */
const CON_ID = new Set(['users', 'empresas', 'papeles'])

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

function fakeSupabase(tablas: Tablas, opciones: { codigoSinTabla?: '42P01' | 'PGRST205' } = {}) {
  const requests: FakeRequest[] = []
  const external: string[] = []
  const json = (payload: unknown, status = 200) => new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json' } })
  const pgError = (code: string, message: string, status: number) => json({ code, message, details: null, hint: null }, status)

  const handler: FetchHandler = async (input, init) => {
    const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const url = new URL(href)
    if (url.origin !== FAKE_SUPABASE_URL) {
      external.push(url.origin)
      throw new Error(`empresas-api-check: intento de red a ${url.origin}`)
    }
    const method = (init?.method || 'GET').toUpperCase()
    const table = url.pathname.replace('/rest/v1/', '')
    const body = init?.body ? JSON.parse(String(init.body)) : undefined
    requests.push({ method, table, params: url.searchParams, body })
    const headers = new Headers(init?.headers)
    const prefer = headers.get('prefer') || ''
    const select = url.searchParams.get('select')

    if (table.startsWith('rpc/')) return pgError('PGRST202', `Could not find the function public.${table.slice(4)}`, 404)
    if (!(table in tablas)) {
      return opciones.codigoSinTabla === '42P01'
        ? pgError('42P01', `relation "public.${table}" does not exist`, 404)
        : pgError('PGRST205', `Could not find the table 'public.${table}' in the schema cache`, 404)
    }
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
        created_at: '2026-10-31T12:00:00.000Z',
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
// Datos: VG y Medix; Paola (dos papeles en VG), Lizeth (uno en cada empresa), una persona con el papel de Medix
// inactivo y una sin papeles
// ---------------------------------------------------------------------------

const PAOLA = '00000000-0000-4000-8000-000000000001' // line_leader de Trauma y sales_manager, ambos en VG
const LIZETH = '00000000-0000-4000-8000-000000000002' // line_leader en Medix, sales_manager en VG; empresa activa Medix
const FOCO1 = '00000000-0000-4000-8000-000000000003' // sales_manager en VG, line_leader en Medix INACTIVO
const SIN_PAPELES = '00000000-0000-4000-8000-000000000004' // activa, sin ningún papel
const MIXTO = '00000000-0000-4000-8000-000000000005' // sales_manager + hr en VG: daysoff:approve solo lo da hr, y el más alto es sales_manager
const GERENTE_VIEWER = '00000000-0000-4000-8000-000000000006' // sales_manager + viewer en VG: map:all-lines solo lo da viewer

const L_TRAUMA = '10000000-0000-4000-8000-000000000005'
const KAM_BAQ = '20000000-0000-4000-8000-000000000001'

const P_PAOLA_LIDER = '40000000-0000-4000-8000-000000000001'
const P_PAOLA_GERENTE = '40000000-0000-4000-8000-000000000002'
const P_LIZETH_MEDIX = '40000000-0000-4000-8000-000000000003'
const P_LIZETH_VG = '40000000-0000-4000-8000-000000000004'
const P_FOCO1_VG = '40000000-0000-4000-8000-000000000005'
const P_FOCO1_MEDIX = '40000000-0000-4000-8000-000000000006'
const P_MIXTO_GERENTE = '40000000-0000-4000-8000-000000000007'
const P_MIXTO_RRHH = '40000000-0000-4000-8000-000000000008'
const P_GV_GERENTE = '40000000-0000-4000-8000-000000000009'
const P_GV_VIEWER = '40000000-0000-4000-8000-00000000000a'

function usuario(id: string, role: string, nombre: string, empresa_activa_id: string | null = null): Fila {
  return { id, email: `${id.slice(-4)}@prueba.test`, full_name: nombre, role, active: true, password: `hash-${id}`, empresa_activa_id }
}

function papel(id: string, user_id: string, empresa_id: string, rol: string, line_id: string | null = null, activo = true): Fila {
  return { id, user_id, empresa_id, papel: rol, line_id, activo, created_by: null, created_at: '2026-10-31T00:00:00.000Z' }
}

function empresa(id: string, codigo: string, nombre: string, nombre_corto: string): Fila {
  return { id, codigo, nombre, nombre_corto, nit: null, activa: true, odoo_url: null, created_at: '2026-10-31T00:00:00.000Z' }
}

function datosIniciales(): Tablas {
  return {
    users: [
      usuario(PAOLA, 'line_leader', 'Paola'),
      usuario(LIZETH, 'sales_manager', 'Lizeth', EMPRESA_MEDIX_ID),
      usuario(FOCO1, 'sales_manager', 'Foco uno'),
      usuario(SIN_PAPELES, 'viewer', 'Sin papeles'),
      usuario(MIXTO, 'sales_manager', 'Mixto'),
      usuario(GERENTE_VIEWER, 'sales_manager', 'Gerente y visor'),
    ],
    empresas: [empresa(EMPRESA_VG_ID, 'vg', 'VG Medical S.A.S.', 'VG Medical'), empresa(EMPRESA_MEDIX_ID, 'medix', 'Medix', 'Medix')],
    papeles: [
      papel(P_PAOLA_LIDER, PAOLA, EMPRESA_VG_ID, 'line_leader', L_TRAUMA),
      papel(P_PAOLA_GERENTE, PAOLA, EMPRESA_VG_ID, 'sales_manager'),
      papel(P_LIZETH_MEDIX, LIZETH, EMPRESA_MEDIX_ID, 'line_leader', L_TRAUMA),
      papel(P_LIZETH_VG, LIZETH, EMPRESA_VG_ID, 'sales_manager'),
      papel(P_FOCO1_VG, FOCO1, EMPRESA_VG_ID, 'sales_manager'),
      papel(P_FOCO1_MEDIX, FOCO1, EMPRESA_MEDIX_ID, 'line_leader', L_TRAUMA, false),
      papel(P_MIXTO_GERENTE, MIXTO, EMPRESA_VG_ID, 'sales_manager'),
      papel(P_MIXTO_RRHH, MIXTO, EMPRESA_VG_ID, 'hr'),
      papel(P_GV_GERENTE, GERENTE_VIEWER, EMPRESA_VG_ID, 'sales_manager'),
      papel(P_GV_VIEWER, GERENTE_VIEWER, EMPRESA_VG_ID, 'viewer'),
    ],
    papel_zonas: [{ papel_id: P_PAOLA_LIDER, kam_id: KAM_BAQ }],
    // Lo que leen las rutas de la prueba "después de la puerta" (días libres y /api/me/lines)
    business_lines: [{ id: L_TRAUMA, code: 'trauma', name: 'Trauma', leader_user_id: PAOLA, max_reach_minutes: 300, sort_order: 1, active: true }],
    executives: [],
    executive_lines: [],
    dias_libres: [],
    config_general: [], // vacía: rigen los valores de la semilla (aprueban: dirección comercial y RR. HH.)
  }
}

const tablas = datosIniciales()
const fake = fakeSupabase(tablas)
fetchHandler = fake.handler

function peticion(userId: string, emp?: string | null) {
  const token = signSession(userId, passwordVersion(`hash-${userId}`), emp)
  return new NextRequest('http://localhost:3000/api/auth/me', {
    headers: { cookie: `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}` },
  })
}

function payloadDe(token: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString('utf8'))
}

// ---------------------------------------------------------------------------
// Pruebas
// ---------------------------------------------------------------------------

async function main() {
  print('\nA. Sesión')

  print('\n  Token: claim emp')
  {
    const pv = passwordVersion(`hash-${PAOLA}`)
    eq('signSession con emp vg → verifySession trae emp vg', verifySession(signSession(PAOLA, pv, EMPRESA_VG_ID))?.emp, EMPRESA_VG_ID)
    eq('signSession sin emp → emp null', verifySession(signSession(PAOLA, pv))?.emp, null)
    const raro = signSession(PAOLA, pv, 'no-uuid')
    check("signSession con 'no-uuid' no escribe emp", !('emp' in payloadDe(raro)), payloadDe(raro))
    eq("y ese token es válido con emp null", verifySession(raro)?.emp, null)

    // Token firmado antes de esta tarea: payload {uid, pv, iat, exp} sin emp
    const iat = Math.floor(Date.now() / 1000)
    const body = Buffer.from(JSON.stringify({ uid: PAOLA, pv, iat, exp: iat + 3600 })).toString('base64url')
    const viejo = `${body}.${createHmac('sha256', SECRETO).update(body).digest('base64url')}`
    eq('un token viejo sin emp sigue válido', verifySession(viejo), { uid: PAOLA, pv, emp: null })
  }

  print('\n  getUserFromRequest: Paola (dos papeles en VG)')
  {
    const u = await getUserFromRequest(peticion(PAOLA))
    eq("role 'line_leader' (el más alto)", u?.role, 'line_leader')
    eq("empresa.codigo 'vg'", u?.empresa?.codigo, 'vg')
    eq('papeles.length 2', u?.papeles.length, 2)
    eq('empresas.length 1', u?.empresas.length, 1)
    eq('el papel de líder trae sus Zonas', u?.papeles.find(p => p.id === P_PAOLA_LIDER)?.kam_ids, [KAM_BAQ])
  }

  print('\n  Lizeth: empresa_activa_id Medix y cookie con emp VG (manda la columna)')
  {
    const u = await getUserFromRequest(peticion(LIZETH, EMPRESA_VG_ID))
    eq("empresa 'medix'", u?.empresa?.codigo, 'medix')
    eq('papeles = solo el de Medix', u?.papeles.map(p => p.id), [P_LIZETH_MEDIX])
    eq("role 'line_leader'", u?.role, 'line_leader')
    eq('empresas: las dos, por código', u?.empresas.map(e => e.codigo), ['medix', 'vg'])
  }

  print('\n  Foco 1: cookie con emp Medix y el papel de Medix inactivo')
  {
    const u = await getUserFromRequest(peticion(FOCO1, EMPRESA_MEDIX_ID))
    check('la sesión vale (no null)', u !== null, u)
    eq("empresa 'vg'", u?.empresa?.codigo, 'vg')
    eq("role 'sales_manager'", u?.role, 'sales_manager')
  }

  print('\n  Foco 2: usuario activo sin papeles')
  {
    const u = await getUserFromRequest(peticion(SIN_PAPELES))
    check('la sesión vale (no null)', u !== null, u)
    eq("role 'user'", u?.role, 'user')
    eq('empresa null', u?.empresa, null)
    eq('empresas []', u?.empresas, [])
    eq('papeles []', u?.papeles, [])
  }

  print('\n  Foco 3: sin la 0960 (sin la tabla papeles; el falso responde 42P01)')
  {
    // Como en la base real antes de la 0960: users sin la columna empresa_activa_id → ni se piden los papeles
    const sinColumna = (id: string, role: string, nombre: string) => {
      const { empresa_activa_id: _sinColumna, ...fila } = usuario(id, role, nombre)
      return fila
    }
    const antes: Tablas = { users: [sinColumna(PAOLA, 'line_leader', 'Paola'), sinColumna(SIN_PAPELES, 'viewer', 'Sin papeles')] }
    const fakeAntes = fakeSupabase(antes, { codigoSinTabla: '42P01' })
    fetchHandler = fakeAntes.handler
    const logs = moduleLogs.length
    const u = await getUserFromRequest(peticion(PAOLA))
    eq('role = users.role', u?.role, 'line_leader')
    eq('empresa null', u?.empresa, null)
    eq('un solo papel sintético con el rol', u?.papeles, [{ id: 'rol', empresa_id: '', papel: 'line_leader', line_id: null, kam_ids: [] }])
    const visor = await getUserFromRequest(peticion(SIN_PAPELES))
    eq("otro usuario: role 'viewer'", visor?.role, 'viewer')
    eq('solo se leyó users (como antes de las empresas)', fakeAntes.requests.map(r => r.table), ['users', 'users'])
    check('la sesión no trae la contraseña', u !== null && !('password' in u), u)

    // Con la columna pero sin la tabla papeles (42P01): cargarPapelesDeUsuario responde 'sin_tabla'
    const sinTabla: Tablas = { users: [usuario(PAOLA, 'line_leader', 'Paola')] }
    const fakeSinTabla = fakeSupabase(sinTabla, { codigoSinTabla: '42P01' })
    fetchHandler = fakeSinTabla.handler
    const conColumna = await getUserFromRequest(peticion(PAOLA))
    eq('con la columna y papeles en 42P01: role = users.role', conColumna?.role, 'line_leader')
    eq('y empresa null', conColumna?.empresa, null)
    check('sí preguntó por papeles', fakeSinTabla.requests.some(r => r.table === 'papeles'), fakeSinTabla.requests.map(r => r.table))
    check('sin console.error (no hubo 500)', moduleLogs.length === logs, moduleLogs.slice(logs))
    eq("cambiarEmpresaActiva sin la tabla → 'sin_papel'", await cambiarEmpresaActiva(PAOLA, EMPRESA_VG_ID), 'sin_papel')
    check('y no escribe nada', fakeSinTabla.writes().length === 0, fakeSinTabla.writes())
    fetchHandler = fake.handler
  }

  print('\n  cambiarEmpresaActiva')
  {
    const marca = fake.requests.length
    const r = await cambiarEmpresaActiva(LIZETH, EMPRESA_VG_ID)
    eq("Lizeth a VG → devuelve la empresa 'vg'", typeof r === 'string' ? r : r.codigo, 'vg')
    eq('escribe users.empresa_activa_id', tablas.users.find(u => u.id === LIZETH)?.empresa_activa_id, EMPRESA_VG_ID)
    check('una sola escritura, en users', fake.writes(marca).length === 1 && fake.writes(marca)[0].table === 'users', fake.writes(marca))
    const despues = await getUserFromRequest(peticion(LIZETH, EMPRESA_MEDIX_ID))
    eq("la sesión siguiente ya es de VG (manda la columna)", despues?.empresa?.codigo, 'vg')

    const marca2 = fake.requests.length
    eq("Paola a Medix (sin papel allí) → 'sin_papel'", await cambiarEmpresaActiva(PAOLA, EMPRESA_MEDIX_ID), 'sin_papel')
    eq("Foco 1 a Medix (papel inactivo) → 'sin_papel'", await cambiarEmpresaActiva(FOCO1, EMPRESA_MEDIX_ID), 'sin_papel')
    eq("una empresa que no existe → 'sin_papel'", await cambiarEmpresaActiva(PAOLA, randomUUID()), 'sin_papel')
    check('no escribe nada', fake.writes(marca2).length === 0, fake.writes(marca2))
    eq('la columna de Paola sigue null', tablas.users.find(u => u.id === PAOLA)?.empresa_activa_id, null)
  }

  print('\nB. Permisos')

  async function cuerpoDe(response: Response): Promise<unknown> {
    return response.json().catch(() => null)
  }

  print('\n  requirePermission: Paola (line_leader de Trauma + sales_manager en VG)')
  {
    const campo = await requirePermission(peticion(PAOLA), 'campo:app')
    check('campo:app (de la líder) se concede', campo.ok, campo.ok ? undefined : campo.response.status)
    eq('y la sesión que devuelve es la de Paola', campo.ok ? campo.user.id : null, PAOLA)
    const reporta = await requirePermission(peticion(PAOLA), 'visits:report')
    check('visits:report se concede', reporta.ok, reporta.ok ? undefined : reporta.response.status)
    const lineas = await requirePermission(peticion(PAOLA), 'executives:lines')
    check('executives:lines se niega', !lineas.ok)
    if (!lineas.ok) {
      eq('con 403', lineas.response.status, 403)
      eq('y el cuerpo de siempre', await cuerpoDe(lineas.response), { error: 'Acceso denegado' })
    }
  }

  print('\n  requirePermission: la suma de papeles (Mixto: sales_manager + hr; el más alto es sales_manager)')
  {
    const aprueba = await requirePermission(peticion(MIXTO), 'daysoff:approve')
    check('daysoff:approve solo lo da el papel de RR. HH. y se concede', aprueba.ok, aprueba.ok ? undefined : aprueba.response.status)
    eq("y su role sigue siendo el más alto: 'sales_manager'", aprueba.ok ? aprueba.user.role : null, 'sales_manager')
    const todos = await requireAnyPermission(peticion(MIXTO), ['calendar:manage', 'hospitals:edit'])
    check('requireAnyPermission también suma (calendar:manage de hr)', todos.ok, todos.ok ? undefined : todos.response.status)
    const nada = await requirePermission(peticion(MIXTO), 'hospitals:edit')
    check('y lo que ningún papel da se niega', !nada.ok)
  }

  print('\n  Después de la puerta también suma: GET /api/dias-libres (verTodos, daysoff:approve)')
  {
    const ejecutiva = randomUUID()
    const url = (usuarioId: string) => {
      const base = peticion(usuarioId)
      return new NextRequest(`http://localhost:3000/api/dias-libres?executive_id=${ejecutiva}`, { headers: base.headers })
    }
    const mixto = await diasLibresGet(url(MIXTO))
    eq('Mixto (gerente + RR. HH.) ve los días libres de todos: 200, no el 403 de "solo tus líneas"', mixto.status, 200)
    eq('y puede aprobar: su papel de RR. HH. está en `aprueban`, aunque el más alto sea gerente', ((await mixto.json()) as { puede_aprobar?: boolean }).puede_aprobar, true)
    const solo = await diasLibresGet(url(FOCO1))
    eq('un gerente a secas, de una ejecutiva que no es de sus líneas: 403 (daysoff:view no basta)', solo.status, 403)
  }

  print('\n  Después de la puerta también suma: GET /api/me/lines (map:all-lines, lib/coverage.ts)')
  {
    const conViewer = await meLinesGet(peticion(GERENTE_VIEWER))
    eq('gerente + visor: 200', conViewer.status, 200)
    const cuerpoViewer = (await cuerpoDe(conViewer)) as { canSeeAll?: boolean; lines?: { code: string; role: string }[] }
    eq('canSeeAll lo da el papel de visor (map:all-lines)', cuerpoViewer.canSeeAll, true)
    eq("y ve la línea como 'all'", cuerpoViewer.lines?.map(l => `${l.code}:${l.role}`), ['trauma:all'])
    const soloGerente = await meLinesGet(peticion(FOCO1))
    const cuerpoGerente = (await cuerpoDe(soloGerente)) as { canSeeAll?: boolean; lines?: unknown[] }
    eq('un gerente a secas no ve todas las líneas', cuerpoGerente.canSeeAll, false)
    eq('y sin ejecutiva enlazada ni líneas que lidere, ninguna', cuerpoGerente.lines, [])
  }

  print('\n  requirePermission: sin sesión y sin papeles')
  {
    const sinCookie = await requirePermission(new NextRequest('http://localhost:3000/api/auth/me'), 'map:view')
    check('sin cookie → no ok', !sinCookie.ok)
    if (!sinCookie.ok) {
      eq('con 401', sinCookie.response.status, 401)
      eq('y el cuerpo de siempre', await cuerpoDe(sinCookie.response), { error: 'No autorizado' })
    }
    const sinPapeles = await requirePermission(peticion(SIN_PAPELES), 'map:view')
    check('una persona activa sin papeles no tiene ni map:view', !sinPapeles.ok)
    if (!sinPapeles.ok) eq('→ 403', sinPapeles.response.status, 403)
  }

  print('\n  requireAnyPermission')
  {
    const gerente = await requireAnyPermission(peticion(FOCO1), ['intelligence:view', 'secop:procesos'])
    check('solo sales_manager: secop:procesos basta', gerente.ok, gerente.ok ? undefined : gerente.response.status)
    const gerenteSolo = await requireAnyPermission(peticion(FOCO1), ['intelligence:view'])
    check('solo sales_manager: intelligence:view solo, se niega', !gerenteSolo.ok)
    if (!gerenteSolo.ok) eq('→ 403', gerenteSolo.response.status, 403)
    const lider = await requireAnyPermission(peticion(PAOLA), ['executives:lines', 'campo:app'])
    check('Paola: concede si alguno de la lista lo tiene (campo:app)', lider.ok, lider.ok ? undefined : lider.response.status)
    const ninguno = await requireAnyPermission(peticion(PAOLA), ['executives:lines', 'users:manage'])
    check('Paola: ninguno de la lista → no ok', !ninguno.ok)
    if (!ninguno.ok) eq('→ 403', ninguno.response.status, 403)
    const vacia = await requireAnyPermission(peticion(PAOLA), [])
    check('lista vacía: siempre se niega', !vacia.ok)
    if (!vacia.ok) eq('→ 403', vacia.response.status, 403)
    const sinSesion = await requireAnyPermission(new NextRequest('http://localhost:3000/api/auth/me'), ['map:view'])
    check('sin sesión: 401', !sinSesion.ok && sinSesion.response.status === 401)
  }

  print('\n  Solo cuentan los papeles de la empresa ACTIVA (Lizeth: Medix activa = líder; VG = ejecutiva)')
  {
    // Lizeth quedó en VG por la prueba de cambiarEmpresaActiva; se la devuelve a Medix para esta comprobación
    await cambiarEmpresaActiva(LIZETH, EMPRESA_MEDIX_ID)
    const enMedix = await requirePermission(peticion(LIZETH), 'campo:app')
    check('en Medix (líder) tiene campo:app', enMedix.ok, enMedix.ok ? undefined : enMedix.response.status)
    await cambiarEmpresaActiva(LIZETH, EMPRESA_VG_ID)
    const enVg = await requirePermission(peticion(LIZETH), 'campo:app')
    check('en VG (solo ejecutiva) ya no tiene campo:app', !enVg.ok)
    if (!enVg.ok) eq('→ 403', enVg.response.status, 403)
  }

  print('\nGenerales')
  {
    check('ninguna petición salió del Supabase falso', fake.external.length === 0, fake.external)
    check('sin console.error en todo el recorrido', moduleLogs.length === 0, moduleLogs.slice(-3))
  }

  print(`\n${passed} pruebas pasaron, ${failed} fallaron`)
  if (failed > 0) process.exit(1)
}

main().catch(error => {
  print(`FALLA inesperada: ${error instanceof Error ? error.stack : String(error)}`)
  if (moduleLogs.length > 0) print(`últimos mensajes: ${moduleLogs.slice(-5).join(' | ')}`)
  process.exit(1)
})
