import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(request: Request) {
  try {
    const { hospitalId, action } = await request.json()
    
    console.log(`🎯 Recálculo inteligente para hospital ${hospitalId} (${action})`)
    const startTime = Date.now()
    
    // 1. Obtener información del hospital afectado
    const { data: hospital } = await supabase
      .from('hospitals')
      .select('municipality_id, department_id, lat, lng, active')
      .eq('id', hospitalId)
      .single()
    
    if (!hospital) {
      throw new Error('Hospital no encontrado')
    }
    
    console.log(`📍 Hospital en municipio ${hospital.municipality_id}, departamento ${hospital.department_id}`)
    
    // 2. Determinar qué hospitales necesitan recálculo
    let hospitalsToRecalculate: string[] = []
    
    if (action === 'deactivated' && !hospital.active) {
      // Hospital desactivado: verificar si quedan otros hospitales activos en la zona
      const { data: remainingHospitals } = await supabase
        .from('hospitals')
        .select('id')
        .eq('municipality_id', hospital.municipality_id)
        .eq('active', true)
      
      if (!remainingHospitals || remainingHospitals.length === 0) {
        console.log('⚠️ Último hospital desactivado en la zona - zona quedará vacante')
        // No hay nada que recalcular, la zona simplemente quedará vacante
        return NextResponse.json({
          success: true,
          message: 'Zona marcada como vacante',
          stats: {
            zonesAffected: 1,
            hospitalsRecalculated: 0,
            timeMs: Date.now() - startTime
          }
        })
      }
    } else if (action === 'activated' && hospital.active) {
      // Hospital activado: solo necesita asignación este hospital
      hospitalsToRecalculate = [hospitalId]
      console.log('✅ Hospital activado - solo necesita asignación')
    }
    
    // 3. Si hay hospitales para recalcular, cargar datos necesarios
    if (hospitalsToRecalculate.length > 0) {
      // Cargar KAMs activos
      const { data: kams } = await supabase
        .from('kams')
        .select('*')
        .eq('active', true)
      
      if (!kams || kams.length === 0) {
        throw new Error('No hay KAMs activos')
      }
      
      // Cargar matriz de adyacencia para el departamento
      const { data: adjacency } = await supabase
        .from('department_adjacency')
        .select('adjacent_department_code')
        .eq('department_code', hospital.department_id)
      
      const adjacentDepts = adjacency?.map(a => a.adjacent_department_code) || []
      console.log(`📊 Departamentos adyacentes a ${hospital.department_id}: ${adjacentDepts.join(', ')}`)
      
      // 4. Encontrar el mejor KAM para el hospital
      let bestKam = null
      let bestTime = Infinity
      
      for (const kam of kams) {
        const kamDept = kam.area_id.substring(0, 2)
        
        // Verificar si el KAM puede atender este hospital
        const isSameDept = kamDept === hospital.department_id
        const isAdjacent = adjacentDepts.includes(kamDept)
        
        if (!isSameDept && !isAdjacent) {
          continue
        }
        
        // Buscar tiempo en caché
        const { data: cachedTime } = await supabase
          .from('travel_time_cache')
          .select('travel_time')
          .eq('origin_lat', kam.lat)
          .eq('origin_lng', kam.lng)
          .eq('dest_lat', hospital.lat)
          .eq('dest_lng', hospital.lng)
          .single()
        
        if (cachedTime && cachedTime.travel_time <= kam.max_travel_time) {
          if (cachedTime.travel_time < bestTime) {
            bestTime = cachedTime.travel_time
            bestKam = kam
          }
        }
      }
      
      if (bestKam) {
        console.log(`✅ Asignando hospital a ${bestKam.name} (${bestTime} min)`)
        
        // Actualizar asignación
        await supabase
          .from('assignments')
          .upsert({
            hospital_id: hospitalId,
            kam_id: bestKam.id,
            travel_time: bestTime,
            assignment_type: 'automatic',
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'hospital_id'
          })
        
        return NextResponse.json({
          success: true,
          message: `Hospital asignado a ${bestKam.name}`,
          stats: {
            hospitalsRecalculated: 1,
            assignedTo: bestKam.name,
            travelTime: bestTime,
            timeMs: Date.now() - startTime
          }
        })
      } else {
        console.log('⚠️ No se encontró KAM disponible para el hospital')
        
        // Eliminar asignación si existe
        await supabase
          .from('assignments')
          .delete()
          .eq('hospital_id', hospitalId)
        
        return NextResponse.json({
          success: true,
          message: 'Hospital sin KAM disponible',
          stats: {
            hospitalsRecalculated: 1,
            assignedTo: null,
            timeMs: Date.now() - startTime
          }
        })
      }
    }
    
    return NextResponse.json({
      success: true,
      message: 'No se requirió recálculo',
      stats: {
        hospitalsRecalculated: 0,
        timeMs: Date.now() - startTime
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