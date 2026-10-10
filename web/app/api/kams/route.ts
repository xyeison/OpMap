import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/require-role'
import { supabaseAdmin } from '@/lib/supabase-admin'

// GET /api/kams — lista de KAMs. Cualquier usuario con sesión (la usan mapa, contratos y visitas).
export async function GET(request: NextRequest) {
  const auth = await requireUser(request)
  if (!auth.ok) return auth.response

  try {
    const { data: kams, error } = await supabaseAdmin
      .from('kams')
      .select('*')
      .order('name')

    if (error) {
      console.error('Error cargando KAMs:', error)
      return NextResponse.json({ error: 'Error al cargar los KAMs' }, { status: 500 })
    }

    return NextResponse.json(kams || [])
  } catch (error) {
    console.error('Error en GET /api/kams:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
