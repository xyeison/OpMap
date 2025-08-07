import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Obteniendo hospitales sin asignar con tiempos...')
    
    // 1. Obtener IDs de hospitales asignados
    const { data: assignments } = await supabase
      .from('assignments')
      .select('hospital_id')
    
    const assignedIds = new Set((assignments || []).map(a => a.hospital_id))
    
    // 2. Obtener hospitales activos no asignados
    const { data: hospitals } = await supabase
      .from('hospitals')
      .select('id, code, name, lat, lng, municipality_id, municipality_name, department_id')
      .eq('active', true)
    
    const unassignedHospitals = (hospitals || []).filter(h => !assignedIds.has(h.id))
    
    // 3. Obtener KAMs activos
    const { data: kams } = await supabase
      .from('kams')
      .select('id, name, lat, lng, max_travel_time')
      .eq('active', true)
    
    console.log(`   Hospitales sin asignar: ${unassignedHospitals.length}`)
    console.log(`   KAMs activos: ${kams?.length || 0}`)
    
    // 4. Para cada hospital, buscar tiempos en caché
    const hospitalsWithTimes = []
    
    for (const hospital of unassignedHospitals) {
      const travelTimes = []
      
      for (const kam of (kams || [])) {
        // Buscar en caché
        const { data: cacheData } = await supabase
          .from('travel_time_cache')
          .select('travel_time')
          .eq('origin_lat', parseFloat(kam.lat.toFixed(6)))
          .eq('origin_lng', parseFloat(kam.lng.toFixed(6)))
          .eq('dest_lat', parseFloat(hospital.lat.toFixed(6)))
          .eq('dest_lng', parseFloat(hospital.lng.toFixed(6)))
          .maybeSingle()
        
        travelTimes.push({
          kam_id: kam.id,
          kam_name: kam.name,
          travel_time: cacheData?.travel_time || null,
          max_travel_time: kam.max_travel_time || 240
        })
      }
      
      // Ordenar por tiempo (los que tienen tiempo primero)
      travelTimes.sort((a, b) => {
        if (a.travel_time === null && b.travel_time === null) return 0
        if (a.travel_time === null) return 1
        if (b.travel_time === null) return -1
        return a.travel_time - b.travel_time
      })
      
      hospitalsWithTimes.push({
        ...hospital,
        travel_times: travelTimes
      })
    }
    
    console.log(`✅ Completado`)
    
    return NextResponse.json({
      unassigned_hospitals: hospitalsWithTimes,
      total: hospitalsWithTimes.length
    })
    
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}