/**
 * La franja siempre visible de la app sin señal (dueño, 2026-10-30): "En línea" o "Sin conexión", el contador "X visitas
 * pendientes por subir" (más las fotos) y "Subir ahora". Va arriba de todas las pestañas (app/(app)/_layout.tsx). Si el
 * navegador tiene una versión nueva esperando (lib/pwa.ts), ofrece "Actualizar": solo recarga cuando no hay una subida
 * en curso, y los pendientes no se tocan (viven en IndexedDB). Con la sesión vencida sin señal, lo dice.
 *
 * 2026-10-31 (dueño): a la izquierda, el botón "OpMap" vuelve al inicio de módulos de OpMap (lib/opmap-enlace.ts): misma
 * pestaña en el navegador, otra pestaña si la app está instalada, y sin señal solo avisa. En el teléfono compilado no sale.
 *
 * Capa 1 de empresas: al lado del botón "OpMap", el nombre corto de la empresa activa (solo si hay empresa; se cambia en
 * Ajustes). Con "Subir ahora" o "Actualizar" al lado, solo el ícono: el nombre tampoco sale (360 px).
 */
import { useEffect, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useCola } from '../lib/cola-contexto'
import { Icono } from '../lib/iconos'
import { MENSAJE_OPMAP_SIN_SENAL, destinoOpMap } from '../lib/opmap-enlace'
import { detalleFranja, textoEstadoConexion } from '../lib/estado-cola'
import { alHaberVersionNueva, aplicarVersionNueva, correInstalada, esNavegador } from '../lib/pwa'
import { useSesion } from '../lib/sesion'
import { ALTO_TOQUE_MIN, useColores, useFuente } from '../lib/ui'

export function EstadoCola() {
  const c = useColores()
  const fuente = useFuente()
  const insets = useSafeAreaInsets()
  const { resumen, resumenFotos, enviando, enLinea, subirAhora } = useCola()
  const { vencida, perfil } = useSesion()
  const empresaCorta = perfil?.usuario.empresa?.nombre_corto ?? null
  const [versionNueva, setVersionNueva] = useState(false)
  useEffect(() => alHaberVersionNueva(setVersionNueva), [])
  const [avisoOpMap, setAvisoOpMap] = useState<string | null>(null)
  useEffect(() => {
    if (!avisoOpMap) return
    const t = setTimeout(() => setAvisoOpMap(null), 4000)
    return () => clearTimeout(t)
  }, [avisoOpMap])
  const destino = destinoOpMap({ navegador: esNavegador(), instalada: correInstalada(), enLinea })
  const irAOpMap = () => {
    if (destino.modo === 'sin_senal') {
      setAvisoOpMap(MENSAJE_OPMAP_SIN_SENAL)
      return
    }
    if (destino.modo !== 'ir') return
    const w = globalThis as unknown as { open?: (url: string, destino: string) => unknown; location?: { assign: (url: string) => void } }
    // Instalada: otra pestaña; si el navegador la bloquea (window.open devuelve null), en esta misma (revisor 2026-10-31).
    const abierta = destino.nuevaPestana && w.open ? w.open(destino.url, '_blank') : null
    if (!abierta) w.location?.assign(destino.url)
  }

  const pendientes = resumen.pendientes
  const fotos = resumenFotos.pendientes
  const hayPendientes = pendientes + fotos > 0
  const fondo = !enLinea ? c.fondoAlerta : hayPendientes ? c.fondoInfo : c.relleno
  const texto = !enLinea ? c.alerta : hayPendientes ? c.info : c.textoSuave
  const estado = textoEstadoConexion(enLinea)
  const detalle = detalleFranja({ enLinea, vencida, visitas: pendientes, fotos })
  const soloIcono = hayPendientes || (versionNueva && esNavegador())

  return (
    <View style={{ backgroundColor: fondo, paddingTop: insets.top > 0 ? insets.top : 6, paddingBottom: 6, paddingHorizontal: 14, gap: 4 }}>
    <View accessibilityRole="summary" accessibilityLabel={`${estado}. ${detalle}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: ALTO_TOQUE_MIN }}>
      {destino.modo !== 'oculto' ? (
        // Con "Subir ahora" o "Actualizar" al lado, solo el ícono: en 360 px no caben los tres con texto (revisor 2026-10-31).
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="OpMap: volver al inicio de módulos"
          accessibilityHint={destino.modo === 'sin_senal' ? MENSAJE_OPMAP_SIN_SENAL : undefined}
          onPress={irAOpMap}
          style={({ pressed }) => ({ minHeight: 32, minWidth: 32, paddingLeft: 8, paddingRight: soloIcono ? 8 : 10, borderRadius: 16, borderWidth: 1, borderColor: c.bordeFuerte, backgroundColor: c.superficie, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, opacity: pressed ? 0.6 : destino.modo === 'sin_senal' ? 0.55 : 1 })}
        >
          <Icono nombre="inicio" activo tamano={16} color={c.texto} />
          {soloIcono ? null : <Text style={[{ color: c.texto, fontSize: 13 }, fuente('negrita')]}>OpMap</Text>}
        </Pressable>
      ) : null}
      {empresaCorta && !soloIcono ? (
        <Text accessibilityLabel={`Empresa activa: ${empresaCorta}`} numberOfLines={1} maxFontSizeMultiplier={1.3} style={[{ color: texto, fontSize: 13, maxWidth: 110 }, fuente('negrita')]}>
          {empresaCorta}
        </Text>
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
    {avisoOpMap ? (
      <Text accessibilityLiveRegion="polite" maxFontSizeMultiplier={1.3} style={[{ color: texto, fontSize: 13, lineHeight: 17 }, fuente('regular')]}>
        {avisoOpMap}
      </Text>
    ) : null}
    </View>
  )
}
