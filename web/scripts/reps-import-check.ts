/**
 * Fase 3 · Importador de servicios y capacidad del REPS · pruebas puras (SIN RED, sin Supabase).
 *
 * Comprueba lib/reps-import.ts, lib/reps-pdf.ts y lib/hospital-service-filters.ts:
 *  1. Texto y archivos: encabezados con tildes y sinónimos, CSV con ; , y tabulador, comillas,
 *     Windows-1252, Excel con códigos numéricos (Excel quita el 0 inicial), fila de encabezados bajo
 *     un título, valores "12".
 *  2. Normalización: código de habilitación (12/10 dígitos + sede), NIT, servicios con columnas SI/NO
 *     de modalidad y complejidad, capacidad sumada por concepto, filas inválidas con motivo.
 *  3. Clasificación (Res. 3100/2019): ortopedia, cirugía ortopédica, trauma, neurocirugía, columna…;
 *     quirófanos y camas.
 *  4. Cruce sede → IPS: reps_code, importación previa, NIT (única sede / NIT + municipio), ambiguas y
 *     sin cruce; una IPS = una sede.
 *  5. Simulación sobre datos ficticios: servicios nuevos/retirados, service_flags, reemplazar vs. solo
 *     añadir, alcance por grupo; capacidad (quirófanos, camas, cambios de cantidad).
 *  6. PDF: un PDF con texto hecho a mano (2 páginas, encabezado en dos renglones y repetido, celda
 *     partida) se lee con pdf.js y se reconstruye la tabla; un PDF sin texto da "requiere OCR".
 *  7. Filtro de IPS de la lista y del mapa.
 *
 * Uso (desde web/): npm run reps:check   (= npx tsx scripts/reps-import-check.ts)
 * Código de salida 1 si alguna prueba falla.
 */
import * as XLSX from 'xlsx'
import {
  PDF_NO_TABLE_WARNING,
  PDF_NO_TEXT_ERROR,
  RepsImportError,
  buildRawTable,
  capacityGroupOf,
  classifyService,
  computeCapacityTotals,
  computeServiceFlags,
  decodeTextBuffer,
  detectColumns,
  detectDelimiter,
  detectFlagColumns,
  detectKind,
  isOperatingRoom,
  matchSedes,
  normalizeCapacityRows,
  normalizeNit,
  normalizeServiceCode,
  normalizeServiceRows,
  normalizeText,
  parseDelimitedText,
  parseQuantity,
  parseWorkbook,
  pdfPagesToTable,
  planCapacityImport,
  planServicesImport,
  remapSedeKeys,
  resolveRepsCode,
  sanitizeMapping,
  type ExistingCapacityRow,
  type ExistingServiceRow,
  type HospitalForImport,
  type MatchContext,
  type RepsSedeRef,
  type SedeInfo,
} from '../lib/reps-import'
import { parsePdfToTable } from '../lib/reps-pdf'
import { EMPTY_IPS_FILTER, hasRepsData, matchesIpsFilter, parseBedsInput } from '../lib/hospital-service-filters'

let passed = 0
let failed = 0
const print = (text: string) => process.stdout.write(`${text}\n`)

function check(name: string, condition: boolean, detail?: unknown) {
  if (condition) {
    passed++
    print(`  OK   ${name}`)
  } else {
    failed++
    print(`  FALLO ${name}${detail === undefined ? '' : `\n         ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`}`)
  }
}

function section(title: string) {
  print('')
  print(title)
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

// -----------------------------------------------------------------------------------------
// PDF mínimo hecho a mano (Helvetica, WinAnsi): cada texto en su posición (x, y en puntos)
// -----------------------------------------------------------------------------------------
type PdfText = { x: number; y: number; text: string; size?: number }

function pdfLiteral(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
}

function buildTextPdf(pages: PdfText[][]): Uint8Array {
  const objects: string[] = []
  const pageIds: number[] = []
  const pageObjects: string[] = []
  let next = 4
  for (const items of pages) {
    const pageId = next++
    const contentId = next++
    pageIds.push(pageId)
    const stream = items.map(it => `BT /F1 ${it.size ?? 9} Tf ${it.x} ${it.y} Td (${pdfLiteral(it.text)}) Tj ET`).join('\n')
    pageObjects.push(
      `${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>\nendobj\n`
    )
    pageObjects.push(`${contentId} 0 obj\n<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream\nendobj\n`)
  }
  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n')
  objects.push(`2 0 obj\n<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>\nendobj\n`)
  objects.push('3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n')
  objects.push(...pageObjects)
  let out = '%PDF-1.4\n'
  const offsets: number[] = []
  for (const object of objects) {
    offsets.push(Buffer.byteLength(out, 'latin1'))
    out += object
  }
  const xref = Buffer.byteLength(out, 'latin1')
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map(o => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return new Uint8Array(Buffer.from(out, 'latin1'))
}

// -----------------------------------------------------------------------------------------
// Datos ficticios
// -----------------------------------------------------------------------------------------
function hospital(partial: Partial<HospitalForImport> & { id: string }): HospitalForImport {
  return {
    name: `IPS ${partial.id}`,
    code: '900000000-1',
    active: true,
    municipality_id: '05001',
    municipality_name: 'Medellín',
    nit: null,
    reps_code: null,
    service_flags: {},
    reps_services_count: null,
    quirofanos: null,
    reps_beds: null,
    ...partial,
  }
}

function sede(key: string, extra: Partial<SedeInfo> = {}): SedeInfo {
  return {
    key,
    repsCode: /^\d{10,12}$/.test(key) ? key : null,
    nit: null,
    sedeName: null,
    prestadorName: null,
    municipalityCode: null,
    municipalityName: null,
    departmentName: null,
    rows: 1,
    ...extra,
  }
}

function sedeRef(code: string, nit: string, municipio: string): RepsSedeRef {
  return { code, prestador: code.slice(0, 10), nit, municipio, nombreSede: null }
}

function context(hospitals: HospitalForImport[], sedes: RepsSedeRef[], previous: [string, string][] = []): MatchContext {
  const byCode = new Map(sedes.map(s => [s.code, s]))
  const byNit = new Map<string, RepsSedeRef[]>()
  sedes.forEach(s => byNit.set(s.nit, [...(byNit.get(s.nit) || []), s]))
  return { hospitals, repsSedesByCode: byCode, repsSedesByNit: byNit, previousLinks: new Map(previous) }
}

async function main() {
  // =======================================================================================
  section('1. Texto, archivos y encabezados')
  // =======================================================================================
  check('normalizeText quita tildes, mayúsculas y signos', normalizeText('Código  Habilitación_Sede') === 'codigo habilitacion sede')

  const serviceHeaders = ['Departamento', 'Municipio', 'Código Habilitación', 'Número Sede', 'Nombre Sede', 'NIT', 'Grupo Servicio', 'Código Servicio', 'Nombre Servicio', 'Complejidad', 'Modalidad']
  const serviceMapping = detectColumns(serviceHeaders)
  check(
    'encabezados con tildes: código, sede, NIT, grupo, servicio, complejidad, modalidad',
    serviceMapping.repsCode === 2 && serviceMapping.sedeNumber === 3 && serviceMapping.sedeName === 4 && serviceMapping.nit === 5 &&
      serviceMapping.group === 6 && serviceMapping.serviceCode === 7 && serviceMapping.serviceName === 8 &&
      serviceMapping.complexity === 9 && serviceMapping.modality === 10 && serviceMapping.department === 0 && serviceMapping.municipality === 1,
    serviceMapping
  )
  check('tipo detectado: servicios', detectKind(serviceMapping) === 'servicios')

  const openDataHeaders = ['depa_nombre', 'muni_nombre', 'codigo_habilitacion', 'nombre_prestador', 'numero_sede', 'sede_nombre', 'grse_nombre', 'serv_codigo', 'serv_nombre', 'intramural', 'telemedicina_interactiva', 'complejidad_baja', 'complejidad_alta']
  const openDataMapping = detectColumns(openDataHeaders)
  check(
    'sinónimos con guion bajo (datos abiertos): codigo_habilitacion, serv_codigo, serv_nombre, grse_nombre',
    openDataMapping.repsCode === 2 && openDataMapping.serviceCode === 7 && openDataMapping.serviceName === 8 && openDataMapping.group === 6 &&
      openDataMapping.sedeNumber === 4 && openDataMapping.prestadorName === 3 && openDataMapping.complexity === undefined,
    openDataMapping
  )

  const capacityHeaders = ['codigo_habilitacion', 'nombre_sede', 'grupo_capacidad', 'coca_nombre', 'cantidad', 'num_placa']
  const capacityMapping = detectColumns(capacityHeaders)
  check(
    'capacidad: grupo_capacidad, coca_nombre (concepto), cantidad; tipo capacidad',
    capacityMapping.group === 2 && capacityMapping.concept === 3 && capacityMapping.quantity === 4 && detectKind(capacityMapping) === 'capacidad',
    capacityMapping
  )
  check('sin columnas reconocibles: tipo null', detectKind(detectColumns(['a', 'b', 'c'])) === null)
  check(
    'mapeo manual: solo índices válidos',
    same(sanitizeMapping({ repsCode: 1, serviceName: 9, nit: null, otro: 2, quantity: -1 }, 5), { repsCode: 1, nit: null })
  )

  check('separador ; detectado', detectDelimiter('a;b;c\n1;2;3\n4;5;6') === ';')
  check('separador , detectado', detectDelimiter('a,b,c\n1,2,3\n4,5,6') === ',')
  check('separador tabulador detectado', detectDelimiter('a\tb\tc\n1\t2\t3') === '\t')
  check(
    'CSV con ; y comillas (separador y comillas dobles dentro de una celda)',
    same(parseDelimitedText('codigo;nombre;servicio\r\n050010012301;"CLÍNICA ""A""; SEDE 1";207\n'), [
      ['codigo', 'nombre', 'servicio'],
      ['050010012301', 'CLÍNICA "A"; SEDE 1', '207'],
    ])
  )
  check(
    'CSV con , y salto de línea dentro de comillas',
    same(parseDelimitedText('a,b\n"x\ny",2'), [['a', 'b'], ['x y', '2']])
  )
  const latin1 = Uint8Array.from([0x43, 0xf3, 0x64, 0x69, 0x67, 0x6f, 0x3b, 0xd1]) // "Código;Ñ" en Windows-1252
  check('texto en Windows-1252 se decodifica', decodeTextBuffer(latin1) === 'Código;Ñ', decodeTextBuffer(latin1))
  const utf8Bom = new Uint8Array([0xef, 0xbb, 0xbf, ...Array.from(Buffer.from('Código;x', 'utf8'))])
  check('texto UTF-8 con BOM', decodeTextBuffer(utf8Bom) === 'Código;x')

  const titled = buildRawTable([
    ['Registro Especial de Prestadores de Servicios de Salud', '', ''],
    ['Fecha de corte: 12/03/2026', '', ''],
    ['', '', ''],
    ['Código Habilitación', 'Nombre Sede', 'Servicio'],
    ['050010012301', 'SEDE 1', 'CIRUGÍA ORTOPÉDICA'],
    ['Código Habilitación', 'Nombre Sede', 'Servicio'],
    ['', '', ''],
    ['050010012302', 'SEDE 2', 'NEUROCIRUGÍA'],
  ])
  check(
    'fila de encabezados bajo título y fecha (fila 4); omite vacías y encabezado repetido',
    titled.headerDetected && titled.table.headerRow === 4 && titled.table.rows.length === 2 && same(titled.table.rowNumbers, [5, 8]),
    titled.table
  )

  check('cantidad "12" → 12', parseQuantity('12') === 12)
  check('cantidad " 12 " y "12,0" → 12', parseQuantity(' 12 ') === 12 && parseQuantity('12,0') === 12)
  check('cantidad "1.500" (miles) → 1500', parseQuantity('1.500') === 1500)
  check('cantidad "doce" o vacía → null', parseQuantity('doce') === null && parseQuantity('') === null)
  check('código de servicio 207 / "207.0" → "207"', normalizeServiceCode(207) === '207' && normalizeServiceCode('207.0') === '207')

  // Excel con el código como número (Excel quita el 0 inicial de Antioquia)
  const sheet = XLSX.utils.aoa_to_sheet([
    ['Reporte de servicios'],
    ['Código Habilitación', 'Nombre Sede', 'Código Servicio', 'Nombre Servicio'],
    [50010012301, 'SEDE MEDELLÍN', 207, 'CIRUGÍA ORTOPÉDICA'],
    [80010012301, 'SEDE BARRANQUILLA', 387, 'NEUROCIRUGÍA'],
  ])
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, 'Servicios')
  const xlsxBytes = new Uint8Array(XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer)
  const parsedWorkbook = parseWorkbook(xlsxBytes)
  const xlsxTable = buildRawTable(parsedWorkbook.rows, parsedWorkbook.sheetName).table
  const xlsxData = normalizeServiceRows(xlsxTable, detectColumns(xlsxTable.headers))
  check(
    'Excel: código numérico 50010012301 → sede 050010012301; servicio 207',
    parsedWorkbook.sheetName === 'Servicios' && xlsxTable.headerRow === 2 && Object.keys(xlsxData.sedes).join(',') === '050010012301,080010012301' &&
      xlsxData.services[0]?.code === '207',
    { sedes: Object.keys(xlsxData.sedes), services: xlsxData.services }
  )

  // =======================================================================================
  section('2. Normalización')
  // =======================================================================================
  check('código de 12 dígitos', resolveRepsCode('050010012301') === '050010012301')
  check('código de 11 dígitos (sin el 0) → 12', resolveRepsCode('50010012301') === '050010012301')
  check('prestador 9 dígitos + sede "1" → 12', resolveRepsCode('500100123', '1') === '050010012301')
  check('prestador 10 dígitos sin sede → 10', resolveRepsCode('0500100123') === '0500100123')
  check('código vacío y sede de 12 dígitos → la sede', resolveRepsCode('', '050010012302') === '050010012302')
  check('NIT "890.102.768-1" → 890102768', normalizeNit('890.102.768-1') === '890102768')
  check('NIT + DV sin guion "8901027681" → 890102768', normalizeNit('8901027681') === '890102768')
  check('NIT vacío → null', normalizeNit('') === null)

  const flagTable = buildRawTable([
    ['codigo_habilitacion', 'numero_sede', 'nits_nit', 'sede_nombre', 'grse_nombre', 'serv_codigo', 'serv_nombre', 'intramural', 'telemedicina interactiva', 'complejidad_baja', 'complejidad_alta'],
    ['0500100123', '1', '890900000', 'SEDE 1', 'QUIRÚRGICOS', '207', 'CIRUGÍA ORTOPÉDICA', 'SI', 'SI', 'NO', 'SI'],
    ['0500100123', '01', '890900000', 'SEDE 1', 'QUIRÚRGICOS', '207', 'CIRUGÍA ORTOPÉDICA', 'SI', 'SI', 'NO', 'SI'],
    ['0500100123', '1', '890900000', 'SEDE 1', 'CONSULTA EXTERNA', '328', 'MEDICINA GENERAL', 'SI', 'NO', 'SI', 'NO'],
    ['', '', '', 'SIN CÓDIGO', 'CONSULTA EXTERNA', '328', 'MEDICINA GENERAL', 'SI', 'NO', 'SI', 'NO'],
    ['0500100123', '1', '890900000', 'SEDE 1', 'CONSULTA EXTERNA', '', '', 'SI', 'NO', 'SI', 'NO'],
  ]).table
  const flagColumns = detectFlagColumns(flagTable.headers, flagTable.rows)
  const flagMapping = detectColumns(flagTable.headers, new Set(flagColumns.map(f => f.index)))
  const flagData = normalizeServiceRows(flagTable, flagMapping, flagColumns)
  const ortho = flagData.services.filter(s => s.code === '207')
  check(
    'columnas SI/NO: 2 de modalidad y 2 de complejidad detectadas',
    flagColumns.filter(f => f.type === 'modality').length === 2 && flagColumns.filter(f => f.type === 'complexity').length === 2,
    flagColumns
  )
  check(
    'servicio con 2 modalidades → 2 filas; fila repetida (sede "01") deduplicada; complejidad ALTA',
    ortho.length === 2 && same(ortho.map(s => s.modality).sort(), ['INTRAMURAL', 'TELEMEDICINA INTERACTIVA']) && ortho.every(s => s.complexity === 'ALTA'),
    ortho
  )
  check(
    'filas inválidas con motivo (sin código ni NIT; sin servicio)',
    flagData.invalidCount === 2 && flagData.invalid.some(r => r.row === 5 && /habilitaci/.test(r.reason)) && flagData.invalid.some(r => r.row === 6 && /servicio/.test(r.reason)),
    flagData.invalid
  )
  check('grupos del archivo normalizados', same(flagData.groups, ['consulta externa', 'quirurgicos']), flagData.groups)
  check('sede con NIT y nombre', flagData.sedes['050010012301']?.nit === '890900000' && flagData.sedes['050010012301']?.sedeName === 'SEDE 1')

  const combined = normalizeServiceRows(
    buildRawTable([['NIT', 'Servicio'], ['900123456-1', '207 - CIRUGÍA ORTOPÉDICA']]).table,
    { nit: 0, serviceName: 1 }
  )
  check(
    'solo NIT y "207 - NOMBRE" en una columna → sede NIT-900123456, código 207',
    combined.services.length === 1 && combined.services[0].key === 'NIT-900123456' && combined.services[0].code === '207' && combined.services[0].name === 'CIRUGÍA ORTOPÉDICA',
    combined.services
  )

  const capTable = buildRawTable([
    ['Código Habilitación', 'Grupo Capacidad', 'Concepto', 'Cantidad', 'Placa'],
    ['050010012301', 'CAMAS', 'Adultos', '12', ''],
    ['050010012301', 'CAMAS', 'Pediátrica', '5', ''],
    ['050010012301', 'SALAS', 'Quirófano', '3', ''],
    ['050010012301', 'SALAS', 'Sala de partos', '1', ''],
    ['050010012301', 'AMBULANCIAS', 'Básica', '1', 'ABC123'],
    ['050010012301', 'AMBULANCIAS', 'Básica', '1', 'XYZ789'],
    ['050010012301', 'SILLAS', 'Hemodiálisis', '4', ''],
    ['050010012301', 'CAMAS', 'Adultos', 'doce', ''],
  ]).table
  const capData = normalizeCapacityRows(capTable, detectColumns(capTable.headers))
  const ambulances = capData.capacity.find(c => c.group === 'ambulancias')
  check('capacidad: 2 ambulancias básicas (una por placa) se suman en 1 fila de cantidad 2', ambulances?.quantity === 2 && ambulances.concept === 'Básica', capData.capacity)
  check('capacidad: SILLAS va a "otros" conservando el grupo en el concepto', capData.capacity.some(c => c.group === 'otros' && c.concept === 'SILLAS: Hemodiálisis'))
  check('capacidad: cantidad "doce" inválida con motivo', capData.invalidCount === 1 && /Cantidad no válida/.test(capData.invalid[0].reason))
  check('capacidad: grupos del archivo', same(capData.groups, ['ambulancias', 'camas', 'otros', 'salas']), capData.groups)

  const remapped = remapSedeKeys(normalizeServiceRows(buildRawTable([['codigo prestador', 'servicio'], ['0500100123', 'NEUROCIRUGÍA']]).table, { repsCode: 0, serviceName: 1 }), new Map([['0500100123', '050010012301']]))
  check('prestador de 10 dígitos con una sede → se reasigna al código de 12', Object.keys(remapped.sedes).join() === '050010012301' && remapped.services[0].key === '050010012301')

  // =======================================================================================
  section('3. Clasificación (Res. 3100/2019)')
  // =======================================================================================
  check('CIRUGÍA ORTOPÉDICA → cirugía ortopédica + ortopedia', same(classifyService('207', 'CIRUGÍA ORTOPÉDICA'), ['cirugia_ortopedica', 'ortopedia']))
  check('ORTOPEDIA Y/O TRAUMATOLOGÍA → ortopedia + trauma', same(classifyService('339', 'ORTOPEDIA Y/O TRAUMATOLOGÍA'), ['ortopedia', 'trauma']))
  check('NEUROCIRUGÍA y CIRUGÍA NEUROLÓGICA → neurocirugía', same(classifyService('387', 'NEUROCIRUGÍA'), ['neurocirugia']) && same(classifyService('206', 'CIRUGÍA NEUROLÓGICA'), ['neurocirugia']))
  check('CIRUGÍA DE COLUMNA → columna', classifyService(null, 'CIRUGÍA DE COLUMNA VERTEBRAL').includes('columna'))
  check('ORTODONCIA no es ortopedia', classifyService('338', 'ORTODONCIA').length === 0)
  check('MEDICINA FÍSICA Y DEL DEPORTE → medicina del deporte', same(classifyService('326', 'MEDICINA FÍSICA Y DEL DEPORTE'), ['medicina_deportiva']))
  check('CUIDADO INTENSIVO ADULTO → UCI adultos; SERVICIO DE URGENCIAS → urgencias', same(classifyService(null, 'CUIDADO INTENSIVO ADULTO'), ['uci_adultos']) && same(classifyService(null, 'SERVICIO DE URGENCIAS'), ['urgencias']))
  check('sin nombre, código 207 → cirugía ortopédica (respaldo por código)', classifyService('207', null).includes('cirugia_ortopedica'))
  check('con nombre, el código no manda (207 + CIRUGÍA GENERAL → nada)', classifyService('207', 'CIRUGÍA GENERAL').length === 0)
  const allFlags = computeServiceFlags([{ code: '207', name: 'CIRUGÍA ORTOPÉDICA' }])
  check('service_flags trae todas las claves (true/false)', Object.keys(allFlags).length === 9 && allFlags.cirugia_ortopedica === true && allFlags.neurocirugia === false)
  check('quirófano / salas de cirugía sí; partos y procedimientos no', isOperatingRoom('Quirófano') && isOperatingRoom('Salas de cirugía') && !isOperatingRoom('Sala de partos') && !isOperatingRoom('Sala de procedimientos'))
  check(
    'grupo de capacidad por grupo o por concepto',
    capacityGroupOf('CAMAS', 'Adultos') === 'camas' && capacityGroupOf(null, 'Quirófano') === 'salas' && capacityGroupOf('AMBULANCIAS', 'Básica') === 'ambulancias' &&
      capacityGroupOf(null, 'Cuidado básico neonatal') === 'camas' && capacityGroupOf(null, 'Básica') === 'ambulancias'
  )
  check('totales: quirófanos 3 y camas 17', same(computeCapacityTotals(capData.capacity), { quirofanos: 3, beds: 17 }), computeCapacityTotals(capData.capacity))

  // =======================================================================================
  section('4. Cruce sede → IPS')
  // =======================================================================================
  const hLinked = hospital({ id: 'h-linked', nit: '800000001', reps_code: '050010000101' })
  const hSingle = hospital({ id: 'h-single', nit: '800000002' })
  const hMulti = hospital({ id: 'h-multi', nit: '800000003', municipality_id: '05001' })
  const hSameMuni = hospital({ id: 'h-same', nit: '800000004', municipality_id: '05001' })
  const hTwinA = hospital({ id: 'h-twin-a', nit: '800000005', code: '800000005-1' })
  const hTwinB = hospital({ id: 'h-twin-b', nit: '800000005', code: '800000005-2' })
  const hPrevious = hospital({ id: 'h-prev', nit: '800000006' })
  const hFromCode = hospital({ id: 'h-code', nit: null, code: '800000007-3' })
  const ctx = context(
    [hLinked, hSingle, hMulti, hSameMuni, hTwinA, hTwinB, hPrevious, hFromCode],
    [
      sedeRef('050010000101', '800000001', '05001'),
      sedeRef('050010000201', '800000002', '05088'),
      sedeRef('050010000301', '800000003', '05001'),
      sedeRef('050010000302', '800000003', '05360'),
      sedeRef('050010000303', '800000003', '05266'),
      sedeRef('050010000401', '800000004', '05001'),
      sedeRef('050010000402', '800000004', '05001'),
      sedeRef('050010000501', '800000005', '05001'),
      sedeRef('050010000701', '800000007', '05001'),
    ],
    [['050010000601', 'h-prev']]
  )
  const matches = matchSedes(
    [
      sede('050010000101'),
      sede('050010000201'),
      sede('050010000301'),
      sede('050010000302'),
      sede('050010000401'),
      sede('050010000501'),
      sede('050010000601'),
      sede('050010000701'),
      sede('NIT-899999999', { nit: '899999999' }),
      sede('050010009901', { nit: '800000001' }),
    ],
    ctx
  )
  const m = (key: string) => matches.get(key)!
  check('hospitals.reps_code → reps_code', m('050010000101').status === 'matched' && m('050010000101').method === 'reps_code' && m('050010000101').hospitalId === 'h-linked')
  check('NIT con una sede (en otro municipio) → nit, con aviso', m('050010000201').method === 'nit' && m('050010000201').hospitalId === 'h-single' && /otro municipio/.test(m('050010000201').reason || ''), m('050010000201'))
  check('NIT con 3 sedes, solo una en el municipio de la IPS → nit_municipio', m('050010000301').method === 'nit_municipio' && m('050010000301').hospitalId === 'h-multi', m('050010000301'))
  check('otra sede del mismo NIT (otro municipio) → ambigua', m('050010000302').status === 'ambiguous' && /3 sedes/.test(m('050010000302').reason || ''), m('050010000302'))
  check('NIT con 2 sedes en el mismo municipio → ambigua', m('050010000401').status === 'ambiguous', m('050010000401'))
  check('2 IPS con el mismo NIT y una sede → ambigua', m('050010000501').status === 'ambiguous' && /2 IPS/.test(m('050010000501').reason || ''), m('050010000501'))
  check('enlace de una importación anterior → importacion_previa', m('050010000601').method === 'importacion_previa' && m('050010000601').hospitalId === 'h-prev')
  check('NIT derivado de hospitals.code cuando no hay columna nit', m('050010000701').hospitalId === 'h-code' && m('050010000701').method === 'nit')
  check('NIT que no está en OpMap → sin cruce', m('NIT-899999999').status === 'unmatched' && /no está en OpMap/.test(m('NIT-899999999').reason || ''))
  check('NIT de una IPS ya vinculada a otra sede → sin cruce', m('050010009901').status === 'unmatched' && /otra sede/.test(m('050010009901').reason || ''), m('050010009901'))

  const conflict = matchSedes(
    [sede('050010000101'), sede('050010000199')],
    context([hLinked], [sedeRef('050010000101', '800000001', '05001')], [['050010000199', 'h-linked']])
  )
  check(
    'dos sedes para la misma IPS: gana reps_code, la otra queda ambigua',
    conflict.get('050010000101')!.status === 'matched' && conflict.get('050010000199')!.status === 'ambiguous',
    Array.from(conflict.entries())
  )

  // =======================================================================================
  section('5. Simulación')
  // =======================================================================================
  const target = hospital({
    id: 'h-target',
    name: 'Clínica Ficticia',
    nit: '811111111',
    reps_code: '050010012301',
    service_flags: { cirugia_ortopedica: true, ortopedia: true, neurocirugia: false },
    reps_services_count: 3,
    quirofanos: 2,
    reps_beds: null,
  })
  const existingServices: ExistingServiceRow[] = [
    { id: 's1', reps_code: '050010012301', hospital_id: 'h-target', service_code: '207', service_name: 'CIRUGÍA ORTOPÉDICA', group_name: 'QUIRÚRGICOS', modality: 'INTRAMURAL' },
    { id: 's2', reps_code: '050010012301', hospital_id: 'h-target', service_code: '328', service_name: 'MEDICINA GENERAL', group_name: 'CONSULTA EXTERNA', modality: 'INTRAMURAL' },
    { id: 's3', reps_code: '050010012301', hospital_id: 'h-target', service_code: '1102', service_name: 'URGENCIAS', group_name: 'ATENCIÓN INMEDIATA', modality: 'INTRAMURAL' },
  ]
  const servicesFile = normalizeServiceRows(
    buildRawTable([
      ['Código Habilitación', 'Grupo Servicio', 'Código Servicio', 'Nombre Servicio', 'Modalidad'],
      ['050010012301', 'QUIRÚRGICOS', '207', 'CIRUGÍA ORTOPÉDICA', 'INTRAMURAL'],
      ['050010012301', 'QUIRÚRGICOS', '206', 'CIRUGÍA NEUROLÓGICA', 'INTRAMURAL'],
      ['050010012301', 'CONSULTA EXTERNA', '387', 'NEUROCIRUGÍA', 'INTRAMURAL'],
      ['999999999901', 'CONSULTA EXTERNA', '328', 'MEDICINA GENERAL', 'INTRAMURAL'],
    ]).table,
    { repsCode: 0, group: 1, serviceCode: 2, serviceName: 3, modality: 4 }
  )
  const serviceMatches = matchSedes(Object.values(servicesFile.sedes), context([target], [sedeRef('050010012301', '811111111', '05001')]))
  const replacePlan = planServicesImport({ data: servicesFile, matches: serviceMatches, hospitals: [target], existingServices, mode: 'replace', audit: { fileName: 'prueba.xlsx', jobId: 'job-1' } })
  const targetItem = replacePlan.items.find(i => i.key === '050010012301')!
  check(
    'reemplazar: 206 y 387 nuevos; 328 retirado (grupo del archivo); urgencias (grupo ausente) se conserva',
    targetItem.addedCount === 2 && targetItem.removedCount === 1 && targetItem.removed[0] === 'MEDICINA GENERAL' && same(replacePlan.payload.services_delete, ['s2']),
    targetItem
  )
  check(
    'service_flags: + neurocirugía, se mantiene cirugía ortopédica, urgencias sigue true',
    targetItem.flagsAfter?.neurocirugia === true && targetItem.flagsAfter?.cirugia_ortopedica === true && targetItem.flagsAfter?.urgencias === true,
    targetItem.flagsAfter
  )
  check('conteo de servicios 3 → 4 (207, 206, 387, urgencias)', targetItem.servicesBefore === 3 && targetItem.servicesAfter === 4, targetItem)
  check(
    'operaciones: 3 upserts de la sede con cruce (no de la sede sin cruce), update de la IPS e historial',
    replacePlan.payload.services_upsert.length === 3 && replacePlan.payload.services_upsert.every(r => r.hospital_id === 'h-target') &&
      replacePlan.payload.hospital_updates.length === 1 && replacePlan.payload.hospital_updates[0].set_services === true &&
      replacePlan.payload.hospital_updates[0].reps_services_count === 4 && replacePlan.payload.history.length === 1 &&
      (replacePlan.payload.history[0].changes as { file_name?: string }).file_name === 'prueba.xlsx',
    replacePlan.payload
  )
  check('sede sin cruce: listada, sin operaciones', replacePlan.stats.unmatched === 1 && replacePlan.items.some(i => i.key === '999999999901' && i.status === 'unmatched' && !i.hasChanges))
  check('IPS con cambios = 1', replacePlan.stats.hospitalsWithChanges === 1)

  const mergePlan = planServicesImport({ data: servicesFile, matches: serviceMatches, hospitals: [target], existingServices, mode: 'merge' })
  const mergeItem = mergePlan.items.find(i => i.key === '050010012301')!
  check('solo añadir: no retira nada (328 sigue) → 5 servicios', mergePlan.payload.services_delete.length === 0 && mergeItem.removedCount === 0 && mergeItem.servicesAfter === 5, mergeItem)

  const noGroupFile = normalizeServiceRows(
    buildRawTable([['Código Habilitación', 'Código Servicio', 'Nombre Servicio'], ['050010012301', '207', 'CIRUGÍA ORTOPÉDICA']]).table,
    { repsCode: 0, serviceCode: 1, serviceName: 2 }
  )
  const noGroupPlan = planServicesImport({ data: noGroupFile, matches: serviceMatches, hospitals: [target], existingServices, mode: 'replace' })
  check(
    'archivo sin grupo en modo reemplazar: retira todo lo que no esté (328, urgencias y el 207 de otra modalidad)',
    noGroupFile.groups === null && same(noGroupPlan.payload.services_delete.sort(), ['s1', 's2', 's3']),
    noGroupPlan.payload.services_delete
  )

  const unchangedPlan = planServicesImport({
    data: normalizeServiceRows(
      buildRawTable([['Código Habilitación', 'Grupo Servicio', 'Código Servicio', 'Nombre Servicio', 'Modalidad'], ['050010012301', 'QUIRÚRGICOS', '207', 'CIRUGÍA ORTOPÉDICA', 'INTRAMURAL']]).table,
      { repsCode: 0, group: 1, serviceCode: 2, serviceName: 3, modality: 4 }
    ),
    matches: serviceMatches,
    hospitals: [{ ...target, service_flags: computeServiceFlags([{ code: '207', name: 'CIRUGÍA ORTOPÉDICA' }, { code: '328', name: 'MEDICINA GENERAL' }, { code: '1102', name: 'URGENCIAS' }]) }],
    existingServices,
    mode: 'merge',
  })
  check('sin cambios reales: sin historial, pero la IPS se actualiza (reps_updated_at)', unchangedPlan.payload.history.length === 0 && unchangedPlan.payload.hospital_updates.length === 1 && unchangedPlan.stats.hospitalsWithChanges === 0, unchangedPlan.items[0])

  const existingCapacity: ExistingCapacityRow[] = [
    { id: 'c1', reps_code: '050010012301', hospital_id: 'h-target', group_name: 'salas', concept: 'Quirófano', quantity: 2 },
    { id: 'c2', reps_code: '050010012301', hospital_id: 'h-target', group_name: 'camas', concept: 'Obstetricia', quantity: 4 },
    { id: 'c3', reps_code: '050010012301', hospital_id: 'h-target', group_name: 'ambulancias', concept: 'Medicalizada', quantity: 1 },
  ]
  const capacityFile = normalizeCapacityRows(
    buildRawTable([
      ['Código Habilitación', 'Grupo Capacidad', 'Concepto', 'Cantidad'],
      ['050010012301', 'SALAS', 'QUIRÓFANO', '3'],
      ['050010012301', 'CAMAS', 'Adultos', '10'],
      ['050010012301', 'CAMAS', 'Pediátrica', '5'],
    ]).table,
    { repsCode: 0, group: 1, concept: 2, quantity: 3 }
  )
  const capacityPlan = planCapacityImport({ data: capacityFile, matches: serviceMatches, hospitals: [target], existingCapacity, mode: 'replace' })
  const capItem = capacityPlan.items[0]
  check('capacidad: quirófanos 2 → 3 (concepto igual sin importar mayúsculas/tildes)', capItem.quirofanosBefore === 2 && capItem.quirofanosAfter === 3 && capItem.changed.some(c => /2 → 3/.test(c)), capItem)
  check('capacidad: camas REPS null → 15; Obstetricia retirada (grupo camas en el archivo)', capItem.bedsBefore === null && capItem.bedsAfter === 15 && capItem.removed.some(r => /Obstetricia/.test(r)), capItem)
  check('capacidad: ambulancias (grupo ausente) se conservan', same(capacityPlan.payload.capacity_delete, ['c2']), capacityPlan.payload.capacity_delete)
  check(
    'capacidad: update con set_quirofanos y set_beds, sin tocar service_flags',
    capacityPlan.payload.hospital_updates[0].set_quirofanos && capacityPlan.payload.hospital_updates[0].quirofanos === 3 &&
      capacityPlan.payload.hospital_updates[0].set_beds && capacityPlan.payload.hospital_updates[0].reps_beds === 15 &&
      capacityPlan.payload.hospital_updates[0].set_services === false,
    capacityPlan.payload.hospital_updates[0]
  )
  const onlyBeds = planCapacityImport({
    data: normalizeCapacityRows(buildRawTable([['Código Habilitación', 'Grupo Capacidad', 'Concepto', 'Cantidad'], ['050010012301', 'CAMAS', 'Adultos', '8']]).table, { repsCode: 0, group: 1, concept: 2, quantity: 3 }),
    matches: serviceMatches,
    hospitals: [{ ...target, quirofanos: null }],
    existingCapacity: [],
    mode: 'replace',
  })
  check('archivo solo con camas: quirófanos no se toca (sigue sin dato)', onlyBeds.payload.hospital_updates[0].set_quirofanos === false && onlyBeds.items[0].quirofanosAfter === null, onlyBeds.payload.hospital_updates[0])

  // =======================================================================================
  section('6. PDF')
  // =======================================================================================
  const header1: PdfText[] = [
    { x: 40, y: 540, text: 'Código' },
    { x: 40, y: 530, text: 'Habilitación' },
    { x: 140, y: 540, text: 'Nombre Sede' },
    { x: 300, y: 540, text: 'Código Servicio' },
    { x: 400, y: 540, text: 'Nombre Servicio' },
    { x: 650, y: 540, text: 'Modalidad' },
  ]
  const page1: PdfText[] = [
    { x: 300, y: 570, text: 'REPS - Servicios habilitados' },
    ...header1,
    { x: 40, y: 510, text: '050010012301' },
    { x: 140, y: 510, text: 'CLÍNICA FICTICIA' },
    { x: 300, y: 510, text: '207' },
    { x: 400, y: 510, text: 'CIRUGÍA ORTOPÉDICA' },
    { x: 650, y: 510, text: 'INTRAMURAL' },
    { x: 40, y: 495, text: '050010012301' },
    { x: 140, y: 495, text: 'CLÍNICA FICTICIA' },
    { x: 300, y: 495, text: '339' },
    { x: 400, y: 495, text: 'ORTOPEDIA Y/O' },
    { x: 650, y: 495, text: 'INTRAMURAL' },
    { x: 400, y: 485, text: 'TRAUMATOLOGÍA' },
    { x: 380, y: 40, text: 'Página 1 de 2' },
  ]
  const page2: PdfText[] = [
    ...header1.map(h => ({ ...h, y: h.y + 10 })),
    { x: 40, y: 520, text: '050010012302' },
    { x: 140, y: 520, text: 'SEDE NORTE' },
    { x: 300, y: 520, text: '387' },
    { x: 400, y: 520, text: 'NEUROCIRUGÍA' },
    { x: 650, y: 520, text: 'TELEMEDICINA' },
    { x: 380, y: 40, text: 'Página 2 de 2' },
  ]
  const pdfBytes = buildTextPdf([page1, page2])
  try {
    const parsedPdf = await parsePdfToTable(pdfBytes)
    const pdfMapping = detectColumns(parsedPdf.table.headers)
    const pdfData = normalizeServiceRows(parsedPdf.table, pdfMapping)
    check(
      'PDF: encabezado en dos renglones ("Código Habilitación") reconocido',
      parsedPdf.headerDetected && parsedPdf.table.headers[0] === 'Código Habilitación' && pdfMapping.repsCode === 0 && pdfMapping.serviceName === 3,
      { headers: parsedPdf.table.headers, mapping: pdfMapping }
    )
    check(
      'PDF: 3 filas (encabezado repetido y pies de página omitidos; celda partida unida)',
      parsedPdf.table.rows.length === 3 && parsedPdf.table.rows[1][3] === 'ORTOPEDIA Y/O TRAUMATOLOGÍA',
      parsedPdf.table.rows
    )
    check(
      'PDF → servicios: 2 sedes, 207/339/387 y tildes intactas',
      same(Object.keys(pdfData.sedes).sort(), ['050010012301', '050010012302']) && same(pdfData.services.map(s => s.code), ['207', '339', '387']) &&
        pdfData.sedes['050010012301'].sedeName === 'CLÍNICA FICTICIA' &&
        same(classifyService('339', pdfData.services[1].name), ['ortopedia', 'trauma']),
      pdfData
    )
  } catch (error) {
    check('PDF con texto se lee', false, error instanceof Error ? error.message : String(error))
  }

  let ocrError = ''
  try {
    await parsePdfToTable(buildTextPdf([[]]))
  } catch (error) {
    ocrError = error instanceof RepsImportError ? error.message : `otro error: ${String(error)}`
  }
  check('PDF sin texto (escaneado) → "PDF sin texto (escaneado): requiere OCR"', ocrError === PDF_NO_TEXT_ERROR, ocrError)

  const noTable = pdfPagesToTable([{ pageNumber: 1, items: [{ str: 'Hola', x: 10, y: 100, width: 20, height: 10 }, { str: 'mundo', x: 200, y: 100, width: 30, height: 10 }] }])
  check('PDF con texto pero sin tabla reconocible: aviso y columnas por posición', !noTable.headerDetected && noTable.warnings.includes(PDF_NO_TABLE_WARNING) && same(noTable.table.rows, [['Hola', 'mundo']]), noTable)

  // =======================================================================================
  section('7. Filtro de IPS (lista y mapa)')
  // =======================================================================================
  const big = { service_flags: { ortopedia: true, neurocirugia: true }, quirofanos: 4, reps_beds: 120, beds: 10, reps_updated_at: '2026-10-11T00:00:00Z' }
  const small = { service_flags: { ortopedia: false, cirugia_ortopedica: true }, quirofanos: 0, reps_beds: null, beds: 15, reps_updated_at: '2026-10-11T00:00:00Z' }
  const unknown = { service_flags: {}, quirofanos: null, reps_beds: null, beds: null }
  check('sin filtro: todas pasan', matchesIpsFilter(unknown, EMPTY_IPS_FILTER))
  check('con quirófano: solo la que tiene > 0', matchesIpsFilter(big, { ...EMPTY_IPS_FILTER, quirofano: true }) && !matchesIpsFilter(small, { ...EMPTY_IPS_FILTER, quirofano: true }))
  check('ortopedia: ortopedia o cirugía ortopédica', matchesIpsFilter(big, { ...EMPTY_IPS_FILTER, ortopedia: true }) && matchesIpsFilter(small, { ...EMPTY_IPS_FILTER, ortopedia: true }) && !matchesIpsFilter(unknown, { ...EMPTY_IPS_FILTER, ortopedia: true }))
  check('columna: cirugía de columna o neurocirugía', matchesIpsFilter(big, { ...EMPTY_IPS_FILTER, columna: true }) && !matchesIpsFilter(small, { ...EMPTY_IPS_FILTER, columna: true }))
  check('rango de camas usa camas del REPS y, si no hay, las de la ficha', matchesIpsFilter(big, { ...EMPTY_IPS_FILTER, minBeds: 100 }) && matchesIpsFilter(small, { ...EMPTY_IPS_FILTER, minBeds: 10, maxBeds: 20 }) && !matchesIpsFilter(unknown, { ...EMPTY_IPS_FILTER, minBeds: 0 }))
  check('casillas combinadas (Y): neurocirugía + quirófano + ≤ 50 camas → no', !matchesIpsFilter(big, { ...EMPTY_IPS_FILTER, neurocirugia: true, quirofano: true, maxBeds: 50 }))
  check('hasRepsData y parseBedsInput', hasRepsData(big) && !hasRepsData(unknown) && parseBedsInput(' 12 ') === 12 && parseBedsInput('') === null && parseBedsInput('-3') === null)

  print('')
  print(`Resultado: ${passed} OK, ${failed} con fallo`)
  if (failed > 0) process.exit(1)
}

main().catch(error => {
  process.stderr.write(`reps-import-check: error inesperado: ${error instanceof Error ? error.stack : String(error)}\n`)
  process.exit(1)
})
