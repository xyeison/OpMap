import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/require-role'
import { hasPermission } from '@/lib/permissions'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { fetchAllRows, serverError } from '@/app/api/_lib/api-error'
import { UUID_RE } from '@/lib/fase1-schemas'
import { loadCoverageResponse, resolveUserLines } from '@/lib/coverage'
import { zoneDisplayName } from '@/lib/zone-names'
import { nitOfHospital } from '@/lib/adres-intelligence'
import { ventanaMeses } from '@/lib/compras-publicas'
import { hospitalGiroMap, municipioZoneShares, pickDaneYear } from '@/lib/poblacion-intelligence'
import type { CoverageLineInfo } from '@/lib/types/coverage'
import {
  ZONA_SECOP_MESES,
  coberturaDeEjecutivo,
  coberturaDeZona,
  coberturaDesactualizada,
  construirBloque,
  contarMedicos,
  lineasConCobertura,
  mismasZonas,
  municipiosConIps,
  puedeVerDatosDeZona,
  ultimaFecha,
  veComprasPublicas,
  ventanaVisitas,
  zonasDelTerritorio,
  type CoberturaLineaEntrada,
  type DaneFila,
  type DatosZonas,
  type HospitalZona,
  type LineaRef,
  type VisitaFila,
  type ZonaEstadisticasResponse,
  type ZonaRef,
} from '@/lib/zona-estadisticas'
import {
  loadBduaResumen,
  loadGirosTotales,
  loadMunicipalityBase,
  loadPoblacionCortes,
  loadPoblacionHospitals,
  loadReachZones,
} from '@/app/api/intelligence/_lib/poblacion-server'
import { loadHechos, loadSecopActualizado } from '@/app/api/secop/_lib/secop-server'
import { hoyBogota } from '@/app/api/secop/_lib/hoy'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

type Params = { params: { id: string } }

const NOTAS = [
  'Municipios: los que tienen IPS activas asignadas a la zona y los que no tienen IPS pero están dentro de su alcance por tiempo real de carretera (municipality_zone). Fuera de alcance y sin acceso terrestre no cuentan para nadie.',
  'Bogotá y los municipios con IPS de varias zonas se reparten entre ellas por camas, como en "Población y cobertura" de Inteligencia: su población y sus afiliados cuentan solo por la parte de la zona.',
  'Afiliados: BDUA de la ADRES, solo afiliados activos de los regímenes contributivo y subsidiado (la BDUA no trae el régimen de excepción). EPS principales: suma de las 12 EPS más grandes de cada municipio.',
  'IPS objetivo: IPS activas asignadas hoy a la zona. Camas del REPS si se importaron; si no, las de la ficha. Cirugía ortopédica y neurocirugía: servicios habilitados del REPS importados.',
  'Giros ADRES: van al NIT; si el NIT tiene varias sedes en OpMap se reparten entre ellas por camas, así que nada se suma dos veces.',
]
// Después de la nota de compras públicas (o de la que dice que no se ven)
const NOTAS_FINALES = [
  'Visitas: histórico importado de VMO, por la zona registrada en cada visita.',
  'Nada de esta ventana recalcula asignaciones ni consulta Google.',
]

// Solo para quien ve las compras públicas (veComprasPublicas: intelligence:view, como /api/secop/*).
const NOTA_SECOP =
  'Compras públicas (SECOP): también van al NIT y se reparten igual entre sus sedes. Valor adjudicado a cada contratista, sin duplicados entre fuentes, solo material ortopédico y de neurocirugía; los contratos fuera de escala y los servicios de especialistas no suman.'
const NOTA_SIN_SECOP = 'Las compras públicas (SECOP) de la zona se ven con el acceso a Inteligencia.'

const toNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

function dbError(label: string, error: unknown): Error {
  const message = (error as { message?: string } | null)?.message ?? String(error)
  return Object.assign(new Error(`Error leyendo ${label}: ${message}`), { dbError: error })
}

/**
 * Una fuente opcional: si falla (tabla o función ausente, tiempo de espera…), la ventana muestra "sin datos" en esa
 * cifra y una nota, y el resto responde. El error queda en el registro del servidor.
 */
async function opcional<T>(label: string, avisos: string[], load: () => Promise<T>): Promise<T | null> {
  try {
    return await load()
  } catch (error) {
    console.error(`[api] executives/[id]/estadisticas · ${label}:`, error)
    avisos.push(`No se pudo leer ${label}: esa cifra aparece como "sin datos".`)
    return null
  }
}

interface LineRow {
  id: string
  code: string
  name: string
  max_reach_minutes: number
}

async function loadLineas(): Promise<LineRow[]> {
  const { data, error } = await supabaseAdmin
    .from('business_lines')
    .select('id, code, name, max_reach_minutes')
    .eq('active', true)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })
    .range(0, 999)
  if (error) throw dbError('business_lines', error)
  return (data || []) as LineRow[]
}

async function loadZonas(): Promise<Map<string, ZonaRef>> {
  const { data, error } = await supabaseAdmin.from('kams').select('id, name, base_city, active').range(0, 9999)
  if (error) throw dbError('kams', error)
  const map = new Map<string, ZonaRef>()
  for (const row of (data || []) as Array<{ id: string; name: string | null; base_city: string | null; active: boolean | null }>) {
    map.set(row.id, { kam_id: row.id, nombre: zoneDisplayName(row.name) || 'Zona sin nombre', ciudad_base: row.base_city ?? null, activa: row.active === true })
  }
  return map
}

/** service_flags y fecha de importación del REPS de las IPS activas. */
async function loadFlags(): Promise<Map<string, { service_flags: Record<string, unknown> | null; reps_updated_at: string | null }>> {
  const { data, error } = await fetchAllRows<{ id: string; service_flags: unknown; reps_updated_at: string | null }>((from, to) =>
    supabaseAdmin.from('hospitals').select('id, service_flags, reps_updated_at').eq('active', true).order('id').range(from, to)
  )
  if (error) throw dbError('hospitals', error)
  return new Map(
    data.map(row => [
      row.id,
      {
        service_flags: row.service_flags && typeof row.service_flags === 'object' && !Array.isArray(row.service_flags) ? (row.service_flags as Record<string, unknown>) : null,
        reps_updated_at: row.reps_updated_at ?? null,
      },
    ])
  )
}

/** Proyección DANE (total, cabecera, resto) de un año, por municipio. */
async function loadDaneAreas(anio: number): Promise<Map<string, DaneFila>> {
  const { data, error } = await fetchAllRows<{ municipality_code: string; total: unknown; cabecera: unknown; resto: unknown }>((from, to) =>
    supabaseAdmin.from('dane_proyecciones').select('municipality_code, total, cabecera, resto').eq('anio', anio).order('municipality_code').range(from, to)
  )
  if (error) throw dbError('dane_proyecciones', error)
  const map = new Map<string, DaneFila>()
  for (const row of data) {
    const total = toNumber(row.total)
    if (total !== null) map.set(row.municipality_code, { total, cabecera: toNumber(row.cabecera), resto: toNumber(row.resto) })
  }
  return map
}

async function loadMunicipalityZoneCalculo(): Promise<string | null> {
  const { data, error } = await supabaseAdmin.from('municipality_zone').select('computed_at').order('computed_at', { ascending: false }).limit(1)
  if (error) throw dbError('municipality_zone', error)
  return (data?.[0] as { computed_at?: string | null } | undefined)?.computed_at ?? null
}

/** Fecha de la última visita importada de VMO (sin las anuladas de la app). */
async function loadUltimaVisitaVmo(): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('visits')
    .select('visit_date')
    .eq('source', 'vmo_import')
    .is('deleted_at', null)
    .order('visit_date', { ascending: false })
    .limit(1)
  if (error) throw dbError('visits', error)
  return (data?.[0] as { visit_date?: string | null } | undefined)?.visit_date ?? null
}

/** Visitas de VMO de unas zonas (todas las fechas: la ventana y la última visita se calculan en lib/zona-estadisticas). */
async function loadVisitasZonas(kamIds: string[]): Promise<VisitaFila[]> {
  if (kamIds.length === 0) return []
  const { data, error } = await fetchAllRows<VisitaFila>((from, to) =>
    supabaseAdmin
      .from('visits')
      .select('kam_id, visit_date, visit_type, contact_type, hospital_id')
      .in('kam_id', kamIds)
      .eq('source', 'vmo_import')
      .is('deleted_at', null)
      .order('id')
      .range(from, to)
  )
  if (error) throw dbError('visits', error)
  return data
}

// GET /api/executives/[id]/estadisticas — "Datos de la zona" de una persona o vacante: su zona base y su territorio
// (zonas que cubre por línea según coverage), con municipios, población, afiliados, IPS, giros, compras públicas,
// visitas, médicos y cobertura. Solo lectura. Permisos (lib/zona-estadisticas.ts): executives:view (la página) y
// hospitals:view (las cifras salen de las IPS); SECOP solo con intelligence:view (como /api/secop/*), y la cobertura y
// el territorio solo en las líneas que el usuario ve (resolveUserLines, como /api/coverage?line=).
export async function GET(request: NextRequest, { params }: Params) {
  const auth = await requirePermission(request, 'executives:view')
  if (!auth.ok) return auth.response
  if (!puedeVerDatosDeZona(auth.user.role)) return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
  const verSecop = veComprasPublicas(auth.user.role)
  const verMedicos = hasPermission(auth.user.role, 'terceros:view')

  if (!UUID_RE.test(params.id)) return NextResponse.json({ error: 'ID de Ejecutivo Comercial no válido' }, { status: 400 })
  const executiveId = params.id.toLowerCase()

  try {
    const { data: executiveData, error: executiveError } = await supabaseAdmin
      .from('executives')
      .select('id, full_name, status, base_kam_id, created_at')
      .eq('id', executiveId)
      .limit(1)
    if (executiveError) throw dbError('executives', executiveError)
    const executive = (executiveData?.[0] ?? null) as {
      id: string
      full_name: string
      status: 'active' | 'placeholder' | 'inactive'
      base_kam_id: string | null
      created_at: string | null
    } | null
    if (!executive) return NextResponse.json({ error: 'Ejecutivo Comercial no encontrado' }, { status: 404 })

    const hoy = hoyBogota()
    const avisos: string[] = []

    const lineasPromise = loadLineas()
    // Cobertura solo de las líneas que ve el usuario: las demás ni se leen.
    const visiblesPromise = Promise.all([lineasPromise, resolveUserLines(auth.user)]).then(([lineas, me]) => ({
      todas: me.canSeeAll,
      lineas: lineasConCobertura(lineas, me),
    }))
    const coberturasPromise = visiblesPromise.then(visibles =>
      Promise.all(
        visibles.lineas.map(line => loadCoverageResponse({ id: line.id, code: line.code, name: line.name, max_reach_minutes: line.max_reach_minutes } as CoverageLineInfo))
      )
    )
    const [lineas, visibles, coberturas, executiveLines, zonas, hospitalData, flags, reach, base, mzCalculo, cortes, medicosFilas, ultimaVmo, secopActualizado] =
      await Promise.all([
        lineasPromise,
        visiblesPromise,
        coberturasPromise,
        supabaseAdmin
          .from('executive_lines')
          .select('line_id')
          .eq('executive_id', executiveId)
          .range(0, 999)
          .then(({ data, error }) => {
            if (error) throw dbError('executive_lines', error)
            return new Set(((data || []) as Array<{ line_id: string }>).map(row => row.line_id))
          }),
        loadZonas(),
        loadPoblacionHospitals(null),
        loadFlags(),
        loadReachZones(),
        loadMunicipalityBase(),
        opcional('el cálculo de municipios por zona', avisos, loadMunicipalityZoneCalculo),
        loadPoblacionCortes(),
        // Cuántos médicos visita: solo para quien ve Terceros (terceros:view), como en /terceros.
        verMedicos
          ? fetchAllRows<{ medico_id: string; line_id: string }>((from, to) =>
              supabaseAdmin
                .from('medico_visitantes')
                .select('medico_id, line_id')
                .eq('executive_id', executiveId)
                .is('hasta', null)
                .order('id')
                .range(from, to)
            ).then(({ data, error }) => {
              if (error) throw dbError('medico_visitantes', error)
              return data
            })
          : Promise.resolve([] as Array<{ medico_id: string; line_id: string }>),
        opcional('el histórico de visitas de VMO', avisos, loadUltimaVisitaVmo),
        verSecop ? opcional('la fecha de actualización de SECOP', avisos, loadSecopActualizado) : Promise.resolve(null),
      ])

    const toRef = (line: LineRow): LineaRef => ({ id: line.id, code: line.code, name: line.name })
    const lineRefs: LineaRef[] = lineas.map(toRef)
    const lineasCobertura: LineaRef[] = visibles.lineas.map(toRef)
    const entradas: CoberturaLineaEntrada[] = coberturas.map((cobertura, index) => ({
      line: lineasCobertura[index],
      rows: cobertura.rows.map(row => ({
        kam_id: row.kam_id,
        zone_name: row.zone_name,
        kind: row.kind,
        executive: row.executive ? { id: row.executive.id, full_name: row.executive.full_name, status: row.executive.status } : null,
        travel_minutes: row.travel_minutes,
        nearest: row.nearest ? { full_name: row.nearest.full_name, minutes: row.nearest.minutes } : null,
      })),
    }))
    const coberturaEjecutivo = coberturaDeEjecutivo(entradas, executive.id, executiveLines)
    const territorioIds = zonasDelTerritorio(coberturaEjecutivo)
    const baseIds = executive.base_kam_id ? [executive.base_kam_id] : []
    const todasIds = Array.from(new Set([...baseIds, ...territorioIds]))

    const hospitals: HospitalZona[] = hospitalData.hospitals.map(hospital => ({
      ...hospital,
      service_flags: flags.get(hospital.id)?.service_flags ?? null,
      reps_updated_at: flags.get(hospital.id)?.reps_updated_at ?? null,
    }))
    const enGrupo = new Set(todasIds)
    const nits = Array.from(
      new Set(hospitals.filter(hospital => hospital.kam_id && enGrupo.has(hospital.kam_id)).map(hospital => nitOfHospital(hospital)).filter((nit): nit is string => Boolean(nit)))
    )

    const daneAnio = cortes.dane.length > 0 ? pickDaneYear(hoy, cortes.dane) : Number(hoy.slice(0, 4))
    const bduaCorte = cortes.bdua.length > 0 ? cortes.bdua[cortes.bdua.length - 1] : null
    const secopVentana = ventanaMeses(hoy, ZONA_SECOP_MESES)
    const visitasVentana = ventanaVisitas(ultimaVmo)

    const [dane, bdua, giros, facts, visitas] = await Promise.all([
      daneAnio !== null ? opcional('las proyecciones del DANE', avisos, () => loadDaneAreas(daneAnio)) : Promise.resolve(null),
      bduaCorte ? opcional('los afiliados de la BDUA', avisos, () => loadBduaResumen(bduaCorte)) : Promise.resolve(null),
      opcional('los giros de la ADRES', avisos, () => loadGirosTotales(hospitals.map(hospital => hospital.code))),
      verSecop ? opcional('las compras públicas de SECOP', avisos, () => loadHechos({ desde: secopVentana.desde, hasta: secopVentana.hasta, nits })) : Promise.resolve(null),
      visitasVentana ? opcional('las visitas de VMO', avisos, () => loadVisitasZonas(todasIds)) : Promise.resolve(null),
    ])

    const datos: DatosZonas = {
      zonas,
      hospitals,
      shares: municipioZoneShares(hospitals, reach.value),
      conIps: municipiosConIps(hospitals),
      municipios: new Map(base.municipalities.map(m => [m.code, { name: m.name, department_code: m.department_code }])),
      departamentos: base.departmentNames,
      dane: dane && dane.size > 0 && daneAnio !== null ? { anio: daneAnio, filas: dane } : null,
      bdua: bdua && bduaCorte ? { corte: bduaCorte, regimen: bdua.regimen, eps: bdua.eps } : null,
      giros:
        giros && giros.info.fuente && giros.info.desde && giros.info.hasta
          ? {
              porIps: hospitalGiroMap(hospitals, giros.totals),
              fuente: giros.info.fuente,
              desde: giros.info.desde,
              hasta: giros.info.hasta,
              regimenes: giros.info.regimenes,
            }
          : null,
      secop: facts
        ? { facts, desde: secopVentana.desde, hasta: secopVentana.hasta, actualizado: secopActualizado ? ultimaFecha(Object.values(secopActualizado)) : null }
        : null,
      visitas: visitas && visitasVentana ? { ventana: visitasVentana, filas: visitas } : null,
    }

    const notas = [...NOTAS, verSecop ? NOTA_SECOP : NOTA_SIN_SECOP, ...NOTAS_FINALES]
    if (!visibles.todas) {
      notas.push(
        lineasCobertura.length > 0
          ? `Cobertura y territorio: solo en las líneas que lideras o llevas (${lineasCobertura.map(line => line.name).join(', ')}), como en el mapa y en Líneas.`
          : 'Cobertura y territorio: solo se ven en las líneas que lideras o llevas, y tu usuario no tiene ninguna.'
      )
    }
    if (!reach.available) notas.push('Sin la tabla municipality_zone: los municipios sin IPS no se cuentan.')
    if (giros && !giros.info.fuente) notas.push('Aún no hay giros de la ADRES cargados.')

    const coberturaCalculada = ultimaFecha(coberturas.map(item => item.computed_at))
    const body: ZonaEstadisticasResponse = {
      executive: {
        id: executive.id,
        full_name: executive.full_name,
        status: executive.status,
        created_at: executive.created_at,
        lineas: lineRefs.filter(line => executiveLines.has(line.id)),
      },
      zonaBase: executive.base_kam_id
        ? zonas.get(executive.base_kam_id) ?? { kam_id: executive.base_kam_id, nombre: 'Zona sin nombre', ciudad_base: null, activa: false }
        : null,
      base: baseIds.length > 0 ? construirBloque(baseIds, datos) : null,
      territorio: territorioIds.length > 0 ? construirBloque(territorioIds, datos) : null,
      territorioIgualBase: territorioIds.length > 0 && mismasZonas(territorioIds, baseIds),
      coberturaBase: executive.base_kam_id ? coberturaDeZona(entradas, executive.base_kam_id) : [],
      coberturaEjecutivo,
      coberturaCalculada,
      coberturaDesactualizada: coberturaDesactualizada(executive.created_at, coberturaCalculada),
      medicos: verMedicos ? contarMedicos(medicosFilas, lineRefs) : null,
      fuentes: {
        municipiosCalculados: mzCalculo,
        poblacionAnio: datos.dane?.anio ?? null,
        bduaCorte: datos.bdua?.corte ?? null,
      },
      acceso: { comprasPublicas: verSecop, todasLasLineas: visibles.todas, lineasCobertura },
      notas: [...notas, ...avisos],
      generado: new Date().toISOString(),
    }
    return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return serverError('executives/[id]/estadisticas GET', error, 'Error al cargar los datos de la zona')
  }
}
