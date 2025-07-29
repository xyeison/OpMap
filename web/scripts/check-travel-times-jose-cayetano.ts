import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import path from 'path'

// Cargar variables de entorno
dotenv.config({ path: path.join(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function checkTravelTimes() {
  console.log('🔍 Verificando tiempos de viaje para Hospital José Cayetano Vásquez\n')

  // Coordenadas exactas del hospital
  const hospitalLat = 5.97265356
  const hospitalLng = -74.57782846
  
  // Obtener todos los tiempos de viaje para este destino
  const { data: travelTimes, error } = await supabase
    .from('travel_time_cache')
    .select('*')
    .eq('dest_lat', hospitalLat)
    .eq('dest_lng', hospitalLng)

  if (error) {
    console.error('Error:', error)
    return
  }

  console.log(`Total de tiempos encontrados: ${travelTimes?.length || 0}\n`)

  if (travelTimes && travelTimes.length > 0) {
    // Obtener información de los KAMs
    const { data: kams } = await supabase
      .from('kams')
      .select('*')
      .eq('active', true)

    // Procesar cada tiempo
    travelTimes.forEach((tt, idx) => {
      const kam = kams?.find(k => 
        Math.abs(k.lat - tt.origin_lat) < 0.00001 && 
        Math.abs(k.lng - tt.origin_lng) < 0.00001
      )
      
      console.log(`${idx + 1}. Tiempo: ${tt.travel_time} segundos (${Math.round(tt.travel_time / 60)} minutos)`)
      console.log(`   Origen: ${tt.origin_lat}, ${tt.origin_lng}`)
      console.log(`   KAM: ${kam?.name || 'No identificado'}`)
      console.log(`   Fuente: ${tt.source}`)
      console.log(`   Calculado: ${new Date(tt.calculated_at).toLocaleString()}\n`)
    })

    // Verificar si los tiempos parecen incorrectos
    const suspiciousTimes = travelTimes.filter(tt => tt.travel_time < 600) // Menos de 10 minutos
    if (suspiciousTimes.length > 0) {
      console.log('⚠️ ADVERTENCIA: Se encontraron tiempos sospechosamente bajos')
      console.log('Puerto Boyacá está a más de 200 km de Bogotá')
      console.log('Los tiempos de 4-6 minutos son imposibles')
      console.log('\nPosible causa: Estos tiempos fueron calculados con Haversine')
      console.log('y luego multiplicados por un factor incorrecto.')
      console.log('\nSe recomienda recalcular estos tiempos con Google Maps.')
    }
  }

  process.exit(0)
}

checkTravelTimes().catch(console.error)