/**
 * Hoy: meta del día frente a lo hecho, botón grande "Reportar", la agenda de hoy (F4.1: hora, con quién, sede y si ya
 * se hizo, con "Agendar" y "Ver agenda"), visitas guardadas sin señal, compromisos vencidos y las visitas de hoy. Datos: POST /api/me/contexto (con la ubicación en el cuerpo si el teléfono la da;
 * se guarda en el teléfono para reportar sin señal) y GET /api/me/visitas?fecha=hoy. Si el servidor todavía no tiene
 * el reporte de visitas (404/503), se muestra el aviso y la cola sigue funcionando. Una visita de la cola que el
 * servidor no aceptó hoy se puede "Reportar de nuevo" (vuelve a Reportar como tarjeta, sin perder lo escrito).
 *
 * Menos esperas (spec 2026-10-15): se pinta primero lo que ya hay (el contexto en memoria o el guardado hoy en el
 * teléfono) con "Actualizando…"; al volver a Hoy no se pide de nuevo antes de 60 s (debeRecargarHoy) salvo que algo lo
 * invalide (visita guardada, cita, día libre: escucharInvalidacion) o se tire para actualizar. Una cita pendiente se
 * toca para reportarla: Reportar la abre ya elegida (fijarCitaParaReportar).
 *
 * Estilo Uber (2026-10-15, spec 2026-10-15-movil-estilo-uber): sin encabezado; arriba el croquis (tu punto, las sedes
 * cercanas y el radio de la sede de la cita "de ahora") con el logotipo, y la hoja blanca con "Hola, …", "Agendar" y
 * el resto en secciones con filas de separador fino.
 *
 * F1b (actividades de campo, spec 2026-10-15-actividades-de-campo): una líder (sin Ejecutivo Comercial) es persona de
 * campo: ya no ve "no está enlazado" ni la meta del día (no tiene cuota, C4); solo quien el servidor confirmó sin líneas
 * ve "Tu usuario no tiene líneas para reportar". "Reportar actividad" y "Actividades de hoy" (la app habla de
 * actividades). "¿Qué pasó con esto?" (components/agenda/QuePasoConEsto) junta lo atrasado de hoy y lo sin cerrar de
 * los 31 días anteriores (GET /api/me/agenda hacia atrás, en la misma carga) con Reportar, "No se hizo" y Cancelar; lo
 * que está ahí no se repite en "Tu agenda de hoy", y la cita "de ahora" sigue en "Siguiente".
 */
import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { View } from 'react-native'
import { Croquis, PastillaLogo } from '../../components/Croquis'
import { Logo } from '../../components/Logo'
import { QuePasoConEsto } from '../../components/agenda/QuePasoConEsto'
import { FilaCita } from '../../components/reporte/FilaCita'
import { enPie, fijarPedidoAgendar, pedidoOtraFecha, rutaAgendar } from '../../lib/agenda'
import * as api from '../../lib/api'
import { useCola } from '../../lib/cola-contexto'
import { guardarContexto, leerContextoGuardado } from '../../lib/contexto-guardado'
import { FRESCURA_PINTAR_MS, FRESCURA_SIN_PEDIR_MS, contextoReciente, escucharInvalidacion } from '../../lib/contexto-memoria'
import { aApiError, esNoDisponible, mensajeDeError, type ApiError } from '../../lib/errores'
import { fechaCorta, fechaLarga, horaBogota, hoyBogota, sumarDias } from '../../lib/fechas'
import { textoDistancia, textoPrecision } from '../../lib/geo'
import { vibrarExito } from '../../lib/haptica'
import { Icono } from '../../lib/iconos'
import { citaAtrasada, citaDeAhora, debeRecargarHoy, porCerrar, textoSiguienteCita, textoUbicacionTomada } from '../../lib/pantallas'
import { AYUDA_SIN_LINEAS, MENSAJE_SIN_LINEAS, estadoPersona, tieneCuota } from '../../lib/persona'
import { avance, conQuien, conQuienCita, detalleModalidad, fraccionBarra, numeroTexto, plural, sinCortes } from '../../lib/reglas'
import { fijarCitaParaReportar, fijarReintento } from '../../lib/retorno'
import { useSesion } from '../../lib/sesion'
import type { CitaItem, ContextoResponse, VisitaItem, VisitasResponse } from '../../lib/tipos'
import { ETIQUETA_TIPO_VISITA, MAX_DIAS_CONSULTA_AGENDA } from '../../lib/tipos'
import { pedirUbicacionEnDosPasos, type ResultadoUbicacion } from '../../lib/ubicacion'
import { Aviso, Barra, Bloque, BordeHoja, Boton, Cargando, Fila, FilaLista, Grupo, Insignia, Pantalla, Seccion, Texto, Titulo, Vacio, useColores } from '../../lib/ui'

/** Cada cuánto se mueve el reloj de la cita "de ahora" ("en 25 min", "Atrasada") mientras Hoy está a la vista. */
const RELOJ_MS = 30_000

export default function Hoy() {
  const router = useRouter()
  const { perfil, sinConfirmar, refrescar: refrescarSesion } = useSesion()
  // Para confirmar la sesión con el servidor cuando la app abrió sin señal (sin rehacer `cargar` en cada cambio).
  const sesion = useRef({ sinConfirmar, refrescarSesion, usuarioId: perfil?.usuario.id ?? null })
  sesion.current = { sinConfirmar, refrescarSesion, usuarioId: perfil?.usuario.id ?? null }
  const cola = useCola()
  const { reintentar } = cola
  const c = useColores()
  const [contexto, setContexto] = useState<ContextoResponse | null>(null)
  const [errorContexto, setErrorContexto] = useState<ApiError | null>(null)
  const [visitas, setVisitas] = useState<VisitasResponse | null>(null)
  const [errorVisitas, setErrorVisitas] = useState<ApiError | null>(null)
  /** Las citas de los 31 días anteriores (pendientes y hechas): de ahí sale lo "sin cerrar" de "¿Qué pasó con esto?". */
  const [anteriores, setAnteriores] = useState<CitaItem[]>([])
  const [ubicacion, setUbicacion] = useState<ResultadoUbicacion | null>(null)
  const [cargando, setCargando] = useState(true)
  const [refrescando, setRefrescando] = useState(false)
  /** Hay una carga en curso mientras se ve lo que ya había ("Actualizando…", sin tapar la pantalla). */
  const [actualizando, setActualizando] = useState(false)
  const [actualizado, setActualizado] = useState<string | null>(null)
  const [ahora, setAhora] = useState(() => new Date())
  const enCurso = useRef(false)
  /** Cuándo llegó el contexto que se ve (ms); null: todavía nada del servidor en esta pantalla. */
  const ultimaCarga = useRef<number | null>(null)
  /** Algo cambió desde la última carga (invalidarContexto) o se tiró para actualizar. */
  const invalidado = useRef(false)
  const enfocada = useRef(false)

  // Primero lo que ya hay: el contexto en memoria (de hace menos de 3 min) o el guardado hoy en el teléfono.
  useEffect(() => {
    let vigente = true
    const enMemoria = contextoReciente({ maxEdadMs: FRESCURA_PINTAR_MS })
    if (enMemoria) {
      setContexto(actual => actual ?? enMemoria.contexto)
    } else {
      leerContextoGuardado(sesion.current.usuarioId).then(
        guardado => {
          if (vigente && guardado) setContexto(actual => actual ?? guardado.contexto)
        },
        () => undefined
      )
    }
    return () => {
      vigente = false
    }
  }, [])

  const cargarUnaVez = useCallback(
    async (forzar: boolean) => {
      const hoy = hoyBogota()
      if (sesion.current.sinConfirmar) void sesion.current.refrescarSesion()
      const pedidoVisitas = api.visitas(hoy).then(
        datos => {
          setVisitas(datos)
          setErrorVisitas(null)
        },
        error => setErrorVisitas(aApiError(error))
      )
      // Lo sin cerrar de días anteriores (como mucho 31 días hacia atrás, una consulta). Si falla, queda lo que había.
      const pedidoAnteriores = api.agenda(sumarDias(hoy, -MAX_DIAS_CONSULTA_AGENDA), sumarDias(hoy, -1)).then(
        datos => setAnteriores(datos.items),
        () => undefined
      )
      // Hoy solo muestra (meta, agenda y distancias): le basta la primera ubicación (la última conocida reciente o una
      // lectura rápida) y no espera la de alta precisión, que sigue mientras la app está abierta y deja fresca la
      // última conocida con que Reportar muestra su lista enseguida (lib/ubicacion-pasos.ts).
      const resultado = (await pedirUbicacionEnDosPasos({ timeoutMs: 8_000 }).primera).resultado
      setUbicacion(resultado)
      const punto = resultado.ubicacion
      // Un contexto de menos de 60 s pedido cerca de aquí (por Reportar, por ejemplo) sirve tal cual: no se pide otro.
      const reciente = forzar ? null : contextoReciente({ maxEdadMs: FRESCURA_SIN_PEDIR_MS, cercaDe: punto ? { lat: punto.lat, lng: punto.lng } : null })
      // Cuándo llegó el contexto que queda a la vista (null: no llegó).
      const pedidoContexto: Promise<number | null> = reciente
        ? Promise.resolve().then(() => {
            setContexto(reciente.contexto)
            setErrorContexto(null)
            return reciente.recibidoEn
          })
        : api.contexto(punto ? { lat: punto.lat, lng: punto.lng, precision: punto.precision } : null).then(
            datos => {
              setContexto(datos)
              setErrorContexto(null)
              void guardarContexto(sesion.current.usuarioId, datos) // para poder reportar sin señal más tarde, hoy
              return Date.now()
            },
            error => {
              setErrorContexto(aApiError(error))
              return null
            }
          )
      const [, llegada] = await Promise.all([pedidoVisitas, pedidoContexto, reintentar(), pedidoAnteriores])
      if (llegada !== null) {
        ultimaCarga.current = llegada
        setActualizado(new Date(llegada).toISOString())
      }
    },
    [reintentar]
  )

  const cargar = useCallback(
    async (forzar: boolean = false) => {
      if (enCurso.current) return
      enCurso.current = true
      setActualizando(true)
      try {
        let vuelta = 0
        do {
          // Lo que se pide ahora ya trae todo lo invalidado hasta aquí. Si llega otra invalidación mientras tanto (la
          // cola envió una visita guardada sin señal, por ejemplo), se pide una vez más.
          invalidado.current = false
          await cargarUnaVez(forzar || vuelta > 0)
          vuelta++
        } while (invalidado.current && enfocada.current && vuelta < 2)
      } finally {
        enCurso.current = false
        setCargando(false)
        setRefrescando(false)
        setActualizando(false)
      }
    },
    [cargarUnaVez]
  )

  useFocusEffect(
    useCallback(() => {
      enfocada.current = true
      if (debeRecargarHoy(ultimaCarga.current, Date.now(), invalidado.current)) void cargar()
      else void reintentar() // lo de la pantalla sigue fresco; solo se intenta enviar lo guardado sin señal
      return () => {
        enfocada.current = false
      }
    }, [cargar, reintentar])
  )

  // Una visita guardada, una cita agendada o cancelada, un día libre: la próxima vez (o ya, si Hoy está a la vista) se
  // pide de nuevo.
  useEffect(
    () =>
      escucharInvalidacion(() => {
        invalidado.current = true
        if (enfocada.current) void cargar()
      }),
    [cargar]
  )

  // El reloj de la cita "de ahora" ("en 25 min", "Atrasada"), solo mientras Hoy está a la vista.
  useFocusEffect(
    useCallback(() => {
      setAhora(new Date())
      const reloj = setInterval(() => setAhora(new Date()), RELOJ_MS)
      return () => clearInterval(reloj)
    }, [])
  )

  const refrescar = () => {
    setRefrescando(true)
    invalidado.current = true
    void cargar(true)
  }

  if (cargando && !contexto && !visitas) return <Cargando texto="Cargando tu día…" />

  const hoy = hoyBogota()
  const nombre = contexto?.ejecutiva.nombre ?? perfil?.ejecutiva?.full_name ?? perfil?.usuario.full_name ?? ''
  const zona = contexto?.ejecutiva.zona ?? perfil?.ejecutiva?.zona ?? null
  // F1b: la persona del contexto (si llegó) o la del perfil. Solo quien el servidor confirmó sin líneas ve el aviso; una
  // líder sin Ejecutivo Comercial es persona de campo y no lo ve.
  const persona = contexto?.persona ?? perfil?.persona
  const estado = estadoPersona({ role: perfil?.usuario.role, persona, sinConfirmar })
  const sinLineas = estado === 'sin_lineas' && !contexto
  const conCuota = tieneCuota({ persona, ejecutiva: perfil?.ejecutiva })
  const pendientes = cola.items.filter(e => e.estado === 'pendiente')
  const porConfirmar = cola.items.filter(e => e.estado === 'por_confirmar')
  const noEnviadas = cola.items.filter(e => e.estado === 'no_enviada')
  const reportarDeNuevo = (e: (typeof noEnviadas)[number]) => {
    fijarReintento({ client_id: e.client_id, cuerpo: e.cuerpo, error: e.error })
    router.push('/reportar')
  }
  const reportarCita = (cita: CitaItem) => {
    fijarCitaParaReportar(cita.id)
    router.push('/reportar')
  }
  /** "No se hizo" o Cancelar desde "¿Qué pasó con esto?": la cita cerrada, o el mensaje del error (lib/api invalida). */
  const cerrarCita = async (cita: CitaItem, uso: 'cerrar' | 'cancelar', motivo: api.MotivoDeCierre): Promise<CitaItem | string> => {
    try {
      const { cita: cerrada } = uso === 'cerrar' ? await api.cerrarCita(cita.id, motivo) : await api.cancelarCita(cita.id, motivo)
      vibrarExito()
      setAnteriores(prev => prev.filter(x => x.id !== cita.id))
      return cerrada
    } catch (e) {
      return mensajeDeError(e)
    }
  }
  const otraFecha = (cita: CitaItem) => {
    fijarPedidoAgendar(pedidoOtraFecha(cita))
    router.push(rutaAgendar({}))
  }
  const items = (visitas?.items ?? []).slice().sort((a, b) => b.checked_in_at.localeCompare(a.checked_in_at))
  const textoUbicacion = ubicacion?.ubicacion ? textoUbicacionTomada(ubicacion.ubicacion.precision, ubicacion.ubicacion.aproximada) : (ubicacion?.error ?? '')

  // Croquis: tu punto, las sedes cercanas y el radio de la sede de la cita "de ahora" (o la más cercana).
  const citasDeHoy = (contexto?.agenda_hoy ?? []).filter(enPie)
  const deAhoraCroquis = contexto ? citaDeAhora(citasDeHoy, ahora) : null
  // "¿Qué pasó con esto?": lo atrasado de hoy (sin la cita "de ahora") y lo sin cerrar de días anteriores.
  const sinResultado = porCerrar([...citasDeHoy, ...anteriores.filter(c => c.fecha < hoy)], ahora, deAhoraCroquis?.id ?? null)
  const aparte = new Set(sinResultado.map(c => c.id))
  const sedesCroquis = [...(contexto?.sedes_cerca ?? []), ...(deAhoraCroquis ? [deAhoraCroquis.sede] : [])]
  const punto = ubicacion?.ubicacion ?? null
  const precisionTexto = punto ? textoPrecision(punto.precision) : null

  return (
    <Pantalla alRefrescar={refrescar} refrescando={refrescando}>
      <Croquis
        yo={punto}
        sedes={sedesCroquis}
        foco={deAhoraCroquis?.sede.id ?? null}
        radioM={contexto?.config.radio_m ?? null}
        etiquetaYo={punto ? `Estás aquí${precisionTexto ? ` · ${precisionTexto}` : ''}` : null}
        arribaIzquierda={
          <PastillaLogo>
            <Logo ancho={82} />
          </PastillaLogo>
        }
      />
      <BordeHoja />

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <View style={{ gap: 2, flexShrink: 1 }}>
          <Titulo>{nombre ? `Hola, ${primerNombre(nombre)}` : 'Hoy'}</Titulo>
          <Texto suave>{capitalizar(fechaLarga(hoy))}</Texto>
          {zona ? <Texto suave>Zona {zona}</Texto> : null}
          {actualizando && !refrescando ? (
            <Texto suave peque>
              Actualizando…
            </Texto>
          ) : null}
        </View>
        {/* Como antes del estilo Uber (estaba en "Tu agenda de hoy"): solo con el contexto del día, no sin él ni sin
            Ejecutivo Comercial enlazado. */}
        {contexto ? <Boton titulo="Agendar" variante="secundario" compacto icono="agregar" alPresionar={() => router.push('/agenda/nueva')} /> : null}
      </View>

      {sinLineas ? (
        <Aviso tono="peligro" titulo={MENSAJE_SIN_LINEAS}>
          {AYUDA_SIN_LINEAS}
        </Aviso>
      ) : null}
      {sinConfirmar ? (
        <Aviso tono="alerta">
          Sin conexión con el servidor: Reportar usa las sedes y médicos guardados hoy; lo que confirmes se guarda en el teléfono y se envía solo al volver la señal.
        </Aviso>
      ) : null}

      <Boton titulo="Reportar actividad" detalle="Dicta lo que pasó o repórtalo por toques" grande icono="microfono" alPresionar={() => router.push('/reportar')} />

      {/* Sin Ejecutivo Comercial (una líder) no hay cuota ni meta del día (C4); sin contexto, el error de la carga. */}
      {conCuota || !contexto ? <MetaDelDia contexto={contexto} error={sinLineas ? null : errorContexto} /> : null}
      {contexto && errorContexto && !actualizando ? (
        <Texto suave peque>
          {`No se pudo actualizar (${errorContexto.message}). Ves lo último que llegó hoy.`}
        </Texto>
      ) : null}

      <QuePasoConEsto
        citas={sinResultado}
        hoy={hoy}
        ahora={ahora}
        alReportar={reportarCita}
        alNoSeHizo={(cita, motivo) => cerrarCita(cita, 'cerrar', motivo)}
        alCancelar={(cita, motivo) => cerrarCita(cita, 'cancelar', motivo)}
        alOtraFecha={otraFecha}
      />

      {contexto ? (
        <AgendaDeHoy
          citas={contexto.agenda_hoy ?? []}
          aparte={aparte}
          ahora={ahora}
          alReportarCita={reportarCita}
          alVerAgenda={() => router.push('/agenda')}
          alAbrirVisita={id => router.push(`/visita/${id}`)}
        />
      ) : null}

      {pendientes.length > 0 ? (
        <Aviso
          tono="alerta"
          titulo={`${plural(pendientes.length, 'visita guardada', 'visitas guardadas')} sin enviar`}
          accion={<Boton titulo="Enviar ahora" variante="secundario" cargando={cola.enviando} alPresionar={() => void cola.reintentar()} />}
        >
          <View style={{ gap: 4 }}>
            <Texto peque>Se envían solas al volver la señal, hasta las 23:59 de hoy.</Texto>
            {pendientes.map(e => (
              <Texto key={e.client_id} peque>
                {horaBogota(e.cuerpo.checked_in_at)} · {e.resumen}
              </Texto>
            ))}
          </View>
        </Aviso>
      ) : null}

      {porConfirmar.length > 0 ? (
        <Aviso
          tono="alerta"
          titulo={`${plural(porConfirmar.length, 'visita de un día anterior', 'visitas de días anteriores')} por confirmar`}
          accion={<Boton titulo="Revisar ahora" variante="secundario" cargando={cola.enviando} alPresionar={() => void cola.reintentar()} />}
        >
          <View style={{ gap: 4 }}>
            <Texto peque>Pasó la medianoche sin respuesta del servidor: al volver la señal se revisa si quedaron guardadas.</Texto>
            {porConfirmar.map(e => (
              <Texto key={e.client_id} peque>
                {fechaCorta(e.fecha)} {horaBogota(e.cuerpo.checked_in_at)} · {e.resumen}
              </Texto>
            ))}
          </View>
        </Aviso>
      ) : null}

      {noEnviadas.map(e => (
        <Aviso
          key={e.client_id}
          tono="peligro"
          titulo="Visita no enviada"
          accion={
            e.fecha === hoy ? (
              <View style={{ gap: 8 }}>
                <Boton titulo="Reportar de nuevo" detalle="Vuelve como tarjeta, con lo que escribiste" variante="secundario" alPresionar={() => reportarDeNuevo(e)} />
                <Boton titulo="Descartar" variante="texto" alPresionar={() => void cola.quitar(e.client_id)} />
              </View>
            ) : (
              <Boton titulo="Entendido" variante="secundario" alPresionar={() => void cola.quitar(e.client_id)} />
            )
          }
        >
          {`${fechaCorta(e.fecha)} ${horaBogota(e.cuerpo.checked_in_at)} · ${e.resumen}. ${e.error ?? ''}`}
        </Aviso>
      ))}

      {contexto && contexto.compromisos_vencidos.length > 0 ? (
        <View style={{ gap: 8 }}>
          <Seccion titulo="Compromisos vencidos" />
          {contexto.compromisos_vencidos.map(compromiso => (
            <Bloque
              key={compromiso.visita_id}
              alPresionar={() => router.push(`/visita/${compromiso.visita_id}?fecha=${compromiso.fecha}`)}
              etiquetaAccesible={`Compromiso vencido con ${compromiso.con}`}
              estilo={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
            >
              <Icono nombre="compromiso" tamano={22} />
              <View style={{ flex: 1, gap: 2 }}>
                <Texto media>{compromiso.con}</Texto>
                <Texto suave peque>
                  Próxima reunión era el {fechaCorta(compromiso.next_step_date)} · visita del {fechaCorta(compromiso.fecha)}
                </Texto>
              </View>
              <Icono nombre="adelante" tamano={18} color={c.textoSuave} />
            </Bloque>
          ))}
        </View>
      ) : null}

      <View>
        <Seccion titulo="Actividades de hoy" estilo={{ marginBottom: 4 }} />
        {errorVisitas && sinLineas ? null : errorVisitas ? (
          <Aviso tono={esNoDisponible(errorVisitas) ? 'info' : errorVisitas.tipo === 'red' || errorVisitas.tipo === 'tiempo' ? 'alerta' : 'peligro'}>
            {esNoDisponible(errorVisitas) ? 'El reporte de visitas todavía no está activo en el servidor.' : errorVisitas.message}
          </Aviso>
        ) : !visitas ? (
          <Vacio texto="Cargando tus actividades de hoy…" />
        ) : items.length === 0 ? (
          <Vacio texto="Todavía no has reportado actividades hoy." />
        ) : (
          items.map((visita, i) => <FilaVisita key={visita.id} visita={visita} primera={i === 0} alPresionar={() => router.push(`/visita/${visita.id}`)} />)
        )}
      </View>

      <Texto suave peque>
        {textoUbicacion}
        {actualizado ? `${textoUbicacion ? ' · ' : ''}Actualizado a las ${horaBogota(actualizado)}` : ''}
      </Texto>
    </Pantalla>
  )
}

function MetaDelDia({ contexto, error }: { contexto: ContextoResponse | null; error: ApiError | null }) {
  if (error && !contexto) {
    return (
      <Aviso tono={esNoDisponible(error) ? 'info' : error.tipo === 'red' || error.tipo === 'tiempo' ? 'alerta' : 'peligro'} titulo="Meta de hoy">
        {esNoDisponible(error) ? 'El reporte de visitas todavía no está activo en el servidor. Tus días libres y tu cuota sí están disponibles.' : error.message}
      </Aviso>
    )
  }
  if (!contexto) return null
  const { meta, hechas, cuota_dia_ok } = contexto.hoy
  const perfil = contexto.config.perfil
  return (
    <View style={{ gap: 10 }}>
      <Seccion titulo="Meta de hoy" derecha={cuota_dia_ok ? <Insignia texto="Cumplida" tono="exito" /> : undefined} />
      {perfil.includes('medica') ? <Avance etiqueta="Médicas" hechas={hechas.medicas} meta={meta.medica} /> : null}
      {perfil.includes('institucional') ? <Avance etiqueta="Institucionales" hechas={hechas.institucionales} meta={meta.institucional} /> : null}
      <Grupo>
        {contexto.config.telefonica.habilitada ? (
          <Insignia texto={`Telefónicas ${hechas.telefonicas} de ${contexto.config.telefonica.tope_dia}`} tono="neutro" />
        ) : null}
        {hechas.no_efectivas > 0 ? <Insignia texto={plural(hechas.no_efectivas, 'no efectiva', 'no efectivas')} tono="alerta" /> : null}
      </Grupo>
    </View>
  )
}

/**
 * Las citas de hoy (pendientes y hechas), en filas con separador. La pendiente se toca para reportarla (Reportar la
 * abre elegida) y lleva "Atrasada" si ya pasó su hora; la hecha abre su visita. Arriba, la cita "de ahora"
 * ("Siguiente: 10:30 · …") en un bloque destacado que también lleva a reportarla. "Ver agenda" abre Mi agenda
 * ("Agendar" está junto al saludo). F1b: las que están en "¿Qué pasó con esto?" (`aparte`) no se repiten en la lista,
 * pero cuentan en "x de y hechas" (es el día).
 */
function AgendaDeHoy({
  citas,
  aparte,
  ahora,
  alReportarCita,
  alVerAgenda,
  alAbrirVisita,
}: {
  citas: readonly CitaItem[]
  aparte: ReadonlySet<string>
  ahora: Date
  alReportarCita: (cita: CitaItem) => void
  alVerAgenda: () => void
  alAbrirVisita: (visitaId: string) => void
}) {
  // Por hora (sin hora al final); el contexto con punto las trae por distancia, pero aquí se lee el día en orden.
  const ordenadas = [...citas]
    .filter(enPie)
    .sort((a, b) => (a.hora === b.hora ? conQuienCita(a).localeCompare(conQuienCita(b), 'es') : a.hora === null ? 1 : b.hora === null ? -1 : a.hora < b.hora ? -1 : 1))
  const hechas = ordenadas.filter(c => c.estado === 'hecha').length
  const deAhora = citaDeAhora(ordenadas, ahora)
  const enLista = ordenadas.filter(c => !aparte.has(c.id))
  return (
    <View style={{ gap: 10 }}>
      {/* "x de y hechas" en gris; en verde (insignia de éxito) cuando están todas, como antes. */}
      <Seccion
        titulo="Tu agenda de hoy"
        derecha={
          ordenadas.length === 0 ? undefined : hechas === ordenadas.length ? (
            <Insignia texto={`${numeroTexto(hechas)} de ${numeroTexto(ordenadas.length)} hechas`} tono="exito" />
          ) : (
            `${numeroTexto(hechas)} de ${numeroTexto(ordenadas.length)} hechas`
          )
        }
      />
      {deAhora ? <SiguienteCita cita={deAhora} titulo={textoSiguienteCita(deAhora, ahora)} alPresionar={() => alReportarCita(deAhora)} /> : null}
      {ordenadas.length === 0 ? (
        <Vacio texto="No tienes citas para hoy." />
      ) : enLista.length === 0 ? (
        <Texto suave peque>
          Las de hoy que ya pasaron están arriba, en «¿Qué pasó con esto?».
        </Texto>
      ) : (
        <View>
          {enLista.map((cita, i) => (
            <FilaCita
              key={cita.id}
              cita={cita}
              primera={i === 0}
              atrasada={citaAtrasada(cita, ahora)}
              alPresionar={cita.estado === 'pendiente' ? () => alReportarCita(cita) : cita.visita_id ? () => alAbrirVisita(cita.visita_id as string) : undefined}
            />
          ))}
        </View>
      )}
      <Boton titulo="Ver agenda" variante="secundario" alPresionar={alVerAgenda} />
    </View>
  )
}

/** La cita "de ahora": bloque #F6F6F6 con la hora y con quién, la sede, si estás dentro del radio y "Toca para reportarla". */
function SiguienteCita({ cita, titulo, alPresionar }: { cita: CitaItem; titulo: string; alPresionar: () => void }) {
  const c = useColores()
  return (
    <Bloque alPresionar={alPresionar} etiquetaAccesible={`${titulo}. Toca para reportarla`} estilo={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 }}>
      <View style={{ flex: 1, gap: 4 }}>
        <Texto negrita>{titulo}</Texto>
        <Texto suave peque>
          {cita.sede.nombre}
          {cita.distancia_m !== null ? ` · a ${sinCortes(textoDistancia(cita.distancia_m))}` : ''}
        </Texto>
        <Grupo estilo={{ marginTop: 2, alignItems: 'center' }}>
          {cita.dentro_del_radio === true ? <Insignia texto="Dentro del radio" tono="exito" /> : null}
          <Texto peque negrita>
            Toca para reportarla
          </Texto>
        </Grupo>
      </View>
      <Icono nombre="adelante" tamano={20} color={c.textoSuave} />
    </Bloque>
  )
}

function Avance({ etiqueta, hechas, meta }: { etiqueta: string; hechas: number; meta: number }) {
  const valor = avance(hechas, meta)
  return (
    <View style={{ gap: 6 }}>
      <Fila etiqueta={etiqueta} valor={`${numeroTexto(hechas)} de ${numeroTexto(meta)}`} fuerte />
      <Barra valor={fraccionBarra(valor)} tono={valor !== null && valor >= 1 ? 'exito' : 'neutro'} />
    </View>
  )
}

/** Una visita de hoy: fila con separador (con quién y la hora; tipo, sede y modalidad; su estado). */
function FilaVisita({ visita, primera, alPresionar }: { visita: VisitaItem; primera: boolean; alPresionar: () => void }) {
  return (
    <FilaLista alPresionar={alPresionar} primera={primera} etiquetaAccesible={`Visita a ${conQuien(visita)}`}>
      <View style={{ flex: 1, gap: 4 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
          <Texto media estilo={{ flexShrink: 1 }}>
            {conQuien(visita)}
          </Texto>
          <Texto suave estilo={{ fontVariant: ['tabular-nums'] }}>{horaBogota(visita.checked_in_at)}</Texto>
        </View>
        <Texto suave peque>
          {ETIQUETA_TIPO_VISITA[visita.tipo]} · {visita.sede.nombre} · {detalleModalidad(visita, textoDistancia)}
        </Texto>
        <Grupo>
          <Insignia texto={visita.efectiva ? 'Efectiva' : 'No efectiva'} tono={visita.efectiva ? 'exito' : 'alerta'} />
          {visita.out_of_territory ? <Insignia texto="Fuera de tu territorio" tono="info" /> : null}
          {visita.sede_por_confirmar ? <Insignia texto="Sede por confirmar: aún no suma" tono="alerta" /> : null}
          {visita.input_mode === 'voz' ? <Insignia texto="Por voz" /> : null}
        </Grupo>
      </View>
    </FilaLista>
  )
}

function primerNombre(nombre: string): string {
  return nombre.trim().split(/\s+/)[0] ?? nombre
}

function capitalizar(texto: string): string {
  return texto ? texto[0].toUpperCase() + texto.slice(1) : texto
}
