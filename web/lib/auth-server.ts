// Única implementación de "quién es el usuario de esta petición" en el servidor.
// Lee la cookie de sesión firmada (SESSION_COOKIE_NAME: __Host-opmap_session en producción,
// opmap_session en desarrollo) o, SOLO en rutas /api/ y sin cookie, el token de portador que manda la
// app móvil ("Authorization: Bearer <token>", el mismo token firmado; decisión 1 de
// docs/fases/fase8-visitas-f3-f4-reporte-y-app-movil.md). Verifica firma y expiración, carga el
// usuario activo desde public.users con el cliente service_role y comprueba el claim pv contra su
// contraseña actual (si la contraseña cambió, la sesión y el token del teléfono quedan revocados).
import { getSupabaseAdmin } from './supabase-admin'
import { SESSION_COOKIE_NAME, passwordVersion, passwordVersionMatches, verifySession } from './session'
import { zoneDisplayName } from './zone-names'
import type { Role } from './permissions'
import type { EjecutivaMovil } from './reporte-visitas'

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

const BEARER_RE = /^Bearer\s+(\S+)$/i

/**
 * Token de "Authorization: Bearer <token>" (sirve para Request y NextRequest), o null si no viene o no tiene esa forma.
 */
export function readBearer(request: Request): string | null {
  const header = request.headers.get('authorization')
  if (!header) return null
  const match = BEARER_RE.exec(header.trim())
  return match ? match[1] : null
}

/** ¿La petición va a /api (donde vale el portador)? Una URL inválida cuenta como "no". */
export function esRutaApi(url: string): boolean {
  try {
    const pathname = new URL(url).pathname.toLowerCase()
    return pathname === '/api' || pathname.startsWith('/api/')
  } catch {
    return false
  }
}

/**
 * Token de sesión de la petición: la cookie; sin cookie, el portador solo en rutas /api/ (las páginas nunca lo
 * aceptan: el middleware las redirige al login).
 */
export function readSessionToken(request: Request): string | null {
  const cookie = readCookie(request, SESSION_COOKIE_NAME)
  if (cookie) return cookie
  return esRutaApi(request.url) ? readBearer(request) : null
}

/**
 * Devuelve el usuario autenticado y activo, o null si no hay sesión válida.
 */
export async function getUserFromRequest(request: Request): Promise<SessionUser | null> {
  try {
    const token = readSessionToken(request)
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

/**
 * El Ejecutivo Comercial enlazado con el usuario (executives.user_id) que no está inactivo, con el nombre de su
 * zona base, o null. Mismo criterio que personaDelUsuario (app/api/config-visitas/_lib/visitas-server.ts): quien
 * se dio de baja "ya no está" (decisión del dueño 2026-10-12). Lo usan el login móvil y GET /api/auth/me.
 * Lanza si la base falla (quien llama decide si eso tumba la respuesta).
 */
export async function ejecutivaEnlazada(userId: string): Promise<EjecutivaMovil | null> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('executives')
    .select('id, full_name, status, base_kam_id')
    .eq('user_id', userId)
    .neq('status', 'inactive')
    .order('full_name')
    .limit(5)
  if (error) throw new Error(error.message)

  const filas = (data || []) as { id: string; full_name: string; status: string; base_kam_id: string | null }[]
  if (filas.length === 0) return null
  // Si por un dato viejo hubiera más de una, la activa primero.
  const ejecutiva = filas.find(fila => fila.status === 'active') ?? filas[0]

  let zona: string | null = null
  if (ejecutiva.base_kam_id) {
    const { data: kam, error: errorKam } = await supabase.from('kams').select('id, name').eq('id', ejecutiva.base_kam_id).maybeSingle()
    if (errorKam) throw new Error(errorKam.message)
    const nombre = kam ? zoneDisplayName((kam as { name: string | null }).name) : ''
    zona = nombre || null
  }

  return { id: ejecutiva.id, full_name: ejecutiva.full_name, zona }
}
