import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    
    // 1. Contar hospitales totales
    const { count: totalHospitals, error: hospError } = await supabase
      .from('hospitals')
      .select('*', { count: 'exact', head: true })
      .eq('active', true)
    
    // 2. Contar asignaciones actuales
    const { count: totalAssignments, error: assignError } = await supabase
      .from('assignments')
      .select('*', { count: 'exact', head: true })
    
    // 3. Obtener hospitales sin asignar
    const { data: unassignedHospitals, error: unassignedError } = await supabase
      .from('hospitals')
      .select(`
        id,
        name,
        municipality_name,
        department_name,
        department_id
      `)
      .eq('active', true)
      .is('assignments', null)
    
    // 4. Contar asignaciones por KAM
    const { data: assignmentsByKam, error: kamError } = await supabase
      .from('assignments')
      .select('kam_id, kams!inner(name)')
      .order('kam_id')
    
    // Agrupar por KAM
    const kamCounts: Record<string, number> = {}
    if (assignmentsByKam) {
      assignmentsByKam.forEach((assignment: any) => {
        const kamName = assignment.kams?.name || 'Unknown'
        kamCounts[kamName] = (kamCounts[kamName] || 0) + 1
      })
    }
    
    // 5. Verificar caché de tiempos
    const { count: cacheCount, error: cacheError } = await supabase
      .from('travel_time_cache')
      .select('*', { count: 'exact', head: true })
    
    // 6. Obtener departamentos excluidos
    const excludedDepts = [27, 97, 99, 88, 95, 94, 91]
    
    // 7. Contar hospitales en departamentos excluidos
    const { count: excludedHospitals, error: excludedError } = await supabase
      .from('hospitals')
      .select('*', { count: 'exact', head: true })
      .eq('active', true)
      .in('department_id', excludedDepts.map(d => d.toString()))
    
    return NextResponse.json({
      summary: {
        totalHospitals: totalHospitals || 0,
        totalAssignments: totalAssignments || 0,
        unassignedCount: (totalHospitals || 0) - (totalAssignments || 0),
        cacheCount: cacheCount || 0,
        excludedHospitals: excludedHospitals || 0,
        activeHospitalsToAssign: (totalHospitals || 0) - (excludedHospitals || 0)
      },
      assignmentsByKam: kamCounts,
      unassignedSample: unassignedHospitals?.slice(0, 10) || [],
      errors: {
        hospitals: hospError?.message,
        assignments: assignError?.message,
        unassigned: unassignedError?.message,
        kam: kamError?.message,
        cache: cacheError?.message,
        excluded: excludedError?.message
      }
    })
  } catch (error) {
    console.error('Error en debug:', error)
    return NextResponse.json(
      { error: 'Error al obtener diagnóstico' },
      { status: 500 }
    )
  }
}