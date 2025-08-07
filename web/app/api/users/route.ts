import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseServiceKey
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
    const { data: existingUsers } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
    
    if (existingUsers && existingUsers.length > 0) {
      return NextResponse.json({ error: 'El email ya está registrado' }, { status: 400 })
    }
    
    // Generar UUID (usar diferentes métodos según disponibilidad)
    let newUserId: string
    try {
      // Intentar usar crypto.randomUUID() primero
      newUserId = crypto.randomUUID()
    } catch {
      // Fallback: generar un UUID simple
      newUserId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0
        const v = c == 'x' ? r : (r & 0x3 | 0x8)
        return v.toString(16)
      })
    }

    // Crear el nuevo usuario con UUID
    const { data: newUser, error } = await supabase
      .from('users')
      .insert({
        id: newUserId,
        email,
        password, // En producción esto debería ser hasheado
        full_name,
        role,
        active: true,
        created_at: new Date().toISOString()
      })
      .select('id, email, full_name, role, active, created_at')
      .single()
    
    if (error) throw error
    
    return NextResponse.json({ user: newUser, message: 'Usuario creado exitosamente' })
  } catch (error: any) {
    console.error('Error al crear usuario:', error)
    // Devolver más detalles del error para debugging
    return NextResponse.json({ 
      error: 'Error al crear usuario',
      details: error?.message || 'Error desconocido',
      code: error?.code
    }, { status: 500 })
  }
}