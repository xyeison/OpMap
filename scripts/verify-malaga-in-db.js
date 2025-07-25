const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '../web/.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

async function verifyMalagaData() {
  console.log('🔍 Verificando datos de Málaga en la BD...\n')
  
  // 1. Buscar el hospital de Málaga
  const { data: hospitals } = await supabase
    .from('hospitals')
    .select('*')
    .ilike('municipality_name', '%málaga%')
  
  if (!hospitals || hospitals.length === 0) {
    console.log('❌ No se encontró hospital en Málaga')
    return
  }
  
  const hospital = hospitals[0]
  console.log('Hospital encontrado:')
  console.log(`- ${hospital.name} (${hospital.code})`)
  console.log(`- Coordenadas: ${hospital.lat}, ${hospital.lng}`)
  console.log(`- ID: ${hospital.id}`)
  
  // 2. Verificar si está asignado
  const { data: assignment } = await supabase
    .from('assignments')
    .select('*')
    .eq('hospital_id', hospital.id)
    .single()
  
  if (assignment) {
    console.log('\n✅ Hospital ESTÁ asignado')
    return
  }
  
  console.log('\n⚠️  Hospital NO está asignado (zona vacante)')
  
  // 3. Buscar KAM de Bucaramanga
  const { data: bucaramanga } = await supabase
    .from('kams')
    .select('*')
    .eq('id', 'bucaramanga')
    .single()
  
  if (!bucaramanga) {
    console.log('❌ No se encontró KAM de Bucaramanga')
    return
  }
  
  console.log('\nKAM Bucaramanga:')
  console.log(`- Coordenadas: ${bucaramanga.lat}, ${bucaramanga.lng}`)
  
  // 4. Buscar tiempo en caché
  console.log('\n🔍 Buscando tiempo de viaje en travel_time_cache...')
  
  // Búsqueda exacta
  const { data: exactMatch } = await supabase
    .from('travel_time_cache')
    .select('*')
    .eq('origin_lat', bucaramanga.lat)
    .eq('origin_lng', bucaramanga.lng)
    .eq('dest_lat', hospital.lat)
    .eq('dest_lng', hospital.lng)
    .eq('source', 'google_maps')
  
  if (exactMatch && exactMatch.length > 0) {
    console.log('✅ Coincidencia exacta encontrada:')
    console.log(`   Tiempo: ${exactMatch[0].travel_time} minutos (${(exactMatch[0].travel_time/60).toFixed(1)} horas)`)
  } else {
    console.log('❌ No hay coincidencia exacta')
    
    // Búsqueda con tolerancia
    const { data: fuzzyMatch } = await supabase
      .from('travel_time_cache')
      .select('*')
      .gte('origin_lat', bucaramanga.lat - 0.001)
      .lte('origin_lat', bucaramanga.lat + 0.001)
      .gte('origin_lng', bucaramanga.lng - 0.001)
      .lte('origin_lng', bucaramanga.lng + 0.001)
      .gte('dest_lat', hospital.lat - 0.001)
      .lte('dest_lat', hospital.lat + 0.001)
      .gte('dest_lng', hospital.lng - 0.001)
      .lte('dest_lng', hospital.lng + 0.001)
      .eq('source', 'google_maps')
    
    if (fuzzyMatch && fuzzyMatch.length > 0) {
      console.log('✅ Coincidencia con tolerancia encontrada:')
      fuzzyMatch.forEach(m => {
        console.log(`   De (${m.origin_lat}, ${m.origin_lng}) a (${m.dest_lat}, ${m.dest_lng})`)
        console.log(`   Tiempo: ${m.travel_time} minutos (${(m.travel_time/60).toFixed(1)} horas)`)
      })
    } else {
      console.log('❌ No hay coincidencias ni con tolerancia')
    }
  }
  
  // 5. Verificar cuántos registros hay en total
  const { count } = await supabase
    .from('travel_time_cache')
    .select('*', { count: 'exact', head: true })
    .eq('source', 'google_maps')
  
  console.log(`\n📊 Total de registros con source='google_maps': ${count}`)
}

verifyMalagaData().catch(console.error)