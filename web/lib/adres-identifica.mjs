// Giros de la ADRES desde "Identifica tu Giro" (ERP, reporte SSRS "Consulta_Pagos_ERP").
// Funciones PURAS y sin dependencias (solo lib/adres-parse.mjs): las usan scripts/adres-identifica-giro.mjs
// (descarga), lib/adres-intelligence.ts (API) y scripts/adres-check.ts (pruebas). JavaScript con JSDoc
// para que el script .mjs las importe sin compilar.
//
// El reporte se exporta en XML (valores con centavos: Valor="177773524.0000000000000000") y en CSV
// (valores redondeados a pesos y SIN comillas: "$177.773.524"). Columnas:
//   Cuenta_Beneficiario,Nombre_Beneficiario,Fecha_Transaccion,Valor,Concepto,Nombre_Beneficiario2
//   890102768,NIT-890102768-ORGANIZACION CLINICA GENERAL DEL NORTE SA,27/01/2026,$177.773.524,PAGO Proc. Compensación ...,NIT-800251440-ENTIDAD PROMOTORA DE SALUD SANITAS S A S
// En pantalla se llaman "NIT Institución Beneficiaria", "Nombre Institución Beneficiaria", "Fecha de
// Giro", "Valor Girado", "Concepto" y "Entidad Ordenadora"; se aceptan los dos juegos de nombres.
import { parseCsv, parseMoney, stripAccents } from './adres-parse.mjs'

/**
 * Fila leída del reporte (antes de enriquecer).
 * @typedef {{ nit: string, fecha_giro: string, valor: number, concepto: string, beneficiario: string | null, ordenadora: string | null }} IdentificaRow
 */
/**
 * @typedef {Object} IdentificaParseResult
 * @property {IdentificaRow[]} rows
 * @property {boolean} headerFound  true si el texto es el reporte (aunque venga sin filas).
 * @property {string | null} prestador  Nombre del beneficiario (de la primera fila), sin el prefijo "NIT-…-".
 * @property {number} skipped  Filas no vacías que no se pudieron leer.
 * @property {string[]} warnings
 */
/**
 * Fila lista para guardar en adres_giros_detalle (sin huella: el script la calcula con sha256(clave)).
 * @typedef {{ nit: string, fecha_giro: string, valor: number, concepto: string, proceso: string | null, referencia: string | null,
 *   eps_ordenadora_nit: string | null, eps_ordenadora_nombre: string | null, regimen: 'contributivo' | 'subsidiado' | 'otro',
 *   ocurrencia: number, clave: string }} DetalleRow
 */

export const FUENTE_IDENTIFICA = 'adres_identifica_giro'

/** @param {unknown} value */
function cleanText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

/** @param {unknown} value */
function normKey(value) {
  return stripAccents(value).toLowerCase().replace(/[\s_]+/g, ' ').trim()
}

/** @param {number} n */
const pad2 = n => String(n).padStart(2, '0')
const round2 = (/** @type {number} */ n) => Math.round(n * 100) / 100

/**
 * Fecha del giro → 'YYYY-MM-DD'. Acepta 'dd/mm/aaaa' (como la publica la ADRES) y 'YYYY-MM-DD[T…]'.
 * @param {unknown} raw
 * @returns {string | null}
 */
export function parseFechaGiro(raw) {
  const s = String(raw ?? '').trim()
  let y, m, d
  let match = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s.*)?$/)
  if (match) {
    d = Number(match[1])
    m = Number(match[2])
    y = Number(match[3])
  } else if ((match = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/))) {
    y = Number(match[1])
    m = Number(match[2])
    d = Number(match[3])
  } else return null
  if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1 || d > new Date(Date.UTC(y, m, 0)).getUTCDate()) return null
  return `${y}-${pad2(m)}-${pad2(d)}`
}

/**
 * "NIT-800251440-ENTIDAD PROMOTORA DE SALUD SANITAS S A S" → { nit: '800251440', nombre: 'ENTIDAD …' }.
 * Sin el prefijo "TIPO-número-", nit = null y nombre = el texto completo.
 * @param {unknown} raw
 * @returns {{ nit: string | null, nombre: string | null }}
 */
export function parseEntidad(raw) {
  const s = cleanText(raw)
  if (!s) return { nit: null, nombre: null }
  const match = s.match(/^([A-Za-z]{2,3})\s*-\s*(\d{5,12})\s*-\s*(.*)$/)
  if (!match) return { nit: null, nombre: s }
  return { nit: match[2], nombre: cleanText(match[3]) || null }
}

/**
 * Régimen del giro según el concepto (sin tildes ni mayúsculas), en este orden:
 *   1. 'subsidiado'   si contiene "subsidiado" o la palabra "lma" (Liquidación Mensual de Afiliados);
 *   2. 'contributivo' si contiene "compensacion", "regimen contributivo", "cgd_proc" o "proceso_<n>_gd_"
 *                     (giro directo de la compensación con el formato viejo, sin la palabra);
 *   3. 'otro'         en cualquier otro caso (recobros NO UPC, reclamaciones SOAT/ECAT, COVID, resoluciones…).
 * @param {unknown} concepto
 * @returns {'contributivo' | 'subsidiado' | 'otro'}
 */
export function regimenDeConcepto(concepto) {
  const s = stripAccents(concepto).toLowerCase()
  if (s.includes('subsidiado') || /(^|[^a-z])lma([^a-z]|$)/.test(s)) return 'subsidiado'
  if (s.includes('compensacion') || s.includes('regimen contributivo') || s.includes('cgd_proc') || /proceso_\d+_gd_/.test(s)) return 'contributivo'
  return 'otro'
}

/**
 * Código final del concepto: con "_" (LMA_186_IPS) o en mayúsculas con algún tramo que mezcle letras y
 * cifras (PM62, PM2025-RC-GD1, PRUEBTAMIZ-GD66-2025). "COVID-19" o "2294" no son referencias.
 * @param {string} token
 */
function looksLikeReference(token) {
  if (token.length < 3 || token.length > 200) return false
  if (token.includes('_')) return true
  return /^[A-Z0-9]+(-[A-Z0-9]+)*$/.test(token) && token.split('-').some(part => /[A-Z]/.test(part) && /\d/.test(part))
}

/**
 * Número de proceso y referencia final del concepto:
 *   "… Proceso 12056 CGD_Proc_12041_EPS005_269_C" → { proceso: '12056', referencia: 'CGD_Proc_12041_EPS005_269_C' }
 *   "… Proceso 11802"                            → { proceso: '11802', referencia: null }
 *   "Proceso_11266_GD_SURA Proceso_11266_GD_SURA" (repetido) → { proceso: '11266', referencia: 'Proceso_11266_GD_SURA' }
 *   "… CXP IPS LMA_186_IPS"                      → { proceso: null, referencia: 'LMA_186_IPS' }
 * @param {unknown} concepto
 * @returns {{ proceso: string | null, referencia: string | null }}
 */
export function procesoYReferencia(concepto) {
  const c = cleanText(concepto)
  if (!c) return { proceso: null, referencia: null }
  const half = (c.length - 1) / 2
  if (Number.isInteger(half) && c[half] === ' ' && c.slice(0, half) === c.slice(half + 1)) {
    const ref = c.slice(0, half)
    return { proceso: ref.match(/proceso[_ ](\d+)/i)?.[1] ?? null, referencia: ref.length <= 200 ? ref : null }
  }
  const withProceso = c.match(/\bProceso\s+(\d+)(?:\s+(.+))?$/i)
  if (withProceso) {
    const ref = withProceso[2] ? cleanText(withProceso[2]) : ''
    return { proceso: withProceso[1], referencia: ref && ref.length <= 200 ? ref : null }
  }
  const last = c.split(' ').pop() || ''
  return { proceso: c.match(/proceso[_ ](\d+)/i)?.[1] ?? null, referencia: looksLikeReference(last) ? last : null }
}

const HEADER_ALIASES = {
  nit: ['cuenta beneficiario', 'nit institucion beneficiaria', 'nit beneficiario', 'nit eps o ips beneficiaria', 'nit'],
  beneficiario: ['nombre beneficiario', 'nombre institucion beneficiaria', 'institucion beneficiaria'],
  fecha: ['fecha transaccion', 'fecha de giro', 'fecha giro', 'fecha'],
  valor: ['valor', 'valor girado', 'valor giro'],
  concepto: ['concepto'],
  ordenadora: ['nombre beneficiario2', 'entidad ordenadora', 'ordenador', 'entidad'],
}

/** @typedef {{ nit: number, beneficiario: number, fecha: number, valor: number, concepto: number, ordenadora: number }} IdentColumns */

/** @param {string[]} header @returns {IdentColumns} */
function mapHeader(header) {
  const keys = header.map(normKey)
  /** @type {IdentColumns} */
  const map = { nit: -1, beneficiario: -1, fecha: -1, valor: -1, concepto: -1, ordenadora: -1 }
  for (const field of /** @type {(keyof IdentColumns)[]} */ (Object.keys(HEADER_ALIASES))) {
    for (const alias of HEADER_ALIASES[field]) {
      const index = keys.indexOf(alias)
      if (index !== -1 && !Object.values(map).includes(index)) {
        map[field] = index
        break
      }
    }
  }
  return map
}

/** @param {IdentColumns} map */
const recognized = map => Object.values(map).filter(index => index >= 0).length

/** Quita "NIT-…-" del nombre del beneficiario. @param {string | null} raw */
function prestadorName(raw) {
  if (!raw) return null
  return parseEntidad(raw).nombre
}

/**
 * Una fila del CSV con MÁS celdas que la cabecera (el CSV no lleva comillas: una coma en el concepto o
 * en un nombre parte la fila). Se rearma por contenido: NIT, beneficiario…, fecha, valor, concepto…,
 * ordenadora ("TIPO-número-…", la última celda que empiece así).
 * @param {string[]} cells
 * @returns {string[] | null} [nit, beneficiario, fecha, valor, concepto, ordenadora] o null
 */
function realignCells(cells) {
  const fechaIndex = cells.findIndex((cell, index) => index >= 2 && parseFechaGiro(cell) !== null)
  if (fechaIndex < 2 || fechaIndex + 2 >= cells.length) return null
  let ordIndex = -1
  for (let i = cells.length - 1; i > fechaIndex + 1; i--) {
    if (/^[A-Za-z]{2,3}-\d{5,12}-/.test(cells[i].trim())) {
      ordIndex = i
      break
    }
  }
  if (ordIndex === -1) return null
  return [
    cells[0],
    cells.slice(1, fechaIndex).join(','),
    cells[fechaIndex],
    cells[fechaIndex + 1],
    cells.slice(fechaIndex + 2, ordIndex).join(','),
    cells.slice(ordIndex).join(','),
  ]
}

/**
 * @param {string[]} cells
 * @param {IdentColumns} map
 * @param {',' | '.'} decimal
 * @returns {IdentificaRow | null}
 */
function rowFromCells(cells, map, decimal) {
  const nit = cleanText(cells[map.nit]).replace(/\D/g, '')
  const fecha = parseFechaGiro(cells[map.fecha])
  const valor = parseMoney(cells[map.valor], decimal)
  if (!/^\d{5,12}$/.test(nit) || !fecha || valor === null) return null
  return {
    nit,
    fecha_giro: fecha,
    valor,
    concepto: map.concepto >= 0 ? cleanText(cells[map.concepto]) : '',
    beneficiario: map.beneficiario >= 0 ? cleanText(cells[map.beneficiario]) || null : null,
    ordenadora: map.ordenadora >= 0 ? cleanText(cells[map.ordenadora]) || null : null,
  }
}

/**
 * CSV exportado de "Consulta tu Giro" → filas. Valores redondeados a pesos ("$1.409.947"): sirve para
 * validar el XML (que trae centavos) o como respaldo. headerFound=false si el texto no es el reporte.
 * @param {string} text
 * @returns {IdentificaParseResult}
 */
export function parseIdentificaCsv(text) {
  const all = parseCsv(text)
  const isEmpty = (/** @type {string[]} */ row) => row.every(cell => cell.trim() === '')
  const headerIndex = all.findIndex(row => recognized(mapHeader(row)) >= 4)
  if (headerIndex === -1) {
    return { rows: [], headerFound: false, prestador: null, skipped: 0, warnings: ['No se reconoce el reporte "Consulta tu Giro" (CSV)'] }
  }
  const header = all[headerIndex]
  const map = mapHeader(header)
  /** @type {IdentificaRow[]} */
  const rows = []
  let skipped = 0
  for (const raw of all.slice(headerIndex + 1)) {
    if (isEmpty(raw)) continue
    let cells = raw
    if (raw.length > header.length) {
      const fixed = realignCells(raw)
      if (!fixed) {
        skipped++
        continue
      }
      cells = fixed
    }
    const row = cells === raw ? rowFromCells(cells, map, ',') : rowFromCells(cells, { nit: 0, beneficiario: 1, fecha: 2, valor: 3, concepto: 4, ordenadora: 5 }, ',')
    if (row) rows.push(row)
    else skipped++
  }
  /** @type {string[]} */
  const warnings = skipped > 0 ? [`${skipped} fila(s) del CSV no se pudieron leer`] : []
  return { rows, headerFound: true, prestador: prestadorName(rows[0]?.beneficiario ?? null), skipped, warnings }
}

/** @param {string} value */
function decodeXml(value) {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&')
}

/**
 * XML exportado de "Consulta tu Giro" ("Archivo XML con datos de informe"): un elemento <Details …/>
 * por giro con los campos como atributos y el valor con punto decimal y centavos. Es la lectura
 * principal (el CSV redondea a pesos). Sin registros llega como <Report …><Tablix1 /></Report>.
 * @param {string} text
 * @returns {IdentificaParseResult}
 */
export function parseIdentificaXml(text) {
  const s = String(text ?? '').replace(/^﻿/, '')
  if (!/<Report\b/i.test(s)) {
    return { rows: [], headerFound: false, prestador: null, skipped: 0, warnings: ['No se reconoce el reporte "Consulta tu Giro" (XML)'] }
  }
  /** @type {IdentificaRow[]} */
  const rows = []
  let skipped = 0
  for (const match of s.matchAll(/<([A-Za-z_][\w.-]*)\b([^<>]*?)\/?>/g)) {
    /** @type {Record<string, string>} */
    const attrs = {}
    for (const attr of match[2].matchAll(/([A-Za-z_][\w.:-]*)="([^"]*)"/g)) attrs[attr[1]] = decodeXml(attr[2])
    const keys = Object.keys(attrs).filter(key => !key.includes(':') && key !== 'Name')
    const map = mapHeader(keys)
    if (recognized(map) < 4) continue
    const row = rowFromCells(keys.map(key => attrs[key]), map, '.')
    if (row) rows.push(row)
    else skipped++
  }
  /** @type {string[]} */
  const warnings = skipped > 0 ? [`${skipped} fila(s) del XML no se pudieron leer`] : []
  return { rows, headerFound: true, prestador: prestadorName(rows[0]?.beneficiario ?? null), skipped, warnings }
}

/**
 * ¿Cuadran el XML (centavos) y el CSV (pesos redondeados) del mismo reporte? Mismo número de filas y la
 * diferencia de sumas no supera medio peso por fila (redondeo del CSV).
 * @param {IdentificaRow[]} xmlRows
 * @param {IdentificaRow[]} csvRows
 * @returns {{ ok: boolean, filasXml: number, filasCsv: number, sumaXml: number, sumaCsv: number, diff: number }}
 */
export function crossCheckExports(xmlRows, csvRows) {
  const sumaXml = round2(xmlRows.reduce((acc, row) => acc + row.valor, 0))
  const sumaCsv = round2(csvRows.reduce((acc, row) => acc + row.valor, 0))
  const diff = round2(sumaXml - sumaCsv)
  const ok = xmlRows.length === csvRows.length && Math.abs(diff) <= 0.5 * xmlRows.length + 0.01
  return { ok, filasXml: xmlRows.length, filasCsv: csvRows.length, sumaXml, sumaCsv, diff }
}

/**
 * Clave canónica de un giro (la huella es su sha256). La entidad ordenadora va por NIT, o por nombre si
 * no trae NIT (los nombres cambian con el tiempo; el NIT no).
 * @param {{ nit: string, fecha_giro: string, valor: number, concepto: string, eps_ordenadora_nit: string | null, eps_ordenadora_nombre: string | null }} row
 * @param {number} ocurrencia
 */
export function detalleKey(row, ocurrencia) {
  const entidad = row.eps_ordenadora_nit || `nombre:${row.eps_ordenadora_nombre || ''}`
  return [row.nit, row.fecha_giro, row.valor.toFixed(2), cleanText(row.concepto), entidad, ocurrencia].join('|')
}

/**
 * Enriquece las filas leídas: proceso, referencia, entidad ordenadora, régimen, ocurrencia (1, 2… entre
 * giros idénticos de la misma descarga) y clave canónica. Ordena por fecha desc, valor y concepto.
 * @param {IdentificaRow[]} rows
 * @returns {DetalleRow[]}
 */
export function buildDetalleRows(rows) {
  /** @type {Map<string, number>} */
  const seen = new Map()
  const sorted = [...rows].sort(
    (a, b) => b.fecha_giro.localeCompare(a.fecha_giro) || a.valor - b.valor || a.concepto.localeCompare(b.concepto) || String(a.ordenadora).localeCompare(String(b.ordenadora))
  )
  return sorted.map(row => {
    const concepto = cleanText(row.concepto)
    const entidad = parseEntidad(row.ordenadora)
    const base = { nit: row.nit, fecha_giro: row.fecha_giro, valor: round2(row.valor), concepto, eps_ordenadora_nit: entidad.nit, eps_ordenadora_nombre: entidad.nombre }
    const baseKey = detalleKey(base, 0)
    const ocurrencia = (seen.get(baseKey) || 0) + 1
    seen.set(baseKey, ocurrencia)
    const { proceso, referencia } = procesoYReferencia(concepto)
    return { ...base, proceso, referencia, regimen: regimenDeConcepto(concepto), ocurrencia, clave: detalleKey(base, ocurrencia) }
  })
}

/**
 * Ventanas de consulta de como mucho `maxMonths` meses de calendario entre dos fechas 'YYYY-MM-DD'
 * (inclusive). 2025-01-01..2026-09-30 con 6 → ene–jun 2025, jul–dic 2025, ene–jun 2026, jul–sep 2026.
 * @param {string} desde
 * @param {string} hasta
 * @param {number} maxMonths
 * @returns {Array<{ desde: string, hasta: string }>}
 */
export function splitDateWindows(desde, hasta, maxMonths) {
  if (!(maxMonths >= 1) || desde > hasta) return []
  /** @type {Array<{ desde: string, hasta: string }>} */
  const windows = []
  let start = desde
  while (start <= hasta && windows.length < 1000) {
    const [y, m] = start.split('-').map(Number)
    const endIndex = y * 12 + (m - 1) + (maxMonths - 1)
    const endY = Math.floor(endIndex / 12)
    const endM = (endIndex % 12) + 1
    const monthEnd = `${endY}-${pad2(endM)}-${pad2(new Date(Date.UTC(endY, endM, 0)).getUTCDate())}`
    const end = monthEnd < hasta ? monthEnd : hasta
    windows.push({ desde: start, hasta: end })
    const nextIndex = endIndex + 1
    start = `${Math.floor(nextIndex / 12)}-${pad2((nextIndex % 12) + 1)}-01`
  }
  return windows
}

/**
 * Agregado mensual del detalle (misma regla que la vista adres_giros_mensual): por NIT, mes (día 1),
 * régimen y NIT de la entidad ordenadora; nombre = el del giro más reciente.
 * @param {Array<Pick<DetalleRow, 'nit' | 'fecha_giro' | 'valor' | 'regimen' | 'eps_ordenadora_nit' | 'eps_ordenadora_nombre'>>} rows
 * @returns {Array<{ nit: string, periodo: string, regimen: string, eps_ordenadora_nit: string | null, eps_ordenadora_nombre: string | null, valor: number, giros: number, ultima_fecha: string }>}
 */
export function aggregateDetalleMensual(rows) {
  /** @type {Map<string, { nit: string, periodo: string, regimen: string, eps_ordenadora_nit: string | null, eps_ordenadora_nombre: string | null, valor: number, giros: number, ultima_fecha: string }>} */
  const groups = new Map()
  for (const row of rows) {
    const periodo = `${row.fecha_giro.slice(0, 7)}-01`
    const key = `${row.nit}|${periodo}|${row.regimen}|${row.eps_ordenadora_nit ?? ''}`
    const current = groups.get(key)
    if (!current) {
      groups.set(key, {
        nit: row.nit,
        periodo,
        regimen: row.regimen,
        eps_ordenadora_nit: row.eps_ordenadora_nit,
        eps_ordenadora_nombre: row.eps_ordenadora_nombre,
        valor: row.valor,
        giros: 1,
        ultima_fecha: row.fecha_giro,
      })
      continue
    }
    current.valor = round2(current.valor + row.valor)
    current.giros++
    if (row.fecha_giro >= current.ultima_fecha) {
      current.ultima_fecha = row.fecha_giro
      if (row.eps_ordenadora_nombre) current.eps_ordenadora_nombre = row.eps_ordenadora_nombre
    }
  }
  return Array.from(groups.values()).sort(
    (a, b) =>
      a.nit.localeCompare(b.nit) ||
      a.periodo.localeCompare(b.periodo) ||
      a.regimen.localeCompare(b.regimen) ||
      String(a.eps_ordenadora_nit ?? '').localeCompare(String(b.eps_ordenadora_nit ?? ''))
  )
}

/**
 * Suma por régimen (para el resumen del script).
 * @param {Array<Pick<DetalleRow, 'valor' | 'regimen'>>} rows
 */
export function sumByRegimen(rows) {
  const out = { total: 0, contributivo: 0, subsidiado: 0, otro: 0 }
  for (const row of rows) {
    out.total += row.valor
    out[row.regimen] += row.valor
  }
  return { total: round2(out.total), contributivo: round2(out.contributivo), subsidiado: round2(out.subsidiado), otro: round2(out.otro) }
}
