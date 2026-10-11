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
