import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET() {
  console.log('🔍 API unassigned-all llamada')
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
    
    console.log(`Total hospitales activos: ${allHospitals.length}`)
    console.log(`Hospitales asignados: ${assignedIds.size}`)
    console.log(`Hospitales sin asignar: ${unassignedHospitals.length}`)
    
    // 4. Obtener todos los KAMs activos
    const { data: kams } = await supabase
      .from('kams')
      .select('*')
      .eq('active', true)
    
    if (!kams || kams.length === 0) {
      return NextResponse.json({ 
        unassigned_hospitals: [],
        total: 0,
        error: 'No active KAMs found' 
      })
    }
    
    // 5. Obtener TODOS los tiempos de viaje
    const { data: allTravelTimes } = await supabase
      .from('travel_time_cache')
      .select('origin_lat, origin_lng, dest_lat, dest_lng, travel_time, source')
      .limit(20000) // Aumentar límite significativamente
    
    console.log(`Tiempos de viaje cargados: ${allTravelTimes?.length || 0}`)
    
    // Crear un mapa para búsqueda rápida con diferentes niveles de precisión
    const travelTimeMap = new Map<string, { time: number, source: string }>()
    allTravelTimes?.forEach(tt => {
      // Intentar con diferentes precisiones
      for (let precision = 8; precision >= 4; precision--) {
        const key = `${tt.origin_lat.toFixed(precision)},${tt.origin_lng.toFixed(precision)}|${tt.dest_lat.toFixed(precision)},${tt.dest_lng.toFixed(precision)}`
        if (!travelTimeMap.has(key)) {
          travelTimeMap.set(key, { time: tt.travel_time, source: tt.source })
        }
      }
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
        beds: number
        service_level: number
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
        beds: hospital.beds || 0,
        service_level: hospital.service_level || 1,
        travel_times: []
      }
      
      // Buscar tiempos para cada KAM con diferentes precisiones
      for (const kam of kams) {
        let travelTimeData = null
        
        // Intentar con diferentes precisiones
        for (let precision = 8; precision >= 4 && !travelTimeData; precision--) {
          const key = `${kam.lat.toFixed(precision)},${kam.lng.toFixed(precision)}|${hospital.lat.toFixed(precision)},${hospital.lng.toFixed(precision)}`
          travelTimeData = travelTimeMap.get(key)
        }
        
        if (travelTimeData) {
          // Validar que el tiempo sea razonable (más de 10 minutos si está a más de 50km)
          const distance = getHaversineDistance(kam.lat, kam.lng, hospital.lat, hospital.lng)
          const minReasonableTime = distance > 50 ? 600 : 0 // Si está a más de 50km, mínimo 10 minutos
          
          if (travelTimeData.time >= minReasonableTime || travelTimeData.source === 'google_maps') {
            hospitalData.travel_times.push({
              kam_id: kam.id,
              kam_name: kam.name,
              travel_time: travelTimeData.time,
              is_real: travelTimeData.source === 'google_maps',
              source: travelTimeData.source
            })
          }
        }
      }
      
      // Incluir TODOS los hospitales sin asignar, tengan o no tiempos calculados
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
        total_travel_times_loaded: allTravelTimes?.length || 0,
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

// Función auxiliar para calcular distancia Haversine
function getHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371 // Radio de la Tierra en km
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  return R * c
}