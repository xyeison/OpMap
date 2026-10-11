import { NextRequest, NextResponse } from 'next/server'
import { zoneDisplayName } from '@/lib/zone-names'
import { requirePermission } from '@/lib/require-role'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { kamIdSchema } from '../_lib/kam-schemas'
import {
  BOGOTA_AREA_MESSAGE,
  BOGOTA_MUNICIPALITY_CODE,
  areaConflictResponse,
  findAreaConflict,
  jsonError,
  readJson,
  runFullRecalculation,
  zodMessage,
} from '../_lib/kam-shared'

// La activación dispara el recálculo completo en el mismo proceso
export const maxDuration = 60

export async function POST(request: NextRequest) {
  const auth = await requirePermission(request, 'kams:edit')
  if (!auth.ok) return auth.response

  try {
    const parsed = kamIdSchema.safeParse(await readJson(request))
    if (!parsed.success) {
      return jsonError(zodMessage(parsed.error), 400)
    }
    const { kamId } = parsed.data

    // 1. Obtener info del KAM
    const { data: kam, error: kamError } = await supabaseAdmin
      .from('kams')
      .select('*')
      .eq('id', kamId)
      .maybeSingle()

    if (kamError) throw kamError
    if (!kam) return jsonError('Zona no encontrada', 404)
    if (kam.active === true) return jsonError('La zona ya está activa', 409)

    if (kam.participates_in_assignment === true) {
      // R2-A-01: un KAM con Bogotá entera se quedaría con toda la capital
      if (kam.area_id === BOGOTA_MUNICIPALITY_CODE) {
        return jsonError(`${BOGOTA_AREA_MESSAGE} antes de activar esta zona`, 400)
      }
      // R2-M-01: un único KAM activo y territorial por área
      const conflict = await findAreaConflict(kam.area_id, kamId)
      if (conflict) return areaConflictResponse(conflict)
    }

    // 2. Activar el KAM (solo si seguía inactivo: 0 filas = otro proceso lo cambió)
    const { data: updatedRows, error: updateError } = await supabaseAdmin
      .from('kams')
      .update({ active: true, updated_at: new Date().toISOString() })
      .eq('id', kamId)
      .eq('active', false)
      .select('id, active')

    if (updateError) {
      console.error('Error al activar KAM:', updateError)
      return jsonError('Error al activar la zona', 500)
    }
    if (!updatedRows || updatedRows.length === 0 || updatedRows[0].active !== true) {
      return jsonError('La zona no se activó: su estado cambió mientras tanto', 409)
    }

    // 3. Recalcular todas las asignaciones
    let saved = 0
    try {
      saved = await runFullRecalculation()
    } catch (recalcError) {
      console.error('Error al recalcular tras activar KAM:', recalcError)
      return jsonError(
        `La zona ${zoneDisplayName(kam.name)} quedó activa, pero el recálculo de asignaciones falló. Ejecuta el recálculo manualmente.`,
        500
      )
    }

    // 4. Estadísticas del KAM recién activado
    const { count: kamAssignments } = await supabaseAdmin
      .from('assignments')
      .select('id', { count: 'exact', head: true })
      .eq('kam_id', kamId)

    const areaField = String(kam.area_id).length === 7 ? 'locality_id' : 'municipality_id'
    const { count: hospitalsInMunicipality } = await supabaseAdmin
      .from('hospitals')
      .select('id', { count: 'exact', head: true })
      .eq(areaField, kam.area_id)
      .eq('active', true)

    return NextResponse.json({
      success: true,
      message: `Zona ${zoneDisplayName(kam.name)} activada exitosamente`,
      stats: {
        totalAssignments: saved,
        kamAssignments: kamAssignments || 0,
        hospitalsInMunicipality: hospitalsInMunicipality || 0,
      },
    })
  } catch (error) {
    console.error('Error al activar KAM:', error)
    return jsonError('Error al activar la zona', 500)
  }
}
