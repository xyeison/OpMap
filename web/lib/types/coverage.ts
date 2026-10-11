// Tipos de la Fase 2: cobertura por línea (motor en lib/coverage.ts, API en app/api/coverage/**).
// Modelo: ZONA = fila de kams (kam_id), PERSONA = executives, LÍNEA = business_lines.
// Para cada línea activa L y zona activa Z, coverage guarda quién responde y por qué.

/**
 * local    : una ejecutiva vive en la zona y lleva la línea (travel 0).
 * reach    : la más cercana que lleva la línea, dentro de business_lines.max_reach_minutes.
 * manual   : ajuste del líder de línea (coverage_overrides), gana sobre el cálculo.
 * vacant   : nadie que lleve la línea está dentro del tope (nearest_* dice quién es la más cercana).
 * conflict : dos o más ejecutivas viven en la zona y llevan la línea; el líder debe repartir.
 */
export type CoverageKind = 'local' | 'reach' | 'manual' | 'vacant' | 'conflict'

export const COVERAGE_KINDS: readonly CoverageKind[] = ['local', 'reach', 'manual', 'vacant', 'conflict'] as const

/** Estados de ejecutiva que cuentan para la cobertura (las inactivas nunca cubren). */
export const COVERAGE_EXECUTIVE_STATUSES = ['active', 'placeholder'] as const

// ---------------------------------------------------------------------------
// Filas de la base de datos (forma tras la migración 0400 de la Fase 2)
// ---------------------------------------------------------------------------

/** public.coverage */
export interface CoverageRow {
  id: string
  line_id: string
  kam_id: string
  executive_id: string | null
  kind: CoverageKind
  travel_minutes: number | null
  source_kam_id: string | null
  nearest_executive_id: string | null
  nearest_minutes: number | null
  has_equipment: boolean
  note: string | null
  computed_at: string
}

/** public.coverage_overrides */
export interface CoverageOverrideRow {
  id: string
  line_id: string
  kam_id: string
  executive_id: string
  reason: string
  created_by: string | null
  active: boolean
  created_at: string | null
}

// ---------------------------------------------------------------------------
// Entradas y salida del motor puro (lib/coverage.ts)
// ---------------------------------------------------------------------------

export interface CoverageZoneInput {
  id: string
  name: string
  area_id: string // municipio DANE (5 dígitos) o localidad de Bogotá (7 dígitos)
  active: boolean
}

export interface CoverageHospitalInput {
  id: string
  municipality_id: string | null
  locality_id: string | null
}

/** hospital_kam_distances: travel_time en SEGUNDOS desde el punto base de la zona (kam_id). */
export interface CoverageDistanceInput {
  hospital_id: string
  kam_id: string
  travel_time: number | null
}

export interface CoverageLineInput {
  id: string
  code: string
  name: string
  max_reach_minutes: number
  active: boolean
}

export interface CoverageExecutiveInput {
  id: string
  full_name: string
  status: 'active' | 'placeholder' | 'inactive'
  base_kam_id: string | null
}

export interface CoverageExecutiveLineInput {
  executive_id: string
  line_id: string
}

export interface CoverageLineZoneInput {
  line_id: string
  kam_id: string
  has_equipment: boolean
}

export interface CoverageOverrideInput {
  id: string
  line_id: string
  kam_id: string
  executive_id: string
  reason: string
  active: boolean
}

/**
 * Matriz zona → zona en minutos de carro: matrix[origen][destino].
 * Mediana de hospital_kam_distances.travel_time/60 desde la zona origen hacia las IPS activas
 * de la zona destino. La diagonal vale 0 (misma ciudad base). Si no hay datos, la clave no existe.
 */
export type ZoneMatrix = Record<string, Record<string, number>>

/** Una fila calculada por (línea, zona): lo que se guarda en public.coverage. */
export interface ComputedCoverage {
  line_id: string
  kam_id: string
  executive_id: string | null
  kind: CoverageKind
  travel_minutes: number | null
  source_kam_id: string | null
  nearest_executive_id: string | null
  nearest_minutes: number | null
  has_equipment: boolean
  note: string | null
  /** Ajuste manual activo de (línea, zona), aunque haya quedado sin efecto. No se guarda en coverage. */
  override_id: string | null
}

export interface CoverageInputs {
  zones: CoverageZoneInput[]
  hospitals: CoverageHospitalInput[]
  distances: CoverageDistanceInput[]
  lines: CoverageLineInput[]
  executives: CoverageExecutiveInput[]
  executiveLines: CoverageExecutiveLineInput[]
  lineZones: CoverageLineZoneInput[]
  overrides: CoverageOverrideInput[]
}

// ---------------------------------------------------------------------------
// Contrato de la API
// ---------------------------------------------------------------------------

export type MeLineRole = 'leader' | 'executive' | 'all'

export interface MeLine {
  id: string
  code: string
  name: string
  role: MeLineRole
}

/** GET /api/me/lines */
export interface MeLinesResponse {
  lines: MeLine[]
  canSeeAll: boolean
}

export interface CoverageLineInfo {
  id: string
  code: string
  name: string
  max_reach_minutes: number
}

export interface CoverageExecutiveRef {
  id: string
  full_name: string
  status: 'active' | 'placeholder' | 'inactive'
  color: string | null
}

export interface CoverageNearestRef {
  executive_id: string
  full_name: string
  minutes: number
}

/** Elemento de rows en GET /api/coverage?line=<code> (y en /api/map/data?line=<code>). */
export interface CoverageApiRow {
  kam_id: string
  zone_name: string
  base_city: string | null
  kind: CoverageKind
  executive: CoverageExecutiveRef | null
  travel_minutes: number | null
  source_kam_id: string | null
  nearest: CoverageNearestRef | null
  has_equipment: boolean
  /** manual: motivo del ajuste; conflict: nombres en conflicto; otros: avisos del cálculo. */
  note: string | null
  /** Extras (no rompen el contrato): ajuste manual activo de (línea, zona) y su motivo. */
  override_id: string | null
  override_reason: string | null
  /** Nombre de la zona base desde la que se mide el alcance (source_kam_id). */
  source_zone_name: string | null
}

/** GET /api/coverage?line=<code> */
export interface CoverageResponse {
  line: CoverageLineInfo
  rows: CoverageApiRow[]
  /** Fecha del último cálculo guardado; null si la línea no tenía filas y se calculó al vuelo. */
  computed_at: string | null
}

/** POST /api/coverage/recalculate */
export interface CoverageRecalculateResponse {
  rows: number
}

/** Cuerpo de POST /api/coverage/overrides (lo valida coverageOverrideSchema en lib/coverage.ts). */
export interface CoverageOverrideInputBody {
  line_id: string
  kam_id: string
  executive_id: string
  reason: string
}

/** POST /api/coverage/overrides y DELETE /api/coverage/overrides/[id] */
export interface CoverageOverrideResponse {
  override: {
    id: string
    line_id: string
    kam_id: string
    executive_id: string
    reason: string
    active: boolean
  }
  rows: number
}
