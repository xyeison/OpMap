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
    
    console.log(`✅ Activando KAM ${kamId}...`)
    console.time('Activación total')
    
    // 1. Obtener info del KAM
    console.time('Obtener KAM')
    const { data: kam } = await supabase
      .from('kams')
      .select('*')
      .eq('id', kamId)
      .single()
    console.timeEnd('Obtener KAM')
    
    if (!kam) {
      return NextResponse.json({ success: false, error: 'KAM no encontrado' }, { status: 404 })
    }
    
    console.log(`📍 Activando KAM ${kam.name} en ${kam.area_id}`)
    
    // 2. Activar el KAM
    console.time('Update KAM')
    const { data: updatedKam, error: updateError } = await supabase
      .from('kams')
      .update({ active: true })
      .eq('id', kamId)
      .select()
      .single()
    console.timeEnd('Update KAM')
    
    if (updateError) {
      console.error('Error al actualizar KAM:', updateError)
      throw updateError
    }
    
    // Verificar resultado directo del update
    if (!updatedKam || !updatedKam.active) {
      console.error('KAM no se activó correctamente:', updatedKam)
      throw new Error('El KAM no se activó correctamente')
    }
    
    console.log('✅ KAM activado correctamente en la BD')
    
    // 3. Recalcular todas las asignaciones usando el algoritmo simplificado
    console.log('🔄 Recalculando asignaciones con el KAM activado...')
    console.time('Algoritmo completo')
    
    const algorithm = new SimplifiedOpMapAlgorithm()
    
    console.time('Cargar datos')
    await algorithm.loadData()
    console.timeEnd('Cargar datos')
    
    console.time('Calcular asignaciones')
    const assignments = await algorithm.calculateAssignments()
    console.timeEnd('Calcular asignaciones')
    
    console.time('Guardar asignaciones')
    await algorithm.saveAssignments(assignments)
    console.timeEnd('Guardar asignaciones')
    
    console.timeEnd('Algoritmo completo')
    
    const saved = assignments.length
    
    console.log(`✅ Recálculo completado: ${saved} asignaciones actualizadas`)
    
    // 4. Obtener estadísticas del KAM recién activado
    console.time('Obtener estadísticas')
    const { data: kamAssignments } = await supabase
      .from('assignments')
      .select('hospital_id')
      .eq('kam_id', kamId)
    
    // 5. Verificar hospitales en el municipio base
    const { count: hospitalsInMunicipality } = await supabase
      .from('hospitals')
      .select('*', { count: 'exact', head: true })
      .eq('municipality_id', kam.area_id)
      .eq('active', true)
    console.timeEnd('Obtener estadísticas')
    
    console.log(`🏥 Hospitales en ${kam.area_id}: ${hospitalsInMunicipality || 0}`)
    console.log(`📊 Asignaciones para ${kam.name}: ${kamAssignments?.length || 0}`)
    
    console.timeEnd('Activación total')
    
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