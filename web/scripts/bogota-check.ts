/**
 * Bogotá como UNA ciudad hacia afuera, con reparto por corredor · pruebas puras (SIN RED, sin
 * Supabase, sin Google). Spec: docs/specs/2026-10-11-bogota-corredores.md
 *
 * Cubre:
 *  1. lib/bogota-corredores.ts: resolveCorredor (municipio > departamento > sin corredor),
 *     celdaParaCorredor, gruposParaK (k = 1..4), validarGrupos, parseBogotaConfig y la semilla.
 *  2. Funciones puras del motor (lib/opmap-algorithm-simplified.ts): bogotaVirtualCandidate,
 *     pickCompetitiveWinner, chooseBogotaCell y competeForHospital.
 *  3. Los criterios de aceptación de la spec:
 *     a. 200 min Engativá / 215 Chapinero / Pereira 230 -> gana Bogotá (200) y la celda la decide el corredor.
 *     b. 4 h 33 Chapinero / 4 h 31 Engativá con tope 240 -> sin zona, salvo asignación forzada.
 *     c. k = 2 y corredor Oriente -> la celda del grupo Norte + Oriente.
 *     d. IPS en una localidad de Bogotá: la regla de mayoría no cambia (caso Teusaquillo).
 *  4. k = 1/2/3/4, municipio sin corredor, celda no activa, empates e IPS de Bogotá sin cambios,
 *     ejecutando la clase SimplifiedOpMapAlgorithm en memoria (loadFromData, sin base de datos).
 *  5. Localidades de Bogotá sin IPS (spec docs/specs/2026-10-28-localidades-sin-ips-por-corredor.md):
 *     celdasAplicadasPorCorredor, localidadesPorCorredor, el orden del mapa (zonaDeLocalidadSinIps) y, leyendo
 *     components/MapComponent.tsx, que las IPS manden y los textos del corredor.
 *  6. Bogotá en 4 sectores (spec docs/specs/2026-10-28-bogota-4-sectores.md): la tabla de las 20 localidades,
 *     bogotaSectorCell y la clase (sector antes del territorio base, forzadas primero, celda inactiva → regla de siempre).
 *     La sección de la clase ("Clase SimplifiedOpMapAlgorithm") ya refleja los sectores: Teusaquillo va a Occidente.
 *
 * Uso (desde web/): npx tsx scripts/bogota-check.ts   (incluida en npm run test)
 * Código de salida 1 si alguna prueba falla.
 */
import { readFileSync } from 'fs'
import path from 'path'
import {
  AGRUPACIONES_POR_K,
  CORREDORES,
  CORREDOR_DE_LOCALIDAD,
  SEMILLA_CORREDORES,
  celdaParaCorredor,
  celdasAplicadasPorCorredor,
  gruposParaK,
  gruposPorDefecto,
  localidadesPorCorredor,
  parseBogotaConfig,
  parseCorredorRows,
  resolveCorredor,
  resolveCorredorConFuente,
  validarGrupos,
  type BogotaConfig,
  type BogotaK,
  type Corredor,
  type CorredorRow,
} from '../lib/bogota-corredores'
import {
  BOGOTA_VIRTUAL_ID,
  SimplifiedOpMapAlgorithm,
  bogotaSectorCell,
  bogotaVirtualCandidate,
  chooseBogotaCell,
  competeForHospital,
  pickCompetitiveWinner,
  type AlgorithmHospital,
  type AlgorithmKam,
  type Assignment,
  type BogotaRuleInput,
  type DistanceRecord,
  type ForcedAssignment,
} from '../lib/opmap-algorithm-simplified'
import { zonaDeLocalidadSinIps } from '../lib/territory-rules'

for (const key of ['SUPABASE_SERVICE_ROLE_KEY', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_URL', 'GOOGLE_MAPS_API_KEY']) {
  delete process.env[key]
}
process.env.GOOGLE_ROUTES_DISABLED = 'true'
globalThis.fetch = (async () => {
  throw new Error('bogota-check: la red está prohibida en estas pruebas')
}) as typeof fetch

// ---------------------------------------------------------------------------
// Mini marco de pruebas
// ---------------------------------------------------------------------------

const print = (line = '') => process.stdout.write(`${line}\n`)
let passed = 0
let failed = 0

function check(name: string, condition: boolean, detail?: string) {
  if (condition) {
    passed++
    print(`  OK    ${name}`)
  } else {
    failed++
    print(`  FALLA ${name}${detail ? ` -> ${detail}` : ''}`)
  }
}

const min = (minutes: number) => Math.round(minutes * 60) // minutos -> SEGUNDOS

// ---------------------------------------------------------------------------
// Datos de referencia (department_adjacency copiada de Supabase el 2026-10-11, solo lectura)
// ---------------------------------------------------------------------------

const ADJACENCY: Record<string, string[]> = {
  '05': ['13', '15', '17', '23', '27', '66', '68'],
  '08': ['13', '47'],
  '11': ['05', '15', '17', '25', '41', '50', '73', '85'],
  '13': ['08', '20', '23', '47', '68', '70'],
  '15': ['05', '17', '25', '54', '68', '81', '85'],
  '17': ['05', '15', '25', '66', '73'],
  '18': ['19', '41', '50', '86', '91', '95', '97'],
  '19': ['18', '41', '52', '73', '76', '86'],
  '20': ['13', '44', '47', '54', '68'],
  '23': ['05', '13', '70'],
  '25': ['05', '11', '15', '17', '41', '50', '73', '85'],
  '27': ['05', '66', '76'],
  '41': ['18', '19', '25', '50', '73'],
  '44': ['20', '47'],
  '47': ['08', '13', '20'],
  '50': ['11', '18', '25', '41', '85', '95', '99'],
  '52': ['18', '86'],
  '54': ['15', '20', '68', '81'],
  '63': ['66', '73', '76'],
  '66': ['05', '17', '27', '63', '73', '76'],
  '68': ['05', '13', '15', '20', '54'],
  '70': ['13', '23'],
  '73': ['17', '18', '25', '41', '63', '66', '76'],
  '76': ['18', '19', '27', '63', '66', '73'],
  '81': ['15', '54', '85', '99'],
  '85': ['15', '25', '50', '81', '99'],
  '86': ['18', '19', '52', '91'],
  '91': ['18', '86', '97'],
  '94': ['95', '97', '99'],
  '95': ['18', '50', '94', '97', '99'],
  '97': ['18', '91', '94', '95'],
  '99': ['50', '81', '85', '94', '95'],
}
const EXCLUDED = ['27', '88', '91', '94', '95', '97', '99']

// Zonas (orden por nombre, como las carga el algoritmo). Topes reales del 2026-10-11 salvo donde se indica.
const kam = (name: string, area_id: string, max_travel_time: number, priority = 2): AlgorithmKam => ({
  id: `kam-${area_id}`,
  name,
  area_id,
  lat: 0,
  lng: 0,
  enable_level2: true,
  max_travel_time,
  priority,
  active: true,
  participates_in_assignment: true,
})
const BUCARAMANGA = kam('Bucaramanga', '68001', 360)
const CHAPINERO = kam('Chapinero', '1100102', 360)
const ENGATIVA = kam('Engativá', '1100110', 240)
const IBAGUE = kam('Ibagué', '73001', 240, 1)
const KENNEDY = kam('Kennedy', '1100108', 240)
const NEIVA = kam('Neiva', '41001', 360)
const PASTO = kam('Pasto', '52001', 360)
const PEREIRA = kam('Pereira', '66001', 360)
const SAN_CRISTOBAL = kam('San Cristóbal', '1100104', 240)
const KAMS: AlgorithmKam[] = [BUCARAMANGA, CHAPINERO, ENGATIVA, IBAGUE, KENNEDY, NEIVA, PASTO, PEREIRA, SAN_CRISTOBAL]
const CELDAS = [CHAPINERO, ENGATIVA, KENNEDY, SAN_CRISTOBAL]
const nameOf = (id: string | null | undefined) => KAMS.find(k => k.id === id)?.name ?? String(id)

// Celda de cada corredor con k = 4 en estas pruebas (la celda del Norte vive en Chapinero, como antes de la 0903)
const GRUPOS_K4: Record<Corredor, string> = { norte: CHAPINERO.id, occidente: ENGATIVA.id, sur: KENNEDY.id, oriente: SAN_CRISTOBAL.id }

const config = (k: BogotaK, max = 240, receptoras?: string[]): BogotaConfig => ({
  k,
  max_travel_minutes: max,
  grupos: gruposParaK(k, GRUPOS_K4, receptoras),
})
const rule = (k: BogotaK = 4, max = 240, corredores: readonly CorredorRow[] = SEMILLA_CORREDORES, receptoras?: string[]): BogotaRuleInput => ({
  config: config(k, max, receptoras),
  corredores,
})

const hospital = (id: string, municipality_id: string, extra: Partial<AlgorithmHospital> = {}): AlgorithmHospital => ({
  id,
  code: id,
  name: id,
  department_id: municipality_id.substring(0, 2),
  municipality_id,
  lat: 0,
  lng: 0,
  beds: 10,
  active: true,
  ...extra,
})

const secondsFrom = (table: Record<string, number>) => (kamId: string) => (kamId in table ? table[kamId] : null)

// ---------------------------------------------------------------------------
// 1. lib/bogota-corredores.ts
// ---------------------------------------------------------------------------

function seccionCorredores() {
  print('1. Corredores: resolución, grupos por k, validación y semilla')

  const filas: CorredorRow[] = [
    { department_code: '25', municipality_code: '25754', corredor: 'sur' },
    { department_code: '25', municipality_code: null, corredor: 'occidente' },
    { department_code: '15', municipality_code: null, corredor: 'norte' },
    { department_code: '15', municipality_code: '15001', corredor: 'oriente' },
  ]
  check('resolveCorredor: la fila del municipio manda sobre la del departamento', resolveCorredor('25754', '25', filas) === 'sur')
  check('resolveCorredor: sin fila del municipio, la del departamento', resolveCorredor('25899', '25', filas) === 'occidente')
  check(
    'resolveCorredor: excepción por municipio en un departamento sembrado (15001 -> oriente)',
    resolveCorredorConFuente('15001', '15', filas)?.fuente === 'municipio' && resolveCorredor('15001', '15', filas) === 'oriente'
  )
  check('resolveCorredor: sin fila -> null (sin corredor)', resolveCorredor('41001', '41', filas) === null)
  check('resolveCorredor: sin department_code usa los 2 primeros dígitos del municipio', resolveCorredor('15238', null, filas) === 'norte')

  const NORTE_USAQUEN = { id: 'kam-1100101', area_id: '1100101' }
  const porDefecto = gruposPorDefecto(4, [NORTE_USAQUEN, ...CELDAS.filter(c => c.id !== CHAPINERO.id)])!
  check(
    'k = 4 por defecto: Norte → la celda de Usaquén (0903), Occidente Engativá, Sur Kennedy, Oriente San Cristóbal',
    porDefecto.norte === NORTE_USAQUEN.id && porDefecto.occidente === ENGATIVA.id && porDefecto.sur === KENNEDY.id && porDefecto.oriente === SAN_CRISTOBAL.id
  )
  check('sin celda en Usaquén no hay grupos por defecto (null)', gruposPorDefecto(4, CELDAS) === null)
  // El resto de las pruebas usa la celda del Norte en Chapinero (GRUPOS_K4), como antes de la 0903
  const base = GRUPOS_K4
  const k3 = gruposParaK(3, base)
  check('k = 3: Norte | Occidente | Sur + Oriente (Sur + Oriente -> Kennedy)', k3.norte === CHAPINERO.id && k3.occidente === ENGATIVA.id && k3.sur === KENNEDY.id && k3.oriente === KENNEDY.id)
  const k2 = gruposParaK(2, base)
  check('k = 2: Norte + Oriente -> Chapinero; Occidente + Sur -> Engativá', k2.norte === CHAPINERO.id && k2.oriente === CHAPINERO.id && k2.occidente === ENGATIVA.id && k2.sur === ENGATIVA.id)
  const k1 = gruposParaK(1, base, [KENNEDY.id])
  check('k = 1: los cuatro corredores a la celda elegida (Kennedy)', CORREDORES.every(c => k1[c] === KENNEDY.id))
  const k2b = gruposParaK(2, base, [SAN_CRISTOBAL.id, KENNEDY.id])
  check('k = 2 con receptoras elegidas: Norte + Oriente -> San Cristóbal, Occidente + Sur -> Kennedy', k2b.norte === SAN_CRISTOBAL.id && k2b.oriente === SAN_CRISTOBAL.id && k2b.sur === KENNEDY.id && k2b.occidente === KENNEDY.id)
  check('celdaParaCorredor lee bogota_config.grupos', celdaParaCorredor('oriente', { grupos: k2 }) === CHAPINERO.id && celdaParaCorredor('sur', { grupos: {} }) === null)

  for (const k of [1, 2, 3, 4] as BogotaK[]) {
    check(`validarGrupos: los grupos por defecto de k = ${k} son válidos`, validarGrupos(k, gruposParaK(k, base)).length === 0, validarGrupos(k, gruposParaK(k, base)).join(' '))
  }
  check('validarGrupos: falta un corredor', validarGrupos(4, { norte: 'a', occidente: 'b', sur: 'c' }).some(e => e.includes('Oriente')))
  check('validarGrupos: k = 2 con Norte y Oriente en celdas distintas', validarGrupos(2, base).length > 0)
  check('validarGrupos: k = 4 con dos corredores en la misma celda', validarGrupos(4, k3).length > 0)
  check('AGRUPACIONES_POR_K cubre los 4 corredores exactamente una vez para cada k', ([1, 2, 3, 4] as BogotaK[]).every(k => AGRUPACIONES_POR_K[k].length === k && AGRUPACIONES_POR_K[k].flat().sort().join() === [...CORREDORES].sort().join()))

  const parsed = parseBogotaConfig({ id: 1, k: 2, max_travel_minutes: 240, grupos: { norte: 'x', oriente: 'x', sur: 'y', occidente: 'y', otro: 'z', bad: 3 } })
  check('parseBogotaConfig normaliza la fila y descarta claves que no son corredores', parsed?.k === 2 && parsed.max_travel_minutes === 240 && Object.keys(parsed.grupos).sort().join() === 'norte,occidente,oriente,sur')
  check('parseBogotaConfig: sin fila o con k inválido -> null', parseBogotaConfig(null) === null && parseBogotaConfig({ k: 5, max_travel_minutes: 240, grupos: {} }) === null && parseBogotaConfig({ k: 4, max_travel_minutes: 0, grupos: {} }) === null)
  check('parseCorredorRows descarta corredores desconocidos y normaliza municipality_code vacío', parseCorredorRows([{ department_code: '15', municipality_code: '', corredor: 'norte' }, { department_code: '41', corredor: 'centro' }]).length === 1)

  const deptRows = SEMILLA_CORREDORES.filter(f => f.municipality_code === null)
  const cundi = SEMILLA_CORREDORES.filter(f => f.department_code === '25')
  const keys = new Set(SEMILLA_CORREDORES.map(f => `${f.department_code}|${f.municipality_code ?? ''}`))
  check('Semilla: 29 departamentos + 116 municipios de Cundinamarca, sin duplicados', deptRows.length === 29 && cundi.length === 116 && cundi.every(f => f.municipality_code?.startsWith('25')) && keys.size === SEMILLA_CORREDORES.length, `${deptRows.length} / ${cundi.length} / ${keys.size} de ${SEMILLA_CORREDORES.length}`)
  const r = (m: string) => resolveCorredor(m, m.substring(0, 2), SEMILLA_CORREDORES)
  const esperado: Array<[string, Corredor | null, string]> = [
    ['15001', 'norte', 'Tunja'], ['68001', 'norte', 'Bucaramanga'], ['73001', 'occidente', 'Ibagué'], ['05001', 'occidente', 'Medellín'],
    ['41001', 'sur', 'Neiva'], ['50001', 'oriente', 'Villavicencio'], ['85001', 'oriente', 'Yopal'], ['25754', 'sur', 'Soacha'],
    ['25290', 'sur', 'Fusagasugá'], ['25307', 'sur', 'Girardot'], ['25899', 'norte', 'Zipaquirá'], ['25377', 'norte', 'La Calera'],
    ['25269', 'occidente', 'Facatativá'], ['25320', 'occidente', 'Guaduas'], ['25151', 'oriente', 'Cáqueza'], ['25297', 'oriente', 'Gachetá'],
    ['25438', 'oriente', 'Medina'], ['25322', 'norte', 'Guasca'], ['11001', null, 'Bogotá'], ['27001', null, 'Quibdó'],
  ]
  const fallos = esperado.filter(([m, c]) => r(m) !== c).map(([m, c, n]) => `${n} ${m}: ${r(m)} (esperado ${c})`)
  check('Semilla: corredores de municipios de referencia', fallos.length === 0, fallos.join('; '))
}

// ---------------------------------------------------------------------------
// 2. Funciones puras del motor
// ---------------------------------------------------------------------------

function seccionMotorPuro() {
  print('')
  print('2. Motor: candidato virtual, competencia y elección de celda')

  const v = bogotaVirtualCandidate(
    [
      { kam_id: CHAPINERO.id, priority: 2, seconds: min(215) },
      { kam_id: ENGATIVA.id, priority: 2, seconds: min(200) },
      { kam_id: KENNEDY.id, priority: 2, seconds: null },
    ],
    240
  )
  check('bogotaVirtualCandidate: mínimo de las celdas con distancia conocida', v?.min_seconds === min(200) && v.celda_min === ENGATIVA.id && v.within_reach)
  check('bogotaVirtualCandidate: ninguna distancia conocida -> null', bogotaVirtualCandidate([{ kam_id: KENNEDY.id, priority: 2, seconds: null }], 240) === null)
  const vFuera = bogotaVirtualCandidate([{ kam_id: CHAPINERO.id, priority: 2, seconds: min(273) }], 240)
  check('bogotaVirtualCandidate: 273 min con tope 240 -> fuera de alcance', vFuera?.within_reach === false)
  const vEmpate = bogotaVirtualCandidate(
    [
      { kam_id: ENGATIVA.id, priority: 2, seconds: min(200) },
      { kam_id: KENNEDY.id, priority: 3, seconds: min(200) },
    ],
    240
  )
  check('bogotaVirtualCandidate: empate entre celdas -> mayor prioridad (Kennedy)', vEmpate?.celda_min === KENNEDY.id && vEmpate.priority === 3)

  check(
    'pickCompetitiveWinner: respeta el tope de cada candidato',
    pickCompetitiveWinner([
      { kam_id: 'a', seconds: min(250), max_minutes: 240, priority: 2 },
      { kam_id: 'b', seconds: min(300), max_minutes: 360, priority: 2 },
    ])?.kam_id === 'b'
  )
  check(
    'pickCompetitiveWinner: empate exacto -> mayor prioridad; igual prioridad -> el primero',
    pickCompetitiveWinner([
      { kam_id: 'a', seconds: 100, max_minutes: 240, priority: 2 },
      { kam_id: 'b', seconds: 100, max_minutes: 240, priority: 3 },
    ])?.kam_id === 'b' &&
      pickCompetitiveWinner([
        { kam_id: 'a', seconds: 100, max_minutes: 240, priority: 2 },
        { kam_id: 'b', seconds: 100, max_minutes: 240, priority: 2 },
      ])?.kam_id === 'a'
  )

  const r4 = rule(4)
  const activas = new Set(CELDAS.map(c => c.id))
  const tunja = hospital('tunja', '15001')
  const eleccion = chooseBogotaCell(tunja, v!, r4, activas, secondsFrom({ [CHAPINERO.id]: min(215), [ENGATIVA.id]: min(200) }))
  check(
    'chooseBogotaCell: Boyacá (Norte) -> Chapinero con su tiempo real (215 min) y detail',
    eleccion.kam_id === CHAPINERO.id && eleccion.travel_time === min(215) && eleccion.motivo === 'corredor' &&
      eleccion.detail.corredor === 'norte' && eleccion.detail.bogota_min_segundos === min(200) && eleccion.detail.celda_min === ENGATIVA.id,
    JSON.stringify(eleccion)
  )
  const sinTiempo = chooseBogotaCell(hospital('neiva-ips', '41001'), v!, r4, activas, secondsFrom({ [ENGATIVA.id]: min(200) }))
  check('chooseBogotaCell: celda del corredor sin distancia -> travel_time = mínimo de Bogotá', sinTiempo.kam_id === KENNEDY.id && sinTiempo.travel_time === min(200))
}

// ---------------------------------------------------------------------------
// 3 y 4. Criterios de aceptación, k, sin corredor, empates (competeForHospital)
// ---------------------------------------------------------------------------

function seccionAceptacion() {
  print('')
  print('3. Criterios de aceptación de la spec (competeForHospital)')

  // a. 200 Engativá / 215 Chapinero / Pereira 230
  const tunja = hospital('tunja', '15001')
  const tiemposA = secondsFrom({ [ENGATIVA.id]: min(200), [CHAPINERO.id]: min(215), [PEREIRA.id]: min(230) })
  const a = competeForHospital(tunja, KAMS, ADJACENCY, tiemposA, rule(4))
  check(
    'a. gana Bogotá (200) y la celda la decide el corredor (Boyacá = Norte -> Chapinero), no los 15 min',
    a?.assignment_type === 'bogota_corredor' && a.kam_id === CHAPINERO.id && a.detail?.bogota_min_segundos === min(200) &&
      a.detail?.celda_min === ENGATIVA.id && a.detail?.corredor === 'norte' && a.travel_time === min(215),
    JSON.stringify(a)
  )
  const ibagueIps = hospital('ibague-ips', '73268') // Tolima = Occidente
  const aOcc = competeForHospital(ibagueIps, KAMS, ADJACENCY, secondsFrom({ [CHAPINERO.id]: min(150), [ENGATIVA.id]: min(170), [IBAGUE.id]: min(160) }), rule(4))
  check(
    'a. Tolima (Occidente): gana Bogotá con el tiempo de Chapinero (150) pero va a Engativá',
    aOcc?.kam_id === ENGATIVA.id && aOcc.detail?.celda_min === CHAPINERO.id && aOcc.travel_time === min(170),
    JSON.stringify(aOcc)
  )
  const aLegacy = competeForHospital(tunja, KAMS, ADJACENCY, tiemposA, null)
  check('a. sin configuración (comportamiento anterior): gana la celda más cercana (Engativá, competitive)', aLegacy?.kam_id === ENGATIVA.id && aLegacy.assignment_type === 'competitive' && aLegacy.detail === null)

  // b. 4 h 33 Chapinero / 4 h 31 Engativá con tope 240
  const lejos = hospital('lejos', '68081') // Barrancabermeja (Santander)
  const tiemposB = secondsFrom({ [CHAPINERO.id]: min(273), [ENGATIVA.id]: min(271), [BUCARAMANGA.id]: min(250) })
  const kamsTope240 = KAMS.map(k => ({ ...k, max_travel_time: 240 }))
  const b = competeForHospital(lejos, kamsTope240, ADJACENCY, tiemposB, rule(4, 240))
  check('b. 273 / 271 min con tope 240 para todas -> sin zona (fuera de alcance)', b === null, JSON.stringify(b))
  const bTope = competeForHospital(lejos, KAMS.map(k => (k.id === BUCARAMANGA.id ? { ...k, max_travel_time: 240 } : k)), ADJACENCY, tiemposB, rule(4, 240))
  check('b. el tope de Bogotá ignora kams.max_travel_time de Chapinero (360): sigue sin zona', bTope === null, JSON.stringify(bTope))
  const bLegacy = competeForHospital(lejos, KAMS.map(k => (k.id === BUCARAMANGA.id ? { ...k, max_travel_time: 240 } : k)), ADJACENCY, tiemposB, null)
  check('b. comportamiento anterior: Chapinero (tope 360) se la queda con 273 min (el caso que reportó el dueño)', bLegacy?.kam_id === CHAPINERO.id)

  // c. k = 2, corredor Oriente
  const meta = hospital('meta-ips', '50006') // Acacías (Meta) = Oriente
  const tiemposC = secondsFrom({ [CHAPINERO.id]: min(120), [ENGATIVA.id]: min(130), [KENNEDY.id]: min(110), [SAN_CRISTOBAL.id]: min(100) })
  const c = competeForHospital(meta, KAMS, ADJACENCY, tiemposC, rule(2))
  check('c. k = 2 y corredor Oriente -> celda del grupo Norte + Oriente (Chapinero)', c?.kam_id === CHAPINERO.id && c.detail?.corredor === 'oriente' && c.travel_time === min(120), JSON.stringify(c))
  const c2 = competeForHospital(meta, KAMS, ADJACENCY, tiemposC, rule(2, 240, SEMILLA_CORREDORES, [SAN_CRISTOBAL.id, KENNEDY.id]))
  check('c. k = 2 con San Cristóbal como receptora de Norte + Oriente -> San Cristóbal', c2?.kam_id === SAN_CRISTOBAL.id)

  print('')
  print('4. k = 1/2/3/4, sin corredor, celda no activa, empates y elegibilidad')
  const ipsPorCorredor: Record<Corredor, AlgorithmHospital> = {
    norte: hospital('n', '15001'),
    occidente: hospital('o', '73268'),
    sur: hospital('s', '41298'),
    oriente: hospital('e', '50006'),
  }
  const todas = secondsFrom({ [CHAPINERO.id]: min(100), [ENGATIVA.id]: min(100), [KENNEDY.id]: min(100), [SAN_CRISTOBAL.id]: min(90) })
  const esperadoPorK: Record<BogotaK, Record<Corredor, string>> = {
    4: { norte: CHAPINERO.id, occidente: ENGATIVA.id, sur: KENNEDY.id, oriente: SAN_CRISTOBAL.id },
    3: { norte: CHAPINERO.id, occidente: ENGATIVA.id, sur: KENNEDY.id, oriente: KENNEDY.id },
    2: { norte: CHAPINERO.id, occidente: ENGATIVA.id, sur: ENGATIVA.id, oriente: CHAPINERO.id },
    1: { norte: CHAPINERO.id, occidente: CHAPINERO.id, sur: CHAPINERO.id, oriente: CHAPINERO.id },
  }
  for (const k of [4, 3, 2, 1] as BogotaK[]) {
    const got = CORREDORES.map(cor => competeForHospital(ipsPorCorredor[cor], KAMS, ADJACENCY, todas, rule(k))?.kam_id)
    const want = CORREDORES.map(cor => esperadoPorK[k][cor])
    check(`k = ${k}: ${CORREDORES.map((cor, i) => `${cor} -> ${nameOf(got[i])}`).join(', ')}`, got.join() === want.join(), `esperado ${want.map(nameOf).join(', ')}`)
  }

  const sinHuila = SEMILLA_CORREDORES.filter(f => f.department_code !== '41')
  const huila = competeForHospital(ipsPorCorredor.sur, KAMS, ADJACENCY, secondsFrom({ [CHAPINERO.id]: min(200), [SAN_CRISTOBAL.id]: min(180) }), rule(4, 240, sinHuila))
  check(
    'sin corredor: va a la celda de menor tiempo (San Cristóbal), bogota_corredor con corredor null',
    huila?.kam_id === SAN_CRISTOBAL.id && huila.assignment_type === 'bogota_corredor' && huila.motivo === 'sin_corredor' && huila.detail?.corredor === null,
    JSON.stringify(huila)
  )
  const sinKennedy = KAMS.filter(k => k.id !== KENNEDY.id)
  const surSinCelda = competeForHospital(ipsPorCorredor.sur, sinKennedy, ADJACENCY, todas, rule(4))
  check('celda del corredor no activa (Kennedy fuera): celda de menor tiempo con motivo celda_no_activa', surSinCelda?.kam_id === SAN_CRISTOBAL.id && surSinCelda.motivo === 'celda_no_activa')

  const empateA = competeForHospital(ipsPorCorredor.occidente, KAMS.map(k => (k.id === IBAGUE.id ? { ...k, priority: 3 } : k)), ADJACENCY, secondsFrom({ [ENGATIVA.id]: min(150), [IBAGUE.id]: min(150) }), rule(4))
  check('empate exacto Bogotá (150) vs Ibagué (150) con Ibagué prioridad 3 -> Ibagué', empateA?.kam_id === IBAGUE.id && empateA.assignment_type === 'competitive')
  const empateB = competeForHospital(ipsPorCorredor.occidente, KAMS, ADJACENCY, secondsFrom({ [ENGATIVA.id]: min(150), [IBAGUE.id]: min(150) }), rule(4))
  check('empate exacto Bogotá (150, prioridad 2) vs Ibagué (150, prioridad 1) -> Bogotá', empateB?.assignment_type === 'bogota_corredor' && empateB.kam_id === ENGATIVA.id)
  const empateC = competeForHospital(ipsPorCorredor.norte, KAMS, ADJACENCY, secondsFrom({ [KENNEDY.id]: min(150), [BUCARAMANGA.id]: min(150) }), rule(4))
  check('empate exacto con igual prioridad: el primero por nombre (Bucaramanga antes que las celdas)', empateC?.kam_id === BUCARAMANGA.id)

  const narino = hospital('narino-ips', '52356')
  const n = competeForHospital(narino, KAMS, ADJACENCY, secondsFrom({ [CHAPINERO.id]: min(10), [PASTO.id]: min(120) }), rule(4))
  check('Bogotá no elegible (Nariño fuera de N1/N2): no hay candidato Bogotá aunque haya distancia', n?.kam_id === PASTO.id && n.assignment_type === 'competitive')
  const otraZona = competeForHospital(ipsPorCorredor.sur, KAMS, ADJACENCY, secondsFrom({ [KENNEDY.id]: min(120), [NEIVA.id]: min(60) }), rule(4))
  check('otra zona más cercana que Bogotá gana como siempre (Neiva 60 vs Bogotá 120)', otraZona?.kam_id === NEIVA.id && otraZona.assignment_type === 'competitive')
  const bogotaSinLocalidad = hospital('bog-sin-localidad', '11001')
  const sl = competeForHospital(bogotaSinLocalidad, KAMS, ADJACENCY, secondsFrom({ [CHAPINERO.id]: min(30), [ENGATIVA.id]: min(20) }), rule(4))
  check('IPS con department_id 11 (Bogotá): regla de siempre, sin candidato virtual', sl?.kam_id === ENGATIVA.id && sl.assignment_type === 'competitive')
  check('BOGOTA_VIRTUAL_ID nunca se devuelve como zona', ![a, aOcc, c, c2, huila, empateB].some(x => x?.kam_id === BOGOTA_VIRTUAL_ID))
}

// ---------------------------------------------------------------------------
// 5. Clase completa en memoria: Teusaquillo, forzadas, territorio base y detail
// ---------------------------------------------------------------------------

async function runClass(hospitals: AlgorithmHospital[], distances: DistanceRecord[], bogota: BogotaRuleInput | null, forced: ForcedAssignment[] = [], kams = KAMS): Promise<Assignment[]> {
  const algorithm = new SimplifiedOpMapAlgorithm()
  algorithm.loadFromData({ kams, hospitals, excludedDepartments: EXCLUDED, distances, adjacency: ADJACENCY, forcedAssignments: forced, bogota })
  const originalLog = console.log
  console.log = () => {}
  try {
    return await algorithm.calculateAssignments()
  } finally {
    console.log = originalLog
  }
}

const dist = (hospital_id: string, k: AlgorithmKam, minutes: number): DistanceRecord => ({ hospital_id, kam_id: k.id, travel_time: min(minutes) })

async function seccionClase() {
  print('')
  print('5. Clase SimplifiedOpMapAlgorithm en memoria (loadFromData, sin base de datos)')

  // Teusaquillo (1100113): 15 IPS; Chapinero es la más cercana a 14 y San Cristóbal a 1.
  const teusaquillo: AlgorithmHospital[] = Array.from({ length: 15 }, (_, i) =>
    hospital(`teu-${i + 1}`, '11001', { department_id: '11', locality_id: '1100113', name: `IPS Teusaquillo ${i + 1}` })
  )
  const distances: DistanceRecord[] = []
  teusaquillo.forEach((h, i) => {
    const sanCristobalGana = i === 14
    distances.push(dist(h.id, CHAPINERO, sanCristobalGana ? 25 : 12))
    distances.push(dist(h.id, SAN_CRISTOBAL, sanCristobalGana ? 15 : 30))
    distances.push(dist(h.id, ENGATIVA, 40), dist(h.id, KENNEDY, 45))
    distances.push(dist(h.id, IBAGUE, 1)) // una zona de fuera "más cercana" no puede invadir Bogotá
  })
  const chapineroBase = hospital('chapinero-base', '11001', { department_id: '11', locality_id: '1100102' })
  const pereiraBase = hospital('pereira-base', '66001')
  const tunja = hospital('tunja', '15001')
  distances.push(dist(tunja.id, ENGATIVA, 200), dist(tunja.id, CHAPINERO, 215), dist(tunja.id, PEREIRA, 230))
  const villavo = hospital('villavicencio-1', '50001')
  distances.push(dist(villavo.id, SAN_CRISTOBAL, 464), dist(villavo.id, KENNEDY, 470))
  const lejos = hospital('barranca', '68081')
  distances.push(dist(lejos.id, CHAPINERO, 273), dist(lejos.id, ENGATIVA, 271))
  const forced: ForcedAssignment[] = [
    { territory_id: '50001', territory_type: 'municipality', territory_name: 'Villavicencio', kam_id: SAN_CRISTOBAL.id, active: true },
  ]
  const all = [...teusaquillo, chapineroBase, pereiraBase, tunja, villavo, lejos]

  const conRegla = await runClass(all, distances, rule(4), forced)
  const sinRegla = await runClass(all, distances, null, forced)
  const by = (list: Assignment[]) => new Map(list.map(x => [x.hospital_id, x]))
  const A = by(conRegla)
  const L = by(sinRegla)

  const teuA = teusaquillo.map(h => A.get(h.id))
  check(
    'sectores: Teusaquillo (sector Occidente) → las 15 IPS a Engativá aunque Chapinero llegue antes (bogota_corredor, 40 min)',
    teuA.every(x => x?.kam_id === ENGATIVA.id && x.assignment_type === 'bogota_corredor' && JSON.stringify(x.detail) === JSON.stringify({ corredor: 'occidente', localidad: '1100113' })) &&
      A.get('teu-15')?.travel_time === min(40),
    teuA.map(x => `${nameOf(x?.kam_id)}:${x?.assignment_type}`).join(', ')
  )
  const teuL = teusaquillo.map(h => L.get(h.id))
  check(
    'd. sin regla de Bogotá, la de siempre: Teusaquillo en Chapinero por mayoría (14 competitive + 1 majority_rule)',
    teuL.every(x => x?.kam_id === CHAPINERO.id) &&
      teuL.filter(x => x?.assignment_type === 'competitive').length === 14 &&
      teuL.filter(x => x?.assignment_type === 'majority_rule').length === 1 &&
      L.get('teu-15')?.travel_time === min(25),
    teuL.map(x => `${nameOf(x?.kam_id)}:${x?.assignment_type}`).join(', ')
  )
  check(
    'sectores: la localidad de Chapinero es del sector Oriente → San Cristóbal, no el territorio base de la celda del Norte',
    A.get(chapineroBase.id)?.kam_id === SAN_CRISTOBAL.id && A.get(chapineroBase.id)?.assignment_type === 'bogota_corredor' && A.get(chapineroBase.id)?.travel_time === null,
    JSON.stringify(A.get(chapineroBase.id))
  )
  check(
    'sin regla, territorio base de siempre (Chapinero en su localidad); Pereira en su municipio con y sin regla',
    L.get(chapineroBase.id)?.assignment_type === 'base_territory' && L.get(chapineroBase.id)?.kam_id === CHAPINERO.id &&
      A.get(pereiraBase.id)?.kam_id === PEREIRA.id && A.get(pereiraBase.id)?.travel_time === 0
  )
  check('forzada sin cambios: Villavicencio -> San Cristóbal (forced, 464 min) aunque supere el tope', A.get(villavo.id)?.assignment_type === 'forced' && A.get(villavo.id)?.kam_id === SAN_CRISTOBAL.id && A.get(villavo.id)?.travel_time === min(464))
  const t = A.get(tunja.id)
  check(
    'a. (clase) Tunja -> Chapinero por corredor Norte, assignment_type bogota_corredor con detail',
    t?.kam_id === CHAPINERO.id && t.assignment_type === 'bogota_corredor' && t.travel_time === min(215) &&
      JSON.stringify(t.detail) === JSON.stringify({ corredor: 'norte', bogota_min_segundos: min(200), celda_min: ENGATIVA.id }),
    JSON.stringify(t)
  )
  check('a. (clase) sin configuración Tunja sigue en Engativá (competitive, sin clave detail)', L.get(tunja.id)?.kam_id === ENGATIVA.id && L.get(tunja.id)?.assignment_type === 'competitive' && !('detail' in (L.get(tunja.id) ?? {})))
  check('b. (clase) 273 / 271 min: sin zona con la regla; en Chapinero (tope 360) sin ella', !A.has(lejos.id) && L.get(lejos.id)?.kam_id === CHAPINERO.id)
  const forcedLejos = await runClass(all, distances, rule(4), [...forced, { territory_id: '68081', territory_type: 'municipality', territory_name: 'Barrancabermeja', kam_id: KENNEDY.id, active: true }])
  check('b. (clase) "salvo asignación forzada": forzada a Kennedy, queda forced', forcedLejos.find(x => x.hospital_id === lejos.id)?.assignment_type === 'forced')
  check('solo las filas bogota_corredor llevan la clave detail (las demás se insertan como antes)', conRegla.every(x => ('detail' in x) === (x.assignment_type === 'bogota_corredor')))
}

// ---------------------------------------------------------------------------
// 5. Localidades de Bogotá sin IPS (el mapa las pinta con la celda de su corredor)
// ---------------------------------------------------------------------------

function seccionLocalidadesSinIps() {
  print('5. Localidades de Bogotá sin IPS: la celda de su corredor')

  const SIN_IPS = ['1100103', '1100105', '1100117', '1100120'] // Santa Fe, Usme, La Candelaria, Sumapaz
  check('Santa Fe, Usme, La Candelaria y Sumapaz son del sector Oriente', SIN_IPS.every(code => CORREDOR_DE_LOCALIDAD[code] === 'oriente'))
  check('CORREDOR_DE_LOCALIDAD: solo códigos de localidad de Bogotá (11001 + 2 dígitos)', Object.keys(CORREDOR_DE_LOCALIDAD).every(code => /^11001\d{2}$/.test(code)))

  const activas = new Set(CELDAS.map(c => c.id))
  const k4 = localidadesPorCorredor(config(4), activas)
  check(
    'k = 4 (Oriente → San Cristóbal): las cuatro van a San Cristóbal por el corredor Oriente; salen las 20 localidades',
    SIN_IPS.every(code => k4[code]?.kam_id === SAN_CRISTOBAL.id && k4[code]?.corredor === 'oriente') && Object.keys(k4).length === 20,
    JSON.stringify(k4)
  )
  const k2 = localidadesPorCorredor(config(2), activas)
  check('k = 2 (Norte + Oriente → Chapinero): las cuatro van a Chapinero', SIN_IPS.every(code => k2[code]?.kam_id === CHAPINERO.id), JSON.stringify(k2))
  check('sin configuración de Bogotá: ninguna (el mapa usa la regla anterior)', Object.keys(localidadesPorCorredor(null, activas)).length === 0)
  const sinSanCristobal = new Set([CHAPINERO.id, ENGATIVA.id, KENNEDY.id])
  const sinOriente = localidadesPorCorredor(config(4), sinSanCristobal)
  check(
    'celda del corredor inactiva o fuera de la asignación: esas no salen (no se pasa a otra celda); las demás sí',
    SIN_IPS.every(code => !(code in sinOriente)) && sinOriente['1100101']?.kam_id === CHAPINERO.id
  )
  const soloNorte = localidadesPorCorredor({ grupos: { norte: CHAPINERO.id } }, activas)
  check('corredor sin celda en grupos: no sale; solo Usaquén (Norte)', JSON.stringify(Object.keys(soloNorte)) === JSON.stringify(['1100101']), JSON.stringify(soloNorte))

  const existe = (kamId: string) => CELDAS.some(c => c.id === kamId)
  const porCorredor = { kam_id: SAN_CRISTOBAL.id, corredor: 'oriente' }
  check(
    'orden del mapa: el sector manda sobre la zona residente (Chapinero es Oriente aunque ahí viva la celda del Norte)',
    JSON.stringify(zonaDeLocalidadSinIps({ residente: CHAPINERO.id, porCorredor, ganadorBogota: ENGATIVA.id, existe })) ===
      JSON.stringify({ kam_id: SAN_CRISTOBAL.id, fuente: 'corredor', corredor: 'oriente' })
  )
  check(
    'orden del mapa: sin sector disponible, la zona residente',
    JSON.stringify(zonaDeLocalidadSinIps({ residente: CHAPINERO.id, porCorredor: undefined, ganadorBogota: ENGATIVA.id, existe })) ===
      JSON.stringify({ kam_id: CHAPINERO.id, fuente: 'residente' })
  )
  check(
    'orden del mapa: sin residente, el corredor manda sobre la Zona que gana Bogotá (el caso de Usme)',
    JSON.stringify(zonaDeLocalidadSinIps({ residente: undefined, porCorredor, ganadorBogota: ENGATIVA.id, existe })) ===
      JSON.stringify({ kam_id: SAN_CRISTOBAL.id, fuente: 'corredor', corredor: 'oriente' })
  )
  check(
    'orden del mapa: sin corredor, la Zona que gana Bogotá (regla anterior)',
    JSON.stringify(zonaDeLocalidadSinIps({ residente: null, porCorredor: undefined, ganadorBogota: ENGATIVA.id, existe })) ===
      JSON.stringify({ kam_id: ENGATIVA.id, fuente: 'bogota' })
  )
  check(
    'orden del mapa: corredor con una zona que el mapa no tiene, la Zona que gana Bogotá',
    zonaDeLocalidadSinIps({ residente: null, porCorredor: { kam_id: 'kam-borrada', corredor: 'oriente' }, ganadorBogota: ENGATIVA.id, existe })?.fuente === 'bogota'
  )
  check('orden del mapa: sin nada, null (pendiente)', zonaDeLocalidadSinIps({ residente: null, porCorredor: null, ganadorBogota: null, existe }) === null)

  // La celda del corredor sale del último recálculo (filas de municipality_zone), no de bogota_config.grupos
  const esCelda = (kamId: string) => CELDAS.some(c => c.id === kamId)
  const fila = (municipality_code: string, kam_id: string | null, kind = 'reach') => ({ municipality_code, kam_id, kind })
  const aplicadas = celdasAplicadasPorCorredor(
    [fila('25181', SAN_CRISTOBAL.id), fila('25845', SAN_CRISTOBAL.id), fila('50001', CHAPINERO.id, 'ips'), fila('15001', CHAPINERO.id)],
    SEMILLA_CORREDORES,
    esCelda
  )
  check(
    'celdas aplicadas: Oriente → la celda que más municipios del corredor recibieron (Choachí y Une: San Cristóbal; Villavicencio: Chapinero)',
    aplicadas.oriente === SAN_CRISTOBAL.id && aplicadas.norte === CHAPINERO.id,
    JSON.stringify(aplicadas)
  )
  check(
    'celdas aplicadas: no cuentan los fuera de alcance, los de zonas que no son celdas ni los municipios sin corredor (Bogotá)',
    Object.keys(
      celdasAplicadasPorCorredor(
        [fila('25181', null, 'out_of_reach'), fila('25845', 'kam-73001'), fila('11001', ENGATIVA.id, 'ips')],
        SEMILLA_CORREDORES,
        esCelda
      )
    ).length === 0
  )
  const empate = celdasAplicadasPorCorredor([fila('25181', SAN_CRISTOBAL.id), fila('25845', KENNEDY.id)], SEMILLA_CORREDORES, esCelda)
  check('celdas aplicadas: empate → el kam_id menor (determinista)', empate.oriente === [SAN_CRISTOBAL.id, KENNEDY.id].sort()[0], JSON.stringify(empate))
  check(
    'guardar Oriente → Chapinero sin recalcular no cambia las localidades: siguen con la celda del último recálculo',
    localidadesPorCorredor({ grupos: aplicadas }, activas)['1100105']?.kam_id === SAN_CRISTOBAL.id
  )

  // El mapa (lectura del código, sin red): las IPS asignadas mandan y los textos dicen "corredor"
  const componente = readFileSync(path.join(__dirname, '..', 'components', 'MapComponent.tsx'), 'utf8')
  const resolver = componente.slice(componente.indexOf('const resolveTerritory = useCallback'))
  const conIps = resolver.indexOf('territoriesWithIps.has(code)')
  check(
    'mapa: en resolveTerritory la mayoría de camas de las IPS va antes que la regla de la localidad sin IPS',
    conIps >= 0 && conIps < resolver.indexOf('zonaDeLocalidadSinIps(')
  )
  check(
    'mapa: el globo dice "(corredor …)" y solo sin corredor "(gana Bogotá)"',
    componente.includes("t.corredor ? ` (corredor ${corredorLabel(t.corredor) || t.corredor})` : t.bogotaInherited ? ' (gana Bogotá)' : ''")
  )
  check(
    'mapa: la tarjeta dice "va con la zona de su corredor de salida" antes del caso "gana Bogotá"',
    /if \(t\.corredor\) \{\s*title = `Zona \$\{zone\} · De alcance: localidad sin IPS hoy; va con la zona de su corredor de salida[^`]*`\s*\} else if \(t\.bogotaInherited\)/.test(componente)
  )
}

// ---------------------------------------------------------------------------
// 6. Bogotá en 4 sectores: cada localidad va a la celda del corredor de su sector
// ---------------------------------------------------------------------------

async function seccionSectores() {
  print('')
  print('6. Bogotá en 4 sectores (la localidad decide la celda dentro de Bogotá)')

  const SECTORES: Record<Corredor, string[]> = {
    norte: ['1100101'],
    occidente: ['1100109', '1100110', '1100111', '1100112', '1100113'],
    sur: ['1100106', '1100107', '1100108', '1100114', '1100115', '1100116', '1100119'],
    oriente: ['1100102', '1100103', '1100104', '1100105', '1100117', '1100118', '1100120'],
  }
  const esperado = Object.entries(SECTORES).flatMap(([corredor, codes]) => codes.map(code => `${code}:${corredor}`)).sort()
  const tabla = Object.entries(CORREDOR_DE_LOCALIDAD).map(([code, corredor]) => `${code}:${corredor}`).sort()
  check('la tabla tiene las 20 localidades con el sector aprobado (Norte 1, Occidente 5, Sur 7, Oriente 7)', JSON.stringify(tabla) === JSON.stringify(esperado), tabla.join(' '))

  const activas = new Set(CELDAS.map(c => c.id))
  const segundos = secondsFrom({ [CHAPINERO.id]: min(26), [ENGATIVA.id]: min(24), [SAN_CRISTOBAL.id]: min(30) })
  const usaquen = bogotaSectorCell({ locality_id: '1100101' }, rule(4), activas, segundos)
  check(
    'Usaquén (Norte) → celda del Norte (Chapinero) aunque Engativá llegue 2 minutos antes; tiempo real de esa celda',
    usaquen?.kam_id === CHAPINERO.id && usaquen.travel_time === min(26) && JSON.stringify(usaquen.detail) === JSON.stringify({ corredor: 'norte', localidad: '1100101' }),
    JSON.stringify(usaquen)
  )
  check('localidad de Chapinero (Oriente) → San Cristóbal', bogotaSectorCell({ locality_id: '1100102' }, rule(4), activas, segundos)?.kam_id === SAN_CRISTOBAL.id)
  check(
    'k = 2 (Norte + Oriente juntos): Usaquén y Chapinero a la misma celda',
    bogotaSectorCell({ locality_id: '1100101' }, rule(2), activas, segundos)?.kam_id === CHAPINERO.id &&
      bogotaSectorCell({ locality_id: '1100102' }, rule(2), activas, segundos)?.kam_id === CHAPINERO.id
  )
  check('sin regla de Bogotá: null (regla de siempre)', bogotaSectorCell({ locality_id: '1100101' }, null, activas, segundos) === null)
  check(
    'IPS sin localidad o con una que no es de la tabla: null',
    bogotaSectorCell({ locality_id: null }, rule(4), activas, segundos) === null && bogotaSectorCell({ locality_id: '1100199' }, rule(4), activas, segundos) === null
  )
  check('celda del sector inactiva: null', bogotaSectorCell({ locality_id: '1100101' }, rule(4), new Set([ENGATIVA.id, KENNEDY.id, SAN_CRISTOBAL.id]), segundos) === null)

  // Clase completa: Usaquén con Engativá 2 minutos más cerca (24 contra 26, el caso del dueño)
  const ips = (id: string, localidad: string) => hospital(id, '11001', { department_id: '11', locality_id: localidad })
  const usa = [ips('usa-1', '1100101'), ips('usa-2', '1100101')]
  const distancias: DistanceRecord[] = usa.flatMap(h => [dist(h.id, ENGATIVA, 24), dist(h.id, CHAPINERO, 26), dist(h.id, SAN_CRISTOBAL, 47), dist(h.id, KENNEDY, 44)])
  const conRegla = await runClass(usa, distancias, rule(4))
  check(
    'clase: las IPS de Usaquén van a la celda del Norte con la regla (bogota_corredor, 26 min)',
    conRegla.every(a => a.kam_id === CHAPINERO.id && a.assignment_type === 'bogota_corredor' && a.travel_time === min(26)),
    JSON.stringify(conRegla)
  )
  const sinRegla = await runClass(usa, distancias, null)
  check('clase: sin regla, a Engativá por 2 minutos (la regla de siempre)', sinRegla.every(a => a.kam_id === ENGATIVA.id && a.assignment_type === 'competitive'))
  const forzada = await runClass(usa, distancias, rule(4), [
    { territory_id: '1100101', territory_type: 'locality', territory_name: 'Usaquén', kam_id: KENNEDY.id, active: true },
  ])
  check('clase: una asignación forzada de la localidad sigue mandando', forzada.every(a => a.kam_id === KENNEDY.id && a.assignment_type === 'forced'))
  const sinChapinero = await runClass(usa, distancias, rule(4), [], KAMS.filter(k => k.id !== CHAPINERO.id))
  check('clase: con la celda del Norte inactiva, la regla de siempre (Engativá, competitive)', sinChapinero.every(a => a.kam_id === ENGATIVA.id && a.assignment_type === 'competitive'))

  // La asignación de una IPS nueva (lectura del código, sin red): forzada → sector → territorio base → competencia
  const ruta = readFileSync(path.join(__dirname, '..', 'app', 'api', 'hospitals', 'assign-to-kam', 'route.ts'), 'utf8')
  const forzadaEn = ruta.indexOf(".from('forced_assignments')")
  const sectorEn = ruta.indexOf('bogotaSectorCell(hospital')
  const baseEn = ruta.indexOf('kams.find(k => isBaseTerritory(k, hospital))')
  const competenciaEn = ruta.indexOf('competeForHospital(')
  check(
    'assign-to-kam: forzada, luego sector (bogotaSectorCell), luego territorio base y al final la competencia',
    forzadaEn >= 0 && forzadaEn < sectorEn && sectorEn < baseEn && baseEn < competenciaEn,
    JSON.stringify({ forzadaEn, sectorEn, baseEn, competenciaEn })
  )
}

async function main() {
  print('Bogotá como una ciudad · pruebas puras (sin red)')
  print('')
  seccionCorredores()
  seccionMotorPuro()
  seccionAceptacion()
  await seccionClase()
  seccionLocalidadesSinIps()
  await seccionSectores()
  print('')
  print(`Resultado: ${passed} OK, ${failed} con fallo`)
  if (failed > 0) process.exit(1)
}

main().catch(error => {
  process.stderr.write(`bogota-check: error inesperado: ${error instanceof Error ? error.stack : String(error)}\n`)
  process.exit(1)
})
