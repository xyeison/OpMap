import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/require-role'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { jsonError } from '@/app/api/kams/_lib/kam-shared'
import { COVERAGE_UUID_RE, canEditCoverageLine, recomputeAndSaveCoverage } from '@/lib/coverage'
import type { CoverageOverrideResponse, CoverageOverrideRow } from '@/lib/types/coverage'

type Params = { params: { id: string } }

type OverrideSelect = Pick<CoverageOverrideRow, 'id' | 'line_id' | 'kam_id' | 'executive_id' | 'reason' | 'active'>

// DELETE /api/coverage/overrides/[id] — quita un ajuste manual (active = false, la fila queda como
// historial) y recalcula la cobertura. coverage:edit; line_leader solo en la línea que lidera.
export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = await requirePermission(request, 'coverage:edit')
  if (!auth.ok) return auth.response

  if (!COVERAGE_UUID_RE.test(params.id)) return jsonError('ID de ajuste no válido', 400)
  const overrideId = params.id.toLowerCase()

  try {
    const { data, error } = await supabaseAdmin
      .from('coverage_overrides')
      .select('id, line_id, kam_id, executive_id, reason, active')
      .eq('id', overrideId)
      .limit(1)
    if (error) throw error
    const override = data && data.length > 0 ? (data[0] as OverrideSelect) : null
    if (!override) return jsonError('Ajuste no encontrado', 404)

    if (!(await canEditCoverageLine(auth.user, override.line_id))) {
      return jsonError('Solo puedes ajustar la cobertura de la línea que lideras', 403)
    }

    if (override.active) {
      const { data: updated, error: updateError } = await supabaseAdmin
        .from('coverage_overrides')
        .update({ active: false })
        .eq('id', overrideId)
        .select('id')
      if (updateError) {
        console.error('Error quitando el ajuste manual:', updateError)
        return jsonError('Error al quitar el ajuste manual', 500)
      }
      if (!updated || updated.length === 0) return jsonError('Ajuste no encontrado', 404)
    }

    let rows: number
    try {
      rows = (await recomputeAndSaveCoverage()).rows
    } catch (recomputeError) {
      console.error('Ajuste quitado pero falló el recálculo de cobertura:', recomputeError)
      return jsonError('El ajuste se quitó, pero no se pudo recalcular la cobertura. Usa "Recalcular cobertura".', 500)
    }

    const body: CoverageOverrideResponse = { override: { ...override, active: false }, rows }
    return NextResponse.json(body)
  } catch (error) {
    console.error('Error en DELETE /api/coverage/overrides/[id]:', error)
    return jsonError('Error interno del servidor', 500)
  }
}
