import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { OpMapAlgorithm } from '@/lib/opmap-algorithm'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST() {
  try {
    console.log('🧠 Iniciando recálculo inteligente...')
    
    // 1. Identificar hospitales que necesitan reasignación
    const { data: unassignedHospitals } = await supabase
      .from('hospitals')
      .select('id, name')
      .eq('active', true)
      .is('assigned_kam_id', null)
    
    // Primero obtener los KAMs inactivos
    const { data: inactiveKams } = await supabase
      .from('sellers')
      .select('id')
      .eq('active', false)
    
    const inactiveKamIds = inactiveKams?.map(k => k.id) || []
    
    // Luego buscar hospitales asignados a esos KAMs
    const { data: hospitalsWithInactiveKam } = await supabase
      .from('hospitals')
      .select('id, name, assigned_kam_id')
      .eq('active', true)
      .in('assigned_kam_id', inactiveKamIds)
    
    const hospitalsToReassign = [
      ...(unassignedHospitals || []),
      ...(hospitalsWithInactiveKam || [])
    ]
    
    console.log(`📊 Hospitales sin asignar: ${unassignedHospitals?.length || 0}`)
    console.log(`🚫 Hospitales con KAM inactivo: ${hospitalsWithInactiveKam?.length || 0}`)
    console.log(`🎯 Total a recalcular: ${hospitalsToReassign.length}`)
    
    if (hospitalsToReassign.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No hay hospitales que necesiten reasignación',
        stats: {
          hospitalsReassigned: 0,
          unassignedHospitals: 0,
          hospitalsWithInactiveKam: 0
        }
      })
    }
    
    // 2. Obtener solo los IDs de hospitales a recalcular
    const hospitalIds = hospitalsToReassign.map(h => h.id)
    
    // 3. Ejecutar recálculo completo
    // TODO: En el futuro, implementar recálculo parcial
    const algorithm = new OpMapAlgorithm()
    await algorithm.initialize()
    
    // Por ahora, recalcular todo
    const allAssignments = await algorithm.calculateAssignments()
    
    // Filtrar solo las asignaciones de los hospitales que necesitamos
    const assignments = allAssignments.filter(a => 
      hospitalIds.includes(a.hospital_id)
    )
    
    // 4. Actualizar solo las asignaciones necesarias
    for (const assignment of assignments) {
      await supabase
        .from('assignments')
        .upsert({
          kam_id: assignment.kam_id,
          hospital_id: assignment.hospital_id,
          travel_time: assignment.travel_time,
          assignment_type: assignment.assignment_type,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'hospital_id'
        })
      
      // Actualizar el hospital
      await supabase
        .from('hospitals')
        .update({ assigned_kam_id: assignment.kam_id })
        .eq('id', assignment.hospital_id)
    }
    
    console.log(`✅ ${assignments.length} hospitales reasignados exitosamente`)
    
    return NextResponse.json({
      success: true,
      message: `Se reasignaron ${assignments.length} hospitales de forma inteligente`,
      stats: {
        hospitalsReassigned: assignments.length,
        unassignedHospitals: unassignedHospitals?.length || 0,
        hospitalsWithInactiveKam: hospitalsWithInactiveKam?.length || 0,
        totalProcessed: hospitalsToReassign.length
      }
    })
    
  } catch (error) {
    console.error('Error en recálculo inteligente:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Error desconocido' 
      },
      { status: 500 }
    )
  }
}