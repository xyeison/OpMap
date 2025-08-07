import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

// Este endpoint alternativo funciona con ANON KEY usando una función SQL pública
export async function POST(request: Request) {
  try {
    const { email, password } = await request.json()
    
    // Verificar que tenemos las variables de entorno necesarias
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      console.error('NEXT_PUBLIC_SUPABASE_URL no está configurada')
      return NextResponse.json({ error: 'Error de configuración del servidor' }, { status: 500 })
    }
    
    if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.error('NEXT_PUBLIC_SUPABASE_ANON_KEY no está configurada')
      return NextResponse.json({ error: 'Error de configuración del servidor' }, { status: 500 })
    }
    
    // Usar ANON KEY (no necesita Service Role Key)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )
    
    console.log('Intentando login alternativo para:', email)
    
    // Llamar a la función SQL pública que puede ser ejecutada con ANON key
    const { data, error } = await supabase
      .rpc('authenticate_user', {
        user_email: email,
        user_password: password
      })
      .single()
    
    if (error) {
      console.error('Error en authenticate_user:', error)
      // Si la función no existe, dar instrucciones
      if (error.message?.includes('function') || error.message?.includes('does not exist')) {
        return NextResponse.json({ 
          error: 'La función de autenticación no está configurada. Ejecuta el script SQL: database/create-public-login-view.sql',
          details: error.message
        }, { status: 500 })
      }
      return NextResponse.json({ error: 'Email o contraseña incorrectos' }, { status: 401 })
    }
    
    if (!data) {
      console.log('Usuario no encontrado o credenciales incorrectas')
      return NextResponse.json({ error: 'Email o contraseña incorrectos' }, { status: 401 })
    }
  
    // Generar un token de sesión simple
    const sessionToken = Buffer.from(`${data.id}:${Date.now()}`).toString('base64')
    
    // Configurar cookies seguras
    const cookieStore = cookies()
    cookieStore.set('sb-access-token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 días
      path: '/',
    })
    
    console.log('Login exitoso para usuario:', data.email)
    
    return NextResponse.json({ 
      user: data,
      message: 'Login exitoso' 
    })
  } catch (error) {
    console.error('Error en login alternativo:', error)
    return NextResponse.json({ 
      error: 'Error interno del servidor',
      details: process.env.NODE_ENV === 'development' ? error?.toString() : undefined
    }, { status: 500 })
  }
}