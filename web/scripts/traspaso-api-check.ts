/**
 * Traspaso de un Ejecutivo Comercial · pruebas de las rutas (SIN RED, sin Supabase real, sin Google):
 * POST /api/executives/[id]/traspaso/vista-previa, POST /api/executives/[id]/traspaso,
 * POST /api/executives/[id]/contratar, GET /api/executives/traspasos, PATCH y DELETE /api/executives/[id] (recalculan
 * la cobertura) y los lectores de "mi Ejecutivo Comercial" (ejecutivosDelUsuario y personaDelUsuario ignoran a los
 * inactivos). Spec: docs/specs/2026-10-12-traspaso-ejecutivo-comercial.md (criterios de aceptación).
 *
 * Llama a los handlers reales contra un Supabase FALSO en memoria: un PostgREST mínimo (filtros eq/neq/in/is/ilike/
 * gte/lte/gt/lt/not, orden, rango, proyección, insert/upsert/update/delete) con los índices únicos que tocan estas
 * rutas, y la función ejecutivas_traspasar (espejo mínimo y verosímil de los pasos de la migración 0820: valida,
 * crea la persona nueva o la vacante (con el color de quien entrega si hay baja), suma líneas, pasa ajustes, nombre
 * del territorio y visitantes (desde max(fecha, desde)), copia excepciones, quita las líneas, da de baja, desactiva el
 * usuario solo si es de Ejecutivo Comercial, está activo y no es el de quien lo hace, guarda el historial y devuelve
 * el resumen; todo o nada). La cobertura se recalcula de verdad (lib/coverage.ts) con las filas del falso y la versión final del anexo
 * se guarda de verdad (createSnapshot de lib/territory.ts). El reloj es FALSO (fijarAhora).
 *
 * Cubre: data_manager, line_leader y viewer → 403 en traspaso y vista previa (admin y commercial_director sí); vista
 * previa sin escrituras y con el mismo conteo que el traspaso; baja a una persona nueva (criterio 1, con la versión
 * final del anexo ANTES de la función y la cobertura recalculada DESPUÉS); quitar una línea a quien se queda hacia una
 * persona de otra ciudad (criterio 2) con un médico que ya visitaba (criterio 3, omitido) y un médico inactivo;
 * "nadie" (criterio 4) y baja con "nadie" → 400; lo que la vista previa rechaza no escribe nada (email repetido → 409,
 * criterio 8); errores de la función traducidos (22023/23514 → 400, P0002 → 404, 23505 → 409, sin la función → 503)
 * y avisando si ya se guardó la versión final del anexo; contratar solo en una vacante (criterio 5) y enlazar el
 * usuario por email; historial con nombres y del más reciente al más antiguo (criterio 7); PATCH y DELETE de
 * executives recalculan la cobertura cuando cambian estado o líneas (criterio 6, parte de la ruta); nada sale a la red.
 *
 * El patrón del Supabase falso viene de scripts/visits-api-check.ts (copiado, no importado).
 * Uso (desde web/): npx tsx scripts/traspaso-api-check.ts      Código de salida 1 si alguna prueba falla.
 */
import { randomUUID } from 'node:crypto'
import { NextRequest } from 'next/server'
import { passwordVersion, SESSION_COOKIE_NAME, signSession } from '../lib/session'
import { MENSAJE_BAJA_SIN_DESTINO, MENSAJE_USUARIO_SIN_BAJA, etiquetaAnexoFinal } from '../lib/traspaso'
import { hoyBogota, sumarDias } from '../lib/visits-rules'
import { MENSAJE_FALTA_MIGRACION_TRASPASO, MENSAJE_RESULTADO_INCIERTO } from '../app/api/executives/_lib/traspaso-server'
import { AVISO_COBERTURA_SIN_RECALCULAR } from '../app/api/executives/_lib/executive-shared'
import { ejecutivosDelUsuario } from '../app/api/terceros/_lib/terceros-server'
import { personaDelUsuario } from '../app/api/config-visitas/_lib/visitas-server'
import { POST as vistaPrevia } from '../app/api/executives/[id]/traspaso/vista-previa/route'
import { POST as traspasar } from '../app/api/executives/[id]/traspaso/route'
import { POST as contratar } from '../app/api/executives/[id]/contratar/route'
import { GET as historial } from '../app/api/executives/traspasos/route'
import { DELETE as darDeBajaVieja, PATCH as editarEjecutiva } from '../app/api/executives/[id]/route'

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
process.env.SESSION_SECRET = 'secreto-de-prueba-traspaso-api-check-0123456789abcdefghijklmnopqrstuvwxyz'

// ---------------------------------------------------------------------------
// Reloj falso: new Date() y Date.now() devuelven el instante fijado (las rutas, la sesión y el Supabase falso)
// ---------------------------------------------------------------------------

const RealDate = Date
let ahoraMs = RealDate.parse('2026-10-20T15:00:00.000Z')
class RelojDate extends RealDate {
  constructor(...args: unknown[]) {
    if (args.length === 0) super(ahoraMs)
    else super(...(args as [number, number, number, number, number, number, number]))
  }
  static now(): number {
    return ahoraMs
  }
}
globalThis.Date = RelojDate as unknown as DateConstructor
/** Mueve el reloj a ese instante UTC (Bogotá = UTC−5). */
function fijarAhora(isoUtc: string) {
  ahoraMs = RealDate.parse(isoUtc)
}
const hoyFalso = () => hoyBogota(new Date())

// Despachador único: sin manejador cualquier fetch falla; con él, solo responde el Supabase falso.
type FetchHandler = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
let fetchHandler: FetchHandler | null = null
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  if (!fetchHandler) throw new Error('traspaso-api-check: la red está prohibida en estas pruebas')
  return fetchHandler(input, init)
}) as typeof fetch

// Los console.error de las rutas (errores simulados) se recogen aquí para no ensuciar la salida.
const moduleLogs: string[] = []
console.error = (...args: unknown[]) => {
  moduleLogs.push(
    args.map(arg => (arg instanceof Error ? `${arg.name}: ${arg.message}` : typeof arg === 'object' ? JSON.stringify(arg) : String(arg))).join(' ')
  )
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
    print(`  FALLA ${name}${texto ? ` -> ${texto.slice(0, 900)}` : ''}`)
    if (moduleLogs.length > 0) print(`        últimos mensajes: ${moduleLogs.slice(-3).join(' | ').slice(0, 600)}`)
  }
}

// ---------------------------------------------------------------------------
// Supabase FALSO (PostgREST mínimo en memoria + ejecutivas_traspasar de la 0820)
// ---------------------------------------------------------------------------

type Fila = Record<string, any>
type Tablas = Record<string, Fila[]>

interface FakeRequest {
  method: string
  table: string
  params: URLSearchParams
  body: unknown
}

const POSTGREST_CONTROL_PARAMS = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'])
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Índices únicos (0100, 0500, 0800) que tocan estas rutas. nulosIguales: el de visitantes usa coalesce. */
interface Unica {
  nombre: string
  columnas: string[]
  donde?: (fila: Fila) => boolean
  nulosIguales?: boolean
}
const UNICAS: Record<string, Unica[]> = {
  executives: [
    { nombre: 'executives_email_key', columnas: ['email'] },
    { nombre: 'executives_user_id_key', columnas: ['user_id'] },
  ],
  executive_lines: [{ nombre: 'executive_lines_pkey', columnas: ['executive_id', 'line_id'] }],
  coverage: [{ nombre: 'coverage_line_id_kam_id_key', columnas: ['line_id', 'kam_id'] }],
  coverage_overrides: [{ nombre: 'coverage_overrides_active_uidx', columnas: ['line_id', 'kam_id'], donde: fila => fila.active === true }],
  territory_snapshots: [
    { nombre: 'territory_snapshots_line_executive_version_key', columnas: ['line_id', 'executive_id', 'version_label'] },
  ],
  line_territory_names: [{ nombre: 'line_territory_names_pkey', columnas: ['line_id', 'executive_id'] }],
  medico_visitantes: [
    {
      nombre: 'medico_visitantes_vigente_uidx',
      columnas: ['medico_id', 'executive_id', 'line_id', 'municipality_id'],
      donde: fila => fila.hasta === null || fila.hasta === undefined,
      nulosIguales: true,
    },
  ],
}

const ahoraIso = () => new Date().toISOString()
const DEFECTOS: Record<string, () => Fila> = {
  executives: () => ({
    user_id: null,
    email: null,
    company: 'VG Medical',
    base_kam_id: null,
    odoo_employee_id: null,
    status: 'active',
    started_at: null,
    left_at: null,
    notes: null,
    color: null,
    updated_at: ahoraIso(),
  }),
  coverage_overrides: () => ({ active: true, created_by: null }),
  medico_visitantes: () => ({ municipality_id: null, hasta: null, fin_motivo: null, traspaso_id: null, created_by: null, updated_at: ahoraIso() }),
  territory_snapshots: () => ({ note: null, created_by: null }),
}

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

function matchesFilter(row: Fila, key: string, raw: string): boolean {
  const value = row[key] === null || row[key] === undefined ? 'null' : String(row[key])
  if (raw.startsWith('not.')) return !matchesFilter(row, key, raw.slice(4))
  if (raw.startsWith('eq.')) return value === raw.slice(3)
  if (raw.startsWith('neq.')) return value !== raw.slice(4)
  if (raw.startsWith('in.(') && raw.endsWith(')')) {
    const options = raw.slice(4, -1).split(',').map(option => option.replace(/^"|"$/g, ''))
    return options.includes(value)
  }
  if (raw === 'is.null') return value === 'null'
  if (raw.startsWith('ilike.')) return value !== 'null' && likeRegex(raw.slice(6), 'i').test(value)
  if (/^(gte|lte|gt|lt)\./.test(raw)) {
    const [op, ...rest] = raw.split('.')
    const target = rest.join('.')
    if (value === 'null') return false
    if (op === 'gte') return value >= target
    if (op === 'lte') return value <= target
    if (op === 'gt') return value > target
    return value < target
  }
  throw new Error(`Supabase falso: filtro no soportado ${key}=${raw}`)
}

function matchesFilters(row: Fila, params: URLSearchParams): boolean {
  for (const [key, raw] of Array.from(params.entries())) {
    if (POSTGREST_CONTROL_PARAMS.has(key)) continue
    if (!matchesFilter(row, key, raw)) return false
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
  /** Tablas o funciones ("rpc/…") que "no existen" (para probar el 503 por migración sin aplicar). */
  const faltan = new Set<string>()
  /** Tablas cuyas escrituras fallan con un error interno (para probar el aviso de cobertura sin recalcular). */
  const fallan = new Set<string>()
  /** Error que devuelve ejecutivas_traspasar sin hacer nada (para probar la traducción de la ruta). */
  const control: { errorRpc: { code: string; message: string; details?: string | null } | null } = { errorRpc: null }
  const rpcs: { nombre: string; args: Fila }[] = []
  const json = (payload: unknown, status = 200) =>
    new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json' } })
  const pgError = (code: string, message: string, status: number, details: string | null = null) =>
    json({ code, message, details, hint: null }, status)
  const store = (table: string) => (tablas[table] = tablas[table] ?? [])

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

  // --- ejecutivas_traspasar (espejo mínimo de los pasos a–l de la 0820) ---

  function ejecutivasTraspasar(args: Fila): Response {
    if (control.errorRpc) return pgError(control.errorRpc.code, control.errorRpc.message, 400, control.errorRpc.details ?? null)
    const p = args.p as Fila | null
    const pUser = (args.p_user as string | null) ?? null
    const e22 = (mensaje: string) => pgError('22023', mensaje, 400)
    const e23 = (mensaje: string) => pgError('23514', mensaje, 400)

    // a. Parámetros
    if (!p || typeof p !== 'object' || Array.isArray(p)) return e22('Faltan los datos del traspaso')
    if (typeof p.origen_id !== 'string' || !UUID.test(p.origen_id)) {
      return e22('Falta el Ejecutivo Comercial que entrega (origen_id no válido)')
    }
    const origenId = p.origen_id.toLowerCase()
    const destino = p.destino as Fila | null
    if (!destino || typeof destino !== 'object') return e22('Falta quién recibe (destino)')
    const tipo = destino.tipo as string
    if (!['existente', 'nueva', 'vacante', 'nadie'].includes(tipo)) return e22(`Quién recibe no es válido: ${tipo ?? '(vacío)'}`)
    let destinoId: string | null = null
    let nombre = ''
    let email: string | null = null
    if (tipo === 'existente') {
      if (typeof destino.id !== 'string' || !UUID.test(destino.id)) return e22('Falta el Ejecutivo Comercial que recibe (destino.id no válido)')
      destinoId = destino.id.toLowerCase()
    } else if (tipo === 'nueva') {
      nombre = String(destino.full_name ?? '').trim()
      if (nombre.length < 2 || nombre.length > 120) return e22('El nombre de la persona nueva debe tener entre 2 y 120 caracteres')
      email = String(destino.email ?? '').trim().toLowerCase() || null
      if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return e22(`El email de la persona nueva no es válido: ${email}`)
    }
    let lineasPedidas: string[] | null = null
    if (p.lineas !== null && p.lineas !== undefined) {
      if (!Array.isArray(p.lineas) || p.lineas.length === 0) {
        return e22('Las líneas deben ser una lista con al menos una línea (o null para todas)')
      }
      if (p.lineas.some((linea: unknown) => typeof linea !== 'string' || !UUID.test(linea))) {
        return e22('Alguna línea no es un identificador válido')
      }
      lineasPedidas = Array.from(new Set((p.lineas as string[]).map(linea => linea.toLowerCase()))).sort()
    }
    const hoy = hoyFalso()
    let fecha = hoy
    if (typeof p.fecha === 'string' && p.fecha.trim()) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(p.fecha)) return e22(`La fecha del traspaso no es válida: ${p.fecha} (AAAA-MM-DD)`)
      fecha = p.fecha
    }
    for (const clave of ['dar_de_baja', 'desactivar_usuario', 'copiar_excepciones']) {
      if (p[clave] !== undefined && p[clave] !== null && typeof p[clave] !== 'boolean') return e22(`${clave} debe ser verdadero o falso`)
    }
    const baja = p.dar_de_baja === true
    const pedidoDesactivar = baja && p.desactivar_usuario === true
    const copiar = p.copiar_excepciones === true && tipo !== 'nadie'
    const motivo = typeof p.motivo === 'string' && p.motivo.trim() ? p.motivo.trim() : null
    if (baja && tipo === 'nadie') {
      return e23('Al dar de baja hay que elegir quién recibe: otra persona, una persona nueva o una vacante')
    }
    if (fecha > hoy || fecha < sumarDias(hoy, -90)) {
      return e23(`La fecha del traspaso (${fecha}) debe estar entre ${sumarDias(hoy, -90)} y hoy (${hoy}): no se programan traspasos futuros`)
    }

    // b. Reglas contra la base
    const origen = store('executives').find(fila => fila.id === origenId)
    if (!origen) return pgError('P0002', `No existe el Ejecutivo Comercial que entrega (${origenId})`, 400)
    if (origen.status === 'inactive') return e23(`${origen.full_name} ya está inactivo: no tiene nada que traspasar`)
    // Paso k (decidido al leer origen): solo el usuario de un Ejecutivo Comercial, activo y que no sea quien lo hace
    let desactivar = false
    if (pedidoDesactivar && origen.user_id && origen.user_id !== pUser) {
      const usuario = store('users').find(fila => fila.id === origen.user_id)
      desactivar = Boolean(usuario && usuario.active === true && ['sales_manager', 'user'].includes(usuario.role))
    }
    if (tipo === 'existente') {
      if (destinoId === origenId) return e23('Quien recibe debe ser otra persona')
      const dest = store('executives').find(fila => fila.id === destinoId)
      if (!dest) return pgError('P0002', `No existe el Ejecutivo Comercial que recibe (${destinoId})`, 400)
      if (dest.status === 'inactive') return e23(`${dest.full_name} está inactivo: no puede recibir un traspaso`)
    }
    const lineasA = store('executive_lines')
      .filter(vinculo => vinculo.executive_id === origenId)
      .map(vinculo => String(vinculo.line_id))
      .sort()
    if (lineasA.length === 0) return e23(`${origen.full_name} no lleva ninguna línea: no hay nada que traspasar`)
    let lineas: string[]
    if (lineasPedidas === null) {
      lineas = lineasA
    } else {
      const fuera = lineasPedidas.filter(linea => !lineasA.includes(linea))
      if (fuera.length > 0) return e23(`${origen.full_name} no lleva estas líneas: ${fuera.join(', ')}`)
      lineas = lineasPedidas
    }
    if (baja && !lineasA.every(linea => lineas.includes(linea))) return e23('Al dar de baja se traspasan todas sus líneas')

    const traspasoId = randomUUID()

    // c. Destino nuevo
    if (tipo === 'nueva') {
      if (email && store('executives').some(fila => String(fila.email ?? '').trim().toLowerCase() === email)) {
        return pgError('23505', `Ya hay un Ejecutivo Comercial con el email ${email}`, 409)
      }
      destinoId = randomUUID()
      store('executives').push({
        ...DEFECTOS.executives(),
        id: destinoId,
        full_name: nombre,
        email,
        company: origen.company ?? 'VG Medical',
        base_kam_id: origen.base_kam_id,
        status: 'active',
        started_at: fecha,
        color: baja ? origen.color ?? null : null,
        created_at: ahoraIso(),
      })
    } else if (tipo === 'vacante') {
      const zona = store('kams').find(fila => fila.id === origen.base_kam_id)
      const nombreZona = String(zona?.name ?? '').replace(/^\s*KAM\s+/i, '').trim()
      destinoId = randomUUID()
      store('executives').push({
        ...DEFECTOS.executives(),
        id: destinoId,
        full_name: nombreZona ? `Vacante · ${nombreZona}` : 'Vacante',
        company: origen.company ?? 'VG Medical',
        base_kam_id: origen.base_kam_id,
        status: 'placeholder',
        color: baja ? origen.color ?? null : null,
        created_at: ahoraIso(),
      })
    }

    // d. Líneas al destino
    if (destinoId) {
      for (const linea of lineas) {
        if (!store('executive_lines').some(vinculo => vinculo.executive_id === destinoId && vinculo.line_id === linea)) {
          store('executive_lines').push({ executive_id: destinoId, line_id: linea })
        }
      }
    }

    // e. Ajustes manuales
    let ajustesMovidos = 0
    let ajustesDesactivados = 0
    const ajustes = store('coverage_overrides')
      .filter(ajuste => ajuste.executive_id === origenId && ajuste.active === true && lineas.includes(ajuste.line_id))
      .sort((a, b) => compareValues(a.line_id, b.line_id) || compareValues(a.kam_id, b.kam_id))
    for (const ajuste of ajustes) {
      ajuste.active = false
      if (destinoId) {
        store('coverage_overrides').push({
          id: randomUUID(),
          line_id: ajuste.line_id,
          kam_id: ajuste.kam_id,
          executive_id: destinoId,
          reason: ajuste.reason,
          created_by: pUser,
          active: true,
          created_at: ahoraIso(),
        })
        ajustesMovidos++
      } else {
        ajustesDesactivados++
      }
    }

    // f. Nombre del territorio
    let nombresCopiados = 0
    if (destinoId) {
      for (const fila of store('line_territory_names').filter(n => n.executive_id === origenId && lineas.includes(n.line_id))) {
        if (store('line_territory_names').some(n => n.executive_id === destinoId && n.line_id === fila.line_id)) continue
        store('line_territory_names').push({ line_id: fila.line_id, executive_id: destinoId, name: fila.name, updated_by: pUser, updated_at: ahoraIso() })
        nombresCopiados++
      }
    }

    // g. Visitantes
    let visitantesMovidos = 0
    let visitantesTerminados = 0
    const omitidos: Fila[] = []
    const abiertas = store('medico_visitantes')
      .filter(v => v.executive_id === origenId && v.hasta === null && lineas.includes(v.line_id))
      // ORDER BY mv.line_id, mv.medico_id, mv.municipality_id NULLS FIRST, mv.id (como la 0820)
      .sort(
        (a, b) =>
          compareValues(a.line_id, b.line_id) ||
          compareValues(a.medico_id, b.medico_id) ||
          (a.municipality_id === b.municipality_id
            ? 0
            : a.municipality_id === null
              ? -1
              : b.municipality_id === null
                ? 1
                : compareValues(a.municipality_id, b.municipality_id)) ||
          compareValues(a.id, b.id)
      )
    for (const visitante of abiertas) {
      const medico = store('medicos').find(fila => fila.id === visitante.medico_id)
      const fin = sumarDias(fecha, -1)
      visitante.hasta = visitante.desde > fin ? visitante.desde : fin
      visitante.fin_motivo = 'traspaso'
      visitante.traspaso_id = traspasoId
      if (!destinoId) {
        visitantesTerminados++
      } else if (!medico?.activo) {
        visitantesTerminados++
        omitidos.push({ medico_id: visitante.medico_id, razon: 'medico_inactivo' })
      } else if (
        store('medico_visitantes').some(
          d =>
            d.medico_id === visitante.medico_id &&
            d.executive_id === destinoId &&
            d.line_id === visitante.line_id &&
            (d.municipality_id ?? '') === (visitante.municipality_id ?? '') &&
            d.hasta === null
        )
      ) {
        omitidos.push({ medico_id: visitante.medico_id, razon: 'ya_lo_visita' })
      } else {
        store('medico_visitantes').push({
          ...DEFECTOS.medico_visitantes(),
          id: randomUUID(),
          medico_id: visitante.medico_id,
          executive_id: destinoId,
          line_id: visitante.line_id,
          municipality_id: visitante.municipality_id,
          desde: visitante.desde > fecha ? visitante.desde : fecha,
          created_by: pUser,
          traspaso_id: traspasoId,
          created_at: ahoraIso(),
        })
        visitantesMovidos++
      }
    }

    // h. Excepciones personales (solo si se pide)
    let excepcionesCopiadas = 0
    if (copiar && destinoId) {
      const vigente = (fila: Fila) =>
        !fila.anulado_at && fila.vigente_desde <= fecha && (fila.vigente_hasta === null || fila.vigente_hasta >= fecha)
      for (const tabla of ['config_personas', 'config_metas']) {
        const filas = store(tabla).filter(
          fila => fila.executive_id === origenId && vigente(fila) && (tabla === 'config_personas' || fila.scope === 'ejecutiva')
        )
        for (const fila of filas) {
          store(tabla).push({
            ...fila,
            id: randomUUID(),
            executive_id: destinoId,
            vigente_desde: fecha,
            motivo: `Copiado por traspaso de ${origen.full_name}`,
            set_by: pUser,
            created_at: ahoraIso(),
          })
          excepcionesCopiadas++
        }
      }
    }

    // i. Quitar las líneas a quien entrega
    tablas.executive_lines = store('executive_lines').filter(v => !(v.executive_id === origenId && lineas.includes(v.line_id)))

    // j. Baja (el disparador termina con 'baja' los visitantes abiertos que le queden)
    if (baja) {
      const restantes = store('medico_visitantes').filter(v => v.executive_id === origenId && v.hasta === null)
      visitantesTerminados += restantes.length
      for (const visitante of restantes) {
        const fin = sumarDias(fecha, -1)
        visitante.hasta = visitante.desde > fin ? visitante.desde : fin
        visitante.fin_motivo = 'baja'
      }
      origen.status = 'inactive'
      origen.left_at = sumarDias(fecha, -1)
    }

    // k. Usuario de quien se va (desactivar ya es el efectivo)
    if (desactivar) {
      const usuario = store('users').find(fila => fila.id === origen.user_id)
      if (usuario) usuario.active = false
    }

    // l. Historial y resumen
    const resumen = {
      traspaso_id: traspasoId,
      destino_id: destinoId,
      lineas,
      ajustes_movidos: ajustesMovidos,
      ajustes_desactivados: ajustesDesactivados,
      nombres_copiados: nombresCopiados,
      visitantes_movidos: visitantesMovidos,
      visitantes_terminados: visitantesTerminados,
      omitidos,
      excepciones_copiadas: excepcionesCopiadas,
    }
    store('ejecutivas_traspasos').push({
      id: traspasoId,
      origen_id: origenId,
      destino_id: destinoId,
      destino_tipo: tipo,
      lineas,
      fecha,
      dar_de_baja: baja,
      desactivar_usuario: desactivar,
      copiar_excepciones: copiar,
      motivo,
      resumen,
      created_by: pUser,
      created_at: ahoraIso(),
    })
    return json(resumen)
  }

  const handler: FetchHandler = async (input, init) => {
    const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const url = new URL(href)
    if (url.origin !== FAKE_SUPABASE_URL) {
      external.push(url.origin)
      throw new Error(`traspaso-api-check: intento de red a ${url.origin}`)
    }
    const method = (init?.method || 'GET').toUpperCase()
    const table = url.pathname.replace('/rest/v1/', '')
    const body = init?.body ? JSON.parse(String(init.body)) : undefined
    requests.push({ method, table, params: url.searchParams, body })
    const headers = new Headers(init?.headers)
    const wantsObject = (headers.get('accept') || '').includes('vnd.pgrst.object')
    const prefer = headers.get('prefer') || ''
    const select = url.searchParams.get('select')

    if (faltan.has(table)) {
      return table.startsWith('rpc/')
        ? pgError('PGRST202', `Could not find the function public.${table.slice(4)} in the schema cache`, 404)
        : pgError('PGRST205', `Could not find the table 'public.${table}' in the schema cache`, 404)
    }
    if (method !== 'GET' && fallan.has(table)) {
      return pgError('XX000', `traspaso-api-check: escritura a ${table} falla a propósito`, 500)
    }

    // Transacción del falso: si algo falla, se deshace todo lo de la petición.
    const backup = JSON.parse(JSON.stringify(tablas)) as Tablas
    const rollback = () => {
      for (const key of Object.keys(tablas)) delete tablas[key]
      Object.assign(tablas, backup)
    }

    if (table.startsWith('rpc/')) {
      const nombre = table.slice(4)
      const args = (body ?? {}) as Fila
      rpcs.push({ nombre, args })
      if (nombre !== 'ejecutivas_traspasar') throw new Error(`Supabase falso: función no soportada ${nombre}`)
      const respuesta = ejecutivasTraspasar(args)
      if (!respuesta.ok) rollback()
      return respuesta
    }

    let rows: Fila[]
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
      const offset = Number(url.searchParams.get('offset') ?? 0)
      const limit = url.searchParams.get('limit')
      rows = rows.slice(offset, limit === null ? undefined : offset + Number(limit))
    } else if (method === 'POST') {
      const onConflict = url.searchParams.get('on_conflict')
      const conflicto = onConflict ? onConflict.split(',').map(columna => columna.trim()) : null
      const ignorar = prefer.includes('ignore-duplicates')
      rows = []
      for (const row of (Array.isArray(body) ? body : [body]) as Fila[]) {
        if (conflicto) {
          const existente = store(table).find(fila => conflicto.every(columna => (fila[columna] ?? null) === (row[columna] ?? null)))
          if (existente) {
            if (!ignorar) Object.assign(existente, row)
            rows.push(existente)
            continue
          }
        }
        const nueva: Fila = { id: randomUUID(), ...(DEFECTOS[table]?.() ?? {}), created_at: ahoraIso(), ...row }
        const unica = uniqueViolation(table, nueva, new Set())
        if (unica) {
          rollback()
          return duplicate(unica)
        }
        store(table).push(nueva)
        rows.push(nueva)
      }
    } else if (method === 'PATCH') {
      rows = store(table).filter(row => matchesFilters(row, url.searchParams))
      for (const row of rows) {
        const despues = { ...row, ...(body as Fila) }
        const unica = uniqueViolation(table, despues, new Set([row]))
        if (unica) {
          rollback()
          return duplicate(unica)
        }
        Object.assign(row, despues)
      }
    } else if (method === 'DELETE') {
      rows = store(table).filter(row => matchesFilters(row, url.searchParams))
      tablas[table] = store(table).filter(row => !rows.includes(row))
    } else {
      throw new Error(`Supabase falso: método no soportado ${method}`)
    }

    const payload = rows.map(row => project(row, select))
    if (wantsObject) {
      if (payload.length !== 1) {
        return json({ code: 'PGRST116', details: `The result contains ${payload.length} rows`, hint: null, message: 'JSON object requested, multiple (or no) rows returned' }, 406)
      }
      return json(payload[0], method === 'POST' ? 201 : 200)
    }
    return json(payload, method === 'POST' ? 201 : 200)
  }

  const writes = () => requests.filter(request => request.method !== 'GET')
  return { handler, requests, external, writes, faltan, fallan, control, rpcs }
}

// ---------------------------------------------------------------------------
// Datos de prueba
// ---------------------------------------------------------------------------

const ADMIN_ID = '11111111-1111-4111-8111-111111111111'
const DIRECTORA_ID = '22222222-2222-4222-8222-222222222222' // commercial_director
const DATOS_ID = '33333333-3333-4333-8333-333333333333' // data_manager
const LIDER_ID = '44444444-4444-4444-8444-444444444444' // line_leader
const VIEWER_ID = '55555555-5555-4555-8555-555555555555'
const ANA_USER = '66666666-6666-4666-8666-666666666666' // sales_manager enlazada con Ana
const DORA_USER = '77777777-7777-4777-8777-777777777777' // sales_manager enlazada con Dora (inactiva)
const PAULA_USER = '88888888-8888-4888-8888-888888888888' // sales_manager sin Ejecutivo Comercial (se contrata)

const LINEA_A = 'aaaaaaaa-0000-4000-8000-000000000001' // Columna
const LINEA_B = 'aaaaaaaa-0000-4000-8000-000000000002' // Reemplazo articular
const KAM_BGA = 'bbbbbbbb-0000-4000-8000-000000000001' // Bucaramanga 68001
const KAM_CUC = 'bbbbbbbb-0000-4000-8000-000000000002' // Cúcuta 54001
const KAM_BAQ = 'bbbbbbbb-0000-4000-8000-000000000003' // Barranquilla 08001
const KAM_MED = 'bbbbbbbb-0000-4000-8000-000000000004' // Medellín 05001
const ANA = 'eeeeeeee-0000-4000-8000-000000000001' // Bucaramanga, Columna y Reemplazo; se va
const BRUNO = 'eeeeeeee-0000-4000-8000-000000000002' // Medellín (otra ciudad), Reemplazo; recibe Columna
const CARLA = 'eeeeeeee-0000-4000-8000-000000000003' // Barranquilla, Columna y Reemplazo; entrega Columna
const DORA = 'eeeeeeee-0000-4000-8000-000000000004' // Cúcuta, inactiva
const VACANTE_CUC = 'eeeeeeee-0000-4000-8000-000000000005' // "Vacante · Cúcuta", placeholder con Reemplazo
const NO_EXISTE = 'eeeeeeee-0000-4000-8000-0000000000ff'
const HOSPITAL_CUC = 'cccccccc-0000-4000-8000-000000000001'
const OVR_ANA = 'dddddddd-0000-4000-8000-000000000001' // Ana fuerza Medellín en Columna
const OVR_CARLA = 'dddddddd-0000-4000-8000-000000000002' // Carla fuerza Cúcuta en Columna

const MED = (n: number) => `99999999-0000-4000-8000-${String(n).padStart(12, '0')}`
const MOTIVO_O1 = 'Ana cubre Medellín en Columna mientras no haya residente'

function datosIniciales(): Tablas {
  const user = (id: string, role: string, name: string, email = `${name.toLowerCase()}@test.local`) => ({
    id,
    email,
    full_name: name,
    role,
    active: true,
    password: `hash-${id}`,
  })
  const ejecutiva = (id: string, full_name: string, status: string, base_kam_id: string, extra: Fila = {}) => ({
    id,
    full_name,
    status,
    base_kam_id,
    email: null,
    user_id: null,
    company: 'VG Medical',
    odoo_employee_id: null,
    notes: null,
    color: null,
    started_at: '2025-01-15',
    left_at: null,
    created_at: '2025-01-15T05:00:00.000Z',
    updated_at: '2025-01-15T05:00:00.000Z',
    ...extra,
  })
  const cobertura = (line_id: string, kam_id: string, executive_id: string | null, kind: string, extra: Fila = {}) => ({
    id: randomUUID(),
    line_id,
    kam_id,
    executive_id,
    kind,
    travel_minutes: kind === 'local' ? 0 : null,
    source_kam_id: null,
    nearest_executive_id: null,
    nearest_minutes: null,
    has_equipment: true,
    note: null,
    computed_at: '2026-10-19T10:00:00.000Z',
    ...extra,
  })
  const visitante = (medico: number, executive_id: string, line_id: string, municipality_id: string, desde: string) => ({
    id: randomUUID(),
    medico_id: MED(medico),
    executive_id,
    line_id,
    municipality_id,
    desde,
    hasta: null,
    fin_motivo: null,
    traspaso_id: null,
    created_by: ADMIN_ID,
    created_at: `${desde}T15:00:00.000Z`,
    updated_at: `${desde}T15:00:00.000Z`,
  })
  return {
    users: [
      user(ADMIN_ID, 'admin', 'Admin'),
      user(DIRECTORA_ID, 'commercial_director', 'Directora'),
      user(DATOS_ID, 'data_manager', 'Datos'),
      user(LIDER_ID, 'line_leader', 'Lider'),
      user(VIEWER_ID, 'viewer', 'Viewer'),
      user(ANA_USER, 'sales_manager', 'Ana', 'ana@vg.test'),
      user(DORA_USER, 'sales_manager', 'Dora', 'dora@vg.test'),
      user(PAULA_USER, 'sales_manager', 'Paula', 'paula@test.local'),
    ],
    kams: [
      { id: KAM_BGA, name: 'KAM Bucaramanga', area_id: '68001', base_city: 'Bucaramanga', active: true },
      { id: KAM_CUC, name: 'KAM Cúcuta', area_id: '54001', base_city: 'Cúcuta', active: true },
      { id: KAM_BAQ, name: 'KAM Barranquilla', area_id: '08001', base_city: 'Barranquilla', active: true },
      { id: KAM_MED, name: 'KAM Medellín', area_id: '05001', base_city: 'Medellín', active: true },
    ],
    business_lines: [
      { id: LINEA_A, code: 'columna', name: 'Columna', leader_user_id: LIDER_ID, max_reach_minutes: 240, active: true, sort_order: 1 },
      { id: LINEA_B, code: 'reemplazo', name: 'Reemplazo articular', leader_user_id: null, max_reach_minutes: 240, active: true, sort_order: 2 },
    ],
    executives: [
      ejecutiva(ANA, 'Ana Santander', 'active', KAM_BGA, { email: 'ana@vg.test', user_id: ANA_USER, color: '#d62728' }),
      ejecutiva(BRUNO, 'Bruno Antioquia', 'active', KAM_MED, { email: 'bruno@vg.test' }),
      ejecutiva(CARLA, 'Carla Caribe', 'active', KAM_BAQ, { email: 'carla@vg.test', color: '#1f77b4' }),
      ejecutiva(DORA, 'Dora Frontera', 'inactive', KAM_CUC, { email: 'dora@vg.test', user_id: DORA_USER, left_at: '2026-09-30' }),
      ejecutiva(VACANTE_CUC, 'Vacante · Cúcuta', 'placeholder', KAM_CUC, { started_at: null }),
    ],
    executive_lines: [
      { executive_id: ANA, line_id: LINEA_A },
      { executive_id: ANA, line_id: LINEA_B },
      { executive_id: BRUNO, line_id: LINEA_B },
      { executive_id: CARLA, line_id: LINEA_A },
      { executive_id: CARLA, line_id: LINEA_B },
      { executive_id: DORA, line_id: LINEA_A },
      { executive_id: VACANTE_CUC, line_id: LINEA_B },
    ],
    line_zones: [],
    // Una IPS en Cúcuta a 3 h de Bucaramanga: Columna en Cúcuta la alcanza quien viva en Bucaramanga
    hospitals: [
      {
        id: HOSPITAL_CUC,
        code: 'IPS-CUC-1',
        name: 'Clínica Frontera',
        municipality_id: '54001',
        locality_id: null,
        department_id: '54',
        municipality_name: 'Cúcuta',
        department_name: 'Norte de Santander',
        locality_name: null,
        beds: 80,
        active: true,
      },
    ],
    hospital_kam_distances: [{ id: randomUUID(), hospital_id: HOSPITAL_CUC, kam_id: KAM_BGA, travel_time: 10800 }],
    assignments: [],
    municipalities: [
      { code: '68001', name: 'Bucaramanga', department_code: '68' },
      { code: '54001', name: 'Cúcuta', department_code: '54' },
      { code: '08001', name: 'Barranquilla', department_code: '08' },
      { code: '05001', name: 'Medellín', department_code: '05' },
    ],
    departments: [
      { code: '68', name: 'Santander' },
      { code: '54', name: 'Norte de Santander' },
      { code: '08', name: 'Atlántico' },
      { code: '05', name: 'Antioquia' },
    ],
    municipality_zone: [],
    // Cobertura guardada (último recálculo): Ana tiene 3 zonas (2 en Columna, 1 en Reemplazo)
    coverage: [
      cobertura(LINEA_A, KAM_BGA, ANA, 'local'),
      cobertura(LINEA_A, KAM_MED, ANA, 'manual'),
      cobertura(LINEA_A, KAM_CUC, CARLA, 'manual'),
      cobertura(LINEA_A, KAM_BAQ, CARLA, 'local'),
      cobertura(LINEA_B, KAM_BGA, ANA, 'local'),
      cobertura(LINEA_B, KAM_CUC, VACANTE_CUC, 'local'),
      cobertura(LINEA_B, KAM_MED, BRUNO, 'local'),
      cobertura(LINEA_B, KAM_BAQ, CARLA, 'local'),
    ],
    coverage_overrides: [
      { id: OVR_ANA, line_id: LINEA_A, kam_id: KAM_MED, executive_id: ANA, reason: MOTIVO_O1, created_by: ADMIN_ID, active: true, created_at: '2026-10-01T15:00:00.000Z' },
      { id: OVR_CARLA, line_id: LINEA_A, kam_id: KAM_CUC, executive_id: CARLA, reason: 'Carla apoya Cúcuta', created_by: ADMIN_ID, active: true, created_at: '2026-10-02T15:00:00.000Z' },
    ],
    line_territory_names: [
      { line_id: LINEA_A, executive_id: ANA, name: 'Santanderes Columna', updated_by: ADMIN_ID, updated_at: '2026-10-01T15:00:00.000Z' },
      { line_id: LINEA_A, executive_id: CARLA, name: 'Caribe Columna', updated_by: ADMIN_ID, updated_at: '2026-10-01T15:00:00.000Z' },
    ],
    territory_snapshots: [],
    medicos: [
      ...[1, 2, 3, 4, 5, 6, 8, 9].map(n => ({ id: MED(n), nombre: `Médico ${n}`, activo: true })),
      { id: MED(7), nombre: 'Médico 7', activo: false },
    ],
    medico_visitantes: [
      // Ana: 5 médicos (3 en Columna, 2 en Reemplazo)
      visitante(1, ANA, LINEA_A, '68001', '2026-10-01'),
      visitante(2, ANA, LINEA_A, '68001', '2026-10-01'),
      visitante(3, ANA, LINEA_A, '68001', '2026-10-01'),
      visitante(4, ANA, LINEA_B, '68001', '2026-10-01'),
      visitante(5, ANA, LINEA_B, '68001', '2026-10-01'),
      // Carla: Columna (6 empieza después de la fecha − 1; 7 inactivo; 8 ya lo visita Bruno) y Reemplazo (9)
      visitante(6, CARLA, LINEA_A, '08001', '2026-10-16'),
      visitante(7, CARLA, LINEA_A, '08001', '2026-09-01'),
      visitante(8, CARLA, LINEA_A, '08001', '2026-09-01'),
      visitante(9, CARLA, LINEA_B, '08001', '2026-09-01'),
      // Bruno ya visita al 8 por Columna en Barranquilla (asignación vieja)
      visitante(8, BRUNO, LINEA_A, '08001', '2026-08-01'),
    ],
    // Excepciones personales vigentes de Ana (se copian si se pide)
    config_personas: [
      {
        id: randomUUID(),
        executive_id: ANA,
        perfil: ['medica', 'institucional'],
        telefonica_habilitada: true,
        tope_telefonicas_dia: 3,
        radio_m: 400,
        vigente_desde: '2026-10-01',
        vigente_hasta: null,
        motivo: null,
        set_by: ADMIN_ID,
        created_at: '2026-10-01T15:00:00.000Z',
        anulado_at: null,
        clave: ANA,
      },
    ],
    config_metas: [
      {
        id: randomUUID(),
        scope: 'ejecutiva',
        kam_id: null,
        executive_id: ANA,
        tipo: 'medica',
        subtipo_id: null,
        periodo: 'dia',
        cantidad: 5,
        vigente_desde: '2026-10-01',
        vigente_hasta: null,
        motivo: null,
        set_by: ADMIN_ID,
        created_at: '2026-10-01T15:00:00.000Z',
        anulado_at: null,
        clave: `ejecutiva:${ANA}:medica:-`,
      },
    ],
    ejecutivas_traspasos: [],
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

type Handler = (request: NextRequest, contexto: { params: { id: string } }) => Promise<Response>

/** Llama a un handler como lo haría Next.js (con { params: { id } } en las rutas [id]). */
async function pedir(
  handler: Handler,
  path: string,
  opciones: { method?: string; body?: unknown; userId?: string | null; id?: string } = {}
): Promise<{ status: number; body: any }> {
  return leer(await handler(apiRequest(path, opciones), { params: { id: opciones.id ?? '' } }))
}

const previa = (id: string, body: unknown, userId: string = ADMIN_ID) =>
  pedir(vistaPrevia, `/api/executives/${id}/traspaso/vista-previa`, { method: 'POST', id, body, userId })
const traspaso = (id: string, body: unknown, userId: string = ADMIN_ID) =>
  pedir(traspasar, `/api/executives/${id}/traspaso`, { method: 'POST', id, body, userId })
const contratacion = (id: string, body: unknown, userId: string = ADMIN_ID) =>
  pedir(contratar, `/api/executives/${id}/contratar`, { method: 'POST', id, body, userId })
const verHistorial = (query = '', userId: string | null = ADMIN_ID) =>
  pedir(historial as unknown as Handler, `/api/executives/traspasos${query}`, { userId })
const editar = (id: string, body: unknown, userId: string = ADMIN_ID) =>
  pedir(editarEjecutiva, `/api/executives/${id}`, { method: 'PATCH', id, body, userId })
const bajaVieja = (id: string, userId: string = ADMIN_ID) =>
  pedir(darDeBajaVieja, `/api/executives/${id}`, { method: 'DELETE', id, userId })

/**
 * Lo que la vista previa y la función cuentan EXACTAMENTE igual (mismo orden incluido): todo el resumen salvo
 * traspaso_id (no existe antes) y destino_id (la vista previa no lo sabe si la persona o la vacante se crea).
 */
function conteo(resumen: any) {
  return {
    lineas: resumen?.lineas,
    ajustes_movidos: resumen?.ajustes_movidos,
    ajustes_desactivados: resumen?.ajustes_desactivados,
    nombres_copiados: resumen?.nombres_copiados,
    visitantes_movidos: resumen?.visitantes_movidos,
    visitantes_terminados: resumen?.visitantes_terminados,
    omitidos: resumen?.omitidos,
    excepciones_copiadas: resumen?.excepciones_copiadas,
  }
}
const mismoConteo = (a: unknown, b: unknown) => JSON.stringify(conteo(a)) === JSON.stringify(conteo(b))

// ---------------------------------------------------------------------------
// Pruebas
// ---------------------------------------------------------------------------

async function main() {
  const tablas = datosIniciales()
  const fake = fakeSupabase(tablas)
  fetchHandler = fake.handler
  const ejecutiva = (id: string) => tablas.executives.find(fila => fila.id === id) as Fila
  const lineasDe = (id: string) => tablas.executive_lines.filter(v => v.executive_id === id).map(v => v.line_id).sort()
  const abiertasDe = (id: string, lineId?: string) =>
    tablas.medico_visitantes.filter(v => v.executive_id === id && v.hasta === null && (!lineId || v.line_id === lineId))
  const coberturaDe = (lineId: string, kamId: string) => tablas.coverage.find(fila => fila.line_id === lineId && fila.kam_id === kamId)
  /** Peticiones desde la marca: índices de la primera/última de cada tipo, para comprobar el orden. */
  const tramoDesde = (marca: number) => fake.requests.slice(marca)
  const indices = (tramo: FakeRequest[], prueba: (r: FakeRequest) => boolean) =>
    tramo.map((r, index) => (prueba(r) ? index : -1)).filter(index => index >= 0)
  const escriturasCobertura = (tramo: FakeRequest[]) => tramo.filter(r => r.method !== 'GET' && r.table === 'coverage').length

  try {
    // Martes 20 de octubre de 2026, 10:00 en Bogotá
    fijarAhora('2026-10-20T15:00:00.000Z')
    const HOY = '2026-10-20'
    check('el reloj falso da hoy 2026-10-20 en Bogotá', hoyFalso() === HOY, hoyFalso())

    print('\n1. Permisos')
    {
      const antes = fake.writes().length
      const cuerpo = { destino: { tipo: 'vacante' }, dar_de_baja: true }
      for (const [rol, userId] of [
        ['data_manager', DATOS_ID],
        ['line_leader', LIDER_ID],
        ['viewer', VIEWER_ID],
      ] as const) {
        const p = await previa(ANA, cuerpo, userId)
        check(`${rol} → 403 en la vista previa`, p.status === 403, p)
        const t = await traspaso(ANA, cuerpo, userId)
        check(`${rol} → 403 en el traspaso`, t.status === 403, t)
      }
      const lider = await contratacion(VACANTE_CUC, { full_name: 'Alguien' }, LIDER_ID)
      check('line_leader → 403 en contratar (sin executives:edit)', lider.status === 403, lider)
      const viewer = await contratacion(VACANTE_CUC, { full_name: 'Alguien' }, VIEWER_ID)
      check('viewer → 403 en contratar', viewer.status === 403, viewer)
      const sinSesion = await pedir(traspasar, `/api/executives/${ANA}/traspaso`, { method: 'POST', id: ANA, body: cuerpo, userId: null })
      check('sin sesión → 401 en el traspaso', sinSesion.status === 401, sinSesion)
      const sinSesionHistorial = await verHistorial('', null)
      check('sin sesión → 401 en el historial', sinSesionHistorial.status === 401, sinSesionHistorial)
      check('nadie sin permiso escribió nada', fake.writes().length === antes, fake.writes().slice(antes).map(r => `${r.method} ${r.table}`))
      const directora = await previa(ANA, cuerpo, DIRECTORA_ID)
      check('commercial_director sí ve la vista previa (200)', directora.status === 200 && directora.body?.ok === true, directora)
      const admin = await previa(ANA, cuerpo, ADMIN_ID)
      check('admin sí ve la vista previa (200)', admin.status === 200 && admin.body?.ok === true, admin)
      const idMalo = await previa('no-es-un-uuid', cuerpo)
      check('id de ruta no válido → 400', idMalo.status === 400, idMalo)
    }

    print('\n2. "Mi Ejecutivo Comercial" ignora a los inactivos')
    {
      const deAna = await ejecutivosDelUsuario(ANA_USER)
      check('ejecutivosDelUsuario: Ana (activa) sale', deAna.length === 1 && deAna[0] === ANA, deAna)
      const deDora = await ejecutivosDelUsuario(DORA_USER)
      check('ejecutivosDelUsuario: Dora (inactiva) no sale', deDora.length === 0, deDora)
      const personaAna = await personaDelUsuario(ANA_USER)
      check('personaDelUsuario: Ana (activa) sale', personaAna?.id === ANA, personaAna)
      const personaDora = await personaDelUsuario(DORA_USER)
      check('personaDelUsuario: Dora (inactiva) → null', personaDora === null, personaDora)
    }

    print('\n3. Vista previa: no escribe y avisa lo que no se puede')
    {
      const antes = fake.writes().length
      const rpcsAntes = fake.rpcs.length
      const r = await previa(ANA, {
        destino: { tipo: 'nueva', full_name: 'Nora Nueva', email: 'Nora@VG.test' },
        dar_de_baja: true,
        copiar_excepciones: true,
        motivo: 'Renuncia',
      })
      const lineaA = r.body?.lineas?.find((l: any) => l.line_id === LINEA_A)
      check(
        'baja de Ana a una persona nueva: 2 líneas (Columna primero), 1 ajuste, 1 nombre, 5 médicos, 2 excepciones, nada omitido',
        r.status === 200 &&
          r.body.ok === true &&
          JSON.stringify(r.body.resumen.lineas) === JSON.stringify([LINEA_A, LINEA_B]) &&
          r.body.resumen.ajustes_movidos === 1 &&
          r.body.resumen.nombres_copiados === 1 &&
          r.body.resumen.visitantes_movidos === 5 &&
          r.body.resumen.visitantes_terminados === 0 &&
          r.body.resumen.omitidos.length === 0 &&
          r.body.resumen.excepciones_copiadas === 2,
        r.body?.resumen ?? r
      )
      check(
        'la persona nueva hereda la zona de Ana; Ana queda inactiva con último día ayer y su usuario se desactiva',
        r.body?.destino?.se_crea === true &&
          r.body.destino.base_kam_id === KAM_BGA &&
          r.body.destino.email === 'nora@vg.test' &&
          r.body.origen?.status_despues === 'inactive' &&
          r.body.origen.left_at_despues === '2026-10-19' &&
          r.body.desactivar_usuario === true,
        { destino: r.body?.destino, origen: r.body?.origen }
      )
      check(
        'versión final del anexo en las dos líneas con territorio, etiqueta "Final 2026-10-20 (traspaso)"',
        lineaA?.anexo_final?.se_guarda === true &&
          lineaA.anexo_final.etiqueta === etiquetaAnexoFinal(HOY) &&
          r.body.lineas.every((l: any) => l.anexo_final.se_guarda),
        r.body?.lineas?.map((l: any) => l.anexo_final)
      )
      check('la vista previa no escribió nada ni llamó a la función', fake.writes().length === antes && fake.rpcs.length === rpcsAntes, fake.writes().slice(antes))

      const inactiva = await previa(ANA, { destino: { tipo: 'existente', id: DORA }, dar_de_baja: true })
      check(
        'quien recibe inactiva → 200 con ok = false y el error (la interfaz lo muestra)',
        inactiva.status === 200 && inactiva.body.ok === false && inactiva.body.errores.some((e: any) => e.codigo === 'destino_inactivo'),
        inactiva.body?.errores ?? inactiva
      )
      const noExiste = await previa(NO_EXISTE, { destino: { tipo: 'vacante' } })
      check('quien entrega no existe → 404', noExiste.status === 404, noExiste)
      const bajaNadie = await previa(ANA, { destino: { tipo: 'nadie' }, dar_de_baja: true })
      check('baja con "nadie" → 400 (validación)', bajaNadie.status === 400 && bajaNadie.body?.error === MENSAJE_BAJA_SIN_DESTINO, bajaNadie)
      check('ninguna de estas escribió', fake.writes().length === antes, fake.writes().slice(antes))
    }

    print('\n4. Lo que la vista previa rechaza no escribe nada (sin versiones del anexo ni función)')
    {
      const antes = fake.writes().length
      const snapshotsAntes = tablas.territory_snapshots.length
      const casos: [string, unknown, number, string][] = [
        ['email de la persona nueva ya en uso → 409', { destino: { tipo: 'nueva', full_name: 'Otra Bruno', email: 'BRUNO@vg.test' }, dar_de_baja: true }, 409, 'email_en_uso'],
        ['quien recibe inactiva → 400', { destino: { tipo: 'existente', id: DORA }, dar_de_baja: true }, 400, 'destino_inactivo'],
        ['quien recibe no existe → 404', { destino: { tipo: 'existente', id: NO_EXISTE } }, 404, 'destino_no_existe'],
        ['quien recibe es quien entrega → 400', { destino: { tipo: 'existente', id: ANA }, lineas: [LINEA_A] }, 400, 'destino_es_origen'],
        ['fecha de más de 90 días atrás → 400', { destino: { tipo: 'vacante' }, dar_de_baja: true, fecha: '2026-07-01' }, 400, 'fecha_muy_atras'],
        ['fecha futura → 400', { destino: { tipo: 'vacante' }, dar_de_baja: true, fecha: '2026-10-21' }, 400, 'fecha_futura'],
        ['baja sin todas sus líneas → 400', { destino: { tipo: 'vacante' }, dar_de_baja: true, lineas: [LINEA_A] }, 400, 'baja_todas'],
      ]
      for (const [nombre, cuerpo, estado, codigo] of casos) {
        const r = await traspaso(ANA, cuerpo)
        check(nombre, r.status === estado && (r.body?.errores ?? []).some((e: any) => e.codigo === codigo), r)
      }
      const lineaAjena = await traspaso(BRUNO, { destino: { tipo: 'existente', id: CARLA }, lineas: [LINEA_A] })
      check('una línea que no lleva → 400', lineaAjena.status === 400 && lineaAjena.body?.errores?.[0]?.codigo === 'linea_no_la_lleva', lineaAjena)
      const noExiste = await traspaso(NO_EXISTE, { destino: { tipo: 'vacante' } })
      check('quien entrega no existe → 404', noExiste.status === 404, noExiste)
      const usuarioSinBaja = await traspaso(ANA, { destino: { tipo: 'vacante' }, lineas: [LINEA_A], desactivar_usuario: true })
      check('desactivar el usuario sin baja → 400 (validación)', usuarioSinBaja.status === 400 && usuarioSinBaja.body?.error === MENSAJE_USUARIO_SIN_BAJA, usuarioSinBaja)
      const bajaNadie = await traspaso(ANA, { destino: { tipo: 'nadie' }, dar_de_baja: true })
      check('baja con "nadie" → 400', bajaNadie.status === 400, bajaNadie)
      check(
        'ninguno escribió (ni versiones del anexo ni la función): la base igual que antes',
        fake.writes().length === antes && tablas.territory_snapshots.length === snapshotsAntes && ejecutiva(ANA).status === 'active',
        fake.writes().slice(antes).map(r => `${r.method} ${r.table}`)
      )
    }

    print('\n5. Baja de Ana a una persona nueva (criterio 1)')
    let nora = ''
    {
      const cuerpo = {
        destino: { tipo: 'nueva', full_name: 'Nora Nueva', email: 'Nora@VG.test' },
        dar_de_baja: true,
        copiar_excepciones: true,
        motivo: 'Renuncia',
      }
      const vista = await previa(ANA, cuerpo, DIRECTORA_ID)
      const marca = fake.requests.length
      fijarAhora('2026-10-20T15:10:00.000Z')
      const r = await traspaso(ANA, cuerpo, DIRECTORA_ID)
      nora = r.body?.resumen?.destino_id ?? ''
      check(
        '201 con el resumen, las 2 versiones finales del anexo y la cobertura recalculada',
        r.status === 201 &&
          typeof r.body.resumen.traspaso_id === 'string' &&
          r.body.anexos_finales.length === 2 &&
          r.body.anexos_finales.every((a: any) => a.snapshot_id && a.error === null && a.etiqueta === 'Final 2026-10-20 (traspaso)') &&
          r.body.cobertura_recalculada === true,
        r
      )
      check('la vista previa contó exactamente lo que movió el traspaso', mismoConteo(vista.body?.resumen, r.body?.resumen), {
        vista: conteo(vista.body?.resumen),
        traspaso: conteo(r.body?.resumen),
      })
      check('persona nueva con email sin usuario de OpMap: usuario_enlazado = false', r.body?.usuario_enlazado === false, r.body)

      const tramo = tramoDesde(marca)
      const snaps = indices(tramo, x => x.method === 'POST' && x.table === 'territory_snapshots')
      const rpc = indices(tramo, x => x.table === 'rpc/ejecutivas_traspasar')
      const cov = indices(tramo, x => x.method === 'POST' && x.table === 'coverage')
      check(
        'orden: versiones del anexo ANTES de la función, cobertura DESPUÉS',
        snaps.length === 2 && rpc.length === 1 && cov.length > 0 && Math.max(...snaps) < rpc[0] && rpc[0] < Math.min(...cov),
        { snaps, rpc, cov }
      )
      const escrituras = Array.from(new Set(tramo.filter(x => x.method !== 'GET').map(x => x.table))).sort()
      check(
        'la ruta solo escribe versiones del anexo, la función y la cobertura (lo demás lo hace la función)',
        JSON.stringify(escrituras) === JSON.stringify(['coverage', 'rpc/ejecutivas_traspasar', 'territory_snapshots']),
        escrituras
      )
      const llamada = fake.rpcs[fake.rpcs.length - 1]
      check(
        'parámetro p de la función: origen de la ruta, fecha resuelta a hoy, opciones y quién lo hizo',
        llamada?.args?.p?.origen_id === ANA &&
          llamada.args.p.fecha === HOY &&
          llamada.args.p.lineas === null &&
          llamada.args.p.dar_de_baja === true &&
          llamada.args.p.desactivar_usuario === true &&
          llamada.args.p.copiar_excepciones === true &&
          llamada.args.p.destino?.tipo === 'nueva' &&
          llamada.args.p.destino.email === 'nora@vg.test' &&
          llamada.args.p_user === DIRECTORA_ID &&
          !('guardar_anexo_final' in llamada.args.p),
        llamada?.args
      )
      const snapshot = tablas.territory_snapshots.find(s => s.line_id === LINEA_A && s.executive_id === ANA)
      check(
        'la versión final de Columna se guardó con la cobertura de ANTES (Bucaramanga y Medellín) y una nota del traspaso',
        snapshot?.version_label === 'Final 2026-10-20 (traspaso)' &&
          (snapshot.summary?.zones_detail ?? []).map((z: any) => z.kam_id).sort().join() === [KAM_BGA, KAM_MED].sort().join() &&
          /traspaso a Nora Nueva/.test(snapshot.note ?? '') &&
          snapshot.created_by === DIRECTORA_ID,
        snapshot && { label: snapshot.version_label, zonas: snapshot.summary?.zones_detail, note: snapshot.note }
      )
      const nueva = ejecutiva(nora)
      check(
        'la persona nueva: activa, zona base y color de Ana (el mapa no cambia de color), sus 2 líneas, email en minúsculas, desde hoy',
        nueva?.status === 'active' &&
          nueva.base_kam_id === KAM_BGA &&
          nueva.color === '#d62728' &&
          vista.body?.destino?.color === '#d62728' &&
          nueva.email === 'nora@vg.test' &&
          nueva.started_at === HOY &&
          JSON.stringify(lineasDe(nora)) === JSON.stringify([LINEA_A, LINEA_B].sort()),
        nueva
      )
      const ana = ejecutiva(ANA)
      check(
        'Ana: inactiva, left_at = fecha − 1, sin líneas y su usuario desactivado',
        ana.status === 'inactive' &&
          ana.left_at === '2026-10-19' &&
          lineasDe(ANA).length === 0 &&
          tablas.users.find(u => u.id === ANA_USER)?.active === false,
        { ana, lineas: lineasDe(ANA) }
      )
      const deAna = tablas.medico_visitantes.filter(v => v.executive_id === ANA)
      check(
        'los 5 médicos: terminados para Ana el 2026-10-19 (traspaso) y abiertos para la nueva desde hoy',
        deAna.length === 5 &&
          deAna.every(v => v.hasta === '2026-10-19' && v.fin_motivo === 'traspaso') &&
          abiertasDe(nora).length === 5 &&
          abiertasDe(nora).every(v => v.desde === HOY && v.traspaso_id === r.body.resumen.traspaso_id),
        { deAna, nueva: abiertasDe(nora) }
      )
      check(
        'el ajuste manual y el nombre del territorio pasaron a la nueva',
        tablas.coverage_overrides.find(o => o.id === OVR_ANA)?.active === false &&
          tablas.coverage_overrides.some(o => o.executive_id === nora && o.active && o.kam_id === KAM_MED && o.reason === MOTIVO_O1) &&
          tablas.line_territory_names.some(n => n.executive_id === nora && n.line_id === LINEA_A && n.name === 'Santanderes Columna'),
        { ajustes: tablas.coverage_overrides, nombres: tablas.line_territory_names }
      )
      check(
        'cobertura recalculada: la nueva tiene las zonas de Ana (Bucaramanga local, Medellín manual, Reemplazo en Bucaramanga) y Ana ninguna',
        coberturaDe(LINEA_A, KAM_BGA)?.executive_id === nora &&
          coberturaDe(LINEA_A, KAM_BGA)?.kind === 'local' &&
          coberturaDe(LINEA_A, KAM_MED)?.executive_id === nora &&
          coberturaDe(LINEA_A, KAM_MED)?.kind === 'manual' &&
          coberturaDe(LINEA_B, KAM_BGA)?.executive_id === nora &&
          !tablas.coverage.some(fila => fila.executive_id === ANA),
        tablas.coverage.map(f => `${f.line_id.slice(-1)}:${f.kam_id.slice(-1)}:${f.kind}:${f.executive_id?.slice(-4) ?? '-'}`)
      )
      const deAnaAhora = await ejecutivosDelUsuario(ANA_USER)
      const personaAhora = await personaDelUsuario(ANA_USER)
      check('después de la baja, "mi Ejecutivo Comercial" de Ana ya no la trae', deAnaAhora.length === 0 && personaAhora === null, { deAnaAhora, personaAhora })
      const otraVez = await traspaso(ANA, cuerpo, DIRECTORA_ID)
      check('Ana ya inactiva: otro traspaso → 400 (no tiene nada que traspasar)', otraVez.status === 400 && otraVez.body?.errores?.[0]?.codigo === 'origen_inactivo', otraVez)
    }

    print('\n6. Carla se queda y pasa Columna a Bruno, de otra ciudad (criterios 2 y 3)')
    {
      const cuerpo = {
        destino: { tipo: 'existente', id: BRUNO },
        lineas: [LINEA_A],
        fecha: '2026-10-15',
        guardar_anexo_final: false,
      }
      const vista = await previa(CARLA, cuerpo)
      check(
        'vista previa: aviso de otra ciudad, 1 médico se mueve, el inactivo solo se termina, el que Bruno ya visita sale en omitidos',
        vista.status === 200 &&
          vista.body.ok === true &&
          vista.body.avisos.some((a: any) => a.codigo === 'otra_ciudad') &&
          vista.body.lineas[0].medicos_mover.map((m: any) => m.medico_id).join() === MED(6) &&
          vista.body.lineas[0].medicos_terminar.map((m: any) => `${m.medico_id}:${m.razon}`).join() === `${MED(7)}:medico_inactivo` &&
          vista.body.lineas[0].medicos_omitidos.map((m: any) => `${m.medico_id}:${m.razon}`).join() === `${MED(8)}:ya_lo_visita`,
        vista.body
      )
      fijarAhora('2026-10-20T15:20:00.000Z')
      const marca = fake.requests.length
      const r = await traspaso(CARLA, cuerpo)
      check(
        '201: 1 movido, 1 terminado (inactivo), el ya visitado en omitidos con su razón, 1 ajuste y 1 nombre; sin versiones del anexo',
        r.status === 201 &&
          r.body.resumen.destino_id === BRUNO &&
          r.body.resumen.visitantes_movidos === 1 &&
          r.body.resumen.visitantes_terminados === 1 &&
          r.body.resumen.omitidos.some((o: any) => o.medico_id === MED(8) && o.razon === 'ya_lo_visita') &&
          r.body.resumen.ajustes_movidos === 1 &&
          r.body.resumen.nombres_copiados === 1 &&
          r.body.anexos_finales.length === 0 &&
          r.body.cobertura_recalculada === true,
        r
      )
      check('sin versión final pedida no se guardó ninguna', !tramoDesde(marca).some(x => x.table === 'territory_snapshots' && x.method === 'POST'))
      check('la vista previa contó lo mismo que el traspaso', mismoConteo(vista.body?.resumen, r.body?.resumen), {
        vista: conteo(vista.body?.resumen),
        traspaso: conteo(r.body?.resumen),
      })
      check(
        'Bruno suma Columna (conserva su zona) y Carla conserva Reemplazo, sigue activa y con su médico de Reemplazo',
        JSON.stringify(lineasDe(BRUNO)) === JSON.stringify([LINEA_A, LINEA_B].sort()) &&
          ejecutiva(BRUNO).base_kam_id === KAM_MED &&
          JSON.stringify(lineasDe(CARLA)) === JSON.stringify([LINEA_B]) &&
          ejecutiva(CARLA).status === 'active' &&
          abiertasDe(CARLA, LINEA_B).length === 1 &&
          abiertasDe(CARLA, LINEA_A).length === 0,
        { bruno: lineasDe(BRUNO), carla: lineasDe(CARLA), abiertasCarla: abiertasDe(CARLA) }
      )
      const seis = tablas.medico_visitantes.find(v => v.executive_id === CARLA && v.medico_id === MED(6))
      const ocho = tablas.medico_visitantes.filter(v => v.executive_id === BRUNO && v.medico_id === MED(8))
      check(
        'el 6 (empezó después de la fecha) se cierra en su propio desde y Bruno lo visita desde ese mismo día, no desde antes; el 8 no se duplica',
        seis?.hasta === '2026-10-16' &&
          vista.body.lineas[0].medicos_mover[0].hasta_origen === '2026-10-16' &&
          vista.body.lineas[0].medicos_mover[0].desde_destino === '2026-10-16' &&
          abiertasDe(BRUNO, LINEA_A).some(v => v.medico_id === MED(6) && v.desde === '2026-10-16') &&
          !abiertasDe(BRUNO, LINEA_A).some(v => v.medico_id === MED(6) && v.desde < '2026-10-16') &&
          ocho.length === 1 &&
          ocho[0].hasta === null,
        { seis, ocho }
      )
      check(
        'su ajuste de Cúcuta y su nombre de territorio pasaron a Bruno; la cobertura recalculada le da Cúcuta (manual)',
        tablas.coverage_overrides.some(o => o.executive_id === BRUNO && o.active && o.kam_id === KAM_CUC) &&
          tablas.line_territory_names.some(n => n.executive_id === BRUNO && n.line_id === LINEA_A && n.name === 'Caribe Columna') &&
          coberturaDe(LINEA_A, KAM_CUC)?.executive_id === BRUNO &&
          coberturaDe(LINEA_A, KAM_CUC)?.kind === 'manual' &&
          coberturaDe(LINEA_A, KAM_BAQ)?.executive_id !== CARLA,
        { cuc: coberturaDe(LINEA_A, KAM_CUC), baq: coberturaDe(LINEA_A, KAM_BAQ) }
      )
    }

    print('\n7. Bruno pierde Columna y nadie la recibe (criterio 4)')
    {
      const cuerpo = { destino: { tipo: 'nadie' }, lineas: [LINEA_A] }
      const vista = await previa(BRUNO, cuerpo)
      fijarAhora('2026-10-20T15:30:00.000Z')
      const r = await traspaso(BRUNO, cuerpo)
      check(
        '201: sus 2 médicos de Columna quedan sin visitante y su ajuste se desactiva',
        r.status === 201 &&
          r.body.resumen.destino_id === null &&
          r.body.resumen.visitantes_terminados === 2 &&
          r.body.resumen.visitantes_movidos === 0 &&
          r.body.resumen.ajustes_desactivados === 1 &&
          r.body.resumen.ajustes_movidos === 0 &&
          r.body.resumen.omitidos.length === 0,
        r
      )
      check('la vista previa contó lo mismo', mismoConteo(vista.body?.resumen, r.body?.resumen), {
        vista: conteo(vista.body?.resumen),
        traspaso: conteo(r.body?.resumen),
      })
      check(
        'Bruno conserva Reemplazo y sigue activo; nadie visita ya por Columna a los médicos 6 y 8; ningún ajuste activo suyo',
        JSON.stringify(lineasDe(BRUNO)) === JSON.stringify([LINEA_B]) &&
          ejecutiva(BRUNO).status === 'active' &&
          abiertasDe(BRUNO, LINEA_A).length === 0 &&
          !tablas.medico_visitantes.some(v => v.line_id === LINEA_A && v.hasta === null && [MED(6), MED(8)].includes(v.medico_id)) &&
          !tablas.coverage_overrides.some(o => o.executive_id === BRUNO && o.active),
        { lineas: lineasDe(BRUNO), abiertas: abiertasDe(BRUNO) }
      )
      check(
        'guardó la versión final de su anexo de Columna (tenía Cúcuta) antes de la función',
        r.body.anexos_finales.length === 1 && r.body.anexos_finales[0].line_id === LINEA_A && Boolean(r.body.anexos_finales[0].snapshot_id),
        r.body?.anexos_finales
      )
    }

    print('\n8. Errores de la función traducidos (y aviso si ya se guardó la versión final del anexo)')
    {
      const cuerpo = { destino: { tipo: 'vacante' }, dar_de_baja: true }
      const ejecutivasAntes = tablas.executives.length
      const snapshotsAntes = tablas.territory_snapshots.length

      fake.control.errorRpc = { code: '23514', message: 'Carla tiene un cambio en curso (prueba)' }
      const regla = await traspaso(CARLA, cuerpo)
      check(
        '23514 → 400 con el mensaje de la función y aviso de la versión final ya guardada (no se borra)',
        regla.status === 400 &&
          /^Carla tiene un cambio en curso \(prueba\)\./.test(regla.body?.error ?? '') &&
          /El traspaso no se hizo, pero ya quedó guardada la versión final del anexo/.test(regla.body.error) &&
          /Reemplazo articular/.test(regla.body.error) &&
          regla.body.anexos_finales?.length === 1 &&
          Boolean(regla.body.anexos_finales[0].snapshot_id),
        regla
      )
      check(
        'nada a medias: ni vacante creada ni líneas quitadas (solo queda la versión del anexo)',
        tablas.executives.length === ejecutivasAntes &&
          JSON.stringify(lineasDe(CARLA)) === JSON.stringify([LINEA_B]) &&
          ejecutiva(CARLA).status === 'active' &&
          tablas.territory_snapshots.length === snapshotsAntes + 1,
        { ejecutivas: tablas.executives.length, lineas: lineasDe(CARLA) }
      )

      fake.control.errorRpc = { code: '22023', message: 'Alguna línea no es un identificador válido' }
      const dato = await traspaso(CARLA, cuerpo)
      check(
        '22023 → 400; la versión con esa etiqueta ya existía: se conserva (sin repetirla), marcada ya_existia y SIN error (la interfaz no la pinta como fallo)',
        dato.status === 400 &&
          dato.body?.error === 'Alguna línea no es un identificador válido.' &&
          dato.body.anexos_finales?.[0]?.snapshot_id === null &&
          dato.body.anexos_finales[0].ya_existia === true &&
          dato.body.anexos_finales[0].error === null &&
          tablas.territory_snapshots.length === snapshotsAntes + 1,
        dato
      )

      fake.control.errorRpc = { code: 'P0002', message: `No existe el Ejecutivo Comercial que entrega (${CARLA})` }
      const noExiste = await traspaso(CARLA, cuerpo)
      check('P0002 → 404', noExiste.status === 404 && /No existe el Ejecutivo Comercial/.test(noExiste.body?.error ?? ''), noExiste)

      fake.control.errorRpc = {
        code: '23505',
        message: 'duplicate key value violates unique constraint "executives_email_key"',
        details: 'Key (email)=(x@vg.test) already exists.',
      }
      const email = await traspaso(CARLA, cuerpo)
      check('23505 del email → 409 con mensaje claro', email.status === 409 && email.body?.error === 'Ya hay un Ejecutivo Comercial con ese email.', email)

      fake.control.errorRpc = { code: '23505', message: 'Ya hay un Ejecutivo Comercial con el email nueva@vg.test' }
      const emailFuncion = await traspaso(CARLA, cuerpo)
      check('23505 con el mensaje de la función → 409 con ese mensaje', emailFuncion.status === 409 && emailFuncion.body?.error === 'Ya hay un Ejecutivo Comercial con el email nueva@vg.test.', emailFuncion)

      fake.control.errorRpc = { code: 'XX000', message: 'algo raro' }
      const raro = await traspaso(CARLA, cuerpo)
      check(
        'error desconocido → 500 sin afirmar que el traspaso no se hizo: remite al historial (resultado_incierto)',
        raro.status === 500 &&
          raro.body?.error?.startsWith(MENSAJE_RESULTADO_INCIERTO) &&
          !/no se hizo/.test(raro.body.error) &&
          raro.body.resultado_incierto === true,
        raro
      )

      // Corte de red tras guardar una versión nueva del anexo (otro día: etiqueta nueva): la versión queda y no se
      // dice que el traspaso no se hizo (PostgREST pudo confirmarlo antes de perder la respuesta).
      fijarAhora('2026-10-21T15:00:00.000Z')
      const snapshotsAntesCorte = tablas.territory_snapshots.length
      fake.control.errorRpc = { code: '', message: 'TypeError: fetch failed' }
      const corte = await traspaso(CARLA, cuerpo)
      check(
        'error sin código (corte de red) con versión del anexo recién guardada → 500 incierto: dice qué versión quedó, sin "no se hizo"',
        corte.status === 500 &&
          corte.body?.error?.startsWith(MENSAJE_RESULTADO_INCIERTO) &&
          /Ya quedó guardada la versión final del anexo \(«Final 2026-10-21 \(traspaso\)»\) en Reemplazo articular/.test(corte.body.error) &&
          !/no se hizo/.test(corte.body.error) &&
          corte.body.resultado_incierto === true &&
          tablas.territory_snapshots.length === snapshotsAntesCorte + 1,
        corte
      )
      fake.control.errorRpc = null

      fake.faltan.add('rpc/ejecutivas_traspasar')
      const sinFuncion = await traspaso(CARLA, cuerpo)
      check('sin la función (migración 0820 sin aplicar) → 503 con el mensaje de la migración', sinFuncion.status === 503 && sinFuncion.body?.error?.startsWith(MENSAJE_FALTA_MIGRACION_TRASPASO), sinFuncion)
      const vistaSinFuncion = await previa(CARLA, cuerpo)
      check('la vista previa no necesita la 0820 (200)', vistaSinFuncion.status === 200 && vistaSinFuncion.body?.ok === true, vistaSinFuncion)
      fake.faltan.delete('rpc/ejecutivas_traspasar')

      // Sin la 0820 (ni la tabla ni la función, como en producción antes de aplicarla), otro día: 503 ANTES de guardar
      // ninguna versión del anexo (son inmutables) y sin llamar a la función.
      fijarAhora('2026-10-22T15:00:00.000Z')
      fake.faltan.add('rpc/ejecutivas_traspasar')
      fake.faltan.add('ejecutivas_traspasos')
      const snapshotsAntesSin = tablas.territory_snapshots.length
      const rpcsAntesSin = fake.rpcs.length
      const sinMigracion = await traspaso(CARLA, cuerpo)
      check(
        'sin la migración 0820 → 503 sin guardar versiones del anexo ni llamar a la función',
        sinMigracion.status === 503 &&
          sinMigracion.body?.error === MENSAJE_FALTA_MIGRACION_TRASPASO &&
          tablas.territory_snapshots.length === snapshotsAntesSin &&
          fake.rpcs.length === rpcsAntesSin,
        { sinMigracion, snapshots: tablas.territory_snapshots.length - snapshotsAntesSin }
      )
      fake.faltan.delete('rpc/ejecutivas_traspasar')
      fake.faltan.delete('ejecutivas_traspasos')
      fijarAhora('2026-10-20T15:35:00.000Z')
    }

    print('\n9. Carla se va a una vacante y luego se contrata a alguien en esa vacante (criterio 5)')
    let vacante = ''
    {
      fijarAhora('2026-10-20T15:40:00.000Z')
      // Una asignación abierta de Carla en Columna, que ya no lleva (quedó de antes de la 0820): con la baja la
      // termina el disparador; la vista previa y la función la cuentan igual en visitantes_terminados.
      const HUERFANA = '77777777-0000-4000-8000-000000000001'
      tablas.medico_visitantes.push({
        ...DEFECTOS.medico_visitantes(),
        id: HUERFANA,
        medico_id: MED(9),
        executive_id: CARLA,
        line_id: LINEA_A,
        desde: '2026-09-01',
        created_at: ahoraIso(),
      })
      const cuerpoBaja = { destino: { tipo: 'vacante' }, dar_de_baja: true }
      const vistaBaja = await previa(CARLA, cuerpoBaja)
      check(
        'vista previa de la baja: avisa la asignación en una línea que ya no lleva y la cuenta en terminados',
        vistaBaja.status === 200 &&
          vistaBaja.body.ok === true &&
          vistaBaja.body.avisos.some((a: any) => a.codigo === 'visitantes_sin_linea') &&
          vistaBaja.body.resumen.visitantes_terminados === 1,
        vistaBaja.body
      )
      fake.fallan.add('coverage')
      const r = await traspaso(CARLA, cuerpoBaja)
      fake.fallan.delete('coverage')
      vacante = r.body?.resumen?.destino_id ?? ''
      check('la vista previa de la baja contó exactamente lo que hizo la función', mismoConteo(vistaBaja.body?.resumen, r.body?.resumen), {
        vista: conteo(vistaBaja.body?.resumen),
        traspaso: conteo(r.body?.resumen),
      })
      const huerfana = tablas.medico_visitantes.find(v => v.id === HUERFANA)
      check(
        'la asignación huérfana quedó terminada por la baja el día anterior a la fecha (fin_motivo baja), sin pasar a la vacante',
        huerfana?.hasta === '2026-10-19' && huerfana?.fin_motivo === 'baja' && !abiertasDe(vacante, LINEA_A).length,
        huerfana
      )
      check(
        '201 aunque falle el recálculo de la cobertura (el traspaso ya está hecho): cobertura_recalculada = false',
        r.status === 201 && r.body.cobertura_recalculada === false && Boolean(vacante),
        r
      )
      check('a una vacante no se enlaza ningún usuario (sin usuario_enlazado)', !('usuario_enlazado' in (r.body ?? {})), r.body)
      const fila = ejecutiva(vacante)
      check(
        'la vacante: "Vacante · Barranquilla" (sin "KAM"), por contratar, zona y color de Carla, con Reemplazo y su médico',
        fila?.full_name === 'Vacante · Barranquilla' &&
          fila.status === 'placeholder' &&
          fila.base_kam_id === KAM_BAQ &&
          fila.color === '#1f77b4' &&
          JSON.stringify(lineasDe(vacante)) === JSON.stringify([LINEA_B]) &&
          abiertasDe(vacante).length === 1 &&
          abiertasDe(vacante)[0].medico_id === MED(9),
        fila
      )

      const marcaContratar = fake.requests.length
      const activa = await contratacion(BRUNO, { full_name: 'Alguien Más' })
      check('contratar en alguien activo → 400 (solo vacantes)', activa.status === 400, activa)
      const repetido = await contratacion(vacante, { full_name: 'Paula Pérez', email: 'NORA@vg.test' })
      check('email de otro Ejecutivo Comercial → 409', repetido.status === 409, repetido)
      const corto = await contratacion(vacante, { full_name: 'P' })
      check('nombre de una letra → 400', corto.status === 400, corto)
      const noExiste = await contratacion(NO_EXISTE, { full_name: 'Paula Pérez' })
      check('no existe → 404', noExiste.status === 404, noExiste)
      check('la vacante sigue igual tras los rechazos', ejecutiva(vacante).status === 'placeholder' && ejecutiva(vacante).full_name === 'Vacante · Barranquilla')

      // La vacante quedó con el usuario de quien la ocupaba antes (p. ej. una persona pasada a Vacante desde Editar)
      const VIEJO_USER = '99999999-9999-4999-8999-999999999981'
      const VIEJO2_USER = '99999999-9999-4999-8999-999999999982'
      for (const [id, nombre] of [
        [VIEJO_USER, 'Viejo'],
        [VIEJO2_USER, 'Viejo2'],
      ]) {
        tablas.users.push({ id, email: `${nombre.toLowerCase()}@test.local`, full_name: nombre, role: 'sales_manager', active: true, password: `hash-${id}` })
      }
      ejecutiva(vacante).user_id = VIEJO_USER
      ejecutiva(VACANTE_CUC).user_id = VIEJO2_USER

      const ok = await contratacion(vacante, { full_name: 'Paula Pérez', email: 'Paula@Test.local', fecha_ingreso: '2026-10-21' })
      const contratada = ejecutiva(vacante)
      check(
        '200: la MISMA fila queda activa con nombre, email y fecha de ingreso, y conserva zona, líneas y médicos',
        ok.status === 200 &&
          ok.body.executive?.id === vacante &&
          contratada.status === 'active' &&
          contratada.full_name === 'Paula Pérez' &&
          contratada.email === 'paula@test.local' &&
          contratada.started_at === '2026-10-21' &&
          contratada.base_kam_id === KAM_BAQ &&
          JSON.stringify(lineasDe(vacante)) === JSON.stringify([LINEA_B]) &&
          abiertasDe(vacante).some(v => v.medico_id === MED(9)),
        { body: ok.body, contratada }
      )
      check(
        'se enlazó con el usuario de OpMap de ese email, aunque la vacante tuviera el de quien la ocupaba antes',
        ok.body?.usuario_enlazado === true && contratada.user_id === PAULA_USER && ok.body.executive.user_id === PAULA_USER,
        ok.body
      )
      const delViejo = await ejecutivosDelUsuario(VIEJO_USER)
      const personaViejo = await personaDelUsuario(VIEJO_USER)
      check(
        'el usuario de quien ocupaba antes la ficha ya no ve a la contratada (ni sus médicos ni su configuración)',
        delViejo.length === 0 && personaViejo === null,
        { delViejo, personaViejo }
      )
      const otraVez = await contratacion(vacante, { full_name: 'Paula Pérez' })
      check('contratar otra vez (ya no es vacante) → 400', otraVez.status === 400, otraVez)

      const datos = await contratacion(VACANTE_CUC, { full_name: 'Tomás Frontera' }, DATOS_ID)
      check(
        'data_manager (executives:edit) contrata en la vacante de Cúcuta: sin email, desde hoy, sin usuario (se desenlaza el de antes)',
        datos.status === 200 &&
          ejecutiva(VACANTE_CUC).status === 'active' &&
          ejecutiva(VACANTE_CUC).started_at === HOY &&
          ejecutiva(VACANTE_CUC).email === null &&
          ejecutiva(VACANTE_CUC).user_id === null &&
          datos.body.usuario_enlazado === false &&
          JSON.stringify(lineasDe(VACANTE_CUC)) === JSON.stringify([LINEA_B]),
        datos
      )
      const escriturasContratar = tramoDesde(marcaContratar).filter(x => x.method !== 'GET')
      check(
        'contratar solo escribe la fila de la vacante (ni cobertura ni la función)',
        escriturasContratar.length > 0 && escriturasContratar.every(x => x.table === 'executives'),
        escriturasContratar.map(x => `${x.method} ${x.table}`)
      )
    }

    print('\n10. Historial de traspasos (criterio 7)')
    {
      const r = await verHistorial('', VIEWER_ID)
      const items = (r.body?.traspasos ?? []) as any[]
      check(
        'viewer (executives:view) ve los 4 traspasos, del más reciente al más antiguo',
        r.status === 200 &&
          items.length === 4 &&
          items.map(item => item.origen_id).join() === [CARLA, BRUNO, CARLA, ANA].join() &&
          items.every((item, index) => index === 0 || items[index - 1].created_at >= item.created_at),
        items.map(item => [item.origen_nombre, item.destino_tipo, item.created_at])
      )
      const ana = items.find(item => item.origen_id === ANA)
      check(
        'con nombres de quien entregó, quién recibió, las líneas y quién lo hizo, y el resumen',
        ana?.origen_nombre === 'Ana Santander' &&
          ana.destino_nombre === 'Nora Nueva' &&
          ana.destino_tipo === 'nueva' &&
          JSON.stringify(ana.lineas_nombres) === JSON.stringify(['Columna', 'Reemplazo articular']) &&
          ana.created_by_nombre === 'Directora' &&
          ana.dar_de_baja === true &&
          ana.desactivar_usuario === true &&
          ana.resumen?.visitantes_movidos === 5 &&
          ana.fecha === HOY,
        ana
      )
      check('viewer no recibe el motivo de la salida (texto libre: solo quien administra el equipo)', ana?.motivo === null, ana?.motivo)
      for (const [rol, userId] of [
        ['admin', ADMIN_ID],
        ['commercial_director', DIRECTORA_ID],
        ['data_manager', DATOS_ID],
      ] as const) {
        const conMotivo = await verHistorial('', userId)
        const deAna = (conMotivo.body?.traspasos ?? []).find((item: any) => item.origen_id === ANA)
        check(`${rol} sí recibe el motivo`, conMotivo.status === 200 && deAna?.motivo === 'Renuncia', deAna)
      }
      const carlaBaja = items.find(item => item.origen_id === CARLA && item.dar_de_baja)
      check(
        'baja de Carla (sin usuario de OpMap) con la casilla por defecto: el historial NO dice que se desactivó un usuario',
        carlaBaja?.desactivar_usuario === false,
        carlaBaja
      )
      const nadie = items.find(item => item.origen_id === BRUNO)
      check('"nadie": sin destino ni nombre de destino', nadie?.destino_tipo === 'nadie' && nadie.destino_id === null && nadie.destino_nombre === null, nadie)
      const ultimo = items[0]
      check('la vacante contratada sale con su nombre actual', ultimo?.destino_tipo === 'vacante' && ultimo.destino_nombre === 'Paula Pérez', ultimo)
      const deBruno = await verHistorial(`?executive_id=${BRUNO}`)
      check(
        '?executive_id=Bruno: los 2 donde entregó o recibió',
        deBruno.status === 200 && deBruno.body.traspasos.length === 2 && deBruno.body.traspasos.every((i: any) => i.origen_id === BRUNO || i.destino_id === BRUNO),
        deBruno.body
      )
      const malo = await verHistorial('?executive_id=xyz')
      check('?executive_id no válido → 400', malo.status === 400, malo)
      const lider = await verHistorial('', LIDER_ID)
      check('line_leader (executives:view) también lo ve', lider.status === 200, lider)
      fake.faltan.add('ejecutivas_traspasos')
      const sinTabla = await verHistorial()
      check('sin la tabla (0820 sin aplicar) → 503', sinTabla.status === 503 && sinTabla.body?.error === MENSAJE_FALTA_MIGRACION_TRASPASO, sinTabla)
      fake.faltan.delete('ejecutivas_traspasos')
    }

    print('\n11. PATCH y DELETE de executives recalculan la cobertura (API vieja, criterio 6)')
    {
      let marca = fake.requests.length
      const notas = await editar(BRUNO, { notes: 'Llamar el lunes' })
      check(
        'PATCH solo de notas: 200 sin recalcular',
        notas.status === 200 && escriturasCobertura(tramoDesde(marca)) === 0 && !('cobertura_recalculada' in (notas.body ?? {})),
        notas.body
      )
      marca = fake.requests.length
      const mismas = await editar(BRUNO, { full_name: 'Bruno Antioquia', lines: [LINEA_B] })
      check('PATCH con las mismas líneas (el formulario manda todo): no recalcula', mismas.status === 200 && escriturasCobertura(tramoDesde(marca)) === 0, mismas.body)

      check('antes: Bruno cubre Reemplazo en Medellín', coberturaDe(LINEA_B, KAM_MED)?.executive_id === BRUNO, coberturaDe(LINEA_B, KAM_MED))
      marca = fake.requests.length
      const sinLineas = await editar(BRUNO, { lines: [] })
      check(
        'PATCH que le quita la línea: recalcula y Medellín deja de ser suya',
        sinLineas.status === 200 &&
          sinLineas.body.cobertura_recalculada === true &&
          escriturasCobertura(tramoDesde(marca)) > 0 &&
          coberturaDe(LINEA_B, KAM_MED)?.executive_id !== BRUNO &&
          lineasDe(BRUNO).length === 0,
        { body: sinLineas.body, med: coberturaDe(LINEA_B, KAM_MED) }
      )
      marca = fake.requests.length
      const vuelve = await editar(BRUNO, { lines: [LINEA_B] })
      check('PATCH que le devuelve la línea: recalcula y Medellín vuelve a ser suya', vuelve.body?.cobertura_recalculada === true && coberturaDe(LINEA_B, KAM_MED)?.executive_id === BRUNO, coberturaDe(LINEA_B, KAM_MED))
      marca = fake.requests.length
      const inactivo = await editar(BRUNO, { status: 'inactive' })
      check(
        'PATCH a inactivo: recalcula y ya no cubre nada',
        inactivo.status === 200 &&
          inactivo.body.cobertura_recalculada === true &&
          escriturasCobertura(tramoDesde(marca)) > 0 &&
          !tablas.coverage.some(fila => fila.executive_id === BRUNO),
        inactivo.body
      )
      const reactivo = await editar(BRUNO, { status: 'active' })
      check('PATCH de vuelta a activo: recalcula y vuelve a cubrir Medellín', reactivo.body?.cobertura_recalculada === true && coberturaDe(LINEA_B, KAM_MED)?.executive_id === BRUNO, reactivo.body)

      check('antes: Paula (la contratada) cubre Reemplazo en Barranquilla', coberturaDe(LINEA_B, KAM_BAQ)?.executive_id === vacante, coberturaDe(LINEA_B, KAM_BAQ))
      marca = fake.requests.length
      const baja = await bajaVieja(vacante)
      check(
        'DELETE (baja vieja): inactiva, recalcula y Barranquilla deja de ser suya',
        baja.status === 200 &&
          baja.body.cobertura_recalculada === true &&
          ejecutiva(vacante).status === 'inactive' &&
          escriturasCobertura(tramoDesde(marca)) > 0 &&
          !tablas.coverage.some(fila => fila.executive_id === vacante),
        baja.body
      )
      marca = fake.requests.length
      const otraBaja = await bajaVieja(vacante)
      check('DELETE de alguien ya inactivo: no recalcula', otraBaja.status === 200 && escriturasCobertura(tramoDesde(marca)) === 0 && !('cobertura_recalculada' in (otraBaja.body ?? {})), otraBaja.body)

      fake.fallan.add('coverage')
      const falla = await editar(nora, { lines: [LINEA_A] })
      fake.fallan.delete('coverage')
      check(
        'si el recálculo falla, el cambio queda guardado: 200 con cobertura_recalculada = false y el aviso',
        falla.status === 200 &&
          falla.body.cobertura_recalculada === false &&
          falla.body.aviso === AVISO_COBERTURA_SIN_RECALCULAR &&
          JSON.stringify(lineasDe(nora)) === JSON.stringify([LINEA_A]),
        falla.body
      )
    }

    print('\n11b. Persona nueva con email: se enlaza con su usuario de OpMap (como al crear o contratar)')
    {
      const QUIQUE_USER = '99999999-9999-4999-8999-999999999991'
      const LIGADO_USER = '99999999-9999-4999-8999-999999999992'
      for (const [id, nombre, email] of [
        [QUIQUE_USER, 'Quique', 'quique@test.local'],
        [LIGADO_USER, 'Ligado', 'ligado@test.local'],
      ]) {
        tablas.users.push({ id, email, full_name: nombre, role: 'sales_manager', active: true, password: `hash-${id}` })
      }
      ejecutiva(VACANTE_CUC).user_id = LIGADO_USER // ese usuario ya está enlazado con Tomás

      fijarAhora('2026-10-20T16:00:00.000Z')
      const r = await traspaso(BRUNO, {
        destino: { tipo: 'nueva', full_name: 'Quique Nuevo', email: 'Quique@Test.local' },
        lineas: [LINEA_B],
        guardar_anexo_final: false,
      })
      const quique = r.body?.resumen?.destino_id ?? ''
      check(
        '201: la persona nueva quedó enlazada con el usuario de su email (usuario_enlazado = true)',
        r.status === 201 && r.body.usuario_enlazado === true && ejecutiva(quique)?.user_id === QUIQUE_USER,
        { body: r.body, nueva: ejecutiva(quique) }
      )

      const otro = await traspaso(nora, {
        destino: { tipo: 'nueva', full_name: 'Otra Persona', email: 'ligado@test.local' },
        lineas: [LINEA_A],
        guardar_anexo_final: false,
      })
      const otra = otro.body?.resumen?.destino_id ?? ''
      check(
        'usuario ya enlazado con otro Ejecutivo Comercial: no se le quita (usuario_enlazado = false)',
        otro.status === 201 &&
          otro.body.usuario_enlazado === false &&
          ejecutiva(otra)?.user_id === null &&
          ejecutiva(VACANTE_CUC).user_id === LIGADO_USER,
        { body: otro.body, nueva: ejecutiva(otra) }
      )
    }

    print('\n11c. Usuario de quien se va: el traspaso solo desactiva el de un Ejecutivo Comercial (nunca un admin, un líder ni el propio)')
    {
      fijarAhora('2026-10-20T16:30:00.000Z')
      const LILI = 'eeeeeeee-0000-4000-8000-000000000011' // enlazada con la líder de Columna (line_leader)
      const ADELA = 'eeeeeeee-0000-4000-8000-000000000012' // enlazada con el admin
      const DIRE = 'eeeeeeee-0000-4000-8000-000000000013' // enlazada con la propia directora que hace el traspaso
      const nuevas: [string, string, string][] = [
        [LILI, 'Lili Líder', LIDER_ID],
        [ADELA, 'Adela Admin', ADMIN_ID],
        [DIRE, 'Dire Propia', DIRECTORA_ID],
      ]
      for (const [id, nombre, userId] of nuevas) {
        tablas.executives.push({
          ...DEFECTOS.executives(),
          id,
          full_name: nombre,
          status: 'active',
          base_kam_id: KAM_CUC,
          user_id: userId,
          started_at: '2025-01-15',
          created_at: '2025-01-15T05:00:00.000Z',
        })
        tablas.executive_lines.push({ executive_id: id, line_id: LINEA_B })
      }
      const cuerpo = { destino: { tipo: 'vacante' }, dar_de_baja: true, guardar_anexo_final: false } // desactivar por defecto
      for (const [id, nombre, userId, rolVisible] of [
        [LILI, 'Lili Líder', LIDER_ID, 'Líder de línea'],
        [ADELA, 'Adela Admin', ADMIN_ID, 'Administrador'],
      ] as const) {
        const vista = await previa(id, cuerpo, DIRECTORA_ID)
        check(
          `vista previa de la baja de ${nombre}: su usuario (${rolVisible}) NO se desactiva y se avisa por qué`,
          vista.status === 200 &&
            vista.body.ok === true &&
            vista.body.desactivar_usuario === false &&
            vista.body.avisos.some((a: any) => a.codigo === 'usuario_no_se_desactiva' && a.mensaje.includes(rolVisible)),
          vista.body?.avisos
        )
        const r = await traspaso(id, cuerpo, DIRECTORA_ID)
        const fila = tablas.ejecutivas_traspasos.find(t => t.id === r.body?.resumen?.traspaso_id)
        check(
          `baja de ${nombre} por la directora (sin users:manage): su usuario sigue activo y el historial dice false`,
          r.status === 201 &&
            tablas.users.find(u => u.id === userId)?.active === true &&
            fila?.desactivar_usuario === false &&
            ejecutiva(id).status === 'inactive',
          { r: r.body, fila }
        )
      }
      const propia = await previa(DIRE, cuerpo, DIRECTORA_ID)
      check(
        'quien hace el traspaso está enlazada a esa ficha: su propio usuario nunca se desactiva',
        propia.status === 200 &&
          propia.body.desactivar_usuario === false &&
          propia.body.avisos.some((a: any) => a.codigo === 'usuario_no_se_desactiva' && a.mensaje.includes('es el tuyo')),
        propia.body?.avisos
      )
      const rPropia = await traspaso(DIRE, cuerpo, DIRECTORA_ID)
      check(
        'la directora se da de baja a sí misma por traspaso: sigue pudiendo entrar',
        rPropia.status === 201 && tablas.users.find(u => u.id === DIRECTORA_ID)?.active === true,
        rPropia.body
      )
    }

    print('\n12. Reglas generales')
    check(
      'el historial no se tocó por REST (solo lo escribe la función)',
      !fake.requests.some(x => x.method !== 'GET' && x.table === 'ejecutivas_traspasos'),
      fake.requests.filter(x => x.method !== 'GET' && x.table === 'ejecutivas_traspasos').map(x => x.method)
    )
    check(
      'las rutas del traspaso nunca escriben directo visitantes, ajustes, nombres ni líneas (lo hace la función)',
      !fake.requests.some(x => x.method !== 'GET' && ['medico_visitantes', 'coverage_overrides', 'line_territory_names'].includes(x.table)),
      fake.requests.filter(x => x.method !== 'GET' && ['medico_visitantes', 'coverage_overrides', 'line_territory_names'].includes(x.table)).map(x => `${x.method} ${x.table}`)
    )
    check('ninguna petición salió del Supabase falso (ni a Google)', fake.external.length === 0, fake.external)
  } finally {
    fetchHandler = null
  }

  print('')
  print(`Mensajes de las rutas recogidos: ${moduleLogs.length}`)
  print(`Resultado: ${passed} OK, ${failed} con fallo`)
  if (failed > 0) process.exit(1)
}

main().catch(error => {
  process.stderr.write(`traspaso-api-check: error inesperado: ${error instanceof Error ? error.stack : String(error)}\n`)
  process.exit(1)
})
