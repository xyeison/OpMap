import { NextResponse, NextRequest } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    
    // Obtener la sesión actual
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError || !session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    
    // Obtener información del usuario desde nuestra tabla
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, full_name, role')
      .eq('id', session.user.id)
      .eq('active', true)
      .single()
    
    if (userError || !user) {
      console.error('Error obteniendo usuario:', userError)
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 401 })
    }
    
    return NextResponse.json({ user })
  } catch (error) {
    console.error('Error en /api/auth/me:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}