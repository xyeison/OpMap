import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/require-role'
import { jsonError } from '@/app/api/kams/_lib/kam-shared'
import {
  TERRITORY_UUID_RE,
  buildTerritory,
  canSeeExecutive,
  diffTerritory,
  getSnapshot,
  resolveTerritoryAccess,
  territoryContentHash,
} from '@/lib/territory'

export const dynamic = 'force-dynamic'

type Params = { params: { id: string } }

// GET /api/territory/snapshots/[id]/diff — qué cambió desde esa versión hasta el territorio vigente:
// { added_municipalities, removed_municipalities, added_hospitals, removed_hospitals, snapshot_hash,
//   current_hash, unchanged }. Si el ejecutivo ya no lleva la línea, el vigente cuenta como vacío.
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

    const current = await buildTerritory(snapshot.line_id, snapshot.executive_id)
    const diff = diffTerritory(
      snapshot,
      current ?? { annex_a: [], annex_b: [], content_hash: territoryContentHash([], []) }
    )
    return NextResponse.json(diff, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('Error en GET /api/territory/snapshots/[id]/diff:', error)
    return jsonError('Error al comparar la versión', 500)
  }
}
