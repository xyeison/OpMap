// Utilidades de servidor para /api/executives/** (carpeta "_lib": Next.js no la expone como ruta).
import { supabaseAdmin } from '@/lib/supabase-admin'
import type { Executive, ExecutiveLineRow, ExecutiveRow } from '@/lib/types/lines'

const EXECUTIVE_COLUMNS =
  'id, full_name, email, company, status, base_kam_id, user_id, odoo_employee_id, notes'

type ExecutiveSelectRow = Pick<
  ExecutiveRow,
  'id' | 'full_name' | 'email' | 'company' | 'status' | 'base_kam_id' | 'user_id' | 'odoo_employee_id' | 'notes'
>

/**
 * Carga las ejecutivas (todas, incluidas las inactivas) con el nombre de su zona base y sus líneas.
 * Funciona aunque executive_lines esté vacía: cada ejecutiva sale con lines = [].
 * Si se pasa `onlyId`, devuelve solo esa ejecutiva (o lista vacía si no existe).
 */
export async function loadExecutives(onlyId?: string): Promise<Executive[]> {
  let query = supabaseAdmin
    .from('executives')
    .select(EXECUTIVE_COLUMNS)
    .order('full_name', { ascending: true })
    .range(0, 9999)
  if (onlyId) query = query.eq('id', onlyId)

  const { data, error } = await query
  if (error) throw error
  const executives = (data || []) as ExecutiveSelectRow[]
  if (executives.length === 0) return []

  const executiveIds = executives.map(executive => executive.id)

  // Líneas por ejecutiva
  const { data: lineData, error: linesError } = await supabaseAdmin
    .from('executive_lines')
    .select('executive_id, line_id')
    .in('executive_id', executiveIds)
    .range(0, 9999)
  if (linesError) throw linesError

  const linesByExecutive = new Map<string, string[]>()
  for (const row of (lineData || []) as ExecutiveLineRow[]) {
    const list = linesByExecutive.get(row.executive_id) || []
    list.push(row.line_id)
    linesByExecutive.set(row.executive_id, list)
  }

  // Nombre de la zona base (kams.name)
  const kamIds = Array.from(
    new Set(executives.map(executive => executive.base_kam_id).filter((id): id is string => Boolean(id)))
  )
  const kamNames = new Map<string, string>()
  if (kamIds.length > 0) {
    const { data: kamData, error: kamsError } = await supabaseAdmin.from('kams').select('id, name').in('id', kamIds)
    if (kamsError) throw kamsError
    for (const kam of (kamData || []) as Array<{ id: string; name: string | null }>) {
      if (kam.name) kamNames.set(kam.id, kam.name)
    }
  }

  return executives.map(executive => ({
    id: executive.id,
    full_name: executive.full_name,
    email: executive.email,
    company: executive.company,
    status: executive.status,
    base_kam_id: executive.base_kam_id,
    base_kam_name: executive.base_kam_id ? kamNames.get(executive.base_kam_id) ?? null : null,
    user_id: executive.user_id,
    odoo_employee_id: executive.odoo_employee_id,
    lines: linesByExecutive.get(executive.id) || [],
    notes: executive.notes,
  }))
}

/** true si existe la zona (fila de kams). */
export async function kamExists(kamId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin.from('kams').select('id').eq('id', kamId).limit(1)
  if (error) throw error
  return Boolean(data && data.length > 0)
}

/** true si todas las líneas indicadas existen en business_lines. */
export async function allLinesExist(lineIds: string[]): Promise<boolean> {
  if (lineIds.length === 0) return true
  const { data, error } = await supabaseAdmin.from('business_lines').select('id').in('id', lineIds)
  if (error) throw error
  return (data || []).length === lineIds.length
}

/**
 * Busca el usuario de OpMap con ese email (sin distinguir mayúsculas) para enlazarlo con la ejecutiva.
 * Devuelve null si no hay email, si no existe el usuario o si ese usuario ya está enlazado
 * con otra ejecutiva (executives.user_id es único).
 */
export async function resolveUserIdByEmail(email: string | null, excludeExecutiveId?: string): Promise<string | null> {
  if (!email) return null

  // Escapar comodines de ILIKE para que la comparación sea exacta
  const pattern = email.replace(/[\\%_]/g, char => `\\${char}`)
  const { data: users, error: usersError } = await supabaseAdmin
    .from('users')
    .select('id')
    .ilike('email', pattern)
    .limit(1)
  if (usersError) throw usersError
  const userId = users && users.length > 0 ? (users[0].id as string) : null
  if (!userId) return null

  let linkedQuery = supabaseAdmin.from('executives').select('id').eq('user_id', userId).limit(1)
  if (excludeExecutiveId) linkedQuery = linkedQuery.neq('id', excludeExecutiveId)
  const { data: linked, error: linkedError } = await linkedQuery
  if (linkedError) throw linkedError
  return linked && linked.length > 0 ? null : userId
}

/**
 * Reemplaza las líneas de una ejecutiva. Primero inserta las nuevas (upsert) y después borra
 * las que sobran, para no dejarla sin líneas a mitad de la operación.
 * Devuelve false si alguna escritura no se confirmó (el handler responde 500).
 */
export async function replaceExecutiveLines(executiveId: string, lineIds: string[]): Promise<boolean> {
  if (lineIds.length > 0) {
    const rows: ExecutiveLineRow[] = lineIds.map(lineId => ({ executive_id: executiveId, line_id: lineId }))
    const { data, error } = await supabaseAdmin
      .from('executive_lines')
      .upsert(rows, { onConflict: 'executive_id,line_id' })
      .select('line_id')
    if (error) {
      console.error('Error guardando líneas de la ejecutiva:', error)
      return false
    }
    if (!data || data.length !== rows.length) {
      console.error('Upsert de executive_lines incompleto', { esperadas: rows.length, guardadas: data?.length ?? 0 })
      return false
    }
  }

  // Los ids van validados como UUID por zod: es seguro interpolarlos en el filtro
  let deleteQuery = supabaseAdmin.from('executive_lines').delete().eq('executive_id', executiveId)
  if (lineIds.length > 0) {
    deleteQuery = deleteQuery.not('line_id', 'in', `(${lineIds.join(',')})`)
  }
  const { error: deleteError } = await deleteQuery.select('line_id')
  if (deleteError) {
    console.error('Error quitando líneas de la ejecutiva:', deleteError)
    return false
  }
  return true
}

/** Fecha de hoy (YYYY-MM-DD) en hora de Colombia, para left_at. */
export function todayInBogota(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

/** Error de unicidad (23505) traducido a un mensaje para la UI. */
export function uniqueViolationMessage(details: string | null | undefined): string {
  const text = details || ''
  if (text.includes('email')) return 'Ya existe una ejecutiva con ese email'
  if (text.includes('user_id')) return 'Ese usuario ya está enlazado con otra ejecutiva'
  return 'Ya existe una ejecutiva con esos datos'
}
