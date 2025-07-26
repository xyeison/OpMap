import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { OpMapAlgorithm } from '@/lib/opmap-algorithm'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(request: Request) {
  try {
    const { kamId } = await request.json()
    
    console.log(`✅ Activando KAM ${kamId}...`)
    
    // 1. Obtener info del KAM
    const { data: kam } = await supabase
      .from('kams')
      .select('*')
      .eq('id', kamId)
      .single()
    
    if (!kam) {
      return NextResponse.json({ success: false, error: 'KAM no encontrado' }, { status: 404 })
    }
    
    console.log(`📍 Activando KAM ${kam.name} en ${kam.area_id}`)
    
    // 2. Activar el KAM
    const { error: updateError } = await supabase
      .from('kams')
      .update({ active: true })
      .eq('id', kamId)
    
    if (updateError) throw updateError
    
    // 3. Recalcular todas las asignaciones (igual que el algoritmo inicial)
    console.log('🔄 Recalculando asignaciones con el KAM activado...')
    
    const algorithm = new OpMapAlgorithm()
    await algorithm.initialize()
    const assignments = await algorithm.calculateAssignments()
    const saved = await algorithm.saveAssignments(assignments)
    
    console.log(`✅ Recálculo completado: ${saved} asignaciones actualizadas`)
    
    // 4. Obtener estadísticas del KAM recién activado
    const { data: kamAssignments } = await supabase
      .from('assignments')
      .select('hospital_id')
      .eq('kam_id', kamId)
    
    return NextResponse.json({
      success: true,
      message: `KAM ${kam.name} activado exitosamente`,
      stats: {
        totalAssignments: saved,
        kamAssignments: kamAssignments?.length || 0
      }
    })
    
  } catch (error) {
    console.error('Error al activar KAM:', error)
    return NextResponse.json(
      { success: false, error: 'Error al activar KAM' },
      { status: 500 }
    )
  }
}