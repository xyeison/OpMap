/**
 * La pastilla del croquis "En rango / Fuera de rango" (dueño, 2026-10-31: "una bolita roja con 'fuera de rango' o
 * 'en rango', y que aparezca el puntico del comercial"; spec docs/specs/2026-10-31-reportar-croquis-en-rango.md).
 * Pura, sin react-native: la prueba scripts/checks/24-rango.ts.
 *
 * Imita la regla del servidor (0940, visitas_registrar): "en sitio" si la distancia a la sede, DESCONTANDO la precisión
 * del GPS, no pasa del radio presencial. Solo avisa; la marca que vale la pone el servidor al confirmar.
 */
import { esPunto, haversineM, textoDistancia, type Punto } from './geo'

export type ClaseRango = 'en_rango' | 'fuera' | 'sin_ubicacion' | 'sede_sin_ubicacion'

export interface EstadoRango {
  clase: ClaseRango
  tono: 'exito' | 'peligro' | 'neutro'
  texto: string
}

export interface EntradaRango {
  /** Tu punto (null: el teléfono no dio la ubicación). */
  punto: (Punto & { precision?: number | null }) | null
  /** Distancia a la sede en metros; null si no se sabe. */
  distanciaM: number | null
  /** false: la distancia la calcula el servidor (sede traída sin coordenadas conocidas) → no se dice nada. */
  conocida: boolean
  radioM: number
  /** Visita telefónica: la ubicación no cuenta. */
  telefonica?: boolean
}

/**
 * ¿Dentro del radio descontando la precisión del GPS? La misma cuenta que el servidor (0940: la precisión redondeada a
 * metros enteros) y que marcasPrevistas.
 */
export function dentroDelRadioConPrecision(distanciaM: number, precision: number | null | undefined, radioM: number): boolean {
  const p = typeof precision === 'number' && Number.isFinite(precision) && precision > 0 ? Math.round(precision) : 0
  return Math.max(distanciaM - p, 0) <= radioM
}

export function estadoDeRango(entrada: EntradaRango): EstadoRango | null {
  if (entrada.telefonica) return null
  if (!entrada.punto || !esPunto(entrada.punto.lat, entrada.punto.lng)) return { clase: 'sin_ubicacion', tono: 'neutro', texto: 'Sin ubicación' }
  if (!entrada.conocida) return null
  if (entrada.distanciaM === null || !Number.isFinite(entrada.distanciaM)) return { clase: 'sede_sin_ubicacion', tono: 'neutro', texto: 'Sede sin ubicación' }
  if (dentroDelRadioConPrecision(entrada.distanciaM, entrada.punto.precision, entrada.radioM)) return { clase: 'en_rango', tono: 'exito', texto: 'En rango' }
  return { clase: 'fuera', tono: 'peligro', texto: `Fuera de rango · ${textoDistancia(entrada.distanciaM)}` }
}

/**
 * El estado contra una sede con sus coordenadas (la de la cita o la elegida en "¿Dónde estás?"). Sin coordenadas: si la
 * app sabe que no las tiene (`coordenadas_desconocidas` false o ausente), "Sede sin ubicación"; si no se sabe, nada.
 */
export function rangoDeSede(
  sede: { lat: number | null; lng: number | null; coordenadas_desconocidas?: boolean } | null,
  punto: (Punto & { precision?: number | null }) | null,
  radioM: number
): EstadoRango | null {
  if (!sede) return null
  const ubicada = esPunto(sede.lat, sede.lng)
  const distanciaM = ubicada && punto && esPunto(punto.lat, punto.lng) ? haversineM(punto, { lat: sede.lat as number, lng: sede.lng as number }) : null
  return estadoDeRango({ punto, distanciaM, conocida: ubicada || !sede.coordenadas_desconocidas, radioM })
}
