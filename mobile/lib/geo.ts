/**
 * Geografía pura: la misma Haversine que el servidor (web/lib/reporte-visitas.ts haversineM y la función SQL de
 * la migración 0830): metros enteros con radio medio de la Tierra 6371008.8 m. La app la usa solo para ORDENAR y
 * MOSTRAR distancias; la que vale es la que calcula el servidor contra la sede elegida.
 */

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
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  )
}

/** Distancia legible: "350 m" o "1,2 km" (coma decimal, como en Colombia). */
export function textoDistancia(metros: number): string {
  const m = Math.max(0, Math.round(metros))
  if (m < 1000) return `${m} m`
  return `${(m / 1000).toFixed(1).replace('.', ',')} km`
}

/** Precisión del GPS legible: "±12 m" (null si no se conoce). */
export function textoPrecision(metros: number | null | undefined): string | null {
  if (metros === null || metros === undefined || !Number.isFinite(metros)) return null
  return `±${Math.round(metros)} m`
}

/** Ordena por distancia a un punto (los que no tienen coordenadas van al final) y recorta a `max`. */
export function ordenarPorDistancia<T extends { lat: number | null; lng: number | null }>(
  elementos: readonly T[],
  punto: Punto,
  max: number = 20
): (T & { distancia_m: number | null })[] {
  return elementos
    .map(elemento => ({
      ...elemento,
      distancia_m:
        elemento.lat !== null && elemento.lng !== null && esPunto(elemento.lat, elemento.lng)
          ? haversineM(punto, { lat: elemento.lat, lng: elemento.lng })
          : null,
    }))
    .sort((a, b) => {
      if (a.distancia_m === null) return b.distancia_m === null ? 0 : 1
      if (b.distancia_m === null) return -1
      return a.distancia_m - b.distancia_m
    })
    .slice(0, max)
}

/** ¿La distancia a la sede permite la visita presencial con ese radio? */
export function dentroDelRadio(distanciaM: number, radioM: number): boolean {
  return distanciaM <= radioM
}
