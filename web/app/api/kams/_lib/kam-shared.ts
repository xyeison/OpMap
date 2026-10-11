// Utilidades compartidas por las rutas de KAMs, zonas y territorios (solo servidor).
// La carpeta empieza por "_" para que Next.js no la exponga como ruta.
import { NextResponse } from 'next/server'
import { zoneDisplayName } from '@/lib/zone-names'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { SimplifiedOpMapAlgorithm } from '@/lib/opmap-algorithm-simplified'

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/

// Código DANE de Bogotá D.C. Un KAM de Bogotá debe tener una localidad (7 dígitos), nunca el municipio entero.
export const BOGOTA_MUNICIPALITY_CODE = '11001'
export const BOGOTA_AREA_MESSAGE = 'Para Bogotá elige una localidad'

export const uuidSchema = z.string().regex(UUID_RE, 'ID no válido')
export const colorSchema = z.string().regex(HEX_COLOR_RE, 'El color debe tener el formato #RRGGBB')

// Municipio (5 dígitos) o localidad de Bogotá (11001 + 2 dígitos)
export const areaIdSchema = z
  .string()
  .trim()
  .regex(/^(\d{5}|11001\d{2})$/, 'Código de área no válido: usa un municipio (5 dígitos) o una localidad de Bogotá (7 dígitos)')

export function jsonError(message: string, status: number, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ success: false, error: message, ...extra }, { status })
}

/** Lee el cuerpo JSON sin lanzar: devuelve null si no es JSON válido. */
export async function readJson(request: Request): Promise<unknown | null> {
  try {
    return await request.json()
  } catch {
    return null
  }
}

/** Primer mensaje de error de zod, para mostrarlo tal cual en la UI. */
export function zodMessage(error: z.ZodError): string {
  return error.issues[0]?.message || 'Datos no válidos'
}

/**
 * Valida que el área exista y no sea Bogotá entera.
 * Devuelve un NextResponse de error o null si el área es válida.
 */
export async function validateAreaId(areaId: string): Promise<NextResponse | null> {
  if (areaId === BOGOTA_MUNICIPALITY_CODE) {
    return jsonError(BOGOTA_AREA_MESSAGE, 400)
  }

  if (areaId.length === 7) {
    const { data, error } = await supabaseAdmin
      .from('hospitals')
      .select('id')
      .eq('municipality_id', BOGOTA_MUNICIPALITY_CODE)
      .eq('locality_id', areaId)
      .limit(1)
    if (error) throw error
    if (!data || data.length === 0) {
      return jsonError('La localidad seleccionada no existe', 400)
    }
    return null
  }

  const { data, error } = await supabaseAdmin
    .from('municipalities')
    .select('code')
    .eq('code', areaId)
    .limit(1)
  if (error) throw error
  if (!data || data.length === 0) {
    return jsonError('El municipio seleccionado no existe', 400)
  }
  return null
}

/**
 * Busca otro KAM activo que participe en la asignación con el mismo area_id (R2-M-01).
 * Devuelve el nombre del KAM en conflicto o null.
 */
export async function findAreaConflict(areaId: string, excludeKamId?: string): Promise<string | null> {
  let query = supabaseAdmin
    .from('kams')
    .select('id, name')
    .eq('area_id', areaId)
    .eq('active', true)
    .eq('participates_in_assignment', true)
    .limit(1)

  if (excludeKamId) {
    query = query.neq('id', excludeKamId)
  }

  const { data, error } = await query
  if (error) throw error
  return data && data.length > 0 ? (data[0].name as string) : null
}

export function areaConflictResponse(kamName: string) {
  return jsonError(
    `Ya existe una zona activa que participa en la asignación con esa área (${zoneDisplayName(kamName)}). Desactívala o elige otra área.`,
    409
  )
}

/** Ejecuta el algoritmo completo en el mismo proceso y guarda las asignaciones. Devuelve cuántas guardó. */
export async function runFullRecalculation(): Promise<number> {
  const algorithm = new SimplifiedOpMapAlgorithm()
  await algorithm.loadData()
  const assignments = await algorithm.calculateAssignments()
  await algorithm.saveAssignments(assignments)
  return assignments.length
}

type PageResult<T> = { data: T[] | null; error: { message: string } | null }

/**
 * Lee todas las filas de una consulta paginando de 1000 en 1000 (límite de PostgREST).
 * La consulta debe tener un orden estable (p. ej. .order('id')).
 */
export async function fetchAllRows<T>(
  build: (from: number, to: number) => PromiseLike<PageResult<T>>,
  pageSize = 1000
): Promise<T[]> {
  const rows: T[] = []
  for (let page = 0; page < 1000; page++) {
    const from = page * pageSize
    const { data, error } = await build(from, from + pageSize - 1)
    if (error) throw new Error(error.message)
    const chunk = data || []
    rows.push(...chunk)
    if (chunk.length < pageSize) break
  }
  return rows
}
