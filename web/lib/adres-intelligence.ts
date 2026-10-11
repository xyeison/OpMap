// Fase 3 · Inteligencia con los giros directos de la ADRES (régimen subsidiado).
// Funciones PURAS (sin base de datos): las usan GET /api/intelligence/giros, la ficha de IPS
// (GET /api/intelligence/giros/hospital/[id]) y scripts/adres-check.ts.
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

export interface GiroMes {
  t: number // total
  c: number // capitación
  e: number // evento
}

/** Un elemento de adres_giros_resumen(): agregado por NIT con su serie mensual ('YYYY-MM'). */
export interface GiroNitResumen {
  nit: string
  total: number
  capitacion: number
  evento: number
  meses: Record<string, GiroMes>
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
}

export interface GirosSeriesPoint {
  periodo: string // 'YYYY-MM'
  total: number
  capitacion: number
  evento: number
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
  ips: number
  ipsConGiro: number
  camas: number
  color: string | null
  departamento: string | null
  zonas: Set<string>
  top: { name: string; giro: number } | null
}

function newAccumulator(key: string, label: string): Accumulator {
  return { key, label, giro: 0, capitacion: 0, evento: 0, ips: 0, ipsConGiro: 0, camas: 0, color: null, departamento: null, zonas: new Set(), top: null }
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
}): GirosAggregate {
  const { hospitals, giros, months, filter, group, withExecutive } = params
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
  }
  const seriesMap = new Map<string, GirosSeriesPoint>(months.map(m => [m, { periodo: m, total: 0, capitacion: 0, evento: 0 }]))
  const nitsWithGiro = new Set<string>()
  const ipsRows: GirosRow[] = []
  const groups = new Map<string, Accumulator>()

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
    const camas = typeof hospital.beds === 'number' && hospital.beds > 0 ? hospital.beds : 0

    if (giro) {
      for (const [month, value] of Object.entries(giro.meses)) {
        const point = seriesMap.get(month)
        if (!point) continue
        point.total += value.t * share
        point.capitacion += value.c * share
        point.evento += value.e * share
      }
    }

    kpis.total += total
    kpis.capitacion += capitacion
    kpis.evento += evento
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
  kpis.nitsConGiro = nitsWithGiro.size
  kpis.asignadoPct = kpis.total > 0 ? round2((kpis.asignado / kpis.total) * 100) : null

  const pct = (value: number) => (kpis.total > 0 ? round2((value / kpis.total) * 100) : 0)
  const byGiro = (a: GirosRow, b: GirosRow) => b.giro - a.giro || a.label.localeCompare(b.label, 'es')

  let rows: GirosRow[]
  if (group === 'ips') {
    rows = ipsRows.map(row => ({ ...row, giro: round2(row.giro), capitacion: round2(row.capitacion), evento: round2(row.evento), pct: pct(row.giro) }))
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
      color: acc.color,
      departamento: acc.departamento,
      zonas: Array.from(acc.zonas).sort((a, b) => a.localeCompare(b, 'es')),
      top_ips: acc.top ? acc.top.name : null,
    }))
  }
  rows.sort(byGiro)

  const series = months.map(month => {
    const point = seriesMap.get(month)!
    return { periodo: month, total: round2(point.total), capitacion: round2(point.capitacion), evento: round2(point.evento) }
  })
  return { kpis, series, rows }
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
  return { ok: true, value: { group: group as GirosGroup, line, desde, hasta, departamento, municipio } }
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

/** Normaliza el jsonb de adres_giros_resumen() (numéricos pueden venir como string). */
export function parseResumen(raw: unknown): GiroNitResumen[] {
  if (!Array.isArray(raw)) return []
  const num = (value: unknown) => {
    const n = typeof value === 'number' ? value : Number(value)
    return Number.isFinite(n) ? n : 0
  }
  const out: GiroNitResumen[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    const nit = typeof record.nit === 'string' ? record.nit : null
    if (!nit) continue
    const meses: Record<string, GiroMes> = {}
    const rawMeses = record.meses && typeof record.meses === 'object' ? (record.meses as Record<string, Record<string, unknown>>) : {}
    for (const [month, value] of Object.entries(rawMeses)) {
      if (!value || typeof value !== 'object') continue
      meses[month] = { t: num(value.t), c: num(value.c), e: num(value.e) }
    }
    out.push({ nit, total: num(record.total), capitacion: num(record.capitacion), evento: num(record.evento), meses })
  }
  return out
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
  topEps: Array<{ codigo: string; nombre: string; valor: number; pct: number }>
  series: Array<{ periodo: string; total: number }>
}

export function summarizeHospitalGiros(rows: HospitalGiroRow[], months: string[], topN = 5): HospitalGirosSummary {
  let total = 0
  let capitacion = 0
  let evento = 0
  const byEps = new Map<string, { codigo: string; nombre: string; valor: number }>()
  const byMonth = new Map<string, number>(months.map(m => [m, 0]))
  for (const row of rows) {
    const valor = typeof row.valor === 'number' ? row.valor : Number(row.valor)
    if (!Number.isFinite(valor)) continue
    const month = String(row.periodo).slice(0, 7)
    if (!byMonth.has(month)) continue
    total += valor
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
    topEps,
    series: months.map(month => ({ periodo: month, total: round2(byMonth.get(month) || 0) })),
  }
}
