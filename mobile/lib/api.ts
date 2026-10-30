/**
 * Cliente de la API de OpMap para la app. Servidor: EXPO_PUBLIC_API_URL (por defecto producción). Manda el token
 * del almacén seguro en "Authorization: Bearer" (decisión 1 del contrato fase 8); un 401 con token cierra la
 * sesión (lo escucha lib/sesion.ts). Los errores salen como ApiError con el mensaje { error } del servidor, o uno
 * en español según el código (lib/errores.ts). Todas las peticiones tienen tiempo máximo.
 * Spec 2026-10-15 (paquete 4): el token sale de la memoria (lib/almacen.ts, el llavero se lee una vez); el contexto que
 * llega queda en memoria (recordarContexto de lib/contexto-memoria.ts) con el punto con que se pidió; corregir o anular
 * una visita lo invalida. En desarrollo (`__DEV__`) cada petición deja en Metro una línea `[api]` con método, patrón de
 * la ruta (sin ids), estado, ms y la cabecera Server-Timing: nunca el cuerpo, la consulta ni el token.
 */
import { File } from 'expo-file-system'
import { Platform } from 'react-native'
import { leerToken, olvidarTokenPor401 } from './almacen'
import { invalidarContexto, recordarContexto, versionContexto } from './contexto-memoria'
import { ApiError, MENSAJE_SESION_VENCIDA, aApiError, errorDeRespuesta } from './errores'
import {
  TIEMPO_NORMAL_MS,
  TIEMPO_PROPONER_MS,
  TIEMPO_TRANSCRIBIR_MS,
  construirUrl,
  jsonSeguro,
  lineaRegistroApi,
  normalizarBase,
  type DatosRegistroApi,
  type ValorQuery,
} from './http'
import { parteAudio } from './subida-audio'
import { cuerpoMotivo } from './agenda-ciclo'
import type {
  AgendaResponse,
  CamposDictadoResponse,
  CitaCreate,
  CitaEliminadaResponse,
  CitaOtraFecha,
  CitaResponse,
  ContextoResponse,
  CuotaResponse,
  DiaLibreCreate,
  DiaLibreResponse,
  LoginMovilResponse,
  MeResponse,
  MisDiasLibresResponse,
  MotivoElegible,
  NumerosResponse,
  PropuestaResponse,
  TipoVisita,
  TranscripcionResponse,
  VisitaCreate,
  VisitaCreateResponse,
  VisitaItem,
  VisitasResponse,
  VisitaUpdate,
} from './tipos'
import type {
  CuentaCreate,
  CuentaCreateResponse,
  CuentaDetalleResponse,
  CuentaListItem,
  LugarItem,
  MedicoCreate,
  MedicoCreateResponse,
  MedicoPublico,
  MedicoSedeCreate,
  MedicoVerificar,
  MedicoVerificarRespuesta,
  PaginaTerceros,
  SedeBusquedaItem,
  SedeCreateGps,
  SedeCreateResponse,
} from './tipos'

export const URL_API = normalizarBase(process.env.EXPO_PUBLIC_API_URL)

type Metodo = 'GET' | 'POST' | 'PATCH' | 'DELETE'

export interface OpcionesPeticion {
  metodo?: Metodo
  query?: Record<string, ValorQuery>
  /** Cuerpo JSON. */
  cuerpo?: unknown
  /** Cuerpo multipart (audio). Excluye `cuerpo`. */
  formulario?: FormData
  timeoutMs?: number
  /** No mandar el token (login). */
  sinToken?: boolean
  /** Token explícito (al validar uno recién recibido, antes de guardarlo). */
  token?: string
}

// --- 401 → cerrar sesión -------------------------------------------------------------------------------------

type OyenteSesion = () => void
const oyentesSesionVencida = new Set<OyenteSesion>()

/** lib/sesion.ts se suscribe para olvidar el token cuando el servidor responde 401. */
export function alVencerSesion(oyente: OyenteSesion): () => void {
  oyentesSesionVencida.add(oyente)
  return () => {
    oyentesSesionVencida.delete(oyente)
  }
}

function avisarSesionVencida() {
  for (const oyente of oyentesSesionVencida) {
    try {
      oyente()
    } catch {
      // un oyente que falla no detiene a los demás
    }
  }
}

// --- Registro de desarrollo ----------------------------------------------------------------------------------

function relojMs(): number {
  const rendimiento = (globalThis as { performance?: { now?: () => number } }).performance
  return typeof rendimiento?.now === 'function' ? rendimiento.now() : Date.now()
}

/** Solo en desarrollo: método, patrón de la ruta, estado, ms y Server-Timing (lineaRegistroApi). Nunca lanza. */
function registrarPeticion(datos: DatosRegistroApi): void {
  if (!__DEV__) return
  try {
    console.log(lineaRegistroApi(datos))
  } catch {
    // el registro nunca rompe una petición
  }
}

// --- Petición genérica ---------------------------------------------------------------------------------------

export async function peticion<T>(ruta: string, opciones: OpcionesPeticion = {}): Promise<T> {
  const { metodo = 'GET', query, cuerpo, formulario, timeoutMs = TIEMPO_NORMAL_MS, sinToken = false } = opciones
  const url = construirUrl(URL_API, ruta, query)
  const token = sinToken ? null : (opciones.token ?? (await leerToken()))

  const cabeceras: Record<string, string> = { Accept: 'application/json' }
  if (token) cabeceras.Authorization = `Bearer ${token}`
  let body: string | FormData | undefined
  if (formulario) {
    body = formulario // el Content-Type con el boundary lo pone fetch
  } else if (cuerpo !== undefined) {
    cabeceras['Content-Type'] = 'application/json'
    body = JSON.stringify(cuerpo)
  }

  const control = new AbortController()
  const temporizador = setTimeout(() => control.abort(), timeoutMs)
  const inicio = relojMs()
  let respuesta: Response
  try {
    respuesta = await fetch(url, { method: metodo, headers: cabeceras, body, signal: control.signal })
  } catch (error) {
    registrarPeticion({ metodo, ruta, estado: null, ms: relojMs() - inicio })
    throw aApiError(error)
  } finally {
    clearTimeout(temporizador)
  }

  const texto = await respuesta.text().catch(() => '')
  registrarPeticion({ metodo, ruta, estado: respuesta.status, ms: relojMs() - inicio, serverTiming: respuesta.headers?.get?.('server-timing') ?? null })
  const datos = jsonSeguro(texto)
  if (!respuesta.ok) {
    if (respuesta.status === 401 && token) {
      // Ninguna petición siguiente manda este token; la sesión lo borra del llavero y cierra (alVencerSesion).
      olvidarTokenPor401(token)
      avisarSesionVencida()
      throw new ApiError(401, MENSAJE_SESION_VENCIDA, { tipo: 'sesion', cuerpo: datos })
    }
    throw errorDeRespuesta(respuesta.status, datos)
  }
  return datos as T
}

// --- Sesión --------------------------------------------------------------------------------------------------

export function login(email: string, password: string): Promise<LoginMovilResponse> {
  return peticion<LoginMovilResponse>('/api/auth/login', {
    metodo: 'POST',
    cuerpo: { email: email.trim().toLowerCase(), password, cliente: 'movil' },
    sinToken: true,
  })
}

/** Quién es la sesión. `timeoutMs`: al abrir la app se espera poco (TIEMPO_ME_MS de lib/sesion-reglas.ts). */
export function me(token?: string, timeoutMs?: number): Promise<MeResponse> {
  return peticion<MeResponse>('/api/auth/me', { token, timeoutMs })
}

/** Avisa al servidor (responde 200 con o sin token). Cerrar sesión de verdad es olvidar el token. */
export async function logout(): Promise<void> {
  try {
    await peticion('/api/auth/logout', { metodo: 'POST', timeoutMs: 5_000 })
  } catch {
    // sin señal: igual se olvida el token
  }
}

// --- Hoy y visitas -------------------------------------------------------------------------------------------

export interface PuntoConsulta {
  lat: number
  lng: number
  precision?: number | null
}

/**
 * Todo lo que Reportar y Hoy necesitan. Con el punto del teléfono va por POST con la ubicación en el CUERPO: en la URL
 * quedaría en los logs de peticiones del proveedor (con la hora y la persona). Sin punto, GET. Lo que llega queda en
 * memoria con el punto pedido (recordarContexto): Hoy, Reportar, Agendar y Visita lo reusan según su frescura.
 */
export async function contexto(punto?: PuntoConsulta | null): Promise<ContextoResponse> {
  const pedido = punto ? { lat: punto.lat, lng: punto.lng } : null
  const version = versionContexto()
  const respuesta = punto
    ? await peticion<ContextoResponse>('/api/me/contexto', {
        metodo: 'POST',
        cuerpo: {
          lat: Math.round(punto.lat * 1e6) / 1e6,
          lng: Math.round(punto.lng * 1e6) / 1e6,
          precision: punto.precision != null ? Math.round(punto.precision) : null,
        },
      })
    : await peticion<ContextoResponse>('/api/me/contexto')
  // Si mientras tanto llegó una visita, una cita o un día libre (o se cerró la sesión), esta respuesta ya es vieja.
  if (versionContexto() === version) recordarContexto(respuesta, pedido)
  return respuesta
}

export function visitas(fecha?: string): Promise<VisitasResponse> {
  return peticion<VisitasResponse>('/api/me/visitas', { query: { fecha } })
}

export function crearVisita(cuerpo: VisitaCreate, timeoutMs?: number): Promise<VisitaCreateResponse> {
  return peticion<VisitaCreateResponse>('/api/me/visitas', { metodo: 'POST', cuerpo, timeoutMs })
}

/** Corrige una visita de hoy. Lo hecho hoy puede cambiar (efectiva o no): el contexto en memoria deja de servir. */
export async function editarVisita(id: string, cambios: VisitaUpdate): Promise<{ visita: VisitaItem }> {
  const respuesta = await peticion<{ visita: VisitaItem }>(`/api/me/visitas/${encodeURIComponent(id)}`, { metodo: 'PATCH', cuerpo: cambios })
  invalidarContexto('visita')
  return respuesta
}

/** Anula una visita de hoy. Lo hecho hoy cambia: el contexto en memoria deja de servir. */
export async function anularVisita(id: string, motivo: string): Promise<unknown> {
  const respuesta = await peticion(`/api/me/visitas/${encodeURIComponent(id)}/anular`, { metodo: 'POST', cuerpo: { motivo } })
  invalidarContexto('visita')
  return respuesta
}

// --- Voz -----------------------------------------------------------------------------------------------------

/**
 * Sube el audio grabado (campo `audio`) y devuelve la transcripción. El audio va directo del archivo temporal
 * del teléfono al servidor; quien llama lo borra al recibir la respuesta (o al cancelar).
 */
export async function transcribir(uri: string, duracionS?: number | null): Promise<TranscripcionResponse> {
  const formulario = new FormData()
  if (Platform.OS === 'web') {
    // En el navegador la grabación es un blob: se lee y se adjunta como archivo.
    const blob = await (await fetch(uri)).blob()
    const extension = blob.type.includes('mp4') ? 'mp4' : 'webm'
    formulario.append('audio', blob, `dictado.${extension}`)
  } else {
    // El fetch de Expo no acepta { uri, name, type } (lib/subida-audio.ts): la parte lee el archivo con bytes().
    const archivo = new File(uri)
    formulario.append('audio', parteAudio(uri, () => archivo.bytes()) as unknown as Blob)
  }
  if (duracionS != null && Number.isFinite(duracionS)) formulario.append('duracion_s', String(Math.round(duracionS)))
  return peticion<TranscripcionResponse>('/api/me/voz/transcribir', { metodo: 'POST', formulario, timeoutMs: TIEMPO_TRANSCRIBIR_MS })
}

export interface ProponerDatos {
  transcript: string
  lat?: number | null
  lng?: number | null
  precision?: number | null
  /** Hora del teléfono (ISO con zona). */
  hora?: string
  /** La cita de hoy que eligió antes de dictar (0840): la IA la toma como la visita de la que habla. */
  cita_id?: string | null
}

export function proponer(datos: ProponerDatos): Promise<PropuestaResponse> {
  return peticion<PropuestaResponse>('/api/me/voz/proponer', { metodo: 'POST', cuerpo: datos, timeoutMs: TIEMPO_PROPONER_MS })
}

/**
 * Dictado de un campo (F4.1): reparte lo dicho de UNA visita entre conclusión, compromisos y próxima reunión. Nada se
 * guarda: la app lo añade a lo escrito y la persona confirma. 503 sin la llave de la IA; 429 comparte el tope de proponer.
 */
export function vozCampos(transcript: string, tipo: TipoVisita): Promise<CamposDictadoResponse> {
  return peticion<CamposDictadoResponse>('/api/me/voz/campos', {
    metodo: 'POST',
    cuerpo: { transcript: transcript.slice(0, 8000), tipo },
    timeoutMs: TIEMPO_PROPONER_MS,
  })
}

// --- Agenda (F4.1, migración 0840; ciclo de vida desde la 0850) ----------------------------------------------
// Lo que cierra, cancela, elimina o pide otra fecha cambia las citas de hoy: después del 2xx el contexto en memoria deja
// de servir (invalidarContexto('cita')) y Hoy vuelve a pedir. Sin la API de F1a (un servidor anterior) esas rutas
// responden 404 sin { error }: el mensaje es "Esto todavía no está disponible en el servidor." (lib/errores.ts).

/**
 * Sus citas (sin fechas: de hoy a hoy + 7; como mucho 31 días; también hacia atrás). Sin `canceladas`, solo las
 * pendientes y las hechas; con él, también las canceladas y las que no se hicieron. Las eliminadas nunca.
 */
export function agenda(desde?: string, hasta?: string, canceladas?: boolean): Promise<AgendaResponse> {
  return peticion<AgendaResponse>('/api/me/agenda', { query: { desde, hasta, canceladas: canceladas ? 'true' : undefined } })
}

/**
 * Agenda una cita (201). 400 con { error, errores? } por forma, fecha, hora pasada, día libre, perfil, médico, cuenta o
 * subtipo; 409 repetida o choque de media hora (con el error en `hora`). Sin tope hacia adelante.
 */
export function agendar(cuerpo: CitaCreate): Promise<CitaResponse> {
  return peticion<CitaResponse>('/api/me/agenda', { metodo: 'POST', cuerpo })
}

/** El motivo que eligió (de la lista, sin 'salida') y lo que escribió (con 'otro', de 3 a 300 caracteres). */
export interface MotivoDeCierre {
  motivo_codigo: MotivoElegible
  motivo?: string | null
}

/** Cancela una cita propia pendiente de hoy en adelante, con motivo OBLIGATORIO (A8). 400 cerrada o de ayer; 404 ajena. */
export async function cancelarCita(id: string, motivo: MotivoDeCierre): Promise<CitaResponse> {
  const respuesta = await peticion<CitaResponse>(`/api/me/agenda/${encodeURIComponent(id)}/cancelar`, {
    metodo: 'POST',
    cuerpo: cuerpoMotivo(motivo.motivo_codigo, motivo.motivo),
  })
  invalidarContexto('cita')
  return respuesta
}

/** "No se hizo" (A7, C7): cierra una cita propia pendiente de su día o anterior con su motivo. 400 cerrada o futura; 404. */
export async function cerrarCita(id: string, motivo: MotivoDeCierre): Promise<CitaResponse> {
  const respuesta = await peticion<CitaResponse>(`/api/me/agenda/${encodeURIComponent(id)}/cerrar`, {
    metodo: 'POST',
    cuerpo: cuerpoMotivo(motivo.motivo_codigo, motivo.motivo),
  })
  invalidarContexto('cita')
  return respuesta
}

/** "Eliminar: lo agendé por error" (C8): una cita propia pendiente de hoy en adelante; no cuenta en nada. 400; 404. */
export async function eliminarCita(id: string): Promise<CitaEliminadaResponse> {
  const respuesta = await peticion<CitaEliminadaResponse>(`/api/me/agenda/${encodeURIComponent(id)}/eliminar`, { metodo: 'POST', cuerpo: {} })
  invalidarContexto('cita')
  return respuesta
}

/**
 * "Agendar otra fecha" (A7): una cita NUEVA enlazada a la anterior, que debe estar cerrada y sin otra fecha (201 con
 * viene_de). 400 sigue programada o efectiva; 409 ya tiene otra fecha o choque de media hora; 404.
 */
export async function otraFechaCita(id: string, cuerpo: CitaOtraFecha): Promise<CitaResponse> {
  const respuesta = await peticion<CitaResponse>(`/api/me/agenda/${encodeURIComponent(id)}/otra-fecha`, { metodo: 'POST', cuerpo })
  invalidarContexto('cita')
  return respuesta
}

// --- Números y cuota -----------------------------------------------------------------------------------------

export function numeros(mes?: string): Promise<NumerosResponse> {
  return peticion<NumerosResponse>('/api/me/numeros', { query: { mes } })
}

export function cuota(mes?: string): Promise<CuotaResponse> {
  return peticion<CuotaResponse>('/api/me/cuota', { query: { mes } })
}

// --- Días libres (F2) ----------------------------------------------------------------------------------------

export function diasLibres(desde?: string, hasta?: string): Promise<MisDiasLibresResponse> {
  return peticion<MisDiasLibresResponse>('/api/me/dias-libres', { query: { desde, hasta } })
}

export function crearDiaLibre(datos: DiaLibreCreate): Promise<DiaLibreResponse> {
  return peticion<DiaLibreResponse>('/api/me/dias-libres', { metodo: 'POST', cuerpo: datos })
}

export function anularDiaLibre(id: string): Promise<DiaLibreResponse> {
  return peticion<DiaLibreResponse>(`/api/me/dias-libres/${encodeURIComponent(id)}/anular`, { metodo: 'POST', cuerpo: {} })
}

// --- Terceros de F1 que usa Reportar (médico completo, sede nueva, consultorio) ------------------------------
// El documento del médico va siempre en el CUERPO (POST), nunca en la URL: no queda en logs de peticiones.

/** ¿Ya existe un médico con ese documento? ¿Hay parecidos por nombre? (nunca devuelve documentos). */
export function verificarMedico(datos: MedicoVerificar): Promise<MedicoVerificarRespuesta> {
  return peticion<MedicoVerificarRespuesta>('/api/terceros/medicos/verificar', { metodo: 'POST', cuerpo: datos })
}

// Crear un médico, una cuenta o una sede, o vincular una sede a un médico, cambia lo que trae el contexto (mis_medicos y
// sus sedes, las sedes cercanas): después del 2xx el contexto en memoria deja de servir (invalidarContexto('terceros'),
// revisión 2026-10-15), y la siguiente llegada, Agendar o Visita lo piden de nuevo con lo recién creado.

/** Crea un médico completo (409 con { existente } si el documento ya está). */
export async function crearMedico(datos: MedicoCreate): Promise<MedicoCreateResponse> {
  const respuesta = await peticion<MedicoCreateResponse>('/api/terceros/medicos', { metodo: 'POST', cuerpo: datos })
  invalidarContexto('terceros')
  return respuesta
}

/** Busca médicos por nombre (todas las palabras, sin importar tildes). Nunca trae documentos. */
export function buscarMedicos(q: string): Promise<PaginaTerceros<MedicoPublico>> {
  return peticion<PaginaTerceros<MedicoPublico>>('/api/terceros/medicos/buscar', { metodo: 'POST', cuerpo: { q, activo: true } })
}

/** Detalle de un médico (con sus sedes; nunca el documento para una ejecutiva). */
export function medico(id: string): Promise<{ medico: MedicoPublico }> {
  return peticion<{ medico: MedicoPublico }>(`/api/terceros/medicos/${encodeURIComponent(id)}`)
}

/** Vincula una sede más a un médico (el médico atiende también ahí). */
export async function vincularSedeMedico(medicoId: string, sede: MedicoSedeCreate): Promise<{ medico: MedicoPublico }> {
  const respuesta = await peticion<{ medico: MedicoPublico }>(`/api/terceros/medicos/${encodeURIComponent(medicoId)}/sedes`, { metodo: 'POST', cuerpo: sede })
  invalidarContexto('terceros')
  return respuesta
}

/** Buscador de sedes activas por nombre de sede o de cuenta, o por código de habilitación. */
export function buscarSedes(q: string, municipio?: string | null): Promise<{ items: SedeBusquedaItem[] }> {
  return peticion<{ items: SedeBusquedaItem[] }>('/api/terceros/sedes', { query: { q, municipio } })
}

/** Busca cuentas por nombre (por POST: lo que se escribe no queda en la URL). */
export function buscarCuentas(q: string): Promise<PaginaTerceros<CuentaListItem>> {
  return peticion<PaginaTerceros<CuentaListItem>>('/api/terceros/cuentas/buscar', { metodo: 'POST', cuerpo: { q, activo: true } })
}

/** Detalle de una cuenta con sus sedes. */
export function cuenta(id: string): Promise<CuentaDetalleResponse> {
  return peticion<CuentaDetalleResponse>(`/api/terceros/cuentas/${encodeURIComponent(id)}`)
}

/** Crea una cuenta con su sede principal (p. ej. el consultorio de un médico). */
export async function crearCuenta(datos: CuentaCreate): Promise<CuentaCreateResponse> {
  const respuesta = await peticion<CuentaCreateResponse>('/api/terceros/cuentas', { metodo: 'POST', cuerpo: datos })
  invalidarContexto('terceros')
  return respuesta
}

/** Crea una sede con el GPS del sitio (origen 'gps_app'). */
export async function crearSede(datos: SedeCreateGps): Promise<SedeCreateResponse> {
  const respuesta = await peticion<SedeCreateResponse>('/api/terceros/sedes', { metodo: 'POST', cuerpo: datos })
  invalidarContexto('terceros')
  return respuesta
}

/** Departamentos de Colombia (código DANE de 2 dígitos). */
export function departamentos(): Promise<LugarItem[]> {
  return peticion<LugarItem[]>('/api/locations/departments')
}

/** Municipios de un departamento (código DANE de 5 dígitos y nombre). */
export function municipios(departamentoId: string): Promise<LugarItem[]> {
  return peticion<LugarItem[]>('/api/locations/municipalities', { query: { departmentId: departamentoId } })
}
