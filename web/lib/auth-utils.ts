import { NextRequest } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function getUserFromRequest(request: NextRequest) {
  try {
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    
    // Obtener la sesión actual usando el método estándar de Supabase
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError || !session) {
      console.log('No hay sesión activa:', sessionError)
      return null
    }
    
    // Obtener información adicional del usuario desde nuestra tabla
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, email, full_name, role')
      .eq('id', session.user.id)
      .single()
    
    if (userError) {
      console.error('Error obteniendo datos del usuario:', userError)
      return null
    }
    
    return userData
  } catch (error) {
    console.error('Error getting user from request:', error)
    return null
  }
}