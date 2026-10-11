import L from 'leaflet'

// Pin de zona: insignia circular con las INICIALES de la ciudad base sobre el color de la vista
// (Ejecutivo Comercial en la línea, zona en la vista de zonas), anillo blanco, sombra suave y una
// punta corta. Se ancla en la punta para que el círculo quede por encima de la ciudad base y no tape
// los puntos de IPS que están justo en esa ubicación. Las zonas que se tocan en pantalla se dibujan
// como un "racimo" con el número de zonas (ZoneBadgeLayer.tsx).

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/

// Alto de la punta bajo el círculo (debe coincidir con .opmap-zone-badge__tail en globals.css)
export const ZONE_BADGE_TAIL_PX = 6

export const zoneBadgeHeight = (size: number) => size + ZONE_BADGE_TAIL_PX

export interface ZoneBadgeOptions {
  color: string
  size: number
  // Texto de la insignia (dos letras); en una zona vacante se muestra "—"
  text?: string
  // Tamaño de letra en px (12 en escritorio, 11 en móvil)
  textSize?: number
  // Zona vacante en la línea: insignia hueca (borde y texto del color, fondo blanco)
  hollow?: boolean
  // Nombre accesible del pin (lectores de pantalla); el icono de Leaflet es un botón sin texto
  label?: string
}

export interface ZoneClusterOptions {
  color: string
  size: number
  count: number
  textSize?: number
  // Todas las zonas del racimo están vacantes en la línea: racimo hueco, como sus insignias
  hollow?: boolean
  label?: string
}

const HTML_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
const escapeHtml = (v: string) => v.replace(/[&<>"']/g, c => HTML_ESCAPES[c]!)

// Un L.DivIcon por combinación: react-leaflet llama a setIcon cada vez que cambia la referencia.
// Con tope: la clave incluye los nombres de las zonas de cada racimo y crece al cambiar de línea.
const iconCache = new Map<string, L.DivIcon>()
const ICON_CACHE_MAX = 300

function badgeHtml(
  modifier: string,
  color: string,
  size: number,
  textColor: string,
  textSize: number,
  text: string,
  label: string
): string {
  return (
    `<div class="opmap-zone-badge${modifier}" style="--badge-color:${color};--badge-size:${size}px;--badge-text:${textColor};--badge-font:${textSize}px"` +
    (label ? ` role="img" aria-label="${escapeHtml(label)}">` : '>') +
    `<span class="opmap-zone-badge__circle"><span class="opmap-zone-badge__text" aria-hidden="true">${escapeHtml(text)}</span></span>` +
    '<span class="opmap-zone-badge__tail"></span>' +
    '</div>'
  )
}

function makeIcon(key: string, size: number, html: string): L.DivIcon {
  const cached = iconCache.get(key)
  if (cached) return cached
  const height = zoneBadgeHeight(size)
  const icon = L.divIcon({
    className: 'opmap-zone-badge-icon',
    html,
    iconSize: [size, height],
    iconAnchor: [size / 2, height],
    popupAnchor: [0, -height],
    tooltipAnchor: [0, -height + 2]
  })
  if (iconCache.size >= ICON_CACHE_MAX) iconCache.clear()
  iconCache.set(key, icon)
  return icon
}

export function zoneBadgeIcon({ color, size, text = '', textSize = 12, hollow = false, label = '' }: ZoneBadgeOptions): L.DivIcon {
  // Se interpola en HTML crudo: solo #RRGGBB
  const safe = HEX_COLOR_RE.test(color) ? color : '#888888'
  const shown = hollow ? '—' : (text || '—')
  const textColor = hollow ? safe : readableTextColor(safe)
  const key = `z|${safe}|${size}|${hollow ? 1 : 0}|${shown}|${textSize}|${label}`
  return makeIcon(key, size, badgeHtml(hollow ? ' opmap-zone-badge--hollow' : '', safe, size, textColor, textSize, shown, label))
}

// Racimo: varias zonas que se tocan en pantalla, con el número de zonas
export function zoneClusterIcon({ color, size, count, textSize = 13, hollow = false, label = '' }: ZoneClusterOptions): L.DivIcon {
  const safe = HEX_COLOR_RE.test(color) ? color : '#334155'
  const key = `c|${safe}|${size}|${count}|${textSize}|${hollow ? 1 : 0}|${label}`
  const modifier = hollow ? ' opmap-zone-badge--cluster opmap-zone-badge--hollow' : ' opmap-zone-badge--cluster'
  const textColor = hollow ? safe : readableTextColor(safe)
  return makeIcon(key, size, badgeHtml(modifier, safe, size, textColor, textSize, String(count), label))
}

// Partículas que no cuentan para las iniciales ("María de los Ángeles Pérez" → MP)
const NAME_PARTICLES = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'e', 'da', 'do', 'dos', 'van', 'von'])

// Dos letras para los chips de la leyenda: primera palabra + última palabra significativa
export function initialsOf(name?: string | null): string {
  const clean = (name ?? '')
    .replace(/\(.*?\)/g, ' ')
    .replace(/^\s*KAM\s+/i, '')
    .trim()
  const words = clean.split(/\s+/).filter(w => w && !NAME_PARTICLES.has(w.toLowerCase()))
  if (words.length === 0) return '—'
  if (words.length === 1) return words[0].slice(0, 2).toLocaleUpperCase('es')
  return (words[0][0] + words[words.length - 1][0]).toLocaleUpperCase('es')
}

// Forma corta de los nombres oficiales DANE: "Cartagena de Indias" → "Cartagena",
// "San José de Cúcuta" → "Cúcuta" (misma regla que el importador de visitas)
export function shortCityName(city?: string | null): string {
  return (city ?? '')
    .trim()
    .replace(/\s+de\s+indias$/i, '')
    .replace(/^san\s+jos[eé]\s+de\s+/i, '')
    .trim()
}

// Solo letras (las que tienen mayúscula y minúscula): descarta guiones, puntos y dígitos
const letters = (word: string) => Array.from(word).filter(ch => ch.toLowerCase() !== ch.toUpperCase())

// Iniciales de la ciudad base para la insignia: una palabra → "Ba" (Barranquilla), "Cú" (Cúcuta);
// varias → "SC" (San Cristóbal)
export function cityInitials(city?: string | null): string {
  const words = shortCityName(city).split(/\s+/).filter(w => w && !NAME_PARTICLES.has(w.toLowerCase()))
  if (words.length === 0) return '—'
  if (words.length === 1) {
    const chars = letters(words[0])
    if (chars.length === 0) return '—'
    return chars[0].toLocaleUpperCase('es') + (chars[1] ?? '').toLocaleLowerCase('es')
  }
  return (letters(words[0])[0] ?? '').toLocaleUpperCase('es') + (letters(words[words.length - 1])[0] ?? '').toLocaleUpperCase('es')
}

/**
 * Iniciales únicas por zona: si dos ciudades base dan las mismas ("Cali" y "Cartagena" → "Ca"), la
 * primera en orden alfabético conserva las suyas y la siguiente usa la inicial y la siguiente letra
 * libre de su nombre ("Cr"). Devuelve id → iniciales.
 */
export function uniqueCityInitials(zones: { id: string; city: string }[]): Record<string, string> {
  const result: Record<string, string> = {}
  const used = new Set<string>()
  const sorted = [...zones].sort((a, b) =>
    shortCityName(a.city).localeCompare(shortCityName(b.city), 'es') || a.id.localeCompare(b.id))
  for (const zone of sorted) {
    let text = cityInitials(zone.city)
    if (used.has(text.toLocaleLowerCase('es')) && text !== '—') {
      const chars = letters(shortCityName(zone.city))
      const first = (chars[0] ?? '').toLocaleUpperCase('es')
      for (const ch of chars.slice(1)) {
        const candidate = first + ch.toLocaleLowerCase('es')
        if (!used.has(candidate.toLocaleLowerCase('es'))) {
          text = candidate
          break
        }
      }
    }
    used.add(text.toLocaleLowerCase('es'))
    result[zone.id] = text
  }
  return result
}

// Texto oscuro de las insignias y chips sobre fondos claros
export const DARK_TEXT_COLOR = '#111827'

// Luminancia relativa WCAG de un #RRGGBB
function relativeLuminance(hex: string): number {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5)
}

const DARK_TEXT_LUMINANCE = relativeLuminance(DARK_TEXT_COLOR)

// Color de texto legible sobre un fondo #RRGGBB: el que dé MÁS contraste WCAG (blanco u oscuro). Con
// texto de 11-12 px los colores medios (verde, cian, coral) necesitan texto oscuro para pasar de 4,5:1.
export function readableTextColor(hex: string): string {
  if (!HEX_COLOR_RE.test(hex)) return '#ffffff'
  const l = relativeLuminance(hex)
  const contrastWithDark = (l + 0.05) / (DARK_TEXT_LUMINANCE + 0.05)
  const contrastWithWhite = 1.05 / (l + 0.05)
  return contrastWithDark > contrastWithWhite ? DARK_TEXT_COLOR : '#ffffff'
}
