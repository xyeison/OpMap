/**
 * La regla pura de "¿hay conexión?" (app sin señal, dueño 2026-10-30), sin expo-network ni React, para probarla en Node
 * (scripts/checks/22-sin-senal.ts). La suscripción en vivo (useConexion) está en lib/conexion.ts.
 */
export interface EstadoRed {
  isConnected?: boolean | null
  isInternetReachable?: boolean | null
}

/** La regla: sin datos, se asume conectado (que falle la petición, no la app). */
export function estaConectado(estado: EstadoRed | null | undefined, navegadorEnLinea: boolean | null = null): boolean {
  if (navegadorEnLinea === false) return false
  if (!estado) return true
  if (estado.isConnected === false) return false
  if (estado.isInternetReachable === false) return false
  return true
}
