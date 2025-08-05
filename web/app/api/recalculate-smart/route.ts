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
    console.log('🚀 RECÁLCULO INTELIGENTE - Calculando solo lo necesario')
    
    // 1. Cargar todos los datos necesarios
    const [hospitalsResult, kamsResult, adjacencyResult, cacheResult] = await Promise.all([
      supabase.from('hospitals').select('*').eq('active', true),
      supabase.from('kams').select('*').eq('active', true),
      supabase.from('department_adjacency').select('*'),
      supabase.from('travel_time_cache').select('origin_lat, origin_lng, dest_lat, dest_lng')
    ])

    const hospitals = hospitalsResult.data || []
    const kams = kamsResult.data || []
    const adjacencyData = adjacencyResult.data || []
    const existingCache = cacheResult.data || []
    
    console.log(`\n📊 Datos cargados:`)
    console.log(`   - Hospitales activos: ${hospitals.length}`)
    console.log(`   - KAMs activos: ${kams.length}`)
    console.log(`   - Tiempos en caché: ${existingCache.length}`)

    // 2. Construir mapa de adyacencia
    const adjacencyMap: Record<string, Set<string>> = {}
    for (const adj of adjacencyData) {
      if (!adjacencyMap[adj.department_code]) {
        adjacencyMap[adj.department_code] = new Set()
      }
      adjacencyMap[adj.department_code].add(adj.adjacent_department_code)
    }

    // 3. Crear un Set de tiempos existentes para búsqueda rápida
    const cacheKey = (olat: number, olng: number, dlat: number, dlng: number) => 
      `${olat.toFixed(6)},${olng.toFixed(6)}->${dlat.toFixed(6)},${dlng.toFixed(6)}`
    
    const existingCacheSet = new Set(
      existingCache.map(c => cacheKey(c.origin_lat, c.origin_lng, c.dest_lat, c.dest_lng))
    )

    // 4. Para cada KAM, determinar qué hospitales puede competir
    const routesNeeded: Array<{kam: any, hospital: any}> = []
    let routesInCache = 0
    let routesInBaseTerritory = 0
    
    for (const kam of kams) {
      const kamDept = kam.area_id.substring(0, 2)
      
      // Determinar departamentos donde puede buscar
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
      
      // Verificar cada hospital
      for (const hospital of hospitals) {
        // Skip si es territorio base
        if (hospital.municipality_id === kam.area_id || hospital.locality_id === kam.area_id) {
          routesInBaseTerritory++
          continue
        }
        
        // Skip si el hospital no está en área de búsqueda
        if (!searchDepts.has(hospital.department_id)) {
          continue
        }
        
        // Verificar si ya existe en caché
        const key = cacheKey(kam.lat, kam.lng, hospital.lat, hospital.lng)
        if (existingCacheSet.has(key)) {
          routesInCache++
        } else {
          routesNeeded.push({ kam, hospital })
        }
      }
    }

    console.log(`\n🔍 Análisis de rutas:`)
    console.log(`   - Territorio base (no necesitan cálculo): ${routesInBaseTerritory}`)
    console.log(`   - Ya en caché: ${routesInCache}`)
    console.log(`   - Necesitan calcularse: ${routesNeeded.length}`)

    // 5. Calcular tiempos faltantes con Google Maps
    let calculated = 0
    const startTime = Date.now()
    const maxExecutionTime = 280000 // 4:40 minutos
    
    if (routesNeeded.length > 0) {
      console.log(`\n⏱️ Calculando ${routesNeeded.length} rutas con Google Maps...`)
      
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
        
        if (result) {
          // Intentar guardar en caché
          const { data: insertData, error: insertError } = await supabase
            .from('travel_time_cache')
            .insert({
              origin_lat: route.kam.lat,
              origin_lng: route.kam.lng,
              dest_lat: route.hospital.lat,
              dest_lng: route.hospital.lng,
              travel_time: result.duration,
              distance: result.distance,
              source: 'google_maps'
            })
            .select()
          
          if (insertError) {
            console.error(`   ❌ Error guardando en caché: ${insertError.message}`)
            console.error(`      Ruta: ${route.kam.name} → ${route.hospital.name}`)
          } else {
            calculated++
            console.log(`   ✅ Guardado: ${route.kam.name} → ${route.hospital.name} (${Math.round(result.duration/60)} min)`)
          }
          
          if (calculated % 10 === 0) {
            console.log(`   Progreso: ${calculated}/${routesNeeded.length}`)
          }
          
          // Pequeña pausa para no saturar la API
          await new Promise(resolve => setTimeout(resolve, 200))
        } else {
          console.log(`   ⚠️ No se pudo calcular: ${route.kam.name} → ${route.hospital.name}`)
        }
      }
      
      console.log(`\n✅ Tiempos calculados: ${calculated}`)
    }
    
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
    
    // 8. Verificar específicamente Girardot
    const girardotHospitals = await supabase
      .from('hospitals')
      .select('*')
      .eq('municipality_id', '25307')
      .eq('active', true)
    
    if (girardotHospitals.data && girardotHospitals.data.length > 0) {
      console.log('\n🎯 Verificando Girardot:')
      for (const hosp of girardotHospitals.data) {
        const assignment = await supabase
          .from('assignments')
          .select('*, kams(name)')
          .eq('hospital_id', hosp.id)
          .single()
        
        if (assignment.data) {
          console.log(`   - ${hosp.name}: Asignado a ${assignment.data.kams.name}`)
        }
      }
    }
    
    return NextResponse.json({
      success: true,
      message: remainingRoutes > 0 
        ? `Progreso guardado. ${calculated} rutas calculadas, ${remainingRoutes} pendientes. Ejecute nuevamente.`
        : 'Recálculo completo finalizado',
      summary: {
        totalHospitals: hospitals.length,
        assignedHospitals: assignedCount || 0,
        unassignedHospitals: unassignedCount,
        routesCalculated: calculated,
        routesPending: remainingRoutes,
        routesInCache: routesInCache,
        routesInBaseTerritory: routesInBaseTerritory
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