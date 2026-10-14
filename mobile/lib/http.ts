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

/** Normaliza la URL base: sin espacios ni barras finales; vacía → producción. */
export function normalizarBase(valor: string | null | undefined): string {
  const limpia = (valor ?? '').trim().replace(/\/+$/, '')
  return limpia || URL_PRODUCCION
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
