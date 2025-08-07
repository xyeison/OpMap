const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function createAdminUser() {
  // Primero verificar si existe
  const { data: existingUser } = await supabase
    .from('users')
    .select('*')
    .eq('email', 'admin@opmap.com')
    .single()

  if (existingUser) {
    console.log('Usuario ya existe:', existingUser)
    return
  }

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
    console.error('Error creando usuario:', error)
  } else {
    console.log('Usuario admin creado exitosamente:', data)
  }
}

createAdminUser()