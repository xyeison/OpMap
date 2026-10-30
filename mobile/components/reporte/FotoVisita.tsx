/**
 * La foto opcional de la visita (app sin señal, dueño 2026-10-30): "Tomar foto" o "Elegir de la galería", se comprime
 * en el teléfono (1600 px, JPEG 70 %; lib/foto.ts) y queda en la tarjeta hasta confirmar; entonces va a la cola de
 * fotos y sube después de la visita. Vista previa pequeña, el tamaño que quedó y "Quitar". Nunca se sube el original.
 */
import { useState } from 'react'
import { Image, View } from 'react-native'
import { comprimirFoto, elegirFoto, textoBytes, type OrigenFoto } from '../../lib/foto'
import { mensajeDeError } from '../../lib/errores'
import type { FotoBorrador } from '../../lib/propuesta'
import { Boton, Grupo, Texto, useColores } from '../../lib/ui'

interface Props {
  foto: FotoBorrador | null | undefined
  alCambiar: (foto: FotoBorrador | null) => void
}

export function FotoVisita({ foto, alCambiar }: Props) {
  const c = useColores()
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const tomar = async (origen: OrigenFoto) => {
    if (ocupado) return
    setOcupado(true)
    setError(null)
    try {
      const elegida = await elegirFoto(origen)
      if (!elegida) return
      alCambiar(await comprimirFoto(elegida))
    } catch (lanzado) {
      setError(mensajeDeError(lanzado))
    } finally {
      setOcupado(false)
    }
  }

  return (
    <View style={{ gap: 8 }}>
      <Texto negrita>Foto (opcional)</Texto>
      {foto ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Image source={{ uri: foto.uri }} accessibilityLabel="Foto de la visita" style={{ width: 72, height: 72, borderRadius: 10, backgroundColor: c.relleno }} resizeMode="cover" />
          <View style={{ flex: 1, gap: 4 }}>
            <Texto peque suave>{`${foto.ancho} × ${foto.alto} · ${textoBytes(foto.bytes)} (comprimida en el teléfono)`}</Texto>
            <Grupo>
              <Boton titulo="Cambiar" variante="texto" compacto alPresionar={() => void tomar('camara')} />
              <Boton titulo="Quitar" variante="texto" compacto alPresionar={() => alCambiar(null)} />
            </Grupo>
          </View>
        </View>
      ) : (
        <Grupo>
          <Boton titulo="Tomar foto" variante="secundario" compacto cargando={ocupado} alPresionar={() => void tomar('camara')} />
          <Boton titulo="Elegir de la galería" variante="texto" compacto deshabilitado={ocupado} alPresionar={() => void tomar('galeria')} />
        </Grupo>
      )}
      {error ? (
        <Texto peque color={c.peligro}>
          {error}
        </Texto>
      ) : null}
      <Texto peque suave>
        Se guarda reducida (1600 px, JPEG) y sube después de la visita, con sus propios reintentos.
      </Texto>
    </View>
  )
}
