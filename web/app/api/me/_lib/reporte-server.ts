// Utilidades de servidor de la F3 de visitas (el reporte de la ejecutiva y la voz): /api/me/contexto,
// /api/me/visitas/**, /api/me/voz/**, /api/me/numeros y, desde la F4.1 (migración 0840), /api/me/agenda/** y
// /api/me/voz/campos. La carpeta empieza por "_" para que Next.js no la exponga como ruta. Contrato:
// docs/fases/fase8-visitas-f3-f4-reporte-y-app-movil.md (secciones "API", decisiones 3 a 16, "F4.1" y "F4.2").
// Todo con supabaseAdmin (service_role).
//
// Desde F1a (migración 0850) todo es de la PERSONA de campo (PersonaCampo: el usuario, con o sin Ejecutivo Comercial):
// las visitas y las citas se leen por user_id; una líder sin Ejecutivo Comercial reporta "como líder" (sin zona ni
// cuota, con los médicos de sus líneas: C9). Sin la 0850 aplicada, las rutas de /api/me/* que la usan responden 503 con
// MENSAJE_FALTA_MIGRACION_0850 (cuota y días libres siguen como antes).
//
// Aquí solo se LEEN filas y se pasan a la lógica pura (lib/reporte-visitas.ts, lib/visits-rules.ts): las reglas de la
// visita (radio, mismo día, topes, perfil, líneas) están en validarVisita y, como última palabra, en
// visitas_registrar / visitas_editar / visitas_anular (migración 0830). Las escrituras de visitas pasan SIEMPRE por
// esas funciones.
//
// Voz (decisiones 11 y 12): los clientes de OpenAI (transcribir) y de Anthropic (proponer) se crean aquí con fábricas
// INYECTABLES (las pruebas ponen falsos con fijarFabricasVoz). Sin llave: 503 con el mensaje del contrato y nunca se
// rompe el resto de la app. El audio llega en memoria (FormData) y se manda en memoria: nunca se escribe en disco ni
// en un bucket, y ni el audio ni la transcripción se registran en los logs (del error, solo el estado, el tipo de la
// API, el parámetro, el request_id y el mensaje de la API saneado: resumenErrorVoz).
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
  type PersonaCampo,
} from '@/app/api/config-visitas/_lib/visitas-server'
import { ejecutivoDeLaVisita, lineasDelMedico, visitaSumaALaCuota, visitanteVigenteEn, type ComoPersona, type VisitanteMedico } from '@/lib/persona-campo'
import { estadoVisible, mensajeChoque } from '@/lib/agenda-ciclo'
import {
  HERRAMIENTA_CAMPOS,
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
  MENSAJE_CITA_NO_EXISTE,
  PROMPT_CAMPOS,
  PROMPT_PROPUESTA,
  citaAnticipada,
  citaCancelable,
  compromisosVencidos,
  cuentasAgenda,
  distanciaACita,
  esPunto,
  esquemaCampos,
  esquemaPropuesta,
  haversineM,
  horaCorta,
  mensajeCampos,
  ordenarCitas,
  resumenHoy,
  revisarLimite,
  sedesCercanas,
  valorReporte,
  visitaEditable,
  type CitaCreate,
  type CitaItem,
  type ConfigContexto,
  type ContactoContexto,
  type ContextoDictado,
  type ContextoResponse,
  type ContextoValidacion,
  type EstadoCita,
  type LineaEjecutiva,
  type LineaPersona,
  type MedicoContexto,
  type MotivoCierre,
  type Modalidad,
  type ModoEntrada,
  type NumerosAgenda,
  type PersonaContexto,
  type PersonaMovil,
  type Punto,
  type SedeCerca,
  type SedeCita,
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

/** Mensaje del 503 de la agenda y del dictado por campo cuando la migración 0840 no está aplicada. */
export const MENSAJE_FALTA_MIGRACION_0840 =
  'La agenda de visitas aún no está disponible: falta aplicar la migración 0840 en la base de datos'

/**
 * ¿El error dice que falta algo de la 0840? La tabla visitas_agenda, las funciones agenda_crear / agenda_cancelar o las
 * columnas visits.agenda_id / visits.agendada (42P01, 42883, 42703 y sus equivalentes de PostgREST; fetchAllRows
 * conserva solo el mensaje). Se mira ANTES que faltaMigracion0830, que toma por suyo cualquier columna que no existe.
 */
export function faltaMigracion0840(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const { code, message, details } = error as ErrorBase
  const texto = `${message ?? ''} ${details ?? ''}`
  if (!/visitas_agenda|agenda_crear|agenda_cancelar|agenda_id|agendada/.test(texto)) return false
  if (code && ['42P01', '42883', '42703', 'PGRST202', 'PGRST204', 'PGRST205'].includes(code)) return true
  return /Could not find the (table|function)|Could not find the '[^']+' column|relation .* does not exist|function .* does not exist|column [\w."]+ does not exist/i.test(texto)
}

/** Mensaje del 503 de /api/me/* cuando la migración 0850 (la persona de campo) no está aplicada. */
export const MENSAJE_FALTA_MIGRACION_0850 =
  'El reporte de la persona de campo aún no está disponible: falta aplicar la migración 0850 en la base de datos'

/**
 * ¿El error dice que falta algo de la 0850? Las columnas visits.user_id o visitas_agenda.user_id / motivo_codigo /
 * no_realizada_* / eliminada_* / viene_de, o las funciones agenda_cerrar / agenda_eliminar / agenda_otra_fecha /
 * persona_*. Se mira ANTES que las de la 0840 y la 0830 (que toman por suyo cualquier columna que no existe).
 */
export function faltaMigracion0850(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const { code, message, details } = error as ErrorBase
  const texto = `${message ?? ''} ${details ?? ''}`
  if (!/user_id|motivo_codigo|no_realizada|eliminada_|viene_de|agenda_cerrar|agenda_eliminar|agenda_otra_fecha|persona_de_campo|persona_lineas/.test(texto)) return false
  if (code && ['42P01', '42883', '42703', 'PGRST202', 'PGRST204', 'PGRST205'].includes(code)) return true
  return /Could not find the (table|function)|Could not find the '[^']+' column|relation .* does not exist|function .* does not exist|column [\w."]+ does not exist/i.test(texto)
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
  if (faltaMigracion0850(error)) {
    console.error(`Error en ${contexto}: falta la migración 0850`)
    return jsonError(MENSAJE_FALTA_MIGRACION_0850, 503)
  }
  if (faltaMigracion0840(error)) {
    console.error(`Error en ${contexto}: falta la migración 0840`)
    return jsonError(MENSAJE_FALTA_MIGRACION_0840, 503)
  }
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
  if (faltaMigracion0850(error)) return jsonError(MENSAJE_FALTA_MIGRACION_0850, 503)
  if (faltaMigracion0840(error)) return jsonError(MENSAJE_FALTA_MIGRACION_0840, 503)
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

/**
 * Traduce el error de agenda_crear / agenda_cancelar / agenda_cerrar / agenda_eliminar / agenda_otra_fecha (0840, 0850):
 * 23514 (regla) → 400 con el mensaje de la base · 22023 (forma) → 400 · 23505 (cita repetida, segunda "otra fecha") →
 * 409 · 23P01 (choque de media hora) → 409 con el error en `hora` · P0002 (inexistente o ajena) → 404 · 23503 / 22P02
 * → 400 · falta la 0850 o la 0840 → 503. null si no es uno que la API sepa explicar.
 */
export function respuestaErrorAgenda(error: ErrorBase | null | undefined, porDefecto: string): NextResponse | null {
  if (!error) return null
  if (faltaMigracion0850(error)) return jsonError(MENSAJE_FALTA_MIGRACION_0850, 503)
  if (faltaMigracion0840(error)) return jsonError(MENSAJE_FALTA_MIGRACION_0840, 503)
  const texto = (error.message ?? '').trim()
  switch (error.code) {
    case '23P01': {
      const mensaje = texto || mensajeChoque('esa hora', 'otra cita')
      return jsonError(mensaje, 409, { errores: [{ campo: 'hora', mensaje }] })
    }
    case '23514':
      return jsonError(mensajeRegla(error, porDefecto), 400)
    case '22023':
      return jsonError(texto || porDefecto, 400)
    case '23505':
      return jsonError(mensajeRegla(error, 'Ya tienes una cita igual ese día'), 409)
    case 'P0002':
      return jsonError(texto || MENSAJE_CITA_NO_EXISTE, 404)
    case '23503':
      return jsonError('Un dato relacionado no existe (sede, médico, cuenta o subtipo)', 400)
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

/** Líneas de negocio por id (business_lines), por nombre. */
export async function lineasDePersona(ids: readonly string[]): Promise<LineaEjecutiva[]> {
  const lineas = await leerPorIds<{ id: string; code: string; name: string }>(Array.from(new Set(ids)), (trozo, from, to) =>
    supabaseAdmin.from('business_lines').select('id, code, name').in('id', trozo).order('id').range(from, to)
  )
  return lineas
    .map(linea => ({ id: linea.id, code: linea.code, name: linea.name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }))
}

/** Líneas de la ejecutiva (executive_lines → business_lines), por nombre. */
export async function lineasDeEjecutiva(executiveId: string): Promise<LineaEjecutiva[]> {
  const vinculos = await fetchAllRows<{ line_id: string }>((from, to) =>
    supabaseAdmin.from('executive_lines').select('line_id').eq('executive_id', executiveId).order('line_id').range(from, to)
  )
  return lineasDePersona(vinculos.map(vinculo => vinculo.line_id))
}

/** "Como qué" lleva la persona cada línea: como Ejecutivo Comercial si es de su Ejecutivo Comercial; si no, como líder. */
export function comoDeLinea(persona: Pick<PersonaCampo, 'lineasEc'>, lineaId: string): ComoPersona {
  return persona.lineasEc.includes(lineaId) ? 'ejecutivo' : 'lider'
}

/** La persona de campo para /api/auth/me (MeResponse.persona): su papel y sus líneas con "como qué". */
export function personaMovil(persona: Pick<PersonaCampo, 'rol' | 'lineasEc'>, lineas: readonly LineaEjecutiva[]): PersonaMovil {
  const conComo: LineaPersona[] = lineas.map(linea => ({ id: linea.id, nombre: linea.name, como: comoDeLinea(persona, linea.id) }))
  return { rol: persona.rol, lineas: conComo }
}

/** La persona de campo del contexto (ContextoResponse.persona). */
export function personaContexto(persona: PersonaCampo, lineas: readonly LineaEjecutiva[]): PersonaContexto {
  return { user_id: persona.userId, nombre: persona.nombre, executive_id: persona.executiveId, ...personaMovil(persona, lineas) }
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
  executiveId: string | null,
  hoy: string
): ConfigContexto {
  // Sin Ejecutivo Comercial (como líder, 0850: visitas_config_persona): la general, médica e institucional y sin
  // telefónica.
  const persona = configPersonaVigente(executiveId ? personas : [], general, executiveId ?? '', hoy)
  return {
    radio_m: Number(persona.radioM),
    telefonica: {
      habilitada: executiveId ? persona.telefonicaHabilitada : false,
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
  /** 0850: la persona que la reportó. */
  user_id: string | null
  /** Su Ejecutivo Comercial; null en las de VMO y en las de una líder (como líder, 0850). */
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
  /** Cita que cumplió (0840; null sin cita). */
  agenda_id: string | null
  /** Agendada: cita creada antes del día de la visita (0840). */
  agendada: boolean
}

export const COLUMNAS_VISITA =
  'id, client_id, source, user_id, executive_id, tipo, subtipo_id, subtipo_codigo, medico_id, cuenta_id, sede_id, contacto_id, modalidad, medio, efectiva, failure_reason, checked_in_at, distance_m, conclusion, compromisos, next_step_date, input_mode, out_of_territory, visit_date, deleted_at, agenda_id, agendada'

/**
 * Visitas de la app de una PERSONA (0850: por user_id, con o sin Ejecutivo Comercial) entre dos fechas (visit_date), sin
 * las anuladas salvo `conAnuladas`.
 */
export async function leerVisitas(
  userId: string,
  desde: string,
  hasta: string,
  opciones: { conAnuladas?: boolean } = {}
): Promise<FilaVisita[]> {
  return fetchAllRows<FilaVisita>((from, to) => {
    let consulta = supabaseAdmin
      .from('visits')
      .select(COLUMNAS_VISITA)
      .eq('source', 'app')
      .eq('user_id', userId)
      .gte('visit_date', desde)
      .lte('visit_date', hasta)
    if (!opciones.conAnuladas) consulta = consulta.is('deleted_at', null)
    return consulta.order('checked_in_at').order('id').range(from, to) as unknown as PromiseLike<{ data: FilaVisita[] | null; error: { message: string } | null }>
  })
}

/** Una visita por un campo único (id o client_id), o null. */
async function visitaPor(campo: 'id' | 'client_id', valor: string): Promise<FilaVisita | null> {
  const { data, error } = await supabaseAdmin.from('visits').select(COLUMNAS_VISITA).eq(campo, valor).limit(1)
  if (error) throw error
  return ((data ?? []) as unknown as FilaVisita[])[0] ?? null
}

/** Una visita por id (o null). */
export async function leerVisita(id: string): Promise<FilaVisita | null> {
  return visitaPor('id', id)
}

/** La visita con ese client_id (idempotencia), o null. */
export async function visitaPorClientId(clientId: string): Promise<FilaVisita | null> {
  return visitaPor('client_id', clientId)
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
 * a qué meta suma (valorVisita con el conteo vigente en su fecha) y si la ejecutiva aún puede corregirla. Lo que no suma
 * a su cuota (visitaSumaALaCuota: con Ejecutivo Comercial, lo hecho como líder, C4) sale con cuenta_para null y peso 0,
 * como en el contexto y en Mis números.
 */
export async function armarVisitaItems(
  filas: readonly FilaVisita[],
  entrada: { persona: Pick<PersonaCampo, 'userId' | 'executiveId'>; hoy: string; conteo: readonly ConteoVigencia[]; general: readonly GeneralVigencia[] }
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

  const confirmadas = new Map(Array.from(sedes.entries()).map(([id, sede]) => [id, sede.confirmada]))
  return filas.map(fila => {
    const valor = visitaSumaALaCuota(entrada.persona, fila)
      ? valorDe(fila, { conteo: entrada.conteo, general: entrada.general, confirmadas })
      : { meta: null, peso: 0, sede_por_confirmar: false }
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
      editable: visitaEditable(fila, entrada.persona.userId, entrada.hoy),
      agenda_id: fila.agenda_id ?? null,
      agendada: fila.agendada === true,
    }
  })
}

/** Una visita armada como elemento de la lista (o null si no existe). */
export async function cargarVisitaItem(
  id: string,
  entrada: { persona: Pick<PersonaCampo, 'userId' | 'executiveId'>; hoy: string; conteo?: readonly ConteoVigencia[]; general?: readonly GeneralVigencia[] }
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
const visitanteVigente = visitanteVigenteEn

const COLUMNAS_VISITANTE = 'medico_id, executive_id, line_id, desde, hasta'

/**
 * Ejecutivos Comerciales ACTIVOS de unas asignaciones de visitante (o de unas líneas), con TODAS sus líneas: lo que
 * medico_de_lineas (C9) mira para decir de qué líneas "es" un médico.
 */
async function lineasDeEjecutivasActivas(executiveIds: Iterable<string>): Promise<Map<string, string[]>> {
  const ids = Array.from(new Set(executiveIds))
  if (ids.length === 0) return new Map()
  const [ejecutivas, vinculos] = await Promise.all([
    leerPorIds<{ id: string; status: string }>(ids, (trozo, from, to) =>
      supabaseAdmin.from('executives').select('id, status').in('id', trozo).order('id').range(from, to)
    ),
    leerPorIds<{ executive_id: string; line_id: string }>(ids, (trozo, from, to) =>
      supabaseAdmin.from('executive_lines').select('executive_id, line_id').in('executive_id', trozo).order('executive_id').order('line_id').range(from, to)
    ),
  ])
  const activas = new Set(ejecutivas.filter(e => e.status === 'active').map(e => e.id))
  const mapa = new Map<string, string[]>()
  for (const vinculo of vinculos) {
    if (!activas.has(vinculo.executive_id)) continue
    mapa.set(vinculo.executive_id, [...(mapa.get(vinculo.executive_id) ?? []), vinculo.line_id])
  }
  return mapa
}

/**
 * C9 (0850): los médicos de las líneas L en una fecha, con las líneas de L por las que lo son: los que tienen un
 * visitante vigente en una línea de L y los cuyo visitante vigente es un Ejecutivo Comercial activo con alguna de L.
 */
export async function medicosDeLineas(lineas: readonly string[], fecha: string): Promise<Map<string, Set<string>>> {
  const resultado = new Map<string, Set<string>>()
  if (lineas.length === 0) return resultado
  const enLineas = await leerPorIds<{ executive_id: string; line_id: string }>(lineas, (trozo, from, to) =>
    supabaseAdmin.from('executive_lines').select('executive_id, line_id').in('line_id', trozo).order('executive_id').order('line_id').range(from, to)
  )
  const ecs = await lineasDeEjecutivasActivas(enLineas.map(v => v.executive_id))
  const [porLinea, porEjecutiva] = await Promise.all([
    leerPorIds<VisitanteMedico>(lineas, (trozo, from, to) =>
      supabaseAdmin.from('medico_visitantes').select(COLUMNAS_VISITANTE).in('line_id', trozo).order('medico_id').order('id').range(from, to)
    ),
    leerPorIds<VisitanteMedico>(Array.from(ecs.keys()), (trozo, from, to) =>
      supabaseAdmin.from('medico_visitantes').select(COLUMNAS_VISITANTE).in('executive_id', trozo).order('medico_id').order('id').range(from, to)
    ),
  ])
  const visitantes = [...porLinea, ...porEjecutiva]
  for (const medicoId of new Set(visitantes.map(v => v.medico_id))) {
    const de = Array.from(lineasDelMedico(medicoId, visitantes, ecs, fecha)).filter(linea => lineas.includes(linea))
    if (de.length > 0) resultado.set(medicoId, new Set(de))
  }
  return resultado
}

/**
 * Médicos activos de la persona hoy con sus especialidades, ciudad, líneas y sedes activas donde atienden (con la
 * distancia al punto, si se mandó). NUNCA el documento. Como Ejecutivo Comercial: los que visita (medico_visitantes
 * vigente). Como líder (0850, C9): los médicos de las líneas que lidera. Paola: los dos.
 */
export async function misMedicos(persona: Pick<PersonaCampo, 'executiveId' | 'lineasLider'>, hoy: string, punto: Punto | null): Promise<MedicoContexto[]> {
  const lineasPorMedico = new Map<string, Set<string>>()
  const sumar = (medicoId: string, lineas: Iterable<string>) => {
    const conjunto = lineasPorMedico.get(medicoId) ?? new Set<string>()
    for (const linea of lineas) conjunto.add(linea)
    lineasPorMedico.set(medicoId, conjunto)
  }
  const [visitantes, deLineas] = await Promise.all([
    persona.executiveId
      ? fetchAllRows<{ medico_id: string; line_id: string; desde: string; hasta: string | null }>((from, to) =>
          supabaseAdmin
            .from('medico_visitantes')
            .select('medico_id, line_id, desde, hasta')
            .eq('executive_id', persona.executiveId as string)
            .order('medico_id')
            .order('line_id')
            .range(from, to)
        )
      : Promise.resolve([]),
    medicosDeLineas(persona.lineasLider, hoy),
  ])
  for (const fila of visitantes.filter(fila => visitanteVigente(fila, hoy))) sumar(fila.medico_id, [fila.line_id])
  deLineas.forEach((lineas, medicoId) => sumar(medicoId, lineas))
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

/** Compromisos vencidos de la persona (visitas de los últimos DIAS_COMPROMISOS días, con el nombre del médico o cuenta). */
export async function compromisosDe(userId: string, hoy: string): Promise<ContextoResponse['compromisos_vencidos']> {
  const filas = await leerVisitas(userId, sumarDias(hoy, -DIAS_COMPROMISOS), hoy)
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
 * 0850: de la persona de campo. Sin Ejecutivo Comercial (una líder) no hay cuota (meta 0) y la configuración es la
 * general (sin telefónica); `ejecutiva` la describe a ella (id del usuario, sin zona) y `persona` dice su papel.
 */
export async function cargarContexto(persona: PersonaCampo, punto: Punto | null, hoy: string, ahora: Date = new Date()): Promise<ContextoResponse> {
  // Cada lectura que depende de otra arranca apenas llega la suya (spec 2026-10-15, paquete 4): los contactos no esperan
  // a la cuota del mes ni la confirmación de las sedes a los médicos. La respuesta es la misma.
  const ejecutiva = persona.ejecutiva
  const detalleP: Promise<CuotaDetallada | null> = ejecutiva ? calcularCuotaDetallada(ejecutiva, mesDe(hoy), hoy) : Promise.resolve(null)
  const generalP: Promise<readonly GeneralVigencia[]> = detalleP.then(detalle => (detalle ? detalle.general : leerGeneral()))
  const configP = Promise.all([detalleP, generalP]).then(([detalle, general]) =>
    configDeHoy(general, detalle ? detalle.personas : [], persona.executiveId, hoy)
  )
  const visitasHoyP = leerVisitas(persona.userId, hoy, hoy)
  const sedesP = punto ? sedesCercaDe(punto) : Promise.resolve([] as SedeCerca[])
  const citasHoyP = leerCitas(persona.userId, hoy, hoy)
  const [detalle, general, config, lineas, subtipos, visitasHoy, medicos, sedes, compromisos, contactos, confirmadas, agendaHoy] = await Promise.all([
    detalleP,
    generalP,
    configP,
    lineasDePersona(persona.lineas),
    subtiposVigentes(hoy),
    visitasHoyP,
    misMedicos(persona, hoy, punto),
    sedesP,
    compromisosDe(persona.userId, hoy),
    sedesP.then(lista => contactosDeCuentas(lista.map(sede => sede.cuenta_id))),
    visitasHoyP.then(lista => confirmacionDeSedes(lista.map(visita => visita.sede_id))),
    Promise.all([citasHoyP, configP]).then(([citasHoy, cfg]) => armarCitaItems(citasHoy, { hoy, punto, radio_m: cfg.radio_m, ahora })),
  ])
  const meta = detalle ? metaDelDia(detalle, hoy) : { medica: 0, institucional: 0 }
  const conteo = detalle ? detalle.conteo : await leerConteo()
  // La meta del día solo se cumple con lo que suma: las de sedes por confirmar no (aún) y la telefónica con su peso. Lo
  // que hace como líder no suma a su cuota de Ejecutivo Comercial (C4): con Ejecutivo Comercial, solo sus visitas.
  const deLaCuota = visitasHoy.filter(visita => visitaSumaALaCuota(persona, visita))
  const resumen = resumenHoy(
    deLaCuota.map(visita => {
      const valor = valorDe(visita, { conteo, general, confirmadas })
      return { tipo: visita.tipo, modalidad: visita.modalidad, efectiva: Boolean(visita.efectiva), cuenta_para: valor.meta, peso: valor.peso }
    }),
    meta
  )
  return {
    ejecutiva: {
      id: persona.executiveId ?? persona.userId,
      nombre: ejecutiva?.nombre ?? persona.nombre,
      zona: ejecutiva?.zona ?? null,
      municipio: ejecutiva?.municipio ?? null,
      lineas,
    },
    hoy: { fecha: hoy, meta: resumen.meta, hechas: resumen.hechas, cuota_dia_ok: resumen.cuota_dia_ok },
    config,
    sedes_cerca: sedes,
    mis_medicos: medicos,
    contactos,
    subtipos,
    compromisos_vencidos: compromisos,
    voz: vozDisponible(),
    agenda_hoy: agendaHoy,
    persona: personaContexto(persona, lineas),
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
 * Carga, por los ids del cuerpo, la persona (0850: sus líneas y si la visita es como líder: ninguna de sus líneas es de
 * su Ejecutivo Comercial), la sede (activa, y si su cuenta está activa), el médico (activo, sus sedes, si ella es su
 * visitante vigente hoy y, como líder, si es de las líneas de la visita: C9), el subtipo y el contacto (con su estado).
 * Lo que no existe queda null.
 */
export async function contextoValidacion(datos: VisitaCreate, persona: PersonaCampo, hoy: string): Promise<ContextoValidacion> {
  const ejecutivoVisita = ejecutivoDeLaVisita(persona, datos.lineas)
  const comoLider = ejecutivoVisita === null
  // La sede (con su cuenta) y el médico o el subtipo no dependen entre sí: van en paralelo (spec 2026-10-15, paquete 4).
  const [sede, porTipo] = await Promise.all([
    sedeParaValidar(datos.sede_id),
    datos.tipo === 'medica'
      ? medicoParaValidar(datos.medico_id, ejecutivoVisita, hoy, comoLider ? datos.lineas : null)
      : institucionalParaValidar(datos.subtipo_id, datos.contacto_id),
  ])
  return {
    ejecutiva: {
      id: ejecutivoVisita ?? persona.userId,
      activa: true,
      con_zona: Boolean(persona.ejecutiva?.kamId),
      lineas: persona.lineas,
    },
    sede,
    medico: porTipo.medico,
    subtipo: porTipo.subtipo,
    contacto: porTipo.contacto,
    como_lider: comoLider,
  }
}

/** La sede del cuerpo (activa) y si su cuenta está activa; null si no existe o está inactiva. */
async function sedeParaValidar(sedeId: string): Promise<ContextoValidacion['sede']> {
  const sedeData = await supabaseAdmin.from('sedes').select('id, nombre, cuenta_id, lat, lng, activo').eq('id', sedeId).limit(1)
  if (sedeData.error) throw sedeData.error
  const sedeFila = (sedeData.data ?? [])[0] as { id: string; nombre: string; cuenta_id: string | null; lat: number | string | null; lng: number | string | null; activo: boolean } | undefined
  if (!sedeFila || !sedeFila.activo) return null
  let cuentaActiva = true
  if (sedeFila.cuenta_id) {
    const { data, error } = await supabaseAdmin.from('cuentas').select('id, activo').eq('id', sedeFila.cuenta_id).limit(1)
    if (error) throw error
    const cuenta = (data ?? [])[0] as { id: string; activo: boolean } | undefined
    cuentaActiva = cuenta?.activo === true
  }
  return { id: sedeFila.id, nombre: sedeFila.nombre, cuenta_id: sedeFila.cuenta_id, lat: aNumero(sedeFila.lat), lng: aNumero(sedeFila.lng), cuenta_activa: cuentaActiva }
}

type PorTipoValidacion = Pick<ContextoValidacion, 'medico' | 'subtipo' | 'contacto'>

/**
 * El médico (activo, sus sedes, si el Ejecutivo Comercial de la visita es su visitante vigente hoy y, como líder, si es
 * de las líneas de la visita: C9); null si no existe.
 */
async function medicoParaValidar(medicoId: string, executiveId: string | null, hoy: string, lineasLider: readonly string[] | null): Promise<PorTipoValidacion> {
  const [medicoData, vinculos, visitantes] = await Promise.all([
    supabaseAdmin.from('medicos').select('id, nombre, activo').eq('id', medicoId).limit(1),
    fetchAllRows<{ sede_id: string }>((from, to) =>
      supabaseAdmin.from('medico_sedes').select('sede_id').eq('medico_id', medicoId).order('sede_id').range(from, to)
    ),
    fetchAllRows<VisitanteMedico>((from, to) =>
      supabaseAdmin.from('medico_visitantes').select(COLUMNAS_VISITANTE).eq('medico_id', medicoId).order('desde').order('id').range(from, to)
    ),
  ])
  if (medicoData.error) throw medicoData.error
  const medico = (medicoData.data ?? [])[0] as { id: string; nombre: string; activo: boolean } | undefined
  let deMisLineas: boolean | undefined
  if (lineasLider) {
    const ecs = await lineasDeEjecutivasActivas(visitantes.filter(v => visitanteVigente(v, hoy)).map(v => v.executive_id))
    const delMedico = lineasDelMedico(medicoId, visitantes, ecs, hoy)
    deMisLineas = lineasLider.some(linea => delMedico.has(linea))
  }
  return {
    medico: medico
      ? {
          id: medico.id,
          nombre: medico.nombre,
          activo: Boolean(medico.activo),
          sede_ids: vinculos.map(vinculo => vinculo.sede_id),
          es_visitante: executiveId !== null && visitantes.some(fila => fila.executive_id === executiveId && visitanteVigente(fila, hoy)),
          ...(deMisLineas === undefined ? {} : { de_mis_lineas: deMisLineas }),
        }
      : null,
    subtipo: null,
    contacto: null,
  }
}

/** El subtipo y el contacto (con su estado) de una visita institucional; null lo que no existe. */
async function institucionalParaValidar(subtipoId: string, contactoId: string | null): Promise<PorTipoValidacion> {
  const [subtipoData, contactoData] = await Promise.all([
    supabaseAdmin.from('subtipos_institucionales').select('id, codigo, vigente_desde, vigente_hasta').eq('id', subtipoId).limit(1),
    contactoId
      ? supabaseAdmin.from('contactos').select('id, cuenta_id, activo').eq('id', contactoId).limit(1)
      : Promise.resolve({ data: [] as { id: string; cuenta_id: string; activo: boolean }[], error: null }),
  ])
  if (subtipoData.error) throw subtipoData.error
  if (contactoData.error) throw contactoData.error
  const subtipo = (subtipoData.data ?? [])[0] as { id: string; codigo: string; vigente_desde: string; vigente_hasta: string | null } | undefined
  const contacto = (contactoData.data ?? [])[0] as { id: string; cuenta_id: string; activo: boolean | null } | undefined
  return {
    medico: null,
    subtipo: subtipo ?? null,
    contacto: contacto ? { id: contacto.id, cuenta_id: contacto.cuenta_id, activo: contacto.activo !== false } : null,
  }
}

/** Visitas de hoy de ella (no anuladas) para los topes de validarVisita. */
export function visitasParaTopes(filas: readonly FilaVisita[]): VisitaDeHoy[] {
  return filas.map(fila => ({ client_id: fila.client_id, medico_id: fila.medico_id, modalidad: fila.modalidad, efectiva: Boolean(fila.efectiva) }))
}

/**
 * El jsonb de visitas_registrar, campo a campo (allow-list: nunca el body entero), con el Ejecutivo Comercial de la
 * persona de la sesión (0850: null si no lo tiene; la base saca la persona de p_user y el Ejecutivo Comercial de la
 * visita de sus líneas). Claves: las de la 0830 (client_id, executive_id, tipo, subtipo_id, medico_id, cuenta_id,
 * sede_id, contacto_id, modalidad, medio, efectiva, failure_reason, retry_date, checked_in_at, reported_at, lat, lng,
 * gps_accuracy_m, conclusion, compromisos, next_step_date, transcript, input_mode, lineas) y agenda_id (0840).
 */
export function jsonbRegistrar(datos: VisitaCreate, executiveId: string | null): Record<string, unknown> {
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
    // 0840: la cita que se cumple (null = que la base busque la del mismo médico o cuenta). La 0830 ignora la clave.
    agenda_id: datos.agenda_id,
  }
}

// ---------------------------------------------------------------------------------------------
// 4b. Agenda (F4.1, migración 0840): lecturas, CitaItem y el indicador de Mis números
// ---------------------------------------------------------------------------------------------

/** Fila de visitas_agenda que lee la API. */
export interface FilaCita {
  id: string
  /** 0850: la persona dueña de la cita. */
  user_id: string
  /** Como Ejecutivo Comercial (su id) o como líder (null, 0850). */
  executive_id: string | null
  fecha: string
  hora: string | null
  tipo: TipoVisita
  medico_id: string | null
  cuenta_id: string | null
  subtipo_id: string | null
  sede_id: string
  nota: string | null
  estado: EstadoCita
  visita_id: string | null
  cancelada_at: string | null
  cancelada_motivo: string | null
  created_at: string
  // 0850
  motivo_codigo: MotivoCierre | null
  no_realizada_at: string | null
  no_realizada_motivo: string | null
  viene_de: string | null
}

export const COLUMNAS_CITA =
  'id, user_id, executive_id, fecha, hora, tipo, medico_id, cuenta_id, subtipo_id, sede_id, nota, estado, visita_id, cancelada_at, cancelada_motivo, created_at, motivo_codigo, no_realizada_at, no_realizada_motivo, viene_de'

/** Estados que GET /api/me/agenda trae por defecto (las vivas) y con canceladas=true (también las cerradas sin hacer). */
const ESTADOS_VIVOS: readonly EstadoCita[] = ['pendiente', 'hecha']
const ESTADOS_CON_CERRADAS: readonly EstadoCita[] = ['pendiente', 'hecha', 'no_realizada', 'cancelada']

/**
 * Citas de una PERSONA (0850: por user_id, con sus dos papeles si los tiene) entre dos fechas, por fecha y hora. Nunca
 * las eliminadas por error; sin las canceladas ni las que no se hicieron salvo `conCanceladas`.
 */
export async function leerCitas(
  userId: string,
  desde: string,
  hasta: string,
  opciones: { conCanceladas?: boolean } = {}
): Promise<FilaCita[]> {
  return fetchAllRows<FilaCita>((from, to) =>
    supabaseAdmin
      .from('visitas_agenda')
      .select(COLUMNAS_CITA)
      .eq('user_id', userId)
      .gte('fecha', desde)
      .lte('fecha', hasta)
      .in('estado', [...(opciones.conCanceladas ? ESTADOS_CON_CERRADAS : ESTADOS_VIVOS)])
      .order('fecha')
      .order('hora')
      .order('id')
      .range(from, to)
  )
}

/** Una cita por id (o null; también las eliminadas: quien llama decide). */
export async function leerCita(id: string): Promise<FilaCita | null> {
  const { data, error } = await supabaseAdmin.from('visitas_agenda').select(COLUMNAS_CITA).eq('id', id).limit(1)
  if (error) throw error
  return data && data.length > 0 ? (data[0] as unknown as FilaCita) : null
}

/**
 * Filas de visitas_agenda → CitaItem: nombres del médico, la cuenta y el subtipo; la sede con su cuenta, coordenadas
 * y si está confirmada; la distancia al punto y si queda dentro del radio (solo con punto); anticipada y cancelable; y
 * (0850) el motivo, "no se hizo", viene_de, su sucesora, como qué y el estado visible (C6, con `ahora`). Orden: con
 * punto, la más cercana primero; sin punto, por fecha y hora. Nunca documentos ni teléfonos. Las eliminadas no salen.
 */
export async function armarCitaItems(
  todas: readonly FilaCita[],
  entrada: { hoy: string; punto?: Punto | null; radio_m?: number; ahora?: Date }
): Promise<CitaItem[]> {
  const filas = todas.filter(fila => fila.estado !== 'eliminada')
  if (filas.length === 0) return []
  type SedeFilaCita = { id: string; nombre: string; cuenta_id: string | null; lat: number | string | null; lng: number | string | null; ubicacion_confirmada: boolean | null }
  const [medicos, sedes, subtipos, sucesoras] = await Promise.all([
    nombresPorId('medicos', filas.map(fila => fila.medico_id)),
    leerPorIds<SedeFilaCita>(filas.map(fila => fila.sede_id), (trozo, from, to) =>
      supabaseAdmin.from('sedes').select('id, nombre, cuenta_id, lat, lng, ubicacion_confirmada').in('id', trozo).order('id').range(from, to)
    ),
    leerPorIds<{ id: string; codigo: string; nombre: string }>(
      filas.map(fila => fila.subtipo_id).filter((id): id is string => Boolean(id)),
      (trozo, from, to) => supabaseAdmin.from('subtipos_institucionales').select('id, codigo, nombre').in('id', trozo).order('id').range(from, to)
    ),
    // Su "otra fecha" (0850): la sucesora no eliminada (a lo sumo una).
    leerPorIds<{ id: string; viene_de: string; estado: EstadoCita }>(filas.map(fila => fila.id), (trozo, from, to) =>
      supabaseAdmin.from('visitas_agenda').select('id, viene_de, estado').in('viene_de', trozo).neq('estado', 'eliminada').order('id').range(from, to)
    ),
  ])
  const sedePorId = new Map(sedes.map(sede => [sede.id, sede]))
  const cuentas = await nombresPorId('cuentas', [...filas.map(fila => fila.cuenta_id), ...sedes.map(sede => sede.cuenta_id)])
  const subtipoPorId = new Map(subtipos.map(subtipo => [subtipo.id, subtipo]))
  const sucesoraDe = new Map(sucesoras.map(fila => [fila.viene_de, fila.id]))
  const punto = entrada.punto ?? null
  const radio = Number(entrada.radio_m ?? 0)
  const ahora = entrada.ahora ?? new Date()

  const items: CitaItem[] = filas.map(fila => {
    const sedeFila = sedePorId.get(fila.sede_id)
    const sede: SedeCita = {
      id: fila.sede_id,
      nombre: sedeFila?.nombre ?? 'Sede',
      cuenta_id: sedeFila?.cuenta_id ?? null,
      cuenta_nombre: sedeFila?.cuenta_id ? cuentas.get(sedeFila.cuenta_id) ?? null : null,
      lat: sedeFila ? aNumero(sedeFila.lat) : null,
      lng: sedeFila ? aNumero(sedeFila.lng) : null,
      ubicacion_confirmada: sedeFila?.ubicacion_confirmada === true,
    }
    const subtipo = fila.subtipo_id ? subtipoPorId.get(fila.subtipo_id) : undefined
    const distancia = distanciaACita(sede, punto, radio)
    const hora = horaCorta(fila.hora)
    return {
      id: fila.id,
      fecha: fila.fecha,
      hora,
      tipo: fila.tipo,
      medico: fila.medico_id ? { id: fila.medico_id, nombre: medicos.get(fila.medico_id) ?? 'Médico' } : null,
      cuenta: fila.tipo === 'institucional' && fila.cuenta_id ? { id: fila.cuenta_id, nombre: cuentas.get(fila.cuenta_id) ?? 'Cuenta' } : null,
      subtipo: fila.subtipo_id ? { id: fila.subtipo_id, codigo: subtipo?.codigo ?? '', nombre: subtipo?.nombre ?? 'Subtipo' } : null,
      sede,
      nota: fila.nota,
      estado: fila.estado,
      visita_id: fila.visita_id,
      distancia_m: distancia.distancia_m,
      dentro_del_radio: distancia.dentro_del_radio,
      anticipada: citaAnticipada(fila.created_at, fila.fecha),
      cancelable: citaCancelable(fila, entrada.hoy),
      motivo_codigo: fila.motivo_codigo ?? null,
      no_realizada_at: fila.no_realizada_at ?? null,
      no_realizada_motivo: fila.no_realizada_motivo ?? null,
      viene_de: fila.viene_de ?? null,
      sucesora_id: sucesoraDe.get(fila.id) ?? null,
      como: fila.executive_id ? 'ejecutivo' : 'lider',
      estado_visible: estadoVisible({ estado: fila.estado, fecha: fila.fecha, hora }, ahora),
    }
  })
  return ordenarCitas(items, { porDistancia: punto !== null })
}

/** Una cita armada como CitaItem (o null si no existe o se eliminó por error). */
export async function cargarCitaItem(id: string, hoy: string, ahora: Date = new Date()): Promise<CitaItem | null> {
  const fila = await leerCita(id)
  if (!fila || fila.estado === 'eliminada') return null
  const [item] = await armarCitaItems([fila], { hoy, ahora })
  return item ?? null
}

/** El jsonb de agenda_crear, campo a campo (allow-list: nunca el body entero); 0850: con `como` (C12). */
export function jsonbCita(datos: CitaCreate): Record<string, unknown> {
  return {
    fecha: datos.fecha,
    hora: datos.hora,
    tipo: datos.tipo,
    medico_id: datos.medico_id,
    cuenta_id: datos.cuenta_id,
    subtipo_id: datos.subtipo_id,
    sede_id: datos.sede_id,
    nota: datos.nota,
    como: datos.como ?? null,
  }
}

/**
 * Indicador de la agenda del mes (decisión 8; 0850: "no se hizo" aparte y sin las eliminadas) con las visitas del mes ya
 * leídas (sin anuladas, con agendada) y las citas del mes de la persona.
 */
export async function numerosDeAgenda(
  userId: string,
  rango: { desde: string; hasta: string },
  visitas: readonly Pick<FilaVisita, 'efectiva' | 'agendada'>[],
  hoy: string
): Promise<NumerosAgenda> {
  const citas = await leerCitas(userId, rango.desde, rango.hasta, { conCanceladas: true })
  return cuentasAgenda({
    visitas: visitas.map(visita => ({ efectiva: Boolean(visita.efectiva), agendada: visita.agendada === true })),
    citas: citas.map(cita => ({ fecha: cita.fecha, estado: cita.estado })),
    hoy,
  })
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
  /** `cabeceras`: las de cabecerasAnthropic (el workspace), o undefined. */
  anthropic: (apiKey: string, cabeceras?: Record<string, string>) => ClientePropuesta
}

const FABRICAS_REALES: FabricasVoz = {
  // Un reintento (el SDK reintenta 408/409/429/5xx y errores de red); 60 s por intento.
  openai: apiKey => new OpenAI({ apiKey, maxRetries: 1, timeout: 60_000 }),
  anthropic: (apiKey, cabeceras) => new Anthropic({ apiKey, maxRetries: 1, timeout: 60_000, ...(cabeceras ? { defaultHeaders: cabeceras } : {}) }),
}

let fabricas: FabricasVoz = FABRICAS_REALES

/** Solo para las pruebas: cambia las fábricas de clientes (null vuelve a las reales). */
export function fijarFabricasVoz(nuevas: Partial<FabricasVoz> | null): void {
  fabricas = nuevas ? { ...FABRICAS_REALES, ...nuevas } : FABRICAS_REALES
}

/** Valor de una variable de entorno (sin espacios) o null. Nunca se imprime. */
function llave(nombre: 'OPENAI_API_KEY' | 'ANTHROPIC_API_KEY' | 'ANTHROPIC_WORKSPACE_ID'): string | null {
  const valor = process.env[nombre]
  return typeof valor === 'string' && valor.trim() ? valor.trim() : null
}

/** Forma de un ID de workspace de Anthropic (`wrkspc_…`). */
const ID_WORKSPACE_ANTHROPIC = /^wrkspc_[A-Za-z0-9]{8,64}$/

/**
 * Cabecera `anthropic-workspace-id` para una llave personal o de cuenta de servicio que NO está asignada a un
 * workspace: con esas llaves Anthropic responde 400 ("anthropic-workspace-id is required when authenticating with an
 * identity-linked API key") si la petición no dice en qué workspace actúa (platform.claude.com/docs, Authentication →
 * Select a workspace). Una llave asignada a un workspace no la necesita. Solo se manda un valor con forma de ID
 * (`wrkspc_…`): si la variable trae otra cosa (por ejemplo, la llave pegada por error) no se manda ni se imprime.
 */
export function cabecerasAnthropic(workspaceId: string | null | undefined): Record<string, string> | undefined {
  const id = typeof workspaceId === 'string' ? workspaceId.trim() : ''
  return ID_WORKSPACE_ANTHROPIC.test(id) ? { 'anthropic-workspace-id': id } : undefined
}

/** Las cabeceras de ANTHROPIC_WORKSPACE_ID (opcional); avisa en el log, sin el valor, si no tiene forma de ID. */
function cabecerasDelWorkspace(): Record<string, string> | undefined {
  const valor = llave('ANTHROPIC_WORKSPACE_ID')
  if (!valor) return undefined
  const cabeceras = cabecerasAnthropic(valor)
  if (!cabeceras) console.warn('ANTHROPIC_WORKSPACE_ID no tiene la forma de un ID de workspace (wrkspc_…): no se envía')
  return cabeceras
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

/** Tope del mensaje (ya saneado) de la API en el log. */
const MAX_MENSAJE_API_LOG = 160
/**
 * Tope del mensaje de la API que se analiza. Los de verdad son una o dos frases; uno más largo es anómalo (podría
 * repetir lo enviado) y no se imprime. Además, ninguna expresión regular corre sobre un texto enorme (una de correos
 * sobre 80.000 caracteres sin espacios tardaba segundos y bloqueaba la función antes del respaldo).
 */
export const MAX_MENSAJE_API_ANALIZAR = 1000
/** Lo que queda en el log en lugar del mensaje de la API cuando no es seguro imprimirlo. */
export const MENSAJE_API_OMITIDO = 'mensaje omitido (podría repetir parte de lo enviado)'

function comoObjeto(valor: unknown): Record<string, unknown> | null {
  return valor && typeof valor === 'object' && !Array.isArray(valor) ? (valor as Record<string, unknown>) : null
}

function comoTexto(valor: unknown): string | null {
  return typeof valor === 'string' && valor.trim() ? valor.trim() : null
}

/** Minúsculas y sin tildes (para comparar palabras). */
function sinTildes(texto: string): string {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}

/**
 * Un grupo de dígitos con los separadores con que se escriben teléfonos, cédulas y NIT (300 123 4567, 1.020.304.050,
 * 900.123.456-7, (300) 123-4567): se compara y se tapa por sus dígitos, no por cómo se escribió.
 */
const GRUPO_DIGITOS = /\d(?:[ .,()/-]*\d)*/g
/** Una fecha ISO (la de una beta: server-side-fallback-2026-07-01): no se tapa, sirve en el log. */
const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/

function soloDigitos(texto: string): string {
  return texto.replace(/\D/g, '')
}

/** Lo que mandó la persona (transcripción, contexto), listo para comparar con el mensaje de la API. */
export interface LoEnviado {
  /** Sus palabras de 3 o más letras o dígitos con al menos una letra, sin tildes y en minúsculas. */
  palabras: ReadonlySet<string>
  /** Sus números de 3 o más dígitos, sin separadores (300 123 4567 → 3001234567). */
  numeros: readonly string[]
}

/**
 * Las palabras y los números de lo que mandó la persona: de cada texto que aparezca en los valores (nunca en las
 * claves). Las palabras de 1 o 2 letras y los números de 1 o 2 dígitos no cuentan (no identifican a nadie).
 */
export function loEnviado(sensibles: readonly unknown[]): LoEnviado {
  const palabras = new Set<string>()
  const numeros = new Set<string>()
  const visitar = (valor: unknown, profundidad: number) => {
    if (profundidad > 8 || valor === null || valor === undefined) return
    if (typeof valor === 'string') {
      for (const palabra of sinTildes(valor).match(/[\p{L}\p{N}]+/gu) ?? []) {
        if (palabra.length >= 3 && /\p{L}/u.test(palabra)) palabras.add(palabra)
      }
      for (const grupo of valor.match(GRUPO_DIGITOS) ?? []) {
        const digitos = soloDigitos(grupo)
        if (digitos.length >= 3) numeros.add(digitos)
      }
      return
    }
    if (Array.isArray(valor)) {
      for (const item of valor) visitar(item, profundidad + 1)
      return
    }
    if (typeof valor === 'object') for (const item of Object.values(valor)) visitar(item, profundidad + 1)
  }
  for (const valor of sensibles) visitar(valor, 0)
  return { palabras, numeros: [...numeros] }
}

/** ¿El texto repite alguna palabra de lo enviado? (palabra completa, sin tildes ni mayúsculas) */
function repitePalabras(texto: string, palabras: ReadonlySet<string>): boolean {
  return (sinTildes(texto).match(/[\p{L}\p{N}]+/gu) ?? []).some(palabra => palabras.has(palabra))
}

/** Un nombre técnico (parámetro, valor de la API, beta, modelo): ASCII, sin espacios, corto. */
const NOMBRE_TECNICO = /^[A-Za-z0-9_.:/[\]-]{1,64}$/

/** Tildes o eñes escapadas (á, \xe1, &aacute;, &#225;, %C3%A1): casi seguro un nombre en español citado. */
const ESCAPE = /\\(?:u[0-9a-f]{4}|u\{[0-9a-f]+\}|x[0-9a-f]{2})|&(?:#\d+|#x[0-9a-f]+|[a-z]+);|%[0-9a-f]{2}/i

/**
 * Lista CERRADA de las palabras (en inglés) de los mensajes de error de la API de Anthropic y de OpenAI. Un mensaje
 * con cualquier otra palabra de 2 o más letras no se imprime: así ningún nombre, apellido (también uno corto, como Gil
 * o Paz), trozo de palabra ("Fernand") ni tilde escapada ("Fern" + "ndez") llega al log, esté o no en lo enviado. Las
 * partes de un nombre técnico cuentan por separado (thinking.type.between_tools → thinking, type, between, tools).
 * Si un mensaje real queda omitido por una palabra que falta, se añade aquí (nunca un nombre propio).
 */
const VOCABULARIO_API: ReadonlySet<string> = new Set(
  `
  a about above access account actions acts actual adaptive add added additional after again all allow allowed alongside also
  alternate an and anthropic any api are argument arguments array as assistant at audio authenticating authentication auto
  available avoid bad belongs
  balance be been before beta betas between billing block blocks body boolean both budget but by bytes cache call
  called can cannot cause change character characters check choice claude code codes com combination combined
  compatible compilation complex config configuration connection consecutive consult contact contain contains content
  context control conversation corrupted could count credit credits current custom data date decode decoded default
  define defined deprecated description details dictionary different disable disabled discriminator discuss do docs
  document documentation does draft duplicate duration each effort either empty en enable enabled end ends ensure
  entry enum ephemeral equal error errors exceed exceeded exceeds except exist exists expected extra extract fail
  failed fallback fallbacks false feature features field fields file files final find first flac follow following for
  format formats found from function further given go got gpt greater guides had haiku has have header headers help
  high higher http https id identity if image in include included includes incompatible incorrect increase information input
  inputs integer internal into invalid is iso it item items its json key keys language large larger last learn least
  length less level levels limit limits linked list literal long longer low lower malformed match matches max maximum may
  media medium message messages metadata might mime min mini minimum minute missing mode model models more most mp
  mpeg mpga multiple must name names near needs new no non none not null number numbers object objects of oga ogg on
  one only openai optional options or org organization other our output outputs over overloaded parallel param
  parameter parameters params pattern per permission permissions permitted plan plans platform please possible
  prefill processing prompt properties property provide provided purchase quota range rate reached read reason
  received recognized reduce region request requested requests require required requires response responses result
  role roles row rpm sales schema scope scoped second seconds see send sequence sequences server service set should side single size
  so sonnet sorry specified specify speed status stop stream streaming strict string strings supplied support supported
  supports system tag tags temperature temporarily text than that the their then these thinking this those tier time
  to token tokens too tool tools top total tpm transcribe transcription transcriptions true try ttl turn turns type
  types unable unavailable unexpected union unknown unrecognized unsupported upgrade uri url usage use used user
  using valid value values version wav webm were when which while whisper window with within without workspace www
  xhigh you your
  `
    .split(/\s+/)
    .filter(Boolean)
)

/** ¿El texto tiene alguna palabra de 2 o más letras fuera de VOCABULARIO_API? */
function tienePalabraAjena(texto: string): boolean {
  return (texto.match(/[A-Za-z]{2,}/g) ?? []).some(palabra => !VOCABULARIO_API.has(palabra.toLowerCase()))
}

/**
 * El mensaje de la API, saneado para el log, o null si no es seguro imprimirlo. A prueba de filtraciones:
 * 1. Uno de más de MAX_MENSAJE_API_ANALIZAR caracteres no se imprime (es anómalo y no se analiza).
 * 2. Lo que va entre comillas solo se queda si es un nombre técnico (thinking.type.between_tools, 'xhigh',
 *    `anthropic-beta`); cualquier otro segmento entre comillas (con espacios, tildes…) se cambia por "...".
 * 3. Si queda algún carácter fuera del ASCII imprimible (los mensajes de la API vienen en inglés y ASCII; un texto en
 *    español con tildes es casi seguro contenido de la visita) o una tilde escapada (ESCAPE), NO se imprime.
 * 4. Llaves (sk-…) y correos se tapan. Los números se miran por sus dígitos, con o sin separadores: los de 6 o más
 *    dígitos (documentos, teléfonos, NIT) se tapan salvo una fecha ISO, y si un número de 3 o más dígitos que queda a la
 *    vista es parte de un número de lo enviado (una extensión, el trozo de un teléfono), NO se imprime.
 * 5. Si tiene una palabra fuera de la lista cerrada VOCABULARIO_API o repite una palabra de lo enviado (`enviado`: de
 *    la transcripción y del contexto), NO se imprime. Todo esto también vale para lo que va entre comillas.
 * 6. Se recorta a MAX_MENSAJE_API_LOG caracteres.
 */
export function mensajeApiSeguro(mensaje: unknown, enviado: LoEnviado): string | null {
  const original = comoTexto(mensaje)
  if (!original || original.length > MAX_MENSAJE_API_ANALIZAR) return null
  let texto = original.replace(/\s+/g, ' ')
  for (const comillas of [/`([^`]*)`/g, /"([^"]*)"/g, /“([^”]*)”/g, /«([^»]*)»/g, /‘([^’]*)’/g, /'([^']*)'/g]) {
    texto = texto.replace(comillas, (segmento, dentro: string) => (NOMBRE_TECNICO.test(dentro) ? segmento : '"..."'))
  }
  if (/[^\x20-\x7E]/.test(texto) || ESCAPE.test(texto)) return null
  texto = texto.replace(/sk-[A-Za-z0-9_-]{6,}/g, '[llave]').replace(/[^\s@]+@[^\s@]+/g, '[correo]')
  let repiteNumero = false
  texto = texto.replace(GRUPO_DIGITOS, grupo => {
    const digitos = soloDigitos(grupo)
    const aLaVista = digitos.length < 6 || FECHA_ISO.test(grupo)
    if (aLaVista && digitos.length >= 3 && enviado.numeros.some(numero => numero.includes(digitos))) repiteNumero = true
    return aLaVista ? grupo : '#'
  })
  texto = texto.trim()
  const sinMarcas = texto.replace(/\[(?:llave|correo)\]/g, ' ')
  if (!texto || repiteNumero || tienePalabraAjena(sinMarcas) || repitePalabras(sinMarcas, enviado.palabras)) return null
  return texto.length > MAX_MENSAJE_API_LOG ? `${texto.slice(0, MAX_MENSAJE_API_LOG)}...` : texto
}

/** Parámetros de primer nivel de las peticiones de voz (Messages de Anthropic y transcripciones de OpenAI). */
const PARAMETROS_RAIZ = new Set([
  'model',
  'max_tokens',
  'messages',
  'system',
  'tools',
  'tool_choice',
  'thinking',
  'output_config',
  'output_format',
  'fallbacks',
  'betas',
  'metadata',
  'stop_sequences',
  'temperature',
  'top_p',
  'top_k',
  'cache_control',
  'context_management',
  'container',
  'mcp_servers',
  'service_tier',
  'speed',
  'inference_geo',
  'stream',
  'file',
  'language',
  'prompt',
  'response_format',
])

/**
 * El parámetro que nombra el mensaje de la API, si se reconoce: una cabecera ("… for the `anthropic-beta` header") o
 * un parámetro de primer nivel (PARAMETROS_RAIZ) escrito como ruta ("output_config.effort", "tools.0.custom…"), entre
 * comillas ("\"thinking.type.disabled\" is not supported…") o al empezar una frase con dos puntos ("tool_choice: …",
 * "fallbacks: Extra inputs…"). Una palabra suelta ("…for this model") no cuenta. null si no hay o si repite una
 * palabra de lo enviado. Solo se miran los primeros MAX_MENSAJE_API_ANALIZAR caracteres.
 */
export function parametroDelMensaje(mensaje: unknown, enviado: LoEnviado): string | null {
  const texto = comoTexto(mensaje)?.slice(0, MAX_MENSAJE_API_ANALIZAR)
  if (!texto) return null
  // "… the `anthropic-beta` header", o la cabecera nombrada sin "header" ("anthropic-workspace-id is required …").
  const cabecera = texto.match(/\b(anthropic-[a-z-]+|x-api-key)[`'"]?\s+header\b/i)?.[1] ?? texto.match(/\b(anthropic-(?:workspace-id|beta|version))\b/i)?.[1]
  if (cabecera) return cabecera.toLowerCase()
  for (const m of texto.matchAll(/(["'`]?)([A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z0-9_[\]]+)*)(["'`]?)(\s*:)?/g)) {
    const candidato = m[2]
    const ruta = /[.[]/.test(candidato)
    const entreComillas = Boolean(m[1]) && m[1] === m[3]
    const conDosPuntos = Boolean(m[4])
    if (!PARAMETROS_RAIZ.has(candidato.split(/[.[]/)[0]) || !(ruta || entreComillas || conDosPuntos)) continue
    if (NOMBRE_TECNICO.test(candidato) && !repitePalabras(candidato, enviado.palabras)) return candidato
  }
  return null
}

/** Las partes de un error de la API que pueden ir al log. */
interface PartesErrorApi {
  tipo: unknown
  codigo?: unknown
  parametro?: unknown
  requestId: unknown
  mensaje: unknown
}

function resumenErrorApi(proveedor: 'Anthropic' | 'OpenAI', error: { status?: number | undefined }, partes: PartesErrorApi, sensibles: readonly unknown[], sinRespuesta: string | null): string {
  const enviado = loEnviado(sensibles)
  const tecnico = (valor: unknown, patron: RegExp) => {
    const texto = comoTexto(valor)
    return texto && patron.test(texto) && !repitePalabras(texto, enviado.palabras) ? texto : null
  }
  const estado = typeof error.status === 'number' ? String(error.status) : (sinRespuesta ?? 'sin estado')
  const tipo = tecnico(partes.tipo, /^[a-z_]{1,64}$/)
  const codigo = tecnico(partes.codigo, /^[a-z0-9_.-]{1,64}$/i)
  const parametro = tecnico(partes.parametro, NOMBRE_TECNICO) ?? parametroDelMensaje(partes.mensaje, enviado)
  const requestId = tecnico(partes.requestId, /^[A-Za-z0-9_-]{1,100}$/)
  const piezas = [`${proveedor} ${estado}${tipo ? ` ${tipo}` : ''}${codigo && codigo !== tipo ? ` (${codigo})` : ''}`]
  if (parametro) piezas.push(`parámetro ${parametro}`)
  if (requestId) piezas.push(`request_id ${requestId}`)
  if (comoTexto(partes.mensaje)) {
    const mensaje = mensajeApiSeguro(partes.mensaje, enviado)
    piezas.push(mensaje ? `mensaje: ${mensaje}` : MENSAJE_API_OMITIDO)
  }
  return piezas.join(' · ')
}

/**
 * Resumen del error para el log, NUNCA con el contenido (ni audio, ni transcripción, ni contexto de la visita, ni
 * nombres). Para un error de la API de Anthropic u OpenAI: proveedor, estado HTTP (o "tiempo agotado" / "sin
 * conexión"), tipo de error de la API (invalid_request_error…), el parámetro que nombra si se reconoce, el request_id
 * y el mensaje de la API saneado con mensajeApiSeguro (lo que no sea seguro no se imprime: una palabra fuera de la
 * lista cerrada VOCABULARIO_API, una tilde escapada, un número de lo enviado…). `sensibles`: lo que mandó la persona
 * en esa petición (la transcripción, el contexto): si el mensaje repite una palabra o un número de ahí, se omite.
 */
export function resumenErrorVoz(error: unknown, sensibles: readonly unknown[] = []): string {
  if (error instanceof ErrorProveedorVoz) return error.message
  if (error instanceof Anthropic.APIError) {
    const cuerpo = comoObjeto(error.error)
    const interno = comoObjeto(cuerpo?.error)
    const sinRespuesta =
      error instanceof Anthropic.APIConnectionTimeoutError ? 'tiempo agotado' : error instanceof Anthropic.APIConnectionError ? 'sin conexión' : null
    return resumenErrorApi(
      'Anthropic',
      error,
      { tipo: error.type ?? interno?.type, requestId: error.requestID ?? cuerpo?.request_id, mensaje: interno?.message ?? cuerpo?.message },
      sensibles,
      sinRespuesta
    )
  }
  if (error instanceof OpenAI.APIError) {
    const interno = comoObjeto(error.error)
    const sinRespuesta = error instanceof OpenAI.APIConnectionTimeoutError ? 'tiempo agotado' : error instanceof OpenAI.APIConnectionError ? 'sin conexión' : null
    return resumenErrorApi(
      'OpenAI',
      error,
      { tipo: error.type, codigo: error.code, parametro: error.param, requestId: error.requestID, mensaje: interno?.message },
      sensibles,
      sinRespuesta
    )
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
 * server-side-fallback-2026-07-01). Una respuesta 'refusal' o cortada por max_tokens es un fallo (502). Si Anthropic
 * rechaza la petición (400), se reintenta una vez con la petición mínima (ver pedirHerramienta).
 */
export async function proponerVisitas(entrada: { contexto: ContextoDictado; transcript: string }, alUsar?: AlUsarClaude): Promise<unknown> {
  return pedirHerramienta(
    {
      sistema: PROMPT_PROPUESTA,
      herramienta: HERRAMIENTA_PROPONER,
      maxTokens: MAX_TOKENS_PROPUESTA,
      mensaje: mensajeDictado(entrada.contexto, entrada.transcript),
      sensibles: [entrada.transcript, entrada.contexto],
    },
    alUsar
  )
}

/**
 * Recibe el `usage` de cada respuesta de Claude (también la del reintento y la de la petición mínima), para la línea
 * [tiempos] de la ruta (app/api/me/_lib/tiempos.ts: solo números). Si falla, no rompe la llamada.
 */
export type AlUsarClaude = (usage: unknown) => void

/** Lo que necesita una llamada a Claude que debe responder SOLO con una herramienta. */
export interface PedidoHerramienta {
  sistema: string
  herramienta: Anthropic.Beta.Messages.BetaTool
  maxTokens: number
  mensaje: string
  /** Lo que mandó la persona (transcripción, contexto): el log del error nunca repite nada de esto. */
  sensibles: readonly unknown[]
}

/**
 * Tope de tokens de la petición mínima: sin thinking 'between_tools' el modelo razona (adaptativo, con effort 'low')
 * y el razonamiento cuenta dentro de max_tokens; con el tope de la completa (4096 / 2048) la respuesta podría cortarse.
 * No más alto: todo tiene que caber en los 60 s de la ruta (maxDuration), del cliente del SDK y de la app. Solo se
 * cobra lo que se genera.
 */
export const MAX_TOKENS_PETICION_MINIMA = 8_000

/** La petición completa (la de siempre): ver proponerVisitas. */
export function peticionCompleta(entrada: PedidoHerramienta): Anthropic.Beta.Messages.MessageCreateParamsNonStreaming {
  return {
    model: MODELO_PROPUESTA,
    max_tokens: entrada.maxTokens,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    thinking: { type: 'between_tools' },
    output_config: { effort: 'low' },
    system: [{ type: 'text', text: entrada.sistema, cache_control: { type: 'ephemeral' } }],
    tools: [entrada.herramienta],
    tool_choice: { type: 'auto', disable_parallel_tool_use: true },
    messages: [{ role: 'user', content: entrada.mensaje }],
  }
}

/**
 * La petición mínima, de respaldo cuando Anthropic rechaza la completa con un 400: solo lo básico y estable. El mismo
 * modelo, el system (con su cache_control) y el mensaje; la herramienta SIN strict (lo que devuelva lo validan después
 * propuestaSchema / camposSchema con zod); sin betas, sin fallbacks y sin thinking. Se queda effort 'low' (GA, sin
 * beta; en Sonnet 5.5 el effort de serie es 'high' y sin él el razonamiento adaptativo no cabría en los 60 s de la
 * ruta): si el effort fuera la causa del 400, la mínima también fallaría y el aviso del log diría "parámetro
 * output_config.effort". tool_choice sigue en 'auto' (con una sola llamada): Claude Sonnet 5.5 rechaza con 400 el
 * forzado ('tool' / 'any'), así que forzarla aquí haría fallar también la mínima; el mensaje ya pide la herramienta por
 * su nombre y, si no la llama, hay un reintento.
 */
export function peticionMinima(entrada: PedidoHerramienta): Anthropic.Beta.Messages.MessageCreateParamsNonStreaming {
  const { name, description, input_schema } = entrada.herramienta
  return {
    model: MODELO_PROPUESTA,
    max_tokens: Math.max(entrada.maxTokens, MAX_TOKENS_PETICION_MINIMA),
    output_config: { effort: 'low' },
    system: [{ type: 'text', text: entrada.sistema, cache_control: { type: 'ephemeral' } }],
    tools: [{ name, description, input_schema }],
    tool_choice: { type: 'auto', disable_parallel_tool_use: true },
    messages: [{ role: 'user', content: entrada.mensaje }],
  }
}

/**
 * ¿Anthropic rechazó la PETICIÓN (400 invalid_request)? Solo entonces se prueba la mínima. Un 'refusal' (200), un 429,
 * un 5xx, la red o el tiempo agotado NO: la mínima no los arreglaría (y el SDK ya reintenta 429/5xx y la red).
 */
export function esPeticionRechazada(error: unknown): boolean {
  return error instanceof Anthropic.APIError && error.status === 400
}

/** Una petición (y un reintento si no llama a la herramienta). 'refusal' o max_tokens son un fallo (502). */
async function llamarHerramienta(
  cliente: ClientePropuesta,
  peticion: Anthropic.Beta.Messages.MessageCreateParamsNonStreaming,
  nombre: string,
  alUsar?: AlUsarClaude
): Promise<unknown> {
  for (let intento = 1; intento <= 2; intento++) {
    const respuesta = await cliente.beta.messages.create(peticion)
    if (alUsar) {
      try {
        alUsar(respuesta?.usage)
      } catch {
        // medir nunca rompe la propuesta
      }
    }
    if (respuesta.stop_reason === 'refusal') throw new ErrorProveedorVoz('anthropic', 'rechazo')
    const bloque = respuesta.content.find(
      (contenido): contenido is Anthropic.Beta.Messages.BetaToolUseBlock => contenido.type === 'tool_use' && contenido.name === nombre
    )
    if (respuesta.stop_reason === 'max_tokens') throw new ErrorProveedorVoz('anthropic', 'respuesta cortada (max_tokens)')
    if (bloque) return bloque.input
  }
  throw new ErrorProveedorVoz('anthropic', `no usó la herramienta ${nombre}`)
}

/**
 * Una llamada a Claude que debe responder SOLO con una herramienta (proponer_visitas o repartir_campos): los mismos
 * parámetros para las dos (ver proponerVisitas) y un reintento si no la llama. Si Anthropic rechaza la petición
 * completa con un 400, deja en el log (console.warn) el resumen seguro del porqué (tipo, parámetro, request_id; nunca
 * el contenido) y reintenta UNA vez con la petición mínima; si la mínima también falla, se lanza ese error (la ruta
 * responde 502). Devuelve la entrada cruda de la herramienta; 'refusal' o max_tokens son un fallo del proveedor (502).
 */
async function pedirHerramienta(entrada: PedidoHerramienta, alUsar?: AlUsarClaude): Promise<unknown> {
  const apiKey = llave('ANTHROPIC_API_KEY')
  if (!apiKey) throw new ErrorProveedorVoz('anthropic', 'sin llave')
  const cliente = fabricas.anthropic(apiKey, cabecerasDelWorkspace())
  try {
    return await llamarHerramienta(cliente, peticionCompleta(entrada), entrada.herramienta.name, alUsar)
  } catch (error) {
    if (!esPeticionRechazada(error)) throw error
    console.warn(
      `Claude rechazó la petición completa de ${entrada.herramienta.name} (${resumenErrorVoz(error, entrada.sensibles)}); se reintenta con la petición mínima`
    )
    return llamarHerramienta(cliente, peticionMinima(entrada), entrada.herramienta.name, alUsar)
  }
}

/** Tope de tokens del reparto de un dictado (tres campos cortos). */
export const MAX_TOKENS_CAMPOS = 2048

/** La definición de la herramienta repartir_campos (estricta, con el esquema cerrado de esquemaCampos). */
export const HERRAMIENTA_REPARTIR: Anthropic.Beta.Messages.BetaTool = {
  name: HERRAMIENTA_CAMPOS.name,
  description: HERRAMIENTA_CAMPOS.description,
  strict: true,
  input_schema: esquemaParaHerramienta(esquemaCampos) as Anthropic.Beta.Messages.BetaTool.InputSchema,
}

/**
 * Decisión 9 de F4.1 (POST /api/me/voz/campos): pide a Claude que reparta lo dictado para UNA visita entre conclusión,
 * compromisos y próxima reunión. Mismos proveedor, parámetros y respaldo de petición mínima que proponer. Devuelve la
 * entrada cruda de la herramienta (la ruta la valida con camposSchema y la normaliza con normalizarCampos). El texto
 * nunca va a los logs.
 */
export async function repartirCampos(entrada: { transcript: string; tipo: TipoVisita; hoy: string }, alUsar?: AlUsarClaude): Promise<unknown> {
  return pedirHerramienta(
    {
      sistema: PROMPT_CAMPOS,
      herramienta: HERRAMIENTA_REPARTIR,
      maxTokens: MAX_TOKENS_CAMPOS,
      mensaje: mensajeCampos(entrada),
      sensibles: [entrada.transcript],
    },
    alUsar
  )
}
