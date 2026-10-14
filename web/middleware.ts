import { NextResponse, type NextRequest } from 'next/server'
import { SESSION_COOKIE_NAME } from '@/lib/session-config'
import { verifySessionEdge } from '@/lib/session-edge'

// Autenticación global (Edge runtime). Solo comprueba la firma y la expiración de la cookie de
// sesión (SESSION_COOKIE_NAME: __Host-opmap_session en producción, opmap_session en desarrollo) o,
// SOLO en /api/* y sin cookie, del token de portador de la app móvil ("Authorization: Bearer"),
// sin consultar la BD. NO valida el claim pv (revocación al cambiar la contraseña) ni el rol ni el
// estado activo: eso lo hace cada ruta API con requireUser/requirePermission
// (lib/require-role.ts -> getUserFromRequest). Una sesión revocada puede seguir cargando el HTML
// de las páginas, pero sus llamadas a /api/* reciben 401.
//
// CORS solo en desarrollo (NODE_ENV !== 'production') y solo para la app en React Native Web
// (http://localhost:8081 y http://127.0.0.1:8081), para verificarla en el navegador contra el
// servidor local. En producción no se emite ninguna cabecera CORS: las apps nativas no la
// necesitan (decisión 2 de docs/fases/fase8-visitas-f3-f4-reporte-y-app-movil.md).

// Rutas API accesibles sin sesión (coincidencia exacta)
const PUBLIC_API_ROUTES = new Set(['/api/auth/login', '/api/auth/logout'])

// Prefijos API públicos: polígonos GeoJSON (datos públicos) y cargas automáticas de Vercel Cron.
// /api/cron/* NO es público de verdad: Vercel Cron no manda cookie de sesión, así que la ruta
// (app/api/cron/[fuente]/route.ts) exige "Authorization: Bearer <CRON_SECRET>" y sin esa variable no hace nada.
const PUBLIC_API_PREFIXES = ['/api/geojson/', '/api/cron/']

// Orígenes del desarrollo de la app móvil (React Native Web). Nunca en producción.
const CORS_ORIGENES_DESARROLLO = new Set(['http://localhost:8081', 'http://127.0.0.1:8081'])
const CORS_ALLOW_HEADERS = 'authorization, content-type'
const CORS_ALLOW_METHODS = 'GET, POST, PATCH, DELETE, OPTIONS'

const BEARER_RE = /^Bearer\s+(\S+)$/i

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

/** Token de "Authorization: Bearer <token>", o undefined. Se lee en cada petición (nunca de la BD). */
function bearerToken(request: NextRequest): string | undefined {
  const header = request.headers.get('authorization')
  if (!header) return undefined
  const match = BEARER_RE.exec(header.trim())
  return match ? match[1] : undefined
}

/**
 * Origen al que se le responde CORS: solo en desarrollo, solo en /api/* y solo si el Origin pedido está en la
 * lista. En cualquier otro caso null (ninguna cabecera CORS). Se evalúa en cada petición para que las pruebas
 * puedan cambiar NODE_ENV; en el Edge, Next inserta NODE_ENV al compilar.
 */
function corsOrigin(request: NextRequest, isApi: boolean): string | null {
  if (!isApi || process.env.NODE_ENV === 'production') return null
  const origin = request.headers.get('origin')
  return origin && CORS_ORIGENES_DESARROLLO.has(origin) ? origin : null
}

/** Añade las cabeceras CORS a la respuesta (solo cuando corsOrigin devolvió un origen). */
function withCors<T extends Response>(response: T, origin: string | null): T {
  if (!origin) return response
  response.headers.set('Access-Control-Allow-Origin', origin)
  response.headers.set('Access-Control-Allow-Headers', CORS_ALLOW_HEADERS)
  response.headers.set('Access-Control-Allow-Methods', CORS_ALLOW_METHODS)
  response.headers.append('Vary', 'Origin')
  return response
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isApi = isApiPath(pathname)
  const origin = corsOrigin(request, isApi)

  // Preflight del navegador en desarrollo: sin credenciales y sin pasar por la ruta
  if (origin && request.method === 'OPTIONS') {
    return withCors(new NextResponse(null, { status: 204 }), origin)
  }

  if (isApi ? isPublicApi(pathname) : isPublicPage(pathname)) {
    return withCors(NextResponse.next(), origin)
  }

  let hasValidSession = false
  try {
    // La cookie manda; sin cookie, el portador solo vale en /api/* (las páginas nunca lo aceptan)
    const token = request.cookies.get(SESSION_COOKIE_NAME)?.value || (isApi ? bearerToken(request) : undefined)
    hasValidSession = (await verifySessionEdge(token)) !== null
  } catch (error) {
    // Falta SESSION_SECRET en producción u otro error de configuración: denegar (fail closed)
    console.error('Error verificando la sesión en el middleware:', error)
    return withCors(
      isApi
        ? NextResponse.json({ error: 'Error de configuración del servidor' }, { status: 500 })
        : new NextResponse('Error de configuración del servidor', { status: 500 }),
      origin
    )
  }

  if (hasValidSession) {
    return withCors(NextResponse.next(), origin)
  }

  if (isApi) {
    return withCors(NextResponse.json({ error: 'No autorizado' }, { status: 401 }), origin)
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
