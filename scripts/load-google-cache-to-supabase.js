const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
require('dotenv').config({ path: '../web/.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Necesitamos service role key
)

async function loadGoogleCacheToSupabase() {
  console.log('🚀 Cargando caché de Google Maps a Supabase...\n')
  
  // Cargar el caché de Google Maps
  const googleCache = JSON.parse(
    fs.readFileSync('../data/cache/google_distance_matrix_cache.json', 'utf8')
  )
  
  console.log(`Total de rutas en caché: ${Object.keys(googleCache).length}`)
  
  // Convertir a formato para la tabla travel_time_cache
  const travelTimes = []
  
  for (const [key, minutes] of Object.entries(googleCache)) {
    // Las claves tienen formato: "lat1,lng1|lat2,lng2"
    const [origin, dest] = key.split('|')
    if (!origin || !dest) continue
    
    const [originLat, originLng] = origin.split(',').map(Number)
    const [destLat, destLng] = dest.split(',').map(Number)
    
    // Validar coordenadas
    if (isNaN(originLat) || isNaN(originLng) || isNaN(destLat) || isNaN(destLng)) {
      console.warn(`Coordenadas inválidas: ${key}`)
      continue
    }
    
    travelTimes.push({
      origin_lat: originLat,
      origin_lng: originLng,
      dest_lat: destLat,
      dest_lng: destLng,
      travel_time: Math.round(minutes) // Asegurar que sea entero
    })
  }
  
  console.log(`\nPreparadas ${travelTimes.length} rutas para insertar`)
  
  // Insertar en lotes
  const batchSize = 500
  let inserted = 0
  let errors = 0
  
  for (let i = 0; i < travelTimes.length; i += batchSize) {
    const batch = travelTimes.slice(i, i + batchSize)
    
    try {
      const { error } = await supabase
        .from('travel_time_cache')
        .upsert(batch, {
          onConflict: 'origin_lat,origin_lng,dest_lat,dest_lng'
        })
      
      if (error) {
        console.error(`Error en batch ${Math.floor(i/batchSize) + 1}:`, error.message)
        errors += batch.length
      } else {
        inserted += batch.length
        process.stdout.write(`\r   Progreso: ${Math.min(i + batchSize, travelTimes.length)}/${travelTimes.length}`)
      }
    } catch (e) {
      console.error(`Error inesperado:`, e.message)
      errors += batch.length
    }
  }
  
  console.log(`\n\n✅ Proceso completado:`)
  console.log(`   - Insertados/Actualizados: ${inserted}`)
  console.log(`   - Errores: ${errors}`)
  
  // Verificar algunos ejemplos
  console.log('\n🔍 Verificando algunos ejemplos:')
  
  // Buscar ruta Bucaramanga-Málaga
  const { data: malagaRoute } = await supabase
    .from('travel_time_cache')
    .select('*')
    .eq('origin_lat', 7.126714307270854)
    .eq('origin_lng', -73.11446761061566)
    .gte('dest_lat', 6.7)
    .lte('dest_lat', 6.8)
    .gte('dest_lng', -72.8)
    .lte('dest_lng', -72.7)
    .single()
  
  if (malagaRoute) {
    console.log('\nRuta Bucaramanga → Málaga:')
    console.log(`Tiempo: ${malagaRoute.travel_time} minutos (${(malagaRoute.travel_time/60).toFixed(1)} horas)`)
  }
}

// Verificar que tenemos la service role key
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Error: Necesitas configurar SUPABASE_SERVICE_ROLE_KEY en .env.local')
  console.log('\n1. Ve a Supabase Dashboard → Settings → API')
  console.log('2. Copia el "service_role" key (NO el anon key)')
  console.log('3. Agrégalo a web/.env.local como:')
  console.log('   SUPABASE_SERVICE_ROLE_KEY=eyJ...')
  process.exit(1)
}

loadGoogleCacheToSupabase().catch(console.error)