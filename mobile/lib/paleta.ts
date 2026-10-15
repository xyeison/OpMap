/**
 * Paleta y tamaños de la app (puro, sin react-native: lo leen las pruebas en Node). lib/ui.tsx los sigue exportando
 * tal cual, así que las pantallas no cambian sus imports.
 *
 * Marca VG Medical (spec 2026-10-14, decisión 10): botón principal y encabezado negros, texto carbón #2E2D2D, texto
 * secundario gris #5C5B5B, fondo #F8F9FA y tarjetas blancas; en modo oscuro se invierten. Los colores de estado
 * (éxito, alerta, peligro, info) se quedan con contraste AA sobre esos fondos.
 *
 * `contraste(a, b)` es la fórmula de WCAG 2.x: las pruebas (sección 15 de scripts/movil-check.ts) exigen que el borde
 * de los controles dé ≥ 3:1 (WCAG 1.4.11, componentes) y el texto secundario ≥ 4,5:1 (1.4.3) en los dos modos.
 */

export interface Colores {
  fondo: string
  superficie: string
  superficieSuave: string
  texto: string
  textoSuave: string
  /** Borde suave de tarjetas y separadores (decorativo: no tiene que llegar a 3:1). */
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
  /** Encabezado de las pantallas (negro de marca en los dos modos) y el texto/íconos que van encima. */
  encabezado: string
  sobreEncabezado: string
  /** Borde de los controles (campo, chip inactivo, botón secundario): ≥ 3:1 sobre la superficie y el fondo. */
  bordeControl: string
}

/** Marca VG Medical. Contrastes (WCAG): texto 13:1 y texto secundario 6,4:1 sobre el fondo; estados ≥ 5,2:1. */
export const COLORES_CLAROS: Colores = {
  fondo: '#F8F9FA',
  superficie: '#FFFFFF',
  superficieSuave: '#EEEFF1',
  texto: '#2E2D2D',
  textoSuave: '#5C5B5B',
  borde: '#E2E3E5',
  acento: '#000000',
  sobreAcento: '#FFFFFF',
  peligro: '#B91C1C',
  fondoPeligro: '#FEF2F2',
  exito: '#047857',
  fondoExito: '#ECFDF5',
  alerta: '#92400E',
  fondoAlerta: '#FFFBEB',
  info: '#1E40AF',
  fondoInfo: '#EFF6FF',
  encabezado: '#000000',
  sobreEncabezado: '#FFFFFF',
  bordeControl: '#8A8A8A',
}

/** Modo oscuro monocromático: grises neutros (sin tinte azul) y acento blanco. Estados ≥ 8:1. */
export const COLORES_OSCUROS: Colores = {
  fondo: '#0A0A0A',
  superficie: '#161616',
  superficieSuave: '#222222',
  texto: '#EDEDED',
  textoSuave: '#A3A3A3',
  borde: '#2E2E2E',
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
}

/** Tamaños grandes para usar en la calle, con una mano: botones de 56 pt, texto de 17 pt. */
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

/** Alto mínimo de todo lo que se toca (botón, chip, "Volver"): 44 pt, la guía de Apple. */
export const ALTO_TOQUE_MIN = 44

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
