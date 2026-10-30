/**
 * Pruebas PURAS de la app móvil (sin React Native, sin red): Haversine con los mismos casos del servidor
 * (web/scripts/reporte-check.ts), fechas en Bogotá (medianoche UTC frente a Bogotá, plazo de días libres), la cola
 * sin señal (reintento, descarte a medianoche, idempotencia por client_id, envíos concurrentes), el mapeo de
 * errores de la API, el armado de URLs, la lectura del token, los textos de las pantallas, Reportar (tarjetas,
 * validación con los mismos mensajes del servidor, cuerpo de POST /api/me/visitas, corregir el mismo día), la
 * grabación, el médico completo y la sede nueva, las claves de cada forma JSON frente al contrato y (F4.1) la agenda:
 * las citas de Reportar por distancia, la tarjeta armada desde la cita con su agenda_id, el dictado de un campo que se
 * añade sin borrar, el formulario de Agendar y los textos de la agenda; Reportar no abre tarjetas sin cita o sede
 * elegida, Mi agenda muestra las canceladas; y la marca (app.json, pantalla de inicio, módulos de Expo Go y textos).
 * Secciones 15 a 19 (spec docs/specs/2026-10-15-usabilidad-y-agenda-con-hora.md), un archivo por paquete en
 * scripts/checks/ (cada uno se corre solo con `npx tsx scripts/checks/correr.ts NN-nombre`): 15 navegación y kit visual
 * (pestañas con ícono, contraste, teclado, pie fijo, háptica), 16 Reportar (tarjeta en resumen, pie "Confirmar visita i
 * de N", médicos por sede y cercanía, buscador al escribir, carga desde memoria, cita desde Hoy), 17 agenda con hora y
 * calendario, 18 tiempos y contexto en memoria (token, sesión, audio), 19 el resto de pantallas, 20 el estilo visual tipo
 * Uber (tokens y contrastes, croquis, encabezado blanco y barra) y 21 la persona de campo y el ciclo de vida de la cita
 * (F1b de docs/specs/2026-10-15-actividades-de-campo.md: el espejo de web/lib/agenda-ciclo.ts, "¿Qué pasó con esto?",
 * la dirección comercial, cuota y días libres sin Ejecutivo Comercial, "Como", otra fecha y los textos).
 * Contrato: docs/fases/fase8-visitas-f3-f4-reporte-y-app-movil.md (secciones "App móvil", "Pruebas" y "F4.1").
 *
 * Uso (desde mobile/): npx tsx scripts/movil-check.ts   (va dentro de npm run check)
 * Código de salida 1 si alguna prueba falla.
 */
import {
  ColaVisitas,
  MENSAJE_OTRO_DIA,
  MENSAJE_PASO_MEDIANOCHE,
  MENSAJE_POR_CONFIRMAR,
  agregar,
  aplicarMedianoche,
  deserializar,
  esReintentable,
  podar,
  porEnviar,
  procesar,
  resumen,
  serializar,
  type AlmacenCola,
  type ElementoCola,
  type RespuestaEnvio,
} from '../lib/cola'
import {
  ApiError,
  MENSAJE_SESION_VENCIDA,
  MENSAJE_SIN_CONEXION,
  MENSAJE_TIEMPO_AGOTADO,
  aApiError,
  errorDeRespuesta,
  esNoDisponible,
  esSesionVencida,
  esTransitorio,
  leerCuerpoError,
  mensajePorEstado,
  tipoPorEstado,
} from '../lib/errores'
import {
  esFechaIso,
  esHoyBogota,
  fechaBogota,
  fechaCorta,
  fechaLarga,
  fechaRelativa,
  finDelDiaBogota,
  horaBogota,
  hoyBogota,
  isoBogota,
  nombreMes,
  puedeRegistrarDiaLibre,
  sumarDias,
  sumarMeses,
  textoLimiteLargo,
  textoLimiteRegistro,
  venceRegistroDiaLibre,
} from '../lib/fechas'
import { RADIO_TIERRA_M, dentroDelRadio, esPunto, haversineM, ordenarPorDistancia, textoDistancia, textoPrecision } from '../lib/geo'
import { URL_PRODUCCION, construirUrl, esServidorDesarrollo, jsonSeguro, nombreServidor, normalizarBase } from '../lib/http'
import {
  agruparCitasPorDia,
  avance,
  conQuien,
  conQuienCita,
  cuentaDistinta,
  detalleModalidad,
  ejecutivaPuedeAnular,
  fraccionBarra,
  muestraCuota,
  numeroTexto,
  ordenarDiasLibres,
  pareceCorreo,
  plural,
  porcentaje,
  textoFraccion,
  textoHoraCita,
  textoTotalAgenda,
  tituloDiaAgenda,
  tituloRol,
} from '../lib/reglas'
import { decodificarBase64Url, leerCargaToken, tokenVencido } from '../lib/token'
import type { CitaItem, ContextoResponse, DiaLibreItem, MedicoPublico, PropuestaResponse, SedeCreada, VisitaCreate, VisitaItem } from '../lib/tipos'
import { CLAVES_API, clavesDe, tieneClaves } from '../lib/claves-api'
import { MAX_GRABACION_MS, debeParar, formatoDuracion, nivelDesdeMetering, restanteGrabacion, segundosDe } from '../lib/grabacion'
import {
  MENSAJE_CITA_PASADA,
  MENSAJE_DICTADO_NO_DISPONIBLE,
  MENSAJE_HORA_CITA,
  MENSAJES_RECHAZO_CITA,
  aplicarCitaAPropuestas,
  borradorDesdeCita,
  cambiarFormularioCita,
  citasParaReportar,
  hayEleccion,
  cuerpoCita,
  esRechazoDeCita,
  esVisitaDeLaCita,
  formularioCitaVacio,
  horaDeCita,
  mensajeErrorDictado,
  ordenarCitasPorDistancia,
  textoRechazoCita,
  textoResultadoDictado,
  unirCamposDictados,
  validarCita,
  type FormularioCita,
  MENSAJE_LINEAS_AJENAS,
  MENSAJE_PROXIMA_ANTES_DE_VISITA,
  MENSAJE_SEDE_SIN_UBICACION,
  MENSAJE_SOLO_HOY,
  MENSAJE_TELEFONICA_NO_HABILITADA,
  MENSAJE_TOPE_MEDICO,
  REINICIO_REPORTE_MS,
  borradorDesdeCuerpo,
  borradorVacio,
  borradoresDesdePropuesta,
  cambiarBorrador,
  cambiosDeVisita,
  catalogoDesdeContexto,
  contextoParaGuardar,
  contextoUsable,
  cuerpoDesdeBorrador,
  debeReiniciarReporte,
  descartarYaConfirmadas,
  distanciaASede,
  interpretarRechazo,
  medicoDesdeBusqueda,
  medicoParaReportar,
  AVISO_NO_VISITANTE,
  avisoVisitante,
  mensajeFueraDeRadio,
  mensajePerfil,
  mensajeTopeTelefonicas,
  puedeOfrecerTelefonica,
  resumenBorrador,
  sedeConsultorio,
  sedesDeCuentaBuscada,
  telefonicasDeHoy,
  validarBorrador,
  valoresDeVisita,
} from '../lib/propuesta'
import { departamentoDe, municipioDe, tipoIdCuentaDeMedico, validarDocumentoMedico, validarRepsCode } from '../lib/terceros'
import { parteAudio, tipoAudio } from '../lib/subida-audio'
import {
  DISTANCIA_RECARGA_M,
  EDAD_MAXIMA_ULTIMA_MS,
  MENSAJE_SIN_PERMISO_UBICACION,
  MENSAJE_SIN_UBICACION,
  aUbicacion,
  abiertasAlTerminarEnvio,
  arrancarLlegada,
  contactosQueSeConservan,
  contextoAlRecargar,
  datosParaConfirmar,
  debeRecargarContexto,
  enUsoAlRecargar,
  estaAfinando,
  lugarDeLaVisita,
  pasoDelReporte,
  sedesQueSeConservan,
  registroDeRapidas,
  ubicacionEnDosPasos,
  ubicacionFinal,
  type EstadoConLaPrimera,
  type EstadoDelReporte,
  type FuentesUbicacion,
  type Lectura,
  type ResultadoUbicacion,
} from '../lib/ubicacion-pasos'
import type { Probador } from './checks/probador'
import { pruebas as pruebasNavegacion } from './checks/15-navegacion'
import { pruebas as pruebasReportar } from './checks/16-reportar'
import { pruebas as pruebasAgenda } from './checks/17-agenda'
import { pruebas as pruebasTiempos } from './checks/18-tiempos'
import { pruebas as pruebasPantallas } from './checks/19-pantallas'
import { pruebas as pruebasEstilo } from './checks/20-estilo'
import { pruebas as pruebasPersona } from './checks/21-persona'

// Este archivo corre en Node (tsx), pero el programa de tipos es el de la app (sin @types/node, que chocaría con los
// tipos de React Native): fs y path con lo mínimo que se usa aquí.
interface FsMinimo {
  existsSync(ruta: string): boolean
  readFileSync(ruta: string, codificacion: 'utf8'): string
  readFileSync(ruta: string): { readUInt32BE(desde: number): number }
  readdirSync(ruta: string): string[]
  statSync(ruta: string): { isDirectory(): boolean }
}
interface PathMinimo {
  resolve(...partes: string[]): string
  join(...partes: string[]): string
  relative(desde: string, hasta: string): string
}
declare const __dirname: string
const { existsSync, readFileSync, readdirSync, statSync } = require('fs') as FsMinimo
const path = require('path') as PathMinimo

// ---------------------------------------------------------------------------
// Mini marco de pruebas
// ---------------------------------------------------------------------------

let fallas = 0
let total = 0

function check(nombre: string, ok: boolean, detalle?: unknown) {
  total++
  if (ok) {
    console.log(`  ✓ ${nombre}`)
  } else {
    fallas++
    console.log(`  ✗ ${nombre}${detalle !== undefined ? ` → ${JSON.stringify(detalle)}` : ''}`)
  }
}

function seccion(titulo: string) {
  console.log(`\n${titulo}`)
}

async function lanza(fn: () => unknown | Promise<unknown>): Promise<string | null> {
  try {
    await fn()
    return null
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
}

// ---------------------------------------------------------------------------
// Datos de prueba
// ---------------------------------------------------------------------------

const SEDE_PUNTO = { lat: 4.711, lng: -74.0721 }
const BOGOTA = { lat: 4.711, lng: -74.0721 }
const MEDELLIN = { lat: 6.2442, lng: -75.5812 }
const GRADOS_POR_METRO = 180 / (Math.PI * RADIO_TIERRA_M)
const aMetrosAlNorte = (punto: { lat: number; lng: number }, metros: number) => ({ lat: punto.lat + metros * GRADOS_POR_METRO, lng: punto.lng })

/**
 * Casos exactos de distancia: los mismos puntos y enteros que el bloque DO de la 0830 (8.2) exige a
 * visitas_distancia_m. web/scripts/reporte-check.ts lee esos casos del archivo de la migración, los compara con esta
 * misma lista y comprueba que la haversineM de esta app (lib/geo.ts) da los mismos enteros que la del servidor.
 */
const CASOS_HAVERSINE: { a: { lat: number; lng: number }; b: { lat: number; lng: number }; m: number }[] = [
  { a: { lat: 4.6, lng: -74.08 }, b: { lat: 4.603, lng: -74.08 }, m: 334 },
  { a: { lat: 4.6, lng: -74.08 }, b: { lat: 4.6072, lng: -74.08 }, m: 801 },
  { a: { lat: 4.6, lng: -74.08 }, b: { lat: 4.601234, lng: -74.081234 }, m: 194 },
  { a: { lat: 4.6, lng: -74.08 }, b: { lat: 4.6045, lng: -74.08 }, m: 500 },
  { a: { lat: 4.711, lng: -74.0721 }, b: { lat: 6.2442, lng: -75.5812 }, m: 238673 },
  { a: { lat: 6.2442, lng: -75.5812 }, b: { lat: 4.711, lng: -74.0721 }, m: 238673 },
  { a: { lat: 4.711, lng: -74.0721 }, b: { lat: 4.711, lng: -74.0721 }, m: 0 },
]

/** 10:42 en Bogotá del martes 13 de octubre de 2026. */
const AHORA = new Date('2026-10-13T15:42:00Z')
const HOY = '2026-10-13'

const L1 = '11111111-1111-4111-8111-111111111111'
const SEDE = '22222222-2222-4222-8222-222222222222'
const MEDICO = '33333333-3333-4333-8333-333333333333'

let secuencia = 0
function visita(extra: Partial<VisitaCreate> = {}): VisitaCreate {
  secuencia++
  const base: VisitaCreate = {
    client_id: `aaaaaaaa-aaaa-4aaa-8aaa-${String(secuencia).padStart(12, '0')}`,
    tipo: 'medica',
    medico_id: MEDICO,
    cuenta_id: null,
    subtipo_id: null,
    contacto_id: null,
    sede_id: SEDE,
    modalidad: 'presencial',
    medio: null,
    efectiva: true,
    failure_reason: null,
    retry_date: null,
    checked_in_at: '2026-10-13T10:30:00-05:00',
    reported_at: '2026-10-13T10:41:00-05:00',
    lat: SEDE_PUNTO.lat,
    lng: SEDE_PUNTO.lng,
    gps_accuracy_m: 12,
    conclusion: 'Le mostré PerOssal',
    compromisos: null,
    next_step_date: null,
    transcript: null,
    input_mode: 'toques',
    lineas: [L1],
    agenda_id: null,
  }
  return { ...base, ...extra } as VisitaCreate
}

/**
 * Servidor falso: guarda por client_id (como visitas_registrar) y puede fallar a voluntad. Con `reloj`, aplica además
 * la regla del mismo día DESPUÉS de buscar el client_id (como la base): una visita que ya estaba vuelve `repetida`
 * aunque sea de ayer; una nueva de ayer → 400 "Solo se reportan visitas del mismo día".
 */
function servidorFalso(reloj?: () => Date) {
  const filas = new Map<string, string>()
  let fallo: ApiError | Error | null = null
  let llamadas = 0
  const enviados: string[] = []
  const enviar = async (cuerpo: VisitaCreate): Promise<RespuestaEnvio> => {
    llamadas++
    enviados.push(cuerpo.client_id)
    await new Promise(resolve => setTimeout(resolve, 2))
    if (fallo) throw fallo
    const existente = filas.get(cuerpo.client_id)
    if (existente) return { visita_id: existente, repetida: true }
    if (reloj && fechaBogota(cuerpo.checked_in_at) !== hoyBogota(reloj())) throw errorDeRespuesta(400, { error: MENSAJE_OTRO_DIA })
    const id = `visita-${filas.size + 1}`
    filas.set(cuerpo.client_id, id)
    return { visita_id: id, repetida: false }
  }
  return {
    enviar,
    filas,
    enviados,
    get llamadas() {
      return llamadas
    },
    fallar(error: ApiError | Error | null) {
      fallo = error
    },
  }
}

/** Texto → base64url (como toBase64Url de web/lib/session.ts), sin Buffer: TextEncoder + btoa. */
function aBase64Url(texto: string): string {
  const binario = Array.from(new TextEncoder().encode(texto), byte => String.fromCharCode(byte)).join('')
  return btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function almacenMemoria(): AlmacenCola & { texto: string | null } {
  const almacen = {
    texto: null as string | null,
    async leer() {
      return almacen.texto
    },
    async escribir(valor: string) {
      almacen.texto = valor
    },
  }
  return almacen
}

function diaLibre(fecha: string, estado: DiaLibreItem['estado']): DiaLibreItem {
  return {
    id: `dia-${fecha}-${estado}`,
    executive_id: 'e1',
    ejecutiva: 'Ana',
    zona: 'Bogotá',
    fecha,
    fraccion: 1,
    motivo: 'personal',
    motivo_nombre: 'Personal',
    nota: null,
    estado,
    fuera_de_plazo: false,
    justificacion: null,
    registrado_por_nombre: null,
    registrado_at: '2026-10-01T10:00:00Z',
    revisado_por_nombre: null,
    revisado_at: null,
    motivo_revision: null,
  }
}

async function main() {
  // -------------------------------------------------------------------------
  seccion('1. Haversine (los mismos casos que web/scripts/reporte-check.ts)')
  {
    const bogotaMedellin = haversineM(BOGOTA, MEDELLIN)
    check('Bogotá–Medellín ≈ 240 km', bogotaMedellin > 235_000 && bogotaMedellin < 245_000, bogotaMedellin)
    check('es simétrica', haversineM(MEDELLIN, BOGOTA) === bogotaMedellin)
    check('mismo punto → 0', haversineM(BOGOTA, BOGOTA) === 0)
    const quinientos = haversineM(SEDE_PUNTO, aMetrosAlNorte(SEDE_PUNTO, 500))
    check('dos puntos a 500 m → 500 (±1)', Math.abs(quinientos - 500) <= 1, quinientos)
    const ochocientos = haversineM(SEDE_PUNTO, aMetrosAlNorte(SEDE_PUNTO, 800))
    check('dos puntos a 800 m → 800 (±1)', Math.abs(ochocientos - 800) <= 1, ochocientos)
    check('devuelve entero', Number.isInteger(haversineM(SEDE_PUNTO, { lat: 4.7123456, lng: -74.0712345 })))
    check('al este también mide (≈ 1 km a 0,009° de longitud en el ecuador)', Math.abs(haversineM({ lat: 0, lng: 0 }, { lat: 0, lng: 0.009 }) - 1001) <= 1)
    check('radio de la Tierra del contrato (6371008.8 m)', RADIO_TIERRA_M === 6371008.8)
    // Paridad EXACTA con el servidor y la base: los mismos enteros que la 0830 exige a visitas_distancia_m (y que
    // web/scripts/reporte-check.ts exige a haversineM de la web y a esta misma función).
    for (const caso of CASOS_HAVERSINE) {
      const metros = haversineM(caso.a, caso.b)
      check(`haversineM(${caso.a.lat}, ${caso.a.lng} → ${caso.b.lat}, ${caso.b.lng}) = ${caso.m} exactos, como el servidor`, metros === caso.m, metros)
    }
    const ecuador = haversineM({ lat: 0, lng: 0 }, { lat: 0, lng: 0.009 })
    check('0,009° de longitud en el ecuador: entre 1000 y 1002 (el mismo rango que la 0830)', ecuador >= 1000 && ecuador <= 1002, ecuador)
    check('textoDistancia: 350 m y 2,4 km', textoDistancia(350) === '350 m' && textoDistancia(2400) === '2,4 km')
    check('textoDistancia: 1,2 km y 999 m', textoDistancia(1234) === '1,2 km' && textoDistancia(999) === '999 m', [textoDistancia(1234), textoDistancia(999)])
    check('textoPrecision: ±12 m y null', textoPrecision(12.4) === '±12 m' && textoPrecision(null) === null)
    check('dentroDelRadio: 500 en 500 sí, 501 no', dentroDelRadio(500, 500) && !dentroDelRadio(501, 500))
    check('esPunto rechaza fuera de rango y NaN', esPunto(4.7, -74) && !esPunto(91, 0) && !esPunto(Number.NaN, 0) && !esPunto('4', -74))
    const ordenadas = ordenarPorDistancia(
      [
        { id: 'lejos', lat: aMetrosAlNorte(SEDE_PUNTO, 900).lat, lng: SEDE_PUNTO.lng },
        { id: 'sin', lat: null, lng: null },
        { id: 'cerca', lat: aMetrosAlNorte(SEDE_PUNTO, 100).lat, lng: SEDE_PUNTO.lng },
      ],
      SEDE_PUNTO
    )
    check('ordenarPorDistancia: cerca, lejos y sin coordenadas al final', ordenadas.map(s => s.id).join(',') === 'cerca,lejos,sin', ordenadas.map(s => s.id))
  }

  // -------------------------------------------------------------------------
  seccion('2. Fechas en Bogotá (UTC−5)')
  {
    check('22:00 en Bogotá (03:00 UTC del día siguiente) sigue siendo el 13', fechaBogota('2026-10-14T03:00:00Z') === '2026-10-13')
    check('00:00 en Bogotá (05:00 UTC) ya es el 14', fechaBogota('2026-10-14T05:00:00Z') === '2026-10-14')
    check('con zona -05:00 se respeta', fechaBogota('2026-10-13T23:59:00-05:00') === '2026-10-13')
    check('hoyBogota a las 10:42', hoyBogota(AHORA) === HOY)
    check('hoyBogota a las 23:30 del 13 (04:30 UTC del 14)', hoyBogota(new Date('2026-10-14T04:30:00Z')) === '2026-10-13')
    check('esHoyBogota sí/no', esHoyBogota('2026-10-13T08:00:00-05:00', AHORA) && !esHoyBogota('2026-10-12T23:00:00-05:00', AHORA))
    check('esHoyBogota con texto inválido → false', !esHoyBogota('no-es-fecha', AHORA))
    check('horaBogota', horaBogota('2026-10-13T15:42:00Z') === '10:42')
    check('isoBogota con zona -05:00', isoBogota(AHORA) === '2026-10-13T10:42:00.000-05:00', isoBogota(AHORA))
    check('isoBogota vuelve al mismo instante', Date.parse(isoBogota(AHORA)) === AHORA.getTime())
    check('finDelDiaBogota = 23:59:59.999 −05:00', finDelDiaBogota(HOY).toISOString() === '2026-10-14T04:59:59.999Z', finDelDiaBogota(HOY).toISOString())
    check('fechaLarga: "martes 13 de octubre"', fechaLarga(HOY, AHORA) === 'martes 13 de octubre', fechaLarga(HOY, AHORA))
    check('fechaLarga de otro año lleva el año', fechaLarga('2025-12-31', AHORA) === 'miércoles 31 de diciembre de 2025', fechaLarga('2025-12-31', AHORA))
    check('fechaCorta', fechaCorta('2026-11-02') === '2 de noviembre')
    check('fechaRelativa hoy/mañana/ayer', fechaRelativa(HOY, AHORA) === 'hoy' && fechaRelativa('2026-10-14', AHORA) === 'mañana' && fechaRelativa('2026-10-12', AHORA) === 'ayer')
    check('sumarDias cruza mes y año', sumarDias('2026-10-31', 1) === '2026-11-01' && sumarDias('2026-01-01', -1) === '2025-12-31')
    check('sumarMeses y nombreMes', sumarMeses('2026-01', -1) === '2025-12' && sumarMeses('2026-12', 1) === '2027-01' && nombreMes('2026-10') === 'octubre de 2026')
    check('esFechaIso rechaza 2026-02-30', esFechaIso('2026-02-28') && !esFechaIso('2026-02-30') && !esFechaIso('13/10/2026'))
    const vence = venceRegistroDiaLibre('2026-10-12', 24)
    check('plazo de 24 h: el lunes 12 se registra hasta el martes 13 a las 23:59', textoLimiteRegistro(vence) === '2026-10-13 a las 23:59', textoLimiteRegistro(vence))
    check('dentro del plazo a las 10:42 del 13', puedeRegistrarDiaLibre('2026-10-12', 24, AHORA))
    check('fuera del plazo el 14 a las 00:00 (Bogotá)', !puedeRegistrarDiaLibre('2026-10-12', 24, new Date('2026-10-14T05:00:00Z')))
    check('textoLimiteLargo en palabras', textoLimiteLargo(vence, AHORA) === 'martes 13 de octubre a las 23:59', textoLimiteLargo(vence, AHORA))
    check('plazo 0: hasta el final del mismo día', textoLimiteRegistro(venceRegistroDiaLibre(HOY, 0)) === '2026-10-13 a las 23:59')
  }

  // -------------------------------------------------------------------------
  seccion('3. Cola sin señal: idempotencia, reintento y medianoche')
  {
    const v1 = visita()
    const primera = agregar([], { cuerpo: v1, resumen: 'Médica · Dr. Pérez' }, AHORA)
    check('agregar crea una pendiente con la fecha del sitio', primera.nueva && primera.elemento.estado === 'pendiente' && primera.elemento.fecha === HOY)
    const segunda = agregar(primera.cola, { cuerpo: { ...v1, conclusion: 'otra' } as VisitaCreate, resumen: 'otra' }, AHORA)
    check('mismo client_id dos veces → una sola en la cola', !segunda.nueva && segunda.cola.length === 1 && segunda.elemento.resumen === 'Médica · Dr. Pérez')
    const ayer = visita({ checked_in_at: '2026-10-12T18:00:00-05:00', reported_at: '2026-10-12T18:10:00-05:00' })
    check('una visita de ayer no se encola', (await lanza(() => agregar([], { cuerpo: ayer, resumen: 'x' }, AHORA))) === MENSAJE_OTRO_DIA)
    check('22:30 del 13 (03:30 UTC del 14) cuenta como el 13', agregar([], { cuerpo: visita({ checked_in_at: '2026-10-13T22:30:00-05:00', reported_at: '2026-10-13T22:31:00-05:00' }), resumen: 'x' }, new Date('2026-10-14T03:35:00Z')).elemento.fecha === HOY)

    // Envío correcto
    const servidor = servidorFalso()
    const v2 = visita()
    let cola = agregar(agregar([], { cuerpo: v1, resumen: 'uno' }, AHORA).cola, { cuerpo: v2, resumen: 'dos' }, new Date(AHORA.getTime() + 1000)).cola
    let resultado = await procesar(cola, servidor.enviar, () => AHORA)
    check('procesar envía las dos en orden', resultado.enviadas.join(',') === `${v1.client_id},${v2.client_id}` && servidor.filas.size === 2)
    check('quedan enviadas con su visita_id', resultado.cola.every(e => e.estado === 'enviada' && !!e.visita_id) && resultado.detenida === null)
    resultado = await procesar(resultado.cola, servidor.enviar, () => AHORA)
    check('procesar otra vez no reenvía las enviadas', resultado.enviadas.length === 0 && servidor.llamadas === 2)

    // Reintento: el servidor ya la tenía (respuesta perdida) → repetida, nunca duplica
    const reenviada = await procesar(agregar([], { cuerpo: v1, resumen: 'uno' }, AHORA).cola, servidor.enviar, () => AHORA)
    check('reintento del mismo client_id → repetida y el servidor sigue con 2 filas', reenviada.cola[0].repetida && reenviada.cola[0].visita_id === 'visita-1' && servidor.filas.size === 2)

    // Sin señal: sigue pendiente y se detiene
    const sinRed = servidorFalso()
    sinRed.fallar(new TypeError('Network request failed'))
    const v3 = visita()
    const v4 = visita()
    cola = agregar(agregar([], { cuerpo: v3, resumen: 'tres' }, AHORA).cola, { cuerpo: v4, resumen: 'cuatro' }, new Date(AHORA.getTime() + 1000)).cola
    resultado = await procesar(cola, sinRed.enviar, () => AHORA)
    check('sin señal: se detiene en la primera (no intenta la segunda)', resultado.detenida === 'red' && sinRed.llamadas === 1)
    check('sin señal: las dos siguen pendientes, la primera con 1 intento y el aviso', resultado.cola.every(e => e.estado === 'pendiente') && resultado.cola[0].intentos === 1 && resultado.cola[0].error === MENSAJE_SIN_CONEXION)
    // Vuelve la señal
    sinRed.fallar(null)
    resultado = await procesar(resultado.cola, sinRed.enviar, () => new Date(AHORA.getTime() + 60_000))
    check('al volver la señal salen las dos', resultado.enviadas.length === 2 && resultado.cola.every(e => e.estado === 'enviada'))

    // Servidor caído o sin la ruta (503/404) → se reintenta; datos rechazados (400) → no enviada y sigue con las demás
    check('503 y 404 se reintentan; 400 y 403 no', esReintentable(new ApiError(503, 'x')) && esReintentable(new ApiError(404, 'x')) && !esReintentable(new ApiError(400, 'x')) && !esReintentable(new ApiError(403, 'x')))
    const rechazo = servidorFalso()
    const v5 = visita()
    const v6 = visita()
    cola = agregar(agregar([], { cuerpo: v5, resumen: 'cinco' }, AHORA).cola, { cuerpo: v6, resumen: 'seis' }, new Date(AHORA.getTime() + 1000)).cola
    let primeraVez = true
    resultado = await procesar(
      cola,
      async cuerpo => {
        if (primeraVez) {
          primeraVez = false
          throw errorDeRespuesta(400, { error: 'Estás a 800 m de Clínica Norte; el radio es 500 m' })
        }
        return rechazo.enviar(cuerpo)
      },
      () => AHORA
    )
    const cinco = resultado.cola.find(e => e.client_id === v5.client_id)
    check('400: no enviada con el mensaje del servidor', cinco?.estado === 'no_enviada' && cinco.error === 'Estás a 800 m de Clínica Norte; el radio es 500 m', cinco)
    check('400: sigue con la siguiente', resultado.cola.find(e => e.client_id === v6.client_id)?.estado === 'enviada' && resultado.no_enviadas.length === 1)

    // 401: se detiene y no toca nada
    const vencida = await procesar(agregar([], { cuerpo: visita(), resumen: 'siete' }, AHORA).cola, async () => {
      throw new ApiError(401, MENSAJE_SESION_VENCIDA)
    }, () => AHORA)
    check('401: se detiene por sesión y la visita sigue pendiente', vencida.detenida === 'sesion' && vencida.cola[0].estado === 'pendiente')

    // Medianoche
    const tarde = visita({ checked_in_at: '2026-10-13T21:00:00-05:00', reported_at: '2026-10-13T21:05:00-05:00' })
    cola = agregar([], { cuerpo: tarde, resumen: 'tarde' }, new Date('2026-10-14T02:10:00Z')).cola
    const antes = new Date('2026-10-14T04:59:00Z') // 23:59 del 13 en Bogotá
    check('23:59 del mismo día todavía se puede enviar', porEnviar(cola, antes).length === 1 && aplicarMedianoche(cola, antes)[0].estado === 'pendiente')
    const despues = new Date('2026-10-14T05:00:00Z') // 00:00 del 14 en Bogotá
    check('pasada la medianoche: "por confirmar" (nunca se descarta sin preguntar)', aplicarMedianoche(cola, despues)[0].estado === 'por_confirmar' && aplicarMedianoche(cola, despues)[0].error === MENSAJE_POR_CONFIRMAR)
    const servidorMedianoche = servidorFalso(() => despues)
    resultado = await procesar(cola, servidorMedianoche.enviar, () => despues)
    check(
      'pasada la medianoche, la que NO llegó: se pregunta una vez, el servidor la rechaza (otro día) y queda no enviada con el aviso',
      resultado.cola[0].estado === 'no_enviada' && resultado.cola[0].error === MENSAJE_PASO_MEDIANOCHE && servidorMedianoche.llamadas === 1 && servidorMedianoche.filas.size === 0,
      resultado.cola[0]
    )
    check('resumen cuenta la no enviada', resumen(resultado.cola, despues).no_enviadas === 1 && resumen(resultado.cola, despues).pendientes === 0)
    // El escenario del verificador: a las 23:58 el envío llega a la base pero la respuesta se pierde (sin señal); a las
    // 00:05 vuelve la señal. La visita SÍ quedó guardada: el servidor responde repetida y queda enviada (sin aviso falso).
    const v2358 = visita({ checked_in_at: '2026-10-13T23:55:00-05:00', reported_at: '2026-10-13T23:58:00-05:00' })
    let relojPerdida = new Date('2026-10-14T04:58:00Z')
    const servidorPerdida = servidorFalso(() => relojPerdida)
    let respuestaPerdida = true
    const enviarConPerdida = async (cuerpo: VisitaCreate) => {
      const r = await servidorPerdida.enviar(cuerpo)
      if (respuestaPerdida) {
        respuestaPerdida = false
        throw new TypeError('Network request failed') // la base la guardó; la respuesta no llegó
      }
      return r
    }
    let colaPerdida = agregar([], { cuerpo: v2358, resumen: 'la de las 23:58' }, relojPerdida).cola
    resultado = await procesar(colaPerdida, enviarConPerdida, () => relojPerdida)
    check('23:58: la base la guardó pero la respuesta se perdió → sigue pendiente en el teléfono', resultado.cola[0].estado === 'pendiente' && servidorPerdida.filas.size === 1)
    relojPerdida = new Date('2026-10-14T05:05:00Z') // 00:05 del 14
    colaPerdida = aplicarMedianoche(resultado.cola, relojPerdida)
    check('00:05 sin señal todavía: por confirmar, con el aviso de que se revisará', colaPerdida[0].estado === 'por_confirmar' && resumen(colaPerdida, relojPerdida).pendientes === 1)
    const sinSenalAun = servidorFalso(() => relojPerdida)
    sinSenalAun.fallar(new TypeError('Network request failed'))
    const sigue = await procesar(colaPerdida, sinSenalAun.enviar, () => relojPerdida)
    check('sin señal: sigue por confirmar (no se marca perdida)', sigue.cola[0].estado === 'por_confirmar' && sigue.detenida === 'red')
    resultado = await procesar(sigue.cola, enviarConPerdida, () => relojPerdida)
    check(
      'vuelve la señal a las 00:05: el servidor responde repetida (busca el client_id antes de la regla del día) → enviada, sin "avísale a tu líder"',
      resultado.cola[0].estado === 'enviada' && resultado.cola[0].repetida && resultado.cola[0].visita_id === 'visita-1' && resultado.cola[0].error === null && servidorPerdida.filas.size === 1,
      resultado.cola[0]
    )
    // Envío que cruza la medianoche: la segunda pasa a "por confirmar", se pregunta y el servidor la rechaza
    const c1 = visita({ checked_in_at: '2026-10-13T23:50:00-05:00', reported_at: '2026-10-13T23:51:00-05:00' })
    const c2 = visita({ checked_in_at: '2026-10-13T23:55:00-05:00', reported_at: '2026-10-13T23:56:00-05:00' })
    const casiMedianoche = new Date('2026-10-14T04:58:00Z')
    cola = agregar(agregar([], { cuerpo: c1, resumen: 'c1' }, casiMedianoche).cola, { cuerpo: c2, resumen: 'c2' }, new Date(casiMedianoche.getTime() + 1000)).cola
    let reloj = casiMedianoche
    const cruce = servidorFalso(() => reloj)
    resultado = await procesar(
      cola,
      async cuerpo => {
        const respuesta = await cruce.enviar(cuerpo)
        reloj = new Date('2026-10-14T05:00:30Z') // el primer envío termina pasada la medianoche
        return respuesta
      },
      () => reloj
    )
    check(
      'envío que cruza la medianoche: la primera salió; la segunda se pregunta (no estaba) y queda no enviada con el aviso',
      resultado.cola[0].estado === 'enviada' && resultado.cola[1].estado === 'no_enviada' && resultado.cola[1].error === MENSAJE_PASO_MEDIANOCHE && cruce.llamadas === 2 && cruce.filas.size === 1,
      { cola: resultado.cola.map(e => [e.estado, e.error]), llamadas: cruce.llamadas }
    )

    // Podar
    const vieja: ElementoCola = { ...resultado.cola[0], fecha: '2026-10-12', estado: 'enviada' }
    const muyVieja: ElementoCola = { ...resultado.cola[1], client_id: 'x-muy-vieja', fecha: '2026-10-01', estado: 'no_enviada' }
    const reciente: ElementoCola = { ...resultado.cola[1], client_id: 'x-reciente', fecha: '2026-10-12', estado: 'no_enviada' }
    const podada = podar([vieja, muyVieja, reciente], AHORA)
    check('podar: fuera enviadas de días anteriores y no enviadas de más de 7 días', podada.length === 1 && podada[0].client_id === 'x-reciente', podada.map(e => e.client_id))

    // Serializar
    check('serializar y deserializar conservan la cola', deserializar(serializar(resultado.cola)).length === resultado.cola.length)
    check('deserializar ignora JSON dañado y otra versión', deserializar('{no json').length === 0 && deserializar('{"version":2,"items":[{}]}').length === 0 && deserializar(null).length === 0)
  }

  // -------------------------------------------------------------------------
  seccion('4. ColaVisitas con almacén: persistencia y envíos concurrentes')
  {
    const almacen = almacenMemoria()
    const servidor = servidorFalso()
    const colaA = new ColaVisitas(almacen, () => AHORA)
    const v1 = visita()
    const v2 = visita()
    await colaA.encolar(v1, 'uno')
    await colaA.encolar(v1, 'uno otra vez')
    await colaA.encolar(v2, 'dos')
    check('encolar dos veces el mismo client_id guarda una', (await colaA.listar()).length === 2)
    // Otra instancia (la app se cerró y se abrió) lee lo mismo
    const colaB = new ColaVisitas(almacen, () => AHORA)
    check('la cola sobrevive a cerrar la app', (await colaB.listar()).map(e => e.client_id).join(',') === `${v1.client_id},${v2.client_id}`)
    // Volver a primer plano y reconectar al mismo tiempo
    const [r1, r2] = await Promise.all([colaB.procesar(servidor.enviar), colaB.procesar(servidor.enviar)])
    check('dos procesos a la vez: cada visita se envía una sola vez', servidor.llamadas === 2 && servidor.filas.size === 2, servidor.enviados)
    check('el segundo proceso no encuentra nada pendiente', r1.enviadas.length + r2.enviadas.length === 2)
    let avisos = 0
    const quitarOyente = colaB.suscribir(() => avisos++)
    const reporte = await colaB.encolarYEnviar(visita(), 'tres', servidor.enviar)
    quitarOyente()
    check('encolarYEnviar: guarda y envía (enviada con id)', reporte.elemento.estado === 'enviada' && reporte.elemento.visita_id === 'visita-3' && avisos >= 2)
    servidor.fallar(new ApiError(0, MENSAJE_SIN_CONEXION, { tipo: 'red' }))
    const sinSenal = await colaB.encolarYEnviar(visita(), 'cuatro', servidor.enviar)
    check('encolarYEnviar sin señal: queda pendiente (no se pierde)', sinSenal.elemento.estado === 'pendiente' && sinSenal.proceso.detenida === 'red')
    await colaB.quitar(sinSenal.elemento.client_id)
    check('quitar la saca de la cola guardada', !(await new ColaVisitas(almacen, () => AHORA).listar()).some(e => e.client_id === sinSenal.elemento.client_id))
  }

  // -------------------------------------------------------------------------
  seccion('5. Errores de la API')
  {
    const e400 = errorDeRespuesta(400, { error: 'Solo se reportan visitas del mismo día' })
    check('400 con { error } → ese mensaje, tipo datos', e400.message === 'Solo se reportan visitas del mismo día' && e400.tipo === 'datos' && e400.status === 400)
    const conCampos = errorDeRespuesta(400, { errores: [{ campo: 'sede_id', mensaje: 'Elige la sede' }, { campo: 'x' }] })
    check('400 con errores por campo → el primero y los válidos', conCampos.message === 'Elige la sede' && conCampos.errores.length === 1)
    check('401 sin cuerpo → sesión vencida', errorDeRespuesta(401, null).message === MENSAJE_SESION_VENCIDA && esSesionVencida(errorDeRespuesta(401, null)))
    check('403 → permiso', tipoPorEstado(403) === 'permiso')
    check('503 sin cuerpo → no configurado y no disponible', errorDeRespuesta(503, '').message === mensajePorEstado(503) && esNoDisponible(errorDeRespuesta(503, null)))
    check('503 con mensaje de la voz se respeta', errorDeRespuesta(503, { error: 'La transcripción no está configurada (falta OPENAI_API_KEY)' }).message.includes('OPENAI_API_KEY'))
    check('404 → no disponible (respaldo de Números)', esNoDisponible(new ApiError(404, 'x')) && !esNoDisponible(new ApiError(400, 'x')))
    check('fetch sin red (TypeError) → sin conexión', aApiError(new TypeError('Network request failed')).message === MENSAJE_SIN_CONEXION && aApiError(new TypeError('x')).tipo === 'red')
    const abortado = Object.assign(new Error('aborted'), { name: 'AbortError' })
    check('tiempo agotado (AbortError) → tiempo', aApiError(abortado).tipo === 'tiempo' && aApiError(abortado).message === MENSAJE_TIEMPO_AGOTADO)
    check('esTransitorio: red, 500 y 429 sí; 400 no', esTransitorio(new TypeError('x')) && esTransitorio(new ApiError(500, 'x')) && esTransitorio(new ApiError(429, 'x')) && !esTransitorio(new ApiError(400, 'x')))
    check('leerCuerpoError tolera cualquier cosa', leerCuerpoError('texto').error === null && leerCuerpoError({ error: '  ' }).error === null && leerCuerpoError([1]).errores.length === 0)
    check('ApiError pasa por aApiError sin cambiar', aApiError(e400) === e400)
  }

  // -------------------------------------------------------------------------
  seccion('6. URL del servidor y token')
  {
    check('sin variable → producción', normalizarBase(undefined) === URL_PRODUCCION && normalizarBase('  ') === URL_PRODUCCION)
    check('quita barras finales', normalizarBase('http://localhost:3000///') === 'http://localhost:3000')
    check('construirUrl con parámetros (omite vacíos)', construirUrl('http://localhost:3000/', '/api/me/visitas', { fecha: HOY, x: null, y: '' }) === 'http://localhost:3000/api/me/visitas?fecha=2026-10-13')
    check('construirUrl codifica', construirUrl('http://h', '/api/me/contexto', { lat: 4.711, lng: -74.0721, nota: 'a b' }) === 'http://h/api/me/contexto?lat=4.711&lng=-74.0721&nota=a%20b')
    check('construirUrl exige "/"', (await lanza(() => construirUrl('http://h', 'api/x'))) !== null)
    check('jsonSeguro', (jsonSeguro('{"a":1}') as { a: number }).a === 1 && jsonSeguro('') === null && jsonSeguro('<html>') === null)
    check('nombreServidor y desarrollo', nombreServidor(URL_PRODUCCION) === 'op-map-umber.vercel.app' && esServidorDesarrollo('http://localhost:3000') && !esServidorDesarrollo(URL_PRODUCCION))
    const exp = Math.floor(AHORA.getTime() / 1000) + 7 * 24 * 3600
    const token = `${aBase64Url(JSON.stringify({ uid: 'usuario-1', pv: 'abc', iat: 1, exp }))}.firma`
    check('leerCargaToken lee uid y exp', leerCargaToken(token)?.uid === 'usuario-1' && leerCargaToken(token)?.exp === exp)
    check('tokenVencido: vigente hoy, vencido en 8 días', !tokenVencido(token, AHORA) && tokenVencido(token, new Date(AHORA.getTime() + 8 * 24 * 3600 * 1000)))
    check('token dañado → null y no vencido', leerCargaToken('basura') === null && leerCargaToken('###.x') === null && !tokenVencido('basura', AHORA))
    check('base64url con tildes', decodificarBase64Url(aBase64Url('Bogotá ñ')) === 'Bogotá ñ')
  }

  // -------------------------------------------------------------------------
  seccion('7. Textos y reglas de las pantallas')
  {
    check('numeroTexto: 1.250, 0,5, 72 y —', numeroTexto(1250) === '1.250' && numeroTexto(0.5) === '0,5' && numeroTexto(72) === '72' && numeroTexto(null) === '—', [numeroTexto(1250), numeroTexto(0.5)])
    check('numeroTexto: 2 decimales y negativos', numeroTexto(3.14159) === '3,14' && numeroTexto(-1234.5) === '-1.234,5')
    check('porcentaje: 86 % y —', porcentaje(0.856) === '86 %' && porcentaje(null) === '—')
    check('fraccionBarra recorta a 0..1', fraccionBarra(1.4) === 1 && fraccionBarra(-1) === 0 && fraccionBarra(null) === 0 && fraccionBarra(0.3) === 0.3)
    check('avance con meta 0 → null', avance(2, 0) === null && avance(3, 6) === 0.5)
    check('muestraCuota: fuera del perfil con cuota 0 → no', !muestraCuota({ cuota: 0, meta_dia_hoy: 0, origen: null, aplica: false }) && muestraCuota({ cuota: 4, meta_dia_hoy: 1, origen: 'general', aplica: false }))
    check('anular día libre: por aprobar siempre; aprobado solo hoy o después', ejecutivaPuedeAnular({ estado: 'por_aprobar', fecha: '2026-10-01' }, HOY) && ejecutivaPuedeAnular({ estado: 'aprobado', fecha: HOY }, HOY) && !ejecutivaPuedeAnular({ estado: 'aprobado', fecha: '2026-10-12' }, HOY) && !ejecutivaPuedeAnular({ estado: 'rechazado', fecha: '2026-10-20' }, HOY))
    const orden = ordenarDiasLibres([diaLibre('2026-10-01', 'aprobado'), diaLibre('2026-10-20', 'registrado'), diaLibre('2026-10-14', 'por_aprobar'), diaLibre('2026-10-10', 'anulado')], HOY)
    check('ordenarDiasLibres: próximos primero, luego pasados recientes', orden.map(d => d.fecha).join(',') === '2026-10-14,2026-10-20,2026-10-10,2026-10-01', orden.map(d => d.fecha))
    check('textoFraccion', textoFraccion(1) === 'Día completo' && textoFraccion(0.5) === 'Medio día')
    check('conQuien médica e institucional (sin documentos)', conQuien({ tipo: 'medica', medico: { id: 'm', nombre: 'Dra. Ana Gómez' }, cuenta: null, subtipo: null, contacto: null }) === 'Dra. Ana Gómez' && conQuien({ tipo: 'institucional', medico: null, cuenta: { id: 'c', nombre: 'Clínica Norte' }, subtipo: { id: 's', codigo: 'compras', nombre: 'Compras' }, contacto: null }) === 'Clínica Norte · Compras')
    check('detalleModalidad', detalleModalidad({ modalidad: 'presencial', medio: null, distance_m: 120 }, textoDistancia) === 'Presencial · 120\u00a0m' && detalleModalidad({ modalidad: 'telefonica', medio: 'videollamada', distance_m: null }, textoDistancia) === 'Telefónica · Videollamada')
    check('plural', plural(1, 'visita') === '1 visita' && plural(3, 'visita') === '3 visitas' && plural(2, 'no efectiva', 'no efectivas') === '2 no efectivas')
    check('pareceCorreo', pareceCorreo(' ana@vg.co ') && !pareceCorreo('ana@') && !pareceCorreo('ana vg.co'))
    check('tituloRol como la web', tituloRol('sales_manager') === 'Ejecutivo comercial' && tituloRol('line_leader') === 'Líder de negocio' && tituloRol('commercial_director') === 'Director comercial' && tituloRol(null) === 'Usuario')
  }


  seccion('8. Reportar: tarjetas, validación antes de enviar y cuerpo de POST /api/me/visitas')
  {
    // Sede a 120 m al norte del teléfono, otra a 800 m, una sin coordenadas; un médico propio y uno ajeno.
    const TEL = { lat: 4.711, lng: -74.0721 }
    const norte = (m: number) => ({ lat: Math.round((TEL.lat + m / 111_195) * 1e6) / 1e6, lng: TEL.lng })
    const S1 = 'aaaaaaaa-0000-4000-8000-000000000001'
    const S2 = 'aaaaaaaa-0000-4000-8000-000000000002'
    const S3 = 'aaaaaaaa-0000-4000-8000-000000000003'
    const C1 = 'cccccccc-0000-4000-8000-000000000001'
    const C2 = 'cccccccc-0000-4000-8000-000000000002'
    const M1 = 'dddddddd-0000-4000-8000-000000000001'
    const L1 = 'eeeeeeee-0000-4000-8000-000000000001'
    const L2 = 'eeeeeeee-0000-4000-8000-000000000002'
    const SUB_COMPRAS = 'ffffffff-0000-4000-8000-000000000001'
    const CONTACTO = '99999999-0000-4000-8000-000000000001'
    const contexto: ContextoResponse = {
      ejecutiva: { id: 'e1', nombre: 'Ana', zona: 'Bucaramanga', municipio: '68001', lineas: [{ id: L1, code: 'osteo', name: 'Osteosíntesis' }, { id: L2, code: 'col', name: 'Columna' }] },
      hoy: { fecha: '2026-10-13', meta: { medica: 6, institucional: 1 }, hechas: { medicas: 0, institucionales: 0, telefonicas: 1, no_efectivas: 0 }, cuota_dia_ok: false },
      config: { radio_m: 500, telefonica: { habilitada: true, tope_dia: 2, medios: ['llamada', 'videollamada'] }, tope_visitas_medico_dia: 1, perfil: ['medica', 'institucional'] },
      sedes_cerca: [
        { id: S1, nombre: 'Clínica Norte', cuenta_id: C1, cuenta_nombre: 'Clínica Norte S.A.', cuenta_clase: 'clinica', ciudad: 'Bucaramanga', ...norte(120), distancia_m: 120, hospital_id: null, ubicacion_confirmada: true },
        { id: S2, nombre: 'Clínica Sur', cuenta_id: C2, cuenta_nombre: 'Clínica Sur', cuenta_clase: 'clinica', ciudad: 'Bucaramanga', ...norte(800), distancia_m: 800, hospital_id: null, ubicacion_confirmada: true },
      ],
      mis_medicos: [{ id: M1, nombre: 'Dra. Ana Gómez', especialidades: ['ortopedia'], municipality_id: '68001', lineas: [L1], sedes: [{ id: S1, nombre: 'Clínica Norte', cuenta_nombre: 'Clínica Norte S.A.', distancia_m: 120 }, { id: S3, nombre: 'Consultorio Gómez', cuenta_nombre: 'Consultorio', distancia_m: null }] }],
      contactos: [{ id: CONTACTO, cuenta_id: C1, sede_id: S1, nombre: 'Luis Pérez', cargo_texto: 'Jefe de compras', rol: 'compras' }],
      subtipos: [{ id: SUB_COMPRAS, codigo: 'compras', nombre: 'Compras', roles_sugeridos: ['compras'] }],
      compromisos_vencidos: [],
      voz: { transcribir: false, proponer: false },
      agenda_hoy: [],
      persona: { user_id: 'u1', nombre: 'Ana', executive_id: 'e1', rol: 'ejecutivo', lineas: [{ id: L1, nombre: 'Osteosíntesis', como: 'ejecutivo' }, { id: L2, nombre: 'Columna', como: 'ejecutivo' }] },
    }
    let n = 0
    const nuevoId = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`
    const catalogo = catalogoDesdeContexto(contexto, {}, TEL)
    const ahora = new Date('2026-10-13T15:42:00.000Z')
    const llegada = '2026-10-13T10:40:00.000-05:00'
    const entrada = (extra: Partial<Parameters<typeof validarBorrador>[2]> = {}) => ({ punto: TEL, checked_in_at: llegada, ahora, ...extra })

    check('catálogo: distancia recalculada desde el teléfono (≈120 m, no la del contexto)', Math.abs((catalogo.sedes.find(x => x.id === S1)?.distancia_m ?? 0) - 120) <= 1)
    const porToques = borradorVacio(catalogo, { nuevoId, sedeElegida: S1 })
    check('por toques: médica por defecto, presencial y efectiva, sin líneas (tiene dos)', porToques.tipo === 'medica' && porToques.modalidad === 'presencial' && porToques.efectiva && porToques.lineas.length === 0 && porToques.origen === 'toques')
    const conMedico = cambiarBorrador(porToques, { medico_id: M1 }, catalogo)
    check('elegir el médico: su sede dentro del radio queda elegida y sus líneas suyas', conMedico.sede_id === S1 && conMedico.lineas.join() === L1, conMedico)
    const ok = validarBorrador(conMedico, catalogo, entrada())
    check('médica presencial a 120 m: lista para enviar, sin fuera de territorio', ok.ok && ok.distancia_m !== null && Math.abs(ok.distancia_m - 120) <= 1 && !ok.fuera_de_territorio, ok)

    const lejos = validarBorrador(conMedico, catalogo, entrada({ punto: norte(-700) }))
    check('presencial a 820 m: el mismo mensaje del servidor', !lejos.ok && lejos.errores.some(e => e.mensaje === mensajeFueraDeRadio(lejos.distancia_m ?? -1, 'Clínica Norte', 500)), lejos.errores)
    const sinGps = validarBorrador(cambiarBorrador(conMedico, { sede_id: S3 }, catalogo), catalogo, entrada())
    check('sede del médico sin coordenadas: presencial bloqueada con el mensaje de la decisión 6', !sinGps.ok && sinGps.errores.some(e => e.mensaje === MENSAJE_SEDE_SIN_UBICACION), sinGps.errores)
    const telefonica = cambiarBorrador(conMedico, { modalidad: 'telefonica' }, catalogo)
    check('cambiar a telefónica: toma el medio por defecto (llamada)', telefonica.medio === 'llamada' && validarBorrador(telefonica, catalogo, entrada({ punto: null })).ok)
    const sinHabilitar = catalogoDesdeContexto({ ...contexto, config: { ...contexto.config, telefonica: { habilitada: false, tope_dia: 1, medios: ['llamada'] } } }, {}, TEL)
    check('telefónica sin habilitar: rechazada con el mensaje del servidor', validarBorrador(telefonica, sinHabilitar, entrada()).errores.some(e => e.mensaje === MENSAJE_TELEFONICA_NO_HABILITADA))
    const hoyTope = [{ client_id: 'x1', medico_id: null, modalidad: 'telefonica' as const, efectiva: true }, { client_id: 'x2', medico_id: null, modalidad: 'telefonica' as const, efectiva: true }]
    check('tope de telefónicas: con la lista de hoy se cuentan ahí (2 de 2 → rechazada)', validarBorrador(telefonica, catalogo, entrada({ visitasHoy: hoyTope })).errores.some(e => e.mensaje === mensajeTopeTelefonicas(2)))
    check('tope de telefónicas: el contexto y la lista NO se suman (1 en el contexto + la misma 1 en la lista = 1)', telefonicasDeHoy(catalogo, hoyTope.slice(0, 1)) === 1 && telefonicasDeHoy(catalogo, null) === 1 && puedeOfrecerTelefonica(catalogo, hoyTope.slice(0, 1)) && !puedeOfrecerTelefonica(catalogo, hoyTope))
    check('tope de telefónicas: la misma visita reintentada no se cuenta a sí misma', telefonicasDeHoy(catalogo, [...hoyTope.slice(0, 1), { client_id: telefonica.client_id, medico_id: null, modalidad: 'telefonica', efectiva: true }], telefonica.client_id) === 1)
    const tope = validarBorrador(conMedico, catalogo, entrada({ visitasHoy: [{ client_id: 'otra', medico_id: M1, modalidad: 'presencial', efectiva: true }] }))
    check('tope por médico: segunda efectiva al mismo médico → el mensaje del servidor', !tope.ok && tope.errores.some(e => e.mensaje === MENSAJE_TOPE_MEDICO))
    check('tope por médico: la no efectiva no choca', validarBorrador(cambiarBorrador(conMedico, { efectiva: false, failure_reason: 'No estaba' }, catalogo), catalogo, entrada({ visitasHoy: [{ client_id: 'otra', medico_id: M1, modalidad: 'presencial', efectiva: true }] })).ok)
    check('no efectiva sin motivo: rechazada', !validarBorrador(cambiarBorrador(conMedico, { efectiva: false }, catalogo), catalogo, entrada()).ok)
    check('ayer: "Solo se reportan visitas del mismo día"', validarBorrador(conMedico, catalogo, entrada({ checked_in_at: '2026-10-12T10:40:00.000-05:00' })).errores.some(e => e.mensaje === MENSAJE_SOLO_HOY))
    const soloInst = catalogoDesdeContexto({ ...contexto, config: { ...contexto.config, perfil: ['institucional'] } }, {}, TEL)
    check('perfil solo institucional: médica rechazada con el mensaje del servidor', validarBorrador(conMedico, soloInst, entrada()).errores.some(e => e.mensaje === mensajePerfil('medica')))
    check('líneas ajenas: rechazada', validarBorrador({ ...conMedico, lineas: [L1, 'ajena'] }, catalogo, entrada()).errores.some(e => e.mensaje === MENSAJE_LINEAS_AJENAS || e.campo === 'lineas'))

    const inst = cambiarBorrador(borradorVacio(catalogo, { nuevoId, tipo: 'institucional', sedeElegida: S1 }), { contacto_id: CONTACTO, lineas: [L1] }, catalogo)
    check('institucional en la sede elegida: cuenta de la sede y subtipo sugerido por el rol del contacto', inst.cuenta_id === C1 && inst.sede_id === S1 && inst.subtipo_id === SUB_COMPRAS && validarBorrador(inst, catalogo, entrada()).ok, inst)
    const otraCuenta = cambiarBorrador(inst, { cuenta_id: C2 }, catalogo)
    check('cambiar la cuenta: la sede de la otra cuenta sale, entra su única sede y el contacto ajeno se quita', otraCuenta.sede_id === S2 && otraCuenta.contacto_id === null, otraCuenta)

    const cuerpo = cuerpoDesdeBorrador(conMedico, { punto: { ...TEL, precision: 12.4 }, checked_in_at: llegada, reported_at: '2026-10-13T10:41:00.000-05:00', transcript: 'no va por toques' })
    check('cuerpo de POST /api/me/visitas: todas las claves del contrato (y solo esas)', tieneClaves(cuerpo, 'visitaCreate'), clavesDe(cuerpo))
    check('cuerpo presencial: lat/lng del teléfono, precisión entera, sin transcripción por toques, input_mode toques', cuerpo.modalidad === 'presencial' && cuerpo.lat === TEL.lat && cuerpo.gps_accuracy_m === 12 && cuerpo.transcript === null && cuerpo.input_mode === 'toques' && cuerpo.medio === null)
    const cuerpoTel = cuerpoDesdeBorrador(telefonica, { punto: null, checked_in_at: llegada, reported_at: llegada, transcript: null })
    check('cuerpo telefónico: medio, sin ubicación, mismas claves', cuerpoTel.modalidad === 'telefonica' && cuerpoTel.medio === 'llamada' && cuerpoTel.lat === null && tieneClaves(cuerpoTel, 'visitaCreate'))
    const cuerpoInst = cuerpoDesdeBorrador(inst, { punto: TEL, checked_in_at: llegada, reported_at: llegada, transcript: null })
    check('cuerpo institucional: cuenta, subtipo y contacto; médico null', cuerpoInst.tipo === 'institucional' && cuerpoInst.cuenta_id === C1 && cuerpoInst.subtipo_id === SUB_COMPRAS && cuerpoInst.contacto_id === CONTACTO && cuerpoInst.medico_id === null && tieneClaves(cuerpoInst, 'visitaCreate'))
    check('resumen para la cola: sin documentos', resumenBorrador(conMedico, catalogo) === 'Médica · Dra. Ana Gómez · Clínica Norte')

    const propuesta: PropuestaResponse = {
      aviso: null,
      visitas: [
        { tipo: 'medica', subtipo_codigo: null, subtipo_id: null, medico_id: M1, medico_nombre_dicho: null, sugerir_crear_medico: false, cuenta_id: null, sede_id: S1, contacto_id: null, contacto_nombre_dicho: null, lineas: [L1], efectiva: true, failure_reason: null, conclusion: 'Le gustó el tornillo canulado', compromisos: 'Enviar muestra', next_step_date: '2026-10-20', modalidad_sugerida: 'presencial', confianza: 0.9, preguntas: [] },
        { tipo: 'medica', subtipo_codigo: null, subtipo_id: null, medico_id: null, medico_nombre_dicho: 'Dr. Ramírez', sugerir_crear_medico: true, cuenta_id: null, sede_id: S1, contacto_id: null, contacto_nombre_dicho: null, lineas: [], efectiva: true, failure_reason: null, conclusion: null, compromisos: null, next_step_date: null, modalidad_sugerida: 'presencial', confianza: 0.5, preguntas: ['¿Ramírez de columna?'] },
        { tipo: 'institucional', subtipo_codigo: 'compras', subtipo_id: null, medico_id: null, medico_nombre_dicho: null, sugerir_crear_medico: false, cuenta_id: C1, sede_id: S1, contacto_id: CONTACTO, contacto_nombre_dicho: null, lineas: [L1, 'ajena'], efectiva: false, failure_reason: 'No estaba', conclusion: null, compromisos: null, next_step_date: 'mañana', modalidad_sugerida: 'telefonica', confianza: 0.8, preguntas: [] },
      ],
    }
    const tarjetas = borradoresDesdePropuesta(propuesta, catalogo, { nuevoId, sedeElegida: S1 })
    check('propuesta → tres tarjetas por voz, cada una con su client_id', tarjetas.length === 3 && tarjetas.every(t => t.origen === 'voz') && new Set(tarjetas.map(t => t.client_id)).size === 3)
    check('médico que no cruza: nombre dicho y "crear médico completo", sin id inventado', tarjetas[1].medico_id === null && tarjetas[1].medico_nombre_dicho === 'Dr. Ramírez' && tarjetas[1].sugerir_crear_medico && !validarBorrador(tarjetas[1], catalogo, entrada()).ok)
    check('institucional: subtipo por código, línea ajena descartada, fecha inválida vacía, telefónica habilitada', tarjetas[2].subtipo_id === SUB_COMPRAS && tarjetas[2].lineas.join() === L1 && tarjetas[2].next_step_date === '' && tarjetas[2].modalidad === 'telefonica' && tarjetas[2].medio === 'llamada')
    check('cuerpo por voz lleva la transcripción', cuerpoDesdeBorrador(tarjetas[0], { punto: TEL, checked_in_at: llegada, reported_at: llegada, transcript: 'Vi a la doctora Gómez…' }).transcript === 'Vi a la doctora Gómez…')

    const radio = interpretarRechazo({ message: 'Estás a 801 m de Clínica Norte; el radio es 500 m' })
    check('rechazo del servidor por radio: se leen la distancia y el radio', radio.clase === 'radio' && radio.distancia_m === 801 && radio.radio_m === 500)
    check('rechazo por tope, perfil y sede sin ubicación', interpretarRechazo({ message: MENSAJE_TOPE_MEDICO }).clase === 'tope_medico' && interpretarRechazo({ message: mensajePerfil('institucional') }).clase === 'perfil' && interpretarRechazo({ message: MENSAJE_SEDE_SIN_UBICACION }).clase === 'sede_sin_ubicacion')

    const visita: VisitaItem = { id: 'v1', client_id: 'c1', tipo: 'medica', subtipo: null, medico: { id: M1, nombre: 'Dra. Ana Gómez' }, cuenta: null, sede: { id: S1, nombre: 'Clínica Norte' }, contacto: null, modalidad: 'presencial', medio: null, efectiva: true, failure_reason: null, checked_in_at: llegada, distance_m: 120, conclusion: 'Bien', compromisos: null, next_step_date: null, lineas: [L1], input_mode: 'toques', out_of_territory: false, cuenta_para: 'medica', peso: 1, sede_por_confirmar: false, editable: true, agenda_id: null, agendada: false }
    check('corregir: sin cambios → cuerpo vacío', Object.keys(cambiosDeVisita(visita, valoresDeVisita(visita))).length === 0)
    check('corregir: pasar a no efectiva manda el motivo; textos vacíos → null', JSON.stringify(cambiosDeVisita(visita, { ...valoresDeVisita(visita), efectiva: false, failure_reason: ' No estaba ', conclusion: '  ' })) === JSON.stringify({ efectiva: false, failure_reason: 'No estaba', conclusion: null }))
    check('corregir: líneas en cualquier orden no cuentan como cambio', Object.keys(cambiosDeVisita({ ...visita, lineas: [L2, L1] }, { ...valoresDeVisita(visita), lineas: [L1, L2] })).length === 0)

    // --- Hallazgos del verificador (2026-10-14) ---------------------------------------------------------------
    // Telefónica: la ubicación del teléfono no viaja (privacidad).
    const cuerpoTelGps = cuerpoDesdeBorrador(telefonica, { punto: { ...TEL, precision: 8 }, checked_in_at: llegada, reported_at: llegada, transcript: null })
    check('cuerpo telefónico CON el GPS del teléfono: lat, lng y precisión no viajan', cuerpoTelGps.lat === null && cuerpoTelGps.lng === null && cuerpoTelGps.gps_accuracy_m === null && tieneClaves(cuerpoTelGps, 'visitaCreate'))
    // Próxima reunión antes de la visita.
    const proximaAyer = validarBorrador({ ...conMedico, next_step_date: '2026-10-12' }, catalogo, entrada())
    check('próxima reunión anterior a la visita: el mismo mensaje del servidor', !proximaAyer.ok && proximaAyer.errores.some(e => e.campo === 'next_step_date' && e.mensaje === MENSAJE_PROXIMA_ANTES_DE_VISITA))
    check('próxima reunión hoy: ok', validarBorrador({ ...conMedico, next_step_date: '2026-10-13' }, catalogo, entrada()).ok)
    const conFechaVieja = borradoresDesdePropuesta({ aviso: null, visitas: [{ ...propuesta.visitas[0], next_step_date: '2026-10-12' }] }, catalogo, { nuevoId, hoy: '2026-10-13' })
    check('propuesta con próxima reunión de ayer: la tarjeta la deja vacía', conFechaVieja[0].next_step_date === '')

    // Consultorio recién creado (0 m) y sedes de médicos traídos: sin el falso "esta sede no tiene ubicación".
    const S_CONS = 'aaaaaaaa-0000-4000-8000-0000000000c1'
    const S_LEJOS = 'aaaaaaaa-0000-4000-8000-0000000000c2'
    const M_NUEVO = 'dddddddd-0000-4000-8000-0000000000n1'
    const medicoCreado: MedicoPublico = { id: M_NUEVO, nombre: 'Dr. Nuevo', especialidades: ['ortopedia'], municipality_id: '68001', sedes: [{ id: S_CONS, nombre: 'Consultorio Dr. Nuevo', rol: 'consultorio' }, { id: S_LEJOS, nombre: 'Clínica lejana', rol: 'atiende' }] } as MedicoPublico
    const opcion = medicoParaReportar(medicoCreado, new Map([[S_CONS, 0]]))
    check('medicoParaReportar: el consultorio creado con el GPS de aquí a 0 m; la otra sede, desconocida', opcion.sedes[0].distancia_m === 0 && !opcion.sedes[0].coordenadas_desconocidas && opcion.sedes[1].coordenadas_desconocidas === true)
    const conNuevo = catalogoDesdeContexto(contexto, { medicos: [opcion] }, TEL)
    const tarjetaNuevo = cambiarBorrador(borradorVacio(conNuevo, { nuevoId }), { medico_id: M_NUEVO, sede_id: S_CONS, lineas: [L1] }, conNuevo)
    const enConsultorio = validarBorrador(tarjetaNuevo, conNuevo, entrada())
    check('médico recién creado en su consultorio: la presencial se puede confirmar (antes: "Esta sede no tiene ubicación")', enConsultorio.ok && enConsultorio.distancia_m === 0, enConsultorio.errores)
    const enLejana = validarBorrador({ ...tarjetaNuevo, sede_id: S_LEJOS }, conNuevo, entrada())
    check('sede del médico sin distancia conocida: no se bloquea con un motivo falso; decide el servidor', !enLejana.errores.some(e => e.mensaje === MENSAJE_SEDE_SIN_UBICACION) && !distanciaASede({ ...tarjetaNuevo, sede_id: S_LEJOS }, conNuevo, TEL).conocida)
    check('la sede SIN coordenadas del contexto (con punto) sí sigue bloqueada (S3)', validarBorrador(cambiarBorrador(conMedico, { sede_id: S3 }, catalogo), catalogo, entrada()).errores.some(e => e.mensaje === MENSAJE_SEDE_SIN_UBICACION))
    const buscado = medicoDesdeBusqueda({ ...medicoCreado, sedes: [{ id: S1, nombre: 'Clínica Norte', rol: 'atiende' }, { id: S_LEJOS, nombre: 'Clínica lejana', rol: 'atiende' }] } as MedicoPublico, catalogo)
    check('médico del buscador: la sede cercana con su distancia; la que no está cerca, desconocida', buscado.sedes[0].distancia_m !== null && !buscado.sedes[0].coordenadas_desconocidas && buscado.sedes[1].coordenadas_desconocidas === true)
    // Médico del que no es visitante (contrato: suma a su meta, queda out_of_territory y la app ofrece pedir serlo).
    const conAjeno = catalogoDesdeContexto(contexto, { medicos: [buscado] }, TEL)
    const tarjetaAjeno = cambiarBorrador(borradorVacio(conAjeno, { nuevoId }), { medico_id: buscado.id, sede_id: S1, lineas: [L1] }, conAjeno)
    const ajeno = validarBorrador(tarjetaAjeno, conAjeno, entrada())
    check('médico del que no es su visitante: la tarjeta se confirma igual (suma) y queda fuera de su territorio', ajeno.ok && ajeno.fuera_de_territorio, ajeno)
    check(
      'y la tarjeta le dice cómo pedir ser su visitante (a la dirección comercial); con su propio médico o sin médico, ningún aviso',
      avisoVisitante(buscado) === AVISO_NO_VISITANTE && AVISO_NO_VISITANTE.includes('suma igual') && AVISO_NO_VISITANTE.includes('Pide a la dirección comercial que te asigne como su visitante') &&
        avisoVisitante(catalogo.medicos.find(m => m.id === M1)) === null && avisoVisitante(null) === null
    )

    // Cuenta buscada o consultorio existente: nunca una sede inactiva.
    const sedeCreada = (id: string, extra: Partial<SedeCreada>): SedeCreada => ({ id, cuenta_id: C2, nombre: id, es_principal: false, reps_code: null, municipality_id: '68001', ciudad: null, lat: null, lng: null, ubicacion_confirmada: true, origen: 'manual', ...extra })
    const sedesCuenta = [sedeCreada('vieja', { es_principal: true, activo: false }), sedeCreada('nueva', { activo: true }), sedeCreada('otra', {})]
    check('cuenta buscada: solo sus sedes activas entran al catálogo', sedesDeCuentaBuscada({ id: C2, nombre: 'Clínica Sur', clase: 'clinica' }, sedesCuenta).map(x => x.id).join() === 'nueva,otra')
    check('consultorio existente: la principal inactiva no; la primera activa sí; sin activas, ninguna', sedeConsultorio(sedesCuenta)?.id === 'nueva' && sedeConsultorio([sedeCreada('x', { activo: false })]) === null && sedeConsultorio([sedeCreada('p', { es_principal: true }), sedeCreada('q', {})])?.id === 'p')

    // Corregir hablando: lo ya confirmado no vuelve.
    const [medicaVoz, sinCruceVoz, instVoz] = tarjetas
    // El médico dicho ("Dr. Ramírez") se creó completo (M_NUEVO) y la tarjeta se confirmó con él.
    const confirmadaMedico = cambiarBorrador(sinCruceVoz, { medico_id: M_NUEVO }, conNuevo)
    const segunda = borradoresDesdePropuesta(propuesta, catalogo, { nuevoId, sedeElegida: S1 })
    const sinRepetir = descartarYaConfirmadas(segunda, [instVoz, confirmadaMedico])
    check(
      'corregir hablando: la institucional ya confirmada y el médico dicho ya creado no vuelven; la que falta sí',
      confirmadaMedico.medico_id === M_NUEVO && sinRepetir.descartadas === 2 && sinRepetir.quedan.length === 1 && sinRepetir.quedan[0].medico_id === medicaVoz.medico_id,
      sinRepetir.quedan.map(b => [b.tipo, b.medico_id, b.medico_nombre_dicho])
    )
    check('sin confirmadas no se descarta nada', descartarYaConfirmadas(segunda, []).quedan.length === 3)

    // Reportar de nuevo una visita que el servidor no aceptó: misma información, client_id nuevo.
    const rechazada = cuerpoDesdeBorrador({ ...conMedico, conclusion: 'Le gustó el canulado', compromisos: 'Enviar muestra', next_step_date: '2026-10-20' }, { punto: TEL, checked_in_at: llegada, reported_at: llegada, transcript: null })
    const deNuevo = borradorDesdeCuerpo(rechazada, catalogo, { nuevoId })
    check(
      'reportar de nuevo: tipo, médico, sede, conclusión, compromisos y próxima reunión se conservan, con client_id nuevo',
      deNuevo.medico_id === M1 && deNuevo.sede_id === S1 && deNuevo.conclusion === 'Le gustó el canulado' && deNuevo.compromisos === 'Enviar muestra' && deNuevo.next_step_date === '2026-10-20' && deNuevo.client_id !== rechazada.client_id
    )

    // Volver a Reportar: llegada nueva o el mismo reporte.
    const a = (minutos: number) => new Date(Date.parse(llegada) + minutos * 60_000)
    const estadoBase = { llegada, borradores: 0, ocupada: false, esperandoCreacion: false }
    check('volver a Reportar sin tarjetas pendientes: llegada nueva (punto, hora y sedes de ahora)', debeReiniciarReporte({ ...estadoBase, ahora: a(2) }))
    check('con tarjetas sin confirmar de hace 5 minutos: se conservan', !debeReiniciarReporte({ ...estadoBase, borradores: 2, ahora: a(5) }))
    check(`con tarjetas de hace más de ${REINICIO_REPORTE_MS / 60_000} minutos (otra clínica): llegada nueva`, debeReiniciarReporte({ ...estadoBase, borradores: 2, ahora: a(180) }))
    check('al volver de crear el médico o la sede que pidió: nunca se reinicia', !debeReiniciarReporte({ ...estadoBase, borradores: 1, esperandoCreacion: true, ahora: a(180) }))
    check('grabando o esperando a la IA: no se reinicia', !debeReiniciarReporte({ ...estadoBase, ocupada: true, ahora: a(180) }))
    check('pasó la medianoche: llegada nueva', debeReiniciarReporte({ ...estadoBase, borradores: 1, ahora: new Date('2026-10-14T05:01:00Z') }))

    // Sin señal: el contexto guardado hoy, de la misma persona.
    const guardado = JSON.parse(JSON.stringify(contextoParaGuardar('u1', contexto, ahora)))
    check('contexto guardado: sirve hoy y para la misma persona', contextoUsable(guardado, 'u1', ahora)?.contexto.ejecutiva.nombre === 'Ana')
    check('contexto guardado: no sirve mañana, ni para otra persona, ni dañado', contextoUsable(guardado, 'u1', new Date('2026-10-14T15:00:00Z')) === null && contextoUsable(guardado, 'u2', ahora) === null && contextoUsable({ ...guardado, contexto: { ejecutiva: {} } }, 'u1', ahora) === null && contextoUsable(null, 'u1', ahora) === null)
    const sinSenal = catalogoDesdeContexto(contexto, {}, norte(40), { sinSenal: true })
    const enSinSenal = cambiarBorrador(borradorVacio(sinSenal, { nuevoId }), { medico_id: M1, sede_id: S1, lineas: [L1] }, sinSenal)
    check(
      'sin señal: la sede cercana se mide desde el punto de AHORA (80 m); las demás del médico, desconocidas (decide el servidor al enviar)',
      Math.abs((validarBorrador(enSinSenal, sinSenal, entrada({ punto: norte(40) })).distancia_m ?? -1) - 80) <= 1 && sinSenal.medicos[0].sedes.every(x => x.coordenadas_desconocidas === true && x.distancia_m === null),
      sinSenal.medicos[0].sedes
    )
    // Reportar: la final se alejó de la primera y el contexto pedido con ella no llegó (o aún no): una sede del médico
    // que no está entre las cercanas trae la distancia que el servidor midió desde la PRIMERA (1,2 km) y no se puede
    // volver a medir aquí. No bloquea con esa distancia vieja: queda desconocida y decide el servidor.
    const S_MEDICO = 'aaaaaaaa-0000-4000-8000-000000000004'
    const conLejana: ContextoResponse = {
      ...contexto,
      mis_medicos: [{ ...contexto.mis_medicos[0], sedes: [...contexto.mis_medicos[0].sedes, { id: S_MEDICO, nombre: 'Consultorio del Dr. X', cuenta_nombre: 'Consultorio', distancia_m: 1_200 }] }],
    }
    const viejo = catalogoDesdeContexto(conLejana, {}, norte(40))
    const desdeOtro = catalogoDesdeContexto(conLejana, {}, norte(40), { distanciasDeOtroPunto: true })
    const enLaDelMedico = cambiarBorrador(borradorVacio(desdeOtro, { nuevoId }), { medico_id: M1, sede_id: S_MEDICO, lineas: [L1] }, desdeOtro)
    check(
      'contexto de otro punto: con la distancia vieja del servidor se bloquearía ("Estás a 1200 m…"); marcada, la sede del médico queda desconocida y no bloquea',
      validarBorrador(enLaDelMedico, viejo, entrada({ punto: norte(40) })).errores.some(e => e.mensaje.startsWith('Estás a 1200 m')) &&
        validarBorrador(enLaDelMedico, desdeOtro, entrada({ punto: norte(40) })).ok &&
        !distanciaASede(enLaDelMedico, desdeOtro, norte(40)).conocida,
      { viejo: validarBorrador(enLaDelMedico, viejo, entrada({ punto: norte(40) })).errores, nuevo: validarBorrador(enLaDelMedico, desdeOtro, entrada({ punto: norte(40) })).errores }
    )
    check(
      'contexto de otro punto: las sedes con coordenadas se siguen midiendo desde el punto de ahora (Clínica Norte a 80 m)',
      Math.abs((desdeOtro.sedes.find(x => x.id === S1)?.distancia_m ?? -1) - 80) <= 1 && validarBorrador(cambiarBorrador(enLaDelMedico, { sede_id: S1 }, desdeOtro), desdeOtro, entrada({ punto: norte(40) })).distancia_m !== null
    )
  }

  seccion('9. Grabación y terceros (médico completo, sede nueva)')
  {
    check('grabación: reloj m:ss', formatoDuracion(7_000) === '0:07' && formatoDuracion(65_400) === '1:05' && formatoDuracion(MAX_GRABACION_MS) === '3:00' && formatoDuracion(-5) === '0:00')
    check('grabación: para a los 3 minutos (el tope del servidor)', MAX_GRABACION_MS === 180_000 && debeParar(180_000) && !debeParar(179_999) && restanteGrabacion(170_000) === 10_000 && segundosDe(65_400) === 65)
    check('grabación: nivel del micrófono 0..1', nivelDesdeMetering(-160) === 0 && nivelDesdeMetering(0) === 1 && nivelDesdeMetering(-25) === 0.5 && nivelDesdeMetering(null) === 0)
    const cc = validarDocumentoMedico('CC', ' 79.123.456 ')
    check('documento CC: se limpia (puntos y espacios) y solo dígitos', cc.ok && cc.valor === '79123456' && !validarDocumentoMedico('CC', '79A23').ok && !validarDocumentoMedico('CC', '12').ok)
    check('documento CE/PA: letras y números en mayúscula', validarDocumentoMedico('PA', 'ab-12345').ok && (validarDocumentoMedico('PA', 'ab-12345') as { valor: string }).valor === 'AB12345' && !validarDocumentoMedico(null, '123').ok)
    check('consultorio del médico: tipo de identificación de la cuenta', tipoIdCuentaDeMedico('CC') === 'CC' && tipoIdCuentaDeMedico('PEP') === 'otro')
    check('código del REPS: vacío → null, 12 dígitos, si no error', validarRepsCode('').ok && (validarRepsCode(' 6800 1012 3456 ') as { valor: string | null }).valor === '680010123456' && !validarRepsCode('123').ok)
    check('municipio y departamento (celdas de Bogotá de 7 dígitos)', municipioDe('1100102') === '11001' && departamentoDe('68001') === '68' && municipioDe('x') === null)
  }

  seccion('10. Formas JSON: las claves de la app son las del contrato')
  {
    // Copiadas del contrato docs/fases/fase8-visitas-f3-f4-reporte-y-app-movil.md (sección "API" y "Sesión"). Si el
    // contrato cambia una forma, cambia aquí, en lib/tipos.ts y en lib/claves-api.ts (que no compila si no cuadra con
    // los tipos); web/scripts/reporte-api-check.ts compara las mismas listas con las respuestas reales de las rutas.
    const CONTRATO: Record<keyof typeof CLAVES_API, string> = {
      login: 'token expira_at usuario ejecutiva',
      usuario: 'id full_name role',
      ejecutivaMovil: 'id full_name zona',
      me: 'user ejecutiva persona sin_persona',
      // Persona de campo (0850; F1b de actividades de campo: la app la usa)
      persona: 'rol lineas',
      lineaPersona: 'id nombre como',
      personaContexto: 'user_id nombre executive_id rol lineas',
      contexto: 'ejecutiva hoy config sedes_cerca mis_medicos contactos subtipos compromisos_vencidos voz agenda_hoy persona',
      contextoEjecutiva: 'id nombre zona municipio lineas',
      linea: 'id code name',
      hoy: 'fecha meta hechas cuota_dia_ok',
      hechas: 'medicas institucionales telefonicas no_efectivas',
      config: 'radio_m telefonica tope_visitas_medico_dia perfil',
      telefonica: 'habilitada tope_dia medios',
      sedeCerca: 'id nombre cuenta_id cuenta_nombre cuenta_clase ciudad lat lng distancia_m hospital_id ubicacion_confirmada',
      medico: 'id nombre especialidades municipality_id lineas sedes',
      sedeDeMedico: 'id nombre cuenta_nombre distancia_m',
      contacto: 'id cuenta_id sede_id nombre cargo_texto rol',
      subtipo: 'id codigo nombre roles_sugeridos',
      compromiso: 'visita_id fecha con next_step_date',
      voz: 'transcribir proponer',
      visitas: 'fecha items',
      visitaItem:
        'id client_id tipo subtipo medico cuenta sede contacto modalidad medio efectiva failure_reason checked_in_at distance_m conclusion compromisos next_step_date lineas input_mode out_of_territory cuenta_para peso sede_por_confirmar editable agenda_id agendada',
      visitaCreate:
        'client_id tipo subtipo_id medico_id cuenta_id sede_id contacto_id modalidad medio efectiva failure_reason retry_date checked_in_at reported_at lat lng gps_accuracy_m conclusion compromisos next_step_date transcript input_mode lineas agenda_id',
      visitaCreateResponse: 'visita repetida',
      transcripcion: 'transcript duracion_s modelo',
      propuesta: 'visitas aviso',
      visitaPropuesta:
        'tipo subtipo_codigo subtipo_id medico_id medico_nombre_dicho sugerir_crear_medico cuenta_id sede_id contacto_id contacto_nombre_dicho lineas efectiva failure_reason conclusion compromisos next_step_date modalidad_sugerida confianza preguntas',
      numeros: 'mes cuota hechas cumplimiento dias_habiles_sin_visitas telefonicas no_efectivas fuera_de_territorio sede_por_confirmar agenda',
      // F4.1 (0840): agenda y dictado por campo (contrato, sección "F4.1"); ciclo de vida de la cita (0850, "F4.2")
      numerosAgenda: 'efectivas efectivas_agendadas porcentaje_agendadas citas_hasta_hoy citas_hechas citas_no_realizadas cumplimiento',
      cita:
        'id fecha hora tipo medico cuenta subtipo sede nota estado visita_id distancia_m dentro_del_radio anticipada cancelable motivo_codigo no_realizada_at no_realizada_motivo viene_de viene_de_fecha viene_de_estado sucesora_id como estado_visible',
      sedeCita: 'id nombre cuenta_id cuenta_nombre lat lng ubicacion_confirmada',
      agenda: 'desde hasta hoy max_fecha items',
      citaResponse: 'cita',
      citaCreate: 'fecha hora tipo medico_id cuenta_id subtipo_id sede_id nota como',
      citaCancelar: 'motivo motivo_codigo',
      citaCerrar: 'motivo_codigo motivo',
      citaOtraFecha: 'fecha hora sede_id nota como',
      citaEliminada: 'cita_id',
      campos: 'conclusion compromisos next_step_date',
    }
    for (const forma of Object.keys(CLAVES_API) as (keyof typeof CLAVES_API)[]) {
      const app = [...CLAVES_API[forma]].sort().join(' ')
      const contrato = CONTRATO[forma].split(' ').sort().join(' ')
      check(`${forma}: ${CLAVES_API[forma].length} claves, las del contrato`, app === contrato, { app, contrato })
    }
    check('tieneClaves detecta una clave de más o de menos', tieneClaves({ visitas: [], aviso: null }, 'propuesta') && !tieneClaves({ visitas: [] }, 'propuesta') && !tieneClaves({ visitas: [], aviso: null, extra: 1 }, 'propuesta'))
  }

  seccion('11. Agenda (F4.1): Reportar empieza por el sitio, la cita arma la visita, el dictado se añade y Agendar')
  {
    // Teléfono en la Clínica Portoazul (Puerto Colombia); Reina Catalina a ~9 km; una sede sin coordenadas.
    const TEL = { lat: 11.0156, lng: -74.8526 }
    const norte = (m: number) => ({ lat: Math.round((TEL.lat + m / 111_195) * 1e6) / 1e6, lng: TEL.lng })
    const S_PORTO = 'aaaaaaaa-0000-4000-8000-0000000000p1'
    const S_REINA = 'aaaaaaaa-0000-4000-8000-0000000000r1'
    const S_SINGPS = 'aaaaaaaa-0000-4000-8000-0000000000s1'
    const C_PORTO = 'cccccccc-0000-4000-8000-0000000000p1'
    const C_REINA = 'cccccccc-0000-4000-8000-0000000000r1'
    const M_PROPIO = 'dddddddd-0000-4000-8000-0000000000m1'
    const M_AJENO = 'dddddddd-0000-4000-8000-0000000000m2'
    const L1 = 'eeeeeeee-0000-4000-8000-0000000000l1'
    const L2 = 'eeeeeeee-0000-4000-8000-0000000000l2'
    const SUB_COMPRAS = 'ffffffff-0000-4000-8000-0000000000s1'
    const SUB_QUIMICO = 'ffffffff-0000-4000-8000-0000000000s2'
    const CONTACTO = '99999999-0000-4000-8000-0000000000c1'
    const HOY_A = '2026-10-14'
    const ahora = new Date('2026-10-14T15:00:00.000Z') // 10:00 en Bogotá
    const llegada = '2026-10-14T09:55:00.000-05:00'
    const porto = norte(80)
    const reina = norte(9000)
    let n = 0
    const nuevoId = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`
    const cita = (id: string, extra: Partial<CitaItem> = {}): CitaItem => ({
      id,
      fecha: HOY_A,
      hora: null,
      tipo: 'medica',
      medico: { id: M_PROPIO, nombre: 'Dr. Andrés Polo (prueba)' },
      cuenta: null,
      subtipo: null,
      sede: { id: S_PORTO, nombre: 'Clínica Portoazul', cuenta_id: C_PORTO, cuenta_nombre: 'Clínica Portoazul S.A.', ...porto, ubicacion_confirmada: true },
      nota: null,
      estado: 'pendiente',
      visita_id: null,
      distancia_m: null,
      dentro_del_radio: null,
      anticipada: true,
      cancelable: true,
      motivo_codigo: null, no_realizada_at: null, no_realizada_motivo: null, viene_de: null, viene_de_fecha: null, viene_de_estado: null, sucesora_id: null, como: 'ejecutivo', estado_visible: 'programada',
      ...extra,
    })
    const SEDE_REINA = { id: S_REINA, nombre: 'Clínica Reina Catalina', cuenta_id: C_REINA, cuenta_nombre: 'Clínica Reina Catalina', ...reina, ubicacion_confirmada: true }
    const citaPorto = cita('11111111-0000-4000-8000-0000000000a1', { hora: '10:00' })
    const citaPortoTemprano = cita('11111111-0000-4000-8000-0000000000a2', { hora: '08:00', medico: { id: M_PROPIO, nombre: 'Dr. Andrés Polo (prueba)' } })
    const citaReina = cita('11111111-0000-4000-8000-0000000000a3', { hora: '09:00', medico: { id: M_AJENO, nombre: 'Dra. Lucía Mejía (prueba)' }, sede: SEDE_REINA })
    const citaHecha = cita('11111111-0000-4000-8000-0000000000a4', { estado: 'hecha', visita_id: 'v-1', cancelable: false })
    const citaManana = cita('11111111-0000-4000-8000-0000000000a5', { fecha: '2026-10-15' })
    const citaSinGps = cita('11111111-0000-4000-8000-0000000000a6', { hora: '07:00', sede: { ...citaPorto.sede, id: S_SINGPS, nombre: 'Consultorio sin GPS', lat: null, lng: null } })
    const citaInst = cita('11111111-0000-4000-8000-0000000000a7', {
      hora: '11:00',
      tipo: 'institucional',
      medico: null,
      cuenta: { id: C_PORTO, nombre: 'Clínica Portoazul S.A.' },
      subtipo: { id: SUB_COMPRAS, codigo: 'compras', nombre: 'Compras' },
      anticipada: false,
    })
    const contexto: ContextoResponse = {
      ejecutiva: { id: 'e-carmen', nombre: 'Carmen Barrios', zona: 'Barranquilla', municipio: '08001', lineas: [{ id: L1, code: 'perossal', name: 'PerOssal' }, { id: L2, code: 'reemplazo', name: 'Reemplazo articular' }] },
      hoy: { fecha: HOY_A, meta: { medica: 6, institucional: 1 }, hechas: { medicas: 0, institucionales: 0, telefonicas: 0, no_efectivas: 0 }, cuota_dia_ok: false },
      config: { radio_m: 500, telefonica: { habilitada: true, tope_dia: 3, medios: ['llamada'] }, tope_visitas_medico_dia: 1, perfil: ['medica', 'institucional'] },
      sedes_cerca: [
        { id: S_PORTO, nombre: 'Clínica Portoazul', cuenta_id: C_PORTO, cuenta_nombre: 'Clínica Portoazul S.A.', cuenta_clase: 'clinica', ciudad: 'Puerto Colombia', ...porto, distancia_m: 80, hospital_id: null, ubicacion_confirmada: true },
      ],
      mis_medicos: [{ id: M_PROPIO, nombre: 'Dr. Andrés Polo (prueba)', especialidades: ['ortopedia'], municipality_id: '08573', lineas: [L1], sedes: [{ id: S_PORTO, nombre: 'Clínica Portoazul', cuenta_nombre: 'Clínica Portoazul S.A.', distancia_m: 80 }] }],
      contactos: [{ id: CONTACTO, cuenta_id: C_PORTO, sede_id: S_PORTO, nombre: 'Jefe de compras (prueba)', cargo_texto: '(prueba)', rol: 'compras' }],
      subtipos: [
        { id: SUB_COMPRAS, codigo: 'compras', nombre: 'Compras', roles_sugeridos: ['compras'] },
        { id: SUB_QUIMICO, codigo: 'quimico', nombre: 'Químico farmacéutico', roles_sugeridos: ['quimico'] },
      ],
      compromisos_vencidos: [],
      voz: { transcribir: true, proponer: true },
      agenda_hoy: [citaPorto, citaPortoTemprano, citaReina, citaHecha, citaSinGps, citaInst, cita('11111111-0000-4000-8000-0000000000a8', { estado: 'cancelada', sede: { ...SEDE_REINA, id: 'aaaaaaaa-0000-4000-8000-0000000000x9' } })],
      persona: { user_id: 'u-carmen', nombre: 'Carmen Barrios', executive_id: 'e-carmen', rol: 'ejecutivo', lineas: [{ id: L1, nombre: 'PerOssal', como: 'ejecutivo' }, { id: L2, nombre: 'Reemplazo articular', como: 'ejecutivo' }] },
    }
    const catalogo = catalogoDesdeContexto(contexto, {}, TEL)

    // --- Catálogo con la agenda ---
    const sedeReina = catalogo.sedes.find(x => x.id === S_REINA)
    check('catálogo: la sede de una cita lejana entra (con su distancia) y queda marcada de_agenda (no es de las cercanas)', !!sedeReina && sedeReina.de_agenda === true && Math.abs((sedeReina.distancia_m ?? 0) - 9000) <= 2, sedeReina)
    check('catálogo: la cercana del contexto NO queda marcada de_agenda', catalogo.sedes.find(x => x.id === S_PORTO)?.de_agenda === undefined)
    check('catálogo: la sede de una cita cancelada no entra', !catalogo.sedes.some(x => x.id === 'aaaaaaaa-0000-4000-8000-0000000000x9'))
    const ajeno = catalogo.medicos.find(m => m.id === M_AJENO)
    check('catálogo: el médico de una cita que no es de "mis médicos" entra fuera de su territorio, con la sede de la cita', !!ajeno && !ajeno.propio && ajeno.sedes.some(x => x.id === S_REINA))
    check('catálogo: el médico propio no se duplica', catalogo.medicos.filter(m => m.id === M_PROPIO).length === 1)
    const sinAgenda = catalogoDesdeContexto({ ...contexto, agenda_hoy: undefined as unknown as CitaItem[] }, {}, TEL)
    check('catálogo: un contexto guardado antes de la 0840 (sin agenda_hoy) sigue funcionando', sinAgenda.sedes.length === 1 && sinAgenda.medicos.length === 1)

    // --- Citas para Reportar ---
    const lista = citasParaReportar(contexto.agenda_hoy, TEL, 500, { hoy: HOY_A })
    check(
      'citas de Reportar: solo las pendientes de hoy (sin hecha, cancelada ni de mañana), la más cercana primero y las sin distancia al final',
      lista.map(x => x.id).join() === [citaPortoTemprano.id, citaPorto.id, citaInst.id, citaReina.id, citaSinGps.id].join(),
      lista.map(x => [x.hora, x.distancia_m])
    )
    check('citas de Reportar: a la misma distancia, por hora (08:00 antes que 10:00 y 11:00)', lista[0].hora === '08:00' && lista[1].hora === '10:00' && lista[2].hora === '11:00')
    check('citas de Reportar: distancia medida desde el punto de ahora y si está dentro del radio', Math.abs((lista[0].distancia_m ?? 0) - 80) <= 1 && lista[0].dentro_del_radio === true && lista[3].dentro_del_radio === false)
    check('citas de Reportar: la sede sin coordenadas no tiene distancia ni radio', lista[4].distancia_m === null && lista[4].dentro_del_radio === null)
    check('citas de Reportar: no ofrece la que ya se usó en este reporte', !citasParaReportar(contexto.agenda_hoy, TEL, 500, { hoy: HOY_A, usadas: [citaPorto.id] }).some(x => x.id === citaPorto.id))
    const sinPunto = citasParaReportar(contexto.agenda_hoy, null, 500, { hoy: HOY_A })
    check('citas de Reportar sin ubicación: sin distancias y por hora (sin hora al final)', sinPunto.every(x => x.distancia_m === null) && sinPunto.map(x => x.hora).join() === '07:00,08:00,09:00,10:00,11:00', sinPunto.map(x => x.hora))
    const guardadas = citasParaReportar([{ ...citaReina, distancia_m: 15, dentro_del_radio: true }], null, 500, { hoy: HOY_A, sinSenal: true })
    check('citas de Reportar sin señal y sin punto: la distancia guardada (de otro sitio) no se usa', guardadas[0].distancia_m === null && guardadas[0].dentro_del_radio === null)
    check('ordenarCitasPorDistancia: sin distancia al final aunque sea más temprano', ordenarCitasPorDistancia([{ ...citaPorto, distancia_m: null, hora: '06:00' }, { ...citaReina, distancia_m: 9000 }]).map(x => x.id).join() === `${citaReina.id},${citaPorto.id}`)

    // --- Borrador desde la cita ---
    const deCita = borradorDesdeCita(citaPorto, catalogo, { nuevoId })
    check('cita médica → tarjeta armada: tipo, médico, sede de la cita, su agenda_id y las líneas del médico', deCita.tipo === 'medica' && deCita.medico_id === M_PROPIO && deCita.sede_id === S_PORTO && deCita.agenda_id === citaPorto.id && deCita.lineas.join() === L1 && deCita.origen === 'toques', deCita)
    check('la tarjeta de la cita, a 80 m: lista para confirmar', validarBorrador(deCita, catalogo, { punto: TEL, checked_in_at: llegada, ahora }).ok, validarBorrador(deCita, catalogo, { punto: TEL, checked_in_at: llegada, ahora }).errores)
    const cuerpoCitaVisita = cuerpoDesdeBorrador(deCita, { punto: TEL, checked_in_at: llegada, reported_at: llegada, transcript: null })
    check('cuerpo de POST /api/me/visitas con agenda_id (y solo las claves del contrato)', cuerpoCitaVisita.agenda_id === citaPorto.id && tieneClaves(cuerpoCitaVisita, 'visitaCreate'), clavesDe(cuerpoCitaVisita))
    const deCitaVoz = borradorDesdeCita(citaPorto, catalogo, { nuevoId, origen: 'voz' })
    check('borradorDesdeCita respeta el origen pedido', deCitaVoz.origen === 'voz')
    const deCitaAjena = borradorDesdeCita(citaReina, catalogo, { nuevoId })
    const lejosDeReina = validarBorrador(deCitaAjena, catalogo, { punto: TEL, checked_in_at: llegada, ahora })
    check('cita con un médico que no es suyo, en una sede a 9 km: tarjeta armada, fuera de su territorio y bloqueada por el radio', deCitaAjena.medico_id === M_AJENO && deCitaAjena.sede_id === S_REINA && lejosDeReina.fuera_de_territorio && lejosDeReina.errores.some(e => e.campo === 'lat'), lejosDeReina.errores)
    const deInst = borradorDesdeCita(citaInst, catalogo, { nuevoId })
    check('cita institucional → cuenta, subtipo, sede y el único contacto de compras de la cuenta', deInst.tipo === 'institucional' && deInst.cuenta_id === C_PORTO && deInst.subtipo_id === SUB_COMPRAS && deInst.sede_id === S_PORTO && deInst.contacto_id === CONTACTO && deInst.agenda_id === citaInst.id, deInst)
    const cuerpoInst = cuerpoDesdeBorrador({ ...deInst, lineas: [L1] }, { punto: TEL, checked_in_at: llegada, reported_at: llegada, transcript: null })
    check('cuerpo institucional de la cita: cuenta, subtipo, contacto y agenda_id', cuerpoInst.tipo === 'institucional' && cuerpoInst.cuenta_id === C_PORTO && cuerpoInst.subtipo_id === SUB_COMPRAS && cuerpoInst.agenda_id === citaInst.id && tieneClaves(cuerpoInst, 'visitaCreate'))
    check('la visita no agendada (vacía o propuesta por la IA) va con agenda_id null', borradorVacio(catalogo, { nuevoId, sedeElegida: S_PORTO }).agenda_id === null && cuerpoDesdeBorrador(cambiarBorrador(borradorVacio(catalogo, { nuevoId, sedeElegida: S_PORTO }), { medico_id: M_PROPIO }, catalogo), { punto: TEL, checked_in_at: llegada, reported_at: llegada, transcript: null }).agenda_id === null)
    check('esVisitaDeLaCita: mismo médico sí; otro médico u otro tipo no', esVisitaDeLaCita(deCita, citaPorto) && !esVisitaDeLaCita(deCita, citaReina) && !esVisitaDeLaCita(deInst, citaPorto) && esVisitaDeLaCita(deInst, citaInst))

    // --- Cambiar la tarjeta suelta la cita si cambia con quién ---
    check('cambiar el médico suelta la cita (el servidor diría "Esa cita es con otro médico")', cambiarBorrador(deCita, { medico_id: M_AJENO }, catalogo).agenda_id === null)
    check('cambiar el tipo suelta la cita', cambiarBorrador(deCita, { tipo: 'institucional' }, catalogo).agenda_id === null)
    check('cambiar la cuenta de la institucional suelta la cita', cambiarBorrador(deInst, { cuenta_id: C_REINA }, catalogo).agenda_id === null)
    check(
      'cambiar la sede, el subtipo, el resultado o la conclusión NO suelta la cita (decisión 42)',
      cambiarBorrador(deCitaAjena, { sede_id: S_REINA }, catalogo).agenda_id === citaReina.id &&
        cambiarBorrador(deInst, { subtipo_id: SUB_QUIMICO }, catalogo).agenda_id === citaInst.id &&
        cambiarBorrador(deCita, { efectiva: false, failure_reason: 'No estaba' }, catalogo).agenda_id === citaPorto.id &&
        cambiarBorrador(deCita, { conclusion: 'Bien' }, catalogo).agenda_id === citaPorto.id
    )
    check('elegir otra vez el mismo médico no suelta la cita', cambiarBorrador(deCita, { medico_id: M_PROPIO }, catalogo).agenda_id === citaPorto.id)

    // --- Dictar con la cita elegida ---
    const propuesta: PropuestaResponse = {
      aviso: null,
      visitas: [
        { tipo: 'medica', subtipo_codigo: null, subtipo_id: null, medico_id: M_AJENO, medico_nombre_dicho: null, sugerir_crear_medico: false, cuenta_id: null, sede_id: S_REINA, contacto_id: null, contacto_nombre_dicho: null, lineas: [L2], efectiva: true, failure_reason: null, conclusion: 'Otra', compromisos: null, next_step_date: null, modalidad_sugerida: 'presencial', confianza: 0.9, preguntas: [] },
        { tipo: 'medica', subtipo_codigo: null, subtipo_id: null, medico_id: M_PROPIO, medico_nombre_dicho: null, sugerir_crear_medico: false, cuenta_id: null, sede_id: S_PORTO, contacto_id: null, contacto_nombre_dicho: null, lineas: [L1], efectiva: true, failure_reason: null, conclusion: 'Le gustó el canulado', compromisos: 'Enviar muestra', next_step_date: null, modalidad_sugerida: 'presencial', confianza: 0.9, preguntas: [] },
      ],
    }
    const tarjetas = aplicarCitaAPropuestas(borradoresDesdePropuesta(propuesta, catalogo, { nuevoId, sedeElegida: S_PORTO }), citaPorto, catalogo)
    check('IA (proponer con cita_id): la tarjeta que es la visita de la cita lleva su agenda_id; la otra no (la base vincula sola)', tarjetas[0].agenda_id === null && tarjetas[1].agenda_id === citaPorto.id, tarjetas.map(t => [t.medico_id, t.agenda_id]))
    check('IA: los ids del médico y la sede de la cita se aceptan aunque el médico no sea de "mis médicos" (decisión 51)', tarjetas[0].medico_id === M_AJENO && tarjetas[0].sede_id === S_REINA)
    const huerfana: PropuestaResponse = { aviso: null, visitas: [{ ...propuesta.visitas[1], medico_id: null, sede_id: null, lineas: [] }] }
    const completada = aplicarCitaAPropuestas(borradoresDesdePropuesta(huerfana, catalogo, { nuevoId }), citaPorto, catalogo)
    check('IA: una sola tarjeta médica sin médico ni nombre dicho → es la de la cita (médico, sede, líneas y agenda_id)', completada[0].medico_id === M_PROPIO && completada[0].sede_id === S_PORTO && completada[0].agenda_id === citaPorto.id && completada[0].lineas.join() === L1 && completada[0].conclusion === 'Le gustó el canulado', completada[0])
    const conNombre: PropuestaResponse = { aviso: null, visitas: [{ ...huerfana.visitas[0], medico_nombre_dicho: 'Dr. Ramírez', sugerir_crear_medico: true }] }
    check('IA: si dijo OTRO nombre que no cruzó, no se le pone el médico de la cita', aplicarCitaAPropuestas(borradoresDesdePropuesta(conNombre, catalogo, { nuevoId }), citaPorto, catalogo)[0].agenda_id === null)
    const dosHuerfanas: PropuestaResponse = { aviso: null, visitas: [huerfana.visitas[0], { ...huerfana.visitas[0], conclusion: 'otra' }] }
    check('IA: con dos tarjetas sin médico no se adivina cuál es la de la cita', aplicarCitaAPropuestas(borradoresDesdePropuesta(dosHuerfanas, catalogo, { nuevoId }), citaPorto, catalogo).every(t => t.agenda_id === null))
    const instHuerfana: PropuestaResponse = { aviso: null, visitas: [{ ...propuesta.visitas[1], tipo: 'institucional', medico_id: null, cuenta_id: null, sede_id: null, subtipo_codigo: null }] }
    const instCompletada = aplicarCitaAPropuestas(borradoresDesdePropuesta(instHuerfana, catalogo, { nuevoId }), citaInst, catalogo)[0]
    check('IA: una sola institucional sin cuenta → la cuenta, el subtipo y la sede de la cita', instCompletada.cuenta_id === C_PORTO && instCompletada.subtipo_id === SUB_COMPRAS && instCompletada.sede_id === S_PORTO && instCompletada.agenda_id === citaInst.id, instCompletada)

    // --- Rechazo por la cita ---
    check('los 7 mensajes del vínculo se reconocen como rechazo de la cita', MENSAJES_RECHAZO_CITA.length === 7 && MENSAJES_RECHAZO_CITA.every(m => esRechazoDeCita(m) && interpretarRechazo({ message: m }).clase === 'cita'))
    check('un rechazo que no es de la cita no se confunde', !esRechazoDeCita(MENSAJE_TOPE_MEDICO) && interpretarRechazo({ message: MENSAJE_TOPE_MEDICO }).clase === 'tope_medico' && !esRechazoDeCita(null))
    check('el texto del rechazo de la cita dice que se confirma como no agendada', textoRechazoCita('Esa cita ya tiene su visita').startsWith('Esa cita ya tiene su visita.') && textoRechazoCita('x').includes('no agendada'))
    const deNuevo = borradorDesdeCuerpo(cuerpoCitaVisita, catalogo, { nuevoId })
    check('reportar de nuevo desde la cola: conserva la cita', deNuevo.agenda_id === citaPorto.id)
    check('reportar de nuevo tras un rechazo POR la cita: va sin ella', borradorDesdeCuerpo(cuerpoCitaVisita, catalogo, { nuevoId, motivo: 'Esa cita ya tiene su visita' }).agenda_id === null)
    const viejo = { ...cuerpoCitaVisita } as Partial<VisitaCreate>
    delete viejo.agenda_id
    check('un cuerpo guardado en la cola antes de la agenda (sin agenda_id) → sin cita', borradorDesdeCuerpo(viejo as VisitaCreate, catalogo, { nuevoId }).agenda_id === null)

    // --- Dictar un campo: se AÑADE, nunca se borra ---
    const vacios = { conclusion: '', compromisos: '', next_step_date: '' }
    const dictado = { conclusion: 'Le presenté PerOssal; quedó interesado.', compromisos: 'Enviarle la ficha técnica el jueves.', next_step_date: '2026-10-21' }
    const primera = unirCamposDictados(vacios, dictado, HOY_A)
    check('dictar con los campos vacíos: llena conclusión, compromisos y próxima reunión', primera.conclusion === dictado.conclusion && primera.compromisos === dictado.compromisos && primera.next_step_date === '2026-10-21' && primera.agregados.join() === 'conclusion,compromisos,next_step_date')
    const escrito = { conclusion: 'Lo vi en consulta.  ', compromisos: 'Llamar a compras', next_step_date: '2026-10-30' }
    const segunda = unirCamposDictados(escrito, dictado, HOY_A)
    check('dictar con texto escrito: lo añade en una línea nueva sin borrar lo que había', segunda.conclusion === `Lo vi en consulta.\n${dictado.conclusion}` && segunda.compromisos === `Llamar a compras\n${dictado.compromisos}`, segunda)
    check('la próxima reunión ya escrita no se cambia', segunda.next_step_date === '2026-10-30' && !segunda.agregados.includes('next_step_date'))
    check('lo que ya estaba igual no se repite (dictar dos veces lo mismo)', unirCamposDictados(primera, dictado, HOY_A).conclusion === dictado.conclusion && unirCamposDictados(primera, dictado, HOY_A).agregados.length === 0)
    check('una próxima reunión de ayer o que no es fecha no se pone', unirCamposDictados(vacios, { ...dictado, next_step_date: '2026-10-13' }, HOY_A).next_step_date === '' && unirCamposDictados(vacios, { ...dictado, next_step_date: 'jueves' }, HOY_A).next_step_date === '')
    check('campos dictados vacíos (null) no tocan nada', JSON.stringify(unirCamposDictados(escrito, { conclusion: null, compromisos: '  ', next_step_date: null }, HOY_A)) === JSON.stringify({ ...escrito, agregados: [], recortado: false }))
    const largo = unirCamposDictados({ ...vacios, conclusion: 'x'.repeat(1990) }, { conclusion: 'y'.repeat(50), compromisos: null, next_step_date: null }, HOY_A)
    check('si al añadir se pasa de 2.000 caracteres, se recorta el final y se avisa', largo.conclusion.length === 2000 && largo.recortado && largo.conclusion.startsWith('x'.repeat(1990)) && textoResultadoDictado(largo).includes('recortó'))
    check('textoResultadoDictado nombra dónde quedó', textoResultadoDictado(primera) === 'Agregué lo que dijiste en conclusión, compromisos y próxima reunión. Revísalo antes de confirmar.' && textoResultadoDictado({ agregados: [], recortado: false }).startsWith('No encontré'))
    check('dictado sin llave (503) o sin la ruta (404): "El dictado no está disponible; escribe la conclusión"', mensajeErrorDictado(503, 'x') === MENSAJE_DICTADO_NO_DISPONIBLE && mensajeErrorDictado(404, 'x') === MENSAJE_DICTADO_NO_DISPONIBLE && MENSAJE_DICTADO_NO_DISPONIBLE === 'El dictado no está disponible; escribe la conclusión')
    check('otros fallos del dictado (429, 502, sin señal) muestran el mensaje del servidor', mensajeErrorDictado(429, 'Demasiados dictados seguidos') === 'Demasiados dictados seguidos' && mensajeErrorDictado(0, 'Sin conexión') === 'Sin conexión')

    // --- Agendar: ventana, forma y cuerpo de POST /api/me/agenda ---
    const vacio = formularioCitaVacio(HOY_A, ['medica', 'institucional'])
    check('formulario nuevo: hoy, sin hora, médica primero', vacio.fecha === HOY_A && vacio.hora === '' && vacio.tipo === 'medica' && formularioCitaVacio(HOY_A, ['institucional']).tipo === 'institucional' && formularioCitaVacio(HOY_A, []).tipo === null)
    // 0850 (A4): sin tope hacia adelante (antes, de hoy a hoy + 30).
    const completa: FormularioCita = { ...vacio, medico_id: M_PROPIO, sede_id: S_PORTO, hora: '9:30', nota: '  Llevar muestras  ' }
    check('cita médica completa: sin errores', validarCita(completa, HOY_A, ['medica', 'institucional']).length === 0)
    const errores = (f: Partial<FormularioCita>) => validarCita({ ...completa, ...f }, HOY_A, ['medica', 'institucional'])
    check('ayer: el mismo mensaje del servidor', errores({ fecha: '2026-10-13' }).some(e => e.campo === 'fecha' && e.mensaje === MENSAJE_CITA_PASADA))
    check('sin tope hacia adelante (0850, A4): a 31 días y a 400 días, sin errores', errores({ fecha: '2026-11-14' }).length === 0 && errores({ fecha: '2027-11-18' }).length === 0)
    check('hora no válida: el mensaje del servidor; "9:30" vale como 09:30 y vacía es sin hora', errores({ hora: '25:00' }).some(e => e.campo === 'hora' && e.mensaje === MENSAJE_HORA_CITA) && horaDeCita('9:30') === '09:30' && horaDeCita('') === null && horaDeCita('07.45') === '07:45' && horaDeCita('10:60') === undefined)
    check('médica sin médico, sin sede: los dos errores a la vez', errores({ medico_id: null, sede_id: null }).map(e => e.campo).join() === 'medico_id,sede_id')
    check('institucional sin cuenta ni subtipo: los mensajes del servidor', validarCita({ ...completa, tipo: 'institucional', medico_id: null }, HOY_A).map(e => e.mensaje).join(' | ') === 'Elige la cuenta | Elige el subtipo de la visita institucional')
    check('tipo fuera del perfil: el mensaje del perfil', errores({}).length === 0 && validarCita(completa, HOY_A, ['institucional']).some(e => e.campo === 'tipo' && e.mensaje === mensajePerfil('medica')))
    check('nota de más de 300: rechazada', errores({ nota: 'x'.repeat(301) }).some(e => e.campo === 'nota'))
    const cuerpo = cuerpoCita(completa)
    check('cuerpo médico de POST /api/me/agenda: las claves del contrato, hora normalizada, nota limpia, cuenta y subtipo null y sin "como" (null)', tieneClaves(cuerpo, 'citaCreate') && cuerpo.hora === '09:30' && cuerpo.nota === 'Llevar muestras' && cuerpo.cuenta_id === null && cuerpo.subtipo_id === null && cuerpo.medico_id === M_PROPIO && cuerpo.como === null, cuerpo)
    check('cuerpo con "como qué" (C12): el que eligió quien tiene los dos papeles', cuerpoCita({ ...completa, como: 'lider' }).como === 'lider')
    const cuerpoI = cuerpoCita({ ...completa, tipo: 'institucional', medico_id: null, cuenta_id: C_PORTO, subtipo_id: SUB_COMPRAS, hora: '', nota: '' })
    check('cuerpo institucional: cuenta y subtipo, médico null, sin hora ni nota', tieneClaves(cuerpoI, 'citaCreate') && cuerpoI.tipo === 'institucional' && cuerpoI.medico_id === null && cuerpoI.cuenta_id === C_PORTO && cuerpoI.hora === null && cuerpoI.nota === null)
    check('cuerpoCita lanza si falta algo', (() => { try { cuerpoCita({ ...completa, sede_id: null }); return false } catch { return true } })())
    check('cambiar el tipo limpia el médico, la cuenta, el subtipo y la sede', JSON.stringify(cambiarFormularioCita(completa, { tipo: 'institucional' })) === JSON.stringify({ ...completa, tipo: 'institucional', medico_id: null, cuenta_id: null, subtipo_id: null, sede_id: null }))
    check('cambiar el médico limpia la sede (salvo que venga con la nueva)', cambiarFormularioCita(completa, { medico_id: M_AJENO }).sede_id === null && cambiarFormularioCita(completa, { medico_id: M_AJENO, sede_id: S_REINA }).sede_id === S_REINA && cambiarFormularioCita(completa, { hora: '10:00' }).sede_id === S_PORTO)

    // --- Textos de la agenda ---
    check('conQuienCita: médica e institucional (sin documentos)', conQuienCita(citaPorto) === 'Dr. Andrés Polo (prueba)' && conQuienCita(citaInst) === 'Clínica Portoazul S.A. · Compras')
    check('textoHoraCita: hora o "Sin hora"', textoHoraCita('08:00') === '08:00' && textoHoraCita(null) === 'Sin hora')
    check(
      'cuentaDistinta: la cuenta junto a la sede solo si dice algo más',
      cuentaDistinta('Clínica Portoazul', 'Clínica Portoazul S.A.S.') === null &&
        cuentaDistinta('Portoazul Torre Médica', 'Clínica Portoazul S.A.S.') === 'Clínica Portoazul S.A.S.' &&
        cuentaDistinta('Clinica Norte', 'CLÍNICA NORTE') === null &&
        cuentaDistinta('Sede', null) === null
    )
    const dias = agruparCitasPorDia([citaPorto, citaManana, citaPortoTemprano, cita('x-sinhora', { hora: null })], HOY_A, '2026-10-21')
    check('agenda por día: los 8 días (hoy a hoy + 7), también los vacíos', dias.length === 8 && dias[0].fecha === HOY_A && dias[7].fecha === '2026-10-21' && dias[2].citas.length === 0)
    check('agenda por día: cada día por hora y las sin hora al final', dias[0].citas.map(x => x.hora ?? 'sin').join() === '08:00,10:00,sin' && dias[1].citas.length === 1)
    check('títulos de los días: Hoy, Mañana y la fecha larga con mayúscula', tituloDiaAgenda(HOY_A, HOY_A) === 'Hoy · miércoles 14 de octubre' && tituloDiaAgenda('2026-10-15', HOY_A) === 'Mañana · jueves 15 de octubre' && tituloDiaAgenda('2026-10-16', HOY_A) === 'Viernes 16 de octubre', [tituloDiaAgenda(HOY_A, HOY_A), tituloDiaAgenda('2026-10-16', HOY_A)])

    // --- Mi agenda: la cancelada se sigue viendo (no se borra) y no suma al total ---
    check('total de Mi agenda: cuenta pendientes y hechas', textoTotalAgenda([citaPorto, citaHecha]) === '2 citas' && textoTotalAgenda([citaPorto]) === '1 cita' && textoTotalAgenda([]) === '0 citas')
    check('total de Mi agenda: la cancelada se muestra aparte ("· 1 cancelada")', textoTotalAgenda([citaPorto, cita('x-c1', { estado: 'cancelada' })]) === '1 cita · 1 cancelada' && textoTotalAgenda([cita('x-c1', { estado: 'cancelada' }), cita('x-c2', { estado: 'cancelada' })]) === '0 citas · 2 canceladas')
    check(
      'total de Mi agenda (0850): la que no se hizo también aparte ("· 1 no se hizo", "· 2 no se hicieron")',
      textoTotalAgenda([citaPorto, citaHecha, cita('x-n1', { estado: 'no_realizada' })]) === '2 citas · 1 no se hizo' &&
        textoTotalAgenda([cita('x-c1', { estado: 'cancelada' }), cita('x-n1', { estado: 'no_realizada' }), cita('x-n2', { estado: 'no_realizada' })]) === '0 citas · 1 cancelada · 2 no se hicieron'
    )
    const pantallaAgenda = readFileSync(path.resolve(__dirname, '../app/(app)/agenda.tsx'), 'utf8')
    check('Mi agenda pide las canceladas (la confirmación promete "Queda en tu agenda como cancelada")', /api\.agenda\([^)]*,\s*true\)/.test(pantallaAgenda) && pantallaAgenda.includes('Queda en tu agenda como cancelada'))

    // --- Reportar: sin cita ni sede elegida no se graba ni se llena por toques ---
    check('hayEleccion: con una cita sí', hayEleccion({ cita: citaPorto, sedeId: null, catalogo }))
    check('hayEleccion: con una sede del catálogo sí', hayEleccion({ cita: null, sedeId: S_PORTO, catalogo }))
    check('hayEleccion: sin cita ni sede, no', !hayEleccion({ cita: null, sedeId: null, catalogo }))
    check('hayEleccion: con una sede que no está en el catálogo, no (p. ej. tras "Elegir otra cita o una sede")', !hayEleccion({ cita: null, sedeId: 'sede-que-no-esta', catalogo }) && !hayEleccion({ cita: null, sedeId: S_PORTO, catalogo: null }))
    const pantallaReportar = readFileSync(path.resolve(__dirname, '../app/(app)/reportar.tsx'), 'utf8')
    check('Reportar: porToques no abre tarjeta sin elección', /const porToques = \(\) => \{\s*if \(!catalogo \|\| !eligio\) return/.test(pantallaReportar))
    check('Reportar: el aviso de la voz que falló solo ofrece "Reportar por toques" con elección', /accion=\{eligio \? <Boton titulo="Reportar por toques"/.test(pantallaReportar))
    check('Reportar: "Elegir otra cita o una sede" quita el aviso de la voz', /const cambiarEleccion = \(\) => \{[^}]*setErrorVoz\(null\)/.test(pantallaReportar))
  }

  seccion('12. Marca VG Medical: nombre, pantalla de inicio y textos (spec F4.1)')
  {
    const raiz = path.resolve(__dirname, '..')
    const app = JSON.parse(readFileSync(path.join(raiz, 'app.json'), 'utf8')).expo as Record<string, unknown>
    check('app.json: el nombre visible es "VG Visitas"', app.name === 'VG Visitas')
    check('app.json: sin la clave raíz "splash" (no existe en el esquema de SDK 57; la ignoraría el build)', !('splash' in app))
    const plugins = (app.plugins ?? []) as unknown[]
    const splash = plugins.find(p => Array.isArray(p) && p[0] === 'expo-splash-screen') as [string, Record<string, unknown>] | undefined
    check('app.json: la pantalla de inicio va por el plugin expo-splash-screen, sobre negro', !!splash && splash[1].backgroundColor === '#000000' && typeof splash[1].image === 'string' && typeof splash[1].imageWidth === 'number', splash)
    const imagen = splash ? path.join(raiz, String(splash[1].image)) : ''
    const png = imagen && existsSync(imagen) ? readFileSync(imagen) : null
    const ancho = png ? png.readUInt32BE(16) : 0
    const alto = png ? png.readUInt32BE(20) : 0
    check('la imagen de inicio existe y es cuadrada (el símbolo "vg", no el logotipo ancho)', !!png && ancho === alto && ancho >= 512, { ancho, alto })
    const paquete = JSON.parse(readFileSync(path.join(raiz, 'package.json'), 'utf8')) as { dependencies: Record<string, string> }
    const incluidos = JSON.parse(readFileSync(path.join(raiz, 'node_modules/expo/bundledNativeModules.json'), 'utf8')) as Record<string, string>
    const nativos = Object.keys(paquete.dependencies).filter(nombre => nombre.startsWith('expo-'))
    check('Expo Go: todo expo-* de package.json viene en Expo Go (bundledNativeModules), también expo-splash-screen', nativos.includes('expo-splash-screen') && nativos.every(nombre => nombre in incluidos), nativos.filter(nombre => !(nombre in incluidos)))
    const archivos: string[] = []
    const recorrer = (dir: string) => {
      for (const nombre of readdirSync(dir)) {
        const ruta = path.join(dir, nombre)
        if (statSync(ruta).isDirectory()) recorrer(ruta)
        else if (/\.(tsx?|json|md)$/.test(nombre)) archivos.push(ruta)
      }
    }
    for (const dir of ['app', 'components', 'lib']) recorrer(path.join(raiz, dir))
    archivos.push(path.join(raiz, 'app.json'), path.join(raiz, 'README.md'))
    const prohibidos = archivos.filter(ruta => /OpMap Visitas|\bKAM\b|representante|\bpanel\b/i.test(readFileSync(ruta, 'utf8')))
    check('no queda "OpMap Visitas", "KAM", "representante" ni "panel" en app/, components/, lib/, app.json ni README.md', prohibidos.length === 0, prohibidos.map(ruta => path.relative(raiz, ruta)))
    // Spec 2026-10-15 (integración): "data manager" no sale en ningún texto visible ("el equipo de datos"). Los
    // comentarios no se ven: se quitan antes de buscar (el código del rol, data_manager, sí puede quedar).
    const sinComentarios = (texto: string) => texto.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/\s.*$/gm, '')
    const conDataManager = archivos
      .filter(ruta => /\.tsx?$/.test(ruta))
      .filter(ruta => /data manager/i.test(sinComentarios(readFileSync(ruta, 'utf8'))))
    check('ningún texto visible de app/, components/ ni lib/ dice "data manager" (dice "el equipo de datos")', conDataManager.length === 0, conDataManager.map(ruta => path.relative(raiz, ruta)))
  }

  // -------------------------------------------------------------------------
  seccion('13. Subir el audio: la parte que acepta el fetch de Expo (SDK 57)')
  {
    check('m4a por defecto (iPhone y Android)', JSON.stringify(tipoAudio('file:///cache/rec-1.m4a')) === JSON.stringify({ tipo: 'audio/m4a', nombre: 'dictado.m4a' }))
    check('webm, mp4 y aac por extensión; la consulta (?…) no cuenta', tipoAudio('blob:x.webm').tipo === 'audio/webm' && tipoAudio('file:///a.MP4').tipo === 'audio/mp4' && tipoAudio('file:///a.aac?v=1').nombre === 'dictado.aac')

    let lecturas = 0
    const audio = new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112, 77, 52, 65, 32])
    const parte = parteAudio('file:///cache/rec-1.m4a', async () => {
      lecturas++
      return audio
    })
    check('armar la parte no lee el archivo (se lee al enviar)', lecturas === 0)
    check('la parte no lleva uri (el fetch de Expo la rechaza)', !('uri' in parte) && parte.name === 'dictado.m4a' && parte.type === 'audio/m4a')

    // El convertidor real de Expo (el que dio "Unsupported FormDataPart implementation" en el teléfono), con un
    // FormData mínimo como el de React Native ya parchado por Expo: entries() devuelve [nombre, valor].
    type Convertir = (formulario: unknown, boundary?: string) => Promise<{ body: Uint8Array; boundary: string }>
    const { convertFormDataAsync } = require(path.resolve(__dirname, '../node_modules/expo/src/winter/fetch/convertFormData.ts')) as { convertFormDataAsync: Convertir }
    const formularioDe = (partes: [string, unknown][]) => ({ entries: () => partes })

    let errorViejo = ''
    try {
      await convertFormDataAsync(formularioDe([['audio', { uri: 'file:///cache/rec-1.m4a', name: 'dictado.m4a', type: 'audio/m4a' }]]))
    } catch (error) {
      errorViejo = error instanceof Error ? error.message : String(error)
    }
    check('la forma vieja { uri, name, type } falla como en el teléfono', errorViejo === 'Unsupported FormDataPart implementation', errorViejo)

    const { body, boundary } = await convertFormDataAsync(formularioDe([['audio', parte], ['duracion_s', '12']]), 'LimiteDePrueba')
    check('la parte nueva se convierte y lee el archivo una vez', lecturas === 1 && body.length > audio.length)

    // El servidor lee el multipart con request.formData(): se lee igual aquí (Response de Node).
    interface ArchivoLeido {
      name: string
      type: string
      size: number
      arrayBuffer(): Promise<ArrayBuffer>
    }
    interface FormularioLeido {
      get(nombre: string): unknown
    }
    const RespuestaNode = (globalThis as unknown as { Response: new (cuerpo: Uint8Array, init: { headers: Record<string, string> }) => { formData(): Promise<FormularioLeido> } }).Response
    const leido = await new RespuestaNode(body, { headers: { 'content-type': `multipart/form-data; boundary=${boundary}` } }).formData()
    const archivo = leido.get('audio') as ArchivoLeido | null
    const bytesLeidos = archivo ? new Uint8Array(await archivo.arrayBuffer()) : new Uint8Array()
    check('el servidor recibe dictado.m4a con tipo audio/m4a', archivo?.name === 'dictado.m4a' && archivo?.type === 'audio/m4a', archivo && { name: archivo.name, type: archivo.type })
    check('y los mismos bytes del archivo', bytesLeidos.length === audio.length && bytesLeidos.every((byte, i) => byte === audio[i]))
    check('duracion_s llega como texto', leido.get('duracion_s') === '12')

    const api = readFileSync(path.resolve(__dirname, '../lib/api.ts'), 'utf8')
    check('lib/api.ts sube el audio con parteAudio y bytes(), sin { uri, name, type }', /parteAudio\(uri, \(\) => archivo\.bytes\(\)\)/.test(api) && !/\{ uri, name:/.test(api))
  }

  // -------------------------------------------------------------------------
  seccion('14. Ubicación en dos pasos (Reportar no espera el GPS para mostrar la lista)')
  {
    const AHORA = Date.parse('2026-10-14T15:00:00.000Z')
    const nunca = <T,>() => new Promise<T>(() => undefined)
    const demora = <T,>(ms: number, valor: T) => new Promise<T>(resolve => setTimeout(() => resolve(valor), ms))
    const lectura = (extra: Partial<Lectura> = {}): Lectura => ({ lat: 4.6097104, lng: -74.0817503, precision: 12.4, timestamp: AHORA - 1_000, ...extra })
    interface Llamadas {
      permiso: number
      precisa: number
      rapida: number
      ultima: number[]
    }
    const fuentesFalsas = (f: Partial<FuentesUbicacion> = {}): FuentesUbicacion & { llamadas: Llamadas } => {
      const llamadas: Llamadas = { permiso: 0, precisa: 0, rapida: 0, ultima: [] }
      return {
        llamadas,
        permiso: () => {
          llamadas.permiso++
          return f.permiso ? f.permiso() : Promise.resolve(true)
        },
        precisa: () => {
          llamadas.precisa++
          return f.precisa ? f.precisa() : Promise.resolve(lectura())
        },
        rapida: () => {
          llamadas.rapida++
          return f.rapida ? f.rapida() : nunca<Lectura>()
        },
        ultima: edad => {
          llamadas.ultima.push(edad)
          return f.ultima ? f.ultima(edad) : Promise.resolve(null)
        },
        ahora: () => AHORA,
        rapidasPropias: f.rapidasPropias,
      }
    }

    // La final: la regla de siempre (alta precisión con tiempo máximo; si no, la última de < 2 min, aproximada).
    check('la edad máxima de la última conocida sigue en 2 minutos (no se afloja)', EDAD_MAXIMA_ULTIMA_MS === 120_000)
    const conFix = await ubicacionFinal(fuentesFalsas(), { timeoutMs: 50 })
    check(
      'final: la lectura precisa, con 6 decimales y precisión entera, no aproximada',
      conFix.error === null && conFix.ubicacion?.lat === 4.60971 && conFix.ubicacion?.lng === -74.08175 && conFix.ubicacion?.precision === 12 && conFix.ubicacion?.aproximada === false,
      conFix
    )
    const sinFixF = fuentesFalsas({ precisa: () => nunca(), ultima: () => Promise.resolve(lectura({ timestamp: AHORA - 90_000, precision: 65 })) })
    const sinFix = await ubicacionFinal(sinFixF, { timeoutMs: 30 })
    check('final: sin lectura precisa a tiempo, la última de hace 90 s (aproximada), pedida con 2 minutos', sinFix.ubicacion?.aproximada === true && sinFix.ubicacion?.precision === 65 && sinFixF.llamadas.ultima[0] === 120_000, { sinFix, llamadas: sinFixF.llamadas })
    const vieja = await ubicacionFinal(fuentesFalsas({ precisa: () => nunca(), ultima: () => Promise.resolve(lectura({ timestamp: AHORA - 150_000 })) }), { timeoutMs: 30 })
    check('final: una última de hace 2 min 30 s no sirve (aunque la plataforma la devuelva): sin ubicación', vieja.ubicacion === null && vieja.error === MENSAJE_SIN_UBICACION, vieja)
    const rara = await ubicacionFinal(fuentesFalsas({ precisa: () => Promise.resolve(lectura({ lat: Number.NaN })), ultima: () => Promise.resolve(null) }), { timeoutMs: 30 })
    check('final: coordenadas que no son un punto no se usan', rara.ubicacion === null && rara.error === MENSAJE_SIN_UBICACION)
    const sinPermisoF = fuentesFalsas({ permiso: () => Promise.resolve(false) })
    const sinPermiso = await ubicacionFinal(sinPermisoF, { timeoutMs: 30 })
    check('final: sin permiso, el mensaje del permiso y no se lee el GPS', sinPermiso.error === MENSAJE_SIN_PERMISO_UBICACION && sinPermisoF.llamadas.precisa === 0)
    const fallaPermiso = await ubicacionFinal(fuentesFalsas({ permiso: () => Promise.reject(new Error('x')) }), { timeoutMs: 30 })
    check('final: nunca lanza (si el permiso falla, "no se pudo tomar la ubicación")', fallaPermiso.error === MENSAJE_SIN_UBICACION)
    check('aUbicacion: sin timestamp usa la hora de ahora (ISO de Bogotá)', aUbicacion(lectura({ timestamp: 0 }), false, AHORA)?.tomada_at === '2026-10-14T10:00:00.000-05:00')

    // Dos pasos: la primera para mostrar ya; la final para la visita.
    {
      const f = fuentesFalsas({ precisa: () => demora(80, lectura({ lat: 4.611, precision: 9 })), ultima: () => Promise.resolve(lectura({ timestamp: AHORA - 20_000, precision: 65 })) })
      const pasos = ubicacionEnDosPasos(f, { timeoutMs: 500 })
      let finalLista = false
      void pasos.final.then(() => (finalLista = true))
      const primera = await pasos.primera
      check(
        'dos pasos: con una última de hace 20 s, la primera es esa (aproximada) y llega antes que la final',
        primera.esFinal === false && primera.resultado.ubicacion?.precision === 65 && primera.resultado.ubicacion.aproximada && !finalLista,
        primera
      )
      const final = await pasos.final
      check('dos pasos: la final es la lectura precisa (no aproximada)', final.ubicacion?.precision === 9 && final.ubicacion.aproximada === false && final.ubicacion.lat === 4.611)
      check('dos pasos: el permiso se pide una sola vez', f.llamadas.permiso === 1, f.llamadas)
    }
    {
      const f = fuentesFalsas({ precisa: () => demora(80, lectura({ precision: 8 })), rapida: () => demora(5, lectura({ precision: 70 })) })
      const pasos = ubicacionEnDosPasos(f, { timeoutMs: 500 })
      const primera = await pasos.primera
      check('dos pasos: sin última conocida, la lectura rápida (nueva, no aproximada)', primera.esFinal === false && primera.resultado.ubicacion?.precision === 70 && primera.resultado.ubicacion.aproximada === false, primera)
      check('dos pasos: y la final sigue siendo la precisa', (await pasos.final).ubicacion?.precision === 8)
    }
    {
      const pasos = ubicacionEnDosPasos(fuentesFalsas({ precisa: () => demora(5, lectura({ precision: 6 })), rapida: () => demora(60, lectura({ precision: 70 })) }), { timeoutMs: 500 })
      const primera = await pasos.primera
      check('dos pasos: si la precisa llega antes que la rápida, la primera ya es la final', primera.esFinal === true && primera.resultado.ubicacion?.precision === 6, primera)
    }
    {
      const pasos = ubicacionEnDosPasos(fuentesFalsas({ precisa: () => demora(20, lectura({ precision: 6 })), rapida: () => Promise.reject(new Error('sin wifi')) }), { timeoutMs: 500 })
      const primera = await pasos.primera
      check('dos pasos: si la rápida falla, se espera la final', primera.esFinal === true && primera.resultado.ubicacion?.precision === 6, primera)
    }
    {
      const f = fuentesFalsas({ precisa: () => nunca(), rapida: () => nunca(), ultima: () => Promise.resolve(null) })
      const pasos = ubicacionEnDosPasos(f, { timeoutMs: 30 })
      const primera = await pasos.primera
      check('dos pasos: sin nada a tiempo, la primera es el error de la final ("no se pudo tomar")', primera.esFinal === true && primera.resultado.ubicacion === null && primera.resultado.error === MENSAJE_SIN_UBICACION, primera)
    }
    {
      const f = fuentesFalsas({ permiso: () => Promise.resolve(false) })
      const primera = await ubicacionEnDosPasos(f, { timeoutMs: 30 }).primera
      check('dos pasos: sin permiso, el aviso del permiso y nada se lee', primera.esFinal && primera.resultado.error === MENSAJE_SIN_PERMISO_UBICACION && f.llamadas.precisa === 0 && f.llamadas.rapida === 0 && f.llamadas.ultima.length === 0, f.llamadas)
    }

    // ¿Volver a pedir el contexto con el punto final?
    const base = { lat: 4.6097, lng: -74.0817 }
    const a50 = { lat: base.lat + 50 / 111_320, lng: base.lng }
    const a150 = { lat: base.lat + 150 / 111_320, lng: base.lng }
    // La lectura rápida de la propia app (que queda en el caché del sistema como "última conocida") no sirve de respaldo
    // a la final ni a pedirUbicacion (Nueva sede): sin dos pasos ese caso terminaba sin punto, y así sigue.
    {
      const registro = registroDeRapidas(2)
      const a = lectura({ timestamp: AHORA - 500, precision: 90 })
      const b = lectura({ timestamp: AHORA - 400, lat: 4.62 })
      const c = lectura({ timestamp: AHORA - 300, lat: 4.63 })
      registro.registrar(a)
      check('registro de rápidas: reconoce la misma lectura (hora y coordenadas) y no otra', registro.contiene({ ...a }) && !registro.contiene(lectura({ timestamp: AHORA - 501, precision: 90 })) && !registro.contiene(b))
      registro.registrar(b)
      registro.registrar(c)
      check('registro de rápidas: guarda solo las últimas (las viejas ya no son recientes)', !registro.contiene(a) && registro.contiene(b) && registro.contiene(c))
    }
    {
      const registro = registroDeRapidas()
      const rapida = lectura({ timestamp: AHORA - 500, precision: 95 })
      const f = fuentesFalsas({ precisa: () => nunca(), rapida: () => demora(5, rapida), ultima: () => Promise.resolve(null), rapidasPropias: registro })
      const pasos = ubicacionEnDosPasos(f, { timeoutMs: 60 })
      const primera = await pasos.primera
      check('rápida propia: la primera es la lectura rápida (para mostrar)', primera.esFinal === false && primera.resultado.ubicacion?.precision === 95)
      check('rápida propia: queda registrada al llegar', registro.contiene(rapida))
      // El sistema devuelve ahora la rápida como "última conocida".
      const f2 = fuentesFalsas({ precisa: () => nunca(), ultima: () => Promise.resolve({ ...rapida }), rapidasPropias: registro })
      const final = await ubicacionFinal(f2, { timeoutMs: 30 })
      check('rápida propia: la final NO la toma de respaldo (sin punto, como antes de los dos pasos)', final.ubicacion === null && final.error === MENSAJE_SIN_UBICACION, final)
      const otra = await ubicacionFinal(fuentesFalsas({ precisa: () => nunca(), ultima: () => Promise.resolve(lectura({ timestamp: AHORA - 30_000, precision: 40 })), rapidasPropias: registro }), { timeoutMs: 30 })
      check('rápida propia: otra última conocida reciente sí sirve (aproximada), la regla de siempre', otra.ubicacion?.precision === 40 && otra.ubicacion.aproximada === true, otra)
      const otraEntrada = ubicacionEnDosPasos(fuentesFalsas({ precisa: () => nunca(), ultima: () => Promise.resolve({ ...rapida }), rapidasPropias: registro }), { timeoutMs: 30 })
      const primeraOtra = await otraEntrada.primera
      check('rápida propia: al volver a Reportar sí se usa para mostrar (la primera)', primeraOtra.esFinal === false && primeraOtra.resultado.ubicacion?.precision === 95, primeraOtra)
      check('rápida propia: y la final de esa entrada tampoco la toma', (await otraEntrada.final).ubicacion === null)
    }
    {
      const registro = registroDeRapidas()
      const tardia = lectura({ timestamp: AHORA - 200, precision: 120 })
      const pasos = ubicacionEnDosPasos(fuentesFalsas({ precisa: () => nunca(), rapida: () => demora(60, tardia), ultima: () => Promise.resolve(null), rapidasPropias: registro }), { timeoutMs: 20 })
      await pasos.primera
      await demora(80, null)
      check('rápida propia: se registra aunque llegue después del tiempo máximo', registro.contiene(tardia))
    }

    check('recargar: el umbral es 100 m', DISTANCIA_RECARGA_M === 100)
    check('recargar: a 50 m no (solo se vuelven a medir las distancias)', !debeRecargarContexto(base, a50))
    check('recargar: a 150 m sí (las sedes a menos de 1 km pueden ser otras)', debeRecargarContexto(base, a150))
    check('recargar: si la primera no tenía punto, sí; si la final no tiene, no', debeRecargarContexto(null, base) && !debeRecargarContexto(base, null))

    const viejas = [
      { id: 's-elegida', nombre: 'Elegida', de_agenda: false },
      { id: 's-tarjeta', nombre: 'En tarjeta' },
      { id: 's-sigue', nombre: 'Sigue cerca' },
      { id: 's-suelta', nombre: 'Nadie la usa' },
    ]
    const conservadas = sedesQueSeConservan(viejas, ['s-sigue', 's-nueva'], ['s-elegida', null, 's-tarjeta', 's-sigue', undefined])
    check(
      'recargar: se conservan la sede elegida y las de las tarjetas que ya no vienen; las que siguen o nadie usa, no',
      JSON.stringify(conservadas.map(s => s.id)) === JSON.stringify(['s-elegida', 's-tarjeta']),
      conservadas
    )
    const contactosViejos = [
      { id: 'k-a', cuenta_id: 'c-a', nombre: 'De la cuenta en la tarjeta' },
      { id: 'k-elegida', cuenta_id: 'c-elegida', nombre: 'De la cuenta de la sede elegida' },
      { id: 'k-sigue', cuenta_id: 'c-a', nombre: 'Sigue en el contexto nuevo' },
      { id: 'k-otra', cuenta_id: 'c-otra', nombre: 'De una cuenta que nadie usa' },
    ]
    const contactosConservados = contactosQueSeConservan(contactosViejos, ['k-sigue', 'k-nuevo'], ['c-a', null, 'c-elegida', undefined])
    check(
      'recargar: se conservan los contactos de las cuentas en uso (tarjeta o sede elegida) que ya no vienen (antes: "Ese contacto no es de la cuenta elegida")',
      JSON.stringify(contactosConservados.map(k => k.id)) === JSON.stringify(['k-a', 'k-elegida']),
      contactosConservados
    )

    // Con qué punto y hora sale la visita (lugarDeLaVisita): NUNCA la primera, tampoco en el instante entre que llega
    // la final y la pantalla se vuelve a pintar con ella.
    {
      const enPantalla = { punto: { lat: 4.6, lng: -74.08, precision: 150 }, llegada: '2026-10-14T09:58:30.000-05:00' }
      const ubicacionFinalOk = aUbicacion(lectura({ lat: 4.611, precision: 9, timestamp: AHORA }), false, AHORA)
      const yaLlego = await lugarDeLaVisita(Promise.resolve({ ubicacion: ubicacionFinalOk, error: null }), enPantalla)
      check(
        'lugar de la visita: la final ya llegó pero la pantalla aún muestra la primera → sale con la final y su hora',
        yaLlego.punto?.lat === 4.611 && yaLlego.punto.precision === 9 && yaLlego.llegada === '2026-10-14T10:00:00.000-05:00',
        yaLlego
      )
      let entregar: (valor: { ubicacion: typeof ubicacionFinalOk; error: string | null }) => void = () => undefined
      const pendiente = new Promise<{ ubicacion: typeof ubicacionFinalOk; error: string | null }>(resolve => (entregar = resolve))
      let salio = false
      const esperando = lugarDeLaVisita(pendiente, enPantalla).then(lugar => {
        salio = true
        return lugar
      })
      await demora(15, null)
      check('lugar de la visita: si la final aún no llega, espera (no sale con la primera)', !salio)
      entregar({ ubicacion: ubicacionFinalOk, error: null })
      check('lugar de la visita: cuando llega, sale con la final', (await esperando).punto?.lat === 4.611)
      const sinPuntoFinal = await lugarDeLaVisita(Promise.resolve({ ubicacion: null, error: MENSAJE_SIN_UBICACION }), enPantalla)
      check(
        'lugar de la visita: si la final no trae punto, sale SIN punto (solo telefónica), nunca con la primera; la llegada, la de la pantalla',
        sinPuntoFinal.punto === null && sinPuntoFinal.llegada === enPantalla.llegada
      )
      check('lugar de la visita: sin dos pasos (o tras "Actualizar"), lo de la pantalla', (await lugarDeLaVisita(null, enPantalla)) === enPantalla)
    }

    // --- Lo que Reportar hace con los dos pasos (funciones puras que reportar.tsx usa tal cual) ---
    // Datos: la primera a ~1,2 km al sur de la final (el GPS afinó); la sede S_AQUI a 50 m de la final.
    const PRIMERA = { lat: 4.6, lng: -74.08 }
    const FINAL = { lat: 4.611, lng: -74.08 }
    const cerca = (p: { lat: number; lng: number }, m: number) => ({ lat: Math.round((p.lat + m / 111_195) * 1e6) / 1e6, lng: p.lng })
    const S_AQUI = 'aaaaaaaa-0000-4000-8000-0000000014a1'
    const S_LEJOS = 'aaaaaaaa-0000-4000-8000-0000000014a2'
    const S_ELEGIDA = 'aaaaaaaa-0000-4000-8000-0000000014a3'
    const S_TARJETA = 'aaaaaaaa-0000-4000-8000-0000000014a4'
    const S_SUELTA = 'aaaaaaaa-0000-4000-8000-0000000014a5'
    const S_CITA = 'aaaaaaaa-0000-4000-8000-0000000014a6'
    const S_NUEVA = 'aaaaaaaa-0000-4000-8000-0000000014a7'
    const S_CONSULTORIO = 'aaaaaaaa-0000-4000-8000-0000000014a8'
    const C_AQUI = 'cccccccc-0000-4000-8000-0000000014c1'
    const C_ELEGIDA = 'cccccccc-0000-4000-8000-0000000014c2'
    const C_TARJETA = 'cccccccc-0000-4000-8000-0000000014c3'
    const C_CITA = 'cccccccc-0000-4000-8000-0000000014c4'
    const C_OTRA = 'cccccccc-0000-4000-8000-0000000014c5'
    const M_14 = 'dddddddd-0000-4000-8000-0000000014d1'
    const L_14 = 'eeeeeeee-0000-4000-8000-0000000014e1'
    const SUB_14 = 'ffffffff-0000-4000-8000-0000000014f1'
    const sedeCerca = (id: string, nombre: string, cuenta_id: string, p: { lat: number; lng: number }, distancia_m: number): ContextoResponse['sedes_cerca'][number] => ({
      id,
      nombre,
      cuenta_id,
      cuenta_nombre: nombre,
      cuenta_clase: 'clinica',
      ciudad: 'Bogotá',
      ...p,
      distancia_m,
      hospital_id: null,
      ubicacion_confirmada: true,
    })
    const contexto14 = (extra: Partial<ContextoResponse> = {}): ContextoResponse => ({
      ejecutiva: { id: 'e14', nombre: 'Ejecutivo de prueba', zona: 'Bogotá', municipio: '11001', lineas: [{ id: L_14, code: 'osteo', name: 'Osteosíntesis' }] },
      hoy: { fecha: '2026-10-14', meta: { medica: 6, institucional: 1 }, hechas: { medicas: 0, institucionales: 0, telefonicas: 0, no_efectivas: 0 }, cuota_dia_ok: false },
      config: { radio_m: 500, telefonica: { habilitada: true, tope_dia: 2, medios: ['llamada'] }, tope_visitas_medico_dia: 1, perfil: ['medica', 'institucional'] },
      sedes_cerca: [],
      // Su consultorio sin coordenadas: la distancia la midió el servidor desde el punto con que se pidió el contexto.
      mis_medicos: [{ id: M_14, nombre: 'Dr. Prueba', especialidades: [], municipality_id: '11001', lineas: [L_14], sedes: [{ id: S_CONSULTORIO, nombre: 'Consultorio', cuenta_nombre: null, distancia_m: 30 }] }],
      contactos: [],
      subtipos: [{ id: SUB_14, codigo: 'compras', nombre: 'Compras', roles_sugeridos: ['compras'] }],
      compromisos_vencidos: [],
      voz: { transcribir: false, proponer: false },
      agenda_hoy: [],
      persona: { user_id: 'u14', nombre: 'Ejecutivo de prueba', executive_id: 'e14', rol: 'ejecutivo', lineas: [{ id: L_14, nombre: 'Osteosíntesis', como: 'ejecutivo' }] },
      ...extra,
    })
    let n14 = 0
    const nuevoId14 = () => `00000000-0000-4000-8000-14${String(++n14).padStart(10, '0')}`
    const finalOk = aUbicacion(lectura({ ...FINAL, precision: 9, timestamp: AHORA }), false, AHORA)
    const primeraUb = aUbicacion(lectura({ ...PRIMERA, precision: 65 }), true, AHORA)

    // (a) arrancarLlegada: la final pendiente queda puesta al recibir la primera, ANTES de que la lista se pueda tocar.
    {
      const eventos: string[] = []
      let finalPuesta: EstadoConLaPrimera['finalPendiente'] | undefined
      const final = nunca<ResultadoUbicacion>()
      let entregarContexto: (valor: string) => void = () => undefined
      const llegada = arrancarLlegada(
        { primera: Promise.resolve({ resultado: { ubicacion: primeraUb, error: null }, esFinal: false }), final },
        {
          vigente: () => true,
          conLaPrimera: estado => {
            eventos.push('primera')
            finalPuesta = estado.finalPendiente
          },
          cargar: ubicacion => {
            eventos.push(`cargar:${ubicacion?.precision}`)
            return new Promise<string>(resolve => (entregarContexto = resolve))
          },
          afinar: (f, primera) => eventos.push(`afinar:${f === final}:${primera?.precision}`),
        }
      ).then(resultado => {
        eventos.push(`lista:${finalPuesta === final}`)
        return resultado
      })
      await demora(5, null)
      check('(a) llegada: al recibir la primera queda puesta la final pendiente, antes de pedir el contexto', eventos.join() === 'primera,cargar:65' && finalPuesta === final, eventos)
      entregarContexto('contexto')
      const resultado = await llegada
      check(
        '(a) llegada: la lista se muestra (arrancarLlegada resuelve) solo después, con la final pendiente ya puesta; afina después de cargar',
        eventos.join() === 'primera,cargar:65,afinar:true:65,lista:true' && resultado?.cargado === 'contexto' && resultado.primera.llegada === primeraUb?.tomada_at,
        eventos
      )
    }
    {
      let afino = false
      let estado: EstadoConLaPrimera | null = null
      const final = Promise.resolve({ ubicacion: finalOk, error: null })
      const resultado = await arrancarLlegada({ primera: Promise.resolve({ resultado: { ubicacion: finalOk, error: null }, esFinal: true }), final }, {
        vigente: () => true,
        conLaPrimera: e => (estado = e),
        cargar: async () => 'ok',
        afinar: () => (afino = true),
      })
      const sinFinal = estado as EstadoConLaPrimera | null
      check('(a) llegada: si la primera ya es la final, no queda final pendiente ni se afina', resultado !== null && sinFinal !== null && sinFinal.finalPendiente === null && !afino)
    }
    {
      const eventos: string[] = []
      let vigente = true
      const efectos = {
        vigente: () => vigente,
        conLaPrimera: () => eventos.push('primera'),
        cargar: async () => {
          eventos.push('cargar')
          vigente = false // otra llegada empezó mientras se cargaba
          return 'ok'
        },
        afinar: () => eventos.push('afinar'),
      }
      const pasos = { primera: Promise.resolve({ resultado: { ubicacion: primeraUb, error: null }, esFinal: false }), final: nunca<ResultadoUbicacion>() }
      const tarde = await arrancarLlegada(pasos, efectos)
      vigente = false
      const vieja = await arrancarLlegada(pasos, efectos)
      check('(a) llegada: si otra llegada empezó (tras cargar o antes de la primera), devuelve null y no aplica nada más', tarde === null && vieja === null && eventos.join() === 'primera,cargar', eventos)
    }

    // Nota del revisor: "afinando la ubicación…" no se queda pegado cuando empieza otra generación.
    check(
      'afinando: solo mientras se espera la final de la generación de ahora (otra llegada o "Actualizar" lo apaga)',
      estaAfinando(4, 4) && !estaAfinando(4, 5) && !estaAfinando(null, 4)
    )

    // (b) datosParaConfirmar: con qué sale la tarjeta. La pantalla aún tiene el contexto de la primera; mientras se
    // esperaba, llegó la final y se recargó el contexto (ahora trae S_AQUI) y la tarjeta cambió.
    const ctxPrimera = contexto14({ sedes_cerca: [sedeCerca(S_LEJOS, 'Clínica de la primera', C_OTRA, cerca(PRIMERA, 40), 40)] })
    const ctxFinal = contexto14({ sedes_cerca: [sedeCerca(S_AQUI, 'Clínica Aquí', C_AQUI, cerca(FINAL, 50), 50)] })
    const catalogoPrimera = catalogoDesdeContexto(ctxPrimera, {}, PRIMERA)
    const tarjetaAlTocar = { ...borradorVacio(catalogoPrimera, { nuevoId: nuevoId14, sedeElegida: null }), conclusion: 'al tocar' }
    const tarjetaComoQuedo = { ...tarjetaAlTocar, sede_id: S_AQUI, conclusion: 'como quedó' }
    const enPantalla14 = { punto: { ...PRIMERA, precision: 65 }, llegada: primeraUb?.tomada_at ?? '', catalogo: catalogoPrimera, borrador: tarjetaAlTocar }
    const estado14 = (extra: Partial<EstadoDelReporte> = {}): EstadoDelReporte => ({
      contexto: ctxFinal,
      puntoContexto: FINAL,
      extras: {},
      sinSenal: false,
      catalogo: catalogoDesdeContexto(ctxFinal, {}, FINAL),
      sedeElegida: null,
      cita: null,
      tarjetas: [tarjetaComoQuedo],
      ...extra,
    })
    {
      const generacion = { current: 3 }
      const ultimo = { current: estado14({ contexto: ctxPrimera, puntoContexto: PRIMERA, tarjetas: [tarjetaAlTocar] }) }
      let entregar: (valor: ResultadoUbicacion) => void = () => undefined
      const final = new Promise<ResultadoUbicacion>(resolve => (entregar = resolve))
      const esperando = datosParaConfirmar({ clave: tarjetaAlTocar.clave, final, enPantalla: enPantalla14, generacion, ultimo })
      // Mientras espera: llega la final, se recarga el contexto con ella y la tarjeta queda como quedó.
      ultimo.current = estado14()
      entregar({ ubicacion: finalOk, error: null })
      const datos = await esperando
      const aqui = datos?.catalogo.sedes.find(s => s.id === S_AQUI)
      check(
        '(b) confirmar: sale con la final y su hora, no con la primera',
        datos?.punto?.lat === FINAL.lat && datos.punto.precision === 9 && datos.llegada === finalOk?.tomada_at,
        datos?.punto
      )
      check(
        '(b) confirmar: el catálogo es el de AHORA (contexto recargado) medido desde la final, no el de la pantalla',
        !!aqui && Math.abs((aqui.distancia_m ?? 0) - 50) <= 1 && !datos?.catalogo.sedes.some(s => s.id === S_LEJOS),
        datos?.catalogo.sedes.map(s => [s.id, s.distancia_m])
      )
      check('(b) confirmar: la tarjeta es la de ahora (como quedó), no la del toque', datos?.borrador.conclusion === 'como quedó' && datos.borrador.sede_id === S_AQUI)
      const consultorio = datos?.catalogo.medicos.find(m => m.id === M_14)?.sedes.find(s => s.id === S_CONSULTORIO)
      check('(b) confirmar: con el contexto pedido con la final, la distancia del consultorio que midió el servidor vale', consultorio?.distancia_m === 30, consultorio)
    }
    {
      // Sin recarga aún (el contexto es el de la primera, a 1,2 km): la distancia que midió el servidor no se usa.
      const ultimo = { current: estado14({ contexto: ctxPrimera, puntoContexto: PRIMERA, tarjetas: [tarjetaAlTocar] }) }
      const datos = await datosParaConfirmar({ clave: tarjetaAlTocar.clave, final: Promise.resolve({ ubicacion: finalOk, error: null }), enPantalla: enPantalla14, generacion: { current: 1 }, ultimo })
      const consultorio = datos?.catalogo.medicos.find(m => m.id === M_14)?.sedes.find(s => s.id === S_CONSULTORIO)
      check('(b) confirmar: con el contexto de la primera (lejos de la final), la distancia del servidor queda desconocida', consultorio?.distancia_m === null && consultorio.coordenadas_desconocidas === true, consultorio)
    }
    {
      const generacion = { current: 3 }
      let entregar: (valor: ResultadoUbicacion) => void = () => undefined
      const final = new Promise<ResultadoUbicacion>(resolve => (entregar = resolve))
      const esperando = datosParaConfirmar({ clave: tarjetaAlTocar.clave, final, enPantalla: enPantalla14, generacion, ultimo: { current: estado14() } })
      generacion.current++ // empezó otra llegada mientras esperaba
      entregar({ ubicacion: finalOk, error: null })
      const sinTarjeta = await datosParaConfirmar({ clave: tarjetaAlTocar.clave, final: Promise.resolve({ ubicacion: finalOk, error: null }), enPantalla: enPantalla14, generacion: { current: 1 }, ultimo: { current: estado14({ tarjetas: [] }) } })
      check('(b) confirmar: si cambió la generación o la tarjeta ya no está, no se manda (null)', (await esperando) === null && sinTarjeta === null)
      check('(b) confirmar: sin final pendiente, lo de la pantalla tal cual', (await datosParaConfirmar({ clave: tarjetaAlTocar.clave, final: null, enPantalla: enPantalla14, generacion: { current: 1 }, ultimo: { current: estado14() } })) === enPantalla14)
    }

    // (c) y hallazgo 2: lo que se conserva al recargar el contexto con la final.
    {
      const sedeVieja = (id: string, cuenta_id: string) => ({ ...sedeCerca(id, id, cuenta_id, cerca(PRIMERA, 10), 10) })
      const citaInst14: CitaItem = {
        id: '11111111-0000-4000-8000-0000000014b1',
        fecha: '2026-10-14',
        hora: '10:00',
        tipo: 'institucional',
        medico: null,
        cuenta: { id: C_CITA, nombre: 'Cuenta de la cita' },
        subtipo: { id: SUB_14, codigo: 'compras', nombre: 'Compras' },
        sede: { id: S_CITA, nombre: 'Sede de la cita', cuenta_id: C_CITA, cuenta_nombre: 'Cuenta de la cita', ...cerca(FINAL, 20), ubicacion_confirmada: true },
        nota: null,
        estado: 'pendiente',
        visita_id: null,
        distancia_m: null,
        dentro_del_radio: null,
        anticipada: true,
        cancelable: true,
        motivo_codigo: null, no_realizada_at: null, no_realizada_motivo: null, viene_de: null, viene_de_fecha: null, viene_de_estado: null, sucesora_id: null, como: 'ejecutivo', estado_visible: 'programada',
      }
      const ctxAntes = contexto14({
        sedes_cerca: [sedeVieja(S_ELEGIDA, C_ELEGIDA), sedeVieja(S_TARJETA, C_TARJETA), sedeVieja(S_SUELTA, C_OTRA)],
        contactos: [
          { id: 'k-cita', cuenta_id: C_CITA, sede_id: null, nombre: 'Compras de la cuenta de la cita', cargo_texto: null, rol: 'compras' },
          { id: 'k-elegida', cuenta_id: C_ELEGIDA, sede_id: null, nombre: 'De la sede elegida', cargo_texto: null, rol: 'compras' },
          { id: 'k-tarjeta', cuenta_id: C_TARJETA, sede_id: null, nombre: 'De la tarjeta', cargo_texto: null, rol: 'compras' },
          { id: 'k-otra', cuenta_id: C_OTRA, sede_id: null, nombre: 'De una cuenta que nadie usa', cargo_texto: null, rol: 'compras' },
        ],
        agenda_hoy: [citaInst14],
      })
      const catalogoAntes = catalogoDesdeContexto(ctxAntes, {}, PRIMERA)
      const tarjeta = { ...borradorVacio(catalogoAntes, { nuevoId: nuevoId14, tipo: 'institucional', sedeElegida: S_TARJETA }), cuenta_id: C_TARJETA, sede_id: S_TARJETA }
      const antes = { contexto: ctxAntes, catalogo: catalogoAntes, sedeElegida: S_ELEGIDA, cita: citaInst14, tarjetas: [tarjeta] }
      const enUso = enUsoAlRecargar(antes)
      check(
        'recargar: en uso, la sede elegida, la de la cita y las de las tarjetas; y sus cuentas (también la de la CITA elegida)',
        JSON.stringify(enUso) === JSON.stringify({ sedes: [S_ELEGIDA, S_CITA, S_TARJETA], cuentas: [C_TARJETA, C_ELEGIDA, C_CITA] }),
        enUso
      )
      // El contexto pedido con la final trae otras sedes cercanas, solo sus contactos y la misma cita.
      const ctxNuevo = contexto14({
        sedes_cerca: [sedeCerca(S_NUEVA, 'Nueva cercana', C_AQUI, cerca(FINAL, 30), 30)],
        contactos: [{ id: 'k-nuevo', cuenta_id: C_AQUI, sede_id: null, nombre: 'De la nueva', cargo_texto: null, rol: 'compras' }],
        agenda_hoy: [citaInst14],
      })
      const recargado = contextoAlRecargar(antes, ctxNuevo)
      check(
        'recargar: se conservan la sede elegida y la de la tarjeta (la de la cita sigue en la agenda nueva; la suelta no)',
        JSON.stringify(recargado.sedes.map(s => s.id)) === JSON.stringify([S_ELEGIDA, S_TARJETA]),
        recargado.sedes.map(s => s.id)
      )
      check(
        'recargar: se conservan los contactos de las cuentas en uso, incluida la de la cita elegida (antes se perdía)',
        JSON.stringify(recargado.contexto.contactos.map(k => k.id)) === JSON.stringify(['k-nuevo', 'k-cita', 'k-elegida', 'k-tarjeta']),
        recargado.contexto.contactos.map(k => k.id)
      )
      const porToquesConCita = borradorDesdeCita(citaInst14, catalogoDesdeContexto(recargado.contexto, { sedes: recargado.sedes }, FINAL), { nuevoId: nuevoId14 })
      check('recargar: "Por toques" con la cita sigue sugiriendo el contacto de compras de su cuenta', porToquesConCita.contacto_id === 'k-cita', porToquesConCita.contacto_id)
      const conCitaCancelada = contextoAlRecargar(antes, { ...ctxNuevo, agenda_hoy: [{ ...citaInst14, estado: 'cancelada' }] })
      check('recargar: si en el contexto nuevo la cita viene cancelada, su sede se conserva (el catálogo nuevo no la trae)', conCitaCancelada.sedes.some(s => s.id === S_CITA))
      check('recargar: sin nada que conservar, el contexto nuevo tal cual', contextoAlRecargar({ contexto: ctxAntes, catalogo: catalogoAntes, sedeElegida: null, cita: null, tarjetas: [] }, ctxNuevo).contexto === ctxNuevo)
    }

    // Hallazgo 3: mientras una tarjeta se envía no empieza otra llegada; "Reportar de nuevo" se aplaza (en el ref propio
    // de Reportar) y se arma solo cuando no se pierde nada.
    {
      const R = { client_id: 'rechazada', cuerpo: visita(), error: 'Fuera del radio' }
      const R2 = { client_id: 'otra', cuerpo: visita(), error: 'Fuera del radio' }
      type EntradaPaso = Parameters<typeof pasoDelReporte<typeof R>>[0]
      const paso = (extra: Partial<EntradaPaso>) =>
        pasoDelReporte<typeof R>({ motivo: 'foco', iniciado: true, nuevo: null, aplazado: null, enviando: 0, ocupada: false, abiertas: 0, volviendoDeCrear: false, reiniciar: false, ...extra })
      check('paso: la primera vez que recibe el foco, empieza (con el reintento si lo hay)', JSON.stringify(paso({ iniciado: false, nuevo: R })) === JSON.stringify({ accion: 'iniciar', reintento: R }))
      const aplazado = paso({ nuevo: R, enviando: 1 })
      check('paso: foco con "Reportar de nuevo" mientras una tarjeta se envía → se aplaza, no empieza otra llegada', aplazado.accion === 'aplazar' && aplazado.reintento === R, aplazado)
      check('paso: foco sin reintento mientras una tarjeta se envía → sigue aunque tocaría reiniciar', paso({ enviando: 2, reiniciar: true }).accion === 'seguir')
      check('paso: un toque NUEVO en Hoy sin envíos → empieza con él (aunque esté grabando o haya abiertas, como siempre)', JSON.stringify(paso({ nuevo: R, ocupada: true, abiertas: 2 })) === JSON.stringify({ accion: 'iniciar', reintento: R }))
      check('paso: foco sin reintento → reinicia solo si debeReiniciarReporte', JSON.stringify(paso({ reiniciar: true })) === JSON.stringify({ accion: 'iniciar', reintento: null }) && paso({}).accion === 'seguir')
      check('paso: termina el último envío con un reintento aplazado y nada abierto → empieza con él', JSON.stringify(paso({ motivo: 'envio', aplazado: R })) === JSON.stringify({ accion: 'iniciar', reintento: R }))
      check('paso: termina un envío pero queda otro, o está grabando → sigue aplazado', paso({ motivo: 'envio', aplazado: R, enviando: 1 }).accion === 'aplazar' && paso({ motivo: 'envio', aplazado: R, ocupada: true }).accion === 'aplazar')
      check('paso: termina un envío sin reintento → sigue (nunca reinicia por eso)', paso({ motivo: 'envio', reiniciar: true }).accion === 'seguir')
      const conAbierta = paso({ motivo: 'envio', aplazado: R, abiertas: 1 })
      check('paso: termina el último envío pero queda una tarjeta abierta (rechazada o sin confirmar) → sigue aplazado, no la borra', conAbierta.accion === 'aplazar' && conAbierta.reintento === R, conAbierta)
      // Revisión final: al recibir el foco, el APLAZADO tiene las mismas condiciones (no es un toque nuevo en Hoy).
      const focoConAbierta = paso({ aplazado: R, abiertas: 1, reiniciar: true })
      check('paso: foco con un reintento aplazado y una tarjeta abierta (la rechazada) → no empieza, sigue aplazado', focoConAbierta.accion === 'aplazar' && focoConAbierta.reintento === R, focoConAbierta)
      const vuelta = paso({ aplazado: R, volviendoDeCrear: true })
      check('paso: vuelta de Nuevo médico o Nueva sede con un reintento aplazado → no empieza (lo creado es para una tarjeta)', vuelta.accion === 'aplazar' && vuelta.reintento === R, vuelta)
      check('paso: foco con un reintento aplazado grabando → no empieza', paso({ aplazado: R, ocupada: true }).accion === 'aplazar')
      check('paso: foco con un reintento aplazado y nada que perder → empieza con él', JSON.stringify(paso({ aplazado: R })) === JSON.stringify({ accion: 'iniciar', reintento: R }))
      check('paso: un toque nuevo reemplaza al aplazado (el más reciente manda)', JSON.stringify(paso({ nuevo: R2, aplazado: R })) === JSON.stringify({ accion: 'iniciar', reintento: R2 }) && (paso({ nuevo: R2, aplazado: R, enviando: 1 }) as { reintento?: unknown }).reintento === R2)

      // Tarjetas abiertas al terminar un envío: lo último pintado menos la que se acaba de guardar.
      const tA = { clave: 'A' }
      const tD = { clave: 'D' }
      check(
        'abiertas al terminar: la guardada no cuenta (la pantalla aún la tiene); la rechazada o sin guardar sí',
        abiertasAlTerminarEnvio([tA], 'A') === 0 && abiertasAlTerminarEnvio([tA], null) === 1 && abiertasAlTerminarEnvio([tA, tD], 'A') === 1 && abiertasAlTerminarEnvio([], null) === 0
      )

      // Simulación del ref de Reportar (aplicarPaso): lo que se aplaza queda ahí y se suelta al iniciar.
      const correr = (estado: { aplazado: typeof R | null }, p: ReturnType<typeof paso>) => {
        if (p.accion === 'iniciar') estado.aplazado = null
        else if (p.accion === 'aplazar') estado.aplazado = p.reintento
        return p
      }

      // El caso del revisor de punta a punta: la tarjeta espera la final, la persona va a Hoy y toca "Reportar de nuevo".
      const ref = { aplazado: null as typeof R | null }
      const generacion = { current: 9 }
      let enviando = 1
      let entregar: (valor: ResultadoUbicacion) => void = () => undefined
      const final = new Promise<ResultadoUbicacion>(resolve => (entregar = resolve))
      const esperando = datosParaConfirmar({ clave: tarjetaComoQuedo.clave, final, enPantalla: { ...enPantalla14, borrador: tarjetaComoQuedo }, generacion, ultimo: { current: estado14() } })
      const alEnfocar = correr(ref, paso({ nuevo: R, aplazado: ref.aplazado, enviando }))
      if (alEnfocar.accion === 'iniciar') generacion.current++ // lo que haría iniciar: otra generación (y borra las tarjetas)
      entregar({ ubicacion: finalOk, error: null })
      const datos = await esperando
      check('paso: la visita que esperaba la final no se pierde: sigue y sale con la final', alEnfocar.accion === 'aplazar' && ref.aplazado === R && datos !== null && datos.punto?.lat === FINAL.lat, { alEnfocar, datos: datos?.punto })
      enviando--
      const alTerminar = correr(ref, paso({ motivo: 'envio', aplazado: ref.aplazado, enviando, abiertas: abiertasAlTerminarEnvio([tarjetaComoQuedo], tarjetaComoQuedo.clave) }))
      check('paso: y al terminar ese envío (guardada) se arma el "Reportar de nuevo" aplazado', alTerminar.accion === 'iniciar' && alTerminar.reintento === R && ref.aplazado === null)

      // Hallazgo 2 (verificación) y revisión final: el servidor RECHAZA la tarjeta; sale de la cola y queda abierta con su
      // rechazo. El aplazado no la borra: ni al terminar el envío, ni al volver de Nuevo médico, ni al cambiar de pestaña.
      const ref2 = { aplazado: R as typeof R | null }
      const rechazada = correr(ref2, paso({ motivo: 'envio', aplazado: ref2.aplazado, abiertas: abiertasAlTerminarEnvio([tarjetaComoQuedo], null) }))
      const deNuevoMedico = correr(ref2, paso({ aplazado: ref2.aplazado, abiertas: 1, volviendoDeCrear: true }))
      const deOtraPestana = correr(ref2, paso({ aplazado: ref2.aplazado, abiertas: 1, reiniciar: true }))
      const corregidaYGuardada = correr(ref2, paso({ motivo: 'envio', aplazado: ref2.aplazado, abiertas: abiertasAlTerminarEnvio([tarjetaComoQuedo], tarjetaComoQuedo.clave) }))
      check(
        'paso: tarjeta rechazada abierta con un aplazado: no se borra al terminar, al volver de crear ni al cambiar de pestaña; al guardarla, se arma',
        rechazada.accion === 'aplazar' && deNuevoMedico.accion === 'aplazar' && deOtraPestana.accion === 'aplazar' && corregidaYGuardada.accion === 'iniciar' && corregidaYGuardada.reintento === R,
        { rechazada: rechazada.accion, deNuevoMedico: deNuevoMedico.accion, deOtraPestana: deOtraPestana.accion, corregidaYGuardada: corregidaYGuardada.accion }
      )

      // Hallazgo 3 (verificación): aplazado otra vez por grabar; la propuesta trae C y D; confirmar C no lo arma (D sigue
      // abierta y no se borra); al guardar D, la última, sí.
      const ref3 = { aplazado: R as typeof R | null }
      const grabando = correr(ref3, paso({ motivo: 'envio', aplazado: ref3.aplazado, ocupada: true, abiertas: abiertasAlTerminarEnvio([tarjetaComoQuedo], tarjetaComoQuedo.clave) }))
      const tC = { clave: 'C' }
      const alGuardarC = correr(ref3, paso({ motivo: 'envio', aplazado: ref3.aplazado, abiertas: abiertasAlTerminarEnvio([tC, tD], 'C') }))
      const alGuardarD = correr(ref3, paso({ motivo: 'envio', aplazado: ref3.aplazado, abiertas: abiertasAlTerminarEnvio([tD], 'D') }))
      check(
        'paso: aplazado por grabar, otro Confirmar con tarjetas abiertas no lo arma (no borra la dictada sin confirmar); al guardar la última, sí',
        grabando.accion === 'aplazar' && alGuardarC.accion === 'aplazar' && alGuardarD.accion === 'iniciar' && alGuardarD.reintento === R,
        { grabando: grabando.accion, alGuardarC: alGuardarC.accion, alGuardarD: alGuardarD.accion }
      )
    }

    // La pantalla usa esas funciones (la lógica no se duplica en reportar.tsx) y no manda la visita con la primera.
    const reportar = readFileSync(path.resolve(__dirname, '../app/(app)/reportar.tsx'), 'utf8')
    const ubicacionTs = readFileSync(path.resolve(__dirname, '../lib/ubicacion.ts'), 'utf8')
    const iniciar = reportar.slice(reportar.indexOf('const iniciar = useCallback('), reportar.indexOf('const reubicar = useCallback('))
    const antesDeArrancar = iniciar.slice(0, iniciar.indexOf('await arrancarLlegada('))
    check('Reportar: pide las visitas de hoy antes de esperar la ubicación', iniciar.indexOf('api.visitas(') > -1 && iniciar.indexOf('api.visitas(') < iniciar.indexOf('await arrancarLlegada('))
    check(
      'Reportar: arranca con arrancarLlegada (pone la final pendiente en conLaPrimera, afina con la final) y solo después muestra la lista',
      /await arrancarLlegada\(pedirUbicacionEnDosPasos\(/.test(iniciar) &&
        /finalPendiente\.current = estado\.finalPendiente/.test(iniciar) &&
        /afinar: \(final, primera\) => void afinar\(gen, final, primera\)/.test(iniciar) &&
        (antesDeArrancar.match(/setFase\([^)]*\)/g) ?? []).every(llamada => llamada === "setFase('ubicando')") &&
        iniciar.indexOf("setFase('lista')") > iniciar.indexOf('await arrancarLlegada(') &&
        !/finalPendiente\.current = pasos\.final/.test(reportar)
    )
    const confirmar = reportar.slice(reportar.indexOf('const confirmarTarjeta = async'), reportar.indexOf('const descartar = '))
    const afinarTs = reportar.slice(reportar.indexOf('const afinar = useCallback('), reportar.indexOf('const iniciar = useCallback('))
    check(
      'Reportar: Confirmar sale con datosParaConfirmar (refs de generación y de lo último) y valida y manda ESO',
      /await datosParaConfirmar\(\{ clave, final, enPantalla: \{ punto, llegada, catalogo, borrador: enPantalla \}, generacion, ultimo \}\)/.test(confirmar) &&
        /const \{ borrador, catalogo: catalogoVisita, punto: puntoVisita, llegada: llegadaVisita \} = datos/.test(confirmar) &&
        /validarBorrador\(borrador, catalogoVisita, \{ punto: puntoVisita, checked_in_at: llegadaVisita/.test(confirmar) &&
        /cuerpoDesdeBorrador\(borrador, \{ punto: puntoVisita, checked_in_at: llegadaVisita/.test(confirmar) &&
        !/lugarDeLaVisita\(/.test(confirmar)
    )
    check('Reportar: mientras espera la final, la tarjeta se bloquea sin marcarse intentada', /if \(final\) fijarEstado\(clave, \{ enviando: true, rechazo: null \}\)/.test(confirmar))
    // Cada llamada se revisa dentro de SU bloque (una regex que se extiende hasta otro bloque no cuida nada). Si un
    // marcador no está, el bloque queda vacío y la prueba falla.
    const bloque = (texto: string, desde: string, hasta: string) => {
      const i = texto.indexOf(desde)
      const j = i > -1 ? texto.indexOf(hasta, i + desde.length) : -1
      return i > -1 && j > -1 ? texto.slice(i, j) : ''
    }
    const finIntento = confirmar.lastIndexOf('} finally {')
    const cuerpoConfirmar = finIntento > -1 ? confirmar.slice(0, finIntento) : ''
    const finallyConfirmar = finIntento > -1 ? confirmar.slice(finIntento) : ''
    const alEnfocarTs = bloque(reportar, '  useFocusEffect(', '// Lo que se creó en Nuevo médico')
    const aplicarPasoTs = bloque(reportar, 'function aplicarPaso(', '\n}\n')
    check(
      'Reportar: Confirmar espera la final de ESTA llegada (const final = finalPendiente.current, antes de datosParaConfirmar)',
      /\n\s*const final = finalPendiente\.current\n/.test(cuerpoConfirmar) &&
        cuerpoConfirmar.indexOf('const final = finalPendiente.current') < cuerpoConfirmar.indexOf('await datosParaConfirmar(')
    )
    // Spec 2026-10-15 (paquete 2): la cita tocada en Hoy entra como aplazada (mismas reglas de "Reportar de nuevo").
    check(
      'Reportar: al recibir el foco cuenta los envíos en curso, la fase y las tarjetas de lo último (pasoDelReporte con motivo foco)',
      /const reintento = tomarReintento\(\)/.test(alEnfocarTs) &&
        /const citaDeHoy = pedidoDeCita\(tomarCitaParaReportar\(\)\)/.test(alEnfocarTs) &&
        /const \{ llegada: llegadaActual, fase: faseActual, borradores: pendientes \} = ultimo\.current/.test(alEnfocarTs) &&
        /const ocupada = esFaseOcupada\(faseActual\)/.test(alEnfocarTs) &&
        /pasoDelReporte\(\{\s*motivo: 'foco',\s*iniciado: iniciado\.current,\s*nuevo: pedidoDeReintento\(reintento\),\s*aplazado: citaDeHoy \?\? reintentoAplazado\.current,\s*enviando: enviosEnCurso\.current,\s*ocupada,\s*abiertas: pendientes,\s*volviendoDeCrear: volviendo,\s*reiniciar: debeReiniciarReporte\(/.test(alEnfocarTs) &&
        /aplicarPaso\(paso, reintentoAplazado, r => void iniciarRef\.current\(r\)\)/.test(alEnfocarTs)
    )
    check(
      'Reportar: cuenta los envíos (sube antes de esperar la final, baja en el finally) y al terminar cada envío decide con pasoDelReporte',
      cuerpoConfirmar.indexOf('enviosEnCurso.current++') > -1 &&
        cuerpoConfirmar.indexOf('enviosEnCurso.current++') < cuerpoConfirmar.indexOf('await datosParaConfirmar(') &&
        /^\} finally \{\s*enviosEnCurso\.current--/.test(finallyConfirmar) &&
        /aplicarPaso\(\s*pasoDelReporte\(\{\s*motivo: 'envio',\s*iniciado: true,\s*nuevo: null,\s*aplazado: soloReintento\(reintentoAplazado\.current\),\s*enviando: enviosEnCurso\.current,\s*ocupada: esFaseOcupada\(ultimo\.current\.fase\),\s*abiertas: abiertasAlTerminarEnvio\(ultimo\.current\.tarjetas, guardada\),\s*volviendoDeCrear: false,\s*reiniciar: false,?\s*\}\),\s*reintentoAplazado,\s*r => void iniciarRef\.current\(r\)\s*\)/.test(finallyConfirmar) &&
        !/tomarReintento\(\)/.test(finallyConfirmar)
    )
    const guardadaEn = cuerpoConfirmar.indexOf('guardada = clave')
    check(
      'Reportar: la tarjeta solo cuenta como guardada (no abierta) en el camino que la guarda; rechazada o con error sigue abierta',
      /let guardada: string \| null = null\n/.test(cuerpoConfirmar) &&
        (cuerpoConfirmar.match(/\bguardada = /g) ?? []).length === 1 &&
        guardadaEn > cuerpoConfirmar.indexOf('setBorradores(prev => prev.filter(b => b.clave !== clave))') &&
        guardadaEn > cuerpoConfirmar.indexOf("if (elemento.estado === 'no_enviada') {") &&
        guardadaEn < cuerpoConfirmar.indexOf('} catch (lanzado) {')
    )
    check(
      'Reportar: aplicarPaso suelta el aplazado e inicia, o guarda el aplazado en el ref propio (no en el global de Hoy)',
      /if \(paso\.accion === 'iniciar'\) \{\s*aplazado\.current = null\s*iniciar\(paso\.reintento\)\s*\}/.test(aplicarPasoTs) &&
        /else if \(paso\.accion === 'aplazar'\) aplazado\.current = paso\.reintento/.test(aplicarPasoTs) &&
        !/fijarReintento/.test(aplicarPasoTs)
    )
    check(
      'Reportar: lo último (ultimo.current, cada render) lleva la fase, las tarjetas, la sede y la CITA elegidas tal cual',
      /\n\s*ultimo\.current = \{ contexto, puntoContexto, extras, punto, catalogo, sinSenal, llegada, fase, borradores: borradores\.length, tarjetas: borradores, sedeElegida, cita \}\n/.test(reportar)
    )
    // Spec 2026-10-15 (paquete 2): la recarga sin tapar (la de la final y el refresco de lo pintado de memoria) es una sola.
    const recargarTs = bloque(reportar, 'const recargarSinTapar = useCallback(', 'const afinar = useCallback(')
    check(
      'Reportar: al recargar usa contextoAlRecargar con lo último (afinar recarga con recargarSinTapar)',
      /contextoAlRecargar\(ultimo\.current, ctx\)/.test(recargarTs) && /await recargarSinTapar\(gen, lugar\)/.test(afinarTs)
    )
    check('Reportar: "afinando" se muestra con estaAfinando (la generación de ahora)', /const afinando = estaAfinando\(afinandoDe, generacion\.current\)/.test(reportar))
    check('Reportar: la final no se suelta al llegar (sin carrera con el siguiente render); "Actualizar" sí la suelta', !/finalPendiente\.current = null/.test(afinarTs) && /finalPendiente\.current = null/.test(reportar.slice(reportar.indexOf('const reubicar = useCallback('))))
    check('Reportar: Nuevo médico recibe la final (puntoFinal) para el consultorio', /puntoFinal: lugarDeLaVisita\(finalPendiente\.current/.test(reportar))
    const nuevoMedicoTs = readFileSync(path.resolve(__dirname, '../app/(app)/medico/nuevo.tsx'), 'utf8')
    check('Nuevo médico: crea el consultorio con la final (await pedido.puntoFinal), no con la primera', /const punto = pedido\?\.puntoFinal \? await pedido\.puntoFinal/.test(nuevoMedicoTs) && !/pedido\?\.punto\?\.lat/.test(nuevoMedicoTs))
    const tarjetaTs = readFileSync(path.resolve(__dirname, '../components/reporte/TarjetaBorrador.tsx'), 'utf8')
    check('TarjetaBorrador: mientras se confirma no se toca (pointerEvents none)', /estado\.enviando \? \{ gap: 14, pointerEvents: 'none'/.test(tarjetaTs))
    check('Reportar: lo que llega de una llegada anterior no se aplica (generación)', /if \(gen !== generacion\.current\) return/.test(reportar) && /\+\+generacion\.current/.test(reportar))
    const hoyTs = readFileSync(path.resolve(__dirname, '../app/(app)/hoy.tsx'), 'utf8')
    check('Hoy: pide el contexto con la primera ubicación (no espera la de alta precisión)', /pedirUbicacionEnDosPasos\(\{ timeoutMs: 8_000 \}\)\.primera/.test(hoyTs) && !/pedirUbicacion\(/.test(hoyTs))
    check('lib/ubicacion.ts: la que vale sigue siendo de alta precisión; la rápida, de precisión media', /precisa:[^\n]*Accuracy\.High/.test(ubicacionTs) && /rapida:[^\n]*Accuracy\.Balanced/.test(ubicacionTs))
  }

  // -------------------------------------------------------------------------
  // Secciones 15 a 19 (spec 2026-10-15), 20 (estilo tipo Uber) y 21 (F1b, persona de campo): un archivo por paquete en
  // scripts/checks/, con el mismo marco.
  {
    const probador: Probador = { check, seccion, lanza }
    await pruebasNavegacion(probador)
    await pruebasReportar(probador)
    await pruebasAgenda(probador)
    await pruebasTiempos(probador)
    await pruebasPantallas(probador)
    await pruebasEstilo(probador)
    await pruebasPersona(probador)
  }

  console.log(`\n${total - fallas}/${total} pruebas pasaron`)
  if (fallas > 0) {
    console.log(`${fallas} fallaron`)
    process.exit(1)
  }
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
