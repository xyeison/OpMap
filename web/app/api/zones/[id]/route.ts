import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/require-role'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { UUID_RE, jsonError, readJson, zodMessage } from '@/app/api/kams/_lib/kam-shared'
import { zoneUpdateSchema } from '../_lib/zone-schemas'

type Params = { params: { id: string } }

// PUT/PATCH /api/zones/[id] — actualiza una zona
async function handleUpdate(request: NextRequest, { params }: Params) {
  const auth = await requirePermission(request, 'zones:edit')
  if (!auth.ok) return auth.response

  if (!UUID_RE.test(params.id)) return jsonError('ID de zona no válido', 400)

  try {
    const parsed = zoneUpdateSchema.safeParse(await readJson(request))
    if (!parsed.success) {
      return jsonError(zodMessage(parsed.error), 400)
    }

    const { data, error } = await supabaseAdmin
      .from('zones')
      .update({ ...parsed.data, updated_at: new Date().toISOString() })
      .eq('id', params.id)
      .select()

    if (error) {
      if (error.code === '23505') {
        return jsonError('Ya existe una zona con ese código', 409)
      }
      console.error('Error actualizando zona:', error)
      return jsonError('Error al actualizar la zona', 500)
    }
    if (!data || data.length === 0) {
      return jsonError('Zona no encontrada', 404)
    }

    return NextResponse.json(data[0])
  } catch (error) {
    console.error('Error en PUT /api/zones/[id]:', error)
    return jsonError('Error interno del servidor', 500)
  }
}

export async function PUT(request: NextRequest, context: Params) {
  return handleUpdate(request, context)
}

export async function PATCH(request: NextRequest, context: Params) {
  return handleUpdate(request, context)
}

// DELETE /api/zones/[id] — elimina una zona. La FK kams.zone_id es ON DELETE SET NULL:
// los KAMs de la zona quedan sin zona.
export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = await requirePermission(request, 'zones:edit')
  if (!auth.ok) return auth.response

  if (!UUID_RE.test(params.id)) return jsonError('ID de zona no válido', 400)

  try {
    const { data, error } = await supabaseAdmin.from('zones').delete().eq('id', params.id).select('id')

    if (error) {
      if (error.code === '23503') {
        return jsonError('La zona tiene datos relacionados y no se puede eliminar', 409)
      }
      console.error('Error eliminando zona:', error)
      return jsonError('Error al eliminar la zona', 500)
    }
    if (!data || data.length === 0) {
      return jsonError('Zona no encontrada', 404)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error en DELETE /api/zones/[id]:', error)
    return jsonError('Error interno del servidor', 500)
  }
}
