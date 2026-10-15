/**
 * Grupo con sesión: pestañas Hoy, Reportar, Días libres, Números y Ajustes. Las pantallas de detalle (visita,
 * nuevo médico, nueva sede) viven en el mismo grupo sin pestaña propia y con "Volver". Sin sesión → ingreso.
 */
import { Redirect, useRouter } from 'expo-router'
import { Tabs } from 'expo-router/js-tabs'
import { StatusBar } from 'expo-status-bar'
import { Pressable, Text, View } from 'react-native'
import { Logo } from '../../components/Logo'
import { useSesion } from '../../lib/sesion'
import { Cargando, useColores, useFuente } from '../../lib/ui'

function BotonVolver() {
  const router = useRouter()
  const c = useColores()
  const fuente = useFuente()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Volver"
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/hoy'))}
      style={({ pressed }) => ({ paddingHorizontal: 16, paddingVertical: 10, opacity: pressed ? 0.6 : 1 })}
    >
      <Text style={[{ color: c.sobreEncabezado, fontSize: 17 }, fuente('media')]}>‹ Volver</Text>
    </Pressable>
  )
}

/** Logotipo blanco a la derecha del encabezado negro (marca VG Medical). */
function LogoEncabezado() {
  return (
    <View style={{ paddingHorizontal: 16, justifyContent: 'center' }}>
      <Logo variante="claro" ancho={96} />
    </View>
  )
}

export default function AppLayout() {
  const { estado } = useSesion()
  const c = useColores()
  const fuente = useFuente()
  if (estado === 'cargando') return <Cargando texto="Abriendo VG Visitas…" />
  if (estado !== 'con_sesion') return <Redirect href="/login" />

  const oculta = { href: null, headerLeft: () => <BotonVolver /> } as const

  return (
    <>
      {/* Encabezado negro: hora y batería en blanco mientras se está dentro de la app. */}
      <StatusBar style="light" />
      <Tabs
        backBehavior="history"
        screenOptions={{
          headerStyle: { backgroundColor: c.encabezado },
          headerTintColor: c.sobreEncabezado,
          headerTitleStyle: { fontSize: 18, ...fuente('negrita') },
          headerShadowVisible: false,
          headerRight: () => <LogoEncabezado />,
          sceneStyle: { backgroundColor: c.fondo },
          tabBarStyle: { backgroundColor: c.superficie, borderTopColor: c.borde, height: 60 },
          tabBarActiveTintColor: c.acento,
          tabBarInactiveTintColor: c.textoSuave,
          // Pestaña elegida: además del negro, un fondo gris suave (el gris del texto inactivo ya es AA).
          tabBarActiveBackgroundColor: c.superficieSuave,
          tabBarIcon: () => null,
          tabBarIconStyle: { display: 'none' },
          tabBarLabelPosition: 'beside-icon',
          tabBarLabelStyle: { fontSize: 13, ...fuente('negrita'), marginLeft: 0, marginTop: 0 },
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
        <Tabs.Screen name="agenda" options={{ ...oculta, title: 'Mi agenda' }} />
        <Tabs.Screen name="agenda/nueva" options={{ ...oculta, title: 'Agendar' }} />
      </Tabs>
    </>
  )
}
