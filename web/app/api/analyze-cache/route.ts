import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    
    // Consulta SQL para contar registros por destino (hospital)
    const { data: hospitalCounts, error: error1 } = await supabase
      .rpc('analyze_cache_by_destination')
    
    // Si no existe la función, hacerlo manualmente
    if (error1) {
      console.log('Analizando manualmente...')
      
      // Obtener todos los registros del caché
      const { data: cacheData, error: error2 } = await supabase
        .from('travel_time_cache')
        .select('dest_lat, dest_lng, origin_lat, origin_lng')
      
      if (error2) throw error2
      
      // Contar por destino (hospital)
      const destCounts: Record<string, number> = {}
      const originCounts: Record<string, number> = {}
      
      cacheData?.forEach(record => {
        const destKey = `${record.dest_lat},${record.dest_lng}`
        const originKey = `${record.origin_lat},${record.origin_lng}`
        
        destCounts[destKey] = (destCounts[destKey] || 0) + 1
        originCounts[originKey] = (originCounts[originKey] || 0) + 1
      })
      
      // Encontrar el máximo
      const maxDest = Object.entries(destCounts).reduce((max, [key, count]) => 
        count > max.count ? { coords: key, count } : max,
        { coords: '', count: 0 }
      )
      
      const maxOrigin = Object.entries(originCounts).reduce((max, [key, count]) => 
        count > max.count ? { coords: key, count } : max,
        { coords: '', count: 0 }
      )
      
      // Obtener información del hospital con más rutas
      const [lat, lng] = maxDest.coords.split(',')
      const { data: hospital } = await supabase
        .from('hospitals')
        .select('name, municipality_name, department_name, department_id')
        .eq('lat', parseFloat(lat))
        .eq('lng', parseFloat(lng))
        .single()
      
      // Obtener todos los KAMs
      const { data: kams } = await supabase
        .from('kams')
        .select('id, name, area_id, lat, lng')
      
      // Ver cuáles KAMs tienen rutas a este hospital
      const { data: routesToHospital } = await supabase
        .from('travel_time_cache')
        .select('origin_lat, origin_lng, travel_time')
        .eq('dest_lat', parseFloat(lat))
        .eq('dest_lng', parseFloat(lng))
      
      // Mapear a KAMs
      const kamsWithRoutes = routesToHospital?.map(route => {
        const kam = kams?.find(k => 
          Math.abs(k.lat - route.origin_lat) < 0.0001 && 
          Math.abs(k.lng - route.origin_lng) < 0.0001
        )
        return {
          kam: kam?.name || 'Unknown',
          kam_dept: kam?.area_id?.substring(0, 2),
          travel_time: Math.round(route.travel_time / 60) + ' min'
        }
      })
      
      // Estadísticas generales
      const { count: totalCache } = await supabase
        .from('travel_time_cache')
        .select('*', { count: 'exact', head: true })
      
      const { count: totalHospitals } = await supabase
        .from('hospitals')
        .select('*', { count: 'exact', head: true })
        .eq('active', true)
      
      const { count: totalKams } = await supabase
        .from('kams')
        .select('*', { count: 'exact', head: true })
        .eq('active', true)
      
      // Calcular promedio teórico
      const avgPerHospital = totalCache! / totalHospitals!
      const maxTheoreticalPerHospital = totalKams! // Máximo si todos los KAMs calcularan a un hospital
      
      return NextResponse.json({
        summary: {
          totalCacheRecords: totalCache,
          totalHospitals,
          totalKams,
          avgRoutesPerHospital: Math.round(avgPerHospital),
          maxPossiblePerHospital: maxTheoreticalPerHospital
        },
        hospitalWithMostRoutes: {
          hospital: hospital?.name || 'Unknown',
          location: `${hospital?.municipality_name}, ${hospital?.department_name}`,
          department_id: hospital?.department_id,
          routeCount: maxDest.count,
          coordinates: maxDest.coords,
          kamsWithRoutes: kamsWithRoutes?.length,
          kamsDetail: kamsWithRoutes
        },
        kamWithMostRoutes: {
          coordinates: maxOrigin.coords,
          routeCount: maxOrigin.count
        },
        analysis: {
          isNormal: maxDest.count <= maxTheoreticalPerHospital!,
          message: maxDest.count > maxTheoreticalPerHospital! 
            ? `⚠️ ANORMAL: Este hospital tiene ${maxDest.count} rutas pero solo hay ${maxTheoreticalPerHospital} KAMs`
            : `✅ NORMAL: ${maxDest.count} rutas de máximo ${maxTheoreticalPerHospital} KAMs posibles`
        }
      })
    }
    
    return NextResponse.json({ 
      error: 'Análisis con función RPC', 
      details: hospitalCounts 
    })
    
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ 
      error: 'Error analizando caché',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}