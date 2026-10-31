// POST /api/auth/empresa { empresa_id }: cambia la empresa activa de la persona (capa 1 de empresas,
// docs/specs/2026-10-31-empresas-papeles-y-asignaciones.md). Solo a una empresa donde tenga un papel activo
// (cambiarEmpresaActiva escribe users.empresa_activa_id, que es lo que manda). El claim emp del token es una caché y se
// pone al día: con la cookie de la web, la cookie se refirma ({ empresa }); con el portador de la app (sesionDeLaApp),
// el token nuevo va en el cuerpo ({ empresa, token, expira_at }). Refirmar conserva uid, pv y vencimiento: cambiar de
// empresa no alarga la sesión.
//   401 sin sesión · 400 cuerpo inválido · 403 'No tienes papel en esa empresa' (tampoco escribe ni refirma).
import { NextResponse, type NextRequest } from 'next/server'
import { getUserFromRequest, readSessionToken, sesionDeLaApp } from '@/lib/auth-server'
import { cambiarEmpresaActiva, empresaMovil } from '@/lib/empresas'
import { SESSION_COOKIE_NAME, refirmarSesion, sessionCookieOptions } from '@/lib/session'
import { UUID_RE } from '@/lib/session-config'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MENSAJE_SIN_PAPEL_EN_EMPRESA = 'No tienes papel en esa empresa'

const noAutorizado = () => NextResponse.json({ error: 'No autorizado' }, { status: 401 })

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return noAutorizado()

    let cuerpo: unknown
    try {
      cuerpo = await request.json()
    } catch {
      return NextResponse.json({ error: 'Cuerpo de la petición no válido' }, { status: 400 })
    }
    if (!cuerpo || typeof cuerpo !== 'object' || Array.isArray(cuerpo)) {
      return NextResponse.json({ error: 'Cuerpo de la petición no válido' }, { status: 400 })
    }
    const empresaId = (cuerpo as { empresa_id?: unknown }).empresa_id
    if (typeof empresaId !== 'string' || !UUID_RE.test(empresaId)) {
      return NextResponse.json({ error: 'empresa_id no válido' }, { status: 400 })
    }

    const empresa = await cambiarEmpresaActiva(user.id, empresaId)
    if (empresa === 'sin_papel') return NextResponse.json({ error: MENSAJE_SIN_PAPEL_EN_EMPRESA }, { status: 403 })

    // El mismo token con el que entró (getUserFromRequest ya validó firma, vencimiento, usuario activo y pv)
    const refirmado = refirmarSesion(readSessionToken(request), empresa.id)
    if (!refirmado) return noAutorizado()
    const cabeceras = { 'Cache-Control': 'no-store' }

    if (sesionDeLaApp(request)) {
      const expiraAt = new Date(refirmado.exp * 1000).toISOString()
      return NextResponse.json({ empresa: empresaMovil(empresa), token: refirmado.token, expira_at: expiraAt }, { headers: cabeceras })
    }
    const response = NextResponse.json({ empresa: empresaMovil(empresa) }, { headers: cabeceras })
    const restantes = Math.max(0, refirmado.exp - Math.floor(Date.now() / 1000))
    response.cookies.set(SESSION_COOKIE_NAME, refirmado.token, sessionCookieOptions(restantes))
    return response
  } catch (error) {
    console.error('Error en POST /api/auth/empresa:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
