import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import path from 'path'

// Cargar variables de entorno
dotenv.config({ path: path.join(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function debugMatching() {
  console.log('🔍 Debug de matching de tiempos de viaje\n')

  // Hospital Alfonso Jaramillo
  const hospitalLat = 4.92087321
  const hospitalLng = -75.05795598
  
  console.log(`Hospital Alfonso Jaramillo: ${hospitalLat}, ${hospitalLng}`)
  
  // Obtener tiempos exactos
  const { data: exactTimes } = await supabase
    .from('travel_time_cache')
    .select('*')
    .eq('dest_lat', hospitalLat)
    .eq('dest_lng', hospitalLng)
    .eq('source', 'google_maps')

  console.log(`\nTiempos exactos encontrados: ${exactTimes?.length || 0}`)
  
  // Probar diferentes precisiones
  for (let precision = 8; precision >= 4; precision--) {
    const roundedLat = parseFloat(hospitalLat.toFixed(precision))
    const roundedLng = parseFloat(hospitalLng.toFixed(precision))
    
    console.log(`\nPrecisión ${precision} decimales: ${roundedLat}, ${roundedLng}`)
    
    // Ver si esto genera diferentes valores
    const key = `${roundedLat},${roundedLng}`
    console.log(`Clave generada: ${key}`)
  }
  
  // Obtener algunos tiempos de la base de datos para ver el formato
  const { data: sampleTimes } = await supabase
    .from('travel_time_cache')
    .select('dest_lat, dest_lng')
    .eq('source', 'google_maps')
    .limit(10)
  
  console.log('\nEjemplos de coordenadas en la base de datos:')
  sampleTimes?.forEach((t, idx) => {
    console.log(`${idx + 1}. ${t.dest_lat}, ${t.dest_lng} (decimales: ${t.dest_lat.toString().split('.')[1]?.length || 0})`)
  })
  
  // Buscar tiempos para KAM específico (Pereira)
  const pereiraLat = 4.81788814
  const pereiraLng = -75.69976105
  
  console.log(`\n🔍 Buscando tiempo Pereira -> Alfonso Jaramillo`)
  const { data: pereiraTime } = await supabase
    .from('travel_time_cache')
    .select('*')
    .eq('origin_lat', pereiraLat)
    .eq('origin_lng', pereiraLng)
    .eq('dest_lat', hospitalLat)
    .eq('dest_lng', hospitalLng)
    .single()
  
  if (pereiraTime) {
    console.log('✅ Encontrado:', pereiraTime.travel_time, 'segundos')
    console.log('Coordenadas almacenadas:')
    console.log(`- origen: ${pereiraTime.origin_lat}, ${pereiraTime.origin_lng}`)
    console.log(`- destino: ${pereiraTime.dest_lat}, ${pereiraTime.dest_lng}`)
  } else {
    console.log('❌ No encontrado')
  }

  process.exit(0)
}

debugMatching().catch(console.error)