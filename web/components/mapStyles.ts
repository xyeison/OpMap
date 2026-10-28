// Estilo del mapa autorizado por el dueño el 2026-10-11 (ver CLAUDE.md, "Estética del Mapa").
// El COLOR de cada zona sale siempre de colorForZone (MapComponent.tsx): desde el 2026-10-28 es el color de la
// Zona (kams.color) en las dos vistas; en la vista por línea, los estados (sin cobertura, conflicto) mandan
// (colorDeZonaEnLinea, abajo). Aquí van opacidades, bordes, los colores fijos de los estados sin zona y esas
// reglas de color. Lo usan los polígonos, los puntos de IPS, las insignias y la leyenda.
//
// Autorizado por el dueño el 2026-10-23: en la vista por línea, las Zonas sin cobertura van en gris con un tono
// por Zona (grisDeZona, al final de este archivo). Nada más de la estética del 2026-10-11 cambia.
import { zoneDisplayName } from '@/lib/zone-names'

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

// Zona sin datos de cobertura (o que ya no está en el mapa): gris claro
export const NO_COVERAGE_DATA_COLOR = '#cccccc'

// ---------- Un solo color por Zona en las dos vistas (dueño, 2026-10-28) ----------
// "Porque los colores cambian para mapa de ejecutivo comerciales y Zonas. Deberia ser el mismo. Maneja el mismo
// color de Zonas." En la vista por línea, una Zona cubierta va con su propio color (kams.color), igual que en la vista
// de Zonas; los estados de la línea no cambian: sin cobertura en el gris de la Zona, conflicto en ámbar. Reemplaza a
// los tonos del color del Ejecutivo Comercial por zona (zoneTint, 2026-10-11), que se quitaron.

/** Color de una Zona en la vista por línea. `fila` es su fila de cobertura en la línea (undefined = sin datos). */
export function colorDeZonaEnLinea(
  fila: { kind: string; executive?: unknown } | null | undefined,
  colorDeLaZona: string | null | undefined,
  grisDeLaZona: () => string
): string {
  if (!fila) return NO_COVERAGE_DATA_COLOR
  if (fila.kind === 'vacant') return grisDeLaZona()
  if (fila.kind === 'conflict') return CONFLICT_FILL_COLOR
  if (!fila.executive) return grisDeLaZona()
  return colorDeLaZona || NO_COVERAGE_DATA_COLOR
}

/**
 * Chip de un Ejecutivo Comercial en la leyenda y el filtro de la vista por línea: el color de la Zona donde es local;
 * si no es local en ninguna, el de la primera de sus Zonas (`zonas` ya viene en orden de ciudad base); sin Zonas en
 * la línea, el gris de "sin datos".
 */
export function colorDeEjecutivoEnLinea(
  zonas: ReadonlyArray<{ kamId: string; kind: string }>,
  colorDeZona: (kamId: string) => string | null | undefined
): string {
  const elegida = zonas.find(zona => zona.kind === 'local') ?? zonas[0]
  return (elegida && colorDeZona(elegida.kamId)) || NO_COVERAGE_DATA_COLOR
}

/**
 * Color de un racimo de insignias: todas sin cobertura → el de la insignia hueca; todas del mismo color → ese
 * color; si no (Zonas de colores distintos, o mezcla con alguna sin cobertura) → neutro. Igual en las dos vistas.
 */
export function colorDeRacimo(miembros: ReadonlyArray<{ color: string; hollow: boolean }>): string {
  if (miembros.length > 0 && miembros.every(m => m.hollow)) return VACANT_BADGE_COLOR
  const primero = miembros[0]?.color.toLowerCase()
  const mismoColor = primero !== undefined && miembros.every(m => !m.hollow && m.color.toLowerCase() === primero)
  return mismoColor ? miembros[0].color : CLUSTER_NEUTRAL_COLOR
}

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

// ---------- Grises por Zona para "Sin cobertura" (solo vista por línea) ----------
// Autorizado por el dueño el 2026-10-23: en la vista por línea, las Zonas sin cobertura van en gris con un tono
// por Zona, para distinguirlas entre sí mientras las líderes redistribuyen las líneas ("vas a tener que manejar
// distintos tonos de grises"). Luminosidad en rampa de 42 % a 80 % sobre las Zonas recibidas (las activas)
// ordenadas por nombre visible (zoneDisplayName, localeCompare 'es'), saturación 8 % y el matiz del color propio
// de la Zona (si falta o no es #RRGGBB, matiz 160). Con una sola Zona, luminosidad 61 %. Relleno, IPS e insignia
// hueca usan este gris; el borde sigue como hoy (VACANT_BORDER_*). Nada más de la estética cambia.
const GRIS_ZONA_L_MIN = 42
const GRIS_ZONA_L_MAX = 80
const GRIS_ZONA_S = 8
const GRIS_ZONA_HUE_DEFAULT = 160

/**
 * Gris de la Zona `kamId` entre `zonas` (las Zonas activas, en cualquier orden): `hsl(h, 8%, L%)` con h y L
 * redondeados. Determinista: la misma Zona da el mismo valor sea cual sea el orden de entrada. Si `kamId` no está
 * en `zonas`, devuelve el gris medio (L 61 %) con el matiz por defecto.
 */
export function grisDeZona(kamId: string, zonas: ReadonlyArray<{ id: string; name: string; color?: string | null }>): string {
  const ordenadas = [...zonas].sort(
    (a, b) =>
      zoneDisplayName(a.name).localeCompare(zoneDisplayName(b.name), 'es', { sensitivity: 'base' }) ||
      a.id.localeCompare(b.id)
  )
  const total = ordenadas.length
  const index = ordenadas.findIndex(zone => zone.id === kamId)
  const lightness =
    total <= 1 || index < 0
      ? (GRIS_ZONA_L_MIN + GRIS_ZONA_L_MAX) / 2
      : GRIS_ZONA_L_MIN + ((GRIS_ZONA_L_MAX - GRIS_ZONA_L_MIN) * index) / (total - 1)
  const color = index >= 0 ? ordenadas[index].color ?? null : null
  const hue = color && HEX6_RE.test(color) ? hexToHsl(color)[0] : GRIS_ZONA_HUE_DEFAULT
  return `hsl(${Math.round(hue)}, ${GRIS_ZONA_S}%, ${Math.round(lightness)}%)`
}
