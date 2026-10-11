// Tipos de la Fase 1: líneas de negocio, ejecutivas y cobertura.
// Modelo: ZONA (cada fila de kams, ciudad base = area_id; en la UI se llama "Zona"),
// PERSONA (executives) y LÍNEA (business_lines). En código los identificadores siguen siendo kam_id/kams.

export type ExecutiveStatus = 'active' | 'placeholder' | 'inactive'

export const EXECUTIVE_STATUSES: readonly ExecutiveStatus[] = ['active', 'placeholder', 'inactive'] as const

export type CoverageKind = 'local' | 'reach' | 'manual' | 'vacant'

// ---------------------------------------------------------------------------
// Filas de la base de datos (schema public)
// ---------------------------------------------------------------------------

export interface BusinessLineRow {
  id: string
  code: string
  name: string
  leader_user_id: string | null
  max_reach_minutes: number
  active: boolean
  sort_order: number
  created_at: string | null
  updated_at: string | null
}

export interface ExecutiveRow {
  id: string
  user_id: string | null
  full_name: string
  email: string | null
  company: string
  base_kam_id: string | null
  odoo_employee_id: number | null
  status: ExecutiveStatus
  started_at: string | null
  left_at: string | null
  notes: string | null
  created_at: string | null
  updated_at: string | null
}

export interface ExecutiveLineRow {
  executive_id: string
  line_id: string
}

export interface LineZoneRow {
  line_id: string
  kam_id: string
  has_equipment: boolean
}

// Se crean en Fase 1, se llenan en Fase 2.
export interface CoverageRow {
  id: string
  line_id: string
  kam_id: string
  executive_id: string | null
  kind: CoverageKind
  travel_minutes: number | null
  source_kam_id: string | null
  computed_at: string
}

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
// Contrato de la API (lo que devuelven las rutas)
// ---------------------------------------------------------------------------

export interface LineZone {
  kam_id: string
  has_equipment: boolean
}

/** Elemento de GET /api/business-lines */
export interface BusinessLine {
  id: string
  code: string
  name: string
  leader_user_id: string | null
  leader_name: string | null
  max_reach_minutes: number
  active: boolean
  sort_order: number
  zones: LineZone[]
}

export interface BusinessLinesResponse {
  lines: BusinessLine[]
}

/** PATCH /api/business-lines/[id] → { line } */
export interface BusinessLineResponse {
  line: BusinessLine
}

/** PUT /api/business-lines/[id]/zones → { zones } */
export interface LineZonesResponse {
  zones: LineZone[]
}

/** Elemento de GET /api/executives */
export interface Executive {
  id: string
  full_name: string
  email: string | null
  company: string
  status: ExecutiveStatus
  base_kam_id: string | null
  base_kam_name: string | null
  user_id: string | null
  odoo_employee_id: number | null
  lines: string[] // ids de business_lines
  notes: string | null
}

export interface ExecutivesResponse {
  executives: Executive[]
}

/** POST, PATCH y DELETE /api/executives[/id] → { executive } */
export interface ExecutiveResponse {
  executive: Executive
}

// ---------------------------------------------------------------------------
// Cuerpos de las peticiones (los valida lib/fase1-schemas.ts)
// ---------------------------------------------------------------------------

export interface BusinessLineUpdateInput {
  name?: string
  leader_user_id?: string | null
  max_reach_minutes?: number
  active?: boolean
}

export interface LineZonesInput {
  zones: LineZone[]
}

export interface ExecutiveCreateInput {
  full_name: string
  email?: string | null
  company?: string
  base_kam_id: string
  status?: ExecutiveStatus
  lines: string[]
  odoo_employee_id?: number | null
  notes?: string | null
}

export type ExecutiveUpdateInput = Partial<ExecutiveCreateInput>
