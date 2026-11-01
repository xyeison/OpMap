import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { requirePermission } from '@/lib/require-role'
import { UUID_RE, firstIssueMessage, updateUserSchema } from '@/lib/user-schemas'
import { linkExecutiveToUserByEmail } from '../../executives/_lib/executive-shared'
import { EMPRESA_VG_ID, type PapelEntrada } from '@/lib/empresas-reglas'
import { Falta0960Error, dejaSinAdministradores, reemplazarPapeles } from '@/lib/empresas'

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

/** false si existe la tabla papeles (0960 aplicada); 'sin_tabla' si no. Mismo valor que dejaSinAdministradores sin admin. */
async function papelesDisponibles(): Promise<false | 'sin_tabla'> {
  const { error } = await getSupabaseAdmin().from('papeles').select('id').limit(1)
  if (error?.code === '42P01' || error?.code === 'PGRST205') return 'sin_tabla'
  if (error) throw error
  return false
}

/** El rol de la página vieja como papeles en VG (ver el comentario del PUT). */
async function rolComoPapelesDeVG(userId: string, role: PapelEntrada['papel'], creadoPor: string) {
  const { data, error } = await getSupabaseAdmin()
    .from('papeles')
    .select('id, line_id')
    .eq('user_id', userId)
    .eq('empresa_id', EMPRESA_VG_ID)
    .eq('papel', 'line_leader')
    .eq('activo', true)
  if (error) throw error
  let papeles: PapelEntrada[]
  if (role === 'line_leader') {
    const lideres = (data || []) as { id: string; line_id: string }[]
    if (lideres.length === 0) {
      return { ok: false as const, status: 400, error: 'Un líder de negocio necesita su línea: dale el papel con su línea' }
    }
    const { data: zonas, error: zonasError } = await getSupabaseAdmin()
      .from('papel_zonas')
      .select('papel_id, kam_id')
      .in('papel_id', lideres.map(l => l.id))
    if (zonasError) throw zonasError
    papeles = lideres.map(l => ({
      papel: 'line_leader' as const,
      line_id: l.line_id,
      kam_ids: ((zonas || []) as { papel_id: string; kam_id: string }[]).filter(z => z.papel_id === l.id).map(z => z.kam_id),
    }))
  } else {
    papeles = [{ papel: role }]
  }
  return reemplazarPapeles({ userId, empresaId: EMPRESA_VG_ID, papeles, creadoPor })
}

// PUT - Actualizar usuario (solo admin: permiso users:manage). Con la 0960, role ya no se escribe directo: pasa a ser
// el papel de la persona en VG (reemplazarPapeles; para la página vieja de /users hasta la tarea 8 de la capa 1):
// 'line_leader' conserva sus papeles de líder en VG (sin ninguno, 400: falta la línea); otro rol reemplaza todos sus
// papeles de VG por ese. users.role queda como caché. Sin la 0960, como antes.
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

    // No dejar el sistema sin administradores activos: con la 0960 cuentan los papeles admin (de cualquier empresa)
    const quitaAdminEnVG = updates.role !== undefined && updates.role !== 'admin'
    const conPapeles =
      quitaAdminEnVG || updates.active === false
        ? await dejaSinAdministradores(id.toLowerCase(), updates.active === false ? null : EMPRESA_VG_ID)
        : await papelesDisponibles()
    if (conPapeles === true) {
      return NextResponse.json(
        { error: 'No puedes cambiar el rol ni desactivar al último administrador' },
        { status: 400 }
      )
    }
    const sinTabla = conPapeles === 'sin_tabla'

    const removesAdmin = sinTabla && (quitaAdminEnVG || updates.active === false)
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

    // El rol pasa por los papeles de VG (y su caché users.role); el resto de campos, directo a users
    const { role, ...otros } = updates
    const campos = sinTabla ? updates : otros
    if (!sinTabla && role !== undefined) {
      const resultado = await rolComoPapelesDeVG(id, role, currentUser.id)
      if (!resultado.ok) return NextResponse.json({ error: resultado.error }, { status: resultado.status })
    }

    const { data: updatedUser, error } =
      Object.keys(campos).length > 0
        ? await supabase.from('users').update(campos).eq('id', id).select(PUBLIC_USER_COLUMNS).maybeSingle()
        : await supabase.from('users').select(PUBLIC_USER_COLUMNS).eq('id', id).maybeSingle()

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
    if (error instanceof Falta0960Error) return NextResponse.json({ error: 'Falta aplicar la migración 0960' }, { status: 503 })
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
