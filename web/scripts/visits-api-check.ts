/**
 * Fase 7 · F2 Configuración y calendario · pruebas de las rutas (SIN RED, sin Supabase real, sin Google):
 * /api/config-visitas/**, /api/calendario/**, /api/dias-libres/**, /api/me/dias-libres/** y /api/me/cuota.
 *
 * Llama a los handlers reales contra un Supabase FALSO en memoria: un PostgREST mínimo (filtros eq/neq/in/is/gte/
 * lte, orden, rango, proyección, insert/update/delete) con los índices únicos y los CHECK de la migración 0810 que
 * tocan a la API (un día activo por fecha, alcance y ciudad; un día libre vigente por persona y fecha; código de
 * subtipo único; fuera_de_plazo con justificación; revisión con fecha y motivo) y las funciones config_registrar,
 * config_cerrar y calendario_cargar_festivos (espejo mínimo y verosímil de sus pasos). El reloj es FALSO y se mueve
 * a mano (fijarAhora): así el plazo de gracia, "hoy" y el ritmo de la cuota son exactos.
 *
 * Cubre (sección "Verificación" del contrato docs/fases/fase7-visitas-f2-config-calendario.md): viewer 403 en cada
 * ruta; usuario sin ejecutiva enlazada 403 en /api/me/*; vista previa sin escrituras; cambiar el pasado sin motivo
 * 400 y con motivo meses recalculados; superposición con un valor futuro 409 (traducido, sin dejar cambios); Compras
 * peso 0,5 desde noviembre sin tocar octubre; subtipo nuevo con su conteo "solo seguimiento"; festivos devuelve
 * insertados; anular un día del calendario exige motivo; recursos humanos aprueba en bloque; el líder ve solo sus
 * líneas y no aprueba; la ejecutiva registra dentro del plazo, recibe 400 fuera de plazo o en un día no hábil y 409
 * si repite; plazo de 24 horas rechaza 30 horas después y con 48 se permite; quien aprueba registra tarde con
 * justificación (fuera_de_plazo); un festivo de ciudad solo resta a quien trabaja allí; la cuota de /api/me/cuota
 * cuadra con el caso 72 del contrato (meta de zona 6, excepción 4, 20 días hábiles, 2 libres aprobados; ritmo al día
 * hábil 10: 50 %); 503 si falta la migración; ninguna escritura directa a las tablas de configuración; nada sale a
 * la red.
 *
 * El patrón del Supabase falso viene de scripts/terceros-api-check.ts (copiado, no importado).
 * Uso (desde web/): npx tsx scripts/visits-api-check.ts      Código de salida 1 si alguna prueba falla.
 */
import { randomUUID } from 'node:crypto'
import { NextRequest } from 'next/server'
import { passwordVersion, SESSION_COOKIE_NAME, signSession } from '../lib/session'
import { SUBTIPOS_SEMILLA } from '../lib/terceros'
import {
  CONFIG_VIGENTE_DESDE,
  CONTEO_SEMILLA,
  GENERAL_POR_DEFECTO,
  MENSAJE_DIA_NO_HABIL,
  MENSAJE_MOTIVO_CIERRE_PASADO,
  MENSAJE_MOTIVO_PASADO,
  MENSAJE_SIN_EJECUTIVA,
  MENSAJE_VALOR_ANULADO,
  MENSAJE_VALOR_NO_EXISTE,
  MOTIVO_ANULADO_POR_EJECUTIVA,
  MOTIVO_CONTINUACION,
  MOTIVO_REEMPLAZO_MISMO_DIA,
  MOTIVO_SEMILLA,
  MOTIVO_VUELVE_ANTERIOR,
  RAZON_DIA_PROPIO,
  MENSAJE_PROPIO_POR_OTRA,
  consultaMisDiasLibres,
  festivosColombia,
  hoyBogota,
  sumarDias,
  valorVisita,
  type ConteoVigencia,
} from '../lib/visits-rules'
import { MENSAJE_FALTA_MIGRACION } from '../app/api/config-visitas/_lib/visitas-server'
import { GET as verConfig } from '../app/api/config-visitas/route'
import { POST as vistaPrevia } from '../app/api/config-visitas/vista-previa/route'
import { POST as registrarCambio } from '../app/api/config-visitas/cambios/route'
import { POST as cerrarValor } from '../app/api/config-visitas/cerrar/route'
import { POST as crearSubtipo } from '../app/api/config-visitas/subtipos/route'
import { PATCH as editarSubtipo } from '../app/api/config-visitas/subtipos/[id]/route'
import { GET as cuotaDe } from '../app/api/config-visitas/cuota/route'
import { GET as verCalendario, POST as crearDia } from '../app/api/calendario/route'
import { POST as anularDia } from '../app/api/calendario/[id]/anular/route'
import { POST as cargarFestivos } from '../app/api/calendario/festivos/route'
import { GET as listarDiasLibres, POST as registrarPorOtra } from '../app/api/dias-libres/route'
import { POST as revisarDias } from '../app/api/dias-libres/revisar/route'
import { GET as misDiasLibres, POST as registrarMio } from '../app/api/me/dias-libres/route'
import { POST as anularMio } from '../app/api/me/dias-libres/[id]/anular/route'
import { GET as miCuota } from '../app/api/me/cuota/route'

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
process.env.SESSION_SECRET = 'secreto-de-prueba-visits-api-check-0123456789abcdefghijklmnopqrstuvwxyz'

// ---------------------------------------------------------------------------
// Reloj falso: new Date() y Date.now() devuelven el instante fijado (las rutas, la sesión y el Supabase falso)
// ---------------------------------------------------------------------------

const RealDate = Date
let ahoraMs = RealDate.parse('2027-02-01T14:00:00.000Z')
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
  if (!fetchHandler) throw new Error('visits-api-check: la red está prohibida en estas pruebas')
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
    print(`  FALLA ${name}${texto ? ` -> ${texto.slice(0, 700)}` : ''}`)
    if (moduleLogs.length > 0) print(`        últimos mensajes: ${moduleLogs.slice(-3).join(' | ').slice(0, 600)}`)
  }
}

// ---------------------------------------------------------------------------
// Supabase FALSO (PostgREST mínimo en memoria + funciones de la 0810)
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
const TABLAS_CONFIG = ['config_metas', 'config_conteo', 'config_general', 'config_personas']
const ESTADOS_VIGENTES = ['registrado', 'por_aprobar', 'aprobado']

/** Índices únicos de la 0800/0810 que tocan estas rutas. nulosIguales: la de calendario usa coalesce. */
interface Unica {
  nombre: string
  columnas: string[]
  donde?: (fila: Fila) => boolean
  nulosIguales?: boolean
}
const UNICAS: Record<string, Unica[]> = {
  calendario: [
    {
      nombre: 'calendario_dia_activo_uidx',
      columnas: ['fecha', 'alcance', 'municipality_id'],
      donde: fila => !fila.anulado_at,
      nulosIguales: true,
    },
  ],
  dias_libres: [
    { nombre: 'dias_libres_vigente_uidx', columnas: ['executive_id', 'fecha'], donde: fila => ESTADOS_VIGENTES.includes(fila.estado) },
  ],
  subtipos_institucionales: [{ nombre: 'subtipos_institucionales_codigo_key', columnas: ['codigo'] }],
}

const ahoraIso = () => new Date().toISOString()
const DEFECTOS: Record<string, () => Fila> = {
  calendario: () => ({ municipality_id: null, origen: 'manual', created_by: null, anulado_at: null, anulado_por: null, anulado_motivo: null }),
  dias_libres: () => ({
    nota: null,
    registrado_por: null,
    registrado_at: ahoraIso(),
    fuera_de_plazo: false,
    justificacion: null,
    revisado_por: null,
    revisado_at: null,
    motivo_revision: null,
    updated_at: ahoraIso(),
  }),
  subtipos_institucionales: () => ({ roles_sugeridos: [], vigente_hasta: null, created_by: null, updated_at: ahoraIso() }),
}

/** clave de una fila de configuración: la misma expresión que la columna generada de la 0810. */
function claveDe(tabla: string, fila: Fila): string {
  switch (tabla) {
    case 'config_metas':
      return `${fila.scope}:${fila.kam_id ?? fila.executive_id ?? '-'}:${fila.tipo}:${fila.subtipo_id ?? '-'}`
    case 'config_conteo':
      return String(fila.subtipo_id)
    case 'config_general':
      return String(fila.parametro)
    default:
      return String(fila.executive_id)
  }
}

/** Columnas tipadas de una fila nueva de configuración a partir de p_valores (como el INSERT de config_registrar). */
function columnasConfig(tabla: string, valores: Fila): Fila {
  const texto = (valor: unknown) => (typeof valor === 'string' && valor.trim() ? valor.trim().toLowerCase() : null)
  switch (tabla) {
    case 'config_metas':
      return {
        scope: valores.scope,
        kam_id: texto(valores.kam_id),
        executive_id: texto(valores.executive_id),
        tipo: valores.tipo,
        subtipo_id: texto(valores.subtipo_id),
        periodo: valores.periodo,
        cantidad: Number(valores.cantidad),
      }
    case 'config_conteo':
      return { subtipo_id: texto(valores.subtipo_id), modo: valores.modo, peso: valores.peso === undefined || valores.peso === null ? 1 : Number(valores.peso) }
    case 'config_general':
      return { parametro: valores.parametro, valor: valores.valor }
    default:
      return {
        executive_id: texto(valores.executive_id),
        perfil: Array.isArray(valores.perfil) ? valores.perfil : ['medica', 'institucional'],
        telefonica_habilitada: valores.telefonica_habilitada ?? false,
        tope_telefonicas_dia: valores.tope_telefonicas_dia ?? null,
        radio_m: valores.radio_m ?? null,
      }
  }
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
  /** Escrituras REST directas a las tablas de configuración o DELETE de calendario/días libres (deben quedar en 0). */
  const prohibidas: string[] = []
  /** Tablas o funciones ("rpc/…") que "no existen" (para probar el 503 por migración sin aplicar). */
  const faltan = new Set<string>()
  const rpcs: { nombre: string; args: Fila }[] = []
  const json = (payload: unknown, status = 200, extra: Record<string, string> = {}) =>
    new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json', ...extra } })
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

  /** CHECK y llaves foráneas de la 0810 (y la vigencia de subtipos de la 0800) que la API debe respetar. */
  function violacion(table: string, fila: Fila): { code: string; message: string } | null {
    const chk = (nombre: string) => ({ code: '23514', message: `new row for relation "${table}" violates check constraint "${nombre}"` })
    if (table === 'dias_libres') {
      if (![0.5, 1].includes(Number(fila.fraccion))) return chk('dias_libres_fraccion_check')
      if (!/^[a-z_]{2,40}$/.test(String(fila.motivo))) return chk('dias_libres_motivo_check')
      if (!['registrado', 'por_aprobar', 'aprobado', 'rechazado', 'anulado'].includes(fila.estado)) return chk('dias_libres_estado_check')
      if (fila.fuera_de_plazo && String(fila.justificacion ?? '').trim().length < 5) return chk('dias_libres_fuera_de_plazo_check')
      if (['aprobado', 'rechazado', 'anulado'].includes(fila.estado) && !fila.revisado_at) return chk('dias_libres_revision_check')
      if (['rechazado', 'anulado'].includes(fila.estado) && !String(fila.motivo_revision ?? '').trim()) {
        return chk('dias_libres_motivo_revision_check')
      }
      if (!store('executives').some(e => e.id === fila.executive_id)) {
        return { code: '23503', message: 'insert or update on table "dias_libres" violates foreign key constraint' }
      }
    }
    if (table === 'calendario') {
      if ((fila.alcance === 'ciudad') !== (fila.municipality_id !== null && fila.municipality_id !== undefined)) {
        return chk('calendario_municipio_check')
      }
      if (fila.alcance === 'nacional' && fila.tipo !== 'no_habil') return chk('calendario_nacional_check')
      if (fila.origen === 'calculado' && fila.alcance !== 'nacional') return chk('calendario_calculado_check')
      if (fila.anulado_at && !String(fila.anulado_motivo ?? '').trim()) return chk('calendario_anulado_check')
      if (fila.municipality_id && !store('municipalities').some(m => m.code === fila.municipality_id)) {
        return { code: '23503', message: 'insert or update on table "calendario" violates foreign key constraint' }
      }
    }
    if (table === 'subtipos_institucionales' && fila.vigente_hasta && fila.vigente_hasta < fila.vigente_desde) {
      return chk('subtipos_institucionales_vigencia_check')
    }
    return null
  }

  // --- Funciones de la 0810 (espejo mínimo de sus pasos) ---

  function configRegistrar(args: Fila): Response {
    const { p_tabla, p_valores, p_desde, p_hasta, p_motivo, p_user } = args
    if (!TABLAS_CONFIG.includes(p_tabla)) return pgError('22023', `Tabla de configuración no válida: ${p_tabla ?? '(vacía)'}`, 400)
    if (!p_valores || typeof p_valores !== 'object') return pgError('22023', 'Faltan los valores del cambio', 400)
    if (!p_desde) return pgError('22023', 'Falta la fecha "Rige desde"', 400)
    const hasta: string | null = p_hasta ?? null
    const motivo = typeof p_motivo === 'string' && p_motivo.trim() ? p_motivo.trim() : null
    const nueva = columnasConfig(p_tabla, p_valores)
    const clave = claveDe(p_tabla, nueva)
    // Llaves foráneas
    const existe = (tabla: string, id: unknown) => id === null || id === undefined || store(tabla).some(row => row.id === id)
    if (!existe('kams', nueva.kam_id) || !existe('executives', nueva.executive_id) || !existe('subtipos_institucionales', nueva.subtipo_id)) {
      return pgError('23503', `insert or update on table "${p_tabla}" violates foreign key constraint`, 409)
    }
    // 3. Cambiar el pasado exige motivo
    if (p_desde < hoyFalso() && (motivo ?? '').length < 5) return pgError('23514', 'Para cambiar el pasado hace falta un motivo', 400)
    // 4. hasta no antes de desde
    if (hasta !== null && hasta < p_desde) {
      return pgError('23514', `La fecha "hasta" (${hasta}) no puede ser anterior a "Rige desde" (${p_desde})`, 400)
    }
    const filas = store(p_tabla)
    const creado = ahoraIso()
    // La fila que rige en p_desde (a lo sumo una): la fila nueva guarda cuál era y su fin (anterior_id/_hasta).
    let anteriorId: string | null = null
    let anteriorHasta: string | null = null
    // 5. La que empieza el mismo día se anula; la que empieza antes y sigue vigente se corta; continuación.
    const vigentes = filas
      .filter(f => f.clave === clave && !f.anulado_at && f.vigente_desde <= p_desde && (f.vigente_hasta === null || f.vigente_hasta >= p_desde))
      .sort((a, b) => compareValues(a.vigente_desde, b.vigente_desde))
    for (const fila of vigentes) {
      const finOriginal: string | null = fila.vigente_hasta
      anteriorId = fila.id
      anteriorHasta = finOriginal
      if (fila.vigente_desde === p_desde) {
        fila.anulado_at = creado
        fila.anulado_por = p_user
        fila.anulado_motivo = MOTIVO_REEMPLAZO_MISMO_DIA
      } else {
        fila.vigente_hasta = sumarDias(p_desde, -1)
      }
      if (hasta !== null && (finOriginal === null || finOriginal > hasta)) {
        const copia: Fila = { ...fila }
        filas.push({
          ...copia,
          id: randomUUID(),
          vigente_desde: sumarDias(hasta, 1),
          vigente_hasta: finOriginal,
          motivo: MOTIVO_CONTINUACION,
          set_by: p_user,
          created_at: creado,
          anulado_at: null,
          anulado_por: null,
          anulado_motivo: null,
          anterior_id: null,
          anterior_hasta: null,
        })
      }
    }
    // 6. hasta efectivo
    const posteriores = filas.filter(f => f.clave === clave && !f.anulado_at && f.vigente_desde > p_desde).map(f => String(f.vigente_desde)).sort()
    const choque = posteriores[0] ?? null
    let hastaEfectivo: string | null
    if (hasta !== null) {
      if (choque !== null && choque <= hasta) {
        return pgError('23P01', `El rango se superpone con un valor que empieza el ${choque}`, 409)
      }
      hastaEfectivo = hasta
    } else {
      hastaEfectivo = choque !== null ? sumarDias(choque, -1) : null
    }
    // 7. Fila nueva (con la restricción de exclusión como red de seguridad)
    const fila: Fila = {
      id: randomUUID(),
      ...nueva,
      vigente_desde: p_desde,
      vigente_hasta: hastaEfectivo,
      motivo,
      set_by: p_user,
      created_at: creado,
      anulado_at: null,
      anulado_por: null,
      anulado_motivo: null,
      anterior_id: anteriorId,
      anterior_hasta: anteriorHasta,
      clave,
    }
    const fin = (f: Fila) => f.vigente_hasta ?? '9999-12-31'
    if (filas.some(f => f.clave === clave && !f.anulado_at && f.vigente_desde <= fin(fila) && fila.vigente_desde <= fin(f))) {
      return pgError('23P01', `conflicting key value violates exclusion constraint "${p_tabla}_sin_superposicion"`, 409)
    }
    filas.push(fila)
    return json(fila.id)
  }

  function configCerrar(args: Fila): Response {
    const { p_tabla, p_id, p_hasta, p_motivo, p_user } = args
    if (!TABLAS_CONFIG.includes(p_tabla)) return pgError('22023', `Tabla de configuración no válida: ${p_tabla ?? '(vacía)'}`, 400)
    if (!p_hasta) return pgError('22023', 'Falta la fecha "hasta"', 400)
    const fila = store(p_tabla).find(row => row.id === p_id)
    if (!fila) return pgError('P0002', 'No existe ese valor de configuración', 404)
    if (fila.anulado_at) return pgError('P0002', 'Ese valor de configuración ya está anulado', 404)
    const motivo = typeof p_motivo === 'string' && p_motivo.trim() ? p_motivo.trim() : null
    if (p_hasta < hoyFalso() && (motivo ?? '').length < 5) {
      return pgError('23514', 'Para cerrar o anular un valor en el pasado hace falta un motivo', 400)
    }
    const finOriginal: string | null = fila.vigente_hasta
    let hueco: string | null = null
    if (p_hasta >= fila.vigente_desde) {
      if (fila.vigente_hasta === null || fila.vigente_hasta > p_hasta) {
        fila.vigente_hasta = p_hasta
        hueco = sumarDias(p_hasta, 1)
      }
    } else {
      fila.anulado_at = ahoraIso()
      fila.anulado_por = p_user
      fila.anulado_motivo = motivo ?? 'Cerrado antes de empezar a regir'
      hueco = fila.vigente_desde
    }
    // Vuelve a regir el valor que esta fila cortó o reemplazó (espejo del último paso de config_cerrar).
    if (hueco !== null && fila.anterior_id) {
      const filas = store(p_tabla)
      const anteriorHasta: string | null = fila.anterior_hasta ?? null
      const fin =
        finOriginal === null ? anteriorHasta : anteriorHasta === null ? finOriginal : finOriginal < anteriorHasta ? finOriginal : anteriorHasta
      if (fin === null || fin >= hueco) {
        const anterior = filas.find(row => row.id === fila.anterior_id)
        const diaAntes = sumarDias(fila.vigente_desde, -1)
        const fuente =
          anterior && anterior.vigente_desde === fila.vigente_desde
            ? anterior
            : filas.find(row => row.clave === fila.clave && !row.anulado_at && row.id !== fila.id && row.vigente_hasta === diaAntes)
        if (fuente) {
          if (!fuente.anulado_at && fuente.vigente_hasta === sumarDias(hueco, -1)) {
            fuente.vigente_hasta = fin
          } else {
            filas.push({
              ...fuente,
              id: randomUUID(),
              vigente_desde: hueco,
              vigente_hasta: fin,
              motivo: MOTIVO_VUELVE_ANTERIOR,
              set_by: p_user,
              created_at: ahoraIso(),
              anulado_at: null,
              anulado_por: null,
              anulado_motivo: null,
              anterior_id: null,
              anterior_hasta: null,
            })
          }
        }
      }
    }
    return json(null)
  }

  function cargarFestivosRpc(args: Fila): Response {
    const { p_anio, p_user } = args
    if (!Number.isInteger(p_anio) || p_anio < 1900 || p_anio > 2200) {
      return pgError('22023', `Año fuera de rango para cargar festivos: ${p_anio} (de 1900 a 2200)`, 400)
    }
    const porFecha = new Map<string, string[]>()
    for (const festivo of festivosColombia(p_anio)) porFecha.set(festivo.fecha, [...(porFecha.get(festivo.fecha) ?? []), festivo.nombre])
    let insertados = 0
    for (const [fecha, nombres] of Array.from(porFecha.entries())) {
      if (store('calendario').some(row => row.fecha === fecha && row.alcance === 'nacional')) continue
      store('calendario').push({
        id: randomUUID(),
        fecha,
        alcance: 'nacional',
        municipality_id: null,
        tipo: 'no_habil',
        nombre: [...nombres].sort((a, b) => a.localeCompare(b, 'es')).join(' y '),
        origen: 'calculado',
        created_by: p_user ?? null,
        created_at: ahoraIso(),
        anulado_at: null,
        anulado_por: null,
        anulado_motivo: null,
      })
      insertados++
    }
    return json(insertados)
  }

  const handler: FetchHandler = async (input, init) => {
    const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const url = new URL(href)
    if (url.origin !== FAKE_SUPABASE_URL) {
      external.push(url.origin)
      throw new Error(`visits-api-check: intento de red a ${url.origin}`)
    }
    const method = (init?.method || 'GET').toUpperCase()
    const table = url.pathname.replace('/rest/v1/', '')
    const body = init?.body ? JSON.parse(String(init.body)) : undefined
    requests.push({ method, table, params: url.searchParams, body })
    const headers = new Headers(init?.headers)
    const wantsObject = (headers.get('accept') || '').includes('vnd.pgrst.object')
    const select = url.searchParams.get('select')

    if (faltan.has(table)) {
      return table.startsWith('rpc/')
        ? pgError('PGRST202', `Could not find the function public.${table.slice(4)} in the schema cache`, 404)
        : pgError('PGRST205', `Could not find the table 'public.${table}' in the schema cache`, 404)
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
      const funciones: Record<string, (args: Fila) => Response> = {
        config_registrar: configRegistrar,
        config_cerrar: configCerrar,
        calendario_cargar_festivos: cargarFestivosRpc,
      }
      const funcion = funciones[nombre]
      if (!funcion) throw new Error(`Supabase falso: función no soportada ${nombre}`)
      const respuesta = funcion(args)
      if (!respuesta.ok) rollback()
      return respuesta
    }

    if (method !== 'GET' && TABLAS_CONFIG.includes(table)) {
      prohibidas.push(`${method} ${table}`)
      return pgError('42501', `visits-api-check: escritura directa a ${table} (solo por config_registrar o config_cerrar)`, 403)
    }

    let rows: Fila[]
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
      offset = Number(url.searchParams.get('offset') ?? 0)
      const limit = url.searchParams.get('limit')
      rows = rows.slice(offset, limit === null ? undefined : offset + Number(limit))
    } else if (method === 'POST') {
      const nuevas = (Array.isArray(body) ? body : [body]).map(row => ({
        id: randomUUID(),
        ...(DEFECTOS[table]?.() ?? {}),
        created_at: ahoraIso(),
        ...(row as Fila),
      }))
      for (const nueva of nuevas) {
        const unica = uniqueViolation(table, nueva, new Set())
        if (unica) {
          rollback()
          return duplicate(unica)
        }
        const regla = violacion(table, nueva)
        if (regla) {
          rollback()
          return pgError(regla.code, regla.message, 400)
        }
        store(table).push(nueva)
      }
      rows = nuevas
    } else if (method === 'PATCH') {
      rows = store(table).filter(row => matchesFilters(row, url.searchParams))
      for (const row of rows) {
        const despues = { ...row, ...(body as Fila), ...(table === 'dias_libres' || table === 'subtipos_institucionales' ? { updated_at: ahoraIso() } : {}) }
        const unica = uniqueViolation(table, despues, new Set([row]))
        if (unica) {
          rollback()
          return duplicate(unica)
        }
        const regla = violacion(table, despues)
        if (regla) {
          rollback()
          return pgError(regla.code, regla.message, 400)
        }
        Object.assign(row, despues)
      }
    } else if (method === 'DELETE') {
      if (table === 'calendario' || table === 'dias_libres') {
        prohibidas.push(`DELETE ${table}`)
        return pgError('23514', `Las filas de ${table} no se borran: se anulan con motivo`, 400)
      }
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
  return { handler, requests, external, writes, prohibidas, faltan, rpcs }
}

// ---------------------------------------------------------------------------
// Datos de prueba
// ---------------------------------------------------------------------------

const ADMIN_ID = '11111111-1111-4111-8111-111111111111'
const VIEWER_ID = '22222222-2222-4222-8222-222222222222'
const VENTAS_ID = '33333333-3333-4333-8333-333333333333' // sales_manager enlazada con Ana (EJEC_1)
const LIDER_ID = '44444444-4444-4444-8444-444444444444' // line_leader de la línea A, enlazada con Carla (EJEC_3)
const DIRECTORA_ID = '55555555-5555-4555-8555-555555555555' // commercial_director SIN ejecutiva enlazada
const RRHH_ID = '66666666-6666-4666-8666-666666666666' // hr

const LINEA_A = 'aaaaaaaa-0000-4000-8000-000000000001'
const LINEA_B = 'aaaaaaaa-0000-4000-8000-000000000002'
const KAM_BGA = 'bbbbbbbb-0000-4000-8000-000000000001' // Bucaramanga (68001)
const KAM_CHAPINERO = 'bbbbbbbb-0000-4000-8000-000000000002' // celda de Bogotá 1100102 → 11001
const KAM_USAQUEN = 'bbbbbbbb-0000-4000-8000-000000000003' // celda de Bogotá 1100101 → 11001
const EJEC_1 = 'eeeeeeee-0000-4000-8000-000000000001' // Ana: Bucaramanga, líneas A y B
const EJEC_2 = 'eeeeeeee-0000-4000-8000-000000000002' // Berta: Chapinero, solo línea B, sin usuario
const EJEC_3 = 'eeeeeeee-0000-4000-8000-000000000003' // Carla: Usaquén, línea A (la líder)
const EJEC_4 = 'eeeeeeee-0000-4000-8000-000000000004' // Dora: se enlaza con la directora solo en la sección 9b

const SUBTIPO_ID: Record<string, string> = Object.fromEntries(SUBTIPOS_SEMILLA.map(subtipo => [subtipo.codigo, randomUUID()]))

function filaConfig(tabla: string, columnas: Fila): Fila {
  return {
    id: randomUUID(),
    ...columnas,
    vigente_desde: CONFIG_VIGENTE_DESDE,
    vigente_hasta: null,
    motivo: MOTIVO_SEMILLA,
    set_by: null,
    created_at: '2026-10-12T05:00:00.000Z',
    anulado_at: null,
    anulado_por: null,
    anulado_motivo: null,
    clave: claveDe(tabla, columnas),
  }
}

function datosIniciales(): Tablas {
  const user = (id: string, role: string, name: string) => ({
    id,
    email: `${name.toLowerCase()}@test.local`,
    full_name: name,
    role,
    active: true,
    password: `hash-${id}`,
  })
  const general = GENERAL_POR_DEFECTO as unknown as Record<string, unknown>
  return {
    users: [
      user(ADMIN_ID, 'admin', 'Admin'),
      user(VIEWER_ID, 'viewer', 'Viewer'),
      user(VENTAS_ID, 'sales_manager', 'Ventas'),
      user(LIDER_ID, 'line_leader', 'Lider'),
      user(DIRECTORA_ID, 'commercial_director', 'Directora'),
      user(RRHH_ID, 'hr', 'RRHH'),
    ],
    municipalities: [
      { code: '68001', name: 'Bucaramanga', department_code: '68' },
      { code: '11001', name: 'Bogotá D.C.', department_code: '11' },
      { code: '05001', name: 'Medellín', department_code: '05' },
    ],
    kams: [
      { id: KAM_BGA, name: 'KAM Bucaramanga', area_id: '68001', active: true },
      { id: KAM_CHAPINERO, name: 'KAM Chapinero', area_id: '1100102', active: true },
      { id: KAM_USAQUEN, name: 'KAM Usaquén', area_id: '1100101', active: true },
    ],
    business_lines: [
      { id: LINEA_A, code: 'linea-a', name: 'Línea A', leader_user_id: LIDER_ID, active: true },
      { id: LINEA_B, code: 'linea-b', name: 'Línea B', leader_user_id: null, active: true },
    ],
    executives: [
      { id: EJEC_1, full_name: 'Ana Ejecutiva', status: 'active', user_id: VENTAS_ID, base_kam_id: KAM_BGA, started_at: '2026-01-15', left_at: null },
      { id: EJEC_2, full_name: 'Berta Ejecutiva', status: 'active', user_id: null, base_kam_id: KAM_CHAPINERO, started_at: '2025-06-01', left_at: null },
      { id: EJEC_3, full_name: 'Carla Líder', status: 'active', user_id: LIDER_ID, base_kam_id: KAM_USAQUEN, started_at: '2025-03-01', left_at: null },
    ],
    executive_lines: [
      { executive_id: EJEC_1, line_id: LINEA_A },
      { executive_id: EJEC_1, line_id: LINEA_B },
      { executive_id: EJEC_2, line_id: LINEA_B },
      { executive_id: EJEC_3, line_id: LINEA_A },
    ],
    subtipos_institucionales: SUBTIPOS_SEMILLA.map(subtipo => ({
      id: SUBTIPO_ID[subtipo.codigo],
      codigo: subtipo.codigo,
      nombre: subtipo.nombre,
      para_que: subtipo.para_que,
      roles_sugeridos: [...subtipo.roles_sugeridos],
      orden: subtipo.orden,
      vigente_desde: CONFIG_VIGENTE_DESDE,
      vigente_hasta: null,
      created_by: null,
      created_at: '2026-10-12T05:00:00.000Z',
      updated_at: '2026-10-12T05:00:00.000Z',
    })),
    // Semillas de la 0810
    config_metas: [
      filaConfig('config_metas', { scope: 'general', kam_id: null, executive_id: null, tipo: 'medica', subtipo_id: null, periodo: 'dia', cantidad: 6 }),
      filaConfig('config_metas', { scope: 'general', kam_id: null, executive_id: null, tipo: 'institucional', subtipo_id: null, periodo: 'dia', cantidad: 1 }),
    ],
    config_conteo: Object.entries(CONTEO_SEMILLA).map(([codigo, modo]) =>
      filaConfig('config_conteo', { subtipo_id: SUBTIPO_ID[codigo], modo, peso: 1 })
    ),
    config_general: Object.keys(general).map(parametro => filaConfig('config_general', { parametro, valor: general[parametro] })),
    config_personas: [],
    // La 0810 carga los festivos de 2026 (y 2027, que aquí se carga por la API)
    calendario: festivosColombia(2026).map(festivo => ({
      id: randomUUID(),
      fecha: festivo.fecha,
      alcance: 'nacional',
      municipality_id: null,
      tipo: 'no_habil',
      nombre: festivo.nombre,
      origen: 'calculado',
      created_by: null,
      created_at: '2026-10-12T05:00:00.000Z',
      anulado_at: null,
      anulado_por: null,
      anulado_motivo: null,
    })),
    dias_libres: [],
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

const cambio = (tabla: string, valores: Fila, desde: string, extra: Fila = {}) => ({ tabla, valores, desde, ...extra })
const metaValores = (extra: Fila) => ({ scope: 'general', kam_id: null, executive_id: null, tipo: 'medica', subtipo_id: null, periodo: 'dia', cantidad: 6, ...extra })
const diaLibre = (fecha: string, extra: Fila = {}) => ({ fecha, fraccion: 1, motivo: 'vacaciones', ...extra })

// ---------------------------------------------------------------------------
// Pruebas
// ---------------------------------------------------------------------------

async function main() {
  const tablas = datosIniciales()
  const fake = fakeSupabase(tablas)
  fetchHandler = fake.handler
  const filasDe = (tabla: string, clave: string) => tablas[tabla].filter(fila => fila.clave === clave)
  const activasDe = (tabla: string, clave: string) => filasDe(tabla, clave).filter(fila => !fila.anulado_at)
  // Ids, no objetos: el falso deshace una petición fallida reponiendo copias de las filas.
  const porId = (tabla: string, id: string | undefined) => tablas[tabla].find(fila => fila.id === id)
  const SEMILLA_MEDICA = String(tablas.config_metas[0].id)
  const SEMILLA_INSTITUCIONAL = String(tablas.config_metas[1].id)

  try {
    // Lunes 1 de febrero de 2027, 09:00 en Bogotá
    fijarAhora('2027-02-01T14:00:00.000Z')

    print('1. Permisos')
    {
      const antes = fake.writes().length
      const X = '99999999-9999-4999-8999-999999999999'
      const rutas: [string, Handler, string, string?][] = [
        ['GET /api/config-visitas', verConfig, '/api/config-visitas'],
        ['POST /api/config-visitas/vista-previa', vistaPrevia, '/api/config-visitas/vista-previa', 'POST'],
        ['POST /api/config-visitas/cambios', registrarCambio, '/api/config-visitas/cambios', 'POST'],
        ['POST /api/config-visitas/cerrar', cerrarValor, '/api/config-visitas/cerrar', 'POST'],
        ['POST /api/config-visitas/subtipos', crearSubtipo, '/api/config-visitas/subtipos', 'POST'],
        ['PATCH /api/config-visitas/subtipos/[id]', editarSubtipo, `/api/config-visitas/subtipos/${X}`, 'PATCH'],
        ['GET /api/config-visitas/cuota', cuotaDe, `/api/config-visitas/cuota?executive_id=${EJEC_1}&mes=2027-02`],
        ['GET /api/calendario', verCalendario, '/api/calendario?desde=2027-02-01&hasta=2027-02-28'],
        ['POST /api/calendario', crearDia, '/api/calendario', 'POST'],
        ['POST /api/calendario/[id]/anular', anularDia, `/api/calendario/${X}/anular`, 'POST'],
        ['POST /api/calendario/festivos', cargarFestivos, '/api/calendario/festivos', 'POST'],
        ['GET /api/dias-libres', listarDiasLibres, '/api/dias-libres'],
        ['POST /api/dias-libres', registrarPorOtra, '/api/dias-libres', 'POST'],
        ['POST /api/dias-libres/revisar', revisarDias, '/api/dias-libres/revisar', 'POST'],
        ['GET /api/me/dias-libres', misDiasLibres, '/api/me/dias-libres'],
        ['POST /api/me/dias-libres', registrarMio, '/api/me/dias-libres', 'POST'],
        ['POST /api/me/dias-libres/[id]/anular', anularMio, `/api/me/dias-libres/${X}/anular`, 'POST'],
        ['GET /api/me/cuota', miCuota, '/api/me/cuota?mes=2027-02'],
      ]
      for (const [nombre, handler, path, method] of rutas) {
        const r = await pedir(handler, path, { method, userId: VIEWER_ID, id: X, body: method ? {} : undefined })
        check(`viewer → 403 en ${nombre}`, r.status === 403, r)
      }
      check('viewer no escribió nada', fake.writes().length === antes, fake.writes().slice(antes))
      const sinSesion = await pedir(verConfig, '/api/config-visitas', { userId: null })
      check('sin sesión: 401', sinSesion.status === 401, sinSesion)
      const sinSesionMe = await pedir(miCuota, '/api/me/cuota', { userId: null })
      check('sin sesión en /api/me/cuota: 401', sinSesionMe.status === 401, sinSesionMe)

      const meRutas: [string, Handler, string, string?][] = [
        ['GET /api/me/dias-libres', misDiasLibres, '/api/me/dias-libres'],
        ['POST /api/me/dias-libres', registrarMio, '/api/me/dias-libres', 'POST'],
        ['POST /api/me/dias-libres/[id]/anular', anularMio, `/api/me/dias-libres/${X}/anular`, 'POST'],
        ['GET /api/me/cuota', miCuota, '/api/me/cuota?mes=2027-02'],
      ]
      for (const [nombre, handler, path, method] of meRutas) {
        const r = await pedir(handler, path, { method, userId: DIRECTORA_ID, id: X, body: method ? diaLibre('2027-02-10') : undefined })
        check(`usuario sin ejecutiva enlazada → 403 "${MENSAJE_SIN_EJECUTIVA}" en ${nombre}`, r.status === 403 && r.body?.error === MENSAJE_SIN_EJECUTIVA, r)
      }
      const rrhhMe = await pedir(miCuota, '/api/me/cuota', { userId: RRHH_ID })
      check('recursos humanos no tiene visits:report → 403 en /api/me/cuota', rrhhMe.status === 403, rrhhMe)
      const rrhhConfig = await pedir(verConfig, '/api/config-visitas', { userId: RRHH_ID })
      check('recursos humanos no ve la configuración (403)', rrhhConfig.status === 403, rrhhConfig)
      const liderConfig = await pedir(verConfig, '/api/config-visitas', { userId: LIDER_ID })
      check('líder de línea no ve la configuración (403)', liderConfig.status === 403, liderConfig)
      const liderFestivos = await pedir(cargarFestivos, '/api/calendario/festivos', { method: 'POST', userId: LIDER_ID, body: { anio: 2027 } })
      check('líder de línea no carga festivos (403)', liderFestivos.status === 403, liderFestivos)
      const ventasCalendario = await pedir(verCalendario, '/api/calendario?desde=2027-02-01&hasta=2027-02-28', { userId: VENTAS_ID })
      check('la ejecutiva (visits:report) sí ve el calendario', ventasCalendario.status === 200, ventasCalendario)
    }

    print('\n2. Configuración: lectura y vista previa (sin escrituras)')
    {
      const r = await pedir(verConfig, '/api/config-visitas', { userId: DIRECTORA_ID })
      check(
        'GET: semillas (2 metas, 5 conteos, 9 parámetros), 5 subtipos, 3 zonas y 3 Ejecutivos Comerciales; hoy en Bogotá',
        r.status === 200 &&
          r.body.hoy === '2027-02-01' &&
          r.body.metas.length === 2 &&
          r.body.conteo.length === 5 &&
          r.body.general.length === 9 &&
          r.body.subtipos.length === 5 &&
          r.body.zonas.length === 3 &&
          r.body.ejecutivas.length === 3,
        r.body
      )
      const textoZonas = JSON.stringify([r.body.zonas, r.body.ejecutivas])
      check('las zonas salen sin "KAM" y con su municipio (Chapinero → 11001)', !/KAM/.test(textoZonas) && r.body.zonas.some((z: any) => z.nombre === 'Chapinero' && z.municipio === '11001'), r.body.zonas)

      const antes = fake.writes().length
      const previa = await pedir(vistaPrevia, '/api/config-visitas/vista-previa', {
        method: 'POST',
        userId: DIRECTORA_ID,
        body: cambio('config_metas', metaValores({ cantidad: 7 }), '2027-02-01'),
      })
      check(
        'vista previa: subir la meta médica general corta la semilla al 31 de enero, sin anular ni continuar',
        previa.status === 200 &&
          previa.body.plan.error === null &&
          previa.body.plan.cortar.length === 1 &&
          previa.body.plan.cortar[0].id === SEMILLA_MEDICA &&
          previa.body.plan.cortar[0].vigente_hasta === '2027-01-31' &&
          previa.body.plan.anular.length === 0 &&
          previa.body.plan.continuar.length === 0 &&
          previa.body.plan.hastaEfectivo === null &&
          previa.body.meses_recalculados.length === 0,
        previa.body
      )
      const pasadoSinClave = await pedir(vistaPrevia, '/api/config-visitas/vista-previa', {
        method: 'POST',
        userId: DIRECTORA_ID,
        body: cambio('config_metas', metaValores({ cantidad: 7 }), '2026-12-15'),
      })
      check(
        'vista previa del pasado sin la clave "motivo": requiere motivo, sin error, y lista los meses 2026-12 a 2027-02',
        pasadoSinClave.status === 200 &&
          pasadoSinClave.body.plan.requiereMotivo === true &&
          pasadoSinClave.body.plan.error === null &&
          pasadoSinClave.body.meses_recalculados.join(',') === '2026-12,2027-01,2027-02',
        pasadoSinClave.body
      )
      const pasadoMotivoVacio = await pedir(vistaPrevia, '/api/config-visitas/vista-previa', {
        method: 'POST',
        userId: DIRECTORA_ID,
        body: cambio('config_metas', metaValores({ cantidad: 7 }), '2026-12-15', { motivo: '' }),
      })
      check(
        `vista previa del pasado con motivo vacío: error "${MENSAJE_MOTIVO_PASADO}"`,
        pasadoMotivoVacio.status === 200 && pasadoMotivoVacio.body.plan.error === MENSAJE_MOTIVO_PASADO,
        pasadoMotivoVacio.body
      )
      const invalida = await pedir(vistaPrevia, '/api/config-visitas/vista-previa', {
        method: 'POST',
        userId: DIRECTORA_ID,
        body: cambio('config_metas', metaValores({ cantidad: 500 }), '2027-02-01'),
      })
      check('vista previa con una meta de 500 → 400 en español', invalida.status === 400 && /entre 0 y 100/.test(invalida.body?.error ?? ''), invalida)
      check('la vista previa no escribió nada (ni RPC)', fake.writes().length === antes, fake.writes().slice(antes))
      const semillaMedica = porId('config_metas', SEMILLA_MEDICA)
      check('la semilla médica sigue abierta', semillaMedica?.vigente_hasta === null && !semillaMedica?.anulado_at, semillaMedica)
    }

    print('\n3. Configuración: cambios (todo por config_registrar / config_cerrar)')
    {
      const zona = await pedir(registrarCambio, '/api/config-visitas/cambios', {
        method: 'POST',
        userId: DIRECTORA_ID,
        body: cambio('config_metas', metaValores({ scope: 'zona', kam_id: KAM_BGA, cantidad: 6 }), '2027-02-01'),
      })
      check('meta médica de la zona Bucaramanga 6 al día desde hoy → 201 sin meses recalculados', zona.status === 201 && zona.body.meses_recalculados.length === 0, zona)
      const filaZona = porId('config_metas', zona.body?.id)
      check('la fila quedó con su clave, quién la puso y abierta', filaZona?.clave === `zona:${KAM_BGA}:medica:-` && filaZona?.set_by === DIRECTORA_ID && filaZona?.vigente_hasta === null, filaZona)
      const excepcion = await pedir(registrarCambio, '/api/config-visitas/cambios', {
        method: 'POST',
        userId: DIRECTORA_ID,
        body: cambio('config_metas', metaValores({ scope: 'ejecutiva', executive_id: EJEC_1, cantidad: 4 }), '2027-02-01'),
      })
      check('excepción de 4 al día para Ana → 201', excepcion.status === 201, excepcion)

      const clavesAntes = tablas.config_metas.length
      const pasadoSinMotivo = await pedir(registrarCambio, '/api/config-visitas/cambios', {
        method: 'POST',
        userId: DIRECTORA_ID,
        body: cambio('config_metas', metaValores({ scope: 'zona', kam_id: KAM_CHAPINERO, tipo: 'institucional', cantidad: 2 }), '2026-12-01'),
      })
      check(
        `cambiar el pasado sin motivo → 400 "${MENSAJE_MOTIVO_PASADO}" y nada guardado`,
        pasadoSinMotivo.status === 400 && pasadoSinMotivo.body?.error === MENSAJE_MOTIVO_PASADO && tablas.config_metas.length === clavesAntes,
        pasadoSinMotivo
      )
      const pasadoConMotivo = await pedir(registrarCambio, '/api/config-visitas/cambios', {
        method: 'POST',
        userId: DIRECTORA_ID,
        body: cambio('config_metas', metaValores({ scope: 'zona', kam_id: KAM_CHAPINERO, tipo: 'institucional', cantidad: 2 }), '2026-12-01', {
          motivo: 'Meta acordada en diciembre con la zona',
        }),
      })
      check(
        'con motivo → 201 y meses recalculados 2026-12, 2027-01 y 2027-02',
        pasadoConMotivo.status === 201 && pasadoConMotivo.body.meses_recalculados.join(',') === '2026-12,2027-01,2027-02',
        pasadoConMotivo
      )
      check('la corrección del pasado guardó su motivo', porId('config_metas', pasadoConMotivo.body?.id)?.motivo === 'Meta acordada en diciembre con la zona', porId('config_metas', pasadoConMotivo.body?.id))

      // Un valor futuro y un rango que se superpone con él
      const futuro = await pedir(registrarCambio, '/api/config-visitas/cambios', {
        method: 'POST',
        userId: DIRECTORA_ID,
        body: cambio('config_metas', metaValores({ tipo: 'institucional', cantidad: 1 }), '2027-03-01'),
      })
      check(
        'meta institucional general programada desde el 1 de marzo → 201; la semilla queda cortada al 28 de febrero',
        futuro.status === 201 && porId('config_metas', SEMILLA_INSTITUCIONAL)?.vigente_hasta === '2027-02-28',
        { futuro, semilla: porId('config_metas', SEMILLA_INSTITUCIONAL) }
      )
      const instantanea = JSON.stringify(tablas.config_metas)
      const choque = await pedir(registrarCambio, '/api/config-visitas/cambios', {
        method: 'POST',
        userId: DIRECTORA_ID,
        body: cambio('config_metas', metaValores({ tipo: 'institucional', cantidad: 3 }), '2027-02-15', { hasta: '2027-03-10' }),
      })
      check(
        'un rango que se superpone con un valor futuro → 409 "El rango se superpone con un valor que empieza el 2027-03-01"',
        choque.status === 409 && choque.body?.error === 'El rango se superpone con un valor que empieza el 2027-03-01',
        choque
      )
      check('el cambio rechazado no dejó cortes ni filas nuevas', JSON.stringify(tablas.config_metas) === instantanea)

      // Compras peso 1 hasta el 31 de octubre y 0,5 desde el 1 de noviembre: octubre no cambia
      const compras = SUBTIPO_ID.compras
      const comprasSinMotivo = await pedir(registrarCambio, '/api/config-visitas/cambios', {
        method: 'POST',
        userId: DIRECTORA_ID,
        body: cambio('config_conteo', { subtipo_id: compras, modo: 'suma_institucional', peso: '0,5' }, '2026-11-01'),
      })
      check('Compras con peso 0,5 desde noviembre (pasado) sin motivo → 400', comprasSinMotivo.status === 400 && comprasSinMotivo.body?.error === MENSAJE_MOTIVO_PASADO, comprasSinMotivo)
      const comprasConMotivo = await pedir(registrarCambio, '/api/config-visitas/cambios', {
        method: 'POST',
        userId: DIRECTORA_ID,
        body: cambio('config_conteo', { subtipo_id: compras, modo: 'suma_institucional', peso: '0,5' }, '2026-11-01', {
          motivo: 'Compras pesa la mitad desde noviembre',
        }),
      })
      const filasCompras = activasDe('config_conteo', compras) as unknown as ConteoVigencia[]
      const valor = (fecha: string) => valorVisita({ conteo: filasCompras, fecha, tipo: 'institucional', subtipoId: compras })
      check(
        'con motivo → 201: la semilla queda hasta el 31 de octubre; octubre suma 1 y noviembre 0,5',
        comprasConMotivo.status === 201 &&
          filasCompras.length === 2 &&
          filasCompras.some(f => f.vigente_desde === CONFIG_VIGENTE_DESDE && f.vigente_hasta === '2026-10-31' && f.peso === 1) &&
          valor('2026-10-20').peso === 1 &&
          valor('2026-11-05').peso === 0.5 &&
          valor('2026-11-05').meta === 'institucional',
        { comprasConMotivo, filasCompras }
      )
      check('meses recalculados del cambio de Compras: 2026-11 a 2027-02', comprasConMotivo.body?.meses_recalculados?.join(',') === '2026-11,2026-12,2027-01,2027-02', comprasConMotivo.body)

      // Programación con meta propia (semanal) desde hoy
      const programacion = SUBTIPO_ID.programacion
      const metaPropia = await pedir(registrarCambio, '/api/config-visitas/cambios', {
        method: 'POST',
        userId: DIRECTORA_ID,
        body: cambio('config_conteo', { subtipo_id: programacion, modo: 'meta_propia', peso: 1 }, '2027-02-01'),
      })
      const metaProgramacion = await pedir(registrarCambio, '/api/config-visitas/cambios', {
        method: 'POST',
        userId: DIRECTORA_ID,
        body: cambio('config_metas', metaValores({ tipo: 'institucional', subtipo_id: programacion, periodo: 'semana', cantidad: '2,5' }), '2027-02-01'),
      })
      check('Programación pasa a meta propia y tiene meta general de 2,5 a la semana → 201 y 201', metaPropia.status === 201 && metaProgramacion.status === 201, [metaPropia, metaProgramacion])

      const plazoMalo = await pedir(registrarCambio, '/api/config-visitas/cambios', {
        method: 'POST',
        userId: DIRECTORA_ID,
        body: cambio('config_general', { parametro: 'plazo_gracia_horas', valor: 1000 }, '2027-02-01'),
      })
      check(
        'plazo de gracia de 1000 horas → 400 "El plazo de gracia es un número entero de horas entre 0 y 720"',
        plazoMalo.status === 400 && plazoMalo.body?.error === 'El plazo de gracia es un número entero de horas entre 0 y 720',
        plazoMalo
      )
      const semanaMala = await pedir(registrarCambio, '/api/config-visitas/cambios', {
        method: 'POST',
        userId: DIRECTORA_ID,
        body: cambio('config_general', { parametro: 'dias_habiles_semana', valor: { '1': 1, '2': 1, '3': 1, '4': 1, '5': 2, '6': 0, '7': 0 } }, '2027-02-01'),
      })
      check('días hábiles de la semana con un 2 → 400 en español', semanaMala.status === 400 && /0, 0,5 o 1/.test(semanaMala.body?.error ?? ''), semanaMala)
      const zonaInexistente = await pedir(registrarCambio, '/api/config-visitas/cambios', {
        method: 'POST',
        userId: DIRECTORA_ID,
        body: cambio('config_metas', metaValores({ scope: 'zona', kam_id: '12345678-1234-4234-8234-123456789012' }), '2027-02-01'),
      })
      check('meta de una zona que no existe → 400 "La zona elegida no existe"', zonaInexistente.status === 400 && zonaInexistente.body?.error === 'La zona elegida no existe', zonaInexistente)
      const hastaAntes = await pedir(registrarCambio, '/api/config-visitas/cambios', {
        method: 'POST',
        userId: DIRECTORA_ID,
        body: cambio('config_metas', metaValores({ cantidad: 5 }), '2027-02-10', { hasta: '2027-02-05' }),
      })
      check('"hasta" antes de "Rige desde" → 400', hastaAntes.status === 400, hastaAntes)

      const perfil = await pedir(registrarCambio, '/api/config-visitas/cambios', {
        method: 'POST',
        userId: DIRECTORA_ID,
        body: cambio('config_personas', { executive_id: EJEC_2, perfil: ['institucional'] }, '2027-02-01'),
      })
      check('Berta pasa a perfil solo institucional desde hoy → 201', perfil.status === 201 && tablas.config_personas.length === 1 && tablas.config_personas[0].telefonica_habilitada === false, perfil)

      // Cerrar
      const anularFuturo = await pedir(cerrarValor, '/api/config-visitas/cerrar', {
        method: 'POST',
        userId: DIRECTORA_ID,
        body: { tabla: 'config_metas', id: futuro.body.id, hasta: '2027-02-20' },
      })
      const filaFuturo = porId('config_metas', futuro.body.id)
      check(
        'cerrar el valor futuro con "hasta" antes de su inicio lo anula (200, accion anular)',
        anularFuturo.status === 200 && anularFuturo.body.accion === 'anular' && Boolean(filaFuturo?.anulado_at) && filaFuturo?.anulado_por === DIRECTORA_ID,
        { anularFuturo, filaFuturo }
      )
      const semillaInstitucional = porId('config_metas', SEMILLA_INSTITUCIONAL)
      check(
        'cancelar el valor programado devuelve el anterior: la semilla institucional (cortada al 28 de febrero) vuelve a quedar abierta',
        futuro.body?.id && porId('config_metas', futuro.body.id)?.anterior_id === SEMILLA_INSTITUCIONAL && semillaInstitucional?.vigente_hasta === null && !semillaInstitucional?.anulado_at,
        { semillaInstitucional, futuro: porId('config_metas', futuro.body?.id) }
      )
      check(
        '…la respuesta dice qué vuelve a regir (extender la semilla desde el 1 de marzo, sin fin)',
        JSON.stringify(anularFuturo.body?.restaura) === JSON.stringify({ deId: SEMILLA_INSTITUCIONAL, accion: 'extender', desde: '2027-03-01', hasta: null }),
        anularFuturo.body
      )
      const semillaRadio = tablas.config_general.find(fila => fila.parametro === 'radio_presencial_m')
      const radio700 = await pedir(registrarCambio, '/api/config-visitas/cambios', {
        method: 'POST',
        userId: DIRECTORA_ID,
        body: cambio('config_general', { parametro: 'radio_presencial_m', valor: 700 }, '2027-02-10'),
      })
      const acortar = await pedir(cerrarValor, '/api/config-visitas/cerrar', {
        method: 'POST',
        userId: DIRECTORA_ID,
        body: { tabla: 'config_general', id: radio700.body?.id, hasta: '2027-02-20' },
      })
      const filasRadio = activasDe('config_general', 'radio_presencial_m').sort((a, b) => (a.vigente_desde < b.vigente_desde ? -1 : 1))
      check(
        'acortar un valor programado (radio 700 del 10 al 20 de febrero): desde el 21 vuelve a regir la semilla de 500 (copia), sin hueco',
        radio700.status === 201 &&
          acortar.status === 200 &&
          acortar.body?.accion === 'cerrar' &&
          acortar.body?.restaura?.accion === 'copiar' &&
          acortar.body?.restaura?.deId === semillaRadio?.id &&
          filasRadio.length === 3 &&
          filasRadio[0].vigente_hasta === '2027-02-09' &&
          filasRadio[1].valor === 700 &&
          filasRadio[1].vigente_hasta === '2027-02-20' &&
          filasRadio[2].valor === 500 &&
          filasRadio[2].vigente_desde === '2027-02-21' &&
          filasRadio[2].vigente_hasta === null &&
          filasRadio[2].motivo === MOTIVO_VUELVE_ANTERIOR &&
          filasRadio[2].set_by === DIRECTORA_ID,
        { acortar: acortar.body, filasRadio }
      )
      const otraVez = await pedir(cerrarValor, '/api/config-visitas/cerrar', {
        method: 'POST',
        userId: DIRECTORA_ID,
        body: { tabla: 'config_metas', id: futuro.body.id, hasta: '2027-02-20' },
      })
      check(`cerrar un valor ya anulado → 409 "${MENSAJE_VALOR_ANULADO}"`, otraVez.status === 409 && otraVez.body?.error === MENSAJE_VALOR_ANULADO, otraVez)
      const noExiste = await pedir(cerrarValor, '/api/config-visitas/cerrar', {
        method: 'POST',
        userId: DIRECTORA_ID,
        body: { tabla: 'config_metas', id: '12345678-1234-4234-8234-123456789012', hasta: '2027-02-20' },
      })
      check(`cerrar un valor que no existe → 404 "${MENSAJE_VALOR_NO_EXISTE}"`, noExiste.status === 404 && noExiste.body?.error === MENSAJE_VALOR_NO_EXISTE, noExiste)
      const cierrePasado = await pedir(cerrarValor, '/api/config-visitas/cerrar', {
        method: 'POST',
        userId: DIRECTORA_ID,
        body: { tabla: 'config_metas', id: pasadoConMotivo.body.id, hasta: '2027-01-15' },
      })
      check(
        `cerrar en el pasado sin motivo → 400 "${MENSAJE_MOTIVO_CIERRE_PASADO}" (y la fila sigue abierta)`,
        cierrePasado.status === 400 && cierrePasado.body?.error === MENSAJE_MOTIVO_CIERRE_PASADO && porId('config_metas', pasadoConMotivo.body.id)?.vigente_hasta === null,
        cierrePasado
      )

      const general = await pedir(verConfig, '/api/config-visitas', { userId: DIRECTORA_ID })
      const filaConNombre = general.body.metas.find((fila: any) => fila.id === zona.body.id)
      const anuladaConNombre = general.body.metas.find((fila: any) => fila.id === futuro.body.id)
      check(
        'GET trae set_by_nombre y anulado_por_nombre, con las anuladas',
        filaConNombre?.set_by_nombre === 'Directora' && anuladaConNombre?.anulado_por_nombre === 'Directora',
        { filaConNombre, anuladaConNombre }
      )
    }

    print('\n4. Subtipos')
    {
      const nuevo = await pedir(crearSubtipo, '/api/config-visitas/subtipos', {
        method: 'POST',
        userId: DIRECTORA_ID,
        body: {
          codigo: 'auditoria',
          nombre: 'Auditoría médica',
          para_que: 'Que auditoría apruebe el uso del producto',
          roles_sugeridos: ['auditoria_medica'],
          orden: 6,
          vigente_desde: '2027-02-01',
        },
      })
      const conteoNuevo = tablas.config_conteo.filter(fila => fila.subtipo_id === nuevo.body?.subtipo?.id)
      check(
        'crear subtipo → 201 y su conteo inicial "solo seguimiento" peso 1 desde la misma fecha (por config_registrar)',
        nuevo.status === 201 &&
          conteoNuevo.length === 1 &&
          conteoNuevo[0].modo === 'seguimiento' &&
          conteoNuevo[0].peso === 1 &&
          conteoNuevo[0].vigente_desde === '2027-02-01' &&
          conteoNuevo[0].vigente_hasta === null &&
          conteoNuevo[0].id === nuevo.body.conteo_id &&
          fake.rpcs.some(rpc => rpc.nombre === 'config_registrar' && rpc.args.p_tabla === 'config_conteo' && rpc.args.p_valores?.subtipo_id === nuevo.body.subtipo.id),
        { nuevo, conteoNuevo }
      )
      const repetido = await pedir(crearSubtipo, '/api/config-visitas/subtipos', {
        method: 'POST',
        userId: DIRECTORA_ID,
        body: { codigo: 'auditoria', nombre: 'Otra', para_que: 'Otra cosa', orden: 7, vigente_desde: '2027-02-01' },
      })
      check('código repetido → 409', repetido.status === 409 && /auditoria/.test(repetido.body?.error ?? ''), repetido)
      const pasado = await pedir(crearSubtipo, '/api/config-visitas/subtipos', {
        method: 'POST',
        userId: DIRECTORA_ID,
        body: { codigo: 'cartera', nombre: 'Cartera', para_que: 'Que paguen a tiempo', orden: 8, vigente_desde: '2027-01-15' },
      })
      const conteoPasado = tablas.config_conteo.find(fila => fila.subtipo_id === pasado.body?.subtipo?.id)
      check('un subtipo que empieza en el pasado también nace con su conteo (con motivo automático)', pasado.status === 201 && Boolean(conteoPasado?.motivo), { pasado, conteoPasado })
      const apagarAntes = await pedir(editarSubtipo, `/api/config-visitas/subtipos/${nuevo.body.subtipo.id}`, {
        method: 'PATCH',
        userId: DIRECTORA_ID,
        id: nuevo.body.subtipo.id,
        body: { vigente_hasta: '2027-01-01' },
      })
      check('apagar antes de su inicio → 400', apagarAntes.status === 400, apagarAntes)
      const apagar = await pedir(editarSubtipo, `/api/config-visitas/subtipos/${nuevo.body.subtipo.id}`, {
        method: 'PATCH',
        userId: DIRECTORA_ID,
        id: nuevo.body.subtipo.id,
        body: { vigente_hasta: '2027-12-31', nombre: 'Auditoría' },
      })
      check(
        'apagar y renombrar → 200 (nunca se borra)',
        apagar.status === 200 && apagar.body.subtipo.vigente_hasta === '2027-12-31' && apagar.body.subtipo.nombre === 'Auditoría' && tablas.subtipos_institucionales.length === 7,
        apagar
      )
      const sinCambios = await pedir(editarSubtipo, `/api/config-visitas/subtipos/${nuevo.body.subtipo.id}`, { method: 'PATCH', userId: DIRECTORA_ID, id: nuevo.body.subtipo.id, body: {} })
      check('PATCH sin campos → 400', sinCambios.status === 400, sinCambios)
      const inexistente = await pedir(editarSubtipo, '/api/config-visitas/subtipos/x', {
        method: 'PATCH',
        userId: DIRECTORA_ID,
        id: '12345678-1234-4234-8234-123456789012',
        body: { orden: 3 },
      })
      check('PATCH de un subtipo que no existe → 404', inexistente.status === 404, inexistente)
    }

    print('\n5. Calendario')
    {
      const festivos = await pedir(cargarFestivos, '/api/calendario/festivos', { method: 'POST', userId: RRHH_ID, body: { anio: 2027 } })
      const nacionales2027 = tablas.calendario.filter(dia => dia.alcance === 'nacional' && String(dia.fecha).startsWith('2027-'))
      check(
        'recursos humanos carga los festivos de 2027 → { insertados: 18 } (nacionales, calculados)',
        festivos.status === 200 && festivos.body.insertados === 18 && nacionales2027.length === 18 && nacionales2027.every(dia => dia.origen === 'calculado'),
        festivos
      )
      const otraVez = await pedir(cargarFestivos, '/api/calendario/festivos', { method: 'POST', userId: RRHH_ID, body: { anio: 2027 } })
      check('cargarlos otra vez → { insertados: 0 }', otraVez.status === 200 && otraVez.body.insertados === 0, otraVez)
      const anioMalo = await pedir(cargarFestivos, '/api/calendario/festivos', { method: 'POST', userId: RRHH_ID, body: { anio: 1999 } })
      check('año fuera de 2020..2100 → 400', anioMalo.status === 400, anioMalo)

      const empresa = await pedir(crearDia, '/api/calendario', {
        method: 'POST',
        userId: RRHH_ID,
        body: { fecha: '2027-03-05', alcance: 'empresa', tipo: 'no_habil', nombre: 'Día de la familia' },
      })
      check('día de empresa → 201 (origen manual, sin ciudad)', empresa.status === 201 && empresa.body.dia.origen === 'manual' && empresa.body.dia.ciudad === null, empresa)
      const repetido = await pedir(crearDia, '/api/calendario', {
        method: 'POST',
        userId: RRHH_ID,
        body: { fecha: '2027-03-05', alcance: 'empresa', tipo: 'habil', nombre: 'Otro' },
      })
      check('otro día de empresa activo la misma fecha → 409', repetido.status === 409, repetido)
      const sinCiudad = await pedir(crearDia, '/api/calendario', {
        method: 'POST',
        userId: RRHH_ID,
        body: { fecha: '2027-02-19', alcance: 'ciudad', tipo: 'no_habil', nombre: 'Festivo local' },
      })
      check('día de ciudad sin ciudad → 400 "Elige la ciudad del día"', sinCiudad.status === 400 && sinCiudad.body?.error === 'Elige la ciudad del día', sinCiudad)
      const ciudadMala = await pedir(crearDia, '/api/calendario', {
        method: 'POST',
        userId: RRHH_ID,
        body: { fecha: '2027-02-19', alcance: 'ciudad', municipality_id: '99999', tipo: 'no_habil', nombre: 'Festivo local' },
      })
      check('ciudad que no existe → 400', ciudadMala.status === 400 && ciudadMala.body?.error === 'El municipio elegido no existe', ciudadMala)
      const bogota = await pedir(crearDia, '/api/calendario', {
        method: 'POST',
        userId: RRHH_ID,
        body: { fecha: '2027-02-19', alcance: 'ciudad', municipality_id: '11001', tipo: 'no_habil', nombre: 'Festivo local de prueba' },
      })
      check('día no hábil de Bogotá el viernes 19 de febrero → 201 con su ciudad', bogota.status === 201 && bogota.body.dia.ciudad === 'Bogotá D.C.', bogota)

      const sinMotivo = await pedir(anularDia, `/api/calendario/${empresa.body.dia.id}/anular`, { method: 'POST', userId: RRHH_ID, id: empresa.body.dia.id, body: {} })
      check('anular un día del calendario sin motivo → 400', sinMotivo.status === 400 && /motivo/.test(sinMotivo.body?.error ?? ''), sinMotivo)
      const corto = await pedir(anularDia, `/api/calendario/${empresa.body.dia.id}/anular`, { method: 'POST', userId: RRHH_ID, id: empresa.body.dia.id, body: { motivo: 'no' } })
      check('anular con un motivo de 2 letras → 400', corto.status === 400, corto)
      const anulado = await pedir(anularDia, `/api/calendario/${empresa.body.dia.id}/anular`, {
        method: 'POST',
        userId: RRHH_ID,
        id: empresa.body.dia.id,
        body: { motivo: 'Se trabaja ese día' },
      })
      const filaAnulada = porId('calendario', empresa.body.dia.id)
      check(
        'con motivo → 200; la fila queda anulada con quién y por qué (no se borra)',
        anulado.status === 200 && Boolean(anulado.body.dia.anulado_at) && filaAnulada?.anulado_por === RRHH_ID && filaAnulada?.anulado_motivo === 'Se trabaja ese día',
        anulado
      )
      const dosVeces = await pedir(anularDia, `/api/calendario/${empresa.body.dia.id}/anular`, { method: 'POST', userId: RRHH_ID, id: empresa.body.dia.id, body: { motivo: 'Otra vez' } })
      check('anularlo otra vez → 409', dosVeces.status === 409, dosVeces)
      const noExiste = await pedir(anularDia, '/api/calendario/x/anular', { method: 'POST', userId: RRHH_ID, id: '12345678-1234-4234-8234-123456789012', body: { motivo: 'No existe' } })
      check('anular un día que no existe → 404', noExiste.status === 404, noExiste)

      const comoLider = await pedir(verCalendario, '/api/calendario?desde=2027-02-01&hasta=2027-03-31', { userId: LIDER_ID })
      const fechasLider = comoLider.body.dias.map((dia: any) => dia.fecha)
      check(
        'el líder ve festivos y el día de Bogotá, pero no el día anulado',
        comoLider.status === 200 &&
          fechasLider.includes('2027-02-19') &&
          fechasLider.includes('2027-03-22') &&
          !comoLider.body.dias.some((dia: any) => dia.id === empresa.body.dia.id),
        comoLider.body
      )
      const comoRrhh = await pedir(verCalendario, '/api/calendario?desde=2027-02-01&hasta=2027-03-31', { userId: RRHH_ID })
      check('recursos humanos (calendar:manage) sí ve el anulado', comoRrhh.body.dias.some((dia: any) => dia.id === empresa.body.dia.id && dia.anulado_at), comoRrhh.body)
      const soloBga = await pedir(verCalendario, '/api/calendario?desde=2027-02-01&hasta=2027-03-31&municipio=68001', { userId: RRHH_ID })
      check(
        'con municipio=68001 no sale el día de Bogotá (sí los nacionales)',
        soloBga.status === 200 && !soloBga.body.dias.some((dia: any) => dia.fecha === '2027-02-19') && soloBga.body.dias.some((dia: any) => dia.fecha === '2027-03-25'),
        soloBga.body
      )
      const largo = await pedir(verCalendario, '/api/calendario?desde=2027-01-01&hasta=2028-03-01', { userId: RRHH_ID })
      check('más de 400 días → 400', largo.status === 400 && /400 días/.test(largo.body?.error ?? ''), largo)
    }

    print('\n6. Días libres: la ejecutiva registra los suyos (lunes 1 de febrero, 09:00)')
    let feb3 = ''
    let feb19 = ''
    let feb24Lider = ''
    {
      const r = await pedir(registrarMio, '/api/me/dias-libres', { method: 'POST', userId: VENTAS_ID, body: diaLibre('2027-02-03') })
      feb3 = r.body?.dia?.id
      check(
        'dentro del plazo → 201 "por aprobar" (se exige aprobación), registrado por ella',
        r.status === 201 && r.body.dia.estado === 'por_aprobar' && r.body.dia.registrado_por_nombre === 'Ventas' && r.body.dia.motivo_nombre === 'Vacaciones' && r.body.dia.zona === 'Bucaramanga',
        r
      )
      const repetido = await pedir(registrarMio, '/api/me/dias-libres', { method: 'POST', userId: VENTAS_ID, body: diaLibre('2027-02-03', { fraccion: 0.5 }) })
      check('el mismo día otra vez → 409', repetido.status === 409, repetido)
      const sabado = await pedir(registrarMio, '/api/me/dias-libres', { method: 'POST', userId: VENTAS_ID, body: diaLibre('2027-02-06') })
      check(`un sábado → 400 "${MENSAJE_DIA_NO_HABIL}"`, sabado.status === 400 && sabado.body?.error === MENSAJE_DIA_NO_HABIL, sabado)
      const festivo = await pedir(registrarMio, '/api/me/dias-libres', { method: 'POST', userId: VENTAS_ID, body: diaLibre('2027-03-22') })
      check('un festivo nacional (22 de marzo) → 400 no hábil', festivo.status === 400 && festivo.body?.error === MENSAJE_DIA_NO_HABIL, festivo)
      const motivoMalo = await pedir(registrarMio, '/api/me/dias-libres', { method: 'POST', userId: VENTAS_ID, body: diaLibre('2027-02-04', { motivo: 'paseo' }) })
      check('motivo que no está en la lista vigente → 400', motivoMalo.status === 400 && /lista vigente/.test(motivoMalo.body?.error ?? ''), motivoMalo)
      const tarde = await pedir(registrarMio, '/api/me/dias-libres', { method: 'POST', userId: VENTAS_ID, body: diaLibre('2027-01-28') })
      check(
        'fuera del plazo (jueves 28 de enero) → 400 con la fecha límite "2027-01-29 a las 23:59"',
        tarde.status === 400 && /Ya pasó el plazo/.test(tarde.body?.error ?? '') && (tarde.body?.error ?? '').includes('2027-01-29 a las 23:59'),
        tarde
      )
      const otraCiudad = await pedir(registrarMio, '/api/me/dias-libres', { method: 'POST', userId: VENTAS_ID, body: diaLibre('2027-02-19', { fraccion: '0,5', motivo: 'cita_medica' }) })
      feb19 = otraCiudad.body?.dia?.id
      check(
        'el día no hábil de Bogotá SÍ es hábil para Ana (Bucaramanga): medio día → 201',
        otraCiudad.status === 201 && otraCiudad.body.dia.fraccion === 0.5,
        otraCiudad
      )
      const liderBogota = await pedir(registrarMio, '/api/me/dias-libres', { method: 'POST', userId: LIDER_ID, body: diaLibre('2027-02-19') })
      check(
        'para Carla (zona Usaquén, celda 1100101 → Bogotá 11001) el 19 no es hábil → 400',
        liderBogota.status === 400 && liderBogota.body?.error === MENSAJE_DIA_NO_HABIL,
        liderBogota
      )
      const lider = await pedir(registrarMio, '/api/me/dias-libres', { method: 'POST', userId: LIDER_ID, body: diaLibre('2027-02-24', { nota: 'Viaje familiar' }) })
      feb24Lider = lider.body?.dia?.id
      check('la líder (también ejecutiva) registra el suyo → 201', lider.status === 201 && lider.body.dia.nota === 'Viaje familiar', lider)
      const mios = await pedir(misDiasLibres, '/api/me/dias-libres', { userId: VENTAS_ID })
      check(
        'GET /api/me/dias-libres: sus 2 días, plazo 24 h, se exige aprobación y los 8 motivos',
        mios.status === 200 &&
          mios.body.ejecutiva.id === EJEC_1 &&
          mios.body.items.length === 2 &&
          mios.body.plazo_horas === 24 &&
          mios.body.requiere_aprobacion === true &&
          mios.body.motivos.length === 8,
        mios.body
      )
    }

    print('\n7. Quien aprueba registra por otra persona')
    let ene20Berta = ''
    {
      const sinJustificacion = await pedir(registrarPorOtra, '/api/dias-libres', {
        method: 'POST',
        userId: DIRECTORA_ID,
        body: { ...diaLibre('2027-01-20', { motivo: 'incapacidad' }), executive_id: EJEC_2 },
      })
      check('fuera de plazo sin justificación → 400 que pide la justificación', sinJustificacion.status === 400 && /justificación/.test(sinJustificacion.body?.error ?? ''), sinJustificacion)
      const tarde = await pedir(registrarPorOtra, '/api/dias-libres', {
        method: 'POST',
        userId: DIRECTORA_ID,
        body: { ...diaLibre('2027-01-20', { motivo: 'incapacidad' }), executive_id: EJEC_2, justificacion: 'La incapacidad llegó tarde' },
      })
      ene20Berta = tarde.body?.dia?.id
      check(
        'con justificación → 201 "aprobado", fuera_de_plazo, revisado por quien lo registra',
        tarde.status === 201 &&
          tarde.body.dia.estado === 'aprobado' &&
          tarde.body.dia.fuera_de_plazo === true &&
          tarde.body.dia.justificacion === 'La incapacidad llegó tarde' &&
          tarde.body.dia.revisado_por_nombre === 'Directora' &&
          tarde.body.dia.ejecutiva === 'Berta Ejecutiva',
        tarde
      )
      const repetido = await pedir(registrarPorOtra, '/api/dias-libres', {
        method: 'POST',
        userId: DIRECTORA_ID,
        body: { ...diaLibre('2027-01-20'), executive_id: EJEC_2, justificacion: 'Otra vez el mismo día' },
      })
      check('el mismo día de la misma persona → 409', repetido.status === 409, repetido)
      const ciudad = await pedir(registrarPorOtra, '/api/dias-libres', {
        method: 'POST',
        userId: DIRECTORA_ID,
        body: { ...diaLibre('2027-02-19'), executive_id: EJEC_2 },
      })
      check(
        'el día no hábil de Bogotá para Berta (Chapinero) → 400 "no es hábil en el calendario de Berta"',
        ciudad.status === 400 && ciudad.body?.error === 'Ese día no es hábil en el calendario de Berta Ejecutiva',
        ciudad
      )
      const noExiste = await pedir(registrarPorOtra, '/api/dias-libres', {
        method: 'POST',
        userId: DIRECTORA_ID,
        body: { ...diaLibre('2027-02-10'), executive_id: '12345678-1234-4234-8234-123456789012' },
      })
      check('persona que no existe → 400', noExiste.status === 400, noExiste)
      const lider = await pedir(registrarPorOtra, '/api/dias-libres', {
        method: 'POST',
        userId: LIDER_ID,
        body: { ...diaLibre('2027-02-10'), executive_id: EJEC_1 },
      })
      check('la líder no registra por otra persona (403)', lider.status === 403, lider)
    }

    print('\n8. Plazo de gracia: 24 horas rechaza 30 horas después; con 48 se permite')
    let feb1 = ''
    {
      // Miércoles 3 de febrero, 06:00 en Bogotá = 30 horas después de terminar el lunes 1
      fijarAhora('2027-02-03T11:00:00.000Z')
      const con24 = await pedir(registrarMio, '/api/me/dias-libres', { method: 'POST', userId: VENTAS_ID, body: diaLibre('2027-02-01') })
      check(
        'plazo 24 h: el lunes 1, 30 horas después → 400 (se podía hasta el 2027-02-02 a las 23:59)',
        con24.status === 400 && (con24.body?.error ?? '').includes('2027-02-02 a las 23:59'),
        con24
      )
      const plazo48 = await pedir(registrarCambio, '/api/config-visitas/cambios', {
        method: 'POST',
        userId: DIRECTORA_ID,
        body: cambio('config_general', { parametro: 'plazo_gracia_horas', valor: '48' }, '2027-02-03'),
      })
      check('la directora sube el plazo a 48 horas desde hoy → 201', plazo48.status === 201, plazo48)
      const con48 = await pedir(registrarMio, '/api/me/dias-libres', { method: 'POST', userId: VENTAS_ID, body: diaLibre('2027-02-01') })
      feb1 = con48.body?.dia?.id
      check('con 48 h (vigente hoy) → 201 "por aprobar"', con48.status === 201 && con48.body.dia.estado === 'por_aprobar', con48)
      const plazoHoy = await pedir(misDiasLibres, '/api/me/dias-libres', { userId: VENTAS_ID })
      check('GET /api/me/dias-libres ya informa plazo_horas 48', plazoHoy.body?.plazo_horas === 48, plazoHoy.body)

      // "Registrar por otra persona" (recursos humanos no lee /api/config-visitas) usa el plazo y los motivos
      // vigentes hoy que trae GET /api/dias-libres, no los de la semilla.
      const motivosNuevos = [...GENERAL_POR_DEFECTO.motivos_dia_libre, { codigo: 'licencia_luto', nombre: 'Licencia de luto' }]
      const cambioMotivos = await pedir(registrarCambio, '/api/config-visitas/cambios', {
        method: 'POST',
        userId: DIRECTORA_ID,
        body: cambio('config_general', { parametro: 'motivos_dia_libre', valor: motivosNuevos }, '2027-02-03'),
      })
      check('la directora añade el motivo "Licencia de luto" desde hoy → 201', cambioMotivos.status === 201, cambioMotivos)
      const listaRrhh = await pedir(listarDiasLibres, '/api/dias-libres', { userId: RRHH_ID })
      check(
        'GET /api/dias-libres (recursos humanos) trae el plazo 48 y los 9 motivos vigentes hoy',
        listaRrhh.status === 200 &&
          listaRrhh.body.plazo_horas === 48 &&
          Array.isArray(listaRrhh.body.motivos) &&
          listaRrhh.body.motivos.length === 9 &&
          listaRrhh.body.motivos.some((m: any) => m.codigo === 'licencia_luto' && m.nombre === 'Licencia de luto'),
        listaRrhh.body
      )
      const listaLider = await pedir(listarDiasLibres, '/api/dias-libres', { userId: LIDER_ID })
      check('…y a la líder también (solo lectura)', listaLider.status === 200 && listaLider.body.plazo_horas === 48 && listaLider.body.motivos?.length === 9, listaLider.body)
    }

    print('\n9. Aprobación en bloque (recursos humanos) y lo que ve la líder')
    {
      const comoLider = await pedir(listarDiasLibres, '/api/dias-libres', { userId: LIDER_ID })
      const personasLider = new Set(comoLider.body.items.map((item: any) => item.executive_id))
      check(
        'la líder ve solo las ejecutivas de su línea (Ana y Carla, no Berta) y no puede aprobar',
        comoLider.status === 200 &&
          personasLider.has(EJEC_1) &&
          personasLider.has(EJEC_3) &&
          !personasLider.has(EJEC_2) &&
          comoLider.body.puede_aprobar === false,
        comoLider.body
      )
      const liderBerta = await pedir(listarDiasLibres, `/api/dias-libres?executive_id=${EJEC_2}`, { userId: LIDER_ID })
      check('la líder pide los de Berta → 403', liderBerta.status === 403, liderBerta)
      const liderRevisa = await pedir(revisarDias, '/api/dias-libres/revisar', { method: 'POST', userId: LIDER_ID, body: { ids: [feb3], accion: 'aprobar' } })
      check('la líder no aprueba (403)', liderRevisa.status === 403, liderRevisa)

      const comoRrhh = await pedir(listarDiasLibres, '/api/dias-libres', { userId: RRHH_ID })
      check(
        'recursos humanos ve todos (con Berta) y puede aprobar',
        comoRrhh.status === 200 && comoRrhh.body.items.some((item: any) => item.executive_id === EJEC_2) && comoRrhh.body.puede_aprobar === true,
        comoRrhh.body
      )
      const filtrado = await pedir(listarDiasLibres, '/api/dias-libres?estado=por_aprobar&desde=2027-02-01&hasta=2027-02-28', { userId: RRHH_ID })
      check(
        'filtro por estado y mes: los 4 por aprobar de febrero',
        filtrado.status === 200 && filtrado.body.items.length === 4 && filtrado.body.items.every((item: any) => item.estado === 'por_aprobar'),
        filtrado.body
      )
      const rechazarSinMotivo = await pedir(revisarDias, '/api/dias-libres/revisar', { method: 'POST', userId: RRHH_ID, body: { ids: [feb24Lider], accion: 'rechazar' } })
      check('rechazar sin motivo → 400', rechazarSinMotivo.status === 400, rechazarSinMotivo)

      const desconocido = '12345678-1234-4234-8234-123456789012'
      const bloque = await pedir(revisarDias, '/api/dias-libres/revisar', {
        method: 'POST',
        userId: RRHH_ID,
        body: { ids: [feb3, feb1, ene20Berta, desconocido], accion: 'aprobar' },
      })
      const razonAprobado = bloque.body?.omitidos?.find((o: any) => o.id === ene20Berta)?.razon
      const razonDesconocido = bloque.body?.omitidos?.find((o: any) => o.id === desconocido)?.razon
      check(
        'aprobar en bloque: 2 actualizados; el ya aprobado y el que no existe salen en omitidos con su razón',
        bloque.status === 200 &&
          bloque.body.actualizados === 2 &&
          bloque.body.omitidos.length === 2 &&
          razonAprobado === 'Solo se aprueban días por aprobar (este está aprobado)' &&
          razonDesconocido === 'No existe ese día libre',
        bloque
      )
      const aprobados = tablas.dias_libres.filter(dia => [feb3, feb1].includes(dia.id))
      check(
        'los aprobados quedan con revisado_por recursos humanos y su fecha',
        aprobados.length === 2 && aprobados.every(dia => dia.estado === 'aprobado' && dia.revisado_por === RRHH_ID && Boolean(dia.revisado_at)),
        aprobados
      )
      const rechazo = await pedir(revisarDias, '/api/dias-libres/revisar', {
        method: 'POST',
        userId: RRHH_ID,
        body: { ids: [feb24Lider], accion: 'rechazar', motivo: 'Coincide con la reunión de línea' },
      })
      const filaRechazada = porId('dias_libres', feb24Lider)
      check(
        'rechazar con motivo → 1 actualizado, estado rechazado con su motivo',
        rechazo.status === 200 && rechazo.body.actualizados === 1 && filaRechazada?.estado === 'rechazado' && filaRechazada?.motivo_revision === 'Coincide con la reunión de línea',
        rechazo
      )

      // Solo la dirección aprueba
      const soloDirectora = await pedir(registrarCambio, '/api/config-visitas/cambios', {
        method: 'POST',
        userId: DIRECTORA_ID,
        body: cambio('config_general', { parametro: 'aprobacion_dias_libres', valor: { requiere: true, aprueban: ['commercial_director'] } }, '2027-02-03'),
      })
      check('aprobación solo de la dirección comercial desde hoy → 201', soloDirectora.status === 201, soloDirectora)
      const rrhhSinRol = await pedir(revisarDias, '/api/dias-libres/revisar', { method: 'POST', userId: RRHH_ID, body: { ids: [feb19], accion: 'aprobar' } })
      check('recursos humanos ya no está en "aprueban" → 403 al revisar', rrhhSinRol.status === 403, rrhhSinRol)
      const rrhhLista = await pedir(listarDiasLibres, '/api/dias-libres', { userId: RRHH_ID })
      check('…y su lista dice puede_aprobar false', rrhhLista.status === 200 && rrhhLista.body.puede_aprobar === false, rrhhLista.body)
      const rrhhRegistra = await pedir(registrarPorOtra, '/api/dias-libres', {
        method: 'POST',
        userId: RRHH_ID,
        body: { ...diaLibre('2027-02-10'), executive_id: EJEC_1 },
      })
      check('…ni registra por otra persona (403)', rrhhRegistra.status === 403, rrhhRegistra)
      const adminSiempre = await pedir(listarDiasLibres, '/api/dias-libres', { userId: ADMIN_ID })
      check('admin siempre puede aprobar', adminSiempre.body?.puede_aprobar === true, adminSiempre.body)

      // Sin aprobación: lo que registra la ejecutiva nace "registrado"; el cambio del mismo día anula el anterior
      const sinAprobacion = await pedir(registrarCambio, '/api/config-visitas/cambios', {
        method: 'POST',
        userId: DIRECTORA_ID,
        body: cambio('config_general', { parametro: 'aprobacion_dias_libres', valor: { requiere: false, aprueban: ['commercial_director', 'hr'] } }, '2027-02-03'),
      })
      const filasAprobacion = filasDe('config_general', 'aprobacion_dias_libres')
      check(
        'quitar la aprobación el mismo día → 201; el valor de esta mañana queda anulado como reemplazado',
        sinAprobacion.status === 201 &&
          filasAprobacion.filter(fila => !fila.anulado_at).length === 2 &&
          filasAprobacion.some(fila => fila.anulado_motivo === MOTIVO_REEMPLAZO_MISMO_DIA),
        filasAprobacion
      )
      const registrado = await pedir(registrarMio, '/api/me/dias-libres', { method: 'POST', userId: VENTAS_ID, body: diaLibre('2027-03-03') })
      check('sin aprobación, el día de la ejecutiva nace "registrado"', registrado.status === 201 && registrado.body.dia.estado === 'registrado', registrado)
      const anularRrhh = await pedir(revisarDias, '/api/dias-libres/revisar', {
        method: 'POST',
        userId: RRHH_ID,
        body: { ids: [registrado.body.dia.id], accion: 'anular', motivo: 'Lo pidió por error' },
      })
      check('recursos humanos (otra vez en "aprueban") anula un día registrado → 1 actualizado', anularRrhh.status === 200 && anularRrhh.body.actualizados === 1, anularRrhh)
    }

    print('\n9b. Quien aprueba no se registra ni se revisa sus propios días libres')
    {
      // La directora (aprueba) queda enlazada con una ejecutiva, como si también llevara una zona.
      tablas.executives.push({ id: EJEC_4, full_name: 'Dora Directora', status: 'active', user_id: DIRECTORA_ID, base_kam_id: KAM_BGA, started_at: '2025-01-01', left_at: null })
      const antes = tablas.dias_libres.length
      const tardePropio = await pedir(registrarPorOtra, '/api/dias-libres', {
        method: 'POST',
        userId: DIRECTORA_ID,
        body: { ...diaLibre('2027-01-20'), executive_id: EJEC_4, justificacion: 'Olvidé registrarlo' },
      })
      check(
        `registrarse a sí misma "por otra persona" fuera de plazo → 403 "${MENSAJE_PROPIO_POR_OTRA}" y nada guardado`,
        tardePropio.status === 403 && tardePropio.body?.error === MENSAJE_PROPIO_POR_OTRA && tablas.dias_libres.length === antes,
        tardePropio
      )
      const enPlazoPropio = await pedir(registrarPorOtra, '/api/dias-libres', {
        method: 'POST',
        userId: DIRECTORA_ID,
        body: { ...diaLibre('2027-02-15'), executive_id: EJEC_4 },
      })
      check('…ni dentro del plazo (quedaría aprobado de una vez) → 403', enPlazoPropio.status === 403 && tablas.dias_libres.length === antes, enPlazoPropio)
      const paraOtra = await pedir(registrarPorOtra, '/api/dias-libres', {
        method: 'POST',
        userId: DIRECTORA_ID,
        body: { ...diaLibre('2027-03-16'), executive_id: EJEC_2 },
      })
      check('…para otra persona sí → 201 aprobado', paraOtra.status === 201 && paraOtra.body?.dia?.estado === 'aprobado', paraOtra)

      // Días por aprobar de Dora y de Berta (como si la aprobación estuviera activa cuando se registraron)
      const nuevoDia = (id: string, executive_id: string, fecha: string) =>
        tablas.dias_libres.push({
          id,
          executive_id,
          fecha,
          fraccion: 1,
          motivo: 'vacaciones',
          nota: null,
          estado: 'por_aprobar',
          registrado_por: null,
          registrado_at: ahoraIso(),
          fuera_de_plazo: false,
          justificacion: null,
          revisado_por: null,
          revisado_at: null,
          motivo_revision: null,
          created_at: ahoraIso(),
          updated_at: ahoraIso(),
        })
      const DIA_DORA = randomUUID()
      const DIA_BERTA = randomUUID()
      nuevoDia(DIA_DORA, EJEC_4, '2027-03-09')
      nuevoDia(DIA_BERTA, EJEC_2, '2027-03-15')
      const bloque = await pedir(revisarDias, '/api/dias-libres/revisar', {
        method: 'POST',
        userId: DIRECTORA_ID,
        body: { ids: [DIA_DORA, DIA_BERTA], accion: 'aprobar' },
      })
      check(
        `aprobar en bloque con un día propio: el de Berta se aprueba; el suyo sale en omitidos ("${RAZON_DIA_PROPIO}") y sigue por aprobar`,
        bloque.status === 200 &&
          bloque.body.actualizados === 1 &&
          bloque.body.omitidos.length === 1 &&
          bloque.body.omitidos[0].id === DIA_DORA &&
          bloque.body.omitidos[0].razon === RAZON_DIA_PROPIO &&
          porId('dias_libres', DIA_DORA)?.estado === 'por_aprobar' &&
          porId('dias_libres', DIA_BERTA)?.estado === 'aprobado',
        bloque
      )
      const anularPropio = await pedir(revisarDias, '/api/dias-libres/revisar', {
        method: 'POST',
        userId: DIRECTORA_ID,
        body: { ids: [DIA_DORA], accion: 'anular', motivo: 'Ya no lo necesito' },
      })
      check(
        '…tampoco anula ni rechaza lo suyo por la revisión en bloque',
        anularPropio.status === 200 && anularPropio.body.actualizados === 0 && porId('dias_libres', DIA_DORA)?.estado === 'por_aprobar',
        anularPropio
      )
      const rrhhAprueba = await pedir(revisarDias, '/api/dias-libres/revisar', { method: 'POST', userId: RRHH_ID, body: { ids: [DIA_DORA], accion: 'aprobar' } })
      check(
        'otra persona que aprueba (recursos humanos) sí aprueba el día de la directora',
        rrhhAprueba.status === 200 && rrhhAprueba.body.actualizados === 1 && porId('dias_libres', DIA_DORA)?.revisado_por === RRHH_ID,
        rrhhAprueba
      )
      const dora = tablas.executives.find(e => e.id === EJEC_4)
      if (dora) dora.user_id = null // la directora vuelve a quedar sin ejecutiva enlazada
    }

    print('\n10. La ejecutiva anula lo suyo')
    {
      const nuevo = await pedir(registrarMio, '/api/me/dias-libres', { method: 'POST', userId: VENTAS_ID, body: diaLibre('2027-03-08') })
      const anular = await pedir(anularMio, `/api/me/dias-libres/${nuevo.body?.dia?.id}/anular`, { method: 'POST', userId: VENTAS_ID, id: nuevo.body?.dia?.id })
      check(
        `anular su día futuro → 200 "anulado" con motivo "${MOTIVO_ANULADO_POR_EJECUTIVA}"`,
        anular.status === 200 && anular.body.dia.estado === 'anulado' && anular.body.dia.motivo_revision === MOTIVO_ANULADO_POR_EJECUTIVA,
        anular
      )
      const otraVez = await pedir(anularMio, `/api/me/dias-libres/${nuevo.body.dia.id}/anular`, { method: 'POST', userId: VENTAS_ID, id: nuevo.body.dia.id })
      check('anularlo otra vez → 409', otraVez.status === 409, otraVez)
      const pasadoAprobado = await pedir(anularMio, `/api/me/dias-libres/${feb1}/anular`, { method: 'POST', userId: VENTAS_ID, id: feb1 })
      check('un día aprobado que ya pasó (lunes 1) → 400', pasadoAprobado.status === 400, pasadoAprobado)
      const ajeno = await pedir(anularMio, `/api/me/dias-libres/${ene20Berta}/anular`, { method: 'POST', userId: VENTAS_ID, id: ene20Berta })
      check('el día de otra persona → 404', ajeno.status === 404, ajeno)

      // Un día libre registrado a 335 días (más allá de los 300 que listaba antes "Mis días libres") sale en la lista
      // que pide la pantalla (consultaMisDiasLibres: desde 90 días atrás, sin fin) y se puede anular.
      const hoyAhora = hoyFalso()
      const lejano = await pedir(registrarMio, '/api/me/dias-libres', { method: 'POST', userId: VENTAS_ID, body: diaLibre('2028-01-04') })
      const lista = await pedir(misDiasLibres, `/api/me/dias-libres?${new URLSearchParams(consultaMisDiasLibres(hoyAhora)).toString()}`, { userId: VENTAS_ID })
      check(
        'registrar el 4 de enero de 2028 (335 días adelante) → 201 y sale en "Mis días libres"',
        lejano.status === 201 && '2028-01-04' > sumarDias(hoyAhora, 300) && lista.status === 200 && lista.body.items.some((item: any) => item.id === lejano.body?.dia?.id),
        { lejano, items: lista.body?.items?.map((item: any) => item.fecha) }
      )
      const anularLejano = await pedir(anularMio, `/api/me/dias-libres/${lejano.body?.dia?.id}/anular`, { method: 'POST', userId: VENTAS_ID, id: lejano.body?.dia?.id })
      check('…y lo puede anular', anularLejano.status === 200 && anularLejano.body?.dia?.estado === 'anulado', anularLejano)
    }

    print('\n11. Cuota del mes (viernes 12 de febrero, 10:00: día hábil 10 de 20)')
    {
      fijarAhora('2027-02-12T15:00:00.000Z')
      const mia = await pedir(miCuota, '/api/me/cuota?mes=2027-02', { userId: VENTAS_ID })
      check(
        'caso 72: meta de zona 6, excepción 4 para Ana, 20 días hábiles, 2 días libres aprobados → cuota médica 72',
        mia.status === 200 && mia.body.medica.cuota === 72 && mia.body.medica.origen === 'ejecutiva' && mia.body.medica.meta_dia_hoy === 4,
        mia.body
      )
      check(
        'días hábiles 20, transcurridos 10, libres 2, por aprobar 0,5 (el medio día no resta) y ritmo 50 %',
        mia.body?.dias_habiles === 20 &&
          mia.body?.dias_habiles_transcurridos === 10 &&
          mia.body?.dias_libres === 2 &&
          mia.body?.dias_por_aprobar === 0.5 &&
          mia.body?.ritmo === 0.5,
        mia.body
      )
      check(
        'institucional general 1 × 18 = 18; Programación con meta propia 2,5 a la semana = 0,5 al día × 18 = 9',
        mia.body?.institucional?.cuota === 18 &&
          mia.body?.institucional?.origen === 'general' &&
          mia.body?.subtipos?.length === 1 &&
          mia.body.subtipos[0].subtipo_id === SUBTIPO_ID.programacion &&
          mia.body.subtipos[0].nombre === 'Programación' &&
          mia.body.subtipos[0].cuota === 9,
        mia.body
      )
      check(
        'zona Bucaramanga, municipio 68001, ciudad y perfil por defecto',
        mia.body?.zona?.nombre === 'Bucaramanga' && mia.body?.municipio === '68001' && mia.body?.ciudad === 'Bucaramanga' && mia.body?.perfil?.join(',') === 'medica,institucional',
        mia.body
      )
      const sinMes = await pedir(miCuota, '/api/me/cuota', { userId: VENTAS_ID })
      check('sin ?mes= usa el mes de hoy (2027-02)', sinMes.status === 200 && sinMes.body.mes === '2027-02' && sinMes.body.medica.cuota === 72, sinMes.body)
      const mesMalo = await pedir(miCuota, '/api/me/cuota?mes=2027-13', { userId: VENTAS_ID })
      check('mes no válido → 400', mesMalo.status === 400, mesMalo)

      const directora = await pedir(cuotaDe, `/api/config-visitas/cuota?executive_id=${EJEC_1}&mes=2027-02`, { userId: DIRECTORA_ID })
      check('/api/config-visitas/cuota para Ana da lo mismo (72)', directora.status === 200 && directora.body.medica.cuota === 72 && directora.body.ritmo === 0.5, directora.body)
      const rrhh = await pedir(cuotaDe, `/api/config-visitas/cuota?executive_id=${EJEC_1}&mes=2027-02`, { userId: RRHH_ID })
      check('recursos humanos (daysoff:approve) también la ve', rrhh.status === 200 && rrhh.body.medica.cuota === 72, rrhh)
      const lider = await pedir(cuotaDe, `/api/config-visitas/cuota?executive_id=${EJEC_1}&mes=2027-02`, { userId: LIDER_ID })
      check('la líder no ve la cuota de otra persona (403)', lider.status === 403, lider)
      const sinPersona = await pedir(cuotaDe, '/api/config-visitas/cuota?mes=2027-02', { userId: DIRECTORA_ID })
      check('sin executive_id → 400', sinPersona.status === 400, sinPersona)
      const noExiste = await pedir(cuotaDe, '/api/config-visitas/cuota?executive_id=12345678-1234-4234-8234-123456789012&mes=2027-02', { userId: DIRECTORA_ID })
      check('persona que no existe → 404', noExiste.status === 404, noExiste)

      const berta = await pedir(cuotaDe, `/api/config-visitas/cuota?executive_id=${EJEC_2}&mes=2027-02`, { userId: DIRECTORA_ID })
      check(
        'Berta (Chapinero): el festivo de Bogotá le resta un día → 19 hábiles',
        berta.status === 200 && berta.body.dias_habiles === 19 && berta.body.municipio === '11001',
        berta.body
      )
      check(
        'perfil solo institucional: médica 0 (no aplica); institucional de zona 2 × 19 = 38; Programación 0,5 × 19 = 9,5',
        berta.body?.medica?.cuota === 0 &&
          berta.body?.medica?.aplica === false &&
          berta.body?.perfil?.join(',') === 'institucional' &&
          berta.body?.institucional?.cuota === 38 &&
          berta.body?.institucional?.origen === 'zona' &&
          berta.body?.subtipos?.[0]?.cuota === 9.5,
        berta.body
      )
      const carla = await pedir(miCuota, '/api/me/cuota?mes=2027-02', { userId: LIDER_ID })
      check(
        'Carla (Usaquén → Bogotá): 19 hábiles; su día rechazado no resta; médica general 6 × 19 = 114',
        carla.status === 200 && carla.body.dias_habiles === 19 && carla.body.dias_libres === 0 && carla.body.medica.cuota === 114 && carla.body.medica.origen === 'general',
        carla.body
      )
    }

    print('\n12. 503 si falta la migración 0810')
    {
      fake.faltan.add('dias_libres')
      const lista = await pedir(listarDiasLibres, '/api/dias-libres', { userId: RRHH_ID })
      check('sin la tabla dias_libres → 503 con el mensaje de la migración', lista.status === 503 && lista.body?.error === MENSAJE_FALTA_MIGRACION, lista)
      fake.faltan.delete('dias_libres')
      fake.faltan.add('config_general')
      const config = await pedir(verConfig, '/api/config-visitas', { userId: DIRECTORA_ID })
      check('sin la tabla config_general → 503 en GET /api/config-visitas', config.status === 503, config)
      const mia = await pedir(miCuota, '/api/me/cuota?mes=2027-02', { userId: VENTAS_ID })
      check('…y en GET /api/me/cuota', mia.status === 503, mia)
      fake.faltan.delete('config_general')
      fake.faltan.add('rpc/calendario_cargar_festivos')
      const festivos = await pedir(cargarFestivos, '/api/calendario/festivos', { method: 'POST', userId: RRHH_ID, body: { anio: 2028 } })
      check('sin la función calendario_cargar_festivos → 503', festivos.status === 503, festivos)
      fake.faltan.delete('rpc/calendario_cargar_festivos')
      fake.faltan.add('rpc/config_registrar')
      const registro = await pedir(registrarCambio, '/api/config-visitas/cambios', {
        method: 'POST',
        userId: DIRECTORA_ID,
        body: cambio('config_general', { parametro: 'radio_presencial_m', valor: 600 }, '2027-02-12'),
      })
      check('sin la función config_registrar → 503', registro.status === 503, registro)
      fake.faltan.delete('rpc/config_registrar')
    }

    print('\n13. Reglas generales')
    check(
      'ninguna escritura directa a las tablas de configuración ni DELETE de calendario o días libres',
      fake.prohibidas.length === 0,
      fake.prohibidas
    )
    const escriturasConfig = fake.writes().filter(request => TABLAS_CONFIG.includes(request.table))
    check('toda escritura de configuración fue por config_registrar o config_cerrar', escriturasConfig.length === 0 && fake.rpcs.some(rpc => rpc.nombre === 'config_cerrar'), escriturasConfig)
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
  process.stderr.write(`visits-api-check: error inesperado: ${error instanceof Error ? error.stack : String(error)}\n`)
  process.exit(1)
})
