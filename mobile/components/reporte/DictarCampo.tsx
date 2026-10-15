/**
 * Dictar un campo (F4.1, decisión 9 de la spec 2026-10-14): el micrófono debajo de "Conclusión" en el reporte por
 * toques y en la tarjeta de la visita (botón de 44 pt con ícono, spec 2026-10-15). Graba con el mismo Grabador del
 * dictado (lib/audio y lib/grabacion: tope de 3 minutos; el audio se borra al llegar la transcripción o al cancelar),
 * transcribe con POST /api/me/voz/transcribir y reparte lo dicho con POST /api/me/voz/campos. Quien lo usa AÑADE lo repartido (unirCamposDictados): nunca borra lo escrito.
 *
 * Si la IA no reparte (502, sin señal, demasiados dictados), lo transcrito no se pierde: queda en la conclusión para
 * revisarlo. Sin la llave (503) o sin la ruta (404): "El dictado no está disponible; escribe la conclusión".
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ActivityIndicator, Pressable, Text, View } from 'react-native'
import * as api from '../../lib/api'
import { borrarAudio } from '../../lib/audio'
import { aApiError } from '../../lib/errores'
import { segundosDe } from '../../lib/grabacion'
import { Icono } from '../../lib/iconos'
import { MENSAJE_DICTADO_NO_DISPONIBLE, mensajeErrorDictado } from '../../lib/propuesta'
import type { CamposDictadoResponse, TipoVisita } from '../../lib/tipos'
import { ALTO_TOQUE_MIN, Aviso, Texto, useColores, useFuente } from '../../lib/ui'
import { Grabador } from './Grabador'

type Estado = 'listo' | 'grabando' | 'transcribiendo' | 'repartiendo'

interface Props {
  /** Tipo de la visita (el servidor lo usa para repartir); sin tipo no se dicta. */
  tipo: TipoVisita | null
  /** La voz está configurada en el servidor y hay señal (contexto.voz). */
  disponible: boolean
  /** Lo repartido por la IA: quien lo usa lo añade y devuelve el texto que se muestra ("Agregué lo que dijiste en…"). */
  alDictar: (campos: CamposDictadoResponse) => string
  /** El campo Conclusión: el botón "Dictar" va debajo, a la derecha. */
  children: ReactNode
}

/**
 * "Dictar" (spec 2026-10-15): un botón de 44 pt o más con el ícono del micrófono, en su propia fila debajo del campo
 * (antes iba superpuesto a la etiqueta y medía 34).
 */
function BotonDictar({ alPresionar, cargando, deshabilitado }: { alPresionar: () => void; cargando?: boolean; deshabilitado?: boolean }) {
  const c = useColores()
  const fuente = useFuente()
  const inactivo = deshabilitado || cargando
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dictar la conclusión"
        accessibilityState={{ disabled: !!inactivo, busy: !!cargando }}
        disabled={inactivo}
        onPress={alPresionar}
        style={({ pressed }) => ({
          minHeight: ALTO_TOQUE_MIN,
          minWidth: 120,
          paddingHorizontal: 16,
          paddingVertical: 8,
          borderRadius: 999,
          borderWidth: 1.5,
          borderColor: c.bordeControl,
          backgroundColor: c.superficie,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          opacity: inactivo ? 0.5 : pressed ? 0.75 : 1,
        })}
      >
        {cargando ? <ActivityIndicator color={c.texto} /> : <Icono nombre="microfono" tamano={20} />}
        <Text style={[{ color: c.texto, fontSize: 16 }, fuente('negrita')]}>Dictar</Text>
      </Pressable>
    </View>
  )
}

export function DictarCampo({ tipo, disponible, alDictar, children }: Props) {
  const [estado, setEstado] = useState<Estado>('listo')
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const montado = useRef(true)
  const llamada = useRef(alDictar)
  llamada.current = alDictar

  useEffect(() => {
    montado.current = true
    return () => {
      montado.current = false
    }
  }, [])

  if (!disponible || !tipo) {
    return (
      <View style={{ gap: 6 }}>
        {children}
        <BotonDictar deshabilitado alPresionar={() => undefined} />
        <Texto peque suave>
          {MENSAJE_DICTADO_NO_DISPONIBLE}
        </Texto>
      </View>
    )
  }

  const empezar = () => {
    setError(null)
    setAviso(null)
    setEstado('grabando')
  }

  const alTerminar = async (uri: string, duracionMs: number) => {
    setEstado('transcribiendo')
    let texto = ''
    try {
      texto = (await api.transcribir(uri, segundosDe(duracionMs))).transcript
    } catch (lanzado) {
      if (!montado.current) return
      const e = aApiError(lanzado)
      setError(mensajeErrorDictado(e.status, e.message))
      setEstado('listo')
      return
    } finally {
      borrarAudio(uri)
    }
    if (!montado.current) return
    if (!texto.trim()) {
      setError('No se entendió nada en la grabación. Vuelve a intentarlo o escribe la conclusión.')
      setEstado('listo')
      return
    }
    setEstado('repartiendo')
    try {
      const campos = await api.vozCampos(texto, tipo)
      if (!montado.current) return
      setAviso(llamada.current(campos))
    } catch (lanzado) {
      if (!montado.current) return
      const e = aApiError(lanzado)
      const mensaje = mensajeErrorDictado(e.status, e.message)
      if (mensaje === MENSAJE_DICTADO_NO_DISPONIBLE) {
        setError(mensaje)
      } else {
        // Lo transcrito no se pierde: va a la conclusión (se añade) para que la persona lo reparta a mano.
        llamada.current({ conclusion: texto.trim(), compromisos: null, next_step_date: null })
        setError(`${mensaje} Dejé lo que dijiste en la conclusión: revísalo y pasa los compromisos a su campo.`)
      }
    } finally {
      if (montado.current) setEstado('listo')
    }
  }

  const ocupado = estado === 'transcribiendo' || estado === 'repartiendo'
  return (
    <View style={{ gap: 8 }}>
      {estado === 'grabando' ? (
        <Grabador
          textoGrabando="Grabando: di qué pasó y qué quedó pendiente"
          indicacion="Lo que digas se agrega a la conclusión; los compromisos y la fecha de la próxima reunión van a su campo. No digas documentos ni datos de pacientes."
          detalleListo="Se escribe en los campos y el audio se borra"
          alTerminar={(uri, ms) => void alTerminar(uri, ms)}
          alCancelar={() => setEstado('listo')}
          alError={mensaje => {
            setError(mensaje.replace('o reporta por toques', 'o escribe la conclusión'))
            setEstado('listo')
          }}
        />
      ) : null}
      {children}
      {estado !== 'grabando' ? <BotonDictar cargando={ocupado} alPresionar={empezar} /> : null}
      {ocupado ? (
        <Texto peque suave>
          {estado === 'transcribiendo' ? 'Transcribiendo… (el audio se borra al terminar)' : 'Escribiendo en conclusión y compromisos…'}
        </Texto>
      ) : null}
      {error ? <Aviso tono="alerta">{error}</Aviso> : null}
      {aviso && !error ? <Aviso tono="exito">{aviso}</Aviso> : null}
    </View>
  )
}
