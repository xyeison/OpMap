/**
 * Piezas visuales de la app: dirección A "estilo Uber" (elegida por el dueño el 2026-10-15). Negro y blanco con
 * letra DM Sans, títulos fuertes (30/36), encabezado blanco con el título grande, botón principal negro a ancho
 * completo de 52 pt, chips y botones secundarios rellenos de #EEEEEE, filas con separadores finos y el estado
 * "dentro" en verde sobre verde suave. Nada que se toque mide menos de ALTO_TOQUE_MIN (44 pt). La paleta, la letra,
 * los tamaños y contraste() viven en lib/paleta.ts (puro); aquí se siguen exportando igual.
 *
 * Teclado (spec 2026-10-15): Pantalla nunca deja el campo que se escribe debajo del teclado y deslizar lo cierra.
 * Los campos de texto llevan `bordeControl` (≥ 3:1, WCAG 1.4.11): son lo único que se identifica por su borde. Los
 * botones y chips se reconocen por su texto (≥ 4,5:1 sobre su relleno) y lo elegido (negro) se distingue de lo no
 * elegido (#EEEEEE) a ≥ 3:1 (scripts/checks/20-estilo.ts).
 *
 * Letra: app/_layout.tsx carga DM Sans (Regular, Medium, Bold) con useFonts y avisa con <ProveedorFuentes>. Mientras
 * no esté (o si falla) todo usa la fuente del sistema con el peso equivalente: la app nunca se queda en blanco.
 * Para un <Text> propio fuera de estos componentes: `const fuente = useFuente()` y `style={[..., fuente('negrita')]}`.
 */
import Ionicons from '@expo/vector-icons/Ionicons'
import { createContext, useContext, useState, type ComponentProps, type ReactNode } from 'react'
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { HeaderHeightContext } from 'expo-router/react-navigation'
import { glifoDe, type NombreIcono } from './iconos-nombres'
import { ALTO_TOQUE_MIN, COLORES_CLAROS, COLORES_OSCUROS, LETRA, MAX_ESCALA_TEXTO, SOMBRA, TAMANO, type Colores } from './paleta'
import { useEsquema } from './tema-preferencia'

// ---------------------------------------------------------------------------------------------
// Colores y tamaños (viven en lib/paleta.ts, puro, para que las pruebas los lean en Node)
// ---------------------------------------------------------------------------------------------

export { ALTO_TOQUE_MIN, COLORES_CLAROS, COLORES_OSCUROS, LETRA, MAX_ESCALA_TEXTO, SOMBRA, TAMANO }
export { contraste } from './paleta'
export type { Colores }

/** Los colores del tema que eligió la persona (Claro, Oscuro o Automático; lib/tema-preferencia.tsx). */
export function useColores(): Colores {
  return useEsquema() === 'dark' ? COLORES_OSCUROS : COLORES_CLAROS
}

// ---------------------------------------------------------------------------------------------
// Letra (DM Sans con respaldo a la del sistema)
// ---------------------------------------------------------------------------------------------

export type Peso = 'regular' | 'media' | 'negrita'

/**
 * Nombres con que app/_layout.tsx registra cada archivo de DM Sans en useFonts (las claves del objeto que recibe).
 * Cada peso es su propio archivo: con la letra cargada se usa la familia del peso y fontWeight normal, porque
 * Android e iOS no derivan la negrita de un archivo Regular de forma fiable.
 */
export const FAMILIAS_DM_SANS: Record<Peso, string> = {
  regular: 'DMSans_400Regular',
  media: 'DMSans_500Medium',
  negrita: 'DMSans_700Bold',
}

const PESO_SISTEMA: Record<Peso, TextStyle['fontWeight']> = { regular: '400', media: '500', negrita: '700' }

/** Estilo de letra para un peso: DM Sans si ya cargó, si no la fuente del sistema con el peso equivalente. */
export function estiloFuente(peso: Peso, dmSans: boolean): TextStyle {
  return dmSans ? { fontFamily: FAMILIAS_DM_SANS[peso], fontWeight: 'normal' } : { fontWeight: PESO_SISTEMA[peso] }
}

const ContextoFuentes = createContext(false)

/** Lo pone app/_layout.tsx: `listas` es verdadero solo si DM Sans cargó sin error. */
export function ProveedorFuentes({ listas, children }: { listas: boolean; children: ReactNode }) {
  return <ContextoFuentes.Provider value={listas}>{children}</ContextoFuentes.Provider>
}

/** ¿Está cargada DM Sans? (falso mientras carga o si falló: entonces va la fuente del sistema). */
export function useFuentesListas(): boolean {
  return useContext(ContextoFuentes)
}

/** Devuelve `fuente(peso)` → estilo de letra listo para poner en un <Text>. */
export function useFuente(): (peso: Peso) => TextStyle {
  const listas = useContext(ContextoFuentes)
  return (peso: Peso) => estiloFuente(peso, listas)
}

// ---------------------------------------------------------------------------------------------
// Ícono (Ionicons, el mismo mapa de lib/iconos-nombres.ts que usa lib/iconos.tsx)
// ---------------------------------------------------------------------------------------------

type GlifoIonicons = ComponentProps<typeof Ionicons>['name']

function IconoUi({ nombre, color, tamano = 20, activo = false }: { nombre: NombreIcono; color: string; tamano?: number; activo?: boolean }) {
  return <Ionicons name={glifoDe(nombre, activo) as GlifoIonicons} size={tamano} color={color} />
}

// ---------------------------------------------------------------------------------------------
// Texto
// ---------------------------------------------------------------------------------------------

interface PropsTexto {
  children: ReactNode
  suave?: boolean
  peque?: boolean
  negrita?: boolean
  /** Peso medio (500): nombres en las filas, como en los artboards. */
  media?: boolean
  centro?: boolean
  color?: string
  estilo?: StyleProp<TextStyle>
  lineas?: number
}

export function Texto({ children, suave, peque, negrita, media, centro, color, estilo, lineas }: PropsTexto) {
  const c = useColores()
  const fuente = useFuente()
  const letra = peque ? LETRA.peque : LETRA.cuerpo
  return (
    <Text
      numberOfLines={lineas}
      style={[
        {
          color: color ?? (suave ? c.textoSuave : c.texto),
          fontSize: letra.fontSize,
          lineHeight: letra.lineHeight,
          textAlign: centro ? 'center' : 'left',
        },
        fuente(negrita ? 'negrita' : media ? 'media' : 'regular'),
        estilo,
      ]}
    >
      {children}
    </Text>
  )
}

/** Título de la pantalla: 30/36, negrita, −0,02 em. */
export function Titulo({ children, estilo }: { children: ReactNode; estilo?: StyleProp<TextStyle> }) {
  const c = useColores()
  const fuente = useFuente()
  return (
    <Text accessibilityRole="header" style={[{ color: c.texto, ...LETRA.titulo }, fuente('negrita'), estilo]}>
      {children}
    </Text>
  )
}

/** Título de un paso o de un bloque ("¿A qué hora?", "Quién soy"): 20/26. */
export function Subtitulo({ children, estilo }: { children: ReactNode; estilo?: StyleProp<TextStyle> }) {
  const c = useColores()
  const fuente = useFuente()
  return (
    <Text accessibilityRole="header" style={[{ color: c.texto, ...LETRA.subtitulo }, fuente('negrita'), estilo]}>
      {children}
    </Text>
  )
}

/**
 * Título de una sección de lista ("Más citas de hoy", "Octubre 2026"): 17/22 en negrita, con un texto suave o una
 * acción a la derecha ("1 de 4 reportadas").
 */
export function Seccion({ titulo, derecha, estilo }: { titulo: string; derecha?: ReactNode; estilo?: StyleProp<ViewStyle> }) {
  const c = useColores()
  const fuente = useFuente()
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 24 }, estilo]}>
      <Text accessibilityRole="header" style={[{ color: c.texto, flexShrink: 1, ...LETRA.seccion }, fuente('negrita')]}>
        {titulo}
      </Text>
      {typeof derecha === 'string' ? <Text style={[{ color: c.textoSuave, ...LETRA.peque }, fuente('regular')]}>{derecha}</Text> : derecha}
    </View>
  )
}

// ---------------------------------------------------------------------------------------------
// Contenedores
// ---------------------------------------------------------------------------------------------

interface PropsPantalla {
  children: ReactNode
  alRefrescar?: () => void
  refrescando?: boolean
  /** Sin desplazamiento (pantallas que se acomodan solas). */
  fija?: boolean
  estilo?: StyleProp<ViewStyle>
  /**
   * Pie fijo abajo (el botón principal: "Confirmar visita 1 de N", "Agendar · …"): queda fuera del desplazamiento,
   * siempre a la vista y encima de la barra de pestañas. Sin pie, la pantalla es la de siempre.
   */
  pie?: ReactNode
}

/**
 * Fondo y márgenes de una pantalla, con "tirar para actualizar" si se pasa alRefrescar y un pie fijo opcional. Sin
 * encabezado (Hoy y Reportar: el croquis y la hoja ocupan la parte de arriba) deja el margen del área segura arriba;
 * el Croquis lo recupera para pintarse detrás de la hora y la batería.
 *
 * Teclado: en el iPhone el ScrollView corre su contenido lo que tapa el teclado y lleva el campo enfocado a la vista
 * (`automaticallyAdjustKeyboardInsets`); deslizar hacia abajo lo cierra ('interactive' en iOS, 'on-drag' en el
 * resto). En Android (de borde a borde desde SDK 54 la ventana ya no se achica sola) un KeyboardAvoidingView deja el
 * contenido y el pie encima del teclado; mide desde debajo del encabezado. En el navegador no hace falta nada.
 */
export function Pantalla({ children, alRefrescar, refrescando = false, fija, estilo, pie }: PropsPantalla) {
  const c = useColores()
  const alturaEncabezado = useContext(HeaderHeightContext) ?? 0
  const margenArriba = useMargenSinEncabezado(alturaEncabezado)
  const cuerpo = fija ? (
    <View style={[{ flex: 1, backgroundColor: c.fondo, padding: TAMANO.espacio, paddingTop: TAMANO.espacio + margenArriba }, estilo]}>{children}</View>
  ) : (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.fondo }}
      contentContainerStyle={[{ padding: TAMANO.espacio, paddingTop: (alturaEncabezado > 0 ? 8 : TAMANO.espacio) + margenArriba, paddingBottom: 48, gap: 16 }, estilo]}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      refreshControl={alRefrescar ? <RefreshControl refreshing={refrescando} onRefresh={alRefrescar} tintColor={c.textoSuave} /> : undefined}
    >
      {children}
    </ScrollView>
  )
  const conPie =
    pie === undefined || pie === null || pie === false ? (
      cuerpo
    ) : (
      <View style={{ flex: 1, backgroundColor: c.fondo }}>
        {cuerpo}
        <View
          style={{
            paddingHorizontal: TAMANO.espacio,
            paddingVertical: 12,
            gap: 8,
            backgroundColor: c.superficie,
            borderTopColor: c.bordeFuerte,
            borderTopWidth: 1,
          }}
        >
          {pie}
        </View>
      </View>
    )
  if (Platform.OS !== 'android') return conPie
  return (
    <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={alturaEncabezado} style={{ flex: 1, backgroundColor: c.fondo }}>
      {conPie}
    </KeyboardAvoidingView>
  )
}

/** Sin encabezado (altura 0), el margen del área segura de arriba; con encabezado, 0 (él ya lo deja). */
function useMargenSinEncabezado(alturaEncabezado: number): number {
  const insets = useSafeAreaInsets()
  return alturaEncabezado > 0 ? 0 : insets.top
}

/** El margen que Pantalla deja arriba cuando la pantalla no tiene encabezado (para que el Croquis lo recupere). */
export function useMargenArribaPantalla(): number {
  const alturaEncabezado = useContext(HeaderHeightContext) ?? 0
  return useMargenSinEncabezado(alturaEncabezado) + (alturaEncabezado > 0 ? 8 : TAMANO.espacio)
}

interface PropsTarjeta {
  children: ReactNode
  alPresionar?: () => void
  estilo?: StyleProp<ViewStyle>
  etiquetaAccesible?: string
}

/** Tarjeta blanca con el borde suave (#EEEEEE) y radio 12. */
export function Tarjeta({ children, alPresionar, estilo, etiquetaAccesible }: PropsTarjeta) {
  const c = useColores()
  const base: ViewStyle = {
    backgroundColor: c.superficie,
    borderColor: c.borde,
    borderWidth: 1,
    borderRadius: TAMANO.radioTarjeta,
    padding: 16,
    gap: 8,
  }
  if (!alPresionar) return <View style={[base, estilo]}>{children}</View>
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={etiquetaAccesible}
      onPress={alPresionar}
      style={({ pressed }) => [base, pressed ? { backgroundColor: c.superficieSuave } : null, estilo]}
    >
      {children}
    </Pressable>
  )
}

/** Bloque destacado relleno de #F6F6F6 (radio 12, sin borde): "Compromiso pendiente", "Lo que dijiste". */
export function Bloque({ children, alPresionar, estilo, etiquetaAccesible }: PropsTarjeta) {
  const c = useColores()
  const base: ViewStyle = { backgroundColor: c.superficieSuave, borderRadius: TAMANO.radioTarjeta, paddingVertical: 12, paddingHorizontal: 14, gap: 4 }
  if (!alPresionar) return <View style={[base, estilo]}>{children}</View>
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={etiquetaAccesible}
      onPress={alPresionar}
      style={({ pressed }) => [base, { minHeight: ALTO_TOQUE_MIN, opacity: pressed ? 0.7 : 1 }, estilo]}
    >
      {children}
    </Pressable>
  )
}

/**
 * Fila de una lista con separador fino arriba (las filas de "Más citas de hoy", "Actividades de hoy"): toda la fila se
 * toca (≥ 44 pt) si lleva alPresionar, con "›" a la derecha.
 */
export function FilaLista({
  children,
  alPresionar,
  etiquetaAccesible,
  primera,
  estilo,
}: {
  children: ReactNode
  alPresionar?: () => void
  etiquetaAccesible?: string
  /** La primera de la lista va sin separador arriba. */
  primera?: boolean
  estilo?: StyleProp<ViewStyle>
}) {
  const c = useColores()
  const base: ViewStyle = {
    minHeight: 60,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderTopWidth: primera ? 0 : 1,
    borderTopColor: c.borde,
  }
  if (!alPresionar) return <View style={[base, estilo]}>{children}</View>
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={etiquetaAccesible} onPress={alPresionar} style={({ pressed }) => [base, { opacity: pressed ? 0.6 : 1 }, estilo]}>
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>{children}</View>
      <View style={{ alignSelf: 'center' }}>
        <IconoUi nombre="adelante" color={c.textoSuave} tamano={18} />
      </View>
    </Pressable>
  )
}

/** Fila con texto a la izquierda y valor a la derecha. */
export function Fila({ etiqueta, valor, fuerte }: { etiqueta: ReactNode; valor: ReactNode; fuerte?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, minHeight: 28 }}>
      <View style={{ flexShrink: 1 }}>{typeof etiqueta === 'string' ? <Texto suave>{etiqueta}</Texto> : etiqueta}</View>
      <View style={{ flexShrink: 0 }}>{typeof valor === 'string' || typeof valor === 'number' ? <Texto negrita={fuerte} media={!fuerte}>{valor}</Texto> : valor}</View>
    </View>
  )
}

export function Separador() {
  const c = useColores()
  return <View style={{ height: 1, backgroundColor: c.borde, marginVertical: 4 }} />
}

/** Fila horizontal que se acomoda en varias líneas (chips, botones pequeños). */
export function Grupo({ children, estilo }: { children: ReactNode; estilo?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, estilo]}>{children}</View>
}

/**
 * La parte de arriba de la hoja blanca que sube sobre el croquis (radio 20, sombra hacia arriba y la agarradera). Va
 * justo después del <Croquis>: lo que sigue en la pantalla queda "dentro" de la hoja (el fondo es el mismo blanco).
 */
export function BordeHoja() {
  const c = useColores()
  // La sombra sube sobre el croquis; la caja de afuera la corta abajo (si no, se vería una franja sobre el contenido).
  const sombra = 30
  return (
    <View accessible={false} style={{ marginTop: -(TAMANO.radioHoja + sombra + 16), marginBottom: -18, marginHorizontal: -TAMANO.espacio, height: sombra + TAMANO.radioHoja + 4, overflow: 'hidden' }}>
      <View
        style={{
          marginTop: sombra,
          height: TAMANO.radioHoja + 4,
          borderTopLeftRadius: TAMANO.radioHoja,
          borderTopRightRadius: TAMANO.radioHoja,
          backgroundColor: c.fondo,
          boxShadow: SOMBRA.hoja,
          alignItems: 'center',
          paddingTop: 8,
        }}
      >
        <View style={{ width: 36, height: 5, borderRadius: 3, backgroundColor: c.agarradera }} />
      </View>
    </View>
  )
}

// ---------------------------------------------------------------------------------------------
// Botones, chips e insignias
// ---------------------------------------------------------------------------------------------

export type VarianteBoton = 'primario' | 'secundario' | 'peligro' | 'texto'

interface PropsBoton {
  titulo: string
  alPresionar: () => void
  variante?: VarianteBoton
  grande?: boolean
  /** 44 pt y letra de 15 (el "Agendar" junto a un título, "Cambiar"). */
  compacto?: boolean
  cargando?: boolean
  deshabilitado?: boolean
  /** Texto pequeño debajo del título (en el botón grande). */
  detalle?: string
  /** Ícono a la izquierda del título (micrófono en "Hablar", "+" en "Agendar"). */
  icono?: NombreIcono
  estilo?: StyleProp<ViewStyle>
}

/**
 * Botón: el principal negro (blanco en modo oscuro) a ancho completo de 52 pt; el secundario relleno de #EEEEEE; el de
 * peligro en rojo sobre rojo suave; el de texto, solo la palabra en negrita (44 pt de alto para el dedo).
 */
export function Boton({ titulo, alPresionar, variante = 'primario', grande, compacto, cargando, deshabilitado, detalle, icono, estilo }: PropsBoton) {
  const c = useColores()
  const fuente = useFuente()
  const inactivo = deshabilitado || cargando
  const fondo = variante === 'primario' ? c.acento : variante === 'peligro' ? c.fondoPeligro : variante === 'texto' ? 'transparent' : c.relleno
  const colorTexto = variante === 'primario' ? c.sobreAcento : variante === 'peligro' ? c.peligro : c.texto
  const letra = compacto || variante === 'texto' ? { fontSize: 15, lineHeight: 20 } : LETRA.boton
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactivo, busy: !!cargando }}
      accessibilityLabel={titulo}
      disabled={inactivo}
      onPress={alPresionar}
      style={({ pressed }) => [
        {
          minHeight: compacto || variante === 'texto' ? ALTO_TOQUE_MIN : grande ? TAMANO.botonGrande : TAMANO.boton,
          borderRadius: TAMANO.radio,
          backgroundColor: fondo,
          paddingHorizontal: variante === 'texto' ? 8 : compacto ? 14 : 18,
          paddingVertical: compacto || variante === 'texto' ? 6 : 10,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: compacto ? 6 : 10,
          opacity: inactivo ? 0.45 : pressed ? 0.8 : 1,
        },
        estilo,
      ]}
    >
      {cargando ? (
        <ActivityIndicator color={colorTexto} />
      ) : (
        <>
          {icono ? <IconoUi nombre={icono} color={colorTexto} tamano={compacto ? 18 : 20} /> : null}
          <View style={{ flexShrink: 1, alignItems: 'center' }}>
            <Text style={[{ color: colorTexto, textAlign: 'center', ...letra }, fuente('negrita')]}>{titulo}</Text>
            {detalle ? (
              <Text style={[{ color: colorTexto, opacity: 0.8, ...LETRA.etiqueta, marginTop: 2, textAlign: 'center' }, fuente('regular')]}>{detalle}</Text>
            ) : null}
          </View>
        </>
      )}
    </Pressable>
  )
}

/** Botón cuadrado de 44 pt con solo un ícono, relleno de #EEEEEE (o blanco con sombra sobre el croquis). */
export function BotonIcono({
  icono,
  etiqueta,
  alPresionar,
  flotante,
  deshabilitado,
  estilo,
}: {
  icono: NombreIcono
  etiqueta: string
  alPresionar: () => void
  flotante?: boolean
  deshabilitado?: boolean
  estilo?: StyleProp<ViewStyle>
}) {
  const c = useColores()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      accessibilityState={{ disabled: !!deshabilitado }}
      disabled={deshabilitado}
      onPress={alPresionar}
      hitSlop={4}
      style={({ pressed }) => [
        {
          width: ALTO_TOQUE_MIN,
          minHeight: ALTO_TOQUE_MIN,
          borderRadius: TAMANO.radio,
          backgroundColor: flotante ? c.superficie : c.relleno,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: deshabilitado ? 0.35 : pressed ? 0.7 : 1,
        },
        flotante ? { boxShadow: SOMBRA.flotante } : null,
        estilo,
      ]}
    >
      <IconoUi nombre={icono} color={c.texto} tamano={22} />
    </Pressable>
  )
}

interface PropsChip {
  texto: string
  activo?: boolean
  alPresionar?: () => void
  deshabilitado?: boolean
}

/** Opción seleccionable (tipo, motivo, medio día…): rellena de #EEEEEE; la elegida, negra con letra blanca. */
export function Chip({ texto, activo, alPresionar, deshabilitado }: PropsChip) {
  const c = useColores()
  const fuente = useFuente()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!activo, disabled: !!deshabilitado }}
      disabled={deshabilitado}
      onPress={alPresionar}
      style={({ pressed }) => ({
        minHeight: ALTO_TOQUE_MIN,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: TAMANO.radio,
        backgroundColor: activo ? c.acento : c.relleno,
        justifyContent: 'center',
        opacity: deshabilitado ? 0.45 : pressed ? 0.75 : 1,
      })}
    >
      <Text style={[{ color: activo ? c.sobreAcento : c.texto, fontSize: 15, lineHeight: 20 }, fuente(activo ? 'negrita' : 'media')]}>{texto}</Text>
    </Pressable>
  )
}

export type Tono = 'neutro' | 'exito' | 'alerta' | 'peligro' | 'info'

function coloresTono(c: Colores, tono: Tono): { texto: string; fondo: string } {
  switch (tono) {
    case 'exito':
      return { texto: c.exito, fondo: c.fondoExito }
    case 'alerta':
      return { texto: c.alerta, fondo: c.fondoAlerta }
    case 'peligro':
      return { texto: c.peligro, fondo: c.fondoPeligro }
    case 'info':
      return { texto: c.info, fondo: c.fondoInfo }
    default:
      return { texto: c.textoSuave, fondo: c.relleno }
  }
}

/** Etiqueta pequeña de estado ("Dentro del radio", "Pendiente"): radio 6, 13 pt en negrita; la de éxito con su punto. */
export function Insignia({ texto, tono = 'neutro' }: { texto: string; tono?: Tono }) {
  const c = useColores()
  const fuente = useFuente()
  const t = coloresTono(c, tono)
  return (
    <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: t.fondo, borderRadius: 6, paddingHorizontal: 8, minHeight: 22, paddingVertical: 3 }}>
      {tono === 'exito' ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: t.texto }} /> : null}
      {/* Con el texto grande del sistema crece hasta 1,3 veces (más, se sale de la pastilla). */}
      <Text maxFontSizeMultiplier={1.3} style={[{ color: t.texto, ...LETRA.etiqueta }, fuente('negrita')]}>
        {texto}
      </Text>
    </View>
  )
}

/** Mensaje destacado (error, aviso, éxito) con acción opcional. */
export function Aviso({ tono = 'info', titulo, children, accion }: { tono?: Tono; titulo?: string; children?: ReactNode; accion?: ReactNode }) {
  const c = useColores()
  const fuente = useFuente()
  const t = coloresTono(c, tono)
  return (
    <View accessibilityRole={tono === 'peligro' ? 'alert' : undefined} style={{ backgroundColor: t.fondo, borderRadius: TAMANO.radioTarjeta, paddingVertical: 12, paddingHorizontal: 14, gap: 4 }}>
      {titulo ? <Text style={[{ color: t.texto, ...LETRA.cuerpo }, fuente('negrita')]}>{titulo}</Text> : null}
      {typeof children === 'string' ? <Text style={[{ color: t.texto, fontSize: 15, lineHeight: 21 }, fuente('regular')]}>{children}</Text> : children}
      {accion ? <View style={{ marginTop: 6 }}>{accion}</View> : null}
    </View>
  )
}

/** Barra de avance (0..1): fina y negra sobre #EEEEEE (verde si se cumplió). */
export function Barra({ valor, tono = 'neutro' }: { valor: number; tono?: Tono }) {
  const c = useColores()
  const ancho = `${Math.round(Math.min(1, Math.max(0, valor)) * 100)}%` as const
  const color = tono === 'exito' ? c.exito : tono === 'alerta' ? c.alerta : tono === 'peligro' ? c.peligro : c.acento
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(Math.min(1, Math.max(0, valor)) * 100) }}
      style={{ height: 6, borderRadius: 3, backgroundColor: c.relleno, overflow: 'hidden' }}
    >
      <View style={{ width: ancho, height: '100%', borderRadius: 3, backgroundColor: color }} />
    </View>
  )
}

// ---------------------------------------------------------------------------------------------
// Campos
// ---------------------------------------------------------------------------------------------

interface PropsCampo extends Omit<TextInputProps, 'style' | 'value' | 'onChangeText'> {
  etiqueta: string
  valor: string
  alCambiar: (texto: string) => void
  error?: string | null
  ayuda?: string | null
  varias?: boolean
}

/** Campo de texto: blanco con borde gris (≥ 3:1) y radio 10; con el foco, borde negro de 2. */
export function Campo({ etiqueta, valor, alCambiar, error, ayuda, varias, onFocus, onBlur, ...resto }: PropsCampo) {
  const c = useColores()
  const fuente = useFuente()
  const [enfocado, setEnfocado] = useState(false)
  return (
    <View style={{ gap: 6 }}>
      <Text style={[{ color: c.texto, fontSize: 15, lineHeight: 20 }, fuente('negrita')]}>{etiqueta}</Text>
      <TextInput
        {...resto}
        accessibilityLabel={etiqueta}
        value={valor}
        onChangeText={alCambiar}
        onFocus={e => {
          setEnfocado(true)
          onFocus?.(e)
        }}
        onBlur={e => {
          setEnfocado(false)
          onBlur?.(e)
        }}
        multiline={varias}
        placeholderTextColor={c.textoSuave}
        style={[
          {
            minHeight: varias ? 110 : TAMANO.boton,
            borderRadius: TAMANO.radio,
            borderWidth: enfocado ? 2 : 1,
            borderColor: error ? c.peligro : enfocado ? c.acento : c.bordeControl,
            backgroundColor: c.superficie,
            color: c.texto,
            fontSize: TAMANO.texto,
            paddingHorizontal: enfocado ? 13 : 14,
            paddingVertical: varias ? 12 : 8,
            textAlignVertical: varias ? 'top' : 'center',
          },
          fuente('regular'),
        ]}
      />
      {error ? (
        <Text style={[{ color: c.peligro, ...LETRA.peque }, fuente('regular')]}>{error}</Text>
      ) : ayuda ? (
        <Text style={[{ color: c.textoSuave, ...LETRA.peque }, fuente('regular')]}>{ayuda}</Text>
      ) : null}
    </View>
  )
}

// ---------------------------------------------------------------------------------------------
// Estados de carga
// ---------------------------------------------------------------------------------------------

export function Cargando({ texto = 'Cargando…' }: { texto?: string }) {
  const c = useColores()
  return (
    <View style={{ flex: 1, minHeight: 160, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: c.fondo }}>
      <ActivityIndicator size="large" color={c.texto} />
      <Texto suave>{texto}</Texto>
    </View>
  )
}

export function Vacio({ texto }: { texto: string }) {
  return (
    <View style={{ paddingVertical: 16 }}>
      <Texto suave centro>
        {texto}
      </Texto>
    </View>
  )
}

/** Pantalla provisional (la escribe la fase siguiente). */
export function EnConstruccion({ titulo, detalle }: { titulo: string; detalle?: string }) {
  return (
    <Pantalla>
      <Titulo>{titulo}</Titulo>
      <Aviso tono="info" titulo="En construcción">
        {detalle ?? 'Esta pantalla llega en la próxima versión de la app.'}
      </Aviso>
    </Pantalla>
  )
}

// ---------------------------------------------------------------------------------------------
// Confirmaciones
// ---------------------------------------------------------------------------------------------

/** Pregunta sí/no (Alert en el teléfono, confirm en el navegador). */
export function confirmar(titulo: string, mensaje: string, textoSi = 'Sí', peligro = false): Promise<boolean> {
  if (Platform.OS === 'web') {
    const ventana = globalThis as unknown as { confirm?: (texto: string) => boolean }
    return Promise.resolve(ventana.confirm ? ventana.confirm(`${titulo}\n\n${mensaje}`) : true)
  }
  return new Promise(resolve => {
    Alert.alert(titulo, mensaje, [
      { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
      { text: textoSi, style: peligro ? 'destructive' : 'default', onPress: () => resolve(true) },
    ])
  })
}
