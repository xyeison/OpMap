import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function checkCartagenaBarranquilla() {
  console.log('🔍 Verificando asignación Cartagena-Barranquilla\n')

  // 1. Verificar estado de los KAMs
  const { data: kams } = await supabase
    .from('sellers')
    .select('*')
    .in('id', ['cartagena', 'barranquilla'])

  console.log('Estado de KAMs:')
  kams?.forEach(kam => {
    console.log(`- ${kam.name}: ${kam.active ? 'ACTIVO' : 'INACTIVO'}`)
    console.log(`  Ubicación: ${kam.area_id}`)
    console.log(`  Level2: ${kam.enable_level2}`)
    console.log(`  Max tiempo: ${kam.max_travel_time} minutos\n`)
  })

  // 2. Contar hospitales en Barranquilla
  const { count: barranquillaHospitals } = await supabase
    .from('hospitals')
    .select('*', { count: 'exact', head: true })
    .eq('municipality_id', '08001')
    .eq('active', true)

  console.log(`Hospitales activos en Barranquilla: ${barranquillaHospitals}\n`)

  // 3. Ver asignaciones actuales de esos hospitales
  const { data: assignments } = await supabase
    .from('assignments')
    .select(`
      hospital_id,
      kam_id,
      travel_time,
      hospitals!inner(
        name,
        municipality_id
      ),
      sellers!inner(
        name
      )
    `)
    .eq('hospitals.municipality_id', '08001')

  console.log('Asignaciones actuales de hospitales de Barranquilla:')
  const kamCounts: Record<string, number> = {}
  assignments?.forEach(a => {
    const kamName = (a.sellers as any)?.name || 'Desconocido'
    kamCounts[kamName] = (kamCounts[kamName] || 0) + 1
  })

  Object.entries(kamCounts).forEach(([kam, count]) => {
    console.log(`- ${kam}: ${count} hospitales`)
  })

  // 4. Verificar tiempos de viaje en caché
  console.log('\n🚗 Verificando tiempos de viaje Cartagena-Barranquilla:')
  
  const cartagena = kams?.find(k => k.id === 'cartagena')
  if (cartagena) {
    const { data: travelTimes } = await supabase
      .from('travel_time_cache')
      .select('*')
      .eq('origin_lat', cartagena.lat)
      .eq('origin_lng', cartagena.lng)
      .gte('dest_lat', 10.9) // Aproximadamente Barranquilla
      .lte('dest_lat', 11.1)
      .gte('dest_lng', -74.9)
      .lte('dest_lng', -74.7)
      .limit(5)

    console.log(`Tiempos encontrados: ${travelTimes?.length || 0}`)
    travelTimes?.forEach(tt => {
      console.log(`- Tiempo: ${Math.round(tt.travel_time / 60)} minutos (${tt.source})`)
    })
  }

  // 5. Verificar matriz de adyacencia
  console.log('\n🗺️ Verificando adyacencia departamental:')
  const { data: adjacency } = await supabase
    .from('department_adjacency')
    .select('*')
    .or('department_code.eq.13,department_code.eq.08')

  const deptNames: Record<string, string> = {
    '08': 'Atlántico',
    '13': 'Bolívar',
    '47': 'Magdalena'
  }

  adjacency?.forEach(a => {
    console.log(`${deptNames[a.department_code]} (${a.department_code}) → ${deptNames[a.adjacent_department_code]} (${a.adjacent_department_code})`)
  })

  process.exit(0)
}

checkCartagenaBarranquilla().catch(console.error)