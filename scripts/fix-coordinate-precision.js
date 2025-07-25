const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '../web/.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

async function checkCoordinatePrecision() {
  console.log('🔍 Verificando precisión de coordenadas...\n')
  
  // 1. Hospital de Málaga
  const { data: malaga } = await supabase
    .from('hospitals')
    .select('*')
    .ilike('municipality_name', '%málaga%')
    .single()
  
  console.log('Hospital de Málaga:')
  console.log(`BD: lat=${malaga.lat}, lng=${malaga.lng}`)
  console.log(`Tipo: lat es ${typeof malaga.lat}, lng es ${typeof malaga.lng}`)
  
  // 2. KAM de Bucaramanga
  const { data: bucaramanga } = await supabase
    .from('kams')
    .select('*')
    .ilike('name', '%bucaramanga%')
    .single()
  
  console.log('\nKAM Bucaramanga:')
  console.log(`BD: lat=${bucaramanga.lat}, lng=${bucaramanga.lng}`)
  console.log(`Tipo: lat es ${typeof bucaramanga.lat}, lng es ${typeof bucaramanga.lng}`)
  
  // 3. Tiempo en caché
  const { data: cacheData } = await supabase
    .from('travel_time_cache')
    .select('*')
    .eq('source', 'google_maps')
    .gte('origin_lat', 7.126)
    .lte('origin_lat', 7.127)
    .gte('dest_lat', 6.702)
    .lte('dest_lat', 6.703)
    .limit(5)
  
  console.log('\nDatos en travel_time_cache:')
  cacheData?.forEach(d => {
    console.log(`De (${d.origin_lat}, ${d.origin_lng}) a (${d.dest_lat}, ${d.dest_lng})`)
    console.log(`Tipos: origin_lat es ${typeof d.origin_lat}`)
  })
  
  // 4. Comparación exacta
  console.log('\n📊 Comparación de precisión:')
  console.log('Caché vs BD:')
  
  if (cacheData && cacheData.length > 0) {
    const cache = cacheData[0]
    console.log(`origin_lat: ${cache.origin_lat} vs ${bucaramanga.lat} (dif: ${Math.abs(cache.origin_lat - bucaramanga.lat)})`)
    console.log(`origin_lng: ${cache.origin_lng} vs ${bucaramanga.lng} (dif: ${Math.abs(cache.origin_lng - bucaramanga.lng)})`)
    console.log(`dest_lat: ${cache.dest_lat} vs ${malaga.lat} (dif: ${Math.abs(cache.dest_lat - malaga.lat)})`)
    console.log(`dest_lng: ${cache.dest_lng} vs ${malaga.lng} (dif: ${Math.abs(cache.dest_lng - malaga.lng)})`)
  }
}

checkCoordinatePrecision().catch(console.error)