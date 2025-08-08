import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Usar service role key para bypass RLS
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const hospitalId = params.id
    
    // Obtener todas las distancias de este hospital desde hospital_kam_distances
    const { data: distances, error } = await supabase
      .from('hospital_kam_distances')
      .select(`
        kam_id,
        travel_time,
        distance,
        kams!inner (
          id,
          name,
          max_travel_time,
          active
        )
      `)
      .eq('hospital_id', hospitalId)
      .eq('kams.active', true)
      .order('travel_time', { ascending: true })
    
    if (error) {
      console.error('Error fetching KAM distances:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    // Formatear la respuesta
    const formattedDistances = (distances || []).map(d => ({
      kam_id: d.kam_id,
      kam_name: d.kams.name,
      travel_time: d.travel_time, // En segundos
      distance: d.distance,
      max_travel_time: d.kams.max_travel_time || 240
    }))
    
    return NextResponse.json({
      distances: formattedDistances,
      total: formattedDistances.length
    })
    
  } catch (error) {
    console.error('Error in kam-distances endpoint:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}