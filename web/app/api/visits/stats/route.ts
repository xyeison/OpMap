import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUserFromRequest } from '@/lib/auth-server'

const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseServiceKey
)

export async function GET(request: NextRequest) {
  try {
    // Verificar autenticación
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Obtener estadísticas de visitas (deleted_at ya no existe)
    const { data, error } = await supabase
      .from('visits')
      .select('visit_type, contact_type')

    if (error) {
      console.error('Error loading visit stats:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const stats = {
      totalVisits: data?.length || 0,
      effectiveVisits: data?.filter(v => v.visit_type === 'Visita efectiva').length || 0,
      inPersonVisits: data?.filter(v => v.contact_type === 'Visita presencial').length || 0,
      virtualVisits: data?.filter(v => v.contact_type === 'Visita virtual').length || 0
    }

    return NextResponse.json(stats)
  } catch (error) {
    console.error('Error in GET /api/visits/stats:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}