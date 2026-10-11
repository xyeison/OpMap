// Cliente de Google Distance Matrix para la Fase 2b (municipios sin IPS). SOLO SERVIDOR / scripts.
//
// Regla de negocio: los municipios se reparten por TIEMPO REAL DE CARRETERA (mode=driving), nunca
// por distancia en línea recta. Por eso cada elemento se clasifica en:
//   - 'ok'       → Google devolvió una ruta (minutos y km).
//   - 'no_route' → ZERO_RESULTS / NOT_FOUND: Google no encuentra ruta por carretera ("sin acceso terrestre").
//   - 'error'    → cualquier otro estado del elemento (se reintentará en una próxima ejecución).
//
// Límites por petición de Google: 25 orígenes, 25 destinos y 100 elementos (orígenes x destinos).
// Google factura por elemento: cada respuesta informa cuántos elementos pudo haber facturado.
// Interruptor de emergencia: GOOGLE_ROUTES_DISABLED=true → no se hace ninguna petición.
// La API key nunca se escribe en logs (la URL la contiene: no se registra la URL).

export const GOOGLE_DISTANCE_MATRIX_URL = 'https://maps.googleapis.com/maps/api/distancematrix/json'
export const MAX_ORIGINS = 25
export const MAX_DESTINATIONS = 25
export const MAX_ELEMENTS = 100
/** Precio de referencia por elemento (Distance Matrix "Basic": 5 USD por 1.000 elementos). */
export const COST_PER_ELEMENT_USD = 0.005

const REQUEST_TIMEOUT_MS = 30_000

export interface LatLng {
  lat: number
  lng: number
}

export type RouteStatus = 'ok' | 'no_route' | 'error'

export interface DistanceElement {
  status: RouteStatus
  /** Estado literal de Google para el elemento (OK, ZERO_RESULTS, NOT_FOUND, ...). */
  google_status: string
  seconds: number | null
  minutes: number | null
  distance_km: number | null
}

export interface DistanceMatrixResult {
  /** true si Google respondió status OK (rows tiene un elemento por par origen-destino). */
  ok: boolean
  /** Estado de la respuesta: OK, ZERO_RESULTS..., HTTP_500, NETWORK_ERROR, etc. */
  status: string
  /** rows[i][j] = origen i → destino j. Vacío si !ok. */
  rows: DistanceElement[][]
  /** Elementos que Google pudo haber facturado (peor caso cuando la respuesta no lo aclara). */
  elements_billed: number
  /** true si no se sabe si se facturó (error de red: la petición pudo llegar o no). */
  billing_uncertain: boolean
  /** true si conviene ABORTAR toda la ejecución (clave denegada, cuota agotada...). */
  fatal: boolean
  /** Peticiones HTTP hechas (1 o 2 si hubo reintento por error de red). */
  attempts: number
}

/** Lo mínimo de fetch que usa el cliente (permite inyectar un doble en pruebas, sin llamar a Google). */
export type FetchLike = (
  url: string,
  init?: { signal?: AbortSignal; cache?: 'no-store' }
) => Promise<{ ok: boolean; status: number; json(): Promise<any> }>

export interface DistanceMatrixOptions {
  apiKey?: string
  fetchImpl?: FetchLike
  /** Reintentos ante error de red (por defecto 1). */
  networkRetries?: number
}

export class GoogleRoutesDisabledError extends Error {
  constructor() {
    super('El cálculo de rutas con Google está deshabilitado (GOOGLE_ROUTES_DISABLED=true)')
    this.name = 'GoogleRoutesDisabledError'
  }
}

/** Interruptor de emergencia: GOOGLE_ROUTES_DISABLED=true bloquea toda llamada a Google. */
export function googleRoutesDisabled(): boolean {
  return (process.env.GOOGLE_ROUTES_DISABLED || '').trim().toLowerCase() === 'true'
}

/** true si la petición falló por red/timeout (sin respuesta de Google): candidata a reintento. */
export function isNetworkErrorResult(result: Pick<DistanceMatrixResult, 'status'>): boolean {
  return result.status.startsWith('NETWORK_ERROR')
}

/** Estado de un elemento de Google → estado guardado en municipality_travel_times. */
export function classifyElementStatus(googleStatus: string): RouteStatus {
  if (googleStatus === 'OK') return 'ok'
  if (googleStatus === 'ZERO_RESULTS' || googleStatus === 'NOT_FOUND') return 'no_route'
  return 'error'
}

// Estados de respuesta que no facturan (petición rechazada antes de calcular)
const NOT_BILLED_STATUSES = new Set([
  'INVALID_REQUEST',
  'REQUEST_DENIED',
  'OVER_DAILY_LIMIT',
  'MAX_ELEMENTS_EXCEEDED',
  'MAX_DIMENSIONS_EXCEEDED',
])
// Estados que deben detener toda la ejecución: seguir solo gastaría o fallaría igual
const FATAL_STATUSES = new Set(['REQUEST_DENIED', 'OVER_DAILY_LIMIT', 'OVER_QUERY_LIMIT'])

function formatPoint(point: LatLng): string {
  return `${Number(point.lat).toFixed(6)},${Number(point.lng).toFixed(6)}`
}

function validPoint(point: LatLng): boolean {
  return Number.isFinite(Number(point.lat)) && Number.isFinite(Number(point.lng))
}

function parseElement(raw: any): DistanceElement {
  const googleStatus = String(raw?.status ?? 'UNKNOWN')
  const status = classifyElementStatus(googleStatus)
  const seconds = Number(raw?.duration?.value)
  const meters = Number(raw?.distance?.value)
  if (status === 'ok' && Number.isFinite(seconds) && seconds >= 0) {
    return {
      status,
      google_status: googleStatus,
      seconds: Math.round(seconds),
      minutes: Math.round(seconds / 60),
      distance_km: Number.isFinite(meters) ? Number((meters / 1000).toFixed(2)) : null,
    }
  }
  // OK sin duración utilizable: se trata como error (se reintentará)
  return {
    status: status === 'ok' ? 'error' : status,
    google_status: status === 'ok' ? 'OK_WITHOUT_DURATION' : googleStatus,
    seconds: null,
    minutes: null,
    distance_km: null,
  }
}

/**
 * Una petición a Distance Matrix (driving, métrico, español, región Colombia).
 * Lanza GoogleRoutesDisabledError si GOOGLE_ROUTES_DISABLED=true y Error si falta la key o se
 * superan los límites por petición. Los errores de Google/HTTP/red NO lanzan: se devuelven en el
 * resultado (ok=false) para que quien llama decida.
 */
export async function requestDistanceMatrix(
  origins: LatLng[],
  destinations: LatLng[],
  options: DistanceMatrixOptions = {}
): Promise<DistanceMatrixResult> {
  if (googleRoutesDisabled()) throw new GoogleRoutesDisabledError()

  const elementsRequested = origins.length * destinations.length
  if (elementsRequested === 0) {
    return { ok: true, status: 'EMPTY', rows: [], elements_billed: 0, billing_uncertain: false, fatal: false, attempts: 0 }
  }
  if (origins.length > MAX_ORIGINS || destinations.length > MAX_DESTINATIONS || elementsRequested > MAX_ELEMENTS) {
    throw new Error('Distance Matrix: se superan los límites por petición (25 orígenes, 25 destinos, 100 elementos)')
  }
  if (!origins.every(validPoint) || !destinations.every(validPoint)) {
    throw new Error('Distance Matrix: hay coordenadas no válidas')
  }

  const apiKey = options.apiKey ?? process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) throw new Error('GOOGLE_MAPS_API_KEY no configurada')
  const fetchImpl: FetchLike = options.fetchImpl ?? ((url, init) => fetch(url, init as RequestInit))
  const networkRetries = Math.max(0, options.networkRetries ?? 1)

  const url = new URL(GOOGLE_DISTANCE_MATRIX_URL)
  url.searchParams.set('origins', origins.map(formatPoint).join('|'))
  url.searchParams.set('destinations', destinations.map(formatPoint).join('|'))
  url.searchParams.set('mode', 'driving')
  url.searchParams.set('units', 'metric')
  url.searchParams.set('language', 'es')
  url.searchParams.set('region', 'co')
  url.searchParams.set('key', apiKey)
  const requestUrl = url.toString()

  let attempts = 0
  let lastNetworkError = ''
  for (let attempt = 0; attempt <= networkRetries; attempt++) {
    attempts++
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    let response: Awaited<ReturnType<FetchLike>>
    try {
      response = await fetchImpl(requestUrl, { signal: controller.signal, cache: 'no-store' })
    } catch (error) {
      clearTimeout(timer)
      lastNetworkError = error instanceof Error ? error.name : 'Error'
      continue // error de red o timeout: se reintenta (como mucho networkRetries veces)
    }
    clearTimeout(timer)

    if (!response.ok) {
      // Sin cuerpo válido no se sabe si facturó: peor caso
      return {
        ok: false,
        status: `HTTP_${response.status}`,
        rows: [],
        elements_billed: elementsRequested,
        billing_uncertain: true,
        fatal: response.status === 401 || response.status === 403,
        attempts,
      }
    }

    let data: any
    try {
      data = await response.json()
    } catch {
      return {
        ok: false,
        status: 'INVALID_JSON',
        rows: [],
        elements_billed: elementsRequested,
        billing_uncertain: true,
        fatal: false,
        attempts,
      }
    }

    const status = String(data?.status ?? 'UNKNOWN')
    if (status !== 'OK') {
      return {
        ok: false,
        status,
        rows: [],
        elements_billed: NOT_BILLED_STATUSES.has(status) ? 0 : elementsRequested,
        billing_uncertain: !NOT_BILLED_STATUSES.has(status),
        fatal: FATAL_STATUSES.has(status),
        attempts,
      }
    }

    const rawRows: any[] = Array.isArray(data.rows) ? data.rows : []
    const rows: DistanceElement[][] = origins.map((_, i) => {
      const elements: any[] = Array.isArray(rawRows[i]?.elements) ? rawRows[i].elements : []
      return destinations.map((__, j) => parseElement(elements[j]))
    })
    return { ok: true, status, rows, elements_billed: elementsRequested, billing_uncertain: false, fatal: false, attempts }
  }

  return {
    ok: false,
    status: `NETWORK_ERROR${lastNetworkError ? `:${lastNetworkError}` : ''}`,
    rows: [],
    elements_billed: 0,
    billing_uncertain: true,
    fatal: false,
    attempts,
  }
}
