import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { requirePermission } from '@/lib/require-role'
import { hashPassword } from '@/lib/passwords'
import { createUserSchema, firstIssueMessage } from '@/lib/user-schemas'
import { EMPRESA_VG_ID, type PapelEntrada } from '@/lib/empresas-reglas'
import { Falta0960Error, asegurarExecutiveEmpresa, papelesDeTodos, reemplazarPapeles, validarPapeles } from '@/lib/empresas'
import { linkExecutiveToUserByEmail } from '../executives/_lib/executive-shared'

export const dynamic = 'force-dynamic'

const PUBLIC_USER_COLUMNS = 'id, email, full_name, role, active, created_at'

// GET - Listar todos los usuarios (solo admin: permiso users:manage), cada uno con sus papeles activos en todas sus
// empresas (papeles: PapelActivo[]; [] para todos sin la 0960)
export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'users:manage')
  if (!auth.ok) return auth.response

  try {
    const { data: users, error } = await getSupabaseAdmin()
      .from('users')
      .select(PUBLIC_USER_COLUMNS)
      .order('created_at', { ascending: false })

    if (error) throw error

    const papeles = await papelesDeTodos()
    const conPapeles = (users || []).map(user => ({
      ...user,
      papeles: papeles === 'sin_tabla' ? [] : papeles.get(user.id as string) ?? [],
    }))
    return NextResponse.json({ users: conPapeles })
  } catch (error) {
    console.error('Error al obtener usuarios:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

// POST - Crear nuevo usuario (solo admin: permiso users:manage). Con papeles ({ empresa_id, papel, line_id?, kam_ids? }[])
// se le dan esos; con solo role, ese papel en VG (como antes de las empresas). users.role es la caché que escriben los
// papeles. Sin la 0960, solo users.role. Los papeles se validan ANTES de crear al usuario; si aun así fallan al
// guardarse, el usuario recién creado se borra.
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
    const { email, password, full_name, role, papeles } = parsed.data

    const supabase = getSupabaseAdmin()

    // ¿Está la 0960? Sin ella, como antes: users.role y nada más (los papeles no se pueden guardar)
    const sondeo = await supabase.from('papeles').select('id').limit(1)
    const conPapeles = !esTablaAusente(sondeo.error)
    if (sondeo.error && conPapeles) throw sondeo.error
    if (!conPapeles && papeles) {
      return NextResponse.json({ error: 'Falta aplicar la migración 0960' }, { status: 503 })
    }

    // Papeles por empresa: los dados, o role en VG
    const porEmpresa = new Map<string, PapelEntrada[]>()
    if (conPapeles) {
      if (papeles) {
        for (const { empresa_id, ...papel } of papeles) porEmpresa.set(empresa_id, [...(porEmpresa.get(empresa_id) ?? []), papel])
      } else if (role === 'line_leader') {
        return NextResponse.json(
          { error: 'Un líder de negocio necesita su línea: créalo con sus papeles (línea y, si aplica, Zonas)' },
          { status: 400 }
        )
      } else if (role) {
        porEmpresa.set(EMPRESA_VG_ID, [{ papel: role }])
      }
    }

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

    // Validar todos los papeles antes de crear nada (el id nuevo no choca con nadie)
    const nuevoId = randomUUID()
    for (const [empresaId, lista] of Array.from(porEmpresa.entries())) {
      const valido = await validarPapeles({ userId: nuevoId, empresaId, papeles: lista })
      if (!valido.ok) return NextResponse.json({ error: valido.error }, { status: valido.status })
    }

    const passwordHash = await hashPassword(password)

    const { data: newUser, error } = await supabase
      .from('users')
      .insert({
        id: nuevoId,
        email,
        password: passwordHash,
        full_name,
        // Con papeles, la caché la reescribe reemplazarPapeles; 'user' mientras tanto
        role: conPapeles ? 'user' : role ?? 'user',
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

    let user = newUser
    if (porEmpresa.size > 0) {
      for (const [empresaId, lista] of Array.from(porEmpresa.entries())) {
        const resultado = await reemplazarPapeles({ userId: nuevoId, empresaId, papeles: lista, creadoPor: auth.user.id })
        if (!resultado.ok) {
          // Otra persona tomó la línea o las Zonas entre la validación y la escritura: no queda un usuario a medias
          await borrarUsuarioRecienCreado(nuevoId)
          return NextResponse.json({ error: resultado.error }, { status: resultado.status })
        }
      }
      const { data: releido, error: releerError } = await supabase.from('users').select(PUBLIC_USER_COLUMNS).eq('id', nuevoId).single()
      if (releerError) throw releerError
      user = releido
    }

    // Si hay una Ejecutiva Comercial con ese email y sin usuario, queda enlazada (para la app de visita y las
    // líneas que ve en el mapa). Un fallo aquí no deshace la creación del usuario: se vuelve a intentar cada vez
    // que se guarda la ejecutiva en /executives (PUT /api/executives/[id]).
    let linkedExecutive: string | null = null
    try {
      linkedExecutive = await linkExecutiveToUserByEmail(nuevoId, email)
      // La ejecutiva recién enlazada queda en las empresas donde el usuario es Ejecutivo Comercial (executive_empresas)
      const empresasEjecutivo = Array.from(porEmpresa.entries())
        .filter(([, lista]) => lista.some(p => p.papel === 'sales_manager'))
        .map(([empresaId]) => empresaId)
      if (linkedExecutive && empresasEjecutivo.length > 0) {
        const { data: enlazadas, error: enlazadasError } = await supabase.from('executives').select('id').eq('user_id', nuevoId)
        if (enlazadasError) throw enlazadasError
        for (const { id: executiveId } of (enlazadas || []) as { id: string }[]) {
          for (const empresaId of empresasEjecutivo) await asegurarExecutiveEmpresa(executiveId, empresaId)
        }
      }
    } catch (linkError) {
      console.error('Usuario creado, pero no se pudo enlazar con su ejecutiva:', linkError)
    }

    return NextResponse.json({
      user,
      linkedExecutive,
      message: linkedExecutive
        ? `Usuario creado y enlazado con la Ejecutiva Comercial ${linkedExecutive}`
        : 'Usuario creado exitosamente',
    })
  } catch (error) {
    if (error instanceof Falta0960Error) return NextResponse.json({ error: 'Falta aplicar la migración 0960' }, { status: 503 })
    console.error('Error al crear usuario:', error)
    return NextResponse.json({ error: 'Error al crear usuario' }, { status: 500 })
  }
}

function esTablaAusente(error: { code?: string } | null): boolean {
  return error?.code === '42P01' || error?.code === 'PGRST205'
}

/** Deshace la creación (sus papeles se van en cascada). Un fallo aquí solo se registra: la respuesta ya es el error. */
async function borrarUsuarioRecienCreado(userId: string): Promise<void> {
  const { error } = await getSupabaseAdmin().from('users').delete().eq('id', userId)
  if (error) console.error('No se pudo borrar el usuario a medio crear:', error.message)
}
