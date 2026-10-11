import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/require-role'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { createKamSchema } from '../_lib/kam-schemas'
import {
  areaConflictResponse,
  findAreaConflict,
  jsonError,
  readJson,
  runFullRecalculation,
  validateAreaId,
  zodMessage,
} from '../_lib/kam-shared'

// El alta dispara el recálculo completo en el mismo proceso
export const maxDuration = 60

export async function POST(request: NextRequest) {
  const auth = await requirePermission(request, 'kams:edit')
  if (!auth.ok) return auth.response

  try {
    const body = await readJson(request)
    const parsed = createKamSchema.safeParse(body)
    if (!parsed.success) {
      return jsonError(zodMessage(parsed.error), 400)
    }
    const kamData = parsed.data

    // R2-A-01: nunca un KAM con Bogotá entera; el área debe existir
    const areaError = await validateAreaId(kamData.area_id)
    if (areaError) return areaError

    // R2-M-01: un único KAM activo y territorial por área
    if (kamData.participates_in_assignment) {
      const conflict = await findAreaConflict(kamData.area_id)
      if (conflict) return areaConflictResponse(conflict)
    }

    const now = new Date().toISOString()
    const { data, error: insertError } = await supabaseAdmin
      .from('kams')
      .insert({ ...kamData, active: true, created_at: now, updated_at: now })
      .select()
      .single()

    if (insertError || !data) {
      console.error('Error al insertar KAM:', insertError)
      return jsonError('Error al crear la zona', 500)
    }

    // Si el KAM participa en la asignación territorial, recalcular en el mismo proceso
    let recalculated = false
    let warning: string | undefined
    if (kamData.participates_in_assignment) {
      try {
        await runFullRecalculation()
        recalculated = true
      } catch (recalcError) {
        console.error('Error al recalcular tras crear KAM:', recalcError)
        warning = 'La zona se creó, pero el recálculo de asignaciones falló. Ejecuta el recálculo manualmente.'
      }
    }

    return NextResponse.json({
      success: true,
      data,
      recalculated,
      ...(warning ? { warning } : {}),
      message: warning ? warning : 'Zona creada exitosamente',
    })
  } catch (error) {
    console.error('Error en POST /api/kams/create:', error)
    return jsonError('Error interno del servidor', 500)
  }
}
