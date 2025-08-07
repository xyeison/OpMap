import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// Función para calcular tiempo con Google Maps
async function calculateGoogleMapsTime(
  originLat: number, 
  originLng: number, 
  destLat: number, 
  destLng: number
): Promise<number | null> {
  const googleApiKey = process.env.GOOGLE_MAPS_API_KEY
  
  if (!googleApiKey) {
    console.error('No Google Maps API key configured')
    return null
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?` +
      `origins=${originLat},${originLng}&` +
      `destinations=${destLat},${destLng}&` +
      `mode=driving&language=es&units=metric&key=${googleApiKey}`
    
    const response = await fetch(url)
    const data = await response.json()
    
    if (data.status === 'OK' && data.rows[0].elements[0].status === 'OK') {
      const element = data.rows[0].elements[0]
      const travelTime = element.duration.value // segundos
      
      // Guardar en caché
      await supabase
        .from('travel_time_cache')
        .insert({
          origin_lat: parseFloat(originLat.toFixed(6)),
          origin_lng: parseFloat(originLng.toFixed(6)),
          dest_lat: parseFloat(destLat.toFixed(6)),
          dest_lng: parseFloat(destLng.toFixed(6)),
          travel_time: travelTime,
          distance: element.distance.value / 1000,
          source: 'google_maps'
        })
      
      console.log(`✅ Ruta calculada: ${Math.round(travelTime/60)} min desde (${originLat},${originLng}) a (${destLat},${destLng})`)
      return travelTime
    }
  } catch (error) {
    console.error('Error calculating route:', error)
  }
  
  return null
}

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Obteniendo hospitales sin asignar con tiempos completos...')
    
    // First get assigned hospital IDs
    const { data: assignments, error: assignmentsError } = await supabase
      .from('assignments')
      .select('hospital_id')

    if (assignmentsError) {
      return NextResponse.json({ error: assignmentsError.message }, { status: 500 })
    }

    const assignedIds = (assignments || []).map(a => a.hospital_id)

    // Get unassigned hospitals
    const query = supabase
      .from('hospitals')
      .select('id, code, name, lat, lng, municipality_id, department_id, municipality_name, department_name, beds, service_level')
      .eq('active', true)
    
    if (assignedIds.length > 0) {
      query.not('id', 'in', `(${assignedIds.join(',')})`)
    }

    const { data: hospitals, error: hospitalsError } = await query

    if (hospitalsError) {
      return NextResponse.json({ error: hospitalsError.message }, { status: 500 })
    }

    console.log(`   Hospitales sin asignar: ${hospitals?.length || 0}`)

    // Get all active KAMs
    const { data: kams, error: kamsError } = await supabase
      .from('kams')
      .select('id, name, lat, lng, area_id, max_travel_time')
      .eq('active', true)

    if (kamsError) {
      return NextResponse.json({ error: kamsError.message }, { status: 500 })
    }

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

    let newRoutesCalculated = 0
    const maxNewRoutes = 50 // Límite para no abusar de la API

    // For each unassigned hospital, get travel times to ALL KAMs
    const unassignedWithTimes = await Promise.all(
      (hospitals || []).map(async (hospital) => {
        const travelTimes = await Promise.all(
          (kams || []).map(async (kam) => {
            // Round coordinates to 6 decimals to match database precision
            const roundedKamLat = parseFloat(kam.lat.toFixed(6))
            const roundedKamLng = parseFloat(kam.lng.toFixed(6))
            const roundedHospitalLat = parseFloat(hospital.lat.toFixed(6))
            const roundedHospitalLng = parseFloat(hospital.lng.toFixed(6))
            
            // Primero buscar en caché
            const { data: cacheData } = await supabase
              .from('travel_time_cache')
              .select('travel_time')
              .eq('origin_lat', roundedKamLat)
              .eq('origin_lng', roundedKamLng)
              .eq('dest_lat', roundedHospitalLat)
              .eq('dest_lng', roundedHospitalLng)
              .maybeSingle()

            let travelTime = cacheData?.travel_time || null
            
            // Si no está en caché, verificar si debemos calcularlo
            if (!travelTime && newRoutesCalculated < maxNewRoutes) {
              // Verificar proximidad (mismo criterio que el algoritmo principal)
              const kamDept = kam.area_id.substring(0, 2)
              const hospitalDept = hospital.department_id
              
              const isSameDept = kamDept === hospitalDept
              const isAdjacent = adjacencyMatrix[kamDept]?.includes(hospitalDept)
              const isLevel2 = adjacencyMatrix[kamDept]?.some(adj => 
                adjacencyMatrix[adj]?.includes(hospitalDept)
              )
              
              // KAMs de Bogotá pueden competir en Cundinamarca y vecinos
              const isBogotaKam = kam.area_id.startsWith('11001')
              const canBogotaCompete = isBogotaKam && 
                (hospitalDept === '11' || hospitalDept === '25' || 
                 adjacencyMatrix['25']?.includes(hospitalDept))
              
              const shouldCalculate = isSameDept || isAdjacent || isLevel2 || canBogotaCompete
              
              if (shouldCalculate) {
                console.log(`   📍 Calculando ruta nueva: ${kam.name} → ${hospital.name}`)
                travelTime = await calculateGoogleMapsTime(
                  roundedKamLat, 
                  roundedKamLng, 
                  roundedHospitalLat, 
                  roundedHospitalLng
                )
                if (travelTime) {
                  newRoutesCalculated++
                }
              }
            }

            return {
              kam_id: kam.id,
              kam_name: kam.name,
              travel_time: travelTime,
              max_travel_time: kam.max_travel_time
            }
          })
        )

        // Incluir TODOS los tiempos (no filtrar nulls) y ordenar
        const allTimes = travelTimes.sort((a, b) => {
          if (a.travel_time === null && b.travel_time === null) return 0
          if (a.travel_time === null) return 1
          if (b.travel_time === null) return -1
          return (a.travel_time || 0) - (b.travel_time || 0)
        })

        return {
          ...hospital,
          travel_times: allTimes
        }
      })
    )

    console.log(`✅ Completado. ${newRoutesCalculated} rutas nuevas calculadas`)

    return NextResponse.json({ 
      unassigned_hospitals: unassignedWithTimes,
      total: unassignedWithTimes.length,
      new_routes_calculated: newRoutesCalculated
    })
  } catch (error) {
    console.error('Error fetching unassigned hospital travel times:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}