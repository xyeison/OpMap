import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET() {
  console.log('🔍 API unassigned-optimized llamada')
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
    
    // 5. Para cada hospital sin asignar, buscar tiempos específicamente
    const hospitalsWithTimes: any[] = []
    
    // Procesar en lotes para evitar timeout
    const batchSize = 10
    for (let i = 0; i < unassignedHospitals.length; i += batchSize) {
      const batch = unassignedHospitals.slice(i, i + batchSize)
      
      await Promise.all(batch.map(async (hospital) => {
        // Buscar tiempos de viaje para este hospital específico
        const { data: travelTimes } = await supabase
          .from('travel_time_cache')
          .select('origin_lat, origin_lng, travel_time, source')
          .eq('dest_lat', hospital.lat)
          .eq('dest_lng', hospital.lng)
          .eq('source', 'google_maps')
        
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
        
        // Mapear tiempos con KAMs
        if (travelTimes && travelTimes.length > 0) {
          travelTimes.forEach(tt => {
            // Buscar el KAM que coincide con estas coordenadas
            const kam = kams.find(k => 
              Math.abs(k.lat - tt.origin_lat) < 0.00001 && 
              Math.abs(k.lng - tt.origin_lng) < 0.00001
            )
            
            if (kam) {
              hospitalData.travel_times.push({
                kam_id: kam.id,
                kam_name: kam.name,
                travel_time: tt.travel_time,
                is_real: true,
                source: 'Google Maps Distance Matrix API'
              })
            }
          })
          
          // Ordenar por tiempo de viaje
          hospitalData.travel_times.sort((a, b) => a.travel_time - b.travel_time)
        }
        
        hospitalsWithTimes.push(hospitalData)
      }))
    }
    
    // Ordenar hospitales por nombre para consistencia
    hospitalsWithTimes.sort((a, b) => a.name.localeCompare(b.name))
    
    return NextResponse.json({
      unassigned_hospitals: hospitalsWithTimes,
      total: hospitalsWithTimes.length,
      debug: {
        total_active_hospitals: allHospitals.length,
        total_assignments: assignedIds.size,
        total_unassigned: unassignedHospitals.length,
        with_travel_times: hospitalsWithTimes.filter(h => h.travel_times.length > 0).length,
        without_travel_times: hospitalsWithTimes.filter(h => h.travel_times.length === 0).length,
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