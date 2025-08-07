import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    
    // Coordenadas del hospital en Armenia con más rutas
    const hospitalLat = 4.54522231
    const hospitalLng = -75.66075423
    
    // Obtener todas las rutas hacia este hospital con fechas
    const { data: routes, error } = await supabase
      .from('travel_time_cache')
      .select('origin_lat, origin_lng, travel_time, calculated_at, source')
      .eq('dest_lat', hospitalLat)
      .eq('dest_lng', hospitalLng)
      .order('calculated_at', { ascending: true })
    
    if (error) throw error
    
    // Obtener información de KAMs
    const { data: kams } = await supabase
      .from('kams')
      .select('id, name, area_id, lat, lng')
    
    // Mapear rutas a KAMs con fechas
    const routesWithKams = routes?.map(route => {
      const kam = kams?.find(k => 
        Math.abs(k.lat - route.origin_lat) < 0.0001 && 
        Math.abs(k.lng - route.origin_lng) < 0.0001
      )
      
      const kamDept = kam?.area_id?.substring(0, 2)
      const kamName = kam?.name || 'Unknown'
      
      // Determinar si debería tener ruta según reglas actuales
      const quindioAdjacent = ['66', '73', '76'] // Risaralda, Tolima, Valle
      const level2Depts = ['05', '25', '41', '11'] // Antioquia, Cundinamarca, Huila, Bogotá
      const shouldHaveRoute = quindioAdjacent.includes(kamDept!) || level2Depts.includes(kamDept!)
      
      return {
        kam: kamName,
        kam_dept: kamDept,
        travel_time_min: Math.round(route.travel_time / 60),
        calculated_at: route.calculated_at,
        date: new Date(route.calculated_at).toLocaleDateString(),
        time: new Date(route.calculated_at).toLocaleTimeString(),
        source: route.source,
        should_exist: shouldHaveRoute,
        violation: !shouldHaveRoute ? '❌ NO DEBERÍA EXISTIR' : '✅ OK'
      }
    })
    
    // Agrupar por fecha
    const byDate: Record<string, any[]> = {}
    routesWithKams?.forEach(route => {
      const date = route.date
      if (!byDate[date]) {
        byDate[date] = []
      }
      byDate[date].push(route)
    })
    
    // Contar violaciones
    const violations = routesWithKams?.filter(r => !r.should_exist) || []
    const validRoutes = routesWithKams?.filter(r => r.should_exist) || []
    
    // Encontrar primera y última fecha
    const dates = Object.keys(byDate).sort()
    
    return NextResponse.json({
      hospital: {
        name: "Oncólogos del Occidente - Armenia",
        coordinates: `${hospitalLat}, ${hospitalLng}`,
        department: "Quindío (63)"
      },
      summary: {
        totalRoutes: routes?.length || 0,
        validRoutes: validRoutes.length,
        violations: violations.length,
        firstCalculation: dates[0],
        lastCalculation: dates[dates.length - 1],
        dateRange: `${dates[0]} to ${dates[dates.length - 1]}`
      },
      routesByDate: byDate,
      violations: violations.map(v => ({
        kam: v.kam,
        dept: v.kam_dept,
        calculated: `${v.date} ${v.time}`,
        travel_time: `${v.travel_time_min} min`
      })),
      allRoutes: routesWithKams?.sort((a, b) => 
        new Date(a.calculated_at).getTime() - new Date(b.calculated_at).getTime()
      )
    })
    
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ 
      error: 'Error analyzing cache dates',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}