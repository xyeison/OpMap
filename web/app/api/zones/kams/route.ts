import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/require-role'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { UUID_RE, jsonError, readJson, uuidSchema, zodMessage } from '@/app/api/kams/_lib/kam-shared'

// La relación zona-KAM vive en kams.zone_id (la tabla zone_kams ya no existe).

// GET /api/zones/kams?zoneId= — KAMs de una zona (o todos los KAMs con su zone_id si no se indica)
export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'zones:view')
  if (!auth.ok) return auth.response

  try {
    const zoneId = new URL(request.url).searchParams.get('zoneId')
    if (zoneId && !UUID_RE.test(zoneId)) {
      return jsonError('ID de zona no válido', 400)
    }

    let query = supabaseAdmin.from('kams').select('id, name, area_id, color, active, zone_id').order('name')
    if (zoneId) {
      query = query.eq('zone_id', zoneId)
    }

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Error en GET /api/zones/kams:', error)
    return jsonError('Error al cargar las zonas de la región', 500)
  }
}

const assignSchema = z.object({
  zone_id: uuidSchema,
  kam_id: uuidSchema,
})

// POST/PUT /api/zones/kams — asigna un KAM a una zona (kams.zone_id)
async function assignKam(request: NextRequest) {
  const auth = await requirePermission(request, 'zones:edit')
  if (!auth.ok) return auth.response

  try {
    const parsed = assignSchema.safeParse(await readJson(request))
    if (!parsed.success) {
      return jsonError(zodMessage(parsed.error), 400)
    }
    const { zone_id, kam_id } = parsed.data

    const { data: zone, error: zoneError } = await supabaseAdmin
      .from('zones')
      .select('id, active')
      .eq('id', zone_id)
      .maybeSingle()
    if (zoneError) throw zoneError
    if (!zone) return jsonError('Zona no encontrada', 404)
    if (zone.active === false) return jsonError('La zona está inactiva', 409)

    const { data, error } = await supabaseAdmin
      .from('kams')
      .update({ zone_id, updated_at: new Date().toISOString() })
      .eq('id', kam_id)
      .select('id, name, zone_id')

    if (error) throw error
    if (!data || data.length === 0) return jsonError('Zona no encontrada', 404)

    return NextResponse.json({ success: true, data: data[0] })
  } catch (error) {
    console.error('Error asignando KAM a zona:', error)
    return jsonError('Error al asignar la zona a la región', 500)
  }
}

export async function POST(request: NextRequest) {
  return assignKam(request)
}

export async function PUT(request: NextRequest) {
  return assignKam(request)
}

// DELETE /api/zones/kams?zoneId=&kamId= — quita el KAM de la zona (solo si estaba en esa zona)
export async function DELETE(request: NextRequest) {
  const auth = await requirePermission(request, 'zones:edit')
  if (!auth.ok) return auth.response

  try {
    const { searchParams } = new URL(request.url)
    const zoneId = searchParams.get('zoneId')
    const kamId = searchParams.get('kamId')

    if (!zoneId || !kamId || !UUID_RE.test(zoneId) || !UUID_RE.test(kamId)) {
      return jsonError('Se requieren zoneId y kamId válidos', 400)
    }

    const { data, error } = await supabaseAdmin
      .from('kams')
      .update({ zone_id: null, updated_at: new Date().toISOString() })
      .eq('id', kamId)
      .eq('zone_id', zoneId)
      .select('id')

    if (error) throw error
    if (!data || data.length === 0) {
      return jsonError('La zona no pertenece a esa región', 404)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error quitando KAM de zona:', error)
    return jsonError('Error al quitar la zona de la región', 500)
  }
}
