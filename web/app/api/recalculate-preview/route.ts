import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
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

    // 4. Calcular rutas necesarias
    const totalRoutes = sellers!.length * hospitals!.length
    const cachedRoutes = cacheData?.length || 0
    const missingRoutes = Math.max(0, totalRoutes - cachedRoutes)
    
    // 5. Estimar tiempo y costo
    const apiCallsNeeded = missingRoutes
    const estimatedTime = Math.ceil(apiCallsNeeded / 10) // 10 llamadas por segundo aprox
    const estimatedCost = (apiCallsNeeded * 0.005).toFixed(2) // $0.005 por llamada

    return NextResponse.json({
      success: true,
      preview: {
        totalKams: sellers?.length || 0,
        totalHospitals: hospitals?.length || 0,
        totalRoutesNeeded: totalRoutes,
        routesInCache: cachedRoutes,
        missingRoutes: missingRoutes,
        googleMapsApiCalls: apiCallsNeeded,
        estimatedTimeSeconds: estimatedTime,
        estimatedCostUSD: estimatedCost,
        cacheInfo: {
          percentage: ((cachedRoutes / totalRoutes) * 100).toFixed(1),
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