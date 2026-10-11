import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/require-role'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { ALGORITHM_FIELDS, updateKamSchema } from '../_lib/kam-schemas'
import {
  areaConflictResponse,
  findAreaConflict,
  jsonError,
  readJson,
  runFullRecalculation,
  validateAreaId,
  zodMessage,
} from '../_lib/kam-shared'

// Si cambian campos del algoritmo en un KAM activo se recalcula en el mismo proceso
export const maxDuration = 60

// POST/PATCH /api/kams/update — body { kamId, updateData } con lista cerrada de campos (ver kam-schemas.ts).
async function handleUpdate(request: NextRequest) {
  const auth = await requirePermission(request, 'kams:edit')
  if (!auth.ok) return auth.response

  try {
    const body = await readJson(request)
    const parsed = updateKamSchema.safeParse(body)
    if (!parsed.success) {
      return jsonError(zodMessage(parsed.error), 400)
    }
    const { kamId, updateData } = parsed.data

    const { data: current, error: currentError } = await supabaseAdmin
      .from('kams')
      .select('*')
      .eq('id', kamId)
      .maybeSingle()

    if (currentError) throw currentError
    if (!current) return jsonError('Zona no encontrada', 404)

    const merged = { ...current, ...updateData }
    const areaChanged = updateData.area_id !== undefined && updateData.area_id !== current.area_id
    const startsParticipating =
      updateData.participates_in_assignment === true && current.participates_in_assignment !== true

    // R2-A-01: rechazar Bogotá entera y áreas inexistentes
    if (areaChanged && updateData.area_id) {
      const areaError = await validateAreaId(updateData.area_id)
      if (areaError) return areaError
    }

    // R2-M-01: un único KAM activo y territorial por área
    if (merged.active === true && merged.participates_in_assignment === true && (areaChanged || startsParticipating)) {
      const conflict = await findAreaConflict(merged.area_id, kamId)
      if (conflict) return areaConflictResponse(conflict)
    }

    const { data: updatedRows, error: updateError } = await supabaseAdmin
      .from('kams')
      .update({ ...updateData, updated_at: new Date().toISOString() })
      .eq('id', kamId)
      .select()

    if (updateError) {
      console.error('Error al actualizar KAM:', updateError)
      return jsonError('Error al actualizar la zona', 500)
    }
    if (!updatedRows || updatedRows.length === 0) {
      return jsonError('Zona no encontrada', 404)
    }

    // Recalcular solo si el KAM está activo y cambió algo que afecta al algoritmo
    const algorithmChanged = ALGORITHM_FIELDS.some(
      field => updateData[field] !== undefined && updateData[field] !== current[field]
    )
    let recalculated = false
    let warning: string | undefined
    if (algorithmChanged && current.active === true) {
      try {
        await runFullRecalculation()
        recalculated = true
      } catch (recalcError) {
        console.error('Error al recalcular tras actualizar KAM:', recalcError)
        warning = 'La zona se actualizó, pero el recálculo de asignaciones falló. Ejecuta el recálculo manualmente.'
      }
    }

    return NextResponse.json({
      success: true,
      data: updatedRows[0],
      recalculated,
      ...(warning ? { warning } : {}),
      message: warning ? warning : 'Zona actualizada exitosamente',
    })
  } catch (error) {
    console.error('Error en /api/kams/update:', error)
    return jsonError('Error interno del servidor', 500)
  }
}

export async function POST(request: NextRequest) {
  return handleUpdate(request)
}

export async function PATCH(request: NextRequest) {
  return handleUpdate(request)
}
