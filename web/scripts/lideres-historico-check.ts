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
 * - app/api/lideres/_lib/historico-server.ts: vista previa sin escribir, rechazo con líderes desconocidas, guardar con la
 *   función de reemplazo, la migración sin aplicar (503) y la lectura del histórico.
 *
 * Uso (desde web/): npx tsx scripts/lideres-historico-check.ts   (incluida en npm run test)
 */
import {
  contarContactos,
  crearResolutorCiudades,
  estadoDeTexto,
  fechaDeCelda,
  leerTracker,
  reconocerLider,
  tipoDeTexto,
  validarCarga,
  type FilaTracker,
} from '../lib/lideres-historico'
import { agendaTresSemanas, calidadRegistro, realizadasPorCiudad, realizadasPorMes, realizadasPorTipo, resumenPorLider, type ActividadSeguimiento } from '../lib/lideres-seguimiento'

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
eq('estados: Exitosa, Cancelada, vacío pasado y vacío futuro', [estadoDeTexto('Exitosa', '2026-10-01', CORTE), estadoDeTexto('Cancelada', '2026-10-01', CORTE), estadoDeTexto('', '2026-10-01', CORTE), estadoDeTexto('', '2026-11-03', CORTE), estadoDeTexto('', null, CORTE)], [
  'realizada',
  'cancelada',
  'sin_cerrar',
  'planificada',
  'sin_cerrar',
])
eq('contactos: se cuentan los nombres, no se guardan', [contarContactos('Dr. Uno, Dra. Dos; Dr. Tres'), contarContactos(''), contarContactos('Dr. Uno\nDr. Dos')], [3, 0, 2])

console.log('\n2. Leer la hoja REGISTRO')
const ENCABEZADO = ['Fecha', 'Líder', 'Ciudad', 'Tipo de actividad', 'Estado', 'Médicos / Contactos', 'Observaciones']
const hoja: unknown[][] = [
  ENCABEZADO,
  [46315, 'Ana Líder', 'Bogota', 'Correría', 'Exitosa', 'Dr. Secreto Uno, Dra. Secreta Dos', 'Paciente Juan Pérez, cirugía de rodilla'],
  ['', '', '', '', '', '', ''],
  ['31/02/2026', 'Ana Líder', 'Verona', 'Congreso Verona', '', '', ''],
  ['5/11/2026', 'Beto Líder', 'cartagena', 'Cena comercial', '', 'Dr. Uno', ''],
  [46316, '', 'Cali', 'Otro', 'Exitosa', '', ''],
]
const leida = leerTracker(hoja, CORTE)
check('lee las filas con líder (3) y cuenta la que no tiene (1); salta las vacías', leida.ok && leida.lectura.filas.length === 3 && leida.lectura.sinLider === 1, leida)
const filas = leida.ok ? leida.lectura.filas : []
eq('la primera fila, tal cual se guarda', filas[0], {
  fila: 2,
  fecha: '2026-10-20',
  fecha_texto: null,
  lider_texto: 'Ana Líder',
  ciudad_texto: 'Bogota',
  tipo: 'correria',
  tipo_texto: null,
  estado: 'realizada',
  contactos: 2,
  con_observacion: true,
})
check('ningún nombre de médico ni texto de observación sale de la lectura', !JSON.stringify(filas).match(/Secret|Juan P|rodilla|Dr\./), JSON.stringify(filas))
check('la fecha ilegible queda con su texto y sin cerrar; el tipo escrito a mano queda con su texto', filas[1].fecha === null && filas[1].fecha_texto === '31/02/2026' && filas[1].estado === 'sin_cerrar' && filas[1].tipo_texto === 'Congreso Verona' && filas[1].tipo === 'congreso')
check('la del 5 de noviembre (después del corte) queda planificada, fila 5', filas[2].estado === 'planificada' && filas[2].fila === 5)
const sinColumna = leerTracker([['Fecha', 'Líder', 'Ciudad']], CORTE)
check('sin las columnas del Tracker: error que dice cuáles faltan', !sinColumna.ok && sinColumna.error.includes('Tipo de actividad') && sinColumna.error.includes('Observaciones'), sinColumna)
const conTitulo = leerTracker([[''], ['', ''], ENCABEZADO, [46315, 'Ana Líder', 'Cali', 'Otro', 'Exitosa', '', '']], CORTE)
check('el encabezado puede estar más abajo (filas vacías arriba); la fila sigue siendo la de la hoja', conTitulo.ok && conTitulo.lectura.filas[0].fila === 4, conTitulo)

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
check('una inactiva o un nombre que no está: no se adivina', reconocerLider('Stefanía Gómez', usuarios) === null && reconocerLider('Nadie Aquí', usuarios) === null)
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

console.log('\n4. Validar la carga (lo que manda el navegador)')
const FILA: FilaTracker = { fila: 2, fecha: '2026-10-20', fecha_texto: null, lider_texto: 'Ana', ciudad_texto: 'Bogota', tipo: 'correria', tipo_texto: null, estado: 'realizada', contactos: 1, con_observacion: false }
const CARGA = { archivo: 'Tracker Líderes.xlsx', huella: 'a'.repeat(64), corte: CORTE, filas: [FILA], confirmar: false }
check('carga buena', validarCarga(CARGA).ok)
const mala = (cambios: Record<string, unknown>) => validarCarga({ ...CARGA, filas: [{ ...FILA, ...cambios }] })
check('rechaza una fila con nombres u observaciones (campos de más)', !mala({ medicos: 'Dr. Uno' }).ok && !mala({ observaciones: 'x' }).ok)
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
    { ...FILA, fila: 3, lider_texto: 'Ana Líder', ciudad_texto: 'Verona', tipo: 'otro', tipo_texto: 'Congreso Verona' },
    { ...FILA, fila: 4, lider_texto: 'Beto Líder', ciudad_texto: 'cartagena', estado: 'planificada', fecha: '2026-11-05' },
  ]
  const carga = { archivo: 'Tracker Líderes.xlsx', huella: 'b'.repeat(64), corte: CORTE, filas: filasCarga }

  console.log('\n6. Vista previa: quién es quién, sin escribir')
  const vista = await leer(await procesarCargaTracker({ ...carga, confirmar: false }, 'u-dir'))
  check(
    'reconoce a las dos líderes, dice qué ciudad no es de Colombia y cuenta estados',
    vista.status === 200 &&
      JSON.stringify(vista.body.vistaPrevia.lideres) ===
        JSON.stringify([
          { lider_texto: 'Ana Líder', filas: 2, user_id: 'u-ana', nombre: 'Ana María Líder' },
          { lider_texto: 'Beto Líder', filas: 1, user_id: 'u-beto', nombre: 'Beto Líder Dos' },
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

  console.log('\n7. Guardar')
  const sinMigracion = await leer(await procesarCargaTracker({ ...carga, confirmar: true }, 'u-dir'))
  check('sin la migración 0920: 503 con un mensaje claro (la vista previa sí funciona)', sinMigracion.status === 503 && /0920/.test(sinMigracion.body.error), sinMigracion.body)
  const desconocida = await leer(await procesarCargaTracker({ ...carga, filas: [...filasCarga, { ...FILA, fila: 5, lider_texto: 'Nadie Conocido' }], confirmar: true }, 'u-dir'))
  check('una líder que no está en OpMap: 400 que la nombra, y no guarda', desconocida.status === 400 && desconocida.body.error.includes('"Nadie Conocido"'), desconocida.body)
  migracionAplicada = true
  const guardado = await leer(await procesarCargaTracker({ ...carga, confirmar: true }, 'u-dir'))
  const rpc = llamadas.filter(llamada => llamada.ruta === 'rpc/lideres_historico_reemplazar').pop()
  const enviado = (rpc?.cuerpo as { p_filas: Fila[]; p_user: string; p_carga: Fila }) ?? null
  check('200: guarda las 3 con su usuario y su código DANE (Verona sin código)', guardado.status === 200 && guardado.body.guardado.filas === 3 && enviado?.p_filas.map(f => `${f.user_id}:${f.municipio_id}`).join() === 'u-ana:11001,u-ana:null,u-beto:13001', { body: guardado.body, enviado })
  check('quién guardó y qué archivo', enviado?.p_user === 'u-dir' && enviado.p_carga.archivo === 'Tracker Líderes.xlsx' && enviado.p_carga.huella === 'b'.repeat(64))

  console.log('\n8. Leer el histórico guardado')
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

  console.log(`\nResultado: ${passed} OK, ${failed} con fallo`)
  if (failed > 0) process.exit(1)
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
