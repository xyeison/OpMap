const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '../web/.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

async function checkUnassignedHospitals() {
  // Total de hospitales activos
  const { count: totalHospitals } = await supabase
    .from('hospitals')
    .select('*', { count: 'exact', head: true })
    .eq('active', true)
  
  // Total de asignaciones
  const { count: totalAssignments } = await supabase
    .from('assignments')
    .select('*', { count: 'exact', head: true })
  
  console.log('📊 Resumen:')
  console.log(`Total hospitales activos: ${totalHospitals}`)
  console.log(`Total asignaciones: ${totalAssignments}`)
  console.log(`Hospitales sin asignar: ${totalHospitals - totalAssignments}`)
  
  // Verificar si hay hospitales duplicados en assignments
  const { data: assignments } = await supabase
    .from('assignments')
    .select('hospital_id')
  
  const hospitalIds = assignments.map(a => a.hospital_id)
  const uniqueHospitalIds = new Set(hospitalIds)
  
  console.log(`\nHospitales únicos asignados: ${uniqueHospitalIds.size}`)
  
  if (hospitalIds.length !== uniqueHospitalIds.size) {
    console.log('⚠️  Hay hospitales con múltiples asignaciones!')
  }
  
  // Buscar hospitales sin asignar
  const assignedIds = Array.from(uniqueHospitalIds)
  
  // Necesitamos hacer la consulta de forma diferente
  const { data: allHospitals } = await supabase
    .from('hospitals')
    .select('id, name, municipality_name, department_name')
    .eq('active', true)
  
  const unassignedHospitals = allHospitals?.filter(h => 
    !assignedIds.includes(h.id)
  ) || []
  
  if (unassignedHospitals && unassignedHospitals.length > 0) {
    console.log('\n🏥 Hospitales sin asignar:')
    unassignedHospitals.forEach(h => {
      console.log(`- ${h.name} (${h.municipality_name}, ${h.department_name})`)
    })
  } else {
    console.log('\n✅ Todos los hospitales están asignados')
  }
}

checkUnassignedHospitals().catch(console.error)