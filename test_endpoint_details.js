const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: './web/.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

async function testEndpointLogic() {
  console.log('🔍 Simulando lógica completa del endpoint...\n')
  
  // 1. Obtener hospitales sin asignar (simulando el endpoint)
  const { data: assignments } = await supabase
    .from('assignments')
    .select('hospital_id')
  
  const assignedIds = (assignments || []).map(a => a.hospital_id)
  console.log(`Total hospitales asignados: ${assignedIds.length}`)
  
  // Verificar si Málaga está asignado
  const { data: malagaHospital } = await supabase
    .from('hospitals')
    .select('*')
    .ilike('municipality_name', '%málaga%')
    .single()
  
  console.log(`\nHospital de Málaga ID: ${malagaHospital.id}`)
  console.log(`¿Está asignado? ${assignedIds.includes(malagaHospital.id)}`)
  
  // 2. Obtener hospitales sin asignar
  const { data: unassignedHospitals } = await supabase
    .from('hospitals')
    .select('*')
    .eq('active', true)
    .not('id', 'in', `(${assignedIds.length > 0 ? assignedIds.join(',') : '0'})`)
  
  console.log(`\nTotal hospitales sin asignar: ${unassignedHospitals?.length}`)
  
  // Verificar si Málaga está en la lista
  const malagaInList = unassignedHospitals?.find(h => h.id === malagaHospital.id)
  console.log(`¿Málaga está en hospitales sin asignar? ${!!malagaInList}`)
  
  // 3. Obtener KAMs activos
  const { data: kams } = await supabase
    .from('kams')
    .select('*')
    .eq('active', true)
  
  console.log(`\nTotal KAMs activos: ${kams?.length}`)
  
  // Buscar KAM de Bucaramanga
  const bucaramangaKam = kams?.find(k => k.name.toLowerCase().includes('bucaramanga'))
  console.log(`¿KAM Bucaramanga está activo? ${!!bucaramangaKam}`)
  
  if (bucaramangaKam) {
    console.log(`KAM Bucaramanga ID: ${bucaramangaKam.id}`)
  }
  
  // 4. Verificar tiempos de viaje
  if (malagaInList && bucaramangaKam) {
    console.log('\n🔍 Verificando tiempos de viaje...')
    
    // Obtener todos los tiempos
    const { data: allTravelTimes } = await supabase
      .from('travel_time_cache')
      .select('origin_lat, origin_lng, dest_lat, dest_lng, travel_time')
      .eq('source', 'google_maps')
    
    // Crear mapa
    const travelTimeMap = new Map()
    allTravelTimes?.forEach(tt => {
      const key = `${tt.origin_lat.toFixed(8)},${tt.origin_lng.toFixed(8)}|${tt.dest_lat.toFixed(8)},${tt.dest_lng.toFixed(8)}`
      travelTimeMap.set(key, tt.travel_time)
    })
    
    console.log(`Total entradas en caché: ${travelTimeMap.size}`)
    
    // Buscar tiempo específico
    const key = `${bucaramangaKam.lat.toFixed(8)},${bucaramangaKam.lng.toFixed(8)}|${malagaHospital.lat.toFixed(8)},${malagaHospital.lng.toFixed(8)}`
    const travelTime = travelTimeMap.get(key)
    
    console.log(`\nClave buscada: ${key}`)
    console.log(`Tiempo encontrado: ${travelTime} minutos`)
    
    // Simular la construcción del objeto como lo hace el endpoint
    const hospitalData = {
      id: malagaHospital.id,
      name: malagaHospital.name,
      code: malagaHospital.code,
      municipality_name: malagaHospital.municipality_name,
      lat: malagaHospital.lat,
      lng: malagaHospital.lng,
      travel_times: []
    }
    
    if (travelTime !== undefined) {
      hospitalData.travel_times.push({
        kam_id: bucaramangaKam.id,
        kam_name: bucaramangaKam.name,
        travel_time: travelTime,
        is_real: true,
        source: 'Google Maps Distance Matrix API'
      })
    }
    
    console.log('\n📊 Resultado final:')
    console.log(`Hospital: ${hospitalData.name}`)
    console.log(`Tiempos de viaje encontrados: ${hospitalData.travel_times.length}`)
    if (hospitalData.travel_times.length > 0) {
      console.log(`- ${hospitalData.travel_times[0].kam_name}: ${hospitalData.travel_times[0].travel_time} minutos`)
    }
  }
}

testEndpointLogic().catch(console.error)