/**
 * Zonas por línea (spec 2026-10-23) · pruebas de GET /api/kams/zonas?line=<code> (SIN RED, sin Supabase real, sin Google).
 *
 * Llama al handler real contra un Supabase FALSO en memoria (PostgREST mínimo: eq/neq/in/is/not.is/gte/lte/gt/lt, orden,
 * rango, proyección, RPC sembradas; solo la tabla coverage admite escrituras: upsert con on_conflict y delete, lo que
 * hace recomputeAndSaveCoverage; cualquier otra escritura falla y queda registrada) y comprueba:
 *   - Quién abre la pantalla: puedeVerDatosDeZona (executives:view + hospitals:view): recursos humanos (hr) recibe 403
 *     sin leer nada más que su sesión; viewer y user la ven.
 *   - La líder de Sustitutos óseos ve las 16 Zonas activas con cifras, quién vive en cada una y el estado en SU línea;
 *     ?line= de otra línea (o de una inactiva) responde 403; y nunca recibe códigos, nombres ni ids de líneas que no ve:
 *     las líneas de cada residente se recortan a las suyas (como /api/map/data). Los residentes sí salen todos: para dar
 *     su línea tiene que ver quién vive en la Zona.
 *   - Cifras con las reglas de "Datos de la zona": la suma de IPS por Zona es la de las IPS asignadas a Zonas activas;
 *     Bogotá (un municipio con IPS en cuatro Zonas) se reparte por camas sin contarse dos veces y se agrega en `bogota`;
 *     el giro de un NIT con tres sedes en dos Zonas se reparte por camas y suma el total una sola vez; población y
 *     afiliados salen "sin dato" (null) cuando ningún municipio de la Zona tiene la cifra.
 *   - Cobertura: la tabla guardada está vieja (Neiva sin cobertura aunque Vacante Neiva lleva la línea, como en
 *     producción el 2026-10-11) → la ruta recalcula y guarda UNA vez (upsert + delete en coverage), responde
 *     recalculada: true y el estado sale del cálculo (Neiva reservada); la segunda vez coincide y no escribe.
 *   - Estados (estadoDePlaza): ocupada, reservada (vacante local), por alcance con origen y minutos, sin cobertura con
 *     la más cercana, conflicto con los nombres, ajuste manual con su motivo, insignia "Sin equipo"; y la regla del
 *     dueño: la vacante compite por alcance como una persona (Trauma: Cartagena la toma Vacante Barranquilla).
 *   - executive_allowed_lines: con filas, lineasPermitidas recortadas a las líneas que ve el usuario; sin la tabla
 *     (migración 0860 sin aplicar), null para todos, una nota y nunca 500.
 *   - acceso según rol y línea: la líder asigna y ajusta solo en la suya; dirección comercial asigna pero no administra
 *     Zonas; viewer y sales_manager no asignan; admin todo.
 *   - Ninguna petición sale del Supabase falso (nada de Google).
 *
 * El patrón del Supabase falso viene de scripts/zona-estadisticas-api-check.ts y terceros-api-check.ts (copiado).
 * Uso (desde web/): npx tsx scripts/zonas-api-check.ts      Código de salida 1 si alguna prueba falla.
 */
import { randomUUID } from 'node:crypto'
import { NextRequest } from 'next/server'
import { passwordVersion, SESSION_COOKIE_NAME, signSession } from '../lib/session'
import type { ZonaFila, ZonasResponse } from '../lib/types/zonas'
import { GET as zonasGet } from '../app/api/kams/zonas/route'

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
process.env.SESSION_SECRET = 'secreto-de-prueba-zonas-api-check-0123456789abcdefghijklmnopqrstuvwxyz'

// Despachador único: sin manejador cualquier fetch falla; con él, solo responde el Supabase falso.
type FetchHandler = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
let fetchHandler: FetchHandler | null = null
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  if (!fetchHandler) throw new Error('zonas-api-check: la red está prohibida en estas pruebas')
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

/** RPC sembradas: nombre → respuesta. Las demás responden "no existe" (PGRST202). */
type Rpcs = Record<string, (body: unknown) => unknown>

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

/** Restricciones únicas que importan a estas rutas. */
const UNICAS: Record<string, { nombre: string; columnas: string[] }[]> = {
  coverage: [{ nombre: 'coverage_line_id_kam_id_key', columnas: ['line_id', 'kam_id'] }],
  executive_lines: [{ nombre: 'executive_lines_pkey', columnas: ['executive_id', 'line_id'] }],
}
const SIN_ID = new Set(['executive_lines', 'executive_allowed_lines'])

function fakeSupabase(tablas: Tablas, rpcs: Rpcs, escribibles: ReadonlySet<string>) {
  const requests: FakeRequest[] = []
  const external: string[] = []
  const json = (payload: unknown, status = 200) => new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json' } })
  const pgError = (code: string, message: string, status: number) => json({ code, message, details: null, hint: null }, status)
  const store = (table: string) => (tablas[table] = tablas[table] ?? [])

  const handler: FetchHandler = async (input, init) => {
    const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const url = new URL(href)
    if (url.origin !== FAKE_SUPABASE_URL) {
      external.push(url.origin)
      throw new Error(`zonas-api-check: intento de red a ${url.origin}`)
    }
    const method = (init?.method || 'GET').toUpperCase()
    const table = url.pathname.replace('/rest/v1/', '')
    const body = init?.body ? JSON.parse(String(init.body)) : undefined
    requests.push({ method, table, params: url.searchParams, body })
    const select = url.searchParams.get('select')

    if (table.startsWith('rpc/')) {
      const rpc = rpcs[table.slice(4)]
      if (!rpc) return pgError('PGRST202', `Could not find the function public.${table.slice(4)}`, 404)
      return json(rpc(body))
    }
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

    // Escrituras: solo en las tablas permitidas por la prueba (lo demás es un error de la ruta y queda en requests).
    if (!escribibles.has(table)) return pgError('42501', `Supabase falso: escritura no permitida (${method} ${table})`, 403)

    if (method === 'POST') {
      const nuevas = (Array.isArray(body) ? body : [body]) as Fila[]
      const onConflict = url.searchParams.get('on_conflict')?.split(',').map(part => part.trim()) ?? null
      const out: Fila[] = []
      for (const nueva of nuevas) {
        if (onConflict) {
          // upsert: la fila con las mismas columnas de conflicto se actualiza en su sitio
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
      return json(borradas.map(row => project(row, select)))
    }
    throw new Error(`Supabase falso: método no soportado ${method}`)
  }

  const writes = () => requests.filter(request => request.method !== 'GET' && !request.table.startsWith('rpc/'))
  return { handler, requests, external, writes, tablas }
}

// ---------------------------------------------------------------------------
// Datos: 16 Zonas activas (las de producción, con Bogotá en cuatro celdas) y una inactiva, 5 líneas y una inactiva
// ---------------------------------------------------------------------------

const id = (prefix: string, n: number) => `${prefix}-0000-4000-8000-${String(n).padStart(12, '0')}`

// Usuarios
const ADMIN = id('00000000', 1)
const LIDER_S = id('00000000', 2) // line_leader de Sustitutos óseos
const LIDER_R = id('00000000', 3) // line_leader de Reemplazo articular
const VISOR = id('00000000', 4) // viewer (map:all-lines, sin executives:lines)
const RRHH = id('00000000', 5) // hr (sin hospitals:view)
const DIRECTORA = id('00000000', 6) // commercial_director
const USUARIO = id('00000000', 7) // user sin líneas
const VENDEDOR = id('00000000', 8) // sales_manager enlazado a Carmen (lleva Sustitutos óseos y Reemplazo articular)

// Líneas
const L_SUS = id('10000000', 1)
const L_REE = id('10000000', 2)
const L_MED = id('10000000', 3)
const L_COL = id('10000000', 4)
const L_TRA = id('10000000', 5)
const L_OLD = id('10000000', 6) // inactiva

// Zonas (kams)
const BAQ = id('20000000', 1)
const CTG = id('20000000', 2)
const VUP = id('20000000', 3)
const MDE = id('20000000', 4)
const PEI = id('20000000', 5)
const CLO = id('20000000', 6)
const BGA = id('20000000', 7)
const CUC = id('20000000', 8)
const IBE = id('20000000', 9)
const NVA = id('20000000', 10)
const VVC = id('20000000', 11)
const MTR = id('20000000', 12)
const CHA = id('20000000', 13) // Bogotá Chapinero
const ENG = id('20000000', 14) // Bogotá Engativá
const KEN = id('20000000', 15) // Bogotá Kennedy
const SCR = id('20000000', 16) // Bogotá San Cristóbal
const SIN = id('20000000', 17) // Sincelejo, inactiva

// Ejecutivos Comerciales y vacantes
const CARMEN = id('30000000', 1) // Barranquilla: Sustitutos óseos y Reemplazo articular (limitada a esas dos)
const VAC_BAQ = id('30000000', 2) // Vacante · Barranquilla: Medicina deportiva, Columna y Trauma (limitada a esas)
const MARTA = id('30000000', 3) // Medellín: Sustitutos óseos
const MATEO = id('30000000', 4) // Medellín: Sustitutos óseos (conflicto con Marta)
const PAULA = id('30000000', 5) // Pereira: sin líneas
const LUCIA = id('30000000', 6) // Cali: Reemplazo articular
const VAC_BOG = id('30000000', 7) // Vacante · Bogotá (Chapinero): Reemplazo articular, Medicina deportiva, Columna
const VAC_CUC = id('30000000', 8) // Vacante · Cúcuta: Sustitutos óseos
const VAC_NVA = id('30000000', 9) // Vacante · Neiva: Sustitutos óseos
const LINDA = id('30000000', 10) // Cúcuta, inactiva (no cuenta)
const CARLA = id('30000000', 11) // sin zona base (no vive en ninguna Zona)

// IPS
const H_BAQ1 = id('40000000', 1)
const H_BAQ2 = id('40000000', 2)
const H_CTG1 = id('40000000', 3)
const H_VUP = id('40000000', 4)
const H_MDE = id('40000000', 5)
const H_PEI = id('40000000', 6)
const H_CLO = id('40000000', 7)
const H_BGA = id('40000000', 8)
const H_CUC = id('40000000', 9)
const H_IBE = id('40000000', 10)
const H_NVA = id('40000000', 11)
const H_VVC = id('40000000', 12)
const H_MTR = id('40000000', 13)
const H_CHA = id('40000000', 14)
const H_ENG = id('40000000', 15)
const H_KEN = id('40000000', 16)
const H_SCR = id('40000000', 17)
const H_SIN = id('40000000', 18) // asignada a Sincelejo (inactiva)
const H_LIBRE = id('40000000', 19) // activa sin Zona
const H_OFF = id('40000000', 20) // inactiva, asignada a Barranquilla (no cuenta)

const OVR_VVC = id('50000000', 1) // ajuste manual: Sustitutos óseos × Villavicencio → Marta

const NIT_COSTA = '890102345' // tres sedes: dos en Barranquilla (150 y 50 camas) y una en Cartagena (100)
const GIRO_NIT_COSTA = 1_000_000
const CALCULO_VIEJO = '2026-10-11T15:00:00.000Z'

function usuario(uid: string, role: string, nombre: string): Fila {
  return { id: uid, email: `${role}-${uid.slice(-4)}@prueba.test`, full_name: nombre, role, active: true, password: `hash-${uid}` }
}

function linea(lid: string, code: string, name: string, leader: string | null, sort_order: number, active = true): Fila {
  return { id: lid, code, name, leader_user_id: leader, max_reach_minutes: 240, sort_order, active }
}

function zona(kid: string, name: string, area_id: string, color: string, active = true): Fila {
  return { id: kid, name, area_id, base_city: name.replace(/^KAM /, '').replace(/^Bogotá .*/, 'Bogotá'), color, active, participates_in_assignment: true }
}

function hospital(hid: string, code: string, name: string, municipality_id: string, department_id: string, beds: number, extra: Fila = {}): Fila {
  return {
    id: hid,
    code,
    name,
    municipality_id,
    municipality_name: null,
    department_id,
    department_name: null,
    locality_id: null,
    beds,
    reps_beds: null,
    quirofanos: null,
    active: true,
    ...extra,
  }
}

function ejecutivo(eid: string, full_name: string, status: string, base_kam_id: string | null, user_id: string | null = null): Fila {
  return { id: eid, full_name, status, base_kam_id, user_id, color: null, created_at: '2026-10-01T00:00:00.000Z' }
}

let distanciaId = 0
/** hospital_kam_distances: travel_time en SEGUNDOS desde la Zona (kam_id) a la IPS. */
function distancia(kam_id: string, hospital_id: string, minutos: number): Fila {
  return { id: ++distanciaId, kam_id, hospital_id, travel_time: minutos * 60 }
}

function coberturaVieja(line_id: string, kam_id: string, executive_id: string | null, kind: string): Fila {
  return {
    id: randomUUID(),
    line_id,
    kam_id,
    executive_id,
    kind,
    travel_minutes: kind === 'local' ? 0 : null,
    source_kam_id: kind === 'local' ? kam_id : null,
    nearest_executive_id: null,
    nearest_minutes: null,
    has_equipment: true,
    note: null,
    computed_at: CALCULO_VIEJO,
  }
}

function dane(municipality_code: string, total: number): Fila {
  return { municipality_code, anio: 2026, total, cabecera: Math.round(total * 0.9), resto: total - Math.round(total * 0.9) }
}

function datosIniciales(): Tablas {
  return {
    users: [
      usuario(ADMIN, 'admin', 'Admin'),
      usuario(LIDER_S, 'line_leader', 'Líder de Sustitutos óseos'),
      usuario(LIDER_R, 'line_leader', 'Líder de Reemplazo articular'),
      usuario(VISOR, 'viewer', 'Visor'),
      usuario(RRHH, 'hr', 'Recursos humanos'),
      usuario(DIRECTORA, 'commercial_director', 'Dirección comercial'),
      usuario(USUARIO, 'user', 'Usuario'),
      usuario(VENDEDOR, 'sales_manager', 'Carmen López'),
    ],
    business_lines: [
      linea(L_SUS, 'sustitutos', 'Sustitutos óseos', LIDER_S, 1),
      linea(L_REE, 'reemplazo', 'Reemplazo articular', LIDER_R, 2),
      linea(L_MED, 'medicina', 'Medicina deportiva', null, 3),
      linea(L_COL, 'columna', 'Columna', null, 4),
      linea(L_TRA, 'trauma', 'Trauma', null, 5),
      linea(L_OLD, 'legacy', 'Línea antigua', null, 6, false),
    ],
    kams: [
      zona(BAQ, 'Barranquilla', '08001', '#d62728'),
      zona(CTG, 'Cartagena', '13001', '#1f77b4'),
      zona(VUP, 'Valledupar', '20001', '#2ca02c'),
      zona(MDE, 'Medellín', '05001', '#9467bd'),
      zona(PEI, 'Pereira', '66001', '#8c564b'),
      zona(CLO, 'Cali', '76001', '#e377c2'),
      zona(BGA, 'Bucaramanga', '68001', '#7f7f7f'),
      zona(CUC, 'Cúcuta', '54001', '#bcbd22'),
      zona(IBE, 'Ibagué', '73001', '#17becf'),
      zona(NVA, 'Neiva', '41001', '#ff7f0e'),
      zona(VVC, 'Villavicencio', '50001', '#1b9e77'),
      zona(MTR, 'KAM Montería', '23001', '#d95f02'), // el prefijo "KAM " no se muestra
      zona(CHA, 'Bogotá Chapinero', '1100102', '#7570b3'),
      zona(ENG, 'Bogotá Engativá', '1100110', '#e7298a'),
      zona(KEN, 'Bogotá Kennedy', '1100108', '#66a61e'),
      zona(SCR, 'Bogotá San Cristóbal', '1100104', '#e6ab02'),
      zona(SIN, 'Sincelejo', '70001', '#a6761d', false),
    ],
    executives: [
      ejecutivo(CARMEN, 'Carmen López', 'active', BAQ, VENDEDOR),
      ejecutivo(VAC_BAQ, 'Vacante · Barranquilla', 'placeholder', BAQ),
      ejecutivo(MARTA, 'Marta Gil', 'active', MDE),
      ejecutivo(MATEO, 'Mateo Ruiz', 'active', MDE),
      ejecutivo(PAULA, 'Paula Mora', 'active', PEI),
      ejecutivo(LUCIA, 'Lucía Páez', 'active', CLO),
      ejecutivo(VAC_BOG, 'Vacante · Bogotá', 'placeholder', CHA),
      ejecutivo(VAC_CUC, 'Vacante · Cúcuta', 'placeholder', CUC),
      ejecutivo(VAC_NVA, 'Vacante · Neiva', 'placeholder', NVA),
      ejecutivo(LINDA, 'Linda Vega', 'inactive', CUC),
      ejecutivo(CARLA, 'Carla Díaz', 'active', null),
    ],
    executive_lines: [
      { executive_id: CARMEN, line_id: L_SUS },
      { executive_id: CARMEN, line_id: L_REE },
      { executive_id: VAC_BAQ, line_id: L_MED },
      { executive_id: VAC_BAQ, line_id: L_COL },
      { executive_id: VAC_BAQ, line_id: L_TRA },
      { executive_id: MARTA, line_id: L_SUS },
      { executive_id: MATEO, line_id: L_SUS },
      { executive_id: LUCIA, line_id: L_REE },
      { executive_id: VAC_BOG, line_id: L_REE },
      { executive_id: VAC_BOG, line_id: L_MED },
      { executive_id: VAC_BOG, line_id: L_COL },
      { executive_id: VAC_CUC, line_id: L_SUS },
      { executive_id: VAC_NVA, line_id: L_SUS },
      { executive_id: LINDA, line_id: L_SUS },
      { executive_id: CARLA, line_id: L_REE },
    ],
    // Líneas permitidas por la dirección (migración 0860): Carmen y Vacante Barranquilla; las demás sin restricción
    executive_allowed_lines: [
      { executive_id: CARMEN, line_id: L_SUS },
      { executive_id: CARMEN, line_id: L_REE },
      { executive_id: VAC_BAQ, line_id: L_MED },
      { executive_id: VAC_BAQ, line_id: L_COL },
      { executive_id: VAC_BAQ, line_id: L_TRA },
    ],
    line_zones: [{ line_id: L_SUS, kam_id: CLO, has_equipment: false }],
    coverage_overrides: [
      { id: OVR_VVC, line_id: L_SUS, kam_id: VVC, executive_id: MARTA, reason: 'Villavicencio lo atiende Marta desde Medellín', active: true, created_at: '2026-10-05T00:00:00.000Z' },
    ],
    // Tabla coverage vieja (2026-10-11): Neiva sin cobertura aunque Vacante Neiva lleva la línea; Linda aún activa;
    // una celda de la línea inactiva que el recálculo debe limpiar.
    coverage: [
      coberturaVieja(L_SUS, NVA, null, 'vacant'),
      coberturaVieja(L_SUS, BAQ, CARMEN, 'local'),
      coberturaVieja(L_SUS, CUC, LINDA, 'local'),
      coberturaVieja(L_OLD, BAQ, null, 'vacant'),
    ],
    hospitals: [
      hospital(H_BAQ1, `${NIT_COSTA}-1`, 'Clínica de la Costa sede norte', '08001', '08', 150),
      hospital(H_BAQ2, `${NIT_COSTA}-2`, 'Clínica de la Costa sede sur', '08001', '08', 50),
      hospital(H_CTG1, `${NIT_COSTA}-3`, 'Clínica de la Costa Cartagena', '13001', '13', 100),
      hospital(H_VUP, '892300001-1', 'Hospital de Valledupar', '20001', '20', 80),
      hospital(H_MDE, '890900001-1', 'Hospital de Medellín', '05001', '05', 400),
      hospital(H_PEI, '891400001-1', 'Hospital de Pereira', '66001', '66', 120),
      hospital(H_CLO, '890300001-1', 'Hospital de Cali', '76001', '76', 350),
      hospital(H_BGA, '890200001-1', 'Hospital de Bucaramanga', '68001', '68', 200),
      hospital(H_CUC, '890500001-1', 'Hospital de Cúcuta', '54001', '54', 150),
      hospital(H_IBE, '890700001-1', 'Hospital de Ibagué', '73001', '73', 90),
      hospital(H_NVA, '891180008-1', 'Hospital de Neiva', '41001', '41', 300),
      hospital(H_VVC, '892000001-1', 'Hospital de Villavicencio', '50001', '50', 110),
      hospital(H_MTR, '891000001-1', 'Hospital de Montería', '23001', '23', 100),
      hospital(H_CHA, '860000001-1', 'Clínica de Chapinero', '11001', '11', 300, { locality_id: '1100102' }),
      hospital(H_ENG, '860000002-1', 'Clínica de Engativá', '11001', '11', 200, { locality_id: '1100110' }),
      hospital(H_KEN, '860000003-1', 'Clínica de Kennedy', '11001', '11', 100, { locality_id: '1100108' }),
      hospital(H_SCR, '860000004-1', 'Clínica de San Cristóbal', '11001', '11', 400, { locality_id: '1100104' }),
      hospital(H_SIN, '892200001-1', 'Hospital de Sincelejo', '70001', '70', 60),
      hospital(H_LIBRE, '892200002-1', 'Clínica sin zona', '70001', '70', 40),
      hospital(H_OFF, '890102999-1', 'Clínica cerrada', '08001', '08', 500, { active: false }),
    ],
    assignments: [
      ...[
        [H_BAQ1, BAQ], [H_BAQ2, BAQ], [H_CTG1, CTG], [H_VUP, VUP], [H_MDE, MDE], [H_PEI, PEI], [H_CLO, CLO], [H_BGA, BGA],
        [H_CUC, CUC], [H_IBE, IBE], [H_NVA, NVA], [H_VVC, VVC], [H_MTR, MTR], [H_CHA, CHA], [H_ENG, ENG], [H_KEN, KEN],
        [H_SCR, SCR], [H_SIN, SIN], [H_OFF, BAQ],
      ].map(([hospital_id, kam_id]) => ({ hospital_id, kam_id, assigned_at: '2026-10-01T00:00:00.000Z' })),
    ],
    hospital_kam_distances: [
      distancia(BAQ, H_CTG1, 146),
      distancia(BAQ, H_VUP, 450),
      distancia(BAQ, H_MTR, 300),
      distancia(MDE, H_PEI, 200),
      distancia(CLO, H_PEI, 190),
      distancia(MDE, H_VVC, 600),
      distancia(CHA, H_ENG, 26),
      distancia(CHA, H_KEN, 30),
      distancia(CHA, H_SCR, 28),
      distancia(CUC, H_BGA, 180),
      distancia(NVA, H_IBE, 210),
      distancia(CLO, H_IBE, 300),
    ],
    municipalities: [
      { code: '08001', name: 'Barranquilla', department_code: '08', population_2025: null },
      { code: '08758', name: 'Soledad', department_code: '08', population_2025: null },
      { code: '13001', name: 'Cartagena', department_code: '13', population_2025: null },
      { code: '13836', name: 'Turbaco', department_code: '13', population_2025: null },
      { code: '20001', name: 'Valledupar', department_code: '20', population_2025: null },
      { code: '20013', name: 'Agustín Codazzi', department_code: '20', population_2025: null },
      { code: '05001', name: 'Medellín', department_code: '05', population_2025: null },
      { code: '05088', name: 'Bello', department_code: '05', population_2025: null },
      { code: '66001', name: 'Pereira', department_code: '66', population_2025: null },
      { code: '76001', name: 'Cali', department_code: '76', population_2025: null },
      { code: '68001', name: 'Bucaramanga', department_code: '68', population_2025: null },
      { code: '54001', name: 'Cúcuta', department_code: '54', population_2025: null },
      { code: '73001', name: 'Ibagué', department_code: '73', population_2025: null },
      { code: '41001', name: 'Neiva', department_code: '41', population_2025: null },
      { code: '50001', name: 'Villavicencio', department_code: '50', population_2025: null },
      { code: '23001', name: 'Montería', department_code: '23', population_2025: null },
      { code: '11001', name: 'Bogotá D.C.', department_code: '11', population_2025: null },
      { code: '25754', name: 'Soacha', department_code: '25', population_2025: null },
      { code: '70001', name: 'Sincelejo', department_code: '70', population_2025: null },
    ],
    departments: [
      { code: '08', name: 'Atlántico' }, { code: '13', name: 'Bolívar' }, { code: '20', name: 'Cesar' }, { code: '05', name: 'Antioquia' },
      { code: '66', name: 'Risaralda' }, { code: '76', name: 'Valle del Cauca' }, { code: '68', name: 'Santander' }, { code: '54', name: 'Norte de Santander' },
      { code: '73', name: 'Tolima' }, { code: '41', name: 'Huila' }, { code: '50', name: 'Meta' }, { code: '23', name: 'Córdoba' },
      { code: '11', name: 'Bogotá D.C.' }, { code: '25', name: 'Cundinamarca' }, { code: '70', name: 'Sucre' },
    ],
    // Municipios sin IPS por tiempo real de carretera (Fase 2b); fuera de alcance no cuenta para nadie
    municipality_zone: [
      ...['08001', '13001', '20001', '05001', '66001', '76001', '68001', '54001', '73001', '41001', '50001', '23001', '11001', '70001'].map(code => ({
        municipality_code: code,
        kam_id: code === '11001' ? CHA : code === '70001' ? SIN : null,
        kind: 'ips',
        computed_at: CALCULO_VIEJO,
      })),
      { municipality_code: '08758', kam_id: BAQ, kind: 'reach', computed_at: CALCULO_VIEJO },
      { municipality_code: '13836', kam_id: CTG, kind: 'reach', computed_at: CALCULO_VIEJO },
      { municipality_code: '05088', kam_id: MDE, kind: 'reach', computed_at: CALCULO_VIEJO },
      { municipality_code: '25754', kam_id: KEN, kind: 'reach', computed_at: CALCULO_VIEJO },
      { municipality_code: '20013', kam_id: null, kind: 'out_of_reach', computed_at: CALCULO_VIEJO },
    ],
    dane_proyecciones: [
      dane('08001', 1_300_000), dane('08758', 700_000), dane('13001', 1_050_000), dane('13836', 80_000), dane('20001', 550_000),
      dane('20013', 60_000), dane('05001', 2_600_000), dane('05088', 560_000), dane('66001', 480_000), dane('76001', 2_300_000),
      dane('68001', 610_000), dane('54001', 780_000), dane('73001', 540_000), dane('41001', 380_000), dane('50001', 560_000),
      dane('23001', 520_000), dane('11001', 8_000_000), dane('25754', 800_000), dane('70001', 300_000),
    ],
    // Identifica tu Giro cargado de oct-2025 a sep-2026 (sin Reporte 29 ni bitácora: la fuente automática es Identifica)
    adres_giros_detalle: [{ fecha_giro: '2025-10-15' }, { fecha_giro: '2026-09-20' }],
  }
}

const RPCS: Rpcs = {
  poblacion_cortes: () => ({ cifras: [], bdua: ['2026-06-30'], dane: [2026] }),
  poblacion_bdua_resumen: () => ({
    municipios: [
      { m: '08001', c: 700_000, s: 500_000 },
      { m: '11001', c: 5_000_000, s: 2_000_000 },
    ],
    eps: [],
    nombres: {},
  }),
  adres_giros_intel: () => ({ nits: [{ nit: NIT_COSTA, contributivo: 600_000, subsidiado: 400_000 }] }),
}

// Solo la tabla coverage se escribe (recomputeAndSaveCoverage); cualquier otra escritura es un error de la ruta.
const ESCRIBIBLES = new Set(['coverage'])

function apiRequest(query: string, userId: string | null) {
  const headers: Record<string, string> = {}
  if (userId) headers.cookie = `${SESSION_COOKIE_NAME}=${encodeURIComponent(signSession(userId, passwordVersion(`hash-${userId}`)))}`
  return new NextRequest(`http://localhost:3000/api/kams/zonas${query}`, { method: 'GET', headers })
}

let fake = fakeSupabase(datosIniciales(), RPCS, ESCRIBIBLES)
fetchHandler = fake.handler

async function pedir(userId: string | null, query = ''): Promise<{ status: number; body: any; text: string; requests: FakeRequest[]; cache: string | null }> {
  const antes = fake.requests.length
  const response = await zonasGet(apiRequest(query, userId))
  const text = await response.text()
  let body: any = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = text
  }
  return { status: response.status, body, text, requests: fake.requests.slice(antes), cache: response.headers.get('cache-control') }
}

// Ayudas de lectura
const zonaDe = (body: ZonasResponse, nombre: string): ZonaFila | undefined => body.zonas.find(zona => zona.nombre === nombre)
const estadoDe = (body: ZonasResponse, nombre: string) => {
  const enLinea = zonaDe(body, nombre)?.enLinea
  if (!enLinea) return null
  return `${enLinea.estado}:${enLinea.ejecutivo?.nombre ?? '-'}${enLinea.desde ? ` desde ${enLinea.desde.nombre} ${enLinea.minutos} min` : ''}`
}
const residentesDe = (body: ZonasResponse, nombre: string) => (zonaDe(body, nombre)?.residentes ?? []).map(residente => residente.nombre)
const escrituras = (requests: FakeRequest[]) => requests.filter(request => request.method !== 'GET' && !request.table.startsWith('rpc/')).map(request => `${request.method} ${request.table}`)
const TOKENS_OTRAS_LINEAS = [L_REE, L_MED, L_COL, L_TRA, L_OLD, 'reemplazo', 'Reemplazo articular', 'medicina', 'Medicina deportiva', 'columna', 'Columna', 'trauma', 'Trauma', 'legacy', 'Línea antigua']
const queTraeDe = (text: string, tokens: string[]) => tokens.filter(token => text.includes(token))
const NOMBRES_ZONAS = [
  'Barranquilla', 'Bogotá Chapinero', 'Bogotá Engativá', 'Bogotá Kennedy', 'Bogotá San Cristóbal', 'Bucaramanga', 'Cali', 'Cartagena',
  'Cúcuta', 'Ibagué', 'Medellín', 'Montería', 'Neiva', 'Pereira', 'Valledupar', 'Villavicencio',
]

// ---------------------------------------------------------------------------
// Pruebas
// ---------------------------------------------------------------------------

async function main() {
  print('\nhr (sin hospitals:view)')
  {
    const r = await pedir(RRHH)
    check('403 sin leer nada más que su sesión', r.status === 403 && r.requests.every(request => request.table === 'users'), { status: r.status, tablas: r.requests.map(request => request.table) })
    const sinSesion = await pedir(null)
    check('sin sesión: 401', sinSesion.status === 401, sinSesion.body)
  }

  print('\nLíder de Sustitutos óseos · primera apertura: la cobertura guardada está vieja')
  {
    const r = await pedir(LIDER_S)
    const body = r.body as ZonasResponse
    check('200 con Cache-Control: no-store', r.status === 200 && r.cache === 'no-store', { status: r.status, cache: r.cache, body: r.body })
    eq('línea por defecto: la primera de las suyas (Sustitutos óseos)', [body.linea?.code, body.linea?.max_reach_minutes, body.lineas.map(line => line.code)], ['sustitutos', 240, ['sustitutos']])
    eq('16 Zonas activas por nombre (sin Sincelejo; "KAM Montería" sin prefijo)', body.zonas.map(zona => zona.nombre), NOMBRES_ZONAS)
    eq('cobertura: estaba desactualizada y se recalculó y guardó ahora', [body.cobertura.desactualizada, body.cobertura.recalculada, body.cobertura.calculadaEn !== CALCULO_VIEJO], [true, true, true])
    eq('escribe una sola vez: upsert de coverage y limpieza de lo viejo, nada más', escrituras(r.requests), ['POST coverage', 'DELETE coverage'])
    check('el upsert va por (line_id, kam_id)', r.requests.some(request => request.method === 'POST' && request.table === 'coverage' && request.params.get('on_conflict') === 'line_id,kam_id'))
    eq('la tabla coverage queda con las 80 celdas de hoy (5 líneas × 16 Zonas) y sin la de la línea inactiva', [fake.tablas.coverage.length, fake.tablas.coverage.some(row => row.line_id === L_OLD)], [80, false])
    check('nota: "Cobertura actualizada ahora"', body.notas.some(nota => nota.startsWith('Cobertura actualizada ahora')), body.notas)

    eq('Neiva: reservada por Vacante · Neiva (del cálculo, no de la tabla vieja)', estadoDe(body, 'Neiva'), 'reservada:Vacante · Neiva')
    eq('Barranquilla: ocupada por Carmen (local)', [estadoDe(body, 'Barranquilla'), zonaDe(body, 'Barranquilla')?.enLinea?.minutos], ['ocupada:Carmen López', 0])
    eq('Cartagena: por alcance desde Barranquilla, 2 h 26', estadoDe(body, 'Cartagena'), 'alcance:Carmen López desde Barranquilla 146 min')
    eq('Valledupar: sin cobertura; la más cercana Carmen a 450 min', [estadoDe(body, 'Valledupar'), zonaDe(body, 'Valledupar')?.enLinea?.masCercano], ['sin_cobertura:-', { id: CARMEN, nombre: 'Carmen López', status: 'active', minutos: 450 }])
    eq('Medellín: conflicto entre Marta y Mateo', [estadoDe(body, 'Medellín'), zonaDe(body, 'Medellín')?.enLinea?.nota], ['conflicto:-', 'Marta Gil, Mateo Ruiz'])
    check('Pereira: por alcance desde Medellín con la nota del empate', estadoDe(body, 'Pereira') === 'alcance:Marta Gil desde Medellín 200 min' && /Empate a 3 h 20 con Mateo Ruiz/.test(zonaDe(body, 'Pereira')?.enLinea?.nota ?? ''), zonaDe(body, 'Pereira')?.enLinea)
    eq('Cúcuta: reservada por la vacante (Linda, inactiva, ya no cuenta)', estadoDe(body, 'Cúcuta'), 'reservada:Vacante · Cúcuta')
    eq('Bucaramanga: la vacante de Cúcuta la toma por alcance (la vacante compite como una persona)', estadoDe(body, 'Bucaramanga'), 'alcance:Vacante · Cúcuta desde Cúcuta 180 min')
    eq('Ibagué: por alcance desde Neiva por la vacante', estadoDe(body, 'Ibagué'), 'alcance:Vacante · Neiva desde Neiva 210 min')
    eq('Villavicencio: ajuste manual a Marta → ocupada desde Medellín, con el motivo', [estadoDe(body, 'Villavicencio'), zonaDe(body, 'Villavicencio')?.enLinea?.ajuste], ['ocupada:Marta Gil desde Medellín 600 min', { id: OVR_VVC, motivo: 'Villavicencio lo atiende Marta desde Medellín' }])
    eq('Cali: sin cobertura, nadie cerca, y la insignia "Sin equipo"', [estadoDe(body, 'Cali'), zonaDe(body, 'Cali')?.enLinea?.masCercano, zonaDe(body, 'Cali')?.enLinea?.sinEquipo], ['sin_cobertura:-', null, true])
    eq('Montería: sin cobertura (Carmen a 300 min, sobre el tope de 240)', [estadoDe(body, 'Montería'), zonaDe(body, 'Montería')?.enLinea?.masCercano?.minutos], ['sin_cobertura:-', 300])
    eq('las cuatro celdas de Bogotá sin cobertura en esta línea', ['Bogotá Chapinero', 'Bogotá Engativá', 'Bogotá Kennedy', 'Bogotá San Cristóbal'].map(nombre => estadoDe(body, nombre)), Array(4).fill('sin_cobertura:-'))
    eq('las demás Zonas no llevan la insignia "Sin equipo"', body.zonas.filter(zona => zona.enLinea?.sinEquipo).map(zona => zona.nombre), ['Cali'])

    eq('quién vive en Barranquilla: Carmen y la vacante (todos los residentes, por nombre)', residentesDe(body, 'Barranquilla'), ['Carmen López', 'Vacante · Barranquilla'])
    eq('sus líneas recortadas a la suya: Carmen → Sustitutos óseos; la vacante → ninguna visible', zonaDe(body, 'Barranquilla')?.residentes.map(residente => residente.lineas), [['sustitutos'], []])
    eq('líneas permitidas recortadas igual: Carmen → la suya; la vacante → limitada a otras ([]); Marta sin restricción (null)', [
      ...(zonaDe(body, 'Barranquilla')?.residentes.map(residente => residente.lineasPermitidas) ?? []),
      zonaDe(body, 'Medellín')?.residentes.find(residente => residente.nombre === 'Marta Gil')?.lineasPermitidas,
    ], [['sustitutos'], [], null])
    eq('Cúcuta: solo la vacante (Linda está inactiva)', residentesDe(body, 'Cúcuta'), ['Vacante · Cúcuta'])
    eq('Pereira: Paula vive allí aunque no lleve ninguna línea (para poder darle la suya)', residentesDe(body, 'Pereira'), ['Paula Mora'])
    check('Carla, sin zona base, no vive en ninguna Zona', !body.zonas.some(zona => zona.residentes.some(residente => residente.id === CARLA)))
    eq('nada de las otras líneas en la respuesta (ni ids, ni códigos, ni nombres)', queTraeDe(r.text, TOKENS_OTRAS_LINEAS), [])
    eq('acceso: asigna y ajusta en su línea; sin administrar Zonas; ve compras públicas', body.acceso, { asignar: true, ajustar: true, comprasPublicas: true, administrar: false })
    check('nota: cobertura solo en sus líneas', body.notas.some(nota => nota.includes('solo en las líneas que lideras o llevas (Sustitutos óseos)')), body.notas)
  }

  print('\nLíder de Sustitutos óseos · segunda apertura: la cobertura ya coincide')
  {
    const r = await pedir(LIDER_S)
    const body = r.body as ZonasResponse
    const guardadaEn = fake.tablas.coverage[0]?.computed_at
    eq('no está desactualizada, no recalcula y no escribe', [body.cobertura.desactualizada, body.cobertura.recalculada, escrituras(r.requests)], [false, false, []])
    eq('calculadaEn es la fecha del recálculo guardado', body.cobertura.calculadaEn, guardadaEn)
    check('nota con la fecha de la cobertura', body.notas.some(nota => nota.startsWith('Cobertura calculada el ')), body.notas)
  }

  print('\nLíder de Sustitutos óseos · líneas que no ve')
  {
    const ajena = await pedir(LIDER_S, '?line=reemplazo')
    check('?line= de otra línea: 403', ajena.status === 403, ajena.body)
    const inactiva = await pedir(LIDER_S, '?line=legacy')
    check('?line= de una línea inactiva: 403', inactiva.status === 403, inactiva.body)
    const invalida = await pedir(LIDER_S, '?line=NO%20VALE!')
    check('código de línea no válido: 400', invalida.status === 400, invalida.body)
    const otra = await pedir(LIDER_R)
    eq('la líder de Reemplazo articular abre con su línea y puede asignar', [otra.status, (otra.body as ZonasResponse).linea?.code, (otra.body as ZonasResponse).acceso.asignar], [200, 'reemplazo', true])
  }

  print('\nadmin · ?line=reemplazo: Bogotá, alcance y cifras')
  {
    const r = await pedir(ADMIN, '?line=reemplazo')
    const body = r.body as ZonasResponse
    check('200', r.status === 200, r.body)
    eq('ve las 5 líneas activas (no la inactiva)', body.lineas.map(line => line.code), ['sustitutos', 'reemplazo', 'medicina', 'columna', 'trauma'])
    eq('Bogotá Chapinero: reservada por Vacante · Bogotá', estadoDe(body, 'Bogotá Chapinero'), 'reservada:Vacante · Bogotá')
    eq('las otras tres celdas le llegan por alcance desde Chapinero (26 a 30 min)', ['Bogotá Engativá', 'Bogotá Kennedy', 'Bogotá San Cristóbal'].map(nombre => estadoDe(body, nombre)), [
      'alcance:Vacante · Bogotá desde Bogotá Chapinero 26 min',
      'alcance:Vacante · Bogotá desde Bogotá Chapinero 30 min',
      'alcance:Vacante · Bogotá desde Bogotá Chapinero 28 min',
    ])
    eq('Pereira: Lucía por alcance desde Cali; Ibagué sin cobertura con Lucía a 300 min', [estadoDe(body, 'Pereira'), estadoDe(body, 'Ibagué'), zonaDe(body, 'Ibagué')?.enLinea?.masCercano?.nombre], ['alcance:Lucía Páez desde Cali 190 min', 'sin_cobertura:-', 'Lucía Páez'])
    eq('Cali: ocupada por Lucía, con equipo (la fila de line_zones es de otra línea)', [estadoDe(body, 'Cali'), zonaDe(body, 'Cali')?.enLinea?.sinEquipo], ['ocupada:Lucía Páez', false])
    eq('bogota: las cuatro celdas marcadas y agrupadas', [body.zonas.filter(zona => zona.bogota).map(zona => zona.nombre), body.bogota?.kam_ids], [['Bogotá Chapinero', 'Bogotá Engativá', 'Bogotá Kennedy', 'Bogotá San Cristóbal'], [CHA, ENG, KEN, SCR]])
    eq('acceso: admin todo', body.acceso, { asignar: true, ajustar: true, comprasPublicas: true, administrar: true })
    eq('residentes con todas sus líneas y sus líneas permitidas completas', zonaDe(body, 'Barranquilla')?.residentes.map(residente => [residente.nombre, residente.status, residente.lineas, residente.lineasPermitidas]), [
      ['Carmen López', 'active', ['sustitutos', 'reemplazo'], ['sustitutos', 'reemplazo']],
      ['Vacante · Barranquilla', 'placeholder', ['medicina', 'columna', 'trauma'], ['medicina', 'columna', 'trauma']],
    ])

    print('\nCifras (reglas de "Datos de la zona")')
    const sumaIps = body.zonas.reduce((acc, zona) => acc + zona.cifras.ips, 0)
    const zonasActivas = new Set(body.zonas.map(zona => zona.kam_id))
    const asignadasActivas = fake.tablas.assignments.filter(row => zonasActivas.has(String(row.kam_id)) && fake.tablas.hospitals.some(h => h.id === row.hospital_id && h.active === true)).length
    eq('la suma de IPS por Zona es la de las IPS activas asignadas a Zonas activas (17)', [sumaIps, asignadasActivas], [17, 17])
    const baq = zonaDe(body, 'Barranquilla')!
    eq('Barranquilla: 2 IPS, 200 camas; 2 municipios (1 con IPS, Soledad de alcance); Atlántico; población DANE 2026', [
      baq.cifras.ips, baq.cifras.camas, baq.cifras.municipios, baq.cifras.municipiosConIps, baq.cifras.municipiosAlcance, baq.cifras.municipiosCompartidos,
      baq.cifras.departamentos, baq.cifras.poblacion, baq.cifras.poblacionAnio, baq.departamento, baq.ciudad_base, baq.color, baq.area_id,
    ], [2, 200, 2, 1, 1, 0, ['Atlántico'], 2_000_000, 2026, 'Atlántico', 'Barranquilla', '#d62728', '08001'])
    eq('Barranquilla: afiliados BDUA del corte (Soledad sin dato no la anula)', [baq.cifras.afiliados, baq.cifras.afiliadosCorte], [1_200_000, '2026-06-30'])
    eq('giro del NIT con tres sedes repartido por camas: Barranquilla 2/3, Cartagena 1/3 (Identifica tu Giro, oct-2025 a sep-2026)', [
      baq.cifras.giros12m, zonaDe(body, 'Cartagena')?.cifras.giros12m, baq.cifras.girosFuente, baq.cifras.girosDesde, baq.cifras.girosHasta,
    ], [666_666.67, 333_333.33, 'identifica', '2025-10', '2026-09'])
    eq('las dos Zonas suman el giro del NIT una sola vez', Math.round((baq.cifras.giros12m ?? 0) * 100 + (zonaDe(body, 'Cartagena')?.cifras.giros12m ?? 0) * 100) / 100, GIRO_NIT_COSTA)
    eq('Cartagena: sin BDUA en sus municipios → afiliados "sin dato" (null), población sí', [zonaDe(body, 'Cartagena')?.cifras.afiliados, zonaDe(body, 'Cartagena')?.cifras.poblacion], [null, 1_130_000])
    eq('Pereira: población sí, afiliados "sin dato" (null); giros 0 (la fuente está cargada y su NIT no recibió nada)', [zonaDe(body, 'Pereira')?.cifras.poblacion, zonaDe(body, 'Pereira')?.cifras.afiliados, zonaDe(body, 'Pereira')?.cifras.giros12m, zonaDe(body, 'Pereira')?.cifras.girosFuente], [480_000, null, 0, 'identifica'])
    eq('Bogotá por celda: la ciudad repartida por camas (30 % / 20 % / 10 % / 40 %) más sus municipios de alcance', ['Bogotá Chapinero', 'Bogotá Engativá', 'Bogotá Kennedy', 'Bogotá San Cristóbal'].map(nombre => zonaDe(body, nombre)?.cifras.poblacion), [
      2_400_000, 1_600_000, 1_600_000, 3_200_000,
    ])
    eq('cada celda comparte Bogotá con las otras; Kennedy suma Soacha (Cundinamarca)', [
      ['Bogotá Chapinero', 'Bogotá Engativá', 'Bogotá Kennedy', 'Bogotá San Cristóbal'].map(nombre => zonaDe(body, nombre)?.cifras.municipiosCompartidos),
      zonaDe(body, 'Bogotá Kennedy')?.cifras.municipios, zonaDe(body, 'Bogotá Kennedy')?.cifras.departamentos, zonaDe(body, 'Bogotá Kennedy')?.departamento,
    ], [[1, 1, 1, 1], 2, ['Bogotá D.C.', 'Cundinamarca'], 'Bogotá D.C.'])
    eq('afiliados de Chapinero: el 30 % de los de Bogotá', zonaDe(body, 'Bogotá Chapinero')?.cifras.afiliados, 2_100_000)
    eq('Bogotá agregada: 4 IPS, 1.000 camas, Bogotá entera (nada compartido) más Soacha, 8,8 millones', [
      body.bogota?.cifras.ips, body.bogota?.cifras.camas, body.bogota?.cifras.municipios, body.bogota?.cifras.municipiosConIps, body.bogota?.cifras.municipiosAlcance,
      body.bogota?.cifras.municipiosCompartidos, body.bogota?.cifras.poblacion, body.bogota?.cifras.afiliados,
    ], [4, 1000, 2, 1, 1, 0, 8_800_000, 7_000_000])
    check('notas: la IPS activa sin Zona, Bogotá y "Nada … consulta Google"', body.notas.some(nota => nota.startsWith('1 IPS activa sin Zona')) && body.notas.some(nota => nota.startsWith('Bogotá:')) && body.notas.includes('Nada de esta pantalla calcula rutas ni consulta Google.'), body.notas)
    check('notas: fuentes y cortes reales (DANE 2026, BDUA 30 jun 2026, Identifica tu Giro oct 2025 – sep 2026)', body.notas.some(nota => nota.includes('DANE para 2026')) && body.notas.some(nota => nota.includes('30 jun 2026')) && body.notas.some(nota => nota.includes('Identifica tu Giro') && nota.includes('oct 2025 – sep 2026')), body.notas)
  }

  print('\nDirección comercial · ?line=trauma: la vacante compite por alcance')
  {
    const r = await pedir(DIRECTORA, '?line=trauma')
    const body = r.body as ZonasResponse
    check('200', r.status === 200, r.body)
    eq('Barranquilla reservada por la vacante; Cartagena la toma por alcance; Valledupar sin cobertura con la vacante a 450', [estadoDe(body, 'Barranquilla'), estadoDe(body, 'Cartagena'), zonaDe(body, 'Valledupar')?.enLinea?.masCercano?.nombre], [
      'reservada:Vacante · Barranquilla', 'alcance:Vacante · Barranquilla desde Barranquilla 146 min', 'Vacante · Barranquilla',
    ])
    eq('las demás 13 Zonas sin cobertura en Trauma', body.zonas.filter(zona => zona.enLinea?.estado === 'sin_cobertura').length, 14)
    eq('acceso: asigna y ajusta en cualquier línea, no administra Zonas', body.acceso, { asignar: true, ajustar: true, comprasPublicas: true, administrar: false })
  }

  print('\nsales_manager enlazado a Carmen (lleva dos líneas; no asigna)')
  {
    const r = await pedir(VENDEDOR)
    const body = r.body as ZonasResponse
    check('200', r.status === 200, r.body)
    eq('sus líneas como ejecutiva: Sustitutos óseos y Reemplazo articular; abre con la primera', [body.lineas.map(line => line.code), body.linea?.code], [['sustitutos', 'reemplazo'], 'sustitutos'])
    eq('acceso: no asigna ni ajusta ni administra; sin compras públicas', body.acceso, { asignar: false, ajustar: false, comprasPublicas: false, administrar: false })
    eq('Carmen con sus dos líneas; la vacante de Barranquilla sin líneas visibles', zonaDe(body, 'Barranquilla')?.residentes.map(residente => residente.lineas), [['sustitutos', 'reemplazo'], []])
    eq('nada de Medicina deportiva, Columna ni Trauma en la respuesta', queTraeDe(r.text, [L_MED, L_COL, L_TRA, 'medicina', 'Medicina deportiva', 'columna', 'Columna', 'trauma', 'Trauma']), [])
  }

  print('\nviewer (todas las líneas, sin asignar)')
  {
    const r = await pedir(VISOR)
    const body = r.body as ZonasResponse
    eq('200 con las 5 líneas y la primera elegida', [r.status, body.lineas.length, body.linea?.code], [200, 5, 'sustitutos'])
    eq('acceso: solo compras públicas', body.acceso, { asignar: false, ajustar: false, comprasPublicas: true, administrar: false })
    eq('el estado sí (Neiva reservada)', estadoDe(body, 'Neiva'), 'reservada:Vacante · Neiva')
  }

  print('\nuser sin líneas: qué hay en cada Zona y quién vive, sin estado')
  {
    const r = await pedir(USUARIO)
    const body = r.body as ZonasResponse
    check('200', r.status === 200, r.body)
    eq('sin línea ni líneas; enLinea null en las 16 Zonas', [body.linea, body.lineas, body.zonas.every(zona => zona.enLinea === null), body.zonas.length], [null, [], true, 16])
    eq('ve quién vive en cada Zona, pero sin líneas', [residentesDe(body, 'Barranquilla'), body.zonas.every(zona => zona.residentes.every(residente => residente.lineas.length === 0))], [['Carmen López', 'Vacante · Barranquilla'], true])
    eq('ningún código, nombre ni id de línea en la respuesta', queTraeDe(r.text, [L_SUS, 'sustitutos', 'Sustitutos óseos', ...TOKENS_OTRAS_LINEAS]), [])
    check('nota: su usuario no tiene líneas', body.notas.some(nota => nota.includes('tu usuario no tiene ninguna')), body.notas)
    const conLinea = await pedir(USUARIO, '?line=sustitutos')
    check('con ?line de una línea que no tiene: 403', conLinea.status === 403, conLinea.body)
  }

  print('\nSin la tabla executive_allowed_lines (migración 0860 sin aplicar)')
  {
    const tablas = datosIniciales()
    delete tablas.executive_allowed_lines
    fake = fakeSupabase(tablas, RPCS, ESCRIBIBLES)
    fetchHandler = fake.handler
    const r = await pedir(LIDER_S)
    const body = r.body as ZonasResponse
    check('200 (nunca 500 por eso)', r.status === 200, r.body)
    check('lineasPermitidas null para todos', body.zonas.every(zona => zona.residentes.every(residente => residente.lineasPermitidas === null)), zonaDe(body, 'Barranquilla')?.residentes)
    check('una nota lo dice', body.notas.some(nota => nota.startsWith('Líneas permitidas: no se pudieron leer')), body.notas)
    eq('lo demás igual (recalcula la cobertura vieja de este juego de datos)', [body.zonas.length, body.cobertura.recalculada, estadoDe(body, 'Neiva')], [16, true, 'reservada:Vacante · Neiva'])
  }

  print('\nGenerales')
  {
    check('ninguna escritura fuera de coverage', fake.writes().every(request => request.table === 'coverage'), fake.writes().map(request => `${request.method} ${request.table}`))
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
