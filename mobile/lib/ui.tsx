/**
 * Piezas visuales de la app, con el estilo de la web de OpMap: fondo claro, texto gris oscuro y acento negro
 * (en modo oscuro se invierten). Tamaños grandes para usar en la calle, con una mano: botones de 56 px de alto,
 * texto de 17 px, áreas táctiles amplias.
 */
import { type ReactNode } from 'react'
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native'

// ---------------------------------------------------------------------------------------------
// Colores y tamaños
// ---------------------------------------------------------------------------------------------

export interface Colores {
  fondo: string
  superficie: string
  superficieSuave: string
  texto: string
  textoSuave: string
  borde: string
  acento: string
  sobreAcento: string
  peligro: string
  fondoPeligro: string
  exito: string
  fondoExito: string
  alerta: string
  fondoAlerta: string
  info: string
  fondoInfo: string
}

export const COLORES_CLAROS: Colores = {
  fondo: '#F9FAFB',
  superficie: '#FFFFFF',
  superficieSuave: '#F3F4F6',
  texto: '#1F2937',
  textoSuave: '#6B7280',
  borde: '#E5E7EB',
  acento: '#111827',
  sobreAcento: '#FFFFFF',
  peligro: '#B91C1C',
  fondoPeligro: '#FEF2F2',
  exito: '#047857',
  fondoExito: '#ECFDF5',
  alerta: '#92400E',
  fondoAlerta: '#FFFBEB',
  info: '#1E40AF',
  fondoInfo: '#EFF6FF',
}

export const COLORES_OSCUROS: Colores = {
  fondo: '#0B0F14',
  superficie: '#151B23',
  superficieSuave: '#1E252E',
  texto: '#E5E7EB',
  textoSuave: '#9CA3AF',
  borde: '#2A323C',
  acento: '#F9FAFB',
  sobreAcento: '#111827',
  peligro: '#FCA5A5',
  fondoPeligro: '#3A1414',
  exito: '#6EE7B7',
  fondoExito: '#0F2A22',
  alerta: '#FCD34D',
  fondoAlerta: '#33270B',
  info: '#93C5FD',
  fondoInfo: '#14223A',
}

export const TAMANO = {
  texto: 17,
  textoPeque: 14,
  titulo: 26,
  subtitulo: 19,
  boton: 56,
  botonGrande: 72,
  radio: 14,
  espacio: 16,
} as const

export function useColores(): Colores {
  return useColorScheme() === 'dark' ? COLORES_OSCUROS : COLORES_CLAROS
}

// ---------------------------------------------------------------------------------------------
// Texto
// ---------------------------------------------------------------------------------------------

interface PropsTexto {
  children: ReactNode
  suave?: boolean
  peque?: boolean
  negrita?: boolean
  centro?: boolean
  color?: string
  estilo?: StyleProp<TextStyle>
  lineas?: number
}

export function Texto({ children, suave, peque, negrita, centro, color, estilo, lineas }: PropsTexto) {
  const c = useColores()
  return (
    <Text
      numberOfLines={lineas}
      style={[
        {
          color: color ?? (suave ? c.textoSuave : c.texto),
          fontSize: peque ? TAMANO.textoPeque : TAMANO.texto,
          lineHeight: peque ? 20 : 24,
          fontWeight: negrita ? '600' : '400',
          textAlign: centro ? 'center' : 'left',
        },
        estilo,
      ]}
    >
      {children}
    </Text>
  )
}

export function Titulo({ children, estilo }: { children: ReactNode; estilo?: StyleProp<TextStyle> }) {
  const c = useColores()
  return (
    <Text accessibilityRole="header" style={[{ color: c.texto, fontSize: TAMANO.titulo, lineHeight: 32, fontWeight: '700' }, estilo]}>
      {children}
    </Text>
  )
}

export function Subtitulo({ children, estilo }: { children: ReactNode; estilo?: StyleProp<TextStyle> }) {
  const c = useColores()
  return (
    <Text accessibilityRole="header" style={[{ color: c.texto, fontSize: TAMANO.subtitulo, lineHeight: 26, fontWeight: '700' }, estilo]}>
      {children}
    </Text>
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
}

/** Fondo y márgenes de una pantalla, con "tirar para actualizar" si se pasa alRefrescar. */
export function Pantalla({ children, alRefrescar, refrescando = false, fija, estilo }: PropsPantalla) {
  const c = useColores()
  if (fija) return <View style={[{ flex: 1, backgroundColor: c.fondo, padding: TAMANO.espacio }, estilo]}>{children}</View>
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.fondo }}
      contentContainerStyle={[{ padding: TAMANO.espacio, paddingBottom: 48, gap: 14 }, estilo]}
      keyboardShouldPersistTaps="handled"
      refreshControl={alRefrescar ? <RefreshControl refreshing={refrescando} onRefresh={alRefrescar} tintColor={c.textoSuave} /> : undefined}
    >
      {children}
    </ScrollView>
  )
}

interface PropsTarjeta {
  children: ReactNode
  alPresionar?: () => void
  estilo?: StyleProp<ViewStyle>
  etiquetaAccesible?: string
}

export function Tarjeta({ children, alPresionar, estilo, etiquetaAccesible }: PropsTarjeta) {
  const c = useColores()
  const base: ViewStyle = {
    backgroundColor: c.superficie,
    borderColor: c.borde,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderRadius: TAMANO.radio,
    padding: TAMANO.espacio,
    gap: 8,
  }
  if (!alPresionar) return <View style={[base, estilo]}>{children}</View>
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={etiquetaAccesible}
      onPress={alPresionar}
      style={({ pressed }) => [base, { opacity: pressed ? 0.7 : 1 }, estilo]}
    >
      {children}
    </Pressable>
  )
}

/** Fila con texto a la izquierda y valor a la derecha. */
export function Fila({ etiqueta, valor, fuerte }: { etiqueta: ReactNode; valor: ReactNode; fuerte?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, minHeight: 28 }}>
      <View style={{ flexShrink: 1 }}>{typeof etiqueta === 'string' ? <Texto suave>{etiqueta}</Texto> : etiqueta}</View>
      <View style={{ flexShrink: 0 }}>{typeof valor === 'string' || typeof valor === 'number' ? <Texto negrita={fuerte}>{valor}</Texto> : valor}</View>
    </View>
  )
}

export function Separador() {
  const c = useColores()
  return <View style={{ height: StyleSheet.hairlineWidth * 2, backgroundColor: c.borde, marginVertical: 4 }} />
}

/** Fila horizontal que se acomoda en varias líneas (chips, botones pequeños). */
export function Grupo({ children, estilo }: { children: ReactNode; estilo?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, estilo]}>{children}</View>
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
  cargando?: boolean
  deshabilitado?: boolean
  /** Texto pequeño debajo del título (en el botón grande). */
  detalle?: string
  estilo?: StyleProp<ViewStyle>
}

export function Boton({ titulo, alPresionar, variante = 'primario', grande, cargando, deshabilitado, detalle, estilo }: PropsBoton) {
  const c = useColores()
  const inactivo = deshabilitado || cargando
  const fondo = variante === 'primario' ? c.acento : variante === 'peligro' ? c.fondoPeligro : variante === 'texto' ? 'transparent' : c.superficie
  const colorTexto = variante === 'primario' ? c.sobreAcento : variante === 'peligro' ? c.peligro : c.texto
  const borde = variante === 'secundario' ? c.borde : variante === 'peligro' ? c.peligro : 'transparent'
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactivo, busy: !!cargando }}
      accessibilityLabel={titulo}
      disabled={inactivo}
      onPress={alPresionar}
      style={({ pressed }) => [
        {
          minHeight: grande ? TAMANO.botonGrande : TAMANO.boton,
          borderRadius: TAMANO.radio,
          backgroundColor: fondo,
          borderColor: borde,
          borderWidth: variante === 'secundario' || variante === 'peligro' ? 1.5 : 0,
          paddingHorizontal: 18,
          paddingVertical: 10,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: inactivo ? 0.5 : pressed ? 0.8 : 1,
        },
        estilo,
      ]}
    >
      {cargando ? (
        <ActivityIndicator color={colorTexto} />
      ) : (
        <>
          <Text style={{ color: colorTexto, fontSize: grande ? 21 : TAMANO.texto, fontWeight: '700', textAlign: 'center' }}>{titulo}</Text>
          {detalle ? <Text style={{ color: colorTexto, opacity: 0.8, fontSize: TAMANO.textoPeque, marginTop: 2, textAlign: 'center' }}>{detalle}</Text> : null}
        </>
      )}
    </Pressable>
  )
}

interface PropsChip {
  texto: string
  activo?: boolean
  alPresionar?: () => void
  deshabilitado?: boolean
}

/** Opción seleccionable (tipo, motivo, medio día…). */
export function Chip({ texto, activo, alPresionar, deshabilitado }: PropsChip) {
  const c = useColores()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!activo, disabled: !!deshabilitado }}
      disabled={deshabilitado}
      onPress={alPresionar}
      style={({ pressed }) => ({
        minHeight: 44,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 999,
        borderWidth: 1.5,
        borderColor: activo ? c.acento : c.borde,
        backgroundColor: activo ? c.acento : c.superficie,
        justifyContent: 'center',
        opacity: deshabilitado ? 0.45 : pressed ? 0.75 : 1,
      })}
    >
      <Text style={{ color: activo ? c.sobreAcento : c.texto, fontSize: 16, fontWeight: activo ? '700' : '500' }}>{texto}</Text>
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
      return { texto: c.textoSuave, fondo: c.superficieSuave }
  }
}

/** Etiqueta pequeña de estado ("Efectiva", "Por aprobar"). */
export function Insignia({ texto, tono = 'neutro' }: { texto: string; tono?: Tono }) {
  const c = useColores()
  const t = coloresTono(c, tono)
  return (
    <View style={{ alignSelf: 'flex-start', backgroundColor: t.fondo, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 }}>
      <Text style={{ color: t.texto, fontSize: 13, fontWeight: '700' }}>{texto}</Text>
    </View>
  )
}

/** Mensaje destacado (error, aviso, éxito) con acción opcional. */
export function Aviso({ tono = 'info', titulo, children, accion }: { tono?: Tono; titulo?: string; children?: ReactNode; accion?: ReactNode }) {
  const c = useColores()
  const t = coloresTono(c, tono)
  return (
    <View accessibilityRole={tono === 'peligro' ? 'alert' : undefined} style={{ backgroundColor: t.fondo, borderRadius: TAMANO.radio, padding: 14, gap: 6 }}>
      {titulo ? <Text style={{ color: t.texto, fontSize: TAMANO.texto, fontWeight: '700' }}>{titulo}</Text> : null}
      {typeof children === 'string' ? <Text style={{ color: t.texto, fontSize: 16, lineHeight: 22 }}>{children}</Text> : children}
      {accion ? <View style={{ marginTop: 4 }}>{accion}</View> : null}
    </View>
  )
}

/** Barra de avance (0..1). */
export function Barra({ valor, tono = 'neutro' }: { valor: number; tono?: Tono }) {
  const c = useColores()
  const ancho = `${Math.round(Math.min(1, Math.max(0, valor)) * 100)}%` as const
  const color = tono === 'exito' ? c.exito : tono === 'alerta' ? c.alerta : tono === 'peligro' ? c.peligro : c.acento
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(Math.min(1, Math.max(0, valor)) * 100) }}
      style={{ height: 10, borderRadius: 999, backgroundColor: c.superficieSuave, overflow: 'hidden' }}
    >
      <View style={{ width: ancho, height: '100%', borderRadius: 999, backgroundColor: color }} />
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

export function Campo({ etiqueta, valor, alCambiar, error, ayuda, varias, ...resto }: PropsCampo) {
  const c = useColores()
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: c.texto, fontSize: 15, fontWeight: '600' }}>{etiqueta}</Text>
      <TextInput
        {...resto}
        accessibilityLabel={etiqueta}
        value={valor}
        onChangeText={alCambiar}
        multiline={varias}
        placeholderTextColor={c.textoSuave}
        style={{
          minHeight: varias ? 110 : TAMANO.boton,
          borderRadius: 12,
          borderWidth: 1.5,
          borderColor: error ? c.peligro : c.borde,
          backgroundColor: c.superficie,
          color: c.texto,
          fontSize: TAMANO.texto,
          paddingHorizontal: 14,
          paddingVertical: varias ? 12 : 8,
          textAlignVertical: varias ? 'top' : 'center',
        }}
      />
      {error ? <Text style={{ color: c.peligro, fontSize: 14 }}>{error}</Text> : ayuda ? <Text style={{ color: c.textoSuave, fontSize: 14 }}>{ayuda}</Text> : null}
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
      <ActivityIndicator size="large" color={c.textoSuave} />
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
