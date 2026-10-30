// POST /api/auth/sesion-app — un solo ingreso para la web y la app de campo en el navegador (/campo, dueño 2026-10-30,
// docs/specs/2026-10-30-agendamiento-lider-un-ingreso.md). Quien ya inició sesión en OpMap (cookie) y abre la app recibe
// el token que la app necesita, sin volver a escribir su contraseña. Es el MISMO token de la cookie (mismo formato que el
// del login móvil): no da más permisos ni más tiempo.
//   - Exige la cookie de la web: solo con el portador → 401 (no sirve para alargar un token de la app).
//   - Exige el mismo origen: un Origin de otro sitio o Sec-Fetch-Site cross-site → 403 (la cookie es SameSite=Lax y
//     esta ruta es POST, pero se comprueba igual).
//   - Respuesta: LoginMovilResponse { token, expira_at, usuario, ejecutiva }, como el login móvil, sin caché.
import { NextResponse, type NextRequest } from 'next/server'
import { ejecutivaEnlazada, getUserFromRequest, readCookie } from '@/lib/auth-server'
import type { LoginMovilResponse } from '@/lib/reporte-visitas'
import { SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from '@/lib/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Instante ISO en que expira el token (exp del payload; si no se lee, ahora + la duración de la sesión). */
function expiraAt(token: string): string {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString('utf8')) as { exp?: unknown }
    if (typeof payload.exp === 'number' && Number.isFinite(payload.exp)) return new Date(payload.exp * 1000).toISOString()
  } catch {
    // se calcula abajo
  }
  return new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000).toISOString()
}

/** ¿La petición viene de otro sitio? Un Origin distinto del de la petición, o Sec-Fetch-Site que no sea del mismo origen. */
function deOtroSitio(request: NextRequest): boolean {
  const sitio = request.headers.get('sec-fetch-site')
  if (sitio && sitio !== 'same-origin' && sitio !== 'none') return true
  const origen = request.headers.get('origin')
  if (!origen) return false
  try {
    return new URL(origen).host !== new URL(request.url).host
  } catch {
    return true
  }
}

export async function POST(request: NextRequest) {
  if (deOtroSitio(request)) return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })

  const token = readCookie(request, SESSION_COOKIE_NAME)
  if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  try {
    // getUserFromRequest lee la cookie (manda sobre el portador) y valida firma, vencimiento, usuario activo y pv
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    let ejecutiva: LoginMovilResponse['ejecutiva'] = null
    try {
      ejecutiva = await ejecutivaEnlazada(user.id)
    } catch (error) {
      console.error('No se pudo cargar el Ejecutivo Comercial enlazado en /api/auth/sesion-app:', error)
    }
    const respuesta: LoginMovilResponse = {
      token,
      expira_at: expiraAt(token),
      usuario: { id: user.id, full_name: user.full_name, role: user.role },
      ejecutiva,
    }
    return NextResponse.json(respuesta, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('Error en /api/auth/sesion-app:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
