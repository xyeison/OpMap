/**
 * Pestañas de la barra de abajo y pantallas sin pestaña (puro, sin react-native: lo leen las pruebas en Node).
 * app/(app)/_layout.tsx dibuja la barra con estas listas (spec 2026-10-15, decisión 6):
 *
 *   Hoy · Reportar · Agenda · Números · Ajustes
 *
 * Cada pestaña lleva su ícono (relleno si está elegida, contorno si no) y el nombre debajo, entero: 8 letras o menos
 * caben a 11 pt en las 5 pestañas de un iPhone. "Días libres" dejó la barra: se abre desde Agenda y desde Ajustes
 * (ruta /dias-libres, con "Volver"). Para devolverla a la barra basta con moverla de OCULTAS a PESTANAS.
 *
 * Toda ruta de app/(app)/ tiene que estar en una de las dos listas: expo-router pone como pestaña visible cualquier
 * pantalla que el layout no nombre (lo revisa la sección 15 de scripts/movil-check.ts).
 */
import type { NombreIcono } from './iconos-nombres'

/** Letras como máximo en el nombre de una pestaña (para que quepa entero, sin "…"). */
export const MAX_LETRAS_PESTANA = 8

export interface Pestana {
  /** Ruta dentro de app/(app)/ (el `name` de <Tabs.Screen>). */
  ruta: 'hoy' | 'reportar' | 'agenda' | 'numeros' | 'ajustes'
  /** Nombre bajo el ícono. */
  titulo: string
  /** Título del encabezado (blanco, con el título grande), si no es el mismo de la pestaña. */
  encabezado?: string
  icono: NombreIcono
}

export const PESTANAS: readonly Pestana[] = [
  { ruta: 'hoy', titulo: 'Hoy', icono: 'hoy' },
  { ruta: 'reportar', titulo: 'Reportar', icono: 'reportar' },
  { ruta: 'agenda', titulo: 'Agenda', encabezado: 'Mi agenda', icono: 'agenda' },
  { ruta: 'numeros', titulo: 'Números', encabezado: 'Mis números', icono: 'numeros' },
  { ruta: 'ajustes', titulo: 'Ajustes', icono: 'ajustes' },
]

export interface PantallaOculta {
  /** Ruta dentro de app/(app)/ (el `name` de <Tabs.Screen>). */
  ruta: string
  /** Título del encabezado (la pantalla abre con "Volver"). */
  encabezado: string
}

/** Pantallas del grupo sin pestaña propia (`href: null`): se abren desde otra pantalla y vuelven con "Volver". */
export const OCULTAS: readonly PantallaOculta[] = [
  { ruta: 'dias-libres', encabezado: 'Mis días libres' },
  { ruta: 'agenda/nueva', encabezado: 'Agendar' },
  { ruta: 'visita/[id]', encabezado: 'Visita' },
  { ruta: 'medico/nuevo', encabezado: 'Nuevo médico' },
  { ruta: 'sede/nueva', encabezado: 'Nueva sede' },
  // App sin señal (2026-10-30): cómo agregarla a la pantalla de inicio (Android e iPhone).
  { ruta: 'instalar', encabezado: 'Agregar a inicio' },
]

/**
 * Pestañas sin encabezado (estilo Uber, 2026-10-15): arriba va el croquis (components/Croquis.tsx) y el título está
 * en la hoja blanca que sube sobre él ("Hola, Carmen", "¿Dónde estás?").
 */
export const SIN_ENCABEZADO: readonly Pestana['ruta'][] = ['hoy', 'reportar']

/** Letras de un nombre (cuenta "ú" como una sola). */
export function letras(texto: string): number {
  return Array.from(texto).length
}
