import { NextRequest } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function getUserFromRequest(request: NextRequest) {
  try {
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    
    // Obtener el token de la cookie
    const token = cookieStore.get('sb-access-token')?.value
    
    if (!token) {
      return null
    }
    
    // Verificar el token y obtener el usuario
    const { data: { user }, error } = await supabase.auth.getUser(token)
    
    if (error || !user) {
      return null
    }
    
    // Obtener información adicional del usuario desde nuestra tabla
    const { data: userData } = await supabase
      .from('users')
      .select('id, email, full_name, role')
      .eq('id', user.id)
      .single()
    
    return userData
  } catch (error) {
    console.error('Error getting user from request:', error)
    return null
  }
}