/**
 * Fase 2 · Verificación del motor de cobertura (SOLO LECTURA).
 *
 * 1. Pruebas puras de computeZoneMatrix() / computeCoverage() con datos de juguete, incluido el
 *    ejemplo de Barranquilla y Cartagena (una ejecutiva en Cartagena con las líneas 1 y 2, dos en
 *    Barranquilla: una con 1 y 2 y otra con 3 y 4, que llega a Cartagena por alcance), la regla del
 *    dueño para ajustes manuales (2026-10-11: solo se fuerza a alguien de otra ciudad si en la zona
 *    nadie lleva la línea) y el escenario de referencia Bucaramanga ↔ Cúcuta (Diana y Linda).
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
  joinNamesEs,
  loadCoverageInputs,
  overrideBlockingResidents,
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
    // 2026-10-11, el dueño: Diana Caicedo lleva PerOssal y Columna; no tiene Reemplazo ni Medicina deportiva
    cells: {
      perossal: cover('Diana Caicedo'),
      reemplazo: vacant('Viviana', hm(6, 38)),
      deportiva: vacant('Nueva Bogotá', hm(9, 15)),
      columna: cover('Diana Caicedo'),
    },
  },
  {
    label: 'Cúcuta',
    areas: ['54001'],
    cells: {
      perossal: cover('Linda'),
      reemplazo: vacant('Leyda', hm(10, 46)),
      deportiva: vacant('Nueva Bogotá', hm(12, 2)),
      columna: vacant('Diana Caicedo', hm(4, 52)),
    },
  },
  {
    label: 'Medellín',
    areas: ['05001'],
    cells: {
      perossal: cover('Viviana'),
      reemplazo: cover('Viviana'),
      deportiva: vacant('Joana', hm(7, 23)),
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

  // Regla del dueño (2026-10-11) para ajustes manuales: alguien de otra ciudad toma la zona por fuerza
  // solo si en esa zona no hay nadie con esa línea (y si la lleva).

  // (i) Forzar a una de otra ciudad en una zona sin residente con la línea → manual, aunque supere el alcance
  const forcedNoResident = baseInputs()
  forcedNoResident.lines = forcedNoResident.lines.map(line => ({ ...line, max_reach_minutes: 120 }))
  forcedNoResident.overrides.push({ id: 'O1', line_id: 'L3', kam_id: 'CTG', executive_id: 'B', reason: 'Viaja cada mes', active: true })
  rows = computeCoverage(forcedNoResident, toyMatrix)
  const forcedRow = find(rows, 'L3', 'CTG')
  check(
    'ajuste a una de otra ciudad en zona sin residente con la línea → manual (minutos desde su base y motivo en la nota)',
    forcedRow?.kind === 'manual' && forcedRow.executive_id === 'B' && forcedRow.travel_minutes === 146 &&
      forcedRow.source_kam_id === 'BAQ' && forcedRow.note === 'Viaja cada mes' && forcedRow.override_id === 'O1',
    `L3/CTG = ${forcedRow?.executive_id}:${forcedRow?.kind} ${forcedRow?.travel_minutes} "${forcedRow?.note}"`
  )

  // (ii) Forzar a A (Barranquilla) en Cartagena línea 1, donde vive C con la línea 1 → sin efecto, sigue local C
  const blocked = baseInputs()
  blocked.overrides.push({ id: 'O1', line_id: 'L1', kam_id: 'CTG', executive_id: 'A', reason: 'Atiende por viaje', active: true })
  rows = computeCoverage(blocked, toyMatrix)
  const blockedRow = find(rows, 'L1', 'CTG')
  check(
    'ajuste a una de otra ciudad en zona con residente que lleva la línea → sin efecto, queda local y la nota nombra a la residente',
    blockedRow?.kind === 'local' && blockedRow.executive_id === 'C' && blockedRow.travel_minutes === 0 &&
      blockedRow.note === 'Ajuste manual sin efecto: la zona ya tiene a C Cartagena con esta línea' &&
      blockedRow.override_id === 'O1',
    `L1/CTG = ${blockedRow?.executive_id}:${blockedRow?.kind}, note=${blockedRow?.note}`
  )

  // (ii-b) Zona en conflicto (B y D en Barranquilla con la 3): forzar a E, de Cartagena, no la resuelve
  const blockedConflict = baseInputs()
  blockedConflict.executives.push(
    { id: 'D', full_name: 'D Barranquilla', status: 'active', base_kam_id: 'BAQ' },
    { id: 'E', full_name: 'E Cartagena', status: 'active', base_kam_id: 'CTG' }
  )
  blockedConflict.executiveLines.push({ executive_id: 'D', line_id: 'L3' }, { executive_id: 'E', line_id: 'L3' })
  blockedConflict.overrides.push({ id: 'O1', line_id: 'L3', kam_id: 'BAQ', executive_id: 'E', reason: 'x', active: true })
  rows = computeCoverage(blockedConflict, toyMatrix)
  const blockedConflictRow = find(rows, 'L3', 'BAQ')
  check(
    'ajuste a una de otra ciudad en zona en conflicto → sin efecto, sigue el conflicto y la nota nombra a las dos',
    blockedConflictRow?.kind === 'conflict' && blockedConflictRow.executive_id === null &&
      Boolean(blockedConflictRow.note?.startsWith('Ajuste manual sin efecto: la zona ya tiene a B Barranquilla y D Barranquilla con esta línea')),
    `L3/BAQ = ${blockedConflictRow?.kind}, note=${blockedConflictRow?.note}`
  )

  // (iii) Forzar a una de las dos residentes en conflicto → manual (lo resuelve), 0 min
  const resolve = baseInputs()
  resolve.executives.push({ id: 'D', full_name: 'D Barranquilla', status: 'active', base_kam_id: 'BAQ' })
  resolve.executiveLines.push({ executive_id: 'D', line_id: 'L3' })
  resolve.overrides.push({ id: 'O1', line_id: 'L3', kam_id: 'BAQ', executive_id: 'D', reason: 'Reparto del líder', active: true })
  rows = computeCoverage(resolve, toyMatrix)
  const resolveRow = find(rows, 'L3', 'BAQ')
  check(
    'ajuste a una de dos residentes en conflicto → manual (resuelve el conflicto, 0 min)',
    resolveRow?.kind === 'manual' && resolveRow.executive_id === 'D' && resolveRow.travel_minutes === 0 &&
      resolveRow.source_kam_id === 'BAQ' && resolveRow.note === 'Reparto del líder',
    `L3/BAQ = ${resolveRow?.executive_id}:${resolveRow?.kind} ${resolveRow?.travel_minutes} "${resolveRow?.note}"`
  )

  // (iii-b) Una residente inactiva no bloquea: con C inactiva, A sí puede cubrir Cartagena en la 1 por fuerza
  const inactiveResident = baseInputs()
  inactiveResident.executives = inactiveResident.executives.map(executive =>
    executive.id === 'C' ? { ...executive, status: 'inactive' as const } : executive
  )
  inactiveResident.overrides.push({ id: 'O1', line_id: 'L1', kam_id: 'CTG', executive_id: 'A', reason: 'Mientras se contrata', active: true })
  rows = computeCoverage(inactiveResident, toyMatrix)
  const inactiveRow = find(rows, 'L1', 'CTG')
  check(
    'residente inactiva no bloquea el ajuste a una de otra ciudad',
    inactiveRow?.kind === 'manual' && inactiveRow.executive_id === 'A' && inactiveRow.travel_minutes === 146,
    `L1/CTG = ${inactiveRow?.executive_id}:${inactiveRow?.kind} ${inactiveRow?.travel_minutes}`
  )

  // Misma regla que usa la API (409): quién bloquea y cómo se nombran
  const apiBlockers = overrideBlockingResidents({ id: 'X', base_kam_id: 'BAQ' }, 'CTG', [
    { id: 'Z', full_name: 'Zoe', base_kam_id: 'CTG' },
    { id: 'Y', full_name: 'Ana', base_kam_id: 'CTG' },
    { id: 'W', full_name: 'Otra zona', base_kam_id: 'BAQ' },
  ])
  const apiResident = overrideBlockingResidents({ id: 'Y', base_kam_id: 'CTG' }, 'CTG', [
    { id: 'Z', full_name: 'Zoe', base_kam_id: 'CTG' },
    { id: 'Y', full_name: 'Ana', base_kam_id: 'CTG' },
  ])
  check(
    'regla compartida con la API: bloquean solo las residentes de la zona; quien vive en la zona no se bloquea',
    joinNamesEs(apiBlockers.map(item => item.full_name)) === 'Ana y Zoe' && apiResident.length === 0 &&
      joinNamesEs(['A', 'B', 'C']) === 'A, B y C' && joinNamesEs(['A']) === 'A',
    `bloquean=${apiBlockers.map(item => item.full_name).join('|')}, residente=${apiResident.length}`
  )

  // (iv) Escenario de referencia Bucaramanga ↔ Cúcuta: carretera 290-292 min (> 240, ninguna llega por alcance).
  // Diana Carolina Caicedo vive en Bucaramanga con PerOssal y Columna (no lleva Reemplazo ni Medicina deportiva).
  // Linda Valentina Barrera (por contratar) lleva PerOssal, Columna y Reemplazo: Reemplazo en Bucaramanga y toda Cúcuta.
  const nsMatrix: ZoneMatrix = { BGA: { BGA: 0, CUC: 290 }, CUC: { CUC: 0, BGA: 292 } }
  const nsInputs = (lindaBase: 'BGA' | 'CUC', forced: Array<[string, string, string]>): CoverageComputeInputs => ({
    zones: [
      { id: 'BGA', name: 'Bucaramanga', area_id: '68001', active: true },
      { id: 'CUC', name: 'Cúcuta', area_id: '54001', active: true },
    ],
    lines: [
      { id: 'PER', code: 'perossal', name: 'PerOssal', max_reach_minutes: 240, active: true },
      { id: 'REE', code: 'reemplazo', name: 'Reemplazo articular', max_reach_minutes: 240, active: true },
      { id: 'DEP', code: 'deportiva', name: 'Medicina deportiva', max_reach_minutes: 240, active: true },
      { id: 'COL', code: 'columna', name: 'Columna', max_reach_minutes: 240, active: true },
    ],
    executives: [
      { id: 'DIANA', full_name: 'Diana Carolina Caicedo', status: 'active', base_kam_id: 'BGA' },
      { id: 'LINDA', full_name: 'Linda Valentina Barrera', status: 'placeholder', base_kam_id: lindaBase },
    ],
    executiveLines: [
      { executive_id: 'DIANA', line_id: 'PER' },
      { executive_id: 'DIANA', line_id: 'COL' },
      { executive_id: 'LINDA', line_id: 'PER' },
      { executive_id: 'LINDA', line_id: 'COL' },
      { executive_id: 'LINDA', line_id: 'REE' },
    ],
    lineZones: [],
    overrides: forced.map(([line, zone, executive], index) => ({
      id: `N${index + 1}`,
      line_id: line,
      kam_id: zone,
      executive_id: executive,
      reason: 'Forzado por el líder',
      active: true,
    })),
  })
  const describeRows = (list: ComputedCoverage[]) =>
    list.map(row => `${row.line_id}/${row.kam_id}=${row.executive_id ?? '-'}:${row.kind}`).join(' ')
  const is = (list: ComputedCoverage[], line: string, zone: string, executive: string | null, kind: string, minutes?: number) => {
    const row = find(list, line, zone)
    return Boolean(row) && row!.executive_id === executive && row!.kind === kind && (minutes === undefined || row!.travel_minutes === minutes)
  }
  const noIneffective = (list: ComputedCoverage[]) => !list.some(row => row.note?.includes('sin efecto'))

  // Base de Linda = Cúcuta: Cúcuta local en 3 líneas; 1 ajuste forzado Bucaramanga/Reemplazo → Linda
  const nsA0 = computeCoverage(nsInputs('CUC', []), nsMatrix)
  const nsA = computeCoverage(nsInputs('CUC', [['REE', 'BGA', 'LINDA']]), nsMatrix)
  check(
    'escenario Bucaramanga/Cúcuta, Linda en Cúcuta: sin ajuste Bucaramanga/Reemplazo queda vacante (292 min > 240); con 1 ajuste forzado → Linda (manual); Cúcuta local en 3 líneas; Diana local en PerOssal y Columna; Medicina deportiva vacante',
    find(nsA0, 'REE', 'BGA')?.kind === 'vacant' && find(nsA0, 'REE', 'BGA')?.nearest_executive_id === 'LINDA' &&
      find(nsA0, 'REE', 'BGA')?.nearest_minutes === 292 &&
      is(nsA, 'REE', 'BGA', 'LINDA', 'manual', 292) && find(nsA, 'REE', 'BGA')?.override_id === 'N1' &&
      is(nsA, 'PER', 'CUC', 'LINDA', 'local') && is(nsA, 'COL', 'CUC', 'LINDA', 'local') && is(nsA, 'REE', 'CUC', 'LINDA', 'local') &&
      is(nsA, 'PER', 'BGA', 'DIANA', 'local') && is(nsA, 'COL', 'BGA', 'DIANA', 'local') &&
      is(nsA, 'DEP', 'BGA', null, 'vacant') && is(nsA, 'DEP', 'CUC', null, 'vacant') &&
      find(nsA, 'DEP', 'BGA')?.nearest_executive_id === null &&
      nsA.length === 8 && noIneffective(nsA),
    describeRows(nsA)
  )

  // Con la misma base, forzar a Linda en Bucaramanga/PerOssal no vale: Diana vive allí y lleva PerOssal
  const nsABlocked = computeCoverage(nsInputs('CUC', [['PER', 'BGA', 'LINDA']]), nsMatrix)
  check(
    'escenario Bucaramanga/Cúcuta, Linda en Cúcuta: forzarla en Bucaramanga/PerOssal queda sin efecto (Diana vive allí con PerOssal)',
    is(nsABlocked, 'PER', 'BGA', 'DIANA', 'local') &&
      find(nsABlocked, 'PER', 'BGA')?.note === 'Ajuste manual sin efecto: la zona ya tiene a Diana Carolina Caicedo con esta línea',
    `PER/BGA = ${find(nsABlocked, 'PER', 'BGA')?.executive_id}:${find(nsABlocked, 'PER', 'BGA')?.kind}, note=${find(nsABlocked, 'PER', 'BGA')?.note}`
  )

  // Base de Linda = Bucaramanga: 5 ajustes (3 forzados a Cúcuta + 2 en Bucaramanga para resolver el conflicto)
  const nsB0 = computeCoverage(nsInputs('BGA', []), nsMatrix)
  const nsB = computeCoverage(
    nsInputs('BGA', [
      ['PER', 'CUC', 'LINDA'],
      ['COL', 'CUC', 'LINDA'],
      ['REE', 'CUC', 'LINDA'],
      ['PER', 'BGA', 'DIANA'],
      ['COL', 'BGA', 'DIANA'],
    ]),
    nsMatrix
  )
  check(
    'escenario Bucaramanga/Cúcuta, Linda en Bucaramanga: sin ajustes hay conflicto en Bucaramanga (PerOssal, Columna) y Cúcuta vacante; con 5 ajustes → Cúcuta manual Linda en 3 líneas, Bucaramanga manual Diana en PerOssal y Columna, Reemplazo local Linda',
    find(nsB0, 'PER', 'BGA')?.kind === 'conflict' && find(nsB0, 'COL', 'BGA')?.kind === 'conflict' &&
      is(nsB0, 'REE', 'BGA', 'LINDA', 'local') &&
      find(nsB0, 'PER', 'CUC')?.kind === 'vacant' && find(nsB0, 'REE', 'CUC')?.kind === 'vacant' &&
      is(nsB, 'PER', 'CUC', 'LINDA', 'manual', 290) && is(nsB, 'COL', 'CUC', 'LINDA', 'manual', 290) &&
      is(nsB, 'REE', 'CUC', 'LINDA', 'manual', 290) &&
      is(nsB, 'PER', 'BGA', 'DIANA', 'manual', 0) && is(nsB, 'COL', 'BGA', 'DIANA', 'manual', 0) &&
      is(nsB, 'REE', 'BGA', 'LINDA', 'local') &&
      is(nsB, 'DEP', 'BGA', null, 'vacant') && is(nsB, 'DEP', 'CUC', null, 'vacant') &&
      nsB.filter(row => row.kind === 'manual').length === 5 && noIneffective(nsB),
    describeRows(nsB)
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
  md.push(`- Pruebas puras (ejemplo Barranquilla/Cartagena, conflicto, empate, ajustes manuales con la regla del dueño, escenario Bucaramanga/Cúcuta, tope, equipos): **${pureOk}/${pure.length}** correctas.`)
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
