import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/require-role'
import { serverError } from '@/app/api/_lib/api-error'
import { findAccessibleLine, loadCoverageResponse } from '@/lib/coverage'
import {
  POTENCIAL_FORMULA,
  aggregatePoblacion,
  closestCorte,
  parsePoblacionQuery,
  pickDaneYear,
  resolveCorte,
  resolveMunicipios,
  type BduaRegimenRow,
  type CifrasMunicipioRow,
  type CoverageForZone,
  type EpsAfiliadosRow,
  type PoblacionApiResponse,
} from '@/lib/poblacion-intelligence'
import {
  loadBduaResumen,
  loadCifras,
  loadDane,
  loadGirosTotales,
  loadMunicipalityBase,
  loadPoblacionCortes,
  loadPoblacionHospitals,
  loadReachZones,
  optionalSource,
} from '../_lib/poblacion-server'

export const dynamic = 'force-dynamic'

const NOTES = [
  'Afiliados por régimen: "Cifras de aseguramiento en salud" de MinSalud (hoja CoberturaMunicipio) del corte elegido; si un municipio no tiene cifras, BDUA de la ADRES (solo afiliados activos, sin régimen de excepción).',
  'Población: proyección municipal del DANE (2020-2035, actualización post COVID-19) del año del corte. La cobertura se calcula sobre la población de los municipios con cifras de afiliación y puede pasar de 100 % (MinSalud la publica con tope en 100 %).',
  'EPS dominantes: BDUA, afiliados activos de todos los regímenes; los códigos de una misma EPS (contributivo, subsidiado y movilidad) se suman.',
  'Zona y Ejecutivo Comercial: un municipio con IPS de varias zonas (Bogotá, Sogamoso) se reparte entre ellas en proporción a las camas de sus IPS asignadas; uno sin IPS cuenta para la zona que lo tiene "de alcance". Los giros y la capacidad van con la zona asignada de cada IPS.',
  'Giros ADRES: van al NIT del prestador; si el NIT tiene varias sedes en OpMap, se reparten por camas. Ninguna cifra de esta sección recalcula asignaciones ni consulta Google.',
]

// GET /api/intelligence/poblacion?group=municipio|zona|ejecutivo&line=<code>&departamento=<DANE 2>
//                                &municipio=<DANE 5>&corte=YYYY-MM
// Población y cobertura por municipio, zona o Ejecutivo Comercial (permiso intelligence:view).
// Mismas reglas de líneas que /api/intelligence/giros: line opcional salvo para group=ejecutivo (400);
// 403 si la línea no es del usuario. Sin corte: el último de afiliacion_cifras.
export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'intelligence:view')
  if (!auth.ok) return auth.response

  const parsed = parsePoblacionQuery(request.nextUrl.searchParams)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const query = parsed.value

  try {
    let line: PoblacionApiResponse['line'] = null
    let coverageByKam: Map<string, CoverageForZone> | null = null
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

    const [cortes, base, reach, hospitalData] = await Promise.all([
      loadPoblacionCortes(),
      loadMunicipalityBase(),
      loadReachZones(),
      loadPoblacionHospitals(coverageByKam),
    ])
    const giros = await loadGirosTotales(hospitalData.hospitals.map(hospital => hospital.code))

    // Cortes de MinSalud como 'YYYY-MM' (la tabla guarda el último día del mes).
    const cifrasByMonth = new Map(cortes.cifras.map(date => [date.slice(0, 7), date]))
    const corte = resolveCorte(query.corte, Array.from(cifrasByMonth.keys()))
    if (corte === undefined) return NextResponse.json({ error: 'No hay cifras de afiliación para ese corte' }, { status: 400 })
    const cifrasDate = corte ? cifrasByMonth.get(corte) ?? null : null
    const bduaCorte = closestCorte(cifrasDate, cortes.bdua)
    const daneYear = pickDaneYear(cifrasDate ?? bduaCorte, cortes.dane)

    const [cifras, bdua, dane] = await Promise.all([
      cifrasDate ? optionalSource(() => loadCifras(cifrasDate), [] as CifrasMunicipioRow[]) : Promise.resolve({ value: [] as CifrasMunicipioRow[], available: false }),
      bduaCorte
        ? optionalSource(() => loadBduaResumen(bduaCorte), { regimen: [] as BduaRegimenRow[], eps: [] as EpsAfiliadosRow[] })
        : Promise.resolve({ value: { regimen: [] as BduaRegimenRow[], eps: [] as EpsAfiliadosRow[] }, available: false }),
      daneYear !== null ? optionalSource(() => loadDane(daneYear), new Map<string, number>()) : Promise.resolve({ value: new Map<string, number>(), available: false }),
    ])

    const municipios = resolveMunicipios({
      municipalities: base.municipalities,
      departmentNames: base.departmentNames,
      cifras: cifras.value,
      bdua: bdua.value.regimen,
      dane: dane.value,
    })

    const aggregate = aggregatePoblacion({
      group: query.group,
      municipios,
      eps: bdua.value.eps,
      hospitals: hospitalData.hospitals,
      giros: giros.totals,
      reach: reach.value,
      zoneNames: hospitalData.zoneNames,
      coverage: coverageByKam,
      filter: { departamento: query.departamento, municipio: query.municipio },
    })

    const departamentosConMunicipio = new Set(base.municipalities.map(m => m.department_code))
    const filters: PoblacionApiResponse['filters'] = {
      departamentos: Array.from(base.departmentNames, ([code, name]) => ({ code, name }))
        .filter(item => departamentosConMunicipio.has(item.code))
        .sort((a, b) => a.name.localeCompare(b.name, 'es')),
      municipios: base.municipalities
        .map(m => ({ code: m.code, name: m.name, department_id: m.department_code }))
        .sort((a, b) => a.name.localeCompare(b.name, 'es') || a.code.localeCompare(b.code)),
    }

    const notes = [...NOTES]
    if (!reach.available) notes.push('Sin la tabla municipality_zone (Fase 2b): los municipios sin IPS quedan "Sin zona asignada".')
    if (!giros.info.fuente) notes.push('Aún no hay giros de la ADRES cargados: el término de giros del potencial vale 0.')

    const body: PoblacionApiResponse = {
      ...aggregate,
      group: query.group,
      line,
      corte,
      cortes: Array.from(cifrasByMonth.keys()).sort().reverse(),
      bduaCorte: bduaCorte ? bduaCorte.slice(0, 7) : null,
      poblacionAnio: dane.available && dane.value.size > 0 ? daneYear : null,
      giros: giros.info,
      sources: {
        cifras: cifras.available && cifras.value.length > 0,
        bdua: bdua.available && bdua.value.regimen.length > 0,
        dane: dane.available && dane.value.size > 0,
      },
      filters,
      formula: POTENCIAL_FORMULA,
      notes,
    }
    return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return serverError('intelligence/poblacion GET', error, 'Error al cargar la población y cobertura')
  }
}
