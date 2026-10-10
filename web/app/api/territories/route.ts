import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/require-role'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { fetchAllRows } from '@/app/api/kams/_lib/kam-shared'

// GET /api/territories — datos de la página /territories leídos con service_role
// (A-10: con la anon key, assignments devolvía 0 filas sin error).
export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'territories:view')
  if (!auth.ok) return auth.response

  try {
    const [statsResult, assignments, municipalities] = await Promise.all([
      supabaseAdmin.from('territory_statistics').select('*'),
      fetchAllRows<Record<string, unknown>>((from, to) =>
        supabaseAdmin
          .from('assignments')
          .select(
            `
            id,
            hospital_id,
            kam_id,
            kams!inner(id, name, color),
            hospitals!inner(
              municipality_id,
              locality_id,
              department_name
            )
          `
          )
          .order('id')
          .range(from, to)
      ),
      fetchAllRows<{ code: string; name: string; population_2025: number | null }>((from, to) =>
        supabaseAdmin.from('municipalities').select('code, name, population_2025').order('code').range(from, to)
      ),
    ])

    if (statsResult.error) throw statsResult.error

    return NextResponse.json({
      stats: statsResult.data || [],
      assignments,
      municipalities,
    })
  } catch (error) {
    console.error('Error en GET /api/territories:', error)
    return NextResponse.json({ error: 'Error al cargar los territorios' }, { status: 500 })
  }
}
