/**
 * Reglas puras del arranque de la sesión (spec 2026-10-15, paquete 4): con el perfil guardado y un token vigente la app
 * entra YA y confirma con GET /api/auth/me en segundo plano (con poca señal se esperaba hasta 20 s); sin perfil guardado
 * pregunta antes de entrar; sin token no hay sesión. Nunca se entra sin token, y un 401 (en la confirmación o en
 * cualquier petición) sigue cerrando la sesión (lib/sesion.ts con alVencerSesion). Lo prueba scripts/checks/18-tiempos.ts.
 */

/** Tiempo máximo de GET /api/auth/me al abrir o al volver la señal (antes, el de una petición normal: 20 s). */
export const TIEMPO_ME_MS = 5_000

export type ArranqueSesion = 'entrar_y_confirmar' | 'confirmar_antes' | 'sin_sesion'

/** Lo mínimo del perfil guardado que mira la regla. */
export interface PerfilParaArranque {
  usuario: { id: string }
}

/**
 * - Sin token vigente (no hay, o venció) → 'sin_sesion'.
 * - Con token y perfil guardado del mismo usuario → 'entrar_y_confirmar' (se pinta con lo guardado y se confirma en
 *   segundo plano).
 * - Con token y sin perfil (o de otro usuario que el del token) → 'confirmar_antes' (como antes).
 */
export function arranqueDeSesion(o: {
  perfilGuardado: PerfilParaArranque | null | undefined
  tokenVigente: boolean
  /** uid de la carga del token (lib/token.ts); si viene y no es el del perfil, el perfil no sirve. */
  uidDelToken?: string | null
}): ArranqueSesion {
  if (!o.tokenVigente) return 'sin_sesion'
  const id = o.perfilGuardado?.usuario?.id
  if (typeof id !== 'string' || !id) return 'confirmar_antes'
  if (o.uidDelToken && o.uidDelToken !== id) return 'confirmar_antes'
  return 'entrar_y_confirmar'
}
