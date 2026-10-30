/**
 * Piezas puras del cliente HTTP (sin React Native): URL del servidor, armado de rutas con parámetros, lectura
 * segura del cuerpo y tiempos máximos. Las usa lib/api.ts y las prueba scripts/movil-check.ts.
 */

/** Producción (Vercel). En desarrollo se cambia con EXPO_PUBLIC_API_URL=http://localhost:3000. */
export const URL_PRODUCCION = 'https://op-map-umber.vercel.app'

/** Tiempo máximo de una petición normal. */
export const TIEMPO_NORMAL_MS = 20_000
/** Tiempo máximo para subir y transcribir un audio (hasta 3 minutos de voz). */
export const TIEMPO_TRANSCRIBIR_MS = 120_000
/** Tiempo máximo para que la IA proponga las visitas. */
export const TIEMPO_PROPONER_MS = 60_000
/** Tiempo máximo de cada envío de la cola sin señal (corto: si no hay red, que lo intente después). */
export const TIEMPO_COLA_MS = 15_000

/**
 * Normaliza la URL base: sin espacios ni barras finales; vacía → `respaldo` (por defecto, producción). En la web
 * (/campo, 2026-10-30) lib/api.ts pasa el origen de la página: la app llama a la API de su mismo sitio, y cada preview
 * a la suya, sin CORS.
 */
export function normalizarBase(valor: string | null | undefined, respaldo?: string | null): string {
  const limpia = (valor ?? '').trim().replace(/\/+$/, '')
  return limpia || (respaldo ?? '').trim().replace(/\/+$/, '') || URL_PRODUCCION
}

export type ValorQuery = string | number | boolean | null | undefined

/**
 * base + ruta + query. La ruta debe empezar por "/api/". Los parámetros null, undefined o "" no se mandan.
 * construirUrl('http://x', '/api/me/visitas', { fecha: '2026-10-13' }) → 'http://x/api/me/visitas?fecha=2026-10-13'
 */
export function construirUrl(base: string, ruta: string, query?: Record<string, ValorQuery>): string {
  if (!ruta.startsWith('/')) throw new Error(`La ruta debe empezar por "/": ${ruta}`)
  const partes: string[] = []
  for (const [clave, valor] of Object.entries(query ?? {})) {
    if (valor === null || valor === undefined || valor === '') continue
    partes.push(`${encodeURIComponent(clave)}=${encodeURIComponent(String(valor))}`)
  }
  return `${normalizarBase(base)}${ruta}${partes.length ? `?${partes.join('&')}` : ''}`
}

/** Convierte el texto del cuerpo en JSON sin lanzar (null si viene vacío o no es JSON). */
export function jsonSeguro(texto: string): unknown {
  if (!texto) return null
  try {
    return JSON.parse(texto)
  } catch {
    return null
  }
}

/** Nombre corto del servidor para mostrar en Ajustes ("op-map-umber.vercel.app", "localhost:3000"). */
export function nombreServidor(base: string): string {
  return normalizarBase(base).replace(/^https?:\/\//, '')
}

/** ¿Es un servidor de desarrollo (http o localhost)? Ajustes lo avisa. */
export function esServidorDesarrollo(base: string): boolean {
  const url = normalizarBase(base)
  return url.startsWith('http://') || /localhost|127\.0\.0\.1|192\.168\.|10\.\d+\./.test(url)
}

// --- Registro de desarrollo (spec 2026-10-15, "Medición") ----------------------------------------------------

const UUID_EN_RUTA = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi

/**
 * La ruta como patrón, para los registros: sin consulta, cada uuid como ":id" y cualquier tramo que no sea una palabra
 * de ruta (minúsculas, "-" y "_") también como ":id". Así nunca lleva ids, nombres, documentos ni coordenadas.
 * rutaPatron('/api/me/visitas/<uuid>/anular') → '/api/me/visitas/:id/anular'
 */
export function rutaPatron(ruta: string): string {
  const sinConsulta = (ruta.split('?')[0] ?? '').split('#')[0] ?? ''
  return sinConsulta
    .replace(UUID_EN_RUTA, ':id')
    .split('/')
    .map((tramo, i) => (i === 0 || tramo === '' || tramo === ':id' || /^[a-z][a-z_-]*$/.test(tramo) ? tramo : ':id'))
    .join('/')
}

/** Lo que registra api.ts en desarrollo por cada petición. Nunca el cuerpo, la consulta ni el token. */
export interface DatosRegistroApi {
  metodo: string
  ruta: string
  /** Código HTTP; null si no hubo respuesta (sin red o tiempo agotado). */
  estado: number | null
  ms: number
  /** Cabecera Server-Timing de la respuesta (del servidor de OpMap: nombres y números). */
  serverTiming?: string | null
}

/** "[api] POST /api/me/contexto 200 412 ms · auth;dur=12, ctx;dur=340, total;dur=380" */
export function lineaRegistroApi(datos: DatosRegistroApi): string {
  const metodo = /^[A-Z]{3,7}$/.test(datos.metodo) ? datos.metodo : 'GET'
  const estado = datos.estado === null ? 'sin respuesta' : String(datos.estado)
  const ms = Number.isFinite(datos.ms) ? Math.max(0, Math.round(datos.ms)) : 0
  // Server-Timing: solo "nombre;dur=número" separados por comas (lo demás se descarta).
  const tiempos = (datos.serverTiming ?? '')
    .split(',')
    .map(parte => parte.trim())
    .filter(parte => /^[a-z][a-z0-9_]{0,23};dur=\d+(\.\d+)?$/.test(parte))
    .slice(0, 12)
    .join(', ')
  return `[api] ${metodo} ${rutaPatron(datos.ruta)} ${estado} ${ms} ms${tiempos ? ` · ${tiempos}` : ''}`
}
