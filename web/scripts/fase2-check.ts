/**
 * Fase 2 · Verificación del motor de cobertura (SOLO LECTURA).
 *
 * 1. Pruebas puras de computeZoneMatrix() / computeCoverage() con datos de juguete, incluido el
 *    ejemplo de Barranquilla y Cartagena (una ejecutiva en Cartagena con las líneas 1 y 2, dos en
 *    Barranquilla: una con 1 y 2 y otra con 3 y 4, que llega a Cartagena por alcance).
 * 2. Con los datos reales de Supabase calcula la matriz zona→zona y la cobertura EN MEMORIA y la
 *    compara con la tabla "El equipo actual sobre el mapa" del documento de la Fase 2.
 *
 * Garantía de solo lectura: solo usa loadCoverageInputs() (únicamente SELECT) y las funciones puras.
 * NUNCA llama a recomputeAndSaveCoverage() ni toca la tabla coverage (las columnas nuevas de la
 * migración 0400 pueden no existir todavía).
 *
 * Uso (desde web/): npx tsx scripts/fase2-check.ts
 * Salida: tabla en consola y FASE2_OUTPUT_DIR/fase2-check.md (por defecto, el scratchpad de la sesión).
 * Código de salida 1 si alguna prueba o celda no coincide.
 */
import path from 'path'
import fs from 'fs'
import dotenv from 'dotenv'
import {
  computeCoverage,
  computeZoneMatrix,
  formatHoursMinutes,
  loadCoverageInputs,
  type CoverageComputeInputs,
} from '../lib/coverage'
import type { ComputedCoverage, CoverageExecutiveInput, CoverageZoneInput, ZoneMatrix } from '../lib/types/coverage'

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') })

const OUTPUT_DIR =
  process.env.FASE2_OUTPUT_DIR ||
  '/private/tmp/claude-501/-Users-yjxm-Documents-GitHub-OpMap/b96592bc-25ae-4af0-afb9-263556da1e56/scratchpad'
const OUTPUT_MD = path.join(OUTPUT_DIR, 'fase2-check.md')

const MINUTES_TOLERANCE = 1 // el documento redondea a minutos ("2 h 26")

// ---------------------------------------------------------------------------
// Tabla esperada (documento, sección "El equipo actual sobre el mapa")
// ---------------------------------------------------------------------------

type LineCode = 'perossal' | 'reemplazo' | 'deportiva' | 'columna'
const DOC_LINES: LineCode[] = ['perossal', 'reemplazo', 'deportiva', 'columna']

type Expected =
  | { exec: string; minutes?: number } // cubierta (local o por alcance)
  | { vacant: true; nearest: string | null; minutes?: number } // vacante (y la más cercana, si el doc la da)

const cover = (exec: string, minutes?: number): Expected => ({ exec, minutes })
const vacant = (nearest: string | null, minutes?: number): Expected => ({ vacant: true, nearest, minutes })
const hm = (hours: number, minutes: number) => hours * 60 + minutes

/** Nombre de la tabla → palabras que deben aparecer en executives.full_name (sin tildes). */
const PEOPLE: Record<string, string[]> = {
  Carmen: ['carmen', 'barrios'],
  Alexa: ['alexa', 'ocampo'],
  Mileydis: ['mileydis', 'buelvas'],
  Leyda: ['leyda', 'santiago'],
  'Diana Caicedo': ['diana', 'caicedo'],
  Linda: ['linda', 'barrera'],
  Viviana: ['viviana', 'delgado'],
  'María Isabel Díaz': ['maria', 'isabel', 'diaz'],
  Joana: ['joana', 'galvez'],
  'Diana Guerrero': ['diana', 'guerrero'],
  Paola: ['paola', 'jimenez'],
  'Nueva Barranquilla': ['nueva', 'barranquilla'],
  'Nueva Bogotá': ['nueva', 'bogota'],
}

/** Fila del documento → zonas (por area_id, estable aunque F1 renombre kams.name). */
const EXPECTED: Array<{ label: string; areas: string[]; cells: Record<LineCode, Expected> }> = [
  {
    label: 'Barranquilla',
    areas: ['08001'],
    cells: {
      perossal: cover('Carmen'),
      reemplazo: cover('Carmen'),
      deportiva: cover('Nueva Barranquilla'),
      columna: cover('Nueva Barranquilla'),
    },
  },
  {
    label: 'Cartagena',
    areas: ['13001'],
    cells: {
      perossal: cover('Alexa'),
      reemplazo: cover('Alexa'),
      deportiva: cover('Nueva Barranquilla', hm(2, 26)),
      columna: cover('Nueva Barranquilla', hm(2, 26)),
    },
  },
  {
    label: 'Montería y Sincelejo',
    areas: ['23001'],
    cells: {
      perossal: cover('Mileydis'),
      reemplazo: vacant('Alexa', hm(4, 39)),
      deportiva: cover('Mileydis'),
      columna: cover('Mileydis'),
    },
  },
  {
    label: 'Valledupar',
    areas: ['20001'],
    cells: {
      perossal: cover('Leyda'),
      reemplazo: cover('Leyda'),
      // "Vacante, Barranquilla a 6 h 45": la que lleva estas líneas en Barranquilla es Nueva Barranquilla
      deportiva: vacant('Nueva Barranquilla', hm(6, 45)),
      columna: vacant('Nueva Barranquilla', hm(6, 45)),
    },
  },
  {
    label: 'Bucaramanga',
    areas: ['68001'],
    cells: {
      perossal: vacant('Linda', hm(4, 49)),
      reemplazo: cover('Diana Caicedo'),
      deportiva: cover('Diana Caicedo'),
      columna: cover('Diana Caicedo'),
    },
  },
  {
    label: 'Cúcuta',
    areas: ['54001'],
    cells: {
      perossal: cover('Linda'),
      reemplazo: vacant('Diana Caicedo', hm(4, 52)),
      deportiva: vacant('Diana Caicedo', hm(4, 52)),
      columna: vacant('Diana Caicedo', hm(4, 52)),
    },
  },
  {
    label: 'Medellín',
    areas: ['05001'],
    cells: {
      perossal: cover('Viviana'),
      reemplazo: cover('Viviana'),
      deportiva: vacant('Diana Caicedo', hm(6, 49)),
      columna: vacant('Diana Caicedo', hm(6, 49)),
    },
  },
  {
    label: 'Pereira',
    areas: ['66001'],
    cells: {
      perossal: cover('María Isabel Díaz'),
      reemplazo: vacant('Viviana', hm(4, 30)),
      deportiva: cover('Joana', hm(3, 24)),
      columna: cover('Joana', hm(3, 24)),
    },
  },
  {
    label: 'Ibagué',
    areas: ['73001'],
    cells: {
      perossal: cover('María Isabel Díaz', hm(2, 50)),
      reemplazo: cover('Nueva Bogotá', hm(3, 37)),
      deportiva: cover('Nueva Bogotá', hm(3, 37)),
      columna: cover('Nueva Bogotá', hm(3, 37)),
    },
  },
  {
    label: 'Cali',
    areas: ['76001'],
    cells: {
      perossal: cover('Joana'),
      reemplazo: vacant('Viviana', hm(7, 30)),
      deportiva: cover('Joana'),
      columna: cover('Joana'),
    },
  },
  {
    label: 'Pasto',
    areas: ['52001'],
    cells: {
      perossal: cover('Diana Guerrero'),
      reemplazo: vacant(null), // el documento no da la más cercana: nadie con reemplazo tiene tiempos a Pasto
      deportiva: cover('Diana Guerrero'),
      columna: vacant('Joana', hm(8, 27)),
    },
  },
  {
    label: 'Neiva',
    areas: ['41001'],
    cells: {
      perossal: vacant('Paola', hm(5, 8)),
      reemplazo: vacant('Nueva Bogotá', hm(5, 8)),
      deportiva: vacant('Nueva Bogotá', hm(5, 8)),
      columna: vacant('Nueva Bogotá', hm(5, 8)),
    },
  },
  {
    label: 'Bogotá, las 4 zonas',
    areas: ['1100102', '1100104', '1100108', '1100110'],
    cells: {
      perossal: cover('Paola'),
      reemplazo: cover('Nueva Bogotá'),
      deportiva: cover('Nueva Bogotá'),
      columna: cover('Nueva Bogotá'),
    },
  },
]

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

function mdEscape(text: string): string {
  return text.replace(/\|/g, '\\|')
}

function pad(text: string, width: number): string {
  return text.length >= width ? text : text + ' '.repeat(width - text.length)
}

const withinTolerance = (a: number | null | undefined, b: number) =>
  a !== null && a !== undefined && Math.abs(a - b) <= MINUTES_TOLERANCE

function describeExpected(expected: Expected): string {
  if ('vacant' in expected) {
    if (!expected.nearest) return 'Vacante'
    return `Vacante, ${expected.nearest}${expected.minutes !== undefined ? ` a ${formatHoursMinutes(expected.minutes)}` : ''}`
  }
  return expected.minutes !== undefined ? `${expected.exec}, ${formatHoursMinutes(expected.minutes)}` : expected.exec
}

function shortName(fullName: string | undefined | null): string {
  if (!fullName) return '¿?'
  for (const [label, tokens] of Object.entries(PEOPLE)) {
    const name = normalize(fullName)
    if (tokens.every(token => name.includes(token))) return label
  }
  return fullName
}

function describeComputed(row: ComputedCoverage | undefined, executives: Map<string, CoverageExecutiveInput>): string {
  if (!row) return '(sin fila)'
  const name = (id: string | null) => shortName(id ? executives.get(id)?.full_name : null)
  switch (row.kind) {
    case 'local':
      return `${name(row.executive_id)} (local)`
    case 'reach':
      return `${name(row.executive_id)}, ${formatHoursMinutes(row.travel_minutes ?? 0)}`
    case 'manual':
      return `${name(row.executive_id)} (manual${row.travel_minutes !== null ? `, ${formatHoursMinutes(row.travel_minutes)}` : ''})`
    case 'conflict':
      return `Conflicto: ${row.note ?? ''}`
    case 'vacant':
      return row.nearest_executive_id
        ? `Vacante, ${name(row.nearest_executive_id)} a ${formatHoursMinutes(row.nearest_minutes ?? 0)}`
        : 'Vacante'
  }
}

function matches(
  row: ComputedCoverage | undefined,
  expected: Expected,
  idByLabel: Map<string, string>
): boolean {
  if (!row) return false
  if ('vacant' in expected) {
    if (row.kind !== 'vacant') return false
    if (expected.nearest === null) return row.nearest_executive_id === null
    if (row.nearest_executive_id !== idByLabel.get(expected.nearest)) return false
    return expected.minutes === undefined || withinTolerance(row.nearest_minutes, expected.minutes)
  }
  if (row.kind !== 'local' && row.kind !== 'reach' && row.kind !== 'manual') return false
  if (row.executive_id !== idByLabel.get(expected.exec)) return false
  return expected.minutes === undefined || withinTolerance(row.travel_minutes, expected.minutes)
}

// ---------------------------------------------------------------------------
// 1. Pruebas puras
// ---------------------------------------------------------------------------

interface PureCase {
  name: string
  ok: boolean
  detail: string
}

function runPureTests(): PureCase[] {
  const cases: PureCase[] = []
  const check = (name: string, ok: boolean, detail: string) => cases.push({ name, ok, detail })

  // Matriz: mediana con cantidad par = promedio de los centrales; diagonal 0; destinos por municipio y localidad
  const zones: CoverageZoneInput[] = [
    { id: 'BAQ', name: 'Barranquilla', area_id: '08001', active: true },
    { id: 'CTG', name: 'Cartagena', area_id: '13001', active: true },
    { id: 'CHA', name: 'Bogotá – Chapinero', area_id: '1100102', active: true },
  ]
  const matrix = computeZoneMatrix(
    zones,
    [
      { id: 'h1', municipality_id: '13001', locality_id: null },
      { id: 'h2', municipality_id: '13001', locality_id: null },
      { id: 'h3', municipality_id: '11001', locality_id: '1100102' },
      { id: 'h4', municipality_id: '08001', locality_id: null },
    ],
    [
      { hospital_id: 'h1', kam_id: 'BAQ', travel_time: 140 * 60 },
      { hospital_id: 'h2', kam_id: 'BAQ', travel_time: 152 * 60 },
      { hospital_id: 'h3', kam_id: 'BAQ', travel_time: 600 * 60 },
      { hospital_id: 'h4', kam_id: 'BAQ', travel_time: 15 * 60 },
      { hospital_id: 'h4', kam_id: 'CTG', travel_time: null },
    ]
  )
  check('matriz: mediana par (140, 152) → 146', matrix.BAQ?.CTG === 146, `BAQ→CTG = ${matrix.BAQ?.CTG}`)
  check('matriz: localidad de Bogotá por locality_id', matrix.BAQ?.CHA === 600, `BAQ→CHA = ${matrix.BAQ?.CHA}`)
  check('matriz: diagonal 0 (no la mediana interna)', matrix.BAQ?.BAQ === 0, `BAQ→BAQ = ${matrix.BAQ?.BAQ}`)
  check('matriz: travel_time null se ignora', matrix.CTG?.BAQ === undefined, `CTG→BAQ = ${matrix.CTG?.BAQ}`)

  // Ejemplo del usuario: C en Cartagena (1 y 2), A en Barranquilla (1 y 2), B en Barranquilla (3 y 4)
  const toyMatrix: ZoneMatrix = { BAQ: { BAQ: 0, CTG: 146 }, CTG: { CTG: 0, BAQ: 146 } }
  const lines = [1, 2, 3, 4].map(n => ({ id: `L${n}`, code: `l${n}`, name: `Línea ${n}`, max_reach_minutes: 240, active: true }))
  const baseInputs = (): CoverageComputeInputs => ({
    zones: zones.slice(0, 2),
    lines,
    executives: [
      { id: 'A', full_name: 'A Barranquilla', status: 'active', base_kam_id: 'BAQ' },
      { id: 'B', full_name: 'B Barranquilla', status: 'placeholder', base_kam_id: 'BAQ' },
      { id: 'C', full_name: 'C Cartagena', status: 'active', base_kam_id: 'CTG' },
    ],
    executiveLines: [
      { executive_id: 'A', line_id: 'L1' },
      { executive_id: 'A', line_id: 'L2' },
      { executive_id: 'B', line_id: 'L3' },
      { executive_id: 'B', line_id: 'L4' },
      { executive_id: 'C', line_id: 'L1' },
      { executive_id: 'C', line_id: 'L2' },
    ],
    lineZones: [],
    overrides: [],
  })
  const find = (rows: ComputedCoverage[], line: string, zone: string) =>
    rows.find(row => row.line_id === line && row.kam_id === zone)

  let rows = computeCoverage(baseInputs(), toyMatrix)
  const exampleOk =
    rows.length === 8 &&
    find(rows, 'L1', 'BAQ')?.executive_id === 'A' && find(rows, 'L1', 'BAQ')?.kind === 'local' &&
    find(rows, 'L2', 'BAQ')?.executive_id === 'A' &&
    find(rows, 'L3', 'BAQ')?.executive_id === 'B' && find(rows, 'L3', 'BAQ')?.kind === 'local' &&
    find(rows, 'L4', 'BAQ')?.executive_id === 'B' &&
    find(rows, 'L1', 'CTG')?.executive_id === 'C' && find(rows, 'L1', 'CTG')?.kind === 'local' &&
    find(rows, 'L2', 'CTG')?.executive_id === 'C' &&
    find(rows, 'L3', 'CTG')?.executive_id === 'B' && find(rows, 'L3', 'CTG')?.kind === 'reach' &&
    find(rows, 'L3', 'CTG')?.travel_minutes === 146 && find(rows, 'L3', 'CTG')?.source_kam_id === 'BAQ' &&
    find(rows, 'L4', 'CTG')?.executive_id === 'B' && find(rows, 'L4', 'CTG')?.kind === 'reach'
  check(
    'ejemplo Barranquilla/Cartagena: A local 1-2 en BAQ, B local 3-4 en BAQ, C local 1-2 en CTG, B cubre 3-4 en CTG por alcance (146 min)',
    exampleOk,
    rows.map(row => `${row.line_id}/${row.kam_id}=${row.executive_id ?? '-'}:${row.kind}`).join(' ')
  )

  // Sin nadie en Cartagena con 1 y 2: A cubre Cartagena por alcance; sin tocar nada más
  const noC = baseInputs()
  noC.executives = noC.executives.filter(executive => executive.id !== 'C')
  rows = computeCoverage(noC, toyMatrix)
  check(
    'sin C: A cubre Cartagena en 1 y 2 por alcance',
    find(rows, 'L1', 'CTG')?.executive_id === 'A' && find(rows, 'L1', 'CTG')?.kind === 'reach',
    `L1/CTG = ${find(rows, 'L1', 'CTG')?.executive_id}:${find(rows, 'L1', 'CTG')?.kind}`
  )

  // Conflicto: D también vive en Barranquilla y lleva la 3
  const conflict = baseInputs()
  conflict.executives.push({ id: 'D', full_name: 'D Barranquilla', status: 'active', base_kam_id: 'BAQ' })
  conflict.executiveLines.push({ executive_id: 'D', line_id: 'L3' })
  rows = computeCoverage(conflict, toyMatrix)
  const conflictRow = find(rows, 'L3', 'BAQ')
  const tieRow = find(rows, 'L3', 'CTG')
  check(
    'conflicto: dos locales con la misma línea → conflict sin ejecutiva y nota con los nombres',
    conflictRow?.kind === 'conflict' && conflictRow.executive_id === null && conflictRow.note === 'B Barranquilla, D Barranquilla',
    `L3/BAQ = ${conflictRow?.kind}, note=${conflictRow?.note}`
  )
  check(
    'empate por alcance: se elige por orden alfabético y queda nota',
    tieRow?.kind === 'reach' && tieRow.executive_id === 'B' && Boolean(tieRow.note?.startsWith('Empate')),
    `L3/CTG = ${tieRow?.executive_id}:${tieRow?.kind}, note=${tieRow?.note}`
  )

  // Ajuste manual: A cubre Cartagena en la 1 aunque C viva allí
  const manual = baseInputs()
  manual.overrides.push({ id: 'O1', line_id: 'L1', kam_id: 'CTG', executive_id: 'A', reason: 'Atiende por viaje', active: true })
  rows = computeCoverage(manual, toyMatrix)
  const manualRow = find(rows, 'L1', 'CTG')
  check(
    'ajuste manual gana sobre local, con minutos desde su base y motivo en la nota',
    manualRow?.kind === 'manual' && manualRow.executive_id === 'A' && manualRow.travel_minutes === 146 &&
      manualRow.note === 'Atiende por viaje' && manualRow.override_id === 'O1',
    `L1/CTG = ${manualRow?.executive_id}:${manualRow?.kind} ${manualRow?.travel_minutes} "${manualRow?.note}"`
  )

  // Ajuste a quien no lleva la línea: sin efecto, queda el cálculo con aviso
  const badManual = baseInputs()
  badManual.overrides.push({ id: 'O2', line_id: 'L3', kam_id: 'CTG', executive_id: 'C', reason: 'x', active: true })
  rows = computeCoverage(badManual, toyMatrix)
  const badRow = find(rows, 'L3', 'CTG')
  check(
    'ajuste a quien no lleva la línea queda sin efecto (se mantiene el cálculo y se avisa)',
    badRow?.kind === 'reach' && badRow.executive_id === 'B' && Boolean(badRow.note?.includes('sin efecto')) && badRow.override_id === 'O2',
    `L3/CTG = ${badRow?.executive_id}:${badRow?.kind}, note=${badRow?.note}`
  )

  // Tope de alcance: con 120 min, Cartagena queda vacante en la 3 con la más cercana
  const shortReach = baseInputs()
  shortReach.lines = shortReach.lines.map(line => ({ ...line, max_reach_minutes: 120 }))
  rows = computeCoverage(shortReach, toyMatrix)
  const vacantRow = find(rows, 'L3', 'CTG')
  check(
    'más allá del tope: vacante con la más cercana y sus minutos',
    vacantRow?.kind === 'vacant' && vacantRow.executive_id === null && vacantRow.nearest_executive_id === 'B' && vacantRow.nearest_minutes === 146,
    `L3/CTG = ${vacantRow?.kind}, nearest=${vacantRow?.nearest_executive_id} ${vacantRow?.nearest_minutes}`
  )

  // Inactivas no cuentan; equipos por línea; líneas y zonas inactivas fuera
  const misc = baseInputs()
  misc.executives = misc.executives.map(executive => (executive.id === 'C' ? { ...executive, status: 'inactive' as const } : executive))
  misc.lineZones = [{ line_id: 'L1', kam_id: 'CTG', has_equipment: false }]
  misc.lines = misc.lines.map(line => (line.id === 'L4' ? { ...line, active: false } : line))
  rows = computeCoverage(misc, toyMatrix)
  check(
    'inactiva no cubre; has_equipment de line_zones (true por defecto); línea inactiva sin filas',
    find(rows, 'L1', 'CTG')?.executive_id === 'A' &&
      find(rows, 'L1', 'CTG')?.has_equipment === false &&
      find(rows, 'L2', 'CTG')?.has_equipment === true &&
      !rows.some(row => row.line_id === 'L4') &&
      rows.length === 6,
    `filas=${rows.length}, L1/CTG=${find(rows, 'L1', 'CTG')?.executive_id} equipo=${find(rows, 'L1', 'CTG')?.has_equipment}`
  )

  return cases
}

// ---------------------------------------------------------------------------
// 2. Datos reales
// ---------------------------------------------------------------------------

async function main() {
  console.log('Fase 2 · verificación del motor de cobertura (solo lectura)\n')

  const pure = runPureTests()
  console.log('Pruebas puras:')
  for (const test of pure) console.log(`  ${test.ok ? 'OK ' : 'FALLA'}  ${test.name}${test.ok ? '' : `\n         ${test.detail}`}`)
  const pureOk = pure.filter(test => test.ok).length
  console.log(`  ${pureOk}/${pure.length} correctas\n`)

  const started = Date.now()
  const inputs = await loadCoverageInputs()
  const matrix = computeZoneMatrix(inputs.zones, inputs.hospitals, inputs.distances)
  const coverage = computeCoverage(inputs, matrix)
  console.log(
    `Leídos: ${inputs.zones.length} zonas, ${inputs.hospitals.length} IPS activas, ${inputs.distances.length} distancias, ` +
      `${inputs.lines.length} líneas, ${inputs.executives.length} ejecutivas, ${inputs.executiveLines.length} líneas por ejecutiva, ` +
      `${inputs.lineZones.length} filas de line_zones, ${inputs.overrides.length} ajustes activos (${Date.now() - started} ms)`
  )
  console.log(`Cobertura calculada en memoria: ${coverage.length} filas (líneas activas × zonas activas)\n`)

  const executives = new Map(inputs.executives.map(executive => [executive.id, executive]))
  const zonesById = new Map(inputs.zones.map(zone => [zone.id, zone]))
  const linesByCode = new Map(inputs.lines.map(line => [line.code, line]))

  // Resolver los nombres de la tabla a ids de executives
  const idByLabel = new Map<string, string>()
  const resolutionProblems: string[] = []
  for (const [label, tokens] of Object.entries(PEOPLE)) {
    const found = inputs.executives.filter(executive => {
      const name = normalize(executive.full_name)
      return tokens.every(token => name.includes(token))
    })
    if (found.length === 1) idByLabel.set(label, found[0].id)
    else resolutionProblems.push(`${label}: ${found.length} coincidencias (${found.map(e => e.full_name).join(', ') || 'ninguna'})`)
  }

  // Zonas activas por area_id (sin filas duplicadas)
  const activeZoneByArea = new Map<string, CoverageZoneInput>()
  for (const zone of inputs.zones) if (zone.active) activeZoneByArea.set(zone.area_id, zone)

  const rowFor = (lineId: string, kamId: string) => coverage.find(row => row.line_id === lineId && row.kam_id === kamId)

  interface Cell {
    docRow: string
    zone: string
    line: LineCode
    computed: string
    expected: string
    ok: boolean
  }
  const cells: Cell[] = []
  const missing: string[] = []

  for (const docRow of EXPECTED) {
    for (const area of docRow.areas) {
      const zone = activeZoneByArea.get(area)
      for (const lineCode of DOC_LINES) {
        const expected = docRow.cells[lineCode]
        const line = linesByCode.get(lineCode)
        if (!zone || !line) {
          missing.push(`${docRow.label} (${area}) · ${lineCode}: ${!zone ? 'zona activa no encontrada' : 'línea no encontrada'}`)
          cells.push({ docRow: docRow.label, zone: zone?.name ?? area, line: lineCode, computed: '(sin datos)', expected: describeExpected(expected), ok: false })
          continue
        }
        const row = rowFor(line.id, zone.id)
        cells.push({
          docRow: docRow.label,
          zone: zone.name,
          line: lineCode,
          computed: describeComputed(row, executives),
          expected: describeExpected(expected),
          ok: matches(row, expected, idByLabel),
        })
      }
    }
  }

  const okCells = cells.filter(cell => cell.ok).length
  const lineName = (code: string) => linesByCode.get(code)?.name ?? code

  // Consola: tabla línea × zona
  for (const lineCode of DOC_LINES) {
    console.log(`== ${lineName(lineCode)} ==`)
    console.log(`  ${pad('Zona', 28)} ${pad('Calculado', 36)} ${pad('Esperado (documento)', 36)} ¿Coincide?`)
    for (const cell of cells.filter(item => item.line === lineCode)) {
      console.log(`  ${pad(cell.zone, 28)} ${pad(cell.computed, 36)} ${pad(cell.expected, 36)} ${cell.ok ? 'sí' : 'NO'}`)
    }
    console.log('')
  }

  // Zonas activas que el documento no lista y la línea trauma (no está en el documento)
  const documentedAreas = new Set(EXPECTED.flatMap(row => row.areas))
  const extraZones = inputs.zones.filter(zone => zone.active && !documentedAreas.has(zone.area_id))
  const extraLines = inputs.lines.filter(line => line.active && !DOC_LINES.includes(line.code as LineCode))

  console.log(`Coincidencias con el documento: ${okCells}/${cells.length}`)
  if (resolutionProblems.length > 0) console.log(`Nombres sin resolver: ${resolutionProblems.join('; ')}`)
  if (missing.length > 0) console.log(`Celdas sin datos: ${missing.join('; ')}`)
  if (extraZones.length > 0) console.log(`Zonas activas fuera del documento: ${extraZones.map(zone => zone.name).join(', ')}`)

  // Matriz de las zonas base de las ejecutivas hacia las zonas activas
  const activeZones = inputs.zones.filter(zone => zone.active).sort((a, b) => a.name.localeCompare(b.name, 'es'))
  const baseZoneIds = Array.from(
    new Set(
      inputs.executives
        .filter(executive => executive.status !== 'inactive' && executive.base_kam_id)
        .map(executive => executive.base_kam_id as string)
    )
  ).sort((a, b) => (zonesById.get(a)?.name ?? a).localeCompare(zonesById.get(b)?.name ?? b, 'es'))

  // ---------------------------------------------------------------------------
  // Informe Markdown
  // ---------------------------------------------------------------------------
  const md: string[] = []
  md.push('# Fase 2 · Verificación del motor de cobertura')
  md.push('')
  md.push(`Generado: ${new Date().toISOString()} · Solo lectura (no se escribe en coverage).`)
  md.push('')
  md.push('## Resumen')
  md.push('')
  md.push(`- Pruebas puras (ejemplo Barranquilla/Cartagena, conflicto, empate, ajuste manual, tope, equipos): **${pureOk}/${pure.length}** correctas.`)
  md.push(`- Tabla "El equipo actual sobre el mapa": **${okCells}/${cells.length}** celdas coinciden (4 líneas × ${cells.length / 4} zonas; Bogotá cuenta como sus 4 zonas).`)
  md.push(
    `- Datos leídos: ${inputs.zones.length} zonas (${activeZones.length} activas), ${inputs.hospitals.length} IPS activas, ` +
      `${inputs.distances.length} distancias, ${inputs.lines.length} líneas, ${inputs.executives.length} ejecutivas, ` +
      `${inputs.overrides.length} ajustes manuales activos.`
  )
  md.push(`- Filas de cobertura calculadas: ${coverage.length} (líneas activas × zonas activas, incluidas las vacantes).`)
  md.push(`- Tolerancia de minutos frente al documento: ±${MINUTES_TOLERANCE} min.`)
  if (resolutionProblems.length > 0) md.push(`- Nombres sin resolver: ${resolutionProblems.join('; ')}`)
  if (missing.length > 0) md.push(`- Celdas sin datos: ${missing.join('; ')}`)
  if (extraZones.length > 0) md.push(`- Zonas activas que el documento no lista: ${extraZones.map(zone => zone.name).join(', ')}`)
  md.push('')

  md.push('## Pruebas puras')
  md.push('')
  md.push('| Prueba | Resultado | Detalle |')
  md.push('| --- | --- | --- |')
  for (const test of pure) md.push(`| ${mdEscape(test.name)} | ${test.ok ? 'OK' : '**FALLA**'} | ${mdEscape(test.detail)} |`)
  md.push('')

  md.push('## Calculado frente al documento')
  md.push('')
  md.push('Cada celda: calculado / esperado. Las que no coinciden van en negrita con "NO".')
  md.push('')
  md.push(`| Zona | ${DOC_LINES.map(code => mdEscape(lineName(code))).join(' | ')} |`)
  md.push(`| --- | ${DOC_LINES.map(() => '---').join(' | ')} |`)
  const zoneOrder = Array.from(new Set(cells.map(cell => cell.zone)))
  for (const zone of zoneOrder) {
    const parts = DOC_LINES.map(code => {
      const cell = cells.find(item => item.zone === zone && item.line === code)
      if (!cell) return '—'
      return cell.ok
        ? `${mdEscape(cell.computed)}`
        : `**NO**: ${mdEscape(cell.computed)} / esperado ${mdEscape(cell.expected)}`
    })
    md.push(`| ${mdEscape(zone)} | ${parts.join(' | ')} |`)
  }
  md.push('')

  md.push('## Detalle por línea')
  md.push('')
  for (const lineCode of DOC_LINES) {
    md.push(`### ${mdEscape(lineName(lineCode))}`)
    md.push('')
    md.push('| Zona | Calculado | Esperado (documento) | ¿Coincide? |')
    md.push('| --- | --- | --- | --- |')
    for (const cell of cells.filter(item => item.line === lineCode)) {
      md.push(`| ${mdEscape(cell.zone)} | ${mdEscape(cell.computed)} | ${mdEscape(cell.expected)} | ${cell.ok ? 'sí' : '**NO**'} |`)
    }
    md.push('')
  }

  if (extraLines.length > 0 || extraZones.length > 0) {
    md.push('## Fuera del documento (solo informativo)')
    md.push('')
    for (const line of extraLines) {
      md.push(`### ${mdEscape(line.name)}`)
      md.push('')
      md.push('| Zona | Calculado |')
      md.push('| --- | --- |')
      for (const zone of activeZones) md.push(`| ${mdEscape(zone.name)} | ${mdEscape(describeComputed(rowFor(line.id, zone.id), executives))} |`)
      md.push('')
    }
    for (const zone of extraZones) {
      md.push(`- ${mdEscape(zone.name)}: ${DOC_LINES.map(code => {
        const line = linesByCode.get(code)
        return `${lineName(code)} → ${line ? describeComputed(rowFor(line.id, zone.id), executives) : '—'}`
      }).join(' · ')}`)
    }
    md.push('')
  }

  md.push('## Matriz zona → zona (minutos, mediana)')
  md.push('')
  md.push('Filas: zonas base de las ejecutivas activas/placeholder. Columnas: zonas activas. "—" = sin tiempos guardados.')
  md.push('')
  md.push(`| Desde \\ Hacia | ${activeZones.map(zone => mdEscape(zone.name)).join(' | ')} |`)
  md.push(`| --- | ${activeZones.map(() => '---:').join(' | ')} |`)
  for (const origin of baseZoneIds) {
    const values = activeZones.map(zone => {
      const value = matrix[origin]?.[zone.id]
      return value === undefined ? '—' : String(Math.round(value))
    })
    md.push(`| ${mdEscape(zonesById.get(origin)?.name ?? origin)} | ${values.join(' | ')} |`)
  }
  md.push('')

  fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  fs.writeFileSync(OUTPUT_MD, md.join('\n'), 'utf8')
  console.log(`\nInforme: ${OUTPUT_MD}`)

  if (pureOk !== pure.length || okCells !== cells.length || resolutionProblems.length > 0) process.exitCode = 1
}

main().catch(error => {
  console.error('Error en la verificación:', error instanceof Error ? error.message : error)
  process.exit(1)
})
