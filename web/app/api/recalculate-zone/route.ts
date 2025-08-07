import { NextResponse } from 'next/server'
import { OpMapAlgorithmBogotaFixed } from '@/lib/opmap-algorithm-bogota-fixed'
import { supabase } from '@/lib/supabase'

// Forzar esta ruta como dinámica
export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 60 // Máximo 60 segundos

export async function POST(request: Request) {
  try {
    const { kamId, action } = await request.json()
    
    if (!kamId || !action) {
      return NextResponse.json(
        { success: false, error: 'KAM ID y acción son requeridos' },
        { status: 400 }
      )
    }

    console.log(`🔄 RECÁLCULO DE ZONA - KAM: ${kamId}, Acción: ${action}`)
    
    // Obtener información del KAM
    const { data: kam, error: kamError } = await supabase
      .from('kams')
      .select('*')
      .eq('id', kamId)
      .single()
    
    if (kamError || !kam) {
      return NextResponse.json(
        { success: false, error: 'KAM no encontrado' },
        { status: 404 }
      )
    }

    const startTime = Date.now()
    
    if (action === 'deactivate') {
      // DESACTIVACIÓN: Ejecutar algoritmo completo sin el KAM desactivado
      console.log(`🚫 Desactivando KAM ${kam.name} y recalculando todo el sistema...`)
      
      // Primero obtenemos cuántos hospitales tenía asignados para el reporte
      const { data: previousAssignments } = await supabase
        .from('assignments')
        .select('hospital_id')
        .eq('kam_id', kamId)
      
      const previousCount = previousAssignments?.length || 0
      console.log(`   El KAM tenía ${previousCount} hospitales asignados`)
      
      // Ejecutar el algoritmo completo (excluirá automáticamente al KAM inactivo)
      const googleApiKey = process.env.GOOGLE_MAPS_API_KEY
      const algorithm = new OpMapAlgorithmBogotaFixed()
      await algorithm.initialize(googleApiKey)
      
      const assignments = await algorithm.calculateAssignments()
      await algorithm.saveAssignments(assignments)
      
      const elapsed = Date.now() - startTime
      console.log(`✅ Recálculo completo completado en ${elapsed}ms`)
      
      return NextResponse.json({
        success: true,
        message: `${kam.name} desactivado. Sistema recalculado completamente. ${previousCount} hospitales reasignados.`,
        summary: {
          kamDeactivated: kam.name,
          previousHospitals: previousCount,
          totalAssignments: assignments.length,
          timeElapsed: elapsed
        }
      })
    }
    
    if (action === 'activate') {
      // ACTIVACIÓN: Recalcular para incluir el nuevo KAM
      console.log(`✅ Activando KAM ${kam.name} y recalculando asignaciones...`)
      
      // Para activación, hacer un recálculo completo
      // porque el nuevo KAM puede "ganar" hospitales de otros KAMs
      const googleApiKey = process.env.GOOGLE_MAPS_API_KEY
      const algorithm = new OpMapAlgorithmBogotaFixed()
      await algorithm.initialize(googleApiKey)
      
      const assignments = await algorithm.calculateAssignments()
      await algorithm.saveAssignments(assignments)
      
      // Contar cuántos hospitales ganó el KAM activado
      const kamAssignments = assignments.filter(a => a.kam_id === kamId)
      
      const elapsed = Date.now() - startTime
      console.log(`✅ Activación completada en ${elapsed}ms`)
      
      return NextResponse.json({
        success: true,
        message: `${kam.name} activado. ${kamAssignments.length} hospitales asignados.`,
        summary: {
          kamActivated: kam.name,
          hospitalsAssigned: kamAssignments.length,
          totalAssignments: assignments.length,
          timeElapsed: elapsed
        }
      })
    }
    
    return NextResponse.json(
      { success: false, error: 'Acción no válida' },
      { status: 400 }
    )
    
  } catch (error) {
    console.error('Error en recálculo de zona:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Error desconocido' 
      },
      { status: 500 }
    )
  }
}