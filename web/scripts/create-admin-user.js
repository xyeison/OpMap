const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

// Verificar variables de entorno
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  console.error('❌ Error: NEXT_PUBLIC_SUPABASE_URL no está configurada')
  console.log('Por favor, crea un archivo .env.local con las variables necesarias')
  process.exit(1)
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  console.error('❌ Error: No hay clave de Supabase configurada')
  console.log('Necesitas configurar SUPABASE_SERVICE_ROLE_KEY o NEXT_PUBLIC_SUPABASE_ANON_KEY')
  process.exit(1)
}

const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

console.log('🔧 Configuración:')
console.log('  URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
console.log('  Usando:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Service Role Key' : 'Anon Key')
console.log('')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseKey
)

async function createAdminUser() {
  try {
    console.log('🔍 Verificando si el usuario admin ya existe...')
    
    // Primero verificar si existe
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('*')
      .eq('email', 'admin@opmap.com')
      .single()

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('❌ Error verificando usuario:', checkError)
      return
    }

    if (existingUser) {
      console.log('✅ Usuario admin ya existe:')
      console.log('  Email:', existingUser.email)
      console.log('  Nombre:', existingUser.full_name)
      console.log('  Rol:', existingUser.role)
      console.log('  Activo:', existingUser.active)
      
      // Actualizar password si el usuario existe pero tal vez cambió
      const { error: updateError } = await supabase
        .from('users')
        .update({ password: 'admin123', active: true })
        .eq('email', 'admin@opmap.com')
      
      if (updateError) {
        console.error('❌ Error actualizando password:', updateError)
      } else {
        console.log('✅ Password actualizado a: admin123')
      }
      return
    }

    console.log('📝 Creando nuevo usuario admin...')
    
    // Crear usuario admin
    const { data, error } = await supabase
      .from('users')
      .insert([
        {
          email: 'admin@opmap.com',
          password: 'admin123',
          full_name: 'Administrador',
          role: 'admin',
          active: true
        }
      ])
      .select()

    if (error) {
      console.error('❌ Error creando usuario:', error)
      console.log('\nPosibles causas:')
      console.log('1. La tabla "users" no existe')
      console.log('2. No tienes permisos para insertar (necesitas Service Role Key)')
      console.log('3. Hay un problema con la estructura de la tabla')
    } else {
      console.log('✅ Usuario admin creado exitosamente!')
      console.log('  Email: admin@opmap.com')
      console.log('  Password: admin123')
      console.log('\n🎉 Ya puedes hacer login con estas credenciales')
    }
  } catch (error) {
    console.error('❌ Error inesperado:', error)
  }
}

createAdminUser()