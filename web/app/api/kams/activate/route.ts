import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { OpMapAlgorithmOptimized } from '@/lib/opmap-algorithm-optimized'

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
    
    // 2.5 Verificar que el KAM fue activado correctamente
    const { data: verifyKam } = await supabase
      .from('kams')
      .select('active')
      .eq('id', kamId)
      .single()
    
    if (!verifyKam?.active) {
      throw new Error('El KAM no se activó correctamente')
    }
    
    console.log('✅ KAM activado correctamente en la BD')
    
    // 3. Recalcular todas las asignaciones (igual que el algoritmo inicial)
    console.log('🔄 Recalculando asignaciones con el KAM activado...')
    
    const algorithm = new OpMapAlgorithmOptimized()
    await algorithm.initialize()
    const assignments = await algorithm.calculateAssignments()
    const saved = await algorithm.saveAssignments(assignments)
    
    console.log(`✅ Recálculo completado: ${saved} asignaciones actualizadas`)
    
    // 4. Obtener estadísticas del KAM recién activado
    const { data: kamAssignments } = await supabase
      .from('assignments')
      .select('hospital_id')
      .eq('kam_id', kamId)
    
    // 5. Verificar hospitales en el municipio de Cartagena
    const { count: hospitalsInMunicipality } = await supabase
      .from('hospitals')
      .select('*', { count: 'exact', head: true })
      .eq('municipality_id', kam.area_id)
      .eq('active', true)
    
    console.log(`🏥 Hospitales en ${kam.area_id}: ${hospitalsInMunicipality || 0}`)
    console.log(`📊 Asignaciones para ${kam.name}: ${kamAssignments?.length || 0}`)
    
    return NextResponse.json({
      success: true,
      message: `KAM ${kam.name} activado exitosamente`,
      stats: {
        totalAssignments: saved,
        kamAssignments: kamAssignments?.length || 0,
        hospitalsInMunicipality: hospitalsInMunicipality || 0
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