import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(request: Request) {
  const { email, password } = await request.json()
  
  // Buscar usuario
  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .eq('active', true)
    .single()
  
  if (error || !user) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 401 })
  }
  
  // Verificar contraseña
  const validPassword = await bcrypt.compare(password, user.password_hash)
  
  if (!validPassword) {
    return NextResponse.json({ error: 'Contraseña incorrecta' }, { status: 401 })
  }
  
  // Retornar usuario sin password_hash
  const { password_hash, ...userWithoutPassword } = user
  
  return NextResponse.json({ 
    user: userWithoutPassword,
    message: 'Login exitoso' 
  })
}