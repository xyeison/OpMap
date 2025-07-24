const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '../web/.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

async function checkVacantZones() {
  // Obtener hospitales sin asignar
  const { data: assignments } = await supabase
    .from('assignments')
    .select('hospital_id')
  
  const assignedIds = (assignments || []).map(a => a.hospital_id)
  
  // Si no hay asignaciones, todos los hospitales están sin asignar
  const query = supabase
    .from('hospitals')
    .select(`
      *,
      departments (name),
      municipalities (name)
    `)
    .eq('active', true)
  
  if (assignedIds.length > 0) {
    query.not('id', 'in', `(${assignedIds.join(',')})`)
  }
  
  const { data: unassignedHospitals } = await query
  
  console.log(`Total hospitales sin cobertura: ${unassignedHospitals?.length || 0}`)
  console.log('\nDetalle de hospitales sin cobertura:')
  
  // Agrupar por departamento
  const byDepartment = {}
  
  (unassignedHospitals || []).forEach(h => {
    const deptName = h.departments?.name || 'Sin departamento'
    if (!byDepartment[deptName]) {
      byDepartment[deptName] = []
    }
    byDepartment[deptName].push({
      name: h.name,
      code: h.code,
      municipality: h.municipalities?.name || h.municipality_id,
      beds: h.beds || 0,
      level: h.service_level
    })
  })
  
  // Mostrar por departamento
  Object.entries(byDepartment)
    .sort(([,a], [,b]) => b.length - a.length)
    .forEach(([dept, hospitals]) => {
      const totalBeds = hospitals.reduce((sum, h) => sum + h.beds, 0)
      console.log(`\n${dept}: ${hospitals.length} hospitales (${totalBeds} camas)`)
      hospitals.forEach(h => {
        console.log(`  - ${h.name} (${h.municipality}) - ${h.beds} camas, Nivel ${h.level}`)
      })
    })
}

checkVacantZones().catch(console.error)