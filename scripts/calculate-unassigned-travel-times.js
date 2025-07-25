const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '../web/.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// Simulación de tiempos de viaje basados en distancia euclidiana
// Esto es temporal hasta que tengamos acceso a la API de Google Maps
function estimateTravelTime(origin, dest) {
  // Calcular distancia euclidiana
  const R = 6371 // Radio de la Tierra en km
  const dLat = (dest.lat - origin.lat) * Math.PI / 180
  const dLon = (dest.lng - origin.lng) * Math.PI / 180
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(origin.lat * Math.PI / 180) * Math.cos(dest.lat * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  const distance = R * c // Distancia en km
  
  // Estimar tiempo de viaje (60 km/h promedio en Colombia con factor de carreteras)
  const avgSpeed = 45 // km/h promedio considerando montañas y carreteras
  const travelTime = Math.round((distance / avgSpeed) * 60) // minutos
  
  return travelTime
}

async function calculateUnassignedTravelTimes() {
  console.log('🚀 Calculando tiempos de viaje para hospitales no asignados...\n')
  
  // Obtener hospitales sin asignar
  const { data: assignments } = await supabase
    .from('assignments')
    .select('hospital_id')
  
  const assignedIds = (assignments || []).map(a => a.hospital_id)
  
  const { data: unassignedHospitals } = await supabase
    .from('hospitals')
    .select('*')
    .eq('active', true)
    .not('id', 'in', `(${assignedIds.join(',')})`)
  
  console.log(`Encontrados ${unassignedHospitals?.length || 0} hospitales sin asignar`)
  
  // Obtener todos los KAMs activos
  const { data: kams } = await supabase
    .from('kams')
    .select('*')
    .eq('active', true)
  
  console.log(`Encontrados ${kams?.length || 0} KAMs activos\n`)
  
  // Verificar caché existente
  const { data: existingCache } = await supabase
    .from('travel_time_cache')
    .select('origin_lat, origin_lng, dest_lat, dest_lng')
  
  const cacheSet = new Set(
    (existingCache || []).map(c => 
      `${c.origin_lat.toFixed(4)}_${c.origin_lng.toFixed(4)}_${c.dest_lat.toFixed(4)}_${c.dest_lng.toFixed(4)}`
    )
  )
  
  console.log(`Cache existente: ${cacheSet.size} rutas\n`)
  
  // Calcular tiempos faltantes
  const newTravelTimes = []
  let calculated = 0
  let skipped = 0
  
  for (const hospital of (unassignedHospitals || [])) {
    console.log(`\nProcesando: ${hospital.name} (${hospital.municipality_name})`)
    
    for (const kam of (kams || [])) {
      // Verificar si ya existe en caché
      const cacheKey = `${kam.lat.toFixed(4)}_${kam.lng.toFixed(4)}_${hospital.lat.toFixed(4)}_${hospital.lng.toFixed(4)}`
      
      if (cacheSet.has(cacheKey)) {
        skipped++
        continue
      }
      
      // Calcular tiempo estimado
      const travelTime = estimateTravelTime(
        { lat: kam.lat, lng: kam.lng },
        { lat: hospital.lat, lng: hospital.lng }
      )
      
      // Solo mostrar los primeros 3 más cercanos
      if (calculated < 3 || travelTime < 600) {
        console.log(`  - ${kam.name}: ${Math.floor(travelTime/60)}h ${travelTime%60}min`)
      }
      
      newTravelTimes.push({
        origin_lat: kam.lat,
        origin_lng: kam.lng,
        dest_lat: hospital.lat,
        dest_lng: hospital.lng,
        travel_time: travelTime,
        mode: 'driving',
        calculated_at: new Date().toISOString()
      })
      
      calculated++
    }
  }
  
  console.log(`\n📊 Resumen:`)
  console.log(`   - Tiempos calculados: ${calculated}`)
  console.log(`   - Ya en caché: ${skipped}`)
  
  // Insertar en caché
  if (newTravelTimes.length > 0) {
    console.log(`\n💾 Guardando ${newTravelTimes.length} nuevos tiempos en caché...`)
    
    // Insertar en lotes de 100
    const batchSize = 100
    for (let i = 0; i < newTravelTimes.length; i += batchSize) {
      const batch = newTravelTimes.slice(i, i + batchSize)
      const { error } = await supabase
        .from('travel_time_cache')
        .insert(batch)
      
      if (error) {
        console.error(`Error insertando batch ${i/batchSize + 1}:`, error)
      } else {
        process.stdout.write(`\r   Progreso: ${Math.min(i + batchSize, newTravelTimes.length)}/${newTravelTimes.length}`)
      }
    }
    
    console.log('\n✅ Tiempos guardados en caché')
  }
  
  // Mostrar algunos ejemplos
  console.log('\n🔍 Ejemplos de hospitales lejanos:')
  const { data: farHospitals } = await supabase
    .from('hospitals')
    .select('name, municipality_name, department_name')
    .eq('active', true)
    .not('id', 'in', `(${assignedIds.join(',')})`)
    .limit(5)
  
  for (const hospital of (farHospitals || [])) {
    console.log(`\n${hospital.name} (${hospital.municipality_name}, ${hospital.department_name})`)
    console.log('Probablemente está a más de 4 horas de todos los KAMs')
  }
}

calculateUnassignedTravelTimes().catch(console.error)