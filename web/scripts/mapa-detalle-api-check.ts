/**
 * Tarjetas del mapa · giros ADRES y compras SECOP de 12 meses · pruebas de GET /api/map/detalle/territorio,
 * GET /api/map/detalle/ips/[id] y del campo inteligenciaIncluida de GET /api/map/data (SIN RED, sin Supabase real, sin
 * Google). Spec: docs/specs/2026-10-24-mapa-giros-y-compras-12-meses.md ("Criterios de aceptación").
 *
 * Llama a los handlers reales contra un Supabase FALSO de solo lectura en memoria (PostgREST mínimo: eq/neq/in/is/gte/
 * lte, orden, rango y RPC sembradas; lo que no se sembró responde "no existe", como una migración sin aplicar) y comprueba:
 *   - Quién: admin, line_leader, commercial_director, data_manager y viewer reciben 200; sales_manager, contract_manager,
 *     user y hr 403 sin leer nada más que su sesión; sin sesión 401.
 *   - Territorio: dos IPS del mismo NIT en dos municipios reparten por camas y la suma de los dos es el giro (y la
 *     compra) del NIT, nada dos veces; una localidad de Bogotá agrupa por hospitals.locality_id y pide a SECOP y a la
 *     ADRES solo SUS NIT (no el 11001 entero); municipio sin IPS → 200 con la nota y sin pedir giros ni hechos;
 *     municipio con IPS solo privadas → sin_entidad_publica (los giros sí); la marca manual compra_publica = false gana
 *     sobre el REPS "Pública" y saca sus contratos de la cuenta; pública sin hechos → sin_contratos_12m.
 *   - IPS: parte por camas y nota de sede; privada → ips_privada y compras null; pública sin hechos → sin_contratos_12m;
 *     la marca manual gana; 400 si el id no es UUID; 404 si no existe o está inactiva.
 *   - RPC adres_giros_nits presente (la llamada lleva solo los NIT del territorio) y ausente (respaldo adres_giros_intel
 *     filtrado): misma suma y el NIT ajeno nunca entra.
 *   - Privacidad y terminología: el JSON nunca trae 'persona:', proveedor_hash, proveedor_key ni nombres de personas
 *     naturales o médicos; ningún texto dice "KAM", "panel", "representante" ni "sin compras".
 *   - Cache-Control no-store; ninguna escritura ni petición fuera del Supabase falso; nada importa google-distance.
 *   - /api/map/data: nunca lee hospital_contracts, no trae campos de contratos y trae inteligenciaIncluida según el rol.
 *
 * El Supabase falso viene de scripts/zona-estadisticas-api-check.ts (copiado; se añade not.is.null para /api/map/data).
 * Uso (desde web/): npx tsx scripts/mapa-detalle-api-check.ts      Código de salida 1 si alguna prueba falla.
 */
import { readFileSync } from 'fs'
import path from 'path'
import { NextRequest } from 'next/server'
import { passwordVersion, SESSION_COOKIE_NAME, signSession } from '../lib/session'
import { hasPermission, rolePermissions, type Role } from '../lib/permissions'
import { MAPA_DETALLE_TEXTOS, ventanaSecop } from '../lib/mapa-detalle'
import type { IpsDetalle, TerritorioDetalle } from '../lib/types/mapa-detalle'
import { hoyBogota } from '../app/api/secop/_lib/hoy'
import { GET as territorioGet } from '../app/api/map/detalle/territorio/route'
import { GET as ipsGet } from '../app/api/map/detalle/ips/[id]/route'
import { GET as mapDataGet } from '../app/api/map/data/route'

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
process.env.SESSION_SECRET = 'secreto-de-prueba-mapa-detalle-api-check-0123456789abcdefghijklmnopq'

// Despachador único: sin manejador cualquier fetch falla; con él, solo responde el Supabase falso.
type FetchHandler = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
let fetchHandler: FetchHandler | null = null
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  if (!fetchHandler) throw new Error('mapa-detalle-api-check: la red está prohibida en estas pruebas')
  return fetchHandler(input, init)
}) as typeof fetch

// Los console.log / console.error de las rutas se recogen aquí para no ensuciar la salida.
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
    print(`  FALLA ${name}${texto ? ` -> ${texto.slice(0, 700)}` : ''}`)
    if (moduleLogs.length > 0) print(`        últimos mensajes: ${moduleLogs.slice(-3).join(' | ').slice(0, 700)}`)
  }
}

function eq(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  check(name, a === e, a === e ? undefined : { actual, expected })
}

const near = (a: number, b: number, tol = 1e-6) => Math.abs(a - b) <= tol

// ---------------------------------------------------------------------------
// Supabase FALSO de solo lectura
// ---------------------------------------------------------------------------

type Fila = Record<string, unknown>
type Tablas = Record<string, Fila[]>

interface FakeRequest {
  method: string
  table: string
  params: URLSearchParams
  body: any
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

// Con un select de recursos anidados (hospitals!inner(...)) la fila sembrada ya trae lo anidado: va entera
function project(row: Fila, select: string | null): Fila {
  if (!select || select === '*' || select.includes('(')) return { ...row }
  const out: Fila = {}
  for (const column of select.split(',').map(part => part.trim()).filter(Boolean)) out[column] = row[column] ?? null
  return out
}

/** RPC sembradas: nombre → respuesta a partir del cuerpo. Las demás responden "no existe" (PGRST202). */
type Rpcs = Record<string, (body: any) => unknown>

function fakeSupabase(tablas: Tablas, rpcs: Rpcs) {
  const requests: FakeRequest[] = []
  const external: string[] = []
  const json = (payload: unknown, status = 200) => new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json' } })

  const handler: FetchHandler = async (input, init) => {
    const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const url = new URL(href)
    if (url.origin !== FAKE_SUPABASE_URL) {
      external.push(url.origin)
      throw new Error(`mapa-detalle-api-check: intento de red a ${url.origin}`)
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
type Fake = ReturnType<typeof fakeSupabase>

// ---------------------------------------------------------------------------
// Datos: Santander (4 municipios) y Bogotá (2 localidades)
// ---------------------------------------------------------------------------
// NIT A 900000001: a1 Bucaramanga (60 camas) y a2 Floridablanca (40 camas); REPS Pública → entidad de compra pública.
// NIT B 900000002: b1 Bucaramanga (20 camas), compra_publica = true a mano (sin REPS).
// NIT D 900000004: d1 Bucaramanga (10 camas), REPS Privada, sin contratos → privada.
// NIT P 900000005: p1 Piedecuesta (30 camas), REPS Pública PERO compra_publica = false a mano y CON un contrato en SECOP:
//   la marca manual gana → privada; su contrato no cuenta en ningún sitio.
// NIT S 900000006: s1 Girón (50 camas), REPS Pública, sin contratos en la ventana → sin_contratos_12m.
// NIT F 900000007: f1 Bogotá, localidad Chapinero (1100102), REPS Mixta, con contrato.
// NIT G 900000008: f2 Bogotá, localidad Suba (1100111), REPS Privada.
// z1: IPS INACTIVA en Bucaramanga (no existe para el mapa → 404). Chía (25175): municipio sin IPS.

const ADMIN = '00000000-0000-4000-8000-000000000001'
const ROLES = Object.keys(rolePermissions) as Role[]
const usuarioDeRol = (role: Role) => `50000000-0000-4000-8000-${String(ROLES.indexOf(role) + 1).padStart(12, '0')}`

const A1 = '40000000-0000-4000-8000-000000000a01'
const A2 = '40000000-0000-4000-8000-000000000a02'
const B1 = '40000000-0000-4000-8000-000000000b01'
const D1 = '40000000-0000-4000-8000-000000000d01'
const P1 = '40000000-0000-4000-8000-000000000e01'
const S1 = '40000000-0000-4000-8000-000000000f01'
const F1 = '40000000-0000-4000-8000-000000000001'
const F2 = '40000000-0000-4000-8000-000000000002'
const Z1 = '40000000-0000-4000-8000-000000000099'
const NADIE = '40000000-0000-4000-8000-0000000000ff'

const NIT_A = '900000001'
const NIT_B = '900000002'
const NIT_D = '900000004'
const NIT_P = '900000005'
const NIT_S = '900000006'
const NIT_F = '900000007'
const NIT_G = '900000008'
const NIT_AJENO = '900000099'

const OSTEOCOL = '900303413'
const PRECIMEC = '900656724'

const HOY = hoyBogota()
const V_SECOP = ventanaSecop(HOY)
/** Día 15 del primer mes de la ventana: siempre dentro. */
const EN_VENTANA = `${V_SECOP.desde.slice(0, 7)}-15`
/** El día anterior al primero de la ventana: siempre fuera. */
const ANTES = (() => {
  const d = new Date(`${V_SECOP.desde}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
})()

const MUNICIPIOS = {
  BUC: { id: '68001', name: 'Bucaramanga', dep: '68', depName: 'Santander' },
  FLO: { id: '68276', name: 'Floridablanca', dep: '68', depName: 'Santander' },
  PIE: { id: '68547', name: 'Piedecuesta', dep: '68', depName: 'Santander' },
  GIR: { id: '68307', name: 'Girón', dep: '68', depName: 'Santander' },
  BOG: { id: '11001', name: 'Bogotá, D.C.', dep: '11', depName: 'Bogotá, D.C.' },
  CHIA: { id: '25175', name: 'Chía', dep: '25', depName: 'Cundinamarca' },
} as const

function usuario(id: string, role: string, nombre: string): Fila {
  return { id, email: `${role}-${id.slice(-4)}@prueba.test`, full_name: nombre, role, active: true, password: `hash-${id}` }
}

function sede(id: string, code: string, name: string, m: (typeof MUNICIPIOS)[keyof typeof MUNICIPIOS], beds: number | null, extra: Fila = {}): Fila {
  return {
    id,
    code,
    name,
    department_id: m.dep,
    department_name: m.depName,
    municipality_id: m.id,
    municipality_name: m.name,
    locality_id: null,
    locality_name: null,
    lat: 7.1,
    lng: -73.1,
    beds,
    service_level: 2,
    surgeries: 0,
    ambulances: 0,
    type: 'Publico',
    doctors: 0,
    service_flags: null,
    quirofanos: null,
    reps_beds: null,
    compra_publica: null,
    active: true,
    ...extra,
  }
}

function datosIniciales(): Tablas {
  return {
    users: [usuario(ADMIN, 'admin', 'Admin'), ...ROLES.map(role => usuario(usuarioDeRol(role), role, `Rol ${role}`))],
    hospitals: [
      sede(A1, '9000000011', 'Hospital A sede Bucaramanga', MUNICIPIOS.BUC, 60),
      sede(A2, '900000001-1', 'Hospital A sede Floridablanca', MUNICIPIOS.FLO, 40),
      sede(B1, '900000002-9', 'ESE B', MUNICIPIOS.BUC, 20, { compra_publica: true }),
      sede(D1, '900000004-5', 'Clínica D', MUNICIPIOS.BUC, 10),
      sede(P1, '900000005-7', 'Hospital P', MUNICIPIOS.PIE, 30, { compra_publica: false }),
      sede(S1, '900000006-2', 'ESE S', MUNICIPIOS.GIR, 50),
      sede(F1, '900000007-3', 'Hospital F Chapinero', MUNICIPIOS.BOG, 30, { locality_id: '1100102', locality_name: 'Chapinero' }),
      sede(F2, '900000008-4', 'Clínica G Suba', MUNICIPIOS.BOG, 30, { locality_id: '1100111', locality_name: 'Suba' }),
      sede(Z1, '900000009-5', 'Hospital cerrado', MUNICIPIOS.BUC, 10, { active: false }),
    ],
    reps_sedes: [
      { nit: NIT_A, naturaleza: 'Pública', codigo_habilitacion: '680010000101' },
      { nit: NIT_A, naturaleza: 'Privada', codigo_habilitacion: '682760000101' },
      { nit: NIT_D, naturaleza: 'Privada', codigo_habilitacion: '680010000401' },
      { nit: NIT_P, naturaleza: 'Pública', codigo_habilitacion: '685470000501' },
      { nit: NIT_S, naturaleza: 'Pública', codigo_habilitacion: '683070000601' },
      { nit: NIT_F, naturaleza: 'Mixta', codigo_habilitacion: '110010000701' },
      { nit: NIT_G, naturaleza: 'Privada', codigo_habilitacion: '110010000801' },
    ],
    // Solo se leen los límites (fecha_giro mínima y máxima): la ventana de giros termina en 2026-09, no en hoy
    adres_giros_detalle: [
      { id: 1, nit: NIT_A, fecha_giro: '2025-10-03', valor: 1, regimen: 'contributivo' },
      { id: 2, nit: NIT_A, fecha_giro: '2026-09-30', valor: 1, regimen: 'contributivo' },
    ],
    secop_proveedores_vigilados: [
      { nit: OSTEOCOL, dv: '1', nombre: 'OSTEOCOL SAS', ciudad: null, origen: 'semilla', compras_gcp_cop: null, activo: true, nota: null, updated_at: null },
      { nit: '900111222', dv: '1', nombre: 'VIGILADO SAS', ciudad: null, origen: 'manual', compras_gcp_cop: null, activo: true, nota: null, updated_at: null },
      { nit: PRECIMEC, dv: '1', nombre: 'PRECIMEC', ciudad: null, origen: 'manual', compras_gcp_cop: null, activo: false, nota: 'baja', updated_at: null },
    ],
    fuentes_estado: [
      { fuente: 'secop2', nombre: 'SECOP II', programacion: null, ejecutor: null, ultimo_ok: '2026-10-24T06:00:00.000Z', ultimo_intento: null, estado: 'ok', filas: 10, mensaje: null, siguiente_programado: null },
      { fuente: 'secop1', nombre: 'SECOP I', programacion: null, ejecutor: null, ultimo_ok: '2026-10-20T06:00:00.000Z', ultimo_intento: null, estado: 'ok', filas: 10, mensaje: null, siguiente_programado: null },
      { fuente: 'adres_identifica', nombre: 'ADRES', programacion: null, ejecutor: null, ultimo_ok: '2026-10-25T06:00:00.000Z', ultimo_intento: null, estado: 'ok', filas: 10, mensaje: null, siguiente_programado: null },
    ],
    municipalities: Object.values(MUNICIPIOS).map(m => ({ code: m.id, name: m.name, department_code: m.dep, population_2025: 100000 })),
    departments: [
      { code: '68', name: 'Santander' },
      { code: '11', name: 'Bogotá, D.C.' },
      { code: '25', name: 'Cundinamarca' },
    ],
    // Para /api/map/data (vista de zonas vacía) y para comprobar que hospital_contracts ya no se lee
    kams: [],
    assignments: [],
    executives: [],
    business_lines: [],
    executive_lines: [],
    coverage: [],
    hospital_contracts: [{ hospital_id: A1, contract_value: 50000000, provider: 'Proveedor X', active: true }],
  }
}

/** Giros por NIT en la ventana (misma forma que adres_giros_nits y que cada elemento de adres_giros_intel()->nits). */
const GIROS = [
  { nit: NIT_A, total: 1000, contributivo: 600, subsidiado: 300, otro: 100, ultima: '2026-09-15' },
  { nit: NIT_B, total: 500, contributivo: 0, subsidiado: 500, otro: 0, ultima: '2026-08-01' },
  { nit: NIT_D, total: 200, contributivo: 0, subsidiado: 200, otro: 0, ultima: '2026-07-01' },
  { nit: NIT_P, total: 300, contributivo: 300, subsidiado: 0, otro: 0, ultima: '2026-06-01' },
  { nit: NIT_S, total: 400, contributivo: 200, subsidiado: 200, otro: 0, ultima: '2026-05-01' },
  { nit: NIT_F, total: 700, contributivo: 700, subsidiado: 0, otro: 0, ultima: '2026-09-01' },
  { nit: NIT_G, total: 100, contributivo: 100, subsidiado: 0, otro: 0, ultima: '2026-09-02' },
  // NIT ajeno (ninguna IPS de OpMap): solo lo devuelve el respaldo adres_giros_intel; nunca debe sumar
  { nit: NIT_AJENO, total: 9999, contributivo: 9999, subsidiado: 0, otro: 0, ultima: '2026-09-30' },
]

/** Hechos de secop_hechos() con sus claves cortas (web/app/api/secop/_lib/secop-server.ts). */
function hecho(e: string, d: string | null, pn: string, l: string | null, v: number, n = 1, f = EN_VENTANA, extra: Record<string, unknown> = {}) {
  return { e, en: `Entidad ${e}`, d, h: null, pn, p: false, es: null, l, a: false, f, v, n, ...extra }
}
const HECHOS = [
  hecho(NIT_A, OSTEOCOL, 'OSTEOCOL SAS', 'trauma', 1000, 2, HOY),
  hecho(NIT_A, PRECIMEC, 'JAIMES RUEDA Y COMPAÑIA PRECIMEC S.A.S', 'reemplazo', 3000),
  hecho(NIT_B, OSTEOCOL, 'OSTEOCOL SAS', 'columna', 500),
  // Servicios de especialistas: persona natural con especialidad y sin línea (nunca se nombra) y empresa de especialistas
  hecho(NIT_B, null, 'Juan Pérez Rojas', null, 80, 3, EN_VENTANA, { h: 'abc123', p: true, es: 'ortopedia' }),
  hecho(NIT_B, '900999999', 'ESPECIALISTAS SAS', null, 70, 2, EN_VENTANA, { es: 'neurocirugia' }),
  // Persona natural CON línea ortopédica (suministro): cuenta aparte, con valor, sin nombre
  hecho(NIT_B, null, 'María Gómez Díaz', 'trauma', 200, 1, EN_VENTANA, { h: 'def456', p: true }),
  // Sin clasificar: proveedor vigilado sin línea
  hecho(NIT_A, '900111222', 'VIGILADO SAS', null, 400, 2),
  // Fuera de escala: un contrato de más de 50.000 millones
  hecho(NIT_B, '900333444', 'GIGANTE SAS', 'trauma', 60_000_000_000, 1, EN_VENTANA, { x: true }),
  // Firmado antes de la ventana (secop_hechos lo filtra por fecha; resumirCompras también)
  hecho(NIT_B, OSTEOCOL, 'OSTEOCOL SAS', 'trauma', 999, 1, ANTES),
  // Entidad marcada a mano compra_publica = false: NO debe contar en Piedecuesta ni en su tarjeta
  hecho(NIT_P, OSTEOCOL, 'OSTEOCOL SAS', 'trauma', 800),
  // Bogotá, Chapinero
  hecho(NIT_F, OSTEOCOL, 'OSTEOCOL SAS', 'neurocirugia', 600),
  // Entidad que no es IPS de OpMap
  hecho(NIT_AJENO, OSTEOCOL, 'OSTEOCOL SAS', 'trauma', 5000),
  // Estimado (SECOP I sin adjudicado): suma y se cuenta
  hecho(NIT_A, '900555666', 'ANTIGUO SAS', 'deportiva', 100, 1, EN_VENTANA, { est: true }),
]

const RPC_SECOP: Rpcs = {
  secop_hechos: body =>
    HECHOS.filter(h => (!body?.p_nits || body.p_nits.includes(h.e)) && (!body?.p_desde || h.f >= body.p_desde) && (!body?.p_hasta || h.f <= body.p_hasta)),
}
/** Con la migración 0880: la RPC devuelve solo los NIT pedidos. */
const RPC_CON_NITS: Rpcs = {
  ...RPC_SECOP,
  adres_giros_nits: body => GIROS.filter(g => Array.isArray(body?.p_nits) && body.p_nits.includes(g.nit)),
}
/** Sin la 0880: solo adres_giros_intel, que devuelve TODO el país ({ nits, eps }). */
const RPC_SIN_NITS: Rpcs = {
  ...RPC_SECOP,
  adres_giros_intel: () => ({ nits: GIROS.map(g => ({ ...g, meses: {}, eps: {} })), eps: {} }),
}

const fakeCon = fakeSupabase(datosIniciales(), RPC_CON_NITS)
const fakeSin = fakeSupabase(datosIniciales(), RPC_SIN_NITS)

// ---------------------------------------------------------------------------
// Peticiones
// ---------------------------------------------------------------------------

function headersDe(userId: string | null): Record<string, string> {
  if (!userId) return {}
  return { cookie: `${SESSION_COOKIE_NAME}=${encodeURIComponent(signSession(userId, passwordVersion(`hash-${userId}`)))}` }
}

interface Respuesta<T = any> {
  status: number
  body: T
  text: string
  cacheControl: string | null
  requests: FakeRequest[]
}

async function llamar<T = any>(fake: Fake, run: () => Promise<Response>): Promise<Respuesta<T>> {
  fetchHandler = fake.handler
  const antes = fake.requests.length
  const response = await run()
  const text = await response.text()
  let body: any = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = text
  }
  return { status: response.status, body, text, cacheControl: response.headers.get('cache-control'), requests: fake.requests.slice(antes) }
}

const territorio = (fake: Fake, userId: string | null, query: string) =>
  llamar<TerritorioDetalle>(fake, () => territorioGet(new NextRequest(`http://localhost:3000/api/map/detalle/territorio${query}`, { method: 'GET', headers: headersDe(userId) })))
const ips = (fake: Fake, userId: string | null, id: string) =>
  llamar<IpsDetalle>(fake, () => ipsGet(new NextRequest(`http://localhost:3000/api/map/detalle/ips/${id}`, { method: 'GET', headers: headersDe(userId) }), { params: { id } }))
const mapData = (fake: Fake, userId: string | null) =>
  llamar(fake, () => mapDataGet(new NextRequest('http://localhost:3000/api/map/data', { method: 'GET', headers: headersDe(userId) })))

const municipio = (code: string) => `?tipo=municipio&code=${code}`
const localidad = (code: string) => `?tipo=localidad&code=${code}`

const tablas = (requests: FakeRequest[]) => requests.map(request => request.table)
const cuerpoRpc = (requests: FakeRequest[], rpc: string) => requests.filter(request => request.table === `rpc/${rpc}`).map(request => request.body)
const nitsPedidos = (requests: FakeRequest[], rpc: string) => cuerpoRpc(requests, rpc).map(body => [...(body?.p_nits ?? [])].sort())
const proveedores = (body: TerritorioDetalle | IpsDetalle) => (body.compras?.proveedores ?? []).map(p => [p.nombre, p.valor, p.contratos])

const PROHIBIDOS = ['persona:', 'proveedor_hash', 'proveedor_key', 'abc123', 'def456', 'Juan Pérez', 'Pérez Rojas', 'María Gómez', 'Gómez Díaz', 'ESPECIALISTAS SAS', 'GIGANTE']
const TERMINOS = [
  [/\bKAM\b/, 'KAM'],
  [/\bpanel\b/i, 'panel'],
  [/representante/i, 'representante'],
  [/sin compras/i, 'sin compras'],
] as const
const textos: string[] = []

// ---------------------------------------------------------------------------
// Pruebas
// ---------------------------------------------------------------------------

async function main() {
  print('\nQuién recibe el detalle (intelligence:view)')
  {
    const con200 = ROLES.filter(role => hasPermission(role, 'intelligence:view')).sort()
    const con403 = ROLES.filter(role => !hasPermission(role, 'intelligence:view')).sort()
    eq('intelligence:view: admin, commercial_director, data_manager, line_leader, viewer', con200, ['admin', 'commercial_director', 'data_manager', 'line_leader', 'viewer'])
    eq('sin intelligence:view: contract_manager, hr, sales_manager, user', con403, ['contract_manager', 'hr', 'sales_manager', 'user'])
    const estados: Record<string, [number, number]> = {}
    const leenDeMas: string[] = []
    for (const role of ROLES) {
      const t = await territorio(fakeCon, usuarioDeRol(role), municipio(MUNICIPIOS.BUC.id))
      const i = await ips(fakeCon, usuarioDeRol(role), A1)
      estados[role] = [t.status, i.status]
      if (t.status === 403 && !t.requests.every(request => request.table === 'users')) leenDeMas.push(`${role}:territorio`)
      if (i.status === 403 && !i.requests.every(request => request.table === 'users')) leenDeMas.push(`${role}:ips`)
      if (t.status === 200) textos.push(t.text)
      if (i.status === 200) textos.push(i.text)
    }
    eq('territorio e IPS: 200 con intelligence:view, 403 sin él', estados, Object.fromEntries(ROLES.map(role => [role, hasPermission(role, 'intelligence:view') ? [200, 200] : [403, 403]])))
    eq('403 sin leer ninguna tabla más que la sesión (users)', leenDeMas, [])
    const sinSesionT = await territorio(fakeCon, null, municipio(MUNICIPIOS.BUC.id))
    const sinSesionI = await ips(fakeCon, null, A1)
    eq('sin sesión: 401 en las dos rutas', [sinSesionT.status, sinSesionI.status, sinSesionT.requests.length, sinSesionI.requests.length], [401, 401, 0, 0])
  }

  print('\nBucaramanga (68001): dos entidades públicas, una privada; el NIT A tiene otra sede en Floridablanca')
  let buc: Respuesta<TerritorioDetalle>
  {
    buc = await territorio(fakeCon, ADMIN, municipio(MUNICIPIOS.BUC.id))
    const body = buc.body
    check('200 con Cache-Control no-store', buc.status === 200 && buc.cacheControl === 'no-store', { status: buc.status, cacheControl: buc.cacheControl, body })
    eq('territorio: nombre y departamento de las IPS', body.territorio, { code: '68001', tipo: 'municipio', nombre: 'Bucaramanga', departamento: 'Santander' })
    eq('IPS activas del municipio: 3 (la inactiva no), 2 entidades públicas (A por el REPS, B a mano)', body.ips, { total: 3, publicas: 2 })
    eq('giros: A 60 % (600) + B (500) + D (200) = 1300 por régimen; total = todos los regímenes', [body.giros?.total, body.giros?.contributivo, body.giros?.subsidiado, body.giros?.otro], [1300, 360, 880, 60])
    eq('giros: ventana termina en el último mes cargado (2026-09), no en hoy', body.giros?.ventana, { desde: '2025-10', hasta: '2026-09', texto: 'oct-2025 a sep-2026' })
    eq('giros: 3 NIT, 3 con giro, estimación por camas (A tiene sede fuera), último giro', [body.giros?.nits, body.giros?.nitsConGiro, body.giros?.estimadoPorCamas, body.giros?.ultimaFecha, body.giros?.fuente], [3, 3, true, '2026-09-15', 'identifica'])
    eq('la RPC adres_giros_nits recibió SOLO los NIT del municipio', nitsPedidos(buc.requests, 'adres_giros_nits'), [[NIT_A, NIT_B, NIT_D].sort()])
    eq('secop_hechos recibió SOLO los NIT del municipio y la ventana de 12 meses', cuerpoRpc(buc.requests, 'secop_hechos').map(b => [[...b.p_nits].sort(), b.p_desde, b.p_hasta]), [[[NIT_A, NIT_B, NIT_D].sort(), V_SECOP.desde, HOY]])
    eq('compras: solo material ortopédico de entidades públicas, parte por camas (A 60 %): 1800 + 1100 + 60', [body.compras?.valor, body.compras?.contratos, body.compras?.entidades], [2960, 5, 2])
    eq('compras: ventana SECOP (12 meses hasta hoy) y actualizado = último OK de las fuentes secop*', [body.compras?.ventana, body.compras?.actualizado], [V_SECOP, '2026-10-24T06:00:00.000Z'])
    eq('proveedores por valor: PRECIMEC, OSTEOCOL, ANTIGUO (estimado suma)', proveedores(body), [
      ['JAIMES RUEDA Y COMPAÑIA PRECIMEC S.A.S', 1800, 1],
      ['OSTEOCOL SAS', 1100, 3],
      ['ANTIGUO SAS', 60, 1],
    ])
    const osteocol = body.compras?.proveedores[1]
    eq('OSTEOCOL: NIT, 2 entidades, última firma, líneas, vigilado', [osteocol?.nit, osteocol?.entidades, osteocol?.ultimaFecha, osteocol?.lineas, osteocol?.vigilado], [OSTEOCOL, 2, HOY, ['trauma', 'columna'], true])
    eq('PRECIMEC dado de baja en la lista vigilada: vigilado false', body.compras?.proveedores[0]?.vigilado, false)
    eq('aparte: sin clasificar (400 × 0,6), especialistas (3 + 2), personas naturales (200), estimados (100 × 0,6)', [body.compras?.sinClasificar, body.compras?.especialistas, body.compras?.personasNaturales, body.compras?.estimados], [
      { contratos: 2, valor: 240 },
      { contratos: 5 },
      { contratos: 1, valor: 200 },
      { contratos: 1, valor: 60 },
    ])
    eq('estado con_datos y notas: estimación por camas + fuentes (sin nota de estado)', [body.comprasEstado, body.notas], ['con_datos', [MAPA_DETALLE_TEXTOS.estimadoPorCamas, MAPA_DETALLE_TEXTOS.fuentes]])
    check('ni el fuera de escala ni el NIT ajeno ni la entidad marcada a mano entran', !buc.text.includes('GIGANTE') && !buc.text.includes(NIT_AJENO) && !buc.text.includes('"800"') && (body.compras?.valor ?? 0) < 1_000_000)
    textos.push(buc.text)
  }

  print('\nFloridablanca (68276): la otra sede del NIT A (40 %); la suma de los dos municipios es el NIT completo')
  {
    const r = await territorio(fakeCon, ADMIN, municipio(MUNICIPIOS.FLO.id))
    const body = r.body
    check('200', r.status === 200, body)
    eq('giros: A 40 % = 400 (240 / 120 / 40), estimación por camas', [body.giros?.total, body.giros?.contributivo, body.giros?.subsidiado, body.giros?.otro, body.giros?.estimadoPorCamas], [400, 240, 120, 40, true])
    check('giros de Bucaramanga + Floridablanca = A (1000) + B (500) + D (200): nada dos veces', near((buc.body.giros?.total ?? 0) + (body.giros?.total ?? 0), 1700))
    eq('compras: A 40 % → 1200 + 400 + 40, 1 entidad', [body.compras?.valor, body.compras?.contratos, body.compras?.entidades], [1640, 4, 1])
    check('compras de los dos municipios = material ortopédico de A (4100) + B (500)', near((buc.body.compras?.valor ?? 0) + (body.compras?.valor ?? 0), 4600))
    const osteocolFlo = body.compras?.proveedores.find(p => p.nit === OSTEOCOL)
    check('OSTEOCOL en los dos municipios suma A (1000) + B (500)', near((buc.body.compras?.proveedores[1]?.valor ?? 0) + (osteocolFlo?.valor ?? 0), 1500))
    eq('sin clasificar reparte igual (400 × 0,4)', body.compras?.sinClasificar, { contratos: 2, valor: 160 })
    textos.push(r.text)
  }

  print('\nPiedecuesta (68547): la única IPS está marcada a mano compra_publica = false (REPS "Pública" y con contrato)')
  {
    const r = await territorio(fakeCon, ADMIN, municipio(MUNICIPIOS.PIE.id))
    const body = r.body
    check('200', r.status === 200, body)
    eq('IPS 1, públicas 0: la marca manual gana sobre el REPS y sobre el contrato de SECOP', body.ips, { total: 1, publicas: 0 })
    eq('giros sí (300); compras null; estado sin_entidad_publica', [body.giros?.total, body.compras, body.comprasEstado], [300, null, 'sin_entidad_publica'])
    eq('notas: la de sin entidad pública + fuentes', body.notas, [MAPA_DETALLE_TEXTOS.sinEntidadPublica, MAPA_DETALLE_TEXTOS.fuentes])
    check('su contrato con OSTEOCOL no aparece por ningún lado', !r.text.includes('OSTEOCOL'))
    textos.push(r.text)
  }

  print('\nGirón (68307): entidad pública sin contratos en la ventana')
  {
    const r = await territorio(fakeCon, ADMIN, municipio(MUNICIPIOS.GIR.id))
    const body = r.body
    check('200', r.status === 200, body)
    eq('1 IPS pública; giros 400; estado sin_contratos_12m', [body.ips, body.giros?.total, body.comprasEstado], [{ total: 1, publicas: 1 }, 400, 'sin_contratos_12m'])
    eq('compras: objeto en cero con su ventana (la tarjeta muestra el rango)', [body.compras?.valor, body.compras?.contratos, body.compras?.proveedores, body.compras?.ventana.texto], [0, 0, [], V_SECOP.texto])
    eq('notas: sin contratos en 12 meses + fuentes (nunca "sin compras")', body.notas, [MAPA_DETALLE_TEXTOS.sinContratos12m, MAPA_DETALLE_TEXTOS.fuentes])
    textos.push(r.text)
  }

  print('\nChía (25175): municipio de alcance sin IPS en OpMap')
  {
    const r = await territorio(fakeCon, ADMIN, municipio(MUNICIPIOS.CHIA.id))
    const body = r.body
    check('200', r.status === 200, body)
    eq('nombre y departamento desde municipalities/departments', body.territorio, { code: '25175', tipo: 'municipio', nombre: 'Chía', departamento: 'Cundinamarca' })
    eq('ips.total 0, giros null, compras null y UNA sola nota', [body.ips, body.giros, body.compras, body.notas], [{ total: 0, publicas: 0 }, null, null, [MAPA_DETALLE_TEXTOS.sinIps]])
    check('no pide giros ni hechos a la base', !r.requests.some(request => request.table.startsWith('rpc/')), tablas(r.requests))
    textos.push(r.text)
  }

  print('\nBogotá: localidad de Chapinero (1100102) agrupa por hospitals.locality_id')
  {
    const r = await territorio(fakeCon, ADMIN, localidad('1100102'))
    const body = r.body
    check('200', r.status === 200, body)
    eq('territorio: la localidad, no todo Bogotá', body.territorio, { code: '1100102', tipo: 'localidad', nombre: 'Chapinero', departamento: 'Bogotá, D.C.' })
    eq('1 IPS (Mixta en el REPS → pública); giros 700; compras OSTEOCOL 600 neurocirugía', [body.ips, body.giros?.total, body.compras?.valor, proveedores(body), body.comprasEstado], [{ total: 1, publicas: 1 }, 700, 600, [['OSTEOCOL SAS', 600, 1]], 'con_datos'])
    eq('a SECOP y a la ADRES se piden SOLO los NIT de la localidad (no los de Suba ni el 11001 entero)', [nitsPedidos(r.requests, 'secop_hechos'), nitsPedidos(r.requests, 'adres_giros_nits')], [[[NIT_F]], [[NIT_F]]])
    const suba = await territorio(fakeCon, ADMIN, localidad('1100111'))
    eq('Suba (1100111): IPS privada → giros 100, sin entidad pública', [suba.status, suba.body.ips, suba.body.giros?.total, suba.body.compras, suba.body.comprasEstado], [200, { total: 1, publicas: 0 }, 100, null, 'sin_entidad_publica'])
    textos.push(r.text, suba.text)
  }

  print('\nSin la migración 0880 (RPC adres_giros_nits ausente): respaldo adres_giros_intel con la misma suma')
  {
    const r = await territorio(fakeSin, ADMIN, municipio(MUNICIPIOS.BUC.id))
    check('200', r.status === 200, r.body)
    check('intentó adres_giros_nits y usó adres_giros_intel', tablas(r.requests).includes('rpc/adres_giros_nits') && tablas(r.requests).includes('rpc/adres_giros_intel'), tablas(r.requests))
    eq('giros idénticos a la rama con RPC', r.body.giros, buc.body.giros)
    eq('compras idénticas', r.body.compras, buc.body.compras)
    check('el NIT ajeno del país (9999) no entra', !r.text.includes('9999') && !r.text.includes(NIT_AJENO))
    const i = await ips(fakeSin, ADMIN, A1)
    eq('IPS sin la RPC: giro de la sede = 60 % de A', [i.status, i.body.giros?.total], [200, 600])
    textos.push(r.text, i.text)
  }

  print('\nTarjeta de IPS')
  {
    const a1 = await ips(fakeCon, ADMIN, A1)
    check('a1: 200 con Cache-Control no-store', a1.status === 200 && a1.cacheControl === 'no-store', a1.body)
    eq('a1: NIT, 2 sedes, parte 0,6 por camas, pública por el REPS', a1.body.hospital, { id: A1, nombre: 'Hospital A sede Bucaramanga', nit: NIT_A, sedesNit: 2, parte: 0.6, compraPublica: true, compraPublicaOrigen: 'reps' })
    eq('a1: giros = 60 % del NIT (600) y compras de la sede (1800 + 600 + 60)', [a1.body.giros?.total, a1.body.compras?.valor, proveedores(a1.body)], [600, 2460, [['JAIMES RUEDA Y COMPAÑIA PRECIMEC S.A.S', 1800, 1], ['OSTEOCOL SAS', 600, 2], ['ANTIGUO SAS', 60, 1]]])
    eq('a1: con_datos; notas: parte de sede (sin repetir la de estimación) + fuentes', [a1.body.comprasEstado, a1.body.notas], ['con_datos', [`Parte de esta sede: 1 de 2 sedes del NIT ${NIT_A}, reparto por camas. La ficha muestra el NIT completo.`, MAPA_DETALLE_TEXTOS.fuentes]])
    eq('a1: las RPC reciben solo su NIT', [nitsPedidos(a1.requests, 'adres_giros_nits'), nitsPedidos(a1.requests, 'secop_hechos')], [[[NIT_A]], [[NIT_A]]])

    const b1 = await ips(fakeCon, ADMIN, B1)
    eq('b1: marcada a mano compra_publica = true (origen manual), sede única', [b1.body.hospital.compraPublica, b1.body.hospital.compraPublicaOrigen, b1.body.hospital.sedesNit, b1.body.hospital.parte], [true, 'manual', 1, 1])
    eq('b1: giros del NIT completo sin estimación; compras OSTEOCOL 500; aparte especialistas 5 y personas naturales 1', [b1.body.giros?.total, b1.body.giros?.estimadoPorCamas, proveedores(b1.body), b1.body.compras?.especialistas, b1.body.compras?.personasNaturales], [500, false, [['OSTEOCOL SAS', 500, 1]], { contratos: 5 }, { contratos: 1, valor: 200 }])
    eq('b1: notas solo fuentes', b1.body.notas, [MAPA_DETALLE_TEXTOS.fuentes])

    const d1 = await ips(fakeCon, ADMIN, D1)
    eq('d1: privada (REPS Privada, sin contratos) → compras null, ips_privada, giros sí', [d1.body.hospital.compraPublica, d1.body.hospital.compraPublicaOrigen, d1.body.compras, d1.body.comprasEstado, d1.body.giros?.total], [false, 'ninguno', null, 'ips_privada', 200])
    eq('d1: nota de IPS privada + fuentes', d1.body.notas, [MAPA_DETALLE_TEXTOS.ipsPrivada, MAPA_DETALLE_TEXTOS.fuentes])

    const p1 = await ips(fakeCon, ADMIN, P1)
    eq('p1: la marca manual false gana sobre el REPS "Pública" y su contrato → ips_privada, compras null', [p1.body.hospital.compraPublica, p1.body.hospital.compraPublicaOrigen, p1.body.compras, p1.body.comprasEstado], [false, 'manual', null, 'ips_privada'])
    check('p1: su contrato con OSTEOCOL no sale', !p1.text.includes('OSTEOCOL'))

    const s1 = await ips(fakeCon, ADMIN, S1)
    eq('s1: pública sin hechos en la ventana → sin_contratos_12m con compras en cero', [s1.body.hospital.compraPublica, s1.body.comprasEstado, s1.body.compras?.contratos, s1.body.compras?.proveedores], [true, 'sin_contratos_12m', 0, []])
    eq('s1: nota sin contratos en 12 meses + fuentes', s1.body.notas, [MAPA_DETALLE_TEXTOS.sinContratos12m, MAPA_DETALLE_TEXTOS.fuentes])

    const z1 = await ips(fakeCon, ADMIN, Z1)
    const nadie = await ips(fakeCon, ADMIN, NADIE)
    const malo = await ips(fakeCon, ADMIN, 'no-es-uuid')
    eq('IPS inactiva → 404; inexistente → 404; id que no es UUID → 400', [z1.status, nadie.status, malo.status], [404, 404, 400])
    check('con id inválido no se lee nada más que la sesión', malo.requests.every(request => request.table === 'users'), tablas(malo.requests))
    textos.push(a1.text, b1.text, d1.text, p1.text, s1.text)
  }

  print('\nEntrada inválida del territorio (zod)')
  {
    const casos: Array<[string, string]> = [
      ['tipo desconocido', '?tipo=zona&code=68001'],
      ['sin tipo', '?code=68001'],
      ['municipio con 3 dígitos', municipio('680')],
      ['municipio con letras', municipio('6800a')],
      ['localidad con código de municipio', localidad('68001')],
      ['municipio con código de localidad', municipio('1100102')],
      ['sin code', '?tipo=municipio'],
    ]
    const estados: Record<string, number> = {}
    let leyoDeMas = false
    for (const [nombre, query] of casos) {
      const r = await territorio(fakeCon, ADMIN, query)
      estados[nombre] = r.status
      if (!r.requests.every(request => request.table === 'users')) leyoDeMas = true
    }
    eq('400 en todos los casos', estados, Object.fromEntries(casos.map(([nombre]) => [nombre, 400])))
    check('con entrada inválida no se lee nada más que la sesión', !leyoDeMas)
  }

  print('\nPrivacidad y terminología (todas las respuestas 200)')
  {
    const todo = textos.join('\n')
    for (const token of PROHIBIDOS) check(`ninguna respuesta contiene "${token}"`, !todo.includes(token))
    check('sí nombra al proveedor empresa con su NIT', todo.includes('OSTEOCOL SAS') && todo.includes(`"nit":"${OSTEOCOL}"`))
    for (const [patron, nombre] of TERMINOS) check(`ningún texto visible dice "${nombre}"`, !patron.test(todo))
    check('ventanas visibles en las respuestas ("oct-2025 a sep-2026" y "… a hoy")', todo.includes('oct-2025 a sep-2026') && todo.includes(V_SECOP.texto))
  }

  print('\nGET /api/map/data: sin contratos cargados a mano y con inteligenciaIncluida')
  {
    const inteligencia: Record<string, unknown> = {}
    const rastro: string[] = []
    for (const role of ROLES.filter(role => hasPermission(role, 'map:view'))) {
      const r = await mapData(fakeCon, usuarioDeRol(role))
      if (r.status !== 200) {
        rastro.push(`${role}:status ${r.status}`)
        continue
      }
      inteligencia[role] = r.body.inteligenciaIncluida
      for (const campo of ['contractValuesByHospital', 'contractProvidersByHospital', 'contractsIncluded']) if (campo in r.body) rastro.push(`${role}:${campo}`)
      for (const stats of Object.values((r.body.territoryStats || {}) as Record<string, any>)) for (const campo of ['totalContracts', 'contractValue', 'providers']) if (campo in stats) rastro.push(`${role}:territoryStats.${campo}`)
      if (r.text.includes('Proveedor X') || r.text.includes('50000000')) rastro.push(`${role}:texto`)
      if (r.requests.some(request => request.table === 'hospital_contracts')) rastro.push(`${role}:lee hospital_contracts`)
    }
    eq('inteligenciaIncluida según intelligence:view', inteligencia, Object.fromEntries(ROLES.filter(role => hasPermission(role, 'map:view')).map(role => [role, hasPermission(role, 'intelligence:view')])))
    eq('ningún rol recibe campos de contratos ni se lee hospital_contracts', rastro, [])
  }

  print('\nGenerales')
  {
    check('ninguna escritura en la base (las dos ramas)', fakeCon.writes().length === 0 && fakeSin.writes().length === 0, [fakeCon.writes(), fakeSin.writes()])
    check('ninguna petición salió del Supabase falso', fakeCon.external.length === 0 && fakeSin.external.length === 0, [fakeCon.external, fakeSin.external])
    check('nunca se leyó hospital_contracts ni se llamó a loadContratosEntidad (secop_contratos_unicos)', ![...fakeCon.requests, ...fakeSin.requests].some(request => request.table === 'hospital_contracts' || request.table === 'secop_contratos_unicos'))
    // Lectura del código (sin red): las rutas y el servidor del detalle no importan google-distance
    const WEB = path.join(__dirname, '..')
    const fuentes = ['app/api/map/_lib/detalle-server.ts', 'app/api/map/detalle/territorio/route.ts', 'app/api/map/detalle/ips/[id]/route.ts'].map(archivo => readFileSync(path.join(WEB, archivo), 'utf8'))
    check('ninguna ruta nueva importa lib/google-distance ni loadContratosEntidad', !fuentes.some(texto => /google-distance|loadContratosEntidad\(/.test(texto)))
    check("las rutas nuevas llevan dynamic = 'force-dynamic'", fuentes.slice(1).every(texto => texto.includes("export const dynamic = 'force-dynamic'")))
  }

  print(`\n${passed} pruebas pasaron, ${failed} fallaron`)
  if (failed > 0) process.exit(1)
}

main().catch(error => {
  print(`FALLA inesperada: ${error instanceof Error ? error.stack : String(error)}`)
  if (moduleLogs.length > 0) print(`últimos mensajes: ${moduleLogs.slice(-5).join(' | ')}`)
  process.exit(1)
})
