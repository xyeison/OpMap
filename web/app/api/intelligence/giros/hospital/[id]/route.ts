import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/require-role'
import { fetchAllRows, serverError } from '@/app/api/_lib/api-error'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { monthsBetween, nitFromHospitalCode } from '@/lib/adres-parse.mjs'
import {
  addMonths,
  summarizeHospitalDetalle,
  summarizeHospitalGiros,
  GIROS_DEFAULT_MONTHS,
  type GirosFuente,
  type HospitalDetalleMensualRow,
  type HospitalGiroRow,
  type HospitalGirosSummary,
} from '@/lib/adres-intelligence'
import {
  FETCH_FUENTE,
  MISSING_MIGRATION_MESSAGE,
  isMissingRelationError,
  loadGirosPeriodBounds,
  loadIdentificaBounds,
  monthEnd,
} from '../../../_lib/giros-server'

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type LastFetch = { estado: string; fetched_at: string; nombre_prestador: string | null }

export interface HospitalGirosResponse {
  nit: string | null
  /** Sedes activas en OpMap con el mismo NIT (el giro es del prestador, no de la sede). */
  sedesNit: number
  /** identifica si este NIT ya se consultó en "Identifica tu Giro" (ok o sin registros); si no, reporte29. */
  fuente: GirosFuente | null
  range: { desde: string; hasta: string } | null
  summary: HospitalGirosSummary | null
  /** Última consulta de este NIT en la fuente usada (adres_fetch_log), si la hay. */
  lastFetch: LastFetch | null
}

async function lastFetchOf(nit: string, fuente: GirosFuente): Promise<LastFetch | null> {
  const { data, error } = await supabaseAdmin
    .from('adres_fetch_log')
    .select('estado, fetched_at, nombre_prestador')
    .eq('nit', nit)
    .eq('fuente', FETCH_FUENTE[fuente])
    .order('fetched_at', { ascending: false })
    .limit(1)
  if (error) throw Object.assign(new Error(`Error leyendo adres_fetch_log: ${error.message}`), { dbError: error })
  return (data?.[0] as LastFetch | undefined) ?? null
}

/** Últimos 12 meses de Identifica tu Giro (vista adres_giros_mensual). null si la vista no existe (migración 0630). */
async function identificaSummary(nit: string): Promise<{ range: HospitalGirosResponse['range']; summary: HospitalGirosSummary | null } | null> {
  const bounds = await loadIdentificaBounds()
  if (!bounds) return { range: null, summary: null }
  const hasta = bounds.max
  const desde = addMonths(hasta, -(GIROS_DEFAULT_MONTHS - 1))
  // Paginado: PostgREST corta en 1.000 filas y la vista tiene una fila por mes, régimen y entidad
  // ordenadora (en la LMA del subsidiado la ordenadora es cada ente territorial: pueden ser muchas).
  const { data, error } = await fetchAllRows<HospitalDetalleMensualRow>((from, to) =>
    supabaseAdmin
      .from('adres_giros_mensual')
      .select('periodo, regimen, eps_ordenadora_nit, eps_ordenadora_nombre, valor, ultima_fecha')
      .eq('nit', nit)
      .gte('periodo', `${desde}-01`)
      .lte('periodo', monthEnd(hasta))
      .order('periodo')
      .order('regimen')
      .order('eps_ordenadora_nit', { nullsFirst: true })
      .range(from, to)
  )
  if (error) {
    if (isMissingRelationError(error)) return null
    throw Object.assign(new Error(`Error leyendo adres_giros_mensual: ${(error as { message?: string }).message}`), { dbError: error })
  }
  const rows = data
  return { range: { desde, hasta }, summary: rows.length > 0 ? summarizeHospitalDetalle(rows, monthsBetween(desde, hasta)) : null }
}

async function reporte29Summary(nit: string): Promise<{ range: HospitalGirosResponse['range']; summary: HospitalGirosSummary | null }> {
  const bounds = await loadGirosPeriodBounds()
  if (!bounds) return { range: null, summary: null }
  const hasta = bounds.max
  const desde = addMonths(hasta, -(GIROS_DEFAULT_MONTHS - 1))
  const { data, error } = await supabaseAdmin
    .from('adres_giros')
    .select('periodo, tipo_contratacion, eps_codigo, eps_nombre, valor')
    .eq('nit', nit)
    .eq('regimen', 'subsidiado')
    .gte('periodo', `${desde}-01`)
    .lte('periodo', monthEnd(hasta))
    .range(0, 4999)
  if (error) throw Object.assign(new Error(`Error leyendo adres_giros: ${error.message}`), { dbError: error })
  const rows = (data || []) as HospitalGiroRow[]
  return { range: { desde, hasta }, summary: rows.length > 0 ? summarizeHospitalGiros(rows, monthsBetween(desde, hasta)) : null }
}

// GET /api/intelligence/giros/hospital/[id] — tarjeta "Giros ADRES (últimos 12 meses)" de la ficha.
// Si el NIT ya se consultó en "Identifica tu Giro" (ok o sin registros): total por régimen, entidades
// ordenadoras y serie por régimen de los 12 meses que terminan en el último mes con giros de esa fuente.
// Si no: Reporte 29 (subsidiado; capitación / evento y EPS), como antes. Mismo rango para todas las IPS.
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
      const body: HospitalGirosResponse = { nit: null, sedesNit: 0, fuente: null, range: null, summary: null, lastFetch: null }
      return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } })
    }

    const [sedesResult, identFetch, r29Fetch] = await Promise.all([
      // hospitals.nit es columna generada con la misma regla que nitFromHospitalCode (count sin traer filas)
      supabaseAdmin.from('hospitals').select('id', { count: 'exact', head: true }).eq('nit', nit).eq('active', true),
      lastFetchOf(nit, 'identifica'),
      lastFetchOf(nit, 'reporte29'),
    ])
    if (sedesResult.error) throw new Error(`Error leyendo hospitals: ${sedesResult.error.message}`)
    const sedesNit = sedesResult.count ?? 0

    let fuente: GirosFuente = 'reporte29'
    let result: { range: HospitalGirosResponse['range']; summary: HospitalGirosSummary | null } | null = null
    if (identFetch && (identFetch.estado === 'ok' || identFetch.estado === 'sin_registros')) {
      result = await identificaSummary(nit)
      if (result) fuente = 'identifica'
    }
    if (!result) result = await reporte29Summary(nit)

    const body: HospitalGirosResponse = {
      nit,
      sedesNit,
      fuente,
      range: result.range,
      summary: result.summary,
      lastFetch: fuente === 'identifica' ? identFetch : r29Fetch,
    }
    return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    if (isMissingRelationError(error)) return serverError('intelligence/giros/hospital GET', error, MISSING_MIGRATION_MESSAGE, 503)
    return serverError('intelligence/giros/hospital GET', error, 'Error al cargar los giros de la ADRES')
  }
}
