import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requirePermission } from '@/lib/require-role'
import { isUuid, serverError } from '../../../_lib/api-error'
import { refreshHospitalZone, zoneRefreshResponse } from '../../../_lib/hospital-routes'
import { ensurePendingHospitalDistances, loadPendingSnapshot } from '../../../_lib/pending-assignment'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// POST /api/hospitals/[id]/ensure-routes — botón "Calcular rutas y recalcular territorio" de la ficha.
// Para una IPS suelta (la carga masiva usa POST /api/hospitals/process-pending): calcula con Google SOLO los
// tiempos zona→IPS que faltan o quedaron desactualizados por un cambio de coordenadas, recalcula TODAS las
// asignaciones con el algoritmo (territorio completo) y actualiza municipality_zone
// (app/api/_lib/hospital-routes.ts + app/api/_lib/pending-assignment.ts).
// Permiso recalculate:complete (admin, data_manager): genera gasto en Google y reescribe asignaciones.
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(request, 'recalculate:complete')
  if (!auth.ok) return auth.response

  try {
    const hospitalId = params.id
    if (!isUuid(hospitalId)) {
      return NextResponse.json({ error: 'Hospital no encontrado' }, { status: 404 })
    }

    const { data: hospital, error } = await supabaseAdmin
      .from('hospitals')
      .select('id, active, lat, lng')
      .eq('id', hospitalId)
      .maybeSingle()

    if (error) return serverError('hospitals/[id]/ensure-routes (hospital)', error)
    if (!hospital) {
      return NextResponse.json({ error: 'Hospital no encontrado' }, { status: 404 })
    }
    if (hospital.active !== true) {
      return NextResponse.json({ error: 'La IPS está inactiva: actívala para asignarle zona' }, { status: 409 })
    }
    if (hospital.lat === null || hospital.lng === null) {
      return NextResponse.json({ error: 'La IPS no tiene coordenadas' }, { status: 422 })
    }

    const actorId = auth.user.id
    const snapshot = await loadPendingSnapshot({ hospitalId })
    const zone = await refreshHospitalZone(hospitalId, {
      actorId,
      deps: { ensure: id => ensurePendingHospitalDistances(id, snapshot, { actorId }) },
    })

    return NextResponse.json({
      success: zone.assignment !== null,
      warnings: zone.warnings,
      ...zoneRefreshResponse(zone),
    })
  } catch (error) {
    return serverError('hospitals/[id]/ensure-routes', error, 'Error al calcular rutas y asignar')
  }
}
