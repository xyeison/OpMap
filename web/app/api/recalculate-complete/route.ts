import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { OpMapAlgorithmBogotaFixed } from '@/lib/opmap-algorithm-bogota-fixed'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST() {
  try {
    console.log('🔧 RECÁLCULO COMPLETO INICIADO')
    
    // 1. Ejecutar algoritmo de asignación
    console.log('1. Ejecutando algoritmo de asignación...')
    const algorithm = new OpMapAlgorithmBogotaFixed()
    await algorithm.initialize()
    
    const assignments = await algorithm.calculateAssignments()
    const savedAssignments = await algorithm.saveAssignments(assignments)
    
    console.log(`   ✅ ${savedAssignments} asignaciones guardadas`)
    
    // 2. Identificar hospitales sin asignar
    console.log('2. Identificando hospitales sin asignar...')
    
    const { data: allHospitals } = await supabase
      .from('hospitals')
      .select('*')
      .eq('active', true)
    
    const { data: currentAssignments } = await supabase
      .from('assignments')
      .select('hospital_id')
    
    const assignedIds = new Set((currentAssignments || []).map(a => a.hospital_id))
    const unassignedHospitals = (allHospitals || []).filter(h => !assignedIds.has(h.id))
    
    console.log(`   📊 Hospitales sin asignar: ${unassignedHospitals.length}`)
    
    // 3. Calcular tiempos para hospitales sin asignar
    console.log('3. Calculando tiempos de viaje para hospitales sin asignar...')
    
    const { data: kams } = await supabase
      .from('kams')
      .select('*')
      .eq('active', true)
    
    let newTravelTimes = 0
    let existingTimes = 0
    
    // Para cada hospital sin asignar
    for (const hospital of unassignedHospitals.slice(0, 10)) { // Limitar a 10 para evitar timeout
      // Calcular tiempo a cada KAM
      for (const kam of kams || []) {
        // Verificar si ya existe
        const { data: existing } = await supabase
          .from('travel_time_cache')
          .select('id')
          .eq('origin_lat', kam.lat)
          .eq('origin_lng', kam.lng)
          .eq('dest_lat', hospital.lat)
          .eq('dest_lng', hospital.lng)
          .eq('source', 'google_maps')
          .single()
        
        if (existing) {
          existingTimes++
        } else {
          // Calcular distancia Haversine como estimación
          const R = 6371
          const dLat = (hospital.lat - kam.lat) * Math.PI / 180
          const dLon = (hospital.lng - kam.lng) * Math.PI / 180
          const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(kam.lat * Math.PI / 180) * Math.cos(hospital.lat * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2)
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
          const distance = R * c
          
          // Estimar tiempo (60 km/h promedio)
          const estimatedTime = Math.round(distance * 60) // minutos
          
          // Guardar estimación temporal
          await supabase
            .from('travel_time_cache')
            .insert({
              origin_lat: kam.lat,
              origin_lng: kam.lng,
              dest_lat: hospital.lat,
              dest_lng: hospital.lng,
              travel_time: estimatedTime * 60, // segundos
              distance: distance,
              source: 'haversine_estimate'
            })
          
          newTravelTimes++
        }
      }
    }
    
    console.log(`   ✅ Tiempos existentes: ${existingTimes}`)
    console.log(`   ✅ Nuevos tiempos estimados: ${newTravelTimes}`)
    
    // 4. Resumen final
    const { count: finalAssignments } = await supabase
      .from('assignments')
      .select('*', { count: 'exact', head: true })
    
    const { count: totalHospitals } = await supabase
      .from('hospitals')
      .select('*', { count: 'exact', head: true })
      .eq('active', true)
    
    return NextResponse.json({
      success: true,
      message: 'Recálculo completo exitoso',
      summary: {
        totalHospitals: totalHospitals || 0,
        assignedHospitals: finalAssignments || 0,
        unassignedHospitals: unassignedHospitals.length,
        newTravelTimes: newTravelTimes,
        existingTravelTimes: existingTimes
      }
    })
    
  } catch (error) {
    console.error('Error en recálculo completo:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Error desconocido' 
      },
      { status: 500 }
    )
  }
}