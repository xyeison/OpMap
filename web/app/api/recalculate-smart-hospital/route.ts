import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requirePermission } from '@/lib/require-role'
import { badJson, isUuid, readJsonBody, serverError } from '../_lib/api-error'
import { runFullRecalculation } from '../_lib/full-recalculation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Reacción a la (des)activación de una IPS desde app/hospitals/[id]:
//  - 'deactivated': retira la asignación del hospital (idempotente; deactivate ya la borra).
//    Las demás IPS del municipio conservan su asignación: no se recalcula nada más.
//  - 'activated': recálculo completo con SimplifiedOpMapAlgorithm (misma lógica que
//    /api/recalculate-simplified, sin fetch HTTP) y se comprueba que el hospital quedó asignado.
// Permiso: hospitals:edit, el mismo que permite activar/desactivar la IPS.
export async function POST(request: Request) {
  const auth = await requirePermission(request, 'hospitals:edit')
  if (!auth.ok) return auth.response

  try {
    const body = (await readJsonBody(request)) as { hospitalId?: unknown; action?: unknown } | undefined
    if (!body || typeof body !== 'object') return badJson()

    const { hospitalId, action } = body
    if (!isUuid(hospitalId)) {
      return NextResponse.json({ error: 'hospitalId es requerido' }, { status: 400 })
    }
    if (action !== 'activated' && action !== 'deactivated') {
      return NextResponse.json({ error: "action debe ser 'activated' o 'deactivated'" }, { status: 400 })
    }

    const startTime = Date.now()

    const { data: hospital, error: hospitalError } = await supabaseAdmin
      .from('hospitals')
      .select('id, name, municipality_id, active')
      .eq('id', hospitalId)
      .maybeSingle()

    if (hospitalError) return serverError('recalculate-smart-hospital (hospital)', hospitalError)
    if (!hospital) {
      return NextResponse.json({ error: 'Hospital no encontrado' }, { status: 404 })
    }

    if (action === 'deactivated') {
      if (hospital.active) {
        return NextResponse.json({ error: 'El hospital sigue activo' }, { status: 409 })
      }

      const { data: removed, error: deleteError } = await supabaseAdmin
        .from('assignments')
        .delete()
        .eq('hospital_id', hospitalId)
        .select('id')

      if (deleteError) {
        return serverError('recalculate-smart-hospital (delete)', deleteError, 'Error al retirar la asignación')
      }

      const { count: remaining, error: remainingError } = await supabaseAdmin
        .from('hospitals')
        .select('id', { count: 'exact', head: true })
        .eq('municipality_id', hospital.municipality_id)
        .eq('active', true)

      if (remainingError) return serverError('recalculate-smart-hospital (restantes)', remainingError)

      const zoneVacant = (remaining || 0) === 0
      return NextResponse.json({
        success: true,
        message: zoneVacant
          ? 'Asignación retirada; la zona queda vacante'
          : 'Asignación retirada; las demás IPS del municipio conservan su KAM',
        stats: {
          assignmentsRemoved: removed?.length || 0,
          remainingActiveInMunicipality: remaining || 0,
          zonesAffected: zoneVacant ? 1 : 0,
          hospitalsRecalculated: 0,
          timeMs: Date.now() - startTime,
        },
      })
    }

    // action === 'activated'
    if (!hospital.active) {
      return NextResponse.json({ error: 'El hospital no está activo' }, { status: 409 })
    }

    console.info(
      `[recalculate-smart-hospital] recálculo completo por activación hospital=${hospitalId} usuario=${auth.user.id}`
    )
    const result = await runFullRecalculation()
    const assignment = result.assignmentFor(hospitalId)

    if (!assignment) {
      // Nunca se responde éxito sin asignación
      return NextResponse.json(
        {
          success: false,
          error:
            'Se recalcularon las asignaciones, pero el hospital quedó sin KAM (no hay tiempos de viaje dentro del límite de ningún KAM elegible)',
          stats: {
            totalAssignments: result.totalAssignments,
            hospitalsRecalculated: 1,
            assignedTo: null,
            timeMs: Date.now() - startTime,
          },
        },
        { status: 422 }
      )
    }

    const { data: kam } = await supabaseAdmin
      .from('kams')
      .select('name')
      .eq('id', assignment.kam_id)
      .maybeSingle()

    return NextResponse.json({
      success: true,
      message: `Hospital asignado a ${kam?.name ?? 'KAM'}`,
      stats: {
        totalAssignments: result.totalAssignments,
        hospitalsRecalculated: 1,
        assignedTo: kam?.name ?? null,
        assignmentType: assignment.assignment_type,
        travelTime: assignment.travel_time, // SEGUNDOS
        timeMs: Date.now() - startTime,
      },
    })
  } catch (error) {
    return serverError('recalculate-smart-hospital', error, 'Error al recalcular las asignaciones')
  }
}
