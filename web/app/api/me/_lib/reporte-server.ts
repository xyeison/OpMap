// Utilidades de servidor de la F3 de visitas (el reporte de la ejecutiva y la voz): /api/me/contexto,
// /api/me/visitas/**, /api/me/voz/** y /api/me/numeros. La carpeta empieza por "_" para que Next.js no la exponga
// como ruta. Contrato: docs/fases/fase8-visitas-f3-f4-reporte-y-app-movil.md (secciones "API" y decisiones 3 a 16).
// Todo con supabaseAdmin (service_role).
//
// Aquí solo se LEEN filas y se pasan a la lógica pura (lib/reporte-visitas.ts, lib/visits-rules.ts): las reglas de la
// visita (radio, mismo día, topes, perfil, líneas) están en validarVisita y, como última palabra, en
// visitas_registrar / visitas_editar / visitas_anular (migración 0830). Las escrituras de visitas pasan SIEMPRE por
// esas funciones.
//
// Voz (decisiones 11 y 12): los clientes de OpenAI (transcribir) y de Anthropic (proponer) se crean aquí con fábricas
// INYECTABLES (las pruebas ponen falsos con fijarFabricasVoz). Sin llave: 503 con el mensaje del contrato y nunca se
// rompe el resto de la app. El audio llega en memoria (FormData) y se manda en memoria: nunca se escribe en disco ni
// en un bucket, y ni el audio ni la transcripción se registran en los logs (solo el tipo y el estado del error).
import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { fetchAllRows, jsonError } from '@/app/api/kams/_lib/kam-shared'
import { leerPorIds, mensajeRegla, nombresMunicipios, type ErrorBase } from '@/app/api/terceros/_lib/terceros-server'
import {
  calcularCuotaDetallada,
  errorVisitas,
  leerGeneral,
  type CuotaDetallada,
  type PersonaVisitas,
} from '@/app/api/config-visitas/_lib/visitas-server'
import {
  HERRAMIENTA_PROPUESTA,
  IDIOMA_TRANSCRIPCION,
  LIMITES_VOZ,
  MAX_TRANSCRIPT,
  MENSAJE_LIMITE_VOZ,
  MODELO_PROPUESTA,
  MODELO_TRANSCRIPCION,
  MODELO_TRANSCRIPCION_RESPALDO,
  MENSAJE_SIN_ANTHROPIC,
  MENSAJE_SIN_OPENAI,
  PROMPT_PROPUESTA,
  compromisosVencidos,
  esPunto,
  esquemaPropuesta,
  haversineM,
  resumenHoy,
  revisarLimite,
  sedesCercanas,
  valorReporte,
  visitaEditable,
  type ConfigContexto,
  type ContactoContexto,
  type ContextoDictado,
  type ContextoResponse,
  type ContextoValidacion,
  type LineaEjecutiva,
  type MedicoContexto,
  type Modalidad,
  type ModoEntrada,
  type Punto,
  type SedeCerca,
  type SedeDeMedico,
  type SubtipoContexto,
  type ValorReporte,
  type VisitaCompromiso,
  type VisitaCreate,
  type VisitaDeHoy,
  type VisitaItem,
} from '@/lib/reporte-visitas'
import {
  configPersonaVigente,
  generalVigente,
  mesDe,
  redondear2,
  sumarDias,
  type ConteoVigencia,
  type GeneralVigencia,
  type MedioTelefonica,
  type PersonaVigencia,
  type TipoVisita,
} from '@/lib/visits-rules'

// ---------------------------------------------------------------------------------------------
// 1. Errores
// ---------------------------------------------------------------------------------------------

/** Mensaje del 503 cuando la migración 0830 (columnas nuevas de visits, visit_lines, funciones) no está aplicada. */
export const MENSAJE_FALTA_MIGRACION_0830 =
  'El reporte de visitas aún no está disponible: falta aplicar la migración 0830 en la base de datos'

/**
 * ¿El error dice que falta algo de la 0830? Columna nueva de visits que no existe (42703 / PGRST204; fetchAllRows
 * conserva solo el mensaje), la tabla visit_lines o las funciones visitas_*.
 */
export function faltaMigracion0830(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const { code, message, details } = error as ErrorBase
  const texto = `${message ?? ''} ${details ?? ''}`
  if (code === '42703' || code === 'PGRST204') return true
  if (/column [\w."]+ does not exist|Could not find the '[^']+' column/i.test(texto)) return true
  const objeto0830 = /visit_lines|visitas_(registrar|editar|anular|config_vigente|distancia_m)/.test(texto)
  if (!objeto0830) return false
  if (code && ['42P01', '42883', 'PGRST202', 'PGRST205'].includes(code)) return true
  return /Could not find the (table|function)|relation .* does not exist|function .* does not exist/i.test(texto)
}

/** Lo que reemplaza en el log un texto de la visita que apareciera en el mensaje del error. */
export const TEXTO_OMITIDO_EN_LOG = '[texto de la visita omitido]'
const MAX_MENSAJE_LOG = 300

/**
 * Lo ÚNICO de un error que se registra: su código y su mensaje (recortado a 300 caracteres y sin los textos de la
 * visita que se pasen en `ocultar`). Nunca `details` ni `hint` (PostgREST pone ahí la fila que falló —"Failing row
 * contains (…)", con la transcripción, la conclusión, los compromisos o el motivo—) ni el resto del objeto: la regla
 * "transcript no sale en logs" del contrato vale también cuando la base falla.
 */
export function errorParaLog(error: unknown, ocultar: readonly (string | null | undefined)[] = []): { code?: string; message: string } {
  const base = (error && typeof error === 'object' ? error : {}) as ErrorBase & { name?: unknown }
  const nombre = error instanceof Error && error.name && error.name !== 'Error' ? `${error.name}: ` : ''
  let mensaje = typeof base.message === 'string' ? base.message : error instanceof Error ? error.message : typeof error === 'string' ? error : 'error desconocido'
  for (const texto of ocultar) {
    const limpio = typeof texto === 'string' ? texto.trim() : ''
    if (limpio.length >= 4) mensaje = mensaje.split(limpio).join(TEXTO_OMITIDO_EN_LOG)
  }
  mensaje = `${nombre}${mensaje}`
  if (mensaje.length > MAX_MENSAJE_LOG) mensaje = `${mensaje.slice(0, MAX_MENSAJE_LOG)}…`
  return typeof base.code === 'string' && base.code ? { code: base.code, message: mensaje } : { message: mensaje }
}

/**
 * Registra el error SIN datos de la visita (errorParaLog: código y mensaje, nunca la fila que falló) y responde 503 si
 * falta la 0830 (o la 0810) o 500. `ocultar`: los textos de la visita de esa petición (transcripción, conclusión,
 * compromisos, motivo), que se borran del mensaje si la base los repitiera ahí.
 */
export function errorReporte(
  contexto: string,
  error: unknown,
  mensaje = 'Error interno del servidor',
  ocultar: readonly (string | null | undefined)[] = []
): NextResponse {
  if (faltaMigracion0830(error)) {
    console.error(`Error en ${contexto}: falta la migración 0830`)
    return jsonError(MENSAJE_FALTA_MIGRACION_0830, 503)
  }
  return errorVisitas(contexto, errorParaLog(error, ocultar), mensaje)
}

/**
 * Traduce el error de una RPC de visitas a la respuesta, o null si no es uno que la API sepa explicar:
 *   23514 (regla) → 400 con el mensaje de la base · 22023 (forma) → 400 · P0002 (no existe o ajena) → 404 ·
 *   23505 (client_id de otra ejecutiva) → 409 · 23503 / 22P02 → 400 · falta la 0830 → 503.
 */
export function respuestaErrorVisita(error: ErrorBase | null | undefined, porDefecto: string): NextResponse | null {
  if (!error) return null
  if (faltaMigracion0830(error)) return jsonError(MENSAJE_FALTA_MIGRACION_0830, 503)
  const texto = (error.message ?? '').trim()
  switch (error.code) {
    case '23514':
      return jsonError(mensajeRegla(error, porDefecto), 400)
    case '22023':
      return jsonError(texto || porDefecto, 400)
    case 'P0002':
      return jsonError(texto || 'Esa visita no existe', 404)
    case '23505':
      return jsonError(mensajeRegla(error, 'Ese client_id ya se usó en otra visita'), 409)
    case '23503':
      return jsonError('Un dato relacionado no existe (sede, médico, cuenta, contacto, subtipo o línea)', 400)
    case '22P02':
    case '22007':
    case '22008':
      return jsonError(porDefecto, 400)
    default:
      return null
  }
}

// ---------------------------------------------------------------------------------------------
// 2. Lecturas
// ---------------------------------------------------------------------------------------------

/** Ventana de visitas en la que se buscan los compromisos vencidos (Hoy). */
export const DIAS_COMPROMISOS = 180
/** Radio de "sedes cercanas" del contexto (decisión 12: sedes a menos de 1 km). */
export const RADIO_SEDES_CERCA_M = 1000
export const MAX_SEDES_CERCA = 20

/** Líneas de la ejecutiva (executive_lines → business_lines), por nombre. */
export async function lineasDeEjecutiva(executiveId: string): Promise<LineaEjecutiva[]> {
  const vinculos = await fetchAllRows<{ line_id: string }>((from, to) =>
    supabaseAdmin.from('executive_lines').select('line_id').eq('executive_id', executiveId).order('line_id').range(from, to)
  )
  const lineas = await leerPorIds<{ id: string; code: string; name: string }>(
    vinculos.map(vinculo => vinculo.line_id),
    (trozo, from, to) => supabaseAdmin.from('business_lines').select('id, code, name').in('id', trozo).order('id').range(from, to)
  )
  return lineas
    .map(linea => ({ id: linea.id, code: linea.code, name: linea.name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }))
}

/** Subtipos institucionales vigentes en la fecha, en su orden. */
export async function subtiposVigentes(fecha: string): Promise<SubtipoContexto[]> {
  type Fila = { id: string; codigo: string; nombre: string; roles_sugeridos: string[] | null; orden: number; vigente_desde: string; vigente_hasta: string | null }
  const filas = await fetchAllRows<Fila>((from, to) =>
    supabaseAdmin
      .from('subtipos_institucionales')
      .select('id, codigo, nombre, roles_sugeridos, orden, vigente_desde, vigente_hasta')
      .lte('vigente_desde', fecha)
      .order('orden')
      .order('id')
      .range(from, to)
  )
  return filas
    .filter(fila => fila.vigente_hasta === null || fila.vigente_hasta >= fecha)
    .map(fila => ({ id: fila.id, codigo: fila.codigo, nombre: fila.nombre, roles_sugeridos: [...(fila.roles_sugeridos ?? [])] }))
}

/**
 * Configuración de visitas que rige hoy para la persona (espejo de visitas_config_vigente de la 0830 y de
 * configPersonaVigente de F2): perfil, radio presencial, telefónica (habilitada, tope, medios) y tope por médico.
 */
export function configDeHoy(
  general: readonly GeneralVigencia[],
  personas: readonly PersonaVigencia[],
  executiveId: string,
  hoy: string
): ConfigContexto {
  const persona = configPersonaVigente(personas, general, executiveId, hoy)
  return {
    radio_m: Number(persona.radioM),
    telefonica: {
      habilitada: persona.telefonicaHabilitada,
      tope_dia: Number(persona.topeTelefonicasDia),
      medios: [...generalVigente(general, 'telefonicas', hoy).medios],
    },
    tope_visitas_medico_dia: Number(generalVigente(general, 'tope_visitas_medico_dia', hoy)),
    perfil: [...persona.perfil],
  }
}

/** Fila de visits que lee la API (nunca la transcripción: es interna y no sale en listas). */
export interface FilaVisita {
  id: string
  client_id: string | null
  source: 'vmo_import' | 'app'
  executive_id: string | null
  tipo: TipoVisita
  subtipo_id: string | null
  subtipo_codigo: string | null
  medico_id: string | null
  cuenta_id: string | null
  sede_id: string | null
  contacto_id: string | null
  modalidad: Modalidad
  medio: MedioTelefonica | null
  efectiva: boolean
  failure_reason: string | null
  checked_in_at: string
  distance_m: number | null
  conclusion: string | null
  compromisos: string | null
  next_step_date: string | null
  input_mode: ModoEntrada
  out_of_territory: boolean
  visit_date: string
  deleted_at: string | null
}

export const COLUMNAS_VISITA =
  'id, client_id, source, executive_id, tipo, subtipo_id, subtipo_codigo, medico_id, cuenta_id, sede_id, contacto_id, modalidad, medio, efectiva, failure_reason, checked_in_at, distance_m, conclusion, compromisos, next_step_date, input_mode, out_of_territory, visit_date, deleted_at'

/** Visitas de la app de una ejecutiva entre dos fechas (visit_date), sin las anuladas salvo `conAnuladas`. */
export async function leerVisitas(
  executiveId: string,
  desde: string,
  hasta: string,
  opciones: { conAnuladas?: boolean } = {}
): Promise<FilaVisita[]> {
  return fetchAllRows<FilaVisita>((from, to) => {
    let consulta = supabaseAdmin
      .from('visits')
      .select(COLUMNAS_VISITA)
      .eq('source', 'app')
      .eq('executive_id', executiveId)
      .gte('visit_date', desde)
      .lte('visit_date', hasta)
    if (!opciones.conAnuladas) consulta = consulta.is('deleted_at', null)
    return consulta.order('checked_in_at').order('id').range(from, to)
  })
}

/** Una visita por id (o null). */
export async function leerVisita(id: string): Promise<FilaVisita | null> {
  const { data, error } = await supabaseAdmin.from('visits').select(COLUMNAS_VISITA).eq('id', id).limit(1)
  if (error) throw error
  return data && data.length > 0 ? (data[0] as unknown as FilaVisita) : null
}

/** La visita con ese client_id (idempotencia), o null. */
export async function visitaPorClientId(clientId: string): Promise<FilaVisita | null> {
  const { data, error } = await supabaseAdmin.from('visits').select(COLUMNAS_VISITA).eq('client_id', clientId).limit(1)
  if (error) throw error
  return data && data.length > 0 ? (data[0] as unknown as FilaVisita) : null
}

/** Conteo activo (config_conteo) para valorVisita. */
export async function leerConteo(): Promise<ConteoVigencia[]> {
  const filas = await fetchAllRows<ConteoVigencia>((from, to) =>
    supabaseAdmin
      .from('config_conteo')
      .select('id, subtipo_id, modo, peso, vigente_desde, vigente_hasta, anulado_at')
      .is('anulado_at', null)
      .order('subtipo_id')
      .order('vigente_desde')
      .order('id')
      .range(from, to)
  )
  return filas.map(fila => ({ ...fila, peso: Number(fila.peso) }))
}

/** Lo que hace falta para decir cuánto vale una visita: el conteo, la configuración general y si su sede está confirmada. */
export interface EntradaValor {
  conteo: readonly ConteoVigencia[]
  general: readonly GeneralVigencia[]
  /** sedes.ubicacion_confirmada por id de sede (lo que no esté: confirmada). */
  confirmadas: ReadonlyMap<string, boolean>
}

/**
 * A qué meta suma una visita y con qué peso (valorReporte): las no efectivas no suman; las de una sede por confirmar
 * aún no (suman solas cuando data manager la confirme); las telefónicas con el peso vigente de la telefónica.
 */
export function valorDe(
  visita: Pick<FilaVisita, 'efectiva' | 'visit_date' | 'tipo' | 'subtipo_id' | 'modalidad' | 'sede_id'>,
  entrada: EntradaValor
): ValorReporte {
  return valorReporte({
    conteo: entrada.conteo,
    general: entrada.general,
    fecha: visita.visit_date,
    tipo: visita.tipo,
    subtipo_id: visita.subtipo_id,
    efectiva: Boolean(visita.efectiva),
    modalidad: visita.modalidad,
    sede_confirmada: visita.sede_id ? entrada.confirmadas.get(visita.sede_id) : undefined,
  })
}

/** Nombre y ubicacion_confirmada de las sedes de unas visitas, por id. */
export async function sedesDeVisitas(ids: Iterable<string | null | undefined>): Promise<Map<string, { nombre: string; confirmada: boolean }>> {
  const validos = Array.from(new Set(Array.from(ids).filter((id): id is string => typeof id === 'string' && id.length > 0)))
  const filas = await leerPorIds<{ id: string; nombre: string; ubicacion_confirmada: boolean | null }>(validos, (trozo, from, to) =>
    supabaseAdmin.from('sedes').select('id, nombre, ubicacion_confirmada').in('id', trozo).order('id').range(from, to)
  )
  return new Map(filas.map(fila => [fila.id, { nombre: fila.nombre, confirmada: fila.ubicacion_confirmada === true }]))
}

/** Solo la confirmación de las sedes (para valorDe). */
export async function confirmacionDeSedes(ids: Iterable<string | null | undefined>): Promise<Map<string, boolean>> {
  const sedes = await sedesDeVisitas(ids)
  return new Map(Array.from(sedes.entries()).map(([id, sede]) => [id, sede.confirmada]))
}

/** Nombres por id de una tabla con columna `nombre`. */
async function nombresPorId(tabla: 'medicos' | 'cuentas' | 'sedes' | 'contactos', ids: Iterable<string | null | undefined>): Promise<Map<string, string>> {
  const validos = Array.from(ids).filter((id): id is string => typeof id === 'string' && id.length > 0)
  const filas = await leerPorIds<{ id: string; nombre: string }>(validos, (trozo, from, to) =>
    supabaseAdmin.from(tabla).select('id, nombre').in('id', trozo).order('id').range(from, to)
  )
  return new Map(filas.map(fila => [fila.id, fila.nombre]))
}

/**
 * Filas de visits → elementos de GET /api/me/visitas: nombres de médico, cuenta, sede, contacto y subtipo, líneas,
 * a qué meta suma (valorVisita con el conteo vigente en su fecha) y si la ejecutiva aún puede corregirla.
 */
export async function armarVisitaItems(
  filas: readonly FilaVisita[],
  entrada: { persona: PersonaVisitas; hoy: string; conteo: readonly ConteoVigencia[]; general: readonly GeneralVigencia[] }
): Promise<VisitaItem[]> {
  if (filas.length === 0) return []
  const ids = filas.map(fila => fila.id)
  const [medicos, cuentas, sedes, contactos, subtipos, lineas] = await Promise.all([
    nombresPorId('medicos', filas.map(fila => fila.medico_id)),
    nombresPorId('cuentas', filas.map(fila => fila.cuenta_id)),
    sedesDeVisitas(filas.map(fila => fila.sede_id)),
    nombresPorId('contactos', filas.map(fila => fila.contacto_id)),
    leerPorIds<{ id: string; codigo: string; nombre: string }>(
      filas.map(fila => fila.subtipo_id).filter((id): id is string => Boolean(id)),
      (trozo, from, to) => supabaseAdmin.from('subtipos_institucionales').select('id, codigo, nombre').in('id', trozo).order('id').range(from, to)
    ),
    leerPorIds<{ visit_id: string; line_id: string }>(ids, (trozo, from, to) =>
      supabaseAdmin.from('visit_lines').select('visit_id, line_id').in('visit_id', trozo).order('visit_id').order('line_id').range(from, to)
    ),
  ])
  const subtipoPorId = new Map(subtipos.map(subtipo => [subtipo.id, subtipo]))
  const lineasPorVisita = new Map<string, string[]>()
  for (const fila of lineas) lineasPorVisita.set(fila.visit_id, [...(lineasPorVisita.get(fila.visit_id) ?? []), fila.line_id])

  const activa = entrada.persona.status === 'active'
  const confirmadas = new Map(Array.from(sedes.entries()).map(([id, sede]) => [id, sede.confirmada]))
  return filas.map(fila => {
    const valor = valorDe(fila, { conteo: entrada.conteo, general: entrada.general, confirmadas })
    const subtipo = fila.subtipo_id ? subtipoPorId.get(fila.subtipo_id) : undefined
    return {
      id: fila.id,
      client_id: fila.client_id,
      tipo: fila.tipo,
      subtipo: fila.subtipo_id
        ? { id: fila.subtipo_id, codigo: subtipo?.codigo ?? fila.subtipo_codigo ?? '', nombre: subtipo?.nombre ?? fila.subtipo_codigo ?? 'Subtipo' }
        : null,
      medico: fila.medico_id ? { id: fila.medico_id, nombre: medicos.get(fila.medico_id) ?? 'Médico' } : null,
      cuenta: fila.cuenta_id ? { id: fila.cuenta_id, nombre: cuentas.get(fila.cuenta_id) ?? 'Cuenta' } : null,
      sede: { id: fila.sede_id ?? '', nombre: fila.sede_id ? sedes.get(fila.sede_id)?.nombre ?? 'Sede' : 'Sede' },
      contacto: fila.contacto_id ? { id: fila.contacto_id, nombre: contactos.get(fila.contacto_id) ?? 'Contacto' } : null,
      modalidad: fila.modalidad,
      medio: fila.medio,
      efectiva: Boolean(fila.efectiva),
      failure_reason: fila.failure_reason,
      checked_in_at: fila.checked_in_at,
      distance_m: fila.distance_m === null ? null : Number(fila.distance_m),
      conclusion: fila.conclusion,
      compromisos: fila.compromisos,
      next_step_date: fila.next_step_date,
      lineas: (lineasPorVisita.get(fila.id) ?? []).sort(),
      input_mode: fila.input_mode,
      out_of_territory: Boolean(fila.out_of_territory),
      cuenta_para: valor.meta,
      peso: valor.peso,
      sede_por_confirmar: valor.sede_por_confirmar,
      editable: activa && visitaEditable(fila, entrada.persona.id, entrada.hoy),
    }
  })
}

/** Una visita armada como elemento de la lista (o null si no existe). */
export async function cargarVisitaItem(
  id: string,
  entrada: { persona: PersonaVisitas; hoy: string; conteo?: readonly ConteoVigencia[]; general?: readonly GeneralVigencia[] }
): Promise<VisitaItem | null> {
  const fila = await leerVisita(id)
  if (!fila) return null
  const [conteo, general] = await Promise.all([entrada.conteo ?? leerConteo(), entrada.general ?? leerGeneral()])
  const [item] = await armarVisitaItems([fila], { persona: entrada.persona, hoy: entrada.hoy, conteo, general })
  return item ?? null
}

// ---------------------------------------------------------------------------------------------
// 3. Contexto (GET /api/me/contexto y POST /api/me/voz/proponer)
// ---------------------------------------------------------------------------------------------

type SedeFila = {
  id: string
  nombre: string
  cuenta_id: string | null
  ciudad: string | null
  municipality_id: string | null
  lat: number | string | null
  lng: number | string | null
  hospital_id: string | null
  ubicacion_confirmada: boolean | null
  activo: boolean
}

const COLUMNAS_SEDE = 'id, nombre, cuenta_id, ciudad, municipality_id, lat, lng, hospital_id, ubicacion_confirmada, activo'

const aNumero = (valor: number | string | null): number | null => {
  if (valor === null || valor === undefined || valor === '') return null
  const numero = Number(valor)
  return Number.isFinite(numero) ? numero : null
}

/** Grados de latitud (y de longitud a esa latitud) que cubren `metros`, con un margen del 10 %. */
function cajaAlrededor(punto: Punto, metros: number): { latMin: number; latMax: number; lngMin: number; lngMax: number } {
  const dLat = (metros * 1.1) / 111_320
  const coseno = Math.max(0.01, Math.cos((punto.lat * Math.PI) / 180))
  const dLng = dLat / coseno
  return { latMin: punto.lat - dLat, latMax: punto.lat + dLat, lngMin: punto.lng - dLng, lngMax: punto.lng + dLng }
}

/** Sedes activas, de cuentas activas, a menos de 1 km del punto, de la más cercana a la más lejana (como mucho 20). */
export async function sedesCercaDe(punto: Punto): Promise<SedeCerca[]> {
  const caja = cajaAlrededor(punto, RADIO_SEDES_CERCA_M)
  const filas = await fetchAllRows<SedeFila>((from, to) =>
    supabaseAdmin
      .from('sedes')
      .select(COLUMNAS_SEDE)
      .eq('activo', true)
      .gte('lat', caja.latMin)
      .lte('lat', caja.latMax)
      .gte('lng', caja.lngMin)
      .lte('lng', caja.lngMax)
      .order('id')
      .range(from, to)
  )
  const conCoordenadas = filas.map(fila => ({ ...fila, lat: aNumero(fila.lat), lng: aNumero(fila.lng) }))
  // Más candidatas que el tope: algunas pueden ser de cuentas inactivas.
  const cercanas = sedesCercanas(conCoordenadas, punto, RADIO_SEDES_CERCA_M, MAX_SEDES_CERCA * 3)
  const [cuentas, municipios] = await Promise.all([
    leerPorIds<{ id: string; nombre: string; clase: string | null; activo: boolean }>(
      cercanas.map(sede => sede.cuenta_id).filter((id): id is string => Boolean(id)),
      (trozo, from, to) => supabaseAdmin.from('cuentas').select('id, nombre, clase, activo').in('id', trozo).order('id').range(from, to)
    ),
    nombresMunicipios(cercanas.filter(sede => !sede.ciudad).map(sede => sede.municipality_id)),
  ])
  const cuentaPorId = new Map(cuentas.map(cuenta => [cuenta.id, cuenta]))
  return cercanas
    .filter(sede => !sede.cuenta_id || cuentaPorId.get(sede.cuenta_id)?.activo !== false)
    .slice(0, MAX_SEDES_CERCA)
    .map(sede => {
      const cuenta = sede.cuenta_id ? cuentaPorId.get(sede.cuenta_id) : undefined
      return {
        id: sede.id,
        nombre: sede.nombre,
        cuenta_id: sede.cuenta_id,
        cuenta_nombre: cuenta?.nombre ?? null,
        cuenta_clase: cuenta?.clase ?? null,
        ciudad: sede.ciudad ?? (sede.municipality_id ? municipios.get(sede.municipality_id) ?? null : null),
        lat: sede.lat as number,
        lng: sede.lng as number,
        distancia_m: sede.distancia_m,
        hospital_id: sede.hospital_id,
        ubicacion_confirmada: Boolean(sede.ubicacion_confirmada),
      }
    })
}

/** ¿Rige hoy esa asignación de visitante? */
const visitanteVigente = (fila: { desde: string; hasta: string | null }, fecha: string) =>
  fila.desde <= fecha && (fila.hasta === null || fila.hasta >= fecha)

/**
 * Médicos activos que ella visita hoy (medico_visitantes vigente) con sus especialidades, ciudad, líneas por las que
 * los visita y sedes activas donde atienden (con la distancia al punto, si se mandó). NUNCA el documento.
 */
export async function misMedicos(executiveId: string, hoy: string, punto: Punto | null): Promise<MedicoContexto[]> {
  const visitantes = await fetchAllRows<{ medico_id: string; line_id: string; desde: string; hasta: string | null }>((from, to) =>
    supabaseAdmin
      .from('medico_visitantes')
      .select('medico_id, line_id, desde, hasta')
      .eq('executive_id', executiveId)
      .order('medico_id')
      .order('line_id')
      .range(from, to)
  )
  const vigentes = visitantes.filter(fila => visitanteVigente(fila, hoy))
  const lineasPorMedico = new Map<string, Set<string>>()
  for (const fila of vigentes) lineasPorMedico.set(fila.medico_id, (lineasPorMedico.get(fila.medico_id) ?? new Set()).add(fila.line_id))
  const ids = Array.from(lineasPorMedico.keys())
  if (ids.length === 0) return []

  const [medicos, vinculos] = await Promise.all([
    leerPorIds<{ id: string; nombre: string; especialidades: string[] | null; municipality_id: string | null; activo: boolean }>(ids, (trozo, from, to) =>
      supabaseAdmin.from('medicos').select('id, nombre, especialidades, municipality_id, activo').in('id', trozo).order('id').range(from, to)
    ),
    leerPorIds<{ medico_id: string; sede_id: string }>(ids, (trozo, from, to) =>
      supabaseAdmin.from('medico_sedes').select('medico_id, sede_id').in('medico_id', trozo).order('medico_id').order('sede_id').range(from, to)
    ),
  ])
  const sedes = await leerPorIds<SedeFila>(
    vinculos.map(vinculo => vinculo.sede_id),
    (trozo, from, to) => supabaseAdmin.from('sedes').select(COLUMNAS_SEDE).in('id', trozo).order('id').range(from, to)
  )
  const cuentas = await nombresPorId('cuentas', sedes.map(sede => sede.cuenta_id))
  const sedePorId = new Map(sedes.filter(sede => sede.activo).map(sede => [sede.id, sede]))

  const sedesPorMedico = new Map<string, SedeDeMedico[]>()
  for (const vinculo of vinculos) {
    const sede = sedePorId.get(vinculo.sede_id)
    if (!sede) continue
    const lat = aNumero(sede.lat)
    const lng = aNumero(sede.lng)
    const distancia_m = punto && esPunto(lat, lng) ? haversineM(punto, { lat: lat as number, lng: lng as number }) : null
    const lista = sedesPorMedico.get(vinculo.medico_id) ?? []
    lista.push({ id: sede.id, nombre: sede.nombre, cuenta_nombre: sede.cuenta_id ? cuentas.get(sede.cuenta_id) ?? null : null, distancia_m })
    sedesPorMedico.set(vinculo.medico_id, lista)
  }
  const porDistancia = (a: SedeDeMedico, b: SedeDeMedico) =>
    (a.distancia_m ?? Number.POSITIVE_INFINITY) - (b.distancia_m ?? Number.POSITIVE_INFINITY) ||
    a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' })

  return medicos
    .filter(medico => medico.activo)
    .map(medico => ({
      id: medico.id,
      nombre: medico.nombre,
      especialidades: [...(medico.especialidades ?? [])],
      municipality_id: medico.municipality_id,
      lineas: Array.from(lineasPorMedico.get(medico.id) ?? []).sort(),
      sedes: (sedesPorMedico.get(medico.id) ?? []).sort(porDistancia),
    }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }))
}

/** Contactos activos de esas cuentas, sin teléfono ni correo. */
export async function contactosDeCuentas(cuentaIds: Iterable<string | null | undefined>): Promise<ContactoContexto[]> {
  const ids = Array.from(new Set(Array.from(cuentaIds).filter((id): id is string => typeof id === 'string' && id.length > 0)))
  if (ids.length === 0) return []
  const filas = await leerPorIds<{ id: string; cuenta_id: string; sede_id: string | null; nombre: string; cargo_texto: string | null; rol: string; activo: boolean }>(
    ids,
    (trozo, from, to) =>
      supabaseAdmin
        .from('contactos')
        .select('id, cuenta_id, sede_id, nombre, cargo_texto, rol, activo')
        .in('cuenta_id', trozo)
        .order('id')
        .range(from, to)
  )
  return filas
    .filter(fila => fila.activo !== false)
    .map(fila => ({ id: fila.id, cuenta_id: fila.cuenta_id, sede_id: fila.sede_id, nombre: fila.nombre, cargo_texto: fila.cargo_texto, rol: fila.rol }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }))
}

/** Compromisos vencidos de ella (visitas de los últimos DIAS_COMPROMISOS días, con el nombre del médico o cuenta). */
export async function compromisosDe(executiveId: string, hoy: string): Promise<ContextoResponse['compromisos_vencidos']> {
  const filas = await leerVisitas(executiveId, sumarDias(hoy, -DIAS_COMPROMISOS), hoy)
  const conCompromiso = filas.filter(fila => fila.next_step_date && fila.next_step_date < hoy)
  if (conCompromiso.length === 0) return []
  const [medicos, cuentas] = await Promise.all([
    nombresPorId('medicos', conCompromiso.map(fila => fila.medico_id)),
    nombresPorId('cuentas', conCompromiso.map(fila => fila.cuenta_id)),
  ])
  const visitas: VisitaCompromiso[] = filas.map(fila => ({
    id: fila.id,
    fecha: fila.visit_date,
    medico_id: fila.medico_id,
    cuenta_id: fila.cuenta_id,
    con: (fila.medico_id && medicos.get(fila.medico_id)) || (fila.cuenta_id && cuentas.get(fila.cuenta_id)) || 'Visita',
    next_step_date: fila.next_step_date,
  }))
  return compromisosVencidos(visitas, hoy)
}

/** ¿Hay llave para la voz? (sin llamar a nadie) */
export function vozDisponible(): ContextoResponse['voz'] {
  return { transcribir: llave('OPENAI_API_KEY') !== null, proponer: llave('ANTHROPIC_API_KEY') !== null }
}

/**
 * Todo lo que la app necesita para reportar (GET /api/me/contexto), y lo que recibe Claude (recortado por
 * contextoDictado). Sin punto: sedes_cerca y contactos vacíos y mis_medicos sin distancias. La meta del día es el
 * aporte de hoy de la cuota del mes (calcularCuotaDetallada de F2: un solo cálculo); la configuración, la vigente hoy.
 */
export async function cargarContexto(persona: PersonaVisitas, punto: Punto | null, hoy: string): Promise<ContextoResponse> {
  const [detalle, lineas, subtipos, visitasHoy, medicos, sedes, compromisos] = await Promise.all([
    calcularCuotaDetallada(persona, mesDe(hoy), hoy),
    lineasDeEjecutiva(persona.id),
    subtiposVigentes(hoy),
    leerVisitas(persona.id, hoy, hoy),
    misMedicos(persona.id, hoy, punto),
    punto ? sedesCercaDe(punto) : Promise.resolve([] as SedeCerca[]),
    compromisosDe(persona.id, hoy),
  ])
  const [contactos, confirmadas] = await Promise.all([
    contactosDeCuentas(sedes.map(sede => sede.cuenta_id)),
    confirmacionDeSedes(visitasHoy.map(visita => visita.sede_id)),
  ])
  const meta = metaDelDia(detalle, hoy)
  // La meta del día solo se cumple con lo que suma: las de sedes por confirmar no (aún) y la telefónica con su peso.
  const resumen = resumenHoy(
    visitasHoy.map(visita => {
      const valor = valorDe(visita, { conteo: detalle.conteo, general: detalle.general, confirmadas })
      return { tipo: visita.tipo, modalidad: visita.modalidad, efectiva: Boolean(visita.efectiva), cuenta_para: valor.meta, peso: valor.peso }
    }),
    meta
  )
  return {
    ejecutiva: { id: persona.id, nombre: persona.nombre, zona: persona.zona, municipio: persona.municipio, lineas },
    hoy: { fecha: hoy, meta: resumen.meta, hechas: resumen.hechas, cuota_dia_ok: resumen.cuota_dia_ok },
    config: configDeHoy(detalle.general, detalle.personas, persona.id, hoy),
    sedes_cerca: sedes,
    mis_medicos: medicos,
    contactos,
    subtipos,
    compromisos_vencidos: compromisos,
    voz: vozDisponible(),
  }
}

/** Meta del día (médica e institucional): el aporte de hoy en la cuota del mes (0 si hoy no es hábil o es libre). */
export function metaDelDia(detalle: Pick<CuotaDetallada, 'porDia'>, hoy: string): { medica: number; institucional: number } {
  const aporte = (dias: readonly { fecha: string; aporte: number }[]) => redondear2(dias.find(dia => dia.fecha === hoy)?.aporte ?? 0)
  return { medica: aporte(detalle.porDia.medica), institucional: aporte(detalle.porDia.institucional) }
}

/** Lee un punto de la consulta o del cuerpo (lat y lng juntas; null si no vienen). */
export function puntoDe(datos: { lat: number | null; lng: number | null }): Punto | null {
  return datos.lat !== null && datos.lng !== null && esPunto(datos.lat, datos.lng) ? { lat: datos.lat, lng: datos.lng } : null
}

// ---------------------------------------------------------------------------------------------
// 4. Registrar una visita: lo que validarVisita necesita de la base
// ---------------------------------------------------------------------------------------------

/**
 * Carga, por los ids del cuerpo, la ejecutiva (activa, con zona, sus líneas), la sede (activa, y si su cuenta está
 * activa), el médico (activo, sus sedes, si ella es su visitante vigente hoy), el subtipo y el contacto (con su
 * estado). Lo que no existe queda null.
 */
export async function contextoValidacion(datos: VisitaCreate, persona: PersonaVisitas, hoy: string): Promise<ContextoValidacion> {
  const [lineas, sedeData] = await Promise.all([
    lineasDeEjecutiva(persona.id),
    supabaseAdmin.from('sedes').select('id, nombre, cuenta_id, lat, lng, activo').eq('id', datos.sede_id).limit(1),
  ])
  if (sedeData.error) throw sedeData.error
  const sedeFila = (sedeData.data ?? [])[0] as { id: string; nombre: string; cuenta_id: string | null; lat: number | string | null; lng: number | string | null; activo: boolean } | undefined
  let cuentaActiva = true
  if (sedeFila?.activo && sedeFila.cuenta_id) {
    const { data, error } = await supabaseAdmin.from('cuentas').select('id, activo').eq('id', sedeFila.cuenta_id).limit(1)
    if (error) throw error
    const cuenta = (data ?? [])[0] as { id: string; activo: boolean } | undefined
    cuentaActiva = cuenta?.activo === true
  }

  const contexto: ContextoValidacion = {
    ejecutiva: { id: persona.id, activa: persona.status === 'active', con_zona: Boolean(persona.kamId), lineas: lineas.map(linea => linea.id) },
    sede:
      sedeFila && sedeFila.activo
        ? { id: sedeFila.id, nombre: sedeFila.nombre, cuenta_id: sedeFila.cuenta_id, lat: aNumero(sedeFila.lat), lng: aNumero(sedeFila.lng), cuenta_activa: cuentaActiva }
        : null,
    medico: null,
    subtipo: null,
    contacto: null,
  }

  if (datos.tipo === 'medica') {
    const [medicoData, vinculos, visitantes] = await Promise.all([
      supabaseAdmin.from('medicos').select('id, nombre, activo').eq('id', datos.medico_id).limit(1),
      fetchAllRows<{ sede_id: string }>((from, to) =>
        supabaseAdmin.from('medico_sedes').select('sede_id').eq('medico_id', datos.medico_id).order('sede_id').range(from, to)
      ),
      fetchAllRows<{ desde: string; hasta: string | null }>((from, to) =>
        supabaseAdmin
          .from('medico_visitantes')
          .select('desde, hasta')
          .eq('medico_id', datos.medico_id)
          .eq('executive_id', persona.id)
          .order('desde')
          .range(from, to)
      ),
    ])
    if (medicoData.error) throw medicoData.error
    const medico = (medicoData.data ?? [])[0] as { id: string; nombre: string; activo: boolean } | undefined
    if (medico) {
      contexto.medico = {
        id: medico.id,
        nombre: medico.nombre,
        activo: Boolean(medico.activo),
        sede_ids: vinculos.map(vinculo => vinculo.sede_id),
        es_visitante: visitantes.some(fila => visitanteVigente(fila, hoy)),
      }
    }
  } else {
    const [subtipoData, contactoData] = await Promise.all([
      supabaseAdmin.from('subtipos_institucionales').select('id, codigo, vigente_desde, vigente_hasta').eq('id', datos.subtipo_id).limit(1),
      datos.contacto_id
        ? supabaseAdmin.from('contactos').select('id, cuenta_id, activo').eq('id', datos.contacto_id).limit(1)
        : Promise.resolve({ data: [] as { id: string; cuenta_id: string; activo: boolean }[], error: null }),
    ])
    if (subtipoData.error) throw subtipoData.error
    if (contactoData.error) throw contactoData.error
    const subtipo = (subtipoData.data ?? [])[0] as { id: string; codigo: string; vigente_desde: string; vigente_hasta: string | null } | undefined
    const contacto = (contactoData.data ?? [])[0] as { id: string; cuenta_id: string; activo: boolean | null } | undefined
    contexto.subtipo = subtipo ?? null
    contexto.contacto = contacto ? { id: contacto.id, cuenta_id: contacto.cuenta_id, activo: contacto.activo !== false } : null
  }
  return contexto
}

/** Visitas de hoy de ella (no anuladas) para los topes de validarVisita. */
export function visitasParaTopes(filas: readonly FilaVisita[]): VisitaDeHoy[] {
  return filas.map(fila => ({ client_id: fila.client_id, medico_id: fila.medico_id, modalidad: fila.modalidad, efectiva: Boolean(fila.efectiva) }))
}

/**
 * El jsonb de visitas_registrar, campo a campo (allow-list: nunca el body entero), con la ejecutiva de la sesión.
 * Claves: las de la 0830 (client_id, executive_id, tipo, subtipo_id, medico_id, cuenta_id, sede_id, contacto_id,
 * modalidad, medio, efectiva, failure_reason, retry_date, checked_in_at, reported_at, lat, lng, gps_accuracy_m,
 * conclusion, compromisos, next_step_date, transcript, input_mode, lineas).
 */
export function jsonbRegistrar(datos: VisitaCreate, executiveId: string): Record<string, unknown> {
  return {
    client_id: datos.client_id,
    executive_id: executiveId,
    tipo: datos.tipo,
    subtipo_id: datos.subtipo_id,
    medico_id: datos.medico_id,
    cuenta_id: datos.cuenta_id,
    sede_id: datos.sede_id,
    contacto_id: datos.contacto_id,
    modalidad: datos.modalidad,
    medio: datos.medio,
    efectiva: datos.efectiva,
    failure_reason: datos.failure_reason,
    retry_date: datos.retry_date,
    checked_in_at: datos.checked_in_at,
    reported_at: datos.reported_at,
    lat: datos.lat,
    lng: datos.lng,
    gps_accuracy_m: datos.gps_accuracy_m,
    conclusion: datos.conclusion,
    compromisos: datos.compromisos,
    next_step_date: datos.next_step_date,
    transcript: datos.transcript,
    input_mode: datos.input_mode,
    lineas: [...datos.lineas],
  }
}

// ---------------------------------------------------------------------------------------------
// 5. Voz: proveedores inyectables
// ---------------------------------------------------------------------------------------------

/** Lo que la API usa del cliente de OpenAI (un `new OpenAI()` lo cumple; las pruebas ponen un falso). */
export interface ClienteTranscripcion {
  audio: {
    transcriptions: {
      create(body: { file: File; model: string; language?: string; prompt?: string; response_format?: 'json' }): Promise<{ text: string }>
    }
  }
}

/** Lo que la API usa del cliente de Anthropic (un `new Anthropic()` lo cumple; las pruebas ponen un falso). */
export interface ClientePropuesta {
  beta: {
    messages: {
      create(body: Anthropic.Beta.Messages.MessageCreateParamsNonStreaming): Promise<Anthropic.Beta.Messages.BetaMessage>
    }
  }
}

export interface FabricasVoz {
  openai: (apiKey: string) => ClienteTranscripcion
  anthropic: (apiKey: string) => ClientePropuesta
}

const FABRICAS_REALES: FabricasVoz = {
  // Un reintento (el SDK reintenta 408/409/429/5xx y errores de red); 60 s por intento.
  openai: apiKey => new OpenAI({ apiKey, maxRetries: 1, timeout: 60_000 }),
  anthropic: apiKey => new Anthropic({ apiKey, maxRetries: 1, timeout: 60_000 }),
}

let fabricas: FabricasVoz = FABRICAS_REALES

/** Solo para las pruebas: cambia las fábricas de clientes (null vuelve a las reales). */
export function fijarFabricasVoz(nuevas: Partial<FabricasVoz> | null): void {
  fabricas = nuevas ? { ...FABRICAS_REALES, ...nuevas } : FABRICAS_REALES
}

/** Valor de una variable de entorno (sin espacios) o null. Nunca se imprime. */
function llave(nombre: 'OPENAI_API_KEY' | 'ANTHROPIC_API_KEY'): string | null {
  const valor = process.env[nombre]
  return typeof valor === 'string' && valor.trim() ? valor.trim() : null
}

/** 503 con el mensaje del contrato si falta la llave de ese proveedor; null si está. */
export function respuestaSinLlave(proveedor: 'openai' | 'anthropic'): NextResponse | null {
  if (proveedor === 'openai') return llave('OPENAI_API_KEY') ? null : jsonError(MENSAJE_SIN_OPENAI, 503)
  return llave('ANTHROPIC_API_KEY') ? null : jsonError(MENSAJE_SIN_ANTHROPIC, 503)
}

// Límite de frecuencia de la voz (LIMITES_VOZ de lib/reporte-visitas.ts), por Ejecutivo Comercial. Como el del login,
// vive en la memoria de cada instancia (Vercel puede tener varias y se pierde en cada arranque en frío): frena el
// abuso desde una sesión, no es un límite global. Cuenta solo las llamadas que llegan al proveedor (las que pasaron
// las validaciones), que son las que cuestan.
const llamadasVoz = new Map<string, number[]>()
const MAX_CLAVES_VOZ = 2000

/**
 * Registra una llamada de voz de la persona y devuelve null, o 429 { error } con Retry-After si ya llegó al tope
 * (sin registrar nada).
 */
export function limiteVoz(uso: 'transcribir' | 'proponer', executiveId: string, ahoraMs: number = Date.now()): NextResponse | null {
  const clave = `${uso}:${executiveId}`
  const revision = revisarLimite(llamadasVoz.get(clave) ?? [], ahoraMs, LIMITES_VOZ[uso])
  if (!revision.permitido) {
    llamadasVoz.set(clave, revision.vigentes)
    return NextResponse.json({ error: MENSAJE_LIMITE_VOZ }, { status: 429, headers: { 'Retry-After': String(revision.reintentar_en_s) } })
  }
  if (!llamadasVoz.has(clave) && llamadasVoz.size >= MAX_CLAVES_VOZ) {
    const primera = llamadasVoz.keys().next().value
    if (primera !== undefined) llamadasVoz.delete(primera)
  }
  llamadasVoz.set(clave, [...revision.vigentes, ahoraMs])
  return null
}

/** Solo para las pruebas: olvida las llamadas registradas. */
export function reiniciarLimitesVoz(): void {
  llamadasVoz.clear()
}

/** Fallo de un proveedor de voz (la ruta responde 502 con el respaldo por toques sugerido). */
export class ErrorProveedorVoz extends Error {
  constructor(
    readonly proveedor: 'openai' | 'anthropic',
    readonly motivo: string
  ) {
    super(`Fallo de ${proveedor}: ${motivo}`)
    this.name = 'ErrorProveedorVoz'
  }
}

/** ¿Es un error del SDK (estado HTTP, red o tiempo agotado) de ese proveedor? */
export function esErrorDeProveedor(error: unknown): boolean {
  return error instanceof ErrorProveedorVoz || error instanceof OpenAI.APIError || error instanceof Anthropic.APIError
}

/** Resumen del error para el log: tipo y estado, NUNCA el contenido (ni audio ni transcripción). */
export function resumenErrorVoz(error: unknown): string {
  if (error instanceof ErrorProveedorVoz) return error.message
  if (error instanceof OpenAI.APIError || error instanceof Anthropic.APIError) {
    return `${error.name}${error.status ? ` ${error.status}` : ''}`
  }
  return error instanceof Error ? error.name : 'error desconocido'
}

/** ¿OpenAI dice que el modelo no existe o no está disponible para la cuenta? (entonces se usa whisper-1) */
export function modeloNoDisponible(error: unknown): boolean {
  if (!(error instanceof OpenAI.APIError)) return false
  if (error.code === 'model_not_found') return true
  if (error.status === 404) return true
  return (error.status === 400 || error.status === 403) && /model/i.test(error.message) && /not found|does not exist|not available|no access/i.test(error.message)
}

/**
 * Transcribe el audio (en memoria) con gpt-4o-transcribe en español y el vocabulario de VG; si OpenAI dice que el
 * modelo no está disponible, reintenta una vez con whisper-1. Lanza ErrorProveedorVoz u otro error del SDK.
 * Nada se escribe en disco: el File se pasa tal cual al SDK, que arma el multipart en memoria.
 */
export async function transcribirAudio(entrada: { audio: File; prompt: string }): Promise<{ texto: string; modelo: string }> {
  const apiKey = llave('OPENAI_API_KEY')
  if (!apiKey) throw new ErrorProveedorVoz('openai', 'sin llave')
  const cliente = fabricas.openai(apiKey)
  const intentar = (modelo: string) =>
    cliente.audio.transcriptions.create({
      file: entrada.audio,
      model: modelo,
      language: IDIOMA_TRANSCRIPCION,
      prompt: entrada.prompt,
      response_format: 'json',
    })
  let modelo = MODELO_TRANSCRIPCION
  let respuesta: { text: string }
  try {
    respuesta = await intentar(modelo)
  } catch (error) {
    if (!modeloNoDisponible(error)) throw error
    modelo = MODELO_TRANSCRIPCION_RESPALDO
    respuesta = await intentar(modelo)
  }
  if (!respuesta || typeof respuesta.text !== 'string') throw new ErrorProveedorVoz('openai', 'respuesta sin texto')
  const texto = respuesta.text.trim().replace(/[ \t]+/g, ' ').slice(0, MAX_TRANSCRIPT)
  return { texto, modelo }
}

/**
 * Quita del esquema lo que el modo estricto de las herramientas no admite (límites numéricos, de largo, de cantidad
 * y patrones) y escribe las uniones con null (`type: ['string', 'null']`) como `anyOf`, la forma que la guía de
 * structured outputs lista como admitida. El esquema sigue cerrado (additionalProperties: false y todo requerido);
 * los límites los vuelven a aplicar propuestaSchema y normalizarPropuesta sobre lo que devuelva Claude.
 */
export function esquemaParaHerramienta(esquema: unknown): unknown {
  const NO_ADMITIDOS = new Set(['maxItems', 'minItems', 'maxLength', 'minLength', 'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'multipleOf', 'pattern'])
  if (Array.isArray(esquema)) return esquema.map(esquemaParaHerramienta)
  if (!esquema || typeof esquema !== 'object') return esquema
  const salida: Record<string, unknown> = {}
  for (const [clave, valor] of Object.entries(esquema as Record<string, unknown>)) {
    if (NO_ADMITIDOS.has(clave)) continue
    salida[clave] = clave === 'enum' || clave === 'required' ? valor : esquemaParaHerramienta(valor)
  }
  if (Array.isArray(salida.type)) {
    const { type: tipos, description, ...resto } = salida as { type: unknown[]; description?: unknown } & Record<string, unknown>
    const ramas = tipos.map(tipo => (tipo === 'null' ? { type: 'null' } : { type: tipo, ...resto }))
    return description === undefined ? { anyOf: ramas } : { description, anyOf: ramas }
  }
  return salida
}

/** Tope de tokens de la propuesta: hasta 10 visitas cortas (no hay razonamiento: thinking between_tools). */
export const MAX_TOKENS_PROPUESTA = 4096

/** La definición de la herramienta proponer_visitas (estricta, con el esquema cerrado del contrato). */
export const HERRAMIENTA_PROPONER: Anthropic.Beta.Messages.BetaTool = {
  name: HERRAMIENTA_PROPUESTA.name,
  description: HERRAMIENTA_PROPUESTA.description,
  strict: true,
  input_schema: esquemaParaHerramienta(esquemaPropuesta) as Anthropic.Beta.Messages.BetaTool.InputSchema,
}

/** Mensaje del usuario: el contexto (JSON compacto, sin documentos ni teléfonos) y la transcripción. */
export function mensajeDictado(contexto: ContextoDictado, transcript: string): string {
  return [
    'CONTEXTO (JSON):',
    JSON.stringify(contexto),
    '',
    'TRANSCRIPCIÓN DEL DICTADO:',
    '"""',
    transcript,
    '"""',
    '',
    `Propón las visitas llamando a la herramienta ${HERRAMIENTA_PROPUESTA.name}.`,
  ].join('\n')
}

/**
 * Pide la propuesta a Claude (claude-sonnet-5-5) y devuelve la entrada cruda de la herramienta (la ruta la valida con
 * propuestaSchema y la normaliza con normalizarPropuesta).
 *
 * Claude Sonnet 5.5 rechaza con 400 el tool_choice forzado ('any' / 'tool'), thinking 'disabled' y una temperatura
 * distinta de la de serie (guía de la API, claude-api): por eso va tool_choice 'auto' con la herramienta estricta,
 * una sola llamada (disable_parallel_tool_use), la instrucción explícita en el mensaje y, si aun así no la llama, un
 * reintento; "sin razonamiento" = thinking 'between_tools' con effort 'low'. El prompt del sistema y la herramienta
 * van en caché. Respaldo del servidor ante un rechazo de seguridad (fallbacks 'default', beta
 * server-side-fallback-2026-07-01). Una respuesta 'refusal' o cortada por max_tokens es un fallo (502).
 */
export async function proponerVisitas(entrada: { contexto: ContextoDictado; transcript: string }): Promise<unknown> {
  const apiKey = llave('ANTHROPIC_API_KEY')
  if (!apiKey) throw new ErrorProveedorVoz('anthropic', 'sin llave')
  const cliente = fabricas.anthropic(apiKey)
  const peticion: Anthropic.Beta.Messages.MessageCreateParamsNonStreaming = {
    model: MODELO_PROPUESTA,
    max_tokens: MAX_TOKENS_PROPUESTA,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    thinking: { type: 'between_tools' },
    output_config: { effort: 'low' },
    system: [{ type: 'text', text: PROMPT_PROPUESTA, cache_control: { type: 'ephemeral' } }],
    tools: [HERRAMIENTA_PROPONER],
    tool_choice: { type: 'auto', disable_parallel_tool_use: true },
    messages: [{ role: 'user', content: mensajeDictado(entrada.contexto, entrada.transcript) }],
  }
  for (let intento = 1; intento <= 2; intento++) {
    const respuesta = await cliente.beta.messages.create(peticion)
    if (respuesta.stop_reason === 'refusal') throw new ErrorProveedorVoz('anthropic', 'rechazo')
    const bloque = respuesta.content.find(
      (contenido): contenido is Anthropic.Beta.Messages.BetaToolUseBlock =>
        contenido.type === 'tool_use' && contenido.name === HERRAMIENTA_PROPUESTA.name
    )
    if (respuesta.stop_reason === 'max_tokens') throw new ErrorProveedorVoz('anthropic', 'respuesta cortada (max_tokens)')
    if (bloque) return bloque.input
  }
  throw new ErrorProveedorVoz('anthropic', 'no usó la herramienta proponer_visitas')
}
