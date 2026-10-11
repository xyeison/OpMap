// Utilidades de la UI de ejecutivas (no es una ruta: Next.js solo publica page.tsx).
import type { ExecutiveStatus } from '@/lib/types/lines'

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
  return name.replace(/^kam\s+/i, '').trim() || name
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
