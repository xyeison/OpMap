import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/require-role'
import { supabaseAdmin } from '@/lib/supabase-admin'

// GET /api/zones/statistics — vista zone_statistics leída con service_role
export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'zones:view')
  if (!auth.ok) return auth.response

  try {
    const { data, error } = await supabaseAdmin.from('zone_statistics').select('*').order('zone_name')

    if (error) throw error

    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Error cargando estadísticas de zonas:', error)
    return NextResponse.json({ error: 'Error al cargar las estadísticas de zonas' }, { status: 500 })
  }
}
