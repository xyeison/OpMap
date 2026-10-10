import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/require-role'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { UUID_RE } from '@/app/api/kams/_lib/kam-shared'

// GET /api/zones/territories?zoneId= — vista zone_territory_assignments leída con service_role
export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'zones:view')
  if (!auth.ok) return auth.response

  try {
    const zoneId = new URL(request.url).searchParams.get('zoneId')
    if (zoneId && !UUID_RE.test(zoneId)) {
      return NextResponse.json({ error: 'ID de zona no válido' }, { status: 400 })
    }

    let query = supabaseAdmin.from('zone_territory_assignments').select('*')
    if (zoneId) {
      query = query.eq('zone_id', zoneId)
    }

    const { data, error } = await query.order('territory_name')
    if (error) throw error

    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Error cargando territorios de zona:', error)
    return NextResponse.json({ error: 'Error al cargar los territorios de la zona' }, { status: 500 })
  }
}
