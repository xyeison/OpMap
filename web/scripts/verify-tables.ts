import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import path from 'path'

// Cargar variables de entorno
dotenv.config({ path: path.join(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function verifyTables() {
  console.log('🔍 Verificando tablas en Supabase\n')

  // Verificar tabla sellers
  const { data: sellers, error: sellersError } = await supabase
    .from('sellers')
    .select('*')
    .limit(1)
  
  if (sellersError) {
    console.log('❌ Tabla "sellers" no existe o hay error:', sellersError.message)
  } else {
    console.log('✅ Tabla "sellers" existe')
  }

  // Verificar tabla kams
  const { data: kams, error: kamsError } = await supabase
    .from('kams')
    .select('*')
    .limit(1)
  
  if (kamsError) {
    console.log('❌ Tabla "kams" no existe o hay error:', kamsError.message)
  } else {
    console.log('✅ Tabla "kams" existe')
    
    // Obtener todos los KAMs activos
    const { data: activeKams } = await supabase
      .from('kams')
      .select('id, name, lat, lng, active')
      .eq('active', true)
    
    console.log(`\nKAMs activos: ${activeKams?.length || 0}`)
    activeKams?.forEach(kam => {
      console.log(`- ${kam.name}: ${kam.lat}, ${kam.lng}`)
    })
  }

  process.exit(0)
}

verifyTables().catch(console.error)