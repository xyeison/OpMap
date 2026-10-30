/**
 * Agendar una cita como calendario con hora (F4.1; spec 2026-10-15, decisiones 1 y 2 del dueño): "¿Qué vas a hacer?"
 * (F1b: "Visita a médico" o "Visita institucional", según el perfil), "¿Cuándo?" con el mes en cuadrícula (de hoy en
 * adelante, sin tope: A4; los días con citas llevan su cantidad y el día libre que impide agendar queda apagado), "¿A
 * qué hora?" con las medias horas de la mañana y de la tarde y "Otra hora" (la hora es OBLIGATORIA: no hay "Sin hora"),
 * "Ese día ya tienes: …", luego "¿Con quién?" (médico de sus médicos o del buscador y una de sus sedes, o cuenta con una
 * de sus sedes y el subtipo) y la nota. El botón del pie dice lo que se agenda: "Agendar · jueves 16 oct · 10:00".
 *
 * Abre con fecha y hora ya elegidas: las de la URL (rutaAgendar: la franja tocada en Mi agenda) o la primera franja
 * libre desde las 08:00 (hoy, la siguiente media hora). El "con quién" puede venir en memoria (tomarPedidoAgendar: la
 * próxima reunión de una visita, u "otra fecha"). La app revisa la forma, la fecha, la hora, la cita repetida y el choque
 * de media hora con los mensajes del servidor (validarCitaConHora); el día libre, el perfil en esa fecha, el médico en la
 * sede y el subtipo vigente los decide la base y su mensaje se muestra tal cual en "No se agendó". Datos: los fijos
 * (perfil, médicos, subtipos, la persona) del contexto en memoria si tiene menos de 10 minutos o de GET
 * /api/me/contexto; una carga de 31 días de citas (GET /api/me/agenda) y de días libres al abrir y, más adelante, la de
 * cada mes al llegar a él (rangoPorCargar); POST /api/me/agenda. Al agendar vuelve a Mi agenda en ese día con la cita
 * resaltada. Nunca documentos.
 *
 * Revisión 2026-10-15:
 *   - Sin fecha en la URL abre en la primera franja libre desde MAÑANA (fechaInicialAgendar): una cita de hoy cuenta como
 *     no agendada y no debe ser el camino por defecto. Hoy se puede elegir igual, con su aviso.
 *   - El pie dice, sin esperar al toque, la cita repetida con el mismo médico (o cuenta y subtipo) y el choque de hora,
 *     que la base rechazarían; "Ese día ya tienes" va como lista.
 *   - Hoy a una hora que ya pasó no se agenda ("Esa hora ya pasó"): al cambiar la fecha a hoy, una hora pasada se cambia
 *     por la siguiente libre.
 *   - Un solo buscador de médicos: el del selector, que ofrece "Buscar en OpMap" con lo escrito (como en la tarjeta).
 *   - En una pantalla baja (iPhone SE u 8) el calendario abre en la semana, con "Ver mes".
 *
 * F1b (actividades de campo):
 *   - El choque de media hora es un ERROR (lo bloquea el servidor con 409): errorChoque lo dice con su mismo texto ("A
 *     las 09:30 ya tienes cita con …: elige otra hora"); ya no "Puedes agendar igual".
 *   - Quien tiene los dos papeles (Paola) elige "Como Ejecutiva Comercial" o "Como líder" (C12): como líder solo ve sus
 *     médicos de líder, los dos tipos (configuración general) y el día libre no apaga días (es del Ejecutivo Comercial).
 *     Los demás no ven esa opción. Sin Ejecutivo Comercial no se piden los días libres.
 *   - "Agendar otra fecha" (A7): con el pedido de una cita cerrada, el tipo y el "con quién" quedan fijos (los copia el
 *     servidor), se eligen la fecha, la hora, la sede y la nota (trae la de la anterior) y se manda a
 *     POST /api/me/agenda/[id]/otra-fecha.
 */
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useWindowDimensions, View } from 'react-native'
import { CalendarioMes } from '../../../components/agenda/CalendarioMes'
import { SelectorHora } from '../../../components/agenda/SelectorHora'
import { Buscador } from '../../../components/reporte/Buscador'
import { Selector } from '../../../components/reporte/Selector'
import {
  avisoAgendadaHoy,
  cuerpoCitaConHora,
  cuerpoOtraFecha,
  errorChoque,
  errorCitaRepetida,
  fechaInicialAgendar,
  fijarCitaResaltada,
  franjaPasada,
  lineasCitasDelDia,
  marcasDelMes,
  medicosConCitaEseDia,
  primeraFranjaLibre,
  rangoPorCargar,
  rutaMiAgenda,
  siguienteFranjaLibre,
  textoBotonAgendar,
  tomarPedidoAgendar,
  validarCitaConHora,
  ventanaInicialAgendar,
  vistaCalendarioAgendar,
  type PedidoAgendar,
} from '../../../lib/agenda'
import { textoOtraFechaDe } from '../../../lib/agenda-ciclo'
import * as api from '../../../lib/api'
import { mesDe } from '../../../lib/calendario'
import { contextoReciente, FRESCURA_DATOS_FIJOS_MS, invalidarContexto } from '../../../lib/contexto-memoria'
import { aApiError, mensajeDeError, type ApiError } from '../../../lib/errores'
import { esFechaIso, hoyBogota } from '../../../lib/fechas'
import { vibrarAviso, vibrarExito } from '../../../lib/haptica'
import { SoloEnFoco } from '../../../lib/montaje'
import { ETIQUETA_COMO, comoPorDefecto, eligeComo, medicosDelPapel, muestraDiasLibres, perfilDelPapel } from '../../../lib/persona'
import { cambiarFormularioCita, errorDe, formularioCitaVacio, horaDeCita, sedesDeCuentaBuscada, type FormularioCita } from '../../../lib/propuesta'
import { conQuienCita } from '../../../lib/reglas'
import { useSesion } from '../../../lib/sesion'
import { etiquetaClaseCuenta, etiquetaEspecialidad } from '../../../lib/terceros'
import {
  ETIQUETA_ACTIVIDAD,
  MAX_NOTA_CITA,
  type CitaItem,
  type ComoPersona,
  type ContextoResponse,
  type CuentaListItem,
  type DiaLibreItem,
  type ErrorVisita,
  type MedicoPublico,
  type TipoVisita,
} from '../../../lib/tipos'
import { Aviso, Boton, Campo, Cargando, Chip, Grupo, Pantalla, Subtitulo, Tarjeta, Texto, useColores } from '../../../lib/ui'

/** Médico que se puede agendar: de sus médicos o traído del buscador (sin documento). */
interface MedicoCita {
  id: string
  nombre: string
  detalle: string | null
  sedes: { id: string; nombre: string; cuenta_nombre: string | null }[]
  propio: boolean
}

interface CuentaCita {
  id: string
  nombre: string
  clase: string | null
  sedes: { id: string; nombre: string; cuenta_nombre: string | null }[]
}

/** Los días libres traídos (de la carga inicial y de cada mes): si se exige aprobación y los días. */
interface LibresCargados {
  requiereAprobacion: boolean
  items: DiaLibreItem[]
}

/**
 * Pestaña oculta: se monta de cero cada vez que recibe el foco (formulario nuevo), con la fecha y la hora de la URL y
 * el pedido en memoria, que se toma una sola vez al recibir el foco.
 */
export default function PantallaNuevaCita() {
  const { fecha, hora } = useLocalSearchParams<{ fecha?: string; hora?: string }>()
  const [entrada, setEntrada] = useState<{ vez: number; pedido: PedidoAgendar | null } | null>(null)
  useFocusEffect(
    useCallback(() => {
      const pedido = tomarPedidoAgendar()
      setEntrada(prev => ({ vez: (prev?.vez ?? 0) + 1, pedido }))
      return () => setEntrada(null)
    }, [])
  )
  if (!entrada) return null
  return (
    <SoloEnFoco clave={`${fecha ?? ''}|${hora ?? ''}|${entrada.vez}`}>
      <NuevaCita fechaPedida={typeof fecha === 'string' ? fecha : undefined} horaPedida={typeof hora === 'string' ? hora : undefined} pedido={entrada.pedido} />
    </SoloEnFoco>
  )
}

function medicoDeBusqueda(item: MedicoPublico): MedicoCita {
  return {
    id: item.id,
    nombre: item.nombre,
    detalle: [item.especialidades.map(etiquetaEspecialidad).join(', '), item.ciudad].filter(Boolean).join(' · ') || null,
    sedes: item.sedes.map(s => ({ id: s.id, nombre: s.nombre, cuenta_nombre: s.cuenta_nombre ?? null })),
    propio: false,
  }
}

/** Junta citas por id (lo que llega después manda: es más nuevo). */
function juntarCitas(anteriores: readonly CitaItem[], nuevas: readonly CitaItem[]): CitaItem[] {
  const porId = new Map(anteriores.map(cita => [cita.id, cita]))
  for (const cita of nuevas) porId.set(cita.id, cita)
  return Array.from(porId.values())
}

function NuevaCita({ fechaPedida, horaPedida, pedido }: { fechaPedida?: string; horaPedida?: string; pedido: PedidoAgendar | null }) {
  const router = useRouter()
  const c = useColores()
  const { perfil: perfilSesion } = useSesion()
  const hoy = hoyBogota()
  // Al abrir se traen 31 días (una consulta); más adelante, cada mes al llegar a él. Sin tope hacia adelante (A4).
  const ventana = ventanaInicialAgendar(hoy)
  /** "Agendar otra fecha" (A7): la cita cerrada de la que viene. */
  const origen = pedido?.otraFecha ?? null
  const fechaDeUrl = esFechaIso(fechaPedida) && fechaPedida >= hoy ? fechaPedida : null
  const horaDeUrl = typeof horaPedida === 'string' ? horaDeCita(horaPedida) : null
  const [contexto, setContexto] = useState<ContextoResponse | null>(null)
  const [errorContexto, setErrorContexto] = useState<ApiError | null>(null)
  const [citas, setCitas] = useState<CitaItem[]>([])
  const [libres, setLibres] = useState<LibresCargados | null>(null)
  const [sinAgenda, setSinAgenda] = useState(false)
  const [cargando, setCargando] = useState(true)
  /** Los rangos de citas ya traídos (la carga inicial y los meses que se fueron pidiendo). */
  const cargados = useRef<{ desde: string; hasta: string }[]>([])
  const pidiendo = useRef(new Set<string>())
  const { height: altoPantalla } = useWindowDimensions()
  /** En una pantalla baja, la semana (con "Ver mes"): así "¿A qué hora?" cae en la primera pantalla. */
  const vistaInicial = vistaCalendarioAgendar(altoPantalla)
  const [vistaCalendario, setVistaCalendario] = useState(vistaInicial)
  const [formulario, setFormulario] = useState<FormularioCita>(() => ({
    ...formularioCitaVacio(fechaDeUrl ?? fechaInicialAgendar(hoy), []),
    hora: typeof horaDeUrl === 'string' ? horaDeUrl : '',
    // Otra fecha: el mismo tipo y "con quién" de la anterior (los copia el servidor), su sede y su nota.
    ...(origen
      ? {
          tipo: origen.tipo,
          medico_id: origen.medico?.id ?? null,
          cuenta_id: origen.cuenta?.id ?? origen.sede.cuenta_id ?? null,
          subtipo_id: origen.subtipo?.id ?? null,
          sede_id: origen.sede.id,
          nota: origen.nota ?? '',
        }
      : {}),
  }))
  /** La hora la puso la app (no la URL ni la persona): al cambiar de día se busca otra libre. */
  const [horaAuto, setHoraAuto] = useState(typeof horaDeUrl !== 'string')
  const [buscados, setBuscados] = useState<MedicoCita[]>([])
  const [cuenta, setCuenta] = useState<CuentaCita | null>(null)
  const [errorCuenta, setErrorCuenta] = useState<string | null>(null)
  const [avisoPedido, setAvisoPedido] = useState<string | null>(null)
  const [intentado, setIntentado] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [errorServidor, setErrorServidor] = useState<{ mensaje: string; errores: ErrorVisita[] } | null>(null)
  const pedidoAplicado = useRef(false)

  /** La persona del contexto (si llegó; un servidor sin la 0850 no la manda) o la de la sesión. */
  const persona = contexto?.persona ?? perfilSesion?.persona ?? null
  const conDiasLibres = muestraDiasLibres({ persona, ejecutiva: perfilSesion?.ejecutiva })
  const conDiasLibresRef = useRef(conDiasLibres)
  conDiasLibresRef.current = conDiasLibres

  const cargar = useCallback(async () => {
    setCargando(true)
    // Los datos fijos (perfil, médicos, subtipos) no dependen del punto: sirve el contexto de hace menos de 10 minutos.
    const reciente = contextoReciente({ maxEdadMs: FRESCURA_DATOS_FIJOS_MS })
    const [ctx, agenda, dias] = await Promise.allSettled([
      reciente ? Promise.resolve(reciente.contexto) : api.contexto(null),
      api.agenda(ventana.desde, ventana.hasta),
      conDiasLibresRef.current ? api.diasLibres(ventana.desde, ventana.hasta) : Promise.resolve(null),
    ])
    const citasVentana = agenda.status === 'fulfilled' ? agenda.value.items : []
    const diasVentana = dias.status === 'fulfilled' ? dias.value : null
    if (agenda.status === 'fulfilled') cargados.current = [...cargados.current, ventana]
    setCitas(prev => juntarCitas(prev, citasVentana))
    setLibres(diasVentana ? { requiereAprobacion: diasVentana.requiere_aprobacion, items: diasVentana.items } : null)
    setSinAgenda(agenda.status === 'rejected')
    if (ctx.status === 'fulfilled') {
      const perfil = ctx.value.config.perfil
      const quien = ctx.value.persona ?? null
      setContexto(ctx.value)
      setErrorContexto(null)
      const marcasVentana = marcasDelMes(citasVentana, diasVentana?.items ?? [], { apagarLibres: true, requiereAprobacion: diasVentana?.requiere_aprobacion ?? true })
      setFormulario(prev => {
        let siguiente = prev.tipo ? prev : { ...prev, tipo: formularioCitaVacio(hoy, perfil).tipo }
        // "Como qué" (C12), solo para quien tiene los dos papeles: el de la anterior (otra fecha) o, si no, como
        // Ejecutivo Comercial.
        if (eligeComo(quien) && !siguiente.como) siguiente = { ...siguiente, como: origen?.como ?? comoPorDefecto(quien) }
        // Abre con una hora ya elegida: la de la URL, o la primera franja libre (de la fecha pedida o, sin fecha, desde
        // mañana: la de hoy contaría como no agendada).
        if (!fechaDeUrl) {
          const primera = primeraFranjaLibre(fechaInicialAgendar(hoy), ventana.hasta, citasVentana, marcasVentana)
          if (primera && typeof horaDeUrl !== 'string') siguiente = { ...siguiente, fecha: primera.fecha, hora: primera.hora }
        } else if (typeof horaDeUrl !== 'string') {
          siguiente = { ...siguiente, hora: siguienteFranjaLibre(siguiente.fecha, citasVentana) ?? '' }
        }
        return siguiente
      })
    } else {
      setErrorContexto(aApiError(ctx.reason))
    }
    setCargando(false)
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar])

  /** Las citas (y los días libres) de un mes más adelante que aún no se trajeron: al llegar a él en el calendario. */
  const cargarMes = useCallback(
    async (mes: string) => {
      const rango = rangoPorCargar(cargados.current, mes, hoy)
      if (!rango || pidiendo.current.has(mes)) return
      pidiendo.current.add(mes)
      try {
        const [agenda, dias] = await Promise.all([
          api.agenda(rango.desde, rango.hasta),
          conDiasLibresRef.current ? api.diasLibres(rango.desde, rango.hasta).catch(() => null) : Promise.resolve(null),
        ])
        cargados.current = [...cargados.current, rango]
        setCitas(prev => juntarCitas(prev, agenda.items))
        if (dias) {
          setLibres(prev => ({
            requiereAprobacion: dias.requiere_aprobacion,
            items: [...(prev?.items ?? []).filter(d => !dias.items.some(n => n.id === d.id)), ...dias.items],
          }))
        }
      } catch {
        // Sin esas citas solo no se avisan la repetida ni el choque de ese mes: el servidor decide al agendar.
      } finally {
        pidiendo.current.delete(mes)
      }
    },
    [hoy]
  )

  // Una fecha de un mes que aún no se trajo (p. ej. la semana que cruza de mes): sus citas. Después de la carga inicial,
  // para no pedir dos veces lo mismo al abrir.
  useEffect(() => {
    if (!cargando) void cargarMes(mesDe(formulario.fecha))
  }, [formulario.fecha, cargando, cargarMes])

  const como: ComoPersona | null = formulario.como
  const perfil: TipoVisita[] = perfilDelPapel(contexto?.config.perfil ?? [], persona, como)
  const medicos = useMemo<MedicoCita[]>(() => {
    const propios: MedicoCita[] = medicosDelPapel(contexto?.mis_medicos ?? [], persona, como).map(m => ({
      id: m.id,
      nombre: m.nombre,
      detalle: m.especialidades.map(etiquetaEspecialidad).join(', ') || null,
      sedes: m.sedes.map(s => ({ id: s.id, nombre: s.nombre, cuenta_nombre: s.cuenta_nombre })),
      propio: true,
    }))
    return [...propios, ...buscados.filter(b => !propios.some(p => p.id === b.id))]
  }, [contexto, buscados, persona, como])
  const medico = formulario.medico_id ? (medicos.find(m => m.id === formulario.medico_id) ?? null) : null
  const sedesOpciones = formulario.tipo === 'medica' ? (medico?.sedes ?? []) : (cuenta?.sedes ?? [])

  const marcas = useMemo(
    // El día libre es del Ejecutivo Comercial: como líder no apaga el día (hasta F3).
    () => marcasDelMes(citas, libres?.items ?? [], { apagarLibres: como !== 'lider', requiereAprobacion: libres?.requiereAprobacion ?? true }),
    [citas, libres, como]
  )
  const citasDelDia = useMemo(() => citas.filter(cita => cita.fecha === formulario.fecha), [citas, formulario.fecha])
  const conCita = useMemo(() => medicosConCitaEseDia(citas, formulario.fecha), [citas, formulario.fecha])
  /** El choque de media hora (0850: lo rechaza el servidor con este mismo texto). */
  const choque = errorChoque(formulario, citas)
  const delDia = lineasCitasDelDia(citasDelDia)
  const paraHoy = avisoAgendadaHoy(formulario.fecha, hoy)
  /** Ya hay cita con ese médico (o cuenta y subtipo) ese día: la base la rechazaría; se dice al elegirlo. */
  const repetida = errorCitaRepetida(formulario, citas)

  const erroresLocales = validarCitaConHora(formulario, hoy, perfil, { citas })
  const error = (...campos: string[]) =>
    (intentado ? errorDe(erroresLocales, ...campos) : null) ?? (errorServidor ? errorDe(errorServidor.errores, ...campos) : null)

  const cambiar = (cambios: Partial<FormularioCita>) => {
    setFormulario(prev => cambiarFormularioCita(prev, cambios))
    setErrorServidor(null)
  }

  const elegirFecha = (fecha: string) => {
    // La hora que puso la app se vuelve a buscar en el día nuevo; la que eligió la persona se queda, salvo que en ese día
    // ya haya pasado (hoy): entonces la siguiente libre.
    const hora = horaDeCita(formulario.hora)
    const yaPaso = typeof hora === 'string' && franjaPasada(fecha, hora)
    if (horaAuto || yaPaso) {
      if (yaPaso) setHoraAuto(true)
      cambiar({ fecha, hora: siguienteFranjaLibre(fecha, citas) ?? '' })
    } else cambiar({ fecha })
  }

  const elegirHora = (hora: string) => {
    setHoraAuto(false)
    cambiar({ hora })
  }

  /** "Como Ejecutiva Comercial" o "Como líder": lo que deja de cuadrar (un médico que no es de sus líneas de líder, un tipo fuera del perfil) se quita. */
  const elegirComo = (nuevo: ComoPersona) => {
    const cambios: Partial<FormularioCita> = { como: nuevo }
    if (!origen) {
      const tipos = perfilDelPapel(contexto?.config.perfil ?? [], persona, nuevo)
      const propios = medicosDelPapel(contexto?.mis_medicos ?? [], persona, nuevo)
      const sigue = !formulario.medico_id || propios.some(m => m.id === formulario.medico_id) || buscados.some(b => b.id === formulario.medico_id)
      if (formulario.tipo && !tipos.includes(formulario.tipo)) cambios.tipo = tipos[0] ?? null
      else if (!sigue) {
        cambios.medico_id = null
        cambios.sede_id = null
      }
    }
    cambiar(cambios)
  }

  const elegirMedico = (id: string | null) => {
    const elegido = id ? medicos.find(m => m.id === id) : undefined
    // Una sola sede: queda elegida.
    cambiar({ medico_id: id, sede_id: elegido && elegido.sedes.length === 1 ? elegido.sedes[0].id : null })
  }

  const agregarMedico = (item: MedicoPublico, sedePreferida?: string | null) => {
    const nuevo = medicoDeBusqueda(item)
    setBuscados(prev => [...prev.filter(b => b.id !== nuevo.id), nuevo])
    const sede = sedePreferida && nuevo.sedes.some(s => s.id === sedePreferida) ? sedePreferida : nuevo.sedes.length === 1 ? nuevo.sedes[0].id : null
    cambiar({ medico_id: nuevo.id, sede_id: sede })
  }

  const ponerCuenta = async (item: { id: string; nombre: string; clase: string | null }, sedePreferida?: string | null): Promise<boolean> => {
    setErrorCuenta(null)
    try {
      const detalle = await api.cuenta(item.id)
      const activas = sedesDeCuentaBuscada(item, detalle.sedes).map(s => ({ id: s.id, nombre: s.nombre, cuenta_nombre: null }))
      if (activas.length === 0) {
        setErrorCuenta('Esa cuenta no tiene sedes activas: elige otra cuenta.')
        return false
      }
      setCuenta({ id: item.id, nombre: item.nombre, clase: item.clase, sedes: activas })
      const sede = sedePreferida && activas.some(s => s.id === sedePreferida) ? sedePreferida : activas.length === 1 ? activas[0].id : null
      cambiar({ cuenta_id: item.id, sede_id: sede })
      return true
    } catch (e) {
      setErrorCuenta(mensajeDeError(e))
      return false
    }
  }

  // El "con quién" que vino en memoria (la próxima reunión de una visita, u otra fecha): se pone una vez, con lo que se
  // pueda traer. En otra fecha el tipo no se revisa contra el perfil (lo copia el servidor de la anterior).
  useEffect(() => {
    if (!contexto || !pedido || pedidoAplicado.current) return
    pedidoAplicado.current = true
    if (!pedido.otraFecha && !contexto.config.perfil.includes(pedido.tipo)) return
    setFormulario(prev => cambiarFormularioCita(prev, { tipo: pedido.tipo }))
    void (async () => {
      try {
        if (pedido.tipo === 'medica' && pedido.medico_id) {
          const propio = contexto.mis_medicos.find(m => m.id === pedido.medico_id)
          if (propio) {
            const sede = pedido.sede_id && propio.sedes.some(s => s.id === pedido.sede_id) ? pedido.sede_id : propio.sedes.length === 1 ? propio.sedes[0].id : null
            cambiar({ medico_id: propio.id, sede_id: sede })
          } else {
            agregarMedico((await api.medico(pedido.medico_id)).medico, pedido.sede_id)
          }
        } else if (pedido.tipo === 'institucional' && pedido.cuenta_id) {
          const detalle = await api.cuenta(pedido.cuenta_id)
          const puesta = await ponerCuenta({ id: detalle.cuenta.id, nombre: detalle.cuenta.nombre, clase: detalle.cuenta.clase }, pedido.sede_id)
          if (puesta && pedido.subtipo_id && (pedido.otraFecha || contexto.subtipos.some(s => s.id === pedido.subtipo_id))) cambiar({ subtipo_id: pedido.subtipo_id })
        }
      } catch {
        setAvisoPedido(pedido.otraFecha ? 'No pude traer las sedes: la otra fecha va en la misma sede.' : 'No pude traer con quién era la reunión: elígelo abajo.')
      }
    })()
  }, [contexto])

  const guardar = async () => {
    setIntentado(true)
    setErrorServidor(null)
    if (erroresLocales.length > 0) {
      vibrarAviso()
      return
    }
    setGuardando(true)
    try {
      const { cita } = origen ? await api.otraFechaCita(origen.id, cuerpoOtraFecha(formulario, origen)) : await api.agendar(cuerpoCitaConHora(formulario))
      invalidarContexto('cita')
      vibrarExito()
      fijarCitaResaltada(cita)
      router.navigate(rutaMiAgenda(cita.fecha))
    } catch (e) {
      const err = aApiError(e)
      setErrorServidor({ mensaje: err.message, errores: err.errores })
      vibrarAviso()
    } finally {
      setGuardando(false)
    }
  }

  if (cargando && !contexto) return <Cargando texto="Cargando tus médicos…" />
  if (errorContexto && !contexto) {
    return (
      <Pantalla>
        <Aviso tono="peligro" titulo="No pude cargar tus médicos" accion={<Boton titulo="Reintentar" variante="secundario" alPresionar={() => void cargar()} />}>
          {errorContexto.message}
        </Aviso>
      </Pantalla>
    )
  }

  const faltan = intentado ? erroresLocales.map(e => e.mensaje) : []
  // El pie dice, en este orden: el rechazo del servidor, lo que falta (después de tocar), la cita repetida o el choque de
  // hora (ya, porque la base los rechazaría). Así se ve sin desplazar.
  const pie = (
    <View style={{ gap: 6 }}>
      {errorServidor ? (
        <Texto peque color={c.peligro}>
          {`No se agendó: ${errorServidor.mensaje}`}
        </Texto>
      ) : faltan.length > 0 ? (
        <Texto peque color={c.peligro}>
          {`Falta algo: ${faltan.slice(0, 3).join(' · ')}${faltan.length > 3 ? '…' : ''}`}
        </Texto>
      ) : repetida ? (
        <Texto peque color={c.peligro}>
          {repetida.mensaje}
        </Texto>
      ) : choque ? (
        <Texto peque color={c.peligro}>
          {choque.mensaje}
        </Texto>
      ) : null}
      <Boton titulo={textoBotonAgendar(formulario.fecha, formulario.hora)} cargando={guardando} alPresionar={() => void guardar()} />
    </View>
  )

  return (
    <Pantalla pie={pie}>
      {/* ¿Qué vas a hacer? (F1b: la app habla de actividades; hoy, las dos visitas) y, para quien tiene los dos papeles,
          "como qué" (C12). */}
      <View style={{ gap: 10 }}>
        <Subtitulo>¿Qué vas a hacer?</Subtitulo>
        {origen ? (
          <View style={{ gap: 6 }}>
            <Aviso tono="info">{textoOtraFechaDe(origen)}</Aviso>
            <Texto>{ETIQUETA_ACTIVIDAD[origen.tipo]}</Texto>
          </View>
        ) : perfil.length === 0 ? (
          <Aviso tono="alerta">Tu perfil no incluye visitas médicas ni institucionales. Pide a la dirección comercial que lo revise.</Aviso>
        ) : perfil.length > 1 ? (
          <Grupo>
            {(['medica', 'institucional'] as TipoVisita[])
              .filter(tipo => perfil.includes(tipo))
              .map(tipo => (
                <Chip
                  key={tipo}
                  texto={ETIQUETA_ACTIVIDAD[tipo]}
                  activo={formulario.tipo === tipo}
                  alPresionar={() => {
                    if (tipo !== formulario.tipo) setCuenta(null)
                    cambiar({ tipo })
                  }}
                />
              ))}
          </Grupo>
        ) : (
          <Texto>{ETIQUETA_ACTIVIDAD[perfil[0]]}</Texto>
        )}
        {error('tipo') ? (
          <Texto peque color={c.peligro}>
            {error('tipo')}
          </Texto>
        ) : null}
        {eligeComo(persona) ? (
          <Grupo>
            {(['ejecutivo', 'lider'] as ComoPersona[]).map(papel => (
              <Chip key={papel} texto={ETIQUETA_COMO[papel]} activo={como === papel} alPresionar={() => elegirComo(papel)} />
            ))}
          </Grupo>
        ) : null}
      </View>

      {/* ¿Cuándo? (estilo Uber: los pasos sin caja, separados por una raya fina; el calendario al margen de 20, como lo
          demás: sus días miden ≥ 44 pt de ancho también en 360 dp). De hoy en adelante, sin tope (A4). */}
      <View style={{ gap: 8, borderTopWidth: 1, borderTopColor: c.borde, paddingTop: 16 }}>
        <Subtitulo>¿Cuándo?</Subtitulo>
        <CalendarioMes valor={formulario.fecha} alCambiar={elegirFecha} hoy={hoy} desde={hoy} marcas={marcas} vista={vistaCalendario} alCambiarMes={mes => void cargarMes(mes)} />
        {vistaInicial === 'semana' ? (
          <Boton
            titulo={vistaCalendario === 'semana' ? 'Ver mes' : 'Ver semana'}
            variante="texto"
            estilo={{ minHeight: 44, alignSelf: 'center', paddingVertical: 4 }}
            alPresionar={() => setVistaCalendario(vistaCalendario === 'semana' ? 'mes' : 'semana')}
          />
        ) : null}
        {paraHoy ? (
          <Texto peque color={c.alerta}>
            {paraHoy}
          </Texto>
        ) : null}
        {error('fecha') ? (
          <Texto peque color={c.peligro}>
            {error('fecha')}
          </Texto>
        ) : null}
        {sinAgenda ? (
          <Texto suave peque>
            No pude traer tus citas de esos días: no se avisan los choques.
          </Texto>
        ) : null}
      </View>

      {/* ¿A qué hora? */}
      <View style={{ gap: 10, borderTopWidth: 1, borderTopColor: c.borde, paddingTop: 16 }}>
        <Subtitulo>¿A qué hora?</Subtitulo>
        <SelectorHora valor={formulario.hora} alCambiar={elegirHora} fecha={formulario.fecha} citasDelDia={citasDelDia} error={error('hora')} />
        {/* "Ese día ya tienes", como lista (el choque de la hora elegida lo dice el pie). */}
        {delDia.length > 0 ? (
          <View style={{ gap: 2 }}>
            <Texto suave peque>
              Ese día ya tienes:
            </Texto>
            {delDia.map(linea => (
              <Texto key={linea} peque lineas={1}>
                {linea}
              </Texto>
            ))}
          </View>
        ) : null}
      </View>

      {/* ¿Con quién? */}
      <View style={{ gap: 12, borderTopWidth: 1, borderTopColor: c.borde, paddingTop: 16 }}>
        <Subtitulo>¿Con quién?</Subtitulo>
        {avisoPedido ? <Aviso tono="alerta">{avisoPedido}</Aviso> : null}

        {origen ? (
          // Otra fecha: el mismo médico o la misma cuenta y subtipo (los copia el servidor); solo la sede puede cambiar.
          <Tarjeta estilo={{ padding: 12, gap: 4 }}>
            <Texto negrita>{conQuienCita(origen)}</Texto>
            <Texto suave peque>
              Es la misma de la cita anterior.
            </Texto>
          </Tarjeta>
        ) : null}

        {!origen && formulario.tipo === 'medica' ? (
          <View style={{ gap: 12 }}>
            {/* Un solo buscador: el filtro de la lista, que ofrece "Buscar en OpMap" con lo escrito. */}
            <Selector
              etiqueta="Médico"
              valor={formulario.medico_id}
              placeholder="Elige el médico"
              opciones={medicos.map(m => ({ id: m.id, titulo: m.nombre, detalle: m.detalle, lateral: conCita.get(m.id) ?? (m.propio ? null : 'Buscado') }))}
              alElegir={elegirMedico}
              error={error('medico_id')}
              vacio="Aún no tienes médicos asignados: escribe su nombre arriba para buscarlo en OpMap."
              tituloElegido={medico?.nombre ?? null}
              buscarFuera={{
                donde: 'OpMap',
                resultados: (consulta, cerrar) => (
                  <Buscador<MedicoPublico>
                    etiqueta="Médicos en OpMap"
                    consulta={consulta}
                    buscar={async q => (await api.buscarMedicos(q)).items}
                    clave={item => item.id}
                    titulo={item => item.nombre}
                    detalle={item => [item.especialidades.map(etiquetaEspecialidad).join(', '), item.ciudad].filter(Boolean).join(' · ') || null}
                    sinResultados="No encontré a nadie con ese nombre en OpMap."
                    alElegir={item => {
                      agregarMedico(item)
                      cerrar()
                    }}
                  />
                ),
              }}
            />
            {repetida && formulario.tipo === 'medica' && !error('medico_id') ? <Aviso tono="alerta">{repetida.mensaje}</Aviso> : null}
          </View>
        ) : null}

        {!origen && formulario.tipo === 'institucional' ? (
          <View style={{ gap: 12 }}>
            {cuenta ? (
              <Tarjeta estilo={{ padding: 12, gap: 4 }}>
                <Texto suave peque>
                  Cuenta
                </Texto>
                <Texto negrita>{cuenta.nombre}</Texto>
                {cuenta.clase ? (
                  <Texto suave peque>
                    {etiquetaClaseCuenta(cuenta.clase)}
                  </Texto>
                ) : null}
                <Boton
                  titulo="Cambiar la cuenta"
                  variante="texto"
                  alPresionar={() => {
                    setCuenta(null)
                    cambiar({ cuenta_id: null })
                  }}
                />
              </Tarjeta>
            ) : (
              <Buscador<CuentaListItem>
                etiqueta="Cuenta"
                placeholder="Nombre de la clínica, EPS…"
                buscar={async q => (await api.buscarCuentas(q)).items}
                clave={item => item.id}
                titulo={item => item.nombre}
                detalle={item => `${etiquetaClaseCuenta(item.clase)} · ${item.sedes} ${item.sedes === 1 ? 'sede' : 'sedes'}`}
                alElegir={item => void ponerCuenta(item)}
                pie={errorCuenta ? <Aviso tono="peligro">{errorCuenta}</Aviso> : error('cuenta_id') ? <Texto peque color={c.peligro}>{error('cuenta_id')}</Texto> : undefined}
              />
            )}
            <Selector
              etiqueta="Subtipo"
              valor={formulario.subtipo_id}
              placeholder="Elige el subtipo"
              opciones={(contexto?.subtipos ?? []).map(s => ({ id: s.id, titulo: s.nombre }))}
              alElegir={id => cambiar({ subtipo_id: id })}
              error={error('subtipo_id')}
              vacio="No hay subtipos institucionales vigentes."
            />
          </View>
        ) : null}

        {(formulario.tipo === 'medica' && medico) || (formulario.tipo === 'institucional' && cuenta) ? (
          <Selector
            etiqueta="Sede"
            valor={formulario.sede_id}
            placeholder="Elige la sede"
            opciones={sedesOpciones.map(s => ({
              id: s.id,
              titulo: s.nombre,
              detalle: s.cuenta_nombre && s.cuenta_nombre !== s.nombre ? s.cuenta_nombre : null,
            }))}
            alElegir={id => cambiar({ sede_id: id })}
            error={error('sede_id')}
            vacio={formulario.tipo === 'medica' ? 'Este médico no tiene sedes en OpMap.' : 'Esta cuenta no tiene sedes activas.'}
            abiertoInicial={!formulario.sede_id && sedesOpciones.length > 1}
          />
        ) : origen ? (
          <Texto suave peque>{`Sede: ${origen.sede.nombre}`}</Texto>
        ) : error('sede_id') && formulario.tipo ? (
          <Texto peque color={c.peligro}>
            {formulario.tipo === 'medica' ? 'Elige el médico y la sede' : 'Elige la cuenta y la sede'}
          </Texto>
        ) : null}
      </View>

      {/* Nota */}
      <View style={{ borderTopWidth: 1, borderTopColor: c.borde, paddingTop: 16 }}>
        <Campo
          etiqueta="Nota (opcional)"
          valor={formulario.nota}
          alCambiar={texto => cambiar({ nota: texto })}
          varias
          maxLength={MAX_NOTA_CITA}
          placeholder="Qué llevar, a quién preguntar… (sin datos de pacientes)"
          error={error('nota')}
        />
      </View>

      {errorServidor ? (
        <Aviso tono="peligro" titulo="No se agendó">
          {errorServidor.mensaje}
        </Aviso>
      ) : null}

      <Boton titulo="Volver a mi agenda" variante="texto" deshabilitado={guardando} alPresionar={() => (router.canGoBack() ? router.back() : router.replace('/agenda'))} />
    </Pantalla>
  )
}
