const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: './web/.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

async function testRecalculationFlow() {
  console.log('🔍 Verificando flujo de recálculo cuando se desactiva un KAM...\n')
  
  // 1. Estado actual
  const { count: totalKamsActive } = await supabase
    .from('kams')
    .select('*', { count: 'exact', head: true })
    .eq('active', true)
  
  const { count: totalAssignments } = await supabase
    .from('assignments')
    .select('*', { count: 'exact', head: true })
  
  console.log('📊 Estado actual:')
  console.log(`- KAMs activos: ${totalKamsActive}`)
  console.log(`- Total asignaciones: ${totalAssignments}`)
  
  // 2. Verificar datos de un KAM específico (ej: Bucaramanga)
  const { data: bucaramanga } = await supabase
    .from('kams')
    .select('*')
    .ilike('name', '%bucaramanga%')
    .single()
  
  if (bucaramanga) {
    console.log(`\n🏢 KAM Bucaramanga:`)
    console.log(`- ID: ${bucaramanga.id}`)
    console.log(`- Activo: ${bucaramanga.active}`)
    
    // Contar asignaciones de este KAM
    const { count: bucaramangaAssignments } = await supabase
      .from('assignments')
      .select('*', { count: 'exact', head: true })
      .eq('kam_id', bucaramanga.id)
    
    console.log(`- Hospitales asignados: ${bucaramangaAssignments}`)
    
    // Ver algunos hospitales asignados
    const { data: someAssignments } = await supabase
      .from('assignments')
      .select(`
        hospital_id,
        hospitals (
          name,
          municipality_name
        )
      `)
      .eq('kam_id', bucaramanga.id)
      .limit(5)
    
    if (someAssignments && someAssignments.length > 0) {
      console.log('\nAlgunos hospitales asignados:')
      someAssignments.forEach(a => {
        console.log(`- ${a.hospitals.name} (${a.hospitals.municipality_name})`)
      })
    }
  }
  
  // 3. Verificar qué pasaría si se desactiva
  console.log('\n⚡ Simulación de desactivación:')
  console.log('Si se desactiva este KAM:')
  console.log('1. Se marca como active=false en la tabla kams')
  console.log('2. Se eliminan todas sus asignaciones de la tabla assignments')
  console.log('3. El algoritmo de recálculo:')
  console.log('   - NO incluirá este KAM en la lista de KAMs activos')
  console.log('   - Los hospitales quedarán disponibles para otros KAMs')
  console.log('   - Se aplicarán las reglas de proximidad y límites de tiempo')
  
  // 4. Verificar caché de tiempos disponibles
  const { count: googleCacheCount } = await supabase
    .from('travel_time_cache')
    .select('*', { count: 'exact', head: true })
    .eq('source', 'google_maps')
  
  console.log(`\n📦 Caché de tiempos de Google Maps: ${googleCacheCount} registros`)
  console.log('Estos tiempos se reutilizarán en el recálculo')
}

testRecalculationFlow().catch(console.error)