/**
 * Fase 4 · Población: lectura pura de las tres fuentes (sin red ni base de datos).
 *
 *   - MinSalud "Cifras de aseguramiento": ZIP mensual → "CIFRAS <MES>-<AÑO>.xlsx" → hoja
 *     CoberturaMunicipio (fila 1 = título "CIFRAS AGOSTO-2026", fila 2 = encabezados, última =
 *     "Total general"). Desde feb-2026 trae IdDepartamento/IdMunicipio; antes, solo nombres.
 *   - DANE, proyecciones municipales por área (una fila por municipio, año y área: "Cabecera
 *     Municipal", "Centros Poblados y Rural Disperso", "Total").
 *   - BDUA (datos.gov.co): consulta SoQL agregada; esta parte arma la URL, el corte y la agregación.
 *
 * Estructura real de los archivos: docs/fases/fase4-poblacion.md. Lo usan los scripts
 * minsalud-cifras-load.ts, dane-proyecciones-load.ts y bdua-load.ts, y las pruebas poblacion-check.ts.
 */
import * as XLSX from 'xlsx'
import { MUNICIPIO_CODE_RE, normalizeMunicipioName, type MunicipioResolver } from './municipio-alias'

// ---------------------------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------------------------

/** Tope para un archivo descomprimido (un XLSX de MinSalud pesa ≈ 1,3 MB; el del DANE ≈ 4 MB). */
export const MAX_XLSX_BYTES = 50 * 1024 * 1024

const MESES: Record<string, number> = {
  ENERO: 1, ENE: 1,
  FEBRERO: 2, FEB: 2,
  MARZO: 3, MAR: 3,
  ABRIL: 4, ABR: 4,
  MAYO: 5, MAY: 5,
  JUNIO: 6, JUN: 6,
  JULIO: 7, JUL: 7,
  AGOSTO: 8, AGO: 8,
  SEPTIEMBRE: 9, SETIEMBRE: 9, SEPT: 9, SEP: 9, SET: 9,
  OCTUBRE: 10, OCT: 10,
  NOVIEMBRE: 11, NOV: 11,
  DICIEMBRE: 12, DIC: 12,
}

const pad2 = (n: number) => String(n).padStart(2, '0')

export function lastDayOfMonth(year: number, month: number): string {
  const day = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return `${year}-${pad2(month)}-${pad2(day)}`
}

/**
 * Corte (último día del mes) a partir del título de la hoja o del nombre del archivo:
 * "CIFRAS AGOSTO-2026" → 2026-08-31; "cifras-afiliacion-salud-abr-2026.zip" → 2026-04-30;
 * "cifras-afiliacion-mayo2026.zip" → 2026-05-31. Sin mes y año reconocibles → null.
 */
export function parseCifrasCorte(text: string | null | undefined): string | null {
  const normalized = normalizeMunicipioName(text).replace(/([A-Z])(\d)/g, '$1 $2')
  const tokens = normalized.split(' ')
  for (let i = 0; i < tokens.length - 1; i++) {
    const month = MESES[tokens[i]]
    const year = Number(tokens[i + 1])
    if (month && /^\d{4}$/.test(tokens[i + 1]) && year >= 2000 && year <= 2100) return lastDayOfMonth(year, month)
  }
  return null
}

/** Entero ≥ 0 desde una celda (número o texto "1.234" / "1234"); vacío → null; inválido → NaN. */
export function toCount(value: unknown): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') return Number.isFinite(value) ? Math.round(value) : NaN
  const text = String(value).trim()
  if (text === '' || text === '-') return null
  const digits = text.replace(/[.\s]/g, '')
  return /^\d+$/.test(digits) ? Number(digits) : NaN
}

function toRatio(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = typeof value === 'number' ? value : Number(String(value).replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

const cellText = (value: unknown) => (value === null || value === undefined ? '' : String(value).trim())

/** Lee un libro XLSX desde bytes con opciones seguras (sin fórmulas ni HTML). */
export function readWorkbook(bytes: Uint8Array): XLSX.WorkBook {
  if (bytes.byteLength > MAX_XLSX_BYTES) throw new Error(`Archivo demasiado grande (${bytes.byteLength} bytes)`)
  return XLSX.read(bytes, { type: 'buffer', cellFormula: false, cellHTML: false, cellStyles: false })
}

export function sheetRows(sheet: XLSX.WorkSheet): unknown[][] {
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: null, blankrows: false })
}

/** Extrae el (único) .xlsx de un ZIP de MinSalud. Ignora __MACOSX. */
interface CfbContainer {
  FullPaths: string[]
  FileIndex: { type: number; content?: unknown }[]
}

export function extractXlsxFromZip(zipBytes: Uint8Array): { name: string; bytes: Uint8Array } {
  // xlsx 0.20.3 declara CFB como any; esta es la forma que usamos (ZIP leído por el CFB de SheetJS).
  const container = XLSX.CFB.read(zipBytes, { type: 'buffer' }) as CfbContainer
  const candidates: { name: string; bytes: Uint8Array }[] = []
  container.FullPaths.forEach((fullPath: string, i: number) => {
    const entry = container.FileIndex[i]
    if (!entry || entry.type !== 2 || !/\.xlsx$/i.test(fullPath) || /__MACOSX|\/\._/.test(fullPath)) return
    const content = entry.content as unknown
    if (!content) return
    const bytes = content instanceof Uint8Array ? content : Uint8Array.from(content as ArrayLike<number>)
    candidates.push({ name: fullPath.replace(/^Root Entry\//, ''), bytes })
  })
  if (candidates.length !== 1) throw new Error(`El ZIP debe traer exactamente un .xlsx (trae ${candidates.length})`)
  if (candidates[0].bytes.byteLength > MAX_XLSX_BYTES) throw new Error('El .xlsx del ZIP es demasiado grande')
  return candidates[0]
}

// ---------------------------------------------------------------------------------------------
// MinSalud: hoja CoberturaMunicipio
// ---------------------------------------------------------------------------------------------

export type CifrasField =
  | 'idDepartamento'
  | 'departamento'
  | 'idMunicipio'
  | 'municipio'
  | 'contributivo'
  | 'subsidiado'
  | 'excepcion'
  | 'afiliados'
  | 'poblacion'
  | 'cobertura'

/** Encabezado normalizado → campo. Solo los nombres vistos en los 14 archivos (jul-2025 a ago-2026). */
const CIFRAS_HEADERS: Record<string, CifrasField> = {
  IDDEPARTAMENTO: 'idDepartamento',
  DEPARTAMENTO: 'departamento',
  IDMUNICIPIO: 'idMunicipio',
  MUNICIPIO: 'municipio',
  CONTRIBUTIVO: 'contributivo',
  SUBSIDIADO: 'subsidiado',
  'EXCEPCION ESPECIALES': 'excepcion',
  'EXCEPCION Y ESPECIALES': 'excepcion',
  AFILIADOS: 'afiliados',
  POBLACION: 'poblacion',
  COBERTURA: 'cobertura',
}

export interface CifraMunicipioRow {
  departmentCode: string | null
  departamento: string
  municipalityCode: string | null
  municipio: string
  contributivo: number | null
  subsidiado: number | null
  excepcion: number | null
  afiliados: number
  poblacion: number | null
  cobertura: number | null
}

export interface CifrasTotals {
  contributivo: number | null
  subsidiado: number | null
  excepcion: number | null
  afiliados: number | null
  poblacion: number | null
}

export interface CifrasSheet {
  title: string | null
  corte: string | null
  hasCodes: boolean
  columns: Partial<Record<CifrasField, number>>
  rows: CifraMunicipioRow[]
  total: CifrasTotals | null
  /** Filas sin afiliados ni población (p. ej. "CAUCA-SM" vacía en jul/ago-2026). */
  skippedEmpty: number
  errors: string[]
}

/** Busca la fila de encabezados (la que tiene Municipio y Afiliados) y mapea columnas por nombre. */
export function findCifrasHeader(rows: unknown[][]): { index: number; columns: Partial<Record<CifrasField, number>> } | null {
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const columns: Partial<Record<CifrasField, number>> = {}
    ;(rows[i] ?? []).forEach((cell, j) => {
      const field = CIFRAS_HEADERS[normalizeMunicipioName(cellText(cell))]
      if (field && columns[field] === undefined) columns[field] = j
    })
    if (columns.municipio !== undefined && columns.afiliados !== undefined && columns.departamento !== undefined) {
      return { index: i, columns }
    }
  }
  return null
}

export function parseCifrasSheet(rows: unknown[][]): CifrasSheet {
  const title = cellText(rows[0]?.[0]) || null
  const header = findCifrasHeader(rows)
  const result: CifrasSheet = {
    title,
    corte: parseCifrasCorte(title),
    hasCodes: false,
    columns: header?.columns ?? {},
    rows: [],
    total: null,
    skippedEmpty: 0,
    errors: [],
  }
  if (!header) {
    result.errors.push('No se encontró la fila de encabezados (Departamento, Municipio, Afiliados)')
    return result
  }
  const c = header.columns
  result.hasCodes = c.idMunicipio !== undefined
  const get = (row: unknown[], field: CifrasField) => (c[field] === undefined ? null : row[c[field] as number])

  for (let i = header.index + 1; i < rows.length; i++) {
    const row = rows[i] ?? []
    const first = cellText(row[0])
    const departamento = cellText(get(row, 'departamento'))
    const municipio = cellText(get(row, 'municipio'))
    const values = {
      contributivo: toCount(get(row, 'contributivo')),
      subsidiado: toCount(get(row, 'subsidiado')),
      excepcion: toCount(get(row, 'excepcion')),
      afiliados: toCount(get(row, 'afiliados')),
      poblacion: toCount(get(row, 'poblacion')),
    }
    if (/^TOTAL/.test(normalizeMunicipioName(first))) {
      result.total = values
      continue
    }
    if (!departamento && !municipio) continue
    const bad = Object.entries(values).filter(([, v]) => Number.isNaN(v))
    if (bad.length > 0) {
      result.errors.push(`Fila ${i + 1} (${departamento} / ${municipio}): valor no numérico en ${bad.map(([k]) => k).join(', ')}`)
      continue
    }
    if (values.afiliados === null && values.poblacion === null && values.contributivo === null && values.subsidiado === null && values.excepcion === null) {
      result.skippedEmpty++
      continue
    }
    const rawCode = cellText(get(row, 'idMunicipio'))
    const rawDept = cellText(get(row, 'idDepartamento'))
    const municipalityCode = rawCode ? rawCode.padStart(5, '0') : null
    if (municipalityCode !== null && !MUNICIPIO_CODE_RE.test(municipalityCode)) {
      result.errors.push(`Fila ${i + 1}: IdMunicipio inválido "${rawCode}"`)
      continue
    }
    const afiliados = values.afiliados ?? (values.contributivo ?? 0) + (values.subsidiado ?? 0) + (values.excepcion ?? 0)
    result.rows.push({
      departmentCode: rawDept ? rawDept.padStart(2, '0') : municipalityCode ? municipalityCode.slice(0, 2) : null,
      departamento,
      municipalityCode,
      municipio,
      contributivo: values.contributivo,
      subsidiado: values.subsidiado,
      excepcion: values.excepcion,
      afiliados,
      poblacion: values.poblacion,
      cobertura: toRatio(get(row, 'cobertura')),
    })
  }
  return result
}

/** Abre un XLSX de MinSalud y lee la hoja CoberturaMunicipio. */
export function readCifrasWorkbook(bytes: Uint8Array): CifrasSheet {
  const wb = readWorkbook(bytes)
  const name = wb.SheetNames.find(n => normalizeMunicipioName(n) === 'COBERTURAMUNICIPIO')
  if (!name) throw new Error(`El libro no tiene la hoja CoberturaMunicipio (hojas: ${wb.SheetNames.join(', ')})`)
  return parseCifrasSheet(sheetRows(wb.Sheets[name]))
}

export type CifrasSumInput = Pick<CifraMunicipioRow, 'afiliados'> & Partial<Pick<CifraMunicipioRow, 'contributivo' | 'subsidiado' | 'excepcion' | 'poblacion'>>

export function sumCifras(rows: CifrasSumInput[]): { [K in keyof CifrasTotals]: number } {
  const total = { contributivo: 0, subsidiado: 0, excepcion: 0, afiliados: 0, poblacion: 0 }
  for (const r of rows) {
    total.contributivo += r.contributivo ?? 0
    total.subsidiado += r.subsidiado ?? 0
    total.excepcion += r.excepcion ?? 0
    total.afiliados += r.afiliados
    total.poblacion += r.poblacion ?? 0
  }
  return total
}

/** Clave para aprender nombre → código de los archivos que sí traen IdMunicipio. */
export const cifrasNameKey = (departamento: string, municipio: string) =>
  `${normalizeMunicipioName(departamento)}|${normalizeMunicipioName(municipio)}`

// ---------------------------------------------------------------------------------------------
// DANE: proyecciones municipales por área
// ---------------------------------------------------------------------------------------------

export interface DaneProyeccion {
  municipality_code: string
  anio: number
  total: number
  cabecera: number | null
  resto: number | null
}

export interface DaneSheet {
  rows: DaneProyeccion[]
  names: Map<string, string>
  errors: string[]
  years: number[]
}

/** Columnas: DP, DPNOM, MPIO, DPMP, AÑO, ÁREA GEOGRÁFICA, Población|TOTAL (2020-2035 y 2018-2042). */
export function findDaneHeader(rows: unknown[][]): { index: number; mpio: number; nombre: number; anio: number; area: number; valor: number } | null {
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const cells = (rows[i] ?? []).map(c => normalizeMunicipioName(cellText(c)))
    const mpio = cells.indexOf('MPIO')
    const anio = cells.indexOf('ANO')
    const area = cells.indexOf('AREA GEOGRAFICA')
    const nombre = cells.indexOf('DPMP')
    let valor = cells.indexOf('POBLACION')
    if (valor < 0) valor = cells.indexOf('TOTAL')
    if (mpio >= 0 && anio >= 0 && area >= 0 && valor >= 0) return { index: i, mpio, nombre, anio, area, valor }
  }
  return null
}

export function parseDaneSheet(rows: unknown[][], range: { desde: number; hasta: number }): DaneSheet {
  const out: DaneSheet = { rows: [], names: new Map(), errors: [], years: [] }
  const h = findDaneHeader(rows)
  if (!h) {
    out.errors.push('No se encontró el encabezado del DANE (MPIO, AÑO, ÁREA GEOGRÁFICA, Población)')
    return out
  }
  const acc = new Map<string, { code: string; anio: number; total?: number; cabecera?: number; resto?: number }>()
  const years = new Set<number>()
  for (let i = h.index + 1; i < rows.length; i++) {
    const row = rows[i] ?? []
    const code = cellText(row[h.mpio]).padStart(5, '0')
    const anio = Number(row[h.anio])
    if (!MUNICIPIO_CODE_RE.test(code) || !Number.isInteger(anio)) continue // notas al pie, filas vacías
    if (anio < range.desde || anio > range.hasta) continue
    const valor = toCount(row[h.valor])
    if (valor === null || Number.isNaN(valor)) {
      out.errors.push(`Fila ${i + 1}: población inválida para ${code} ${anio}`)
      continue
    }
    const area = normalizeMunicipioName(cellText(row[h.area]))
    const key = `${code}|${anio}`
    const item = acc.get(key) ?? { code, anio }
    if (area.startsWith('TOTAL')) item.total = valor
    else if (area.startsWith('CABECERA')) item.cabecera = valor
    else if (area.startsWith('CENTROS POBLADOS') || area.startsWith('RESTO') || area.startsWith('RURAL')) item.resto = valor
    else {
      out.errors.push(`Fila ${i + 1}: área desconocida "${cellText(row[h.area])}"`)
      continue
    }
    acc.set(key, item)
    years.add(anio)
    if (h.nombre >= 0 && !out.names.has(code)) out.names.set(code, cellText(row[h.nombre]))
  }
  for (const item of Array.from(acc.values())) {
    const cabecera = item.cabecera ?? null
    const resto = item.resto ?? null
    const total = item.total ?? (cabecera !== null && resto !== null ? cabecera + resto : null)
    if (total === null) {
      out.errors.push(`${item.code} ${item.anio}: sin total`)
      continue
    }
    if (cabecera !== null && resto !== null && cabecera + resto !== total) {
      out.errors.push(`${item.code} ${item.anio}: cabecera + resto (${cabecera + resto}) ≠ total (${total})`)
      continue
    }
    out.rows.push({ municipality_code: item.code, anio: item.anio, total, cabecera, resto })
  }
  out.rows.sort((a, b) => (a.municipality_code === b.municipality_code ? a.anio - b.anio : a.municipality_code < b.municipality_code ? -1 : 1))
  out.years = Array.from(years).sort((a, b) => a - b)
  return out
}

/** Abre el XLSX del DANE y lee la hoja que tenga el encabezado de proyecciones. */
export function readDaneWorkbook(bytes: Uint8Array, range: { desde: number; hasta: number }): DaneSheet & { sheet: string } {
  const wb = readWorkbook(bytes)
  for (const name of wb.SheetNames) {
    const rows = sheetRows(wb.Sheets[name])
    if (findDaneHeader(rows)) return { ...parseDaneSheet(rows, range), sheet: name }
  }
  throw new Error(`Ninguna hoja tiene el encabezado de proyecciones (hojas: ${wb.SheetNames.join(', ')})`)
}

/** Diferencia relativa (proyección vs referencia); referencia 0 o ausente → null. */
export function relativeDiff(value: number, reference: number | null | undefined): number | null {
  if (reference === null || reference === undefined || reference <= 0) return null
  return (value - reference) / reference
}

// ---------------------------------------------------------------------------------------------
// BDUA (datos.gov.co, SoQL)
// ---------------------------------------------------------------------------------------------

export const BDUA_DATASETS = {
  'tq4m-hmg2': { regimen: 'contributivo', cantidadNumerica: true },
  'd7a5-cnra': { regimen: 'subsidiado', cantidadNumerica: false }, // cantidad es texto: sum(cantidad::number)
} as const

export type BduaDatasetId = keyof typeof BDUA_DATASETS

export const BDUA_GROUP_COLUMNS = [
  'dpr_nombre',
  'mnc_nombre',
  'tps_rgm_nombre',
  'ent_id',
  'ent_nombre',
  'tps_est_afl_nombre',
  'zns_nombre',
] as const

/** URL SoQL agregada por departamento, municipio, régimen, EPS, estado y zona (paginada con $offset). */
export function buildBduaSoqlUrl(dataset: BduaDatasetId, page: { limit: number; offset: number }, base = 'https://www.datos.gov.co'): string {
  const sum = BDUA_DATASETS[dataset].cantidadNumerica ? 'sum(cantidad)' : 'sum(cantidad::number)'
  const cols = BDUA_GROUP_COLUMNS.join(',')
  const params = new URLSearchParams({
    $select: `${cols},${sum} AS afiliados`,
    $group: cols,
    $order: cols,
    $limit: String(page.limit),
    $offset: String(page.offset),
  })
  return `${base}/resource/${dataset}.json?${params.toString()}`
}

/** URL SoQL del total del dataset (para cuadrar la suma de las páginas). */
export function buildBduaTotalUrl(dataset: BduaDatasetId, base = 'https://www.datos.gov.co'): string {
  const sum = BDUA_DATASETS[dataset].cantidadNumerica ? 'sum(cantidad)' : 'sum(cantidad::number)'
  const params = new URLSearchParams({ $select: `${sum} AS afiliados, count(*) AS filas` })
  return `${base}/resource/${dataset}.json?${params.toString()}`
}

/** Fecha (hora de Colombia, UTC−5 sin horario de verano) de rowsUpdatedAt (segundos Unix). */
export function corteFromRowsUpdatedAt(epochSeconds: number): string {
  if (!Number.isFinite(epochSeconds) || epochSeconds <= 0) throw new Error('rowsUpdatedAt inválido')
  return new Date((epochSeconds - 5 * 3600) * 1000).toISOString().slice(0, 10)
}

export function normalizeRegimen(value: string | null | undefined): 'contributivo' | 'subsidiado' | null {
  const n = normalizeMunicipioName(value)
  if (n === 'CONTRIBUTIVO') return 'contributivo'
  if (n === 'SUBSIDIADO') return 'subsidiado'
  return null
}

export interface BduaSoqlRow {
  dpr_nombre?: string
  mnc_nombre?: string
  tps_rgm_nombre?: string
  ent_id?: string
  ent_nombre?: string
  tps_est_afl_nombre?: string
  zns_nombre?: string
  afiliados?: string | number
}

export interface BduaAfiliadoRow {
  corte: string
  regimen: 'contributivo' | 'subsidiado'
  departamento_bdua: string
  municipio_bdua: string
  department_code: string | null
  municipality_code: string | null
  eps_id: string
  eps_nombre: string | null
  estado: string
  zona: string
  afiliados: number
  fuente: string
}

export interface BduaAggregate {
  rows: BduaAfiliadoRow[]
  total: number
  byRegimen: Record<string, { total: number; activos: number; cruzados: number }>
  cruzados: number
  sinCruce: Map<string, number>
  viaAlias: Map<string, number>
  errors: string[]
}

const SIN_DATO = 'Sin dato'

/**
 * Agrega las filas SoQL por la clave única de bdua_afiliados (corte, régimen, nombres de la fuente,
 * EPS, estado, zona) y resuelve el código DANE. Si una EPS llega con dos nombres, gana el de más
 * afiliados.
 */
export function aggregateBduaRows(input: {
  rows: BduaSoqlRow[]
  corte: string
  fuente: string
  resolver: MunicipioResolver
}): BduaAggregate {
  const out: BduaAggregate = { rows: [], total: 0, byRegimen: {}, cruzados: 0, sinCruce: new Map(), viaAlias: new Map(), errors: [] }
  const acc = new Map<string, BduaAfiliadoRow & { names: Map<string, number> }>()
  const resolved = new Map<string, { dept: string | null; code: string | null; via: string | null }>()

  for (const r of input.rows) {
    const regimen = normalizeRegimen(r.tps_rgm_nombre)
    const n = toCount(r.afiliados)
    if (!regimen) {
      out.errors.push(`Régimen desconocido "${r.tps_rgm_nombre}"`)
      continue
    }
    if (n === null || Number.isNaN(n)) {
      out.errors.push(`Cantidad inválida "${r.afiliados}" (${r.dpr_nombre} / ${r.mnc_nombre})`)
      continue
    }
    const departamento = cellText(r.dpr_nombre) || SIN_DATO
    const municipio = cellText(r.mnc_nombre) || SIN_DATO
    const epsId = cellText(r.ent_id) || SIN_DATO
    const estado = cellText(r.tps_est_afl_nombre) || SIN_DATO
    const zona = cellText(r.zns_nombre) || SIN_DATO
    const placeKey = `${departamento}|${municipio}`
    let place = resolved.get(placeKey)
    if (!place) {
      const dept = input.resolver.departmentCode(departamento)
      const hit = input.resolver.resolveInDepartment(municipio, dept)
      place = { dept, code: hit?.code ?? null, via: hit?.via ?? null }
      resolved.set(placeKey, place)
    }
    const key = [input.corte, regimen, departamento, municipio, epsId, estado, zona].join('\u0001')
    let item = acc.get(key)
    if (!item) {
      item = {
        corte: input.corte,
        regimen,
        departamento_bdua: departamento,
        municipio_bdua: municipio,
        department_code: place.dept,
        municipality_code: place.code,
        eps_id: epsId,
        eps_nombre: null,
        estado,
        zona,
        afiliados: 0,
        fuente: input.fuente,
        names: new Map(),
      }
      acc.set(key, item)
    }
    item.afiliados += n
    const epsNombre = cellText(r.ent_nombre)
    if (epsNombre) item.names.set(epsNombre, (item.names.get(epsNombre) ?? 0) + n)

    out.total += n
    const reg = (out.byRegimen[regimen] ??= { total: 0, activos: 0, cruzados: 0 })
    reg.total += n
    if (normalizeMunicipioName(estado) === 'ACTIVO') reg.activos += n
    if (place.code) {
      out.cruzados += n
      reg.cruzados += n
      if (place.via !== 'nombre') out.viaAlias.set(`${departamento} / ${municipio} → ${place.code}`, (out.viaAlias.get(`${departamento} / ${municipio} → ${place.code}`) ?? 0) + n)
    } else {
      out.sinCruce.set(`${departamento} / ${municipio}`, (out.sinCruce.get(`${departamento} / ${municipio}`) ?? 0) + n)
    }
  }

  for (const item of Array.from(acc.values())) {
    let best: string | null = null
    let bestN = -1
    for (const [name, count] of Array.from(item.names.entries())) {
      if (count > bestN || (count === bestN && best !== null && name < best)) {
        best = name
        bestN = count
      }
    }
    const { names: _names, ...row } = item
    void _names
    out.rows.push({ ...row, eps_nombre: best })
  }
  return out
}
