import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/require-role'
import { badJson, isUuid, readJsonBody, serverError } from '../../_lib/api-error'
import { defaultProcessPendingDeps, processPendingStep } from '../../_lib/pending-assignment'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// POST /api/hospitals/process-pending — botón "Calcular rutas y asignar pendientes" de la lista de IPS.
// Permiso recalculate:complete (admin, data_manager): genera gasto en Google y reescribe asignaciones.
// Cuerpo: { cursor?: uuid | null, phase?: 'routes' | 'assign' }. Sin phase, cada petición hace:
//   - fase A mientras queden IPS con tiempos por calcular después del cursor:
//     { phase: 'routes', done, remaining, hasMore, nextCursor, googleElements, costUsd, disabled, ... }
//     El cliente repite con cursor = nextCursor mientras phase sea 'routes'.
//   - fase B cuando ya no queda ninguna (o Google está deshabilitado): recálculo completo UNA vez y
//     municipality_zone (sin Google) → { phase: 'assigned', assignments, municipalities, warnings }.
// Lógica en app/api/_lib/pending-assignment.ts.
export async function POST(request: NextRequest) {
  const auth = await requirePermission(request, 'recalculate:complete')
  if (!auth.ok) return auth.response

  try {
    const body = await readJsonBody(request)
    if (body === undefined) return badJson()
    const input = (body && typeof body === 'object' ? body : {}) as { cursor?: unknown; phase?: unknown }

    const cursor = input.cursor === undefined || input.cursor === null ? null : input.cursor
    if (cursor !== null && !isUuid(cursor)) {
      return NextResponse.json({ error: 'Cursor inválido' }, { status: 400 })
    }
    if (input.phase !== undefined && input.phase !== 'routes' && input.phase !== 'assign') {
      return NextResponse.json({ error: "phase debe ser 'routes' o 'assign'" }, { status: 400 })
    }

    const result = await processPendingStep(
      { cursor: cursor === null ? null : cursor.toLowerCase(), phase: input.phase as 'routes' | 'assign' | undefined },
      defaultProcessPendingDeps(auth.user.id)
    )
    return NextResponse.json(result)
  } catch (error) {
    return serverError(
      'hospitals/process-pending',
      error,
      'No se pudo completar el cálculo de rutas y la asignación; vuelve a intentarlo'
    )
  }
}
