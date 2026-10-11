// Fase 3 · Lecturas de Supabase para la inteligencia de giros ADRES (solo servidor; "_lib" no es ruta).
// Tablas: adres_giros, adres_fetch_log (migración 2026-10-11_0610_fase3_adres.sql) y la función
// adres_giros_resumen(). Todo con service_role (lib/supabase-admin.ts).
import { supabaseAdmin, type SupabaseAdminClient } from '@/lib/supabase-admin'
import { zoneDisplayName } from '@/lib/zone-names'
import type { IntelHospital } from '@/lib/adres-intelligence'

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
  'Faltan las tablas de giros ADRES: aplicar database/migrations/2026-10-11_0610_fase3_adres.sql'

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

export interface GirosFetchStats {
  nitsConsultados: number
  conDatos: number
  sinRegistros: number
  errores: number
  ultimaConsulta: string | null
}

/** Estado de la última consulta a la ADRES de cada NIT (bitácora adres_fetch_log). */
export async function loadFetchStats(db: SupabaseAdminClient = supabaseAdmin): Promise<GirosFetchStats> {
  const rows = await fetchAll<{ nit: string; estado: string; fetched_at: string }>('adres_fetch_log', (from, to) =>
    db.from('adres_fetch_log').select('nit, estado, fetched_at').order('fetched_at', { ascending: false }).range(from, to)
  )
  const last = new Map<string, string>()
  for (const row of rows) if (!last.has(row.nit)) last.set(row.nit, row.estado)
  let conDatos = 0
  let sinRegistros = 0
  let errores = 0
  last.forEach(estado => {
    if (estado === 'ok') conDatos++
    else if (estado === 'sin_registros') sinRegistros++
    else errores++
  })
  return { nitsConsultados: last.size, conDatos, sinRegistros, errores, ultimaConsulta: rows[0]?.fetched_at ?? null }
}

/** adres_giros_resumen(desde, hasta): agregado por NIT y mes en un solo jsonb. */
export async function loadGirosResumen(desdeMonth: string, hastaMonth: string, db: SupabaseAdminClient = supabaseAdmin): Promise<unknown> {
  const [y, m] = hastaMonth.split('-').map(Number)
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const { data, error } = await db.rpc('adres_giros_resumen', {
    p_desde: `${desdeMonth}-01`,
    p_hasta: `${hastaMonth}-${String(lastDay).padStart(2, '0')}`,
    p_regimen: 'subsidiado',
  })
  if (error) throw Object.assign(new Error(`Error en adres_giros_resumen: ${error.message}`), { dbError: error })
  return data
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
