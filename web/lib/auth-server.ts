// Única implementación de "quién es el usuario de esta petición" en el servidor.
// Lee la cookie de sesión firmada (SESSION_COOKIE_NAME: __Host-opmap_session en producción,
// opmap_session en desarrollo), verifica firma y expiración, carga el usuario activo desde
// public.users con el cliente service_role y comprueba el claim pv contra su contraseña actual
// (si la contraseña cambió, la sesión queda revocada).
import { getSupabaseAdmin } from './supabase-admin'
import { SESSION_COOKIE_NAME, passwordVersion, passwordVersionMatches, verifySession } from './session'
import type { Role } from './permissions'

export interface SessionUser {
  id: string
  email: string
  full_name: string
  role: Role
  active: boolean
}

/**
 * Lee una cookie de la cabecera Cookie (sirve para Request y NextRequest).
 */
export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get('cookie')
  if (!header) return null

  for (const part of header.split(';')) {
    const index = part.indexOf('=')
    if (index === -1) continue
    if (part.slice(0, index).trim() !== name) continue

    const raw = part.slice(index + 1).trim()
    try {
      return decodeURIComponent(raw)
    } catch {
      return raw
    }
  }
  return null
}

/**
 * Devuelve el usuario autenticado y activo, o null si no hay sesión válida.
 */
export async function getUserFromRequest(request: Request): Promise<SessionUser | null> {
  try {
    const token = readCookie(request, SESSION_COOKIE_NAME)
    if (!token) return null

    const session = verifySession(token)
    if (!session) return null

    const { data, error } = await getSupabaseAdmin()
      .from('users')
      .select('id, email, full_name, role, active, password')
      .eq('id', session.uid)
      .eq('active', true)
      .maybeSingle()

    if (error) {
      console.error('Error cargando el usuario de la sesión:', error.message)
      return null
    }
    if (!data || data.active !== true) return null

    // Revocación: el pv del token debe coincidir con el de la contraseña guardada ahora
    const { password, ...user } = data
    if (typeof password !== 'string' || !password) return null
    if (!passwordVersionMatches(passwordVersion(password), session.pv)) return null

    // Nunca devolver la contraseña
    return user as SessionUser
  } catch (error) {
    // Incluye la falta de SESSION_SECRET o de SUPABASE_SERVICE_ROLE_KEY en producción (fail closed)
    console.error('Error obteniendo el usuario de la petición:', error)
    return null
  }
}
