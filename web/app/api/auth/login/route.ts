import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseServiceKey
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
  
  // Generar un token de sesión simple (en producción usar JWT)
  const sessionToken = Buffer.from(`${user.id}:${Date.now()}`).toString('base64')
  
  // Configurar cookies seguras
  const cookieStore = cookies()
  cookieStore.set('sb-access-token', sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 días
    path: '/',
  })
  
  // Retornar usuario sin la contraseña
  const { password: _, ...userWithoutPassword } = user
  
  return NextResponse.json({ 
    user: userWithoutPassword,
    message: 'Login exitoso' 
  })
}