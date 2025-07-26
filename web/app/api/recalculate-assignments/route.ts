import { NextResponse } from 'next/server'
import { OpMapAlgorithmOptimized } from '@/lib/opmap-algorithm-optimized'

export async function POST() {
  try {
    // Inicializar algoritmo optimizado
    const algorithm = new OpMapAlgorithmOptimized()
    await algorithm.initialize()
    
    // Calcular asignaciones
    const assignments = await algorithm.calculateAssignments()
    
    // Guardar en base de datos
    const saved = await algorithm.saveAssignments(assignments)
    
    return NextResponse.json({
      success: true,
      message: `Se recalcularon y guardaron ${saved} asignaciones`,
      assignments: saved
    })
  } catch (error) {
    console.error('Error recalculating assignments:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Error desconocido' 
      },
      { status: 500 }
    )
  }
}