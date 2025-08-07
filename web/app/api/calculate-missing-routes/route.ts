import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST() {
  try {
    console.log('🚀 Calculando TODAS las rutas faltantes para hospitales sin asignar...')
    
    // Obtener hospitales sin asignar
    const { data: assignments } = await supabase
      .from('assignments')
      .select('hospital_id')
    
    const assignedIds = (assignments || []).map(a => a.hospital_id)
    
    const query = supabase
      .from('hospitals')
      .select('*')
      .eq('active', true)
    
    if (assignedIds.length > 0) {
      query.not('id', 'in', `(${assignedIds.join(',')})`)
    }
    
    const { data: unassignedHospitals } = await query
    
    if (!unassignedHospitals || unassignedHospitals.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No hay hospitales sin asignar'
      })
    }
    
    console.log(`   Hospitales sin asignar: ${unassignedHospitals.length}`)
    
    // Obtener todos los KAMs activos
    const { data: kams } = await supabase
      .from('kams')
      .select('*')
      .eq('active', true)
    
    console.log(`   KAMs activos: ${kams?.length || 0}`)
    
    // Cargar matriz de adyacencia
    const { data: adjacencyData } = await supabase
      .from('department_adjacency')
      .select('department_code, adjacent_department_code')
    
    const adjacencyMatrix: Record<string, string[]> = {}
    adjacencyData?.forEach(row => {
      if (!adjacencyMatrix[row.department_code]) {
        adjacencyMatrix[row.department_code] = []
      }
      adjacencyMatrix[row.department_code].push(row.adjacent_department_code)
    })
    
    const googleApiKey = process.env.GOOGLE_MAPS_API_KEY
    if (!googleApiKey) {
      return NextResponse.json({
        success: false,
        error: 'Google Maps API key no configurada'
      }, { status: 500 })
    }
    
    let routesCalculated = 0
    let routesSkipped = 0
    let routesFailed = 0
    
    // Para cada hospital sin asignar
    for (const hospital of unassignedHospitals) {
      console.log(`\n📍 Procesando: ${hospital.name} (${hospital.municipality_name})`)
      
      for (const kam of kams || []) {
        // Verificar si ya existe en caché
        const roundedKamLat = parseFloat(kam.lat.toFixed(6))
        const roundedKamLng = parseFloat(kam.lng.toFixed(6))
        const roundedHospitalLat = parseFloat(hospital.lat.toFixed(6))
        const roundedHospitalLng = parseFloat(hospital.lng.toFixed(6))
        
        const { data: existing } = await supabase
          .from('travel_time_cache')
          .select('travel_time')
          .eq('origin_lat', roundedKamLat)
          .eq('origin_lng', roundedKamLng)
          .eq('dest_lat', roundedHospitalLat)
          .eq('dest_lng', roundedHospitalLng)
          .maybeSingle()
        
        if (existing) {
          continue // Ya existe, saltar
        }
        
        // Verificar proximidad
        const kamDept = kam.area_id.substring(0, 2)
        const hospitalDept = hospital.department_id
        
        const isSameDept = kamDept === hospitalDept
        const isAdjacent = adjacencyMatrix[kamDept]?.includes(hospitalDept)
        const isLevel2 = kam.enable_level2 && adjacencyMatrix[kamDept]?.some(adj => 
          adjacencyMatrix[adj]?.includes(hospitalDept)
        )
        
        // KAMs de Bogotá
        const isBogotaKam = kam.area_id.startsWith('11001')
        const canBogotaCompete = isBogotaKam && 
          (hospitalDept === '11' || hospitalDept === '25' || 
           adjacencyMatrix['25']?.includes(hospitalDept))
        
        const shouldCalculate = isSameDept || isAdjacent || isLevel2 || canBogotaCompete
        
        if (!shouldCalculate) {
          routesSkipped++
          continue
        }
        
        // Calcular con Google Maps
        try {
          const url = `https://maps.googleapis.com/maps/api/distancematrix/json?` +
            `origins=${roundedKamLat},${roundedKamLng}&` +
            `destinations=${roundedHospitalLat},${roundedHospitalLng}&` +
            `mode=driving&language=es&units=metric&key=${googleApiKey}`
          
          const response = await fetch(url)
          const data = await response.json()
          
          if (data.status === 'OK' && data.rows[0].elements[0].status === 'OK') {
            const element = data.rows[0].elements[0]
            const travelTime = element.duration.value
            
            // Guardar en caché
            await supabase
              .from('travel_time_cache')
              .insert({
                origin_lat: roundedKamLat,
                origin_lng: roundedKamLng,
                dest_lat: roundedHospitalLat,
                dest_lng: roundedHospitalLng,
                travel_time: travelTime,
                distance: element.distance.value / 1000,
                source: 'google_maps'
              })
            
            console.log(`   ✅ ${kam.name} → ${hospital.name}: ${Math.round(travelTime/60)} min`)
            routesCalculated++
            
            // Pequeña pausa para no saturar la API
            await new Promise(resolve => setTimeout(resolve, 100))
          } else {
            console.log(`   ❌ No hay ruta: ${kam.name} → ${hospital.name}`)
            routesFailed++
          }
        } catch (error) {
          console.error(`   ❌ Error: ${error}`)
          routesFailed++
        }
      }
    }
    
    const message = `Proceso completado. ${routesCalculated} rutas calculadas, ${routesSkipped} omitidas (no cumplen criterios), ${routesFailed} fallidas`
    console.log(`\n✅ ${message}`)
    
    return NextResponse.json({
      success: true,
      message,
      summary: {
        hospitalsProcessed: unassignedHospitals.length,
        routesCalculated,
        routesSkipped,
        routesFailed
      }
    })
    
  } catch (error) {
    console.error('Error calculando rutas:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Error desconocido' 
      },
      { status: 500 }
    )
  }
}