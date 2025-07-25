import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import googleCacheData from '../../../../../data/cache/google_distance_matrix_cache.json'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET() {
  try {
    // 1. Obtener hospitales sin asignar
    const { data: assignments } = await supabase
      .from('assignments')
      .select('hospital_id')
    
    const assignedIds = (assignments || []).map(a => a.hospital_id)
    
    const { data: unassignedHospitals } = await supabase
      .from('hospitals')
      .select('*')
      .eq('active', true)
      .not('id', 'in', `(${assignedIds.length > 0 ? assignedIds.join(',') : '0'})`)
    
    if (!unassignedHospitals || unassignedHospitals.length === 0) {
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
    
    // 3. Usar el caché de Google Maps directamente
    const hospitalsWithTimes = []
    
    for (const hospital of unassignedHospitals) {
      const hospitalData = {
        id: hospital.id,
        name: hospital.name,
        code: hospital.code,
        municipality_name: hospital.municipality_name,
        lat: hospital.lat,
        lng: hospital.lng,
        travel_times: []
      }
      
      // Buscar tiempos para cada KAM en el caché local
      for (const kam of kams) {
        // Construir la clave del caché
        const cacheKey = `${kam.lat},${kam.lng}|${hospital.lat},${hospital.lng}`
        const travelTimeMinutes = (googleCacheData as any)[cacheKey]
        
        if (travelTimeMinutes !== undefined) {
          hospitalData.travel_times.push({
            kam_id: kam.id,
            kam_name: kam.name,
            travel_time: Math.round(travelTimeMinutes),
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
        total_unassigned: unassignedHospitals.length,
        with_travel_times: hospitalsWithTimes.length,
        without_travel_times: unassignedHospitals.length - hospitalsWithTimes.length,
        cache_source: 'google_distance_matrix_cache.json',
        total_cache_entries: Object.keys(googleCacheData).length
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