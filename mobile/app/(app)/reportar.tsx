/**
 * Reportar (contrato fase 8, sección "App móvil"; F4.1 agenda, spec 2026-10-14):
 *   1. ¿Dónde estás?: arriba las citas PENDIENTES de hoy, la más cercana primero, con su distancia y si está dentro del
 *      radio (ListaCitas); debajo "No agendada" con las sedes a menos de 1 km (y en el croquis), un buscador y
 *      "Crear sede aquí". Hablar y Por toques se habilitan solo después de elegir una cita o una sede. Con una cita, la
 *      tarjeta sale ya armada (tipo, médico o cuenta y subtipo, sede y agenda_id) y el dictado va con esa cita.
 *   2. Hablar (graba hasta 3 minutos con el nivel visible; el audio se borra al llegar la transcripción o al
 *      cancelar) → transcribiendo → tarjetas propuestas editables; o Por toques con los mismos campos. Cada tarjeta se
 *      confirma con un toque: nada se guarda sin confirmar. "Corregir hablando" vuelve a dictar sobre lo dicho.
 *   3. Resultado: lo que se guardó y lo que quedó en el teléfono (sin señal se sube solo al volver la señal; 0940).
 * Datos: POST /api/me/contexto (el punto en el cuerpo, no en la URL), GET /api/me/visitas?fecha=hoy (topes), POST
 * /api/me/voz/transcribir y /proponer, POST /api/me/visitas por la cola (lib/cola-contexto.tsx). La distancia que vale
 * la calcula el servidor.
 *
 * Reportar es una pestaña y queda montada: cada vez que se vuelve a ella se decide si es una llegada nueva (punto,
 * hora y sedes nuevos) o el mismo reporte (debeReiniciarReporte de lib/propuesta.ts). Sin señal al abrir, usa el
 * contexto guardado HOY (lib/contexto-guardado.ts) para que la visita quede en la cola con el punto y la hora del sitio.
 *
 * Ubicación en dos pasos (lib/ubicacion-pasos.ts, 2026-10-14): la lista sale con la primera ubicación (la última
 * conocida reciente o una lectura rápida) mientras llega la final (alta precisión, la regla de siempre). Las visitas de
 * hoy se piden a la vez que la ubicación. Confirmar (y el consultorio de Nuevo médico) usa siempre la final: la espera
 * si aún no llegó, con la tarjeta bloqueada (lugarDeLaVisita, datosParaConfirmar). Si la final se aleja más de 100 m de
 * la primera, se vuelve a pedir el contexto sin tapar la pantalla (conservando las sedes y contactos en uso:
 * contextoAlRecargar); mientras no llegue, las distancias que el servidor midió desde la primera no se usan (decide el
 * servidor). Mientras una tarjeta se envía no empieza otra llegada (pasoDelReporte): un "Reportar de nuevo" de Hoy se
 * aplaza en un ref propio y se arma solo cuando no se pierde nada (sin envíos, sin grabar, sin tarjetas abiertas —la
 * rechazada sigue a la vista— y no al volver de Nuevo médico o Nueva sede). El orden de la llegada (la final pendiente queda puesta
 * antes de mostrar la lista) está en arrancarLlegada. Todo eso es puro y se prueba en scripts/movil-check.ts (sección 14).
 *
 * Usabilidad (spec 2026-10-15, paquete 2; pruebas en scripts/checks/16-reportar.ts), con la MISMA calidad: las mismas
 * validaciones (validarBorrador), cada tarjeta se confirma con su toque y ninguna visita sale con la primera ubicación.
 *   - Antes de elegir, una línea guía arriba y sin botones deshabilitados al final. Elegir la cita o la sede pide ya el
 *     permiso del micrófono (Hablar empieza sin esperar).
 *   - Desde Hoy, tocar una cita pendiente la deja elegida aquí (tomarCitaParaReportar al recibir el foco), con las
 *     reglas de "Reportar de nuevo": si hay una tarjeta abierta, una grabación o un envío en curso, no borra nada y
 *     queda pendiente. Con la cita, el reporte por voz queda en 4 toques: cita, Hablar, Listo y Confirmar.
 *   - El contexto de hace menos de 3 minutos y de aquí mismo (lib/contexto-memoria.ts, planCargaReportar) se pinta ya,
 *     sin "Cargando tus citas…"; de 1 a 3 minutos se refresca sin tapar la pantalla.
 *   - Mientras Claude arma las visitas ya se ve "Lo que dijiste" (se pliega y se despliega).
 *   - La tarjeta de voz que está bien sale en resumen; "Confirmar visita 1 de N" va fijo al pie (Pantalla.pie).
 *   - La visita confirmada con próxima reunión de hoy en adelante (sin tope desde la 0850) ofrece "Agendar esa reunión".
 *   - Vibra con el 201 y deja las marcas de tiempo (lib/tiempos.ts) del dictado.
 *
 * Revisión 2026-10-15 (la misma calidad, sin sorpresas):
 *   - El pie dice QUÉ se confirma ("Efectiva · PerOssal y Reemplazo articular · sin conclusión": resumenParaPie) y, si
 *     falta algo o el servidor la rechazó, lo dice ahí mismo (avisoDelPie): la tarjeta por toques nace válida y se
 *     confirma de un toque, así que el pie no deja confirmar a ciegas.
 *   - En la fase de tarjetas, "¿Dónde estás?" pasa a una línea y "Lo que dijiste" va después de las tarjetas: el resumen
 *     se ve entero encima del pie.
 *   - Con el contexto de memoria no se pide nada antes de la lista, así que la señal se comprueba con las visitas de hoy
 *     (que se piden siempre): mientras no responden, "Hablar" espera; si fallan por red, sale "Sin señal" y solo "Por
 *     toques" (como antes, cuando cada llegada pedía el contexto). Así no se dicta para perder el audio.
 *   - La cita tocada en Hoy que quedó pendiente se ve (con "Reportar esa cita" y "Olvidarla") y NO arranca sola al
 *     terminar un envío: no borra lo recién confirmado ni "Agendar esa reunión".
 *   - "Descartar" pide confirmación.
 *
 * Estilo Uber (2026-10-15): sin encabezado; mientras se elige, el croquis arriba (tu punto, las sedes y el radio de la
 * cita o la sede elegida, components/Croquis.tsx) y la hoja con "¿Dónde estás?"; con tarjetas, "Revisa la visita".
 */
import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { Croquis } from '../../components/Croquis'
import { Buscador } from '../../components/reporte/Buscador'
import { Grabador, pedirPermisoMicrofono } from '../../components/reporte/Grabador'
import { ListaCitas } from '../../components/reporte/ListaCitas'
import { ListaSedes } from '../../components/reporte/ListaSedes'
import { ESTADO_TARJETA_INICIAL, PieConfirmar, TarjetaBorrador, type EstadoTarjeta } from '../../components/reporte/TarjetaBorrador'
import { fijarPedidoAgendar, puedeAgendarProxima, rutaAgendar, type PedidoAgendar } from '../../lib/agenda'
import * as api from '../../lib/api'
import { borrarAudio } from '../../lib/audio'
import { useCola } from '../../lib/cola-contexto'
import { guardarContexto, leerContextoGuardado } from '../../lib/contexto-guardado'
import { FRESCURA_PINTAR_MS, contextoReciente } from '../../lib/contexto-memoria'
import { aApiError, esNoDisponible, esTransitorio, mensajeDeError, type ApiError } from '../../lib/errores'
import { fechaLarga, horaBogota, hoyBogota, isoBogota } from '../../lib/fechas'
import { textoDistancia, textoPrecision, type Punto } from '../../lib/geo'
import { segundosDe } from '../../lib/grabacion'
import { vibrarAviso, vibrarExito } from '../../lib/haptica'
import { Icono } from '../../lib/iconos'
import { nuevoClientId } from '../../lib/id'
import {
  AVISO_EN_COLA,
  AVISO_HABEAS_DATA,
  aplicarCitaAPropuestas,
  borradorDesdeCita,
  borradorDesdeCuerpo,
  borradoresDesdePropuesta,
  borradorVacio,
  cambiarBorrador,
  catalogoDesdeContexto,
  citasParaReportar,
  cuerpoDesdeBorrador,
  debeReiniciarReporte,
  descartarYaConfirmadas,
  hayEleccion,
  interpretarRechazo,
  resumenBorrador,
  validarBorrador,
  type Borrador,
  type Catalogo,
  type ExtrasCatalogo,
  type MedicoOpcion,
  type SedeOpcion,
  type VisitaHoyTope,
} from '../../lib/propuesta'
import { conQuienCita, cuentaDistinta, plural, sinCortes, textoHoraCita } from '../../lib/reglas'
import {
  escucharRetorno,
  fijarCitaParaReportar,
  fijarPedido,
  fijarReintento,
  tomarCitaParaReportar,
  tomarReintento,
  type ReintentoReporte,
  type Retorno,
} from '../../lib/retorno'
import { useSesion } from '../../lib/sesion'
import { avisoDelPie, pedidoAgendarDe, resumenParaPie } from '../../lib/tarjeta-resumen'
import { marcar } from '../../lib/tiempos'
import type { CitaItem, ContactoContexto, ContextoResponse, SedeBusquedaItem, VisitaItem, VisitasResponse } from '../../lib/tipos'
import { pedirUbicacion, pedirUbicacionEnDosPasos, type ResultadoUbicacion, type Ubicacion } from '../../lib/ubicacion'
import {
  DISTANCIA_RECARGA_M,
  abiertasAlTerminarEnvio,
  arrancarLlegada,
  contextoAlRecargar,
  datosParaConfirmar,
  debeRecargarContexto,
  estaAfinando,
  lugarDeLaVisita,
  pasoDelReporte,
  planCargaReportar,
  type PasoDelReporte,
} from '../../lib/ubicacion-pasos'
import { Aviso, Bloque, BordeHoja, Boton, Cargando, Grupo, Insignia, Pantalla, Seccion, Subtitulo, Tarjeta, Texto, Titulo, confirmar, useColores } from '../../lib/ui'

type Fase = 'ubicando' | 'lista' | 'grabando' | 'transcribiendo' | 'proponiendo' | 'tarjetas'

interface Resultado {
  clave: string
  client_id: string
  resumen: string
  estado: 'enviada' | 'pendiente'
  visita_id: string | null
  repetida: boolean
  /** Próxima reunión de esa visita (AAAA-MM-DD) y con quién, para "Agendar esa reunión". */
  proxima: string | null
  pedidoAgendar: PedidoAgendar | null
}

/**
 * Lo que Hoy le pide a Reportar (en memoria, lib/retorno.ts): volver a armar una visita que el servidor no aceptó
 * ("Reportar de nuevo") o reportar una cita pendiente que se tocó (spec 2026-10-15). Los dos siguen pasoDelReporte; la
 * cita entra siempre como aplazada: solo se elige cuando no se pierde nada abierto.
 */
type PedidoDeHoy = { reintento: ReintentoReporte; cita_id?: undefined } | { cita_id: string; reintento?: undefined }

const pedidoDeReintento = (reintento: ReintentoReporte | null): PedidoDeHoy | null => (reintento ? { reintento } : null)
const pedidoDeCita = (citaId: string | null): PedidoDeHoy | null => (citaId ? { cita_id: citaId } : null)
/**
 * Al terminar un envío solo se arma solo el "Reportar de nuevo" aplazado; la cita tocada en Hoy no (revisión
 * 2026-10-15): arrancar otra llegada borraría lo recién confirmado y "Agendar esa reunión". La cita sigue pendiente, a la
 * vista, con "Reportar esa cita".
 */
const soloReintento = (pedido: PedidoDeHoy | null): PedidoDeHoy | null => (pedido?.reintento ? pedido : null)

const MENSAJE_CITA_NO_DISPONIBLE = 'La cita que tocaste ya no está pendiente de hoy (quizá ya la reportaste o la cancelaron). Elige dónde estás.'

/** Con la voz disponible, el permiso del micrófono se pide ya (al elegir la cita o la sede): "Hablar" empieza sin esperar. */
function prepararMicrofono(contexto: ContextoResponse | null | undefined, sinSenal: boolean) {
  if (contexto?.voz.transcribir && contexto.voz.proponer && !sinSenal) void pedirPermisoMicrofono()
}

interface Extras {
  sedes: SedeOpcion[]
  medicos: MedicoOpcion[]
  contactos: ContactoContexto[]
}

const EXTRAS_VACIOS: Extras = { sedes: [], medicos: [], contactos: [] }

const TEXTO_TOMANDO_UBICACION = 'Tomando tu ubicación…'
const TEXTO_CARGANDO_SEDES = 'Cargando tus citas y las sedes cercanas…'

/** Une una opción nueva a la lista (la nueva reemplaza a la vieja del mismo id). */
function unir<T extends { id: string }>(lista: readonly T[], nuevas: readonly T[]): T[] {
  const ids = new Set(nuevas.map(n => n.id))
  return [...lista.filter(x => !ids.has(x.id)), ...nuevas]
}

/** Ubicando, grabando, transcribiendo o armando la propuesta: no se reinicia el reporte. */
function esFaseOcupada(fase: Fase): boolean {
  return fase === 'ubicando' || fase === 'grabando' || fase === 'transcribiendo' || fase === 'proponiendo'
}

/**
 * Aplica lo que decidió pasoDelReporte: empezar una llegada (y soltar el aplazado), aplazar el reintento en el ref
 * propio de Reportar (no en el global de Hoy: así un toque nuevo en Hoy no se confunde con uno aplazado) o seguir.
 */
function aplicarPaso(
  paso: PasoDelReporte<PedidoDeHoy>,
  aplazado: { current: PedidoDeHoy | null },
  iniciar: (reintento: PedidoDeHoy | null) => void
) {
  if (paso.accion === 'iniciar') {
    aplazado.current = null
    iniciar(paso.reintento)
  } else if (paso.accion === 'aplazar') aplazado.current = paso.reintento
}

export default function Reportar() {
  const router = useRouter()
  const cola = useCola()
  const { perfil } = useSesion()
  const usuarioId = perfil?.usuario.id ?? null
  const [fase, setFase] = useState<Fase>('ubicando')
  const [ubicacion, setUbicacion] = useState<Ubicacion | null>(null)
  const [errorUbicacion, setErrorUbicacion] = useState<string | null>(null)
  const [llegada, setLlegada] = useState<string>(() => isoBogota())
  const [contexto, setContexto] = useState<ContextoResponse | null>(null)
  /** El punto con que se pidió el contexto en uso (null: sin punto, o el guardado sin señal). */
  const [puntoContexto, setPuntoContexto] = useState<Punto | null>(null)
  const [errorContexto, setErrorContexto] = useState<ApiError | null>(null)
  const [visitasServidor, setVisitasServidor] = useState<VisitaItem[]>([])
  const [sedeElegida, setSedeElegida] = useState<string | null>(null)
  /** Cita de hoy elegida en el paso 1 (excluye la sede: es una o la otra). */
  const [citaElegida, setCitaElegida] = useState<string | null>(null)
  const [buscandoSede, setBuscandoSede] = useState(false)
  const [extras, setExtras] = useState<Extras>(EXTRAS_VACIOS)
  const [borradores, setBorradores] = useState<Borrador[]>([])
  const [estados, setEstados] = useState<Record<string, EstadoTarjeta>>({})
  const [transcript, setTranscript] = useState<string | null>(null)
  const [modoGrabacion, setModoGrabacion] = useState<'nuevo' | 'corregir'>('nuevo')
  const [avisoVoz, setAvisoVoz] = useState<string | null>(null)
  const [errorVoz, setErrorVoz] = useState<string | null>(null)
  const [resultados, setResultados] = useState<Resultado[]>([])
  /** Lo ya confirmado en este reporte (para que "Corregir hablando" no lo proponga otra vez). */
  const [confirmadas, setConfirmadas] = useState<Borrador[]>([])
  /** Sin señal al cargar: instante en que se guardó el contexto que se está usando (null: el contexto es de ahora). */
  const [sinSenalDesde, setSinSenalDesde] = useState<string | null>(null)
  const [errorReintento, setErrorReintento] = useState<string | null>(null)
  /** Mientras fase === 'ubicando': qué se está esperando (la ubicación o el contexto). */
  const [textoCarga, setTextoCarga] = useState(TEXTO_TOMANDO_UBICACION)
  /** Generación cuya final se está esperando (la lista ya salió con la primera); null: ninguna. Ver estaAfinando. */
  const [afinandoDe, setAfinandoDe] = useState<number | null>(null)
  /** "Actualizar" está tomando la ubicación otra vez. */
  const [reubicando, setReubicando] = useState(false)
  /** La cita que se tocó en Hoy ya no está pendiente. */
  const [avisoCita, setAvisoCita] = useState<string | null>(null)
  const iniciado = useRef(false)
  /** Cada llegada (iniciar) o "Actualizar" es una generación: lo que llega de una anterior no se aplica. */
  const generacion = useRef(0)
  /**
   * La ubicación final de esta llegada (la promesa, haya llegado o no): Confirmar y Nuevo médico la leen con
   * lugarDeLaVisita para no usar nunca la primera, tampoco en el instante entre que llega y la pantalla se vuelve a
   * pintar. null cuando lo que muestra la pantalla ya es final (no hubo dos pasos, o se tocó "Actualizar").
   */
  const finalPendiente = useRef<Promise<ResultadoUbicacion> | null>(null)
  /** Reportar mandó a Nuevo médico o Nueva sede: la próxima vez que reciba el foco es la vuelta (no se reinicia). */
  const esperandoCreacion = useRef(false)
  /** Tarjetas que se están enviando (esperando la final o la cola): mientras haya, no empieza otra llegada. */
  const enviosEnCurso = useRef(0)
  /**
   * "Reportar de nuevo" (o la cita tocada en Hoy) aplazado porque había un envío en curso, una tarjeta abierta o una
   * grabación (pasoDelReporte); se arma cuando no se pierde nada.
   */
  const aplazadoGuardado = useRef<PedidoDeHoy | null>(null)
  /** La cita de Hoy que quedó pendiente (espejo de reintentoAplazado para pintarla). */
  const [citaAplazada, setCitaAplazada] = useState<string | null>(null)
  const reintentoAplazado = useRef({
    get current(): PedidoDeHoy | null {
      return aplazadoGuardado.current
    },
    set current(valor: PedidoDeHoy | null) {
      aplazadoGuardado.current = valor
      setCitaAplazada(valor?.cita_id ?? null)
    },
  }).current
  /**
   * Con el contexto de memoria (sin pedir nada antes de la lista), la señal se comprueba con las visitas de hoy: mientras
   * no responden, "Hablar" espera (cargando) para no dictar sin red.
   */
  const [comprobandoSenal, setComprobandoSenal] = useState(false)
  /** El punto del contexto en uso, sin esperar al siguiente render (afinar lo compara con la final). */
  const puntoDelContexto = useRef<Punto | null>(null)
  /** Cada recarga sin tapar lleva su turno: la respuesta de una vieja que llega tarde no pisa a la nueva. */
  const recargas = useRef(0)
  /** Hay tarjetas nuevas sin tocar: el primer toque deja la marca primer_toque_tarjeta. */
  const primerToquePendiente = useRef(false)
  /** Cuándo llegó el contexto en uso (ms): es la hora que dice "Sin señal" si después falla la red. */
  const recibidoContexto = useRef<number | null>(null)

  const punto: (Punto & { precision: number | null }) | null = ubicacion ? { lat: ubicacion.lat, lng: ubicacion.lng, precision: ubicacion.precision } : null
  const sinSenal = sinSenalDesde !== null
  // Si el contexto se pidió con un punto lejos del de ahora, las distancias de las sedes de los médicos que midió el
  // servidor ya no valen (decide el servidor) hasta que llegue el contexto del punto nuevo.
  const distanciasDeOtroPunto = debeRecargarContexto(puntoContexto, punto)
  const catalogo = useMemo<Catalogo | null>(
    () => (contexto ? catalogoDesdeContexto(contexto, extras, punto, { sinSenal, distanciasDeOtroPunto }) : null),
    [contexto, extras, punto?.lat, punto?.lng, sinSenal, distanciasDeOtroPunto] // eslint-disable-line react-hooks/exhaustive-deps
  )

  /** Citas ya usadas en este reporte (una tarjeta confirmada la cumplió): no se vuelven a ofrecer. */
  const citasUsadas = useMemo(() => confirmadas.map(b => b.agenda_id).filter((id): id is string => !!id), [confirmadas])
  /** Las citas pendientes de hoy, medidas desde el punto de ahora, la más cercana primero. */
  const citasHoy = useMemo<CitaItem[]>(
    () => (contexto ? citasParaReportar(contexto.agenda_hoy, punto, contexto.config.radio_m, { usadas: citasUsadas, sinSenal }) : []),
    [contexto, punto?.lat, punto?.lng, citasUsadas, sinSenal] // eslint-disable-line react-hooks/exhaustive-deps
  )
  // La elegida con la distancia de ahora; si ya se usó (confirmada), la del contexto (para su sede y para mostrarla).
  const cita: CitaItem | null = citaElegida
    ? (citasHoy.find(c => c.id === citaElegida) ?? (contexto?.agenda_hoy ?? []).find(c => c.id === citaElegida) ?? null)
    : null
  /** La cita ya está en una tarjeta abierta o confirmada: otra visita en este reporte no la vuelve a tomar. */
  const citaEnUso = (id: string, tarjetas: readonly Borrador[] = borradores) => tarjetas.some(b => b.agenda_id === id) || confirmadas.some(b => b.agenda_id === id)
  /** Para mostrar en la tarjeta la cita que cumple. */
  const citaDe = (agendaId: string | null) => (agendaId ? ((contexto?.agenda_hoy ?? []).find(c => c.id === agendaId) ?? null) : null)
  /** Paso 1 hecho: hay una cita o una sede elegida. Sin eso no se graba ni se abre una tarjeta por toques. */
  const eligio = hayEleccion({ cita, sedeId: sedeElegida, catalogo })

  // Lo último, para los manejadores que viven más que un render (retorno de las pantallas de creación, foco, la espera
  // de la final al confirmar y la recarga del contexto: EstadoDelReporte de lib/ubicacion-pasos.ts).
  const ultimo = useRef({ contexto, puntoContexto, extras, punto, catalogo, sinSenal, llegada, fase, borradores: borradores.length, tarjetas: borradores, sedeElegida, cita })
  ultimo.current = { contexto, puntoContexto, extras, punto, catalogo, sinSenal, llegada, fase, borradores: borradores.length, tarjetas: borradores, sedeElegida, cita }

  /** Las visitas de hoy para los topes: las del servidor más las de la cola de hoy (sin repetir client_id). */
  const visitasHoy = useMemo<VisitaHoyTope[]>(() => {
    const hoy = hoyBogota()
    const lista: VisitaHoyTope[] = visitasServidor.map(v => ({ client_id: v.client_id, medico_id: v.medico?.id ?? null, modalidad: v.modalidad, efectiva: v.efectiva }))
    const vistos = new Set(lista.map(v => v.client_id).filter(Boolean))
    for (const e of cola.items) {
      if (e.fecha !== hoy || e.estado === 'no_enviada' || vistos.has(e.client_id)) continue
      lista.push({ client_id: e.client_id, medico_id: e.cuerpo.tipo === 'medica' ? e.cuerpo.medico_id : null, modalidad: e.cuerpo.modalidad, efectiva: e.cuerpo.efectiva })
    }
    return lista
  }, [visitasServidor, cola.items])

  /**
   * Contexto (con el punto) y visitas de hoy (las ya pedidas, si vienen). Sin señal (red, tiempo agotado o servidor
   * caído) usa el contexto que se guardó hoy; si no hay, el error. Devuelve el contexto que quedó en uso (o null) y si
   * es el guardado. Con `vigente` que da false (otra llegada empezó mientras tanto), no cambia nada.
   */
  /** El punto del contexto en uso: en el estado y en el ref (lo lee afinar antes del siguiente render). */
  const fijarPuntoContexto = useCallback((p: Punto | null) => {
    puntoDelContexto.current = p ? { lat: p.lat, lng: p.lng } : null
    setPuntoContexto(p ? { lat: p.lat, lng: p.lng } : null)
  }, [])

  const cargarContexto = useCallback(
    async (
      nuevo: Ubicacion | null,
      opciones: { visitas?: Promise<VisitasResponse>; vigente?: () => boolean } = {}
    ): Promise<{ contexto: ContextoResponse; sinSenal: boolean } | null> => {
      const hoy = hoyBogota()
      const vigente = opciones.vigente ?? (() => true)
      const [ctx, vis] = await Promise.allSettled([
        api.contexto(nuevo ? { lat: nuevo.lat, lng: nuevo.lng, precision: nuevo.precision } : null),
        opciones.visitas ?? api.visitas(hoy),
      ])
      if (!vigente()) return null
      if (vis.status === 'fulfilled') setVisitasServidor(vis.value.items)
      if (ctx.status === 'fulfilled') {
        setContexto(ctx.value)
        fijarPuntoContexto(nuevo)
        setErrorContexto(null)
        setSinSenalDesde(null)
        recibidoContexto.current = Date.now()
        void guardarContexto(usuarioId, ctx.value)
        return { contexto: ctx.value, sinSenal: false }
      }
      const error = aApiError(ctx.reason)
      if (esTransitorio(error)) {
        const guardado = await leerContextoGuardado(usuarioId)
        if (!vigente()) return null
        if (guardado) {
          setContexto(guardado.contexto)
          fijarPuntoContexto(null)
          setErrorContexto(null)
          setSinSenalDesde(guardado.guardado_at)
          recibidoContexto.current = Date.parse(guardado.guardado_at)
          return { contexto: guardado.contexto, sinSenal: true }
        }
      }
      setErrorContexto(error)
      return null
    },
    [usuarioId, fijarPuntoContexto]
  )

  /**
   * Vuelve a pedir el contexto con `lugar` SIN tapar la pantalla (la final que se alejó, o el refresco de lo que se
   * pintó de memoria), conservando las sedes y los contactos en uso (contextoAlRecargar). Solo vale la respuesta de la
   * última recarga de esta generación: una más vieja que llega tarde no pisa a la nueva. Sin respuesta, queda el de
   * antes, con las distancias medidas desde el punto nuevo (las de las sedes de médicos sin coordenadas, desconocidas:
   * decide el servidor).
   */
  const recargarSinTapar = useCallback(
    async (gen: number, lugar: Ubicacion) => {
      const turno = ++recargas.current
      try {
        const ctx = await api.contexto({ lat: lugar.lat, lng: lugar.lng, precision: lugar.precision })
        if (gen !== generacion.current || turno !== recargas.current) return
        const { contexto: conservado, sedes: conservar } = contextoAlRecargar(ultimo.current, ctx)
        if (conservar.length > 0) setExtras(prev => ({ ...prev, sedes: unir(prev.sedes, conservar) }))
        setContexto(conservado)
        fijarPuntoContexto(lugar)
        setErrorContexto(null)
        setSinSenalDesde(null)
        recibidoContexto.current = Date.now()
        void guardarContexto(usuarioId, ctx)
      } catch (lanzado) {
        // Sin respuesta: queda el contexto de antes. Si fue la red, se dice "Sin señal" (y "Hablar" no se ofrece).
        if (gen !== generacion.current || turno !== recargas.current || !esTransitorio(aApiError(lanzado))) return
        setSinSenalDesde(prev => prev ?? new Date(recibidoContexto.current ?? Date.now()).toISOString())
      }
    },
    [usuarioId, fijarPuntoContexto]
  )

  /**
   * Paso 2 de la ubicación: llega la final (la que vale para la visita) y reemplaza a la primera en la pantalla
   * (finalPendiente sigue apuntando a ella). Si se alejó más de DISTANCIA_RECARGA_M del punto con que se pidió el
   * contexto en uso (la primera, o el de memoria), se vuelve a pedir sin tapar la pantalla (recargarSinTapar).
   */
  const afinar = useCallback(
    async (gen: number, final: Promise<ResultadoUbicacion>, primera: Ubicacion | null) => {
      const resultado = await final
      // Si empezó otra generación, su "afinando" es suyo (y el de esta ya no se muestra: estaAfinando).
      if (gen !== generacion.current) return
      setAfinandoDe(null)
      // La regla de siempre: si no hubo lectura nueva ni última conocida de menos de 2 minutos, no hay ubicación.
      setUbicacion(resultado.ubicacion)
      setErrorUbicacion(resultado.error)
      if (resultado.ubicacion) setLlegada(resultado.ubicacion.tomada_at)
      const lugar = resultado.ubicacion
      if (!lugar || !debeRecargarContexto(puntoDelContexto.current ?? primera, lugar)) return
      await recargarSinTapar(gen, lugar)
    },
    [recargarSinTapar]
  )

  /**
   * El contexto de una llegada nueva (spec 2026-10-15, decisión 7; planCargaReportar): si el que está en memoria es de
   * hace menos de 3 minutos y de aquí mismo (a menos de DISTANCIA_RECARGA_M de la primera), se pinta ya, sin "Cargando
   * tus citas…" (y de 1 a 3 minutos se vuelve a pedir sin tapar la pantalla); si no, se pide como siempre.
   */
  const cargarLlegada = useCallback(
    async (gen: number, primera: Ubicacion | null, opciones: { visitas: Promise<VisitasResponse>; vigente: () => boolean }) => {
      const enMemoria = contextoReciente({ maxEdadMs: FRESCURA_PINTAR_MS, cercaDe: primera, maxDistanciaM: DISTANCIA_RECARGA_M })
      const plan = planCargaReportar({ enMemoria, primera, ahora: Date.now() })
      if (enMemoria && plan !== 'pedir') {
        setContexto(enMemoria.contexto)
        fijarPuntoContexto(enMemoria.punto)
        setErrorContexto(null)
        setSinSenalDesde(null)
        recibidoContexto.current = enMemoria.recibidoEn
        // Las visitas de hoy (topes) llegan cuando lleguen: no detienen la lista. Como aquí no se pidió nada antes de la
        // lista, son también la prueba de la señal: mientras no responden, "Hablar" espera; si fallan por red, "Sin
        // señal" con la hora de este contexto (y solo "Por toques"), como cuando cada llegada pedía el contexto.
        setComprobandoSenal(true)
        opciones.visitas.then(
          v => {
            if (!opciones.vigente()) return
            setVisitasServidor(v.items)
            setComprobandoSenal(false)
          },
          lanzado => {
            if (!opciones.vigente()) return
            setComprobandoSenal(false)
            if (esTransitorio(aApiError(lanzado))) setSinSenalDesde(new Date(enMemoria.recibidoEn).toISOString())
          }
        )
        if (plan === 'pintar_y_refrescar' && primera) void recargarSinTapar(gen, primera)
        return { contexto: enMemoria.contexto, sinSenal: false }
      }
      setTextoCarga(TEXTO_CARGANDO_SEDES)
      return cargarContexto(primera, opciones)
    },
    [cargarContexto, recargarSinTapar, fijarPuntoContexto]
  )

  /**
   * Empieza un reporte: ubicación del sitio (instante de llegada), contexto y visitas de hoy. Con un reintento (una
   * visita de la cola que el servidor no aceptó, desde Hoy) la vuelve a armar como tarjeta con el motivo del rechazo;
   * con una cita (tocada en Hoy) la deja elegida si sigue pendiente.
   */
  const iniciar = useCallback(
    async (pedido: PedidoDeHoy | null = null) => {
      const reintento = pedido?.reintento ?? null
      const citaDeHoy = pedido?.cita_id ?? null
      const gen = ++generacion.current
      // Si otra llegada empezó mientras tanto, esta no aplica nada (la visita por rehacer sigue en la cola, en Hoy).
      const vigente = () => gen === generacion.current
      finalPendiente.current = null
      setAfinandoDe(null)
      setReubicando(false)
      setTextoCarga(TEXTO_TOMANDO_UBICACION)
      setFase('ubicando')
      setBorradores([])
      setEstados({})
      setResultados([])
      setConfirmadas([])
      setTranscript(null)
      setAvisoVoz(null)
      setErrorVoz(null)
      setErrorReintento(null)
      setExtras(EXTRAS_VACIOS)
      setSedeElegida(null)
      setCitaElegida(null)
      setBuscandoSede(false)
      setAvisoCita(null)
      setComprobandoSenal(false)
      esperandoCreacion.current = false
      primerToquePendiente.current = false
      // Las visitas de hoy no dependen del punto: se piden ya, a la vez que la ubicación.
      const pedidoVisitas = api.visitas(hoyBogota())
      pedidoVisitas.catch(() => undefined) // el error lo lee cargarContexto
      // arrancarLlegada (lib/ubicacion-pasos.ts) pone la final pendiente al recibir la primera, pide el contexto con la
      // primera y afina con la final; la lista se muestra solo cuando resuelve.
      const llegadaNueva = await arrancarLlegada(pedirUbicacionEnDosPasos({ timeoutMs: 10_000 }), {
        vigente,
        conLaPrimera: estado => {
          finalPendiente.current = estado.finalPendiente
          setAfinandoDe(estado.finalPendiente ? gen : null)
          setUbicacion(estado.ubicacion)
          setErrorUbicacion(estado.error)
          setLlegada(estado.llegada)
        },
        // "Cargando tus citas…" solo si hay que pedir el contexto (cargarLlegada).
        cargar: primera => cargarLlegada(gen, primera, { visitas: pedidoVisitas, vigente }),
        afinar: (final, primera) => void afinar(gen, final, primera),
      })
      if (!llegadaNueva) return
      const { primera, cargado } = llegadaNueva
      if (reintento) {
        if (!cargado) {
          fijarReintento(reintento) // se arma la próxima vez que haya contexto
          setErrorReintento('No se pudo cargar tus sedes y médicos para volver a armar la visita. Reintenta con señal.')
        } else {
          const p = primera.ubicacion ? { lat: primera.ubicacion.lat, lng: primera.ubicacion.lng } : null
          const cat = catalogoDesdeContexto(cargado.contexto, EXTRAS_VACIOS, p, { sinSenal: cargado.sinSenal })
          const borrador = borradorDesdeCuerpo(reintento.cuerpo, cat, { nuevoId: nuevoClientId, motivo: reintento.error })
          setBorradores([borrador])
          setEstados({
            [borrador.clave]: { intentado: true, enviando: false, rechazo: reintento.error ? interpretarRechazo({ message: reintento.error }) : null },
          })
          primerToquePendiente.current = true
          setFase('tarjetas')
          await cola.quitar(reintento.client_id) // la tarjeta lo tiene todo; la vieja sale de la cola
          return
        }
      }
      setFase('lista')
      marcar('lista_pintada')
      // La cita tocada en Hoy: la de este pedido o una que llegó (aplazada) mientras esta llegada cargaba.
      const aplazada = reintentoAplazado.current?.cita_id ?? null
      if (aplazada && !citaDeHoy) reintentoAplazado.current = null
      const citaPorElegir = citaDeHoy ?? aplazada
      if (!citaPorElegir) return
      if (!cargado) {
        fijarCitaParaReportar(citaPorElegir) // "Reintentar" la vuelve a tomar
        return
      }
      const sigue = citasParaReportar(cargado.contexto.agenda_hoy, null, cargado.contexto.config.radio_m, { sinSenal: cargado.sinSenal }).some(c => c.id === citaPorElegir)
      if (sigue) {
        setCitaElegida(citaPorElegir)
        setSedeElegida(null)
        prepararMicrofono(cargado.contexto, cargado.sinSenal)
      } else {
        setAvisoCita(MENSAJE_CITA_NO_DISPONIBLE)
      }
    },
    [cargarLlegada, cola, afinar]
  )

  /**
   * Vuelve a tomar la ubicación sin perder las tarjetas (el instante de llegada pasa a ser este). No se ofrece mientras
   * se afina la primera (ya se está tomando).
   */
  const reubicar = useCallback(async () => {
    const gen = ++generacion.current
    const vigente = () => gen === generacion.current
    // Desde aquí vale lo que muestre la pantalla (la final de antes y, cuando llegue, la de ahora).
    finalPendiente.current = null
    setReubicando(true)
    try {
      const resultado = await pedirUbicacion({ timeoutMs: 10_000 })
      if (!vigente()) return
      if (resultado.ubicacion) {
        setUbicacion(resultado.ubicacion)
        setLlegada(resultado.ubicacion.tomada_at)
        setErrorUbicacion(null)
        await cargarContexto(resultado.ubicacion, { vigente })
      } else {
        setErrorUbicacion(resultado.error)
      }
    } finally {
      if (vigente()) setReubicando(false)
    }
  }, [cargarContexto])

  // Cada vez que Reportar recibe el foco (la primera vez, al volver de Hoy o de otra pestaña): llegada nueva salvo que
  // esté grabando, vuelva de crear un médico o una sede, tenga tarjetas recientes sin confirmar o alguna tarjeta se
  // esté enviando (pasoDelReporte: un "Reportar de nuevo" se aplaza hasta que termine el envío sin dejar nada
  // abierto). Lee el estado de `ultimo` para que esto corra SOLO al recibir el foco (no cada vez que cambian las
  // tarjetas o la fase).
  const iniciarRef = useRef(iniciar)
  iniciarRef.current = iniciar
  useFocusEffect(
    useCallback(() => {
      const reintento = tomarReintento()
      // La cita que se tocó en Hoy (spec 2026-10-15) entra como aplazada: solo se elige si no se pierde nada abierto (una
      // tarjeta, una grabación o un envío en curso); la más reciente reemplaza a la que esperaba.
      const citaDeHoy = pedidoDeCita(tomarCitaParaReportar())
      const { llegada: llegadaActual, fase: faseActual, borradores: pendientes } = ultimo.current
      const volviendo = esperandoCreacion.current
      esperandoCreacion.current = false
      const ocupada = esFaseOcupada(faseActual)
      const paso = pasoDelReporte({
        motivo: 'foco',
        iniciado: iniciado.current,
        nuevo: pedidoDeReintento(reintento),
        aplazado: citaDeHoy ?? reintentoAplazado.current,
        enviando: enviosEnCurso.current,
        ocupada,
        abiertas: pendientes,
        volviendoDeCrear: volviendo,
        reiniciar: debeReiniciarReporte({ llegada: llegadaActual, ahora: new Date(), borradores: pendientes, ocupada, esperandoCreacion: volviendo }),
      })
      iniciado.current = true
      aplicarPaso(paso, reintentoAplazado, r => void iniciarRef.current(r))
    }, [])
  )

  // Lo que se creó en Nuevo médico, Nueva sede o Nuevo contacto vuelve aquí y queda puesto en la tarjeta que lo pidió.
  useEffect(
    () =>
      escucharRetorno((retorno: Retorno) => {
        const { contexto: ctx, extras: ext, punto: p, sinSenal: offline } = ultimo.current
        const nuevos: Extras =
          retorno.tipo === 'medico'
            ? { ...ext, medicos: unir(ext.medicos, [retorno.medico]) }
            : retorno.tipo === 'contacto'
              ? { ...ext, contactos: unir(ext.contactos, [retorno.contacto]) }
              : { ...ext, sedes: unir(ext.sedes, [retorno.sede]) }
        setExtras(nuevos)
        if (!ctx) return
        const cat = catalogoDesdeContexto(ctx, nuevos as ExtrasCatalogo, p, { sinSenal: offline })
        if (retorno.clave) {
          const cambios: Partial<Borrador> =
            retorno.tipo === 'medico'
              ? { medico_id: retorno.medico.id }
              : retorno.tipo === 'contacto'
                ? { contacto_id: retorno.contacto.id }
                : retorno.sede.cuenta_id
                  ? { cuenta_id: retorno.sede.cuenta_id, sede_id: retorno.sede.id }
                  : { sede_id: retorno.sede.id }
          setBorradores(prev => prev.map(b => (b.clave === retorno.clave ? cambiarBorrador(b, cambios, cat) : b)))
        } else if (retorno.tipo === 'sede') {
          setSedeElegida(retorno.sede.id)
          setCitaElegida(null)
        }
      }),
    []
  )

  const estadoDe = (clave: string) => estados[clave] ?? ESTADO_TARJETA_INICIAL
  const fijarEstado = (clave: string, cambios: Partial<EstadoTarjeta>) =>
    setEstados(prev => ({ ...prev, [clave]: { ...(prev[clave] ?? ESTADO_TARJETA_INICIAL), ...cambios } }))

  /** El primer toque en las tarjetas nuevas deja su marca de tiempo (una vez por tanda). */
  const tocarTarjeta = () => {
    if (!primerToquePendiente.current) return
    primerToquePendiente.current = false
    marcar('primer_toque_tarjeta')
  }

  const cambiar = (clave: string, cambios: Partial<Borrador>) => {
    tocarTarjeta()
    if (!catalogo) return
    setBorradores(prev => prev.map(b => (b.clave === clave ? cambiarBorrador(b, cambios, catalogo) : b)))
    if (estadoDe(clave).rechazo) fijarEstado(clave, { rechazo: null })
  }

  /** Paso 1: la cita o la sede (una excluye la otra). El aviso de una voz que falló era del intento anterior: se quita. */
  const elegirCita = (id: string | null) => {
    setCitaElegida(id)
    if (id) {
      setSedeElegida(null)
      prepararMicrofono(contexto, sinSenal)
    }
    setErrorVoz(null)
    setAvisoCita(null)
  }
  const elegirSede = (id: string | null) => {
    setSedeElegida(id)
    if (id) {
      setCitaElegida(null)
      prepararMicrofono(contexto, sinSenal)
    }
    setErrorVoz(null)
    setAvisoCita(null)
  }
  const elegirSedeBuscada = (item: SedeBusquedaItem) => {
    // Del buscador no vienen coordenadas: la distancia la decide el servidor al confirmar.
    const sede: SedeOpcion = {
      id: item.id,
      nombre: item.nombre,
      cuenta_id: item.cuenta_id,
      cuenta_nombre: item.cuenta_nombre,
      cuenta_clase: null,
      lat: null,
      lng: null,
      distancia_m: null,
      ubicacion_confirmada: null,
      coordenadas_desconocidas: true,
    }
    setExtras(prev => ({ ...prev, sedes: unir(prev.sedes, [sede]) }))
    elegirSede(item.id)
    setBuscandoSede(false)
  }

  /** Por toques: con la cita elegida (y aún libre), la tarjeta sale armada con ella; si no, vacía en la sede elegida. */
  const porToques = () => {
    if (!catalogo || !eligio) return
    const nuevo =
      cita && !citaEnUso(cita.id)
        ? borradorDesdeCita(cita, catalogo, { nuevoId: nuevoClientId })
        : borradorVacio(catalogo, { nuevoId: nuevoClientId, sedeElegida: sedeElegida ?? cita?.sede.id ?? null })
    setBorradores(prev => [...prev, nuevo])
    primerToquePendiente.current = true
    setFase('tarjetas')
  }

  const hablar = (modo: 'nuevo' | 'corregir') => {
    marcar('toque_hablar')
    setErrorVoz(null)
    setModoGrabacion(modo)
    setFase('grabando')
  }

  /** La grabación terminó: se sube, se borra del teléfono en cuanto responde, y se pide la propuesta. */
  const alTerminarGrabacion = async (uri: string, duracionMs: number) => {
    marcar('fin_grabacion', { ms: duracionMs })
    const volver = borradores.length > 0 ? 'tarjetas' : 'lista'
    setFase('transcribiendo')
    let texto: string
    try {
      texto = (await api.transcribir(uri, segundosDe(duracionMs))).transcript
      marcar('transcripcion')
    } catch (lanzado) {
      setErrorVoz(mensajeDeError(lanzado))
      setFase(volver)
      return
    } finally {
      borrarAudio(uri)
    }
    if (!texto.trim()) {
      setErrorVoz('No se entendió nada en la grabación. Vuelve a intentarlo o reporta por toques.')
      setFase(volver)
      return
    }
    const completo = modoGrabacion === 'corregir' && transcript ? `${transcript}\n\nCorrección: ${texto}` : texto
    setTranscript(completo)
    setFase('proponiendo')
    try {
      // La cita elegida (si ninguna otra tarjeta la tomó) va como contexto del dictado; al corregir, las tarjetas de voz
      // se reemplazan, así que solo cuentan las de toques y las confirmadas.
      const quedan = modoGrabacion === 'corregir' ? borradores.filter(b => b.origen !== 'voz') : borradores
      const citaLibre = cita && !citaEnUso(cita.id, quedan) ? cita : null
      const propuesta = await api.proponer({
        transcript: completo.slice(0, 8000),
        lat: punto?.lat ?? null,
        lng: punto?.lng ?? null,
        precision: punto?.precision ?? null,
        hora: isoBogota(),
        cita_id: citaLibre?.id ?? null,
      })
      marcar('propuesta', { visitas: propuesta.visitas.length })
      const cat = ultimo.current.catalogo
      if (!cat) throw new Error('Falta el contexto del reporte')
      const armadas = borradoresDesdePropuesta(propuesta, cat, { nuevoId: nuevoClientId, sedeElegida: sedeElegida ?? cita?.sede.id ?? null })
      const propuestas = citaLibre ? aplicarCitaAPropuestas(armadas, citaLibre, cat) : armadas
      // Al corregir, la propuesta sale de todo lo dictado: lo que ya se confirmó no vuelve como tarjeta nueva.
      const { quedan: nuevos, descartadas } = modoGrabacion === 'corregir' ? descartarYaConfirmadas(propuestas, confirmadas) : { quedan: propuestas, descartadas: 0 }
      setAvisoVoz(
        [propuesta.aviso, descartadas > 0 ? `${plural(descartadas, 'visita ya confirmada no se repitió', 'visitas ya confirmadas no se repitieron')}.` : null]
          .filter(Boolean)
          .join(' ') || null
      )
      if (nuevos.length === 0) {
        setErrorVoz(
          descartadas > 0 ? 'Lo que dijiste ya está confirmado. Si falta algo, dicta solo eso o agrégalo por toques.' : (propuesta.aviso ?? 'No encontré visitas en lo que dijiste. Vuelve a dictar o repórtala por toques.')
        )
        setFase(volver)
        return
      }
      // Al corregir hablando, la propuesta nueva reemplaza las tarjetas de voz aún sin confirmar.
      setBorradores(prev => (modoGrabacion === 'corregir' ? [...prev.filter(b => b.origen !== 'voz'), ...nuevos] : [...prev, ...nuevos]))
      primerToquePendiente.current = true
      setFase('tarjetas')
    } catch (lanzado) {
      setErrorVoz(mensajeDeError(lanzado))
      setFase(volver)
    }
  }

  const confirmarTarjeta = async (clave: string) => {
    const enPantalla = borradores.find(b => b.clave === clave)
    if (!enPantalla || !catalogo) return
    tocarTarjeta()
    marcar('toque_confirmar')
    // Mientras se envía, Reportar no empieza otra llegada (pasoDelReporte): la visita confirmada no se pierde.
    enviosEnCurso.current++
    /** Clave de esta tarjeta si quedó guardada (enviada o en la cola); si no, sigue abierta (abiertasAlTerminarEnvio). */
    let guardada: string | null = null
    try {
      // La visita nunca sale con la primera ubicación (datosParaConfirmar → lugarDeLaVisita): si la final aún no llega
      // se espera (como mucho el tiempo máximo de la lectura precisa) con la tarjeta bloqueada y SIN marcarla intentada
      // (sus errores se miden con la final); después se usan la final, el catálogo de ahora medido desde ella y la
      // tarjeta como quedó.
      const final = finalPendiente.current
      if (final) fijarEstado(clave, { enviando: true, rechazo: null })
      const datos = await datosParaConfirmar({ clave, final, enPantalla: { punto, llegada, catalogo, borrador: enPantalla }, generacion, ultimo })
      if (!datos) {
        fijarEstado(clave, { enviando: false }) // empezó otra llegada o la tarjeta ya no está: no se manda
        return
      }
      const { borrador, catalogo: catalogoVisita, punto: puntoVisita, llegada: llegadaVisita } = datos
      const revision = validarBorrador(borrador, catalogoVisita, { punto: puntoVisita, checked_in_at: llegadaVisita, ahora: new Date(), visitasHoy })
      if (!revision.ok) {
        fijarEstado(clave, { intentado: true, enviando: false, rechazo: null })
        vibrarAviso()
        return
      }
      fijarEstado(clave, { intentado: true, enviando: true, rechazo: null })
      try {
        const ahora = new Date()
        const reportado = Date.parse(llegadaVisita) > ahora.getTime() ? llegadaVisita : isoBogota(ahora)
        const cuerpo = cuerpoDesdeBorrador(borrador, { punto: puntoVisita, checked_in_at: llegadaVisita, reported_at: reportado, transcript })
        const resumen = resumenBorrador(borrador, catalogoVisita)
        // 0940: la foto (si la hay) se guarda con la visita y sube aparte, después de ella.
        const { elemento } = await cola.encolarYEnviar(cuerpo, resumen, borrador.foto ?? null)
        if (elemento.estado === 'no_enviada') {
          // El servidor no la aceptó (nada quedó guardado allá): sale de la cola y la tarjeta sigue aquí para
          // corregirla. Si fue por la cita (ya tiene su visita, la cancelaron…), la tarjeta sigue sin ella: queda como
          // no agendada.
          await cola.quitar(elemento.client_id)
          const rechazo = interpretarRechazo({ message: elemento.error ?? 'No se pudo guardar la visita' })
          setBorradores(prev =>
            prev.map(b => (b.clave === clave ? { ...b, client_id: nuevoClientId(), agenda_id: rechazo.clase === 'cita' ? null : b.agenda_id } : b))
          )
          fijarEstado(clave, { enviando: false, rechazo })
          vibrarAviso()
          return
        }
        if (elemento.estado === 'enviada') {
          // El 201: guardada en el servidor.
          marcar('visita_guardada')
          vibrarExito()
        }
        setResultados(prev => [
          ...prev,
          {
            clave,
            client_id: elemento.client_id,
            resumen,
            estado: elemento.estado === 'enviada' ? 'enviada' : 'pendiente',
            visita_id: elemento.visita_id,
            repetida: elemento.repetida,
            proxima: borrador.next_step_date.trim() || null,
            pedidoAgendar: pedidoAgendarDe(borrador),
          },
        ])
        setConfirmadas(prev => [...prev, borrador])
        setBorradores(prev => prev.filter(b => b.clave !== clave))
        fijarEstado(clave, { enviando: false })
        guardada = clave
      } catch (lanzado) {
        const rechazo = interpretarRechazo({ message: mensajeDeError(lanzado) })
        if (rechazo.clase === 'cita') setBorradores(prev => prev.map(b => (b.clave === clave ? { ...b, agenda_id: null } : b)))
        fijarEstado(clave, { enviando: false, rechazo })
      }
    } finally {
      enviosEnCurso.current--
      // Si Hoy pidió "Reportar de nuevo" mientras esta tarjeta se enviaba (se aplazó), se arma ahora, salvo que borre
      // algo sin guardar (esta tarjeta rechazada, otra abierta, una grabación): entonces sigue aplazado en su ref. La
      // cita tocada en Hoy no arranca sola aquí (soloReintento): queda a la vista con "Reportar esa cita".
      aplicarPaso(
        pasoDelReporte({
          motivo: 'envio',
          iniciado: true,
          nuevo: null,
          aplazado: soloReintento(reintentoAplazado.current),
          enviando: enviosEnCurso.current,
          ocupada: esFaseOcupada(ultimo.current.fase),
          abiertas: abiertasAlTerminarEnvio(ultimo.current.tarjetas, guardada),
          volviendoDeCrear: false,
          reiniciar: false,
        }),
        reintentoAplazado,
        r => void iniciarRef.current(r)
      )
    }
  }

  /** "Descartar" borra lo dictado o escrito de esa tarjeta sin deshacer: se pregunta antes. */
  const descartar = async (clave: string) => {
    tocarTarjeta()
    const si = await confirmar('¿Descartar esta visita?', 'Se borra lo que tiene esta tarjeta y no se guarda nada.', 'Descartar', true)
    if (!si) return
    setBorradores(prev => prev.filter(b => b.clave !== clave))
  }

  /** "Agendar esa reunión": con quién va en memoria (fijarPedidoAgendar), la fecha en la URL (rutaAgendar). */
  const agendarReunion = (r: Resultado) => {
    if (!r.proxima) return
    if (r.pedidoAgendar) fijarPedidoAgendar(r.pedidoAgendar)
    router.push(rutaAgendar({ fecha: r.proxima }))
  }

  const pedirMedico = (borrador: Borrador, nombre?: string) => {
    esperandoCreacion.current = true
    fijarPedido({
      clave: borrador.clave,
      nombre: nombre ?? borrador.medico_nombre_dicho,
      municipio: contexto?.ejecutiva.municipio ?? null,
      sedes: catalogo?.sedes ?? [],
      punto,
      // El consultorio se crea con la final (se espera si aún no llega), nunca con la primera.
      puntoFinal: lugarDeLaVisita(finalPendiente.current, { punto, llegada }).then(lugar => lugar.punto),
    })
    router.push('/medico/nuevo')
  }

  /** "Nuevo contacto" de la tarjeta institucional (2026-10-30): la cuenta (y la sede) de la tarjeta van en el pedido. */
  const pedirContacto = (borrador: Borrador) => {
    if (!borrador.cuenta_id) return
    const cuentaNombre = catalogo?.sedes.find(s => s.cuenta_id === borrador.cuenta_id)?.cuenta_nombre ?? 'la cuenta'
    esperandoCreacion.current = true
    fijarPedido({ clave: borrador.clave, nombre: borrador.contacto_nombre_dicho, cuenta: { id: borrador.cuenta_id, nombre: cuentaNombre }, sede_id: borrador.sede_id })
    router.push('/contacto/nuevo')
  }

  const pedirSede = (clave: string | null) => {
    esperandoCreacion.current = true
    fijarPedido({ clave, municipio: contexto?.ejecutiva.municipio ?? null, sedes: catalogo?.sedes ?? [], punto })
    router.push('/sede/nueva')
  }

  const vincularSede = async (clave: string, medicoId: string, sedeId: string) => {
    try {
      const { medico } = await api.vincularSedeMedico(medicoId, { sede_id: sedeId, rol: 'atiende' })
      const actual = ultimo.current.catalogo?.medicos.find(m => m.id === medicoId)
      if (!actual || !ultimo.current.contexto) return
      const sede = ultimo.current.catalogo?.sedes.find(s => s.id === sedeId)
      // Las sedes que ya se conocían conservan su distancia; la recién vinculada toma la de la lista de cercanas; una
      // que llega nueva del servidor queda "desconocida" (decide el servidor, sin el falso "sin ubicación").
      const sedes = unir(
        actual.sedes,
        medico.sedes.map(s => {
          if (s.id === sedeId) return { id: s.id, nombre: s.nombre, cuenta_nombre: s.cuenta_nombre ?? null, distancia_m: sede?.distancia_m ?? null, coordenadas_desconocidas: sede?.distancia_m == null }
          return actual.sedes.find(x => x.id === s.id) ?? { id: s.id, nombre: s.nombre, cuenta_nombre: s.cuenta_nombre ?? null, distancia_m: null, coordenadas_desconocidas: true }
        })
      )
      const nuevos: Extras = { ...ultimo.current.extras, medicos: unir(ultimo.current.extras.medicos, [{ ...actual, sedes }]) }
      setExtras(nuevos)
      const cat = catalogoDesdeContexto(ultimo.current.contexto, nuevos, ultimo.current.punto, { sinSenal: ultimo.current.sinSenal })
      setBorradores(prev => prev.map(b => (b.clave === clave ? cambiarBorrador(b, { sede_id: sedeId }, cat) : b)))
    } catch (lanzado) {
      fijarEstado(clave, { rechazo: { clase: 'otro', mensaje: mensajeDeError(lanzado), distancia_m: null, radio_m: null } })
    }
  }

  // ---------------------------------------------------------------------------------------------
  // Pantalla
  // ---------------------------------------------------------------------------------------------

  if (fase === 'ubicando') return <Cargando texto={textoCarga} />

  const afinando = estaAfinando(afinandoDe, generacion.current)

  if (errorContexto && !contexto) {
    return (
      <Pantalla>
        <Aviso
          tono={esNoDisponible(errorContexto) ? 'alerta' : 'peligro'}
          titulo={esNoDisponible(errorContexto) ? 'El reporte de visitas aún no está disponible' : 'No pude cargar tus sedes y médicos'}
          accion={<Boton titulo="Reintentar" variante="secundario" alPresionar={() => void iniciar(pedidoDeReintento(tomarReintento()) ?? pedidoDeCita(tomarCitaParaReportar()))} />}
        >
          {esTransitorio(errorContexto)
            ? `${errorContexto.message} No hay sedes y médicos guardados de hoy en el teléfono: abre Hoy o Reportar con señal al menos una vez al día para poder reportar sin ella.`
            : errorContexto.message}
        </Aviso>
        {errorReintento ? <Aviso tono="alerta">{errorReintento}</Aviso> : null}
      </Pantalla>
    )
  }
  if (!contexto || !catalogo) return <Cargando texto="Cargando…" />

  const vozLista = contexto.voz.transcribir && contexto.voz.proponer && !sinSenal
  const pendientesDeEnvio = resultados.filter(r => r.estado === 'pendiente').length
  const terminado = fase === 'tarjetas' && borradores.length === 0 && resultados.length > 0
  const radioM = catalogo.config.radio_m
  /** "No agendada": las sedes a menos de 1 km (las que entraron solo por una cita no se listan aquí). */
  const sedesCercanas = catalogo.sedes.filter(s => s.distancia_m !== null && !s.de_agenda)
  const sede = sedeElegida ? (catalogo.sedes.find(s => s.id === sedeElegida) ?? null) : null
  const cambiarEleccion = () => {
    setCitaElegida(null)
    setSedeElegida(null)
    setErrorVoz(null)
  }
  // Las visitas de esta llegada se cuentan juntas: "Visita 2 de 3" sigue contando las ya confirmadas.
  const yaConfirmadas = resultados.length
  const totalVisitas = yaConfirmadas + borradores.length
  /** La primera tarjeta abierta se confirma desde el pie fijo (visible sin desplazar); las demás, con su propio botón. */
  const primeraAbierta = fase === 'tarjetas' ? (borradores[0] ?? null) : null
  // El pie dice qué se confirma y, si falta algo o el servidor la rechazó, lo dice ahí (la tarjeta puede estar fuera de la
  // vista y la vibración no se siente en todos lados).
  const estadoPrimera = primeraAbierta ? estadoDe(primeraAbierta.clave) : null
  const avisoPie =
    primeraAbierta && estadoPrimera
      ? avisoDelPie({
          numero: yaConfirmadas + 1,
          total: totalVisitas,
          errores: estadoPrimera.intentado ? validarBorrador(primeraAbierta, catalogo, { punto, checked_in_at: llegada, ahora: new Date(), visitasHoy }).errores : [],
          rechazo: estadoPrimera.rechazo,
        })
      : null
  const pie = primeraAbierta ? (
    <PieConfirmar numero={yaConfirmadas + 1} total={totalVisitas} enviando={estadoDe(primeraAbierta.clave).enviando} alConfirmar={() => void confirmarTarjeta(primeraAbierta.clave)} resumen={resumenParaPie(primeraAbierta, catalogo)} aviso={avisoPie} />
  ) : undefined
  const hoy = hoyBogota()
  /** "Reportar esa cita": una llegada nueva con la cita pendiente (sale del ref: ya no está pendiente). */
  const reportarCitaAplazada = () => {
    const pedido = reintentoAplazado.current
    reintentoAplazado.current = null
    if (pedido) void iniciar(pedido)
  }
  /** La cita tocada en Hoy que quedó pendiente (no se perdió nada abierto): se ve y se elige con un toque. */
  const citaPendiente = citaAplazada ? ((contexto.agenda_hoy ?? []).find(c => c.id === citaAplazada) ?? null) : null
  const nadaAbierto = borradores.length === 0 && (fase === 'lista' || fase === 'tarjetas')
  const avisoCitaPendiente = citaAplazada ? (
    <Aviso
      tono="info"
      titulo={citaPendiente ? `Cita de las ${textoHoraCita(citaPendiente.hora)} con ${conQuienCita(citaPendiente)}` : 'La cita que tocaste en Hoy'}
      accion={
        <Grupo>
          {nadaAbierto ? <Boton titulo="Reportar esa cita" variante="secundario" alPresionar={reportarCitaAplazada} /> : null}
          <Boton
            titulo="Olvidarla"
            variante="texto"
            alPresionar={() => {
              reintentoAplazado.current = null
            }}
          />
        </Grupo>
      }
    >
      {nadaAbierto ? 'La tocaste en Hoy. Repórtala ahora o sigue aquí.' : 'La tocaste en Hoy: la eliges al terminar lo que tienes abierto aquí (no se borra nada).'}
    </Aviso>
  ) : null

  return (
    <Pantalla pie={pie}>
      {/* Estilo Uber: mientras se elige, el croquis arriba (tu punto, las sedes y el radio de la elegida) y la hoja. */}
      {fase === 'lista' ? (
        <Croquis
          yo={punto}
          sedes={[...catalogo.sedes, ...citasHoy.map(c => c.sede)]}
          foco={cita?.sede.id ?? sede?.id ?? null}
          radioM={radioM}
          etiquetaYo={punto ? `Estás aquí${punto.precision != null ? ` · ${textoPrecision(punto.precision)}` : ''}` : null}
        />
      ) : null}
      {fase === 'lista' ? <BordeHoja /> : null}
      {fase === 'tarjetas' && borradores.length > 0 ? <Titulo>{borradores.length > 1 ? 'Revisa las visitas' : 'Revisa la visita'}</Titulo> : null}

      {/* 1. Dónde estás (con tarjetas abiertas, en una línea: la tarjeta va primero) */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: fase === 'tarjetas' ? 'center' : 'flex-start', gap: 8 }}>
        <View style={{ gap: 4, flexShrink: 1 }}>
          {fase === 'tarjetas' ? null : <Titulo>¿Dónde estás?</Titulo>}
          <Texto suave peque={fase === 'tarjetas'}>
            Llegada {horaBogota(llegada)}
            {ubicacion?.precision != null ? ` · ${textoPrecision(ubicacion.precision)}` : ''}
            {afinando ? ' · afinando la ubicación…' : ubicacion?.aproximada ? ' · ubicación aproximada' : ''}
          </Texto>
        </View>
        {ubicacion && !afinando && (fase === 'lista' || fase === 'tarjetas') ? (
          <Boton titulo="Actualizar" variante="texto" cargando={reubicando} alPresionar={() => void reubicar()} estilo={fase === 'tarjetas' ? { paddingVertical: 4 } : undefined} />
        ) : null}
      </View>

      {/* Línea guía antes de elegir (los botones de Hablar y Por toques salen después de elegir, no deshabilitados). */}
      {fase === 'lista' && !eligio ? <Texto>Toca tu cita o la sede donde estás.</Texto> : null}

      {avisoCita ? <Aviso tono="info">{avisoCita}</Aviso> : null}
      {nadaAbierto ? avisoCitaPendiente : null}

      {sinSenalDesde ? (
        <Aviso tono="alerta" titulo="Sin señal">
          {`Usas las sedes, médicos y citas guardados a las ${horaBogota(sinSenalDesde)}. Lo que confirmes queda en el teléfono con el punto y la hora de aquí y se sube solo al volver la señal (la distancia y las marcas las pone el servidor).`}
        </Aviso>
      ) : null}

      {errorUbicacion ? (
        <Aviso tono="alerta" accion={<Boton titulo="Volver a intentar" variante="secundario" cargando={reubicando} alPresionar={() => void reubicar()} />}>
          {`${errorUbicacion} Puedes reportar igual: la visita queda marcada "sin ubicación".`}
        </Aviso>
      ) : null}

      {fase === 'lista' && eligio ? (
        // Ya eligió: solo lo elegido, con "Cambiar"; debajo, Hablar y Por toques.
        <View style={{ gap: 10 }}>
          <Seccion titulo={cita ? 'Tu cita' : 'No agendada'} />
          {cita ? (
            <ListaCitas citas={[cita]} radioM={radioM} elegida={cita.id} alElegir={elegirCita} />
          ) : sede ? (
            <SedeElegida sede={sede} radioM={radioM} alQuitar={() => elegirSede(null)} />
          ) : null}
          <Boton titulo={cita ? 'Elegir otra cita o una sede' : 'Elegir otra sede o una cita'} variante="texto" alPresionar={cambiarEleccion} />
        </View>
      ) : null}

      {fase === 'lista' && !eligio ? (
        <>
          <View style={{ gap: 6 }}>
            <Seccion titulo="Tus citas de hoy" />
            <ListaCitas
              citas={citasHoy}
              radioM={radioM}
              elegida={citaElegida}
              alElegir={elegirCita}
              vacio={citasUsadas.length > 0 ? 'Ya reportaste las citas de hoy que tenías aquí.' : 'No tienes citas pendientes para hoy.'}
            />
          </View>
          <View style={{ gap: 6 }}>
            <Seccion titulo="No agendada" />
            <ListaSedes
              sedes={sedesCercanas}
              radioM={radioM}
              elegida={sedeElegida}
              alElegir={elegirSede}
              max={8}
              vacio={ubicacion ? undefined : 'Sin ubicación no puedo mostrar las sedes cercanas: búscala por su nombre.'}
            />
            {buscandoSede ? (
              <Tarjeta estilo={{ gap: 10 }}>
                <Buscador<SedeBusquedaItem>
                  etiqueta="Buscar la sede"
                  placeholder="Nombre de la sede o de la clínica"
                  buscar={async q => (await api.buscarSedes(q, null)).items}
                  clave={item => item.id}
                  titulo={item => item.nombre}
                  detalle={item => [item.cuenta_nombre !== item.nombre ? item.cuenta_nombre : null, item.ciudad].filter(Boolean).join(' · ') || null}
                  alElegir={elegirSedeBuscada}
                />
                <Boton titulo="Cerrar el buscador" variante="texto" alPresionar={() => setBuscandoSede(false)} />
              </Tarjeta>
            ) : (
              <Boton titulo="Buscar otra sede por su nombre" variante="texto" alPresionar={() => setBuscandoSede(true)} />
            )}
            <Boton titulo="¿No está? Crear sede aquí" variante="texto" alPresionar={() => pedirSede(null)} />
          </View>
          {/* Habeas data (dueño, 2026-10-30): la ubicación se toma solo al confirmar, nunca en segundo plano. Al final
              (dueño, 2026-10-31: arriba había mucho texto y no se veía qué se podía tocar). */}
          <Texto suave peque>
            {AVISO_HABEAS_DATA}
          </Texto>
        </>
      ) : null}

      {fase !== 'lista' && ((cita && !citaEnUso(cita.id)) || (!cita && sede)) ? (
        <Texto suave>
          {cita
            ? `Cita: ${textoHoraCita(cita.hora)} · ${conQuienCita(cita)} · ${cita.sede.nombre}`
            : `Sede: ${sede?.nombre ?? 'sede'}`}
        </Texto>
      ) : null}

      {errorVoz ? (
        <Aviso tono="alerta" titulo="La voz no funcionó esta vez" accion={eligio ? <Boton titulo="Reportar por toques" variante="secundario" alPresionar={porToques} /> : undefined}>
          {errorVoz}
        </Aviso>
      ) : null}

      {/* 2. Hablar o por toques (solo después de elegir la cita o la sede) */}
      {fase === 'lista' && eligio ? (
        <View style={{ gap: 10 }}>
          {vozLista ? (
            <Boton
              titulo="Hablar"
              icono="microfono"
              detalle={cita ? `Cuenta qué pasó con ${conQuienCita(cita)}` : 'Cuenta qué pasó: con quién, qué quedó pendiente'}
              grande
              cargando={comprobandoSenal}
              alPresionar={() => hablar('nuevo')}
            />
          ) : (
            <Aviso tono="info">
              {sinSenal
                ? 'Sin señal la voz no funciona. Reporta por toques: tiene los mismos campos y se envía al volver la señal.'
                : 'La voz aún no está configurada en el servidor. Reporta por toques: tiene los mismos campos.'}
            </Aviso>
          )}
          <Boton
            titulo="Por toques"
            detalle={cita ? (cita.tipo === 'medica' ? 'La visita ya trae el médico y la sede' : 'La visita ya trae la cuenta, el subtipo y la sede') : 'Elige médico o cuenta y resultado'}
            variante={vozLista ? 'secundario' : 'primario'}
            grande
            alPresionar={porToques}
          />
        </View>
      ) : null}

      {fase === 'grabando' ? (
        <Grabador
          alEmpezar={() => marcar('grabando')}
          alTerminar={(uri, ms) => void alTerminarGrabacion(uri, ms)}
          alCancelar={() => setFase(borradores.length > 0 ? 'tarjetas' : 'lista')}
          alError={mensaje => {
            setErrorVoz(mensaje)
            setFase(borradores.length > 0 ? 'tarjetas' : 'lista')
          }}
        />
      ) : null}
      {fase === 'transcribiendo' ? <EnCurso texto="Transcribiendo… (el audio se borra al terminar)" /> : null}
      {fase === 'proponiendo' ? (
        // Mientras Claude arma las visitas ya se lee lo que se dijo.
        <View style={{ gap: 14 }}>
          <EnCurso texto="Armando las visitas…" />
          {transcript ? <LoQueDijiste texto={transcript} abiertoInicial /> : null}
        </View>
      ) : null}

      {fase === 'tarjetas' && borradores.length > 0 ? (
        <View style={{ gap: 14 }}>
          {avisoVoz ? <Aviso tono="info">{avisoVoz}</Aviso> : null}
          {borradores.map((borrador, indice) => (
            <TarjetaBorrador
              key={borrador.clave}
              numero={yaConfirmadas + indice + 1}
              total={totalVisitas}
              confirmarEnPie={indice === 0}
              borrador={borrador}
              catalogo={catalogo}
              punto={punto}
              checkedInAt={llegada}
              visitasHoy={visitasHoy}
              estado={estadoDe(borrador.clave)}
              alCambiar={cambios => cambiar(borrador.clave, cambios)}
              alConfirmar={() => void confirmarTarjeta(borrador.clave)}
              alDescartar={() => void descartar(borrador.clave)}
              alCrearMedico={nombre => pedirMedico(borrador, nombre)}
              alCrearContacto={() => pedirContacto(borrador)}
              alCrearSede={() => pedirSede(borrador.clave)}
              alAgregarMedico={medico => {
                tocarTarjeta()
                setExtras(prev => ({ ...prev, medicos: unir(prev.medicos, [medico]) }))
                const cat = catalogoDesdeContexto(contexto, { ...extras, medicos: unir(extras.medicos, [medico]) }, punto)
                setBorradores(prev => prev.map(b => (b.clave === borrador.clave ? cambiarBorrador(b, { medico_id: medico.id }, cat) : b)))
              }}
              alAgregarSedes={sedes => setExtras(prev => ({ ...prev, sedes: unir(prev.sedes, sedes) }))}
              alVincularSede={sedeId => (borrador.medico_id ? vincularSede(borrador.clave, borrador.medico_id, sedeId) : Promise.resolve())}
              cita={citaDe(borrador.agenda_id)}
              dictadoDisponible={vozLista}
              sedeElegida={sedeElegida ?? cita?.sede.id ?? null}
              alTocar={tocarTarjeta}
            />
          ))}
          {/* Después de las tarjetas: lo que hay que revisar (el resumen) queda encima del pie. */}
          {transcript ? <LoQueDijiste texto={transcript} /> : null}
          <Grupo>
            {vozLista && transcript ? <Boton titulo="Corregir hablando" variante="secundario" alPresionar={() => hablar('corregir')} /> : null}
            {eligio ? <Boton titulo="Agregar otra visita" variante="secundario" alPresionar={porToques} /> : null}
          </Grupo>
        </View>
      ) : null}

      {!nadaAbierto ? avisoCitaPendiente : null}

      {/* 3. Resultado */}
      {resultados.length > 0 ? (
        <View style={{ gap: 10 }}>
          <Subtitulo>{terminado ? 'Listo' : 'Ya confirmadas'}</Subtitulo>
          {pendientesDeEnvio > 0 ? <Aviso tono="alerta">{AVISO_EN_COLA}</Aviso> : null}
          {resultados.map(r => (
            <View key={r.clave} style={{ gap: 8 }}>
              <Tarjeta estilo={{ gap: 6 }} alPresionar={r.visita_id ? () => router.push(`/visita/${r.visita_id}`) : undefined}>
                <Grupo>
                  <Insignia texto={r.estado === 'enviada' ? (r.repetida ? 'Ya estaba guardada' : 'Guardada') : 'En el teléfono'} tono={r.estado === 'enviada' ? 'exito' : 'alerta'} />
                </Grupo>
                <Texto>{r.resumen}</Texto>
                {r.visita_id ? (
                  <Texto peque suave>
                    Toca para ver o corregir (solo hoy)
                  </Texto>
                ) : null}
              </Tarjeta>
              {r.proxima && r.pedidoAgendar && puedeAgendarProxima(r.proxima, hoy) ? (
                <Boton titulo="Agendar esa reunión" detalle={`Próxima reunión: ${textoFecha(r.proxima)}`} variante="secundario" alPresionar={() => agendarReunion(r)} />
              ) : null}
            </View>
          ))}
          {terminado ? (
            <View style={{ gap: 10 }}>
              <Texto suave>{`${plural(resultados.length, 'visita confirmada', 'visitas confirmadas')}.`}</Texto>
              <Boton titulo="Volver a Hoy" grande alPresionar={() => router.replace('/hoy')} />
              <Boton titulo="Reportar otra llegada" variante="secundario" alPresionar={() => void iniciar(null)} />
            </View>
          ) : null}
        </View>
      ) : null}
    </Pantalla>
  )
}

/** "jueves 22 de octubre" (o la fecha tal cual si no se puede leer). */
function textoFecha(fecha: string): string {
  try {
    return fechaLarga(fecha)
  } catch {
    return fecha
  }
}

/** Algo en curso (transcribir, armar las visitas) sin tapar lo demás de la pantalla. */
function EnCurso({ texto }: { texto: string }) {
  const c = useColores()
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 }}>
      <ActivityIndicator color={c.textoSuave} />
      <Texto suave>{texto}</Texto>
    </View>
  )
}

/**
 * "Lo que dijiste": la transcripción, plegada en 3 líneas (o desplegada mientras se arman las visitas); tocarla la
 * despliega completa o la vuelve a plegar.
 */
function LoQueDijiste({ texto, abiertoInicial = false }: { texto: string; abiertoInicial?: boolean }) {
  const c = useColores()
  const [abierto, setAbierto] = useState(abiertoInicial)
  const largo = texto.length > 160 || texto.split('\n').length > 3
  return (
    <Bloque
      estilo={{ gap: 4 }}
      alPresionar={largo ? () => setAbierto(!abierto) : undefined}
      etiquetaAccesible={largo ? `Lo que dijiste. ${abierto ? 'Toca para plegarlo' : 'Toca para verlo completo'}` : undefined}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icono nombre="microfono" tamano={16} color={c.textoSuave} />
          <Texto peque negrita color={c.textoSuave}>
            Lo que dijiste
          </Texto>
        </View>
        {largo ? (
          <Texto peque negrita>
            {abierto ? 'Ver menos' : 'Ver todo'}
          </Texto>
        ) : null}
      </View>
      <Texto lineas={abierto ? undefined : 3} estilo={{ fontSize: 15, lineHeight: 20 }}>
        {texto}
      </Texto>
    </Bloque>
  )
}

/** La sede elegida para una visita no agendada (también la que vino del buscador, sin distancia conocida). */
function SedeElegida({ sede, radioM, alQuitar }: { sede: SedeOpcion; radioM: number; alQuitar: () => void }) {
  const c = useColores()
  const dentro = sede.distancia_m !== null && sede.distancia_m <= radioM
  const cuenta = cuentaDistinta(sede.nombre, sede.cuenta_nombre)
  return (
    <Tarjeta
      alPresionar={alQuitar}
      etiquetaAccesible={`${sede.nombre}, elegida. Toca para quitarla`}
      estilo={{ padding: 14, gap: 6, borderWidth: 2, borderColor: c.acento }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
        <Texto negrita estilo={{ flexShrink: 1, fontSize: 17 }}>
          ✓ {sede.nombre}
        </Texto>
        {sede.distancia_m !== null ? <Texto negrita>{sinCortes(textoDistancia(sede.distancia_m))}</Texto> : null}
      </View>
      {cuenta ? (
        <Texto suave peque>
          {cuenta}
        </Texto>
      ) : null}
      {sede.distancia_m !== null ? (
        <Grupo>
          <Insignia texto={dentro ? 'Dentro del radio' : `Fuera del radio (${sinCortes(textoDistancia(radioM))})`} tono={dentro ? 'exito' : 'alerta'} />
        </Grupo>
      ) : (
        <Texto suave peque>
          La distancia a esta sede la calcula el servidor al confirmar.
        </Texto>
      )}
    </Tarjeta>
  )
}
