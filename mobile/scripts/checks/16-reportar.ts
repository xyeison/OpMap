/**
 * Sección 16 de scripts/movil-check.ts (spec 2026-10-15-usabilidad-y-agenda-con-hora, paquete 2):
 * modo resumen de la tarjeta, pie "Confirmar visita i de N", orden de médicos, buscador,
 * planCargaReportar, cita desde Hoy y marcas de tiempo.
 *
 * Corren en Node, sin React Native ni red (las que revisan una pantalla leen su archivo y miran cada cosa dentro de su
 * bloque: la función o el JSX que la contiene; si un marcador no está, el bloque queda vacío y la prueba falla). Este
 * solo, desde mobile/:
 *   npx tsx scripts/checks/correr.ts 16-reportar
 */
import { puedeAgendarProxima } from '../../lib/agenda'
import { ESPERA_BUSQUEDA_MS, debeBuscarAlEscribir, filtrarOpciones, ofertaBuscarFuera } from '../../lib/busqueda'
import { FRESCURA_PINTAR_MS, FRESCURA_SIN_PEDIR_MS } from '../../lib/contexto-memoria'
import { CERCA_DE_AQUI_M, nombreParaOrdenar, ordenarMedicos } from '../../lib/orden-medicos'
import {
  borradorDesdeCita,
  borradoresDesdePropuesta,
  cambiarBorrador,
  catalogoDesdeContexto,
  validarBorrador,
  type Borrador,
  type MedicoOpcion,
} from '../../lib/propuesta'
import { fijarCitaParaReportar, tomarCitaParaReportar } from '../../lib/retorno'
import { CONFIANZA_MINIMA_RESUMEN, filasResumen, modoTarjeta, pedidoAgendarDe, textoPieConfirmar } from '../../lib/tarjeta-resumen'
import type { MarcaReporte } from '../../lib/tiempos'
import type { CitaItem, ContextoResponse, VisitaPropuesta } from '../../lib/tipos'
import { DISTANCIA_RECARGA_M, pasoDelReporte, planCargaReportar } from '../../lib/ubicacion-pasos'
import type { Probador } from './probador'

// Corre en Node (tsx) con el programa de tipos de la app (sin @types/node): fs y path con lo mínimo que se usa.
interface FsMinimo {
  existsSync(ruta: string): boolean
  readFileSync(ruta: string, codificacion: 'utf8'): string
}
interface PathMinimo {
  resolve(...partes: string[]): string
  join(...partes: string[]): string
}
declare const __dirname: string
const { existsSync, readFileSync } = require('fs') as FsMinimo
const path = require('path') as PathMinimo

const RAIZ = path.resolve(__dirname, '../..')
const leer = (relativa: string) => readFileSync(path.join(RAIZ, relativa), 'utf8')

/** El texto entre `desde` y el siguiente `hasta` (sin incluirlo). '' si falta alguno: la prueba que lo usa falla. */
function entre(texto: string, desde: string, hasta: string): string {
  const i = texto.indexOf(desde)
  const j = i > -1 ? texto.indexOf(hasta, i + desde.length) : -1
  return i > -1 && j > -1 ? texto.slice(i, j) : ''
}

/** Las 9 marcas de tiempo que deja Reportar (spec 2026-10-15, "Medición"). */
const MARCAS: readonly MarcaReporte[] = [
  'toque_hablar',
  'grabando',
  'fin_grabacion',
  'transcripcion',
  'propuesta',
  'primer_toque_tarjeta',
  'toque_confirmar',
  'visita_guardada',
  'lista_pintada',
]

export async function pruebas(t: Probador): Promise<void> {
  t.seccion('16. Reportar y tarjeta')
  const { check } = t

  // Teléfono en Bucaramanga; Clínica Norte a 35 m, Clínica Sur a 820 m, Consultorio Gómez sin coordenadas.
  const TEL = { lat: 7.119, lng: -73.1227 }
  const norte = (m: number) => ({ lat: Math.round((TEL.lat + m / 111_195) * 1e6) / 1e6, lng: TEL.lng })
  const S_NORTE = 'aaaaaaaa-0000-4000-8000-0000000016a1'
  const S_SUR = 'aaaaaaaa-0000-4000-8000-0000000016a2'
  const S_CONS = 'aaaaaaaa-0000-4000-8000-0000000016a3'
  const C_NORTE = 'cccccccc-0000-4000-8000-0000000016c1'
  const C_SUR = 'cccccccc-0000-4000-8000-0000000016c2'
  const M_GOMEZ = 'dddddddd-0000-4000-8000-0000000016d1'
  const M_ARIAS = 'dddddddd-0000-4000-8000-0000000016d2'
  const M_BETANCUR = 'dddddddd-0000-4000-8000-0000000016d3'
  const M_ZAPATA = 'dddddddd-0000-4000-8000-0000000016d4'
  const L1 = 'eeeeeeee-0000-4000-8000-0000000016e1'
  const L2 = 'eeeeeeee-0000-4000-8000-0000000016e2'
  const HOY = '2026-10-15'
  const ahora = new Date('2026-10-15T15:00:00.000Z') // 10:00 en Bogotá
  const llegada = '2026-10-15T09:55:00.000-05:00'
  const contexto: ContextoResponse = {
    ejecutiva: { id: 'e-16', nombre: 'Ana (prueba)', zona: 'Bucaramanga', municipio: '68001', lineas: [{ id: L1, code: 'osteo', name: 'Osteosíntesis' }, { id: L2, code: 'col', name: 'Columna' }] },
    hoy: { fecha: HOY, meta: { medica: 6, institucional: 1 }, hechas: { medicas: 0, institucionales: 0, telefonicas: 0, no_efectivas: 0 }, cuota_dia_ok: false },
    config: { radio_m: 500, telefonica: { habilitada: true, tope_dia: 2, medios: ['llamada', 'videollamada'] }, tope_visitas_medico_dia: 1, perfil: ['medica', 'institucional'] },
    sedes_cerca: [
      { id: S_NORTE, nombre: 'Clínica Norte', cuenta_id: C_NORTE, cuenta_nombre: 'Clínica Norte S.A.', cuenta_clase: 'clinica', ciudad: 'Bucaramanga', ...norte(35), distancia_m: 35, hospital_id: null, ubicacion_confirmada: true },
      { id: S_SUR, nombre: 'Clínica Sur', cuenta_id: C_SUR, cuenta_nombre: 'Clínica Sur', cuenta_clase: 'clinica', ciudad: 'Bucaramanga', ...norte(820), distancia_m: 820, hospital_id: null, ubicacion_confirmada: true },
    ],
    mis_medicos: [
      // Zapata atiende en la Norte; Arias a 820 m (cerca de aquí); Betancur y Gómez sin distancia conocida cerca.
      { id: M_ZAPATA, nombre: 'Dr. Zapata (prueba)', especialidades: ['ortopedia'], municipality_id: '68001', lineas: [L1], sedes: [{ id: S_NORTE, nombre: 'Clínica Norte', cuenta_nombre: 'Clínica Norte S.A.', distancia_m: 35 }] },
      { id: M_ARIAS, nombre: 'Dra. Arias (prueba)', especialidades: ['ortopedia'], municipality_id: '68001', lineas: [L1], sedes: [{ id: S_SUR, nombre: 'Clínica Sur', cuenta_nombre: 'Clínica Sur', distancia_m: 820 }] },
      { id: M_GOMEZ, nombre: 'Dra. Gómez (prueba)', especialidades: ['ortopedia'], municipality_id: '68001', lineas: [L1], sedes: [{ id: S_NORTE, nombre: 'Clínica Norte', cuenta_nombre: 'Clínica Norte S.A.', distancia_m: 35 }, { id: S_CONS, nombre: 'Consultorio Gómez', cuenta_nombre: 'Consultorio', distancia_m: null }] },
      { id: M_BETANCUR, nombre: 'Dr. Betancur (prueba)', especialidades: [], municipality_id: '68001', lineas: [], sedes: [{ id: S_CONS, nombre: 'Consultorio Gómez', cuenta_nombre: 'Consultorio', distancia_m: 4200 }] },
    ],
    contactos: [],
    subtipos: [],
    compromisos_vencidos: [],
    voz: { transcribir: true, proponer: true },
    agenda_hoy: [],
  }
  const catalogo = catalogoDesdeContexto(contexto, {}, TEL)
  let n = 0
  const nuevoId = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`
  const propuesta = (extra: Partial<VisitaPropuesta> = {}): VisitaPropuesta => ({
    tipo: 'medica',
    subtipo_codigo: null,
    subtipo_id: null,
    medico_id: M_GOMEZ,
    medico_nombre_dicho: null,
    sugerir_crear_medico: false,
    cuenta_id: null,
    sede_id: S_NORTE,
    contacto_id: null,
    contacto_nombre_dicho: null,
    lineas: [L1, L2],
    efectiva: true,
    failure_reason: null,
    conclusion: 'Le gustó el tornillo canulado. Pidió la ficha técnica.',
    compromisos: 'Enviar la ficha técnica',
    next_step_date: '2026-10-22',
    modalidad_sugerida: 'presencial',
    confianza: 0.8,
    preguntas: [],
    ...extra,
  })
  const deVoz = (extra: Partial<VisitaPropuesta> = {}): Borrador => borradoresDesdePropuesta({ aviso: null, visitas: [propuesta(extra)] }, catalogo, { nuevoId, hoy: HOY })[0]
  const entrada = (extra: Partial<Parameters<typeof modoTarjeta>[2]> = {}) => ({ punto: TEL, checked_in_at: llegada, ahora, visitasHoy: [], ...extra })

  // --- modoTarjeta ---------------------------------------------------------------------------------------------
  const buena = deVoz()
  check('tarjeta de voz: la de prueba pasa validarBorrador (la misma validación de Confirmar)', validarBorrador(buena, catalogo, entrada()).ok, validarBorrador(buena, catalogo, entrada()).errores)
  const enResumen = modoTarjeta(buena, catalogo, entrada())
  check('modoTarjeta: voz válida, confianza 0,8, sin preguntas y dentro del radio → resumen, sin nada que revisar', enResumen.modo === 'resumen' && enResumen.atencion.length === 0, enResumen)
  check('modoTarjeta: el umbral de confianza es 0,6', CONFIANZA_MINIMA_RESUMEN === 0.6 && modoTarjeta(deVoz({ confianza: 0.6 }), catalogo, entrada()).modo === 'resumen')
  const dudosa = modoTarjeta(deVoz({ confianza: 0.5 }), catalogo, entrada())
  check('modoTarjeta: confianza 0,5 → completa y atencion nombra "confianza"', dudosa.modo === 'completa' && dudosa.atencion.some(a => a.campo === 'confianza'), dudosa)
  const conPregunta = modoTarjeta(deVoz({ preguntas: ['¿Era la Dra. Gómez de columna?'] }), catalogo, entrada())
  check(
    'modoTarjeta: con una pregunta de la IA → completa y atencion la nombra ("preguntas", con su texto)',
    conPregunta.modo === 'completa' && conPregunta.atencion.some(a => a.campo === 'preguntas' && a.motivo === '¿Era la Dra. Gómez de columna?'),
    conPregunta
  )
  const lejos = modoTarjeta(buena, catalogo, entrada({ punto: norte(-700) }))
  check(
    'modoTarjeta: fuera del radio → completa y atencion nombra el campo de la distancia ("lat", con el mensaje del radio)',
    lejos.modo === 'completa' && lejos.atencion.some(a => a.campo === 'lat' && /el radio es 500 m/.test(a.motivo)),
    lejos
  )
  const sinMedico = deVoz({ medico_id: null, medico_nombre_dicho: 'Dr. Ramírez', sugerir_crear_medico: true })
  const sinCruce = modoTarjeta(sinMedico, catalogo, entrada())
  check('modoTarjeta: médico no cruzado → completa y atencion nombra "medico_id"', sinCruce.modo === 'completa' && sinCruce.atencion.some(a => a.campo === 'medico_id'), sinCruce)
  const toques = cambiarBorrador({ ...buena, origen: 'toques' }, {}, catalogo)
  check(
    'modoTarjeta: la de toques → siempre completa (aunque esté lista para confirmar y no tenga nada dudoso)',
    validarBorrador(toques, catalogo, entrada()).ok && modoTarjeta(toques, catalogo, entrada()).modo === 'completa'
  )
  const telefonica = cambiarBorrador(buena, { modalidad: 'telefonica' }, catalogo)
  check('modoTarjeta: telefónica válida → resumen', modoTarjeta(telefonica, catalogo, entrada({ punto: null })).modo === 'resumen')
  // Un médico traído del buscador con una sede que no está cerca: la distancia no se sabe (la decide el servidor) y la
  // tarjeta pasa validarBorrador, pero no es "dentro del radio": abre completa.
  const S_LEJANA = 'aaaaaaaa-0000-4000-8000-0000000016a9'
  const M_TRAIDO = 'dddddddd-0000-4000-8000-0000000016d9'
  const conTraido = catalogoDesdeContexto(contexto, { medicos: [{ id: M_TRAIDO, nombre: 'Dr. Traído (prueba)', especialidades: [], lineas: [], propio: false, sedes: [{ id: S_LEJANA, nombre: 'Clínica lejana', cuenta_nombre: null, distancia_m: null, coordenadas_desconocidas: true }] }] }, TEL)
  const traido = cambiarBorrador(buena, { medico_id: M_TRAIDO, sede_id: S_LEJANA }, conTraido)
  const desconocida = modoTarjeta(traido, conTraido, entrada())
  check(
    'modoTarjeta: presencial con la distancia sin saber (la decide el servidor) → completa, aunque pase la validación',
    traido.sede_id === S_LEJANA && validarBorrador(traido, conTraido, entrada()).ok && desconocida.modo === 'completa' && desconocida.atencion.some(a => a.campo === 'sede_id'),
    desconocida
  )

  // --- filasResumen --------------------------------------------------------------------------------------------
  const filas = filasResumen(buena, catalogo, { punto: TEL, ahora })
  check(
    'filasResumen: en orden con quién, sede, resultado, líneas, conclusión, compromisos y próxima reunión',
    filas.map(f => f.campo).join() === 'con_quien,sede,resultado,lineas,conclusion,compromisos,proxima',
    filas.map(f => f.campo)
  )
  const valor = (campo: string) => filas.find(f => f.campo === campo)?.valor
  check('filasResumen: con quién es el médico', valor('con_quien') === 'Dra. Gómez (prueba)', valor('con_quien'))
  check('filasResumen: "Clínica Norte · Presencial a 35 m (dentro del radio)"', valor('sede') === 'Clínica Norte · Presencial a 35 m (dentro del radio)', valor('sede'))
  check('filasResumen: resultado, líneas y compromisos en palabras', valor('resultado') === 'Efectiva' && valor('lineas') === 'Osteosíntesis, Columna' && valor('compromisos') === 'Enviar la ficha técnica', filas)
  check('filasResumen: la conclusión va en 3 líneas como mucho', filas.find(f => f.campo === 'conclusion')?.lineas === 3)
  check('filasResumen: próxima reunión en palabras ("jueves 22 de octubre")', valor('proxima') === 'jueves 22 de octubre', valor('proxima'))
  const vacia = filasResumen({ ...buena, compromisos: '', next_step_date: '', conclusion: '', lineas: [] }, catalogo, { punto: TEL, ahora })
  check(
    'filasResumen: una fila vacía no aparece, salvo la conclusión',
    vacia.map(f => f.campo).join() === 'con_quien,sede,resultado,conclusion' && vacia.find(f => f.campo === 'conclusion')?.valor === 'Sin conclusión',
    vacia.map(f => [f.campo, f.valor])
  )
  check('filasResumen: la no efectiva lleva su motivo', filasResumen(cambiarBorrador(buena, { efectiva: false, failure_reason: 'No estaba' }, catalogo), catalogo, { punto: TEL, ahora }).find(f => f.campo === 'resultado')?.valor === 'No efectiva: No estaba')
  check('filasResumen: la telefónica dice el medio', filasResumen(telefonica, catalogo, { punto: null, ahora }).find(f => f.campo === 'sede')?.valor === 'Clínica Norte · Telefónica (llamada)')

  // --- Pie fijo: "Confirmar visita 1 de N" -------------------------------------------------------------------------
  check("textoPieConfirmar(1, 2) === 'Confirmar visita 1 de 2'", textoPieConfirmar(1, 2) === 'Confirmar visita 1 de 2')
  check("textoPieConfirmar(1, 1) === 'Confirmar esta visita'", textoPieConfirmar(1, 1) === 'Confirmar esta visita')
  const reportar = leer('app/(app)/reportar.tsx')
  const tarjetaTs = leer('components/reporte/TarjetaBorrador.tsx')
  const pieTs = entre(tarjetaTs, 'export function PieConfirmar(', '\n}\n')
  check('TarjetaBorrador: PieConfirmar es el botón con textoPieConfirmar', /<Boton titulo=\{textoPieConfirmar\(numero, total\)\}[^>]*alPresionar=\{alConfirmar\}/.test(pieTs))
  check(
    'TarjetaBorrador: la tarjeta con el Confirmar en el pie no lo repite; las demás llevan el suyo con el mismo texto',
    /\{props\.confirmarEnPie \? null : \(\s*<Boton titulo=\{textoPieConfirmar\(props\.numero, props\.total\)\}/.test(tarjetaTs) && !/titulo="Confirmar esta visita"/.test(tarjetaTs)
  )
  const pieReportar = entre(reportar, 'const pie = primeraAbierta ? (', ') : undefined')
  check(
    'Reportar: Pantalla.pie lleva "Confirmar visita i de N" de la primera tarjeta abierta (con su propio toque: confirmarTarjeta de esa clave)',
    /<Pantalla pie=\{pie\}>/.test(reportar) &&
      /<PieConfirmar numero=\{yaConfirmadas \+ 1\} total=\{totalVisitas\}[^>]*alConfirmar=\{\(\) => void confirmarTarjeta\(primeraAbierta\.clave\)\}/.test(pieReportar) &&
      /const primeraAbierta = fase === 'tarjetas' \? \(borradores\[0\] \?\? null\) : null/.test(reportar) &&
      /confirmarEnPie=\{indice === 0\}/.test(reportar)
  )

  // --- Tarjeta de una cita: sin "Tipo de visita" ------------------------------------------------------------------
  const bloqueTipoTs = entre(tarjetaTs, 'const bloqueTipo = (', '\n  )\n')
  check(
    'TarjetaBorrador: "Tipo de visita" va en bloqueTipo y solo se pinta sin cita (agenda_id)',
    bloqueTipoTs.includes('Tipo de visita') && /\{!borrador\.agenda_id \? bloqueTipo : null\}/.test(tarjetaTs) && (tarjetaTs.match(/Tipo de visita<\/Texto>/g) ?? []).length === 1
  )
  const cita: CitaItem = {
    id: '11111111-0000-4000-8000-0000000016f1',
    fecha: HOY,
    hora: '10:00',
    tipo: 'medica',
    medico: { id: M_GOMEZ, nombre: 'Dra. Gómez (prueba)' },
    cuenta: null,
    subtipo: null,
    sede: { id: S_NORTE, nombre: 'Clínica Norte', cuenta_id: C_NORTE, cuenta_nombre: 'Clínica Norte S.A.', ...norte(35), ubicacion_confirmada: true },
    nota: null,
    estado: 'pendiente',
    visita_id: null,
    distancia_m: 35,
    dentro_del_radio: true,
    anticipada: true,
    cancelable: true,
  }
  check('la tarjeta que viene de una cita lleva su agenda_id (y por eso no muestra "Tipo de visita")', borradorDesdeCita(cita, catalogo, { nuevoId }).agenda_id === cita.id)

  // --- ordenarMedicos ------------------------------------------------------------------------------------------
  const grupos = ordenarMedicos(catalogo.medicos, S_NORTE, TEL)
  check(
    'ordenarMedicos: "Atienden en Clínica Norte", luego "Cerca de aquí" y luego el resto',
    grupos.map(g => g.titulo).join(' | ') === 'Atienden en Clínica Norte | Cerca de aquí | Otros médicos',
    grupos.map(g => g.titulo)
  )
  check(
    'ordenarMedicos: dentro de cada grupo, la sede por nombre, cerca por distancia y el resto por nombre',
    grupos[0].medicos.map(m => m.id).join() === [M_GOMEZ, M_ZAPATA].join() && grupos[1].medicos.map(m => m.id).join() === M_ARIAS && grupos[2].medicos.map(m => m.id).join() === M_BETANCUR,
    grupos.map(g => g.medicos.map(m => m.nombre))
  )
  check(
    'ordenarMedicos: por nombre sin el título ("Dra. Gómez" antes que "Dr. Zapata")',
    nombreParaOrdenar('Dra. Ana Gómez') === 'Ana Gómez' && nombreParaOrdenar('dr Luis Pérez') === 'Luis Pérez' && nombreParaOrdenar('Drago Ruiz') === 'Drago Ruiz'
  )
  const todos = grupos.flatMap(g => g.medicos.map(m => m.id))
  check('ordenarMedicos: las cantidades no cambian y no hay repetidos', todos.length === catalogo.medicos.length && new Set(todos).size === todos.length, todos)
  const cercanos: MedicoOpcion[] = [
    { id: 'm-a', nombre: 'Andrade', especialidades: [], lineas: [], propio: true, sedes: [{ id: 'x1', nombre: 'X1', cuenta_nombre: null, distancia_m: 900 }] },
    { id: 'm-b', nombre: 'Borja', especialidades: [], lineas: [], propio: true, sedes: [{ id: 'x2', nombre: 'X2', cuenta_nombre: null, distancia_m: 120 }, { id: 'x3', nombre: 'X3', cuenta_nombre: null, distancia_m: 5000 }] },
    { id: 'm-c', nombre: 'Cano', especialidades: [], lineas: [], propio: true, sedes: [{ id: 'x4', nombre: 'X4', cuenta_nombre: null, distancia_m: CERCA_DE_AQUI_M + 1 }] },
  ]
  const porCercania = ordenarMedicos(cercanos, null, TEL)
  check(
    'ordenarMedicos: "Cerca de aquí" por la sede más cercana (Borja a 120 m antes que Andrade a 900 m); a más de 1 km va al resto',
    porCercania.length === 2 && porCercania[0].medicos.map(m => m.id).join() === 'm-b,m-a' && porCercania[1].medicos.map(m => m.id).join() === 'm-c',
    porCercania.map(g => [g.titulo, g.medicos.map(m => m.id)])
  )
  const sinPunto = ordenarMedicos(cercanos, null, null)
  check('ordenarMedicos: sin ubicación no hay "Cerca de aquí" (todo por nombre)', sinPunto.length === 1 && sinPunto[0].medicos.map(m => m.id).join() === 'm-a,m-b,m-c', sinPunto)
  const opcionesTs = entre(tarjetaTs, 'const opcionesMedico = ordenarMedicos(', 'const selectorMedico = ')
  check(
    'TarjetaBorrador: el Selector de médicos sale de ordenarMedicos con la sede de la tarjeta o la elegida en el paso 1, con el grupo de cada uno',
    /ordenarMedicos\(catalogo\.medicos, borrador\.sede_id \?\? props\.sedeElegida \?\? null, punto\)/.test(tarjetaTs) && /grupo: grupo\.titulo/.test(opcionesTs) && /opciones=\{opcionesMedico\}/.test(tarjetaTs)
  )
  check('Reportar: le pasa a la tarjeta la sede elegida (o la de la cita) para ordenar los médicos', /sedeElegida=\{sedeElegida \?\? cita\?\.sede\.id \?\? null\}/.test(reportar))

  // --- Un solo buscador ---------------------------------------------------------------------------------------
  check('busqueda: ESPERA_BUSQUEDA_MS = 400', ESPERA_BUSQUEDA_MS === 400)
  check(
    'debeBuscarAlEscribir: desde 3 letras sin contar espacios',
    !debeBuscarAlEscribir('') && !debeBuscarAlEscribir('ab') && !debeBuscarAlEscribir('  a b  ') && debeBuscarAlEscribir('abc') && debeBuscarAlEscribir('a b c') && debeBuscarAlEscribir('Ramírez')
  )
  check(
    'ofertaBuscarFuera: sin coincidencias propias ofrece "Buscar en OpMap" con el MISMO texto, destacado',
    JSON.stringify(ofertaBuscarFuera(' Ramírez ', 0)) === JSON.stringify({ texto: 'Buscar "Ramírez" en OpMap', destacada: true })
  )
  check('ofertaBuscarFuera: con coincidencias, se ofrece sin destacar; sin texto, nada', ofertaBuscarFuera('Gómez', 2)?.destacada === false && ofertaBuscarFuera('  ', 0) === null)
  check(
    'filtrarOpciones: todas las palabras, sin tildes ni mayúsculas (el filtro de la lista propia)',
    filtrarOpciones([{ titulo: 'Dra. Gómez' }, { titulo: 'Dr. Zapata', detalle: 'Ortopedia' }], 'gomez').length === 1 &&
      filtrarOpciones([{ titulo: 'Dr. Zapata', detalle: 'Ortopedia' }], 'zapata ortopedia').length === 1 &&
      filtrarOpciones([{ titulo: 'Dr. Zapata' }], 'ramirez').length === 0
  )
  const selectorTs = leer('components/reporte/Selector.tsx')
  check(
    'Selector: filtra con filtrarOpciones y, con buscarFuera, ofrece ofertaBuscarFuera y pinta los resultados con el mismo filtro',
    /filtrarOpciones\(opciones, filtro\)/.test(selectorTs) &&
      /ofertaBuscarFuera\(filtro, visibles\.length, buscarFuera\.donde\)/.test(selectorTs) &&
      /buscarFuera\.resultados\(filtro, cerrar\)/.test(selectorTs) &&
      /const conBuscador = opciones\.length > 7 \|\| !!buscarFuera/.test(selectorTs)
  )
  const selectorMedicoTs = entre(tarjetaTs, 'const selectorMedico = (abrir: boolean) => (', 'const selectorSedeMedico = ')
  check(
    'TarjetaBorrador: un solo buscador de médicos (buscarFuera con un Buscador sin campo propio: consulta = lo escrito en la lista)',
    /buscarFuera=\{\{\s*donde: 'OpMap',/.test(selectorMedicoTs) &&
      /<Buscador<MedicoPublico>[\s\S]*consulta=\{consulta\}[\s\S]*api\.buscarMedicos\(q\)/.test(selectorMedicoTs) &&
      (tarjetaTs.match(/<Buscador<MedicoPublico>/g) ?? []).length === 1 &&
      !/Buscar otro médico en OpMap/.test(tarjetaTs)
  )
  const buscadorTs = leer('components/reporte/Buscador.tsx')
  const ejecutarTs = entre(buscadorTs, 'const ejecutar = async (texto: string) => {', '\n  }\n')
  check(
    'Buscador: cada búsqueda cancela la anterior (AbortController) y no pinta lo que llega de una cancelada',
    /cancelar\(\)\s*const propia = new AbortController\(\)/.test(ejecutarTs) &&
      /control\.current\?\.abort\(\)/.test(buscadorTs) &&
      /llamada\.current\(texto, propia\.signal\)/.test(ejecutarTs) &&
      /if \(propia\.signal\.aborted\) return\s*setResultados\(encontrados\)/.test(ejecutarTs)
  )
  const alEscribirTs = entre(buscadorTs, '// Busca solo al escribir', '// Al cerrarse')
  check(
    'Buscador: busca al escribir con debeBuscarAlEscribir y ESPERA_BUSQUEDA_MS (sin botón "Buscar")',
    /if \(!debeBuscarAlEscribir\(texto\)\)/.test(alEscribirTs) && /setTimeout\([\s\S]*ejecutar\(texto\)[\s\S]*ESPERA_BUSQUEDA_MS\)/.test(alEscribirTs) && !/titulo="Buscar"/.test(buscadorTs)
  )
  const filasBuscadorTs = entre(buscadorTs, '{(resultados ?? []).map(item => {', '{pie}')
  check(
    'Buscador: la fila entera del resultado es tocable (Tarjeta con alPresionar), sin un botón "Elegir" dentro',
    /<Tarjeta key=\{clave\(item\)\}[^>]*alPresionar=\{\(\) => alElegir\(item\)\}/.test(filasBuscadorTs) && !/<Boton/.test(filasBuscadorTs)
  )

  // --- planCargaReportar ---------------------------------------------------------------------------------------
  const T0 = 1_760_000_000_000
  const memoria = (msAtras: number, punto: { lat: number; lng: number } | null = TEL) => ({ punto, recibidoEn: T0 - msAtras })
  check('planCargaReportar: con menos de 60 s y menos de 100 m → usar (sin pedir)', planCargaReportar({ enMemoria: memoria(30_000), primera: norte(40), ahora: T0 }) === 'usar')
  check(
    'planCargaReportar: entre 60 s y 3 min → pintar_y_refrescar',
    planCargaReportar({ enMemoria: memoria(FRESCURA_SIN_PEDIR_MS), primera: TEL, ahora: T0 }) === 'pintar_y_refrescar' &&
      planCargaReportar({ enMemoria: memoria(FRESCURA_PINTAR_MS - 1), primera: TEL, ahora: T0 }) === 'pintar_y_refrescar'
  )
  check(
    'planCargaReportar: sin memoria, de 3 min o más, de otro sitio (100 m o más), sin la primera o pedido sin punto → pedir',
    planCargaReportar({ enMemoria: null, primera: TEL, ahora: T0 }) === 'pedir' &&
      planCargaReportar({ enMemoria: memoria(FRESCURA_PINTAR_MS), primera: TEL, ahora: T0 }) === 'pedir' &&
      planCargaReportar({ enMemoria: memoria(10_000), primera: norte(DISTANCIA_RECARGA_M + 5), ahora: T0 }) === 'pedir' &&
      planCargaReportar({ enMemoria: memoria(10_000), primera: null, ahora: T0 }) === 'pedir' &&
      planCargaReportar({ enMemoria: memoria(10_000, null), primera: TEL, ahora: T0 }) === 'pedir' &&
      planCargaReportar({ enMemoria: memoria(-5_000), primera: TEL, ahora: T0 }) === 'pedir'
  )
  const cargarLlegadaTs = entre(reportar, 'const cargarLlegada = useCallback(', 'const iniciar = useCallback(')
  const ramaMemoria = entre(cargarLlegadaTs, "if (enMemoria && plan !== 'pedir') {", "return { contexto: enMemoria.contexto, sinSenal: false }")
  const iniciarTs = entre(reportar, 'const iniciar = useCallback(', 'const reubicar = useCallback(')
  check(
    'Reportar: usa contextoReciente + planCargaReportar; con usar o pintar_y_refrescar pinta lo de memoria sin pedir el contexto',
    /contextoReciente\(\{ maxEdadMs: FRESCURA_PINTAR_MS, cercaDe: primera, maxDistanciaM: DISTANCIA_RECARGA_M \}\)/.test(cargarLlegadaTs) &&
      /planCargaReportar\(\{ enMemoria, primera, ahora: Date\.now\(\) \}\)/.test(cargarLlegadaTs) &&
      /setContexto\(enMemoria\.contexto\)/.test(ramaMemoria) &&
      !/api\.contexto\(|cargarContexto\(/.test(ramaMemoria) &&
      /if \(plan === 'pintar_y_refrescar' && primera\) void recargarSinTapar\(gen, primera\)/.test(ramaMemoria) &&
      /cargar: primera => cargarLlegada\(gen, primera, \{ visitas: pedidoVisitas, vigente \}\)/.test(iniciarTs)
  )
  check(
    'Reportar: "Cargando tus citas…" solo cuando hay que pedir (después de la rama de memoria, nunca al recibir la primera)',
    (reportar.match(/setTextoCarga\(TEXTO_CARGANDO_SEDES\)/g) ?? []).length === 1 &&
      cargarLlegadaTs.indexOf('setTextoCarga(TEXTO_CARGANDO_SEDES)') > cargarLlegadaTs.indexOf('return { contexto: enMemoria.contexto, sinSenal: false }') &&
      !/TEXTO_CARGANDO_SEDES/.test(entre(iniciarTs, 'conLaPrimera: estado => {', 'cargar: primera =>'))
  )
  check(
    'Reportar: afinar compara la final con el punto del contexto EN USO (el de memoria puede no ser la primera)',
    /debeRecargarContexto\(puntoDelContexto\.current \?\? primera, lugar\)/.test(entre(reportar, 'const afinar = useCallback(', 'const cargarLlegada = useCallback('))
  )
  check(
    'Reportar: en la recarga sin tapar, una respuesta vieja no pisa a la nueva (turno) ni a otra llegada (generación)',
    /if \(gen !== generacion\.current \|\| turno !== recargas\.current\) return/.test(entre(reportar, 'const recargarSinTapar = useCallback(', 'const afinar = useCallback('))
  )

  // --- Cita desde Hoy -----------------------------------------------------------------------------------------
  fijarCitaParaReportar('cita-1')
  check('retorno: la cita de Hoy se toma una sola vez', tomarCitaParaReportar() === 'cita-1' && tomarCitaParaReportar() === null)
  type Pedido = { cita_id: string }
  const CITA: Pedido = { cita_id: 'cita-1' }
  const paso = (extra: Partial<Parameters<typeof pasoDelReporte<Pedido>>[0]> = {}) =>
    pasoDelReporte<Pedido>({ motivo: 'foco', iniciado: true, nuevo: null, aplazado: CITA, enviando: 0, ocupada: false, abiertas: 0, volviendoDeCrear: false, reiniciar: true, ...extra })
  const libre = paso()
  check('cita desde Hoy: sin nada abierto, empieza la llegada con esa cita', libre.accion === 'iniciar' && libre.reintento === CITA)
  check('cita desde Hoy: la primera vez que se abre Reportar, también', paso({ iniciado: false, abiertas: 3 }).accion === 'iniciar')
  check(
    'cita desde Hoy: con una tarjeta abierta, una grabación o un envío en curso, no borra nada y queda pendiente',
    paso({ abiertas: 1 }).accion === 'aplazar' && paso({ ocupada: true }).accion === 'aplazar' && paso({ enviando: 1 }).accion === 'aplazar' && paso({ volviendoDeCrear: true }).accion === 'aplazar'
  )
  const finEnvio = pasoDelReporte<Pedido>({ motivo: 'envio', iniciado: true, nuevo: null, aplazado: CITA, enviando: 0, ocupada: false, abiertas: 0, volviendoDeCrear: false, reiniciar: false })
  check('cita desde Hoy: al terminar el último envío sin nada abierto, se elige', finEnvio.accion === 'iniciar' && finEnvio.reintento === CITA)
  const eligeTs = entre(iniciarTs, "setFase('lista')", '\n    },\n')
  check(
    'Reportar: al cargar la llegada elige la cita si sigue pendiente de hoy (citasParaReportar); si no, avisa',
    /const citaPorElegir = citaDeHoy \?\? aplazada/.test(eligeTs) &&
      /const sigue = citasParaReportar\(cargado\.contexto\.agenda_hoy[^\n]*\.some\(c => c\.id === citaPorElegir\)/.test(eligeTs) &&
      /if \(sigue\) \{\s*setCitaElegida\(citaPorElegir\)\s*setSedeElegida\(null\)/.test(eligeTs) &&
      /setAvisoCita\(MENSAJE_CITA_NO_DISPONIBLE\)/.test(eligeTs)
  )

  // --- Antes de elegir -----------------------------------------------------------------------------------------
  const botonesTs = entre(reportar, '{/* 2. Hablar o por toques', "{fase === 'grabando' ? (")
  check(
    'Reportar: antes de elegir no aparecen Hablar y Por toques deshabilitados (solo salen después de elegir)',
    /^\{\/\* 2\. Hablar o por toques[^\n]*\n\s*\{fase === 'lista' && eligio \? \(/.test(botonesTs) &&
      /titulo="Hablar"/.test(botonesTs) &&
      /titulo="Por toques"/.test(botonesTs) &&
      !/deshabilitado=/.test(botonesTs) &&
      !/Primero elige dónde estás/.test(reportar)
  )
  check('Reportar: hay una línea guía arriba antes de elegir', /\{fase === 'lista' && !eligio \? <Texto>Toca tu cita o la sede donde estás\./.test(reportar))

  // --- Lo que dijiste ------------------------------------------------------------------------------------------
  const proponiendoTs = entre(reportar, "{fase === 'proponiendo' ? (", "{fase === 'tarjetas' && borradores.length > 0 ? (")
  check('Reportar: en la fase proponiendo ya se ve "Lo que dijiste"', /<LoQueDijiste texto=\{transcript\}/.test(proponiendoTs) && /Armando las visitas/.test(proponiendoTs))
  const loQueDijisteTs = entre(reportar, 'function LoQueDijiste(', '\n}\n')
  check(
    '"Lo que dijiste" se pliega (3 líneas) y se despliega completo al tocarlo',
    /lineas=\{abierto \? undefined : 3\}/.test(loQueDijisteTs) && /alPresionar=\{largo \? \(\) => setAbierto\(!abierto\) : undefined\}/.test(loQueDijisteTs) && /'Ver todo'/.test(loQueDijisteTs)
  )

  // --- Próxima reunión -----------------------------------------------------------------------------------------
  const camposTs = leer('components/reporte/CamposVisita.tsx')
  check(
    'CamposVisita: la próxima reunión con CalendarioMes (no el campo "Fecha (AAAA-MM-DD)"); los atajos se quedan',
    /<CalendarioMes valor=\{[^}]*\} alCambiar=\{fecha => alCambiar\(\{ next_step_date: fecha \}\)\} hoy=\{hoy\} desde=\{hoy\}/.test(camposTs) &&
      !/AAAA-MM-DD\)/.test(camposTs) &&
      ["'Mañana'", "'En 1 semana'", "'En 15 días'", "'En 1 mes'", '"Sin fecha"'].every(atajo => camposTs.includes(atajo))
  )
  check(
    'puedeAgendarProxima: solo de hoy a hoy + 30',
    puedeAgendarProxima(HOY, HOY) && puedeAgendarProxima('2026-11-14', HOY) && !puedeAgendarProxima('2026-11-15', HOY) && !puedeAgendarProxima('2026-10-14', HOY) && !puedeAgendarProxima(null, HOY)
  )
  check(
    'pedidoAgendarDe: con quién va en memoria (médico y sede; o cuenta, subtipo y sede), nunca en la URL',
    JSON.stringify(pedidoAgendarDe(buena)) === JSON.stringify({ tipo: 'medica', medico_id: M_GOMEZ, sede_id: S_NORTE }) &&
      JSON.stringify(pedidoAgendarDe({ tipo: 'institucional', medico_id: null, cuenta_id: 'c', subtipo_id: 's', sede_id: 'x' })) === JSON.stringify({ tipo: 'institucional', cuenta_id: 'c', subtipo_id: 's', sede_id: 'x' }) &&
      pedidoAgendarDe({ ...buena, tipo: null }) === null
  )
  const agendarTs = entre(reportar, 'const agendarReunion = (r: Resultado) => {', '\n  }\n')
  check(
    'Reportar: la visita confirmada ofrece "Agendar esa reunión" solo dentro de la ventana (fijarPedidoAgendar + rutaAgendar)',
    /if \(r\.pedidoAgendar\) fijarPedidoAgendar\(r\.pedidoAgendar\)/.test(agendarTs) &&
      /router\.push\(rutaAgendar\(\{ fecha: r\.proxima \}\)\)/.test(agendarTs) &&
      /\{r\.proxima && r\.pedidoAgendar && puedeAgendarProxima\(r\.proxima, hoy\) \? \(\s*<Boton titulo="Agendar esa reunión"[^>]*alPresionar=\{\(\) => agendarReunion\(r\)\}/.test(reportar) &&
      /proxima: borrador\.next_step_date\.trim\(\) \|\| null,\s*pedidoAgendar: pedidoAgendarDe\(borrador\)/.test(reportar)
  )

  // --- Dictar, vibración y permiso del micrófono ----------------------------------------------------------------
  const dictarTs = leer('components/reporte/DictarCampo.tsx')
  const botonDictarTs = entre(dictarTs, 'function BotonDictar(', '\n}\n')
  const constanteAlto = ['lib/ui.tsx', 'lib/paleta.ts'].filter(r => existsSync(path.join(RAIZ, r))).map(r => /export const ALTO_TOQUE_MIN = (\d+)/.exec(leer(r))?.[1]).find(Boolean)
  check(
    '"Dictar" mide 44 pt o más, con el ícono del micrófono, y no va con position absolute',
    Number(constanteAlto) >= 44 &&
      /minHeight: ALTO_TOQUE_MIN/.test(botonDictarTs) &&
      /<Icono nombre="microfono"/.test(botonDictarTs) &&
      /Dictar<\/Text>/.test(botonDictarTs) &&
      !/position: 'absolute'/.test(dictarTs),
    { constanteAlto }
  )
  const grabadorTs = leer('components/reporte/Grabador.tsx')
  const empezarTs = entre(grabadorTs, 'grabadora.record()', 'catch {')
  const terminarTs = entre(grabadorTs, 'const terminar = useCallback(async () => {', 'const cancelar = useCallback(')
  check(
    'Grabador: vibra al empezar (y avisa alEmpezar) y al terminar',
    /vibrarSuave\(\)/.test(empezarTs) && /llamadas\.current\.alEmpezar\?\.\(\)/.test(empezarTs) && /vibrarSuave\(\)/.test(terminarTs)
  )
  const pararTs = entre(grabadorTs, 'const parar = useCallback(async', '}, [grabadora])')
  check(
    'Grabador: entrega la grabación sin esperar a que se restaure el modo de audio',
    /void setAudioModeAsync\(\{ allowsRecording: false \}\)/.test(pararTs) && !/await setAudioModeAsync/.test(pararTs) && pararTs.indexOf('uri = grabadora.uri') < pararTs.indexOf('setAudioModeAsync(')
  )
  check(
    'Reportar: pide el permiso del micrófono al elegir la cita o la sede (con la voz disponible)',
    /export async function pedirPermisoMicrofono\(\)/.test(grabadorTs) &&
      /if \(contexto\?\.voz\.transcribir && contexto\.voz\.proponer && !sinSenal\) void pedirPermisoMicrofono\(\)/.test(entre(reportar, 'function prepararMicrofono(', '\n}\n')) &&
      /prepararMicrofono\(contexto, sinSenal\)/.test(entre(reportar, 'const elegirCita = (id: string | null) => {', 'const elegirSede = ')) &&
      /prepararMicrofono\(contexto, sinSenal\)/.test(entre(reportar, 'const elegirSede = (id: string | null) => {', 'const elegirSedeBuscada = '))
  )
  const confirmarTs = entre(reportar, 'const confirmarTarjeta = async', 'const descartar = ')
  check(
    'Reportar: vibra con el 201 (la visita enviada) y avisa con vibración si no pasó o el servidor la rechazó',
    /if \(elemento\.estado === 'enviada'\) \{[^}]*marcar\('visita_guardada'\)\s*vibrarExito\(\)\s*\}/.test(confirmarTs) && (confirmarTs.match(/vibrarAviso\(\)/g) ?? []).length === 2
  )

  // --- Marcas de tiempo ----------------------------------------------------------------------------------------
  const faltan = MARCAS.filter(marca => !reportar.includes(`marcar('${marca}'`))
  check('Reportar llama a marcar() en las 9 marcas del dictado', faltan.length === 0, faltan)
  check(
    'Reportar: cada marca en su sitio (toque_hablar en hablar, grabando con alEmpezar, transcripcion tras transcribir, visita_guardada con el 201)',
    /marcar\('toque_hablar'\)/.test(entre(reportar, 'const hablar = (', '\n  }\n')) &&
      /alEmpezar=\{\(\) => marcar\('grabando'\)\}/.test(reportar) &&
      /\.transcript\s*marcar\('transcripcion'\)/.test(reportar) &&
      /marcar\('propuesta'/.test(entre(reportar, 'const propuesta = await api.proponer(', 'const cat = ultimo.current.catalogo')) &&
      /setFase\('lista'\)\s*marcar\('lista_pintada'\)/.test(iniciarTs) &&
      /marcar\('toque_confirmar'\)/.test(confirmarTs)
  )
}
