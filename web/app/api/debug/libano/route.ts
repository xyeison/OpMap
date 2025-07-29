import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    // 1. Buscar hospitales en Líbano (73411)
    const { data: hospitals } = await supabase
      .from('hospitals')
      .select('*')
      .eq('municipality_id', '73411')
    
    // 2. Buscar asignaciones de esos hospitales
    const hospitalIds = hospitals?.map(h => h.id) || []
    const { data: assignments } = await supabase
      .from('assignments')
      .select(`
        *,
        kams (name, area_id),
        hospitals (name, municipality_name)
      `)
      .in('hospital_id', hospitalIds)
    
    // 3. Buscar tiempos de viaje desde diferentes KAMs a Líbano
    const libanoHospital = hospitals?.[0]
    const travelTimes: any[] = []
    
    if (libanoHospital) {
      // KAMs que deberían poder competir por Líbano
      const relevantKams = [
        { name: 'KAM Pereira', area_id: '66001' },
        { name: 'KAM Neiva', area_id: '41001' },
        { name: 'KAM Medellín', area_id: '05001' },
        { name: 'KAM Chapinero', area_id: '1100102' },
        { name: 'KAM Kennedy', area_id: '1100108' },
        { name: 'KAM Engativá', area_id: '1100110' },
        { name: 'KAM San Cristóbal', area_id: '1100104' }
      ]
      
      for (const kam of relevantKams) {
        const { data: kamData } = await supabase
          .from('kams')
          .select('lat, lng')
          .eq('area_id', kam.area_id)
          .single()
        
        if (kamData) {
          // Buscar tiempo en caché
          const { data: cacheTime } = await supabase
            .from('travel_time_cache')
            .select('travel_time')
            .eq('origin_lat', Number(kamData.lat).toFixed(6))
            .eq('origin_lng', Number(kamData.lng).toFixed(6))
            .eq('dest_lat', Number(libanoHospital.lat).toFixed(6))
            .eq('dest_lng', Number(libanoHospital.lng).toFixed(6))
            .single()
          
          travelTimes.push({
            kam: kam.name,
            area_id: kam.area_id,
            travel_time: cacheTime?.travel_time || 'No en caché',
            travel_time_hours: cacheTime?.travel_time ? (cacheTime.travel_time / 60).toFixed(1) : 'N/A'
          })
        }
      }
    }
    
    // 4. Verificar la lógica de adyacencia
    const adjacencyInfo = {
      tolima_neighbors: ['17', '25', '41', '63', '66', '73', '76'], // Vecinos de Tolima
      risaralda_can_reach_tolima: true, // Risaralda (66) → Tolima (73) = Nivel 1
      huila_can_reach_tolima: true, // Huila (41) → Tolima (73) = Nivel 1
      cundinamarca_can_reach_tolima: true, // Cundinamarca (25) → Tolima (73) = Nivel 1
      antioquia_can_reach_tolima: false, // Antioquia (05) → Caldas (17) → Tolima (73) = Nivel 2
    }
    
    return NextResponse.json({
      libano_info: {
        municipality_code: '73411',
        department: 'Tolima (73)',
        hospitals_count: hospitals?.length || 0,
        hospitals: hospitals
      },
      current_assignments: assignments,
      travel_times_comparison: travelTimes.sort((a, b) => {
        const timeA = typeof a.travel_time === 'number' ? a.travel_time : 999999
        const timeB = typeof b.travel_time === 'number' ? b.travel_time : 999999
        return timeA - timeB
      }),
      adjacency_analysis: adjacencyInfo,
      expected_competitors: [
        'KAM Pereira (Nivel 1: Risaralda → Tolima)',
        'KAM Neiva (Nivel 1: Huila → Tolima)',
        'KAMs Bogotá (Nivel 1: Bogotá → Cundinamarca → Tolima)',
        'KAM Medellín (Nivel 2: Antioquia → Caldas → Tolima)'
      ]
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}