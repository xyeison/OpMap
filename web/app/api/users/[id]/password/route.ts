import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUserFromRequest } from '@/lib/auth-server'

// Usar Service Role Key para bypasear RLS
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseServiceKey) {
  console.warn('SUPABASE_SERVICE_ROLE_KEY no configurada, usando ANON KEY')
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseServiceKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// PUT - Actualizar contraseña de usuario
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Verificar autenticación y autorización
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    
    // Verificar que el usuario actual es admin
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Solo los administradores pueden cambiar contraseñas' }, { status: 403 })
    }
    
    // Obtener la nueva contraseña
    const { password } = await request.json()
    const { id } = params
    
    if (!password || password.length < 6) {
      return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 })
    }
    
    // NOTA: El sistema actual guarda contraseñas en texto plano (no recomendado)
    // En producción, deberías usar bcrypt o similar para hashear contraseñas
    
    // Actualizar la contraseña del usuario (sin hashear para mantener compatibilidad con el sistema actual)
    const { error } = await supabase
      .from('users')
      .update({ password: password })
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