const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '../web/.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

async function fixExcessiveAssignments() {
  console.log('1. Verificando asignaciones que exceden 4 horas...')
  
  // Ver cuántas asignaciones exceden el límite
  const { count: excessiveCount } = await supabase
    .from('assignments')
    .select('*', { count: 'exact', head: true })
    .gt('travel_time', 240)
  
  console.log(`Encontradas ${excessiveCount || 0} asignaciones que exceden 4 horas`)
  
  // Eliminar asignaciones que exceden 4 horas
  console.log('2. Eliminando asignaciones excesivas...')
  const { error: deleteError } = await supabase
    .from('assignments')
    .delete()
    .gt('travel_time', 240)
  
  if (deleteError) {
    console.error('Error eliminando asignaciones:', deleteError)
    return
  }
  
  console.log('3. Buscando hospitales para reasignar...')
  
  // Obtener hospitales sin asignar
  const { data: assignments } = await supabase
    .from('assignments')
    .select('hospital_id')
  
  const assignedIds = assignments.map(a => a.hospital_id)
  
  const { data: unassignedHospitals } = await supabase
    .from('hospitals')
    .select('*')
    .eq('active', true)
    .not('id', 'in', `(${assignedIds.join(',')})`)
  
  console.log(`${unassignedHospitals?.length || 0} hospitales sin asignar`)
  
  // Obtener KAMs activos
  const { data: kams } = await supabase
    .from('kams')
    .select('*')
    .eq('active', true)
  
  // Intentar reasignar hospitales
  console.log('4. Intentando reasignar hospitales dentro del límite de 4 horas...')
  let reassigned = 0
  
  for (const hospital of (unassignedHospitals || [])) {
    // Buscar tiempos de viaje para este hospital
    const travelTimes = []
    
    for (const kam of kams) {
      const { data: cacheData } = await supabase
        .from('travel_time_cache')
        .select('travel_time')
        .match({
          origin_lat: kam.lat,
          origin_lng: kam.lng,
          dest_lat: hospital.lat,
          dest_lng: hospital.lng
        })
        .single()
      
      if (cacheData && cacheData.travel_time <= 240) {
        travelTimes.push({
          kam_id: kam.id,
          travel_time: cacheData.travel_time
        })
      }
    }
    
    // Asignar al KAM más cercano dentro del límite
    if (travelTimes.length > 0) {
      travelTimes.sort((a, b) => a.travel_time - b.travel_time)
      const closest = travelTimes[0]
      
      const { error: insertError } = await supabase
        .from('assignments')
        .insert({
          hospital_id: hospital.id,
          kam_id: closest.kam_id,
          travel_time: closest.travel_time,
          assignment_type: 'competitive'
        })
      
      if (!insertError) {
        reassigned++
      }
    }
  }
  
  console.log(`${reassigned} hospitales reasignados exitosamente`)
  
  // Resumen final
  console.log('\n5. Resumen final:')
  
  const { count: finalAssignments } = await supabase
    .from('assignments')
    .select('*', { count: 'exact', head: true })
  
  const { count: totalHospitals } = await supabase
    .from('hospitals')
    .select('*', { count: 'exact', head: true })
    .eq('active', true)
  
  const unassignedCount = (totalHospitals || 0) - (finalAssignments || 0)
  
  console.log(`Total hospitales activos: ${totalHospitals}`)
  console.log(`Hospitales asignados: ${finalAssignments}`)
  console.log(`Hospitales sin cobertura (zonas vacantes): ${unassignedCount}`)
  
  // Ver zonas vacantes por departamento
  const { data: finalUnassigned } = await supabase
    .from('hospitals')
    .select('*, departments(name)')
    .eq('active', true)
    .not('id', 'in', `(${assignments.map(a => a.hospital_id).join(',')})`)
  
  const byDepartment = {}
  (finalUnassigned || []).forEach(h => {
    const dept = h.departments?.name || 'Sin departamento'
    if (!byDepartment[dept]) {
      byDepartment[dept] = { count: 0, beds: 0 }
    }
    byDepartment[dept].count++
    byDepartment[dept].beds += h.beds || 0
  })
  
  console.log('\nZonas vacantes por departamento:')
  Object.entries(byDepartment)
    .sort(([,a], [,b]) => b.count - a.count)
    .forEach(([dept, stats]) => {
      console.log(`${dept}: ${stats.count} hospitales, ${stats.beds} camas`)
    })
}

fixExcessiveAssignments().catch(console.error)