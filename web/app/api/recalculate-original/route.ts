import { NextResponse } from 'next/server'
import { OpMapAlgorithmBogotaFixed } from '@/lib/opmap-algorithm-bogota-fixed'

// Forzar esta ruta como dinámica
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST() {
  try {
    console.log('🚀 RECÁLCULO CON ALGORITMO ORIGINAL')
    console.log('   Usando SOLO los tiempos existentes en caché')
    
    // Simplemente ejecutar el algoritmo original que YA funciona
    const algorithm = new OpMapAlgorithmBogotaFixed()
    await algorithm.initialize()
    
    const assignments = await algorithm.calculateAssignments()
    await algorithm.saveAssignments(assignments)
    
    // Obtener estadísticas
    const stats = algorithm.getStats()
    
    console.log('\n📊 ESTADÍSTICAS:')
    console.log(`   Total asignaciones: ${assignments.length}`)
    console.log(`   Cache hits: ${stats.cacheHits}`)
    console.log(`   Cache misses: ${stats.cacheMisses}`)
    console.log(`   Hospitales sin tiempo de viaje: ${stats.hospitalsWithoutTravelTime}`)
    
    return NextResponse.json({
      success: true,
      message: 'Recálculo completado con algoritmo original',
      summary: {
        totalAssignments: assignments.length,
        cacheHits: stats.cacheHits,
        cacheMisses: stats.cacheMisses,
        hospitalsWithoutTravelTime: stats.hospitalsWithoutTravelTime
      }
    })
    
  } catch (error) {
    console.error('Error en recálculo:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Error desconocido' 
      },
      { status: 500 }
    )
  }
}