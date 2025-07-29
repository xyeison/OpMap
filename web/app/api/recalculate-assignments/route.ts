import { NextResponse } from 'next/server'
import { OpMapAlgorithmBogotaFixed } from '@/lib/opmap-algorithm-bogota-fixed'

export async function POST() {
  try {
    // Inicializar algoritmo con Bogotá corregido
    const algorithm = new OpMapAlgorithmBogotaFixed()
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