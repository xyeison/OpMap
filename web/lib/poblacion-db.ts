/**
 * Fase 4 · Población: utilidades de base de datos compartidas por los 3 scripts de carga
 * (bdua-load.ts, minsalud-cifras-load.ts, dane-proyecciones-load.ts) y, desde el PR 7, por las cargas
 * automáticas del cron (lib/bdua-sync.ts, lib/cifras-sync.ts). Antes vivía en scripts/_poblacion-db.ts,
 * que ahora solo re-exporta este archivo (mismo comportamiento).
 *
 * PostgREST corta en 1.000 filas: todo se lee paginado con range().
 */
import type { SupabaseAdminClient } from './supabase-admin'
import type { DepartmentRef, MunicipalityRef, MunicipioAliasRow } from './municipio-alias'

export interface MunicipalityWithPopulation extends MunicipalityRef {
  population_2025: number | null
}

export async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  pageSize = 1000,
  maxRows = 2_000_000
): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; from < maxRows; from += pageSize) {
    const { data, error } = await build(from, from + pageSize - 1)
    if (error) throw new Error(error.message)
    const page = data ?? []
    rows.push(...page)
    if (page.length < pageSize) break
  }
  return rows
}

export async function loadGeo(db: SupabaseAdminClient): Promise<{
  municipalities: MunicipalityWithPopulation[]
  departments: DepartmentRef[]
  aliases: MunicipioAliasRow[]
}> {
  const municipalities = await fetchAll<MunicipalityWithPopulation>((from, to) =>
    db.from('municipalities').select('code, name, department_code, population_2025').order('code').range(from, to)
  )
  const departments = await fetchAll<DepartmentRef>((from, to) => db.from('departments').select('code, name').order('code').range(from, to))
  const aliases = await fetchAll<MunicipioAliasRow>((from, to) =>
    db
      .from('municipio_alias')
      .select('nombre_normalizado, department_code, municipality_code, fuente')
      .order('fuente')
      .order('department_code')
      .order('nombre_normalizado')
      .range(from, to)
  )
  return { municipalities, departments, aliases }
}

/**
 * Upsert por lotes; devuelve filas escritas y lotes con error (sin abortar en el primero).
 * `quiet` (cron) no escribe el progreso en la consola; los errores van en `errors`.
 */
export async function upsertBatches<T extends object>(
  db: SupabaseAdminClient,
  table: string,
  rows: T[],
  onConflict: string,
  batchSize = 1000,
  label = table,
  options: { quiet?: boolean } = {}
): Promise<{ written: number; failedBatches: number; errors: string[] }> {
  let written = 0
  let failedBatches = 0
  const errors: string[] = []
  for (let from = 0; from < rows.length; from += batchSize) {
    const batch = rows.slice(from, from + batchSize)
    const { error } = await db.from(table).upsert(batch, { onConflict })
    if (error) {
      failedBatches++
      const message = `${label}: lote ${from / batchSize + 1} con error ${error.code ?? ''} ${error.message}`
      errors.push(message)
      if (!options.quiet) process.stderr.write(`\n${message}\n`)
      continue
    }
    written += batch.length
    if (!options.quiet) process.stdout.write(`\r${label}: ${written.toLocaleString('es-CO')} / ${rows.length.toLocaleString('es-CO')}`)
  }
  if (rows.length > 0 && !options.quiet) process.stdout.write('\n')
  return { written, failedBatches, errors }
}

export const fmt = (n: number | null | undefined) => (n === null || n === undefined ? '—' : n.toLocaleString('es-CO'))
export const pct = (part: number, total: number, digits = 2) => (total > 0 ? `${((100 * part) / total).toFixed(digits).replace('.', ',')} %` : '—')
