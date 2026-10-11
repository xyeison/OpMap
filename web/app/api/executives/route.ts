import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/require-role'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { jsonError, readJson, zodMessage } from '@/app/api/kams/_lib/kam-shared'
import { executiveCreateSchema } from '@/lib/fase1-schemas'
import type { ExecutiveResponse, ExecutivesResponse } from '@/lib/types/lines'
import {
  allLinesExist,
  kamExists,
  loadExecutives,
  replaceExecutiveLines,
  resolveUserIdByEmail,
  todayInBogota,
  uniqueViolationMessage,
} from './_lib/executive-shared'

// GET /api/executives — todas las ejecutivas (activas, placeholder e inactivas) con zona base y líneas.
export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'executives:view')
  if (!auth.ok) return auth.response

  try {
    const executives = await loadExecutives()
    const body: ExecutivesResponse = { executives }
    return NextResponse.json(body)
  } catch (error) {
    console.error('Error en GET /api/executives:', error)
    return jsonError('Error al cargar las ejecutivas', 500)
  }
}

// POST /api/executives — crea una ejecutiva (o un cupo "placeholder" por contratar) con sus líneas.
// user_id se enlaza solo si existe un usuario de OpMap con el mismo email.
export async function POST(request: NextRequest) {
  const auth = await requirePermission(request, 'executives:edit')
  if (!auth.ok) return auth.response

  try {
    const parsed = executiveCreateSchema.safeParse(await readJson(request))
    if (!parsed.success) {
      return jsonError(zodMessage(parsed.error), 400)
    }
    const input = parsed.data

    if (!(await kamExists(input.base_kam_id))) {
      return jsonError('La zona base seleccionada no existe', 400)
    }
    if (!(await allLinesExist(input.lines))) {
      return jsonError('Alguna de las líneas indicadas no existe', 400)
    }

    const email = input.email ?? null
    const status = input.status ?? 'active'
    const userId = await resolveUserIdByEmail(email)

    const { data, error } = await supabaseAdmin
      .from('executives')
      .insert({
        full_name: input.full_name,
        email,
        company: input.company ?? 'VG Medical',
        base_kam_id: input.base_kam_id,
        status,
        user_id: userId,
        odoo_employee_id: input.odoo_employee_id ?? null,
        notes: input.notes,
        ...(input.color !== undefined ? { color: input.color } : {}),
        left_at: status === 'inactive' ? todayInBogota() : null,
      })
      .select('id')

    if (error) {
      if (error.code === '23505') return jsonError(uniqueViolationMessage(error.details || error.message), 409)
      if (error.code === '23503') return jsonError('La zona base seleccionada no existe', 400)
      console.error('Error creando ejecutiva:', error)
      return jsonError('Error al crear la ejecutiva', 500)
    }
    const created = data && data.length > 0 ? (data[0].id as string) : null
    if (!created) {
      console.error('Insert de executives sin fila devuelta')
      return jsonError('Error al crear la ejecutiva', 500)
    }

    if (!(await replaceExecutiveLines(created, input.lines))) {
      return jsonError('La ejecutiva se creó, pero no se pudieron guardar sus líneas', 500)
    }

    const [executive] = await loadExecutives(created)
    if (!executive) return jsonError('Error al crear la ejecutiva', 500)

    const body: ExecutiveResponse = { executive }
    return NextResponse.json(body, { status: 201 })
  } catch (error) {
    console.error('Error en POST /api/executives:', error)
    return jsonError('Error interno del servidor', 500)
  }
}
