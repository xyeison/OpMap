// Fase 3 · Importador del REPS: parte de servidor (Supabase) de POST /api/hospitals/import/preview
// y /apply. La lógica pura (parseo, columnas, cruce, simulación) está en lib/reps-import.ts.
//
// - Solo admin y data_manager (además de hospitals:edit).
// - La simulación se guarda en hospital_import_jobs (token = id, caduca a los 30 min) con las filas
//   normalizadas de las sedes con cruce; apply la recalcula contra el estado actual y la aplica en UNA
//   transacción con la función SQL reps_import_apply.
// - NUNCA recalcula asignaciones ni llama a Google (las IPS no cambian de ubicación).
import { createHash } from 'crypto'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requirePermission, type AuthResult } from '@/lib/require-role'
import type { SessionUser } from '@/lib/auth-server'
import {
  REPS_FIELDS,
  puedeImportarReps,
  type RepsApplyResponse,
  type RepsColumnMapping,
  type RepsFieldKey,
  type RepsFileKind,
  type RepsImportKind,
  type RepsImportMode,
  type RepsPreviewResponse,
  type ServiceFlags,
} from '@/lib/reps-import-fields'
import {
  RepsImportError,
  buildRawTable,
  decodeTextBuffer,
  detectColumns,
  detectFlagColumns,
  detectKind,
  matchSedes,
  normalizeCapacityRows,
  normalizeServiceRows,
  parseDelimitedText,
  parseWorkbook,
  planImport,
  remapSedeKeys,
  sanitizeMapping,
  type ExistingCapacityRow,
  type ExistingServiceRow,
  type HospitalForImport,
  type ImportPlan,
  type MatchResult,
  type NormalizedImport,
  type RawTable,
  type RepsSedeRef,
} from '@/lib/reps-import'
import { parsePdfToTable } from '@/lib/reps-pdf'
import { fetchAllRows } from './api-error'

export { REPS_IMPORT_ROLES } from '@/lib/reps-import-fields'
const JOB_TTL_MINUTES = 30
const ITEMS_LIMIT = 3000
const IN_CHUNK = 200

/** hospitals:edit y además un papel admin o data_manager en la empresa activa (contract_manager no importa del REPS). */
export async function requireRepsImportUser(request: Request): Promise<AuthResult> {
  const auth = await requirePermission(request, 'hospitals:edit')
  if (!auth.ok) return auth
  if (!puedeImportarReps(auth.user.papeles)) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Solo administradores y gestores de datos pueden importar del REPS' }, { status: 403 }),
    }
  }
  return auth
}

// =========================================================================================
// Archivo → tabla
// =========================================================================================

/** Tipo real del archivo por su contenido (y la extensión como pista para texto/HTML). */
export function detectFileKind(fileName: string, bytes: Uint8Array): RepsFileKind | null {
  const head = Array.from(bytes.subarray(0, 8))
  const lower = fileName.toLowerCase()
  if (head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46) return 'pdf' // %PDF
  if (head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04) return 'xlsx' // ZIP
  if (head[0] === 0xd0 && head[1] === 0xcf && head[2] === 0x11 && head[3] === 0xe0) return 'xls' // OLE2
  const sample = new TextDecoder('latin1').decode(bytes.subarray(0, 2048)).toLowerCase()
  if (/\.xlsx?$/.test(lower) && (sample.includes('<table') || sample.includes('<html'))) return 'xls' // "Excel" en HTML
  if (bytes.subarray(0, 2048).includes(0) && !(head[0] === 0xff && head[1] === 0xfe) && !(head[0] === 0xfe && head[1] === 0xff)) return null
  return 'csv'
}

export async function buildTableFromFile(
  fileKind: RepsFileKind,
  bytes: Uint8Array
): Promise<{ table: RawTable; headerDetected: boolean; warnings: string[] }> {
  if (fileKind === 'pdf') return parsePdfToTable(bytes)
  if (fileKind === 'xlsx' || fileKind === 'xls') {
    const workbook = parseWorkbook(bytes)
    const built = buildRawTable(workbook.rows, workbook.sheetName)
    return { ...built, warnings: [] }
  }
  const text = decodeTextBuffer(bytes)
  const built = buildRawTable(parseDelimitedText(text))
  return { ...built, warnings: [] }
}

const REQUIRED_LABEL: Record<RepsFieldKey, string> = Object.fromEntries(REPS_FIELDS.map(f => [f.key, f.label])) as Record<RepsFieldKey, string>

function missingFieldsFor(kind: RepsImportKind, mapping: RepsColumnMapping): string[] {
  const has = (field: RepsFieldKey) => mapping[field] !== undefined && mapping[field] !== null
  const missing: string[] = []
  if (!has('repsCode') && !has('nit')) missing.push(`${REQUIRED_LABEL.repsCode} o ${REQUIRED_LABEL.nit}`)
  if (kind === 'servicios' && !has('serviceCode') && !has('serviceName')) missing.push(`${REQUIRED_LABEL.serviceName} o ${REQUIRED_LABEL.serviceCode}`)
  if (kind === 'capacidad') {
    if (!has('concept')) missing.push(REQUIRED_LABEL.concept)
    if (!has('quantity')) missing.push(REQUIRED_LABEL.quantity)
  }
  return missing
}

// =========================================================================================
// Estado de la base
// =========================================================================================

const HOSPITAL_COLUMNS = 'id, code, name, active, municipality_id, municipality_name, service_flags, reps_services_count, quirofanos, reps_beds'
// nit y reps_code llegan con la migración 0600 (D1, cruce con reps_sedes); sin ella se deriva el NIT de code
const HOSPITAL_COLUMNS_WITH_REPS = `${HOSPITAL_COLUMNS}, nit, reps_code`

const isUndefinedColumn = (error: unknown) => {
  const e = error as { code?: string; message?: string } | null
  return e?.code === '42703' || /column .* does not exist/i.test(e?.message || '')
}
const isMissingTable = (error: unknown) => {
  const e = error as { code?: string; message?: string } | null
  return e?.code === '42P01' || e?.code === 'PGRST205' || /does not exist|could not find the table/i.test(e?.message || '')
}

function chunk<T>(items: T[], size = IN_CHUNK): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

/** Ejecuta `run` sobre cada parte con a lo sumo `limit` consultas a la vez (archivos con miles de sedes). */
async function mapLimit<T, R>(items: T[], limit: number, run: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++
      results[index] = await run(items[index])
    }
  })
  await Promise.all(workers)
  return results
}

const QUERY_CONCURRENCY = 6

async function loadHospitals(): Promise<HospitalForImport[]> {
  const run = (columns: string) =>
    fetchAllRows<Record<string, unknown>>((from, to) => supabaseAdmin.from('hospitals').select(columns).order('id').range(from, to) as any)
  let result = await run(HOSPITAL_COLUMNS_WITH_REPS)
  if (result.error && isUndefinedColumn(result.error)) result = await run(HOSPITAL_COLUMNS)
  if (result.error) throw result.error
  return result.data.map(row => ({
    id: String(row.id),
    name: String(row.name ?? ''),
    code: String(row.code ?? ''),
    active: row.active === true,
    municipality_id: (row.municipality_id as string | null) ?? null,
    municipality_name: (row.municipality_name as string | null) ?? null,
    nit: typeof row.nit === 'string' ? row.nit : null,
    reps_code: typeof row.reps_code === 'string' ? row.reps_code : null,
    service_flags: row.service_flags && typeof row.service_flags === 'object' ? (row.service_flags as ServiceFlags) : null,
    reps_services_count: typeof row.reps_services_count === 'number' ? row.reps_services_count : null,
    quirofanos: typeof row.quirofanos === 'number' ? row.quirofanos : null,
    reps_beds: typeof row.reps_beds === 'number' ? row.reps_beds : null,
  }))
}

interface RepsSedesLookup {
  byCode: Map<string, RepsSedeRef>
  byNit: Map<string, RepsSedeRef[]>
  byPrestador: Map<string, RepsSedeRef[]>
  available: boolean
}

function toSedeRef(row: Record<string, unknown>): RepsSedeRef {
  return {
    code: String(row.codigo_habilitacion),
    prestador: String(row.codigo_prestador ?? ''),
    nit: String(row.nit ?? '').trim(),
    municipio: String(row.municipio_sede ?? ''),
    nombreSede: (row.nombre_sede as string | null) ?? null,
  }
}

/** Sedes de reps_sedes (D1) que tocan el archivo: por código, por prestador (10 dígitos) y por NIT. */
async function loadRepsSedes(data: NormalizedImport): Promise<RepsSedesLookup> {
  const lookup: RepsSedesLookup = { byCode: new Map(), byNit: new Map(), byPrestador: new Map(), available: true }
  const sedes = Object.values(data.sedes)
  const codes = sedes.map(s => s.key).filter(k => /^\d{12}$/.test(k))
  const prestadores = sedes.map(s => s.key).filter(k => /^\d{10}$/.test(k))
  const columns = 'codigo_habilitacion, codigo_prestador, nit, municipio_sede, nombre_sede'
  const add = (rows: Record<string, unknown>[]) => {
    rows.forEach(row => {
      const ref = toSedeRef(row)
      if (lookup.byCode.has(ref.code)) return
      lookup.byCode.set(ref.code, ref)
    })
  }
  const query = async (field: string, values: string[]) => {
    if (!lookup.available) return
    const pages = await mapLimit(chunk(values), QUERY_CONCURRENCY, part =>
      // Paginado: PostgREST corta en 1.000 filas y un NIT puede tener muchas sedes
      fetchAllRows<Record<string, unknown>>((from, to) =>
        supabaseAdmin.from('reps_sedes').select(columns).in(field, part).order('codigo_habilitacion').range(from, to) as any
      )
    )
    for (const { data: rows, error } of pages) {
      if (error) {
        if (isMissingTable(error)) {
          lookup.available = false
          return
        }
        throw error
      }
      add(rows)
    }
  }
  await query('codigo_habilitacion', codes)
  if (!lookup.available) return lookup
  await query('codigo_prestador', prestadores)
  const nits = new Set<string>()
  sedes.forEach(s => {
    if (s.nit) nits.add(s.nit)
  })
  lookup.byCode.forEach(ref => {
    if (ref.nit) nits.add(ref.nit)
  })
  await query('nit', Array.from(nits))
  lookup.byCode.forEach(ref => {
    const byNit = lookup.byNit.get(ref.nit) || []
    byNit.push(ref)
    lookup.byNit.set(ref.nit, byNit)
    const byPrestador = lookup.byPrestador.get(ref.prestador) || []
    byPrestador.push(ref)
    lookup.byPrestador.set(ref.prestador, byPrestador)
  })
  return lookup
}

async function loadRowsIn<T>(table: string, columns: string, field: string, values: string[]): Promise<T[]> {
  const pages = await mapLimit(chunk(values), QUERY_CONCURRENCY, part =>
    fetchAllRows<T>((from, to) => supabaseAdmin.from(table).select(columns).in(field, part).order('id').range(from, to) as any)
  )
  const out: T[] = []
  for (const { data, error } of pages) {
    if (error) throw error
    out.push(...data)
  }
  return out
}

interface ImportContext {
  data: NormalizedImport
  hospitals: HospitalForImport[]
  matches: Map<string, MatchResult>
  existingServices: ExistingServiceRow[]
  existingCapacity: ExistingCapacityRow[]
  warnings: string[]
}

/** Carga lo necesario de la base, resuelve sedes de 10 dígitos, cruza y trae las filas ya guardadas. */
async function buildContext(input: NormalizedImport): Promise<ImportContext> {
  const warnings: string[] = []
  const [hospitals, repsSedes] = await Promise.all([loadHospitals(), loadRepsSedes(input)])
  if (!repsSedes.available) {
    warnings.push('No está disponible la tabla reps_sedes: el cruce usa solo el NIT del archivo y los vínculos ya guardados')
  }

  // Código de prestador (10) con una única sede en el REPS → código de la sede (12)
  const remap = new Map<string, string>()
  Object.keys(input.sedes).forEach(key => {
    if (!/^\d{10}$/.test(key)) return
    const sedes = repsSedes.byPrestador.get(key) || []
    if (sedes.length === 1) remap.set(key, sedes[0].code)
  })
  const data = remapSedeKeys(input, remap)
  const keys = Object.keys(data.sedes)

  const table = data.kind === 'servicios' ? 'hospital_services' : 'hospital_capacity'
  const otherTable = data.kind === 'servicios' ? 'hospital_capacity' : 'hospital_services'
  const serviceColumns = 'id, reps_code, hospital_id, service_code, service_name, group_name, modality'
  const capacityColumns = 'id, reps_code, hospital_id, group_name, concept, quantity'
  const columns = data.kind === 'servicios' ? serviceColumns : capacityColumns

  const [byKey, otherLinks] = await Promise.all([
    loadRowsIn<any>(table, columns, 'reps_code', keys),
    loadRowsIn<{ id: string; reps_code: string; hospital_id: string | null }>(otherTable, 'id, reps_code, hospital_id', 'reps_code', keys),
  ])
  const previousLinks = new Map<string, string>()
  ;[...byKey, ...otherLinks].forEach((row: { reps_code: string; hospital_id: string | null }) => {
    if (row.hospital_id) previousLinks.set(row.reps_code, row.hospital_id)
  })

  const matches = matchSedes(Object.values(data.sedes), {
    hospitals,
    repsSedesByCode: repsSedes.byCode,
    repsSedesByNit: repsSedes.byNit,
    previousLinks,
  })

  // Filas guardadas de las IPS con cruce bajo otra sede (se reemplazan en modo "reemplazar")
  const matchedHospitalIds = Array.from(new Set(Array.from(matches.values()).filter(m => m.hospitalId).map(m => m.hospitalId as string)))
  const byHospital = matchedHospitalIds.length > 0 ? await loadRowsIn<any>(table, columns, 'hospital_id', matchedHospitalIds) : []
  const seen = new Set<string>()
  const existing = [...byKey, ...byHospital].filter((row: { id: string }) => (seen.has(row.id) ? false : (seen.add(row.id), true)))

  return {
    data,
    hospitals,
    matches,
    existingServices: data.kind === 'servicios' ? (existing as ExistingServiceRow[]) : [],
    existingCapacity: data.kind === 'capacidad' ? (existing as ExistingCapacityRow[]) : [],
    warnings,
  }
}

function planFromContext(ctx: ImportContext, mode: RepsImportMode, audit?: { fileName?: string; jobId?: string }): ImportPlan {
  return planImport({
    data: ctx.data,
    matches: ctx.matches,
    hospitals: ctx.hospitals,
    existingServices: ctx.existingServices,
    existingCapacity: ctx.existingCapacity,
    mode,
    audit,
  })
}

/** Solo las filas de las sedes indicadas (las que cruzaron): es lo que se guarda en el job. */
function keepSedes(data: NormalizedImport, keys: Set<string>): NormalizedImport {
  const sedes: NormalizedImport['sedes'] = {}
  Object.values(data.sedes).forEach(sede => {
    if (keys.has(sede.key)) sedes[sede.key] = sede
  })
  return {
    ...data,
    sedes,
    services: data.services.filter(s => keys.has(s.key)),
    capacity: data.capacity.filter(c => keys.has(c.key)),
    invalid: [],
  }
}

function planStats(plan: ImportPlan) {
  return {
    matched: plan.stats.matched,
    hospitalsWithChanges: plan.stats.hospitalsWithChanges,
    servicesToUpsert: plan.payload.services_upsert.length,
    servicesToDelete: plan.payload.services_delete.length,
    capacityToUpsert: plan.payload.capacity_upsert.length,
    capacityToDelete: plan.payload.capacity_delete.length,
  }
}

// =========================================================================================
// Preview
// =========================================================================================

export interface PreviewInput {
  user: SessionUser
  fileName: string
  bytes: Uint8Array
  requestedKind: RepsImportKind | 'auto'
  mode: RepsImportMode
  manualMapping: unknown
}

export async function runPreview(input: PreviewInput): Promise<RepsPreviewResponse> {
  const fileKind = detectFileKind(input.fileName, input.bytes)
  if (!fileKind) throw new RepsImportError('Formato no reconocido: sube un Excel (.xlsx/.xls), un CSV o texto separado por ; o , o un PDF con texto')

  const built = await buildTableFromFile(fileKind, input.bytes)
  const table = built.table
  const warnings = [...built.warnings]
  if (!built.headerDetected && fileKind !== 'pdf') {
    warnings.push('No se reconocieron los encabezados: se usó la primera fila. Elige las columnas en el mapeo.')
  }

  const flagColumns = detectFlagColumns(table.headers, table.rows)
  const autoMapping = detectColumns(table.headers, new Set(flagColumns.map(f => f.index)))
  const manual = sanitizeMapping(input.manualMapping, table.headers.length)
  const mapping = manual ?? autoMapping
  const detectedKind = detectKind(autoMapping)
  const kind: RepsImportKind | null = input.requestedKind === 'auto' ? detectKind(mapping) ?? detectedKind : input.requestedKind

  const base = {
    detectedKind,
    mode: input.mode,
    fileKind,
    fileName: input.fileName,
    table: {
      headers: table.headers,
      headerRow: table.headerRow,
      sampleRows: table.rows.slice(0, 5),
      totalRows: table.rows.length,
      sheetName: table.sheetName,
    },
    mapping,
    flagColumns: flagColumns.map(f => ({ index: f.index, header: f.header, meaning: `${f.type === 'modality' ? 'Modalidad' : 'Complejidad'}: ${f.meaning}` })),
  }
  const emptyStats = {
    rowsRead: table.rows.length, validRows: 0, invalidRows: 0, sedes: 0, matched: 0, ambiguous: 0, unmatched: 0,
    hospitalsWithChanges: 0, groupsInFile: [] as string[], servicesToUpsert: 0, servicesToDelete: 0, capacityToUpsert: 0, capacityToDelete: 0,
  }

  const missing = kind ? missingFieldsFor(kind, mapping) : ['Tipo de archivo (servicios o capacidad)']
  if (!kind || missing.length > 0) {
    if (!kind) warnings.push('No se pudo saber si el archivo es de servicios o de capacidad instalada: elige el tipo.')
    return {
      ...base,
      token: '',
      expiresAt: null,
      needsMapping: true,
      missingFields: missing,
      kind: kind ?? 'servicios',
      stats: emptyStats,
      invalidSamples: [],
      items: [],
      itemsTruncated: false,
      warnings,
    }
  }

  const normalized = kind === 'servicios' ? normalizeServiceRows(table, mapping, flagColumns) : normalizeCapacityRows(table, mapping)
  warnings.push(...normalized.warnings)
  if (kind === 'servicios' && normalized.groups && normalized.groups.length === 1 && input.mode === 'replace') {
    warnings.push(`El archivo solo trae el grupo "${normalized.groups[0]}": en modo "reemplazar" solo se retiran servicios de ese grupo.`)
  }
  if (kind === 'servicios' && !normalized.groups && input.mode === 'replace') {
    warnings.push('El archivo no trae el grupo del servicio: en modo "reemplazar" se retiran todos los servicios guardados de las sedes que no estén en el archivo. Si filtraste la consulta por grupo o servicio, usa "Solo añadir".')
  }

  const ctx = await buildContext(normalized)
  warnings.push(...ctx.warnings)
  const plan = planFromContext(ctx, input.mode)
  const matchedKeys = new Set(plan.items.filter(i => i.status === 'matched').map(i => i.key))
  const stats = {
    rowsRead: normalized.rowsRead,
    validRows: normalized.validRows,
    invalidRows: normalized.invalidCount,
    sedes: plan.stats.sedes,
    matched: plan.stats.matched,
    ambiguous: plan.stats.ambiguous,
    unmatched: plan.stats.unmatched,
    hospitalsWithChanges: plan.stats.hospitalsWithChanges,
    groupsInFile: ctx.data.groups || [],
    servicesToUpsert: plan.payload.services_upsert.length,
    servicesToDelete: plan.payload.services_delete.length,
    capacityToUpsert: plan.payload.capacity_upsert.length,
    capacityToDelete: plan.payload.capacity_delete.length,
  }

  await expireOldJobs()
  const sha256 = createHash('sha256').update(input.bytes).digest('hex')
  const expiresAt = new Date(Date.now() + JOB_TTL_MINUTES * 60 * 1000).toISOString()
  const { data: job, error } = await supabaseAdmin
    .from('hospital_import_jobs')
    .insert({
      kind,
      mode: input.mode,
      status: 'previewed',
      file_name: input.fileName.slice(0, 255),
      file_kind: fileKind,
      file_sha256: sha256,
      rows: { version: 1, data: keepSedes(ctx.data, matchedKeys) },
      summary: { ...stats, preview: planStats(plan) },
      created_by: input.user.id,
      expires_at: expiresAt,
    })
    .select('id, expires_at')
    .single()
  if (error || !job) throw error || new Error('No se pudo guardar la simulación')

  return {
    ...base,
    token: job.id as string,
    expiresAt: job.expires_at as string,
    needsMapping: false,
    missingFields: [],
    kind,
    stats,
    invalidSamples: normalized.invalid.slice(0, 50),
    items: plan.items.slice(0, ITEMS_LIMIT),
    itemsTruncated: plan.items.length > ITEMS_LIMIT,
    warnings,
  }
}

/** Simulaciones caducadas: se marcan 'expired' y se vacían sus filas (queda el resumen como auditoría). */
async function expireOldJobs() {
  const { error } = await supabaseAdmin
    .from('hospital_import_jobs')
    .update({ status: 'expired', rows: null })
    .eq('status', 'previewed')
    .lt('expires_at', new Date().toISOString())
  if (error) console.error('reps-import: no se pudieron marcar simulaciones caducadas', error)
}

// =========================================================================================
// Apply
// =========================================================================================

export class RepsApplyError extends Error {
  constructor(message: string, public status: number) {
    super(message)
    this.name = 'RepsApplyError'
  }
}

function isNormalizedImport(value: unknown): value is NormalizedImport {
  const v = value as NormalizedImport | null
  return Boolean(
    v && (v.kind === 'servicios' || v.kind === 'capacidad') && v.sedes && typeof v.sedes === 'object' &&
      Array.isArray(v.services) && Array.isArray(v.capacity)
  )
}

export async function runApply(user: SessionUser, token: string): Promise<RepsApplyResponse> {
  const { data: job, error } = await supabaseAdmin
    .from('hospital_import_jobs')
    .select('id, kind, mode, status, file_name, rows, summary, created_by, expires_at')
    .eq('id', token)
    .maybeSingle()
  if (error) throw error
  if (!job || job.created_by !== user.id) throw new RepsApplyError('Simulación no encontrada', 404)
  if (job.status === 'applied') throw new RepsApplyError('Esta importación ya se aplicó', 409)
  if (job.status !== 'previewed' || new Date(job.expires_at as string).getTime() < Date.now()) {
    throw new RepsApplyError('La simulación caducó: vuelve a subir el archivo', 410)
  }
  const stored = (job.rows as { version?: number; data?: unknown } | null)?.data
  if (!isNormalizedImport(stored) || stored.kind !== job.kind) throw new RepsApplyError('La simulación guardada no es válida: vuelve a subir el archivo', 422)

  const mode = (job.mode === 'merge' ? 'merge' : 'replace') as RepsImportMode
  const kind = job.kind as RepsImportKind
  const fileName = (job.file_name as string | null) ?? 'archivo'
  const ctx = await buildContext(stored)
  const plan = planFromContext(ctx, mode, { fileName, jobId: job.id as string })

  const previous = ((job.summary as Record<string, unknown> | null)?.preview ?? {}) as Record<string, unknown>
  const current = planStats(plan)
  const changedSincePreview = (Object.keys(current) as (keyof typeof current)[]).some(key => previous[key] !== current[key])
  // Nunca se retiran más servicios o capacidades de los que el usuario confirmó en la simulación
  const confirmedDeletes = (key: 'servicesToDelete' | 'capacityToDelete') =>
    typeof previous[key] === 'number' ? (previous[key] as number) : 0
  if (current.servicesToDelete > confirmedDeletes('servicesToDelete') || current.capacityToDelete > confirmedDeletes('capacityToDelete')) {
    throw new RepsApplyError(
      'Los datos cambiaron desde la simulación y ahora se retirarían más servicios o capacidades de los confirmados: vuelve a simular',
      409
    )
  }

  const { data: counts, error: rpcError } = await supabaseAdmin.rpc('reps_import_apply', {
    p_job_id: job.id,
    p_payload: {
      ...plan.payload,
      source: kind === 'servicios' ? 'reps-servicios' : 'reps-capacidad',
      reason: `Importación del REPS (${kind === 'servicios' ? 'servicios habilitados' : 'capacidad instalada'}): ${fileName}`.slice(0, 500),
      result: { ...current, changedSincePreview, applied_by: user.id },
    },
  })
  if (rpcError) {
    const code = (rpcError as { code?: string }).code
    if (code === 'OPM10') throw new RepsApplyError('Simulación no encontrada', 404)
    if (code === 'OPM11') throw new RepsApplyError('Esta importación ya se aplicó', 409)
    if (code === 'OPM12') throw new RepsApplyError('La simulación caducó: vuelve a subir el archivo', 410)
    throw rpcError
  }

  const c = (counts || {}) as RepsApplyResponse['counts']
  return {
    ok: true,
    kind,
    counts: c,
    hospitalsWithChanges: plan.stats.hospitalsWithChanges,
    changedSincePreview,
    message: `Importación aplicada: ${c.hospitals_updated ?? 0} IPS actualizadas (${plan.stats.hospitalsWithChanges} con cambios). No se recalculó ninguna asignación.`,
  }
}
