const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '../web/.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

async function checkFields() {
  // Obtener un hospital de muestra para ver sus campos
  const { data: sample } = await supabase
    .from('hospitals')
    .select('*')
    .limit(1)
    .single()
  
  console.log('Campos disponibles en la tabla hospitals:')
  console.log(Object.keys(sample || {}))
  
  // Buscar hospitales públicos por nombre
  console.log('\nBuscando hospitales que contengan "ESE" o "HOSPITAL" en el nombre...')
  
  const { data: publicHospitals } = await supabase
    .from('hospitals')
    .select('name, code')
    .or('name.ilike.%ESE%,name.ilike.%HOSPITAL%')
    .limit(5)
  
  console.log('\nMuestra de hospitales (probablemente públicos):')
  publicHospitals?.forEach(h => {
    console.log(`- ${h.name} (${h.code})`)
  })
}

checkFields().catch(console.error)