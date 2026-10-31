/**
 * Equipo sin señal (spec, Entrega 2): Equipo lee en vivo; sin red muestra lo último que cargó con "Visto hace N min" y
 * no deja cambiar de día ni de periodo. Solo se guarda la última respuesta de cada pantalla (en el almacén de la app:
 * localStorage en el navegador, AsyncStorage en el teléfono); nada va a la cola.
 */
import { guardarJson, leerJson } from './almacen'
import { CLAVE_EQUIPO_HOY, CLAVE_EQUIPO_RENDIMIENTO } from './equipo'

export { CLAVE_EQUIPO_HOY, CLAVE_EQUIPO_RENDIMIENTO }

export interface Guardado<T> {
  /** Instante ISO en que se guardó. */
  visto_at: string
  /** Con qué se pidió (fecha, o desde/hasta y filtros): para saber si lo guardado es lo que se mira. */
  clave: string
  datos: T
}

export async function leerUltimo<T>(clave: string): Promise<Guardado<T> | null> {
  const g = await leerJson<Guardado<T>>(clave).catch(() => null)
  return g && typeof g.visto_at === 'string' && typeof g.clave === 'string' && g.datos !== undefined ? g : null
}

export async function guardarUltimo<T>(clave: string, pedido: string, datos: T, ahora: Date = new Date()): Promise<void> {
  const g: Guardado<T> = { visto_at: ahora.toISOString(), clave: pedido, datos }
  await guardarJson(clave, g).catch(() => undefined)
}
