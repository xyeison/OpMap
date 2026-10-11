/**
 * Fase 4 · Carga de afiliados de la BDUA (ADRES) en public.bdua_afiliados.
 *
 * Fuente: datos.gov.co (Socrata), datos abiertos de la ADRES:
 *   - tq4m-hmg2 "Población BDUA del régimen contributivo" (cantidad numérica)
 *   - d7a5-cnra "Población BDUA del régimen subsidiado"   (cantidad es TEXTO: sum(cantidad::number))
 * Cada fila del dataset es un grupo (género, grupo etario, EPS, tipo de afiliado, estado, zona,
 * departamento, municipio, Sisbén…) con su cantidad. Aquí se pide AGREGADO por departamento, municipio,
 * régimen, EPS (ent_id, ent_nombre), estado y zona, paginado con $limit/$offset y orden estable, y se
 * comprueba que la suma de las páginas sea igual al total del dataset (si no, no se escribe nada).
 *
 * La BDUA publica NOMBRES (p. ej. "VALLE / BUGA"), no códigos DANE: se resuelven con
 * lib/municipio-alias.ts (municipalities + municipio_alias, fuente 'bdua'). Lo que no cruza se guarda
 * igual con municipality_code NULL y sale en el informe.
 *
 * corte = fecha (hora de Colombia) de rowsUpdatedAt del dataset (api/views/<id>.json), o --corte.
 * Upsert por (corte, regimen, departamento_bdua, municipio_bdua, eps_id, estado, zona); al terminar sin
 * errores, borra las filas de ese corte y dataset que no vinieron en esta carga (p. ej. tras añadir un
 * alias). No llama a Google. Peticiones HTTP normales con un User-Agent que identifica al script.
 *
 * Uso (desde web/):
 *   npx tsx scripts/bdua-load.ts                       → los dos datasets, corte de cada uno
 *   npx tsx scripts/bdua-load.ts --dry-run             → consulta y cruza, no escribe
 *   npx tsx scripts/bdua-load.ts --dataset d7a5-cnra --corte 2026-10-02
 *   --limit N (por página, 50.000) · --save-dir DIR (guarda las páginas JSON crudas)
 */
import path from 'path'
import fs from 'fs'
import dotenv from 'dotenv'
import { ALIAS_FUENTE_BDUA, createMunicipioResolver } from '../lib/municipio-alias'
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
} from '../lib/poblacion-parse'
import { fmt, loadGeo, pct, upsertBatches } from './_poblacion-db'

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') })

const BASE = 'https://www.datos.gov.co'
const USER_AGENT = 'OpMap-BDUA/1.0 (carga de afiliados BDUA por municipio; datos abiertos)'
const TIMEOUT_MS = 180_000
const RETRIES = 3

interface Args {
  datasets: BduaDatasetId[]
  corte: string | null
  dryRun: boolean
  limit: number
  saveDir: string | null
}

function parseArgs(argv: string[]): Args {
  const args: Args = { datasets: Object.keys(BDUA_DATASETS) as BduaDatasetId[], corte: null, dryRun: false, limit: 50_000, saveDir: null }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    const next = () => {
      const value = argv[++i]
      if (value === undefined) throw new Error(`Falta el valor de ${arg}`)
      return value
    }
    if (arg === '--dry-run') args.dryRun = true
    else if (arg === '--corte') args.corte = next()
    else if (arg === '--limit') args.limit = Number(next())
    else if (arg === '--save-dir') args.saveDir = path.resolve(next())
    else if (arg === '--dataset') {
      args.datasets = next().split(',').map(s => s.trim()) as BduaDatasetId[]
      for (const d of args.datasets) if (!(d in BDUA_DATASETS)) throw new Error(`Dataset desconocido: ${d} (usa tq4m-hmg2 y/o d7a5-cnra)`)
    } else throw new Error(`Argumento desconocido: ${arg}`)
  }
  if (args.corte !== null && (!/^\d{4}-\d{2}-\d{2}$/.test(args.corte) || Number.isNaN(Date.parse(`${args.corte}T00:00:00Z`)))) {
    throw new Error('--corte debe ser AAAA-MM-DD')
  }
  if (!Number.isInteger(args.limit) || args.limit < 1000 || args.limit > 50_000) throw new Error('--limit entre 1.000 y 50.000')
  return args
}

async function getJson<T>(url: string): Promise<T> {
  let lastError: unknown = null
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' }, signal: AbortSignal.timeout(TIMEOUT_MS) })
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

interface DatasetResult {
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
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const loadedAt = new Date().toISOString()
  if (args.saveDir) fs.mkdirSync(args.saveDir, { recursive: true })

  const { getSupabaseAdmin } = await import('../lib/supabase-admin')
  const db = getSupabaseAdmin()
  const geo = await loadGeo(db)
  const resolver = createMunicipioResolver({ ...geo, fuente: ALIAS_FUENTE_BDUA })
  console.log(`Geografía: ${fmt(geo.municipalities.length)} municipios · ${geo.departments.length} departamentos · ${geo.aliases.length} alias`)

  const results: DatasetResult[] = []
  for (const dataset of args.datasets) {
    const meta = await getJson<{ name?: string; rowsUpdatedAt?: number }>(`${BASE}/api/views/${dataset}.json`)
    if (!meta.rowsUpdatedAt) throw new Error(`${dataset}: la metadata no trae rowsUpdatedAt`)
    const corte = args.corte ?? corteFromRowsUpdatedAt(meta.rowsUpdatedAt)
    const totalRow = (await getJson<{ afiliados?: string; filas?: string }[]>(buildBduaTotalUrl(dataset, BASE)))[0] ?? {}
    const datasetTotal = toCount(totalRow.afiliados) ?? NaN
    const datasetFilas = toCount(totalRow.filas) ?? NaN
    console.log(`\n${dataset} · ${meta.name ?? ''}`)
    console.log(`  rowsUpdatedAt ${new Date(meta.rowsUpdatedAt * 1000).toISOString()} → corte ${corte}${args.corte ? ' (por --corte)' : ''}`)
    console.log(`  total del dataset: ${fmt(datasetTotal)} afiliados en ${fmt(datasetFilas)} filas`)

    const rows: BduaSoqlRow[] = []
    let pages = 0
    for (let offset = 0; ; offset += args.limit) {
      const page = await getJson<BduaSoqlRow[]>(buildBduaSoqlUrl(dataset, { limit: args.limit, offset }, BASE))
      pages++
      rows.push(...page)
      if (args.saveDir) fs.writeFileSync(path.join(args.saveDir, `${dataset}-${corte}-p${pages}.json`), JSON.stringify(page))
      process.stdout.write(`\r  página ${pages}: ${fmt(rows.length)} grupos`)
      if (page.length < args.limit) break
      if (pages > 100) throw new Error('Más de 100 páginas: algo no cuadra')
    }
    process.stdout.write('\n')

    const agg = aggregateBduaRows({ rows, corte, fuente: dataset, resolver })
    const expected = BDUA_DATASETS[dataset].regimen
    const otherRegimen = Object.keys(agg.byRegimen).filter(r => r !== expected)
    const sumOk = agg.total === datasetTotal
    console.log(`  suma de las páginas: ${fmt(agg.total)} (${sumOk ? 'cuadra con el total del dataset' : 'NO cuadra con el total del dataset'})`)
    console.log(`  filas a guardar: ${fmt(agg.rows.length)} · errores: ${agg.errors.length}${otherRegimen.length ? ` · régimen inesperado: ${otherRegimen.join(', ')}` : ''}`)
    agg.errors.slice(0, 10).forEach(e => console.log(`    - ${e}`))

    let written = 0
    let failedBatches = 0
    let pruned = 0
    const blocking = !sumOk || agg.errors.length > 0 || otherRegimen.length > 0
    if (blocking) {
      console.log('  Problemas bloqueantes: no se escribe este dataset.')
      process.exitCode = 1
    } else if (!args.dryRun) {
      const toWrite = agg.rows.map(r => ({ ...r, loaded_at: loadedAt }))
      const res = await upsertBatches(db, 'bdua_afiliados', toWrite, 'corte,regimen,departamento_bdua,municipio_bdua,eps_id,estado,zona', 1000, `  bdua_afiliados ${dataset}`)
      written = res.written
      failedBatches = res.failedBatches
      if (failedBatches === 0) {
        const { count, error } = await db.from('bdua_afiliados').delete({ count: 'exact' }).eq('corte', corte).eq('fuente', dataset).lt('loaded_at', loadedAt)
        if (error) throw new Error(`poda ${dataset} ${corte}: ${error.message}`)
        pruned = count ?? 0
      } else process.exitCode = 1
    }
    results.push({ dataset, corte, rowsUpdatedAt: new Date(meta.rowsUpdatedAt * 1000).toISOString(), datasetTotal, datasetFilas, pages, grupos: rows.length, agg, written, failedBatches, pruned })
  }

  // Informe conjunto
  console.log('\n=== Resumen BDUA ===')
  let total = 0
  let cruzados = 0
  const sinCruce = new Map<string, number>()
  const nombresPorCodigo = new Map<string, Set<string>>()
  for (const r of results) {
    total += r.agg.total
    cruzados += r.agg.cruzados
    for (const [k, v] of Array.from(r.agg.sinCruce.entries())) sinCruce.set(k, (sinCruce.get(k) ?? 0) + v)
    for (const row of r.agg.rows) {
      if (!row.municipality_code) continue
      const set = nombresPorCodigo.get(row.municipality_code) ?? new Set<string>()
      set.add(`${row.departamento_bdua} / ${row.municipio_bdua}`)
      nombresPorCodigo.set(row.municipality_code, set)
    }
    for (const [regimen, s] of Object.entries(r.agg.byRegimen)) {
      console.log(
        `${r.dataset} (${regimen}, corte ${r.corte}): ${fmt(s.total)} afiliados (activos ${fmt(s.activos)}; otros estados ${fmt(s.total - s.activos)}) · cruzados con código DANE ${fmt(s.cruzados)} (${pct(s.cruzados, s.total, 3)})`
      )
    }
    console.log(`  ${fmt(r.grupos)} grupos en ${r.pages} página(s) → ${fmt(r.agg.rows.length)} filas · escritas ${fmt(r.written)} (${r.failedBatches} lotes con error) · borradas por poda ${fmt(r.pruned)}`)
    console.log(`  resueltos por alias: ${r.agg.viaAlias.size} nombres (${fmt(Array.from(r.agg.viaAlias.values()).reduce((a, b) => a + b, 0))} afiliados)`)
  }
  console.log(`Total: ${fmt(total)} afiliados · cruzados ${fmt(cruzados)} (${pct(cruzados, total, 3)}) · sin cruce ${fmt(total - cruzados)}`)
  console.log(`Nombres sin cruce (${sinCruce.size}):`)
  Array.from(sinCruce.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([k, v]) => console.log(`  - ${k}: ${fmt(v)}`))
  const multi = Array.from(nombresPorCodigo.entries()).filter(([, s]) => s.size > 1)
  console.log(`Códigos DANE con más de un nombre en la BDUA: ${multi.length}`)
  multi.forEach(([code, s]) => console.log(`  - ${code}: ${Array.from(s).join(' | ')}`))
  if (args.dryRun) console.log('\n--dry-run: no se escribió nada.')
  else {
    for (const r of results) {
      const { count, error } = await db.from('bdua_afiliados').select('id', { count: 'exact', head: true }).eq('corte', r.corte).eq('fuente', r.dataset)
      if (error) throw new Error(error.message)
      console.log(`bdua_afiliados en la base (${r.dataset}, corte ${r.corte}): ${fmt(count ?? 0)} filas`)
    }
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
