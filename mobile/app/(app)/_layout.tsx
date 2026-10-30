/**
 * Grupo con sesión: barra de abajo con Hoy · Reportar · Agenda · Números · Ajustes (lib/navegacion.ts, spec
 * 2026-10-15). Cada pestaña lleva su ícono (relleno si está elegida) y el nombre debajo, entero; la elegida, además,
 * con una raya negra arriba (estilo Uber, 2026-10-15). La barra tiene la altura que da la librería (49 pt más el margen
 * inferior del iPhone): no se le fija `height`, porque con una altura propia la librería deja de sumar ese margen pero
 * lo sigue restando y las letras salen cortadas.
 *
 * Encabezado (estilo Uber): BLANCO con el título grande a la izquierda (30/36; 28/34 junto a "Volver") y el logotipo
 * pequeño a la derecha, en lugar de la barra negra. Hoy y Reportar no lo llevan: arriba va el croquis y el título
 * está en la hoja (lib/navegacion.ts SIN_ENCABEZADO).
 *
 * Las pantallas sin pestaña (Días libres, Agendar, visita, nuevo médico, nueva sede) viven en el mismo grupo con
 * `href: null` y "Volver". Días libres se abre desde Agenda y desde Ajustes (solo con Ejecutivo Comercial). Sin sesión →
 * ingreso.
 *
 * F1b (actividades de campo, A1): la dirección comercial no agenda ni reporta: al entrar ve "La dirección comercial sigue
 * a su equipo en la web" con "Cerrar sesión" y no entra a las pestañas (lo decide su rol, que el login ya trae:
 * lib/persona.ts estadoPersona). La app es solo para las líderes (dueño, 2026-10-30): quien el servidor dejó fuera con
 * su porqué (sin_persona, p. ej. "Las visitas de los Ejecutivos Comerciales se registran en VMO") ve ese aviso igual.
 * Los demás entran como siempre; lo que el servidor no les deja hacer, lo dice él.
 */
import { Redirect, useRouter } from 'expo-router'
import { Tabs } from 'expo-router/js-tabs'
import { StatusBar } from 'expo-status-bar'
import { useState, type ReactNode } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Logo } from '../../components/Logo'
import { Icono } from '../../lib/iconos'
import { OCULTAS, PESTANAS, SIN_ENCABEZADO } from '../../lib/navegacion'
import { avisoFuera, entraALasPestanas, estadoPersona } from '../../lib/persona'
import { useSesion } from '../../lib/sesion'
import { ALTO_TOQUE_MIN, Aviso, Boton, Cargando, LETRA, Pantalla, TAMANO, Texto, Titulo, useColores, useFuente } from '../../lib/ui'

/** Alto de la caja del ícono de cada pestaña (y tamaño máximo del ícono): 24 pt, como el ícono de Material. */
const ALTO_ICONO_PESTANA = 24
/**
 * Relleno de arriba de cada pestaña: el de la pestaña 'uikit' con el nombre debajo del ícono en expo-router
 * (BottomTabItem, `tabVerticalUiKit: { padding: 5 }`; lo comprueba scripts/checks/20-estilo.ts contra node_modules).
 */
const RELLENO_PESTANA = 5
/**
 * La raya de la pestaña elegida: 28 × 3 pt pegada al borde de arriba de la barra, por DENTRO (como el artboard). Va
 * dentro de la caja del ícono, que empieza RELLENO_PESTANA pt debajo del borde: sube justo eso. Revisión 2026-10-15:
 * antes subía 6 desde la caja del glifo, cuyo alto depende de la letra del ícono, y quedaba a caballo sobre el borde.
 */
const RAYA_PESTANA = { ancho: 28, alto: 3, arriba: -RELLENO_PESTANA } as const

function BotonVolver() {
  const router = useRouter()
  const c = useColores()
  const fuente = useFuente()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Volver"
      hitSlop={6}
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/hoy'))}
      style={({ pressed }) => ({
        minHeight: ALTO_TOQUE_MIN,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        paddingLeft: 6,
        paddingRight: 14,
        borderRadius: TAMANO.radio,
        backgroundColor: c.relleno,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Icono nombre="atras" activo tamano={22} color={c.texto} />
      <Text style={[{ color: c.texto, fontSize: 16, lineHeight: 20 }, fuente('negrita')]}>Volver</Text>
    </Pressable>
  )
}

/** Logotipo pequeño a la derecha del encabezado blanco (negro; blanco en modo oscuro). */
function LogoEncabezado() {
  return (
    <View style={{ justifyContent: 'center' }}>
      <Logo ancho={84} />
    </View>
  )
}

/** El encabezado blanco: área segura, "Volver" (si lo hay), el título grande y lo de la derecha. */
function Encabezado({ titulo, izquierda, derecha }: { titulo: string; izquierda: ReactNode; derecha: ReactNode }) {
  const c = useColores()
  const fuente = useFuente()
  const insets = useSafeAreaInsets()
  const letra = izquierda ? LETRA.tituloPaso : LETRA.titulo
  return (
    <View style={{ backgroundColor: c.fondo, paddingTop: insets.top + 4, paddingBottom: 4, paddingLeft: Math.max(insets.left, TAMANO.espacio), paddingRight: Math.max(insets.right, TAMANO.espacio) }}>
      <View style={{ minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        {izquierda}
        <Text accessibilityRole="header" numberOfLines={2} style={[{ flex: 1, color: c.texto, ...letra }, fuente('negrita')]}>
          {titulo}
        </Text>
        {derecha}
      </View>
    </View>
  )
}

/**
 * Quien no entra a las pestañas: la dirección comercial (A1: sigue a su equipo en la web) o quien el servidor dejó fuera
 * con su porqué (app solo para líderes, dueño 2026-10-30). Solo el aviso, quién es y "Cerrar sesión".
 */
function FueraDeLaApp({ titulo, texto }: { titulo: string; texto: string }) {
  const { perfil, salir } = useSesion()
  const [saliendo, setSaliendo] = useState(false)
  const nombre = perfil?.usuario.full_name?.trim().split(/\s+/)[0] ?? ''
  return (
    <>
      <StatusBar style="auto" />
      <Pantalla>
        <Logo ancho={96} />
        <Titulo>{nombre ? `Hola, ${nombre}` : 'Hola'}</Titulo>
        <Aviso tono="info" titulo={titulo}>
          {texto}
        </Aviso>
        {perfil?.usuario.email ? <Texto suave peque>{`Entraste como ${perfil.usuario.email}.`}</Texto> : null}
        <Boton
          titulo="Cerrar sesión"
          variante="peligro"
          cargando={saliendo}
          alPresionar={() => {
            setSaliendo(true)
            void salir().finally(() => setSaliendo(false))
          }}
        />
      </Pantalla>
    </>
  )
}

export default function AppLayout() {
  const { estado, perfil, sinConfirmar } = useSesion()
  const c = useColores()
  const fuente = useFuente()
  if (estado === 'cargando') return <Cargando texto="Abriendo VG Visitas…" />
  if (estado !== 'con_sesion') return <Redirect href="/login" />
  const quien = estadoPersona({ role: perfil?.usuario.role, persona: perfil?.persona, sinPersona: perfil?.sinPersona, sinConfirmar })
  if (!entraALasPestanas(quien)) return <FueraDeLaApp {...avisoFuera(quien, perfil?.sinPersona)} />

  return (
    <>
      {/* Encabezado blanco (negro en modo oscuro): hora y batería del color que contrasta. */}
      <StatusBar style="auto" />
      <Tabs
        backBehavior="history"
        screenOptions={{
          header: ({ options, route }) => (
            <Encabezado
              titulo={typeof options.headerTitle === 'string' ? options.headerTitle : (options.title ?? route.name)}
              izquierda={options.headerLeft ? options.headerLeft({ canGoBack: true }) : null}
              derecha={options.headerRight ? options.headerRight({ canGoBack: true }) : null}
            />
          ),
          headerRight: () => <LogoEncabezado />,
          sceneStyle: { backgroundColor: c.fondo },
          // Sin `height`: 49 pt + el margen inferior del iPhone, como la barra nativa.
          tabBarStyle: { backgroundColor: c.superficie, borderTopColor: c.bordeFuerte, borderTopWidth: 1 },
          // Elegida: ícono relleno, raya negra arriba y texto negro (blanco en modo oscuro). Las demás: contorno y gris
          // (≥ 4,5:1).
          tabBarActiveTintColor: c.acento,
          tabBarInactiveTintColor: c.textoSuave,
          tabBarLabelPosition: 'below-icon',
          // Alto útil de la pestaña: 49 − 10 de relleno = 39 pt. El ícono va en una caja de 24 (la librería la hace de
          // 28) para que ícono + nombre (~14) quepan con el relleno de abajo: con 28 se pasaban 3 pt y, sin margen
          // inferior (iPhone SE u 8, con botón de inicio), el nombre quedaba a 1 pt del borde (revisión 2026-10-15).
          tabBarIconStyle: { height: ALTO_ICONO_PESTANA },
          // flexShrink 0: sin esto, en el navegador el nombre se encoge a 10 pt y corta "y", "p", "g" y "j".
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
              headerShown: !SIN_ENCABEZADO.includes(p.ruta),
              tabBarIcon: ({ focused, size }) => (
                // Alto fijo (el de la caja del ícono): su borde de arriba es el de la caja, mida lo que mida el glifo.
                <View style={{ height: ALTO_ICONO_PESTANA, alignItems: 'center', justifyContent: 'center' }}>
                  {focused ? (
                    <View
                      style={{
                        position: 'absolute',
                        top: RAYA_PESTANA.arriba,
                        width: RAYA_PESTANA.ancho,
                        height: RAYA_PESTANA.alto,
                        borderBottomLeftRadius: 2,
                        borderBottomRightRadius: 2,
                        backgroundColor: c.acento,
                      }}
                    />
                  ) : null}
                  <Icono nombre={p.icono} activo={focused} color={focused ? c.acento : c.textoSuave} tamano={Math.min(size, ALTO_ICONO_PESTANA)} />
                </View>
              ),
            }}
          />
        ))}
        {OCULTAS.map(o => (
          <Tabs.Screen key={o.ruta} name={o.ruta} options={{ href: null, title: o.encabezado, headerLeft: () => <BotonVolver />, headerRight: () => null }} />
        ))}
      </Tabs>
    </>
  )
}
