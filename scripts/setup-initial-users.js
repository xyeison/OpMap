const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '../web/.env.local' })

// IMPORTANTE: Necesitas el SERVICE ROLE KEY para crear usuarios
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Necesitas agregarlo a .env.local
)

// Usuarios de ejemplo
const users = [
  {
    email: 'admin@opmap.com',
    password: 'OpMap2024Admin!',
    full_name: 'Administrador OpMap',
    role: 'admin'
  },
  {
    email: 'director@opmap.com',
    password: 'OpMap2024User!',
    full_name: 'Director Comercial',
    role: 'user'
  },
  {
    email: 'analista@opmap.com',
    password: 'OpMap2024User!',
    full_name: 'Analista Comercial',
    role: 'user'
  }
]

async function setupUsers() {
  console.log('🚀 Configurando usuarios iniciales...\n')
  
  for (const user of users) {
    try {
      // 1. Crear usuario en Supabase Auth
      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true // Auto-confirmar email
      })
      
      if (authError) {
        console.error(`❌ Error creando usuario ${user.email}:`, authError.message)
        continue
      }
      
      console.log(`✅ Usuario creado en Auth: ${user.email}`)
      
      // 2. Crear perfil del usuario
      const { error: profileError } = await supabase
        .from('user_profiles')
        .insert({
          id: authUser.user.id,
          email: user.email,
          full_name: user.full_name,
          role: user.role
        })
      
      if (profileError) {
        console.error(`❌ Error creando perfil para ${user.email}:`, profileError.message)
      } else {
        console.log(`✅ Perfil creado: ${user.full_name} (${user.role})`)
      }
      
      console.log(`   Email: ${user.email}`)
      console.log(`   Password: ${user.password}`)
      console.log(`   Role: ${user.role}\n`)
      
    } catch (error) {
      console.error(`Error procesando usuario ${user.email}:`, error)
    }
  }
  
  console.log('\n📋 Resumen de usuarios creados:')
  console.log('================================')
  users.forEach(u => {
    console.log(`${u.role.toUpperCase()}: ${u.email} / ${u.password}`)
  })
  
  console.log('\n⚠️  IMPORTANTE:')
  console.log('1. Guarda estas contraseñas de forma segura')
  console.log('2. Cambia las contraseñas en producción')
  console.log('3. Configura SUPABASE_SERVICE_ROLE_KEY en .env.local')
}

// Verificar que tenemos la service role key
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY no está configurada')
  console.log('\n1. Ve a Supabase Dashboard → Settings → API')
  console.log('2. Copia el "service_role" key (NO el anon key)')
  console.log('3. Agrégalo a web/.env.local como:')
  console.log('   SUPABASE_SERVICE_ROLE_KEY=eyJ...')
  process.exit(1)
}

setupUsers().catch(console.error)