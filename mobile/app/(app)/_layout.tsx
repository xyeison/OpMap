/**
 * Grupo con sesión: barra de abajo con Hoy · Reportar · Agenda · Números · Ajustes (lib/navegacion.ts, spec
 * 2026-10-15). Cada pestaña lleva su ícono (relleno si está elegida) y el nombre debajo, entero. La barra tiene la
 * altura que da la librería (49 pt más el margen inferior del iPhone): no se le fija `height`, porque con una altura
 * propia la librería deja de sumar ese margen pero lo sigue restando y las letras salen cortadas.
 *
 * Las pantallas sin pestaña (Días libres, Agendar, visita, nuevo médico, nueva sede) viven en el mismo grupo con
 * `href: null` y "Volver". Días libres se abre desde Agenda y desde Ajustes. Sin sesión → ingreso.
 */
import { Redirect, useRouter } from 'expo-router'
import { Tabs } from 'expo-router/js-tabs'
import { StatusBar } from 'expo-status-bar'
import { Pressable, Text, View } from 'react-native'
import { Logo } from '../../components/Logo'
import { Icono } from '../../lib/iconos'
import { OCULTAS, PESTANAS } from '../../lib/navegacion'
import { useSesion } from '../../lib/sesion'
import { ALTO_TOQUE_MIN, Cargando, useColores, useFuente } from '../../lib/ui'

function BotonVolver() {
  const router = useRouter()
  const c = useColores()
  const fuente = useFuente()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Volver"
      hitSlop={8}
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/hoy'))}
      style={({ pressed }) => ({
        minHeight: ALTO_TOQUE_MIN,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        paddingLeft: 8,
        paddingRight: 16,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Icono nombre="atras" activo tamano={24} color={c.sobreEncabezado} />
      <Text style={[{ color: c.sobreEncabezado, fontSize: 17 }, fuente('media')]}>Volver</Text>
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
          // Sin `height`: 49 pt + el margen inferior del iPhone, como la barra nativa.
          tabBarStyle: { backgroundColor: c.superficie, borderTopColor: c.borde },
          // Elegida: ícono relleno y texto negro (blanco en modo oscuro). Las demás: contorno y gris (≥ 4,5:1).
          tabBarActiveTintColor: c.acento,
          tabBarInactiveTintColor: c.textoSuave,
          tabBarLabelPosition: 'below-icon',
          // flexShrink 0: ícono (28) + nombre (~14) pasan por 3 pt el alto útil de la pestaña (49 − 10 de relleno);
          // sin esto, en el navegador el nombre se encoge a 10 pt y corta "y", "p", "g" y "j". Así usa el relleno.
          tabBarLabelStyle: { fontSize: 11, flexShrink: 0, ...fuente('media') },
          // Como la barra nativa de iOS, el nombre no crece con el texto grande del sistema (se cortaría); al dejar
          // el dedo encima, iOS lo muestra en grande.
          tabBarAllowFontScaling: false,
        }}
      >
        {PESTANAS.map(p => (
          <Tabs.Screen
            key={p.ruta}
            name={p.ruta}
            options={{
              title: p.titulo,
              headerTitle: p.encabezado ?? p.titulo,
              tabBarIcon: ({ focused, size }) => (
                <Icono nombre={p.icono} activo={focused} color={focused ? c.acento : c.textoSuave} tamano={size} />
              ),
            }}
          />
        ))}
        {OCULTAS.map(o => (
          <Tabs.Screen key={o.ruta} name={o.ruta} options={{ href: null, title: o.encabezado, headerLeft: () => <BotonVolver /> }} />
        ))}
      </Tabs>
    </>
  )
}
