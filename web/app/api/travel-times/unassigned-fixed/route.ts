import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET() {
  try {
    // 1. Obtener TODOS los hospitales activos primero
    const { data: allHospitals } = await supabase
      .from('hospitals')
      .select('*')
      .eq('active', true)
    
    if (!allHospitals || allHospitals.length === 0) {
      return NextResponse.json({ 
        unassigned_hospitals: [],
        total: 0,
        error: 'No active hospitals found' 
      })
    }
    
    // 2. Obtener hospitales asignados
    const { data: assignments } = await supabase
      .from('assignments')
      .select('hospital_id')
    
    const assignedIds = new Set((assignments || []).map(a => a.hospital_id))
    
    // 3. Filtrar hospitales sin asignar en memoria
    const unassignedHospitals = allHospitals.filter(h => !assignedIds.has(h.id))
    
    if (unassignedHospitals.length === 0) {
      return NextResponse.json({ 
        unassigned_hospitals: [],
        total: 0 
      })
    }
    
    // 4. Obtener todos los KAMs activos
    const { data: kams } = await supabase
      .from('kams')
      .select('*')
      .eq('active', true)
    
    if (!kams || kams.length === 0) {
      return NextResponse.json({ 
        unassigned_hospitals: unassignedHospitals.map(h => ({
          ...h,
          travel_times: []
        })),
        total: unassignedHospitals.length,
        error: 'No active KAMs found' 
      })
    }
    
    // 5. Obtener TODOS los tiempos de viaje de Google Maps
    const { data: allTravelTimes } = await supabase
      .from('travel_time_cache')
      .select('origin_lat, origin_lng, dest_lat, dest_lng, travel_time')
      .eq('source', 'google_maps')
    
    // Crear un mapa para búsqueda rápida
    const travelTimeMap = new Map<string, number>()
    allTravelTimes?.forEach(tt => {
      // Crear clave con precisión de 8 decimales
      const key = `${tt.origin_lat.toFixed(8)},${tt.origin_lng.toFixed(8)}|${tt.dest_lat.toFixed(8)},${tt.dest_lng.toFixed(8)}`
      travelTimeMap.set(key, tt.travel_time)
    })
    
    // 6. Para cada hospital sin asignar, buscar tiempos
    const hospitalsWithTimes: any[] = []
    
    for (const hospital of unassignedHospitals) {
      const hospitalData: {
        id: string
        name: string
        code: string
        municipality_name: string
        department_name: string
        lat: number
        lng: number
        travel_times: Array<{
          kam_id: string
          kam_name: string
          travel_time: number
          is_real: boolean
          source: string
        }>
      } = {
        id: hospital.id,
        name: hospital.name,
        code: hospital.code,
        municipality_name: hospital.municipality_name,
        department_name: hospital.department_name,
        lat: hospital.lat,
        lng: hospital.lng,
        travel_times: []
      }
      
      // Buscar tiempos para cada KAM
      for (const kam of kams) {
        // Crear clave con la misma precisión
        const key = `${kam.lat.toFixed(8)},${kam.lng.toFixed(8)}|${hospital.lat.toFixed(8)},${hospital.lng.toFixed(8)}`
        const travelTime = travelTimeMap.get(key)
        
        if (travelTime !== undefined) {
          hospitalData.travel_times.push({
            kam_id: kam.id,
            kam_name: kam.name,
            travel_time: travelTime,
            is_real: true,
            source: 'Google Maps Distance Matrix API'
          })
        }
      }
      
      // Incluir TODOS los hospitales sin asignar, incluso sin tiempos calculados
      // Ordenar por tiempo de viaje si hay tiempos disponibles
      if (hospitalData.travel_times.length > 0) {
        hospitalData.travel_times.sort((a, b) => a.travel_time - b.travel_time)
      }
      hospitalsWithTimes.push(hospitalData)
    }
    
    return NextResponse.json({
      unassigned_hospitals: hospitalsWithTimes,
      total: hospitalsWithTimes.length,
      debug: {
        total_active_hospitals: allHospitals.length,
        total_assignments: assignedIds.size,
        total_unassigned: unassignedHospitals.length,
        with_travel_times: hospitalsWithTimes.filter(h => h.travel_times.length > 0).length,
        without_travel_times: hospitalsWithTimes.filter(h => h.travel_times.length === 0).length,
        total_cache_entries: travelTimeMap.size,
        total_active_kams: kams.length
      }
    })
    
  } catch (error) {
    console.error('Error fetching unassigned hospital travel times:', error)
    return NextResponse.json({ 
      error: 'Failed to fetch travel times',
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}