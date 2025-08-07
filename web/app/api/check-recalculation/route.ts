import { NextResponse } from 'next/server'
import { OpMapAlgorithmBogotaFixed } from '@/lib/opmap-algorithm-bogota-fixed'
import { supabase } from '@/lib/supabase'

// Endpoint para verificar y procesar recálculos pendientes
// Puede ser llamado por un cron job o manualmente

export async function GET() {
  try {
    // Obtener recálculos pendientes
    const { data: pending, error } = await supabase
      .rpc('get_pending_recalculations')
    
    if (error) {
      return NextResponse.json({ 
        success: false, 
        error: 'Error obteniendo recálculos pendientes' 
      }, { status: 500 })
    }
    
    if (!pending || pending.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No hay recálculos pendientes' 
      })
    }
    
    console.log(`📋 ${pending.length} recálculos pendientes encontrados`)
    
    // Ejecutar recálculo
    const startTime = Date.now()
    console.log('🔄 Ejecutando recálculo automático...')
    
    const googleApiKey = process.env.GOOGLE_MAPS_API_KEY
    const algorithm = new OpMapAlgorithmBogotaFixed()
    await algorithm.initialize(googleApiKey)
    
    const assignments = await algorithm.calculateAssignments()
    await algorithm.saveAssignments(assignments)
    
    // Marcar recálculos como procesados
    const pendingIds = pending.map((p: any) => p.id)
    await supabase.rpc('mark_recalculations_processed', { 
      recalc_ids: pendingIds 
    })
    
    const elapsed = Date.now() - startTime
    
    // Construir resumen de razones
    const reasons = pending.map((p: any) => p.reason).join('; ')
    
    console.log(`✅ Recálculo completado en ${elapsed}ms`)
    
    return NextResponse.json({
      success: true,
      message: `Recálculo ejecutado por: ${reasons}`,
      summary: {
        pendingProcessed: pending.length,
        totalAssignments: assignments.length,
        reasons: pending.map((p: any) => ({
          reason: p.reason,
          triggeredBy: p.triggered_by,
          triggeredAt: p.triggered_at
        })),
        timeElapsed: elapsed
      }
    })
    
  } catch (error) {
    console.error('Error en verificación de recálculo:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Error desconocido' 
      },
      { status: 500 }
    )
  }
}

// POST para forzar verificación y ejecución inmediata
export async function POST() {
  return GET()
}