const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '../web/.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

async function getTopPublicHospitals() {
  // Top 10 hospitales públicos de Cundinamarca (excluyendo Bogotá)
  console.log('TOP 10 HOSPITALES PÚBLICOS MÁS GRANDES DE CUNDINAMARCA')
  console.log('(excluyendo Bogotá - solo ESE y Hospitales)')
  console.log('='.repeat(80))
  
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
    .or('name.ilike.%ESE%,name.ilike.%E.S.E%,name.ilike.%Hospital%')
    .order('beds', { ascending: false })
    .limit(10)
  
  console.log('\n#  | Camas | Nivel | Hospital')
  console.log('-'.repeat(80))
  
  cundinamarcaHospitals?.forEach((h, idx) => {
    console.log(
      `${(idx + 1).toString().padStart(2)} | ${(h.beds || 0).toString().padStart(5)} | ${(h.service_level || 'N/A').toString().padStart(5)} | ${h.name}`
    )
    console.log(`   |       |       | ${h.municipality_name}`)
    if (h.code) {
      console.log(`   |       |       | NIT: ${h.code}`)
    }
    console.log('-'.repeat(80))
  })
  
  // Top 10 hospitales públicos de Bogotá
  console.log('\n\nTOP 10 HOSPITALES PÚBLICOS MÁS GRANDES DE BOGOTÁ')
  console.log('(solo ESE y Hospitales)')
  console.log('='.repeat(80))
  
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
    .or('name.ilike.%ESE%,name.ilike.%E.S.E%,name.ilike.%Hospital%')
    .order('beds', { ascending: false })
    .limit(10)
  
  console.log('\n#  | Camas | Nivel | Hospital')
  console.log('-'.repeat(80))
  
  bogotaHospitals?.forEach((h, idx) => {
    console.log(
      `${(idx + 1).toString().padStart(2)} | ${(h.beds || 0).toString().padStart(5)} | ${(h.service_level || 'N/A').toString().padStart(5)} | ${h.name}`
    )
    console.log(`   |       |       | Localidad: ${h.locality_name || 'N/A'}`)
    if (h.code) {
      console.log(`   |       |       | NIT: ${h.code}`)
    }
    console.log('-'.repeat(80))
  })
  
  // Resumen con totales de camas
  const { data: cundinamarcaStats } = await supabase
    .from('hospitals')
    .select('beds')
    .eq('department_id', '25')
    .is('locality_id', null)
    .eq('active', true)
    .or('name.ilike.%ESE%,name.ilike.%E.S.E%,name.ilike.%Hospital%')
  
  const { data: bogotaStats } = await supabase
    .from('hospitals')
    .select('beds')
    .not('locality_id', 'is', null)
    .eq('active', true)
    .or('name.ilike.%ESE%,name.ilike.%E.S.E%,name.ilike.%Hospital%')
  
  const totalBedsCundinamarca = cundinamarcaStats?.reduce((sum, h) => sum + (h.beds || 0), 0) || 0
  const totalBedsBogota = bogotaStats?.reduce((sum, h) => sum + (h.beds || 0), 0) || 0
  
  console.log('\n\nRESUMEN:')
  console.log(`Total hospitales públicos en Cundinamarca (sin Bogotá): ${cundinamarcaStats?.length || 0}`)
  console.log(`Total camas en hospitales públicos de Cundinamarca: ${totalBedsCundinamarca.toLocaleString()}`)
  console.log(`\nTotal hospitales públicos en Bogotá: ${bogotaStats?.length || 0}`)
  console.log(`Total camas en hospitales públicos de Bogotá: ${totalBedsBogota.toLocaleString()}`)
}

getTopPublicHospitals().catch(console.error)