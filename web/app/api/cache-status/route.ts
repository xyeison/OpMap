import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    
    // Solo consultas COUNT rápidas
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
    
    const { count: totalAssignments } = await supabase
      .from('assignments')
      .select('*', { count: 'exact', head: true })
    
    // Cálculos básicos
    const avgRoutesPerKam = Math.round((totalCache || 0) / (totalKams || 1))
    const avgRoutesPerHospital = Math.round((totalCache || 0) / (totalHospitals || 1))
    const maxPossibleRoutes = (totalKams || 0) * (totalHospitals || 0)
    const coveragePercent = Math.round(((totalCache || 0) / maxPossibleRoutes) * 100)
    
    // Determinar estado
    let status = '✅ EXCELENTE'
    let recommendation = 'NO necesitas calcular más rutas'
    
    if (totalCache! < 1000) {
      status = '🚨 CRÍTICO'
      recommendation = 'Necesitas calcular rutas urgentemente'
    } else if (totalCache! < 3000) {
      status = '⚠️ BAJO'
      recommendation = 'Considera calcular más rutas para mejorar precisión'
    } else if (totalCache! < 5000) {
      status = '📊 BUENO'
      recommendation = 'Tienes suficientes rutas para operación básica'
    } else if (totalCache! > 10000) {
      status = '⚠️ EXCESIVO'
      recommendation = 'DETÉN los cálculos - ya tienes demasiadas rutas'
    }
    
    return NextResponse.json({
      cache_status: {
        total_records: totalCache,
        status,
        recommendation
      },
      statistics: {
        total_hospitals: totalHospitals,
        total_kams: totalKams,
        total_assignments: totalAssignments,
        hospitals_without_assignment: (totalHospitals || 0) - (totalAssignments || 0)
      },
      coverage: {
        avg_routes_per_kam: avgRoutesPerKam,
        avg_routes_per_hospital: avgRoutesPerHospital,
        max_possible_routes: maxPossibleRoutes,
        coverage_percent: coveragePercent
      },
      recommendations: [
        totalCache! > 10000 ? '🛑 DETENER CÁLCULOS - Ya tienes suficiente caché' : null,
        totalCache! > 5000 ? '✅ Caché suficiente para asignaciones precisas' : null,
        totalCache! < 3000 ? '⚠️ Necesitas más rutas para mejor precisión' : null,
        avgRoutesPerKam < 100 ? '⚠️ Algunos KAMs pueden tener pocas rutas' : null,
        totalAssignments! < totalHospitals! * 0.9 ? '📍 Hay hospitales sin asignar' : null
      ].filter(Boolean)
    })
    
  } catch (error) {
    return NextResponse.json({ 
      error: 'Error checking cache status',
      details: error instanceof Error ? error.message : 'Unknown'
    }, { status: 500 })
  }
}