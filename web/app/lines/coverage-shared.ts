// Tipos y utilidades de la UI de cobertura por línea (no es una ruta: Next.js solo publica page.tsx).
// Contrato de la API (Fase 2): GET /api/me/lines, GET /api/coverage?line=<code>,
// POST /api/coverage/recalculate, POST /api/coverage/overrides, DELETE /api/coverage/overrides/[id].

export type CoverageKindUI = 'local' | 'reach' | 'manual' | 'vacant' | 'conflict'

export type MyLineRole = 'leader' | 'executive' | 'all'

/** Elemento de GET /api/me/lines */
export interface MyLine {
  id: string
  code: string
  name: string
  role: MyLineRole
}

export interface MyLinesResponse {
  lines: MyLine[]
  canSeeAll: boolean
}

export interface CoverageExecutive {
  id: string
  full_name: string
  status: 'active' | 'placeholder' | 'inactive'
  color: string | null
}

export interface CoverageNearest {
  executive_id: string
  full_name: string
  minutes: number
}

/** Fila de GET /api/coverage?line=<code> */
export interface CoverageRowUI {
  kam_id: string
  zone_name: string
  base_city: string | null
  kind: CoverageKindUI
  executive: CoverageExecutive | null
  travel_minutes: number | null
  source_kam_id: string | null
  nearest: CoverageNearest | null
  has_equipment: boolean
  note: string | null
  /** Id del ajuste manual activo (si la API lo envía); necesario para "Quitar ajuste". */
  override_id?: string | null
  /** Motivo del ajuste manual (si la API lo envía aparte de `note`). */
  override_reason?: string | null
  /** Nombre de la zona base desde la que se mide el alcance (source_kam_id), si la API lo envía. */
  source_zone_name?: string | null
}

export interface CoverageLineInfo {
  id: string
  code: string
  name: string
  max_reach_minutes: number
}

export interface CoverageResponse {
  line: CoverageLineInfo
  rows: CoverageRowUI[]
}

export const KIND_LABELS: Record<CoverageKindUI, string> = {
  local: 'Local',
  reach: 'Por alcance',
  manual: 'Ajuste manual',
  // "Sin cobertura" desde el 2026-10-23: la celda sin nadie dentro del tope ya no se llama "Vacante", para no
  // confundirla con la vacante por contratar (executives.status = 'placeholder'), que cuenta como una persona.
  vacant: 'Sin cobertura',
  conflict: 'Conflicto',
}

export const KIND_BADGE: Record<CoverageKindUI, string> = {
  local: 'bg-green-50 text-green-700 border-green-200',
  reach: 'bg-blue-50 text-blue-700 border-blue-200',
  manual: 'bg-purple-50 text-purple-700 border-purple-200',
  vacant: 'bg-gray-100 text-gray-600 border-gray-300',
  conflict: 'bg-amber-50 text-amber-800 border-amber-300',
}

export const VACANT_COLOR = '#9ca3af'
export const CONFLICT_COLOR = '#f59e0b'

/** "2 h 15 min", "45 min", "3 h" */
export function formatMinutes(minutes: number): string {
  const total = Math.max(0, Math.round(minutes))
  const h = Math.floor(total / 60)
  const m = total % 60
  if (h === 0) return `${m} min`
  return m === 0 ? `${h} h` : `${h} h ${m} min`
}

/** Extrae el mensaje de error de una respuesta JSON de la API (`error` o `message`; si no, uno genérico). */
export async function readError(response: Response, fallback: string): Promise<string> {
  const data = await response.json().catch(() => null)
  if (data && typeof data.error === 'string' && data.error) return data.error
  if (data && typeof data.message === 'string' && data.message) return data.message
  return `${fallback} (${response.status})`
}

/** Valida y normaliza la respuesta de GET /api/me/lines. */
export function parseMyLines(data: unknown): MyLinesResponse {
  const obj = (data ?? {}) as { lines?: unknown; canSeeAll?: unknown }
  const lines: MyLine[] = Array.isArray(obj.lines)
    ? (obj.lines as MyLine[]).filter(
        line => line && typeof line.id === 'string' && typeof line.code === 'string' && typeof line.name === 'string'
      )
    : []
  return { lines, canSeeAll: obj.canSeeAll === true }
}

/** true si el usuario puede ajustar la cobertura de esa línea (la API vuelve a validarlo). */
export function canEditCoverageOf(line: MyLine | undefined, hasCoverageEdit: boolean): boolean {
  if (!line || !hasCoverageEdit) return false
  return line.role === 'all' || line.role === 'leader'
}
