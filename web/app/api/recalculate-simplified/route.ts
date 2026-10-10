import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/require-role'
import { runFullRecalculation } from '../_lib/full-recalculation'
import { serverError } from '../_lib/api-error'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Recálculo completo: borra y reescribe todas las asignaciones.
// Permiso recalculate:complete (admin y data_manager en lib/permissions.ts).
export async function POST(request: Request) {
  const auth = await requirePermission(request, 'recalculate:complete')
  if (!auth.ok) return auth.response

  try {
    console.info(`[recalculate-simplified] iniciado por usuario=${auth.user.id} rol=${auth.user.role}`)
    const result = await runFullRecalculation()

    return NextResponse.json({
      success: true,
      message: `Se recalcularon y guardaron ${result.totalAssignments} asignaciones`,
      assignments: result.totalAssignments,
    })
  } catch (error) {
    return serverError('recalculate-simplified POST', error, 'Error al recalcular las asignaciones')
  }
}
