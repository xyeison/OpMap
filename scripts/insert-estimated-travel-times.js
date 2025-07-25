const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '../web/.env.local' })

// IMPORTANTE: Necesitamos el Service Role Key para insertar en travel_time_cache
const SUPABASE_SERVICE_ROLE_KEY = 'TU_SERVICE_ROLE_KEY_AQUI'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY  // Cambiar a SERVICE_ROLE_KEY si es necesario
)

// Función mejorada para estimar tiempo de viaje
function estimateTravelTime(origin, dest) {
  // Calcular distancia usando fórmula de Haversine
  const R = 6371 // Radio de la Tierra en km
  const dLat = (dest.lat - origin.lat) * Math.PI / 180
  const dLon = (dest.lng - origin.lng) * Math.PI / 180
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(origin.lat * Math.PI / 180) * Math.cos(dest.lat * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  const distance = R * c // Distancia en km
  
  // Factor de ajuste para carreteras colombianas (montañas, curvas, etc)
  const terrainFactor = 1.5 // Las carreteras no son líneas rectas
  const adjustedDistance = distance * terrainFactor
  
  // Velocidad promedio según distancia
  let avgSpeed
  if (adjustedDistance < 50) {
    avgSpeed = 60 // km/h en distancias cortas
  } else if (adjustedDistance < 200) {
    avgSpeed = 50 // km/h en distancias medias
  } else {
    avgSpeed = 40 // km/h en distancias largas (más montañas)
  }
  
  const travelTime = Math.round((adjustedDistance / avgSpeed) * 60) // minutos
  
  return {
    distance: Math.round(distance),
    travelTime: travelTime
  }
}

async function insertEstimatedTravelTimes() {
  console.log('🚀 Insertando tiempos estimados para hospitales sin asignar...\n')
  
  // Obtener hospitales sin asignar
  const { data: assignments } = await supabase
    .from('assignments')
    .select('hospital_id')
  
  const assignedIds = (assignments || []).map(a => a.hospital_id)
  
  const { data: allHospitals } = await supabase
    .from('hospitals')
    .select('*')
    .eq('active', true)
  
  const unassignedHospitals = allHospitals?.filter(h => 
    !assignedIds.includes(h.id)
  ) || []
  
  console.log(`Encontrados ${unassignedHospitals.length} hospitales sin asignar`)
  
  // Obtener todos los KAMs activos
  const { data: kams } = await supabase
    .from('kams')
    .select('*')
    .eq('active', true)
  
  console.log(`Encontrados ${kams?.length || 0} KAMs activos\n`)
  
  // Calcular e insertar tiempos
  const newTravelTimes = []
  
  for (const hospital of unassignedHospitals) {
    console.log(`\n📍 ${hospital.name} (${hospital.municipality_name})`)
    
    const hospitalTimes = []
    
    for (const kam of (kams || [])) {
      const { distance, travelTime } = estimateTravelTime(
        { lat: kam.lat, lng: kam.lng },
        { lat: hospital.lat, lng: hospital.lng }
      )
      
      hospitalTimes.push({
        kam: kam.name,
        distance,
        travelTime
      })
      
      newTravelTimes.push({
        origin_lat: kam.lat,
        origin_lng: kam.lng,
        dest_lat: hospital.lat,
        dest_lng: hospital.lng,
        travel_time: travelTime
      })
    }
    
    // Mostrar los 3 KAMs más cercanos
    hospitalTimes
      .sort((a, b) => a.travelTime - b.travelTime)
      .slice(0, 3)
      .forEach(ht => {
        const hours = Math.floor(ht.travelTime / 60)
        const minutes = ht.travelTime % 60
        console.log(`   ${ht.kam}: ${hours}h ${minutes}min (${ht.distance} km)`)
      })
  }
  
  console.log(`\n💾 Insertando ${newTravelTimes.length} tiempos estimados en caché...`)
  
  // Insertar en lotes
  const batchSize = 100
  let inserted = 0
  let errors = 0
  
  for (let i = 0; i < newTravelTimes.length; i += batchSize) {
    const batch = newTravelTimes.slice(i, i + batchSize)
    const { error } = await supabase
      .from('travel_time_cache')
      .insert(batch)
    
    if (error) {
      console.error(`Error en batch ${Math.floor(i/batchSize) + 1}:`, error.message)
      errors += batch.length
    } else {
      inserted += batch.length
      process.stdout.write(`\r   Progreso: ${Math.min(i + batchSize, newTravelTimes.length)}/${newTravelTimes.length}`)
    }
  }
  
  console.log(`\n\n✅ Proceso completado:`)
  console.log(`   - Insertados: ${inserted}`)
  console.log(`   - Errores: ${errors}`)
  
  // Mostrar resumen
  console.log('\n📊 Resumen de hospitales más lejanos:')
  const summary = unassignedHospitals
    .map(h => {
      const times = []
      for (const kam of (kams || [])) {
        const { travelTime } = estimateTravelTime(
          { lat: kam.lat, lng: kam.lng },
          { lat: h.lat, lng: h.lng }
        )
        times.push(travelTime)
      }
      const minTime = Math.min(...times)
      return { hospital: h, minTime }
    })
    .sort((a, b) => b.minTime - a.minTime)
    .slice(0, 5)
  
  summary.forEach(({ hospital, minTime }) => {
    const hours = Math.floor(minTime / 60)
    const minutes = minTime % 60
    console.log(`- ${hospital.name} (${hospital.municipality_name}): KAM más cercano a ${hours}h ${minutes}min`)
  })
}

insertEstimatedTravelTimes().catch(console.error)