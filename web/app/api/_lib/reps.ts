// Fase 3 · Acceso a reps_sedes y evaluación en vivo del cruce IPS ↔ sede del REPS (solo servidor).
// Las reglas viven en lib/reps-match.ts (puras); aquí solo se leen los datos y se arma la respuesta.
import { supabaseAdmin } from '@/lib/supabase-admin'
import {
  groupSedesByNit,
  matchHospitalsToReps,
  nitFromCode,
  type HospitalLite,
  type RepsMatchResult,
  type RepsSedeLite,
} from '@/lib/reps-match'
import { fetchAllRows } from './api-error'

/** Columnas de una sede que se muestran en la ficha (sin correos ni teléfonos del prestador). */
export const REPS_SEDE_PUBLIC_SELECT =
  'codigo_habilitacion, codigo_prestador, nombre_prestador, nombre_sede, nit, naturaleza, ese, ' +
  'municipio_sede, municipio_sede_nombre, departamento_sede, direccion_sede, telefono_sede, email_sede, ' +
  'clase_prestador, fecha_corte'

export interface RepsSedePublic extends RepsSedeLite {
  codigo_prestador: string
  nombre_prestador: string
  naturaleza: string | null
  ese: boolean
  municipio_sede_nombre: string | null
  departamento_sede: string | null
  direccion_sede: string | null
  telefono_sede: string | null
  email_sede: string | null
  clase_prestador: string
  fecha_corte: string | null
}

export const HOSPITAL_REPS_SELECT =
  'id, name, code, nit, municipality_id, municipality_name, locality_name, active, reps_code, reps_match_status, reps_matched_at'

export interface HospitalRepsRow {
  id: string
  name: string
  code: string | null
  nit: string | null
  municipality_id: string | null
  municipality_name: string | null
  locality_name: string | null
  active: boolean | null
  reps_code: string | null
  reps_match_status: string | null
  reps_matched_at: string | null
}

/** Sede principal del prestador: código de prestador + "01". */
export function isPrincipalSede(sede: Pick<RepsSedePublic, 'codigo_habilitacion' | 'codigo_prestador'>): boolean {
  return sede.codigo_habilitacion === `${sede.codigo_prestador}01`
}

export async function loadSede(code: string): Promise<RepsSedePublic | null> {
  const { data, error } = await supabaseAdmin
    .from('reps_sedes')
    .select(REPS_SEDE_PUBLIC_SELECT)
    .eq('codigo_habilitacion', code)
    .maybeSingle()
  if (error) throw error
  return (data as RepsSedePublic | null) ?? null
}

export async function loadSedesByNits(nits: string[]): Promise<RepsSedePublic[]> {
  const unique = Array.from(new Set(nits.filter(Boolean)))
  const rows: RepsSedePublic[] = []
  for (let from = 0; from < unique.length; from += 100) {
    const chunk = unique.slice(from, from + 100)
    const { data, error } = await fetchAllRows<RepsSedePublic>((start, end) =>
      supabaseAdmin
        .from('reps_sedes')
        .select(REPS_SEDE_PUBLIC_SELECT)
        .in('nit', chunk)
        .order('codigo_habilitacion')
        .range(start, end) as unknown as PromiseLike<{ data: RepsSedePublic[] | null; error: unknown }>
    )
    if (error) throw error
    rows.push(...data)
  }
  return rows
}

/** IPS que ya tienen vinculada alguna de estas sedes (codigo → {id, name}). */
export async function loadLinkedHospitals(codes: string[]): Promise<Map<string, { id: string; name: string }>> {
  const unique = Array.from(new Set(codes.filter(Boolean)))
  const linked = new Map<string, { id: string; name: string }>()
  for (let from = 0; from < unique.length; from += 200) {
    const chunk = unique.slice(from, from + 200)
    const { data, error } = await supabaseAdmin.from('hospitals').select('id, name, reps_code').in('reps_code', chunk)
    if (error) throw error
    for (const row of data ?? []) {
      if (row.reps_code) linked.set(row.reps_code as string, { id: row.id as string, name: row.name as string })
    }
  }
  return linked
}

export interface LiveEvaluation {
  sedes: RepsSedePublic[]
  linked: Map<string, { id: string; name: string }>
  results: Map<string, RepsMatchResult>
}

/**
 * Evalúa en vivo, con las reglas de lib/reps-match.ts, un grupo de IPS contra las sedes de sus NIT.
 * Tiene en cuenta las sedes ya vinculadas a otras IPS (no se ofrecen). No escribe nada.
 */
export async function evaluateHospitals(hospitals: HospitalRepsRow[]): Promise<LiveEvaluation> {
  const nits = hospitals.map(hospital => hospital.nit ?? nitFromCode(hospital.code)).filter((nit): nit is string => Boolean(nit))
  const sedes = await loadSedesByNits(nits)
  const linked = await loadLinkedHospitals(sedes.map(sede => sede.codigo_habilitacion))

  // IPS de fuera del grupo que tienen vinculada alguna de esas sedes: entran como "ya vinculadas"
  const inGroup = new Set(hospitals.map(hospital => hospital.id))
  const lite: HospitalLite[] = hospitals.map(hospital => ({
    id: hospital.id,
    code: hospital.code,
    name: hospital.name,
    municipality_id: hospital.municipality_id,
    reps_code: hospital.reps_code,
  }))
  for (const [code, other] of Array.from(linked.entries())) {
    if (!inGroup.has(other.id)) {
      lite.push({ id: other.id, code: null, name: other.name, municipality_id: null, reps_code: code })
    }
  }

  const matched = matchHospitalsToReps(lite, groupSedesByNit(sedes))
  const results = new Map<string, RepsMatchResult>()
  for (const result of matched) {
    if (inGroup.has(result.hospital_id)) results.set(result.hospital_id, result)
  }
  return { sedes, linked, results }
}

export async function latestRepsCut(): Promise<{ fecha_corte: string | null; total: number }> {
  const [cutRes, countRes] = await Promise.all([
    supabaseAdmin.from('reps_sedes').select('fecha_corte').order('fecha_corte', { ascending: false, nullsFirst: false }).limit(1),
    supabaseAdmin.from('reps_sedes').select('codigo_habilitacion', { count: 'exact', head: true }),
  ])
  if (cutRes.error) throw cutRes.error
  if (countRes.error) throw countRes.error
  return { fecha_corte: (cutRes.data?.[0]?.fecha_corte as string | null) ?? null, total: countRes.count ?? 0 }
}

export type RepsLinkFields = {
  reps_code: string | null
  reps_match_status: 'matched' | 'ambiguous' | 'unmatched'
  reps_matched_at: string | null
}

export type RepsLinkResolution =
  | { ok: true; fields: RepsLinkFields; sede: RepsSedePublic | null; warnings: string[] }
  | { ok: false; status: number; error: string }

/**
 * Campos a escribir en hospitals al vincular (repsCode) o desvincular (null) una IPS de una sede del REPS.
 * Vincular exige que la sede exista en reps_sedes y que no esté vinculada a otra IPS (409). Avisa, sin
 * bloquear, si el NIT o el municipio de la sede no coinciden con los de la IPS. Desvincular deja la IPS
 * en 'ambiguous' si su NIT tiene sedes en el REPS y en 'unmatched' si no. No escribe nada.
 */
export async function resolveRepsLink(input: {
  repsCode: string | null
  hospitalId: string | null
  nit: string | null
  municipalityId: string | null
}): Promise<RepsLinkResolution> {
  if (input.repsCode === null) {
    let sedesForNit = 0
    if (input.nit) {
      const { count, error } = await supabaseAdmin
        .from('reps_sedes')
        .select('codigo_habilitacion', { count: 'exact', head: true })
        .eq('nit', input.nit)
      if (error) throw error
      sedesForNit = count ?? 0
    }
    return {
      ok: true,
      fields: { reps_code: null, reps_match_status: sedesForNit > 0 ? 'ambiguous' : 'unmatched', reps_matched_at: null },
      sede: null,
      warnings: [],
    }
  }

  const sede = await loadSede(input.repsCode)
  if (!sede) {
    return { ok: false, status: 400, error: `La sede ${input.repsCode} no está en el REPS cargado` }
  }
  const linked = (await loadLinkedHospitals([input.repsCode])).get(input.repsCode)
  if (linked && linked.id !== input.hospitalId) {
    return { ok: false, status: 409, error: `La sede ${input.repsCode} ya está vinculada a "${linked.name}"` }
  }

  const warnings: string[] = []
  if (input.nit && sede.nit !== input.nit) {
    warnings.push(`El NIT de la sede (${sede.nit}) no coincide con el de la IPS (${input.nit})`)
  }
  if (input.municipalityId && sede.municipio_sede !== input.municipalityId) {
    warnings.push(
      `La sede está en otro municipio (${sede.municipio_sede_nombre ?? sede.municipio_sede}); revisar el municipio de la IPS`
    )
  }
  return {
    ok: true,
    fields: { reps_code: input.repsCode, reps_match_status: 'matched', reps_matched_at: new Date().toISOString() },
    sede,
    warnings,
  }
}

/** ¿El error 23505 de PostgREST viene del UNIQUE de hospitals.reps_code? */
export function isRepsCodeConflict(error: unknown): boolean {
  const candidate = error as { code?: string; message?: string; details?: string } | null
  return (
    candidate?.code === '23505' &&
    `${candidate.message ?? ''} ${candidate.details ?? ''}`.includes('hospitals_reps_code_key')
  )
}

// -------------------------------------------------------------------------------------------------
// Cambio de sede: datos importados del REPS (servicios y capacidad) y auditoría
// -------------------------------------------------------------------------------------------------

export interface RepsDataSyncResult {
  /** Filas de hospital_services / hospital_capacity que dejaron de apuntar a la IPS (sede anterior). */
  detachedServices: number
  detachedCapacity: number
  /** Filas ya importadas de la sede nueva que ahora apuntan a la IPS. */
  attachedServices: number
  attachedCapacity: number
  /** Columnas resumen recalculadas en hospitals. */
  summary: {
    service_flags: Record<string, boolean>
    reps_services_count: number | null
    quirofanos: number | null
    reps_beds: number | null
    reps_updated_at: string | null
  }
}

/**
 * Tras vincular (repsCode) o desvincular (null) una IPS, deja sus datos del REPS coherentes con la sede:
 *   1. hospital_services y hospital_capacity de otras sedes que apuntaban a la IPS → hospital_id NULL
 *      (las filas se conservan: son de la sede, no de la IPS).
 *   2. Las filas ya importadas de la sede nueva → hospital_id = la IPS.
 *   3. Recalcula en hospitals service_flags, reps_services_count, quirofanos, reps_beds y
 *      reps_updated_at a partir de lo que quede enlazado (sin filas → sin dato: {} / NULL).
 * Mismas reglas que el importador (lib/reps-import.ts). No es atómico (PostgREST): si falla a medias,
 * el llamador avisa de que hay que volver a importar.
 */
export async function syncRepsDataForHospital(hospitalId: string, repsCode: string | null): Promise<RepsDataSyncResult> {
  const { computeServiceFlags, computeCapacityTotals } = await import('@/lib/reps-import')

  const detach = async (table: 'hospital_services' | 'hospital_capacity') => {
    let query = supabaseAdmin.from(table).update({ hospital_id: null }).eq('hospital_id', hospitalId)
    if (repsCode) query = query.neq('reps_code', repsCode)
    const { data, error } = await query.select('id')
    if (error) throw error
    return data?.length ?? 0
  }
  const attach = async (table: 'hospital_services' | 'hospital_capacity') => {
    if (!repsCode) return 0
    const { data, error } = await supabaseAdmin
      .from(table)
      .update({ hospital_id: hospitalId })
      .eq('reps_code', repsCode)
      .or(`hospital_id.is.null,hospital_id.neq.${hospitalId}`)
      .select('id')
    if (error) throw error
    return data?.length ?? 0
  }

  const detachedServices = await detach('hospital_services')
  const detachedCapacity = await detach('hospital_capacity')
  const attachedServices = await attach('hospital_services')
  const attachedCapacity = await attach('hospital_capacity')

  const services = await fetchAllRows<{ service_code: string; service_name: string | null; imported_at: string | null }>(
    (from, to) =>
      supabaseAdmin
        .from('hospital_services')
        .select('service_code, service_name, imported_at')
        .eq('hospital_id', hospitalId)
        .order('id')
        .range(from, to)
  )
  if (services.error) throw services.error
  const capacity = await fetchAllRows<{ group_name: string; concept: string; quantity: number; imported_at: string | null }>(
    (from, to) =>
      supabaseAdmin
        .from('hospital_capacity')
        .select('group_name, concept, quantity, imported_at')
        .eq('hospital_id', hospitalId)
        .order('id')
        .range(from, to)
  )
  if (capacity.error) throw capacity.error

  const capacityRows = capacity.data.map(row => ({ group: row.group_name, concept: row.concept, quantity: row.quantity }))
  const totals = computeCapacityTotals(capacityRows)
  const importedAt = [...services.data, ...capacity.data]
    .map(row => row.imported_at)
    .filter((value): value is string => Boolean(value))
    .sort()
    .pop() ?? null

  const summary: RepsDataSyncResult['summary'] = {
    service_flags:
      services.data.length > 0
        ? computeServiceFlags(services.data.map(row => ({ code: row.service_code, name: row.service_name })))
        : {},
    reps_services_count: services.data.length > 0 ? new Set(services.data.map(row => row.service_code)).size : null,
    quirofanos: capacityRows.some(row => row.group === 'salas') ? totals.quirofanos : null,
    reps_beds: capacityRows.some(row => row.group === 'camas') ? totals.beds : null,
    reps_updated_at: importedAt,
  }
  const { error } = await supabaseAdmin.from('hospitals').update(summary).eq('id', hospitalId)
  if (error) throw error

  return { detachedServices, detachedCapacity, attachedServices, attachedCapacity, summary }
}

/** Texto para la respuesta y la UI cuando el cambio de sede movió datos del REPS. */
export function describeRepsDataSync(result: RepsDataSyncResult): string | null {
  const detached = result.detachedServices + result.detachedCapacity
  const attached = result.attachedServices + result.attachedCapacity
  if (detached === 0 && attached === 0) return null
  const parts: string[] = []
  if (detached > 0) parts.push(`se quitaron de la IPS los servicios y la capacidad de la sede anterior (${detached} filas)`)
  if (attached > 0) parts.push(`se enlazaron ${attached} filas ya importadas de la sede nueva`)
  return `Datos del REPS actualizados: ${parts.join('; ')}.`
}

/**
 * Cambia el vínculo REPS de una IPS (después de escribir hospitals) y deja todo coherente: datos del
 * REPS de la sede (syncRepsDataForHospital) y una fila en hospital_history (action 'edited',
 * changes.reps_link) que usa scripts/reps-match.ts para respetar las desvinculaciones manuales.
 * Devuelve avisos para la respuesta; nunca lanza (el vínculo ya quedó guardado).
 */
export async function afterRepsLinkChange(input: {
  route: string
  hospitalId: string
  userId: string
  active: boolean
  before: { reps_code: string | null; reps_match_status: string | null }
  after: RepsLinkFields
  sedeName?: string | null
}): Promise<string[]> {
  const warnings: string[] = []

  try {
    const note = describeRepsDataSync(await syncRepsDataForHospital(input.hospitalId, input.after.reps_code))
    if (note) warnings.push(note)
  } catch (error) {
    console.error(`${input.route}: no se pudieron actualizar los datos del REPS de la IPS`, error)
    warnings.push(
      'El vínculo se guardó, pero no se pudieron actualizar los servicios y la capacidad del REPS de la IPS: volver a importarlos desde /hospitals/import'
    )
  }

  const reason =
    input.after.reps_code === null
      ? `Desvinculada de la sede REPS ${input.before.reps_code ?? ''}`.trim()
      : `Vinculada a la sede REPS ${input.after.reps_code}${input.sedeName ? ` (${input.sedeName})` : ''}`
  const { error: historyError } = await supabaseAdmin.from('hospital_history').insert({
    hospital_id: input.hospitalId,
    user_id: input.userId,
    created_by: input.userId,
    action: 'edited',
    reason,
    previous_state: input.active,
    new_state: input.active,
    changes: {
      reps_link: {
        before: input.before,
        after: { reps_code: input.after.reps_code, reps_match_status: input.after.reps_match_status },
      },
    },
  })
  if (historyError) {
    console.error(`${input.route}: no se pudo registrar el historial`, historyError)
    warnings.push('El vínculo se guardó, pero no se pudo registrar en la actividad de la IPS')
  }
  return warnings
}
