import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Google Maps API para calcular tiempos de viaje
async function calculateTravelTime(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number
): Promise<number | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) {
    console.error('Google Maps API key not configured')
    return null
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${originLat},${originLng}&destinations=${destLat},${destLng}&mode=driving&units=metric&key=${apiKey}`
    const response = await fetch(url)
    const data = await response.json()

    if (data.status === 'OK' && data.rows[0]?.elements[0]?.status === 'OK') {
      const durationInSeconds = data.rows[0].elements[0].duration.value
      return Math.round(durationInSeconds / 60) // Convertir a minutos
    }
  } catch (error) {
    console.error('Error calculating travel time:', error)
  }
  
  return null
}

export async function POST(request: NextRequest) {
  try {
    const { hospitalId, hospitalLat, hospitalLng, municipalityId } = await request.json()

    if (!hospitalId || !hospitalLat || !hospitalLng || !municipalityId) {
      return NextResponse.json({ error: 'Faltan parámetros requeridos' }, { status: 400 })
    }

    // 1. Obtener todos los KAMs activos
    const { data: kams, error: kamsError } = await supabase
      .from('kams')
      .select('*')
      .eq('active', true)

    if (kamsError || !kams || kams.length === 0) {
      return NextResponse.json({ error: 'No hay KAMs activos disponibles' }, { status: 400 })
    }

    // 2. Buscar si hay un KAM en el mismo municipio (territorio base)
    const localKam = kams.find(kam => kam.area_id === municipalityId)
    
    if (localKam) {
      // Asignar directamente al KAM local
      const { error: assignError } = await supabase
        .from('assignments')
        .insert({
          hospital_id: hospitalId,
          kam_id: localKam.id,
          travel_time: 0, // En territorio base
          is_base_territory: true,
          assigned_at: new Date().toISOString()
        })

      if (assignError) {
        console.error('Error assigning to local KAM:', assignError)
        return NextResponse.json({ error: 'Error al asignar al KAM local' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        kamId: localKam.id,
        kamName: localKam.name,
        travelTime: 0,
        isBaseTerritory: true
      })
    }

    // 3. Si no hay KAM local, buscar el más cercano por tiempo de viaje
    console.log('No hay KAM local, buscando el más cercano...')
    
    // Primero buscar en caché
    const { data: cachedTimes } = await supabase
      .from('travel_time_cache')
      .select('*')
      .eq('dest_lat', hospitalLat)
      .eq('dest_lng', hospitalLng)
      .eq('source', 'google_maps')

    let closestKam = null
    let shortestTime = Infinity

    // Verificar cada KAM
    for (const kam of kams) {
      let travelTime = null

      // Buscar en caché
      const cached = cachedTimes?.find(
        t => Math.abs(t.origin_lat - kam.lat) < 0.0001 && 
             Math.abs(t.origin_lng - kam.lng) < 0.0001
      )

      if (cached) {
        travelTime = cached.travel_time
      } else {
        // Calcular con Google Maps
        travelTime = await calculateTravelTime(kam.lat, kam.lng, hospitalLat, hospitalLng)
        
        // Guardar en caché si se calculó
        if (travelTime !== null) {
          await supabase
            .from('travel_time_cache')
            .insert({
              origin_lat: kam.lat,
              origin_lng: kam.lng,
              dest_lat: hospitalLat,
              dest_lng: hospitalLng,
              travel_time: travelTime,
              source: 'google_maps',
              created_at: new Date().toISOString()
            })
        }
      }

      // Verificar si es el más cercano (máximo 4 horas)
      if (travelTime !== null && travelTime < shortestTime && travelTime <= 240) {
        shortestTime = travelTime
        closestKam = kam
      }
    }

    if (!closestKam) {
      return NextResponse.json({ 
        error: 'No se encontró ningún KAM dentro del rango de 4 horas' 
      }, { status: 400 })
    }

    // 4. Asignar al KAM más cercano
    const { error: assignError } = await supabase
      .from('assignments')
      .insert({
        hospital_id: hospitalId,
        kam_id: closestKam.id,
        travel_time: shortestTime,
        is_base_territory: false,
        assigned_at: new Date().toISOString()
      })

    if (assignError) {
      console.error('Error assigning to closest KAM:', assignError)
      return NextResponse.json({ error: 'Error al asignar al KAM más cercano' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      kamId: closestKam.id,
      kamName: closestKam.name,
      travelTime: shortestTime,
      isBaseTerritory: false
    })

  } catch (error) {
    console.error('Error in assign-to-kam:', error)
    return NextResponse.json({ 
      error: 'Error interno del servidor' 
    }, { status: 500 })
  }
}