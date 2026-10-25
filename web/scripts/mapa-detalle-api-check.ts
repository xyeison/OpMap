/**
 * Tarjetas del mapa · giros ADRES y compras SECOP de 12 meses · pruebas de GET /api/map/detalle/territorio,
 * GET /api/map/detalle/ips/[id] y del campo inteligenciaIncluida de GET /api/map/data (SIN RED, sin Supabase real, sin
 * Google). Spec: docs/specs/2026-10-24-mapa-giros-y-compras-12-meses.md ("Criterios de aceptación").
 *
 * Llama a los handlers reales contra un Supabase FALSO de solo lectura en memoria (PostgREST mínimo: eq/neq/in/is/gte/
 * lte, orden, rango y RPC sembradas; lo que no se sembró responde "no existe", como una migración sin aplicar) y comprueba:
 *   - Quién: admin, line_leader, commercial_director, data_manager y viewer reciben 200 con alcance 'completo'
 *     (intelligence:view); sales_manager 200 con alcance 'procesos' (solo secop:procesos); contract_manager, user y hr 403
 *     sin leer nada más que su sesión; sin sesión 401.
 *   - Territorio: dos IPS del mismo NIT en dos municipios reparten por camas y la suma de los dos es el giro (y la
 *     compra) del NIT, nada dos veces; una localidad de Bogotá agrupa por hospitals.locality_id y pide a SECOP y a la
 *     ADRES solo SUS NIT (no el 11001 entero); municipio sin IPS → 200 con la nota y sin pedir giros ni hechos;
 *     municipio con IPS solo privadas → sin_entidad_publica (los giros sí); la marca manual compra_publica = false gana
 *     sobre el REPS "Pública" y saca sus contratos de la cuenta; pública sin hechos → sin_contratos_12m.
 *   - Criterio 3 de resolverCompraPublica ("tiene contratos cargados en SECOP") sobre TODO el histórico, como la ficha:
 *     una IPS REPS "Privada" sin marca y con un contrato ANTERIOR a la ventana es pública (origen 'contratos') y queda
 *     "sin contratos en 12 meses", nunca "IPS privada"; la vista secop_contratos_unicos solo se consulta por existencia
 *     (select id, limit 1, un NIT) y solo para los NIT que ni la marca ni el REPS deciden; tarjeta y ficha
 *     (/api/secop/hospital/[id]) dan el mismo publica/origen.
 *   - IPS: parte por camas y nota de sede; privada → ips_privada y compras null; pública sin hechos → sin_contratos_12m;
 *     la marca manual gana; 400 si el id no es UUID; 404 si no existe o está inactiva.
 *   - RPC adres_giros_nits presente (la llamada lleva solo los NIT del territorio) y ausente (respaldo adres_giros_intel
 *     filtrado): misma suma y el NIT ajeno nunca entra.
 *   - Privacidad y terminología: el JSON nunca trae 'persona:', proveedor_hash, proveedor_key ni nombres de personas
 *     naturales o médicos; ningún texto dice "KAM", "panel", "representante" ni "sin compras".
 *   - Procesos de SECOP II publicados sin contrato (spec docs/specs/2026-10-25-secop-procesos-radar.md): la vista
 *     secop_procesos_radar se SIMULA con la misma regla de la migración 0890 (estados del radar y sin contrato cargado de
 *     la misma entidad por portafolio o noticeUID con borde) sobre secop_procesos y secop_contratos sembrados. HU del
 *     Caribe con su proceso real de VG MEDICAL SAS; Montería con sus 3 procesos reales sin proveedor; los procesos con
 *     contrato cargado o cancelados no salen; la IPS privada y la marcada "No" no tienen procesos; la lectura pide solo
 *     los NIT públicos del territorio y la ventana de 12 meses; la entidad lleva el nombre de la IPS de OpMap; máximo 20
 *     con el total; sin la vista → 200 con procesos null. sales_manager: 200 con alcance 'procesos', giros y compras en
 *     null, comprasEstado 'no_incluido', sin notas y sin leer adres*, secop_hechos ni fuentes_estado; los procesos son
 *     los mismos que ve admin. Ningún título ni descripción de proceso, documento, hash ni nombre de persona natural; los
 *     textos de cada fila (lib/mapa-procesos-ui.ts, lo que pinta MapPopups) sin "abierto", "en curso", "licitación" ni
 *     "adjudicado a". Las fechas de los procesos reales se mueven dentro de la ventana para que la prueba no caduque.
 *   - Cache-Control no-store; ninguna escritura ni petición fuera del Supabase falso; nada importa google-distance.
 *   - /api/map/data: nunca lee hospital_contracts, no trae campos de contratos y trae inteligenciaIncluida y
 *     procesosIncluidos según el rol.
 *
 * El Supabase falso viene de scripts/zona-estadisticas-api-check.ts (copiado; se añade not.is.null para /api/map/data).
 * Uso (desde web/): npx tsx scripts/mapa-detalle-api-check.ts      Código de salida 1 si alguna prueba falla.
 */
import { readFileSync } from 'fs'
import path from 'path'
import { NextRequest } from 'next/server'
import { passwordVersion, SESSION_COOKIE_NAME, signSession } from '../lib/session'
import { hasPermission, rolePermissions, type Role } from '../lib/permissions'
import { MAPA_DETALLE_TEXTOS, PROCESOS_MAPA_MAX, ventanaSecop } from '../lib/mapa-detalle'
import { filaProceso, textoCargandoDetalle, textoMasRecientes, textoVerProcesos } from '../lib/mapa-procesos-ui'
import { formatCopCompact } from '../lib/giros-format'
import { fechaEs } from '../lib/zona-estadisticas'
import type { IpsDetalle, ProcesoDetalle, TerritorioDetalle } from '../lib/types/mapa-detalle'
import { hoyBogota } from '../app/api/secop/_lib/hoy'
import { GET as territorioGet } from '../app/api/map/detalle/territorio/route'
import { GET as ipsGet } from '../app/api/map/detalle/ips/[id]/route'
import { GET as mapDataGet } from '../app/api/map/data/route'
import { GET as secopHospitalGet } from '../app/api/secop/hospital/[id]/route'

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
// NIT H 900000010: h1 Lebrija (20 camas), REPS Privada, sin marca, con UN contrato en SECOP de 2019 (antes de la ventana):
//   entidad de compra pública por el histórico (criterio 3, como la ficha) → sin_contratos_12m, nunca ips_privada.
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
const H1 = '40000000-0000-4000-8000-000000000c01'
const F1 = '40000000-0000-4000-8000-000000000001'
const F2 = '40000000-0000-4000-8000-000000000002'
const Z1 = '40000000-0000-4000-8000-000000000099'
/** Código que no es NIT (hospitals.code sin 9 dígitos): estado neutro sin_nit. */
const N1 = '40000000-0000-4000-8000-000000000ab1'
/** Un NIT con dos sedes marcadas distinto a mano: Rionegro Sí, San Gil No (la regla es por sede). */
const M1 = '40000000-0000-4000-8000-000000000cc1'
const M2 = '40000000-0000-4000-8000-000000000cc2'
/** Un NIT con una sede marcada No y otra sin marca (REPS Pública): la sin marca sale pública por el REPS (regla por sede). */
const Q1 = '40000000-0000-4000-8000-000000000dd1'
const Q2 = '40000000-0000-4000-8000-000000000dd2'
/** Hospital Universitario del Caribe (Cartagena) y ESE San Jerónimo de Montería: IPS reales del caso del radar. */
const HUC = '40000000-0000-4000-8000-000000000ca1'
const SJM = '40000000-0000-4000-8000-000000000ca2'
const NADIE = '40000000-0000-4000-8000-0000000000ff'

const NIT_A = '900000001'
const NIT_B = '900000002'
const NIT_D = '900000004'
const NIT_P = '900000005'
const NIT_S = '900000006'
const NIT_H = '900000010'
const NIT_M = '900000011'
const NIT_Q = '900000012'
const NIT_F = '900000007'
const NIT_G = '900000008'
const NIT_AJENO = '900000099'
const NIT_HUC = '900042103'
const NIT_SJM = '891079999'

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
  LEB: { id: '68406', name: 'Lebrija', dep: '68', depName: 'Santander' },
  LSA: { id: '68418', name: 'Los Santos', dep: '68', depName: 'Santander' },
  RIO: { id: '68615', name: 'Rionegro', dep: '68', depName: 'Santander' },
  SGI: { id: '68679', name: 'San Gil', dep: '68', depName: 'Santander' },
  BAR: { id: '68077', name: 'Barbosa', dep: '68', depName: 'Santander' },
  VEL: { id: '68861', name: 'Vélez', dep: '68', depName: 'Santander' },
  BOG: { id: '11001', name: 'Bogotá, D.C.', dep: '11', depName: 'Bogotá, D.C.' },
  CTG: { id: '13001', name: 'Cartagena de Indias', dep: '13', depName: 'Bolívar' },
  MON: { id: '23001', name: 'Montería', dep: '23', depName: 'Córdoba' },
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

// ---------------------------------------------------------------------------
// Procesos de SECOP II sin contrato (radar comercial, migración 0890)
// ---------------------------------------------------------------------------
// HU del Caribe y Montería: filas reales de p6dx-8zbt (datos.gov.co, 2026-10-25) ya mapeadas como las guarda la carga
// (lib/secop-procesos.ts). Sus fechas se mueven dentro de la ventana de 12 meses (mismo día, mes relativo al inicio de la
// ventana) para que la prueba no caduque. Las demás son de juguete con los NIT de Santander.

/** Día `dia` (≤ 28) del mes número `mes` (0 = el primero) de la ventana de SECOP: siempre dentro si mes ≤ 10. */
function enMes(mes: number, dia: number): string {
  const [y, m] = V_SECOP.desde.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1 + mes, dia)).toISOString().slice(0, 10)
}
/** Hash de juguete de una persona natural (64 hex): nunca debe salir en una respuesta. */
const HASH_PERSONA = 'f3a1c0de'.repeat(8)
const DESCRIPCION_HUC =
  'SUMINISTRO DE MATERIAL MEDICO QUIRURGICO DE OSTEOSINTESIS ( ORTOPEDIA, MAXILOFACIAL, NEUROCIRUGIA) PARA LA ATENCION INTEGRAL EN SALUD DE LOS USUARIOS DE LA E.S.E. HOSPITAL UNIVERSITARIO DEL CARIBE'
const DESCRIPCION_PACIENTE = 'SUMINISTRO DE MATERIAL DE OSTEOSINTESIS PARA EL PACIENTE [dato personal omitido] IDENTIFICADO CON CEDULA [dato personal omitido]'
const FECHA_HUC = enMes(4, 10) // real: 2026-03-10

function procesoFila(id: string, nit: string, over: Fila = {}): Fila {
  return {
    id: `uuid-${id}`,
    id_proceso: id,
    portafolio: null,
    notice_uid: null,
    referencia: null,
    nit_entidad: nit,
    nombre_entidad: `ENTIDAD SECOP ${nit}`,
    hospital_id: null,
    modalidad: 'Contratación régimen especial',
    tipo_contrato: 'Suministros',
    estado_secop: 'Publicado',
    estado: 'publicado',
    adjudicado: false,
    precio_base: 100_000_000,
    valor_adjudicado: null,
    fecha_publicacion: enMes(1, 5),
    fecha_adjudicacion: null,
    proveedor_nit: null,
    proveedor_nombre: null,
    proveedor_origen: null,
    proveedor_hash: null,
    es_persona: false,
    proveedor_vigilado_id: null,
    descripcion: 'SUMINISTRO DE MATERIAL DE OSTEOSINTESIS',
    linea: 'trauma',
    lineas: ['trauma'],
    motivo: 'texto',
    clasificacion_version: 'v1',
    categoria_unspsc: 'V1.42132200',
    url: null,
    imported_at: '2026-10-25T06:30:00.000Z',
    ultima_lectura: '2026-10-25T06:30:00.000Z',
    ...over,
  }
}
const urlNotice = (notice: string) => `https://community.secop.gov.co/Public/Tendering/OpportunityDetail/Index?noticeUID=${notice}`

const PROCESOS: Fila[] = [
  // HU del Caribe: CO1.REQ.10254526 (000039-2026), VG MEDICAL SAS figura con su NIT; adjudicado = No
  procesoFila('CO1.REQ.10254526', NIT_HUC, {
    referencia: '000039-2026',
    portafolio: 'CO1.BDOS.10084716',
    notice_uid: 'CO1.NTC.10111634',
    nombre_entidad: 'BOLIVAR - ESE HOSPITAL UNIVERSITARIO DEL CARIBE',
    tipo_contrato: 'Prestación de servicios',
    precio_base: 1_760_000_000,
    fecha_publicacion: FECHA_HUC,
    proveedor_nit: '901080496',
    proveedor_nombre: 'VG MEDICAL SAS',
    proveedor_origen: 'nit',
    descripcion: DESCRIPCION_HUC,
    lineas: ['trauma', 'neurocirugia'],
    url: urlNotice('CO1.NTC.10111634'),
  }),
  // HU del Caribe con contrato ya cargado (por portafolio y por noticeUID en la url del contrato): están en Compras
  procesoFila('CO1.REQ.10254001', NIT_HUC, { portafolio: 'CO1.BDOS.10084001', referencia: 'CON-CONTRATO-1', fecha_publicacion: enMes(5, 2) }),
  procesoFila('CO1.REQ.10254002', NIT_HUC, { notice_uid: 'CO1.NTC.10112002', referencia: 'CON-CONTRATO-2', fecha_publicacion: enMes(5, 3), url: urlNotice('CO1.NTC.10112002') }),
  // HU del Caribe cancelado: fuera del radar
  procesoFila('CO1.REQ.10254003', NIT_HUC, { estado: 'cancelado', estado_secop: 'Cancelado', referencia: 'CANCELADO-1', fecha_publicacion: enMes(6, 2) }),
  // Montería: los 3 de 2026 (CTO-015, CTO-543 y CTO-1116), sin proveedor ("No Definido" en SECOP)
  procesoFila('CO1.REQ.9966287', NIT_SJM, { referencia: 'CTO-015-2026', nombre_entidad: 'ESE HOSPITAL SAN JERONIMO DE MONTERIA', precio_base: 720_000_000, fecha_publicacion: enMes(2, 28), notice_uid: 'CO1.NTC.9875292', url: urlNotice('CO1.NTC.9875292') }),
  procesoFila('CO1.REQ.10338748', NIT_SJM, { referencia: 'CTO-543-2026', nombre_entidad: 'ESE HOSPITAL SAN JERONIMO DE MONTERIA', precio_base: 1_070_000_000, fecha_publicacion: enMes(5, 10), notice_uid: 'CO1.NTC.10196880', url: urlNotice('CO1.NTC.10196880') }),
  procesoFila('CO1.REQ.10891263', NIT_SJM, { referencia: 'CTO-1116-2026', nombre_entidad: 'ESE HOSPITAL SAN JERONIMO DE MONTERIA', precio_base: 720_000_000, fecha_publicacion: enMes(9, 20), notice_uid: 'CO1.NTC.10746038', url: urlNotice('CO1.NTC.10746038') }),
  // Montería antes de la ventana: no se lee
  procesoFila('CO1.REQ.8000001', NIT_SJM, { referencia: 'CTO-VIEJO', fecha_publicacion: ANTES }),
  // NIT A (pública por el REPS, sedes en Bucaramanga y Floridablanca): empresa según el título del proceso
  procesoFila('CO1.REQ.20000001', NIT_A, { referencia: 'A-001', precio_base: 300_000_000, fecha_publicacion: enMes(6, 15), proveedor_nombre: 'OSTEOEQUIPOS S.A.S', proveedor_origen: 'titulo', linea: 'columna', lineas: ['columna'] }),
  // NIT B (pública a mano): persona natural (fila sucia con nombre y cédula, que la base no admite: defensa en
  // profundidad), empresa vigilada sin marca guardada, sin precio base y en evaluación, y uno antes de la ventana
  procesoFila('CO1.REQ.20000002', NIT_B, { referencia: 'B-001', fecha_publicacion: enMes(7, 1), es_persona: true, proveedor_hash: HASH_PERSONA, proveedor_nombre: 'Pedro Pérez Rojas', proveedor_nit: '12345678', descripcion: DESCRIPCION_PACIENTE }),
  procesoFila('CO1.REQ.20000003', NIT_B, { referencia: 'B-002', fecha_publicacion: enMes(8, 5), proveedor_nit: OSTEOCOL, proveedor_nombre: 'OSTEOCOL SAS', proveedor_origen: 'nit', linea: 'reemplazo', lineas: ['reemplazo'] }),
  procesoFila('CO1.REQ.20000004', NIT_B, { referencia: 'B-003', fecha_publicacion: enMes(3, 3), precio_base: null, estado: 'evaluacion', estado_secop: 'Evaluación', linea: 'otros_implantes', lineas: ['otros_implantes'] }),
  procesoFila('CO1.REQ.20000005', NIT_B, { referencia: 'B-VIEJO', fecha_publicacion: ANTES }),
  // NIT D (Clínica D, privada): nunca sale
  procesoFila('CO1.REQ.20000006', NIT_D, { referencia: 'D-001', fecha_publicacion: enMes(4, 4) }),
  // NIT Q (Barbosa marcada No, Vélez sin marca y REPS Pública): solo en Vélez
  procesoFila('CO1.REQ.20000007', NIT_Q, { referencia: 'Q-001', fecha_publicacion: enMes(2, 2) }),
  // NIT ajeno (ninguna IPS de OpMap): nunca se pide
  procesoFila('CO1.REQ.20000008', NIT_AJENO, { referencia: 'AJENO-001', fecha_publicacion: enMes(2, 2) }),
  // NIT S (Girón): 22 procesos → el servidor manda 20 y el total
  ...Array.from({ length: 22 }, (_, i) =>
    procesoFila(`CO1.REQ.3000${String(i + 10).padStart(4, '0')}`, NIT_S, { referencia: `S-${i + 1}`, fecha_publicacion: enMes(i % 10, 1 + i), precio_base: 10_000_000 * (i + 1) })
  ),
]
/** secop_contratos (0710) de las mismas entidades: lo que la vista cruza por portafolio (proceso) y por noticeUID (url). */
const CONTRATOS_SECOP: Fila[] = [
  { id: 'k-1', fuente: 'secop2', nit_entidad: NIT_HUC, proceso: 'CO1.BDOS.10084001', url: null },
  { id: 'k-2', fuente: 'secop2', nit_entidad: NIT_HUC, proceso: 'CO1.BDOS.10080002', url: `${urlNotice('CO1.NTC.10112002')}&isFromPublicArea=True` },
  // Mismo portafolio que el proceso de VG Medical pero de OTRA entidad: no lo saca del radar
  { id: 'k-3', fuente: 'secop2', nit_entidad: NIT_AJENO, proceso: 'CO1.BDOS.10084716', url: null },
]
/**
 * La vista secop_procesos_radar de la migración 0890, en memoria: estados del radar y sin contrato cargado de la MISMA
 * entidad (c.proceso = p.portafolio, o el noticeUID en c.url seguido de '&' o al final).
 */
function vistaRadar(procesos: Fila[], contratos: Fila[]): Fila[] {
  const estados = new Set(['publicado', 'evaluacion', 'abierto', 'seleccionado'])
  return procesos
    .filter(p => estados.has(String(p.estado)))
    .filter(
      p =>
        !contratos.some(c => {
          if (c.nit_entidad !== p.nit_entidad) return false
          if (p.portafolio && c.proceso === p.portafolio) return true
          const notice = p.notice_uid ? String(p.notice_uid) : ''
          const url = typeof c.url === 'string' ? c.url : ''
          return notice !== '' && (url.includes(`${notice}&`) || url.endsWith(notice))
        })
    )
    .map(p => ({ ...p }))
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
      sede(H1, '900000010-6', 'Hospital H', MUNICIPIOS.LEB, 20),
      sede(F1, '900000007-3', 'Hospital F Chapinero', MUNICIPIOS.BOG, 30, { locality_id: '1100102', locality_name: 'Chapinero' }),
      sede(F2, '900000008-4', 'Clínica G Suba', MUNICIPIOS.BOG, 30, { locality_id: '1100111', locality_name: 'Suba' }),
      sede(Z1, '900000009-5', 'Hospital cerrado', MUNICIPIOS.BUC, 10, { active: false }),
      sede(N1, 'SIN-NIT-01', 'Puesto de salud N', MUNICIPIOS.LSA, 5, { compra_publica: true }),
      sede(M1, '900000011-1', 'Hospital M sede Rionegro', MUNICIPIOS.RIO, 30, { compra_publica: true }),
      sede(M2, '900000011-2', 'Hospital M sede San Gil', MUNICIPIOS.SGI, 10, { compra_publica: false }),
      sede(Q1, '900000012-1', 'Hospital Q sede Barbosa', MUNICIPIOS.BAR, 10, { compra_publica: false }),
      sede(Q2, '900000012-2', 'Hospital Q sede Vélez', MUNICIPIOS.VEL, 10),
      sede(HUC, '900042103-1', 'Hospital Universitario del Caribe', MUNICIPIOS.CTG, 463),
      sede(SJM, '891079999-1', 'E.S.E. Hospital San Jerónimo de Montería', MUNICIPIOS.MON, 195),
    ],
    reps_sedes: [
      { nit: NIT_A, naturaleza: 'Pública', codigo_habilitacion: '680010000101' },
      { nit: NIT_A, naturaleza: 'Privada', codigo_habilitacion: '682760000101' },
      { nit: NIT_D, naturaleza: 'Privada', codigo_habilitacion: '680010000401' },
      { nit: NIT_P, naturaleza: 'Pública', codigo_habilitacion: '685470000501' },
      { nit: NIT_S, naturaleza: 'Pública', codigo_habilitacion: '683070000601' },
      { nit: NIT_H, naturaleza: 'Privada', codigo_habilitacion: '684060001001' },
      { nit: NIT_F, naturaleza: 'Mixta', codigo_habilitacion: '110010000701' },
      { nit: NIT_G, naturaleza: 'Privada', codigo_habilitacion: '110010000801' },
      { nit: NIT_Q, naturaleza: 'Pública', codigo_habilitacion: '688610001201' },
      { nit: NIT_HUC, naturaleza: 'Pública', codigo_habilitacion: '130010000101' },
      { nit: NIT_SJM, naturaleza: 'Pública', codigo_habilitacion: '230010000101' },
    ],
    // Solo se leen los límites (fecha_giro mínima y máxima): la ventana de giros termina en 2026-09, no en hoy
    adres_giros_detalle: [
      { id: 1, nit: NIT_A, fecha_giro: '2025-10-03', valor: 1, regimen: 'contributivo' },
      { id: 2, nit: NIT_A, fecha_giro: '2026-09-30', valor: 1, regimen: 'contributivo' },
    ],
    // Vista sin doble conteo (0730): el detalle del mapa solo pregunta si existe algún contrato del NIT (limit 1); la
    // ficha la lee entera. H contrató en 2019 (fuera de la ventana); D, P, S y A no tienen filas aquí.
    secop_contratos_unicos: [
      {
        id: 'c-2019-h-1', fuente: 'secop2', origen: null, numero_contrato: 'CO1.PCCNTR.2019.1', nit_entidad: NIT_H, nombre_entidad: 'Entidad H',
        documento_proveedor: OSTEOCOL, proveedor_hash: null, proveedor_nombre: 'OSTEOCOL SAS', es_persona: false, especialidad_medico: null,
        linea: 'trauma', objeto: 'Suministro de material de osteosíntesis', descripcion: null, valor: 999, fecha_firma: '2019-03-05',
        estado: null, modalidad: null, url: null, atipico: false, estimado: false, valor_proceso: null,
      },
    ],
    secop_proveedores_vigilados: [
      { nit: OSTEOCOL, dv: '1', nombre: 'OSTEOCOL SAS', ciudad: null, origen: 'semilla', compras_gcp_cop: null, activo: true, nota: null, updated_at: null },
      { nit: '900111222', dv: '1', nombre: 'VIGILADO SAS', ciudad: null, origen: 'manual', compras_gcp_cop: null, activo: true, nota: null, updated_at: null },
      { nit: PRECIMEC, dv: '1', nombre: 'PRECIMEC', ciudad: null, origen: 'manual', compras_gcp_cop: null, activo: false, nota: 'baja', updated_at: null },
    ],
    fuentes_estado: [
      // Claves reales de fuentes_estado (lib/secop.ts SECOP_FUENTE_ESTADO). secop_procesos (radar, 0890) es más reciente pero
      // no es una fuente de contratos: no cuenta para "SECOP actualizado el…" de compras.
      { fuente: 'secop_ii', nombre: 'SECOP II · Contratos', programacion: null, ejecutor: null, ultimo_ok: '2026-10-24T06:00:00.000Z', ultimo_intento: null, estado: 'ok', filas: 10, mensaje: null, siguiente_programado: null },
      { fuente: 'secop_i', nombre: 'SECOP I · Contratos', programacion: null, ejecutor: null, ultimo_ok: '2026-10-20T06:00:00.000Z', ultimo_intento: null, estado: 'ok', filas: 10, mensaje: null, siguiente_programado: null },
      { fuente: 'secop_procesos', nombre: 'SECOP II · Procesos sin contrato', programacion: null, ejecutor: null, ultimo_ok: '2026-10-25T06:30:00.000Z', ultimo_intento: null, estado: 'ok', filas: 10, mensaje: null, siguiente_programado: null },
      { fuente: 'adres_identifica', nombre: 'ADRES', programacion: null, ejecutor: null, ultimo_ok: '2026-10-25T06:00:00.000Z', ultimo_intento: null, estado: 'ok', filas: 10, mensaje: null, siguiente_programado: null },
    ],
    municipalities: Object.values(MUNICIPIOS).map(m => ({ code: m.id, name: m.name, department_code: m.dep, population_2025: 100000 })),
    departments: [
      { code: '68', name: 'Santander' },
      { code: '11', name: 'Bogotá, D.C.' },
      { code: '25', name: 'Cundinamarca' },
      { code: '13', name: 'Bolívar' },
      { code: '23', name: 'Córdoba' },
    ],
    // Para /api/map/data (vista de zonas vacía) y para comprobar que hospital_contracts ya no se lee
    kams: [],
    assignments: [],
    executives: [],
    business_lines: [],
    executive_lines: [],
    coverage: [],
    hospital_contracts: [{ hospital_id: A1, contract_value: 50000000, provider: 'Proveedor X', active: true }],
    // Procesos de SECOP II (0890): la tabla con TODAS sus columnas (descripción, hash, portafolio…), los contratos que la
    // vista cruza y la vista simulada con la regla de la migración. Las rutas solo leen la vista.
    secop_procesos: PROCESOS,
    secop_contratos: CONTRATOS_SECOP,
    secop_procesos_radar: vistaRadar(PROCESOS, CONTRATOS_SECOP),
  }
}

/** Giros por NIT en la ventana (misma forma que adres_giros_nits y que cada elemento de adres_giros_intel()->nits). */
const GIROS = [
  { nit: NIT_A, total: 1000, contributivo: 600, subsidiado: 300, otro: 100, ultima: '2026-09-15' },
  { nit: NIT_B, total: 500, contributivo: 0, subsidiado: 500, otro: 0, ultima: '2026-08-01' },
  { nit: NIT_D, total: 200, contributivo: 0, subsidiado: 200, otro: 0, ultima: '2026-07-01' },
  { nit: NIT_P, total: 300, contributivo: 300, subsidiado: 0, otro: 0, ultima: '2026-06-01' },
  { nit: NIT_S, total: 400, contributivo: 200, subsidiado: 200, otro: 0, ultima: '2026-05-01' },
  { nit: NIT_H, total: 50, contributivo: 50, subsidiado: 0, otro: 0, ultima: '2026-04-01' },
  { nit: NIT_F, total: 700, contributivo: 700, subsidiado: 0, otro: 0, ultima: '2026-09-01' },
  { nit: NIT_G, total: 100, contributivo: 100, subsidiado: 0, otro: 0, ultima: '2026-09-02' },
  { nit: NIT_M, total: 400, contributivo: 400, subsidiado: 0, otro: 0, ultima: '2026-09-03' },
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
  // H contrató ANTES de la ventana (el mismo contrato de secop_contratos_unicos): secop_hechos no lo devuelve en 12 m
  hecho(NIT_H, OSTEOCOL, 'OSTEOCOL SAS', 'trauma', 999, 1, ANTES),
  // Bogotá, Chapinero
  hecho(NIT_F, OSTEOCOL, 'OSTEOCOL SAS', 'neurocirugia', 600),
  // Entidad que no es IPS de OpMap
  hecho(NIT_AJENO, OSTEOCOL, 'OSTEOCOL SAS', 'trauma', 5000),
  // NIT M (Rionegro Sí, San Gil No): su contrato cuenta solo en la sede marcada Sí (75 % por camas)
  hecho(NIT_M, OSTEOCOL, 'OSTEOCOL SAS', 'trauma', 1000),
  // NIT Q (Barbosa No, Vélez sin marca y REPS Pública): cuenta solo en Vélez (50 %)
  hecho(NIT_Q, OSTEOCOL, 'OSTEOCOL SAS', 'columna', 500),
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
/** Para la ficha (/api/secop/hospital/[id]), que sí lee la vista entera: aparte para no mezclar sus lecturas. */
const fakeFicha = fakeSupabase(datosIniciales(), RPC_CON_NITS)
/** Sin la migración 0890 (ni secop_procesos ni la vista): las rutas siguen en 200 con procesos: null. */
function sinProcesos(tablas: Tablas): Tablas {
  const out = { ...tablas }
  delete out.secop_procesos
  delete out.secop_procesos_radar
  return out
}
const fakeSinVista = fakeSupabase(sinProcesos(datosIniciales()), RPC_CON_NITS)

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
const fichaSecop = (fake: Fake, userId: string | null, id: string) =>
  llamar(fake, () => secopHospitalGet(new NextRequest(`http://localhost:3000/api/secop/hospital/${id}`, { method: 'GET', headers: headersDe(userId) }), { params: { id } }))

const municipio = (code: string) => `?tipo=municipio&code=${code}`
const localidad = (code: string) => `?tipo=localidad&code=${code}`

const tablas = (requests: FakeRequest[]) => requests.map(request => request.table)
const cuerpoRpc = (requests: FakeRequest[], rpc: string) => requests.filter(request => request.table === `rpc/${rpc}`).map(request => request.body)
const nitsPedidos = (requests: FakeRequest[], rpc: string) => cuerpoRpc(requests, rpc).map(body => [...(body?.p_nits ?? [])].sort())
const proveedores = (body: TerritorioDetalle | IpsDetalle) => (body.compras?.proveedores ?? []).map(p => [p.nombre, p.valor, p.contratos])
/** Lecturas de secop_contratos_unicos de una respuesta: [NIT pedido, select, limit] (existencia = ['9 dígitos', 'id', '1']). */
const vistaContratos = (requests: FakeRequest[]) =>
  requests.filter(request => request.table === 'secop_contratos_unicos').map(request => [(request.params.get('nit_entidad') ?? '').replace(/^eq\./, ''), request.params.get('select'), request.params.get('limit')])

/** Lecturas de la vista de procesos: [NIT pedidos con in.(…), ordenados; filtros de fecha_publicacion]. */
const lecturasRadar = (requests: FakeRequest[]) =>
  requests
    .filter(request => request.table === 'secop_procesos_radar')
    .map(request => [
      (request.params.get('nit_entidad') ?? '')
        .replace(/^in\.\(/, '')
        .replace(/\)$/, '')
        .split(',')
        .map(nit => nit.replace(/^"|"$/g, ''))
        .filter(Boolean)
        .sort(),
      request.params.getAll('fecha_publicacion'),
    ])

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
  print('\nQuién recibe el detalle (intelligence:view → completo; solo secop:procesos → procesos; ninguno → 403)')
  {
    const inteligencia = (role: Role) => hasPermission(role, 'intelligence:view')
    const procesosPerm = (role: Role) => hasPermission(role, 'secop:procesos')
    eq('intelligence:view: admin, commercial_director, data_manager, line_leader, viewer', ROLES.filter(inteligencia).sort(), ['admin', 'commercial_director', 'data_manager', 'line_leader', 'viewer'])
    eq('solo secop:procesos (sin intelligence:view): sales_manager', ROLES.filter(role => procesosPerm(role) && !inteligencia(role)).sort(), ['sales_manager'])
    eq('sin ninguno de los dos: contract_manager, hr, user', ROLES.filter(role => !procesosPerm(role) && !inteligencia(role)).sort(), ['contract_manager', 'hr', 'user'])
    const estados: Record<string, unknown[]> = {}
    const leenDeMas: string[] = []
    for (const role of ROLES) {
      const t = await territorio(fakeCon, usuarioDeRol(role), municipio(MUNICIPIOS.BUC.id))
      const i = await ips(fakeCon, usuarioDeRol(role), A1)
      estados[role] = [t.status, i.status, t.body?.alcance ?? null, i.body?.alcance ?? null]
      if (t.status === 403 && !t.requests.every(request => request.table === 'users')) leenDeMas.push(`${role}:territorio`)
      if (i.status === 403 && !i.requests.every(request => request.table === 'users')) leenDeMas.push(`${role}:ips`)
      if (t.status === 200) textos.push(t.text)
      if (i.status === 200) textos.push(i.text)
    }
    eq(
      'territorio e IPS: 200 completo con intelligence:view, 200 procesos con solo secop:procesos, 403 sin ninguno',
      estados,
      Object.fromEntries(ROLES.map(role => [role, inteligencia(role) ? [200, 200, 'completo', 'completo'] : procesosPerm(role) ? [200, 200, 'procesos', 'procesos'] : [403, 403, null, null]]))
    )
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
    eq('compras: ventana SECOP (12 meses hasta hoy) y actualizado = último OK de las fuentes de contratos (no secop_procesos)', [body.compras?.ventana, body.compras?.actualizado], [V_SECOP, '2026-10-24T06:00:00.000Z'])
    eq('proveedores por valor: PRECIMEC, OSTEOCOL, ANTIGUO (estimado suma)', proveedores(body), [
      ['JAIMES RUEDA Y COMPAÑIA PRECIMEC S.A.S', 1800, 1],
      ['OSTEOCOL SAS', 1100, 3],
      ['ANTIGUO SAS', 60, 1],
    ])
    const osteocol = body.compras?.proveedores[1]
    eq('OSTEOCOL: NIT, 2 entidades, última firma, líneas, vigilado', [osteocol?.nit, osteocol?.entidades, osteocol?.ultimaFecha, osteocol?.lineas, osteocol?.vigilado], [OSTEOCOL, 2, HOY, ['trauma', 'columna'], true])
    eq('PRECIMEC dado de baja en la lista vigilada: vigilado false', body.compras?.proveedores[0]?.vigilado, false)
    eq('aparte: sin clasificar (400 × 0,6), especialistas (3 + 2), personas naturales (200), estimados (100 × 0,6), fuera de escala (1, sin valor)', [body.compras?.sinClasificar, body.compras?.especialistas, body.compras?.personasNaturales, body.compras?.estimados, body.compras?.fueraEscala], [
      { contratos: 2, valor: 240 },
      { contratos: 5 },
      { contratos: 1, valor: 200 },
      { contratos: 1, valor: 60 },
      { contratos: 1 },
    ])
    eq('estado con_datos y notas: estimación por camas + fuentes (sin nota de estado)', [body.comprasEstado, body.notas], ['con_datos', [MAPA_DETALLE_TEXTOS.estimadoPorCamas, MAPA_DETALLE_TEXTOS.fuentes]])
    // La entidad marcada a mano (P, Piedecuesta) se prueba en su municipio y en su tarjeta: aquí nunca llegaría
    check('el fuera de escala de B no aparece ni suma', !buc.text.includes('GIGANTE') && (body.compras?.valor ?? 0) < 1_000_000)
    eq('criterio 3 (histórico) solo para el NIT sin decidir: D (REPS Privada, sin hechos); A (REPS) y B (manual) no se consultan', vistaContratos(buc.requests), [[NIT_D, 'id', '1']])
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
    eq('la marca manual decide: no se consulta el histórico de SECOP', vistaContratos(r.requests), [])
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
    eq('el REPS decide: no se consulta el histórico de SECOP', vistaContratos(r.requests), [])
    textos.push(r.text)
  }

  print('\nLebrija (68406): REPS "Privada", sin marca manual, con un contrato en SECOP ANTERIOR a la ventana (criterio 3: histórico, como la ficha)')
  {
    const r = await territorio(fakeCon, ADMIN, municipio(MUNICIPIOS.LEB.id))
    const body = r.body
    check('200', r.status === 200, body)
    eq('1 IPS y 1 pública: el contrato viejo la hace entidad de compra pública (no sin_entidad_publica)', body.ips, { total: 1, publicas: 1 })
    eq('estado sin_contratos_12m, compras en cero con su ventana, giros 50', [body.comprasEstado, body.compras?.contratos, body.compras?.valor, body.compras?.ventana.texto, body.giros?.total], ['sin_contratos_12m', 0, 0, V_SECOP.texto, 50])
    eq('notas: sin contratos en 12 meses + fuentes', body.notas, [MAPA_DETALLE_TEXTOS.sinContratos12m, MAPA_DETALLE_TEXTOS.fuentes])
    eq('la vista se consultó por existencia: un NIT, select id, limit 1 (nunca el histórico)', vistaContratos(r.requests), [[NIT_H, 'id', '1']])
    check('el contrato de 2019 no se lista ni suma', !r.text.includes('OSTEOCOL') && !r.text.includes('999'))
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
    eq('Suba: la nota dice "en esta localidad", no "en este municipio"', suba.body.notas, [MAPA_DETALLE_TEXTOS.sinEntidadPublicaLocalidad, MAPA_DETALLE_TEXTOS.fuentes])
    const vacia = await territorio(fakeCon, ADMIN, localidad('1100105'))
    eq('localidad sin IPS (Usme, 1100105): una sola nota, "esta localidad"', [vacia.status, vacia.body.ips, vacia.body.notas], [200, { total: 0, publicas: 0 }, ['Giros y compras se cuentan donde está la IPS; esta localidad no tiene IPS en OpMap']])
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
    eq('b1: su contrato fuera de escala se cuenta aparte y no suma', [b1.body.compras?.fueraEscala, (b1.body.compras?.valor ?? 0) < 1_000_000], [{ contratos: 1 }, true])

    const d1 = await ips(fakeCon, ADMIN, D1)
    eq('d1: privada (REPS Privada, sin contratos) → compras null, ips_privada, giros sí', [d1.body.hospital.compraPublica, d1.body.hospital.compraPublicaOrigen, d1.body.compras, d1.body.comprasEstado, d1.body.giros?.total], [false, 'ninguno', null, 'ips_privada', 200])
    eq('d1: nota de IPS privada + fuentes', d1.body.notas, [MAPA_DETALLE_TEXTOS.ipsPrivada, MAPA_DETALLE_TEXTOS.fuentes])

    const p1 = await ips(fakeCon, ADMIN, P1)
    eq('p1: la marca manual false gana sobre el REPS "Pública" y su contrato → ips_privada, compras null', [p1.body.hospital.compraPublica, p1.body.hospital.compraPublicaOrigen, p1.body.compras, p1.body.comprasEstado], [false, 'manual', null, 'ips_privada'])
    check('p1: su contrato con OSTEOCOL no sale', !p1.text.includes('OSTEOCOL'))

    const s1 = await ips(fakeCon, ADMIN, S1)
    eq('s1: pública sin hechos en la ventana → sin_contratos_12m con compras en cero', [s1.body.hospital.compraPublica, s1.body.comprasEstado, s1.body.compras?.contratos, s1.body.compras?.proveedores], [true, 'sin_contratos_12m', 0, []])
    eq('s1: nota sin contratos en 12 meses + fuentes', s1.body.notas, [MAPA_DETALLE_TEXTOS.sinContratos12m, MAPA_DETALLE_TEXTOS.fuentes])

    const h1 = await ips(fakeCon, ADMIN, H1)
    eq('h1: REPS Privada sin marca pero con contrato histórico → pública (origen contratos) y sin_contratos_12m, compras en cero', [h1.status, h1.body.hospital.compraPublica, h1.body.hospital.compraPublicaOrigen, h1.body.comprasEstado, h1.body.compras?.contratos, h1.body.compras?.proveedores, h1.body.giros?.total], [200, true, 'contratos', 'sin_contratos_12m', 0, [], 50])
    eq('h1: nota sin contratos en 12 meses (nunca "IPS privada") + fuentes', h1.body.notas, [MAPA_DETALLE_TEXTOS.sinContratos12m, MAPA_DETALLE_TEXTOS.fuentes])
    eq('h1 y d1 consultan el histórico por existencia (un NIT, select id, limit 1); d1 no tiene nada y sigue privada', [vistaContratos(h1.requests), vistaContratos(d1.requests)], [[[NIT_H, 'id', '1']], [[NIT_D, 'id', '1']]])
    eq('a1 (REPS), b1 y p1 (marca manual) no consultan el histórico', [vistaContratos(a1.requests), vistaContratos(b1.requests), vistaContratos(p1.requests)], [[], [], []])

    const n1 = await ips(fakeCon, ADMIN, N1)
    eq('n1: código que no es NIT → estado neutro sin_nit (nunca "IPS privada"), sin giros ni compras', [n1.status, n1.body.comprasEstado, n1.body.giros, n1.body.compras, n1.body.hospital.nit], [200, 'sin_nit', null, null, null])
    eq('n1: sin NIT no hay entidad que cruzar: publica false, origen ninguno (como la ficha), aunque la sede diga Sí', [n1.body.hospital.compraPublica, n1.body.hospital.compraPublicaOrigen], [false, 'ninguno'])
    eq('n1: notas: la de NIT no válido + fuentes', n1.body.notas, [MAPA_DETALLE_TEXTOS.sinNit, MAPA_DETALLE_TEXTOS.fuentes])
    check('n1: no pide giros ni hechos ni el histórico', !n1.requests.some(request => request.table.startsWith('rpc/') || request.table === 'secop_contratos_unicos'), tablas(n1.requests))
    check('n1: la tarjeta no dice "privada"', !/privada/i.test(n1.text))
    const lsa = await territorio(fakeCon, ADMIN, municipio(MUNICIPIOS.LSA.id))
    eq('Los Santos (solo la IPS sin NIT): 200, 1 IPS, 0 públicas, sin pedir giros ni hechos', [lsa.status, lsa.body.ips, lsa.requests.some(request => request.table.startsWith('rpc/'))], [200, { total: 1, publicas: 0 }, false])
    eq('Los Santos: estado neutro sin_nit (ni giros en cero ni "sin entidades públicas") y su nota de territorio', [lsa.body.giros, lsa.body.compras, lsa.body.comprasEstado, lsa.body.notas], [null, null, 'sin_nit', ['Ninguna IPS de este municipio tiene un NIT válido en OpMap; no se pueden cruzar con la ADRES ni con SECOP', MAPA_DETALLE_TEXTOS.fuentes]])

    const m1 = await ips(fakeCon, ADMIN, M1)
    const m2 = await ips(fakeCon, ADMIN, M2)
    eq('m1 (marca Sí): pública manual, parte 0,75, compras 750 (OSTEOCOL), giros 300', [m1.body.hospital.compraPublica, m1.body.hospital.compraPublicaOrigen, m1.body.hospital.parte, m1.body.comprasEstado, m1.body.compras?.valor, m1.body.giros?.total], [true, 'manual', 0.75, 'con_datos', 750, 300])
    eq('m2 (marca No, mismo NIT): privada manual, compras null, giros 100', [m2.body.hospital.compraPublica, m2.body.hospital.compraPublicaOrigen, m2.body.comprasEstado, m2.body.compras, m2.body.giros?.total], [false, 'manual', 'ips_privada', null, 100])
    const rio = await territorio(fakeCon, ADMIN, municipio(MUNICIPIOS.RIO.id))
    const sgi = await territorio(fakeCon, ADMIN, municipio(MUNICIPIOS.SGI.id))
    eq('Rionegro suma lo mismo que la tarjeta de m1 (regla por sede)', [rio.body.ips, rio.body.compras?.valor, rio.body.comprasEstado], [{ total: 1, publicas: 1 }, m1.body.compras?.valor, 'con_datos'])
    eq('San Gil suma lo mismo que la tarjeta de m2: sin entidad pública aunque otra sede del NIT diga Sí', [sgi.body.ips, sgi.body.compras, sgi.body.comprasEstado, sgi.body.giros?.total], [{ total: 1, publicas: 0 }, null, 'sin_entidad_publica', m2.body.giros?.total])
    const q1 = await ips(fakeCon, ADMIN, Q1)
    const q2 = await ips(fakeCon, ADMIN, Q2)
    const bar = await territorio(fakeCon, ADMIN, municipio(MUNICIPIOS.BAR.id))
    const vel = await territorio(fakeCon, ADMIN, municipio(MUNICIPIOS.VEL.id))
    eq('q1 (marca No): privada manual, sin compras', [q1.body.hospital.compraPublica, q1.body.hospital.compraPublicaOrigen, q1.body.comprasEstado, q1.body.compras], [false, 'manual', 'ips_privada', null])
    eq('q2 (sin marca, mismo NIT, REPS Pública): pública por el REPS, compras 250 (50 %)', [q2.body.hospital.compraPublica, q2.body.hospital.compraPublicaOrigen, q2.body.comprasEstado, q2.body.compras?.valor], [true, 'reps', 'con_datos', 250])
    eq('Barbosa y Vélez suman lo mismo que sus tarjetas', [bar.body.ips.publicas, bar.body.compras, vel.body.ips.publicas, vel.body.compras?.valor], [0, null, 1, q2.body.compras?.valor])
    textos.push(n1.text, lsa.text, m1.text, m2.text, rio.text, sgi.text, q1.text, q2.text, bar.text, vel.text)

    const z1 = await ips(fakeCon, ADMIN, Z1)
    const nadie = await ips(fakeCon, ADMIN, NADIE)
    const malo = await ips(fakeCon, ADMIN, 'no-es-uuid')
    eq('IPS inactiva → 404; inexistente → 404; id que no es UUID → 400', [z1.status, nadie.status, malo.status], [404, 404, 400])
    check('con id inválido no se lee nada más que la sesión', malo.requests.every(request => request.table === 'users'), tablas(malo.requests))
    textos.push(a1.text, b1.text, d1.text, p1.text, s1.text, h1.text)
  }

  print('\nMisma regla que la ficha (/api/secop/hospital/[id]): tarjeta y ficha coinciden en publica y origen')
  {
    const casos: Array<[string, string]> = [
      [H1, 'h1 (contrato histórico)'],
      [D1, 'd1 (REPS Privada sin contratos)'],
      [P1, 'p1 (marca manual false)'],
      [B1, 'b1 (marca manual true)'],
      [A1, 'a1 (REPS Pública)'],
      [S1, 's1 (REPS Pública sin contratos)'],
      [M1, 'm1 (NIT con sedes Sí y No: la sede Sí)'],
      [M2, 'm2 (NIT con sedes Sí y No: la sede No)'],
      [Q1, 'q1 (NIT con sedes No y sin marca: la sede No)'],
      [Q2, 'q2 (NIT con sedes No y sin marca: la sede sin marca)'],
      [N1, 'n1 (código que no es NIT, marca Sí)'],
    ]
    for (const [id, nombre] of casos) {
      const tarjeta = await ips(fakeCon, ADMIN, id)
      const ficha = await fichaSecop(fakeFicha, ADMIN, id)
      eq(`${nombre}: publica y origen iguales en la tarjeta y en la ficha`, [tarjeta.status, tarjeta.body.hospital.compraPublica, tarjeta.body.hospital.compraPublicaOrigen], [ficha.status, ficha.body?.publica, ficha.body?.publica_origen])
    }
  }

  print('\nProcesos de SECOP II publicados sin contrato (radar comercial, spec 2026-10-25)')
  const RANGO_SECOP = [`gte.${V_SECOP.desde}`, `lte.${HOY}`]
  const PROHIBIDO_EN_ALCANCE_PROCESOS = (tabla: string) => tabla.startsWith('adres') || tabla.startsWith('rpc/') || tabla === 'fuentes_estado'
  const VENDEDOR = usuarioDeRol('sales_manager')
  const textosProcesos: string[] = []
  const filasVisibles: string[] = []
  const pintar = (procesos: ProcesoDetalle[] | undefined, modo: 'territorio' | 'ips') => {
    for (const proceso of procesos ?? []) {
      const fila = filaProceso(proceso, modo)
      filasVisibles.push(fila.proveedor, fila.cifras, fila.detalle)
    }
  }
  let hucAdmin: Respuesta<IpsDetalle> | null = null
  let monVendedor: Respuesta<TerritorioDetalle> | null = null
  let giron: Respuesta<TerritorioDetalle> | null = null
  {
    const ctg = await territorio(fakeCon, ADMIN, municipio(MUNICIPIOS.CTG.id))
    check('Cartagena: 200', ctg.status === 200, ctg.body)
    eq('Cartagena: 1 IPS pública sin contratos en 12 meses; estado, notas y alcance como siempre', [ctg.body.ips, ctg.body.comprasEstado, ctg.body.notas, ctg.body.alcance], [
      { total: 1, publicas: 1 },
      'sin_contratos_12m',
      [MAPA_DETALLE_TEXTOS.sinContratos12m, MAPA_DETALLE_TEXTOS.fuentes],
      'completo',
    ])
    const p = ctg.body.procesos
    eq('Cartagena: un solo proceso (los dos con contrato cargado y el cancelado no salen), ventana de SECOP', [p?.total, p?.procesos.map(x => x.id), p?.ventana], [1, ['CO1.REQ.10254526'], V_SECOP])
    const huc = p?.procesos[0]
    eq('HU del Caribe: VG MEDICAL SAS figura con su NIT (origen nit, no vigilado)', huc?.proveedor, { nombre: 'VG MEDICAL SAS', nit: '901080496', origen: 'nit', vigilado: false })
    eq('HU del Caribe: precio base 1.760 M, fecha sin hora, referencia, líneas, estado, url del expediente y entidad = nombre de la IPS en OpMap', [huc?.precioBase, huc?.fechaPublicacion, huc?.referencia, huc?.linea, huc?.lineas, huc?.estado, huc?.url, huc?.entidad, huc?.nitEntidad, huc?.proveedorPersona], [
      1_760_000_000,
      FECHA_HUC,
      '000039-2026',
      'trauma',
      ['trauma', 'neurocirugia'],
      'publicado',
      urlNotice('CO1.NTC.10111634'),
      'Hospital Universitario del Caribe',
      NIT_HUC,
      false,
    ])
    eq('la vista se leyó una vez, solo con el NIT público del municipio y la ventana de 12 meses', lecturasRadar(ctg.requests), [[[NIT_HUC], RANGO_SECOP]])
    hucAdmin = await ips(fakeCon, ADMIN, HUC)
    eq('tarjeta de la IPS HU del Caribe: 200, pública por el REPS, mismos procesos que su municipio, notas de siempre', [hucAdmin.status, hucAdmin.body.hospital.compraPublica, hucAdmin.body.hospital.compraPublicaOrigen, hucAdmin.body.procesos, hucAdmin.body.notas, hucAdmin.body.alcance], [
      200,
      true,
      'reps',
      p,
      [MAPA_DETALLE_TEXTOS.sinContratos12m, MAPA_DETALLE_TEXTOS.fuentes],
      'completo',
    ])
    eq('tarjeta de la IPS: la vista se pidió solo con su NIT', lecturasRadar(hucAdmin.requests), [[[NIT_HUC], RANGO_SECOP]])
    textosProcesos.push(ctg.text, hucAdmin.text)
    pintar(p?.procesos, 'territorio')
    pintar(hucAdmin.body.procesos?.procesos, 'ips')
  }
  {
    const mon = await territorio(fakeCon, ADMIN, municipio(MUNICIPIOS.MON.id))
    const p = mon.body.procesos
    eq('Montería: los 3 procesos, el más reciente primero; el de antes de la ventana no', [mon.status, p?.total, p?.procesos.map(x => x.referencia)], [200, 3, ['CTO-1116-2026', 'CTO-543-2026', 'CTO-015-2026']])
    eq('Montería: sin proveedor (null, no persona natural)', p?.procesos.map(x => [x.proveedor, x.proveedorPersona]), [[null, false], [null, false], [null, false]])
    eq('Montería: precio base de cada proceso (sin sumar) y la entidad con el nombre de OpMap', [p?.procesos.map(x => x.precioBase), Array.from(new Set(p?.procesos.map(x => x.entidad)))], [
      [720_000_000, 1_070_000_000, 720_000_000],
      ['E.S.E. Hospital San Jerónimo de Montería'],
    ])
    check('Montería: ningún campo suma el precio base (ProcesosDetalle = ventana, total, procesos)', JSON.stringify(Object.keys(p ?? {}).sort()) === JSON.stringify(['procesos', 'total', 'ventana']), Object.keys(p ?? {}))
    textosProcesos.push(mon.text)
    pintar(p?.procesos, 'territorio')
  }
  {
    // Bucaramanga (la respuesta de arriba): A (REPS) y B (marca manual) públicas; D privada
    const p = buc.body.procesos
    const porId = new Map((p?.procesos ?? []).map(x => [x.id, x]))
    eq('Bucaramanga: 4 procesos de A y B por fecha (el de D privada y los de antes de la ventana no)', [p?.total, p?.procesos.map(x => x.referencia)], [4, ['B-002', 'B-001', 'A-001', 'B-003']])
    eq('Bucaramanga: la vista se pidió solo con los NIT públicos (A y B, no D) y la ventana de 12 meses', lecturasRadar(buc.requests), [[[NIT_A, NIT_B].sort(), RANGO_SECOP]])
    eq('persona natural: proveedor null y proveedorPersona true (nunca su nombre ni su cédula)', [porId.get('CO1.REQ.20000002')?.proveedor, porId.get('CO1.REQ.20000002')?.proveedorPersona], [null, true])
    eq('empresa según el título del proceso', porId.get('CO1.REQ.20000001')?.proveedor, { nombre: 'OSTEOEQUIPOS S.A.S', nit: null, origen: 'titulo', vigilado: false })
    eq('empresa vigilada por la lista activa (aunque la carga no guardó la marca)', porId.get('CO1.REQ.20000003')?.proveedor, { nombre: 'OSTEOCOL SAS', nit: OSTEOCOL, origen: 'nit', vigilado: true })
    eq('sin precio base y en evaluación; otros_implantes con el código de la UI', [porId.get('CO1.REQ.20000004')?.precioBase, porId.get('CO1.REQ.20000004')?.estado, porId.get('CO1.REQ.20000004')?.lineas], [null, 'evaluacion', ['otros']])
    eq('entidad: la sede de OpMap de ese NIT en el municipio', [porId.get('CO1.REQ.20000001')?.entidad, porId.get('CO1.REQ.20000003')?.entidad], ['Hospital A sede Bucaramanga', 'ESE B'])
    const flo = await territorio(fakeCon, ADMIN, municipio(MUNICIPIOS.FLO.id))
    eq('Floridablanca: el proceso del NIT A entero (no se reparte), con el nombre de SU sede', [flo.body.procesos?.procesos.map(x => [x.id, x.entidad, x.precioBase])], [[['CO1.REQ.20000001', 'Hospital A sede Floridablanca', 300_000_000]]])
    const a1 = await ips(fakeCon, ADMIN, A1)
    eq('a1 (1 de 2 sedes del NIT A): el proceso del NIT completo, precio base sin repartir', a1.body.procesos?.procesos.map(x => [x.id, x.precioBase, x.entidad]), [['CO1.REQ.20000001', 300_000_000, 'Hospital A sede Bucaramanga']])
    textosProcesos.push(flo.text, a1.text)
    pintar(p?.procesos, 'territorio')
  }
  {
    giron = await territorio(fakeCon, ADMIN, municipio(MUNICIPIOS.GIR.id))
    const p = giron.body.procesos
    const fechas = (p?.procesos ?? []).map(x => x.fechaPublicacion ?? '')
    eq('Girón: 22 en la ventana; el servidor manda los 20 más recientes y el total', [p?.total, p?.procesos.length, PROCESOS_MAPA_MAX], [22, 20, 20])
    check('Girón: orden fecha de publicación desc; fuera los 2 más viejos (S-1 y S-11)', fechas.every((f, i) => i === 0 || fechas[i - 1] >= f) && p?.procesos[0]?.referencia === 'S-20' && !p?.procesos.some(x => x.referencia === 'S-1' || x.referencia === 'S-11'), p?.procesos.map(x => [x.referencia, x.fechaPublicacion]))
    eq('Girón: estado de compras y notas no cambian', [giron.body.comprasEstado, giron.body.notas], ['sin_contratos_12m', [MAPA_DETALLE_TEXTOS.sinContratos12m, MAPA_DETALLE_TEXTOS.fuentes]])
    textosProcesos.push(giron.text)
  }
  {
    const pie = await territorio(fakeCon, ADMIN, municipio(MUNICIPIOS.PIE.id))
    const chia = await territorio(fakeCon, ADMIN, municipio(MUNICIPIOS.CHIA.id))
    const lsa = await territorio(fakeCon, ADMIN, municipio(MUNICIPIOS.LSA.id))
    const n1 = await ips(fakeCon, ADMIN, N1)
    const d1 = await ips(fakeCon, ADMIN, D1)
    const p1 = await ips(fakeCon, ADMIN, P1)
    eq('sin entidad pública (Piedecuesta marcada No, d1 privada, p1 marcada No), sin IPS (Chía) o sin NIT (Los Santos, n1): procesos null', [pie.body.procesos, d1.body.procesos, p1.body.procesos, chia.body.procesos, lsa.body.procesos, n1.body.procesos], [null, null, null, null, null, null])
    eq('… y en ninguno se lee la vista de procesos', [pie, chia, lsa, n1, d1, p1].map(r => lecturasRadar(r.requests).length), [0, 0, 0, 0, 0, 0])
    const bar = await territorio(fakeCon, ADMIN, municipio(MUNICIPIOS.BAR.id))
    const vel = await territorio(fakeCon, ADMIN, municipio(MUNICIPIOS.VEL.id))
    const q1 = await ips(fakeCon, ADMIN, Q1)
    const q2 = await ips(fakeCon, ADMIN, Q2)
    eq('NIT Q: la sede marcada No (q1, Barbosa) sin procesos; la sin marca (q2, Vélez) con el proceso del NIT', [bar.body.procesos, q1.body.procesos, vel.body.procesos?.procesos.map(x => [x.id, x.entidad]), q2.body.procesos?.procesos.map(x => x.id)], [
      null,
      null,
      [['CO1.REQ.20000007', 'Hospital Q sede Vélez']],
      ['CO1.REQ.20000007'],
    ])
    textosProcesos.push(pie.text, d1.text, vel.text, q2.text)
  }
  {
    // Sin la migración 0890: 200 con procesos null, y lo demás igual
    const sinBuc = await territorio(fakeSinVista, ADMIN, municipio(MUNICIPIOS.BUC.id))
    const sinHuc = await ips(fakeSinVista, ADMIN, HUC)
    const sinVend = await territorio(fakeSinVista, VENDEDOR, municipio(MUNICIPIOS.CTG.id))
    eq('sin la vista: 200 y procesos null en las dos tarjetas y para el Ejecutivo Comercial (nunca 503)', [sinBuc.status, sinBuc.body.procesos, sinHuc.status, sinHuc.body.procesos, sinVend.status, sinVend.body.procesos, sinVend.body.alcance], [200, null, 200, null, 200, null, 'procesos'])
    eq('sin la vista: giros, compras y notas idénticos', [sinBuc.body.giros, sinBuc.body.compras, sinBuc.body.notas], [buc.body.giros, buc.body.compras, buc.body.notas])
    check('sin la vista: sí intentó leerla', tablas(sinBuc.requests).includes('secop_procesos_radar') && tablas(sinVend.requests).includes('secop_procesos_radar'), tablas(sinVend.requests))
  }

  print('\nEjecutivo Comercial (sales_manager: secop:procesos sin intelligence:view): solo los procesos')
  {
    const casos: Array<[string, () => Promise<Respuesta<TerritorioDetalle | IpsDetalle>>, () => Promise<Respuesta<TerritorioDetalle | IpsDetalle>>]> = [
      ['Cartagena', () => territorio(fakeCon, VENDEDOR, municipio(MUNICIPIOS.CTG.id)), () => territorio(fakeCon, ADMIN, municipio(MUNICIPIOS.CTG.id))],
      ['Montería', () => territorio(fakeCon, VENDEDOR, municipio(MUNICIPIOS.MON.id)), () => territorio(fakeCon, ADMIN, municipio(MUNICIPIOS.MON.id))],
      ['Bucaramanga', () => territorio(fakeCon, VENDEDOR, municipio(MUNICIPIOS.BUC.id)), () => territorio(fakeCon, ADMIN, municipio(MUNICIPIOS.BUC.id))],
      ['Vélez', () => territorio(fakeCon, VENDEDOR, municipio(MUNICIPIOS.VEL.id)), () => territorio(fakeCon, ADMIN, municipio(MUNICIPIOS.VEL.id))],
      ['Piedecuesta', () => territorio(fakeCon, VENDEDOR, municipio(MUNICIPIOS.PIE.id)), () => territorio(fakeCon, ADMIN, municipio(MUNICIPIOS.PIE.id))],
      ['IPS HU del Caribe', () => ips(fakeCon, VENDEDOR, HUC), () => ips(fakeCon, ADMIN, HUC)],
      ['IPS a1', () => ips(fakeCon, VENDEDOR, A1), () => ips(fakeCon, ADMIN, A1)],
      ['IPS h1 (pública por el histórico)', () => ips(fakeCon, VENDEDOR, H1), () => ips(fakeCon, ADMIN, H1)],
      ['IPS d1 (privada)', () => ips(fakeCon, VENDEDOR, D1), () => ips(fakeCon, ADMIN, D1)],
    ]
    const forma: Record<string, unknown[]> = {}
    const iguales: Record<string, boolean> = {}
    const leeDeMas: string[] = []
    for (const [nombre, comoVendedor, comoAdmin] of casos) {
      const v = await comoVendedor()
      const a = await comoAdmin()
      forma[nombre] = [v.status, v.cacheControl, v.body.alcance, v.body.giros, v.body.compras, v.body.comprasEstado, v.body.notas]
      const publicas = 'hospital' in v.body ? [v.body.hospital, (a.body as IpsDetalle).hospital] : [(v.body as TerritorioDetalle).ips, (a.body as TerritorioDetalle).ips]
      iguales[nombre] = JSON.stringify(v.body.procesos) === JSON.stringify(a.body.procesos) && JSON.stringify(publicas[0]) === JSON.stringify(publicas[1])
      for (const tabla of tablas(v.requests)) if (PROHIBIDO_EN_ALCANCE_PROCESOS(tabla)) leeDeMas.push(`${nombre}:${tabla}`)
      textosProcesos.push(v.text)
      if (nombre === 'Montería') monVendedor = v as Respuesta<TerritorioDetalle>
    }
    eq('200 no-store, alcance procesos, giros y compras null, comprasEstado no_incluido y sin notas', forma, Object.fromEntries(casos.map(([nombre]) => [nombre, [200, 'no-store', 'procesos', null, null, 'no_incluido', []]])))
    eq('los mismos procesos y el mismo veredicto de entidad pública (marca, REPS, histórico) que ve admin', iguales, Object.fromEntries(casos.map(([nombre]) => [nombre, true])))
    eq('nunca lee adres*, RPC (secop_hechos, adres_giros_nits) ni fuentes_estado', leeDeMas, [])
    const chia = await territorio(fakeCon, VENDEDOR, municipio(MUNICIPIOS.CHIA.id))
    eq('Chía (sin IPS): 200, sin notas ni procesos (la tarjeta no pinta nada)', [chia.status, chia.body.notas, chia.body.procesos, chia.body.giros, chia.body.compras], [200, [], null, null, null])
    pintar(monVendedor!.body.procesos?.procesos, 'territorio')
  }

  print('\nTextos de cada fila (lib/mapa-procesos-ui.ts: lo que pinta la tarjeta)')
  {
    const huc = hucAdmin!.body.procesos!.procesos[0]
    eq('HU del Caribe (tarjeta de IPS)', filaProceso(huc, 'ips'), {
      proveedor: 'VG MEDICAL SAS',
      cifras: `Precio base ${formatCopCompact(1_760_000_000)} · publicado ${fechaEs(FECHA_HUC)}`,
      detalle: 'Trauma y osteosíntesis, Neurocirugía · Ref. 000039-2026',
      url: urlNotice('CO1.NTC.10111634'),
    })
    check('precio base en formato corto ($ 1,8 mil M) y la fecha con el día publicado (sin correrse por la zona horaria)', formatCopCompact(1_760_000_000).replace(/ /g, ' ') === '$ 1,8 mil M' && fechaEs(FECHA_HUC).startsWith(`${Number(FECHA_HUC.slice(8, 10))} `), fechaEs(FECHA_HUC))
    const mon = monVendedor!.body.procesos!.procesos[0]
    eq('Montería (tarjeta de municipio, Ejecutivo Comercial): "Proveedor no publicado" y la entidad de OpMap', filaProceso(mon, 'territorio'), {
      proveedor: 'Proveedor no publicado',
      cifras: `Precio base ${formatCopCompact(720_000_000)} · publicado ${fechaEs(enMes(9, 20))}`,
      detalle: 'E.S.E. Hospital San Jerónimo de Montería · Trauma y osteosíntesis · Ref. CTO-1116-2026',
      url: urlNotice('CO1.NTC.10746038'),
    })
    const filasBuc = (buc.body.procesos?.procesos ?? []).map(x => filaProceso(x, 'territorio'))
    eq('Bucaramanga: rótulos del proveedor que figura', filasBuc.map(f => f.proveedor), ['OSTEOCOL SAS · Vigilado', 'Proveedor persona natural', 'OSTEOEQUIPOS S.A.S · según el título del proceso', 'Proveedor no publicado'])
    eq('sin precio base: lo dice; sin url: sin enlace', [filasBuc[3]?.cifras, filasBuc[3]?.detalle, filasBuc[3]?.url], [`Precio base no publicado · publicado ${fechaEs(enMes(3, 3))}`, 'ESE B · Otros implantes · Ref. B-003', null])
    eq('"Ver los N procesos" solo con más de 3; "Ver menos" al desplegar', [textoVerProcesos(4, false), textoVerProcesos(4, true), textoVerProcesos(3, false), textoVerProcesos(1, false)], ['Ver los 4 procesos', 'Ver menos', null, null])
    eq('lista cortada por el servidor: "Se muestran los 20 más recientes de 22"; completa: nada', [textoMasRecientes(giron!.body.procesos!.procesos.length, giron!.body.procesos!.total), textoMasRecientes(3, 3)], ['Se muestran los 20 más recientes de 22', null])
    eq('cargando: con alcance procesos nunca anuncia giros ni compras', [textoCargandoDetalle('procesos'), textoCargandoDetalle('completo')], ['Cargando procesos…', 'Cargando giros y compras…'])
    filasVisibles.push(
      MAPA_DETALLE_TEXTOS.tituloProcesos,
      MAPA_DETALLE_TEXTOS.notaProcesos,
      textoVerProcesos(4, false) ?? '',
      textoVerProcesos(4, true) ?? '',
      textoMasRecientes(20, 22) ?? '',
      textoCargandoDetalle('procesos'),
      MAPA_DETALLE_TEXTOS.verProceso
    )
  }

  print('\nProcesos: privacidad y terminología')
  {
    const todo = textosProcesos.join('\n')
    for (const token of [
      'Pedro',
      'Pérez Rojas',
      '12345678',
      HASH_PERSONA,
      'proveedor_hash',
      'descripcion',
      'SUMINISTRO DE MATERIAL',
      'dato personal omitido',
      'CO1.BDOS',
      'portafolio',
      'notice_uid',
      'estado_secop',
      'ENTIDAD SECOP',
      'BOLIVAR - ESE',
      'SAN JERONIMO DE MONTERIA',
      'AJENO-001',
      'D-001',
      'CON-CONTRATO',
      'CANCELADO-1',
    ]) {
      check(`ninguna respuesta con procesos contiene "${token}"`, !todo.includes(token))
    }
    check('sí nombra a la empresa que figura con su NIT (VG MEDICAL SAS · 901080496)', todo.includes('"nombre":"VG MEDICAL SAS"') && todo.includes('"nit":"901080496"'))
    const visibles = [...filasVisibles, todo]
    for (const [patron, nombre] of [
      [/\babiert[oa]s?\b/i, 'abierto'],
      [/en curso/i, 'en curso'],
      [/licitaci[oó]n/i, 'licitación'],
      [/adjudicad[oa]s? a\b/i, 'adjudicado a'],
      [/\bgan[óo]\b/i, 'ganó'],
      [/sin compras/i, 'sin compras'],
      [/\bKAM\b/, 'KAM'],
      [/\bpanel\b/i, 'panel'],
      [/representante/i, 'representante'],
    ] as const) {
      check(`ningún texto de procesos dice "${nombre}"`, !visibles.some(t => patron.test(t)))
    }
    textos.push(...textosProcesos)
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

  print('\nGET /api/map/data: sin contratos cargados a mano, con inteligenciaIncluida y procesosIncluidos')
  {
    const inteligencia: Record<string, unknown> = {}
    const procesosRol: Record<string, unknown> = {}
    const rastro: string[] = []
    for (const role of ROLES.filter(role => hasPermission(role, 'map:view'))) {
      const r = await mapData(fakeCon, usuarioDeRol(role))
      if (r.status !== 200) {
        rastro.push(`${role}:status ${r.status}`)
        continue
      }
      inteligencia[role] = r.body.inteligenciaIncluida
      procesosRol[role] = r.body.procesosIncluidos
      for (const campo of ['contractValuesByHospital', 'contractProvidersByHospital', 'contractsIncluded']) if (campo in r.body) rastro.push(`${role}:${campo}`)
      for (const stats of Object.values((r.body.territoryStats || {}) as Record<string, any>)) for (const campo of ['totalContracts', 'contractValue', 'providers']) if (campo in stats) rastro.push(`${role}:territoryStats.${campo}`)
      if (r.text.includes('Proveedor X') || r.text.includes('50000000')) rastro.push(`${role}:texto`)
      if (r.requests.some(request => request.table === 'hospital_contracts')) rastro.push(`${role}:lee hospital_contracts`)
    }
    eq('inteligenciaIncluida según intelligence:view', inteligencia, Object.fromEntries(ROLES.filter(role => hasPermission(role, 'map:view')).map(role => [role, hasPermission(role, 'intelligence:view')])))
    eq(
      'procesosIncluidos según secop:procesos o intelligence:view (sales_manager sí, sin inteligencia)',
      procesosRol,
      Object.fromEntries(ROLES.filter(role => hasPermission(role, 'map:view')).map(role => [role, hasPermission(role, 'secop:procesos') || hasPermission(role, 'intelligence:view')]))
    )
    check('sales_manager: procesosIncluidos true e inteligenciaIncluida false', procesosRol.sales_manager === true && inteligencia.sales_manager === false, [procesosRol.sales_manager, inteligencia.sales_manager])
    eq('ningún rol recibe campos de contratos ni se lee hospital_contracts', rastro, [])
  }

  print('\nGenerales')
  {
    const fakes = [fakeCon, fakeSin, fakeFicha, fakeSinVista]
    check('ninguna escritura en la base (las cuatro ramas)', fakes.every(fake => fake.writes().length === 0), fakes.map(fake => fake.writes()))
    check('ninguna petición salió del Supabase falso', fakes.every(fake => fake.external.length === 0), fakes.map(fake => fake.external))
    check('la tabla secop_procesos nunca se lee directo: solo la vista del radar (sin descripción ni hash)', !fakes.some(fake => fake.requests.some(request => request.table === 'secop_procesos')))
    const columnasRadar = new Set(fakeCon.requests.filter(request => request.table === 'secop_procesos_radar').map(request => request.params.get('select')))
    check('la vista se lee solo con las columnas del radar (sin descripcion, proveedor_hash, portafolio ni notice_uid)', columnasRadar.size === 1 && !/descripcion|proveedor_hash|portafolio|notice_uid/.test(Array.from(columnasRadar)[0] ?? 'descripcion'), Array.from(columnasRadar))
    check('nunca se leyó hospital_contracts', ![...fakeCon.requests, ...fakeSin.requests].some(request => request.table === 'hospital_contracts'))
    const lecturasVista = [...fakeCon.requests, ...fakeSin.requests].filter(request => request.table === 'secop_contratos_unicos')
    check(
      'secop_contratos_unicos solo se consulta por existencia (select id, limit 1, un NIT de 9 dígitos): nunca el histórico (loadContratosEntidad)',
      lecturasVista.length > 0 && lecturasVista.every(request => request.params.get('select') === 'id' && request.params.get('limit') === '1' && /^eq\.\d{9}$/.test(request.params.get('nit_entidad') ?? '')),
      lecturasVista.map(request => request.params.toString()).slice(0, 5)
    )
    // Lectura del código (sin red): las rutas y el servidor del detalle no importan google-distance
    const WEB = path.join(__dirname, '..')
    const fuentes = ['app/api/map/_lib/detalle-server.ts', 'app/api/map/detalle/territorio/route.ts', 'app/api/map/detalle/ips/[id]/route.ts', 'lib/mapa-procesos-ui.ts'].map(archivo => readFileSync(path.join(WEB, archivo), 'utf8'))
    check('ninguna ruta nueva importa lib/google-distance ni loadContratosEntidad', !fuentes.some(texto => /google-distance|loadContratosEntidad\(/.test(texto)))
    check("las rutas nuevas llevan dynamic = 'force-dynamic'", fuentes.slice(1, 3).every(texto => texto.includes("export const dynamic = 'force-dynamic'")))
    check('las dos rutas piden intelligence:view O secop:procesos (requireAnyPermission), no solo intelligence:view', fuentes.slice(1, 3).every(texto => texto.includes('requireAnyPermission(request, PERMISOS_DETALLE)') && !texto.includes("requirePermission(request, 'intelligence:view')")))
    const popups = readFileSync(path.join(WEB, 'components/MapPopups.tsx'), 'utf8')
    check('el enlace "Ver proceso" abre otra pestaña con rel noopener', /href=\{fila\.url\} target="_blank" rel="noopener noreferrer"/.test(popups))
  }

  print(`\n${passed} pruebas pasaron, ${failed} fallaron`)
  if (failed > 0) process.exit(1)
}

main().catch(error => {
  print(`FALLA inesperada: ${error instanceof Error ? error.stack : String(error)}`)
  if (moduleLogs.length > 0) print(`últimos mensajes: ${moduleLogs.slice(-5).join(' | ')}`)
  process.exit(1)
})
