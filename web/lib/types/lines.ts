// Tipos de la Fase 1: líneas de negocio, ejecutivas y cobertura.
// Modelo: ZONA (cada fila de kams, ciudad base = area_id; en la UI se llama "Zona"),
// PERSONA (executives) y LÍNEA (business_lines). En código los identificadores siguen siendo kam_id/kams.

import type { EmpresaMovil } from '../reporte-visitas'

export type ExecutiveStatus = 'active' | 'placeholder' | 'inactive'

export const EXECUTIVE_STATUSES: readonly ExecutiveStatus[] = ['active', 'placeholder', 'inactive'] as const

// Fase 2: la fuente única de los tipos de cobertura es lib/types/coverage.ts
export type { CoverageKind, CoverageRow, CoverageOverrideRow } from './coverage'

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
  color: string | null // Fase 2: #RRGGBB para el mapa por línea
  created_at: string | null
  updated_at: string | null
}

export interface ExecutiveLineRow {
  executive_id: string
  line_id: string
}

/** Fila de executive_allowed_lines (migración 0860): líneas que la dirección permite a una persona o vacante. */
export interface ExecutiveAllowedLineRow {
  executive_id: string
  line_id: string
  created_by: string | null
  created_at: string | null
}

export interface LineZoneRow {
  line_id: string
  kam_id: string
  has_equipment: boolean
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
  /** Empresas donde está la línea (linea_empresas), por código. [] mientras la migración 0960 no esté aplicada. */
  empresas: EmpresaMovil[]
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
  // Empresas (capa 1): las de executive_empresas activas, por código ([] sin la 0960). Reemplaza a executives.company
  // en la respuesta (la columna sigue en la base, pero nadie la lee)
  empresas: EmpresaMovil[]
  status: ExecutiveStatus
  base_kam_id: string | null
  base_kam_name: string | null
  user_id: string | null
  odoo_employee_id: number | null
  lines: string[] // ids de business_lines
  notes: string | null
  color: string | null // Fase 2: #RRGGBB (null = sin color asignado)
  // Zonas por línea (2026-10-23): líneas que la dirección le permite tener (ids de business_lines). null = sin
  // restricción, también mientras la tabla executive_allowed_lines (migración 0860) no exista. Opcional para no
  // romper a quien arme un Executive a mano; la API siempre lo manda.
  lineas_permitidas?: string[] | null
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
  /** Reemplaza las empresas de la línea; al menos una. */
  empresa_ids?: string[]
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
  color?: string | null
  // null o [] = sin restricción; con valores, lines debe caber dentro (400 si no)
  lineas_permitidas?: string[] | null
}

export type ExecutiveUpdateInput = Partial<ExecutiveCreateInput>
