import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Rutas públicas que no requieren autenticación
const publicRoutes = ['/login', '/api/auth/login', '/api/test-connection', '/api/auth/me']

export async function middleware(request: NextRequest) {
  // Verificar si es una ruta pública
  const isPublicRoute = publicRoutes.some(route => 
    request.nextUrl.pathname.startsWith(route)
  )

  // Si es una ruta pública, permitir acceso
  if (isPublicRoute) {
    return NextResponse.next()
  }

  // Crear cliente de Supabase para middleware
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req: request, res })

  // Verificar la sesión
  const { data: { session } } = await supabase.auth.getSession()

  // Si no hay sesión, redirigir a login
  if (!session) {
    const redirectUrl = new URL('/login', request.url)
    // Guardar la URL original para redirigir después del login
    if (request.nextUrl.pathname !== '/') {
      redirectUrl.searchParams.set('redirect', request.nextUrl.pathname)
    }
    return NextResponse.redirect(redirectUrl)
  }

  // Si hay sesión, continuar
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