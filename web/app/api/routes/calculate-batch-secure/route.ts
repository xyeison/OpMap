import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60 // 60 segundos máximo

// IMPORTANTE: Este endpoint usa autenticación y respeta RLS
// Para usar sin RLS, debe usar service role key

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
      distance: element.distance.value / 1000, // Convertir a kilómetros
      duration: element.duration.value // En segundos
    }
  } catch (error) {
    console.error('Error calling Google Maps API:', error)
    return null
  }
}

// Función para procesar rutas en lotes
async function calculateRouteBatch(
  routes: RouteToCalculate[]
): Promise<any[]> {
  const results = []
  const batchSize = 5 // Procesar de a 5 para ser conservador
  const delayBetweenBatches = 500 // 0.5 segundos entre lotes

  for (let i = 0; i < routes.length; i += batchSize) {
    const batch = routes.slice(i, Math.min(i + batchSize, routes.length))
    
    console.log(`Procesando batch: ${batch.length} rutas`)
    
    // Procesar lote en paralelo
    const batchPromises = batch.map(async (route) => {
      try {
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
      } catch (error) {
        console.error(`Error en ruta ${route.hospital_name} -> ${route.kam_name}:`, error)
        return {
          hospital_id: route.hospital_id,
          hospital_name: route.hospital_name,
          kam_id: route.kam_id,
          kam_name: route.kam_name,
          success: false,
          error: error instanceof Error ? error.message : 'Error desconocido'
        }
      }
    })

    const batchResults = await Promise.all(batchPromises)
    results.push(...batchResults)
    
    // Esperar antes del siguiente lote (para respetar rate limits)
    if (i + batchSize < routes.length) {
      await new Promise(resolve => setTimeout(resolve, delayBetweenBatches))
    }
  }

  return results
}

export async function POST(request: NextRequest) {
  try {
    console.log('calculate-batch-secure: Starting WITH authentication')
    
    // Verificar autenticación
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    
    const { data: { session }, error: authError } = await supabase.auth.getSession()
    
    if (authError || !session) {
      console.error('calculate-batch-secure: Authentication failed:', authError)
      return NextResponse.json(
        { error: 'No autorizado. Por favor inicie sesión.' },
        { status: 401 }
      )
    }
    
    console.log('calculate-batch-secure: Authenticated user:', session.user.email)
    
    // Para operaciones que necesitan bypass de RLS, usar service role
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    })
    
    const { routes, saveToDatabase, batchStart = 0 } = await request.json()

    if (!routes || !Array.isArray(routes) || routes.length === 0) {
      return NextResponse.json({ error: 'No se proporcionaron rutas' }, { status: 400 })
    }

    // Procesar en lotes de 1000 para evitar timeouts
    const BATCH_SIZE = 1000
    const routesToProcess = routes.slice(batchStart, batchStart + BATCH_SIZE)
    const hasMoreBatches = batchStart + BATCH_SIZE < routes.length
    const currentBatch = Math.floor(batchStart / BATCH_SIZE) + 1
    const totalBatches = Math.ceil(routes.length / BATCH_SIZE)

    console.log(`calculate-batch-secure: Procesando batch ${currentBatch}/${totalBatches} (${routesToProcess.length} rutas)`)

    const startTime = Date.now()

    // Calcular rutas del batch actual
    const results = await calculateRouteBatch(routesToProcess)
    
    // Filtrar resultados exitosos
    const successfulResults = results.filter(r => r.success)
    const failedResults = results.filter(r => !r.success)
    
    console.log(`calculate-batch-secure: Rutas calculadas: ${successfulResults.length} exitosas, ${failedResults.length} fallidas`)

    // Guardar en base de datos si se solicita
    let savedCount = 0
    let saveErrors = []
    if (saveToDatabase && successfulResults.length > 0) {
      console.log('calculate-batch-secure: Guardando resultados en base de datos...')
      
      // Preparar datos para insertar
      const dataToInsert = successfulResults.map(result => ({
        hospital_id: result.hospital_id,
        kam_id: result.kam_id,
        travel_time: Math.round(result.travel_time), // En SEGUNDOS
        distance: parseFloat(result.distance.toFixed(2)),
        source: 'google_maps',
        calculated_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }))
      
      // Insertar usando service role para bypass RLS
      const insertBatchSize = 10
      for (let i = 0; i < dataToInsert.length; i += insertBatchSize) {
        const batch = dataToInsert.slice(i, Math.min(i + insertBatchSize, dataToInsert.length))
        
        const { data: insertedData, error: insertError } = await supabaseAdmin
          .from('hospital_kam_distances')
          .upsert(batch, {
            onConflict: 'hospital_id,kam_id',
            ignoreDuplicates: false
          })
          .select('id')

        if (insertError) {
          console.error('calculate-batch-secure: Error guardando batch:', insertError)
          saveErrors.push({
            batch: i/insertBatchSize + 1,
            error: insertError.message
          })
        } else {
          savedCount += batch.length
        }
      }
      
      console.log(`calculate-batch-secure: ${savedCount} rutas guardadas`)
    }

    const totalTime = (Date.now() - startTime) / 1000

    return NextResponse.json({
      success: true,
      authenticated: true,
      user: session.user.email,
      batch: {
        current: currentBatch,
        total: totalBatches,
        start: batchStart,
        size: routesToProcess.length,
        hasMore: hasMoreBatches,
        nextStart: hasMoreBatches ? batchStart + BATCH_SIZE : null
      },
      calculated: successfulResults.length,
      failed: failedResults.length,
      saved: savedCount,
      saveErrors: saveErrors.length > 0 ? saveErrors : undefined,
      totalTime: totalTime.toFixed(2),
      costEstimate: `$${(successfulResults.length * 0.005).toFixed(2)} USD`
    })

  } catch (error) {
    console.error('calculate-batch-secure: Fatal error:', error)
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Error al calcular rutas',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}