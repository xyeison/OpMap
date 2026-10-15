/**
 * Cliente de la API de OpMap para la app. Servidor: EXPO_PUBLIC_API_URL (por defecto producción). Manda el token
 * del almacén seguro en "Authorization: Bearer" (decisión 1 del contrato fase 8); un 401 con token cierra la
 * sesión (lo escucha lib/sesion.ts). Los errores salen como ApiError con el mensaje { error } del servidor, o uno
 * en español según el código (lib/errores.ts). Todas las peticiones tienen tiempo máximo.
 */
import { Platform } from 'react-native'
import { leerToken } from './almacen'
import { ApiError, MENSAJE_SESION_VENCIDA, aApiError, errorDeRespuesta } from './errores'
import {
  TIEMPO_NORMAL_MS,
  TIEMPO_PROPONER_MS,
  TIEMPO_TRANSCRIBIR_MS,
  construirUrl,
  jsonSeguro,
  normalizarBase,
  type ValorQuery,
} from './http'
import type {
  AgendaResponse,
  CamposDictadoResponse,
  CitaCreate,
  CitaResponse,
  ContextoResponse,
  CuotaResponse,
  DiaLibreCreate,
  DiaLibreResponse,
  LoginMovilResponse,
  MeResponse,
  MisDiasLibresResponse,
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
  let respuesta: Response
  try {
    respuesta = await fetch(url, { method: metodo, headers: cabeceras, body, signal: control.signal })
  } catch (error) {
    throw aApiError(error)
  } finally {
    clearTimeout(temporizador)
  }

  const texto = await respuesta.text().catch(() => '')
  const datos = jsonSeguro(texto)
  if (!respuesta.ok) {
    if (respuesta.status === 401 && token) {
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

export function me(token?: string): Promise<MeResponse> {
  return peticion<MeResponse>('/api/auth/me', { token })
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
 * quedaría en los logs de peticiones del proveedor (con la hora y la persona). Sin punto, GET.
 */
export function contexto(punto?: PuntoConsulta | null): Promise<ContextoResponse> {
  if (!punto) return peticion<ContextoResponse>('/api/me/contexto')
  return peticion<ContextoResponse>('/api/me/contexto', {
    metodo: 'POST',
    cuerpo: {
      lat: Math.round(punto.lat * 1e6) / 1e6,
      lng: Math.round(punto.lng * 1e6) / 1e6,
      precision: punto.precision != null ? Math.round(punto.precision) : null,
    },
  })
}

export function visitas(fecha?: string): Promise<VisitasResponse> {
  return peticion<VisitasResponse>('/api/me/visitas', { query: { fecha } })
}

export function crearVisita(cuerpo: VisitaCreate, timeoutMs?: number): Promise<VisitaCreateResponse> {
  return peticion<VisitaCreateResponse>('/api/me/visitas', { metodo: 'POST', cuerpo, timeoutMs })
}

export function editarVisita(id: string, cambios: VisitaUpdate): Promise<{ visita: VisitaItem }> {
  return peticion<{ visita: VisitaItem }>(`/api/me/visitas/${encodeURIComponent(id)}`, { metodo: 'PATCH', cuerpo: cambios })
}

export function anularVisita(id: string, motivo: string): Promise<unknown> {
  return peticion(`/api/me/visitas/${encodeURIComponent(id)}/anular`, { metodo: 'POST', cuerpo: { motivo } })
}

// --- Voz -----------------------------------------------------------------------------------------------------

/** Tipo MIME por la extensión del archivo grabado (m4a en iPhone y Android, webm en el navegador). */
export function tipoAudio(uri: string): { tipo: string; nombre: string } {
  const limpia = uri.split('?')[0].toLowerCase()
  if (limpia.endsWith('.webm')) return { tipo: 'audio/webm', nombre: 'dictado.webm' }
  if (limpia.endsWith('.mp4')) return { tipo: 'audio/mp4', nombre: 'dictado.mp4' }
  if (limpia.endsWith('.aac')) return { tipo: 'audio/aac', nombre: 'dictado.aac' }
  return { tipo: 'audio/m4a', nombre: 'dictado.m4a' }
}

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
    const { tipo, nombre } = tipoAudio(uri)
    // React Native acepta { uri, name, type } como archivo en FormData.
    formulario.append('audio', { uri, name: nombre, type: tipo } as unknown as Blob)
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

// --- Agenda (F4.1, migración 0840) ---------------------------------------------------------------------------

/** Sus citas (sin fechas: de hoy a hoy + 7; como mucho 31 días; sin las canceladas salvo `canceladas`). 503 sin la 0840. */
export function agenda(desde?: string, hasta?: string, canceladas?: boolean): Promise<AgendaResponse> {
  return peticion<AgendaResponse>('/api/me/agenda', { query: { desde, hasta, canceladas: canceladas ? 'true' : undefined } })
}

/** Agenda una cita (201). 400 con { error, errores? } por forma, ventana, día libre, perfil, médico, cuenta o subtipo; 409 repetida. */
export function agendar(cuerpo: CitaCreate): Promise<CitaResponse> {
  return peticion<CitaResponse>('/api/me/agenda', { metodo: 'POST', cuerpo })
}

/** Cancela una cita propia pendiente de hoy en adelante (el motivo es opcional, hasta 300 caracteres). */
export function cancelarCita(id: string, motivo?: string | null): Promise<CitaResponse> {
  const limpio = motivo?.trim() ? motivo.trim().slice(0, 300) : null
  return peticion<CitaResponse>(`/api/me/agenda/${encodeURIComponent(id)}/cancelar`, { metodo: 'POST', cuerpo: { motivo: limpio } })
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

/** Crea un médico completo (409 con { existente } si el documento ya está). */
export function crearMedico(datos: MedicoCreate): Promise<MedicoCreateResponse> {
  return peticion<MedicoCreateResponse>('/api/terceros/medicos', { metodo: 'POST', cuerpo: datos })
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
export function vincularSedeMedico(medicoId: string, sede: MedicoSedeCreate): Promise<{ medico: MedicoPublico }> {
  return peticion<{ medico: MedicoPublico }>(`/api/terceros/medicos/${encodeURIComponent(medicoId)}/sedes`, { metodo: 'POST', cuerpo: sede })
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
export function crearCuenta(datos: CuentaCreate): Promise<CuentaCreateResponse> {
  return peticion<CuentaCreateResponse>('/api/terceros/cuentas', { metodo: 'POST', cuerpo: datos })
}

/** Crea una sede con el GPS del sitio (origen 'gps_app'). */
export function crearSede(datos: SedeCreateGps): Promise<SedeCreateResponse> {
  return peticion<SedeCreateResponse>('/api/terceros/sedes', { metodo: 'POST', cuerpo: datos })
}

/** Departamentos de Colombia (código DANE de 2 dígitos). */
export function departamentos(): Promise<LugarItem[]> {
  return peticion<LugarItem[]>('/api/locations/departments')
}

/** Municipios de un departamento (código DANE de 5 dígitos y nombre). */
export function municipios(departamentoId: string): Promise<LugarItem[]> {
  return peticion<LugarItem[]>('/api/locations/municipalities', { query: { departmentId: departamentoId } })
}
