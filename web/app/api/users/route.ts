import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// GET - Listar todos los usuarios
export async function GET() {
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
    
    // Obtener todos los usuarios
    const { data: users, error } = await supabase
      .from('users')
      .select('id, email, full_name, role, active, created_at')
      .order('created_at', { ascending: false })
    
    if (error) throw error
    
    return NextResponse.json({ users })
  } catch (error) {
    console.error('Error al obtener usuarios:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

// POST - Crear nuevo usuario
export async function POST(request: Request) {
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
    
    // Obtener datos del nuevo usuario
    const { email, password, full_name, role } = await request.json()
    
    // Validar datos requeridos
    if (!email || !password || !full_name || !role) {
      return NextResponse.json({ error: 'Todos los campos son requeridos' }, { status: 400 })
    }
    
    // Verificar si el email ya existe
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single()
    
    if (existingUser) {
      return NextResponse.json({ error: 'El email ya está registrado' }, { status: 400 })
    }
    
    // Crear el nuevo usuario
    const { data: newUser, error } = await supabase
      .from('users')
      .insert({
        email,
        password, // En producción esto debería ser hasheado
        full_name,
        role,
        active: true
      })
      .select('id, email, full_name, role, active, created_at')
      .single()
    
    if (error) throw error
    
    return NextResponse.json({ user: newUser, message: 'Usuario creado exitosamente' })
  } catch (error) {
    console.error('Error al crear usuario:', error)
    return NextResponse.json({ error: 'Error al crear usuario' }, { status: 500 })
  }
}