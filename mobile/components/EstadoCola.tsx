/**
 * La franja siempre visible de la app sin señal (dueño, 2026-10-30): "En línea" o "Sin conexión", el contador "X visitas
 * pendientes por subir" (más las fotos) y "Subir ahora". Va arriba de todas las pestañas (app/(app)/_layout.tsx). Si el
 * navegador tiene una versión nueva esperando (lib/pwa.ts), ofrece "Actualizar": solo recarga cuando no hay una subida
 * en curso, y los pendientes no se tocan (viven en IndexedDB). Con la sesión vencida sin señal, lo dice.
 */
import { useEffect, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useCola } from '../lib/cola-contexto'
import { detalleFranja, textoEstadoConexion } from '../lib/estado-cola'
import { alHaberVersionNueva, aplicarVersionNueva, esNavegador } from '../lib/pwa'
import { useSesion } from '../lib/sesion'
import { ALTO_TOQUE_MIN, useColores, useFuente } from '../lib/ui'

export function EstadoCola() {
  const c = useColores()
  const fuente = useFuente()
  const insets = useSafeAreaInsets()
  const { resumen, resumenFotos, enviando, enLinea, subirAhora } = useCola()
  const { vencida } = useSesion()
  const [versionNueva, setVersionNueva] = useState(false)
  useEffect(() => alHaberVersionNueva(setVersionNueva), [])

  const pendientes = resumen.pendientes
  const fotos = resumenFotos.pendientes
  const hayPendientes = pendientes + fotos > 0
  const fondo = !enLinea ? c.fondoAlerta : hayPendientes ? c.fondoInfo : c.relleno
  const texto = !enLinea ? c.alerta : hayPendientes ? c.info : c.textoSuave
  const estado = textoEstadoConexion(enLinea)
  const detalle = detalleFranja({ enLinea, vencida, visitas: pendientes, fotos })

  return (
    <View
      accessibilityRole="summary"
      accessibilityLabel={`${estado}. ${detalle}`}
      style={{ backgroundColor: fondo, paddingTop: insets.top > 0 ? insets.top : 6, paddingBottom: 6, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: ALTO_TOQUE_MIN }}
    >
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: texto }} />
      <View style={{ flex: 1 }}>
        <Text maxFontSizeMultiplier={1.3} style={[{ color: texto, fontSize: 13, lineHeight: 17 }, fuente('negrita')]}>
          {estado}
          <Text style={fuente('regular')}>{` · ${detalle}`}</Text>
        </Text>
      </View>
      {hayPendientes ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Subir ahora"
          disabled={enviando}
          onPress={() => void subirAhora()}
          style={({ pressed }) => ({ minHeight: 32, paddingHorizontal: 12, borderRadius: 16, backgroundColor: c.acento, justifyContent: 'center', opacity: pressed || enviando ? 0.6 : 1 })}
        >
          <Text style={[{ color: c.sobreAcento, fontSize: 13 }, fuente('negrita')]}>{enviando ? 'Subiendo…' : 'Subir ahora'}</Text>
        </Pressable>
      ) : null}
      {versionNueva && esNavegador() ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Hay una versión nueva: actualizar"
          disabled={enviando}
          onPress={() => void aplicarVersionNueva()}
          style={({ pressed }) => ({ minHeight: 32, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1, borderColor: texto, justifyContent: 'center', opacity: pressed || enviando ? 0.6 : 1 })}
        >
          <Text style={[{ color: texto, fontSize: 13 }, fuente('negrita')]}>Actualizar</Text>
        </Pressable>
      ) : null}
    </View>
  )
}
