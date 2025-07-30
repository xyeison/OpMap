import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET() {
  const cookieStore = cookies()
  const sessionToken = cookieStore.get('sb-access-token')
  
  if (!sessionToken) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  
  try {
    // Decodificar el token simple (en producción usar JWT)
    const decoded = Buffer.from(sessionToken.value, 'base64').toString()
    const [userId] = decoded.split(':')
    
    // Buscar el usuario
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, full_name, role')
      .eq('id', userId)
      .eq('active', true)
      .single()
    
    if (error || !user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 401 })
    }
    
    return NextResponse.json({ user })
  } catch (error) {
    return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
  }
}