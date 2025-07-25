import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  try {
    const { kamId } = await request.json()
    
    console.log(`✅ Activando KAM ${kamId}...`)
    
    // 1. Obtener info del KAM
    const { data: kam } = await supabase
      .from('sellers')
      .select('*')
      .eq('id', kamId)
      .single()
    
    console.log(`📍 KAM ${kam.name} en ${kam.area_id}`)
    
    // 2. Activar el KAM
    await supabase
      .from('sellers')
      .update({ active: true })
      .eq('id', kamId)
    
    // 3. Recuperar territorio base (hospitales en su mismo municipio)
    const { data: baseHospitals } = await supabase
      .from('hospitals')
      .select('*')
      .eq('municipality_id', kam.area_id)
      .eq('active', true)
    
    let territoryClaimed = 0
    let stolenFromOthers = 0
    const changes = []
    
    // Asignar territorio base
    for (const hospital of baseHospitals || []) {
      // Ver quién lo tiene actualmente
      const { data: currentAssignment } = await supabase
        .from('assignments')
        .select('kam_id, sellers!inner(name)')
        .eq('hospital_id', hospital.id)
        .single()
      
      // Asignar al KAM reactivado
      await supabase
        .from('assignments')
        .upsert({
          kam_id: kamId,
          hospital_id: hospital.id,
          travel_time: 0, // Está en su mismo municipio
          assignment_type: 'territory_base',
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'hospital_id'
        })
      
      await supabase
        .from('hospitals')
        .update({ assigned_kam_id: kamId })
        .eq('id', hospital.id)
      
      territoryClaimed++
      
      if (currentAssignment && currentAssignment.kam_id !== kamId) {
        changes.push({
          hospital: hospital.name,
          previousKam: currentAssignment.sellers.name,
          action: 'Recuperado (territorio base)'
        })
      }
    }
    
    // 4. Buscar hospitales cercanos que podrían estar mejor con este KAM
    const { data: nearbyHospitals } = await supabase
      .from('hospitals')
      .select('*, assignments!inner(kam_id, travel_time, sellers!inner(name))')
      .eq('active', true)
      .eq('department_id', kam.area_id.substring(0, 2)) // Mismo departamento
      .neq('municipality_id', kam.area_id) // No en su municipio base
    
    for (const hospital of nearbyHospitals || []) {
      // Calcular tiempo desde el KAM reactivado
      const { data: newTime } = await supabase
        .from('travel_time_cache')
        .select('travel_time')
        .eq('origin_lat', kam.lat)
        .eq('origin_lng', kam.lng)
        .eq('dest_lat', hospital.lat)
        .eq('dest_lng', hospital.lng)
        .single()
      
      if (newTime && newTime.travel_time < hospital.assignments.travel_time && newTime.travel_time <= kam.max_travel_time) {
        // Este KAM está más cerca, reasignar
        await supabase
          .from('assignments')
          .update({
            kam_id: kamId,
            travel_time: newTime.travel_time,
            assignment_type: 'automatic',
            updated_at: new Date().toISOString()
          })
          .eq('hospital_id', hospital.id)
        
        await supabase
          .from('hospitals')
          .update({ assigned_kam_id: kamId })
          .eq('id', hospital.id)
        
        stolenFromOthers++
        
        changes.push({
          hospital: hospital.name,
          previousKam: hospital.assignments.sellers.name,
          previousTime: hospital.assignments.travel_time,
          newTime: newTime.travel_time,
          timeSaved: hospital.assignments.travel_time - newTime.travel_time,
          action: 'Optimizado (más cercano)'
        })
      }
    }
    
    console.log(`✅ Territorio base recuperado: ${territoryClaimed} hospitales`)
    console.log(`🎯 Hospitales optimizados: ${stolenFromOthers}`)
    
    return NextResponse.json({
      success: true,
      message: `KAM ${kam.name} activado exitosamente`,
      stats: {
        territoryBase: territoryClaimed,
        optimized: stolenFromOthers,
        totalGained: territoryClaimed + stolenFromOthers
      },
      changes: changes.slice(0, 10) // Mostrar primeros 10 cambios
    })
    
  } catch (error) {
    console.error('Error al activar KAM:', error)
    return NextResponse.json(
      { success: false, error: 'Error al activar KAM' },
      { status: 500 }
    )
  }
}