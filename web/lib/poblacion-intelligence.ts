// Fase 4 · "Población y cobertura" en /inteligencia y "Entorno del municipio" en la ficha de IPS.
// Funciones PURAS (sin base de datos ni red): las usan GET /api/intelligence/poblacion,
// GET /api/intelligence/poblacion/hospital/[id], components/IntelligencePoblacion.tsx (CSV) y
// scripts/poblacion-api-check.ts.
//
// Reglas (ver docs/fases/fase4-poblacion.md, sección "API y vista"):
//  - Afiliados por régimen de cada municipio: afiliacion_cifras (MinSalud) si hay; si no, BDUA activos.
//  - Población: proyección DANE del año del corte; si no hay, la de afiliacion_cifras; si no, la de
//    municipalities.population_2025.
//  - Municipio → zona. Si el municipio tiene IPS asignadas hoy, se reparte entre las zonas de esas IPS
//    en proporción a sus camas (beds de la ficha, el mismo peso de la regla de mayoría; por número de
//    IPS si ninguna tiene camas). Solo Bogotá (4 zonas) y Sogamoso (2) se reparten hoy. Si no tiene IPS
//    asignadas, va entero a la zona de municipality_zone (Fase 2b, "de alcance"). Sin zona → "Sin zona
//    asignada". Así la población nunca se cuenta dos veces.
//  - Giros: los de la ADRES a las IPS del grupo (reparto por sede de adres-intelligence), por la zona
//    asignada de cada IPS.
//  - Índice "potencial" 0-100 = 100 × (0,5 × A + 0,3 × G + 0,2 × C), cada término normalizado por el
//    máximo del conjunto filtrado (filas devueltas):
//      A = afiliados ponderados (contributivo × 1,0 + subsidiado × 0,6) / máximo
//      G = giros ADRES de los últimos 12 meses / máximo
//      C = capacidad: (camas / máx + quirófanos / máx) / 2 si algún grupo tiene quirófanos del REPS;
//          si no, camas / máx. Camas = camas del REPS si la IPS las tiene; si no, las de la ficha.
//    Un máximo en 0 deja ese término en 0 (nunca se divide por cero).
import { nitOfHospital, sedeShares, type IntelCoverageKind } from './adres-intelligence'

export type PoblacionGroup = 'municipio' | 'zona' | 'ejecutivo'
export const POBLACION_GROUPS: readonly PoblacionGroup[] = ['municipio', 'zona', 'ejecutivo'] as const

/** Pesos del índice potencial (suman 1). */
export const POTENCIAL_PESOS = { afiliados: 0.5, giros: 0.3, capacidad: 0.2 } as const
/** Ponderación de los afiliados por régimen dentro del índice. Excepción/especiales no pondera. */
export const AFILIADOS_PESOS = { contributivo: 1, subsidiado: 0.6 } as const
/** EPS que se muestran por grupo. */
export const TOP_EPS_GRUPO = 5
/** EPS que se muestran en la ficha de IPS. */
export const TOP_EPS_FICHA = 3

export const POTENCIAL_FORMULA =
  'Potencial (0-100) = 100 × (0,5 × afiliados ponderados + 0,3 × giros ADRES 12 meses + 0,2 × capacidad), cada término dividido por el máximo del conjunto filtrado. Afiliados ponderados = contributivo × 1,0 + subsidiado × 0,6. Capacidad = camas y quirófanos del REPS si hay (promedio de ambos normalizados); si no, camas de la ficha.'

export type AfiliacionFuente = 'cifras' | 'bdua'
export type PoblacionFuente = 'dane' | 'cifras' | 'municipalities'

/** Un municipio con sus afiliados por régimen y su población (ya resueltas las fuentes). */
export interface MunicipioPoblacion {
  code: string // DANE 5
  name: string
  department_code: string // DANE 2
  department_name: string | null
  contributivo: number | null
  subsidiado: number | null
  excepcion: number | null
  /** De dónde salen los afiliados (null = sin datos de afiliación). */
  fuente: AfiliacionFuente | null
  poblacion: number | null
  poblacion_fuente: PoblacionFuente | null
}

/** Afiliados activos de una EPS en un municipio (BDUA), ya sumados por régimen. */
export interface EpsAfiliadosRow {
  municipio: string // DANE 5
  eps_codigo: string
  eps_nombre: string
  afiliados: number
}

/** IPS activa con lo necesario para agregar giros y capacidad. */
export interface PoblacionHospital {
  id: string
  name: string
  code: string | null
  municipality_id: string | null
  municipality_name: string | null
  department_id: string | null
  department_name: string | null
  /** Camas declaradas en la ficha (hospitals.beds). */
  beds: number | null
  /** Camas según la capacidad instalada del REPS (hospitals.reps_beds); null = sin dato. */
  reps_beds: number | null
  /** Quirófanos según la capacidad instalada del REPS (hospitals.quirofanos); null = sin dato. */
  quirofanos: number | null
  kam_id: string | null
  zone_name: string | null
  executive: { id: string; full_name: string; color: string | null } | null
  coverage_kind: IntelCoverageKind | null
}

export interface ZoneShare {
  kam_id: string | null
  share: number
}

export interface PoblacionFilter {
  departamento?: string | null
  municipio?: string | null
}

export interface EpsTop {
  codigo: string
  nombre: string
  afiliados: number
  /** % de los afiliados del grupo en la BDUA (no de afiliacion_cifras). */
  pct: number
}

export interface PotencialDetalle {
  /** Término de afiliados ponderados normalizado (0-1). */
  afiliados: number
  giros: number
  capacidad: number
}

export interface PoblacionRow {
  key: string
  label: string
  color: string | null
  /** group = municipio: departamento; zona/ejecutivo: null. */
  departamento: string | null
  /** group = municipio: zonas a las que se reparte; ejecutivo: zonas que cubre. */
  zonas: string[]
  /** group = municipio con línea: Ejecutivo Comercial de la zona principal. */
  ejecutivo: string | null
  ejecutivo_color: string | null
  /** group = municipio: true si se reparte entre varias zonas (Bogotá, Sogamoso). */
  compartido: boolean
  /** Municipios que aportan población al grupo (con reparto mayor que 0). */
  municipios: number
  /** Municipios del grupo sin cifras de afiliación. */
  municipiosSinAfiliacion: number
  contributivo: number
  subsidiado: number
  excepcion: number
  afiliados: number
  afiliadosPonderados: number
  poblacion: number
  /**
   * afiliados / población de los municipios CON cifras de afiliación × 100 (puede pasar de 100: la
   * proyección DANE no siempre cuadra). null si ningún municipio del grupo tiene cifras o población.
   */
  cobertura: number | null
  /** contributivo / afiliados × 100. null sin afiliados. */
  pctContributivo: number | null
  giros: number
  ips: number
  ipsConGiro: number
  camas: number
  quirofanos: number
  topEps: EpsTop[]
  potencial: number
  potencialDetalle: PotencialDetalle
}

export interface PoblacionKpis {
  afiliados: number
  contributivo: number
  subsidiado: number
  excepcion: number
  poblacion: number
  /** afiliados / población de los municipios con cifras de afiliación × 100. */
  cobertura: number | null
  pctContributivo: number | null
  giros: number
  municipios: number
  municipiosConAfiliacion: number
  /** Municipios cuyos afiliados vienen de la BDUA porque no hay afiliacion_cifras. */
  municipiosDesdeBdua: number
  ips: number
}

export interface PoblacionAggregate {
  kpis: PoblacionKpis
  rows: PoblacionRow[]
  /** true si algún grupo tiene quirófanos del REPS (la capacidad usa camas y quirófanos). */
  capacidadConQuirofanos: boolean
}

const round1 = (value: number) => Math.round(value * 10) / 10
const round2 = (value: number) => Math.round(value * 100) / 100
const nonNegative = (value: number | null | undefined): number => {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : 0
}

/** Afiliados ponderados del índice potencial. */
export function afiliadosPonderados(contributivo: number, subsidiado: number): number {
  return nonNegative(contributivo) * AFILIADOS_PESOS.contributivo + nonNegative(subsidiado) * AFILIADOS_PESOS.subsidiado
}

/** Cobertura % (null si no hay población). */
export function coberturaPct(afiliados: number, poblacion: number | null | undefined): number | null {
  const pop = nonNegative(poblacion)
  return pop > 0 ? round1((nonNegative(afiliados) / pop) * 100) : null
}

/** Camas de una IPS para la capacidad: las del REPS si existen; si no, las de la ficha. */
export function camasCapacidad(hospital: Pick<PoblacionHospital, 'beds' | 'reps_beds'>): number {
  return typeof hospital.reps_beds === 'number' && Number.isFinite(hospital.reps_beds) ? nonNegative(hospital.reps_beds) : nonNegative(hospital.beds)
}

/**
 * Reparto de cada municipio entre zonas.
 * - Con IPS asignadas hoy: entre sus zonas, por camas (beds de la ficha); por número de IPS si
 *   ninguna tiene camas. Las IPS sin zona no votan.
 * - Sin IPS asignadas: entero a la zona de municipality_zone (reach), o sin zona (null).
 * Las listas van ordenadas por reparto descendente y luego kam_id (determinista).
 */
export function municipioZoneShares(
  hospitals: Array<Pick<PoblacionHospital, 'municipality_id' | 'kam_id' | 'beds'>>,
  reach: Map<string, string | null>
): Map<string, ZoneShare[]> {
  const tallies = new Map<string, Map<string, { beds: number; count: number }>>()
  for (const hospital of hospitals) {
    const municipio = (hospital.municipality_id || '').trim()
    if (!municipio || !hospital.kam_id) continue
    let byKam = tallies.get(municipio)
    if (!byKam) {
      byKam = new Map()
      tallies.set(municipio, byKam)
    }
    const tally = byKam.get(hospital.kam_id) || { beds: 0, count: 0 }
    tally.beds += nonNegative(hospital.beds)
    tally.count += 1
    byKam.set(hospital.kam_id, tally)
  }
  const result = new Map<string, ZoneShare[]>()
  tallies.forEach((byKam, municipio) => {
    const entries = Array.from(byKam.entries())
    const totalBeds = entries.reduce((sum, [, tally]) => sum + tally.beds, 0)
    const totalCount = entries.reduce((sum, [, tally]) => sum + tally.count, 0)
    const shares = entries.map(([kamId, tally]) => ({
      kam_id: kamId,
      share: totalBeds > 0 ? tally.beds / totalBeds : tally.count / totalCount,
    }))
    shares.sort((a, b) => b.share - a.share || (a.kam_id < b.kam_id ? -1 : a.kam_id > b.kam_id ? 1 : 0))
    result.set(municipio, shares.filter(item => item.share > 0))
  })
  reach.forEach((kamId, municipio) => {
    if (!result.has(municipio)) result.set(municipio, [{ kam_id: kamId || null, share: 1 }])
  })
  return result
}

/** Giro total de un NIT en el rango (de adres_giros_intel o de adres_giros_resumen). */
export interface GiroNitTotal {
  nit: string
  total: number
}

export type GiroRegimen = 'contributivo' | 'subsidiado' | 'otro'

/**
 * adres_giros_intel() (migración 0630) → total por NIT sumando solo los regímenes pedidos.
 * Forma: { nits: [{ nit, total, contributivo?, subsidiado?, otro?, … }], eps: {…} }; las claves que
 * faltan valen 0 (la función usa jsonb_strip_nulls). Entradas sin NIT o con total 0 se descartan.
 */
export function parseGirosIntelTotals(raw: unknown, regimenes: readonly GiroRegimen[]): GiroNitTotal[] {
  const nits = raw && typeof raw === 'object' ? (raw as { nits?: unknown }).nits : null
  if (!Array.isArray(nits)) return []
  const num = (value: unknown) => {
    const n = typeof value === 'number' ? value : Number(value)
    return Number.isFinite(n) ? n : 0
  }
  const out: GiroNitTotal[] = []
  for (const item of nits) {
    if (!item || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    if (typeof record.nit !== 'string' || !record.nit) continue
    const total = regimenes.reduce((sum, regimen) => sum + num(record[regimen]), 0)
    if (total !== 0) out.push({ nit: record.nit, total })
  }
  return out
}

/** Giro de cada IPS (reparto por sede del giro de su NIT; ver adres-intelligence.sedeShares). */
export function hospitalGiroMap(hospitals: Array<Pick<PoblacionHospital, 'id' | 'code' | 'beds'>>, giros: GiroNitTotal[]): Map<string, number> {
  const shares = sedeShares(hospitals)
  const byNit = new Map(giros.map(item => [item.nit, item.total]))
  const result = new Map<string, number>()
  for (const hospital of hospitals) {
    const nit = nitOfHospital(hospital)
    const total = nit ? byNit.get(nit) ?? 0 : 0
    result.set(hospital.id, total * (shares.get(hospital.id) ?? 1))
  }
  return result
}

/** Las N EPS con más afiliados de un acumulado {codigo → {nombre, afiliados}}. */
export function topEps(byEps: Map<string, { nombre: string; afiliados: number }>, n: number): EpsTop[] {
  let total = 0
  byEps.forEach(item => {
    total += nonNegative(item.afiliados)
  })
  return Array.from(byEps.entries())
    .map(([codigo, item]) => ({ codigo, nombre: item.nombre, afiliados: nonNegative(item.afiliados) }))
    .filter(item => item.afiliados > 0)
    .sort((a, b) => b.afiliados - a.afiliados || a.nombre.localeCompare(b.nombre, 'es'))
    .slice(0, Math.max(0, n))
    .map(item => ({ ...item, afiliados: Math.round(item.afiliados), pct: total > 0 ? round1((item.afiliados / total) * 100) : 0 }))
}

function matchesFilter(departmentCode: string | null | undefined, municipioCode: string | null | undefined, filter: PoblacionFilter): boolean {
  if (filter.departamento && (departmentCode || '') !== filter.departamento) return false
  if (filter.municipio && (municipioCode || '') !== filter.municipio) return false
  return true
}

interface GroupInfo {
  key: string
  label: string
  color: string | null
}

const SIN_ZONA: GroupInfo = { key: 'sin_zona', label: 'Sin zona asignada', color: null }

function zoneGroup(kamId: string | null, zoneNames: Map<string, string>): GroupInfo {
  if (!kamId) return SIN_ZONA
  return { key: kamId, label: zoneNames.get(kamId) || 'Zona sin nombre', color: null }
}

/** Mismo criterio que el ranking de giros: ejecutivo de la zona en la línea, vacante o conflicto. */
function executiveGroup(kamId: string | null, coverage: Map<string, CoverageForZone> | null): GroupInfo {
  if (!kamId) return SIN_ZONA
  const info = coverage?.get(kamId) ?? null
  if (info?.executive) return { key: info.executive.id, label: info.executive.full_name, color: info.executive.color }
  if (info?.kind === 'conflict') return { key: 'conflicto', label: 'Conflicto (varios ejecutivos en la zona)', color: '#f59e0b' }
  return { key: 'vacante', label: 'Vacante', color: '#9ca3af' }
}

export interface CoverageForZone {
  kind: IntelCoverageKind | null
  executive: { id: string; full_name: string; color: string | null } | null
}

interface Accumulator extends GroupInfo {
  departamento: string | null
  zonas: Set<string>
  ejecutivo: string | null
  ejecutivo_color: string | null
  compartido: boolean
  municipios: Set<string>
  municipiosSinAfiliacion: Set<string>
  contributivo: number
  subsidiado: number
  excepcion: number
  poblacion: number
  /** Población solo de los municipios con cifras de afiliación (denominador de la cobertura). */
  poblacionConAfiliacion: number
  giros: number
  ips: number
  ipsConGiro: number
  camas: number
  quirofanos: number
  eps: Map<string, { nombre: string; afiliados: number }>
}

function newAccumulator(info: GroupInfo): Accumulator {
  return {
    ...info,
    departamento: null,
    zonas: new Set(),
    ejecutivo: null,
    ejecutivo_color: null,
    compartido: false,
    municipios: new Set(),
    municipiosSinAfiliacion: new Set(),
    contributivo: 0,
    subsidiado: 0,
    excepcion: 0,
    poblacion: 0,
    poblacionConAfiliacion: 0,
    giros: 0,
    ips: 0,
    ipsConGiro: 0,
    camas: 0,
    quirofanos: 0,
    eps: new Map(),
  }
}

/**
 * Índice potencial 0-100 de cada fila, normalizando por el máximo de las filas recibidas.
 * Devuelve filas nuevas (no muta) y si la capacidad usó quirófanos.
 */
export function computePotencial<T extends Pick<PoblacionRow, 'afiliadosPonderados' | 'giros' | 'camas' | 'quirofanos'>>(
  rows: T[]
): { rows: Array<T & { potencial: number; potencialDetalle: PotencialDetalle }>; conQuirofanos: boolean } {
  const max = (pick: (row: T) => number) => rows.reduce((acc, row) => Math.max(acc, nonNegative(pick(row))), 0)
  const maxAfiliados = max(row => row.afiliadosPonderados)
  const maxGiros = max(row => row.giros)
  const maxCamas = max(row => row.camas)
  const maxQuirofanos = max(row => row.quirofanos)
  const ratio = (value: number, maximum: number) => (maximum > 0 ? nonNegative(value) / maximum : 0)
  const conQuirofanos = maxQuirofanos > 0
  return {
    conQuirofanos,
    rows: rows.map(row => {
      const afiliados = ratio(row.afiliadosPonderados, maxAfiliados)
      const giros = ratio(row.giros, maxGiros)
      const capacidad = conQuirofanos ? (ratio(row.camas, maxCamas) + ratio(row.quirofanos, maxQuirofanos)) / 2 : ratio(row.camas, maxCamas)
      const potencial = round1(100 * (POTENCIAL_PESOS.afiliados * afiliados + POTENCIAL_PESOS.giros * giros + POTENCIAL_PESOS.capacidad * capacidad))
      return {
        ...row,
        potencial,
        potencialDetalle: { afiliados: round2(afiliados), giros: round2(giros), capacidad: round2(capacidad) },
      }
    }),
  }
}

/**
 * Agrega población, afiliados, EPS, giros y capacidad por municipio, zona o Ejecutivo Comercial.
 * - municipios: todos los municipios con sus cifras (se filtran aquí por departamento/municipio).
 * - eps: afiliados activos por EPS y municipio (BDUA).
 * - hospitals: IPS activas (todas: el reparto del giro por sede se calcula sobre todas).
 * - reach: municipio → zona de municipality_zone (para los que no tienen IPS asignadas).
 * - coverage: cobertura de la línea (zona → ejecutivo) o null sin línea.
 * rows ordenadas por potencial descendente.
 */
export function aggregatePoblacion(params: {
  group: PoblacionGroup
  municipios: MunicipioPoblacion[]
  eps: EpsAfiliadosRow[]
  hospitals: PoblacionHospital[]
  giros: GiroNitTotal[]
  reach: Map<string, string | null>
  zoneNames: Map<string, string>
  coverage: Map<string, CoverageForZone> | null
  filter: PoblacionFilter
}): PoblacionAggregate {
  const { group, municipios, eps, hospitals, giros, reach, zoneNames, coverage, filter } = params
  const shares = municipioZoneShares(hospitals, reach)
  const giroByHospital = hospitalGiroMap(hospitals, giros)

  const epsByMunicipio = new Map<string, EpsAfiliadosRow[]>()
  for (const row of eps) {
    const list = epsByMunicipio.get(row.municipio)
    if (list) list.push(row)
    else epsByMunicipio.set(row.municipio, [row])
  }

  const groups = new Map<string, Accumulator>()
  const acc = (info: GroupInfo): Accumulator => {
    let current = groups.get(info.key)
    if (!current) {
      current = newAccumulator(info)
      groups.set(info.key, current)
    }
    return current
  }
  const infoForZone = (kamId: string | null): GroupInfo => (group === 'ejecutivo' ? executiveGroup(kamId, coverage) : zoneGroup(kamId, zoneNames))

  const kpis: PoblacionKpis = {
    afiliados: 0,
    contributivo: 0,
    subsidiado: 0,
    excepcion: 0,
    poblacion: 0,
    cobertura: null,
    pctContributivo: null,
    giros: 0,
    municipios: 0,
    municipiosConAfiliacion: 0,
    municipiosDesdeBdua: 0,
    ips: 0,
  }

  // 1) Municipios: afiliados, población y EPS (repartidos por zona en zona/ejecutivo).
  const knownMunicipios = new Set<string>()
  let kpiPoblacionConAfiliacion = 0
  for (const municipio of municipios) {
    knownMunicipios.add(municipio.code)
    if (!matchesFilter(municipio.department_code, municipio.code, filter)) continue
    const contributivo = nonNegative(municipio.contributivo)
    const subsidiado = nonNegative(municipio.subsidiado)
    const excepcion = nonNegative(municipio.excepcion)
    const poblacion = nonNegative(municipio.poblacion)
    const hasAfiliacion = municipio.fuente !== null
    kpis.municipios++
    kpis.contributivo += contributivo
    kpis.subsidiado += subsidiado
    kpis.excepcion += excepcion
    kpis.poblacion += poblacion
    if (hasAfiliacion) {
      kpis.municipiosConAfiliacion++
      kpiPoblacionConAfiliacion += poblacion
    }
    if (municipio.fuente === 'bdua') kpis.municipiosDesdeBdua++

    const zoneShares = shares.get(municipio.code) || [{ kam_id: null, share: 1 }]
    const parts: Array<{ info: GroupInfo; share: number; kamId: string | null }> =
      group === 'municipio'
        ? [{ info: { key: municipio.code, label: municipio.name, color: null }, share: 1, kamId: null }]
        : zoneShares.map(item => ({ info: infoForZone(item.kam_id), share: item.share, kamId: item.kam_id }))

    for (const part of parts) {
      const target = acc(part.info)
      if (group === 'municipio') {
        target.departamento = municipio.department_name
        target.compartido = zoneShares.length > 1
        for (const item of zoneShares) if (item.kam_id) target.zonas.add(zoneNames.get(item.kam_id) || 'Zona sin nombre')
        const principal = zoneShares[0]?.kam_id ?? null
        if (coverage && principal) {
          const exec = executiveGroup(principal, coverage)
          target.ejecutivo = exec.label
          target.ejecutivo_color = exec.color
        }
      }
      if (part.share <= 0) continue
      if (group === 'ejecutivo' && part.kamId) target.zonas.add(zoneNames.get(part.kamId) || 'Zona sin nombre')
      target.municipios.add(municipio.code)
      if (!hasAfiliacion) target.municipiosSinAfiliacion.add(municipio.code)
      target.contributivo += contributivo * part.share
      target.subsidiado += subsidiado * part.share
      target.excepcion += excepcion * part.share
      target.poblacion += poblacion * part.share
      if (hasAfiliacion) target.poblacionConAfiliacion += poblacion * part.share
      for (const row of epsByMunicipio.get(municipio.code) || []) {
        const value = nonNegative(row.afiliados) * part.share
        if (value <= 0) continue
        const current = target.eps.get(row.eps_codigo)
        if (current) current.afiliados += value
        else target.eps.set(row.eps_codigo, { nombre: row.eps_nombre || row.eps_codigo, afiliados: value })
      }
    }
  }

  // 2) IPS: giros y capacidad, por el municipio de la IPS o por su zona asignada.
  for (const hospital of hospitals) {
    if (!matchesFilter(hospital.department_id, hospital.municipality_id, filter)) continue
    const giro = giroByHospital.get(hospital.id) ?? 0
    kpis.ips++
    kpis.giros += giro
    let info: GroupInfo
    if (group === 'municipio') {
      const code = hospital.municipality_id || 'sin_municipio'
      info = { key: code, label: hospital.municipality_name || code, color: null }
    } else {
      info = infoForZone(hospital.kam_id)
    }
    const target = acc(info)
    if (group === 'municipio' && !knownMunicipios.has(info.key)) {
      // IPS en un municipio que no está en la tabla de municipios: fila sin población.
      target.departamento = hospital.department_name
      if (hospital.kam_id) target.zonas.add(hospital.zone_name || zoneNames.get(hospital.kam_id) || 'Zona sin nombre')
    }
    if (group === 'ejecutivo' && hospital.kam_id) target.zonas.add(hospital.zone_name || zoneNames.get(hospital.kam_id) || 'Zona sin nombre')
    target.giros += giro
    target.ips++
    if (giro > 0) target.ipsConGiro++
    target.camas += camasCapacidad(hospital)
    target.quirofanos += nonNegative(hospital.quirofanos)
  }

  kpis.afiliados = Math.round(kpis.contributivo + kpis.subsidiado + kpis.excepcion)
  kpis.cobertura = coberturaPct(kpis.afiliados, kpiPoblacionConAfiliacion)
  kpis.pctContributivo = kpis.afiliados > 0 ? round1((kpis.contributivo / kpis.afiliados) * 100) : null
  kpis.contributivo = Math.round(kpis.contributivo)
  kpis.subsidiado = Math.round(kpis.subsidiado)
  kpis.excepcion = Math.round(kpis.excepcion)
  kpis.poblacion = Math.round(kpis.poblacion)
  kpis.giros = round2(kpis.giros)

  const baseRows = Array.from(groups.values())
    .filter(item => item.municipios.size > 0 || item.ips > 0)
    .map(item => {
      const afiliados = item.contributivo + item.subsidiado + item.excepcion
      return {
        key: item.key,
        label: item.label,
        color: item.color,
        departamento: item.departamento,
        zonas: Array.from(item.zonas).sort((a, b) => a.localeCompare(b, 'es')),
        ejecutivo: item.ejecutivo,
        ejecutivo_color: item.ejecutivo_color,
        compartido: item.compartido,
        municipios: item.municipios.size,
        municipiosSinAfiliacion: item.municipiosSinAfiliacion.size,
        contributivo: Math.round(item.contributivo),
        subsidiado: Math.round(item.subsidiado),
        excepcion: Math.round(item.excepcion),
        afiliados: Math.round(afiliados),
        afiliadosPonderados: Math.round(afiliadosPonderados(item.contributivo, item.subsidiado)),
        poblacion: Math.round(item.poblacion),
        cobertura: coberturaPct(afiliados, item.poblacionConAfiliacion),
        pctContributivo: afiliados > 0 ? round1((item.contributivo / afiliados) * 100) : null,
        giros: round2(item.giros),
        ips: item.ips,
        ipsConGiro: item.ipsConGiro,
        camas: Math.round(item.camas),
        quirofanos: Math.round(item.quirofanos),
        topEps: topEps(item.eps, TOP_EPS_GRUPO),
      }
    })

  const { rows, conQuirofanos } = computePotencial(baseRows)
  rows.sort((a, b) => b.potencial - a.potencial || b.afiliados - a.afiliados || a.label.localeCompare(b.label, 'es'))
  return { kpis, rows, capacidadConQuirofanos: conQuirofanos }
}

// ---------------------------------------------------------------------------
// Respuestas de la API (compartidas por las rutas y los componentes)
// ---------------------------------------------------------------------------

export type GirosFuentePoblacion = 'identifica' | 'reporte29'

export interface PoblacionGirosInfo {
  /** identifica = "Identifica tu Giro" (contributivo + subsidiado); reporte29 = solo subsidiado. null = sin giros. */
  fuente: GirosFuentePoblacion | null
  desde: string | null // 'YYYY-MM'
  hasta: string | null
  regimenes: GiroRegimen[]
}

export interface PoblacionSources {
  /** afiliacion_cifras (MinSalud) cargada. */
  cifras: boolean
  /** bdua_afiliados cargada. */
  bdua: boolean
  /** dane_proyecciones cargada. */
  dane: boolean
}

export interface PoblacionApiResponse extends PoblacionAggregate {
  group: PoblacionGroup
  line: { code: string; name: string } | null
  /** Corte de afiliacion_cifras usado ('YYYY-MM'), o null si no hay. */
  corte: string | null
  /** Cortes de afiliacion_cifras disponibles, del más reciente al más antiguo. */
  cortes: string[]
  /** Corte de la BDUA usado para las EPS ('YYYY-MM'), o null. */
  bduaCorte: string | null
  /** Año de la proyección DANE usada. */
  poblacionAnio: number | null
  giros: PoblacionGirosInfo
  sources: PoblacionSources
  filters: {
    departamentos: Array<{ code: string; name: string }>
    municipios: Array<{ code: string; name: string; department_id: string }>
  }
  formula: string
  notes: string[]
}

export interface HospitalEntornoResponse {
  municipio: EntornoMunicipio | null
  ranking: GiroRankInMunicipio | null
  corte: string | null
  bduaCorte: string | null
  poblacionAnio: number | null
  giros: PoblacionGirosInfo
  sources: PoblacionSources
}

// ---------------------------------------------------------------------------
// Ficha de IPS: entorno del municipio
// ---------------------------------------------------------------------------

export interface GiroRankInMunicipio {
  /** Posición de la IPS entre las IPS activas del municipio con giro (1 = la que más recibe). null si no tiene giro. */
  posicion: number | null
  /** IPS activas del municipio con giro mayor que 0. */
  conGiro: number
  /** IPS activas del municipio. */
  totalIps: number
  /** Giro de la IPS (reparto por sede). */
  giro: number
  /** Giro de todas las IPS activas del municipio. */
  giroMunicipio: number
  /** % del giro del municipio que recibe la IPS. null si el municipio no tiene giro. */
  pct: number | null
}

/** Posición de una IPS en el ranking de giros de su municipio (desempate: nombre, luego id). */
export function rankInMunicipio(
  hospitals: Array<Pick<PoblacionHospital, 'id' | 'name' | 'municipality_id'>>,
  giroByHospital: Map<string, number>,
  hospitalId: string
): GiroRankInMunicipio | null {
  const target = hospitals.find(hospital => hospital.id === hospitalId)
  if (!target || !target.municipality_id) return null
  const peers = hospitals.filter(hospital => hospital.municipality_id === target.municipality_id)
  const giroOf = (id: string) => nonNegative(giroByHospital.get(id))
  const withGiro = peers
    .filter(hospital => giroOf(hospital.id) > 0)
    .sort((a, b) => giroOf(b.id) - giroOf(a.id) || a.name.localeCompare(b.name, 'es') || (a.id < b.id ? -1 : 1))
  const giro = giroOf(target.id)
  const giroMunicipio = peers.reduce((sum, hospital) => sum + giroOf(hospital.id), 0)
  const index = withGiro.findIndex(hospital => hospital.id === target.id)
  return {
    posicion: index >= 0 ? index + 1 : null,
    conGiro: withGiro.length,
    totalIps: peers.length,
    giro: round2(giro),
    giroMunicipio: round2(giroMunicipio),
    pct: giroMunicipio > 0 ? round1((giro / giroMunicipio) * 100) : null,
  }
}

export interface EntornoMunicipio {
  code: string
  name: string
  department_name: string | null
  contributivo: number | null
  subsidiado: number | null
  excepcion: number | null
  afiliados: number | null
  poblacion: number | null
  cobertura: number | null
  pctContributivo: number | null
  fuente: AfiliacionFuente | null
  poblacion_fuente: PoblacionFuente | null
  topEps: EpsTop[]
}

/** Resumen del municipio para la tarjeta "Entorno del municipio". */
export function summarizeEntorno(municipio: MunicipioPoblacion, eps: EpsAfiliadosRow[], topN = TOP_EPS_FICHA): EntornoMunicipio {
  const hasAfiliacion = municipio.fuente !== null
  const contributivo = hasAfiliacion ? nonNegative(municipio.contributivo) : null
  const subsidiado = hasAfiliacion ? nonNegative(municipio.subsidiado) : null
  const excepcion = hasAfiliacion ? nonNegative(municipio.excepcion) : null
  const afiliados = hasAfiliacion ? (contributivo || 0) + (subsidiado || 0) + (excepcion || 0) : null
  const byEps = new Map<string, { nombre: string; afiliados: number }>()
  for (const row of eps) {
    if (row.municipio !== municipio.code) continue
    const current = byEps.get(row.eps_codigo)
    if (current) current.afiliados += nonNegative(row.afiliados)
    else byEps.set(row.eps_codigo, { nombre: row.eps_nombre || row.eps_codigo, afiliados: nonNegative(row.afiliados) })
  }
  return {
    code: municipio.code,
    name: municipio.name,
    department_name: municipio.department_name,
    contributivo,
    subsidiado,
    excepcion,
    afiliados,
    poblacion: municipio.poblacion !== null && municipio.poblacion !== undefined ? nonNegative(municipio.poblacion) : null,
    cobertura: afiliados !== null ? coberturaPct(afiliados, municipio.poblacion) : null,
    pctContributivo: afiliados ? round1(((contributivo || 0) / afiliados) * 100) : null,
    fuente: municipio.fuente,
    poblacion_fuente: municipio.poblacion_fuente,
    topEps: topEps(byEps, topN),
  }
}

// ---------------------------------------------------------------------------
// Resolución de fuentes por municipio
// ---------------------------------------------------------------------------

export interface CifrasMunicipioRow {
  municipio: string
  contributivo: number | null
  subsidiado: number | null
  excepcion: number | null
  poblacion: number | null
}

export interface BduaRegimenRow {
  municipio: string
  regimen: string
  afiliados: number
}

/** 'Contributivo' | 'SUBSIDIADO' | 'Excepción & Especiales' … → clave interna; null si no se reconoce. */
export function normalizeRegimen(raw: string | null | undefined): 'contributivo' | 'subsidiado' | 'excepcion' | null {
  const text = String(raw || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
  if (text.startsWith('contrib')) return 'contributivo'
  if (text.startsWith('subsid')) return 'subsidiado'
  if (text.startsWith('excep') || text.startsWith('especial') || text.includes('excepcion')) return 'excepcion'
  return null
}

/**
 * Une las fuentes en una fila por municipio.
 * - Afiliados: afiliacion_cifras si el municipio tiene fila; si no, la suma de la BDUA por régimen.
 * - Población: DANE; si no, afiliacion_cifras; si no, municipalities.population_2025.
 */
export function resolveMunicipios(params: {
  municipalities: Array<{ code: string; name: string; department_code: string; population_2025: number | null }>
  departmentNames: Map<string, string>
  cifras: CifrasMunicipioRow[]
  bdua: BduaRegimenRow[]
  dane: Map<string, number>
}): MunicipioPoblacion[] {
  const { municipalities, departmentNames, cifras, bdua, dane } = params
  const cifrasBy = new Map(cifras.map(row => [row.municipio, row]))
  const bduaBy = new Map<string, { contributivo: number; subsidiado: number; excepcion: number }>()
  for (const row of bdua) {
    const regimen = normalizeRegimen(row.regimen)
    if (!regimen) continue
    const current = bduaBy.get(row.municipio) || { contributivo: 0, subsidiado: 0, excepcion: 0 }
    current[regimen] += nonNegative(row.afiliados)
    bduaBy.set(row.municipio, current)
  }
  return municipalities.map(municipality => {
    const fromCifras = cifrasBy.get(municipality.code)
    const fromBdua = bduaBy.get(municipality.code)
    const danePop = dane.get(municipality.code)
    let poblacion: number | null = null
    let poblacionFuente: PoblacionFuente | null = null
    if (typeof danePop === 'number' && danePop > 0) {
      poblacion = danePop
      poblacionFuente = 'dane'
    } else if (fromCifras && nonNegative(fromCifras.poblacion) > 0) {
      poblacion = nonNegative(fromCifras.poblacion)
      poblacionFuente = 'cifras'
    } else if (nonNegative(municipality.population_2025) > 0) {
      poblacion = nonNegative(municipality.population_2025)
      poblacionFuente = 'municipalities'
    }
    const base = {
      code: municipality.code,
      name: municipality.name,
      department_code: municipality.department_code,
      department_name: departmentNames.get(municipality.department_code) ?? null,
      poblacion,
      poblacion_fuente: poblacionFuente,
    }
    if (fromCifras) {
      return { ...base, contributivo: nonNegative(fromCifras.contributivo), subsidiado: nonNegative(fromCifras.subsidiado), excepcion: nonNegative(fromCifras.excepcion), fuente: 'cifras' as const }
    }
    if (fromBdua) return { ...base, ...fromBdua, fuente: 'bdua' as const }
    return { ...base, contributivo: null, subsidiado: null, excepcion: null, fuente: null }
  })
}

// ---------------------------------------------------------------------------
// EPS de la BDUA: unir códigos de una misma EPS y nombre corto
// ---------------------------------------------------------------------------

/**
 * Clave de agrupación de una EPS por su nombre en la BDUA. La BDUA usa un código por régimen y por
 * movilidad (EPS037 contributivo, EPSS41 subsidiado, EPSS37 / EPS041 "-CM" de movilidad: todos
 * "NUEVA EPS S.A."). Se quita "-CM", comillas, tildes y puntuación.
 */
export function epsGroupKey(nombre: string | null | undefined, fallback = ''): string {
  const key = String(nombre || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/["“”']/g, ' ')
    .replace(/\s*-\s*CM\s*$/, '')
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
  return key || fallback.trim().toUpperCase()
}

/** Nombres cortos de las EPS grandes (como los publica MinSalud en sus cifras). */
const EPS_SHORT_NAMES: Array<[RegExp, string]> = [
  [/^NUEVA EPS/, 'Nueva EPS'],
  [/SURAMERICANA/, 'EPS Sura'],
  [/SANITAS/, 'EPS Sanitas'],
  [/^SALUD TOTAL/, 'Salud Total EPS'],
  [/^COOSALUD/, 'Coosalud EPS'],
  [/MUTUAL SER/, 'Mutual Ser'],
  [/FAMISANAR/, 'Famisanar'],
  [/COMPENSAR/, 'Compensar EPS'],
  [/SAVIA SALUD/, 'Savia Salud EPS'],
  [/^EMSSANAR/, 'Emssanar EPS'],
  [/^ASMET SALUD/, 'Asmet Salud EPS'],
  [/^PROTEGER EPS/, 'Proteger EPS'],
  [/CAPITAL SALUD/, 'Capital Salud EPS'],
  [/SERVICIO OCCIDENTAL DE SALUD/, 'S.O.S. EPS'],
  [/MALLAMAS/, 'Mallamas EPSI'],
  [/FAMILIAR DE COLOMBIA/, 'EPS Familiar de Colombia'],
  [/DUSAKAWI/, 'Dusakawi EPSI'],
  [/ANAS WAYUU/, 'Anas Wayuu EPSI'],
  [/INDIGENA DEL CAUCA/, 'AIC EPSI'],
  [/^ALIANSALUD/, 'Aliansalud EPS'],
  [/COMFAORIENTE/, 'Comfaoriente'],
  [/COMFENALCO VALLE/, 'Comfenalco Valle'],
  [/CHOCO/, 'Comfachocó'],
  [/^CAPRESOCA/, 'Capresoca EPS'],
  [/PIJAOS/, 'Pijaos Salud EPSI'],
  [/SALUD MIA/, 'Salud Mía EPS'],
]

/** Nombre para mostrar: corto si es una EPS conocida; si no, el nombre de la BDUA sin "-CM" ni comillas. */
export function epsDisplayName(nombre: string | null | undefined, fallback = ''): string {
  const key = epsGroupKey(nombre)
  for (const [pattern, short] of EPS_SHORT_NAMES) if (pattern.test(key)) return short
  const clean = String(nombre || '')
    .replace(/["“”]/g, '')
    .replace(/\s*-\s*CM\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
  return clean || fallback
}

/**
 * Filas de poblacion_bdua_resumen() → EPS por municipio, uniendo los códigos de una misma EPS por su
 * nombre. eps_codigo = el menor eps_id del grupo en TODAS las filas recibidas (estable entre
 * municipios, para que las zonas sumen la misma EPS); eps_nombre = nombre corto.
 */
export function mergeBduaEps(rows: Array<{ municipio: string; eps_id: string; afiliados: number }>, nombres: Record<string, string>): EpsAfiliadosRow[] {
  const groupOf = (epsId: string) => epsGroupKey(nombres[epsId] || epsId, epsId)
  const codeByGroup = new Map<string, string>()
  for (const row of rows) {
    const group = groupOf(row.eps_id)
    const current = codeByGroup.get(group)
    if (!current || row.eps_id < current) codeByGroup.set(group, row.eps_id)
  }
  const merged = new Map<string, EpsAfiliadosRow>()
  for (const row of rows) {
    const group = groupOf(row.eps_id)
    const code = codeByGroup.get(group) || row.eps_id
    const id = `${row.municipio}|${code}`
    const current = merged.get(id)
    if (current) current.afiliados += nonNegative(row.afiliados)
    else merged.set(id, { municipio: row.municipio, eps_codigo: code, eps_nombre: epsDisplayName(nombres[code] || nombres[row.eps_id] || row.eps_id, row.eps_id), afiliados: nonNegative(row.afiliados) })
  }
  return Array.from(merged.values())
}

/** Año DANE a usar: el del corte si está cargado; si no, el más cercano disponible (empate: el menor). */
export function pickDaneYear(corte: string | null, years: number[], today = new Date()): number | null {
  const target = corte ? Number(corte.slice(0, 4)) : today.getUTCFullYear()
  const sorted = Array.from(new Set(years.filter(Number.isFinite))).sort((a, b) => a - b)
  if (sorted.length === 0 || !Number.isFinite(target)) return sorted[0] ?? null
  return sorted.reduce((best, year) => (Math.abs(year - target) < Math.abs(best - target) ? year : best), sorted[0])
}

/** true si el estado de la BDUA es "Activo" (sin tildes ni mayúsculas). */
export function isEstadoActivo(estado: string | null | undefined): boolean {
  return (
    String(estado || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase() === 'activo'
  )
}

/**
 * Filas crudas de bdua_afiliados (un municipio o varios) → afiliados ACTIVOS por régimen y EPS por
 * municipio (códigos de una misma EPS unidos). Lo usa la ficha de IPS, que lee un solo municipio.
 */
export function summarizeBduaRows(
  rows: Array<{ municipality_code: string | null; regimen: string; eps_id: string; eps_nombre: string | null; estado: string; afiliados: number | string }>
): { regimen: BduaRegimenRow[]; eps: EpsAfiliadosRow[] } {
  const byRegimen = new Map<string, BduaRegimenRow>()
  const byEps = new Map<string, { municipio: string; eps_id: string; afiliados: number }>()
  const nombres: Record<string, string> = {}
  for (const row of rows) {
    if (!row.municipality_code || !isEstadoActivo(row.estado)) continue
    const afiliados = nonNegative(typeof row.afiliados === 'number' ? row.afiliados : Number(row.afiliados))
    const regimenKey = `${row.municipality_code}|${row.regimen}`
    const regimen = byRegimen.get(regimenKey)
    if (regimen) regimen.afiliados += afiliados
    else byRegimen.set(regimenKey, { municipio: row.municipality_code, regimen: row.regimen, afiliados })
    const epsKey = `${row.municipality_code}|${row.eps_id}`
    const eps = byEps.get(epsKey)
    if (eps) eps.afiliados += afiliados
    else byEps.set(epsKey, { municipio: row.municipality_code, eps_id: row.eps_id, afiliados })
    if (row.eps_nombre && !nombres[row.eps_id]) nombres[row.eps_id] = row.eps_nombre
  }
  return { regimen: Array.from(byRegimen.values()), eps: mergeBduaEps(Array.from(byEps.values()), nombres) }
}

/** Corte disponible ('YYYY-MM-DD') más cercano a una fecha objetivo (empate: el anterior). null si no hay. */
export function closestCorte(target: string | null, available: string[]): string | null {
  const sorted = Array.from(new Set(available.filter(Boolean))).sort()
  if (sorted.length === 0) return null
  if (!target) return sorted[sorted.length - 1]
  const t = Date.parse(`${target.slice(0, 10)}T00:00:00Z`)
  if (!Number.isFinite(t)) return sorted[sorted.length - 1]
  let best = sorted[0]
  let bestDiff = Infinity
  for (const corte of sorted) {
    const diff = Math.abs(Date.parse(`${corte.slice(0, 10)}T00:00:00Z`) - t)
    if (diff < bestDiff) {
      best = corte
      bestDiff = diff
    }
  }
  return best
}

// ---------------------------------------------------------------------------
// Parámetros de la API
// ---------------------------------------------------------------------------

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/

export interface PoblacionQuery {
  group: PoblacionGroup
  line: string | null
  departamento: string | null
  municipio: string | null
  corte: string | null // 'YYYY-MM'
}

export function parsePoblacionQuery(params: URLSearchParams): { ok: true; value: PoblacionQuery } | { ok: false; error: string } {
  const group = (params.get('group') || 'municipio').trim().toLowerCase()
  if (!(POBLACION_GROUPS as readonly string[]).includes(group)) return { ok: false, error: 'group debe ser municipio, zona o ejecutivo' }
  const line = (params.get('line') || '').trim().toLowerCase() || null
  if (line && !/^[a-z0-9_-]{1,40}$/.test(line)) return { ok: false, error: 'Código de línea no válido' }
  const departamento = (params.get('departamento') || '').trim() || null
  if (departamento && !/^\d{2}$/.test(departamento)) return { ok: false, error: 'departamento debe ser un código DANE de 2 dígitos' }
  const municipio = (params.get('municipio') || '').trim() || null
  if (municipio && !/^\d{5}$/.test(municipio)) return { ok: false, error: 'municipio debe ser un código DANE de 5 dígitos' }
  const corte = (params.get('corte') || '').trim() || null
  if (corte && !MONTH_RE.test(corte)) return { ok: false, error: 'corte debe tener el formato YYYY-MM' }
  if (group === 'ejecutivo' && !line) return { ok: false, error: 'Elige una línea para agrupar por Ejecutivo Comercial' }
  return { ok: true, value: { group: group as PoblacionGroup, line, departamento, municipio, corte } }
}

/**
 * Corte efectivo: el pedido si está disponible; sin pedir, el más reciente. undefined = el pedido no
 * existe (la API responde 400); null = no hay ningún corte cargado.
 */
export function resolveCorte(requested: string | null, available: string[]): string | null | undefined {
  const sorted = Array.from(new Set(available)).sort()
  if (requested) return sorted.includes(requested) ? requested : undefined
  return sorted.length > 0 ? sorted[sorted.length - 1] : null
}

// ---------------------------------------------------------------------------
// CSV (Excel en español: UTF-8 con BOM, ";", CRLF, protección contra fórmulas)
// ---------------------------------------------------------------------------

export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'number') return Number.isFinite(value) ? (Number.isInteger(value) ? String(value) : value.toLocaleString('es-CO', { maximumFractionDigits: 2, useGrouping: false })) : ''
  let text = String(value)
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
  if (/[";\r\n]/.test(text) || text !== text.trim()) text = `"${text.replace(/"/g, '""')}"`
  return text
}

export function buildPoblacionCsv(data: { group: PoblacionGroup; line: { code: string } | null; rows: PoblacionRow[] }): string {
  const lines: string[] = []
  const push = (cells: Array<string | number | null | undefined>) => lines.push(cells.map(csvCell).join(';'))
  const withExecutive = data.line !== null
  const first = data.group === 'municipio' ? 'Municipio' : data.group === 'zona' ? 'Zona' : 'Ejecutivo Comercial'
  push([
    first,
    ...(data.group === 'municipio' ? ['Código DANE', 'Departamento', 'Zonas'] : []),
    ...(data.group === 'municipio' && withExecutive ? ['Ejecutivo Comercial'] : []),
    ...(data.group === 'ejecutivo' ? ['Zonas'] : []),
    ...(data.group !== 'municipio' ? ['Municipios'] : []),
    'Contributivo',
    'Subsidiado',
    'Excepción y especiales',
    'Afiliados',
    'Población DANE',
    'Cobertura (%)',
    'Contributivo (%)',
    'Giros ADRES 12 meses (COP)',
    'IPS',
    'Camas',
    'Quirófanos',
    'Potencial (0-100)',
    'EPS dominantes',
  ])
  for (const row of data.rows) {
    push([
      row.label,
      ...(data.group === 'municipio' ? [row.key, row.departamento, row.zonas.join(', ')] : []),
      ...(data.group === 'municipio' && withExecutive ? [row.ejecutivo] : []),
      ...(data.group === 'ejecutivo' ? [row.zonas.join(', ')] : []),
      ...(data.group !== 'municipio' ? [row.municipios] : []),
      row.contributivo,
      row.subsidiado,
      row.excepcion,
      row.afiliados,
      row.poblacion,
      row.cobertura,
      row.pctContributivo,
      Math.round(row.giros),
      row.ips,
      row.camas,
      row.quirofanos,
      row.potencial,
      row.topEps.map(eps => `${eps.nombre} (${eps.pct.toLocaleString('es-CO')} %)`).join(' | '),
    ])
  }
  return '﻿' + lines.join('\r\n') + '\r\n'
}
