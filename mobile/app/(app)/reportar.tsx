/**
 * Reportar (contrato fase 8, sección "App móvil"; F4.1 agenda, spec 2026-10-14):
 *   1. ¿Dónde estás?: arriba las citas PENDIENTES de hoy, la más cercana primero, con su distancia y si está dentro del
 *      radio (ListaCitas); debajo "Visita no agendada" con las sedes a menos de 1 km (sin mapa), un buscador de sedes y
 *      "Crear sede aquí". Hablar y Por toques se habilitan solo después de elegir una cita o una sede. Con una cita, la
 *      tarjeta sale ya armada (tipo, médico o cuenta y subtipo, sede y agenda_id) y el dictado va con esa cita.
 *   2. Hablar (graba hasta 3 minutos con el nivel visible; el audio se borra al llegar la transcripción o al
 *      cancelar) → transcribiendo → tarjetas propuestas editables; o Por toques con los mismos campos. Cada tarjeta se
 *      confirma con un toque: nada se guarda sin confirmar. "Corregir hablando" vuelve a dictar sobre lo dicho.
 *   3. Resultado: lo que se guardó y lo que quedó en el teléfono (sin señal se envía solo antes de medianoche).
 * Datos: POST /api/me/contexto (el punto en el cuerpo, no en la URL), GET /api/me/visitas?fecha=hoy (topes), POST
 * /api/me/voz/transcribir y /proponer, POST /api/me/visitas por la cola (lib/cola-contexto.tsx). La distancia que vale
 * la calcula el servidor.
 *
 * Reportar es una pestaña y queda montada: cada vez que se vuelve a ella se decide si es una llegada nueva (punto,
 * hora y sedes nuevos) o el mismo reporte (debeReiniciarReporte de lib/propuesta.ts). Sin señal al abrir, usa el
 * contexto guardado HOY (lib/contexto-guardado.ts) para que la visita quede en la cola con el punto y la hora del sitio.
 */
import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { View } from 'react-native'
import { Buscador } from '../../components/reporte/Buscador'
import { Grabador } from '../../components/reporte/Grabador'
import { ListaCitas } from '../../components/reporte/ListaCitas'
import { ListaSedes } from '../../components/reporte/ListaSedes'
import { ESTADO_TARJETA_INICIAL, TarjetaBorrador, type EstadoTarjeta } from '../../components/reporte/TarjetaBorrador'
import * as api from '../../lib/api'
import { borrarAudio } from '../../lib/audio'
import { useCola } from '../../lib/cola-contexto'
import { guardarContexto, leerContextoGuardado } from '../../lib/contexto-guardado'
import { aApiError, esNoDisponible, esTransitorio, mensajeDeError, type ApiError } from '../../lib/errores'
import { horaBogota, hoyBogota, isoBogota } from '../../lib/fechas'
import { textoDistancia, textoPrecision, type Punto } from '../../lib/geo'
import { segundosDe } from '../../lib/grabacion'
import { nuevoClientId } from '../../lib/id'
import {
  AVISO_EN_COLA,
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
import { escucharRetorno, fijarPedido, fijarReintento, tomarReintento, type ReintentoReporte, type Retorno } from '../../lib/retorno'
import { useSesion } from '../../lib/sesion'
import type { CitaItem, ContextoResponse, SedeBusquedaItem, VisitaItem } from '../../lib/tipos'
import { pedirUbicacion, type Ubicacion } from '../../lib/ubicacion'
import { Aviso, Boton, Cargando, Grupo, Insignia, Pantalla, Subtitulo, Tarjeta, Texto, Titulo, useColores } from '../../lib/ui'

type Fase = 'ubicando' | 'lista' | 'grabando' | 'transcribiendo' | 'proponiendo' | 'tarjetas'

interface Resultado {
  clave: string
  client_id: string
  resumen: string
  estado: 'enviada' | 'pendiente'
  visita_id: string | null
  repetida: boolean
}

interface Extras {
  sedes: SedeOpcion[]
  medicos: MedicoOpcion[]
}

const EXTRAS_VACIOS: Extras = { sedes: [], medicos: [] }

/** Une una opción nueva a la lista (la nueva reemplaza a la vieja del mismo id). */
function unir<T extends { id: string }>(lista: readonly T[], nuevas: readonly T[]): T[] {
  const ids = new Set(nuevas.map(n => n.id))
  return [...lista.filter(x => !ids.has(x.id)), ...nuevas]
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
  const iniciado = useRef(false)
  /** Reportar mandó a Nuevo médico o Nueva sede: la próxima vez que reciba el foco es la vuelta (no se reinicia). */
  const esperandoCreacion = useRef(false)

  const punto: (Punto & { precision: number | null }) | null = ubicacion ? { lat: ubicacion.lat, lng: ubicacion.lng, precision: ubicacion.precision } : null
  const sinSenal = sinSenalDesde !== null
  const catalogo = useMemo<Catalogo | null>(
    () => (contexto ? catalogoDesdeContexto(contexto, extras, punto, { sinSenal }) : null),
    [contexto, extras, punto?.lat, punto?.lng, sinSenal] // eslint-disable-line react-hooks/exhaustive-deps
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

  // Lo último, para los manejadores que viven más que un render (retorno de las pantallas de creación, foco).
  const ultimo = useRef({ contexto, extras, punto, catalogo, sinSenal, llegada, fase, borradores: borradores.length })
  ultimo.current = { contexto, extras, punto, catalogo, sinSenal, llegada, fase, borradores: borradores.length }

  /** Visitas de hoy para los topes: las del servidor más las de la cola de hoy (sin repetir client_id). */
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
   * Contexto (con el punto) y visitas de hoy. Sin señal (red, tiempo agotado o servidor caído) usa el contexto que se
   * guardó hoy; si no hay, el error. Devuelve el contexto que quedó en uso (o null) y si es el guardado.
   */
  const cargarContexto = useCallback(
    async (nuevo: Ubicacion | null): Promise<{ contexto: ContextoResponse; sinSenal: boolean } | null> => {
      const hoy = hoyBogota()
      const [ctx, vis] = await Promise.allSettled([
        api.contexto(nuevo ? { lat: nuevo.lat, lng: nuevo.lng, precision: nuevo.precision } : null),
        api.visitas(hoy),
      ])
      if (vis.status === 'fulfilled') setVisitasServidor(vis.value.items)
      if (ctx.status === 'fulfilled') {
        setContexto(ctx.value)
        setErrorContexto(null)
        setSinSenalDesde(null)
        void guardarContexto(usuarioId, ctx.value)
        return { contexto: ctx.value, sinSenal: false }
      }
      const error = aApiError(ctx.reason)
      if (esTransitorio(error)) {
        const guardado = await leerContextoGuardado(usuarioId)
        if (guardado) {
          setContexto(guardado.contexto)
          setErrorContexto(null)
          setSinSenalDesde(guardado.guardado_at)
          return { contexto: guardado.contexto, sinSenal: true }
        }
      }
      setErrorContexto(error)
      return null
    },
    [usuarioId]
  )

  /**
   * Empieza un reporte: ubicación del sitio (instante de llegada), contexto y visitas de hoy. Con `reintento` (una
   * visita de la cola que el servidor no aceptó, desde Hoy) la vuelve a armar como tarjeta con el motivo del rechazo.
   */
  const iniciar = useCallback(
    async (reintento: ReintentoReporte | null = null) => {
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
      esperandoCreacion.current = false
      const resultado = await pedirUbicacion({ timeoutMs: 10_000 })
      setUbicacion(resultado.ubicacion)
      setErrorUbicacion(resultado.error)
      setLlegada(resultado.ubicacion?.tomada_at ?? isoBogota())
      const cargado = await cargarContexto(resultado.ubicacion)
      if (reintento) {
        if (!cargado) {
          fijarReintento(reintento) // se arma la próxima vez que haya contexto
          setErrorReintento('No se pudo cargar tus sedes y médicos para volver a armar la visita. Reintenta con señal.')
        } else {
          const p = resultado.ubicacion ? { lat: resultado.ubicacion.lat, lng: resultado.ubicacion.lng } : null
          const cat = catalogoDesdeContexto(cargado.contexto, EXTRAS_VACIOS, p, { sinSenal: cargado.sinSenal })
          const borrador = borradorDesdeCuerpo(reintento.cuerpo, cat, { nuevoId: nuevoClientId, motivo: reintento.error })
          setBorradores([borrador])
          setEstados({
            [borrador.clave]: { intentado: true, enviando: false, rechazo: reintento.error ? interpretarRechazo({ message: reintento.error }) : null },
          })
          setFase('tarjetas')
          await cola.quitar(reintento.client_id) // la tarjeta lo tiene todo; la vieja sale de la cola
          return
        }
      }
      setFase('lista')
    },
    [cargarContexto, cola]
  )

  /** Vuelve a tomar la ubicación sin perder las tarjetas (el instante de llegada pasa a ser este). */
  const reubicar = useCallback(async () => {
    const resultado = await pedirUbicacion({ timeoutMs: 10_000 })
    if (resultado.ubicacion) {
      setUbicacion(resultado.ubicacion)
      setLlegada(resultado.ubicacion.tomada_at)
      setErrorUbicacion(null)
      await cargarContexto(resultado.ubicacion)
    } else {
      setErrorUbicacion(resultado.error)
    }
  }, [cargarContexto])

  // Cada vez que Reportar recibe el foco (la primera vez, al volver de Hoy o de otra pestaña): llegada nueva salvo que
  // esté grabando, vuelva de crear un médico o una sede, o tenga tarjetas recientes sin confirmar. Lee el estado de
  // `ultimo` para que esto corra SOLO al recibir el foco (no cada vez que cambian las tarjetas o la fase).
  const iniciarRef = useRef(iniciar)
  iniciarRef.current = iniciar
  useFocusEffect(
    useCallback(() => {
      const reintento = tomarReintento()
      if (!iniciado.current || reintento) {
        iniciado.current = true
        void iniciarRef.current(reintento)
        return
      }
      const { llegada: llegadaActual, fase: faseActual, borradores: pendientes } = ultimo.current
      const volviendo = esperandoCreacion.current
      esperandoCreacion.current = false
      const ocupada = faseActual === 'ubicando' || faseActual === 'grabando' || faseActual === 'transcribiendo' || faseActual === 'proponiendo'
      if (debeReiniciarReporte({ llegada: llegadaActual, ahora: new Date(), borradores: pendientes, ocupada, esperandoCreacion: volviendo })) {
        void iniciarRef.current(null)
      }
    }, [])
  )

  // Lo que se creó en Nuevo médico o Nueva sede vuelve aquí y queda puesto en la tarjeta que lo pidió.
  useEffect(
    () =>
      escucharRetorno((retorno: Retorno) => {
        const { contexto: ctx, extras: ext, punto: p, sinSenal: offline } = ultimo.current
        const nuevos: Extras =
          retorno.tipo === 'medico'
            ? { ...ext, medicos: unir(ext.medicos, [retorno.medico]) }
            : { ...ext, sedes: unir(ext.sedes, [retorno.sede]) }
        setExtras(nuevos)
        if (!ctx) return
        const cat = catalogoDesdeContexto(ctx, nuevos as ExtrasCatalogo, p, { sinSenal: offline })
        if (retorno.clave) {
          const cambios: Partial<Borrador> =
            retorno.tipo === 'medico'
              ? { medico_id: retorno.medico.id }
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

  const cambiar = (clave: string, cambios: Partial<Borrador>) => {
    if (!catalogo) return
    setBorradores(prev => prev.map(b => (b.clave === clave ? cambiarBorrador(b, cambios, catalogo) : b)))
    if (estadoDe(clave).rechazo) fijarEstado(clave, { rechazo: null })
  }

  /** Paso 1: la cita o la sede (una excluye la otra). El aviso de una voz que falló era del intento anterior: se quita. */
  const elegirCita = (id: string | null) => {
    setCitaElegida(id)
    if (id) setSedeElegida(null)
    setErrorVoz(null)
  }
  const elegirSede = (id: string | null) => {
    setSedeElegida(id)
    if (id) setCitaElegida(null)
    setErrorVoz(null)
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
    setFase('tarjetas')
  }

  const hablar = (modo: 'nuevo' | 'corregir') => {
    setErrorVoz(null)
    setModoGrabacion(modo)
    setFase('grabando')
  }

  /** La grabación terminó: se sube, se borra del teléfono en cuanto responde, y se pide la propuesta. */
  const alTerminarGrabacion = async (uri: string, duracionMs: number) => {
    const volver = borradores.length > 0 ? 'tarjetas' : 'lista'
    setFase('transcribiendo')
    let texto: string
    try {
      texto = (await api.transcribir(uri, segundosDe(duracionMs))).transcript
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
      setFase('tarjetas')
    } catch (lanzado) {
      setErrorVoz(mensajeDeError(lanzado))
      setFase(volver)
    }
  }

  const confirmarTarjeta = async (clave: string) => {
    const borrador = borradores.find(b => b.clave === clave)
    if (!borrador || !catalogo) return
    const revision = validarBorrador(borrador, catalogo, { punto, checked_in_at: llegada, ahora: new Date(), visitasHoy })
    if (!revision.ok) {
      fijarEstado(clave, { intentado: true, rechazo: null })
      return
    }
    fijarEstado(clave, { intentado: true, enviando: true, rechazo: null })
    try {
      const ahora = new Date()
      const reportado = Date.parse(llegada) > ahora.getTime() ? llegada : isoBogota(ahora)
      const cuerpo = cuerpoDesdeBorrador(borrador, { punto, checked_in_at: llegada, reported_at: reportado, transcript })
      const resumen = resumenBorrador(borrador, catalogo)
      const { elemento } = await cola.encolarYEnviar(cuerpo, resumen)
      if (elemento.estado === 'no_enviada') {
        // El servidor no la aceptó (nada quedó guardado allá): sale de la cola y la tarjeta sigue aquí para corregirla.
        // Si fue por la cita (ya tiene su visita, la cancelaron…), la tarjeta sigue sin ella: queda como no agendada.
        await cola.quitar(elemento.client_id)
        const rechazo = interpretarRechazo({ message: elemento.error ?? 'No se pudo guardar la visita' })
        setBorradores(prev =>
          prev.map(b => (b.clave === clave ? { ...b, client_id: nuevoClientId(), agenda_id: rechazo.clase === 'cita' ? null : b.agenda_id } : b))
        )
        fijarEstado(clave, { enviando: false, rechazo })
        return
      }
      setResultados(prev => [
        ...prev,
        { clave, client_id: elemento.client_id, resumen, estado: elemento.estado === 'enviada' ? 'enviada' : 'pendiente', visita_id: elemento.visita_id, repetida: elemento.repetida },
      ])
      setConfirmadas(prev => [...prev, borrador])
      setBorradores(prev => prev.filter(b => b.clave !== clave))
      fijarEstado(clave, { enviando: false })
    } catch (lanzado) {
      const rechazo = interpretarRechazo({ message: mensajeDeError(lanzado) })
      if (rechazo.clase === 'cita') setBorradores(prev => prev.map(b => (b.clave === clave ? { ...b, agenda_id: null } : b)))
      fijarEstado(clave, { enviando: false, rechazo })
    }
  }

  const descartar = (clave: string) => setBorradores(prev => prev.filter(b => b.clave !== clave))

  const pedirMedico = (borrador: Borrador) => {
    esperandoCreacion.current = true
    fijarPedido({
      clave: borrador.clave,
      nombre: borrador.medico_nombre_dicho,
      municipio: contexto?.ejecutiva.municipio ?? null,
      sedes: catalogo?.sedes ?? [],
      punto,
    })
    router.push('/medico/nuevo')
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

  if (fase === 'ubicando') return <Cargando texto="Tomando tu ubicación y las sedes cercanas…" />

  if (errorContexto && !contexto) {
    return (
      <Pantalla>
        <Aviso
          tono={esNoDisponible(errorContexto) ? 'alerta' : 'peligro'}
          titulo={esNoDisponible(errorContexto) ? 'El reporte de visitas aún no está disponible' : 'No pude cargar tus sedes y médicos'}
          accion={<Boton titulo="Reintentar" variante="secundario" alPresionar={() => void iniciar(tomarReintento())} />}
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
  /** "Visita no agendada": las sedes a menos de 1 km (las que entraron solo por una cita no se listan aquí). */
  const sedesCercanas = catalogo.sedes.filter(s => s.distancia_m !== null && !s.de_agenda)
  const sede = sedeElegida ? (catalogo.sedes.find(s => s.id === sedeElegida) ?? null) : null
  const cambiarEleccion = () => {
    setCitaElegida(null)
    setSedeElegida(null)
    setErrorVoz(null)
  }

  return (
    <Pantalla>
      {/* 1. Dónde estás */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <View style={{ gap: 4, flexShrink: 1 }}>
          <Titulo>¿Dónde estás?</Titulo>
          <Texto suave>
            Llegada {horaBogota(llegada)}
            {ubicacion?.precision != null ? ` · ${textoPrecision(ubicacion.precision)}` : ''}
            {ubicacion?.aproximada ? ' · ubicación aproximada' : ''}
          </Texto>
        </View>
        {ubicacion && (fase === 'lista' || fase === 'tarjetas') ? <Boton titulo="Actualizar" variante="texto" alPresionar={() => void reubicar()} /> : null}
      </View>

      {sinSenalDesde ? (
        <Aviso tono="alerta" titulo="Sin señal">
          {`Usas las sedes, médicos y citas guardados a las ${horaBogota(sinSenalDesde)}. Lo que confirmes queda en el teléfono con el punto y la hora de aquí y se envía solo al volver la señal, antes de medianoche (la distancia la revisa el servidor).`}
        </Aviso>
      ) : null}

      {errorUbicacion ? (
        <Aviso tono="alerta" accion={<Boton titulo="Volver a intentar" variante="secundario" alPresionar={() => void reubicar()} />}>
          {`${errorUbicacion} Sin ubicación solo puedes reportar telefónica (si la tienes habilitada).`}
        </Aviso>
      ) : null}

      {fase === 'lista' && eligio ? (
        // Ya eligió: solo lo elegido, con "Cambiar"; los botones de abajo quedan habilitados.
        <View style={{ gap: 10 }}>
          <Subtitulo>{cita ? 'Tu cita' : 'Visita no agendada'}</Subtitulo>
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
          <View style={{ gap: 10 }}>
            <Subtitulo>Tus citas de hoy</Subtitulo>
            <ListaCitas
              citas={citasHoy}
              radioM={radioM}
              elegida={citaElegida}
              alElegir={elegirCita}
              vacio={citasUsadas.length > 0 ? 'Ya reportaste las citas de hoy que tenías aquí.' : 'No tienes citas pendientes para hoy.'}
            />
          </View>
          <View style={{ gap: 10 }}>
            <Subtitulo>Visita no agendada</Subtitulo>
            <Texto suave peque>
              Si no estaba en tu agenda, elige la sede donde estás.
            </Texto>
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
        </>
      ) : null}

      {fase !== 'lista' && ((cita && !borradores.some(b => b.agenda_id === cita.id)) || (!cita && sede)) ? (
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
      {fase === 'lista' ? (
        <View style={{ gap: 10 }}>
          {!eligio ? (
            <Aviso tono="info" titulo="Primero elige dónde estás">
              Toca arriba tu cita o la sede donde estás. Así la visita sale con el médico o la cuenta y la sede correctos.
            </Aviso>
          ) : null}
          <Boton
            titulo="Hablar"
            detalle={
              !vozLista
                ? 'La voz aún no está configurada'
                : !eligio
                  ? 'Elige la cita o la sede para dictar'
                  : cita
                    ? `Cuenta qué pasó con ${conQuienCita(cita)}`
                    : 'Cuenta qué pasó: con quién, qué quedó pendiente'
            }
            grande
            deshabilitado={!vozLista || !eligio}
            alPresionar={() => hablar('nuevo')}
          />
          {!vozLista ? <Aviso tono="info">La voz aún no está configurada en el servidor. Reporta por toques: tiene los mismos campos.</Aviso> : null}
          <Boton
            titulo="Por toques"
            detalle={
              !eligio
                ? 'Elige la cita o la sede para llenar la visita'
                : cita
                  ? cita.tipo === 'medica'
                    ? 'La visita ya trae el médico y la sede'
                    : 'La visita ya trae la cuenta, el subtipo y la sede'
                  : 'Elige médico o cuenta y resultado'
            }
            variante="secundario"
            grande
            deshabilitado={!eligio}
            alPresionar={porToques}
          />
        </View>
      ) : null}

      {fase === 'grabando' ? (
        <Grabador
          alTerminar={(uri, ms) => void alTerminarGrabacion(uri, ms)}
          alCancelar={() => setFase(borradores.length > 0 ? 'tarjetas' : 'lista')}
          alError={mensaje => {
            setErrorVoz(mensaje)
            setFase(borradores.length > 0 ? 'tarjetas' : 'lista')
          }}
        />
      ) : null}
      {fase === 'transcribiendo' ? <Cargando texto="Transcribiendo… (el audio se borra al terminar)" /> : null}
      {fase === 'proponiendo' ? <Cargando texto="Armando las visitas…" /> : null}

      {fase === 'tarjetas' && borradores.length > 0 ? (
        <View style={{ gap: 14 }}>
          {avisoVoz ? <Aviso tono="info">{avisoVoz}</Aviso> : null}
          {transcript ? (
            <Tarjeta estilo={{ gap: 6 }}>
              <Texto negrita>Lo que dijiste</Texto>
              <Texto suave peque lineas={6}>
                {transcript}
              </Texto>
            </Tarjeta>
          ) : null}
          {borradores.map((borrador, indice) => (
            <TarjetaBorrador
              key={borrador.clave}
              numero={indice + 1}
              total={borradores.length}
              borrador={borrador}
              catalogo={catalogo}
              punto={punto}
              checkedInAt={llegada}
              visitasHoy={visitasHoy}
              estado={estadoDe(borrador.clave)}
              alCambiar={cambios => cambiar(borrador.clave, cambios)}
              alConfirmar={() => void confirmarTarjeta(borrador.clave)}
              alDescartar={() => descartar(borrador.clave)}
              alCrearMedico={() => pedirMedico(borrador)}
              alCrearSede={() => pedirSede(borrador.clave)}
              alAgregarMedico={medico => {
                setExtras(prev => ({ ...prev, medicos: unir(prev.medicos, [medico]) }))
                const cat = catalogoDesdeContexto(contexto, { ...extras, medicos: unir(extras.medicos, [medico]) }, punto)
                setBorradores(prev => prev.map(b => (b.clave === borrador.clave ? cambiarBorrador(b, { medico_id: medico.id }, cat) : b)))
              }}
              alAgregarSedes={sedes => setExtras(prev => ({ ...prev, sedes: unir(prev.sedes, sedes) }))}
              alVincularSede={sedeId => (borrador.medico_id ? vincularSede(borrador.clave, borrador.medico_id, sedeId) : Promise.resolve())}
              cita={citaDe(borrador.agenda_id)}
              dictadoDisponible={vozLista}
            />
          ))}
          <Grupo>
            {vozLista && transcript ? <Boton titulo="Corregir hablando" variante="secundario" alPresionar={() => hablar('corregir')} /> : null}
            {eligio ? <Boton titulo="Agregar otra visita" variante="secundario" alPresionar={porToques} /> : null}
          </Grupo>
        </View>
      ) : null}

      {/* 3. Resultado */}
      {resultados.length > 0 ? (
        <View style={{ gap: 10 }}>
          <Subtitulo>{terminado ? 'Listo' : 'Ya confirmadas'}</Subtitulo>
          {pendientesDeEnvio > 0 ? <Aviso tono="alerta">{AVISO_EN_COLA}</Aviso> : null}
          {resultados.map(r => (
            <Tarjeta key={r.clave} estilo={{ gap: 6 }} alPresionar={r.visita_id ? () => router.push(`/visita/${r.visita_id}`) : undefined}>
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

/** La sede elegida para una visita no agendada (también la que vino del buscador, sin distancia conocida). */
function SedeElegida({ sede, radioM, alQuitar }: { sede: SedeOpcion; radioM: number; alQuitar: () => void }) {
  const c = useColores()
  const dentro = sede.distancia_m !== null && sede.distancia_m <= radioM
  const cuenta = cuentaDistinta(sede.nombre, sede.cuenta_nombre)
  return (
    <Tarjeta
      alPresionar={alQuitar}
      etiquetaAccesible={`${sede.nombre}, elegida. Toca para quitarla`}
      estilo={{ padding: 12, gap: 6, borderWidth: 2.5, borderColor: c.acento }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
        <Texto negrita estilo={{ flexShrink: 1 }}>
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
