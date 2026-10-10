import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { requirePermission } from '@/lib/require-role'
import { hashPassword } from '@/lib/passwords'
import { SESSION_COOKIE_NAME, passwordVersion, sessionCookieOptions, signSession } from '@/lib/session'
import { UUID_RE, changePasswordSchema, firstIssueMessage } from '@/lib/user-schemas'

export const dynamic = 'force-dynamic'

// PUT - Actualizar contraseña de usuario (solo admin: permiso users:manage)
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requirePermission(request, 'users:manage')
  if (!auth.ok) return auth.response

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

    const parsed = changePasswordSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: firstIssueMessage(parsed.error) }, { status: 400 })
    }

    // Guardar siempre el hash bcrypt, nunca la contraseña en claro
    const passwordHash = await hashPassword(parsed.data.password)

    const { data, error } = await getSupabaseAdmin()
      .from('users')
      .update({ password: passwordHash })
      .eq('id', id)
      .select('id')

    if (error) throw error

    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    const response = NextResponse.json({
      success: true,
      message: 'Contraseña actualizada exitosamente'
    })

    // Cambiar la contraseña revoca todas las sesiones del usuario (claim pv). Si el admin cambia
    // la suya, se le emite una sesión nueva para que no quede desconectado.
    if (id === auth.user.id) {
      response.cookies.set(SESSION_COOKIE_NAME, signSession(id, passwordVersion(passwordHash)), sessionCookieOptions())
    }

    return response
  } catch (error) {
    console.error('Error al actualizar contraseña:', error)
    return NextResponse.json({ error: 'Error al actualizar contraseña' }, { status: 500 })
  }
}
