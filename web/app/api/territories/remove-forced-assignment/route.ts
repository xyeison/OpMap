import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/require-role'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { jsonError, readJson, runFullRecalculation, zodMessage } from '@/app/api/kams/_lib/kam-shared'
import { removeForcedAssignmentSchema } from '../_lib/territory-schemas'

// Recalcula todas las asignaciones en el mismo proceso
export const maxDuration = 60

// POST /api/territories/remove-forced-assignment
// A-08: primero desactiva la forzada en forced_assignments (si no, la Fase 0 la volvería a aplicar)
// y después ejecuta el algoritmo completo para reasignar las IPS del territorio.
export async function POST(request: NextRequest) {
  const auth = await requirePermission(request, 'territories:manage')
  if (!auth.ok) return auth.response

  try {
    const parsed = removeForcedAssignmentSchema.safeParse(await readJson(request))
    if (!parsed.success) {
      return jsonError(zodMessage(parsed.error), 400)
    }
    const { territoryId } = parsed.data

    // 1. Desactivar la forzada (0 filas = no había forzada activa)
    const { data: deactivated, error: deactivateError } = await supabaseAdmin
      .from('forced_assignments')
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq('territory_id', territoryId)
      .eq('active', true)
      .select('id')

    if (deactivateError) {
      console.error('Error desactivando asignación forzada:', deactivateError)
      return jsonError('Error al desactivar la asignación forzada', 500)
    }
    if (!deactivated || deactivated.length === 0) {
      return jsonError('No hay una asignación forzada activa para este territorio', 404)
    }

    // 2. Recalcular todas las asignaciones sin la forzada
    let totalAssignments = 0
    try {
      totalAssignments = await runFullRecalculation()
    } catch (recalcError) {
      console.error('Error al recalcular tras quitar la forzada:', recalcError)
      return jsonError(
        'La asignación forzada se desactivó, pero el recálculo de asignaciones falló. Ejecuta el recálculo manualmente.',
        500
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Asignación forzada removida y asignaciones recalculadas.',
      forcedAssignmentsDeactivated: deactivated.length,
      totalAssignments,
    })
  } catch (error) {
    console.error('Error removiendo asignación forzada:', error)
    return jsonError('Error al remover asignación forzada', 500)
  }
}
