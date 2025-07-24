const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '../web/.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

async function checkMaxTravelTimes() {
  // Verificar tiempos máximos por KAM
  const { data: assignments } = await supabase
    .from('assignments')
    .select(`
      travel_time,
      kams (id, name),
      hospitals (name, municipality_id, municipality_name)
    `)
    .gt('travel_time', 180) // Más de 3 horas
    .order('travel_time', { ascending: false })
  
  console.log('Asignaciones con más de 3 horas de viaje:')
  console.log('='.repeat(60))
  
  const byKam = {}
  
  (assignments || []).forEach(a => {
    const kamName = a.kams?.name || 'Unknown'
    if (!byKam[kamName]) {
      byKam[kamName] = []
    }
    
    const hours = Math.floor(a.travel_time / 60)
    const minutes = a.travel_time % 60
    const timeStr = `${hours}h ${minutes}min`
    
    byKam[kamName].push({
      hospital: a.hospitals?.name || 'Unknown',
      location: a.hospitals?.municipality_name || a.hospitals?.municipality_id,
      time: a.travel_time,
      timeStr
    })
  })
  
  // Mostrar por KAM
  Object.entries(byKam)
    .sort(([,a], [,b]) => Math.max(...b.map(h => h.time)) - Math.max(...a.map(h => h.time)))
    .forEach(([kam, hospitals]) => {
      const maxTime = Math.max(...hospitals.map(h => h.time))
      const maxHours = Math.floor(maxTime / 60)
      const maxMinutes = maxTime % 60
      
      console.log(`\n${kam} (máximo: ${maxHours}h ${maxMinutes}min)`)
      hospitals
        .sort((a, b) => b.time - a.time)
        .slice(0, 5)
        .forEach(h => {
          console.log(`  - ${h.hospital} (${h.location}): ${h.timeStr}`)
        })
      
      if (hospitals.length > 5) {
        console.log(`  ... y ${hospitals.length - 5} más`)
      }
    })
  
  // Resumen
  const { count: totalAssignments } = await supabase
    .from('assignments')
    .select('*', { count: 'exact', head: true })
  
  const { count: over3Hours } = await supabase
    .from('assignments')
    .select('*', { count: 'exact', head: true })
    .gt('travel_time', 180)
  
  const { count: over4Hours } = await supabase
    .from('assignments')
    .select('*', { count: 'exact', head: true })
    .gt('travel_time', 240)
  
  console.log('\n' + '='.repeat(60))
  console.log('RESUMEN:')
  console.log(`Total asignaciones: ${totalAssignments}`)
  console.log(`Más de 3 horas: ${over3Hours} (${((over3Hours/totalAssignments)*100).toFixed(1)}%)`)
  console.log(`Más de 4 horas: ${over4Hours} (${((over4Hours/totalAssignments)*100).toFixed(1)}%)`)
}

checkMaxTravelTimes().catch(console.error)