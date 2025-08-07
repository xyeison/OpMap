import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Usar Service Role Key para bypass RLS
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseServiceKey
)

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    
    // Obtener parámetros de filtro
    const month = searchParams.get('month')
    const months = searchParams.get('months')?.split(',').map(Number).filter(n => !isNaN(n))
    const year = searchParams.get('year')
    const visitType = searchParams.get('visitType')
    const contactType = searchParams.get('contactType')
    const kamIds = searchParams.get('kamIds')?.split(',').filter(id => id)
    
    console.log('API visits/filtered - Parámetros recibidos:', {
      month,
      months,
      year,
      visitType,
      contactType,
      kamIds: kamIds?.length || 0
    })
    
    // Construir query base
    let query = supabase
      .from('visits')
      .select('*')
      .is('deleted_at', null)
      .order('visit_date', { ascending: false })
    
    // Aplicar filtros de fecha
    if (months && months.length > 0 && year) {
      // Múltiples meses
      const allVisits: any[] = []
      
      for (const monthNum of months) {
        const startDate = `${year}-${String(monthNum).padStart(2, '0')}-01`
        const endDate = monthNum === 12 
          ? `${Number(year) + 1}-01-01`
          : `${year}-${String(monthNum + 1).padStart(2, '0')}-01`
        
        let monthQuery = supabase
          .from('visits')
          .select('*')
          .is('deleted_at', null)
          .gte('visit_date', startDate)
          .lt('visit_date', endDate)
        
        // Aplicar otros filtros
        if (visitType && visitType !== 'all') {
          monthQuery = monthQuery.eq('visit_type', visitType)
        }
        if (contactType && contactType !== 'all') {
          monthQuery = monthQuery.eq('contact_type', contactType)
        }
        if (kamIds && kamIds.length > 0) {
          monthQuery = monthQuery.in('kam_id', kamIds)
        }
        
        const { data: monthData, error } = await monthQuery
        if (error) throw error
        if (monthData) {
          allVisits.push(...monthData)
        }
      }
      
      // Eliminar duplicados y ordenar
      const uniqueVisits = Array.from(new Map(allVisits.map(v => [v.id, v])).values())
      uniqueVisits.sort((a, b) => new Date(b.visit_date).getTime() - new Date(a.visit_date).getTime())
      
      console.log('API visits/filtered - Total visitas múltiples meses:', uniqueVisits.length)
      return NextResponse.json(uniqueVisits)
      
    } else if (month && year) {
      // Un solo mes
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`
      const endDate = Number(month) === 12 
        ? `${Number(year) + 1}-01-01`
        : `${year}-${String(Number(month) + 1).padStart(2, '0')}-01`
      
      console.log('API visits/filtered - Filtrando por fecha:', { startDate, endDate })
      
      query = query
        .gte('visit_date', startDate)
        .lt('visit_date', endDate)
    }
    
    // Aplicar otros filtros
    if (visitType && visitType !== 'all') {
      query = query.eq('visit_type', visitType)
    }
    
    if (contactType && contactType !== 'all') {
      query = query.eq('contact_type', contactType)
    }
    
    if (kamIds && kamIds.length > 0) {
      console.log('API visits/filtered - Filtrando por KAMs:', kamIds)
      query = query.in('kam_id', kamIds)
    }
    
    const { data, error } = await query
    
    if (error) {
      console.error('API visits/filtered - Error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    console.log('API visits/filtered - Devolviendo', data?.length || 0, 'visitas')
    return NextResponse.json(data || [])
    
  } catch (error) {
    console.error('Error in GET /api/visits/filtered:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}