/**
 * Paleta, letra y tamaños de la app (puro, sin react-native: lo leen las pruebas en Node). lib/ui.tsx los sigue
 * exportando tal cual, así que las pantallas no cambian sus imports.
 *
 * Dirección visual A, "estilo Uber" (elegida por el dueño el 2026-10-15; artboards de diseno-vg: Hoy, Reportar,
 * Tarjeta, Mi agenda y Agendar): negro y blanco, títulos fuertes (30/36, 700, −0,02 em), encabezado BLANCO con el
 * título grande (ya no la barra negra), botones negros a ancho completo de 52 pt, chips y botones secundarios
 * rellenos de #EEEEEE, filas con separadores finos (#EEEEEE), bloques #F6F6F6, radios 10 (botón, chip, campo), 12
 * (bloque, tarjeta) y 20 (la hoja sobre el mapa), y el estado "dentro" en verde #047857 sobre #E7F4EE. En modo
 * oscuro se invierte: fondo negro, texto blanco, acento blanco y los mismos papeles.
 *
 * `contraste(a, b)` es la fórmula de WCAG 2.x: las pruebas (scripts/checks/15-navegacion.ts y 20-estilo.ts) exigen
 * ≥ 4,5:1 para todo texto sobre los fondos donde va (1.4.3), ≥ 3:1 para el borde de los campos (1.4.11) y que lo
 * elegido (acento) se distinga de lo no elegido (relleno) a ≥ 3:1, en los dos modos.
 */

export interface Colores {
  /** Fondo de la pantalla (y del encabezado blanco). */
  fondo: string
  /** Tarjetas, la hoja sobre el mapa, la barra de pestañas y el pie fijo. */
  superficie: string
  /** Bloques destacados (#F6F6F6): "Compromiso pendiente", "Lo que dijiste", la cita ya reportada. */
  superficieSuave: string
  /** Relleno de chips, botones secundarios, botones de ícono y campos (#EEEEEE). */
  relleno: string
  texto: string
  textoSuave: string
  /** Texto de lo que no se puede tocar (días pasados, horas ocupadas). WCAG 1.4.3 no lo exige a 4,5:1. */
  textoInactivo: string
  /** Separadores de filas y borde de las tarjetas (decorativo: no tiene que llegar a 3:1). */
  borde: string
  /** Raya de arriba de la barra de pestañas y del pie fijo (#E6E6E6). */
  bordeFuerte: string
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
  /** Negro de marca en los dos modos: la portada (pantalla de inicio) y lo que va encima. */
  encabezado: string
  sobreEncabezado: string
  /** Borde de los campos de texto y del selector: ≥ 3:1 sobre la superficie y el fondo (WCAG 1.4.11). */
  bordeControl: string
  /** La agarradera de la hoja sobre el mapa. */
  agarradera: string
}

/** Claro: blanco y negro. Texto 21:1, texto secundario 6,6:1 sobre blanco y 5,8:1 sobre #EEEEEE; estados ≥ 4,8:1. */
export const COLORES_CLAROS: Colores = {
  fondo: '#FFFFFF',
  superficie: '#FFFFFF',
  superficieSuave: '#F6F6F6',
  relleno: '#EEEEEE',
  texto: '#000000',
  textoSuave: '#5C5B5B',
  textoInactivo: '#A3A3A3',
  borde: '#EEEEEE',
  bordeFuerte: '#E6E6E6',
  acento: '#000000',
  sobreAcento: '#FFFFFF',
  peligro: '#B91C1C',
  fondoPeligro: '#FDF0F0',
  exito: '#047857',
  fondoExito: '#E7F4EE',
  alerta: '#92400E',
  fondoAlerta: '#FFF6E5',
  info: '#1E40AF',
  fondoInfo: '#EEF3FE',
  encabezado: '#000000',
  sobreEncabezado: '#FFFFFF',
  bordeControl: '#8A8A8A',
  agarradera: '#D4D4D4',
}

/** Oscuro: fondo negro, superficies grises neutras (sin tinte azul) y acento blanco. Estados ≥ 8:1. */
export const COLORES_OSCUROS: Colores = {
  fondo: '#000000',
  superficie: '#161616',
  superficieSuave: '#1F1F1F',
  relleno: '#2C2C2C',
  texto: '#FFFFFF',
  textoSuave: '#A6A6A6',
  textoInactivo: '#666666',
  borde: '#2A2A2A',
  bordeFuerte: '#333333',
  acento: '#FFFFFF',
  sobreAcento: '#000000',
  peligro: '#FCA5A5',
  fondoPeligro: '#3A1414',
  exito: '#6EE7B7',
  fondoExito: '#0F2A22',
  alerta: '#FCD34D',
  fondoAlerta: '#33270B',
  info: '#93C5FD',
  fondoInfo: '#14223A',
  encabezado: '#000000',
  sobreEncabezado: '#FFFFFF',
  bordeControl: '#6B6B6B',
  agarradera: '#4A4A4A',
}

/**
 * Colores del croquis (components/Croquis.tsx): suelo y manzanas decorativas. El círculo del radio usa `exito` (borde)
 * y el mismo color al 8 % (relleno), para que se vean las manzanas debajo.
 */
export interface ColoresMapa {
  suelo: string
  manzana: string
}

export const MAPA_CLARO: ColoresMapa = { suelo: '#FFFFFF', manzana: '#ECEEF1' }
export const MAPA_OSCURO: ColoresMapa = { suelo: '#0B0B0C', manzana: '#1B1C1F' }

/**
 * Tamaños (en pt). Botón principal de 52 a ancho completo, todo lo que se toca ≥ 44 (ALTO_TOQUE_MIN), márgenes de
 * 20 a los lados como en los artboards.
 */
export const TAMANO = {
  /** Texto de lectura (nombres, valores). */
  texto: 16,
  /** Texto secundario (sede, detalle). */
  textoPeque: 14,
  /** Título de la pantalla (30/36). */
  titulo: 30,
  /** Título de un paso o de un bloque grande ("¿A qué hora?", el nombre de la cita): 20/26. */
  subtitulo: 20,
  /** Título de una sección ("Más citas de hoy", "Octubre 2026"): 17/22. */
  seccion: 17,
  /** Alto del botón (principal negro y secundario #EEEEEE). */
  boton: 52,
  /** Alto del botón grande (con una línea de detalle debajo). */
  botonGrande: 64,
  /** Radio de botones, chips, campos y botones de ícono. */
  radio: 10,
  /** Radio de tarjetas y bloques. */
  radioTarjeta: 12,
  /** Radio de arriba de la hoja sobre el mapa. */
  radioHoja: 20,
  /** Margen de los lados de la pantalla. */
  espacio: 20,
} as const

/** Escala de letra (tamaño / alto de línea / espaciado) de los artboards. */
export const LETRA = {
  titulo: { fontSize: 30, lineHeight: 36, letterSpacing: -0.6 },
  /** Título de una pantalla abierta con "Volver" (Agendar, Nuevo médico…): un poco menor, cabe junto a "Volver". */
  tituloPaso: { fontSize: 28, lineHeight: 34, letterSpacing: -0.56 },
  subtitulo: { fontSize: 20, lineHeight: 26, letterSpacing: -0.2 },
  seccion: { fontSize: 17, lineHeight: 22, letterSpacing: 0 },
  cuerpo: { fontSize: 16, lineHeight: 22, letterSpacing: 0 },
  peque: { fontSize: 14, lineHeight: 20, letterSpacing: 0 },
  etiqueta: { fontSize: 13, lineHeight: 16, letterSpacing: 0 },
  boton: { fontSize: 17, lineHeight: 22, letterSpacing: 0 },
} as const

/** Alto mínimo de todo lo que se toca (botón, chip, "Volver"): 44 pt, la guía de Apple. */
export const ALTO_TOQUE_MIN = 44

/** Tope del texto grande del sistema donde el espacio es fijo (insignias, chips de hora, días del calendario). */
export const MAX_ESCALA_TEXTO = 1.3

/** Sombras (boxShadow, iOS/Android/web): lo que flota sobre el mapa y la hoja que sube sobre él. */
export const SOMBRA = {
  flotante: '0px 2px 8px rgba(0, 0, 0, 0.16)',
  hoja: '0px -6px 24px rgba(0, 0, 0, 0.10)',
} as const

/** Canal sRGB (0..255) → lineal, como lo define WCAG 2.x. */
function canalLineal(canal: number): number {
  const s = canal / 255
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
}

/** Luminancia relativa (WCAG 2.x) de un color '#RRGGBB' o '#RGB'. Lanza si el texto no es un color así. */
export function luminancia(color: string): number {
  const hex = color.trim().replace(/^#/, '')
  const largo = /^[0-9a-f]{3}$/i.test(hex) ? hex.replace(/./g, d => d + d) : hex
  if (!/^[0-9a-f]{6}$/i.test(largo)) throw new Error(`Color no válido: ${color}`)
  const [r, g, b] = [0, 2, 4].map(i => canalLineal(parseInt(largo.slice(i, i + 2), 16)))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Razón de contraste WCAG entre dos colores (1 a 21; el orden no importa). */
export function contraste(a: string, b: string): number {
  const la = luminancia(a)
  const lb = luminancia(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}
