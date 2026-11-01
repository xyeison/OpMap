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
 *   9. Agenda (F4.1, migración 0840): la cita, la ventana de fechas, el vínculo con la visita ("agendada"), el
 *      indicador de Mis números y el dictado por campo (conclusión, compromisos y próxima reunión).
 *      Contrato: sección "F4.1" de docs/fases/fase8-visitas-f3-f4-reporte-y-app-movil.md y la spec
 *      docs/specs/2026-10-14-agenda-dictado-y-marca.md.
 *      Desde F1a (migración 0850, sección "F4.2" del contrato): la persona de campo (lib/persona-campo.ts) y el ciclo de
 *      vida de la cita (lib/agenda-ciclo.ts, que se re-exporta aquí): sin tope hacia adelante, choque de media hora,
 *      cerrar, cancelar con motivo, eliminar por error y otra fecha.
 *
 * Lo que valida la forma de los cuerpos (zod) está en lib/reporte-visitas-schemas.ts.
 */
import type { Role } from './permissions'
import { etiquetaDe, valoresDe, type Opcion } from './terceros'
import { MENSAJE_CITA_OTRO_PAPEL, MENSAJE_MEDICO_AJENO, MENSAJE_SIN_ZONA, type ComoPersona, type RolPersona } from './persona-campo'
import { MENSAJE_CITA_CERRADA, type EstadoCita, type EstadoVisible, type MotivoCierre, type MotivoElegible, type NumerosAgenda } from './agenda-ciclo'
import {
  ESTADOS_DIA_LIBRE_LIBRES,
  MENSAJE_SIN_EJECUTIVA,
  diaSemanaIso,
  esFechaIso,
  generalVigente,
  hoyBogota,
  sumarDias,
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
/** Ejecutivo Comercial sin zona base (definido en lib/persona-campo.ts, re-exportado aquí). */
export { MENSAJE_SIN_ZONA }
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
/** Dueño, 2026-10-30: la visita institucional siempre dice con quién fue (contacto con teléfono o correo). */
export const MENSAJE_CONTACTO_OBLIGATORIO = 'Elige el contacto de la visita institucional'
export const MENSAJE_MEDICO_NO_EXISTE = 'Ese médico no existe o está inactivo'
export const MENSAJE_SEDE_NO_DEL_MEDICO = 'El médico no atiende en esa sede'
export const MENSAJE_SEDE_NO_DE_LA_CUENTA = 'Esa sede no es de la cuenta elegida'
export const MENSAJE_SUBTIPO_NO_VIGENTE = 'Ese subtipo no está vigente'
export const MENSAJE_CONTACTO_OTRA_CUENTA = 'Ese contacto no es de la cuenta elegida'
export const MENSAJE_LINEAS_AJENAS = 'Alguna de las líneas no es tuya'
export const MENSAJE_VISITA_NO_EDITABLE = 'Solo puedes corregir o anular tus visitas del mismo día'

// --- App sin señal (0940, dueño 2026-10-30: "no bloquees a nadie por sospechas, solo deja las marcas") ---------

/**
 * Marcas que deja visitas_registrar (0940) en visits.marcas. Nunca bloquean: alimentan el tablero y el mapa de calor.
 *   en_sitio: (distancia a la sede − precisión del GPS) ≤ radio vigente · lejos_de_ips: lo contrario · sin_ubicacion:
 *   presencial sin GPS · precision_baja: más de PRECISION_BAJA_M · ips_sin_coordenadas: la sede no tiene lat/lng ·
 *   hora_inconsistente: hora del teléfono posterior a la llegada al servidor (más de la tolerancia) o visita de más de
 *   DIAS_MAX_ATRAS días · medico_por_validar: médica con "médico no listado" (nombre y especialidad, sin medico_id).
 */
export const MARCAS_VISITA = [
  { valor: 'en_sitio', etiqueta: 'En sitio' },
  { valor: 'lejos_de_ips', etiqueta: 'Lejos de la IPS' },
  { valor: 'sin_ubicacion', etiqueta: 'Sin ubicación' },
  { valor: 'precision_baja', etiqueta: 'Precisión baja' },
  { valor: 'ips_sin_coordenadas', etiqueta: 'IPS sin coordenadas' },
  { valor: 'hora_inconsistente', etiqueta: 'Hora inconsistente' },
  { valor: 'medico_por_validar', etiqueta: 'Médico por validar' },
] as const
export type MarcaVisita = (typeof MARCAS_VISITA)[number]['valor']
export const VALORES_MARCA_VISITA: readonly MarcaVisita[] = MARCAS_VISITA.map(marca => marca.valor)
export const etiquetaMarca = (valor: string | null | undefined) => MARCAS_VISITA.find(marca => marca.valor === valor)?.etiqueta ?? (valor ?? '')
/** Precisión del GPS (metros) desde la que la visita queda 'precision_baja'. */
export const PRECISION_BAJA_M = 100
/** Una visita con más de estos días (visit_date frente a hoy en Bogotá) queda 'hora_inconsistente'. */
export const DIAS_MAX_ATRAS = 7
/** Radio de "en sitio" por defecto desde la 0940 (radio_presencial_m: 300 m; antes 500 m de rechazo). */
export const RADIO_EN_SITIO_POR_DEFECTO_M = 300
export const MAX_NOMBRE_MEDICO_NO_LISTADO = 200
export const MAX_ESPECIALIDAD_MEDICO_NO_LISTADO = 60
export const MENSAJE_MEDICO_NO_LISTADO_SIN_NOMBRE = 'Escribe el nombre del médico no listado'
export const MENSAJE_MEDICO_DOS_VECES = 'Manda el médico de OpMap o el médico no listado, no los dos'
export const MENSAJE_MOTIVO_NO_EFECTIVA_NO_VALIDO = 'Motivo de la visita no efectiva no válido'
/** Sin GPS y la sede sin coordenadas ni municipio ubicado: el único rechazo por ubicación que queda (visits.lat NOT NULL). */
export const MENSAJE_SIN_PUNTO_PARA_EL_MAPA = 'Sin ubicación del teléfono, la sede no tiene coordenadas ni municipio ubicado: toma la ubicación o elige otra sede'

// --- Foto de la visita (0940): JPEG comprimido en el teléfono (1600 px, 70 %), hasta 2 MB, bucket privado ----------
export const FOTO_BUCKET = 'visitas-fotos'
export const FOTO_MAX_BYTES = 2 * 1024 * 1024
export const FOTO_TIPOS = ['image/jpeg', 'image/jpg'] as const
export const MENSAJE_FOTO_FORMATO = 'La foto debe ser JPEG'
export const MENSAJE_FOTO_TAMANO = `La foto no puede superar ${FOTO_MAX_BYTES / (1024 * 1024)} MB`
export const MENSAJE_FOTO_FALTA = 'Falta la foto (campo "foto")'
export const MENSAJE_FOTO_VISITA = 'Esa visita no existe o no es tuya'
/** Segundos que vale el enlace firmado para ver la foto. */
export const FOTO_ENLACE_SEGUNDOS = 600

/** Revisa la foto que llega por multipart (tipo y tamaño). Puro: null si sirve, el mensaje si no. */
export function revisarFoto(foto: { type: string; size: number } | null | undefined): string | null {
  if (!foto) return MENSAJE_FOTO_FALTA
  const mime = (foto.type || '').split(';')[0].trim().toLowerCase()
  if (!(FOTO_TIPOS as readonly string[]).includes(mime)) return MENSAJE_FOTO_FORMATO
  if (foto.size <= 0) return MENSAJE_FOTO_FALTA
  if (foto.size > FOTO_MAX_BYTES) return MENSAJE_FOTO_TAMANO
  return null
}

/** Ruta de la foto en el bucket: por persona y visita (client_id), siempre .jpg; la segunda subida la reemplaza. */
/** JPEG de verdad: los bytes empiezan por FF D8 FF (el tipo que declara el cliente no basta). */
export function esJpeg(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
}

export function rutaFoto(userId: string, clientId: string): string {
  return `${userId}/${clientId}.jpg`
}

/** Médico que no está en OpMap, escrito en la visita (0940). Quien tiene terceros:create lo crea o lo cruza después. */
export interface MedicoNoListado {
  nombre: string
  especialidad: string | null
}

/** Un motivo de la lista cerrada de la visita no efectiva (motivos_no_efectiva, 0940). */
export interface MotivoNoEfectiva {
  codigo: string
  nombre: string
}

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
  /**
   * Cita de la agenda que se cumple con esta visita (0840; opcional: null). Sin ella, la base vincula sola la cita
   * pendiente de ese día con el mismo médico o la misma cuenta. Una cita ajena, de otro día, de otro médico o cuenta,
   * cancelada o ya hecha se rechaza (23514 → 400).
   */
  agenda_id: string | null
  /** 0940: zona horaria del teléfono (IANA); null si la app no la manda (app anterior). */
  tz: string | null
  /** 0940: hora de la lectura del GPS con que va lat/lng (ISO con zona); null sin GPS o app anterior. */
  gps_at: string | null
  /** 0940: motivo de la lista cerrada (motivos_no_efectiva.codigo) de la no efectiva; null con texto libre o efectiva. */
  motivo_codigo: string | null
}

/**
 * Médica: con el médico de OpMap (medico_id) o, desde la 0940, con el "médico no listado" (nombre y especialidad):
 * exactamente uno de los dos.
 */
export type VisitaCreateTipo =
  | { tipo: 'medica'; medico_id: string | null; medico_no_listado: MedicoNoListado | null; cuenta_id: null; subtipo_id: null; contacto_id: null }
  | { tipo: 'institucional'; medico_id: null; medico_no_listado: null; cuenta_id: string; subtipo_id: string; contacto_id: string | null }

/** Presencial: desde la 0940 puede ir SIN ubicación (lat y lng null → marca 'sin_ubicacion'); si trae una, trae las dos. */
export type VisitaCreateModalidad =
  | { modalidad: 'presencial'; lat: number | null; lng: number | null; medio: null }
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
  /**
   * 0850 (C9): el médico es de las líneas de la visita (medico_de_lineas). Solo se mira en una visita como líder (sin
   * Ejecutivo Comercial): false → "Ese médico no es de tus líneas". Sin el dato: no se mira.
   */
  de_mis_lineas?: boolean
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
  /**
   * La persona que reporta (0850: la persona de campo). `lineas`: TODAS las suyas (persona_lineas); `con_zona`: la zona
   * de su Ejecutivo Comercial (no se mira en una visita como líder).
   */
  ejecutiva: { id: string; activa: boolean; con_zona: boolean; lineas: readonly string[] }
  sede: SedeValidacion | null
  medico: MedicoValidacion | null
  subtipo: SubtipoValidacion | null
  contacto: ContactoValidacion | null
  /**
   * 0850: la visita es "como líder" (ninguna de sus líneas es de su Ejecutivo Comercial, o no lo tiene): sin zona, sin
   * fuera de territorio y con el médico de sus líneas (C9). Sin el dato: como Ejecutivo Comercial (como hasta la 0840).
   */
  como_lider?: boolean
  /** 0940: códigos activos de motivos_no_efectiva. Sin el dato no se revisa el motivo (lo hace la base). */
  motivos?: readonly string[]
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
  /** Metros a la sede (presencial con GPS y sede ubicada); null si no aplica. */
  distance_m: number | null
  /** Médica a un médico del que no es visitante (suma a su meta, queda marcada). */
  out_of_territory: boolean
  /** 0940: las marcas que dejará la base (la misma regla: marcasDeVisita). */
  marcas: MarcaVisita[]
  /** 0940: (distancia − precisión) ≤ radio; null sin distancia. */
  en_sitio: boolean | null
}

/** Lo que mira marcasDeVisita (todo opcional salvo la modalidad). */
export interface EntradaMarcas {
  modalidad: Modalidad
  /** Punto del teléfono (null sin GPS). */
  punto: Punto | null
  /** Precisión del GPS en metros (null si no se sabe). */
  precision: number | null
  /** La sede elegida (null si no existe); sin lat/lng = sin coordenadas. */
  sede: { lat: number | null; lng: number | null } | null
  radio_m: number
  checked_in_at: string
  reported_at: string
  /** Reloj del servidor (la llegada al servidor). */
  ahora: Date
  /** Hoy en Bogotá (de `ahora`); por defecto se calcula. */
  hoy?: string
  /** Médica con médico no listado (sin medico_id). */
  medico_no_listado: boolean
}

export interface ResultadoMarcas {
  marcas: MarcaVisita[]
  distance_m: number | null
  en_sitio: boolean | null
}

/**
 * ESPEJO de las marcas de visitas_registrar (0940), en el mismo orden en que la base las agrega. La misma función la
 * usan validarVisita (la API) y la app (mobile/lib/propuesta.ts marcasPrevistas, copia) para mostrarlas antes de
 * confirmar. Puro.
 */
export function marcasDeVisita(entrada: EntradaMarcas): ResultadoMarcas {
  const marcas: MarcaVisita[] = []
  const hoy = entrada.hoy ?? hoyBogota(entrada.ahora)
  const ahoraMs = entrada.ahora.getTime()
  const llegadaMs = Date.parse(entrada.checked_in_at)
  const reporteMs = Date.parse(entrada.reported_at)
  const tolerancia = TOLERANCIA_RELOJ_SEGUNDOS * 1000
  const fecha = Number.isNaN(llegadaMs) ? null : fechaBogota(entrada.checked_in_at)
  const limite = sumarDiasIso(hoy, -DIAS_MAX_ATRAS)
  if ((!Number.isNaN(llegadaMs) && llegadaMs > ahoraMs + tolerancia) || (!Number.isNaN(reporteMs) && reporteMs > ahoraMs + tolerancia) || (fecha !== null && fecha < limite)) {
    marcas.push('hora_inconsistente')
  }
  if (entrada.medico_no_listado) marcas.push('medico_por_validar')
  let distance_m: number | null = null
  let en_sitio: boolean | null = null
  if (entrada.modalidad === 'presencial') {
    const conGps = !!entrada.punto && esPunto(entrada.punto.lat, entrada.punto.lng)
    // La base redondea la precisión a metros enteros (round(...)::integer): aquí igual, para marcar lo mismo.
    const precision = entrada.precision === null || !Number.isFinite(entrada.precision) ? null : Math.round(entrada.precision)
    if (!conGps) marcas.push('sin_ubicacion')
    else if (precision !== null && precision > PRECISION_BAJA_M) marcas.push('precision_baja')
    const sedeUbicada = !!entrada.sede && esPunto(entrada.sede.lat, entrada.sede.lng)
    if (entrada.sede && !sedeUbicada) marcas.push('ips_sin_coordenadas')
    else if (sedeUbicada && conGps) {
      distance_m = haversineM(entrada.punto as Punto, { lat: entrada.sede!.lat as number, lng: entrada.sede!.lng as number })
      en_sitio = Math.max(distance_m - (precision ?? 0), 0) <= entrada.radio_m
      if (!en_sitio) marcas.push('lejos_de_ips')
    }
  }
  return { marcas, distance_m, en_sitio }
}

/** AAAA-MM-DD ± n días (sin zona: fechas de calendario). */
function sumarDiasIso(fecha: string, n: number): string {
  const [a, m, d] = fecha.split('-').map(Number)
  const fechaUtc = new Date(Date.UTC(a, m - 1, d + n))
  return fechaUtc.toISOString().slice(0, 10)
}

/**
 * Espejo de los pasos 2 a 7 de visitas_registrar. Devuelve TODOS los errores que encuentra (la base lanza el
 * primero); `hoy` es la fecha de Bogotá de `ahora` (por defecto, ahora mismo). Nunca escribe nada.
 *
 * El paso 1 (idempotencia) NO está aquí: quien llama debe buscar antes el client_id y, si ya existe, devolver esa
 * visita con `repetida: true` SIN validar (un reintento de la cola sin señal, o una visita que ya llenó el tope, no
 * debe convertirse en un 400). Por si acaso, las visitas de `visitasDeHoy` con el mismo client_id no cuentan para los
 * topes. `visitasDeHoy` = las de ella con visit_date = la fecha de la visita y deleted_at NULL.
 *
 * 0940 (dueño, 2026-10-30): ya NO rechaza por otro día, por el radio, por falta de GPS ni por sede sin coordenadas: eso
 * son MARCAS (marcasDeVisita). Siguen rechazando perfil, topes, líneas ajenas, médico que no atiende en la sede,
 * reporte anterior a la llegada y textos. Médica con medico_id o con medico_no_listado (exactamente uno).
 */
export function validarVisita(entrada: {
  datos: VisitaCreate
  contexto: ContextoValidacion
  config: ConfigContexto
  hoy?: string
  ahora?: Date
  /** 0940: la fecha (Bogotá) de la visita; con otro día aceptado, el subtipo se mira en ESA fecha (como la base). Por defecto, hoy. */
  fechaVisita?: string
  visitasDeHoy: readonly VisitaDeHoy[]
}): ResultadoValidacion {
  const { datos, contexto, config } = entrada
  const ahora = entrada.ahora ?? new Date()
  const hoy = entrada.hoy ?? hoyBogota(ahora)
  const fechaReglas = entrada.fechaVisita ?? hoy
  const visitasDeHoy = entrada.visitasDeHoy.filter(visita => !visita.client_id || visita.client_id !== datos.client_id)
  const errores: ErrorVisita[] = []
  const falla = (campo: string, mensaje: string) => errores.push({ campo, mensaje })
  let out_of_territory = false

  // 2. Persona activa; con Ejecutivo Comercial, con zona (como líder no hay zona); reporte no anterior a la llegada
  if (!contexto.ejecutiva.activa) falla('executive_id', MENSAJE_SIN_EJECUTIVA)
  else if (!contexto.como_lider && !contexto.ejecutiva.con_zona) falla('executive_id', MENSAJE_SIN_ZONA)

  const llegadaMs = Date.parse(datos.checked_in_at)
  const reporteMs = Date.parse(datos.reported_at)
  if (!esInstanteIso(datos.checked_in_at) || Number.isNaN(llegadaMs)) falla('checked_in_at', 'La hora de llegada no es válida')
  if (!esInstanteIso(datos.reported_at) || Number.isNaN(reporteMs)) falla('reported_at', 'La hora del reporte no es válida')
  else if (!Number.isNaN(llegadaMs) && reporteMs < llegadaMs) falla('reported_at', MENSAJE_REPORTE_ANTES_DE_LLEGADA)

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

  const noListado = datos.tipo === 'medica' && datos.medico_no_listado !== null
  if (datos.tipo === 'medica' && !datos.medico_id && !datos.medico_no_listado) falla('medico_id', 'Elige el médico')
  else if (datos.tipo === 'medica' && datos.medico_id && datos.medico_no_listado) falla('medico_id', MENSAJE_MEDICO_DOS_VECES)
  else if (datos.tipo === 'medica' && noListado) {
    // 0940: médico no listado: nombre obligatorio; nadie lo busca en OpMap; queda 'medico_por_validar'.
    if (!datos.medico_no_listado?.nombre.trim()) falla('medico_no_listado', MENSAJE_MEDICO_NO_LISTADO_SIN_NOMBRE)
  } else if (datos.tipo === 'medica') {
    const medico = contexto.medico && contexto.medico.id === datos.medico_id ? contexto.medico : null
    if (!medico || !medico.activo) falla('medico_id', MENSAJE_MEDICO_NO_EXISTE)
    else {
      if (sede && !medico.sede_ids.includes(sede.id)) falla('sede_id', MENSAJE_SEDE_NO_DEL_MEDICO)
      if (contexto.como_lider) {
        // Como líder (0850, C9): solo médicos de sus líneas; nunca fuera de territorio.
        if (medico.de_mis_lineas === false) falla('medico_id', MENSAJE_MEDICO_AJENO)
      } else {
        out_of_territory = !medico.es_visitante
      }
    }
  } else {
    if (sede && sede.cuenta_id !== datos.cuenta_id) falla('cuenta_id', MENSAJE_SEDE_NO_DE_LA_CUENTA)
    const subtipo = contexto.subtipo && contexto.subtipo.id === datos.subtipo_id ? contexto.subtipo : null
    if (!subtipo || !subtipoVigenteEn(subtipo, fechaReglas)) falla('subtipo_id', MENSAJE_SUBTIPO_NO_VIGENTE)
    // Dueño, 2026-10-30: siempre con quién fue (un contacto activo de la cuenta, con teléfono o correo)
    if (!datos.contacto_id) falla('contacto_id', MENSAJE_CONTACTO_OBLIGATORIO)
    else {
      const contacto = contexto.contacto && contexto.contacto.id === datos.contacto_id ? contexto.contacto : null
      if (!contacto || contacto.cuenta_id !== datos.cuenta_id) falla('contacto_id', MENSAJE_CONTACTO_OTRA_CUENTA)
      else if (contacto.activo === false) falla('contacto_id', MENSAJE_CONTACTO_INACTIVO)
    }
  }

  // 5. Modalidad. Presencial (0940): la ubicación, el radio y las coordenadas de la sede ya no rechazan: marcan.
  //    Único rechazo que queda: sin GPS y con una sede sin coordenadas (la base no tendría punto para el mapa salvo el
  //    municipio o la zona; aquí no se conocen, así que lo decide la base).
  const punto = datos.modalidad === 'presencial' && esPunto(datos.lat, datos.lng) ? { lat: datos.lat as number, lng: datos.lng as number } : null
  const resultadoMarcas = marcasDeVisita({
    modalidad: datos.modalidad,
    punto,
    precision: datos.gps_accuracy_m,
    sede: sede ? { lat: sede.lat, lng: sede.lng } : null,
    radio_m: config.radio_m,
    checked_in_at: datos.checked_in_at,
    reported_at: datos.reported_at,
    ahora,
    hoy,
    medico_no_listado: noListado,
  })
  if (datos.modalidad === 'telefonica') {
    if (!config.telefonica.habilitada) falla('modalidad', MENSAJE_TELEFONICA_NO_HABILITADA)
    else {
      if (!config.telefonica.medios.includes(datos.medio)) falla('medio', mensajeMedio(config.telefonica.medios))
      const telefonicasHoy = visitasDeHoy.filter(v => v.modalidad === 'telefonica' && v.efectiva).length
      if (telefonicasHoy >= config.telefonica.tope_dia) falla('modalidad', mensajeTopeTelefonicas(config.telefonica.tope_dia))
    }
  }

  // 5b. Motivo de la lista (0940): si viene y se conoce la lista, debe estar en ella.
  if (!datos.efectiva && datos.motivo_codigo && contexto.motivos && !contexto.motivos.includes(datos.motivo_codigo)) {
    falla('motivo_codigo', MENSAJE_MOTIVO_NO_EFECTIVA_NO_VALIDO)
  }

  // 6. Tope por médico (solo efectivas, con médico de OpMap)
  if (datos.tipo === 'medica' && datos.efectiva && datos.medico_id) {
    const alMedicoHoy = visitasDeHoy.filter(v => v.efectiva && v.medico_id === datos.medico_id).length
    if (alMedicoHoy >= config.tope_visitas_medico_dia) falla('medico_id', MENSAJE_TOPE_MEDICO)
  }

  // 7. Líneas: al menos una (el esquema) y todas de la ejecutiva
  if (datos.lineas.length === 0) falla('lineas', 'Elige al menos una línea')
  else if (datos.lineas.some(id => !contexto.ejecutiva.lineas.includes(id))) falla('lineas', MENSAJE_LINEAS_AJENAS)

  return { ok: errores.length === 0, errores, distance_m: resultadoMarcas.distance_m, out_of_territory, marcas: resultadoMarcas.marcas, en_sitio: resultadoMarcas.en_sitio }
}

/** ¿El subtipo rige en esa fecha? */
export function subtipoVigenteEn(subtipo: { vigente_desde: string; vigente_hasta: string | null }, fecha: string): boolean {
  return subtipo.vigente_desde <= fecha && (subtipo.vigente_hasta === null || fecha <= subtipo.vigente_hasta)
}

/**
 * ¿La persona puede corregir o anular la visita? Solo las de la app, suyas (0850: por user_id, la persona que la
 * reportó, con o sin Ejecutivo Comercial), no anuladas y de hoy.
 */
export function visitaEditable(
  visita: { source: FuenteVisita; user_id: string | null; visit_date: string; deleted_at: string | null },
  userId: string,
  hoy: string
): boolean {
  return visita.source === 'app' && visita.user_id === userId && visita.deleted_at === null && visita.visit_date === hoy
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
  /** Citas PENDIENTES de hoy (0840): con quién, en qué sede y a qué hora. */
  agenda: CitaDictado[]
  /** La cita que la ejecutiva eligió antes de dictar (una de `agenda`), o null. */
  cita_elegida: string | null
}

/** Una cita pendiente de hoy, como la recibe Claude (sin documentos ni teléfonos). */
export interface CitaDictado {
  id: string
  hora: string | null
  tipo: TipoVisita
  /** Nombre del médico o de la cuenta. */
  con: string
  medico_id: string | null
  cuenta_id: string | null
  subtipo_codigo: string | null
  sede_id: string
  sede: string
}

/**
 * El JSON compacto que recibe Claude. `hora` es la del dictado en Bogotá (HH:MM) si se conoce. `citaId`: la cita que
 * la ejecutiva eligió en Reportar (solo cuenta si es una de las pendientes de hoy).
 */
export function contextoDictado(contexto: ContextoResponse, hora: string | null = null, citaId: string | null = null): ContextoDictado {
  const agenda: CitaDictado[] = (contexto.agenda_hoy ?? [])
    .filter(cita => cita.estado === 'pendiente')
    .map(cita => ({
      id: cita.id,
      hora: cita.hora,
      tipo: cita.tipo,
      con: cita.medico?.nombre ?? cita.cuenta?.nombre ?? 'Cita',
      medico_id: cita.medico?.id ?? null,
      cuenta_id: cita.cuenta?.id ?? null,
      subtipo_codigo: cita.subtipo?.codigo ?? null,
      sede_id: cita.sede.id,
      sede: cita.sede.nombre,
    }))
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
    agenda,
    cita_elegida: citaId && agenda.some(cita => cita.id === citaId) ? citaId : null,
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
10. Responde en español, sin saludos ni explicaciones fuera de la herramienta.
11. Agenda: el contexto trae las citas pendientes de hoy (agenda), con el médico o la cuenta, el subtipo y la sede. Puedes usar sus ids aunque no estén en las otras listas. Si cita_elegida no es null, la ejecutiva está en esa cita: la primera visita es la de esa cita (su médico, o su cuenta y subtipo, y su sede) salvo que el dictado diga claramente otra cosa.`

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
  // Ids permitidos: los de las sedes cercanas y los médicos que visita, MÁS los de sus citas pendientes de hoy (0840: el
  // médico de una cita puede no estar entre "sus médicos"; la sede de una cita puede quedar a más de 1 km del punto).
  const citasPendientes = (contexto.agenda_hoy ?? []).filter(cita => cita.estado === 'pendiente')
  const sedesPermitidas: { id: string; cuenta_id: string | null }[] = contexto.sedes_cerca.map(sede => ({ id: sede.id, cuenta_id: sede.cuenta_id }))
  for (const cita of citasPendientes) {
    if (!sedesPermitidas.some(sede => sede.id === cita.sede.id)) sedesPermitidas.push({ id: cita.sede.id, cuenta_id: cita.sede.cuenta_id })
  }
  const sedesCerca = new Map(sedesPermitidas.map(sede => [sede.id, sede]))
  const medicos = new Map<string, { id: string; sedes: { id: string }[] }>(
    contexto.mis_medicos.map(medico => [medico.id, { id: medico.id, sedes: medico.sedes.map(sede => ({ id: sede.id })) }])
  )
  for (const cita of citasPendientes) {
    if (cita.tipo !== 'medica' || !cita.medico) continue
    const medico = medicos.get(cita.medico.id) ?? { id: cita.medico.id, sedes: [] }
    if (!medico.sedes.some(sede => sede.id === cita.sede.id)) medico.sedes.push({ id: cita.sede.id })
    medicos.set(medico.id, medico)
  }
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
  /** 0940 (app sin señal): la cuenta y las coordenadas, para que la app mida distancias y arme la institucional sin red. */
  cuenta_id: string | null
  lat: number | null
  lng: number | null
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

/** Una línea de la persona de campo y "como qué" la lleva (0850): como Ejecutivo Comercial o como líder. */
export interface LineaPersona {
  id: string
  nombre: string
  como: ComoPersona
}

/** La persona de campo en GET /api/auth/me (0850); null para la dirección comercial o un usuario sin líneas. */
export interface PersonaMovil {
  rol: RolPersona
  lineas: LineaPersona[]
}

/** La persona de campo en el contexto (0850). */
export interface PersonaContexto extends PersonaMovil {
  user_id: string
  /** users.full_name. */
  nombre: string
  /** Su Ejecutivo Comercial activo, o null (líder sin Ejecutivo Comercial). */
  executive_id: string | null
}

/** GET /api/me/contexto?lat=&lng=&precision= (sin lat/lng: sedes_cerca vacío y mis_medicos sin distancias). */
export interface ContextoResponse {
  /**
   * Quien reporta, en la forma de la 0840 (la app de hoy la lee). Desde la 0850, sin Ejecutivo Comercial (una líder):
   * id = el del usuario, su nombre, sin zona ni municipio y sus líneas de líder. Las líneas son siempre TODAS las suyas.
   */
  ejecutiva: EjecutivaContexto
  hoy: HoyContexto
  config: ConfigContexto
  sedes_cerca: SedeCerca[]
  mis_medicos: MedicoContexto[]
  contactos: ContactoContexto[]
  subtipos: SubtipoContexto[]
  compromisos_vencidos: CompromisoVencido[]
  voz: VozDisponible
  /**
   * Citas de hoy (pendientes y hechas; sin las canceladas), con la distancia a su sede si se mandó el punto: con punto,
   * la más cercana primero; sin punto, por hora. Sin la 0840 aplicada: [] (el resto del contexto sigue igual).
   */
  agenda_hoy: CitaItem[]
  /** 0850: la persona de campo (papel y líneas con "como qué"). */
  persona: PersonaContexto
  /** 0940: la lista cerrada de motivos de la visita no efectiva (la app la guarda para trabajar sin señal). */
  motivos_no_efectiva: MotivoNoEfectiva[]
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
  /** Cita de la agenda que cumplió (0840); null si fue una visita no agendada. */
  agenda_id: string | null
  /** Agendada (decisión 6 de F4.1): vinculada a una cita creada ANTES del día de la visita (Bogotá). */
  agendada: boolean
  /** 0940: marcas del servidor (nunca bloquean). Un servidor anterior no las manda: la app las trata como []. */
  marcas: MarcaVisita[]
  /** 0940: (distancia − precisión) ≤ radio; null sin distancia. */
  en_sitio: boolean | null
  /** 0940: precisión del GPS con que se reportó (metros); null sin GPS. */
  gps_accuracy_m: number | null
  /** 0940: médico no listado (médica sin medico_id); null si no. */
  medico_no_listado: MedicoNoListado | null
  /** 0940: motivo de lista de la no efectiva; null con texto libre o efectiva. */
  motivo_codigo: string | null
  /** 0940: la visita tiene foto en el bucket. */
  foto: boolean
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
  /** null sin Ejecutivo Comercial (una líder: no tiene cuota de visitas, C4). */
  cuota: CuotaResponse | null
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
  /** Indicador de la agenda del mes (decisión 8 de F4.1); null si la agenda aún no está disponible (falta la 0840). */
  agenda: NumerosAgenda | null
}

/** Pasa el resultado puro de cumplimientoMes (y el de cuentasAgenda) a la forma de NumerosResponse. */
export function numerosDesdeCumplimiento(
  mes: string,
  cuota: CuotaResponse | null,
  resultado: ResultadoCumplimiento,
  agenda: NumerosAgenda | null = null
): NumerosResponse {
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
    agenda,
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
  /** 0850: la persona de campo, o null (la dirección comercial, A1, o un usuario sin líneas). */
  persona: PersonaMovil | null
  /**
   * Por qué no hay persona, cuando el servidor lo sabe: MENSAJE_SIN_LINEAS (un usuario sin líneas). La app no entra a
   * las pestañas y lo muestra. null con persona, para quien no reporta (la dirección comercial, que la app reconoce por
   * su rol) o si la base falló. (Los Ejecutivos Comerciales usan la app desde el 2026-10-31.)
   */
  sin_persona: string | null
  /** Equipo (2026-10-31): el rol tiene team:view (dirección, administrador, líder): la app le da la pestaña Equipo. */
  supervisa: boolean
}

/** Respuesta de error de toda la API: { error } y, en la pre-validación de visitas, los errores por campo. */
export interface ErrorResponse {
  error: string
  errores?: ErrorVisita[]
}

// ---------------------------------------------------------------------------------------------
// 9. Agenda (F4.1, migración 0840): la cita, la ventana de fechas, el vínculo con la visita, el indicador y el
//    dictado por campo. Contrato: sección "F4.1" de docs/fases/fase8-visitas-f3-f4-reporte-y-app-movil.md.
//    Las reglas que escriben están en agenda_crear, agenda_cancelar y visitas_registrar (0840); aquí está su espejo
//    puro (para las pruebas, la API y lo que la app copia).
// ---------------------------------------------------------------------------------------------

/**
 * Estados de la cita (5 desde la 0850: pendiente, hecha, no_realizada, cancelada y eliminada), motivos de cierre y las
 * reglas del ciclo de vida: lib/agenda-ciclo.ts, re-exportado aquí para quien ya importaba de este archivo.
 */
export {
  ESTADOS_CITA,
  MOTIVOS_CIERRE,
  VALORES_ESTADO_CITA,
  VALORES_MOTIVO_ELEGIBLE,
  agendaChoca,
  citaCancelable,
  citaCerrable,
  citaEliminable,
  cuentasAgenda,
  estadoVisible,
  mensajeChoque,
  mensajeHoraCita,
  origenParaOtraFecha,
  revisarVisitaConOtraFecha,
} from './agenda-ciclo'
export type { CitaConSucesora, EstadoCita, EstadoVisible, MotivoCierre, MotivoElegible, NumerosAgenda } from './agenda-ciclo'

/** Límites (mismos CHECK de la 0840). */
export const MAX_NOTA_CITA = 300
export const MAX_MOTIVO_CANCELACION_CITA = 300
// Sin tope para agendar hacia adelante desde la 0850 (A4): ya no hay DIAS_AGENDA_ADELANTE.
/** GET /api/me/agenda sin fechas: de hoy a hoy + 7. */
export const DIAS_AGENDA_POR_DEFECTO = 7
/** GET /api/me/agenda: como mucho 31 días por consulta (desde y hasta incluidos). */
export const MAX_DIAS_CONSULTA_AGENDA = 31

/** Mensajes de agenda_crear y agenda_cancelar (23514, salvo los repetidos: 23505 → 409; inexistente: P0002 → 404). */
export const MENSAJE_CITA_PASADA = 'No se agenda en el pasado: elige hoy o una fecha posterior'
export const MENSAJE_CITA_DIA_LIBRE = 'Ese día lo tienes libre (día libre aprobado): no se agenda'
export const MENSAJE_CITA_REPETIDA_MEDICO = 'Ya tienes una cita con ese médico ese día'
export const MENSAJE_CITA_REPETIDA_CUENTA = 'Ya tienes una cita con esa cuenta y ese subtipo ese día'
export const MENSAJE_CITA_NO_EXISTE = 'Esa cita no existe'
export const MENSAJE_CITA_YA_CANCELADA = 'Esa cita ya está cancelada'
export const MENSAJE_CITA_HECHA_NO_SE_CANCELA = 'Esa cita ya tiene su visita: no se cancela'
export const MENSAJE_CITA_PASADA_NO_SE_CANCELA = 'Solo se cancelan las citas de hoy en adelante'
/**
 * Decisión del dueño 2026-10-15 (docs/decisiones/2026-10-15-agenda-con-hora-y-calendario.md): toda cita NUEVA lleva
 * hora. La exige citaCreateSchema (sin hora, '' o null → 400 con este mensaje en `hora`); la base sigue aceptando NULL y
 * las citas viejas sin hora siguen válidas. La app (mobile/lib/agenda.ts) usa el mismo texto.
 */
export const MENSAJE_HORA_OBLIGATORIA = 'Elige la hora de la cita'

/** Mensajes de visitas_registrar (23514) cuando la visita trae un agenda_id que no sirve (decisión 7). */
export const MENSAJE_CITA_AJENA = 'Esa cita no existe o no es tuya'
export const MENSAJE_CITA_CANCELADA = 'Esa cita está cancelada'
export const MENSAJE_CITA_YA_HECHA = 'Esa cita ya tiene su visita'
export const MENSAJE_CITA_OTRO_DIA = 'Esa cita es de otro día'
export const MENSAJE_CITA_OTRO_TIPO = 'Esa cita es de otro tipo de visita'
export const MENSAJE_CITA_OTRO_MEDICO = 'Esa cita es con otro médico'
export const MENSAJE_CITA_OTRA_CUENTA = 'Esa cita es con otra cuenta'

const HORA_RE = /^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d(\.\d+)?)?$/

/** Hora HH:MM de un texto "HH:MM" o "HH:MM:SS" (lo que devuelve PostgreSQL para time), o null. */
export function horaCorta(valor: unknown): string | null {
  if (typeof valor !== 'string') return null
  const coincide = HORA_RE.exec(valor.trim())
  return coincide ? `${coincide[1]}:${coincide[2]}` : null
}

/** Cuerpo de POST /api/me/agenda (ya validado por citaCreateSchema): tipo discriminado como la visita. */
export interface CitaCreateBase {
  /** AAAA-MM-DD, de hoy en adelante, sin tope (A4, 0850; Bogotá); no en un día libre aprobado. */
  fecha: string
  /** HH:MM, obligatoria desde el 2026-10-15 (MENSAJE_HORA_OBLIGATORIA); de hoy, no una hora que ya pasó (C13). */
  hora: string
  sede_id: string
  /** Hasta 300 caracteres (opcional). */
  nota: string | null
  /**
   * 0850 (C12), solo para quien tiene los dos papeles: 'ejecutivo' (la cita lleva su Ejecutivo Comercial) o 'lider'
   * (sin él). Sin el dato: como Ejecutivo Comercial si lo tiene; si no, como líder.
   */
  como?: ComoPersona | null
}

export type CitaCreateTipo =
  | { tipo: 'medica'; medico_id: string; cuenta_id: null; subtipo_id: null }
  | { tipo: 'institucional'; medico_id: null; cuenta_id: string; subtipo_id: string }

export type CitaCreate = CitaCreateBase & CitaCreateTipo

/**
 * Cuerpo de POST /api/me/agenda/[id]/cancelar. Desde la 0850 el motivo es OBLIGATORIO (A8): un código de la lista
 * (sin 'salida') y, con 'otro', el texto (3 a 300). Sin código y con texto = 'otro' (así la app de hoy, que solo manda
 * el texto, sigue funcionando); sin nada → 400.
 */
export interface CitaCancelar {
  motivo: string | null
  motivo_codigo?: MotivoElegible
}

/** Cuerpo de POST /api/me/agenda/[id]/cerrar ("no se hizo", 0850): código de la lista y, con 'otro', el texto. */
export interface CitaCerrar {
  motivo_codigo: MotivoElegible
  motivo: string | null
}

/** Cuerpo de POST /api/me/agenda/[id]/otra-fecha (0850): la fecha y la hora nuevas; la sede y la nota pueden cambiar. */
export interface CitaOtraFecha {
  fecha: string
  hora: string
  /** null: la misma sede de la anterior. */
  sede_id: string | null
  /** Ausente: la nota de la anterior; null: sin nota. */
  nota?: string | null
  como?: ComoPersona | null
}

/** POST /api/me/agenda/[id]/eliminar → 200 (0850): la cita ya no sale en ninguna lectura. */
export interface CitaEliminadaResponse {
  cita_id: string
}

/** Sede de una cita, con lo que Reportar necesita para medir la distancia y el radio. */
export interface SedeCita {
  id: string
  nombre: string
  cuenta_id: string | null
  cuenta_nombre: string | null
  lat: number | null
  lng: number | null
  /** false: sede nueva de la app que data manager aún no confirma (la visita se guarda pero no suma). */
  ubicacion_confirmada: boolean
}

/** Una cita de la agenda (GET /api/me/agenda, POST /api/me/agenda, cancelar y contexto.agenda_hoy). */
export interface CitaItem {
  id: string
  fecha: string
  /** HH:MM o null (sin hora). */
  hora: string | null
  tipo: TipoVisita
  /** Médica: el médico (sin documento). */
  medico: { id: string; nombre: string } | null
  /** Institucional: la cuenta. */
  cuenta: { id: string; nombre: string } | null
  /** Institucional: el subtipo. */
  subtipo: { id: string; codigo: string; nombre: string } | null
  sede: SedeCita
  nota: string | null
  estado: EstadoCita
  /** La visita que la cumplió (estado hecha). */
  visita_id: string | null
  /** Metros del punto del teléfono a la sede (solo en el contexto con punto); null sin punto o sede sin coordenadas. */
  distancia_m: number | null
  /** distancia_m ≤ radio presencial vigente; null si no hay distancia. */
  dentro_del_radio: boolean | null
  /** Creada antes de su día (Bogotá): la visita que la cumpla cuenta como agendada (decisión 6). */
  anticipada: boolean
  /** Ella la puede cancelar: pendiente y de hoy en adelante. */
  cancelable: boolean
  // --- 0850 (aditivo: la app de hoy no los lee) ---
  /** Motivo del cierre (no_realizada o cancelada), o null. */
  motivo_codigo: MotivoCierre | null
  /** Cuándo se marcó "no se hizo", o null. */
  no_realizada_at: string | null
  /** Texto del motivo de "no se hizo", o null. */
  no_realizada_motivo: string | null
  /** La cita de la que esta es "otra fecha", o null. */
  viene_de: string | null
  /**
   * F1b (aditivo): la fecha y el estado de esa cita, para que el detalle diga "Viene de la cita del 12 oct · No se
   * hizo" aunque la app no la tenga cargada (puede ser de otro mes). null sin viene_de.
   */
  viene_de_fecha: string | null
  viene_de_estado: EstadoCita | null
  /** Su "otra fecha" (la sucesora no eliminada), o null. */
  sucesora_id: string | null
  /** Como Ejecutivo Comercial (con executive_id) o como líder (sin él). */
  como: ComoPersona
  /** Programada, atrasada (hoy, pasada su hora), sin cerrar (de un día anterior) o su estado cerrado (C6). */
  estado_visible: EstadoVisible
}

/** GET /api/me/agenda?desde=&hasta= (sin fechas: hoy a hoy + 7; como mucho 31 días). */
export interface AgendaResponse {
  desde: string
  hasta: string
  hoy: string
  /** Desde la 0850 no hay tope hacia adelante (A4): null. (La app de hoy no la lee: su calendario tiene su propio tope.) */
  max_fecha: null
  items: CitaItem[]
}

/** POST /api/me/agenda → 201 y POST /api/me/agenda/[id]/cancelar → 200. */
export interface CitaResponse {
  cita: CitaItem
}


/** Cuerpo de POST /api/me/voz/campos: lo dictado para UNA visita y su tipo. */
export interface CamposDictado {
  transcript: string
  tipo: TipoVisita
}

/** POST /api/me/voz/campos: el dictado repartido (todo editable en la app antes de confirmar). */
export interface CamposDictadoResponse {
  conclusion: string | null
  compromisos: string | null
  next_step_date: string | null
}

// --- Ventana de fechas (decisión 3; 0850: sin tope hacia adelante, A4) ---------------------------------------

/** Un día libre de la persona (dias_libres), con lo mínimo para la agenda. */
export interface DiaLibreAgenda {
  fecha: string
  fraccion: number
  estado: string
}

/**
 * ¿Ese día está libre completo? Cuenta como "día libre aprobado" lo que la cuota ya cuenta como libre
 * (ESTADOS_DIA_LIBRE_LIBRES: registrado sin exigir aprobación, o aprobado) y de día completo; medio día no bloquea
 * (la persona trabaja la otra mitad). Lo por aprobar, rechazado o anulado tampoco bloquea.
 */
export function esDiaLibreCompleto(dias: readonly DiaLibreAgenda[], fecha: string): boolean {
  return dias.some(dia => dia.fecha === fecha && (ESTADOS_DIA_LIBRE_LIBRES as readonly string[]).includes(dia.estado) && Number(dia.fraccion) >= 1)
}

/**
 * Espejo de la ventana de agenda_crear: el mensaje si en esa fecha no se agenda (pasado o día libre completo), o null.
 * Sin tope hacia adelante (A4, 0850). Los festivos sí se permiten: la persona sabe si trabaja. La hora que ya pasó la
 * mira mensajeHoraCita (lib/agenda-ciclo.ts).
 */
export function mensajeFechaCita(fecha: string, hoy: string, dias: readonly DiaLibreAgenda[] = []): string | null {
  if (!esFechaIso(fecha)) return 'Fecha no válida: usa AAAA-MM-DD'
  if (fecha < hoy) return MENSAJE_CITA_PASADA
  if (esDiaLibreCompleto(dias, fecha)) return MENSAJE_CITA_DIA_LIBRE
  return null
}

// --- Vínculo con la visita (decisiones 6 y 7) ------------------------------------------------------------------

/**
 * Decisión 6: la visita cuenta como AGENDADA si su cita se creó antes del día de la visita en Bogotá. Una cita creada
 * el mismo día sirve para organizarse y para vincular, pero la visita cuenta como no agendada.
 */
export function citaAnticipada(creadaAt: string, fechaVisita: string): boolean {
  try {
    return fechaBogota(creadaAt) < fechaVisita
  } catch {
    return false
  }
}

/** Una cita con lo que el vínculo necesita (filas de visitas_agenda). */
export interface CitaVinculo {
  id: string
  /** 0850: la persona dueña de la cita (el vínculo es por persona). */
  user_id: string
  /** 0850: como Ejecutivo Comercial (su id) o como líder (null). La visita la cumple solo con el mismo papel. */
  executive_id: string | null
  fecha: string
  hora: string | null
  tipo: TipoVisita
  medico_id: string | null
  cuenta_id: string | null
  subtipo_id: string | null
  estado: EstadoCita
  created_at: string
  /** La visita que la cumplió (estado hecha). */
  visita_id?: string | null
  /** La cumplió una visita NO efectiva suya y no anulada: una efectiva de ese día la puede tomar (relevo). */
  cumplida_por_no_efectiva?: boolean
}

/** La visita que se va a registrar, con lo que el vínculo mira. */
export interface VisitaParaVinculo {
  /** 0850: la persona que reporta. */
  user_id: string
  /** 0850: el Ejecutivo Comercial de la visita (ejecutivoDeLaVisita), o null (como líder). */
  executive_id: string | null
  /** visit_date (Bogotá). */
  fecha: string
  tipo: TipoVisita
  medico_id: string | null
  cuenta_id: string | null
  subtipo_id: string | null
  /** Solo una efectiva puede tomar la cita que cumplió una no efectiva (relevo). Sin el dato, no hay relevo. */
  efectiva?: boolean
}

/** ¿Esta visita puede tomar esa cita hecha? Solo una efectiva, y solo si la cumplió una no efectiva suya (relevo). */
export function citaRelevable(cita: Pick<CitaVinculo, 'estado' | 'cumplida_por_no_efectiva'>, visita: Pick<VisitaParaVinculo, 'efectiva'>): boolean {
  return cita.estado === 'hecha' && cita.cumplida_por_no_efectiva === true && visita.efectiva === true
}

const compararHora = (a: string | null, b: string | null) => (a === b ? 0 : a === null ? 1 : b === null ? -1 : a < b ? -1 : 1)

/**
 * Vínculo automático (decisión 7, espejo de visitas_registrar): la cita PENDIENTE de ella (0850: de la persona y del
 * mismo papel), de ese día y del mismo tipo, con el mismo médico; en las institucionales con la misma cuenta,
 * prefiriendo el mismo subtipo. Si la visita es efectiva, también la cita que cumplió una no efectiva suya ese día
 * (relevo: la efectiva planeada cuenta como agendada). Entre varias: el mismo subtipo, la pendiente antes que el relevo,
 * la de hora más temprana (sin hora al final), luego la creada primero y luego por id (el mismo ORDER BY de la base).
 */
export function citaParaVincular(citas: readonly CitaVinculo[], visita: VisitaParaVinculo): CitaVinculo | null {
  const candidatas = citas.filter(
    cita =>
      cita.user_id === visita.user_id &&
      cita.executive_id === visita.executive_id &&
      cita.fecha === visita.fecha &&
      (cita.estado === 'pendiente' || citaRelevable(cita, visita)) &&
      cita.tipo === visita.tipo &&
      (visita.tipo === 'medica' ? cita.medico_id !== null && cita.medico_id === visita.medico_id : cita.cuenta_id !== null && cita.cuenta_id === visita.cuenta_id)
  )
  const mismoSubtipo = (cita: CitaVinculo) => (cita.subtipo_id === visita.subtipo_id ? 0 : 1)
  const pendienteAntes = (cita: CitaVinculo) => (cita.estado === 'pendiente' ? 0 : 1)
  const ordenadas = [...candidatas].sort(
    (a, b) =>
      mismoSubtipo(a) - mismoSubtipo(b) ||
      pendienteAntes(a) - pendienteAntes(b) ||
      compararHora(a.hora, b.hora) ||
      Date.parse(a.created_at) - Date.parse(b.created_at) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  )
  return ordenadas[0] ?? null
}

/**
 * La cita que la visita trae en agenda_id, revisada como visitas_registrar (decisión 7; 0850): de la persona y no
 * eliminada (si no, "no existe o no es tuya"), no cancelada, no cerrada ("no se hizo"), no hecha (salvo el relevo: la
 * cumplió una no efectiva suya y esta es efectiva), del mismo día, del mismo tipo, con el mismo médico o la misma
 * cuenta (el subtipo puede cambiar: se planeó compras y se habló con el químico) y del mismo papel (C12). null = sirve.
 */
export function revisarCitaElegida(cita: CitaVinculo | null | undefined, visita: VisitaParaVinculo): string | null {
  if (!cita || cita.user_id !== visita.user_id || cita.estado === 'eliminada') return MENSAJE_CITA_AJENA
  if (cita.estado === 'cancelada') return MENSAJE_CITA_CANCELADA
  if (cita.estado === 'no_realizada') return MENSAJE_CITA_CERRADA
  if (cita.estado === 'hecha' && !citaRelevable(cita, visita)) return MENSAJE_CITA_YA_HECHA
  if (cita.fecha !== visita.fecha) return MENSAJE_CITA_OTRO_DIA
  if (cita.tipo !== visita.tipo) return MENSAJE_CITA_OTRO_TIPO
  if (visita.tipo === 'medica' && cita.medico_id !== visita.medico_id) return MENSAJE_CITA_OTRO_MEDICO
  if (visita.tipo === 'institucional' && cita.cuenta_id !== visita.cuenta_id) return MENSAJE_CITA_OTRA_CUENTA
  if (cita.executive_id !== visita.executive_id) return MENSAJE_CITA_OTRO_PAPEL
  return null
}

/**
 * Vínculo completo (espejo del paso 7b de visitas_registrar): con agenda_id, esa cita (o el error); sin él, la del
 * vínculo automático (o ninguna). `agendada` = la cita es anticipada respecto de la fecha de la visita. `relevo` = la
 * no efectiva que suelta la cita porque esta efectiva la toma (queda sin cita y no agendada), o null.
 */
export function vinculoDeVisita(entrada: {
  citas: readonly CitaVinculo[]
  visita: VisitaParaVinculo
  agenda_id: string | null
}): { cita: CitaVinculo | null; agendada: boolean; error: string | null; relevo: string | null } {
  const relevoDe = (cita: CitaVinculo | null) => (cita && cita.estado === 'hecha' ? (cita.visita_id ?? null) : null)
  if (entrada.agenda_id) {
    const cita = entrada.citas.find(c => c.id === entrada.agenda_id) ?? null
    const error = revisarCitaElegida(cita, entrada.visita)
    if (error) return { cita: null, agendada: false, error, relevo: null }
    return { cita, agendada: citaAnticipada((cita as CitaVinculo).created_at, entrada.visita.fecha), error: null, relevo: relevoDe(cita) }
  }
  const cita = citaParaVincular(entrada.citas, entrada.visita)
  return { cita, agendada: cita ? citaAnticipada(cita.created_at, entrada.visita.fecha) : false, error: null, relevo: relevoDe(cita) }
}

/** Una visita del día con lo que mira visitas_anular para pasarle la cita de la anulada. */
export interface VisitaParaRetomar {
  id: string
  /** 0850: la persona que la reportó. */
  user_id: string
  /** 0850: su Ejecutivo Comercial, o null (como líder). */
  executive_id: string | null
  fecha: string
  tipo: TipoVisita
  medico_id: string | null
  cuenta_id: string | null
  subtipo_id: string | null
  efectiva: boolean
  checked_in_at: string
  agenda_id: string | null
  anulada: boolean
}

/**
 * Espejo del final de visitas_anular: al anular la visita que cumplía `cita`, la cita pasa a otra visita suya (0850: de
 * la persona y del mismo papel) no anulada de ese día, del mismo tipo y con el mismo médico o cuenta, que no tenga cita
 * (la efectiva primero, luego el mismo subtipo, la llegada más temprana y por id; p. ej. la no efectiva de antes de un
 * relevo). null = no hay: la cita vuelve a pendiente. Antes, visitas_anular rechaza si la cita ya tiene otra fecha
 * (revisarVisitaConOtraFecha, lib/agenda-ciclo.ts).
 */
export function visitaQueRetomaCita(
  cita: Pick<CitaVinculo, 'user_id' | 'executive_id' | 'fecha' | 'tipo' | 'medico_id' | 'cuenta_id' | 'subtipo_id'>,
  anuladaId: string,
  visitas: readonly VisitaParaRetomar[]
): VisitaParaRetomar | null {
  const candidatas = visitas.filter(
    v =>
      v.id !== anuladaId &&
      !v.anulada &&
      v.agenda_id === null &&
      v.user_id === cita.user_id &&
      v.executive_id === cita.executive_id &&
      v.fecha === cita.fecha &&
      v.tipo === cita.tipo &&
      (cita.tipo === 'medica' ? cita.medico_id !== null && v.medico_id === cita.medico_id : cita.cuenta_id !== null && v.cuenta_id === cita.cuenta_id)
  )
  const ordenadas = [...candidatas].sort(
    (a, b) =>
      Number(b.efectiva) - Number(a.efectiva) ||
      Number(b.subtipo_id === cita.subtipo_id) - Number(a.subtipo_id === cita.subtipo_id) ||
      Date.parse(a.checked_in_at) - Date.parse(b.checked_in_at) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  )
  return ordenadas[0] ?? null
}

// --- Indicador de Mis números (decisión 8): cuentasAgenda está en lib/agenda-ciclo.ts (re-exportada arriba) -----

// --- Distancia y orden de las citas (Reportar: la más cercana primero) ------------------------------------------

/** Distancia del punto a la sede de la cita y si queda dentro del radio (null sin punto o sede sin coordenadas). */
export function distanciaACita(
  sede: { lat: number | null; lng: number | null },
  punto: Punto | null,
  radioM: number
): { distancia_m: number | null; dentro_del_radio: boolean | null } {
  if (!punto || !esPunto(punto.lat, punto.lng) || !esPunto(sede.lat, sede.lng)) return { distancia_m: null, dentro_del_radio: null }
  const distancia_m = haversineM(punto, { lat: sede.lat as number, lng: sede.lng as number })
  return { distancia_m, dentro_del_radio: distancia_m <= radioM }
}

/**
 * Orden de las citas: por fecha; con distancia (contexto con punto), la más cercana primero (sin distancia al final);
 * luego por hora (sin hora al final), por con quién y por id.
 */
export function ordenarCitas<T extends Pick<CitaItem, 'id' | 'fecha' | 'hora' | 'distancia_m' | 'medico' | 'cuenta'>>(
  citas: readonly T[],
  opciones: { porDistancia?: boolean } = {}
): T[] {
  const distancia = (cita: T) => (cita.distancia_m === null ? Number.POSITIVE_INFINITY : cita.distancia_m)
  const con = (cita: T) => cita.medico?.nombre ?? cita.cuenta?.nombre ?? ''
  return [...citas].sort(
    (a, b) =>
      a.fecha.localeCompare(b.fecha) ||
      (opciones.porDistancia ? distancia(a) - distancia(b) : 0) ||
      compararHora(a.hora, b.hora) ||
      con(a).localeCompare(con(b), 'es', { sensitivity: 'base' }) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  )
}

// --- Dictado por campo (decisión 9): conclusión, compromisos y próxima reunión ----------------------------------

const DIAS_SEMANA = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'] as const

/** Nombre del día de la semana de una fecha (para que Claude resuelva "el jueves"). */
export function nombreDiaSemana(fecha: string): string {
  return DIAS_SEMANA[diaSemanaIso(fecha) - 1] ?? ''
}

/** Prompt del sistema para repartir el dictado de UNA visita entre sus campos (salida solo por la herramienta). */
export const PROMPT_CAMPOS = `Eres el asistente de reporte de visitas de VG (dispositivos médicos, Colombia). Un Ejecutivo Comercial dictó lo que pasó en UNA visita que ya eligió. Reparte lo dicho SOLO con la herramienta repartir_campos.

Reglas:
1. conclusion: lo que pasó y lo que se concluyó, en frases cortas y con sus palabras. No agregues nada que no haya dicho.
2. compromisos: lo que quedó en hacer alguna de las partes (enviar, llevar, cotizar, llamar, volver), separados por punto y coma. Si no dijo ninguno, null.
3. next_step_date: solo si dio una fecha o un plazo claro para la próxima reunión o el siguiente paso, en AAAA-MM-DD a partir de la fecha de hoy que se te da; si no, null.
4. Un mismo dato no va en dos campos. Si no dijo nada que sirva para un campo, ese campo va en null.
5. Nunca escribas números de documento ni teléfonos.
6. Responde en español, sin saludos ni explicaciones fuera de la herramienta.`

/** Esquema JSON (entrada de la herramienta repartir_campos): lo mismo que camposSchema valida después. */
export const esquemaCampos = {
  type: 'object',
  additionalProperties: false,
  properties: {
    conclusion: { type: ['string', 'null'], maxLength: MAX_CONCLUSION, description: 'Lo que pasó y se concluyó; null si no lo dijo' },
    compromisos: { type: ['string', 'null'], maxLength: MAX_COMPROMISOS, description: 'Lo que quedó en hacer cada parte; null si no lo dijo' },
    next_step_date: { type: ['string', 'null'], pattern: '^\\d{4}-\\d{2}-\\d{2}$', description: 'Próxima reunión AAAA-MM-DD; null si no dio fecha' },
  },
  required: ['conclusion', 'compromisos', 'next_step_date'],
} as const

/** Nombre y descripción de la herramienta (la API arma la definición con esquemaCampos). */
export const HERRAMIENTA_CAMPOS = {
  name: 'repartir_campos',
  description: 'Reparte el dictado de una visita entre la conclusión, los compromisos y la fecha de la próxima reunión.',
} as const

/** Lo que devuelve Claude por la herramienta (antes de normalizar). Lo valida camposSchema (zod). */
export interface CamposCrudos {
  conclusion: string | null
  compromisos: string | null
  next_step_date: string | null
}

/**
 * Deja el reparto usable por la app: textos limpios, acotados y sin números largos (documentos o teléfonos), y la
 * próxima reunión solo si es una fecha válida desde hoy (una anterior nacería como compromiso vencido).
 */
export function normalizarCampos(crudos: Partial<CamposCrudos> | null | undefined, hoy: string): CamposDictadoResponse {
  const fecha = crudos?.next_step_date
  return {
    conclusion: textoPropuesta(crudos?.conclusion, MAX_CONCLUSION),
    compromisos: textoPropuesta(crudos?.compromisos, MAX_COMPROMISOS),
    next_step_date: esFechaIso(fecha) && fecha >= hoy ? fecha : null,
  }
}

/** Mensaje del usuario para repartir_campos: la fecha de hoy (con su día), el tipo de visita y lo dictado. */
export function mensajeCampos(entrada: { transcript: string; tipo: TipoVisita; hoy: string }): string {
  return [
    `HOY: ${entrada.hoy} (${nombreDiaSemana(entrada.hoy)})`,
    `VISITA: ${entrada.tipo === 'medica' ? 'médica (a un médico)' : 'institucional (a una cuenta)'}`,
    '',
    'DICTADO:',
    '"""',
    entrada.transcript,
    '"""',
    '',
    `Reparte lo dictado llamando a la herramienta ${HERRAMIENTA_CAMPOS.name}.`,
  ].join('\n')
}

/** 502 del dictado por campo (la app deja escribir a mano). */
export const MENSAJE_FALLO_CAMPOS = 'No se pudo repartir el dictado. Escribe la conclusión y los compromisos a mano.'

/**
 * Rango de GET /api/me/agenda con los valores por defecto: sin fechas, de hoy a hoy + 7; solo desde, desde + 7; solo
 * hasta, de hoy a hasta. Como mucho MAX_DIAS_CONSULTA_AGENDA días (ambos incluidos) y hasta no antes que desde.
 */
export function rangoConsultaAgenda(
  consulta: { desde: string | null; hasta: string | null },
  hoy: string
): { desde: string; hasta: string; error: null } | { desde: null; hasta: null; error: string } {
  const desde = consulta.desde ?? hoy
  const hasta = consulta.hasta ?? sumarDias(desde, DIAS_AGENDA_POR_DEFECTO)
  if (hasta < desde) return { desde: null, hasta: null, error: 'La fecha final no puede ser anterior a la inicial' }
  if (sumarDias(desde, MAX_DIAS_CONSULTA_AGENDA - 1) < hasta) {
    return { desde: null, hasta: null, error: `Como mucho ${MAX_DIAS_CONSULTA_AGENDA} días por consulta` }
  }
  return { desde, hasta, error: null }
}

// ---------------------------------------------------------------------------------------------
// Equipo (Entrega 2, 2026-10-31): GET /api/equipo/{personas,hoy,persona/[id],rendimiento,persona/[id]/rendimiento}.
// Dónde está cada persona y cómo rinde, por lo reportado y agendado (nunca GPS en vivo). Copia en mobile/lib/tipos.ts.
// ---------------------------------------------------------------------------------------------

/** El texto fijo arriba de Equipo › Hoy (C5: la app no sigue la ubicación). */
export const TEXTO_FIJO_EQUIPO = 'Lo que cada persona reporta o agenda. La app no sigue la ubicación.'

export type PapelEquipo = 'lider' | 'ejecutivo' | 'lider_y_ejecutivo'
export type CasoUbicacion = 'dia_libre' | 'festivo' | 'reportado' | 'reportado_hace_rato' | 'planeado' | 'sin_nada'
/** Estado de un paso del rastro: el de la cita (programada, atrasada, sin_cerrar, no_realizada, cancelada) o el de la visita. */
export type EstadoPaso = 'programada' | 'atrasada' | 'sin_cerrar' | 'no_realizada' | 'cancelada' | 'hecha' | 'no_efectiva'

export interface PersonaEquipoItem {
  user_id: string
  nombre: string
  papel: PapelEquipo
  executive_id: string | null
  zona: string | null
  lineas: LineaPersona[]
  /** Quien pregunta la ve solo como Ejecutiva Comercial (lo que hace como líder no se le muestra). */
  solo_como_ejecutivo: boolean
  activa: boolean
}

export interface EquipoPersonasResponse {
  personas: PersonaEquipoItem[]
  /** Catálogo de líneas activas (para el filtro). */
  lineas: Array<{ id: string; nombre: string }>
}

export interface UbicacionItem {
  caso: CasoUbicacion
  fuente: 'reportado' | 'planeado' | null
  hora: string | null
  sede: string | null
  municipio: string | null
  /** Minutos desde el reporte (solo hoy); null si no aplica. */
  hace_min: number | null
  marcas: MarcaVisita[]
}

export interface EquipoHoyResponse {
  fecha: string
  texto_fijo: string
  resumen: { ciudades: Array<{ nombre: string; personas: number }>; sin_nada: number }
  personas: Array<{ persona: PersonaEquipoItem; donde: UbicacionItem }>
}

export interface PasoRastroItem {
  fecha: string
  hora: string | null
  tipo: TipoVisita
  modalidad: Modalidad | null
  /** El médico, la cuenta o el médico no listado (nombre); nunca el documento. */
  con_quien: string | null
  sede: string | null
  municipio: string | null
  estado: EstadoPaso
  motivo: string | null
  /** Días de anticipación de la cita; null si no estaba planeada. */
  anticipacion_dias: number | null
  viene_de_fecha: string | null
  /** Nombres de las líneas que impulsó la visita. */
  lineas: string[]
  marcas: MarcaVisita[]
  visita_id: string | null
  cita_id: string | null
}

export interface EquipoPersonaDiaResponse {
  fecha: string
  persona: PersonaEquipoItem
  donde: UbicacionItem
  rastro: PasoRastroItem[]
  /** Lo de ese día que falta y los dos días que vienen (citas pendientes). */
  siguiente: PasoRastroItem[]
}

export interface CifrasItem {
  hechas: number
  efectivas: number
  no_efectivas: number
  no_efectivas_por_motivo: Record<string, number>
  no_se_hizo: number
  no_se_hizo_por_motivo: Record<string, number>
  canceladas: number
  canceladas_por_motivo: Record<string, number>
  sin_cerrar: number
  programadas: number
  telefonicas: number
  cumplimiento_plan: { programadas: number; cumplidas: number; ratio: number | null }
  anticipacion: { mediana_dias: number | null; pct_con_tiempo: number | null; pct_mismo_dia: number | null; no_planeadas: number }
  medicos_distintos: number
  ciudades_distintas: number
  por_linea: { lineas: Array<{ line_id: string; nombre: string; hechas: number }>; suma_supera_hechas: boolean }
}

export interface CuotaResumenItem {
  medica: { cuota: number; hechas: number; cumplimiento: number | null }
  institucional: { cuota: number; hechas: number; cumplimiento: number | null }
}

export interface FilaRendimientoItem extends CifrasItem {
  persona: PersonaEquipoItem
  /** Tuvo filas en el periodo y hoy ya no está (inactiva o traspasada). */
  ya_no_esta: boolean
  /** Días hábiles ya cerrados del periodo sin ninguna visita; null si no se calcula. */
  dias_habiles_sin_visitas: number | null
  /** Solo con Ejecutivo Comercial y periodo de un mes completo (la misma cuenta de /api/me/numeros). */
  cuota: CuotaResumenItem | null
}

export interface EquipoRendimientoResponse {
  desde: string
  hasta: string
  mes_completo: boolean
  equipo: CifrasItem
  por_persona: FilaRendimientoItem[]
}

export interface EquipoPersonaRendimientoResponse {
  desde: string
  hasta: string
  mes_completo: boolean
  fila: FilaRendimientoItem
  visitas: PasoRastroItem[]
  citas: PasoRastroItem[]
}
