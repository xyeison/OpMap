// Utilidades de servidor para /api/business-lines/** (carpeta "_lib": Next.js no la expone como ruta).
import { supabaseAdmin } from '@/lib/supabase-admin'
import type { BusinessLine, BusinessLineRow, LineZone, LineZoneRow } from '@/lib/types/lines'

const LINE_COLUMNS = 'id, code, name, leader_user_id, max_reach_minutes, active, sort_order'

type LineSelectRow = Pick<
  BusinessLineRow,
  'id' | 'code' | 'name' | 'leader_user_id' | 'max_reach_minutes' | 'active' | 'sort_order'
>

/**
 * Carga las líneas de negocio con el nombre de su líder y su matriz de zonas (line_zones).
 * Si se pasa `onlyId`, devuelve solo esa línea (o lista vacía si no existe).
 * Lanza el error de PostgREST tal cual: el handler lo registra y responde con un mensaje genérico.
 */
export async function loadBusinessLines(onlyId?: string): Promise<BusinessLine[]> {
  let linesQuery = supabaseAdmin
    .from('business_lines')
    .select(LINE_COLUMNS)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })
  if (onlyId) linesQuery = linesQuery.eq('id', onlyId)

  const { data: lineData, error: linesError } = await linesQuery
  if (linesError) throw linesError
  const lines = (lineData || []) as LineSelectRow[]
  if (lines.length === 0) return []

  const lineIds = lines.map(line => line.id)

  // Matriz línea × zona. Las líneas son pocas (5) y las zonas ~20: cabe de sobra en una página.
  const { data: zoneData, error: zonesError } = await supabaseAdmin
    .from('line_zones')
    .select('line_id, kam_id, has_equipment')
    .in('line_id', lineIds)
    .order('kam_id', { ascending: true })
    .range(0, 9999)
  if (zonesError) throw zonesError
  const zoneRows = (zoneData || []) as LineZoneRow[]

  const zonesByLine = new Map<string, LineZone[]>()
  for (const row of zoneRows) {
    const list = zonesByLine.get(row.line_id) || []
    list.push({ kam_id: row.kam_id, has_equipment: row.has_equipment })
    zonesByLine.set(row.line_id, list)
  }

  // Nombres de los líderes (users.full_name)
  const leaderIds = Array.from(
    new Set(lines.map(line => line.leader_user_id).filter((id): id is string => Boolean(id)))
  )
  const leaderNames = new Map<string, string>()
  if (leaderIds.length > 0) {
    const { data: userData, error: usersError } = await supabaseAdmin
      .from('users')
      .select('id, full_name')
      .in('id', leaderIds)
    if (usersError) throw usersError
    for (const user of (userData || []) as Array<{ id: string; full_name: string | null }>) {
      if (user.full_name) leaderNames.set(user.id, user.full_name)
    }
  }

  return lines.map(line => ({
    id: line.id,
    code: line.code,
    name: line.name,
    leader_user_id: line.leader_user_id,
    leader_name: line.leader_user_id ? leaderNames.get(line.leader_user_id) ?? null : null,
    max_reach_minutes: line.max_reach_minutes,
    active: line.active,
    sort_order: line.sort_order,
    zones: zonesByLine.get(line.id) || [],
  }))
}

/** true si la línea existe. */
export async function lineExists(lineId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin.from('business_lines').select('id').eq('id', lineId).limit(1)
  if (error) throw error
  return Boolean(data && data.length > 0)
}
