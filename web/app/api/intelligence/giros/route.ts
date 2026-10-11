import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/require-role'
import { serverError } from '@/app/api/_lib/api-error'
import { findAccessibleLine, loadCoverageResponse } from '@/lib/coverage'
import {
  aggregateGiros,
  parseGirosQuery,
  parseResumen,
  resolveGirosRange,
  type GirosAggregate,
  type GirosGroup,
  type IntelHospital,
} from '@/lib/adres-intelligence'
import {
  MISSING_MIGRATION_MESSAGE,
  isMissingRelationError,
  loadFetchStats,
  loadGirosPeriodBounds,
  loadGirosResumen,
  loadIntelHospitals,
  type GirosFetchStats,
} from '../_lib/giros-server'

export const dynamic = 'force-dynamic'

export interface GirosApiResponse extends GirosAggregate {
  group: GirosGroup
  line: { code: string; name: string } | null
  range: { desde: string; hasta: string; meses: number } | null
  available: { min: string; max: string } | null
  fetch: GirosFetchStats
  filters: {
    departamentos: Array<{ code: string; name: string }>
    municipios: Array<{ code: string; name: string; department_id: string }>
  }
  notes: string[]
}

const NOTES = [
  'Fuente: ADRES, Reporte 29 "Giro a IPS" (Liquidación Mensual de Afiliados, régimen subsidiado). Por mes de proceso.',
  'Solo régimen subsidiado: el contributivo aún no se carga.',
  'La ADRES gira al NIT del prestador, no a la sede. Si un NIT tiene varias sedes activas en OpMap, su giro se reparte entre ellas en proporción a las camas para agregar por municipio, zona o ejecutivo.',
]

// GET /api/intelligence/giros?group=ips|municipio|zona|ejecutivo&line=<code>&desde=YYYY-MM&hasta=YYYY-MM
//                            &departamento=<DANE 2>&municipio=<DANE 5>
// Giros directos de la ADRES por NIT → IPS activas (hospitals.code "NIT-DV") → municipio / zona actual
// (assignments) / Ejecutivo Comercial que cubre la zona en la línea (coverage). Permiso intelligence:view.
// Sin desde/hasta: los 12 meses que terminan en el último mes con giros cargados.
// line es opcional salvo para group=ejecutivo; 403 si la línea no es del usuario (GET /api/me/lines).
export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'intelligence:view')
  if (!auth.ok) return auth.response

  const parsed = parseGirosQuery(request.nextUrl.searchParams)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const query = parsed.value

  try {
    let line: GirosApiResponse['line'] = null
    let coverageByKam: Map<string, { kind: IntelHospital['coverage_kind']; executive: IntelHospital['executive'] }> | null = null
    if (query.line) {
      const access = await findAccessibleLine(auth.user, query.line)
      if (!access) return NextResponse.json({ error: 'No tienes acceso a esta línea' }, { status: 403 })
      const coverage = await loadCoverageResponse(access.line)
      coverageByKam = new Map(
        coverage.rows.map(row => [
          row.kam_id,
          {
            kind: row.kind,
            executive: row.executive ? { id: row.executive.id, full_name: row.executive.full_name, color: row.executive.color ?? null } : null,
          },
        ])
      )
      line = { code: access.line.code, name: access.line.name }
    }

    const [bounds, fetchStats, hospitals] = await Promise.all([
      loadGirosPeriodBounds(),
      loadFetchStats(),
      loadIntelHospitals(coverageByKam),
    ])

    const departamentos = new Map<string, string>()
    const municipios = new Map<string, { code: string; name: string; department_id: string }>()
    for (const hospital of hospitals) {
      if (hospital.department_id) departamentos.set(hospital.department_id, hospital.department_name || hospital.department_id)
      if (hospital.municipality_id && hospital.department_id) {
        municipios.set(hospital.municipality_id, {
          code: hospital.municipality_id,
          name: hospital.municipality_name || hospital.municipality_id,
          department_id: hospital.department_id,
        })
      }
    }
    const filters: GirosApiResponse['filters'] = {
      departamentos: Array.from(departamentos, ([code, name]) => ({ code, name })).sort((a, b) => a.name.localeCompare(b.name, 'es')),
      municipios: Array.from(municipios.values()).sort((a, b) => a.name.localeCompare(b.name, 'es')),
    }

    const range = resolveGirosRange(query.desde, query.hasta, bounds?.max ?? null)
    const giros = range ? parseResumen(await loadGirosResumen(range.desde, range.hasta)) : []
    const aggregate = aggregateGiros({
      hospitals,
      giros,
      months: range?.months ?? [],
      filter: { departamento: query.departamento, municipio: query.municipio },
      group: query.group,
      withExecutive: line !== null,
    })

    const body: GirosApiResponse = {
      ...aggregate,
      group: query.group,
      line,
      range: range ? { desde: range.desde, hasta: range.hasta, meses: range.months.length } : null,
      available: bounds,
      fetch: fetchStats,
      filters,
      notes: NOTES,
    }
    return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    if (isMissingRelationError(error)) return serverError('intelligence/giros GET', error, MISSING_MIGRATION_MESSAGE, 503)
    return serverError('intelligence/giros GET', error, 'Error al cargar los giros de la ADRES')
  }
}
