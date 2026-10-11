import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/require-role'
import { serverError } from '../../_lib/api-error'
import { googleRoutesDisabled } from '../../_lib/google-distance-matrix'
import { classifyPendingHospitals, loadPendingSnapshot, pendingSummaryResponse } from '../../_lib/pending-assignment'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/hospitals/pending-assignment — IPS pendientes de rutas y asignación (banner de la lista de IPS).
// Solo lectura: no llama a Google ni escribe. Criterio en app/api/_lib/pending-assignment.ts.
// Respuesta: { count, pairsMissing, costEstimateUsd, items (máx. 500), truncated, withoutZone,
//              withoutCoordinates, lastRecalculationAt, routesDisabled }
export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'hospitals:view')
  if (!auth.ok) return auth.response

  try {
    const snapshot = await loadPendingSnapshot()
    const summary = pendingSummaryResponse(classifyPendingHospitals(snapshot))
    return NextResponse.json({ ...summary, routesDisabled: googleRoutesDisabled() })
  } catch (error) {
    return serverError('hospitals/pending-assignment GET', error, 'Error al calcular las IPS pendientes')
  }
}
