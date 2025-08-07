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
    
    // 5. Obtener TODOS los tiempos de una sola vez desde hospital_kam_distances
    const hospitalIds = unassignedHospitals.map(h => h.id)
    
    // Primero obtener las distancias
    const { data: allDistances } = await supabase
      .from('hospital_kam_distances')
      .select('hospital_id, kam_id, travel_time, distance')
      .in('hospital_id', hospitalIds)
    
    // Crear mapa de distancias por hospital
    const distancesByHospital: Record<string, any[]> = {}
    
    // Crear mapa de KAMs para búsqueda rápida
    const kamsMap: Record<string, any> = {}
    kams?.forEach(kam => {
      kamsMap[kam.id] = kam
    })
    
    if (allDistances) {
      allDistances.forEach(d => {
        const kam = kamsMap[d.kam_id]
        if (kam && kam.active) {  // Solo incluir KAMs activos
          if (!distancesByHospital[d.hospital_id]) {
            distancesByHospital[d.hospital_id] = []
          }
          distancesByHospital[d.hospital_id].push({
            kam_id: d.kam_id,
            kam_name: kam.name,
            travel_time: d.travel_time,
            max_travel_time: kam.max_travel_time || 240
          })
        }
      })
    }
    
    // 6. Construir hospitales con tiempos
    const hospitalsWithTimes: any[] = []
    
    for (const hospital of unassignedHospitals) {
      const distances = distancesByHospital[hospital.id] || []
      
      // Agregar KAMs que no tienen tiempo calculado
      const kamsWithTimes = new Set(distances.map(d => d.kam_id))
      kams?.forEach(kam => {
        if (!kamsWithTimes.has(kam.id)) {
          distances.push({
            kam_id: kam.id,
            kam_name: kam.name,
            travel_time: null,
            max_travel_time: kam.max_travel_time || 240
          })
        }
      })
      
      // Ordenar: primero los que tienen tiempo (menor a mayor), luego los null
      distances.sort((a, b) => {
        if (a.travel_time === null && b.travel_time === null) return 0
        if (a.travel_time === null) return 1
        if (b.travel_time === null) return -1
        return a.travel_time - b.travel_time
      })
        
      
      hospitalsWithTimes.push({
        id: hospital.id,
        name: hospital.name,
        code: hospital.code,
        municipality_name: hospital.municipality_name,
        department_name: hospital.department_name,
        lat: hospital.lat,
        lng: hospital.lng,
        beds: hospital.beds || 0,
        service_level: hospital.service_level || 1,
        travel_times: distances
      })
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