/**
 * Mi agenda como calendario (F4.1; spec 2026-10-15, decisión 2 del dueño): arriba la semana (o el mes, con "Ver mes")
 * con la cantidad de citas por día y los días libres, y se puede ir a cualquier mes; debajo, el día elegido como línea
 * de tiempo por medias horas (components/agenda/LineaDelDia) con la línea "Ahora". Tocar una franja libre que aún se
 * puede agendar abre Agendar a esa hora; tocar una cita abre su detalle ahí mismo (components/agenda/DetalleCita). Una
 * cita no se borra: la cancelada y la que no se hizo se siguen viendo en "Ver las que no se hicieron (n)" (por eso se
 * pide con canceladas=true). Las viejas sin hora van al final del día. Se pide por MES (rangoDeMes, como mucho 31 días),
 * se guarda por mes y se vuelve a pedir al recibir el foco. Datos: GET /api/me/agenda?desde=&hasta=&canceladas=true,
 * GET /api/me/dias-libres?desde=&hasta= y POST /api/me/agenda/[id]/{cancelar, cerrar, eliminar}. Sin la migración el
 * servidor responde 503 y se muestra su aviso.
 *
 * F1b (actividades de campo, A7): el detalle tiene el ciclo de vida —Reportar, "No se hizo" (con motivo), Cancelar (con
 * motivo obligatorio), "Agendar otra fecha" (cerrada y sin otra fecha) y "Eliminar: lo agendé por error"—, nada de
 * "Mover". Al cerrar o cancelar, el detalle sigue abierto con su estado y "Agendar otra fecha". Sin tope hacia adelante
 * (A4). Días libres solo con Ejecutivo Comercial (una líder no ve la entrada ni se piden). La hecha consulta su visita
 * (GET /api/me/visitas?fecha=) al abrirse: solo la no efectiva admite otra fecha. Con un servidor sin F1a
 * (/api/auth/me sin la clave `persona`: conCicloDeVida) el detalle no ofrece "No se hizo", Eliminar ni "Agendar otra
 * fecha" (esas rutas no existen ahí) y cancelar manda solo `{ motivo }` (lo escrito o la etiqueta del motivo).
 *
 * Revisión 2026-10-15: el error es POR MES (el de un mes que falla no lo borra otro que llega bien: si no, quedaba
 * "Cargando tu agenda…" sin "Reintentar"); "Cancelaste la cita…" sale junto al día (no arriba, fuera de la vista);
 * "Hoy" en el calendario vuelve a hoy; y si un día libre tiene citas pendientes, se dice.
 */
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { View } from 'react-native'
import { CalendarioMes } from '../../components/agenda/CalendarioMes'
import { DetalleCita } from '../../components/agenda/DetalleCita'
import { LineaDelDia } from '../../components/agenda/LineaDelDia'
import { bloqueaAgendar, fechaBoton, fijarPedidoAgendar, marcasDelMes, pedidoOtraFecha, puedeAgendarProxima, rutaAgendar, tomarCitaResaltada } from '../../lib/agenda'
import { mensajeTrasCerrar } from '../../lib/agenda-ciclo'
import * as api from '../../lib/api'
import { lunesDe, mesDe, mesesDeRango, rangoDeMes } from '../../lib/calendario'
import { aApiError, esNoDisponible, mensajeDeError, type ApiError } from '../../lib/errores'
import { esFechaIso, hoyBogota, sumarDias } from '../../lib/fechas'
import { vibrarExito } from '../../lib/haptica'
import { conCicloDeVida, eligeComo, muestraDiasLibres } from '../../lib/persona'
import { conQuienCita, textoTotalAgenda, tituloDiaAgenda } from '../../lib/reglas'
import { fijarCitaParaReportar } from '../../lib/retorno'
import { useSesion } from '../../lib/sesion'
import type { CitaItem, DiaLibreItem } from '../../lib/tipos'
import { Aviso, Boton, Cargando, Pantalla, Subtitulo, Texto, useColores, type Tono } from '../../lib/ui'

interface DatosMes {
  citas: CitaItem[]
  libres: DiaLibreItem[]
  requiereAprobacion: boolean
}

/** Los meses que hay que tener para ver ese día: el suyo y, en la vista de semana, el otro que toque su semana. */
function mesesNecesarios(dia: string, vista: 'semana' | 'mes'): string[] {
  if (vista === 'mes') return [mesDe(dia)]
  const lunes = lunesDe(dia)
  return mesesDeRango(lunes, sumarDias(lunes, 6))
}

export default function Agenda() {
  const router = useRouter()
  const c = useColores()
  const { perfil } = useSesion()
  /** ¿El servidor tiene el ciclo de vida de la cita (F1a)? Sin saberlo, sí (decide el servidor). */
  const ciclo = conCicloDeVida(perfil?.servidor)
  /** Días libres solo con Ejecutivo Comercial (hasta F3): sin él, ni la entrada ni la consulta (respondería 403). */
  const conDiasLibres = muestraDiasLibres({ persona: perfil?.persona, ejecutiva: perfil?.ejecutiva })
  const conDiasLibresRef = useRef(conDiasLibres)
  conDiasLibresRef.current = conDiasLibres
  const { fecha: fechaParam } = useLocalSearchParams<{ fecha?: string }>()
  const hoy = hoyBogota()
  const [dia, setDia] = useState(() => (esFechaIso(fechaParam) ? fechaParam : hoy))
  const [vista, setVista] = useState<'semana' | 'mes'>('semana')
  const [meses, setMeses] = useState<Record<string, DatosMes>>({})
  const [cargando, setCargando] = useState<Record<string, boolean>>({})
  /** El error de cada mes (AAAA-MM): uno que llega bien no borra el de otro. */
  const [errores, setErrores] = useState<Record<string, ApiError>>({})
  const [refrescando, setRefrescando] = useState(false)
  const [abierta, setAbierta] = useState<string | null>(null)
  const [resaltada, setResaltada] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState<{ tono: Tono; texto: string } | null>(null)
  const [ahora, setAhora] = useState(() => new Date())
  /** Si la visita de una cita hecha fue efectiva (por visita_id; null: no se supo). Solo la no efectiva admite otra fecha. */
  const [efectivas, setEfectivas] = useState<Record<string, boolean | null>>({})
  const diaActual = useRef(dia)
  diaActual.current = dia
  const vistaActual = useRef(vista)
  vistaActual.current = vista

  // Los meses que se están pidiendo y los ya traídos (refs: dos efectos del mismo montaje no piden dos veces).
  const enCurso = useRef(new Set<string>())
  const traidos = useRef(new Set<string>())

  /** Pide las citas (con las canceladas) y los días libres de un mes. `siFalta`: solo si aún no se trajo. */
  const cargarMes = useCallback(async (mes: string, siFalta = false) => {
    if (enCurso.current.has(mes) || (siFalta && traidos.current.has(mes))) return
    enCurso.current.add(mes)
    const rango = rangoDeMes(mes)
    setCargando(prev => ({ ...prev, [mes]: true }))
    try {
      // Con las canceladas: se ven en "Ver canceladas" y la confirmación promete que la cita queda en la agenda.
      const [agenda, libres] = await Promise.all([
        api.agenda(rango.desde, rango.hasta, true),
        // Los días libres solo marcan el calendario: si fallan, la agenda se ve igual. Sin Ejecutivo Comercial no se piden.
        conDiasLibresRef.current ? api.diasLibres(rango.desde, rango.hasta).catch(() => null) : Promise.resolve(null),
      ])
      traidos.current.add(mes)
      setMeses(prev => ({
        ...prev,
        [mes]: {
          citas: agenda.items,
          libres: libres?.items ?? prev[mes]?.libres ?? [],
          requiereAprobacion: libres?.requiere_aprobacion ?? prev[mes]?.requiereAprobacion ?? true,
        },
      }))
      setErrores(prev => {
        if (!(mes in prev)) return prev
        const { [mes]: _resuelto, ...resto } = prev
        return resto
      })
    } catch (e) {
      setErrores(prev => ({ ...prev, [mes]: aApiError(e) }))
    } finally {
      enCurso.current.delete(mes)
      setCargando(prev => ({ ...prev, [mes]: false }))
    }
  }, [])

  const recargar = useCallback(
    () => Promise.all(mesesNecesarios(diaActual.current, vistaActual.current).map(mes => cargarMes(mes))),
    [cargarMes]
  )

  // Al recibir el foco: lo de este momento (citas agendadas o hechas en otra pantalla) y la cita recién agendada.
  useFocusEffect(
    useCallback(() => {
      setAhora(new Date())
      setMensaje(null)
      const nueva = tomarCitaResaltada()
      if (nueva) {
        setResaltada(nueva.id)
        setAbierta(nueva.id)
        setDia(nueva.fecha)
        diaActual.current = nueva.fecha
      } else {
        setResaltada(null)
      }
      void recargar()
      const reloj = setInterval(() => setAhora(new Date()), 60_000)
      return () => clearInterval(reloj)
    }, [recargar])
  )

  // Un enlace a /agenda?fecha=… lleva a ese día.
  useEffect(() => {
    if (esFechaIso(fechaParam)) setDia(fechaParam)
  }, [fechaParam])

  // Otro día u otra vista: pide los meses que falten (los ya traídos no se vuelven a pedir aquí).
  useEffect(() => {
    for (const mes of mesesNecesarios(dia, vista)) void cargarMes(mes, true)
  }, [dia, vista, cargarMes])

  const refrescar = () => {
    setRefrescando(true)
    void recargar().finally(() => setRefrescando(false))
  }

  const todas = useMemo(() => Object.values(meses), [meses])
  const marcas = useMemo(
    () => marcasDelMes(todas.flatMap(m => m.citas), todas.flatMap(m => m.libres)),
    [todas]
  )
  const datosDelMes = meses[mesDe(dia)]
  const citasDelDia = useMemo(() => (datosDelMes?.citas ?? []).filter(cita => cita.fecha === dia), [datosDelMes, dia])
  const libreQueBloquea = (datosDelMes?.libres ?? []).find(l => l.fecha === dia && bloqueaAgendar(l, datosDelMes?.requiereAprobacion ?? true))
  // De hoy en adelante, sin tope (A4).
  const agendable = puedeAgendarProxima(dia, hoy) && !libreQueBloquea
  const citaResaltada = resaltada ? todas.flatMap(m => m.citas).find(cita => cita.id === resaltada) : undefined
  const citaAbierta = abierta ? citasDelDia.find(cita => cita.id === abierta) : undefined
  // El error que importa es el de los meses que se ven (el del día elegido primero).
  const error = [mesDe(dia), ...mesesNecesarios(dia, vista)].map(mes => errores[mes]).find(Boolean) ?? null
  const errorDelDia = errores[mesDe(dia)] ?? null
  /** Día libre (aprobado o registrado) con citas pendientes: hay que cancelarlas o moverlas. */
  const libreDelDia = (datosDelMes?.libres ?? []).find(l => l.fecha === dia && (l.estado === 'aprobado' || l.estado === 'registrado'))
  const pendientesEnLibre = libreDelDia ? citasDelDia.filter(cita => cita.estado === 'pendiente').length : 0

  // La hecha: ¿su visita fue efectiva? (se pregunta una vez al abrirla, solo si podría pedir otra fecha).
  useEffect(() => {
    const visitaId = ciclo && citaAbierta?.estado === 'hecha' && !citaAbierta.sucesora_id ? citaAbierta.visita_id : null
    if (!citaAbierta || !visitaId || visitaId in efectivas) return
    let vigente = true
    api.visitas(citaAbierta.fecha).then(
      respuesta => {
        if (vigente) setEfectivas(prev => ({ ...prev, [visitaId]: respuesta.items.find(v => v.id === visitaId)?.efectiva ?? null }))
      },
      () => {
        if (vigente) setEfectivas(prev => ({ ...prev, [visitaId]: null }))
      }
    )
    return () => {
      vigente = false
    }
  }, [citaAbierta, efectivas, ciclo])

  const elegirDia = (fecha: string) => {
    setDia(fecha)
    setAbierta(null)
  }

  /** Pone la cita que devolvió el servidor en su mes (o la quita, si se eliminó) y vuelve a pedir ese mes. */
  const ponerCita = (anterior: CitaItem, nueva: CitaItem | null) => {
    const mes = mesDe(anterior.fecha)
    setMeses(prev =>
      prev[mes]
        ? { ...prev, [mes]: { ...prev[mes], citas: nueva ? prev[mes].citas.map(x => (x.id === nueva.id ? nueva : x)) : prev[mes].citas.filter(x => x.id !== anterior.id) } }
        : prev
    )
    setResaltada(null)
    void cargarMes(mes)
  }

  // Cancelar, "No se hizo" y eliminar (lib/api.ts invalida el contexto de Hoy después del 2xx). Al cerrar o cancelar, el
  // detalle sigue abierto con su estado nuevo (y "Agendar otra fecha").
  const cancelar = async (cita: CitaItem, motivo: api.MotivoDeCierre): Promise<string | null> => {
    try {
      const { cita: cancelada } = await api.cancelarCita(cita.id, motivo, ciclo)
      vibrarExito()
      ponerCita(cita, cancelada)
      setMensaje({ tono: 'info', texto: mensajeTrasCerrar('cancelar', cita) })
      return null
    } catch (e) {
      return mensajeDeError(e)
    }
  }

  const noSeHizo = async (cita: CitaItem, motivo: api.MotivoDeCierre): Promise<string | null> => {
    try {
      const { cita: cerrada } = await api.cerrarCita(cita.id, motivo)
      vibrarExito()
      ponerCita(cita, cerrada)
      setMensaje({ tono: 'info', texto: mensajeTrasCerrar('no_se_hizo', cita) })
      return null
    } catch (e) {
      return mensajeDeError(e)
    }
  }

  const eliminar = async (cita: CitaItem): Promise<string | null> => {
    try {
      await api.eliminarCita(cita.id)
      vibrarExito()
      setAbierta(null)
      ponerCita(cita, null)
      setMensaje({ tono: 'info', texto: mensajeTrasCerrar('eliminar', cita) })
      return null
    } catch (e) {
      return mensajeDeError(e)
    }
  }

  const reportar = (cita: CitaItem) => {
    fijarCitaParaReportar(cita.id)
    router.push('/reportar')
  }

  const otraFecha = (cita: CitaItem) => {
    fijarPedidoAgendar(pedidoOtraFecha(cita))
    router.push(rutaAgendar({}))
  }

  return (
    <Pantalla alRefrescar={refrescar} refrescando={refrescando}>
      {citaResaltada ? (
        <Aviso tono="exito" titulo="Cita agendada">
          {`${fechaBoton(citaResaltada.fecha)} · ${citaResaltada.hora ?? 'Sin hora'} · ${conQuienCita(citaResaltada)}`}
        </Aviso>
      ) : null}
      {error ? (
        <Aviso
          tono={esNoDisponible(error) ? 'info' : error.tipo === 'red' || error.tipo === 'tiempo' ? 'alerta' : 'peligro'}
          titulo={esNoDisponible(error) ? 'La agenda aún no está disponible' : undefined}
          accion={<Boton titulo="Reintentar" variante="secundario" alPresionar={refrescar} />}
        >
          {error.message}
        </Aviso>
      ) : null}

      {/* Estilo Uber: las dos acciones arriba, junto al título; el calendario sin caja. */}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Boton
          titulo="Agendar"
          compacto
          icono="agregar"
          estilo={{ flex: 1 }}
          alPresionar={() => router.push(rutaAgendar({ fecha: agendable ? dia : undefined }))}
        />
        {conDiasLibres ? (
          <Boton titulo="Días libres" variante="secundario" compacto icono="calendario" estilo={{ flex: 1 }} alPresionar={() => router.push('/dias-libres')} />
        ) : null}
      </View>

      <View style={{ gap: 6 }}>
        <CalendarioMes
          valor={dia}
          alCambiar={elegirDia}
          hoy={hoy}
          marcas={marcas}
          vista={vista}
          alCambiarMes={mes => void cargarMes(mes, true)}
          conHoy
        />
        <Boton
          titulo={vista === 'semana' ? 'Ver mes' : 'Ver semana'}
          variante="texto"
          estilo={{ minHeight: 44, alignSelf: 'center', paddingVertical: 4 }}
          alPresionar={() => setVista(vista === 'semana' ? 'mes' : 'semana')}
        />
      </View>


      <View style={{ gap: 2, borderTopWidth: 1, borderTopColor: c.borde, paddingTop: 14 }}>
        <Subtitulo estilo={{ fontSize: 17, lineHeight: 22, letterSpacing: 0 }}>{tituloDiaAgenda(dia, hoy)}</Subtitulo>
        {datosDelMes ? <Texto suave peque>{textoTotalAgenda(citasDelDia)}</Texto> : null}
        {libreQueBloquea ? (
          <Texto suave peque>
            Día libre: no se agenda este día.
          </Texto>
        ) : null}
      </View>

      {pendientesEnLibre > 0 ? (
        <Aviso tono="alerta">
          {`Ese día lo tienes libre y ${pendientesEnLibre === 1 ? 'tienes 1 cita pendiente' : `tienes ${pendientesEnLibre} citas pendientes`}: cancélala${pendientesEnLibre === 1 ? '' : 's'} o agéndala${pendientesEnLibre === 1 ? '' : 's'} otro día.`}
        </Aviso>
      ) : null}
      {/* Junto al día (no arriba): quien canceló estaba mirando la línea del día. */}
      {mensaje ? <Aviso tono={mensaje.tono}>{mensaje.texto}</Aviso> : null}

      {!datosDelMes ? (
        errorDelDia && !cargando[mesDe(dia)] ? null : <Cargando texto="Cargando tu agenda…" />
      ) : (
        <LineaDelDia
          fecha={dia}
          citas={citasDelDia}
          agendable={agendable}
          ahora={ahora}
          alTocarFranja={hora => router.push(rutaAgendar({ fecha: dia, hora }))}
          alTocarCita={cita => setAbierta(abierta === cita.id ? null : cita.id)}
          abierta={abierta}
          resaltada={resaltada}
          detalle={
            citaAbierta ? (
              <DetalleCita
                cita={citaAbierta}
                hoy={hoy}
                ahora={ahora}
                alReportar={() => reportar(citaAbierta)}
                alVerVisita={citaAbierta.visita_id ? () => router.push(`/visita/${citaAbierta.visita_id}?fecha=${citaAbierta.fecha}`) : undefined}
                alNoSeHizo={ciclo ? motivo => noSeHizo(citaAbierta, motivo) : undefined}
                preguntaCancelar={`¿Cancelas la cita con ${conQuienCita(citaAbierta)}? Queda en tu agenda como cancelada.`}
                alCancelar={motivo => cancelar(citaAbierta, motivo)}
                alEliminar={ciclo ? () => eliminar(citaAbierta) : undefined}
                alOtraFecha={ciclo ? () => otraFecha(citaAbierta) : undefined}
                visitaEfectiva={citaAbierta.visita_id ? (efectivas[citaAbierta.visita_id] ?? null) : null}
                conComo={eligeComo(perfil?.persona)}
                alOcultar={() => setAbierta(null)}
              />
            ) : null
          }
        />
      )}
    </Pantalla>
  )
}
