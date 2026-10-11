/**
 * Fase 4 · Pruebas puras de "Población y cobertura" (sin red ni base de datos).
 *
 * Cubre: reparto de un municipio entre zonas (camas, número de IPS, alcance), resolución de fuentes
 * (afiliacion_cifras → BDUA; DANE → cifras → municipalities), agregación por municipio / zona /
 * Ejecutivo Comercial con datos ficticios, índice potencial (normalización, pesos, sin división por
 * cero, quirófanos), top EPS, filtros, ranking de giros dentro del municipio, parámetros y CSV.
 *
 * Uso (desde web/): npx tsx scripts/poblacion-api-check.ts      Código de salida 1 si alguna prueba falla.
 */
import {
  AFILIADOS_PESOS,
  POTENCIAL_PESOS,
  aggregatePoblacion,
  afiliadosPonderados,
  buildPoblacionCsv,
  camasCapacidad,
  closestCorte,
  coberturaPct,
  computePotencial,
  epsDisplayName,
  epsGroupKey,
  hospitalGiroMap,
  mergeBduaEps,
  municipioZoneShares,
  normalizeRegimen,
  parseGirosIntelTotals,
  parsePoblacionQuery,
  pickDaneYear,
  rankInMunicipio,
  resolveCorte,
  resolveMunicipios,
  summarizeBduaRows,
  summarizeEntorno,
  topEps,
  type CoverageForZone,
  type EpsAfiliadosRow,
  type GiroNitTotal,
  type MunicipioPoblacion,
  type PoblacionHospital,
} from '../lib/poblacion-intelligence'

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
// Zonas: ZA (Atlántico), ZB (Bogotá norte), ZC (Bogotá sur).
// Municipios: 08001 Barranquilla (IPS de ZA), 08002 Pueblo (sin IPS, alcance de ZA),
// 11001 Bogotá (IPS de ZB con 300 camas y de ZC con 100), 99999 Remoto (sin zona, sin datos).
const zoneNames = new Map([
  ['ZA', 'Atlántico'],
  ['ZB', 'Bogotá – Norte'],
  ['ZC', 'Bogotá – Sur'],
])

function hosp(partial: Partial<PoblacionHospital> & { id: string }): PoblacionHospital {
  return {
    name: partial.id,
    code: null,
    municipality_id: null,
    municipality_name: null,
    department_id: null,
    department_name: null,
    beds: null,
    reps_beds: null,
    quirofanos: null,
    kam_id: null,
    zone_name: null,
    executive: null,
    coverage_kind: null,
    ...partial,
  }
}

const hospitals: PoblacionHospital[] = [
  hosp({ id: 'h1', name: 'Clínica Norte BAQ', code: '800000001-1', municipality_id: '08001', municipality_name: 'Barranquilla', department_id: '08', department_name: 'Atlántico', beds: 100, kam_id: 'ZA', zone_name: 'Atlántico' }),
  hosp({ id: 'h2', name: 'Hospital BAQ', code: '800000002-1', municipality_id: '08001', municipality_name: 'Barranquilla', department_id: '08', department_name: 'Atlántico', beds: 50, reps_beds: 80, quirofanos: 4, kam_id: 'ZA', zone_name: 'Atlántico' }),
  hosp({ id: 'h3', name: 'Clínica Bogotá Norte', code: '800000003-1', municipality_id: '11001', municipality_name: 'Bogotá', department_id: '11', department_name: 'Bogotá', beds: 300, kam_id: 'ZB', zone_name: 'Bogotá – Norte' }),
  hosp({ id: 'h4', name: 'Clínica Bogotá Sur', code: '800000004-1', municipality_id: '11001', municipality_name: 'Bogotá', department_id: '11', department_name: 'Bogotá', beds: 100, kam_id: 'ZC', zone_name: 'Bogotá – Sur' }),
  // Sede sin zona en Bogotá: no vota en el reparto del municipio
  hosp({ id: 'h5', name: 'IPS sin zona', code: '800000005-1', municipality_id: '11001', municipality_name: 'Bogotá', department_id: '11', department_name: 'Bogotá', beds: 1000 }),
]

const reach = new Map<string, string | null>([
  ['08001', 'ZA'],
  ['08002', 'ZA'],
  ['11001', 'ZB'],
  ['99999', null],
])

const municipios: MunicipioPoblacion[] = [
  { code: '08001', name: 'Barranquilla', department_code: '08', department_name: 'Atlántico', contributivo: 1000, subsidiado: 500, excepcion: 100, fuente: 'cifras', poblacion: 2000, poblacion_fuente: 'dane' },
  { code: '08002', name: 'Pueblo', department_code: '08', department_name: 'Atlántico', contributivo: 10, subsidiado: 90, excepcion: 0, fuente: 'bdua', poblacion: 100, poblacion_fuente: 'dane' },
  { code: '11001', name: 'Bogotá', department_code: '11', department_name: 'Bogotá', contributivo: 4000, subsidiado: 1000, excepcion: 0, fuente: 'cifras', poblacion: 5000, poblacion_fuente: 'dane' },
  { code: '99999', name: 'Remoto', department_code: '99', department_name: 'Remoto', contributivo: null, subsidiado: null, excepcion: null, fuente: null, poblacion: 50, poblacion_fuente: 'municipalities' },
]

const eps: EpsAfiliadosRow[] = [
  { municipio: '08001', eps_codigo: 'EPS1', eps_nombre: 'Nueva EPS', afiliados: 600 },
  { municipio: '08001', eps_codigo: 'EPS2', eps_nombre: 'Sura', afiliados: 300 },
  { municipio: '08002', eps_codigo: 'EPS1', eps_nombre: 'Nueva EPS', afiliados: 100 },
  { municipio: '11001', eps_codigo: 'EPS2', eps_nombre: 'Sura', afiliados: 2000 },
  { municipio: '11001', eps_codigo: 'EPS3', eps_nombre: 'Sanitas', afiliados: 1000 },
]

// Giros por NIT (12 meses). NIT 800000001 → h1 entero; 800000003 → h3.
const giros: GiroNitTotal[] = [
  { nit: '800000001', total: 900 },
  { nit: '800000002', total: 100 },
  { nit: '800000003', total: 1000 },
]

console.log('\nReparto de municipios entre zonas')
const shares = municipioZoneShares(hospitals, reach)
eq('Barranquilla: entera a ZA', shares.get('08001'), [{ kam_id: 'ZA', share: 1 }])
eq('Pueblo (sin IPS): alcance de ZA', shares.get('08002'), [{ kam_id: 'ZA', share: 1 }])
eq('Bogotá: por camas 300/100 (la IPS sin zona no vota)', shares.get('11001'), [
  { kam_id: 'ZB', share: 0.75 },
  { kam_id: 'ZC', share: 0.25 },
])
eq('Remoto: sin zona', shares.get('99999'), [{ kam_id: null, share: 1 }])
const sharesSinCamas = municipioZoneShares(
  [
    { municipality_id: '05001', kam_id: 'Z1', beds: null },
    { municipality_id: '05001', kam_id: 'Z1', beds: 0 },
    { municipality_id: '05001', kam_id: 'Z2', beds: null },
  ],
  new Map()
)
eq('sin camas: por número de IPS (2/3, 1/3)', sharesSinCamas.get('05001')?.map(s => [s.kam_id, Math.round(s.share * 1000) / 1000]), [
  ['Z1', 0.667],
  ['Z2', 0.333],
])
const sharesTotal = Array.from(shares.values()).every(list => near(list.reduce((sum, s) => sum + s.share, 0), 1))
check('cada municipio reparte exactamente 1 (nunca se cuenta dos veces)', sharesTotal)

console.log('\nGiros por IPS y capacidad')
const giroMap = hospitalGiroMap(hospitals, giros)
eq('giro por IPS (NIT único → entero)', [giroMap.get('h1'), giroMap.get('h2'), giroMap.get('h3'), giroMap.get('h4')], [900, 100, 1000, 0])
const shared = hospitalGiroMap(
  [
    { id: 'a', code: '900000001-1', beds: 30 },
    { id: 'b', code: '900000001-2', beds: 10 },
  ],
  [{ nit: '900000001', total: 400 }]
)
eq('NIT compartido: reparto por camas (300/100)', [shared.get('a'), shared.get('b')], [300, 100])
eq('camas: las del REPS mandan sobre las de la ficha', [camasCapacidad({ beds: 50, reps_beds: 80 }), camasCapacidad({ beds: 50, reps_beds: null }), camasCapacidad({ beds: null, reps_beds: null })], [80, 50, 0])
eq('camas del REPS en 0 se respetan (no caen a la ficha)', camasCapacidad({ beds: 50, reps_beds: 0 }), 0)

eq(
  'adres_giros_intel: suma contributivo + subsidiado, ignora "otro", claves faltantes = 0, descarta sin NIT y total 0',
  parseGirosIntelTotals(
    {
      nits: [
        { nit: '1', total: 999, contributivo: '100.50', subsidiado: 50, otro: 800 },
        { nit: '2', total: 10, otro: 10 },
        { nit: '3', subsidiado: 7 },
        { total: 5 },
        null,
      ],
      eps: {},
    },
    ['contributivo', 'subsidiado']
  ),
  [
    { nit: '1', total: 150.5 },
    { nit: '3', total: 7 },
  ]
)
eq('adres_giros_intel: entrada inválida → []', [parseGirosIntelTotals(null, ['subsidiado']), parseGirosIntelTotals({ nits: 'x' }, ['subsidiado'])], [[], []])

console.log('\nFórmulas básicas')
eq('pesos del potencial suman 1', POTENCIAL_PESOS.afiliados + POTENCIAL_PESOS.giros + POTENCIAL_PESOS.capacidad, 1)
eq('afiliados ponderados = contributivo × 1 + subsidiado × 0,6', afiliadosPonderados(1000, 500), 1000 * AFILIADOS_PESOS.contributivo + 500 * AFILIADOS_PESOS.subsidiado)
eq('afiliados ponderados con negativos o NaN → 0', afiliadosPonderados(-5, Number.NaN), 0)
eq('cobertura 1.600 / 2.000 = 80 %', coberturaPct(1600, 2000), 80)
eq('cobertura sin población → null (sin división por cero)', [coberturaPct(10, 0), coberturaPct(10, null)], [null, null])
eq('cobertura puede pasar de 100 %', coberturaPct(110, 100), 110)

console.log('\nÍndice potencial')
const pot = computePotencial([
  { afiliadosPonderados: 100, giros: 50, camas: 10, quirofanos: 0 },
  { afiliadosPonderados: 50, giros: 100, camas: 0, quirofanos: 0 },
  { afiliadosPonderados: 0, giros: 0, camas: 20, quirofanos: 0 },
])
eq('potencial sin quirófanos: 100×(0,5×1 + 0,3×0,5 + 0,2×0,5) = 75', pot.rows[0].potencial, 75)
eq('potencial fila 2: 100×(0,5×0,5 + 0,3×1 + 0) = 55', pot.rows[1].potencial, 55)
eq('potencial fila 3: solo capacidad máxima = 20', pot.rows[2].potencial, 20)
eq('detalle normalizado de la fila 1', pot.rows[0].potencialDetalle, { afiliados: 1, giros: 0.5, capacidad: 0.5 })
check('sin quirófanos en el conjunto → capacidad solo con camas', pot.conQuirofanos === false)
const potCero = computePotencial([
  { afiliadosPonderados: 0, giros: 0, camas: 0, quirofanos: 0 },
  { afiliadosPonderados: 0, giros: 0, camas: 0, quirofanos: 0 },
])
eq('todo en cero → potencial 0 (sin división por cero ni NaN)', potCero.rows.map(r => r.potencial), [0, 0])
eq('conjunto vacío → sin filas', computePotencial([]).rows.length, 0)
const potQuir = computePotencial([
  { afiliadosPonderados: 0, giros: 0, camas: 10, quirofanos: 0 },
  { afiliadosPonderados: 0, giros: 0, camas: 0, quirofanos: 4 },
])
check('con quirófanos → capacidad = promedio de camas y quirófanos normalizados', potQuir.conQuirofanos && potQuir.rows[0].potencial === 10 && potQuir.rows[1].potencial === 10, potQuir.rows.map(r => r.potencial))
const potMax = computePotencial([{ afiliadosPonderados: 7, giros: 3, camas: 2, quirofanos: 1 }])
eq('una sola fila con todo → 100', potMax.rows[0].potencial, 100)
check('potencial siempre entre 0 y 100', [...pot.rows, ...potQuir.rows, ...potMax.rows].every(r => r.potencial >= 0 && r.potencial <= 100))

console.log('\nTop EPS')
const epsMap = new Map([
  ['A', { nombre: 'Zeta', afiliados: 10 }],
  ['B', { nombre: 'Alfa', afiliados: 10 }],
  ['C', { nombre: 'Beta', afiliados: 30 }],
  ['D', { nombre: 'Nula', afiliados: 0 }],
])
eq('top 2: por afiliados y desempate alfabético; % del total', topEps(epsMap, 2), [
  { codigo: 'C', nombre: 'Beta', afiliados: 30, pct: 60 },
  { codigo: 'B', nombre: 'Alfa', afiliados: 10, pct: 20 },
])
eq('EPS con 0 afiliados no aparecen', topEps(epsMap, 10).map(e => e.codigo), ['C', 'B', 'A'])
eq('top EPS vacío', topEps(new Map(), 5), [])

console.log('\nEPS de la BDUA')
eq('misma EPS en contributivo, subsidiado y movilidad → misma clave', [epsGroupKey('NUEVA EPS S.A.'), epsGroupKey('NUEVA EPS S.A. -CM'), epsGroupKey('PROTEGER EPS S.A.S.-CM')], ['NUEVA EPS S A', 'NUEVA EPS S A', 'PROTEGER EPS S A S'])
eq('comillas truncadas no separan la EPS', epsGroupKey('ALIANZA MEDELLIN ANTIOQUIA EPS S.A.S. "SAVIA SALUD EPS'), epsGroupKey('ALIANZA MEDELLIN ANTIOQUIA EPS S.A.S. "SAVIA SALUD EPS" -CM'))
eq('nombres cortos', [epsDisplayName('EPS SURAMERICANA S.A. -CM'), epsDisplayName('SALUD TOTAL ENTIDAD PROMOTORA DE SALUD DEL REGIMEN CONTRIBUTIVO Y DEL REGIMEN SUBSIDIADO S.A.'), epsDisplayName('ENTIDAD PROMOTORA DE SALUD SANITAS S.A.S.')], ['EPS Sura', 'Salud Total EPS', 'EPS Sanitas'])
eq('EPS desconocida: nombre limpio; sin nombre: código', [epsDisplayName('FONDO PASIVO SOCIAL "FERROCARRILES" -CM'), epsDisplayName(null, 'EAS027')], ['FONDO PASIVO SOCIAL FERROCARRILES', 'EAS027'])
const merged = mergeBduaEps(
  [
    { municipio: '05001', eps_id: 'EPS037', afiliados: 100 },
    { municipio: '05001', eps_id: 'EPSS41', afiliados: 50 },
    { municipio: '05001', eps_id: 'EPSS37', afiliados: 5 },
    { municipio: '05001', eps_id: 'EPS010', afiliados: 70 },
    { municipio: '08001', eps_id: 'EPS037', afiliados: 9 },
    { municipio: '08001', eps_id: 'XXX', afiliados: 1 },
  ],
  { EPS037: 'NUEVA EPS S.A.', EPSS41: 'NUEVA EPS S.A.', EPSS37: 'NUEVA EPS S.A. -CM', EPS010: 'EPS SURAMERICANA S.A.' }
)
eq('mergeBduaEps: une códigos por nombre y por municipio; código = menor eps_id del grupo', merged.map(r => [r.municipio, r.eps_codigo, r.eps_nombre, r.afiliados]), [
  ['05001', 'EPS037', 'Nueva EPS', 155],
  ['05001', 'EPS010', 'EPS Sura', 70],
  ['08001', 'EPS037', 'Nueva EPS', 9],
  ['08001', 'XXX', 'XXX', 1],
])
const mergedCruzado = mergeBduaEps(
  [
    { municipio: 'A', eps_id: 'EPSS41', afiliados: 1 },
    { municipio: 'B', eps_id: 'EPS037', afiliados: 2 },
  ],
  { EPSS41: 'NUEVA EPS S.A.', EPS037: 'NUEVA EPS S.A.' }
)
eq('mergeBduaEps: el mismo código en municipios con distintos eps_id (las zonas suman la misma EPS)', mergedCruzado.map(r => r.eps_codigo), ['EPS037', 'EPS037'])
eq('corte BDUA más cercano', [closestCorte('2026-08-15', ['2026-10-05', '2026-07-20']), closestCorte('2026-08-31', ['2026-10-05', '2026-07-20']), closestCorte(null, ['2026-07-20', '2026-10-05']), closestCorte('2026-08-31', [])], ['2026-07-20', '2026-10-05', '2026-10-05', null])

const bduaFicha = summarizeBduaRows([
  { municipality_code: '05001', regimen: 'contributivo', eps_id: 'EPS037', eps_nombre: 'NUEVA EPS S.A.', estado: 'Activo', afiliados: 10 },
  { municipality_code: '05001', regimen: 'subsidiado', eps_id: 'EPSS41', eps_nombre: 'NUEVA EPS S.A.', estado: 'Activo', afiliados: '20' },
  { municipality_code: '05001', regimen: 'contributivo', eps_id: 'EPS037', eps_nombre: 'NUEVA EPS S.A.', estado: 'Protección Laboral C', afiliados: 99 },
  { municipality_code: '05001', regimen: 'contributivo', eps_id: 'EPS010', eps_nombre: 'EPS SURAMERICANA S.A.', estado: 'ACTIVO', afiliados: 5 },
  { municipality_code: null, regimen: 'contributivo', eps_id: 'EPS010', eps_nombre: 'EPS SURAMERICANA S.A.', estado: 'Activo', afiliados: 1000 },
])
eq('BDUA ficha: solo activos y con municipio, por régimen', bduaFicha.regimen.map(r => [r.regimen, r.afiliados]), [
  ['contributivo', 15],
  ['subsidiado', 20],
])
eq('BDUA ficha: EPS unidas por nombre', bduaFicha.eps.map(r => [r.eps_nombre, r.afiliados]), [
  ['Nueva EPS', 30],
  ['EPS Sura', 5],
])

console.log('\nAgregación por municipio')
const byMunicipio = aggregatePoblacion({ group: 'municipio', municipios, eps, hospitals, giros, reach, zoneNames, coverage: null, filter: {} })
const baq = byMunicipio.rows.find(r => r.key === '08001')!
eq('Barranquilla: afiliados por régimen', [baq.contributivo, baq.subsidiado, baq.excepcion, baq.afiliados], [1000, 500, 100, 1600])
eq('Barranquilla: cobertura y % contributivo', [baq.cobertura, baq.pctContributivo], [80, 62.5])
eq('Barranquilla: giros, IPS, camas (REPS manda), quirófanos', [baq.giros, baq.ips, baq.ipsConGiro, baq.camas, baq.quirofanos], [1000, 2, 2, 180, 4])
eq('Barranquilla: zonas y top EPS', [baq.zonas, baq.topEps.map(e => e.codigo)], [['Atlántico'], ['EPS1', 'EPS2']])
const bog = byMunicipio.rows.find(r => r.key === '11001')!
check('Bogotá marcada como compartida entre 2 zonas', bog.compartido && bog.zonas.length === 2, bog)
eq('Bogotá: 3 IPS (incluida la sin zona), giro 1.000', [bog.ips, bog.giros], [3, 1000])
const remoto = byMunicipio.rows.find(r => r.key === '99999')!
eq('Remoto sin afiliación: afiliados 0, cobertura null (no 0 %), marcado sin afiliación', [remoto.afiliados, remoto.cobertura, remoto.municipiosSinAfiliacion], [0, null, 1])
eq('KPIs: afiliados, población; cobertura solo sobre municipios con cifras (6.700 / 7.100)', [byMunicipio.kpis.afiliados, byMunicipio.kpis.poblacion, byMunicipio.kpis.cobertura], [6700, 7150, 94.4])
eq('KPIs: municipios, con afiliación, desde BDUA', [byMunicipio.kpis.municipios, byMunicipio.kpis.municipiosConAfiliacion, byMunicipio.kpis.municipiosDesdeBdua], [4, 3, 1])
eq('KPIs: giros totales e IPS', [byMunicipio.kpis.giros, byMunicipio.kpis.ips], [2000, 5])
check('filas ordenadas por potencial descendente', byMunicipio.rows.every((r, i, all) => i === 0 || all[i - 1].potencial >= r.potencial))
const maxPot = Math.max(...byMunicipio.rows.map(r => r.potencial))
check('potencial normalizado sobre el conjunto (máximo ≤ 100)', maxPot <= 100 && maxPot > 0, maxPot)

console.log('\nAgregación por zona (reparto de Bogotá por camas)')
const byZona = aggregatePoblacion({ group: 'zona', municipios, eps, hospitals, giros, reach, zoneNames, coverage: null, filter: {} })
const za = byZona.rows.find(r => r.key === 'ZA')!
const zb = byZona.rows.find(r => r.key === 'ZB')!
const zc = byZona.rows.find(r => r.key === 'ZC')!
const sinZona = byZona.rows.find(r => r.key === 'sin_zona')!
eq('ZA = Barranquilla + Pueblo (alcance)', [za.contributivo, za.subsidiado, za.afiliados, za.poblacion, za.municipios], [1010, 590, 1700, 2100, 2])
eq('ZB = 75 % de Bogotá', [zb.contributivo, zb.subsidiado, zb.poblacion], [3000, 750, 3750])
eq('ZC = 25 % de Bogotá', [zc.contributivo, zc.subsidiado, zc.poblacion], [1000, 250, 1250])
eq('giros por zona asignada de cada IPS', [za.giros, zb.giros, zc.giros], [1000, 1000, 0])
eq('Sin zona: población de Remoto + IPS sin zona en Bogotá; cobertura null', [sinZona.poblacion, sinZona.ips, sinZona.camas, sinZona.cobertura], [50, 1, 1000, null])
const sumAfiliados = byZona.rows.reduce((sum, r) => sum + r.afiliados, 0)
eq('la suma de afiliados por zona = total del país (nada se cuenta dos veces)', sumAfiliados, byZona.kpis.afiliados)
eq('top EPS de ZB: Sura 1.500, Sanitas 750', zb.topEps.map(e => [e.codigo, e.afiliados, e.pct]), [
  ['EPS2', 1500, 66.7],
  ['EPS3', 750, 33.3],
])
eq('top EPS de ZA suma Barranquilla + Pueblo', za.topEps.map(e => [e.codigo, e.afiliados]), [
  ['EPS1', 700],
  ['EPS2', 300],
])

console.log('\nAgregación por Ejecutivo Comercial')
const coverage = new Map<string, CoverageForZone>([
  ['ZA', { kind: 'local', executive: { id: 'E1', full_name: 'Ana', color: '#111111' } }],
  ['ZB', { kind: 'reach', executive: { id: 'E1', full_name: 'Ana', color: '#111111' } }],
  ['ZC', { kind: 'vacant', executive: null }],
])
const byEjecutivo = aggregatePoblacion({ group: 'ejecutivo', municipios, eps, hospitals, giros, reach, zoneNames, coverage, filter: {} })
const ana = byEjecutivo.rows.find(r => r.key === 'E1')!
const vacante = byEjecutivo.rows.find(r => r.key === 'vacante')!
eq('Ana cubre ZA + ZB', [ana.label, ana.zonas, ana.afiliados, ana.giros], ['Ana', ['Atlántico', 'Bogotá – Norte'], 1700 + 3750, 2000])
eq('ZC sin ejecutivo → Vacante (gris)', [vacante.label, vacante.color, vacante.afiliados], ['Vacante', '#9ca3af', 1250])
const byMunicipioLinea = aggregatePoblacion({ group: 'municipio', municipios, eps, hospitals, giros, reach, zoneNames, coverage, filter: {} })
eq('municipio con línea: ejecutivo de la zona principal', byMunicipioLinea.rows.find(r => r.key === '11001')?.ejecutivo, 'Ana')

console.log('\nFiltros')
const soloAtlantico = aggregatePoblacion({ group: 'zona', municipios, eps, hospitals, giros, reach, zoneNames, coverage: null, filter: { departamento: '08' } })
eq('departamento 08: solo ZA', soloAtlantico.rows.map(r => r.key), ['ZA'])
eq('departamento 08: KPIs del filtro', [soloAtlantico.kpis.afiliados, soloAtlantico.kpis.municipios, soloAtlantico.kpis.ips], [1700, 2, 2])
const soloBogota = aggregatePoblacion({ group: 'municipio', municipios, eps, hospitals, giros, reach, zoneNames, coverage: null, filter: { municipio: '11001' } })
eq('municipio 11001: una fila', soloBogota.rows.map(r => r.key), ['11001'])
eq('un solo grupo filtrado → su potencial normalizado es el máximo (100 si es máximo en todo)', soloBogota.rows[0].potencial, 100)
const vacio = aggregatePoblacion({ group: 'municipio', municipios, eps, hospitals, giros, reach, zoneNames, coverage: null, filter: { departamento: '05' } })
eq('filtro sin datos: sin filas y KPIs en cero', [vacio.rows.length, vacio.kpis.afiliados, vacio.kpis.cobertura, vacio.kpis.pctContributivo], [0, 0, null, null])

console.log('\nResolución de fuentes por municipio')
const resolved = resolveMunicipios({
  municipalities: [
    { code: '08001', name: 'Barranquilla', department_code: '08', population_2025: 1 },
    { code: '08002', name: 'Pueblo', department_code: '08', population_2025: 77 },
    { code: '08003', name: 'Vacío', department_code: '08', population_2025: null },
  ],
  departmentNames: new Map([['08', 'Atlántico']]),
  cifras: [{ municipio: '08001', contributivo: 10, subsidiado: 20, excepcion: 3, poblacion: 40 }],
  bdua: [
    { municipio: '08001', regimen: 'Contributivo', afiliados: 999 },
    { municipio: '08002', regimen: 'Contributivo', afiliados: 5 },
    { municipio: '08002', regimen: 'Subsidiado', afiliados: 7 },
    { municipio: '08002', regimen: 'Otro', afiliados: 100 },
  ],
  dane: new Map([['08001', 50]]),
})
eq('afiliacion_cifras manda sobre la BDUA; DANE manda sobre cifras', [resolved[0].fuente, resolved[0].contributivo, resolved[0].poblacion, resolved[0].poblacion_fuente], ['cifras', 10, 50, 'dane'])
eq('sin cifras → BDUA por régimen (ignora régimen desconocido); población de municipalities', [resolved[1].fuente, resolved[1].contributivo, resolved[1].subsidiado, resolved[1].excepcion, resolved[1].poblacion_fuente], ['bdua', 5, 7, 0, 'municipalities'])
eq('sin ninguna fuente → nulls', [resolved[2].fuente, resolved[2].contributivo, resolved[2].poblacion], [null, null, null])
eq('regímenes', ['Contributivo', 'SUBSIDIADO', 'Excepción & Especiales', 'Especiales', 'otro'].map(normalizeRegimen), ['contributivo', 'subsidiado', 'excepcion', 'excepcion', null])

console.log('\nFicha: entorno y ranking de giros del municipio')
const entorno = summarizeEntorno(municipios[2], eps)
eq('entorno Bogotá: afiliados, cobertura, % contributivo', [entorno.afiliados, entorno.cobertura, entorno.pctContributivo], [5000, 100, 80])
eq('entorno: top 3 EPS solo del municipio', entorno.topEps.map(e => e.codigo), ['EPS2', 'EPS3'])
const entornoSin = summarizeEntorno(municipios[3], eps)
eq('entorno sin afiliación: nulls', [entornoSin.afiliados, entornoSin.cobertura, entornoSin.topEps.length], [null, null, 0])
const rankH3 = rankInMunicipio(hospitals, giroMap, 'h3')
eq('ranking: h3 es 1.ª de 1 con giro entre 3 IPS de Bogotá', rankH3, { posicion: 1, conGiro: 1, totalIps: 3, giro: 1000, giroMunicipio: 1000, pct: 100 })
const rankH4 = rankInMunicipio(hospitals, giroMap, 'h4')
eq('ranking: IPS sin giro → posición null', [rankH4?.posicion, rankH4?.pct], [null, 0])
const rankH2 = rankInMunicipio(hospitals, giroMap, 'h2')
eq('ranking: h2 es 2.ª en Barranquilla con 10 %', [rankH2?.posicion, rankH2?.conGiro, rankH2?.pct], [2, 2, 10])
eq('ranking: IPS inexistente → null', rankInMunicipio(hospitals, giroMap, 'nope'), null)

console.log('\nParámetros y corte')
const q = (s: string) => parsePoblacionQuery(new URLSearchParams(s))
eq('por defecto: municipio', q('').ok && (q('') as { value: { group: string } }).value.group, 'municipio')
eq('group inválido', q('group=ips').ok, false)
eq('ejecutivo exige línea', q('group=ejecutivo').ok, false)
eq('ejecutivo con línea', q('group=ejecutivo&line=columna').ok, true)
eq('corte YYYY-MM', [q('corte=2026-08').ok, q('corte=2026-13').ok, q('corte=08-2026').ok], [true, false, false])
eq('departamento y municipio DANE', [q('departamento=8').ok, q('municipio=0800').ok, q('departamento=08&municipio=08001').ok], [false, false, true])
eq('línea con caracteres raros', q('line=a;b').ok, false)
eq('corte por defecto = el más reciente', resolveCorte(null, ['2025-07', '2026-08', '2026-01']), '2026-08')
eq('corte pedido disponible', resolveCorte('2026-01', ['2025-07', '2026-08', '2026-01']), '2026-01')
eq('corte pedido no disponible → undefined (400)', resolveCorte('2024-01', ['2025-07']), undefined)
eq('sin cortes → null', resolveCorte(null, []), null)

eq('año DANE: el del corte; si no está, el más cercano; sin años → null', [pickDaneYear('2026-08-31', [2025, 2026, 2027]), pickDaneYear('2040-01-31', [2025, 2035]), pickDaneYear(null, [2020, 2026], new Date('2026-10-11T00:00:00Z')), pickDaneYear('2026-08-31', [])], [2026, 2035, 2026, null])

console.log('\nCSV')
const csv = buildPoblacionCsv({ group: 'municipio', line: null, rows: [{ ...baq, label: '=Barranquilla' }] })
check('CSV con BOM, ";" y CRLF', csv.startsWith('﻿') && csv.includes(';') && csv.endsWith('\r\n'))
check('CSV protege contra fórmulas', csv.includes("'=Barranquilla"))
check('CSV decimales con coma (es-CO)', csv.includes(';62,5;'), csv)
const csvEj = buildPoblacionCsv({ group: 'ejecutivo', line: { code: 'columna' }, rows: byEjecutivo.rows })
check('CSV por ejecutivo con columna Zonas', csvEj.split('\r\n')[0].includes('Ejecutivo Comercial;Zonas;Municipios'))

console.log(`\n${passed} pruebas OK, ${failed} fallidas`)
process.exit(failed > 0 ? 1 : 0)
