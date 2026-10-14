/**
 * Pruebas PURAS de la app móvil (sin React Native, sin red): Haversine con los mismos casos del servidor
 * (web/scripts/reporte-check.ts), fechas en Bogotá (medianoche UTC frente a Bogotá, plazo de días libres), la cola
 * sin señal (reintento, descarte a medianoche, idempotencia por client_id, envíos concurrentes), el mapeo de
 * errores de la API, el armado de URLs, la lectura del token, los textos de las pantallas, Reportar (tarjetas,
 * validación con los mismos mensajes del servidor, cuerpo de POST /api/me/visitas, corregir el mismo día), la
 * grabación, el médico completo y la sede nueva, y las claves de cada forma JSON frente al contrato.
 * Contrato: docs/fases/fase8-visitas-f3-f4-reporte-y-app-movil.md (sección "App móvil", "Pruebas").
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
  avance,
  conQuien,
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
  tituloRol,
} from '../lib/reglas'
import { decodificarBase64Url, leerCargaToken, tokenVencido } from '../lib/token'
import type { ContextoResponse, DiaLibreItem, MedicoPublico, PropuestaResponse, SedeCreada, VisitaCreate, VisitaItem } from '../lib/tipos'
import { CLAVES_API, clavesDe, tieneClaves } from '../lib/claves-api'
import { MAX_GRABACION_MS, debeParar, formatoDuracion, nivelDesdeMetering, restanteGrabacion, segundosDe } from '../lib/grabacion'
import {
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
    check('tituloRol como la web', tituloRol('sales_manager') === 'Ventas' && tituloRol('commercial_director') === 'Dirección comercial' && tituloRol(null) === 'Usuario')
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

    const visita: VisitaItem = { id: 'v1', client_id: 'c1', tipo: 'medica', subtipo: null, medico: { id: M1, nombre: 'Dra. Ana Gómez' }, cuenta: null, sede: { id: S1, nombre: 'Clínica Norte' }, contacto: null, modalidad: 'presencial', medio: null, efectiva: true, failure_reason: null, checked_in_at: llegada, distance_m: 120, conclusion: 'Bien', compromisos: null, next_step_date: null, lineas: [L1], input_mode: 'toques', out_of_territory: false, cuenta_para: 'medica', peso: 1, sede_por_confirmar: false, editable: true }
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
      'y la tarjeta le dice cómo pedir ser su visitante (a su líder); con su propio médico o sin médico, ningún aviso',
      avisoVisitante(buscado) === AVISO_NO_VISITANTE && AVISO_NO_VISITANTE.includes('suma igual') && AVISO_NO_VISITANTE.includes('Pide a tu líder que te asigne como su visitante') &&
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
      me: 'user ejecutiva',
      contexto: 'ejecutiva hoy config sedes_cerca mis_medicos contactos subtipos compromisos_vencidos voz',
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
        'id client_id tipo subtipo medico cuenta sede contacto modalidad medio efectiva failure_reason checked_in_at distance_m conclusion compromisos next_step_date lineas input_mode out_of_territory cuenta_para peso sede_por_confirmar editable',
      visitaCreate:
        'client_id tipo subtipo_id medico_id cuenta_id sede_id contacto_id modalidad medio efectiva failure_reason retry_date checked_in_at reported_at lat lng gps_accuracy_m conclusion compromisos next_step_date transcript input_mode lineas',
      visitaCreateResponse: 'visita repetida',
      transcripcion: 'transcript duracion_s modelo',
      propuesta: 'visitas aviso',
      visitaPropuesta:
        'tipo subtipo_codigo subtipo_id medico_id medico_nombre_dicho sugerir_crear_medico cuenta_id sede_id contacto_id contacto_nombre_dicho lineas efectiva failure_reason conclusion compromisos next_step_date modalidad_sugerida confianza preguntas',
      numeros: 'mes cuota hechas cumplimiento dias_habiles_sin_visitas telefonicas no_efectivas fuera_de_territorio sede_por_confirmar',
    }
    for (const forma of Object.keys(CLAVES_API) as (keyof typeof CLAVES_API)[]) {
      const app = [...CLAVES_API[forma]].sort().join(' ')
      const contrato = CONTRATO[forma].split(' ').sort().join(' ')
      check(`${forma}: ${CLAVES_API[forma].length} claves, las del contrato`, app === contrato, { app, contrato })
    }
    check('tieneClaves detecta una clave de más o de menos', tieneClaves({ visitas: [], aviso: null }, 'propuesta') && !tieneClaves({ visitas: [] }, 'propuesta') && !tieneClaves({ visitas: [], aviso: null, extra: 1 }, 'propuesta'))
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
