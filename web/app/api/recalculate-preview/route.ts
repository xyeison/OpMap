import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET() {
  try {
    // 1. Obtener todos los KAMs activos
    const { data: sellers, error: sellersError } = await supabase
      .from('kams')
      .select('*')
      .eq('active', true)
    
    if (sellersError) {
      console.error('Error loading KAMs:', sellersError)
    }

    // 2. Obtener todos los hospitales activos
    const { data: hospitals } = await supabase
      .from('hospitals')
      .select('*')
      .eq('active', true)

    // 3. Obtener el conteo real del caché (no todos los registros)
    const { count: totalCacheCount } = await supabase
      .from('travel_time_cache')
      .select('*', { count: 'exact', head: true })
    
    // También obtener info del caché más reciente para mostrar última actualización
    const { data: latestCache } = await supabase
      .from('travel_time_cache')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1)

    // 4. Calcular rutas necesarias (estimación más realista)
    // Si no hay KAMs activos, no hay rutas que calcular
    if (!sellers || sellers.length === 0) {
      return NextResponse.json({
        success: true,
        preview: {
          totalKams: 0,
          totalHospitals: hospitals?.length || 0,
          totalRoutesNeeded: 0,
          routesInCache: totalCacheCount || 0,
          missingRoutes: 0,
          googleMapsApiCalls: 0,
          estimatedTimeSeconds: 0,
          estimatedCostUSD: "0.00",
          cacheInfo: {
            percentage: "0",
            lastUpdate: latestCache?.[0]?.created_at || 'N/A'
          },
          warning: "No hay KAMs activos. Active al menos un KAM antes de recalcular."
        }
      })
    }
    
    // Estimación realista: cada hospital será evaluado por KAMs cercanos
    // En promedio, un hospital es evaluado por 3-4 KAMs (los del mismo y departamentos adyacentes)
    const avgKamsPerHospital = Math.min(sellers.length, 4)
    const estimatedTotalRoutes = hospitals!.length * avgKamsPerHospital
    const cachedRoutes = totalCacheCount || 0
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
          lastUpdate: latestCache?.[0]?.created_at || 'N/A'
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