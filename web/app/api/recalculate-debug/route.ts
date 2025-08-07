import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { OpMapAlgorithmBogotaFixed } from '@/lib/opmap-algorithm-bogota-fixed'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutos

export async function POST() {
  try {
    console.log('🔍 INICIANDO RECÁLCULO CON DEBUG COMPLETO')
    
    const supabase = createRouteHandlerClient({ cookies })
    
    // 1. Limpiar asignaciones anteriores
    console.log('🗑️ Limpiando asignaciones anteriores...')
    const { error: deleteError } = await supabase
      .from('assignments')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // Truquito para borrar todo
    
    if (deleteError) {
      console.error('Error limpiando asignaciones:', deleteError)
    }
    
    // 2. Obtener estadísticas antes
    const { count: hospitalsBefore } = await supabase
      .from('hospitals')
      .select('*', { count: 'exact', head: true })
      .eq('active', true)
    
    // 3. Ejecutar algoritmo
    const googleApiKey = process.env.GOOGLE_MAPS_API_KEY
    const algorithm = new OpMapAlgorithmBogotaFixed()
    
    console.log('📊 Inicializando algoritmo...')
    await algorithm.initialize(googleApiKey)
    
    console.log('🔄 Calculando asignaciones...')
    const assignments = await algorithm.calculateAssignments()
    
    console.log(`✅ ${assignments.length} asignaciones calculadas`)
    
    // 4. Guardar asignaciones
    console.log('💾 Guardando asignaciones en base de datos...')
    await algorithm.saveAssignments(assignments)
    
    // 5. Obtener estadísticas después
    const { count: assignmentsAfter } = await supabase
      .from('assignments')
      .select('*', { count: 'exact', head: true })
    
    // 6. Obtener hospitales sin asignar para debug
    const { data: unassignedHospitals } = await supabase
      .from('hospitals')
      .select('id, name, municipality_name, department_name, department_id')
      .eq('active', true)
      .not('id', 'in', `(${assignments.map(a => `'${a.hospital_id}'`).join(',')})`)
      .limit(20)
    
    const stats = algorithm.getStats()
    
    return NextResponse.json({
      success: true,
      summary: {
        hospitalsTotal: hospitalsBefore,
        assignmentsCalculated: assignments.length,
        assignmentsSaved: assignmentsAfter,
        unassignedCount: (hospitalsBefore || 0) - assignments.length,
        cacheHits: stats.cacheHits,
        cacheMisses: stats.cacheMisses,
        googleCalls: stats.googleCalculations
      },
      unassignedSample: unassignedHospitals || [],
      message: `Recálculo completado: ${assignments.length} de ${hospitalsBefore} hospitales asignados`
    })
    
  } catch (error) {
    console.error('❌ Error en recálculo debug:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Error desconocido',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}