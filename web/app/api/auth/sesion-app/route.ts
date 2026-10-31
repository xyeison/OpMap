// POST /api/auth/sesion-app — un solo ingreso para la web y la app de campo en el navegador (/campo, dueño 2026-10-30,
// docs/specs/2026-10-30-agendamiento-lider-un-ingreso.md). Quien ya inició sesión en OpMap (cookie) y abre la app recibe
// el token que la app necesita, sin volver a escribir su contraseña. Es el MISMO token de la cookie (mismo formato que el
// del login móvil): no da más permisos ni más tiempo. Si su claim emp no es la empresa activa (capa 1 de empresas), se
// refirma con ella y con el mismo uid, pv y vencimiento.
//   - Exige la cookie de la web: solo con el portador → 401 (no sirve para alargar un token de la app).
//   - Solo para quien usa la app de campo (campo:app declarado en alguno de sus papeles de la empresa activa, las
//     líderes: el mismo criterio del menú "Agendamiento"); los demás roles → 403 (revisión 2026-10-30): la cookie
//     httpOnly del administrador o de la dirección no se vuelve un token que el JavaScript de la página puede leer. Con
//     varios papeles (capa 1 de empresas) eso vale para quien tenga un papel activo de administrador o de dirección
//     comercial en CUALQUIER empresa, aunque también sea líder: 403 (el token sumaría ese poder y con él podría pasarse
//     de empresa con POST /api/auth/empresa). Los demás entran a la app con su contraseña, como siempre.
//   - Exige el mismo origen: un Origin de otro sitio o Sec-Fetch-Site cross-site → 403 (la cookie es SameSite=Lax y
//     esta ruta es POST, pero se comprueba igual).
//   - Respuesta: LoginMovilResponse { token, expira_at, usuario, ejecutiva }, como el login móvil, sin caché.
import { NextResponse, type NextRequest } from 'next/server'
import { ejecutivaEnlazada, getUserFromRequest, readCookie, type SessionUser } from '@/lib/auth-server'
import { rolePermissions, type Role } from '@/lib/permissions'
import { cargarPapelesDeUsuario, empresasDeSesion } from '@/lib/empresas'
import type { LoginMovilResponse } from '@/lib/reporte-visitas'
import { SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS, refirmarSesion, verifySession } from '@/lib/session'

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

/** Papeles cuya cookie nunca se vuelve un token legible desde la página (revisión 2026-10-30). */
const PAPELES_SIN_PUENTE: ReadonlySet<Role> = new Set<Role>(['admin', 'commercial_director'])

/**
 * Los papeles activos de la persona en TODAS sus empresas activas. Sin empresas (sin la 0960, o sin papeles) basta
 * con los de la sesión (sin la 0960, users.role como único papel) y no se consulta nada más.
 */
async function papelesDeTodasLasEmpresas(user: SessionUser): Promise<readonly { papel: Role }[]> {
  if (user.empresas.length === 0) return user.papeles
  const cargado = await cargarPapelesDeUsuario(user.id)
  return cargado === 'sin_tabla' ? user.papeles : cargado.papeles
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
    // La suma de sus papeles en la empresa activa, con el permiso DECLARADO de cada papel y no tienePermiso/hasPermission:
    // esos dejan pasar al administrador (lo tiene todo) y su cookie no debe volverse un token legible.
    const usaLaApp = user.papeles.some(p => (rolePermissions[p.papel] ?? []).includes('campo:app'))
    if (!usaLaApp) return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
    // Y nadie con un papel activo de administrador o de dirección en NINGUNA empresa (no solo en la activa): el token de
    // la app sumaría ese poder (requirePermission suma papeles) y con él podría pasarse a la empresa donde lo es
    // (POST /api/auth/empresa). Entra a la app con su contraseña (login móvil), como siempre.
    if ((await papelesDeTodasLasEmpresas(user)).some(p => PAPELES_SIN_PUENTE.has(p.papel))) {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
    }

    // El claim emp con la empresa activa resuelta: el mismo token si ya la trae; si no, refirmado con el mismo uid, pv y
    // vencimiento (refirmarSesion: no da más tiempo).
    const emp = user.empresa?.id ?? null
    const tokenApp = (verifySession(token)?.emp ?? null) === emp ? token : (refirmarSesion(token, emp)?.token ?? token)

    let ejecutiva: LoginMovilResponse['ejecutiva'] = null
    try {
      ejecutiva = await ejecutivaEnlazada(user.id)
    } catch (error) {
      console.error('No se pudo cargar el Ejecutivo Comercial enlazado en /api/auth/sesion-app:', error)
    }
    const respuesta: LoginMovilResponse = {
      token: tokenApp,
      expira_at: expiraAt(tokenApp),
      usuario: { id: user.id, full_name: user.full_name, role: user.role, ...empresasDeSesion(user) },
      ejecutiva,
    }
    return NextResponse.json(respuesta, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('Error en /api/auth/sesion-app:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
