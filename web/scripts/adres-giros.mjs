#!/usr/bin/env node
/**
 * Fase 3 · Giros directos de la ADRES a IPS → public.adres_giros (+ bitácora adres_fetch_log).
 *
 * Fuente pública, sin login: https://aplicaciones.adres.gov.co/SII_LMA_WEB/LMA/frmReportes.aspx?Reporte=29
 * ("Liquidación Mensual de Afiliados Régimen Subsidiado" → "Reporte Giro a IPS"). Por NIT del
 * prestador (sin DV), mes de proceso, tipo de contratación (Capitación / Evento) y EPS.
 *
 * Cómo consulta: igual que el formulario (ASP.NET + ReportViewer 2010): GET de la página, POST con
 * FECHA INICIAL / FECHA FIN / NIT IPS y "View Report", y descarga del reporte en CSV por la URL de
 * exportación del propio visor (respaldo: XML). Peticiones HTTP normales con un User-Agent que se
 * identifica como este script; SIN navegador y sin hacerse pasar por uno. Si el firewall de la
 * ADRES devuelve su página de bloqueo, el script se detiene (no reintenta ni lo evade).
 * Nota: el servidor de la ADRES envía una cadena de certificados incompleta (le falta el intermedio
 * "Go Daddy Secure Certificate Authority - G2"); el script lo descarga de la URL AIA que trae el
 * propio certificado (como hacen los navegadores) y verifica la cadena contra las raíces de Node.
 * La sesión HTTP y la cadena TLS están en scripts/lib/adres-http.mjs (compartidas con
 * scripts/adres-identifica-giro.mjs).
 *
 * Uso (desde web/; Node 22; sin dependencias nuevas):
 *   node scripts/adres-giros.mjs                          → todos los NIT de las IPS activas
 *   node scripts/adres-giros.mjs --nit 891200679,800058856 --desde 2025-01 --hasta 2026-06
 * Opciones:
 *   --nit a,b,c         NIT sin DV (por defecto: NIT de las IPS activas, misma regla que hospitals.nit, sin repetir)
 *   --desde / --hasta   YYYY-MM, YYYY-MM-DD o dd/mm/aaaa (por defecto: 24 meses hasta fin del mes pasado)
 *   --parallel N        consultas simultáneas, 1–4 (por defecto 2), cada una con su propia sesión
 *   --force             vuelve a consultar aunque haya una consulta ok/sin_registros reciente
 *   --recent-days N     qué es "reciente" para saltar (por defecto 20 días)
 *   --retries N         reintentos por NIT ante errores de red/lectura (por defecto 3)
 *   --delay MS          pausa entre NIT por cada consulta simultánea (por defecto 1000)
 *   --limit N           procesa solo los primeros N NIT pendientes
 *   --dry-run           consulta la ADRES y muestra lo leído, pero NO escribe en la base
 *   --save-dir DIR      guarda el CSV/XML crudo de cada NIT en DIR (diagnóstico)
 *
 * Escritura (por NIT): upsert en adres_giros (clave nit+periodo+regimen+tipo+EPS) y luego borra las
 * filas de ese NIT dentro del rango que no vinieron en esta descarga (correcciones de la ADRES);
 * registra la consulta en adres_fetch_log (ok / sin_registros / error). Reanudable: salta los NIT
 * con una consulta ok/sin_registros de los últimos --recent-days días que cubra el rango pedido.
 * Requiere la migración database/migrations/2026-10-11_0610_fase3_adres.sql.
 * Código de salida 1 si hubo errores o bloqueo.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import {
  aggregateGiroRows,
  checkReportTotal,
  defaultRange,
  nitFromHospitalCode,
  normalizeNit,
  parseDateArg,
  parseGirosCsv,
  parseGirosXml,
  toAdresDate,
} from '../lib/adres-parse.mjs'
import { ADRES_HOST, BlockedError, ReportViewerSession, buildAgent, supabaseClient } from './lib/adres-http.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(here, '..', '.env.local'), quiet: true })

const REPORT_PATH = '/SII_LMA_WEB/LMA/frmReportes.aspx?Reporte=29'
const USER_AGENT = 'OpMap-giros-ADRES/1.0 (Node.js; consulta del Reporte 29 publico de la ADRES)'
const PARAM_PREFIX = 'ctl00$ContentPlaceHolder1$ReportViewer$ctl04$'
const FIELD_DESDE = PARAM_PREFIX + 'ctl03$txtValue'
const FIELD_HASTA = PARAM_PREFIX + 'ctl05$txtValue'
const FIELD_NIT = PARAM_PREFIX + 'ctl07$txtValue'
const VIEW_BUTTON = PARAM_PREFIX + 'ctl00'
const SESSION_CONFIG = {
  host: ADRES_HOST,
  path: REPORT_PATH,
  userAgent: USER_AGENT,
  timeoutMs: 90000,
  fields: { desde: FIELD_DESDE, hasta: FIELD_HASTA, nit: FIELD_NIT },
  button: [VIEW_BUTTON, 'View Report'],
}
const REGIMEN = 'subsidiado'
const FUENTE = 'adres_reporte_29'
const UPSERT_BATCH = 500

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
const cop = value => new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(Math.round(value))

// ---------------------------------------------------------------------------
// Argumentos
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const range = defaultRange(new Date())
  const args = {
    nits: null,
    desde: range.desde,
    hasta: range.hasta,
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
// Un NIT: consultar, leer, validar
// ---------------------------------------------------------------------------

/** Lee y valida el reporte. null si el texto no es el reporte (se prueba el otro formato). */
function interpret(format, text) {
  const parsed = format === 'CSV' ? parseGirosCsv(text) : parseGirosXml(text)
  if (!parsed.headerFound) return null
  const check = checkReportTotal(parsed)
  if (!check.ok) throw new Error(`El total del reporte (${cop(check.reportTotal)}) no cuadra con la suma de filas (${cop(check.sum)})`)
  return parsed
}

async function fetchNit(session, nit, args) {
  let lastError = null
  const monthStart = args.desde.slice(0, 8) + '01'
  for (let attempt = 1; attempt <= args.retries; attempt++) {
    const started = Date.now()
    try {
      const exportBase = await session.run(nit, toAdresDate(args.desde), toAdresDate(args.hasta))
      let parsed = null
      let format = null
      let text = null
      const failures = []
      // CSV primero; si la descarga falla o no se reconoce, el XML del mismo reporte ya procesado
      for (const candidate of ['CSV', 'XML']) {
        try {
          text = await session.exportAs(exportBase, candidate)
          parsed = interpret(candidate, text)
          if (parsed) {
            format = candidate
            break
          }
          failures.push(`${candidate}: no se reconoce el reporte`)
        } catch (error) {
          if (error instanceof BlockedError) throw error
          failures.push(`${candidate}: ${error.message}`)
        }
      }
      if (!parsed) throw new Error(failures.join(' · '))
      if (parsed.prestador && session.lastNit && session.lastNit !== nit && session.lastPrestador === parsed.prestador) {
        // El visor devolvió el reporte anterior: se reintenta con una sesión nueva (reset en el catch)
        throw new Error(`El reporte trae el prestador del NIT anterior (${session.lastNit})`)
      }
      session.lastNit = nit
      session.lastPrestador = parsed.prestador
      if (args.saveDir) {
        fs.mkdirSync(args.saveDir, { recursive: true })
        fs.writeFileSync(path.join(args.saveDir, `adres-${nit}.${format.toLowerCase()}`), text)
      }
      const rows = aggregateGiroRows(parsed.rows).filter(row => row.periodo >= monthStart && row.periodo <= args.hasta)
      if (parsed.rows.length > 0 && rows.length === 0) throw new Error('El reporte devolvió meses fuera del rango pedido')
      const total = Math.round(rows.reduce((acc, row) => acc + row.valor, 0) * 100) / 100
      return {
        estado: rows.length > 0 ? 'ok' : 'sin_registros',
        rows,
        total,
        prestador: parsed.prestador,
        format,
        warnings: parsed.warnings,
        ms: Date.now() - started,
        attempts: attempt,
      }
    } catch (error) {
      if (error instanceof BlockedError) throw error
      lastError = error
      session.reset()
      if (attempt < args.retries) await sleep(2000 * 2 ** (attempt - 1))
    }
  }
  return { estado: 'error', rows: [], total: 0, prestador: null, mensaje: lastError ? lastError.message : 'Error desconocido', attempts: args.retries }
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
      .eq('regimen', REGIMEN)
      .eq('fuente', FUENTE)
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
        periodo: row.periodo,
        regimen: REGIMEN,
        tipo_contratacion: row.tipo,
        eps_codigo: row.eps_codigo,
        eps_nombre: row.eps_nombre,
        valor: row.valor,
        fuente: FUENTE,
        fetched_at: stamp,
      }))
      const { error } = await db.from('adres_giros').upsert(batch, { onConflict: 'nit,periodo,regimen,tipo_contratacion,eps_codigo' })
      if (error) throw new Error(`Error guardando adres_giros de ${nit}: ${error.message}`)
    }
    // Filas del rango que la ADRES ya no publica (se descargaron antes y no vinieron ahora)
    const { error: pruneError } = await db
      .from('adres_giros')
      .delete()
      .eq('nit', nit)
      .eq('regimen', REGIMEN)
      .eq('fuente', FUENTE)
      .gte('periodo', args.desde.slice(0, 8) + '01')
      .lte('periodo', args.hasta)
      .lt('fetched_at', stamp)
    if (pruneError) throw new Error(`Error podando adres_giros de ${nit}: ${pruneError.message}`)
  }
  const { error: logError } = await db.from('adres_fetch_log').insert({
    nit,
    desde: args.desde,
    hasta: args.hasta,
    estado: result.estado,
    mensaje: result.estado === 'error' ? String(result.mensaje || '').slice(0, 1000) : result.warnings?.length ? result.warnings.join('; ').slice(0, 1000) : null,
    filas: result.rows.length,
    total: result.estado === 'error' ? null : result.total,
    nombre_prestador: result.prestador,
    regimen: REGIMEN,
    fuente: FUENTE,
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

  console.log(`ADRES · Reporte 29 (régimen ${REGIMEN}) · ${args.desde} a ${args.hasta}`)
  console.log(
    `NIT: ${nits.length} · saltados (consultados hace menos de ${args.recentDays} días): ${skipped.size} · por consultar: ${pending.length}` +
      ` · consultas simultáneas: ${Math.min(args.parallel, Math.max(pending.length, 1))}${args.dryRun ? ' · DRY-RUN (no escribe en la base)' : ''}`
  )
  if (pending.length === 0) return 0

  const agent = await buildAgent(USER_AGENT)
  const summary = { ok: 0, sin_registros: 0, error: 0, filas: 0, total: 0, errores: [] }
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
        result = { estado: 'error', rows: [], total: 0, prestador: null, mensaje: error.message }
      }
      doneCount++
      summary[result.estado]++
      summary.filas += result.rows.length
      summary.total += result.total
      if (result.estado === 'error') summary.errores.push(`${nit}: ${result.mensaje}`)
      const who = result.prestador || names.get(nit) || ''
      const detail =
        result.estado === 'error'
          ? `ERROR ${result.mensaje}`
          : `${String(result.rows.length).padStart(4)} filas  $ ${cop(result.total).padStart(17)}${result.format === 'XML' ? '  (XML)' : ''}`
      const secs = result.ms ? `  ${(result.ms / 1000).toLocaleString('es-CO', { maximumFractionDigits: 1 })} s` : ''
      console.log(`[${String(doneCount).padStart(width)}/${pending.length}] ${nit.padEnd(10)} ${result.estado.padEnd(13)} ${detail}${who ? `  ${who}` : ''}${secs}`)
      if (args.delay > 0) await sleep(args.delay)
    }
  }

  await Promise.all(Array.from({ length: Math.min(args.parallel, pending.length) }, () => worker()))
  agent.destroy()

  console.log('')
  console.log(`Resumen ADRES (${args.desde} a ${args.hasta}, régimen ${REGIMEN})`)
  console.log(
    `  NIT consultados: ${doneCount} · con datos: ${summary.ok} · sin registros: ${summary.sin_registros} · errores: ${summary.error} · saltados (recientes): ${skipped.size}`
  )
  console.log(`  Filas ${args.dryRun ? 'leídas (no guardadas)' : 'guardadas'}: ${summary.filas} · Total girado: $ ${cop(summary.total)}`)
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
