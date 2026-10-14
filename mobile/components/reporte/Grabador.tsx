/**
 * Grabación del dictado con expo-audio: empieza sola al montarse (la persona ya tocó "Hablar"), muestra el tiempo
 * y el nivel del micrófono, para sola a los 3 minutos, y tiene "Listo, enviar" y "Cancelar". Al cancelar (o si la
 * pantalla se cierra grabando) el archivo se borra en el acto; al terminar entrega el archivo a Reportar, que lo
 * sube y lo borra en cuanto llega la respuesta. El audio nunca se guarda.
 */
import { requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio'
import { useCallback, useEffect, useRef, useState } from 'react'
import { View } from 'react-native'
import { OPCIONES_GRABACION, borrarAudio } from '../../lib/audio'
import { AVISO_FIN_GRABACION_MS, MAX_GRABACION_MS, MIN_GRABACION_MS, debeParar, formatoDuracion, nivelDesdeMetering } from '../../lib/grabacion'
import { Aviso, Barra, Boton, Tarjeta, Texto, Titulo } from '../../lib/ui'

interface Props {
  /** Grabación lista: Reportar la sube y la borra. */
  alTerminar: (uri: string, duracionMs: number) => void
  /** Se canceló (el archivo ya se borró). */
  alCancelar: () => void
  /** No se pudo grabar (sin permiso, micrófono ocupado…). */
  alError: (mensaje: string) => void
}

export const MENSAJE_SIN_PERMISO_MICROFONO =
  'La app no tiene permiso para usar el micrófono. Actívalo en los ajustes del teléfono, o reporta por toques.'

type Estado = 'preparando' | 'grabando' | 'parando'

export function Grabador({ alTerminar, alCancelar, alError }: Props) {
  const grabadora = useAudioRecorder(OPCIONES_GRABACION)
  const estadoGrabadora = useAudioRecorderState(grabadora, 200)
  const [estado, setEstado] = useState<Estado>('preparando')
  const terminado = useRef(false)
  const llamadas = useRef({ alTerminar, alCancelar, alError })
  llamadas.current = { alTerminar, alCancelar, alError }

  // Empezar a grabar al montarse.
  useEffect(() => {
    let cancelado = false
    ;(async () => {
      try {
        const permiso = await requestRecordingPermissionsAsync()
        if (!permiso.granted) {
          terminado.current = true
          llamadas.current.alError(MENSAJE_SIN_PERMISO_MICROFONO)
          return
        }
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true })
        await grabadora.prepareToRecordAsync()
        if (cancelado) return
        grabadora.record()
        setEstado('grabando')
      } catch {
        terminado.current = true
        llamadas.current.alError('No se pudo empezar a grabar. Revisa que ninguna otra app use el micrófono, o reporta por toques.')
      }
    })()
    return () => {
      cancelado = true
      // Se cerró la pantalla grabando: se para y se borra (nada queda en el teléfono).
      if (!terminado.current) {
        terminado.current = true
        void parar().then(uri => borrarAudio(uri))
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const parar = useCallback(async (): Promise<string | null> => {
    try {
      if (grabadora.isRecording || grabadora.getStatus().isRecording) await grabadora.stop()
    } catch {
      // ya estaba parada
    }
    try {
      await setAudioModeAsync({ allowsRecording: false })
    } catch {
      // sin cambio de modo: no afecta
    }
    try {
      return grabadora.uri ?? grabadora.getStatus().url ?? null
    } catch {
      return null
    }
  }, [grabadora])

  const terminar = useCallback(async () => {
    if (terminado.current) return
    terminado.current = true
    setEstado('parando')
    const duracion = estadoGrabadora.durationMillis
    const uri = await parar()
    if (!uri) {
      llamadas.current.alError('La grabación no quedó lista. Vuelve a intentarlo o reporta por toques.')
      return
    }
    if (duracion < MIN_GRABACION_MS) {
      borrarAudio(uri)
      llamadas.current.alError('La grabación quedó vacía: mantén la app abierta y habla al menos unos segundos.')
      return
    }
    llamadas.current.alTerminar(uri, Math.min(duracion, MAX_GRABACION_MS))
  }, [estadoGrabadora.durationMillis, parar])

  const cancelar = useCallback(async () => {
    if (terminado.current) return
    terminado.current = true
    setEstado('parando')
    const uri = await parar()
    borrarAudio(uri)
    llamadas.current.alCancelar()
  }, [parar])

  // A los 3 minutos para sola y envía.
  const duracion = estadoGrabadora.durationMillis
  useEffect(() => {
    if (estado === 'grabando' && debeParar(duracion)) void terminar()
  }, [duracion, estado, terminar])

  const nivel = nivelDesdeMetering(estadoGrabadora.metering)
  const porAcabar = duracion >= AVISO_FIN_GRABACION_MS

  return (
    <Tarjeta estilo={{ gap: 14, alignItems: 'stretch' }}>
      <View style={{ alignItems: 'center', gap: 4 }}>
        <Texto suave>{estado === 'preparando' ? 'Preparando el micrófono…' : estado === 'parando' ? 'Cerrando la grabación…' : 'Grabando: cuenta qué pasó'}</Texto>
        <Titulo estilo={{ fontSize: 44, lineHeight: 52, fontVariant: ['tabular-nums'] }}>{formatoDuracion(duracion)}</Titulo>
        <Texto suave peque>
          de {formatoDuracion(MAX_GRABACION_MS)} como máximo
        </Texto>
      </View>
      <View style={{ gap: 6 }}>
        <Texto peque suave>
          Nivel del micrófono
        </Texto>
        <Barra valor={estado === 'grabando' ? Math.max(0.03, nivel) : 0} tono={nivel > 0.85 ? 'alerta' : 'exito'} />
      </View>
      {porAcabar ? <Aviso tono="alerta">Quedan {formatoDuracion(MAX_GRABACION_MS - duracion)}: a los 3 minutos se envía sola.</Aviso> : null}
      <Texto peque suave>
        Di con quién estuviste, en qué sede, qué se habló, qué quedó pendiente y cuándo vuelves. No digas documentos ni
        datos de pacientes.
      </Texto>
      <Boton titulo="Listo, enviar" detalle="Se transcribe y el audio se borra" grande alPresionar={() => void terminar()} deshabilitado={estado !== 'grabando'} />
      <Boton titulo="Cancelar" variante="secundario" alPresionar={() => void cancelar()} deshabilitado={estado === 'parando'} />
    </Tarjeta>
  )
}
