/**
 * Mi agenda (F4.1, spec 2026-10-14 decisiones 1 a 4): las citas de hoy y de los próximos 7 días, agrupadas por día, con
 * la hora, con quién (médico, o cuenta y subtipo), la sede, la nota y si ya se hizo. Una cita pendiente de hoy en adelante
 * se puede cancelar (con confirmación y motivo opcional): no se borra, queda cancelada y se sigue viendo aquí con la
 * insignia "Cancelada" (por eso la lista se pide con canceladas=true). "Agendar" lleva a agenda/nueva.
 * Datos: GET /api/me/agenda?canceladas=true (sin fechas: hoy a hoy + 7) y POST /api/me/agenda/[id]/cancelar. Sin la
 * migración 0840 el servidor responde 503 y se muestra su aviso.
 */
import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
import { View } from 'react-native'
import { FilaCita } from '../../components/reporte/FilaCita'
import * as api from '../../lib/api'
import { aApiError, esNoDisponible, mensajeDeError, type ApiError } from '../../lib/errores'
import { hoyBogota } from '../../lib/fechas'
import { agruparCitasPorDia, conQuienCita, textoTotalAgenda, tituloDiaAgenda } from '../../lib/reglas'
import { MAX_MOTIVO_CANCELACION_CITA, type AgendaResponse, type CitaItem } from '../../lib/tipos'
import { Aviso, Boton, Campo, Cargando, Pantalla, Subtitulo, Texto, type Tono } from '../../lib/ui'

export default function Agenda() {
  const router = useRouter()
  const [datos, setDatos] = useState<AgendaResponse | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const [cargando, setCargando] = useState(true)
  const [refrescando, setRefrescando] = useState(false)
  const [cancelando, setCancelando] = useState<string | null>(null)
  const [motivo, setMotivo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [mensaje, setMensaje] = useState<{ tono: Tono; texto: string } | null>(null)

  const cargar = useCallback(async () => {
    try {
      // Con las canceladas: la confirmación promete que la cita "queda en tu agenda como cancelada".
      setDatos(await api.agenda(undefined, undefined, true))
      setError(null)
    } catch (e) {
      setError(aApiError(e))
    } finally {
      setCargando(false)
      setRefrescando(false)
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      setMensaje(null)
      setCancelando(null)
      void cargar()
    }, [cargar])
  )

  const refrescar = () => {
    setRefrescando(true)
    void cargar()
  }

  const cancelar = async (cita: CitaItem) => {
    setEnviando(true)
    setMensaje(null)
    try {
      await api.cancelarCita(cita.id, motivo)
      setMensaje({ tono: 'info', texto: `Cancelaste la cita con ${conQuienCita(cita)}.` })
      setCancelando(null)
      setMotivo('')
      await cargar()
    } catch (e) {
      setMensaje({ tono: 'peligro', texto: mensajeDeError(e) })
    } finally {
      setEnviando(false)
    }
  }

  if (cargando && !datos) return <Cargando texto="Cargando tu agenda…" />

  const hoy = datos?.hoy ?? hoyBogota()
  const dias = datos ? agruparCitasPorDia(datos.items, datos.desde, datos.hasta) : []

  return (
    <Pantalla alRefrescar={refrescar} refrescando={refrescando}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <View style={{ flexShrink: 1 }}>
          <Texto suave>Hoy y los próximos 7 días</Texto>
          {datos ? <Texto negrita>{textoTotalAgenda(datos.items)}</Texto> : null}
        </View>
        <Boton titulo="Agendar" alPresionar={() => router.push('/agenda/nueva')} estilo={{ minWidth: 130 }} />
      </View>

      {error ? (
        <Aviso
          tono={esNoDisponible(error) ? 'info' : error.tipo === 'red' || error.tipo === 'tiempo' ? 'alerta' : 'peligro'}
          titulo={esNoDisponible(error) ? 'La agenda aún no está disponible' : undefined}
          accion={<Boton titulo="Reintentar" variante="secundario" alPresionar={refrescar} />}
        >
          {error.message}
        </Aviso>
      ) : null}
      {mensaje ? <Aviso tono={mensaje.tono}>{mensaje.texto}</Aviso> : null}

      {dias.map(dia => (
        <View key={dia.fecha} style={{ gap: 8 }}>
          <Subtitulo>{tituloDiaAgenda(dia.fecha, hoy)}</Subtitulo>
          {dia.citas.length === 0 ? (
            <Texto suave peque>
              Sin citas
            </Texto>
          ) : (
            dia.citas.map(cita => (
              <FilaCita
                key={cita.id}
                cita={cita}
                conTipo
                conNota
                alPresionar={cita.visita_id ? () => router.push(`/visita/${cita.visita_id}?fecha=${cita.fecha}`) : undefined}
              >
                {cita.cancelable && cancelando !== cita.id ? (
                  <Boton
                    titulo="Cancelar esta cita"
                    variante="texto"
                    estilo={{ minHeight: 40, alignSelf: 'flex-end', paddingHorizontal: 8 }}
                    alPresionar={() => {
                      setCancelando(cita.id)
                      setMotivo('')
                      setMensaje(null)
                    }}
                  />
                ) : null}
                {cancelando === cita.id ? (
                  <View style={{ gap: 8 }}>
                    <Texto>{`¿Cancelas la cita con ${conQuienCita(cita)}? Queda en tu agenda como cancelada.`}</Texto>
                    <Campo
                      etiqueta="Motivo (opcional)"
                      valor={motivo}
                      alCambiar={setMotivo}
                      maxLength={MAX_MOTIVO_CANCELACION_CITA}
                      placeholder="El médico no atiende ese día, se movió la cita…"
                    />
                    <Boton titulo="Sí, cancelar la cita" variante="peligro" cargando={enviando} alPresionar={() => void cancelar(cita)} />
                    <Boton titulo="No, dejarla" variante="texto" deshabilitado={enviando} alPresionar={() => setCancelando(null)} />
                  </View>
                ) : null}
              </FilaCita>
            ))
          )}
        </View>
      ))}
    </Pantalla>
  )
}
