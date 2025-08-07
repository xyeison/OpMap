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

    // Obtener parámetros de query
    const searchParams = request.nextUrl.searchParams
    const month = searchParams.get('month')
    const year = searchParams.get('year')

    console.log('Debug endpoint - Parámetros:', { month, year })

    // Query básica sin filtros primero
    let query = supabase
      .from('visits')
      .select('*')
      .is('deleted_at', null)
      .limit(10)

    // Si hay filtros, aplicarlos
    if (month && year) {
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`
      const endDate = Number(month) === 12 
        ? `${Number(year) + 1}-01-01`
        : `${year}-${String(Number(month) + 1).padStart(2, '0')}-01`
      
      console.log('Debug endpoint - Filtrando por fechas:', { startDate, endDate })
      
      query = query
        .gte('visit_date', startDate)
        .lt('visit_date', endDate)
    }

    const { data, error, count } = await query

    if (error) {
      console.error('Debug endpoint - Error:', error)
      return NextResponse.json({ 
        error: error.message,
        details: error
      }, { status: 500 })
    }

    // Verificar estructura de datos
    const sampleVisit = data?.[0]
    const structure = sampleVisit ? {
      hasLat: 'lat' in sampleVisit,
      hasLng: 'lng' in sampleVisit,
      hasVisitType: 'visit_type' in sampleVisit,
      hasContactType: 'contact_type' in sampleVisit,
      hasKamName: 'kam_name' in sampleVisit,
      latValue: sampleVisit.lat,
      lngValue: sampleVisit.lng,
      allFields: Object.keys(sampleVisit)
    } : null

    return NextResponse.json({
      totalCount: data?.length || 0,
      sampleData: data?.slice(0, 3),
      structure,
      filters: { month, year },
      query: query.toString()
    })
  } catch (error) {
    console.error('Error in GET /api/visits/debug:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor', details: error },
      { status: 500 }
    )
  }
}