import { NextRequest } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function getUserFromRequest(request: NextRequest) {
  try {
    const cookieStore = cookies()
    
    // Primero intentar con el token personalizado del sistema
    const customToken = cookieStore.get('sb-access-token')?.value
    
    if (customToken) {
      try {
        // Decodificar el token personalizado
        const decoded = Buffer.from(customToken, 'base64').toString()
        const [userId] = decoded.split(':')
        
        // Crear cliente de Supabase con Service Role Key
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        const { createClient } = await import('@supabase/supabase-js')
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
        console.log('Error con token personalizado:', e)
      }
    }
    
    // Si no funciona con token personalizado, intentar con Supabase Auth
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError || !session) {
      return null
    }
    
    // Obtener información adicional del usuario desde nuestra tabla
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, email, full_name, role')
      .eq('id', session.user.id)
      .single()
    
    if (userError) {
      return null
    }
    
    return userData
  } catch (error) {
    console.error('Error getting user from request:', error)
    return null
  }
}