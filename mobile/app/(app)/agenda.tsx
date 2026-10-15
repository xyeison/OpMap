/**
 * Mi agenda como calendario (F4.1; spec 2026-10-15, decisión 2 del dueño): arriba la semana (o el mes, con "Ver mes")
 * con la cantidad de citas por día y los días libres, y se puede ir a cualquier mes; debajo, el día elegido como línea
 * de tiempo por medias horas (components/agenda/LineaDelDia) con la línea "Ahora". Tocar una franja libre que aún se
 * puede agendar abre Agendar a esa hora; tocar una cita abre su detalle ahí mismo (nota, sede, "Ver la visita",
 * "Cancelar esta cita" con motivo). Una cita no se borra: cancelada se sigue viendo en "Ver canceladas (n)" (por eso se
 * pide con canceladas=true). Las viejas sin hora van al final del día. Toda cita de hoy a hoy + 30 se ve y se puede
 * cancelar: se pide por MES (rangoDeMes, como mucho 31 días), se guarda por mes y se vuelve a pedir al recibir el foco.
 * Datos: GET /api/me/agenda?desde=&hasta=&canceladas=true, GET /api/me/dias-libres?desde=&hasta= y
 * POST /api/me/agenda/[id]/cancelar. Sin la migración 0840 el servidor responde 503 y se muestra su aviso.
 */
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { View } from 'react-native'
import { CalendarioMes } from '../../components/agenda/CalendarioMes'
import { DetalleCita } from '../../components/agenda/DetalleCita'
import { LineaDelDia } from '../../components/agenda/LineaDelDia'
import { bloqueaAgendar, fechaBoton, marcasDelMes, puedeAgendarProxima, rutaAgendar, tomarCitaResaltada } from '../../lib/agenda'
import * as api from '../../lib/api'
import { lunesDe, mesDe, mesesDeRango, rangoDeMes } from '../../lib/calendario'
import { invalidarContexto } from '../../lib/contexto-memoria'
import { aApiError, esNoDisponible, mensajeDeError, type ApiError } from '../../lib/errores'
import { esFechaIso, hoyBogota, sumarDias } from '../../lib/fechas'
import { vibrarExito } from '../../lib/haptica'
import { conQuienCita, textoTotalAgenda, tituloDiaAgenda } from '../../lib/reglas'
import type { CitaItem, DiaLibreItem } from '../../lib/tipos'
import { Aviso, Boton, Cargando, Pantalla, Subtitulo, Tarjeta, Texto, type Tono } from '../../lib/ui'

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
  const { fecha: fechaParam } = useLocalSearchParams<{ fecha?: string }>()
  const hoy = hoyBogota()
  const [dia, setDia] = useState(() => (esFechaIso(fechaParam) ? fechaParam : hoy))
  const [vista, setVista] = useState<'semana' | 'mes'>('semana')
  const [meses, setMeses] = useState<Record<string, DatosMes>>({})
  const [cargando, setCargando] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<ApiError | null>(null)
  const [refrescando, setRefrescando] = useState(false)
  const [abierta, setAbierta] = useState<string | null>(null)
  const [resaltada, setResaltada] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState<{ tono: Tono; texto: string } | null>(null)
  const [ahora, setAhora] = useState(() => new Date())
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
        // Los días libres solo marcan el calendario: si fallan, la agenda se ve igual.
        api.diasLibres(rango.desde, rango.hasta).catch(() => null),
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
      setError(null)
    } catch (e) {
      setError(aApiError(e))
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
  const agendable = puedeAgendarProxima(dia, hoy) && !libreQueBloquea
  const citaResaltada = resaltada ? todas.flatMap(m => m.citas).find(cita => cita.id === resaltada) : undefined
  const citaAbierta = abierta ? citasDelDia.find(cita => cita.id === abierta) : undefined

  const elegirDia = (fecha: string) => {
    setDia(fecha)
    setAbierta(null)
  }

  const cancelar = async (cita: CitaItem, motivo: string): Promise<string | null> => {
    try {
      const { cita: cancelada } = await api.cancelarCita(cita.id, motivo)
      invalidarContexto('cita')
      vibrarExito()
      const mes = mesDe(cita.fecha)
      setMeses(prev => (prev[mes] ? { ...prev, [mes]: { ...prev[mes], citas: prev[mes].citas.map(x => (x.id === cancelada.id ? cancelada : x)) } } : prev))
      setAbierta(null)
      setResaltada(null)
      setMensaje({ tono: 'info', texto: `Cancelaste la cita con ${conQuienCita(cita)}. Queda en "Ver canceladas".` })
      void cargarMes(mes)
      return null
    } catch (e) {
      return mensajeDeError(e)
    }
  }

  return (
    <Pantalla alRefrescar={refrescar} refrescando={refrescando}>
      {citaResaltada ? (
        <Aviso tono="exito" titulo="Cita agendada">
          {`${fechaBoton(citaResaltada.fecha)} · ${citaResaltada.hora ?? 'Sin hora'} · ${conQuienCita(citaResaltada)}`}
        </Aviso>
      ) : null}
      {mensaje ? <Aviso tono={mensaje.tono}>{mensaje.texto}</Aviso> : null}
      {error ? (
        <Aviso
          tono={esNoDisponible(error) ? 'info' : error.tipo === 'red' || error.tipo === 'tiempo' ? 'alerta' : 'peligro'}
          titulo={esNoDisponible(error) ? 'La agenda aún no está disponible' : undefined}
          accion={<Boton titulo="Reintentar" variante="secundario" alPresionar={refrescar} />}
        >
          {error.message}
        </Aviso>
      ) : null}

      <Tarjeta estilo={{ gap: 6, paddingHorizontal: 8 }}>
        <CalendarioMes
          valor={dia}
          alCambiar={elegirDia}
          hoy={hoy}
          marcas={marcas}
          vista={vista}
          alCambiarMes={mes => void cargarMes(mes, true)}
        />
        <Boton
          titulo={vista === 'semana' ? 'Ver mes' : 'Ver semana'}
          variante="texto"
          estilo={{ minHeight: 44, alignSelf: 'center', paddingVertical: 4 }}
          alPresionar={() => setVista(vista === 'semana' ? 'mes' : 'semana')}
        />
      </Tarjeta>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Boton
          titulo="Agendar"
          estilo={{ flex: 1 }}
          alPresionar={() => router.push(rutaAgendar({ fecha: agendable ? dia : undefined }))}
        />
        <Boton titulo="Días libres" variante="secundario" estilo={{ flex: 1 }} alPresionar={() => router.push('/dias-libres')} />
      </View>

      <View style={{ gap: 2 }}>
        <Subtitulo>{tituloDiaAgenda(dia, hoy)}</Subtitulo>
        {datosDelMes ? <Texto suave>{textoTotalAgenda(citasDelDia)}</Texto> : null}
        {libreQueBloquea ? (
          <Texto suave peque>
            Día libre: no se agenda este día.
          </Texto>
        ) : dia >= hoy && !agendable ? (
          <Texto suave peque>
            Solo se agenda de hoy a 30 días adelante.
          </Texto>
        ) : null}
      </View>

      {!datosDelMes ? (
        error && !cargando[mesDe(dia)] ? null : <Cargando texto="Cargando tu agenda…" />
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
                alVerVisita={citaAbierta.visita_id ? () => router.push(`/visita/${citaAbierta.visita_id}?fecha=${citaAbierta.fecha}`) : undefined}
                preguntaCancelar={`¿Cancelas la cita con ${conQuienCita(citaAbierta)}? Queda en tu agenda como cancelada.`}
                alCancelar={motivo => cancelar(citaAbierta, motivo)}
                alCerrar={() => setAbierta(null)}
              />
            ) : null
          }
        />
      )}
    </Pantalla>
  )
}
