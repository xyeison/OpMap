// Geocodificación de la DIRECCIÓN DEL CONSULTORIO de un médico con Google (Geocoding API). SOLO SERVIDOR.
// Decisión del dueño 2026-10-31 (docs/decisiones/2026-10-31-consultorio-por-direccion.md): el consultorio se crea con
// la dirección que escribe la líder y se ubica con ella SOLO con certeza; sin certeza queda "sin ubicar" (nunca una
// coordenada aproximada ni el centro del municipio). Solo para el consultorio: las demás sedes siguen la regla del
// 2026-10-11 (por nombre y con certeza, pendiente D4).
//
// Costo: una petición por consultorio ≈ 0,005 USD (Geocoding "Essentials": 5 USD por 1.000). Es el segundo archivo que
// llama a Google (con google-distance.ts): el interruptor GOOGLE_ROUTES_DISABLED=true también lo apaga, y entonces el
// consultorio se crea sin ubicar. La API key nunca se escribe en logs (la URL la contiene: no se registra la URL).
import { googleRoutesDisabled, type FetchLike, type LatLng } from './google-distance'

export const GOOGLE_GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json'
/** Precio de referencia por petición (Geocoding: 5 USD por 1.000). */
export const COSTO_GEOCODIFICACION_USD = 0.005
/** Más lejos del centro del municipio elegido no es ese consultorio (Bogotá mide unos 30 km de punta a punta). */
export const RADIO_MAXIMO_KM = 40
/** Solo estos dan certeza de que Google encontró ESA dirección (no la calle, ni el barrio, ni la ciudad). */
export const TIPOS_CON_CERTEZA = ['ROOFTOP', 'RANGE_INTERPOLATED'] as const

const REQUEST_TIMEOUT_MS = 15_000

export type MotivoSinUbicar = 'deshabilitado' | 'sin_clave' | 'sin_resultado' | 'sin_certeza' | 'lejos' | 'error'

export type ResultadoGeocodificacion =
  | { ubicada: true; lat: number; lng: number; location_type: string; formatted_address: string | null }
  | { ubicada: false; motivo: MotivoSinUbicar; detalle?: string }

/** Lo mínimo de la respuesta de Google que se mira. */
export interface RespuestaGeocode {
  status: string
  results?: {
    geometry?: { location?: { lat?: number; lng?: number }; location_type?: string }
    partial_match?: boolean
    formatted_address?: string
  }[]
  error_message?: string
}

export interface DireccionAUbicar {
  direccion: string
  /** Nombre del municipio (p. ej. "Bucaramanga") y, si se sabe, del departamento. */
  municipio: string
  departamento?: string | null
  /** Centro del municipio (municipalities.lat/lng), para descartar un resultado en otra parte. */
  centro: LatLng | null
}

export interface OpcionesGeocodificar {
  apiKey?: string
  fetchImpl?: FetchLike
}

function redondear6(valor: number): number {
  return Math.round(valor * 1e6) / 1e6
}

/** Distancia en línea recta (haversine), solo para saber si el resultado cae en el municipio. */
export function distanciaKm(a: LatLng, b: LatLng): number {
  const r = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const la1 = (a.lat * Math.PI) / 180
  const la2 = (b.lat * Math.PI) / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2
  return 2 * r * Math.asin(Math.sqrt(h))
}

/**
 * Qué se guarda de una respuesta de Google (pura: se prueba sin red). Certeza = status OK, primer resultado con
 * location_type ROOFTOP o RANGE_INTERPOLATED, sin partial_match, coordenadas válidas, UN solo resultado y a menos de
 * RADIO_MAXIMO_KM del centro del municipio (sin centro conocido, no hay certeza). Todo lo demás es "sin ubicar".
 */
export function evaluarGeocodificacion(respuesta: RespuestaGeocode, centro: LatLng | null): ResultadoGeocodificacion {
  if (respuesta.status === 'ZERO_RESULTS') return { ubicada: false, motivo: 'sin_resultado' }
  if (respuesta.status !== 'OK') return { ubicada: false, motivo: 'error', detalle: respuesta.status }
  // Varios resultados = dirección ambigua (la misma calle y número en dos municipios vecinos): no hay certeza.
  if ((respuesta.results?.length ?? 0) > 1) return { ubicada: false, motivo: 'sin_certeza', detalle: 'varios resultados' }
  const primero = respuesta.results?.[0]
  const lat = primero?.geometry?.location?.lat
  const lng = primero?.geometry?.location?.lng
  if (!primero || typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { ubicada: false, motivo: 'sin_resultado' }
  }
  const tipo = primero.geometry?.location_type ?? ''
  if (primero.partial_match === true || !(TIPOS_CON_CERTEZA as readonly string[]).includes(tipo)) {
    return { ubicada: false, motivo: 'sin_certeza', detalle: tipo || 'sin location_type' }
  }
  // Sin el centro del municipio no se puede descartar un punto en otra ciudad: tampoco hay certeza.
  if (!centro) return { ubicada: false, motivo: 'sin_certeza', detalle: 'sin centro del municipio' }
  if (distanciaKm(centro, { lat, lng }) > RADIO_MAXIMO_KM) return { ubicada: false, motivo: 'lejos' }
  return { ubicada: true, lat: redondear6(lat), lng: redondear6(lng), location_type: tipo, formatted_address: primero.formatted_address ?? null }
}

/** La URL de la petición (sin la clave): dirección + municipio (+ departamento), Colombia, en español. */
export function urlGeocodificar(entrada: DireccionAUbicar): URL {
  const url = new URL(GOOGLE_GEOCODE_URL)
  const partes = [entrada.direccion.trim(), entrada.municipio.trim(), entrada.departamento?.trim() || null, 'Colombia'].filter(Boolean)
  url.searchParams.set('address', partes.join(', '))
  url.searchParams.set('components', 'country:CO')
  url.searchParams.set('region', 'co')
  url.searchParams.set('language', 'es')
  return url
}

/**
 * Una petición a Google por la dirección del consultorio. Nunca lanza: sin Google (deshabilitado, sin clave, red,
 * HTTP) devuelve "sin ubicar" con el motivo, y quien llama crea el consultorio igual.
 */
export async function geocodificarDireccion(entrada: DireccionAUbicar, opciones: OpcionesGeocodificar = {}): Promise<ResultadoGeocodificacion> {
  if (googleRoutesDisabled()) return { ubicada: false, motivo: 'deshabilitado' }
  const apiKey = opciones.apiKey ?? process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) return { ubicada: false, motivo: 'sin_clave' }
  if (!entrada.direccion.trim() || !entrada.municipio.trim()) return { ubicada: false, motivo: 'sin_resultado' }
  const fetchImpl: FetchLike = opciones.fetchImpl ?? ((url, init) => fetch(url, init as RequestInit))

  const url = urlGeocodificar(entrada)
  url.searchParams.set('key', apiKey)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const respuesta = await fetchImpl(url.toString(), { signal: controller.signal, cache: 'no-store' })
    if (!respuesta.ok) return { ubicada: false, motivo: 'error', detalle: `HTTP_${respuesta.status}` }
    const cuerpo = (await respuesta.json()) as RespuestaGeocode
    return evaluarGeocodificacion(cuerpo, entrada.centro)
  } catch (error) {
    return { ubicada: false, motivo: 'error', detalle: error instanceof Error ? error.name : 'Error' }
  } finally {
    clearTimeout(timer)
  }
}

/** Texto para la persona que creó el consultorio. */
export function textoGeocodificacion(resultado: ResultadoGeocodificacion): string {
  if (resultado.ubicada) return 'Consultorio ubicado por su dirección (el equipo de datos la confirma).'
  switch (resultado.motivo) {
    case 'sin_certeza':
    case 'lejos':
    case 'sin_resultado':
      return 'No encontré esa dirección con certeza: el consultorio quedó sin ubicar y el equipo de datos lo ubicará.'
    default:
      return 'No pude ubicar la dirección ahora: el consultorio quedó sin ubicar y el equipo de datos lo ubicará.'
  }
}
