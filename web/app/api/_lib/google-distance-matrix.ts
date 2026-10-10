// Cliente mínimo de Google Distance Matrix para las rutas de servidor.
// Una petición admite hasta 25 orígenes, 25 destinos y 100 elementos (orígenes x destinos);
// Google factura por elemento, así que cada llamada devuelve cuántos elementos consumió.

export interface LatLng {
  lat: number
  lng: number
}

export interface MatrixElement {
  ok: boolean
  status: string
  durationSeconds: number | null
  distanceKm: number | null
}

export interface MatrixResult {
  ok: boolean
  status: string
  // rows[i][j] = origen i -> destino j
  rows: MatrixElement[][]
  elementsBilled: number
}

export const MAX_ORIGINS = 25
export const MAX_DESTINATIONS = 25
export const MAX_ELEMENTS = 100

/**
 * Interruptor de emergencia: GOOGLE_ROUTES_DISABLED=true bloquea toda llamada a Google.
 */
export function googleRoutesDisabled(): boolean {
  return process.env.GOOGLE_ROUTES_DISABLED === 'true'
}

function formatPoint(point: LatLng): string {
  return `${Number(point.lat).toFixed(6)},${Number(point.lng).toFixed(6)}`
}

export async function distanceMatrix(origins: LatLng[], destinations: LatLng[]): Promise<MatrixResult> {
  if (origins.length === 0 || destinations.length === 0) {
    return { ok: true, status: 'EMPTY', rows: [], elementsBilled: 0 }
  }
  if (
    origins.length > MAX_ORIGINS ||
    destinations.length > MAX_DESTINATIONS ||
    origins.length * destinations.length > MAX_ELEMENTS
  ) {
    throw new Error('Distance Matrix: se superan los límites por petición')
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) {
    throw new Error('GOOGLE_MAPS_API_KEY no configurada')
  }

  const url = new URL('https://maps.googleapis.com/maps/api/distancematrix/json')
  url.searchParams.append('origins', origins.map(formatPoint).join('|'))
  url.searchParams.append('destinations', destinations.map(formatPoint).join('|'))
  url.searchParams.append('mode', 'driving')
  url.searchParams.append('units', 'metric')
  url.searchParams.append('key', apiKey)

  const elementsRequested = origins.length * destinations.length
  const response = await fetch(url.toString(), { cache: 'no-store' })

  if (!response.ok) {
    console.error('Distance Matrix HTTP', response.status)
    // Sin cuerpo válido no podemos saber si facturó; se asume el peor caso
    return { ok: false, status: `HTTP_${response.status}`, rows: [], elementsBilled: elementsRequested }
  }

  const data = await response.json()
  if (data.status !== 'OK') {
    console.error('Distance Matrix status', data.status, data.error_message ? '(con mensaje)' : '')
    const billed = data.status === 'INVALID_REQUEST' || data.status === 'REQUEST_DENIED' ? 0 : elementsRequested
    return { ok: false, status: String(data.status), rows: [], elementsBilled: billed }
  }

  const rows: MatrixElement[][] = (data.rows || []).map((row: any) =>
    (row.elements || []).map((element: any) => {
      const ok = element?.status === 'OK'
      return {
        ok,
        status: String(element?.status ?? 'UNKNOWN'),
        durationSeconds: ok ? Math.round(Number(element.duration.value)) : null,
        distanceKm: ok ? Number((Number(element.distance.value) / 1000).toFixed(2)) : null,
      }
    })
  )

  return { ok: true, status: 'OK', rows, elementsBilled: elementsRequested }
}
