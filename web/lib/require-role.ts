// Uso en una ruta API (App Router), al inicio del handler:
//   const auth = await requirePermission(request, 'kams:edit'); if (!auth.ok) return auth.response; const user = auth.user
// Solo sesión (sin permiso concreto): const auth = await requireUser(request); if (!auth.ok) return auth.response
// Cualquiera de varios permisos: const auth = await requireAnyPermission(request, ['intelligence:view', 'secop:procesos'])
import { NextResponse } from 'next/server'
import { getUserFromRequest, type SessionUser } from './auth-server'
import { hasPermission, type Permission } from './permissions'

export type AuthResult =
  | { ok: true; user: SessionUser }
  | { ok: false; response: NextResponse }

/**
 * Exige una sesión válida de un usuario activo. 401 si no la hay.
 */
export async function requireUser(request: Request): Promise<AuthResult> {
  const user = await getUserFromRequest(request)
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'No autorizado' }, { status: 401 }),
    }
  }
  return { ok: true, user }
}

/**
 * Exige sesión válida (401) y que el rol tenga el permiso indicado en lib/permissions.ts (403).
 */
export async function requirePermission(request: Request, permission: Permission): Promise<AuthResult> {
  const auth = await requireUser(request)
  if (!auth.ok) return auth

  if (!hasPermission(auth.user.role, permission)) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Acceso denegado' }, { status: 403 }),
    }
  }
  return auth
}

/**
 * Exige sesión válida (401) y que el rol tenga AL MENOS UNO de los permisos indicados (403 si no tiene ninguno). La ruta
 * decide después qué entrega según cuáles tiene (hasPermission): p. ej. las tarjetas del mapa dan todo con
 * intelligence:view y solo los procesos de SECOP II con secop:procesos. Con la lista vacía siempre es 403.
 */
export async function requireAnyPermission(request: Request, permissions: readonly Permission[]): Promise<AuthResult> {
  const auth = await requireUser(request)
  if (!auth.ok) return auth

  if (!permissions.some(permission => hasPermission(auth.user.role, permission))) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Acceso denegado' }, { status: 403 }),
    }
  }
  return auth
}
