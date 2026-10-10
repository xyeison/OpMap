import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireUser } from '@/lib/require-role'
import { serverError } from '../../_lib/api-error'

// Estadísticas de visitas agregadas con count exacto (sin traer filas: no se trunca a 1.000).
export async function GET(request: NextRequest) {
  const auth = await requireUser(request)
  if (!auth.ok) return auth.response

  try {
    const count = () => supabaseAdmin.from('visits').select('id', { count: 'exact', head: true })

    const [total, effective, inPerson, virtual] = await Promise.all([
      count(),
      count().eq('visit_type', 'Visita efectiva'),
      count().eq('contact_type', 'Visita presencial'),
      count().eq('contact_type', 'Visita virtual'),
    ])

    const firstError = total.error || effective.error || inPerson.error || virtual.error
    if (firstError) return serverError('visits/stats GET', firstError, 'Error al cargar las estadísticas')

    return NextResponse.json({
      totalVisits: total.count || 0,
      effectiveVisits: effective.count || 0,
      inPersonVisits: inPerson.count || 0,
      virtualVisits: virtual.count || 0,
    })
  } catch (error) {
    return serverError('visits/stats GET', error)
  }
}
