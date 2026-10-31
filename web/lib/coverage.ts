// Motor de cobertura por línea (Fase 2). SOLO SERVIDOR (usa el cliente service_role).
//
// Para cada línea activa L y zona activa Z decide quién responde, en este orden:
//   1. Ajuste manual activo (coverage_overrides) a X → 'manual', solo si X sigue activa/placeholder,
//      lleva L y ADEMÁS: X vive en Z (resuelve un conflicto entre residentes o confirma a la local)
//      O ninguna residente elegible de Z lleva L. Si Z ya tiene residente(s) con L y X es de otra
//      zona, el ajuste queda sin efecto ("Ajuste manual sin efecto: la zona ya tiene a <nombres> con
//      esta línea") y siguen las reglas 2-3. Lo mismo si X ya no existe, está inactiva o no lleva L.
//      Regla del dueño (2026-10-11): alguien de otra ciudad toma una zona, por distancia (regla 3) o
//      por fuerza (este ajuste), solo si en esa zona no hay nadie con esa línea y si la lleva.
//      La API de ajustes (POST /api/coverage/overrides) valida lo mismo antes de guardar (409).
//   2. Locales: ejecutivas activas/placeholder con base_kam_id = Z que llevan L.
//      1 → 'local' (0 min); más de 1 → 'conflict' (el líder reparte).
//   3. Si no hay locales: la más cercana que lleva L (de ciudad base a ciudad base, matriz zona→zona).
//      ≤ L.max_reach_minutes → 'reach'; si no → 'vacant' con la más cercana en nearest_*.
//   4. has_equipment = line_zones(L, Z).has_equipment (true si no hay fila).
//
// Matriz zona→zona: mediana de hospital_kam_distances.travel_time/60 desde la zona origen hacia
// las IPS activas de la zona destino (municipality_id = area_id de 5 dígitos, o locality_id =
// area_id de 7 dígitos). La diagonal es 0.
//
// computeZoneMatrix() y computeCoverage() son puras (sin E/S). loadCoverageInputs() solo lee.
// recomputeAndSaveCoverage() reemplaza la tabla coverage completa.
//
// Imports relativos (no '@/') para que scripts/fase2-check.ts lo pueda usar con tsx.
import { z } from 'zod'
import { supabaseAdmin, type SupabaseAdminClient } from './supabase-admin'
import type { Role } from './permissions'
import { tienePermiso } from './empresas-reglas'
import { zoneDisplayName } from './zone-names'
import type {
  ComputedCoverage,
  CoverageApiRow,
  CoverageDistanceInput,
  CoverageExecutiveInput,
  CoverageExecutiveLineInput,
  CoverageExecutiveRef,
  CoverageHospitalInput,
  CoverageInputs,
  CoverageKind,
  CoverageLineInfo,
  CoverageLineInput,
  CoverageLineZoneInput,
  CoverageOverrideInput,
  CoverageResponse,
  CoverageZoneInput,
  MeLine,
  MeLineRole,
  MeLinesResponse,
  ZoneMatrix,
} from './types/coverage'

// ---------------------------------------------------------------------------
// Utilidades puras
// ---------------------------------------------------------------------------

const ELIGIBLE_STATUSES = new Set(['active', 'placeholder'])

/** Mediana (promedio de los dos centrales si la cantidad es par), como percentile_cont(0.5). */
export function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

/** "4 h 39", "2 h", "25 min" (mismo formato que el documento de la Fase 2). */
export function formatHoursMinutes(minutes: number): string {
  const total = Math.max(0, Math.round(minutes))
  const hours = Math.floor(total / 60)
  const rest = total % 60
  if (hours === 0) return `${rest} min`
  return rest === 0 ? `${hours} h` : `${hours} h ${rest}`
}

function compareNames(a: string, b: string): number {
  return a.localeCompare(b, 'es', { sensitivity: 'base' })
}

const lineZoneKey = (lineId: string, kamId: string) => `${lineId}|${kamId}`

/** "A", "A y B", "A, B y C". */
export function joinNamesEs(names: string[]): string {
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`
}

/**
 * Regla del dueño (2026-10-11) para un ajuste manual de (línea L, zona Z) a la ejecutiva X:
 * vale si X vive en Z (resuelve un conflicto o confirma a la local) o si ninguna residente elegible
 * de Z lleva L. `residentsWithLine` = ejecutivas active/placeholder con base_kam_id = Z que llevan L
 * (si trae otras, se ignoran). Devuelve las residentes que impiden el ajuste, por nombre;
 * vacío = permitido. Pura: la usan computeCoverage() y POST /api/coverage/overrides.
 * No revisa que X esté activa ni que lleve L (eso se valida aparte).
 */
export function overrideBlockingResidents<T extends { id: string; full_name: string; base_kam_id: string | null }>(
  executive: { id: string; base_kam_id: string | null },
  zoneId: string,
  residentsWithLine: T[]
): T[] {
  if (executive.base_kam_id === zoneId) return []
  return residentsWithLine
    .filter(resident => resident.base_kam_id === zoneId && resident.id !== executive.id)
    .sort((a, b) => compareNames(a.full_name, b.full_name))
}

// ---------------------------------------------------------------------------
// Matriz zona → zona
// ---------------------------------------------------------------------------

/**
 * Minutos de carro de zona a zona: matrix[origen][destino] = mediana de travel_time/60 desde el
 * punto base de la zona origen (hospital_kam_distances.kam_id) hacia las IPS de la zona destino.
 * `hospitals` deben ser las IPS activas. Solo se consideran zonas presentes en `zones`
 * (activas o no: una ejecutiva puede vivir en una zona inactiva). Diagonal = 0.
 */
export function computeZoneMatrix(
  zones: CoverageZoneInput[],
  hospitals: CoverageHospitalInput[],
  distances: CoverageDistanceInput[]
): ZoneMatrix {
  const zoneIds = new Set(zones.map(zone => zone.id))

  // area_id → zonas destino (puede haber más de una fila de kams con el mismo area_id)
  const zonesByArea = new Map<string, string[]>()
  for (const zone of zones) {
    const area = (zone.area_id || '').trim()
    if (area.length !== 5 && area.length !== 7) continue
    const list = zonesByArea.get(area) || []
    list.push(zone.id)
    zonesByArea.set(area, list)
  }

  // IPS → zonas destino a las que pertenece
  const destinationsByHospital = new Map<string, string[]>()
  for (const hospital of hospitals) {
    const destinations: string[] = []
    if (hospital.municipality_id) destinations.push(...(zonesByArea.get(hospital.municipality_id.trim()) || []))
    if (hospital.locality_id) destinations.push(...(zonesByArea.get(hospital.locality_id.trim()) || []))
    if (destinations.length > 0) destinationsByHospital.set(hospital.id, destinations)
  }

  // Minutos por (origen, destino)
  const buckets = new Map<string, Map<string, number[]>>()
  for (const distance of distances) {
    if (distance.travel_time === null || distance.travel_time === undefined) continue
    if (!Number.isFinite(distance.travel_time) || distance.travel_time < 0) continue
    if (!zoneIds.has(distance.kam_id)) continue
    const destinations = destinationsByHospital.get(distance.hospital_id)
    if (!destinations) continue

    let byDestination = buckets.get(distance.kam_id)
    if (!byDestination) {
      byDestination = new Map<string, number[]>()
      buckets.set(distance.kam_id, byDestination)
    }
    for (const destination of destinations) {
      const list = byDestination.get(destination) || []
      list.push(distance.travel_time / 60)
      byDestination.set(destination, list)
    }
  }

  const matrix: ZoneMatrix = {}
  for (const zone of zones) matrix[zone.id] = { [zone.id]: 0 }
  buckets.forEach((byDestination, origin) => {
    byDestination.forEach((minutes, destination) => {
      if (destination === origin) return // misma ciudad base: 0 por definición
      const value = median(minutes)
      if (value !== null) matrix[origin][destination] = Math.round(value * 10) / 10
    })
  })
  return matrix
}

/** Minutos enteros de la zona origen a la destino, o null si la matriz no tiene el dato. */
export function zoneMinutes(matrix: ZoneMatrix, originKamId: string | null, destinationKamId: string): number | null {
  if (!originKamId) return null
  if (originKamId === destinationKamId) return 0
  const value = matrix[originKamId]?.[destinationKamId]
  return value === undefined || value === null ? null : Math.round(value)
}

// ---------------------------------------------------------------------------
// Cobertura
// ---------------------------------------------------------------------------

export type CoverageComputeInputs = Omit<CoverageInputs, 'hospitals' | 'distances'>

/**
 * Calcula una fila por cada (línea activa, zona activa), aunque quede vacante.
 * Pura: no lee ni escribe nada. Orden de salida: líneas en el orden recibido, zonas por nombre.
 */
export function computeCoverage(inputs: CoverageComputeInputs, matrix: ZoneMatrix): ComputedCoverage[] {
  const activeLines = inputs.lines.filter(line => line.active)
  const activeZones = inputs.zones
    .filter(zone => zone.active)
    .sort((a, b) => compareNames(a.name, b.name) || a.id.localeCompare(b.id))

  const executivesById = new Map<string, CoverageExecutiveInput>()
  for (const executive of inputs.executives) executivesById.set(executive.id, executive)

  const isEligible = (executive: CoverageExecutiveInput | undefined): executive is CoverageExecutiveInput =>
    Boolean(executive && ELIGIBLE_STATUSES.has(executive.status) && executive.base_kam_id)

  // línea → ejecutivas elegibles que la llevan
  const executivesByLine = new Map<string, CoverageExecutiveInput[]>()
  const linesByExecutive = new Map<string, Set<string>>()
  for (const link of inputs.executiveLines) {
    const set = linesByExecutive.get(link.executive_id) || new Set<string>()
    set.add(link.line_id)
    linesByExecutive.set(link.executive_id, set)

    const executive = executivesById.get(link.executive_id)
    if (!isEligible(executive)) continue
    const list = executivesByLine.get(link.line_id) || []
    if (!list.some(item => item.id === executive.id)) list.push(executive)
    executivesByLine.set(link.line_id, list)
  }

  const equipment = new Map<string, boolean>()
  for (const row of inputs.lineZones) equipment.set(lineZoneKey(row.line_id, row.kam_id), row.has_equipment)

  // Un solo ajuste activo por (línea, zona) (índice único parcial en la BD); si hubiera más, gana el último.
  const overrides = new Map<string, CoverageOverrideInput>()
  for (const override of inputs.overrides) {
    if (override.active) overrides.set(lineZoneKey(override.line_id, override.kam_id), override)
  }

  const results: ComputedCoverage[] = []

  for (const line of activeLines) {
    const lineExecutives = executivesByLine.get(line.id) || []

    for (const zone of activeZones) {
      const key = lineZoneKey(line.id, zone.id)
      const base = {
        line_id: line.id,
        kam_id: zone.id,
        has_equipment: equipment.get(key) ?? true,
      }

      // Locales: elegibles que viven en la zona y llevan la línea (reglas 1 y 2)
      const locals = lineExecutives
        .filter(executive => executive.base_kam_id === zone.id)
        .sort((a, b) => compareNames(a.full_name, b.full_name))

      // 1. Ajuste manual
      const override = overrides.get(key)
      let overrideNote: string | null = null
      if (override) {
        const executive = executivesById.get(override.executive_id)
        const blockers = executive ? overrideBlockingResidents(executive, zone.id, locals) : []
        if (!executive) {
          overrideNote = 'Ajuste manual sin efecto: el Ejecutivo Comercial ya no existe'
        } else if (!ELIGIBLE_STATUSES.has(executive.status) || !executive.base_kam_id) {
          overrideNote = `Ajuste manual sin efecto: ${executive.full_name} está inactivo o sin zona base`
        } else if (!linesByExecutive.get(executive.id)?.has(line.id)) {
          overrideNote = `Ajuste manual sin efecto: ${executive.full_name} no lleva esta línea`
        } else if (blockers.length > 0) {
          // Regla del dueño: no se fuerza a alguien de otra ciudad si la zona ya tiene quien lleve la línea
          overrideNote = `Ajuste manual sin efecto: la zona ya tiene a ${joinNamesEs(
            blockers.map(resident => resident.full_name)
          )} con esta línea`
        } else {
          results.push({
            ...base,
            executive_id: executive.id,
            kind: 'manual',
            travel_minutes: zoneMinutes(matrix, executive.base_kam_id, zone.id),
            source_kam_id: executive.base_kam_id,
            nearest_executive_id: null,
            nearest_minutes: null,
            note: override.reason,
            override_id: override.id,
          })
          continue
        }
      }

      const withOverrideNote = (note: string | null) =>
        [overrideNote, note].filter((part): part is string => Boolean(part)).join(' · ') || null

      // 2. Locales
      if (locals.length === 1) {
        results.push({
          ...base,
          executive_id: locals[0].id,
          kind: 'local',
          travel_minutes: 0,
          source_kam_id: zone.id,
          nearest_executive_id: null,
          nearest_minutes: null,
          note: withOverrideNote(null),
          override_id: override?.id ?? null,
        })
        continue
      }
      if (locals.length > 1) {
        results.push({
          ...base,
          executive_id: null,
          kind: 'conflict',
          travel_minutes: null,
          source_kam_id: null,
          nearest_executive_id: null,
          nearest_minutes: null,
          note: withOverrideNote(locals.map(executive => executive.full_name).join(', ')),
          override_id: override?.id ?? null,
        })
        continue
      }

      // 3. Alcance o vacante: la más cercana que lleva la línea
      const candidates = lineExecutives
        .map(executive => ({ executive, minutes: zoneMinutes(matrix, executive.base_kam_id, zone.id) }))
        .filter((item): item is { executive: CoverageExecutiveInput; minutes: number } => item.minutes !== null)
        .sort(
          (a, b) =>
            a.minutes - b.minutes ||
            compareNames(a.executive.full_name, b.executive.full_name) ||
            a.executive.id.localeCompare(b.executive.id)
        )

      if (candidates.length === 0) {
        results.push({
          ...base,
          executive_id: null,
          kind: 'vacant',
          travel_minutes: null,
          source_kam_id: null,
          nearest_executive_id: null,
          nearest_minutes: null,
          note: withOverrideNote(null),
          override_id: override?.id ?? null,
        })
        continue
      }

      const best = candidates[0]
      const tied = candidates.filter(item => item.minutes === best.minutes && item.executive.id !== best.executive.id)
      const tieNote = tied.length > 0
        ? `Empate a ${formatHoursMinutes(best.minutes)} con ${tied.map(item => item.executive.full_name).join(', ')}; se eligió por orden alfabético`
        : null

      if (best.minutes <= line.max_reach_minutes) {
        results.push({
          ...base,
          executive_id: best.executive.id,
          kind: 'reach',
          travel_minutes: best.minutes,
          source_kam_id: best.executive.base_kam_id,
          nearest_executive_id: null,
          nearest_minutes: null,
          note: withOverrideNote(tieNote),
          override_id: override?.id ?? null,
        })
      } else {
        results.push({
          ...base,
          executive_id: null,
          kind: 'vacant',
          travel_minutes: null,
          source_kam_id: null,
          nearest_executive_id: best.executive.id,
          nearest_minutes: best.minutes,
          note: withOverrideNote(tieNote),
          override_id: override?.id ?? null,
        })
      }
    }
  }

  return results
}

// ---------------------------------------------------------------------------
// Carga de datos (solo lectura)
// ---------------------------------------------------------------------------

const PAGE_SIZE = 1000

type PageResult<T> = { data: T[] | null; error: { message: string } | null }

/**
 * Lee todas las filas paginando con .range() de 1000 en 1000 (límite de PostgREST).
 * Mismo contrato que fetchAllRows de app/api/kams/_lib/kam-shared.ts; se duplica aquí para que
 * lib/ no dependa de app/ (ni de next/server) y el script de verificación pueda usarlo.
 * La consulta debe tener un orden estable.
 */
async function fetchAll<T>(label: string, build: (from: number, to: number) => PromiseLike<PageResult<T>>): Promise<T[]> {
  const rows: T[] = []
  for (let page = 0; page < 1000; page++) {
    const from = page * PAGE_SIZE
    const { data, error } = await build(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(`Error leyendo ${label}: ${error.message}`)
    const chunk = data || []
    rows.push(...chunk)
    if (chunk.length < PAGE_SIZE) break
  }
  return rows
}

/** Lee todo lo que necesita el motor. Solo SELECT; usa columnas que existen desde la Fase 1. */
export async function loadCoverageInputs(db: SupabaseAdminClient = supabaseAdmin): Promise<CoverageInputs> {
  const [zones, hospitals, distances, lines, executives, executiveLines, lineZones, overrides] = await Promise.all([
    fetchAll<CoverageZoneInput>('kams', (from, to) =>
      db.from('kams').select('id, name, area_id, active').order('id').range(from, to)
    ),
    fetchAll<CoverageHospitalInput>('hospitals', (from, to) =>
      db.from('hospitals').select('id, municipality_id, locality_id').eq('active', true).order('id').range(from, to)
    ),
    fetchAll<CoverageDistanceInput>('hospital_kam_distances', (from, to) =>
      db
        .from('hospital_kam_distances')
        .select('hospital_id, kam_id, travel_time')
        .not('travel_time', 'is', null)
        .order('id')
        .range(from, to)
    ),
    fetchAll<CoverageLineInput & { sort_order: number }>('business_lines', (from, to) =>
      db
        .from('business_lines')
        .select('id, code, name, max_reach_minutes, active, sort_order')
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to)
    ),
    fetchAll<CoverageExecutiveInput>('executives', (from, to) =>
      db.from('executives').select('id, full_name, status, base_kam_id').order('id').range(from, to)
    ),
    fetchAll<CoverageExecutiveLineInput>('executive_lines', (from, to) =>
      db
        .from('executive_lines')
        .select('executive_id, line_id')
        .order('executive_id')
        .order('line_id')
        .range(from, to)
    ),
    fetchAll<CoverageLineZoneInput>('line_zones', (from, to) =>
      db.from('line_zones').select('line_id, kam_id, has_equipment').order('line_id').order('kam_id').range(from, to)
    ),
    fetchAll<CoverageOverrideInput>('coverage_overrides', (from, to) =>
      db
        .from('coverage_overrides')
        .select('id, line_id, kam_id, executive_id, reason, active')
        .eq('active', true)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to)
    ),
  ])

  return {
    zones,
    hospitals,
    distances,
    lines: lines.map(({ sort_order: _sortOrder, ...line }) => line),
    executives,
    executiveLines,
    lineZones,
    overrides,
  }
}

/** Carga, calcula la matriz y la cobertura en memoria (no escribe nada). */
export async function computeCoverageFromDatabase(db: SupabaseAdminClient = supabaseAdmin): Promise<{
  inputs: CoverageInputs
  matrix: ZoneMatrix
  coverage: ComputedCoverage[]
}> {
  const inputs = await loadCoverageInputs(db)
  const matrix = computeZoneMatrix(inputs.zones, inputs.hospitals, inputs.distances)
  const coverage = computeCoverage(inputs, matrix)
  return { inputs, matrix, coverage }
}

// ---------------------------------------------------------------------------
// Guardado
// ---------------------------------------------------------------------------

/**
 * Recalcula la cobertura de todas las líneas y zonas activas y reemplaza la tabla coverage.
 * Reemplazo completo sin dejar la tabla vacía entre medias: todas las filas nuevas llevan el mismo
 * computed_at; primero se escriben (upsert por (line_id, kam_id), que también aguanta dos
 * recálculos simultáneos) y después se borra todo lo que tenga un computed_at anterior
 * (pares línea/zona que ya no existen). El resultado final es el de un DELETE total + INSERT.
 * Requiere la migración 0400 (columnas nearest_*, has_equipment, note y kind 'conflict').
 */
export async function recomputeAndSaveCoverage(db: SupabaseAdminClient = supabaseAdmin): Promise<{ rows: number }> {
  const { coverage } = await computeCoverageFromDatabase(db)
  const computedAt = new Date().toISOString()
  const rows = coverage.map(({ override_id: _overrideId, ...row }) => ({ ...row, computed_at: computedAt }))

  const CHUNK = 500
  for (let index = 0; index < rows.length; index += CHUNK) {
    const chunk = rows.slice(index, index + CHUNK)
    const { data, error } = await db
      .from('coverage')
      .upsert(chunk, { onConflict: 'line_id,kam_id' })
      .select('id')
    if (error) throw new Error(`Error guardando la cobertura: ${error.message}`)
    if (!data || data.length !== chunk.length) {
      throw new Error(`Guardado de cobertura incompleto: ${data?.length ?? 0} de ${chunk.length} filas`)
    }
  }

  const { error: deleteError } = await db.from('coverage').delete().lt('computed_at', computedAt).select('id')
  if (deleteError) throw new Error(`Error limpiando la cobertura anterior: ${deleteError.message}`)

  return { rows: rows.length }
}

// ---------------------------------------------------------------------------
// Acceso por usuario
// ---------------------------------------------------------------------------

/** Lo mínimo del usuario de sesión que necesitan las reglas de acceso. */
export interface CoverageUser {
  id: string
  role: Role
  /** Los papeles de la empresa activa (SessionUser.papeles): los permisos se deciden con su SUMA, no con `role`. */
  papeles: readonly { papel: Role }[]
}

interface LineAccessRow {
  id: string
  code: string
  name: string
  leader_user_id: string | null
  max_reach_minutes: number
  sort_order: number
}

async function loadActiveLines(db: SupabaseAdminClient): Promise<LineAccessRow[]> {
  const { data, error } = await db
    .from('business_lines')
    .select('id, code, name, leader_user_id, max_reach_minutes, sort_order')
    .eq('active', true)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })
  if (error) throw new Error(`Error leyendo business_lines: ${error.message}`)
  return (data || []) as LineAccessRow[]
}

/**
 * Líneas que el usuario puede ver (GET /api/me/lines):
 *  - map:all-lines (admin, commercial_director, data_manager, viewer) → todas las activas, role 'all'.
 *  - líder (business_lines.leader_user_id = usuario) → role 'leader'.
 *  - ejecutiva enlazada (executives.user_id = usuario, activa o placeholder) → sus líneas, role 'executive'.
 * Las dos últimas se unen; si coinciden gana 'leader'.
 */
export async function resolveUserLines(user: CoverageUser, db: SupabaseAdminClient = supabaseAdmin): Promise<MeLinesResponse> {
  const lines = await loadActiveLines(db)
  const toMeLine = (line: LineAccessRow, role: MeLineRole): MeLine => ({
    id: line.id,
    code: line.code,
    name: line.name,
    role,
  })

  if (tienePermiso(user.papeles, 'map:all-lines')) {
    return { lines: lines.map(line => toMeLine(line, 'all')), canSeeAll: true }
  }

  const roleByLine = new Map<string, MeLineRole>()
  for (const line of lines) {
    if (line.leader_user_id === user.id) roleByLine.set(line.id, 'leader')
  }

  const { data: myExecutives, error: executivesError } = await db
    .from('executives')
    .select('id')
    .eq('user_id', user.id)
    .in('status', ['active', 'placeholder'])
  if (executivesError) throw new Error(`Error leyendo executives: ${executivesError.message}`)

  const executiveIds = (myExecutives || []).map(row => row.id as string)
  if (executiveIds.length > 0) {
    const { data: links, error: linksError } = await db
      .from('executive_lines')
      .select('line_id')
      .in('executive_id', executiveIds)
    if (linksError) throw new Error(`Error leyendo executive_lines: ${linksError.message}`)
    for (const link of links || []) {
      const lineId = link.line_id as string
      if (!roleByLine.has(lineId)) roleByLine.set(lineId, 'executive')
    }
  }

  return {
    lines: lines.filter(line => roleByLine.has(line.id)).map(line => toMeLine(line, roleByLine.get(line.id)!)),
    canSeeAll: false,
  }
}

export const LINE_CODE_RE = /^[a-z0-9_-]{1,40}$/

/**
 * Busca la línea por código entre las que el usuario puede ver.
 * Devuelve la línea con su alcance máximo, o null si no existe o no tiene acceso (→ 403).
 * `me`: las líneas del usuario ya resueltas con resolveUserLines (para no leerlas dos veces).
 */
export async function findAccessibleLine(
  user: CoverageUser,
  code: string,
  db: SupabaseAdminClient = supabaseAdmin,
  me?: MeLinesResponse
): Promise<{ line: CoverageLineInfo; role: MeLineRole } | null> {
  const normalized = code.trim().toLowerCase()
  if (!LINE_CODE_RE.test(normalized)) return null

  const userLines = me ?? (await resolveUserLines(user, db))
  const mine = userLines.lines.find(line => line.code === normalized)
  if (!mine) return null

  const { data, error } = await db
    .from('business_lines')
    .select('id, code, name, max_reach_minutes')
    .eq('id', mine.id)
    .limit(1)
  if (error) throw new Error(`Error leyendo business_lines: ${error.message}`)
  const row = data && data.length > 0 ? (data[0] as CoverageLineInfo) : null
  return row ? { line: row, role: mine.role } : null
}

/**
 * Ejecutivos Comerciales que llevan alguna de estas líneas (executive_lines). La vista de zonas del mapa
 * (/api/map/data) lo usa para que quien no tiene map:all-lines no reciba nombres de personas de líneas que no ve.
 */
export async function loadExecutiveIdsOfLines(lineIds: string[], db: SupabaseAdminClient = supabaseAdmin): Promise<Set<string>> {
  if (lineIds.length === 0) return new Set()
  const { data, error } = await db.from('executive_lines').select('executive_id').in('line_id', lineIds)
  if (error) throw new Error(`Error leyendo executive_lines: ${error.message}`)
  return new Set((data || []).map(row => row.executive_id as string))
}

/**
 * ¿Puede el usuario ajustar la cobertura (o editar) de esta línea?
 *  - Sin coverage:edit → no.
 *  - coverage:edit + map:all-lines (admin, commercial_director) → cualquier línea.
 *  - coverage:edit sin map:all-lines (line_leader) → solo si es el líder de esa línea.
 */
export async function canEditCoverageLine(
  user: CoverageUser,
  lineId: string,
  db: SupabaseAdminClient = supabaseAdmin
): Promise<boolean> {
  if (!tienePermiso(user.papeles, 'coverage:edit')) return false
  if (tienePermiso(user.papeles, 'map:all-lines')) return true
  return isLineLeader(user, lineId, db)
}

/** true si business_lines.leader_user_id de esa línea es el usuario. */
export async function isLineLeader(user: CoverageUser, lineId: string, db: SupabaseAdminClient = supabaseAdmin): Promise<boolean> {
  const { data, error } = await db
    .from('business_lines')
    .select('id')
    .eq('id', lineId)
    .eq('leader_user_id', user.id)
    .limit(1)
  if (error) throw new Error(`Error leyendo business_lines: ${error.message}`)
  return Boolean(data && data.length > 0)
}

// ---------------------------------------------------------------------------
// Respuesta de la API (GET /api/coverage y /api/map/data?line=)
// ---------------------------------------------------------------------------

const COVERAGE_SELECT =
  'kam_id, executive_id, kind, travel_minutes, source_kam_id, nearest_executive_id, nearest_minutes, has_equipment, note, computed_at'

interface StoredCoverageRow {
  kam_id: string
  executive_id: string | null
  kind: CoverageKind
  travel_minutes: number | null
  source_kam_id: string | null
  nearest_executive_id: string | null
  nearest_minutes: number | null
  has_equipment: boolean
  note: string | null
  computed_at: string | null
}

/**
 * Cobertura de una línea con nombres resueltos. Lee la tabla coverage; si la línea aún no tiene
 * filas (nunca se recalculó), la calcula en memoria sin guardarla (computed_at = null).
 */
export async function loadCoverageResponse(
  line: CoverageLineInfo,
  db: SupabaseAdminClient = supabaseAdmin
): Promise<CoverageResponse> {
  const { data: storedData, error: storedError } = await db
    .from('coverage')
    .select(COVERAGE_SELECT)
    .eq('line_id', line.id)
    .range(0, 9999)
  if (storedError) throw new Error(`Error leyendo coverage: ${storedError.message}`)

  let rows = (storedData || []) as StoredCoverageRow[]
  let computedAt: string | null = null

  if (rows.length > 0) {
    computedAt = rows.reduce<string | null>(
      (latest, row) => (row.computed_at && (!latest || row.computed_at > latest) ? row.computed_at : latest),
      null
    )
  } else {
    const { coverage } = await computeCoverageFromDatabase(db)
    rows = coverage
      .filter(row => row.line_id === line.id)
      .map(row => ({
        kam_id: row.kam_id,
        executive_id: row.executive_id,
        kind: row.kind,
        travel_minutes: row.travel_minutes,
        source_kam_id: row.source_kam_id,
        nearest_executive_id: row.nearest_executive_id,
        nearest_minutes: row.nearest_minutes,
        has_equipment: row.has_equipment,
        note: row.note,
        computed_at: null,
      }))
  }

  const [kamsResult, overridesResult] = await Promise.all([
    db.from('kams').select('id, name, base_city, active').range(0, 9999),
    db.from('coverage_overrides').select('id, kam_id, reason').eq('line_id', line.id).eq('active', true),
  ])
  if (kamsResult.error) throw new Error(`Error leyendo kams: ${kamsResult.error.message}`)
  if (overridesResult.error) throw new Error(`Error leyendo coverage_overrides: ${overridesResult.error.message}`)

  const zones = new Map<string, { name: string; base_city: string | null; active: boolean }>()
  for (const kam of (kamsResult.data || []) as Array<{
    id: string
    name: string | null
    base_city: string | null
    active: boolean | null
  }>) {
    zones.set(kam.id, { name: zoneDisplayName(kam.name), base_city: kam.base_city ?? null, active: kam.active === true })
  }

  const overridesByZone = new Map<string, { id: string; reason: string }>()
  for (const override of (overridesResult.data || []) as Array<{ id: string; kam_id: string; reason: string }>) {
    overridesByZone.set(override.kam_id, { id: override.id, reason: override.reason })
  }

  const executiveIds = new Set<string>()
  for (const row of rows) {
    if (row.executive_id) executiveIds.add(row.executive_id)
    if (row.nearest_executive_id) executiveIds.add(row.nearest_executive_id)
  }
  const executives = new Map<string, CoverageExecutiveRef>()
  if (executiveIds.size > 0) {
    const { data: executiveData, error: executivesError } = await db
      .from('executives')
      .select('id, full_name, status, color')
      .in('id', Array.from(executiveIds))
    if (executivesError) throw new Error(`Error leyendo executives: ${executivesError.message}`)
    for (const executive of (executiveData || []) as CoverageExecutiveRef[]) {
      executives.set(executive.id, {
        id: executive.id,
        full_name: executive.full_name,
        status: executive.status,
        color: executive.color ?? null,
      })
    }
  }

  // Solo zonas activas (una fila guardada de una zona desactivada después no se muestra)
  const apiRows: CoverageApiRow[] = rows
    .filter(row => zones.get(row.kam_id)?.active === true)
    .map(row => {
      const zone = zones.get(row.kam_id)!
      const override = overridesByZone.get(row.kam_id) ?? null
      const nearestExecutive = row.nearest_executive_id ? executives.get(row.nearest_executive_id) : undefined
      return {
        kam_id: row.kam_id,
        zone_name: zone.name,
        base_city: zone.base_city,
        kind: row.kind,
        executive: row.executive_id ? executives.get(row.executive_id) ?? null : null,
        travel_minutes: row.travel_minutes,
        source_kam_id: row.source_kam_id,
        nearest:
          nearestExecutive && row.nearest_minutes !== null
            ? { executive_id: nearestExecutive.id, full_name: nearestExecutive.full_name, minutes: row.nearest_minutes }
            : null,
        has_equipment: row.has_equipment,
        note: row.note,
        override_id: override?.id ?? null,
        override_reason: override?.reason ?? null,
        source_zone_name: row.source_kam_id ? zones.get(row.source_kam_id)?.name ?? null : null,
      }
    })
    .sort((a, b) => compareNames(a.zone_name, b.zone_name) || a.kam_id.localeCompare(b.kam_id))

  return {
    line: { id: line.id, code: line.code, name: line.name, max_reach_minutes: line.max_reach_minutes },
    rows: apiRows,
    computed_at: computedAt,
  }
}

// ---------------------------------------------------------------------------
// Validación de cuerpos
// ---------------------------------------------------------------------------

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const idSchema = (label: string) =>
  z
    .string({ required_error: `Falta ${label}`, invalid_type_error: `${label} no válido` })
    .regex(UUID_RE, `${label} no válido`)
    .transform(id => id.toLowerCase())

/** POST /api/coverage/overrides (allow-list: cualquier otra clave se descarta). */
export const coverageOverrideSchema = z.object({
  line_id: idSchema('line_id'),
  kam_id: idSchema('kam_id'),
  executive_id: idSchema('executive_id'),
  reason: z
    .string({ required_error: 'El motivo es obligatorio', invalid_type_error: 'Motivo no válido' })
    .trim()
    .min(3, 'El motivo es obligatorio (mínimo 3 caracteres)')
    .max(500, 'El motivo no puede superar 500 caracteres'),
})

export type CoverageOverrideBody = z.infer<typeof coverageOverrideSchema>

export { UUID_RE as COVERAGE_UUID_RE }
