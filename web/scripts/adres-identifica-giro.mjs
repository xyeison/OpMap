#!/usr/bin/env node
/**
 * Giros de la ADRES desde "Identifica tu Giro" (ERP) → public.adres_giros_detalle (+ bitácora adres_fetch_log).
 *
 * Fuente pública, sin login: https://aplicaciones.adres.gov.co/ERP/Default.aspx (visor SSRS
 * "Consulta_Pagos_ERP"). Parámetros: Fecha Inicio, Fecha Fin (dd/mm/aaaa) y "NIT EPS o IPS
 * Beneficiaria" (NIT sin DV). Una fila por giro: NIT, fecha, valor, concepto y entidad ordenadora.
 * Incluye el régimen contributivo (compensación), el subsidiado (LMA) y otros conceptos, desde abr-2025.
 *
 * Cómo consulta: igual que el formulario (ASP.NET + ReportViewer 2012): GET de la página, POST con los
 * 3 parámetros y "Ver informe", y descarga del reporte en XML (valores con centavos; es la lectura
 * principal) y en CSV (valores redondeados a pesos; sirve para validar el XML: mismas filas y sumas que
 * cuadran a medio peso por fila). Peticiones HTTP normales con un User-Agent que se identifica como este
 * script; SIN navegador. Si el firewall de la ADRES devuelve su página de bloqueo, el script se detiene
 * (no reintenta ni lo evade). Sesión HTTP y cadena TLS (intermedio por AIA): scripts/lib/adres-http.mjs.
 *
 * Uso (desde web/; Node 22; sin dependencias nuevas):
 *   node scripts/adres-identifica-giro.mjs                          → todos los NIT de las IPS activas
 *   node scripts/adres-identifica-giro.mjs --nit 890102768 --desde 2025-01 --hasta 2026-09
 * Opciones:
 *   --nit a,b,c         NIT sin DV (por defecto: NIT de las IPS activas, misma regla que hospitals.nit, sin repetir)
 *   --desde / --hasta   YYYY-MM, YYYY-MM-DD o dd/mm/aaaa (por defecto: 24 meses hasta fin del mes pasado)
 *   --ventana N         meses por consulta, 1–12 (por defecto 6): el rango se parte en ventanas de N meses
 *   --parallel N        consultas simultáneas, 1–4 (por defecto 2), cada una con su propia sesión
 *   --force             vuelve a consultar aunque haya una consulta ok/sin_registros reciente
 *   --recent-days N     qué es "reciente" para saltar (por defecto 20 días)
 *   --retries N         reintentos por ventana ante errores de red/lectura (por defecto 3)
 *   --delay MS          pausa entre NIT por cada consulta simultánea (por defecto 1000)
 *   --limit N           procesa solo los primeros N NIT pendientes
 *   --dry-run           consulta la ADRES y muestra lo leído, pero NO escribe en la base
 *   --save-dir DIR      guarda el XML/CSV crudo de cada ventana en DIR (diagnóstico)
 *
 * Régimen (regimenDeConcepto en lib/adres-identifica.mjs): subsidiado si el concepto dice "subsidiado"
 * o "LMA"; contributivo si dice "compensación", "régimen contributivo" o es un giro directo de la
 * compensación (CGD_Proc_…, Proceso_<n>_GD_…); otro en los demás casos.
 *
 * Escritura (por NIT, solo si TODAS sus ventanas se leyeron bien): upsert en adres_giros_detalle por
 * huella (sha256 de nit|fecha|valor|concepto|ordenadora|ocurrencia) y luego borra las filas de ese NIT
 * dentro del rango que no vinieron en esta descarga (correcciones de la ADRES); registra la consulta en
 * adres_fetch_log (fuente adres_identifica_giro, régimen 'todos'; ok / sin_registros / error).
 * Reanudable: salta los NIT con una consulta ok/sin_registros de los últimos --recent-days días que
 * cubra el rango pedido. Requiere database/migrations/2026-10-11_0630_adres_detalle.sql.
 * Código de salida 1 si hubo errores o bloqueo.
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { defaultRange, nitFromHospitalCode, normalizeNit, parseDateArg, toAdresDate } from '../lib/adres-parse.mjs'
import {
  FUENTE_IDENTIFICA,
  buildDetalleRows,
  crossCheckExports,
  parseIdentificaCsv,
  parseIdentificaXml,
  splitDateWindows,
  sumByRegimen,
} from '../lib/adres-identifica.mjs'
import { ADRES_HOST, BlockedError, ReportViewerSession, buildAgent, supabaseClient } from './lib/adres-http.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(here, '..', '.env.local'), quiet: true })

const USER_AGENT = 'OpMap-giros-ADRES/1.0 (Node.js; consulta publica Identifica tu Giro de la ADRES)'
const PARAM_PREFIX = 'ReportViewer$ctl04$'
const SESSION_CONFIG = {
  host: ADRES_HOST,
  path: '/ERP/Default.aspx',
  userAgent: USER_AGENT,
  timeoutMs: 120000,
  fields: { desde: PARAM_PREFIX + 'ctl03$txtValue', hasta: PARAM_PREFIX + 'ctl05$txtValue', nit: PARAM_PREFIX + 'ctl07$txtValue' },
  button: [PARAM_PREFIX + 'ctl00', 'Ver informe'],
}
const REGIMEN_LOG = 'todos'
const UPSERT_BATCH = 500

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
const cop = value => new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(Math.round(value))
const huella = clave => crypto.createHash('sha256').update(clave, 'utf8').digest('hex')

// ---------------------------------------------------------------------------
// Argumentos
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const range = defaultRange(new Date())
  const args = {
    nits: null,
    desde: range.desde,
    hasta: range.hasta,
    ventana: 6,
    parallel: 2,
    force: false,
    recentDays: 20,
    retries: 3,
    delay: 1000,
    limit: null,
    dryRun: false,
    saveDir: null,
  }
  const takeValue = (arg, i) => (arg.includes('=') ? [arg.slice(arg.indexOf('=') + 1), i] : [argv[i + 1], i + 1])
  const positiveInt = (name, raw, min, max) => {
    const n = Number(raw)
    if (!Number.isInteger(n) || n < min || n > max) throw new Error(`${name} debe ser un entero entre ${min} y ${max} (recibido: ${raw ?? 'nada'})`)
    return n
  }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    const name = arg.split('=')[0]
    let value
    switch (name) {
      case '--help':
      case '-h':
        args.help = true
        break
      case '--force':
        args.force = true
        break
      case '--dry-run':
        args.dryRun = true
        break
      case '--nit': {
        ;[value, i] = takeValue(arg, i)
        const list = String(value ?? '').split(',').map(s => s.trim()).filter(Boolean)
        const nits = list.map(item => normalizeNit(item))
        const bad = list.filter((_, index) => !nits[index])
        if (list.length === 0 || bad.length > 0) throw new Error(`--nit no válido: ${bad.join(', ') || '(vacío)'}`)
        args.nits = Array.from(new Set(nits))
        break
      }
      case '--desde':
      case '--hasta': {
        ;[value, i] = takeValue(arg, i)
        const iso = parseDateArg(value, name === '--hasta')
        if (!iso) throw new Error(`${name} no válido: ${value ?? '(vacío)'} (usa YYYY-MM, YYYY-MM-DD o dd/mm/aaaa)`)
        args[name === '--desde' ? 'desde' : 'hasta'] = iso
        break
      }
      case '--ventana':
        ;[value, i] = takeValue(arg, i)
        args.ventana = positiveInt('--ventana', value, 1, 12)
        break
      case '--parallel':
        ;[value, i] = takeValue(arg, i)
        args.parallel = positiveInt('--parallel', value, 1, 4)
        break
      case '--recent-days':
        ;[value, i] = takeValue(arg, i)
        args.recentDays = positiveInt('--recent-days', value, 0, 3650)
        break
      case '--retries':
        ;[value, i] = takeValue(arg, i)
        args.retries = positiveInt('--retries', value, 1, 10)
        break
      case '--delay':
        ;[value, i] = takeValue(arg, i)
        args.delay = positiveInt('--delay', value, 0, 60000)
        break
      case '--limit':
        ;[value, i] = takeValue(arg, i)
        args.limit = positiveInt('--limit', value, 1, 100000)
        break
      case '--save-dir':
        ;[value, i] = takeValue(arg, i)
        if (!value) throw new Error('--save-dir necesita una carpeta')
        args.saveDir = path.resolve(value)
        break
      default:
        throw new Error(`Argumento desconocido: ${arg}`)
    }
  }
  if (args.desde > args.hasta) throw new Error(`--desde (${args.desde}) es posterior a --hasta (${args.hasta})`)
  return args
}

// ---------------------------------------------------------------------------
// Una ventana de un NIT: consultar, leer, validar
// ---------------------------------------------------------------------------

/**
 * Lee XML (principal) y CSV (validación) del mismo reporte. Si los dos se reconocen, deben cuadrar.
 * Con uno solo se sigue con un aviso. Lanza si ninguno se reconoce o no cuadran.
 */
function interpret(xmlText, csvText) {
  const xml = xmlText !== null ? parseIdentificaXml(xmlText) : null
  const csv = csvText !== null ? parseIdentificaCsv(csvText) : null
  const warnings = []
  if (xml?.headerFound && csv?.headerFound) {
    const check = crossCheckExports(xml.rows, csv.rows)
    if (!check.ok) {
      throw new Error(`XML y CSV no cuadran (filas ${check.filasXml} vs ${check.filasCsv}; $ ${cop(check.sumaXml)} vs $ ${cop(check.sumaCsv)})`)
    }
    return { parsed: xml, format: 'XML', warnings }
  }
  if (xml?.headerFound) {
    warnings.push('sin CSV para validar el XML')
    return { parsed: xml, format: 'XML', warnings }
  }
  if (csv?.headerFound) {
    warnings.push('solo CSV: valores redondeados a pesos')
    return { parsed: csv, format: 'CSV', warnings }
  }
  throw new Error('No se reconoce el reporte ni en XML ni en CSV')
}

async function fetchWindow(session, nit, window, args) {
  let lastError = null
  for (let attempt = 1; attempt <= args.retries; attempt++) {
    try {
      const exportBase = await session.run(nit, toAdresDate(window.desde), toAdresDate(window.hasta))
      const texts = {}
      const failures = []
      for (const format of ['XML', 'CSV']) {
        try {
          texts[format] = await session.exportAs(exportBase, format)
        } catch (error) {
          if (error instanceof BlockedError) throw error
          texts[format] = null
          failures.push(`${format}: ${error.message}`)
        }
      }
      if (texts.XML === null && texts.CSV === null) throw new Error(failures.join(' · '))
      const { parsed, format, warnings } = interpret(texts.XML, texts.CSV)
      if (parsed.skipped > 0) throw new Error(`${parsed.skipped} fila(s) del ${format} no se pudieron leer`)
      const otherNit = parsed.rows.find(row => row.nit !== nit)
      if (otherNit) throw new Error(`El reporte trae giros de otro NIT (${otherNit.nit})`)
      const outside = parsed.rows.find(row => row.fecha_giro < window.desde || row.fecha_giro > window.hasta)
      if (outside) throw new Error(`El reporte trae un giro fuera de la ventana (${outside.fecha_giro})`)
      if (args.saveDir) {
        fs.mkdirSync(args.saveDir, { recursive: true })
        const stem = `identifica-${nit}-${window.desde}_${window.hasta}`
        if (texts.XML !== null) fs.writeFileSync(path.join(args.saveDir, `${stem}.xml`), texts.XML)
        if (texts.CSV !== null) fs.writeFileSync(path.join(args.saveDir, `${stem}.csv`), texts.CSV)
      }
      return { rows: parsed.rows, prestador: parsed.prestador, format, warnings: [...warnings, ...failures], attempts: attempt }
    } catch (error) {
      if (error instanceof BlockedError) throw error
      lastError = error
      session.reset()
      if (attempt < args.retries) await sleep(2000 * 2 ** (attempt - 1))
    }
  }
  throw new Error(`Ventana ${window.desde} a ${window.hasta}: ${lastError ? lastError.message : 'error desconocido'}`)
}

async function fetchNit(session, nit, args) {
  const started = Date.now()
  const windows = splitDateWindows(args.desde, args.hasta, args.ventana)
  const all = []
  const warnings = []
  let prestador = null
  try {
    for (const window of windows) {
      const result = await fetchWindow(session, nit, window, args)
      all.push(...result.rows)
      if (!prestador && result.prestador) prestador = result.prestador
      for (const warning of result.warnings) warnings.push(`${window.desde.slice(0, 7)}: ${warning}`)
    }
  } catch (error) {
    if (error instanceof BlockedError) throw error
    return { estado: 'error', rows: [], sums: sumByRegimen([]), prestador, mensaje: error.message, ms: Date.now() - started, ventanas: windows.length }
  }
  const rows = buildDetalleRows(all)
  return {
    estado: rows.length > 0 ? 'ok' : 'sin_registros',
    rows,
    sums: sumByRegimen(rows),
    prestador,
    warnings,
    ms: Date.now() - started,
    ventanas: windows.length,
    primera: rows.length ? rows[rows.length - 1].fecha_giro : null,
    ultima: rows.length ? rows[0].fecha_giro : null,
  }
}

// ---------------------------------------------------------------------------
// Base de datos
// ---------------------------------------------------------------------------

async function loadHospitalNits(db) {
  const nits = new Map()
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from('hospitals').select('code, name').eq('active', true).order('id').range(from, from + 999)
    if (error) throw new Error(`Error leyendo hospitals: ${error.message}`)
    for (const row of data || []) {
      const nit = nitFromHospitalCode(row.code) // misma regla que hospitals.nit
      if (nit && !nits.has(nit)) nits.set(nit, row.name)
    }
    if (!data || data.length < 1000) break
  }
  return nits
}

async function recentlyFetched(db, nits, args) {
  const done = new Set()
  if (args.force || args.recentDays === 0) return done
  const since = new Date(Date.now() - args.recentDays * 86400000).toISOString()
  for (let i = 0; i < nits.length; i += 150) {
    const chunk = nits.slice(i, i + 150)
    const { data, error } = await db
      .from('adres_fetch_log')
      .select('nit, desde, hasta')
      .in('nit', chunk)
      .in('estado', ['ok', 'sin_registros'])
      .eq('fuente', FUENTE_IDENTIFICA)
      .gte('fetched_at', since)
    if (error) throw new Error(`Error leyendo adres_fetch_log (¿falta la migración 0610?): ${error.message}`)
    for (const row of data || []) {
      if (row.desde <= args.desde && row.hasta >= args.hasta) done.add(row.nit)
    }
  }
  return done
}

async function saveNit(db, nit, result, args) {
  const stamp = new Date().toISOString()
  if (result.estado !== 'error') {
    for (let i = 0; i < result.rows.length; i += UPSERT_BATCH) {
      const batch = result.rows.slice(i, i + UPSERT_BATCH).map(row => ({
        nit,
        fecha_giro: row.fecha_giro,
        valor: row.valor,
        concepto: row.concepto,
        proceso: row.proceso,
        referencia: row.referencia,
        eps_ordenadora_nit: row.eps_ordenadora_nit,
        eps_ordenadora_nombre: row.eps_ordenadora_nombre,
        regimen: row.regimen,
        fuente: FUENTE_IDENTIFICA,
        ocurrencia: row.ocurrencia,
        huella: huella(row.clave),
        fetched_at: stamp,
      }))
      const { error } = await db.from('adres_giros_detalle').upsert(batch, { onConflict: 'huella' })
      if (error) throw new Error(`Error guardando adres_giros_detalle de ${nit} (¿falta la migración 0630?): ${error.message}`)
    }
    // Giros del rango que la ADRES ya no publica (se descargaron antes y no vinieron ahora)
    const { error: pruneError } = await db
      .from('adres_giros_detalle')
      .delete()
      .eq('nit', nit)
      .eq('fuente', FUENTE_IDENTIFICA)
      .gte('fecha_giro', args.desde)
      .lte('fecha_giro', args.hasta)
      .lt('fetched_at', stamp)
    if (pruneError) throw new Error(`Error podando adres_giros_detalle de ${nit}: ${pruneError.message}`)
  }
  const { error: logError } = await db.from('adres_fetch_log').insert({
    nit,
    desde: args.desde,
    hasta: args.hasta,
    estado: result.estado,
    mensaje: result.estado === 'error' ? String(result.mensaje || '').slice(0, 1000) : result.warnings?.length ? result.warnings.join('; ').slice(0, 1000) : null,
    filas: result.rows.length,
    total: result.estado === 'error' ? null : result.sums.total,
    nombre_prestador: result.prestador,
    regimen: REGIMEN_LOG,
    fuente: FUENTE_IDENTIFICA,
  })
  if (logError) throw new Error(`Error guardando adres_fetch_log de ${nit}: ${logError.message}`)
}

// ---------------------------------------------------------------------------
// Principal
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    const header = fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0]
    process.stdout.write(header.replace(/^#!.*\n/, '').replace(/^\/\*\*\n?/, '').replace(/^ \* ?/gm, '') + '\n')
    return 0
  }

  const db = args.dryRun && args.nits ? null : await supabaseClient()
  let names = new Map()
  let nits = args.nits
  if (!nits) {
    names = await loadHospitalNits(db)
    nits = Array.from(names.keys())
  }
  const skipped = db ? await recentlyFetched(db, nits, args) : new Set()
  let pending = nits.filter(nit => !skipped.has(nit))
  if (args.limit) pending = pending.slice(0, args.limit)
  const windows = splitDateWindows(args.desde, args.hasta, args.ventana)

  console.log(`ADRES · Identifica tu Giro (ERP) · ${args.desde} a ${args.hasta} · ${windows.length} ventana(s) de hasta ${args.ventana} meses`)
  console.log(
    `NIT: ${nits.length} · saltados (consultados hace menos de ${args.recentDays} días): ${skipped.size} · por consultar: ${pending.length}` +
      ` · consultas simultáneas: ${Math.min(args.parallel, Math.max(pending.length, 1))}${args.dryRun ? ' · DRY-RUN (no escribe en la base)' : ''}`
  )
  if (pending.length === 0) return 0

  const agent = await buildAgent(USER_AGENT)
  const summary = { ok: 0, sin_registros: 0, error: 0, filas: 0, errores: [], porNit: [], sums: { total: 0, contributivo: 0, subsidiado: 0, otro: 0 } }
  let blocked = null
  let next = 0
  let doneCount = 0
  const width = String(pending.length).length

  async function worker() {
    const session = new ReportViewerSession(agent, SESSION_CONFIG)
    while (!blocked) {
      const index = next++
      if (index >= pending.length) return
      const nit = pending[index]
      let result
      try {
        result = await fetchNit(session, nit, args)
        if (db && !args.dryRun) await saveNit(db, nit, result, args)
      } catch (error) {
        if (error instanceof BlockedError) {
          blocked = error.message
          return
        }
        result = { estado: 'error', rows: [], sums: sumByRegimen([]), prestador: null, mensaje: error.message }
      }
      doneCount++
      summary[result.estado]++
      summary.filas += result.rows.length
      for (const key of Object.keys(summary.sums)) summary.sums[key] += result.sums[key]
      if (result.estado === 'error') summary.errores.push(`${nit}: ${result.mensaje}`)
      const who = result.prestador || names.get(nit) || ''
      summary.porNit.push({ nit, who, estado: result.estado, filas: result.rows.length, sums: result.sums, primera: result.primera, ultima: result.ultima })
      const s = result.sums
      const detail =
        result.estado === 'error'
          ? `ERROR ${result.mensaje}`
          : `${String(result.rows.length).padStart(5)} filas  $ ${cop(s.total).padStart(17)}  (contrib. $ ${cop(s.contributivo)} · subs. $ ${cop(s.subsidiado)} · otro $ ${cop(s.otro)})`
      const secs = result.ms ? `  ${(result.ms / 1000).toLocaleString('es-CO', { maximumFractionDigits: 1 })} s` : ''
      console.log(`[${String(doneCount).padStart(width)}/${pending.length}] ${nit.padEnd(10)} ${result.estado.padEnd(13)} ${detail}${who ? `  ${who}` : ''}${secs}`)
      if (result.warnings?.length) console.log(`    avisos: ${result.warnings.join('; ')}`)
      if (args.delay > 0) await sleep(args.delay)
    }
  }

  await Promise.all(Array.from({ length: Math.min(args.parallel, pending.length) }, () => worker()))
  agent.destroy()

  const totals = summary.sums
  console.log('')
  console.log(`Resumen Identifica tu Giro (${args.desde} a ${args.hasta})`)
  console.log(
    `  NIT consultados: ${doneCount} · con datos: ${summary.ok} · sin registros: ${summary.sin_registros} · errores: ${summary.error} · saltados (recientes): ${skipped.size}`
  )
  console.log(`  Filas ${args.dryRun ? 'leídas (no guardadas)' : 'guardadas'}: ${summary.filas} · Total girado: $ ${cop(totals.total)}`)
  console.log(`  Por régimen: contributivo $ ${cop(totals.contributivo)} · subsidiado $ ${cop(totals.subsidiado)} · otro $ ${cop(totals.otro)}`)
  if (summary.porNit.length <= 50) {
    console.log('  Por NIT:')
    for (const item of summary.porNit.sort((a, b) => b.sums.total - a.sums.total)) {
      const range = item.primera ? `  ${item.primera} a ${item.ultima}` : ''
      console.log(
        `    ${item.nit.padEnd(10)} ${String(item.filas).padStart(5)} filas  $ ${cop(item.sums.total).padStart(17)}  contrib. $ ${cop(item.sums.contributivo)} · subs. $ ${cop(item.sums.subsidiado)} · otro $ ${cop(item.sums.otro)}${range}${item.who ? `  ${item.who}` : ''}`
      )
    }
  }
  if (summary.errores.length > 0) console.log(`  Errores:\n    ${summary.errores.join('\n    ')}`)
  if (blocked) {
    console.error(`\nDETENIDO: ${blocked}. No se reintenta; quedan ${pending.length - doneCount} NIT sin consultar.`)
    return 1
  }
  return summary.error > 0 ? 1 : 0
}

main()
  .then(code => process.exit(code))
  .catch(error => {
    console.error(`Error: ${error.message}`)
    process.exit(1)
  })
