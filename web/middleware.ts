import { NextResponse, type NextRequest } from 'next/server'
import { SESSION_COOKIE_NAME } from '@/lib/session-config'
import { verifySessionEdge } from '@/lib/session-edge'

// Autenticación global (Edge runtime). Solo comprueba la firma y la expiración de la cookie de
// sesión (SESSION_COOKIE_NAME: __Host-opmap_session en producción, opmap_session en desarrollo),
// sin consultar la BD. NO valida el claim pv (revocación al cambiar la contraseña) ni el rol ni el
// estado activo: eso lo hace cada ruta API con requireUser/requirePermission
// (lib/require-role.ts -> getUserFromRequest). Una sesión revocada puede seguir cargando el HTML
// de las páginas, pero sus llamadas a /api/* reciben 401.

// Rutas API accesibles sin sesión (coincidencia exacta)
const PUBLIC_API_ROUTES = new Set(['/api/auth/login', '/api/auth/logout'])

// Prefijos API públicos: polígonos GeoJSON (datos públicos) y cargas automáticas de Vercel Cron.
// /api/cron/* NO es público de verdad: Vercel Cron no manda cookie de sesión, así que la ruta
// (app/api/cron/[fuente]/route.ts) exige "Authorization: Bearer <CRON_SECRET>" y sin esa variable no hace nada.
const PUBLIC_API_PREFIXES = ['/api/geojson/', '/api/cron/']

function isApiPath(pathname: string): boolean {
  const lower = pathname.toLowerCase()
  return lower === '/api' || lower.startsWith('/api/')
}

function isPublicApi(pathname: string): boolean {
  return PUBLIC_API_ROUTES.has(pathname) || PUBLIC_API_PREFIXES.some(prefix => pathname.startsWith(prefix))
}

// Archivos estáticos de /public: solo extensiones conocidas. Una ruta de página con un punto
// en un parámetro (p. ej. /hospitals/abc.def) NO se considera estática y exige sesión.
// Mantener sincronizada con la lista del matcher de `config` (abajo).
const STATIC_FILE_RE = /\.(ico|png|jpe?g|svg|webp|gif|css|js|map|txt|xml|json|woff2?|ttf)$/i

function isPublicPage(pathname: string): boolean {
  return (
    pathname === '/login' ||
    pathname.startsWith('/login/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/__nextjs') ||
    pathname === '/favicon.ico' ||
    // Archivos estáticos de /public (solo extensiones conocidas)
    STATIC_FILE_RE.test(pathname)
  )
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isApi = isApiPath(pathname)

  if (isApi ? isPublicApi(pathname) : isPublicPage(pathname)) {
    return NextResponse.next()
  }

  let hasValidSession = false
  try {
    const token = request.cookies.get(SESSION_COOKIE_NAME)?.value
    hasValidSession = (await verifySessionEdge(token)) !== null
  } catch (error) {
    // Falta SESSION_SECRET en producción u otro error de configuración: denegar (fail closed)
    console.error('Error verificando la sesión en el middleware:', error)
    return isApi
      ? NextResponse.json({ error: 'Error de configuración del servidor' }, { status: 500 })
      : new NextResponse('Error de configuración del servidor', { status: 500 })
  }

  if (hasValidSession) {
    return NextResponse.next()
  }

  if (isApi) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  // Volver a la ruta original tras el login (sin el parámetro interno _rsc de Next)
  const nextParams = new URLSearchParams(request.nextUrl.search)
  nextParams.delete('_rsc')
  const nextQuery = nextParams.toString()

  const loginUrl = new URL('/login', request.url)
  loginUrl.searchParams.set('next', nextQuery ? `${pathname}?${nextQuery}` : pathname)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: [
    // Todas las rutas API (incluidas las que contienen puntos en sus parámetros)
    '/api/:path*',
    // Páginas: todo salvo API, assets internos de Next, favicon y archivos estáticos con las
    // mismas extensiones que STATIC_FILE_RE. Limitación: el matcher no admite el flag /i, así que
    // aquí solo se excluyen en minúsculas; las variantes en mayúsculas (.PNG) entran al
    // middleware y las deja pasar isPublicPage (STATIC_FILE_RE sí es insensible a mayúsculas).
    '/((?!api|_next/static|_next/image|favicon\\.ico|.*\\.(?:ico|png|jpg|jpeg|svg|webp|gif|css|js|map|txt|xml|json|woff|woff2|ttf)$).*)',
  ],
}
