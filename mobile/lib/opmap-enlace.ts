/**
 * El botón "OpMap" de la franja de estado (dueño, 2026-10-31: en Agendamiento "se pierde la noción de lo otro que tenemos,
 * que hace parte del mismo ecosistema"; spec docs/specs/2026-10-31-diseno-unificado-vista-de-modulos.md, etapa 2a).
 * Vuelve al inicio de módulos de OpMap (/inicio, la cuadrícula tipo iPhone). Puro, sin react-native: lo prueba
 * scripts/checks/25-inicio-opmap.ts.
 *
 * - En el navegador, en la misma pestaña (la sesión es la misma cookie: ingreso único; la cola sin señal se queda en
 *   IndexedDB y sigue cuando se vuelva a abrir /campo).
 * - Instalada en el teléfono (standalone), en otra pestaña del navegador: la app instalada no se cierra ni pierde nada.
 * - Sin señal, no sale: OpMap necesita señal; avisa y los pendientes siguen aquí.
 * - En el teléfono compilado o en Expo Go no hay OpMap que abrir: el botón no se muestra.
 */

export const RUTA_INICIO_OPMAP = '/inicio'
export const MENSAJE_OPMAP_SIN_SENAL = 'OpMap necesita señal. Tus pendientes siguen aquí y se suben al volver.'

export type DestinoOpMap = { modo: 'oculto' } | { modo: 'sin_senal' } | { modo: 'ir'; url: string; nuevaPestana: boolean }

export function destinoOpMap(entrada: { navegador: boolean; instalada: boolean | null; enLinea: boolean }): DestinoOpMap {
  if (!entrada.navegador) return { modo: 'oculto' }
  if (!entrada.enLinea) return { modo: 'sin_senal' }
  return { modo: 'ir', url: RUTA_INICIO_OPMAP, nuevaPestana: entrada.instalada === true }
}
