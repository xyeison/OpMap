/**
 * Fase 6 · F1 Terceros · pruebas de las rutas /api/terceros/** (SIN RED, sin Supabase real, sin Google).
 *
 * Llama a los handlers reales (cuentas, sedes, médicos, verificar, sedes del médico, visitantes, contactos,
 * subtipos) contra un Supabase FALSO en memoria: un PostgREST mínimo (filtros eq/neq/in/is/like/ilike/gte/lte,
 * orden, rango, conteo exacto, proyección de columnas, insert/update/delete) con las restricciones únicas y las
 * reglas de la migración 0800 que tocan a la API (cuenta por identificación, código de habilitación, documento
 * del médico, una principal por cuenta y por médico, visitante vigente único, médico activo con al menos una
 * sede, sede del contacto de su misma cuenta) y la función terceros_crear_medico.
 *
 * Cubre: permisos (viewer no crea; sales_manager crea médico; solo terceros:manage edita), documento del médico
 * oculto sin terceros:manage y visible con él (nunca en listas), identificación de persona de una cuenta oculta,
 * 409 por documento repetido y por NIT repetido (con { existente }), también con el NIT escrito como CC u "otro"
 * y al revés, búsqueda de documentos solo por POST .../buscar (nunca en la URL), parecidos de verificar sin tope
 * de 1.000 candidatos, 400 por médico sin sede (al crear y al desvincular la última), líder de línea solo en sus
 * líneas (403), ejecutiva que no lleva la línea (400), aviso (sin cerrar nada) cuando la ejecutiva pierde la línea
 * o queda inactiva, terminar visitante con hasta (nunca DELETE), buscador sin tildes, subtipos vigentes y que nada
 * sale a la red.
 *
 * El patrón del Supabase falso viene de scripts/ips-routes-check.ts (copiado, no importado).
 * Uso (desde web/): npx tsx scripts/terceros-api-check.ts      Código de salida 1 si alguna prueba falla.
 */
import { randomUUID } from 'node:crypto'
import { NextRequest } from 'next/server'
import { passwordVersion, SESSION_COOKIE_NAME, signSession } from '../lib/session'
import { dvNit } from '../lib/secop'
import { SUBTIPOS_SEMILLA } from '../lib/terceros'
import { todayInBogota } from '../app/api/executives/_lib/executive-shared'
import { GET as listarCuentas, POST as crearCuenta } from '../app/api/terceros/cuentas/route'
import { POST as buscarCuentas } from '../app/api/terceros/cuentas/buscar/route'
import { GET as verCuenta, PATCH as editarCuenta } from '../app/api/terceros/cuentas/[id]/route'
import { GET as buscarSedes, POST as crearSede } from '../app/api/terceros/sedes/route'
import { PATCH as editarSede } from '../app/api/terceros/sedes/[id]/route'
import { GET as listarMedicos, POST as crearMedico } from '../app/api/terceros/medicos/route'
import { POST as verificarMedico } from '../app/api/terceros/medicos/verificar/route'
import { POST as buscarMedicos } from '../app/api/terceros/medicos/buscar/route'
import { GET as verMedico, PATCH as editarMedico } from '../app/api/terceros/medicos/[id]/route'
import { DELETE as desvincularSede, POST as vincularSede } from '../app/api/terceros/medicos/[id]/sedes/route'
import { POST as asignarVisitante } from '../app/api/terceros/medicos/[id]/visitantes/route'
import { PATCH as terminarVisitante } from '../app/api/terceros/medicos/[id]/visitantes/[visitanteId]/route'
import { POST as crearContacto } from '../app/api/terceros/contactos/route'
import { PATCH as editarContacto } from '../app/api/terceros/contactos/[id]/route'
import { GET as listarSubtipos } from '../app/api/terceros/subtipos/route'

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
process.env.SESSION_SECRET = 'secreto-de-prueba-terceros-api-check-0123456789abcdefghijklmnopqrstuvwxyz'

// Despachador único: sin manejador cualquier fetch falla; con él, solo responde el Supabase falso.
type FetchHandler = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
let fetchHandler: FetchHandler | null = null
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  if (!fetchHandler) throw new Error('terceros-api-check: la red está prohibida en estas pruebas')
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

// ---------------------------------------------------------------------------
// Supabase FALSO (PostgREST mínimo en memoria)
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

/** Restricciones únicas de la migración 0800 (y las parciales). nulosIguales: la de visitantes usa coalesce. */
interface Unica {
  nombre: string
  columnas: string[]
  donde?: (fila: Fila) => boolean
  nulosIguales?: boolean
}
const UNICAS: Record<string, Unica[]> = {
  cuentas: [{ nombre: 'cuentas_identificacion_key', columnas: ['tipo_identificacion', 'numero_identificacion'] }],
  sedes: [
    { nombre: 'sedes_reps_code_key', columnas: ['reps_code'] },
    { nombre: 'sedes_hospital_id_key', columnas: ['hospital_id'] },
    { nombre: 'sedes_una_principal_uidx', columnas: ['cuenta_id'], donde: fila => fila.es_principal === true },
  ],
  medicos: [{ nombre: 'medicos_documento_key', columnas: ['tipo_documento', 'numero_documento'] }],
  medico_sedes: [
    { nombre: 'medico_sedes_pkey', columnas: ['medico_id', 'sede_id'] },
    { nombre: 'medico_sedes_una_principal_uidx', columnas: ['medico_id'], donde: fila => fila.principal === true },
  ],
  medico_visitantes: [
    {
      nombre: 'medico_visitantes_vigente_uidx',
      columnas: ['medico_id', 'executive_id', 'line_id', 'municipality_id'],
      donde: fila => fila.hasta === null || fila.hasta === undefined,
      nulosIguales: true,
    },
  ],
}

const HOY = todayInBogota()
const DEFECTOS: Record<string, () => Fila> = {
  cuentas: () => ({ es_cliente: false, activo: true, origen: 'manual', codigo_prestador: null, modalidad_facturacion: null, notas: null }),
  sedes: () => ({
    es_principal: false,
    activo: true,
    ubicacion_confirmada: false,
    origen: 'manual',
    reps_code: null,
    hospital_id: null,
    direccion: null,
    ciudad: null,
    lat: null,
    lng: null,
  }),
  medicos: () => ({ activo: true, telefono: null, email: null, notas: null }),
  medico_sedes: () => ({ principal: false }),
  medico_visitantes: () => ({ desde: HOY, hasta: null, municipality_id: null }),
  contactos: () => ({ activo: true, rol: 'otro', sede_id: null, cargo_texto: null, telefono: null, email: null }),
}
const SIN_ID = new Set(['medico_sedes', 'executive_lines'])

function likeRegex(pattern: string, flags: string): RegExp {
  let regex = ''
  for (let i = 0; i < pattern.length; i++) {
    const char = pattern[i]
    if (char === '\\' && i + 1 < pattern.length) regex += pattern[++i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    else if (char === '%') regex += '.*'
    else if (char === '_') regex += '.'
    else regex += char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }
  return new RegExp(`^${regex}$`, flags)
}

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
    } else if (raw.startsWith('ilike.')) {
      if (value === 'null' || !likeRegex(raw.slice(6), 'i').test(value)) return false
    } else if (raw.startsWith('like.')) {
      if (value === 'null' || !likeRegex(raw.slice(5), '').test(value)) return false
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

function fakeSupabase(tablas: Tablas) {
  const requests: FakeRequest[] = []
  const external: string[] = []
  let sequence = 0
  const json = (payload: unknown, status = 200, extra: Record<string, string> = {}) =>
    new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json', ...extra } })
  const pgError = (code: string, message: string, status: number, details: string | null = null) =>
    json({ code, message, details, hint: null }, status)
  const nextCreatedAt = () => new Date(Date.UTC(2026, 9, 12, 12, 0, ++sequence)).toISOString()
  const store = (table: string) => (tablas[table] = tablas[table] ?? [])

  /** Restricción única que violaría `fila` (ignorando las filas de `excluir`), o null. */
  function uniqueViolation(table: string, fila: Fila, excluir: Set<Fila>): Unica | null {
    for (const unica of UNICAS[table] ?? []) {
      if (unica.donde && !unica.donde(fila)) continue
      const valores = unica.columnas.map(columna => fila[columna] ?? null)
      if (!unica.nulosIguales && valores.some(valor => valor === null)) continue
      const otra = store(table).find(
        row =>
          !excluir.has(row) &&
          (!unica.donde || unica.donde(row)) &&
          unica.columnas.every((columna, index) => (row[columna] ?? null) === valores[index])
      )
      if (otra) return unica
    }
    return null
  }
  const duplicate = (unica: Unica) =>
    pgError('23505', `duplicate key value violates unique constraint "${unica.nombre}"`, 409, `Key (${unica.columnas.join(', ')}) already exists.`)

  /** Reglas de la base que la API debe traducir (disparadores de la migración 0800). Mensaje o null. */
  function ruleViolation(): string | null {
    for (const contacto of store('contactos')) {
      if (contacto.sede_id && !store('sedes').some(sede => sede.id === contacto.sede_id && sede.cuenta_id === contacto.cuenta_id)) {
        return `La sede ${contacto.sede_id} no es de la cuenta ${contacto.cuenta_id} del contacto`
      }
    }
    for (const medico of store('medicos')) {
      if (medico.activo === true && !store('medico_sedes').some(vinculo => vinculo.medico_id === medico.id)) {
        return `Un médico activo debe tener al menos una sede donde atiende (médico ${medico.id})`
      }
    }
    for (const visitante of store('medico_visitantes')) {
      if (visitante.hasta && String(visitante.hasta) < String(visitante.desde)) {
        return 'new row for relation "medico_visitantes" violates check constraint "medico_visitantes_fechas_check"'
      }
    }
    return null
  }

  const handler: FetchHandler = async (input, init) => {
    const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const url = new URL(href)
    if (url.origin !== FAKE_SUPABASE_URL) {
      external.push(url.origin)
      throw new Error(`terceros-api-check: intento de red a ${url.origin}`)
    }
    const method = (init?.method || 'GET').toUpperCase()
    const table = url.pathname.replace('/rest/v1/', '')
    const body = init?.body ? JSON.parse(String(init.body)) : undefined
    requests.push({ method, table, params: url.searchParams, body })
    const headers = new Headers(init?.headers)
    const wantsObject = (headers.get('accept') || '').includes('vnd.pgrst.object')
    const wantsCount = /count=exact/.test(headers.get('prefer') || '')
    const select = url.searchParams.get('select')

    // Transacción del falso: si una regla falla, se deshace todo lo de la petición.
    const backup = JSON.parse(JSON.stringify(tablas)) as Tablas
    const rollback = () => {
      for (const key of Object.keys(tablas)) delete tablas[key]
      Object.assign(tablas, backup)
    }

    if (table === 'rpc/terceros_crear_medico') {
      const { p_medico, p_sedes, p_user } = (body ?? {}) as { p_medico: Fila; p_sedes: Fila[]; p_user: string }
      if (!Array.isArray(p_sedes) || p_sedes.length === 0) {
        return pgError('23514', 'El médico necesita al menos una sede donde atiende', 400)
      }
      const medico: Fila = {
        id: randomUUID(),
        ...DEFECTOS.medicos(),
        tipo_documento: p_medico.tipo_documento,
        numero_documento: p_medico.numero_documento,
        nombre: p_medico.nombre,
        especialidades: p_medico.especialidades,
        municipality_id: p_medico.municipality_id,
        telefono: p_medico.telefono ?? null,
        email: p_medico.email ?? null,
        notas: p_medico.notas ?? null,
        created_by: p_user,
        created_at: nextCreatedAt(),
        updated_at: null,
      }
      const unica = uniqueViolation('medicos', medico, new Set())
      if (unica) return duplicate(unica)
      if (p_sedes.some(sede => !store('sedes').some(row => row.id === sede.sede_id))) {
        return pgError('23503', 'insert or update on table "medico_sedes" violates foreign key constraint', 409)
      }
      const marcada = p_sedes.findIndex(sede => sede.principal === true)
      const principal = marcada === -1 ? 0 : marcada
      store('medicos').push(medico)
      p_sedes.forEach((sede, index) =>
        store('medico_sedes').push({
          medico_id: medico.id,
          sede_id: sede.sede_id,
          rol: sede.rol,
          principal: index === principal,
          created_by: p_user,
          created_at: nextCreatedAt(),
        })
      )
      return json(medico.id)
    }
    if (table.startsWith('rpc/')) throw new Error(`Supabase falso: función no soportada ${table}`)

    let rows: Fila[]
    let total = 0
    let offset = 0
    if (method === 'GET') {
      rows = store(table).filter(row => matchesFilters(row, url.searchParams))
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
      total = rows.length
      offset = Number(url.searchParams.get('offset') ?? 0)
      const limit = url.searchParams.get('limit')
      rows = rows.slice(offset, limit === null ? undefined : offset + Number(limit))
    } else if (method === 'POST') {
      const nuevas = (Array.isArray(body) ? body : [body]).map(row => ({
        ...(SIN_ID.has(table) ? {} : { id: randomUUID() }),
        ...(DEFECTOS[table]?.() ?? {}),
        created_at: nextCreatedAt(),
        ...(row as Fila),
      }))
      for (const nueva of nuevas) {
        const unica = uniqueViolation(table, nueva, new Set())
        if (unica) {
          rollback()
          return duplicate(unica)
        }
        store(table).push(nueva)
      }
      rows = nuevas
    } else if (method === 'PATCH') {
      rows = store(table).filter(row => matchesFilters(row, url.searchParams))
      for (const row of rows) {
        const unica = uniqueViolation(table, { ...row, ...(body as Fila) }, new Set([row]))
        if (unica) {
          rollback()
          return duplicate(unica)
        }
        Object.assign(row, body)
      }
    } else if (method === 'DELETE') {
      rows = store(table).filter(row => matchesFilters(row, url.searchParams))
      tablas[table] = store(table).filter(row => !rows.includes(row))
    } else {
      throw new Error(`Supabase falso: método no soportado ${method}`)
    }

    if (method !== 'GET') {
      const regla = ruleViolation()
      if (regla) {
        rollback()
        return pgError('23514', regla, 400)
      }
    }

    const payload = rows.map(row => project(row, select))
    if (wantsObject) {
      if (payload.length !== 1) {
        return json({ code: 'PGRST116', details: `The result contains ${payload.length} rows`, hint: null, message: 'JSON object requested, multiple (or no) rows returned' }, 406)
      }
      return json(payload[0], method === 'POST' ? 201 : 200)
    }
    const extra: Record<string, string> = wantsCount
      ? { 'content-range': payload.length > 0 ? `${offset}-${offset + payload.length - 1}/${total}` : `*/${total}` }
      : {}
    return json(payload, method === 'POST' ? 201 : 200, extra)
  }

  const writes = () => requests.filter(request => request.method !== 'GET')
  return { handler, requests, external, writes }
}

// ---------------------------------------------------------------------------
// Datos de prueba
// ---------------------------------------------------------------------------

const ADMIN_ID = '11111111-1111-4111-8111-111111111111'
const VIEWER_ID = '22222222-2222-4222-8222-222222222222'
const VENTAS_ID = '33333333-3333-4333-8333-333333333333'
const LIDER_ID = '44444444-4444-4444-8444-444444444444'
const DIRECTORA_ID = '55555555-5555-4555-8555-555555555555'

const LINEA_A = 'aaaaaaaa-0000-4000-8000-000000000001'
const LINEA_B = 'aaaaaaaa-0000-4000-8000-000000000002'
const EJEC_1 = 'eeeeeeee-0000-4000-8000-000000000001' // enlazada con VENTAS, lleva A y B
const EJEC_2 = 'eeeeeeee-0000-4000-8000-000000000002' // solo B
const CLINICA = 'cccccccc-0000-4000-8000-000000000001'
const CONSULTORIO = 'cccccccc-0000-4000-8000-000000000002'
const OTRA_CUENTA = 'cccccccc-0000-4000-8000-000000000003'
const SEDE_CLINICA_1 = 'dddddddd-0000-4000-8000-000000000001'
const SEDE_CLINICA_2 = 'dddddddd-0000-4000-8000-000000000002'
const SEDE_CONSULTORIO = 'dddddddd-0000-4000-8000-000000000003'
const SEDE_OTRA = 'dddddddd-0000-4000-8000-000000000004'
const NIT_CLINICA = '890903938' // DV 8 (DIAN)
const CC_CONSULTORIO = '1020304050'
const DOC_MEDICO = '1098765432'

function datosIniciales(): Tablas {
  const user = (id: string, role: string, name: string) => ({
    id,
    email: `${name.toLowerCase()}@test.local`,
    full_name: name,
    role,
    active: true,
    password: `hash-${id}`,
  })
  const sede = (id: string, cuenta_id: string, nombre: string, extra: Fila = {}) => ({
    id,
    cuenta_id,
    nombre,
    es_principal: false,
    reps_code: null,
    hospital_id: null,
    direccion: null,
    municipality_id: '68001',
    ciudad: 'Bucaramanga',
    lat: null,
    lng: null,
    ubicacion_confirmada: true,
    activo: true,
    origen: 'hospitals',
    created_at: '2026-10-12T00:00:00.000Z',
    ...extra,
  })
  return {
    users: [
      user(ADMIN_ID, 'admin', 'Admin'),
      user(VIEWER_ID, 'viewer', 'Viewer'),
      user(VENTAS_ID, 'sales_manager', 'Ventas'),
      user(LIDER_ID, 'line_leader', 'Lider'),
      user(DIRECTORA_ID, 'commercial_director', 'Directora'),
    ],
    municipalities: [
      { code: '68001', name: 'Bucaramanga', department_code: '68' },
      { code: '11001', name: 'Bogotá D.C.', department_code: '11' },
      { code: '05001', name: 'Medellín', department_code: '05' },
    ],
    business_lines: [
      { id: LINEA_A, code: 'linea-a', name: 'Línea A', leader_user_id: LIDER_ID, active: true },
      { id: LINEA_B, code: 'linea-b', name: 'Línea B', leader_user_id: null, active: true },
    ],
    executives: [
      { id: EJEC_1, full_name: 'Ana Ejecutiva', status: 'active', user_id: VENTAS_ID },
      { id: EJEC_2, full_name: 'Berta Ejecutiva', status: 'active', user_id: null },
    ],
    executive_lines: [
      { executive_id: EJEC_1, line_id: LINEA_A },
      { executive_id: EJEC_1, line_id: LINEA_B },
      { executive_id: EJEC_2, line_id: LINEA_B },
    ],
    cuentas: [
      { id: CLINICA, nombre: 'Clínica Ejemplo del Oriente', clase: 'clinica', es_cliente: true, tipo_identificacion: 'NIT', numero_identificacion: NIT_CLINICA, codigo_prestador: null, modalidad_facturacion: null, notas: null, activo: true, origen: 'hospitals' },
      { id: CONSULTORIO, nombre: 'Consultorio Dr. Ruiz', clase: 'consultorio', es_cliente: false, tipo_identificacion: 'CC', numero_identificacion: CC_CONSULTORIO, codigo_prestador: null, modalidad_facturacion: null, notas: null, activo: true, origen: 'manual' },
      { id: OTRA_CUENTA, nombre: 'Otra Clínica', clase: 'clinica', es_cliente: false, tipo_identificacion: 'NIT', numero_identificacion: '800197268', codigo_prestador: null, modalidad_facturacion: null, notas: null, activo: true, origen: 'manual' },
    ],
    sedes: [
      sede(SEDE_CLINICA_1, CLINICA, 'Clínica Ejemplo sede Cabecera', { es_principal: true, reps_code: '680010000001' }),
      sede(SEDE_CLINICA_2, CLINICA, 'Clínica Ejemplo sede Norte', { reps_code: '680010000002' }),
      sede(SEDE_CONSULTORIO, CONSULTORIO, 'Consultorio Dr. Ruiz', { es_principal: true, origen: 'manual', ubicacion_confirmada: false }),
      sede(SEDE_OTRA, OTRA_CUENTA, 'Otra Clínica principal', { es_principal: true, municipality_id: '05001', ciudad: 'Medellín' }),
    ],
    medicos: [],
    medico_sedes: [],
    medico_visitantes: [],
    contactos: [],
    subtipos_institucionales: [
      ...SUBTIPOS_SEMILLA.map(subtipo => ({
        id: randomUUID(),
        codigo: subtipo.codigo,
        nombre: subtipo.nombre,
        para_que: subtipo.para_que,
        roles_sugeridos: [...subtipo.roles_sugeridos],
        orden: subtipo.orden,
        vigente_desde: '2026-10-12',
        vigente_hasta: null,
      })),
      { id: randomUUID(), codigo: 'viejo', nombre: 'Subtipo apagado', para_que: 'Ya no se usa', roles_sugeridos: [], orden: 9, vigente_desde: '2026-01-01', vigente_hasta: '2026-02-01' },
    ],
  }
}

function apiRequest(path: string, options: { method?: string; body?: unknown; userId?: string | null } = {}) {
  const userId = options.userId === undefined ? ADMIN_ID : options.userId
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (userId) headers.cookie = `${SESSION_COOKIE_NAME}=${encodeURIComponent(signSession(userId, passwordVersion(`hash-${userId}`)))}`
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

const medicoNuevo = (extra: Fila = {}) => ({
  tipo_documento: 'CC',
  numero_documento: '1.098.765.432',
  nombre: 'Dr. Andrés Pérez Gómez',
  especialidades: ['ortopedia', 'columna'],
  municipality_id: '68001',
  telefono: '300 123 4567',
  sedes: [
    { sede_id: SEDE_CLINICA_1, rol: 'atiende' },
    { sede_id: SEDE_CONSULTORIO, rol: 'consultorio' },
  ],
  ...extra,
})

const params = (id: string) => ({ params: { id } })

// ---------------------------------------------------------------------------
// Pruebas
// ---------------------------------------------------------------------------

async function main() {
  const tablas = datosIniciales()
  const fake = fakeSupabase(tablas)
  fetchHandler = fake.handler

  try {
    print('1. Permisos')
    {
      const antes = fake.writes().length
      const r = await leer(await crearMedico(apiRequest('/api/terceros/medicos', { method: 'POST', body: medicoNuevo(), userId: VIEWER_ID })))
      check('viewer NO crea médicos (403) y no escribe nada', r.status === 403 && fake.writes().length === antes, r)
      const c = await leer(
        await crearCuenta(
          apiRequest('/api/terceros/cuentas', {
            method: 'POST',
            userId: VIEWER_ID,
            body: { nombre: 'X', clase: 'clinica', tipo_identificacion: 'NIT', numero_identificacion: '900123456', sede: { municipality_id: '68001' } },
          })
        )
      )
      check('viewer NO crea cuentas (403)', c.status === 403, c)
      const sinSesion = await leer(await listarCuentas(apiRequest('/api/terceros/cuentas', { userId: null })))
      check('sin sesión: 401', sinSesion.status === 401, sinSesion)
      const vista = await leer(await listarCuentas(apiRequest('/api/terceros/cuentas', { userId: VIEWER_ID })))
      check('viewer SÍ ve la lista de cuentas (terceros:view)', vista.status === 200 && vista.body.total === 3, vista)
      const editar = await leer(
        await editarCuenta(apiRequest(`/api/terceros/cuentas/${CLINICA}`, { method: 'PATCH', userId: VENTAS_ID, body: { notas: 'x' } }), params(CLINICA))
      )
      check('sales_manager NO edita cuentas (terceros:manage) → 403', editar.status === 403, editar)
      const visitanteVentas = await leer(
        await asignarVisitante(
          apiRequest(`/api/terceros/medicos/${CLINICA}/visitantes`, { method: 'POST', userId: VENTAS_ID, body: { executive_id: EJEC_1, line_id: LINEA_A } }),
          params(CLINICA)
        )
      )
      check('sales_manager NO asigna visitantes (visitantes:manage) → 403', visitanteVentas.status === 403, visitanteVentas)
    }

    print('\n2. Cuentas: lista, privacidad de la identificación, creación y 409 por NIT repetido')
    {
      const vista = await leer(await listarCuentas(apiRequest('/api/terceros/cuentas', { userId: VIEWER_ID })))
      const consultorio = vista.body.items.find((item: any) => item.id === CONSULTORIO)
      const clinica = vista.body.items.find((item: any) => item.id === CLINICA)
      check('viewer: la cédula del consultorio sale como null', consultorio && consultorio.numero_identificacion === null, consultorio)
      check('viewer: el NIT de la clínica sí se muestra', clinica?.numero_identificacion === NIT_CLINICA, clinica)
      check('la lista cuenta las sedes activas de cada cuenta (clínica: 2)', clinica?.sedes === 2, clinica)
      check('la respuesta de la lista no trae la cédula en ningún lado', !JSON.stringify(vista.body).includes(CC_CONSULTORIO))
      const admin = await leer(await listarCuentas(apiRequest('/api/terceros/cuentas')))
      check(
        'admin (terceros:manage): ve la cédula del consultorio',
        admin.body.items.find((item: any) => item.id === CONSULTORIO)?.numero_identificacion === CC_CONSULTORIO,
        admin.body
      )
      const buscaCedulaViewer = await leer(await listarCuentas(apiRequest(`/api/terceros/cuentas?q=${CC_CONSULTORIO.slice(0, 7)}`, { userId: VIEWER_ID })))
      check('viewer: buscar por la cédula no encuentra la cuenta (no se puede averiguar el documento)', buscaCedulaViewer.status === 200 && buscaCedulaViewer.body.total === 0, buscaCedulaViewer.body)
      const buscaCedulaAdminGet = await leer(await listarCuentas(apiRequest(`/api/terceros/cuentas?q=${CC_CONSULTORIO.slice(0, 7)}`)))
      check(
        'admin por GET: un número en la URL solo busca NIT (la cédula no se busca por la URL: quedaría en los logs)',
        buscaCedulaAdminGet.status === 200 && buscaCedulaAdminGet.body.total === 0,
        buscaCedulaAdminGet.body
      )
      const buscaCedulaAdmin = await leer(
        await buscarCuentas(apiRequest('/api/terceros/cuentas/buscar', { method: 'POST', body: { q: CC_CONSULTORIO.slice(0, 7) } }))
      )
      check(
        'admin por POST /cuentas/buscar (documento en el cuerpo): buscar por la cédula sí la encuentra',
        buscaCedulaAdmin.status === 200 && buscaCedulaAdmin.body.total === 1 && buscaCedulaAdmin.body.items[0].id === CONSULTORIO,
        buscaCedulaAdmin.body
      )
      const buscaCedulaViewerPost = await leer(
        await buscarCuentas(apiRequest('/api/terceros/cuentas/buscar', { method: 'POST', userId: VIEWER_ID, body: { q: CC_CONSULTORIO.slice(0, 7) } }))
      )
      check(
        'viewer por POST /cuentas/buscar: la cédula tampoco (sin terceros:manage solo NIT)',
        buscaCedulaViewerPost.status === 200 && buscaCedulaViewerPost.body.total === 0,
        buscaCedulaViewerPost.body
      )
      const buscaNitPost = await leer(
        await buscarCuentas(
          apiRequest('/api/terceros/cuentas/buscar', { method: 'POST', userId: VIEWER_ID, body: { q: '890.903.938-8', clase: 'clinica', cliente: true, page: 1 } })
        )
      )
      check(
        'POST /cuentas/buscar: NIT con DV + clase + cliente (booleano) dan lo mismo que GET',
        buscaNitPost.status === 200 && buscaNitPost.body.total === 1 && buscaNitPost.body.items[0].id === CLINICA && buscaNitPost.body.page === 1,
        buscaNitPost.body
      )
      const buscaMala = await leer(
        await buscarCuentas(apiRequest('/api/terceros/cuentas/buscar', { method: 'POST', userId: VIEWER_ID, body: { clase: 'hospital' } }))
      )
      check('POST /cuentas/buscar: clase fuera de la lista → 400', buscaMala.status === 400, buscaMala)
      const buscaSinSesion = await leer(await buscarCuentas(apiRequest('/api/terceros/cuentas/buscar', { method: 'POST', userId: null, body: {} })))
      check('POST /cuentas/buscar sin sesión → 401', buscaSinSesion.status === 401, buscaSinSesion)
      const buscaNit = await leer(await listarCuentas(apiRequest('/api/terceros/cuentas?q=890.903.938-8', { userId: VIEWER_ID })))
      check('buscar por NIT con puntos y DV encuentra la clínica', buscaNit.body.total === 1 && buscaNit.body.items[0].id === CLINICA, buscaNit.body)
      const sinTilde = await leer(await listarCuentas(apiRequest('/api/terceros/cuentas?q=clinica%20ejemplo', { userId: VIEWER_ID })))
      check('buscar "clinica ejemplo" (sin tilde) encuentra "Clínica Ejemplo del Oriente"', sinTilde.body.total === 1 && sinTilde.body.items[0].id === CLINICA, sinTilde.body)
      const porClase = await leer(await listarCuentas(apiRequest('/api/terceros/cuentas?clase=consultorio&cliente=false', { userId: VIEWER_ID })))
      check('filtro clase=consultorio&cliente=false', porClase.body.total === 1 && porClase.body.items[0].id === CONSULTORIO, porClase.body)
      const claseMala = await leer(await listarCuentas(apiRequest('/api/terceros/cuentas?clase=hospital', { userId: VIEWER_ID })))
      check('clase fuera de la lista → 400', claseMala.status === 400, claseMala)

      // Filtro "ciudad": cuentas con alguna sede ACTIVA en ese municipio
      const enBucaramanga = await leer(await listarCuentas(apiRequest('/api/terceros/cuentas?municipio=68001', { userId: VIEWER_ID })))
      const idsBucaramanga = (enBucaramanga.body?.items ?? []).map((item: any) => item.id).sort()
      check(
        'filtro municipio=68001: las cuentas con sede en Bucaramanga (clínica y consultorio), con su conteo de sedes',
        enBucaramanga.status === 200 &&
          enBucaramanga.body.total === 2 &&
          idsBucaramanga.join(',') === [CLINICA, CONSULTORIO].sort().join(',') &&
          enBucaramanga.body.items.find((item: any) => item.id === CLINICA)?.sedes === 2,
        enBucaramanga.body
      )
      check(
        'filtro municipio (viewer): la cédula del consultorio sigue oculta',
        enBucaramanga.body?.items?.find((item: any) => item.id === CONSULTORIO)?.numero_identificacion === null &&
          !JSON.stringify(enBucaramanga.body).includes(CC_CONSULTORIO),
        enBucaramanga.body
      )
      const enMedellin = await leer(await listarCuentas(apiRequest('/api/terceros/cuentas?municipio=05001', { userId: VIEWER_ID })))
      check(
        'filtro municipio=05001: solo la cuenta con sede en Medellín',
        enMedellin.body.total === 1 && enMedellin.body.items[0].id === OTRA_CUENTA,
        enMedellin.body
      )
      const municipioYClase = await leer(
        await listarCuentas(apiRequest('/api/terceros/cuentas?municipio=68001&clase=consultorio', { userId: VIEWER_ID }))
      )
      check(
        'filtro municipio + clase se combinan',
        municipioYClase.body.total === 1 && municipioYClase.body.items[0].id === CONSULTORIO,
        municipioYClase.body
      )
      const sedeOtra = tablas.sedes.find(sede => sede.id === SEDE_OTRA) as Fila
      sedeOtra.activo = false
      const sedeInactiva = await leer(await listarCuentas(apiRequest('/api/terceros/cuentas?municipio=05001', { userId: VIEWER_ID })))
      sedeOtra.activo = true
      check('filtro municipio: una sede inactiva no cuenta', sedeInactiva.status === 200 && sedeInactiva.body.total === 0, sedeInactiva.body)
      const sinCuentas = await leer(await listarCuentas(apiRequest('/api/terceros/cuentas?municipio=11001', { userId: VIEWER_ID })))
      check('filtro municipio sin cuentas → lista vacía', sinCuentas.status === 200 && sinCuentas.body.total === 0 && sinCuentas.body.items.length === 0, sinCuentas.body)
      const municipioMalo = await leer(await listarCuentas(apiRequest('/api/terceros/cuentas?municipio=680', { userId: VIEWER_ID })))
      check('municipio que no es de 5 dígitos → 400', municipioMalo.status === 400, municipioMalo)

      const repetida = await leer(
        await crearCuenta(
          apiRequest('/api/terceros/cuentas', {
            method: 'POST',
            userId: VENTAS_ID,
            body: { nombre: 'Clínica con otro nombre', clase: 'clinica', tipo_identificacion: 'NIT', numero_identificacion: '890.903.938-8', sede: { municipality_id: '68001' } },
          })
        )
      )
      check(
        'NIT repetido (con puntos y DV) → 409 con { existente: { id, nombre } }',
        repetida.status === 409 && repetida.body.existente?.id === CLINICA && repetida.body.existente?.nombre === 'Clínica Ejemplo del Oriente' && typeof repetida.body.error === 'string',
        repetida
      )
      check('el 409 no crea nada', tablas.cuentas.length === 3 && tablas.sedes.length === 4)

      const cliente = await leer(
        await crearCuenta(
          apiRequest('/api/terceros/cuentas', {
            method: 'POST',
            userId: VENTAS_ID,
            body: { nombre: 'EPS Nueva', clase: 'eps', es_cliente: true, tipo_identificacion: 'NIT', numero_identificacion: '900123456', sede: { municipality_id: '68001' } },
          })
        )
      )
      check('sales_manager no puede marcar la cuenta como cliente (403)', cliente.status === 403, cliente)

      const dv = dvNit('900123456')
      const nueva = await leer(
        await crearCuenta(
          apiRequest('/api/terceros/cuentas', {
            method: 'POST',
            userId: VENTAS_ID,
            body: {
              nombre: '  Clínica  Nueva SAS ',
              clase: 'clinica',
              tipo_identificacion: 'NIT',
              numero_identificacion: `900.123.456-${dv}`,
              sede: { municipality_id: '11001', reps_code: '110010000099', direccion: 'Calle 1 # 2-3' },
            },
          })
        )
      )
      const sedeNueva = tablas.sedes.find(sede => sede.cuenta_id === nueva.body?.id)
      check(
        'sales_manager crea cuenta (NIT normalizado a 9 dígitos) → 201',
        nueva.status === 201 && nueva.body.cuenta?.numero_identificacion === '900123456' && nueva.body.cuenta?.nombre === 'Clínica Nueva SAS',
        nueva
      )
      check(
        'con su sede principal: es_principal, origen manual, ubicación sin confirmar, ciudad del municipio, nombre de la cuenta',
        sedeNueva?.es_principal === true &&
          sedeNueva?.origen === 'manual' &&
          sedeNueva?.ubicacion_confirmada === false &&
          sedeNueva?.ciudad === 'Bogotá D.C.' &&
          sedeNueva?.nombre === 'Clínica Nueva SAS' &&
          sedeNueva?.created_by === VENTAS_ID,
        sedeNueva
      )
      const repsRepetido = await leer(
        await crearCuenta(
          apiRequest('/api/terceros/cuentas', {
            method: 'POST',
            userId: VENTAS_ID,
            body: { nombre: 'Otra más', clase: 'consultorio', tipo_identificacion: 'CC', numero_identificacion: '5551234', sede: { municipality_id: '68001', reps_code: '680010000001' } },
          })
        )
      )
      check(
        'cuenta con sede de código de habilitación repetido → 409 con la sede existente y sin crear la cuenta',
        repsRepetido.status === 409 && repsRepetido.body.existente?.id === SEDE_CLINICA_1 && !tablas.cuentas.some(cuenta => cuenta.numero_identificacion === '5551234'),
        repsRepetido
      )

      const detalle = await leer(await verCuenta(apiRequest(`/api/terceros/cuentas/${CONSULTORIO}`, { userId: VIEWER_ID }), params(CONSULTORIO)))
      check(
        'detalle de cuenta (viewer): sedes y contactos, cédula oculta',
        detalle.status === 200 && detalle.body.cuenta.numero_identificacion === null && detalle.body.sedes.length === 1 && Array.isArray(detalle.body.contactos),
        detalle
      )
      const noExiste = await leer(await verCuenta(apiRequest(`/api/terceros/cuentas/${randomUUID()}`), params(randomUUID())))
      check('cuenta que no existe → 404', noExiste.status === 404, noExiste)
      const idMalo = await leer(await verCuenta(apiRequest('/api/terceros/cuentas/abc'), params('abc')))
      check('id que no es UUID → 400', idMalo.status === 400, idMalo)

      const modalidadMala = await leer(
        await editarCuenta(apiRequest(`/api/terceros/cuentas/${CLINICA}`, { method: 'PATCH', body: { modalidad_facturacion: 'directa' } }), params(CLINICA))
      )
      check('modalidad de facturación en una cuenta que no es EPS → 400', modalidadMala.status === 400, modalidadMala)
      const editada = await leer(
        await editarCuenta(apiRequest(`/api/terceros/cuentas/${CLINICA}`, { method: 'PATCH', body: { es_cliente: false, notas: 'Revisar contrato' } }), params(CLINICA))
      )
      check('admin edita cuenta (es_cliente, notas)', editada.status === 200 && editada.body.cuenta.es_cliente === false && editada.body.cuenta.notas === 'Revisar contrato', editada)

      // Una cuenta por identificación: el NIT no se repite cambiando el tipo a CC u "otro" (hallazgo de revisión).
      const cuentasAntes = tablas.cuentas.length
      const nuevaCuenta = (tipo: string, numero: string, nombre = 'Clínica Ejemplo con otro tipo') =>
        crearCuenta(
          apiRequest('/api/terceros/cuentas', {
            method: 'POST',
            userId: VENTAS_ID,
            body: { nombre, clase: 'clinica', tipo_identificacion: tipo, numero_identificacion: numero, sede: { municipality_id: '11001' } },
          })
        )
      const comoCc = await leer(await nuevaCuenta('CC', NIT_CLINICA))
      check(
        'el NIT de una cuenta que ya existe, escrito como CC → 409 con { existente } (la clínica) y el NIT en el mensaje',
        comoCc.status === 409 && comoCc.body.existente?.id === CLINICA && String(comoCc.body.error).includes(NIT_CLINICA),
        comoCc
      )
      const comoCcConDv = await leer(await nuevaCuenta('CC', `${NIT_CLINICA}${dvNit(NIT_CLINICA)}`))
      check('el NIT con su DV pegado, como CC → 409 con la clínica', comoCcConDv.status === 409 && comoCcConDv.body.existente?.id === CLINICA, comoCcConDv)
      const comoCcConGuion = await leer(await nuevaCuenta('CC', `890.903.938-${dvNit(NIT_CLINICA)}`))
      check(
        'el NIT con puntos y "-DV", como CC → 400 (una cédula no lleva DV: que elija NIT)',
        comoCcConGuion.status === 400 && /dígito de verificación/.test(comoCcConGuion.body?.error ?? ''),
        comoCcConGuion
      )
      const comoOtro = await leer(await nuevaCuenta('otro', NIT_CLINICA))
      check('el NIT como "otro" → 400 (forma de NIT)', comoOtro.status === 400 && /forma de NIT/.test(comoOtro.body?.error ?? ''), comoOtro)
      check('nada de eso creó una cuenta', tablas.cuentas.length === cuentasAntes, tablas.cuentas.length)
      const personaNueve = await leer(await nuevaCuenta('CC', '912345678', 'Consultorio de nueve dígitos'))
      check('una CC de 9 dígitos que no choca con ningún NIT sí se crea', personaNueve.status === 201, personaNueve)
      const nitDeEsaCc = await leer(await nuevaCuenta('NIT', '912345678', 'Empresa con ese número'))
      check(
        'al revés: un NIT igual a una cuenta CC que ya existe → 409 con ella, sin repetir el número en el mensaje',
        nitDeEsaCc.status === 409 && nitDeEsaCc.body.existente?.id === personaNueve.body?.id && !String(nitDeEsaCc.body.error).includes('912345678'),
        nitDeEsaCc
      )
      const otroNit = await leer(await nuevaCuenta('NIT', '900294380', 'Empresa distinta'))
      check('un NIT que no choca con nada sí se crea', otroNit.status === 201, otroNit)
      // Se dejan las cuentas como estaban para las demás secciones.
      const creadas = new Set([personaNueve.body?.id, otroNit.body?.id].filter(Boolean))
      tablas.cuentas = tablas.cuentas.filter(cuenta => !creadas.has(cuenta.id))
      tablas.sedes = tablas.sedes.filter(sede => !creadas.has(sede.cuenta_id))
    }

    print('\n3. Sedes: crear, 409 por código de habilitación, cambiar la principal, buscador')
    {
      const repetida = await leer(
        await crearSede(
          apiRequest('/api/terceros/sedes', {
            method: 'POST',
            userId: VENTAS_ID,
            body: { cuenta_id: CONSULTORIO, nombre: 'Consultorio 2', municipality_id: '68001', reps_code: '6800-1000-0002' },
          })
        )
      )
      check(
        'sede con código de habilitación repetido → 409 con { existente } (sede y cuenta)',
        repetida.status === 409 && repetida.body.existente?.id === SEDE_CLINICA_2 && repetida.body.existente?.cuenta_nombre === 'Clínica Ejemplo del Oriente',
        repetida
      )
      const nueva = await leer(
        await crearSede(
          apiRequest('/api/terceros/sedes', {
            method: 'POST',
            userId: VENTAS_ID,
            body: { cuenta_id: CONSULTORIO, nombre: 'Consultorio Ruiz Floridablanca', municipality_id: '68001', lat: 7.06, lng: -73.09 },
          })
        )
      )
      check(
        'sales_manager crea sede: no principal, origen manual, sin confirmar',
        nueva.status === 201 && nueva.body.sede.es_principal === false && nueva.body.sede.origen === 'manual' && nueva.body.sede.ubicacion_confirmada === false,
        nueva
      )
      const sinCuenta = await leer(
        await crearSede(apiRequest('/api/terceros/sedes', { method: 'POST', body: { cuenta_id: randomUUID(), nombre: 'X sede', municipality_id: '68001' } }))
      )
      check('sede de una cuenta que no existe → 400', sinCuenta.status === 400, sinCuenta)
      const municipioMalo = await leer(
        await crearSede(apiRequest('/api/terceros/sedes', { method: 'POST', body: { cuenta_id: CONSULTORIO, nombre: 'X sede', municipality_id: '99999' } }))
      )
      check('sede con municipio inexistente → 400', municipioMalo.status === 400, municipioMalo)

      const sinPermiso = await leer(
        await editarSede(apiRequest(`/api/terceros/sedes/${SEDE_CLINICA_2}`, { method: 'PATCH', userId: VENTAS_ID, body: { es_principal: true } }), params(SEDE_CLINICA_2))
      )
      check('sales_manager no edita sedes (403)', sinPermiso.status === 403, sinPermiso)
      const principal = await leer(
        await editarSede(apiRequest(`/api/terceros/sedes/${SEDE_CLINICA_2}`, { method: 'PATCH', body: { es_principal: true, ubicacion_confirmada: true } }), params(SEDE_CLINICA_2))
      )
      const principales = tablas.sedes.filter(sede => sede.cuenta_id === CLINICA && sede.es_principal === true)
      check(
        'cambiar la principal: la nueva queda principal y la anterior no (una sola por cuenta)',
        principal.status === 200 && principales.length === 1 && principales[0].id === SEDE_CLINICA_2,
        { principal, principales }
      )
      const repsOtra = await leer(
        await editarSede(apiRequest(`/api/terceros/sedes/${SEDE_CONSULTORIO}`, { method: 'PATCH', body: { reps_code: '680010000001' } }), params(SEDE_CONSULTORIO))
      )
      check('editar sede con código de habilitación de otra → 409', repsOtra.status === 409 && repsOtra.body.existente?.id === SEDE_CLINICA_1, repsOtra)

      // Sede que ES una IPS de OpMap (hospital_id): sus datos los pisa la sincronización con hospitals.
      const sedeIps = tablas.sedes.find(sede => sede.id === SEDE_CLINICA_1) as Fila
      sedeIps.hospital_id = randomUUID()
      const escriturasAntes = fake.writes().length
      const renombrar = await leer(
        await editarSede(apiRequest(`/api/terceros/sedes/${SEDE_CLINICA_1}`, { method: 'PATCH', body: { nombre: 'Nombre a mano' } }), params(SEDE_CLINICA_1))
      )
      const desactivar = await leer(
        await editarSede(apiRequest(`/api/terceros/sedes/${SEDE_CLINICA_1}`, { method: 'PATCH', body: { activo: false } }), params(SEDE_CLINICA_1))
      )
      const moverla = await leer(
        await editarSede(
          apiRequest(`/api/terceros/sedes/${SEDE_CLINICA_1}`, { method: 'PATCH', body: { es_principal: true, lat: 7.1, lng: -73.1 } }),
          params(SEDE_CLINICA_1)
        )
      )
      check(
        'sede de una IPS de OpMap: nombre, estado o coordenadas → 400 (se cambian en la ficha de la IPS) y no escribe nada',
        renombrar.status === 400 &&
          /ficha de la IPS/.test(renombrar.body?.error ?? '') &&
          desactivar.status === 400 &&
          moverla.status === 400 &&
          sedeIps.nombre === 'Clínica Ejemplo sede Cabecera' &&
          sedeIps.activo === true &&
          sedeIps.lat === null &&
          fake.writes().length === escriturasAntes,
        { renombrar, desactivar, moverla }
      )
      const principalIps = await leer(
        await editarSede(apiRequest(`/api/terceros/sedes/${SEDE_CLINICA_1}`, { method: 'PATCH', body: { es_principal: true } }), params(SEDE_CLINICA_1))
      )
      const principalesIps = tablas.sedes.filter(sede => sede.cuenta_id === CLINICA && sede.es_principal === true)
      check(
        'sede de una IPS de OpMap: sí se puede volver la principal de su cuenta',
        principalIps.status === 200 && principalesIps.length === 1 && principalesIps[0].id === SEDE_CLINICA_1,
        { principalIps, principalesIps }
      )
      const devolver = await leer(
        await editarSede(apiRequest(`/api/terceros/sedes/${SEDE_CLINICA_2}`, { method: 'PATCH', body: { es_principal: true } }), params(SEDE_CLINICA_2))
      )
      sedeIps.hospital_id = null
      check(
        'la principal vuelve a la sede Norte (una sola por cuenta)',
        devolver.status === 200 && tablas.sedes.filter(sede => sede.cuenta_id === CLINICA && sede.es_principal === true).map(sede => sede.id).join() === SEDE_CLINICA_2,
        devolver
      )

      const busqueda = await leer(await buscarSedes(apiRequest('/api/terceros/sedes?q=ejemplo%20norte', { userId: VIEWER_ID })))
      check(
        'buscador de sedes: por nombre, con el nombre de su cuenta',
        busqueda.status === 200 && busqueda.body.items.length === 1 && busqueda.body.items[0].id === SEDE_CLINICA_2 && busqueda.body.items[0].cuenta_nombre === 'Clínica Ejemplo del Oriente',
        busqueda.body
      )
      const porCuenta = await leer(await buscarSedes(apiRequest('/api/terceros/sedes?q=oriente', { userId: VIEWER_ID })))
      check('buscador de sedes: por nombre de la cuenta trae sus sedes', porCuenta.body.items.length === 2, porCuenta.body)
      const porReps = await leer(await buscarSedes(apiRequest('/api/terceros/sedes?q=680010000001', { userId: VIEWER_ID })))
      check('buscador de sedes: por código de habilitación', porReps.body.items.length === 1 && porReps.body.items[0].id === SEDE_CLINICA_1, porReps.body)
      const porMunicipio = await leer(await buscarSedes(apiRequest('/api/terceros/sedes?municipio=05001', { userId: VIEWER_ID })))
      check('buscador de sedes: por municipio', porMunicipio.body.items.length === 1 && porMunicipio.body.items[0].id === SEDE_OTRA, porMunicipio.body)
    }

    print('\n4. Médicos: crear completo, documento protegido, 409 por documento, 400 sin sede')
    let medicoId = ''
    {
      const sinSedes = await leer(await crearMedico(apiRequest('/api/terceros/medicos', { method: 'POST', userId: VENTAS_ID, body: medicoNuevo({ sedes: [] }) })))
      check(
        'médico sin sedes → 400 y no llama a terceros_crear_medico',
        sinSedes.status === 400 && /sede/i.test(sinSedes.body.error) && !fake.requests.some(request => request.table === 'rpc/terceros_crear_medico'),
        sinSedes
      )
      const sinEspecialidad = await leer(await crearMedico(apiRequest('/api/terceros/medicos', { method: 'POST', userId: VENTAS_ID, body: medicoNuevo({ especialidades: [] }) })))
      check('médico sin especialidad → 400', sinEspecialidad.status === 400, sinEspecialidad)
      const sedeFalsa = await leer(
        await crearMedico(apiRequest('/api/terceros/medicos', { method: 'POST', userId: VENTAS_ID, body: medicoNuevo({ sedes: [{ sede_id: randomUUID(), rol: 'atiende' }] }) }))
      )
      check('médico con una sede que no existe → 400', sedeFalsa.status === 400 && tablas.medicos.length === 0, sedeFalsa)

      const creado = await leer(await crearMedico(apiRequest('/api/terceros/medicos', { method: 'POST', userId: VENTAS_ID, body: medicoNuevo() })))
      medicoId = creado.body?.id ?? ''
      const vinculos = tablas.medico_sedes.filter(vinculo => vinculo.medico_id === medicoId)
      check(
        'sales_manager crea médico → 201 con terceros_crear_medico (médico + 2 sedes, la primera principal)',
        creado.status === 201 &&
          fake.requests.some(request => request.table === 'rpc/terceros_crear_medico') &&
          tablas.medicos.length === 1 &&
          tablas.medicos[0].numero_documento === DOC_MEDICO &&
          vinculos.length === 2 &&
          vinculos.find(vinculo => vinculo.principal === true)?.sede_id === SEDE_CLINICA_1,
        { creado, vinculos }
      )
      check(
        'la respuesta de creación (sales_manager) no trae el documento',
        creado.body?.medico && !('numero_documento' in creado.body.medico) && !('tipo_documento' in creado.body.medico) && !JSON.stringify(creado.body).includes(DOC_MEDICO),
        creado.body
      )

      const repetido = await leer(
        await crearMedico(apiRequest('/api/terceros/medicos', { method: 'POST', userId: VENTAS_ID, body: medicoNuevo({ numero_documento: '1098765432', nombre: 'Otro Nombre' }) }))
      )
      check(
        'segundo médico con el mismo documento → 409 con { existente: { id, nombre } }',
        repetido.status === 409 && repetido.body.existente?.id === medicoId && repetido.body.existente?.nombre === 'Dr. Andrés Pérez Gómez' && tablas.medicos.length === 1,
        repetido
      )

      const verVentas = await leer(await verMedico(apiRequest(`/api/terceros/medicos/${medicoId}`, { userId: VENTAS_ID }), params(medicoId)))
      check(
        'detalle sin terceros:manage (sales_manager): sin tipo ni número de documento',
        verVentas.status === 200 &&
          !('numero_documento' in verVentas.body.medico) &&
          !('tipo_documento' in verVentas.body.medico) &&
          !JSON.stringify(verVentas.body).includes(DOC_MEDICO),
        verVentas.body
      )
      const consultaDetalle = fake.requests.filter(request => request.table === 'medicos' && request.method === 'GET').pop()
      check(
        'sin terceros:manage ni siquiera se pide el documento a la base',
        Boolean(consultaDetalle) && !(consultaDetalle?.params.get('select') ?? '').includes('numero_documento'),
        consultaDetalle?.params.get('select')
      )
      const verAdmin = await leer(await verMedico(apiRequest(`/api/terceros/medicos/${medicoId}`), params(medicoId)))
      check(
        'detalle con terceros:manage (admin): con tipo y número de documento',
        verAdmin.status === 200 && verAdmin.body.medico.tipo_documento === 'CC' && verAdmin.body.medico.numero_documento === DOC_MEDICO,
        verAdmin.body
      )
      check(
        'detalle: ciudad, sedes (principal primero, con su cuenta) y especialidades',
        verAdmin.body.medico.ciudad === 'Bucaramanga' &&
          verAdmin.body.medico.sedes.length === 2 &&
          verAdmin.body.medico.sedes[0].id === SEDE_CLINICA_1 &&
          verAdmin.body.medico.sedes[0].principal === true &&
          verAdmin.body.medico.sedes[0].cuenta_nombre === 'Clínica Ejemplo del Oriente',
        verAdmin.body.medico
      )

      const listaAdmin = await leer(await listarMedicos(apiRequest('/api/terceros/medicos')))
      check(
        'la lista de médicos nunca trae el documento, ni siquiera para admin',
        listaAdmin.status === 200 &&
          listaAdmin.body.total === 1 &&
          !('numero_documento' in listaAdmin.body.items[0]) &&
          !JSON.stringify(listaAdmin.body).includes(DOC_MEDICO),
        listaAdmin.body
      )
      const sinTilde = await leer(await listarMedicos(apiRequest('/api/terceros/medicos?q=andres%20perez', { userId: VIEWER_ID })))
      check('buscar "andres perez" (sin tildes) encuentra al Dr. Andrés Pérez', sinTilde.body.total === 1 && sinTilde.body.items[0].id === medicoId, sinTilde.body)
      const docViewer = await leer(await listarMedicos(apiRequest(`/api/terceros/medicos?q=${DOC_MEDICO}`, { userId: VIEWER_ID })))
      check('viewer: buscar por el documento no encuentra al médico', docViewer.body.total === 0, docViewer.body)
      const pedidasAntesDelGet = fake.requests.length
      const docAdminGet = await leer(await listarMedicos(apiRequest(`/api/terceros/medicos?q=${DOC_MEDICO}`)))
      const pedidasDelGet = fake.requests.slice(pedidasAntesDelGet)
      check(
        'admin por GET: el documento en la URL NO se busca (quedaría en los logs de peticiones)',
        docAdminGet.status === 200 && docAdminGet.body.total === 0,
        docAdminGet.body
      )
      check(
        'GET con el documento: la consulta a la base ni siquiera filtra por numero_documento',
        pedidasDelGet.length > 0 && !pedidasDelGet.some(request => request.params.has('numero_documento')),
        pedidasDelGet.map(request => `${request.table}?${request.params.toString()}`)
      )
      const docAdmin = await leer(
        await buscarMedicos(apiRequest('/api/terceros/medicos/buscar', { method: 'POST', body: { q: '1.098.765' } }))
      )
      check(
        'admin por POST /medicos/buscar (documento en el cuerpo): sí lo encuentra, sin devolver el documento',
        docAdmin.status === 200 && docAdmin.body.total === 1 && docAdmin.body.items[0].id === medicoId && !JSON.stringify(docAdmin.body).includes(DOC_MEDICO),
        docAdmin.body
      )
      const docVentasPost = await leer(
        await buscarMedicos(apiRequest('/api/terceros/medicos/buscar', { method: 'POST', userId: VENTAS_ID, body: { q: DOC_MEDICO } }))
      )
      check('sales_manager por POST /medicos/buscar: el documento no encuentra nada (sin terceros:manage)', docVentasPost.status === 200 && docVentasPost.body.total === 0, docVentasPost.body)
      const porNombrePost = await leer(
        await buscarMedicos(apiRequest('/api/terceros/medicos/buscar', { method: 'POST', userId: VIEWER_ID, body: { q: 'andres perez', municipio: '68001' } }))
      )
      check(
        'POST /medicos/buscar por nombre y municipio (viewer)',
        porNombrePost.status === 200 && porNombrePost.body.total === 1 && porNombrePost.body.items[0].id === medicoId,
        porNombrePost.body
      )
      const visitanteMalo = await leer(
        await buscarMedicos(apiRequest('/api/terceros/medicos/buscar', { method: 'POST', userId: VIEWER_ID, body: { visitante: 'todos' } }))
      )
      check('POST /medicos/buscar: visitante distinto de "me" → 400', visitanteMalo.status === 400, visitanteMalo)
      const otroMunicipio = await leer(await listarMedicos(apiRequest('/api/terceros/medicos?municipio=05001', { userId: VIEWER_ID })))
      check('filtro por municipio', otroMunicipio.body.total === 0, otroMunicipio.body)

      const verificar = await leer(
        await verificarMedico(
          apiRequest('/api/terceros/medicos/verificar', {
            method: 'POST',
            userId: VENTAS_ID,
            body: { tipo_documento: 'CC', numero_documento: '1098765432', nombre: 'Andres Perez' },
          })
        )
      )
      check(
        'verificar: documento existente → { existente: { id, nombre } } sin documento',
        verificar.status === 200 && verificar.body.existente?.id === medicoId && !JSON.stringify(verificar.body).includes(DOC_MEDICO),
        verificar.body
      )
      const parecido = await leer(
        await verificarMedico(
          apiRequest('/api/terceros/medicos/verificar', {
            method: 'POST',
            userId: VENTAS_ID,
            body: { tipo_documento: 'CC', numero_documento: '77777777', nombre: 'Andrés Pérez', municipality_id: '68001' },
          })
        )
      )
      check(
        'verificar: otro documento con nombre parecido → existente null y el médico en parecidos (con ciudad)',
        parecido.body.existente === null && parecido.body.parecidos.length === 1 && parecido.body.parecidos[0].id === medicoId && parecido.body.parecidos[0].ciudad === 'Bucaramanga',
        parecido.body
      )
      // Parecidos sin tope: con más de 1.000 médicos que encajan con una palabra común ("ana"), el parecido de verdad
      // (el de id más alto) se encuentra igual. "Ana Gomes" ≈ "Ana Gómez", pero el patrón de "gomes" no encaja con
      // "Gómez" (z ≠ s): solo lo trae la palabra "ana". Antes se cortaba en 1.000 por id y se perdía en silencio.
      const relleno: Fila[] = Array.from({ length: 1100 }, (_, indice) => ({
        id: `00000000-0000-4000-8000-${String(indice).padStart(12, '0')}`,
        tipo_documento: 'CC',
        numero_documento: String(5000000 + indice),
        nombre: `Fernando Relleno ${indice}`,
        especialidades: ['otra'],
        municipality_id: '11001',
        telefono: null,
        email: null,
        notas: null,
        activo: false,
        created_at: '2026-10-12T00:00:00.000Z',
      }))
      const PARECIDO_ULTIMO = 'ffffffff-ffff-4fff-8fff-ffffffffffff'
      tablas.medicos.push(...relleno, {
        id: PARECIDO_ULTIMO,
        tipo_documento: 'CC',
        numero_documento: '7654321',
        nombre: 'Ana Gómez',
        especialidades: ['ortopedia'],
        municipality_id: '05001',
        telefono: null,
        email: null,
        notas: null,
        activo: false,
        created_at: '2026-10-12T00:00:00.000Z',
      })
      const muchos = await leer(
        await verificarMedico(
          apiRequest('/api/terceros/medicos/verificar', {
            method: 'POST',
            userId: VENTAS_ID,
            body: { tipo_documento: 'CC', numero_documento: '88888888', nombre: 'Ana Gomes' },
          })
        )
      )
      tablas.medicos = tablas.medicos.filter(medico => !String(medico.id).startsWith('00000000-0000-4000-8000-') && medico.id !== PARECIDO_ULTIMO)
      check(
        'verificar con más de 1.000 candidatos por palabra: encuentra el parecido aunque sea el último por id',
        muchos.status === 200 && muchos.body.parecidos.some((parecido: any) => parecido.id === PARECIDO_ULTIMO && parecido.ciudad === 'Medellín'),
        muchos.body
      )
      check('se quitaron los médicos de relleno', tablas.medicos.length === 1, tablas.medicos.length)

      const verificarViewer = await leer(
        await verificarMedico(apiRequest('/api/terceros/medicos/verificar', { method: 'POST', userId: VIEWER_ID, body: { tipo_documento: 'CC', numero_documento: '1098765432' } }))
      )
      check('viewer no puede verificar documentos (terceros:create) → 403', verificarViewer.status === 403, verificarViewer)

      const editarVentas = await leer(
        await editarMedico(apiRequest(`/api/terceros/medicos/${medicoId}`, { method: 'PATCH', userId: VENTAS_ID, body: { telefono: '3001112233' } }), params(medicoId))
      )
      check('sales_manager no edita médicos (403)', editarVentas.status === 403, editarVentas)
      const editarAdmin = await leer(
        await editarMedico(apiRequest(`/api/terceros/medicos/${medicoId}`, { method: 'PATCH', body: { especialidades: ['ortopedia'], email: 'Andres@Correo.co' } }), params(medicoId))
      )
      check(
        'admin edita el médico (especialidades, correo en minúsculas)',
        editarAdmin.status === 200 && editarAdmin.body.medico.especialidades.length === 1 && editarAdmin.body.medico.email === 'andres@correo.co',
        editarAdmin
      )
      const quitarDocumento = await leer(
        await editarMedico(apiRequest(`/api/terceros/medicos/${medicoId}`, { method: 'PATCH', body: { numero_documento: null } }), params(medicoId))
      )
      check('no se puede quitar el documento (400)', quitarDocumento.status === 400 && tablas.medicos[0].numero_documento === DOC_MEDICO, quitarDocumento)
    }

    print('\n5. Sedes del médico: vincular y no dejarlo sin sede')
    {
      const vincular = await leer(
        await vincularSede(apiRequest(`/api/terceros/medicos/${medicoId}/sedes`, { method: 'POST', userId: VENTAS_ID, body: { sede_id: SEDE_CLINICA_2, rol: 'atiende' } }), params(medicoId))
      )
      check('sales_manager vincula otra sede (terceros:create) → 201', vincular.status === 201 && tablas.medico_sedes.filter(v => v.medico_id === medicoId).length === 3, vincular)
      const otraVez = await leer(
        await vincularSede(apiRequest(`/api/terceros/medicos/${medicoId}/sedes`, { method: 'POST', body: { sede_id: SEDE_CLINICA_2, rol: 'atiende' } }), params(medicoId))
      )
      check('vincular la misma sede otra vez → 409', otraVez.status === 409, otraVez)
      const desvVentas = await leer(
        await desvincularSede(apiRequest(`/api/terceros/medicos/${medicoId}/sedes?sede_id=${SEDE_CLINICA_2}`, { method: 'DELETE', userId: VENTAS_ID }), params(medicoId))
      )
      check('sales_manager no desvincula sedes (terceros:manage) → 403', desvVentas.status === 403, desvVentas)
      const quitarPrincipal = await leer(
        await desvincularSede(apiRequest(`/api/terceros/medicos/${medicoId}/sedes?sede_id=${SEDE_CLINICA_1}`, { method: 'DELETE' }), params(medicoId))
      )
      const vinculosTras = tablas.medico_sedes.filter(vinculo => vinculo.medico_id === medicoId)
      check(
        'desvincular la principal: queda otra como principal',
        quitarPrincipal.status === 200 && vinculosTras.length === 2 && vinculosTras.filter(vinculo => vinculo.principal === true).length === 1,
        { quitarPrincipal, vinculosTras }
      )
      await desvincularSede(apiRequest(`/api/terceros/medicos/${medicoId}/sedes?sede_id=${SEDE_CLINICA_2}`, { method: 'DELETE' }), params(medicoId))
      const ultima = String(tablas.medico_sedes.find(vinculo => vinculo.medico_id === medicoId)?.sede_id)
      const sinSede = await leer(
        await desvincularSede(apiRequest(`/api/terceros/medicos/${medicoId}/sedes?sede_id=${ultima}`, { method: 'DELETE' }), params(medicoId))
      )
      check(
        'desvincular la ÚLTIMA sede → 400 y el médico conserva su sede',
        sinSede.status === 400 && /al menos una sede/.test(sinSede.body.error) && tablas.medico_sedes.filter(vinculo => vinculo.medico_id === medicoId).length === 1,
        sinSede
      )
      const noVinculada = await leer(
        await desvincularSede(apiRequest(`/api/terceros/medicos/${medicoId}/sedes?sede_id=${SEDE_OTRA}`, { method: 'DELETE' }), params(medicoId))
      )
      check('desvincular una sede que no es del médico → 404', noVinculada.status === 404, noVinculada)
    }

    print('\n6. Visitantes: líder solo en sus líneas, ejecutiva con la línea, terminar sin borrar')
    let visitanteA = ''
    {
      const ajena = await leer(
        await asignarVisitante(
          apiRequest(`/api/terceros/medicos/${medicoId}/visitantes`, { method: 'POST', userId: LIDER_ID, body: { executive_id: EJEC_2, line_id: LINEA_B } }),
          params(medicoId)
        )
      )
      check('line_leader NO asigna visitante en una línea ajena → 403 y no escribe', ajena.status === 403 && tablas.medico_visitantes.length === 0, ajena)
      const sinLinea = await leer(
        await asignarVisitante(
          apiRequest(`/api/terceros/medicos/${medicoId}/visitantes`, { method: 'POST', userId: LIDER_ID, body: { executive_id: EJEC_2, line_id: LINEA_A } }),
          params(medicoId)
        )
      )
      check('la ejecutiva debe llevar esa línea (executive_lines) → 400', sinLinea.status === 400 && tablas.medico_visitantes.length === 0, sinLinea)
      const propia = await leer(
        await asignarVisitante(
          apiRequest(`/api/terceros/medicos/${medicoId}/visitantes`, { method: 'POST', userId: LIDER_ID, body: { executive_id: EJEC_1, line_id: LINEA_A } }),
          params(medicoId)
        )
      )
      visitanteA = propia.body?.id ?? ''
      check(
        'line_leader asigna en SU línea → 201 (desde hoy, sin hasta)',
        propia.status === 201 && tablas.medico_visitantes.length === 1 && tablas.medico_visitantes[0].hasta === null && tablas.medico_visitantes[0].desde === HOY,
        propia
      )
      check(
        'la respuesta trae el médico con su visitante (nombre del Ejecutivo Comercial y de la línea)',
        propia.body?.medico?.visitantes?.[0]?.executive === 'Ana Ejecutiva' && propia.body?.medico?.visitantes?.[0]?.line === 'Línea A',
        propia.body?.medico
      )
      const repetido = await leer(
        await asignarVisitante(
          apiRequest(`/api/terceros/medicos/${medicoId}/visitantes`, { method: 'POST', userId: LIDER_ID, body: { executive_id: EJEC_1, line_id: LINEA_A } }),
          params(medicoId)
        )
      )
      check('el mismo visitante vigente otra vez → 409 con existente', repetido.status === 409 && repetido.body.existente?.id === visitanteA, repetido)
      const dosCiudades1 = await leer(
        await asignarVisitante(
          apiRequest(`/api/terceros/medicos/${medicoId}/visitantes`, { method: 'POST', userId: DIRECTORA_ID, body: { executive_id: EJEC_2, line_id: LINEA_B, municipality_id: '68001' } }),
          params(medicoId)
        )
      )
      const dosCiudades2 = await leer(
        await asignarVisitante(
          apiRequest(`/api/terceros/medicos/${medicoId}/visitantes`, { method: 'POST', userId: DIRECTORA_ID, body: { executive_id: EJEC_2, line_id: LINEA_B, municipality_id: '11001' } }),
          params(medicoId)
        )
      )
      check(
        'dirección comercial asigna en cualquier línea, y la misma línea en dos ciudades distintas',
        dosCiudades1.status === 201 && dosCiudades2.status === 201 && tablas.medico_visitantes.length === 3,
        { dosCiudades1, dosCiudades2 }
      )

      const mios = await leer(await listarMedicos(apiRequest('/api/terceros/medicos?visitante=me', { userId: VENTAS_ID })))
      check('visitante=me: la ejecutiva enlazada ve a su médico', mios.status === 200 && mios.body.total === 1 && mios.body.items[0].id === medicoId, mios.body)
      const miosLider = await leer(await listarMedicos(apiRequest('/api/terceros/medicos?visitante=me', { userId: LIDER_ID })))
      check('visitante=me sin ejecutiva enlazada → lista vacía', miosLider.status === 200 && miosLider.body.total === 0, miosLider.body)

      const ajenaTerminar = await leer(
        await terminarVisitante(
          apiRequest(`/api/terceros/medicos/${medicoId}/visitantes/${dosCiudades1.body.id}`, { method: 'PATCH', userId: LIDER_ID, body: { hasta: HOY } }),
          { params: { id: medicoId, visitanteId: dosCiudades1.body.id } }
        )
      )
      check('line_leader NO termina un visitante de una línea ajena → 403', ajenaTerminar.status === 403, ajenaTerminar)
      const futuro = await leer(
        await terminarVisitante(
          apiRequest(`/api/terceros/medicos/${medicoId}/visitantes/${visitanteA}`, { method: 'PATCH', userId: LIDER_ID, body: { hasta: '2999-01-01' } }),
          { params: { id: medicoId, visitanteId: visitanteA } }
        )
      )
      check('terminar con fecha futura → 400', futuro.status === 400, futuro)
      const antes = await leer(
        await terminarVisitante(
          apiRequest(`/api/terceros/medicos/${medicoId}/visitantes/${visitanteA}`, { method: 'PATCH', userId: LIDER_ID, body: { hasta: '2000-01-01' } }),
          { params: { id: medicoId, visitanteId: visitanteA } }
        )
      )
      check('terminar antes del inicio (desde) → 400', antes.status === 400, antes)
      const terminado = await leer(
        await terminarVisitante(
          apiRequest(`/api/terceros/medicos/${medicoId}/visitantes/${visitanteA}`, { method: 'PATCH', userId: LIDER_ID, body: { hasta: HOY } }),
          { params: { id: medicoId, visitanteId: visitanteA } }
        )
      )
      const fila = tablas.medico_visitantes.find(visitante => visitante.id === visitanteA)
      const enDetalle = terminado.body?.medico?.visitantes ?? []
      check(
        'terminar visitante: hasta = hoy y la fila sigue (nunca DELETE)',
        terminado.status === 200 &&
          fila?.hasta === HOY &&
          tablas.medico_visitantes.length === 3 &&
          !fake.requests.some(request => request.table === 'medico_visitantes' && request.method === 'DELETE'),
        { terminado, fila }
      )
      check(
        'el detalle la trae como historia (con hasta), después de las vigentes',
        enDetalle.length === 3 &&
          enDetalle.find((visitante: any) => visitante.id === visitanteA)?.hasta === HOY &&
          enDetalle[enDetalle.length - 1]?.id === visitanteA &&
          enDetalle.slice(0, -1).every((visitante: any) => visitante.hasta === null),
        enDetalle
      )
      const listaTras = await leer(await listarMedicos(apiRequest('/api/terceros/medicos', { userId: VIEWER_ID })))
      const visitantesLista = listaTras.body?.items?.find((item: any) => item.id === medicoId)?.visitantes ?? []
      check(
        'la lista de médicos solo trae los visitantes vigentes (la terminada sale)',
        listaTras.status === 200 &&
          visitantesLista.length === 2 &&
          !visitantesLista.some((visitante: any) => visitante.id === visitanteA) &&
          visitantesLista.every((visitante: any) => visitante.hasta === null),
        visitantesLista
      )
      const miosTras = await leer(await listarMedicos(apiRequest('/api/terceros/medicos?visitante=me', { userId: VENTAS_ID })))
      check('visitante=me: con su única asignación terminada, la ejecutiva ya no ve al médico', miosTras.status === 200 && miosTras.body.total === 0, miosTras.body)
      const otraVez = await leer(
        await terminarVisitante(
          apiRequest(`/api/terceros/medicos/${medicoId}/visitantes/${visitanteA}`, { method: 'PATCH', userId: LIDER_ID, body: { hasta: HOY } }),
          { params: { id: medicoId, visitanteId: visitanteA } }
        )
      )
      check('terminar una asignación ya terminada → 409', otraVez.status === 409, otraVez)
      const deNuevo = await leer(
        await asignarVisitante(
          apiRequest(`/api/terceros/medicos/${medicoId}/visitantes`, { method: 'POST', userId: LIDER_ID, body: { executive_id: EJEC_1, line_id: LINEA_A } }),
          params(medicoId)
        )
      )
      check('tras terminarla, se puede volver a asignar (nueva fila, la vieja queda como historia)', deNuevo.status === 201 && tablas.medico_visitantes.length === 4, deNuevo)

      // La regla "la ejecutiva lleva esa línea" se comprueba al asignar. Desde la 0820 (decisión del dueño del
      // 2026-10-12, docs/decisiones/2026-10-12-traspaso-de-ejecutivas.md) los disparadores de la base terminan las
      // asignaciones al quitar la línea o dar de baja; este Supabase falso no tiene disparadores, así que aquí se
      // prueba la red de seguridad: si una asignación vigente quedara así, sale con aviso en listas y detalle, y las
      // rutas de lectura no cierran nada por su cuenta.
      const sinAvisos = await leer(await verMedico(apiRequest(`/api/terceros/medicos/${medicoId}`), params(medicoId)))
      check(
        'con todo en regla, ningún visitante trae aviso',
        sinAvisos.status === 200 && (sinAvisos.body.medico.visitantes as any[]).every(visitante => !visitante.aviso),
        sinAvisos.body.medico.visitantes
      )
      const escriturasAntes = fake.writes().length
      const lineasAntes = tablas.executive_lines.map(fila => ({ ...fila }))
      tablas.executive_lines = tablas.executive_lines.filter(fila => !(fila.executive_id === EJEC_2 && fila.line_id === LINEA_B))
      const sinLineaDetalle = await leer(await verMedico(apiRequest(`/api/terceros/medicos/${medicoId}`), params(medicoId)))
      const visitantesSinLinea = (sinLineaDetalle.body?.medico?.visitantes ?? []) as any[]
      check(
        'Berta deja de llevar la Línea B: sus dos asignaciones vigentes salen con aviso "ya no lleva esta línea"',
        visitantesSinLinea.filter(visitante => visitante.executive_id === EJEC_2 && !visitante.hasta).length === 2 &&
          visitantesSinLinea
            .filter(visitante => visitante.executive_id === EJEC_2)
            .every(visitante => visitante.aviso === 'El Ejecutivo Comercial ya no lleva esta línea'),
        visitantesSinLinea
      )
      check(
        'la de Ana (sigue con su línea) no trae aviso, ni la terminada (historia)',
        visitantesSinLinea.filter(visitante => visitante.executive_id === EJEC_1).every(visitante => !visitante.aviso),
        visitantesSinLinea
      )
      const sinLineaLista = await leer(await listarMedicos(apiRequest('/api/terceros/medicos', { userId: VIEWER_ID })))
      const enLista = (sinLineaLista.body?.items?.find((item: any) => item.id === medicoId)?.visitantes ?? []) as any[]
      check(
        'la lista también trae el aviso (y la asignación sigue vigente: no se cerró)',
        enLista.filter(visitante => visitante.aviso === 'El Ejecutivo Comercial ya no lleva esta línea').length === 2 &&
          tablas.medico_visitantes.filter(visitante => visitante.executive_id === EJEC_2 && visitante.hasta === null).length === 2,
        enLista
      )
      const ana = tablas.executives.find(ejecutivo => ejecutivo.id === EJEC_1) as Fila
      ana.status = 'inactive'
      const inactivaDetalle = await leer(await verMedico(apiRequest(`/api/terceros/medicos/${medicoId}`), params(medicoId)))
      const deAna = ((inactivaDetalle.body?.medico?.visitantes ?? []) as any[]).filter(visitante => visitante.executive_id === EJEC_1)
      check(
        'Ana dada de baja: su asignación vigente sale con aviso "inactivo"; la terminada no',
        deAna.find(visitante => !visitante.hasta)?.aviso === 'El Ejecutivo Comercial está inactivo' &&
          deAna.filter(visitante => visitante.hasta).every(visitante => !visitante.aviso),
        deAna
      )
      const miosInactiva = await leer(
        await buscarMedicos(apiRequest('/api/terceros/medicos/buscar', { method: 'POST', userId: VENTAS_ID, body: { visitante: 'me' } }))
      )
      // "Ya no está" (decisión del dueño 2026-10-12): un Ejecutivo Comercial inactivo deja de ser "mi ejecutiva"
      // para su usuario, así que visitante=me no devuelve nada aunque quedara una asignación vigente.
      check(
        'visitante=me (por POST /medicos/buscar) con su Ejecutivo Comercial inactivo → lista vacía (ya no está)',
        miosInactiva.status === 200 &&
          miosInactiva.body.total === 0 &&
          Array.isArray(miosInactiva.body.items) &&
          miosInactiva.body.items.length === 0,
        miosInactiva.body
      )
      ana.status = 'active'
      const miosReactivada = await leer(
        await buscarMedicos(apiRequest('/api/terceros/medicos/buscar', { method: 'POST', userId: VENTAS_ID, body: { visitante: 'me' } }))
      )
      check(
        'visitante=me (por POST /medicos/buscar) con Ana activa de nuevo → vuelve a ver a su médico (el filtro es por estado, no por la fila)',
        miosReactivada.status === 200 && miosReactivada.body.total === 1 && miosReactivada.body.items[0].id === medicoId,
        miosReactivada.body
      )
      const lineaA = tablas.business_lines.find(linea => linea.id === LINEA_A) as Fila
      lineaA.active = false
      const lineaInactiva = await leer(await verMedico(apiRequest(`/api/terceros/medicos/${medicoId}`), params(medicoId)))
      check(
        'línea desactivada: la asignación vigente de esa línea sale con aviso',
        ((lineaInactiva.body?.medico?.visitantes ?? []) as any[]).some(
          visitante => visitante.line_id === LINEA_A && !visitante.hasta && visitante.aviso === 'La línea está inactiva'
        ),
        lineaInactiva.body?.medico?.visitantes
      )
      lineaA.active = true
      tablas.executive_lines = lineasAntes
      check('avisar no escribe nada en la base (ninguna asignación se terminó sola)', fake.writes().length === escriturasAntes, fake.writes().slice(escriturasAntes))
    }

    print('\n7. Contactos y subtipos')
    {
      const contacto = await leer(
        await crearContacto(
          apiRequest('/api/terceros/contactos', { method: 'POST', userId: VENTAS_ID, body: { cuenta_id: CLINICA, sede_id: SEDE_CLINICA_1, nombre: 'Luz Mora', cargo_texto: 'Jefe de Compras' } })
        )
      )
      check('contacto sin rol: el cargo "Jefe de Compras" lo deja en compras', contacto.status === 201 && contacto.body.contacto.rol === 'compras', contacto)
      const sedeAjena = await leer(
        await crearContacto(
          apiRequest('/api/terceros/contactos', { method: 'POST', userId: VENTAS_ID, body: { cuenta_id: CLINICA, sede_id: SEDE_OTRA, nombre: 'Pedro Paz', cargo_texto: 'Químico farmacéutico' } })
        )
      )
      check('contacto con sede de otra cuenta → 400', sedeAjena.status === 400 && tablas.contactos.length === 1, sedeAjena)
      const editarVentas = await leer(
        await editarContacto(apiRequest(`/api/terceros/contactos/${contacto.body.id}`, { method: 'PATCH', userId: VENTAS_ID, body: { rol: 'gerencia' } }), params(contacto.body.id))
      )
      check('sales_manager no edita contactos (403)', editarVentas.status === 403, editarVentas)
      const editarAdmin = await leer(
        await editarContacto(apiRequest(`/api/terceros/contactos/${contacto.body.id}`, { method: 'PATCH', body: { cargo_texto: 'Gerente', telefono: '6076543210' } }), params(contacto.body.id))
      )
      check('cambiar el cargo no cambia el rol guardado', editarAdmin.status === 200 && editarAdmin.body.contacto.rol === 'compras' && editarAdmin.body.contacto.cargo_texto === 'Gerente', editarAdmin)
      const detalle = await leer(await verCuenta(apiRequest(`/api/terceros/cuentas/${CLINICA}`, { userId: VIEWER_ID }), params(CLINICA)))
      check(
        'el detalle de la cuenta trae su contacto y la sede principal primero',
        detalle.body.contactos.length === 1 && detalle.body.sedes[0].id === SEDE_CLINICA_2 && detalle.body.sedes[0].es_principal === true,
        detalle.body
      )

      const subtipos = await leer(await listarSubtipos(apiRequest('/api/terceros/subtipos', { userId: VIEWER_ID })))
      check(
        'subtipos vigentes: los 5 de la semilla, en orden, sin el apagado',
        subtipos.status === 200 && subtipos.body.items.map((item: any) => item.codigo).join(',') === 'compras,quimico_farmaceutico,autorizaciones,programacion,otro',
        subtipos.body
      )
    }

    print('\n8. Sin red')
    check('ninguna petición salió del Supabase falso', fake.external.length === 0, fake.external)
  } finally {
    fetchHandler = null
  }

  print('')
  print(`Mensajes de las rutas recogidos: ${moduleLogs.length}`)
  print(`Resultado: ${passed} OK, ${failed} con fallo`)
  if (failed > 0) process.exit(1)
}

main().catch(error => {
  process.stderr.write(`terceros-api-check: error inesperado: ${error instanceof Error ? error.stack : String(error)}\n`)
  process.exit(1)
})
