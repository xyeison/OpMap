/**
 * Buscador en el servidor (médicos, sedes, cuentas) que busca AL ESCRIBIR (spec 2026-10-15, paquete 2): con 3 letras
 * o más (sin contar espacios) espera ESPERA_BUSQUEDA_MS desde la última y busca solo; la tecla "Buscar" del teclado
 * busca ya (desde 2 letras). Cada búsqueda nueva cancela la anterior (AbortController) y lo que llega de una vieja no
 * se pinta. Cada resultado es una fila entera que se toca para elegirlo. Lo que se busca va por POST cuando puede
 * llevar datos de personas (médicos, cuentas); los nombres de sedes, por GET.
 *
 * Con `consulta` no tiene campo propio: busca lo que se escribe en otro lado (el filtro del Selector de médicos: un
 * solo buscador, "Buscar en OpMap" con el mismo texto).
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { ESPERA_BUSQUEDA_MS, MIN_LETRAS_BUSQUEDA_MANUAL, debeBuscarAlEscribir } from '../../lib/busqueda'
import { mensajeDeError } from '../../lib/errores'
import { Aviso, Campo, Tarjeta, Texto, useColores } from '../../lib/ui'

interface Props<T> {
  etiqueta: string
  placeholder?: string
  /** Busca en el servidor. `signal` se aborta cuando empieza otra búsqueda (lo que llegue de esta ya no se pinta). */
  buscar: (q: string, signal: AbortSignal) => Promise<T[]>
  clave: (item: T) => string
  /** Cómo se ve cada resultado (título y detalle). */
  titulo: (item: T) => string
  detalle?: (item: T) => string | null
  alElegir: (item: T) => void
  /** Texto a la derecha de cada fila ("Elegir", "Atiende aquí"). */
  textoElegir?: string
  /** Acciones al final (p. ej. "Crear consultorio aquí"). */
  pie?: ReactNode
  /** Lo que se escribe en otro campo (sin campo propio): se busca cada vez que cambia. */
  consulta?: string
  /** Texto cuando la búsqueda no trae nada. */
  sinResultados?: string
}

export function Buscador<T>({
  etiqueta,
  placeholder,
  buscar,
  clave,
  titulo,
  detalle,
  alElegir,
  textoElegir = 'Elegir',
  pie,
  consulta,
  sinResultados = 'No encontré nada con ese nombre.',
}: Props<T>) {
  const c = useColores()
  const [propio, setPropio] = useState('')
  const q = consulta ?? propio
  const [resultados, setResultados] = useState<T[] | null>(null)
  const [buscando, setBuscando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** La búsqueda en curso: la siguiente la cancela. */
  const control = useRef<AbortController | null>(null)
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null)
  const llamada = useRef(buscar)
  llamada.current = buscar

  const cancelar = () => {
    if (temporizador.current) clearTimeout(temporizador.current)
    temporizador.current = null
    control.current?.abort()
    control.current = null
  }

  const ejecutar = async (texto: string) => {
    cancelar()
    const propia = new AbortController()
    control.current = propia
    setBuscando(true)
    setError(null)
    try {
      const encontrados = await llamada.current(texto, propia.signal)
      if (propia.signal.aborted) return
      setResultados(encontrados)
    } catch (lanzado) {
      if (propia.signal.aborted) return
      setError(mensajeDeError(lanzado))
      setResultados(null)
    } finally {
      if (!propia.signal.aborted) {
        setBuscando(false)
        control.current = null
      }
    }
  }

  // Busca solo al escribir: con 3 letras o más, ESPERA_BUSQUEDA_MS después de la última.
  useEffect(() => {
    const texto = q.trim()
    if (!debeBuscarAlEscribir(texto)) {
      cancelar()
      setBuscando(false)
      setResultados(null)
      return
    }
    if (temporizador.current) clearTimeout(temporizador.current)
    temporizador.current = setTimeout(() => {
      temporizador.current = null
      void ejecutar(texto)
    }, ESPERA_BUSQUEDA_MS)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  // Al cerrarse, nada queda buscando.
  useEffect(() => () => cancelar(), [])

  const buscarYa = () => {
    const texto = q.trim()
    if (texto.length < MIN_LETRAS_BUSQUEDA_MANUAL) {
      setError(`Escribe al menos ${MIN_LETRAS_BUSQUEDA_MANUAL} letras`)
      return
    }
    void ejecutar(texto)
  }

  const corto = q.trim().length > 0 && !debeBuscarAlEscribir(q)

  return (
    <View style={{ gap: 8 }}>
      {consulta === undefined ? (
        <Campo
          etiqueta={etiqueta}
          valor={propio}
          alCambiar={texto => {
            setPropio(texto)
            setError(null)
          }}
          placeholder={placeholder}
          autoCorrect={false}
          returnKeyType="search"
          onSubmitEditing={buscarYa}
          error={error}
          ayuda={corto ? 'Sigue escribiendo: busco desde 3 letras.' : null}
        />
      ) : error ? (
        <Aviso tono="alerta">{error}</Aviso>
      ) : null}
      {buscando ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <ActivityIndicator color={c.textoSuave} />
          <Texto suave peque>
            Buscando…
          </Texto>
        </View>
      ) : null}
      {!buscando && resultados && resultados.length === 0 ? <Aviso tono="neutro">{sinResultados}</Aviso> : null}
      {(resultados ?? []).map(item => {
        const textoDetalle = detalle ? detalle(item) : null
        return (
          <Tarjeta key={clave(item)} estilo={{ padding: 12, minHeight: 56 }} alPresionar={() => alElegir(item)} etiquetaAccesible={`${titulo(item)}. ${textoElegir}`}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Texto negrita>{titulo(item)}</Texto>
                {textoDetalle ? (
                  <Texto suave peque>
                    {textoDetalle}
                  </Texto>
                ) : null}
              </View>
              <Texto peque negrita>
                {`${textoElegir} ›`}
              </Texto>
            </View>
          </Tarjeta>
        )
      })}
      {pie}
    </View>
  )
}
