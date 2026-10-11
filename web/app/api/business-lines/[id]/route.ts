import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/require-role'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { jsonError, readJson, zodMessage } from '@/app/api/kams/_lib/kam-shared'
import { UUID_RE, businessLineUpdateSchema } from '@/lib/fase1-schemas'
import type { BusinessLineResponse } from '@/lib/types/lines'
import { loadBusinessLines } from '../_lib/line-shared'

type Params = { params: { id: string } }

// PATCH /api/business-lines/[id] — cambia nombre, líder, alcance máximo o estado de una línea.
// code y sort_order no se editan desde la API.
export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await requirePermission(request, 'lines:edit')
  if (!auth.ok) return auth.response

  if (!UUID_RE.test(params.id)) return jsonError('ID de línea no válido', 400)
  const lineId = params.id.toLowerCase()

  try {
    const parsed = businessLineUpdateSchema.safeParse(await readJson(request))
    if (!parsed.success) {
      return jsonError(zodMessage(parsed.error), 400)
    }
    const changes = parsed.data

    // El líder debe ser un usuario activo de OpMap
    if (changes.leader_user_id) {
      const { data: leader, error: leaderError } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('id', changes.leader_user_id)
        .eq('active', true)
        .limit(1)
      if (leaderError) throw leaderError
      if (!leader || leader.length === 0) {
        return jsonError('El líder seleccionado no existe o está inactivo', 400)
      }
    }

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (changes.name !== undefined) update.name = changes.name
    if (changes.leader_user_id !== undefined) update.leader_user_id = changes.leader_user_id
    if (changes.max_reach_minutes !== undefined) update.max_reach_minutes = changes.max_reach_minutes
    if (changes.active !== undefined) update.active = changes.active

    const { data, error } = await supabaseAdmin
      .from('business_lines')
      .update(update)
      .eq('id', lineId)
      .select('id')

    if (error) {
      if (error.code === '23503') {
        return jsonError('El líder seleccionado no existe', 400)
      }
      console.error('Error actualizando línea de negocio:', error)
      return jsonError('Error al actualizar la línea', 500)
    }
    if (!data || data.length === 0) {
      return jsonError('Línea no encontrada', 404)
    }

    const [line] = await loadBusinessLines(lineId)
    if (!line) return jsonError('Línea no encontrada', 404)

    const body: BusinessLineResponse = { line }
    return NextResponse.json(body)
  } catch (error) {
    console.error('Error en PATCH /api/business-lines/[id]:', error)
    return jsonError('Error interno del servidor', 500)
  }
}
