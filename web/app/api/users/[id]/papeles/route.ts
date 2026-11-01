// PUT /api/users/[id]/papeles — los papeles de una persona en UNA empresa (empresas, capa 1; spec
// docs/specs/2026-10-31-empresas-papeles-y-asignaciones.md). Cuerpo { empresa_id, papeles: PapelEntrada[] }: la lista
// reemplaza lo que tiene en esa empresa (lib/empresas.ts → reemplazarPapeles). ?simular=1 solo cuenta lo que se pierde
// al quitar sales_manager (asignaciones y visitantes) y no escribe nada. Solo users:manage (administrador).
//   200 { papeles, afectados } · 400 cuerpo o línea fuera de la empresa · 404 usuario o empresa
//   409 líder nacional repetido o Zonas solapadas · 503 sin la 0960. Si se borraron executive_lines (quitar
//   sales_manager en VG) la cobertura se recalcula: cobertura_recalculada true, o false con aviso si falló.
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/require-role'
import { Falta0960Error, MENSAJE_FALTA_0960, dejaSinAdministradores, reemplazarPapeles } from '@/lib/empresas'
import { UUID_RE, firstIssueMessage, papelesPutSchema } from '@/lib/user-schemas'
import { AVISO_COBERTURA_SIN_RECALCULAR } from '../../../executives/_lib/executive-shared'

export const dynamic = 'force-dynamic'

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(request, 'users:manage')
  if (!auth.ok) return auth.response

  try {
    const { id } = params
    if (!UUID_RE.test(id)) return NextResponse.json({ error: 'ID de usuario no válido' }, { status: 400 })

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Cuerpo de la petición no válido' }, { status: 400 })
    }
    const parsed = papelesPutSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: firstIssueMessage(parsed.error) }, { status: 400 })
    const { empresa_id: empresaId, papeles } = parsed.data
    const simular = ['1', 'true'].includes(request.nextUrl.searchParams.get('simular') ?? '')
    const userId = id.toLowerCase()

    // No dejar OpMap sin administradores activos
    if (!papeles.some(p => p.papel === 'admin') && (await dejaSinAdministradores(userId, empresaId)) === true) {
      return NextResponse.json({ error: 'No puedes quitarle el papel de administrador al último administrador' }, { status: 400 })
    }

    const resultado = await reemplazarPapeles({ userId, empresaId, papeles, creadoPor: auth.user.id, simular })
    if (!resultado.ok) return NextResponse.json({ error: resultado.error }, { status: resultado.status })
    // Si se borraron executive_lines (quitar sales_manager en VG), si se recalculó la cobertura y el aviso si falló
    const cobertura =
      resultado.cobertura_recalculada === undefined
        ? {}
        : resultado.cobertura_recalculada
          ? { cobertura_recalculada: true }
          : { cobertura_recalculada: false, aviso: AVISO_COBERTURA_SIN_RECALCULAR }
    return NextResponse.json({ papeles: resultado.papeles, afectados: resultado.afectados, ...cobertura })
  } catch (error) {
    if (error instanceof Falta0960Error) return NextResponse.json({ error: MENSAJE_FALTA_0960 }, { status: 503 })
    console.error('Error en PUT /api/users/[id]/papeles:', error)
    return NextResponse.json({ error: 'Error al guardar los papeles' }, { status: 500 })
  }
}
