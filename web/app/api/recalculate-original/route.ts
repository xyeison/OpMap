import { NextResponse } from 'next/server'
import { OpMapAlgorithmBogotaFixed } from '@/lib/opmap-algorithm-bogota-fixed'

// Forzar esta ruta como dinámica
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST() {
  try {
    console.log('🚀 RECÁLCULO CON ALGORITMO ORIGINAL')
    const googleApiKey = process.env.GOOGLE_MAPS_API_KEY
    console.log('   API Key disponible:', !!googleApiKey)
    console.log('   API Key length:', googleApiKey?.length || 0)
    
    // Información de depuración para el frontend
    const debugInfo = {
      apiKeyConfigured: !!googleApiKey,
      apiKeyLength: googleApiKey?.length || 0,
      timestamp: new Date().toISOString()
    }
    
    // Simplemente ejecutar el algoritmo original que YA funciona
    const algorithm = new OpMapAlgorithmBogotaFixed()
    await algorithm.initialize(googleApiKey)
    
    const assignments = await algorithm.calculateAssignments()
    await algorithm.saveAssignments(assignments)
    
    // Obtener estadísticas
    const stats = algorithm.getStats()
    
    console.log('\n📊 ESTADÍSTICAS:')
    console.log(`   Total asignaciones: ${assignments.length}`)
    console.log(`   Cache hits: ${stats.cacheHits}`)
    console.log(`   Cache misses: ${stats.cacheMisses}`)
    console.log(`   Google API calls: ${stats.googleCalculations}`)
    console.log(`   Hospitales sin tiempo de viaje: ${stats.hospitalsWithoutTravelTime}`)
    
    return NextResponse.json({
      success: true,
      message: 'Recálculo completado con algoritmo original',
      summary: {
        totalAssignments: assignments.length,
        cacheHits: stats.cacheHits,
        cacheMisses: stats.cacheMisses,
        googleCalculations: stats.googleCalculations,
        hospitalsWithoutTravelTime: stats.hospitalsWithoutTravelTime
      },
      debug: debugInfo
    })
    
  } catch (error) {
    console.error('Error en recálculo:', error)
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
    const errorStack = error instanceof Error ? error.stack : ''
    
    return NextResponse.json(
      { 
        success: false, 
        error: errorMessage,
        details: errorStack,
        debug: {
          apiKeyConfigured: !!process.env.GOOGLE_MAPS_API_KEY,
          timestamp: new Date().toISOString()
        }
      },
      { status: 500 }
    )
  }
}