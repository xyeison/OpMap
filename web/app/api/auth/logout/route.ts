import { NextResponse } from 'next/server'
import { ALL_SESSION_COOKIE_NAMES, sessionCookieOptions } from '@/lib/session'

export const dynamic = 'force-dynamic'

export async function POST() {
  const response = NextResponse.json({ message: 'Logout exitoso' })

  // Borrar la cookie de sesión firmada con sus dos nombres posibles (__Host-opmap_session en
  // producción, opmap_session en desarrollo). La __Host- exige Secure para que el navegador
  // acepte la cabecera que la borra.
  for (const name of ALL_SESSION_COOKIE_NAMES) {
    const forceSecure = name.startsWith('__Host-')
    response.cookies.set(name, '', sessionCookieOptions(0, forceSecure))
  }

  // Limpieza de las cookies del sistema anterior (ya no se aceptan en ninguna ruta)
  response.cookies.set('sb-access-token', '', sessionCookieOptions(0))
  response.cookies.set('sb-refresh-token', '', sessionCookieOptions(0))

  return response
}
