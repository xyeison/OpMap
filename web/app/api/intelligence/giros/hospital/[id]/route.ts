import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/require-role'
import { serverError } from '@/app/api/_lib/api-error'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { monthsBetween, nitFromHospitalCode } from '@/lib/adres-parse.mjs'
import { addMonths, summarizeHospitalGiros, GIROS_DEFAULT_MONTHS, type HospitalGiroRow, type HospitalGirosSummary } from '@/lib/adres-intelligence'
import { MISSING_MIGRATION_MESSAGE, isMissingRelationError, loadGirosPeriodBounds } from '../../../_lib/giros-server'

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface HospitalGirosResponse {
  nit: string | null
  /** Sedes activas en OpMap con el mismo NIT (el giro es del prestador, no de la sede). */
  sedesNit: number
  range: { desde: string; hasta: string } | null
  summary: HospitalGirosSummary | null
  /** Última consulta de este NIT en la ADRES (adres_fetch_log), si la hay. */
  lastFetch: { estado: string; fetched_at: string; nombre_prestador: string | null } | null
}

// GET /api/intelligence/giros/hospital/[id] — tarjeta "Giros ADRES (últimos 12 meses)" de la ficha.
// Los 12 meses terminan en el último mes con giros cargados (el mismo para todas las IPS).
// Permiso hospitals:view (quien ve la ficha): son datos públicos de la ADRES sobre esa IPS.
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(request, 'hospitals:view')
  if (!auth.ok) return auth.response

  const id = String(params?.id || '')
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'ID de IPS no válido' }, { status: 400 })

  try {
    const { data: hospitalData, error: hospitalError } = await supabaseAdmin.from('hospitals').select('id, code').eq('id', id).limit(1)
    if (hospitalError) throw new Error(`Error leyendo hospitals: ${hospitalError.message}`)
    const hospital = hospitalData?.[0] as { id: string; code: string | null } | undefined
    if (!hospital) return NextResponse.json({ error: 'IPS no encontrada' }, { status: 404 })

    const nit = nitFromHospitalCode(hospital.code)
    if (!nit) {
      const body: HospitalGirosResponse = { nit: null, sedesNit: 0, range: null, summary: null, lastFetch: null }
      return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } })
    }

    const [bounds, sedesResult, fetchResult] = await Promise.all([
      loadGirosPeriodBounds(),
      // hospitals.nit es columna generada con la misma regla que nitFromHospitalCode (count sin traer filas)
      supabaseAdmin.from('hospitals').select('id', { count: 'exact', head: true }).eq('nit', nit).eq('active', true),
      supabaseAdmin
        .from('adres_fetch_log')
        .select('estado, fetched_at, nombre_prestador')
        .eq('nit', nit)
        .order('fetched_at', { ascending: false })
        .limit(1),
    ])
    if (sedesResult.error) throw new Error(`Error leyendo hospitals: ${sedesResult.error.message}`)
    if (fetchResult.error) throw Object.assign(new Error(`Error leyendo adres_fetch_log: ${fetchResult.error.message}`), { dbError: fetchResult.error })

    const sedesNit = sedesResult.count ?? 0
    const lastFetch = (fetchResult.data?.[0] as HospitalGirosResponse['lastFetch'] | undefined) ?? null

    let range: HospitalGirosResponse['range'] = null
    let summary: HospitalGirosSummary | null = null
    if (bounds) {
      const hasta = bounds.max
      const desde = addMonths(hasta, -(GIROS_DEFAULT_MONTHS - 1))
      range = { desde, hasta }
      const [y, m] = hasta.split('-').map(Number)
      const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
      const { data, error } = await supabaseAdmin
        .from('adres_giros')
        .select('periodo, tipo_contratacion, eps_codigo, eps_nombre, valor')
        .eq('nit', nit)
        .eq('regimen', 'subsidiado')
        .gte('periodo', `${desde}-01`)
        .lte('periodo', `${hasta}-${String(lastDay).padStart(2, '0')}`)
        .range(0, 4999)
      if (error) throw Object.assign(new Error(`Error leyendo adres_giros: ${error.message}`), { dbError: error })
      const rows = (data || []) as HospitalGiroRow[]
      summary = rows.length > 0 ? summarizeHospitalGiros(rows, monthsBetween(desde, hasta)) : null
    }

    const body: HospitalGirosResponse = { nit, sedesNit, range, summary, lastFetch }
    return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    if (isMissingRelationError(error)) return serverError('intelligence/giros/hospital GET', error, MISSING_MIGRATION_MESSAGE, 503)
    return serverError('intelligence/giros/hospital GET', error, 'Error al cargar los giros de la ADRES')
  }
}
