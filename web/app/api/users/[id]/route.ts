import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

// IMPORTANTE: Usar service_role key para bypass RLS cuando sea necesario
// Si no tienes SUPABASE_SERVICE_ROLE_KEY, temporalmente usa anon_key
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
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
    
    // Usar supabaseAdmin para verificar el rol del usuario actual
    const { data: currentUser, error: userError } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', userId)
      .single()
    
    if (userError) {
      console.error('Error verificando usuario:', userError)
      return NextResponse.json({ error: 'Error de autenticación' }, { status: 401 })
    }
    
    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json({ error: 'Acceso denegado - Se requiere rol de administrador' }, { status: 403 })
    }
    
    // Obtener datos para actualizar
    const updates = await request.json()
    const { id } = params
    
    // Log para debugging
    console.log('Intentando actualizar usuario:', id, 'con datos:', updates)
    
    // No permitir que el admin se desactive a sí mismo
    if (userId === id && updates.active === false) {
      return NextResponse.json({ error: 'No puedes desactivarte a ti mismo' }, { status: 400 })
    }
    
    // No permitir cambiar el rol del último admin
    if (updates.role && updates.role !== 'admin') {
      const { count } = await supabaseAdmin
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'admin')
        .eq('active', true)
      
      if (count === 1) {
        const { data: userToUpdate } = await supabaseAdmin
          .from('users')
          .select('role')
          .eq('id', id)
          .single()
        
        if (userToUpdate?.role === 'admin') {
          return NextResponse.json({ error: 'No puedes cambiar el rol del último administrador' }, { status: 400 })
        }
      }
    }
    
    // Actualizar usuario usando supabaseAdmin para bypass RLS
    const { data: updatedUser, error } = await supabaseAdmin
      .from('users')
      .update(updates)
      .eq('id', id)
      .select('id, email, full_name, role, active, created_at')
      .single()
    
    if (error) {
      console.error('Error de Supabase al actualizar:', error)
      return NextResponse.json({ 
        error: 'Error al actualizar usuario', 
        details: error.message 
      }, { status: 500 })
    }
    
    return NextResponse.json({ user: updatedUser, message: 'Usuario actualizado exitosamente' })
  } catch (error: any) {
    console.error('Error al actualizar usuario:', error)
    return NextResponse.json({ 
      error: 'Error al actualizar usuario',
      details: error?.message || 'Error desconocido'
    }, { status: 500 })
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
    
    const { data: currentUser, error: userError } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', userId)
      .single()
    
    if (userError) {
      console.error('Error verificando usuario:', userError)
      return NextResponse.json({ error: 'Error de autenticación' }, { status: 401 })
    }
    
    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
    }
    
    const { id } = params
    
    // No permitir que el admin se elimine a sí mismo
    if (userId === id) {
      return NextResponse.json({ error: 'No puedes eliminarte a ti mismo' }, { status: 400 })
    }
    
    // Desactivar usuario en lugar de eliminar usando supabaseAdmin
    const { error } = await supabaseAdmin
      .from('users')
      .update({ active: false })
      .eq('id', id)
    
    if (error) {
      console.error('Error de Supabase al desactivar:', error)
      return NextResponse.json({ 
        error: 'Error al desactivar usuario',
        details: error.message
      }, { status: 500 })
    }
    
    return NextResponse.json({ message: 'Usuario desactivado exitosamente' })
  } catch (error: any) {
    console.error('Error al eliminar usuario:', error)
    return NextResponse.json({ 
      error: 'Error al eliminar usuario',
      details: error?.message || 'Error desconocido'
    }, { status: 500 })
  }
}