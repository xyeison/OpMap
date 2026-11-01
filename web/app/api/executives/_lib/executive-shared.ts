// Utilidades de servidor para /api/executives/** (carpeta "_lib": Next.js no la expone como ruta).
// Desde el 2026-10-23 también las "líneas permitidas" (executive_allowed_lines, migración 0860): la restricción con
// la que la dirección evita que una líder, desde Zonas, dé su línea a quien no debe. Sin filas = sin restricción.
import { supabaseAdmin } from '@/lib/supabase-admin'
import { recomputeAndSaveCoverage } from '@/lib/coverage'
import type { Executive, ExecutiveAllowedLineRow, ExecutiveLineRow, ExecutiveRow } from '@/lib/types/lines'
import type { EmpresaMovil } from '@/lib/reporte-visitas'

const EXECUTIVE_COLUMNS =
  'id, full_name, email, status, base_kam_id, user_id, odoo_employee_id, notes, color'

type ExecutiveSelectRow = Pick<
  ExecutiveRow,
  'id' | 'full_name' | 'email' | 'status' | 'base_kam_id' | 'user_id' | 'odoo_employee_id' | 'notes' | 'color'
>

/**
 * Carga las ejecutivas (todas, incluidas las inactivas) con el nombre de su zona base, sus líneas, sus líneas
 * permitidas y sus empresas. Funciona aunque executive_lines esté vacía: cada ejecutiva sale con lines = []. Si la tabla
 * executive_allowed_lines no existe todavía (migración 0860 sin aplicar), todas salen con lineas_permitidas = null; sin
 * la 0960 (executive_empresas), todas con empresas = [].
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

  // Líneas permitidas por ejecutiva (null si la tabla no existe: la API no falla por una migración sin aplicar)
  const allowedByExecutive = await loadAllowedLines(executiveIds)
  const empresasByExecutive = await loadEmpresasDeEjecutivas(executiveIds)

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
    empresas: empresasByExecutive.get(executive.id) ?? [],
    status: executive.status,
    base_kam_id: executive.base_kam_id,
    base_kam_name: executive.base_kam_id ? kamNames.get(executive.base_kam_id) ?? null : null,
    user_id: executive.user_id,
    odoo_employee_id: executive.odoo_employee_id,
    lines: linesByExecutive.get(executive.id) || [],
    notes: executive.notes,
    color: executive.color ?? null,
    lineas_permitidas: allowedByExecutive?.get(executive.id) ?? null,
  }))
}

/**
 * Empresas activas de cada persona (executive_empresas activas), por código. Sin la 0960 (tabla inexistente), un mapa
 * vacío: todas salen con empresas = [] y no se consulta nada más.
 */
async function loadEmpresasDeEjecutivas(executiveIds: string[]): Promise<Map<string, EmpresaMovil[]>> {
  const porEjecutiva = new Map<string, EmpresaMovil[]>()
  const { data, error } = await supabaseAdmin
    .from('executive_empresas')
    .select('executive_id, empresa_id')
    .in('executive_id', executiveIds)
    .eq('activo', true)
    .range(0, 9999)
  if (error) {
    if (esTablaAusente(error)) return porEjecutiva
    throw error
  }
  const filas = (data || []) as Array<{ executive_id: string; empresa_id: string }>
  if (filas.length === 0) return porEjecutiva
  const { data: empresas, error: empresasError } = await supabaseAdmin
    .from('empresas')
    .select('id, codigo, nombre_corto')
    .in('id', Array.from(new Set(filas.map(f => f.empresa_id))))
    .eq('activa', true)
    .order('codigo')
  if (empresasError) throw empresasError
  // empresas ya viene por código: cada persona recibe las suyas en ese orden (solo las activas)
  const lista = (empresas || []) as EmpresaMovil[]
  const idsPorEjecutiva = new Map<string, Set<string>>()
  for (const { executive_id, empresa_id } of filas) {
    idsPorEjecutiva.set(executive_id, (idsPorEjecutiva.get(executive_id) ?? new Set<string>()).add(empresa_id))
  }
  for (const [executiveId, ids] of Array.from(idsPorEjecutiva.entries())) {
    porEjecutiva.set(
      executiveId,
      lista.filter(e => ids.has(e.id)).map(e => ({ id: e.id, codigo: e.codigo, nombre_corto: e.nombre_corto }))
    )
  }
  return porEjecutiva
}

// ---------------------------------------------------------------------------
// Líneas permitidas (executive_allowed_lines, migración 0860; decisión del dueño 2026-10-23)
// ---------------------------------------------------------------------------

/** 400 cuando las líneas asignadas no caben en la restricción de la dirección. */
export const MENSAJE_LINEAS_FUERA_DE_PERMITIDAS = 'Las líneas asignadas deben estar entre las permitidas'

/** Cuando se intenta fijar una restricción y la tabla de la 0860 no existe todavía. */
export const MENSAJE_SIN_TABLA_PERMITIDAS =
  'Las líneas permitidas aún no están disponibles (falta aplicar la migración 0860)'

/** true si PostgREST dice que la tabla no existe (migración sin aplicar): PGRST205 o 42P01. */
export function esTablaAusente(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false
  return error.code === 'PGRST205' || error.code === '42P01' || /schema cache|does not exist/i.test(error.message || '')
}

/**
 * Líneas permitidas de varias ejecutivas (ids de business_lines por executive_id). Devuelve null si la tabla
 * executive_allowed_lines no existe (migración 0860 sin aplicar), para que la API responda lineas_permitidas = null
 * sin fallar. Una ejecutiva sin filas no aparece en el mapa (= sin restricción).
 */
export async function loadAllowedLines(executiveIds: string[]): Promise<Map<string, string[]> | null> {
  const byExecutive = new Map<string, string[]>()
  if (executiveIds.length === 0) return byExecutive
  const { data, error } = await supabaseAdmin
    .from('executive_allowed_lines')
    .select('executive_id, line_id')
    .in('executive_id', executiveIds)
    .range(0, 9999)
  if (error) {
    if (esTablaAusente(error)) return null
    throw error
  }
  for (const row of (data || []) as Array<Pick<ExecutiveAllowedLineRow, 'executive_id' | 'line_id'>>) {
    const list = byExecutive.get(row.executive_id) || []
    list.push(row.line_id)
    byExecutive.set(row.executive_id, list)
  }
  return byExecutive
}

/** Restricción vigente de una ejecutiva: ids permitidos, o null si no tiene (o la tabla no existe). */
export async function allowedLinesOf(executiveId: string): Promise<string[] | null> {
  const byExecutive = await loadAllowedLines([executiveId])
  const lines = byExecutive?.get(executiveId)
  return lines && lines.length > 0 ? lines : null
}

/** true si la tabla executive_allowed_lines existe (para rechazar una restricción antes de escribir nada). */
export async function allowedLinesAvailable(): Promise<boolean> {
  const { error } = await supabaseAdmin.from('executive_allowed_lines').select('line_id').limit(1)
  if (!error) return true
  if (esTablaAusente(error)) return false
  throw error
}

/** Las líneas que se salen de la restricción (vacío si no hay restricción o si todas caben). */
export function lineasFueraDePermitidas(lines: string[], permitidas: string[] | null | undefined): string[] {
  if (!permitidas || permitidas.length === 0) return []
  const allowed = new Set(permitidas)
  return lines.filter(id => !allowed.has(id))
}

/**
 * Deja la restricción de una ejecutiva exactamente en `lineIds`: null o [] la quita (borra todas sus filas); con
 * valores inserta las que faltan (con created_by = quien lo pide, sin pisar el created_by de las que ya estaban) y
 * borra las que sobran, primero insertar y después borrar como replaceExecutiveLines.
 * Devuelve 'sin_tabla' si executive_allowed_lines no existe y había algo que fijar (quitar una restricción que no
 * puede existir es 'ok'); 'error' si alguna escritura no se confirmó (la ruta responde 500).
 */
export async function replaceAllowedLines(
  executiveId: string,
  lineIds: string[] | null,
  userId: string | null
): Promise<'ok' | 'sin_tabla' | 'error'> {
  const deseadas = Array.from(new Set(lineIds ?? []))
  const { data: actualData, error: actualError } = await supabaseAdmin
    .from('executive_allowed_lines')
    .select('line_id')
    .eq('executive_id', executiveId)
    .range(0, 9999)
  if (actualError) {
    if (esTablaAusente(actualError)) return deseadas.length === 0 ? 'ok' : 'sin_tabla'
    console.error('Error leyendo las líneas permitidas de la ejecutiva:', actualError)
    return 'error'
  }
  const actuales = new Set(((actualData || []) as Array<{ line_id: string }>).map(row => row.line_id))
  const nuevas = deseadas.filter(id => !actuales.has(id))
  const sobrantes = Array.from(actuales).filter(id => !deseadas.includes(id))

  if (nuevas.length > 0) {
    const rows = nuevas.map(lineId => ({ executive_id: executiveId, line_id: lineId, created_by: userId }))
    const { data, error } = await supabaseAdmin.from('executive_allowed_lines').insert(rows).select('line_id')
    if (error) {
      console.error('Error guardando las líneas permitidas de la ejecutiva:', error)
      return 'error'
    }
    if (!data || data.length !== rows.length) {
      console.error('Insert de executive_allowed_lines incompleto', { esperadas: rows.length, guardadas: data?.length ?? 0 })
      return 'error'
    }
  }
  if (sobrantes.length > 0) {
    // Los ids vienen de la propia tabla (uuid): es seguro pasarlos al filtro
    const { error } = await supabaseAdmin
      .from('executive_allowed_lines')
      .delete()
      .eq('executive_id', executiveId)
      .in('line_id', sobrantes)
      .select('line_id')
    if (error) {
      console.error('Error quitando líneas permitidas de la ejecutiva:', error)
      return 'error'
    }
  }
  return 'ok'
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
 * Enlaza el usuario recién creado o editado con la Ejecutiva Comercial que tiene su mismo email (sin distinguir
 * mayúsculas), solo si esa ejecutiva no tiene usuario y no está inactiva, y si el usuario no está enlazado ya con
 * otra. Es el camino inverso de resolveUserIdByEmail (que enlaza al crear o editar la ejecutiva): así no importa
 * qué se crea primero. Devuelve el nombre de la ejecutiva enlazada o null. Nunca desenlaza a nadie.
 */
export async function linkExecutiveToUserByEmail(userId: string, email: string | null | undefined): Promise<string | null> {
  if (!email) return null
  const { data: already, error: alreadyError } = await supabaseAdmin
    .from('executives').select('id').eq('user_id', userId).limit(1)
  if (alreadyError) throw alreadyError
  if (already && already.length > 0) return null

  const pattern = email.replace(/[\\%_]/g, char => `\\${char}`)
  const { data: candidates, error: candError } = await supabaseAdmin
    .from('executives')
    .select('id, full_name')
    .ilike('email', pattern)
    .is('user_id', null)
    .neq('status', 'inactive')
    .limit(2)
  if (candError) throw candError
  // Si dos ejecutivas comparten email no se adivina: hay que corregir el email de una en /executives y
  // guardarla (el PUT vuelve a intentar el enlace).
  if (!candidates || candidates.length !== 1) return null

  const { data: updated, error: updateError } = await supabaseAdmin
    .from('executives')
    .update({ user_id: userId })
    .eq('id', candidates[0].id)
    .is('user_id', null)
    .select('full_name')
  if (updateError) throw updateError
  return updated && updated.length === 1 ? String(updated[0].full_name) : null
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

/** Aviso cuando el cambio quedó guardado pero el recálculo de la cobertura falló. */
export const AVISO_COBERTURA_SIN_RECALCULAR =
  'Se guardó, pero no se pudo recalcular la cobertura. Usa "Recalcular cobertura" en la cobertura de la línea.'

/**
 * Recalcula la cobertura de TODAS las líneas y zonas (global, idempotente, sin Google Maps: solo distancias ya
 * guardadas) después de un cambio que la decide: el estado o las líneas de un Ejecutivo Comercial, o un traspaso.
 * "Si alguien se va o se le quita una línea, ya no está" (docs/decisiones/2026-10-12-traspaso-de-ejecutivas.md;
 * spec docs/specs/2026-10-12-traspaso-ejecutivo-comercial.md, decisión 12). Nunca lanza: el cambio ya quedó
 * guardado, así que devuelve false si falló y la ruta lo avisa.
 */
export async function recalcularCobertura(contexto: string): Promise<boolean> {
  try {
    await recomputeAndSaveCoverage()
    return true
  } catch (error) {
    console.error(`${contexto}: el cambio se guardó, pero falló el recálculo de la cobertura:`, error)
    return false
  }
}
