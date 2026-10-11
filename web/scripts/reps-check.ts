/**
 * Fase 3 · Pruebas puras del cruce IPS ↔ sedes del REPS (lib/reps-match.ts). SIN red ni Supabase.
 *
 * Uso (desde web/): npx tsx scripts/reps-check.ts   (o npm run reps:check)
 * Código de salida 1 si alguna prueba falla.
 */
import {
  checkDigitFromCode,
  groupSedesByNit,
  isLoadedRepsClass,
  manualUnlinksFromHistory,
  matchHospitalsToReps,
  matchHospitalsToRepsStable,
  nameSimilarity,
  nameTokens,
  nitCheckDigit,
  nitFromCode,
  normalizeName,
  parseCsv,
  parseRepsCutDate,
  rankCandidates,
  sameNameTokens,
  summarizeMatches,
  type HospitalLite,
  type RepsMatchResult,
  type RepsSedeLite,
} from '../lib/reps-match'

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
console.log('1. Normalización de nombres')
eq('E.S.E. → ESE y sin tildes', normalizeName('E.S.E. Hospital San Rafael de Leticía'), 'ESE HOSPITAL SAN RAFAEL DE LETICIA')
eq('S. A. S. con espacios → SAS', normalizeName('Clínica Chía S. A. S.'), 'CLINICA CHIA SAS')
eq('punto pegado: E.S.E.Hospital', normalizeName('E.S.E.Hospital Santa Matilde'), 'ESE HOSPITAL SANTA MATILDE')
eq('Ñ → N', normalizeName('Unidad Cardioquirúrgica de Nariño'), 'UNIDAD CARDIOQUIRURGICA DE NARINO')
eq('quita códigos pegados al nombre', normalizeName('E.S.E. HOSPITAL SAN RAFAEL DE PACHO - (255130002801)'), 'ESE HOSPITAL SAN RAFAEL DE PACHO')
eq('tokens sin forma societaria ni CLINICA', nameTokens('Clínica Versalles S.A.'), ['VERSALLES'])
eq('tokens sin conectores, ordenados', nameTokens('Hospital Universitario de Sincelejo E.S.E.'), ['SINCELEJO', 'UNIVERSITARIO'])
eq('nombre sin tokens útiles → []', nameTokens('Clínica S.A.S.'), [])
check('mismo nombre con distinta forma societaria = 1', nameSimilarity('Clínica de Marly', 'CLINICA DE MARLY S.A') === 1)
check('sede con palabras de más < 1', nameSimilarity('Clínica Versalles', 'CLINICA VERSALLES SEDE SAN MARCOS') === 0.5)
check('variante sin paréntesis', nameSimilarity('Hospital de Fontibon ( Subred sur occidente)', 'Hospital Fontibón') === 1)
check('errata de una letra en palabra larga', nameSimilarity('Medicenter Especializado', 'MEDICENTER ESPECILIZADO LTDA') === 1)
check('números no se toleran como errata', nameSimilarity('Sede 12', 'Sede 13') === 0)
check('sameNameTokens exige mismos tokens', sameNameTokens('Clínica Chía S.A.S.', 'CLINICA CHIA') && !sameNameTokens('Clínica Chía', 'CLINICA CHIA 2'))

// ---------------------------------------------------------------------------------------------
console.log('2. NIT desde hospitals.code (misma regla que la columna generada hospitals.nit)')
eq('NIT-DV', nitFromCode('890303208-5'), '890303208')
eq('espacio delante', nitFromCode(' 900959048-4'), '900959048')
eq('espacio detrás', nitFromCode('901361882-6 '), '901361882')
eq('NIT+DV sin guion (10 dígitos)', nitFromCode('9013620904'), '901362090')
eq('DV de 2 cifras (dato sucio)', nitFromCode('800149384-10'), '800149384')
eq('8 dígitos no es NIT', nitFromCode('12345678-9'), null)
eq('11 dígitos sin guion no es NIT', nitFromCode('90136209041'), null)
eq('texto no es NIT', nitFromCode('NIT-123'), null)
eq('null', nitFromCode(null), null)
eq('DV DIAN de 890903938 (Bancolombia) = 8', nitCheckDigit('890903938'), 8)
eq('DV escrito en code', checkDigitFromCode('890903938-8'), 8)
eq('DV escrito sin guion', checkDigitFromCode('9013620904'), 4)

// ---------------------------------------------------------------------------------------------
console.log('3. Lectura del CSV del REPS')
eq('fecha de corte del REPS', parseRepsCutDate('Fecha corte REPS: Mar 12 2026  3:11PM'), '2026-03-12')
eq('fecha ISO', parseRepsCutDate('2026-04-30'), '2026-04-30')
eq('fecha dd/mm/aaaa', parseRepsCutDate('5/4/2026'), '2026-04-05')
eq(
  'CSV con comillas, comas, "" y CRLF',
  parseCsv('\ufeffa,"b,c","d ""e"""\r\n1,2,\r\n'),
  [['a', 'b,c', 'd "e"'], ['1', '2', '']]
)
eq('salto de línea dentro de comillas', parseCsv('"x\ny",z'), [['x\ny', 'z']])
check(
  'clases cargadas: IPS, objeto social diferente, transporte; no profesionales',
  isLoadedRepsClass('Instituciones Prestadoras de Servicios de Salud - IPS') &&
    isLoadedRepsClass('Objeto Social Diferente a la Prestación de Servicios de Salud') &&
    isLoadedRepsClass('Transporte Especial de Pacientes') &&
    !isLoadedRepsClass('Profesional Independiente')
)

// ---------------------------------------------------------------------------------------------
console.log('4. Cruce')
const sede = (codigo: string, nit: string, nombre: string, municipio: string): RepsSedeLite => ({
  codigo_habilitacion: codigo,
  nit,
  nombre_sede: nombre,
  municipio_sede: municipio,
})
const hosp = (id: string, code: string | null, name: string, municipality: string, repsCode: string | null = null): HospitalLite => ({
  id,
  code,
  name,
  municipality_id: municipality,
  reps_code: repsCode,
})

const SEDES: RepsSedeLite[] = [
  // A: una sola sede, en otro municipio
  sede('056150000101', '100000001', 'FUNDACION HOSPITAL SAN VICENTE DE PAUL RIONEGRO', '05615'),
  // B: tres sedes, una en el municipio de la IPS
  sede('110010000201', '100000002', 'CLINICA B BOGOTA', '11001'),
  sede('050010000202', '100000002', 'CLINICA B MEDELLIN', '05001'),
  sede('760010000203', '100000002', 'CLINICA B CALI', '76001'),
  // C: tres en el municipio, una con el mismo nombre
  sede('760010000301', '100000003', 'CLINICA VERSALLES S.A.', '76001'),
  sede('760010000306', '100000003', 'CLINICA VERSALLES SEDE SAN MARCOS', '76001'),
  sede('760010000307', '100000003', 'CLINICA VERSALLES HOSPITALIZACION', '76001'),
  // D: tres sedes escritas igual → ambigua con sugerida la de código más bajo
  sede('130010000403', '100000004', 'LITOTRICIA S.A', '13001'),
  sede('130010000402', '100000004', 'LITOTRICIA S.A.', '13001'),
  sede('130010000401', '100000004', 'LITOTRICIA S.A.', '13001'),
  // L: mismos tokens, pero solo una se escribe igual que la IPS → matched
  sede('630010001201', '100000013', 'IPS SAN RAFAEL ARMENIA', '63001'),
  sede('630010001203', '100000013', 'CLINICA SAN RAFAEL ARMENIA', '63001'),
  sede('110010001405', '100000014', 'CLINICA DE MARLY S.A', '11001'),
  sede('110010001401', '100000014', 'CLINICA DE MARLY', '11001'),
  // E: empate de parecido → ambigua sin sugerida
  sede('680010000502', '100000005', 'Instituto del Corazón de Bucaramanga S.A. - Sede Ambulatoria', '68001'),
  sede('680010000503', '100000005', 'Instituto del Corazon de Bucaramanga S.A. - Sede Chicamocha', '68001'),
  // G: una sede pedida por dos IPS iguales (duplicado en hospitals)
  sede('110010000725', '100000007', 'Hospital Fontibón', '11001'),
  sede('110010000701', '100000007', 'Hospital Occidente de Kennedy', '11001'),
  // H: una sede ya vinculada a otra IPS; la otra se elige por nombre
  sede('730010000801', '100000008', 'CLINICA ASOTRAUMA S.A.S.', '73001'),
  sede('730010000802', '100000008', 'CLINICA ASOTRAUMA SEDE SUR', '73001'),
  // I: nombre parecido nivel 1
  sede('410010000914', '100000009', 'Sede Abner Lozano', '41001'),
  sede('410010000901', '100000009', 'CLINICA MEDILASER S.A.', '41001'),
  sede('410010000903', '100000009', 'SEDE AMBULATORIA', '41001'),
  // J: nombre parecido nivel 2
  sede('660010001002', '100000010', 'Clinica Maraya sede 2', '66001'),
  sede('660010001001', '100000010', 'ONCOLOGOS DEL OCCIDENTE SA', '66001'),
  // K: una sola sede y dos IPS con ese NIT: gana la de nombre igual
  sede('230010001101', '100000011', 'CLINICA ZAYMA', '23001'),
]

const HOSPITALS: HospitalLite[] = [
  hosp('a', '100000001-1', 'Fundación Hospital San Vicente de Paul Rionegro', '05001'),
  hosp('b', '100000002-1', 'Clínica B', '05001'),
  hosp('c', '100000003-1', 'Clínica Versalles', '76001'),
  hosp('d', '100000004-1', 'Litotricia S.A.', '13001'),
  hosp('l1', '100000013-1', 'Clínica San Rafael Armenia', '63001'),
  hosp('l2', '100000014-1', 'Clínica de Marly', '11001'),
  hosp('e', '100000005-1', 'Instituto del Corazón de Bucaramanga', '68001'),
  hosp('f', '100000006-1', 'IPS Sin Sedes', '08001'),
  hosp('g1', '100000007-1', 'Hospital Fontibón', '11001'),
  hosp('g2', ' 100000007-4', 'Hospital de Fontibon ( Subred sur occidente)', '11001'),
  hosp('h1', '100000008-1', 'Clínica Asotrauma', '73001', '730010000801'),
  hosp('h2', '100000008-2', 'Clínica Asotrauma Sede Sur', '73001'),
  hosp('i', '100000009-1', 'Clínica Medilaser Sede Abner Lozano', '41001'),
  hosp('j', '100000010-1', 'Clínica Maraya', '66001'),
  hosp('k1', '100000011-1', 'Clínica Zayma', '23001'),
  hosp('k2', '100000011-2', 'Clínica Zayma Norte', '23001'),
  hosp('x', 'UPRES-ATL', 'Código sin NIT', '08001'),
]

const results = matchHospitalsToReps(HOSPITALS, groupSedesByNit(SEDES))
const byId = new Map(results.map(result => [result.hospital_id, result]))
const r = (id: string) => byId.get(id) as RepsMatchResult
const brief = (id: string) => ({ status: r(id).status, code: r(id).reps_code, method: r(id).method, suggested: r(id).suggested_code })

eq('a) 1 sede → matched aunque esté en otro municipio', brief('a'), { status: 'matched', code: '056150000101', method: 'unica_sede', suggested: null })
check('a) avisa municipio distinto', r('a').municipality_mismatch === true)
eq('b) varias sedes, una en el municipio → matched', brief('b'), { status: 'matched', code: '050010000202', method: 'municipio', suggested: null })
eq('c) varias en el municipio, una con el mismo nombre', brief('c'), { status: 'matched', code: '760010000301', method: 'nombre_exacto', suggested: null })
eq('d) tres escritas igual → ambigua, sugerida la de código más bajo', brief('d'), { status: 'ambiguous', code: null, method: null, suggested: '130010000401' })
eq('l1) mismos tokens; solo una con las mismas palabras (CLINICA) → matched', brief('l1'), { status: 'matched', code: '630010001203', method: 'nombre_exacto', suggested: null })
eq('l2) mismos tokens; solo una con el nombre completo igual → matched', brief('l2'), { status: 'matched', code: '110010001401', method: 'nombre_exacto', suggested: null })
eq('e) empate de parecido → ambigua sin sugerida', brief('e'), { status: 'ambiguous', code: null, method: null, suggested: null })
eq('f) NIT sin sedes → unmatched', brief('f'), { status: 'unmatched', code: null, method: null, suggested: null })
eq('x) code sin forma de NIT → unmatched', brief('x'), { status: 'unmatched', code: null, method: null, suggested: null })
check('g) dos IPS piden la misma sede con igual fuerza → las dos ambiguas', r('g1').status === 'ambiguous' && r('g2').status === 'ambiguous', [brief('g1'), brief('g2')])
eq('h1) ya vinculada → no se toca', brief('h1'), { status: 'matched', code: '730010000801', method: 'ya_vinculada', suggested: null })
eq('h2) no recibe la sede de h1; toma la otra por nombre', brief('h2'), { status: 'matched', code: '730010000802', method: 'nombre_exacto', suggested: null })
eq('i) nombre parecido (nivel 1)', brief('i'), { status: 'matched', code: '410010000914', method: 'nombre_similar', suggested: null })
eq('j) nombre parecido sin rival (nivel 2)', brief('j'), { status: 'matched', code: '660010001002', method: 'nombre_similar', suggested: null })
check('k) una sede y dos IPS: gana la de nombre igual', r('k1').status === 'matched' && r('k1').reps_code === '230010001101' && r('k2').status === 'ambiguous', [brief('k1'), brief('k2')])

const codes = results.filter(result => result.reps_code).map(result => result.reps_code)
check('una sede, una IPS (sin códigos repetidos)', new Set(codes).size === codes.length, codes)
eq('resumen', summarizeMatches(results), {
  total: 17,
  matched: 10,
  ambiguous: 5,
  unmatched: 2,
  byMethod: { unica_sede: 2, municipio: 1, nombre_exacto: 4, ya_vinculada: 1, nombre_similar: 2 },
  municipalityMismatch: 1,
})

const ranked = rankCandidates(HOSPITALS[1], SEDES.filter(s => s.nit === '100000002'))
eq('candidatas: primero las del municipio de la IPS', ranked.map(c => c.codigo_habilitacion)[0], '050010000202')

// Idempotencia: aplicar el resultado y volver a cruzar no cambia nada
const applied = HOSPITALS.map(h => ({ ...h, reps_code: byId.get(h.id)?.reps_code ?? h.reps_code ?? null }))
const second = matchHospitalsToReps(applied, groupSedesByNit(SEDES))
check(
  'segunda pasada: mismos estados y códigos; las vinculadas quedan "ya_vinculada"',
  second.every((result, index) => result.status === results[index].status && result.reps_code === results[index].reps_code) &&
    second.filter(result => result.status === 'matched').every(result => result.method === 'ya_vinculada'),
  second.map(result => [result.hospital_id, result.status, result.method])
)

// Varias vueltas: una IPS ambigua porque su rival es la sede de otra IPS del mismo NIT queda vinculada
const ROUND_SEDES: RepsSedeLite[] = [
  sede('761110000104', '100000012', 'Corazon y Aorta Buga', '76111'),
  sede('761110000105', '100000012', 'Corazon y Aorta Buga Sede 2', '76111'),
]
const ROUND_HOSPITALS: HospitalLite[] = [
  hosp('r1', '100000012-1', 'Corazon y Aorta Buga sede 1', '76111'),
  hosp('r2', '100000012-2', 'Corazon y Aorta Buga Sede 2', '76111'),
]
const oneRound = matchHospitalsToReps(ROUND_HOSPITALS, groupSedesByNit(ROUND_SEDES))
const stable = matchHospitalsToRepsStable(ROUND_HOSPITALS, groupSedesByNit(ROUND_SEDES))
check('1 vuelta: r1 ambigua (0,86 frente a 0,75), r2 por nombre exacto', oneRound[0].status === 'ambiguous' && oneRound[1].method === 'nombre_exacto', oneRound.map(x => [x.status, x.method]))
eq(
  'varias vueltas: r1 queda con la sede libre en la vuelta 2; r2 conserva su método',
  stable.map(x => [x.status, x.reps_code, x.method, x.round]),
  [['matched', '761110000104', 'nombre_similar', 2], ['matched', '761110000105', 'nombre_exacto', 1]]
)
const stableMain = matchHospitalsToRepsStable(HOSPITALS, groupSedesByNit(SEDES))
check('varias vueltas sobre el juego principal: sin códigos repetidos', new Set(stableMain.filter(x => x.reps_code).map(x => x.reps_code)).size === stableMain.filter(x => x.reps_code).length)

// Desvinculaciones manuales (hospital_history.changes.reps_link): el cruce automático las respeta
const link = (before: string | null, after: string | null) => ({ reps_link: { before: { reps_code: before }, after: { reps_code: after } } })
const manual = manualUnlinksFromHistory([
  { hospital_id: 'u1', created_at: '2026-10-11T10:00:00Z', reason: 'Vinculada', changes: link(null, '110010000001') },
  { hospital_id: 'u1', created_at: '2026-10-11T11:00:00Z', reason: 'Desvinculada de la sede REPS 110010000001', changes: link('110010000001', null) },
  { hospital_id: 'u2', created_at: '2026-10-11T10:00:00Z', changes: link('110010000002', null) },
  { hospital_id: 'u2', created_at: '2026-10-11T12:00:00Z', changes: link(null, '110010000003') },
  { hospital_id: 'u3', created_at: '2026-10-11T09:00:00Z', changes: { zone_fields: {} } },
  { hospital_id: 'u4', created_at: '2026-10-11T09:00:00Z', changes: null },
  { hospital_id: null, created_at: '2026-10-11T09:00:00Z', changes: link('110010000004', null) },
])
eq('desvinculación manual: cuenta solo la última acción con reps_link', Array.from(manual.keys()), ['u1'])
check('desvinculación manual: guarda fecha y motivo', manual.get('u1') === '2026-10-11 Desvinculada de la sede REPS 110010000001', manual.get('u1'))
check('desvinculación manual: sin historial no hay nada', manualUnlinksFromHistory([]).size === 0)

console.log(`\n${passed} correctas, ${failed} fallidas`)
if (failed > 0) process.exit(1)
