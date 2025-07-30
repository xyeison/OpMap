import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// PUT - Actualizar usuario
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
    
    // Obtener datos para actualizar
    const updates = await request.json()
    const { id } = params
    
    // No permitir que el admin se desactive a sí mismo
    if (userId === id && updates.active === false) {
      return NextResponse.json({ error: 'No puedes desactivarte a ti mismo' }, { status: 400 })
    }
    
    // No permitir cambiar el rol del último admin
    if (updates.role && updates.role !== 'admin') {
      const { count } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'admin')
        .eq('active', true)
      
      if (count === 1) {
        const { data: userToUpdate } = await supabase
          .from('users')
          .select('role')
          .eq('id', id)
          .single()
        
        if (userToUpdate?.role === 'admin') {
          return NextResponse.json({ error: 'No puedes cambiar el rol del último administrador' }, { status: 400 })
        }
      }
    }
    
    // Actualizar usuario
    const { data: updatedUser, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', id)
      .select('id, email, full_name, role, active, created_at')
      .single()
    
    if (error) throw error
    
    return NextResponse.json({ user: updatedUser, message: 'Usuario actualizado exitosamente' })
  } catch (error) {
    console.error('Error al actualizar usuario:', error)
    return NextResponse.json({ error: 'Error al actualizar usuario' }, { status: 500 })
  }
}

// DELETE - Eliminar usuario (desactivar)
export async function DELETE(
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
    
    const { id } = params
    
    // No permitir que el admin se elimine a sí mismo
    if (userId === id) {
      return NextResponse.json({ error: 'No puedes eliminarte a ti mismo' }, { status: 400 })
    }
    
    // Desactivar usuario en lugar de eliminar
    const { error } = await supabase
      .from('users')
      .update({ active: false })
      .eq('id', id)
    
    if (error) throw error
    
    return NextResponse.json({ message: 'Usuario desactivado exitosamente' })
  } catch (error) {
    console.error('Error al eliminar usuario:', error)
    return NextResponse.json({ error: 'Error al eliminar usuario' }, { status: 500 })
  }
}