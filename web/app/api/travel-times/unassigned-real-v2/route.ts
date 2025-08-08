import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Forzar esta ruta como dinámica
export const dynamic = 'force-dynamic'
export const revalidate = 0

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET() {
  console.log('🔍 API unassigned-real-v2 llamada')
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
    
    // Verificar si Málaga está en la lista
    const malaga = unassignedHospitals.find(h => 
      h.municipality_name?.toLowerCase().includes('málaga')
    )
    if (malaga) {
      console.log('✅ Málaga encontrado en hospitales sin asignar:', malaga.id)
    }
    
    if (unassignedHospitals.length === 0) {
      return NextResponse.json({ 
        unassigned_hospitals: [],
        total: 0 
      })
    }
    
    // 2. Obtener todos los KAMs activos
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
    
    // 3. Obtener TODOS los tiempos de viaje (con límite aumentado)
    const { data: allTravelTimes, error: travelError } = await supabase
      .from('travel_time_cache')
      .select('origin_lat, origin_lng, dest_lat, dest_lng, travel_time')
      .eq('source', 'google_maps')
      .limit(10000) // Aumentar límite para obtener todas las 3,603 filas
    
    if (travelError) {
      console.error('Error cargando travel times:', travelError)
    }
    
    console.log(`Tiempos de viaje cargados: ${allTravelTimes?.length || 0}`)
    
    // Crear un mapa para búsqueda rápida
    const travelTimeMap = new Map<string, number>()
    allTravelTimes?.forEach(tt => {
      // Crear clave con precisión reducida (8 decimales)
      const key = `${tt.origin_lat.toFixed(8)},${tt.origin_lng.toFixed(8)}|${tt.dest_lat.toFixed(8)},${tt.dest_lng.toFixed(8)}`
      travelTimeMap.set(key, tt.travel_time)
    })
    
    // 4. Para cada hospital sin asignar, buscar tiempos
    const hospitalsWithTimes: any[] = []
    
    for (const hospital of unassignedHospitals) {
      const hospitalData: {
        id: string
        name: string
        code: string
        municipality_name: string
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
      
      // Solo incluir hospitales que tienen al menos un tiempo calculado
      if (hospitalData.travel_times.length > 0) {
        // Ordenar por tiempo de viaje
        hospitalData.travel_times.sort((a, b) => a.travel_time - b.travel_time)
        hospitalsWithTimes.push(hospitalData)
      }
    }
    
    return NextResponse.json({
      unassigned_hospitals: hospitalsWithTimes,
      total: hospitalsWithTimes.length,
      debug: {
        total_active_hospitals: allHospitals.length,
        total_assignments: assignedIds.size,
        total_unassigned: unassignedHospitals.length,
        with_travel_times: hospitalsWithTimes.length,
        without_travel_times: unassignedHospitals.length - hospitalsWithTimes.length,
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