/**
 * Selector de una opción para usar con una mano: cerrado muestra lo elegido en una fila grande ("Médico · Dra. Ana
 * Gómez · Cambiar"); al tocarlo se abre la lista ahí mismo (sin ventanas encima), con buscador si son muchas.
 * Elegir cierra la lista. `extra` va debajo de la lista abierta (p. ej. "Crear médico completo").
 *
 * Spec 2026-10-15 (paquete 2):
 *   - Las opciones pueden venir en grupos (`grupo`: "Atienden en Clínica Norte", "Cerca de aquí"…); el título de cada
 *     grupo se pinta solo si hay más de uno.
 *   - Con `buscarFuera` es UN solo buscador: el filtro busca entre las opciones y, si ninguna coincide, ofrece
 *     "Buscar en OpMap" con el mismo texto; los resultados de afuera siguen lo que se escribe en el mismo filtro.
 */
import { useMemo, useState, type ReactNode } from 'react'
import { Pressable, Text, TextInput, View } from 'react-native'
import { filtrarOpciones, normalizarBusqueda, ofertaBuscarFuera } from '../../lib/busqueda'
import { ALTO_TOQUE_MIN, Boton, TAMANO, useColores, useFuente } from '../../lib/ui'

export { normalizarBusqueda }

export interface OpcionSelector {
  id: string
  titulo: string
  detalle?: string | null
  /** Texto pequeño a la derecha ("120 m", "Fuera de tu territorio"). */
  lateral?: string | null
  /** Grupo de la opción (las opciones ya vienen ordenadas por grupo). */
  grupo?: string | null
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
  /**
   * Buscar también fuera de la lista con el MISMO texto del filtro (un solo buscador): `donde` ("OpMap") y lo que se
   * pinta con lo escrito (un Buscador con `consulta`). `cerrar` cierra el selector (al elegir un resultado).
   */
  buscarFuera?: { donde: string; resultados: (consulta: string, cerrar: () => void) => ReactNode }
}

export function Selector({ etiqueta, valor, opciones, alElegir, placeholder, error, ayuda, textoNinguno, vacio, extra, abiertoInicial, tituloElegido, buscarFuera }: Props) {
  const c = useColores()
  const fuente = useFuente()
  const [abierto, setAbierto] = useState(!!abiertoInicial)
  const [filtro, setFiltro] = useState('')
  /** Se tocó "Buscar en OpMap": los resultados de afuera siguen al filtro. */
  const [fuera, setFuera] = useState(false)
  const elegida = opciones.find(opcion => opcion.id === valor) ?? null
  const conBuscador = opciones.length > 7 || !!buscarFuera

  const visibles = useMemo(() => filtrarOpciones(opciones, filtro), [filtro, opciones])
  const conGrupos = new Set(opciones.map(o => o.grupo ?? '')).size > 1
  const oferta = buscarFuera && !fuera ? ofertaBuscarFuera(filtro, visibles.length, buscarFuera.donde) : null

  const cerrar = () => {
    setAbierto(false)
    setFiltro('')
    setFuera(false)
  }

  const elegir = (id: string | null) => {
    alElegir(id)
    cerrar()
  }

  const cambiarFiltro = (texto: string) => {
    setFiltro(texto)
    if (!texto.trim()) setFuera(false)
  }

  const tituloCerrado = elegida?.titulo ?? (valor ? (tituloElegido ?? 'Elegido') : (placeholder ?? 'Elegir'))

  const filas: ReactNode[] = []
  let grupoAnterior: string | null | undefined = undefined
  for (const opcion of visibles.slice(0, 60)) {
    const grupo = opcion.grupo ?? null
    if (conGrupos && grupo !== grupoAnterior && grupo) {
      filas.push(
        <Text
          key={`grupo-${grupo}`}
          accessibilityRole="header"
          style={[{ color: c.textoSuave, fontSize: 13, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 4, backgroundColor: c.superficie }, fuente('negrita')]}
        >
          {grupo}
        </Text>
      )
    }
    grupoAnterior = grupo
    filas.push(
      <FilaOpcion key={opcion.id} titulo={opcion.titulo} detalle={opcion.detalle} lateral={opcion.lateral} elegida={opcion.id === valor} alPresionar={() => elegir(opcion.id)} />
    )
  }

  return (
    <View style={{ gap: 6 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${etiqueta}: ${tituloCerrado}`}
        accessibilityState={{ expanded: abierto }}
        onPress={() => (abierto ? cerrar() : setAbierto(true))}
        style={({ pressed }) => ({
          minHeight: TAMANO.boton,
          borderRadius: TAMANO.radio,
          borderWidth: abierto ? 2 : 1,
          borderColor: error ? c.peligro : abierto ? c.acento : c.bordeControl,
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
          <Text style={[{ color: valor ? c.texto : c.textoSuave, fontSize: TAMANO.texto, lineHeight: 22 }, fuente(valor ? 'negrita' : 'media')]} numberOfLines={2}>
            {tituloCerrado}
          </Text>
          {elegida?.detalle && !abierto ? (
            <Text style={[{ color: c.textoSuave, fontSize: 14 }, fuente('regular')]} numberOfLines={1}>
              {elegida.detalle}
            </Text>
          ) : null}
        </View>
        <Text style={[{ color: c.texto, fontSize: 14 }, fuente('negrita')]}>{abierto ? 'Cerrar' : valor ? 'Cambiar' : 'Elegir'}</Text>
      </Pressable>

      {abierto ? (
        <View style={{ borderRadius: TAMANO.radioTarjeta, borderWidth: 1, borderColor: c.bordeFuerte, backgroundColor: c.superficie, overflow: 'hidden' }}>
          {conBuscador ? (
            <TextInput
              accessibilityLabel={buscarFuera ? `Buscar ${etiqueta.toLowerCase()} por su nombre` : `Buscar en ${etiqueta}`}
              value={filtro}
              onChangeText={cambiarFiltro}
              placeholder={buscarFuera ? 'Escribe el nombre para buscarlo' : 'Escribe para buscar'}
              placeholderTextColor={c.textoSuave}
              autoCorrect={false}
              returnKeyType="search"
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
            <Text style={[{ color: c.textoSuave, fontSize: 16, padding: 14 }, fuente('regular')]}>
              {filtro ? (buscarFuera ? 'Nadie de tu lista se llama así.' : 'Nada coincide con lo que escribiste.') : (vacio ?? 'No hay opciones.')}
            </Text>
          ) : (
            filas
          )}
          {oferta ? (
            <View style={{ padding: 12, borderTopWidth: 1, borderTopColor: c.borde }}>
              <Boton titulo={oferta.texto} variante={oferta.destacada ? 'secundario' : 'texto'} alPresionar={() => setFuera(true)} estilo={{ minHeight: ALTO_TOQUE_MIN }} />
            </View>
          ) : null}
          {fuera && buscarFuera ? <View style={{ padding: 12, gap: 8, borderTopWidth: 1, borderTopColor: c.borde }}>{buscarFuera.resultados(filtro, cerrar)}</View> : null}
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
