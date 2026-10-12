import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { requirePermission } from '@/lib/require-role'
import { UUID_RE, firstIssueMessage, updateUserSchema } from '@/lib/user-schemas'
import { linkExecutiveToUserByEmail } from '../../executives/_lib/executive-shared'

export const dynamic = 'force-dynamic'

const PUBLIC_USER_COLUMNS = 'id, email, full_name, role, active, created_at'

async function countActiveAdmins(): Promise<number> {
  const { count, error } = await getSupabaseAdmin()
    .from('users')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'admin')
    .eq('active', true)

  if (error) throw error
  return count ?? 0
}

// PUT - Actualizar usuario (solo admin: permiso users:manage)
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requirePermission(request, 'users:manage')
  if (!auth.ok) return auth.response
  const currentUser = auth.user

  try {
    const { id } = params
    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: 'ID de usuario no válido' }, { status: 400 })
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Cuerpo de la petición no válido' }, { status: 400 })
    }

    // Allow-list de campos: password, id, created_at, etc. nunca se escriben desde aquí
    const parsed = updateUserSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos no válidos', details: firstIssueMessage(parsed.error) },
        { status: 400 }
      )
    }
    const updates = parsed.data

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No hay campos para actualizar' }, { status: 400 })
    }

    // No permitir que el admin se desactive a sí mismo
    if (currentUser.id === id && updates.active === false) {
      return NextResponse.json({ error: 'No puedes desactivarte a ti mismo' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    // No dejar el sistema sin administradores activos
    const removesAdmin = (updates.role !== undefined && updates.role !== 'admin') || updates.active === false
    if (removesAdmin) {
      const { data: userToUpdate, error: targetError } = await supabase
        .from('users')
        .select('role, active')
        .eq('id', id)
        .maybeSingle()

      if (targetError) throw targetError
      if (!userToUpdate) {
        return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
      }

      if (userToUpdate.role === 'admin' && userToUpdate.active && (await countActiveAdmins()) <= 1) {
        return NextResponse.json(
          { error: 'No puedes cambiar el rol ni desactivar al último administrador' },
          { status: 400 }
        )
      }
    }

    const { data: updatedUser, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', id)
      .select(PUBLIC_USER_COLUMNS)
      .maybeSingle()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'El email ya está registrado' }, { status: 400 })
      }
      console.error('Error de Supabase al actualizar usuario:', error.message)
      return NextResponse.json({ error: 'Error al actualizar usuario' }, { status: 500 })
    }

    if (!updatedUser) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    // Al cambiar el email, si coincide con una Ejecutiva Comercial sin usuario, queda enlazada.
    let linkedExecutive: string | null = null
    if (updates.email !== undefined) {
      try {
        linkedExecutive = await linkExecutiveToUserByEmail(updatedUser.id as string, updatedUser.email as string)
      } catch (linkError) {
        console.error('Usuario actualizado, pero no se pudo enlazar con su ejecutiva:', linkError)
      }
    }

    return NextResponse.json({
      user: updatedUser,
      linkedExecutive,
      message: linkedExecutive
        ? `Usuario actualizado y enlazado con la Ejecutiva Comercial ${linkedExecutive}`
        : 'Usuario actualizado exitosamente',
    })
  } catch (error) {
    console.error('Error al actualizar usuario:', error)
    return NextResponse.json({ error: 'Error al actualizar usuario' }, { status: 500 })
  }
}

// DELETE - Eliminar usuario (desactivar). Solo admin: permiso users:manage
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requirePermission(request, 'users:manage')
  if (!auth.ok) return auth.response
  const currentUser = auth.user

  try {
    const { id } = params
    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: 'ID de usuario no válido' }, { status: 400 })
    }

    // No permitir que el admin se elimine a sí mismo
    if (currentUser.id === id) {
      return NextResponse.json({ error: 'No puedes eliminarte a ti mismo' }, { status: 400 })
    }

    // Desactivar usuario en lugar de eliminarlo
    const { data, error } = await getSupabaseAdmin()
      .from('users')
      .update({ active: false })
      .eq('id', id)
      .select('id')

    if (error) {
      console.error('Error de Supabase al desactivar usuario:', error.message)
      return NextResponse.json({ error: 'Error al desactivar usuario' }, { status: 500 })
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    return NextResponse.json({ message: 'Usuario desactivado exitosamente' })
  } catch (error) {
    console.error('Error al eliminar usuario:', error)
    return NextResponse.json({ error: 'Error al eliminar usuario' }, { status: 500 })
  }
}
