import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/require-role'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { kamIdSchema } from '../_lib/kam-schemas'
import { jsonError, readJson, runFullRecalculation, zodMessage } from '../_lib/kam-shared'

// La desactivación dispara el recálculo completo en el mismo proceso
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
      .select('id, name, active')
      .eq('id', kamId)
      .maybeSingle()

    if (kamError) throw kamError
    if (!kam) return jsonError('KAM no encontrado', 404)
    if (kam.active !== true) return jsonError('El KAM ya está inactivo', 409)

    // 2. Contar hospitales antes de desactivar
    const { count: hospitalsBefore } = await supabaseAdmin
      .from('assignments')
      .select('id', { count: 'exact', head: true })
      .eq('kam_id', kamId)

    // 3. Desactivar el KAM (solo si seguía activo)
    const { data: updatedRows, error: updateError } = await supabaseAdmin
      .from('kams')
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq('id', kamId)
      .eq('active', true)
      .select('id')

    if (updateError) {
      console.error('Error al desactivar KAM:', updateError)
      return jsonError('Error al desactivar KAM', 500)
    }
    if (!updatedRows || updatedRows.length === 0) {
      return jsonError('El KAM no se desactivó: su estado cambió mientras tanto', 409)
    }

    // 4. Recalcular todas las asignaciones sin el KAM
    let saved = 0
    try {
      saved = await runFullRecalculation()
    } catch (recalcError) {
      console.error('Error al recalcular tras desactivar KAM:', recalcError)
      return jsonError(
        `El KAM ${kam.name} quedó inactivo, pero el recálculo de asignaciones falló. Ejecuta el recálculo manualmente.`,
        500
      )
    }

    // 5. Avisar de forzadas que siguen activas apuntando a este KAM (el algoritmo las ignora)
    const { data: forced } = await supabaseAdmin
      .from('forced_assignments')
      .select('territory_name')
      .eq('kam_id', kamId)
      .eq('active', true)

    const warnings: string[] = []
    if (forced && forced.length > 0) {
      warnings.push(
        `El KAM tenía ${forced.length} asignación(es) forzada(s) activa(s) (${forced
          .map(f => f.territory_name)
          .join(', ')}); ya no se aplican. Reasígnalas o desactívalas en Municipios.`
      )
    }

    return NextResponse.json({
      success: true,
      message: `KAM ${kam.name} desactivado. Los ${hospitalsBefore || 0} hospitales fueron reasignados automáticamente.`,
      stats: {
        totalAssignments: saved,
        hospitalsReassigned: hospitalsBefore || 0,
      },
      ...(warnings.length > 0 ? { warnings } : {}),
    })
  } catch (error) {
    console.error('Error al desactivar KAM:', error)
    return jsonError('Error al desactivar KAM', 500)
  }
}
