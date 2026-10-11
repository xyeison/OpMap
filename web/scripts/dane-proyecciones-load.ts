/**
 * Fase 4 · Carga de las proyecciones municipales del DANE en public.dane_proyecciones.
 *
 * Fuente: DANE, "Proyecciones de población municipal por área 2020-2035" (actualización post
 * COVID-19, marzo de 2023): DCD-area-proypoblacion-Mun-2020-2035-ActPostCOVID-19.xlsx, hoja "Hoja1",
 * columnas DP, DPNOM, MPIO, DPMP, AÑO, ÁREA GEOGRÁFICA, Población (una fila por municipio, año y área:
 * Cabecera Municipal / Centros Poblados y Rural Disperso / Total). También lee el archivo 2018-2042
 * (hoja PobMunicipalxÁrea, columna TOTAL) si se pasa con --file y --fuente.
 *
 * Por defecto carga 2024-2030 (total, cabecera y resto). Compara el año 2025 con
 * municipalities.population_2025 y reporta diferencias > 5 %. NO modifica municipalities.
 *
 * Uso (desde web/):
 *   npx tsx scripts/dane-proyecciones-load.ts --file /ruta/DCD-...-2020-2035-ActPostCOVID-19.xlsx
 *   npx tsx scripts/dane-proyecciones-load.ts --file ... --desde 2024 --hasta 2030 --dry-run
 *   npx tsx scripts/dane-proyecciones-load.ts --file /ruta/PPED-AreaMun-2018-2042_VP.xlsx --fuente dane_2018_2042_vp --dry-run
 * Upsert por (municipality_code, anio): volver a cargar deja la tabla igual. No llama a Google.
 */
import path from 'path'
import fs from 'fs'
import dotenv from 'dotenv'
import { readDaneWorkbook, relativeDiff } from '../lib/poblacion-parse'
import { fetchAll, fmt, loadGeo, upsertBatches } from './_poblacion-db'

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') })

interface Args {
  file: string | null
  desde: number
  hasta: number
  dryRun: boolean
  fuente: string
  umbral: number
  compareYear: number
}

function parseArgs(argv: string[]): Args {
  const args: Args = { file: null, desde: 2024, hasta: 2030, dryRun: false, fuente: 'dane_2020_2035_postcovid', umbral: 0.05, compareYear: 2025 }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    const next = () => {
      const value = argv[++i]
      if (value === undefined) throw new Error(`Falta el valor de ${arg}`)
      return value
    }
    if (arg === '--file') args.file = next()
    else if (arg === '--desde') args.desde = Number(next())
    else if (arg === '--hasta') args.hasta = Number(next())
    else if (arg === '--fuente') args.fuente = next()
    else if (arg === '--umbral') args.umbral = Number(next())
    else if (arg === '--dry-run') args.dryRun = true
    else throw new Error(`Argumento desconocido: ${arg}`)
  }
  if (!args.file) throw new Error('Falta --file /ruta/al/xlsx de proyecciones del DANE')
  if (!Number.isInteger(args.desde) || !Number.isInteger(args.hasta) || args.desde > args.hasta) throw new Error('--desde/--hasta inválidos')
  if (!/^[a-z0-9_]+$/.test(args.fuente)) throw new Error('--fuente solo admite minúsculas, dígitos y _')
  if (!(args.umbral > 0 && args.umbral < 1)) throw new Error('--umbral debe estar entre 0 y 1 (0.05 = 5 %)')
  return args
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const file = path.resolve(args.file as string)
  const loadedAt = new Date().toISOString()

  const parsed = readDaneWorkbook(new Uint8Array(fs.readFileSync(file)), { desde: args.desde, hasta: args.hasta })
  const codes = new Set(parsed.rows.map(r => r.municipality_code))
  const totalsByYear = new Map<number, number>()
  for (const r of parsed.rows) totalsByYear.set(r.anio, (totalsByYear.get(r.anio) ?? 0) + r.total)

  console.log(`Archivo: ${file}`)
  console.log(`Hoja: ${parsed.sheet} · años ${parsed.years.join(', ')} · ${fmt(parsed.rows.length)} filas (municipio × año) · ${fmt(codes.size)} municipios`)
  console.log(`Errores de lectura: ${parsed.errors.length}`)
  parsed.errors.slice(0, 10).forEach(e => console.log(`  - ${e}`))
  for (const [anio, total] of Array.from(totalsByYear.entries()).sort((a, b) => a[0] - b[0])) {
    console.log(`  ${anio}: población total ${fmt(total)}`)
  }
  if (parsed.errors.length > 0) {
    process.exitCode = 1
    console.log('Hay errores de lectura: no se escribe nada.')
    return
  }

  const { getSupabaseAdmin } = await import('../lib/supabase-admin')
  const db = getSupabaseAdmin()
  const { municipalities } = await loadGeo(db)
  const byCode = new Map(municipalities.map(m => [m.code, m]))

  // Comparación con municipalities.population_2025 (solo informe)
  const proyAnio = new Map(parsed.rows.filter(r => r.anio === args.compareYear).map(r => [r.municipality_code, r.total]))
  const fuera = Array.from(codes).filter(c => !byCode.has(c)).sort()
  const sinProyeccion = municipalities.filter(m => !proyAnio.has(m.code))
  const diffs: { code: string; name: string; dane: number; actual: number | null; diff: number }[] = []
  let sumDane = 0
  let sumActual = 0
  let compared = 0
  let identical = 0
  for (const m of municipalities) {
    const dane = proyAnio.get(m.code)
    if (dane === undefined) continue
    compared++
    if (dane === m.population_2025) identical++
    sumDane += dane
    sumActual += m.population_2025 ?? 0
    const d = relativeDiff(dane, m.population_2025)
    if (d === null || Math.abs(d) > args.umbral) diffs.push({ code: m.code, name: m.name, dane, actual: m.population_2025, diff: d ?? Infinity })
  }
  diffs.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
  console.log(`\nComparación ${args.compareYear} (DANE) vs municipalities.population_2025 (no se modifica municipalities):`)
  console.log(`  municipios comparados: ${fmt(compared)} · suma DANE ${fmt(sumDane)} · suma municipalities ${fmt(sumActual)}`)
  console.log(`  idénticos: ${fmt(identical)} · diferencias > ${(args.umbral * 100).toFixed(0)} %: ${diffs.length}`)
  diffs.slice(0, 40).forEach(d =>
    console.log(`    ${d.code} ${d.name}: DANE ${fmt(d.dane)} vs ${fmt(d.actual)} (${Number.isFinite(d.diff) ? `${(d.diff * 100).toFixed(1)} %` : 'sin población actual'})`)
  )
  console.log(`  códigos del archivo que no están en municipalities: ${fuera.length ? fuera.map(c => `${c} ${parsed.names.get(c) ?? ''}`.trim()).join(', ') : 'ninguno'} (se cargan igual)`)
  console.log(`  municipios de municipalities sin proyección ${args.compareYear}: ${sinProyeccion.length ? sinProyeccion.map(m => `${m.code} ${m.name}`).join(', ') : 'ninguno'}`)

  if (args.dryRun) {
    console.log('\n--dry-run: no se escribió nada.')
    return
  }

  const rows = parsed.rows.map(r => ({ ...r, fuente: args.fuente, loaded_at: loadedAt }))
  const { written, failedBatches } = await upsertBatches(db, 'dane_proyecciones', rows, 'municipality_code,anio', 1000, 'dane_proyecciones')
  const stored = await fetchAll<{ anio: number; total: number }>((from, to) =>
    db.from('dane_proyecciones').select('anio, total').gte('anio', args.desde).lte('anio', args.hasta).order('municipality_code').order('anio').range(from, to)
  )
  const storedByYear = new Map<number, { n: number; total: number }>()
  for (const s of stored) {
    const item = storedByYear.get(s.anio) ?? { n: 0, total: 0 }
    item.n++
    item.total += s.total
    storedByYear.set(s.anio, item)
  }
  console.log('\nResumen:')
  console.log(`  upsert: ${fmt(written)} filas (${failedBatches} lotes con error)`)
  for (const [anio, s] of Array.from(storedByYear.entries()).sort((a, b) => a[0] - b[0])) {
    console.log(`  dane_proyecciones ${anio}: ${fmt(s.n)} municipios · total ${fmt(s.total)}`)
  }
  if (failedBatches > 0) process.exitCode = 1
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
