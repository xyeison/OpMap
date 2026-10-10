import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/require-role'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { jsonError, readJson, zodMessage } from '@/app/api/kams/_lib/kam-shared'
import { forceAssignmentSchema } from '../_lib/territory-schemas'

// POST /api/territories/force-assignment — fuerza todas las IPS de un territorio a un KAM
export async function POST(request: NextRequest) {
  const auth = await requirePermission(request, 'territories:manage')
  if (!auth.ok) return auth.response

  try {
    const parsed = forceAssignmentSchema.safeParse(await readJson(request))
    if (!parsed.success) {
      return jsonError(zodMessage(parsed.error), 400)
    }
    const { territoryId, territoryType, kamId, territoryName, reason } = parsed.data

    // M-19: el KAM forzado debe existir, estar activo y participar (si no, el algoritmo ignora la forzada)
    const { data: kam, error: kamError } = await supabaseAdmin
      .from('kams')
      .select('id, name, active, participates_in_assignment')
      .eq('id', kamId)
      .maybeSingle()
    if (kamError) throw kamError
    if (!kam) return jsonError('KAM no encontrado', 404)
    if (kam.active !== true || kam.participates_in_assignment !== true) {
      return jsonError(
        `El KAM ${kam.name} no está activo o no participa en la asignación territorial; el algoritmo ignoraría la forzada`,
        400
      )
    }

    // Hospitales del territorio
    const territoryField = territoryType === 'locality' ? 'locality_id' : 'municipality_id'
    const { data: hospitals, error: hospitalsError } = await supabaseAdmin
      .from('hospitals')
      .select('id')
      .eq('active', true)
      .eq(territoryField, territoryId)

    if (hospitalsError) throw hospitalsError

    // Desactivar cualquier forzada activa previa para este territorio
    const { error: deactivateError } = await supabaseAdmin
      .from('forced_assignments')
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq('territory_id', territoryId)
      .eq('active', true)
      .select('id')

    if (deactivateError) {
      console.error('Error desactivando forzadas anteriores:', deactivateError)
      return jsonError('Error al desactivar la asignación forzada anterior', 500)
    }

    // Crear la nueva forzada
    const { data: inserted, error: insertError } = await supabaseAdmin
      .from('forced_assignments')
      .insert({
        territory_id: territoryId,
        territory_type: territoryType,
        territory_name: territoryName || territoryId,
        kam_id: kamId,
        reason: reason || null,
        created_by: auth.user.id,
        active: true,
      })
      .select('id')

    if (insertError || !inserted || inserted.length === 0) {
      console.error('Error insertando asignación forzada:', insertError)
      return jsonError('Error al crear la asignación forzada', 500)
    }

    if (!hospitals || hospitals.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Asignación forzada guardada. No hay hospitales activos en este territorio.',
        hospitalsUpdated: 0,
      })
    }

    const hospitalIds = hospitals.map(h => h.id)

    // M-19: guardar el tiempo real si existe la ruta (segundos); null si falta, nunca 0
    const { data: distances, error: distancesError } = await supabaseAdmin
      .from('hospital_kam_distances')
      .select('hospital_id, travel_time')
      .eq('kam_id', kamId)
      .in('hospital_id', hospitalIds)
    if (distancesError) throw distancesError

    const travelTimeByHospital = new Map<string, number | null>()
    distances?.forEach(d => travelTimeByHospital.set(d.hospital_id, d.travel_time ?? null))

    const newAssignments = hospitalIds.map(hospitalId => ({
      hospital_id: hospitalId,
      kam_id: kamId,
      travel_time: travelTimeByHospital.get(hospitalId) ?? null,
      assignment_type: 'forced',
      is_base_territory: false,
      assigned_at: new Date().toISOString(),
    }))

    // assignments.hospital_id es único: upsert reemplaza la asignación anterior sin borrar antes
    const { data: upserted, error: assignmentsError } = await supabaseAdmin
      .from('assignments')
      .upsert(newAssignments, { onConflict: 'hospital_id' })
      .select('id')

    if (assignmentsError) throw assignmentsError
    if (!upserted || upserted.length !== newAssignments.length) {
      return jsonError('La asignación forzada se guardó, pero no se actualizaron todas las asignaciones', 500)
    }

    return NextResponse.json({
      success: true,
      message: `${hospitals.length} hospitales asignados correctamente`,
      hospitalsUpdated: hospitals.length,
    })
  } catch (error) {
    console.error('Error en force-assignment:', error)
    return jsonError('Error al procesar asignación forzada', 500)
  }
}
