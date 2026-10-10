import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireUser } from '@/lib/require-role'
import { fetchAllRows, isUuid, serverError } from '../../_lib/api-error'

// Visitas filtradas (heatmap del mapa y página de visitas). Requiere sesión.
// Paginación con .range() en bucle (M-01): PostgREST corta en 1.000 filas y septiembre de 2025
// ya tiene más de 1.000 visitas.

function monthBounds(year: number, month: number) {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const endDate = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`
  return { startDate, endDate }
}

export async function GET(request: NextRequest) {
  const auth = await requireUser(request)
  if (!auth.ok) return auth.response

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

    const allVisits: any[] = []
    for (const range of ranges) {
      const { data, error } = await fetchAllRows<any>((from, to) => {
        let query = supabaseAdmin.from('visits').select('*')
        if (range.startDate) query = query.gte('visit_date', range.startDate).lt('visit_date', range.endDate)
        if (visitType && visitType !== 'all') query = query.eq('visit_type', visitType)
        if (contactType && contactType !== 'all') query = query.eq('contact_type', contactType)
        if (kamIds && kamIds.length > 0) query = query.in('kam_id', kamIds)
        return query.order('visit_date', { ascending: false }).order('id').range(from, to)
      })
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
