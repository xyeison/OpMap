// Fase 4 · Lecturas de Supabase para "Población y cobertura" (solo servidor; "_lib" no es ruta).
// Tablas: afiliacion_cifras, bdua_afiliados, dane_proyecciones (migración 0640), funciones
// poblacion_cortes() y poblacion_bdua_resumen() (0660), giros ADRES (0610 adres_giros y 0630
// adres_giros_detalle / adres_giros_intel()), municipality_zone (Fase 2b) y hospitals / assignments.
// Todo con service_role. Si falta una tabla o función, esa fuente se marca como no disponible y el
// resto sigue (la vista muestra lo que hay).
import { supabaseAdmin, type SupabaseAdminClient } from '@/lib/supabase-admin'
import { zoneDisplayName } from '@/lib/zone-names'
import { addMonths, chooseGirosSource, nitOfHospital, parseResumen, GIROS_DEFAULT_MONTHS } from '@/lib/adres-intelligence'
import {
  mergeBduaEps,
  parseGirosIntelTotals,
  type BduaRegimenRow,
  type CifrasMunicipioRow,
  type CoverageForZone,
  type EpsAfiliadosRow,
  type GiroNitTotal,
  type PoblacionGirosInfo,
  type PoblacionHospital,
} from '@/lib/poblacion-intelligence'
import {
  isMissingRelationError,
  loadFetchLog,
  loadGirosIntel,
  loadGirosPeriodBounds,
  loadGirosResumen,
  loadIdentificaBounds,
} from './giros-server'

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

/** Ejecuta un lector; si la tabla o función no existe devuelve `fallback` (fuente no disponible). */
async function optional<T>(load: () => Promise<T>, fallback: T): Promise<{ value: T; available: boolean }> {
  try {
    return { value: await load(), available: true }
  } catch (error) {
    if (isMissingRelationError(error)) return { value: fallback, available: false }
    throw error
  }
}

const toNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

// ---------------------------------------------------------------------------
// IPS, municipios, departamentos y zona de alcance
// ---------------------------------------------------------------------------

interface HospitalRow {
  id: string
  code: string | null
  name: string
  municipality_id: string | null
  municipality_name: string | null
  department_id: string | null
  department_name: string | null
  beds: number | null
  reps_beds: number | null
  quirofanos: number | null
}

/** IPS activas con zona actual (assignments, la más reciente) y, con línea, el ejecutivo de la zona. */
export async function loadPoblacionHospitals(
  coverageByKam: Map<string, CoverageForZone> | null,
  db: SupabaseAdminClient = supabaseAdmin
): Promise<{ hospitals: PoblacionHospital[]; zoneNames: Map<string, string> }> {
  const [hospitals, assignments, kams] = await Promise.all([
    fetchAll<HospitalRow>('hospitals', (from, to) =>
      db
        .from('hospitals')
        .select('id, code, name, municipality_id, municipality_name, department_id, department_name, beds, reps_beds, quirofanos')
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

  return {
    zoneNames,
    hospitals: hospitals.map(hospital => {
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
        beds: toNumber(hospital.beds),
        reps_beds: toNumber(hospital.reps_beds),
        quirofanos: toNumber(hospital.quirofanos),
        kam_id: kamId,
        zone_name: kamId ? zoneNames.get(kamId) ?? 'Zona sin nombre' : null,
        executive: coverage?.executive ?? null,
        coverage_kind: coverage?.kind ?? null,
      }
    }),
  }
}

export interface MunicipalityBase {
  municipalities: Array<{ code: string; name: string; department_code: string; population_2025: number | null }>
  departmentNames: Map<string, string>
}

export async function loadMunicipalityBase(db: SupabaseAdminClient = supabaseAdmin): Promise<MunicipalityBase> {
  const [municipalities, departments] = await Promise.all([
    fetchAll<{ code: string; name: string; department_code: string; population_2025: number | null }>('municipalities', (from, to) =>
      db.from('municipalities').select('code, name, department_code, population_2025').order('code').range(from, to)
    ),
    fetchAll<{ code: string; name: string }>('departments', (from, to) => db.from('departments').select('code, name').order('code').range(from, to)),
  ])
  return {
    municipalities: municipalities.map(row => ({ ...row, population_2025: toNumber(row.population_2025) })),
    departmentNames: new Map(departments.map(row => [row.code, row.name])),
  }
}

/** municipality_zone (Fase 2b): municipio → zona para los que no tienen IPS (solo ips/reach). */
export async function loadReachZones(db: SupabaseAdminClient = supabaseAdmin): Promise<{ value: Map<string, string | null>; available: boolean }> {
  return optional(async () => {
    const rows = await fetchAll<{ municipality_code: string; kam_id: string | null; kind: string }>('municipality_zone', (from, to) =>
      db.from('municipality_zone').select('municipality_code, kam_id, kind').order('municipality_code').range(from, to)
    )
    const map = new Map<string, string | null>()
    for (const row of rows) map.set(row.municipality_code, (row.kind === 'ips' || row.kind === 'reach') && row.kam_id ? row.kam_id : null)
    return map
  }, new Map())
}

// ---------------------------------------------------------------------------
// Cortes, cifras de MinSalud, BDUA y DANE
// ---------------------------------------------------------------------------

export interface PoblacionCortes {
  cifras: string[] // 'YYYY-MM-DD' (último día del mes), ascendente
  bdua: string[] // 'YYYY-MM-DD', ascendente
  dane: number[] // años, ascendente
  /** poblacion_cortes() existe (migración 0660). */
  rpc: boolean
}

async function latestDate(table: string, column: string, db: SupabaseAdminClient): Promise<string[]> {
  const { data, error } = await db.from(table).select(column).order(column, { ascending: false }).limit(1)
  if (error) throw Object.assign(new Error(`Error leyendo ${table}: ${error.message}`), { dbError: error })
  const value = (data?.[0] as unknown as Record<string, unknown> | undefined)?.[column]
  return value === undefined || value === null ? [] : [String(value).slice(0, 10)]
}

/** Cortes disponibles. Sin la función 0660, solo el más reciente de cada tabla (y el año en curso del DANE). */
export async function loadPoblacionCortes(db: SupabaseAdminClient = supabaseAdmin): Promise<PoblacionCortes> {
  const { data, error } = await db.rpc('poblacion_cortes')
  if (!error && data && typeof data === 'object') {
    const record = data as Record<string, unknown>
    const dates = (value: unknown) => (Array.isArray(value) ? value.map(item => String(item).slice(0, 10)).filter(Boolean).sort() : [])
    const years = Array.isArray(record.dane) ? record.dane.map(Number).filter(Number.isFinite).sort((a, b) => a - b) : []
    return { cifras: dates(record.cifras), bdua: dates(record.bdua), dane: years, rpc: true }
  }
  if (error && !isMissingRelationError({ dbError: error })) {
    throw Object.assign(new Error(`Error en poblacion_cortes: ${error.message}`), { dbError: error })
  }
  const [cifras, bdua] = await Promise.all([
    optional(() => latestDate('afiliacion_cifras', 'corte', db), [] as string[]),
    optional(() => latestDate('bdua_afiliados', 'corte', db), [] as string[]),
  ])
  return { cifras: cifras.value, bdua: bdua.value, dane: [], rpc: false }
}

export async function loadCifras(corte: string, db: SupabaseAdminClient = supabaseAdmin): Promise<CifrasMunicipioRow[]> {
  const rows = await fetchAll<{
    municipality_code: string
    contributivo: number | null
    subsidiado: number | null
    excepcion_especiales: number | null
    poblacion_dane: number | null
  }>('afiliacion_cifras', (from, to) =>
    db
      .from('afiliacion_cifras')
      .select('municipality_code, contributivo, subsidiado, excepcion_especiales, poblacion_dane')
      .eq('corte', corte)
      .order('municipality_code')
      .range(from, to)
  )
  return rows.map(row => ({
    municipio: row.municipality_code,
    contributivo: toNumber(row.contributivo),
    subsidiado: toNumber(row.subsidiado),
    excepcion: toNumber(row.excepcion_especiales),
    poblacion: toNumber(row.poblacion_dane),
  }))
}

/** Cifras de un solo municipio (ficha de IPS). */
export async function loadCifrasMunicipio(corte: string, municipio: string, db: SupabaseAdminClient = supabaseAdmin): Promise<CifrasMunicipioRow[]> {
  const { data, error } = await db
    .from('afiliacion_cifras')
    .select('municipality_code, contributivo, subsidiado, excepcion_especiales, poblacion_dane')
    .eq('corte', corte)
    .eq('municipality_code', municipio)
    .limit(1)
  if (error) throw Object.assign(new Error(`Error leyendo afiliacion_cifras: ${error.message}`), { dbError: error })
  return (data || []).map(row => ({
    municipio: row.municipality_code as string,
    contributivo: toNumber(row.contributivo),
    subsidiado: toNumber(row.subsidiado),
    excepcion: toNumber(row.excepcion_especiales),
    poblacion: toNumber(row.poblacion_dane),
  }))
}

/** BDUA activos de un corte: por municipio y régimen, y EPS por municipio (poblacion_bdua_resumen). */
export async function loadBduaResumen(corte: string, db: SupabaseAdminClient = supabaseAdmin): Promise<{ regimen: BduaRegimenRow[]; eps: EpsAfiliadosRow[] }> {
  const { data, error } = await db.rpc('poblacion_bdua_resumen', { p_corte: corte, p_top_eps: 12 })
  if (error) throw Object.assign(new Error(`Error en poblacion_bdua_resumen: ${error.message}`), { dbError: error })
  const record = data && typeof data === 'object' ? (data as Record<string, unknown>) : {}
  const regimen: BduaRegimenRow[] = []
  for (const item of Array.isArray(record.municipios) ? record.municipios : []) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const municipio = typeof row.m === 'string' ? row.m : null
    if (!municipio) continue
    regimen.push({ municipio, regimen: 'contributivo', afiliados: toNumber(row.c) ?? 0 })
    regimen.push({ municipio, regimen: 'subsidiado', afiliados: toNumber(row.s) ?? 0 })
  }
  const epsRaw: Array<{ municipio: string; eps_id: string; afiliados: number }> = []
  for (const item of Array.isArray(record.eps) ? record.eps : []) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    if (typeof row.m !== 'string' || typeof row.e !== 'string') continue
    epsRaw.push({ municipio: row.m, eps_id: row.e, afiliados: toNumber(row.a) ?? 0 })
  }
  const nombres = record.nombres && typeof record.nombres === 'object' ? (record.nombres as Record<string, string>) : {}
  return { regimen, eps: mergeBduaEps(epsRaw, nombres) }
}

/** Filas crudas de la BDUA de un municipio (ficha de IPS; pocas filas, sin la función 0660). */
export async function loadBduaMunicipioRows(corte: string, municipio: string, db: SupabaseAdminClient = supabaseAdmin) {
  return fetchAll<{ municipality_code: string | null; regimen: string; eps_id: string; eps_nombre: string | null; estado: string; afiliados: number }>(
    'bdua_afiliados',
    (from, to) =>
      db
        .from('bdua_afiliados')
        .select('municipality_code, regimen, eps_id, eps_nombre, estado, afiliados')
        .eq('corte', corte)
        .eq('municipality_code', municipio)
        .order('id')
        .range(from, to)
  )
}

/** Población DANE (total) de un año, por municipio. */
export async function loadDane(anio: number, municipio: string | null = null, db: SupabaseAdminClient = supabaseAdmin): Promise<Map<string, number>> {
  const rows = await fetchAll<{ municipality_code: string; total: number }>('dane_proyecciones', (from, to) => {
    let query = db.from('dane_proyecciones').select('municipality_code, total').eq('anio', anio)
    if (municipio) query = query.eq('municipality_code', municipio)
    return query.order('municipality_code').range(from, to)
  })
  const map = new Map<string, number>()
  for (const row of rows) {
    const total = toNumber(row.total)
    if (total !== null) map.set(row.municipality_code, total)
  }
  return map
}

// ---------------------------------------------------------------------------
// Giros ADRES de los últimos 12 meses
// ---------------------------------------------------------------------------

/**
 * Giro total por NIT en los 12 meses que terminan en el último mes cargado de la fuente.
 * Fuente: la misma regla automática de /api/intelligence/giros (chooseGirosSource): "Identifica tu
 * Giro" (adres_giros_detalle, 0630) si está cargado para al menos el 90 % de los NIT activos y tiene
 * giros; si no, el Reporte 29 (adres_giros, 0610, solo subsidiado). De Identifica tu Giro se suman
 * contributivo y subsidiado; "otro" (recobros, SOAT, pruebas COVID…) no entra.
 * @param hospitalCodes códigos (hospitals.code) de las IPS activas, para medir la cobertura.
 */
export async function loadGirosTotales(
  hospitalCodes: Array<string | null>,
  db: SupabaseAdminClient = supabaseAdmin
): Promise<{ totals: GiroNitTotal[]; info: PoblacionGirosInfo }> {
  const none = { totals: [] as GiroNitTotal[], info: { fuente: null, desde: null, hasta: null, regimenes: [] } as PoblacionGirosInfo }
  const [identifica, reporte29, identificaLog] = await Promise.all([
    optional(() => loadIdentificaBounds(db), null),
    optional(() => loadGirosPeriodBounds(db), null),
    optional(() => loadFetchLog('identifica', db), { stats: { nitsConsultados: 0, conDatos: 0, sinRegistros: 0, errores: 0, ultimaConsulta: null }, okNits: new Set<string>() }),
  ])
  if (!identifica.value && !reporte29.value) return none

  const nitsActivos = new Set<string>()
  for (const code of hospitalCodes) {
    const nit = nitOfHospital({ code })
    if (nit) nitsActivos.add(nit)
  }
  let identificaNitsOk = 0
  identificaLog.value.okNits.forEach(nit => {
    if (nitsActivos.has(nit)) identificaNitsOk++
  })
  const { fuente } = chooseGirosSource({
    requested: 'auto',
    desde: null,
    hasta: null,
    identifica: identifica.value ? { min: identifica.value.min, max: identifica.value.max } : null,
    reporte29: reporte29.value,
    identificaNitsOk,
    nitsActivos: nitsActivos.size,
  })
  const bounds = fuente === 'identifica' ? identifica.value : reporte29.value
  if (!bounds) return none
  const hasta = bounds.max
  const desde = addMonths(hasta, -(GIROS_DEFAULT_MONTHS - 1))
  const regimenes = (fuente === 'identifica' ? ['contributivo', 'subsidiado'] : ['subsidiado']) as PoblacionGirosInfo['regimenes']

  try {
    const raw = await loadGirosIntel(fuente, desde, hasta, fuente === 'identifica' ? 'todos' : 'subsidiado', db)
    return { totals: parseGirosIntelTotals(raw, ['contributivo', 'subsidiado']), info: { fuente, desde, hasta, regimenes } }
  } catch (error) {
    // Sin adres_giros_intel() (rollback de 0630): el Reporte 29 sigue disponible por adres_giros_resumen().
    if (!isMissingRelationError(error) || fuente !== 'reporte29') throw error
    const resumen = parseResumen(await loadGirosResumen(desde, hasta, db))
    return { totals: resumen.map(item => ({ nit: item.nit, total: item.total })), info: { fuente, desde, hasta, regimenes } }
  }
}

export { optional as optionalSource }
