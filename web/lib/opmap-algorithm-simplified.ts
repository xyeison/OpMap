// Algoritmo OpMap Simplificado - Usa hospital_kam_distances como fuente de verdad
// IMPORTANTE: travel_time en hospital_kam_distances está en SEGUNDOS
// Solo servidor: usa el cliente service_role (lib/supabase-admin.ts), obtenido de forma perezosa
// dentro de cada método para que importar este módulo no falle durante el build.
// Bogotá como UNA ciudad hacia afuera (2026-10-11): ver competeForHospital y loadBogotaRule más abajo;
// el reparto por corredor vive en lib/bogota-corredores.ts. Pruebas: scripts/bogota-check.ts.

import { getSupabaseAdmin, type SupabaseAdminClient } from './supabase-admin'
import {
  celdaParaCorredor,
  corredorDeLocalidad,
  parseBogotaConfig,
  parseCorredorRows,
  resolveCorredor,
  validarGrupos,
  type BogotaConfig,
  type Corredor,
  type CorredorRow,
} from './bogota-corredores'

// ---------------------------------------------------------------------------
// Reglas de elegibilidad KAM -> IPS (funciones puras exportadas).
// Fuente única: la clase SimplifiedOpMapAlgorithm y app/api/_lib/kam-eligibility.ts delegan aquí.
// ---------------------------------------------------------------------------

export type AdjacencyMatrix = Record<string, string[]>

// Forma mínima de KAM que necesitan las reglas de elegibilidad
export interface EligibilityKamShape {
  area_id: string
  enable_level2: boolean | null
}

// Forma mínima de IPS que necesitan las reglas de elegibilidad
export interface EligibilityHospitalShape {
  department_id: string
  municipality_id: string
  locality_id?: string | null
}

// Código DANE de Bogotá D.C. como municipio. Un KAM con area_id === '11001' es una
// configuración inválida: los KAMs de Bogotá deben tener un código de localidad (11001XX).
// Si se aceptara, se quedaría como "territorio base" con TODAS las IPS de Bogotá.
export const BOGOTA_MUNICIPALITY_ID = '11001'

/**
 * true si el area_id del KAM es válido para la asignación territorial.
 */
export function hasValidKamArea(kam: { area_id: string | null | undefined }): boolean {
  return typeof kam.area_id === 'string' && kam.area_id.length > 0 && kam.area_id !== BOGOTA_MUNICIPALITY_ID
}

export function isBogotaKam(kam: EligibilityKamShape): boolean {
  return kam.area_id.startsWith(BOGOTA_MUNICIPALITY_ID) && kam.area_id.length > 5
}

export function isBogotaHospital(hospital: EligibilityHospitalShape): boolean {
  return hospital.locality_id?.startsWith(BOGOTA_MUNICIPALITY_ID) || false
}

export function isBaseTerritory(kam: EligibilityKamShape, hospital: EligibilityHospitalShape): boolean {
  // Para localidades de Bogotá
  if (isBogotaKam(kam)) {
    return hospital.locality_id === kam.area_id
  }
  // Para municipios regulares
  return hospital.municipality_id === kam.area_id
}

export function canKamCompeteForHospital(
  kam: EligibilityKamShape,
  hospital: EligibilityHospitalShape,
  adjacency: AdjacencyMatrix
): boolean {
  // Si es territorio base, siempre puede
  if (isBaseTerritory(kam, hospital)) return true

  const kamDept = kam.area_id.substring(0, 2)
  const hospitalDept = hospital.department_id

  // Mismo departamento
  if (kamDept === hospitalDept) return true

  // Departamento adyacente (Nivel 1)
  if (adjacency[kamDept]?.includes(hospitalDept)) return true

  // Nivel 2 (si está habilitado)
  if (kam.enable_level2) {
    for (const dept of adjacency[kamDept] || []) {
      if (adjacency[dept]?.includes(hospitalDept)) return true
    }
  }

  // Regla especial para Bogotá
  if (isBogotaKam(kam)) {
    // KAMs de Bogotá pueden competir en Bogotá y Cundinamarca
    if (hospitalDept === '11' || hospitalDept === '25') return true
    // Y departamentos adyacentes a Cundinamarca
    if (adjacency['25']?.includes(hospitalDept)) return true
    // Y nivel 2 desde Cundinamarca si está habilitado
    if (kam.enable_level2) {
      for (const dept of adjacency['25'] || []) {
        if (adjacency[dept]?.includes(hospitalDept)) return true
      }
    }
  }

  return false
}

/**
 * KAMs que pueden competir por una IPS: en Bogotá solo KAMs de localidad; fuera, cualquiera
 * que cumpla las restricciones geográficas (mismo depto, N1, N2, regla Bogotá).
 * Los KAMs con area_id inválido ('11001') nunca son elegibles.
 */
export function eligibleKamsForHospital<T extends EligibilityKamShape>(
  kams: T[],
  hospital: EligibilityHospitalShape,
  adjacency: AdjacencyMatrix
): T[] {
  const valid = kams.filter(hasValidKamArea)
  const pool = isBogotaHospital(hospital) ? valid.filter(isBogotaKam) : valid
  return pool.filter(kam => canKamCompeteForHospital(kam, hospital, adjacency))
}

type MaybeCoordinate = number | string | null | undefined

function hasCoordinates(point: { lat?: MaybeCoordinate; lng?: MaybeCoordinate }): boolean {
  if (point.lat === null || point.lat === undefined || point.lat === '') return false
  if (point.lng === null || point.lng === undefined || point.lng === '') return false
  return Number.isFinite(Number(point.lat)) && Number.isFinite(Number(point.lng))
}

/**
 * Zonas cuyo tiempo de viaje zona→IPS (hospital_kam_distances) hace falta tener calculado.
 * Criterio ÚNICO de "qué rutas calcular": lo usan /api/routes/analyze-missing-optimized y
 * app/api/_lib/hospital-routes.ts (IPS nuevas o editadas, botón "Calcular rutas y asignar").
 *
 * Es exactamente el conjunto de zonas que el algoritmo deja competir por la IPS
 * (eligibleKamsForHospital: mismo departamento, limítrofes N1/N2, reglas de Bogotá), quitando:
 *  - todo si la IPS no tiene coordenadas o está en un departamento excluido (el algoritmo no les
 *    hace asignación competitiva),
 *  - las zonas sin coordenadas (no hay origen para Google).
 * Un par fuera de este conjunto sería gasto en Google que el algoritmo nunca usa.
 */
export function routeCandidateKams<T extends EligibilityKamShape & { lat?: MaybeCoordinate; lng?: MaybeCoordinate }>(
  kams: T[],
  hospital: EligibilityHospitalShape & { lat?: MaybeCoordinate; lng?: MaybeCoordinate },
  adjacency: AdjacencyMatrix,
  excludedDepartments: Iterable<string>
): T[] {
  if (!hasCoordinates(hospital)) return []
  const excluded = new Set(excludedDepartments)
  if (excluded.has(hospital.department_id)) return []
  return eligibleKamsForHospital(kams.filter(hasCoordinates), hospital, adjacency)
}

// ---------------------------------------------------------------------------
// Bogotá como UNA ciudad hacia afuera, con reparto por corredor (spec
// docs/specs/2026-10-11-bogota-corredores.md). Funciones puras exportadas.
//
// Para una IPS FUERA de Bogotá (department_id distinto de '11'), si alguna celda de Bogotá es elegible
// (canKamCompeteForHospital), las celdas NO compiten por separado: compite un candidato virtual
// "Bogotá" con tiempo = mínimo de los tiempos reales de las celdas elegibles con distancia conocida y
// tope = bogota_config.max_travel_minutes (se ignora kams.max_travel_time de las celdas). Si "Bogotá"
// gana (menor tiempo; empate exacto -> prioridad, como siempre), la celda la decide el corredor del
// municipio (bogota_corredores + bogota_config.grupos), no los minutos.
// Dentro de Bogotá (localidades), territorio base y asignaciones forzadas: sin cambios.
// Sin regla (rule = null) el comportamiento es el anterior: cada celda compite sola con su tope.
// ---------------------------------------------------------------------------

/** Lo que el motor necesita para aplicar la regla. null = comportamiento anterior. */
export interface BogotaRuleInput {
  config: BogotaConfig
  corredores: readonly CorredorRow[]
}

/** assignments.detail de las asignaciones 'bogota_corredor'. */
export interface BogotaAssignmentDetail {
  /** null = municipio sin corredor configurado (se usó la celda de menor tiempo) */
  corredor: Corredor | null
  /** mejor tiempo real (SEGUNDOS) entre las celdas elegibles: el tiempo con el que compitió "Bogotá" */
  bogota_min_segundos: number
  /** kam_id de la celda con ese mejor tiempo */
  celda_min: string
}

/**
 * assignments.detail de una IPS de Bogotá asignada por el sector de su localidad (2026-10-28, spec
 * docs/specs/2026-10-28-bogota-4-sectores.md): el corredor de la localidad decide la celda, sin minutos.
 */
export interface BogotaSectorDetail {
  corredor: Corredor
  /** localidad de la IPS (11001xx) */
  localidad: string
}

/**
 * Celda de una IPS de Bogotá por el sector de su localidad: la que recibe el corredor de la localidad en
 * bogota_config.grupos (CORREDOR_DE_LOCALIDAD). null = regla de siempre (territorio base y minutos): sin regla de
 * Bogotá, IPS sin localidad de la tabla o celda del sector fuera de `activeCellIds` (inactiva o fuera de la
 * asignación). travel_time = tiempo real de esa celda si existe (SEGUNDOS); si no, null.
 */
export function bogotaSectorCell(
  hospital: Pick<EligibilityHospitalShape, 'locality_id'>,
  rule: BogotaRuleInput | null,
  activeCellIds: ReadonlySet<string>,
  cellSeconds: (kamId: string) => number | null
): { kam_id: string; travel_time: number | null; detail: BogotaSectorDetail } | null {
  if (!rule) return null
  const localidad = (hospital.locality_id || '').trim()
  const corredor = corredorDeLocalidad(localidad)
  if (!corredor) return null
  const celda = celdaParaCorredor(corredor, rule.config)
  if (!celda || !activeCellIds.has(celda)) return null
  return { kam_id: celda, travel_time: cellSeconds(celda), detail: { corredor, localidad } }
}

/** Identificador interno del candidato virtual (nunca se guarda: se sustituye por la celda elegida). */
export const BOGOTA_VIRTUAL_ID = '__bogota__'

export interface BogotaCellTime {
  kam_id: string
  priority: number
  seconds: number | null // SEGUNDOS; null = sin distancia calculada
}

export interface BogotaVirtualCandidate {
  min_seconds: number
  celda_min: string
  /** prioridad de la celda con el mejor tiempo (desempate frente a otras zonas) */
  priority: number
  max_minutes: number
  within_reach: boolean
}

/**
 * Candidato virtual "Bogotá" a partir de las celdas ELEGIBLES para la IPS. null si ninguna tiene
 * distancia conocida. Empate entre celdas: mayor prioridad y, si sigue, la primera de la lista.
 * within_reach = mejor tiempo dentro del tope único de Bogotá.
 */
export function bogotaVirtualCandidate(cells: readonly BogotaCellTime[], maxMinutes: number): BogotaVirtualCandidate | null {
  let best: { kam_id: string; priority: number; seconds: number } | null = null
  for (const cell of cells) {
    if (cell.seconds === null || !Number.isFinite(cell.seconds)) continue
    if (!best || cell.seconds < best.seconds || (cell.seconds === best.seconds && cell.priority > best.priority)) {
      best = { kam_id: cell.kam_id, priority: cell.priority, seconds: cell.seconds }
    }
  }
  if (!best) return null
  return {
    min_seconds: best.seconds,
    celda_min: best.kam_id,
    priority: best.priority,
    max_minutes: maxMinutes,
    within_reach: best.seconds / 60 <= maxMinutes,
  }
}

export interface CompetitionCandidate {
  kam_id: string
  seconds: number | null // SEGUNDOS
  max_minutes: number // MINUTOS
  priority: number
}

/**
 * Regla de competencia de siempre: menor tiempo dentro del tope de cada candidato; empate exacto ->
 * mayor prioridad; si sigue el empate, el primero de la lista (las zonas vienen ordenadas por nombre).
 */
export function pickCompetitiveWinner(candidates: readonly CompetitionCandidate[]): { kam_id: string; seconds: number } | null {
  let best: CompetitionCandidate | null = null
  let bestTime = Infinity
  for (const candidate of candidates) {
    if (candidate.seconds === null) continue
    if (candidate.seconds / 60 > candidate.max_minutes) continue
    if (candidate.seconds < bestTime || (candidate.seconds === bestTime && candidate.priority > (best?.priority || 0))) {
      bestTime = candidate.seconds
      best = candidate
    }
  }
  return best && bestTime < Infinity ? { kam_id: best.kam_id, seconds: bestTime } : null
}

/** corredor: la celda del corredor; sin_corredor / celda_no_activa: la celda de menor tiempo. */
export type BogotaCellReason = 'corredor' | 'sin_corredor' | 'celda_no_activa'

export interface BogotaCellChoice {
  kam_id: string
  travel_time: number // SEGUNDOS: tiempo real de la celda elegida si existe; si no, el mínimo de Bogotá
  corredor: Corredor | null
  motivo: BogotaCellReason
  detail: BogotaAssignmentDetail
}

/**
 * Celda que recibe una IPS que ganó "Bogotá": la del corredor de su municipio según
 * bogota_config.grupos. Si el municipio no tiene corredor, o la celda configurada no está entre las
 * celdas activas, se usa la celda de menor tiempo (celda_min).
 */
export function chooseBogotaCell(
  hospital: Pick<EligibilityHospitalShape, 'municipality_id' | 'department_id'>,
  virtual: BogotaVirtualCandidate,
  rule: BogotaRuleInput,
  activeCellIds: ReadonlySet<string>,
  cellSeconds: (kamId: string) => number | null
): BogotaCellChoice {
  const corredor = resolveCorredor(hospital.municipality_id, hospital.department_id, rule.corredores)
  let kamId = virtual.celda_min
  let motivo: BogotaCellReason = 'sin_corredor'
  if (corredor) {
    const celda = celdaParaCorredor(corredor, rule.config)
    if (celda && activeCellIds.has(celda)) {
      kamId = celda
      motivo = 'corredor'
    } else {
      motivo = 'celda_no_activa'
    }
  }
  return {
    kam_id: kamId,
    travel_time: cellSeconds(kamId) ?? virtual.min_seconds,
    corredor,
    motivo,
    detail: { corredor, bogota_min_segundos: virtual.min_seconds, celda_min: virtual.celda_min },
  }
}

/** Forma mínima de zona para la asignación competitiva. */
export interface CompetitionKam extends EligibilityKamShape {
  id: string
  max_travel_time: number // MINUTOS
  priority: number
}

export interface CompetitionOutcome {
  kam_id: string
  travel_time: number // SEGUNDOS
  assignment_type: 'competitive' | 'bogota_corredor'
  detail: BogotaAssignmentDetail | null
  /** solo en 'bogota_corredor' */
  motivo: BogotaCellReason | null
}

/**
 * Asignación competitiva de UNA IPS (fase 2 del algoritmo), pura. seconds(kamId) devuelve el tiempo
 * zona -> IPS en SEGUNDOS o null. Con rule = null, o para IPS de Bogotá (department_id '11'), es la
 * regla de siempre. Devuelve null si ninguna zona llega dentro de su tope.
 */
export function competeForHospital<T extends CompetitionKam>(
  hospital: EligibilityHospitalShape,
  kams: readonly T[],
  adjacency: AdjacencyMatrix,
  seconds: (kamId: string) => number | null,
  rule: BogotaRuleInput | null
): CompetitionOutcome | null {
  const eligible = eligibleKamsForHospital([...kams], hospital, adjacency)
  const asCandidate = (kam: T): CompetitionCandidate => ({
    kam_id: kam.id,
    seconds: seconds(kam.id),
    max_minutes: kam.max_travel_time,
    priority: kam.priority,
  })

  if (!rule || hospital.department_id === '11') {
    const winner = pickCompetitiveWinner(eligible.map(asCandidate))
    return winner
      ? { kam_id: winner.kam_id, travel_time: winner.seconds, assignment_type: 'competitive', detail: null, motivo: null }
      : null
  }

  const virtual = bogotaVirtualCandidate(
    eligible.filter(isBogotaKam).map(kam => ({ kam_id: kam.id, priority: kam.priority, seconds: seconds(kam.id) })),
    rule.config.max_travel_minutes
  )
  // Las celdas se sustituyen por UN candidato "Bogotá" en la posición de la primera celda elegible
  const candidates: CompetitionCandidate[] = []
  let virtualAdded = false
  for (const kam of eligible) {
    if (!isBogotaKam(kam)) {
      candidates.push(asCandidate(kam))
    } else if (virtual && !virtualAdded) {
      candidates.push({ kam_id: BOGOTA_VIRTUAL_ID, seconds: virtual.min_seconds, max_minutes: virtual.max_minutes, priority: virtual.priority })
      virtualAdded = true
    }
  }

  const winner = pickCompetitiveWinner(candidates)
  if (!winner) return null
  if (winner.kam_id !== BOGOTA_VIRTUAL_ID || !virtual) {
    return { kam_id: winner.kam_id, travel_time: winner.seconds, assignment_type: 'competitive', detail: null, motivo: null }
  }

  const activeCells = new Set(kams.filter(kam => hasValidKamArea(kam) && isBogotaKam(kam)).map(kam => kam.id))
  const choice = chooseBogotaCell(hospital, virtual, rule, activeCells, seconds)
  return {
    kam_id: choice.kam_id,
    travel_time: choice.travel_time,
    assignment_type: 'bogota_corredor',
    detail: choice.detail,
    motivo: choice.motivo,
  }
}

/** PostgREST: relación inexistente (42P01) o fuera de la caché de esquema (PGRST205). */
function isMissingTableError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  if (error.code === '42P01' || error.code === 'PGRST205') return true
  return /does not exist|could not find the table|schema cache/i.test(error.message || '')
}

export type BogotaRuleStatus = 'activa' | 'sin_tablas' | 'sin_config' | 'config_invalida' | 'sin_corredores'

/**
 * Lee bogota_config (id = 1) y bogota_corredores (solo SELECT). La regla queda ACTIVA solo si hay
 * fila de configuración válida Y al menos una fila de corredores; en cualquier otro caso (tablas sin
 * crear, sin filas o configuración inválida) devuelve rule = null y el motor se comporta como antes:
 * cada celda de Bogotá compite sola con su kams.max_travel_time. Lo usan el motor de IPS y el de
 * municipios (lib/municipality-coverage.ts, que pasa su propio cliente `db`).
 */
export async function loadBogotaRule(
  db?: SupabaseAdminClient
): Promise<{ rule: BogotaRuleInput | null; status: BogotaRuleStatus; warnings: string[] }> {
  const supabase = db ?? getSupabaseAdmin()
  const { data: configRow, error: configError } = await supabase.from('bogota_config').select('*').eq('id', 1).maybeSingle()
  if (configError) {
    if (isMissingTableError(configError)) return { rule: null, status: 'sin_tablas', warnings: [] }
    throw new Error(`Error cargando bogota_config: ${configError.message}`)
  }
  if (!configRow) return { rule: null, status: 'sin_config', warnings: [] }
  const config = parseBogotaConfig(configRow)
  if (!config) return { rule: null, status: 'config_invalida', warnings: ['bogota_config tiene k o max_travel_minutes inválidos.'] }

  const { data: corredorRows, error: corredoresError } = await supabase
    .from('bogota_corredores')
    .select('department_code, municipality_code, corredor, nota')
    .range(0, 4999)
  if (corredoresError) {
    if (isMissingTableError(corredoresError)) return { rule: null, status: 'sin_tablas', warnings: [] }
    throw new Error(`Error cargando bogota_corredores: ${corredoresError.message}`)
  }
  const corredores = parseCorredorRows(corredorRows)
  if (corredores.length === 0) return { rule: null, status: 'sin_corredores', warnings: [] }
  return { rule: { config, corredores }, status: 'activa', warnings: validarGrupos(config.k, config.grupos) }
}

export interface AlgorithmKam {
  id: string
  name: string
  area_id: string
  lat: number
  lng: number
  enable_level2: boolean
  max_travel_time: number  // En MINUTOS
  priority: number
  active: boolean
  participates_in_assignment?: boolean  // Si participa en asignación territorial
}

export interface AlgorithmHospital {
  id: string
  code: string
  name: string
  department_id: string
  municipality_id: string
  locality_id?: string
  lat: number
  lng: number
  beds: number
  active: boolean
}

// Alias internos de la clase (nombres históricos)
type KAM = AlgorithmKam
type Hospital = AlgorithmHospital

export interface Assignment {
  kam_id: string
  hospital_id: string
  travel_time: number | null  // En SEGUNDOS (null si no hay tiempo calculado, p.ej. territorio forzado)
  assignment_type: 'forced' | 'base_territory' | 'competitive' | 'majority_rule' | 'bogota_corredor'
  is_base_territory: boolean
  /**
   * Solo en 'bogota_corredor' (columna assignments.detail jsonb): hacia afuera BogotaAssignmentDetail; dentro de
   * Bogotá, por sector, BogotaSectorDetail. Las demás filas no llevan la clave.
   */
  detail?: BogotaAssignmentDetail | BogotaSectorDetail
}

export interface DistanceRecord {
  hospital_id: string
  kam_id: string
  travel_time: number  // En SEGUNDOS
}

export interface ForcedAssignment {
  territory_id: string
  territory_type: 'municipality' | 'locality'
  territory_name: string
  kam_id: string
  reason?: string
  active: boolean
}

/**
 * Ajustes en memoria para simular escenarios SIN tocar la BD (p. ej. scripts/fase1-simulate.ts).
 * - kamActive: fuerza el estado activo por area_id ('13001' => true activa Cartagena en la simulación).
 *   Solo afecta a KAMs con participates_in_assignment = true.
 * - excludeKamNames: nombres de KAM que se quitan del cálculo (como si se hubieran borrado).
 */
export interface AlgorithmOverrides {
  kamActive?: Record<string, boolean>
  excludeKamNames?: string[]
  /**
   * Regla "Bogotá como una ciudad" en memoria (scripts/bogota-simulate.ts). Si la clave está presente
   * se usa tal cual (null = comportamiento anterior) y NO se leen bogota_config / bogota_corredores.
   */
  bogota?: BogotaRuleInput | null
}

/** Datos ya leídos para ejecutar el algoritmo en memoria (pruebas puras y simulaciones). */
export interface AlgorithmData {
  kams: AlgorithmKam[]
  hospitals: AlgorithmHospital[]
  excludedDepartments: string[]
  distances: DistanceRecord[]
  adjacency: AdjacencyMatrix
  forcedAssignments: ForcedAssignment[]
  bogota: BogotaRuleInput | null
}

export class SimplifiedOpMapAlgorithm {
  private kams: KAM[] = []
  private hospitals: Hospital[] = []
  private excludedDepartments: string[] = []
  private distances: DistanceRecord[] = []
  private adjacencyMatrix: Record<string, string[]> = {}
  private forcedAssignments: ForcedAssignment[] = []
  private bogotaRule: BogotaRuleInput | null = null
  private bogotaRuleStatus: BogotaRuleStatus | 'en_memoria' = 'sin_config'
  // Índice hospital|kam -> SEGUNDOS (primera fila por par, como el antiguo find)
  private distanceIndex = new Map<string, number>()

  /** Carga datos ya leídos, sin tocar la base (pruebas puras y simulaciones). */
  loadFromData(data: AlgorithmData) {
    this.kams = data.kams.filter(hasValidKamArea)
    this.hospitals = data.hospitals
    this.excludedDepartments = data.excludedDepartments
    this.distances = data.distances
    this.adjacencyMatrix = data.adjacency
    this.forcedAssignments = data.forcedAssignments
    this.bogotaRule = data.bogota
    this.bogotaRuleStatus = 'en_memoria'
    this.buildDistanceIndex()
  }

  /** Regla de Bogotá con la que se calcula (null = cada celda compite sola) y de dónde salió. */
  getBogotaRule(): { rule: BogotaRuleInput | null; status: BogotaRuleStatus | 'en_memoria' } {
    return { rule: this.bogotaRule, status: this.bogotaRuleStatus }
  }

  private buildDistanceIndex() {
    this.distanceIndex = new Map()
    for (const d of this.distances) {
      const key = `${d.hospital_id}|${d.kam_id}`
      if (!this.distanceIndex.has(key)) this.distanceIndex.set(key, d.travel_time)
    }
  }

  async loadData(overrides?: AlgorithmOverrides) {
    console.log('🔄 Cargando datos...')
    const supabase = getSupabaseAdmin()

    // 1. Cargar departamentos excluidos
    const { data: excludedDepts, error: excludedError } = await supabase
      .from('departments')
      .select('code')
      .eq('excluded', true)
    if (excludedError) {
      throw new Error(`Error cargando departments: ${excludedError.message}`)
    }

    this.excludedDepartments = (excludedDepts || []).map(d => d.code)
    console.log(`✅ ${this.excludedDepartments.length} departamentos excluidos`)

    // 2. Cargar KAMs activos que participan en asignación territorial (orden determinista).
    // Con overrides.kamActive se cargan también los inactivos para poder activarlos en memoria.
    const kamActiveOverrides = overrides?.kamActive ?? {}
    const hasActiveOverrides = Object.keys(kamActiveOverrides).length > 0
    let kamsQuery = supabase
      .from('kams')
      .select('*')
      .eq('participates_in_assignment', true)
    if (!hasActiveOverrides) {
      kamsQuery = kamsQuery.eq('active', true)
    }
    const { data: kamsData, error: kamsError } = await kamsQuery.order('name')
    if (kamsError) {
      throw new Error(`Error cargando kams: ${kamsError.message}`)
    }

    let loadedKams = (kamsData || []) as KAM[]
    if (hasActiveOverrides) {
      loadedKams = loadedKams
        .map(kam =>
          Object.prototype.hasOwnProperty.call(kamActiveOverrides, kam.area_id)
            ? { ...kam, active: kamActiveOverrides[kam.area_id] }
            : kam
        )
        .filter(kam => kam.active)
    }
    const excludedNames = new Set(overrides?.excludeKamNames ?? [])
    if (excludedNames.size > 0) {
      loadedKams = loadedKams.filter(kam => !excludedNames.has(kam.name))
    }

    // area_id === '11001' (Bogotá como municipio) es una configuración inválida: se excluye
    this.kams = loadedKams.filter(kam => {
      if (hasValidKamArea(kam)) return true
      console.warn(
        `⚠️ KAM "${kam.name}" (${kam.id}) excluido de la asignación: area_id "${kam.area_id}" no es válido. ` +
        `Los KAMs de Bogotá deben configurarse con un código de localidad (11001XX), no con ${BOGOTA_MUNICIPALITY_ID}.`
      )
      return false
    })
    console.log(`✅ ${this.kams.length} KAMs activos con territorio`)

    // 3. Cargar hospitales activos (NO filtrar por departamentos aquí)
    const { data: hospitalsData, error: hospitalsError } = await supabase
      .from('hospitals')
      .select('*')
      .eq('active', true)
    if (hospitalsError) {
      throw new Error(`Error cargando hospitals: ${hospitalsError.message}`)
    }

    this.hospitals = hospitalsData || []
    console.log(`✅ ${this.hospitals.length} hospitales activos`)

    // 4. Cargar matriz de adyacencia
    const { data: adjacencyData, error: adjacencyError } = await supabase
      .from('department_adjacency')
      .select('*')
    if (adjacencyError) {
      throw new Error(`Error cargando department_adjacency: ${adjacencyError.message}`)
    }

    this.adjacencyMatrix = {}
    for (const adj of adjacencyData || []) {
      if (!this.adjacencyMatrix[adj.department_code]) {
        this.adjacencyMatrix[adj.department_code] = []
      }
      this.adjacencyMatrix[adj.department_code].push(adj.adjacent_department_code)
    }
    console.log(`✅ Matriz de adyacencia cargada`)

    // 5. Cargar TODAS las distancias precalculadas
    console.log('📊 Cargando distancias precalculadas...')
    this.distances = []

    // Cargar TODAS las distancias sin filtros, paginando
    let offset = 0
    const batchSize = 1000

    while (true) {
      const { data: distBatch, error } = await supabase
        .from('hospital_kam_distances')
        .select('hospital_id, kam_id, travel_time')
        .range(offset, offset + batchSize - 1)

      // Un error a mitad de la paginación dejaría distancias incompletas: abortar
      if (error) {
        throw new Error(`Error cargando hospital_kam_distances: ${error.message}`)
      }

      if (distBatch && distBatch.length > 0) {
        this.distances.push(...distBatch)
        console.log(`  Cargadas ${this.distances.length} distancias...`)
        offset += batchSize

        if (distBatch.length < batchSize) {
          break // Última página
        }
      } else {
        break
      }
    }

    console.log(`✅ ${this.distances.length} distancias cargadas`)

    // 6. Cargar asignaciones forzadas
    console.log('🔒 Cargando asignaciones forzadas...')
    const { data: forcedData, error: forcedError } = await supabase
      .from('forced_assignments')
      .select('*')
      .eq('active', true)
    if (forcedError) {
      throw new Error(`Error cargando forced_assignments: ${forcedError.message}`)
    }

    this.forcedAssignments = forcedData || []
    console.log(`✅ ${this.forcedAssignments.length} asignaciones forzadas activas`)

    // 7. Bogotá como una ciudad hacia afuera (bogota_config + bogota_corredores; solo SELECT)
    if (overrides && Object.prototype.hasOwnProperty.call(overrides, 'bogota')) {
      this.bogotaRule = overrides.bogota ?? null
      this.bogotaRuleStatus = 'en_memoria'
    } else {
      const loaded = await loadBogotaRule()
      this.bogotaRule = loaded.rule
      this.bogotaRuleStatus = loaded.status
      for (const warning of loaded.warnings) console.warn(`Configuración de Bogotá: ${warning}`)
    }
    console.log(
      this.bogotaRule
        ? `Bogotá como una ciudad: activa (k = ${this.bogotaRule.config.k}, tope ${this.bogotaRule.config.max_travel_minutes} min, ${this.bogotaRule.corredores.length} filas de corredores)`
        : `Bogotá como una ciudad: inactiva (${this.bogotaRuleStatus}); cada celda compite sola`
    )

    this.buildDistanceIndex()
  }

  // Delegan en las funciones puras exportadas (fuente única de las reglas de elegibilidad)
  canKamCompeteForHospital(kam: KAM, hospital: Hospital): boolean {
    return canKamCompeteForHospital(kam, hospital, this.adjacencyMatrix)
  }

  isBaseTerritory(kam: KAM, hospital: Hospital): boolean {
    return isBaseTerritory(kam, hospital)
  }

  private getDistance(hospitalId: string, kamId: string): number | null {
    return this.distanceIndex.get(`${hospitalId}|${kamId}`) ?? null
  }

  private isForcedTerritory(hospital: Hospital): ForcedAssignment | null {
    // Verificar si el hospital está en un territorio con asignación forzada
    const territoryId = hospital.locality_id || hospital.municipality_id
    return this.forcedAssignments.find(fa => fa.territory_id === territoryId) || null
  }

  async calculateAssignments(): Promise<Assignment[]> {
    console.log('\n🚀 INICIANDO ALGORITMO SIMPLIFICADO')
    console.log('=' + '='.repeat(59))
    const startTime = Date.now()
    
    const assignments: Assignment[] = []
    const assignedHospitals = new Set<string>()
    
    // FASE 0: Aplicar asignaciones forzadas
    console.log('\n🔒 FASE 0: Aplicando asignaciones forzadas...')
    const forcedTerritories = new Set<string>()
    
    const warnedForcedTerritories = new Set<string>()

    for (const hospital of this.hospitals) {
      const forcedAssignment = this.isForcedTerritory(hospital)
      if (!forcedAssignment) continue

      // this.kams solo contiene KAMs activos que participan en la asignación (y con area_id válido)
      const kam = this.kams.find(k => k.id === forcedAssignment.kam_id)
      if (!kam) {
        if (!warnedForcedTerritories.has(forcedAssignment.territory_id)) {
          warnedForcedTerritories.add(forcedAssignment.territory_id)
          console.warn(
            `⚠️ Asignación forzada ignorada: ${forcedAssignment.territory_name} (${forcedAssignment.territory_id}) ` +
            `apunta al KAM ${forcedAssignment.kam_id}, que está inactivo, no participa en la asignación ` +
            `o tiene un area_id inválido. El territorio entra en la asignación normal.`
          )
        }
        continue
      }

      // Tiempo de viaje si existe; null si no está calculado (no inventar 0 segundos)
      const travelTime = this.getDistance(hospital.id, kam.id) ?? null

      assignments.push({
        kam_id: kam.id,
        hospital_id: hospital.id,
        travel_time: travelTime,
        assignment_type: 'forced',
        is_base_territory: false
      })
      assignedHospitals.add(hospital.id)

      if (!forcedTerritories.has(forcedAssignment.territory_id)) {
        forcedTerritories.add(forcedAssignment.territory_id)
        console.log(`  ✓ ${forcedAssignment.territory_name} → ${kam.name} (FORZADO: ${forcedAssignment.reason || 'Sin razón'})`)
      }
    }

    console.log(`  Total territorios forzados: ${forcedTerritories.size}`)
    console.log(`  Total hospitales en territorios forzados: ${assignments.length}`)

    // FASE 0b: Bogotá por sectores (2026-10-28). Cada IPS de Bogotá va a la celda del corredor de su localidad,
    // antes del territorio base (la localidad de Chapinero es del sector Oriente aunque ahí viva la celda del Norte)
    // y sin competir por minutos. Sin regla de Bogotá o con la celda del sector inactiva, sigue la regla de siempre.
    if (this.bogotaRule) {
      console.log('\n🧭 FASE 0b: Bogotá por sectores (corredor de cada localidad)...')
      const activeCells = new Set(this.kams.filter(kam => hasValidKamArea(kam) && isBogotaKam(kam)).map(kam => kam.id))
      const porCelda = new Map<string, number>()
      for (const hospital of this.hospitals) {
        if (assignedHospitals.has(hospital.id) || !isBogotaHospital(hospital)) continue
        const sector = bogotaSectorCell(hospital, this.bogotaRule, activeCells, kamId => this.getDistance(hospital.id, kamId))
        if (!sector) continue
        assignments.push({
          kam_id: sector.kam_id,
          hospital_id: hospital.id,
          travel_time: sector.travel_time,
          assignment_type: 'bogota_corredor',
          is_base_territory: false,
          detail: sector.detail
        })
        assignedHospitals.add(hospital.id)
        porCelda.set(sector.kam_id, (porCelda.get(sector.kam_id) || 0) + 1)
      }
      for (const [kamId, n] of Array.from(porCelda.entries())) {
        console.log(`  ✓ ${this.kams.find(k => k.id === kamId)?.name ?? kamId}: ${n} IPS de su sector`)
      }
    }
    
    // FASE 1: Asignar territorios base (excepto los ya forzados)
    console.log('\n📍 FASE 1: Asignando territorios base...')
    
    for (const kam of this.kams) {
      const baseHospitals = this.hospitals.filter(h => 
        this.isBaseTerritory(kam, h) && !assignedHospitals.has(h.id)
      )
      
      for (const hospital of baseHospitals) {
        assignments.push({
          kam_id: kam.id,
          hospital_id: hospital.id,
          travel_time: 0,  // Territorio base = 0 segundos
          assignment_type: 'base_territory',
          is_base_territory: true
        })
        assignedHospitals.add(hospital.id)
      }
      
      if (baseHospitals.length > 0) {
        console.log(`  ✓ ${kam.name}: ${baseHospitals.length} hospitales en territorio base`)
      }
    }
    
    // FASE 2: Asignación competitiva
    console.log('\n🏥 FASE 2: Asignación competitiva...')
    console.log(`  Tiempo transcurrido: ${(Date.now() - startTime) / 1000}s`)
    
    // Filtrar hospitales sin asignar y que NO estén en departamentos excluidos
    const unassignedHospitals = this.hospitals.filter(h => 
      !assignedHospitals.has(h.id) && 
      !this.excludedDepartments.includes(h.department_id)
    )
    console.log(`  Hospitales por asignar: ${unassignedHospitals.length}`)
    console.log(`  (Excluidos ${this.hospitals.filter(h => this.excludedDepartments.includes(h.department_id)).length} hospitales en departamentos remotos)`)
    
    let processedCount = 0
    for (const hospital of unassignedHospitals) {
      processedCount++
      if (processedCount % 50 === 0) {
        console.log(`  Procesados ${processedCount}/${unassignedHospitals.length} hospitales...`)
      }
      // Regla de siempre (menor tiempo dentro del tope; empate -> prioridad) con "Bogotá como una
      // ciudad" hacia afuera cuando hay configuración (competeForHospital, función pura)
      const outcome = competeForHospital(
        hospital,
        this.kams,
        this.adjacencyMatrix,
        kamId => this.getDistance(hospital.id, kamId),
        this.bogotaRule
      )

      if (outcome) {
        const assignment: Assignment = {
          kam_id: outcome.kam_id,
          hospital_id: hospital.id,
          travel_time: outcome.travel_time,  // En SEGUNDOS
          assignment_type: outcome.assignment_type,
          is_base_territory: false
        }
        if (outcome.detail) assignment.detail = outcome.detail
        assignments.push(assignment)
        assignedHospitals.add(hospital.id)
        // Solo mostrar log para algunos hospitales para no saturar
        if (processedCount <= 5 || processedCount % 50 === 0) {
          const kamName = this.kams.find(k => k.id === outcome.kam_id)?.name ?? outcome.kam_id
          console.log(`  ✓ ${hospital.name} → ${kamName} (${Math.round(outcome.travel_time/60)} min)`)
        }
      } else {
        console.log(`  ❌ ${hospital.name} - Sin KAM disponible`)
      }
    }
    
    // FASE 3: Regla de mayoría para zonas compartidas (NO aplicar a territorios forzados)
    console.log('\n🏘️ FASE 3: Aplicando regla de mayoría por CAMAS en localidades...')
    console.log(`  Tiempo transcurrido: ${(Date.now() - startTime) / 1000}s`)
    
    // Cambio: usar número de CAMAS en lugar de número de hospitales
    const localityBeds: Record<string, Record<string, number>> = {}
    
    // Contar CAMAS por localidad y KAM
    for (const assignment of assignments) {
      const hospital = this.hospitals.find(h => h.id === assignment.hospital_id)
      if (hospital?.locality_id && hospital.locality_id.startsWith('11001')) {
        if (!localityBeds[hospital.locality_id]) {
          localityBeds[hospital.locality_id] = {}
        }
        // Sumar CAMAS del hospital al KAM
        const beds = hospital.beds || 0
        localityBeds[hospital.locality_id][assignment.kam_id] = 
          (localityBeds[hospital.locality_id][assignment.kam_id] || 0) + beds
      }
    }
    
    // Aplicar regla de mayoría basada en CAMAS (excepto territorios forzados)
    for (const [localityId, kamBedCounts] of Object.entries(localityBeds)) {
      // Verificar si este territorio tiene asignación forzada
      const isForcedTerritory = this.forcedAssignments.some(fa => fa.territory_id === localityId)
      
      if (!isForcedTerritory && Object.keys(kamBedCounts).length > 1) {
        // Encontrar KAM con más CAMAS (no hospitales)
        const winner = Object.entries(kamBedCounts)
          .sort(([,a], [,b]) => b - a)[0][0]
        
        const winnerKam = this.kams.find(k => k.id === winner)
        const winnerBeds = kamBedCounts[winner]
        const totalBeds = Object.values(kamBedCounts).reduce((sum, beds) => sum + beds, 0)
        console.log(`  Localidad ${localityId}: ${winnerKam?.name} gana con ${winnerBeds} de ${totalBeds} camas`)
        
        // Reasignar todos los hospitales de la localidad al ganador
        for (let i = 0; i < assignments.length; i++) {
          const hospital = this.hospitals.find(h => h.id === assignments[i].hospital_id)
          if (hospital?.locality_id === localityId && assignments[i].kam_id !== winner) {
            const newTime = this.getDistance(hospital.id, winner)
            // Solo reasignar si existe el tiempo de viaje
            if (newTime !== null) {
              assignments[i] = {
                ...assignments[i],
                kam_id: winner,
                travel_time: newTime,
                assignment_type: 'majority_rule'
              }
            } else {
              console.log(`  ⚠️ No se pudo reasignar ${hospital.name} al ganador por falta de tiempo de viaje`)
              // Mantener la asignación original
            }
          }
        }
      }
    }
    
    // Estadísticas finales
    console.log('\n📊 ESTADÍSTICAS FINALES:')
    console.log('=' + '='.repeat(59))
    console.log(`⏱️ Tiempo total de cálculo: ${(Date.now() - startTime) / 1000}s`)
    console.log(`Total hospitales activos: ${this.hospitals.length}`)
    console.log(`Total asignaciones: ${assignments.length}`)
    console.log(`Hospitales sin asignar: ${this.hospitals.length - assignments.length}`)
    
    // Resumen por KAM
    const kamSummary: Record<string, number> = {}
    assignments.forEach(a => {
      kamSummary[a.kam_id] = (kamSummary[a.kam_id] || 0) + 1
    })
    
    console.log('\n📈 Asignaciones por KAM:')
    for (const [kamId, count] of Object.entries(kamSummary)) {
      const kam = this.kams.find(k => k.id === kamId)
      console.log(`  ${kam?.name}: ${count} hospitales`)
    }
    
    return assignments
  }
  
  async saveAssignments(assignments: Assignment[]) {
    console.log('\n💾 Guardando asignaciones...')
    const supabase = getSupabaseAdmin()
    
    // Limpiar asignaciones anteriores
    const { error: deleteError } = await supabase
      .from('assignments')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')
    if (deleteError) {
      throw new Error(`Error limpiando assignments: ${deleteError.message}`)
    }
    
    // Insertar nuevas asignaciones en lotes
    const batchSize = 500
    for (let i = 0; i < assignments.length; i += batchSize) {
      const batch = assignments.slice(i, i + batchSize)
      const { error } = await supabase.from('assignments').insert(batch)
      
      if (error) {
        console.error(`❌ Error en lote ${i/batchSize + 1}:`, error)
        throw error
      }
    }
    
    console.log(`✅ ${assignments.length} asignaciones guardadas`)
  }
}

export async function runSimplifiedAlgorithm() {
  const algorithm = new SimplifiedOpMapAlgorithm()
  
  try {
    await algorithm.loadData()
    const assignments = await algorithm.calculateAssignments()
    await algorithm.saveAssignments(assignments)
    
    return {
      success: true,
      assignments: assignments.length,
      message: `Algoritmo completado: ${assignments.length} asignaciones realizadas`
    }
  } catch (error) {
    console.error('Error ejecutando algoritmo:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    }
  }
}