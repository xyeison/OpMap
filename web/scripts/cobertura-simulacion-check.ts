/**
 * Zonas por línea · pruebas puras de lib/cobertura-simulacion.ts (spec docs/specs/2026-10-23-zonas-por-linea-para-lideres.md,
 * criterio "Simulación pura"). SIN red ni Supabase: datos de juguete y el motor puro de lib/coverage.ts.
 *
 * Datos de juguete: 7 Zonas activas (Barranquilla; Cartagena a 146 min; Valledupar a 450 min; y una "Bogotá" de cuatro
 * celdas a 26-30 min entre sí) y una inactiva (Sincelejo, sin celdas); 2 líneas activas (Reemplazo articular y
 * Sustitutos óseos, tope 240 min) y una inactiva (Trauma); personas activas, dos vacantes (placeholder, elegibles como
 * una persona: decisión del dueño del 2026-10-23) y una persona inactiva que nunca cubre. La matriz zona→zona se arma con
 * computeZoneMatrix a partir de IPS y distancias de juguete (Cartagena con dos IPS para la mediana 140/152 → 146).
 *
 * Qué se prueba:
 *   1. aplicarCambios: copias (no muta), linea_agregar/linea_quitar idempotentes, ajuste 'sim:<line>:<kam>' que desactiva
 *      el previo, quitar_ajuste por id.
 *   2. Los nueve casos de "Simulación pura" de la spec.
 *   3. estadoDePlaza: 5 kinds × active/placeholder × has_equipment (sin efecto).
 *   4. coberturaDesactualizada: igual → false; cambia kind, cambia executive_id, falta o sobra una celda → true.
 *   5. resumenPorEstado: las cinco claves siempre, cuentas por estado.
 *
 * Uso (desde web/): npx tsx scripts/cobertura-simulacion-check.ts   (va dentro de npm run test)
 * Código de salida 1 si alguna prueba falla.
 */
import { computeCoverage, computeZoneMatrix, type CoverageComputeInputs } from '../lib/coverage'
import {
  aplicarCambios,
  coberturaDesactualizada,
  diffCobertura,
  estadoDePlaza,
  resumenPorEstado,
  simularCobertura,
} from '../lib/cobertura-simulacion'
import type {
  ComputedCoverage,
  CoverageDistanceInput,
  CoverageExecutiveInput,
  CoverageHospitalInput,
  CoverageLineInput,
  CoverageZoneInput,
} from '../lib/types/coverage'
import { COVERAGE_KINDS } from '../lib/types/coverage'
import { ESTADOS_PLAZA, type Cambio, type EstadoPlaza } from '../lib/types/zonas'

let passed = 0
let failed = 0

function check(name: string, condition: boolean, detail?: unknown) {
  if (condition) {
    passed++
    console.log(`  ok    ${name}`)
  } else {
    failed++
    console.log(`  FALLA ${name}${detail === undefined ? '' : ` → ${JSON.stringify(detail)}`}`)
  }
}

function eq<T>(name: string, actual: T, expected: T) {
  check(name, JSON.stringify(actual) === JSON.stringify(expected), { actual, expected })
}

// ---------------------------------------------------------------------------------------------
// Datos de juguete
// ---------------------------------------------------------------------------------------------

const ZONAS: CoverageZoneInput[] = [
  { id: 'BAQ', name: 'Barranquilla', area_id: '08001', active: true },
  { id: 'CTG', name: 'Cartagena', area_id: '13001', active: true },
  { id: 'VUP', name: 'Valledupar', area_id: '20001', active: true },
  { id: 'CHA', name: 'Bogotá – Chapinero', area_id: '1100102', active: true },
  { id: 'ENG', name: 'Bogotá – Engativá', area_id: '1100110', active: true },
  { id: 'KEN', name: 'Bogotá – Kennedy', area_id: '1100108', active: true },
  { id: 'SCR', name: 'Bogotá – San Cristóbal', area_id: '1100104', active: true },
  { id: 'SIN', name: 'Sincelejo', area_id: '70001', active: false }, // inactiva: no produce celdas
]

/** Minutos de carro de la zona origen a la destino (simétricos). */
const MINUTOS: Record<string, Record<string, number>> = {
  BAQ: { CTG: 146, VUP: 450, CHA: 1020, ENG: 1010, KEN: 1030, SCR: 1040 },
  CTG: { BAQ: 146, VUP: 470, CHA: 1080, ENG: 1070, KEN: 1090, SCR: 1100 },
  VUP: { BAQ: 450, CTG: 470, CHA: 900, ENG: 890, KEN: 910, SCR: 920 },
  CHA: { ENG: 26, KEN: 30, SCR: 28, BAQ: 1020, CTG: 1080, VUP: 900 },
  ENG: { CHA: 26, KEN: 29, SCR: 30, BAQ: 1010, CTG: 1070, VUP: 890 },
  KEN: { CHA: 30, ENG: 29, SCR: 27, BAQ: 1030, CTG: 1090, VUP: 910 },
  SCR: { CHA: 28, ENG: 30, KEN: 27, BAQ: 1040, CTG: 1100, VUP: 920 },
}

const HOSPITALES: Array<CoverageHospitalInput & { zona: string }> = [
  { id: 'h-baq', municipality_id: '08001', locality_id: null, zona: 'BAQ' },
  { id: 'h-ctg-1', municipality_id: '13001', locality_id: null, zona: 'CTG' },
  { id: 'h-ctg-2', municipality_id: '13001', locality_id: null, zona: 'CTG' },
  { id: 'h-vup', municipality_id: '20001', locality_id: null, zona: 'VUP' },
  { id: 'h-cha', municipality_id: '11001', locality_id: '1100102', zona: 'CHA' },
  { id: 'h-eng', municipality_id: '11001', locality_id: '1100110', zona: 'ENG' },
  { id: 'h-ken', municipality_id: '11001', locality_id: '1100108', zona: 'KEN' },
  { id: 'h-scr', municipality_id: '11001', locality_id: '1100104', zona: 'SCR' },
]

/** Distancias (SEGUNDOS) de cada zona origen a las IPS de las demás; Barranquilla → Cartagena con 140 y 152 (mediana 146). */
const DISTANCIAS: CoverageDistanceInput[] = []
for (const origen of Object.keys(MINUTOS)) {
  for (const [destino, minutos] of Object.entries(MINUTOS[origen])) {
    HOSPITALES.filter(hospital => hospital.zona === destino).forEach((hospital, index) => {
      const valor = origen === 'BAQ' && destino === 'CTG' ? [140, 152][index] : minutos
      DISTANCIAS.push({ hospital_id: hospital.id, kam_id: origen, travel_time: valor * 60 })
    })
  }
}

const LINEAS: CoverageLineInput[] = [
  { id: 'L1', code: 'reemplazo', name: 'Reemplazo articular', max_reach_minutes: 240, active: true },
  { id: 'L2', code: 'sustitutos', name: 'Sustitutos óseos', max_reach_minutes: 240, active: true },
  { id: 'L3', code: 'trauma', name: 'Trauma', max_reach_minutes: 240, active: false }, // inactiva: sin celdas
]

const EJECUTIVOS: CoverageExecutiveInput[] = [
  { id: 'carmen', full_name: 'Carmen Barrios', status: 'active', base_kam_id: 'BAQ' },
  { id: 'alexa', full_name: 'Alexa Ocampo', status: 'active', base_kam_id: 'CTG' },
  { id: 'leyda', full_name: 'Leyda Santiago', status: 'active', base_kam_id: 'VUP' },
  { id: 'paola', full_name: 'Paola Jiménez', status: 'active', base_kam_id: 'CHA' },
  { id: 'vac-baq', full_name: 'Vacante Barranquilla', status: 'placeholder', base_kam_id: 'BAQ' },
  { id: 'vac-bog', full_name: 'Vacante Bogotá', status: 'placeholder', base_kam_id: 'CHA' },
  { id: 'linda', full_name: 'Linda Barrera', status: 'inactive', base_kam_id: 'CTG' }, // inactiva: nunca cubre
]
const EJECUTIVOS_POR_ID = new Map(EJECUTIVOS.map(ejecutivo => [ejecutivo.id, ejecutivo]))

/** Situación de partida: Carmen y Alexa llevan Reemplazo; Leyda y Paola, Sustitutos óseos; las vacantes, nada. */
const baseInputs = (): CoverageComputeInputs => ({
  zones: ZONAS.map(zone => ({ ...zone })),
  lines: LINEAS.map(line => ({ ...line })),
  executives: EJECUTIVOS.map(executive => ({ ...executive })),
  executiveLines: [
    { executive_id: 'carmen', line_id: 'L1' },
    { executive_id: 'alexa', line_id: 'L1' },
    { executive_id: 'leyda', line_id: 'L2' },
    { executive_id: 'paola', line_id: 'L2' },
    { executive_id: 'linda', line_id: 'L1' }, // inactiva: se ignora
  ],
  lineZones: [{ line_id: 'L1', kam_id: 'VUP', has_equipment: false }],
  overrides: [],
})

/** Variante con un ajuste real activo: Sustitutos óseos en Barranquilla forzado a Leyda (Valledupar). */
const inputsConAjuste = (): CoverageComputeInputs => {
  const inputs = baseInputs()
  inputs.overrides.push({ id: 'O1', line_id: 'L2', kam_id: 'BAQ', executive_id: 'leyda', reason: 'Viaja cada mes', active: true })
  return inputs
}

const MATRIZ = computeZoneMatrix(ZONAS, HOSPITALES, DISTANCIAS)

const celda = (rows: ComputedCoverage[], line: string, zone: string) =>
  rows.find(row => row.line_id === line && row.kam_id === zone)
const resumenCelda = (row: ComputedCoverage | undefined) =>
  row ? `${row.kind}:${row.executive_id ?? '-'}:${row.travel_minutes ?? '-'}:${row.source_kam_id ?? '-'}` : 'sin celda'
const estadoDeCelda = (row: ComputedCoverage | undefined): EstadoPlaza | null =>
  row ? estadoDePlaza(row.kind, row.executive_id ? EJECUTIVOS_POR_ID.get(row.executive_id) : null, row.has_equipment) : null
const filasPara = (rows: ComputedCoverage[]) =>
  rows.map(row => ({ kind: row.kind, executive: row.executive_id ? { status: EJECUTIVOS_POR_ID.get(row.executive_id)!.status } : null }))
const comparable = (rows: ComputedCoverage[]) =>
  rows.map(row => ({ line_id: row.line_id, kam_id: row.kam_id, kind: row.kind, executive_id: row.executive_id }))

// ---------------------------------------------------------------------------------------------
console.log('0. Matriz de juguete (computeZoneMatrix)')
// ---------------------------------------------------------------------------------------------
eq('Barranquilla → Cartagena: mediana de 140 y 152 = 146', MATRIZ.BAQ?.CTG, 146)
eq('Chapinero → Engativá: 26 min', MATRIZ.CHA?.ENG, 26)
eq('Barranquilla → Valledupar: 450 min (fuera del tope de 240)', MATRIZ.BAQ?.VUP, 450)
eq('diagonal 0', MATRIZ.CHA?.CHA, 0)

const antesBase = computeCoverage(baseInputs(), MATRIZ)
eq('situación de partida: 2 líneas activas × 7 Zonas activas = 14 celdas (sin Sincelejo ni Trauma)', antesBase.length, 14)
eq('partida: Reemplazo en Barranquilla local Carmen', resumenCelda(celda(antesBase, 'L1', 'BAQ')), 'local:carmen:0:BAQ')
eq('partida: Reemplazo en Chapinero sin cobertura, más cercana Carmen a 1020', [celda(antesBase, 'L1', 'CHA')?.kind, celda(antesBase, 'L1', 'CHA')?.nearest_executive_id, celda(antesBase, 'L1', 'CHA')?.nearest_minutes], ['vacant', 'carmen', 1020])
eq('partida: Sustitutos óseos en Engativá por alcance de Paola a 26', resumenCelda(celda(antesBase, 'L2', 'ENG')), 'reach:paola:26:CHA')
eq('partida: la inactiva Linda no cuenta aunque tenga la línea en executive_lines', celda(antesBase, 'L1', 'CTG')?.executive_id, 'alexa')

// ---------------------------------------------------------------------------------------------
console.log('\n1. aplicarCambios: copias, idempotencia, ajustes')
// ---------------------------------------------------------------------------------------------
{
  const inputs = inputsConAjuste()
  const antesJson = JSON.stringify(inputs)
  const cambios: Cambio[] = [
    { tipo: 'linea_agregar', executive_id: 'vac-bog', line_id: 'L1' },
    { tipo: 'linea_quitar', executive_id: 'alexa', line_id: 'L1' },
    { tipo: 'ajuste', line_id: 'L2', kam_id: 'BAQ', executive_id: 'carmen' },
    { tipo: 'quitar_ajuste', override_id: 'O1' },
  ]
  const resultado = aplicarCambios(inputs, cambios)
  eq('las entradas no se mutan (JSON antes = JSON después)', JSON.stringify(inputs), antesJson)
  check('el resultado es otro objeto con otras colecciones', resultado !== inputs && resultado.executiveLines !== inputs.executiveLines && resultado.overrides !== inputs.overrides && resultado.zones !== inputs.zones)
  check('las filas de overrides son copias (desactivar O1 no toca la original)', resultado.overrides[0] !== inputs.overrides[0] && inputs.overrides[0].active === true && resultado.overrides[0].active === false)
  check('linea_agregar añade la fila', resultado.executiveLines.some(link => link.executive_id === 'vac-bog' && link.line_id === 'L1'))
  check('linea_quitar la quita', !resultado.executiveLines.some(link => link.executive_id === 'alexa' && link.line_id === 'L1'))
  const sim = resultado.overrides.find(override => override.id === 'sim:L2:BAQ')
  eq('ajuste añade un override activo sim:<line>:<kam> con motivo "simulación"', sim && { executive_id: sim.executive_id, reason: sim.reason, active: sim.active, line_id: sim.line_id, kam_id: sim.kam_id }, { executive_id: 'carmen', reason: 'simulación', active: true, line_id: 'L2', kam_id: 'BAQ' })
  eq('solo un override activo por (línea, Zona) después del ajuste', resultado.overrides.filter(override => override.active && override.line_id === 'L2' && override.kam_id === 'BAQ').length, 1)

  const dosVeces = aplicarCambios(baseInputs(), [
    { tipo: 'linea_agregar', executive_id: 'vac-bog', line_id: 'L1' },
    { tipo: 'linea_agregar', executive_id: 'vac-bog', line_id: 'L1' },
    { tipo: 'linea_agregar', executive_id: 'carmen', line_id: 'L1' },
  ])
  eq('linea_agregar es idempotente (una sola fila por persona y línea)', dosVeces.executiveLines.filter(link => link.executive_id === 'vac-bog').length, 1)
  eq('agregar una línea que ya se lleva no duplica', dosVeces.executiveLines.filter(link => link.executive_id === 'carmen' && link.line_id === 'L1').length, 1)
  const quitarDos = aplicarCambios(baseInputs(), [
    { tipo: 'linea_quitar', executive_id: 'alexa', line_id: 'L1' },
    { tipo: 'linea_quitar', executive_id: 'alexa', line_id: 'L1' },
    { tipo: 'linea_quitar', executive_id: 'carmen', line_id: 'L2' }, // no la tenía
  ])
  eq('linea_quitar es idempotente y quitar lo que no se tiene no rompe', quitarDos.executiveLines.length, baseInputs().executiveLines.length - 1)
  const sinAjuste = aplicarCambios(inputsConAjuste(), [{ tipo: 'quitar_ajuste', override_id: 'O1' }])
  eq('quitar_ajuste desactiva por id', sinAjuste.overrides.map(override => [override.id, override.active]), [['O1', false]])
  eq('quitar_ajuste de un id que no existe no cambia nada', aplicarCambios(inputsConAjuste(), [{ tipo: 'quitar_ajuste', override_id: 'no-existe' }]).overrides.map(override => override.active), [true])
  eq('sin cambios, mismas filas', JSON.stringify(aplicarCambios(baseInputs(), [])), JSON.stringify(baseInputs()))
}

// ---------------------------------------------------------------------------------------------
console.log('\n2. Simulación pura (los nueve casos de la spec)')
// ---------------------------------------------------------------------------------------------
{
  // "antes" sale SIEMPRE de computeCoverage sobre las entradas, nunca de la tabla coverage
  const sinCambios = simularCobertura(baseInputs(), MATRIZ, [])
  eq('antes = computeCoverage(inputs, matrix)', JSON.stringify(sinCambios.antes), JSON.stringify(antesBase))
  eq('(6) diff vacío si no hay cambios', sinCambios.diff, [])
  eq('despues sin cambios = antes', JSON.stringify(sinCambios.despues), JSON.stringify(sinCambios.antes))

  // (1) Dar la línea a una vacante residente en una Zona sin local → local (Reservada)
  const caso1 = simularCobertura(baseInputs(), MATRIZ, [{ tipo: 'linea_agregar', executive_id: 'vac-bog', line_id: 'L1' }])
  eq('(1) Vacante Bogotá recibe Reemplazo: Chapinero pasa a local con la vacante', resumenCelda(celda(caso1.despues, 'L1', 'CHA')), 'local:vac-bog:0:CHA')
  eq('(1) estado de la plaza: reservada', estadoDeCelda(celda(caso1.despues, 'L1', 'CHA')), 'reservada')
  eq('(1) la vacante toma las otras tres celdas de Bogotá por alcance (26, 30 y 28 min)', ['ENG', 'KEN', 'SCR'].map(zone => resumenCelda(celda(caso1.despues, 'L1', zone))), ['reach:vac-bog:26:CHA', 'reach:vac-bog:30:CHA', 'reach:vac-bog:28:CHA'])
  eq('(1) diff: solo las cuatro celdas de Bogotá en Reemplazo, por nombre de Zona', caso1.diff.map(d => `${d.line_id}/${d.kam_id}:${d.antes.kind}→${d.despues.kind}`), ['L1/CHA:vacant→local', 'L1/ENG:vacant→reach', 'L1/KEN:vacant→reach', 'L1/SCR:vacant→reach'])
  eq('(1) Valledupar sigue sin cobertura con Carmen como más cercana (450 < 900 de Bogotá)', [celda(caso1.despues, 'L1', 'VUP')?.kind, celda(caso1.despues, 'L1', 'VUP')?.nearest_executive_id], ['vacant', 'carmen'])

  // (2) Con residente activo que ya lleva la línea → conflicto; se resuelve con ajuste a un residente
  const caso2 = simularCobertura(baseInputs(), MATRIZ, [{ tipo: 'linea_agregar', executive_id: 'vac-baq', line_id: 'L1' }])
  eq('(2) Vacante Barranquilla recibe Reemplazo con Carmen local → conflicto sin nadie', [celda(caso2.despues, 'L1', 'BAQ')?.kind, celda(caso2.despues, 'L1', 'BAQ')?.executive_id, celda(caso2.despues, 'L1', 'BAQ')?.note], ['conflict', null, 'Carmen Barrios, Vacante Barranquilla'])
  eq('(2) estado: conflicto', estadoDeCelda(celda(caso2.despues, 'L1', 'BAQ')), 'conflicto')
  eq('(2) diff: solo Barranquilla (las demás celdas conservan kind y persona)', caso2.diff.map(d => `${d.line_id}/${d.kam_id}`), ['L1/BAQ'])
  const caso2b = simularCobertura(baseInputs(), MATRIZ, [
    { tipo: 'linea_agregar', executive_id: 'vac-baq', line_id: 'L1' },
    { tipo: 'ajuste', line_id: 'L1', kam_id: 'BAQ', executive_id: 'carmen' },
  ])
  eq('(2) el conflicto se resuelve con un ajuste a una residente → manual Carmen', [resumenCelda(celda(caso2b.despues, 'L1', 'BAQ')), celda(caso2b.despues, 'L1', 'BAQ')?.override_id, celda(caso2b.despues, 'L1', 'BAQ')?.note], ['manual:carmen:0:BAQ', 'sim:L1:BAQ', 'simulación'])
  eq('(2) estado tras el ajuste: ocupada', estadoDeCelda(celda(caso2b.despues, 'L1', 'BAQ')), 'ocupada')

  // (3) La vacante con la línea compite por alcance hacia una vecina sin local; un ajuste a persona lo corrige
  const caso3 = simularCobertura(baseInputs(), MATRIZ, [{ tipo: 'linea_agregar', executive_id: 'vac-baq', line_id: 'L2' }])
  eq('(3) Vacante Barranquilla recibe Sustitutos óseos: Barranquilla local (reservada)', [resumenCelda(celda(caso3.despues, 'L2', 'BAQ')), estadoDeCelda(celda(caso3.despues, 'L2', 'BAQ'))], ['local:vac-baq:0:BAQ', 'reservada'])
  eq('(3) y Cartagena, sin local, le llega por alcance a 146 min (antes sin cobertura con Leyda a 470)', [resumenCelda(celda(caso3.antes, 'L2', 'CTG')), celda(caso3.antes, 'L2', 'CTG')?.nearest_executive_id, resumenCelda(celda(caso3.despues, 'L2', 'CTG')), estadoDeCelda(celda(caso3.despues, 'L2', 'CTG'))], ['vacant:-:-:-', 'leyda', 'reach:vac-baq:146:BAQ', 'alcance'])
  eq('(3) diff: Barranquilla y Cartagena en Sustitutos óseos', caso3.diff.map(d => `${d.line_id}/${d.kam_id}:${d.antes.kind}→${d.despues.kind}`), ['L2/BAQ:vacant→local', 'L2/CTG:vacant→reach'])
  const caso3b = simularCobertura(baseInputs(), MATRIZ, [
    { tipo: 'linea_agregar', executive_id: 'vac-baq', line_id: 'L2' },
    { tipo: 'ajuste', line_id: 'L2', kam_id: 'CTG', executive_id: 'leyda' },
  ])
  eq('(3) un ajuste a una persona (Leyda, 470 min) corrige el alcance de la vacante → manual', [resumenCelda(celda(caso3b.despues, 'L2', 'CTG')), celda(caso3b.despues, 'L2', 'CTG')?.override_id, estadoDeCelda(celda(caso3b.despues, 'L2', 'CTG'))], ['manual:leyda:470:VUP', 'sim:L2:CTG', 'ocupada'])

  // (4) Quitar la línea a la única local → alcance si hay vecina ≤ tope; si no, sin cobertura con la más cercana
  const caso4a = simularCobertura(baseInputs(), MATRIZ, [{ tipo: 'linea_quitar', executive_id: 'alexa', line_id: 'L1' }])
  eq('(4) quitar Reemplazo a Alexa: Cartagena pasa a alcance de Carmen a 146', [resumenCelda(celda(caso4a.despues, 'L1', 'CTG')), estadoDeCelda(celda(caso4a.despues, 'L1', 'CTG'))], ['reach:carmen:146:BAQ', 'alcance'])
  eq('(4) diff: solo Cartagena', caso4a.diff.map(d => `${d.line_id}/${d.kam_id}:${d.antes.kind}→${d.despues.kind}`), ['L1/CTG:local→reach'])
  const caso4b = simularCobertura(baseInputs(), MATRIZ, [
    { tipo: 'linea_quitar', executive_id: 'alexa', line_id: 'L1' },
    { tipo: 'linea_quitar', executive_id: 'carmen', line_id: 'L1' },
    { tipo: 'linea_agregar', executive_id: 'paola', line_id: 'L1' },
  ])
  eq('(4) sin nadie ≤ tope: Cartagena sin cobertura con la más cercana (Paola desde Chapinero, 1080)', [celda(caso4b.despues, 'L1', 'CTG')?.kind, celda(caso4b.despues, 'L1', 'CTG')?.executive_id, celda(caso4b.despues, 'L1', 'CTG')?.nearest_executive_id, celda(caso4b.despues, 'L1', 'CTG')?.nearest_minutes, estadoDeCelda(celda(caso4b.despues, 'L1', 'CTG'))], ['vacant', null, 'paola', 1080, 'sin_cobertura'])
  eq('(4) Valledupar solo cambia de más cercana (vacant→vacant): NO entra en el diff', caso4b.diff.some(d => d.kam_id === 'VUP'), false)
  eq('(4) diff ordenado por nombre de Zona: Barranquilla, Bogotá ×4, Cartagena', caso4b.diff.map(d => d.kam_id), ['BAQ', 'CHA', 'ENG', 'KEN', 'SCR', 'CTG'])
  const caso4c = simularCobertura(baseInputs(), MATRIZ, [
    { tipo: 'linea_quitar', executive_id: 'alexa', line_id: 'L1' },
    { tipo: 'linea_quitar', executive_id: 'carmen', line_id: 'L1' },
  ])
  eq('(4) si nadie lleva la línea (Linda está inactiva): sin cobertura y sin más cercana', [celda(caso4c.despues, 'L1', 'CTG')?.kind, celda(caso4c.despues, 'L1', 'CTG')?.nearest_executive_id], ['vacant', null])

  // (5) Ajuste desde otra ciudad bloqueado por una vacante residente que lleva la línea
  const caso5 = simularCobertura(baseInputs(), MATRIZ, [
    { tipo: 'linea_agregar', executive_id: 'vac-baq', line_id: 'L2' },
    { tipo: 'ajuste', line_id: 'L2', kam_id: 'BAQ', executive_id: 'leyda' },
  ])
  eq('(5) forzar a Leyda en Barranquilla con Vacante Barranquilla llevando la línea → sin efecto, sigue local la vacante', [resumenCelda(celda(caso5.despues, 'L2', 'BAQ')), celda(caso5.despues, 'L2', 'BAQ')?.note, celda(caso5.despues, 'L2', 'BAQ')?.override_id, estadoDeCelda(celda(caso5.despues, 'L2', 'BAQ'))], ['local:vac-baq:0:BAQ', 'Ajuste manual sin efecto: la zona ya tiene a Vacante Barranquilla con esta línea', 'sim:L2:BAQ', 'reservada'])
  const yaConLinea = baseInputs()
  yaConLinea.executiveLines.push({ executive_id: 'vac-baq', line_id: 'L2' })
  const caso5b = simularCobertura(yaConLinea, MATRIZ, [{ tipo: 'ajuste', line_id: 'L2', kam_id: 'BAQ', executive_id: 'leyda' }])
  eq('(5) un ajuste bloqueado solo cambia la nota: diff vacío', caso5b.diff, [])

  // (6) Diff vacío si nada cambia de verdad
  eq('(6) agregar una línea que ya se lleva → diff vacío', simularCobertura(baseInputs(), MATRIZ, [{ tipo: 'linea_agregar', executive_id: 'carmen', line_id: 'L1' }]).diff, [])
  eq('(6) quitar una línea que no se lleva → diff vacío', simularCobertura(baseInputs(), MATRIZ, [{ tipo: 'linea_quitar', executive_id: 'carmen', line_id: 'L2' }]).diff, [])
  eq('(6) quitar un ajuste que no existe → diff vacío', simularCobertura(baseInputs(), MATRIZ, [{ tipo: 'quitar_ajuste', override_id: 'no-existe' }]).diff, [])

  // (7) Las entradas no se mutan al simular
  const entradas = inputsConAjuste()
  const json = JSON.stringify(entradas)
  simularCobertura(entradas, MATRIZ, [
    { tipo: 'linea_agregar', executive_id: 'vac-bog', line_id: 'L1' },
    { tipo: 'linea_quitar', executive_id: 'alexa', line_id: 'L1' },
    { tipo: 'ajuste', line_id: 'L1', kam_id: 'CTG', executive_id: 'carmen' },
    { tipo: 'quitar_ajuste', override_id: 'O1' },
  ])
  eq('(7) simularCobertura no muta las entradas', JSON.stringify(entradas), json)

  // (8) Quitar un ajuste real: Barranquilla en Sustitutos óseos vuelve a sin cobertura con Leyda a 450
  const caso8 = simularCobertura(inputsConAjuste(), MATRIZ, [{ tipo: 'quitar_ajuste', override_id: 'O1' }])
  eq('(8) antes: manual Leyda por el ajuste O1', [resumenCelda(celda(caso8.antes, 'L2', 'BAQ')), celda(caso8.antes, 'L2', 'BAQ')?.override_id], ['manual:leyda:450:VUP', 'O1'])
  eq('(8) después: sin cobertura, más cercana Leyda a 450', [celda(caso8.despues, 'L2', 'BAQ')?.kind, celda(caso8.despues, 'L2', 'BAQ')?.nearest_executive_id, celda(caso8.despues, 'L2', 'BAQ')?.nearest_minutes], ['vacant', 'leyda', 450])
  eq('(8) diff', caso8.diff, [{ line_id: 'L2', kam_id: 'BAQ', antes: { kind: 'manual', executive_id: 'leyda' }, despues: { kind: 'vacant', executive_id: null } }])

  // (9) Dar la línea a quien vive en Chapinero deja Engativá, Kennedy y San Cristóbal por alcance
  const caso9 = simularCobertura(baseInputs(), MATRIZ, [{ tipo: 'linea_agregar', executive_id: 'paola', line_id: 'L1' }])
  eq('(9) Paola (Chapinero) recibe Reemplazo: Chapinero local y las otras tres celdas por alcance desde Chapinero', ['CHA', 'ENG', 'KEN', 'SCR'].map(zone => resumenCelda(celda(caso9.despues, 'L1', zone))), ['local:paola:0:CHA', 'reach:paola:26:CHA', 'reach:paola:30:CHA', 'reach:paola:28:CHA'])
  eq('(9) estados: ocupada y tres por alcance', ['CHA', 'ENG', 'KEN', 'SCR'].map(zone => estadoDeCelda(celda(caso9.despues, 'L1', zone))), ['ocupada', 'alcance', 'alcance', 'alcance'])
  eq('(9) Sustitutos óseos no cambia (Paola ya la llevaba): el diff solo trae Reemplazo', caso9.diff.every(d => d.line_id === 'L1') && caso9.diff.length === 4, true)

  // Orden del diff: por línea (como inputs.lines) y luego por nombre de Zona
  const mezcla = simularCobertura(baseInputs(), MATRIZ, [
    { tipo: 'linea_agregar', executive_id: 'vac-baq', line_id: 'L2' },
    { tipo: 'linea_quitar', executive_id: 'alexa', line_id: 'L1' },
  ])
  eq('diff ordenado por línea y Zona', mezcla.diff.map(d => `${d.line_id}/${d.kam_id}`), ['L1/CTG', 'L2/BAQ', 'L2/CTG'])
  eq('diffCobertura con las mismas filas → vacío', diffCobertura(antesBase, antesBase, baseInputs()), [])
}

// ---------------------------------------------------------------------------------------------
console.log('\n3. estadoDePlaza: 5 kinds × active/placeholder × has_equipment')
// ---------------------------------------------------------------------------------------------
{
  const esperado = (kind: string, status: 'active' | 'placeholder'): EstadoPlaza => {
    if (kind === 'local' || kind === 'manual') return status === 'placeholder' ? 'reservada' : 'ocupada'
    if (kind === 'reach') return 'alcance'
    if (kind === 'conflict') return 'conflicto'
    return 'sin_cobertura'
  }
  for (const kind of COVERAGE_KINDS) {
    for (const status of ['active', 'placeholder'] as const) {
      for (const hasEquipment of [true, false]) {
        eq(`${kind} + ${status} + equipo=${hasEquipment} → ${esperado(kind, status)}`, estadoDePlaza(kind, { status }, hasEquipment), esperado(kind, status))
      }
    }
  }
  eq('vacant sin persona → sin_cobertura', estadoDePlaza('vacant', null, true), 'sin_cobertura')
  eq('conflict sin persona → conflicto', estadoDePlaza('conflict', undefined, false), 'conflicto')
  eq('reach con vacante → alcance (la vacante compite por alcance como una persona)', estadoDePlaza('reach', { status: 'placeholder' }, true), 'alcance')
  eq('has_equipment=false no cambia el estado (Valledupar sin equipo en Reemplazo sigue sin_cobertura)', [celda(antesBase, 'L1', 'VUP')?.has_equipment, estadoDeCelda(celda(antesBase, 'L1', 'VUP'))], [false, 'sin_cobertura'])
}

// ---------------------------------------------------------------------------------------------
console.log('\n4. coberturaDesactualizada')
// ---------------------------------------------------------------------------------------------
{
  const calculada = comparable(antesBase)
  eq('igual → false', coberturaDesactualizada(comparable(antesBase), calculada), false)
  eq('igual en otro orden → false', coberturaDesactualizada([...comparable(antesBase)].reverse(), calculada), false)
  const otroKind = comparable(antesBase).map(c => (c.line_id === 'L1' && c.kam_id === 'CHA' ? { ...c, kind: 'reach' } : c))
  eq('cambia el kind de una celda → true', coberturaDesactualizada(otroKind, calculada), true)
  const otraPersona = comparable(antesBase).map(c => (c.line_id === 'L1' && c.kam_id === 'BAQ' ? { ...c, executive_id: 'vac-baq' } : c))
  eq('cambia el executive_id de una celda → true', coberturaDesactualizada(otraPersona, calculada), true)
  eq('falta una celda en la guardada → true', coberturaDesactualizada(comparable(antesBase).slice(1), calculada), true)
  eq('sobra una celda en la guardada → true', coberturaDesactualizada([...comparable(antesBase), { line_id: 'L3', kam_id: 'BAQ', kind: 'vacant', executive_id: null }], calculada), true)
  eq('tabla vacía frente a cálculo con celdas → true', coberturaDesactualizada([], calculada), true)
  eq('la tabla del 2026-10-11 frente a las vacantes con línea (caso 1) → true', coberturaDesactualizada(calculada, comparable(simularCobertura(baseInputs(), MATRIZ, [{ tipo: 'linea_agregar', executive_id: 'vac-bog', line_id: 'L1' }]).despues)), true)
}

// ---------------------------------------------------------------------------------------------
console.log('\n5. resumenPorEstado')
// ---------------------------------------------------------------------------------------------
{
  eq('sin filas: las cinco claves en 0', resumenPorEstado([]), { ocupada: 0, reservada: 0, alcance: 0, sin_cobertura: 0, conflicto: 0 })
  eq('las claves salen en el orden de ESTADOS_PLAZA', Object.keys(resumenPorEstado([])), [...ESTADOS_PLAZA])
  eq('situación de partida (14 celdas): 4 ocupadas, 3 por alcance, 7 sin cobertura', resumenPorEstado(filasPara(antesBase)), { ocupada: 4, reservada: 0, alcance: 3, sin_cobertura: 7, conflicto: 0 })
  const despues1 = simularCobertura(baseInputs(), MATRIZ, [{ tipo: 'linea_agregar', executive_id: 'vac-bog', line_id: 'L1' }]).despues
  eq('Reemplazo tras dar la línea a Vacante Bogotá: 2 ocupadas, 1 reservada, 3 por alcance, 1 sin cobertura', resumenPorEstado(filasPara(despues1.filter(row => row.line_id === 'L1'))), { ocupada: 2, reservada: 1, alcance: 3, sin_cobertura: 1, conflicto: 0 })
  const conflicto = simularCobertura(baseInputs(), MATRIZ, [{ tipo: 'linea_agregar', executive_id: 'vac-baq', line_id: 'L1' }]).despues
  eq('con el conflicto de Barranquilla: 1 conflicto', resumenPorEstado(filasPara(conflicto.filter(row => row.line_id === 'L1'))).conflicto, 1)
  eq('acepta filas con executive sin status conocido (se cuenta como ocupada)', resumenPorEstado([{ kind: 'local', executive: { status: 'otro' } }]).ocupada, 1)
}

// ---------------------------------------------------------------------------------------------
console.log(`\n${passed}/${passed + failed} OK, ${failed} fallas`)
if (failed > 0) process.exit(1)
