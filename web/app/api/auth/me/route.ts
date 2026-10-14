// GET /api/auth/me: el usuario de la sesión (cookie de la web o, sin cookie, el token de portador de la app
// móvil) y el Ejecutivo Comercial enlazado con él (id, full_name, zona) o null. `user` es lo que ya usaba la
// web (contexts/UserContext.tsx); `ejecutiva` es lo que la app necesita al abrir. Forma: MeResponse en
// lib/reporte-visitas.ts. Si la base falla al buscar la ejecutiva, se responde igual con ejecutiva null.
import { NextResponse, NextRequest } from 'next/server'
import { ejecutivaEnlazada, getUserFromRequest } from '@/lib/auth-server'
import type { MeResponse } from '@/lib/reporte-visitas'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)

    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    let ejecutiva: MeResponse['ejecutiva'] = null
    try {
      ejecutiva = await ejecutivaEnlazada(user.id)
    } catch (error) {
      console.error('No se pudo cargar el Ejecutivo Comercial enlazado en /api/auth/me:', error)
    }

    const respuesta: MeResponse = {
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        active: user.active,
      },
      ejecutiva,
    }
    return NextResponse.json(respuesta, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('Error en /api/auth/me:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
