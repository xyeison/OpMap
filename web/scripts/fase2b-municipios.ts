/**
 * Fase 2b · Motor de municipios (lib/municipality-coverage.ts).
 *
 * Regla del dueño: los municipios SIN IPS se reparten por TIEMPO REAL DE CARRETERA (Google Distance
 * Matrix, driving) desde la ciudad base de cada zona candidata; nunca por línea recta. Sin ruta →
 * "sin acceso terrestre" (no se asigna); por encima del tope de la zona → "fuera de alcance".
 *
 * Modos (desde web/):
 *   npx tsx scripts/fase2b-municipios.ts                       → --dry-run (por defecto)
 *   npx tsx scripts/fase2b-municipios.ts --dry-run             → cuenta municipios por tipo, pares
 *        pendientes, elementos a pedir a Google y costo estimado (0,005 USD/elemento).
 *        NO llama a Google y NO escribe en la BD (solo SELECT). Funciona sin la migración 0500
 *        (si municipality_travel_times no existe asume caché vacía y lo dice).
 *   npx tsx scripts/fase2b-municipios.ts --run --max-elements N
 *        → llama a Google hasta N elementos (tope duro), guarda municipio a municipio en
 *          municipality_travel_times e imprime progreso y total gastado. Requiere la migración 0500,
 *          GOOGLE_MAPS_API_KEY y que GOOGLE_ROUTES_DISABLED no sea 'true'.
 *   npx tsx scripts/fase2b-municipios.ts --assign
 *        → recalcula municipality_zone con lo que haya en caché (sin Google); lo que falte = 'pending'.
 *   (--run --assign hace las dos cosas en ese orden.)
 *
 * Salida: consola + FASE2B_OUTPUT_DIR/fase2b-municipios.md (por defecto, el scratchpad de la sesión).
 */
import path from 'path'
import fs from 'fs'
import dotenv from 'dotenv'
import {
  buildDryRunReport,
  loadMunicipalityInputs,
  planGoogleRequests,
  recomputeAndSaveMunicipalityZones,
  runMunicipalityTravelTimes,
  type DryRunReport,
  type MunicipalityZoneKind,
  type RunSummary,
} from '../lib/municipality-coverage'
import { COST_PER_ELEMENT_USD, googleRoutesDisabled } from '../lib/google-distance'

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') })

const OUTPUT_DIR =
  process.env.FASE2B_OUTPUT_DIR ||
  '/private/tmp/claude-501/-Users-yjxm-Documents-GitHub-OpMap/b96592bc-25ae-4af0-afb9-263556da1e56/scratchpad'
const OUTPUT_MD = path.join(OUTPUT_DIR, 'fase2b-municipios.md')

// ---------------------------------------------------------------------------
// Argumentos
// ---------------------------------------------------------------------------

interface Args {
  dryRun: boolean
  run: boolean
  assign: boolean
  maxElements: number | null
}

function parseArgs(argv: string[]): Args {
  const args: Args = { dryRun: false, run: false, assign: false, maxElements: null }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--dry-run') args.dryRun = true
    else if (arg === '--run') args.run = true
    else if (arg === '--assign') args.assign = true
    else if (arg === '--max-elements' || arg.startsWith('--max-elements=')) {
      const raw = arg.includes('=') ? arg.split('=')[1] : argv[++i]
      const value = Number(raw)
      if (!Number.isInteger(value) || value <= 0) throw new Error(`--max-elements debe ser un entero positivo (recibido: ${raw ?? 'nada'})`)
      args.maxElements = value
    } else {
      throw new Error(`Argumento desconocido: ${arg}`)
    }
  }
  if (args.dryRun && (args.run || args.assign)) throw new Error('--dry-run no se combina con --run ni --assign')
  if (!args.run && !args.assign) args.dryRun = true
  if (args.run && args.maxElements === null) throw new Error('--run exige --max-elements N (tope duro de elementos a pedir a Google)')
  if (!args.run && args.maxElements !== null) throw new Error('--max-elements solo tiene sentido con --run')
  return args
}

// ---------------------------------------------------------------------------
// Formato
// ---------------------------------------------------------------------------

const num = (n: number) => n.toLocaleString('es-CO')
const usd = (n: number) => `${n.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`
const KIND_LABEL: Record<MunicipalityZoneKind, string> = {
  ips: 'Con IPS objetivo (ips)',
  reach: 'De alcance (reach)',
  out_of_reach: 'Fuera de alcance (out_of_reach)',
  no_road: 'Sin acceso terrestre (no_road)',
  pending: 'Pendiente de cálculo (pending)',
}
const KINDS: MunicipalityZoneKind[] = ['ips', 'reach', 'out_of_reach', 'no_road', 'pending']

function reportLines(report: DryRunReport): string[] {
  const t = report.totals
  const p = report.pairs
  const g = report.google
  const lines: string[] = []
  lines.push(
    report.travel_times_table_missing
      ? 'Caché: la tabla municipality_travel_times NO existe todavía (migración 0500 sin aplicar): se asume caché vacía.'
      : 'Caché: municipality_travel_times disponible.'
  )
  lines.push(`Municipios: ${num(t.municipalities)}`)
  lines.push(`  Con IPS objetivo (kind 'ips', regla de mayoría por camas): ${num(t.with_ips)}`)
  lines.push(`  Municipio base de una zona, sin IPS ('reach' a 0 min, sin Google): ${num(t.base_without_ips)}`)
  lines.push(`  Sin ninguna zona candidata por adyacencia ('out_of_reach', sin Google): ${num(t.no_candidates)}`)
  lines.push(`  Necesitan tiempo por carretera: ${num(t.need_travel_time)}${t.no_coordinates ? ` (sin coordenadas: ${num(t.no_coordinates)})` : ''}`)
  lines.push(
    `Pares zona→municipio candidatos: ${num(p.candidate_pairs)} (en caché: ok ${num(p.cached_ok)} · sin ruta ${num(p.cached_no_route)} · ` +
      `error a reintentar ${num(p.cached_error)} · sin calcular ${num(p.missing)}) → pendientes ${num(p.pending)}`
  )
  lines.push(
    `Zonas candidatas por municipio: mín ${report.candidates_per_municipality.min} · promedio ${report.candidates_per_municipality.avg} · máx ${report.candidates_per_municipality.max}`
  )
  lines.push(
    `Google: ${num(g.requests)} peticiones · ${num(g.elements)} elementos · costo estimado ${usd(g.cost_usd)} ` +
      `(a ${String(report.cost_per_element_usd).replace('.', ',')} USD/elemento)`
  )
  lines.push(`  de ellos en departamentos excluidos: ${num(g.elements_excluded_departments)} elementos (${usd(g.cost_excluded_departments_usd)}); se piden al final`)
  lines.push(
    `  Dato informativo: si las zonas de Bogotá compartieran un solo origen serían ${num(g.elements_if_single_bogota_origin)} elementos ` +
      `(${usd(Math.round(g.elements_if_single_bogota_origin * COST_PER_ELEMENT_USD * 100) / 100)}); hoy se pide cada ciudad base por separado.`
  )
  lines.push(`Resultado de --assign con la caché actual: ${KINDS.map(k => `${k} ${num(report.preview[k])}`).join(' · ')}`)
  return lines
}

function reportMarkdown(report: DryRunReport): string {
  const out: string[] = []
  out.push('## Resumen', '')
  for (const line of reportLines(report)) out.push(`- ${line.trim()}`)
  out.push('', '## Resultado de `--assign` con la caché actual', '', '| Tipo | Municipios |', '|---|---:|')
  for (const kind of KINDS) out.push(`| ${KIND_LABEL[kind]} | ${num(report.preview[kind])} |`)
  out.push('', '## Por departamento', '')
  out.push('| Código | Departamento | Excluido | Municipios | Con IPS | Por carretera | Sin candidata | Elementos a pedir |')
  out.push('|---|---|:---:|---:|---:|---:|---:|---:|')
  for (const d of report.by_department) {
    out.push(
      `| ${d.code} | ${d.name} | ${d.excluded ? 'sí' : ''} | ${num(d.municipalities)} | ${num(d.with_ips)} | ${num(d.need_travel_time)} | ${num(d.no_candidates)} | ${num(d.elements)} |`
    )
  }
  out.push('', '## Por zona (origen de las peticiones)', '', '| Zona | Municipios candidatos | Elementos a pedir |', '|---|---:|---:|')
  for (const z of report.by_zone) out.push(`| ${z.name} | ${num(z.candidate_municipalities)} | ${num(z.elements)} |`)
  if (report.no_candidates.length > 0) {
    out.push('', '## Municipios sin zona candidata por adyacencia (quedan "fuera de alcance", sin consultar a Google)', '')
    out.push('| Código | Municipio | Departamento |', '|---|---|---|')
    for (const m of report.no_candidates) out.push(`| ${m.code} | ${m.name} | ${m.department} |`)
  }
  return out.join('\n')
}

function runSummaryLines(summary: RunSummary, maxElements: number): string[] {
  return [
    `Fin: ${summary.stop_reason}${summary.stop_detail ? ` (${summary.stop_detail})` : ''}`,
    `Peticiones: ${num(summary.requests_done)} hechas de ${num(summary.planned_requests)} planificadas · fallidas ${num(summary.requests_failed)}`,
    `Elementos reservados: ${num(summary.elements_reserved)} de un tope de ${num(maxElements)}`,
    `Total gastado (peor caso): ${num(summary.elements_billed)} elementos = ${usd(summary.cost_usd)}` +
      (summary.billing_uncertain_requests ? ` · ${num(summary.billing_uncertain_requests)} peticiones con facturación incierta` : ''),
    `Guardado en municipality_travel_times: ok ${num(summary.saved_ok)} · sin ruta ${num(summary.saved_no_route)} · error ${num(summary.saved_error)}`,
    `Pendiente tras esta ejecución: ${num(summary.remaining_requests)} peticiones · ${num(summary.remaining_elements)} elementos ` +
      `(${usd(Math.round(summary.remaining_elements * COST_PER_ELEMENT_USD * 100) / 100)})`,
  ]
}

function writeMarkdown(title: string, sections: string[]) {
  const body = [`# ${title}`, '', `Generado: ${new Date().toISOString()}`, '', ...sections, ''].join('\n')
  try {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true })
    fs.writeFileSync(OUTPUT_MD, body, 'utf8')
    console.log(`\nResumen escrito en ${OUTPUT_MD}`)
  } catch (error) {
    console.warn(`No se pudo escribir ${OUTPUT_MD}:`, error instanceof Error ? error.message : error)
  }
}

// ---------------------------------------------------------------------------
// Modos
// ---------------------------------------------------------------------------

async function dryRun() {
  console.log('Fase 2b · Municipios — DRY-RUN (no se llama a Google ni se escribe en la BD)\n')
  const inputs = await loadMunicipalityInputs()
  const report = buildDryRunReport(inputs)
  for (const line of reportLines(report)) console.log(line)
  console.log('\nPor departamento (municipios por carretera → elementos):')
  for (const d of report.by_department) {
    if (d.need_travel_time === 0 && d.no_candidates === 0) continue
    console.log(
      `  ${d.code} ${d.name.padEnd(26)}${d.excluded ? ' [excluido]' : '           '} ${String(d.need_travel_time).padStart(4)} mun. → ${String(d.elements).padStart(5)} elem.` +
        (d.no_candidates ? ` · ${d.no_candidates} sin candidata` : '')
    )
  }
  console.log('\nPor zona (origen):')
  for (const z of report.by_zone) console.log(`  ${z.name.padEnd(16)} ${String(z.elements).padStart(5)} elem.`)
  writeMarkdown('Fase 2b · Municipios — dry-run', [reportMarkdown(report)])
}

async function run(maxElements: number): Promise<string[]> {
  console.log(`Fase 2b · Municipios — RUN (Google Distance Matrix, tope ${num(maxElements)} elementos)\n`)
  if (googleRoutesDisabled()) throw new Error('GOOGLE_ROUTES_DISABLED=true: abortado sin llamar a Google')
  if (!process.env.GOOGLE_MAPS_API_KEY) throw new Error('Falta GOOGLE_MAPS_API_KEY en .env.local')

  const inputs = await loadMunicipalityInputs()
  if (inputs.travelTimesTableMissing) {
    throw new Error('La tabla municipality_travel_times no existe: aplica antes la migración 2026-10-11_0500_fase2b_municipios_anexos.sql')
  }
  const plan = planGoogleRequests(inputs)
  const plannedElements = plan.reduce((sum, request) => sum + request.zones.length, 0)
  console.log(`Plan: ${num(plan.length)} peticiones · ${num(plannedElements)} elementos pendientes (${usd(Math.round(plannedElements * COST_PER_ELEMENT_USD * 100) / 100)})`)
  console.log(`Se pedirán como mucho ${num(Math.min(maxElements, plannedElements))} elementos.\n`)
  if (plan.length === 0) return ['Nada pendiente: la caché ya cubre todos los pares candidatos.']

  const departments = new Map(inputs.departments.map(d => [d.code, d.name]))
  const summary = await runMunicipalityTravelTimes(plan, {
    maxElements,
    concurrency: 3,
    onProgress: event => {
      const m = event.municipality
      console.log(
        `[${event.index}/${event.total}] ${m.code} ${m.name} (${departments.get(m.department_code) ?? m.department_code}): ` +
          `${event.elements} elem. → ok ${event.ok} · sin ruta ${event.no_route} · error ${event.error}` +
          (event.response_status !== 'OK' ? ` [${event.response_status}]` : '') +
          ` · gastado ${num(event.elements_billed)} (${usd(Math.round(event.elements_billed * COST_PER_ELEMENT_USD * 100) / 100)}) · reservado ${num(event.elements_reserved)}/${num(event.max_elements)}`
      )
    },
  })
  const lines = runSummaryLines(summary, maxElements)
  console.log('')
  for (const line of lines) console.log(line)
  if (summary.stop_reason === 'fatal' || summary.stop_reason === 'persist_error') process.exitCode = 1
  return lines
}

async function assign(): Promise<string[]> {
  console.log('Fase 2b · Municipios — ASSIGN (municipality_zone con la caché actual; sin Google)\n')
  const result = await recomputeAndSaveMunicipalityZones()
  const lines = [
    ...(result.travel_times_table_missing ? ['Aviso: municipality_travel_times no existe; todo lo que necesita tiempo por carretera queda pending.'] : []),
    `municipality_zone guardada (${num(result.rows.length)} municipios, computed_at ${result.computed_at}):`,
    ...KINDS.map(kind => `  ${KIND_LABEL[kind]}: ${num(result.counts[kind])}`),
  ]
  for (const line of lines) console.log(line)
  return lines
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.dryRun) {
    await dryRun()
    return
  }
  const sections: string[] = []
  if (args.run) {
    const lines = await run(args.maxElements as number)
    sections.push('## --run', '', ...lines.map(line => `- ${line}`), '')
  }
  if (args.assign) {
    const lines = await assign()
    sections.push('## --assign', '', ...lines.map(line => `- ${line.trim()}`), '')
  }
  // Estado tras la ejecución (solo lectura)
  const report = buildDryRunReport(await loadMunicipalityInputs())
  sections.push('## Estado después', '', reportMarkdown(report))
  writeMarkdown(`Fase 2b · Municipios — ${[args.run ? '--run' : '', args.assign ? '--assign' : ''].filter(Boolean).join(' ')}`, sections)
}

main().catch(error => {
  console.error('ERROR:', error instanceof Error ? error.message : error)
  process.exit(1)
})
