import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requirePermission } from '@/lib/require-role'
import { badJson, isUuid, readJsonBody, serverError, validationError } from '../../../_lib/api-error'
import { hospitalStateChangeSchema } from '../../../_lib/hospital-schemas'

// Desactiva una IPS: active=false, borra su asignación y registra hospital_history.
// Si el historial falla se responde 500 y se compensa (se restaura el estado y la asignación),
// porque PostgREST no permite una transacción entre varias llamadas. Ver followup de función SQL.
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
    if (!parsed.success) return validationError(parsed.error, 'La razón de desactivación es obligatoria')
    const { reason } = parsed.data

    const { data: hospital, error: fetchError } = await supabaseAdmin
      .from('hospitals')
      .select('id, active')
      .eq('id', hospitalId)
      .maybeSingle()

    if (fetchError) return serverError('hospitals/[id]/deactivate (lectura)', fetchError)
    if (!hospital) {
      return NextResponse.json({ error: 'Hospital no encontrado' }, { status: 404 })
    }
    if (hospital.active === false) {
      return NextResponse.json({ error: 'El hospital ya está inactivo' }, { status: 409 })
    }

    // 1. Marcar inactivo
    const { data: updatedHospital, error: updateError } = await supabaseAdmin
      .from('hospitals')
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq('id', hospitalId)
      .select()
      .single()

    if (updateError) {
      return serverError('hospitals/[id]/deactivate (update)', updateError, 'Error al desactivar el hospital')
    }

    // 2. Retirar su asignación (se guarda lo borrado para poder compensar)
    const { data: removedAssignments, error: deleteError } = await supabaseAdmin
      .from('assignments')
      .delete()
      .eq('hospital_id', hospitalId)
      .select('*')

    if (deleteError) {
      await supabaseAdmin.from('hospitals').update({ active: true }).eq('id', hospitalId)
      return serverError(
        'hospitals/[id]/deactivate (assignments)',
        deleteError,
        'No se pudo retirar la asignación; la desactivación se ha revertido'
      )
    }

    // 3. Historial obligatorio
    const { error: historyError } = await supabaseAdmin.from('hospital_history').insert({
      hospital_id: hospitalId,
      user_id: user.id,
      created_by: user.id,
      action: 'deactivated',
      reason,
      previous_state: true,
      new_state: false,
      changes: { removed_assignments: (removedAssignments || []).map(a => ({ kam_id: a.kam_id, assignment_type: a.assignment_type })) },
    })

    if (historyError) {
      // Compensación: restaurar estado y asignación
      const { error: revertError } = await supabaseAdmin
        .from('hospitals')
        .update({ active: true })
        .eq('id', hospitalId)
      if (revertError) console.error('hospitals/[id]/deactivate: no se pudo revertir el estado', revertError)

      if (removedAssignments && removedAssignments.length > 0) {
        const { error: restoreError } = await supabaseAdmin.from('assignments').insert(removedAssignments)
        if (restoreError) {
          console.error('hospitals/[id]/deactivate: no se pudo restaurar la asignación', restoreError)
        }
      }

      return serverError(
        'hospitals/[id]/deactivate (historial)',
        historyError,
        'No se pudo registrar el historial; la desactivación se ha revertido'
      )
    }

    return NextResponse.json({
      success: true,
      hospital: updatedHospital,
      removedAssignments: removedAssignments?.length || 0,
      message: 'Hospital desactivado exitosamente',
    })
  } catch (error) {
    return serverError('hospitals/[id]/deactivate', error)
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  // Alias de POST (misma autorización: requirePermission dentro de POST)
  const auth = await requirePermission(request, 'hospitals:edit')
  if (!auth.ok) return auth.response
  return POST(request, { params })
}
