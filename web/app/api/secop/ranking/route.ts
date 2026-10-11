import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/require-role'
import { serverError } from '@/app/api/_lib/api-error'
import { findAccessibleLine, loadCoverageResponse } from '@/lib/coverage'
import { nitOfHospital, type IntelHospital } from '@/lib/adres-intelligence'
import { loadIntelHospitals } from '@/app/api/intelligence/_lib/giros-server'
import {
  LINEAS_FILTRO,
  aggregateSecopRanking,
  monthEndYm,
  parseSecopRankingQuery,
  type SecopRankingResponse,
} from '@/lib/compras-publicas'
import { SECOP_MISSING_MESSAGE, isMissingRelationError, loadHechos, loadSecopActualizado, loadVigiladosActivos } from '../_lib/secop-server'
import { hoyBogota } from '../_lib/hoy'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const NOTES = [
  'Fuente: SECOP II y SECOP Integrado (Colombia Compra Eficiente, datos.gov.co). Solo contratos de material ortopédico y de neurocirugía, por fecha de firma.',
  'Una entidad = un NIT. Si el NIT tiene varias sedes activas en OpMap, su compra se reparte entre ellas en proporción a las camas para agregar por zona o ejecutivo (el total no se duplica); un contrato cuenta en cada fila que toca.',
  'Los servicios de especialistas (médicos y empresas de especialistas) no son compras de material: se cuentan aparte.',
  'SECOP I publica el valor del proceso en cada contratista: esas filas se cuentan una vez, repartiendo el valor por partes iguales entre los contratistas del proceso.',
  'Por defecto solo las 6 líneas ortopédicas; "Sin clasificar" (proveedores vigilados sin línea detectada) se ve en el desglose por línea y con el filtro "Todas". Los contratos de más de 50.000 millones (fuera de escala) no suman.',
]

// GET /api/secop/ranking?group=hospital|proveedor|zona|ejecutivo&linea=<código|no_clasificado|todas>&desde=YYYY-MM
//      &hasta=YYYY-MM&line=<código de línea de negocio>&departamento=<DANE 2>&ambito=ips|todas
// Ranking de compras públicas + tabla proveedor × hospital. line es obligatoria para group=ejecutivo y debe
// ser del usuario (403 si no). ambito=todas (solo proveedor) incluye entidades que no son IPS de OpMap.
// Sin desde/hasta: los 24 meses que terminan en el mes actual. Permiso intelligence:view.
export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'intelligence:view')
  if (!auth.ok) return auth.response

  const parsed = parseSecopRankingQuery(request.nextUrl.searchParams, hoyBogota())
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const query = parsed.value

  try {
    let line: SecopRankingResponse['line'] = null
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

    const hospitals = await loadIntelHospitals(coverageByKam)
    const nits = new Set<string>()
    const departamentos = new Map<string, string>()
    for (const hospital of hospitals) {
      const nit = nitOfHospital(hospital)
      if (nit) nits.add(nit)
      if (hospital.department_id) departamentos.set(hospital.department_id, hospital.department_name || hospital.department_id)
    }

    const [facts, vigilados, actualizado] = await Promise.all([
      loadHechos({ desde: `${query.desde}-01`, hasta: monthEndYm(query.hasta), nits: query.ambito === 'ips' ? Array.from(nits) : null }),
      loadVigiladosActivos(),
      loadSecopActualizado(),
    ])

    const ranking = aggregateSecopRanking({
      facts,
      hospitals,
      group: query.group,
      filter: { linea: query.linea, departamento: query.departamento },
      vigilados,
      withExecutive: line !== null,
      ambito: query.ambito,
    })

    const body: SecopRankingResponse = {
      ...ranking,
      group: query.group,
      ambito: query.ambito,
      linea: query.linea,
      line,
      range: { desde: query.desde, hasta: query.hasta },
      filters: {
        departamentos: Array.from(departamentos, ([code, name]) => ({ code, name })).sort((a, b) => a.name.localeCompare(b.name, 'es')),
        lineas: LINEAS_FILTRO.map(item => ({ ...item })),
      },
      actualizado,
      notes: query.ambito === 'todas' ? [...NOTES, 'Ámbito "todas las entidades": incluye compras de entidades públicas que no son IPS de OpMap (sin filtro de departamento).'] : NOTES,
    }
    return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    if (isMissingRelationError(error)) return serverError('secop/ranking GET', error, SECOP_MISSING_MESSAGE, 503)
    return serverError('secop/ranking GET', error, 'Error al cargar las compras públicas')
  }
}
