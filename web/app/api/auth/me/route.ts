import { NextResponse, NextRequest } from 'next/server'
import { getUserFromRequest } from '@/lib/auth-utils'

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    
    return NextResponse.json({ user })
  } catch (error) {
    console.error('Error en /api/auth/me:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}