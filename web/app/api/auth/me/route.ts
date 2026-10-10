import { NextResponse, NextRequest } from 'next/server'
import { getUserFromRequest } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)

    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        active: user.active,
      },
    })
  } catch (error) {
    console.error('Error en /api/auth/me:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
