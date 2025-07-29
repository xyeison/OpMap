import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import path from 'path'

// Cargar variables de entorno
dotenv.config({ path: path.join(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function checkTravelTimeCount() {
  console.log('🔍 Verificando travel_time_cache\n')

  // Contar total de registros
  const { count: totalCount } = await supabase
    .from('travel_time_cache')
    .select('*', { count: 'exact', head: true })

  console.log(`Total de registros en travel_time_cache: ${totalCount}`)

  // Contar por fuente
  const { data: bySource } = await supabase
    .from('travel_time_cache')
    .select('source')
    .limit(50000) // Límite alto para obtener todos

  if (bySource) {
    const sourceCounts: Record<string, number> = {}
    bySource.forEach(row => {
      sourceCounts[row.source] = (sourceCounts[row.source] || 0) + 1
    })
    
    console.log('\nPor fuente:')
    Object.entries(sourceCounts).forEach(([source, count]) => {
      console.log(`- ${source}: ${count}`)
    })
  }

  // Verificar específicamente los hospitales problemáticos
  console.log('\n🏥 Verificando hospitales específicos:')
  
  // José Cayetano
  const { count: joseCayetanoCount } = await supabase
    .from('travel_time_cache')
    .select('*', { count: 'exact', head: true })
    .eq('dest_lat', 5.97265356)
    .eq('dest_lng', -74.57782846)

  console.log(`\nJosé Cayetano Vásquez (5.97265356, -74.57782846): ${joseCayetanoCount} tiempos`)

  // Alfonso Jaramillo
  const { count: alfonsoJaramilloCount } = await supabase
    .from('travel_time_cache')
    .select('*', { count: 'exact', head: true })
    .eq('dest_lat', 4.92087321)
    .eq('dest_lng', -75.05795598)

  console.log(`Alfonso Jaramillo (4.92087321, -75.05795598): ${alfonsoJaramilloCount} tiempos`)

  process.exit(0)
}

checkTravelTimeCount().catch(console.error)