/**
 * Fase 4 · Carga de las cifras mensuales de afiliación de MinSalud en public.afiliacion_cifras.
 *
 * Fuente: MinSalud, "Cifras de aseguramiento en salud": un ZIP por mes con "CIFRAS <MES>-<AÑO>.xlsx"
 * (9 hojas). Se lee la hoja CoberturaMunicipio: fila 1 título ("CIFRAS AGOSTO-2026"), fila 2
 * encabezados, una fila por municipio y una final "Total general" (o "Total").
 *   - feb-2026 en adelante: IdDepartamento, Departamento, IdMunicipio, Municipio, Contributivo,
 *     Subsidiado, Excepción & Especiales, Afiliados, Población, Cobertura, + 4 columnas de SISBEN.
 *   - jul-2025 a ene-2026: las mismas sin IdDepartamento ni IdMunicipio (solo nombres).
 * Estructura completa: docs/fases/fase4-poblacion.md.
 *
 * Código DANE de cada fila, en este orden:
 *   1. IdMunicipio del archivo                                     → codigo_origen 'archivo'
 *   2. nombre en municipalities o alias en municipio_alias         → 'nombre' | 'alias'
 *   3. mismo departamento + municipio en un archivo con IdMunicipio (de esta corrida o ya cargado):
 *      cubre las filas que no son municipio ("SIN UBICACIÓN" 00000, "AMAZONAS-SM" 91000…) → 'aprendido'
 *   Si 2 y 3 dan códigos distintos, la fila NO se carga y se reporta. Sin código → no se carga.
 * Los nombres con código que no coinciden con municipalities.name se guardan en municipio_alias
 * (fuente minsalud_cifras), solo si el código existe en municipalities.
 *
 * corte = último día del mes del archivo. Upsert por (corte, municipality_code); al terminar sin
 * errores, borra las filas de ese corte que no vinieron en esta carga. No llama a Google.
 *
 * Uso (desde web/):
 *   npx tsx scripts/minsalud-cifras-load.ts --dir /ruta/zips             → todos los .zip y .xlsx
 *   npx tsx scripts/minsalud-cifras-load.ts --file /ruta/cifras-agosto2026.zip [--file ...]
 *   npx tsx scripts/minsalud-cifras-load.ts --dir /ruta/zips --dry-run   → solo lee y cuadra
 *   --no-alias  no escribe alias aprendidos en municipio_alias
 */
import path from 'path'
import fs from 'fs'
import dotenv from 'dotenv'
import { ALIAS_FUENTE_MINSALUD, computeCobertura, createMunicipioResolver, normalizeMunicipioName } from '../lib/municipio-alias'
import {
  cifrasNameKey,
  extractXlsxFromZip,
  parseCifrasCorte,
  readCifrasWorkbook,
  sumCifras,
  type CifrasSheet,
} from '../lib/poblacion-parse'
import { fetchAll, fmt, loadGeo, upsertBatches } from './_poblacion-db'

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') })

/** Cifras nacionales de agosto-2026 publicadas en el tablero de MinSalud (para cuadrar). */
const TABLERO_AGOSTO_2026 = { corte: '2026-08-31', afiliados: 52_553_613, poblacion: 53_451_430 }

interface Args {
  files: string[]
  dryRun: boolean
  alias: boolean
}

function parseArgs(argv: string[]): Args {
  const args: Args = { files: [], dryRun: false, alias: true }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--dry-run') args.dryRun = true
    else if (arg === '--no-alias') args.alias = false
    else if (arg === '--file') args.files.push(path.resolve(argv[++i] ?? ''))
    else if (arg === '--dir') {
      const dir = path.resolve(argv[++i] ?? '')
      for (const name of fs.readdirSync(dir).sort()) {
        if (/\.(zip|xlsx)$/i.test(name) && !name.startsWith('.')) args.files.push(path.join(dir, name))
      }
    } else throw new Error(`Argumento desconocido: ${arg}`)
  }
  if (args.files.length === 0) throw new Error('Falta --dir /carpeta o --file /ruta.zip')
  return args
}

interface LoadedFile {
  file: string
  xlsxName: string
  sheet: CifrasSheet
  corte: string
}

interface OutRow {
  corte: string
  municipality_code: string
  department_code: string | null
  departamento_nombre: string
  municipio_nombre: string
  contributivo: number | null
  subsidiado: number | null
  excepcion_especiales: number | null
  afiliados: number
  poblacion_dane: number | null
  cobertura: number | null
  codigo_origen: 'archivo' | 'nombre' | 'alias' | 'aprendido'
  archivo: string
  fuente: string
  loaded_at: string
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const loadedAt = new Date().toISOString()

  // 1. Leer y validar cada archivo
  const loaded: LoadedFile[] = []
  let readErrors = 0
  for (const file of args.files) {
    try {
      const bytes = new Uint8Array(fs.readFileSync(file))
      const xlsx = /\.zip$/i.test(file) ? extractXlsxFromZip(bytes) : { name: path.basename(file), bytes }
      const sheet = readCifrasWorkbook(xlsx.bytes)
      const corte = sheet.corte ?? parseCifrasCorte(path.basename(xlsx.name)) ?? parseCifrasCorte(path.basename(file))
      if (!corte) throw new Error(`no se reconoce el mes (título "${sheet.title}")`)
      if (sheet.errors.length > 0) throw new Error(`${sheet.errors.length} errores de lectura: ${sheet.errors.slice(0, 3).join(' | ')}`)
      loaded.push({ file, xlsxName: path.basename(xlsx.name), sheet, corte })
    } catch (error) {
      readErrors++
      console.error(`${path.basename(file)}: ${error instanceof Error ? error.message : error}`)
    }
  }
  const cortes = new Map<string, LoadedFile>()
  for (const f of loaded) {
    if (cortes.has(f.corte)) throw new Error(`Dos archivos para el corte ${f.corte}: ${path.basename(cortes.get(f.corte)!.file)} y ${path.basename(f.file)}`)
    cortes.set(f.corte, f)
  }

  // 2. Geografía, alias y nombres aprendidos
  const { getSupabaseAdmin } = await import('../lib/supabase-admin')
  const db = getSupabaseAdmin()
  const geo = await loadGeo(db)
  const validCodes = new Set(geo.municipalities.map(m => m.code))
  const resolver = createMunicipioResolver({ ...geo, fuente: ALIAS_FUENTE_MINSALUD })

  const learned = new Map<string, string>()
  const learnedConflicts = new Set<string>()
  const learn = (departamento: string, municipio: string, code: string) => {
    const k = cifrasNameKey(departamento, municipio)
    const prev = learned.get(k)
    if (prev && prev !== code) learnedConflicts.add(`${departamento} / ${municipio}: ${prev} y ${code}`)
    else learned.set(k, code)
  }
  const previous = await fetchAll<{ departamento_nombre: string | null; municipio_nombre: string | null; municipality_code: string }>((from, to) =>
    db
      .from('afiliacion_cifras')
      .select('departamento_nombre, municipio_nombre, municipality_code')
      .eq('codigo_origen', 'archivo')
      .order('corte')
      .order('municipality_code')
      .range(from, to)
  )
  for (const p of previous) if (p.departamento_nombre && p.municipio_nombre) learn(p.departamento_nombre, p.municipio_nombre, p.municipality_code)
  for (const f of loaded) {
    if (!f.sheet.hasCodes) continue
    for (const r of f.sheet.rows) if (r.municipalityCode) learn(r.departamento, r.municipio, r.municipalityCode)
  }

  // 3. Resolver códigos y armar filas por corte
  const byCorte = new Map<string, OutRow[]>()
  const unresolved: string[] = []
  const conflicts: string[] = []
  const duplicates: string[] = []
  const coberturaDiff: string[] = []
  const aliasToWrite = new Map<string, { fuente: string; department_code: string; nombre_normalizado: string; municipality_code: string; nota: string }>()

  for (const f of Array.from(cortes.values()).sort((a, b) => (a.corte < b.corte ? -1 : 1))) {
    const out = new Map<string, OutRow>()
    for (const r of f.sheet.rows) {
      let code: string | null = r.municipalityCode
      let origen: OutRow['codigo_origen'] = 'archivo'
      if (!code) {
        const hit = resolver.resolve(r.municipio, r.departamento)
        const fromLearned = learned.get(cifrasNameKey(r.departamento, r.municipio)) ?? null
        if (hit && fromLearned && hit.code !== fromLearned) {
          conflicts.push(`${f.corte} ${r.departamento} / ${r.municipio}: por nombre ${hit.code}, aprendido ${fromLearned}`)
          continue
        }
        if (hit) {
          code = hit.code
          origen = hit.via === 'nombre' ? 'nombre' : 'alias'
        } else if (fromLearned) {
          code = fromLearned
          origen = 'aprendido'
        }
      } else if (validCodes.has(code)) {
        const dept = code.slice(0, 2)
        const byName = resolver.resolveInDepartment(r.municipio, dept)
        const nombre = normalizeMunicipioName(r.municipio)
        if (!byName && nombre) {
          aliasToWrite.set(`${dept}|${nombre}`, {
            fuente: ALIAS_FUENTE_MINSALUD,
            department_code: dept,
            nombre_normalizado: nombre,
            municipality_code: code,
            nota: `MinSalud "${r.municipio}" (${f.xlsxName}) = ${geo.municipalities.find(m => m.code === code)?.name ?? code}`,
          })
        }
      }
      if (!code) {
        unresolved.push(`${f.corte} ${r.departamento} / ${r.municipio} (${fmt(r.afiliados)} afiliados)`)
        continue
      }
      if (out.has(code)) {
        duplicates.push(`${f.corte} ${code}: "${out.get(code)!.municipio_nombre}" y "${r.municipio}"`)
        continue
      }
      const computed = computeCobertura(r.afiliados, r.poblacion)
      let cobertura = r.cobertura
      if (cobertura === null || cobertura < 0 || cobertura > 1) cobertura = computed
      else if (computed !== null && Math.abs(computed - cobertura) > 1e-9) coberturaDiff.push(`${f.corte} ${code}: archivo ${cobertura}, calculada ${computed}`)
      out.set(code, {
        corte: f.corte,
        municipality_code: code,
        department_code: r.departmentCode ?? (code === '00000' ? '00' : code.slice(0, 2)),
        departamento_nombre: r.departamento,
        municipio_nombre: r.municipio,
        contributivo: r.contributivo,
        subsidiado: r.subsidiado,
        excepcion_especiales: r.excepcion,
        afiliados: r.afiliados,
        poblacion_dane: r.poblacion,
        cobertura,
        codigo_origen: origen,
        archivo: f.xlsxName,
        fuente: 'minsalud_cifras',
        loaded_at: loadedAt,
      })
    }
    byCorte.set(f.corte, Array.from(out.values()))
  }

  // 4. Informe de lectura (antes de escribir)
  console.log(`Archivos: ${args.files.length} · leídos ${loaded.length} · con error ${readErrors}`)
  console.log('\ncorte       archivo                      cód. filas  municipios  especiales  vacías  afiliados     población     total archivo (afiliados / población)   cuadra')
  const cuadres: boolean[] = []
  for (const [corte, rows] of Array.from(byCorte.entries())) {
    const f = cortes.get(corte)!
    const sum = sumCifras(rows.map(r => ({ afiliados: r.afiliados, poblacion: r.poblacion_dane, contributivo: r.contributivo, subsidiado: r.subsidiado, excepcion: r.excepcion_especiales })))
    const t = f.sheet.total
    const ok = !!t && t.afiliados === sum.afiliados && t.poblacion === sum.poblacion && t.contributivo === sum.contributivo && t.subsidiado === sum.subsidiado && t.excepcion === sum.excepcion
    cuadres.push(ok)
    const municipios = rows.filter(r => validCodes.has(r.municipality_code)).length
    console.log(
      `${corte}  ${f.xlsxName.padEnd(28)} ${f.sheet.hasCodes ? 'sí ' : 'no '}  ${String(rows.length).padStart(5)}  ${String(municipios).padStart(10)}  ${String(rows.length - municipios).padStart(10)}  ${String(f.sheet.skippedEmpty).padStart(6)}  ${fmt(sum.afiliados).padStart(12)}  ${fmt(sum.poblacion).padStart(12)}  ${(`${fmt(t?.afiliados)} / ${fmt(t?.poblacion)}`).padStart(37)}   ${ok ? 'sí' : 'NO'}`
    )
  }
  const ago = byCorte.get(TABLERO_AGOSTO_2026.corte)
  if (ago) {
    const s = sumCifras(ago.map(r => ({ afiliados: r.afiliados, poblacion: r.poblacion_dane })))
    console.log(
      `\nNacional agosto-2026: afiliados ${fmt(s.afiliados)} (tablero ${fmt(TABLERO_AGOSTO_2026.afiliados)}: ${s.afiliados === TABLERO_AGOSTO_2026.afiliados ? 'igual' : 'DISTINTO'}) · población DANE ${fmt(s.poblacion)} (tablero ${fmt(TABLERO_AGOSTO_2026.poblacion)}: ${s.poblacion === TABLERO_AGOSTO_2026.poblacion ? 'igual' : 'DISTINTO'})`
    )
  }
  const origenes = new Map<string, number>()
  for (const rows of Array.from(byCorte.values())) for (const r of rows) origenes.set(r.codigo_origen, (origenes.get(r.codigo_origen) ?? 0) + 1)
  console.log(`Origen del código: ${Array.from(origenes.entries()).map(([k, v]) => `${k} ${fmt(v)}`).join(' · ')}`)
  console.log(`Sin código (no se cargan): ${unresolved.length}`)
  unresolved.slice(0, 20).forEach(u => console.log(`  - ${u}`))
  console.log(`Conflictos nombre vs aprendido: ${conflicts.length}`)
  conflicts.slice(0, 20).forEach(u => console.log(`  - ${u}`))
  console.log(`Conflictos entre archivos con código (mismo nombre, otro código): ${learnedConflicts.size}`)
  Array.from(learnedConflicts).slice(0, 20).forEach(u => console.log(`  - ${u}`))
  console.log(`Códigos repetidos dentro de un corte: ${duplicates.length}`)
  duplicates.slice(0, 20).forEach(u => console.log(`  - ${u}`))
  console.log(`Cobertura del archivo distinta de la calculada (> 1e-9): ${coberturaDiff.length}`)
  coberturaDiff.slice(0, 10).forEach(u => console.log(`  - ${u}`))
  console.log(`Alias aprendidos (nombre de MinSalud ≠ municipalities.name): ${aliasToWrite.size}`)
  Array.from(aliasToWrite.values()).forEach(a => console.log(`  - ${a.department_code} "${a.nombre_normalizado}" → ${a.municipality_code} · ${a.nota}`))

  const blocking = readErrors + conflicts.length + learnedConflicts.size + duplicates.length + cuadres.filter(ok => !ok).length
  if (args.dryRun) {
    console.log('\n--dry-run: no se escribió nada.')
    if (blocking > 0) process.exitCode = 1
    return
  }
  if (blocking > 0) {
    console.log(`\n${blocking} problema(s) bloqueantes (lectura, conflictos, repetidos o totales que no cuadran): no se escribe nada.`)
    process.exitCode = 1
    return
  }

  // 5. Escribir
  if (args.alias && aliasToWrite.size > 0) {
    const { error } = await db.from('municipio_alias').upsert(Array.from(aliasToWrite.values()), { onConflict: 'fuente,department_code,nombre_normalizado' })
    if (error) throw new Error(`municipio_alias: ${error.message}`)
  }
  let failed = 0
  let pruned = 0
  for (const [corte, rows] of Array.from(byCorte.entries())) {
    const res = await upsertBatches(db, 'afiliacion_cifras', rows, 'corte,municipality_code', 500, `afiliacion_cifras ${corte}`)
    failed += res.failedBatches
    if (res.failedBatches === 0) {
      const { count, error } = await db.from('afiliacion_cifras').delete({ count: 'exact' }).eq('corte', corte).lt('loaded_at', loadedAt)
      if (error) throw new Error(`poda ${corte}: ${error.message}`)
      pruned += count ?? 0
    }
  }

  // 6. Verificación leyendo de la base
  const stored = await fetchAll<{ corte: string; municipality_code: string; afiliados: number; poblacion_dane: number | null }>((from, to) =>
    db.from('afiliacion_cifras').select('corte, municipality_code, afiliados, poblacion_dane').order('corte').order('municipality_code').range(from, to)
  )
  const resumen = new Map<string, { filas: number; municipios: number; afiliados: number; poblacion: number }>()
  for (const s of stored) {
    const item = resumen.get(s.corte) ?? { filas: 0, municipios: 0, afiliados: 0, poblacion: 0 }
    item.filas++
    if (validCodes.has(s.municipality_code)) item.municipios++
    item.afiliados += s.afiliados
    item.poblacion += s.poblacion_dane ?? 0
    resumen.set(s.corte, item)
  }
  console.log('\nafiliacion_cifras en la base:')
  for (const [corte, s] of Array.from(resumen.entries())) {
    console.log(`  ${corte}: ${fmt(s.filas)} filas (${fmt(s.municipios)} municipios de municipalities) · afiliados ${fmt(s.afiliados)} · población ${fmt(s.poblacion)}`)
  }
  console.log(`Upsert con ${failed} lotes con error · filas viejas borradas: ${pruned} · alias escritos: ${args.alias ? aliasToWrite.size : 0}`)
  if (failed > 0) process.exitCode = 1
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
