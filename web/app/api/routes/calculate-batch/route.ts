import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { headers } from 'next/headers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutos máximo

interface RouteToCalculate {
  hospital_id: string
  hospital_name: string
  hospital_coords: { lat: number; lng: number }
  kam_id: string
  kam_name: string
  kam_coords: { lat: number; lng: number }
}

// Función para calcular distancia usando Google Distance Matrix API
async function calculateGoogleDistance(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number }
): Promise<{ distance: number; duration: number } | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  
  if (!apiKey) {
    console.error('Google Maps API key not configured')
    return null
  }

  try {
    const url = new URL('https://maps.googleapis.com/maps/api/distancematrix/json')
    url.searchParams.append('origins', `${origin.lat},${origin.lng}`)
    url.searchParams.append('destinations', `${destination.lat},${destination.lng}`)
    url.searchParams.append('mode', 'driving')
    url.searchParams.append('units', 'metric')
    url.searchParams.append('key', apiKey)

    const response = await fetch(url.toString())
    
    if (!response.ok) {
      console.error('Google Maps API error:', response.status)
      return null
    }

    const data = await response.json()
    
    if (data.status !== 'OK' || !data.rows?.[0]?.elements?.[0]) {
      console.error('Invalid Google Maps response:', data.status)
      return null
    }

    const element = data.rows[0].elements[0]
    
    if (element.status !== 'OK') {
      console.error('Route not found:', element.status)
      return null
    }

    return {
      distance: element.distance.value / 1000, // Convertir a km
      duration: element.duration.value / 60 // Convertir a minutos
    }
  } catch (error) {
    console.error('Error calling Google Maps API:', error)
    return null
  }
}

// Función para calcular rutas en lote con rate limiting
async function calculateRouteBatch(
  routes: RouteToCalculate[],
  onProgress?: (current: number, total: number) => void
): Promise<any[]> {
  const results = []
  const batchSize = 10 // Procesar de a 10 para no sobrecargar
  const delayBetweenBatches = 1000 // 1 segundo entre lotes

  for (let i = 0; i < routes.length; i += batchSize) {
    const batch = routes.slice(i, Math.min(i + batchSize, routes.length))
    
    // Procesar lote en paralelo
    const batchPromises = batch.map(async (route) => {
      const result = await calculateGoogleDistance(
        route.kam_coords,
        route.hospital_coords
      )
      
      if (result) {
        return {
          hospital_id: route.hospital_id,
          hospital_name: route.hospital_name,
          kam_id: route.kam_id,
          kam_name: route.kam_name,
          distance: result.distance,
          travel_time: result.duration,
          success: true
        }
      } else {
        return {
          hospital_id: route.hospital_id,
          hospital_name: route.hospital_name,
          kam_id: route.kam_id,
          kam_name: route.kam_name,
          success: false,
          error: 'No se pudo calcular la ruta'
        }
      }
    })

    const batchResults = await Promise.all(batchPromises)
    results.push(...batchResults)
    
    // Actualizar progreso
    if (onProgress) {
      onProgress(Math.min(i + batchSize, routes.length), routes.length)
    }
    
    // Esperar antes del siguiente lote (para respetar rate limits)
    if (i + batchSize < routes.length) {
      await new Promise(resolve => setTimeout(resolve, delayBetweenBatches))
    }
  }
  
  return results
}

export async function POST(request: NextRequest) {
  try {
    // Verificar autenticación
    const headersList = headers()
    const authHeader = headersList.get('authorization')
    
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const token = authHeader.split(' ')[1]
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
    }

    // Verificar que sea administrador
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (userData?.role !== 'admin') {
      return NextResponse.json({ error: 'Acceso denegado - Solo administradores' }, { status: 403 })
    }

    const { routes, saveToDatabase } = await request.json()

    if (!routes || !Array.isArray(routes) || routes.length === 0) {
      return NextResponse.json({ error: 'No se proporcionaron rutas' }, { status: 400 })
    }

    console.log(`Calculando ${routes.length} rutas con Google Distance Matrix...`)
    const startTime = Date.now()

    // Calcular rutas
    const results = await calculateRouteBatch(routes)
    
    // Filtrar resultados exitosos
    const successfulResults = results.filter(r => r.success)
    const failedResults = results.filter(r => !r.success)
    
    console.log(`Rutas calculadas: ${successfulResults.length} exitosas, ${failedResults.length} fallidas`)

    // Guardar en base de datos si se solicita
    let savedCount = 0
    if (saveToDatabase && successfulResults.length > 0) {
      // Preparar datos para inserción
      const dataToInsert = successfulResults.map(result => ({
        hospital_id: result.hospital_id,
        kam_id: result.kam_id,
        distance_km: result.distance,
        travel_time_seconds: Math.round(result.travel_time * 60), // Convertir a segundos
        source: 'google_maps',
        calculated_at: new Date().toISOString()
      }))

      // Insertar en lotes de 100
      const insertBatchSize = 100
      for (let i = 0; i < dataToInsert.length; i += insertBatchSize) {
        const batch = dataToInsert.slice(i, Math.min(i + insertBatchSize, dataToInsert.length))
        
        const { error: insertError } = await supabase
          .from('hospital_kam_distances')
          .upsert(batch, {
            onConflict: 'hospital_id,kam_id',
            ignoreDuplicates: false
          })

        if (insertError) {
          console.error('Error insertando batch:', insertError)
        } else {
          savedCount += batch.length
        }
      }
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2)

    return NextResponse.json({
      success: true,
      calculated: successfulResults.length,
      saved: savedCount,
      errors: failedResults.length,
      totalTime,
      details: successfulResults.map(r => ({
        hospital: r.hospital_name,
        kam: r.kam_name,
        distance: r.distance.toFixed(2),
        time: r.travel_time.toFixed(1)
      })),
      failedRoutes: failedResults.map(r => ({
        hospital: r.hospital_name,
        kam: r.kam_name,
        error: r.error
      }))
    })

  } catch (error) {
    console.error('Error calculating routes:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al calcular rutas' },
      { status: 500 }
    )
  }
}