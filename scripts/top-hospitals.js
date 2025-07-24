const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '../web/.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

async function getTopHospitals() {
  // Top 10 hospitales públicos de Cundinamarca (excluyendo Bogotá)
  console.log('TOP 10 HOSPITALES PÚBLICOS MÁS GRANDES DE CUNDINAMARCA')
  console.log('(excluyendo Bogotá)')
  console.log('='.repeat(70))
  
  const { data: cundinamarcaHospitals } = await supabase
    .from('hospitals')
    .select(`
      name,
      beds,
      municipality_name,
      service_level,
      code
    `)
    .eq('department_id', '25') // Cundinamarca
    .is('locality_id', null) // Excluir Bogotá
    .eq('active', true)
    .eq('ownership', 'public') // Solo públicos
    .order('beds', { ascending: false })
    .limit(10)
  
  console.log('\n#  | Camas | Nivel | Hospital')
  console.log('-'.repeat(70))
  
  cundinamarcaHospitals?.forEach((h, idx) => {
    console.log(
      `${(idx + 1).toString().padStart(2)} | ${h.beds.toString().padStart(5)} | ${h.service_level.padStart(5)} | ${h.name}`
    )
    console.log(`   |       |       | ${h.municipality_name}`)
    console.log(`   |       |       | NIT: ${h.code}`)
    console.log('-'.repeat(70))
  })
  
  // Top 10 hospitales públicos de Bogotá
  console.log('\n\nTOP 10 HOSPITALES PÚBLICOS MÁS GRANDES DE BOGOTÁ')
  console.log('='.repeat(70))
  
  const { data: bogotaHospitals } = await supabase
    .from('hospitals')
    .select(`
      name,
      beds,
      locality_name,
      service_level,
      code
    `)
    .not('locality_id', 'is', null) // Solo Bogotá (tienen locality_id)
    .eq('active', true)
    .eq('ownership', 'public') // Solo públicos
    .order('beds', { ascending: false })
    .limit(10)
  
  console.log('\n#  | Camas | Nivel | Hospital')
  console.log('-'.repeat(70))
  
  bogotaHospitals?.forEach((h, idx) => {
    console.log(
      `${(idx + 1).toString().padStart(2)} | ${h.beds.toString().padStart(5)} | ${h.service_level.padStart(5)} | ${h.name}`
    )
    console.log(`   |       |       | Localidad: ${h.locality_name || 'N/A'}`)
    console.log(`   |       |       | NIT: ${h.code}`)
    console.log('-'.repeat(70))
  })
  
  // Resumen
  const { count: totalCundinamarca } = await supabase
    .from('hospitals')
    .select('*', { count: 'exact', head: true })
    .eq('department_id', '25')
    .is('locality_id', null)
    .eq('active', true)
    .eq('ownership', 'public')
  
  const { count: totalBogota } = await supabase
    .from('hospitals')
    .select('*', { count: 'exact', head: true })
    .not('locality_id', 'is', null)
    .eq('active', true)
    .eq('ownership', 'public')
  
  console.log('\n\nRESUMEN:')
  console.log(`Total hospitales públicos en Cundinamarca (sin Bogotá): ${totalCundinamarca}`)
  console.log(`Total hospitales públicos en Bogotá: ${totalBogota}`)
}

getTopHospitals().catch(console.error)