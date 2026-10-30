// Fase 3 · Lecturas de Supabase para la inteligencia de giros ADRES (solo servidor; "_lib" no es ruta).
// Tablas: adres_giros, adres_fetch_log (migración 2026-10-11_0610_fase3_adres.sql), adres_giros_detalle,
// la vista adres_giros_mensual y la función adres_giros_intel() (2026-10-11_0630_adres_detalle.sql).
// Todo con service_role (lib/supabase-admin.ts).
import { supabaseAdmin, type SupabaseAdminClient } from '@/lib/supabase-admin'
import { zoneDisplayName } from '@/lib/zone-names'
import type { GirosFuente, GirosRegimen, IntelHospital } from '@/lib/adres-intelligence'

/** Valor de adres_fetch_log.fuente de cada fuente. */
export const FETCH_FUENTE: Record<GirosFuente, string> = {
  reporte29: 'adres_reporte_29',
  identifica: 'adres_identifica_giro',
}

const PAGE_SIZE = 1000

type PageResult<T> = { data: T[] | null; error: { message: string; code?: string } | null }

async function fetchAll<T>(label: string, build: (from: number, to: number) => PromiseLike<PageResult<T>>): Promise<T[]> {
  const rows: T[] = []
  for (let page = 0; page < 200; page++) {
    const from = page * PAGE_SIZE
    const { data, error } = await build(from, from + PAGE_SIZE - 1)
    if (error) throw Object.assign(new Error(`Error leyendo ${label}: ${error.message}`), { dbError: error })
    const chunk = data || []
    rows.push(...chunk)
    if (chunk.length < PAGE_SIZE) break
  }
  return rows
}

/** true si el error de PostgREST es "la tabla/función no existe" (migración 0610 sin aplicar). */
export function isMissingRelationError(error: unknown): boolean {
  const dbError = (error as { dbError?: { code?: string; message?: string } } | null)?.dbError ?? (error as { code?: string; message?: string } | null)
  const code = dbError?.code || ''
  const message = dbError?.message || ''
  return code === '42P01' || code === 'PGRST205' || code === 'PGRST202' || code === '42883' || /does not exist|Could not find the (table|function)/i.test(message)
}

export const MISSING_MIGRATION_MESSAGE =
  'Faltan las tablas de giros ADRES: aplicar database/migrations/2026-10-11_0610_fase3_adres.sql y 2026-10-11_0630_adres_detalle.sql'

/** Primer y último mes con giros cargados ('YYYY-MM'), o null si no hay ninguno. */
export async function loadGirosPeriodBounds(db: SupabaseAdminClient = supabaseAdmin): Promise<{ min: string; max: string } | null> {
  const [first, last] = await Promise.all([
    db.from('adres_giros').select('periodo').order('periodo', { ascending: true }).limit(1),
    db.from('adres_giros').select('periodo').order('periodo', { ascending: false }).limit(1),
  ])
  if (first.error) throw Object.assign(new Error(`Error leyendo adres_giros: ${first.error.message}`), { dbError: first.error })
  if (last.error) throw Object.assign(new Error(`Error leyendo adres_giros: ${last.error.message}`), { dbError: last.error })
  const min = (first.data?.[0] as { periodo?: string } | undefined)?.periodo
  const max = (last.data?.[0] as { periodo?: string } | undefined)?.periodo
  if (!min || !max) return null
  return { min: String(min).slice(0, 7), max: String(max).slice(0, 7) }
}

/**
 * Primer y último giro de Identifica tu Giro (adres_giros_detalle): meses 'YYYY-MM' y fechas exactas.
 * null si no hay giros o si la migración 0630 no está aplicada (la página sigue con el Reporte 29).
 */
export async function loadIdentificaBounds(
  db: SupabaseAdminClient = supabaseAdmin
): Promise<{ min: string; max: string; primeraFecha: string; ultimaFecha: string } | null> {
  const [first, last] = await Promise.all([
    db.from('adres_giros_detalle').select('fecha_giro').order('fecha_giro', { ascending: true }).limit(1),
    db.from('adres_giros_detalle').select('fecha_giro').order('fecha_giro', { ascending: false }).limit(1),
  ])
  for (const result of [first, last]) {
    if (result.error) {
      if (isMissingRelationError(result.error)) return null
      throw Object.assign(new Error(`Error leyendo adres_giros_detalle: ${result.error.message}`), { dbError: result.error })
    }
  }
  const min = (first.data?.[0] as { fecha_giro?: string } | undefined)?.fecha_giro
  const max = (last.data?.[0] as { fecha_giro?: string } | undefined)?.fecha_giro
  if (!min || !max) return null
  return { min: String(min).slice(0, 7), max: String(max).slice(0, 7), primeraFecha: String(min).slice(0, 10), ultimaFecha: String(max).slice(0, 10) }
}

export interface GirosFetchStats {
  nitsConsultados: number
  conDatos: number
  sinRegistros: number
  errores: number
  ultimaConsulta: string | null
}

/**
 * Estado de la última consulta a la ADRES de cada NIT en una fuente (bitácora adres_fetch_log).
 * okNits = NIT cuya última consulta fue ok o sin registros (para decidir la fuente automática).
 */
export async function loadFetchLog(
  fuente: GirosFuente,
  db: SupabaseAdminClient = supabaseAdmin
): Promise<{ stats: GirosFetchStats; okNits: Set<string> }> {
  const rows = await fetchAll<{ nit: string; estado: string; fetched_at: string }>('adres_fetch_log', (from, to) =>
    db
      .from('adres_fetch_log')
      .select('nit, estado, fetched_at')
      .eq('fuente', FETCH_FUENTE[fuente])
      .order('fetched_at', { ascending: false })
      .order('id')
      .range(from, to)
  )
  const last = new Map<string, string>()
  for (const row of rows) if (!last.has(row.nit)) last.set(row.nit, row.estado)
  let conDatos = 0
  let sinRegistros = 0
  let errores = 0
  const okNits = new Set<string>()
  last.forEach((estado, nit) => {
    if (estado === 'ok') conDatos++
    else if (estado === 'sin_registros') sinRegistros++
    else errores++
    if (estado === 'ok' || estado === 'sin_registros') okNits.add(nit)
  })
  return { stats: { nitsConsultados: last.size, conDatos, sinRegistros, errores, ultimaConsulta: rows[0]?.fetched_at ?? null }, okNits }
}

/**
 * Meses consultados a la ADRES de cada NIT en una fuente (adres_fetch_log, consultas ok o sin registros), como rangos
 * 'YYYY-MM'. Para no tomar como "sin giro" un mes que no se consultó (una IPS creada después de la carga inicial, o una
 * consulta que falló). null si la bitácora no existe todavía.
 */
export async function loadCoberturaGiros(fuente: GirosFuente, db: SupabaseAdminClient = supabaseAdmin): Promise<Map<string, Array<{ desde: string; hasta: string }>> | null> {
  let rows: Array<{ nit: string; desde: string | null; hasta: string | null }>
  try {
    rows = await fetchAll<{ nit: string; desde: string | null; hasta: string | null }>('adres_fetch_log', (from, to) =>
      db
        .from('adres_fetch_log')
        .select('nit, desde, hasta')
        .eq('fuente', FETCH_FUENTE[fuente])
        .in('estado', ['ok', 'sin_registros'])
        .order('id')
        .range(from, to)
    )
  } catch (error) {
    if (isMissingRelationError((error as { dbError?: unknown })?.dbError ?? error)) return null
    throw error
  }
  const cobertura = new Map<string, Array<{ desde: string; hasta: string }>>()
  for (const row of rows) {
    if (!row.desde || !row.hasta) continue
    const lista = cobertura.get(row.nit) ?? []
    lista.push({ desde: String(row.desde).slice(0, 7), hasta: String(row.hasta).slice(0, 7) })
    cobertura.set(row.nit, lista)
  }
  return cobertura
}

/** Estado de la bitácora del Reporte 29 (compatibilidad con llamadores anteriores). */
export async function loadFetchStats(db: SupabaseAdminClient = supabaseAdmin): Promise<GirosFetchStats> {
  return (await loadFetchLog('reporte29', db)).stats
}

/** adres_giros_resumen(desde, hasta): agregado por NIT y mes del Reporte 29 en un solo jsonb. */
export async function loadGirosResumen(desdeMonth: string, hastaMonth: string, db: SupabaseAdminClient = supabaseAdmin): Promise<unknown> {
  const { data, error } = await db.rpc('adres_giros_resumen', {
    p_desde: `${desdeMonth}-01`,
    p_hasta: monthEnd(hastaMonth),
    p_regimen: 'subsidiado',
  })
  if (error) throw Object.assign(new Error(`Error en adres_giros_resumen: ${error.message}`), { dbError: error })
  return data
}

/** Último día del mes 'YYYY-MM' → 'YYYY-MM-DD'. */
export function monthEnd(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return `${month}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}`
}

/**
 * adres_giros_intel(fuente, desde, hasta, regimen): agregado por NIT (totales, régimen, tipo, meses,
 * entidades ordenadoras, último giro) en un solo jsonb. regimen 'todos' = sin filtro.
 */
export async function loadGirosIntel(
  fuente: GirosFuente,
  desdeMonth: string,
  hastaMonth: string,
  regimen: GirosRegimen,
  db: SupabaseAdminClient = supabaseAdmin
): Promise<unknown> {
  const { data, error } = await db.rpc('adres_giros_intel', {
    p_fuente: fuente,
    p_desde: `${desdeMonth}-01`,
    p_hasta: monthEnd(hastaMonth),
    p_regimen: regimen === 'todos' ? null : regimen,
  })
  if (error) throw Object.assign(new Error(`Error en adres_giros_intel: ${error.message}`), { dbError: error })
  return data
}

/**
 * Totales de giros de Identifica tu Giro por NIT en una ventana de meses ('YYYY-MM' ambos, inclusive), SOLO para los
 * NIT pedidos, con la misma forma que cada elemento de adres_giros_intel()->'nits' (la lee parseResumen de
 * lib/adres-intelligence.ts): [{ nit, total, contributivo, subsidiado, otro, ultima }], sin detalle mensual ni por
 * EPS. Lo usan las tarjetas del mapa (app/api/map/_lib/detalle-server.ts, spec 2026-10-24): por clic hacen falta
 * unos pocos NIT y una respuesta pequeña.
 *
 * Con la RPC adres_giros_nits (migración 2026-10-24_0880, opcional y aditiva) la base devuelve solo esos NIT (≈ 1 ms).
 * Si la migración no está aplicada (isMissingRelationError), respaldo: adres_giros_intel de Identifica con régimen
 * 'todos' (todo el país, ≈ 740 ms y 1,5 MB) filtrado aquí por NIT. Las dos ramas suman lo mismo. nits vacío → [] sin
 * consultar nada.
 */
export async function loadGirosNits(
  params: { desde: string; hasta: string; nits: string[] },
  db: SupabaseAdminClient = supabaseAdmin
): Promise<unknown[]> {
  const nits = Array.from(new Set(params.nits.filter(Boolean)))
  if (nits.length === 0) return []

  const { data, error } = await db.rpc('adres_giros_nits', {
    p_desde: `${params.desde}-01`,
    p_hasta: monthEnd(params.hasta),
    p_nits: nits,
  })
  if (!error) return Array.isArray(data) ? data : []
  if (!isMissingRelationError(error)) throw Object.assign(new Error(`Error en adres_giros_nits: ${error.message}`), { dbError: error })

  // Sin la 0880: el agregado de todo el país, filtrado por NIT en memoria.
  const intel = await loadGirosIntel('identifica', params.desde, params.hasta, 'todos', db)
  const record = intel && typeof intel === 'object' && !Array.isArray(intel) ? (intel as { nits?: unknown }) : null
  const list = Array.isArray(record?.nits) ? (record!.nits as unknown[]) : []
  const wanted = new Set(nits)
  return list.filter(item => {
    if (!item || typeof item !== 'object') return false
    const nit = (item as { nit?: unknown }).nit
    return typeof nit === 'string' && wanted.has(nit)
  })
}

interface HospitalRow {
  id: string
  code: string | null
  name: string
  municipality_id: string | null
  municipality_name: string | null
  department_id: string | null
  department_name: string | null
  beds: number | null
}

/**
 * IPS activas con su zona actual (assignments; si hubiera varias filas, la más reciente) y, si se pasa
 * la cobertura de una línea, el ejecutivo comercial que cubre esa zona.
 */
export async function loadIntelHospitals(
  coverageByKam: Map<string, { kind: IntelHospital['coverage_kind']; executive: IntelHospital['executive'] }> | null,
  db: SupabaseAdminClient = supabaseAdmin
): Promise<IntelHospital[]> {
  const [hospitals, assignments, kams] = await Promise.all([
    fetchAll<HospitalRow>('hospitals', (from, to) =>
      db
        .from('hospitals')
        .select('id, code, name, municipality_id, municipality_name, department_id, department_name, beds')
        .eq('active', true)
        .order('id')
        .range(from, to)
    ),
    fetchAll<{ hospital_id: string; kam_id: string; assigned_at: string | null }>('assignments', (from, to) =>
      db.from('assignments').select('hospital_id, kam_id, assigned_at').order('hospital_id').order('kam_id').range(from, to)
    ),
    fetchAll<{ id: string; name: string | null }>('kams', (from, to) => db.from('kams').select('id, name').order('id').range(from, to)),
  ])

  const zoneNames = new Map(kams.map(kam => [kam.id, zoneDisplayName(kam.name) || 'Zona sin nombre']))
  const assignmentByHospital = new Map<string, { kam_id: string; assigned_at: string }>()
  for (const row of assignments) {
    const current = assignmentByHospital.get(row.hospital_id)
    const at = row.assigned_at || ''
    if (!current || at > current.assigned_at) assignmentByHospital.set(row.hospital_id, { kam_id: row.kam_id, assigned_at: at })
  }

  return hospitals.map(hospital => {
    const kamId = assignmentByHospital.get(hospital.id)?.kam_id ?? null
    const coverage = kamId && coverageByKam ? coverageByKam.get(kamId) ?? null : null
    return {
      id: hospital.id,
      name: hospital.name,
      code: hospital.code,
      municipality_id: hospital.municipality_id,
      municipality_name: hospital.municipality_name,
      department_id: hospital.department_id,
      department_name: hospital.department_name,
      beds: typeof hospital.beds === 'number' ? hospital.beds : null,
      kam_id: kamId,
      zone_name: kamId ? zoneNames.get(kamId) ?? 'Zona sin nombre' : null,
      executive: coverage?.executive ?? null,
      coverage_kind: coverage?.kind ?? null,
    }
  })
}
