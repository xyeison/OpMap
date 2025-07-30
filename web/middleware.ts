import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Rutas públicas que no requieren autenticación
const publicRoutes = ['/login', '/api/auth/login', '/api/test-connection', '/api/auth/me']

// Rutas API que manejan su propia autenticación
const apiRoutesWithOwnAuth = ['/api/visits', '/api/users', '/api/hospitals', '/api/kams', '/api/assignments', '/api/contracts']

export async function middleware(request: NextRequest) {
  // Verificar si es una ruta pública
  const isPublicRoute = publicRoutes.some(route => 
    request.nextUrl.pathname.startsWith(route)
  )

  // Si es una ruta pública, permitir acceso
  if (isPublicRoute) {
    return NextResponse.next()
  }

  // Verificar si es una ruta API que maneja su propia autenticación
  const isApiRouteWithOwnAuth = apiRoutesWithOwnAuth.some(route =>
    request.nextUrl.pathname.startsWith(route)
  )

  // Si es una ruta API con su propia autenticación, permitir acceso
  if (isApiRouteWithOwnAuth) {
    return NextResponse.next()
  }

  // Verificar si hay algún tipo de autenticación
  const customToken = request.cookies.get('sb-access-token')
  
  // Si hay token personalizado, permitir acceso
  if (customToken) {
    return NextResponse.next()
  }
  
  // Si no, verificar con Supabase Auth
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req: request, res })
  const { data: { session } } = await supabase.auth.getSession()

  // Si no hay ningún tipo de sesión, redirigir a login
  if (!session) {
    const redirectUrl = new URL('/login', request.url)
    if (request.nextUrl.pathname !== '/') {
      redirectUrl.searchParams.set('redirect', request.nextUrl.pathname)
    }
    return NextResponse.redirect(redirectUrl)
  }

  return res
}

// Configurar las rutas que el middleware debe interceptar
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (auth endpoints)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}