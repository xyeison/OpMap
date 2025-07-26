import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET() {
  try {
    // 1. Obtener todos los KAMs activos
    const { data: sellers } = await supabase
      .from('sellers')
      .select('*')
      .eq('active', true)

    // 2. Obtener todos los hospitales activos
    const { data: hospitals } = await supabase
      .from('hospitals')
      .select('*')
      .eq('active', true)

    // 3. Obtener el caché actual
    const { data: cacheData } = await supabase
      .from('travel_time_cache')
      .select('*')
      .eq('source', 'google_maps')

    // 4. Calcular rutas necesarias (estimación más realista)
    // No es KAMs × Hospitales porque el algoritmo solo calcula rutas para hospitales cercanos
    // Estimamos que cada hospital será evaluado por ~3-4 KAMs en promedio (los más cercanos)
    const avgKamsPerHospital = 4
    const estimatedTotalRoutes = hospitals!.length * avgKamsPerHospital
    const cachedRoutes = cacheData?.length || 0
    const missingRoutes = Math.max(0, estimatedTotalRoutes - cachedRoutes)
    
    // 5. Estimar tiempo y costo
    const apiCallsNeeded = missingRoutes
    const estimatedTime = Math.ceil(apiCallsNeeded / 10) // 10 llamadas por segundo aprox
    const estimatedCost = (apiCallsNeeded * 0.005).toFixed(2) // $0.005 por llamada

    return NextResponse.json({
      success: true,
      preview: {
        totalKams: sellers?.length || 0,
        totalHospitals: hospitals?.length || 0,
        totalRoutesNeeded: estimatedTotalRoutes,
        routesInCache: cachedRoutes,
        missingRoutes: missingRoutes,
        googleMapsApiCalls: apiCallsNeeded,
        estimatedTimeSeconds: estimatedTime,
        estimatedCostUSD: estimatedCost,
        cacheInfo: {
          percentage: ((cachedRoutes / estimatedTotalRoutes) * 100).toFixed(1),
          lastUpdate: cacheData?.[0]?.created_at || 'N/A'
        }
      }
    })
  } catch (error: any) {
    console.error('Error in preview:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 })
  }
}