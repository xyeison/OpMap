/**
 * "Datos de la zona" (ventana de /executives) · pruebas puras de las cuentas (sin red ni base de datos).
 *
 * Cubre: cobertura de una zona y de una persona por línea (local, por alcance, manual, vacante), unión del territorio,
 * municipios de un grupo de zonas (con IPS, de alcance, compartidos como Bogotá) y departamentos, población DANE y
 * afiliados BDUA por la parte de cada municipio (sin contar dos veces), IPS objetivo con camas del REPS y servicios,
 * giros ADRES repartidos por sede, compras de SECOP (sin duplicar un contrato de un NIT con sedes en dos zonas, VG
 * Medical aparte, fuera de escala y servicios de especialistas fuera), ventana y resumen de visitas de VMO, médicos
 * vigentes y el formato de fechas en español. Y quién ve qué: la ventana exige executives:view y hospitals:view, las
 * compras públicas solo con intelligence:view (como /api/secop/*) y la cobertura solo en las líneas de
 * resolveUserLines (como /api/coverage?line=). La ruta completa se prueba en scripts/zona-estadisticas-api-check.ts.
 *
 * Uso (desde web/): npx tsx scripts/zona-estadisticas-check.ts      Código de salida 1 si alguna prueba falla.
 */
import { hospitalGiroMap, municipioZoneShares } from '../lib/poblacion-intelligence'
import { hasPermission, rolePermissions, type Role } from '../lib/permissions'
import type { SecopFact } from '../lib/compras-publicas'
import {
  VG_MEDICAL_NIT,
  afiliadosDeZonas,
  coberturaDeEjecutivo,
  coberturaDeZona,
  coberturaDesactualizada,
  construirBloque,
  contarMedicos,
  fechaEs,
  girosDeZonas,
  ipsDeZonas,
  lineasConCobertura,
  mesEs,
  mismasZonas,
  municipiosConIps,
  municipiosDeZonas,
  pctEs,
  poblacionDeZonas,
  puedeVerDatosDeZona,
  rangoMesesEs,
  resumirMunicipios,
  resumirVisitas,
  secopDeZonas,
  ultimaFecha,
  veComprasPublicas,
  ventanaVisitas,
  zonasDelTerritorio,
  type CoberturaLineaEntrada,
  type DaneFila,
  type DatosZonas,
  type HospitalZona,
  type VisitaFila,
} from '../lib/zona-estadisticas'

let passed = 0
let failed = 0

function check(name: string, condition: boolean, detail?: unknown) {
  if (condition) {
    passed++
    console.log(`  ok   ${name}`)
  } else {
    failed++
    console.log(`  FALLA ${name}${detail !== undefined ? ` → ${JSON.stringify(detail)}` : ''}`)
  }
}

function eq(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  check(name, a === e, a === e ? undefined : { actual, expected })
}

const near = (a: number, b: number, tol = 1e-6) => Math.abs(a - b) <= tol

// ---------------------------------------------------------------------------
// Datos ficticios
// ---------------------------------------------------------------------------
// Zonas: CHA (Chapinero) y KEN (Kennedy) se reparten Bogotá (11001); NEI (Neiva) en 41001. Municipios sin IPS:
// 25175 (Chía, alcance de CHA), 41551 (Pitalito, alcance de NEI), 99001 (fuera de alcance: kam null).

const CHA = 'kam-cha'
const KEN = 'kam-ken'
const NEI = 'kam-nei'

function hospital(
  id: string,
  kam: string | null,
  municipio: string,
  beds: number | null,
  extra: Partial<HospitalZona> = {}
): HospitalZona {
  return {
    id,
    name: `IPS ${id}`,
    code: extra.code ?? null,
    municipality_id: municipio,
    municipality_name: null,
    department_id: municipio.slice(0, 2),
    department_name: null,
    beds,
    reps_beds: extra.reps_beds ?? null,
    quirofanos: extra.quirofanos ?? null,
    kam_id: kam,
    zone_name: kam,
    executive: null,
    coverage_kind: null,
    service_flags: extra.service_flags ?? null,
    reps_updated_at: extra.reps_updated_at ?? null,
  }
}

// h1 y h2: mismo NIT 800000001 (sedes en CHA y KEN); h3 en CHA; h4 en NEI; h5 sin zona.
const hospitals: HospitalZona[] = [
  hospital('h1', CHA, '11001', 300, {
    code: '800000001-1',
    reps_beds: 280,
    quirofanos: 6,
    service_flags: { cirugia_ortopedica: true, neurocirugia: true },
    reps_updated_at: '2026-10-11T10:00:00Z',
  }),
  hospital('h2', KEN, '11001', 100, { code: '800000001-2', service_flags: { cirugia_ortopedica: true, neurocirugia: false } }),
  hospital('h3', CHA, '11001', 100, { code: '800000003-1', service_flags: { ortopedia: true }, reps_updated_at: '2026-10-12T03:15:00Z' }),
  hospital('h4', NEI, '41001', 50, { code: '800000004-1', service_flags: { neurocirugia: true } }),
  hospital('h5', null, '05001', 10, { code: '800000005-1' }),
]

const reach = new Map<string, string | null>([
  ['11001', CHA], // municipality_zone guarda Bogotá con un solo ganador: manda el reparto por camas
  ['25175', CHA],
  ['41001', NEI],
  ['41551', NEI],
  ['99001', null],
])
const shares = municipioZoneShares(hospitals, reach)
const conIps = municipiosConIps(hospitals)
const municipios = new Map([
  ['11001', { name: 'Bogotá, D.C.', department_code: '11' }],
  ['25175', { name: 'Chía', department_code: '25' }],
  ['41001', { name: 'Neiva', department_code: '41' }],
  ['41551', { name: 'Pitalito', department_code: '41' }],
  ['05001', { name: 'Medellín', department_code: '05' }],
])
const departamentos = new Map([
  ['11', 'Bogotá, D.C.'],
  ['25', 'Cundinamarca'],
  ['41', 'Huila'],
  ['05', 'Antioquia'],
])

console.log('\nCobertura por línea')
{
  const lineas: CoberturaLineaEntrada[] = [
    {
      line: { id: 'l-col', code: 'columna', name: 'Columna' },
      rows: [
        { kam_id: CHA, zone_name: 'Chapinero', kind: 'local', executive: { id: 'vac-bog', full_name: 'Vacante Bogotá', status: 'placeholder' }, travel_minutes: 0, nearest: null },
        { kam_id: KEN, zone_name: 'Kennedy', kind: 'reach', executive: { id: 'vac-bog', full_name: 'Vacante Bogotá', status: 'placeholder' }, travel_minutes: 30, nearest: null },
        { kam_id: NEI, zone_name: 'Neiva', kind: 'vacant', executive: null, travel_minutes: null, nearest: { full_name: 'Vacante Bogotá', minutes: 308 } },
      ],
    },
    {
      line: { id: 'l-per', code: 'perossal', name: 'Sustitutos óseos' },
      rows: [
        { kam_id: CHA, zone_name: 'Chapinero', kind: 'local', executive: { id: 'yineth', full_name: 'Yineth', status: 'active' }, travel_minutes: 0, nearest: null },
        { kam_id: KEN, zone_name: 'Kennedy', kind: 'manual', executive: { id: 'vac-bog', full_name: 'Vacante Bogotá', status: 'placeholder' }, travel_minutes: 30, nearest: null },
      ],
    },
    { line: { id: 'l-tra', code: 'trauma', name: 'Trauma' }, rows: [] },
  ]

  const zona = coberturaDeZona(lineas, NEI)
  eq('zona: una entrada por línea activa', zona.map(item => item.line.code), ['columna', 'perossal', 'trauma'])
  eq('zona: vacante con la más cercana', zona[0], {
    line: { id: 'l-col', code: 'columna', name: 'Columna' },
    kind: 'vacant',
    executive: null,
    travel_minutes: null,
    nearest: { full_name: 'Vacante Bogotá', minutes: 308 },
  })
  eq('zona: sin fila de cobertura → kind null', zona[1].kind, null)
  eq('zona: local con la persona', coberturaDeZona(lineas, CHA)[1].executive?.full_name, 'Yineth')

  const persona = coberturaDeEjecutivo(lineas, 'vac-bog', new Set(['l-col', 'l-tra']))
  eq('persona: líneas que lleva y las que le dan zonas', persona.map(item => [item.line.code, item.lleva]), [
    ['columna', true],
    ['perossal', false],
    ['trauma', true],
  ])
  eq('persona: local primero, luego por alcance', persona[0].zonas.map(item => [item.nombre, item.kind]), [
    ['Chapinero', 'local'],
    ['Kennedy', 'reach'],
  ])
  eq('persona: ajuste manual cuenta', persona[1].zonas.map(item => item.kind), ['manual'])
  eq('persona: línea sin zonas queda vacía', persona[2].zonas, [])
  eq('territorio: unión sin repetir', zonasDelTerritorio(persona), [CHA, KEN])
  eq('territorio de quien no cubre nada', zonasDelTerritorio(coberturaDeEjecutivo(lineas, 'nadie', new Set())), [])
  check('mismasZonas: mismo conjunto en otro orden', mismasZonas([CHA, KEN], [KEN, CHA]))
  check('mismasZonas: distinto tamaño', !mismasZonas([CHA], [CHA, KEN]))
  eq('última fecha de cálculo', ultimaFecha(['2026-10-11T13:05:58Z', null, '2026-10-10T00:00:00Z']), '2026-10-11T13:05:58Z')
  check('cobertura desactualizada: persona creada después del cálculo', coberturaDesactualizada('2026-10-14T22:59:16Z', '2026-10-11T13:05:58Z'))
  check('cobertura al día: persona creada antes', !coberturaDesactualizada('2026-10-11T00:15:41Z', '2026-10-11T13:05:58Z'))
  check('sin fecha de cálculo no se marca', !coberturaDesactualizada('2026-10-14T22:59:16Z', null))
}

console.log('\nMunicipios, población y afiliados')
{
  // Bogotá: CHA 400 camas (h1 300 + h3 100) y KEN 100 → 0,8 / 0,2
  const cha = municipiosDeZonas({ shares, kamIds: [CHA], conIps, municipios })
  eq('CHA: Bogotá (con IPS, compartida) y Chía (alcance)', cha.map(m => [m.code, m.tipo, m.compartido]), [
    ['11001', 'ips', true],
    ['25175', 'alcance', false],
  ])
  check('CHA: parte de Bogotá por camas = 0,8', near(cha[0].parte, 0.8), cha[0].parte)
  const bog = municipiosDeZonas({ shares, kamIds: [CHA, KEN], conIps, municipios })
  check('CHA + KEN: Bogotá entera y ya no compartida', near(bog[0].parte, 1) && !bog[0].compartido, bog[0])
  eq('NEI: Neiva con IPS y Pitalito de alcance', municipiosDeZonas({ shares, kamIds: [NEI], conIps, municipios }).map(m => [m.nombre, m.tipo]), [
    ['Neiva', 'ips'],
    ['Pitalito', 'alcance'],
  ])
  eq('fuera de alcance no va a ninguna zona', municipiosDeZonas({ shares, kamIds: [CHA, KEN, NEI], conIps, municipios }).some(m => m.code === '99001'), false)
  eq('zona sin municipios', municipiosDeZonas({ shares, kamIds: ['otra'], conIps, municipios }), [])

  const resumen = resumirMunicipios(municipiosDeZonas({ shares, kamIds: [CHA, NEI], conIps, municipios }), departamentos)
  eq('resumen: totales', [resumen.total, resumen.conIps, resumen.alcance, resumen.compartidos], [4, 2, 2, 1])
  eq('resumen: nombres de los compartidos', resumen.compartidosNombres, ['Bogotá, D.C.'])
  eq('resumen: departamentos de más a menos municipios', resumen.departamentos, [
    { code: '41', nombre: 'Huila', municipios: 2 },
    { code: '11', nombre: 'Bogotá, D.C.', municipios: 1 },
    { code: '25', nombre: 'Cundinamarca', municipios: 1 },
  ])

  const dane = new Map<string, DaneFila>([
    ['11001', { total: 8_000_000, cabecera: 7_980_000, resto: 20_000 }],
    ['25175', { total: 150_000, cabecera: 100_000, resto: 50_000 }],
    ['41001', { total: 370_000, cabecera: 350_000, resto: 20_000 }],
  ])
  const pobCha = poblacionDeZonas(cha, dane, 2026)
  eq('población CHA: 80 % de Bogotá + Chía entera', pobCha, { anio: 2026, total: 6_550_000, cabecera: 6_484_000, rural: 66_000, municipiosSinDato: 0 })
  const pobKen = poblacionDeZonas(municipiosDeZonas({ shares, kamIds: [KEN], conIps, municipios }), dane, 2026)
  check('población: CHA + KEN suman Bogotá una sola vez', pobCha !== null && pobKen !== null && pobCha.total + pobKen.total === 8_150_000, { pobCha, pobKen })
  const pobNei = poblacionDeZonas(municipiosDeZonas({ shares, kamIds: [NEI], conIps, municipios }), dane, 2026)
  eq('población NEI: Pitalito sin proyección se informa', [pobNei?.total, pobNei?.municipiosSinDato], [370_000, 1])
  eq('población sin DANE cargado → sin datos', poblacionDeZonas(cha, new Map(), 2026), null)

  const bdua = {
    corte: '2026-10-02',
    regimen: [
      { municipio: '11001', regimen: 'contributivo', afiliados: 6_000_000 },
      { municipio: '11001', regimen: 'subsidiado', afiliados: 1_000_000 },
      { municipio: '25175', regimen: 'Contributivo', afiliados: 100_000 },
      { municipio: '25175', regimen: 'SUBSIDIADO', afiliados: 20_000 },
    ],
    eps: [
      { municipio: '11001', eps_codigo: 'EPS037', eps_nombre: 'Nueva EPS', afiliados: 1_000_000 },
      { municipio: '11001', eps_codigo: 'EPS005', eps_nombre: 'Sanitas', afiliados: 2_000_000 },
      { municipio: '25175', eps_codigo: 'EPS037', eps_nombre: 'Nueva EPS', afiliados: 50_000 },
      { municipio: '41001', eps_codigo: 'EPS999', eps_nombre: 'De Neiva', afiliados: 999_999 },
    ],
  }
  const af = afiliadosDeZonas(cha, bdua)
  eq('afiliados CHA: por régimen y parte', [af?.contributivo, af?.subsidiado, af?.total, af?.municipiosSinDato], [4_900_000, 820_000, 5_720_000, 0])
  eq('afiliados CHA: EPS principales (sin las de fuera)', af?.eps.map(item => [item.codigo, item.afiliados]), [
    ['EPS005', 1_600_000],
    ['EPS037', 850_000],
  ])
  eq('afiliados NEI: sin BDUA del municipio', afiliadosDeZonas(municipiosDeZonas({ shares, kamIds: [NEI], conIps, municipios }), bdua)?.municipiosSinDato, 2)
  eq('afiliados sin BDUA cargada → sin datos', afiliadosDeZonas(cha, null), null)
}

console.log('\nIPS, giros y compras públicas')
{
  const ips = ipsDeZonas(hospitals, [CHA])
  eq('IPS CHA: cuántas, camas del REPS o de la ficha, quirófanos', [ips.total, ips.camas, ips.quirofanos], [2, 380, 6])
  eq('IPS CHA: servicios del REPS', [ips.conServiciosReps, ips.cirugiaOrtopedica, ips.neurocirugia, ips.ortopediaONeuro], [2, 1, 1, 1])
  eq('IPS CHA: última importación del REPS', ips.repsActualizado, '2026-10-12T03:15:00Z')
  const ipsTodo = ipsDeZonas(hospitals, [CHA, KEN, NEI])
  eq('IPS de tres zonas: ortopedia o neuro sin contar dos veces', [ipsTodo.total, ipsTodo.cirugiaOrtopedica, ipsTodo.neurocirugia, ipsTodo.ortopediaONeuro], [4, 2, 2, 3])
  eq('IPS sin dato de quirófanos → null', ipsDeZonas(hospitals, [NEI]).quirofanos, null)
  eq('IPS de una zona sin IPS', ipsDeZonas(hospitals, ['otra']).total, 0)

  // Giro del NIT 800000001 (sedes h1 300 camas y h2 100): 1.000 → h1 750, h2 250.
  const porIps = hospitalGiroMap(hospitals, [
    { nit: '800000001', total: 1000 },
    { nit: '800000004', total: 400 },
  ])
  eq('giros CHA: solo la parte de su sede', girosDeZonas(hospitals, [CHA], porIps), { valor: 750, ipsConGiro: 1 })
  eq('giros CHA + KEN: el NIT entero una vez', girosDeZonas(hospitals, [CHA, KEN], porIps), { valor: 1000, ipsConGiro: 2 })
  eq('giros NEI', girosDeZonas(hospitals, [NEI], porIps), { valor: 400, ipsConGiro: 1 })

  const fact = (over: Partial<SecopFact>): SecopFact => ({
    nit_entidad: '800000001',
    nombre_entidad: 'Entidad',
    proveedor_key: 'nit:900000000',
    proveedor_nit: '900000000',
    proveedor_nombre: 'Otro proveedor',
    es_persona: false,
    especialidad: null,
    linea: 'trauma',
    fecha: '2026-03-10',
    valor: 1000,
    contratos: 1,
    ...over,
  })
  const facts: SecopFact[] = [
    fact({}),
    fact({ proveedor_key: `nit:${VG_MEDICAL_NIT}`, proveedor_nit: VG_MEDICAL_NIT, proveedor_nombre: 'VG Medical', valor: 400, linea: 'columna', fecha: '2026-05-01' }),
    fact({ nit_entidad: '800000004', valor: 200 }),
    fact({ linea: 'no_clasificado', valor: 5000 }), // sin clasificar: no suma en el total ortopédico
    fact({ valor: 60_000_000_000 }), // fuera de escala: no suma
    fact({ es_persona: true, proveedor_nit: null, proveedor_key: 'persona:abc', especialidad: 'ortopedia', linea: null, es_servicio: true, valor: 300 }), // especialista
    fact({ nit_entidad: '700000000', valor: 9999 }), // NIT que no es IPS de OpMap
  ]
  const cha = secopDeZonas(facts, hospitals, [CHA])
  eq('SECOP CHA: 75 % de lo del NIT compartido', [cha.valor, cha.contratos, cha.entidades], [1050, 2, 1])
  eq('SECOP CHA: VG Medical aparte', cha.vg, { valor: 300, contratos: 1, entidades: 1 })
  eq('SECOP CHA: última fecha', cha.ultimaFecha, '2026-05-01')
  const bog = secopDeZonas(facts, hospitals, [CHA, KEN])
  eq('SECOP CHA + KEN: el contrato cuenta una vez y el valor entero', [bog.valor, bog.contratos], [1400, 2])
  const todo = secopDeZonas(facts, hospitals, [CHA, KEN, NEI])
  eq('SECOP de tres zonas: dos entidades', [todo.valor, todo.contratos, todo.entidades], [1600, 3, 2])
  eq('SECOP sin compras', secopDeZonas([], hospitals, [CHA]), { valor: 0, contratos: 0, entidades: 0, ultimaFecha: null, vg: { valor: 0, contratos: 0, entidades: 0 } })
}

console.log('\nVisitas de VMO y médicos')
{
  eq('ventana: los 3 meses que terminan en el de la última visita', ventanaVisitas('2025-10-28'), { desde: '2025-08-01', hasta: '2025-10-31' })
  eq('ventana: cruza el año', ventanaVisitas('2026-02-03'), { desde: '2025-12-01', hasta: '2026-02-28' })
  eq('ventana: sin visitas → null', ventanaVisitas(null), null)

  const filas: VisitaFila[] = [
    { kam_id: CHA, visit_date: '2025-10-01', visit_type: 'Visita efectiva', contact_type: 'Visita presencial', hospital_id: 'h1' },
    { kam_id: CHA, visit_date: '2025-08-01', visit_type: 'Visita no efectiva', contact_type: 'Visita virtual', hospital_id: 'h1' },
    { kam_id: CHA, visit_date: '2025-09-15', visit_type: 'Visita extra', contact_type: 'Visita presencial', hospital_id: 'h3' },
    { kam_id: CHA, visit_date: '2025-07-31', visit_type: 'Visita efectiva', contact_type: 'Visita presencial', hospital_id: 'h3' }, // antes
    { kam_id: KEN, visit_date: '2025-10-10', visit_type: 'Visita efectiva', contact_type: 'Visita presencial', hospital_id: 'h2' },
  ]
  const ventana = { desde: '2025-08-01', hasta: '2025-10-31' }
  eq('visitas CHA en la ventana', resumirVisitas(filas, [CHA], ventana), {
    desde: '2025-08-01',
    hasta: '2025-10-31',
    total: 3,
    efectivas: 1,
    noEfectivas: 1,
    otras: 1,
    presenciales: 2,
    virtuales: 1,
    ipsVisitadas: 2,
    ultimaVisita: '2025-10-01',
  })
  const soloAntes = resumirVisitas([filas[3]], [CHA], ventana)
  eq('visitas: sin visitas en la ventana pero con la última registrada', [soloAntes.total, soloAntes.ultimaVisita], [0, '2025-07-31'])
  eq('visitas de otra zona no cuentan', resumirVisitas(filas, [NEI], ventana).total, 0)

  const lineas = [
    { id: 'l-per', code: 'perossal', name: 'Sustitutos óseos' },
    { id: 'l-col', code: 'columna', name: 'Columna' },
  ]
  eq(
    'médicos: sin repetir en el total, por línea',
    contarMedicos(
      [
        { medico_id: 'm1', line_id: 'l-per' },
        { medico_id: 'm1', line_id: 'l-col' },
        { medico_id: 'm2', line_id: 'l-per' },
      ],
      lineas
    ),
    {
      total: 2,
      porLinea: [
        { line: lineas[0], total: 2 },
        { line: lineas[1], total: 1 },
      ],
    }
  )
  eq('médicos: ninguno', contarMedicos([], lineas), { total: 0, porLinea: [] })
}

console.log('\nBloque completo')
{
  const datos: DatosZonas = {
    zonas: new Map([
      [CHA, { kam_id: CHA, nombre: 'Chapinero', ciudad_base: 'Bogotá', activa: true }],
      [KEN, { kam_id: KEN, nombre: 'Kennedy', ciudad_base: 'Bogotá', activa: true }],
    ]),
    hospitals,
    shares,
    conIps,
    municipios,
    departamentos,
    dane: null,
    bdua: null,
    giros: null,
    secop: null,
    visitas: null,
  }
  const bloque = construirBloque([KEN, CHA], datos)
  eq('bloque: zonas por nombre', bloque.zonas.map(z => z.nombre), ['Chapinero', 'Kennedy'])
  eq('bloque: fuentes ausentes quedan sin datos (null), nunca en 0', [bloque.poblacion, bloque.afiliados, bloque.giros, bloque.secop, bloque.visitas], [null, null, null, null, null])
  eq('bloque: municipios e IPS se calculan igual', [bloque.municipios.total, bloque.ips.total], [2, 3])
  eq('bloque: zona desconocida no rompe', construirBloque(['nueva'], datos).zonas[0].nombre, 'Zona sin nombre')
}

console.log('\nQuién ve qué')
{
  const roles = Object.keys(rolePermissions) as Role[]
  // Ventana: executives:view + hospitals:view (hoy todos salvo recursos humanos)
  for (const role of roles) {
    eq(
      `ventana (${role}): executives:view y hospitals:view`,
      puedeVerDatosDeZona(role),
      hasPermission(role, 'executives:view') && hasPermission(role, 'hospitals:view')
    )
  }
  eq('ventana: recursos humanos no (sin hospitals:view, no ve IPS ni giros)', puedeVerDatosDeZona('hr'), false)
  eq('ventana: sin rol, no', puedeVerDatosDeZona(undefined), false)
  eq(
    'ventana: la abren todos los roles salvo hr',
    roles.filter(role => !puedeVerDatosDeZona(role)),
    ['hr']
  )

  // Compras públicas: el permiso de /api/secop/ranking, /api/secop/hospital/[id] y la tarjeta de SECOP de la ficha
  for (const role of roles) {
    eq(`compras públicas (${role}): igual que /api/secop/* (intelligence:view)`, veComprasPublicas(role), hasPermission(role, 'intelligence:view'))
  }
  eq(
    'compras públicas: ni user, ni contract_manager, ni hr, ni sales_manager',
    ['user', 'contract_manager', 'hr', 'sales_manager'].map(role => veComprasPublicas(role as Role)),
    [false, false, false, false]
  )
  eq('compras públicas: sí admin, commercial_director, line_leader, data_manager, viewer', ['admin', 'commercial_director', 'line_leader', 'data_manager', 'viewer'].map(role => veComprasPublicas(role as Role)), [true, true, true, true, true])

  // Cobertura: las líneas de resolveUserLines, en el orden de business_lines
  const A = { id: 'line-a', code: 'perossal', name: 'Sustitutos óseos' }
  const B = { id: 'line-b', code: 'reemplazo', name: 'Reemplazo articular' }
  const C = { id: 'line-c', code: 'columna', name: 'Columna' }
  const todas = [A, B, C]
  eq('cobertura: map:all-lines ve todas, en su orden', lineasConCobertura(todas, { canSeeAll: true, lines: [] }).map(l => l.code), ['perossal', 'reemplazo', 'columna'])
  eq('cobertura: líder o ejecutivo de A y C ve solo A y C (no B)', lineasConCobertura(todas, { canSeeAll: false, lines: [C, A] }).map(l => l.code), ['perossal', 'columna'])
  eq('cobertura: sin líneas propias, ninguna', lineasConCobertura(todas, { canSeeAll: false, lines: [] }), [])
  eq('cobertura: una línea propia que ya no está activa no aparece', lineasConCobertura([A], { canSeeAll: false, lines: [{ id: 'line-vieja' }] }), [])
  check('cobertura: devuelve una copia (no la misma lista)', lineasConCobertura(todas, { canSeeAll: true, lines: [] }) !== todas)

  // El territorio sale solo de las líneas visibles: la zona que da la línea B no aparece para quien no ve B
  const entradas: CoberturaLineaEntrada[] = [
    { line: A, rows: [{ kam_id: NEI, zone_name: 'Neiva', kind: 'local', executive: { id: 'ex-1', full_name: 'Vacante Neiva', status: 'placeholder' }, travel_minutes: null, nearest: null }] },
    { line: B, rows: [{ kam_id: CHA, zone_name: 'Chapinero', kind: 'manual', executive: { id: 'ex-1', full_name: 'Vacante Neiva', status: 'placeholder' }, travel_minutes: null, nearest: null }] },
  ]
  const visibles = new Set(lineasConCobertura([A, B], { canSeeAll: false, lines: [A] }).map(line => line.id))
  const soloVisibles = entradas.filter(entrada => visibles.has(entrada.line.id))
  eq('territorio con todas las líneas: Neiva y Chapinero', zonasDelTerritorio(coberturaDeEjecutivo(entradas, 'ex-1', new Set([A.id, B.id]))), [NEI, CHA])
  eq('territorio solo con A: Neiva (Chapinero lo da B, que no ve)', zonasDelTerritorio(coberturaDeEjecutivo(soloVisibles, 'ex-1', new Set([A.id, B.id]))), [NEI])
  eq('quién cubre Chapinero, solo con A: ninguna fila de B', coberturaDeZona(soloVisibles, CHA).map(fila => fila.line.code), ['perossal'])
}

console.log('\nFormato')
{
  eq('fecha', fechaEs('2026-10-02'), '2 oct 2026')
  eq('fecha y hora en Bogotá (UTC de madrugada = día anterior)', fechaEs('2026-10-12T03:15:43Z'), '11 oct 2026')
  eq('sin fecha', fechaEs(null), 'sin fecha')
  eq('mes', mesEs('2025-08'), 'ago 2025')
  eq('rango de meses', rangoMesesEs('2025-11-01', '2026-10-14'), 'nov 2025 – oct 2026')
  eq('rango de un solo mes', rangoMesesEs('2026-10', '2026-10'), 'oct 2026')
  eq('porcentaje', pctEs(1, 4), '25 %')
  eq('porcentaje sin total', pctEs(1, 0), '0 %')
}

console.log(`\n${passed} pruebas pasaron, ${failed} fallaron`)
if (failed > 0) process.exit(1)
