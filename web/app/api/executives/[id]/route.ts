import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/require-role'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { jsonError, readJson, zodMessage } from '@/app/api/kams/_lib/kam-shared'
import { UUID_RE, executiveUpdateSchema } from '@/lib/fase1-schemas'
import type { ExecutiveResponse, ExecutiveStatus } from '@/lib/types/lines'
import {
  allLinesExist,
  kamExists,
  loadExecutives,
  replaceExecutiveLines,
  resolveUserIdByEmail,
  todayInBogota,
  uniqueViolationMessage,
} from '../_lib/executive-shared'

type Params = { params: { id: string } }

// PATCH /api/executives/[id] — actualiza campos de la ejecutiva. Si viene "lines", reemplaza sus líneas.
// Si cambia el email, user_id se vuelve a enlazar con el usuario de OpMap de ese email (o null).
// Pasar a 'inactive' fija left_at = hoy; volver a 'active'/'placeholder' lo limpia.
export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await requirePermission(request, 'executives:edit')
  if (!auth.ok) return auth.response

  if (!UUID_RE.test(params.id)) return jsonError('ID de ejecutiva no válido', 400)
  const executiveId = params.id.toLowerCase()

  try {
    const parsed = executiveUpdateSchema.safeParse(await readJson(request))
    if (!parsed.success) {
      return jsonError(zodMessage(parsed.error), 400)
    }
    const input = parsed.data

    const { data: currentData, error: currentError } = await supabaseAdmin
      .from('executives')
      .select('id, email, status, user_id')
      .eq('id', executiveId)
      .limit(1)
    if (currentError) throw currentError
    const current = currentData && currentData.length > 0
      ? (currentData[0] as { id: string; email: string | null; status: ExecutiveStatus; user_id: string | null })
      : null
    if (!current) return jsonError('Ejecutiva no encontrada', 404)

    if (input.base_kam_id !== undefined && !(await kamExists(input.base_kam_id))) {
      return jsonError('La zona base seleccionada no existe', 400)
    }
    if (input.lines !== undefined && !(await allLinesExist(input.lines))) {
      return jsonError('Alguna de las líneas indicadas no existe', 400)
    }

    const update: Record<string, unknown> = {}
    if (input.full_name !== undefined) update.full_name = input.full_name
    if (input.company !== undefined) update.company = input.company
    if (input.base_kam_id !== undefined) update.base_kam_id = input.base_kam_id
    if (input.odoo_employee_id !== undefined) update.odoo_employee_id = input.odoo_employee_id
    if (input.notes !== undefined) update.notes = input.notes
    if (input.color !== undefined) update.color = input.color
    if (input.email !== undefined && input.email !== current.email) {
      update.email = input.email
      update.user_id = await resolveUserIdByEmail(input.email, executiveId)
    } else if (current.user_id === null && current.email) {
      // Sin usuario enlazado: cada vez que se guarda la ejecutiva se vuelve a intentar con su email (por si el
      // usuario se creó antes que ella o el enlace automático al crear el usuario falló). Nunca desenlaza.
      const userId = await resolveUserIdByEmail(current.email, executiveId)
      if (userId) update.user_id = userId
    }
    if (input.status !== undefined && input.status !== current.status) {
      update.status = input.status
      update.left_at = input.status === 'inactive' ? todayInBogota() : null
    }

    if (Object.keys(update).length > 0) {
      update.updated_at = new Date().toISOString()
      const { data, error } = await supabaseAdmin
        .from('executives')
        .update(update)
        .eq('id', executiveId)
        .select('id')

      if (error) {
        if (error.code === '23505') return jsonError(uniqueViolationMessage(error.details || error.message), 409)
        if (error.code === '23503') return jsonError('La zona base seleccionada no existe', 400)
        console.error('Error actualizando ejecutiva:', error)
        return jsonError('Error al actualizar la ejecutiva', 500)
      }
      if (!data || data.length === 0) {
        return jsonError('Ejecutiva no encontrada', 404)
      }
    }

    if (input.lines !== undefined) {
      if (!(await replaceExecutiveLines(executiveId, input.lines))) {
        return jsonError('No se pudieron guardar las líneas de la ejecutiva', 500)
      }
      if (Object.keys(update).length === 0) {
        // Solo cambiaron las líneas: dejar constancia en updated_at
        const { error: touchError } = await supabaseAdmin
          .from('executives')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', executiveId)
          .select('id')
        if (touchError) console.error('Error actualizando updated_at de la ejecutiva:', touchError)
      }
    }

    const [executive] = await loadExecutives(executiveId)
    if (!executive) return jsonError('Ejecutiva no encontrada', 404)

    const body: ExecutiveResponse = { executive }
    return NextResponse.json(body)
  } catch (error) {
    console.error('Error en PATCH /api/executives/[id]:', error)
    return jsonError('Error interno del servidor', 500)
  }
}

// DELETE /api/executives/[id] — baja lógica: status = 'inactive' y left_at = hoy.
// Nunca se borra la fila (la historia de cobertura y visitas la referencia).
export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = await requirePermission(request, 'executives:edit')
  if (!auth.ok) return auth.response

  if (!UUID_RE.test(params.id)) return jsonError('ID de ejecutiva no válido', 400)
  const executiveId = params.id.toLowerCase()

  try {
    const { data: currentData, error: currentError } = await supabaseAdmin
      .from('executives')
      .select('id, status')
      .eq('id', executiveId)
      .limit(1)
    if (currentError) throw currentError
    const current = currentData && currentData.length > 0 ? (currentData[0] as { id: string; status: ExecutiveStatus }) : null
    if (!current) return jsonError('Ejecutiva no encontrada', 404)

    // Si ya estaba inactiva no se toca left_at (conserva la fecha de baja original)
    if (current.status !== 'inactive') {
      const { data, error } = await supabaseAdmin
        .from('executives')
        .update({ status: 'inactive', left_at: todayInBogota(), updated_at: new Date().toISOString() })
        .eq('id', executiveId)
        .select('id')

      if (error) {
        console.error('Error dando de baja a la ejecutiva:', error)
        return jsonError('Error al dar de baja a la ejecutiva', 500)
      }
      if (!data || data.length === 0) {
        return jsonError('Ejecutiva no encontrada', 404)
      }
    }

    const [executive] = await loadExecutives(executiveId)
    if (!executive) return jsonError('Ejecutiva no encontrada', 404)

    const body: ExecutiveResponse = { executive }
    return NextResponse.json(body)
  } catch (error) {
    console.error('Error en DELETE /api/executives/[id]:', error)
    return jsonError('Error interno del servidor', 500)
  }
}
