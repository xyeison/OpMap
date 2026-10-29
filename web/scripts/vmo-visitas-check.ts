/**
 * Visitas de VMO para el mapa de calor · pruebas puras (SIN RED: Supabase FALSO en memoria). Pedido del dueño
 * (2026-10-29): guardar las visitas georreferenciadas por Ejecutivo Comercial, crear a la persona si no existe, una llave
 * con un dato de VMO e importar solo las hechas (realizadas y extra). Decisión:
 * docs/decisiones/2026-10-29-visitas-vmo-mapa-de-calor.md
 *
 * Cubre lib/vmo-visitas.ts (lectura del Excel de VMO › Visitas con sus encabezados y formatos reales: fecha
 * "22 Oct 2026 07:31:46", "Visita presencial-Presencial", "Visita extra"; descartes; nada de los datos del médico en lo
 * que se manda; lotes con todos los Ejecutivos Comerciales; llave del nombre; emparejar con OpMap sin depender del orden;
 * estado de la persona nueva; validación del lote y de la simulación) y el importador
 * (app/api/visits/_lib/importar-vmo.ts: simulación sin escribir, enlaza o crea personas, upsert por vmo_id sin duplicar
 * ni borrar, la extra como "Visita extra", las visitas de la app intactas).
 *
 * Uso (desde web/): npx tsx scripts/vmo-visitas-check.ts   (incluida en npm run test)
 */
import {
  claveComercial,
  columnasFaltantes,
  comercialesDe,
  emparejarComerciales,
  estadoComercialNuevo,
  fechaVmo,
  leerVisitasVmo,
  lotesVmo,
  MAX_VISITAS_POR_LOTE,
  nombreVmo,
  validarLoteVmo,
  type PersonaVmo,
  type VisitaVmo,
} from '../lib/vmo-visitas'

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
    console.log(`  FALLA ${name}${detail !== undefined ? ` -> ${JSON.stringify(detail)}` : ''}`)
  }
}

// Encabezados reales de VMO › Visitas → Excel → Todo (exportado el 2026-10-29)
const ENCABEZADOS = ['ID', 'Id de panel', 'Panel', 'Nombre completo', 'Correo electrónico', 'Fecha de la visita', 'Hora inicial / Hora final',
  'Tipo de visitas', 'Tipo de contacto', 'Longitud', 'Ayudas visuales', 'Latitud', 'Representante', 'Fecha de reporte', 'No. de identificación',
  'Categoría', 'Especialidad', 'Institución', 'Distancia de la visita', 'Dirección', 'Ciudad', 'Teléfono', 'Agendado', 'Duración',
  'Productos promocionados', 'Visita virtual', 'Plataforma', 'Ciclo', 'Tipo de actividad', 'Hábeas Data']

let siguiente = 25100
function fila(cambios: Record<string, unknown> = {}): Record<string, unknown> {
  const base: Record<string, unknown> = Object.fromEntries(ENCABEZADOS.map(h => [h, null]))
  return {
    ...base,
    ID: ++siguiente, Panel: 'Médicos', 'Nombre completo': 'Dra. Paciente Secreta', 'No. de identificación': '1234567890', Teléfono: '3001234567',
    'Fecha de la visita': '22 Oct 2026 07:31:46', 'Hora inicial / Hora final': '07:31 / 07:31', 'Tipo de visitas': 'Visita realizada',
    'Tipo de contacto': 'Visita presencial-Presencial', Latitud: 10.4613, Longitud: -73.2476, Representante: 'Leyda Santiago Salcedo',
    'Fecha de reporte': '2026-10-22', Ciclo: 'OCTUBRE 2026',
    ...cambios,
  }
}

console.log('1. Columnas, fechas y nombres de VMO')
check('las columnas reales de la exportación: no falta ninguna', columnasFaltantes(ENCABEZADOS).length === 0)
check('sin "Latitud" ni "ID": las nombra', JSON.stringify(columnasFaltantes(ENCABEZADOS.filter(h => h !== 'Latitud' && h !== 'ID'))) === JSON.stringify(['ID', 'Latitud']))
check('encabezados en minúsculas y sin tildes también sirven', columnasFaltantes(['id', 'representante', 'fecha de la visita', 'tipo de visitas', 'tipo de contacto', 'latitud', 'longitud']).length === 0)
for (const [entrada, salida] of [
  ['22 Oct 2026 07:31:46', '2026-10-22'], ['5 Dec 2025 18:02:10', '2025-12-05'], ['05 ago 2026', '2026-08-05'], ['1 Dic. 2025', '2025-12-01'],
  ['2026-10-22', '2026-10-22'], ['22/10/2026', '2026-10-22'], ['31 Feb 2026 10:00:00', null], ['ayer', null], ['', null], [null, null],
] as const) check(`fechaVmo(${JSON.stringify(entrada)}) = ${salida}`, fechaVmo(entrada) === salida, fechaVmo(entrada))
check('fechaVmo de una fecha de Excel (Date)', fechaVmo(new Date(2026, 9, 22, 7, 31)) === '2026-10-22')
check('nombreVmo quita espacios de sobra ("Lizeth Albarracín " de VMO)', nombreVmo('  Lizeth   Albarracín ') === 'Lizeth Albarracín')
check('claveComercial: minúsculas, sin tildes ni signos', claveComercial('María  Isabel Díaz-Ahumada') === 'maria isabel diaz ahumada' && claveComercial('Iñaki Peña') === 'inaki pena')

console.log('\n2. Lectura del archivo: solo las hechas con coordenadas, una por ID, sin datos del médico')
siguiente = 25100
const filas = [
  fila(), // 25101 Leyda, presencial
  fila({ Representante: 'Joana Andrea Galvez Ortiz', 'Tipo de contacto': 'Visita virtual-Chat', 'Fecha de la visita': '23 Oct 2026 09:21:23' }), // 25102
  fila({ 'Tipo de visitas': 'Visita no realizada' }), // 25103 no efectiva
  fila({ Latitud: null }), // 25104 sin coordenadas
  fila({ Latitud: 40.4, Longitud: -3.7 }), // 25105 fuera de Colombia (Madrid)
  fila({ 'Fecha de la visita': 'sin fecha' }), // 25106
  fila({ Representante: '  ' }), // 25107
  fila({ ID: null }), // sin ID
  fila({ ID: 25101 }), // repetida
  fila({ Representante: 'Lizeth Albarracín ', 'Fecha de la visita': '30 Sep 2026 15:00:00', Latitud: '10,4721', Longitud: '-73,2533' }), // coma decimal
  fila({ 'Tipo de visitas': 'Visita extra', 'Fecha de la visita': '24 Oct 2026 10:00:00' }), // extra: también es una visita hecha
]
const lectura = leerVisitasVmo(filas)
check('4 visitas de 11 filas', lectura.filas === 11 && lectura.visitas.length === 4, lectura)
check(
  'descartes: 1 no realizada, 2 sin coordenadas (vacía o fuera de Colombia), 1 sin fecha, 1 sin Ejecutivo Comercial, 1 sin ID, 1 repetida',
  JSON.stringify(lectura.descartadas) === JSON.stringify({ noRealizadas: 1, sinCoordenadas: 2, sinFecha: 1, sinComercial: 1, sinId: 1, repetidas: 1 }),
  lectura.descartadas
)
const [leyda, joana, lizeth, extra] = lectura.visitas
check('presencial / virtual según "Tipo de contacto"', leyda.presencial === true && joana.presencial === false)
check('fecha real de la visita (no la del reporte) y coordenadas con coma decimal', joana.fecha === '2026-10-23' && lizeth.fecha === '2026-09-30' && lizeth.lat === 10.4721 && lizeth.lng === -73.2533, lizeth)
check('el nombre como lo escribe VMO, sin espacios de sobra', lizeth.comercial === 'Lizeth Albarracín')
check('"Visita extra" entra marcada como extra; las realizadas no', extra.extra === true && extra.fecha === '2026-10-24' && !leyda.extra && !joana.extra && !lizeth.extra, extra)
check('por mes', JSON.stringify(lectura.porMes) === JSON.stringify({ '2026-10': 3, '2026-09': 1 }), lectura.porMes)
check('cada visita trae solo vmo_id, comercial, fecha, lat, lng, presencial y extra', lectura.visitas.every(v => Object.keys(v).sort().join(',') === 'comercial,extra,fecha,lat,lng,presencial,vmo_id'))
const enviado = JSON.stringify(lotesVmo(lectura.visitas))
check('lo que se manda no lleva el médico, su cédula ni su teléfono', !enviado.includes('Paciente') && !enviado.includes('1234567890') && !enviado.includes('3001234567'))

console.log('\n3. Lotes: cada uno con TODOS los Ejecutivos Comerciales del archivo y su última visita del archivo')
const visitasLote: VisitaVmo[] = [
  { vmo_id: 1, comercial: 'Ana Uno', fecha: '2026-10-20', lat: 4.6, lng: -74.1, presencial: true, extra: false },
  { vmo_id: 2, comercial: 'Beto Dos', fecha: '2026-01-10', lat: 4.6, lng: -74.1, presencial: true, extra: false },
  { vmo_id: 3, comercial: 'ana  uno', fecha: '2026-03-01', lat: 4.6, lng: -74.1, presencial: true, extra: false },
]
const lotes = lotesVmo(visitasLote, 2)
check('2 lotes de 2 y 1', lotes.length === 2 && lotes[0].visitas.length === 2 && lotes[1].visitas.length === 1)
check('el segundo lote trae a los 2 del archivo, Ana con su última visita del archivo (20 oct) y no la del lote (1 mar)',
  lotes[1].comerciales.length === 2 && lotes[1].comerciales[0].nombre === 'Ana Uno' && lotes[1].comerciales[0].ultima === '2026-10-20' &&
    JSON.stringify(lotes[0].comerciales) === JSON.stringify(lotes[1].comerciales), lotes[1].comerciales)
check('comercialesDe agrupa por llave', JSON.stringify(comercialesDe(visitasLote)) === JSON.stringify([{ nombre: 'Ana Uno', ultima: '2026-10-20' }, { nombre: 'Beto Dos', ultima: '2026-01-10' }]))

console.log('\n4. Emparejar con las personas de OpMap')
const personas: PersonaVmo[] = [
  { id: 'joana', full_name: 'Joana Andrea Gálvez Ortiz', status: 'active', vmo_nombre: null },
  { id: 'mileydis', full_name: 'Mileydis Amparo Buelvas Castellar', status: 'active', vmo_nombre: null },
  { id: 'leyda', full_name: 'Leyda Santiago Salcedo', status: 'active', vmo_nombre: 'leyda santiago salcedo' },
  { id: 'diana-c', full_name: 'Diana Carolina Caicedo Ramírez', status: 'active', vmo_nombre: null },
  { id: 'diana-g', full_name: 'Diana Cecilia Guerrero Bastidas', status: 'active', vmo_nombre: null },
  { id: 'linda', full_name: 'Linda Ossa', status: 'placeholder', vmo_nombre: null },
  { id: 'maria-1', full_name: 'María López Pérez', status: 'active', vmo_nombre: null },
  { id: 'maria-2', full_name: 'María López Gómez', status: 'inactive', vmo_nombre: null },
]
const par = (nombre: string) => emparejarComerciales([claveComercial(nombre)], personas).get(claveComercial(nombre)) ?? null
check('por la llave guardada', JSON.stringify(par('Leyda Santiago Salcedo')) === JSON.stringify({ id: 'leyda', como: 'llave' }))
check('por el nombre sin tildes (VMO: "Joana Andrea Galvez Ortiz")', JSON.stringify(par('Joana Andrea Galvez Ortiz')) === JSON.stringify({ id: 'joana', como: 'nombre' }))
check('parecido: VMO omite el segundo nombre ("Mileydis Buelvas Castellar")', JSON.stringify(par('Mileydis Buelvas Castellar')) === JSON.stringify({ id: 'mileydis', como: 'parecido' }))
check('parecido con dos palabras que solo una persona tiene ("Diana Caicedo")', par('Diana Caicedo')?.id === 'diana-c')
check('una sola palabra no basta ("Diana")', par('Diana') === null)
check('ambiguo ("María López"): no se adivina', par('María López') === null)
check('una vacante no se empareja ("Linda Ossa")', par('Linda Ossa') === null)
check('quien ya tiene otra llave no se empareja por parecido ("Leyda Santiago")', par('Leyda Santiago') === null)
check('quien no está en OpMap: null (se crea)', par('Katherinne Solano Escamilla') === null)
// Hallazgo del revisor: "Juan Perez" (lote 1) se llevaba por parecido a "Juan Pérez Gómez" de OpMap y "Juan Perez Gomez"
// (lote 5) se creaba duplicado. Con todo el archivo de una vez, en cualquier orden, gana el nombre exacto.
const juanes: PersonaVmo[] = [{ id: 'juan', full_name: 'Juan Pérez Gómez', status: 'active', vmo_nombre: null }]
for (const orden of [['juan perez', 'juan perez gomez'], ['juan perez gomez', 'juan perez']]) {
  const plan = emparejarComerciales(orden, juanes)
  check(`sin depender del orden (${orden.join(' → ')}): el exacto se queda con la persona y el otro se crea`,
    plan.get('juan perez gomez')?.id === 'juan' && plan.get('juan perez gomez')?.como === 'nombre' && plan.get('juan perez') === null)
}
const disputa = emparejarComerciales(['diana caicedo', 'diana carolina caicedo'], personas)
check('dos nombres del archivo parecidos a la misma persona: no se adivina ninguno', disputa.get('diana caicedo') === null && disputa.get('diana carolina caicedo') === null)
check('activa si visitó en los últimos 60 días; si no, inactiva',
  estadoComercialNuevo('2026-10-22', '2026-10-29') === 'active' && estadoComercialNuevo('2026-08-30', '2026-10-29') === 'active' &&
  estadoComercialNuevo('2026-08-29', '2026-10-29') === 'inactive')

console.log('\n5. Validación del lote en el servidor')
const loteBueno = { visitas: [{ vmo_id: 9, comercial: 'Ana Uno', fecha: '2026-10-20', lat: 4.6, lng: -74.1, presencial: true, extra: false }], comerciales: [{ nombre: 'Ana Uno', ultima: '2026-10-20' }] }
check('lote bueno', validarLoteVmo(loteBueno).ok)
const simulacion = validarLoteVmo({ simular: true, comerciales: loteBueno.comerciales })
check('simulación: solo los Ejecutivos Comerciales, sin visitas', simulacion.ok && simulacion.simular && simulacion.visitas.length === 0)
check('rechaza una simulación con visitas o sin Ejecutivos Comerciales',
  !validarLoteVmo({ simular: true, ...loteBueno }).ok && !validarLoteVmo({ simular: true, comerciales: [] }).ok)
const malo = (cambios: Record<string, unknown>, comerciales = loteBueno.comerciales) => validarLoteVmo({ visitas: [{ ...loteBueno.visitas[0], ...cambios }], comerciales })
check('rechaza: fecha que no es AAAA-MM-DD, punto fuera de Colombia, ID no entero, presencial o extra que no son sí/no',
  !malo({ fecha: '20/10/2026' }).ok && !malo({ lat: 40 }).ok && !malo({ vmo_id: 1.5 }).ok && !malo({ presencial: 'si' }).ok && !malo({ extra: undefined }).ok)
check('rechaza una visita de un Ejecutivo Comercial que no viene en el lote', !malo({ comercial: 'Otra Persona' }).ok)
check('rechaza IDs repetidos', !validarLoteVmo({ visitas: [loteBueno.visitas[0], loteBueno.visitas[0]], comerciales: loteBueno.comerciales }).ok)
check(`rechaza más de ${MAX_VISITAS_POR_LOTE} visitas`, !validarLoteVmo({
  visitas: Array.from({ length: MAX_VISITAS_POR_LOTE + 1 }, (_, i) => ({ ...loteBueno.visitas[0], vmo_id: i + 1 })), comerciales: loteBueno.comerciales,
}).ok)
check('rechaza el formato viejo (mes, año y visits)', !validarLoteVmo({ month: 10, year: 2026, visits: [{ kam_name: 'X' }] }).ok)

// ---------------------------------------------------------------------------
// Supabase FALSO: GET, POST (insert y upsert con on_conflict), PATCH; únicos de vmo_nombre y vmo_id
// ---------------------------------------------------------------------------
type Fila = Record<string, unknown>
const tablas: Record<string, Fila[]> = {}
const pedidos: { metodo: string; tabla: string; params: string }[] = []
let falloUpsert = false
let secuencia = 0
const json = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: { 'content-type': 'application/json' } })
const duplicado = (restriccion: string) => json({ code: '23505', message: `duplicate key value violates unique constraint "${restriccion}"`, details: null, hint: null }, 409)
const coincide = (fila: Fila, params: URLSearchParams) => Array.from(params.entries()).every(([clave, valor]) =>
  ['select', 'on_conflict', 'columns', 'order', 'limit', 'offset'].includes(clave) || (valor.startsWith('eq.') && String(fila[clave]) === valor.slice(3)))

globalThis.fetch = (async (entrada: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url)
  if (url.origin !== 'http://supabase.test') throw new Error(`vmo-visitas-check: intento de red a ${url.origin}`)
  const metodo = (init?.method ?? 'GET').toUpperCase()
  const tabla = url.pathname.replace('/rest/v1/', '')
  const filasTabla = (tablas[tabla] = tablas[tabla] ?? [])
  pedidos.push({ metodo, tabla, params: url.searchParams.toString() })
  const cuerpo = init?.body ? JSON.parse(String(init.body)) : undefined
  const objeto = (new Headers(init?.headers).get('accept') ?? '').includes('vnd.pgrst.object')
  if (metodo === 'GET') return json(filasTabla.filter(f => coincide(f, url.searchParams)))
  if (metodo === 'PATCH') {
    const cambiar = filasTabla.filter(f => coincide(f, url.searchParams))
    if (tabla === 'executives' && cuerpo.vmo_nombre && filasTabla.some(f => !cambiar.includes(f) && f.vmo_nombre === cuerpo.vmo_nombre)) return duplicado('executives_vmo_nombre_key')
    cambiar.forEach(f => Object.assign(f, cuerpo))
    return json(cambiar)
  }
  if (metodo === 'POST') {
    const nuevas = (Array.isArray(cuerpo) ? cuerpo : [cuerpo]) as Fila[]
    const conflicto = url.searchParams.get('on_conflict')
    if (conflicto) {
      if (falloUpsert) return json({ code: '57014', message: 'canceling statement due to statement timeout', details: null, hint: null }, 500)
      for (const nueva of nuevas) {
        const previa = filasTabla.find(f => f[conflicto] === nueva[conflicto])
        if (previa) Object.assign(previa, nueva)
        else filasTabla.push({ id: `fila-${++secuencia}`, ...nueva })
      }
      return new Response(null, { status: 201 })
    }
    if (tabla === 'executives' && nuevas.some(n => n.vmo_nombre && filasTabla.some(f => f.vmo_nombre === n.vmo_nombre))) return duplicado('executives_vmo_nombre_key')
    const insertadas = nuevas.map(n => ({ id: `fila-${++secuencia}`, base_kam_id: null, ...n }))
    filasTabla.push(...insertadas)
    return json(objeto ? insertadas[0] : insertadas, 201)
  }
  throw new Error(`vmo-visitas-check: método no soportado ${metodo} ${tabla}`)
}) as typeof fetch

async function main() {
  const { importarVisitasVmo } = await import('../app/api/visits/_lib/importar-vmo')
  const leer = async (respuesta: Response) => ({ status: respuesta.status, body: await respuesta.json() })

  console.log('\n6. Importador: enlaza o crea personas y guarda por ID de VMO')
  tablas.executives = [
    { id: 'ana', full_name: 'Ana María Ruiz', status: 'active', base_kam_id: 'zona-norte', vmo_nombre: null },
    { id: 'vacante', full_name: 'Vacante Neiva', status: 'placeholder', base_kam_id: 'zona-neiva', vmo_nombre: null },
  ]
  const appVisita = { id: 'app-1', source: 'app', executive_id: 'ana', visit_date: '2026-10-20', lat: 4.7, lng: -74.05, vmo_id: null }
  tablas.visits = [{ ...appVisita }]
  const lote = {
    visitas: [
      { vmo_id: 25101, comercial: 'Ana Ruiz', fecha: '2026-10-22', lat: 4.65, lng: -74.06, presencial: true, extra: false },
      { vmo_id: 25102, comercial: 'Ana Ruiz', fecha: '2026-10-23', lat: 4.66, lng: -74.07, presencial: false, extra: true },
      { vmo_id: 25103, comercial: 'Katherinne Solano Escamilla', fecha: '2026-10-24', lat: 8.75, lng: -75.88, presencial: true, extra: false },
      { vmo_id: 25104, comercial: 'Persona Que Se Fue', fecha: '2026-03-02', lat: 10.4, lng: -75.5, presencial: true, extra: false },
    ],
    comerciales: [
      { nombre: 'Ana Ruiz', ultima: '2026-10-23' },
      { nombre: 'Katherinne Solano Escamilla', ultima: '2026-10-24' },
      { nombre: 'Persona Que Se Fue', ultima: '2026-03-02' },
    ],
  }
  const plan = await leer(await importarVisitasVmo({ simular: true, comerciales: lote.comerciales }, 'admin-1', '2026-10-29'))
  check('simulación: a quién reconoce y a quién crea (con su estado), sin escribir nada',
    plan.status === 200 && JSON.stringify(plan.body.comerciales) === JSON.stringify([
      { vmo: 'Ana Ruiz', opmap: 'Ana María Ruiz', como: 'parecido', estado: null },
      { vmo: 'Katherinne Solano Escamilla', opmap: null, como: null, estado: 'active' },
      { vmo: 'Persona Que Se Fue', opmap: null, como: null, estado: 'inactive' },
    ]) && !pedidos.some(p => p.metodo !== 'GET'), plan.body)
  const primera = await leer(await importarVisitasVmo(lote, 'admin-1', '2026-10-29'))
  check('200: 4 visitas, Ana reconocida por parecido y 2 personas creadas', primera.status === 200 && primera.body.visitas === 4 &&
    JSON.stringify(primera.body.enlazados) === JSON.stringify([{ vmo: 'Ana Ruiz', opmap: 'Ana María Ruiz' }]) &&
    JSON.stringify(primera.body.creados) === JSON.stringify([{ nombre: 'Katherinne Solano Escamilla', estado: 'active' }, { nombre: 'Persona Que Se Fue', estado: 'inactive' }]), primera.body)
  const ejecutivas = tablas.executives
  check('Ana queda con su llave de VMO', ejecutivas.find(e => e.id === 'ana')?.vmo_nombre === 'ana ruiz')
  const katherinne = ejecutivas.find(e => e.vmo_nombre === 'katherinne solano escamilla')
  check('la persona nueva: nombre de VMO, activa, sin zona y con la nota de dónde salió',
    !!katherinne && katherinne.full_name === 'Katherinne Solano Escamilla' && katherinne.status === 'active' && katherinne.base_kam_id === null &&
    String(katherinne.notes).startsWith('Creada al importar visitas de VMO el 2026-10-29'), katherinne)
  check('quien no visita hace más de 60 días se crea inactivo', ejecutivas.find(e => e.vmo_nombre === 'persona que se fue')?.status === 'inactive')
  const vmo25101 = tablas.visits.find(v => v.vmo_id === 25101)
  check('la visita: por persona, con su zona y su nombre, efectiva, el punto y la fecha de VMO',
    !!vmo25101 && vmo25101.source === 'vmo_import' && vmo25101.executive_id === 'ana' && vmo25101.kam_id === 'zona-norte' && vmo25101.kam_name === 'Ana María Ruiz' &&
    vmo25101.visit_type === 'Visita efectiva' && vmo25101.contact_type === 'Visita presencial' && vmo25101.efectiva === true &&
    vmo25101.lat === 4.65 && vmo25101.visit_date === '2026-10-22' && vmo25101.imported_by === 'admin-1', vmo25101)
  check('la virtual queda como "Visita virtual" y la extra como "Visita extra"', tablas.visits.find(v => v.vmo_id === 25102)?.contact_type === 'Visita virtual' && tablas.visits.find(v => v.vmo_id === 25102)?.visit_type === 'Visita extra')
  check('la de la persona nueva queda a su nombre y sin zona', tablas.visits.find(v => v.vmo_id === 25103)?.executive_id === katherinne?.id && tablas.visits.find(v => v.vmo_id === 25103)?.kam_id === null)
  check('no borra nada', !pedidos.some(p => p.metodo === 'DELETE'))
  check('el upsert va por vmo_id', pedidos.some(p => p.metodo === 'POST' && p.tabla === 'visits' && p.params.includes('on_conflict=vmo_id')))

  console.log('\n7. Importar otra vez el mismo período: actualiza, no duplica')
  const otraVez = { ...lote, visitas: lote.visitas.map(v => (v.vmo_id === 25101 ? { ...v, lat: 4.651 } : v)) }
  const segunda = await leer(await importarVisitasVmo(otraVez, 'admin-1', '2026-10-29'))
  check('200: las 4 otra vez, sin enlazar ni crear a nadie (ya tienen llave)', segunda.status === 200 && segunda.body.visitas === 4 && segunda.body.enlazados.length === 0 && segunda.body.creados.length === 0, segunda.body)
  check('siguen 4 visitas de VMO (sin duplicar) y el punto se actualizó',
    tablas.visits.filter(v => v.source === 'vmo_import').length === 4 && tablas.visits.find(v => v.vmo_id === 25101)?.lat === 4.651)
  check('las 2 personas nuevas no se vuelven a crear (4 con Ana y la vacante)', tablas.executives.length === 4)
  check('la visita de la app, intacta', JSON.stringify(tablas.visits.find(v => v.id === 'app-1')) === JSON.stringify(appVisita))

  console.log('\n8. Errores')
  const antes = JSON.stringify(tablas)
  const invalido = await leer(await importarVisitasVmo({ visitas: [{ vmo_id: 'x' }], comerciales: [] }, 'admin-1', '2026-10-29'))
  check('lote inválido: 400 y no escribe nada', invalido.status === 400 && typeof invalido.body.error === 'string' && JSON.stringify(tablas) === antes, invalido.body)
  falloUpsert = true
  const caido = await leer(await importarVisitasVmo(lote, 'admin-1', '2026-10-29'))
  falloUpsert = false
  check('si guardar las visitas falla: 500 con mensaje claro', caido.status === 500 && caido.body.error === 'No se pudieron guardar las visitas', caido.body)

  console.log(`\nResultado: ${passed} OK, ${failed} con fallo`)
  if (failed > 0) process.exit(1)
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
