import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import * as bcrypt from 'bcrypt'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// PUT - Actualizar contraseña de usuario
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const cookieStore = cookies()
  const sessionToken = cookieStore.get('sb-access-token')
  
  if (!sessionToken) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  
  try {
    // Verificar que el usuario actual es admin
    const decoded = Buffer.from(sessionToken.value, 'base64').toString()
    const [userId] = decoded.split(':')
    
    const { data: currentUser } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single()
    
    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
    }
    
    // Obtener la nueva contraseña
    const { password } = await request.json()
    const { id } = params
    
    if (!password || password.length < 6) {
      return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 })
    }
    
    // Hashear la nueva contraseña
    const saltRounds = 10
    const hashedPassword = await bcrypt.hash(password, saltRounds)
    
    // Actualizar la contraseña del usuario
    const { error } = await supabase
      .from('users')
      .update({ password: hashedPassword })
      .eq('id', id)
    
    if (error) throw error
    
    return NextResponse.json({ 
      success: true, 
      message: 'Contraseña actualizada exitosamente' 
    })
  } catch (error) {
    console.error('Error al actualizar contraseña:', error)
    return NextResponse.json({ error: 'Error al actualizar contraseña' }, { status: 500 })
  }
}