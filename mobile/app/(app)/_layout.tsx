/**
 * Grupo con sesión: pestañas Hoy, Reportar, Días libres, Números y Ajustes. Las pantallas de detalle (visita,
 * nuevo médico, nueva sede) viven en el mismo grupo sin pestaña propia y con "Volver". Sin sesión → ingreso.
 */
import { Redirect, useRouter } from 'expo-router'
import { Tabs } from 'expo-router/js-tabs'
import { Pressable, Text } from 'react-native'
import { useSesion } from '../../lib/sesion'
import { Cargando, useColores } from '../../lib/ui'

function BotonVolver() {
  const router = useRouter()
  const c = useColores()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Volver"
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/hoy'))}
      style={({ pressed }) => ({ paddingHorizontal: 16, paddingVertical: 10, opacity: pressed ? 0.6 : 1 })}
    >
      <Text style={{ color: c.texto, fontSize: 17, fontWeight: '600' }}>‹ Volver</Text>
    </Pressable>
  )
}

export default function AppLayout() {
  const { estado } = useSesion()
  const c = useColores()
  if (estado === 'cargando') return <Cargando texto="Abriendo OpMap Visitas…" />
  if (estado !== 'con_sesion') return <Redirect href="/login" />

  const oculta = { href: null, headerLeft: () => <BotonVolver /> } as const

  return (
    <Tabs
      backBehavior="history"
      screenOptions={{
        headerStyle: { backgroundColor: c.superficie },
        headerTintColor: c.texto,
        headerTitleStyle: { fontSize: 18, fontWeight: '700' },
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: c.fondo },
        tabBarStyle: { backgroundColor: c.superficie, borderTopColor: c.borde, height: 60 },
        tabBarActiveTintColor: c.acento,
        tabBarInactiveTintColor: c.textoSuave,
        tabBarIcon: () => null,
        tabBarIconStyle: { display: 'none' },
        tabBarLabelPosition: 'beside-icon',
        tabBarLabelStyle: { fontSize: 13, fontWeight: '700', marginLeft: 0, marginTop: 0 },
        tabBarItemStyle: { justifyContent: 'center', alignItems: 'center', paddingHorizontal: 0 },
      }}
    >
      <Tabs.Screen name="hoy" options={{ title: 'Hoy' }} />
      <Tabs.Screen name="reportar" options={{ title: 'Reportar' }} />
      <Tabs.Screen name="dias-libres" options={{ title: 'Días libres', headerTitle: 'Mis días libres' }} />
      <Tabs.Screen name="numeros" options={{ title: 'Números', headerTitle: 'Mis números' }} />
      <Tabs.Screen name="ajustes" options={{ title: 'Ajustes' }} />
      <Tabs.Screen name="visita/[id]" options={{ ...oculta, title: 'Visita' }} />
      <Tabs.Screen name="medico/nuevo" options={{ ...oculta, title: 'Nuevo médico' }} />
      <Tabs.Screen name="sede/nueva" options={{ ...oculta, title: 'Nueva sede' }} />
    </Tabs>
  )
}
