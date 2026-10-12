import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { requirePermission } from '@/lib/require-role'
import { hashPassword } from '@/lib/passwords'
import { createUserSchema, firstIssueMessage } from '@/lib/user-schemas'
import { linkExecutiveToUserByEmail } from '../executives/_lib/executive-shared'

export const dynamic = 'force-dynamic'

const PUBLIC_USER_COLUMNS = 'id, email, full_name, role, active, created_at'

// GET - Listar todos los usuarios (solo admin: permiso users:manage)
export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'users:manage')
  if (!auth.ok) return auth.response

  try {
    const { data: users, error } = await getSupabaseAdmin()
      .from('users')
      .select(PUBLIC_USER_COLUMNS)
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ users })
  } catch (error) {
    console.error('Error al obtener usuarios:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

// POST - Crear nuevo usuario (solo admin: permiso users:manage)
export async function POST(request: NextRequest) {
  const auth = await requirePermission(request, 'users:manage')
  if (!auth.ok) return auth.response

  try {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Cuerpo de la petición no válido' }, { status: 400 })
    }

    const parsed = createUserSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos no válidos', details: firstIssueMessage(parsed.error) },
        { status: 400 }
      )
    }
    const { email, password, full_name, role } = parsed.data

    const supabase = getSupabaseAdmin()

    // Verificar si el email ya existe
    const { data: existingUsers, error: existingError } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .limit(1)

    if (existingError) throw existingError
    if (existingUsers && existingUsers.length > 0) {
      return NextResponse.json({ error: 'El email ya está registrado' }, { status: 400 })
    }

    const passwordHash = await hashPassword(password)

    const { data: newUser, error } = await supabase
      .from('users')
      .insert({
        id: randomUUID(),
        email,
        password: passwordHash,
        full_name,
        role,
        active: true,
        created_at: new Date().toISOString(),
      })
      .select(PUBLIC_USER_COLUMNS)
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'El email ya está registrado' }, { status: 400 })
      }
      throw error
    }

    // Si hay una Ejecutiva Comercial con ese email y sin usuario, queda enlazada (para la app de visita y las
    // líneas que ve en el mapa). Un fallo aquí no deshace la creación del usuario: se vuelve a intentar cada vez
    // que se guarda la ejecutiva en /executives (PUT /api/executives/[id]).
    let linkedExecutive: string | null = null
    try {
      linkedExecutive = await linkExecutiveToUserByEmail(newUser.id as string, email)
    } catch (linkError) {
      console.error('Usuario creado, pero no se pudo enlazar con su ejecutiva:', linkError)
    }

    return NextResponse.json({
      user: newUser,
      linkedExecutive,
      message: linkedExecutive
        ? `Usuario creado y enlazado con la Ejecutiva Comercial ${linkedExecutive}`
        : 'Usuario creado exitosamente',
    })
  } catch (error) {
    console.error('Error al crear usuario:', error)
    return NextResponse.json({ error: 'Error al crear usuario' }, { status: 500 })
  }
}
