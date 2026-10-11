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
  contributivo: '#2a78d6',
  subsidiado: '#eb6834',
  otros: '#9ca3af',
  total: '#2a78d6',
} as const

/**
 * Último giro: 'YYYY-MM-DD' (Identifica tu Giro) → '28/09/2026'; 'YYYY-MM' o 'YYYY-MM-01' de un mes de
 * proceso (Reporte 29) → 'jun-2025' si mensual=true. null → '—'.
 */
export function formatFechaGiro(value: string | null | undefined, mensual = false): string {
  if (!value) return '—'
  if (mensual || value.length === 7) return monthLabelFrom(value.slice(0, 7))
  const [y, m, d] = value.slice(0, 10).split('-')
  return d && m && y ? `${d}/${m}/${y}` : value
}

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
function monthLabelFrom(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  return m >= 1 && m <= 12 ? `${MESES_CORTOS[m - 1]}-${y}` : ym
}
