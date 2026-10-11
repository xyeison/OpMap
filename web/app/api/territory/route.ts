import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/require-role'
import { jsonError } from '@/app/api/kams/_lib/kam-shared'
import {
  buildLineTerritories,
  buildTerritory,
  canManageTerritoryLine,
  type LineTerritoriesResponse,
} from '@/lib/territory'
import { readLineAndExecutive } from './_lib/territory-route'

export const dynamic = 'force-dynamic'

// GET /api/territory?line=<code>&executive=<id> — anexo de territorio de un Ejecutivo Comercial:
//   zonas que cubre, Anexo A (IPS activas asignadas) y Anexo B (municipios con IPS y de alcance por
//   carretera, agrupados por departamento), resumen y content_hash.
// GET /api/territory?line=<code> (sin executive) — los territorios de todos los ejecutivos de la
//   línea que el usuario puede ver, con los permisos de la UI (can_snapshot, can_edit_names).
// territory:view; line_leader solo su línea; un ejecutivo enlazado solo el suyo.
export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'territory:view')
  if (!auth.ok) return auth.response

  try {
    const parsed = await readLineAndExecutive(request, auth.user, { requireExecutive: false })
    if (!parsed.ok) return parsed.response
    const { access, executiveId } = parsed

    if (executiveId) {
      const territory = await buildTerritory(access.line.id, executiveId)
      if (!territory) return jsonError('El Ejecutivo Comercial no lleva esta línea', 404)
      return NextResponse.json(territory, { headers: { 'Cache-Control': 'no-store' } })
    }

    const [result, canSnapshot, canEditNames] = await Promise.all([
      buildLineTerritories(access.line.id, access.executiveIds),
      canManageTerritoryLine(auth.user, access.line.id, 'territory:snapshot'),
      canManageTerritoryLine(auth.user, access.line.id, 'lines:edit'),
    ])
    if (!result) return jsonError('Línea no encontrada', 404)

    const body: LineTerritoriesResponse = {
      line: access.line,
      territories: result.territories,
      reach_pending: result.reach_pending,
      pending_municipalities: result.pending_municipalities,
      can_snapshot: canSnapshot,
      can_edit_names: canEditNames,
      storage_ready: result.storage_ready,
    }
    return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('Error en GET /api/territory:', error)
    return jsonError('Error al cargar el territorio', 500)
  }
}
