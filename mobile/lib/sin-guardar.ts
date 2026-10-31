/**
 * Lo que aún no se guardó y vive en memoria en una pantalla que sigue montada aunque no esté a la vista (segunda revisión
 * del 2026-10-31): Reportar es una pestaña y conserva sus tarjetas al pasar a Hoy. El botón "OpMap" de la franja
 * (components/EstadoCola.tsx) pregunta antes de salir en esta misma pestaña si alguna pantalla lo marcó. Los formularios
 * con "Volver" no marcan: se desmontan al perder el foco (SoloEnFoco, lib/montaje.tsx) y preguntan por su ruta
 * (preguntaAntesDeIrAOpMap de lib/navegacion.ts).
 */
import { useEffect } from 'react'

const pantallas = new Set<string>()

/** Marca o desmarca una pantalla. Cada pantalla cuenta una vez: marcarla dos veces y desmarcarla una la quita. */
export function marcarSinGuardar(pantalla: string, hay: boolean): void {
  if (hay) pantallas.add(pantalla)
  else pantallas.delete(pantalla)
}

/** ¿Alguna pantalla tiene algo sin guardar? */
export function haySinGuardar(): boolean {
  return pantallas.size > 0
}

/** La pantalla queda marcada mientras `hay` sea cierto; al desmontarse se desmarca. */
export function useSinGuardar(pantalla: string, hay: boolean): void {
  useEffect(() => {
    marcarSinGuardar(pantalla, hay)
    return () => marcarSinGuardar(pantalla, false)
  }, [pantalla, hay])
}
