import { NextRequest, NextResponse } from 'next/server'
import { badJson, isUuid, readJsonBody, serverError } from '../../../_lib/api-error'
import { RepsApplyError, requireRepsImportUser, runApply } from '../../../_lib/reps-import-server'

// POST /api/hospitals/import/apply  { token }
// Aplica la simulación de /preview (misma persona, antes de 30 min): guarda hospital_services o
// hospital_capacity, actualiza service_flags / reps_services_count / quirofanos / reps_beds de las IPS
// con cruce y registra hospital_history (action 'import'), todo en una transacción
// (reps_import_apply). NUNCA recalcula asignaciones: las IPS no cambian de ubicación.
// Permiso: hospitals:edit y rol admin o data_manager.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  const auth = await requireRepsImportUser(request)
  if (!auth.ok) return auth.response

  const body = (await readJsonBody(request)) as { token?: unknown } | undefined
  if (!body || typeof body !== 'object') return badJson()
  if (!isUuid(body.token)) return NextResponse.json({ error: 'Token de simulación no válido' }, { status: 400 })

  try {
    const result = await runApply(auth.user, body.token)
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof RepsApplyError) return NextResponse.json({ error: error.message }, { status: error.status })
    return serverError('hospitals/import/apply', error, 'Error al aplicar la importación')
  }
}
