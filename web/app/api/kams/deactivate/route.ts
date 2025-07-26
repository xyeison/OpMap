import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(request: Request) {
  try {
    const { kamId } = await request.json()
    
    console.log(`🚫 Desactivando KAM ${kamId}...`)
    
    // 1. Obtener info del KAM y sus hospitales asignados
    const { data: kam } = await supabase
      .from('kams')
      .select('name, area_id')
      .eq('id', kamId)
      .single()
    
    if (!kam) {
      return NextResponse.json(
        { success: false, error: 'KAM no encontrado' },
        { status: 404 }
      )
    }
    
    const { data: assignedHospitals } = await supabase
      .from('assignments')
      .select(`
        hospital_id,
        hospitals!inner (
          id,
          name,
          lat,
          lng,
          municipality_id
        )
      `)
      .eq('kam_id', kamId)
    
    console.log(`📊 ${kam.name} tiene ${assignedHospitals?.length || 0} hospitales asignados`)
    
    // 2. Desactivar el KAM
    await supabase
      .from('kams')
      .update({ active: false })
      .eq('id', kamId)
    
    // 3. Obtener KAMs activos cercanos
    const { data: activeKams } = await supabase
      .from('kams')
      .select('*')
      .eq('active', true)
    
    // 4. Reasignar cada hospital al KAM más cercano
    const reassignments = []
    let reassignedCount = 0
    
    for (const assignment of assignedHospitals || []) {
      const hospital = (assignment as any).hospitals
      if (!hospital) continue
      
      let bestKam = null
      let bestTime = Infinity
      
      // Buscar el KAM más cercano
      for (const candidateKam of activeKams || []) {
        // Verificar en caché
        const { data: cachedTime } = await supabase
          .from('travel_time_cache')
          .select('travel_time')
          .eq('origin_lat', candidateKam.lat)
          .eq('origin_lng', candidateKam.lng)
          .eq('dest_lat', hospital.lat)
          .eq('dest_lng', hospital.lng)
          .single()
        
        if (cachedTime && cachedTime.travel_time < bestTime) {
          bestTime = cachedTime.travel_time
          bestKam = candidateKam
        }
      }
      
      if (bestKam && bestTime <= 240) { // Max 4 horas
        // Actualizar asignación
        await supabase
          .from('assignments')
          .update({
            kam_id: bestKam.id,
            travel_time: bestTime,
            assignment_type: 'automatic',
            updated_at: new Date().toISOString()
          })
          .eq('hospital_id', hospital.id)
        
        await supabase
          .from('hospitals')
          .update({ assigned_kam_id: bestKam.id })
          .eq('id', hospital.id)
        
        reassignments.push({
          hospital: hospital.name,
          oldKam: kam.name,
          newKam: bestKam.name,
          travelTime: bestTime
        })
        reassignedCount++
      } else {
        // Si no hay KAM cercano, dejar sin asignar
        await supabase
          .from('assignments')
          .delete()
          .eq('hospital_id', hospital.id)
        
        await supabase
          .from('hospitals')
          .update({ assigned_kam_id: null })
          .eq('id', hospital.id)
      }
    }
    
    console.log(`✅ ${reassignedCount} hospitales reasignados exitosamente`)
    
    return NextResponse.json({
      success: true,
      message: `KAM ${kam.name} desactivado. ${reassignedCount} hospitales reasignados automáticamente.`,
      reassignments: reassignments.slice(0, 10), // Mostrar primeros 10
      stats: {
        totalHospitals: assignedHospitals?.length || 0,
        reassigned: reassignedCount,
        unassigned: (assignedHospitals?.length || 0) - reassignedCount
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