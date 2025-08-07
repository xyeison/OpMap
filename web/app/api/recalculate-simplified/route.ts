import { NextResponse } from 'next/server'
import { SimplifiedOpMapAlgorithm } from '@/lib/opmap-algorithm-simplified'

export async function POST() {
  try {
    // Inicializar algoritmo simplificado
    const algorithm = new SimplifiedOpMapAlgorithm()
    await algorithm.loadData()
    
    // Calcular asignaciones
    const assignments = await algorithm.calculateAssignments()
    
    // Guardar en base de datos
    await algorithm.saveAssignments(assignments)
    
    return NextResponse.json({
      success: true,
      message: `Se recalcularon y guardaron ${assignments.length} asignaciones`,
      assignments: assignments.length
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