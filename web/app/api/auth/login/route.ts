import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(request: Request) {
  const { email, password } = await request.json()
  
  // Buscar usuario y verificar contraseña directamente
  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .eq('password', password) // Comparación directa sin hash
    .eq('active', true)
    .single()
  
  if (error || !user) {
    return NextResponse.json({ error: 'Email o contraseña incorrectos' }, { status: 401 })
  }
  
  // Retornar usuario sin la contraseña
  const { password: _, ...userWithoutPassword } = user
  
  return NextResponse.json({ 
    user: userWithoutPassword,
    message: 'Login exitoso' 
  })
}