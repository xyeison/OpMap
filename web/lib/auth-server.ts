import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export async function getUserFromRequest(request: NextRequest) {
  try {
    // Obtener cookie del request
    const cookieHeader = request.headers.get('cookie')
    if (!cookieHeader) return null
    
    // Buscar el token personalizado
    const cookies = cookieHeader.split('; ')
    const tokenCookie = cookies.find(c => c.startsWith('sb-access-token='))
    if (!tokenCookie) return null
    
    const token = tokenCookie.split('=')[1]
    if (!token) return null
    
    // Decodificar el token
    try {
      const decoded = Buffer.from(token, 'base64').toString()
      const [userId] = decoded.split(':')
      
      // Crear cliente de Supabase con Service Role Key
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        supabaseServiceKey
      )
      
      // Buscar el usuario por ID
      const { data: userData, error } = await supabase
        .from('users')
        .select('id, email, full_name, role')
        .eq('id', userId)
        .eq('active', true)
        .single()
      
      if (!error && userData) {
        return userData
      }
    } catch (e) {
      console.log('Error decodificando token:', e)
    }
    
    return null
  } catch (error) {
    console.error('Error getting user from request:', error)
    return null
  }
}