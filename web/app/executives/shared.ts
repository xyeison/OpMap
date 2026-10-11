// Utilidades de la UI de ejecutivas (no es una ruta: Next.js solo publica page.tsx).
import type { ExecutiveStatus } from '@/lib/types/lines'
import { zoneDisplayName } from '@/lib/zone-names'

// Zona = fila de kams (ciudad base = area_id). Solo los campos que usa la UI.
export interface ZoneOption {
  id: string
  name: string
  area_id: string
  color: string | null
  active: boolean
}

/** Nombre visible de la zona: los registros heredados se llaman "KAM Ciudad"; en la UI basta "Ciudad". */
export function zoneLabel(name: string): string {
  return zoneDisplayName(name) || name
}

export const STATUS_LABELS: Record<ExecutiveStatus, string> = {
  active: 'Activa',
  placeholder: 'Por contratar',
  inactive: 'Inactiva',
}

export const STATUS_BADGE: Record<ExecutiveStatus, string> = {
  active: 'bg-green-50 text-green-700 border-green-200',
  placeholder: 'bg-amber-50 text-amber-700 border-amber-200',
  inactive: 'bg-gray-50 text-gray-500 border-gray-200',
}

/** Extrae el mensaje de error de una respuesta JSON de la API (o uno genérico). */
export async function readError(response: Response, fallback: string): Promise<string> {
  const data = await response.json().catch(() => null)
  if (data && typeof data.error === 'string' && data.error) return data.error
  return `${fallback} (${response.status})`
}

// Fase 2: color de la ejecutiva en el mapa por línea (executives.color, hex #RRGGBB).
export const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/

/** Paleta categórica sugerida (colores bien separados entre sí). */
export const EXECUTIVE_PALETTE = [
  '#e6194b', '#3cb44b', '#4363d8', '#f58231', '#911eb4', '#42d4f4', '#f032e6',
  '#9a6324', '#469990', '#800000', '#808000', '#000075', '#bfef45',
]

/** Color de la ejecutiva si la API lo envía y es válido; null si no. */
export function executiveColor(executive: object): string | null {
  const color = (executive as { color?: unknown }).color
  return typeof color === 'string' && HEX_COLOR_RE.test(color) ? color : null
}
