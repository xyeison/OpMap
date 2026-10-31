/**
 * La franja siempre visible de la app sin señal (dueño, 2026-10-30): "En línea" o "Sin conexión", el contador "X visitas
 * pendientes por subir" (más las fotos) y "Subir ahora". Va arriba de todas las pestañas (app/(app)/_layout.tsx). Si el
 * navegador tiene una versión nueva esperando (lib/pwa.ts), ofrece "Actualizar": solo recarga cuando no hay una subida
 * en curso, y los pendientes no se tocan (viven en IndexedDB). Con la sesión vencida sin señal, lo dice. Abierta en una
 * pestaña del navegador (desde "Agendamiento" de OpMap) y con señal, empieza con "OpMap" para volver a la web con su menú
 * (dueño, 2026-10-31); en el teléfono no va, en la app instalada va en Ajustes y sin señal en ninguna parte
 * (lib/navegacion.ts, dondeIrAOpMap). Desde Reportar y los formularios pregunta antes de salir: lo escrito ahí vive en
 * memoria y se perdería (preguntaAntesDeIrAOpMap).
 */
import { useSegments } from 'expo-router'
import { useEffect, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useCola } from '../lib/cola-contexto'
import { detalleFranja, textoEstadoConexion } from '../lib/estado-cola'
import { Icono } from '../lib/iconos'
import { dondeIrAOpMap, preguntaAntesDeIrAOpMap, rutaDeSegmentos } from '../lib/navegacion'
import { alHaberVersionNueva, aplicarVersionNueva, correInstalada, esNavegador, irAOpMap } from '../lib/pwa'
import { useSesion } from '../lib/sesion'
import { ALTO_TOQUE_MIN, confirmar, useColores, useFuente } from '../lib/ui'

export function EstadoCola() {
  const c = useColores()
  const fuente = useFuente()
  const insets = useSafeAreaInsets()
  const { resumen, resumenFotos, enviando, enLinea, subirAhora } = useCola()
  const { vencida } = useSesion()
  const segmentos = useSegments()
  const [versionNueva, setVersionNueva] = useState(false)
  useEffect(() => alHaberVersionNueva(setVersionNueva), [])

  // Lo escrito en Reportar o en un formulario vive en memoria hasta guardarlo y salir lo pierde: ahí pregunta antes
  // (revisión 2026-10-31). Lo pendiente por subir no se pierde (IndexedDB).
  async function volverAOpMap() {
    if (preguntaAntesDeIrAOpMap(rutaDeSegmentos(segmentos)) && !(await confirmar('¿Volver a OpMap?', 'Lo que no hayas guardado en esta pantalla se pierde.', 'Volver a OpMap'))) return
    irAOpMap()
  }

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
      {dondeIrAOpMap(correInstalada(), enLinea) === 'franja' ? (
        // Solo sale en la web, donde react-native-web no aplica hitSlop: el toque mide ALTO_TOQUE_MIN por sí mismo (la
        // píldora de adentro, 32) y el margen negativo ocupa el relleno de la franja (6 y 6), que así no crece.
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Volver a OpMap"
          onPress={() => void volverAOpMap()}
          style={({ pressed }) => ({ minHeight: ALTO_TOQUE_MIN, marginVertical: -6, justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}
        >
          <View style={{ minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 2, paddingLeft: 6, paddingRight: 12, borderRadius: 16, borderWidth: 1, borderColor: texto }}>
            <Icono nombre="atras" activo tamano={16} color={texto} />
            <Text style={[{ color: texto, fontSize: 13 }, fuente('negrita')]}>OpMap</Text>
          </View>
        </Pressable>
      ) : null}
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
