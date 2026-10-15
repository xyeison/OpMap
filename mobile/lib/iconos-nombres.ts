/**
 * Íconos de la app (puro, sin react-native: lo leen las pruebas en Node). Cada nombre propio va a un glifo de
 * Ionicons (@expo/vector-icons, incluido en Expo Go SDK 57): `relleno` para la pestaña activa o lo elegido,
 * `contorno` para el resto. lib/iconos.tsx dibuja el ícono con este mapa (spec 2026-10-15, decisión 10).
 *
 * Estilo Uber (2026-10-15): las pestañas siguen los artboards (sol para Hoy, micrófono para Reportar, controles para
 * Ajustes) y se suman ubicación (centrar el croquis), compromiso (portapapeles), buscar y agregar ("+ Agendar").
 */

export type NombreIcono =
  | 'hoy'
  | 'reportar'
  | 'agenda'
  | 'numeros'
  | 'ajustes'
  | 'microfono'
  | 'calendario'
  | 'reloj'
  | 'atras'
  | 'adelante'
  | 'mas'
  | 'check'
  | 'cerrar'
  | 'alerta'
  | 'ubicacion'
  | 'compromiso'
  | 'buscar'
  | 'agregar'

export interface GlifosIcono {
  /** Glifo de Ionicons para lo activo o elegido. */
  relleno: string
  /** Glifo de Ionicons para lo demás (`<relleno>-outline`). */
  contorno: string
}

const glifos = (base: string): GlifosIcono => ({ relleno: base, contorno: `${base}-outline` })

export const GLIFOS_ICONOS: Readonly<Record<NombreIcono, GlifosIcono>> = {
  hoy: glifos('sunny'),
  reportar: glifos('mic'),
  agenda: glifos('calendar'),
  numeros: glifos('stats-chart'),
  ajustes: glifos('options'),
  microfono: glifos('mic'),
  calendario: glifos('calendar-number'),
  reloj: glifos('time'),
  atras: glifos('chevron-back'),
  adelante: glifos('chevron-forward'),
  mas: glifos('add-circle'),
  check: glifos('checkmark-circle'),
  cerrar: glifos('close'),
  alerta: glifos('alert-circle'),
  ubicacion: glifos('locate'),
  compromiso: glifos('clipboard'),
  buscar: glifos('search'),
  agregar: glifos('add'),
}

/** Glifo de Ionicons de un ícono: relleno si está activo, contorno si no. */
export function glifoDe(nombre: NombreIcono, activo = false): string {
  const glifo = GLIFOS_ICONOS[nombre]
  return activo ? glifo.relleno : glifo.contorno
}
