/**
 * Buscador en el servidor (médicos, sedes, cuentas): campo, botón "Buscar" y resultados para elegir. Lo que se
 * busca va por POST cuando puede llevar datos de personas (médicos, cuentas); los nombres de sedes, por GET.
 */
import { useState, type ReactNode } from 'react'
import { View } from 'react-native'
import { mensajeDeError } from '../../lib/errores'
import { Aviso, Boton, Campo, Tarjeta, Texto } from '../../lib/ui'

interface Props<T> {
  etiqueta: string
  placeholder?: string
  buscar: (q: string) => Promise<T[]>
  clave: (item: T) => string
  /** Cómo se ve cada resultado (título y detalle). */
  titulo: (item: T) => string
  detalle?: (item: T) => string | null
  alElegir: (item: T) => void
  textoElegir?: string
  /** Acciones al final (p. ej. "Crear consultorio aquí"). */
  pie?: ReactNode
}

export function Buscador<T>({ etiqueta, placeholder, buscar, clave, titulo, detalle, alElegir, textoElegir = 'Elegir', pie }: Props<T>) {
  const [q, setQ] = useState('')
  const [resultados, setResultados] = useState<T[] | null>(null)
  const [buscando, setBuscando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const ejecutar = async () => {
    const texto = q.trim()
    if (texto.length < 2) {
      setError('Escribe al menos 2 letras')
      return
    }
    setBuscando(true)
    setError(null)
    try {
      setResultados(await buscar(texto))
    } catch (lanzado) {
      setError(mensajeDeError(lanzado))
      setResultados(null)
    } finally {
      setBuscando(false)
    }
  }

  return (
    <View style={{ gap: 8 }}>
      <Campo
        etiqueta={etiqueta}
        valor={q}
        alCambiar={setQ}
        placeholder={placeholder}
        autoCorrect={false}
        returnKeyType="search"
        onSubmitEditing={() => void ejecutar()}
        error={error}
      />
      <Boton titulo="Buscar" variante="secundario" cargando={buscando} alPresionar={() => void ejecutar()} />
      {resultados && resultados.length === 0 ? <Aviso tono="neutro">No encontré nada con ese nombre.</Aviso> : null}
      {(resultados ?? []).map(item => (
        <Tarjeta key={clave(item)} estilo={{ padding: 12 }}>
          <Texto negrita>{titulo(item)}</Texto>
          {detalle && detalle(item) ? (
            <Texto suave peque>
              {detalle(item)}
            </Texto>
          ) : null}
          <Boton titulo={textoElegir} variante="secundario" alPresionar={() => alElegir(item)} />
        </Tarjeta>
      ))}
      {pie}
    </View>
  )
}
