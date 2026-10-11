// Fase 3 · Giros directos de la ADRES (Reporte 29, régimen subsidiado).
// Funciones PURAS y sin dependencias: las usan scripts/adres-giros.mjs (Node, descarga),
// lib/adres-intelligence.ts (API) y scripts/adres-check.ts (pruebas). JavaScript con JSDoc para que
// el script .mjs las importe sin compilar.
//
// El reporte (SSRS / ReportViewer 2010) exporta un CSV así (es-CO: punto de miles, coma decimal):
//   textbox29,PERIODOENCAB
//   EMPRESA SOCIAL DEL ESTADO HOSPITAL ...,Enero-2025 a  Marzo-2025
//   <línea vacía>
//   PROCESO1,PROCESO,forma_contratacion,ent_id,ent_nombre,valor,Textbox127,Textbox8
//   Enero-2025 - Capitacion,Enero-2025,Capitacion,EPSS37,Nueva Eps,"64.268.466,00","120.193.764,00","3.455.268.246,00"
// (Textbox127 = subtotal del grupo mes+tipo; Textbox8 = total general). Las columnas se mapean
// primero por nombre y, si el nombre no se reconoce, por contenido (mes-año, tipo, código EPS, valor).

/** @typedef {{ periodo: string, tipo: string, eps_codigo: string, eps_nombre: string | null, valor: number }} GiroRow */
/**
 * @typedef {Object} GirosParseResult
 * @property {string | null} prestador   Nombre del prestador que imprime el reporte.
 * @property {string | null} rango       Texto del rango ("Enero-2025 a  Marzo-2025").
 * @property {GiroRow[]} rows            Filas de detalle (sin agregar).
 * @property {boolean} headerFound       true si se reconoció la tabla de detalle (aunque esté vacía).
 * @property {number | null} reportTotal Total general del reporte (si viene), para cuadrar.
 * @property {number} skipped            Filas no vacías que no se pudieron leer.
 * @property {string[]} warnings
 */

const MESES = {
  enero: 1, ene: 1,
  febrero: 2, feb: 2,
  marzo: 3, mar: 3,
  abril: 4, abr: 4,
  mayo: 5, may: 5,
  junio: 6, jun: 6,
  julio: 7, jul: 7,
  agosto: 8, ago: 8,
  septiembre: 9, setiembre: 9, sept: 9, sep: 9, set: 9,
  octubre: 10, oct: 10,
  noviembre: 11, nov: 11,
  diciembre: 12, dic: 12,
}

export const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** @param {unknown} value */
export function stripAccents(value) {
  return String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/** @param {unknown} value */
function normKey(value) {
  return stripAccents(value).toLowerCase().replace(/[\s_]+/g, ' ').trim()
}

/** @param {number} n */
const pad2 = n => String(n).padStart(2, '0')

/**
 * NIT del prestador SIN dígito de verificación a partir de hospitals.code ("NIT-DV").
 * Acepta espacios sobrantes, DV de 2 dígitos ("800149384-10") y NIT de 9 dígitos con el DV pegado
 * ("9013620904" → "901362090"). Devuelve null si no parece un NIT.
 * @param {unknown} code
 * @returns {string | null}
 */
export function normalizeNit(code) {
  const s = String(code ?? '').replace(/\s+/g, '').replace(/\./g, '')
  if (!s) return null
  let m = s.match(/^(\d{5,12})-\d{1,2}$/)
  if (m) return m[1]
  m = s.match(/^\d{5,12}$/)
  if (m) {
    // NIT de persona jurídica: 9 dígitos que empiezan por 8 o 9. Con 10 dígitos, el último es el DV.
    if (s.length === 10 && /^[89]/.test(s)) return s.slice(0, 9)
    return s
  }
  return null
}

/**
 * NIT (9 dígitos, sin DV) de una IPS a partir de hospitals.code. MISMA regla que la columna generada
 * hospitals.nit (migración 0600 de la Fase 3 REPS) y que nitFromCode() de lib/reps-match.ts:
 * code sin espacios al borde = 9 dígitos + "-DV" (1 o 2 cifras) o 9 dígitos + DV pegado.
 * Se usa para cruzar las IPS con adres_giros; para un NIT escrito a mano, normalizeNit().
 * @param {unknown} code
 * @returns {string | null}
 */
export function nitFromHospitalCode(code) {
  if (typeof code !== 'string') return null
  const match = /^(\d{9})(?:-\d{1,2}|\d)$/.exec(code.trim())
  return match ? match[1] : null
}

/**
 * Valor en pesos. decimal ',' (es-CO: "903.103.531,00"), '.' (XML: "903103531.00") o 'auto'.
 * Admite "$", espacios, signo menos y paréntesis contables. null si no es un número.
 * @param {unknown} raw
 * @param {',' | '.' | 'auto'} [decimal]
 * @returns {number | null}
 */
export function parseMoney(raw, decimal = 'auto') {
  if (raw === null || raw === undefined) return null
  let s = String(raw).trim().replace(/[\s$ ]/g, '')
  if (!s) return null
  let negative = false
  if (/^\(.*\)$/.test(s)) {
    negative = true
    s = s.slice(1, -1)
  }
  if (s.startsWith('-')) {
    negative = !negative
    s = s.slice(1)
  } else if (s.startsWith('+')) {
    s = s.slice(1)
  }
  if (!s) return null
  let dec = decimal
  if (dec === 'auto') {
    if (s.includes(',')) dec = ','
    else if (/^\d+\.\d{1,2}$/.test(s)) dec = '.'
    else dec = ','
  }
  let normalized
  if (dec === ',') {
    if (!/^(\d{1,3}(\.\d{3})+|\d+)(,\d+)?$/.test(s)) return null
    normalized = s.replace(/\./g, '').replace(',', '.')
  } else {
    if (!/^(\d{1,3}(,\d{3})+|\d+)(\.\d+)?$/.test(s)) return null
    normalized = s.replace(/,/g, '')
  }
  const n = Number(normalized)
  if (!Number.isFinite(n)) return null
  const rounded = Math.round(n * 100) / 100
  return negative ? -rounded : rounded
}

/**
 * Mes de proceso → 'YYYY-MM-01'. Acepta "Enero-2025", "enero 2025", "Ene-2025", "Sept. 2025",
 * "2025-01", "2025/01", "01/2025". null si no es un mes.
 * @param {unknown} raw
 * @returns {string | null}
 */
export function parsePeriodo(raw) {
  const s = stripAccents(raw).trim().toLowerCase()
  if (!s) return null
  const valid = (/** @type {number} */ y, /** @type {number} */ m) =>
    y >= 2000 && y <= 2100 && m >= 1 && m <= 12 ? `${y}-${pad2(m)}-01` : null
  let m = s.match(/^([a-z]{3,10})\.?\s*[-/ ]\s*(\d{4})$/)
  if (m) {
    const month = MESES[/** @type {keyof typeof MESES} */ (m[1])]
    return month ? valid(Number(m[2]), month) : null
  }
  m = s.match(/^(\d{4})[-/](\d{1,2})(?:[-/]01)?$/)
  if (m) return valid(Number(m[1]), Number(m[2]))
  m = s.match(/^(\d{1,2})[-/](\d{4})$/)
  if (m) return valid(Number(m[2]), Number(m[1]))
  return null
}

/** Código de EPS publicado por la ADRES (EPSS41, EPSI05, ESS207, CCF055, EPS037…). */
const EPS_CODE_RE = /^[A-Z]{2,6}\d{2,4}[A-Z]?$/

/** @param {unknown} value */
function looksLikeEpsCode(value) {
  return EPS_CODE_RE.test(String(value ?? '').trim().toUpperCase())
}

/** @param {unknown} value */
function looksLikeTipo(value) {
  return /^(capitaci[oó]n|evento|pgp|pago global prospectivo|presupuesto maximo|otros?)$/i.test(stripAccents(value).trim())
}

/** @param {unknown} value */
function cleanText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

/**
 * CSV RFC 4180 (comillas dobles, saltos CRLF/LF, comillas escapadas ""). Quita el BOM.
 * Devuelve también las filas vacías (separan los bloques del reporte).
 * @param {string} text
 * @returns {string[][]}
 */
export function parseCsv(text) {
  const s = String(text ?? '').replace(/^﻿/, '')
  /** @type {string[][]} */
  const rows = []
  /** @type {string[]} */
  let row = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (quoted) {
      if (ch === '"') {
        if (s[i + 1] === '"') {
          cell += '"'
          i++
        } else quoted = false
      } else cell += ch
      continue
    }
    if (ch === '"') quoted = true
    else if (ch === ',') {
      row.push(cell)
      cell = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && s[i + 1] === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else cell += ch
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }
  return rows
}

const HEADER_ALIASES = {
  periodo: ['proceso', 'mes de proceso', 'mes proceso', 'mes', 'periodo'],
  tipo: ['forma contratacion', 'forma de contratacion', 'tipo contratacion', 'tipo de contratacion', 'tipo'],
  eps_codigo: ['ent id', 'codigo eps', 'cod eps', 'codigo entidad', 'codigo'],
  eps_nombre: ['ent nombre', 'nombre eps', 'nombre entidad', 'eps', 'entidad'],
  valor: ['valor', 'giro total', 'valor giro', 'giro'],
}

/** @typedef {{ periodo: number, tipo: number, eps_codigo: number, eps_nombre: number, valor: number }} ColumnMap */

/**
 * Columnas por nombre de cabecera (-1 si no está).
 * @param {string[]} header
 * @returns {ColumnMap}
 */
function mapByHeader(header) {
  const keys = header.map(normKey)
  /** @type {ColumnMap} */
  const map = { periodo: -1, tipo: -1, eps_codigo: -1, eps_nombre: -1, valor: -1 }
  for (const field of /** @type {(keyof ColumnMap)[]} */ (Object.keys(HEADER_ALIASES))) {
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

/**
 * Completa por CONTENIDO las columnas que la cabecera no identificó: mes-año, tipo de contratación,
 * código de EPS, valor (la primera columna de dinero después del código: las de la derecha son
 * subtotales) y nombre de EPS (texto junto al código).
 * @param {string[][]} rows
 * @param {ColumnMap} map
 * @param {',' | '.' | 'auto'} decimal
 * @returns {ColumnMap}
 */
function inferByContent(rows, map, decimal) {
  const result = { ...map }
  if (rows.length === 0) return result
  const width = Math.max(...rows.map(row => row.length))
  /** @param {(value: string) => boolean} test @param {number} col */
  const ratio = (test, col) => rows.filter(row => test(row[col] ?? '')).length / rows.length
  const used = () => new Set(Object.values(result).filter(index => index >= 0))
  /** @param {(value: string) => boolean} test @param {number} [from] */
  const firstColumn = (test, from = 0) => {
    const taken = used()
    for (let col = from; col < width; col++) {
      if (!taken.has(col) && ratio(test, col) >= 0.8) return col
    }
    return -1
  }
  if (result.periodo < 0) result.periodo = firstColumn(value => parsePeriodo(value) !== null)
  if (result.tipo < 0) result.tipo = firstColumn(looksLikeTipo)
  if (result.eps_codigo < 0) result.eps_codigo = firstColumn(looksLikeEpsCode)
  if (result.valor < 0) {
    const isMoney = (/** @type {string} */ value) => parseMoney(value, decimal) !== null
    result.valor = firstColumn(isMoney, result.eps_codigo >= 0 ? result.eps_codigo + 1 : 0)
    if (result.valor < 0) result.valor = firstColumn(isMoney)
  }
  if (result.eps_nombre < 0) {
    const isText = (/** @type {string} */ value) =>
      cleanText(value) !== '' && parseMoney(value, decimal) === null && !looksLikeEpsCode(value) && parsePeriodo(value) === null
    const next = result.eps_codigo >= 0 ? result.eps_codigo + 1 : -1
    if (next >= 0 && next < width && !used().has(next) && ratio(isText, next) >= 0.8) result.eps_nombre = next
    else result.eps_nombre = firstColumn(isText)
  }
  return result
}

/**
 * Busca en las columnas de dinero sobrantes un valor constante (total general) y lo devuelve si hay
 * uno; prefiere el que cuadra con la suma de las filas.
 * @param {string[][]} rows
 * @param {ColumnMap} map
 * @param {number} sum
 * @param {',' | '.' | 'auto'} decimal
 * @returns {number | null}
 */
function findReportTotal(rows, map, sum, decimal) {
  if (rows.length === 0) return null
  const width = Math.max(...rows.map(row => row.length))
  const taken = new Set(Object.values(map))
  /** @type {number[]} */
  const constants = []
  for (let col = 0; col < width; col++) {
    if (taken.has(col)) continue
    const values = rows.map(row => parseMoney(row[col] ?? '', decimal))
    if (values.some(value => value === null)) continue
    if (values.every(value => value === values[0])) constants.push(/** @type {number} */ (values[0]))
  }
  if (constants.length === 0) return null
  return constants.find(value => Math.abs(value - sum) < 0.5) ?? constants[constants.length - 1]
}

/**
 * Convierte filas de celdas ya mapeadas en GiroRow. Cuenta las que no se pueden leer.
 * @param {string[][]} dataRows
 * @param {ColumnMap} map
 * @param {',' | '.' | 'auto'} decimal
 * @param {string[]} warnings
 */
function rowsFromCells(dataRows, map, decimal, warnings) {
  /** @type {GiroRow[]} */
  const rows = []
  /** @type {string[][]} */
  const parsedCells = []
  let skipped = 0
  for (const cells of dataRows) {
    const periodo = map.periodo >= 0 ? parsePeriodo(cells[map.periodo]) : null
    const valor = map.valor >= 0 ? parseMoney(cells[map.valor], decimal) : null
    const tipo = map.tipo >= 0 ? cleanText(cells[map.tipo]) : ''
    const epsCodigo = map.eps_codigo >= 0 ? cleanText(cells[map.eps_codigo]).toUpperCase() : ''
    if (!periodo || valor === null || !tipo || !epsCodigo) {
      skipped++
      continue
    }
    const epsNombre = map.eps_nombre >= 0 ? cleanText(cells[map.eps_nombre]) : ''
    rows.push({ periodo, tipo, eps_codigo: epsCodigo, eps_nombre: epsNombre || null, valor })
    parsedCells.push(cells)
  }
  if (skipped > 0) warnings.push(`${skipped} fila(s) del reporte no se pudieron leer`)
  return { rows, skipped, parsedCells }
}

/**
 * CSV exportado del Reporte 29 → filas de giro. headerFound=false si el texto no es el reporte
 * (página de error, HTML…): el llamador debe probar otro formato o reintentar.
 * @param {string} text
 * @returns {GirosParseResult}
 */
export function parseGirosCsv(text) {
  const all = parseCsv(text)
  /** @type {string[]} */
  const warnings = []
  const isEmpty = (/** @type {string[]} */ row) => row.every(cell => cell.trim() === '')

  // Bloque 1 (encabezado del reporte): hasta la primera fila vacía.
  let prestador = null
  let rango = null
  const firstBlank = all.findIndex(isEmpty)
  const head = firstBlank === -1 ? [] : all.slice(0, firstBlank)
  if (head.length >= 2 && head[1].length >= 1) {
    prestador = cleanText(head[1][0]) || null
    rango = head[1].length >= 2 ? cleanText(head[1][1]) || null : null
  }

  // Cabecera de detalle: la fila con más nombres reconocidos (al menos 2).
  let headerIndex = -1
  let best = 1
  all.forEach((row, index) => {
    const map = mapByHeader(row)
    const found = Object.values(map).filter(col => col >= 0).length
    if (found > best) {
      best = found
      headerIndex = index
    }
  })

  const headerFound = headerIndex !== -1
  const start = headerFound ? headerIndex + 1 : firstBlank === -1 ? 0 : firstBlank + 1
  const dataRows = all.slice(start).filter(row => !isEmpty(row) && row.length >= 4)
  if (!headerFound && dataRows.length === 0) {
    return { prestador, rango, rows: [], headerFound: false, reportTotal: null, skipped: 0, warnings: ['No se reconoce el reporte'] }
  }

  const byHeader = headerFound ? mapByHeader(all[headerIndex]) : { periodo: -1, tipo: -1, eps_codigo: -1, eps_nombre: -1, valor: -1 }
  const map = inferByContent(dataRows, byHeader, ',')
  const { rows, skipped, parsedCells } = rowsFromCells(dataRows, map, ',', warnings)
  if (!headerFound && rows.length === 0) {
    return { prestador, rango, rows: [], headerFound: false, reportTotal: null, skipped, warnings: ['No se reconoce el reporte', ...warnings] }
  }
  const sum = rows.reduce((acc, row) => acc + row.valor, 0)
  // El total general solo se busca en las filas leídas (una fila de cabecera sin reconocer no cuenta)
  const reportTotal = findReportTotal(parsedCells, map, sum, ',')
  return { prestador, rango, rows, headerFound: true, reportTotal, skipped, warnings }
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
 * XML exportado del Reporte 29 ("Archivo XML con datos de informe"): mismos campos como atributos
 * (<Detalles PROCESO="Enero-2025" forma_contratacion="Capitacion" ent_id="EPSS37" … valor="64268466.00"/>),
 * con punto decimal. Respaldo cuando el CSV falla.
 * @param {string} text
 * @returns {GirosParseResult}
 */
export function parseGirosXml(text) {
  const s = String(text ?? '').replace(/^﻿/, '')
  /** @type {string[]} */
  const warnings = []
  if (!/<Report\b/i.test(s)) {
    return { prestador: null, rango: null, rows: [], headerFound: false, reportTotal: null, skipped: 0, warnings: ['No se reconoce el reporte XML'] }
  }
  /** @type {Array<Record<string, string>>} */
  const elements = []
  for (const match of s.matchAll(/<([A-Za-z_][\w.-]*)\b([^<>]*?)\/?>/g)) {
    if (match[1].startsWith('?')) continue
    /** @type {Record<string, string>} */
    const attrs = {}
    for (const attr of match[2].matchAll(/([A-Za-z_][\w.:-]*)="([^"]*)"/g)) attrs[attr[1]] = decodeXml(attr[2])
    if (Object.keys(attrs).length > 0) elements.push(attrs)
  }

  let prestador = null
  let rango = null
  /** @type {number[]} */
  const totals = []
  /** @type {string[][]} */
  const detailCells = []
  /** @type {string[] | null} */
  let detailKeys = null
  for (const attrs of elements) {
    const keys = Object.keys(attrs).filter(key => !key.includes(':') && key !== 'Name' && key !== 'schemaLocation')
    const map = mapByHeader(keys)
    const recognized = Object.values(map).filter(col => col >= 0).length
    if (recognized >= 3) {
      if (!detailKeys) detailKeys = keys
      detailCells.push(detailKeys.map(key => attrs[key] ?? ''))
      continue
    }
    for (const key of keys) {
      const lower = key.toLowerCase()
      if (lower === 'textbox29' && !prestador) prestador = cleanText(attrs[key]) || null
      else if (lower === 'periodoencab' && !rango) rango = cleanText(attrs[key]) || null
      else if (/^textbox\d+$/.test(lower)) {
        const value = parseMoney(attrs[key], '.')
        if (value !== null) totals.push(value)
      }
    }
  }
  if (!detailKeys) return { prestador, rango, rows: [], headerFound: true, reportTotal: totals.length ? totals[0] : null, skipped: 0, warnings }
  const map = inferByContent(detailCells, mapByHeader(detailKeys), '.')
  const { rows, skipped } = rowsFromCells(detailCells, map, '.', warnings)
  const sum = rows.reduce((acc, row) => acc + row.valor, 0)
  const reportTotal = totals.find(value => Math.abs(value - sum) < 0.5) ?? (totals.length ? totals[0] : null)
  return { prestador, rango, rows, headerFound: true, reportTotal, skipped, warnings }
}

/**
 * Suma las filas repetidas por (periodo, tipo, EPS) — la clave única de adres_giros — para que el
 * upsert no choque consigo mismo. Ordena por periodo, tipo y EPS.
 * @param {GiroRow[]} rows
 * @returns {GiroRow[]}
 */
export function aggregateGiroRows(rows) {
  /** @type {Map<string, GiroRow>} */
  const byKey = new Map()
  for (const row of rows) {
    const key = `${row.periodo}|${row.tipo}|${row.eps_codigo}`
    const current = byKey.get(key)
    if (current) {
      current.valor = Math.round((current.valor + row.valor) * 100) / 100
      if (!current.eps_nombre && row.eps_nombre) current.eps_nombre = row.eps_nombre
    } else byKey.set(key, { ...row })
  }
  return Array.from(byKey.values()).sort(
    (a, b) => a.periodo.localeCompare(b.periodo) || a.tipo.localeCompare(b.tipo) || a.eps_codigo.localeCompare(b.eps_codigo)
  )
}

/**
 * ¿Cuadra la suma de las filas con el total general del reporte? (tolerancia de medio peso)
 * @param {GirosParseResult} result
 * @returns {{ ok: boolean, sum: number, reportTotal: number | null, diff: number }}
 */
export function checkReportTotal(result) {
  const sum = Math.round(result.rows.reduce((acc, row) => acc + row.valor, 0) * 100) / 100
  if (result.reportTotal === null) return { ok: true, sum, reportTotal: null, diff: 0 }
  const diff = Math.round((sum - result.reportTotal) * 100) / 100
  return { ok: Math.abs(diff) < 0.5, sum, reportTotal: result.reportTotal, diff }
}

// ---------------------------------------------------------------------------
// Fechas y rangos de meses
// ---------------------------------------------------------------------------

/** @param {number} year @param {number} month 1-12 */
export function lastDayOfMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/**
 * Rango por defecto del script: 24 meses completos que terminan el último día del mes pasado.
 * Con hoy = 2026-10-11 → { desde: '2024-10-01', hasta: '2026-09-30' }.
 * @param {Date} [today]
 * @param {number} [months]
 */
export function defaultRange(today = new Date(), months = 24) {
  let year = today.getFullYear()
  let month = today.getMonth() // 0-11: el mes pasado en base 1
  if (month === 0) {
    year -= 1
    month = 12
  }
  const hasta = `${year}-${pad2(month)}-${pad2(lastDayOfMonth(year, month))}`
  const startIndex = year * 12 + (month - 1) - (months - 1)
  const desde = `${Math.floor(startIndex / 12)}-${pad2((startIndex % 12) + 1)}-01`
  return { desde, hasta }
}

/**
 * Argumento de fecha → 'YYYY-MM-DD'. Acepta 'YYYY-MM' (primer o último día según end),
 * 'YYYY-MM-DD' y 'dd/mm/aaaa'. null si no es válida.
 * @param {string} raw
 * @param {boolean} end
 * @returns {string | null}
 */
export function parseDateArg(raw, end) {
  const s = String(raw ?? '').trim()
  let y, m, d
  let match = s.match(/^(\d{4})-(\d{1,2})$/)
  if (match) {
    y = Number(match[1])
    m = Number(match[2])
    d = end ? lastDayOfMonth(y, m) : 1
  } else if ((match = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) {
    y = Number(match[1])
    m = Number(match[2])
    d = Number(match[3])
  } else if ((match = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) {
    d = Number(match[1])
    m = Number(match[2])
    y = Number(match[3])
  } else return null
  if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1 || d > lastDayOfMonth(y, m)) return null
  return `${y}-${pad2(m)}-${pad2(d)}`
}

/** 'YYYY-MM-DD' → 'dd/mm/aaaa' (formato de los parámetros del reporte). @param {string} iso */
export function toAdresDate(iso) {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

/**
 * Meses 'YYYY-MM' entre dos fechas (inclusive). Vacío si desde > hasta.
 * @param {string} desde 'YYYY-MM' o 'YYYY-MM-DD'
 * @param {string} hasta 'YYYY-MM' o 'YYYY-MM-DD'
 * @returns {string[]}
 */
export function monthsBetween(desde, hasta) {
  const a = String(desde).slice(0, 7).split('-').map(Number)
  const b = String(hasta).slice(0, 7).split('-').map(Number)
  if (a.length !== 2 || b.length !== 2 || a.some(Number.isNaN) || b.some(Number.isNaN)) return []
  const out = []
  for (let i = a[0] * 12 + a[1] - 1, end = b[0] * 12 + b[1] - 1; i <= end && out.length < 600; i++) {
    out.push(`${Math.floor(i / 12)}-${pad2((i % 12) + 1)}`)
  }
  return out
}

/** 'YYYY-MM' → 'ene-2025'. @param {string} ym */
export function monthLabel(ym) {
  const [y, m] = String(ym).split('-').map(Number)
  return m >= 1 && m <= 12 ? `${MESES_CORTOS[m - 1]}-${y}` : String(ym)
}

// ---------------------------------------------------------------------------
// Página ASP.NET del reporte (para el script)
// ---------------------------------------------------------------------------

/** @param {string} value */
function decodeHtmlAttr(value) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

/**
 * Campos <input> que un navegador enviaría con el formulario (sin botones, imágenes ni casillas).
 * @param {string} html
 * @returns {Array<[string, string]>}
 */
export function extractFormFields(html) {
  /** @type {Array<[string, string]>} */
  const fields = []
  for (const match of String(html ?? '').matchAll(/<input\b[^>]*>/gi)) {
    const tag = match[0]
    const name = tag.match(/\bname="([^"]*)"/i)?.[1]
    if (!name) continue
    const type = (tag.match(/\btype="([^"]*)"/i)?.[1] || 'text').toLowerCase()
    if (type === 'image' || type === 'submit' || type === 'button' || type === 'checkbox' || type === 'radio') continue
    fields.push([decodeHtmlAttr(name), decodeHtmlAttr(tag.match(/\bvalue="([^"]*)"/i)?.[1] || '')])
  }
  return fields
}

/**
 * URL base de exportación del ReportViewer (se le añade el formato: CSV, XML…).
 * @param {string} html
 * @returns {string | null}
 */
export function extractExportUrlBase(html) {
  const raw = String(html ?? '').match(/"ExportUrlBase":"([^"]+)"/)?.[1]
  if (!raw) return null
  return raw.replace(/\\u0026/g, '&').replace(/\\\//g, '/')
}

/** ¿Es la página de bloqueo del firewall de la ADRES? @param {string} html */
export function isBlockedPage(html) {
  return /has been blocked|Web Page Blocked/i.test(String(html ?? '').slice(0, 60000))
}
