/**
 * Agendar una cita como calendario con hora (F4.1; spec 2026-10-15, decisiones 1 y 2 del dueño): "¿Cuándo?" con el
 * mes en cuadrícula (de hoy a hoy + 30; los días con citas llevan su cantidad y el día libre que impide agendar queda
 * apagado), "¿A qué hora?" con las medias horas de la mañana y de la tarde y "Otra hora" (la hora es OBLIGATORIA: no hay "Sin
 * hora"), "Ese día ya tienes: …" y el aviso de choque (no bloquea), luego "¿Con quién?" (tipo según el perfil; médico de
 * sus médicos o del buscador y una de sus sedes, o cuenta con una de sus sedes y el subtipo) y la nota. El botón del
 * pie dice lo que se agenda: "Agendar · jueves 16 oct · 10:00".
 *
 * Abre con fecha y hora ya elegidas: las de la URL (rutaAgendar: la franja tocada en Mi agenda) o la primera franja
 * libre desde las 08:00 (hoy, la siguiente media hora). El "con quién" puede venir en memoria (tomarPedidoAgendar: la
 * próxima reunión de una visita). La app revisa la forma, la ventana y la hora con los mensajes del servidor
 * (validarCitaConHora); el día libre, el perfil en esa fecha, el médico en la sede, el subtipo vigente y los repetidos
 * los decide la base y su mensaje se muestra tal cual en "No se agendó". Datos: los fijos (perfil, médicos, subtipos)
 * del contexto en memoria si tiene menos de 10 minutos o de GET /api/me/contexto; una sola carga de 31 días de citas
 * (GET /api/me/agenda) y de días libres; POST /api/me/agenda. Al agendar vuelve a Mi agenda en ese día con la cita
 * resaltada. Nunca documentos.
 *
 * Revisión 2026-10-15:
 *   - Sin fecha en la URL abre en la primera franja libre desde MAÑANA (fechaInicialAgendar): una cita de hoy cuenta como
 *     no agendada y no debe ser el camino por defecto. Hoy se puede elegir igual, con su aviso.
 *   - El pie dice el choque ("A las 09:00 ya tienes cita con …") y, sin esperar al toque, la cita repetida con el mismo
 *     médico (o cuenta y subtipo) que la base rechazaría; "Ese día ya tienes" va como lista.
 *   - Hoy a una hora que ya pasó no se agenda ("Esa hora ya pasó"): al cambiar la fecha a hoy, una hora pasada se cambia
 *     por la siguiente libre.
 *   - Un solo buscador de médicos: el del selector, que ofrece "Buscar en OpMap" con lo escrito (como en la tarjeta).
 *   - En una pantalla baja (iPhone SE u 8) el calendario abre en la semana, con "Ver mes".
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
  avisoChoque,
  cuerpoCitaConHora,
  errorCitaRepetida,
  fechaInicialAgendar,
  fijarCitaResaltada,
  franjaPasada,
  lineasCitasDelDia,
  marcasDelMes,
  medicosConCitaEseDia,
  primeraFranjaLibre,
  rutaMiAgenda,
  siguienteFranjaLibre,
  textoBotonAgendar,
  tomarPedidoAgendar,
  validarCitaConHora,
  vistaCalendarioAgendar,
  type PedidoAgendar,
} from '../../../lib/agenda'
import * as api from '../../../lib/api'
import { contextoReciente, FRESCURA_DATOS_FIJOS_MS, invalidarContexto } from '../../../lib/contexto-memoria'
import { aApiError, mensajeDeError, type ApiError } from '../../../lib/errores'
import { esFechaIso, hoyBogota } from '../../../lib/fechas'
import { vibrarAviso, vibrarExito } from '../../../lib/haptica'
import { SoloEnFoco } from '../../../lib/montaje'
import { cambiarFormularioCita, errorDe, formularioCitaVacio, horaDeCita, sedesDeCuentaBuscada, ventanaCita, type FormularioCita } from '../../../lib/propuesta'
import { etiquetaClaseCuenta, etiquetaEspecialidad } from '../../../lib/terceros'
import {
  ETIQUETA_TIPO_VISITA,
  MAX_NOTA_CITA,
  type CitaItem,
  type ContextoResponse,
  type CuentaListItem,
  type ErrorVisita,
  type MedicoPublico,
  type MisDiasLibresResponse,
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

function NuevaCita({ fechaPedida, horaPedida, pedido }: { fechaPedida?: string; horaPedida?: string; pedido: PedidoAgendar | null }) {
  const router = useRouter()
  const c = useColores()
  const hoy = hoyBogota()
  const ventana = ventanaCita(hoy)
  const fechaDeUrl = esFechaIso(fechaPedida) && fechaPedida >= ventana.desde && fechaPedida <= ventana.hasta ? fechaPedida : null
  const horaDeUrl = typeof horaPedida === 'string' ? horaDeCita(horaPedida) : null
  const [contexto, setContexto] = useState<ContextoResponse | null>(null)
  const [errorContexto, setErrorContexto] = useState<ApiError | null>(null)
  const [citas, setCitas] = useState<CitaItem[]>([])
  const [libres, setLibres] = useState<MisDiasLibresResponse | null>(null)
  const [sinAgenda, setSinAgenda] = useState(false)
  const [cargando, setCargando] = useState(true)
  const { height: altoPantalla } = useWindowDimensions()
  /** En una pantalla baja, la semana (con "Ver mes"): así "¿A qué hora?" cae en la primera pantalla. */
  const vistaInicial = vistaCalendarioAgendar(altoPantalla)
  const [vistaCalendario, setVistaCalendario] = useState(vistaInicial)
  const [formulario, setFormulario] = useState<FormularioCita>(() => ({
    ...formularioCitaVacio(fechaDeUrl ?? fechaInicialAgendar(hoy), []),
    hora: typeof horaDeUrl === 'string' ? horaDeUrl : '',
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

  const cargar = useCallback(async () => {
    setCargando(true)
    // Los datos fijos (perfil, médicos, subtipos) no dependen del punto: sirve el contexto de hace menos de 10 minutos.
    const reciente = contextoReciente({ maxEdadMs: FRESCURA_DATOS_FIJOS_MS })
    const [ctx, agenda, dias] = await Promise.allSettled([
      reciente ? Promise.resolve(reciente.contexto) : api.contexto(null),
      api.agenda(ventana.desde, ventana.hasta),
      api.diasLibres(ventana.desde, ventana.hasta),
    ])
    const citasVentana = agenda.status === 'fulfilled' ? agenda.value.items : []
    const diasVentana = dias.status === 'fulfilled' ? dias.value : null
    setCitas(citasVentana)
    setLibres(diasVentana)
    setSinAgenda(agenda.status === 'rejected')
    if (ctx.status === 'fulfilled') {
      const perfil = ctx.value.config.perfil
      setContexto(ctx.value)
      setErrorContexto(null)
      const marcasVentana = marcasDelMes(citasVentana, diasVentana?.items ?? [], { apagarLibres: true, requiereAprobacion: diasVentana?.requiere_aprobacion ?? true })
      setFormulario(prev => {
        let siguiente = prev.tipo ? prev : { ...prev, tipo: formularioCitaVacio(hoy, perfil).tipo }
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

  const perfil: TipoVisita[] = contexto?.config.perfil ?? []
  const medicos = useMemo<MedicoCita[]>(() => {
    const propios: MedicoCita[] = (contexto?.mis_medicos ?? []).map(m => ({
      id: m.id,
      nombre: m.nombre,
      detalle: m.especialidades.map(etiquetaEspecialidad).join(', ') || null,
      sedes: m.sedes.map(s => ({ id: s.id, nombre: s.nombre, cuenta_nombre: s.cuenta_nombre })),
      propio: true,
    }))
    return [...propios, ...buscados.filter(b => !propios.some(p => p.id === b.id))]
  }, [contexto, buscados])
  const medico = formulario.medico_id ? (medicos.find(m => m.id === formulario.medico_id) ?? null) : null
  const sedesOpciones = formulario.tipo === 'medica' ? (medico?.sedes ?? []) : (cuenta?.sedes ?? [])

  const marcas = useMemo(
    () => marcasDelMes(citas, libres?.items ?? [], { apagarLibres: true, requiereAprobacion: libres?.requiere_aprobacion ?? true }),
    [citas, libres]
  )
  const citasDelDia = useMemo(() => citas.filter(cita => cita.fecha === formulario.fecha), [citas, formulario.fecha])
  const conCita = useMemo(() => medicosConCitaEseDia(citas, formulario.fecha), [citas, formulario.fecha])
  const choque = avisoChoque(formulario.hora, citasDelDia)
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

  // El "con quién" que vino en memoria (la próxima reunión de una visita): se pone una vez, con lo que se pueda traer.
  useEffect(() => {
    if (!contexto || !pedido || pedidoAplicado.current) return
    pedidoAplicado.current = true
    if (!contexto.config.perfil.includes(pedido.tipo)) return
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
          if (puesta && pedido.subtipo_id && contexto.subtipos.some(s => s.id === pedido.subtipo_id)) cambiar({ subtipo_id: pedido.subtipo_id })
        }
      } catch {
        setAvisoPedido('No pude traer con quién era la reunión: elígelo abajo.')
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
      const { cita } = await api.agendar(cuerpoCitaConHora(formulario))
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
  // El pie dice, en este orden: el rechazo del servidor, lo que falta (después de tocar), la cita repetida (ya, porque la
  // base la rechazaría) o el choque de hora (solo aviso: se agenda igual). Así se ve sin desplazar.
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
        <Texto peque color={c.alerta}>
          {choque}
        </Texto>
      ) : null}
      <Boton titulo={textoBotonAgendar(formulario.fecha, formulario.hora)} cargando={guardando} alPresionar={() => void guardar()} />
    </View>
  )

  return (
    <Pantalla pie={pie}>
      {/* ¿Cuándo? (estilo Uber: los pasos sin caja, separados por una raya fina; el calendario al margen de 20, como lo
          demás: sus días miden ≥ 44 pt de ancho también en 360 dp) */}
      <View style={{ gap: 8 }}>
        <Subtitulo>¿Cuándo?</Subtitulo>
        <CalendarioMes valor={formulario.fecha} alCambiar={elegirFecha} hoy={hoy} desde={ventana.desde} hasta={ventana.hasta} marcas={marcas} vista={vistaCalendario} />
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
        {perfil.length === 0 ? (
          <Aviso tono="alerta">Tu perfil no incluye visitas médicas ni institucionales. Pide a la dirección comercial que lo revise.</Aviso>
        ) : perfil.length > 1 ? (
          <Grupo>
            {(['medica', 'institucional'] as TipoVisita[])
              .filter(tipo => perfil.includes(tipo))
              .map(tipo => (
                <Chip
                  key={tipo}
                  texto={ETIQUETA_TIPO_VISITA[tipo]}
                  activo={formulario.tipo === tipo}
                  alPresionar={() => {
                    if (tipo !== formulario.tipo) setCuenta(null)
                    cambiar({ tipo })
                  }}
                />
              ))}
          </Grupo>
        ) : (
          <Texto suave>Visita {ETIQUETA_TIPO_VISITA[perfil[0]].toLowerCase()}</Texto>
        )}
        {error('tipo') ? (
          <Texto peque color={c.peligro}>
            {error('tipo')}
          </Texto>
        ) : null}

        {formulario.tipo === 'medica' ? (
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

        {formulario.tipo === 'institucional' ? (
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
