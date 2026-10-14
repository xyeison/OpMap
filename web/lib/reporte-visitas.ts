/**
 * Fase 8 · F3 reporte de visitas y voz: lógica PURA (sin red, sin base de datos, sin node:*), compartida por la
 * API (/api/me/contexto, /api/me/visitas, /api/me/voz/**, /api/me/numeros), la app móvil (los TIPOS se copian a
 * mobile/lib/tipos.ts) y las pruebas (scripts/reporte-check.ts).
 * Contrato: docs/fases/fase8-visitas-f3-f4-reporte-y-app-movil.md (secciones "Código puro", "API" y "Sesión").
 * Spec: docs/specs/2026-10-12-app-de-visita-opmap.md (secciones 2, 4, 5, 8, 9 "Voz", 11 y 12).
 *
 * Qué hay aquí:
 *   1. Constantes, mensajes (los mismos que lanza visitas_registrar con SQLSTATE 23514) y límites.
 *   2. Geografía y fechas: Haversine en metros enteros (radio 6371008.8 m, igual que el SQL) y la fecha de un
 *      instante en Bogotá (UTC−5 todo el año).
 *   3. Configuración efectiva de una persona: radio y telefónica (general con la excepción por persona).
 *   4. validarVisita: espejo de los pasos 2 a 7 de visitas_registrar (la API la corre ANTES de la RPC para
 *      devolver 400 con todos los errores a la vez; la base sigue siendo la última palabra).
 *   5. Hoy y Mis números: compromisos vencidos, resumen del día y cumplimiento del mes (con valorVisita de F2).
 *   6. Sedes cercanas (lista ordenada por distancia, sin mapa).
 *   7. Voz: vocabulario para la transcripción, prompt del sistema, esquema de la herramienta `proponer_visitas`
 *      y normalización de la propuesta (solo ids del contexto; nunca documentos ni teléfonos).
 *   8. Tipos de las respuestas de la API, para que API y app hablen igual.
 *
 * Lo que valida la forma de los cuerpos (zod) está en lib/reporte-visitas-schemas.ts.
 */
import type { Role } from './permissions'
import { etiquetaDe, valoresDe, type Opcion } from './terceros'
import {
  MENSAJE_SIN_EJECUTIVA,
  esFechaIso,
  generalVigente,
  hoyBogota,
  valorVisita,
  type ConfigTelefonicas,
  type ConteoVigencia,
  type CuotaResponse,
  type GeneralVigencia,
  type MedioTelefonica,
  type TipoVisita,
  type ValorVisita,
} from './visits-rules'

// ---------------------------------------------------------------------------------------------
// 1. Constantes, mensajes y límites
// ---------------------------------------------------------------------------------------------

/** Modalidad de la visita (visits.modalidad). */
export const MODALIDADES = [
  { valor: 'presencial', etiqueta: 'Presencial' },
  { valor: 'telefonica', etiqueta: 'Telefónica' },
] as const satisfies readonly Opcion[]
export type Modalidad = (typeof MODALIDADES)[number]['valor']
export const VALORES_MODALIDAD = valoresDe<Modalidad>(MODALIDADES)
export const etiquetaModalidad = (valor: string | null | undefined) => etiquetaDe(MODALIDADES, valor)

/** Cómo se reportó (visits.input_mode). */
export const MODOS_ENTRADA = [
  { valor: 'voz', etiqueta: 'Por voz' },
  { valor: 'toques', etiqueta: 'Por toques' },
] as const satisfies readonly Opcion[]
export type ModoEntrada = (typeof MODOS_ENTRADA)[number]['valor']
export const VALORES_MODO_ENTRADA = valoresDe<ModoEntrada>(MODOS_ENTRADA)

/** Fuente de una fila de visits. Las 7.033 importadas de VMO quedan 'vmo_import'. */
export type FuenteVisita = 'vmo_import' | 'app'

/** Límites de texto (mismos CHECK de la 0830). */
export const MAX_FAILURE_REASON = 300
export const MAX_CONCLUSION = 2000
export const MAX_COMPROMISOS = 2000
export const MAX_TRANSCRIPT = 8000
export const MAX_LINEAS_VISITA = 10
export const MAX_VISITAS_PROPUESTA = 10
export const MAX_PREGUNTAS_PROPUESTA = 2

/** Voz: audio m4a/webm/mp4, hasta 3 minutos y 25 MB; se lee a memoria y se desecha (nunca a disco). */
export const AUDIO_MAX_BYTES = 25 * 1024 * 1024
export const AUDIO_MAX_SEGUNDOS = 180
export const AUDIO_TIPOS = ['audio/m4a', 'audio/x-m4a', 'audio/mp4', 'audio/aac', 'audio/webm', 'video/mp4', 'video/webm'] as const
export const AUDIO_EXTENSIONES = ['.m4a', '.mp4', '.webm', '.aac'] as const

/** ¿Es un audio que acepta /api/me/voz/transcribir? Por tipo MIME (sin parámetros) o, si no lo trae, por extensión. */
export function esAudioPermitido(mime: string | null | undefined, nombre?: string | null): boolean {
  const tipo = (mime ?? '').split(';')[0].trim().toLowerCase()
  if (tipo && (AUDIO_TIPOS as readonly string[]).includes(tipo)) return true
  const archivo = (nombre ?? '').trim().toLowerCase()
  return AUDIO_EXTENSIONES.some(extension => archivo.endsWith(extension))
}

/** Modelos de voz (decisiones 11 y 12 del contrato). */
export const MODELO_TRANSCRIPCION = 'gpt-4o-transcribe'
export const MODELO_TRANSCRIPCION_RESPALDO = 'whisper-1'
export const MODELO_PROPUESTA = 'claude-sonnet-5-5'
export const IDIOMA_TRANSCRIPCION = 'es'

/** Mensajes de la voz cuando faltan las llaves (503) o falla el proveedor (502). */
export const MENSAJE_SIN_OPENAI = 'La transcripción no está configurada (falta OPENAI_API_KEY)'
export const MENSAJE_SIN_ANTHROPIC = 'La propuesta por voz no está configurada (falta ANTHROPIC_API_KEY)'
export const MENSAJE_FALLO_TRANSCRIPCION = 'No se pudo transcribir el audio. Reporta la visita por toques.'
export const MENSAJE_FALLO_PROPUESTA = 'No se pudo armar la propuesta. Reporta la visita por toques.'
export const MENSAJE_AUDIO_FORMATO = 'Formato de audio no válido: usa m4a, mp4 o webm'
export const MENSAJE_AUDIO_TAMANO = `El audio no puede superar ${AUDIO_MAX_BYTES / (1024 * 1024)} MB`
export const MENSAJE_AUDIO_DURACION = `El audio no puede durar más de ${AUDIO_MAX_SEGUNDOS / 60} minutos`
export const MENSAJE_AUDIO_SIN_DURACION = 'No se pudo leer la duración del audio: vuelve a grabarlo'
/** Margen sobre los 3 minutos para la duración leída del archivo (el teléfono corta a los 180 s exactos). */
export const AUDIO_MARGEN_SEGUNDOS = 3
export const MENSAJE_LIMITE_VOZ = 'Demasiados dictados seguidos: espera un momento o reporta por toques'

/** Mensajes de visitas_registrar (23514) que la pre-validación repite tal cual. */
export const MENSAJE_SOLO_HOY = 'Solo se reportan visitas del mismo día'
export const MENSAJE_SEDE_SIN_UBICACION = 'Esta sede no tiene ubicación: confírmala o crea la sede'
export const MENSAJE_TELEFONICA_NO_HABILITADA = 'No tienes habilitada la visita telefónica'
export const MENSAJE_TOPE_MEDICO = 'Ya reportaste una visita a este médico hoy'
export const MENSAJE_SIN_ZONA = 'Tu Ejecutivo Comercial no tiene zona base'
export const MENSAJE_REPORTE_ANTES_DE_LLEGADA = 'La hora del reporte no puede ser anterior a la de llegada'
/** visitas_registrar rechaza una llegada más adelantada que esto respecto del reloj del servidor (c_tolerancia). */
export const TOLERANCIA_RELOJ_SEGUNDOS = 300
export const MENSAJE_LLEGADA_FUTURA = 'La hora de llegada está en el futuro'
/** Lo mismo para la hora en que confirmó (misma tolerancia): un teléfono con el reloj adelantado no la deja en el futuro. */
export const MENSAJE_REPORTE_FUTURO = 'La hora del reporte está en el futuro'
export const MENSAJE_PROXIMA_ANTES_DE_VISITA = 'La próxima reunión no puede ser anterior a la fecha de la visita'
export const MENSAJE_REINTENTO_ANTES_DE_VISITA = 'La fecha para reintentar no puede ser anterior a la fecha de la visita'
export const MENSAJE_SEDE_NO_EXISTE = 'Esa sede no existe'
/** La sede existe y está activa, pero su cuenta está desactivada (médica e institucional). */
export const MENSAJE_CUENTA_INACTIVA = 'La cuenta de esa sede está inactiva'
export const MENSAJE_CONTACTO_INACTIVO = 'Ese contacto está inactivo'
export const MENSAJE_MEDICO_NO_EXISTE = 'Ese médico no existe o está inactivo'
export const MENSAJE_SEDE_NO_DEL_MEDICO = 'El médico no atiende en esa sede'
export const MENSAJE_SEDE_NO_DE_LA_CUENTA = 'Esa sede no es de la cuenta elegida'
export const MENSAJE_SUBTIPO_NO_VIGENTE = 'Ese subtipo no está vigente'
export const MENSAJE_CONTACTO_OTRA_CUENTA = 'Ese contacto no es de la cuenta elegida'
export const MENSAJE_LINEAS_AJENAS = 'Alguna de las líneas no es tuya'
export const MENSAJE_VISITA_NO_EDITABLE = 'Solo puedes corregir o anular tus visitas del mismo día'

export function mensajeFueraDeRadio(distanciaM: number, sede: string, radioM: number): string {
  return `Estás a ${distanciaM} m de ${sede}; el radio es ${radioM} m`
}

export function mensajePerfil(tipo: TipoVisita): string {
  return tipo === 'medica' ? 'Tu perfil no incluye visitas médicas' : 'Tu perfil no incluye visitas institucionales'
}

export function mensajeTopeTelefonicas(tope: number): string {
  return tope === 1 ? 'Ya reportaste tu visita telefónica de hoy' : `Ya reportaste las ${tope} visitas telefónicas de hoy`
}

export function mensajeMedio(medios: readonly string[]): string {
  return medios.length === 0 ? 'No tienes medios habilitados para la visita telefónica' : `Medio no válido: ${medios.join(' o ')}`
}

// ---------------------------------------------------------------------------------------------
// 2. Geografía y fechas
// ---------------------------------------------------------------------------------------------

/** Radio medio de la Tierra (IUGG), el mismo que usa visitas_registrar. */
export const RADIO_TIERRA_M = 6371008.8

export interface Punto {
  lat: number
  lng: number
}

const aRadianes = (grados: number) => (grados * Math.PI) / 180

/** Distancia Haversine entre dos puntos, en metros enteros (redondeo al más cercano). */
export function haversineM(a: Punto, b: Punto): number {
  const dLat = aRadianes(b.lat - a.lat)
  const dLng = aRadianes(b.lng - a.lng)
  const seno = Math.sin(dLat / 2) ** 2 + Math.cos(aRadianes(a.lat)) * Math.cos(aRadianes(b.lat)) * Math.sin(dLng / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(seno), Math.sqrt(Math.max(0, 1 - seno)))
  return Math.round(RADIO_TIERRA_M * c)
}

/** ¿Coordenadas válidas (números finitos dentro del rango)? */
export function esPunto(lat: unknown, lng: unknown): boolean {
  return typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
}

/** Distancia legible: "350 m" o "2,4 km". */
export function textoDistancia(metros: number): string {
  if (metros < 1000) return `${metros} m`
  return `${(metros / 1000).toFixed(1).replace('.', ',')} km`
}

const INSTANTE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:?\d{2})$/
const HORA_MS = 60 * 60 * 1000
/** Colombia: UTC−5 todo el año (sin horario de verano). */
const DESFASE_BOGOTA_MS = 5 * HORA_MS

/** ¿Es un instante ISO 8601 con zona (Z o ±HH:MM) que existe? */
export function esInstanteIso(valor: unknown): valor is string {
  return typeof valor === 'string' && INSTANTE_RE.test(valor) && !Number.isNaN(Date.parse(valor))
}

/** Fecha AAAA-MM-DD en Bogotá de un instante ISO (con zona). Lanza si no es un instante válido. */
export function fechaBogota(iso: string | Date): string {
  const ms = iso instanceof Date ? iso.getTime() : Date.parse(iso)
  if (Number.isNaN(ms)) throw new Error(`Instante no válido: ${String(iso)}`)
  return new Date(ms - DESFASE_BOGOTA_MS).toISOString().slice(0, 10)
}

/** Hora HH:MM en Bogotá de un instante ISO. */
export function horaBogota(iso: string | Date): string {
  const ms = iso instanceof Date ? iso.getTime() : Date.parse(iso)
  if (Number.isNaN(ms)) throw new Error(`Instante no válido: ${String(iso)}`)
  return new Date(ms - DESFASE_BOGOTA_MS).toISOString().slice(11, 16)
}

/** ¿El instante cae hoy en Bogotá (hoy = la fecha de `ahora` en Bogotá)? */
export function esHoyBogota(iso: string | Date, ahora: Date = new Date()): boolean {
  try {
    return fechaBogota(iso) === hoyBogota(ahora)
  } catch {
    return false
  }
}

/** Instante hasta el que la cola sin señal reintenta una visita: 23:59:59 de ese día en Bogotá. */
export function finDelDiaBogota(fecha: string): Date {
  if (!esFechaIso(fecha)) throw new Error(`Fecha no válida: ${String(fecha)}`)
  return new Date(Date.parse(`${fecha}T23:59:59.999-05:00`))
}

// ---------------------------------------------------------------------------------------------
// 3. Configuración efectiva de una persona
// ---------------------------------------------------------------------------------------------

/** Lo que una persona puede tener propio (config_personas vigente) o no (null = sin fila). */
export interface PersonaEfectiva {
  radio_m?: number | null
  telefonica_habilitada?: boolean | null
  tope_telefonicas_dia?: number | null
}

/** Telefónica que rige para una persona en una fecha. */
export interface TelefonicaEfectiva {
  habilitada: boolean
  tope_dia: number
  medios: MedioTelefonica[]
}

/** Radio presencial: el de la persona si lo tiene; si no, el general. */
export function radioEfectivo(general: { radio_presencial_m: number }, persona: PersonaEfectiva | null | undefined): number {
  const propio = persona?.radio_m
  return typeof propio === 'number' && Number.isFinite(propio) && propio > 0 ? propio : Number(general.radio_presencial_m)
}

/**
 * Telefónica: habilitada solo si la persona la tiene (sin fila: no); tope el suyo o el general; medios siempre los
 * generales vigentes.
 */
export function telefonicaEfectiva(
  general: { telefonicas: ConfigTelefonicas },
  persona: PersonaEfectiva | null | undefined
): TelefonicaEfectiva {
  const propio = persona?.tope_telefonicas_dia
  return {
    habilitada: persona?.telefonica_habilitada === true,
    tope_dia: typeof propio === 'number' && Number.isFinite(propio) && propio >= 0 ? propio : Number(general.telefonicas.tope_dia),
    medios: [...general.telefonicas.medios],
  }
}

// ---------------------------------------------------------------------------------------------
// 4. La visita: forma del cuerpo y validación (espejo de visitas_registrar, pasos 2 a 7)
// ---------------------------------------------------------------------------------------------

/** Campos comunes del cuerpo de POST /api/me/visitas (ya validado por visitaCreateSchema). */
export interface VisitaCreateBase {
  client_id: string
  sede_id: string
  efectiva: boolean
  failure_reason: string | null
  retry_date: string | null
  /** Instante del sitio (ISO con zona). visit_date = su fecha en Bogotá. */
  checked_in_at: string
  /** Instante en que confirmó (ISO con zona), nunca antes de checked_in_at. */
  reported_at: string
  lat: number | null
  lng: number | null
  gps_accuracy_m: number | null
  conclusion: string | null
  compromisos: string | null
  next_step_date: string | null
  transcript: string | null
  input_mode: ModoEntrada
  lineas: string[]
}

export type VisitaCreateTipo =
  | { tipo: 'medica'; medico_id: string; cuenta_id: null; subtipo_id: null; contacto_id: null }
  | { tipo: 'institucional'; medico_id: null; cuenta_id: string; subtipo_id: string; contacto_id: string | null }

export type VisitaCreateModalidad =
  | { modalidad: 'presencial'; lat: number; lng: number; medio: null }
  | { modalidad: 'telefonica'; medio: MedioTelefonica }

/** Cuerpo de POST /api/me/visitas: tipo y modalidad discriminados. */
export type VisitaCreate = VisitaCreateBase & VisitaCreateTipo & VisitaCreateModalidad

/** Cuerpo de PATCH /api/me/visitas/[id] (solo lo que la ejecutiva corrige el mismo día). */
export interface VisitaUpdate {
  conclusion?: string | null
  compromisos?: string | null
  next_step_date?: string | null
  efectiva?: boolean
  failure_reason?: string | null
  retry_date?: string | null
  lineas?: string[]
}

export interface SedeValidacion {
  id: string
  nombre: string
  cuenta_id: string | null
  lat: number | null
  lng: number | null
  /** La cuenta de la sede está activa (false: se rechaza, como en visitas_registrar). Sin el dato: activa. */
  cuenta_activa?: boolean
}

export interface MedicoValidacion {
  id: string
  nombre: string
  activo: boolean
  /** Sedes donde atiende (medico_sedes). */
  sede_ids: readonly string[]
  /** La ejecutiva tiene un medico_visitantes vigente para él (cualquier línea). */
  es_visitante: boolean
}

export interface SubtipoValidacion {
  id: string
  codigo: string
  vigente_desde: string
  vigente_hasta: string | null
}

export interface ContactoValidacion {
  id: string
  cuenta_id: string
  /** false: contacto dado de baja (se rechaza). Sin el dato: activo. */
  activo?: boolean
}

/**
 * Lo que la API carga de la base para validar UNA visita (por los ids del cuerpo): la ejecutiva, la sede elegida, el
 * médico (médica), el subtipo y el contacto (institucional). null = ese id no existe.
 */
export interface ContextoValidacion {
  ejecutiva: { id: string; activa: boolean; con_zona: boolean; lineas: readonly string[] }
  sede: SedeValidacion | null
  medico: MedicoValidacion | null
  subtipo: SubtipoValidacion | null
  contacto: ContactoValidacion | null
}

/** Configuración vigente de la persona (la misma de ContextoResponse.config). */
export interface ConfigContexto {
  radio_m: number
  telefonica: TelefonicaEfectiva
  tope_visitas_medico_dia: number
  perfil: TipoVisita[]
}

/** Una visita de hoy de la ejecutiva (no anulada), para los topes. */
export interface VisitaDeHoy {
  /** Si coincide con el client_id del cuerpo es la misma visita reintentada: no cuenta para sus propios topes. */
  client_id?: string | null
  medico_id: string | null
  modalidad: Modalidad
  efectiva: boolean
}

export interface ErrorVisita {
  campo: string
  mensaje: string
}

export interface ResultadoValidacion {
  ok: boolean
  errores: ErrorVisita[]
  /** Metros a la sede (presencial con sede ubicada); null si no aplica. */
  distance_m: number | null
  /** Médica a un médico del que no es visitante (suma a su meta, queda marcada). */
  out_of_territory: boolean
}

/**
 * Espejo de los pasos 2 a 7 de visitas_registrar. Devuelve TODOS los errores que encuentra (la base lanza el
 * primero); `hoy` es la fecha de Bogotá de `ahora` (por defecto, ahora mismo). Nunca escribe nada.
 *
 * El paso 1 (idempotencia) NO está aquí: quien llama debe buscar antes el client_id y, si ya existe, devolver esa
 * visita con `repetida: true` SIN validar (un reintento de la cola sin señal después de medianoche, o una visita
 * que ya llenó el tope, no debe convertirse en un 400). Por si acaso, las visitas de `visitasDeHoy` con el mismo
 * client_id no cuentan para los topes. `visitasDeHoy` = las de ella con visit_date = hoy y deleted_at NULL.
 */
export function validarVisita(entrada: {
  datos: VisitaCreate
  contexto: ContextoValidacion
  config: ConfigContexto
  hoy?: string
  ahora?: Date
  visitasDeHoy: readonly VisitaDeHoy[]
}): ResultadoValidacion {
  const { datos, contexto, config } = entrada
  const hoy = entrada.hoy ?? hoyBogota(entrada.ahora ?? new Date())
  const visitasDeHoy = entrada.visitasDeHoy.filter(visita => !visita.client_id || visita.client_id !== datos.client_id)
  const errores: ErrorVisita[] = []
  const falla = (campo: string, mensaje: string) => errores.push({ campo, mensaje })
  let distance_m: number | null = null
  let out_of_territory = false

  // 2. Ejecutiva activa con zona; mismo día; reporte no anterior a la llegada
  if (!contexto.ejecutiva.activa) falla('executive_id', MENSAJE_SIN_EJECUTIVA)
  else if (!contexto.ejecutiva.con_zona) falla('executive_id', MENSAJE_SIN_ZONA)

  // Como la base (paso 2 de visitas_registrar): la fecha en Bogotá debe ser hoy y la llegada no puede ir más de
  // TOLERANCIA_RELOJ_SEGUNDOS por delante del reloj del servidor (un teléfono con el reloj adelantado unos segundos
  // pasa; uno adelantado media hora, no).
  const llegadaMs = Date.parse(datos.checked_in_at)
  const reporteMs = Date.parse(datos.reported_at)
  const ahoraMs = (entrada.ahora ?? new Date()).getTime()
  if (!esInstanteIso(datos.checked_in_at) || Number.isNaN(llegadaMs)) falla('checked_in_at', 'La hora de llegada no es válida')
  else if (fechaBogota(datos.checked_in_at) !== hoy) falla('checked_in_at', MENSAJE_SOLO_HOY)
  else if (llegadaMs > ahoraMs + TOLERANCIA_RELOJ_SEGUNDOS * 1000) falla('checked_in_at', MENSAJE_LLEGADA_FUTURA)
  if (!esInstanteIso(datos.reported_at) || Number.isNaN(reporteMs)) falla('reported_at', 'La hora del reporte no es válida')
  else if (!Number.isNaN(llegadaMs) && reporteMs < llegadaMs) falla('reported_at', MENSAJE_REPORTE_ANTES_DE_LLEGADA)
  else if (reporteMs > ahoraMs + TOLERANCIA_RELOJ_SEGUNDOS * 1000) falla('reported_at', MENSAJE_REPORTE_FUTURO)

  // Próxima reunión y reintento: nunca antes de la fecha de la visita (si no, nacería como compromiso vencido).
  const fechaVisita = esInstanteIso(datos.checked_in_at) && !Number.isNaN(llegadaMs) ? fechaBogota(datos.checked_in_at) : null
  if (fechaVisita && datos.next_step_date && datos.next_step_date < fechaVisita) falla('next_step_date', MENSAJE_PROXIMA_ANTES_DE_VISITA)
  if (fechaVisita && datos.retry_date && datos.retry_date < fechaVisita) falla('retry_date', MENSAJE_REINTENTO_ANTES_DE_VISITA)

  // 3. Perfil
  if (!config.perfil.includes(datos.tipo)) falla('tipo', mensajePerfil(datos.tipo))

  // 4. Médica o institucional. La sede debe estar activa y su cuenta también (una cuenta dada de baja no recibe
  //    visitas aunque sus sedes sigan activas).
  const sede = contexto.sede && contexto.sede.id === datos.sede_id ? contexto.sede : null
  if (!sede) falla('sede_id', MENSAJE_SEDE_NO_EXISTE)
  else if (sede.cuenta_activa === false) falla(datos.tipo === 'institucional' ? 'cuenta_id' : 'sede_id', MENSAJE_CUENTA_INACTIVA)

  if (datos.tipo === 'medica') {
    const medico = contexto.medico && contexto.medico.id === datos.medico_id ? contexto.medico : null
    if (!medico || !medico.activo) falla('medico_id', MENSAJE_MEDICO_NO_EXISTE)
    else {
      if (sede && !medico.sede_ids.includes(sede.id)) falla('sede_id', MENSAJE_SEDE_NO_DEL_MEDICO)
      out_of_territory = !medico.es_visitante
    }
  } else {
    if (sede && sede.cuenta_id !== datos.cuenta_id) falla('cuenta_id', MENSAJE_SEDE_NO_DE_LA_CUENTA)
    const subtipo = contexto.subtipo && contexto.subtipo.id === datos.subtipo_id ? contexto.subtipo : null
    if (!subtipo || !subtipoVigenteEn(subtipo, hoy)) falla('subtipo_id', MENSAJE_SUBTIPO_NO_VIGENTE)
    if (datos.contacto_id) {
      const contacto = contexto.contacto && contexto.contacto.id === datos.contacto_id ? contexto.contacto : null
      if (!contacto || contacto.cuenta_id !== datos.cuenta_id) falla('contacto_id', MENSAJE_CONTACTO_OTRA_CUENTA)
      else if (contacto.activo === false) falla('contacto_id', MENSAJE_CONTACTO_INACTIVO)
    }
  }

  // 5. Modalidad
  if (datos.modalidad === 'presencial') {
    if (!esPunto(datos.lat, datos.lng)) falla('lat', 'La ubicación del teléfono es obligatoria en una visita presencial')
    else if (sede) {
      if (!esPunto(sede.lat, sede.lng)) falla('sede_id', MENSAJE_SEDE_SIN_UBICACION)
      else {
        distance_m = haversineM({ lat: datos.lat, lng: datos.lng }, { lat: sede.lat as number, lng: sede.lng as number })
        if (distance_m > config.radio_m) falla('lat', mensajeFueraDeRadio(distance_m, sede.nombre, config.radio_m))
      }
    }
  } else {
    if (!config.telefonica.habilitada) falla('modalidad', MENSAJE_TELEFONICA_NO_HABILITADA)
    else {
      if (!config.telefonica.medios.includes(datos.medio)) falla('medio', mensajeMedio(config.telefonica.medios))
      const telefonicasHoy = visitasDeHoy.filter(v => v.modalidad === 'telefonica' && v.efectiva).length
      if (telefonicasHoy >= config.telefonica.tope_dia) falla('modalidad', mensajeTopeTelefonicas(config.telefonica.tope_dia))
    }
  }

  // 6. Tope por médico (solo efectivas)
  if (datos.tipo === 'medica' && datos.efectiva) {
    const alMedicoHoy = visitasDeHoy.filter(v => v.efectiva && v.medico_id === datos.medico_id).length
    if (alMedicoHoy >= config.tope_visitas_medico_dia) falla('medico_id', MENSAJE_TOPE_MEDICO)
  }

  // 7. Líneas: al menos una (el esquema) y todas de la ejecutiva
  if (datos.lineas.length === 0) falla('lineas', 'Elige al menos una línea')
  else if (datos.lineas.some(id => !contexto.ejecutiva.lineas.includes(id))) falla('lineas', MENSAJE_LINEAS_AJENAS)

  return { ok: errores.length === 0, errores, distance_m, out_of_territory }
}

/** ¿El subtipo rige en esa fecha? */
export function subtipoVigenteEn(subtipo: { vigente_desde: string; vigente_hasta: string | null }, fecha: string): boolean {
  return subtipo.vigente_desde <= fecha && (subtipo.vigente_hasta === null || fecha <= subtipo.vigente_hasta)
}

/** ¿La ejecutiva puede corregir o anular la visita? Solo las de la app, suyas, no anuladas y de hoy. */
export function visitaEditable(
  visita: { source: FuenteVisita; executive_id: string | null; visit_date: string; deleted_at: string | null },
  executiveId: string,
  hoy: string
): boolean {
  return visita.source === 'app' && visita.executive_id === executiveId && visita.deleted_at === null && visita.visit_date === hoy
}

// ---------------------------------------------------------------------------------------------
// 5. Hoy y Mis números
// ---------------------------------------------------------------------------------------------

/** Una visita (no anulada) con lo mínimo para los compromisos. */
export interface VisitaCompromiso {
  id: string
  /** visit_date. */
  fecha: string
  medico_id: string | null
  cuenta_id: string | null
  /** Con quién: nombre del médico o de la cuenta (para mostrar). */
  con: string
  next_step_date: string | null
}

/** Compromiso vencido en Hoy (ContextoResponse.compromisos_vencidos). */
export interface CompromisoVencido {
  visita_id: string
  fecha: string
  con: string
  next_step_date: string
}

const mismoTercero = (a: VisitaCompromiso, b: VisitaCompromiso) =>
  (a.medico_id !== null && a.medico_id === b.medico_id) || (a.cuenta_id !== null && a.cuenta_id === b.cuenta_id)

/**
 * Visitas de ella con next_step_date < hoy sin una visita posterior (por fecha) al mismo médico o cuenta. Ordenadas
 * por la fecha del compromiso, la más antigua primero.
 */
export function compromisosVencidos(visitas: readonly VisitaCompromiso[], hoy: string): CompromisoVencido[] {
  const vencidos: CompromisoVencido[] = []
  for (const visita of visitas) {
    if (!visita.next_step_date || visita.next_step_date >= hoy) continue
    const hayPosterior = visitas.some(otra => otra.id !== visita.id && otra.fecha > visita.fecha && mismoTercero(visita, otra))
    if (hayPosterior) continue
    vencidos.push({ visita_id: visita.id, fecha: visita.fecha, con: visita.con, next_step_date: visita.next_step_date })
  }
  return vencidos.sort((a, b) => a.next_step_date.localeCompare(b.next_step_date) || a.fecha.localeCompare(b.fecha))
}

/** Una visita de hoy (no anulada) para el resumen: tipo, modalidad, efectiva y cuánto vale (valorVisita). */
export interface VisitaResumen {
  tipo: TipoVisita
  modalidad: Modalidad
  efectiva: boolean
  /** A qué meta suma (valorVisita.meta); si no viene, médica → medica y institucional → institucional. */
  cuenta_para?: ValorVisita['meta']
  /** Peso (valorVisita.peso); si no viene, 1. */
  peso?: number
}

export interface HechasHoy {
  /** Efectivas médicas. */
  medicas: number
  /** Efectivas institucionales (cuenten o no para la meta). */
  institucionales: number
  /** Telefónicas efectivas (las que cuentan para el tope). */
  telefonicas: number
  no_efectivas: number
}

export interface ResumenHoy {
  meta: { medica: number; institucional: number }
  hechas: HechasHoy
  /** Suma de pesos que ya cuentan para cada meta. */
  valor: { medica: number; institucional: number }
  /** Las dos metas del día están cumplidas (con los pesos). */
  cuota_dia_ok: boolean
}

/** Resumen del día para Hoy: cuántas lleva frente a la meta del día. */
export function resumenHoy(visitas: readonly VisitaResumen[], metasDia: { medica: number; institucional: number }): ResumenHoy {
  const hechas: HechasHoy = { medicas: 0, institucionales: 0, telefonicas: 0, no_efectivas: 0 }
  const valor = { medica: 0, institucional: 0 }
  for (const visita of visitas) {
    if (!visita.efectiva) {
      hechas.no_efectivas++
      continue
    }
    if (visita.tipo === 'medica') hechas.medicas++
    else hechas.institucionales++
    if (visita.modalidad === 'telefonica') hechas.telefonicas++
    const meta = visita.cuenta_para === undefined ? visita.tipo : visita.cuenta_para
    const peso = visita.peso === undefined ? 1 : Number(visita.peso)
    if (meta === 'medica') valor.medica += peso
    else if (meta === 'institucional') valor.institucional += peso
  }
  const meta = { medica: Number(metasDia.medica), institucional: Number(metasDia.institucional) }
  return {
    meta,
    hechas,
    valor: { medica: redondear2(valor.medica), institucional: redondear2(valor.institucional) },
    cuota_dia_ok: valor.medica >= meta.medica && valor.institucional >= meta.institucional,
  }
}

/**
 * Cuánto vale una visita de la app (lo que usan Hoy, Mis números y GET /api/me/visitas):
 *   - la no efectiva no suma;
 *   - la de una sede que data manager aún no confirma (sedes.ubicacion_confirmada = false: sede nueva de la app sin
 *     código del REPS que cruce) NO suma todavía: suma sola cuando la confirmen (se mira la sede al contar, no al
 *     registrar) — regla del dueño, decisión 9 de docs/decisiones/2026-10-12-app-de-visita.md;
 *   - si no, valorVisita de F2 (conteo vigente en su fecha) y, si es telefónica, por el peso de la telefónica vigente
 *     en su fecha (config_general.telefonicas.peso; sin configuración, 1).
 */
export interface ValorReporte extends ValorVisita {
  /** Efectiva en una sede por confirmar: hoy no suma (meta null, peso 0); sumará cuando la confirmen. */
  sede_por_confirmar: boolean
}

export function valorReporte(entrada: {
  conteo: readonly ConteoVigencia[]
  /** config_general (vigencias) para el peso de la telefónica; sin filas, el de GENERAL_POR_DEFECTO (1). */
  general?: readonly GeneralVigencia[] | null
  fecha: string
  tipo: TipoVisita
  subtipo_id: string | null
  efectiva: boolean
  modalidad?: Modalidad | null
  /** sedes.ubicacion_confirmada de la sede de la visita. Sin el dato (undefined o null): confirmada. */
  sede_confirmada?: boolean | null
}): ValorReporte {
  const subtipoId = entrada.subtipo_id ?? null
  if (!entrada.efectiva) return { meta: null, subtipoId, peso: 0, sede_por_confirmar: false }
  if (entrada.sede_confirmada === false) return { meta: null, subtipoId, peso: 0, sede_por_confirmar: true }
  const base = valorVisita({ conteo: entrada.conteo, fecha: entrada.fecha, tipo: entrada.tipo, subtipoId })
  if (base.meta === null || entrada.modalidad !== 'telefonica') return { ...base, sede_por_confirmar: false }
  const pesoTelefonica = Number(generalVigente(entrada.general ?? [], 'telefonicas', entrada.fecha).peso)
  const factor = Number.isFinite(pesoTelefonica) && pesoTelefonica >= 0 ? pesoTelefonica : 1
  return { ...base, peso: redondear2(Number(base.peso) * factor), sede_por_confirmar: false }
}

/** Una visita del mes (no anulada) para el cumplimiento. */
export interface VisitaMes {
  /** visit_date. */
  fecha: string
  tipo: TipoVisita
  subtipo_id: string | null
  efectiva: boolean
  modalidad?: Modalidad
  out_of_territory?: boolean
  /** sedes.ubicacion_confirmada de su sede (false: aún no suma). Sin el dato: confirmada. */
  sede_confirmada?: boolean
}

/** Lo que el cumplimiento necesita de /api/me/cuota (CuotaResponse cumple esta forma). */
export interface CuotaParaCumplimiento {
  medica: { cuota: number }
  institucional: { cuota: number }
  subtipos: readonly { subtipo_id: string; nombre: string; cuota: number }[]
}

export interface CumplimientoTipo {
  /** Σ pesos de las efectivas que cuentan para esta meta. */
  hechas: number
  cuota: number
  /** hechas ÷ cuota (2 decimales); null si la cuota es 0. */
  cumplimiento: number | null
}

export interface CumplimientoSubtipo extends CumplimientoTipo {
  subtipo_id: string
  nombre: string
}

export interface ResultadoCumplimiento {
  medica: CumplimientoTipo
  institucional: CumplimientoTipo
  subtipos: CumplimientoSubtipo[]
  /** Días hábiles transcurridos (hábil − libre > 0, hasta hoy) sin ninguna visita. */
  dias_sin_visitas: number
  telefonicas: number
  no_efectivas: number
  fuera_de_territorio: number
  /** Efectivas en sedes que data manager aún no confirma: no suman todavía. */
  sede_por_confirmar: number
}

function redondear2(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100
}

const cumplimientoDe = (hechas: number, cuota: number): CumplimientoTipo => ({
  hechas: redondear2(hechas),
  cuota: redondear2(cuota),
  cumplimiento: cuota > 0 ? redondear2(hechas / cuota) : null,
})

/**
 * KPI 1: visitas efectivas × peso (valorReporte: el conteo vigente en la fecha de cada visita, el peso de la
 * telefónica vigente y solo en sedes confirmadas) ÷ cuota del periodo, para médica, institucional y los subtipos con
 * meta propia. `dias` (porDia de cuotaPeriodo) y `hoy` dan los días hábiles sin visitas; sin `dias`, 0.
 */
export function cumplimientoMes(entrada: {
  visitas: readonly VisitaMes[]
  conteo: readonly ConteoVigencia[]
  /** config_general (vigencias), para el peso de la telefónica; sin ella, peso 1. */
  general?: readonly GeneralVigencia[]
  cuota: CuotaParaCumplimiento
  dias?: readonly { fecha: string; habil: number; libre: number }[]
  hoy?: string
}): ResultadoCumplimiento {
  let medica = 0
  let institucional = 0
  const porSubtipo = new Map<string, number>()
  let telefonicas = 0
  let no_efectivas = 0
  let fuera_de_territorio = 0
  let sede_por_confirmar = 0
  const fechasConVisita = new Set<string>()

  for (const visita of entrada.visitas) {
    fechasConVisita.add(visita.fecha)
    if (visita.out_of_territory) fuera_de_territorio++
    if (!visita.efectiva) {
      no_efectivas++
      continue
    }
    if (visita.modalidad === 'telefonica') telefonicas++
    const valor = valorReporte({
      conteo: entrada.conteo,
      general: entrada.general,
      fecha: visita.fecha,
      tipo: visita.tipo,
      subtipo_id: visita.subtipo_id,
      efectiva: true,
      modalidad: visita.modalidad,
      sede_confirmada: visita.sede_confirmada,
    })
    if (valor.sede_por_confirmar) sede_por_confirmar++
    if (valor.meta === 'medica') medica += valor.peso
    else if (valor.meta === 'institucional') institucional += valor.peso
    else if (valor.meta === 'subtipo' && valor.subtipoId) porSubtipo.set(valor.subtipoId, (porSubtipo.get(valor.subtipoId) ?? 0) + valor.peso)
  }

  const dias = entrada.dias ?? []
  const hoy = entrada.hoy ?? (dias.length > 0 ? dias[dias.length - 1].fecha : '')
  const dias_sin_visitas = dias.filter(dia => dia.fecha <= hoy && dia.habil - dia.libre > 0 && !fechasConVisita.has(dia.fecha)).length

  return {
    medica: cumplimientoDe(medica, Number(entrada.cuota.medica.cuota)),
    institucional: cumplimientoDe(institucional, Number(entrada.cuota.institucional.cuota)),
    subtipos: entrada.cuota.subtipos.map(subtipo => ({
      subtipo_id: subtipo.subtipo_id,
      nombre: subtipo.nombre,
      ...cumplimientoDe(porSubtipo.get(subtipo.subtipo_id) ?? 0, Number(subtipo.cuota)),
    })),
    dias_sin_visitas,
    telefonicas,
    no_efectivas,
    fuera_de_territorio,
    sede_por_confirmar,
  }
}

// ---------------------------------------------------------------------------------------------
// 6. Sedes cercanas
// ---------------------------------------------------------------------------------------------

/** Sedes con coordenadas a menos de maxM del punto, de la más cercana a la más lejana, como mucho `max`. */
export function sedesCercanas<T extends { lat: number | null; lng: number | null }>(
  sedes: readonly T[],
  punto: Punto,
  maxM = 1000,
  max = 20
): (T & { distancia_m: number })[] {
  const conDistancia: (T & { distancia_m: number })[] = []
  for (const sede of sedes) {
    if (!esPunto(sede.lat, sede.lng)) continue
    const distancia_m = haversineM(punto, { lat: sede.lat as number, lng: sede.lng as number })
    if (distancia_m <= maxM) conDistancia.push({ ...sede, distancia_m })
  }
  return conDistancia.sort((a, b) => a.distancia_m - b.distancia_m).slice(0, Math.max(0, max))
}

/**
 * Distancia máxima entre el GPS de una sede nueva de la app y el centro de su municipio para que el código del REPS
 * la confirme. Medido el 2026-10-14 en la base: las 783 sedes de IPS de OpMap están a menos de 26 km del centro de su
 * municipio (mediana 1,5 km, 99 % a menos de 16 km).
 */
export const MAX_M_SEDE_APP_AL_MUNICIPIO = 20_000

/**
 * Decisión 14 (endurecida): una sede 'gps_app' nace confirmada solo si (1) su código de habilitación está en el REPS
 * con uno de los municipios aceptados (el de la sede o el de la sede principal de la cuenta), (2) el prestador de ese
 * código en el REPS (reps_sedes.nit) es el de la cuenta (cuentas.numero_identificacion, sin dígito de verificación) y
 * (3) el GPS del sitio queda a menos de MAX_M_SEDE_APP_AL_MUNICIPIO del centro de ESE municipio. Así un código público
 * del REPS de otra ciudad, o de otro prestador de la misma ciudad, no confirma una sede creada con el GPS de la casa.
 * Sin punto, sin centro del municipio o sin alguno de los dos números: no se confirma (la confirma data manager).
 * Nunca confirma a ciegas.
 */
export function sedeAppConfirmada(entrada: {
  /** reps_sedes.municipio_sede del código (null: el código no está en el REPS). */
  municipio_reps: string | null
  municipios_aceptados: readonly (string | null | undefined)[]
  punto: Punto | null
  /** Centro (lat/lng de municipalities) del municipio del REPS. */
  centro_municipio: Punto | null
  /** reps_sedes.nit del código: el prestador que lo tiene habilitado (sin dígito de verificación). */
  nit_reps: string | null
  /** cuentas.numero_identificacion de la cuenta a la que se le crea la sede. */
  identificacion_cuenta: string | null
  max_m?: number
}): boolean {
  const { municipio_reps, punto, centro_municipio } = entrada
  if (!municipio_reps || !/^\d{5}$/.test(municipio_reps)) return false
  if (!entrada.municipios_aceptados.some(codigo => codigo === municipio_reps)) return false
  if (!mismoPrestador(entrada.nit_reps, entrada.identificacion_cuenta)) return false
  if (!punto || !esPunto(punto.lat, punto.lng) || !centro_municipio || !esPunto(centro_municipio.lat, centro_municipio.lng)) return false
  return haversineM(punto, centro_municipio) <= (entrada.max_m ?? MAX_M_SEDE_APP_AL_MUNICIPIO)
}

/**
 * ¿El NIT del REPS es el número de identificación de la cuenta? Solo dígitos y sin ceros a la izquierda en los dos
 * (el REPS a veces trae puntos, guiones o ceros de relleno). Si falta alguno: no (nunca confirma a ciegas).
 */
export function mismoPrestador(nitReps: string | null | undefined, identificacionCuenta: string | null | undefined): boolean {
  const normalizar = (valor: string | null | undefined) => (typeof valor === 'string' ? valor.replace(/\D/g, '').replace(/^0+/, '') : '')
  const reps = normalizar(nitReps)
  const cuenta = normalizar(identificacionCuenta)
  return reps.length >= 3 && reps === cuenta
}

// ---------------------------------------------------------------------------------------------
// 7. Voz: transcripción y propuesta
// ---------------------------------------------------------------------------------------------

/** Términos de VG que la transcripción debe reconocer (líneas, subtipos y productos). */
export const TERMINOS_VG = [
  'PerOssal',
  'tornillo canulado',
  'reemplazo',
  'codificar',
  'osteosíntesis',
  'placa',
  'clavo',
  'artroscopia',
  'cotización',
  'licitación',
  'químico farmacéutico',
  'autorizaciones',
  'programación de cirugía',
] as const

const MAX_VOCABULARIO = 900

/** Prompt de vocabulario para OpenAI (corto: el modelo solo usa el principio). */
export function vocabularioVG(
  lineas: readonly (string | { name: string })[],
  subtipos: readonly (string | { nombre: string })[]
): string {
  const nombresLineas = lineas.map(linea => (typeof linea === 'string' ? linea : linea.name)).filter(Boolean)
  const nombresSubtipos = subtipos.map(subtipo => (typeof subtipo === 'string' ? subtipo : subtipo.nombre)).filter(Boolean)
  const partes = [
    'Reporte de una visita comercial de VG a médicos y clínicas en Colombia, en español.',
    nombresLineas.length > 0 ? `Líneas: ${nombresLineas.join(', ')}.` : '',
    nombresSubtipos.length > 0 ? `Visitas: ${nombresSubtipos.join(', ')}.` : '',
    `Términos: ${TERMINOS_VG.join(', ')}.`,
  ].filter(Boolean)
  return partes.join(' ').slice(0, MAX_VOCABULARIO)
}

// --- Duración del audio leída del propio archivo (sin decodificarlo) ----------------------------------------------
// La app manda `duracion_s`, pero el tope de 3 minutos no puede depender de lo que diga el cliente: OpenAI cobra por
// minuto. Se lee de la cabecera del contenedor: m4a/mp4 (caja mvhd: duración ÷ escala) y webm (Segment › Info ›
// Duration; si el navegador no la escribió —MediaRecorder no la escribe—, el mayor tiempo de los bloques de los
// Cluster). Otro formato o un archivo que no se deja leer → null (la ruta exige entonces la duración declarada).

const u32 = (b: Uint8Array, i: number): number => b[i] * 0x1000000 + ((b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3])

/** Caja `tipo` entre `desde` y `hasta` (recorriendo solo ese nivel), con su contenido; null si no está. */
function cajaMp4(b: Uint8Array, desde: number, hasta: number, tipo: string): { inicio: number; fin: number } | null {
  let i = desde
  for (let vueltas = 0; i + 8 <= hasta && vueltas < 10_000; vueltas++) {
    let tamano = u32(b, i)
    let cabecera = 8
    if (tamano === 1) {
      if (i + 16 > hasta) return null
      tamano = u32(b, i + 8) * 0x100000000 + u32(b, i + 12)
      cabecera = 16
    } else if (tamano === 0) {
      tamano = hasta - i
    }
    if (tamano < cabecera) return null
    if (String.fromCharCode(b[i + 4], b[i + 5], b[i + 6], b[i + 7]) === tipo) return { inicio: i + cabecera, fin: Math.min(hasta, i + tamano) }
    i += tamano
  }
  return null
}

function duracionMp4(b: Uint8Array): number | null {
  const moov = cajaMp4(b, 0, b.length, 'moov')
  const mvhd = moov ? cajaMp4(b, moov.inicio, moov.fin, 'mvhd') : null
  if (!mvhd) return null
  let escala: number
  let duracion: number
  if (b[mvhd.inicio] === 1) {
    // versión 1: versión+flags (4), creación (8), modificación (8), escala (4), duración (8)
    if (mvhd.inicio + 32 > mvhd.fin) return null
    escala = u32(b, mvhd.inicio + 20)
    duracion = u32(b, mvhd.inicio + 24) * 0x100000000 + u32(b, mvhd.inicio + 28)
  } else {
    // versión 0: versión+flags (4), creación (4), modificación (4), escala (4), duración (4)
    if (mvhd.inicio + 20 > mvhd.fin) return null
    escala = u32(b, mvhd.inicio + 12)
    duracion = u32(b, mvhd.inicio + 16)
    if (duracion === 0xffffffff) return null
  }
  return escala > 0 && duracion > 0 ? duracion / escala : null
}

/** Entero de largo variable de EBML (id con su marca; tamaño sin ella, con "desconocido" si todos sus bits son 1). */
function vintEbml(b: Uint8Array, i: number, conMarca: boolean): { valor: number; largo: number; desconocido: boolean } | null {
  if (i >= b.length || b[i] === 0) return null
  const primero = b[i]
  let largo = 1
  let mascara = 0x80
  while (!(primero & mascara)) {
    largo++
    mascara >>= 1
  }
  if (largo > 8 || i + largo > b.length) return null
  let valor = conMarca ? primero : primero & (mascara - 1)
  let todosUnos = (primero & (mascara - 1)) === mascara - 1
  for (let k = 1; k < largo; k++) {
    valor = valor * 256 + b[i + k]
    if (b[i + k] !== 0xff) todosUnos = false
  }
  return { valor, largo, desconocido: !conMarca && todosUnos }
}

const EBML_ENTRAR = new Set([0x18538067 /* Segment */, 0x1549a966 /* Info */, 0x1f43b675 /* Cluster */, 0xa0 /* BlockGroup */])

function enteroBE(b: Uint8Array, i: number, n: number): number {
  let valor = 0
  for (let k = 0; k < n; k++) valor = valor * 256 + b[i + k]
  return valor
}

function duracionWebm(b: Uint8Array): number | null {
  let i = 0
  let escala = 1_000_000 // nanosegundos por unidad de tiempo (TimecodeScale por defecto)
  let duracion: number | null = null
  let tiempoCluster = 0
  let maximo = -1
  for (let vueltas = 0; i < b.length && vueltas < 2_000_000; vueltas++) {
    const id = vintEbml(b, i, true)
    if (!id || id.largo > 4) break
    const tamano = vintEbml(b, i + id.largo, false)
    if (!tamano) break
    const datos = i + id.largo + tamano.largo
    if (EBML_ENTRAR.has(id.valor)) {
      i = datos // se entra al contenedor (tenga tamaño conocido o no) y se siguen leyendo sus hijos
      continue
    }
    const n = tamano.valor
    if (tamano.desconocido || datos + n > b.length) break
    if (id.valor === 0x2ad7b1 && n >= 1 && n <= 8) escala = enteroBE(b, datos, n) || escala // TimecodeScale
    else if (id.valor === 0x4489 && (n === 4 || n === 8)) {
      const vista = new DataView(b.buffer, b.byteOffset + datos, n) // Duration (float)
      duracion = n === 4 ? vista.getFloat32(0) : vista.getFloat64(0)
    } else if (id.valor === 0xe7 && n >= 1 && n <= 8) tiempoCluster = enteroBE(b, datos, n) // Cluster › Timecode
    else if ((id.valor === 0xa3 || id.valor === 0xa1) && n >= 4) {
      // SimpleBlock / Block: número de pista (vint) y tiempo relativo al Cluster (int16 con signo)
      const pista = vintEbml(b, datos, false)
      if (pista && pista.largo + 2 <= n) {
        const relativo = (((b[datos + pista.largo] << 8) | b[datos + pista.largo + 1]) << 16) >> 16
        maximo = Math.max(maximo, tiempoCluster + relativo)
      }
    }
    i = datos + n
  }
  if (duracion !== null && Number.isFinite(duracion) && duracion > 0) return (duracion * escala) / 1e9
  return maximo >= 0 ? (maximo * escala) / 1e9 : null
}

/**
 * Duración en segundos leída del archivo de audio (m4a/mp4 o webm), o null si el formato no se reconoce o la
 * cabecera no se deja leer. Nunca lanza y no copia los bytes (los lee en memoria, donde ya están).
 */
export function duracionAudioSegundos(bytes: Uint8Array): number | null {
  try {
    if (bytes.length >= 12 && String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7]) === 'ftyp') return duracionMp4(bytes)
    if (bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return duracionWebm(bytes)
    return null
  } catch {
    return null
  }
}

// --- Límite de frecuencia de la voz por Ejecutivo Comercial -------------------------------------------------------
// Transcribir y proponer cuestan (OpenAI por minuto, Anthropic por token). Además del tope de 3 minutos, cada persona
// tiene un máximo de llamadas por minuto y por hora; la ruta responde 429 con Retry-After.

export interface LimiteVentana {
  ventana_ms: number
  maximo: number
}

export const LIMITES_VOZ: Readonly<Record<'transcribir' | 'proponer', readonly LimiteVentana[]>> = {
  transcribir: [
    { ventana_ms: 60_000, maximo: 6 },
    { ventana_ms: 3_600_000, maximo: 40 },
  ],
  proponer: [
    { ventana_ms: 60_000, maximo: 10 },
    { ventana_ms: 3_600_000, maximo: 60 },
  ],
}

/** ¿Cabe una llamada más? Devuelve los instantes que siguen vigentes y, si no cabe, en cuántos segundos volver. */
export function revisarLimite(
  intentos: readonly number[],
  ahoraMs: number,
  limites: readonly LimiteVentana[]
): { permitido: boolean; reintentar_en_s: number; vigentes: number[] } {
  const mayor = Math.max(0, ...limites.map(limite => limite.ventana_ms))
  const vigentes = intentos.filter(instante => ahoraMs - instante < mayor).sort((a, b) => a - b)
  for (const limite of limites) {
    const enVentana = vigentes.filter(instante => ahoraMs - instante < limite.ventana_ms)
    if (enVentana.length >= limite.maximo) {
      const libera = enVentana[enVentana.length - limite.maximo]
      return { permitido: false, reintentar_en_s: Math.max(1, Math.ceil((libera + limite.ventana_ms - ahoraMs) / 1000)), vigentes }
    }
  }
  return { permitido: true, reintentar_en_s: 0, vigentes }
}

/** Lo que recibe Claude: un recorte de ContextoResponse SIN documentos ni teléfonos (se construye campo a campo). */
export interface ContextoDictado {
  fecha: string
  hora: string | null
  ejecutiva: { nombre: string; lineas: { id: string; code: string; name: string }[] }
  perfil: TipoVisita[]
  telefonica_habilitada: boolean
  sedes: { id: string; nombre: string; cuenta_id: string | null; cuenta: string | null; clase: string | null; distancia_m: number }[]
  medicos: { id: string; nombre: string; especialidades: string[]; sedes: { id: string; nombre: string }[] }[]
  contactos: { id: string; cuenta_id: string; sede_id: string | null; nombre: string; cargo: string | null; rol: string }[]
  subtipos: { id: string; codigo: string; nombre: string; roles_sugeridos: string[] }[]
}

/** El JSON compacto que recibe Claude. `hora` es la del dictado en Bogotá (HH:MM) si se conoce. */
export function contextoDictado(contexto: ContextoResponse, hora: string | null = null): ContextoDictado {
  return {
    fecha: contexto.hoy.fecha,
    hora,
    ejecutiva: {
      nombre: contexto.ejecutiva.nombre,
      lineas: contexto.ejecutiva.lineas.map(linea => ({ id: linea.id, code: linea.code, name: linea.name })),
    },
    perfil: [...contexto.config.perfil],
    telefonica_habilitada: contexto.config.telefonica.habilitada,
    sedes: contexto.sedes_cerca.map(sede => ({
      id: sede.id,
      nombre: sede.nombre,
      cuenta_id: sede.cuenta_id,
      cuenta: sede.cuenta_nombre,
      clase: sede.cuenta_clase,
      distancia_m: sede.distancia_m,
    })),
    medicos: contexto.mis_medicos.map(medico => ({
      id: medico.id,
      nombre: medico.nombre,
      especialidades: [...medico.especialidades],
      sedes: medico.sedes.map(sede => ({ id: sede.id, nombre: sede.nombre })),
    })),
    contactos: contexto.contactos.map(contacto => ({
      id: contacto.id,
      cuenta_id: contacto.cuenta_id,
      sede_id: contacto.sede_id,
      nombre: contacto.nombre,
      cargo: contacto.cargo_texto,
      rol: contacto.rol,
    })),
    subtipos: contexto.subtipos.map(subtipo => ({
      id: subtipo.id,
      codigo: subtipo.codigo,
      nombre: subtipo.nombre,
      roles_sugeridos: [...subtipo.roles_sugeridos],
    })),
  }
}

/** Prompt del sistema para proponer visitas desde una transcripción (salida solo por la herramienta). */
export const PROMPT_PROPUESTA = `Eres el asistente de reporte de visitas de VG (dispositivos médicos, Colombia). Un Ejecutivo Comercial acaba de dictar qué pasó en una o varias visitas. Recibes la transcripción y un CONTEXTO en JSON con la fecha de hoy, sus líneas, las sedes cercanas con su cuenta, los médicos que visita con sus sedes, los contactos de esas cuentas y los subtipos de visita institucional. Devuelve la propuesta SOLO con la herramienta proponer_visitas.

Reglas:
1. Una visita por persona o gestión distinta: médica (un médico) o institucional (una cuenta con subtipo). Una llegada a una clínica puede dejar varias visitas.
2. Usa únicamente ids que estén en el contexto. Si un médico nombrado no está, deja medico_id null, pon el nombre en medico_nombre_dicho y sugerir_crear_medico true. Lo mismo con contacto_nombre_dicho. Nunca inventes terceros, cuentas, sedes ni ids, y nunca escribas números de documento ni teléfonos.
3. Institucional: elige el subtipo por el cargo o rol de la persona (compras, químico farmacéutico, autorizaciones, programación; si no cruza, otro). La cuenta y la sede salen de las sedes cercanas o del contacto.
4. Médica: la sede es una de las del médico; si dictó otra, usa la más probable entre las cercanas o deja sede_id null.
5. Líneas: las que mencione, siempre entre las de la ejecutiva; si no menciona ninguna y tiene una sola, esa.
6. efectiva es false solo si dice que no logró la visita (no estaba, no la atendieron); entonces failure_reason resume el motivo. Conclusión y compromisos: frases cortas con lo dicho; no agregues nada que no haya dicho.
7. next_step_date solo si dio una fecha o un plazo claro, en AAAA-MM-DD a partir de la fecha de hoy del contexto; si no, null.
8. modalidad_sugerida es telefonica solo si dice que llamó o hizo videollamada; si no, presencial.
9. confianza entre 0 y 1 según lo bien que cruzaron los nombres. Haz como mucho una pregunta por visita y solo ante una ambigüedad real (dos médicos con el mismo apellido, sede no clara).
10. Responde en español, sin saludos ni explicaciones fuera de la herramienta.`

/** Esquema JSON (entrada de la herramienta proponer_visitas): lo mismo que propuestaSchema valida después. */
export const esquemaPropuesta = {
  type: 'object',
  additionalProperties: false,
  properties: {
    visitas: {
      type: 'array',
      maxItems: MAX_VISITAS_PROPUESTA,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          tipo: { type: 'string', enum: ['medica', 'institucional'] },
          subtipo_codigo: { type: ['string', 'null'], description: 'Código del subtipo del contexto (institucional); null en médica' },
          medico_id: { type: ['string', 'null'], description: 'Id de un médico del contexto, o null' },
          medico_nombre_dicho: { type: ['string', 'null'], description: 'Nombre tal como lo dictó si no cruzó con el contexto' },
          sugerir_crear_medico: { type: 'boolean' },
          cuenta_id: { type: ['string', 'null'] },
          sede_id: { type: ['string', 'null'] },
          contacto_id: { type: ['string', 'null'] },
          contacto_nombre_dicho: { type: ['string', 'null'] },
          lineas: { type: 'array', items: { type: 'string' }, maxItems: MAX_LINEAS_VISITA, description: 'Ids de líneas de la ejecutiva' },
          efectiva: { type: 'boolean' },
          failure_reason: { type: ['string', 'null'], maxLength: MAX_FAILURE_REASON },
          conclusion: { type: ['string', 'null'], maxLength: MAX_CONCLUSION },
          compromisos: { type: ['string', 'null'], maxLength: MAX_COMPROMISOS },
          next_step_date: { type: ['string', 'null'], pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
          modalidad_sugerida: { type: 'string', enum: ['presencial', 'telefonica'] },
          confianza: { type: 'number', minimum: 0, maximum: 1 },
          preguntas: { type: 'array', items: { type: 'string' }, maxItems: MAX_PREGUNTAS_PROPUESTA },
        },
        required: [
          'tipo',
          'subtipo_codigo',
          'medico_id',
          'medico_nombre_dicho',
          'sugerir_crear_medico',
          'cuenta_id',
          'sede_id',
          'contacto_id',
          'contacto_nombre_dicho',
          'lineas',
          'efectiva',
          'failure_reason',
          'conclusion',
          'compromisos',
          'next_step_date',
          'modalidad_sugerida',
          'confianza',
          'preguntas',
        ],
      },
    },
    aviso: { type: ['string', 'null'], description: 'Un aviso corto para la ejecutiva si algo no cruzó' },
  },
  required: ['visitas', 'aviso'],
} as const

/** Nombre y descripción de la herramienta (la API arma la definición con esquemaPropuesta). */
export const HERRAMIENTA_PROPUESTA = {
  name: 'proponer_visitas',
  description: 'Propone las visitas que describe la transcripción, con ids tomados solo del contexto.',
} as const

/** Lo que devuelve Claude por la herramienta (antes de normalizar). Lo valida propuestaSchema (zod). */
export interface VisitaPropuestaCruda {
  tipo: TipoVisita
  subtipo_codigo: string | null
  medico_id: string | null
  medico_nombre_dicho: string | null
  sugerir_crear_medico: boolean
  cuenta_id: string | null
  sede_id: string | null
  contacto_id: string | null
  contacto_nombre_dicho: string | null
  lineas: string[]
  efectiva: boolean
  failure_reason: string | null
  conclusion: string | null
  compromisos: string | null
  next_step_date: string | null
  modalidad_sugerida: Modalidad
  confianza: number
  preguntas: string[]
}

export interface PropuestaCruda {
  visitas: VisitaPropuestaCruda[]
  aviso: string | null
}

/** Una visita propuesta ya normalizada (PropuestaResponse.visitas[]). */
export interface VisitaPropuesta extends VisitaPropuestaCruda {
  subtipo_id: string | null
}

export interface PropuestaResponse {
  visitas: VisitaPropuesta[]
  aviso: string | null
}

const limpiar = (valor: unknown, max: number): string | null => {
  if (typeof valor !== 'string') return null
  const texto = valor.trim().replace(/\s+/g, ' ')
  return texto ? texto.slice(0, max) : null
}

/** Lo que queda en lugar de un número largo que la IA dejó en un texto (posible documento o teléfono). */
export const NUMERO_OMITIDO = '[número omitido]'

/** 7 dígitos o más, juntos o separados por un espacio, punto o guion (cédulas, teléfonos). */
const NUMERO_LARGO_RE = /\d(?:[ .-]?\d){6,}/g
const FECHA_ISO_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Privacidad (decisión 12 y reglas del dueño): la propuesta nunca devuelve documentos ni teléfonos. Reemplaza en un
 * texto libre cada número de 7 dígitos o más (salvo una fecha AAAA-MM-DD) por NUMERO_OMITIDO. Precio del cuidado: un
 * valor escrito con todas sus cifras ("2.500.000") también se oculta; la ejecutiva lo corrige en la tarjeta.
 */
export function ocultarNumerosLargos(texto: string): string {
  return texto.replace(NUMERO_LARGO_RE, numero => (FECHA_ISO_RE.test(numero) ? numero : NUMERO_OMITIDO))
}

/** Texto libre de la propuesta: limpio, acotado y sin números largos. */
const textoPropuesta = (valor: unknown, max: number): string | null => {
  const texto = limpiar(valor, max)
  return texto === null ? null : ocultarNumerosLargos(texto).slice(0, max)
}

/** Nombre dicho (médico o contacto): sin dígitos (un nombre nunca los lleva; así no se cuela un documento). */
const nombrePropuesta = (valor: unknown): string | null => {
  if (typeof valor !== 'string') return null
  return limpiar(valor.replace(/[0-9]/g, ' '), 120)
}

/**
 * Deja la propuesta usable por la app: descarta todo id que no esté en el contexto (médico, sede, cuenta, contacto,
 * subtipo, líneas), completa subtipo_id, acota textos y confianza, oculta números largos en los textos y quita los
 * dígitos de los nombres dichos, y construye cada visita campo a campo (nunca copia claves desconocidas: ni
 * documentos ni teléfonos salen de aquí).
 */
export function normalizarPropuesta(propuesta: PropuestaCruda, contexto: ContextoResponse): PropuestaResponse {
  const lineasEjecutiva = new Set(contexto.ejecutiva.lineas.map(linea => linea.id))
  const sedesCerca = new Map(contexto.sedes_cerca.map(sede => [sede.id, sede]))
  const medicos = new Map(contexto.mis_medicos.map(medico => [medico.id, medico]))
  const contactos = new Map(contexto.contactos.map(contacto => [contacto.id, contacto]))
  const subtiposPorCodigo = new Map(contexto.subtipos.map(subtipo => [subtipo.codigo, subtipo]))

  const visitas: VisitaPropuesta[] = propuesta.visitas.slice(0, MAX_VISITAS_PROPUESTA).map(cruda => {
    const tipo: TipoVisita = cruda.tipo === 'institucional' ? 'institucional' : 'medica'
    let medico_id: string | null = null
    let cuenta_id: string | null = null
    let sede_id: string | null = null
    let contacto_id: string | null = null
    let subtipo_codigo: string | null = null
    let subtipo_id: string | null = null
    let medico_nombre_dicho = nombrePropuesta(cruda.medico_nombre_dicho)
    let contacto_nombre_dicho: string | null = null
    let sugerir_crear_medico = false

    if (tipo === 'medica') {
      const medico = cruda.medico_id ? medicos.get(cruda.medico_id) : undefined
      if (medico) {
        medico_id = medico.id
        medico_nombre_dicho = null
        const sedeDelMedico = cruda.sede_id ? medico.sedes.find(sede => sede.id === cruda.sede_id) : undefined
        if (sedeDelMedico) sede_id = sedeDelMedico.id
        else if (medico.sedes.length === 1) sede_id = medico.sedes[0].id
      } else {
        sugerir_crear_medico = medico_nombre_dicho !== null
        if (cruda.sede_id && sedesCerca.has(cruda.sede_id)) sede_id = cruda.sede_id
      }
    } else {
      const subtipo = cruda.subtipo_codigo ? subtiposPorCodigo.get(cruda.subtipo_codigo) : undefined
      if (subtipo) {
        subtipo_codigo = subtipo.codigo
        subtipo_id = subtipo.id
      }
      const sede = cruda.sede_id ? sedesCerca.get(cruda.sede_id) : undefined
      const cuentaDicha = cruda.cuenta_id && contexto.sedes_cerca.some(s => s.cuenta_id === cruda.cuenta_id) ? cruda.cuenta_id : null
      if (sede && (cuentaDicha === null || sede.cuenta_id === cuentaDicha)) {
        sede_id = sede.id
        cuenta_id = sede.cuenta_id
      } else {
        cuenta_id = cuentaDicha
        const unicaDeLaCuenta = cuenta_id ? contexto.sedes_cerca.filter(s => s.cuenta_id === cuenta_id) : []
        if (unicaDeLaCuenta.length === 1) sede_id = unicaDeLaCuenta[0].id
      }
      const contacto = cruda.contacto_id ? contactos.get(cruda.contacto_id) : undefined
      if (contacto && (cuenta_id === null || contacto.cuenta_id === cuenta_id)) {
        contacto_id = contacto.id
        if (cuenta_id === null) {
          cuenta_id = contacto.cuenta_id
          const unicaDeLaCuenta = contexto.sedes_cerca.filter(s => s.cuenta_id === cuenta_id)
          if (sede_id === null && unicaDeLaCuenta.length === 1) sede_id = unicaDeLaCuenta[0].id
        }
      } else {
        contacto_nombre_dicho = nombrePropuesta(cruda.contacto_nombre_dicho)
      }
      medico_nombre_dicho = null
    }

    let lineas = Array.from(new Set(cruda.lineas.filter(id => lineasEjecutiva.has(id)))).slice(0, MAX_LINEAS_VISITA)
    if (lineas.length === 0 && contexto.ejecutiva.lineas.length === 1) lineas = [contexto.ejecutiva.lineas[0].id]

    const efectiva = cruda.efectiva !== false
    const confianzaCruda = Number(cruda.confianza)
    const confianza = Number.isFinite(confianzaCruda) ? Math.min(1, Math.max(0, redondear2(confianzaCruda))) : 0
    // Una próxima reunión anterior a hoy (p. ej. "el lunes" mal resuelto) se descarta: nacería como compromiso vencido.
    const next_step_date = esFechaIso(cruda.next_step_date) && cruda.next_step_date >= contexto.hoy.fecha ? cruda.next_step_date : null
    const preguntas = (Array.isArray(cruda.preguntas) ? cruda.preguntas : [])
      .map(pregunta => textoPropuesta(pregunta, 200))
      .filter((pregunta): pregunta is string => pregunta !== null)
      .slice(0, MAX_PREGUNTAS_PROPUESTA)

    return {
      tipo,
      subtipo_codigo,
      subtipo_id,
      medico_id,
      medico_nombre_dicho,
      sugerir_crear_medico,
      cuenta_id,
      sede_id,
      contacto_id,
      contacto_nombre_dicho,
      lineas,
      efectiva,
      failure_reason: efectiva ? null : textoPropuesta(cruda.failure_reason, MAX_FAILURE_REASON),
      conclusion: textoPropuesta(cruda.conclusion, MAX_CONCLUSION),
      compromisos: textoPropuesta(cruda.compromisos, MAX_COMPROMISOS),
      next_step_date,
      modalidad_sugerida: cruda.modalidad_sugerida === 'telefonica' ? 'telefonica' : 'presencial',
      confianza,
      preguntas,
    }
  })

  return { visitas, aviso: textoPropuesta(propuesta.aviso, 300) }
}

// ---------------------------------------------------------------------------------------------
// 8. Tipos de las respuestas de la API (la app los copia en mobile/lib/tipos.ts)
// ---------------------------------------------------------------------------------------------

export interface LineaEjecutiva {
  id: string
  code: string
  name: string
}

export interface EjecutivaContexto {
  id: string
  nombre: string
  zona: string | null
  /** Municipio de la zona base (código DANE de 5 dígitos). */
  municipio: string | null
  lineas: LineaEjecutiva[]
}

export interface HoyContexto {
  fecha: string
  meta: { medica: number; institucional: number }
  hechas: HechasHoy
  cuota_dia_ok: boolean
}

export interface SedeCerca {
  id: string
  nombre: string
  cuenta_id: string | null
  cuenta_nombre: string | null
  cuenta_clase: string | null
  ciudad: string | null
  lat: number
  lng: number
  distancia_m: number
  hospital_id: string | null
  ubicacion_confirmada: boolean
}

export interface SedeDeMedico {
  id: string
  nombre: string
  cuenta_nombre: string | null
  /** Metros desde el punto pedido; null si no se mandó lat/lng o la sede no tiene coordenadas. */
  distancia_m: number | null
}

export interface MedicoContexto {
  id: string
  nombre: string
  especialidades: string[]
  municipality_id: string | null
  /** Líneas por las que ella es su visitante. */
  lineas: string[]
  sedes: SedeDeMedico[]
}

export interface ContactoContexto {
  id: string
  cuenta_id: string
  sede_id: string | null
  nombre: string
  cargo_texto: string | null
  rol: string
}

export interface SubtipoContexto {
  id: string
  codigo: string
  nombre: string
  roles_sugeridos: string[]
}

export interface VozDisponible {
  transcribir: boolean
  proponer: boolean
}

/** GET /api/me/contexto?lat=&lng=&precision= (sin lat/lng: sedes_cerca vacío y mis_medicos sin distancias). */
export interface ContextoResponse {
  ejecutiva: EjecutivaContexto
  hoy: HoyContexto
  config: ConfigContexto
  sedes_cerca: SedeCerca[]
  mis_medicos: MedicoContexto[]
  contactos: ContactoContexto[]
  subtipos: SubtipoContexto[]
  compromisos_vencidos: CompromisoVencido[]
  voz: VozDisponible
}

/** Una visita de la ejecutiva en GET /api/me/visitas (nunca el documento del médico). */
export interface VisitaItem {
  id: string
  client_id: string | null
  tipo: TipoVisita
  subtipo: { id: string; codigo: string; nombre: string } | null
  medico: { id: string; nombre: string } | null
  cuenta: { id: string; nombre: string } | null
  sede: { id: string; nombre: string }
  contacto: { id: string; nombre: string } | null
  modalidad: Modalidad
  medio: MedioTelefonica | null
  efectiva: boolean
  failure_reason: string | null
  checked_in_at: string
  distance_m: number | null
  conclusion: string | null
  compromisos: string | null
  next_step_date: string | null
  lineas: string[]
  input_mode: ModoEntrada
  out_of_territory: boolean
  /** A qué meta suma según el conteo vigente en su fecha (valorReporte); null si no suma (o aún no). */
  cuenta_para: ValorVisita['meta']
  /** Peso con el que suma (con el de la telefónica si lo es); 0 si no suma. */
  peso: number
  /** Efectiva en una sede que data manager aún no confirma: sumará cuando la confirme. */
  sede_por_confirmar: boolean
  /** La ejecutiva puede corregirla o anularla (mismo día). */
  editable: boolean
}

/** GET /api/me/visitas?fecha= */
export interface VisitasResponse {
  fecha: string
  items: VisitaItem[]
}

/** POST /api/me/visitas → 201 (repetida: el mismo client_id ya estaba; nada se duplicó). */
export interface VisitaCreateResponse {
  visita: VisitaItem
  repetida: boolean
}

/** POST /api/me/voz/transcribir */
export interface TranscripcionResponse {
  transcript: string
  duracion_s: number | null
  modelo: string
}

/** GET /api/me/numeros?mes=AAAA-MM (F3: solo KPI 1 y días hábiles sin visitas). */
export interface NumerosResponse {
  mes: string
  cuota: CuotaResponse
  hechas: {
    medica: number
    institucional: number
    subtipos: { subtipo_id: string; nombre: string; hechas: number }[]
  }
  cumplimiento: {
    medica: number | null
    institucional: number | null
    subtipos: { subtipo_id: string; nombre: string; cumplimiento: number | null }[]
  }
  dias_habiles_sin_visitas: number
  telefonicas: number
  no_efectivas: number
  fuera_de_territorio: number
  /** Efectivas en sedes por confirmar (aún no suman). */
  sede_por_confirmar: number
}

/** Pasa el resultado puro de cumplimientoMes a la forma de NumerosResponse. */
export function numerosDesdeCumplimiento(mes: string, cuota: CuotaResponse, resultado: ResultadoCumplimiento): NumerosResponse {
  return {
    mes,
    cuota,
    hechas: {
      medica: resultado.medica.hechas,
      institucional: resultado.institucional.hechas,
      subtipos: resultado.subtipos.map(s => ({ subtipo_id: s.subtipo_id, nombre: s.nombre, hechas: s.hechas })),
    },
    cumplimiento: {
      medica: resultado.medica.cumplimiento,
      institucional: resultado.institucional.cumplimiento,
      subtipos: resultado.subtipos.map(s => ({ subtipo_id: s.subtipo_id, nombre: s.nombre, cumplimiento: s.cumplimiento })),
    },
    dias_habiles_sin_visitas: resultado.dias_sin_visitas,
    telefonicas: resultado.telefonicas,
    no_efectivas: resultado.no_efectivas,
    fuera_de_territorio: resultado.fuera_de_territorio,
    sede_por_confirmar: resultado.sede_por_confirmar,
  }
}

/** Usuario en la respuesta del login móvil y de /api/auth/me. */
export interface UsuarioMovil {
  id: string
  full_name: string
  role: Role
}

/** El Ejecutivo Comercial enlazado con el usuario (no inactivo), con el nombre de su zona. */
export interface EjecutivaMovil {
  id: string
  full_name: string
  zona: string | null
}

/** POST /api/auth/login con { cliente: 'movil' }: el token va en el cuerpo (sin cookie). */
export interface LoginMovilResponse {
  token: string
  /** Instante ISO en que expira el token (7 días). */
  expira_at: string
  usuario: UsuarioMovil
  ejecutiva: EjecutivaMovil | null
}

/** GET /api/auth/me (cookie o portador). `user` es lo que ya usaba la web; `ejecutiva` lo que la app necesita. */
export interface MeResponse {
  user: { id: string; email: string; full_name: string; role: Role; active: boolean }
  ejecutiva: EjecutivaMovil | null
}

/** Respuesta de error de toda la API: { error } y, en la pre-validación de visitas, los errores por campo. */
export interface ErrorResponse {
  error: string
  errores?: ErrorVisita[]
}
