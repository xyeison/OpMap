/**
 * Fase 4 · Cifras mensuales de afiliación de MinSalud → public.afiliacion_cifras.
 *
 * cargarCifras es la lógica que antes estaba dentro de scripts/minsalud-cifras-load.ts (se movió aquí SIN
 * cambiar el comportamiento: lectura de la hoja CoberturaMunicipio, código DANE por archivo / nombre / alias
 * / aprendido, cuadre con la fila de total de cada archivo, alias aprendidos, upsert por (corte, municipio),
 * poda del corte y verificación leyendo de la base). El script la sigue usando: lee los archivos del disco
 * y se los pasa en bytes.
 *
 * sincronizarCifras (PR 7) es la carga automática mensual (GET /api/cron/minsalud_cifras y "Actualizar
 * ahora"): lee la página "Cifras de aseguramiento en salud" de MinSalud, toma los enlaces a los ZIP
 * mensuales, y si hay un mes más nuevo que el último corte cargado, descarga ese ZIP y lo carga con
 * cargarCifras (uno por invocación; si hay más, la pasada queda "corriendo"). Si el archivo no cuadra con
 * su total, no escribe nada y deja el error en fuentes_estado.
 */
import type { SupabaseAdminClient } from './supabase-admin'
import { ALIAS_FUENTE_MINSALUD, computeCobertura, createMunicipioResolver, normalizeMunicipioName } from './municipio-alias'
import {
  cifrasNameKey,
  extractXlsxFromZip,
  parseCifrasCorte,
  readCifrasWorkbook,
  sumCifras,
  type CifrasSheet,
} from './poblacion-parse'
import { fetchAll, loadGeo, upsertBatches } from './poblacion-db'
import type { CargaResultado } from './fuentes-runner'

const fmt = (n: number | null | undefined) => (n === null || n === undefined ? '—' : n.toLocaleString('es-CO'))
const basename = (file: string) => file.split(/[\\/]/).pop() ?? file

/** Cifras nacionales de agosto-2026 publicadas en el tablero de MinSalud (para cuadrar). */
const TABLERO_AGOSTO_2026 = { corte: '2026-08-31', afiliados: 52_553_613, poblacion: 53_451_430 }


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

export interface CifrasArchivo {
  /** Ruta o nombre del archivo (.zip o .xlsx); solo se usa en los mensajes y para reconocer el mes. */
  file: string
  bytes: Uint8Array
}

export interface CargarCifrasParams {
  db: SupabaseAdminClient
  archivos: CifrasArchivo[]
  dryRun: boolean
  /** Escribir los alias aprendidos en municipio_alias (--no-alias lo apaga). */
  alias: boolean
  log: (line: string) => void
  logError: (line: string) => void
  /** Sin progreso en consola (cron). */
  quiet?: boolean
}

export interface CargarCifrasResult {
  ok: boolean
  blocking: number
  cortes: string[]
  escritas: number
  failed: number
  pruned: number
  aliasEscritos: number
  problemas: { lectura: number; conflictos: number; repetidos: number; sinCuadre: number; sinCodigo: number }
}

export async function cargarCifras(params: CargarCifrasParams): Promise<CargarCifrasResult> {
  const { log, logError } = params
  const loadedAt = new Date().toISOString()

  // 1. Leer y validar cada archivo
  const loaded: LoadedFile[] = []
  let readErrors = 0
  for (const archivo of params.archivos) {
    const file = archivo.file
    try {
      const bytes = archivo.bytes
      const xlsx = /\.zip$/i.test(file) ? extractXlsxFromZip(bytes) : { name: basename(file), bytes }
      const sheet = readCifrasWorkbook(xlsx.bytes)
      const corte = sheet.corte ?? parseCifrasCorte(basename(xlsx.name)) ?? parseCifrasCorte(basename(file))
      if (!corte) throw new Error(`no se reconoce el mes (título "${sheet.title}")`)
      if (sheet.errors.length > 0) throw new Error(`${sheet.errors.length} errores de lectura: ${sheet.errors.slice(0, 3).join(' | ')}`)
      loaded.push({ file, xlsxName: basename(xlsx.name), sheet, corte })
    } catch (error) {
      readErrors++
      logError(`${basename(file)}: ${error instanceof Error ? error.message : error}`)
    }
  }
  const cortes = new Map<string, LoadedFile>()
  for (const f of loaded) {
    if (cortes.has(f.corte)) throw new Error(`Dos archivos para el corte ${f.corte}: ${basename(cortes.get(f.corte)!.file)} y ${basename(f.file)}`)
    cortes.set(f.corte, f)
  }

  // 2. Geografía, alias y nombres aprendidos
  const db = params.db
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
  log(`Archivos: ${params.archivos.length} · leídos ${loaded.length} · con error ${readErrors}`)
  log('\ncorte       archivo                      cód. filas  municipios  especiales  vacías  afiliados     población     total archivo (afiliados / población)   cuadra')
  const cuadres: boolean[] = []
  for (const [corte, rows] of Array.from(byCorte.entries())) {
    const f = cortes.get(corte)!
    const sum = sumCifras(rows.map(r => ({ afiliados: r.afiliados, poblacion: r.poblacion_dane, contributivo: r.contributivo, subsidiado: r.subsidiado, excepcion: r.excepcion_especiales })))
    const t = f.sheet.total
    const ok = !!t && t.afiliados === sum.afiliados && t.poblacion === sum.poblacion && t.contributivo === sum.contributivo && t.subsidiado === sum.subsidiado && t.excepcion === sum.excepcion
    cuadres.push(ok)
    const municipios = rows.filter(r => validCodes.has(r.municipality_code)).length
    log(
      `${corte}  ${f.xlsxName.padEnd(28)} ${f.sheet.hasCodes ? 'sí ' : 'no '}  ${String(rows.length).padStart(5)}  ${String(municipios).padStart(10)}  ${String(rows.length - municipios).padStart(10)}  ${String(f.sheet.skippedEmpty).padStart(6)}  ${fmt(sum.afiliados).padStart(12)}  ${fmt(sum.poblacion).padStart(12)}  ${(`${fmt(t?.afiliados)} / ${fmt(t?.poblacion)}`).padStart(37)}   ${ok ? 'sí' : 'NO'}`
    )
  }
  const ago = byCorte.get(TABLERO_AGOSTO_2026.corte)
  if (ago) {
    const s = sumCifras(ago.map(r => ({ afiliados: r.afiliados, poblacion: r.poblacion_dane })))
    log(
      `\nNacional agosto-2026: afiliados ${fmt(s.afiliados)} (tablero ${fmt(TABLERO_AGOSTO_2026.afiliados)}: ${s.afiliados === TABLERO_AGOSTO_2026.afiliados ? 'igual' : 'DISTINTO'}) · población DANE ${fmt(s.poblacion)} (tablero ${fmt(TABLERO_AGOSTO_2026.poblacion)}: ${s.poblacion === TABLERO_AGOSTO_2026.poblacion ? 'igual' : 'DISTINTO'})`
    )
  }
  const origenes = new Map<string, number>()
  for (const rows of Array.from(byCorte.values())) for (const r of rows) origenes.set(r.codigo_origen, (origenes.get(r.codigo_origen) ?? 0) + 1)
  log(`Origen del código: ${Array.from(origenes.entries()).map(([k, v]) => `${k} ${fmt(v)}`).join(' · ')}`)
  log(`Sin código (no se cargan): ${unresolved.length}`)
  unresolved.slice(0, 20).forEach(u => log(`  - ${u}`))
  log(`Conflictos nombre vs aprendido: ${conflicts.length}`)
  conflicts.slice(0, 20).forEach(u => log(`  - ${u}`))
  log(`Conflictos entre archivos con código (mismo nombre, otro código): ${learnedConflicts.size}`)
  Array.from(learnedConflicts).slice(0, 20).forEach(u => log(`  - ${u}`))
  log(`Códigos repetidos dentro de un corte: ${duplicates.length}`)
  duplicates.slice(0, 20).forEach(u => log(`  - ${u}`))
  log(`Cobertura del archivo distinta de la calculada (> 1e-9): ${coberturaDiff.length}`)
  coberturaDiff.slice(0, 10).forEach(u => log(`  - ${u}`))
  log(`Alias aprendidos (nombre de MinSalud ≠ municipalities.name): ${aliasToWrite.size}`)
  Array.from(aliasToWrite.values()).forEach(a => log(`  - ${a.department_code} "${a.nombre_normalizado}" → ${a.municipality_code} · ${a.nota}`))

  const blocking = readErrors + conflicts.length + learnedConflicts.size + duplicates.length + cuadres.filter(ok => !ok).length
  const problemas = { lectura: readErrors, conflictos: conflicts.length + learnedConflicts.size, repetidos: duplicates.length, sinCuadre: cuadres.filter(ok => !ok).length, sinCodigo: unresolved.length }
  if (params.dryRun) {
    log('\n--dry-run: no se escribió nada.')
    return { ok: blocking === 0, blocking, cortes: Array.from(byCorte.keys()), escritas: 0, failed: 0, pruned: 0, aliasEscritos: 0, problemas }
  }
  if (blocking > 0) {
    log(`\n${blocking} problema(s) bloqueantes (lectura, conflictos, repetidos o totales que no cuadran): no se escribe nada.`)
    return { ok: false, blocking, cortes: Array.from(byCorte.keys()), escritas: 0, failed: 0, pruned: 0, aliasEscritos: 0, problemas }
  }

  // 5. Escribir
  if (params.alias && aliasToWrite.size > 0) {
    const { error } = await db.from('municipio_alias').upsert(Array.from(aliasToWrite.values()), { onConflict: 'fuente,department_code,nombre_normalizado' })
    if (error) throw new Error(`municipio_alias: ${error.message}`)
  }
  let failed = 0
  let pruned = 0
  let escritas = 0
  for (const [corte, rows] of Array.from(byCorte.entries())) {
    const res = await upsertBatches(db, 'afiliacion_cifras', rows, 'corte,municipality_code', 500, `afiliacion_cifras ${corte}`, { quiet: params.quiet })
    escritas += res.written
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
  log('\nafiliacion_cifras en la base:')
  for (const [corte, s] of Array.from(resumen.entries())) {
    log(`  ${corte}: ${fmt(s.filas)} filas (${fmt(s.municipios)} municipios de municipalities) · afiliados ${fmt(s.afiliados)} · población ${fmt(s.poblacion)}`)
  }
  log(`Upsert con ${failed} lotes con error · filas viejas borradas: ${pruned} · alias escritos: ${params.alias ? aliasToWrite.size : 0}`)
  return { ok: failed === 0, blocking: 0, cortes: Array.from(byCorte.keys()), escritas, failed, pruned, aliasEscritos: params.alias ? aliasToWrite.size : 0, problemas }
}

// ---------------------------------------------------------------------------------------------
// Carga automática (cron / "Actualizar ahora")
// ---------------------------------------------------------------------------------------------

export const CIFRAS_PAGINA = 'https://www.minsalud.gov.co/Proteccion-Social/Paginas/cifras-aseguramiento-salud.aspx'
const MINSALUD_ORIGEN = 'https://www.minsalud.gov.co'
const USER_AGENT = 'OpMap-cifras/1.0 (cifras de afiliacion de MinSalud; datos publicos)'

export interface ZipCifras {
  url: string
  nombre: string
  corte: string
}

/**
 * Enlaces a los ZIP mensuales en el HTML de la página de MinSalud (rutas de SharePoint, p. ej.
 * /sites/rid/Lists/BibliotecaDigital/RIDE/VP/RBC/cifras-afiliacion-salud-agosto2026.zip). El mes sale del
 * nombre del archivo (parseCifrasCorte: "agosto2026", "jun-2026", "oct2025"…). Sin repetidos por corte.
 */
export function extraerZipsCifras(html: string, origen = MINSALUD_ORIGEN): ZipCifras[] {
  const out = new Map<string, ZipCifras>()
  const re = /href="([^"]+?\.zip)"/gi
  let match: RegExpExecArray | null
  while ((match = re.exec(html)) !== null) {
    const href = match[1].replace(/&amp;/g, '&')
    const nombre = decodeURIComponent(basename(href))
    if (!/cifra/i.test(nombre)) continue
    const corte = parseCifrasCorte(nombre.replace(/[-_.]+/g, ' '))
    if (!corte || out.has(corte)) continue
    const url = /^https?:\/\//i.test(href) ? href : `${origen}${href.startsWith('/') ? '' : '/'}${href}`
    out.set(corte, { url, nombre, corte })
  }
  return Array.from(out.values()).sort((a, b) => (a.corte < b.corte ? 1 : -1))
}

async function fetchConLimite(url: string, timeoutMs: number): Promise<Response> {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, cache: 'no-store', signal: AbortSignal.timeout(timeoutMs) })
  if (!res.ok) throw new Error(`MinSalud HTTP ${res.status} en ${url}`)
  return res
}

export async function sincronizarCifras(opts: { db: SupabaseAdminClient; deadline: number; log?: (m: string) => void }): Promise<CargaResultado> {
  const { db } = opts
  const restante = () => opts.deadline - Date.now()
  const html = await (await fetchConLimite(CIFRAS_PAGINA, Math.min(30_000, restante()))).text()
  const zips = extraerZipsCifras(html)
  if (zips.length === 0) throw new Error('La página de MinSalud no trae enlaces a ZIP de cifras (¿cambió la página?)')

  const { data: cortesData, error } = await db.from('afiliacion_cifras').select('corte').order('corte', { ascending: false }).limit(1)
  if (error) throw new Error(`afiliacion_cifras: ${error.message}`)
  const ultimo = (cortesData?.[0] as { corte?: string } | undefined)?.corte ?? null
  const nuevos = zips.filter(z => !ultimo || z.corte > ultimo).sort((a, b) => (a.corte < b.corte ? -1 : 1))
  if (nuevos.length === 0) {
    return { terminado: true, filas: null, mensaje: `Sin cambios: el último ZIP publicado (${zips[0].nombre}, corte ${zips[0].corte}) ya está cargado.` }
  }
  if (restante() < 25_000) {
    return { terminado: false, filas: 0, mensaje: `Hay ${nuevos.length} mes(es) nuevo(s) (${nuevos.map(z => z.corte).join(', ')}); se cargan en la próxima ejecución.` }
  }

  const zip = nuevos[0]
  const bytes = new Uint8Array(await (await fetchConLimite(zip.url, Math.min(30_000, restante() - 15_000))).arrayBuffer())
  const lines: string[] = []
  const errores: string[] = []
  const r = await cargarCifras({
    db,
    archivos: [{ file: zip.nombre, bytes }],
    dryRun: false,
    alias: true,
    log: line => {
      lines.push(line)
      opts.log?.(line)
    },
    logError: line => errores.push(line),
    quiet: true,
  })
  if (!r.ok) {
    const p = r.problemas
    throw new Error(
      `${zip.nombre} (corte ${zip.corte}) no se cargó: lectura ${p.lectura}, conflictos ${p.conflictos}, repetidos ${p.repetidos}, sin cuadre ${p.sinCuadre}, lotes con error ${r.failed}. ${errores.slice(0, 2).join(' ')}`.trim()
    )
  }
  const quedan = nuevos.length - 1
  return {
    terminado: quedan === 0,
    filas: r.escritas,
    mensaje: `MinSalud: ${zip.nombre} (corte ${zip.corte}) cargado: ${fmt(r.escritas)} filas que cuadran con el total del archivo, ${r.pruned} viejas borradas, ${r.aliasEscritos} alias.${quedan > 0 ? ` Quedan ${quedan} mes(es); siguen en la próxima ejecución.` : ''}`,
  }
}
