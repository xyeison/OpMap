/**
 * Motor de municipios (Fase 2b) con Bogotá como UNA ciudad hacia afuera · pruebas puras (SIN RED, sin
 * Supabase, sin Google). Decisión del dueño: docs/decisiones/2026-10-28-municipios-por-corredor-de-bogota.md
 * Spec: docs/specs/2026-10-28-municipios-regla-bogota.md
 *
 * Cubre computeMunicipalityZones (lib/municipality-coverage.ts) con datos en memoria:
 *  1. Puerto Gaitán y San Carlos de Guaroa (Meta, corredor oriente): con la regla van a San Cristóbal (la
 *     celda del corredor) con el tope único de Bogotá; sin regla se reproduce el error anterior (Chapinero,
 *     por su propio tope de 360 min).
 *  2. El corredor decide la celda aunque otra celda sea más rápida (Boyacá → Chapinero; Fusagasugá → Kennedy).
 *  3. "Bogotá" compite con las demás zonas con su mejor tiempo; empates por prioridad.
 *  4. Sin corredor o con la celda del corredor inactiva: la celda más rápida. k = 2 usa los grupos.
 *  5. Fuera de alcance: la más cercana es la celda del corredor. Pendiente, sin acceso terrestre, Bogotá
 *     misma (departamento 11), municipios con IPS y municipios base: sin cambios.
 *  6. Coherencia con el algoritmo de IPS (competeForHospital) con los mismos tiempos.
 *
 * Uso (desde web/): npx tsx scripts/municipios-check.ts   (incluida en npm run test)
 * Código de salida 1 si alguna prueba falla.
 */
import {
  buildDryRunReport,
  computeMunicipalityZones,
  symmetricAdjacency,
  type AssignedHospitalInput,
  type MunicipalityInput,
  type MunicipalityInputs,
  type MunicipalityZoneInput,
  type MunicipalityZoneRow,
  type TravelTimeInput,
} from '../lib/municipality-coverage'
import { competeForHospital, type BogotaRuleInput } from '../lib/opmap-algorithm-simplified'
import type { BogotaConfig, CorredorRow } from '../lib/bogota-corredores'

for (const key of ['SUPABASE_SERVICE_ROLE_KEY', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_URL', 'GOOGLE_MAPS_API_KEY']) {
  delete process.env[key]
}
process.env.GOOGLE_ROUTES_DISABLED = 'true'
globalThis.fetch = (async () => {
  throw new Error('municipios-check: la red está prohibida en estas pruebas')
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

/** Compara kind, zona y minutos de una fila con lo esperado. */
function checkRow(
  name: string,
  row: MunicipalityZoneRow | undefined,
  expected: Partial<Pick<MunicipalityZoneRow, 'kind' | 'kam_id' | 'travel_minutes' | 'nearest_kam_id' | 'nearest_minutes'>>
) {
  const actual = row
    ? Object.fromEntries(Object.keys(expected).map(key => [key, row[key as keyof MunicipalityZoneRow]]))
    : null
  check(name, actual !== null && JSON.stringify(actual) === JSON.stringify(expected), `esperado ${JSON.stringify(expected)}, obtenido ${JSON.stringify(actual)}`)
}

// ---------------------------------------------------------------------------
// Datos en memoria (ids cortos; tiempos en MINUTOS como en municipality_travel_times)
// ---------------------------------------------------------------------------

function zona(id: string, name: string, areaId: string, maxMinutes: number, extra: Partial<MunicipalityZoneInput> = {}): MunicipalityZoneInput {
  return {
    id,
    name,
    base_city: null,
    area_id: areaId,
    lat: 4.6,
    lng: -74.1,
    max_travel_time: maxMinutes,
    priority: 2,
    enable_level2: true,
    active: true,
    participates_in_assignment: true,
    ...extra,
  }
}

// Las cuatro celdas de Bogotá como en producción (Chapinero con tope propio de 360, las demás 240)
const ZONAS: MunicipalityZoneInput[] = [
  zona('cha', 'Chapinero', '1100102', 360),
  zona('eng', 'Engativá', '1100110', 240),
  zona('ken', 'Kennedy', '1100108', 240),
  zona('scr', 'San Cristóbal', '1100104', 240),
  zona('iba', 'Ibagué', '73001', 240, { enable_level2: false }),
  zona('nei', 'Neiva', '41001', 240, { enable_level2: false }),
]

// Bogotá (11) limita con Cundinamarca (25); Cundinamarca con Boyacá (15), Meta (50), Tolima (73) y Huila (41)
const ADYACENCIA = symmetricAdjacency(
  [
    ['11', '25'],
    ['25', '15'],
    ['25', '50'],
    ['25', '73'],
    ['25', '41'],
    ['50', '41'],
    ['73', '41'],
  ].map(([a, b]) => ({ department_code: a, adjacent_department_code: b }))
)

const CORREDORES: CorredorRow[] = [
  { department_code: '15', municipality_code: null, corredor: 'norte' },
  { department_code: '50', municipality_code: null, corredor: 'oriente' },
  { department_code: '73', municipality_code: null, corredor: 'occidente' },
  { department_code: '41', municipality_code: null, corredor: 'sur' },
  { department_code: '25', municipality_code: '25290', corredor: 'sur' }, // Fusagasugá
]

const GRUPOS_K4: BogotaConfig['grupos'] = { norte: 'cha', occidente: 'eng', sur: 'ken', oriente: 'scr' }

function regla(maxMinutes: number, extra: Partial<BogotaConfig> = {}): BogotaRuleInput {
  return { config: { k: 4, max_travel_minutes: maxMinutes, grupos: GRUPOS_K4, ...extra }, corredores: CORREDORES }
}

const municipio = (code: string, name: string): MunicipalityInput => ({
  code,
  name,
  department_code: code.substring(0, 2),
  lat: 4,
  lng: -73,
})

const MUNICIPIOS: MunicipalityInput[] = [
  municipio('50568', 'Puerto Gaitán'),
  municipio('50680', 'San Carlos de Guaroa'),
  municipio('15999', 'Municipio del norte (Boyacá)'),
  municipio('15998', 'Norte sin ruta desde Chapinero'),
  municipio('15997', 'Norte sin carretera'),
  municipio('73999', 'Tolima, Bogotá más rápida'),
  municipio('73998', 'Tolima, Ibagué más rápida'),
  municipio('73997', 'Tolima, empate con Ibagué'),
  municipio('25290', 'Fusagasugá'),
  municipio('25999', 'Cundinamarca sin corredor'),
  municipio('11001', 'Bogotá D.C. (sin IPS en la prueba)'),
  municipio('50999', 'Meta con IPS'),
  municipio('73001', 'Ibagué'),
]

type Tiempo = number | 'no_route'

// Pares ya calculados (los que faltan quedan sin fila: el motor deja 'pending')
const TIEMPOS: Record<string, Record<string, Tiempo>> = {
  '50568': { scr: 333, ken: 340, cha: 355, eng: 362, nei: 500 },
  '50680': { scr: 241, ken: 250, cha: 263, eng: 270, nei: 400 },
  '15999': { eng: 100, cha: 110, scr: 120, ken: 130 },
  '15998': { cha: 'no_route', eng: 100, ken: 120, scr: 130 },
  '15997': { cha: 'no_route', eng: 'no_route', ken: 'no_route', scr: 'no_route' },
  '73999': { eng: 140, ken: 145, iba: 150, cha: 160, scr: 170, nei: 300 },
  '73998': { iba: 130, eng: 140, ken: 145, cha: 160, scr: 170, nei: 300 },
  '73997': { iba: 140, eng: 140, ken: 150, cha: 160, scr: 170, nei: 300 },
  '25290': { eng: 60, ken: 70, scr: 75, cha: 90, iba: 200, nei: 260 },
  '25999': { eng: 45, cha: 50, scr: 55, ken: 60, iba: 210, nei: 300 },
  '11001': { cha: 300, eng: 250, ken: 260, scr: 255 },
  '50999': { scr: 200, ken: 210, cha: 220, eng: 230, nei: 400 },
}

function travelTimes(tiempos: Record<string, Record<string, Tiempo>>): TravelTimeInput[] {
  return Object.entries(tiempos).flatMap(([code, pares]) =>
    Object.entries(pares).map(([kamId, value]) => ({
      kam_id: kamId,
      municipality_code: code,
      travel_minutes: value === 'no_route' ? null : value,
      distance_km: value === 'no_route' ? null : value,
      status: value === 'no_route' ? ('no_route' as const) : ('ok' as const),
    }))
  )
}

// En 50999 hay una IPS activa asignada a Kennedy (regla de mayoría): no se decide por carretera
const ASIGNADAS: AssignedHospitalInput[] = [
  { hospital_id: 'h1', kam_id: 'ken', municipality_id: '50999', locality_id: null, beds: 20, travel_time: 210 * 60 },
]

function entradas(
  opciones: { regla?: BogotaRuleInput | null; zonas?: MunicipalityZoneInput[]; tiempos?: Record<string, Record<string, Tiempo>> } = {}
): MunicipalityInputs {
  const rule = opciones.regla === undefined ? regla(360) : opciones.regla
  return {
    municipalities: MUNICIPIOS,
    zones: opciones.zonas ?? ZONAS,
    departments: ['11', '15', '25', '41', '50', '73'].map(code => ({ code, name: `Departamento ${code}`, excluded: false })),
    adjacency: ADYACENCIA,
    assigned: ASIGNADAS,
    travelTimes: travelTimes(opciones.tiempos ?? TIEMPOS),
    travelTimesTableMissing: false,
    bogota: rule,
    bogotaRuleStatus: rule ? 'activa' : 'sin_config',
  }
}

function filas(inputs: MunicipalityInputs): Map<string, MunicipalityZoneRow> {
  return new Map(computeMunicipalityZones(inputs).map(row => [row.municipality_code, row]))
}

// ---------------------------------------------------------------------------
// Pruebas
// ---------------------------------------------------------------------------

function seccionMetaOriente() {
  print('1. Meta, corredor oriente (el caso del dueño)')
  const con360 = filas(entradas())
  checkRow('Puerto Gaitán con tope de Bogotá 360 → San Cristóbal (corredor oriente), 333 min', con360.get('50568'), {
    kind: 'reach',
    kam_id: 'scr',
    travel_minutes: 333,
  })
  checkRow('San Carlos de Guaroa con tope 360 → San Cristóbal, 241 min', con360.get('50680'), {
    kind: 'reach',
    kam_id: 'scr',
    travel_minutes: 241,
  })

  const sinRegla = filas(entradas({ regla: null }))
  checkRow('sin regla (comportamiento anterior): Puerto Gaitán → Chapinero por su tope propio de 360', sinRegla.get('50568'), {
    kind: 'reach',
    kam_id: 'cha',
    travel_minutes: 355,
  })
  checkRow('sin regla: San Carlos de Guaroa (San Cristóbal a 241, 1 min sobre 240) → Chapinero 263', sinRegla.get('50680'), {
    kind: 'reach',
    kam_id: 'cha',
    travel_minutes: 263,
  })

  const con240 = filas(entradas({ regla: regla(240) }))
  checkRow('tope de Bogotá 240: Puerto Gaitán fuera de alcance; más cercana la celda del corredor (San Cristóbal 333)', con240.get('50568'), {
    kind: 'out_of_reach',
    kam_id: null,
    nearest_kam_id: 'scr',
    nearest_minutes: 333,
  })
  checkRow('tope 240: San Carlos de Guaroa fuera de alcance (241), más cercana San Cristóbal', con240.get('50680'), {
    kind: 'out_of_reach',
    nearest_kam_id: 'scr',
    nearest_minutes: 241,
  })
  check('tope 240: el tope propio de Chapinero (360) ya no cuenta hacia afuera', con240.get('50568')?.kam_id === null && con240.get('50680')?.kam_id === null)
}

function seccionCorredorDecide() {
  print('2. El corredor decide la celda, no los minutos')
  const rows = filas(entradas())
  checkRow('Boyacá (norte): Engativá es la más rápida (100) pero va a Chapinero con su tiempo propio (110)', rows.get('15999'), {
    kind: 'reach',
    kam_id: 'cha',
    travel_minutes: 110,
  })
  checkRow('Fusagasugá (fila por municipio: sur): Engativá 60 pero va a Kennedy (70)', rows.get('25290'), {
    kind: 'reach',
    kam_id: 'ken',
    travel_minutes: 70,
  })
  checkRow('celda del corredor sin ruta (Chapinero): la recibe igual, con el mejor tiempo de Bogotá (100)', rows.get('15998'), {
    kind: 'reach',
    kam_id: 'cha',
    travel_minutes: 100,
  })
  const sinRegla = filas(entradas({ regla: null }))
  checkRow('sin regla: Boyacá → Engativá (la más rápida)', sinRegla.get('15999'), { kind: 'reach', kam_id: 'eng', travel_minutes: 100 })
}

function seccionCompetencia() {
  print('3. "Bogotá" compite con las demás zonas con su mejor tiempo')
  const rows = filas(entradas())
  checkRow('Tolima: Bogotá 140 (Engativá) gana a Ibagué 150 → Engativá (corredor occidente)', rows.get('73999'), {
    kind: 'reach',
    kam_id: 'eng',
    travel_minutes: 140,
  })
  checkRow('Tolima: Ibagué 130 gana a Bogotá 140', rows.get('73998'), { kind: 'reach', kam_id: 'iba', travel_minutes: 130 })

  const ibagueP3 = ZONAS.map(z => (z.id === 'iba' ? { ...z, priority: 3 } : z))
  checkRow('empate 140 / 140: gana la de mayor prioridad (Ibagué, 3)', filas(entradas({ zonas: ibagueP3 })).get('73997'), {
    kind: 'reach',
    kam_id: 'iba',
    travel_minutes: 140,
  })
  const celdasP3 = ZONAS.map(z => (z.area_id.startsWith('11001') ? { ...z, priority: 3 } : z))
  checkRow('empate 140 / 140 con Bogotá de prioridad 3: gana Bogotá → Engativá', filas(entradas({ zonas: celdasP3 })).get('73997'), {
    kind: 'reach',
    kam_id: 'eng',
    travel_minutes: 140,
  })
}

function seccionSinCorredor() {
  print('4. Sin corredor, celda inactiva y k = 2')
  const rows = filas(entradas())
  checkRow('Cundinamarca sin fila de corredor: la celda más rápida (Engativá 45)', rows.get('25999'), {
    kind: 'reach',
    kam_id: 'eng',
    travel_minutes: 45,
  })

  const chapineroInactiva = ZONAS.map(z => (z.id === 'cha' ? { ...z, active: false } : z))
  checkRow('Chapinero inactiva: Boyacá va a la celda más rápida (Engativá 100)', filas(entradas({ zonas: chapineroInactiva })).get('15999'), {
    kind: 'reach',
    kam_id: 'eng',
    travel_minutes: 100,
  })

  const k2 = regla(360, { k: 2, grupos: { norte: 'cha', oriente: 'cha', occidente: 'eng', sur: 'eng' } })
  checkRow('k = 2 (Norte + Oriente → Chapinero): Puerto Gaitán → Chapinero 355', filas(entradas({ regla: k2 })).get('50568'), {
    kind: 'reach',
    kam_id: 'cha',
    travel_minutes: 355,
  })
}

function seccionSinCambios() {
  print('5. Lo que no cambia')
  const rows = filas(entradas())
  const faltaSanCristobal = Object.fromEntries(
    Object.entries(TIEMPOS).map(([code, pares]) => [
      code,
      code === '50568' ? Object.fromEntries(Object.entries(pares).filter(([kamId]) => kamId !== 'scr')) : pares,
    ])
  )
  checkRow('falta el par de una celda (San Cristóbal → Puerto Gaitán): pending', filas(entradas({ tiempos: faltaSanCristobal })).get('50568'), {
    kind: 'pending',
    kam_id: null,
  })
  checkRow('ninguna celda con ruta: sin acceso terrestre', rows.get('15997'), { kind: 'no_road', kam_id: null })
  checkRow('Bogotá misma (departamento 11): sin la regla, cada celda con su tope → Chapinero 300', rows.get('11001'), {
    kind: 'reach',
    kam_id: 'cha',
    travel_minutes: 300,
  })
  checkRow('municipio con IPS: la regla de mayoría (Kennedy), no la carretera', rows.get('50999'), {
    kind: 'ips',
    kam_id: 'ken',
    travel_minutes: 210,
  })
  checkRow('municipio base de una zona (Ibagué): territorio base a 0 min', rows.get('73001'), { kind: 'reach', kam_id: 'iba', travel_minutes: 0 })

  const report = buildDryRunReport(entradas())
  check('el informe dice qué regla de Bogotá se usó (activa, 360)', report.bogota_rule.status === 'activa' && report.bogota_rule.max_travel_minutes === 360)
  check(
    'el informe con la caché completa no deja nada pendiente',
    report.preview.pending === 0,
    JSON.stringify(report.preview)
  )
  const sinRegla = buildDryRunReport(entradas({ regla: null }))
  check('sin regla, el informe lo dice (sin_config, sin tope)', sinRegla.bogota_rule.status === 'sin_config' && sinRegla.bogota_rule.max_travel_minutes === null)
}

function seccionCoherenciaIps() {
  print('6. Coherencia con el algoritmo de IPS (competeForHospital, mismos tiempos en SEGUNDOS)')
  const rows = filas(entradas())
  const rule = regla(360)
  const kams = ZONAS.map(z => ({ id: z.id, area_id: z.area_id, enable_level2: z.enable_level2, max_travel_time: z.max_travel_time as number, priority: z.priority as number }))
  for (const code of ['50568', '50680', '15999', '25290', '25999', '73999', '73998']) {
    const pares = TIEMPOS[code]
    const outcome = competeForHospital(
      { department_id: code.substring(0, 2), municipality_id: code, locality_id: null },
      kams,
      ADYACENCIA,
      kamId => (typeof pares[kamId] === 'number' ? (pares[kamId] as number) * 60 : null),
      rule
    )
    const row = rows.get(code)
    check(
      `${MUNICIPIOS.find(m => m.code === code)?.name}: misma zona que una IPS ahí (${outcome?.kam_id ?? 'ninguna'})`,
      row?.kind === 'reach' && outcome !== null && row.kam_id === outcome.kam_id && row.travel_minutes === outcome.travel_time / 60,
      `municipio ${row?.kam_id} ${row?.travel_minutes} · IPS ${outcome?.kam_id} ${outcome ? outcome.travel_time / 60 : null}`
    )
  }
}

function main() {
  print('Motor de municipios con Bogotá como una ciudad · pruebas puras (sin red)')
  print('')
  seccionMetaOriente()
  seccionCorredorDecide()
  seccionCompetencia()
  seccionSinCorredor()
  seccionSinCambios()
  seccionCoherenciaIps()
  print('')
  print(`Resultado: ${passed} OK, ${failed} con fallo`)
  if (failed > 0) process.exit(1)
}

try {
  main()
} catch (error) {
  process.stderr.write(`municipios-check: error inesperado: ${error instanceof Error ? error.stack : String(error)}\n`)
  process.exit(1)
}
