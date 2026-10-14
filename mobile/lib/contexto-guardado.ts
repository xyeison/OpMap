/**
 * El último contexto del reporte (POST /api/me/contexto) guardado en el teléfono, para poder reportar SIN SEÑAL con el
 * punto y la hora del sitio (regla del dueño, decisión 9): si al abrir Reportar no hay red, se arman las tarjetas con
 * las sedes, los médicos, los contactos, los subtipos y la configuración que llegaron la última vez HOY, y la visita
 * queda en la cola. Solo sirve el mismo día y para la misma persona (contextoUsable de lib/propuesta.ts); se olvida al
 * cerrar sesión. No trae documentos ni teléfonos (el servidor nunca los manda). Una sola clave en AsyncStorage.
 */
import { borrarClave, guardarJson, leerJson } from './almacen'
import { contextoParaGuardar, contextoUsable, type ContextoGuardado } from './propuesta'
import type { ContextoResponse } from './tipos'

export const CLAVE_CONTEXTO = 'opmap.contexto.v1'

/** Guarda el contexto que acaba de llegar (si el almacén falla, no pasa nada: solo se pierde el respaldo). */
export async function guardarContexto(usuarioId: string | null | undefined, contexto: ContextoResponse): Promise<void> {
  if (!usuarioId) return
  try {
    await guardarJson(CLAVE_CONTEXTO, contextoParaGuardar(usuarioId, contexto))
  } catch {
    // sin respaldo
  }
}

/** El contexto guardado hoy por esta persona, o null. */
export async function leerContextoGuardado(usuarioId: string | null | undefined): Promise<ContextoGuardado | null> {
  if (!usuarioId) return null
  return contextoUsable(await leerJson<unknown>(CLAVE_CONTEXTO), usuarioId)
}

export async function olvidarContextoGuardado(): Promise<void> {
  await borrarClave(CLAVE_CONTEXTO)
}
