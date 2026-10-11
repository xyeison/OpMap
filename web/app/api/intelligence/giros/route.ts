import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/require-role'
import { serverError } from '@/app/api/_lib/api-error'
import { findAccessibleLine, loadCoverageResponse } from '@/lib/coverage'
import {
  aggregateGiros,
  chooseGirosSource,
  nitOfHospital,
  parseGirosQuery,
  parseIntel,
  resolveGirosRange,
  type GirosAggregate,
  type GirosFuente,
  type GirosFuenteParam,
  type GirosGroup,
  type GirosRegimen,
  type IntelHospital,
} from '@/lib/adres-intelligence'
import {
  MISSING_MIGRATION_MESSAGE,
  isMissingRelationError,
  loadFetchLog,
  loadGirosIntel,
  loadGirosPeriodBounds,
  loadIdentificaBounds,
  loadIntelHospitals,
  type GirosFetchStats,
} from '../_lib/giros-server'

export const dynamic = 'force-dynamic'

export interface GirosApiResponse extends GirosAggregate {
  group: GirosGroup
  line: { code: string; name: string } | null
  /** Fuente usada y la pedida ('auto' decide con chooseGirosSource). */
  fuente: GirosFuente
  fuenteSolicitada: GirosFuenteParam
  fuenteMotivo: string
  regimen: GirosRegimen
  range: { desde: string; hasta: string; meses: number } | null
  /** Meses con giros de la fuente usada. */
  available: { min: string; max: string } | null
  /** Límites de cada fuente (identifica con fechas exactas del primer y último giro). */
  sources: {
    reporte29: { min: string; max: string } | null
    identifica: { min: string; max: string; primeraFecha: string; ultimaFecha: string } | null
  }
  /** Cobertura temporal de la fuente usada: hasta el último giro cargado. */
  cobertura: { desde: string; hasta: string; texto: string } | null
  fetch: GirosFetchStats
  filters: {
    departamentos: Array<{ code: string; name: string }>
    municipios: Array<{ code: string; name: string; department_id: string }>
  }
  notes: string[]
}

const NIT_NOTE =
  'La ADRES gira al NIT del prestador, no a la sede. Si un NIT tiene varias sedes activas en OpMap, su giro se reparte entre ellas en proporción a las camas para agregar por municipio, zona o ejecutivo.'

const NOTES: Record<GirosFuente, string[]> = {
  reporte29: [
    'Fuente: ADRES, Reporte 29 "Giro a IPS" (Liquidación Mensual de Afiliados, régimen subsidiado). Por mes de proceso; la entidad es la EPS.',
    'Solo régimen subsidiado y solo giros directos a la IPS ("CXP IPS").',
    NIT_NOTE,
  ],
  identifica: [
    'Fuente: ADRES, "Identifica tu Giro" (ERP). Un registro por giro, por fecha de giro.',
    'Régimen según el concepto: subsidiado si dice "subsidiado" o "LMA" (incluye giros "CXP EPS" y presupuestos máximos del subsidiado); contributivo si es la compensación o el régimen contributivo; "otro" para recobros NO UPC, reclamaciones SOAT/ECAT, pruebas COVID y resoluciones del MSPS (solo en "Todos").',
    'Entidad ordenadora: la EPS, salvo en los giros LMA "CXP IPS" del subsidiado, donde la ADRES registra el ente territorial (municipio o departamento) de la liquidación.',
    NIT_NOTE,
  ],
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const fechaLarga = (iso: string) => `${Number(iso.slice(8, 10))}-${MESES[Number(iso.slice(5, 7)) - 1]}-${iso.slice(0, 4)}`
const mesLargo = (ym: string) => `${MESES[Number(ym.slice(5, 7)) - 1]}-${ym.slice(0, 4)}`

// GET /api/intelligence/giros?group=ips|municipio|zona|ejecutivo&line=<code>&desde=YYYY-MM&hasta=YYYY-MM
//      &departamento=<DANE 2>&municipio=<DANE 5>&regimen=todos|contributivo|subsidiado&fuente=auto|reporte29|identifica
// Giros de la ADRES por NIT → IPS activas (hospitals.code "NIT-DV") → municipio / zona actual (assignments) /
// Ejecutivo Comercial que cubre la zona en la línea (coverage). Permiso intelligence:view.
// fuente=auto: Identifica tu Giro si está cargado para ≥ 90 % de los NIT activos y tiene giros en el rango;
// si no, el Reporte 29 (chooseGirosSource). Sin desde/hasta: 12 meses hasta el último mes de la fuente.
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

    const [r29Bounds, identBounds, r29Log, identLog, hospitals] = await Promise.all([
      loadGirosPeriodBounds(),
      loadIdentificaBounds(),
      loadFetchLog('reporte29'),
      loadFetchLog('identifica'),
      loadIntelHospitals(coverageByKam),
    ])

    const departamentos = new Map<string, string>()
    const municipios = new Map<string, { code: string; name: string; department_id: string }>()
    const nitsActivos = new Set<string>()
    for (const hospital of hospitals) {
      const nit = nitOfHospital(hospital)
      if (nit) nitsActivos.add(nit)
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

    let identificaNitsOk = 0
    identLog.okNits.forEach(nit => {
      if (nitsActivos.has(nit)) identificaNitsOk++
    })
    const choice = chooseGirosSource({
      requested: query.fuente,
      desde: query.desde,
      hasta: query.hasta,
      identifica: identBounds ? { min: identBounds.min, max: identBounds.max } : null,
      reporte29: r29Bounds,
      identificaNitsOk,
      nitsActivos: nitsActivos.size,
    })
    const fuente = choice.fuente
    const bounds = fuente === 'identifica' ? (identBounds ? { min: identBounds.min, max: identBounds.max } : null) : r29Bounds

    const range = resolveGirosRange(query.desde, query.hasta, bounds?.max ?? null)
    const intel = range ? parseIntel(await loadGirosIntel(fuente, range.desde, range.hasta, query.regimen)) : { nits: [], epsNombres: {} }
    const aggregate = aggregateGiros({
      hospitals,
      giros: intel.nits,
      months: range?.months ?? [],
      filter: { departamento: query.departamento, municipio: query.municipio },
      group: query.group,
      withExecutive: line !== null,
      epsNombres: intel.epsNombres,
    })

    let cobertura: GirosApiResponse['cobertura'] = null
    if (fuente === 'identifica' && identBounds) {
      cobertura = {
        desde: identBounds.primeraFecha,
        hasta: identBounds.ultimaFecha,
        texto: `Identifica tu Giro tiene giros del ${fechaLarga(identBounds.primeraFecha)} al ${fechaLarga(identBounds.ultimaFecha)} (último giro cargado); los meses posteriores aún no están cargados.`,
      }
    } else if (fuente === 'reporte29' && r29Bounds) {
      cobertura = {
        desde: r29Bounds.min,
        hasta: r29Bounds.max,
        texto: `El Reporte 29 tiene meses de proceso de ${mesLargo(r29Bounds.min)} a ${mesLargo(r29Bounds.max)} (último mes publicado por la ADRES).`,
      }
    }

    const notes = [choice.motivo, ...NOTES[fuente]]
    if (fuente === 'reporte29' && query.regimen === 'contributivo') notes.unshift('El Reporte 29 no tiene régimen contributivo: elige la fuente "Identifica tu Giro".')

    const body: GirosApiResponse = {
      ...aggregate,
      group: query.group,
      line,
      fuente,
      fuenteSolicitada: query.fuente,
      fuenteMotivo: choice.motivo,
      regimen: query.regimen,
      range: range ? { desde: range.desde, hasta: range.hasta, meses: range.months.length } : null,
      available: bounds,
      sources: { reporte29: r29Bounds, identifica: identBounds },
      cobertura,
      fetch: fuente === 'identifica' ? identLog.stats : r29Log.stats,
      filters,
      notes,
    }
    return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    if (isMissingRelationError(error)) return serverError('intelligence/giros GET', error, MISSING_MIGRATION_MESSAGE, 503)
    return serverError('intelligence/giros GET', error, 'Error al cargar los giros de la ADRES')
  }
}
