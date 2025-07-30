import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Contar total de visitas
    const { count: totalVisits } = await supabase
      .from('visits')
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null)

    // Obtener últimas 5 visitas
    const { data: recentVisits, error } = await supabase
      .from('visits')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(5)

    if (error) throw error

    // Buscar la visita específica mencionada
    const { data: specificVisit } = await supabase
      .from('visits')
      .select('*')
      .eq('lat', 10.4666)
      .eq('lng', -73.2547)
      .single()

    return NextResponse.json({
      totalVisits,
      recentVisits,
      specificVisit,
      debug: {
        hasVisits: (totalVisits ?? 0) > 0,
        firstVisitCoords: recentVisits?.[0] ? {
          lat: recentVisits[0].lat,
          lng: recentVisits[0].lng
        } : null
      }
    })
  } catch (error) {
    console.error('Error en debug de visitas:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 })
  }
}