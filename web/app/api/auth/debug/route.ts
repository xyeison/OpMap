import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(request: Request) {
  const { email, password } = await request.json()
  
  console.log('Debug login attempt:', { email, passwordLength: password?.length })
  
  // Primero buscar el usuario solo por email
  const { data: userByEmail, error: emailError } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .single()
  
  if (emailError) {
    console.log('Error buscando por email:', emailError)
    return NextResponse.json({ 
      step: 'email_search',
      error: emailError.message,
      details: 'Usuario no encontrado con ese email'
    }, { status: 404 })
  }
  
  if (!userByEmail) {
    return NextResponse.json({ 
      step: 'email_search',
      error: 'Usuario no encontrado',
      suggestion: 'Verifica que el email esté escrito correctamente'
    }, { status: 404 })
  }
  
  // Verificar si el usuario está activo
  if (!userByEmail.active) {
    return NextResponse.json({ 
      step: 'user_status',
      error: 'Usuario inactivo',
      userFound: true
    }, { status: 403 })
  }
  
  // Comparar contraseñas
  const passwordMatch = userByEmail.password === password
  
  console.log('Password comparison:', {
    storedLength: userByEmail.password?.length,
    inputLength: password?.length,
    match: passwordMatch
  })
  
  if (!passwordMatch) {
    return NextResponse.json({ 
      step: 'password_check',
      error: 'Contraseña incorrecta',
      userFound: true,
      userActive: true,
      hint: 'Verifica que no haya espacios al inicio o final de la contraseña'
    }, { status: 401 })
  }
  
  // Si todo está bien
  return NextResponse.json({ 
    success: true,
    user: {
      email: userByEmail.email,
      full_name: userByEmail.full_name,
      role: userByEmail.role
    }
  })
}