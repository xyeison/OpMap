/**
 * Histórico del Excel "Tracker Líderes" y seguimiento de las líderes · pruebas puras (SIN RED: Supabase FALSO en
 * memoria). Decisión del dueño: docs/decisiones/2026-10-29-historico-tracker-lideres.md.
 *
 * Cubre:
 * - lib/lideres-historico.ts: encabezados, fechas (número de serie de Excel, Date, dd/mm/aaaa, ilegibles), tipos de la
 *   lista y escritos a mano, estados, contactos contados SIN sus nombres, observaciones solo como sí/no, reconocer a la
 *   líder y la ciudad, y la validación de la carga (rechaza campos de más).
 * - lib/lideres-seguimiento.ts: resumen por período y líder, por mes, por tipo y por ciudad, la agenda de tres semanas y
 *   la calidad del registro.
 * - scripts/lideres-historico-cargar.ts (la carga única del Excel desde el 2026-10-30): argumentos, la lectura del Excel
 *   como la hacía /lideres (hoja, filas, corte, huella y cuerpo), quién carga y lo que imprime (sin nombres de médicos
 *   ni observaciones).
 * - app/api/lideres/_lib/historico-server.ts: procesarCargaTracker, la que llama el script (antes la llamaba el POST de
 *   la ruta): la vista previa no escribe, una líder desconocida da 400 y no guarda, sin la 0920 da 503 y, al guardar,
 *   cada fila lleva su usuario y su código; y la lectura del histórico.
 * - app/api/lideres/historico/route.ts: solo GET (el Excel ya no se sube desde la página).
 *
 * Uso (desde web/): npx tsx scripts/lideres-historico-check.ts   (incluida en npm run test)
 */
import { createHash } from 'crypto'
import * as XLSX from 'xlsx'
import {
  contarContactos,
  crearResolutorCiudades,
  estadoDeTexto,
  estadoReconocido,
  fechaDeCelda,
  fechaIlegible,
  leerTracker,
  reconocerLider,
  tipoDeTexto,
  validarCarga,
  type FilaTracker,
} from '../lib/lideres-historico'
import { agendaTresSemanas, calidadRegistro, realizadasPorCiudad, realizadasPorMes, realizadasPorTipo, resumenPorLider, type ActividadSeguimiento } from '../lib/lideres-seguimiento'
import * as rutaHistorico from '../app/api/lideres/historico/route'
import { cuerpoDeCarga, leerArgumentos, leerExcelTracker, lineasResultado, problemaDeQuienCarga, USO, type RespuestaCarga } from './lideres-historico-cargar'

for (const clave of ['SUPABASE_SERVICE_ROLE_KEY', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_URL']) delete process.env[clave]
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supabase.test'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-falsa'

let passed = 0
let failed = 0
function check(name: string, condition: boolean, detail?: unknown) {
  if (condition) {
    passed++
    console.log(`  OK    ${name}`)
  } else {
    failed++
    console.log(`  FALLA ${name}${detail !== undefined ? ` → ${JSON.stringify(detail)}` : ''}`)
  }
}
const eq = (name: string, actual: unknown, expected: unknown) => check(name, JSON.stringify(actual) === JSON.stringify(expected), { actual, expected })

const CORTE = '2026-10-29'

console.log('\n1. Celdas del Excel')
eq('fecha como número de serie de Excel (46315 = 2026-10-20)', fechaDeCelda(46315, CORTE), '2026-10-20')
eq('fecha como Date', fechaDeCelda(new Date(2026, 9, 20), CORTE), '2026-10-20')
eq('fecha escrita dd/mm/aaaa', fechaDeCelda('5/11/2026', CORTE), '2026-11-05')
eq('fecha escrita aaaa-mm-dd', fechaDeCelda('2026-11-05', CORTE), '2026-11-05')
check('31 de febrero, texto suelto, año 1900 o 2035: ilegibles', [fechaDeCelda('31/02/2026', CORTE), fechaDeCelda('mañana', CORTE), fechaDeCelda(5, CORTE), fechaDeCelda('1/1/2035', CORTE)].every(f => f === null))
eq('tipos de la lista', ['Correría', 'Visita médico', 'Reunión clínica', 'Congreso / evento', 'Cena comercial', 'Almuerzo comercial'].map(t => tipoDeTexto(t)), [
  { tipo: 'correria', aMano: false },
  { tipo: 'visita_medico', aMano: false },
  { tipo: 'reunion_clinica', aMano: false },
  { tipo: 'congreso', aMano: false },
  { tipo: 'cena', aMano: false },
  { tipo: 'almuerzo', aMano: false },
])
eq('tipos escritos a mano: "correria con Ana" → correría, "cirugia rodilla" → cirugía, "evento raro" → otro', ['correria con Ana', 'cirugia rodilla', 'evento raro'].map(t => tipoDeTexto(t)), [
  { tipo: 'correria', aMano: true },
  { tipo: 'cirugia', aMano: true },
  { tipo: 'otro', aMano: true },
])
eq('estados: Exitosa, Cancelada, vacío pasado, vacío de hoy (aún puede cerrarse), vacío futuro y sin fecha', [estadoDeTexto('Exitosa', '2026-10-01', CORTE), estadoDeTexto('Cancelada', '2026-10-01', CORTE), estadoDeTexto('', '2026-10-01', CORTE), estadoDeTexto('', CORTE, CORTE), estadoDeTexto('', '2026-11-03', CORTE), estadoDeTexto('', null, CORTE)], [
  'realizada',
  'cancelada',
  'sin_cerrar',
  'planificada',
  'planificada',
  'sin_cerrar',
])
check('estados reconocidos: vacío, Exitosa y Cancelada; "Reprogramada" no', estadoReconocido('') && estadoReconocido('Exitosa') && estadoReconocido('cancelada') && !estadoReconocido('Reprogramada'))
eq('una hora en la fecha no la pasa al día siguiente (46315,75 = 20-oct a las 18:00)', fechaDeCelda(46315.75, CORTE), '2026-10-20')
eq('fecha ilegible: solo dígitos y separadores, nunca letras', [fechaIlegible('31/02/2026'), fechaIlegible('mañana con el Dr. Pérez'), fechaIlegible('')], ['31/02/2026', 'sin fecha', 'sin fecha'])
eq('contactos: se cuentan los nombres, no se guardan', [contarContactos('Dr. Uno, Dra. Dos; Dr. Tres'), contarContactos(''), contarContactos('Dr. Uno\nDr. Dos')], [3, 0, 2])

console.log('\n2. Leer la hoja REGISTRO')
const ENCABEZADO = ['Fecha', 'Líder', 'Ciudad', 'Tipo de actividad', 'Estado', 'Médicos / Contactos', 'Observaciones']
const hoja: unknown[][] = [
  ENCABEZADO,
  [46315, 'Ana Líder', 'Bogota', 'Correría', 'Exitosa', 'Dr. Secreto Uno, Dra. Secreta Dos', 'Paciente Juan Pérez, cirugía de rodilla'],
  ['', '', '', '', '', '', ''],
  ['31/02/2026', 'Ana Líder', 'Verona', 'Cirugía paciente Juan Gómez cédula 1234', 'Reprogramada', '', ''],
  ['5/11/2026', 'Beto Líder', 'cartagena', 'Cena comercial', '', 'Dr. Uno', ''],
  [46316, '', 'Cali', 'Otro', 'Exitosa', '', ''],
]
const leida = leerTracker(hoja, CORTE)
check('lee las filas con líder (3), cuenta la que no tiene (1) y el estado no reconocido (1); salta las vacías', leida.ok && leida.lectura.filas.length === 3 && leida.lectura.sinLider === 1 && leida.lectura.estadosNoReconocidos === 1, leida)
const filas = leida.ok ? leida.lectura.filas : []
eq('la primera fila, tal cual se guarda', filas[0], {
  fila: 2,
  fecha: '2026-10-20',
  fecha_texto: null,
  lider_texto: 'Ana Líder',
  ciudad_texto: 'Bogota',
  tipo: 'correria',
  tipo_a_mano: false,
  estado: 'realizada',
  contactos: 2,
  con_observacion: true,
})
check('ningún nombre de médico, observación ni tipo escrito a mano sale de la lectura', !JSON.stringify(filas).match(/Secret|Juan|rodilla|Dr\.|paciente|1234/), JSON.stringify(filas))
check('la fecha ilegible queda con sus dígitos y sin cerrar; el tipo escrito a mano queda marcado, sin su texto', filas[1].fecha === null && filas[1].fecha_texto === '31/02/2026' && filas[1].estado === 'sin_cerrar' && filas[1].tipo_a_mano && filas[1].tipo === 'cirugia')
check('la del 5 de noviembre (después del corte) queda planificada, fila 5', filas[2].estado === 'planificada' && filas[2].fila === 5)
const sinColumna = leerTracker([['Fecha', 'Líder', 'Ciudad']], CORTE)
check('sin las columnas del Tracker: error que dice cuáles faltan', !sinColumna.ok && sinColumna.error.includes('Tipo de actividad') && sinColumna.error.includes('Observaciones'), sinColumna)
const conTitulo = leerTracker([['TRACKER LÍDERES 2026'], ['', ''], ENCABEZADO, [46315, 'Ana Líder', 'Cali', 'Otro', 'Exitosa', '', '']], CORTE)
check('el encabezado puede estar debajo de un título; la fila sigue siendo la de la hoja', conTitulo.ok && conTitulo.lectura.filas[0].fila === 4, conTitulo)

console.log('\n3. Reconocer a la líder y la ciudad')
const usuarios = [
  { id: 'u-paola', full_name: 'Yineth Paola Jiménez Escobar', role: 'line_leader', active: true },
  { id: 'u-ale', full_name: 'Maria Alejandra Cobo Bulla', role: 'line_leader', active: true },
  { id: 'u-ale-2', full_name: 'Alejandra Cobo Ruiz', role: 'sales_manager', active: true },
  { id: 'u-sindy', full_name: 'Sindy Lorena Ramirez de la Rosa', role: 'line_leader', active: true },
  { id: 'u-vieja', full_name: 'Stefanía Gómez', role: 'line_leader', active: false },
]
eq('"Paola Jiménez" → Yineth Paola Jiménez Escobar (sin importar tildes)', reconocerLider('Paola Jimenez', usuarios), 'u-paola')
eq('"Alejandra Cobo": gana la líder de negocio aunque otra usuaria tenga el mismo nombre', reconocerLider('Alejandra Cobo', usuarios), 'u-ale')
eq('"Sindy Ramírez" → Sindy Lorena Ramirez de la Rosa', reconocerLider('Sindy Ramírez', usuarios), 'u-sindy')
eq('una líder que ya se fue (inactiva) también se reconoce: el histórico es suyo', reconocerLider('Stefanía Gómez', usuarios), 'u-vieja')
check('un nombre que no está o de una sola palabra ("Rosa"): no se adivina', reconocerLider('Nadie Aquí', usuarios) === null && reconocerLider('Rosa', [...usuarios, { id: 'u-rosa', full_name: 'Rosa Pérez', role: 'line_leader', active: true }]) === null)
eq(
  'la líder inactiva gana a una Ejecutiva Comercial activa con un nombre parecido',
  reconocerLider('Diana Gómez', [
    { id: 'lider-ida', full_name: 'Diana Gómez Rojas', role: 'line_leader', active: false },
    { id: 'ejecutiva', full_name: 'Diana Carolina Gómez Pérez', role: 'sales_manager', active: true },
  ]),
  'lider-ida'
)
check('dos líderes con las mismas palabras: no se adivina', reconocerLider('Ana', [...usuarios, { id: 'a1', full_name: 'Ana María Uno', role: 'line_leader', active: true }, { id: 'a2', full_name: 'Ana Dos', role: 'line_leader', active: true }]) === null)
const municipios = [
  { code: '11001', name: 'Bogotá, D.C.' },
  { code: '13001', name: 'Cartagena de Indias' },
  { code: '63001', name: 'Armenia' },
  { code: '05059', name: 'Armenia' },
  { code: '76834', name: 'Tuluá' },
  { code: '54001', name: 'San José de Cúcuta' },
  { code: '08001', name: 'Barranquilla' },
  { code: '25175', name: 'Chía' },
  { code: '05091', name: 'Betania' },
  { code: '68081', name: 'Betania' },
]
const ciudad = crearResolutorCiudades(municipios)
eq(
  'alias y nombres exactos: Bogota, bogota, cartagena, cucuta, bquilla, tulua, Chia',
  ['Bogota', 'bogota', 'cartagena', 'cucuta', 'bquilla', 'tulua', 'Chia'].map(ciudad),
  ['11001', '11001', '13001', '54001', '08001', '76834', '25175']
)
eq('"Armenia" es de dos departamentos: la capital (63001)', ciudad('Armenia'), '63001')
check('dos municipios con el mismo nombre y ninguno capital: sin código; Verona, La Guajira y vacío: sin código', ciudad('Betania') === null && ciudad('Verona') === null && ciudad('La Guajira') === null && ciudad('') === null)

console.log('\n4. Validar la carga (lo que manda el script de carga)')
const FILA: FilaTracker = { fila: 2, fecha: '2026-10-20', fecha_texto: null, lider_texto: 'Ana', ciudad_texto: 'Bogota', tipo: 'correria', tipo_a_mano: false, estado: 'realizada', contactos: 1, con_observacion: false }
const CARGA = { archivo: 'Tracker Líderes.xlsx', huella: 'a'.repeat(64), corte: CORTE, filas: [FILA], confirmar: false }
check('carga buena', validarCarga(CARGA).ok)
const mala = (cambios: Record<string, unknown>) => validarCarga({ ...CARGA, filas: [{ ...FILA, ...cambios }] })
check('rechaza una fila con nombres, observaciones o el texto del tipo (campos de más)', !mala({ medicos: 'Dr. Uno' }).ok && !mala({ observaciones: 'x' }).ok && !mala({ tipo_texto: 'Cirugía paciente' }).ok)
check(
  'rechaza fechas que no existen (31-feb), fecha con texto de fecha y una fecha ilegible con letras',
  !mala({ fecha: '2026-02-31' }).ok && !validarCarga({ ...CARGA, corte: '2026-02-31' }).ok && !mala({ fecha_texto: '20/10/2026' }).ok && !mala({ fecha: null, fecha_texto: 'con el Dr. X' }).ok && mala({ fecha: null, fecha_texto: '31/02/2026', estado: 'sin_cerrar' }).ok
)
check('rechaza: tipo o estado que no existen, sin fecha ni texto, planificada sin fecha, contactos negativos', !mala({ tipo: 'visita_paciente' }).ok && !mala({ estado: 'hecha' }).ok && !mala({ fecha: null }).ok && !mala({ fecha: null, fecha_texto: 'x', estado: 'planificada' }).ok && !mala({ contactos: -1 }).ok)
check('rechaza filas repetidas, huella que no es sha256 y sin confirmar', !validarCarga({ ...CARGA, filas: [FILA, FILA] }).ok && !validarCarga({ ...CARGA, huella: 'abc' }).ok && !validarCarga({ ...CARGA, confirmar: undefined }).ok)

console.log('\n5. Cifras del seguimiento')
const act = (cambios: Partial<ActividadSeguimiento>): ActividadSeguimiento => ({
  fecha: '2026-10-20',
  lider: 'Ana',
  ciudad: 'Bogotá, D.C.',
  municipio_id: '11001',
  tipo: 'correria',
  tipo_a_mano: false,
  estado: 'realizada',
  contactos: 2,
  con_observacion: true,
  ...cambios,
})
const actividades = [
  act({}),
  act({ fecha: '2026-10-22', ciudad: 'Cali', municipio_id: '76001', tipo: 'cena', contactos: 0 }),
  act({ fecha: '2026-10-25', estado: 'cancelada', con_observacion: false }),
  act({ fecha: '2026-10-10', estado: 'sin_cerrar' }),
  act({ fecha: '2026-11-04', estado: 'planificada' }),
  act({ fecha: '2026-08-15', tipo: 'congreso' }),
  act({ lider: 'Beto', fecha: '2026-10-28', ciudad: 'Verona', municipio_id: null, tipo: 'otro', tipo_a_mano: true }),
  act({ lider: 'Beto', fecha: null, estado: 'sin_cerrar' }),
]
const mes = resumenPorLider(actividades, 'mes', CORTE)
const ana = mes.lideres.find(l => l.lider === 'Ana')
check(
  'octubre, Ana: 2 realizadas, 1 cancelada sin observación, 1 sin cerrar, 75 % cerradas, 2 ciudades, 2 contactos, 1 planificada, última el 22',
  !!ana && ana.realizadas === 2 && ana.canceladas === 1 && ana.canceladasSinObservacion === 1 && ana.sinCerrar === 1 && ana.pctCerradas === 0.75 && ana.ciudades === 2 && ana.contactos === 2 && ana.planificadas === 1 && ana.ultima === '2026-10-22',
  ana
)
check('las líderes van de más a menos realizadas y el total suma todo', mes.lideres[0].lider === 'Ana' && mes.total.realizadas === 3 && mes.total.sinCerrar === 1, mes)
check('el período de 3 meses incluye agosto; el registro completo también', resumenPorLider(actividades, 'tres', CORTE).total.realizadas === 4 && resumenPorLider(actividades, 'todo', CORTE).total.realizadas === 4)
eq('realizadas por mes', realizadasPorMes(actividades, CORTE).map(m => [m.mes, m.total]), [['2026-08', 1], ['2026-10', 3]])
eq('por tipo en octubre', realizadasPorTipo(actividades, 'mes', CORTE), [{ clave: 'cena', n: 1 }, { clave: 'correria', n: 1 }, { clave: 'otro', n: 1 }])
eq('ciudades en octubre', realizadasPorCiudad(actividades, 'mes', CORTE).map(c => c.clave), ['Bogotá, D.C.', 'Cali', 'Verona'])
const agenda = agendaTresSemanas(actividades, CORTE)
check(
  'agenda: 21 días del 22-oct al 11-nov, las dos líderes y lo de cada día',
  agenda.dias.length === 21 && agenda.dias[0] === '2026-10-22' && agenda.dias[20] === '2026-11-11' && agenda.lideres.join() === 'Ana,Beto' && agenda.celdas.get('Ana|2026-11-04')?.[0].estado === 'planificada' && !agenda.celdas.has('Ana|2026-10-20'),
  agenda.dias
)
eq('calidad del registro (con códigos DANE)', calidadRegistro(actividades, true), { sinCerrar: 2, canceladasSinObservacion: 1, realizadasSinContactos: 1, fechasIlegibles: 1, tiposAMano: 1, ciudadesSinCodigo: 1 })

console.log('\n6. El script de carga única: argumentos, el Excel como lo leía /lideres y quién carga')
const UUID = '6f1c2a9e-3b4d-4c5e-8f70-1a2b3c4d5e6f'
eq('ruta y --user: vista previa (sin --run)', leerArgumentos(['Tracker.xlsx', '--user', UUID]), { archivo: 'Tracker.xlsx', user: UUID, run: false })
eq('--run y --user=uuid, en cualquier orden; el uuid queda en minúsculas', leerArgumentos(['--run', `--user=${UUID.toUpperCase()}`, 'Tracker.xlsx']), { archivo: 'Tracker.xlsx', user: UUID, run: true })
const errorDeArgumentos = (argv: string[]) => {
  try {
    leerArgumentos(argv)
    return null
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
}
const argumentosMalos = [
  ['--user', UUID],
  ['Tracker.xlsx'],
  ['Tracker.xlsx', '--user'],
  ['Tracker.xlsx', '--user', '--run'],
  ['Tracker.xlsx', '--user', 'laura'],
  ['Tracker.xlsx', '--user', UUID, '--dry-run'],
  ['a.xlsx', 'b.xlsx', '--user', UUID],
].map(errorDeArgumentos)
check(
  'error sin ruta, sin --user, con --user sin valor o que no es un uuid, con una opción desconocida o con dos rutas',
  argumentosMalos.every(mensaje => mensaje !== null),
  argumentosMalos
)
check('sin la ruta, el error dice cómo se usa', (errorDeArgumentos(['--user', UUID]) ?? '').includes(USO))

const escribirLibro = (libro: XLSX.WorkBook): Buffer => XLSX.write(libro, { type: 'buffer', bookType: 'xlsx' })
const libroTracker = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(libroTracker, XLSX.utils.aoa_to_sheet([['Listas'], ['Correría']]), 'LISTAS')
// La hoja de la sección 2 desde la fila 3, con el rango guardado desde A3 (como un Excel con dos filas vacías arriba):
// los números de fila deben seguir la hoja (sin range: 0 se correrían dos)
const hojaRegistro = XLSX.utils.sheet_add_aoa(XLSX.utils.aoa_to_sheet([]), hoja, { origin: 'A3' })
hojaRegistro['!ref'] = 'A3:G8'
XLSX.utils.book_append_sheet(libroTracker, hojaRegistro, 'REGISTRO')
const bytesTracker = escribirLibro(libroTracker)
const delExcel = leerExcelTracker(bytesTracker, 'Tracker Líderes.xlsx', CORTE)
const lecturaExcel = delExcel.ok ? delExcel.lectura : null
check(
  'lee la hoja REGISTRO aunque el libro tenga otras: las filas de leerTracker, con su número en la hoja (encabezado en la fila 3)',
  XLSX.read(bytesTracker, { type: 'buffer' }).Sheets.REGISTRO['!ref'] === 'A3:G8' &&
    !!lecturaExcel &&
    JSON.stringify(lecturaExcel.filas) === JSON.stringify(filas.map(fila => ({ ...fila, fila: fila.fila + 2 }))) &&
    lecturaExcel.sinLider === 1 &&
    lecturaExcel.estadosNoReconocidos === 1,
  delExcel
)
check(
  'huella = sha256 del archivo, el corte y el nombre del archivo, como los mandaba la página',
  !!lecturaExcel && lecturaExcel.huella === createHash('sha256').update(bytesTracker).digest('hex') && lecturaExcel.corte === CORTE && lecturaExcel.archivo === 'Tracker Líderes.xlsx'
)
const cuerpoScript = lecturaExcel ? cuerpoDeCarga(lecturaExcel, false) : null
check(
  'el cuerpo es el de la página ({ archivo, huella, corte, filas, confirmar }) y validarCarga lo acepta sin confirmar y confirmando',
  !!cuerpoScript &&
    !!lecturaExcel &&
    Object.keys(cuerpoScript).join() === 'archivo,huella,corte,filas,confirmar' &&
    cuerpoScript.confirmar === false &&
    validarCarga(cuerpoScript).ok &&
    validarCarga(cuerpoDeCarga(lecturaExcel, true)).ok,
  cuerpoScript
)
check(
  'ningún nombre de médico, observación ni tipo escrito a mano en lo que manda el script',
  !!cuerpoScript && !JSON.stringify({ ...cuerpoScript, huella: '' }).match(/Secret|Juan|rodilla|Dr\.|paciente|1234/),
  cuerpoScript
)
const libroSinRegistro = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(libroSinRegistro, XLSX.utils.aoa_to_sheet(hoja), 'Hoja1')
XLSX.utils.book_append_sheet(libroSinRegistro, XLSX.utils.aoa_to_sheet([['Listas']]), 'LISTAS')
const libroUnaHoja = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(libroUnaHoja, XLSX.utils.aoa_to_sheet(hoja), 'Hoja1')
const sinRegistro = leerExcelTracker(escribirLibro(libroSinRegistro), 'Otro.xlsx', CORTE)
const unaHoja = leerExcelTracker(escribirLibro(libroUnaHoja), 'Otro.xlsx', CORTE)
check(
  'con varias hojas y ninguna REGISTRO: error que la nombra; con una sola hoja, aunque se llame distinto, la lee',
  !sinRegistro.ok && sinRegistro.error.includes('REGISTRO') && unaHoja.ok && unaHoja.lectura.filas.length === 3,
  { sinRegistro, unaHoja: unaHoja.ok ? unaHoja.lectura.filas.length : unaHoja }
)
const quienCarga = (cambios: { role?: string; active?: boolean | null }) => ({ id: UUID, full_name: 'Laura Directora', role: 'commercial_director', active: true, ...cambios })
check(
  'carga la dirección comercial o el administrador, activos (activo sin dato cuenta como activo, como en la función de la 0920)',
  problemaDeQuienCarga(quienCarga({})) === null && problemaDeQuienCarga(quienCarga({ role: 'admin' })) === null && problemaDeQuienCarga(quienCarga({ active: null })) === null
)
check(
  'no carga: un uuid que no es de nadie, un usuario inactivo, una líder de negocio ni un Ejecutivo Comercial (sin lideres:seguimiento)',
  [null, quienCarga({ active: false }), quienCarga({ role: 'line_leader' }), quienCarga({ role: 'sales_manager' })].every(usuario => problemaDeQuienCarga(usuario) !== null)
)

// ---------------------------------------------------------------------------
// Supabase FALSO: GET de users, municipalities, lideres_historico(_cargas) y la RPC
// ---------------------------------------------------------------------------
type Fila = Record<string, unknown>
const tablas: Record<string, Fila[]> = {
  users: [
    { id: 'u-ana', full_name: 'Ana María Líder', role: 'line_leader', active: true },
    { id: 'u-beto', full_name: 'Beto Líder Dos', role: 'line_leader', active: true },
    { id: 'u-dir', full_name: 'Laura Directora', role: 'commercial_director', active: true },
  ],
  municipalities: [
    { code: '11001', name: 'Bogotá, D.C.' },
    { code: '13001', name: 'Cartagena de Indias' },
  ],
}
let migracionAplicada = false
const llamadas: { metodo: string; ruta: string; cuerpo?: unknown }[] = []
const json = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: { 'content-type': 'application/json' } })
globalThis.fetch = (async (entrada: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url)
  if (url.origin !== 'http://supabase.test') throw new Error(`lideres-historico-check: intento de red a ${url.origin}`)
  const metodo = (init?.method ?? 'GET').toUpperCase()
  const ruta = url.pathname.replace('/rest/v1/', '')
  const cuerpo = init?.body ? JSON.parse(String(init.body)) : undefined
  llamadas.push({ metodo, ruta, cuerpo })
  const faltaTabla = () => json({ code: 'PGRST205', message: `Could not find the table 'public.${ruta}' in the schema cache`, details: null, hint: null }, 404)
  if (ruta === 'rpc/lideres_historico_reemplazar') {
    if (!migracionAplicada) return json({ code: 'PGRST202', message: 'Could not find the function public.lideres_historico_reemplazar', details: null, hint: null }, 404)
    const filasNuevas = (cuerpo.p_filas as Fila[]).map(f => ({ ...f }))
    tablas.lideres_historico = filasNuevas
    tablas.lideres_historico_cargas = [...(tablas.lideres_historico_cargas ?? []), { ...cuerpo.p_carga, filas: filasNuevas.length, importado_at: '2026-10-29T20:00:00Z', importado_por: cuerpo.p_user }]
    return json({ carga_id: 'carga-1', filas: filasNuevas.length })
  }
  if (metodo !== 'GET') throw new Error(`lideres-historico-check: método no soportado ${metodo} ${ruta}`)
  if (ruta.startsWith('lideres_historico') && !migracionAplicada) return faltaTabla()
  const filasTabla = [...(tablas[ruta] ?? [])]
  if (ruta === 'lideres_historico_cargas') filasTabla.reverse()
  return json(filasTabla)
}) as typeof fetch

async function main() {
  const { leerHistoricoTracker, procesarCargaTracker } = await import('../app/api/lideres/_lib/historico-server')
  const leer = async (respuesta: Response) => ({ status: respuesta.status, body: await respuesta.json() })
  const filasCarga: FilaTracker[] = [
    { ...FILA, fila: 2, lider_texto: 'Ana Líder', ciudad_texto: 'bogota' },
    { ...FILA, fila: 3, lider_texto: 'Ana Líder', ciudad_texto: 'Verona', tipo: 'otro', tipo_a_mano: true },
    { ...FILA, fila: 4, lider_texto: 'Beto Líder', ciudad_texto: 'cartagena', estado: 'planificada', fecha: '2026-11-05' },
  ]
  const carga = { archivo: 'Tracker Líderes.xlsx', huella: 'b'.repeat(64), corte: CORTE, filas: filasCarga }

  console.log('\n7. procesarCargaTracker sin confirmar (la vista previa del script): quién es quién, sin escribir')
  const vista = await leer(await procesarCargaTracker({ ...carga, confirmar: false }, 'u-dir'))
  check(
    'reconoce a las dos líderes, dice qué ciudad no es de Colombia y cuenta estados',
    vista.status === 200 &&
      JSON.stringify(vista.body.vistaPrevia.lideres) ===
        JSON.stringify([
          { lider_texto: 'Ana Líder', filas: 2, user_id: 'u-ana', nombre: 'Ana María Líder', aviso: null },
          { lider_texto: 'Beto Líder', filas: 1, user_id: 'u-beto', nombre: 'Beto Líder Dos', aviso: null },
        ]) &&
      JSON.stringify(vista.body.vistaPrevia.ciudadesSinCodigo) === JSON.stringify([{ ciudad_texto: 'Verona', filas: 1 }]) &&
      JSON.stringify(vista.body.vistaPrevia.ciudades) ===
        JSON.stringify([
          { ciudad_texto: 'bogota', municipio_id: '11001', nombre: 'Bogotá, D.C.' },
          { ciudad_texto: 'cartagena', municipio_id: '13001', nombre: 'Cartagena de Indias' },
        ]) &&
      vista.body.vistaPrevia.porEstado.planificada === 1,
    vista.body
  )
  check('la vista previa no escribe nada', !llamadas.some(llamada => llamada.metodo !== 'GET'))
  tablas.users.push({ id: 'u-carla', full_name: 'Carla Ventas Uno', role: 'sales_manager', active: true }, { id: 'u-ida', full_name: 'Irene Ida Líder', role: 'line_leader', active: false })
  const conAvisos = await leer(
    await procesarCargaTracker({ ...carga, filas: [...filasCarga, { ...FILA, fila: 5, lider_texto: 'Carla Ventas' }, { ...FILA, fila: 6, lider_texto: 'Irene Ida' }], confirmar: false }, 'u-dir')
  )
  const aviso = (texto: string) => conAvisos.body.vistaPrevia.lideres.find((item: { lider_texto: string }) => item.lider_texto === texto)?.aviso
  check('la vista previa avisa si la persona reconocida no es líder de negocio o está inactiva', aviso('Carla Ventas') === 'no es líder de negocio' && aviso('Irene Ida') === 'inactiva' && aviso('Ana Líder') === null, conAvisos.body.vistaPrevia.lideres)

  console.log('\n8. procesarCargaTracker confirmando (--run del script): guardar')
  const llamadasRpc = () => llamadas.filter(llamada => llamada.ruta === 'rpc/lideres_historico_reemplazar').length
  const sinMigracion = await leer(await procesarCargaTracker({ ...carga, confirmar: true }, 'u-dir'))
  check('sin la migración 0920: 503 con un mensaje claro (la vista previa sí funciona)', sinMigracion.status === 503 && /0920/.test(sinMigracion.body.error), sinMigracion.body)
  const rpcAntes = llamadasRpc()
  const desconocida = await leer(await procesarCargaTracker({ ...carga, filas: [...filasCarga, { ...FILA, fila: 5, lider_texto: 'Nadie Conocido' }], confirmar: true }, 'u-dir'))
  check(
    'una líder que no está en OpMap: 400 que la nombra, y no guarda (ni llama a la función de reemplazo)',
    desconocida.status === 400 && desconocida.body.error.includes('"Nadie Conocido"') && llamadasRpc() === rpcAntes,
    desconocida.body
  )
  migracionAplicada = true
  const guardado = await leer(await procesarCargaTracker({ ...carga, confirmar: true }, 'u-dir'))
  const rpc = llamadas.filter(llamada => llamada.ruta === 'rpc/lideres_historico_reemplazar').pop()
  const enviado = (rpc?.cuerpo as { p_filas: Fila[]; p_user: string; p_carga: Fila }) ?? null
  check('200: guarda las 3 con su usuario y su código DANE (Verona sin código)', guardado.status === 200 && guardado.body.guardado.filas === 3 && enviado?.p_filas.map(f => `${f.user_id}:${f.municipio_id}`).join() === 'u-ana:11001,u-ana:null,u-beto:13001', { body: guardado.body, enviado })
  check('quién guardó y qué archivo', enviado?.p_user === 'u-dir' && enviado.p_carga.archivo === 'Tracker Líderes.xlsx' && enviado.p_carga.huella === 'b'.repeat(64))

  console.log('\n9. Leer el histórico guardado (GET)')
  const historico = await leer(await leerHistoricoTracker())
  check(
    'la última carga y las filas con el nombre de OpMap y de la ciudad',
    historico.status === 200 && historico.body.disponible && historico.body.carga.archivo === 'Tracker Líderes.xlsx' && historico.body.carga.importado_por === 'Laura Directora' &&
      historico.body.filas.map((f: Fila) => `${f.lider}|${f.ciudad}`).join() === 'Ana María Líder|Bogotá, D.C.,Ana María Líder|Verona,Beto Líder Dos|Cartagena de Indias',
    historico.body
  )
  migracionAplicada = false
  const sinTabla = await leer(await leerHistoricoTracker())
  check('sin la migración: disponible = false, sin filas', sinTabla.status === 200 && sinTabla.body.disponible === false && sinTabla.body.filas.length === 0, sinTabla.body)

  console.log('\n10. El script de punta a punta (Excel → procesarCargaTracker → lo que imprime) y la ruta sin POST')
  if (!lecturaExcel) check('el Excel de la sección 6 se leyó', false)
  else {
    const escrituras = () => llamadas.filter(llamada => llamada.metodo !== 'GET').length
    const escriturasAntes = escrituras()
    const previa = await procesarCargaTracker(cuerpoDeCarga(lecturaExcel, false), 'u-dir')
    const lineasPrevia = lineasResultado(lecturaExcel, previa.status, (await previa.json()) as RespuestaCarga, false)
    const textoPrevia = lineasPrevia.join('\n')
    check(
      'sin --run: filas y estados, cada líder con su usuario, la ciudad sin código, las fechas ilegibles y las filas sin líder; termina en "Nada guardado." y no escribe',
      previa.status === 200 &&
        textoPrevia.includes('Vista previa: 3 actividades (1 realizadas, 0 canceladas, 1 sin cerrar y 1 planificadas).') &&
        textoPrevia.includes('"Ana Líder" → Ana María Líder (u-ana) · 2 filas') &&
        textoPrevia.includes('"Beto Líder" → Beto Líder Dos (u-beto) · 1 fila') &&
        textoPrevia.includes('\n  Verona: 1') &&
        textoPrevia.includes('Fechas ilegibles (se guardan sin fecha, solo con sus dígitos y separadores): 1.') &&
        textoPrevia.includes('Filas sin líder (no se guardan): 1.') &&
        lineasPrevia[lineasPrevia.length - 1] === 'Nada guardado.' &&
        escrituras() === escriturasAntes,
      lineasPrevia
    )
    check('lo que imprime no trae nombres de médicos, observaciones ni el tipo escrito a mano', !textoPrevia.match(/Secret|Juan|rodilla|Dr\.|paciente|1234/), lineasPrevia)
    const vistaConDesconocida: RespuestaCarga = {
      vistaPrevia: {
        filas: 1,
        lideres: [{ lider_texto: 'Nadie Conocido', filas: 1, user_id: null, nombre: null, aviso: null }],
        ciudadesSinCodigo: [],
        ciudades: [],
        porEstado: { realizada: 1, cancelada: 0, sin_cerrar: 0, planificada: 0 },
        fechasIlegibles: 0,
      },
    }
    const desconocidaScript = lineasResultado(lecturaExcel, 200, vistaConDesconocida, false)
    check(
      'sin --run y con una líder que no está en OpMap: lo marca y avisa que --run se rechazaría',
      desconocidaScript.includes('  "Nadie Conocido" → NO ESTÁ EN OPMAP · 1 fila') && desconocidaScript.some(linea => linea.startsWith('Con --run se rechazaría')) && desconocidaScript[desconocidaScript.length - 1] === 'Nada guardado.',
      desconocidaScript
    )
    const sinTablaRun = await procesarCargaTracker(cuerpoDeCarga(lecturaExcel, true), 'u-dir')
    const lineasSinTabla = lineasResultado(lecturaExcel, sinTablaRun.status, (await sinTablaRun.json()) as RespuestaCarga, true)
    check(
      '--run sin la 0920: dice el error 503 y "Nada guardado."',
      sinTablaRun.status === 503 && lineasSinTabla.some(linea => linea.startsWith('Error 503: Falta aplicar la migración 0920')) && lineasSinTabla[lineasSinTabla.length - 1] === 'Nada guardado.',
      lineasSinTabla
    )
    migracionAplicada = true
    const conRun = await procesarCargaTracker(cuerpoDeCarga(lecturaExcel, true), 'u-dir')
    const lineasRun = lineasResultado(lecturaExcel, conRun.status, (await conRun.json()) as RespuestaCarga, true)
    const rpcScript = llamadas.filter(llamada => llamada.ruta === 'rpc/lideres_historico_reemplazar').pop()?.cuerpo as { p_filas: Fila[]; p_user: string; p_carga: Fila } | undefined
    check(
      '--run: guarda las 3 filas del Excel con su número, su usuario y su código, la huella del archivo y quién carga, y lo dice',
      conRun.status === 200 &&
        lineasRun[lineasRun.length - 1] === 'Guardado: 3 actividades (carga carga-1). El histórico anterior se reemplazó.' &&
        rpcScript?.p_filas.map(f => `${f.fila}:${f.user_id}:${f.municipio_id}`).join() === '4:u-ana:11001,6:u-ana:null,7:u-beto:13001' &&
        rpcScript.p_carga.huella === lecturaExcel.huella &&
        rpcScript.p_user === 'u-dir',
      { lineasRun, rpcScript }
    )
  }
  check(
    'la ruta /api/lideres/historico solo tiene GET: el Excel ya no se sube desde la página',
    typeof rutaHistorico.GET === 'function' && ['POST', 'PUT', 'PATCH', 'DELETE'].every(metodo => !(metodo in rutaHistorico)),
    Object.keys(rutaHistorico)
  )

  console.log(`\nResultado: ${passed} OK, ${failed} con fallo`)
  if (failed > 0) process.exit(1)
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
