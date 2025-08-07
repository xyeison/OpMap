import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json()
    
    // Verificar que tenemos las variables de entorno necesarias
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      console.error('NEXT_PUBLIC_SUPABASE_URL no está configurada')
      return NextResponse.json({ error: 'Error de configuración del servidor' }, { status: 500 })
    }
    
    // Usar Service Role Key si está disponible, de lo contrario usar Anon Key
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    if (!supabaseKey) {
      console.error('No hay clave de Supabase configurada')
      return NextResponse.json({ error: 'Error de configuración del servidor' }, { status: 500 })
    }
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      supabaseKey
    )
    
    console.log('Intentando login para:', email)
    
    // Buscar usuario y verificar contraseña directamente
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .eq('password', password) // Comparación directa sin hash
      .eq('active', true)
      .single()
    
    if (error) {
      console.error('Error al buscar usuario:', error)
      return NextResponse.json({ error: 'Email o contraseña incorrectos' }, { status: 401 })
    }
    
    if (!user) {
      console.log('Usuario no encontrado o credenciales incorrectas')
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
    
    console.log('Login exitoso para usuario:', user.email)
    
    // Retornar usuario sin la contraseña
    const { password: _, ...userWithoutPassword } = user
    
    return NextResponse.json({ 
      user: userWithoutPassword,
      message: 'Login exitoso' 
    })
  } catch (error) {
    console.error('Error en login:', error)
    return NextResponse.json({ 
      error: 'Error interno del servidor',
      details: process.env.NODE_ENV === 'development' ? error?.toString() : undefined
    }, { status: 500 })
  }
}