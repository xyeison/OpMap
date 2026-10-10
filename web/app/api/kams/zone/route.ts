import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/require-role'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { jsonError, readJson, uuidSchema, zodMessage } from '../_lib/kam-shared'

const kamZoneSchema = z.object({
  kam_id: uuidSchema,
  // null o '' quitan la zona
  zone_id: z.union([uuidSchema, z.literal(''), z.null()]).optional(),
})

// PUT /api/kams/zone — asigna (o quita) la zona de un KAM en kams.zone_id
export async function PUT(request: NextRequest) {
  const auth = await requirePermission(request, 'zones:edit')
  if (!auth.ok) return auth.response

  try {
    const parsed = kamZoneSchema.safeParse(await readJson(request))
    if (!parsed.success) {
      return jsonError(zodMessage(parsed.error), 400)
    }
    const kamId = parsed.data.kam_id
    const zoneId = parsed.data.zone_id || null

    if (zoneId) {
      const { data: zone, error: zoneError } = await supabaseAdmin
        .from('zones')
        .select('id, active')
        .eq('id', zoneId)
        .maybeSingle()
      if (zoneError) throw zoneError
      if (!zone) return jsonError('Zona no encontrada', 404)
      if (zone.active === false) return jsonError('La zona está inactiva', 409)
    }

    const { data, error } = await supabaseAdmin
      .from('kams')
      .update({ zone_id: zoneId, updated_at: new Date().toISOString() })
      .eq('id', kamId)
      .select('id, name, zone_id')

    if (error) {
      console.error('Error actualizando zona del KAM:', error)
      return jsonError('Error al asignar la zona', 500)
    }
    if (!data || data.length === 0) {
      return jsonError('KAM no encontrado', 404)
    }

    return NextResponse.json({ success: true, data: data[0] })
  } catch (error) {
    console.error('Error en PUT /api/kams/zone:', error)
    return jsonError('Error interno del servidor', 500)
  }
}
