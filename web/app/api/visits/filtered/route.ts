import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireUser } from '@/lib/require-role'
import { hasPermission } from '@/lib/permissions'
import { fetchAllRows, isUuid, serverError } from '../../_lib/api-error'
import { esColumnaInexistente } from '../_lib/visitas-mapa'

// Visitas filtradas (heatmap del mapa y página de visitas). Requiere sesión.
// Quien no tiene visits:view (Ejecutivos Comerciales, visor) no ve las visitas de la app: llevan el nombre y el GPS de
// cada Ejecutivo Comercial y entre ellos no se ven (spec de la app de visita, sección 11). Desde el 2026-10-29 las de VMO
// también van por persona, con su GPS y su fecha real: cada quien ve solo las suyas de VMO, y quien no es Ejecutivo
// Comercial, ninguna (docs/decisiones/2026-10-29-visitas-vmo-mapa-de-calor.md). Lo de la app lo ven en el teléfono.
// Paginación con .range() en bucle (M-01): PostgREST corta en 1.000 filas y septiembre de 2025
// ya tiene más de 1.000 visitas.

/** Las columnas del mapa de calor y de la página de visitas (las 14 originales de visits). */
const COLUMNAS_MAPA =
  'id, kam_id, kam_name, visit_type, contact_type, lat, lng, visit_date, hospital_id, imported_by, imported_at, created_at, updated_at, import_id'


function monthBounds(year: number, month: number) {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const endDate = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`
  return { startDate, endDate }
}

export async function GET(request: NextRequest) {
  const auth = await requireUser(request)
  if (!auth.ok) return auth.response
  const soloHistorico = !hasPermission(auth.user.role, 'visits:view')

  try {
    const searchParams = request.nextUrl.searchParams

    const month = Number(searchParams.get('month'))
    const months = searchParams
      .get('months')
      ?.split(',')
      .map(Number)
      .filter(n => Number.isInteger(n) && n >= 1 && n <= 12)
    const year = Number(searchParams.get('year'))
    const startYear = Number(searchParams.get('startYear'))
    const endYear = Number(searchParams.get('endYear'))
    const allMonths = searchParams.get('allMonths') === 'true'
    const visitType = searchParams.get('visitType')
    const contactType = searchParams.get('contactType')
    const kamIds = searchParams.get('kamIds')?.split(',').filter(isUuid)

    const hasYear = Number.isInteger(year) && year > 0

    // Sin visits:view: solo las visitas de VMO de su propia persona (executives.user_id)
    let propia: string | null = null
    if (soloHistorico) {
      const { data: ejecutiva, error: errorEjecutiva } = await supabaseAdmin.from('executives').select('id').eq('user_id', auth.user.id).limit(1)
      if (errorEjecutiva) return serverError('visits/filtered GET (persona)', errorEjecutiva, 'Error al cargar las visitas')
      propia = (ejecutiva?.[0]?.id as string | undefined) ?? null
      if (!propia) return NextResponse.json([])
    }

    // Rangos de fechas a consultar
    const ranges: { startDate: string; endDate: string }[] = []
    if (Number.isInteger(startYear) && Number.isInteger(endYear) && startYear > 0 && endYear > 0 && allMonths) {
      ranges.push({ startDate: `${startYear}-01-01`, endDate: `${endYear + 1}-01-01` })
    } else if (months && months.length > 0 && hasYear) {
      for (const m of Array.from(new Set(months))) ranges.push(monthBounds(year, m))
    } else if (Number.isInteger(month) && month >= 1 && month <= 12 && hasYear) {
      ranges.push(monthBounds(year, month))
    } else {
      ranges.push({ startDate: '', endDate: '' }) // sin filtro de fecha
    }

    // Solo las columnas que usa el mapa (nunca la transcripción, la conclusión ni los compromisos de las visitas de
    // la app: son internos) y sin las anuladas (deleted_at, migración 0830). Antes de la 0830 las columnas deleted_at y
    // source no existen: se consulta sin esos filtros (no hay visitas de la app).
    const consultar = (range: { startDate: string; endDate: string }, con0830: boolean) =>
      fetchAllRows<any>((from, to) => {
        let query = supabaseAdmin.from('visits').select(COLUMNAS_MAPA)
        if (con0830) query = query.is('deleted_at', null)
        if (propia) query = query.eq('source', 'vmo_import').eq('executive_id', propia)
        if (range.startDate) query = query.gte('visit_date', range.startDate).lt('visit_date', range.endDate)
        if (visitType && visitType !== 'all') query = query.eq('visit_type', visitType)
        if (contactType && contactType !== 'all') query = query.eq('contact_type', contactType)
        if (kamIds && kamIds.length > 0) query = query.in('kam_id', kamIds)
        return query.order('visit_date', { ascending: false }).order('id').range(from, to)
      })

    const allVisits: any[] = []
    for (const range of ranges) {
      let { data, error } = await consultar(range, true)
      // Antes de la 0830 no hay deleted_at, source ni executive_id: sin visits:view no hay cómo saber cuáles son suyas
      if (error && esColumnaInexistente(error)) {
        if (propia) continue
        ;({ data, error } = await consultar(range, false))
      }
      if (error) return serverError('visits/filtered GET', error, 'Error al cargar las visitas')
      allVisits.push(...data)
    }

    // Sin duplicados y ordenadas por fecha descendente
    const uniqueVisits = Array.from(new Map(allVisits.map(v => [v.id, v])).values())
    uniqueVisits.sort((a, b) => new Date(b.visit_date).getTime() - new Date(a.visit_date).getTime())

    return NextResponse.json(uniqueVisits)
  } catch (error) {
    return serverError('visits/filtered GET', error)
  }
}
