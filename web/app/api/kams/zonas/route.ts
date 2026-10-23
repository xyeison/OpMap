// GET /api/kams/zonas?line=<code> — la pantalla "Zonas" de las líderes (spec docs/specs/2026-10-23-zonas-por-linea-para-lideres.md;
// decisión del dueño en docs/decisiones/2026-10-23-zonas-por-linea-las-lideres-asignan.md).
//
// Qué devuelve (ZonasResponse, lib/types/zonas.ts): una fila por Zona activa con
//   - qué hay en la Zona (igual para todas las líneas): IPS y camas, municipios (con IPS, de alcance, compartidos),
//     departamentos, población DANE, afiliados BDUA y giros ADRES de 12 meses. Las cuentas salen de
//     construirBloque([kam_id], datos) (lib/zona-estadisticas.ts): las mismas reglas de "Datos de la zona" (municipio
//     con IPS de varias Zonas repartido por camas, giro del NIT repartido por sedes, nada dos veces);
//   - quién vive en la Zona (executives active/placeholder con base_kam_id), con sus líneas y las que la dirección le
//     permitió (executive_allowed_lines, migración 0860; sin la tabla → null y una nota, nunca 500);
//   - el estado de la Zona en la línea elegida, derivado de la cobertura CALCULADA EN MEMORIA (computeCoverage →
//     estadoDePlaza), no de la tabla coverage, que puede estar vieja;
//   - Bogotá agregada (las celdas con area_id de 7 dígitos) con sus cifras sumadas.
// Si la cobertura guardada no coincide con la calculada (coberturaDesactualizada), la ruta recalcula y GUARDA
// (recomputeAndSaveCoverage, sin Google) y responde cobertura.recalculada = true; si falla el guardado, lo registra y
// sigue con el cálculo en memoria (nunca 500 por eso).
//
// Quién: sesión + puedeVerDatosDeZona (executives:view y hospitals:view: recursos humanos recibe 403 sin leer nada).
// La línea sale de findAccessibleLine (403 si no la ve); sin ?line= se toma la primera de resolveUserLines; si el usuario
// no tiene líneas, linea: null y enLinea: null. Quien no ve todas las líneas (map:all-lines) nunca recibe códigos,
// nombres ni ids de líneas que no ve: las líneas de cada residente y sus líneas permitidas se recortan a las suyas
// (como /api/map/data). Los residentes sí salen todos: la líder necesita ver quién vive en la Zona para darle su línea.
// Nada de esta ruta calcula rutas ni consulta Google.
//
// `cargarDatosZonas` vive aquí mientras no exista app/api/kams/_lib/zonas-server.ts (la spec la extrae de
// app/api/executives/[id]/estadisticas/route.ts); cuando exista, se sustituye este bloque por el import.
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUser } from '@/lib/require-role'
import { hasPermission } from '@/lib/permissions'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { fetchAllRows, serverError } from '@/app/api/_lib/api-error'
import { jsonError, zodMessage } from '@/app/api/kams/_lib/kam-shared'
import {
  LINE_CODE_RE,
  canEditCoverageLine,
  computeCoverage,
  computeZoneMatrix,
  findAccessibleLine,
  loadCoverageInputs,
  recomputeAndSaveCoverage,
  resolveUserLines,
} from '@/lib/coverage'
import { coberturaDesactualizada, estadoDePlaza, type CeldaComparable } from '@/lib/cobertura-simulacion'
import { zoneDisplayName } from '@/lib/zone-names'
import { hospitalGiroMap, municipioZoneShares, pickDaneYear } from '@/lib/poblacion-intelligence'
import {
  construirBloque,
  fechaEs,
  municipiosConIps,
  puedeVerDatosDeZona,
  rangoMesesEs,
  veComprasPublicas,
  type BloqueZona,
  type DaneFila,
  type DatosZonas,
  type HospitalZona,
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
import { isMissingRelationError } from '@/app/api/intelligence/_lib/giros-server'
import { hoyBogota } from '@/app/api/secop/_lib/hoy'
import type { ComputedCoverage, CoverageInputs, CoverageLineInfo } from '@/lib/types/coverage'
import type { EjecutivoRef, ZonaCifras, ZonaEnLinea, ZonaFila, ZonaResidente, ZonasResponse } from '@/lib/types/zonas'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const NO_STORE = { 'Cache-Control': 'no-store' }

/** ?line= opcional: código de línea en minúsculas (LINE_CODE_RE, como /api/coverage). */
const querySchema = z.object({
  line: z
    .string()
    .trim()
    .toLowerCase()
    .regex(LINE_CODE_RE, 'Código de línea no válido')
    .optional(),
})

const GIROS_FUENTE_LABEL: Record<'identifica' | 'reporte29', string> = {
  identifica: 'Identifica tu Giro, contributivo y subsidiado',
  reporte29: 'Reporte 29, solo subsidiado',
}

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
 * Una fuente opcional: si falla (tabla o función ausente, tiempo de espera…), esa cifra sale "sin datos" con una nota y
 * el resto responde. El error queda en el registro del servidor.
 */
async function opcional<T>(label: string, avisos: string[], load: () => Promise<T>): Promise<T | null> {
  try {
    return await load()
  } catch (error) {
    console.error(`[api] kams/zonas · ${label}:`, error)
    avisos.push(`No se pudo leer ${label}: esa cifra aparece como "sin datos".`)
    return null
  }
}

// ---------------------------------------------------------------------------
// cargarDatosZonas — lo que construirBloque necesita, una sola vez por petición (sin visitas, médicos ni SECOP:
// ZonaCifras no los trae). Sustituir por `import { cargarDatosZonas } from '../_lib/zonas-server'` cuando exista.
// ---------------------------------------------------------------------------

async function loadZonas(): Promise<Map<string, ZonaRef>> {
  const { data, error } = await supabaseAdmin.from('kams').select('id, name, base_city, active').range(0, 9999)
  if (error) throw dbError('kams', error)
  const map = new Map<string, ZonaRef>()
  for (const row of (data || []) as Array<{ id: string; name: string | null; base_city: string | null; active: boolean | null }>) {
    map.set(row.id, { kam_id: row.id, nombre: zoneDisplayName(row.name) || 'Zona sin nombre', ciudad_base: row.base_city ?? null, activa: row.active === true })
  }
  return map
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

interface DatosCargados {
  datos: DatosZonas
  /** municipality_zone existe (sin ella los municipios sin IPS no se cuentan). */
  alcanceDisponible: boolean
  /** Hay tablas de giros pero ninguna fuente con giros cargados. */
  girosSinCargar: boolean
}

async function cargarDatosZonas(avisos: string[]): Promise<DatosCargados> {
  const hoy = hoyBogota()
  const [zonas, hospitalData, reach, base, cortes] = await Promise.all([
    loadZonas(),
    loadPoblacionHospitals(null),
    loadReachZones(),
    loadMunicipalityBase(),
    loadPoblacionCortes(),
  ])
  // Los servicios del REPS no entran en las cifras de esta pantalla: se dejan vacíos para no leer hospitals dos veces.
  const hospitals: HospitalZona[] = hospitalData.hospitals.map(hospital => ({ ...hospital, service_flags: null, reps_updated_at: null }))

  const daneAnio = cortes.dane.length > 0 ? pickDaneYear(hoy, cortes.dane) : Number(hoy.slice(0, 4))
  const bduaCorte = cortes.bdua.length > 0 ? cortes.bdua[cortes.bdua.length - 1] : null

  const [dane, bdua, giros] = await Promise.all([
    daneAnio !== null ? opcional('las proyecciones del DANE', avisos, () => loadDaneAreas(daneAnio)) : Promise.resolve(null),
    bduaCorte ? opcional('los afiliados de la BDUA', avisos, () => loadBduaResumen(bduaCorte)) : Promise.resolve(null),
    opcional('los giros de la ADRES', avisos, () => loadGirosTotales(hospitals.map(hospital => hospital.code))),
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
    secop: null,
    visitas: null,
  }
  return { datos, alcanceDisponible: reach.available, girosSinCargar: Boolean(giros && !giros.info.fuente) }
}

// ---------------------------------------------------------------------------
// Lecturas propias de la pantalla
// ---------------------------------------------------------------------------

/** La tabla coverage tal como está guardada (para compararla con el cálculo) y su fecha. */
async function loadCoberturaGuardada(): Promise<{ celdas: CeldaComparable[]; calculadaEn: string | null }> {
  const { data, error } = await fetchAllRows<{ line_id: string; kam_id: string; executive_id: string | null; kind: string; computed_at: string | null }>((from, to) =>
    supabaseAdmin.from('coverage').select('line_id, kam_id, executive_id, kind, computed_at').order('line_id').order('kam_id').range(from, to)
  )
  if (error) throw dbError('coverage', error)
  let calculadaEn: string | null = null
  for (const row of data) if (row.computed_at && (!calculadaEn || row.computed_at > calculadaEn)) calculadaEn = row.computed_at
  return { celdas: data.map(row => ({ line_id: row.line_id, kam_id: row.kam_id, kind: row.kind, executive_id: row.executive_id })), calculadaEn }
}

/** Ciudad base y color de cada Zona (el motor solo lee id, nombre, área y estado). */
async function loadKamsDetalle(): Promise<Map<string, { base_city: string | null; color: string | null }>> {
  const { data, error } = await supabaseAdmin.from('kams').select('id, base_city, color').range(0, 9999)
  if (error) throw dbError('kams', error)
  return new Map(
    ((data || []) as Array<{ id: string; base_city: string | null; color: string | null }>).map(row => [row.id, { base_city: row.base_city ?? null, color: row.color ?? null }])
  )
}

/**
 * Líneas permitidas por la dirección (executive_allowed_lines, migración 0860): ejecutivo → ids de línea. null si la
 * tabla no existe o no se pudo leer (se anota y la pantalla sigue: nunca 500 por eso).
 */
async function loadLineasPermitidas(avisos: string[]): Promise<Map<string, string[]> | null> {
  const { data, error } = await fetchAllRows<{ executive_id: string; line_id: string }>((from, to) =>
    supabaseAdmin.from('executive_allowed_lines').select('executive_id, line_id').order('executive_id').order('line_id').range(from, to)
  )
  if (error) {
    if (!isMissingRelationError(error)) console.error('[api] kams/zonas · executive_allowed_lines:', error)
    avisos.push('Líneas permitidas: no se pudieron leer (falta la migración 0860 o la tabla no respondió); nadie aparece limitado.')
    return null
  }
  const map = new Map<string, string[]>()
  for (const row of data) {
    const list = map.get(row.executive_id) || []
    list.push(row.line_id)
    map.set(row.executive_id, list)
  }
  return map
}

// ---------------------------------------------------------------------------
// Armado de la respuesta
// ---------------------------------------------------------------------------

/** ZonaCifras desde un BloqueZona: "sin dato" (null) cuando ningún municipio del bloque tiene la cifra. */
function cifrasDe(bloque: BloqueZona): ZonaCifras {
  const sinDato = (municipiosSinDato: number) => bloque.municipios.total === 0 || municipiosSinDato >= bloque.municipios.total
  const poblacion = bloque.poblacion && !sinDato(bloque.poblacion.municipiosSinDato) ? bloque.poblacion : null
  const afiliados = bloque.afiliados && !sinDato(bloque.afiliados.municipiosSinDato) ? bloque.afiliados : null
  return {
    ips: bloque.ips.total,
    camas: bloque.ips.camas,
    municipios: bloque.municipios.total,
    municipiosConIps: bloque.municipios.conIps,
    municipiosAlcance: bloque.municipios.alcance,
    municipiosCompartidos: bloque.municipios.compartidos,
    departamentos: bloque.municipios.departamentos.map(departamento => departamento.nombre),
    poblacion: poblacion?.total ?? null,
    poblacionAnio: poblacion?.anio ?? null,
    afiliados: afiliados?.total ?? null,
    afiliadosCorte: afiliados?.corte ?? null,
    giros12m: bloque.giros?.valor ?? null,
    girosFuente: bloque.giros?.fuente ?? null,
    girosDesde: bloque.giros?.desde ?? null,
    girosHasta: bloque.giros?.hasta ?? null,
  }
}

const compareEs = (a: string, b: string) => a.localeCompare(b, 'es', { sensitivity: 'base' })

export async function GET(request: NextRequest) {
  const auth = await requireUser(request)
  if (!auth.ok) return auth.response
  const user = auth.user
  if (!puedeVerDatosDeZona(user.role)) return jsonError('Acceso denegado', 403)

  const parsed = querySchema.safeParse({ line: request.nextUrl.searchParams.get('line') ?? undefined })
  if (!parsed.success) return jsonError(zodMessage(parsed.error), 400)
  const codigo = parsed.data.line

  try {
    // Línea elegida: la pedida (403 si no la ve) o la primera de las suyas; sin líneas, ninguna.
    const me = await resolveUserLines(user)
    let linea: CoverageLineInfo | null = null
    if (codigo) {
      const access = await findAccessibleLine(user, codigo, supabaseAdmin, me)
      if (!access) return jsonError('No tienes acceso a esta línea', 403)
      linea = access.line
    } else if (me.lines.length > 0) {
      const access = await findAccessibleLine(user, me.lines[0].code, supabaseAdmin, me)
      linea = access?.line ?? null
    }

    const avisos: string[] = []
    const [inputs, guardada, kamsDetalle, permitidas, cargados] = await Promise.all([
      loadCoverageInputs(),
      loadCoberturaGuardada(),
      loadKamsDetalle(),
      loadLineasPermitidas(avisos),
      cargarDatosZonas(avisos),
    ])
    const { datos } = cargados

    // Cobertura calculada en memoria; si la guardada difiere, se recalcula y guarda (sin Google).
    const matrix = computeZoneMatrix(inputs.zones, inputs.hospitals, inputs.distances)
    const calculada = computeCoverage(inputs, matrix)
    const desactualizada = coberturaDesactualizada(guardada.celdas, calculada)
    let recalculada = false
    let calculadaEn = guardada.calculadaEn
    if (desactualizada) {
      try {
        await recomputeAndSaveCoverage()
        recalculada = true
        calculadaEn = new Date().toISOString()
      } catch (error) {
        console.error('[api] kams/zonas · la cobertura estaba desactualizada y no se pudo guardar el recálculo:', error)
        avisos.push('La cobertura guardada estaba desactualizada y no se pudo guardar el recálculo; lo que ves es el cálculo de ahora. Usa "Recalcular cobertura".')
      }
    }

    // Acciones: dar/quitar la línea (executives:lines) y ajustes (coverage:edit) solo en una línea que puede editar
    // (canEditCoverageLine: la líder, la suya); la administración de Zonas con kams:edit.
    const editable = linea ? await canEditCoverageLine(user, linea.id) : false
    const body = armarRespuesta({ me, linea, inputs, calculada, kamsDetalle, permitidas, cargados, cobertura: { calculadaEn, desactualizada, recalculada }, avisos })
    body.acceso = {
      asignar: hasPermission(user.role, 'executives:lines') && editable,
      ajustar: hasPermission(user.role, 'coverage:edit') && editable,
      comprasPublicas: veComprasPublicas(user.role),
      administrar: hasPermission(user.role, 'kams:edit'),
    }
    return NextResponse.json(body, { headers: NO_STORE })
  } catch (error) {
    return serverError('kams/zonas GET', error, 'Error al cargar las Zonas')
  }
}

interface ArmarParams {
  me: Awaited<ReturnType<typeof resolveUserLines>>
  linea: CoverageLineInfo | null
  inputs: CoverageInputs
  calculada: ComputedCoverage[]
  kamsDetalle: Map<string, { base_city: string | null; color: string | null }>
  permitidas: Map<string, string[]> | null
  cargados: DatosCargados
  cobertura: ZonasResponse['cobertura']
  avisos: string[]
}

function armarRespuesta(params: ArmarParams): ZonasResponse {
  const { me, linea, inputs, calculada, kamsDetalle, permitidas, cargados, cobertura, avisos } = params
  const { datos } = cargados

  // Líneas que el usuario ve: nada de las demás sale en la respuesta (códigos, nombres ni ids).
  const visibles = me.canSeeAll ? null : new Set(me.lines.map(line => line.id))
  const veLinea = (lineId: string) => visibles === null || visibles.has(lineId)
  const lineasActivas = inputs.lines.filter(line => line.active)
  const ordenLinea = new Map(lineasActivas.map((line, index) => [line.id, index]))
  const codigoDe = new Map(lineasActivas.map(line => [line.id, line.code]))
  const codigosVisibles = (lineIds: Iterable<string>) =>
    Array.from(new Set(lineIds))
      .filter(id => codigoDe.has(id) && veLinea(id))
      .sort((a, b) => (ordenLinea.get(a) ?? 0) - (ordenLinea.get(b) ?? 0))
      .map(id => codigoDe.get(id)!)

  const zonasActivas = inputs.zones
    .filter(zone => zone.active)
    .map(zone => ({ ...zone, nombre: zoneDisplayName(zone.name) || 'Zona sin nombre' }))
    .sort((a, b) => compareEs(a.nombre, b.nombre) || a.id.localeCompare(b.id))
  const nombreZona = new Map(inputs.zones.map(zone => [zone.id, zoneDisplayName(zone.name) || 'Zona sin nombre']))

  const ejecutivos = new Map(inputs.executives.map(executive => [executive.id, executive]))
  const refDe = (id: string): EjecutivoRef => {
    const executive = ejecutivos.get(id)
    return { id, nombre: executive?.full_name ?? 'Ejecutivo Comercial', status: executive?.status === 'placeholder' ? 'placeholder' : 'active' }
  }
  const lineasPorEjecutivo = new Map<string, string[]>()
  for (const link of inputs.executiveLines) {
    const list = lineasPorEjecutivo.get(link.executive_id) || []
    list.push(link.line_id)
    lineasPorEjecutivo.set(link.executive_id, list)
  }
  const residentesDe = (kamId: string): ZonaResidente[] =>
    inputs.executives
      .filter(executive => executive.base_kam_id === kamId && (executive.status === 'active' || executive.status === 'placeholder'))
      .sort((a, b) => compareEs(a.full_name, b.full_name) || a.id.localeCompare(b.id))
      .map(executive => {
        const limitadas = permitidas?.get(executive.id)
        return {
          id: executive.id,
          nombre: executive.full_name,
          status: executive.status === 'placeholder' ? 'placeholder' : 'active',
          lineas: codigosVisibles(lineasPorEjecutivo.get(executive.id) || []),
          lineasPermitidas: limitadas && limitadas.length > 0 ? codigosVisibles(limitadas) : null,
        }
      })

  const motivoAjuste = new Map(inputs.overrides.map(override => [override.id, override.reason]))
  const celdasLinea = linea ? new Map(calculada.filter(row => row.line_id === linea.id).map(row => [row.kam_id, row])) : null
  const enLineaDe = (kamId: string): ZonaEnLinea | null => {
    const row = celdasLinea?.get(kamId)
    if (!row) return null
    const ejecutivo = row.executive_id ? refDe(row.executive_id) : null
    const local = row.kind === 'local' || row.source_kam_id === kamId
    return {
      estado: estadoDePlaza(row.kind, ejecutivo, row.has_equipment),
      ejecutivo,
      desde: !local && row.source_kam_id ? { kam_id: row.source_kam_id, nombre: nombreZona.get(row.source_kam_id) ?? 'Zona sin nombre' } : null,
      minutos: row.travel_minutes,
      masCercano: row.nearest_executive_id ? { ...refDe(row.nearest_executive_id), minutos: row.nearest_minutes } : null,
      ajuste: row.override_id ? { id: row.override_id, motivo: motivoAjuste.get(row.override_id) ?? '' } : null,
      sinEquipo: !row.has_equipment,
      nota: row.note,
    }
  }

  const departamentoDe = (areaId: string): string | null => {
    const municipio = datos.municipios.get(areaId.trim().slice(0, 5))
    return municipio ? datos.departamentos.get(municipio.department_code) ?? null : null
  }

  const zonas: ZonaFila[] = zonasActivas.map(zone => ({
    kam_id: zone.id,
    nombre: zone.nombre,
    ciudad_base: kamsDetalle.get(zone.id)?.base_city ?? datos.zonas.get(zone.id)?.ciudad_base ?? null,
    departamento: departamentoDe(zone.area_id),
    area_id: zone.area_id,
    color: kamsDetalle.get(zone.id)?.color ?? null,
    bogota: zone.area_id.trim().length === 7,
    cifras: cifrasDe(construirBloque([zone.id], datos)),
    residentes: residentesDe(zone.id),
    enLinea: enLineaDe(zone.id),
  }))

  const celdasBogota = zonas.filter(zona => zona.bogota).map(zona => zona.kam_id)
  const bogota = celdasBogota.length > 0 ? { kam_ids: celdasBogota, cifras: cifrasDe(construirBloque(celdasBogota, datos)) } : null

  // Notas: fuentes y cortes reales, Bogotá, IPS sin Zona, líneas que ve, y la promesa de que nada llama a Google.
  const ipsSinZona = datos.hospitals.filter(hospital => !hospital.kam_id).length
  const notas: string[] = [
    'Qué hay en la Zona: IPS activas asignadas hoy y sus camas (REPS si se importaron; si no, la ficha); municipios con IPS y los que le llegan por tiempo real de carretera (municipality_zone). Un municipio con IPS de varias Zonas se reparte por camas: nada se cuenta dos veces.',
    datos.dane ? `Población: proyección del DANE para ${datos.dane.anio}, cada municipio por la parte que le toca a la Zona.` : 'Población: sin proyecciones del DANE cargadas.',
    datos.bdua ? `Afiliados: BDUA de la ADRES con corte ${fechaEs(datos.bdua.corte)}, solo activos de contributivo y subsidiado.` : 'Afiliados: sin BDUA de la ADRES cargada.',
    datos.giros
      ? `Giros ADRES de 12 meses (${GIROS_FUENTE_LABEL[datos.giros.fuente]}; ${rangoMesesEs(datos.giros.desde, datos.giros.hasta)}): van al NIT y se reparten entre sus sedes por camas.`
      : cargados.girosSinCargar
        ? 'Aún no hay giros de la ADRES cargados.'
        : 'Giros ADRES: sin datos.',
    cobertura.recalculada
      ? 'Cobertura actualizada ahora: la guardada no coincidía con las líneas y Zonas de hoy, así que se recalculó y guardó (sin Google).'
      : cobertura.calculadaEn
        ? `Cobertura calculada el ${fechaEs(cobertura.calculadaEn)}.`
        : 'Quién atiende cada Zona sale del cálculo de ahora; la cobertura aún no se ha guardado.',
  ]
  if (bogota) notas.push('Bogotá: cada celda cuenta la parte de la ciudad que le toca por camas más sus municipios de alcance; "Bogotá (4 zonas)" suma las cuatro.')
  if (ipsSinZona > 0) notas.push(`${ipsSinZona} IPS activa${ipsSinZona === 1 ? '' : 's'} sin Zona no entra${ipsSinZona === 1 ? '' : 'n'} en ninguna fila.`)
  if (!cargados.alcanceDisponible) notas.push('Sin la tabla municipality_zone: los municipios sin IPS no se cuentan.')
  if (!me.canSeeAll) {
    notas.push(
      me.lines.length > 0
        ? `Quién atiende cada Zona: solo en las líneas que lideras o llevas (${me.lines.map(line => line.name).join(', ')}), como en el mapa y en Líneas.`
        : 'Quién atiende cada Zona: solo se ve en las líneas que lideras o llevas, y tu usuario no tiene ninguna; aquí ves qué hay en cada Zona y quién vive en ella.'
    )
  }
  notas.push('Nada de esta pantalla calcula rutas ni consulta Google.')

  return {
    linea: linea ? { id: linea.id, code: linea.code, name: linea.name, max_reach_minutes: linea.max_reach_minutes } : null,
    lineas: me.lines.map(line => ({ id: line.id, code: line.code, name: line.name })),
    zonas,
    bogota,
    cobertura,
    acceso: { asignar: false, ajustar: false, comprasPublicas: false, administrar: false },
    notas: [...notas, ...avisos],
  }
}
