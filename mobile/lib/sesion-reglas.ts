/**
 * Reglas puras del arranque de la sesión (spec 2026-10-15, paquete 4): con el perfil guardado y un token vigente la app
 * entra YA y confirma con GET /api/auth/me en segundo plano (con poca señal se esperaba hasta 20 s); sin perfil guardado
 * pregunta antes de entrar; sin token no hay sesión. Nunca se entra sin token, y un 401 (en la confirmación o en
 * cualquier petición) sigue cerrando la sesión (lib/sesion.ts con alVencerSesion). Lo prueba scripts/checks/18-tiempos.ts.
 */

/**
 * Tiempo máximo de GET /api/auth/me cuando la persona ESPERA la respuesta (sin perfil guardado, la pantalla de carga):
 * antes era el de una petición normal (20 s).
 */
export const TIEMPO_ME_MS = 5_000

/**
 * Tiempo máximo de la confirmación EN SEGUNDO PLANO (se entró con el perfil guardado, o Hoy vuelve a preguntar): nadie
 * espera, así que vale el de una petición normal (TIEMPO_NORMAL_MS de lib/http.ts). Con los 5 s de arriba, un arranque
 * en frío de Vercel o poca señal dejaban "Sin conexión con el servidor" aunque el resto respondiera bien (revisión
 * 2026-10-15).
 */
export const TIEMPO_ME_FONDO_MS = 20_000

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

// ---------------------------------------------------------------------------------------------
// Un solo ingreso con la web de OpMap (la app en el navegador, /campo, dueño 2026-10-30;
// docs/specs/2026-10-30-agendamiento-lider-un-ingreso.md)
// ---------------------------------------------------------------------------------------------

/**
 * El `cliente` del login: en el navegador 'campo-web' (el servidor responde como al móvil y además pone la cookie de la
 * web: entrar en la app deja también dentro de OpMap); en el teléfono 'movil' (solo el token, sin cookie).
 */
export function clienteDeLogin(esWeb: boolean): 'movil' | 'campo-web' {
  return esWeb ? 'campo-web' : 'movil'
}

/**
 * La marca de "cerrar sesión no llegó al servidor" (en el navegador, revisión 2026-10-30): sin señal la cookie de la web
 * pudo quedar viva y, sin la marca, al volver a abrir la app entraría sola con ella. Mientras exista, la app no la usa y,
 * al abrir, vuelve a avisar al servidor; se quita al lograrlo o con un ingreso nuevo (en la app, o en OpMap:
 * web/lib/app-campo.ts CLAVE_SALIDA_PENDIENTE_APP_CAMPO, la misma clave).
 */
export const CLAVE_SALIDA_PENDIENTE = 'opmap.salida-pendiente.v1'

/**
 * ¿Pedir el token a la sesión de la web (POST /api/auth/sesion-app) al abrir? Solo en el navegador, sin un token vigente
 * (no hay, o venció) y sin una salida pendiente: quien entró por "Agendamiento" desde OpMap ya tiene la cookie y no
 * vuelve a escribir su contraseña. En el teléfono nunca (no hay cookie de la web).
 */
export function probarSesionDeLaWeb(o: { esWeb: boolean; tokenVigente: boolean; salidaPendiente?: boolean }): boolean {
  return o.esWeb && !o.tokenVigente && !o.salidaPendiente
}

/** Al cerrar sesión, ¿dejar la marca? Solo en el navegador y si el servidor no respondió (sin señal o tardó). */
export function dejarSalidaPendiente(o: { esWeb: boolean; avisado: boolean }): boolean {
  return o.esWeb && !o.avisado
}

/**
 * Al abrir con la marca, ¿volver a avisar al servidor? Solo sin un token vigente: con uno, alguien ya entró de nuevo (en
 * otra pestaña) y avisar borraría la cookie de esa sesión nueva.
 */
export function reintentarSalida(o: { salidaPendiente: boolean; tokenVigente: boolean }): boolean {
  return o.salidaPendiente && !o.tokenVigente
}

/**
 * Otra pestaña del navegador cambió el token de la app (OpMap lo borra al entrar y al salir; otra pestaña de la app lo
 * guarda o lo borra): esta pestaña lo sigue (revisión 2026-10-30). Sin token → 'cerrar' (la cola se queda); con otro
 * token → 'abrir' de nuevo con ese; con el mismo, nada. `anterior` undefined: esta pestaña aún no había leído el token
 * (está abriendo) y leerá el nuevo sola.
 */
export function cambioDeTokenEnOtraPestana(o: { nuevo: string | null; anterior: string | null | undefined }): 'cerrar' | 'abrir' | 'nada' {
  if (o.anterior === undefined) return 'nada'
  if (!o.nuevo) return o.anterior ? 'cerrar' : 'nada'
  return o.nuevo === o.anterior ? 'nada' : 'abrir'
}
