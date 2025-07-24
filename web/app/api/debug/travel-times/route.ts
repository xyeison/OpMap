import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    // Verificar cuántas asignaciones tienen tiempo de viaje
    const { data: stats } = await supabase
      .from('assignments')
      .select('travel_time')
    
    const withTime = stats?.filter(a => a.travel_time !== null && a.travel_time > 0).length || 0
    const withoutTime = stats?.filter(a => a.travel_time === null || a.travel_time === 0).length || 0
    
    // Obtener muestras de diferentes KAMs
    const { data: samples } = await supabase
      .from('assignments')
      .select('*, hospitals!inner(name, municipality_id), kams!inner(name, area_id)')
      .limit(20)
    
    // Agrupar por tipo
    const byType = {
      nullTime: samples?.filter(a => a.travel_time === null).length || 0,
      zeroTime: samples?.filter(a => a.travel_time === 0).length || 0,
      withTime: samples?.filter(a => a.travel_time > 0).length || 0
    }

    return NextResponse.json({
      totalAssignments: stats?.length || 0,
      withTravelTime: withTime,
      withoutTravelTime: withoutTime,
      byType,
      samples: samples?.slice(0, 10).map(a => ({
        hospital: a.hospitals.name,
        municipalityId: a.hospitals.municipality_id,
        kam: a.kams.name,
        kamAreaId: a.kams.area_id,
        travelTime: a.travel_time,
        assignmentType: a.assignment_type
      }))
    })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error', details: error }, { status: 500 })
  }
}