// Estilo del mapa autorizado por el dueño el 2026-10-11 (ver CLAUDE.md, "Estética del Mapa").
// El COLOR de cada zona sale siempre de colorForZone (MapComponent.tsx): Ejecutivo Comercial en la
// vista por línea, zona en la vista de zonas. Aquí solo van opacidades, bordes y los colores fijos de
// los estados sin zona. Lo usan los polígonos, los puntos de IPS, las insignias y la leyenda.

// Borde de municipios y localidades: blanco, fino y semitransparente (nunca gris oscuro ni negro)
export const TERRITORY_BORDER_COLOR = '#ffffff'
export const TERRITORY_BORDER_WEIGHT = 0.6
export const TERRITORY_BORDER_OPACITY = 0.7

// Relleno con el color de la zona: con IPS objetivo (visitar) y de alcance (sin IPS hoy)
export const IPS_FILL_OPACITY = 0.55
export const REACH_FILL_OPACITY = 0.22
// Proporción alcance / IPS para los estados con color fijo (vacante, conflicto)
export const REACH_OPACITY_RATIO = REACH_FILL_OPACITY / IPS_FILL_OPACITY

// Hover (solo con cursor): más relleno y borde blanco más grueso
export const HOVER_FILL_BOOST = 0.15
export const HOVER_BORDER_WEIGHT = 1.5

// Resaltado desde la leyenda: el resto de grupos queda casi transparente
export const DIMMED_FILL_OPACITY = 0.08

// Vacante en la línea (o territorio solo con IPS sin zona) y conflicto. El polígono usa el gris
// azulado claro; la insignia hueca y los puntos de IPS de una zona vacante usan VACANT_STATE_COLOR,
// un gris algo más oscuro para que se vean sobre ese polígono (es el mismo gris de las IPS sin zona;
// la leyenda los explica en una sola fila).
export const VACANT_STATE_COLOR = '#9ca3af'
export const VACANT_FILL_COLOR = '#cbd5e1'
export const VACANT_FILL_OPACITY = 0.35
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
// IPS sin zona en la vista (incluye departamentos excluidos, p. ej. San Andrés)
export const IPS_UNZONED_COLOR = VACANT_STATE_COLOR

// Racimo de insignias de zonas de varios Ejecutivos Comerciales (o varias zonas en la vista de zonas)
export const CLUSTER_NEUTRAL_COLOR = '#334155'
