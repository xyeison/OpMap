import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET() {
  console.log('API /travel-times/unassigned-real llamada')
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
    
    console.log(`Found ${unassignedHospitals.length} unassigned hospitals`)
    
    // Log específico para Málaga
    const malagaHospital = unassignedHospitals.find((h: any) => 
      h.municipality_name?.toLowerCase().includes('málaga')
    )
    if (malagaHospital) {
      console.log('Hospital de Málaga encontrado:', {
        id: malagaHospital.id,
        name: malagaHospital.name,
        lat: malagaHospital.lat,
        lng: malagaHospital.lng
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
    
    // 3. Para cada hospital sin asignar, buscar tiempos reales en caché
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
      
      // Buscar tiempos para cada KAM desde el caché
      for (const kam of kams) {
        // Para debug de Málaga
        if (hospital.municipality_name?.toLowerCase().includes('málaga') && 
            kam.name?.toLowerCase().includes('bucaramanga')) {
          console.log('Buscando Bucaramanga → Málaga:', {
            kam_coords: { lat: kam.lat, lng: kam.lng },
            hospital_coords: { lat: hospital.lat, lng: hospital.lng }
          })
        }
        
        // Buscar en travel_time_cache con tolerancia para coordenadas
        const { data: cachedTime } = await supabase
          .from('travel_time_cache')
          .select('travel_time')
          .eq('source', 'google_maps') // Solo datos de Google Maps
          .gte('origin_lat', kam.lat - 0.00001) // Tolerancia muy pequeña
          .lte('origin_lat', kam.lat + 0.00001)
          .gte('origin_lng', kam.lng - 0.00001)
          .lte('origin_lng', kam.lng + 0.00001)
          .gte('dest_lat', hospital.lat - 0.00001)
          .lte('dest_lat', hospital.lat + 0.00001)
          .gte('dest_lng', hospital.lng - 0.00001)
          .lte('dest_lng', hospital.lng + 0.00001)
          .limit(1)
          .maybeSingle()
        
        if (cachedTime) {
          // Debug para Málaga
          if (hospital.municipality_name?.toLowerCase().includes('málaga') && 
              kam.name?.toLowerCase().includes('bucaramanga')) {
            console.log('✅ Tiempo encontrado Bucaramanga → Málaga:', cachedTime.travel_time, 'minutos')
          }
          
          hospitalData.travel_times.push({
            kam_id: kam.id,
            kam_name: kam.name,
            travel_time: cachedTime.travel_time,
            is_real: true, // Indicar que es tiempo real de Google Maps
            source: 'Google Maps Distance Matrix API'
          })
        } else if (hospital.municipality_name?.toLowerCase().includes('málaga') && 
                   kam.name?.toLowerCase().includes('bucaramanga')) {
          console.log('❌ NO se encontró tiempo Bucaramanga → Málaga')
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
        without_travel_times: unassignedHospitals.length - hospitalsWithTimes.length
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