// Motor de municipios (Fase 2b). SOLO SERVIDOR / scripts (usa el cliente service_role).
//
// Reparte TODOS los municipios de Colombia entre las zonas (kams) para que el mapa y el anexo de
// territorio muestren el país completo, distinguiendo dónde hay que visitar (IPS objetivo) de lo
// que solo queda "de alcance".
//
// REGLA DE NEGOCIO (decisión del dueño, va al contrato):
//   1. 'ips': municipio con ≥1 IPS activa asignada → la zona que gana por la MISMA regla de mayoría
//      del mapa (lib/territory-rules.ts: camas, desempate determinista). En Bogotá (11001) se guarda
//      el ganador global; el mapa sigue pintando localidades con coverage/assignments.
//   2. Municipio base de una zona sin IPS → esa zona ('reach', 0 min; territorio base garantizado).
//   3. Resto (incluidos los de departamentos excluidos): se reparten por TIEMPO REAL DE CARRETERA
//      (Google Distance Matrix, driving) desde la ciudad base de cada zona candidata, NUNCA por
//      distancia en línea recta.
//      Candidatas = mismo criterio que el algoritmo de IPS (canKamCompeteForHospital): zonas activas
//      que participan en la asignación cuyo departamento es el del municipio o uno adyacente de
//      nivel 1 o 2 (department_adjacency tomada como SIMÉTRICA: a→b y b→a).
//        - Si falta algún par candidato por calcular (o quedó en 'error') → 'pending'.
//        - Si ninguna candidata tiene ruta (todas 'no_route') → 'no_road' ("sin acceso terrestre"):
//          no se asigna a nadie.
//        - Entre las que tienen ruta y están dentro de SU tope (kams.max_travel_time, minutos), la
//          más rápida → 'reach' (igual que el algoritmo de IPS: el tope filtra antes de competir).
//        - Si ninguna está dentro de su tope → 'out_of_reach'; la más rápida queda como dato
//          (nearest_kam_id / nearest_minutes) pero NO se asigna.
//        - Sin ninguna zona candidata por adyacencia → 'out_of_reach' sin "más cercana" (no se
//          consulta a Google y no se afirma que no haya carretera).
//      Desempate por minutos: priority mayor, luego nombre de la zona, luego id.
//      BOGOTÁ HACIA AFUERA compite como UNA ciudad, igual que en el algoritmo de IPS (competeForHospital;
//      dueño, 2026-10-28, docs/decisiones/2026-10-28-municipios-por-corredor-de-bogota.md): las celdas de
//      Bogotá no compiten por separado; compite "Bogotá" con el mejor tiempo de sus celdas y el tope único
//      bogota_config.max_travel_minutes (no el kams.max_travel_time de cada celda). Si gana, la celda la
//      decide el corredor del municipio (bogota_corredores + bogota_config.grupos), no los minutos; sin
//      corredor, o con la celda del corredor inactiva, la celda más rápida. travel_minutes (y, fuera de
//      alcance, nearest_minutes) es el tiempo propio de esa celda si existe. Sin regla cargada (tablas
//      vacías o configuración inválida), cada celda compite sola con su tope, como antes.
//
// Caché permanente (municipality_travel_times): los pares con status 'ok' o 'no_route' nunca se
// vuelven a pedir; los 'error' se reintentan en la siguiente ejecución.
//
// Funciones puras: symmetricAdjacency, candidateZonesForMunicipality, computeMunicipalityZones,
// planGoogleRequests, buildDryRunReport. E/S: loadMunicipalityInputs (solo SELECT),
// runMunicipalityTravelTimes (Google + upsert de caché), saveMunicipalityZones / recompute*.
//
// Imports relativos (no '@/') para que scripts/fase2b-municipios.ts lo pueda usar con tsx.
import { supabaseAdmin, type SupabaseAdminClient } from './supabase-admin'
import {
  BOGOTA_MUNICIPALITY_ID,
  bogotaVirtualCandidate,
  canKamCompeteForHospital,
  chooseBogotaCell,
  hasValidKamArea,
  isBogotaKam,
  loadBogotaRule,
  type AdjacencyMatrix,
  type BogotaRuleInput,
  type BogotaRuleStatus,
} from './opmap-algorithm-simplified'
import { pickMajorityKam } from './territory-rules'
import { zoneDisplayName } from './zone-names'
import {
  COST_PER_ELEMENT_USD,
  GoogleRoutesDisabledError,
  MAX_ORIGINS,
  googleRoutesDisabled,
  isNetworkErrorResult,
  requestDistanceMatrix,
  type DistanceMatrixResult,
  type LatLng,
} from './google-distance'

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type MunicipalityZoneKind = 'ips' | 'reach' | 'out_of_reach' | 'no_road' | 'pending'
export type MunicipalityTravelStatus = 'ok' | 'no_route' | 'error'

/** Fila de GET /api/municipality-coverage (y de POST /recompute). */
export interface MunicipalityCoverageRow {
  code: string
  name: string
  department_code: string
  kam_id: string | null
  kind: MunicipalityZoneKind
  travel_minutes: number | null
  nearest_kam_id: string | null
  nearest_minutes: number | null
  ips_count: number
}

export interface MunicipalityCoverageResponse {
  rows: MunicipalityCoverageRow[]
  /** computed_at de municipality_zone; null si se calculó en memoria (tabla vacía o sin migración). */
  computed_at: string | null
}

/** Fila de municipality_zone (sin computed_at). */
export interface MunicipalityZoneRow {
  municipality_code: string
  kam_id: string | null
  kind: MunicipalityZoneKind
  travel_minutes: number | null
  nearest_kam_id: string | null
  nearest_minutes: number | null
  ips_count: number
}

export interface MunicipalityInput {
  code: string
  name: string
  department_code: string
  lat: number | null
  lng: number | null
}

export interface MunicipalityZoneInput {
  id: string
  name: string
  base_city: string | null
  area_id: string
  lat: number | null
  lng: number | null
  max_travel_time: number | null // MINUTOS
  priority: number | null
  enable_level2: boolean | null
  active: boolean
  participates_in_assignment: boolean
}

export interface AssignedHospitalInput {
  hospital_id: string
  kam_id: string
  municipality_id: string
  locality_id: string | null
  beds: number | null
  travel_time: number | null // SEGUNDOS (assignments.travel_time)
}

export interface TravelTimeInput {
  kam_id: string
  municipality_code: string
  travel_minutes: number | null
  distance_km: number | null
  status: MunicipalityTravelStatus
}

export interface DepartmentInput {
  code: string
  name: string
  excluded: boolean
}

export interface MunicipalityInputs {
  municipalities: MunicipalityInput[]
  /** Todas las filas de kams (el motor filtra las candidatas). */
  zones: MunicipalityZoneInput[]
  departments: DepartmentInput[]
  /** department_adjacency simetrizada (a→b y b→a). */
  adjacency: AdjacencyMatrix
  /** IPS ACTIVAS con asignación (assignments ⨝ hospitals.active). */
  assigned: AssignedHospitalInput[]
  /** Caché de tiempos municipio ↔ ciudad base (vacía si la tabla aún no existe). */
  travelTimes: TravelTimeInput[]
  /** true si municipality_travel_times no existe (migración 0500 sin aplicar). */
  travelTimesTableMissing: boolean
  /** Regla de Bogotá hacia afuera (loadBogotaRule). null = cada celda compite sola con su tope. */
  bogota: BogotaRuleInput | null
  bogotaRuleStatus: BogotaRuleStatus
}

/** Una petición a Google: un municipio (destino) y las ciudades base que faltan (orígenes). */
export interface PlannedRequest {
  municipality: MunicipalityInput
  zones: MunicipalityZoneInput[]
}

export const DEFAULT_MAX_TRAVEL_MINUTES = 240
const DEFAULT_PRIORITY = 2

// ---------------------------------------------------------------------------
// Utilidades puras
// ---------------------------------------------------------------------------

const pairKey = (kamId: string, municipalityCode: string) => `${kamId}|${municipalityCode}`

const compareText = (a: string, b: string) => a.localeCompare(b, 'es', { sensitivity: 'base' })

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

const maxMinutesOf = (zone: MunicipalityZoneInput) =>
  finite(zone.max_travel_time) && zone.max_travel_time > 0 ? zone.max_travel_time : DEFAULT_MAX_TRAVEL_MINUTES

const priorityOf = (zone: MunicipalityZoneInput) => (finite(zone.priority) ? zone.priority : DEFAULT_PRIORITY)

/** Orden entre zonas empatadas: priority mayor, luego nombre, luego id. */
function compareZonePreference(a: MunicipalityZoneInput, b: MunicipalityZoneInput): number {
  const priorityA = priorityOf(a)
  const priorityB = priorityOf(b)
  if (priorityA !== priorityB) return priorityB - priorityA
  return compareText(zoneDisplayName(a.name), zoneDisplayName(b.name)) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
}

/** department_adjacency tomada como simétrica (si a→b está, también b→a). Listas ordenadas. */
export function symmetricAdjacency(rows: Array<{ department_code: string; adjacent_department_code: string }>): AdjacencyMatrix {
  const sets = new Map<string, Set<string>>()
  const add = (from: string, to: string) => {
    if (!from || !to || from === to) return
    const set = sets.get(from) || new Set<string>()
    set.add(to)
    sets.set(from, set)
  }
  for (const row of rows) {
    const a = String(row.department_code || '').trim()
    const b = String(row.adjacent_department_code || '').trim()
    add(a, b)
    add(b, a)
  }
  const matrix: AdjacencyMatrix = {}
  sets.forEach((set, code) => {
    matrix[code] = Array.from(set).sort()
  })
  return matrix
}

/** Zonas que pueden competir por municipios: activas, en la asignación, con área válida y coordenadas. */
export function eligibleZones(zones: MunicipalityZoneInput[]): MunicipalityZoneInput[] {
  return zones.filter(
    zone =>
      zone.active === true &&
      zone.participates_in_assignment === true &&
      hasValidKamArea(zone) &&
      finite(zone.lat) &&
      finite(zone.lng)
  )
}

/**
 * Zonas candidatas para un municipio: el mismo criterio que el algoritmo de IPS
 * (canKamCompeteForHospital: mismo departamento, nivel 1, nivel 2 y regla de Bogotá) aplicado al
 * municipio como si fuera una IPS sin localidad. `zones` debe venir ya filtrada con eligibleZones.
 */
export function candidateZonesForMunicipality(
  municipality: Pick<MunicipalityInput, 'code' | 'department_code'>,
  zones: MunicipalityZoneInput[],
  adjacency: AdjacencyMatrix
): MunicipalityZoneInput[] {
  const target = { department_id: municipality.department_code, municipality_id: municipality.code, locality_id: null }
  return zones.filter(zone =>
    canKamCompeteForHospital({ area_id: zone.area_id, enable_level2: zone.enable_level2 }, target, adjacency)
  )
}

// ---------------------------------------------------------------------------
// Clasificación de municipios
// ---------------------------------------------------------------------------

type MunicipalityStage =
  | { stage: 'ips'; row: MunicipalityZoneRow }
  | { stage: 'base'; row: MunicipalityZoneRow }
  | { stage: 'no_candidates'; row: MunicipalityZoneRow }
  | { stage: 'no_coordinates'; candidates: MunicipalityZoneInput[] }
  | { stage: 'google'; candidates: MunicipalityZoneInput[] }

interface Classified {
  municipality: MunicipalityInput
  result: MunicipalityStage
}

function classifyMunicipalities(inputs: MunicipalityInputs): Classified[] {
  const zones = eligibleZones(inputs.zones)
  const zoneNames = new Map(inputs.zones.map(zone => [zone.id, zoneDisplayName(zone.name)]))
  const nameOf = (kamId: string) => zoneNames.get(kamId) ?? null

  // IPS activas asignadas por municipio
  const assignedByMunicipality = new Map<string, AssignedHospitalInput[]>()
  for (const hospital of inputs.assigned) {
    const code = (hospital.municipality_id || '').trim()
    if (!code) continue
    const list = assignedByMunicipality.get(code) || []
    list.push(hospital)
    assignedByMunicipality.set(code, list)
  }

  // Zonas cuyo territorio base es un municipio (area_id de 5 dígitos)
  const baseZonesByMunicipality = new Map<string, MunicipalityZoneInput[]>()
  for (const zone of zones) {
    if (zone.area_id.length !== 5) continue
    const list = baseZonesByMunicipality.get(zone.area_id) || []
    list.push(zone)
    baseZonesByMunicipality.set(zone.area_id, list)
  }

  const municipalities = [...inputs.municipalities].sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0))
  return municipalities.map(municipality => {
    const empty: Omit<MunicipalityZoneRow, 'kind'> = {
      municipality_code: municipality.code,
      kam_id: null,
      travel_minutes: null,
      nearest_kam_id: null,
      nearest_minutes: null,
      ips_count: 0,
    }

    // 1. Con IPS objetivo (regla de mayoría del mapa)
    const assigned = assignedByMunicipality.get(municipality.code) || []
    const winner = pickMajorityKam(assigned, nameOf)
    if (winner) {
      const winnerMinutes = assigned
        .filter(hospital => hospital.kam_id === winner.kam_id && finite(hospital.travel_time) && hospital.travel_time >= 0)
        .map(hospital => (hospital.travel_time as number) / 60)
      const minutes = median(winnerMinutes)
      return {
        municipality,
        result: {
          stage: 'ips',
          row: {
            ...empty,
            kind: 'ips',
            kam_id: winner.kam_id,
            travel_minutes: minutes === null ? null : Math.round(minutes),
            ips_count: assigned.length,
          },
        },
      }
    }

    // 2. Municipio base de una zona (sin IPS): territorio base garantizado, 0 min
    const baseZones = [...(baseZonesByMunicipality.get(municipality.code) || [])].sort(compareZonePreference)
    if (baseZones.length > 0) {
      return {
        municipality,
        result: { stage: 'base', row: { ...empty, kind: 'reach', kam_id: baseZones[0].id, travel_minutes: 0 } },
      }
    }

    // 3. Candidatas por adyacencia
    const candidates = candidateZonesForMunicipality(municipality, zones, inputs.adjacency)
    if (candidates.length === 0) {
      return { municipality, result: { stage: 'no_candidates', row: { ...empty, kind: 'out_of_reach' } } }
    }
    if (!finite(municipality.lat) || !finite(municipality.lng)) {
      return { municipality, result: { stage: 'no_coordinates', candidates } }
    }
    return { municipality, result: { stage: 'google', candidates } }
  })
}

function cacheIndex(travelTimes: TravelTimeInput[]): Map<string, TravelTimeInput> {
  const index = new Map<string, TravelTimeInput>()
  for (const row of travelTimes) index.set(pairKey(row.kam_id, row.municipality_code), row)
  return index
}

const isResolved = (row: TravelTimeInput | undefined) => row?.status === 'ok' || row?.status === 'no_route'

/** Minutos del par en caché (redondeados) si tiene ruta; null si no. */
function cachedMinutes(cache: Map<string, TravelTimeInput>, kamId: string, municipalityCode: string): number | null {
  const row = cache.get(pairKey(kamId, municipalityCode))
  return row?.status === 'ok' && finite(row.travel_minutes) && row.travel_minutes >= 0 ? Math.round(row.travel_minutes) : null
}

/** Regla de Bogotá para el paso 3: la regla cargada y las celdas activas que pueden recibir municipios. */
interface BogotaContext {
  rule: BogotaRuleInput | null
  /** celdas de Bogotá entre las zonas elegibles (como activeCells en competeForHospital) */
  activeCellIds: ReadonlySet<string>
}

interface Competitor {
  /** la zona, o para "Bogotá" la celda con el mejor tiempo (desempata frente a las demás zonas) */
  zone: MunicipalityZoneInput
  minutes: number
  maxMinutes: number
  bogota: boolean
}

/** Decide el municipio a partir de las candidatas y la caché (paso 3 de la regla). */
function decideByTravelTime(
  municipality: MunicipalityInput,
  candidates: MunicipalityZoneInput[],
  cache: Map<string, TravelTimeInput>,
  bogota: BogotaContext
): MunicipalityZoneRow {
  const base: MunicipalityZoneRow = {
    municipality_code: municipality.code,
    kam_id: null,
    kind: 'pending',
    travel_minutes: null,
    nearest_kam_id: null,
    nearest_minutes: null,
    ips_count: 0,
  }

  const cached = candidates.map(zone => ({ zone, row: cache.get(pairKey(zone.id, municipality.code)) }))
  // Mientras falte algún par (o esté en 'error') no se decide: una zona sin calcular podría ser la más rápida
  if (cached.some(item => !isResolved(item.row))) return base

  const withRoute = cached
    .filter(item => item.row?.status === 'ok' && finite(item.row.travel_minutes) && item.row.travel_minutes >= 0)
    .map(item => ({ zone: item.zone, minutes: Math.round(item.row!.travel_minutes as number) }))
    .sort((a, b) => a.minutes - b.minutes || compareZonePreference(a.zone, b.zone))

  if (withRoute.length === 0) return { ...base, kind: 'no_road' }

  // Con la regla, las celdas de Bogotá se sustituyen por UN candidato "Bogotá" (como en
  // competeForHospital; en Bogotá misma, departamento 11, no se aplica)
  const rule = municipality.department_code === '11' ? null : bogota.rule
  const cells = rule ? withRoute.filter(item => isBogotaKam(item.zone)) : []
  const virtual =
    rule && cells.length > 0
      ? bogotaVirtualCandidate(
          // cells ya viene por minutos y preferencia: ante empate gana la primera, como en el resto
          cells.map(item => ({ kam_id: item.zone.id, priority: priorityOf(item.zone), seconds: item.minutes * 60 })),
          rule.config.max_travel_minutes
        )
      : null

  const competitors: Competitor[] = withRoute
    .filter(item => !virtual || !isBogotaKam(item.zone))
    .map(item => ({ zone: item.zone, minutes: item.minutes, maxMinutes: maxMinutesOf(item.zone), bogota: false }))
  if (virtual) {
    competitors.push({ zone: cells[0].zone, minutes: virtual.min_seconds / 60, maxMinutes: virtual.max_minutes, bogota: true })
    competitors.sort((a, b) => a.minutes - b.minutes || compareZonePreference(a.zone, b.zone))
  }

  // Zona y minutos de un competidor; para "Bogotá", la celda de su corredor (chooseBogotaCell)
  const resolve = (item: Competitor): { kamId: string; minutes: number } => {
    if (!item.bogota || !rule || !virtual) return { kamId: item.zone.id, minutes: item.minutes }
    const choice = chooseBogotaCell(
      { municipality_id: municipality.code, department_id: municipality.department_code },
      virtual,
      rule,
      bogota.activeCellIds,
      kamId => {
        const minutes = cachedMinutes(cache, kamId, municipality.code)
        return minutes === null ? null : minutes * 60
      }
    )
    return { kamId: choice.kam_id, minutes: Math.round(choice.travel_time / 60) }
  }

  const winner = competitors.find(item => item.minutes <= item.maxMinutes)
  if (winner) {
    const { kamId, minutes } = resolve(winner)
    return { ...base, kind: 'reach', kam_id: kamId, travel_minutes: minutes }
  }
  const nearest = resolve(competitors[0])
  return { ...base, kind: 'out_of_reach', nearest_kam_id: nearest.kamId, nearest_minutes: nearest.minutes }
}

/** Una fila de municipality_zone por cada municipio (orden por código). Pura. */
export function computeMunicipalityZones(inputs: MunicipalityInputs): MunicipalityZoneRow[] {
  const cache = cacheIndex(inputs.travelTimes)
  const bogota: BogotaContext = {
    rule: inputs.bogota,
    activeCellIds: new Set(eligibleZones(inputs.zones).filter(isBogotaKam).map(zone => zone.id)),
  }
  return classifyMunicipalities(inputs).map(({ municipality, result }) => {
    switch (result.stage) {
      case 'ips':
      case 'base':
      case 'no_candidates':
        return result.row
      case 'no_coordinates':
        return {
          municipality_code: municipality.code,
          kam_id: null,
          kind: 'pending',
          travel_minutes: null,
          nearest_kam_id: null,
          nearest_minutes: null,
          ips_count: 0,
        }
      case 'google':
        return decideByTravelTime(municipality, result.candidates, cache, bogota)
    }
  })
}

/**
 * Peticiones a Google que faltan: por municipio, las ciudades base candidatas sin par 'ok'/'no_route'
 * en caché (≤ 25 orígenes por petición; con 16 zonas siempre cabe en una). Orden: primero los
 * departamentos NO excluidos y dentro por código, para que un presupuesto parcial cubra lo principal.
 */
export function planGoogleRequests(inputs: MunicipalityInputs): PlannedRequest[] {
  const cache = cacheIndex(inputs.travelTimes)
  const excluded = new Set(inputs.departments.filter(d => d.excluded).map(d => d.code))
  const requests: PlannedRequest[] = []
  for (const { municipality, result } of classifyMunicipalities(inputs)) {
    if (result.stage !== 'google') continue
    const missing = result.candidates
      .filter(zone => !isResolved(cache.get(pairKey(zone.id, municipality.code))))
      .sort(compareZonePreference)
    for (let i = 0; i < missing.length; i += MAX_ORIGINS) {
      requests.push({ municipality, zones: missing.slice(i, i + MAX_ORIGINS) })
    }
  }
  return requests.sort((a, b) => {
    const exA = excluded.has(a.municipality.department_code) ? 1 : 0
    const exB = excluded.has(b.municipality.department_code) ? 1 : 0
    if (exA !== exB) return exA - exB
    return a.municipality.code < b.municipality.code ? -1 : a.municipality.code > b.municipality.code ? 1 : 0
  })
}

// ---------------------------------------------------------------------------
// Informe del dry-run (puro)
// ---------------------------------------------------------------------------

export interface DryRunReport {
  totals: {
    municipalities: number
    with_ips: number
    base_without_ips: number
    no_candidates: number
    no_coordinates: number
    need_travel_time: number
  }
  pairs: {
    candidate_pairs: number
    cached_ok: number
    cached_no_route: number
    cached_error: number
    missing: number
    pending: number // = cached_error + missing (lo que hay que pedir)
  }
  google: {
    requests: number
    elements: number
    cost_usd: number
    elements_excluded_departments: number
    cost_excluded_departments_usd: number
    /** Informativo: elementos si las zonas de Bogotá compartieran un solo origen. */
    elements_if_single_bogota_origin: number
  }
  candidates_per_municipality: { min: number; avg: number; max: number }
  by_department: Array<{
    code: string
    name: string
    excluded: boolean
    municipalities: number
    with_ips: number
    need_travel_time: number
    no_candidates: number
    elements: number
  }>
  by_zone: Array<{ kam_id: string; name: string; candidate_municipalities: number; elements: number }>
  no_candidates: Array<{ code: string; name: string; department: string }>
  /** Resultado de --assign con la caché actual (sin guardar). */
  preview: Record<MunicipalityZoneKind, number>
  travel_times_table_missing: boolean
  bogota_rule: BogotaRuleSummary
  cost_per_element_usd: number
}

/** Regla de Bogotá con la que se reparten los municipios (para los informes). */
export interface BogotaRuleSummary {
  status: BogotaRuleStatus
  /** tope único de "Bogotá" (minutos); null sin regla activa */
  max_travel_minutes: number | null
}

const bogotaRuleSummary = (inputs: MunicipalityInputs): BogotaRuleSummary => ({
  status: inputs.bogotaRuleStatus,
  max_travel_minutes: inputs.bogota?.config.max_travel_minutes ?? null,
})

export function buildDryRunReport(inputs: MunicipalityInputs): DryRunReport {
  const cache = cacheIndex(inputs.travelTimes)
  const classified = classifyMunicipalities(inputs)
  const plan = planGoogleRequests(inputs)
  const departments = new Map(inputs.departments.map(d => [d.code, d]))
  const zoneNames = new Map(inputs.zones.map(zone => [zone.id, zoneDisplayName(zone.name)]))
  const bogotaZoneIds = new Set(eligibleZones(inputs.zones).filter(z => z.area_id.startsWith(BOGOTA_MUNICIPALITY_ID)).map(z => z.id))

  const totals = { municipalities: classified.length, with_ips: 0, base_without_ips: 0, no_candidates: 0, no_coordinates: 0, need_travel_time: 0 }
  const pairs = { candidate_pairs: 0, cached_ok: 0, cached_no_route: 0, cached_error: 0, missing: 0, pending: 0 }
  const byDept = new Map<string, DryRunReport['by_department'][number]>()
  const byZone = new Map<string, DryRunReport['by_zone'][number]>()
  const candidateCounts: number[] = []
  const noCandidates: DryRunReport['no_candidates'] = []

  const deptEntry = (code: string) => {
    let entry = byDept.get(code)
    if (!entry) {
      const department = departments.get(code)
      entry = {
        code,
        name: department?.name ?? code,
        excluded: department?.excluded === true,
        municipalities: 0,
        with_ips: 0,
        need_travel_time: 0,
        no_candidates: 0,
        elements: 0,
      }
      byDept.set(code, entry)
    }
    return entry
  }
  const zoneEntry = (kamId: string) => {
    let entry = byZone.get(kamId)
    if (!entry) {
      entry = { kam_id: kamId, name: zoneNames.get(kamId) ?? kamId, candidate_municipalities: 0, elements: 0 }
      byZone.set(kamId, entry)
    }
    return entry
  }

  for (const { municipality, result } of classified) {
    const dept = deptEntry(municipality.department_code)
    dept.municipalities++
    switch (result.stage) {
      case 'ips':
        totals.with_ips++
        dept.with_ips++
        break
      case 'base':
        totals.base_without_ips++
        break
      case 'no_candidates':
        totals.no_candidates++
        dept.no_candidates++
        noCandidates.push({ code: municipality.code, name: municipality.name, department: dept.name })
        break
      case 'no_coordinates':
      case 'google': {
        if (result.stage === 'no_coordinates') totals.no_coordinates++
        totals.need_travel_time++
        dept.need_travel_time++
        candidateCounts.push(result.candidates.length)
        for (const zone of result.candidates) {
          zoneEntry(zone.id).candidate_municipalities++
          pairs.candidate_pairs++
          const row = cache.get(pairKey(zone.id, municipality.code))
          if (!row) pairs.missing++
          else if (row.status === 'ok') pairs.cached_ok++
          else if (row.status === 'no_route') pairs.cached_no_route++
          else pairs.cached_error++
        }
        break
      }
    }
  }
  pairs.pending = pairs.missing + pairs.cached_error

  let elements = 0
  let elementsExcluded = 0
  let elementsSingleBogota = 0
  for (const request of plan) {
    const n = request.zones.length
    elements += n
    const dept = deptEntry(request.municipality.department_code)
    dept.elements += n
    if (dept.excluded) elementsExcluded += n
    const bogotaOrigins = request.zones.filter(zone => bogotaZoneIds.has(zone.id)).length
    elementsSingleBogota += n - bogotaOrigins + (bogotaOrigins > 0 ? 1 : 0)
    for (const zone of request.zones) zoneEntry(zone.id).elements++
  }

  const preview: Record<MunicipalityZoneKind, number> = { ips: 0, reach: 0, out_of_reach: 0, no_road: 0, pending: 0 }
  for (const row of computeMunicipalityZones(inputs)) preview[row.kind]++

  const round2 = (value: number) => Math.round(value * 100) / 100
  return {
    totals,
    pairs,
    google: {
      requests: plan.length,
      elements,
      cost_usd: round2(elements * COST_PER_ELEMENT_USD),
      elements_excluded_departments: elementsExcluded,
      cost_excluded_departments_usd: round2(elementsExcluded * COST_PER_ELEMENT_USD),
      elements_if_single_bogota_origin: elementsSingleBogota,
    },
    candidates_per_municipality: {
      min: candidateCounts.length ? Math.min(...candidateCounts) : 0,
      avg: candidateCounts.length ? round2(candidateCounts.reduce((s, n) => s + n, 0) / candidateCounts.length) : 0,
      max: candidateCounts.length ? Math.max(...candidateCounts) : 0,
    },
    by_department: Array.from(byDept.values()).sort((a, b) => (a.code < b.code ? -1 : 1)),
    by_zone: Array.from(byZone.values()).sort((a, b) => b.elements - a.elements || compareText(a.name, b.name)),
    no_candidates: noCandidates,
    preview,
    travel_times_table_missing: inputs.travelTimesTableMissing,
    bogota_rule: bogotaRuleSummary(inputs),
    cost_per_element_usd: COST_PER_ELEMENT_USD,
  }
}

// ---------------------------------------------------------------------------
// Carga de datos (solo lectura)
// ---------------------------------------------------------------------------

const PAGE_SIZE = 1000

type PageResult<T> = { data: T[] | null; error: { message: string; code?: string } | null }

class TableMissingError extends Error {
  constructor(table: string) {
    super(`La tabla ${table} no existe (falta aplicar la migración 2026-10-11_0500_fase2b_municipios_anexos.sql)`)
    this.name = 'TableMissingError'
  }
}

/** PostgREST: relación inexistente (42P01) o fuera de la caché de esquema (PGRST205). */
export function isMissingTableError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false
  if (error.code === '42P01' || error.code === 'PGRST205') return true
  return /does not exist|could not find the table|schema cache/i.test(error.message || '')
}

/** Lee todas las filas paginando de 1000 en 1000 (límite de PostgREST). La consulta debe tener orden estable. */
async function fetchAll<T>(label: string, build: (from: number, to: number) => PromiseLike<PageResult<T>>): Promise<T[]> {
  const rows: T[] = []
  for (let page = 0; page < 1000; page++) {
    const from = page * PAGE_SIZE
    const { data, error } = await build(from, from + PAGE_SIZE - 1)
    if (error) {
      if (isMissingTableError(error)) throw new TableMissingError(label)
      throw new Error(`Error leyendo ${label}: ${error.message}`)
    }
    const chunk = data || []
    rows.push(...chunk)
    if (chunk.length < PAGE_SIZE) break
  }
  return rows
}

const toNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/**
 * Lee todo lo que necesita el motor. Solo SELECT. Si municipality_travel_times no existe, caché vacía;
 * sin regla de Bogotá válida (loadBogotaRule), bogota = null.
 */
export async function loadMunicipalityInputs(db: SupabaseAdminClient = supabaseAdmin): Promise<MunicipalityInputs> {
  const [municipalities, zones, departments, adjacencyRows, hospitals, assignments, bogotaRule] = await Promise.all([
    fetchAll<any>('municipalities', (from, to) =>
      db.from('municipalities').select('code, name, department_code, lat, lng').order('code').range(from, to)
    ),
    fetchAll<any>('kams', (from, to) =>
      db
        .from('kams')
        .select('id, name, base_city, area_id, lat, lng, max_travel_time, priority, enable_level2, active, participates_in_assignment')
        .order('id')
        .range(from, to)
    ),
    fetchAll<any>('departments', (from, to) =>
      db.from('departments').select('code, name, excluded').order('code').range(from, to)
    ),
    fetchAll<any>('department_adjacency', (from, to) =>
      db
        .from('department_adjacency')
        .select('department_code, adjacent_department_code')
        .order('department_code')
        .order('adjacent_department_code')
        .range(from, to)
    ),
    fetchAll<any>('hospitals', (from, to) =>
      db.from('hospitals').select('id, municipality_id, locality_id, beds').eq('active', true).order('id').range(from, to)
    ),
    fetchAll<any>('assignments', (from, to) =>
      db.from('assignments').select('hospital_id, kam_id, travel_time').order('id').range(from, to)
    ),
    loadBogotaRule(db),
  ])

  let travelTimes: TravelTimeInput[] = []
  let travelTimesTableMissing = false
  try {
    const rows = await fetchAll<any>('municipality_travel_times', (from, to) =>
      db
        .from('municipality_travel_times')
        .select('kam_id, municipality_code, travel_minutes, distance_km, status')
        .order('id')
        .range(from, to)
    )
    travelTimes = rows.map(row => ({
      kam_id: String(row.kam_id),
      municipality_code: String(row.municipality_code),
      travel_minutes: toNumber(row.travel_minutes),
      distance_km: toNumber(row.distance_km),
      status: row.status as MunicipalityTravelStatus,
    }))
  } catch (error) {
    if (!(error instanceof TableMissingError)) throw error
    travelTimesTableMissing = true
  }

  const activeHospitals = new Map<string, any>()
  for (const hospital of hospitals) activeHospitals.set(hospital.id, hospital)
  const assigned: AssignedHospitalInput[] = []
  for (const assignment of assignments) {
    const hospital = activeHospitals.get(assignment.hospital_id)
    if (!hospital || !assignment.kam_id) continue
    assigned.push({
      hospital_id: hospital.id,
      kam_id: assignment.kam_id,
      municipality_id: String(hospital.municipality_id || '').trim(),
      locality_id: hospital.locality_id ? String(hospital.locality_id).trim() : null,
      beds: toNumber(hospital.beds),
      travel_time: toNumber(assignment.travel_time),
    })
  }

  return {
    municipalities: municipalities.map(m => ({
      code: String(m.code).trim(),
      name: String(m.name ?? ''),
      department_code: String(m.department_code ?? '').trim(),
      lat: toNumber(m.lat),
      lng: toNumber(m.lng),
    })),
    zones: zones.map(z => ({
      id: z.id,
      name: String(z.name ?? ''),
      base_city: z.base_city ?? null,
      area_id: String(z.area_id ?? '').trim(),
      lat: toNumber(z.lat),
      lng: toNumber(z.lng),
      max_travel_time: toNumber(z.max_travel_time),
      priority: toNumber(z.priority),
      enable_level2: z.enable_level2 ?? null,
      active: z.active === true,
      participates_in_assignment: z.participates_in_assignment === true,
    })),
    departments: departments.map(d => ({ code: String(d.code).trim(), name: String(d.name ?? ''), excluded: d.excluded === true })),
    adjacency: symmetricAdjacency(adjacencyRows),
    assigned,
    travelTimes,
    travelTimesTableMissing,
    bogota: bogotaRule.rule,
    bogotaRuleStatus: bogotaRule.status,
  }
}

// ---------------------------------------------------------------------------
// Cálculo con Google (solo --run del script; nunca desde la app)
// ---------------------------------------------------------------------------

export interface TravelTimeUpsertRow {
  kam_id: string
  municipality_code: string
  travel_minutes: number | null
  distance_km: number | null
  status: MunicipalityTravelStatus
  source: 'google_maps'
  calculated_at: string
}

export interface RunProgressEvent {
  index: number
  total: number
  municipality: MunicipalityInput
  elements: number
  ok: number
  no_route: number
  error: number
  response_status: string
  elements_reserved: number
  elements_billed: number
  max_elements: number
}

export type RunStopReason = 'done' | 'budget' | 'fatal' | 'disabled' | 'persist_error'

export interface RunSummary {
  stop_reason: RunStopReason
  stop_detail: string | null
  planned_requests: number
  planned_elements: number
  requests_done: number
  requests_failed: number
  /** Elementos reservados contra --max-elements (cuenta los reintentos: nunca se supera el tope). */
  elements_reserved: number
  /** Elementos que Google pudo facturar (peor caso). */
  elements_billed: number
  cost_usd: number
  billing_uncertain_requests: number
  saved_ok: number
  saved_no_route: number
  saved_error: number
  remaining_requests: number
  remaining_elements: number
}

export interface RunOptions {
  maxElements: number
  /** Peticiones simultáneas (1..3; por defecto 3). */
  concurrency?: number
  /** Petición a Google (por defecto requestDistanceMatrix). Inyectable en pruebas. */
  matrix?: (origins: LatLng[], destinations: LatLng[]) => Promise<DistanceMatrixResult>
  /** Guarda los pares de un municipio (por defecto upsert en municipality_travel_times). */
  persist?: (rows: TravelTimeUpsertRow[]) => Promise<void>
  onProgress?: (event: RunProgressEvent) => void
  db?: SupabaseAdminClient
}

/** Upsert de pares en la caché (por (kam_id, municipality_code)); los 'error' se sobrescriben al reintentar. */
export async function upsertTravelTimes(rows: TravelTimeUpsertRow[], db: SupabaseAdminClient = supabaseAdmin): Promise<void> {
  if (rows.length === 0) return
  const { data, error } = await db
    .from('municipality_travel_times')
    .upsert(rows, { onConflict: 'kam_id,municipality_code' })
    .select('id')
  if (error) {
    if (isMissingTableError(error)) throw new TableMissingError('municipality_travel_times')
    throw new Error(`Error guardando municipality_travel_times: ${error.message}`)
  }
  if (!data || data.length !== rows.length) {
    throw new Error(`Guardado incompleto en municipality_travel_times: ${data?.length ?? 0} de ${rows.length} filas`)
  }
}

/**
 * Pide a Google los pares del plan (como mucho `maxElements` elementos) y persiste municipio a
 * municipio. Concurrencia ≤ 3, un reintento ante error de red (dentro de requestDistanceMatrix).
 * Se detiene: al agotar el presupuesto, ante un estado fatal de Google (clave denegada, cuota),
 * con GOOGLE_ROUTES_DISABLED=true o si falla el guardado (para no gastar sin guardar).
 */
export async function runMunicipalityTravelTimes(plan: PlannedRequest[], options: RunOptions): Promise<RunSummary> {
  const maxElements = Math.floor(options.maxElements)
  if (!Number.isFinite(maxElements) || maxElements <= 0) throw new Error('maxElements debe ser un entero positivo')
  const concurrency = Math.min(3, Math.max(1, Math.floor(options.concurrency ?? 3)))
  const db = options.db ?? supabaseAdmin
  // Sin reintento interno: el reintento por error de red lo hace el bucle, que controla el presupuesto
  const matrix = options.matrix ?? ((origins, destinations) => requestDistanceMatrix(origins, destinations, { networkRetries: 0 }))
  const persist = options.persist ?? (rows => upsertTravelTimes(rows, db))

  const summary: RunSummary = {
    stop_reason: 'done',
    stop_detail: null,
    planned_requests: plan.length,
    planned_elements: plan.reduce((sum, request) => sum + request.zones.length, 0),
    requests_done: 0,
    requests_failed: 0,
    elements_reserved: 0,
    elements_billed: 0,
    cost_usd: 0,
    billing_uncertain_requests: 0,
    saved_ok: 0,
    saved_no_route: 0,
    saved_error: 0,
    remaining_requests: 0,
    remaining_elements: 0,
  }

  if (googleRoutesDisabled()) {
    summary.stop_reason = 'disabled'
    summary.stop_detail = 'GOOGLE_ROUTES_DISABLED=true'
    summary.remaining_requests = plan.length
    summary.remaining_elements = summary.planned_elements
    return summary
  }

  let next = 0
  let stopped = false
  const completed = new Set<number>()
  const stop = (reason: RunStopReason, detail: string) => {
    if (!stopped) {
      stopped = true
      summary.stop_reason = reason
      summary.stop_detail = detail
    }
  }

  const worker = async () => {
    while (!stopped) {
      const index = next
      if (index >= plan.length) return
      const request = plan[index]
      const elements = request.zones.length
      // Reserva síncrona (sin carreras entre workers): cada intento reserva sus elementos como si
      // Google los facturara, así el tope nunca se supera.
      if (summary.elements_reserved + elements > maxElements) {
        stop('budget', `Presupuesto de ${maxElements} elementos alcanzado`)
        return
      }
      next++
      summary.elements_reserved += elements

      const origins = request.zones.map(zone => ({ lat: zone.lat as number, lng: zone.lng as number }))
      const destination = { lat: request.municipality.lat as number, lng: request.municipality.lng as number }

      let result: DistanceMatrixResult
      try {
        result = await matrix(origins, [destination])
        // Un reintento ante error de red, solo si también cabe en el presupuesto
        if (isNetworkErrorResult(result) && !stopped && summary.elements_reserved + elements <= maxElements) {
          summary.elements_reserved += elements
          result = await matrix(origins, [destination])
        }
      } catch (error) {
        if (error instanceof GoogleRoutesDisabledError) {
          summary.elements_reserved -= elements // no se llegó a pedir
          stop('disabled', error.message)
          return
        }
        summary.requests_failed++
        stop('fatal', error instanceof Error ? error.message : String(error))
        return
      }
      summary.elements_billed += result.elements_billed
      if (result.billing_uncertain) summary.billing_uncertain_requests++
      summary.requests_done++

      let ok = 0
      let noRoute = 0
      let failed = 0
      if (result.ok) {
        const calculatedAt = new Date().toISOString()
        const rows: TravelTimeUpsertRow[] = request.zones.map((zone, i) => {
          const element = result.rows[i]?.[0]
          const status: MunicipalityTravelStatus = element?.status ?? 'error'
          if (status === 'ok') ok++
          else if (status === 'no_route') noRoute++
          else failed++
          return {
            kam_id: zone.id,
            municipality_code: request.municipality.code,
            travel_minutes: status === 'ok' ? element!.minutes : null,
            distance_km: status === 'ok' ? element!.distance_km : null,
            status,
            source: 'google_maps',
            calculated_at: calculatedAt,
          }
        })
        try {
          await persist(rows)
        } catch (error) {
          stop('persist_error', error instanceof Error ? error.message : String(error))
          return
        }
        summary.saved_ok += ok
        summary.saved_no_route += noRoute
        summary.saved_error += failed
      } else {
        // Sin elementos: no se guarda nada (los pares siguen pendientes y se reintentarán)
        summary.requests_failed++
        failed = elements
        if (result.fatal) stop('fatal', `Google respondió ${result.status}`)
      }
      completed.add(index)

      options.onProgress?.({
        index: completed.size,
        total: plan.length,
        municipality: request.municipality,
        elements,
        ok,
        no_route: noRoute,
        error: failed,
        response_status: result.status,
        elements_reserved: summary.elements_reserved,
        elements_billed: summary.elements_billed,
        max_elements: maxElements,
      })
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()))

  summary.cost_usd = Math.round(summary.elements_billed * COST_PER_ELEMENT_USD * 100) / 100
  plan.forEach((request, index) => {
    if (!completed.has(index)) {
      summary.remaining_requests++
      summary.remaining_elements += request.zones.length
    }
  })
  return summary
}

// ---------------------------------------------------------------------------
// Guardado de municipality_zone y respuesta de la API
// ---------------------------------------------------------------------------

/**
 * Reemplaza municipality_zone sin dejarla vacía: upsert por municipality_code con un computed_at
 * común y después borra lo que tenga un computed_at anterior (municipios que ya no existen).
 */
export async function saveMunicipalityZones(
  rows: MunicipalityZoneRow[],
  db: SupabaseAdminClient = supabaseAdmin
): Promise<{ rows: number; computed_at: string }> {
  const computedAt = new Date().toISOString()
  const payload = rows.map(row => ({ ...row, computed_at: computedAt }))
  const CHUNK = 500
  for (let index = 0; index < payload.length; index += CHUNK) {
    const chunk = payload.slice(index, index + CHUNK)
    const { data, error } = await db
      .from('municipality_zone')
      .upsert(chunk, { onConflict: 'municipality_code' })
      .select('municipality_code')
    if (error) {
      if (isMissingTableError(error)) throw new TableMissingError('municipality_zone')
      throw new Error(`Error guardando municipality_zone: ${error.message}`)
    }
    if (!data || data.length !== chunk.length) {
      throw new Error(`Guardado incompleto en municipality_zone: ${data?.length ?? 0} de ${chunk.length} filas`)
    }
  }
  const { error: deleteError } = await db.from('municipality_zone').delete().lt('computed_at', computedAt)
  if (deleteError) throw new Error(`Error limpiando municipality_zone: ${deleteError.message}`)
  return { rows: payload.length, computed_at: computedAt }
}

/** Une filas de municipality_zone con los datos del municipio (nombre, departamento). */
export function toCoverageRows(
  municipalities: Array<Pick<MunicipalityInput, 'code' | 'name' | 'department_code'>>,
  zoneRows: MunicipalityZoneRow[]
): MunicipalityCoverageRow[] {
  const byCode = new Map(zoneRows.map(row => [row.municipality_code, row]))
  return [...municipalities]
    .sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0))
    .map(municipality => {
      const row = byCode.get(municipality.code)
      return {
        code: municipality.code,
        name: municipality.name,
        department_code: municipality.department_code,
        kam_id: row?.kam_id ?? null,
        kind: row?.kind ?? 'pending', // municipio nuevo aún no recalculado
        travel_minutes: row?.travel_minutes ?? null,
        nearest_kam_id: row?.nearest_kam_id ?? null,
        nearest_minutes: row?.nearest_minutes ?? null,
        ips_count: row?.ips_count ?? 0,
      }
    })
}

/** --assign / POST /recompute: recalcula con la caché (SIN Google) y guarda municipality_zone. */
export async function recomputeAndSaveMunicipalityZones(
  db: SupabaseAdminClient = supabaseAdmin
): Promise<
  MunicipalityCoverageResponse & {
    counts: Record<MunicipalityZoneKind, number>
    travel_times_table_missing: boolean
    bogota_rule: BogotaRuleSummary
  }
> {
  const inputs = await loadMunicipalityInputs(db)
  const zoneRows = computeMunicipalityZones(inputs)
  const saved = await saveMunicipalityZones(zoneRows, db)
  const counts: Record<MunicipalityZoneKind, number> = { ips: 0, reach: 0, out_of_reach: 0, no_road: 0, pending: 0 }
  for (const row of zoneRows) counts[row.kind]++
  const response: MunicipalityCoverageResponse = {
    rows: toCoverageRows(inputs.municipalities, zoneRows),
    computed_at: saved.computed_at,
  }
  setMunicipalityCoverageCache(response)
  return {
    ...response,
    counts,
    travel_times_table_missing: inputs.travelTimesTableMissing,
    bogota_rule: bogotaRuleSummary(inputs),
  }
}

/**
 * GET /api/municipality-coverage: lee municipality_zone. Si la tabla aún no existe o está vacía,
 * calcula en memoria con la caché disponible (sin guardar ni llamar a Google; computed_at = null).
 */
export async function loadMunicipalityCoverage(db: SupabaseAdminClient = supabaseAdmin): Promise<MunicipalityCoverageResponse> {
  let stored: Array<MunicipalityZoneRow & { computed_at: string | null }> = []
  try {
    stored = await fetchAll<any>('municipality_zone', (from, to) =>
      db
        .from('municipality_zone')
        .select('municipality_code, kam_id, kind, travel_minutes, nearest_kam_id, nearest_minutes, ips_count, computed_at')
        .order('municipality_code')
        .range(from, to)
    )
  } catch (error) {
    if (!(error instanceof TableMissingError)) throw error
    stored = []
  }

  if (stored.length === 0) {
    const inputs = await loadMunicipalityInputs(db)
    return { rows: toCoverageRows(inputs.municipalities, computeMunicipalityZones(inputs)), computed_at: null }
  }

  const municipalities = await fetchAll<any>('municipalities', (from, to) =>
    db.from('municipalities').select('code, name, department_code').order('code').range(from, to)
  )
  const computedAt = stored.reduce<string | null>(
    (latest, row) => (row.computed_at && (!latest || row.computed_at > latest) ? row.computed_at : latest),
    null
  )
  const zoneRows: MunicipalityZoneRow[] = stored.map(row => ({
    municipality_code: String(row.municipality_code),
    kam_id: row.kam_id ?? null,
    kind: row.kind as MunicipalityZoneKind,
    travel_minutes: toNumber(row.travel_minutes),
    nearest_kam_id: row.nearest_kam_id ?? null,
    nearest_minutes: toNumber(row.nearest_minutes),
    ips_count: toNumber(row.ips_count) ?? 0,
  }))
  return {
    rows: toCoverageRows(
      municipalities.map(m => ({ code: String(m.code).trim(), name: String(m.name ?? ''), department_code: String(m.department_code ?? '').trim() })),
      zoneRows
    ),
    computed_at: computedAt,
  }
}

// Caché en memoria de 60 s para GET (compartida dentro del proceso vía globalThis; en Vercel cada
// función tiene la suya y simplemente caduca a los 60 s).
const CACHE_TTL_MS = 60_000
const CACHE_KEY = Symbol.for('opmap.municipality-coverage.cache')
type CacheEntry = { at: number; value: MunicipalityCoverageResponse }

function cacheStore(): { entry: CacheEntry | null; inflight: Promise<MunicipalityCoverageResponse> | null } {
  const g = globalThis as any
  if (!g[CACHE_KEY]) g[CACHE_KEY] = { entry: null, inflight: null }
  return g[CACHE_KEY]
}

export function setMunicipalityCoverageCache(value: MunicipalityCoverageResponse | null): void {
  const store = cacheStore()
  store.entry = value ? { at: Date.now(), value } : null
}

/** loadMunicipalityCoverage con caché de 60 s (una sola carga simultánea). */
export async function getMunicipalityCoverageCached(db: SupabaseAdminClient = supabaseAdmin): Promise<MunicipalityCoverageResponse> {
  const store = cacheStore()
  if (store.entry && Date.now() - store.entry.at < CACHE_TTL_MS) return store.entry.value
  if (!store.inflight) {
    store.inflight = loadMunicipalityCoverage(db)
      .then(value => {
        store.entry = { at: Date.now(), value }
        return value
      })
      .finally(() => {
        store.inflight = null
      })
  }
  return store.inflight
}

export { TableMissingError as MunicipalityTableMissingError }
