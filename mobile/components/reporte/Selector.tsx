/**
 * Selector de una opción para usar con una mano: cerrado muestra lo elegido en una fila grande ("Médico · Dra. Ana
 * Gómez · Cambiar"); al tocarlo se abre la lista ahí mismo (sin ventanas encima), con buscador si son muchas.
 * Elegir cierra la lista. `extra` va debajo de la lista abierta (p. ej. "Crear médico completo").
 */
import { useMemo, useState, type ReactNode } from 'react'
import { Pressable, Text, TextInput, View } from 'react-native'
import { TAMANO, useColores, useFuente } from '../../lib/ui'

export interface OpcionSelector {
  id: string
  titulo: string
  detalle?: string | null
  /** Texto pequeño a la derecha ("120 m", "Fuera de tu territorio"). */
  lateral?: string | null
}

interface Props {
  etiqueta: string
  valor: string | null
  opciones: readonly OpcionSelector[]
  alElegir: (id: string | null) => void
  /** Texto cuando no hay nada elegido ("Elige el médico"). */
  placeholder?: string
  error?: string | null
  ayuda?: string | null
  /** Si se da, aparece una opción para dejarlo vacío con este texto ("Sin contacto"). */
  textoNinguno?: string
  /** Texto si no hay opciones. */
  vacio?: string
  /** Acciones bajo la lista abierta. */
  extra?: ReactNode
  /** Abrir al montar (cuando falta elegir y es lo primero que hay que hacer). */
  abiertoInicial?: boolean
  /** Título que se muestra cerrado si la opción elegida no está en la lista (p. ej. recién creada). */
  tituloElegido?: string | null
}

/** Sin tildes y en minúsculas, para buscar. */
export function normalizarBusqueda(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

export function Selector({ etiqueta, valor, opciones, alElegir, placeholder, error, ayuda, textoNinguno, vacio, extra, abiertoInicial, tituloElegido }: Props) {
  const c = useColores()
  const fuente = useFuente()
  const [abierto, setAbierto] = useState(!!abiertoInicial)
  const [filtro, setFiltro] = useState('')
  const elegida = opciones.find(opcion => opcion.id === valor) ?? null
  const conBuscador = opciones.length > 7

  const visibles = useMemo(() => {
    const palabras = normalizarBusqueda(filtro).split(/\s+/).filter(Boolean)
    if (palabras.length === 0) return opciones
    return opciones.filter(opcion => {
      const texto = normalizarBusqueda(`${opcion.titulo} ${opcion.detalle ?? ''}`)
      return palabras.every(palabra => texto.includes(palabra))
    })
  }, [filtro, opciones])

  const elegir = (id: string | null) => {
    alElegir(id)
    setAbierto(false)
    setFiltro('')
  }

  const tituloCerrado = elegida?.titulo ?? (valor ? (tituloElegido ?? 'Elegido') : (placeholder ?? 'Elegir'))

  return (
    <View style={{ gap: 6 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${etiqueta}: ${tituloCerrado}`}
        accessibilityState={{ expanded: abierto }}
        onPress={() => setAbierto(!abierto)}
        style={({ pressed }) => ({
          minHeight: TAMANO.boton,
          borderRadius: 12,
          borderWidth: 1.5,
          borderColor: error ? c.peligro : abierto ? c.acento : c.borde,
          backgroundColor: c.superficie,
          paddingHorizontal: 14,
          paddingVertical: 8,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          opacity: pressed ? 0.75 : 1,
        })}
      >
        <View style={{ flex: 1 }}>
          <Text style={[{ color: c.textoSuave, fontSize: 13 }, fuente('media')]}>{etiqueta}</Text>
          <Text style={[{ color: valor ? c.texto : c.textoSuave, fontSize: TAMANO.texto }, fuente(valor ? 'negrita' : 'media')]} numberOfLines={2}>
            {tituloCerrado}
          </Text>
          {elegida?.detalle && !abierto ? (
            <Text style={[{ color: c.textoSuave, fontSize: 14 }, fuente('regular')]} numberOfLines={1}>
              {elegida.detalle}
            </Text>
          ) : null}
        </View>
        <Text style={[{ color: c.textoSuave, fontSize: 15 }, fuente('media')]}>{abierto ? 'Cerrar' : valor ? 'Cambiar' : 'Elegir'}</Text>
      </Pressable>

      {abierto ? (
        <View style={{ borderRadius: 12, borderWidth: 1, borderColor: c.borde, backgroundColor: c.superficie, overflow: 'hidden' }}>
          {conBuscador ? (
            <TextInput
              accessibilityLabel={`Buscar en ${etiqueta}`}
              value={filtro}
              onChangeText={setFiltro}
              placeholder="Escribe para buscar"
              placeholderTextColor={c.textoSuave}
              autoCorrect={false}
              style={[
                {
                  minHeight: 50,
                  paddingHorizontal: 14,
                  fontSize: TAMANO.texto,
                  color: c.texto,
                  borderBottomWidth: 1,
                  borderBottomColor: c.borde,
                },
                fuente('regular'),
              ]}
            />
          ) : null}
          {textoNinguno ? <FilaOpcion titulo={textoNinguno} elegida={valor === null} alPresionar={() => elegir(null)} /> : null}
          {visibles.length === 0 ? (
            <Text style={[{ color: c.textoSuave, fontSize: 16, padding: 14 }, fuente('regular')]}>{filtro ? 'Nada coincide con lo que escribiste.' : (vacio ?? 'No hay opciones.')}</Text>
          ) : (
            visibles.slice(0, 60).map(opcion => (
              <FilaOpcion
                key={opcion.id}
                titulo={opcion.titulo}
                detalle={opcion.detalle}
                lateral={opcion.lateral}
                elegida={opcion.id === valor}
                alPresionar={() => elegir(opcion.id)}
              />
            ))
          )}
          {extra ? <View style={{ padding: 12, gap: 8, borderTopWidth: 1, borderTopColor: c.borde }}>{extra}</View> : null}
        </View>
      ) : null}

      {error ? (
        <Text style={[{ color: c.peligro, fontSize: 14 }, fuente('regular')]}>{error}</Text>
      ) : ayuda ? (
        <Text style={[{ color: c.textoSuave, fontSize: 14 }, fuente('regular')]}>{ayuda}</Text>
      ) : null}
    </View>
  )
}

function FilaOpcion({ titulo, detalle, lateral, elegida, alPresionar }: { titulo: string; detalle?: string | null; lateral?: string | null; elegida: boolean; alPresionar: () => void }) {
  const c = useColores()
  const fuente = useFuente()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: elegida }}
      accessibilityLabel={titulo}
      onPress={alPresionar}
      style={({ pressed }) => ({
        minHeight: 54,
        paddingHorizontal: 14,
        paddingVertical: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        borderBottomWidth: 1,
        borderBottomColor: c.borde,
        backgroundColor: elegida ? c.superficieSuave : pressed ? c.superficieSuave : c.superficie,
      })}
    >
      <Text style={[{ width: 20, color: c.acento, fontSize: 17 }, fuente('negrita')]}>{elegida ? '✓' : ''}</Text>
      <View style={{ flex: 1 }}>
        <Text style={[{ color: c.texto, fontSize: 16 }, fuente(elegida ? 'negrita' : 'media')]}>{titulo}</Text>
        {detalle ? <Text style={[{ color: c.textoSuave, fontSize: 14 }, fuente('regular')]}>{detalle}</Text> : null}
      </View>
      {lateral ? <Text style={[{ color: c.textoSuave, fontSize: 14 }, fuente('media')]}>{lateral}</Text> : null}
    </Pressable>
  )
}
