/**
 * Fase 3 · Pruebas puras de los giros ADRES (sin red ni base de datos).
 *
 * Cubre: lectura del CSV/XML del Reporte 29 (con muestras literales descargadas de la ADRES el
 * 2026-10-11), valores es-CO ("903.103.531,00" → 903103531), meses ("Enero-2025"), NIT desde
 * hospitals.code, mapeo de columnas por contenido, suma de duplicados, rangos de meses, reparto del giro
 * de un NIT entre sus sedes y agregación por municipio / zona / ejecutivo.
 *
 * Uso (desde web/): npx tsx scripts/adres-check.ts      Código de salida 1 si alguna prueba falla.
 */
import {
  aggregateGiroRows,
  checkReportTotal,
  defaultRange,
  extractExportUrlBase,
  extractFormFields,
  isBlockedPage,
  monthsBetween,
  nitFromHospitalCode,
  normalizeNit,
  parseCsv,
  parseDateArg,
  parseGirosCsv,
  parseGirosXml,
  parseMoney,
  parsePeriodo,
  toAdresDate,
} from '../lib/adres-parse.mjs'
import {
  addMonths,
  aggregateGiros,
  parseGirosQuery,
  parseResumen,
  resolveGirosRange,
  sedeShares,
  summarizeHospitalGiros,
  type GiroNitResumen,
  type IntelHospital,
} from '../lib/adres-intelligence'

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

const near = (a: number, b: number) => Math.abs(a - b) < 0.01

// ---------------------------------------------------------------------------
// Muestras literales (ADRES, Reporte 29, 2026-10-11)
// ---------------------------------------------------------------------------

// NIT 891200679, 01/01/2025–31/01/2025, exportación CSV (con BOM y CRLF, como la entrega la ADRES)
const CSV_891200679_ENE2025 =
  '﻿textbox29,PERIODOENCAB\r\n' +
  'EMPRESA SOCIAL DEL ESTADO HOSPITAL JOSE MARIA HERNANDEZ,Enero-2025 a  Enero-2025\r\n' +
  '\r\n' +
  'PROCESO1,PROCESO,forma_contratacion,ent_id,ent_nombre,valor,Textbox127,Textbox8\r\n' +
  'Enero-2025 - Capitacion,Enero-2025,Capitacion,EPSS37,Nueva Eps,"64.268.466,00","120.193.764,00","1.023.297.295,00"\r\n' +
  'Enero-2025 - Capitacion,Enero-2025,Capitacion,EPSS41,Nueva Eps,"55.925.298,00","120.193.764,00","1.023.297.295,00"\r\n' +
  'Enero-2025 - Evento,Enero-2025,Evento,EPSI03,Asociación Indígena del Cauca,"19.101.638,00","903.103.531,00","1.023.297.295,00"\r\n' +
  'Enero-2025 - Evento,Enero-2025,Evento,EPSS02,Salud Total,"3.701.075,00","903.103.531,00","1.023.297.295,00"\r\n' +
  'Enero-2025 - Evento,Enero-2025,Evento,EPSI05,Mallamas,"388.764.353,00","903.103.531,00","1.023.297.295,00"\r\n' +
  'Enero-2025 - Evento,Enero-2025,Evento,EPSS10,Suramericana,"5.572.232,00","903.103.531,00","1.023.297.295,00"\r\n' +
  'Enero-2025 - Evento,Enero-2025,Evento,EPSS05,Sanitas,"9.856.806,00","903.103.531,00","1.023.297.295,00"\r\n' +
  'Enero-2025 - Evento,Enero-2025,Evento,EPSS41,Nueva Eps,"457.116.845,00","903.103.531,00","1.023.297.295,00"\r\n' +
  'Enero-2025 - Evento,Enero-2025,Evento,EPSS17,Famisanar,"15.943.919,00","903.103.531,00","1.023.297.295,00"\r\n' +
  'Enero-2025 - Evento,Enero-2025,Evento,EPSS34,Capital Salud,"1.957.758,00","903.103.531,00","1.023.297.295,00"\r\n' +
  'Enero-2025 - Evento,Enero-2025,Evento,ESS207,Mutual Ser,"1.088.905,00","903.103.531,00","1.023.297.295,00"\r\n'

// NIT 800058856, 01/01/2026–30/06/2026: sin registros (literal, 112 bytes)
const CSV_SIN_REGISTROS = '﻿textbox29,PERIODOENCAB\r\n\r\nPROCESO1,PROCESO,forma_contratacion,ent_id,ent_nombre,valor,Textbox127,Textbox8\r\n\r\n'

// NIT 891200679, enero-2025, exportación XML (recortada a 3 filas de detalle; atributos literales)
const XML_891200679 =
  '﻿<?xml version="1.0" encoding="utf-8"?><Report xsi:schemaLocation="Giro_x0020_a_x0020_IPS_x0020_PUB http://bdprep02/ReportServer?%2FSII_LMA_WEB%2FGiro%20a%20IPS%20PUB&amp;rs%3ACommand=Render" Name="Giro a IPS PUB" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns="Giro_x0020_a_x0020_IPS_x0020_PUB">' +
  '<table1><table2 textbox29="EMPRESA SOCIAL DEL ESTADO HOSPITAL JOSE MARIA HERNANDEZ" PERIODOENCAB="Enero-2025 a  Enero-2025" /></table1>' +
  '<Tablix3 Textbox8="139295402.00"><Group1_Collection>' +
  '<Group1 PROCESO1="Enero-2025 - Capitacion" Textbox127="120193764.00"><Detalles_Collection>' +
  '<Detalles PROCESO="Enero-2025" forma_contratacion="Capitacion" ent_id="EPSS37" ent_nombre="Nueva Eps" valor="64268466.00" />' +
  '<Detalles PROCESO="Enero-2025" forma_contratacion="Capitacion" ent_id="EPSS41" ent_nombre="Nueva Eps" valor="55925298.00" />' +
  '</Detalles_Collection></Group1>' +
  '<Group1 PROCESO1="Enero-2025 - Evento" Textbox127="19101638.00"><Detalles_Collection>' +
  '<Detalles PROCESO="Enero-2025" forma_contratacion="Evento" ent_id="EPSI03" ent_nombre="Asociaci&#243;n Ind&#237;gena del Cauca" valor="19101638.00" />' +
  '</Detalles_Collection></Group1></Group1_Collection></Tablix3></Report>'

console.log('\n1. Valores, meses y NIT')
eq('parseMoney "903.103.531,00" → 903103531', parseMoney('903.103.531,00'), 903103531)
eq('parseMoney "64.268.466,00"', parseMoney('64.268.466,00'), 64268466)
eq('parseMoney "1.234,5"', parseMoney('1.234,5'), 1234.5)
eq('parseMoney "$ 1.000"', parseMoney('$ 1.000'), 1000)
eq('parseMoney "-2.500,75"', parseMoney('-2.500,75'), -2500.75)
eq('parseMoney "(2.500,00)" contable', parseMoney('(2.500,00)'), -2500)
eq('parseMoney XML "64268466.00" (decimal ".")', parseMoney('64268466.00', '.'), 64268466)
eq('parseMoney auto "64268466.00"', parseMoney('64268466.00'), 64268466)
eq('parseMoney "0,00"', parseMoney('0,00'), 0)
eq('parseMoney texto → null', parseMoney('Nueva Eps'), null)
eq('parseMoney "1.23.4" mal formado → null', parseMoney('1.23.4'), null)
eq('parsePeriodo "Enero-2025"', parsePeriodo('Enero-2025'), '2025-01-01')
eq('parsePeriodo "Septiembre-2024"', parsePeriodo('Septiembre-2024'), '2024-09-01')
eq('parsePeriodo "setiembre 2024"', parsePeriodo('setiembre 2024'), '2024-09-01')
eq('parsePeriodo "Dic-2025"', parsePeriodo('Dic-2025'), '2025-12-01')
eq('parsePeriodo "2025-03"', parsePeriodo('2025-03'), '2025-03-01')
eq('parsePeriodo "03/2025"', parsePeriodo('03/2025'), '2025-03-01')
eq('parsePeriodo "Enero-2025 - Capitacion" → null (columna combinada)', parsePeriodo('Enero-2025 - Capitacion'), null)
eq('parsePeriodo "Foo-2025" → null', parsePeriodo('Foo-2025'), null)
eq('normalizeNit "891200679-0"', normalizeNit('891200679-0'), '891200679')
eq('normalizeNit " 900959048-4" (espacio)', normalizeNit(' 900959048-4'), '900959048')
eq('normalizeNit "800149384-10" (DV de 2 dígitos)', normalizeNit('800149384-10'), '800149384')
eq('normalizeNit "901361882-6 "', normalizeNit('901361882-6 '), '901361882')
eq('normalizeNit "9013620904" (DV pegado)', normalizeNit('9013620904'), '901362090')
eq('normalizeNit "891200679" (sin DV)', normalizeNit('891200679'), '891200679')
eq('normalizeNit "ABC-1" → null', normalizeNit('ABC-1'), null)
eq('normalizeNit null → null', normalizeNit(null), null)
eq('nitFromHospitalCode " 900959048-4"', nitFromHospitalCode(' 900959048-4'), '900959048')
eq('nitFromHospitalCode "800149384-10"', nitFromHospitalCode('800149384-10'), '800149384')
eq('nitFromHospitalCode "9013620904" (DV pegado)', nitFromHospitalCode('9013620904'), '901362090')
eq('nitFromHospitalCode "891200679" sin DV → null (igual que hospitals.nit)', nitFromHospitalCode('891200679'), null)
eq('nitFromHospitalCode "12345678-9" (8 dígitos) → null', nitFromHospitalCode('12345678-9'), null)

console.log('\n2. CSV del Reporte 29')
const csv = parseGirosCsv(CSV_891200679_ENE2025)
eq('prestador', csv.prestador, 'EMPRESA SOCIAL DEL ESTADO HOSPITAL JOSE MARIA HERNANDEZ')
check('cabecera reconocida', csv.headerFound)
eq('11 filas de detalle', csv.rows.length, 11)
eq('primera fila', csv.rows[0], { periodo: '2025-01-01', tipo: 'Capitacion', eps_codigo: 'EPSS37', eps_nombre: 'Nueva Eps', valor: 64268466 })
eq('acentos conservados en el nombre de la EPS', csv.rows[2].eps_nombre, 'Asociación Indígena del Cauca')
const capitacionEne = csv.rows.filter(r => r.tipo === 'Capitacion').reduce((a, r) => a + r.valor, 0)
const eventoEne = csv.rows.filter(r => r.tipo === 'Evento').reduce((a, r) => a + r.valor, 0)
eq('Capitación enero-2025 = 120.193.764 (subtotal del reporte)', capitacionEne, 120193764)
eq('Evento enero-2025 = 903.103.531 (subtotal del reporte)', eventoEne, 903103531)
eq('total del reporte (Textbox8)', csv.reportTotal, 1023297295)
eq('cuadra con la suma de filas', checkReportTotal(csv).ok, true)
const sinRegistros = parseGirosCsv(CSV_SIN_REGISTROS)
check('sin registros: cabecera reconocida y 0 filas', sinRegistros.headerFound && sinRegistros.rows.length === 0, sinRegistros)
const html = parseGirosCsv('<html><body>Error</body></html>')
check('HTML de error: headerFound=false', !html.headerFound)
const bad = parseGirosCsv(CSV_891200679_ENE2025.replace('"64.268.466,00"', '"64.268.466,00X"'))
check('fila con valor ilegible se cuenta como saltada', bad.skipped === 1 && bad.rows.length === 10, { skipped: bad.skipped, rows: bad.rows.length })
check('…y el total ya no cuadra (el script reintenta / registra error)', !checkReportTotal(bad).ok)

// Columnas con nombres técnicos desconocidos: se mapean por contenido
const renamed = CSV_891200679_ENE2025.replace(
  'PROCESO1,PROCESO,forma_contratacion,ent_id,ent_nombre,valor,Textbox127,Textbox8',
  'Textbox1,Textbox2,Textbox3,Textbox4,Textbox5,Textbox6,Textbox127,Textbox8'
)
const byContent = parseGirosCsv(renamed)
eq('mapeo por contenido: 11 filas', byContent.rows.length, 11)
eq('mapeo por contenido: misma primera fila', byContent.rows[0], csv.rows[0])
eq('mapeo por contenido: valor = primera columna de dinero tras el código EPS (no el subtotal)', byContent.rows[3].valor, 3701075)
eq('mapeo por contenido: total del reporte encontrado y cuadra', [byContent.reportTotal, checkReportTotal(byContent).ok], [1023297295, true])

// Columnas en otro orden con nombres "humanos" (como se ven en pantalla)
const human =
  'Nombre EPS,Código EPS,Mes de Proceso,Tipo Contratación,Giro Total\r\n' +
  'Nueva Eps,EPSS41,Febrero-2025,Evento,"774.114.660,00"\r\n' +
  'Salud Total,EPSS02,Febrero-2025,Evento,"29.664.383,00"\r\n'
const humanParsed = parseGirosCsv(human)
eq('cabeceras "humanas" en otro orden', humanParsed.rows, [
  { periodo: '2025-02-01', tipo: 'Evento', eps_codigo: 'EPSS41', eps_nombre: 'Nueva Eps', valor: 774114660 },
  { periodo: '2025-02-01', tipo: 'Evento', eps_codigo: 'EPSS02', eps_nombre: 'Salud Total', valor: 29664383 },
])
eq('parseCsv: comillas escapadas y coma dentro de comillas', parseCsv('a,"b ""c"", d",e\n'), [['a', 'b "c", d', 'e']])

console.log('\n3. XML del Reporte 29 (respaldo)')
const xml = parseGirosXml(XML_891200679)
eq('XML: prestador', xml.prestador, 'EMPRESA SOCIAL DEL ESTADO HOSPITAL JOSE MARIA HERNANDEZ')
eq('XML: 3 filas', xml.rows.length, 3)
eq('XML: entidades decodificadas', xml.rows[2].eps_nombre, 'Asociación Indígena del Cauca')
eq('XML: valor con punto decimal', xml.rows[0].valor, 64268466)
eq('XML: total del reporte cuadra', checkReportTotal(xml).ok, true)
check('XML: texto no XML → headerFound=false', !parseGirosXml('textbox29,PERIODOENCAB').headerFound)

console.log('\n4. Duplicados, rangos y página del reporte')
const dup = aggregateGiroRows([
  { periodo: '2025-01-01', tipo: 'Evento', eps_codigo: 'EPSS41', eps_nombre: null, valor: 100 },
  { periodo: '2025-01-01', tipo: 'Evento', eps_codigo: 'EPSS41', eps_nombre: 'Nueva Eps', valor: 50.5 },
  { periodo: '2025-01-01', tipo: 'Capitacion', eps_codigo: 'EPSS41', eps_nombre: 'Nueva Eps', valor: 7 },
])
eq('duplicados sumados por (mes, tipo, EPS)', dup, [
  { periodo: '2025-01-01', tipo: 'Capitacion', eps_codigo: 'EPSS41', eps_nombre: 'Nueva Eps', valor: 7 },
  { periodo: '2025-01-01', tipo: 'Evento', eps_codigo: 'EPSS41', eps_nombre: 'Nueva Eps', valor: 150.5 },
])
eq('rango por defecto con hoy = 2026-10-11 (24 meses hasta fin del mes pasado)', defaultRange(new Date(2026, 9, 11)), { desde: '2024-10-01', hasta: '2026-09-30' })
eq('rango por defecto en enero (cruza el año)', defaultRange(new Date(2026, 0, 5)), { desde: '2024-01-01', hasta: '2025-12-31' })
eq('parseDateArg "2026-02" fin → último día (no bisiesto)', parseDateArg('2026-02', true), '2026-02-28')
eq('parseDateArg "2024-02" fin → 29 (bisiesto)', parseDateArg('2024-02', true), '2024-02-29')
eq('parseDateArg "01/07/2023"', parseDateArg('01/07/2023', false), '2023-07-01')
eq('parseDateArg "2025-13" → null', parseDateArg('2025-13', false), null)
eq('toAdresDate', toAdresDate('2024-10-01'), '01/10/2024')
eq('monthsBetween cruza el año', monthsBetween('2025-11', '2026-02'), ['2025-11', '2025-12', '2026-01', '2026-02'])
eq('monthsBetween desde > hasta → []', monthsBetween('2026-02', '2025-11'), [])
eq('monthsBetween 24 meses', monthsBetween('2024-10-01', '2026-09-30').length, 24)
eq('addMonths -11', addMonths('2025-06', -11), '2024-07')
eq('resolveGirosRange por defecto: 12 meses hasta el último con datos', resolveGirosRange(null, null, '2025-06'), {
  desde: '2024-07',
  hasta: '2025-06',
  months: monthsBetween('2024-07', '2025-06'),
})
eq('resolveGirosRange sin datos → null', resolveGirosRange(null, null, null), null)
eq('resolveGirosRange recorta a 60 meses', resolveGirosRange('2010-01', '2025-06', '2025-06')?.months.length, 60)
const fields = extractFormFields(
  '<input type="hidden" name="__VIEWSTATE" id="__VIEWSTATE" value="a&amp;b" /><input name="x$txtValue" type="text" disabled="disabled" />' +
    '<input type="submit" name="btn" value="View Report" /><input type="image" name="img" />'
)
eq('extractFormFields: ocultos y textos, sin botones ni imágenes', fields, [['__VIEWSTATE', 'a&b'], ['x$txtValue', '']])
eq(
  'extractExportUrlBase',
  extractExportUrlBase('"ExportUrlBase":"/SII_LMA_WEB/Reserved.ReportViewerWebControl.axd?ReportSession=abc\\u0026OpType=Export\\u0026Format=","x":1'),
  '/SII_LMA_WEB/Reserved.ReportViewerWebControl.axd?ReportSession=abc&OpType=Export&Format='
)
check('isBlockedPage detecta la página del firewall', isBlockedPage('<title> The URL you requested has been blocked</title>'))
check('isBlockedPage no confunde el reporte', !isBlockedPage('<form name="aspnetForm">'))

console.log('\n5. Reparto por sede y agregación por municipio / zona / ejecutivo')
const H = (over: Partial<IntelHospital> & { id: string; code: string }): IntelHospital => ({
  name: over.id,
  municipality_id: '08001',
  municipality_name: 'Barranquilla',
  department_id: '08',
  department_name: 'Atlántico',
  beds: 100,
  kam_id: 'zona-bq',
  zone_name: 'Atlántico y Magdalena',
  executive: { id: 'ex-carmen', full_name: 'Carmen Barrios', color: '#1f77b4' },
  coverage_kind: 'local',
  ...over,
})
const hospitals: IntelHospital[] = [
  // NIT A: 2 sedes (300 y 100 camas) en municipios distintos → 75 % / 25 %
  H({ id: 'a1', code: '800000001-1', beds: 300 }),
  H({ id: 'a2', code: '800000001-1', beds: 100, municipality_id: '13001', municipality_name: 'Cartagena de Indias', department_id: '13', department_name: 'Bolívar', kam_id: 'zona-ctg', zone_name: 'Bolívar', executive: null, coverage_kind: 'vacant' }),
  // NIT B: 1 sede sin zona asignada
  H({ id: 'b1', code: '800000002-2', beds: 50, kam_id: null, zone_name: null, executive: null, coverage_kind: null }),
  // NIT C: 2 sedes sin camas → mitad y mitad
  H({ id: 'c1', code: '800000003-3', beds: 0 }),
  H({ id: 'c2', code: ' 800000003-3', beds: null }),
  // Sin NIT válido
  H({ id: 'x1', code: 'SIN-NIT', beds: 10 }),
  // NIT sin giros
  H({ id: 'd1', code: '800000004-4', beds: 20 }),
]
const shares = sedeShares(hospitals)
check('reparto por camas 75/25', near(shares.get('a1')!, 0.75) && near(shares.get('a2')!, 0.25), Object.fromEntries(shares))
check('sin camas: a partes iguales', near(shares.get('c1')!, 0.5) && near(shares.get('c2')!, 0.5))
const resumen: GiroNitResumen[] = parseResumen([
  { nit: '800000001', total: '1000.00', capitacion: '400.00', evento: '600.00', meses: { '2025-05': { t: 400, c: 400, e: 0 }, '2025-06': { t: 600, c: 0, e: 600 } } },
  { nit: '800000002', total: 200, capitacion: 0, evento: 200, meses: { '2025-06': { t: 200, c: 0, e: 200 } } },
  { nit: '800000003', total: 100, capitacion: 100, evento: 0, meses: { '2025-05': { t: 100, c: 100, e: 0 } } },
  { nit: '899999999', total: 5000, capitacion: 0, evento: 5000, meses: { '2025-05': { t: 5000, c: 0, e: 5000 } } }, // NIT que no está en OpMap
])
eq('parseResumen convierte strings numéricos', resumen[0].total, 1000)
const months = ['2025-05', '2025-06']
const all = aggregateGiros({ hospitals, giros: resumen, months, filter: {}, group: 'ips', withExecutive: true })
eq('total sin contar dos veces el NIT compartido (1000 + 200 + 100)', all.kpis.total, 1300)
eq('NIT ajeno a OpMap no suma', all.kpis.total < 5000, true)
eq('IPS con giro (a1, a2, b1, c1, c2)', all.kpis.ipsConGiro, 5)
eq('IPS con NIT válido', all.kpis.ipsTotal, 6)
eq('IPS sin NIT', all.kpis.ipsSinNit, 1)
eq('NIT con giro', all.kpis.nitsConGiro, 3)
eq('IPS con NIT compartido', all.kpis.ipsConNitCompartido, 4)
eq('asignado = todo menos b1 (sin zona)', all.kpis.asignado, 1100)
eq('% en IPS con zona', all.kpis.asignadoPct, 84.62)
eq('sin zona', all.kpis.sinZona, 200)
eq('capitación / evento', [all.kpis.capitacion, all.kpis.evento, all.kpis.otros], [500, 800, 0])
eq('serie mensual', all.series, [
  { periodo: '2025-05', total: 500, capitacion: 500, evento: 0 },
  { periodo: '2025-06', total: 800, capitacion: 0, evento: 800 },
])
eq('ranking IPS: a1 primero con 750 (75 % de 1000)', [all.rows[0].hospital_id, all.rows[0].giro, all.rows[0].giro_nit, all.rows[0].sedes_nit], ['a1', 750, 1000, 2])
eq('ranking IPS: ejecutivo de la zona y vacante', [all.rows[0].ejecutivo, all.rows.find(r => r.hospital_id === 'a2')?.ejecutivo], ['Carmen Barrios', 'Vacante'])
eq('ranking IPS: solo IPS con giro', all.rows.length, 5)

const porMunicipio = aggregateGiros({ hospitals, giros: resumen, months, filter: {}, group: 'municipio', withExecutive: false })
eq(
  'por municipio',
  porMunicipio.rows.map(r => [r.key, r.giro, r.ips, r.ipsConGiro, r.top_ips]),
  [
    ['08001', 1050, 5, 4, 'a1'],
    ['13001', 250, 1, 1, 'a2'],
  ]
)
eq('por municipio: % suma 100', porMunicipio.rows.reduce((a, r) => a + r.pct, 0), 100)

const porZona = aggregateGiros({ hospitals, giros: resumen, months, filter: {}, group: 'zona', withExecutive: false })
eq(
  'por zona (incluye "Sin zona asignada")',
  porZona.rows.map(r => [r.label, r.giro]),
  [
    ['Atlántico y Magdalena', 850],
    ['Bolívar', 250],
    ['Sin zona asignada', 200],
  ]
)

const porEjecutivo = aggregateGiros({ hospitals, giros: resumen, months, filter: {}, group: 'ejecutivo', withExecutive: true })
eq(
  'por ejecutivo (vacante con sus zonas; sin zona aparte)',
  porEjecutivo.rows.map(r => [r.label, r.giro, r.zonas]),
  [
    ['Carmen Barrios', 850, ['Atlántico y Magdalena']],
    ['Vacante', 250, ['Bolívar']],
    ['Sin zona asignada', 200, []],
  ]
)

const soloBolivar = aggregateGiros({ hospitals, giros: resumen, months, filter: { departamento: '13' }, group: 'ips', withExecutive: false })
eq('filtro departamento 13: solo la parte de la sede de Cartagena', [soloBolivar.kpis.total, soloBolivar.rows.length], [250, 1])
const soloBq = aggregateGiros({ hospitals, giros: resumen, months, filter: { municipio: '08001' }, group: 'ips', withExecutive: false })
eq('filtro municipio 08001', soloBq.kpis.total, 1050)
eq('sin línea no hay columna de ejecutivo', soloBq.rows[0].ejecutivo, null)
const unMes = aggregateGiros({ hospitals, giros: resumen, months: ['2025-06'], filter: {}, group: 'ips', withExecutive: false })
eq('serie: solo los meses pedidos', unMes.series.map(p => p.periodo), ['2025-06'])

console.log('\n6. Parámetros de la API y ficha de IPS')
const q = (s: string) => parseGirosQuery(new URLSearchParams(s))
eq('query por defecto', q(''), { ok: true, value: { group: 'ips', line: null, desde: null, hasta: null, departamento: null, municipio: null } })
eq('group no válido', q('group=foo').ok, false)
eq('ejecutivo exige línea', q('group=ejecutivo'), { ok: false, error: 'Elige una línea para agrupar por Ejecutivo Comercial' })
eq('ejecutivo con línea', q('group=ejecutivo&line=perossal').ok, true)
eq('mes mal formado', q('desde=2025-1').ok, false)
eq('desde > hasta', q('desde=2025-06&hasta=2025-01').ok, false)
eq('municipio de 5 dígitos', q('municipio=0800').ok, false)
const ficha = summarizeHospitalGiros(
  [
    { periodo: '2025-05-01', tipo_contratacion: 'Capitacion', eps_codigo: 'EPSS41', eps_nombre: 'Nueva Eps', valor: '120.00' },
    { periodo: '2025-06-01', tipo_contratacion: 'Evento', eps_codigo: 'EPSS41', eps_nombre: 'Nueva Eps', valor: 30 },
    { periodo: '2025-06-01', tipo_contratacion: 'Evento', eps_codigo: 'EPSI05', eps_nombre: 'Mallamas', valor: 50 },
    { periodo: '2024-01-01', tipo_contratacion: 'Evento', eps_codigo: 'EPSS02', eps_nombre: 'Salud Total', valor: 999 }, // fuera del rango
  ],
  ['2025-05', '2025-06'],
  1
)
eq('ficha: total, capitación, evento (ignora meses fuera del rango)', [ficha.total, ficha.capitacion, ficha.evento], [200, 120, 80])
eq('ficha: top EPS', ficha.topEps, [{ codigo: 'EPSS41', nombre: 'Nueva Eps', valor: 150, pct: 75 }])
eq('ficha: serie', ficha.series, [
  { periodo: '2025-05', total: 120 },
  { periodo: '2025-06', total: 80 },
])

console.log(`\n${passed} pruebas OK, ${failed} fallidas`)
process.exit(failed > 0 ? 1 : 0)
