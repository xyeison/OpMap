import { NextRequest, NextResponse } from 'next/server'
import { requirePermission, requireUser } from '@/lib/require-role'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { jsonError, readJson, zodMessage } from '@/app/api/kams/_lib/kam-shared'
import { zoneSchema } from './_lib/zone-schemas'

// GET /api/zones — zonas activas con sus KAMs activos (kams.zone_id). Cualquier usuario con sesión (lo usa el mapa).
export async function GET(request: NextRequest) {
  const auth = await requireUser(request)
  if (!auth.ok) return auth.response

  try {
    const { data: zones, error: zonesError } = await supabaseAdmin
      .from('zones')
      .select('*')
      .eq('active', true)
      .order('name')

    if (zonesError) throw zonesError

    const { data: kams, error: kamsError } = await supabaseAdmin
      .from('kams')
      .select('id, name, area_id, color, zone_id')
      .eq('active', true)
      .not('zone_id', 'is', null)
      .order('name')

    if (kamsError) throw kamsError

    const formattedZones = (zones || []).map(zone => ({
      ...zone,
      kams: (kams || [])
        .filter(kam => kam.zone_id === zone.id)
        .map(({ id, name, area_id, color }) => ({ id, name, area_id, color })),
    }))

    return NextResponse.json(formattedZones)
  } catch (error) {
    console.error('Error cargando zonas:', error)
    return NextResponse.json({ error: 'Error al cargar las zonas' }, { status: 500 })
  }
}

// POST /api/zones — crea una zona
export async function POST(request: NextRequest) {
  const auth = await requirePermission(request, 'zones:edit')
  if (!auth.ok) return auth.response

  try {
    const parsed = zoneSchema.safeParse(await readJson(request))
    if (!parsed.success) {
      return jsonError(zodMessage(parsed.error), 400)
    }

    const { data, error } = await supabaseAdmin
      .from('zones')
      .insert({ ...parsed.data, created_by: auth.user.id })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return jsonError('Ya existe una zona con ese código', 409)
      }
      console.error('Error creando zona:', error)
      return jsonError('Error al crear la zona', 500)
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error en POST /api/zones:', error)
    return jsonError('Error interno del servidor', 500)
  }
}
