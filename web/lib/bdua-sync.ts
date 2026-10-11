/**
 * Fase 4 · Carga de un dataset de la BDUA (ADRES, datos.gov.co) en public.bdua_afiliados.
 *
 * cargarDatasetBdua es la lógica que antes estaba dentro de scripts/bdua-load.ts (se movió aquí SIN cambiar
 * el comportamiento: misma consulta SoQL agregada y paginada, misma comprobación de que la suma de las
 * páginas sea igual al total del dataset, mismo upsert y misma poda del corte). El script la sigue usando.
 *
 * sincronizarBdua (PR 7) es la carga automática mensual (GET /api/cron/bdua y "Actualizar ahora"): por
 * cada dataset (contributivo y subsidiado) mira rowsUpdatedAt; si ese corte ya está en bdua_afiliados no
 * hace nada; si no, lo carga con cargarDatasetBdua. Un dataset por vez si no queda tiempo para el otro
 * (la pasada queda "corriendo" y la siguiente invocación sigue con el que falta).
 */
import type { SupabaseAdminClient } from './supabase-admin'
import { ALIAS_FUENTE_BDUA, createMunicipioResolver } from './municipio-alias'
import {
  aggregateBduaRows,
  BDUA_DATASETS,
  buildBduaSoqlUrl,
  buildBduaTotalUrl,
  corteFromRowsUpdatedAt,
  toCount,
  type BduaAggregate,
  type BduaDatasetId,
  type BduaSoqlRow,
} from './poblacion-parse'
import { loadGeo, upsertBatches } from './poblacion-db'
import type { CargaResultado } from './fuentes-runner'

export const BDUA_BASE = 'https://www.datos.gov.co'
const USER_AGENT = 'OpMap-BDUA/1.0 (carga de afiliados BDUA por municipio; datos abiertos)'
const TIMEOUT_MS = 180_000
const RETRIES = 3

const fmt = (n: number | null | undefined) => (n === null || n === undefined ? '—' : n.toLocaleString('es-CO'))

export async function bduaGetJson<T>(url: string, timeoutMs = TIMEOUT_MS): Promise<T> {
  let lastError: unknown = null
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' }, cache: 'no-store', signal: AbortSignal.timeout(timeoutMs) })
      if (!res.ok) {
        const body = (await res.text()).slice(0, 300)
        // 4xx (consulta mal formada, bloqueo) no se reintenta
        if (res.status >= 400 && res.status < 500 && res.status !== 429) throw Object.assign(new Error(`HTTP ${res.status}: ${body}`), { fatal: true })
        throw new Error(`HTTP ${res.status}: ${body}`)
      }
      return (await res.json()) as T
    } catch (error) {
      lastError = error
      if ((error as { fatal?: boolean }).fatal) break
      if (attempt < RETRIES) await new Promise(resolve => setTimeout(resolve, 2000 * attempt))
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}

export interface BduaDatasetResult {
  dataset: BduaDatasetId
  corte: string
  rowsUpdatedAt: string
  datasetTotal: number
  datasetFilas: number
  pages: number
  grupos: number
  agg: BduaAggregate
  written: number
  failedBatches: number
  pruned: number
  /** La suma no cuadra, hay errores o régimen inesperado: no se escribió nada. */
  blocking: boolean
}

export interface CargarDatasetBduaParams {
  db: SupabaseAdminClient
  dataset: BduaDatasetId
  resolver: ReturnType<typeof createMunicipioResolver>
  /** --corte del script; null = fecha de rowsUpdatedAt. */
  corte: string | null
  limit: number
  loadedAt: string
  dryRun: boolean
  /** Líneas del informe (el script las imprime con console.log). */
  log: (line: string) => void
  /** Progreso de las páginas (el script lo escribe con \r). */
  progress?: (text: string) => void
  /** Cada página cruda (el script la guarda con --save-dir). */
  onPage?: (page: BduaSoqlRow[], pageNumber: number, corte: string) => void
  /** Sin progreso en consola (cron). */
  quiet?: boolean
  timeoutMs?: number
}

export async function cargarDatasetBdua(p: CargarDatasetBduaParams): Promise<BduaDatasetResult> {
  const { db, dataset, log } = p
  const timeout = p.timeoutMs ?? TIMEOUT_MS
  const meta = await bduaGetJson<{ name?: string; rowsUpdatedAt?: number }>(`${BDUA_BASE}/api/views/${dataset}.json`, timeout)
  if (!meta.rowsUpdatedAt) throw new Error(`${dataset}: la metadata no trae rowsUpdatedAt`)
  const corte = p.corte ?? corteFromRowsUpdatedAt(meta.rowsUpdatedAt)
  const totalRow = (await bduaGetJson<{ afiliados?: string; filas?: string }[]>(buildBduaTotalUrl(dataset, BDUA_BASE), timeout))[0] ?? {}
  const datasetTotal = toCount(totalRow.afiliados) ?? NaN
  const datasetFilas = toCount(totalRow.filas) ?? NaN
  log(`\n${dataset} · ${meta.name ?? ''}`)
  log(`  rowsUpdatedAt ${new Date(meta.rowsUpdatedAt * 1000).toISOString()} → corte ${corte}${p.corte ? ' (por --corte)' : ''}`)
  log(`  total del dataset: ${fmt(datasetTotal)} afiliados en ${fmt(datasetFilas)} filas`)

  const rows: BduaSoqlRow[] = []
  let pages = 0
  for (let offset = 0; ; offset += p.limit) {
    const page = await bduaGetJson<BduaSoqlRow[]>(buildBduaSoqlUrl(dataset, { limit: p.limit, offset }, BDUA_BASE), timeout)
    pages++
    rows.push(...page)
    p.onPage?.(page, pages, corte)
    p.progress?.(`\r  página ${pages}: ${fmt(rows.length)} grupos`)
    if (page.length < p.limit) break
    if (pages > 100) throw new Error('Más de 100 páginas: algo no cuadra')
  }
  p.progress?.('\n')

  const agg = aggregateBduaRows({ rows, corte, fuente: dataset, resolver: p.resolver })
  const expected = BDUA_DATASETS[dataset].regimen
  const otherRegimen = Object.keys(agg.byRegimen).filter(r => r !== expected)
  const sumOk = agg.total === datasetTotal
  log(`  suma de las páginas: ${fmt(agg.total)} (${sumOk ? 'cuadra con el total del dataset' : 'NO cuadra con el total del dataset'})`)
  log(`  filas a guardar: ${fmt(agg.rows.length)} · errores: ${agg.errors.length}${otherRegimen.length ? ` · régimen inesperado: ${otherRegimen.join(', ')}` : ''}`)
  agg.errors.slice(0, 10).forEach(e => log(`    - ${e}`))

  let written = 0
  let failedBatches = 0
  let pruned = 0
  const blocking = !sumOk || agg.errors.length > 0 || otherRegimen.length > 0
  if (blocking) {
    log('  Problemas bloqueantes: no se escribe este dataset.')
  } else if (!p.dryRun) {
    const toWrite = agg.rows.map(r => ({ ...r, loaded_at: p.loadedAt }))
    const res = await upsertBatches(db, 'bdua_afiliados', toWrite, 'corte,regimen,departamento_bdua,municipio_bdua,eps_id,estado,zona', 1000, `  bdua_afiliados ${dataset}`, { quiet: p.quiet })
    written = res.written
    failedBatches = res.failedBatches
    if (failedBatches === 0) {
      const { count, error } = await db.from('bdua_afiliados').delete({ count: 'exact' }).eq('corte', corte).eq('fuente', dataset).lt('loaded_at', p.loadedAt)
      if (error) throw new Error(`poda ${dataset} ${corte}: ${error.message}`)
      pruned = count ?? 0
    }
  }
  return { dataset, corte, rowsUpdatedAt: new Date(meta.rowsUpdatedAt * 1000).toISOString(), datasetTotal, datasetFilas, pages, grupos: rows.length, agg, written, failedBatches, pruned, blocking }
}

// ---------------------------------------------------------------------------------------------
// Carga automática (cron / "Actualizar ahora")
// ---------------------------------------------------------------------------------------------

/** Tiempo mínimo para empezar un dataset (consulta agregada + upsert de ~28.000 filas). */
const MIN_MS_POR_DATASET = 35_000

export async function sincronizarBdua(opts: { db: SupabaseAdminClient; deadline: number; log?: (m: string) => void }): Promise<CargaResultado> {
  const { db } = opts
  const lines: string[] = []
  const log = (line: string) => {
    lines.push(line)
    opts.log?.(line)
  }
  const datasets = Object.keys(BDUA_DATASETS) as BduaDatasetId[]
  const resumen: string[] = []
  let filas = 0
  let pendientes = 0
  let geo: Awaited<ReturnType<typeof loadGeo>> | null = null

  for (const dataset of datasets) {
    const meta = await bduaGetJson<{ rowsUpdatedAt?: number }>(`${BDUA_BASE}/api/views/${dataset}.json`, 30_000)
    if (!meta.rowsUpdatedAt) throw new Error(`${dataset}: la metadata no trae rowsUpdatedAt`)
    const corte = corteFromRowsUpdatedAt(meta.rowsUpdatedAt)
    const { count, error } = await db.from('bdua_afiliados').select('id', { count: 'exact', head: true }).eq('corte', corte).eq('fuente', dataset)
    if (error) throw new Error(`bdua_afiliados: ${error.message}`)
    if ((count ?? 0) > 0) {
      resumen.push(`${dataset}: corte ${corte} ya cargado (${fmt(count)} filas)`)
      continue
    }
    if (opts.deadline - Date.now() < MIN_MS_POR_DATASET) {
      pendientes++
      resumen.push(`${dataset}: corte ${corte} pendiente (sigue en la próxima ejecución)`)
      continue
    }
    geo = geo ?? (await loadGeo(db))
    const resolver = createMunicipioResolver({ ...geo, fuente: ALIAS_FUENTE_BDUA })
    const r = await cargarDatasetBdua({
      db,
      dataset,
      resolver,
      corte: null,
      limit: 50_000,
      loadedAt: new Date().toISOString(),
      dryRun: false,
      log,
      quiet: true,
      timeoutMs: Math.max(10_000, Math.min(TIMEOUT_MS, opts.deadline - Date.now() - 10_000)),
    })
    if (r.blocking) throw new Error(`${dataset} corte ${r.corte}: la suma no cuadra con el total del dataset o hay errores; no se escribió nada (${lines.slice(-3).join(' ').trim()})`)
    if (r.failedBatches > 0) throw new Error(`${dataset} corte ${r.corte}: ${r.failedBatches} lote(s) con error al guardar`)
    filas += r.written
    resumen.push(`${dataset}: corte ${r.corte} cargado, ${fmt(r.written)} filas, ${fmt(r.agg.total)} afiliados (cuadra), ${fmt(r.pruned)} viejas borradas`)
  }
  return {
    terminado: pendientes === 0,
    // Sin cortes nuevos: null para que fuentes_estado conserve las filas de la última carga real
    filas: filas === 0 && pendientes === 0 ? null : filas,
    mensaje: `BDUA · ${resumen.join(' · ')}`,
  }
}
