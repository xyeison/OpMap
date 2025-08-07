import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET() {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    
    console.log('🔍 Iniciando análisis de cobertura del caché...')
    
    // 1. Obtener estadísticas básicas
    const { count: totalCache } = await supabase
      .from('travel_time_cache')
      .select('*', { count: 'exact', head: true })
    
    const { count: totalHospitals } = await supabase
      .from('hospitals')
      .select('*', { count: 'exact', head: true })
      .eq('active', true)
    
    const { data: kams } = await supabase
      .from('kams')
      .select('id, name, area_id, lat, lng')
      .eq('active', true)
    
    // 2. Analizar cobertura por KAM
    const kamCoverage: any[] = []
    
    for (const kam of kams || []) {
      // Contar rutas desde este KAM
      const { count: routesFromKam } = await supabase
        .from('travel_time_cache')
        .select('*', { count: 'exact', head: true })
        .gte('origin_lat', kam.lat - 0.001)
        .lte('origin_lat', kam.lat + 0.001)
        .gte('origin_lng', kam.lng - 0.001)
        .lte('origin_lng', kam.lng + 0.001)
      
      const kamDept = kam.area_id.substring(0, 2)
      
      // Contar hospitales en territorio base
      const { count: baseHospitals } = await supabase
        .from('hospitals')
        .select('*', { count: 'exact', head: true })
        .eq('active', true)
        .eq('municipality_id', kam.area_id)
      
      // Contar hospitales en su departamento
      const { count: deptHospitals } = await supabase
        .from('hospitals')
        .select('*', { count: 'exact', head: true })
        .eq('active', true)
        .eq('department_id', kamDept)
      
      kamCoverage.push({
        name: kam.name,
        area_id: kam.area_id,
        department: kamDept,
        routes_calculated: routesFromKam || 0,
        base_hospitals: baseHospitals || 0,
        dept_hospitals: deptHospitals || 0,
        coverage_percent: deptHospitals ? Math.round(((routesFromKam || 0) / deptHospitals) * 100) : 0
      })
    }
    
    // 3. Identificar rutas críticas (territorio base)
    const criticalMissing: any[] = []
    
    for (const kam of kams || []) {
      // Hospitales en territorio base
      const { data: baseHospitals } = await supabase
        .from('hospitals')
        .select('id, name, lat, lng')
        .eq('active', true)
        .eq('municipality_id', kam.area_id)
        .limit(5)
      
      for (const hospital of baseHospitals || []) {
        // Verificar si existe la ruta
        const { data: existingRoute } = await supabase
          .from('travel_time_cache')
          .select('travel_time')
          .gte('origin_lat', kam.lat - 0.001)
          .lte('origin_lat', kam.lat + 0.001)
          .gte('origin_lng', kam.lng - 0.001)
          .lte('origin_lng', kam.lng + 0.001)
          .gte('dest_lat', hospital.lat - 0.001)
          .lte('dest_lat', hospital.lat + 0.001)
          .gte('dest_lng', hospital.lng - 0.001)
          .lte('dest_lng', hospital.lng + 0.001)
          .single()
        
        if (!existingRoute) {
          criticalMissing.push({
            kam: kam.name,
            hospital: hospital.name,
            type: 'TERRITORIO_BASE',
            priority: 'CRÍTICA'
          })
        }
      }
    }
    
    // 4. Análisis de departamentos
    const { data: deptStats } = await supabase
      .from('hospitals')
      .select('department_id, department_name')
      .eq('active', true)
    
    const deptCounts: Record<string, { name: string, count: number }> = {}
    deptStats?.forEach(h => {
      if (!deptCounts[h.department_id]) {
        deptCounts[h.department_id] = { name: h.department_name, count: 0 }
      }
      deptCounts[h.department_id].count++
    })
    
    // 5. Resumen y recomendaciones
    const avgRoutesPerKam = Math.round((totalCache || 0) / (kams?.length || 1))
    const minRoutesKam = kamCoverage.reduce((min, k) => 
      k.routes_calculated < min.routes_calculated ? k : min
    , kamCoverage[0] || { routes_calculated: 0 })
    
    const maxRoutesKam = kamCoverage.reduce((max, k) => 
      k.routes_calculated > max.routes_calculated ? k : max
    , kamCoverage[0] || { routes_calculated: 0 })
    
    // Determinar si necesita más cálculos
    const needsMoreCalculations = criticalMissing.length > 0 || 
                                  minRoutesKam?.routes_calculated < 20
    
    const recommendations = []
    
    if (criticalMissing.length > 0) {
      recommendations.push(`🚨 CRÍTICO: Faltan ${criticalMissing.length} rutas de territorio base`)
    }
    
    if (minRoutesKam?.routes_calculated < 20) {
      recommendations.push(`⚠️ KAM ${minRoutesKam.name} solo tiene ${minRoutesKam.routes_calculated} rutas`)
    }
    
    if (totalCache && totalCache > 10000) {
      recommendations.push('✅ Caché suficiente para operación normal')
    }
    
    if (!needsMoreCalculations) {
      recommendations.push('✅ NO se necesitan más cálculos por ahora')
    }
    
    return NextResponse.json({
      summary: {
        total_cache_records: totalCache,
        total_hospitals: totalHospitals,
        total_kams: kams?.length,
        avg_routes_per_kam: avgRoutesPerKam,
        needs_more_calculations: needsMoreCalculations
      },
      kam_coverage: kamCoverage.sort((a, b) => a.routes_calculated - b.routes_calculated),
      critical_missing: criticalMissing.slice(0, 10),
      recommendations,
      conclusion: needsMoreCalculations 
        ? '🚨 SE NECESITAN CÁLCULOS ADICIONALES'
        : '✅ CACHÉ SUFICIENTE - NO CALCULAR MÁS',
      departments_summary: Object.entries(deptCounts)
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)
    })
    
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ 
      error: 'Error analizando cobertura',
      details: error instanceof Error ? error.message : 'Unknown'
    }, { status: 500 })
  }
}