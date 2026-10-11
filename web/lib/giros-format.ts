// Formato de pesos y meses para la UI de giros ADRES (puro; sirve en cliente y servidor).
export { monthLabel } from './adres-parse.mjs'

const copFull = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 })
/** Espacio que no se parte: el "$" nunca queda solo en una línea. */
const NBSP = '\u00a0'

/** $ 26.390.565.824 */
export function formatCop(value: number): string {
  return `$${NBSP}${copFull.format(Math.round(value || 0))}`
}

/** $ 26,4 mil M · $ 2.201 M · $ 950.000 (para ejes y tarjetas). */
export function formatCopCompact(value: number): string {
  const v = value || 0
  const abs = Math.abs(v)
  if (abs >= 1e9) return `$${NBSP}${(v / 1e9).toLocaleString('es-CO', { maximumFractionDigits: 1 })}${NBSP}mil${NBSP}M`
  if (abs >= 1e6) return `$${NBSP}${(v / 1e6).toLocaleString('es-CO', { maximumFractionDigits: 0 })}${NBSP}M`
  return formatCop(v)
}

/** 12,5 % */
export function formatPct(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  return `${value.toLocaleString('es-CO', { maximumFractionDigits: 1 })}${NBSP}%`
}

/** Colores de la serie mensual (paleta categórica validada: azul y naranja; gris neutro para "otros"). */
export const GIROS_COLORS = {
  capitacion: '#2a78d6',
  evento: '#eb6834',
  otros: '#9ca3af',
  total: '#2a78d6',
} as const
