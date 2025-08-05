import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { OpMapAlgorithmBogotaFixed } from '@/lib/opmap-algorithm-bogota-fixed'

// Forzar esta ruta como dinámica
export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 300 // 5 minutos

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST() {
  try {
    console.log('🚀 RECÁLCULO SIMPLIFICADO - Solo ejecutar algoritmo')
    
    // 1. Simplemente ejecutar el algoritmo con los datos existentes
    console.log('\n🤖 Ejecutando algoritmo de asignación...')
    const algorithm = new OpMapAlgorithmBogotaFixed()
    await algorithm.initialize()
    
    const assignments = await algorithm.calculateAssignments()
    await algorithm.saveAssignments(assignments)
    
    // 2. Obtener estadísticas
    const [hospitalsResult, assignmentsResult] = await Promise.all([
      supabase.from('hospitals').select('*', { count: 'exact', head: true }).eq('active', true),
      supabase.from('assignments').select('*', { count: 'exact', head: true })
    ])
    
    const totalHospitals = hospitalsResult.count || 0
    const assignedHospitals = assignmentsResult.count || 0
    const unassignedHospitals = totalHospitals - assignedHospitals
    
    console.log('\n📊 RESUMEN:')
    console.log(`   Total hospitales: ${totalHospitals}`)
    console.log(`   Hospitales asignados: ${assignedHospitals}`)
    console.log(`   Hospitales sin asignar: ${unassignedHospitals}`)
    
    return NextResponse.json({
      success: true,
      message: 'Recálculo completado',
      summary: {
        totalHospitals,
        assignedHospitals,
        unassignedHospitals
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