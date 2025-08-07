import { NextResponse, NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'

export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies()
    
    // Verificar todas las cookies
    const allCookies = cookieStore.getAll()
    const cookieInfo = allCookies.map(c => ({
      name: c.name,
      valueLength: c.value?.length || 0,
      hasValue: !!c.value
    }))
    
    // Verificar token personalizado
    const customToken = cookieStore.get('sb-access-token')?.value
    let customTokenInfo = null
    
    if (customToken) {
      try {
        const decoded = Buffer.from(customToken, 'base64').toString()
        const [userId] = decoded.split(':')
        customTokenInfo = { decoded, userId }
      } catch (e) {
        customTokenInfo = { error: 'No se pudo decodificar' }
      }
    }
    
    // Verificar sesión de Supabase
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    return NextResponse.json({
      cookies: cookieInfo,
      customToken: {
        exists: !!customToken,
        info: customTokenInfo
      },
      supabaseSession: {
        exists: !!session,
        error: sessionError?.message,
        userId: session?.user?.id,
        email: session?.user?.email
      },
      timestamp: new Date().toISOString()
    })
  } catch (error: any) {
    return NextResponse.json({ 
      error: 'Error en debug', 
      message: error?.message 
    }, { status: 500 })
  }
}