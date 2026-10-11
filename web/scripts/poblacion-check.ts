/**
 * Fase 4 · Pruebas puras de población (sin red ni base de datos).
 *
 * Cubre: normalización de nombres y resolución nombre + departamento → código DANE con alias
 * (lib/municipio-alias.ts), cobertura como la publica MinSalud, corte mensual, lectura de un XLSX de
 * MinSalud con y sin IdMunicipio (fixture mínima generada aquí con valores literales de agosto-2026 y
 * julio-2025, empaquetada en un ZIP como la entrega MinSalud), lectura de las proyecciones del DANE,
 * URL SoQL de la BDUA, corte desde rowsUpdatedAt y agregación de filas de la BDUA.
 *
 * Uso (desde web/): npx tsx scripts/poblacion-check.ts      Código de salida 1 si alguna prueba falla.
 */
import * as XLSX from 'xlsx'
import {
  computeCobertura,
  createMunicipioResolver,
  normalizeMunicipioName,
  type DepartmentRef,
  type MunicipalityRef,
  type MunicipioAliasRow,
} from '../lib/municipio-alias'
import {
  aggregateBduaRows,
  buildBduaSoqlUrl,
  buildBduaTotalUrl,
  cifrasNameKey,
  corteFromRowsUpdatedAt,
  extractXlsxFromZip,
  lastDayOfMonth,
  normalizeRegimen,
  parseCifrasCorte,
  parseCifrasSheet,
  parseDaneSheet,
  readCifrasWorkbook,
  readDaneWorkbook,
  relativeDiff,
  sumCifras,
  toCount,
} from '../lib/poblacion-parse'

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

function throws(name: string, fn: () => unknown, pattern: RegExp) {
  try {
    fn()
    check(name, false, 'no lanzó error')
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    check(name, pattern.test(message), message)
  }
}

const near = (a: number | null, b: number) => a !== null && Math.abs(a - b) < 1e-12

function xlsxBytes(sheets: Record<string, unknown[][]>): Uint8Array {
  const wb = XLSX.utils.book_new()
  for (const [name, rows] of Object.entries(sheets)) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name)
  return new Uint8Array(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer)
}

function zipBytes(files: Record<string, Uint8Array | string>): Uint8Array {
  const cfb = XLSX.CFB.utils.cfb_new()
  for (const [name, content] of Object.entries(files)) {
    XLSX.CFB.utils.cfb_add(cfb, name, typeof content === 'string' ? Buffer.from(content, 'utf8') : Buffer.from(content))
  }
  return new Uint8Array(XLSX.CFB.write(cfb, { fileType: 'zip', type: 'buffer' }) as Buffer)
}

// ---------------------------------------------------------------------------
console.log('1. Normalización de nombres')
eq('tildes, coma y puntos', normalizeMunicipioName('BOGOTÁ, D.C.'), 'BOGOTA D C')
eq('¥ de la BDUA = Ñ', normalizeMunicipioName('EL PIJI¥O DEL CARMEN'), 'EL PIJINO DEL CARMEN')
eq('paréntesis', normalizeMunicipioName('PATIA (EL BORDO)'), 'PATIA EL BORDO')
eq('doble espacio', normalizeMunicipioName('LA PAZ  ROBLES'), 'LA PAZ ROBLES')
eq('punto pegado', normalizeMunicipioName('S.ANTONIO TEQUENDAMA'), 'S ANTONIO TEQUENDAMA')
eq('Ñ pegada', normalizeMunicipioName('MIRITIÑPARANA'), 'MIRITINPARANA')
eq('diéresis y minúsculas', normalizeMunicipioName('Güicán de la Sierra'), 'GUICAN DE LA SIERRA')
eq('guion', normalizeMunicipioName('Mirití - Paraná'), 'MIRITI PARANA')
eq('null', normalizeMunicipioName(null), '')
eq('idempotente', normalizeMunicipioName(normalizeMunicipioName('San José de Cúcuta')), 'SAN JOSE DE CUCUTA')

// ---------------------------------------------------------------------------
console.log('\n2. Resolución nombre + departamento → código DANE')
const departments: DepartmentRef[] = [
  { code: '05', name: 'Antioquia' },
  { code: '11', name: 'Bogotá D.C.' },
  { code: '47', name: 'Magdalena' },
  { code: '66', name: 'Risaralda' },
  { code: '76', name: 'Valle del Cauca' },
  { code: '91', name: 'Amazonas' },
  { code: '99', name: 'Vichada' },
]
const municipalities: MunicipalityRef[] = [
  { code: '05001', name: 'Medellín', department_code: '05' },
  { code: '05664', name: 'San Pedro de los Milagros', department_code: '05' },
  { code: '05665', name: 'San Pedro de Urabá', department_code: '05' },
  { code: '11001', name: 'Bogotá D.C.', department_code: '11' },
  { code: '47545', name: 'Pijiño del Carmen', department_code: '47' },
  { code: '66170', name: 'Dosquebradas', department_code: '66' },
  { code: '76001', name: 'Cali', department_code: '76' },
  { code: '76111', name: 'Guadalajara de Buga', department_code: '76' },
  { code: '91540', name: 'Puerto Nariño', department_code: '91' },
  // dos municipios ficticios que normalizan igual en el mismo departamento → ambiguo
  { code: '99001', name: 'Santa Rosa', department_code: '99' },
  { code: '99002', name: 'SANTA ROSA', department_code: '99' },
]
const aliases: MunicipioAliasRow[] = [
  { fuente: 'bdua', department_code: '66', nombre_normalizado: 'DOS QUEBRADAS', municipality_code: '66170' },
  { fuente: 'bdua', department_code: '05', nombre_normalizado: 'SAN PEDRO', municipality_code: '05664' },
  { fuente: 'bdua', department_code: '76', nombre_normalizado: 'BUGA', municipality_code: '76111' },
  { fuente: 'bdua', department_code: '76', nombre_normalizado: 'SANTIAGO DE CALI', municipality_code: '76001' },
  { fuente: 'bdua', department_code: '47', nombre_normalizado: 'EL PIJINO DEL CARMEN', municipality_code: '47545' },
  { fuente: 'bdua', department_code: '27', nombre_normalizado: 'NUEVO BELEN DE BAJIRA', municipality_code: '27493' }, // código inexistente → se ignora
  { fuente: 'minsalud_cifras', department_code: '05', nombre_normalizado: 'SAN PEDRO', municipality_code: '05665' }, // ficticio: prueba de prioridad
]
const bdua = createMunicipioResolver({ municipalities, departments, aliases, fuente: 'bdua' })
const minsalud = createMunicipioResolver({ municipalities, departments, aliases, fuente: 'minsalud_cifras' })
const otra = createMunicipioResolver({ municipalities, departments, aliases, fuente: 'dane' })
const sinAlias = createMunicipioResolver({ municipalities, departments })

eq('nombre exacto (tildes)', bdua.resolve('MEDELLIN', 'ANTIOQUIA'), { code: '05001', via: 'nombre' })
eq('alias propio', bdua.resolve('DOS QUEBRADAS', 'RISARALDA'), { code: '66170', via: 'alias' })
eq('departamento por alias fijo (VALLE → 76)', bdua.resolve('BUGA', 'VALLE'), { code: '76111', via: 'alias' })
eq('Cali por alias', bdua.resolve('SANTIAGO DE CALI', 'VALLE'), { code: '76001', via: 'alias' })
eq('Bogotá como lo escribe MinSalud', bdua.resolve('BOGOTÁ, D.C.', 'BOGOTÁ, D.C.'), { code: '11001', via: 'nombre' })
eq('Bogotá como lo escribe la BDUA', bdua.resolve('BOGOTA D.C.', 'BOGOTA D.C.'), { code: '11001', via: 'nombre' })
eq('¥ resuelve sin alias (PUERTO NARI¥O)', sinAlias.resolve('PUERTO NARI¥O', 'AMAZONAS'), { code: '91540', via: 'nombre' })
eq('sin alias no hay coincidencia aproximada', sinAlias.resolve('EL PIJI¥O DEL CARMEN', 'MAGDALENA'), null)
eq('con alias sí', bdua.resolve('EL PIJI¥O DEL CARMEN', 'MAGDALENA'), { code: '47545', via: 'alias' })
eq('"SAN PEDRO" (bdua) = San Pedro de los Milagros', bdua.resolve('SAN PEDRO', 'ANTIOQUIA'), { code: '05664', via: 'alias' })
eq('el alias de la propia fuente manda', minsalud.resolve('SAN PEDRO', 'ANTIOQUIA'), { code: '05665', via: 'alias' })
eq('alias de otra fuente como último recurso', otra.resolve('DOS QUEBRADAS', 'RISARALDA'), { code: '66170', via: 'alias_otra_fuente' })
eq('San Pedro de Urabá por nombre', bdua.resolve('SAN PEDRO DE URABA', 'ANTIOQUIA'), { code: '05665', via: 'nombre' })
eq('ambiguo → null', bdua.resolve('SANTA ROSA', 'VICHADA'), null)
check('ambiguo queda registrado', bdua.ambiguous.has('99|SANTA ROSA'))
eq('alias a un código inexistente se ignora', bdua.resolve('NUEVO BELÉN DE BAJIRÁ', 'CHOCO'), null)
eq('departamento desconocido → null', bdua.resolve('MEDELLIN', 'ATLANTIDA'), null)
eq('municipio en otro departamento → null', bdua.resolve('MEDELLIN', 'VALLE'), null)
eq('código de departamento directo', bdua.departmentCode('05'), '05')
eq('departamento por alias aunque no esté en la tabla', bdua.departmentCode('ARCHIPIÉLAGO DE SAN ANDRÉS, PROVIDENCIA Y SANTA CATALINA'), '88')
eq('resolveInDepartment', bdua.resolveInDepartment('Dosquebradas', '66'), { code: '66170', via: 'nombre' })
eq('vacío → null', bdua.resolve('', 'ANTIOQUIA'), null)

// ---------------------------------------------------------------------------
console.log('\n3. Cobertura y utilidades')
eq('cobertura con tope (Medellín ago-2026)', computeCobertura(2956619, 2526335), 1)
check('cobertura Abejorral ago-2026 = 0.7312535504639273', near(computeCobertura(15447, 21124), 0.7312535504639273), computeCobertura(15447, 21124))
eq('sin población → null (SIN UBICACIÓN)', computeCobertura(1253298, 0), null)
eq('sin afiliados → null', computeCobertura(null, 100), null)
eq('toCount número', toCount(12), 12)
eq('toCount texto con miles', toCount('1.234.567'), 1234567)
eq('toCount vacío', toCount(''), null)
check('toCount inválido → NaN', Number.isNaN(toCount('abc') as number))
eq('último día de febrero bisiesto', lastDayOfMonth(2028, 2), '2028-02-29')
eq('relativeDiff', relativeDiff(105, 100), 0.05)
eq('relativeDiff sin referencia', relativeDiff(5, 0), null)

console.log('\n4. Corte mensual')
eq('título de la hoja', parseCifrasCorte('CIFRAS AGOSTO-2026'), '2026-08-31')
eq('febrero', parseCifrasCorte('CIFRAS FEBRERO-2026'), '2026-02-28')
eq('nombre de ZIP abreviado', parseCifrasCorte('cifras-afiliacion-salud-abr-2026.zip'), '2026-04-30')
eq('mes pegado al año', parseCifrasCorte('cifras-afiliacion-mayo2026.zip'), '2026-05-31')
eq('oct2025', parseCifrasCorte('cifras-afiliacion-salud-oct2025.zip'), '2025-10-31')
eq('septiembre', parseCifrasCorte('cifras-afiliacion-septiembre-2025.zip'), '2025-09-30')
eq('sin fecha → null', parseCifrasCorte('CIFRAS'), null)

// ---------------------------------------------------------------------------
console.log('\n5. XLSX de MinSalud (fixture mínima con valores literales)')
const HEADER_NUEVO = [
  'IdDepartamento', 'Departamento', 'IdMunicipio', 'Municipio', 'Contributivo', 'Subsidiado', 'Excepción & Especiales',
  'Afiliados', 'Población', 'Cobertura', 'Afil. Subsidiado sin SISBEN IV', 'Afil. Pob. Especiales Subsidiado sin SISBEN IV',
  'Afil. de Oficio sin SISBEN IV', 'Afil. Régimen Sub. No Pobre, No Vulnerable',
]
const agosto2026 = [
  ['CIFRAS AGOSTO-2026'],
  HEADER_NUEVO,
  ['00', 'SIN UBICACIÓN', '00000', 'SIN UBICACIÓN', null, null, 1253298, 1253298, 0, null, 0, 0, 0, 0],
  ['05', 'ANTIOQUIA', '05001', 'MEDELLÍN', 2040056, 861335, 55228, 2956619, 2526335, 1, 181145, 71173, 722, 6317],
  ['05', 'ANTIOQUIA', '05002', 'ABEJORRAL', 3047, 11890, 510, 15447, 21124, 0.7312535504639273, 565, 186, 3, 14],
  ['19', 'CAUCA', '19856', 'CAUCA-SM', null, null, null, null, null, null, 0, 0, 0, 0],
  ['Total general', null, null, null, 2043103, 873225, 1309036, 4225364, 2547459, 0.99, 0, 0, 0, 0],
]
const zip = zipBytes({ 'CIFRAS AGOSTO-2026.xlsx': xlsxBytes({ CoberturaDepartamento: [['CIFRAS AGOSTO-2026']], CoberturaMunicipio: agosto2026 }) })
const extracted = extractXlsxFromZip(zip)
eq('ZIP → nombre del .xlsx', extracted.name, 'CIFRAS AGOSTO-2026.xlsx')
const sheet = readCifrasWorkbook(extracted.bytes)
eq('corte desde el título', sheet.corte, '2026-08-31')
eq('trae códigos', sheet.hasCodes, true)
eq('sin errores', sheet.errors, [])
eq('filas (la vacía CAUCA-SM se salta)', [sheet.rows.length, sheet.skippedEmpty], [3, 1])
eq('fila de Medellín', sheet.rows[1], {
  departmentCode: '05', departamento: 'ANTIOQUIA', municipalityCode: '05001', municipio: 'MEDELLÍN',
  contributivo: 2040056, subsidiado: 861335, excepcion: 55228, afiliados: 2956619, poblacion: 2526335, cobertura: 1,
})
eq('SIN UBICACIÓN se conserva con 00000', [sheet.rows[0].municipalityCode, sheet.rows[0].afiliados, sheet.rows[0].poblacion], ['00000', 1253298, 0])
eq('fila Total general', sheet.total, { contributivo: 2043103, subsidiado: 873225, excepcion: 1309036, afiliados: 4225364, poblacion: 2547459 })
const suma = sumCifras(sheet.rows)
eq('la suma de filas cuadra con el total', suma, { contributivo: 2043103, subsidiado: 873225, excepcion: 1309036, afiliados: 4225364, poblacion: 2547459 })
check('cobertura del archivo = calculada', near(computeCobertura(sheet.rows[2].afiliados, sheet.rows[2].poblacion), sheet.rows[2].cobertura as number))

const julio2025 = [
  ['CIFRAS JULIO-2025'],
  ['Departamento', 'Municipio', 'Contributivo', 'Subsidiado', 'Excepción & Especiales', 'Afiliados', 'Población', 'Cobertura',
    'Afil. Subsidiado sin SISBEN IV', 'Afil. Pob. Especiales Subsidiado sin SISBEN IV', 'Afil. de Oficio sin SISBEN IV', 'Afil. Régimen Sub. No Pobre, No Vulnerable'],
  ['AMAZONAS', 'AMAZONAS-SM', null, null, 10, 10, 0, null, 0, 0, 0, 0],
  ['AMAZONAS', 'LETICIA', 16048, 37735, 1871, 55654, 55749, 0.9982959335593463, 20964, 14908, 18, 3],
  ['Total', null, 16048, 37735, 1881, 55664, 55749, 0.99, 0, 0, 0, 0],
]
const viejo = parseCifrasSheet(julio2025)
eq('formato viejo: corte y sin códigos', [viejo.corte, viejo.hasCodes], ['2025-07-31', false])
eq('formato viejo: Leticia sin código', [viejo.rows[1].municipalityCode, viejo.rows[1].departmentCode, viejo.rows[1].municipio, viejo.rows[1].afiliados], [null, null, 'LETICIA', 55654])
eq('formato viejo: fila "Total"', viejo.total?.afiliados, 55664)
eq('clave aprendida igual en ambos formatos', cifrasNameKey('BOGOTÁ, D.C.', 'BOGOTÁ, D.C.'), 'BOGOTA D C|BOGOTA D C')
const malo = parseCifrasSheet([['CIFRAS MAYO-2026'], HEADER_NUEVO, ['05', 'ANTIOQUIA', '05001', 'MEDELLÍN', 'mucho', 1, 1, 3, 10, 0.3]])
eq('valor no numérico → error de lectura', malo.errors.length, 1)
eq('sin encabezado → error', parseCifrasSheet([['hola'], ['a', 'b']]).errors.length, 1)
throws('ZIP sin .xlsx', () => extractXlsxFromZip(zipBytes({ 'leeme.txt': 'nada' })), /exactamente un \.xlsx/)
throws('libro sin CoberturaMunicipio', () => readCifrasWorkbook(xlsxBytes({ EPS: [['x']] })), /CoberturaMunicipio/)

// ---------------------------------------------------------------------------
console.log('\n6. Proyecciones del DANE')
const daneRows: unknown[][] = [
  [null], ['ACTUALIZACIÓN POST COVID-19. PROYECCIONES DE POBLACIÓN MUNICIPAL POR ÁREA.'], [null],
  ['DP', 'DPNOM', 'MPIO', 'DPMP', 'AÑO', 'ÁREA GEOGRÁFICA', 'Población'],
  ['05', 'Antioquia', '05001', 'Medellín', 2024, 'Cabecera Municipal', 2565432],
  ['05', 'Antioquia', '05001', 'Medellín', 2024, 'Centros Poblados y Rural Disperso', 42000],
  ['05', 'Antioquia', '05001', 'Medellín', 2024, 'Total', 2607432],
  ['05', 'Antioquia', '05001', 'Medellín', 2023, 'Total', 1], // fuera de rango
  ['91', 'Amazonas', '91540', 'Puerto Nariño', 2024, 'Cabecera Municipal', 2000],
  ['91', 'Amazonas', '91540', 'Puerto Nariño', 2024, 'Centros Poblados y Rural Disperso', 9000],
  ['91', 'Amazonas', '91540', 'Puerto Nariño', 2024, 'Total', 11000],
  ['*Desde el 1 de diciembre de 2019 comenzó a regir la Ordenanza 248…'],
]
const dane = parseDaneSheet(daneRows, { desde: 2024, hasta: 2030 })
eq('DANE: filas por municipio y año', dane.rows, [
  { municipality_code: '05001', anio: 2024, total: 2607432, cabecera: 2565432, resto: 42000 },
  { municipality_code: '91540', anio: 2024, total: 11000, cabecera: 2000, resto: 9000 },
])
eq('DANE: años y errores', [dane.years, dane.errors], [[2024], []])
eq('DANE: nombre del municipio', dane.names.get('91540'), 'Puerto Nariño')
const daneMalo = parseDaneSheet(
  [['DP', 'DPNOM', 'MPIO', 'DPMP', 'AÑO', 'ÁREA GEOGRÁFICA', 'Población'], ['05', 'A', '05002', 'X', 2025, 'Cabecera Municipal', 10], ['05', 'A', '05002', 'X', 2025, 'Centros Poblados y Rural Disperso', 5], ['05', 'A', '05002', 'X', 2025, 'Total', 16]],
  { desde: 2024, hasta: 2030 }
)
eq('DANE: cabecera + resto ≠ total → error', [daneMalo.rows.length, daneMalo.errors.length], [0, 1])
const daneVp = readDaneWorkbook(
  xlsxBytes({
    Índice: [['PROYECCIONES DE POBLACIÓN Y ESTUDIOS DEMOGRÁFICOS (PPED)']],
    PobMunicipalxÁrea: [['DP', 'DPNOM', 'MPIO', 'DPMP', 'AÑO', 'ÁREA GEOGRÁFICA', 'TOTAL'], [null], ['27', 'Chocó', '27493', 'Nuevo Belén de Bajirá', 2026, 'Total', 30562]],
  }),
  { desde: 2024, hasta: 2030 }
)
eq('DANE 2018-2042: hoja y columna TOTAL', [daneVp.sheet, daneVp.rows], ['PobMunicipalxÁrea', [{ municipality_code: '27493', anio: 2026, total: 30562, cabecera: null, resto: null }]])

// ---------------------------------------------------------------------------
console.log('\n7. BDUA: SoQL, corte y agregación')
const urlSub = decodeURIComponent(buildBduaSoqlUrl('d7a5-cnra', { limit: 50000, offset: 100000 }).replace(/\+/g, ' '))
check('subsidiado suma cantidad como número', urlSub.includes('sum(cantidad::number) AS afiliados'), urlSub)
check('agrupa y ordena por las 7 columnas', urlSub.includes('$group=dpr_nombre,mnc_nombre,tps_rgm_nombre,ent_id,ent_nombre,tps_est_afl_nombre,zns_nombre') && urlSub.includes('$order=dpr_nombre,'), urlSub)
check('paginación', urlSub.includes('$limit=50000') && urlSub.includes('$offset=100000'), urlSub)
const urlCon = decodeURIComponent(buildBduaSoqlUrl('tq4m-hmg2', { limit: 1000, offset: 0 }).replace(/\+/g, ' '))
check('contributivo suma cantidad numérica', urlCon.includes('sum(cantidad) AS afiliados') && urlCon.startsWith('https://www.datos.gov.co/resource/tq4m-hmg2.json?'), urlCon)
check('URL del total', decodeURIComponent(buildBduaTotalUrl('d7a5-cnra').replace(/\+/g, ' ')).includes('$select=sum(cantidad::number) AS afiliados, count(*) AS filas'))
eq('corte en hora de Colombia (03:33 UTC → día anterior)', corteFromRowsUpdatedAt(1790998393), '2026-10-02')
eq('corte (23:09 UTC → mismo día)', corteFromRowsUpdatedAt(1790982577), '2026-10-02')
throws('rowsUpdatedAt inválido', () => corteFromRowsUpdatedAt(0), /inválido/)
eq('régimen', [normalizeRegimen('Contributivo'), normalizeRegimen(' subsidiado '), normalizeRegimen('Especial')], ['contributivo', 'subsidiado', null])

const agg = aggregateBduaRows({
  corte: '2026-10-02',
  fuente: 'd7a5-cnra',
  resolver: bdua,
  rows: [
    { dpr_nombre: 'RISARALDA', mnc_nombre: 'DOS QUEBRADAS', tps_rgm_nombre: 'Subsidiado', ent_id: 'EPSS37', ent_nombre: 'NUEVA EPS S.A. -CM', tps_est_afl_nombre: 'Activo', zns_nombre: 'Urbana', afiliados: '100' },
    // misma clave, otro nombre de EPS: se suma y gana el nombre con más afiliados
    { dpr_nombre: 'RISARALDA', mnc_nombre: 'DOS QUEBRADAS', tps_rgm_nombre: 'Subsidiado', ent_id: 'EPSS37', ent_nombre: 'NUEVA EPS', tps_est_afl_nombre: 'Activo', zns_nombre: 'Urbana', afiliados: '250' },
    { dpr_nombre: 'ANTIOQUIA', mnc_nombre: 'MEDELLIN', tps_rgm_nombre: 'Subsidiado', ent_id: 'EPSS40', ent_nombre: 'SAVIA SALUD', tps_est_afl_nombre: 'Activo', zns_nombre: 'Rural', afiliados: 40 },
    { dpr_nombre: 'VAUPES', mnc_nombre: 'DPTO. VAUPES', tps_rgm_nombre: 'Subsidiado', ent_id: 'EPSI05', ent_nombre: 'MALLAMAS', tps_est_afl_nombre: 'Activo', zns_nombre: 'Rural', afiliados: '7' },
    { dpr_nombre: 'ANTIOQUIA', mnc_nombre: 'MEDELLIN', tps_rgm_nombre: 'Especial', ent_id: 'X', ent_nombre: 'X', tps_est_afl_nombre: 'Activo', zns_nombre: 'Rural', afiliados: '1' },
  ],
})
eq('BDUA: filas agregadas', agg.rows.length, 3)
const dq = agg.rows.find(r => r.municipio_bdua === 'DOS QUEBRADAS')
eq('BDUA: suma y nombre de EPS', [dq?.afiliados, dq?.eps_nombre, dq?.municipality_code, dq?.department_code], [350, 'NUEVA EPS', '66170', '66'])
eq('BDUA: sin cruce queda con código NULL', agg.rows.find(r => r.municipio_bdua === 'DPTO. VAUPES')?.municipality_code, null)
eq('BDUA: totales', [agg.total, agg.cruzados, agg.byRegimen.subsidiado], [397, 390, { total: 397, activos: 397, cruzados: 390 }])
eq('BDUA: sin cruce', Array.from(agg.sinCruce.entries()), [['VAUPES / DPTO. VAUPES', 7]])
eq('BDUA: resueltos por alias', Array.from(agg.viaAlias.keys()), ['RISARALDA / DOS QUEBRADAS → 66170'])
eq('BDUA: régimen desconocido es error', agg.errors.length, 1)

console.log(`\n${passed} pruebas OK, ${failed} fallidas`)
process.exit(failed > 0 ? 1 : 0)
