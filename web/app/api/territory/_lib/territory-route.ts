// Utilidades de las rutas /api/territory/** (solo servidor). La carpeta empieza por "_" para que
// Next.js no la publique como ruta.
import type { NextRequest } from 'next/server'
import { jsonError } from '@/app/api/kams/_lib/kam-shared'
import { LINE_CODE_RE, type CoverageUser } from '@/lib/coverage'
import { TERRITORY_UUID_RE, canSeeExecutive, resolveTerritoryAccess, type TerritoryAccess } from '@/lib/territory'

export type RouteAccess =
  | { ok: true; access: TerritoryAccess; executiveId: string | null }
  | { ok: false; response: ReturnType<typeof jsonError> }

/**
 * Lee ?line=<código o id>&executive=<id> y valida el acceso:
 * 400 si faltan o no son válidos, 403 si el usuario no ve esa línea o ese Ejecutivo Comercial.
 */
export async function readLineAndExecutive(
  request: NextRequest,
  user: CoverageUser,
  options: { requireExecutive: boolean }
): Promise<RouteAccess> {
  const params = request.nextUrl.searchParams
  const lineParam = (params.get('line') || '').trim().toLowerCase()
  const executiveParam = (params.get('executive') || '').trim().toLowerCase()

  if (!lineParam) return { ok: false, response: jsonError('Falta el parámetro line (código de la línea)', 400) }
  const isId = TERRITORY_UUID_RE.test(lineParam)
  if (!isId && !LINE_CODE_RE.test(lineParam)) return { ok: false, response: jsonError('Línea no válida', 400) }

  if (options.requireExecutive && !executiveParam) {
    return { ok: false, response: jsonError('Falta el parámetro executive (Ejecutivo Comercial)', 400) }
  }
  if (executiveParam && !TERRITORY_UUID_RE.test(executiveParam)) {
    return { ok: false, response: jsonError('Ejecutivo Comercial no válido', 400) }
  }

  const access = await resolveTerritoryAccess(user, isId ? { id: lineParam } : { code: lineParam })
  if (!access) return { ok: false, response: jsonError('No tienes acceso a esta línea', 403) }
  if (executiveParam && !canSeeExecutive(access, executiveParam)) {
    return { ok: false, response: jsonError('Solo puedes ver tu propio territorio', 403) }
  }
  return { ok: true, access, executiveId: executiveParam || null }
}
