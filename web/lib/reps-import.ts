// Fase 3 · Importador de servicios habilitados y capacidad instalada del REPS.
//
// Módulo PURO (sin red ni Supabase; solo servidor porque usa 'xlsx'). Lo usan
// app/api/_lib/reps-import-server.ts (preview / apply) y scripts/reps-import-check.ts (pruebas).
//
// Flujo: archivo (XLSX/XLS/CSV/TXT o PDF con texto) → tabla cruda (encabezados + filas de texto)
// → detección tolerante de columnas (tildes, mayúsculas, sinónimos; o mapeo manual) → filas
// normalizadas por sede (código de habilitación de 12 dígitos) → cruce con las IPS de OpMap →
// simulación por IPS (service_flags, quirofanos, reps_beds, servicios nuevos/retirados) y las
// operaciones que aplica la función SQL reps_import_apply. Nunca recalcula asignaciones.
//
// Reglas de clasificación (Res. 3100 de 2019, por NOMBRE del servicio; el código solo se usa si el
// archivo no trae nombre): ver SERVICE_RULES. Quirófanos = capacidad del grupo "salas" cuyo concepto
// contiene "quirófano" o "sala de cirugía". Camas REPS = suma del grupo "camas".

import * as XLSX from 'xlsx'
import {
  CAPACITY_GROUP_LABELS,
  SERVICE_FLAG_KEYS,
  SERVICE_FLAG_LABELS,
  type CapacityGroup,
  type RepsColumnMapping,
  type RepsFieldKey,
  type RepsImportKind,
  type RepsImportMode,
  type RepsInvalidRow,
  type RepsMatchMethod,
  type RepsSimulationItem,
  type ServiceFlagKey,
  type ServiceFlags,
} from './reps-import-fields'

export class RepsImportError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RepsImportError'
  }
}

/** Límite de filas por archivo (protege memoria y tiempo de la función). */
export const REPS_MAX_ROWS = 200000

// =========================================================================================
// 1. Texto
// =========================================================================================

/** Minúsculas, sin tildes ni signos; espacios simples. "Código Habilitación" → "codigo habilitacion". */
export function normalizeText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function collapse(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function digitsOf(value: unknown): string {
  return String(value ?? '').replace(/\D+/g, '')
}

/** Celda de Excel → texto. Los números enteros grandes (códigos) salen sin notación científica. */
export function cellToString(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return ''
    if (Number.isInteger(value)) return value.toFixed(0)
    return String(value)
  }
  if (typeof value === 'boolean') return value ? 'SI' : 'NO'
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? '' : value.toISOString().slice(0, 10)
  return collapse(String(value))
}

/** Bytes de un archivo de texto → string (UTF-8; UTF-16 con BOM; si no es UTF-8 válido, Windows-1252). */
export function decodeTextBuffer(bytes: Uint8Array): string {
  let text: string
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    text = new TextDecoder('utf-16le').decode(bytes.subarray(2))
  } else if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    text = new TextDecoder('utf-16be').decode(bytes.subarray(2))
  } else {
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    } catch {
      text = new TextDecoder('windows-1252').decode(bytes)
    }
  }
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
}

// =========================================================================================
// 2. Archivos → tabla cruda
// =========================================================================================

export interface RawTable {
  headers: string[]
  /** Filas de datos (sin la de encabezados), todas con headers.length celdas. */
  rows: string[][]
  /** Número de fila (1 = primera) de cada fila de datos en el archivo, para los mensajes. */
  rowNumbers: number[]
  /** Fila del archivo donde están los encabezados (1 = primera; 0 = no se reconocieron). */
  headerRow: number
  sheetName: string | null
}

const DELIMITERS = [';', ',', '\t', '|']

function countOutsideQuotes(line: string, delimiter: string): number {
  let count = 0
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') quoted = !quoted
    else if (!quoted && c === delimiter) count++
  }
  return count
}

/** Separador más consistente en las primeras líneas: ; , tabulador o |. */
export function detectDelimiter(text: string): string {
  const lines = text.split(/\r?\n/).filter(line => line.trim() !== '').slice(0, 50)
  let best = ';'
  let bestScore = -1
  let bestMode = 0
  for (const delimiter of DELIMITERS) {
    const counts = lines.map(line => countOutsideQuotes(line, delimiter))
    const freq = new Map<number, number>()
    counts.forEach(c => {
      if (c > 0) freq.set(c, (freq.get(c) || 0) + 1)
    })
    let mode = 0
    let modeLines = 0
    freq.forEach((n, c) => {
      if (n > modeLines || (n === modeLines && c > mode)) {
        mode = c
        modeLines = n
      }
    })
    if (modeLines > bestScore || (modeLines === bestScore && mode > bestMode)) {
      best = delimiter
      bestScore = modeLines
      bestMode = mode
    }
  }
  return best
}

/** CSV/TXT con ; , tabulador o | (detectado), comillas dobles y saltos de línea dentro de comillas. */
export function parseDelimitedText(text: string, delimiter = detectDelimiter(text)): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else quoted = false
      } else field += c
    } else if (c === '"') {
      quoted = true
    } else if (c === delimiter) {
      row.push(field)
      field = ''
    } else if (c === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      if (rows.length > REPS_MAX_ROWS + 50) throw new RepsImportError(`El archivo tiene más de ${REPS_MAX_ROWS} filas: divídelo (por departamento o municipio)`)
    } else if (c !== '\r') {
      field += c
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows.map(r => r.map(cell => collapse(cell)))
}

/** XLSX/XLS (también los .xls que en realidad son HTML): la hoja con más filas útiles. */
export function parseWorkbook(bytes: Uint8Array): { sheetName: string; rows: string[][] } {
  let workbook: XLSX.WorkBook
  try {
    workbook = XLSX.read(bytes, { type: 'array', cellDates: true, cellFormula: false, cellHTML: false, cellStyles: false })
  } catch {
    throw new RepsImportError('No se pudo leer el archivo de Excel (¿está dañado o protegido con contraseña?)')
  }
  let best: { sheetName: string; rows: string[][]; useful: number } | null = null
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    if (!sheet) continue
    const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: '', blankrows: false })
    if (raw.length > REPS_MAX_ROWS + 50) {
      throw new RepsImportError(`La hoja "${sheetName}" tiene más de ${REPS_MAX_ROWS} filas: divide la consulta (por departamento o municipio)`)
    }
    const rows = raw.map(r => (Array.isArray(r) ? r.map(cellToString) : []))
    const useful = rows.filter(r => r.filter(c => c !== '').length >= 2).length
    if (!best || useful > best.useful) best = { sheetName, rows, useful }
  }
  if (!best || best.useful === 0) throw new RepsImportError('El archivo de Excel no tiene datos')
  return { sheetName: best.sheetName, rows: best.rows }
}

// =========================================================================================
// 3. Encabezados y columnas
// =========================================================================================

interface FieldSynonyms {
  exact: string[]
  /** Encabezado que contiene TODAS estas palabras (puntaje menor que exact). */
  contains?: string[][]
  /** Si el encabezado contiene alguna de estas palabras, el campo no aplica. */
  exclude?: string[]
}

// Sinónimos ya normalizados (normalizeText). El orden dentro de exact da prioridad.
const FIELD_SYNONYMS: Record<RepsFieldKey, FieldSynonyms> = {
  repsCode: {
    exact: [
      'codigo habilitacion sede', 'codigohabilitacionsede', 'cod habilitacion sede', 'codigo de habilitacion de la sede',
      'codigo de habilitacion sede', 'codigo habilitacion', 'codigo de habilitacion', 'cod habilitacion',
      'habi codigo habilitacion', 'codigo habilitacion prestador', 'codigo sede', 'codigo prestador', 'codigoprestador',
      'cod prestador',
    ],
    contains: [['habilitacion']],
    exclude: ['fecha', 'distintivo', 'estado', 'nombre'],
  },
  sedeNumber: {
    exact: ['numero sede', 'numero de sede', 'sede numero', 'nro sede', 'no sede', 'n sede', 'num sede', 'sede no', 'sede nro', 'sede'],
  },
  nit: {
    exact: [
      'nit', 'nits nit', 'numero identificacion', 'numeroidentificacion', 'numero de identificacion', 'nro identificacion',
      'no identificacion', 'identificacion', 'nit prestador', 'nit ips', 'numero nit', 'nit sin dv', 'documento',
    ],
    contains: [['nit']],
  },
  prestadorName: {
    exact: [
      'nombre prestador', 'nombreprestador', 'razon social', 'nombre del prestador', 'prestador', 'habi nombre', 'nombre ips',
      'ips', 'nombre razon social', 'razon social prestador',
    ],
    contains: [['prestador', 'nombre'], ['razon', 'social']],
  },
  sedeName: {
    exact: ['nombre sede', 'nombresede', 'sede nombre', 'nombre de la sede', 'nombre sede prestador'],
    contains: [['sede', 'nombre']],
  },
  department: {
    exact: [
      'departamento', 'departamento sede', 'depa nombre', 'departamentodededesc', 'departamentosededesc', 'departamento sede desc',
      'nombre departamento', 'depto', 'dpto',
    ],
    contains: [['departamento']],
    exclude: ['codigo', 'prestador'],
  },
  municipality: {
    exact: [
      'municipio', 'municipio sede', 'muni nombre', 'municipiosededesc', 'municipio sede desc', 'nombre municipio', 'ciudad',
      'municipio nombre',
    ],
    contains: [['municipio']],
    exclude: ['codigo', 'cod', 'dane', 'prestador'],
  },
  municipalityCode: {
    exact: [
      'codigo municipio', 'cod municipio', 'codigo dane', 'dane', 'codigo dane municipio', 'muni codigo', 'municipiosede',
      'municipio sede codigo', 'cod mpio', 'codigo mpio', 'divipola',
    ],
    contains: [['municipio', 'codigo'], ['dane']],
  },
  group: {
    exact: [
      'grupo servicio', 'grupo de servicio', 'grupo servicios', 'grse nombre', 'grupo', 'grupo capacidad', 'grupo de capacidad',
      'coca grupo', 'grupo capacidad instalada', 'nombre grupo', 'grupo nombre',
    ],
    contains: [['grupo']],
    exclude: ['codigo'],
  },
  serviceCode: {
    exact: ['codigo servicio', 'cod servicio', 'serv codigo', 'codigo del servicio', 'servicio codigo', 'codigo serv', 'cod serv'],
    contains: [['servicio', 'codigo'], ['serv', 'codigo']],
  },
  serviceName: {
    exact: ['servicio', 'nombre servicio', 'serv nombre', 'nombre del servicio', 'servicio nombre', 'servicios', 'nombre servicios'],
    contains: [['servicio']],
    exclude: ['codigo', 'cod', 'grupo', 'fecha', 'distintivo', 'modalidad', 'complejidad'],
  },
  complexity: {
    exact: ['complejidad', 'complejidad servicio', 'nivel complejidad', 'complejidad del servicio', 'nivel de complejidad'],
    contains: [['complejidad']],
    exclude: ['baja', 'media', 'alta'],
  },
  modality: {
    exact: ['modalidad', 'modalidades', 'modalidad servicio', 'modalidad de prestacion', 'modalidad prestacion'],
    contains: [['modalidad']],
    exclude: ['intramural', 'extramural', 'telemedicina'],
  },
  concept: {
    exact: ['concepto', 'concepto capacidad', 'coca nombre', 'nombre concepto', 'concepto nombre', 'tipo capacidad', 'capacidad'],
    contains: [['concepto']],
  },
  quantity: {
    exact: ['cantidad', 'num cantidad', 'cantidad capacidad', 'cantidad instalada', 'numero', 'total'],
    contains: [['cantidad']],
  },
}

/** Orden de prioridad al repartir columnas (los más específicos primero). */
const FIELD_ORDER: RepsFieldKey[] = [
  'repsCode', 'sedeNumber', 'serviceCode', 'municipalityCode', 'nit', 'sedeName', 'prestadorName', 'serviceName',
  'group', 'complexity', 'modality', 'concept', 'quantity', 'department', 'municipality',
]

function wordsOf(normalized: string): string[] {
  return normalized.split(' ').filter(Boolean)
}

/** Puntaje de un encabezado para un campo: 3–3,5 exacto (según prioridad), 2 por palabras, 0 no aplica. */
export function scoreHeaderForField(header: string, field: RepsFieldKey): number {
  const normalized = normalizeText(header)
  if (!normalized) return 0
  const syn = FIELD_SYNONYMS[field]
  const words = wordsOf(normalized)
  const exactIndex = syn.exact.indexOf(normalized)
  if (exactIndex >= 0) return 3 + (syn.exact.length - exactIndex) / (2 * syn.exact.length)
  if (syn.exclude && syn.exclude.some(word => words.includes(word))) return 0
  if (syn.contains && syn.contains.some(group => group.every(word => words.includes(word)))) return 2
  return 0
}

// Columnas SI/NO de modalidad o complejidad (formato de datos abiertos y de algunas consultas)
const MODALITY_FLAG_PREFIXES = [
  'intramural', 'extramural', 'ambulatori', 'hospitalari', 'unidad movil', 'domiciliari', 'jornada', 'telemedicina',
  'telexperticia', 'telemonitoreo', 'centro referencia', 'centro de referencia', 'institucion remisora',
  'prestador de referencia', 'prestador referencia', 'prestador remisor', 'otras extramural', 'modalidad intramural',
  'modalidad extramural', 'modalidad telemedicina',
]
const COMPLEXITY_FLAG_RE = /^(complejidad )?(baja|media|alta)( complejidad)?$/

const TRUTHY = new Set(['si', 's', 'x', '1', 'true', 'yes', 'verdadero'])
const BOOLISH = new Set(['si', 's', 'x', '1', 'true', 'yes', 'verdadero', 'no', 'n', '0', 'false', 'falso'])

export function isTruthyCell(value: string): boolean {
  return TRUTHY.has(normalizeText(value))
}

export interface FlagColumn {
  index: number
  header: string
  type: 'modality' | 'complexity'
  /** Texto que se guarda: "INTRAMURAL", "TELEMEDICINA INTERACTIVA", "ALTA"… */
  meaning: string
}

function looksBoolean(rows: string[][], index: number): boolean {
  let nonEmpty = 0
  let boolish = 0
  let truthy = 0
  for (const row of rows.slice(0, 500)) {
    const value = normalizeText(row[index])
    if (!value) continue
    nonEmpty++
    if (BOOLISH.has(value)) boolish++
    if (TRUTHY.has(value)) truthy++
  }
  return nonEmpty > 0 && truthy > 0 && boolish / nonEmpty >= 0.8
}

export function detectFlagColumns(headers: string[], rows: string[][]): FlagColumn[] {
  const flags: FlagColumn[] = []
  headers.forEach((header, index) => {
    const normalized = normalizeText(header)
    if (!normalized) return
    const complexity = COMPLEXITY_FLAG_RE.exec(normalized)
    if (complexity && looksBoolean(rows, index)) {
      flags.push({ index, header, type: 'complexity', meaning: complexity[2].toUpperCase() })
      return
    }
    if (MODALITY_FLAG_PREFIXES.some(prefix => normalized.startsWith(prefix)) && looksBoolean(rows, index)) {
      flags.push({ index, header, type: 'modality', meaning: normalized.replace(/^modalidad /, '').toUpperCase() })
    }
  })
  return flags
}

/** Reparte las columnas entre los campos (cada columna a lo sumo a un campo). */
export function detectColumns(headers: string[], excluded: Set<number> = new Set()): RepsColumnMapping {
  const candidates: { field: RepsFieldKey; index: number; score: number }[] = []
  headers.forEach((header, index) => {
    if (excluded.has(index)) return
    for (const field of FIELD_ORDER) {
      const score = scoreHeaderForField(header, field)
      if (score > 0) candidates.push({ field, index, score })
    }
  })
  candidates.sort((a, b) => b.score - a.score || FIELD_ORDER.indexOf(a.field) - FIELD_ORDER.indexOf(b.field) || a.index - b.index)
  const mapping: RepsColumnMapping = {}
  const used = new Set<number>()
  for (const candidate of candidates) {
    if (mapping[candidate.field] !== undefined || used.has(candidate.index)) continue
    mapping[candidate.field] = candidate.index
    used.add(candidate.index)
  }
  return mapping
}

/** Número de campos distintos reconocidos en una fila (para encontrar la fila de encabezados). */
export function headerRowScore(cells: string[]): number {
  const fields = new Set<RepsFieldKey>()
  for (const cell of cells) {
    for (const field of FIELD_ORDER) {
      if (scoreHeaderForField(cell, field) >= 2) fields.add(field)
    }
  }
  return fields.size
}

/**
 * Tabla a partir de filas crudas: busca la fila de encabezados en las primeras 40 (los exportes
 * del REPS suelen traer título y fecha arriba); si no reconoce ninguna, usa la primera fila.
 */
export function buildRawTable(allRows: string[][], sheetName: string | null = null): { table: RawTable; headerDetected: boolean } {
  const rows = allRows.map(r => r.map(c => (c ?? '').toString()))
  let headerIndex = -1
  let bestScore = 1
  for (let i = 0; i < Math.min(rows.length, 40); i++) {
    const score = headerRowScore(rows[i])
    if (score > bestScore) {
      bestScore = score
      headerIndex = i
    }
  }
  const headerDetected = headerIndex >= 0
  if (!headerDetected) headerIndex = rows.findIndex(r => r.some(c => c.trim() !== ''))
  if (headerIndex < 0) throw new RepsImportError('El archivo está vacío')

  const headerCells = rows[headerIndex]
  let width = headerCells.length
  for (let i = headerIndex + 1; i < rows.length; i++) width = Math.max(width, rows[i].length)
  const headers = Array.from({ length: width }, (_, i) => collapse(headerCells[i] || '') || `Columna ${i + 1}`)
  const headerKey = headers.map(h => normalizeText(h)).join('|')

  const dataRows: string[][] = []
  const rowNumbers: number[] = []
  for (let i = headerIndex + 1; i < rows.length; i++) {
    const cells = Array.from({ length: width }, (_, j) => collapse(rows[i][j] || ''))
    if (cells.every(c => c === '')) continue
    // Encabezado repetido (exportes por páginas)
    if (cells.map(c => normalizeText(c)).join('|') === headerKey) continue
    dataRows.push(cells)
    rowNumbers.push(i + 1)
  }
  if (dataRows.length > REPS_MAX_ROWS) {
    throw new RepsImportError(`El archivo tiene ${dataRows.length} filas (máximo ${REPS_MAX_ROWS}): divídelo por departamento o municipio`)
  }
  return {
    table: { headers, rows: dataRows, rowNumbers, headerRow: headerDetected ? headerIndex + 1 : 0, sheetName },
    headerDetected,
  }
}

/** Tipo de archivo según las columnas: capacidad (concepto + cantidad) o servicios. */
export function detectKind(mapping: RepsColumnMapping): RepsImportKind | null {
  const has = (field: RepsFieldKey) => mapping[field] !== undefined && mapping[field] !== null
  const capacity = has('concept') && has('quantity')
  const services = has('serviceName') || has('serviceCode')
  if (capacity && !services) return 'capacidad'
  if (services && !capacity) return 'servicios'
  return null
}

/** Valida un mapeo manual: índices enteros dentro de la tabla; el resto se descarta. */
export function sanitizeMapping(input: unknown, width: number): RepsColumnMapping | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null
  const mapping: RepsColumnMapping = {}
  const keys = Object.keys(FIELD_SYNONYMS) as RepsFieldKey[]
  for (const key of keys) {
    const value = (input as Record<string, unknown>)[key]
    if (value === null) mapping[key] = null
    else if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < width) mapping[key] = value
  }
  return mapping
}

// =========================================================================================
// 4. Normalización de filas
// =========================================================================================

/**
 * Código de habilitación de la sede (12 dígitos) a partir del código y el número de sede.
 * Excel suele quitar el 0 inicial (Antioquia = 05…): 11 dígitos → 12, 9 → 10.
 * Devuelve 10 dígitos si solo hay código de prestador sin número de sede.
 */
export function resolveRepsCode(codeRaw: unknown, sedeRaw?: unknown): string | null {
  const code = digitsOf(codeRaw)
  const sede = digitsOf(sedeRaw)
  if (code.length === 12) return code
  if (code.length === 11) return `0${code}`
  if (code.length === 9 || code.length === 10) {
    const prestador = code.padStart(10, '0')
    if (sede.length >= 1 && sede.length <= 3) return prestador + sede.slice(-2).padStart(2, '0')
    if (sede.length === 11 || sede.length === 12) return sede.padStart(12, '0')
    return prestador
  }
  if (sede.length === 11 || sede.length === 12) return sede.padStart(12, '0')
  return null
}

/**
 * NIT sin dígito de verificación. "890.102.768-1" → "890102768". Sin guion y con 10 dígitos se toma
 * como NIT + DV (misma regla que hospitals.nit / lib/reps-match.ts).
 */
export function normalizeNit(raw: unknown): string | null {
  const text = String(raw ?? '').trim()
  if (!text) return null
  const hasDash = text.includes('-')
  const digits = digitsOf(hasDash ? text.split('-')[0] : text)
  if (digits.length < 5 || digits.length > 15) return null
  if (!hasDash && digits.length === 10) return digits.slice(0, 9)
  return digits
}

/** Código de servicio: "207", 207, "207.0" → "207"; alfanuméricos en mayúsculas. */
export function normalizeServiceCode(raw: unknown): string {
  const text = collapse(String(raw ?? ''))
  if (/^\d+([.,]0+)?$/.test(text)) return String(parseInt(text, 10))
  return text.toUpperCase().replace(/[^A-Z0-9.-]+/g, '').slice(0, 80)
}

/** Cantidad entera ≥ 0: "12", " 12 ", "12,0", "1.500" (miles) → número; otra cosa → null. */
export function parseQuantity(raw: unknown): number | null {
  const text = String(raw ?? '').replace(/\s+/g, '')
  if (!text) return null
  if (/^\d+$/.test(text)) return parseInt(text, 10)
  if (/^\d+[.,]0+$/.test(text)) return parseInt(text, 10)
  if (/^\d{1,3}([.,]\d{3})+$/.test(text)) return parseInt(text.replace(/[.,]/g, ''), 10)
  return null
}

export interface SedeInfo {
  key: string
  repsCode: string | null
  nit: string | null
  sedeName: string | null
  prestadorName: string | null
  municipalityCode: string | null
  municipalityName: string | null
  departmentName: string | null
  rows: number
}

export interface ServiceRecord {
  key: string
  code: string
  name: string | null
  group: string | null
  complexity: string | null
  modality: string
}

export interface CapacityRecord {
  key: string
  group: CapacityGroup
  concept: string
  quantity: number
}

export interface NormalizedImport {
  kind: RepsImportKind
  sedes: Record<string, SedeInfo>
  services: ServiceRecord[]
  capacity: CapacityRecord[]
  /** Grupos presentes en el archivo (normalizados); null = el archivo no trae grupo (servicios). */
  groups: string[] | null
  invalid: RepsInvalidRow[]
  invalidCount: number
  rowsRead: number
  validRows: number
  warnings: string[]
}

function cellAt(row: string[], mapping: RepsColumnMapping, field: RepsFieldKey): string {
  const index = mapping[field]
  if (index === undefined || index === null) return ''
  return collapse(row[index] || '')
}

function textOrNull(value: string, max = 300): string | null {
  const text = collapse(value)
  return text ? text.slice(0, max) : null
}

/** Clave de la sede de una fila: código de habilitación o "NIT-<nit>" (o null si no hay ninguno). */
function sedeKeyOf(row: string[], mapping: RepsColumnMapping): { key: string | null; repsCode: string | null; nit: string | null } {
  const repsCode = resolveRepsCode(cellAt(row, mapping, 'repsCode'), cellAt(row, mapping, 'sedeNumber'))
  const nit = normalizeNit(cellAt(row, mapping, 'nit'))
  if (repsCode) return { key: repsCode, repsCode, nit }
  if (nit) return { key: `NIT-${nit}`, repsCode: null, nit }
  return { key: null, repsCode: null, nit: null }
}

function municipalityOf(row: string[], mapping: RepsColumnMapping): { code: string | null; name: string | null } {
  const codeCell = digitsOf(cellAt(row, mapping, 'municipalityCode'))
  const nameCell = cellAt(row, mapping, 'municipality')
  let code: string | null = codeCell.length >= 4 && codeCell.length <= 5 ? codeCell.padStart(5, '0') : null
  let name: string | null = null
  if (nameCell) {
    const digits = digitsOf(nameCell)
    if (/^\d{4,5}$/.test(nameCell.trim()) && !code) code = digits.padStart(5, '0')
    else if (!/^\d+$/.test(nameCell.trim())) name = nameCell.slice(0, 120)
  }
  return { code, name }
}

const MAX_INVALID_SAMPLES = 200

function newNormalized(kind: RepsImportKind, rowsRead: number): NormalizedImport {
  return { kind, sedes: {}, services: [], capacity: [], groups: null, invalid: [], invalidCount: 0, rowsRead, validRows: 0, warnings: [] }
}

function addInvalid(result: NormalizedImport, row: number, reason: string) {
  result.invalidCount++
  if (result.invalid.length < MAX_INVALID_SAMPLES) result.invalid.push({ row, reason })
}

function touchSede(result: NormalizedImport, row: string[], mapping: RepsColumnMapping, ref: { key: string; repsCode: string | null; nit: string | null }) {
  let sede = result.sedes[ref.key]
  if (!sede) {
    const municipality = municipalityOf(row, mapping)
    sede = {
      key: ref.key,
      repsCode: ref.repsCode,
      nit: ref.nit,
      sedeName: textOrNull(cellAt(row, mapping, 'sedeName')),
      prestadorName: textOrNull(cellAt(row, mapping, 'prestadorName')),
      municipalityCode: municipality.code,
      municipalityName: municipality.name,
      departmentName: textOrNull(cellAt(row, mapping, 'department'), 120),
      rows: 0,
    }
    result.sedes[ref.key] = sede
  } else if (!sede.nit && ref.nit) {
    sede.nit = ref.nit
  }
  sede.rows++
}

function complexityText(value: string): string | null {
  const normalized = normalizeText(value)
  if (!normalized) return null
  const levels = ['baja', 'media', 'alta'].filter(level => normalized.split(' ').includes(level))
  if (levels.length > 0) return levels.map(l => l.toUpperCase()).join(', ')
  return collapse(value).toUpperCase().slice(0, 60)
}

/** Filas de servicios habilitados → registros por sede (una fila por servicio y modalidad). */
export function normalizeServiceRows(table: RawTable, mapping: RepsColumnMapping, flagColumns: FlagColumn[] = []): NormalizedImport {
  const result = newNormalized('servicios', table.rows.length)
  const modalityFlags = flagColumns.filter(f => f.type === 'modality')
  const complexityFlags = flagColumns.filter(f => f.type === 'complexity')
  const hasGroup = mapping.group !== undefined && mapping.group !== null
  const groups = new Set<string>()
  const seen = new Set<string>()
  let prestadorOnly = 0

  table.rows.forEach((row, i) => {
    const rowNumber = table.rowNumbers[i] ?? i + 1
    const ref = sedeKeyOf(row, mapping)
    if (!ref.key) {
      addInvalid(result, rowNumber, 'Sin código de habilitación ni NIT')
      return
    }
    let code = normalizeServiceCode(cellAt(row, mapping, 'serviceCode'))
    let name = textOrNull(cellAt(row, mapping, 'serviceName'))
    if (!code && name) {
      // "207 - CIRUGÍA ORTOPÉDICA" en una sola columna
      const combined = /^(\d{3,4})\s*[-:]\s*(.+)$/.exec(name)
      if (combined) {
        code = combined[1]
        name = combined[2]
      } else {
        code = `N-${normalizeText(name).replace(/ /g, '-')}`.slice(0, 80)
      }
    }
    if (!code) {
      addInvalid(result, rowNumber, 'Sin código ni nombre de servicio')
      return
    }
    if (ref.repsCode && ref.repsCode.length === 10) prestadorOnly++

    const group = hasGroup ? textOrNull(cellAt(row, mapping, 'group'), 120) : null
    if (hasGroup) groups.add(normalizeText(group || ''))

    let complexity = complexityText(cellAt(row, mapping, 'complexity'))
    if (!complexity && complexityFlags.length > 0) {
      const levels = complexityFlags.filter(f => isTruthyCell(row[f.index] || '')).map(f => f.meaning)
      complexity = levels.length > 0 ? levels.join(', ') : null
    }

    let modalities: string[]
    const modalityCell = cellAt(row, mapping, 'modality')
    if (modalityCell) modalities = [collapse(modalityCell).toUpperCase().slice(0, 120)]
    else if (modalityFlags.length > 0) {
      modalities = modalityFlags.filter(f => isTruthyCell(row[f.index] || '')).map(f => f.meaning)
      if (modalities.length === 0) modalities = ['']
    } else modalities = ['']

    touchSede(result, row, mapping, { key: ref.key, repsCode: ref.repsCode, nit: ref.nit })
    for (const modality of modalities) {
      const dedupe = `${ref.key}|${code}|${modality}`
      if (seen.has(dedupe)) continue
      seen.add(dedupe)
      result.services.push({ key: ref.key, code, name, group, complexity, modality })
    }
    result.validRows++
  })

  result.groups = hasGroup ? Array.from(groups).filter(Boolean).sort() : null
  if (prestadorOnly > 0) {
    result.warnings.push(`${prestadorOnly} filas traen solo el código del prestador (10 dígitos) sin número de sede: se intenta resolver la sede con el REPS`)
  }
  return result
}

/** Grupo de capacidad (camas | salas | ambulancias | otros) a partir del grupo del archivo o del concepto. */
export function capacityGroupOf(groupLabel: string | null, concept: string): CapacityGroup {
  const group = normalizeText(groupLabel)
  if (group) {
    if (/\bcama|\bcuna/.test(group)) return 'camas'
    if (/\bsala/.test(group)) return 'salas'
    if (/ambulanc|transporte/.test(group)) return 'ambulancias'
    return 'otros'
  }
  const c = normalizeText(concept)
  if (/quirofano|\bsala/.test(c)) return 'salas'
  if (/ambulanc|medicalizad|transporte asistencial/.test(c) || c === 'basica') return 'ambulancias'
  if (/\bcama|\bcuna|incubadora|cuidado|neonatal|adulto|pediatri|obstetri|salud mental|hospitalizacion|psiquiatri/.test(c)) return 'camas'
  return 'otros'
}

/** ¿El concepto de capacidad es un quirófano? ("Quirófano", "Salas de cirugía"…; no partos ni procedimientos). */
export function isOperatingRoom(concept: string): boolean {
  const c = normalizeText(concept)
  return /quirofano/.test(c) || /\bsalas? (de )?cirugia/.test(c)
}

/** Filas de capacidad instalada → registros por sede, sumando cantidades por (sede, grupo, concepto). */
export function normalizeCapacityRows(table: RawTable, mapping: RepsColumnMapping): NormalizedImport {
  const result = newNormalized('capacidad', table.rows.length)
  const aggregated = new Map<string, CapacityRecord>()
  const groups = new Set<string>()

  table.rows.forEach((row, i) => {
    const rowNumber = table.rowNumbers[i] ?? i + 1
    const ref = sedeKeyOf(row, mapping)
    if (!ref.key) {
      addInvalid(result, rowNumber, 'Sin código de habilitación ni NIT')
      return
    }
    const conceptRaw = cellAt(row, mapping, 'concept')
    if (!conceptRaw) {
      addInvalid(result, rowNumber, 'Sin concepto de capacidad')
      return
    }
    const quantityRaw = cellAt(row, mapping, 'quantity')
    const quantity = parseQuantity(quantityRaw)
    if (quantity === null) {
      addInvalid(result, rowNumber, `Cantidad no válida: "${quantityRaw.slice(0, 30)}"`)
      return
    }
    const groupLabel = textOrNull(cellAt(row, mapping, 'group'), 120)
    const group = capacityGroupOf(groupLabel, conceptRaw)
    // En "otros" se conserva el grupo original del REPS dentro del concepto ("SILLAS: Hemodiálisis")
    const concept = (group === 'otros' && groupLabel ? `${groupLabel}: ${collapse(conceptRaw)}` : collapse(conceptRaw)).slice(0, 300)
    groups.add(group)
    touchSede(result, row, mapping, { key: ref.key, repsCode: ref.repsCode, nit: ref.nit })
    const aggKey = `${ref.key}|${group}|${normalizeText(concept)}`
    const existing = aggregated.get(aggKey)
    if (existing) existing.quantity += quantity
    else aggregated.set(aggKey, { key: ref.key, group, concept, quantity })
    result.validRows++
  })

  result.capacity = Array.from(aggregated.values())
  result.groups = Array.from(groups).sort()
  return result
}

/** Cambia claves de sede (p. ej. un código de prestador de 10 dígitos con una única sede → su código de 12). */
export function remapSedeKeys(data: NormalizedImport, remap: Map<string, string>): NormalizedImport {
  if (remap.size === 0) return data
  const sedes: Record<string, SedeInfo> = {}
  Object.values(data.sedes).forEach(sede => {
    const key = remap.get(sede.key) ?? sede.key
    const current = sedes[key]
    if (current) current.rows += sede.rows
    else sedes[key] = { ...sede, key, repsCode: /^\d{12}$/.test(key) ? key : sede.repsCode }
  })
  const seenServices = new Set<string>()
  const services: ServiceRecord[] = []
  data.services.forEach(s => {
    const key = remap.get(s.key) ?? s.key
    const dedupe = `${key}|${s.code}|${s.modality}`
    if (seenServices.has(dedupe)) return
    seenServices.add(dedupe)
    services.push({ ...s, key })
  })
  const capacityMap = new Map<string, CapacityRecord>()
  data.capacity.forEach(c => {
    const key = remap.get(c.key) ?? c.key
    const aggKey = `${key}|${c.group}|${normalizeText(c.concept)}`
    const existing = capacityMap.get(aggKey)
    if (existing) existing.quantity += c.quantity
    else capacityMap.set(aggKey, { ...c, key })
  })
  return { ...data, sedes, services, capacity: Array.from(capacityMap.values()) }
}

// =========================================================================================
// 5. Clasificación de servicios y capacidad
// =========================================================================================

interface ServiceRule {
  flag: ServiceFlagKey
  name: RegExp
  /** Códigos de la Res. 3100/2019; solo se usan si la fila no trae nombre de servicio. */
  codes: string[]
}

// Sobre normalizeText(nombre): sin tildes, minúsculas, "y/o" → "y o".
export const SERVICE_RULES: ServiceRule[] = [
  { flag: 'cirugia_ortopedica', name: /\bcirugia (de )?ortoped/, codes: ['207'] },
  { flag: 'ortopedia', name: /\bortoped|\btraumatolog/, codes: ['207', '339'] },
  { flag: 'trauma', name: /\btraumatolog|\btrauma\b|\bpolitrauma/, codes: ['339'] },
  { flag: 'neurocirugia', name: /\bneurocirug|\bcirugia (de )?neurolog|\bcirugia del sistema nervioso/, codes: ['206', '387'] },
  { flag: 'columna', name: /\bcolumna\b|\braquis|\bvertebr/, codes: [] },
  { flag: 'medicina_deportiva', name: /\bdeport/, codes: [] },
  { flag: 'cirugia_mano', name: /\bcirugia (de )?(la )?mano\b/, codes: [] },
  { flag: 'urgencias', name: /\burgencia/, codes: [] },
  { flag: 'uci_adultos', name: /\bcuidado intensivo adult|\buci adult/, codes: [] },
]

/** Banderas prioritarias de un servicio (por nombre; por código solo si no hay nombre). */
export function classifyService(code: string | null, name: string | null): ServiceFlagKey[] {
  const normalized = normalizeText(name)
  const flags: ServiceFlagKey[] = []
  for (const rule of SERVICE_RULES) {
    const byName = normalized ? rule.name.test(normalized) : false
    const byCode = !normalized && code ? rule.codes.includes(code) : false
    if (byName || byCode) flags.push(rule.flag)
  }
  return flags
}

/** service_flags completas (todas las claves, true/false) a partir de los servicios de la sede. */
export function computeServiceFlags(services: { code: string | null; name: string | null }[]): Record<ServiceFlagKey, boolean> {
  const flags = {} as Record<ServiceFlagKey, boolean>
  SERVICE_FLAG_KEYS.forEach(key => {
    flags[key] = false
  })
  services.forEach(service => {
    classifyService(service.code, service.name).forEach(flag => {
      flags[flag] = true
    })
  })
  return flags
}

export function computeCapacityTotals(rows: { group: string; concept: string; quantity: number }[]): { quirofanos: number; beds: number } {
  let quirofanos = 0
  let beds = 0
  rows.forEach(row => {
    if (row.group === 'salas' && isOperatingRoom(row.concept)) quirofanos += row.quantity
    if (row.group === 'camas') beds += row.quantity
  })
  return { quirofanos, beds }
}

function flagsEqual(a: ServiceFlags | null | undefined, b: ServiceFlags | null | undefined): boolean {
  const left = a || {}
  const right = b || {}
  return SERVICE_FLAG_KEYS.every(key => Boolean(left[key]) === Boolean(right[key]))
}

/** "+ Neurocirugía", "− Ortopedia y/o traumatología" entre dos juegos de banderas. */
export function describeFlagChanges(before: ServiceFlags | null | undefined, after: ServiceFlags | null | undefined): string[] {
  const left = before || {}
  const right = after || {}
  const changes: string[] = []
  SERVICE_FLAG_KEYS.forEach(key => {
    if (!left[key] && right[key]) changes.push(`+ ${SERVICE_FLAG_LABELS[key]}`)
    if (left[key] && !right[key]) changes.push(`− ${SERVICE_FLAG_LABELS[key]}`)
  })
  return changes
}

// =========================================================================================
// 6. Cruce sede → IPS de OpMap
// =========================================================================================

export interface HospitalForImport {
  id: string
  name: string
  code: string
  active: boolean
  municipality_id: string | null
  municipality_name: string | null
  /** 9 dígitos (hospitals.nit de la Fase 3 o derivado de code). */
  nit: string | null
  /** Sede del REPS vinculada (hospitals.reps_code, 12 dígitos), si existe. */
  reps_code: string | null
  service_flags: ServiceFlags | null
  reps_services_count: number | null
  quirofanos: number | null
  reps_beds: number | null
}

/** Sede de la tabla reps_sedes (copia mensual del REPS). */
export interface RepsSedeRef {
  code: string
  prestador: string
  nit: string
  municipio: string
  nombreSede: string | null
}

export interface MatchContext {
  hospitals: HospitalForImport[]
  /** reps_sedes por código de habilitación (12). */
  repsSedesByCode: Map<string, RepsSedeRef>
  /** reps_sedes por NIT (todas las sedes del NIT). */
  repsSedesByNit: Map<string, RepsSedeRef[]>
  /** Sede ya enlazada a una IPS en una importación anterior (hospital_services/capacity.hospital_id). */
  previousLinks: Map<string, string>
}

export interface MatchResult {
  status: 'matched' | 'ambiguous' | 'unmatched'
  method: RepsMatchMethod | null
  hospitalId: string | null
  reason: string | null
}

const METHOD_STRENGTH: Record<RepsMatchMethod, number> = { reps_code: 4, importacion_previa: 3, nit_municipio: 2, nit: 1 }

/** NIT de 9 dígitos de hospitals.code (misma regla que hospitals.nit). */
export function nitFromHospitalCode(code: string | null | undefined): string | null {
  if (typeof code !== 'string') return null
  const match = /^(\d{9})(?:-\d{1,2}|\d)$/.exec(code.trim())
  return match ? match[1] : null
}

function sameMunicipality(hospital: HospitalForImport, code: string | null, name: string | null): boolean | null {
  if (code && hospital.municipality_id) return hospital.municipality_id === code
  if (name && hospital.municipality_name) {
    const a = normalizeText(name)
    const b = normalizeText(hospital.municipality_name)
    if (!a || !b) return null
    return a === b || a.startsWith(b) || b.startsWith(a)
  }
  return null
}

/**
 * Cruza cada sede del archivo con una IPS de OpMap:
 *  1. hospitals.reps_code = código de la sede → 'reps_code'.
 *  2. La sede ya se enlazó en una importación anterior → 'importacion_previa'.
 *  3. Por NIT (del archivo o de reps_sedes) entre las IPS sin reps_code:
 *     - el NIT tiene UNA sede en el REPS (o en el archivo si reps_sedes no la conoce) y UNA IPS → 'nit';
 *     - varias sedes: si esta es la única sede del NIT en el municipio de la IPS → 'nit_municipio';
 *     - si no → ambigua ("vincula la sede en la ficha de la IPS").
 *  Una IPS solo puede quedar con una sede: si varias la piden gana el método más fuerte; con empate,
 *  todas quedan ambiguas.
 */
export function matchSedes(sedes: SedeInfo[], ctx: MatchContext): Map<string, MatchResult> {
  const byRepsCode = new Map<string, HospitalForImport>()
  const byNit = new Map<string, HospitalForImport[]>()
  const byId = new Map<string, HospitalForImport>()
  ctx.hospitals.forEach(h => {
    byId.set(h.id, h)
    if (h.reps_code) byRepsCode.set(h.reps_code, h)
    const nit = h.nit || nitFromHospitalCode(h.code)
    if (nit) {
      const list = byNit.get(nit) || []
      list.push(h)
      byNit.set(nit, list)
    }
  })
  // Sedes del archivo por NIT (respaldo cuando reps_sedes no conoce el NIT)
  const fileSedesByNit = new Map<string, SedeInfo[]>()
  sedes.forEach(s => {
    const nit = s.nit || (s.repsCode ? ctx.repsSedesByCode.get(s.repsCode)?.nit : null) || null
    if (!nit) return
    const list = fileSedesByNit.get(nit) || []
    list.push(s)
    fileSedesByNit.set(nit, list)
  })

  const results = new Map<string, MatchResult>()
  for (const sede of sedes) {
    const code12 = sede.repsCode && sede.repsCode.length === 12 ? sede.repsCode : null
    const ref = code12 ? ctx.repsSedesByCode.get(code12) : undefined

    // 1. Vínculo de la Fase 3 (hospitals.reps_code)
    const linked = code12 ? byRepsCode.get(code12) : undefined
    if (linked) {
      results.set(sede.key, { status: 'matched', method: 'reps_code', hospitalId: linked.id, reason: null })
      continue
    }
    // 2. Importación anterior
    const previous = ctx.previousLinks.get(sede.key)
    if (previous && byId.has(previous)) {
      results.set(sede.key, { status: 'matched', method: 'importacion_previa', hospitalId: previous, reason: null })
      continue
    }
    // 3. NIT
    const nit = sede.nit || ref?.nit || null
    if (!nit) {
      results.set(sede.key, { status: 'unmatched', method: null, hospitalId: null, reason: 'Sin NIT y la sede no está vinculada a ninguna IPS' })
      continue
    }
    const withNit = byNit.get(nit) || []
    const free = withNit.filter(h => !h.reps_code)
    if (withNit.length === 0) {
      results.set(sede.key, { status: 'unmatched', method: null, hospitalId: null, reason: 'El NIT no está en OpMap' })
      continue
    }
    if (free.length === 0) {
      results.set(sede.key, { status: 'unmatched', method: null, hospitalId: null, reason: 'Las IPS con ese NIT ya están vinculadas a otra sede' })
      continue
    }
    const sedeMunicipio = sede.municipalityCode || ref?.municipio || null
    const repsNitSedes = ctx.repsSedesByNit.get(nit) || []
    const nitSedeCount = repsNitSedes.length > 0 ? repsNitSedes.length : (fileSedesByNit.get(nit) || []).length

    if (nitSedeCount <= 1) {
      if (free.length === 1) {
        const agree = sameMunicipality(free[0], sedeMunicipio, sede.municipalityName)
        results.set(sede.key, {
          status: 'matched',
          method: 'nit',
          hospitalId: free[0].id,
          reason: agree === false ? 'Única sede del NIT, pero en otro municipio que la IPS' : null,
        })
      } else {
        results.set(sede.key, { status: 'ambiguous', method: null, hospitalId: null, reason: `Hay ${free.length} IPS con ese NIT en OpMap: vincula la sede en la ficha de la IPS` })
      }
      continue
    }

    // Varias sedes: ¿es esta la única sede del NIT en el municipio de alguna IPS?
    const candidates = free.filter(h => {
      if (!h.municipality_id) return false
      const inMunicipality = repsNitSedes.length > 0
        ? repsNitSedes.filter(s => s.municipio === h.municipality_id)
        : (fileSedesByNit.get(nit) || []).filter(s => sameMunicipality(h, s.municipalityCode, s.municipalityName) === true)
      if (inMunicipality.length !== 1) return false
      const only = inMunicipality[0]
      const onlyKey = 'code' in only ? (only as RepsSedeRef).code : (only as SedeInfo).key
      return onlyKey === sede.key || onlyKey === code12
    })
    if (candidates.length === 1) {
      results.set(sede.key, { status: 'matched', method: 'nit_municipio', hospitalId: candidates[0].id, reason: null })
    } else {
      const inMunicipio = sedeMunicipio ? repsNitSedes.filter(s => s.municipio === sedeMunicipio).length : 0
      results.set(sede.key, {
        status: 'ambiguous',
        method: null,
        hospitalId: null,
        reason: `El NIT tiene ${nitSedeCount} sedes${sedeMunicipio ? ` (${inMunicipio} en el municipio de esta sede)` : ''}: vincula la sede en la ficha de la IPS y vuelve a importar`,
      })
    }
  }

  // Una IPS = una sede
  const claims = new Map<string, string[]>()
  results.forEach((result, key) => {
    if (result.status !== 'matched' || !result.hospitalId) return
    const list = claims.get(result.hospitalId) || []
    list.push(key)
    claims.set(result.hospitalId, list)
  })
  claims.forEach((keys, hospitalId) => {
    if (keys.length < 2) return
    const strength = (key: string) => METHOD_STRENGTH[results.get(key)!.method as RepsMatchMethod] || 0
    const best = Math.max(...keys.map(strength))
    const winners = keys.filter(key => strength(key) === best)
    keys.forEach(key => {
      if (winners.length === 1 && key === winners[0]) return
      results.set(key, {
        status: 'ambiguous',
        method: null,
        hospitalId: null,
        reason: `Varias sedes del archivo apuntan a la misma IPS (${byId.get(hospitalId)?.name ?? hospitalId})`,
      })
    })
  })
  return results
}

// =========================================================================================
// 7. Simulación y operaciones
// =========================================================================================

export interface ExistingServiceRow {
  id: string
  reps_code: string
  hospital_id: string | null
  service_code: string
  service_name: string | null
  group_name: string | null
  modality: string
}

export interface ExistingCapacityRow {
  id: string
  reps_code: string
  hospital_id: string | null
  group_name: string
  concept: string
  quantity: number
}

export interface HospitalUpdateOp {
  id: string
  set_services: boolean
  service_flags: Record<string, boolean> | null
  reps_services_count: number | null
  set_quirofanos: boolean
  quirofanos: number | null
  set_beds: boolean
  reps_beds: number | null
}

export interface ApplyPayload {
  services_upsert: { reps_code: string; hospital_id: string | null; service_code: string; service_name: string | null; group_name: string | null; complexity: string | null; modality: string }[]
  services_delete: string[]
  capacity_upsert: { reps_code: string; hospital_id: string | null; group_name: string; concept: string; quantity: number }[]
  capacity_delete: string[]
  link_hospital: { reps_code: string; hospital_id: string }[]
  hospital_updates: HospitalUpdateOp[]
  history: { hospital_id: string; changes: Record<string, unknown> }[]
}

export interface ImportPlan {
  items: RepsSimulationItem[]
  payload: ApplyPayload
  stats: {
    sedes: number
    matched: number
    ambiguous: number
    unmatched: number
    hospitalsWithChanges: number
  }
}

export interface PlanInput {
  data: NormalizedImport
  matches: Map<string, MatchResult>
  hospitals: HospitalForImport[]
  existingServices?: ExistingServiceRow[]
  existingCapacity?: ExistingCapacityRow[]
  mode: RepsImportMode
  /** Datos de auditoría que van en hospital_history.changes. */
  audit?: { fileName?: string; jobId?: string }
}

const LIST_LIMIT = 25
const HISTORY_LIST_LIMIT = 50

function isRealRepsKey(key: string): boolean {
  return /^(\d{10}|\d{12}|NIT-\d{5,15})$/.test(key)
}

function emptyItem(sede: SedeInfo, match: MatchResult, hospital: HospitalForImport | undefined): RepsSimulationItem {
  return {
    key: sede.key,
    sedeName: sede.sedeName,
    prestadorName: sede.prestadorName,
    nit: sede.nit,
    municipality: sede.municipalityName || sede.municipalityCode,
    status: match.status,
    method: match.method,
    reason: match.reason,
    hospital: hospital ? { id: hospital.id, name: hospital.name, code: hospital.code, active: hospital.active } : null,
    rowsInFile: sede.rows,
    added: [],
    removed: [],
    addedCount: 0,
    removedCount: 0,
    changed: [],
    flagsBefore: null,
    flagsAfter: null,
    servicesBefore: null,
    servicesAfter: null,
    quirofanosBefore: null,
    quirofanosAfter: null,
    bedsBefore: null,
    bedsAfter: null,
    hasChanges: false,
  }
}

function sortItems(items: RepsSimulationItem[]): RepsSimulationItem[] {
  const rank = (item: RepsSimulationItem) =>
    item.status === 'matched' ? (item.hasChanges ? 0 : 1) : item.status === 'ambiguous' ? 2 : 3
  return items.sort((a, b) => {
    const r = rank(a) - rank(b)
    if (r !== 0) return r
    const nameA = a.hospital?.name || a.sedeName || a.prestadorName || a.key
    const nameB = b.hospital?.name || b.sedeName || b.prestadorName || b.key
    return nameA.localeCompare(nameB, 'es')
  })
}

function groupByKey<T>(rows: T[], keyOf: (row: T) => string | null): Map<string, T[]> {
  const map = new Map<string, T[]>()
  rows.forEach(row => {
    const key = keyOf(row)
    if (!key) return
    const list = map.get(key) || []
    list.push(row)
    map.set(key, list)
  })
  return map
}

function uniqueById<T extends { id: string }>(rows: T[]): T[] {
  const seen = new Set<string>()
  return rows.filter(row => (seen.has(row.id) ? false : (seen.add(row.id), true)))
}

/** Simulación + operaciones de una importación de SERVICIOS habilitados. */
export function planServicesImport(input: PlanInput): ImportPlan {
  const { data, matches, mode } = input
  const hospitalsById = new Map(input.hospitals.map(h => [h.id, h]))
  const existing = input.existingServices || []
  const existingByKey = groupByKey(existing, r => r.reps_code)
  const existingByHospital = groupByKey(existing, r => r.hospital_id)
  const scope = data.groups ? new Set(data.groups) : null
  const inScope = (groupName: string | null) => scope === null || scope.has(normalizeText(groupName || ''))
  const rowKey = (code: string, modality: string) => `${code}|${modality}`

  const fileByKey = groupByKey(data.services, s => s.key)
  const payload: ApplyPayload = { services_upsert: [], services_delete: [], capacity_upsert: [], capacity_delete: [], link_hospital: [], hospital_updates: [], history: [] }
  const deleteIds = new Set<string>()
  const items: RepsSimulationItem[] = []

  Object.values(data.sedes).forEach(sede => {
    if (!isRealRepsKey(sede.key)) return
    const match = matches.get(sede.key) || { status: 'unmatched', method: null, hospitalId: null, reason: 'Sin cruce' }
    const hospital = match.status === 'matched' && match.hospitalId ? hospitalsById.get(match.hospitalId) : undefined
    const item = emptyItem(sede, match as MatchResult, hospital)
    // Solo se guardan las sedes con cruce: las demás se listan en la simulación y no se tocan
    if (!hospital) {
      items.push(item)
      return
    }
    const fileRows = fileByKey.get(sede.key) || []
    const fileKeys = new Set(fileRows.map(r => rowKey(r.code, r.modality)))

    fileRows.forEach(r => {
      payload.services_upsert.push({
        reps_code: sede.key,
        hospital_id: hospital.id,
        service_code: r.code,
        service_name: r.name,
        group_name: r.group,
        complexity: r.complexity,
        modality: r.modality,
      })
    })

    const before = uniqueById([...(existingByKey.get(sede.key) || []), ...(existingByHospital.get(hospital.id) || [])])
    const retired = mode === 'replace'
      ? before.filter(r => inScope(r.group_name) && !(r.reps_code === sede.key && fileKeys.has(rowKey(r.service_code, r.modality))))
      : []
    retired.forEach(r => deleteIds.add(r.id))
    const retiredIds = new Set(retired.map(r => r.id))
    const kept = before.filter(r => !retiredIds.has(r.id))

    const beforeNames = new Map<string, string>()
    before.forEach(r => beforeNames.set(r.service_code, r.service_name || r.service_code))
    const finalNames = new Map<string, string>()
    kept.forEach(r => finalNames.set(r.service_code, r.service_name || r.service_code))
    fileRows.forEach(r => finalNames.set(r.code, r.name || r.code))

    const addedCodes = Array.from(finalNames.keys()).filter(code => !beforeNames.has(code))
    const removedCodes = Array.from(beforeNames.keys()).filter(code => !finalNames.has(code))
    item.addedCount = addedCodes.length
    item.removedCount = removedCodes.length
    item.added = addedCodes.slice(0, LIST_LIMIT).map(code => finalNames.get(code) || code)
    item.removed = removedCodes.slice(0, LIST_LIMIT).map(code => beforeNames.get(code) || code)

    if (hospital) {
      const finalServices = [
        ...kept.map(r => ({ code: r.service_code, name: r.service_name })),
        ...fileRows.map(r => ({ code: r.code, name: r.name })),
      ]
      const flagsAfter = computeServiceFlags(finalServices)
      const countAfter = finalNames.size
      item.flagsBefore = hospital.service_flags && Object.keys(hospital.service_flags).length > 0 ? hospital.service_flags : null
      item.flagsAfter = flagsAfter
      item.servicesBefore = hospital.reps_services_count
      item.servicesAfter = countAfter
      item.hasChanges =
        addedCodes.length > 0 || removedCodes.length > 0 || !flagsEqual(item.flagsBefore, flagsAfter) || hospital.reps_services_count !== countAfter

      payload.link_hospital.push({ reps_code: sede.key, hospital_id: hospital.id })
      payload.hospital_updates.push({
        id: hospital.id,
        set_services: true,
        service_flags: flagsAfter,
        reps_services_count: countAfter,
        set_quirofanos: false,
        quirofanos: null,
        set_beds: false,
        reps_beds: null,
      })
      if (item.hasChanges) {
        payload.history.push({
          hospital_id: hospital.id,
          changes: {
            source: 'reps',
            kind: 'servicios',
            mode,
            reps_code: sede.key,
            match_method: match.method,
            file_name: input.audit?.fileName ?? null,
            job_id: input.audit?.jobId ?? null,
            services_added: addedCodes.slice(0, HISTORY_LIST_LIMIT),
            services_removed: removedCodes.slice(0, HISTORY_LIST_LIMIT),
            services_count: { before: hospital.reps_services_count, after: countAfter },
            service_flags: { before: item.flagsBefore, after: flagsAfter },
          },
        })
      }
    }
    items.push(item)
  })

  payload.services_delete = Array.from(deleteIds)
  return finishPlan(items, payload)
}

function capacityLabel(group: string, concept: string): string {
  const label = CAPACITY_GROUP_LABELS[group as CapacityGroup] || group
  return `${label} · ${concept}`
}

/** Simulación + operaciones de una importación de CAPACIDAD instalada. */
export function planCapacityImport(input: PlanInput): ImportPlan {
  const { data, matches, mode } = input
  const hospitalsById = new Map(input.hospitals.map(h => [h.id, h]))
  const existing = input.existingCapacity || []
  const existingByKey = groupByKey(existing, r => r.reps_code)
  const existingByHospital = groupByKey(existing, r => r.hospital_id)
  const scope = new Set(data.groups || [])
  const capKey = (group: string, concept: string) => `${group}|${normalizeText(concept)}`

  const fileByKey = groupByKey(data.capacity, c => c.key)
  const payload: ApplyPayload = { services_upsert: [], services_delete: [], capacity_upsert: [], capacity_delete: [], link_hospital: [], hospital_updates: [], history: [] }
  const deleteIds = new Set<string>()
  const items: RepsSimulationItem[] = []

  Object.values(data.sedes).forEach(sede => {
    if (!isRealRepsKey(sede.key)) return
    const match = matches.get(sede.key) || { status: 'unmatched', method: null, hospitalId: null, reason: 'Sin cruce' }
    const hospital = match.status === 'matched' && match.hospitalId ? hospitalsById.get(match.hospitalId) : undefined
    const item = emptyItem(sede, match as MatchResult, hospital)
    // Solo se guardan las sedes con cruce: las demás se listan en la simulación y no se tocan
    if (!hospital) {
      items.push(item)
      return
    }
    const fileRows = fileByKey.get(sede.key) || []
    const fileMap = new Map(fileRows.map(r => [capKey(r.group, r.concept), r]))

    fileRows.forEach(r => {
      payload.capacity_upsert.push({ reps_code: sede.key, hospital_id: hospital.id, group_name: r.group, concept: r.concept, quantity: r.quantity })
    })

    const before = uniqueById([...(existingByKey.get(sede.key) || []), ...(existingByHospital.get(hospital.id) || [])])
    const retired = mode === 'replace'
      ? before.filter(r => scope.has(r.group_name) && !(r.reps_code === sede.key && fileMap.has(capKey(r.group_name, r.concept))))
      : []
    retired.forEach(r => deleteIds.add(r.id))
    const retiredIds = new Set(retired.map(r => r.id))
    const kept = before.filter(r => !retiredIds.has(r.id))

    // Comparación por concepto
    const beforeMap = new Map<string, { group: string; concept: string; quantity: number }>()
    before.forEach(r => {
      const key = capKey(r.group_name, r.concept)
      const current = beforeMap.get(key)
      if (current) current.quantity = Math.max(current.quantity, r.quantity)
      else beforeMap.set(key, { group: r.group_name, concept: r.concept, quantity: r.quantity })
    })
    const finalMap = new Map<string, { group: string; concept: string; quantity: number }>()
    kept.forEach(r => {
      const key = capKey(r.group_name, r.concept)
      if (!fileMap.has(key) && !finalMap.has(key)) finalMap.set(key, { group: r.group_name, concept: r.concept, quantity: r.quantity })
    })
    fileRows.forEach(r => finalMap.set(capKey(r.group, r.concept), { group: r.group, concept: r.concept, quantity: r.quantity }))

    const added: string[] = []
    const removed: string[] = []
    const changed: string[] = []
    finalMap.forEach((row, key) => {
      const prev = beforeMap.get(key)
      if (!prev) added.push(`${capacityLabel(row.group, row.concept)}: ${row.quantity}`)
      else if (prev.quantity !== row.quantity) changed.push(`${capacityLabel(row.group, row.concept)}: ${prev.quantity} → ${row.quantity}`)
    })
    beforeMap.forEach((row, key) => {
      if (!finalMap.has(key)) removed.push(`${capacityLabel(row.group, row.concept)}: ${row.quantity}`)
    })
    item.addedCount = added.length
    item.removedCount = removed.length
    item.added = added.slice(0, LIST_LIMIT)
    item.removed = removed.slice(0, LIST_LIMIT)
    item.changed = changed.slice(0, LIST_LIMIT)

    if (hospital) {
      const finalRows = Array.from(finalMap.values())
      const totals = computeCapacityTotals(finalRows)
      const setQuirofanos = scope.has('salas') || finalRows.some(r => r.group === 'salas')
      const setBeds = scope.has('camas') || finalRows.some(r => r.group === 'camas')
      item.quirofanosBefore = hospital.quirofanos
      item.quirofanosAfter = setQuirofanos ? totals.quirofanos : hospital.quirofanos
      item.bedsBefore = hospital.reps_beds
      item.bedsAfter = setBeds ? totals.beds : hospital.reps_beds
      item.hasChanges =
        added.length > 0 ||
        removed.length > 0 ||
        changed.length > 0 ||
        item.quirofanosBefore !== item.quirofanosAfter ||
        item.bedsBefore !== item.bedsAfter

      payload.link_hospital.push({ reps_code: sede.key, hospital_id: hospital.id })
      payload.hospital_updates.push({
        id: hospital.id,
        set_services: false,
        service_flags: null,
        reps_services_count: null,
        set_quirofanos: setQuirofanos,
        quirofanos: setQuirofanos ? totals.quirofanos : null,
        set_beds: setBeds,
        reps_beds: setBeds ? totals.beds : null,
      })
      if (item.hasChanges) {
        payload.history.push({
          hospital_id: hospital.id,
          changes: {
            source: 'reps',
            kind: 'capacidad',
            mode,
            reps_code: sede.key,
            match_method: match.method,
            file_name: input.audit?.fileName ?? null,
            job_id: input.audit?.jobId ?? null,
            capacity_added: added.slice(0, HISTORY_LIST_LIMIT),
            capacity_removed: removed.slice(0, HISTORY_LIST_LIMIT),
            capacity_changed: changed.slice(0, HISTORY_LIST_LIMIT),
            quirofanos: { before: item.quirofanosBefore, after: item.quirofanosAfter },
            reps_beds: { before: item.bedsBefore, after: item.bedsAfter },
          },
        })
      }
    }
    items.push(item)
  })

  payload.capacity_delete = Array.from(deleteIds)
  return finishPlan(items, payload)
}

function finishPlan(items: RepsSimulationItem[], payload: ApplyPayload): ImportPlan {
  sortItems(items)
  return {
    items,
    payload,
    stats: {
      sedes: items.length,
      matched: items.filter(i => i.status === 'matched').length,
      ambiguous: items.filter(i => i.status === 'ambiguous').length,
      unmatched: items.filter(i => i.status === 'unmatched').length,
      hospitalsWithChanges: items.filter(i => i.status === 'matched' && i.hasChanges).length,
    },
  }
}

export function planImport(input: PlanInput): ImportPlan {
  return input.data.kind === 'servicios' ? planServicesImport(input) : planCapacityImport(input)
}

// =========================================================================================
// 8. PDF con texto: reconstrucción de la tabla por coordenadas
// =========================================================================================

export interface PdfTextItem {
  str: string
  /** Esquina inferior izquierda en puntos PDF (y crece hacia arriba). */
  x: number
  y: number
  width: number
  height: number
}

export interface PdfPageItems {
  pageNumber: number
  items: PdfTextItem[]
}

export const PDF_NO_TEXT_ERROR = 'PDF sin texto (escaneado): requiere OCR'
export const PDF_NO_TABLE_WARNING =
  'No se detectaron tablas con encabezados reconocibles en el PDF: se separaron columnas por posición. Revisa el mapeo de columnas.'

interface Segment {
  x0: number
  x1: number
  text: string
}

interface Line {
  page: number
  y: number
  segments: Segment[]
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

function pageLines(page: PdfPageItems): Line[] {
  const items = page.items.filter(item => item.str && item.str.trim() !== '')
  if (items.length === 0) return []
  const fontSize = median(items.map(item => item.height).filter(h => h > 0)) || 10
  const tolerance = Math.max(2, fontSize * 0.5)
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x)
  const lines: { y: number; items: PdfTextItem[] }[] = []
  for (const item of sorted) {
    const current = lines[lines.length - 1]
    if (current && Math.abs(current.y - item.y) <= tolerance) current.items.push(item)
    else lines.push({ y: item.y, items: [item] })
  }
  const gapLimit = fontSize * 0.6
  return lines.map(line => {
    const ordered = line.items.sort((a, b) => a.x - b.x)
    const segments: Segment[] = []
    for (const item of ordered) {
      const x1 = item.x + Math.max(item.width, 0)
      const last = segments[segments.length - 1]
      const gap = last ? item.x - last.x1 : Infinity
      if (last && gap < gapLimit) {
        last.text = gap > fontSize * 0.1 ? `${last.text} ${item.str}` : `${last.text}${item.str}`
        last.x1 = Math.max(last.x1, x1)
      } else {
        segments.push({ x0: item.x, x1, text: item.str })
      }
    }
    segments.forEach(s => {
      s.text = collapse(s.text)
    })
    return { page: page.pageNumber, y: line.y, segments: segments.filter(s => s.text !== '') }
  }).filter(line => line.segments.length > 0)
}

/** Une una línea con la siguiente (encabezados partidos en dos renglones) por solapamiento horizontal. */
function mergeHeaderLines(first: Line, second: Line): Line {
  const segments = first.segments.map(s => ({ ...s }))
  for (const seg of second.segments) {
    let best = -1
    let bestOverlap = 0
    segments.forEach((target, index) => {
      const overlap = Math.min(target.x1, seg.x1) - Math.max(target.x0, seg.x0)
      if (overlap > bestOverlap) {
        bestOverlap = overlap
        best = index
      }
    })
    if (best >= 0) {
      segments[best].text = `${segments[best].text} ${seg.text}`
      segments[best].x0 = Math.min(segments[best].x0, seg.x0)
      segments[best].x1 = Math.max(segments[best].x1, seg.x1)
    } else segments.push({ ...seg })
  }
  segments.sort((a, b) => a.x0 - b.x0)
  return { page: first.page, y: first.y, segments }
}

function lineScore(line: Line): number {
  return headerRowScore(line.segments.map(s => s.text))
}

const PAGE_FOOTER_RE = /^(p(a|á)gina\s*\d+(\s*(de|\/)\s*\d+)?|\d+\s*(de|\/)\s*\d+)$/i

function assignToColumns(line: Line, anchors: Segment[]): string[] {
  const cells = anchors.map(() => '')
  for (const seg of line.segments) {
    const center = (seg.x0 + seg.x1) / 2
    let column = anchors.length - 1
    for (let j = 0; j < anchors.length; j++) {
      const end = j === anchors.length - 1 ? Infinity : (anchors[j].x1 + anchors[j + 1].x0) / 2
      if (center < end) {
        column = j
        break
      }
    }
    cells[column] = cells[column] ? `${cells[column]} ${seg.text}` : seg.text
  }
  return cells
}

/**
 * Páginas de un PDF con texto → tabla. Encuentra la fila de encabezados (también partida en dos
 * renglones), toma sus columnas como anclas y reparte cada renglón por la posición X del centro de
 * cada fragmento. Los renglones sin la columna clave (código/NIT) y con pocas celdas se pegan a la
 * fila anterior (celdas con texto partido). Omite encabezados repetidos y pies de página.
 */
export function pdfPagesToTable(pages: PdfPageItems[]): { table: RawTable; headerDetected: boolean; warnings: string[] } {
  const totalItems = pages.reduce((sum, page) => sum + page.items.filter(i => i.str && i.str.trim() !== '').length, 0)
  if (totalItems === 0) throw new RepsImportError(PDF_NO_TEXT_ERROR)

  const lines = pages.flatMap(pageLines)
  const warnings: string[] = []

  // Fila de encabezados entre los primeros 80 renglones
  let header: Line | null = null
  let headerIndex = -1
  let headerSpan = 1
  let bestScore = 1
  for (let i = 0; i < Math.min(lines.length, 80); i++) {
    const single = lineScore(lines[i])
    if (single > bestScore) {
      bestScore = single
      header = lines[i]
      headerIndex = i
      headerSpan = 1
    }
    const next = lines[i + 1]
    if (next && next.page === lines[i].page) {
      const merged = mergeHeaderLines(lines[i], next)
      const mergedScore = lineScore(merged)
      if (mergedScore > bestScore) {
        bestScore = mergedScore
        header = merged
        headerIndex = i
        headerSpan = 2
      }
    }
  }

  if (!header) {
    warnings.push(PDF_NO_TABLE_WARNING)
    const width = Math.max(...lines.map(l => l.segments.length))
    const rows = lines.map(l => Array.from({ length: width }, (_, j) => l.segments[j]?.text || ''))
    const built = buildRawTable([Array.from({ length: width }, (_, j) => `Columna ${j + 1}`), ...rows])
    return { table: { ...built.table, headerRow: 0 }, headerDetected: false, warnings }
  }

  const anchors = header.segments
  const headers = anchors.map(a => a.text)
  const headerKey = headers.map(h => normalizeText(h)).join('|')
  const mapping = detectColumns(headers)
  const keyColumn = mapping.repsCode ?? mapping.nit ?? 0

  const rows: string[][] = []
  const rowNumbers: number[] = []
  let currentAnchors = anchors
  for (let i = headerIndex + headerSpan; i < lines.length; i++) {
    const line = lines[i]
    if (line.segments.length === 1 && PAGE_FOOTER_RE.test(line.segments[0].text)) continue
    // Encabezado repetido en otra página: se re-ancla con sus posiciones
    const candidates = [line]
    if (lines[i + 1] && lines[i + 1].page === line.page) candidates.push(mergeHeaderLines(line, lines[i + 1]))
    const repeated = candidates.findIndex(c => c.segments.map(s => normalizeText(s.text)).join('|') === headerKey)
    if (repeated >= 0) {
      currentAnchors = candidates[repeated].segments
      if (repeated === 1) i++
      continue
    }
    const cells = assignToColumns(line, currentAnchors)
    const filled = cells.filter(c => c !== '').length
    if (rows.length > 0 && cells[keyColumn] === '' && filled <= Math.max(1, Math.floor(headers.length / 2))) {
      const previous = rows[rows.length - 1]
      cells.forEach((cell, j) => {
        if (cell) previous[j] = previous[j] ? `${previous[j]} ${cell}` : cell
      })
      continue
    }
    rows.push(cells)
    rowNumbers.push(rows.length)
  }
  if (rows.length > REPS_MAX_ROWS) throw new RepsImportError(`El PDF tiene más de ${REPS_MAX_ROWS} filas: divídelo`)
  return {
    table: { headers, rows, rowNumbers, headerRow: 1, sheetName: null },
    headerDetected: true,
    warnings,
  }
}
