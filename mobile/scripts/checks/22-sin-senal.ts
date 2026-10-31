/**
 * Sección 22 de scripts/movil-check.ts: la app de campo SIN SEÑAL (spec docs/specs/2026-10-30-campo-sin-senal-pwa.md,
 * decisión docs/decisiones/2026-10-30-campo-sin-senal-marcas-en-vez-de-rechazos.md).
 *   - lib/cola.ts v2: estados pendiente / enviando / enviada / no_enviada; una visita de ayer SÍ se encola y sigue
 *     pendiente pasada la medianoche; espera creciente (1, 2, 4… min, tope 15) que "Subir ahora" ignora; 401 detiene
 *     sin tocar nada; la versión 1 guardada se migra sin perder nada ("por_confirmar" → pendiente); "enviando" al
 *     cargar vuelve a pendiente.
 *   - lib/cola-fotos.ts: solo sube la foto de una visita enviada; reintenta con espera; la enviada suelta los bytes.
 *   - lib/propuesta.ts: validarBorrador ya NO bloquea por radio, sin GPS ni sede sin coordenadas y da las marcas previstas
 *     (espejo de marcasDeVisita de la web); médico no listado válido; motivo de lista; cuerpoDesdeBorrador lleva tz,
 *     gps_at, motivo_codigo, medico_no_listado y acepta presencial sin punto.
 *   - lib/ubicacion-pasos.ts: hasta 20 s y la lectura más precisa (mejorLectura, recogerMejorLectura).
 *   - lib/sesion-reglas.ts: token vencido con perfil guardado → 'entrar_vencida'.
 *   - lib/conexion.ts, lib/pwa.ts, lib/foto.ts, lib/instalacion.ts, components/EstadoCola.tsx: las reglas puras.
 *   - lib/almacen-idb.ts: el esquema agrega y nunca borra.
 *   - public/sw-cola.js, public/sw-registro.js e index.html: lo que el service worker necesita está donde debe.
 *
 * Corren en Node, sin React Native ni red. Este solo, desde mobile/:
 *   npx tsx scripts/checks/correr.ts 22-sin-senal
 */
import { ALMACEN_FOTOS, ALMACEN_KV, VERSION_BD, actualizar } from '../../lib/almacen-idb'
import {
  ColaVisitas,
  DIAS_CONSERVAR_NO_ENVIADA,
  ESPERA_MAX_MS,
  ESPERA_MIN_MS,
  ETIQUETA_ESTADO_COLA,
  VERSION_COLA,
  agregar,
  claveCola,
  claveColaV1,
  deserializar,
  esperaReintento,
  marcarFallo,
  migrarElemento,
  normalizar,
  podar,
  porEnviar,
  procesar,
  resumen,
  serializar,
  type AlmacenCola,
  type ElementoCola,
} from '../../lib/cola'
import { ETIQUETA_ESTADO_FOTO, fotosPorEnviar, nuevoRegistroFoto, podarFotos, procesarFotos, resumenFotos, type RegistroFoto } from '../../lib/cola-fotos'
import { estaConectado } from '../../lib/conexion-reglas'
import { ApiError, MENSAJE_SESION_VENCIDA, errorDeRespuesta } from '../../lib/errores'
import { FOTO_CALIDAD, FOTO_LADO_MAX, dimensionesComprimidas, textoBytes } from '../../lib/foto-reglas'
import { AVISO_INCOGNITO, PASOS_ANDROID, PASOS_IPHONE, pasosParaEsteTelefono } from '../../lib/instalacion'
import {
  AVISO_EN_COLA,
  AVISO_HABEAS_DATA,
  MENSAJE_MEDICO_NO_LISTADO_SIN_NOMBRE,
  MENSAJE_MOTIVO_LISTA,
  MOTIVO_OTRO,
  borradorVacio,
  cambiarBorrador,
  catalogoDesdeContexto,
  cuerpoDesdeBorrador,
  marcasPrevistas,
  resumenBorrador,
  validarBorrador,
  zonaHorariaDelTelefono,
} from '../../lib/propuesta'
import { almacenamientoDudoso } from '../../lib/pwa-reglas'
import { arranqueDeSesion } from '../../lib/sesion-reglas'
import { detalleFranja, textoEstadoConexion, textoPendientes } from '../../lib/estado-cola'
import { DIAS_MAX_ATRAS, ETIQUETA_MARCA, PRECISION_BAJA_M, type ContextoResponse, type VisitaCreate } from '../../lib/tipos'
import { PRECISION_SUFICIENTE_M, TIEMPO_PRECISA_MS, mejorLectura, recogerMejorLectura, ubicacionFinal, type FuentesUbicacion, type Lectura } from '../../lib/ubicacion-pasos'
import type { Probador } from './probador'

// Corre en Node (tsx) con el programa de tipos de la app (sin @types/node): fs y path con lo mínimo.
interface FsMinimo {
  readFileSync(ruta: string, codificacion: 'utf8'): string
  existsSync(ruta: string): boolean
}
interface PathMinimo {
  resolve(...partes: string[]): string
}
declare const __dirname: string
declare const require: (modulo: string) => unknown
const fs = require('fs') as FsMinimo
const path = require('path') as PathMinimo
const RAIZ = path.resolve(__dirname, '../..')
const leer = (relativa: string) => fs.readFileSync(path.resolve(RAIZ, relativa), 'utf8')

const AHORA = new Date('2026-10-13T15:42:00.000Z') // martes 13 de octubre de 2026, 10:42 en Bogotá
const HOY = '2026-10-13'
const SEDE = '22222222-2222-4222-8222-222222222222'
const MEDICO = '33333333-3333-4333-8333-333333333333'
const L1 = 'aaaaaaaa-0000-4000-8000-000000000001'
const C1 = 'cccccccc-0000-4000-8000-000000000001'
const TEL = { lat: 7.119349, lng: -73.122741 }
const norte = (m: number) => ({ lat: Math.round((TEL.lat + m / 111_195.08) * 1e6) / 1e6, lng: TEL.lng })

let secuencia = 0
function visita(extra: Partial<VisitaCreate> = {}): VisitaCreate {
  secuencia++
  const base: VisitaCreate = {
    client_id: `bbbbbbbb-aaaa-4aaa-8aaa-${String(secuencia).padStart(12, '0')}`,
    tipo: 'medica',
    medico_id: MEDICO,
    medico_no_listado: null,
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
    lat: TEL.lat,
    lng: TEL.lng,
    gps_accuracy_m: 12,
    conclusion: 'Le mostré PerOssal',
    compromisos: null,
    next_step_date: null,
    transcript: null,
    input_mode: 'toques',
    lineas: [L1],
    agenda_id: null,
    tz: 'America/Bogota',
    gps_at: '2026-10-13T10:30:00-05:00',
    motivo_codigo: null,
  }
  return { ...base, ...extra } as VisitaCreate
}

function almacenMemoria(inicial: string | null = null): AlmacenCola & { texto: () => string | null } {
  let texto = inicial
  return {
    leer: async () => texto,
    escribir: async t => {
      texto = t
    },
    texto: () => texto,
  }
}

const contexto: ContextoResponse = {
  ejecutiva: { id: 'e1', nombre: 'Ana', zona: 'Bucaramanga', municipio: '68001', lineas: [{ id: L1, code: 'PER', name: 'PerOssal' }] },
  hoy: { fecha: HOY, meta: { medica: 6, institucional: 1 }, hechas: { medicas: 0, institucionales: 0, telefonicas: 0, no_efectivas: 0 }, cuota_dia_ok: false },
  config: { radio_m: 300, telefonica: { habilitada: false, tope_dia: 1, medios: ['llamada'] }, tope_visitas_medico_dia: 1, perfil: ['medica', 'institucional'] },
  sedes_cerca: [{ id: SEDE, nombre: 'Clínica Norte', cuenta_id: C1, cuenta_nombre: 'Clínica Norte S.A.', cuenta_clase: 'clinica', ciudad: 'Bucaramanga', ...norte(120), distancia_m: 120, hospital_id: null, ubicacion_confirmada: true }],
  mis_medicos: [
    {
      id: MEDICO,
      nombre: 'Dra. Ana Gómez',
      especialidades: ['ortopedia'],
      municipality_id: '68001',
      lineas: [L1],
      sedes: [
        { id: SEDE, nombre: 'Clínica Norte', cuenta_nombre: 'Clínica Norte S.A.', distancia_m: 120, cuenta_id: C1, ...norte(120) },
        { id: 'sede-sin', nombre: 'Consultorio Gómez', cuenta_nombre: 'Consultorio', distancia_m: null, cuenta_id: null, lat: null, lng: null },
      ],
    },
  ],
  contactos: [],
  subtipos: [],
  compromisos_vencidos: [],
  voz: { transcribir: false, proponer: false },
  agenda_hoy: [],
  persona: { user_id: 'u1', nombre: 'Ana', executive_id: 'e1', rol: 'lider', lineas: [{ id: L1, nombre: 'PerOssal', como: 'lider' }] },
  motivos_no_efectiva: [
    { codigo: 'medico_no_estaba', nombre: 'El médico no estaba' },
    { codigo: 'otro', nombre: 'Otro' },
  ],
}
const nuevoId = () => `cccccccc-0000-4000-8000-${String(++secuencia).padStart(12, '0')}`

export async function pruebas(t: Probador): Promise<void> {
  // -------------------------------------------------------------------------------------------
  t.seccion('22a. Cola v2: estados, otro día, espera creciente y migración')
  {
    const ayer = visita({ checked_in_at: '2026-10-12T18:00:00-05:00', reported_at: '2026-10-12T18:10:00-05:00' })
    const conAyer = agregar([], { cuerpo: ayer, resumen: 'de ayer' }, AHORA)
    t.check('una visita de ayer SÍ se encola (ya no se rechaza por el día) y queda pendiente con su fecha', conAyer.nueva && conAyer.elemento.estado === 'pendiente' && conAyer.elemento.fecha === '2026-10-12')
    const despues = new Date('2026-10-14T05:00:00Z') // 00:00 del 14 en Bogotá
    t.check('pasada la medianoche sigue pendiente y se manda (sin "por confirmar" ni descarte)', porEnviar(conAyer.cola, despues).length === 1 && resumen(conAyer.cola, despues).pendientes === 1)
    t.check('ETIQUETA_ESTADO_COLA tiene los 4 estados que pide el dueño', Object.keys(ETIQUETA_ESTADO_COLA).sort().join() === 'enviada,enviando,no_enviada,pendiente' && ETIQUETA_ESTADO_COLA.enviando === 'Subiendo…')

    t.check('espera creciente: 1, 2, 4, 8 min… con tope de 15', esperaReintento(1) === 60_000 && esperaReintento(2) === 120_000 && esperaReintento(3) === 240_000 && esperaReintento(4) === 480_000 && esperaReintento(5) === ESPERA_MAX_MS && esperaReintento(9) === ESPERA_MAX_MS && ESPERA_MIN_MS === 60_000)
    const sinRed = new ApiError(0, 'Sin conexión')
    const fallida = marcarFallo(conAyer.cola, ayer.client_id, sinRed, AHORA)
    t.check('un fallo de red deja la visita pendiente, con el error visible y la próxima hora de intento', fallida[0].estado === 'pendiente' && fallida[0].error === 'Sin conexión' && fallida[0].intentos === 1 && fallida[0].proximo_intento_at === new Date(AHORA.getTime() + 60_000).toISOString())
    t.check('antes de esa hora no se manda sola; con "Subir ahora" (forzar) sí', porEnviar(fallida, AHORA).length === 0 && porEnviar(fallida, AHORA, { forzar: true }).length === 1 && porEnviar(fallida, new Date(AHORA.getTime() + 61_000)).length === 1)
    const dosFallos = marcarFallo(fallida, ayer.client_id, sinRed, new Date(AHORA.getTime() + 61_000))
    t.check('el segundo fallo espera 2 minutos', Date.parse(dosFallos[0].proximo_intento_at ?? '') - (AHORA.getTime() + 61_000) === 120_000)
    const vencida = marcarFallo(conAyer.cola, ayer.client_id, new ApiError(401, MENSAJE_SESION_VENCIDA), AHORA)
    t.check('401: sigue pendiente SIN espera (al volver a entrar sube enseguida)', vencida[0].estado === 'pendiente' && vencida[0].proximo_intento_at === null)
    const rechazo = marcarFallo(conAyer.cola, ayer.client_id, errorDeRespuesta(400, { error: 'Tu perfil no incluye visitas médicas' }), AHORA)
    t.check('400: no_enviada ("Con error") con el mensaje del servidor', rechazo[0].estado === 'no_enviada' && rechazo[0].error === 'Tu perfil no incluye visitas médicas' && ETIQUETA_ESTADO_COLA.no_enviada === 'Con error')

    // procesar: enviando → enviada, con guardar intermedio; 401 detiene; red detiene
    const guardados: string[][] = []
    const v1 = visita()
    const v2 = visita()
    const cola = agregar(agregar([], { cuerpo: v1, resumen: 'uno' }, AHORA).cola, { cuerpo: v2, resumen: 'dos' }, new Date(AHORA.getTime() + 1000)).cola
    const filas = new Map<string, string>()
    const enviar = async (cuerpo: VisitaCreate) => {
      const existente = filas.get(cuerpo.client_id)
      if (existente) return { visita_id: existente, repetida: true }
      const id = `visita-${filas.size + 1}`
      filas.set(cuerpo.client_id, id)
      return { visita_id: id, repetida: false }
    }
    const resultado = await procesar(cola, enviar, () => AHORA, { guardar: async c => void guardados.push(c.map(e => e.estado)) })
    t.check('procesar guarda "enviando" antes de cada envío y termina con las dos enviadas', guardados.length === 2 && guardados[0].join() === 'enviando,pendiente' && guardados[1].join() === 'enviada,enviando' && resultado.enviadas.length === 2 && resultado.cola.every(e => e.estado === 'enviada'))
    t.check('reintentar lo ya enviado no duplica (el servidor responde repetida)', (await procesar(resultado.cola, enviar, () => AHORA)).enviadas.length === 0 && filas.size === 2)
    const atascada: ElementoCola[] = [{ ...cola[0], estado: 'enviando' }]
    t.check('una "enviando" que quedó de una app cerrada vuelve a pendiente al normalizar y se manda', normalizar(atascada)[0].estado === 'pendiente' && porEnviar(atascada, AHORA).length === 1)
    const parada = await procesar(cola, async () => {
      throw new ApiError(401, MENSAJE_SESION_VENCIDA)
    }, () => AHORA)
    t.check('401 en el primer envío: se detiene por sesión, nada enviado, todo pendiente', parada.detenida === 'sesion' && parada.enviadas.length === 0 && parada.cola.every(e => e.estado === 'pendiente'))
    const sinSenal = await procesar(cola, async () => {
      throw new TypeError('Network request failed')
    }, () => AHORA)
    t.check('sin red: se detiene por red tras el primero (no insiste con el resto)', sinSenal.detenida === 'red' && sinSenal.cola[0].intentos === 1 && sinSenal.cola[1].intentos === 0)

    // Podar: las pendientes NUNCA se podan, aunque sean viejas
    const viejaPendiente: ElementoCola = { ...conAyer.elemento, fecha: '2026-09-01' }
    const enviadaAyer: ElementoCola = { ...resultado.cola[0], enviada_at: '2026-10-12T20:00:00.000Z', fecha: '2026-10-12' }
    const noEnviadaVieja: ElementoCola = { ...rechazo[0], fecha: '2026-09-01', ultimo_intento_at: '2026-09-01T20:00:00.000Z' }
    const podada = podar([viejaPendiente, enviadaAyer, noEnviadaVieja], AHORA)
    t.check(`podar: la pendiente vieja se queda; la enviada de ayer y la no enviada de más de ${DIAS_CONSERVAR_NO_ENVIADA} días salen`, podada.length === 1 && podada[0].client_id === viejaPendiente.client_id)

    // Migración de la versión 1
    const v1Guardada = JSON.stringify({
      version: 1,
      items: [
        { client_id: 'x-1', cuerpo: visita(), resumen: 'vieja pendiente', fecha: '2026-10-12', creado_at: '2026-10-12T20:00:00.000Z', estado: 'pendiente', intentos: 3, ultimo_intento_at: null, error: 'Sin conexión', visita_id: null, enviada_at: null, repetida: false },
        { client_id: 'x-2', cuerpo: visita(), resumen: 'por confirmar', fecha: '2026-10-12', creado_at: '2026-10-12T21:00:00.000Z', estado: 'por_confirmar', intentos: 1, ultimo_intento_at: null, error: 'Pasó la medianoche…', visita_id: null, enviada_at: null, repetida: false },
        { client_id: 'x-3', cuerpo: visita(), resumen: 'no enviada', fecha: '2026-10-12', creado_at: '2026-10-12T21:00:00.000Z', estado: 'no_enviada', intentos: 1, ultimo_intento_at: null, error: 'x', visita_id: null, enviada_at: null, repetida: false },
      ],
    })
    const migrada = deserializar(v1Guardada)
    t.check('la cola versión 1 se lee: "por_confirmar" pasa a pendiente, lo demás se conserva, nada se pierde', migrada.length === 3 && migrada[1].estado === 'pendiente' && migrada[0].intentos === 3 && migrada[2].estado === 'no_enviada' && migrada.every(e => e.proximo_intento_at === null && e.con_foto === false))
    t.check('serializar escribe la versión 2 y se vuelve a leer igual', VERSION_COLA === 2 && JSON.parse(serializar(migrada)).version === 2 && deserializar(serializar(migrada)).length === 3)
    t.check('una versión futura o JSON dañado dan [] (nunca se lanza); migrarElemento rechaza lo que no es una visita', deserializar('{"version":3,"items":[{}]}').length === 0 && deserializar('{no').length === 0 && migrarElemento({ estado: 'pendiente' }) === null)
    t.check('las claves por usuario: v2 nueva y v1 para migrar', claveCola('u1') === 'opmap.cola.v2.u1' && claveColaV1('u1') === 'opmap.cola.v1.u1')
    const almacenV2 = almacenMemoria()
    const colaConVieja = new ColaVisitas(almacenV2, () => AHORA, { leer: async () => v1Guardada })
    const lista = await colaConVieja.listar()
    t.check('ColaVisitas lee la v1 del almacén viejo una vez y la une a la v2 (que queda escrita en versión 2)', lista.length === 3 && JSON.parse(almacenV2.texto() ?? '{}').version === 2)
    await colaConVieja.encolar(visita(), 'nueva', true)
    const conFoto = (await colaConVieja.listar()).find(e => e.resumen === 'nueva')
    t.check('encolar con foto marca con_foto; quitarla la desmarca', conFoto?.con_foto === true && (await colaConVieja.marcarFoto(conFoto!.client_id, false)).find(e => e.client_id === conFoto!.client_id)?.con_foto === false)
  }

  // -------------------------------------------------------------------------------------------
  t.seccion('22b. Cola de fotos: después de la visita, con reintentos')
  {
    const f1 = nuevoRegistroFoto({ client_id: 'c1', usuario_id: 'u1', blob: null, uri: 'file:///f1.jpg', bytes: 120_000 }, AHORA)
    const f2 = nuevoRegistroFoto({ client_id: 'c2', usuario_id: 'u1', blob: null, uri: 'file:///f2.jpg', bytes: 90_000 }, new Date(AHORA.getTime() + 1000))
    t.check('fotosPorEnviar: solo las de visitas ya enviadas', fotosPorEnviar([f1, f2], new Set(['c2']), AHORA).map(f => f.client_id).join() === 'c2' && fotosPorEnviar([f1, f2], new Set(), AHORA).length === 0)
    const guardadas: RegistroFoto[] = []
    const subidas: string[] = []
    const resultado = await procesarFotos({
      fotos: [f1, f2],
      visitasEnviadas: new Set(['c1', 'c2']),
      subir: async clientId => {
        subidas.push(clientId)
        if (clientId === 'c2') throw new TypeError('Network request failed')
        return { repetida: false }
      },
      datos: async r => r.uri,
      guardar: async r => void guardadas.push(r),
      borrarDatos: async () => undefined,
      reloj: () => AHORA,
    })
    t.check('la primera sube (enviada, sin bytes) y la segunda falla por red: queda pendiente con espera y se detiene', subidas.join() === 'c1,c2' && resultado.fotos[0].estado === 'enviada' && resultado.fotos[0].uri === null && resultado.fotos[1].estado === 'pendiente' && resultado.fotos[1].proximo_intento_at !== null && resultado.detenida === 'red')
    t.check('cada cambio de estado se guarda (enviando, enviada; enviando, pendiente)', guardadas.map(g => `${g.client_id}:${g.estado}`).join() === 'c1:enviando,c1:enviada,c2:enviando,c2:pendiente')
    const rechazada = await procesarFotos({ fotos: [f2], visitasEnviadas: new Set(['c2']), subir: async () => { throw errorDeRespuesta(400, { error: 'La foto debe ser JPEG' }) }, datos: async r => r.uri, guardar: async () => undefined, borrarDatos: async () => undefined, reloj: () => AHORA, forzar: true })
    t.check('400: no_enviada con el mensaje ("Foto con error")', rechazada.fotos[0].estado === 'no_enviada' && rechazada.fotos[0].error === 'La foto debe ser JPEG' && ETIQUETA_ESTADO_FOTO.no_enviada === 'Foto con error')
    const sinBytes = await procesarFotos({ fotos: [f2], visitasEnviadas: new Set(['c2']), subir: async () => ({ repetida: false }), datos: async () => null, guardar: async () => undefined, borrarDatos: async () => undefined, reloj: () => AHORA })
    t.check('sin los bytes (el navegador los borró): no_enviada con aviso, sin llamar al servidor', sinBytes.fotos[0].estado === 'no_enviada' && /ya no está/.test(sinBytes.fotos[0].error ?? ''))
    t.check('resumenFotos y podarFotos: la enviada hoy cuenta hoy; la enviada ayer se poda, la pendiente nunca', resumenFotos(resultado.fotos, AHORA).enviadas_hoy === 1 && resumenFotos(resultado.fotos, AHORA).pendientes === 1 && podarFotos([{ ...resultado.fotos[0], enviada_at: '2026-10-12T20:00:00.000Z' }, f2], AHORA).quedan.length === 1)
  }

  // -------------------------------------------------------------------------------------------
  t.seccion('22c. Reportar sin bloquear: marcas previstas, médico no listado, motivo de lista y el cuerpo')
  {
    const catalogo = catalogoDesdeContexto(contexto, {}, TEL)
    t.check('el catálogo trae los motivos de la lista y la sede del médico con coordenadas se mide desde aquí', catalogo.motivos.length === 2 && catalogo.medicos[0].sedes[0].distancia_m === 120 && catalogo.medicos[0].sedes[0].coordenadas_desconocidas === false)
    const entrada = (extra: { punto?: ({ lat: number; lng: number; precision?: number | null }) | null; checked_in_at?: string } = {}) => ({ punto: extra.punto === undefined ? { ...TEL, precision: 12 } : extra.punto, checked_in_at: extra.checked_in_at ?? '2026-10-13T10:40:00.000-05:00', ahora: AHORA, visitasHoy: [] })
    const base = cambiarBorrador(borradorVacio(catalogo, { nuevoId, sedeElegida: SEDE }), { medico_id: MEDICO }, catalogo)
    const cerca = validarBorrador(base, catalogo, entrada())
    t.check('a 120 m con ±12 m: válida, en sitio y sin marcas', cerca.ok && cerca.en_sitio === true && cerca.marcas.length === 0 && cerca.distancia_m === 120, cerca)
    const lejos = validarBorrador(base, catalogo, entrada({ punto: { ...norte(-700), precision: 12 } }))
    t.check('a 820 m: VÁLIDA (ya no se bloquea) con la marca lejos_de_ips', lejos.ok && lejos.marcas.join() === 'lejos_de_ips' && lejos.en_sitio === false, lejos)
    t.check('a 320 m con ±30 m: en sitio (la precisión descuenta), como el servidor', validarBorrador(base, catalogo, entrada({ punto: { ...norte(120 + 200), precision: 30 } })).en_sitio === true)
    const sinGps = validarBorrador(base, catalogo, entrada({ punto: null }))
    t.check('sin GPS: VÁLIDA con la marca sin_ubicacion (antes bloqueaba)', sinGps.ok && sinGps.marcas.join() === 'sin_ubicacion' && sinGps.en_sitio === null, sinGps)
    const precisionBaja = validarBorrador(base, catalogo, entrada({ punto: { ...TEL, precision: 150 } }))
    t.check(`precisión de 150 m (> ${PRECISION_BAJA_M}): marca precision_baja`, precisionBaja.ok && precisionBaja.marcas.includes('precision_baja'))
    const sedeSin = validarBorrador(cambiarBorrador(base, { sede_id: 'sede-sin' }, catalogo), catalogo, entrada())
    t.check('sede sin coordenadas: VÁLIDA con la marca ips_sin_coordenadas (antes "Esta sede no tiene ubicación")', sedeSin.ok && sedeSin.marcas.join() === 'ips_sin_coordenadas', sedeSin)
    const ayer = validarBorrador(base, catalogo, entrada({ checked_in_at: '2026-10-12T10:40:00.000-05:00' }))
    t.check('ayer: VÁLIDA y sin hora_inconsistente (menos de 7 días)', ayer.ok && !ayer.marcas.includes('hora_inconsistente'))
    const hace8 = validarBorrador(base, catalogo, entrada({ checked_in_at: '2026-10-05T10:40:00.000-05:00' }))
    t.check(`hace 8 días (> ${DIAS_MAX_ATRAS}): VÁLIDA con hora_inconsistente`, hace8.ok && hace8.marcas.includes('hora_inconsistente'))
    t.check('marcasPrevistas es la misma regla que validarBorrador', marcasPrevistas(base, catalogo, entrada({ punto: null })).marcas.join() === 'sin_ubicacion')
    t.check('las marcas tienen etiqueta visible', Object.keys(ETIQUETA_MARCA).length === 7 && ETIQUETA_MARCA.lejos_de_ips === 'Lejos de la IPS')

    // Médico no listado
    const noListado = cambiarBorrador(borradorVacio(catalogo, { nuevoId, sedeElegida: SEDE }), { medico_no_listado: { nombre: 'Dr. Nuevo Pérez', especialidad: 'columna' } }, catalogo)
    const okNoListado = validarBorrador(noListado, catalogo, entrada())
    t.check('médico no listado con nombre e IPS: válido, sin medico_id, con la marca medico_por_validar', okNoListado.ok && noListado.medico_id === null && okNoListado.marcas.join() === 'medico_por_validar', okNoListado)
    const sinNombre = validarBorrador({ ...noListado, medico_no_listado: { nombre: '  ', especialidad: null } }, catalogo, entrada())
    t.check('sin nombre: el mensaje del servidor', sinNombre.errores.some(e => e.mensaje === MENSAJE_MEDICO_NO_LISTADO_SIN_NOMBRE))
    const vuelveALista = cambiarBorrador(noListado, { medico_id: MEDICO }, catalogo)
    t.check('elegir un médico de OpMap quita el no listado (son excluyentes)', vuelveALista.medico_id === MEDICO && !vuelveALista.medico_no_listado)
    t.check('resumen con el no listado', resumenBorrador(noListado, catalogo).includes('Dr. Nuevo Pérez (no listado)'))

    // Motivo de lista
    const noEfectiva = cambiarBorrador(base, { efectiva: false }, catalogo)
    t.check('no efectiva sin motivo de la lista: "Elige el motivo"', validarBorrador(noEfectiva, catalogo, entrada()).errores.some(e => e.mensaje === MENSAJE_MOTIVO_LISTA))
    const conMotivo = cambiarBorrador(noEfectiva, { motivo_codigo: 'medico_no_estaba', failure_reason: 'El médico no estaba' }, catalogo)
    t.check('con un motivo de la lista: válida', validarBorrador(conMotivo, catalogo, entrada()).ok)
    const otroSinTexto = cambiarBorrador(noEfectiva, { motivo_codigo: MOTIVO_OTRO, failure_reason: '' }, catalogo)
    t.check('"Otro" exige el texto', !validarBorrador(otroSinTexto, catalogo, entrada()).ok && validarBorrador({ ...otroSinTexto, failure_reason: 'Se fue temprano' }, catalogo, entrada()).ok)
    t.check('volver a efectiva limpia el motivo', cambiarBorrador(conMotivo, { efectiva: true }, catalogo).motivo_codigo === null)
    const sinLista = catalogoDesdeContexto({ ...contexto, motivos_no_efectiva: [] }, {}, TEL)
    t.check('sin lista (servidor anterior): el texto libre basta, como antes', validarBorrador(cambiarBorrador(cambiarBorrador(base, { efectiva: false }, sinLista), { failure_reason: 'No estaba' }, sinLista), sinLista, entrada()).ok)

    // Cuerpo
    const cuerpo = cuerpoDesdeBorrador(conMotivo, { punto: { ...TEL, precision: 12 }, checked_in_at: '2026-10-13T10:40:00.000-05:00', reported_at: '2026-10-13T10:41:00.000-05:00', transcript: null, tz: 'America/Bogota' })
    t.check('el cuerpo lleva tz, gps_at (= la llegada), motivo_codigo y failure_reason', cuerpo.tz === 'America/Bogota' && cuerpo.gps_at === '2026-10-13T10:40:00.000-05:00' && cuerpo.motivo_codigo === 'medico_no_estaba' && cuerpo.failure_reason === 'El médico no estaba' && cuerpo.medico_no_listado === null)
    const cuerpoSinGps = cuerpoDesdeBorrador(base, { punto: null, checked_in_at: '2026-10-13T10:40:00.000-05:00', reported_at: '2026-10-13T10:41:00.000-05:00', transcript: null })
    t.check('presencial sin punto: el cuerpo sale con lat/lng/gps_at null (ya no lanza)', cuerpoSinGps.modalidad === 'presencial' && cuerpoSinGps.lat === null && cuerpoSinGps.lng === null && cuerpoSinGps.gps_at === null && cuerpoSinGps.gps_accuracy_m === null)
    const cuerpoNoListado = cuerpoDesdeBorrador(noListado, { punto: { ...TEL, precision: 12 }, checked_in_at: '2026-10-13T10:40:00.000-05:00', reported_at: '2026-10-13T10:41:00.000-05:00', transcript: null })
    t.check('médico no listado en el cuerpo, con medico_id null', cuerpoNoListado.tipo === 'medica' && cuerpoNoListado.medico_id === null && cuerpoNoListado.medico_no_listado?.nombre === 'Dr. Nuevo Pérez' && cuerpoNoListado.medico_no_listado?.especialidad === 'columna')
    t.check('la zona horaria del teléfono es IANA (o Bogotá)', /^[A-Za-z_]+\/[A-Za-z_]+$|^UTC$/.test(zonaHorariaDelTelefono()))
    t.check('los avisos no hablan de medianoche y el de habeas data dice "nunca en segundo plano"', !/medianoche/i.test(AVISO_EN_COLA) && /segundo plano/i.test(AVISO_HABEAS_DATA))
  }

  // -------------------------------------------------------------------------------------------
  t.seccion('22d. Ubicación: hasta 20 s y la lectura más precisa')
  {
    // Revisión en iPhone (2026-10-30): en el navegador, expo-location pedía el permiso con permissions.query y un
    // getCurrentPosition sin tiempo máximo (Safari fallaba; Chrome se quedaba "Tomando tu ubicación…"). La web habla
    // con navigator.geolocation directo y todo lleva tiempo máximo.
    const ubicacionTs = leer('lib/ubicacion.ts')
    t.check(
      'en el navegador la ubicación va por navigator.geolocation directo (fuentesDelNavegador), con tiempo máximo en cada lectura y sin depender de permissions.query',
      /const fuentes: FuentesUbicacion = geo \? fuentesDelNavegador\(geo\) : fuentesDelTelefono/.test(ubicacionTs) &&
        /precisa: \(\) => leer\(\{ enableHighAccuracy: true, timeout: TIEMPO_PRECISA_MS, maximumAge: 0 \}\)/.test(ubicacionTs) &&
        /rapida: \(\) => leer\(\{ enableHighAccuracy: false, timeout: 10_000/.test(ubicacionTs) &&
        /timeout: 1_500, maximumAge: edadMaximaMs/.test(ubicacionTs) &&
        /geo\.watchPosition\(/.test(ubicacionTs) && /geo\.clearWatch\(id\)/.test(ubicacionTs) &&
        /return estado\.state !== 'denied'/.test(ubicacionTs) && /catch \{\s*return true\s*\}/.test(ubicacionTs)
    )
    t.check('la final espera hasta 20 s y corta con ±15 m o mejor', TIEMPO_PRECISA_MS === 20_000 && PRECISION_SUFICIENTE_M === 15)
    const lectura = (p: number | null, t0 = 0): Lectura => ({ lat: 4.6, lng: -74.08, precision: p, timestamp: 1_000_000 + t0 })
    t.check('mejorLectura: la de menor precisión; sin precisión es la peor; a igual precisión la más reciente', mejorLectura([lectura(40), lectura(8), lectura(null)])?.precision === 8 && mejorLectura([lectura(null)])?.precision === null && mejorLectura([lectura(8, 1), lectura(8, 2)])?.timestamp === 1_000_002 && mejorLectura([]) === null)
    const fuentes = (lecturas: { ms: number; l: Lectura }[], precisa: Promise<Lectura> = new Promise(() => undefined)): FuentesUbicacion => ({
      permiso: async () => true,
      precisa: () => precisa,
      ultima: async () => null,
      observar: alLeer => {
        const temporizadores = lecturas.map(({ ms, l }) => setTimeout(() => alLeer(l), ms))
        return () => temporizadores.forEach(clearTimeout)
      },
    })
    const mejor = await recogerMejorLectura(fuentes([{ ms: 5, l: lectura(60) }, { ms: 15, l: lectura(30) }, { ms: 25, l: lectura(45) }]), 60)
    t.check('recoge varias lecturas y devuelve la más precisa (30 m) al cumplirse el tiempo', mejor?.precision === 30)
    const inicio = Date.now()
    const rapida = await recogerMejorLectura(fuentes([{ ms: 5, l: lectura(60) }, { ms: 10, l: lectura(9) }, { ms: 500, l: lectura(3) }]), 400)
    t.check('corta antes del tiempo máximo con una lectura de ±9 m (sin esperar la de 3 m)', rapida?.precision === 9 && Date.now() - inicio < 300)
    const final = await ubicacionFinal(fuentes([{ ms: 5, l: lectura(70) }, { ms: 15, l: lectura(20) }]), { timeoutMs: 50 })
    t.check('ubicacionFinal con observación: la más precisa, con 6 decimales y precisión entera', final.ubicacion?.precision === 20 && final.ubicacion?.aproximada === false)
    t.check('sin lecturas en vivo pero con la puntual: la puntual', (await recogerMejorLectura(fuentes([], Promise.resolve(lectura(11))), 50))?.precision === 11)
  }

  // -------------------------------------------------------------------------------------------
  t.seccion('22e. Sesión vencida sin red, conexión, almacenamiento, instalación y textos')
  {
    const perfil = { usuario: { id: 'u1' } }
    t.check('token vencido con perfil guardado → entrar_vencida (se puede reportar a la cola)', arranqueDeSesion({ perfilGuardado: perfil, tokenVigente: false, tokenVencido: true, uidDelToken: 'u1' }) === 'entrar_vencida')
    t.check('token vencido sin perfil (o de otro usuario) → sin_sesion', arranqueDeSesion({ perfilGuardado: null, tokenVigente: false, tokenVencido: true }) === 'sin_sesion' && arranqueDeSesion({ perfilGuardado: perfil, tokenVigente: false, tokenVencido: true, uidDelToken: 'u2' }) === 'sin_sesion')
    t.check('las reglas de antes no cambian', arranqueDeSesion({ perfilGuardado: perfil, tokenVigente: true, uidDelToken: 'u1' }) === 'entrar_y_confirmar' && arranqueDeSesion({ perfilGuardado: null, tokenVigente: true }) === 'confirmar_antes' && arranqueDeSesion({ perfilGuardado: perfil, tokenVigente: false }) === 'sin_sesion')
    const sesionTs = leer('lib/sesion.ts')
    t.check('un 401 conserva el perfil y el contexto (conservar: true) y la cola no se toca; solo salir() los borra', (sesionTs.match(/conservar: true/g) ?? []).length >= 3 && /const salir = useCallback\(async \(\) => \{[\s\S]*?await api\.logout\(\)[\s\S]*?await olvidar\(null\)/.test(sesionTs) && !/opmap\.cola/.test(sesionTs))

    t.check('estaConectado: sin datos, conectado; navigator.onLine false manda; isInternetReachable false = sin conexión', estaConectado(null) && !estaConectado(null, false) && !estaConectado({ isConnected: true, isInternetReachable: false }) && estaConectado({ isConnected: true, isInternetReachable: null }))
    t.check('almacenamientoDudoso: IndexedDB que no abre o cuota de menos de 50 MB', almacenamientoDudoso({ idbAbre: false, cuotaBytes: null }) && almacenamientoDudoso({ idbAbre: true, cuotaBytes: 10 * 1024 * 1024 }) && !almacenamientoDudoso({ idbAbre: true, cuotaBytes: 2 * 1024 * 1024 * 1024 }) && !almacenamientoDudoso({ idbAbre: true, cuotaBytes: null }))
    t.check('textoPendientes: "Todo subido", visitas y fotos', textoPendientes(0, 0) === 'Todo subido' && textoPendientes(1, 0) === '1 visita pendiente por subir' && textoPendientes(3, 2) === '3 visitas pendientes por subir · 2 fotos pendientes')
    t.check('la franja: "En línea" / "Sin conexión"; con la sesión vencida sin red lo dice', textoEstadoConexion(true) === 'En línea' && textoEstadoConexion(false) === 'Sin conexión' && /sesión vencida/.test(detalleFranja({ enLinea: false, vencida: true, visitas: 1, fotos: 0 })) && detalleFranja({ enLinea: true, vencida: true, visitas: 1, fotos: 0 }) === '1 visita pendiente por subir')
    t.check('la foto se comprime a 1600 px y 70 %: 4000×3000 → 1600×1200; 1200×800 no se agranda', FOTO_LADO_MAX === 1600 && FOTO_CALIDAD === 0.7 && JSON.stringify(dimensionesComprimidas(4000, 3000)) === '{"ancho":1600,"alto":1200}' && JSON.stringify(dimensionesComprimidas(3000, 4000)) === '{"ancho":1200,"alto":1600}' && JSON.stringify(dimensionesComprimidas(1200, 800)) === '{"ancho":1200,"alto":800}' && textoBytes(1_300_000) === '1,2 MB' && textoBytes(50_000) === '49 KB')
    t.check('instalación: pasos para Android (Chrome) e iPhone (Safari, "Compartir") y el aviso del incógnito', PASOS_ANDROID.length >= 4 && PASOS_IPHONE.length >= 4 && /Compartir/.test(PASOS_IPHONE.join(' ')) && /Chrome/.test(PASOS_ANDROID[0]) && /incógnito/.test(AVISO_INCOGNITO) && pasosParaEsteTelefono(true) === 'iphone' && pasosParaEsteTelefono(false) === 'android')

    // IndexedDB: el esquema agrega y nunca borra
    const creados: string[] = []
    const bdFalsa = { objectStoreNames: { contains: (n: string) => creados.includes(n) }, createObjectStore: (n: string) => (creados.push(n), { createIndex: () => undefined }) }
    actualizar(bdFalsa, 0)
    actualizar(bdFalsa, 1)
    t.check(`IndexedDB versión ${VERSION_BD}: crea kv y fotos una sola vez; volver a correr no borra nada`, creados.join() === `${ALMACEN_KV},${ALMACEN_FOTOS}`)
    const idbTs = leer('lib/almacen-idb.ts')
    t.check('almacen-idb nunca borra la base ni un almacén, y migra lo que había en localStorage sin borrarlo', !/deleteDB\(|deleteObjectStore\(/.test(idbTs) && /localStorageSeguro\(\)\?\.getItem\(clave\)/.test(idbTs) && /kvLeer/.test(idbTs))

    // Service worker: lo que la app necesita está donde debe
    const indexHtml = leer('public/index.html')
    const swCola = leer('public/sw-cola.js')
    const swRegistro = leer('public/sw-registro.js')
    t.check('index.html carga sw-registro.js, que registra /campo/sw.js con alcance /campo/ y avisa la versión nueva', /sw-registro\.js/.test(indexHtml) && /register\('\/campo\/sw\.js', \{ scope: '\/campo\/' \}\)/.test(swRegistro) && /__campoSW/.test(swRegistro) && /updatefound/.test(swRegistro))
    t.check('sw-cola.js escucha sync "opmap-cola", lee opmap.token.v1 y opmap.cola.v2.*, hace POST /api/me/visitas y /api/me/visitas/foto, y nunca borra', /addEventListener\('sync'/.test(swCola) && /'opmap-cola'/.test(swCola) && /opmap\.token\.v1/.test(swCola) && /opmap\.cola\.v2\./.test(swCola) && /\/api\/me\/visitas'/.test(swCola) && /\/api\/me\/visitas\/foto'/.test(swCola) && !/\.delete\(|deleteDatabase|clear\(\)/.test(swCola))
    t.check('sw-cola.js con 401 se detiene y los rechazos de datos quedan no_enviada; la red reintenta con espera', /status === 401/.test(swCola) && /'no_enviada'/.test(swCola) && /proximo_intento_at/.test(swCola))
    // Revisión 2026-10-30: el worker cambia UNA visita por transacción (leer y escribir juntas) y nunca reescribe la cola
    // entera con una copia vieja (borraría lo que la página agregó mientras subía); y sube solo la cola del usuario del token.
    t.check('sw-cola.js escribe una visita a la vez en su transacción (actualizarElemento) y no vuelve a escribir la cola entera', /function actualizarElemento\(db, clave, clientId, cambios\)/.test(swCola) && /almacen\.get\(clave\)[\s\S]*?almacen\.put\(/.test(swCola) && !/JSON\.stringify\(\{ version: 2, items/.test(swCola) && !/function escribirKv/.test(swCola))
    t.check('sw-cola.js sube solo la cola del usuario del token (uidDelToken), no la de otros usuarios del teléfono', /function uidDelToken\(token\)/.test(swCola) && /PREFIJO_COLA \+ uid/.test(swCola) && !/getAllKeys/.test(swCola))
    const pwaTs = leer('lib/pwa.ts')
    t.check('Background Sync se detecta (SyncManager), no se supone; persist() se pide; la versión nueva se aplica con SKIP_WAITING', /'SyncManager' in w/.test(pwaTs) && /storage\?\.persist/.test(pwaTs) && /SKIP_WAITING/.test(pwaTs))
    const colaContexto = leer('lib/cola-contexto.tsx')
    t.check('la cola de la app: reintento al abrir, al volver a primer plano, al reconectar (subirAhora), cada minuto y Background Sync con pendientes', /AppState\.addEventListener/.test(colaContexto) && /useConexion\(subirAhora\)/.test(colaContexto) && /REINTENTO_MS = 60_000/.test(colaContexto) && /registrarSync\(\)/.test(colaContexto))
    const ubicacionTs = leer('lib/ubicacion.ts')
    t.check('la observación en vivo usa watchPositionAsync y se deja de observar (nunca en segundo plano)', /watchPositionAsync/.test(ubicacionTs) && /suscripcion\?\.remove\(\)/.test(ubicacionTs) && !/startLocationUpdatesAsync/.test(ubicacionTs))
    const appJson = JSON.parse(leer('app.json')) as { expo: { android: { blockedPermissions: string[] } } }
    t.check('app.json sigue bloqueando la ubicación en segundo plano en Android', appJson.expo.android.blockedPermissions.includes('ACCESS_BACKGROUND_LOCATION'))
    const nextConfig = fs.existsSync(path.resolve(RAIZ, '../web/next.config.js')) ? fs.readFileSync(path.resolve(RAIZ, '../web/next.config.js'), 'utf8') : ''
    t.check('la web abre la cámara al propio sitio (Permissions-Policy) para la foto', /camera=\(self\)/.test(nextConfig))
  }
}
