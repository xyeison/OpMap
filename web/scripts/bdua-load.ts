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
import { BDUA_DATASETS, type BduaDatasetId } from '../lib/poblacion-parse'
import { cargarDatasetBdua, type BduaDatasetResult } from '../lib/bdua-sync'
import { fmt, loadGeo, pct } from './_poblacion-db'

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') })

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

// Consulta, agregación, cuadre, upsert y poda de cada dataset: lib/bdua-sync.ts (compartido con el cron, PR 7).
type DatasetResult = BduaDatasetResult

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
    const r = await cargarDatasetBdua({
      db,
      dataset,
      resolver,
      corte: args.corte,
      limit: args.limit,
      loadedAt,
      dryRun: args.dryRun,
      log: line => console.log(line),
      progress: text => process.stdout.write(text),
      onPage: args.saveDir ? (page, n, corte) => fs.writeFileSync(path.join(args.saveDir as string, `${dataset}-${corte}-p${n}.json`), JSON.stringify(page)) : undefined,
    })
    if (r.blocking || r.failedBatches > 0) process.exitCode = 1
    results.push(r)
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
