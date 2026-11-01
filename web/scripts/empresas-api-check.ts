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
 *   C. Rutas de sesión: GET /api/auth/me trae la empresa activa, las empresas y los papeles (sin papeles: 'user' y
 *      ninguna empresa); POST /api/auth/empresa cambia la empresa activa (escribe la columna y refirma la cookie, o
 *      devuelve el token nuevo a la app, sin alargar la sesión; 403 sin papel allí, 400 con un cuerpo inválido, 401
 *      sin sesión); sesion-app pasa a la app un token con la empresa activa (nunca a quien es administrador o
 *      dirección en alguna empresa); el login firma el token con emp; GET /api/empresas lista las activas por código
 *      (sin la 0960, ninguna).
 *   D. Usuarios y papeles: PUT /api/users/[id]/papeles reemplaza los papeles de una persona en una empresa (cachés
 *      users.role y business_lines.leader_user_id; línea fuera de la empresa → 400; líder nacional repetido o Zonas
 *      solapadas → 409; una líder por Zonas entra inactiva, recibe sus Zonas y se activa); quitar sales_manager cuenta
 *      (?simular=1, sin escribir) y borra sus asignaciones de esa empresa y, en VG, sus executive_lines (el disparador
 *      de la 0820 cierra los visitantes; el falso no corre disparadores: se comprueba lo que borra y lo que cuenta) y
 *      entonces recalcula la cobertura (cobertura_recalculada, como PATCH /api/executives);
 *      GET /api/users trae papeles; POST /api/users con role crea el papel en VG; PUT /api/users/[id] con role pasa por
 *      los papeles de VG (y protege al último administrador); POST /api/executives da la empresa a la vacante nueva;
 *      sin users:manage → 403; sin la 0960, las rutas viejas siguen y la de papeles responde 503.
 *   E. Líneas por empresa: GET /api/business-lines trae empresas (por código; [] sin la 0960, sin 500); PATCH con
 *      empresa_ids reemplaza linea_empresas (agrega y quita); [] → 400, empresa desconocida o inactiva → 400; quitar una
 *      empresa donde la línea tiene líder activo (papel line_leader) o asignaciones → 409 y nada escrito; sin
 *      lines:edit → 403; sin la 0960, empresa_ids → 503 y los demás campos siguen.
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
import { GET as meGet } from '../app/api/auth/me/route'
import { POST as empresaPost } from '../app/api/auth/empresa/route'
import { GET as empresasGet } from '../app/api/empresas/route'
import { POST as sesionAppPost } from '../app/api/auth/sesion-app/route'
import { POST as loginPost } from '../app/api/auth/login/route'
import { GET as usersGet, POST as usersPost } from '../app/api/users/route'
import { PUT as userPut } from '../app/api/users/[id]/route'
import { PUT as papelesPut } from '../app/api/users/[id]/papeles/route'
import { POST as executivesPost } from '../app/api/executives/route'
import { GET as lineasGet } from '../app/api/business-lines/route'
import { PATCH as lineaPatch } from '../app/api/business-lines/[id]/route'
import {
  MENSAJE_LIDER_NACIONAL_UNICO,
  MENSAJE_LIDER_ZONAS_SOLAPADAS,
  MENSAJE_LINEA_FUERA_DE_EMPRESA,
} from '../lib/empresas-reglas'

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
  linea_empresas: ['line_id', 'empresa_id'],
}
/** Tablas con columna id que el falso rellena si el insert no la trae. */
const CON_ID = new Set(['users', 'empresas', 'papeles', 'executives', 'coverage'])

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
    // .single() / .maybeSingle() piden un objeto (Accept: application/vnd.pgrst.object+json)
    const objeto = (headers.get('accept') || '').includes('vnd.pgrst.object')
    const salida = rows.map(row => project(row, select))
    if (objeto) {
      if (salida.length !== 1) return pgError('PGRST116', 'JSON object requested, multiple (or no) rows returned', 406)
      return json(salida[0], method === 'POST' ? 201 : 200)
    }
    return json(salida, method === 'POST' ? 201 : 200)
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
const ADMIN_LIDER = '00000000-0000-4000-8000-000000000007' // admin + line_leader, los dos en VG
const LIDER_DIRECTORA_MEDIX = '00000000-0000-4000-8000-000000000008' // line_leader en VG (activa) y commercial_director en Medix

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
const P_AL_ADMIN = '40000000-0000-4000-8000-00000000000b'
const P_AL_LIDER = '40000000-0000-4000-8000-00000000000c'
const P_LD_LIDER = '40000000-0000-4000-8000-00000000000d'
const P_LD_DIRECTORA = '40000000-0000-4000-8000-00000000000e'

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
      usuario(ADMIN_LIDER, 'admin', 'Admin y líder'),
      usuario(LIDER_DIRECTORA_MEDIX, 'line_leader', 'Líder en VG, directora en Medix', EMPRESA_VG_ID),
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
      papel(P_AL_ADMIN, ADMIN_LIDER, EMPRESA_VG_ID, 'admin'),
      papel(P_AL_LIDER, ADMIN_LIDER, EMPRESA_VG_ID, 'line_leader', L_TRAUMA),
      papel(P_LD_LIDER, LIDER_DIRECTORA_MEDIX, EMPRESA_VG_ID, 'line_leader', L_TRAUMA),
      papel(P_LD_DIRECTORA, LIDER_DIRECTORA_MEDIX, EMPRESA_MEDIX_ID, 'commercial_director'),
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

  print('\nC. Rutas de sesión')

  /** Petición a una ruta con la sesión de la web (cookie) o de la app (portador), con cuerpo JSON opcional. */
  function aRuta(ruta: string, opciones: { userId?: string; portador?: boolean; cuerpo?: unknown; metodo?: string } = {}) {
    const headers: Record<string, string> = {}
    if (opciones.userId) {
      const token = signSession(opciones.userId, passwordVersion(`hash-${opciones.userId}`))
      if (opciones.portador) headers.authorization = `Bearer ${token}`
      else headers.cookie = `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`
    }
    if (opciones.cuerpo !== undefined) headers['content-type'] = 'application/json'
    return new NextRequest(`http://localhost:3000${ruta}`, {
      method: opciones.metodo ?? (opciones.cuerpo === undefined ? 'GET' : 'POST'),
      headers,
      body: opciones.cuerpo === undefined ? undefined : JSON.stringify(opciones.cuerpo),
    })
  }
  /** El token de la cookie de sesión en el Set-Cookie de la respuesta, o null. */
  function cookieDe(response: Response): string | null {
    const cabecera = response.headers.get('set-cookie') ?? ''
    const m = new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`).exec(cabecera)
    return m ? decodeURIComponent(m[1]) : null
  }
  const columnaDe = (id: string) => tablas.users.find(u => u.id === id)?.empresa_activa_id ?? null

  type CuerpoMe = { user?: { role?: string; empresa?: { id: string; codigo: string; nombre_corto: string } | null; empresas?: { codigo: string }[]; papeles?: { id: string }[] } }

  print('\n  GET /api/auth/me: Lizeth (empresa activa Medix por la columna)')
  {
    tablas.users.find(u => u.id === LIZETH)!.empresa_activa_id = EMPRESA_MEDIX_ID
    const r = await meGet(aRuta('/api/auth/me', { userId: LIZETH }))
    eq('200', r.status, 200)
    const cuerpo = (await cuerpoDe(r)) as CuerpoMe
    eq('user.empresas: las dos, por código', cuerpo.user?.empresas?.map(e => e.codigo), ['medix', 'vg'])
    eq("user.empresa.codigo = la columna ('medix')", cuerpo.user?.empresa?.codigo, 'medix')
    eq('user.empresa = { id, codigo, nombre_corto }', cuerpo.user?.empresa, { id: EMPRESA_MEDIX_ID, codigo: 'medix', nombre_corto: 'Medix' })
    eq('user.papeles: solo el de Medix', cuerpo.user?.papeles?.map(p => p.id), [P_LIZETH_MEDIX])
    eq("user.role 'line_leader'", cuerpo.user?.role, 'line_leader')
  }

  print('\n  GET /api/auth/me: Foco 2 (usuario activo sin papeles)')
  {
    const r = await meGet(aRuta('/api/auth/me', { userId: SIN_PAPELES }))
    eq('200', r.status, 200)
    const cuerpo = (await cuerpoDe(r)) as CuerpoMe
    eq("user.role 'user'", cuerpo.user?.role, 'user')
    eq('user.empresas []', cuerpo.user?.empresas, [])
    eq('user.empresa null', cuerpo.user?.empresa, null)
  }

  print('\n  POST /api/auth/empresa')
  {
    const conCookie = await empresaPost(aRuta('/api/auth/empresa', { userId: LIZETH, cuerpo: { empresa_id: EMPRESA_VG_ID } }))
    eq('Lizeth con cookie a VG → 200', conCookie.status, 200)
    eq('cuerpo { empresa } (sin token: la cookie es httpOnly)', await cuerpoDe(conCookie), { empresa: { id: EMPRESA_VG_ID, codigo: 'vg', nombre_corto: 'VG Medical' } })
    const cookie = cookieDe(conCookie)
    check('Set-Cookie con la cookie de sesión', cookie !== null, conCookie.headers.get('set-cookie'))
    eq('la cookie refirmada trae emp = VG', verifySession(cookie)?.emp, EMPRESA_VG_ID)
    eq('y el mismo uid', verifySession(cookie)?.uid, LIZETH)
    check('la cookie sigue httpOnly', /httponly/i.test(conCookie.headers.get('set-cookie') ?? ''), conCookie.headers.get('set-cookie'))
    eq('users.empresa_activa_id = VG', columnaDe(LIZETH), EMPRESA_VG_ID)

    // Cambiar de empresa no alarga la sesión: con un token que vence en una hora, el refirmado vence a la misma hora
    {
      const iat = Math.floor(Date.now() / 1000)
      const exp = iat + 3600
      const body = Buffer.from(JSON.stringify({ uid: LIZETH, pv: passwordVersion(`hash-${LIZETH}`), iat, exp })).toString('base64url')
      const corto = `${body}.${createHmac('sha256', SECRETO).update(body).digest('base64url')}`
      const r = await empresaPost(new NextRequest('http://localhost:3000/api/auth/empresa', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: `${SESSION_COOKIE_NAME}=${encodeURIComponent(corto)}` },
        body: JSON.stringify({ empresa_id: EMPRESA_MEDIX_ID }),
      }))
      const refirmada = cookieDe(r)
      eq('un token que vence en 1 h: 200 y la cookie refirmada vence a la misma hora (no se alarga)', [r.status, refirmada ? payloadDe(refirmada).exp : null], [200, exp])
      check('y su Max-Age es lo que le queda, no 7 días', /max-age=(3[56]\d\d)\b/i.test(r.headers.get('set-cookie') ?? ''), r.headers.get('set-cookie'))
    }

    tablas.users.find(u => u.id === LIZETH)!.empresa_activa_id = EMPRESA_MEDIX_ID
    const conPortador = await empresaPost(aRuta('/api/auth/empresa', { userId: LIZETH, portador: true, cuerpo: { empresa_id: EMPRESA_VG_ID } }))
    eq('Lizeth con portador (app) a VG → 200', conPortador.status, 200)
    const cuerpoApp = (await cuerpoDe(conPortador)) as { empresa?: { codigo: string }; token?: string; expira_at?: string }
    eq("cuerpo con la empresa 'vg'", cuerpoApp.empresa?.codigo, 'vg')
    eq('y un token cuyo emp es VG', verifySession(cuerpoApp.token)?.emp, EMPRESA_VG_ID)
    check('y expira_at es una fecha', typeof cuerpoApp.expira_at === 'string' && !Number.isNaN(Date.parse(cuerpoApp.expira_at)), cuerpoApp.expira_at)
    check('sin Set-Cookie para la app', conPortador.headers.get('set-cookie') === null, conPortador.headers.get('set-cookie'))
    eq('users.empresa_activa_id = VG', columnaDe(LIZETH), EMPRESA_VG_ID)

    const marca = fake.requests.length
    const aMedix = await empresaPost(aRuta('/api/auth/empresa', { userId: PAOLA, cuerpo: { empresa_id: EMPRESA_MEDIX_ID } }))
    eq('Paola (solo de VG) a Medix → 403', aMedix.status, 403)
    eq("con 'No tienes papel en esa empresa'", await cuerpoDe(aMedix), { error: 'No tienes papel en esa empresa' })
    eq('la columna de Paola sigue null', columnaDe(PAOLA), null)
    check('no escribe nada', fake.writes(marca).length === 0, fake.writes(marca))
    check('ni refirma la cookie', aMedix.headers.get('set-cookie') === null, aMedix.headers.get('set-cookie'))

    const vacio = await empresaPost(aRuta('/api/auth/empresa', { userId: PAOLA, cuerpo: {} }))
    eq('cuerpo {} → 400', vacio.status, 400)
    eq("con 'empresa_id no válido'", await cuerpoDe(vacio), { error: 'empresa_id no válido' })
    const noJson = await empresaPost(new NextRequest('http://localhost:3000/api/auth/empresa', { method: 'POST', headers: aRuta('/api/auth/empresa', { userId: PAOLA }).headers, body: 'esto no es JSON' }))
    eq("cuerpo que no es JSON → 400 'Cuerpo de la petición no válido'", [noJson.status, await cuerpoDe(noJson)], [400, { error: 'Cuerpo de la petición no válido' }])
    const sinSesion = await empresaPost(aRuta('/api/auth/empresa', { cuerpo: { empresa_id: EMPRESA_VG_ID } }))
    eq('sin sesión → 401', sinSesion.status, 401)
  }

  print('\n  POST /api/auth/sesion-app: el token de la app lleva la empresa activa, sin alargar la sesión')
  {
    const pedir = (token: string) =>
      sesionAppPost(new NextRequest('http://localhost:3000/api/auth/sesion-app', {
        method: 'POST',
        headers: { cookie: `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`, origin: 'http://localhost:3000', 'sec-fetch-site': 'same-origin' },
      }))
    const pv = passwordVersion(`hash-${PAOLA}`)
    const sinEmp = signSession(PAOLA, pv)
    const r = await pedir(sinEmp)
    const cuerpo = (await cuerpoDe(r)) as { token?: string; usuario?: { empresa?: { codigo: string } | null } }
    eq('Paola (líder en VG), cookie sin emp → 200', r.status, 200)
    eq('el token de la app trae emp = VG', verifySession(cuerpo.token)?.emp, EMPRESA_VG_ID)
    check('y vence cuando vencía la cookie (no se alarga)', !!cuerpo.token && payloadDe(cuerpo.token).exp === payloadDe(sinEmp).exp, cuerpo.token && [payloadDe(cuerpo.token), payloadDe(sinEmp)])
    eq("usuario.empresa 'vg'", cuerpo.usuario?.empresa?.codigo, 'vg')
    const conEmp = signSession(PAOLA, pv, EMPRESA_VG_ID)
    eq('con la cookie que ya trae emp = VG → el MISMO token', ((await cuerpoDe(await pedir(conEmp))) as { token?: string }).token, conEmp)
    const gerente = await pedir(signSession(FOCO1, passwordVersion(`hash-${FOCO1}`)))
    eq('un gerente a secas (sin papel de líder) → 403', gerente.status, 403)

    // La cookie del administrador o de la dirección nunca se vuelve un token legible, aunque también sea líder
    const adminLider = await pedir(signSession(ADMIN_LIDER, passwordVersion(`hash-${ADMIN_LIDER}`)))
    const cuerpoAdmin = (await cuerpoDe(adminLider)) as { token?: string; error?: string }
    eq('admin + líder en la misma empresa → 403 { error: Acceso denegado }', [adminLider.status, cuerpoAdmin], [403, { error: 'Acceso denegado' }])
    check('y sin token', cuerpoAdmin.token === undefined, cuerpoAdmin)
    const liderDirectora = await pedir(signSession(LIDER_DIRECTORA_MEDIX, passwordVersion(`hash-${LIDER_DIRECTORA_MEDIX}`)))
    const cuerpoLD = (await cuerpoDe(liderDirectora)) as { token?: string }
    eq('líder en VG (activa) y directora comercial en Medix → 403 (cuenta CUALQUIER empresa)', liderDirectora.status, 403)
    check('y sin token', cuerpoLD.token === undefined, cuerpoLD)
  }

  print('\n  POST /api/auth/login: el token lleva emp = la empresa activa')
  {
    // Las contraseñas de prueba son texto plano heredado: el login las migra a bcrypt (y cambia el pv). Se restaura al final.
    const fila = tablas.users.find(u => u.id === LIZETH)!
    const original = fila.password
    fila.empresa_activa_id = EMPRESA_MEDIX_ID
    const entrar = (cliente?: string) =>
      loginPost(new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-real-ip': '10.96.0.1' },
        body: JSON.stringify({ email: fila.email, password: `hash-${LIZETH}`, ...(cliente ? { cliente } : {}) }),
      }))
    try {
      const web = await entrar()
      eq('login web de Lizeth → 200', web.status, 200)
      eq('el token de la cookie trae emp = Medix (la columna)', verifySession(cookieDe(web))?.emp, EMPRESA_MEDIX_ID)
      const movil = await entrar('movil')
      const cuerpoMovil = (await cuerpoDe(movil)) as { token?: string; usuario?: { empresa?: { codigo: string } | null } }
      eq('login móvil de Lizeth → 200', movil.status, 200)
      eq('verifySession(body.token).emp = Medix', verifySession(cuerpoMovil.token)?.emp, EMPRESA_MEDIX_ID)
      eq("y usuario.empresa 'medix'", cuerpoMovil.usuario?.empresa?.codigo, 'medix')
    } finally {
      fila.password = original
    }
  }

  print('\n  GET /api/empresas')
  {
    const sinSesion = await empresasGet(aRuta('/api/empresas'))
    eq('sin sesión → 401', sinSesion.status, 401)
    const conSesion = await empresasGet(aRuta('/api/empresas', { userId: PAOLA }))
    eq('con sesión → 200', conSesion.status, 200)
    eq('las dos activas, por código, { id, codigo, nombre_corto }', await cuerpoDe(conSesion), {
      empresas: [
        { id: EMPRESA_MEDIX_ID, codigo: 'medix', nombre_corto: 'Medix' },
        { id: EMPRESA_VG_ID, codigo: 'vg', nombre_corto: 'VG Medical' },
      ],
    })

    // Sin la 0960 (preview de Vercel): users sin la columna y sin la tabla empresas → lista vacía, no 500
    const { empresa_activa_id: _sinColumna, ...paolaSinColumna } = usuario(PAOLA, 'line_leader', 'Paola')
    const fakeAntes = fakeSupabase({ users: [paolaSinColumna] }, { codigoSinTabla: '42P01' })
    fetchHandler = fakeAntes.handler
    const logs = moduleLogs.length
    const antes = await empresasGet(aRuta('/api/empresas', { userId: PAOLA }))
    eq('sin la 0960 → 200 { empresas: [] }', [antes.status, await cuerpoDe(antes)], [200, { empresas: [] }])
    check('sin console.error', moduleLogs.length === logs, moduleLogs.slice(logs))
    fetchHandler = fake.handler
  }

  print('\nD. Usuarios y papeles')

  // Un Supabase falso aparte, con lo que tocan las rutas de usuarios: líneas por empresa, personas del equipo comercial,
  // sus empresas, asignaciones y visitantes. El falso no corre disparadores (ni el de la 0820 que cierra visitantes ni
  // los de la 0960): se comprueba lo que el servidor borra, escribe y cuenta.
  const D_ADMIN = '00000000-0000-4000-8000-0000000000d1' // admin en VG (el único administrador)
  const D_PAOLA = '00000000-0000-4000-8000-0000000000d2' // sin papeles; recibe líder de Trauma + ejecutiva en VG
  const D_OTRA = '00000000-0000-4000-8000-0000000000d3' // viewer en VG; intenta ser líder de Trauma
  const D_EJEC = '00000000-0000-4000-8000-0000000000d4' // sales_manager en VG, con fila en executives
  const D_FOCO4 = '00000000-0000-4000-8000-0000000000d5' // sales_manager en VG, SIN fila en executives
  const D_DIRECTORA = '00000000-0000-4000-8000-0000000000d6' // commercial_director en VG: executives:edit, no users:manage
  const L_COLUMNA = '10000000-0000-4000-8000-000000000006' // en VG y en Medix (Trauma solo en VG)
  const KAM_BOG = '20000000-0000-4000-8000-000000000002'
  const X_EJEC = '30000000-0000-4000-8000-000000000001'
  const X_OTRO = '30000000-0000-4000-8000-000000000002'
  const X_ENLACE = '30000000-0000-4000-8000-000000000003'
  const D_P_ADMIN = '40000000-0000-4000-8000-0000000000d1'
  const D_P_OTRA = '40000000-0000-4000-8000-0000000000d3'
  const D_P_EJEC = '40000000-0000-4000-8000-0000000000d4'
  const D_P_FOCO4 = '40000000-0000-4000-8000-0000000000d5'
  const D_P_DIRECTORA = '40000000-0000-4000-8000-0000000000d6'

  const persona = (id: string, user_id: string | null, nombre: string): Fila => ({
    id, full_name: nombre, email: null, company: 'VG Medical', status: user_id ? 'active' : 'placeholder', base_kam_id: KAM_BAQ,
    user_id, odoo_employee_id: null, notes: null, color: null,
  })
  const asignacion = (id: string, executive_id: string, kam_id: string, line_id: string, empresa_id: string): Fila =>
    ({ id, executive_id, kam_id, line_id, empresa_id, created_by: null })
  const visitante = (id: string, executive_id: string, line_id: string, hasta: string | null): Fila =>
    ({ id, medico_id: `medico-${id}`, executive_id, line_id, empresa_id: EMPRESA_VG_ID, desde: '2026-01-01', hasta })
  const datosUsuarios = (): Tablas => ({
    users: [
      usuario(D_ADMIN, 'admin', 'Admin'),
      usuario(D_PAOLA, 'viewer', 'Paola D'),
      usuario(D_OTRA, 'viewer', 'Otra líder'),
      usuario(D_EJEC, 'sales_manager', 'Ejecutiva'),
      usuario(D_FOCO4, 'sales_manager', 'Sin ficha'),
      usuario(D_DIRECTORA, 'commercial_director', 'Directora'),
    ],
    empresas: [empresa(EMPRESA_VG_ID, 'vg', 'VG Medical S.A.S.', 'VG Medical'), empresa(EMPRESA_MEDIX_ID, 'medix', 'Medix', 'Medix')],
    papeles: [
      papel(D_P_ADMIN, D_ADMIN, EMPRESA_VG_ID, 'admin'),
      papel(D_P_OTRA, D_OTRA, EMPRESA_VG_ID, 'viewer'),
      papel(D_P_EJEC, D_EJEC, EMPRESA_VG_ID, 'sales_manager'),
      papel(D_P_FOCO4, D_FOCO4, EMPRESA_VG_ID, 'sales_manager'),
      papel(D_P_DIRECTORA, D_DIRECTORA, EMPRESA_VG_ID, 'commercial_director'),
    ],
    papel_zonas: [],
    linea_empresas: [
      { line_id: L_TRAUMA, empresa_id: EMPRESA_VG_ID },
      { line_id: L_COLUMNA, empresa_id: EMPRESA_VG_ID },
      { line_id: L_COLUMNA, empresa_id: EMPRESA_MEDIX_ID },
    ],
    business_lines: [
      { id: L_TRAUMA, code: 'trauma', name: 'Trauma', leader_user_id: null, max_reach_minutes: 300, sort_order: 1, active: true },
      { id: L_COLUMNA, code: 'columna', name: 'Columna', leader_user_id: null, max_reach_minutes: 300, sort_order: 2, active: true },
    ],
    kams: [
      { id: KAM_BAQ, name: 'Barranquilla', area_id: '08001', active: true },
      { id: KAM_BOG, name: 'Bogotá Norte', area_id: '1100101', active: true },
    ],
    // Lo que lee el recálculo de cobertura cuando a alguien se le borran sus executive_lines (sin IPS)
    hospitals: [],
    hospital_kam_distances: [],
    line_zones: [],
    coverage_overrides: [],
    coverage: [],
    executives: [
      persona(X_EJEC, D_EJEC, 'Ejecutiva'),
      persona(X_OTRO, null, 'Vacante Bogotá'),
      // Ejecutiva sin usuario y aún sin empresa: POST /api/users la enlaza por el email
      { ...persona(X_ENLACE, null, 'Por enlazar'), email: 'enlace@prueba.test', status: 'active' },
    ],
    executive_lines: [
      { executive_id: X_EJEC, line_id: L_TRAUMA },
      { executive_id: X_EJEC, line_id: L_COLUMNA },
      { executive_id: X_OTRO, line_id: L_TRAUMA },
    ],
    executive_empresas: [
      { executive_id: X_EJEC, empresa_id: EMPRESA_VG_ID, activo: true },
      { executive_id: X_EJEC, empresa_id: EMPRESA_MEDIX_ID, activo: true },
      { executive_id: X_OTRO, empresa_id: EMPRESA_VG_ID, activo: true },
    ],
    asignaciones: [
      asignacion('a1', X_EJEC, KAM_BAQ, L_TRAUMA, EMPRESA_VG_ID),
      asignacion('a2', X_EJEC, KAM_BAQ, L_COLUMNA, EMPRESA_VG_ID),
      asignacion('a3', X_EJEC, KAM_BOG, L_TRAUMA, EMPRESA_VG_ID),
      asignacion('a4', X_EJEC, KAM_BAQ, L_COLUMNA, EMPRESA_MEDIX_ID),
      asignacion('a5', X_OTRO, KAM_BOG, L_TRAUMA, EMPRESA_VG_ID),
    ],
    medico_visitantes: [
      visitante('v1', X_EJEC, L_TRAUMA, null),
      visitante('v2', X_EJEC, L_COLUMNA, null),
      visitante('v3', X_EJEC, L_TRAUMA, '2026-10-01'), // ya cerrado: no cuenta
      visitante('v4', X_OTRO, L_TRAUMA, null), // de otra persona: no cuenta
    ],
  })
  const tablasD = datosUsuarios()
  const fakeD = fakeSupabase(tablasD)
  fetchHandler = fakeD.handler

  const ponerPapeles = (quien: string, id: string, cuerpo: unknown, simular = false) =>
    papelesPut(aRuta(`/api/users/${id}/papeles${simular ? '?simular=1' : ''}`, { userId: quien, cuerpo, metodo: 'PUT' }), { params: { id } })
  type CuerpoPapeles = { papeles?: { id: string; papel: string; line_id: string | null; kam_ids: string[] }[]; afectados?: { asignaciones: number; visitantes: number }; error?: string }
  const rolDe = (id: string) => tablasD.users.find(u => u.id === id)?.role
  const liderDe = (lineId: string) => tablasD.business_lines.find(l => l.id === lineId)?.leader_user_id ?? null
  const papelesActivosDe = (id: string, empresaId = EMPRESA_VG_ID) =>
    tablasD.papeles.filter(p => p.user_id === id && p.empresa_id === empresaId && p.activo === true)
  const zonasDe = (papelId: unknown) => tablasD.papel_zonas.filter(z => z.papel_id === papelId).map(z => z.kam_id).sort()

  print('\n  PUT /api/users/[id]/papeles: Paola recibe líder de Trauma y ejecutiva en VG')
  {
    const r = await ponerPapeles(D_ADMIN, D_PAOLA, { empresa_id: EMPRESA_VG_ID, papeles: [{ papel: 'line_leader', line_id: L_TRAUMA }, { papel: 'sales_manager' }] })
    const cuerpo = (await cuerpoDe(r)) as CuerpoPapeles
    eq('200', r.status, 200)
    eq('2 papeles en la respuesta', cuerpo.papeles?.map(p => p.papel).sort(), ['line_leader', 'sales_manager'])
    eq('afectados {0, 0}', cuerpo.afectados, { asignaciones: 0, visitantes: 0 })
    eq("caché users.role de Paola = 'line_leader'", rolDe(D_PAOLA), 'line_leader')
    eq('caché business_lines.leader_user_id de Trauma = Paola', liderDe(L_TRAUMA), D_PAOLA)
  }

  print('\n  Líder por línea y empresa: una nacional, o varias por Zonas sin solaparse')
  {
    const marca = fakeD.requests.length
    const segunda = await ponerPapeles(D_ADMIN, D_OTRA, { empresa_id: EMPRESA_VG_ID, papeles: [{ papel: 'line_leader', line_id: L_TRAUMA }] })
    eq('segunda líder nacional de Trauma en VG → 409 con el mensaje', [segunda.status, ((await cuerpoDe(segunda)) as CuerpoPapeles).error], [409, MENSAJE_LIDER_NACIONAL_UNICO])
    check('y no escribe nada', fakeD.writes(marca).length === 0, fakeD.writes(marca))

    const zonal = await ponerPapeles(D_ADMIN, D_PAOLA, {
      empresa_id: EMPRESA_VG_ID,
      papeles: [{ papel: 'line_leader', line_id: L_TRAUMA, kam_ids: [KAM_BAQ] }, { papel: 'sales_manager' }],
    })
    eq('Paola pasa a líder de Trauma solo en Barranquilla → 200', zonal.status, 200)
    const papelPaola = papelesActivosDe(D_PAOLA).find(p => p.papel === 'line_leader')
    eq('su mismo papel (no uno nuevo) con la Zona Barranquilla', zonasDe(papelPaola?.id), [KAM_BAQ])
    eq('un solo papel de líder de Trauma de Paola (activo o no)', tablasD.papeles.filter(p => p.user_id === D_PAOLA && p.papel === 'line_leader').length, 1)
    eq('caché leader_user_id de Trauma = null (solo hay líderes por Zonas)', liderDe(L_TRAUMA), null)

    const marca2 = fakeD.requests.length
    const solapada = await ponerPapeles(D_ADMIN, D_OTRA, { empresa_id: EMPRESA_VG_ID, papeles: [{ papel: 'line_leader', line_id: L_TRAUMA, kam_ids: [KAM_BAQ] }] })
    eq('otra líder de Trauma con Barranquilla → 409 Zonas solapadas', [solapada.status, ((await cuerpoDe(solapada)) as CuerpoPapeles).error], [409, MENSAJE_LIDER_ZONAS_SOLAPADAS])
    check('y no escribe nada', fakeD.writes(marca2).length === 0, fakeD.writes(marca2))

    const marca3 = fakeD.requests.length
    const disjunta = await ponerPapeles(D_ADMIN, D_OTRA, { empresa_id: EMPRESA_VG_ID, papeles: [{ papel: 'line_leader', line_id: L_TRAUMA, kam_ids: [KAM_BOG] }] })
    const cuerpo = (await cuerpoDe(disjunta)) as CuerpoPapeles
    eq('otra líder de Trauma con Bogotá Norte (disjunta) → 200', disjunta.status, 200)
    eq('su papel de líder trae la Zona Bogotá Norte', cuerpo.papeles?.map(p => [p.papel, p.kam_ids]), [['line_leader', [KAM_BOG]]])
    const nuevo = papelesActivosDe(D_OTRA).find(p => p.papel === 'line_leader')
    eq('queda activa con su Zona', [nuevo?.activo, zonasDe(nuevo?.id)], [true, [KAM_BOG]])
    const insercion = fakeD.writes(marca3).find(w => w.method === 'POST' && w.table === 'papeles')
    eq('entra INACTIVA (la regla diferida de la base la vería nacional sin sus Zonas) y luego se activa',
      (Array.isArray(insercion?.body) ? insercion?.body[0] : insercion?.body as Fila | undefined)?.activo, false)
    eq('su papel viewer se desactiva (no se borra)', tablasD.papeles.find(p => p.id === D_P_OTRA)?.activo, false)
    eq("caché users.role de Otra = 'line_leader'", rolDe(D_OTRA), 'line_leader')
    eq('caché leader_user_id de Trauma sigue null', liderDe(L_TRAUMA), null)
  }

  print('\n  Línea fuera de la empresa')
  {
    const marca = fakeD.requests.length
    const r = await ponerPapeles(D_ADMIN, D_OTRA, { empresa_id: EMPRESA_MEDIX_ID, papeles: [{ papel: 'line_leader', line_id: L_TRAUMA }] })
    eq('líder de Trauma en Medix (Trauma no está en Medix) → 400 con el mensaje', [r.status, ((await cuerpoDe(r)) as CuerpoPapeles).error], [400, MENSAJE_LINEA_FUERA_DE_EMPRESA])
    check('y no escribe nada', fakeD.writes(marca).length === 0, fakeD.writes(marca))
    const columna = await ponerPapeles(D_ADMIN, D_OTRA, { empresa_id: EMPRESA_MEDIX_ID, papeles: [{ papel: 'line_leader', line_id: L_COLUMNA }] })
    eq('líder de Columna en Medix (sí está) → 200', columna.status, 200)
    eq('caché leader_user_id de Columna NO cambia (solo cuenta VG)', liderDe(L_COLUMNA), null)
    eq("caché users.role de Otra sigue 'line_leader' (de VG)", rolDe(D_OTRA), 'line_leader')
  }

  print('\n  La regla de la base (dos líderes a la vez) también responde 409 con su mensaje')
  {
    // Otra persona tomó Columna en VG entre la validación y la escritura: el disparador de la 0960 rechaza la inserción
    const original = fakeD.handler
    fetchHandler = async (input, init) => {
      const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      if ((init?.method || 'GET').toUpperCase() === 'POST' && new URL(href).pathname === '/rest/v1/papeles') {
        return new Response(JSON.stringify({ code: '23514', message: MENSAJE_LIDER_NACIONAL_UNICO, details: null, hint: null }), { status: 400, headers: { 'content-type': 'application/json' } })
      }
      return original(input, init)
    }
    const r = await ponerPapeles(D_ADMIN, D_FOCO4, { empresa_id: EMPRESA_VG_ID, papeles: [{ papel: 'sales_manager' }, { papel: 'line_leader', line_id: L_COLUMNA }] })
    eq('→ 409 con el mensaje del disparador', [r.status, ((await cuerpoDe(r)) as CuerpoPapeles).error], [409, MENSAJE_LIDER_NACIONAL_UNICO])
    fetchHandler = original
  }

  print('\n  Cuerpo, usuario y empresa')
  {
    const marca = fakeD.requests.length
    const sinLinea = await ponerPapeles(D_ADMIN, D_OTRA, { empresa_id: EMPRESA_VG_ID, papeles: [{ papel: 'line_leader' }] })
    eq('line_leader sin línea → 400', sinLinea.status, 400)
    const conLinea = await ponerPapeles(D_ADMIN, D_OTRA, { empresa_id: EMPRESA_VG_ID, papeles: [{ papel: 'viewer', line_id: L_TRAUMA }] })
    eq('otro papel con línea → 400', conLinea.status, 400)
    const rolRaro = await ponerPapeles(D_ADMIN, D_OTRA, { empresa_id: EMPRESA_VG_ID, papeles: [{ papel: 'superjefe' }] })
    eq('papel que no existe → 400', rolRaro.status, 400)
    const zonaRara = await ponerPapeles(D_ADMIN, D_OTRA, { empresa_id: EMPRESA_VG_ID, papeles: [{ papel: 'line_leader', line_id: L_COLUMNA, kam_ids: [randomUUID()] }] })
    eq('una Zona que no existe → 400', zonaRara.status, 400)
    const repetido = await ponerPapeles(D_ADMIN, D_OTRA, { empresa_id: EMPRESA_VG_ID, papeles: [{ papel: 'viewer' }, { papel: 'viewer' }] })
    eq('papel repetido → 400', repetido.status, 400)
    const nadie = await ponerPapeles(D_ADMIN, randomUUID(), { empresa_id: EMPRESA_VG_ID, papeles: [{ papel: 'viewer' }] })
    eq('usuario que no existe → 404', nadie.status, 404)
    const otraEmpresa = await ponerPapeles(D_ADMIN, D_OTRA, { empresa_id: randomUUID(), papeles: [{ papel: 'viewer' }] })
    eq('empresa que no existe → 404', otraEmpresa.status, 404)
    check('ninguno escribe', fakeD.writes(marca).length === 0, fakeD.writes(marca))
  }

  print('\n  Quitar sales_manager en VG: cuenta (simular) y borra asignaciones y executive_lines')
  {
    const marca = fakeD.requests.length
    const cuerpoQuitar = { empresa_id: EMPRESA_VG_ID, papeles: [{ papel: 'viewer' }] }
    const simulado = await ponerPapeles(D_ADMIN, D_EJEC, cuerpoQuitar, true)
    const cuerpoSimulado = (await cuerpoDe(simulado)) as CuerpoPapeles & { cobertura_recalculada?: boolean }
    eq('?simular=1 → 200 { asignaciones: 3, visitantes: 2 }', [simulado.status, cuerpoSimulado.afectados], [200, { asignaciones: 3, visitantes: 2 }])
    check('sin escribir nada (ni recalcular la cobertura)', fakeD.writes(marca).length === 0 && !('cobertura_recalculada' in cuerpoSimulado), fakeD.writes(marca))

    const marcaReal = fakeD.requests.length
    const real = await ponerPapeles(D_ADMIN, D_EJEC, cuerpoQuitar)
    const cuerpoReal = (await cuerpoDe(real)) as CuerpoPapeles & { cobertura_recalculada?: boolean }
    eq('sin simular → 200 con los mismos afectados', [real.status, cuerpoReal.afectados], [200, { asignaciones: 3, visitantes: 2 }])
    eq('se borraron sus executive_lines: recalcula la cobertura (cobertura_recalculada: true)', cuerpoReal.cobertura_recalculada, true)
    check('y escribe en coverage (como PATCH /api/executives)', fakeD.writes(marcaReal).some(w => w.table === 'coverage'), fakeD.writes(marcaReal).map(w => w.table))
    eq('borra sus 3 asignaciones de VG (queda la de Medix y la de la otra persona)', tablasD.asignaciones.map(a => a.id).sort(), ['a4', 'a5'])
    eq('borra sus executive_lines (la 0820 cierra los visitantes; las de la otra persona quedan)',
      tablasD.executive_lines.map(l => `${l.executive_id === X_EJEC ? 'ejec' : 'otro'}:${l.line_id === L_TRAUMA ? 'trauma' : 'columna'}`), ['otro:trauma'])
    eq('executive_empresas en VG queda activo = false; en Medix sigue activo',
      tablasD.executive_empresas.filter(e => e.executive_id === X_EJEC).map(e => [e.empresa_id === EMPRESA_VG_ID ? 'vg' : 'medix', e.activo]).sort(),
      [['medix', true], ['vg', false]])
    eq('su papel sales_manager queda inactivo (no se borra)', tablasD.papeles.find(p => p.id === D_P_EJEC)?.activo, false)
    eq("caché users.role = 'viewer'", rolDe(D_EJEC), 'viewer')

    const devolver = await ponerPapeles(D_ADMIN, D_EJEC, { empresa_id: EMPRESA_VG_ID, papeles: [{ papel: 'sales_manager' }] })
    eq('devolverle sales_manager → 200', devolver.status, 200)
    eq('reactiva el mismo papel (no inserta otro)', [tablasD.papeles.filter(p => p.user_id === D_EJEC && p.papel === 'sales_manager').length, tablasD.papeles.find(p => p.id === D_P_EJEC)?.activo], [1, true])
    eq('y executive_empresas en VG vuelve a activo', tablasD.executive_empresas.find(e => e.executive_id === X_EJEC && e.empresa_id === EMPRESA_VG_ID)?.activo, true)
  }

  print('\n  Foco 4: quitar sales_manager a quien no tiene fila en executives')
  {
    const marca = fakeD.requests.length
    const r = await ponerPapeles(D_ADMIN, D_FOCO4, { empresa_id: EMPRESA_VG_ID, papeles: [] })
    const cuerpo = (await cuerpoDe(r)) as CuerpoPapeles & { cobertura_recalculada?: boolean }
    eq('200 { asignaciones: 0, visitantes: 0 }', [r.status, cuerpo.afectados], [200, { asignaciones: 0, visitantes: 0 }])
    check('sin executive_lines borradas no recalcula la cobertura', !('cobertura_recalculada' in cuerpo) && !fakeD.writes(marca).some(w => w.table === 'coverage'), cuerpo)
    eq("sin papeles en VG: caché users.role = 'user'", rolDe(D_FOCO4), 'user')
  }

  print('\n  GET /api/users trae los papeles de cada persona (todas sus empresas)')
  {
    const r = await usersGet(aRuta('/api/users', { userId: D_ADMIN }))
    const cuerpo = (await cuerpoDe(r)) as { users?: { id: string; papeles?: { papel: string; empresa_id: string; kam_ids: string[] }[] }[] }
    eq('200', r.status, 200)
    check('cada usuario trae papeles (lista)', (cuerpo.users ?? []).length === tablasD.users.length && (cuerpo.users ?? []).every(u => Array.isArray(u.papeles)), cuerpo)
    const paola = cuerpo.users?.find(u => u.id === D_PAOLA)
    eq('Paola: líder (con su Zona) y ejecutiva', paola?.papeles?.map(p => [p.papel, p.kam_ids]).sort(), [['line_leader', [KAM_BAQ]], ['sales_manager', []]])
    const otra = cuerpo.users?.find(u => u.id === D_OTRA)
    eq('Otra: líder en VG y en Medix (solo los activos)', otra?.papeles?.map(p => p.empresa_id === EMPRESA_VG_ID ? 'vg' : 'medix').sort(), ['medix', 'vg'])
  }

  print('\n  POST /api/users')
  {
    const crear = (cuerpo: unknown) => usersPost(aRuta('/api/users', { userId: D_ADMIN, cuerpo }))
    const r = await crear({ email: 'nueva.visora@prueba.test', password: 'Clave-de-prueba-123', full_name: 'Nueva visora', role: 'viewer' })
    const cuerpo = (await cuerpoDe(r)) as { user?: { id: string; role: string }; papeles?: unknown[] }
    eq("con role 'viewer' → 200", r.status, 200)
    const nueva = tablasD.users.find(u => u.email === 'nueva.visora@prueba.test')
    eq('crea el papel viewer en VG', tablasD.papeles.filter(p => p.user_id === nueva?.id).map(p => [p.empresa_id === EMPRESA_VG_ID ? 'vg' : 'medix', p.papel, p.activo]), [['vg', 'viewer', true]])
    eq("users.role = 'viewer'", nueva?.role, 'viewer')
    check('la respuesta no trae la contraseña', cuerpo.user !== undefined && !('password' in (cuerpo.user as object)), cuerpo)

    const dos = await crear({
      email: 'dos.empresas@prueba.test', password: 'Clave-de-prueba-123', full_name: 'Dos empresas',
      papeles: [{ empresa_id: EMPRESA_VG_ID, papel: 'sales_manager' }, { empresa_id: EMPRESA_MEDIX_ID, papel: 'viewer' }],
    })
    eq('con papeles en dos empresas → 200', dos.status, 200)
    const dosId = tablasD.users.find(u => u.email === 'dos.empresas@prueba.test')?.id
    eq('un papel en cada empresa', tablasD.papeles.filter(p => p.user_id === dosId).map(p => [p.empresa_id === EMPRESA_VG_ID ? 'vg' : 'medix', p.papel]).sort(), [['medix', 'viewer'], ['vg', 'sales_manager']])
    eq("users.role = el más alto en VG ('sales_manager')", tablasD.users.find(u => u.id === dosId)?.role, 'sales_manager')

    const enlace = await crear({ email: 'enlace@prueba.test', password: 'Clave-de-prueba-123', full_name: 'Por enlazar', role: 'sales_manager' })
    const cuerpoEnlace = (await cuerpoDe(enlace)) as { linkedExecutive?: string | null }
    eq('con role sales_manager y el email de una ejecutiva sin usuario → 200 y enlazada', [enlace.status, cuerpoEnlace.linkedExecutive], [200, 'Por enlazar'])
    eq('la ejecutiva enlazada queda en VG (executive_empresas activo)',
      tablasD.executive_empresas.filter(e => e.executive_id === X_ENLACE).map(e => [e.empresa_id, e.activo]), [[EMPRESA_VG_ID, true]])

    const usuariosAntes = tablasD.users.length
    const fuera = await crear({
      email: 'fuera@prueba.test', password: 'Clave-de-prueba-123', full_name: 'Fuera',
      papeles: [{ empresa_id: EMPRESA_MEDIX_ID, papel: 'line_leader', line_id: L_TRAUMA }],
    })
    eq('líder de una línea que no está en esa empresa → 400 con el mensaje', [fuera.status, ((await cuerpoDe(fuera)) as { error?: string }).error], [400, MENSAJE_LINEA_FUERA_DE_EMPRESA])
    const choque = await crear({
      email: 'choque@prueba.test', password: 'Clave-de-prueba-123', full_name: 'Choque',
      papeles: [{ empresa_id: EMPRESA_VG_ID, papel: 'line_leader', line_id: L_TRAUMA, kam_ids: [KAM_BOG] }],
    })
    eq('líder con Zonas ya tomadas → 409', choque.status, 409)
    const liderSinLinea = await crear({ email: 'lider@prueba.test', password: 'Clave-de-prueba-123', full_name: 'Líder', role: 'line_leader' })
    eq("role 'line_leader' sin papeles (no dice la línea) → 400", liderSinLinea.status, 400)
    eq('ninguno de los tres crea el usuario', tablasD.users.length, usuariosAntes)
  }

  print('\n  PUT /api/users/[id] con role (la página vieja, hasta la tarea 8): pasa por los papeles de VG')
  {
    const cambiar = (id: string, cuerpo: unknown) => userPut(aRuta(`/api/users/${id}`, { userId: D_ADMIN, cuerpo, metodo: 'PUT' }), { params: { id } })
    const rrhh = await cambiar(D_FOCO4, { role: 'hr' })
    eq("Sin ficha a 'hr' → 200", rrhh.status, 200)
    eq('sus papeles en VG = [hr]', papelesActivosDe(D_FOCO4).map(p => p.papel), ['hr'])
    eq("users.role = 'hr'", rolDe(D_FOCO4), 'hr')

    const lider = await cambiar(D_PAOLA, { role: 'line_leader', full_name: 'Paola Líder' })
    eq("Paola a 'line_leader' → 200", lider.status, 200)
    eq('conserva su papel de líder de Trauma (con su Zona) y pierde el de ejecutiva',
      papelesActivosDe(D_PAOLA).map(p => [p.papel, p.line_id, zonasDe(p.id)]), [['line_leader', L_TRAUMA, [KAM_BAQ]]])
    eq('y el nombre cambia', tablasD.users.find(u => u.id === D_PAOLA)?.full_name, 'Paola Líder')

    const sinLinea = await cambiar(D_FOCO4, { role: 'line_leader' })
    eq("a 'line_leader' sin ninguna línea → 400", sinLinea.status, 400)
    eq('y sigue hr', papelesActivosDe(D_FOCO4).map(p => p.papel), ['hr'])

    const ultimo = await cambiar(D_ADMIN, { role: 'viewer' })
    eq('quitarle el papel de administrador al único administrador → 400', ultimo.status, 400)
    eq('y sigue admin', [papelesActivosDe(D_ADMIN).map(p => p.papel), rolDe(D_ADMIN)], [['admin'], 'admin'])
  }

  print('\n  Sin users:manage → 403 (la dirección comercial no administra usuarios)')
  {
    const marca = fakeD.requests.length
    const lista = await usersGet(aRuta('/api/users', { userId: D_DIRECTORA }))
    const crear = await usersPost(aRuta('/api/users', { userId: D_DIRECTORA, cuerpo: { email: 'x@prueba.test', password: 'Clave-de-prueba-123', full_name: 'X', role: 'viewer' } }))
    const editar = await userPut(aRuta(`/api/users/${D_OTRA}`, { userId: D_DIRECTORA, cuerpo: { role: 'viewer' }, metodo: 'PUT' }), { params: { id: D_OTRA } })
    const papeles = await ponerPapeles(D_DIRECTORA, D_OTRA, { empresa_id: EMPRESA_VG_ID, papeles: [{ papel: 'viewer' }] })
    eq('GET /api/users, POST /api/users, PUT /api/users/[id] y PUT …/papeles → 403', [lista.status, crear.status, editar.status, papeles.status], [403, 403, 403, 403])
    check('ninguna escribe', fakeD.writes(marca).length === 0, fakeD.writes(marca))
  }

  print('\n  POST /api/executives: la vacante nueva queda en una empresa')
  {
    const crear = (cuerpo: Record<string, unknown>) =>
      executivesPost(aRuta('/api/executives', { userId: D_DIRECTORA, cuerpo: { full_name: 'Vacante Cali', base_kam_id: KAM_BAQ, status: 'placeholder', lines: [], ...cuerpo } }))
    const r = await crear({})
    const cuerpo = (await cuerpoDe(r)) as { executive?: { id: string } }
    eq('sin empresa_id → 201', r.status, 201)
    eq('executive_empresas con la empresa activa (VG), activa', tablasD.executive_empresas.filter(e => e.executive_id === cuerpo.executive?.id).map(e => [e.empresa_id, e.activo]), [[EMPRESA_VG_ID, true]])

    const marca = fakeD.requests.length
    const personas = tablasD.executives.length
    const ajena = await crear({ full_name: 'Vacante Medix', empresa_id: EMPRESA_MEDIX_ID })
    eq("con empresa_id de Medix siendo la sesión solo de VG → 400 'Esa empresa no es tuya'", [ajena.status, ((await cuerpoDe(ajena)) as { error?: string }).error], [400, 'Esa empresa no es tuya'])
    check('y nada escrito', fakeD.writes(marca).length === 0 && tablasD.executives.length === personas, fakeD.writes(marca))
  }

  print('\n  Sin la 0960: las rutas viejas siguen; la de papeles responde 503')
  {
    const { empresa_activa_id: _sinColumna, ...adminSinColumna } = usuario(D_ADMIN, 'admin', 'Admin')
    const { empresa_activa_id: _sinColumna2, ...visorSinColumna } = usuario(D_OTRA, 'viewer', 'Visor')
    const antes: Tablas = { users: [adminSinColumna, visorSinColumna], executives: [] }
    const fakeAntes = fakeSupabase(antes)
    fetchHandler = fakeAntes.handler
    const logs = moduleLogs.length

    const lista = await usersGet(aRuta('/api/users', { userId: D_ADMIN }))
    const cuerpo = (await cuerpoDe(lista)) as { users?: { papeles?: unknown[] }[] }
    eq('GET /api/users → 200 y papeles [] para todos', [lista.status, cuerpo.users?.map(u => u.papeles)], [200, [[], []]])

    const crear = await usersPost(aRuta('/api/users', { userId: D_ADMIN, cuerpo: { email: 'vieja@prueba.test', password: 'Clave-de-prueba-123', full_name: 'Vieja', role: 'line_leader' } }))
    eq("POST /api/users con role 'line_leader' → 200 (sin la tabla, solo users.role)", crear.status, 200)
    eq("users.role = 'line_leader'", antes.users.find(u => u.email === 'vieja@prueba.test')?.role, 'line_leader')

    const editar = await userPut(aRuta(`/api/users/${D_OTRA}`, { userId: D_ADMIN, cuerpo: { role: 'hr' }, metodo: 'PUT' }), { params: { id: D_OTRA } })
    eq("PUT /api/users/[id] con role 'hr' → 200 y users.role = 'hr'", [editar.status, antes.users.find(u => u.id === D_OTRA)?.role], [200, 'hr'])

    const papeles = await papelesPut(aRuta(`/api/users/${D_OTRA}/papeles`, { userId: D_ADMIN, cuerpo: { empresa_id: EMPRESA_VG_ID, papeles: [] }, metodo: 'PUT' }), { params: { id: D_OTRA } })
    eq("PUT …/papeles → 503 { error: 'Falta aplicar la migración 0960' }", [papeles.status, await cuerpoDe(papeles)], [503, { error: 'Falta aplicar la migración 0960' }])
    check('sin console.error', moduleLogs.length === logs, moduleLogs.slice(logs))
    fetchHandler = fake.handler
  }
  check('ninguna petición salió del Supabase falso de usuarios', fakeD.external.length === 0, fakeD.external)
  fetchHandler = fake.handler

  print('\nE. Líneas por empresa')

  const E_ADMIN = '00000000-0000-4000-8000-0000000000e1' // admin en VG
  const E_PAOLA = '00000000-0000-4000-8000-0000000000e2' // line_leader de Trauma en VG
  const E_GERENTE = '00000000-0000-4000-8000-0000000000e3' // sales_manager: lines:view, sin lines:edit
  const L_E_TRAUMA = '10000000-0000-4000-8000-0000000000e1' // en VG (con líder activo y asignaciones)
  const L_E_COLUMNA = '10000000-0000-4000-8000-0000000000e2' // en VG y Medix; sin líder en Medix
  const L_E_RODILLA = '10000000-0000-4000-8000-0000000000e3' // en VG; con una asignación en VG
  const E_EMPRESA_INACTIVA = '00000000-0000-4000-8000-0000000000ee'
  const E_KAM = '20000000-0000-4000-8000-0000000000e1'
  const E_EJEC = '30000000-0000-4000-8000-0000000000e1'
  const datosLineas = (): Tablas => ({
    users: [usuario(E_ADMIN, 'admin', 'Admin E'), usuario(E_PAOLA, 'line_leader', 'Paola E'), usuario(E_GERENTE, 'sales_manager', 'Gerente E')],
    empresas: [
      empresa(EMPRESA_VG_ID, 'vg', 'VG Medical S.A.S.', 'VG Medical'),
      empresa(EMPRESA_MEDIX_ID, 'medix', 'Medix', 'Medix'),
      { ...empresa(E_EMPRESA_INACTIVA, 'vieja', 'Vieja S.A.', 'Vieja'), activa: false },
    ],
    papeles: [
      papel('50000000-0000-4000-8000-0000000000e1', E_ADMIN, EMPRESA_VG_ID, 'admin'),
      papel('50000000-0000-4000-8000-0000000000e2', E_PAOLA, EMPRESA_VG_ID, 'line_leader', L_E_TRAUMA),
      papel('50000000-0000-4000-8000-0000000000e3', E_GERENTE, EMPRESA_VG_ID, 'sales_manager'),
      // Un líder INACTIVO de Columna en VG no impide quitar la empresa
      papel('50000000-0000-4000-8000-0000000000e4', E_PAOLA, EMPRESA_VG_ID, 'line_leader', L_E_COLUMNA, false),
    ],
    papel_zonas: [],
    linea_empresas: [
      { line_id: L_E_TRAUMA, empresa_id: EMPRESA_VG_ID },
      { line_id: L_E_COLUMNA, empresa_id: EMPRESA_VG_ID },
      { line_id: L_E_COLUMNA, empresa_id: EMPRESA_MEDIX_ID },
      { line_id: L_E_RODILLA, empresa_id: EMPRESA_VG_ID },
    ],
    business_lines: [
      { id: L_E_TRAUMA, code: 'trauma', name: 'Trauma', leader_user_id: E_PAOLA, max_reach_minutes: 300, sort_order: 1, active: true },
      { id: L_E_COLUMNA, code: 'columna', name: 'Columna', leader_user_id: null, max_reach_minutes: 300, sort_order: 2, active: true },
      { id: L_E_RODILLA, code: 'rodilla', name: 'Rodilla', leader_user_id: null, max_reach_minutes: 300, sort_order: 3, active: true },
    ],
    line_zones: [],
    asignaciones: [{ id: 'ae1', executive_id: E_EJEC, kam_id: E_KAM, line_id: L_E_RODILLA, empresa_id: EMPRESA_VG_ID, created_by: null }],
  })
  const tablasE = datosLineas()
  const fakeE = fakeSupabase(tablasE)
  fetchHandler = fakeE.handler
  type LineaE = { id: string; name: string; empresas: { id: string; codigo: string; nombre_corto: string }[] }
  const empresasDeLinea = (lineId: string) => tablasE.linea_empresas.filter(f => f.line_id === lineId).map(f => f.empresa_id).sort()
  const patchLinea = (quien: string | undefined, id: string, cuerpo: unknown) =>
    lineaPatch(aRuta(`/api/business-lines/${id}`, { userId: quien, cuerpo, metodo: 'PATCH' }), { params: { id } })

  print('\n  GET /api/business-lines: cada línea trae sus empresas, por código')
  {
    const r = await lineasGet(aRuta('/api/business-lines', { userId: E_GERENTE }))
    const cuerpo = (await cuerpoDe(r)) as { lines?: LineaE[] }
    eq('200', r.status, 200)
    eq('Columna: medix y vg (orden por código), con id y nombre_corto', cuerpo.lines?.find(l => l.id === L_E_COLUMNA)?.empresas, [
      { id: EMPRESA_MEDIX_ID, codigo: 'medix', nombre_corto: 'Medix' },
      { id: EMPRESA_VG_ID, codigo: 'vg', nombre_corto: 'VG Medical' },
    ])
    eq('Trauma: solo vg', cuerpo.lines?.find(l => l.id === L_E_TRAUMA)?.empresas.map(e => e.codigo), ['vg'])
  }

  print('\n  PATCH empresa_ids: agrega Medix a Trauma')
  {
    const r = await patchLinea(E_ADMIN, L_E_TRAUMA, { empresa_ids: [EMPRESA_VG_ID, EMPRESA_MEDIX_ID, EMPRESA_MEDIX_ID.toUpperCase()] })
    const cuerpo = (await cuerpoDe(r)) as { line?: LineaE; error?: string }
    eq('200', r.status, 200)
    eq('la respuesta trae las dos, por código', cuerpo.line?.empresas.map(e => e.codigo), ['medix', 'vg'])
    eq('linea_empresas de Trauma: vg y medix (sin duplicar)', empresasDeLinea(L_E_TRAUMA), [EMPRESA_VG_ID, EMPRESA_MEDIX_ID].sort())
    const get = (await cuerpoDe(await lineasGet(aRuta('/api/business-lines', { userId: E_ADMIN })))) as { lines?: LineaE[] }
    eq('y GET muestra las dos', get.lines?.find(l => l.id === L_E_TRAUMA)?.empresas.map(e => e.codigo), ['medix', 'vg'])
  }

  print('\n  PATCH empresa_ids: quita Medix a Columna (su líder en VG está inactivo; en Medix no hay nadie)')
  {
    const r = await patchLinea(E_ADMIN, L_E_COLUMNA, { empresa_ids: [EMPRESA_VG_ID] })
    eq('200', r.status, 200)
    eq('linea_empresas de Columna: solo vg', empresasDeLinea(L_E_COLUMNA), [EMPRESA_VG_ID])
  }

  print('\n  Foco 5: quitar VG a Trauma con Paola de líder activa → 409 y nada escrito')
  {
    const antes = JSON.stringify(tablasE.linea_empresas)
    const marca = fakeE.requests.length
    const r = await patchLinea(E_ADMIN, L_E_TRAUMA, { empresa_ids: [EMPRESA_MEDIX_ID] })
    const cuerpo = (await cuerpoDe(r)) as { error?: string }
    eq("409 'Esa línea tiene líder o asignaciones en VG Medical'", [r.status, cuerpo.error], [409, 'Esa línea tiene líder o asignaciones en VG Medical'])
    check('linea_empresas intacta y ninguna escritura', JSON.stringify(tablasE.linea_empresas) === antes && fakeE.writes(marca).length === 0, fakeE.writes(marca))
  }

  print('\n  Quitar VG a Rodilla, que solo tiene una asignación en VG → 409')
  {
    const antes = JSON.stringify(tablasE.linea_empresas)
    const marca = fakeE.requests.length
    const r = await patchLinea(E_ADMIN, L_E_RODILLA, { empresa_ids: [EMPRESA_MEDIX_ID] })
    const cuerpo = (await cuerpoDe(r)) as { error?: string }
    eq('409 con el nombre de la empresa', [r.status, cuerpo.error], [409, 'Esa línea tiene líder o asignaciones en VG Medical'])
    check('nada escrito', JSON.stringify(tablasE.linea_empresas) === antes && fakeE.writes(marca).length === 0, fakeE.writes(marca))
  }

  print('\n  Cuerpos no válidos: nada se escribe')
  {
    const antes = JSON.stringify(tablasE.linea_empresas)
    const marca = fakeE.requests.length
    const vacia = await patchLinea(E_ADMIN, L_E_TRAUMA, { empresa_ids: [] })
    eq("[] → 400 'Una línea debe estar en al menos una empresa'", [vacia.status, ((await cuerpoDe(vacia)) as { error?: string }).error], [400, 'Una línea debe estar en al menos una empresa'])
    const desconocida = await patchLinea(E_ADMIN, L_E_TRAUMA, { empresa_ids: [EMPRESA_VG_ID, '00000000-0000-4000-8000-0000000000ff'] })
    eq("empresa desconocida → 400 'Empresa no válida'", [desconocida.status, ((await cuerpoDe(desconocida)) as { error?: string }).error], [400, 'Empresa no válida'])
    const inactiva = await patchLinea(E_ADMIN, L_E_TRAUMA, { empresa_ids: [EMPRESA_VG_ID, E_EMPRESA_INACTIVA] })
    eq("empresa inactiva → 400 'Empresa no válida'", [inactiva.status, ((await cuerpoDe(inactiva)) as { error?: string }).error], [400, 'Empresa no válida'])
    const noUuid = await patchLinea(E_ADMIN, L_E_TRAUMA, { empresa_ids: ['vg'] })
    eq('un id que no es uuid → 400', noUuid.status, 400)
    check('nada escrito', JSON.stringify(tablasE.linea_empresas) === antes && fakeE.writes(marca).length === 0, fakeE.writes(marca))
  }

  print('\n  Permisos: sin lines:edit → 403 y nada escrito')
  {
    const antes = JSON.stringify(tablasE.linea_empresas)
    const marca = fakeE.requests.length
    const r = await patchLinea(E_GERENTE, L_E_COLUMNA, { empresa_ids: [EMPRESA_VG_ID, EMPRESA_MEDIX_ID] })
    eq('sales_manager → 403', r.status, 403)
    const sin = await patchLinea(undefined, L_E_COLUMNA, { empresa_ids: [EMPRESA_VG_ID, EMPRESA_MEDIX_ID] })
    eq('sin sesión → 401', sin.status, 401)
    check('nada escrito', JSON.stringify(tablasE.linea_empresas) === antes && fakeE.writes(marca).length === 0, fakeE.writes(marca))
  }

  print('\n  PATCH sin empresa_ids: el resto sigue como antes')
  {
    const marca = fakeE.requests.length
    const r = await patchLinea(E_ADMIN, L_E_COLUMNA, { max_reach_minutes: 240 })
    const cuerpo = (await cuerpoDe(r)) as { line?: LineaE & { max_reach_minutes: number } }
    eq('200 y alcance 240', [r.status, cuerpo.line?.max_reach_minutes], [200, 240])
    check('no toca linea_empresas', !fakeE.writes(marca).some(w => w.table === 'linea_empresas'), fakeE.writes(marca))
  }

  print('\n  Sin la 0960 (no existe linea_empresas): GET con empresas [] y sin 500; empresa_ids → 503; lo demás sigue')
  {
    const antes: Tablas = {
      users: [usuario(E_ADMIN, 'admin', 'Admin E')],
      business_lines: [{ id: L_E_COLUMNA, code: 'columna', name: 'Columna', leader_user_id: null, max_reach_minutes: 300, sort_order: 2, active: true }],
      line_zones: [],
    }
    const { empresa_activa_id: _x, ...adminViejo } = usuario(E_ADMIN, 'admin', 'Admin E')
    antes.users = [adminViejo]
    const fakeAntes = fakeSupabase(antes)
    fetchHandler = fakeAntes.handler
    const logs = moduleLogs.length

    const get = await lineasGet(aRuta('/api/business-lines', { userId: E_ADMIN }))
    const cuerpo = (await cuerpoDe(get)) as { lines?: LineaE[] }
    eq('GET → 200 y empresas []', [get.status, cuerpo.lines?.map(l => l.empresas)], [200, [[]]])

    const marca = fakeAntes.requests.length
    const r = await patchLinea(E_ADMIN, L_E_COLUMNA, { empresa_ids: [EMPRESA_VG_ID] })
    eq("empresa_ids → 503 'Falta aplicar la migración 0960'", [r.status, ((await cuerpoDe(r)) as { error?: string }).error], [503, 'Falta aplicar la migración 0960'])
    check('nada escrito', fakeAntes.writes(marca).length === 0, fakeAntes.writes(marca))

    const otro = await patchLinea(E_ADMIN, L_E_COLUMNA, { name: 'Columna vertebral' })
    const cuerpoOtro = (await cuerpoDe(otro)) as { line?: LineaE }
    eq('el nombre sigue pudiéndose cambiar → 200 y empresas []', [otro.status, cuerpoOtro.line?.name, cuerpoOtro.line?.empresas], [200, 'Columna vertebral', []])
    check('sin console.error', moduleLogs.length === logs, moduleLogs.slice(logs))
    fetchHandler = fake.handler
  }
  check('ninguna petición salió del Supabase falso de líneas', fakeE.external.length === 0, fakeE.external)
  fetchHandler = fake.handler

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
