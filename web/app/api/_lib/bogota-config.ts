// Lectura de la configuración "Bogotá hacia afuera" (bogota_config) y de las celdas de Bogotá (solo
// servidor, service_role). La usan /api/kams/bogota-config, su simulación y
// /api/hospitals/[id]/kam-distances. Las reglas puras están en lib/bogota-corredores.ts y
// lib/bogota-admin.ts.
import { supabaseAdmin } from '@/lib/supabase-admin'
import { parseBogotaConfig, type BogotaConfig } from '@/lib/bogota-corredores'
import { isBogotaCellArea } from '@/lib/bogota-admin'

export interface BogotaCellRow {
  id: string
  name: string
  base_city: string | null
  area_id: string
  max_travel_time: number // MINUTOS (tope individual; hacia afuera manda bogota_config.max_travel_minutes)
  priority: number
  color: string | null
}

export interface BogotaConfigRow {
  config: BogotaConfig
  updated_at: string | null
  updated_by: string | null
}

/** PostgREST: tabla inexistente (42P01) o fuera de la caché de esquema (PGRST205). */
function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  if (error.code === '42P01' || error.code === 'PGRST205') return true
  return /does not exist|could not find the table|schema cache/i.test(error.message || '')
}

/** Celdas de Bogotá: zonas activas que participan en la asignación con area_id 11001xx. */
export async function loadBogotaCells(): Promise<BogotaCellRow[]> {
  const { data, error } = await supabaseAdmin
    .from('kams')
    .select('id, name, base_city, area_id, max_travel_time, priority, color, active, participates_in_assignment')
    .eq('active', true)
    .eq('participates_in_assignment', true)
    .like('area_id', '11001%')
    .order('area_id')
  if (error) throw new Error(`Error cargando las celdas de Bogotá: ${error.message}`)
  return (data || [])
    .filter(row => isBogotaCellArea(row.area_id))
    .map(row => ({
      id: row.id,
      name: row.name,
      base_city: row.base_city ?? null,
      area_id: row.area_id,
      max_travel_time: Number(row.max_travel_time) || 0,
      priority: Number(row.priority) || 0,
      color: row.color ?? null,
    }))
}

/**
 * Fila 1 de bogota_config normalizada. null si la tabla no existe todavía, no tiene fila o la fila no es
 * válida (en ese caso el motor se comporta como antes: cada celda compite sola).
 */
export async function readBogotaConfig(): Promise<BogotaConfigRow | null> {
  const { data, error } = await supabaseAdmin.from('bogota_config').select('*').eq('id', 1).maybeSingle()
  if (error) {
    if (isMissingTable(error)) return null
    throw new Error(`Error cargando bogota_config: ${error.message}`)
  }
  const config = parseBogotaConfig(data)
  if (!data || !config) return null
  return { config, updated_at: data.updated_at ?? null, updated_by: data.updated_by ?? null }
}
