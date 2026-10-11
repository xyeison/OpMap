/**
 * Fase 3 · Pruebas puras de los giros ADRES (sin red ni base de datos).
 *
 * Cubre: lectura del CSV/XML del Reporte 29 (con muestras literales descargadas de la ADRES el
 * 2026-10-11), valores es-CO ("903.103.531,00" → 903103531), meses ("Enero-2025"), NIT desde
 * hospitals.code, mapeo de columnas por contenido, suma de duplicados, rangos de meses, reparto del giro
 * de un NIT entre sus sedes y agregación por municipio / zona / ejecutivo.
 * "Identifica tu Giro" (sección 7, muestras literales del 2026-10-11): CSV y XML de "Consulta tu Giro",
 * fecha, entidad ordenadora, proceso y referencia, regla de régimen, huella y ocurrencias, validación
 * XML↔CSV, ventanas de consulta, agregación mensual, fuente automática y agregación por régimen/entidad.
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
  aggregateDetalleMensual,
  buildDetalleRows,
  crossCheckExports,
  detalleKey,
  parseEntidad,
  parseFechaGiro,
  parseIdentificaCsv,
  parseIdentificaXml,
  procesoYReferencia,
  regimenDeConcepto,
  splitDateWindows,
  sumByRegimen,
} from '../lib/adres-identifica.mjs'
import {
  addMonths,
  aggregateGiros,
  chooseGirosSource,
  epsDisplayName,
  parseGirosQuery,
  parseIntel,
  parseResumen,
  resolveGirosRange,
  sedeShares,
  summarizeHospitalDetalle,
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
eq('serie mensual (Reporte 29: todo subsidiado)', all.series, [
  { periodo: '2025-05', total: 500, capitacion: 500, evento: 0, contributivo: 0, subsidiado: 500, otro: 0 },
  { periodo: '2025-06', total: 800, capitacion: 0, evento: 800, contributivo: 0, subsidiado: 800, otro: 0 },
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
eq('query por defecto', q(''), {
  ok: true,
  value: { group: 'ips', line: null, desde: null, hasta: null, departamento: null, municipio: null, regimen: 'todos', fuente: 'auto' },
})
eq('query regimen y fuente', [q('regimen=contributivo&fuente=identifica')], [
  { ok: true, value: { group: 'ips', line: null, desde: null, hasta: null, departamento: null, municipio: null, regimen: 'contributivo', fuente: 'identifica' } },
])
eq('regimen no válido', q('regimen=otro').ok, false)
eq('fuente no válida', q('fuente=bdua').ok, false)
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

console.log('\n7. Identifica tu Giro (ERP, "Consulta tu Giro")')

// NIT 890102768, exportación CSV (literal: BOM, CRLF, sin comillas, valor redondeado a pesos con "$")
const CSV_IDENT =
  '﻿Cuenta_Beneficiario,Nombre_Beneficiario,Fecha_Transaccion,Valor,Concepto,Nombre_Beneficiario2\r\n' +
  '890102768,NIT-890102768-ORGANIZACION CLINICA GENERAL DEL NORTE SA,27/01/2026,$177.773.524,PAGO Proc. Compensación Giro Directo (IPS) GIRO DIRECTO RECURSOS UPC DISTRIBUCION IPS Proceso 12056 CGD_Proc_12041_EPS005_269_C,NIT-800251440-ENTIDAD PROMOTORA DE SALUD SANITAS S A S\r\n' +
  '890102768,NIT-890102768-ORGANIZACION CLINICA GENERAL DEL NORTE SA,16/01/2026,$89.867.506,PAGO Régimen Subsidiado UPC REGIMEN SUBSIDIADO - CXP IPS   LMA_178_IPS,NIT-800098911-SECRETARIA DE EDUCACIONMUNICIPAL DE VALLEDUPAR\r\n' +
  '890102768,NIT-890102768-ORGANIZACION CLINICA GENERAL DEL NORTE,13/08/2026,$345.716,PAGO Reclamaciones VICTIMAS ACCIDENTES DE TRANSITO_SERVICIOS MEDICOS 20264200086643 Paquete_31073,NIT-890102768-ORGANIZACION CLINICA GENERAL DEL NORTE\r\n' +
  '\r\n'
// El mismo reporte en XML (literal: valores con centavos)
const XML_IDENT =
  '﻿<?xml version="1.0" encoding="utf-8"?><Report xsi:schemaLocation="Consulta_Pagos_ERP http://bdprep02/ReportServer?%2FERP%2FConsulta_Pagos_ERP&amp;rs%3ACommand=Render&amp;rs%3AFormat=XML&amp;rc%3ASchema=True" Name="Consulta_Pagos_ERP" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns="Consulta_Pagos_ERP"><Tablix1><Details_Collection>' +
  '<Details Cuenta_Beneficiario="890102768" Nombre_Beneficiario="NIT-890102768-ORGANIZACION CLINICA GENERAL DEL NORTE SA" Fecha_Transaccion="27/01/2026" Valor="177773524.0000000000000000" Concepto="PAGO Proc. Compensación Giro Directo (IPS) GIRO DIRECTO RECURSOS UPC DISTRIBUCION IPS Proceso 12056 CGD_Proc_12041_EPS005_269_C" Nombre_Beneficiario2="NIT-800251440-ENTIDAD PROMOTORA DE SALUD SANITAS S A S" />' +
  '<Details Cuenta_Beneficiario="890102768" Nombre_Beneficiario="NIT-890102768-ORGANIZACION CLINICA GENERAL DEL NORTE SA" Fecha_Transaccion="16/01/2026" Valor="89867506.0000000000000000" Concepto="PAGO Régimen Subsidiado UPC REGIMEN SUBSIDIADO - CXP IPS   LMA_178_IPS" Nombre_Beneficiario2="NIT-800098911-SECRETARIA DE EDUCACIONMUNICIPAL DE VALLEDUPAR" />' +
  '<Details Cuenta_Beneficiario="890102768" Nombre_Beneficiario="NIT-890102768-ORGANIZACION CLINICA GENERAL DEL NORTE" Fecha_Transaccion="13/08/2026" Valor="345716.3000000000000000" Concepto="PAGO Reclamaciones VICTIMAS ACCIDENTES DE TRANSITO_SERVICIOS MEDICOS 20264200086643 Paquete_31073" Nombre_Beneficiario2="NIT-890102768-ORGANIZACION CLINICA GENERAL DEL NORTE" />' +
  '</Details_Collection></Tablix1></Report>'
// NIT sin giros (literal)
const CSV_IDENT_VACIO = '﻿Cuenta_Beneficiario,Nombre_Beneficiario,Fecha_Transaccion,Valor,Concepto,Nombre_Beneficiario2\r\n\r\n'
const XML_IDENT_VACIO =
  '﻿<?xml version="1.0" encoding="utf-8"?><Report xsi:schemaLocation="Consulta_Pagos_ERP http://bdprep02/ReportServer?%2FERP%2FConsulta_Pagos_ERP&amp;rs%3ACommand=Render" Name="Consulta_Pagos_ERP" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns="Consulta_Pagos_ERP"><Tablix1 /></Report>'

const icsv = parseIdentificaCsv(CSV_IDENT)
check('CSV: cabecera reconocida, 3 filas, 0 saltadas', icsv.headerFound && icsv.rows.length === 3 && icsv.skipped === 0, icsv)
eq('CSV: primera fila', icsv.rows[0], {
  nit: '890102768',
  fecha_giro: '2026-01-27',
  valor: 177773524,
  concepto: 'PAGO Proc. Compensación Giro Directo (IPS) GIRO DIRECTO RECURSOS UPC DISTRIBUCION IPS Proceso 12056 CGD_Proc_12041_EPS005_269_C',
  beneficiario: 'NIT-890102768-ORGANIZACION CLINICA GENERAL DEL NORTE SA',
  ordenadora: 'NIT-800251440-ENTIDAD PROMOTORA DE SALUD SANITAS S A S',
})
eq('CSV: prestador sin el prefijo NIT', icsv.prestador, 'ORGANIZACION CLINICA GENERAL DEL NORTE SA')
eq('CSV: valor redondeado a pesos ("$345.716")', icsv.rows[2].valor, 345716)
eq('CSV: espacios del concepto colapsados', icsv.rows[1].concepto, 'PAGO Régimen Subsidiado UPC REGIMEN SUBSIDIADO - CXP IPS LMA_178_IPS')
const ixml = parseIdentificaXml(XML_IDENT)
check('XML: 3 filas', ixml.headerFound && ixml.rows.length === 3 && ixml.skipped === 0, ixml)
eq('XML: centavos ("345716.30")', ixml.rows[2].valor, 345716.3)
eq('XML: misma fila que el CSV', ixml.rows[0], icsv.rows[0])
eq('XML↔CSV cuadran (diferencia de redondeo 0,30 ≤ medio peso por fila)', crossCheckExports(ixml.rows, icsv.rows), {
  ok: true,
  filasXml: 3,
  filasCsv: 3,
  sumaXml: 267986746.3,
  sumaCsv: 267986746,
  diff: 0.3,
})
check('XML↔CSV no cuadran si falta una fila', !crossCheckExports(ixml.rows, icsv.rows.slice(1)).ok)
check('XML↔CSV no cuadran si un valor cambia', !crossCheckExports(ixml.rows, [{ ...icsv.rows[0], valor: 177773000 }, ...icsv.rows.slice(1)]).ok)
const vacioCsv = parseIdentificaCsv(CSV_IDENT_VACIO)
const vacioXml = parseIdentificaXml(XML_IDENT_VACIO)
check('sin giros: CSV y XML reconocidos con 0 filas', vacioCsv.headerFound && vacioCsv.rows.length === 0 && vacioXml.headerFound && vacioXml.rows.length === 0)
check('HTML de error: no es el reporte (CSV y XML)', !parseIdentificaCsv('<html><body>Error</body></html>').headerFound && !parseIdentificaXml('<html>Error</html>').headerFound)
check('el Reporte 29 no se confunde con "Consulta tu Giro"', !parseIdentificaCsv(CSV_891200679_ENE2025).headerFound)
// El CSV no lleva comillas: una coma dentro del concepto parte la fila y se rearma por contenido
const conComa = parseIdentificaCsv(
  'Cuenta_Beneficiario,Nombre_Beneficiario,Fecha_Transaccion,Valor,Concepto,Nombre_Beneficiario2\r\n' +
    '890102768,NIT-890102768-CLINICA X, S.A.,20/10/2025,$1.000,PAGO Giro A, B y C REF_1,NIT-800130907-SALUD TOTAL, S.A.\r\n'
)
eq('CSV con comas sin comillas: se rearma la fila', [conComa.skipped, conComa.rows[0]], [
  0,
  { nit: '890102768', fecha_giro: '2025-10-20', valor: 1000, concepto: 'PAGO Giro A, B y C REF_1', beneficiario: 'NIT-890102768-CLINICA X, S.A.', ordenadora: 'NIT-800130907-SALUD TOTAL, S.A.' },
])
const malValor = parseIdentificaCsv(CSV_IDENT.replace('$89.867.506', '$89.867.50X'))
eq('CSV: valor ilegible se cuenta como saltada', [malValor.skipped, malValor.rows.length], [1, 2])

eq('parseFechaGiro "27/01/2026"', parseFechaGiro('27/01/2026'), '2026-01-27')
eq('parseFechaGiro "2026-01-27T00:00:00"', parseFechaGiro('2026-01-27T00:00:00'), '2026-01-27')
eq('parseFechaGiro "31/02/2026" → null', parseFechaGiro('31/02/2026'), null)
eq('parseEntidad con NIT', parseEntidad('NIT-800251440-ENTIDAD PROMOTORA DE SALUD SANITAS S A S'), { nit: '800251440', nombre: 'ENTIDAD PROMOTORA DE SALUD SANITAS S A S' })
eq('parseEntidad ente territorial', parseEntidad('NIT-891855017-MUNICIPIO DE YOPAL'), { nit: '891855017', nombre: 'MUNICIPIO DE YOPAL' })
eq('parseEntidad sin prefijo', parseEntidad('ADRES'), { nit: null, nombre: 'ADRES' })
eq('parseEntidad vacío', parseEntidad(''), { nit: null, nombre: null })

const PR = (concepto: string) => procesoYReferencia(concepto)
eq('proceso y referencia de la compensación', PR('PAGO Proc. Compensación Giro Directo (IPS) GIRO DIRECTO RECURSOS UPC DISTRIBUCION IPS Proceso 12056 CGD_Proc_12041_EPS005_269_C'), {
  proceso: '12056',
  referencia: 'CGD_Proc_12041_EPS005_269_C',
})
eq('formato viejo Proceso_<n>_GD_', PR('PAGO Proc. Compensacion Giro Directo (IPS) GIRO DIRECTO RECURSOS UPC DISTRIBUCION IPS Proceso 11690 Proceso_11684_GD_SURA_108'), {
  proceso: '11690',
  referencia: 'Proceso_11684_GD_SURA_108',
})
eq('referencia con espacio tras el proceso', PR('PAGO Proc. Compensacion Giro Directo (IPS) GIRO DIRECTO RECURSOS UPC DISTRIBUCION IPS Proceso 11316 Proceso_11305_GD_COOSALUD MOV'), {
  proceso: '11316',
  referencia: 'Proceso_11305_GD_COOSALUD MOV',
})
eq('proceso sin referencia', PR('PAGO Proc. Compensación Giro Directo (IPS) GIRO DIRECTO RECURSOS UPC DISTRIBUCION IPS Proceso 11802'), { proceso: '11802', referencia: null })
eq('concepto repetido', PR('Proceso_11266_GD_SALUDTOTAL Proceso_11266_GD_SALUDTOTAL'), { proceso: '11266', referencia: 'Proceso_11266_GD_SALUDTOTAL' })
eq('LMA: referencia sin proceso', PR('PAGO Régimen Subsidiado UPC REGIMEN SUBSIDIADO - CXP IPS   LMA_178_IPS'), { proceso: null, referencia: 'LMA_178_IPS' })
eq('referencia con guiones (PM2025-RC-GD1)', PR('PAGO Presupuesto Maximo Regimen Contributivo PRESUPUESTO MAXIMO REGIMEN CONTRIBUTIVO  PM2025-RC-GD1'), { proceso: null, referencia: 'PM2025-RC-GD1' })
eq('"LMA 51" no es referencia', PR('PAGO Regimen Subsidiado REPROGRAMACIONES VIGENCIAS ANTERIORES - URA  LMA 51'), { proceso: null, referencia: null })
eq('"COVID-19" no es referencia', PR('PAGO Giro PRUEBAS COVID-19'), { proceso: null, referencia: null })

eq('régimen: compensación → contributivo', regimenDeConcepto('PAGO Proc. Compensación Giro Directo (IPS) GIRO DIRECTO RECURSOS UPC DISTRIBUCION IPS Proceso 12056 CGD_Proc_12041_EPS005_269_C'), 'contributivo')
eq('régimen: "Compensacion" sin tilde → contributivo', regimenDeConcepto('PAGO Proc. Compensacion Giro Directo (IPS) Proceso 11690 Proceso_11684_GD_SURA_108'), 'contributivo')
eq('régimen: formato viejo sin la palabra → contributivo', regimenDeConcepto('Proceso_11266_GD_SURA Proceso_11266_GD_SURA'), 'contributivo')
eq('régimen: presupuesto máximo contributivo → contributivo', regimenDeConcepto('PAGO Presupuesto Máximo Régimen Contributivo PRESUPUESTO MAXIMO REGIMEN CONTRIBUTIVO 20264200069293 890102768_89_69293'), 'contributivo')
eq('régimen: LMA → subsidiado', regimenDeConcepto('PAGO Régimen Subsidiado UPC REGIMEN SUBSIDIADO - CXP IPS   LMA_178_IPS'), 'subsidiado')
eq('régimen: "LMA IPS DE ABRIL" → subsidiado', regimenDeConcepto('LMA IPS DE ABRIL 2025 LMA_169_IPS'), 'subsidiado')
eq('régimen: presupuesto máximo subsidiado → subsidiado', regimenDeConcepto('PAGO Presupuesto Máximo Régimen Subsidiado PRESUPUESTO MAXIMO REGIMEN SUBSIDIADO 20264200069293 890102768_338_69293'), 'subsidiado')
eq('régimen: reclamaciones SOAT → otro', regimenDeConcepto('PAGO Reclamaciones VICTIMAS ACCIDENTES DE TRANSITO_SERVICIOS MEDICOS 20264200086643 Paquete_31073'), 'otro')
eq('régimen: recobros NO UPC → otro', regimenDeConcepto('PAGO Servicios y tecnologias no upc RECOBROS - SERVICIOS Y TECNOLOGIAS NO UPC  1. NMP_1224_0125_IPS'), 'otro')
eq('régimen: "PALMA" no es LMA → otro', regimenDeConcepto('PAGO Resoluciones del MSPS MUNICIPIO DE PALMAR'), 'otro')

const detalle = buildDetalleRows(ixml.rows)
eq('detalle: orden por fecha desc', detalle.map(r => r.fecha_giro), ['2026-08-13', '2026-01-27', '2026-01-16'])
eq('detalle: compensación enriquecida', detalle[1], {
  nit: '890102768',
  fecha_giro: '2026-01-27',
  valor: 177773524,
  concepto: 'PAGO Proc. Compensación Giro Directo (IPS) GIRO DIRECTO RECURSOS UPC DISTRIBUCION IPS Proceso 12056 CGD_Proc_12041_EPS005_269_C',
  eps_ordenadora_nit: '800251440',
  eps_ordenadora_nombre: 'ENTIDAD PROMOTORA DE SALUD SANITAS S A S',
  proceso: '12056',
  referencia: 'CGD_Proc_12041_EPS005_269_C',
  regimen: 'contributivo',
  ocurrencia: 1,
  clave:
    '890102768|2026-01-27|177773524.00|PAGO Proc. Compensación Giro Directo (IPS) GIRO DIRECTO RECURSOS UPC DISTRIBUCION IPS Proceso 12056 CGD_Proc_12041_EPS005_269_C|800251440|1',
})
eq('detalle: regímenes', detalle.map(r => r.regimen), ['otro', 'contributivo', 'subsidiado'])
const dobles = buildDetalleRows([ixml.rows[1], { ...ixml.rows[1] }, ixml.rows[0]])
eq('giros idénticos el mismo día: ocurrencia 1 y 2 (no se funden)', dobles.filter(r => r.regimen === 'subsidiado').map(r => r.ocurrencia), [1, 2])
check('…y sus claves son distintas', new Set(dobles.map(r => r.clave)).size === 3)
eq('clave estable: mismo giro en otra descarga = misma clave', buildDetalleRows([ixml.rows[0]])[0].clave, detalle[1].clave)
eq(
  'clave: sin NIT de ordenadora usa el nombre',
  detalleKey({ nit: '1', fecha_giro: '2026-01-01', valor: 10, concepto: 'X  Y', eps_ordenadora_nit: null, eps_ordenadora_nombre: 'ADRES' }, 1),
  '1|2026-01-01|10.00|X Y|nombre:ADRES|1'
)
eq('suma por régimen', sumByRegimen(detalle), { total: 267986746.3, contributivo: 177773524, subsidiado: 89867506, otro: 345716.3 })

eq('ventanas de 6 meses (ene-2025 a sep-2026)', splitDateWindows('2025-01-01', '2026-09-30', 6), [
  { desde: '2025-01-01', hasta: '2025-06-30' },
  { desde: '2025-07-01', hasta: '2025-12-31' },
  { desde: '2026-01-01', hasta: '2026-06-30' },
  { desde: '2026-07-01', hasta: '2026-09-30' },
])
eq('ventana con inicio a mitad de mes', splitDateWindows('2025-01-15', '2025-03-10', 6), [{ desde: '2025-01-15', hasta: '2025-03-10' }])
eq('ventanas de 1 mes', splitDateWindows('2024-12-01', '2025-02-28', 1).map(w => w.hasta), ['2024-12-31', '2025-01-31', '2025-02-28'])
eq('ventanas: desde > hasta → []', splitDateWindows('2026-01-01', '2025-01-01', 6), [])

const mensual = aggregateDetalleMensual([
  ...detalle,
  { nit: '890102768', fecha_giro: '2026-01-30', valor: 100.5, regimen: 'contributivo', eps_ordenadora_nit: '800251440', eps_ordenadora_nombre: 'EPS SANITAS' },
])
eq('agregación mensual (como la vista adres_giros_mensual)', mensual, [
  { nit: '890102768', periodo: '2026-01-01', regimen: 'contributivo', eps_ordenadora_nit: '800251440', eps_ordenadora_nombre: 'EPS SANITAS', valor: 177773624.5, giros: 2, ultima_fecha: '2026-01-30' },
  { nit: '890102768', periodo: '2026-01-01', regimen: 'subsidiado', eps_ordenadora_nit: '800098911', eps_ordenadora_nombre: 'SECRETARIA DE EDUCACIONMUNICIPAL DE VALLEDUPAR', valor: 89867506, giros: 1, ultima_fecha: '2026-01-16' },
  { nit: '890102768', periodo: '2026-08-01', regimen: 'otro', eps_ordenadora_nit: '890102768', eps_ordenadora_nombre: 'ORGANIZACION CLINICA GENERAL DEL NORTE', valor: 345716.3, giros: 1, ultima_fecha: '2026-08-13' },
])

// Fuente automática
const SRC = { identifica: { min: '2025-04', max: '2026-09' }, reporte29: { min: '2023-07', max: '2025-06' }, nitsActivos: 700 }
eq('auto: Identifica cargado para 3 de 700 NIT → Reporte 29', chooseGirosSource({ ...SRC, requested: 'auto', desde: null, hasta: null, identificaNitsOk: 3 }).fuente, 'reporte29')
eq('auto: Identifica cargado para 650 de 700 (≥ 90 %) → Identifica', chooseGirosSource({ ...SRC, requested: 'auto', desde: null, hasta: null, identificaNitsOk: 650 }).fuente, 'identifica')
eq('auto: rango 2024 sin detalle → Reporte 29', chooseGirosSource({ ...SRC, requested: 'auto', desde: '2024-01', hasta: '2024-12', identificaNitsOk: 700 }).fuente, 'reporte29')
eq('auto: sin detalle cargado → Reporte 29', chooseGirosSource({ ...SRC, identifica: null, requested: 'auto', desde: null, hasta: null, identificaNitsOk: 0 }).fuente, 'reporte29')
eq('elegida: identifica se respeta aunque esté incompleta', chooseGirosSource({ ...SRC, requested: 'identifica', desde: null, hasta: null, identificaNitsOk: 3 }).fuente, 'identifica')
check(
  'auto: el motivo dice cuántos NIT están cargados',
  chooseGirosSource({ ...SRC, requested: 'auto', desde: null, hasta: null, identificaNitsOk: 3 }).motivo.includes('3 de 700 NIT')
)

// adres_giros_intel() → agregación por régimen y por entidad ordenadora (con reparto por sede)
const intel = parseIntel({
  nits: [
    {
      nit: '800000001',
      total: '1000.00',
      contributivo: 600,
      subsidiado: 300,
      otro: 100,
      ultima: '2026-09-28',
      meses: { '2026-08': { t: 400, rc: 400 }, '2026-09': { t: 600, rc: 200, rs: 300, ro: 100 } },
      eps: { '800088702': 600, '891855017': 300, 'nombre:ADRES': 100 },
    },
    { nit: '800000002', total: 200, subsidiado: 200, ultima: '2026-07-01', meses: { '2026-08': { t: 200, rs: 200 } }, eps: { '891855017': 200 } },
  ],
  eps: { '800088702': 'EPS SURA', '891855017': 'MUNICIPIO DE YOPAL' },
})
eq('parseIntel: claves ausentes valen 0', [intel.nits[1].contributivo, intel.nits[1].meses['2026-08'].rc, intel.nits[0].capitacion], [0, 0, 0])
eq('parseIntel: nombres', intel.epsNombres, { '800088702': 'EPS SURA', '891855017': 'MUNICIPIO DE YOPAL' })
eq('epsDisplayName: "nombre:" sin diccionario', epsDisplayName('nombre:ADRES', intel.epsNombres), 'ADRES')
eq('parseResumen del Reporte 29 (sin regímenes): todo es subsidiado', [resumen[0].subsidiado, resumen[0].meses['2025-05'].rs], [1000, 400])
const porRegimen = aggregateGiros({ hospitals, giros: intel.nits, months: ['2026-08', '2026-09'], filter: {}, group: 'zona', withExecutive: false, epsNombres: intel.epsNombres })
eq('KPIs por régimen (NIT A repartido 75/25, NIT B entero)', [porRegimen.kpis.total, porRegimen.kpis.contributivo, porRegimen.kpis.subsidiado, porRegimen.kpis.regimenOtro], [1200, 600, 500, 100])
eq('último giro de las IPS filtradas', porRegimen.kpis.ultimaFecha, '2026-09-28')
eq('serie por régimen', porRegimen.series, [
  { periodo: '2026-08', total: 600, capitacion: 0, evento: 0, contributivo: 400, subsidiado: 200, otro: 0 },
  { periodo: '2026-09', total: 600, capitacion: 0, evento: 0, contributivo: 200, subsidiado: 300, otro: 100 },
])
eq('top entidades del total', porRegimen.epsTop.map(e => [e.nombre, e.valor, e.pct]), [
  ['EPS SURA', 600, 50],
  ['MUNICIPIO DE YOPAL', 500, 41.67],
  ['ADRES', 100, 8.33],
])
const zonaAtl = porRegimen.rows.find(r => r.label === 'Atlántico y Magdalena')!
eq('fila de zona: régimen, último giro y entidad principal con la parte de la sede (75 %)', [zonaAtl.giro, zonaAtl.contributivo, zonaAtl.ultima_fecha, zonaAtl.eps_top[0]], [
  750,
  450,
  '2026-09-28',
  { codigo: '800088702', nombre: 'EPS SURA', valor: 450, pct: 60 },
])
const sinZonaRow = porRegimen.rows.find(r => r.key === 'sin_zona')!
eq('fila sin zona: NIT B con su entidad', [sinZonaRow.giro, sinZonaRow.ultima_fecha, sinZonaRow.eps_top.map(e => e.nombre)], [200, '2026-07-01', ['MUNICIPIO DE YOPAL']])
const porIps = aggregateGiros({ hospitals, giros: intel.nits, months: ['2026-08', '2026-09'], filter: {}, group: 'ips', withExecutive: false, epsNombres: intel.epsNombres })
eq('fila IPS: entidades top 3 de la sede a2 (25 %)', porIps.rows.find(r => r.hospital_id === 'a2')!.eps_top.map(e => [e.nombre, e.valor]), [
  ['EPS SURA', 150],
  ['MUNICIPIO DE YOPAL', 75],
  ['ADRES', 25],
])

const fichaDet = summarizeHospitalDetalle(
  [
    { periodo: '2026-08-01', regimen: 'contributivo', eps_ordenadora_nit: '800088702', eps_ordenadora_nombre: 'EPS SURA', valor: '400.00', ultima_fecha: '2026-08-20' },
    { periodo: '2026-09-01', regimen: 'subsidiado', eps_ordenadora_nit: '891855017', eps_ordenadora_nombre: 'MUNICIPIO DE YOPAL', valor: 300, ultima_fecha: '2026-09-28' },
    { periodo: '2026-09-01', regimen: 'otro', eps_ordenadora_nit: null, eps_ordenadora_nombre: 'ADRES', valor: 100, ultima_fecha: '2026-09-02' },
    { periodo: '2025-01-01', regimen: 'contributivo', eps_ordenadora_nit: '800088702', eps_ordenadora_nombre: 'EPS SURA', valor: 999, ultima_fecha: '2025-01-05' },
  ],
  ['2026-08', '2026-09'],
  2
)
eq('ficha (Identifica): total por régimen, ignora meses fuera del rango', [fichaDet.total, fichaDet.contributivo, fichaDet.subsidiado, fichaDet.regimenOtro], [800, 400, 300, 100])
eq('ficha (Identifica): último giro', fichaDet.ultimaFecha, '2026-09-28')
eq('ficha (Identifica): top entidad ordenadora', fichaDet.topEps, [
  { codigo: '800088702', nombre: 'EPS SURA', valor: 400, pct: 50 },
  { codigo: '891855017', nombre: 'MUNICIPIO DE YOPAL', valor: 300, pct: 37.5 },
])
eq('ficha (Identifica): serie por régimen', fichaDet.series, [
  { periodo: '2026-08', total: 400, contributivo: 400, subsidiado: 0, otro: 0 },
  { periodo: '2026-09', total: 400, contributivo: 0, subsidiado: 300, otro: 100 },
])
eq('ficha (Reporte 29): régimen subsidiado y último mes', [ficha.subsidiado, ficha.contributivo, ficha.ultimaFecha], [200, 0, '2025-06'])

console.log(`\n${passed} pruebas OK, ${failed} fallidas`)
process.exit(failed > 0 ? 1 : 0)
