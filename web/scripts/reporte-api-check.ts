/**
 * Fase 8 · F3 reporte de visitas y voz · pruebas de las rutas (SIN RED, sin Supabase real, sin Google, sin OpenAI ni
 * Anthropic reales): /api/me/contexto, /api/me/visitas (GET, POST, PATCH, anular), /api/me/voz/transcribir,
 * /api/me/voz/proponer, /api/me/numeros, POST /api/terceros/sedes con origen 'gps_app', POST /api/terceros/medicos
 * (médico completo) y GET /api/visits/filtered (lo que ve el mapa de calor con visitas de la app).
 *
 * Llama a los handlers reales contra un Supabase FALSO en memoria (el PostgREST mínimo de scripts/visits-api-check.ts,
 * copiado, con comparación numérica de coordenadas y like) con las funciones visitas_registrar, visitas_editar y
 * visitas_anular como espejo de la migración 0830 (mismos pasos, mensajes y SQLSTATE), y con clientes FALSOS de
 * OpenAI y Claude inyectados con fijarFabricasVoz. El reloj es falso: martes 13 de octubre de 2026, 10:42 en Bogotá.
 *
 * Cubre la sección "Verificación" del contrato docs/fases/fase8-visitas-f3-f4-reporte-y-app-movil.md: presencial a
 * 800 m rechazada con la distancia; mismo client_id dos veces → una fila; médico sin documento → 400 y nada guardado;
 * documento repetido → el existente; transcripción de ejemplo → tres visitas propuestas (Claude falso) y nada guardado
 * sin confirmar; médico que no cruza → sugerir_crear_medico y no se crea; el audio no se escribe en disco (se vigila
 * fs); 503 sin llaves; perfil solo institucional → médica 400; tope por médico; telefónica sin habilitar y con tope;
 * ayer rechazado; llegada en el futuro; usuario sin ejecutiva 403; sin sesión 401; 503 si falta la migración 0830;
 * corregir y anular solo el mismo día; las claves de cada respuesta = mobile/lib/claves-api.ts (también las del login
 * móvil y GET /api/auth/me), y los tipos de la app (mobile/lib/tipos.ts) se asignan a los del servidor al compilar;
 * los límites de la voz (6/min y 40/h al transcribir, 10/min y 60/h al proponer) con su 429 y Retry-After; los logs
 * sin la transcripción ni los textos de la visita aunque la base o Claude fallen; y el importador de VMO (deshabilitado
 * en la ruta): borra solo source = 'vmo_import' del mes y no inserta nada si el borrado falla. Si Anthropic rechaza la
 * petición completa con un 400, proponer y campos reintentan UNA vez con la petición mínima (sin betas, fallbacks,
 * thinking ni strict; solo effort low) y el aviso del log trae el tipo, el parámetro y el request_id sin nada de lo
 * dictado ni del contexto; 429, 5xx, red, tiempo agotado y 'refusal' no usan ese respaldo. El portador en páginas,
 * el CORS de desarrollo y los límites del login están en scripts/reporte-check.ts.
 *
 * F4.1 (migración 0840, sección 14): GET/POST /api/me/agenda, POST /api/me/agenda/[id]/cancelar, el vínculo de
 * POST /api/me/visitas con la agenda (agenda_id o automático, "agendada", anular devuelve la cita a pendiente),
 * contexto.agenda_hoy con distancia, el bloque agenda de Mis números, proponer con cita_id, POST /api/me/voz/campos
 * (Claude falso: reparto en conclusión y compromisos, 503 sin llave, 400 vacío, nada en los logs) y el 503 claro de la
 * agenda sin la 0840 mientras lo demás sigue igual. El Supabase falso emula agenda_crear y agenda_cancelar con los
 * mensajes y SQLSTATE de la 0840 y el paso 7b de visitas_registrar con las reglas puras (citaParaVincular,
 * revisarCitaElegida y citaAnticipada, probadas contra los mismos casos que el bloque DO de la 0840).
 *
 * Uso (desde web/): npx tsx scripts/reporte-api-check.ts      Código de salida 1 si alguna prueba falla.
 */
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import { syncBuiltinESMExports } from 'node:module'
import { NextRequest } from 'next/server'
import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import type { z } from 'zod'
import { passwordVersion, SESSION_COOKIE_NAME, signSession } from '../lib/session'
import { SUBTIPOS_SEMILLA } from '../lib/terceros'
import type * as Terceros from '../lib/terceros'
import type { medicoCreateSchema, medicoSedeCreateSchema, medicoVerificarSchema, sedeCreateSchema } from '../lib/terceros-schemas'
import {
  CONFIG_VIGENTE_DESDE,
  CONTEO_SEMILLA,
  GENERAL_POR_DEFECTO,
  MENSAJE_SIN_EJECUTIVA,
  MOTIVO_SEMILLA,
  festivosColombia,
  hoyBogota,
  sumarDias,
  type CuotaResponse,
} from '../lib/visits-rules'
import {
  MENSAJE_CITA_AJENA,
  MENSAJE_CITA_CANCELADA,
  MENSAJE_CITA_DIA_LIBRE,
  MENSAJE_CITA_HECHA_NO_SE_CANCELA,
  MENSAJE_CITA_LEJANA,
  MENSAJE_CITA_NO_EXISTE,
  MENSAJE_CITA_OTRO_DIA,
  MENSAJE_CITA_OTRO_MEDICO,
  MENSAJE_CITA_PASADA,
  MENSAJE_CITA_PASADA_NO_SE_CANCELA,
  MENSAJE_CITA_REPETIDA_CUENTA,
  MENSAJE_CITA_REPETIDA_MEDICO,
  MENSAJE_CITA_YA_CANCELADA,
  MENSAJE_FALLO_CAMPOS,
  MENSAJE_FALLO_PROPUESTA,
  MENSAJE_MEDICO_NO_EXISTE,
  MENSAJE_SEDE_NO_DE_LA_CUENTA,
  MENSAJE_SEDE_NO_DEL_MEDICO,
  MENSAJE_SUBTIPO_NO_VIGENTE,
  PROMPT_CAMPOS,
  citaAnticipada,
  citaParaVincular,
  revisarCitaElegida,
  type CitaVinculo,
  MENSAJE_AUDIO_SIN_DURACION,
  MENSAJE_CONTACTO_INACTIVO,
  MENSAJE_CUENTA_INACTIVA,
  MENSAJE_LIMITE_VOZ,
  MENSAJE_LLEGADA_FUTURA,
  MENSAJE_LINEAS_AJENAS,
  MENSAJE_PROXIMA_ANTES_DE_VISITA,
  MENSAJE_REINTENTO_ANTES_DE_VISITA,
  MENSAJE_REPORTE_FUTURO,
  MENSAJE_SEDE_SIN_UBICACION,
  MENSAJE_SIN_ANTHROPIC,
  MENSAJE_SIN_OPENAI,
  MENSAJE_SIN_ZONA,
  MENSAJE_SOLO_HOY,
  MENSAJE_TELEFONICA_NO_HABILITADA,
  MENSAJE_TOPE_MEDICO,
  MENSAJE_VISITA_NO_EDITABLE,
  MODELO_PROPUESTA,
  MODELO_TRANSCRIPCION,
  MODELO_TRANSCRIPCION_RESPALDO,
  NUMERO_OMITIDO,
  PROMPT_PROPUESTA,
  TOLERANCIA_RELOJ_SEGUNDOS,
  fechaBogota,
  haversineM,
  mensajeFueraDeRadio,
  mensajePerfil,
  mensajeTopeTelefonicas,
} from '../lib/reporte-visitas'
import type * as W from '../lib/reporte-visitas'
import type { camposDictadoSchema, citaCancelarSchema, citaCreateSchema, visitaCreateSchema } from '../lib/reporte-visitas-schemas'
import type * as M from '../../mobile/lib/tipos'
import { CLAVES_API, clavesDe, tieneClaves, type FormaApi } from '../../mobile/lib/claves-api'
import {
  MAX_MENSAJE_API_ANALIZAR,
  MAX_TOKENS_CAMPOS,
  MAX_TOKENS_PETICION_MINIMA,
  MAX_TOKENS_PROPUESTA,
  MENSAJE_API_OMITIDO,
  MENSAJE_FALTA_MIGRACION_0830,
  MENSAJE_FALTA_MIGRACION_0840,
  TEXTO_OMITIDO_EN_LOG,
  fijarFabricasVoz,
  loEnviado,
  mensajeApiSeguro,
  parametroDelMensaje,
  reiniciarLimitesVoz,
  resumenErrorVoz,
  cabecerasAnthropic,
  type ClientePropuesta,
  type ClienteTranscripcion,
} from '../app/api/me/_lib/reporte-server'
import { POST as login } from '../app/api/auth/login/route'
import { GET as verMe } from '../app/api/auth/me/route'
import { importarMesVmo } from '../app/api/visits/_lib/importar-vmo'
import { DELETE as borrarImportacionVmo } from '../app/api/visits/import/route'
import { GET as verContexto, POST as pedirContexto } from '../app/api/me/contexto/route'
import { GET as verVisitas, POST as reportarVisita } from '../app/api/me/visitas/route'
import { PATCH as corregirVisita } from '../app/api/me/visitas/[id]/route'
import { POST as anularVisita } from '../app/api/me/visitas/[id]/anular/route'
import { POST as transcribir } from '../app/api/me/voz/transcribir/route'
import { POST as proponer } from '../app/api/me/voz/proponer/route'
import { GET as verNumeros } from '../app/api/me/numeros/route'
import { GET as verCuota } from '../app/api/me/cuota/route'
import { GET as verAgenda, POST as agendar } from '../app/api/me/agenda/route'
import { POST as cancelarCita } from '../app/api/me/agenda/[id]/cancelar/route'
import { POST as repartirCampos } from '../app/api/me/voz/campos/route'
import { POST as crearSede } from '../app/api/terceros/sedes/route'
import { POST as crearMedico } from '../app/api/terceros/medicos/route'
import { GET as visitasDelMapa } from '../app/api/visits/filtered/route'
import { GET as estadisticasVisitas } from '../app/api/visits/stats/route'
import { GET as zonasSinVisitar } from '../app/api/visits/unvisited-zones/route'

// ---------------------------------------------------------------------------
// Tipos de la app = tipos del servidor (al compilar: npm run typecheck falla si no cuadran)
// ---------------------------------------------------------------------------

type Asignable<A, B> = [A] extends [B] ? true : false
type Afirmar<T extends true> = T
// Respuestas: lo que manda el servidor cabe en lo que espera la app (y las de F3, también al revés: son copias).
export type TiposDeLaApp = [
  Afirmar<Asignable<W.ContextoResponse, M.ContextoResponse>>,
  Afirmar<Asignable<M.ContextoResponse, W.ContextoResponse>>,
  Afirmar<Asignable<W.VisitaItem, M.VisitaItem>>,
  Afirmar<Asignable<M.VisitaItem, W.VisitaItem>>,
  Afirmar<Asignable<W.VisitasResponse, M.VisitasResponse>>,
  Afirmar<Asignable<W.VisitaCreateResponse, M.VisitaCreateResponse>>,
  Afirmar<Asignable<W.TranscripcionResponse, M.TranscripcionResponse>>,
  Afirmar<Asignable<M.TranscripcionResponse, W.TranscripcionResponse>>,
  Afirmar<Asignable<W.PropuestaResponse, M.PropuestaResponse>>,
  Afirmar<Asignable<M.PropuestaResponse, W.PropuestaResponse>>,
  Afirmar<Asignable<W.NumerosResponse, M.NumerosResponse>>,
  Afirmar<Asignable<M.NumerosResponse, W.NumerosResponse>>,
  Afirmar<Asignable<CuotaResponse, M.CuotaResponse>>,
  Afirmar<Asignable<W.LoginMovilResponse, M.LoginMovilResponse>>,
  Afirmar<Asignable<W.MeResponse, M.MeResponse>>,
  Afirmar<Asignable<W.ErrorResponse, M.ErrorResponse>>,
  // F4.1 (0840): agenda, indicador y dictado por campo.
  Afirmar<Asignable<W.CitaItem, M.CitaItem>>,
  Afirmar<Asignable<M.CitaItem, W.CitaItem>>,
  Afirmar<Asignable<W.AgendaResponse, M.AgendaResponse>>,
  Afirmar<Asignable<M.AgendaResponse, W.AgendaResponse>>,
  Afirmar<Asignable<W.CitaResponse, M.CitaResponse>>,
  Afirmar<Asignable<W.NumerosAgenda, M.NumerosAgenda>>,
  Afirmar<Asignable<M.NumerosAgenda, W.NumerosAgenda>>,
  Afirmar<Asignable<W.CamposDictadoResponse, M.CamposDictadoResponse>>,
  Afirmar<Asignable<M.CamposDictadoResponse, W.CamposDictadoResponse>>,
  Afirmar<Asignable<M.CitaCreate, W.CitaCreate>>,
  Afirmar<Asignable<W.CitaCreate, M.CitaCreate>>,
  Afirmar<Asignable<M.CitaCreate, z.input<typeof citaCreateSchema>>>,
  Afirmar<Asignable<M.CitaCancelar, W.CitaCancelar>>,
  Afirmar<Asignable<M.CitaCancelar, z.input<typeof citaCancelarSchema>>>,
  Afirmar<Asignable<M.CamposDictado, W.CamposDictado>>,
  Afirmar<Asignable<M.CamposDictado, z.input<typeof camposDictadoSchema>>>,
  // Cuerpos: lo que manda la app cabe en lo que valida el servidor.
  Afirmar<Asignable<M.VisitaCreate, W.VisitaCreate>>,
  Afirmar<Asignable<W.VisitaCreate, M.VisitaCreate>>,
  Afirmar<Asignable<M.VisitaCreate, z.input<typeof visitaCreateSchema>>>,
  Afirmar<Asignable<M.VisitaUpdate, W.VisitaUpdate>>,
  Afirmar<Asignable<W.VisitaUpdate, M.VisitaUpdate>>,
  // Terceros de F1 que usa Reportar.
  Afirmar<Asignable<Terceros.MedicoVerificarRespuesta, M.MedicoVerificarRespuesta>>,
  Afirmar<Asignable<Terceros.MedicoListItem, M.MedicoPublico>>,
  Afirmar<Asignable<Terceros.SedeBusquedaItem, M.SedeBusquedaItem>>,
  Afirmar<Asignable<Terceros.CuentaListItem, M.CuentaListItem>>,
  Afirmar<Asignable<M.MedicoCreate, z.input<typeof medicoCreateSchema>>>,
  Afirmar<Asignable<M.MedicoVerificar, z.input<typeof medicoVerificarSchema>>>,
  Afirmar<Asignable<M.MedicoSedeCreate, z.input<typeof medicoSedeCreateSchema>>>,
  Afirmar<Asignable<M.SedeCreateGps, z.input<typeof sedeCreateSchema>>>,
]

for (const key of ['GOOGLE_MAPS_API_KEY', 'NEXT_PUBLIC_GOOGLE_MAPS_API_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_URL', 'SESSION_SECRET', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY']) {
  delete process.env[key]
}
process.env.GOOGLE_ROUTES_DISABLED = 'true'
const FAKE_SUPABASE_URL = 'http://supabase.test'
process.env.NEXT_PUBLIC_SUPABASE_URL = FAKE_SUPABASE_URL
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba'
process.env.SESSION_SECRET = 'secreto-de-prueba-reporte-api-check-0123456789abcdefghijklmnopqrstuvwxyz'

// ---------------------------------------------------------------------------
// Reloj falso (martes 13 de octubre de 2026, 10:42 en Bogotá)
// ---------------------------------------------------------------------------

const RealDate = Date
let ahoraMs = RealDate.parse('2026-10-13T15:42:00.000Z')
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
const HOY = '2026-10-13'
const AYER = '2026-10-12'

// La red está prohibida: solo responde el Supabase falso.
type FetchHandler = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
let fetchHandler: FetchHandler | null = null
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  if (!fetchHandler) throw new Error('reporte-api-check: la red está prohibida en estas pruebas')
  return fetchHandler(input, init)
}) as typeof fetch

// Todo lo que las rutas registran (para comprobar que ni el audio ni la transcripción salen en los logs).
const moduleLogs: string[] = []
const registrar = (...args: unknown[]) =>
  moduleLogs.push(args.map(arg => (arg instanceof Error ? `${arg.name}: ${arg.message}` : typeof arg === 'object' ? JSON.stringify(arg) : String(arg))).join(' '))
console.error = registrar
console.warn = registrar
console.info = registrar

// Vigilancia del disco: ninguna escritura mientras se transcribe.
const escriturasEnDisco: string[] = []
function vigilarDisco(): () => void {
  const nombres = ['writeFile', 'writeFileSync', 'appendFile', 'appendFileSync', 'createWriteStream', 'mkdtemp', 'mkdtempSync', 'copyFile', 'copyFileSync', 'openSync'] as const
  const modulo = fs as unknown as Record<string, (...args: unknown[]) => unknown>
  const promesas = fs.promises as unknown as Record<string, (...args: unknown[]) => unknown>
  const originales = nombres.map(nombre => [nombre, modulo[nombre]] as const)
  const originalesPromesas = (['writeFile', 'appendFile', 'mkdtemp', 'copyFile'] as const).map(nombre => [nombre, promesas[nombre]] as const)
  for (const [nombre, original] of originales) {
    modulo[nombre] = (...args: unknown[]) => {
      escriturasEnDisco.push(`${nombre} ${String(args[0])}`)
      return original.apply(fs, args)
    }
  }
  for (const [nombre, original] of originalesPromesas) {
    promesas[nombre] = (...args: unknown[]) => {
      escriturasEnDisco.push(`promises.${nombre} ${String(args[0])}`)
      return original.apply(fs.promises, args)
    }
  }
  syncBuiltinESMExports()
  return () => {
    for (const [nombre, original] of originales) modulo[nombre] = original
    for (const [nombre, original] of originalesPromesas) promesas[nombre] = original
    syncBuiltinESMExports()
  }
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
// Supabase FALSO (PostgREST mínimo + funciones de la 0830)
// ---------------------------------------------------------------------------

type Fila = Record<string, any>
type Tablas = Record<string, Fila[]>

const POSTGREST_CONTROL_PARAMS = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'])

function likeRegex(pattern: string, flags: string): RegExp {
  let regex = ''
  for (let i = 0; i < pattern.length; i++) {
    const char = pattern[i]
    if (char === '\\' && i + 1 < pattern.length) regex += pattern[++i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    else if (char === '%' || char === '*') regex += '.*'
    else if (char === '_') regex += '.'
    else regex += char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }
  return new RegExp(`^${regex}$`, flags)
}

function matchesFilters(row: Fila, params: URLSearchParams): boolean {
  for (const [key, raw] of Array.from(params.entries())) {
    if (POSTGREST_CONTROL_PARAMS.has(key)) continue
    const original = row[key]
    const value = original === null || original === undefined ? 'null' : String(original)
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
      // Coordenadas y números: comparación numérica (como numeric en PostgreSQL); fechas y textos: de texto.
      const a: number | string = typeof original === 'number' ? original : value
      const b: number | string = typeof original === 'number' ? Number(target) : target
      if (op === 'gte' && !(a >= b)) return false
      if (op === 'lte' && !(a <= b)) return false
      if (op === 'gt' && !(a > b)) return false
      if (op === 'lt' && !(a < b)) return false
    } else {
      throw new Error(`Supabase falso: filtro no soportado ${key}=${raw}`)
    }
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

/** Columnas nuevas de visits (0830): con `sin0830` cualquier consulta que las nombre falla como en la base vieja. */
const COLUMNAS_0830 = ['source', 'executive_id', 'client_id', 'tipo', 'subtipo_id', 'medico_id', 'cuenta_id', 'sede_id', 'modalidad', 'efectiva', 'deleted_at', 'checked_in_at', 'transcript']

/** Columnas de visits de la 0840: con `sin0840` cualquier consulta que las nombre falla como antes de aplicarla. */
const COLUMNAS_0840 = ['agenda_id', 'agendada']

const CONFIG_GENERAL_DEFECTO = GENERAL_POR_DEFECTO as unknown as Record<string, any>

function fakeSupabase(tablas: Tablas) {
  const requests: { method: string; table: string; params: URLSearchParams; body: unknown }[] = []
  const external: string[] = []
  const rpcs: { nombre: string; args: Fila }[] = []
  const estado = {
    sin0830: false,
    /** La base sin la 0840: sin visitas_agenda, agenda_crear, agenda_cancelar ni visits.agenda_id/agendada. */
    sin0840: false,
    rechazoForzado: null as string | null,
    /** Error crudo de PostgREST que devuelve la próxima RPC visitas_* (para probar qué sale en los logs). */
    errorRpc: null as Fila | null,
    /** El DELETE de visits falla (para probar que el importador de VMO no inserta nada). */
    falloBorradoVisitas: false,
  }
  const json = (payload: unknown, status = 200) => new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json' } })
  const pgError = (code: string, message: string, status = 400) => json({ code, message, details: null, hint: null }, status)
  const store = (table: string) => (tablas[table] = tablas[table] ?? [])
  const hoyFalso = () => hoyBogota(new Date())

  // --- Espejo de visitas_config_vigente (0830) ---
  function vigente(filas: Fila[], fecha: string): Fila | undefined {
    return filas
      .filter(f => !f.anulado_at && f.vigente_desde <= fecha && (f.vigente_hasta === null || f.vigente_hasta >= fecha))
      .sort((a, b) => compareValues(b.vigente_desde, a.vigente_desde))[0]
  }
  function configVigente(executiveId: string, fecha: string) {
    const persona = vigente(store('config_personas').filter(f => f.executive_id === executiveId), fecha)
    const general = (parametro: string) => vigente(store('config_general').filter(f => f.parametro === parametro), fecha)?.valor ?? CONFIG_GENERAL_DEFECTO[parametro]
    const telefonicas = general('telefonicas') as { tope_dia: number; medios: string[] }
    return {
      perfil: persona ? ['medica', 'institucional'].filter(t => (persona.perfil as string[]).includes(t)) : ['medica', 'institucional'],
      radio_m: persona?.radio_m ?? Math.round(Number(general('radio_presencial_m'))),
      tope_visitas_medico_dia: Math.round(Number(general('tope_visitas_medico_dia'))),
      telefonica: {
        habilitada: persona?.telefonica_habilitada ?? false,
        tope_dia: persona?.tope_telefonicas_dia ?? Math.round(Number(telefonicas.tope_dia)),
        medios: telefonicas.medios,
      },
    }
  }

  const deHoy = (exec: string, fecha: string, extra: (v: Fila) => boolean, excluir?: string) =>
    store('visits').filter(v => v.source === 'app' && v.executive_id === exec && v.visit_date === fecha && v.efectiva && !v.deleted_at && v.id !== excluir && extra(v)).length

  // --- Espejo de visitas_registrar (0830): mismos pasos, mensajes y SQLSTATE ---
  function visitasRegistrar(args: Fila): Response {
    const p = (args.p ?? {}) as Fila
    const regla = (mensaje: string) => pgError('23514', mensaje)
    const forma = (mensaje: string) => pgError('22023', mensaje)
    if (!p.client_id) return forma('Falta el client_id de la visita (uuid que genera la app)')
    if (!p.executive_id) return forma('Falta el Ejecutivo Comercial de la visita')
    if (!['medica', 'institucional'].includes(p.tipo)) return forma('Tipo de visita no válido: medica o institucional')
    if (!p.sede_id) return forma('Elige la sede')
    if (!['presencial', 'telefonica'].includes(p.modalidad)) return forma('Modalidad no válida: presencial o telefonica')
    if (typeof p.efectiva !== 'boolean') return forma('Indica si la visita fue efectiva (sí o no)')
    if (!Array.isArray(p.lineas)) return forma('Elige al menos una línea')
    const efectiva = p.efectiva as boolean
    if (!efectiva && !String(p.failure_reason ?? '').trim()) return regla('Indica el motivo de la visita no efectiva (hasta 300 caracteres)')

    // 1. Idempotencia por client_id
    const previa = store('visits').find(v => v.client_id === p.client_id)
    if (previa) {
      if (previa.executive_id !== p.executive_id) return pgError('23505', 'Ese client_id ya se usó en otra visita', 409)
      const vinculo = estado.sin0840 ? {} : { agenda_id: previa.agenda_id ?? null, agendada: previa.agendada === true }
      return json({ visita_id: previa.id, repetida: true, out_of_territory: previa.out_of_territory, distance_m: previa.distance_m, visit_date: previa.visit_date, ...vinculo })
    }
    // 2. Ejecutiva, mismo día, horas
    const ejecutiva = store('executives').find(e => e.id === p.executive_id)
    if (!ejecutiva || ejecutiva.status !== 'active') return regla(MENSAJE_SIN_EJECUTIVA)
    if (!ejecutiva.base_kam_id) return regla(MENSAJE_SIN_ZONA)
    const fecha = fechaBogota(p.checked_in_at)
    if (fecha !== hoyFalso()) return regla(MENSAJE_SOLO_HOY)
    if (Date.parse(p.checked_in_at) > Date.now() + TOLERANCIA_RELOJ_SEGUNDOS * 1000) return regla(MENSAJE_LLEGADA_FUTURA)
    if (Date.parse(p.reported_at) < Date.parse(p.checked_in_at)) return regla('La hora del reporte no puede ser anterior a la de llegada')
    if (Date.parse(p.reported_at) > Date.now() + TOLERANCIA_RELOJ_SEGUNDOS * 1000) return regla(MENSAJE_REPORTE_FUTURO)
    if (p.next_step_date && p.next_step_date < fecha) return regla(MENSAJE_PROXIMA_ANTES_DE_VISITA)
    if (!efectiva && p.retry_date && p.retry_date < fecha) return regla(MENSAJE_REINTENTO_ANTES_DE_VISITA)
    // 3. Perfil
    const cfg = configVigente(p.executive_id, fecha)
    if (!cfg.perfil.includes(p.tipo)) return regla(mensajePerfil(p.tipo))
    // 4. Sede; médica o institucional
    const sede = store('sedes').find(s => s.id === p.sede_id)
    if (!sede || !sede.activo) return regla('Esa sede no existe')
    if (store('cuentas').find(c => c.id === sede.cuenta_id)?.activo !== true) return regla(MENSAJE_CUENTA_INACTIVA)
    let oot = false
    let subtipoCodigo: string | null = null
    if (p.tipo === 'medica') {
      if (!store('medicos').some(m => m.id === p.medico_id && m.activo)) return regla('Ese médico no existe o está inactivo')
      if (!store('medico_sedes').some(ms => ms.medico_id === p.medico_id && ms.sede_id === p.sede_id)) return regla('El médico no atiende en esa sede')
      oot = !store('medico_visitantes').some(mv => mv.medico_id === p.medico_id && mv.executive_id === p.executive_id && mv.desde <= fecha && (mv.hasta === null || mv.hasta >= fecha))
    } else {
      if (sede.cuenta_id !== p.cuenta_id) return regla('Esa sede no es de la cuenta elegida')
      const subtipo = store('subtipos_institucionales').find(s => s.id === p.subtipo_id && s.vigente_desde <= fecha && (s.vigente_hasta === null || s.vigente_hasta >= fecha))
      if (!subtipo) return regla('Ese subtipo no está vigente')
      subtipoCodigo = subtipo.codigo
      if (p.contacto_id) {
        const contacto = store('contactos').find(c => c.id === p.contacto_id)
        if (!contacto || contacto.cuenta_id !== p.cuenta_id) return regla('Ese contacto no es de la cuenta elegida')
        if (contacto.activo === false) return regla(MENSAJE_CONTACTO_INACTIVO)
      }
    }
    // 5. Presencial o telefónica
    let distancia: number | null = null
    if (p.modalidad === 'presencial') {
      if (p.lat === null || p.lat === undefined) return regla('La ubicación del teléfono es obligatoria en una visita presencial')
      if (sede.lat === null || sede.lng === null) return regla(MENSAJE_SEDE_SIN_UBICACION)
      distancia = haversineM({ lat: Number(p.lat), lng: Number(p.lng) }, { lat: Number(sede.lat), lng: Number(sede.lng) })
      if (distancia > cfg.radio_m) return regla(mensajeFueraDeRadio(distancia, sede.nombre, cfg.radio_m))
    } else {
      if (!cfg.telefonica.habilitada) return regla(MENSAJE_TELEFONICA_NO_HABILITADA)
      if (!cfg.telefonica.medios.includes(p.medio)) return regla(`Medio no válido: ${cfg.telefonica.medios.join(' o ')}`)
      if (deHoy(p.executive_id, fecha, v => v.modalidad === 'telefonica') >= cfg.telefonica.tope_dia) return regla(mensajeTopeTelefonicas(cfg.telefonica.tope_dia))
    }
    // 6. Tope por médico
    if (p.tipo === 'medica' && efectiva && deHoy(p.executive_id, fecha, v => v.medico_id === p.medico_id) >= cfg.tope_visitas_medico_dia) return regla(MENSAJE_TOPE_MEDICO)
    // 7. Líneas
    if (p.lineas.length === 0) return regla('Elige al menos una línea')
    if ((p.lineas as string[]).some(id => !store('executive_lines').some(el => el.executive_id === p.executive_id && el.line_id === id))) return regla(MENSAJE_LINEAS_AJENAS)
    // 7b. Agenda (0840): la cita de agenda_id (revisada) o la del vínculo automático; agendada si se creó antes del día.
    //     Con las reglas puras de lib/reporte-visitas.ts (las mismas que prueba el bloque DO de la 0840). Sin la 0840, la
    //     función de la 0830 ignora agenda_id.
    let citaVinculada: Fila | null = null
    let agendada = false
    if (!estado.sin0840) {
      const visitaVinculo = { executive_id: p.executive_id, fecha, tipo: p.tipo, medico_id: p.tipo === 'medica' ? p.medico_id : null, cuenta_id: p.tipo === 'institucional' ? p.cuenta_id : null, subtipo_id: p.tipo === 'institucional' ? p.subtipo_id : null }
      const citas = store('visitas_agenda')
      if (p.agenda_id) {
        const cita = citas.find(c => c.id === p.agenda_id) ?? null
        const error = revisarCitaElegida(cita ? aVinculo(cita) : null, visitaVinculo)
        if (error) return regla(error)
        citaVinculada = cita
      } else {
        const elegida = citaParaVincular(citas.map(aVinculo), visitaVinculo)
        citaVinculada = elegida ? (citas.find(c => c.id === elegida.id) ?? null) : null
      }
      agendada = citaVinculada ? citaAnticipada(citaVinculada.created_at, fecha) : false
    }
    // Lo que la pre-validación no puede ver (otra visita que entró en el mismo instante, con el candado por ejecutiva)
    if (estado.rechazoForzado) return regla(estado.rechazoForzado)
    // 8. Punto del mapa de calor e inserción. Telefónica: la sede, su municipio o la zona; NUNCA el GPS del teléfono.
    const municipio = store('municipalities').find(m => m.code === sede.municipality_id)
    const zona = store('kams').find(k => k.id === ejecutiva.base_kam_id)
    const punto =
      p.modalidad === 'presencial'
        ? { lat: Number(p.lat), lng: Number(p.lng) }
        : sede.lat !== null
          ? { lat: Number(sede.lat), lng: Number(sede.lng) }
          : municipio
            ? { lat: municipio.lat, lng: municipio.lng }
            : { lat: Number(zona?.lat ?? 0), lng: Number(zona?.lng ?? 0) }
    const id = randomUUID()
    store('visits').push({
      id,
      kam_id: ejecutiva.base_kam_id,
      kam_name: ejecutiva.full_name,
      visit_type: efectiva ? 'Visita efectiva' : 'Visita no efectiva',
      contact_type: p.modalidad === 'presencial' ? 'Visita presencial' : 'Visita virtual',
      lat: Math.round(punto.lat * 1e6) / 1e6,
      lng: Math.round(punto.lng * 1e6) / 1e6,
      visit_date: fecha,
      hospital_id: sede.hospital_id ?? null,
      imported_by: null,
      imported_at: null,
      import_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      source: 'app',
      executive_id: p.executive_id,
      client_id: p.client_id,
      tipo: p.tipo,
      subtipo_id: p.tipo === 'institucional' ? p.subtipo_id : null,
      subtipo_codigo: subtipoCodigo,
      medico_id: p.tipo === 'medica' ? p.medico_id : null,
      cuenta_id: p.tipo === 'institucional' ? p.cuenta_id : null,
      sede_id: p.sede_id,
      contacto_id: p.tipo === 'institucional' ? (p.contacto_id ?? null) : null,
      modalidad: p.modalidad,
      medio: p.modalidad === 'telefonica' ? p.medio : null,
      efectiva,
      failure_reason: efectiva ? null : p.failure_reason,
      retry_date: efectiva ? null : (p.retry_date ?? null),
      checked_in_at: p.checked_in_at,
      reported_at: p.reported_at,
      distance_m: distancia,
      gps_accuracy_m: p.modalidad === 'telefonica' ? null : (p.gps_accuracy_m ?? null),
      conclusion: p.conclusion ?? null,
      compromisos: p.compromisos ?? null,
      next_step_date: p.next_step_date ?? null,
      transcript: p.transcript ?? null,
      input_mode: p.input_mode,
      out_of_territory: oot,
      created_by: args.p_user,
      updated_by: args.p_user,
      deleted_at: null,
      deleted_reason: null,
      ...(estado.sin0840 ? {} : { agenda_id: citaVinculada?.id ?? null, agendada }),
    })
    for (const line_id of Array.from(new Set(p.lineas as string[]))) store('visit_lines').push({ visit_id: id, line_id })
    if (citaVinculada) Object.assign(citaVinculada, { estado: 'hecha', visita_id: id, updated_at: new Date().toISOString() })
    const vinculo = estado.sin0840 ? {} : { agenda_id: citaVinculada?.id ?? null, agendada }
    return json({ visita_id: id, repetida: false, out_of_territory: oot, distance_m: distancia, visit_date: fecha, ...vinculo })
  }

  const aVinculo = (cita: Fila): CitaVinculo => ({
    id: cita.id,
    executive_id: cita.executive_id,
    fecha: cita.fecha,
    hora: cita.hora ? String(cita.hora).slice(0, 5) : null,
    tipo: cita.tipo,
    medico_id: cita.medico_id ?? null,
    cuenta_id: cita.cuenta_id ?? null,
    subtipo_id: cita.subtipo_id ?? null,
    estado: cita.estado,
    created_at: cita.created_at,
  })

  // --- Espejo de agenda_crear (0840): mismos pasos, mensajes y SQLSTATE ---
  function agendaCrear(args: Fila): Response {
    const p = (args.p ?? {}) as Fila
    const regla = (mensaje: string) => pgError('23514', mensaje)
    const forma = (mensaje: string) => pgError('22023', mensaje)
    if (!args.p_user) return forma('Falta el usuario que agenda')
    if (!p.fecha) return forma('Elige la fecha de la cita')
    if (!['medica', 'institucional'].includes(p.tipo)) return forma('Tipo de visita no válido: medica o institucional')
    if (!p.sede_id) return forma('Elige la sede')
    if (p.tipo === 'medica' && !p.medico_id) return forma('Elige el médico')
    if (p.tipo === 'institucional' && !p.cuenta_id) return forma('Elige la cuenta')
    if (p.tipo === 'institucional' && !p.subtipo_id) return forma('Elige el subtipo de la visita institucional')
    if (p.nota && String(p.nota).length > 300) return forma('La nota no puede superar 300 caracteres')
    const ejecutiva = store('executives').find(e => e.user_id === args.p_user)
    if (!ejecutiva || ejecutiva.status !== 'active') return regla(MENSAJE_SIN_EJECUTIVA)
    if (!ejecutiva.base_kam_id) return regla(MENSAJE_SIN_ZONA)
    const hoy = hoyFalso()
    if (p.fecha < hoy) return regla(MENSAJE_CITA_PASADA)
    if (p.fecha > sumarDias(hoy, 30)) return regla(MENSAJE_CITA_LEJANA)
    if (store('dias_libres').some(d => d.executive_id === ejecutiva.id && d.fecha === p.fecha && ['registrado', 'aprobado'].includes(d.estado) && Number(d.fraccion) >= 1)) {
      return regla(MENSAJE_CITA_DIA_LIBRE)
    }
    const cfg = configVigente(ejecutiva.id, p.fecha)
    if (!cfg.perfil.includes(p.tipo)) return regla(mensajePerfil(p.tipo))
    const sede = store('sedes').find(s => s.id === p.sede_id)
    if (!sede || !sede.activo) return regla('Esa sede no existe')
    if (store('cuentas').find(c => c.id === sede.cuenta_id)?.activo !== true) return regla(MENSAJE_CUENTA_INACTIVA)
    const medica = p.tipo === 'medica'
    if (medica) {
      if (!store('medicos').some(m => m.id === p.medico_id && m.activo)) return regla(MENSAJE_MEDICO_NO_EXISTE)
      if (!store('medico_sedes').some(ms => ms.medico_id === p.medico_id && ms.sede_id === p.sede_id)) return regla(MENSAJE_SEDE_NO_DEL_MEDICO)
    } else {
      if (sede.cuenta_id !== p.cuenta_id) return regla(MENSAJE_SEDE_NO_DE_LA_CUENTA)
      if (!store('subtipos_institucionales').some(s => s.id === p.subtipo_id && s.vigente_desde <= p.fecha && (s.vigente_hasta === null || s.vigente_hasta >= p.fecha))) {
        return regla(MENSAJE_SUBTIPO_NO_VIGENTE)
      }
    }
    const citas = store('visitas_agenda')
    const vivas = citas.filter(c => c.executive_id === ejecutiva.id && c.fecha === p.fecha && c.tipo === p.tipo && c.estado !== 'cancelada')
    if (medica && vivas.some(c => c.medico_id === p.medico_id)) return pgError('23505', MENSAJE_CITA_REPETIDA_MEDICO, 409)
    if (!medica && vivas.some(c => c.cuenta_id === p.cuenta_id && c.subtipo_id === p.subtipo_id)) return pgError('23505', MENSAJE_CITA_REPETIDA_CUENTA, 409)
    const id = randomUUID()
    const ahora = new Date().toISOString()
    citas.push({
      id,
      executive_id: ejecutiva.id,
      fecha: p.fecha,
      // PostgreSQL devuelve time con segundos.
      hora: p.hora ? `${String(p.hora).slice(0, 5)}:00` : null,
      tipo: p.tipo,
      medico_id: medica ? p.medico_id : null,
      cuenta_id: medica ? null : p.cuenta_id,
      subtipo_id: medica ? null : p.subtipo_id,
      sede_id: p.sede_id,
      nota: p.nota ? String(p.nota).trim() : null,
      estado: 'pendiente',
      visita_id: null,
      cancelada_at: null,
      cancelada_motivo: null,
      created_by: args.p_user,
      created_at: ahora,
      updated_at: ahora,
    })
    return json({ cita_id: id })
  }

  // --- Espejo de agenda_cancelar (0840) ---
  function agendaCancelar(args: Fila): Response {
    if (!args.p_id) return pgError('22023', 'Falta la cita')
    if (!args.p_user) return pgError('22023', 'Falta el usuario que cancela')
    const motivo = typeof args.p_motivo === 'string' && args.p_motivo.trim() ? args.p_motivo.trim() : null
    if (motivo && motivo.length > 300) return pgError('23514', 'El motivo no puede superar 300 caracteres')
    const ejecutiva = store('executives').find(e => e.user_id === args.p_user)
    if (!ejecutiva || ejecutiva.status !== 'active') return pgError('23514', MENSAJE_SIN_EJECUTIVA)
    const cita = store('visitas_agenda').find(c => c.id === args.p_id)
    if (!cita || cita.executive_id !== ejecutiva.id) return pgError('P0002', MENSAJE_CITA_NO_EXISTE, 404)
    if (cita.estado === 'cancelada') return pgError('23514', MENSAJE_CITA_YA_CANCELADA)
    if (cita.estado === 'hecha') return pgError('23514', MENSAJE_CITA_HECHA_NO_SE_CANCELA)
    if (cita.fecha < hoyFalso()) return pgError('23514', MENSAJE_CITA_PASADA_NO_SE_CANCELA)
    Object.assign(cita, { estado: 'cancelada', cancelada_at: new Date().toISOString(), cancelada_motivo: motivo, updated_at: new Date().toISOString() })
    return json(null)
  }

  const C_NO_EDITABLE = MENSAJE_VISITA_NO_EDITABLE
  const EDITABLES = ['conclusion', 'compromisos', 'next_step_date', 'efectiva', 'failure_reason', 'retry_date', 'lineas']

  // --- Espejo de visitas_editar (0830) ---
  function visitasEditar(args: Fila): Response {
    const p = (args.p ?? {}) as Fila
    const ajenas = Object.keys(p).filter(k => k !== 'executive_id' && !EDITABLES.includes(k))
    if (ajenas.length > 0) return pgError('23514', `Solo se corrigen la conclusión, los compromisos, la próxima reunión, si fue efectiva (con su motivo) y las líneas; para cambiar el tipo, el médico, la cuenta o la sede, anula la visita y repórtala de nuevo (${ajenas.sort().join(', ')})`)
    if (!Object.keys(p).some(k => EDITABLES.includes(k))) return pgError('22023', 'No hay campos para corregir')
    const visita = store('visits').find(v => v.id === args.p_id)
    if (!visita) return pgError('P0002', 'Esa visita no existe', 404)
    if (visita.source !== 'app') return pgError('23514', C_NO_EDITABLE)
    if (visita.executive_id !== p.executive_id) return pgError('P0002', 'Esa visita no existe', 404)
    if (visita.deleted_at || visita.visit_date !== hoyFalso()) return pgError('23514', C_NO_EDITABLE)
    const efectiva = 'efectiva' in p ? p.efectiva : visita.efectiva
    const failure = efectiva ? null : 'failure_reason' in p ? p.failure_reason : visita.failure_reason
    if (!efectiva && !failure) return pgError('23514', 'Indica el motivo de la visita no efectiva (hasta 300 caracteres)')
    const proxima = 'next_step_date' in p ? p.next_step_date : visita.next_step_date
    const reintento = efectiva ? null : 'retry_date' in p ? p.retry_date : visita.retry_date
    if (proxima && proxima < visita.visit_date) return pgError('23514', MENSAJE_PROXIMA_ANTES_DE_VISITA)
    if (reintento && reintento < visita.visit_date) return pgError('23514', MENSAJE_REINTENTO_ANTES_DE_VISITA)
    if (efectiva && !visita.efectiva) {
      const cfg = configVigente(visita.executive_id, visita.visit_date)
      if (visita.tipo === 'medica' && deHoy(visita.executive_id, visita.visit_date, v => v.medico_id === visita.medico_id, visita.id) >= cfg.tope_visitas_medico_dia) {
        return pgError('23514', MENSAJE_TOPE_MEDICO)
      }
      if (visita.modalidad === 'telefonica' && deHoy(visita.executive_id, visita.visit_date, v => v.modalidad === 'telefonica', visita.id) >= cfg.telefonica.tope_dia) {
        return pgError('23514', mensajeTopeTelefonicas(cfg.telefonica.tope_dia))
      }
    }
    if ('lineas' in p) {
      const lineas = p.lineas as string[]
      if (lineas.length === 0) return pgError('23514', 'Elige al menos una línea')
      if (lineas.some(id => !store('executive_lines').some(el => el.executive_id === visita.executive_id && el.line_id === id))) return pgError('23514', MENSAJE_LINEAS_AJENAS)
      tablas.visit_lines = store('visit_lines').filter(vl => vl.visit_id !== visita.id)
      for (const line_id of lineas) store('visit_lines').push({ visit_id: visita.id, line_id })
    }
    if ('conclusion' in p) visita.conclusion = p.conclusion
    if ('compromisos' in p) visita.compromisos = p.compromisos
    if ('next_step_date' in p) visita.next_step_date = p.next_step_date
    visita.efectiva = efectiva
    visita.failure_reason = failure
    visita.retry_date = reintento
    visita.visit_type = efectiva ? 'Visita efectiva' : 'Visita no efectiva'
    visita.updated_by = args.p_user
    return json(null)
  }

  // --- Espejo de visitas_anular (0830) ---
  function visitasAnular(args: Fila): Response {
    const motivo = String(args.p_motivo ?? '').trim()
    if (motivo.length < 5) return pgError('23514', 'Escribe el motivo (al menos 5 caracteres)')
    if (motivo.length > 300) return pgError('23514', 'El motivo no puede superar 300 caracteres')
    const ejecutiva = store('executives').find(e => e.user_id === args.p_user)
    if (!ejecutiva || ejecutiva.status !== 'active') return pgError('23514', MENSAJE_SIN_EJECUTIVA)
    const visita = store('visits').find(v => v.id === args.p_id)
    if (!visita) return pgError('P0002', 'Esa visita no existe', 404)
    if (visita.source !== 'app') return pgError('23514', C_NO_EDITABLE)
    if (visita.executive_id !== ejecutiva.id) return pgError('P0002', 'Esa visita no existe', 404)
    if (visita.deleted_at) return pgError('23514', 'Esa visita ya está anulada')
    if (visita.visit_date !== hoyFalso()) return pgError('23514', C_NO_EDITABLE)
    visita.deleted_at = new Date().toISOString()
    visita.deleted_reason = motivo
    visita.updated_by = args.p_user
    // 0840: la cita que cumplía vuelve a pendiente (la visita anulada conserva agenda_id).
    if (!estado.sin0840) {
      for (const cita of store('visitas_agenda')) {
        if (cita.visita_id === visita.id && cita.estado === 'hecha') Object.assign(cita, { estado: 'pendiente', visita_id: null })
      }
    }
    return json(null)
  }

  const handler: FetchHandler = async (input, init) => {
    const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const url = new URL(href)
    if (url.origin !== FAKE_SUPABASE_URL) {
      external.push(url.origin)
      throw new Error(`reporte-api-check: intento de red a ${url.origin}`)
    }
    const method = (init?.method || 'GET').toUpperCase()
    const table = url.pathname.replace('/rest/v1/', '')
    const body = init?.body ? JSON.parse(String(init.body)) : undefined
    requests.push({ method, table, params: url.searchParams, body })
    const headers = new Headers(init?.headers)
    const wantsObject = (headers.get('accept') || '').includes('vnd.pgrst.object')
    const select = url.searchParams.get('select')

    if (estado.sin0830) {
      if (table.startsWith('rpc/visitas_')) return pgError('PGRST202', `Could not find the function public.${table.slice(4)} in the schema cache`, 404)
      if (table === 'visit_lines') return pgError('PGRST205', "Could not find the table 'public.visit_lines' in the schema cache", 404)
      if (table === 'visits') {
        const nombradas = [...(select ?? '').split(',').map(c => c.trim()), ...Array.from(url.searchParams.keys())]
        const nueva = nombradas.find(c => COLUMNAS_0830.includes(c))
        // PostgREST no manda cuerpo en un HEAD que falla: el código del error no llega (por eso stats pregunta antes).
        if (nueva && method === 'HEAD') return new Response(null, { status: 400 })
        if (nueva) return pgError('42703', `column visits.${nueva} does not exist`, 400)
      }
    }

    if (estado.sin0840) {
      if (table === 'rpc/agenda_crear' || table === 'rpc/agenda_cancelar') return pgError('PGRST202', `Could not find the function public.${table.slice(4)} in the schema cache`, 404)
      if (table === 'visitas_agenda') return pgError('PGRST205', "Could not find the table 'public.visitas_agenda' in the schema cache", 404)
      if (table === 'visits') {
        const nombradas = [...(select ?? '').split(',').map(c => c.trim()), ...Array.from(url.searchParams.keys())]
        const nueva = nombradas.find(c => COLUMNAS_0840.includes(c))
        if (nueva) return pgError('42703', `column visits.${nueva} does not exist`, 400)
      }
    }

    const backup = JSON.parse(JSON.stringify(tablas)) as Tablas
    const rollback = () => {
      for (const key of Object.keys(tablas)) delete tablas[key]
      Object.assign(tablas, backup)
    }

    if (table.startsWith('rpc/')) {
      const nombre = table.slice(4)
      const args = (body ?? {}) as Fila
      rpcs.push({ nombre, args })
      if (estado.errorRpc && nombre.startsWith('visitas_')) return json(estado.errorRpc, 400)
      const funciones: Record<string, (args: Fila) => Response> = {
        visitas_registrar: visitasRegistrar,
        visitas_editar: visitasEditar,
        visitas_anular: visitasAnular,
        agenda_crear: agendaCrear,
        agenda_cancelar: agendaCancelar,
        // Importador de VMO: ninguna IPS a menos de 5 km en estas pruebas.
        find_nearest_hospital: () => json(null),
      }
      const funcion = funciones[nombre]
      if (!funcion) throw new Error(`Supabase falso: función no soportada ${nombre}`)
      const respuesta = funcion(args)
      if (!respuesta.ok) rollback()
      return respuesta
    }

    let rows: Fila[]
    if (method === 'HEAD') {
      // select(..., { count: 'exact', head: true }): solo el total en Content-Range.
      const total = store(table).filter(row => matchesFilters(row, url.searchParams)).length
      return new Response(null, { status: 200, headers: { 'content-range': `*/${total}` } })
    }
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
      const nuevas: Fila[] = (Array.isArray(body) ? body : [body]).map(row => ({ id: randomUUID(), created_at: new Date().toISOString(), activo: true, ...(row as Fila) }))
      for (const nueva of nuevas) {
        // DEFAULT 'vmo_import' de visits.source (0830): lo que inserta el importador de VMO no lo nombra.
        if (table === 'visits' && !estado.sin0830 && nueva.source === undefined) nueva.source = 'vmo_import'
        if (table === 'sedes' && nueva.reps_code && store('sedes').some(s => s.reps_code === nueva.reps_code)) {
          rollback()
          return pgError('23505', 'duplicate key value violates unique constraint "sedes_reps_code_key"', 409)
        }
        store(table).push(nueva)
      }
      rows = nuevas
    } else if (method === 'PATCH') {
      rows = store(table).filter(row => matchesFilters(row, url.searchParams))
      for (const row of rows) Object.assign(row, body as Fila)
    } else if (method === 'DELETE') {
      if (table === 'visits' && estado.falloBorradoVisitas) return pgError('57014', 'canceling statement due to statement timeout', 500)
      rows = store(table).filter(row => matchesFilters(row, url.searchParams))
      // Disparador visits_app_sin_borrar (0830): una visita de la app no se borra.
      if (table === 'visits' && rows.some(row => row.source === 'app')) return pgError('23514', 'Las visitas de la app no se borran: se anulan con motivo')
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
  return { handler, requests, external, writes, rpcs, estado }
}

// ---------------------------------------------------------------------------
// Datos de prueba
// ---------------------------------------------------------------------------

const VENTAS_ID = '33333333-3333-4333-8333-333333333333' // sales_manager enlazada con Ana (EJEC_A)
const OTRA_ID = '44444444-4444-4444-8444-444444444444' // sales_manager enlazada con Berta (EJEC_B)
const DIRECTORA_ID = '55555555-5555-4555-8555-555555555555' // commercial_director SIN ejecutiva enlazada
const VIEWER_ID = '22222222-2222-4222-8222-222222222222'
const ADMIN_ID = '11111111-1111-4111-8111-111111111111'

const L1 = 'aaaaaaaa-0000-4000-8000-000000000001'
const L2 = 'aaaaaaaa-0000-4000-8000-000000000002'
const L_AJENA = 'aaaaaaaa-0000-4000-8000-000000000009'
const KAM_BGA = 'bbbbbbbb-0000-4000-8000-000000000001'
const EJEC_A = 'eeeeeeee-0000-4000-8000-000000000001'
const EJEC_B = 'eeeeeeee-0000-4000-8000-000000000002'
const C1 = 'cccccccc-0000-4000-8000-000000000001'
const C2 = 'cccccccc-0000-4000-8000-000000000002'
const S1 = 'dddddddd-0000-4000-8000-000000000001' // Clínica Norte, a 120 m
const S2 = 'dddddddd-0000-4000-8000-000000000002' // Clínica Sur, a 800 m
const S3 = 'dddddddd-0000-4000-8000-000000000003' // Consultorio sin coordenadas
const S4 = 'dddddddd-0000-4000-8000-000000000004' // Hospital lejano, a 3 km
const H1 = '12121212-0000-4000-8000-000000000001'
const H_LEJOS = '12121212-0000-4000-8000-000000000002'
const M1 = 'f1f1f1f1-0000-4000-8000-000000000001' // Dra. Ana Gómez: Ana es su visitante
const M2 = 'f1f1f1f1-0000-4000-8000-000000000002' // Dr. Pérez: Ana no es su visitante
const K1 = '13131313-0000-4000-8000-000000000001'
const VMO_ID = '14141414-0000-4000-8000-000000000001'
const AYER_ID = '14141414-0000-4000-8000-000000000002'
const ANULADA_ID = '14141414-0000-4000-8000-000000000003'
const DOCUMENTO_M1 = '79123456'
const TELEFONO_K1 = '3001234567'

const TEL = { lat: 7.119349, lng: -73.122741 } // el teléfono de Ana (Bucaramanga)
const alNorte = (metros: number) => ({ lat: Math.round((TEL.lat + metros / 111_195.08) * 1e6) / 1e6, lng: TEL.lng })

const SUBTIPO_ID: Record<string, string> = Object.fromEntries(SUBTIPOS_SEMILLA.map(subtipo => [subtipo.codigo, randomUUID()]))

function filaConfig(columnas: Fila): Fila {
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
  }
}

const filaVisitaApp = (extra: Fila): Fila => ({
  id: randomUUID(),
  kam_id: KAM_BGA,
  kam_name: 'Ana Ejecutiva',
  visit_type: 'Visita efectiva',
  contact_type: 'Visita presencial',
  lat: TEL.lat,
  lng: TEL.lng,
  visit_date: HOY,
  hospital_id: null,
  imported_by: null,
  imported_at: null,
  import_id: null,
  created_at: '2026-10-01T15:00:00.000Z',
  updated_at: '2026-10-01T15:00:00.000Z',
  source: 'app',
  executive_id: EJEC_A,
  client_id: randomUUID(),
  tipo: 'medica',
  subtipo_id: null,
  subtipo_codigo: null,
  medico_id: M1,
  cuenta_id: null,
  sede_id: S1,
  contacto_id: null,
  modalidad: 'presencial',
  medio: null,
  efectiva: true,
  failure_reason: null,
  retry_date: null,
  checked_in_at: '2026-10-01T10:00:00.000-05:00',
  reported_at: '2026-10-01T10:05:00.000-05:00',
  distance_m: 100,
  gps_accuracy_m: 10,
  conclusion: 'Visita anterior',
  compromisos: null,
  next_step_date: null,
  transcript: 'TRANSCRIPCION-INTERNA-NO-SALE',
  input_mode: 'toques',
  out_of_territory: false,
  created_by: VENTAS_ID,
  updated_by: VENTAS_ID,
  deleted_at: null,
  deleted_reason: null,
  agenda_id: null,
  agendada: false,
  ...extra,
})

function datosIniciales(): Tablas {
  const user = (id: string, role: string, name: string) => ({ id, email: `${name.toLowerCase()}@test.local`, full_name: name, role, active: true, password: `hash-${id}` })
  const sede = (id: string, cuenta: string, nombre: string, punto: { lat: number; lng: number } | null, extra: Fila = {}) => ({
    id,
    cuenta_id: cuenta,
    nombre,
    es_principal: false,
    reps_code: null,
    direccion: null,
    municipality_id: '68001',
    ciudad: 'Bucaramanga',
    lat: punto?.lat ?? null,
    lng: punto?.lng ?? null,
    hospital_id: null,
    ubicacion_confirmada: true,
    origen: 'manual',
    activo: true,
    created_by: null,
    created_at: '2026-10-12T05:00:00.000Z',
    ...extra,
  })
  return {
    users: [user(VENTAS_ID, 'sales_manager', 'Ventas'), user(OTRA_ID, 'sales_manager', 'Otra'), user(DIRECTORA_ID, 'commercial_director', 'Directora'), user(VIEWER_ID, 'viewer', 'Viewer'), user(ADMIN_ID, 'admin', 'Admin')],
    municipalities: [
      { code: '68001', name: 'Bucaramanga', department_code: '68', lat: 7.119349, lng: -73.122741 },
      { code: '05001', name: 'Medellín', department_code: '05', lat: 6.2442, lng: -75.5812 },
    ],
    kams: [{ id: KAM_BGA, name: 'KAM Bucaramanga', area_id: '68001', lat: 7.119349, lng: -73.122741, active: true }],
    business_lines: [
      { id: L1, code: 'osteo', name: 'Osteosíntesis', leader_user_id: null, active: true },
      { id: L2, code: 'columna', name: 'Columna', leader_user_id: null, active: true },
      { id: L_AJENA, code: 'otra', name: 'Otra', leader_user_id: null, active: true },
    ],
    executives: [
      { id: EJEC_A, full_name: 'Ana Ejecutiva', status: 'active', user_id: VENTAS_ID, base_kam_id: KAM_BGA, started_at: '2026-01-15', left_at: null },
      { id: EJEC_B, full_name: 'Berta Ejecutiva', status: 'active', user_id: OTRA_ID, base_kam_id: KAM_BGA, started_at: '2026-01-15', left_at: null },
    ],
    executive_lines: [
      { executive_id: EJEC_A, line_id: L1 },
      { executive_id: EJEC_A, line_id: L2 },
      { executive_id: EJEC_B, line_id: L1 },
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
    })),
    config_metas: [
      filaConfig({ scope: 'general', kam_id: null, executive_id: null, tipo: 'medica', subtipo_id: null, periodo: 'dia', cantidad: 6, clave: 'general:-:medica:-' }),
      filaConfig({ scope: 'general', kam_id: null, executive_id: null, tipo: 'institucional', subtipo_id: null, periodo: 'dia', cantidad: 1, clave: 'general:-:institucional:-' }),
    ],
    config_conteo: Object.entries(CONTEO_SEMILLA).map(([codigo, modo]) => filaConfig({ subtipo_id: SUBTIPO_ID[codigo], modo, peso: 1, clave: SUBTIPO_ID[codigo] })),
    config_general: Object.keys(CONFIG_GENERAL_DEFECTO).map(parametro => filaConfig({ parametro, valor: CONFIG_GENERAL_DEFECTO[parametro], clave: parametro })),
    // Berta: solo institucional, telefónica habilitada con tope 1.
    config_personas: [filaConfig({ executive_id: EJEC_B, perfil: ['institucional'], telefonica_habilitada: true, tope_telefonicas_dia: 1, radio_m: null, clave: EJEC_B })],
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
    cuentas: [
      { id: C1, nombre: 'Clínica Norte S.A.', clase: 'clinica', tipo_identificacion: 'NIT', numero_identificacion: '900123456', activo: true, es_cliente: true },
      { id: C2, nombre: 'Clínica Sur', clase: 'clinica', tipo_identificacion: 'NIT', numero_identificacion: '900654321', activo: true, es_cliente: false },
    ],
    sedes: [
      sede(S1, C1, 'Clínica Norte', alNorte(120), { es_principal: true, hospital_id: H1, reps_code: '680010000009', origen: 'hospitals' }),
      sede(S2, C2, 'Clínica Sur', alNorte(800), { es_principal: true }),
      sede(S3, C1, 'Consultorio Gómez', null, { ubicacion_confirmada: false }),
      sede(S4, C2, 'Hospital lejano', alNorte(3000)),
    ],
    medicos: [
      { id: M1, nombre: 'Dra. Ana Gómez', especialidades: ['ortopedia'], municipality_id: '68001', tipo_documento: 'CC', numero_documento: DOCUMENTO_M1, telefono: '3109998877', email: null, activo: true },
      { id: M2, nombre: 'Dr. Pérez', especialidades: ['columna'], municipality_id: '68001', tipo_documento: 'CC', numero_documento: '80111222', telefono: null, email: null, activo: true },
    ],
    medico_sedes: [
      { medico_id: M1, sede_id: S1, rol: 'atiende', principal: true },
      { medico_id: M1, sede_id: S3, rol: 'consultorio', principal: false },
      { medico_id: M2, sede_id: S1, rol: 'atiende', principal: true },
    ],
    medico_visitantes: [{ id: randomUUID(), medico_id: M1, executive_id: EJEC_A, line_id: L1, desde: '2026-01-15', hasta: null }],
    contactos: [{ id: K1, cuenta_id: C1, sede_id: S1, nombre: 'Luis Pérez', cargo_texto: 'Jefe de compras', rol: 'compras', telefono: TELEFONO_K1, email: 'luis@clinica.test', activo: true }],
    reps_sedes: [
      { codigo_habilitacion: '680010000001', municipio_sede: '68001', nit: '900123456' },
      // Código público de OTRO prestador de Bucaramanga (no es de la Clínica Norte, C1).
      { codigo_habilitacion: '680010000002', municipio_sede: '68001', nit: '800111222' },
      { codigo_habilitacion: '050010000001', municipio_sede: '05001', nit: '900123456' },
      { codigo_habilitacion: '050010000002', municipio_sede: '05001', nit: '900123456' },
      { codigo_habilitacion: '050010000003', municipio_sede: '05001', nit: '900123456' },
    ],
    // Cobertura (/api/visits/unvisited-zones): H1 junto a las visitas; H_LEJOS solo tiene cerca una visita ANULADA.
    hospitals: [
      { id: H1, name: 'Clínica Norte', code: 'H1', lat: alNorte(120).lat, lng: TEL.lng, municipality_id: '68001', municipality_name: 'Bucaramanga', department_name: 'Santander', active: true, assignments: [{ kam_id: KAM_BGA, kams: { id: KAM_BGA, name: 'Zona Bucaramanga', color: '#123456' } }] },
      { id: H_LEJOS, name: 'Hospital del sur', code: 'H2', lat: alNorte(-50_000).lat, lng: TEL.lng, municipality_id: '68001', municipality_name: 'Bucaramanga', department_name: 'Santander', active: true, assignments: [{ kam_id: KAM_BGA, kams: { id: KAM_BGA, name: 'Zona Bucaramanga', color: '#123456' } }] },
    ],
    visits: [
      // Importada de VMO: el reporte la ignora y no se corrige ni se anula.
      { id: VMO_ID, kam_id: KAM_BGA, kam_name: 'KAM Bucaramanga', visit_type: 'Visita efectiva', contact_type: 'Visita presencial', lat: 7.1, lng: -73.1, visit_date: HOY, hospital_id: null, imported_by: ADMIN_ID, imported_at: '2026-10-13T12:00:00Z', import_id: null, created_at: '2026-10-13T12:00:00Z', updated_at: '2026-10-13T12:00:00Z', source: 'vmo_import', executive_id: null, client_id: null, tipo: null, deleted_at: null, out_of_territory: false },
      // De la app, del 1 de octubre, institucional con próxima reunión el 10 (compromiso vencido) y de ayer.
      filaVisitaApp({ visit_date: '2026-10-01', tipo: 'institucional', medico_id: null, cuenta_id: C2, sede_id: S2, subtipo_id: SUBTIPO_ID.compras, subtipo_codigo: 'compras', next_step_date: '2026-10-10' }),
      filaVisitaApp({ id: AYER_ID, visit_date: AYER, checked_in_at: '2026-10-12T09:00:00.000-05:00', reported_at: '2026-10-12T09:05:00.000-05:00' }),
      // De Berta, anulada, junto al Hospital del sur: no debe marcarlo como visitado ni sumar en las estadísticas.
      filaVisitaApp({ id: ANULADA_ID, executive_id: EJEC_B, visit_date: '2026-10-02', checked_in_at: '2026-10-02T09:00:00.000-05:00', reported_at: '2026-10-02T09:05:00.000-05:00', lat: alNorte(-50_000).lat, lng: TEL.lng, deleted_at: '2026-10-02T15:00:00.000Z', deleted_reason: 'Reporté el médico equivocado' }),
    ],
    visit_lines: [],
    visitas_agenda: [],
  }
}

// ---------------------------------------------------------------------------
// Peticiones
// ---------------------------------------------------------------------------

const tokenDe = (userId: string) => signSession(userId, passwordVersion(`hash-${userId}`))

interface OpcionesPeticion {
  method?: string
  body?: unknown
  userId?: string | null
  /** Como la app: el token en Authorization: Bearer (sin cookie). */
  portador?: boolean
  id?: string
}

function apiRequest(path: string, options: OpcionesPeticion = {}) {
  const userId = options.userId === undefined ? VENTAS_ID : options.userId
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (userId) {
    if (options.portador) headers.authorization = `Bearer ${tokenDe(userId)}`
    else headers.cookie = `${SESSION_COOKIE_NAME}=${encodeURIComponent(tokenDe(userId))}`
  }
  return new NextRequest(`http://localhost:3000${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  })
}

async function leer(response: Response): Promise<{ status: number; body: any; texto: string; headers: Headers }> {
  const texto = await response.text()
  let body: any = null
  try {
    body = texto ? JSON.parse(texto) : null
  } catch {
    body = texto
  }
  return { status: response.status, body, texto, headers: response.headers }
}

type Handler = (request: NextRequest, contexto: { params: { id: string } }) => Promise<Response>

async function pedir(handler: Handler, path: string, opciones: OpcionesPeticion = {}) {
  return leer(await handler(apiRequest(path, opciones), { params: { id: opciones.id ?? '' } }))
}

/** POST /api/auth/login con ese cuerpo (sin sesión: es la ruta pública), desde una IP propia de estas pruebas. */
async function pedirLogin(handler: (request: NextRequest) => Promise<Response>, cuerpo: Fila) {
  return leer(await handler(new NextRequest('http://localhost:3000/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json', 'x-real-ip': '10.83.0.1' }, body: JSON.stringify(cuerpo) })))
}

/** POST multipart con el audio (como la app), con el token de portador. */
async function subirAudio(audio: Blob | null, opciones: { nombre?: string; duracion?: string; userId?: string } = {}) {
  const formulario = new FormData()
  if (audio) formulario.append('audio', audio, opciones.nombre ?? 'dictado.m4a')
  if (opciones.duracion !== undefined) formulario.append('duracion_s', opciones.duracion)
  const request = new NextRequest('http://localhost:3000/api/me/voz/transcribir', {
    method: 'POST',
    headers: { authorization: `Bearer ${tokenDe(opciones.userId ?? VENTAS_ID)}` },
    body: formulario,
  })
  return leer(await transcribir(request))
}

/** Cuerpo de una visita como lo arma la app (mobile/lib/propuesta.ts cuerpoDesdeBorrador). */
function cuerpoVisita(extra: Fila = {}): Fila {
  return {
    client_id: randomUUID(),
    tipo: 'medica',
    subtipo_id: null,
    medico_id: M1,
    cuenta_id: null,
    sede_id: S1,
    contacto_id: null,
    modalidad: 'presencial',
    medio: null,
    efectiva: true,
    failure_reason: null,
    retry_date: null,
    checked_in_at: '2026-10-13T10:40:00.000-05:00',
    reported_at: '2026-10-13T10:41:30.000-05:00',
    lat: TEL.lat,
    lng: TEL.lng,
    gps_accuracy_m: 12,
    conclusion: 'Le interesó el tornillo canulado',
    compromisos: 'Enviar muestra',
    next_step_date: '2026-10-20',
    transcript: null,
    input_mode: 'toques',
    lineas: [L1],
    ...extra,
  }
}

const ok = (forma: FormaApi, objeto: unknown) => tieneClaves(objeto, forma)
const todosCon = (forma: FormaApi, lista: unknown) => Array.isArray(lista) && lista.every(item => tieneClaves(item, forma))

// ---------------------------------------------------------------------------
// Proveedores de voz FALSOS
// ---------------------------------------------------------------------------

const TRANSCRIPCION = 'Estuve con la doctora Gómez en la Clínica Norte, le gustó el tornillo canulado. Vi al doctor Ramírez. Luis de compras no estaba.'
const llamadasOpenAI: { model: string; language?: string; prompt?: string; esArchivo: boolean; tamano: number; nombre: string }[] = []
const llamadasClaude: Anthropic.Beta.Messages.MessageCreateParamsNonStreaming[] = []
let modoOpenAI: 'ok' | 'sin_modelo' | 'falla' = 'ok'
// Recibe la petición: así una prueba responde distinto a la petición completa y a la mínima de respaldo.
let respuestaClaude: (body: Anthropic.Beta.Messages.MessageCreateParamsNonStreaming) => Anthropic.Beta.Messages.BetaMessage = () => mensajeClaude(entradaClaude())

function entradaClaude(): Fila {
  const base = { subtipo_codigo: null, cuenta_id: null, contacto_id: null, contacto_nombre_dicho: null, failure_reason: null, compromisos: null, next_step_date: null, preguntas: [] as string[] }
  return {
    visitas: [
      { ...base, tipo: 'medica', medico_id: M1, medico_nombre_dicho: null, sugerir_crear_medico: false, sede_id: S1, lineas: [L1], efectiva: true, conclusion: `Le gustó el tornillo canulado; su cédula es ${DOCUMENTO_M1.slice(0, 2)}.${DOCUMENTO_M1.slice(2, 5)}.${DOCUMENTO_M1.slice(5)}`, compromisos: 'Enviar muestra', next_step_date: '2026-10-20', modalidad_sugerida: 'presencial', confianza: 0.92 },
      // M2 existe en OpMap pero no está en el contexto (Ana no es su visitante): Claude no puede elegirlo.
      { ...base, tipo: 'medica', medico_id: M2, medico_nombre_dicho: 'Dr. Ramírez 3001234567', sugerir_crear_medico: false, sede_id: S1, lineas: [L1, L_AJENA], efectiva: true, conclusion: null, modalidad_sugerida: 'presencial', confianza: 0.4, preguntas: ['¿Ramírez de columna?'] },
      { ...base, tipo: 'institucional', medico_id: null, medico_nombre_dicho: null, sugerir_crear_medico: false, subtipo_codigo: 'compras', cuenta_id: C1, sede_id: S1, contacto_id: K1, lineas: [L1], efectiva: false, failure_reason: 'No estaba el jefe de compras', conclusion: null, modalidad_sugerida: 'presencial', confianza: 0.8 },
    ],
    aviso: null,
  }
}

function mensajeClaude(entrada: unknown, stop: 'tool_use' | 'refusal' | 'end_turn' = 'tool_use', herramienta = 'proponer_visitas'): Anthropic.Beta.Messages.BetaMessage {
  return {
    id: 'msg_falso',
    type: 'message',
    role: 'assistant',
    model: MODELO_PROPUESTA,
    stop_reason: stop,
    stop_sequence: null,
    content: stop === 'tool_use' ? [{ type: 'tool_use', id: 'toolu_falso', name: herramienta, input: entrada }] : [{ type: 'text', text: 'No puedo.' }],
    usage: { input_tokens: 1000, output_tokens: 300 },
  } as unknown as Anthropic.Beta.Messages.BetaMessage
}

/** Un 400 invalid_request_error de Anthropic (Anthropic rechaza la PETICIÓN), con request-id en la cabecera. */
const REQUEST_ID_PRUEBA = 'req_prueba_minima_01'
function error400Claude(mensaje: string): InstanceType<typeof Anthropic.APIError> {
  return Anthropic.APIError.generate(400, { type: 'error', error: { type: 'invalid_request_error', message: mensaje }, request_id: REQUEST_ID_PRUEBA }, undefined, new Headers({ 'request-id': REQUEST_ID_PRUEBA }))
}

/** ¿La petición lleva algo de lo que la mínima de respaldo quita? (betas, fallbacks, thinking, strict) */
function esPeticionCompleta(body: Anthropic.Beta.Messages.MessageCreateParamsNonStreaming | undefined): boolean {
  if (!body) return false
  const conStrict = (body.tools ?? []).some(tool => 'strict' in tool)
  return Boolean(body.betas?.length) || 'fallbacks' in body || 'thinking' in body || conStrict
}

/**
 * La petición mínima: ninguno de esos parámetros, output_config SOLO con effort 'low' (sin él Sonnet 5.5 razona con
 * effort 'high' y no cabe en los 60 s), max_tokens MAX_TOKENS_PETICION_MINIMA y la herramienta sin strict, con
 * tool_choice 'auto' (no forzado).
 */
function esPeticionMinima(body: Anthropic.Beta.Messages.MessageCreateParamsNonStreaming | undefined, herramienta: string): boolean {
  if (!body) return false
  const tools = (body.tools ?? []) as Anthropic.Beta.Messages.BetaTool[]
  return (
    !('betas' in body) &&
    !('fallbacks' in body) &&
    !('thinking' in body) &&
    JSON.stringify(body.output_config) === JSON.stringify({ effort: 'low' }) &&
    body.max_tokens === MAX_TOKENS_PETICION_MINIMA &&
    tools.length === 1 &&
    tools[0].name === herramienta &&
    !('strict' in tools[0]) &&
    body.tool_choice?.type === 'auto' &&
    body.tool_choice.disable_parallel_tool_use === true
  )
}

const clienteOpenAI: ClienteTranscripcion = {
  audio: {
    transcriptions: {
      create: async body => {
        llamadasOpenAI.push({ model: body.model, language: body.language, prompt: body.prompt, esArchivo: body.file instanceof Blob, tamano: body.file.size, nombre: body.file.name })
        if (modoOpenAI === 'sin_modelo' && body.model === MODELO_TRANSCRIPCION) {
          throw OpenAI.APIError.generate(404, { error: { code: 'model_not_found', message: 'The model `gpt-4o-transcribe` does not exist' } }, undefined, new Headers())
        }
        if (modoOpenAI === 'falla') throw OpenAI.APIError.generate(500, { error: { message: 'boom' } }, undefined, new Headers())
        return { text: `  ${TRANSCRIPCION}  ` }
      },
    },
  },
}
const clienteClaude: ClientePropuesta = {
  beta: {
    messages: {
      create: async body => {
        llamadasClaude.push(body)
        return respuestaClaude(body)
      },
    },
  },
}

// ---------------------------------------------------------------------------
// Pruebas
// ---------------------------------------------------------------------------

async function main() {
  const tablas = datosIniciales()
  const fake = fakeSupabase(tablas)
  fetchHandler = fake.handler
  fijarFabricasVoz({ openai: () => clienteOpenAI, anthropic: () => clienteClaude })
  const visitasApp = () => tablas.visits.filter(v => v.source === 'app')
  const porId = (id: string | undefined) => tablas.visits.find(v => v.id === id)

  try {
    print('1. Permisos y sesión')
    {
      const X = '99999999-9999-4999-8999-999999999999'
      const rutas: [string, Handler, string, string?][] = [
        ['GET /api/me/contexto', verContexto, '/api/me/contexto'],
        ['GET /api/me/visitas', verVisitas, '/api/me/visitas'],
        ['POST /api/me/visitas', reportarVisita, '/api/me/visitas', 'POST'],
        ['PATCH /api/me/visitas/[id]', corregirVisita, `/api/me/visitas/${X}`, 'PATCH'],
        ['POST /api/me/visitas/[id]/anular', anularVisita, `/api/me/visitas/${X}/anular`, 'POST'],
        ['POST /api/me/voz/proponer', proponer, '/api/me/voz/proponer', 'POST'],
        ['GET /api/me/numeros', verNumeros, '/api/me/numeros'],
      ]
      const antes = fake.writes().length
      for (const [nombre, handler, path, method] of rutas) {
        const viewer = await pedir(handler, path, { method, userId: VIEWER_ID, id: X, body: method ? {} : undefined })
        check(`viewer → 403 en ${nombre}`, viewer.status === 403, viewer)
        const directora = await pedir(handler, path, { method, userId: DIRECTORA_ID, id: X, body: method ? {} : undefined, portador: true })
        check(`usuario sin Ejecutivo Comercial → 403 "${MENSAJE_SIN_EJECUTIVA}" en ${nombre}`, directora.status === 403 && directora.body?.error === MENSAJE_SIN_EJECUTIVA, directora)
        const anonimo = await pedir(handler, path, { method, userId: null, id: X, body: method ? {} : undefined })
        check(`sin sesión → 401 en ${nombre}`, anonimo.status === 401, anonimo)
      }
      const audioDirectora = await subirAudio(new Blob([new Uint8Array(10)], { type: 'audio/m4a' }), { userId: DIRECTORA_ID })
      check('usuario sin Ejecutivo Comercial → 403 en POST /api/me/voz/transcribir', audioDirectora.status === 403, audioDirectora)
      check('ningún rechazo escribió nada', fake.writes().length === antes, fake.writes().slice(antes))
    }

    print('\n2. GET /api/me/contexto (con el punto del teléfono y sin él)')
    {
      const r = await pedir(verContexto, `/api/me/contexto?lat=${TEL.lat}&lng=${TEL.lng}&precision=12`, { portador: true })
      const c = r.body as W.ContextoResponse
      check('200 con el token de portador (como la app)', r.status === 200, r)
      check('claves de la respuesta y de cada parte = mobile/lib/claves-api.ts', ok('contexto', c) && ok('contextoEjecutiva', c.ejecutiva) && todosCon('linea', c.ejecutiva.lineas) && ok('hoy', c.hoy) && ok('hechas', c.hoy.hechas) && ok('config', c.config) && ok('telefonica', c.config.telefonica) && todosCon('sedeCerca', c.sedes_cerca) && todosCon('medico', c.mis_medicos) && c.mis_medicos.every(m => todosCon('sedeDeMedico', m.sedes)) && todosCon('contacto', c.contactos) && todosCon('subtipo', c.subtipos) && todosCon('compromiso', c.compromisos_vencidos) && ok('voz', c.voz), clavesDe(c))
      check('ejecutiva: Ana, zona sin "KAM", municipio 68001, sus dos líneas', c.ejecutiva.nombre === 'Ana Ejecutiva' && c.ejecutiva.zona === 'Bucaramanga' && c.ejecutiva.municipio === '68001' && c.ejecutiva.lineas.length === 2, c.ejecutiva)
      const ids = c.sedes_cerca.map(s => s.id)
      check('sedes a menos de 1 km, la más cercana primero (la sin coordenadas y la de 3 km no salen)', ids.join(',') === `${S1},${S2}` && Math.abs(c.sedes_cerca[0].distancia_m - 120) <= 1 && Math.abs(c.sedes_cerca[1].distancia_m - 800) <= 1, c.sedes_cerca)
      check('sede cercana con su cuenta, IPS (hospital_id) y ubicación confirmada', c.sedes_cerca[0].cuenta_nombre === 'Clínica Norte S.A.' && c.sedes_cerca[0].hospital_id === H1 && c.sedes_cerca[0].ubicacion_confirmada === true)
      const m1 = c.mis_medicos.find(m => m.id === M1)
      check('mis médicos: solo de los que es visitante (M1, no M2), con sus sedes y distancias', c.mis_medicos.length === 1 && !!m1 && m1.sedes[0].id === S1 && m1.sedes[0].distancia_m !== null && m1.sedes.find(s => s.id === S3)?.distancia_m === null && m1.lineas.join() === L1, c.mis_medicos)
      check('contactos de las cuentas cercanas, sin teléfono ni correo', c.contactos.length === 1 && c.contactos[0].id === K1 && !('telefono' in c.contactos[0]) && !('email' in c.contactos[0]))
      check('nunca documentos ni teléfonos en la respuesta', !r.texto.includes(DOCUMENTO_M1) && !r.texto.includes(TELEFONO_K1) && !r.texto.includes('3109998877') && !r.texto.includes('TRANSCRIPCION-INTERNA'))
      check('meta del día: 6 médicas y 1 institucional (martes hábil), nada hecho aún', c.hoy.fecha === HOY && c.hoy.meta.medica === 6 && c.hoy.meta.institucional === 1 && c.hoy.hechas.medicas === 0 && !c.hoy.cuota_dia_ok, c.hoy)
      check('configuración por defecto: radio 500, telefónica no habilitada, tope 1 por médico, perfil completo', c.config.radio_m === 500 && !c.config.telefonica.habilitada && c.config.tope_visitas_medico_dia === 1 && c.config.perfil.join() === 'medica,institucional', c.config)
      check('compromiso vencido: la institucional del 1 de octubre con próxima reunión el 10', c.compromisos_vencidos.length === 1 && c.compromisos_vencidos[0].con === 'Clínica Sur' && c.compromisos_vencidos[0].next_step_date === '2026-10-10', c.compromisos_vencidos)
      check('voz sin llaves: transcribir y proponer en false', c.voz.transcribir === false && c.voz.proponer === false)
      const sinPunto = await pedir(verContexto, '/api/me/contexto', { portador: true })
      check('sin lat/lng: sedes_cerca y contactos vacíos, médicos sin distancias', sinPunto.status === 200 && sinPunto.body.sedes_cerca.length === 0 && sinPunto.body.contactos.length === 0 && sinPunto.body.mis_medicos[0].sedes.every((s: { distancia_m: number | null }) => s.distancia_m === null), sinPunto.body)
      const porPost = await pedir(pedirContexto, '/api/me/contexto', { method: 'POST', body: { lat: TEL.lat, lng: TEL.lng, precision: 12 }, portador: true })
      check(
        'POST /api/me/contexto con el punto en el CUERPO (la app ya no lo pone en la URL, que queda en los logs): lo mismo que el GET',
        porPost.status === 200 && ok('contexto', porPost.body) && porPost.body.sedes_cerca.map((x: { id: string }) => x.id).join(',') === ids.join(',') && porPost.body.mis_medicos[0].sedes[0].distancia_m !== null,
        porPost.body
      )
      const postSinPunto = await pedir(pedirContexto, '/api/me/contexto', { method: 'POST', body: {}, portador: true })
      check('POST sin punto: como el GET sin lat/lng', postSinPunto.status === 200 && postSinPunto.body.sedes_cerca.length === 0)
      const postMalo = await pedir(pedirContexto, '/api/me/contexto', { method: 'POST', body: { lat: 4.7 }, portador: true })
      check('POST con latitud sin longitud: 400', postMalo.status === 400, postMalo.body)
      const malo = await pedir(verContexto, '/api/me/contexto?lat=200&lng=1')
      check('latitud fuera de rango → 400', malo.status === 400, malo)
    }

    print('\n3. POST /api/me/visitas: reglas (la pre-validación y la base dicen lo mismo)')
    {
      const antes = visitasApp().length
      const rechazo = async (nombre: string, cuerpo: Fila, mensaje: string, userId = VENTAS_ID) => {
        const r = await pedir(reportarVisita, '/api/me/visitas', { method: 'POST', body: cuerpo, portador: true, userId })
        check(nombre, r.status === 400 && r.body?.error === mensaje && Array.isArray(r.body?.errores) && r.body.errores.some((e: { mensaje: string }) => e.mensaje === mensaje), r.body)
      }
      const lejos = alNorte(-680) // a ~800 m de la Clínica Norte
      const distancia = haversineM(lejos, alNorte(120))
      await rechazo('presencial a 800 m: 400 "Estás a N m de Clínica Norte; el radio es 500 m"', cuerpoVisita({ ...lejos }), mensajeFueraDeRadio(distancia, 'Clínica Norte', 500))
      await rechazo('sede sin coordenadas: presencial rechazada (decisión 6)', cuerpoVisita({ sede_id: S3 }), MENSAJE_SEDE_SIN_UBICACION)
      await rechazo('telefónica sin habilitar: 400', cuerpoVisita({ modalidad: 'telefonica', medio: 'llamada', lat: null, lng: null }), MENSAJE_TELEFONICA_NO_HABILITADA)
      await rechazo('ayer: 400 "Solo se reportan visitas del mismo día"', cuerpoVisita({ checked_in_at: '2026-10-12T16:00:00.000-05:00', reported_at: '2026-10-12T16:05:00.000-05:00' }), MENSAJE_SOLO_HOY)
      await rechazo('llegada 30 minutos en el futuro: 400 (la base tolera 5 minutos)', cuerpoVisita({ checked_in_at: '2026-10-13T11:12:00.000-05:00', reported_at: '2026-10-13T11:13:00.000-05:00' }), MENSAJE_LLEGADA_FUTURA)
      await rechazo('líneas ajenas: 400', cuerpoVisita({ lineas: [L1, L_AJENA] }), MENSAJE_LINEAS_AJENAS)
      await rechazo('médico que no atiende en esa sede: 400', cuerpoVisita({ sede_id: S2, ...alNorte(800) }), 'El médico no atiende en esa sede')
      await rechazo('perfil solo institucional (Berta): médica 400', cuerpoVisita({ medico_id: M1 }), mensajePerfil('medica'), OTRA_ID)
      await rechazo('reported_at 8 minutos en el futuro (reloj del teléfono adelantado): 400', cuerpoVisita({ reported_at: '2026-10-13T10:50:00.000-05:00' }), MENSAJE_REPORTE_FUTURO)
      await rechazo('próxima reunión anterior a la visita: 400 (nunca nace como compromiso vencido)', cuerpoVisita({ next_step_date: '2026-10-12' }), MENSAJE_PROXIMA_ANTES_DE_VISITA)
      await rechazo('fecha para reintentar anterior a la visita: 400', cuerpoVisita({ efectiva: false, failure_reason: 'No estaba', retry_date: '2026-10-01' }), MENSAJE_REINTENTO_ANTES_DE_VISITA)
      const cuentaSur = tablas.cuentas.find(c => c.id === C2) as Fila
      cuentaSur.activo = false
      await rechazo(
        'institucional en una cuenta desactivada (sus sedes siguen activas): 400',
        cuerpoVisita({ tipo: 'institucional', medico_id: null, cuenta_id: C2, sede_id: S2, subtipo_id: SUBTIPO_ID.compras, ...alNorte(800) }),
        MENSAJE_CUENTA_INACTIVA
      )
      cuentaSur.activo = true
      const contactoLuis = tablas.contactos.find(c => c.id === K1) as Fila
      contactoLuis.activo = false
      await rechazo(
        'institucional con un contacto dado de baja: 400',
        cuerpoVisita({ tipo: 'institucional', medico_id: null, cuenta_id: C1, subtipo_id: SUBTIPO_ID.compras, contacto_id: K1 }),
        MENSAJE_CONTACTO_INACTIVO
      )
      contactoLuis.activo = true
      const sinMotivo = await pedir(reportarVisita, '/api/me/visitas', { method: 'POST', body: cuerpoVisita({ efectiva: false, failure_reason: null }), portador: true })
      check('no efectiva sin motivo: 400 del esquema (con errores por campo)', sinMotivo.status === 400 && sinMotivo.body.errores?.some((e: { campo: string }) => e.campo === 'failure_reason'), sinMotivo.body)
      check('ningún rechazo llegó a visitas_registrar ni guardó nada', visitasApp().length === antes && !fake.rpcs.some(r => r.nombre === 'visitas_registrar'), fake.rpcs)

      const cuerpo = cuerpoVisita()
      const r = await pedir(reportarVisita, '/api/me/visitas', { method: 'POST', body: cuerpo, portador: true })
      const fila = visitasApp().find(v => v.client_id === cuerpo.client_id)
      check('médica presencial a 120 m: 201 { visita, repetida: false }', r.status === 201 && r.body.repetida === false && ok('visitaCreateResponse', r.body) && ok('visitaItem', r.body.visita), r.body)
      check('la visita vuelve con lo que suma (médica, peso 1), editable, sin la transcripción', r.body.visita.cuenta_para === 'medica' && r.body.visita.peso === 1 && r.body.visita.editable === true && Math.abs(r.body.visita.distance_m - 120) <= 1 && !('transcript' in r.body.visita))
      check('la fila llena el mapa de calor (decisión 3): zona, nombre de la ejecutiva, tipos de VMO, punto, fecha e IPS', !!fila && fila.kam_id === KAM_BGA && fila.kam_name === 'Ana Ejecutiva' && fila.visit_type === 'Visita efectiva' && fila.contact_type === 'Visita presencial' && fila.lat === TEL.lat && fila.visit_date === HOY && fila.hospital_id === H1 && fila.out_of_territory === false && fila.created_by === VENTAS_ID, fila)
      check('sus líneas quedaron en visit_lines', tablas.visit_lines.filter(vl => vl.visit_id === fila?.id).map(vl => vl.line_id).join() === L1)
      const rpc = fake.rpcs.filter(x => x.nombre === 'visitas_registrar').at(-1)
      check('el jsonb de visitas_registrar lleva la ejecutiva de la sesión y solo las claves del contrato', rpc?.args.p_user === VENTAS_ID && rpc?.args.p.executive_id === EJEC_A && clavesDe(rpc?.args.p).join() === [...CLAVES_API.visitaCreate, 'executive_id'].sort().join(), rpc?.args)

      const repetida = await pedir(reportarVisita, '/api/me/visitas', { method: 'POST', body: cuerpo, portador: true })
      check('el mismo client_id otra vez: 201 repetida: true y una sola fila', repetida.status === 201 && repetida.body.repetida === true && repetida.body.visita.id === fila?.id && visitasApp().filter(v => v.client_id === cuerpo.client_id).length === 1, repetida.body)
      const reintentoTarde = await pedir(reportarVisita, '/api/me/visitas', { method: 'POST', body: { ...cuerpo, sede_id: S3 }, portador: true })
      check('reintento con el mismo client_id aunque ya no pasaría las reglas: devuelve la que estaba (no 400)', reintentoTarde.status === 201 && reintentoTarde.body.repetida === true)
      const ajeno = await pedir(reportarVisita, '/api/me/visitas', { method: 'POST', body: { ...cuerpo, medico_id: null, tipo: 'institucional', cuenta_id: C1, subtipo_id: SUBTIPO_ID.compras }, portador: true, userId: OTRA_ID })
      check('el mismo client_id desde otra ejecutiva: 409', ajeno.status === 409, ajeno)

      await rechazo('tope por médico: segunda efectiva a la Dra. Gómez hoy → 400', cuerpoVisita(), MENSAJE_TOPE_MEDICO)
      const noEfectiva = await pedir(reportarVisita, '/api/me/visitas', { method: 'POST', body: cuerpoVisita({ efectiva: false, failure_reason: 'Salió a cirugía' }), portador: true })
      check('una no efectiva al mismo médico sí entra (no suma)', noEfectiva.status === 201 && noEfectiva.body.visita.cuenta_para === null && noEfectiva.body.visita.peso === 0, noEfectiva.body)

      const fuera = await pedir(reportarVisita, '/api/me/visitas', { method: 'POST', body: cuerpoVisita({ medico_id: M2 }), portador: true })
      check('médico del que no es visitante: suma igual y queda out_of_territory', fuera.status === 201 && fuera.body.visita.out_of_territory === true && fuera.body.visita.cuenta_para === 'medica', fuera.body)

      const inst = await pedir(reportarVisita, '/api/me/visitas', {
        method: 'POST',
        body: cuerpoVisita({ tipo: 'institucional', medico_id: null, cuenta_id: C1, subtipo_id: SUBTIPO_ID.compras, contacto_id: K1 }),
        portador: true,
      })
      const filaInst = porId(inst.body?.visita?.id)
      check('institucional con subtipo y contacto: 201, copia subtipo_codigo y suma a la institucional', inst.status === 201 && filaInst?.subtipo_codigo === 'compras' && inst.body.visita.cuenta_para === 'institucional' && inst.body.visita.contacto?.nombre === 'Luis Pérez' && inst.body.visita.subtipo?.codigo === 'compras', inst.body)

      // Berta: solo institucional, telefónica con tope 1.
      // Berta llama desde su casa (a 5 km): el GPS del teléfono NUNCA queda en la visita ni en el mapa de calor.
      const CASA = alNorte(5000)
      const tel = (extra: Fila = {}) => cuerpoVisita({ tipo: 'institucional', medico_id: null, cuenta_id: C2, sede_id: S2, subtipo_id: SUBTIPO_ID.compras, modalidad: 'telefonica', medio: 'llamada', lat: CASA.lat, lng: CASA.lng, gps_accuracy_m: 9, ...extra })
      const telefonica = await pedir(reportarVisita, '/api/me/visitas', { method: 'POST', body: tel(), portador: true, userId: OTRA_ID })
      const filaTel = porId(telefonica.body?.visita?.id)
      check('telefónica habilitada (Berta): 201, contact_type "Visita virtual", el punto de la sede y sin la precisión del GPS', telefonica.status === 201 && filaTel?.contact_type === 'Visita virtual' && filaTel?.lat === alNorte(800).lat && filaTel?.distance_m === null && filaTel?.gps_accuracy_m === null, telefonica.body)
      await rechazo('segunda telefónica de Berta: tope del día (1)', tel(), mensajeTopeTelefonicas(1), OTRA_ID)
      // Con cupo (tope 2) y solo "llamada" vigente: la videollamada se rechaza por el medio.
      const configBerta = tablas.config_personas.find(f => f.executive_id === EJEC_B) as Fila
      const telefonicasGeneral = tablas.config_general.find(f => f.parametro === 'telefonicas') as Fila
      const valorOriginal = telefonicasGeneral.valor
      configBerta.tope_telefonicas_dia = 2
      telefonicasGeneral.valor = { ...valorOriginal, medios: ['llamada'] }
      await rechazo('telefónica con un medio que no está vigente: 400 "Medio no válido: llamada"', tel({ medio: 'videollamada' }), 'Medio no válido: llamada', OTRA_ID)
      const rpcTel = fake.rpcs.filter(x => x.nombre === 'visitas_registrar').at(-1)
      check('el jsonb de una telefónica no lleva la ubicación ni la precisión del teléfono', rpcTel?.args.p.modalidad === 'telefonica' && rpcTel?.args.p.lat === null && rpcTel?.args.p.lng === null && rpcTel?.args.p.gps_accuracy_m === null, rpcTel?.args.p)
      const sinCoordenadas = await pedir(reportarVisita, '/api/me/visitas', { method: 'POST', body: tel({ cuenta_id: C1, sede_id: S3 }), portador: true, userId: OTRA_ID })
      const filaS3 = porId(sinCoordenadas.body?.visita?.id)
      check(
        'telefónica a una sede sin coordenadas, llamando desde la casa: el punto del mapa es el municipio de la sede, nunca el teléfono',
        sinCoordenadas.status === 201 && filaS3?.lat === 7.119349 && filaS3?.lng === -73.122741 && filaS3?.lat !== CASA.lat,
        filaS3 ?? sinCoordenadas.body
      )
      configBerta.tope_telefonicas_dia = 1
      telefonicasGeneral.valor = valorOriginal

      fake.estado.rechazoForzado = MENSAJE_TOPE_MEDICO
      const carrera = await pedir(reportarVisita, '/api/me/visitas', { method: 'POST', body: cuerpoVisita({ medico_id: M2, efectiva: false, failure_reason: 'No estaba' }), portador: true })
      fake.estado.rechazoForzado = null
      check('la base rechaza lo que la pre-validación no vio (otra visita en el mismo instante): 400 con su mensaje y nada guardado', carrera.status === 400 && carrera.body.error === MENSAJE_TOPE_MEDICO && !visitasApp().some(v => v.failure_reason === 'No estaba'), carrera.body)
    }

    print('\n4. GET /api/me/visitas, PATCH (corregir) y anular: solo el mismo día')
    {
      const r = await pedir(verVisitas, '/api/me/visitas', { portador: true })
      check('200 con las de hoy (sin la importada de VMO), claves de la app', r.status === 200 && ok('visitas', r.body) && todosCon('visitaItem', r.body.items) && r.body.fecha === HOY && r.body.items.length === 4 && r.body.items.every((v: { editable: boolean }) => v.editable), r.body)
      check('nunca la transcripción en la lista', !r.texto.includes('TRANSCRIPCION-INTERNA') && !r.texto.includes('"transcript"'))
      const deAyer = await pedir(verVisitas, `/api/me/visitas?fecha=${AYER}`, { portador: true })
      check('las de ayer: no editables', deAyer.status === 200 && deAyer.body.items.length === 1 && deAyer.body.items[0].editable === false, deAyer.body)

      const efectiva = r.body.items.find((v: W.VisitaItem) => v.tipo === 'medica' && v.efectiva && !v.out_of_territory) as W.VisitaItem
      const corregir = (id: string, body: Fila, userId = VENTAS_ID) => pedir(corregirVisita, `/api/me/visitas/${id}`, { method: 'PATCH', body, id, portador: true, userId })
      const conclusion = await corregir(efectiva.id, { conclusion: 'Quedó en revisar la cotización', lineas: [L2, L1] })
      check('corregir conclusión y líneas el mismo día: 200 { visita } actualizada', conclusion.status === 200 && conclusion.body.visita.conclusion === 'Quedó en revisar la cotización' && conclusion.body.visita.lineas.join() === [L1, L2].sort().join(), conclusion.body)
      const soloTipo = await corregir(efectiva.id, { tipo: 'institucional' })
      check('tipo, médico o sede no se corrigen (el esquema los descarta: "No hay campos para corregir")', soloTipo.status === 400, soloTipo.body)
      const noEfectivaSinMotivo = await corregir(efectiva.id, { efectiva: false })
      check('pasar a no efectiva sin motivo: 400', noEfectivaSinMotivo.status === 400, noEfectivaSinMotivo.body)
      const proximaAyer = await corregir(efectiva.id, { next_step_date: '2026-10-12' })
      check('corregir la próxima reunión a una fecha anterior a la visita: 400 (la base lo rechaza)', proximaAyer.status === 400 && proximaAyer.body.error === MENSAJE_PROXIMA_ANTES_DE_VISITA, proximaAyer.body)
      const aNoEfectiva = await corregir(efectiva.id, { efectiva: false, failure_reason: 'Me equivoqué: no la atendió' })
      check('pasar a no efectiva con motivo: 200 y visit_type "Visita no efectiva"', aNoEfectiva.status === 200 && porId(efectiva.id)?.visit_type === 'Visita no efectiva', aNoEfectiva.body)
      const otra = await pedir(reportarVisita, '/api/me/visitas', { method: 'POST', body: cuerpoVisita(), portador: true })
      check('con la primera ya no efectiva, otra efectiva al mismo médico entra', otra.status === 201, otra.body)
      const volver = await corregir(efectiva.id, { efectiva: true })
      check('volver a efectiva con el tope lleno: 400 (la base revalida los topes)', volver.status === 400 && volver.body.error === MENSAJE_TOPE_MEDICO, volver.body)
      const ajena = await corregir(efectiva.id, { conclusion: 'x' }, OTRA_ID)
      check('la visita de otra ejecutiva: 404', ajena.status === 404, ajena.body)
      const importada = await corregir(VMO_ID, { conclusion: 'x' })
      check('una importada de VMO: 400 "Solo puedes corregir o anular tus visitas del mismo día"', importada.status === 400 && importada.body.error === MENSAJE_VISITA_NO_EDITABLE, importada.body)
      const ayer = await corregir(AYER_ID, { conclusion: 'x' })
      check('una de ayer: 400', ayer.status === 400 && ayer.body.error === MENSAJE_VISITA_NO_EDITABLE, ayer.body)

      const anular = (id: string, motivo: string, userId = VENTAS_ID) => pedir(anularVisita, `/api/me/visitas/${id}/anular`, { method: 'POST', body: { motivo }, id, portador: true, userId })
      const corto = await anular(otra.body.visita.id, 'no')
      check('anular con motivo corto: 400', corto.status === 400, corto.body)
      const anulada = await anular(otra.body.visita.id, 'La reporté dos veces')
      check('anular el mismo día: 200, deleted_at y motivo; la fila no se borra', anulada.status === 200 && !!porId(otra.body.visita.id)?.deleted_at && porId(otra.body.visita.id)?.deleted_reason === 'La reporté dos veces', anulada.body)
      const dosVeces = await anular(otra.body.visita.id, 'Otra vez la misma')
      check('anular dos veces: 400 "Esa visita ya está anulada"', dosVeces.status === 400 && dosVeces.body.error === 'Esa visita ya está anulada', dosVeces.body)
      const corregirAnulada = await corregir(otra.body.visita.id, { conclusion: 'x' })
      check('corregir una anulada: 400', corregirAnulada.status === 400, corregirAnulada.body)
      const ahoraSi = await corregir(efectiva.id, { efectiva: true })
      check('la anulada ya no cuenta para el tope: volver a efectiva ahora sí', ahoraSi.status === 200, ahoraSi.body)
      const anularAjena = await anular(efectiva.id, 'No es mía de verdad', OTRA_ID)
      check('anular la de otra ejecutiva: 404', anularAjena.status === 404, anularAjena.body)
      const lista = await pedir(verVisitas, '/api/me/visitas', { portador: true })
      check('la anulada sale de la lista de hoy', !lista.body.items.some((v: { id: string }) => v.id === otra.body.visita.id))
    }

    print('\n5. GET /api/me/numeros (KPI 1 con la cuota de /api/me/cuota)')
    {
      const r = await pedir(verNumeros, '/api/me/numeros?mes=2026-10', { portador: true })
      const cuota = await pedir(verCuota, '/api/me/cuota?mes=2026-10', { portador: true })
      check('200 con las claves de la app', r.status === 200 && ok('numeros', r.body), r.body)
      check('la cuota es la misma de /api/me/cuota', JSON.stringify(r.body.cuota) === JSON.stringify(cuota.body), { numeros: r.body.cuota, cuota: cuota.body })
      // Efectivas de Ana en octubre: la del 12 (médica) y las de hoy: médica M1, médica M2 (fuera de territorio) e
      // institucional de compras. La del 1 de octubre es anterior a la configuración vigente (rige desde el 12): no
      // suma. La no efectiva y la anulada tampoco.
      check('hechas: médicas efectivas × peso (3) e institucionales (1); lo anterior a la configuración no suma', r.body.hechas.medica === 3 && r.body.hechas.institucional === 1, r.body.hechas)
      check('cumplimiento = hechas ÷ cuota (redondeado)', Math.abs(r.body.cumplimiento.medica - 3 / r.body.cuota.medica.cuota) < 0.01 && Math.abs(r.body.cumplimiento.institucional - 1 / r.body.cuota.institucional.cuota) < 0.01, { cumplimiento: r.body.cumplimiento, cuota: r.body.cuota.medica })
      check('no efectivas y fuera de territorio', r.body.no_efectivas >= 1 && r.body.fuera_de_territorio === 1 && r.body.telefonicas === 0, r.body)
      check('días hábiles sin visitas: entero (los ya cerrados, sin contar hoy)', Number.isInteger(r.body.dias_habiles_sin_visitas) && r.body.dias_habiles_sin_visitas >= 1, r.body.dias_habiles_sin_visitas)
      check('Ana: ninguna visita en sedes por confirmar', r.body.sede_por_confirmar === 0, r.body.sede_por_confirmar)

      // Berta: una telefónica a la Clínica Sur (confirmada) y otra al consultorio S3 (por confirmar).
      const bertaAntes = await pedir(verNumeros, '/api/me/numeros?mes=2026-10', { portador: true, userId: OTRA_ID })
      check('Berta: la telefónica de la sede confirmada suma 1; la de la sede por confirmar no (sede_por_confirmar 1)', bertaAntes.body.hechas.institucional === 1 && bertaAntes.body.sede_por_confirmar === 1 && bertaAntes.body.telefonicas === 2, bertaAntes.body)
      const telefonicasGeneral = tablas.config_general.find(f => f.parametro === 'telefonicas') as Fila
      const valorTelefonicas = telefonicasGeneral.valor
      telefonicasGeneral.valor = { ...valorTelefonicas, peso: 0.5 }
      const bertaPeso = await pedir(verNumeros, '/api/me/numeros?mes=2026-10', { portador: true, userId: OTRA_ID })
      const bertaLista = await pedir(verVisitas, '/api/me/visitas', { portador: true, userId: OTRA_ID })
      telefonicasGeneral.valor = valorTelefonicas
      check('la directora pone la telefónica en peso 0,5: Mis números de Berta 0,5 (antes 1)', bertaPeso.body.hechas.institucional === 0.5, bertaPeso.body.hechas)
      check(
        'y GET /api/me/visitas: la telefónica de la sede confirmada pesa 0,5; la de la sede por confirmar no suma y lo dice',
        bertaLista.body.items.some((v: W.VisitaItem) => v.sede.id === S2 && v.modalidad === 'telefonica' && v.peso === 0.5 && v.cuenta_para === 'institucional' && !v.sede_por_confirmar) &&
          bertaLista.body.items.some((v: W.VisitaItem) => v.sede.id === S3 && v.peso === 0 && v.cuenta_para === null && v.sede_por_confirmar),
        bertaLista.body.items
      )
      const malo = await pedir(verNumeros, '/api/me/numeros?mes=2026-13', { portador: true })
      check('mes no válido: 400', malo.status === 400, malo)
    }

    print('\n6. POST /api/me/voz/transcribir (OpenAI falso; el audio no se guarda)')
    {
      const audio = new Blob([new Uint8Array(4096).fill(7)], { type: 'audio/m4a' })
      const sinLlave = await subirAudio(audio, { duracion: '42' })
      check(`sin OPENAI_API_KEY: 503 "${MENSAJE_SIN_OPENAI}" y OpenAI no se llama`, sinLlave.status === 503 && sinLlave.body.error === MENSAJE_SIN_OPENAI && llamadasOpenAI.length === 0, sinLlave)
      process.env.OPENAI_API_KEY = 'sk-prueba-falsa'
      const logsAntes = moduleLogs.length
      const restaurar = vigilarDisco()
      let r: Awaited<ReturnType<typeof subirAudio>>
      try {
        r = await subirAudio(audio, { duracion: '42' })
      } finally {
        restaurar()
      }
      check('200 { transcript, duracion_s, modelo } con las claves de la app', r.status === 200 && ok('transcripcion', r.body) && r.body.transcript === TRANSCRIPCION && r.body.duracion_s === 42 && r.body.modelo === MODELO_TRANSCRIPCION, r.body)
      const llamada = llamadasOpenAI.at(-1)
      check('OpenAI recibe el audio en memoria (File), en español y con el vocabulario de VG', !!llamada && llamada.esArchivo && llamada.tamano === 4096 && llamada.language === 'es' && llamada.model === MODELO_TRANSCRIPCION && (llamada.prompt ?? '').includes('PerOssal') && (llamada.prompt ?? '').includes('Osteosíntesis') && llamada.nombre.endsWith('.m4a'), llamada)
      check('nada se escribió en disco mientras se transcribía', escriturasEnDisco.length === 0, escriturasEnDisco)
      check('ni el audio ni la transcripción salen en los logs', moduleLogs.slice(logsAntes).every(l => !l.includes('tornillo') && !l.includes('Gómez')), moduleLogs.slice(logsAntes))
      modoOpenAI = 'sin_modelo'
      const respaldo = await subirAudio(audio, { duracion: '42' })
      check('si gpt-4o-transcribe no está disponible: whisper-1', respaldo.status === 200 && respaldo.body.modelo === MODELO_TRANSCRIPCION_RESPALDO && llamadasOpenAI.at(-1)?.model === MODELO_TRANSCRIPCION_RESPALDO, respaldo.body)
      modoOpenAI = 'falla'
      const falla = await subirAudio(audio, { duracion: '42' })
      check('OpenAI falla: 502 con el respaldo por toques sugerido', falla.status === 502 && /toques/.test(falla.body.error), falla.body)
      modoOpenAI = 'ok'
      const formato = await subirAudio(new Blob([new Uint8Array(10)], { type: 'image/png' }), { nombre: 'foto.png' })
      check('formato no válido: 400', formato.status === 400, formato.body)
      const sinCampo = await subirAudio(null, { duracion: '10' })
      check('sin el campo "audio": 400', sinCampo.status === 400, sinCampo.body)
      const largo = await subirAudio(audio, { duracion: '200' })
      check('más de 3 minutos: 413', largo.status === 413, largo.body)
      const grande = await subirAudio(new Blob([new Uint8Array(26 * 1024 * 1024)], { type: 'audio/m4a' }), { duracion: '60' })
      check('más de 25 MB: 413', grande.status === 413, grande.body)

      // La duración la lee el servidor del propio archivo (no se fía de lo que declare el cliente).
      const caja = (tipo: string, contenido: Uint8Array) => {
        const b = new Uint8Array(8 + contenido.length)
        new DataView(b.buffer).setUint32(0, b.length)
        for (let i = 0; i < 4; i++) b[4 + i] = tipo.charCodeAt(i)
        b.set(contenido, 8)
        return b
      }
      const m4a = (segundos: number) => {
        const mvhd = new Uint8Array(100)
        new DataView(mvhd.buffer).setUint32(12, 1000)
        new DataView(mvhd.buffer).setUint32(16, Math.round(segundos * 1000))
        const partes = [caja('ftyp', new TextEncoder().encode('M4A isom')), caja('mdat', new Uint8Array(2048).fill(3)), caja('moov', caja('mvhd', mvhd))]
        return new Blob(partes, { type: 'audio/m4a' })
      }
      const llamadasAntes = llamadasOpenAI.length
      const mentira = await subirAudio(m4a(200), { duracion: '42' })
      check('un m4a de 200 s que dice durar 42: 413 (manda la duración del archivo) y OpenAI no se llama', mentira.status === 413 && llamadasOpenAI.length === llamadasAntes, mentira.body)
      const sinDuracion = await subirAudio(new Blob([new Uint8Array(4096).fill(9)], { type: 'audio/webm' }), { nombre: 'dictado.webm' })
      check('un audio que no deja leer su duración y no la declara: 400', sinDuracion.status === 400 && sinDuracion.body.error === MENSAJE_AUDIO_SIN_DURACION && llamadasOpenAI.length === llamadasAntes, sinDuracion.body)
      const leida = await subirAudio(m4a(42.4))
      check('un m4a de 42,4 s sin duración declarada: 200 y duracion_s 42 (la del archivo)', leida.status === 200 && leida.body.duracion_s === 42, leida.body)

      // Límite por persona: 6 transcripciones por minuto (solo cuentan las que llegan a OpenAI).
      reiniciarLimitesVoz()
      const respuestas: number[] = []
      for (let i = 0; i < 7; i++) respuestas.push((await subirAudio(audio, { duracion: '10' })).status)
      const septima = await subirAudio(audio, { duracion: '10' })
      check('6 transcripciones en el mismo minuto pasan; la 7.ª: 429 con el respaldo por toques', respuestas.slice(0, 6).every(st => st === 200) && respuestas[6] === 429 && septima.status === 429 && septima.body.error === MENSAJE_LIMITE_VOZ, { respuestas, septima: septima.body })
      check('el 429 trae Retry-After en segundos: 60 (la primera de las 6 sale de la ventana en un minuto)', septima.headers.get('retry-after') === '60', septima.headers.get('retry-after'))
      const otraPersona = await subirAudio(audio, { duracion: '10', userId: OTRA_ID })
      check('el límite es por persona: Berta sí puede', otraPersona.status === 200, otraPersona.body)
      ahoraMs += 61_000
      const despues = await subirAudio(audio, { duracion: '10' })
      ahoraMs -= 61_000
      check('un minuto después vuelve a poder', despues.status === 200, despues.body)

      // Tope por hora: 40 transcripciones espaciadas 61 s (nunca 6 en un minuto) pasan; la 41.ª, a los 2.440 s de la
      // primera, recibe 429 con Retry-After = lo que falta para que la primera salga de la hora (3.600 − 2.440 = 1.160 s).
      reiniciarLimitesVoz()
      const inicioHora = ahoraMs
      const enLaHora: number[] = []
      try {
        for (let i = 0; i < 40; i++) {
          enLaHora.push((await subirAudio(audio, { duracion: '10' })).status)
          ahoraMs += 61_000
        }
        const llamadasHora = llamadasOpenAI.length
        const cuadragesimaPrimera = await subirAudio(audio, { duracion: '10' })
        check(
          '40 transcripciones en la hora pasan; la 41.ª: 429 con Retry-After 1160 y OpenAI no se llama',
          enLaHora.every(st => st === 200) && cuadragesimaPrimera.status === 429 && cuadragesimaPrimera.body.error === MENSAJE_LIMITE_VOZ && cuadragesimaPrimera.headers.get('retry-after') === '1160' && llamadasOpenAI.length === llamadasHora,
          { enLaHora, status: cuadragesimaPrimera.status, retry: cuadragesimaPrimera.headers.get('retry-after') }
        )
        ahoraMs = inicioHora + 3_600_000
        const pasadaLaHora = await subirAudio(audio, { duracion: '10' })
        check('una hora después de la primera vuelve a poder', pasadaLaHora.status === 200, pasadaLaHora.body)
      } finally {
        ahoraMs = inicioHora
      }
      reiniciarLimitesVoz()
      const contexto = await pedir(verContexto, '/api/me/contexto', { portador: true })
      check('con la llave, el contexto dice voz.transcribir = true', contexto.body.voz.transcribir === true && contexto.body.voz.proponer === false)
    }

    print('\n7. POST /api/me/voz/proponer (Claude falso; nada se guarda sin confirmar)')
    {
      const cuerpo = { transcript: TRANSCRIPCION, lat: TEL.lat, lng: TEL.lng, precision: 12, hora: '2026-10-13T10:41:00.000-05:00' }
      const sinLlave = await pedir(proponer, '/api/me/voz/proponer', { method: 'POST', body: cuerpo, portador: true })
      check(`sin ANTHROPIC_API_KEY: 503 "${MENSAJE_SIN_ANTHROPIC}"`, sinLlave.status === 503 && sinLlave.body.error === MENSAJE_SIN_ANTHROPIC && llamadasClaude.length === 0, sinLlave)
      process.env.ANTHROPIC_API_KEY = 'sk-ant-prueba-falsa'
      const escriturasAntes = fake.writes().length
      const r = await pedir(proponer, '/api/me/voz/proponer', { method: 'POST', body: cuerpo, portador: true })
      check('transcripción de ejemplo → tres visitas propuestas con las claves de la app', r.status === 200 && ok('propuesta', r.body) && todosCon('visitaPropuesta', r.body.visitas) && r.body.visitas.length === 3, r.body)
      check('nada se guardó (la ejecutiva confirma cada tarjeta)', fake.writes().length === escriturasAntes, fake.writes().slice(escriturasAntes))
      const [medica, sinCruce, institucional] = r.body.visitas as W.VisitaPropuesta[]
      check('médica: el médico y la sede del contexto, la fecha dicha', medica.medico_id === M1 && medica.sede_id === S1 && medica.next_step_date === '2026-10-20' && medica.lineas.join() === L1)
      check('el documento dicho no sale (se cambia por "[número omitido]")', !r.texto.includes('79.123.456') && !r.texto.includes(DOCUMENTO_M1) && (medica.conclusion ?? '').includes(NUMERO_OMITIDO), medica.conclusion)
      check('médico que no cruza (id fuera del contexto): medico_id null, nombre dicho sin dígitos, sugerir_crear_medico; no se crea', sinCruce.medico_id === null && sinCruce.medico_nombre_dicho === 'Dr. Ramírez' && sinCruce.sugerir_crear_medico === true && sinCruce.lineas.join() === L1 && tablas.medicos.length === 2, sinCruce)
      check('institucional: subtipo por código, cuenta, sede y contacto del contexto; no efectiva con su motivo', institucional.subtipo_id === SUBTIPO_ID.compras && institucional.cuenta_id === C1 && institucional.sede_id === S1 && institucional.contacto_id === K1 && institucional.efectiva === false && institucional.failure_reason === 'No estaba el jefe de compras', institucional)
      const peticion = llamadasClaude.at(-1)
      const mensaje = String(peticion?.messages[0]?.content ?? '')
      const herramienta = peticion?.tools?.[0] as Anthropic.Beta.Messages.BetaTool | undefined
      check(`Claude: ${MODELO_PROPUESTA}, herramienta estricta proponer_visitas, tool_choice auto (Sonnet 5.5 rechaza el forzado), sin temperatura`, peticion?.model === MODELO_PROPUESTA && herramienta?.name === 'proponer_visitas' && herramienta?.strict === true && peticion?.tool_choice?.type === 'auto' && !('temperature' in (peticion ?? {})), peticion && { model: peticion.model, tool_choice: peticion.tool_choice })
      check('sin razonamiento: thinking between_tools, effort low; prompt del sistema en caché; respaldo del servidor', (peticion?.thinking as { type?: string } | undefined)?.type === 'between_tools' && (peticion?.output_config as { effort?: string } | undefined)?.effort === 'low' && Array.isArray(peticion?.system) && (peticion?.system as { text: string }[])[0].text === PROMPT_PROPUESTA && (peticion as { fallbacks?: unknown } | undefined)?.fallbacks === 'default')
      const esquema = JSON.stringify(herramienta?.input_schema ?? {})
      check('el esquema de la herramienta no lleva límites que el modo estricto no admite y usa anyOf para null', !/maxLength|maxItems|minimum|maximum|"pattern"/.test(esquema) && esquema.includes('anyOf') && !esquema.includes('["string","null"]'), esquema.slice(0, 300))
      check('el contexto que recibe Claude no trae documentos ni teléfonos', mensaje.includes('CONTEXTO') && mensaje.includes(TRANSCRIPCION) && !mensaje.includes(DOCUMENTO_M1) && !mensaje.includes(TELEFONO_K1) && !mensaje.includes('3109998877'))
      respuestaClaude = () => mensajeClaude(null, 'refusal')
      const rechazo = await pedir(proponer, '/api/me/voz/proponer', { method: 'POST', body: cuerpo, portador: true })
      check('Claude rechaza: 502 con el respaldo por toques', rechazo.status === 502 && /toques/.test(rechazo.body.error), rechazo.body)
      respuestaClaude = () => mensajeClaude({ visitas: 'ninguna', aviso: null })
      const invalida = await pedir(proponer, '/api/me/voz/proponer', { method: 'POST', body: cuerpo, portador: true })
      check('propuesta que no cumple el esquema (visitas no es una lista): 502', invalida.status === 502, invalida.body)
      respuestaClaude = () => mensajeClaude({ visitas: [{ tipo: 'medica', medico_id: M1, numero_documento: DOCUMENTO_M1, telefono: TELEFONO_K1 }], aviso: null })
      const incompleta = await pedir(proponer, '/api/me/voz/proponer', { method: 'POST', body: cuerpo, portador: true })
      check('propuesta incompleta: se completa con valores seguros y nunca copia claves desconocidas (documento, teléfono)', incompleta.status === 200 && todosCon('visitaPropuesta', incompleta.body.visitas) && !incompleta.texto.includes(DOCUMENTO_M1) && !incompleta.texto.includes(TELEFONO_K1), incompleta.body)
      respuestaClaude = () => mensajeClaude(entradaClaude())
      const vacia = await pedir(proponer, '/api/me/voz/proponer', { method: 'POST', body: { ...cuerpo, transcript: '' }, portador: true })
      check('transcripción vacía: 400', vacia.status === 400, vacia.body)
      reiniciarLimitesVoz()
      const estados: number[] = []
      for (let i = 0; i < 10; i++) estados.push((await pedir(proponer, '/api/me/voz/proponer', { method: 'POST', body: cuerpo, portador: true })).status)
      const llamadasMinuto = llamadasClaude.length
      const undecima = await pedir(proponer, '/api/me/voz/proponer', { method: 'POST', body: cuerpo, portador: true })
      check(
        '10 propuestas por minuto pasan; la 11.ª: 429 con Retry-After 60 y Claude no se llama',
        estados.every(st => st === 200) && undecima.status === 429 && undecima.body.error === MENSAJE_LIMITE_VOZ && undecima.headers.get('retry-after') === '60' && llamadasClaude.length === llamadasMinuto,
        { estados, status: undecima.status, retry: undecima.headers.get('retry-after') }
      )

      // Tope por hora (60): 60 propuestas cada 50 s (a lo sumo 2 en un minuto) pasan; la 61.ª, a los 3.000 s de la
      // primera, recibe 429 con Retry-After 600 (3.600 − 3.000).
      reiniciarLimitesVoz()
      const inicioHora = ahoraMs
      const enLaHora: number[] = []
      try {
        for (let i = 0; i < 60; i++) {
          enLaHora.push((await pedir(proponer, '/api/me/voz/proponer', { method: 'POST', body: cuerpo, portador: true })).status)
          ahoraMs += 50_000
        }
        const llamadasHora = llamadasClaude.length
        const sexagesimaPrimera = await pedir(proponer, '/api/me/voz/proponer', { method: 'POST', body: cuerpo, portador: true })
        check(
          '60 propuestas en la hora pasan; la 61.ª: 429 con Retry-After 600 y Claude no se llama',
          enLaHora.every(st => st === 200) && sexagesimaPrimera.status === 429 && sexagesimaPrimera.body.error === MENSAJE_LIMITE_VOZ && sexagesimaPrimera.headers.get('retry-after') === '600' && llamadasClaude.length === llamadasHora,
          { distintos: enLaHora.filter(st => st !== 200), status: sexagesimaPrimera.status, retry: sexagesimaPrimera.headers.get('retry-after') }
        )
        const deBerta = await pedir(proponer, '/api/me/voz/proponer', { method: 'POST', body: cuerpo, portador: true, userId: OTRA_ID })
        check('el tope por hora es por persona: Berta sí puede', deBerta.status === 200, deBerta.body)
      } finally {
        ahoraMs = inicioHora
      }
      reiniciarLimitesVoz()
      const contexto = await pedir(verContexto, '/api/me/contexto', { portador: true })
      check('con las dos llaves, voz.transcribir y voz.proponer en true', contexto.body.voz.transcribir === true && contexto.body.voz.proponer === true)
    }

    print('\n7b. Proponer: si Anthropic rechaza la petición completa (400), UN reintento con la petición mínima')
    {
      const cuerpo = { transcript: TRANSCRIPCION, lat: TEL.lat, lng: TEL.lng, precision: 12, hora: '2026-10-13T10:41:00.000-05:00' }
      const respuestaOriginal = respuestaClaude
      // Los console.warn aparte (el respaldo se avisa con warn), además de quedar en moduleLogs.
      const avisos: string[] = []
      const warnOriginal = console.warn
      console.warn = (...args: unknown[]) => {
        avisos.push(args.map(String).join(' '))
        registrar(...args)
      }
      // Nada de lo dictado ni del contexto (médica, cuenta, especialidad, nombre de la ejecutiva) en los logs.
      const PALABRAS_PRIVADAS = ['tornillo', 'canulado', 'Gómez', 'Gomez', 'doctora', 'Ramírez', 'Ramirez', 'Clínica', 'Norte', 'Luis', 'ortopedia', 'Ejecutiva']
      // Sin tildes ni mayúsculas: "GOMEZ" o "gomez" en el log también cuentan.
      const normal = (texto: string) => texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
      const sinContenido = (logs: string[]) => logs.every(l => PALABRAS_PRIVADAS.every(palabra => !normal(l).includes(normal(palabra))))
      try {
        // (a) La completa da 400 (beta no habilitada) → la mínima → 200 con la propuesta.
        reiniciarLimitesVoz()
        const MOTIVO_BETA = 'Unexpected value(s) `server-side-fallback-2026-07-01` for the `anthropic-beta` header. Please consult our documentation at docs.claude.com or try again without the header.'
        respuestaClaude = body => {
          if (esPeticionCompleta(body)) throw error400Claude(MOTIVO_BETA)
          return mensajeClaude(entradaClaude())
        }
        const desdeA = llamadasClaude.length
        const avisosA = avisos.length
        const logsA = moduleLogs.length
        const conRespaldo = await pedir(proponer, '/api/me/voz/proponer', { method: 'POST', body: cuerpo, portador: true })
        const [completa, minima] = llamadasClaude.slice(desdeA)
        check(
          'la completa da 400 → se reintenta UNA vez con la mínima y la ruta responde 200 con la propuesta (tres visitas, claves de la app)',
          conRespaldo.status === 200 && ok('propuesta', conRespaldo.body) && todosCon('visitaPropuesta', conRespaldo.body.visitas) && conRespaldo.body.visitas.length === 3 && llamadasClaude.length === desdeA + 2,
          { status: conRespaldo.status, body: conRespaldo.body, llamadas: llamadasClaude.length - desdeA }
        )
        check(
          'la primera es la completa (beta server-side-fallback-2026-07-01, fallbacks default, thinking between_tools, effort low, herramienta estricta)',
          esPeticionCompleta(completa) && completa?.betas?.includes('server-side-fallback-2026-07-01') === true && completa?.fallbacks === 'default' && completa?.thinking?.type === 'between_tools' && completa?.output_config?.effort === 'low' && (completa?.tools?.[0] as Anthropic.Beta.Messages.BetaTool | undefined)?.strict === true,
          completa && { betas: completa.betas, fallbacks: completa.fallbacks, thinking: completa.thinking }
        )
        const herramientaMinima = minima?.tools?.[0] as Anthropic.Beta.Messages.BetaTool | undefined
        check(
          'la mínima NO lleva betas, fallbacks, thinking ni strict; sí effort low (output_config solo con eso) y max_tokens 8.000 (cabe en los 60 s); tool_choice auto con una sola llamada (Sonnet 5.5 rechaza con 400 el forzado, que haría fallar también la mínima)',
          esPeticionMinima(minima, 'proponer_visitas') && !esPeticionCompleta(minima) && minima?.tool_choice?.type !== 'tool' && minima?.tool_choice?.type !== 'any',
          minima && { claves: Object.keys(minima), tool_choice: minima.tool_choice, herramienta: herramientaMinima && Object.keys(herramientaMinima) }
        )
        check(
          'la mínima: el mismo modelo, el mismo system (con cache_control), el mismo mensaje y el mismo esquema; max_tokens con margen para el razonamiento',
          minima?.model === MODELO_PROPUESTA &&
            JSON.stringify(minima?.system) === JSON.stringify(completa?.system) &&
            (minima?.system as { text: string; cache_control?: { type: string } }[] | undefined)?.[0]?.cache_control?.type === 'ephemeral' &&
            JSON.stringify(minima?.messages) === JSON.stringify(completa?.messages) &&
            JSON.stringify(herramientaMinima?.input_schema) === JSON.stringify((completa?.tools?.[0] as Anthropic.Beta.Messages.BetaTool | undefined)?.input_schema) &&
            completa?.max_tokens === MAX_TOKENS_PROPUESTA &&
            (minima?.max_tokens ?? 0) > MAX_TOKENS_PROPUESTA,
          minima && { model: minima.model, max_tokens: minima.max_tokens }
        )
        const avisoA = avisos.slice(avisosA).find(l => l.includes('petición mínima'))
        check(
          'console.warn del respaldo con el porqué: estado, tipo de la API, la cabecera (parámetro), el request_id y el mensaje de la API',
          Boolean(avisoA) && avisoA!.includes('400') && avisoA!.includes('invalid_request_error') && avisoA!.includes('parámetro anthropic-beta') && avisoA!.includes(REQUEST_ID_PRUEBA) && avisoA!.includes('server-side-fallback-2026-07-01'),
          avisoA ?? avisos.slice(avisosA)
        )
        check('con el respaldo, ni lo dictado ni el contexto salen en los logs', sinContenido(moduleLogs.slice(logsA)), moduleLogs.slice(logsA))

        // La mínima también reintenta si no llama a la herramienta.
        let minimas = 0
        respuestaClaude = body => {
          if (esPeticionCompleta(body)) throw error400Claude('"thinking.type.between_tools" is not supported for this model.')
          minimas++
          return minimas === 1 ? mensajeClaude(null, 'end_turn') : mensajeClaude(entradaClaude())
        }
        const desdeA2 = llamadasClaude.length
        const avisosA2 = avisos.length
        const sinHerramienta = await pedir(proponer, '/api/me/voz/proponer', { method: 'POST', body: cuerpo, portador: true })
        const avisoA2 = avisos.slice(avisosA2).find(l => l.includes('petición mínima')) ?? ''
        check(
          'la mínima no llamó a la herramienta → su reintento (completa + 2 mínimas) → 200; el aviso nombra el parámetro (thinking.type.between_tools)',
          sinHerramienta.status === 200 && sinHerramienta.body.visitas.length === 3 && llamadasClaude.length === desdeA2 + 3 && llamadasClaude.slice(desdeA2 + 1).every(b => esPeticionMinima(b, 'proponer_visitas')) && avisoA2.includes('parámetro thinking.type.between_tools') && avisoA2.includes('is not supported for this model'),
          { status: sinHerramienta.status, llamadas: llamadasClaude.length - desdeA2, aviso: avisoA2 }
        )

        // (b) La mínima también da 400 → 502 con el mensaje de siempre; se lanza el error de la mínima.
        respuestaClaude = () => {
          throw error400Claude('tools.0.custom.input_schema: Schema is too complex for compilation.')
        }
        const desdeB = llamadasClaude.length
        const logsB = moduleLogs.length
        const avisosB = avisos.length
        const ambas = await pedir(proponer, '/api/me/voz/proponer', { method: 'POST', body: cuerpo, portador: true })
        const errorRuta = moduleLogs.slice(logsB).find(l => l.includes('fallo al proponer')) ?? ''
        check(
          `la mínima también da 400 → 502 "${MENSAJE_FALLO_PROPUESTA}" tras exactamente dos peticiones (completa y mínima)`,
          ambas.status === 502 && ambas.body.error === MENSAJE_FALLO_PROPUESTA && llamadasClaude.length === desdeB + 2 && esPeticionCompleta(llamadasClaude[desdeB]) && esPeticionMinima(llamadasClaude[desdeB + 1], 'proponer_visitas'),
          { status: ambas.status, body: ambas.body, llamadas: llamadasClaude.length - desdeB }
        )
        check(
          'el log: un aviso del respaldo y el error de la ruta, los dos con el tipo, el parámetro y el request_id, sin contenido',
          avisos.slice(avisosB).filter(l => l.includes('petición mínima')).length === 1 && errorRuta.includes('400 invalid_request_error') && errorRuta.includes('parámetro tools.0.custom.input_schema') && errorRuta.includes(REQUEST_ID_PRUEBA) && sinContenido(moduleLogs.slice(logsB)),
          moduleLogs.slice(logsB)
        )

        // (c) 429, 5xx, 404, red, tiempo agotado y 'refusal' NO usan la mínima: una sola petición y 502.
        reiniciarLimitesVoz()
        const sinRespaldo: [string, () => Anthropic.Beta.Messages.BetaMessage][] = [
          ['429', () => { throw Anthropic.APIError.generate(429, { type: 'error', error: { type: 'rate_limit_error', message: 'Number of request tokens has exceeded your per-minute rate limit' } }, undefined, new Headers()) }],
          ['500', () => { throw Anthropic.APIError.generate(500, { type: 'error', error: { type: 'api_error', message: 'Internal server error' } }, undefined, new Headers()) }],
          ['529', () => { throw Anthropic.APIError.generate(529, { type: 'error', error: { type: 'overloaded_error', message: 'Overloaded' } }, undefined, new Headers()) }],
          ['404', () => { throw Anthropic.APIError.generate(404, { type: 'error', error: { type: 'not_found_error', message: 'model: claude-sonnet-5-5' } }, undefined, new Headers()) }],
          ['sin conexión', () => { throw new Anthropic.APIConnectionError({ message: 'Connection error.' }) }],
          ['tiempo agotado', () => { throw new Anthropic.APIConnectionTimeoutError() }],
          ['refusal', () => mensajeClaude(null, 'refusal')],
        ]
        const logsDesdeC = moduleLogs.length
        for (const [nombre, respuesta] of sinRespaldo) {
          respuestaClaude = respuesta
          const desdeC = llamadasClaude.length
          const avisosC = avisos.length
          const r = await pedir(proponer, '/api/me/voz/proponer', { method: 'POST', body: cuerpo, portador: true })
          check(
            `${nombre}: 502 sin respaldo (una sola petición, la completa; ningún aviso de petición mínima)`,
            r.status === 502 && r.body.error === MENSAJE_FALLO_PROPUESTA && llamadasClaude.length === desdeC + 1 && esPeticionCompleta(llamadasClaude[desdeC]) && !avisos.slice(avisosC).some(l => l.includes('petición mínima')),
            { status: r.status, llamadas: llamadasClaude.length - desdeC, avisos: avisos.slice(avisosC) }
          )
        }
        const logsC = moduleLogs.slice(logsDesdeC)
        check(
          'el log de esos fallos dice qué pasó (429 rate_limit_error, tiempo agotado, sin conexión, rechazo) sin contenido',
          logsC.some(l => l.includes('Anthropic 429 rate_limit_error')) && logsC.some(l => l.includes('Anthropic tiempo agotado')) && logsC.some(l => l.includes('Anthropic sin conexión')) && logsC.some(l => l.includes('rechazo')) && sinContenido(logsC),
          logsC
        )

        // (e) El mensaje de la API repite lo enviado: el aviso lleva el tipo y el parámetro, nunca el contenido.
        reiniciarLimitesVoz()
        const filtraciones: [string, string, (aviso: string) => boolean][] = [
          [
            'repite la transcripción tal cual (sin comillas)',
            `tool_choice: no se pudo con ${TRANSCRIPCION}`,
            aviso => aviso.includes('parámetro tool_choice') && aviso.includes(MENSAJE_API_OMITIDO),
          ],
          [
            'repite palabras del contexto en ASCII (especialidad y nombre de la ejecutiva)',
            'messages.0.content: unexpected value near ortopedia and Ejecutiva',
            aviso => aviso.includes('parámetro messages.0.content') && aviso.includes(MENSAJE_API_OMITIDO),
          ],
          [
            'cita lo dictado entre comillas (se cambia por "..." y el resto del mensaje sí sirve)',
            'output_config.effort: "Vi al doctor Ramirez" is not a valid effort level',
            aviso => aviso.includes('parámetro output_config.effort') && aviso.includes('mensaje: output_config.effort: "..." is not a valid effort level'),
          ],
          [
            'trae un teléfono, un correo y una llave (se tapan)',
            'tool_choice: bad value 3001234567 for luis@clinica.test with sk-ant-api03-abcdefghijkl',
            aviso => aviso.includes('parámetro tool_choice') && !aviso.includes('3001234567') && !aviso.includes('@clinica') && !aviso.includes('sk-ant-api03') && aviso.includes('[llave]'),
          ],
        ]
        for (const [nombre, mensaje, esperado] of filtraciones) {
          respuestaClaude = body => {
            if (esPeticionCompleta(body)) throw error400Claude(mensaje)
            return mensajeClaude(entradaClaude())
          }
          const avisosE = avisos.length
          const logsE = moduleLogs.length
          const r = await pedir(proponer, '/api/me/voz/proponer', { method: 'POST', body: cuerpo, portador: true })
          const aviso = avisos.slice(avisosE).find(l => l.includes('petición mínima')) ?? ''
          check(
            `el mensaje de la API ${nombre}: 200 con el respaldo y el aviso con el tipo y el parámetro, sin nada de lo enviado`,
            r.status === 200 && aviso.includes('400 invalid_request_error') && aviso.includes(REQUEST_ID_PRUEBA) && esperado(aviso) && sinContenido(moduleLogs.slice(logsE)),
            { status: r.status, aviso }
          )
        }
      } finally {
        respuestaClaude = respuestaOriginal
        console.warn = warnOriginal
        reiniciarLimitesVoz()
      }
    }

    print('\n7c. El log de la voz nunca repite lo enviado (saneado del mensaje de la API, funciones puras)')
    {
      // Lo que mandó la persona: apellidos con tilde y eñe, nombres cortos y números escritos como se escriben.
      const DICHO = 'Hablé con la doctora Gómez Fernández y con Ana Gil; su teléfono es 300 123 4567, la cédula 1.020.304.050, NIT 900.123.456-7, extensión 45821.'
      const CONTEXTO_7C = { medicos: [{ nombre: 'María Ramírez' }, { nombre: 'Luis Muñoz' }, { nombre: 'José Rodríguez' }], contactos: [{ nombre: 'Rey Gil', cargo: 'Compras' }] }
      const enviado7c = loEnviado([DICHO, CONTEXTO_7C])
      const resumen = (mensaje: string) => resumenErrorVoz(error400Claude(mensaje), [DICHO, CONTEXTO_7C])
      check(
        'loEnviado: palabras de 3 o más letras sin tildes (gomez, fernandez, ana, gil, rey, munoz) y números sin separadores (3001234567, 1020304050, 9001234567, 45821)',
        ['gomez', 'fernandez', 'ana', 'gil', 'rey', 'munoz', 'rodriguez'].every(p => enviado7c.palabras.has(p)) &&
          ['3001234567', '1020304050', '9001234567', '45821'].every(n => enviado7c.numeros.includes(n)) &&
          !enviado7c.palabras.has('su') &&
          !enviado7c.palabras.has('nombre'),
        { palabras: [...enviado7c.palabras], numeros: enviado7c.numeros }
      )
      // [qué trae, mensaje de la API, trozos que NUNCA pueden salir en el log, lo que sí queda (por defecto: se omite)]
      const filtraciones7c: [string, string, string[], string?][] = [
        ['tilde escapada \\u (sin comillas)', 'invalid near Fern\\u00e1ndez', ['Fern', 'ndez']],
        ['tilde escapada \\u en el nombre completo', 'invalid value Mar\\u00eda Ram\\u00edrez', ['Mar', 'Ram']],
        ['tilde escapada \\x', 'invalid near Rodr\\xedguez', ['Rodr', 'guez']],
        ['entidad HTML', 'invalid near Fern&aacute;ndez', ['Fern', 'ndez']],
        ['eñe como entidad numérica', 'invalid near Mu&#241;oz', ['Mu&', 'oz']],
        ['tilde en URL (%C3%A1)', 'invalid near Fern%C3%A1ndez', ['Fern', 'ndez']],
        ['tilde escapada entre comillas', 'invalid near "Fern\\u00e1ndez"', ['Fern', 'ndez'], 'mensaje: invalid near "..."'],
        ['teléfono con espacios', 'invalid near 300 123 4567 in text', ['300', '123', '4567'], 'mensaje: invalid near # in text'],
        ['cédula con puntos', 'invalid near 1.020.304.050', ['020', '304', '050'], 'mensaje: invalid near #'],
        ['NIT con puntos y guion', 'invalid near 900.123.456-7', ['900', '123', '456'], 'mensaje: invalid near #'],
        ['teléfono con guiones entre comillas', 'invalid near "300-123-4567"', ['300', '123', '4567'], 'mensaje: invalid near "#"'],
        ['teléfono con puntos entre comillas', 'invalid near "300.123.4567"', ['300', '123', '4567'], 'mensaje: invalid near "#"'],
        ['extensión de 5 dígitos entre comillas', 'invalid near "45821"', ['45821']],
        ['extensión de 5 dígitos sin comillas', 'invalid near 45821', ['45821']],
        ['el final de un teléfono', 'invalid near 4567', ['4567']],
        ['nombre y apellido cortos', 'invalid near Ana Gil', ['Ana', 'Gil']],
        ['nombre corto del contexto', 'invalid value Rey Gil', ['Rey', 'Gil']],
        ['apellido corto entre comillas', 'invalid near "Gil"', ['Gil']],
        ['comillas desparejadas', 'invalid near "x and Rey Gil', ['Rey', 'Gil']],
        ['apellido corto que NO está en lo enviado (lista cerrada)', 'invalid near Paz', ['Paz']],
        ['inicio de un apellido entre comillas', 'invalid near "Fernand"', ['Fernand']],
        ['final de un apellido entre comillas', 'invalid near "ernandez"', ['ernandez']],
        ['inicio de un apellido sin comillas', 'invalid near Fernand', ['Fernand']],
        ['apellido en mayúsculas', 'invalid near GOMEZ', ['GOMEZ']],
        ['palabras pegadas', 'invalid near AnaGil', ['AnaGil']],
        ['JSON del contexto', 'messages.0.content: {"medicos":[{"nombre":"Luis Munoz"}]}', ['Luis', 'Munoz', 'medicos']],
        ['comillas tipográficas con tildes', 'invalid near “María Ramírez” and Ramirez', ['Mar', 'Ram']],
        ['mensaje de más de MAX_MENSAJE_API_ANALIZAR caracteres', `tool_choice: invalid ${'value '.repeat(300)}near Gomez`, ['Gomez', 'value value']],
      ]
      for (const [nombre, mensaje, prohibidos, queda = MENSAJE_API_OMITIDO] of filtraciones7c) {
        const log = resumen(mensaje)
        check(
          `el mensaje de la API trae ${nombre}: ${queda === MENSAJE_API_OMITIDO ? 'se omite' : `queda «${queda}»`} y no sale nada de lo enviado`,
          log.endsWith(queda) && log.includes('400 invalid_request_error') && log.includes(REQUEST_ID_PRUEBA) && prohibidos.every(trozo => !log.includes(trozo)),
          log
        )
      }
      // Lo que SÍ sirve sigue saliendo entero (y con los números tapados o a la vista según la regla).
      const utiles: [string, string, string][] = [
        ['la beta rechazada', 'Unexpected value(s) `server-side-fallback-2026-07-01` for the `anthropic-beta` header.', 'mensaje: Unexpected value(s) `server-side-fallback-2026-07-01` for the `anthropic-beta` header.'],
        ['el thinking no soportado', '"thinking.type.between_tools" is not supported for this model.', 'mensaje: "thinking.type.between_tools" is not supported for this model.'],
        ['el tope de tokens (números cortos a la vista)', 'max_tokens: 16000 > 8192, which is the maximum allowed number of output tokens for claude-sonnet-5-5', 'mensaje: max_tokens: 16000 > 8192, which is the maximum allowed number of output tokens for claude-sonnet-5-5'],
        ['un número largo que no es de lo enviado (se tapa)', 'prompt is too long: 250000 tokens > 200000 maximum', 'mensaje: prompt is too long: # tokens > # maximum'],
        ['lo dictado entre comillas (se cambia por "...")', 'tool_choice: "Ana Gil dijo que no" is not a valid type', 'mensaje: tool_choice: "..." is not a valid type'],
      ]
      for (const [nombre, mensaje, esperado] of utiles) {
        const log = resumen(mensaje)
        check(`el mensaje de la API con ${nombre} sí sale (saneado)`, log.includes(esperado) && !log.includes(MENSAJE_API_OMITIDO), log)
      }
      check(
        'mensajeApiSeguro y parametroDelMensaje directos: la tilde escapada se omite y el parámetro se reconoce sin repetir lo enviado',
        mensajeApiSeguro('invalid near Fern\\u00e1ndez', enviado7c) === null &&
          mensajeApiSeguro('fallbacks: Extra inputs are not permitted', enviado7c) === 'fallbacks: Extra inputs are not permitted' &&
          parametroDelMensaje('output_config.effort: Input should be low', enviado7c) === 'output_config.effort' &&
          parametroDelMensaje('messages.gomez: bad', enviado7c) === null
      )
      // OpenAI: code y param salen; el mensaje, con las mismas reglas.
      const errorOpenAI = (mensaje: string) =>
        OpenAI.APIError.generate(400, { error: { message: mensaje, type: 'invalid_request_error', code: 'invalid_value', param: 'file' } }, undefined, new Headers({ 'x-request-id': 'req_openai_7c' }))
      const openaiBien = resumenErrorVoz(errorOpenAI('Audio file might be corrupted or unsupported'), ['grabacion-visita.m4a'])
      const openaiFiltra = resumenErrorVoz(errorOpenAI('Invalid file name grabaci\\u00f3n de Ana Gil'), ['grabacion-visita.m4a'])
      check(
        'OpenAI: el log trae el estado, el tipo, el code, el param y el request_id; el mensaje técnico sale y uno con un nombre se omite',
        openaiBien.startsWith('OpenAI 400 invalid_request_error (invalid_value)') && openaiBien.includes('parámetro file') && openaiBien.includes('request_id req_openai_7c') && openaiBien.includes('mensaje: Audio file might be corrupted or unsupported') &&
          openaiFiltra.includes(MENSAJE_API_OMITIDO) && !openaiFiltra.includes('Ana') && !openaiFiltra.includes('Gil') && !openaiFiltra.includes('grabaci'),
        { openaiBien, openaiFiltra }
      )
      // Un mensaje anómalo y enorme no bloquea la función (antes: segundos con 80.000 caracteres sin espacios).
      const inicio = Date.now()
      const enormes = [`tool_choice: ${'x'.repeat(160_000)}`, 'model:'.repeat(32_000), '"'.repeat(32_000), `anthropic-${'a-'.repeat(40_000)}`]
      const logsEnormes = enormes.map(resumen)
      const ms = Date.now() - inicio
      check(
        `un mensaje de la API de 64.000 a 160.000 caracteres se omite en milisegundos (${ms} ms; tope de análisis ${MAX_MENSAJE_API_ANALIZAR} caracteres)`,
        ms < 500 && logsEnormes.every(log => log.includes(MENSAJE_API_OMITIDO) && log.length < 400),
        { ms, logsEnormes }
      )
    }

    print('\n7d. Workspace de Anthropic (llave personal no asignada a un workspace: cabecera anthropic-workspace-id)')
    {
      const ID = 'wrkspc_01JwQvzr7rXLA5AGx3HKfFUJ'
      check('cabecerasAnthropic: un ID wrkspc_… va como anthropic-workspace-id (sin espacios)', JSON.stringify(cabecerasAnthropic(`  ${ID} `)) === JSON.stringify({ 'anthropic-workspace-id': ID }))
      check(
        'cabecerasAnthropic: vacío, null, otra cosa o una llave pegada por error → no se manda nada',
        [undefined, null, '', '   ', 'Default', 'wrkspc_', 'wrkspc_abc', 'sk-ant-api03-abcdefghijklmnop', `${ID} x`, 'wrkspc_01Jw-Qv'].every(v => cabecerasAnthropic(v) === undefined)
      )

      const cuerpo7d = { transcript: TRANSCRIPCION, lat: TEL.lat, lng: TEL.lng, precision: 12, hora: '2026-10-13T10:41:00.000-05:00' }
      const vistas: (Record<string, string> | undefined)[] = []
      fijarFabricasVoz({ openai: () => clienteOpenAI, anthropic: (_llave, cabeceras) => (vistas.push(cabeceras), clienteClaude) })
      const respuestaAntes = respuestaClaude
      respuestaClaude = () => mensajeClaude(entradaClaude())
      const workspaceAntes = process.env.ANTHROPIC_WORKSPACE_ID
      const avisos: string[] = []
      const warnOriginal = console.warn
      console.warn = (...args: unknown[]) => void avisos.push(args.map(String).join(' '))
      try {
        delete process.env.ANTHROPIC_WORKSPACE_ID
        const sinVariable = await pedir(proponer, '/api/me/voz/proponer', { method: 'POST', body: cuerpo7d, portador: true })
        check('sin ANTHROPIC_WORKSPACE_ID: 200 y el cliente sin cabecera de workspace (llave asignada a un workspace)', sinVariable.status === 200 && vistas.at(-1) === undefined, { status: sinVariable.status, vista: vistas.at(-1) })
        process.env.ANTHROPIC_WORKSPACE_ID = ` ${ID}\n`
        const conVariable = await pedir(proponer, '/api/me/voz/proponer', { method: 'POST', body: cuerpo7d, portador: true })
        check('con ANTHROPIC_WORKSPACE_ID: el cliente de Claude lleva anthropic-workspace-id', conVariable.status === 200 && vistas.at(-1)?.['anthropic-workspace-id'] === ID, vistas.at(-1))
        const llaveFalsa = 'sk-ant-api03-llave-pegada-por-error-0123456789'
        process.env.ANTHROPIC_WORKSPACE_ID = llaveFalsa
        const malVariable = await pedir(proponer, '/api/me/voz/proponer', { method: 'POST', body: cuerpo7d, portador: true })
        check(
          'ANTHROPIC_WORKSPACE_ID con otra cosa (una llave): no se manda, se avisa en el log sin el valor',
          malVariable.status === 200 && vistas.at(-1) === undefined && avisos.some(a => a.includes('ANTHROPIC_WORKSPACE_ID') && a.includes('wrkspc_')) && !avisos.some(a => a.includes(llaveFalsa)),
          { vista: vistas.at(-1), avisos }
        )
      } finally {
        console.warn = warnOriginal
        if (workspaceAntes === undefined) delete process.env.ANTHROPIC_WORKSPACE_ID
        else process.env.ANTHROPIC_WORKSPACE_ID = workspaceAntes
        respuestaClaude = respuestaAntes
        fijarFabricasVoz({ openai: () => clienteOpenAI, anthropic: () => clienteClaude })
      }

      // El mensaje real de Anthropic para este caso se imprime entero (sin contenido): así el log dice qué hacer.
      const OFICIAL = 'anthropic-workspace-id is required when authenticating with an identity-linked API key; send the id of the workspace this request acts in.'
      const resumen7d = resumenErrorVoz(error400Claude(OFICIAL), [TRANSCRIPCION])
      check('el log del 400 sin workspace trae el parámetro y el mensaje de Anthropic (no "omitido")', resumen7d.includes('parámetro anthropic-workspace-id') && resumen7d.includes('is required when authenticating with an identity-linked API key') && !resumen7d.includes(MENSAJE_API_OMITIDO), resumen7d)
      const otraRedaccion = resumenErrorVoz(error400Claude('This API key is not scoped to a workspace, so this request must include the anthropic-workspace-id header with the ID of the workspace to use.'), [TRANSCRIPCION])
      check('otra redacción del mismo 400 (la que se ha visto en la práctica) también se imprime', otraRedaccion.includes('parámetro anthropic-workspace-id') && otraRedaccion.includes('is not scoped to a workspace') && !otraRedaccion.includes(MENSAJE_API_OMITIDO), otraRedaccion)
      const invalido = resumenErrorVoz(error400Claude('anthropic-workspace-id header must be a valid workspace ID.'), [TRANSCRIPCION])
      check('y el de un ID inválido también', invalido.includes('must be a valid workspace ID') && !invalido.includes(MENSAJE_API_OMITIDO), invalido)
    }

    print('\n8. Médico completo y sede nueva con el GPS (F1 desde la app)')
    {
      const antes = tablas.medicos.length
      const sinDocumento = await pedir(crearMedico, '/api/terceros/medicos', { method: 'POST', portador: true, body: { tipo_documento: 'CC', nombre: 'Dr. Ramírez', especialidades: ['columna'], municipality_id: '68001', sedes: [{ sede_id: S1, rol: 'atiende' }] } })
      check('médico sin documento: 400 y nada guardado', sinDocumento.status === 400 && tablas.medicos.length === antes && !fake.rpcs.some(r => r.nombre === 'terceros_crear_medico'), sinDocumento.body)
      const repetido = await pedir(crearMedico, '/api/terceros/medicos', { method: 'POST', portador: true, body: { tipo_documento: 'CC', numero_documento: '79.123.456', nombre: 'Otra persona', especialidades: ['ortopedia'], municipality_id: '68001', sedes: [{ sede_id: S1, rol: 'atiende' }] } })
      check('documento repetido: 409 con el existente (sin su documento)', repetido.status === 409 && repetido.body.existente?.id === M1 && repetido.body.existente?.nombre === 'Dra. Ana Gómez' && !repetido.texto.includes(DOCUMENTO_M1) && tablas.medicos.length === antes, repetido.body)

      const sede = (extra: Fila) => pedir(crearSede, '/api/terceros/sedes', { method: 'POST', portador: true, body: { cuenta_id: C1, nombre: 'Clínica Norte · Torre 2', municipality_id: '68001', origen: 'gps_app', lat: TEL.lat, lng: TEL.lng, gps_accuracy_m: 8.6, ...extra } })
      const conReps = await sede({ reps_code: '680010000001' })
      check('gps_app con código del REPS que cruza con el municipio: nace confirmada (suma al instante)', conReps.status === 201 && conReps.body.sede.origen === 'gps_app' && conReps.body.sede.ubicacion_confirmada === true && conReps.body.sede.lat === TEL.lat, conReps.body)
      const deOtroPrestador = await sede({ nombre: 'Clínica Norte · Torre 3', reps_code: '680010000002' })
      check(
        'gps_app con un código público del REPS de OTRA IPS de Bucaramanga (otro NIT), en el municipio y con el GPS bien: por confirmar',
        deOtroPrestador.status === 201 && deOtroPrestador.body.sede.ubicacion_confirmada === false,
        deOtroPrestador.body
      )
      const sinReps = await sede({ nombre: 'Consultorio 204' })
      check('gps_app sin código: por confirmar (data manager)', sinReps.status === 201 && sinReps.body.sede.ubicacion_confirmada === false && sinReps.body.sede.origen === 'gps_app', sinReps.body)
      const otroMunicipio = await sede({ nombre: 'Sede Medellín', reps_code: '050010000001' })
      check('gps_app con código de otro municipio: por confirmar', otroMunicipio.status === 201 && otroMunicipio.body.sede.ubicacion_confirmada === false, otroMunicipio.body)
      const desdeLaCasa = await sede({ nombre: 'Sede Medellín desde la casa', reps_code: '050010000002', municipality_id: '05001' })
      check(
        'gps_app con un código público del REPS de Medellín, municipio Medellín y el GPS en Bucaramanga (≈ 300 km): por confirmar',
        desdeLaCasa.status === 201 && desdeLaCasa.body.sede.ubicacion_confirmada === false,
        desdeLaCasa.body
      )
      const enMedellin = await sede({ nombre: 'Sede Medellín en el sitio', reps_code: '050010000003', municipality_id: '05001', lat: 6.2501, lng: -75.5701 })
      check('el mismo caso con el GPS en Medellín (a ~1 km del centro): confirmada', enMedellin.status === 201 && enMedellin.body.sede.ubicacion_confirmada === true, enMedellin.body)
      const sinGps = await sede({ nombre: 'Sin GPS', lat: null, lng: null })
      check('gps_app sin la ubicación del teléfono: 400', sinGps.status === 400, sinGps.body)
      const manual = await pedir(crearSede, '/api/terceros/sedes', { method: 'POST', portador: true, body: { cuenta_id: C1, nombre: 'Manual', municipality_id: '68001', reps_code: null, origen: 'otro' } })
      check('sin origen gps_app: manual y sin confirmar, como antes', manual.status === 201 && manual.body.sede.origen === 'manual' && manual.body.sede.ubicacion_confirmada === false, manual.body)
      const numerosAntes = await pedir(verNumeros, '/api/me/numeros?mes=2026-10', { portador: true })
      const presencial = await pedir(reportarVisita, '/api/me/visitas', {
        method: 'POST',
        portador: true,
        body: cuerpoVisita({ tipo: 'institucional', medico_id: null, cuenta_id: C1, sede_id: sinReps.body.sede.id, subtipo_id: SUBTIPO_ID.compras, lat: TEL.lat, lng: TEL.lng }),
      })
      check('la sede recién creada sirve para reportar presencial ahí mismo', presencial.status === 201 && presencial.body.visita.distance_m === 0, presencial.body)
      check(
        'pero NO suma mientras data manager no la confirme (decisión 9 del dueño): cuenta_para null, peso 0, sede_por_confirmar',
        presencial.body.visita.cuenta_para === null && presencial.body.visita.peso === 0 && presencial.body.visita.sede_por_confirmar === true,
        presencial.body.visita
      )
      const numerosPendiente = await pedir(verNumeros, '/api/me/numeros?mes=2026-10', { portador: true })
      check(
        'Mis números: la institucional no cambia y sale en sede_por_confirmar',
        numerosPendiente.body.hechas.institucional === numerosAntes.body.hechas.institucional && numerosPendiente.body.sede_por_confirmar === numerosAntes.body.sede_por_confirmar + 1,
        { antes: numerosAntes.body, ahora: numerosPendiente.body }
      )
      const contextoPendiente = await pedir(verContexto, '/api/me/contexto', { portador: true })
      const sedeNueva = tablas.sedes.find(x => x.id === sinReps.body.sede.id) as Fila
      sedeNueva.ubicacion_confirmada = true // data manager la confirma
      const contextoConfirmada = await pedir(verContexto, '/api/me/contexto', { portador: true })
      const numerosConfirmada = await pedir(verNumeros, '/api/me/numeros?mes=2026-10', { portador: true })
      const listaConfirmada = await pedir(verVisitas, '/api/me/visitas', { portador: true })
      check(
        'al confirmarla, la misma visita suma sola (sin tocar la visita): Mis números +1 institucional',
        numerosConfirmada.body.hechas.institucional === numerosAntes.body.hechas.institucional + 1 && numerosConfirmada.body.sede_por_confirmar === numerosAntes.body.sede_por_confirmar,
        numerosConfirmada.body
      )
      check(
        'y GET /api/me/visitas la muestra sumando a la institucional',
        listaConfirmada.body.items.some((v: W.VisitaItem) => v.id === presencial.body.visita.id && v.cuenta_para === 'institucional' && v.peso === 1 && !v.sede_por_confirmar)
      )
      check(
        'Hoy: hechas.institucionales cuenta la visita efectiva antes y después de confirmar (lo que cambia es lo que suma a la meta: ver 5b de reporte-check)',
        contextoPendiente.status === 200 && contextoPendiente.body.hoy.hechas.institucionales === contextoConfirmada.body.hoy.hechas.institucionales,
        { pendiente: contextoPendiente.body.hoy, confirmada: contextoConfirmada.body.hoy }
      )
    }

    print('\n9. El mapa de calor con visitas de la app (GET /api/visits/filtered)')
    {
      const r = await pedir(visitasDelMapa, '/api/visits/filtered?year=2026&month=10', { userId: ADMIN_ID })
      const filas = r.body as Fila[]
      const anuladas = tablas.visits.filter(v => v.deleted_at).map(v => v.id)
      check('200 con las importadas y las de la app', r.status === 200 && filas.some(f => f.id === VMO_ID) && filas.some(f => f.kam_name === 'Ana Ejecutiva'), r.body)
      check('solo las columnas del mapa: nunca transcripción, conclusión ni compromisos', filas.every(f => !('transcript' in f) && !('conclusion' in f) && !('compromisos' in f)) && !r.texto.includes('TRANSCRIPCION-INTERNA'), Object.keys(filas[0] ?? {}))
      check('sin las anuladas', anuladas.length > 0 && !filas.some(f => anuladas.includes(f.id)))
      const deLaApp = tablas.visits.filter(v => v.source === 'app').map(v => v.id)
      for (const [quien, userId] of [['un Ejecutivo Comercial (sales_manager)', VENTAS_ID], ['otro Ejecutivo Comercial', OTRA_ID], ['un visor', VIEWER_ID]] as const) {
        const sinVer = await pedir(visitasDelMapa, '/api/visits/filtered?year=2026&month=10', { userId })
        const suyas = sinVer.body as Fila[]
        check(
          `${quien} (sin visits:view): solo el histórico de VMO, ninguna visita de la app (ni nombre ni GPS de los demás)`,
          sinVer.status === 200 && deLaApp.length > 0 && suyas.some(f => f.id === VMO_ID) && !suyas.some(f => deLaApp.includes(f.id)) && !sinVer.texto.includes('Ana Ejecutiva'),
          sinVer.body
        )
      }
      fake.estado.sin0830 = true
      const vieja = await pedir(visitasDelMapa, '/api/visits/filtered?year=2026&month=10', { userId: ADMIN_ID })
      check('antes de la 0830 (sin deleted_at) sigue respondiendo', vieja.status === 200 && Array.isArray(vieja.body), vieja.body)
      fake.estado.sin0830 = false

      const vigentes = tablas.visits.filter(v => !v.deleted_at)
      const stats = await pedir(estadisticasVisitas, '/api/visits/stats', { userId: ADMIN_ID })
      check(
        'GET /api/visits/stats: sin las anuladas (antes una anulada seguía sumando en "Visitas efectivas")',
        stats.status === 200 && stats.body.totalVisits === vigentes.length && stats.body.effectiveVisits === vigentes.filter(v => v.visit_type === 'Visita efectiva').length && stats.body.totalVisits < tablas.visits.length,
        { stats: stats.body, vigentes: vigentes.length, todas: tablas.visits.length }
      )
      const zonas = await pedir(zonasSinVisitar, '/api/visits/unvisited-zones?year=2026&month=10', { userId: ADMIN_ID })
      check(
        'GET /api/visits/unvisited-zones: una visita anulada no marca como visitada la IPS a menos de 5 km (Hospital del sur sin visitar; Clínica Norte visitada)',
        zonas.status === 200 && zonas.body.unvisitedHospitalsList.some((h: { id: string }) => h.id === H_LEJOS) && !zonas.body.unvisitedHospitalsList.some((h: { id: string }) => h.id === H1),
        zonas.body
      )
      fake.estado.sin0830 = true
      const statsVieja = await pedir(estadisticasVisitas, '/api/visits/stats', { userId: ADMIN_ID })
      const zonasVieja = await pedir(zonasSinVisitar, '/api/visits/unvisited-zones?year=2026&month=10', { userId: ADMIN_ID })
      fake.estado.sin0830 = false
      check('antes de la 0830 las dos siguen respondiendo (cuentan todo: aún no hay visitas de la app)', statsVieja.status === 200 && statsVieja.body.totalVisits === tablas.visits.length && zonasVieja.status === 200, { statsVieja: statsVieja.body, zonasVieja: zonasVieja.status })
    }

    print('\n10. Sin la migración 0830: 503 claro, nada se rompe')
    {
      fake.estado.sin0830 = true
      const contexto = await pedir(verContexto, '/api/me/contexto', { portador: true })
      const visitas = await pedir(verVisitas, '/api/me/visitas', { portador: true })
      const reporte = await pedir(reportarVisita, '/api/me/visitas', { method: 'POST', body: cuerpoVisita(), portador: true })
      const numeros = await pedir(verNumeros, '/api/me/numeros', { portador: true })
      const cuota = await pedir(verCuota, '/api/me/cuota', { portador: true })
      fake.estado.sin0830 = false
      for (const [nombre, respuesta] of [['GET /api/me/contexto', contexto], ['GET /api/me/visitas', visitas], ['POST /api/me/visitas', reporte], ['GET /api/me/numeros', numeros]] as const) {
        check(`${nombre}: 503 "${MENSAJE_FALTA_MIGRACION_0830}"`, respuesta.status === 503 && respuesta.body.error === MENSAJE_FALTA_MIGRACION_0830, respuesta)
      }
      check('GET /api/me/cuota (F2) sigue funcionando', cuota.status === 200, cuota)
    }

    print('\n11. Los logs no llevan datos de la visita (ni cuando la base o Claude fallan)')
    {
      // Un error de PostgREST que la API no sabe traducir (23502, NOT NULL) trae en details la fila que falló, con la
      // transcripción, la conclusión y los compromisos: nada de eso puede llegar a los logs.
      const SECRETOS = {
        transcript: 'Dictado reservado: la doctora Gómez pidió el tornillo canulado para el jueves',
        conclusion: 'Conclusión reservada de la visita',
        compromisos: 'Compromiso reservado con compras',
        motivo: 'Motivo reservado de la anulación',
        correccion: 'Corrección reservada de la conclusión',
      }
      const sinSecretos = (desde: number) => moduleLogs.slice(desde).every(l => Object.values(SECRETOS).every(texto => !l.includes(texto)) && !l.includes('tornillo'))
      const filaQueFallo = `Failing row contains (${randomUUID()}, null, Ana Ejecutiva, Visita no efectiva, ${SECRETOS.transcript}, ${SECRETOS.conclusion}, ${SECRETOS.compromisos}).`
      const cuerpo = cuerpoVisita({ efectiva: false, failure_reason: 'No estaba la doctora', transcript: SECRETOS.transcript, conclusion: SECRETOS.conclusion, compromisos: SECRETOS.compromisos, input_mode: 'voz' })

      fake.estado.errorRpc = { code: '23502', message: 'null value in column "kam_id" of relation "visits" violates not-null constraint', details: filaQueFallo, hint: `Revise ${SECRETOS.conclusion}` }
      const desde = moduleLogs.length
      const fallo = await pedir(reportarVisita, '/api/me/visitas', { method: 'POST', body: cuerpo, portador: true })
      fake.estado.errorRpc = null
      const registro = moduleLogs.slice(desde).join(' | ')
      check('POST /api/me/visitas con un 23502 de la base: 500 genérico', fallo.status === 500 && fallo.body.error === 'Error al registrar la visita', fallo.body)
      check('el log dice la ruta y el código (23502) pero no la fila que falló: ni transcripción, ni conclusión, ni compromisos', registro.includes('POST /api/me/visitas') && registro.includes('23502') && !registro.includes('Failing row') && sinSecretos(desde), registro)

      fake.estado.errorRpc = { code: 'XX000', message: `error interno al guardar "${SECRETOS.transcript}"`, details: null, hint: null }
      const desde2 = moduleLogs.length
      const fallo2 = await pedir(reportarVisita, '/api/me/visitas', { method: 'POST', body: { ...cuerpo, client_id: randomUUID() }, portador: true })
      fake.estado.errorRpc = null
      check(
        'si el mensaje mismo repite la transcripción, el log la cambia por "[texto de la visita omitido]"',
        fallo2.status === 500 && sinSecretos(desde2) && moduleLogs.slice(desde2).join(' ').includes(TEXTO_OMITIDO_EN_LOG),
        moduleLogs.slice(desde2)
      )

      const nueva = await pedir(reportarVisita, '/api/me/visitas', { method: 'POST', body: { ...cuerpo, client_id: randomUUID() }, portador: true })
      check('(preparación) una visita no efectiva de hoy para corregir y anular', nueva.status === 201, nueva.body)
      const id = nueva.body?.visita?.id as string
      fake.estado.errorRpc = { code: '23502', message: 'null value in column "updated_by" violates not-null constraint', details: `Failing row contains (${id}, ${SECRETOS.correccion}, ${SECRETOS.compromisos}).`, hint: null }
      const desde3 = moduleLogs.length
      const corregida = await pedir(corregirVisita, `/api/me/visitas/${id}`, { method: 'PATCH', body: { conclusion: SECRETOS.correccion }, id, portador: true })
      const anulada = await pedir(anularVisita, `/api/me/visitas/${id}/anular`, { method: 'POST', body: { motivo: SECRETOS.motivo }, id, portador: true })
      fake.estado.errorRpc = null
      check('PATCH y anular con un error de la base sin traducir: 500 y el log sin la corrección, los compromisos ni el motivo', corregida.status === 500 && anulada.status === 500 && sinSecretos(desde3) && moduleLogs.slice(desde3).some(l => l.includes('PATCH /api/me/visitas/[id]')) && moduleLogs.slice(desde3).some(l => l.includes('anular')), { corregida: corregida.body, anulada: anulada.body, logs: moduleLogs.slice(desde3) })

      // Proponer: el SDK de Claude puede traer en su mensaje parte de lo enviado; el log dice el estado, el tipo y el
      // parámetro, nunca ese mensaje (aquí falla la completa y también la mínima de respaldo).
      reiniciarLimitesVoz()
      const cuerpoPropuesta = { transcript: TRANSCRIPCION, lat: TEL.lat, lng: TEL.lng, precision: 12, hora: '2026-10-13T10:41:00.000-05:00' }
      const respuestaOriginal = respuestaClaude
      const desde4 = moduleLogs.length
      respuestaClaude = () => {
        throw Anthropic.APIError.generate(400, { type: 'error', error: { type: 'invalid_request_error', message: `No se pudo con: ${TRANSCRIPCION}` } }, `400 ${TRANSCRIPCION}`, new Headers())
      }
      const falloClaude = await pedir(proponer, '/api/me/voz/proponer', { method: 'POST', body: cuerpoPropuesta, portador: true })
      respuestaClaude = () => {
        throw new TypeError(`fallo inesperado con ${TRANSCRIPCION}`)
      }
      const falloInterno = await pedir(proponer, '/api/me/voz/proponer', { method: 'POST', body: cuerpoPropuesta, portador: true })
      respuestaClaude = respuestaOriginal
      reiniciarLimitesVoz()
      check(
        'proponer: Claude falla (502) o algo inesperado falla (500) y el log no lleva la transcripción (solo el tipo y el estado)',
        falloClaude.status === 502 && falloInterno.status === 500 && sinSecretos(desde4) && moduleLogs.slice(desde4).every(l => !l.includes('doctora') && !l.includes('Ramírez')) && moduleLogs.slice(desde4).some(l => l.includes('400')),
        { falloClaude: falloClaude.body, falloInterno: falloInterno.body, logs: moduleLogs.slice(desde4) }
      )
    }

    print('\n12. Login móvil y GET /api/auth/me: las claves reales = mobile/lib/claves-api.ts')
    {
      // Las contraseñas de prueba están en texto plano heredado: el login las migra a bcrypt (y eso cambia el pv del
      // token). Se restauran al terminar para no tocar las demás pruebas.
      const usuarios = tablas.users as Fila[]
      const originales = usuarios.map(u => ({ fila: u, password: u.password }))
      try {
        const entrar = (userId: string, cliente?: string) =>
          pedirLogin(login, { email: `${String(usuarios.find(u => u.id === userId)?.email).toUpperCase()} `, password: `hash-${userId}`, ...(cliente ? { cliente } : {}) })
        const movil = await entrar(VENTAS_ID, 'movil')
        check(
          'POST /api/auth/login { cliente: movil }: 200 con exactamente las claves de login, usuario y ejecutivaMovil',
          movil.status === 200 && ok('login', movil.body) && ok('usuario', movil.body.usuario) && ok('ejecutivaMovil', movil.body.ejecutiva) && movil.body.ejecutiva.id === EJEC_A && movil.body.ejecutiva.zona === 'Bucaramanga',
          movil.body && { claves: clavesDe(movil.body), usuario: clavesDe(movil.body.usuario), ejecutiva: clavesDe(movil.body.ejecutiva) }
        )
        check('login móvil: sin Set-Cookie (el token va en el cuerpo)', movil.headers.get('set-cookie') === null && typeof movil.body?.token === 'string')
        const yo = await leer(await verMe(new NextRequest('http://localhost:3000/api/auth/me', { headers: { authorization: `Bearer ${movil.body?.token}` } })))
        check(
          'GET /api/auth/me con ese token: exactamente las claves de me, user = { id, email, full_name, role, active } y ejecutivaMovil',
          yo.status === 200 && ok('me', yo.body) && clavesDe(yo.body.user).join(' ') === 'active email full_name id role' && ok('ejecutivaMovil', yo.body.ejecutiva) && yo.body.user.id === VENTAS_ID,
          yo.body && { claves: clavesDe(yo.body), user: clavesDe(yo.body.user), ejecutiva: clavesDe(yo.body.ejecutiva) }
        )
        const sinEjecutiva = await entrar(DIRECTORA_ID, 'movil')
        const yoSin = await leer(await verMe(new NextRequest('http://localhost:3000/api/auth/me', { headers: { authorization: `Bearer ${sinEjecutiva.body?.token}` } })))
        check(
          'sin Ejecutivo Comercial enlazado: las mismas claves, con ejecutiva null (login y me)',
          sinEjecutiva.status === 200 && ok('login', sinEjecutiva.body) && ok('usuario', sinEjecutiva.body.usuario) && sinEjecutiva.body.ejecutiva === null && yoSin.status === 200 && ok('me', yoSin.body) && yoSin.body.ejecutiva === null,
          { login: sinEjecutiva.body, me: yoSin.body }
        )
        const web = await entrar(ADMIN_ID)
        check('sin cliente: la forma de la web ({ user, message } y cookie), no la del teléfono', web.status === 200 && !('token' in (web.body ?? {})) && (web.headers.get('set-cookie') ?? '').includes(`${SESSION_COOKIE_NAME}=`), web.body)
      } finally {
        for (const { fila, password } of originales) fila.password = password
      }
    }

    print('\n13. Importador de VMO (la ruta sigue deshabilitada): reemplaza solo lo importado del mes')
    {
      const vmo = (id: string, fecha: string, extra: Fila = {}): Fila => ({ id, kam_id: KAM_BGA, kam_name: 'KAM Bucaramanga', visit_type: 'Visita efectiva', contact_type: 'Visita presencial', lat: 7.1, lng: -73.1, visit_date: fecha, hospital_id: null, imported_by: ADMIN_ID, imported_at: `${fecha}T12:00:00Z`, import_id: null, created_at: `${fecha}T12:00:00Z`, updated_at: `${fecha}T12:00:00Z`, source: 'vmo_import', executive_id: null, client_id: null, tipo: null, deleted_at: null, out_of_territory: false, ...extra })
      const appDeSeptiembre = filaVisitaApp({ visit_date: '2026-09-15', checked_in_at: '2026-09-15T10:00:00.000-05:00', reported_at: '2026-09-15T10:05:00.000-05:00' })
      tablas.visits.push(vmo('vmo-sep-1', '2026-09-03'), vmo('vmo-sep-2', '2026-09-28'), appDeSeptiembre, vmo('vmo-ago-1', '2026-08-30'), vmo('vmo-jul-1', '2026-07-10'))
      const nuevas = (fecha: string) => [
        { kam_id: KAM_BGA, kam_name: 'KAM Bucaramanga', visit_type: 'Visita efectiva', contact_type: 'Visita presencial', lat: 7.11, lng: -73.11, visit_date: fecha },
        { kam_id: KAM_BGA, kam_name: 'KAM Bucaramanga', visit_type: 'Visita no efectiva', contact_type: 'Visita virtual', lat: 7.12, lng: -73.12, visit_date: fecha },
      ]
      const ids = () => tablas.visits.map(v => v.id as string)

      const borradosAntes = fake.requests.filter(r => r.method === 'DELETE' && r.table === 'visits').length
      const borrarImportacion = await pedir(borrarImportacionVmo, `/api/visits/import?importId=${randomUUID()}`, { method: 'DELETE', userId: ADMIN_ID })
      check(
        'DELETE /api/visits/import: 410 y no borra nada (el histórico de VMO ya no se puede volver a importar)',
        borrarImportacion.status === 410 && fake.requests.filter(r => r.method === 'DELETE' && r.table === 'visits').length === borradosAntes,
        borrarImportacion.body
      )
      const septiembre = await leer(await importarMesVmo({ month: 9, year: 2026, filename: 'vmo-septiembre.xlsx', visits: nuevas('2026-09-10') }, ADMIN_ID))
      const borrado = fake.requests.filter(r => r.method === 'DELETE' && r.table === 'visits').slice(borradosAntes)
      const deSeptiembre = tablas.visits.filter(v => String(v.visit_date).startsWith('2026-09'))
      check('importar septiembre: 200 con las 2 visitas', septiembre.status === 200 && septiembre.body.successful === 2 && septiembre.body.failed === 0, septiembre.body)
      check(
        'el borrado del mes va con source = vmo_import y entre el 1 de septiembre y el 1 de octubre',
        borrado.length === 1 && borrado[0].params.get('source') === 'eq.vmo_import' && borrado[0].params.getAll('visit_date').join(' ') === 'gte.2026-09-01 lt.2026-10-01',
        borrado.map(r => r.params.toString())
      )
      check(
        'se fueron las importadas de septiembre; la de la app de septiembre y las de otros meses siguen',
        !ids().includes('vmo-sep-1') && !ids().includes('vmo-sep-2') && ids().includes(appDeSeptiembre.id as string) && ids().includes('vmo-ago-1') && ids().includes('vmo-jul-1'),
        deSeptiembre.map(v => [v.id, v.source])
      )
      check('las nuevas quedan como importadas (source vmo_import) con su import_id', deSeptiembre.filter(v => v.source === 'vmo_import').length === 2 && deSeptiembre.filter(v => v.source === 'vmo_import').every(v => typeof v.import_id === 'string'), deSeptiembre)

      const visitasAntes = tablas.visits.length
      fake.estado.falloBorradoVisitas = true
      const agosto = await leer(await importarMesVmo({ month: 8, year: 2026, filename: 'vmo-agosto.xlsx', visits: nuevas('2026-08-12') }, ADMIN_ID))
      fake.estado.falloBorradoVisitas = false
      check(
        'si el borrado del mes falla: 500 "no se importó nada", ninguna visita insertada y el registro de importación quitado',
        agosto.status === 500 && /no se importó nada/.test(agosto.body.error) && tablas.visits.length === visitasAntes && ids().includes('vmo-ago-1') && !(tablas.visit_imports ?? []).some(r => r.month === 8 && r.year === 2026),
        { agosto: agosto.body, visitas: tablas.visits.length, antes: visitasAntes, importaciones: tablas.visit_imports }
      )

      fake.estado.sin0830 = true
      const julio = await leer(await importarMesVmo({ month: 7, year: 2026, filename: 'vmo-julio.xlsx', visits: nuevas('2026-07-20') }, ADMIN_ID))
      fake.estado.sin0830 = false
      check(
        'antes de la 0830 (sin la columna source): borra el mes como siempre e importa',
        julio.status === 200 && julio.body.successful === 2 && !ids().includes('vmo-jul-1') && tablas.visits.filter(v => String(v.visit_date).startsWith('2026-07')).length === 2,
        julio.body
      )
    }

    print('\n14. Agenda (F4.1, 0840): agendar, cancelar, el vínculo con la visita, Hoy, Mis números y el dictado por campo')
    {
      const M3 = 'f1f1f1f1-0000-4000-8000-000000000003'
      const M4 = 'f1f1f1f1-0000-4000-8000-000000000004'
      const M5 = 'f1f1f1f1-0000-4000-8000-000000000005'
      for (const [id, nombre] of [[M3, 'Dra. Agenda Tres'], [M4, 'Dr. Agenda Cuatro'], [M5, 'Dr. Agenda Cinco']] as const) {
        tablas.medicos.push({ id, nombre, especialidades: ['ortopedia'], municipality_id: '68001', tipo_documento: 'CC', numero_documento: `5550${id.slice(-1)}777`, telefono: '3157778899', email: null, activo: true })
        tablas.medico_sedes.push({ medico_id: id, sede_id: S1, rol: 'atiende', principal: true })
      }
      tablas.medico_sedes.push({ medico_id: M3, sede_id: S2, rol: 'atiende', principal: false }, { medico_id: M5, sede_id: S2, rol: 'atiende', principal: false })
      const SUB_VIEJO = randomUUID()
      tablas.subtipos_institucionales.push({ id: SUB_VIEJO, codigo: 'prueba_viejo', nombre: 'Prueba vieja', para_que: 'Prueba', roles_sugeridos: ['compras'], orden: 99, vigente_desde: CONFIG_VIGENTE_DESDE, vigente_hasta: '2026-10-15' })
      const MANANA = '2026-10-14'
      const cita = (extra: Fila = {}): Fila => ({ fecha: MANANA, hora: '09:30', tipo: 'medica', medico_id: M3, sede_id: S1, nota: 'Llevar muestras', ...extra })
      const agendarComo = (cuerpo: Fila, userId = VENTAS_ID) => pedir(agendar, '/api/me/agenda', { method: 'POST', body: cuerpo, portador: true, userId })
      const cancelar = (id: string, cuerpo: Fila = {}, userId = VENTAS_ID) => pedir(cancelarCita, `/api/me/agenda/${id}/cancelar`, { method: 'POST', body: cuerpo, id, portador: true, userId })
      const citaPorId = (id: string | undefined) => tablas.visitas_agenda.find(c => c.id === id)
      /** Una cita insertada directo (como la simulación), con la fecha de creación que se quiera. */
      const citaDirecta = (extra: Fila): string => {
        const fila: Fila = { id: randomUUID(), executive_id: EJEC_A, fecha: HOY, hora: null, tipo: 'medica', medico_id: M3, cuenta_id: null, subtipo_id: null, sede_id: S1, nota: null, estado: 'pendiente', visita_id: null, cancelada_at: null, cancelada_motivo: null, created_by: VENTAS_ID, created_at: '2026-10-12T15:00:00.000Z', updated_at: '2026-10-12T15:00:00.000Z', ...extra }
        tablas.visitas_agenda.push(fila)
        return fila.id as string
      }

      // Permisos
      const X = '99999999-9999-4999-8999-999999999999'
      const rutas: [string, Handler, string, string?][] = [
        ['GET /api/me/agenda', verAgenda, '/api/me/agenda'],
        ['POST /api/me/agenda', agendar, '/api/me/agenda', 'POST'],
        ['POST /api/me/agenda/[id]/cancelar', cancelarCita, `/api/me/agenda/${X}/cancelar`, 'POST'],
        ['POST /api/me/voz/campos', repartirCampos, '/api/me/voz/campos', 'POST'],
      ]
      const escriturasAntes = fake.writes().length
      for (const [nombre, handler, path, method] of rutas) {
        const viewer = await pedir(handler, path, { method, userId: VIEWER_ID, id: X, body: method ? {} : undefined })
        const directora = await pedir(handler, path, { method, userId: DIRECTORA_ID, id: X, body: method ? {} : undefined, portador: true })
        const anonimo = await pedir(handler, path, { method, userId: null, id: X, body: method ? {} : undefined })
        check(`${nombre}: viewer 403, usuario sin Ejecutivo Comercial 403, sin sesión 401`, viewer.status === 403 && directora.status === 403 && directora.body?.error === MENSAJE_SIN_EJECUTIVA && anonimo.status === 401, { viewer: viewer.status, directora: directora.body, anonimo: anonimo.status })
      }
      check('ningún rechazo de permisos escribió nada', fake.writes().length === escriturasAntes)

      // Agendar
      const nueva = await agendarComo(cita())
      const c1 = nueva.body?.cita as W.CitaItem
      check('agendar una cita médica válida: 201 { cita } con las claves de la app', nueva.status === 201 && ok('citaResponse', nueva.body) && ok('cita', c1) && ok('sedeCita', c1.sede), nueva.body)
      check(
        'la cita: pendiente, hora HH:MM, el médico y la sede (con cuenta y coordenadas), anticipada (se creó antes de su día) y cancelable',
        c1.estado === 'pendiente' && c1.hora === '09:30' && c1.fecha === MANANA && c1.medico?.nombre === 'Dra. Agenda Tres' && c1.cuenta === null && c1.sede.nombre === 'Clínica Norte' && c1.sede.cuenta_nombre === 'Clínica Norte S.A.' && c1.sede.lat === alNorte(120).lat && c1.sede.ubicacion_confirmada && c1.anticipada && c1.cancelable && c1.nota === 'Llevar muestras' && c1.distancia_m === null && c1.dentro_del_radio === null,
        c1
      )
      const rpcCita = fake.rpcs.filter(r => r.nombre === 'agenda_crear').at(-1)
      check('el jsonb de agenda_crear: solo las claves del contrato, con el usuario de la sesión', clavesDe(rpcCita?.args.p).join() === [...CLAVES_API.citaCreate].sort().join() && rpcCita?.args.p_user === VENTAS_ID && rpcCita?.args.p.cuenta_id === null, rpcCita?.args)
      check('nunca el documento ni el teléfono del médico en la cita', !nueva.texto.includes('5550') && !nueva.texto.includes('3157778899'))

      tablas.dias_libres.push({ id: randomUUID(), executive_id: EJEC_A, fecha: '2026-10-20', fraccion: 1, motivo: 'vacaciones', nota: null, estado: 'aprobado', registrado_por: VENTAS_ID, registrado_at: '2026-10-01T15:00:00Z', fuera_de_plazo: false, justificacion: null, revisado_por: ADMIN_ID, revisado_at: '2026-10-02T15:00:00Z', motivo_revision: null, created_at: '2026-10-01T15:00:00Z', updated_at: '2026-10-02T15:00:00Z' })
      const citasAntes = tablas.visitas_agenda.length
      const rechazoCita = async (nombre: string, cuerpo: Fila, status: number, mensaje: string, opciones: { sinBase?: boolean; userId?: string } = {}) => {
        const antes = fake.rpcs.filter(r => r.nombre === 'agenda_crear').length
        const r = await agendarComo(cuerpo, opciones.userId)
        const llamadas = fake.rpcs.filter(r2 => r2.nombre === 'agenda_crear').length - antes
        check(nombre, r.status === status && r.body?.error === mensaje && (!opciones.sinBase || llamadas === 0), { status: r.status, body: r.body, llamadas })
      }
      await rechazoCita('del pasado: 400 (sin ir a la base)', cita({ fecha: AYER }), 400, MENSAJE_CITA_PASADA, { sinBase: true })
      await rechazoCita('a más de 30 días: 400 (sin ir a la base)', cita({ fecha: '2026-11-13' }), 400, MENSAJE_CITA_LEJANA, { sinBase: true })
      await rechazoCita('en un día libre aprobado: 400', cita({ fecha: '2026-10-20' }), 400, MENSAJE_CITA_DIA_LIBRE)
      await rechazoCita('con un médico que no atiende en esa sede: 400', cita({ medico_id: M4, sede_id: S2 }), 400, MENSAJE_SEDE_NO_DEL_MEDICO)
      await rechazoCita('institucional con una cuenta ajena a la sede: 400', { fecha: MANANA, tipo: 'institucional', cuenta_id: C1, subtipo_id: SUBTIPO_ID.compras, sede_id: S2 }, 400, MENSAJE_SEDE_NO_DE_LA_CUENTA)
      await rechazoCita('con un subtipo vencido en esa fecha: 400', { fecha: '2026-10-16', tipo: 'institucional', cuenta_id: C1, subtipo_id: SUB_VIEJO, sede_id: S1 }, 400, MENSAJE_SUBTIPO_NO_VIGENTE)
      await rechazoCita('perfil solo institucional (Berta) y una cita médica: 400', cita(), 400, mensajePerfil('medica'), { userId: OTRA_ID })
      await rechazoCita('repetida (mismo médico y día): 409', cita({ hora: '15:00', nota: null }), 409, MENSAJE_CITA_REPETIDA_MEDICO)
      const malaHora = await agendarComo(cita({ hora: '25:00' }))
      check('hora no válida: 400 con errores por campo (hora)', malaHora.status === 400 && malaHora.body.errores?.some((e: { campo: string }) => e.campo === 'hora'), malaHora.body)
      check('ningún rechazo guardó una cita', tablas.visitas_agenda.length === citasAntes)
      const subtipoAntes = await agendarComo({ fecha: '2026-10-15', tipo: 'institucional', cuenta_id: C1, subtipo_id: SUB_VIEJO, sede_id: S1 })
      check('el mismo subtipo el último día de su vigencia: sí', subtipoAntes.status === 201, subtipoAntes.body)
      const inst = await agendarComo({ fecha: MANANA, tipo: 'institucional', cuenta_id: C1, subtipo_id: SUBTIPO_ID.compras, sede_id: S1 })
      check('institucional válida: 201 con la cuenta y el subtipo, sin médico ni hora', inst.status === 201 && inst.body.cita.cuenta?.id === C1 && inst.body.cita.subtipo?.codigo === 'compras' && inst.body.cita.medico === null && inst.body.cita.hora === null, inst.body)
      await rechazoCita('institucional repetida (misma cuenta, subtipo y día): 409', { fecha: MANANA, tipo: 'institucional', cuenta_id: C1, subtipo_id: SUBTIPO_ID.compras, sede_id: S1, hora: '11:00' }, 409, MENSAJE_CITA_REPETIDA_CUENTA)

      // GET /api/me/agenda
      const lista = await pedir(verAgenda, '/api/me/agenda', { portador: true })
      check('GET /api/me/agenda: de hoy a hoy + 7, max_fecha hoy + 30, claves de la app, por fecha y hora', lista.status === 200 && ok('agenda', lista.body) && todosCon('cita', lista.body.items) && lista.body.desde === HOY && lista.body.hasta === '2026-10-20' && lista.body.max_fecha === '2026-11-12' && lista.body.items.length === 3 && lista.body.items[0].id === c1.id, lista.body)
      check('más de 31 días: 400', (await pedir(verAgenda, '/api/me/agenda?desde=2026-10-01&hasta=2026-11-15', { portador: true })).status === 400)
      check('la agenda es propia: Berta no ve las de Ana', (await pedir(verAgenda, '/api/me/agenda', { portador: true, userId: OTRA_ID })).body.items.length === 0)

      // Cancelar
      const ajena = await cancelar(inst.body.cita.id, {}, OTRA_ID)
      check('cancelar la cita de otra persona: 404', ajena.status === 404 && ajena.body.error === MENSAJE_CITA_NO_EXISTE, ajena.body)
      const cancelada = await cancelar(inst.body.cita.id, { motivo: '  Compras no recibe esta semana ' })
      check('cancelar la propia pendiente (futura): 200 { cita } cancelada y ya no cancelable; el motivo queda', cancelada.status === 200 && ok('citaResponse', cancelada.body) && cancelada.body.cita.estado === 'cancelada' && !cancelada.body.cita.cancelable && citaPorId(inst.body.cita.id)?.cancelada_motivo === 'Compras no recibe esta semana', cancelada.body)
      const dosVeces = await cancelar(inst.body.cita.id)
      check('cancelar dos veces: 400', dosVeces.status === 400 && dosVeces.body.error === MENSAJE_CITA_YA_CANCELADA, dosVeces.body)
      const sinCanceladas = await pedir(verAgenda, '/api/me/agenda', { portador: true })
      const conCanceladas = await pedir(verAgenda, '/api/me/agenda?canceladas=true', { portador: true })
      check('la cancelada sale de la agenda; con canceladas=true vuelve', !sinCanceladas.body.items.some((c: W.CitaItem) => c.id === inst.body.cita.id) && conCanceladas.body.items.some((c: W.CitaItem) => c.id === inst.body.cita.id))
      const otraVez = await agendarComo({ fecha: MANANA, tipo: 'institucional', cuenta_id: C1, subtipo_id: SUBTIPO_ID.compras, sede_id: S1 })
      check('cancelada: lo mismo se vuelve a agendar', otraVez.status === 201, otraVez.body)
      const CITA_AYER = citaDirecta({ fecha: AYER, medico_id: M4, created_at: '2026-10-10T15:00:00.000Z' })
      const deAyer = await cancelar(CITA_AYER)
      check('cancelar una de ayer: 400', deAyer.status === 400 && deAyer.body.error === MENSAJE_CITA_PASADA_NO_SE_CANCELA, deAyer.body)
      check('id que no es uuid o que no existe: 404', (await cancelar('no-es-uuid')).status === 404 && (await cancelar(randomUUID())).status === 404)
      check('motivo de 301 caracteres: 400', (await cancelar(otraVez.body.cita.id, { motivo: 'x'.repeat(301) })).status === 400)

      // Citas de HOY: M3 creada AYER (agendada) en Clínica Norte; M4 creada hoy; M5 creada ayer en la Clínica Sur (800 m);
      // una cancelada con M5; otra de Berta con M5; y M5 mañana.
      const CITA_M3 = citaDirecta({ medico_id: M3, hora: '08:00:00' })
      const citaM4 = (await agendarComo(cita({ fecha: HOY, medico_id: M4, hora: '10:00' }))).body.cita as W.CitaItem
      const CITA_M5 = citaDirecta({ medico_id: M5, sede_id: S2, hora: '07:00:00' })
      const CITA_CANCELADA = citaDirecta({ medico_id: M5, estado: 'cancelada', cancelada_at: '2026-10-12T20:00:00.000Z' })
      const CITA_B = citaDirecta({ executive_id: EJEC_B, tipo: 'institucional', medico_id: null, cuenta_id: C2, subtipo_id: SUBTIPO_ID.compras, sede_id: S2 })
      const CITA_M5_MANANA = (await agendarComo(cita({ medico_id: M5 }))).body.cita.id as string

      // Hoy y Reportar: agenda_hoy con la distancia (la más cercana primero) y sin punto por hora
      const ctx = await pedir(pedirContexto, '/api/me/contexto', { method: 'POST', body: { lat: TEL.lat, lng: TEL.lng, precision: 10 }, portador: true })
      const hoyIds = (ctx.body?.agenda_hoy ?? []).map((c: W.CitaItem) => c.id)
      check('contexto: agenda_hoy con las de hoy (sin canceladas, ni de otros días, ni de otra persona) y las claves de la app', ctx.status === 200 && ok('contexto', ctx.body) && todosCon('cita', ctx.body.agenda_hoy) && todosCon('sedeCita', ctx.body.agenda_hoy.map((c: W.CitaItem) => c.sede)) && hoyIds.length === 3, ctx.body?.agenda_hoy)
      check('con el punto: la más cercana primero (Clínica Norte a 120 m: 08:00 y 10:00; Clínica Sur a 800 m)', hoyIds.join() === [CITA_M3, citaM4.id, CITA_M5].join(), hoyIds)
      const [h1, , h3] = ctx.body.agenda_hoy as W.CitaItem[]
      check('distancia a la sede y si está dentro del radio (500 m)', Math.abs((h1.distancia_m ?? 0) - 120) <= 1 && h1.dentro_del_radio === true && Math.abs((h3.distancia_m ?? 0) - 800) <= 1 && h3.dentro_del_radio === false, [h1, h3])
      check('anticipada: la creada ayer sí, la creada hoy no', h1.anticipada && !(ctx.body.agenda_hoy[1] as W.CitaItem).anticipada)
      const ctxSinPunto = await pedir(verContexto, '/api/me/contexto', { portador: true })
      check('sin el punto: por hora y sin distancias', ctxSinPunto.body.agenda_hoy.map((c: W.CitaItem) => c.id).join() === [CITA_M5, CITA_M3, citaM4.id].join() && ctxSinPunto.body.agenda_hoy.every((c: W.CitaItem) => c.distancia_m === null && c.dentro_del_radio === null))

      // Reportar con agenda_id: M3 (creada ayer) → agendada; la cita pasa a hecha
      const conCita = await pedir(reportarVisita, '/api/me/visitas', { method: 'POST', body: cuerpoVisita({ medico_id: M3, agenda_id: CITA_M3 }), portador: true })
      check('reportar con agenda_id: 201, vinculada y agendada (la cita se creó antes del día)', conCita.status === 201 && ok('visitaItem', conCita.body.visita) && conCita.body.visita.agenda_id === CITA_M3 && conCita.body.visita.agendada === true, conCita.body)
      check('la cita pasa a hecha con su visita', citaPorId(CITA_M3)?.estado === 'hecha' && citaPorId(CITA_M3)?.visita_id === conCita.body.visita.id)
      const rpcVisita = fake.rpcs.filter(r => r.nombre === 'visitas_registrar').at(-1)
      check('el jsonb de visitas_registrar lleva agenda_id', rpcVisita?.args.p.agenda_id === CITA_M3)
      const repetida = await pedir(reportarVisita, '/api/me/visitas', { method: 'POST', body: cuerpoVisita({ medico_id: M3, agenda_id: CITA_M3, client_id: conCita.body.visita.client_id }), portador: true })
      check('la misma visita otra vez (client_id): repetida, con el mismo vínculo', repetida.status === 201 && repetida.body.repetida === true && repetida.body.visita.agenda_id === CITA_M3 && repetida.body.visita.agendada === true)

      const rechazoVinculo = async (nombre: string, cuerpo: Fila, mensaje: string) => {
        const antes = visitasApp().length
        const r = await pedir(reportarVisita, '/api/me/visitas', { method: 'POST', body: cuerpo, portador: true })
        check(nombre, r.status === 400 && r.body?.error === mensaje && visitasApp().length === antes, r.body)
      }
      await rechazoVinculo('agenda_id de otra persona: 400 (23514) y nada guardado', cuerpoVisita({ tipo: 'institucional', medico_id: null, cuenta_id: C2, sede_id: S2, subtipo_id: SUBTIPO_ID.compras, ...alNorte(800), agenda_id: CITA_B }), MENSAJE_CITA_AJENA)
      await rechazoVinculo('agenda_id que no existe: 400', cuerpoVisita({ medico_id: M5, agenda_id: randomUUID() }), MENSAJE_CITA_AJENA)
      await rechazoVinculo('agenda_id de otro día: 400', cuerpoVisita({ medico_id: M5, agenda_id: CITA_M5_MANANA }), MENSAJE_CITA_OTRO_DIA)
      await rechazoVinculo('agenda_id con otro médico: 400', cuerpoVisita({ medico_id: M5, agenda_id: citaM4.id }), MENSAJE_CITA_OTRO_MEDICO)
      await rechazoVinculo('agenda_id cancelada: 400', cuerpoVisita({ medico_id: M5, agenda_id: CITA_CANCELADA }), MENSAJE_CITA_CANCELADA)
      await rechazoVinculo('agenda_id ya cumplida (una no efectiva a M3 con su cita): 400', cuerpoVisita({ medico_id: M3, agenda_id: CITA_M3, efectiva: false, failure_reason: 'Prueba' }), 'Esa cita ya tiene su visita')
      const malId = await pedir(reportarVisita, '/api/me/visitas', { method: 'POST', body: cuerpoVisita({ medico_id: M5, agenda_id: 'xyz' }), portador: true })
      check('agenda_id que no es uuid: 400 del esquema (campo agenda_id)', malId.status === 400 && malId.body.errores?.some((e: { campo: string }) => e.campo === 'agenda_id'), malId.body)

      // Sin agenda_id: se vincula sola la pendiente de ese día con el mismo médico (aunque sea en otra sede)
      const auto4 = await pedir(reportarVisita, '/api/me/visitas', { method: 'POST', body: cuerpoVisita({ medico_id: M4 }), portador: true })
      check('sin agenda_id con una cita pendiente de M4 hoy: se vincula sola; creada hoy → no agendada', auto4.status === 201 && auto4.body.visita.agenda_id === citaM4.id && auto4.body.visita.agendada === false && citaPorId(citaM4.id)?.estado === 'hecha', auto4.body)
      const auto5 = await pedir(reportarVisita, '/api/me/visitas', { method: 'POST', body: cuerpoVisita({ medico_id: M5 }), portador: true })
      check('M5 en Clínica Norte con su cita de hoy en la Clínica Sur: se vincula (mismo médico y día) y cuenta como agendada', auto5.status === 201 && auto5.body.visita.agenda_id === CITA_M5 && auto5.body.visita.agendada === true, auto5.body)
      const sinCita = await pedir(reportarVisita, '/api/me/visitas', { method: 'POST', body: cuerpoVisita({ medico_id: M5, efectiva: false, failure_reason: 'Salió a cirugía' }), portador: true })
      check('sin cita pendiente: la visita queda no agendada', sinCita.status === 201 && sinCita.body.visita.agenda_id === null && sinCita.body.visita.agendada === false, sinCita.body)

      // Anular la visita vinculada devuelve la cita a pendiente; otra visita la vuelve a cumplir
      const anulada = await pedir(anularVisita, `/api/me/visitas/${conCita.body.visita.id}/anular`, { method: 'POST', body: { motivo: 'Reporté mal la visita' }, id: conCita.body.visita.id, portador: true })
      check('anular la visita vinculada: la cita vuelve a pendiente (la visita anulada conserva su agenda_id)', anulada.status === 200 && citaPorId(CITA_M3)?.estado === 'pendiente' && citaPorId(CITA_M3)?.visita_id === null && porId(conCita.body.visita.id)?.agenda_id === CITA_M3, citaPorId(CITA_M3))
      const deNuevo = await pedir(reportarVisita, '/api/me/visitas', { method: 'POST', body: cuerpoVisita({ medico_id: M3 }), portador: true })
      check('y otra visita a M3 la vuelve a cumplir (agendada)', deNuevo.status === 201 && deNuevo.body.visita.agenda_id === CITA_M3 && deNuevo.body.visita.agendada === true && citaPorId(CITA_M3)?.estado === 'hecha', deNuevo.body)
      const hecha = await cancelar(CITA_M3)
      check('una cita hecha no se cancela: 400', hecha.status === 400 && hecha.body.error === MENSAJE_CITA_HECHA_NO_SE_CANCELA, hecha.body)
      const deHoy = await pedir(verVisitas, '/api/me/visitas', { portador: true })
      check('GET /api/me/visitas: cada visita con agenda_id y agendada', deHoy.status === 200 && todosCon('visitaItem', deHoy.body.items) && deHoy.body.items.some((v: W.VisitaItem) => v.id === deNuevo.body.visita.id && v.agendada && v.agenda_id === CITA_M3) && deHoy.body.items.some((v: W.VisitaItem) => v.agenda_id === null && !v.agendada))

      // Mis números: el bloque agenda del mes (decisión 8)
      const numeros = await pedir(verNumeros, '/api/me/numeros?mes=2026-10', { portador: true })
      const visitasAna = tablas.visits.filter(v => v.source === 'app' && v.executive_id === EJEC_A && String(v.visit_date).startsWith('2026-10') && !v.deleted_at && v.efectiva)
      const agendadas = visitasAna.filter(v => v.agendada === true).length
      check('Mis números: claves de la app y del bloque agenda', numeros.status === 200 && ok('numeros', numeros.body) && ok('numerosAgenda', numeros.body.agenda), numeros.body?.agenda)
      check(
        'efectivas agendadas 2 (M3 de nuevo y M5; la de M4 se vinculó con una cita del mismo día) ÷ efectivas del mes',
        numeros.body.agenda.efectivas_agendadas === 2 && agendadas === 2 && numeros.body.agenda.efectivas === visitasAna.length && numeros.body.agenda.porcentaje_agendadas === Math.round((2 / visitasAna.length) * 100) / 100,
        { agenda: numeros.body.agenda, efectivas: visitasAna.length }
      )
      check('cumplimiento: citas hechas 3 (M3, M4, M5) ÷ citas de días pasados o de hoy sin canceladas 4 (con la de ayer sin cumplir) = 0,75', numeros.body.agenda.citas_hasta_hoy === 4 && numeros.body.agenda.citas_hechas === 3 && numeros.body.agenda.cumplimiento === 0.75, numeros.body.agenda)

      // Proponer con cita_id: el contexto de Claude trae la agenda pendiente de hoy y la cita elegida
      reiniciarLimitesVoz()
      const CITA_PROPONER = citaDirecta({ tipo: 'institucional', medico_id: null, cuenta_id: C1, subtipo_id: SUBTIPO_ID.compras, sede_id: S1, nota: 'Llamar al 3009998877 antes' })
      const propuesta = await pedir(proponer, '/api/me/voz/proponer', { method: 'POST', body: { transcript: TRANSCRIPCION, lat: TEL.lat, lng: TEL.lng, precision: 12, hora: '2026-10-13T10:41:00.000-05:00', cita_id: CITA_PROPONER }, portador: true })
      const mensajeProponer = String(llamadasClaude.at(-1)?.messages[0]?.content ?? '')
      check('proponer con cita_id: 200 y el contexto de Claude trae la agenda pendiente de hoy y cita_elegida', propuesta.status === 200 && mensajeProponer.includes(`"cita_elegida":"${CITA_PROPONER}"`) && mensajeProponer.includes('"agenda":[') && mensajeProponer.includes(CITA_PROPONER), mensajeProponer.slice(0, 400))
      check('el contexto de Claude nunca lleva la nota de la cita (ni su teléfono) ni la cita hecha', !mensajeProponer.includes('3009998877') && !mensajeProponer.includes(`"id":"${CITA_M3}"`))

      // POST /api/me/voz/campos (Claude falso)
      const DICTADO = 'Le gustó el tornillo canulado. Quedé en enviarle una muestra el jueves y llamarlo al 3001234567.'
      const llave = process.env.ANTHROPIC_API_KEY
      delete process.env.ANTHROPIC_API_KEY
      const sinLlave = await pedir(repartirCampos, '/api/me/voz/campos', { method: 'POST', body: { transcript: DICTADO, tipo: 'medica' }, portador: true })
      process.env.ANTHROPIC_API_KEY = llave
      check(`campos sin ANTHROPIC_API_KEY: 503 "${MENSAJE_SIN_ANTHROPIC}"`, sinLlave.status === 503 && sinLlave.body.error === MENSAJE_SIN_ANTHROPIC, sinLlave.body)
      const vacio = await pedir(repartirCampos, '/api/me/voz/campos', { method: 'POST', body: { transcript: '   ', tipo: 'medica' }, portador: true })
      check('campos con el texto vacío: 400', vacio.status === 400, vacio.body)
      const respuestaOriginal = respuestaClaude
      respuestaClaude = () => mensajeClaude({ conclusion: 'Le gustó el tornillo canulado', compromisos: 'Enviar una muestra el jueves; llamarlo al 3001234567', next_step_date: '2026-10-15', extra: 'x' }, 'tool_use', 'repartir_campos')
      const llamadasAntes = llamadasClaude.length
      const escriturasCampos = fake.writes().length
      const logsCampos = moduleLogs.length
      const campos = await pedir(repartirCampos, '/api/me/voz/campos', { method: 'POST', body: { transcript: DICTADO, tipo: 'medica' }, portador: true })
      check('campos: un dictado con compromisos llena la conclusión Y los compromisos (claves de la app)', campos.status === 200 && ok('campos', campos.body) && campos.body.conclusion === 'Le gustó el tornillo canulado' && (campos.body.compromisos ?? '').startsWith('Enviar una muestra el jueves') && campos.body.next_step_date === '2026-10-15', campos.body)
      check('campos: el teléfono dicho no vuelve (número omitido)', !campos.texto.includes('3001234567') && (campos.body.compromisos ?? '').includes(NUMERO_OMITIDO))
      const peticionCampos = llamadasClaude.at(-1)
      const herramientaCampos = peticionCampos?.tools?.[0] as Anthropic.Beta.Messages.BetaTool | undefined
      check('campos: el mismo proveedor que proponer (modelo, herramienta estricta repartir_campos, prompt propio, la fecha de hoy con su día)', llamadasClaude.length === llamadasAntes + 1 && peticionCampos?.model === MODELO_PROPUESTA && herramientaCampos?.name === 'repartir_campos' && herramientaCampos?.strict === true && (peticionCampos?.system as { text: string }[])[0].text === PROMPT_CAMPOS && String(peticionCampos?.messages[0]?.content).includes('HOY: 2026-10-13 (martes)'))
      check('campos: nada se guarda y el dictado no sale en los logs', fake.writes().length === escriturasCampos && moduleLogs.slice(logsCampos).every(l => !l.includes('tornillo') && !l.includes('muestra')))
      respuestaClaude = () => mensajeClaude({ conclusion: 'Bien', compromisos: null, next_step_date: '2026-10-01' }, 'tool_use', 'repartir_campos')
      const fechaVieja = await pedir(repartirCampos, '/api/me/voz/campos', { method: 'POST', body: { transcript: 'Bien', tipo: 'institucional' }, portador: true })
      check('campos: una próxima reunión anterior a hoy se descarta; sin compromisos → null', fechaVieja.status === 200 && fechaVieja.body.next_step_date === null && fechaVieja.body.compromisos === null, fechaVieja.body)
      respuestaClaude = () => mensajeClaude(null, 'refusal')
      const rechazo = await pedir(repartirCampos, '/api/me/voz/campos', { method: 'POST', body: { transcript: DICTADO, tipo: 'medica' }, portador: true })
      respuestaClaude = () => mensajeClaude({ conclusion: 5 }, 'tool_use', 'repartir_campos')
      const invalido = await pedir(repartirCampos, '/api/me/voz/campos', { method: 'POST', body: { transcript: DICTADO, tipo: 'medica' }, portador: true })
      check('campos: Claude rechaza o devuelve algo que no cumple el esquema → 502 con el mensaje para escribir a mano', rechazo.status === 502 && rechazo.body.error === MENSAJE_FALLO_CAMPOS && invalido.status === 502, { rechazo: rechazo.body, invalido: invalido.body })
      // Respaldo de petición mínima, igual que en proponer (comparten pedirHerramienta).
      reiniciarLimitesVoz()
      const sinDictado = (logs: string[]) => logs.every(l => !l.includes('tornillo') && !l.includes('canulado') && !l.includes('muestra') && !l.includes('3001234567'))
      respuestaClaude = body => {
        if (esPeticionCompleta(body)) throw error400Claude('fallbacks: Extra inputs are not permitted')
        return mensajeClaude({ conclusion: 'Le gustó el tornillo canulado', compromisos: null, next_step_date: null }, 'tool_use', 'repartir_campos')
      }
      const desdeRespaldo = llamadasClaude.length
      const logsRespaldo = moduleLogs.length
      const conRespaldo = await pedir(repartirCampos, '/api/me/voz/campos', { method: 'POST', body: { transcript: DICTADO, tipo: 'medica' }, portador: true })
      const [completaCampos, minimaCampos] = llamadasClaude.slice(desdeRespaldo)
      const avisoCampos = moduleLogs.slice(logsRespaldo).find(l => l.includes('petición mínima')) ?? ''
      check(
        'campos: la completa da 400 → la mínima (sin betas, fallbacks, thinking ni strict; effort low; tool_choice auto) → 200 con el reparto',
        conRespaldo.status === 200 && ok('campos', conRespaldo.body) && conRespaldo.body.conclusion === 'Le gustó el tornillo canulado' && llamadasClaude.length === desdeRespaldo + 2 && esPeticionCompleta(completaCampos) && esPeticionMinima(minimaCampos, 'repartir_campos') && (minimaCampos?.max_tokens ?? 0) > MAX_TOKENS_CAMPOS && JSON.stringify(minimaCampos?.messages) === JSON.stringify(completaCampos?.messages),
        { status: conRespaldo.status, body: conRespaldo.body, llamadas: llamadasClaude.length - desdeRespaldo, minima: minimaCampos && Object.keys(minimaCampos) }
      )
      check('campos: el aviso del respaldo dice el parámetro (fallbacks), el tipo y el request_id, sin el dictado', avisoCampos.includes('repartir_campos') && avisoCampos.includes('parámetro fallbacks') && avisoCampos.includes('invalid_request_error') && avisoCampos.includes(REQUEST_ID_PRUEBA) && sinDictado(moduleLogs.slice(logsRespaldo)), moduleLogs.slice(logsRespaldo))
      respuestaClaude = () => {
        throw error400Claude(`messages.0.content: no se pudo con ${DICTADO}`)
      }
      const desdeAmbas = llamadasClaude.length
      const logsAmbas = moduleLogs.length
      const ambasCampos = await pedir(repartirCampos, '/api/me/voz/campos', { method: 'POST', body: { transcript: DICTADO, tipo: 'medica' }, portador: true })
      check(
        `campos: la mínima también da 400 → 502 "${MENSAJE_FALLO_CAMPOS}" tras dos peticiones; el log trae el parámetro y no el dictado`,
        ambasCampos.status === 502 && ambasCampos.body.error === MENSAJE_FALLO_CAMPOS && llamadasClaude.length === desdeAmbas + 2 && esPeticionMinima(llamadasClaude[desdeAmbas + 1], 'repartir_campos') && moduleLogs.slice(logsAmbas).some(l => l.includes('fallo al repartir') && l.includes('parámetro messages.0.content') && l.includes(MENSAJE_API_OMITIDO)) && sinDictado(moduleLogs.slice(logsAmbas)),
        { status: ambasCampos.status, llamadas: llamadasClaude.length - desdeAmbas, logs: moduleLogs.slice(logsAmbas) }
      )
      respuestaClaude = () => {
        throw Anthropic.APIError.generate(429, { type: 'error', error: { type: 'rate_limit_error', message: 'Number of request tokens has exceeded your per-minute rate limit' } }, undefined, new Headers())
      }
      const desde429 = llamadasClaude.length
      const logs429 = moduleLogs.length
      const limitadoCampos = await pedir(repartirCampos, '/api/me/voz/campos', { method: 'POST', body: { transcript: DICTADO, tipo: 'medica' }, portador: true })
      check(
        'campos: un 429 de Anthropic NO usa la mínima (una sola petición) → 502',
        limitadoCampos.status === 502 && llamadasClaude.length === desde429 + 1 && !moduleLogs.slice(logs429).some(l => l.includes('petición mínima')),
        { status: limitadoCampos.status, llamadas: llamadasClaude.length - desde429 }
      )
      respuestaClaude = respuestaOriginal
      // Comparte los límites de proponer: 10 en el minuto entre los dos; el siguiente (proponer) → 429.
      respuestaClaude = () => mensajeClaude({ conclusion: 'Bien', compromisos: null, next_step_date: null }, 'tool_use', 'repartir_campos')
      reiniciarLimitesVoz()
      const estados: number[] = []
      for (let i = 0; i < 10; i++) estados.push((await pedir(repartirCampos, '/api/me/voz/campos', { method: 'POST', body: { transcript: 'Bien', tipo: 'medica' }, portador: true })).status)
      respuestaClaude = respuestaOriginal
      const undecima = await pedir(proponer, '/api/me/voz/proponer', { method: 'POST', body: { transcript: TRANSCRIPCION, hora: '2026-10-13T10:41:00.000-05:00' }, portador: true })
      check('campos comparte los límites de proponer: 10 dictados en el minuto pasan y la propuesta siguiente → 429', estados.every(st => st === 200) && undecima.status === 429, { estados, undecima: undecima.status })
      reiniciarLimitesVoz()

      // Sin la 0840: la agenda 503 con un mensaje claro; lo demás igual que antes
      fake.estado.sin0840 = true
      const agendaVieja = await pedir(verAgenda, '/api/me/agenda', { portador: true })
      const agendarViejo = await agendarComo(cita({ fecha: '2026-10-22', medico_id: M4 }))
      const cancelarViejo = await cancelar(otraVez.body.cita.id)
      const ctxViejo = await pedir(pedirContexto, '/api/me/contexto', { method: 'POST', body: { lat: TEL.lat, lng: TEL.lng }, portador: true })
      const visitasViejas = await pedir(verVisitas, '/api/me/visitas', { portador: true })
      const numerosViejos = await pedir(verNumeros, '/api/me/numeros?mes=2026-10', { portador: true })
      const reporteViejo = await pedir(reportarVisita, '/api/me/visitas', { method: 'POST', body: cuerpoVisita({ medico_id: M4, efectiva: false, failure_reason: 'No estaba', agenda_id: randomUUID() }), portador: true })
      fake.estado.sin0840 = false
      for (const [nombre, respuesta] of [['GET /api/me/agenda', agendaVieja], ['POST /api/me/agenda', agendarViejo], ['POST /api/me/agenda/[id]/cancelar', cancelarViejo]] as const) {
        check(`sin la 0840, ${nombre}: 503 "${MENSAJE_FALTA_MIGRACION_0840}"`, respuesta.status === 503 && respuesta.body.error === MENSAJE_FALTA_MIGRACION_0840, respuesta)
      }
      check('sin la 0840, el contexto sigue (agenda_hoy vacía) con las claves de la app', ctxViejo.status === 200 && ok('contexto', ctxViejo.body) && ctxViejo.body.agenda_hoy.length === 0, ctxViejo.body)
      check('sin la 0840, GET /api/me/visitas sigue (agenda_id null, agendada false)', visitasViejas.status === 200 && todosCon('visitaItem', visitasViejas.body.items) && visitasViejas.body.items.every((v: W.VisitaItem) => v.agenda_id === null && v.agendada === false), visitasViejas.body)
      check('sin la 0840, Mis números sigue con agenda null', numerosViejos.status === 200 && ok('numeros', numerosViejos.body) && numerosViejos.body.agenda === null, numerosViejos.body)
      check('sin la 0840, POST /api/me/visitas registra como hoy (la función de la 0830 ignora agenda_id)', reporteViejo.status === 201 && reporteViejo.body.visita.agenda_id === null, reporteViejo.body)
    }

    check('nada salió a la red salvo al Supabase falso', fake.external.length === 0, fake.external)
  } finally {
    fijarFabricasVoz(null)
    delete process.env.OPENAI_API_KEY
    delete process.env.ANTHROPIC_API_KEY
  }

  print(`\nreporte-api-check: ${passed} OK, ${failed} fallas`)
  if (failed > 0) process.exit(1)
}

main().catch(error => {
  print(`reporte-api-check: error inesperado ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`)
  process.exit(1)
})
