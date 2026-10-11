// Fase 3 · Inteligencia con los giros directos de la ADRES.
// Funciones PURAS (sin base de datos): las usan GET /api/intelligence/giros, la ficha de IPS
// (GET /api/intelligence/giros/hospital/[id]) y scripts/adres-check.ts.
//
// Dos fuentes: 'reporte29' (adres_giros: régimen subsidiado por mes de proceso, tipo y EPS, hasta
// jun-2025) e 'identifica' ("Identifica tu Giro", adres_giros_detalle: un registro por giro con régimen
// contributivo / subsidiado / otro y entidad ordenadora, desde abr-2025). La función SQL
// adres_giros_intel() devuelve las dos con la misma forma (GiroNitResumen).
//
// Regla clave: la ADRES gira al NIT (prestador), no a la sede. Si un NIT tiene varias sedes activas en
// OpMap, su giro se reparte entre ellas en proporción a las camas (a partes iguales si ninguna tiene
// camas) SOLO para agregar por municipio, zona o ejecutivo. Así el total nunca se cuenta dos veces.
import { monthsBetween, nitFromHospitalCode } from './adres-parse.mjs'

export type GirosGroup = 'ips' | 'municipio' | 'zona' | 'ejecutivo'
export const GIROS_GROUPS: readonly GirosGroup[] = ['ips', 'municipio', 'zona', 'ejecutivo'] as const

/** Rango máximo que se puede pedir de una vez (meses). */
export const GIROS_MAX_MONTHS = 60
/** Meses por defecto en /inteligencia y en la ficha de IPS. */
export const GIROS_DEFAULT_MONTHS = 12

export type GirosFuente = 'reporte29' | 'identifica'
export type GirosFuenteParam = 'auto' | GirosFuente
export type GirosRegimen = 'todos' | 'contributivo' | 'subsidiado'
export const GIROS_FUENTES: readonly GirosFuenteParam[] = ['auto', 'reporte29', 'identifica'] as const
export const GIROS_REGIMENES: readonly GirosRegimen[] = ['todos', 'contributivo', 'subsidiado'] as const
/** En 'auto', Identifica tu Giro se usa solo si está cargado para al menos esta fracción de los NIT activos. */
export const IDENTIFICA_MIN_COBERTURA = 0.9
/** Entidades ordenadoras por fila del ranking y en el total. */
export const EPS_TOP_ROW = 3
export const EPS_TOP_TOTAL = 10

export interface GiroMes {
  t: number // total
  c: number // capitación (reporte29)
  e: number // evento (reporte29)
  rc: number // régimen contributivo (identifica)
  rs: number // régimen subsidiado (identifica; en reporte29 = total)
  ro: number // otro régimen / concepto (identifica)
}

/** Un elemento de adres_giros_intel() (o de adres_giros_resumen()): agregado por NIT con su serie mensual ('YYYY-MM'). */
export interface GiroNitResumen {
  nit: string
  total: number
  capitacion: number
  evento: number
  contributivo: number
  subsidiado: number
  otro: number
  /** Último giro: 'YYYY-MM-DD' (identifica) o primer día del último mes de proceso (reporte29). */
  ultima: string | null
  meses: Record<string, GiroMes>
  /** Valor por entidad (clave: NIT de la ordenadora, código de EPS o 'nombre:<texto>'). */
  eps: Record<string, number>
}

export interface EpsShare {
  codigo: string
  nombre: string
  valor: number
  /** % del total de la fila (o del total filtrado en epsTop). */
  pct: number
}

export type IntelCoverageKind = 'local' | 'reach' | 'manual' | 'vacant' | 'conflict'

/** IPS activa con lo necesario para agregar (zona actual y, si hay línea, quién la cubre). */
export interface IntelHospital {
  id: string
  name: string
  code: string | null
  municipality_id: string | null
  municipality_name: string | null
  department_id: string | null
  department_name: string | null
  beds: number | null
  kam_id: string | null
  zone_name: string | null
  executive: { id: string; full_name: string; color: string | null } | null
  coverage_kind: IntelCoverageKind | null
}

export interface GirosFilter {
  departamento?: string | null
  municipio?: string | null
}

export interface GirosKpis {
  /** Giro total de las IPS filtradas (reparto por sede aplicado). */
  total: number
  capitacion: number
  evento: number
  /** Otros tipos de contratación (total − capitación − evento). */
  otros: number
  /** IPS activas filtradas con NIT válido. */
  ipsTotal: number
  ipsConGiro: number
  nitsConGiro: number
  /** Giro de las IPS filtradas que tienen zona asignada hoy. */
  asignado: number
  /** % del total que concentran las IPS con zona asignada (null si el total es 0). */
  asignadoPct: number | null
  sinZona: number
  /** IPS filtradas cuyo código no es un NIT (no se pueden cruzar con la ADRES). */
  ipsSinNit: number
  /** IPS filtradas que comparten NIT con otras sedes (su giro es un reparto estimado). */
  ipsConNitCompartido: number
  /** Por régimen (identifica; en reporte29 todo es subsidiado). */
  contributivo: number
  subsidiado: number
  regimenOtro: number
  /** Último giro de las IPS filtradas con giro (ver GiroNitResumen.ultima). */
  ultimaFecha: string | null
}

export interface GirosSeriesPoint {
  periodo: string // 'YYYY-MM'
  total: number
  capitacion: number
  evento: number
  contributivo: number
  subsidiado: number
  otro: number
}

export interface GirosRow {
  key: string
  label: string
  giro: number
  capitacion: number
  evento: number
  /** % del total filtrado. */
  pct: number
  ips: number
  ipsConGiro: number
  camas: number
  contributivo: number
  subsidiado: number
  otro: number
  /** Último giro (del NIT en 'ips'; el más reciente de sus IPS en los demás grupos). */
  ultima_fecha: string | null
  /** Entidades ordenadoras (o EPS en reporte29) que más giraron a la fila, con el reparto por sede. */
  eps_top: EpsShare[]
  // group = 'ips'
  hospital_id?: string
  nit?: string
  municipio?: string | null
  departamento?: string | null
  zona?: string | null
  ejecutivo?: string | null
  ejecutivo_color?: string | null
  /** Giro total del NIT (prestador) en el rango, antes de repartir entre sedes. */
  giro_nit?: number
  /** Sedes activas en OpMap con este NIT. */
  sedes_nit?: number
  // group = 'municipio' | 'zona' | 'ejecutivo'
  color?: string | null
  zonas?: string[]
  top_ips?: string | null
}

export interface GirosAggregate {
  kpis: GirosKpis
  series: GirosSeriesPoint[]
  rows: GirosRow[]
  /** Entidades ordenadoras que más giraron a las IPS filtradas (EPS_TOP_TOTAL). */
  epsTop: EpsShare[]
}

const round2 = (value: number) => Math.round(value * 100) / 100

/** NIT de la IPS: misma regla que la columna generada hospitals.nit (Fase 3 REPS). */
export function nitOfHospital(hospital: Pick<IntelHospital, 'code'>): string | null {
  return nitFromHospitalCode(hospital.code)
}

/**
 * Parte de cada sede en el giro de su NIT: camas de la sede / camas de todas las sedes activas con
 * ese NIT; a partes iguales si ninguna tiene camas. Se calcula sobre TODAS las IPS activas (no solo
 * las filtradas), para que filtrar por municipio deje solo la parte de las sedes de ese municipio.
 */
export function sedeShares(hospitals: Array<Pick<IntelHospital, 'id' | 'code' | 'beds'>>): Map<string, number> {
  const byNit = new Map<string, Array<Pick<IntelHospital, 'id' | 'code' | 'beds'>>>()
  for (const hospital of hospitals) {
    const nit = nitOfHospital(hospital)
    if (!nit) continue
    const list = byNit.get(nit)
    if (list) list.push(hospital)
    else byNit.set(nit, [hospital])
  }
  const shares = new Map<string, number>()
  byNit.forEach(list => {
    const beds = list.map(h => (typeof h.beds === 'number' && h.beds > 0 ? h.beds : 0))
    const totalBeds = beds.reduce((acc, value) => acc + value, 0)
    list.forEach((hospital, index) => {
      shares.set(hospital.id, totalBeds > 0 ? beds[index] / totalBeds : 1 / list.length)
    })
  })
  return shares
}

/** Cuántas sedes activas hay por NIT. */
export function sedesPorNit(hospitals: Array<Pick<IntelHospital, 'code'>>): Map<string, number> {
  const counts = new Map<string, number>()
  for (const hospital of hospitals) {
    const nit = nitOfHospital(hospital)
    if (nit) counts.set(nit, (counts.get(nit) || 0) + 1)
  }
  return counts
}

export function matchesFilter(hospital: IntelHospital, filter: GirosFilter): boolean {
  if (filter.departamento && (hospital.department_id || '') !== filter.departamento) return false
  if (filter.municipio && (hospital.municipality_id || '') !== filter.municipio) return false
  return true
}

interface Accumulator {
  key: string
  label: string
  giro: number
  capitacion: number
  evento: number
  contributivo: number
  subsidiado: number
  otro: number
  ultima: string | null
  eps: Map<string, number>
  ips: number
  ipsConGiro: number
  camas: number
  color: string | null
  departamento: string | null
  zonas: Set<string>
  top: { name: string; giro: number } | null
}

function newAccumulator(key: string, label: string): Accumulator {
  return {
    key,
    label,
    giro: 0,
    capitacion: 0,
    evento: 0,
    contributivo: 0,
    subsidiado: 0,
    otro: 0,
    ultima: null,
    eps: new Map(),
    ips: 0,
    ipsConGiro: 0,
    camas: 0,
    color: null,
    departamento: null,
    zonas: new Set(),
    top: null,
  }
}

/** Nombre visible de una entidad: el del diccionario, o el texto de 'nombre:<texto>', o la clave. */
export function epsDisplayName(key: string, names: Record<string, string> | undefined): string {
  const name = names?.[key]
  if (name) return name
  return key.startsWith('nombre:') ? key.slice('nombre:'.length) : key
}

/** Top N de un mapa entidad → valor, con % sobre `total`. */
export function topEps(map: Map<string, number>, names: Record<string, string> | undefined, total: number, n: number): EpsShare[] {
  return Array.from(map.entries())
    .filter(([, valor]) => valor > 0)
    .map(([codigo, valor]) => ({ codigo, nombre: epsDisplayName(codigo, names), valor }))
    .sort((a, b) => b.valor - a.valor || a.nombre.localeCompare(b.nombre, 'es'))
    .slice(0, n)
    .map(item => ({ ...item, valor: round2(item.valor), pct: total > 0 ? round2((item.valor / total) * 100) : 0 }))
}

const maxDate = (a: string | null, b: string | null) => (!a ? b : !b ? a : a > b ? a : b)

function addEps(target: Map<string, number>, source: Record<string, number>, share: number) {
  for (const [key, value] of Object.entries(source)) target.set(key, (target.get(key) || 0) + value * share)
}

function executiveGroup(hospital: IntelHospital): { key: string; label: string; color: string | null } {
  if (!hospital.kam_id) return { key: 'sin_zona', label: 'Sin zona asignada', color: null }
  if (hospital.executive) return { key: hospital.executive.id, label: hospital.executive.full_name, color: hospital.executive.color }
  if (hospital.coverage_kind === 'conflict') return { key: 'conflicto', label: 'Conflicto (varios ejecutivos en la zona)', color: '#f59e0b' }
  return { key: 'vacante', label: 'Vacante', color: '#9ca3af' }
}

function executiveLabel(hospital: IntelHospital, withExecutive: boolean): string | null {
  if (!withExecutive) return null
  return executiveGroup(hospital).label
}

/**
 * Agrega los giros por NIT a las IPS filtradas y luego por el grupo pedido.
 * - KPIs y serie mensual sobre las IPS filtradas (con reparto por sede).
 * - rows ordenadas por giro descendente; en 'ips' solo las que tienen giro > 0.
 * @param months meses 'YYYY-MM' del rango (la serie los incluye todos, con 0 si no hay giro)
 * @param withExecutive true si se eligió una línea (columna/agrupación por Ejecutivo Comercial)
 */
export function aggregateGiros(params: {
  hospitals: IntelHospital[]
  giros: GiroNitResumen[]
  months: string[]
  filter: GirosFilter
  group: GirosGroup
  withExecutive: boolean
  /** Nombres de las entidades (diccionario 'eps' de adres_giros_intel()). */
  epsNombres?: Record<string, string>
}): GirosAggregate {
  const { hospitals, giros, months, filter, group, withExecutive, epsNombres } = params
  const shares = sedeShares(hospitals)
  const sedes = sedesPorNit(hospitals)
  const girosByNit = new Map(giros.map(g => [g.nit, g]))

  const kpis: GirosKpis = {
    total: 0,
    capitacion: 0,
    evento: 0,
    otros: 0,
    ipsTotal: 0,
    ipsConGiro: 0,
    nitsConGiro: 0,
    asignado: 0,
    asignadoPct: null,
    sinZona: 0,
    ipsSinNit: 0,
    ipsConNitCompartido: 0,
    contributivo: 0,
    subsidiado: 0,
    regimenOtro: 0,
    ultimaFecha: null,
  }
  const seriesMap = new Map<string, GirosSeriesPoint>(
    months.map(m => [m, { periodo: m, total: 0, capitacion: 0, evento: 0, contributivo: 0, subsidiado: 0, otro: 0 }])
  )
  const nitsWithGiro = new Set<string>()
  const ipsRows: Array<GirosRow & { epsMap: Map<string, number> }> = []
  const groups = new Map<string, Accumulator>()
  const epsTotal = new Map<string, number>()

  for (const hospital of hospitals) {
    if (!matchesFilter(hospital, filter)) continue
    const nit = nitOfHospital(hospital)
    if (!nit) {
      kpis.ipsSinNit++
      continue
    }
    kpis.ipsTotal++
    const sedesNit = sedes.get(nit) || 1
    if (sedesNit > 1) kpis.ipsConNitCompartido++
    const share = shares.get(hospital.id) ?? 1
    const giro = girosByNit.get(nit)
    const total = giro ? giro.total * share : 0
    const capitacion = giro ? giro.capitacion * share : 0
    const evento = giro ? giro.evento * share : 0
    const contributivo = giro ? giro.contributivo * share : 0
    const subsidiado = giro ? giro.subsidiado * share : 0
    const otro = giro ? giro.otro * share : 0
    const ultima = giro && total > 0 ? giro.ultima : null
    const camas = typeof hospital.beds === 'number' && hospital.beds > 0 ? hospital.beds : 0

    if (giro) {
      for (const [month, value] of Object.entries(giro.meses)) {
        const point = seriesMap.get(month)
        if (!point) continue
        point.total += value.t * share
        point.capitacion += value.c * share
        point.evento += value.e * share
        point.contributivo += value.rc * share
        point.subsidiado += value.rs * share
        point.otro += value.ro * share
      }
      addEps(epsTotal, giro.eps, share)
    }

    kpis.total += total
    kpis.capitacion += capitacion
    kpis.evento += evento
    kpis.contributivo += contributivo
    kpis.subsidiado += subsidiado
    kpis.regimenOtro += otro
    kpis.ultimaFecha = maxDate(kpis.ultimaFecha, ultima)
    if (total > 0) {
      kpis.ipsConGiro++
      nitsWithGiro.add(nit)
    }
    if (hospital.kam_id) kpis.asignado += total
    else kpis.sinZona += total

    if (group === 'ips') {
      if (total > 0) {
        const exec = withExecutive ? executiveGroup(hospital) : null
        ipsRows.push({
          key: hospital.id,
          label: hospital.name,
          giro: total,
          capitacion,
          evento,
          pct: 0,
          ips: 1,
          ipsConGiro: 1,
          camas,
          contributivo,
          subsidiado,
          otro,
          ultima_fecha: ultima,
          eps_top: [],
          epsMap: (() => {
            const map = new Map<string, number>()
            if (giro) addEps(map, giro.eps, share)
            return map
          })(),
          hospital_id: hospital.id,
          nit,
          municipio: hospital.municipality_name,
          departamento: hospital.department_name,
          zona: hospital.kam_id ? hospital.zone_name || 'Zona sin nombre' : null,
          ejecutivo: executiveLabel(hospital, withExecutive),
          ejecutivo_color: exec ? exec.color : null,
          giro_nit: giro ? giro.total : 0,
          sedes_nit: sedesNit,
        })
      }
      continue
    }

    let key: string
    let label: string
    let color: string | null = null
    if (group === 'municipio') {
      key = hospital.municipality_id || 'sin_municipio'
      label = hospital.municipality_name || 'Sin municipio'
    } else if (group === 'zona') {
      key = hospital.kam_id || 'sin_zona'
      label = hospital.kam_id ? hospital.zone_name || 'Zona sin nombre' : 'Sin zona asignada'
    } else {
      const exec = executiveGroup(hospital)
      key = exec.key
      label = exec.label
      color = exec.color
    }
    let acc = groups.get(key)
    if (!acc) {
      acc = newAccumulator(key, label)
      acc.color = color
      if (group === 'municipio') acc.departamento = hospital.department_name
      groups.set(key, acc)
    }
    acc.giro += total
    acc.capitacion += capitacion
    acc.evento += evento
    acc.contributivo += contributivo
    acc.subsidiado += subsidiado
    acc.otro += otro
    acc.ultima = maxDate(acc.ultima, ultima)
    if (giro) addEps(acc.eps, giro.eps, share)
    acc.ips++
    acc.camas += camas
    if (total > 0) acc.ipsConGiro++
    if (group === 'ejecutivo' && hospital.kam_id && hospital.zone_name) acc.zonas.add(hospital.zone_name)
    if (total > 0 && (!acc.top || total > acc.top.giro)) acc.top = { name: hospital.name, giro: total }
  }

  kpis.total = round2(kpis.total)
  kpis.capitacion = round2(kpis.capitacion)
  kpis.evento = round2(kpis.evento)
  kpis.otros = round2(Math.max(0, kpis.total - kpis.capitacion - kpis.evento))
  kpis.asignado = round2(kpis.asignado)
  kpis.sinZona = round2(kpis.sinZona)
  kpis.contributivo = round2(kpis.contributivo)
  kpis.subsidiado = round2(kpis.subsidiado)
  kpis.regimenOtro = round2(kpis.regimenOtro)
  kpis.nitsConGiro = nitsWithGiro.size
  kpis.asignadoPct = kpis.total > 0 ? round2((kpis.asignado / kpis.total) * 100) : null

  const pct = (value: number) => (kpis.total > 0 ? round2((value / kpis.total) * 100) : 0)
  const byGiro = (a: GirosRow, b: GirosRow) => b.giro - a.giro || a.label.localeCompare(b.label, 'es')

  let rows: GirosRow[]
  if (group === 'ips') {
    rows = ipsRows.map(({ epsMap, ...row }) => ({
      ...row,
      giro: round2(row.giro),
      capitacion: round2(row.capitacion),
      evento: round2(row.evento),
      contributivo: round2(row.contributivo),
      subsidiado: round2(row.subsidiado),
      otro: round2(row.otro),
      pct: pct(row.giro),
      eps_top: topEps(epsMap, epsNombres, row.giro, EPS_TOP_ROW),
    }))
  } else {
    rows = Array.from(groups.values()).map(acc => ({
      key: acc.key,
      label: acc.label,
      giro: round2(acc.giro),
      capitacion: round2(acc.capitacion),
      evento: round2(acc.evento),
      pct: pct(acc.giro),
      ips: acc.ips,
      ipsConGiro: acc.ipsConGiro,
      camas: acc.camas,
      contributivo: round2(acc.contributivo),
      subsidiado: round2(acc.subsidiado),
      otro: round2(acc.otro),
      ultima_fecha: acc.ultima,
      eps_top: topEps(acc.eps, epsNombres, acc.giro, EPS_TOP_ROW),
      color: acc.color,
      departamento: acc.departamento,
      zonas: Array.from(acc.zonas).sort((a, b) => a.localeCompare(b, 'es')),
      top_ips: acc.top ? acc.top.name : null,
    }))
  }
  rows.sort(byGiro)

  const series = months.map(month => {
    const point = seriesMap.get(month)!
    return {
      periodo: month,
      total: round2(point.total),
      capitacion: round2(point.capitacion),
      evento: round2(point.evento),
      contributivo: round2(point.contributivo),
      subsidiado: round2(point.subsidiado),
      otro: round2(point.otro),
    }
  })
  return { kpis, series, rows, epsTop: topEps(epsTotal, epsNombres, kpis.total, EPS_TOP_TOTAL) }
}

// ---------------------------------------------------------------------------
// Parámetros de la API
// ---------------------------------------------------------------------------

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/

export interface GirosQuery {
  group: GirosGroup
  line: string | null
  desde: string | null // 'YYYY-MM'
  hasta: string | null
  departamento: string | null
  municipio: string | null
  regimen: GirosRegimen
  fuente: GirosFuenteParam
}

export function parseGirosQuery(params: URLSearchParams): { ok: true; value: GirosQuery } | { ok: false; error: string } {
  const group = (params.get('group') || 'ips').trim().toLowerCase()
  if (!(GIROS_GROUPS as readonly string[]).includes(group)) return { ok: false, error: 'group debe ser ips, municipio, zona o ejecutivo' }
  const line = (params.get('line') || '').trim().toLowerCase() || null
  if (line && !/^[a-z0-9_-]{1,40}$/.test(line)) return { ok: false, error: 'Código de línea no válido' }
  const desde = (params.get('desde') || '').trim() || null
  const hasta = (params.get('hasta') || '').trim() || null
  if (desde && !MONTH_RE.test(desde)) return { ok: false, error: 'desde debe tener el formato YYYY-MM' }
  if (hasta && !MONTH_RE.test(hasta)) return { ok: false, error: 'hasta debe tener el formato YYYY-MM' }
  if (desde && hasta && desde > hasta) return { ok: false, error: 'desde no puede ser posterior a hasta' }
  const departamento = (params.get('departamento') || '').trim() || null
  if (departamento && !/^\d{2}$/.test(departamento)) return { ok: false, error: 'departamento debe ser un código DANE de 2 dígitos' }
  const municipio = (params.get('municipio') || '').trim() || null
  if (municipio && !/^\d{5}$/.test(municipio)) return { ok: false, error: 'municipio debe ser un código DANE de 5 dígitos' }
  if (group === 'ejecutivo' && !line) return { ok: false, error: 'Elige una línea para agrupar por Ejecutivo Comercial' }
  const regimen = (params.get('regimen') || 'todos').trim().toLowerCase()
  if (!(GIROS_REGIMENES as readonly string[]).includes(regimen)) return { ok: false, error: 'regimen debe ser contributivo, subsidiado o todos' }
  const fuente = (params.get('fuente') || 'auto').trim().toLowerCase()
  if (!(GIROS_FUENTES as readonly string[]).includes(fuente)) return { ok: false, error: 'fuente debe ser auto, reporte29 o identifica' }
  return {
    ok: true,
    value: { group: group as GirosGroup, line, desde, hasta, departamento, municipio, regimen: regimen as GirosRegimen, fuente: fuente as GirosFuenteParam },
  }
}

/** Suma (o resta) meses a 'YYYY-MM'. */
export function addMonths(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number)
  const index = y * 12 + (m - 1) + delta
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`
}

/**
 * Rango efectivo: si falta hasta, el último mes con datos; si falta desde, 12 meses hasta "hasta".
 * Recorta a GIROS_MAX_MONTHS. latest = último mes con giros cargados ('YYYY-MM') o null.
 */
export function resolveGirosRange(desde: string | null, hasta: string | null, latest: string | null): { desde: string; hasta: string; months: string[] } | null {
  const end = hasta || latest
  if (!end) return null
  let start = desde || addMonths(end, -(GIROS_DEFAULT_MONTHS - 1))
  if (start > end) start = end
  let months = monthsBetween(start, end)
  if (months.length > GIROS_MAX_MONTHS) {
    start = addMonths(end, -(GIROS_MAX_MONTHS - 1))
    months = monthsBetween(start, end)
  }
  return { desde: start, hasta: end, months }
}

const num = (value: unknown) => {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : 0
}

/**
 * Normaliza la lista por NIT de adres_giros_intel() o de adres_giros_resumen() (numéricos pueden venir
 * como string; las claves ausentes valen 0). Sin regímenes (resumen del Reporte 29), todo es subsidiado.
 */
export function parseResumen(raw: unknown): GiroNitResumen[] {
  if (!Array.isArray(raw)) return []
  const out: GiroNitResumen[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    const nit = typeof record.nit === 'string' ? record.nit : null
    if (!nit) continue
    const hasRegimen = 'contributivo' in record || 'subsidiado' in record || 'otro' in record
    const meses: Record<string, GiroMes> = {}
    const rawMeses = record.meses && typeof record.meses === 'object' ? (record.meses as Record<string, Record<string, unknown>>) : {}
    for (const [month, value] of Object.entries(rawMeses)) {
      if (!value || typeof value !== 'object') continue
      const t = num(value.t)
      const monthHasRegimen = 'rc' in value || 'rs' in value || 'ro' in value
      meses[month] = { t, c: num(value.c), e: num(value.e), rc: num(value.rc), rs: monthHasRegimen ? num(value.rs) : t, ro: num(value.ro) }
    }
    const eps: Record<string, number> = {}
    if (record.eps && typeof record.eps === 'object') {
      for (const [key, value] of Object.entries(record.eps as Record<string, unknown>)) eps[key] = num(value)
    }
    const total = num(record.total)
    out.push({
      nit,
      total,
      capitacion: num(record.capitacion),
      evento: num(record.evento),
      contributivo: num(record.contributivo),
      subsidiado: hasRegimen ? num(record.subsidiado) : total,
      otro: num(record.otro),
      ultima: typeof record.ultima === 'string' ? record.ultima : null,
      meses,
      eps,
    })
  }
  return out
}

/** Normaliza el jsonb completo de adres_giros_intel(): { nits: [...], eps: { clave: nombre } }. */
export function parseIntel(raw: unknown): { nits: GiroNitResumen[]; epsNombres: Record<string, string> } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { nits: [], epsNombres: {} }
  const record = raw as Record<string, unknown>
  const epsNombres: Record<string, string> = {}
  if (record.eps && typeof record.eps === 'object') {
    for (const [key, value] of Object.entries(record.eps as Record<string, unknown>)) {
      if (typeof value === 'string' && value.trim()) epsNombres[key] = value.trim()
    }
  }
  return { nits: parseResumen(record.nits), epsNombres }
}

/** ¿Se solapan dos rangos de meses 'YYYY-MM'? */
export function monthsOverlap(a: { desde: string; hasta: string }, b: { min: string; max: string }): boolean {
  return a.desde <= b.max && b.min <= a.hasta
}

/**
 * Fuente efectiva de /api/intelligence/giros. 'reporte29' / 'identifica' se respetan. 'auto' usa
 * Identifica tu Giro si (1) está cargado para al menos IDENTIFICA_MIN_COBERTURA de los NIT de las IPS
 * activas (consulta ok o sin registros en adres_fetch_log) y (2) tiene giros en el rango pedido (o en el
 * rango por defecto: 12 meses hasta su último mes). Si no, el Reporte 29. Si el Reporte 29 está vacío y
 * hay detalle, Identifica tu Giro.
 */
export function chooseGirosSource(params: {
  requested: GirosFuenteParam
  desde: string | null
  hasta: string | null
  identifica: { min: string; max: string } | null
  reporte29: { min: string; max: string } | null
  identificaNitsOk: number
  nitsActivos: number
}): { fuente: GirosFuente; motivo: string } {
  const { requested, desde, hasta, identifica, reporte29, identificaNitsOk, nitsActivos } = params
  if (requested === 'reporte29') return { fuente: 'reporte29', motivo: 'Fuente elegida: Reporte 29.' }
  if (requested === 'identifica') return { fuente: 'identifica', motivo: 'Fuente elegida: Identifica tu Giro.' }
  if (!identifica) return { fuente: 'reporte29', motivo: 'Fuente automática: Reporte 29 (Identifica tu Giro aún no tiene giros cargados).' }
  if (!reporte29) return { fuente: 'identifica', motivo: 'Fuente automática: Identifica tu Giro (el Reporte 29 no tiene giros cargados).' }
  const cobertura = nitsActivos > 0 ? identificaNitsOk / nitsActivos : 0
  if (cobertura < IDENTIFICA_MIN_COBERTURA) {
    const pctText = (Math.floor(cobertura * 1000) / 10).toLocaleString('es-CO')
    return {
      fuente: 'reporte29',
      motivo: `Fuente automática: Reporte 29. Identifica tu Giro solo está cargado para ${identificaNitsOk} de ${nitsActivos} NIT (${pctText} %); se usa cuando cubra al menos el ${IDENTIFICA_MIN_COBERTURA * 100} %.`,
    }
  }
  const range = resolveGirosRange(desde, hasta, identifica.max)
  if (range && monthsOverlap(range, identifica)) return { fuente: 'identifica', motivo: 'Fuente automática: Identifica tu Giro (giros por fecha, los dos regímenes).' }
  return { fuente: 'reporte29', motivo: 'Fuente automática: Reporte 29 (Identifica tu Giro no tiene giros en el rango pedido).' }
}

// ---------------------------------------------------------------------------
// Ficha de IPS: últimos 12 meses de un NIT
// ---------------------------------------------------------------------------

export interface HospitalGiroRow {
  periodo: string // 'YYYY-MM-DD' (primer día)
  tipo_contratacion: string
  eps_codigo: string
  eps_nombre: string | null
  valor: number | string
}

export interface HospitalGirosSummary {
  total: number
  capitacion: number
  evento: number
  otros: number
  /** Por régimen: en el Reporte 29 todo es subsidiado. */
  contributivo: number
  subsidiado: number
  regimenOtro: number
  /** Último giro: 'YYYY-MM-DD' (identifica) o 'YYYY-MM' (mes de proceso del Reporte 29). */
  ultimaFecha: string | null
  topEps: Array<{ codigo: string; nombre: string; valor: number; pct: number }>
  series: Array<{ periodo: string; total: number; contributivo?: number; subsidiado?: number; otro?: number }>
}

export function summarizeHospitalGiros(rows: HospitalGiroRow[], months: string[], topN = 5): HospitalGirosSummary {
  let total = 0
  let capitacion = 0
  let evento = 0
  let ultima: string | null = null
  const byEps = new Map<string, { codigo: string; nombre: string; valor: number }>()
  const byMonth = new Map<string, number>(months.map(m => [m, 0]))
  for (const row of rows) {
    const valor = typeof row.valor === 'number' ? row.valor : Number(row.valor)
    if (!Number.isFinite(valor)) continue
    const month = String(row.periodo).slice(0, 7)
    if (!byMonth.has(month)) continue
    total += valor
    if (valor > 0) ultima = maxDate(ultima, month)
    const tipo = String(row.tipo_contratacion || '').toLowerCase()
    if (tipo.startsWith('capitaci')) capitacion += valor
    else if (tipo === 'evento') evento += valor
    byMonth.set(month, (byMonth.get(month) || 0) + valor)
    const eps = byEps.get(row.eps_codigo)
    if (eps) eps.valor += valor
    else byEps.set(row.eps_codigo, { codigo: row.eps_codigo, nombre: row.eps_nombre || row.eps_codigo, valor })
  }
  const topEps = Array.from(byEps.values())
    .sort((a, b) => b.valor - a.valor || a.nombre.localeCompare(b.nombre, 'es'))
    .slice(0, topN)
    .map(eps => ({ ...eps, valor: round2(eps.valor), pct: total > 0 ? round2((eps.valor / total) * 100) : 0 }))
  return {
    total: round2(total),
    capitacion: round2(capitacion),
    evento: round2(evento),
    otros: round2(Math.max(0, total - capitacion - evento)),
    contributivo: 0,
    subsidiado: round2(total),
    regimenOtro: 0,
    ultimaFecha: ultima,
    topEps,
    series: months.map(month => ({ periodo: month, total: round2(byMonth.get(month) || 0) })),
  }
}

/** Fila de la vista adres_giros_mensual (Identifica tu Giro). */
export interface HospitalDetalleMensualRow {
  periodo: string // 'YYYY-MM-DD' (día 1)
  regimen: string
  eps_ordenadora_nit: string | null
  eps_ordenadora_nombre: string | null
  valor: number | string
  ultima_fecha: string | null
}

/** Ficha de IPS con Identifica tu Giro: total por régimen, entidades ordenadoras, serie apilada por régimen. */
export function summarizeHospitalDetalle(rows: HospitalDetalleMensualRow[], months: string[], topN = 5): HospitalGirosSummary {
  let total = 0
  const reg = { contributivo: 0, subsidiado: 0, otro: 0 }
  let ultima: string | null = null
  const byEps = new Map<string, { codigo: string; nombre: string; valor: number; fecha: string }>()
  const byMonth = new Map<string, { total: number; contributivo: number; subsidiado: number; otro: number }>(
    months.map(m => [m, { total: 0, contributivo: 0, subsidiado: 0, otro: 0 }])
  )
  for (const row of rows) {
    const valor = typeof row.valor === 'number' ? row.valor : Number(row.valor)
    if (!Number.isFinite(valor)) continue
    const point = byMonth.get(String(row.periodo).slice(0, 7))
    if (!point) continue
    const regimen = row.regimen === 'contributivo' || row.regimen === 'subsidiado' ? row.regimen : 'otro'
    total += valor
    reg[regimen] += valor
    point.total += valor
    point[regimen] += valor
    if (valor > 0) ultima = maxDate(ultima, row.ultima_fecha ? String(row.ultima_fecha).slice(0, 10) : null)
    const codigo = row.eps_ordenadora_nit || `nombre:${row.eps_ordenadora_nombre || 'sin entidad'}`
    const fecha = String(row.ultima_fecha || row.periodo)
    const eps = byEps.get(codigo)
    if (eps) {
      eps.valor += valor
      if (row.eps_ordenadora_nombre && fecha >= eps.fecha) {
        eps.nombre = row.eps_ordenadora_nombre
        eps.fecha = fecha
      }
    } else {
      byEps.set(codigo, { codigo, nombre: row.eps_ordenadora_nombre || epsDisplayName(codigo, undefined), valor, fecha })
    }
  }
  const topList = Array.from(byEps.values())
    .sort((a, b) => b.valor - a.valor || a.nombre.localeCompare(b.nombre, 'es'))
    .slice(0, topN)
    .map(eps => ({ codigo: eps.codigo, nombre: eps.nombre, valor: round2(eps.valor), pct: total > 0 ? round2((eps.valor / total) * 100) : 0 }))
  return {
    total: round2(total),
    capitacion: 0,
    evento: 0,
    otros: 0,
    contributivo: round2(reg.contributivo),
    subsidiado: round2(reg.subsidiado),
    regimenOtro: round2(reg.otro),
    ultimaFecha: ultima,
    topEps: topList,
    series: months.map(month => {
      const point = byMonth.get(month)!
      return {
        periodo: month,
        total: round2(point.total),
        contributivo: round2(point.contributivo),
        subsidiado: round2(point.subsidiado),
        otro: round2(point.otro),
      }
    }),
  }
}
