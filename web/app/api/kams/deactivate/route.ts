import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { SimplifiedOpMapAlgorithm } from '@/lib/opmap-algorithm-simplified'

const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseServiceKey
)

export async function POST(request: Request) {
  try {
    const { kamId } = await request.json()
    
    console.log(`🚫 Desactivando KAM ${kamId}...`)
    
    // 1. Obtener info del KAM
    const { data: kam } = await supabase
      .from('kams')
      .select('name')
      .eq('id', kamId)
      .single()
    
    if (!kam) {
      return NextResponse.json({ success: false, error: 'KAM no encontrado' }, { status: 404 })
    }
    
    // 2. Contar hospitales antes de desactivar
    const { count: hospitalsBefore } = await supabase
      .from('assignments')
      .select('*', { count: 'exact', head: true })
      .eq('kam_id', kamId)
    
    console.log(`📊 ${kam.name} tiene ${hospitalsBefore || 0} hospitales asignados`)
    
    // 3. Desactivar el KAM
    const { error: updateError } = await supabase
      .from('kams')
      .update({ active: false })
      .eq('id', kamId)
    
    if (updateError) throw updateError
    
    // 4. Recalcular todas las asignaciones usando el algoritmo simplificado
    console.log('🔄 Recalculando asignaciones sin el KAM desactivado...')
    
    const algorithm = new SimplifiedOpMapAlgorithm()
    await algorithm.loadData()
    const assignments = await algorithm.calculateAssignments()
    await algorithm.saveAssignments(assignments)
    const saved = assignments.length
    
    console.log(`✅ Recálculo completado: ${saved} asignaciones actualizadas`)
    
    return NextResponse.json({
      success: true,
      message: `KAM ${kam.name} desactivado. Los ${hospitalsBefore || 0} hospitales fueron reasignados automáticamente.`,
      stats: {
        totalAssignments: saved,
        hospitalsReassigned: hospitalsBefore || 0
      }
    })
    
  } catch (error) {
    console.error('Error al desactivar KAM:', error)
    return NextResponse.json(
      { success: false, error: 'Error al desactivar KAM' },
      { status: 500 }
    )
  }
}