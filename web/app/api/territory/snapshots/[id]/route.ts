import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/require-role'
import { jsonError } from '@/app/api/kams/_lib/kam-shared'
import { TERRITORY_UUID_RE, canSeeExecutive, getSnapshot, resolveTerritoryAccess } from '@/lib/territory'

export const dynamic = 'force-dynamic'

type Params = { params: { id: string } }

// GET /api/territory/snapshots/[id] — contenido completo de una versión guardada (resumen, anexos,
// hash). territory:view; 403 si el usuario no ve esa línea o ese Ejecutivo Comercial.
export async function GET(request: NextRequest, { params }: Params) {
  const auth = await requirePermission(request, 'territory:view')
  if (!auth.ok) return auth.response

  if (!TERRITORY_UUID_RE.test(params.id)) return jsonError('ID de versión no válido', 400)

  try {
    const result = await getSnapshot(params.id.toLowerCase())
    if (!result.ok) return jsonError(result.error, result.status)
    const snapshot = result.value
    if (!snapshot) return jsonError('Versión no encontrada', 404)

    const access = await resolveTerritoryAccess(auth.user, { id: snapshot.line_id })
    if (!access || !canSeeExecutive(access, snapshot.executive_id)) {
      return jsonError('No tienes acceso a esta versión', 403)
    }
    return NextResponse.json({ snapshot }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('Error en GET /api/territory/snapshots/[id]:', error)
    return jsonError('Error al cargar la versión', 500)
  }
}
