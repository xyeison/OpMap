import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { OpMapAlgorithmBogotaFixed } from '@/lib/opmap-algorithm-bogota-fixed'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Cliente para Google Maps
async function calculateGoogleMapsTime(
  originLat: number, 
  originLng: number, 
  destLat: number, 
  destLng: number
): Promise<{ duration: number; distance: number } | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) {
    console.error('No Google Maps API key configured')
    return null
  }

  const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${originLat},${originLng}&destinations=${destLat},${destLng}&mode=driving&language=es&units=metric&key=${apiKey}`
  
  try {
    const response = await fetch(url)
    const data = await response.json()
    
    if (data.status === 'OK' && data.rows[0].elements[0].status === 'OK') {
      const element = data.rows[0].elements[0]
      return {
        duration: element.duration.value, // segundos
        distance: element.distance.value / 1000 // km
      }
    }
  } catch (error) {
    console.error('Error calling Google Maps:', error)
  }
  
  return null
}

export async function POST() {
  try {
    console.log('🚀 RECÁLCULO CON GOOGLE MAPS (SIN HAVERSINE)')
    
    // 1. Ejecutar algoritmo inicial
    console.log('\n1. Ejecutando algoritmo con tiempos existentes...')
    const algorithm = new OpMapAlgorithmBogotaFixed()
    await algorithm.initialize()
    
    const assignments = await algorithm.calculateAssignments()
    await algorithm.saveAssignments(assignments)
    
    // 2. Identificar hospitales sin asignar
    console.log('\n2. Identificando hospitales sin asignar...')
    
    const { data: allHospitals } = await supabase
      .from('hospitals')
      .select('*')
      .eq('active', true)
    
    const { data: currentAssignments } = await supabase
      .from('assignments')
      .select('hospital_id')
    
    const assignedIds = new Set(currentAssignments?.map(a => a.hospital_id) || [])
    const unassignedHospitals = allHospitals?.filter(h => !assignedIds.has(h.id)) || []
    
    console.log(`   📊 Total hospitales: ${allHospitals?.length || 0}`)
    console.log(`   ✅ Hospitales asignados: ${assignedIds.size}`)
    console.log(`   ❌ Hospitales sin asignar: ${unassignedHospitals.length}`)
    
    // 3. Para cada hospital sin asignar, encontrar el KAM más cercano
    console.log('\n3. Calculando KAM más cercano para hospitales sin asignar...')
    
    const { data: kams } = await supabase
      .from('kams')
      .select('*')
      .eq('active', true)
    
    let newCalculations = 0
    const maxCalculationsPerRun = 100 // Límite por ejecución
    
    // Procesar hospitales sin asignar
    for (const hospital of unassignedHospitals.slice(0, 20)) { // Máximo 20 hospitales por ejecución
      console.log(`\n   🏥 Hospital: ${hospital.name} (${hospital.municipality_id})`)
      
      let bestKam = null
      let bestTime = Infinity
      
      // Probar con cada KAM
      for (const kam of kams || []) {
        // Verificar si el KAM puede competir por este hospital
        const kamDept = kam.area_id.substring(0, 2)
        const hospitalDept = hospital.department_id
        
        // Por ahora, permitir que cualquier KAM compita
        // (el algoritmo después filtrará según las reglas)
        
        // Verificar si ya existe el tiempo en caché
        const { data: existingTime } = await supabase
          .from('travel_time_cache')
          .select('travel_time')
          .eq('origin_lat', kam.lat)
          .eq('origin_lng', kam.lng)
          .eq('dest_lat', hospital.lat)
          .eq('dest_lng', hospital.lng)
          .eq('source', 'google_maps') // Solo tiempos reales
          .single()
        
        let travelTime = null
        
        if (existingTime) {
          travelTime = existingTime.travel_time
        } else if (newCalculations < maxCalculationsPerRun) {
          // Calcular con Google Maps
          const result = await calculateGoogleMapsTime(
            kam.lat, kam.lng,
            hospital.lat, hospital.lng
          )
          
          if (result) {
            // Guardar en caché
            await supabase
              .from('travel_time_cache')
              .insert({
                origin_lat: kam.lat,
                origin_lng: kam.lng,
                dest_lat: hospital.lat,
                dest_lng: hospital.lng,
                travel_time: result.duration,
                distance: result.distance,
                source: 'google_maps' // SIEMPRE google_maps
              })
            
            travelTime = result.duration
            newCalculations++
            
            const minutes = Math.round(result.duration / 60)
            console.log(`      ${kam.name}: ${minutes} min ${minutes <= 240 ? '✅' : '❌'}`)
            
            // Pequeña pausa para no saturar la API
            await new Promise(resolve => setTimeout(resolve, 100))
          }
        }
        
        // Actualizar el mejor KAM si este es más cercano
        if (travelTime && travelTime < bestTime && travelTime <= kam.max_travel_time * 60) {
          bestTime = travelTime
          bestKam = kam
        }
      }
      
      if (bestKam) {
        console.log(`      🏆 Mejor opción: ${bestKam.name} (${Math.round(bestTime/60)} min)`)
      } else {
        console.log(`      ❌ Sin KAM disponible dentro del límite de tiempo`)
      }
    }
    
    console.log(`\n   ✅ ${newCalculations} nuevos tiempos calculados con Google Maps`)
    
    // 4. Ejecutar algoritmo nuevamente con los nuevos tiempos
    console.log('\n4. Recalculando asignaciones finales...')
    
    const algorithm2 = new OpMapAlgorithmBogotaFixed()
    await algorithm2.initialize()
    
    const finalAssignments = await algorithm2.calculateAssignments()
    await algorithm2.saveAssignments(finalAssignments)
    
    // 5. Verificar resultados
    const { data: finalAssignmentCount } = await supabase
      .from('assignments')
      .select('*', { count: 'exact', head: true })
    
    const finalUnassigned = (allHospitals?.length || 0) - (finalAssignmentCount?.count || 0)
    
    console.log('\n📊 RESUMEN FINAL:')
    console.log(`   Total hospitales: ${allHospitals?.length || 0}`)
    console.log(`   Hospitales asignados: ${finalAssignmentCount?.count || 0}`)
    console.log(`   Hospitales sin asignar: ${finalUnassigned}`)
    console.log(`   Nuevos cálculos Google Maps: ${newCalculations}`)
    
    return NextResponse.json({
      success: true,
      message: 'Recálculo completado (solo Google Maps)',
      summary: {
        totalHospitals: allHospitals?.length || 0,
        assignedHospitals: finalAssignmentCount?.count || 0,
        unassignedHospitals: finalUnassigned,
        newTravelTimes: newCalculations,
        existingTravelTimes: 0,
        failedCalculations: 0
      }
    })
    
  } catch (error) {
    console.error('Error en recálculo:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Error desconocido' 
      },
      { status: 500 }
    )
  }
}