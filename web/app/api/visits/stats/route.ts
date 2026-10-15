import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireUser } from '@/lib/require-role'
import { serverError } from '../../_lib/api-error'
import { FILTRO_MAPA_ASIGNACION, visitsTieneAnulacion } from '../_lib/visitas-mapa'

// Estadísticas de visitas agregadas con count exacto (sin traer filas: no se trunca a 1.000). Las visitas anuladas de
// la app (deleted_at, migración 0830) no cuentan; antes de la 0830 la columna no existe y se cuenta sin ese filtro.
// F1a (0850): tampoco las de la app sin Ejecutivo Comercial (como líder): no son del mapa de asignación.
export async function GET(request: NextRequest) {
  const auth = await requireUser(request)
  if (!auth.ok) return auth.response

  try {
    const filtrarAnuladas = await visitsTieneAnulacion()
    const count = () => {
      const consulta = supabaseAdmin.from('visits').select('id', { count: 'exact', head: true })
      return filtrarAnuladas ? consulta.is('deleted_at', null).or(FILTRO_MAPA_ASIGNACION) : consulta
    }

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
