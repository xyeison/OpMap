import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/require-role'
import { serverError } from '@/app/api/_lib/api-error'
import { findAccessibleLine, loadCoverageResponse } from '@/lib/coverage'
import {
  chooseGirosSource,
  nitOfHospital,
  parseGirosQuery,
  parseIntel,
  type GirosFuente,
  type GirosFuenteParam,
  type GirosRegimen,
  type IntelHospital,
} from '@/lib/adres-intelligence'
import { analizarVariaciones, parseVariacionQuery, ventanasVariacion, type ResultadoVariaciones, type VentanasVariacion } from '@/lib/giros-variacion'
import type { MesesDisponibles } from '@/lib/periodo-giros'
import {
  MISSING_MIGRATION_MESSAGE,
  isMissingRelationError,
  loadFetchLog,
  loadGirosIntel,
  loadGirosPeriodBounds,
  loadIdentificaBounds,
  loadIntelHospitals,
} from '../../_lib/giros-server'

export const dynamic = 'force-dynamic'

export interface VariacionApiResponse extends ResultadoVariaciones {
  ventanas: VentanasVariacion
  line: { code: string; name: string } | null
  fuente: GirosFuente
  fuenteSolicitada: GirosFuenteParam
  fuenteMotivo: string
  regimen: GirosRegimen
  minimoMensual: number
  /** Meses con giros de la fuente usada. */
  disponible: MesesDisponibles
  notes: string[]
}

const NOTAS_COMUNES = [
  'Cada prestador (NIT) se compara con lo que creció el giro de todas las IPS del país en las mismas ventanas, con la misma fuente y el mismo régimen: solo es noticia si se separa del mercado.',
  'Confianza: prueba t de Welch sobre el giro mensual (o, si un solo mes explica el cambio, ese mes frente a los de la base), corregida por mirar cientos de IPS a la vez (Benjamini–Hochberg). Alta: q < 0,05; media: p < 0,05; baja: el resto ("sin cambio claro").',
  'Tendencia: Mann–Kendall sobre los últimos 12 meses (o los que haya) y pendiente de Sen. "Sostenido" = tendencia significativa en la misma dirección.',
  'La ADRES gira al NIT, no a la sede. Al filtrar por departamento o municipio, cada NIT entra con la parte de sus sedes del filtro (por camas); el % de cambio no se altera.',
]

const NOTA_ENTIDADES: Record<GirosFuente, string> = {
  identifica:
    'Quién explica el cambio: las entidades ordenadoras que más movieron el giro. En los giros LMA "CXP IPS" del subsidiado la ADRES registra el municipio o el departamento, no la EPS.',
  reporte29: 'Quién explica el cambio: las EPS que más movieron el giro (Reporte 29, solo régimen subsidiado).',
}

// GET /api/intelligence/giros/variacion?ventana=3|6|12&comparar=anterior|anio_anterior&hasta=YYYY-MM&minimo=<pesos al mes>
//      &line=<code>&departamento=<DANE 2>&municipio=<DANE 5>&regimen=todos|contributivo|subsidiado&fuente=auto|reporte29|identifica
// IPS (por NIT) cuyo giro cambió fuera de lo normal (spec docs/specs/2026-10-29-giros-variaciones.md). Misma fuente
// automática que /api/intelligence/giros. Lee la RPC adres_giros_intel una vez por tramo de meses (base, reciente y lo
// que falte de la tendencia): sin Google, sin escribir. Permiso intelligence:view; line, como en /giros, solo si es del
// usuario. 400 si la comparación pide meses que no están cargados (el mensaje dice cuántos).
export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'intelligence:view')
  if (!auth.ok) return auth.response

  const parsed = parseGirosQuery(request.nextUrl.searchParams)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const parsedVariacion = parseVariacionQuery(request.nextUrl.searchParams)
  if (!parsedVariacion.ok) return NextResponse.json({ error: parsedVariacion.error }, { status: 400 })
  const query = parsed.value
  const variacion = parsedVariacion.value

  try {
    let line: VariacionApiResponse['line'] = null
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

    const [r29Bounds, identBounds, identLog, hospitals] = await Promise.all([
      loadGirosPeriodBounds(),
      loadIdentificaBounds(),
      loadFetchLog('identifica'),
      loadIntelHospitals(coverageByKam),
    ])

    const nitsActivos = new Set<string>()
    for (const hospital of hospitals) {
      const nit = nitOfHospital(hospital)
      if (nit) nitsActivos.add(nit)
    }
    let identificaNitsOk = 0
    identLog.okNits.forEach(nit => {
      if (nitsActivos.has(nit)) identificaNitsOk++
    })
    const choice = chooseGirosSource({
      requested: query.fuente,
      desde: null,
      hasta: variacion.hasta,
      identifica: identBounds ? { min: identBounds.min, max: identBounds.max } : null,
      reporte29: r29Bounds,
      identificaNitsOk,
      nitsActivos: nitsActivos.size,
    })
    const fuente = choice.fuente
    const disponible = fuente === 'identifica' ? (identBounds ? { min: identBounds.min, max: identBounds.max } : null) : r29Bounds
    if (!disponible) return NextResponse.json({ error: 'Aún no se han cargado giros de la ADRES en esta fuente.' }, { status: 400 })

    const ventanas = ventanasVariacion({
      hasta: variacion.hasta ?? disponible.max,
      ventana: variacion.ventana,
      comparacion: variacion.comparacion,
      disponible,
    })
    if (!ventanas.ok) return NextResponse.json({ error: ventanas.error, disponible, fuente }, { status: 400 })
    const v = ventanas.value

    const tramos = [v.base, v.reciente, ...v.extra]
    const partes = (await Promise.all(tramos.map(tramo => loadGirosIntel(fuente, tramo.desde, tramo.hasta, query.regimen)))).map(parseIntel)
    const series = new Map<string, Record<string, number>>()
    for (const parte of partes) {
      for (const nit of parte.nits) {
        const meses = series.get(nit.nit) ?? {}
        for (const [mes, valor] of Object.entries(nit.meses)) meses[mes] = (meses[mes] || 0) + valor.t
        series.set(nit.nit, meses)
      }
    }
    const [base, reciente] = partes

    const resultado = analizarVariaciones({
      hospitals,
      series,
      entidadesBase: new Map(base.nits.map(nit => [nit.nit, nit.eps])),
      entidadesReciente: new Map(reciente.nits.map(nit => [nit.nit, nit.eps])),
      // El nombre más reciente de cada entidad manda
      nombresEntidades: { ...base.epsNombres, ...reciente.epsNombres },
      ventanas: v,
      filtro: { departamento: query.departamento, municipio: query.municipio },
      minimoMensual: variacion.minimoMensual,
      conEjecutivo: line !== null,
    })

    const body: VariacionApiResponse = {
      ...resultado,
      ventanas: v,
      line,
      fuente,
      fuenteSolicitada: query.fuente,
      fuenteMotivo: choice.motivo,
      regimen: query.regimen,
      minimoMensual: variacion.minimoMensual,
      disponible,
      notes: [...NOTAS_COMUNES, NOTA_ENTIDADES[fuente]],
    }
    return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    if (isMissingRelationError(error)) return serverError('intelligence/giros/variacion GET', error, MISSING_MIGRATION_MESSAGE, 503)
    return serverError('intelligence/giros/variacion GET', error, 'Error al calcular las variaciones de los giros')
  }
}
