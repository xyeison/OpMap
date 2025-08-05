import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

async function calculateGoogleMapsTime(
  originLat: number, 
  originLng: number, 
  destLat: number, 
  destLng: number
): Promise<{ duration: number; distance: number } | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) return null

  const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${originLat},${originLng}&destinations=${destLat},${destLng}&mode=driving&language=es&units=metric&key=${apiKey}`
  
  try {
    const response = await fetch(url)
    const data = await response.json()
    
    if (data.status === 'OK' && data.rows[0].elements[0].status === 'OK') {
      const element = data.rows[0].elements[0]
      return {
        duration: element.duration.value,
        distance: element.distance.value / 1000
      }
    }
  } catch (error) {
    console.error('Error calling Google Maps:', error)
  }
  
  return null
}

export async function POST() {
  try {
    console.log('🎯 CALCULANDO RUTAS ESPECÍFICAS PARA GIRARDOT')
    
    // 1. Obtener todos los KAMs que pueden competir por Girardot
    const { data: kams } = await supabase
      .from('kams')
      .select('*')
      .eq('active', true)
    
    // 2. Obtener hospitales de Girardot
    const { data: hospitals } = await supabase
      .from('hospitals')
      .select('*')
      .eq('municipality_id', '25307')
      .eq('active', true)
    
    if (!hospitals || hospitals.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'No se encontraron hospitales en Girardot' 
      })
    }
    
    console.log(`Hospitales en Girardot: ${hospitals.length}`)
    
    // 3. Filtrar KAMs que pueden competir (Cundinamarca = 25, Tolima = 73, Bogotá = 11)
    const eligibleKams = kams?.filter(kam => {
      const kamDept = kam.area_id.substring(0, 2)
      // KAMs de Cundinamarca, Tolima, o Bogotá pueden competir
      return kamDept === '25' || kamDept === '73' || kamDept === '11'
    }) || []
    
    console.log(`KAMs elegibles: ${eligibleKams.map(k => k.name).join(', ')}`)
    
    let calculated = 0
    let failed = 0
    const results: any[] = []
    
    // 4. Calcular tiempos para cada combinación
    for (const kam of eligibleKams) {
      for (const hospital of hospitals) {
        // Verificar si ya existe en caché
        const { data: existing } = await supabase
          .from('travel_time_cache')
          .select('travel_time')
          .eq('origin_lat', parseFloat(kam.lat.toFixed(6)))
          .eq('origin_lng', parseFloat(kam.lng.toFixed(6)))
          .eq('dest_lat', parseFloat(hospital.lat.toFixed(6)))
          .eq('dest_lng', parseFloat(hospital.lng.toFixed(6)))
          .single()
        
        if (existing) {
          console.log(`✅ Ya existe: ${kam.name} → ${hospital.name} (${Math.round(existing.travel_time/60)} min)`)
          results.push({
            kam: kam.name,
            hospital: hospital.name,
            time: Math.round(existing.travel_time/60),
            status: 'cached'
          })
          continue
        }
        
        // Calcular con Google Maps
        console.log(`📍 Calculando: ${kam.name} → ${hospital.name}`)
        const result = await calculateGoogleMapsTime(
          kam.lat, kam.lng,
          hospital.lat, hospital.lng
        )
        
        if (result) {
          // Guardar en caché
          const { error } = await supabase
            .from('travel_time_cache')
            .insert({
              origin_lat: parseFloat(kam.lat.toFixed(6)),
              origin_lng: parseFloat(kam.lng.toFixed(6)),
              dest_lat: parseFloat(hospital.lat.toFixed(6)),
              dest_lng: parseFloat(hospital.lng.toFixed(6)),
              travel_time: result.duration,
              distance: result.distance,
              source: 'google_maps'
            })
          
          if (!error) {
            calculated++
            const timeMinutes = Math.round(result.duration/60)
            console.log(`✅ Guardado: ${timeMinutes} minutos`)
            results.push({
              kam: kam.name,
              hospital: hospital.name,
              time: timeMinutes,
              status: 'calculated'
            })
          } else {
            failed++
            console.error(`❌ Error guardando: ${error.message}`)
          }
        } else {
          failed++
          console.log(`❌ No se pudo calcular`)
        }
        
        // Pequeña pausa para no saturar la API
        await new Promise(resolve => setTimeout(resolve, 200))
      }
    }
    
    // 5. Ejecutar el algoritmo para reasignar
    console.log('\n🤖 Ejecutando algoritmo de asignación...')
    const { OpMapAlgorithmBogotaFixed } = await import('@/lib/opmap-algorithm-bogota-fixed')
    const algorithm = new OpMapAlgorithmBogotaFixed()
    await algorithm.initialize(process.env.GOOGLE_MAPS_API_KEY)
    
    const assignments = await algorithm.calculateAssignments()
    await algorithm.saveAssignments(assignments)
    
    // 6. Verificar asignaciones de Girardot
    const girardotAssignments = []
    for (const hospital of hospitals) {
      const { data: assignment } = await supabase
        .from('assignments')
        .select('*, kams(name)')
        .eq('hospital_id', hospital.id)
        .single()
      
      if (assignment) {
        girardotAssignments.push({
          hospital: hospital.name,
          assignedTo: assignment.kams.name,
          travelTime: assignment.travel_time ? Math.round(assignment.travel_time/60) : null
        })
      }
    }
    
    return NextResponse.json({
      success: true,
      message: `Proceso completado. ${calculated} rutas calculadas, ${failed} fallidas`,
      results,
      assignments: girardotAssignments,
      summary: {
        hospitalsInGirardot: hospitals.length,
        eligibleKams: eligibleKams.length,
        routesCalculated: calculated,
        routesFailed: failed
      }
    })
    
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 })
  }
}