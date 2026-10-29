/**
 * PR 3 · Pruebas puras de la configuración "Bogotá hacia afuera" (lib/bogota-admin.ts): validación de lo
 * que guarda /kams, parámetros de la simulación, resumen de la simulación, fila "Bogotá" de la ficha y
 * su encaje con el motor (competeForHospital de lib/opmap-algorithm-simplified.ts). SIN red ni Supabase.
 *
 * Las reglas del motor (candidato "Bogotá", tope único, corredor) las prueba scripts/bogota-check.ts.
 *
 * Uso (desde web/): npx tsx scripts/corredores-config-check.ts   (o npm run corredores-config:check)
 * Código de salida 1 si alguna prueba falla.
 */
import {
  bogotaAssignmentLabel,
  bogotaDistanceAggregate,
  buildBogotaSimulationSummary,
  gruposDesdeReceptoras,
  isBogotaCellArea,
  nombreGrupo,
  parseSimulationQuery,
  receptorasDesdeGrupos,
  simulationQueryString,
  validateBogotaConfigInput,
  type SimAssignment,
} from '../lib/bogota-admin'
import { AGRUPACIONES_POR_K, SEMILLA_CORREDORES, type CorredorRow } from '../lib/bogota-corredores'
import { competeForHospital } from '../lib/opmap-algorithm-simplified'

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

// Celdas de Bogotá (ids ficticios) y una zona de fuera
const CHAPINERO = '00000000-0000-4000-8000-000000000102'
const ENGATIVA = '00000000-0000-4000-8000-000000000110'
const KENNEDY = '00000000-0000-4000-8000-000000000108'
const SAN_CRISTOBAL = '00000000-0000-4000-8000-000000000104'
const PEREIRA = '00000000-0000-4000-8000-000000066001'
const IBAGUE = '00000000-0000-4000-8000-000000073001'
const ACTIVE = new Set([CHAPINERO, ENGATIVA, KENNEDY, SAN_CRISTOBAL])
const K4 = { norte: CHAPINERO, occidente: ENGATIVA, sur: KENNEDY, oriente: SAN_CRISTOBAL }

console.log('\n1. Validación de la configuración (PUT /api/kams/bogota-config y simulación)')
{
  const ok = validateBogotaConfigInput({ k: 4, max_travel_minutes: 240, grupos: K4 }, ACTIVE)
  check('k = 4 con las cuatro celdas y tope 240 es válida', ok.ok && ok.value.k === 4 && ok.value.max_travel_minutes === 240, ok)

  const asText = validateBogotaConfigInput({ k: '2', max_travel_minutes: '300', grupos: { norte: CHAPINERO, oriente: CHAPINERO, occidente: KENNEDY, sur: KENNEDY } }, ACTIVE)
  check('acepta k y tope como texto (parámetros de la URL)', asText.ok && asText.value.k === 2 && asText.value.max_travel_minutes === 300, asText)

  for (const k of [0, 5, 2.5, 'x', null]) {
    const r = validateBogotaConfigInput({ k, max_travel_minutes: 240, grupos: K4 }, ACTIVE)
    check(`rechaza k = ${JSON.stringify(k)}`, !r.ok && r.errors.some(e => e.includes('(k)')), r)
  }
  for (const max of [59, 601, 240.5, '', null, 'abc']) {
    const r = validateBogotaConfigInput({ k: 4, max_travel_minutes: max, grupos: K4 }, ACTIVE)
    check(`rechaza tope = ${JSON.stringify(max)}`, !r.ok && r.errors.some(e => e.includes('entre 60 y 600')), r)
  }
  const bordes = [60, 600].map(max => validateBogotaConfigInput({ k: 4, max_travel_minutes: max, grupos: K4 }, ACTIVE).ok)
  check('acepta los bordes 60 y 600', bordes.every(Boolean), bordes)

  const inactive = validateBogotaConfigInput({ k: 4, max_travel_minutes: 240, grupos: { ...K4, sur: PEREIRA } }, ACTIVE)
  check('rechaza una celda que no es zona activa de Bogotá', !inactive.ok && inactive.errors.some(e => e.includes('corredor Sur')), inactive)

  const missing = validateBogotaConfigInput({ k: 4, max_travel_minutes: 240, grupos: { norte: CHAPINERO } }, ACTIVE)
  check('rechaza corredores sin celda', !missing.ok && missing.errors.length === 3, missing)

  const unknown = validateBogotaConfigInput({ k: 4, max_travel_minutes: 240, grupos: { ...K4, centro: CHAPINERO } }, ACTIVE)
  check('rechaza un corredor desconocido', !unknown.ok && unknown.errors.some(e => e.includes('"centro"')), unknown)

  const k2Mixed = validateBogotaConfigInput({ k: 2, max_travel_minutes: 240, grupos: K4 }, ACTIVE)
  check('k = 2 exige Norte y Oriente en la misma zona (y Occidente y Sur)', !k2Mixed.ok && k2Mixed.errors.some(e => e.includes('misma celda')), k2Mixed)

  const k4Dup = validateBogotaConfigInput({ k: 4, max_travel_minutes: 240, grupos: { ...K4, sur: ENGATIVA } }, ACTIVE)
  check('k = 4 exige cuatro zonas distintas', !k4Dup.ok && k4Dup.errors.some(e => e.includes('4 celdas distintas')), k4Dup)

  const k1 = validateBogotaConfigInput({ k: 1, max_travel_minutes: 240, grupos: { norte: KENNEDY, occidente: KENNEDY, sur: KENNEDY, oriente: KENNEDY } }, ACTIVE)
  check('k = 1 con los cuatro corredores a una zona es válida', k1.ok, k1)

  const notObject = validateBogotaConfigInput(null, ACTIVE)
  check('rechaza un cuerpo vacío', !notObject.ok, notObject)
}

console.log('\n2. Parámetros de la simulación y grupos de la tarjeta')
{
  check('sin parámetros → null (se simula la configuración guardada)', parseSimulationQuery(new URLSearchParams('')) === null)
  const config = { k: 4 as const, max_travel_minutes: 240, grupos: K4 }
  const parsed = parseSimulationQuery(new URLSearchParams(simulationQueryString(config)))
  const roundTrip = validateBogotaConfigInput(parsed, ACTIVE)
  check('simulationQueryString → parseSimulationQuery → validación da la misma configuración',
    roundTrip.ok && JSON.stringify(roundTrip.value) === JSON.stringify(config), roundTrip)

  const g2 = gruposDesdeReceptoras(2, [CHAPINERO, ENGATIVA])
  check('k = 2: el grupo Norte y Oriente va a la primera zona elegida',
    g2.norte === CHAPINERO && g2.oriente === CHAPINERO && g2.occidente === ENGATIVA && g2.sur === ENGATIVA, g2)
  const g3 = gruposDesdeReceptoras(3, [CHAPINERO, ENGATIVA, KENNEDY])
  check('k = 3: Sur y Oriente comparten zona', g3.sur === KENNEDY && g3.oriente === KENNEDY && g3.norte === CHAPINERO, g3)
  check('receptorasDesdeGrupos es el inverso para k = 2', JSON.stringify(receptorasDesdeGrupos(2, g2)) === JSON.stringify([CHAPINERO, ENGATIVA]))
  check('cada grupo de k = 1..4 cubre los cuatro corredores una sola vez',
    ([1, 2, 3, 4] as const).every(k => AGRUPACIONES_POR_K[k].flat().sort().join() === 'norte,occidente,oriente,sur'))
  check('nombres de grupo para la tarjeta',
    nombreGrupo(['norte']) === 'Norte' && nombreGrupo(['norte', 'oriente']) === 'Norte y Oriente' &&
    nombreGrupo(['norte', 'occidente', 'sur', 'oriente']) === 'Los cuatro corredores')
  check('isBogotaCellArea: solo localidades 11001xx',
    isBogotaCellArea('1100102') && !isBogotaCellArea('11001') && !isBogotaCellArea('66001') && !isBogotaCellArea(null))
}

console.log('\n3. Encaje con el motor: la configuración de la tarjeta decide la celda (competeForHospital)')
{
  const kams = [
    { id: CHAPINERO, area_id: '1100102', enable_level2: true, max_travel_time: 360, priority: 2 },
    { id: ENGATIVA, area_id: '1100110', enable_level2: true, max_travel_time: 240, priority: 2 },
    { id: KENNEDY, area_id: '1100108', enable_level2: true, max_travel_time: 240, priority: 2 },
    { id: SAN_CRISTOBAL, area_id: '1100104', enable_level2: true, max_travel_time: 240, priority: 2 },
  ]
  const adjacency = { '25': ['50', '15', '73'], '50': ['25'], '11': ['25'] }
  const meta = { department_id: '50', municipality_id: '50001', locality_id: null }
  const times: Record<string, number> = { [CHAPINERO]: 120 * 60, [ENGATIVA]: 125 * 60, [KENNEDY]: 110 * 60, [SAN_CRISTOBAL]: 100 * 60 }
  const corredores: CorredorRow[] = [...SEMILLA_CORREDORES]

  const v2 = validateBogotaConfigInput({ k: 2, max_travel_minutes: 240, grupos: gruposDesdeReceptoras(2, [CHAPINERO, ENGATIVA]) }, ACTIVE)
  if (!v2.ok) throw new Error('config k = 2 inválida en la prueba')
  const out2 = competeForHospital(meta, kams, adjacency, id => times[id] ?? null, { config: v2.value, corredores })
  check('k = 2: IPS del Meta (corredor Oriente) va a la zona del grupo Norte y Oriente',
    out2?.kam_id === CHAPINERO && out2?.assignment_type === 'bogota_corredor' && out2?.detail?.corredor === 'oriente', out2)
  check('travel_time guardado = tiempo real de esa zona (no el mínimo de Bogotá)', out2?.travel_time === 120 * 60, out2)
  check('detail guarda el mínimo de Bogotá y la zona que lo tiene',
    out2?.detail?.bogota_min_segundos === 100 * 60 && out2?.detail?.celda_min === SAN_CRISTOBAL, out2?.detail)

  const v4 = validateBogotaConfigInput({ k: 4, max_travel_minutes: 240, grupos: K4 }, ACTIVE)
  if (!v4.ok) throw new Error('config k = 4 inválida en la prueba')
  const out4 = competeForHospital(meta, kams, adjacency, id => times[id] ?? null, { config: v4.value, corredores })
  check('k = 4: la misma IPS va a San Cristóbal (corredor Oriente)', out4?.kam_id === SAN_CRISTOBAL, out4)
}

console.log('\n4. Resumen de la simulación')
{
  const cells = [
    { id: CHAPINERO, name: 'Chapinero', base_city: 'Chapinero', area_id: '1100102', max_travel_time: 360 },
    { id: ENGATIVA, name: 'Engativá', base_city: 'Engativá', area_id: '1100110', max_travel_time: 240 },
    { id: KENNEDY, name: 'Kennedy', base_city: 'Kennedy', area_id: '1100108', max_travel_time: 240 },
    { id: SAN_CRISTOBAL, name: 'San Cristóbal', base_city: 'San Cristóbal', area_id: '1100104', max_travel_time: 240 },
  ]
  const zones = [{ id: PEREIRA, name: 'Pereira' }, { id: IBAGUE, name: 'KAM Ibagué' }]
  const h = (id: string, municipality_id: string, department_id: string, locality_id: string | null = null) => ({
    id, code: id, name: `IPS ${id}`, municipality_id, department_id, locality_id,
    municipality_name: `Mun ${municipality_id}`, department_name: `Dep ${department_id}`,
  })
  const hospitals = [
    h('h1', '73001', '73'), h('h2', '15001', '15'), h('h3', '17001', '17'), h('h4', '73268', '73'),
    h('h5', '99001', '99'), h('h6', '11001', '11', '1100102'),
    h('v1', '50001', '50'), h('v2', '50001', '50'), h('y1', '85001', '85'),
  ]
  const before: SimAssignment[] = [
    { hospital_id: 'h1', kam_id: CHAPINERO, travel_time: 215 * 60, assignment_type: 'competitive' },
    { hospital_id: 'h2', kam_id: CHAPINERO, travel_time: 273 * 60, assignment_type: 'competitive' },
    { hospital_id: 'h3', kam_id: PEREIRA, travel_time: 100 * 60, assignment_type: 'competitive' },
    { hospital_id: 'h4', kam_id: PEREIRA, travel_time: 150 * 60, assignment_type: 'competitive' },
    { hospital_id: 'h6', kam_id: CHAPINERO, travel_time: 0, assignment_type: 'base_territory' },
    { hospital_id: 'v1', kam_id: SAN_CRISTOBAL, travel_time: 470 * 60, assignment_type: 'forced' },
    { hospital_id: 'v2', kam_id: SAN_CRISTOBAL, travel_time: 470 * 60, assignment_type: 'forced' },
    { hospital_id: 'y1', kam_id: KENNEDY, travel_time: 420 * 60, assignment_type: 'forced' },
  ]
  const after: SimAssignment[] = [
    { hospital_id: 'h1', kam_id: ENGATIVA, travel_time: 200 * 60, assignment_type: 'bogota_corredor', detail: { corredor: 'occidente', bogota_min_segundos: 200 * 60, celda_min: ENGATIVA } },
    { hospital_id: 'h3', kam_id: CHAPINERO, travel_time: 95 * 60, assignment_type: 'bogota_corredor', detail: { corredor: 'norte', bogota_min_segundos: 90 * 60, celda_min: KENNEDY } },
    { hospital_id: 'h4', kam_id: IBAGUE, travel_time: 60 * 60, assignment_type: 'competitive' },
    { hospital_id: 'h5', kam_id: KENNEDY, travel_time: 230 * 60, assignment_type: 'bogota_corredor', detail: { corredor: null, bogota_min_segundos: 230 * 60, celda_min: KENNEDY } },
    { hospital_id: 'h6', kam_id: CHAPINERO, travel_time: 0, assignment_type: 'base_territory' },
    { hospital_id: 'v1', kam_id: SAN_CRISTOBAL, travel_time: 470 * 60, assignment_type: 'forced' },
    { hospital_id: 'v2', kam_id: SAN_CRISTOBAL, travel_time: 470 * 60, assignment_type: 'forced' },
    { hospital_id: 'y1', kam_id: KENNEDY, travel_time: 420 * 60, assignment_type: 'forced' },
  ]
  const forced = [
    { territory_id: '50001', territory_name: 'Villavicencio', kam_id: SAN_CRISTOBAL, active: true },
    { territory_id: '50001', territory_name: 'Villavicencio', kam_id: SAN_CRISTOBAL, active: false },
    { territory_id: '85001', territory_name: 'Yopal', kam_id: KENNEDY, active: true },
    { territory_id: '66001', territory_name: 'Pereira', kam_id: PEREIRA, active: true },
  ]
  const s = buildBogotaSimulationSummary({
    propuesta: { k: 4, max_travel_minutes: 240, grupos: K4 },
    cells, zones, hospitals, before, after, forced, corredores: [...SEMILLA_CORREDORES],
  })
  const tipoDe = (id: string) => s.cambios.find(c => c.hospital_id === id)?.tipo
  check('h1 cambia de celda (Chapinero → Engativá por corredor Occidente)', tipoDe('h1') === 'cambia_celda', s.cambios)
  check('h1 lleva el corredor en el lado "después"', s.cambios.find(c => c.hospital_id === 'h1')?.despues?.corredor === 'occidente')
  check('h3 entra a Bogotá desde Pereira', tipoDe('h3') === 'entra_a_bogota')
  check('h5 gana zona (antes sin asignar)', tipoDe('h5') === 'gana_zona')
  check('h2 queda fuera de alcance (antes Chapinero a 4 h 33, después nadie)',
    s.fuera_de_alcance.length === 1 && s.fuera_de_alcance[0].hospital_id === 'h2' && s.fuera_de_alcance[0].antes?.minutos === 273, s.fuera_de_alcance)
  check('h4 (Pereira → Ibagué) no es efecto de Bogotá: solo cuenta en otros_cambios', s.totales.otros_cambios === 1 && tipoDe('h4') === undefined, s.totales)
  check('IPS sin cambio (h6 y forzadas) no aparecen', !['h6', 'v1', 'v2', 'y1'].some(id => tipoDe(id)))
  check('sin corredor: h5', s.sin_corredor.length === 1 && s.sin_corredor[0].hospital_id === 'h5', s.sin_corredor)
  check('por corredor: Norte 1, Occidente 1, Sur 0, Oriente 0',
    s.totales.por_corredor.norte === 1 && s.totales.por_corredor.occidente === 1 && s.totales.por_corredor.sur === 0 && s.totales.por_corredor.oriente === 0, s.totales.por_corredor)
  const cell = (id: string) => s.celdas.find(c => c.kam_id === id)
  check('Chapinero: antes 3, después 2 (−1)', cell(CHAPINERO)?.antes === 3 && cell(CHAPINERO)?.despues === 2 && cell(CHAPINERO)?.diferencia === -1, cell(CHAPINERO))
  check('Engativá: antes 0, después 1', cell(ENGATIVA)?.antes === 0 && cell(ENGATIVA)?.despues === 1, cell(ENGATIVA))
  check('Kennedy después por tipo: 1 forzada + 1 bogota_corredor',
    cell(KENNEDY)?.despues_por_tipo.forced === 1 && cell(KENNEDY)?.despues_por_tipo.bogota_corredor === 1, cell(KENNEDY))
  check('cada celda dice qué corredores recibe', cell(SAN_CRISTOBAL)?.corredores.join() === 'oriente' && cell(CHAPINERO)?.tope_actual_min === 360)
  check('forzadas: solo las de celdas de Bogotá, una por territorio activo', s.forzadas.length === 2, s.forzadas)
  const villavicencio = s.forzadas.find(f => f.territory_id === '50001')
  const yopal = s.forzadas.find(f => f.territory_id === '85001')
  check('Villavicencio (Meta → Oriente → San Cristóbal) coincide con la forzada; 2 IPS',
    villavicencio?.corredor === 'oriente' && villavicencio?.coincide === true && villavicencio?.ips === 2, villavicencio)
  check('Yopal (Casanare → Oriente → San Cristóbal) NO coincide con la forzada a Kennedy',
    yopal?.corredor === 'oriente' && yopal?.coincide === false && yopal?.celda_por_corredor?.kam_id === SAN_CRISTOBAL && yopal?.celda_forzada.nombre === 'Kennedy', yopal)
  check('nombres de zona sin el prefijo KAM', s.cambios.every(c => !/KAM/.test(`${c.antes?.zona} ${c.despues?.zona}`)))

  // Sectores (2026-10-28): una IPS de Bogotá asignada por el sector de su localidad (detail.localidad) es
  // 'bogota_corredor', pero NO es algo que Bogotá gane afuera
  const usaquen = { id: 'u1', code: 'u1', name: 'IPS Usaquén', department_id: '11', municipality_id: '11001', locality_id: '1100101' }
  const conSector = buildBogotaSimulationSummary({
    propuesta: { k: 4, max_travel_minutes: 240, grupos: K4 },
    cells, zones, hospitals: [...hospitals, usaquen],
    before: [...before, { hospital_id: 'u1', kam_id: ENGATIVA, travel_time: 24 * 60, assignment_type: 'competitive' }],
    after: [...after, { hospital_id: 'u1', kam_id: CHAPINERO, travel_time: 26 * 60, assignment_type: 'bogota_corredor', detail: { corredor: 'norte', localidad: '1100101' } }],
    forced: [...forced, { territory_id: '1100101', territory_name: 'Usaquén', kam_id: KENNEDY, active: true }],
    corredores: [...SEMILLA_CORREDORES],
  })
  check(
    'sectores: la IPS de Usaquén cuenta en por_sector (Norte 1), no en por_corredor ni en sin corredor',
    conSector.totales.por_sector.norte === 1 && conSector.totales.por_corredor.norte === 1 && conSector.totales.sin_corredor === 1,
    conSector.totales
  )
  const u1 = conSector.cambios.find(c => c.hospital_id === 'u1')
  check('sectores: el cambio de Usaquén lleva "sector", no "corredor"', u1?.despues?.sector === 'norte' && u1?.despues?.corredor === undefined, u1)
  const forzadaUsaquen = conSector.forzadas.find(f => f.territory_id === '1100101')
  check(
    'sectores: una forzada de una localidad compara con la celda de su sector (Usaquén → Norte → Chapinero)',
    forzadaUsaquen?.corredor === 'norte' && forzadaUsaquen?.celda_por_corredor?.kam_id === CHAPINERO && forzadaUsaquen?.coincide === false,
    forzadaUsaquen
  )
}

console.log('\n5. Ficha de la IPS: fila "Bogotá" y texto del corredor')
{
  const rows = [
    { kam_id: PEREIRA, travel_time: 230 * 60, area_id: '66001' },
    { kam_id: ENGATIVA, travel_time: 271 * 60, area_id: '1100110' },
    { kam_id: CHAPINERO, travel_time: 273 * 60, area_id: '1100102' },
  ]
  const agg = bogotaDistanceAggregate(rows, '15', 240)
  check('mejor tiempo entre las celdas (Engativá 4 h 31) y fuera del tope único 240',
    agg?.min_seconds === 271 * 60 && agg?.celda_min === ENGATIVA && agg?.over_limit === true && agg?.max_travel_minutes === 240, agg)
  check('IPS en Bogotá: sin fila agregada', bogotaDistanceAggregate(rows, '11', 240) === null)
  check('sin configuración: sin fila agregada', bogotaDistanceAggregate(rows, '15', null) === null)
  check('sin celdas con distancia: sin fila agregada', bogotaDistanceAggregate([rows[0]], '15', 240) === null)
  check('texto "Bogotá (corredor Norte) → Chapinero"', bogotaAssignmentLabel('norte', 'Chapinero') === 'Bogotá (corredor Norte) → Chapinero')
  check('texto sin corredor', bogotaAssignmentLabel(null, 'Kennedy').startsWith('Bogotá (sin corredor'))
  check(
    'texto de una IPS de Bogotá asignada por su sector: "Bogotá, sector Norte → Bogotá Norte"',
    bogotaAssignmentLabel('norte', 'Bogotá Norte', '1100101') === 'Bogotá, sector Norte → Bogotá Norte'
  )
}

console.log(`\n${passed} pruebas OK, ${failed} fallidas`)
if (failed > 0) process.exit(1)
