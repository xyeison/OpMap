/**
 * Errores de la API en una forma que la app puede mostrar tal cual. Puro (sin React Native): lo prueba
 * scripts/movil-check.ts y lo usa lib/api.ts.
 *
 * El servidor responde siempre { error } (y en la pre-validación de visitas, { error, errores: [{ campo,
 * mensaje }] }). Si el cuerpo no trae `error`, se traduce el código HTTP a un mensaje en español.
 */
import type { ErrorVisita } from './tipos'

/** Estado 0 = no hubo respuesta (sin señal, servidor caído, tiempo agotado). */
export const SIN_CONEXION = 0

export const MENSAJE_SIN_CONEXION = 'Sin conexión con el servidor. Revisa la señal e inténtalo de nuevo.'
export const MENSAJE_TIEMPO_AGOTADO = 'El servidor tardó demasiado en responder. Inténtalo de nuevo.'
export const MENSAJE_SESION_VENCIDA = 'Tu sesión venció. Vuelve a entrar.'
/** En el navegador: en otra pestaña se salió o entró otra persona (en OpMap o en la app). */
export const MENSAJE_SESION_OTRA_PESTANA = 'La sesión cambió en otra pestaña de este navegador. Vuelve a entrar.'

export type TipoErrorApi = 'red' | 'tiempo' | 'sesion' | 'permiso' | 'no_disponible' | 'datos' | 'servidor' | 'otro'

export class ApiError extends Error {
  readonly status: number
  readonly tipo: TipoErrorApi
  /** Errores por campo (pre-validación de POST /api/me/visitas), si los hubo. */
  readonly errores: ErrorVisita[]
  /** Cuerpo JSON de la respuesta, si lo hubo. */
  readonly cuerpo: unknown

  constructor(status: number, mensaje: string, opciones: { tipo?: TipoErrorApi; errores?: ErrorVisita[]; cuerpo?: unknown } = {}) {
    super(mensaje)
    this.name = 'ApiError'
    this.status = status
    this.tipo = opciones.tipo ?? tipoPorEstado(status)
    this.errores = opciones.errores ?? []
    this.cuerpo = opciones.cuerpo
  }
}

/** Clasifica un código HTTP (0 = sin respuesta). */
export function tipoPorEstado(status: number): TipoErrorApi {
  if (status === SIN_CONEXION) return 'red'
  if (status === 401) return 'sesion'
  if (status === 403) return 'permiso'
  if (status === 503 || status === 502 || status === 404) return 'no_disponible'
  if (status === 400 || status === 409 || status === 413 || status === 422) return 'datos'
  if (status >= 500) return 'servidor'
  return 'otro'
}

/** Mensaje por defecto cuando el cuerpo no trae `error`. */
export function mensajePorEstado(status: number): string {
  switch (status) {
    case SIN_CONEXION:
      return MENSAJE_SIN_CONEXION
    case 400:
      return 'Revisa los datos: el servidor no los aceptó.'
    case 401:
      return MENSAJE_SESION_VENCIDA
    case 403:
      return 'No tienes permiso para hacer esto.'
    case 404:
      return 'Esto todavía no está disponible en el servidor.'
    case 409:
      return 'Ya existe algo igual: vuelve a cargar y revisa.'
    case 413:
      return 'El archivo es demasiado grande.'
    case 429:
      return 'Demasiados intentos. Espera un momento.'
    case 502:
      return 'Un servicio externo falló. Puedes seguir por toques.'
    case 503:
      return 'El servidor no tiene esto configurado todavía.'
    default:
      return status >= 500 ? 'El servidor tuvo un error. Inténtalo de nuevo.' : `Error ${status}`
  }
}

/** Lee `error` y `errores` del cuerpo JSON de una respuesta (sin lanzar: el cuerpo puede ser cualquier cosa). */
export function leerCuerpoError(cuerpo: unknown): { error: string | null; errores: ErrorVisita[] } {
  if (!cuerpo || typeof cuerpo !== 'object') return { error: null, errores: [] }
  const objeto = cuerpo as Record<string, unknown>
  const error = typeof objeto.error === 'string' && objeto.error.trim() ? objeto.error.trim() : null
  const errores = Array.isArray(objeto.errores)
    ? objeto.errores
        .filter(
          (e): e is ErrorVisita =>
            !!e && typeof e === 'object' && typeof (e as ErrorVisita).campo === 'string' && typeof (e as ErrorVisita).mensaje === 'string'
        )
        .map(e => ({ campo: e.campo, mensaje: e.mensaje }))
    : []
  return { error, errores }
}

/** Construye el ApiError de una respuesta HTTP no exitosa. */
export function errorDeRespuesta(status: number, cuerpo: unknown): ApiError {
  const { error, errores } = leerCuerpoError(cuerpo)
  const mensaje = error ?? (errores[0]?.mensaje ? errores[0].mensaje : mensajePorEstado(status))
  return new ApiError(status, mensaje, { errores, cuerpo })
}

/** Convierte cualquier cosa lanzada (ApiError, TypeError de fetch, AbortError...) en un ApiError. */
export function aApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error
  if (error && typeof error === 'object' && (error as { name?: string }).name === 'AbortError') {
    return new ApiError(SIN_CONEXION, MENSAJE_TIEMPO_AGOTADO, { tipo: 'tiempo' })
  }
  if (error instanceof TypeError) return new ApiError(SIN_CONEXION, MENSAJE_SIN_CONEXION, { tipo: 'red' })
  const mensaje = error instanceof Error && error.message ? error.message : 'Ocurrió un error inesperado'
  return new ApiError(SIN_CONEXION, mensaje, { tipo: 'otro' })
}

/** Texto para mostrar en pantalla de cualquier error. */
export function mensajeDeError(error: unknown): string {
  return aApiError(error).message
}

/** ¿Vale la pena reintentar más tarde (sin señal, tiempo agotado o error del servidor)? */
export function esTransitorio(error: unknown): boolean {
  const e = aApiError(error)
  return e.tipo === 'red' || e.tipo === 'tiempo' || e.tipo === 'servidor' || e.status === 429
}

/** ¿Hay que cerrar la sesión (token vencido o revocado)? */
export function esSesionVencida(error: unknown): boolean {
  return aApiError(error).status === 401
}

/** ¿La ruta no existe o no está configurada en el servidor (404/503): usar el respaldo? */
export function esNoDisponible(error: unknown): boolean {
  const s = aApiError(error).status
  return s === 404 || s === 503
}
