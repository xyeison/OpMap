// Estilo del mapa autorizado por el dueño el 2026-10-11 (ver CLAUDE.md, "Estética del Mapa").
// El COLOR de cada zona sale siempre de colorForZone (MapComponent.tsx): Ejecutivo Comercial en la
// vista por línea (con un tono por zona si cubre varias, ver zoneTint), zona en la vista de zonas.
// Aquí van opacidades, bordes, los colores fijos de los estados sin zona y el cálculo de tonos. Lo usan
// los polígonos, los puntos de IPS, las insignias y la leyenda.

// Borde de municipios y localidades: blanco, fino y semitransparente (nunca gris oscuro ni negro)
export const TERRITORY_BORDER_COLOR = '#ffffff'
export const TERRITORY_BORDER_WEIGHT = 0.6
export const TERRITORY_BORDER_OPACITY = 0.7

// Relleno con el color de la zona: con IPS objetivo (visitar) y de alcance (sin IPS hoy)
export const IPS_FILL_OPACITY = 0.55
export const REACH_FILL_OPACITY = 0.22
// Proporción alcance / IPS para el conflicto (la vacante tiene sus propias opacidades)
export const REACH_OPACITY_RATIO = REACH_FILL_OPACITY / IPS_FILL_OPACITY

// Hover (solo con cursor): más relleno y borde blanco más grueso
export const HOVER_FILL_BOOST = 0.15
export const HOVER_BORDER_WEIGHT = 1.5

// Resaltado desde la leyenda: el resto de grupos queda casi transparente
export const DIMMED_FILL_OPACITY = 0.08

// Filtro por Ejecutivo Comercial (o por zona en la vista de zonas): los territorios que quedan fuera
// del filtro se pintan como contexto gris muy claro con el borde blanco de siempre (sus IPS e
// insignias no se dibujan)
export const FILTERED_OUT_FILL_COLOR = '#f1f5f9'
export const FILTERED_OUT_FILL_OPACITY = 0.5

// Vacante en la línea (o territorio solo con IPS sin zona): relleno pizarra sólido, más fuerte en los
// municipios con IPS que en los de alcance de la zona vacante, y borde pizarra fino (no blanco) para que
// el bloque se lea como "hueco" a escala país. Sin rayado: el rayado es de "sin equipo".
export const VACANT_FILL_COLOR = '#94a3b8'
export const VACANT_FILL_OPACITY = 0.5
export const VACANT_REACH_FILL_OPACITY = 0.3
export const VACANT_BORDER_COLOR = '#64748b'
export const VACANT_BORDER_WEIGHT = 0.8
export const VACANT_BORDER_OPACITY = 1
// Puntos de IPS de una zona vacante en la línea (tamaño normal), más oscuros que el relleno
export const VACANT_STATE_COLOR = '#64748b'
// Insignia hueca de zona vacante (y racimo todo vacante): anillo y "—" de este color sobre blanco
export const VACANT_BADGE_COLOR = '#475569'

// Conflicto (varios Ejecutivos Comerciales locales en la zona)
export const CONFLICT_FILL_COLOR = '#f59e0b'
export const CONFLICT_FILL_OPACITY = 0.4

// Fuera de alcance: gris muy claro con borde discontinuo
export const OUT_OF_REACH_FILL_COLOR = '#e5e7eb'
export const OUT_OF_REACH_FILL_OPACITY = 0.5
export const OUT_OF_REACH_BORDER_COLOR = '#9ca3af'
export const OUT_OF_REACH_BORDER_WEIGHT = 0.8
export const OUT_OF_REACH_DASH = '3 3'

// Sin acceso terrestre: gris claro con trama de puntos (patrón SVG, ver NO_ROAD_PATTERN_ID)
export const NO_ROAD_FILL_COLOR = '#d1d5db'
export const NO_ROAD_FILL_OPACITY = 0.45
export const NO_ROAD_PATTERN_ID = 'opmap-sin-acceso-puntos'
export const NO_ROAD_DOT_COLOR = '#6b7280'

// Pendiente de calcular: casi blanco
export const PENDING_FILL_COLOR = '#ffffff'
export const PENDING_FILL_OPACITY = 0.3
export const PENDING_BORDER_COLOR = '#e5e7eb'

// Puntos de IPS
export const IPS_POINT_FILL_OPACITY = 0.95
export const IPS_POINT_BORDER_COLOR = '#ffffff'
export const IPS_POINT_BORDER_WEIGHT = 1.5
// IPS sin zona en la vista (incluye departamentos excluidos, p. ej. San Andrés): gris claro y punto
// pequeño, distinto del pizarra de las IPS de una zona vacante (esas sí tienen zona, falta quién la cubra)
export const IPS_UNZONED_COLOR = '#9ca3af'

// Racimo de insignias de zonas de varios Ejecutivos Comerciales (o varias zonas en la vista de zonas)
export const CLUSTER_NEUTRAL_COLOR = '#334155'

// ---------- Tonos por zona dentro de un mismo Ejecutivo Comercial (solo vista por línea) ----------
// Si un Ejecutivo Comercial cubre varias zonas en la línea, cada zona usa un tono de su color: misma
// tonalidad, luminosidad desplazada según su posición (zonas ordenadas por ciudad base). La primera
// zona conserva el color base. La vista de zonas y la de regiones no usan tonos.
const ZONE_TINT_L_SHIFTS = [0, 18, -16, 32, -26, 40, -34]
const ZONE_TINT_L_MIN = 26
const ZONE_TINT_L_MAX = 78
const ZONE_TINT_S_BOOST = 6
const ZONE_TINT_S_MAX = 95

const HEX6_RE = /^#[0-9a-fA-F]{6}$/

function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l * 100]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h: number
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0)
  else if (max === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4
  return [h * 60, s * 100, l * 100]
}

function hslToHex(h: number, s: number, l: number): string {
  const sat = s / 100
  const light = l / 100
  const a = sat * Math.min(light, 1 - light)
  const channel = (n: number) => {
    const k = (n + h / 30) % 12
    const c = light - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
    return Math.round(c * 255).toString(16).padStart(2, '0')
  }
  return `#${channel(0)}${channel(8)}${channel(4)}`
}

/**
 * Tono de la zona `index` (0..total-1) de un Ejecutivo Comercial con `total` zonas en la línea.
 * Desplaza la luminosidad según ZONE_TINT_L_SHIFTS (se repite si hay más de 7 zonas), la acota a
 * [26, 78] y, al aclarar, sube la saturación +6 (máx. 95) para que el tono no se lave. Con una sola
 * zona, o desplazamiento 0, devuelve el color base sin cambios. Solo acepta #RRGGBB.
 */
export function zoneTint(baseHex: string, index: number, total: number): string {
  if (!HEX6_RE.test(baseHex) || total <= 1) return baseHex
  const shift = ZONE_TINT_L_SHIFTS[((index % ZONE_TINT_L_SHIFTS.length) + ZONE_TINT_L_SHIFTS.length) % ZONE_TINT_L_SHIFTS.length]
  if (shift === 0) return baseHex
  const [h, s, l] = hexToHsl(baseHex)
  const light = Math.min(ZONE_TINT_L_MAX, Math.max(ZONE_TINT_L_MIN, l + shift))
  const sat = shift > 0 ? Math.min(ZONE_TINT_S_MAX, s + ZONE_TINT_S_BOOST) : s
  return hslToHex(h, sat, light)
}
