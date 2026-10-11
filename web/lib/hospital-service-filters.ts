// Fase 3 · Filtro de IPS por servicios y capacidad del REPS. Una sola regla para la lista
// /hospitals y para el bloque "IPS" de "Filtros y visitas" del mapa.
// Usa las columnas hospitals.service_flags, quirofanos, reps_beds (importadas del REPS) y beds.

import type { ServiceFlags } from './reps-import-fields'

export interface IpsServiceFilter {
  /** Al menos un quirófano según la capacidad instalada del REPS. */
  quirofano: boolean
  /** Ortopedia y/o traumatología (consulta) o cirugía ortopédica habilitada. */
  ortopedia: boolean
  neurocirugia: boolean
  /**
   * Cirugía de columna habilitada; como la Res. 3100 no siempre la trae como servicio propio,
   * también cuenta la neurocirugía (la cirugía de columna la hacen neurocirujanos y ortopedistas).
   */
  columna: boolean
  /** Rango de camas (inclusive). Camas del REPS si se importaron; si no, las de la ficha. */
  minBeds: number | null
  maxBeds: number | null
}

export const EMPTY_IPS_FILTER: IpsServiceFilter = {
  quirofano: false,
  ortopedia: false,
  neurocirugia: false,
  columna: false,
  minBeds: null,
  maxBeds: null,
}

export const IPS_FILTER_LABELS: Record<'quirofano' | 'ortopedia' | 'neurocirugia' | 'columna', string> = {
  quirofano: 'Con quirófano',
  ortopedia: 'Ortopedia',
  neurocirugia: 'Neurocirugía',
  columna: 'Columna',
}

export const IPS_FILTER_HINTS: Record<'quirofano' | 'ortopedia' | 'neurocirugia' | 'columna', string> = {
  quirofano: 'Al menos un quirófano en la capacidad instalada del REPS',
  ortopedia: 'Ortopedia y/o traumatología o cirugía ortopédica habilitada en el REPS',
  neurocirugia: 'Neurocirugía o cirugía neurológica habilitada en el REPS',
  columna: 'Cirugía de columna habilitada o, si no existe como servicio, neurocirugía',
}

export interface HospitalServiceFields {
  service_flags?: ServiceFlags | Record<string, unknown> | null
  quirofanos?: number | null
  reps_beds?: number | null
  beds?: number | null
  reps_updated_at?: string | null
}

function flagsOf(hospital: HospitalServiceFields): Record<string, unknown> {
  const flags = hospital.service_flags
  return flags && typeof flags === 'object' && !Array.isArray(flags) ? (flags as Record<string, unknown>) : {}
}

/** Camas para el filtro: las del REPS si se importaron; si no, las declaradas en la ficha. */
export function hospitalBedsForFilter(hospital: HospitalServiceFields): number | null {
  const reps = hospital.reps_beds
  if (typeof reps === 'number' && Number.isFinite(reps)) return reps
  const beds = hospital.beds
  if (typeof beds === 'number' && Number.isFinite(beds)) return beds
  return null
}

/** true si la IPS ya tiene algún dato importado del REPS (servicios o capacidad). */
export function hasRepsData(hospital: HospitalServiceFields): boolean {
  return (
    Boolean(hospital.reps_updated_at) ||
    typeof hospital.quirofanos === 'number' ||
    typeof hospital.reps_beds === 'number' ||
    Object.keys(flagsOf(hospital)).length > 0
  )
}

export type IpsServiceCheck = 'quirofano' | 'ortopedia' | 'neurocirugia' | 'columna'

/**
 * ¿Qué casillas de servicio tienen sentido hoy? Mientras ninguna IPS tenga datos importados del REPS,
 * marcar una casilla dejaría la lista y el mapa en 0: la UI las desactiva y explica por qué.
 * quirofano depende de la capacidad instalada (quirofanos); el resto, de los servicios (service_flags).
 */
export function ipsServiceAvailability(hospitals: HospitalServiceFields[] | null | undefined): Record<IpsServiceCheck, boolean> & { any: boolean } {
  let services = false
  let quirofano = false
  for (const hospital of hospitals || []) {
    if (!services && Object.keys(flagsOf(hospital)).length > 0) services = true
    if (!quirofano && typeof hospital.quirofanos === 'number') quirofano = true
    if (services && quirofano) break
  }
  return { quirofano, ortopedia: services, neurocirugia: services, columna: services, any: services || quirofano }
}

export const IPS_SERVICE_UNAVAILABLE_HINT =
  'Aún no hay datos del REPS importados: se activa tras la primera importación de servicios habilitados (o de capacidad instalada, para quirófanos).'

export function isIpsFilterActive(filter: IpsServiceFilter): boolean {
  return (
    filter.quirofano ||
    filter.ortopedia ||
    filter.neurocirugia ||
    filter.columna ||
    filter.minBeds !== null ||
    filter.maxBeds !== null
  )
}

/** ¿Cumple la IPS todas las casillas marcadas? (Y lógico). Sin filtro activo, siempre true. */
export function matchesIpsFilter(hospital: HospitalServiceFields | null | undefined, filter: IpsServiceFilter): boolean {
  if (!isIpsFilterActive(filter)) return true
  if (!hospital) return false
  const flags = flagsOf(hospital)
  const has = (key: string) => flags[key] === true

  if (filter.quirofano && !(typeof hospital.quirofanos === 'number' && hospital.quirofanos > 0)) return false
  if (filter.ortopedia && !(has('ortopedia') || has('cirugia_ortopedica'))) return false
  if (filter.neurocirugia && !has('neurocirugia')) return false
  if (filter.columna && !(has('columna') || has('neurocirugia'))) return false

  if (filter.minBeds !== null || filter.maxBeds !== null) {
    const beds = hospitalBedsForFilter(hospital)
    if (beds === null) return false
    if (filter.minBeds !== null && beds < filter.minBeds) return false
    if (filter.maxBeds !== null && beds > filter.maxBeds) return false
  }
  return true
}

/** Convierte el texto de un campo numérico del filtro en número entero ≥ 0 (o null si vacío/ inválido). */
export function parseBedsInput(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed) || parsed < 0) return null
  return Math.floor(parsed)
}
