import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requirePermission } from '@/lib/require-role'
import { badJson, isUuid, readJsonBody, serverError, validationError } from '../../../_lib/api-error'
import { hospitalStateChangeSchema } from '../../../_lib/hospital-schemas'

// Activa una IPS y registra el cambio en hospital_history. La reasignación la hace después
// /api/recalculate-smart-hospital (action 'activated').
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(request, 'hospitals:edit')
  if (!auth.ok) return auth.response
  const user = auth.user

  try {
    const hospitalId = params.id
    if (!isUuid(hospitalId)) {
      return NextResponse.json({ error: 'Hospital no encontrado' }, { status: 404 })
    }

    const body = await readJsonBody(request)
    if (body === undefined) return badJson()
    const parsed = hospitalStateChangeSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error, 'La razón de activación es obligatoria')
    const { reason } = parsed.data

    const { data: hospital, error: fetchError } = await supabaseAdmin
      .from('hospitals')
      .select('id, active')
      .eq('id', hospitalId)
      .maybeSingle()

    if (fetchError) return serverError('hospitals/[id]/activate (lectura)', fetchError)
    if (!hospital) {
      return NextResponse.json({ error: 'Hospital no encontrado' }, { status: 404 })
    }
    if (hospital.active === true) {
      return NextResponse.json({ error: 'El hospital ya está activo' }, { status: 409 })
    }

    const { data: updatedHospital, error: updateError } = await supabaseAdmin
      .from('hospitals')
      .update({ active: true, updated_at: new Date().toISOString() })
      .eq('id', hospitalId)
      .select()
      .single()

    if (updateError) return serverError('hospitals/[id]/activate (update)', updateError, 'Error al activar el hospital')

    const { error: historyError } = await supabaseAdmin.from('hospital_history').insert({
      hospital_id: hospitalId,
      user_id: user.id,
      created_by: user.id,
      action: 'activated',
      reason,
      previous_state: false,
      new_state: true,
    })

    if (historyError) {
      // Sin auditoría no se acepta el cambio: se revierte el estado
      const { error: revertError } = await supabaseAdmin
        .from('hospitals')
        .update({ active: false })
        .eq('id', hospitalId)
      if (revertError) console.error('hospitals/[id]/activate: no se pudo revertir', revertError)
      return serverError(
        'hospitals/[id]/activate (historial)',
        historyError,
        'No se pudo registrar el historial; la activación se ha revertido'
      )
    }

    return NextResponse.json({
      success: true,
      hospital: updatedHospital,
      message: 'Hospital activado exitosamente',
    })
  } catch (error) {
    return serverError('hospitals/[id]/activate', error)
  }
}
