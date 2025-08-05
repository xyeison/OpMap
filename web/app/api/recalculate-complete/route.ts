import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { OpMapAlgorithmBogotaFixed } from '@/lib/opmap-algorithm-bogota-fixed'

// Forzar esta ruta como dinámica
export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 300 // 5 minutos

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
    console.log('🚀 RECÁLCULO COMPLETO - PROCESANDO TODO')
    
    // 1. Obtener todos los datos necesarios
    const [hospitalsResult, kamsResult, adjacencyResult] = await Promise.all([
      supabase.from('hospitals').select('*').eq('active', true),
      supabase.from('kams').select('*').eq('active', true),
      supabase.from('department_adjacency').select('*')
    ])

    const hospitals = hospitalsResult.data || []
    const kams = kamsResult.data || []
    
    console.log(`\n📊 Datos cargados:`)
    console.log(`   - Hospitales: ${hospitals.length}`)
    console.log(`   - KAMs: ${kams.length}`)

    // 2. Construir mapa de adyacencia
    const adjacencyMap: Record<string, Set<string>> = {}
    for (const adj of adjacencyResult.data || []) {
      if (!adjacencyMap[adj.department_code]) {
        adjacencyMap[adj.department_code] = new Set()
      }
      adjacencyMap[adj.department_code].add(adj.adjacent_department_code)
    }

    // 3. Para cada KAM, determinar qué hospitales puede competir
    const kamSearchAreas: Record<string, Set<string>> = {}
    
    for (const kam of kams) {
      const kamDept = kam.area_id.substring(0, 2)
      const searchDepts = new Set<string>([kamDept])
      
      // Nivel 1: departamentos fronterizos
      if (adjacencyMap[kamDept]) {
        adjacencyMap[kamDept].forEach(dept => searchDepts.add(dept))
      }
      
      // Nivel 2: fronterizos de fronterizos (si está habilitado)
      if (kam.enable_level2) {
        const level1Depts = Array.from(searchDepts)
        for (const dept of level1Depts) {
          if (adjacencyMap[dept]) {
            adjacencyMap[dept].forEach(d => searchDepts.add(d))
          }
        }
      }
      
      kamSearchAreas[kam.id] = searchDepts
    }

    // 4. Identificar todos los pares KAM-Hospital que necesitan tiempo
    console.log('\n🔍 Identificando rutas necesarias...')
    const routesNeeded: Array<{kam: any, hospital: any}> = []
    
    for (const kam of kams) {
      const searchDepts = kamSearchAreas[kam.id]
      
      for (const hospital of hospitals) {
        // Skip si es territorio base
        if (hospital.municipality_id === kam.area_id || hospital.locality_id === kam.area_id) {
          continue
        }
        
        // Skip si el hospital no está en área de búsqueda
        if (!searchDepts.has(hospital.department_id)) {
          continue
        }
        
        // Verificar si ya existe el tiempo
        const existingTime = await supabase
          .from('travel_time_cache')
          .select('travel_time')
          .eq('origin_lat', kam.lat)
          .eq('origin_lng', kam.lng)
          .eq('dest_lat', hospital.lat)
          .eq('dest_lng', hospital.lng)
          .single()
        
        if (!existingTime.data) {
          routesNeeded.push({ kam, hospital })
        }
      }
    }

    console.log(`   Rutas faltantes: ${routesNeeded.length}`)

    // 5. Calcular tiempos faltantes con Google Maps
    let calculated = 0
    const errors: string[] = []
    const startTime = Date.now()
    const maxExecutionTime = 280000 // 4:40 minutos para dejar margen
    
    console.log('\n⏱️ Calculando tiempos con Google Maps...')
    
    for (const route of routesNeeded) {
      // Verificar tiempo de ejecución
      if (Date.now() - startTime > maxExecutionTime) {
        console.log('   ⚠️ Acercándose al límite de tiempo, guardando progreso...')
        break
      }
      
      const result = await calculateGoogleMapsTime(
        route.kam.lat, route.kam.lng,
        route.hospital.lat, route.hospital.lng
      )
      
      if (result && result.duration <= route.kam.max_travel_time * 60) {
        await supabase.from('travel_time_cache').insert({
          origin_lat: route.kam.lat,
          origin_lng: route.kam.lng,
          dest_lat: route.hospital.lat,
          dest_lng: route.hospital.lng,
          travel_time: result.duration,
          distance: result.distance,
          source: 'google_maps'
        })
        
        calculated++
        
        if (calculated % 10 === 0) {
          console.log(`   Progreso: ${calculated}/${routesNeeded.length}`)
        }
        
        // Pequeña pausa para no saturar la API
        await new Promise(resolve => setTimeout(resolve, 200))
      }
    }

    console.log(`\n✅ Tiempos calculados: ${calculated}`)
    
    // 6. Ejecutar el algoritmo de asignación
    console.log('\n🤖 Ejecutando algoritmo de asignación...')
    const algorithm = new OpMapAlgorithmBogotaFixed()
    await algorithm.initialize()
    
    const assignments = await algorithm.calculateAssignments()
    await algorithm.saveAssignments(assignments)
    
    // 7. Estadísticas finales
    const { count: assignedCount } = await supabase
      .from('assignments')
      .select('*', { count: 'exact', head: true })
    
    const unassignedCount = hospitals.length - (assignedCount || 0)
    const remainingRoutes = routesNeeded.length - calculated
    
    console.log('\n📊 RESUMEN FINAL:')
    console.log(`   Total hospitales: ${hospitals.length}`)
    console.log(`   Hospitales asignados: ${assignedCount || 0}`)
    console.log(`   Hospitales sin asignar: ${unassignedCount}`)
    console.log(`   Rutas calculadas: ${calculated}`)
    console.log(`   Rutas pendientes: ${remainingRoutes}`)
    
    return NextResponse.json({
      success: true,
      message: remainingRoutes > 0 
        ? 'Recálculo parcial completado. Ejecute nuevamente para continuar.'
        : 'Recálculo completo finalizado',
      summary: {
        totalHospitals: hospitals.length,
        assignedHospitals: assignedCount || 0,
        unassignedHospitals: unassignedCount,
        routesCalculated: calculated,
        routesPending: remainingRoutes,
        errors: errors.length
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