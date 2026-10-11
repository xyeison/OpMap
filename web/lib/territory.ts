// Anexo de territorio por Ejecutivo Comercial y línea (Fase 2b). SOLO SERVIDOR (usa service_role).
//
// El territorio de un Ejecutivo Comercial E en la línea L es:
//   - Zonas: las filas de coverage(L) con executive_id = E y kind local | reach | manual.
//   - Anexo A: las IPS ACTIVAS asignadas (assignments) a esas zonas.
//   - Anexo B: municipios agrupados por departamento, con la misma precedencia que el mapa:
//       · 'ips' (con IPS objetivo, hay que visitarlos): los territorios con IPS activas asignadas
//         HOY que ganan sus zonas por la regla de mayoría (lib/territory-rules.ts), más aquellos
//         donde el ejecutivo tiene IPS del Anexo A aunque otra zona gane la mayoría (el Anexo B
//         siempre cubre todo el Anexo A).
//       · 'reach' (sin IPS hoy, pero dentro del alcance por CARRETERA desde la ciudad base; si
//         mañana abre una clínica, la visita esta persona): filas de municipality_zone de sus
//         zonas en municipios que hoy no tienen IPS asignadas.
//     Los municipios sin IPS se reparten por tiempo real de carretera (Google, modo driving), nunca
//     por línea recta: "fuera de alcance" y "sin acceso terrestre" NO entran en ningún anexo.
//
// Bogotá (11001): la unidad es la localidad. municipality_zone guarda 11001 con el ganador global,
// pero en el Anexo B se listan las localidades que gana cada zona (regla de mayoría del mapa).
//
// Mientras municipality_zone no exista o esté vacía (migración 0500 sin aplicar o motor sin
// ejecutar), el Anexo B solo trae los municipios con IPS y reach_pending = true
// ("municipios de alcance pendientes de cálculo").
//
// content_hash = sha256 del JSON canónico (claves ordenadas) de { annex_a, annex_b }.
//
// Imports relativos (no '@/') para que un script con tsx pueda usarlo.
import { createHash, randomUUID } from 'crypto'
import { supabaseAdmin, type SupabaseAdminClient } from './supabase-admin'
import { hasPermission, type Permission } from './permissions'
import { isLineLeader, loadCoverageResponse, resolveUserLines, type CoverageUser } from './coverage'
import { zoneDisplayName } from './zone-names'
import { computeTerritoryWinners, type ZoneNameLookup } from './territory-rules'
import type { CoverageLineInfo, MeLineRole } from './types/coverage'

// ---------------------------------------------------------------------------
// Tipos (contrato de /api/territory/**; los componentes cliente los importan con `import type`)
// ---------------------------------------------------------------------------

export type TerritoryZoneKind = 'local' | 'reach' | 'manual'
export type TerritoryMunicipalityKind = 'ips' | 'reach'

export interface TerritoryZone {
  kam_id: string
  name: string
  base_city: string | null
  kind: TerritoryZoneKind
}

/** Fila del Anexo A: una IPS activa asignada a una de las zonas. */
export interface AnnexAHospital {
  code: string
  name: string
  municipality: string
  department: string
  beds: number
  kam_id: string
  /** Código DANE del municipio (o localidad de Bogotá, 7 dígitos) para agrupar con el Anexo B. */
  municipality_code: string | null
}

export interface AnnexBMunicipality {
  code: string
  name: string
  kind: TerritoryMunicipalityKind
  ips_count: number
  travel_minutes: number | null
}

export interface AnnexBDepartment {
  department: string
  municipalities: AnnexBMunicipality[]
}

export interface TerritorySummary {
  zones: number
  municipalities_ips: number
  municipalities_reach: number
  hospitals: number
  beds: number
}

export interface TerritoryLineRef {
  id: string
  code: string
  name: string
}

export interface TerritoryExecutiveRef {
  id: string
  full_name: string
  status: string
  color: string | null
}

export interface Territory {
  line: TerritoryLineRef
  executive: TerritoryExecutiveRef
  /** Nombre comercial de la zona (line_territory_names) o "<ejecutivo> – <línea>". */
  zone_name: string
  zone_name_is_custom: boolean
  zones: TerritoryZone[]
  annex_a: AnnexAHospital[]
  annex_b: AnnexBDepartment[]
  summary: TerritorySummary
  /** true si municipality_zone no existe o está vacía: el Anexo B solo trae municipios con IPS. */
  reach_pending: boolean
  /** Municipios del país aún en 'pending' en municipality_zone (faltan tiempos por calcular). */
  pending_municipalities: number
  content_hash: string
  generated_at: string
}

/** GET /api/territory?line=<code> */
export interface LineTerritoriesResponse {
  line: TerritoryLineRef
  territories: Territory[]
  reach_pending: boolean
  pending_municipalities: number
  can_snapshot: boolean
  can_edit_names: boolean
  /** false si la migración 0500 aún no está aplicada (versiones y nombres no disponibles). */
  storage_ready: boolean
}

export interface TerritorySnapshotListItem {
  id: string
  line_id: string
  executive_id: string
  version_label: string
  note: string | null
  created_by: string | null
  created_by_name: string | null
  created_at: string
  content_hash: string
  summary: TerritorySnapshotSummary
}

/** territory_snapshots.summary: el resumen más el contexto necesario para reimprimir la versión. */
export interface TerritorySnapshotSummary extends TerritorySummary {
  zone_name?: string
  line_name?: string
  line_code?: string
  executive_name?: string
  zones_detail?: TerritoryZone[]
  reach_pending?: boolean
}

export interface TerritorySnapshot extends TerritorySnapshotListItem {
  annex_a: AnnexAHospital[]
  annex_b: AnnexBDepartment[]
}

export interface TerritoryDiffMunicipality {
  code: string
  name: string
  department: string
  kind: TerritoryMunicipalityKind
}

export interface TerritoryDiffHospital {
  code: string
  name: string
  municipality: string
  department: string
}

export interface TerritoryDiff {
  added_municipalities: TerritoryDiffMunicipality[]
  removed_municipalities: TerritoryDiffMunicipality[]
  added_hospitals: TerritoryDiffHospital[]
  removed_hospitals: TerritoryDiffHospital[]
  snapshot_hash: string
  current_hash: string
  unchanged: boolean
}

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

export const TERRITORY_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const BOGOTA_CODE = '11001'
const ELIGIBLE_STATUSES = ['active', 'placeholder']
const PAGE_SIZE = 1000

export const MIGRATION_PENDING_MESSAGE =
  'Esta función requiere la migración 2026-10-11_0500_fase2b_municipios_anexos (pendiente de aplicar)'

function compareText(a: string, b: string): number {
  return a.localeCompare(b, 'es', { sensitivity: 'base' })
}

type DbError = { message: string; code?: string } | null

/** true si el error de PostgREST indica que la tabla aún no existe (migración sin aplicar). */
export function isMissingTableError(error: DbError | undefined): boolean {
  if (!error) return false
  if (error.code === '42P01' || error.code === 'PGRST205') return true
  const message = (error.message || '').toLowerCase()
  return message.includes('does not exist') || message.includes('could not find the table')
}

type PageResult<T> = { data: T[] | null; error: DbError }

/** Lee todas las filas paginando con .range() (límite de 1000 de PostgREST). Orden estable obligatorio. */
async function fetchAll<T>(label: string, build: (from: number, to: number) => PromiseLike<PageResult<T>>): Promise<T[]> {
  const rows: T[] = []
  for (let page = 0; page < 1000; page++) {
    const from = page * PAGE_SIZE
    const { data, error } = await build(from, from + PAGE_SIZE - 1)
    if (error) throw Object.assign(new Error(`Error leyendo ${label}: ${error.message}`), { dbError: error })
    const chunk = data || []
    rows.push(...chunk)
    if (chunk.length < PAGE_SIZE) break
  }
  return rows
}

/** Como fetchAll, pero devuelve null si la tabla no existe (migración 0500 sin aplicar). */
async function fetchAllOptional<T>(
  label: string,
  build: (from: number, to: number) => PromiseLike<PageResult<T>>
): Promise<T[] | null> {
  try {
    return await fetchAll(label, build)
  } catch (error) {
    const dbError = (error as { dbError?: DbError }).dbError
    if (isMissingTableError(dbError)) return null
    throw error
  }
}

/** JSON canónico: claves de objetos ordenadas, arrays en su orden. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value ?? null)
  if (Array.isArray(value)) return `[${value.map(item => canonicalJson(item)).join(',')}]`
  const entries = Object.keys(value as Record<string, unknown>)
    .filter(key => (value as Record<string, unknown>)[key] !== undefined)
    .sort()
    .map(key => `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`)
  return `{${entries.join(',')}}`
}

export function territoryContentHash(annexA: AnnexAHospital[], annexB: AnnexBDepartment[]): string {
  return createHash('sha256').update(canonicalJson({ annex_a: annexA, annex_b: annexB }), 'utf8').digest('hex')
}

/** "2 h 40", "45 min" */
export function formatRoadMinutes(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || !Number.isFinite(minutes)) return ''
  const total = Math.max(0, Math.round(minutes))
  const hours = Math.floor(total / 60)
  const rest = total % 60
  if (hours === 0) return `${rest} min`
  return rest === 0 ? `${hours} h` : `${hours} h ${String(rest).padStart(2, '0')}`
}

export function defaultZoneName(executiveName: string, lineName: string): string {
  return `${executiveName} – ${lineName}`
}

// ---------------------------------------------------------------------------
// Regla de mayoría (la misma que usa el mapa para colorear territorios)
// ---------------------------------------------------------------------------

interface MajorityInput {
  territory: string
  kam_id: string
  beds: number
}

/**
 * Ganador por territorio (localidad de Bogotá o municipio) con la regla compartida del mapa
 * (lib/territory-rules.ts: más camas, luego más IPS, luego nombre de zona y kam_id).
 * Es la fuente de los territorios CON IPS del Anexo B (igual que el mapa); municipality_zone solo
 * aporta los municipios sin IPS ('reach').
 */
export function majorityWinners(items: MajorityInput[], nameOf?: ZoneNameLookup): Map<string, string> {
  const winners = new Map<string, string>()
  computeTerritoryWinners(items, item => item.territory, nameOf).forEach((winner, territory) => {
    winners.set(territory, winner.kam_id)
  })
  return winners
}

// ---------------------------------------------------------------------------
// Carga de datos (solo lectura)
// ---------------------------------------------------------------------------

interface HospitalRow {
  id: string
  code: string | null
  name: string | null
  municipality_id: string | null
  locality_id: string | null
  department_id: string | null
  municipality_name: string | null
  department_name: string | null
  locality_name: string | null
  beds: number | null
}

interface AssignmentRow {
  hospital_id: string
  kam_id: string
}

interface MunicipalityRow {
  code: string
  name: string | null
  department_code: string | null
}

interface DepartmentRow {
  code: string
  name: string | null
}

interface MunicipalityZoneRow {
  municipality_code: string
  kam_id: string | null
  kind: string
  travel_minutes: number | null
  ips_count: number | null
}

interface ExecutiveRow {
  id: string
  full_name: string
  status: string
  color: string | null
  user_id: string | null
}

interface LineRow {
  id: string
  code: string
  name: string
  max_reach_minutes: number
}

interface TerritoryContext {
  line: LineRow
  /** executive_id → zonas que cubre en la línea */
  zonesByExecutive: Map<string, TerritoryZone[]>
  executives: Map<string, ExecutiveRow>
  /** Ejecutivos que llevan la línea (executive_lines), activos o por contratar */
  lineExecutiveIds: string[]
  hospitals: Map<string, HospitalRow>
  /** hospital_id → kam_id (una sola zona por IPS) */
  assignmentByHospital: Map<string, string>
  municipalities: Map<string, MunicipalityRow>
  departments: Map<string, string>
  /** null = la tabla no existe (migración sin aplicar) */
  municipalityZone: MunicipalityZoneRow[] | null
  /** null = la tabla no existe */
  names: Map<string, string> | null
  /** territorio (localidad o municipio) → zona ganadora por mayoría */
  winners: Map<string, string>
  /** territorio → IPS activas asignadas */
  ipsCountByTerritory: Map<string, number>
  /** localidad de Bogotá (7 dígitos) → { nombre, departamento } */
  localities: Map<string, { name: string | null; department_name: string | null }>
}

async function loadLineById(lineId: string, db: SupabaseAdminClient): Promise<LineRow | null> {
  const { data, error } = await db
    .from('business_lines')
    .select('id, code, name, max_reach_minutes')
    .eq('id', lineId)
    .limit(1)
  if (error) throw new Error(`Error leyendo business_lines: ${error.message}`)
  return data && data.length > 0 ? (data[0] as LineRow) : null
}

function territoryOf(hospital: HospitalRow): string | null {
  const locality = (hospital.locality_id || '').trim()
  if (locality) return locality
  const municipality = (hospital.municipality_id || '').trim()
  return municipality || null
}

async function loadTerritoryContext(line: LineRow, db: SupabaseAdminClient): Promise<TerritoryContext> {
  const [coverage, executiveLinks, hospitals, assignments, municipalities, departments, municipalityZone, names] =
    await Promise.all([
      loadCoverageResponse(
        { id: line.id, code: line.code, name: line.name, max_reach_minutes: line.max_reach_minutes } as CoverageLineInfo,
        db
      ),
      fetchAll<{ executive_id: string }>('executive_lines', (from, to) =>
        db.from('executive_lines').select('executive_id').eq('line_id', line.id).order('executive_id').range(from, to)
      ),
      fetchAll<HospitalRow & { active: boolean }>('hospitals', (from, to) =>
        db
          .from('hospitals')
          .select(
            'id, code, name, municipality_id, locality_id, department_id, municipality_name, department_name, locality_name, beds, active'
          )
          .eq('active', true)
          .order('id')
          .range(from, to)
      ),
      fetchAll<AssignmentRow>('assignments', (from, to) =>
        db.from('assignments').select('hospital_id, kam_id').order('hospital_id').order('kam_id').range(from, to)
      ),
      fetchAll<MunicipalityRow>('municipalities', (from, to) =>
        db.from('municipalities').select('code, name, department_code').order('code').range(from, to)
      ),
      fetchAll<DepartmentRow>('departments', (from, to) =>
        db.from('departments').select('code, name').order('code').range(from, to)
      ),
      fetchAllOptional<MunicipalityZoneRow>('municipality_zone', (from, to) =>
        db
          .from('municipality_zone')
          .select('municipality_code, kam_id, kind, travel_minutes, ips_count')
          .order('municipality_code')
          .range(from, to)
      ),
      fetchAllOptional<{ executive_id: string; name: string }>('line_territory_names', (from, to) =>
        db
          .from('line_territory_names')
          .select('executive_id, name')
          .eq('line_id', line.id)
          .order('executive_id')
          .range(from, to)
      ),
    ])

  // Zonas por ejecutivo (solo zonas activas: loadCoverageResponse ya filtra)
  const zonesByExecutive = new Map<string, TerritoryZone[]>()
  for (const row of coverage.rows) {
    if (!row.executive) continue
    if (row.kind !== 'local' && row.kind !== 'reach' && row.kind !== 'manual') continue
    const list = zonesByExecutive.get(row.executive.id) || []
    list.push({ kam_id: row.kam_id, name: zoneDisplayName(row.zone_name), base_city: row.base_city, kind: row.kind })
    zonesByExecutive.set(row.executive.id, list)
  }
  zonesByExecutive.forEach(list => list.sort((a, b) => compareText(a.name, b.name) || a.kam_id.localeCompare(b.kam_id)))

  const lineExecutiveIds = Array.from(new Set(executiveLinks.map(link => link.executive_id)))
  const executiveIds = Array.from(new Set([...lineExecutiveIds, ...Array.from(zonesByExecutive.keys())]))
  const executives = new Map<string, ExecutiveRow>()
  if (executiveIds.length > 0) {
    const { data, error } = await db
      .from('executives')
      .select('id, full_name, status, color, user_id')
      .in('id', executiveIds)
    if (error) throw new Error(`Error leyendo executives: ${error.message}`)
    for (const executive of (data || []) as ExecutiveRow[]) executives.set(executive.id, executive)
  }

  const hospitalMap = new Map<string, HospitalRow>()
  for (const hospital of hospitals) hospitalMap.set(hospital.id, hospital)

  // Una zona por IPS (si hubiera filas repetidas, gana la primera en orden estable)
  const assignmentByHospital = new Map<string, string>()
  for (const assignment of assignments) {
    if (!hospitalMap.has(assignment.hospital_id)) continue // solo IPS activas
    if (!assignmentByHospital.has(assignment.hospital_id)) assignmentByHospital.set(assignment.hospital_id, assignment.kam_id)
  }

  const majorityItems: MajorityInput[] = []
  const ipsCountByTerritory = new Map<string, number>()
  assignmentByHospital.forEach((kamId, hospitalId) => {
    const hospital = hospitalMap.get(hospitalId)!
    const territory = territoryOf(hospital)
    if (!territory) return
    majorityItems.push({ territory, kam_id: kamId, beds: hospital.beds || 0 })
    ipsCountByTerritory.set(territory, (ipsCountByTerritory.get(territory) || 0) + 1)
    // Bogotá: también cuenta en el municipio 11001 (para ips_count del municipio)
    if (territory.length === 7 && hospital.municipality_id && hospital.municipality_id !== territory) {
      ipsCountByTerritory.set(hospital.municipality_id, (ipsCountByTerritory.get(hospital.municipality_id) || 0) + 1)
    }
  })

  const localities = new Map<string, { name: string | null; department_name: string | null }>()
  for (const hospital of hospitals) {
    const locality = (hospital.locality_id || '').trim()
    if (locality.length === 7 && !localities.get(locality)?.name) {
      localities.set(locality, { name: hospital.locality_name, department_name: hospital.department_name })
    }
  }

  // Nombres de zona para el desempate alfabético de la regla de mayoría
  const zoneNameById = new Map<string, string>()
  for (const row of coverage.rows) zoneNameById.set(row.kam_id, zoneDisplayName(row.zone_name))

  const municipalityMap = new Map<string, MunicipalityRow>()
  for (const municipality of municipalities) municipalityMap.set(municipality.code, municipality)
  const departmentMap = new Map<string, string>()
  for (const department of departments) departmentMap.set(department.code, department.name || department.code)

  return {
    line,
    zonesByExecutive,
    executives,
    lineExecutiveIds,
    hospitals: hospitalMap,
    assignmentByHospital,
    municipalities: municipalityMap,
    departments: departmentMap,
    municipalityZone,
    names: names ? new Map(names.map(row => [row.executive_id, row.name])) : null,
    winners: majorityWinners(majorityItems, kamId => zoneNameById.get(kamId)),
    ipsCountByTerritory,
    localities,
  }
}

// ---------------------------------------------------------------------------
// Construcción del territorio
// ---------------------------------------------------------------------------

function departmentName(ctx: TerritoryContext, code: string | null | undefined, fallback?: string | null): string {
  const key = (code || '').trim()
  return (key && ctx.departments.get(key)) || fallback || key || 'Sin departamento'
}

function buildFromContext(ctx: TerritoryContext, executive: ExecutiveRow): Territory {
  const zones = ctx.zonesByExecutive.get(executive.id) || []
  const zoneIds = new Set(zones.map(zone => zone.kam_id))

  // Anexo A
  const annexA: AnnexAHospital[] = []
  ctx.assignmentByHospital.forEach((kamId, hospitalId) => {
    if (!zoneIds.has(kamId)) return
    const hospital = ctx.hospitals.get(hospitalId)!
    const municipalityCode = (hospital.municipality_id || '').trim() || null
    const localityCode = (hospital.locality_id || '').trim() || null
    const baseMunicipality =
      hospital.municipality_name || (municipalityCode ? ctx.municipalities.get(municipalityCode)?.name : null) || ''
    const municipality =
      localityCode && hospital.locality_name ? `${baseMunicipality} · ${hospital.locality_name}`.trim() : baseMunicipality
    annexA.push({
      code: hospital.code || hospital.id,
      name: hospital.name || '',
      municipality,
      department: departmentName(
        ctx,
        hospital.department_id || (municipalityCode ? municipalityCode.slice(0, 2) : null),
        hospital.department_name
      ),
      beds: hospital.beds || 0,
      kam_id: kamId,
      municipality_code: localityCode || municipalityCode,
    })
  })
  annexA.sort(
    (a, b) =>
      compareText(a.department, b.department) ||
      compareText(a.municipality, b.municipality) ||
      compareText(a.name, b.name) ||
      a.code.localeCompare(b.code)
  )

  // Anexo B
  const reachPending = !ctx.municipalityZone || ctx.municipalityZone.length === 0
  type Entry = AnnexBMunicipality & { department: string }
  const entries: Entry[] = []

  const municipalityEntry = (
    code: string,
    kind: TerritoryMunicipalityKind,
    ipsCount: number,
    travelMinutes: number | null
  ): Entry => {
    const municipality = ctx.municipalities.get(code)
    return {
      code,
      name: municipality?.name || code,
      kind,
      ips_count: ipsCount,
      travel_minutes: travelMinutes,
      department: departmentName(ctx, municipality?.department_code || code.slice(0, 2)),
    }
  }

  // Misma precedencia que el mapa (MapComponent.resolveTerritory): las IPS activas asignadas HOY
  // mandan sobre lo guardado en municipality_zone (que puede estar desactualizada si se recalcularon
  // asignaciones); municipality_zone solo aporta los municipios SIN IPS ('reach').
  const zoneRowByCode = new Map((ctx.municipalityZone || []).map(row => [row.municipality_code, row]))

  // 1. Territorios con IPS ganados por mayoría (localidades de Bogotá y municipios)
  ctx.winners.forEach((kamId, territory) => {
    if (!zoneIds.has(kamId)) return
    if (territory.length === 7) {
      const sample = ctx.localities.get(territory)
      entries.push({
        code: territory,
        name: sample?.name ? `${sample.name} (Bogotá)` : territory,
        kind: 'ips',
        ips_count: ctx.ipsCountByTerritory.get(territory) || 0,
        travel_minutes: null,
        department: departmentName(ctx, '11', sample?.department_name),
      })
      return
    }
    if (territory === BOGOTA_CODE) return // Bogotá va por localidades
    const stored = zoneRowByCode.get(territory)
    entries.push(
      municipalityEntry(
        territory,
        'ips',
        ctx.ipsCountByTerritory.get(territory) || 0,
        stored && stored.kam_id === kamId ? stored.travel_minutes ?? null : null
      )
    )
  })

  // 2. Municipios SIN IPS asignadas hoy, de alcance por tiempo real de carretera (municipality_zone).
  //    Una fila 'ips' sin IPS vigentes (tabla desactualizada) cuenta como alcance de esa zona, igual
  //    que en el mapa.
  if (!reachPending) {
    for (const row of ctx.municipalityZone!) {
      if (!row.kam_id || !zoneIds.has(row.kam_id)) continue
      if (row.kind !== 'ips' && row.kind !== 'reach') continue
      if (row.municipality_code === BOGOTA_CODE) continue
      if (ctx.winners.has(row.municipality_code)) continue // con IPS hoy: manda la mayoría (paso 1)
      entries.push(municipalityEntry(row.municipality_code, 'reach', 0, row.travel_minutes ?? null))
    }
  }

  // 3. Municipios/localidades donde este ejecutivo tiene IPS en el Anexo A pero otra zona gana la
  //    mayoría (p. ej. Sogamoso): también hay que visitarlos, así que van como "Con IPS" con el
  //    número de IPS de ESTE ejecutivo. Así el Anexo B siempre cubre todo el Anexo A.
  const ownIpsByTerritory = new Map<string, number>()
  for (const hospital of annexA) {
    if (!hospital.municipality_code) continue
    ownIpsByTerritory.set(hospital.municipality_code, (ownIpsByTerritory.get(hospital.municipality_code) || 0) + 1)
  }
  const listed = new Set(entries.map(entry => entry.code))
  ownIpsByTerritory.forEach((count, territory) => {
    if (listed.has(territory)) return
    if (territory.length === 7) {
      const sample = ctx.localities.get(territory)
      entries.push({
        code: territory,
        name: sample?.name ? `${sample.name} (Bogotá)` : territory,
        kind: 'ips',
        ips_count: count,
        travel_minutes: null,
        department: departmentName(ctx, '11', sample?.department_name),
      })
      return
    }
    entries.push(municipalityEntry(territory, 'ips', count, null))
  })

  const byDepartment = new Map<string, AnnexBMunicipality[]>()
  for (const { department, ...municipality } of entries) {
    const list = byDepartment.get(department) || []
    if (!list.some(item => item.code === municipality.code)) list.push(municipality)
    byDepartment.set(department, list)
  }
  const annexB: AnnexBDepartment[] = Array.from(byDepartment.entries())
    .sort(([a], [b]) => compareText(a, b))
    .map(([department, municipalities]) => ({
      department,
      municipalities: municipalities.sort(
        (a, b) =>
          (a.kind === b.kind ? 0 : a.kind === 'ips' ? -1 : 1) || compareText(a.name, b.name) || a.code.localeCompare(b.code)
      ),
    }))

  const flat = annexB.flatMap(group => group.municipalities)
  const summary: TerritorySummary = {
    zones: zones.length,
    municipalities_ips: flat.filter(item => item.kind === 'ips').length,
    municipalities_reach: flat.filter(item => item.kind === 'reach').length,
    hospitals: annexA.length,
    beds: annexA.reduce((sum, hospital) => sum + hospital.beds, 0),
  }

  const customName = ctx.names?.get(executive.id)?.trim()
  return {
    line: { id: ctx.line.id, code: ctx.line.code, name: ctx.line.name },
    executive: { id: executive.id, full_name: executive.full_name, status: executive.status, color: executive.color ?? null },
    zone_name: customName || defaultZoneName(executive.full_name, ctx.line.name),
    zone_name_is_custom: Boolean(customName),
    zones,
    annex_a: annexA,
    annex_b: annexB,
    summary,
    reach_pending: reachPending,
    pending_municipalities: (ctx.municipalityZone || []).filter(row => row.kind === 'pending').length,
    content_hash: territoryContentHash(annexA, annexB),
    generated_at: new Date().toISOString(),
  }
}

/**
 * Territorio de un Ejecutivo Comercial en una línea. null si la línea no existe o el ejecutivo
 * no lleva la línea ni cubre ninguna zona en ella.
 */
export async function buildTerritory(
  lineId: string,
  executiveId: string,
  db: SupabaseAdminClient = supabaseAdmin
): Promise<Territory | null> {
  const line = await loadLineById(lineId, db)
  if (!line) return null
  const ctx = await loadTerritoryContext(line, db)
  const executive = ctx.executives.get(executiveId)
  if (!executive) return null
  if (!ctx.lineExecutiveIds.includes(executiveId) && !ctx.zonesByExecutive.has(executiveId)) return null
  return buildFromContext(ctx, executive)
}

/**
 * Territorios de todos los ejecutivos de la línea (activos o por contratar, o que cubran alguna
 * zona). `onlyExecutiveIds` = null → todos; si no, solo esos.
 */
export async function buildLineTerritories(
  lineId: string,
  onlyExecutiveIds: Set<string> | null,
  db: SupabaseAdminClient = supabaseAdmin
): Promise<{ territories: Territory[]; reach_pending: boolean; pending_municipalities: number; storage_ready: boolean } | null> {
  const line = await loadLineById(lineId, db)
  if (!line) return null
  const ctx = await loadTerritoryContext(line, db)
  const candidates = new Set([...ctx.lineExecutiveIds, ...Array.from(ctx.zonesByExecutive.keys())])
  const territories: Territory[] = []
  candidates.forEach(executiveId => {
    if (onlyExecutiveIds && !onlyExecutiveIds.has(executiveId)) return
    const executive = ctx.executives.get(executiveId)
    if (!executive) return
    const covers = ctx.zonesByExecutive.has(executiveId)
    if (!covers && !ELIGIBLE_STATUSES.includes(executive.status)) return
    territories.push(buildFromContext(ctx, executive))
  })
  territories.sort(
    (a, b) => compareText(a.executive.full_name, b.executive.full_name) || a.executive.id.localeCompare(b.executive.id)
  )
  return {
    territories,
    reach_pending: !ctx.municipalityZone || ctx.municipalityZone.length === 0,
    pending_municipalities: (ctx.municipalityZone || []).filter(row => row.kind === 'pending').length,
    storage_ready: ctx.municipalityZone !== null && ctx.names !== null,
  }
}

// ---------------------------------------------------------------------------
// Acceso
// ---------------------------------------------------------------------------

export interface TerritoryAccess {
  line: TerritoryLineRef
  role: MeLineRole
  /** null = puede ver a todos los ejecutivos de la línea; si no, solo estos (los suyos). */
  executiveIds: Set<string> | null
}

/**
 * Quién ve qué (además del permiso territory:view, que valida la ruta):
 *  - map:all-lines (admin, dirección comercial, datos, visualizador) → cualquier línea y ejecutivo.
 *  - líder de la línea → todos los ejecutivos de SU línea.
 *  - ejecutivo enlazado (executives.user_id = usuario) → solo su propio territorio.
 * null si la línea no existe o el usuario no tiene acceso.
 */
export async function resolveTerritoryAccess(
  user: CoverageUser,
  ref: { code?: string | null; id?: string | null },
  db: SupabaseAdminClient = supabaseAdmin
): Promise<TerritoryAccess | null> {
  const me = await resolveUserLines(user, db)
  const code = (ref.code || '').trim().toLowerCase()
  const id = (ref.id || '').trim().toLowerCase()
  const line = me.lines.find(item => (code && item.code === code) || (id && item.id === id))
  if (!line) return null

  if (line.role === 'all' || line.role === 'leader') {
    return { line: { id: line.id, code: line.code, name: line.name }, role: line.role, executiveIds: null }
  }

  const { data, error } = await db.from('executives').select('id').eq('user_id', user.id)
  if (error) throw new Error(`Error leyendo executives: ${error.message}`)
  return {
    line: { id: line.id, code: line.code, name: line.name },
    role: line.role,
    executiveIds: new Set((data || []).map(row => row.id as string)),
  }
}

export function canSeeExecutive(access: TerritoryAccess, executiveId: string): boolean {
  return access.executiveIds === null || access.executiveIds.has(executiveId.toLowerCase())
}

/**
 * Gestionar la línea (guardar versiones, renombrar zonas): el permiso indicado y, si el rol no ve
 * todas las líneas (line_leader), ser el líder de esa línea.
 */
export async function canManageTerritoryLine(
  user: CoverageUser,
  lineId: string,
  permission: Permission,
  db: SupabaseAdminClient = supabaseAdmin
): Promise<boolean> {
  if (!hasPermission(user.role, permission)) return false
  if (hasPermission(user.role, 'map:all-lines')) return true
  return isLineLeader(user, lineId, db)
}

// ---------------------------------------------------------------------------
// Versiones (territory_snapshots, inmutables)
// ---------------------------------------------------------------------------

const SNAPSHOT_LIST_SELECT = 'id, line_id, executive_id, version_label, note, created_by, created_at, content_hash, summary'

type SnapshotDbRow = Omit<TerritorySnapshotListItem, 'created_by_name'> & {
  annex_a?: AnnexAHospital[]
  annex_b?: AnnexBDepartment[]
}

async function attachCreatorNames<T extends { created_by: string | null }>(
  rows: T[],
  db: SupabaseAdminClient
): Promise<Array<T & { created_by_name: string | null }>> {
  const ids = Array.from(new Set(rows.map(row => row.created_by).filter((id): id is string => Boolean(id))))
  const names = new Map<string, string>()
  if (ids.length > 0) {
    const { data, error } = await db.from('users').select('id, full_name, email').in('id', ids)
    if (error) throw new Error(`Error leyendo users: ${error.message}`)
    for (const user of (data || []) as Array<{ id: string; full_name: string | null; email: string | null }>) {
      names.set(user.id, user.full_name || user.email || '')
    }
  }
  return rows.map(row => ({ ...row, created_by_name: row.created_by ? names.get(row.created_by) ?? null : null }))
}

export type SnapshotResult<T> = { ok: true; value: T } | { ok: false; status: number; error: string }

export async function listSnapshots(
  lineId: string,
  executiveId: string,
  db: SupabaseAdminClient = supabaseAdmin
): Promise<SnapshotResult<TerritorySnapshotListItem[]>> {
  const { data, error } = await db
    .from('territory_snapshots')
    .select(SNAPSHOT_LIST_SELECT)
    .eq('line_id', lineId)
    .eq('executive_id', executiveId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: true })
    .range(0, 499)
  if (error) {
    if (isMissingTableError(error)) return { ok: false, status: 503, error: MIGRATION_PENDING_MESSAGE }
    throw new Error(`Error leyendo territory_snapshots: ${error.message}`)
  }
  return { ok: true, value: await attachCreatorNames((data || []) as SnapshotDbRow[], db) }
}

export async function getSnapshot(
  id: string,
  db: SupabaseAdminClient = supabaseAdmin
): Promise<SnapshotResult<TerritorySnapshot | null>> {
  const { data, error } = await db
    .from('territory_snapshots')
    .select(`${SNAPSHOT_LIST_SELECT}, annex_a, annex_b`)
    .eq('id', id)
    .limit(1)
  if (error) {
    if (isMissingTableError(error)) return { ok: false, status: 503, error: MIGRATION_PENDING_MESSAGE }
    throw new Error(`Error leyendo territory_snapshots: ${error.message}`)
  }
  const row = data && data.length > 0 ? (data[0] as SnapshotDbRow) : null
  if (!row) return { ok: true, value: null }
  const [withName] = await attachCreatorNames([row], db)
  return {
    ok: true,
    value: {
      ...withName,
      annex_a: Array.isArray(row.annex_a) ? row.annex_a : [],
      annex_b: Array.isArray(row.annex_b) ? row.annex_b : [],
    },
  }
}

/** Crea la versión inmutable del territorio vigente. 409 si la etiqueta ya existe. */
export async function createSnapshot(
  input: { lineId: string; executiveId: string; versionLabel: string; note: string | null; userId: string },
  db: SupabaseAdminClient = supabaseAdmin
): Promise<SnapshotResult<TerritorySnapshot>> {
  const territory = await buildTerritory(input.lineId, input.executiveId, db)
  if (!territory) return { ok: false, status: 404, error: 'El Ejecutivo Comercial no lleva esta línea' }

  const summary: TerritorySnapshotSummary = {
    ...territory.summary,
    zone_name: territory.zone_name,
    line_name: territory.line.name,
    line_code: territory.line.code,
    executive_name: territory.executive.full_name,
    zones_detail: territory.zones,
    reach_pending: territory.reach_pending,
  }

  const { data, error } = await db
    .from('territory_snapshots')
    .insert({
      id: randomUUID(),
      line_id: input.lineId,
      executive_id: input.executiveId,
      version_label: input.versionLabel,
      note: input.note,
      created_by: input.userId,
      summary,
      annex_a: territory.annex_a,
      annex_b: territory.annex_b,
      content_hash: territory.content_hash,
    })
    .select(`${SNAPSHOT_LIST_SELECT}, annex_a, annex_b`)
    .limit(1)
  if (error) {
    if (isMissingTableError(error)) return { ok: false, status: 503, error: MIGRATION_PENDING_MESSAGE }
    if (error.code === '23505') {
      return { ok: false, status: 409, error: `Ya existe una versión "${input.versionLabel}" para este Ejecutivo Comercial` }
    }
    throw new Error(`Error guardando territory_snapshots: ${error.message}`)
  }
  const row = data && data.length > 0 ? (data[0] as SnapshotDbRow) : null
  if (!row) throw new Error('El guardado de la versión no devolvió la fila creada')
  const [withName] = await attachCreatorNames([row], db)
  return { ok: true, value: { ...withName, annex_a: territory.annex_a, annex_b: territory.annex_b } }
}

/** Diferencias entre una versión guardada y el territorio vigente. */
export function diffTerritory(
  snapshot: { annex_a: AnnexAHospital[]; annex_b: AnnexBDepartment[]; content_hash: string },
  current: Pick<Territory, 'annex_a' | 'annex_b' | 'content_hash'>
): TerritoryDiff {
  const flattenMunicipalities = (groups: AnnexBDepartment[]) => {
    const map = new Map<string, TerritoryDiffMunicipality>()
    for (const group of groups || []) {
      for (const municipality of group.municipalities || []) {
        map.set(municipality.code, {
          code: municipality.code,
          name: municipality.name,
          department: group.department,
          kind: municipality.kind,
        })
      }
    }
    return map
  }
  const hospitalsByCode = (rows: AnnexAHospital[]) => {
    const map = new Map<string, TerritoryDiffHospital>()
    for (const row of rows || []) {
      map.set(row.code, { code: row.code, name: row.name, municipality: row.municipality, department: row.department })
    }
    return map
  }

  const before = flattenMunicipalities(snapshot.annex_b)
  const after = flattenMunicipalities(current.annex_b)
  const beforeHospitals = hospitalsByCode(snapshot.annex_a)
  const afterHospitals = hospitalsByCode(current.annex_a)

  const sortMunicipalities = (list: TerritoryDiffMunicipality[]) =>
    list.sort((a, b) => compareText(a.department, b.department) || compareText(a.name, b.name))
  const sortHospitals = (list: TerritoryDiffHospital[]) =>
    list.sort((a, b) => compareText(a.department, b.department) || compareText(a.municipality, b.municipality) || compareText(a.name, b.name))

  return {
    added_municipalities: sortMunicipalities(Array.from(after.values()).filter(item => !before.has(item.code))),
    removed_municipalities: sortMunicipalities(Array.from(before.values()).filter(item => !after.has(item.code))),
    added_hospitals: sortHospitals(Array.from(afterHospitals.values()).filter(item => !beforeHospitals.has(item.code))),
    removed_hospitals: sortHospitals(Array.from(beforeHospitals.values()).filter(item => !afterHospitals.has(item.code))),
    snapshot_hash: snapshot.content_hash,
    current_hash: current.content_hash,
    unchanged: snapshot.content_hash === current.content_hash,
  }
}

// ---------------------------------------------------------------------------
// Nombre comercial de la zona (line_territory_names)
// ---------------------------------------------------------------------------

export async function saveTerritoryName(
  input: { lineId: string; executiveId: string; name: string; userId: string },
  db: SupabaseAdminClient = supabaseAdmin
): Promise<SnapshotResult<{ name: string }>> {
  const { error } = await db.from('line_territory_names').upsert(
    {
      line_id: input.lineId,
      executive_id: input.executiveId,
      name: input.name,
      updated_by: input.userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'line_id,executive_id' }
  )
  if (error) {
    if (isMissingTableError(error)) return { ok: false, status: 503, error: MIGRATION_PENDING_MESSAGE }
    if (error.code === '23503') return { ok: false, status: 404, error: 'Línea o Ejecutivo Comercial no encontrado' }
    throw new Error(`Error guardando line_territory_names: ${error.message}`)
  }
  return { ok: true, value: { name: input.name } }
}

// ---------------------------------------------------------------------------
// CSV (Excel en español: UTF-8 con BOM, separador ";", CRLF)
// ---------------------------------------------------------------------------

function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : ''
  let text = String(value)
  // Evita que Excel interprete el texto como fórmula (inyección CSV)
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
  if (/[";\r\n]/.test(text) || text !== text.trim()) text = `"${text.replace(/"/g, '""')}"`
  return text
}

function csvLine(cells: Array<string | number | null | undefined>): string {
  return cells.map(csvCell).join(';')
}

const MUNICIPALITY_KIND_LABEL: Record<TerritoryMunicipalityKind, string> = {
  ips: 'Con IPS objetivo (visitar)',
  reach: 'De alcance (sin IPS hoy)',
}

export function buildAnnexCsv(territory: Territory, annex: 'a' | 'b'): string {
  const zoneNames = new Map(territory.zones.map(zone => [zone.kam_id, zone.name]))
  const lines: string[] = []
  if (annex === 'a') {
    lines.push(csvLine(['Código IPS', 'IPS', 'Municipio', 'Departamento', 'Camas', 'Zona']))
    for (const hospital of territory.annex_a) {
      lines.push(
        csvLine([
          hospital.code,
          hospital.name,
          hospital.municipality,
          hospital.department,
          hospital.beds,
          zoneNames.get(hospital.kam_id) || '',
        ])
      )
    }
  } else {
    lines.push(
      csvLine(['Departamento', 'Código DANE', 'Municipio', 'Tipo', 'IPS objetivo', 'Tiempo por carretera (min)', 'Tiempo por carretera'])
    )
    for (const group of territory.annex_b) {
      for (const municipality of group.municipalities) {
        lines.push(
          csvLine([
            group.department,
            municipality.code,
            municipality.name,
            MUNICIPALITY_KIND_LABEL[municipality.kind] || municipality.kind,
            municipality.ips_count,
            municipality.travel_minutes,
            formatRoadMinutes(municipality.travel_minutes),
          ])
        )
      }
    }
  }
  return `﻿${lines.join('\r\n')}\r\n`
}

/** Nombre de archivo ASCII seguro: anexo-a-perossal-maria-perez.csv */
export function annexFileName(territory: Territory, annex: 'a' | 'b'): string {
  const slug = (text: string) =>
    text
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'territorio'
  return `anexo-${annex}-${slug(territory.line.code)}-${slug(territory.executive.full_name)}.csv`
}
