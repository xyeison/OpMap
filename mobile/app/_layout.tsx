/**
 * Raíz de la app: sesión (lib/sesion.ts) y cola sin señal (lib/cola-contexto.tsx) para todas las pantallas.
 * Sin token → (auth)/login; con token → (app) con sus pestañas (la redirección la hacen app/index.tsx y los
 * _layout de cada grupo).
 */
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { ProveedorCola } from '../lib/cola-contexto'
import { ProveedorSesion } from '../lib/sesion'
import { useColores } from '../lib/ui'

export default function RaizLayout() {
  const c = useColores()
  return (
    <SafeAreaProvider>
      <ProveedorSesion>
        <ProveedorCola>
          <StatusBar style="auto" />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.fondo } }} />
        </ProveedorCola>
      </ProveedorSesion>
    </SafeAreaProvider>
  )
}
