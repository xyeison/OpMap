/**
 * Raíz de la app: letra DM Sans (marca VG Medical), sesión (lib/sesion.ts) y cola sin señal (lib/cola-contexto.tsx)
 * para todas las pantallas. Sin token → (auth)/login; con token → (app) con sus pestañas (la redirección la hacen
 * app/index.tsx y los _layout de cada grupo).
 *
 * DM Sans viene en el paquete (sin red). Mientras carga se muestra la portada negra con el logotipo, igual que la
 * pantalla de inicio; si falla o tarda más de ESPERA_FUENTES_MS, la app sigue con la fuente del sistema (nunca se
 * queda en blanco). Si cargó tarde, las pantallas pasan a DM Sans solas (<ProveedorFuentes> avisa del cambio).
 *
 * El tema (Claro, Oscuro o Automático) es el que eligió la persona en Ajustes, el mismo de OpMap en el navegador
 * (<ProveedorTema>, lib/tema-preferencia.tsx). En el teléfono se lee al abrir: la portada sigue mientras tanto, con el
 * mismo tope que la letra, para no mostrar un instante el otro tema.
 */
import { DMSans_400Regular } from '@expo-google-fonts/dm-sans/400Regular'
import { DMSans_500Medium } from '@expo-google-fonts/dm-sans/500Medium'
import { DMSans_700Bold } from '@expo-google-fonts/dm-sans/700Bold'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useFonts } from 'expo-font'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useEffect, useState } from 'react'
import { View } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { Logo } from '../components/Logo'
import { ProveedorCola } from '../lib/cola-contexto'
import { pedirAlmacenamientoPersistente } from '../lib/pwa'
import { ProveedorSesion } from '../lib/sesion'
import { BarraDeEstado, ProveedorTema, useTemaApp } from '../lib/tema-preferencia'
import { COLORES_CLAROS, FAMILIAS_DM_SANS, ProveedorFuentes, useColores } from '../lib/ui'

/**
 * Las claves son los nombres de familia que usa lib/ui.tsx (FAMILIAS_DM_SANS). Los íconos de la barra (Ionicons,
 * lib/iconos.tsx) cargan con la letra, para que las pestañas no aparezcan un momento sin ícono.
 */
const FUENTES = {
  [FAMILIAS_DM_SANS.regular]: DMSans_400Regular,
  [FAMILIAS_DM_SANS.media]: DMSans_500Medium,
  [FAMILIAS_DM_SANS.negrita]: DMSans_700Bold,
  ...Ionicons.font,
}

/** Tope de espera de la letra antes de seguir con la del sistema. */
const ESPERA_FUENTES_MS = 2500

export default function RaizLayout() {
  return (
    <ProveedorTema>
      <Raiz />
    </ProveedorTema>
  )
}

function Raiz() {
  const c = useColores()
  const { listo: temaListo } = useTemaApp()
  const [cargadas, error] = useFonts(FUENTES)
  const [agotado, setAgotado] = useState(false)

  useEffect(() => {
    if ((cargadas || error) && temaListo) return
    const espera = setTimeout(() => setAgotado(true), ESPERA_FUENTES_MS)
    return () => clearTimeout(espera)
  }, [cargadas, error, temaListo])

  // App sin señal (2026-10-30): en el navegador, pedir que lo guardado (IndexedDB) no se borre por falta de espacio.
  useEffect(() => {
    void pedirAlmacenamientoPersistente()
  }, [])

  const esperandoLetra = !cargadas && !error && !agotado
  const esperando = esperandoLetra || (!temaListo && !agotado)

  // La sesión empieza a leerse ya (en paralelo con la letra); las pantallas montan cuando la letra está o se rindió.
  return (
    <SafeAreaProvider>
      <ProveedorSesion>
        {esperando ? (
          <View style={{ flex: 1, backgroundColor: COLORES_CLAROS.encabezado, alignItems: 'center', justifyContent: 'center' }}>
            <StatusBar style="light" />
            <Logo variante="claro" ancho={200} />
          </View>
        ) : (
          <ProveedorFuentes listas={cargadas && !error}>
            <ProveedorCola>
              <BarraDeEstado />
              <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.fondo } }} />
            </ProveedorCola>
          </ProveedorFuentes>
        )}
      </ProveedorSesion>
    </SafeAreaProvider>
  )
}
