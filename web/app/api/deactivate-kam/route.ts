import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const { kamId } = await request.json()
    
    if (!kamId) {
      return NextResponse.json(
        { success: false, error: 'KAM ID es requerido' },
        { status: 400 }
      )
    }

    // 1. Desactivar el KAM
    const { error: kamError } = await supabase
      .from('kams')
      .update({ active: false })
      .eq('id', kamId)

    if (kamError) {
      throw new Error(`Error desactivando KAM: ${kamError.message}`)
    }

    // 2. Eliminar sus asignaciones
    const { error: deleteError } = await supabase
      .from('assignments')
      .delete()
      .eq('kam_id', kamId)

    if (deleteError) {
      throw new Error(`Error eliminando asignaciones: ${deleteError.message}`)
    }

    // 3. Recalcular asignaciones automáticamente
    const recalcResponse = await fetch(new URL('/api/recalculate-assignments', request.url), {
      method: 'POST'
    })
    
    const recalcResult = await recalcResponse.json()
    
    if (!recalcResult.success) {
      throw new Error('Error recalculando asignaciones')
    }

    return NextResponse.json({
      success: true,
      message: `KAM desactivado y ${recalcResult.assignments} asignaciones recalculadas`
    })
  } catch (error) {
    console.error('Error deactivating KAM:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Error desconocido' 
      },
      { status: 500 }
    )
  }
}