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
    console.log('🔧 RECÁLCULO COMPLETO CON GOOGLE MAPS INICIADO')
    
    // 1. Ejecutar algoritmo de asignación
    console.log('1. Ejecutando algoritmo de asignación...')
    const algorithm = new OpMapAlgorithmBogotaFixed()
    await algorithm.initialize()
    
    const assignments = await algorithm.calculateAssignments()
    const savedAssignments = await algorithm.saveAssignments(assignments)
    
    console.log(`   ✅ ${savedAssignments} asignaciones guardadas`)
    
    // 2. Obtener todos los KAMs y hospitales activos
    console.log('2. Cargando KAMs y hospitales...')
    
    const { data: kams } = await supabase
      .from('kams')
      .select('*')
      .eq('active', true)
    
    const { data: hospitals } = await supabase
      .from('hospitals')
      .select('*')
      .eq('active', true)
    
    console.log(`   📊 ${kams?.length || 0} KAMs activos`)
    console.log(`   🏥 ${hospitals?.length || 0} hospitales activos`)
    
    // 3. Calcular TODOS los tiempos faltantes
    console.log('3. Calculando tiempos de viaje faltantes...')
    
    let totalCalculated = 0
    let totalSkipped = 0
    let totalFailed = 0
    const batchSize = 10 // Procesar en lotes para evitar límites de API
    
    for (const kam of kams || []) {
      const kamDept = kam.area_id.substring(0, 2)
      console.log(`\n   🚗 Procesando KAM ${kam.name} (${kam.area_id})...`)
      
      // Obtener departamentos donde este KAM puede competir
      const { data: adjacency } = await supabase
        .from('department_adjacency')
        .select('adjacent_department_code')
        .eq('department_code', kamDept)
      
      const allowedDepts = new Set([kamDept])
      adjacency?.forEach(a => allowedDepts.add(a.adjacent_department_code))
      
      // Si tiene nivel 2, agregar departamentos de segundo nivel
      if (kam.enable_level2) {
        const level2Depts = new Set<string>()
        for (const dept of allowedDepts) {
          const { data: level2 } = await supabase
            .from('department_adjacency')
            .select('adjacent_department_code')
            .eq('department_code', dept)
          
          level2?.forEach(a => level2Depts.add(a.adjacent_department_code))
        }
        level2Depts.forEach(d => allowedDepts.add(d))
      }
      
      // KAMs de Bogotá pueden competir en Cundinamarca
      if (kam.area_id.startsWith('11001')) {
        allowedDepts.add('25')
        // Y departamentos adyacentes a Cundinamarca
        const { data: cundiAdjacent } = await supabase
          .from('department_adjacency')
          .select('adjacent_department_code')
          .eq('department_code', '25')
        
        cundiAdjacent?.forEach(a => allowedDepts.add(a.adjacent_department_code))
      }
      
      // Filtrar hospitales en departamentos permitidos
      const targetHospitals = hospitals?.filter(h => 
        allowedDepts.has(h.department_id)
      ) || []
      
      console.log(`      Puede competir en ${allowedDepts.size} departamentos`)
      console.log(`      ${targetHospitals.length} hospitales objetivo`)
      
      // Procesar en lotes
      for (let i = 0; i < targetHospitals.length; i += batchSize) {
        const batch = targetHospitals.slice(i, i + batchSize)
        
        for (const hospital of batch) {
          // Verificar si ya existe en caché
          const { data: existing } = await supabase
            .from('travel_time_cache')
            .select('id')
            .eq('origin_lat', kam.lat)
            .eq('origin_lng', kam.lng)
            .eq('dest_lat', hospital.lat)
            .eq('dest_lng', hospital.lng)
            .single()
          
          if (existing) {
            totalSkipped++
            continue
          }
          
          // Calcular con Google Maps
          const result = await calculateGoogleMapsTime(
            kam.lat, kam.lng,
            hospital.lat, hospital.lng
          )
          
          if (result) {
            // Guardar en caché
            const { error } = await supabase
              .from('travel_time_cache')
              .insert({
                origin_lat: kam.lat,
                origin_lng: kam.lng,
                dest_lat: hospital.lat,
                dest_lng: hospital.lng,
                travel_time: result.duration,
                distance: result.distance,
                source: 'google_maps'
              })
            
            if (!error) {
              totalCalculated++
              console.log(`      ✅ ${hospital.municipality_id}: ${Math.round(result.duration/60)} min`)
            } else {
              totalFailed++
              console.log(`      ❌ Error guardando: ${error.message}`)
            }
          } else {
            totalFailed++
            console.log(`      ❌ No se pudo calcular ruta a ${hospital.municipality_id}`)
          }
          
          // Pequeña pausa para no saturar la API
          await new Promise(resolve => setTimeout(resolve, 200))
        }
      }
    }
    
    console.log(`\n📊 RESUMEN DE CÁLCULOS:`)
    console.log(`   ✅ Nuevos tiempos calculados: ${totalCalculated}`)
    console.log(`   ⏭️ Tiempos ya existentes: ${totalSkipped}`)
    console.log(`   ❌ Cálculos fallidos: ${totalFailed}`)
    
    // 4. Volver a ejecutar el algoritmo con los nuevos tiempos
    console.log('\n4. Recalculando asignaciones con tiempos actualizados...')
    
    const algorithm2 = new OpMapAlgorithmBogotaFixed()
    await algorithm2.initialize()
    
    const finalAssignments = await algorithm2.calculateAssignments()
    const finalSaved = await algorithm2.saveAssignments(finalAssignments)
    
    console.log(`   ✅ ${finalSaved} asignaciones finales guardadas`)
    
    // 5. Resumen final
    const { count: totalHospitals } = await supabase
      .from('hospitals')
      .select('*', { count: 'exact', head: true })
      .eq('active', true)
    
    const { count: assignedCount } = await supabase
      .from('assignments')
      .select('*', { count: 'exact', head: true })
    
    return NextResponse.json({
      success: true,
      message: 'Recálculo completo exitoso',
      summary: {
        totalHospitals: totalHospitals || 0,
        assignedHospitals: assignedCount || 0,
        unassignedHospitals: (totalHospitals || 0) - (assignedCount || 0),
        newTravelTimes: totalCalculated,
        existingTravelTimes: totalSkipped,
        failedCalculations: totalFailed
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