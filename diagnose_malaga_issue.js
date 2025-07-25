const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: './web/.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

async function diagnoseMalagaIssue() {
  console.log('🔍 Diagnosticando problema con Málaga...\n')
  
  // 1. Obtener el hospital de Málaga
  const { data: hospitals } = await supabase
    .from('hospitals')
    .select('*')
    .ilike('municipality_name', '%málaga%')
  
  const malaga = hospitals[0]
  console.log('Hospital de Málaga:')
  console.log(`- Coordenadas originales: ${malaga.lat}, ${malaga.lng}`)
  console.log(`- Con toFixed(8): ${malaga.lat.toFixed(8)}, ${malaga.lng.toFixed(8)}`)
  
  // 2. Obtener KAM de Bucaramanga
  const { data: kams } = await supabase
    .from('kams')
    .select('*')
    .ilike('name', '%bucaramanga%')
    .eq('active', true)
  
  const bucaramanga = kams[0]
  console.log('\nKAM Bucaramanga:')
  console.log(`- Coordenadas originales: ${bucaramanga.lat}, ${bucaramanga.lng}`)
  console.log(`- Con toFixed(8): ${bucaramanga.lat.toFixed(8)}, ${bucaramanga.lng.toFixed(8)}`)
  
  // 3. Buscar en travel_time_cache
  const { data: travelTimes } = await supabase
    .from('travel_time_cache')
    .select('*')
    .eq('source', 'google_maps')
    .gte('origin_lat', 7.126)
    .lte('origin_lat', 7.127)
    .gte('dest_lat', 6.702)
    .lte('dest_lat', 6.703)
  
  console.log('\n📊 Datos en travel_time_cache:')
  travelTimes?.forEach(tt => {
    console.log(`\nRegistro encontrado:`)
    console.log(`- Origen: ${tt.origin_lat}, ${tt.origin_lng}`)
    console.log(`- Destino: ${tt.dest_lat}, ${tt.dest_lng}`)
    console.log(`- Tiempo: ${tt.travel_time} minutos`)
    
    // Crear claves como lo hace el endpoint
    const key1 = `${tt.origin_lat.toFixed(8)},${tt.origin_lng.toFixed(8)}|${tt.dest_lat.toFixed(8)},${tt.dest_lng.toFixed(8)}`
    const key2 = `${bucaramanga.lat.toFixed(8)},${bucaramanga.lng.toFixed(8)}|${malaga.lat.toFixed(8)},${malaga.lng.toFixed(8)}`
    
    console.log(`\nComparación de claves:`)
    console.log(`- Clave del caché: ${key1}`)
    console.log(`- Clave buscada:  ${key2}`)
    console.log(`- ¿Son iguales? ${key1 === key2}`)
    
    // Comparar coordenada por coordenada
    console.log(`\nComparación detallada:`)
    console.log(`- origin_lat: ${tt.origin_lat.toFixed(8)} vs ${bucaramanga.lat.toFixed(8)} = ${tt.origin_lat.toFixed(8) === bucaramanga.lat.toFixed(8)}`)
    console.log(`- origin_lng: ${tt.origin_lng.toFixed(8)} vs ${bucaramanga.lng.toFixed(8)} = ${tt.origin_lng.toFixed(8) === bucaramanga.lng.toFixed(8)}`)
    console.log(`- dest_lat: ${tt.dest_lat.toFixed(8)} vs ${malaga.lat.toFixed(8)} = ${tt.dest_lat.toFixed(8) === malaga.lat.toFixed(8)}`)
    console.log(`- dest_lng: ${tt.dest_lng.toFixed(8)} vs ${malaga.lng.toFixed(8)} = ${tt.dest_lng.toFixed(8) === malaga.lng.toFixed(8)}`)
  })
  
  // 4. Simular lo que hace el endpoint
  console.log('\n🔧 Simulando el endpoint...')
  
  const allTravelTimes = await supabase
    .from('travel_time_cache')
    .select('origin_lat, origin_lng, dest_lat, dest_lng, travel_time')
    .eq('source', 'google_maps')
  
  const travelTimeMap = new Map()
  allTravelTimes.data?.forEach(tt => {
    const key = `${tt.origin_lat.toFixed(8)},${tt.origin_lng.toFixed(8)}|${tt.dest_lat.toFixed(8)},${tt.dest_lng.toFixed(8)}`
    travelTimeMap.set(key, tt.travel_time)
  })
  
  const searchKey = `${bucaramanga.lat.toFixed(8)},${bucaramanga.lng.toFixed(8)}|${malaga.lat.toFixed(8)},${malaga.lng.toFixed(8)}`
  console.log(`\nBuscando clave: ${searchKey}`)
  console.log(`¿Existe en el mapa? ${travelTimeMap.has(searchKey)}`)
  console.log(`Valor: ${travelTimeMap.get(searchKey)}`)
  
  // 5. Buscar claves similares
  console.log('\n🔍 Buscando claves similares en el mapa...')
  let found = 0
  for (const [key, value] of travelTimeMap.entries()) {
    if (key.includes('7.12671431') && key.includes('6.70220918')) {
      console.log(`- ${key} => ${value} minutos`)
      found++
    }
  }
  console.log(`Total encontradas: ${found}`)
}

diagnoseMalagaIssue().catch(console.error)