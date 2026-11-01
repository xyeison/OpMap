/**
 * Equipo sin señal (spec, Entrega 2): Equipo lee en vivo; sin red muestra lo último que cargó con "Visto hace N min" y
 * no deja cambiar de día ni de periodo. Solo se guarda la última respuesta de cada pantalla (en el almacén de la app:
 * localStorage en el navegador, AsyncStorage en el teléfono); nada va a la cola.
 *
 * Revisión 2026-10-31: lo guardado lleva el uid de quien lo cargó y solo se le devuelve a esa persona, y "Cerrar sesión"
 * lo borra: en un teléfono o navegador compartido, quien entre después no ve el Equipo de la directora.
 */
import { borrarClave, guardarJson, leerJson } from './almacen'
import { CLAVE_EQUIPO_HOY, CLAVE_EQUIPO_RENDIMIENTO } from './equipo'

export { CLAVE_EQUIPO_HOY, CLAVE_EQUIPO_RENDIMIENTO }

export interface Guardado<T> {
  /** Quién lo cargó (users.id). */
  uid: string
  /** Instante ISO en que se guardó. */
  visto_at: string
  /** Con qué se pidió (fecha, o desde/hasta y filtros): para saber si lo guardado es lo que se mira. */
  clave: string
  datos: T
}

/** Lo último guardado de esa pantalla, solo si es de este usuario. */
export async function leerUltimo<T>(clave: string, uid: string): Promise<Guardado<T> | null> {
  const g = await leerJson<Guardado<T>>(clave).catch(() => null)
  return g && typeof g.visto_at === 'string' && typeof g.clave === 'string' && g.datos !== undefined && g.uid === uid ? g : null
}

export async function guardarUltimo<T>(clave: string, uid: string, pedido: string, datos: T, ahora: Date = new Date()): Promise<void> {
  const g: Guardado<T> = { uid, visto_at: ahora.toISOString(), clave: pedido, datos }
  await guardarJson(clave, g).catch(() => undefined)
}

/** Al cerrar sesión: nada de Equipo queda en el aparato. */
export async function olvidarEquipoGuardado(): Promise<void> {
  await borrarClave(CLAVE_EQUIPO_HOY).catch(() => undefined)
  await borrarClave(CLAVE_EQUIPO_RENDIMIENTO).catch(() => undefined)
}
