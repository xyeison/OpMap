/**
 * Raíz de la app: letra DM Sans (marca VG Medical), sesión (lib/sesion.ts) y cola sin señal (lib/cola-contexto.tsx)
 * para todas las pantallas. Sin token → (auth)/login; con token → (app) con sus pestañas (la redirección la hacen
 * app/index.tsx y los _layout de cada grupo).
 *
 * DM Sans viene en el paquete (sin red). Mientras carga se muestra la portada negra con el logotipo, igual que la
 * pantalla de inicio; si falla o tarda más de ESPERA_FUENTES_MS, la app sigue con la fuente del sistema (nunca se
 * queda en blanco). Si cargó tarde, las pantallas pasan a DM Sans solas (<ProveedorFuentes> avisa del cambio).
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
  const c = useColores()
  const [cargadas, error] = useFonts(FUENTES)
  const [agotado, setAgotado] = useState(false)

  useEffect(() => {
    if (cargadas || error) return
    const espera = setTimeout(() => setAgotado(true), ESPERA_FUENTES_MS)
    return () => clearTimeout(espera)
  }, [cargadas, error])

  // App sin señal (2026-10-30): en el navegador, pedir que lo guardado (IndexedDB) no se borre por falta de espacio.
  useEffect(() => {
    void pedirAlmacenamientoPersistente()
  }, [])

  const esperandoLetra = !cargadas && !error && !agotado

  // La sesión empieza a leerse ya (en paralelo con la letra); las pantallas montan cuando la letra está o se rindió.
  return (
    <SafeAreaProvider>
      <ProveedorSesion>
        {esperandoLetra ? (
          <View style={{ flex: 1, backgroundColor: COLORES_CLAROS.encabezado, alignItems: 'center', justifyContent: 'center' }}>
            <StatusBar style="light" />
            <Logo variante="claro" ancho={200} />
          </View>
        ) : (
          <ProveedorFuentes listas={cargadas && !error}>
            <ProveedorCola>
              <StatusBar style="auto" />
              <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.fondo } }} />
            </ProveedorCola>
          </ProveedorFuentes>
        )}
      </ProveedorSesion>
    </SafeAreaProvider>
  )
}
