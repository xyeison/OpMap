'use client'

import { MapContainer, TileLayer, GeoJSON, CircleMarker, Tooltip, ZoomControl, AttributionControl, Pane } from 'react-leaflet'
import { useQueries, useQuery } from '@tanstack/react-query'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { VisitsHeatmapLayer } from './VisitsHeatmapLayer'
import { formatTravelTimeFromSeconds } from '@/lib/format-utils'
import MapControls, { type MapMostrarConfig, type VerSoloResumen } from './MapControls'
import { EMPTY_IPS_FILTER, isIpsFilterActive, matchesIpsFilter, type IpsServiceFilter } from '@/lib/hospital-service-filters'
import MapController, { DeptosEnVista, ZoomGate } from './MapController'
import HospitalMarker, { UnassignedHospitalMarker, IpsZoomLayer, formatZoneExecutives, ipsRadius, IPS_FULL_SIZE_ZOOM, type HospitalSelectHandler, type ZoneExecutive } from './HospitalMarker'
import MapLegend, { MapLegendCard, type LegendNote, type LegendState } from './MapLegend'
import type { MapVistaConfig } from './MapVista'
import MapBottomSheet, { SHEET_PEEK_PX, type SheetSnap } from './MapBottomSheet'
import {
  MapPopup,
  IpsPopupCard,
  UnassignedPopupCard,
  ZonePopupCard,
  ClusterPopupCard,
  TerritoryPopupCard,
  type IpsPopupData,
  type UnassignedPopupData,
  type ZonePopupData,
  type ClusterPopupData,
  type PopupAction,
  type TerritoryInfo,
  type GirosComprasProps
} from './MapPopups'
import { textoSinIps } from '@/lib/mapa-detalle'
import type { IpsDetalle, TerritorioDetalle } from '@/lib/types/mapa-detalle'
import { zoneBadgeHeight, initialsOf, uniqueCityInitials, shortCityName, readableTextColor } from './ZoneBadgeIcon'
import ZoneBadgeLayer, { type ZoneBadgeItem } from './ZoneBadgeLayer'
import MapLabelsLayer from './MapLabelsLayer'
import MapSearchBox from './MapSearchBox'
import { groupFilterChipLabel, selectedOptionIds, type GroupFilterConfig, type GroupFilterOption } from './MapGroupFilter'
import {
  TERRITORY_BORDER_COLOR,
  TERRITORY_BORDER_WEIGHT,
  TERRITORY_BORDER_OPACITY,
  IPS_FILL_OPACITY,
  REACH_FILL_OPACITY,
  REACH_OPACITY_RATIO,
  HOVER_FILL_BOOST,
  HOVER_BORDER_WEIGHT,
  DIMMED_FILL_OPACITY,
  VACANT_FILL_COLOR,
  VACANT_FILL_OPACITY,
  VACANT_REACH_FILL_OPACITY,
  VACANT_BORDER_COLOR,
  VACANT_BORDER_WEIGHT,
  VACANT_BORDER_OPACITY,
  CONFLICT_FILL_COLOR,
  CONFLICT_FILL_OPACITY,
  OUT_OF_REACH_FILL_COLOR,
  OUT_OF_REACH_FILL_OPACITY,
  OUT_OF_REACH_BORDER_COLOR,
  OUT_OF_REACH_BORDER_WEIGHT,
  OUT_OF_REACH_DASH,
  NO_ROAD_FILL_COLOR,
  NO_ROAD_FILL_OPACITY,
  NO_ROAD_PATTERN_ID,
  NO_ROAD_DOT_COLOR,
  PENDING_FILL_COLOR,
  PENDING_FILL_OPACITY,
  PENDING_BORDER_COLOR,
  IPS_UNZONED_COLOR,
  CLUSTER_NEUTRAL_COLOR,
  VACANT_STATE_COLOR,
  NO_COVERAGE_DATA_COLOR,
  colorDeZonaEnLinea,
  colorDeEjecutivoEnLinea,
  grisDeZona
} from './mapStyles'
import { useMediaQuery, matchesMediaQuery, MOBILE_QUERY, HOVER_QUERY } from './useMediaQuery'
import { usePermissions } from '@/hooks/usePermissions'
import { bogotaSectorInitials, zoneDisplayName } from '@/lib/zone-names'
import { mapDataPlaceholder } from '@/lib/map-view'
import { computeTerritoryWinners, mayoriaAsignada, territoryIdOf, zonaDeLocalidadSinIps } from '@/lib/territory-rules'
import { CORREDOR_LABEL, isCorredor, type LocalidadPorCorredor } from '@/lib/bogota-corredores'
import { geometriasDeTerritorio, rectanguloDeGeometrias, territoriosBuscables, type TerritorioBuscable } from '@/lib/buscar-territorios'
import { DEPTO_LOCALIDADES, combinarDetalle, detalleVigente, loteDetalle, porDepto, rectangulosPorDepto, siguientesDeptos, urlDetalle } from '@/lib/geo-detalle'
// NO usar estimaciones - solo datos reales de Google Maps

// Fix for default markers in Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// Mapa base configurable. CARTO ya no sirve tiles sin API key (devuelve un PNG "API KEY REQUIRED"
// con HTTP 200), así que por defecto se usa Esri World Light Gray Base, de estética clara similar.
const DEFAULT_BASEMAP_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}'
const BASEMAP_URL = process.env.NEXT_PUBLIC_BASEMAP_URL || DEFAULT_BASEMAP_URL
const BASEMAP_ATTRIBUTION = process.env.NEXT_PUBLIC_BASEMAP_ATTRIBUTION || 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ'
// Atribución corta para móvil (sin el prefijo de Leaflet). Con un mapa base propio se respeta su texto.
const COMPACT_ATTRIBUTION = process.env.NEXT_PUBLIC_BASEMAP_ATTRIBUTION ||
  (BASEMAP_URL === DEFAULT_BASEMAP_URL ? '&copy; Esri &middot; Leaflet' : BASEMAP_ATTRIBUTION)
// El servicio de Esri solo tiene tiles nativos hasta z16; por encima se reescalan en vez de fallar
const BASEMAP_MAX_NATIVE_ZOOM = BASEMAP_URL === DEFAULT_BASEMAP_URL ? 16 : undefined
// Capa de nombres (ciudades, departamentos) encima de los polígonos: la de referencia de Esri Light Gray
// cuando se usa el mapa base por defecto, o la de NEXT_PUBLIC_BASEMAP_LABELS_URL si se configura.
const DEFAULT_LABELS_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}'
const LABELS_URL = process.env.NEXT_PUBLIC_BASEMAP_LABELS_URL ||
  (BASEMAP_URL === DEFAULT_BASEMAP_URL ? DEFAULT_LABELS_URL : null)
const LABELS_MAX_NATIVE_ZOOM = LABELS_URL === DEFAULT_LABELS_URL ? 16 : undefined

// Escapa cualquier valor antes de interpolarlo en HTML construido con template strings
// (tooltips de Leaflet, divIcon). Evita XSS con datos editables como nombres de proveedor.
const HTML_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
const escapeHtml = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, c => HTML_ESCAPES[c]!)

// Solo se aceptan colores hexadecimales de 6 dígitos (#RRGGBB); cualquier otro valor usa el respaldo
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/
const isSafeColor = (v: unknown): v is string => typeof v === 'string' && HEX_COLOR_RE.test(v)
const safeColor = (v: unknown, fallback = '#888888') => (isSafeColor(v) ? v : fallback)

// grisDeZona (mapStyles) devuelve `hsl(h, s%, l%)`; aquí todo lo que pinta (safeColor, hexToRgba, los patrones SVG
// de "sin equipo", readableTextColor) espera #RRGGBB, así que el gris se convierte una sola vez en la frontera.
// Si el texto no es un hsl() válido, cae al pizarra de siempre.
const hslCssToHex = (css: string): string => {
  const match = /^hsl\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*\)$/i.exec(css)
  if (!match) return isSafeColor(css) ? css : VACANT_FILL_COLOR
  const h = Number(match[1])
  const s = Number(match[2]) / 100
  const l = Number(match[3]) / 100
  const a = s * Math.min(l, 1 - l)
  const channel = (n: number) => {
    const k = (n + h / 30) % 12
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
    return Math.round(c * 255).toString(16).padStart(2, '0')
  }
  return `#${channel(0)}${channel(8)}${channel(4)}`
}

// #RRGGBB + opacidad → rgba() para las muestras de la leyenda
const hexToRgba = (hex: string, alpha: number) => {
  const safe = safeColor(hex)
  const r = parseInt(safe.slice(1, 3), 16)
  const g = parseInt(safe.slice(3, 5), 16)
  const b = parseInt(safe.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

// Error HTTP de /api/map/data (y de /api/map/detalle/*) con el código de estado, para distinguir sesión caducada (401)
class MapDataError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

// Colores de respaldo para zonas sin color definido en la base de datos
const BACKUP_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57',
  '#FF9FF3', '#54A0FF', '#8B4513', '#1DD1A1', '#FF7675',
  '#A29BFE', '#FD79A8', '#FDCB6E', '#6C5CE7', '#00D2D3',
  '#2ECC71', '#E74C3C', '#3498DB', '#F39C12', '#9B59B6'
]

// ---------- Mapa por línea de negocio (Fase 2) ----------

// Línea que el usuario puede ver (forma de /api/me/lines)
export interface MapLine {
  id: string
  code: string
  name: string
  role: 'leader' | 'executive' | 'all'
}

// 'line': cobertura de la línea elegida (quién cubre cada zona); desde el 2026-10-28 cada zona cubierta va con su color
// (kams.color) y los estados de la línea (sin cobertura, conflicto) con los suyos.
// 'zones': colores por zona (kams.color). Desde el 2026-10-14 la abre todo el que ve el mapa ("Ver por" de Filtros → Vista).
export type MapMode = 'line' | 'zones'

export type CoverageKind = 'local' | 'reach' | 'manual' | 'vacant' | 'conflict'

export interface CoverageExecutive {
  id: string
  full_name: string
  status: string
  color: string | null
}

// Fila de cobertura (misma forma que GET /api/coverage, más override_reason)
export interface CoverageRow {
  kam_id: string
  zone_name: string
  base_city: string | null
  kind: CoverageKind
  executive: CoverageExecutive | null
  travel_minutes: number | null
  source_kam_id: string | null
  nearest: { executive_id: string; full_name: string; minutes: number | null } | null
  has_equipment: boolean
  note: string | null
  override_reason?: string | null
}

// Colores fijos del modo por línea. VACANT_COLOR (pizarra) queda como respaldo y para los patrones SVG; desde el
// 2026-10-23 una Zona SIN COBERTURA en la línea (relleno, IPS, insignia hueca, tarjeta) usa el gris propio de la
// Zona (grisZona, abajo). El "IPS sin Zona" sigue en pizarra.
export const VACANT_COLOR = VACANT_STATE_COLOR
export const CONFLICT_COLOR = '#f59e0b'

// Patrón rayado de "sin equipo": un <pattern> SVG por color (id derivado del hex ya validado)
const noEquipmentPatternId = (hex: string) => `opmap-sin-equipo-${hex.slice(1).toLowerCase()}`

// 135 → "2 h 15"; 45 → "45 min"
export const formatMinutes = (minutes: number | null | undefined): string => {
  if (minutes === null || minutes === undefined || !Number.isFinite(minutes)) return 'tiempo sin calcular'
  const m = Math.round(minutes)
  if (m < 60) return `${m} min`
  return `${Math.floor(m / 60)} h ${m % 60}`
}

const executiveName = (e: { full_name: string; status?: string } | null | undefined) =>
  e ? (e.status === 'placeholder' ? `${e.full_name} (por contratar)` : e.full_name) : ''

/**
 * Texto plano de quién cubre la zona en la línea. Quien lo inserte en HTML crudo debe escaparlo.
 * "La atiende <nombre>, que vive en la Zona" | "La atiende <nombre> desde <zona>, a 2 h 26 por carretera" |
 * "La atiende <nombre> por ajuste manual: <motivo>" |
 * "Sin cobertura: nadie que lleve esta línea llega dentro del tope; la más cercana es <nombre>, a 12 h 2" | "Conflicto: <nombres>"
 * ("Sin cobertura", no "Vacante": la vacante es la persona por contratar; decisión del dueño 2026-10-23. Lenguaje llano,
 * como en la página Zonas: la Zona a la que pertenece la IPS es geografía; quién la atiende depende de la línea.)
 */
export const describeCoverage = (row: CoverageRow | undefined, zoneNameById: Record<string, string>): string => {
  if (!row) return 'sin datos de cobertura (recalcular cobertura)'
  switch (row.kind) {
    case 'local':
      return `La atiende ${executiveName(row.executive)}, que vive en la Zona`
    case 'reach': {
      const from = zoneDisplayName(row.source_kam_id ? zoneNameById[row.source_kam_id] : '') || 'otra zona'
      // Minutos = tiempo típico entre las dos ciudades (mediana zona→zona), no el tiempo a una IPS concreta: así no se
      // confunde con el "Tiempo de llegada" de la tarjeta de IPS
      return `La atiende ${executiveName(row.executive)} desde ${from}, a ${formatMinutes(row.travel_minutes)} por carretera`
    }
    case 'manual':
      return `La atiende ${executiveName(row.executive)} por ajuste manual: ${row.override_reason || row.note || 'sin motivo registrado'}`
    case 'vacant':
      return row.nearest
        ? `Sin cobertura: nadie que lleve esta línea llega dentro del tope de alcance; la más cercana es ${row.nearest.full_name}, a ${formatMinutes(row.nearest.minutes)}`
        : 'Sin cobertura: nadie lleva esta línea'
    case 'conflict':
      return `Conflicto: ${row.note || 'varios Ejecutivos Comerciales locales'}`
    default:
      return 'sin datos de cobertura'
  }
}

// ---------- Capa completa de municipios y localidades (Fase 2b) ----------

// Polígonos estáticos generados por scripts/build-geojson.ts (properties = { code, name, dept }).
// Se descargan una sola vez; el navegador los revalida con ETag (sin las ~163 peticiones a /api/geojson).
const GEO_MUNICIPIOS_URL = '/geo/municipios.json'
const GEO_LOCALIDADES_URL = '/geo/localidades.json'

// Tipo de municipio según municipality_zone (contrato de GET /api/municipality-coverage)
export type MunicipalityKind = 'ips' | 'reach' | 'out_of_reach' | 'no_road' | 'pending'

export interface MunicipalityZoneRow {
  code: string
  name: string
  department_code: string
  kam_id: string | null
  kind: MunicipalityKind
  travel_minutes: number | null
  nearest_kam_id: string | null
  nearest_minutes: number | null
  ips_count: number
}

// Cómo se pinta cada polígono. 'vacant' = solo IPS sin asignar (gris azulado claro, como las vacantes).
type TerritoryKind = 'ips' | 'vacant' | 'reach' | 'out_of_reach' | 'no_road' | 'pending'

interface ResolvedTerritory {
  kind: TerritoryKind
  kamId?: string
  isVacant: boolean
  row?: MunicipalityZoneRow
  // Localidad de Bogotá sin IPS ni zona residente: la celda de su corredor de salida (`corredor`) o, si no tiene,
  // hereda como alcance la zona que gana Bogotá (`bogotaInherited`)
  corredor?: string
  bogotaInherited?: boolean
}

// GET /api/municipality-coverage: filas de municipality_zone y celda de las localidades de Bogotá sin IPS por corredor
interface MunicipalityCoverage {
  rows: MunicipalityZoneRow[]
  localidades: Record<string, LocalidadPorCorredor>
}
const EMPTY_MUNICIPALITY_COVERAGE: MunicipalityCoverage = { rows: [], localidades: {} }

const corredorLabel = (corredor: string | undefined): string | null =>
  isCorredor(corredor) ? CORREDOR_LABEL[corredor] : null


// Leyenda de la capa de municipios
export interface TerritoryLegend {
  ips: number
  reach: number
  outOfReach: number
  noRoad: number
  pending: number
  // GET /api/municipality-coverage aún sin filas (antes de aplicar 0500 y correr el script)
  noMunicipalityData: boolean
  // /geo/*.json no se pudo cargar
  geoError: boolean
}

// ---------- Presentación del mapa ----------

const DEFAULT_CENTER: L.LatLngTuple = [4.5709, -74.2973]
// Panel propio para el rayado "sin equipo" (SVG): por debajo del canvas de territorios e IPS
const HATCH_PANE = 'opmapHatch'
// Trama de puntos de "sin acceso terrestre" (SVG, sin eventos): justo encima del canvas de territorios.
// Esos municipios no tienen IPS, así que la trama no tapa puntos.
const NO_ROAD_PANE = 'opmapNoRoad'
// Nombres de lugares: encima de los polígonos, debajo de los puntos de IPS y de las insignias; no
// recibe toques
const LABELS_PANE = 'labels'
const LABELS_PANE_Z = 450
// Puntos de IPS: SVG en su propio panel, por encima de los nombres. El panel no recibe eventos; solo
// los círculos (leaflet-interactive), así los polígonos de debajo siguen respondiendo al toque.
const IPS_PANE = 'opmapIps'
const IPS_PANE_Z = 460
// Código DANE de Bogotá en municipality_zone (guarda el ganador global de las localidades)
const BOGOTA_CODE = '11001'
// Ancho que ocupa la leyenda flotante de escritorio (300 px + margen): al acercar a un racimo se deja libre
const LEGEND_INSET_PX = 316
// Zoom mínimo de los puntos de IPS en móvil (compactos en zoom 5) y de los marcadores de visitas
const MOBILE_IPS_MIN_ZOOM = 5
const VISIT_MARKERS_MIN_ZOOM = 10

const HEAT_GRADIENT: Record<number, string> = {
  0.0: 'blue',
  0.25: 'cyan',
  0.5: 'lime',
  0.75: 'yellow',
  0.85: 'orange',
  1.0: 'red'
}

// Muestras de la leyenda (mismos colores y opacidades que los polígonos). Los polígonos llevan borde
// blanco; sobre la tarjeta blanca de la leyenda ese borde se sugiere con un contorno gris muy tenue.
const SWATCH_OUTLINE = 'rgba(15, 23, 42, 0.12)'
const swatch = (fill: string, fillOpacity: number, border = SWATCH_OUTLINE, dashed = false): CSSProperties => ({
  backgroundColor: hexToRgba(fill, fillOpacity),
  border: `1px ${dashed ? 'dashed' : 'solid'} ${border}`
})
// Muestra neutra para "con IPS" / "de alcance" (el color real es el de cada Ejecutivo Comercial o zona)
const LEGEND_NEUTRAL_FILL = '#475569'
const NO_EQUIPMENT_SWATCH: CSSProperties = {
  border: `1px solid ${SWATCH_OUTLINE}`,
  backgroundColor: 'rgba(71, 85, 105, 0.12)',
  backgroundImage: 'repeating-linear-gradient(45deg, rgba(71, 85, 105, 0.6) 0 3px, transparent 3px 8px)'
}
const NO_ROAD_SWATCH: CSSProperties = {
  ...swatch(NO_ROAD_FILL_COLOR, NO_ROAD_FILL_OPACITY),
  backgroundImage: `radial-gradient(${hexToRgba(NO_ROAD_DOT_COLOR, 0.7)} 0.9px, transparent 1.1px)`,
  backgroundSize: '4px 4px'
}

// Capa SVG de la trama de puntos: solo relleno con el patrón (el borde y el gris los pinta el canvas)
const NO_ROAD_OVERLAY_STYLE: L.PathOptions = { stroke: false, fillColor: `url(#${NO_ROAD_PATTERN_ID})`, fillOpacity: 1 }

const HOSPITAL_TYPE_LABELS: Record<string, string> = { Publico: 'Pública', Privada: 'Privada', Mixta: 'Mixta' }

// Tarjeta abierta en el mapa (una a la vez)
type PopupTarget =
  | { kind: 'ips'; id: string; position: L.LatLngTuple }
  | { kind: 'unassigned'; id: string; position: L.LatLngTuple }
  | { kind: 'zone'; id: string; position: L.LatLngTuple }
  | { kind: 'cluster'; ids: string[]; position: L.LatLngTuple }
  | { kind: 'territory'; code: string; isLocality: boolean; name: string; position: L.LatLngTuple }
type ActivePopup = PopupTarget & { nonce: number }

// Contexto vigente para los manejadores de los polígonos (estables: leen de una referencia)
interface TerritoryContext {
  canHover: boolean
  isHidden: (code: string, isLocality: boolean) => boolean
  tooltip: (code: string, isLocality: boolean, featureName: string) => string
  rest: (code: string, isLocality: boolean) => L.PathOptions
  hover: (code: string, isLocality: boolean) => L.PathOptions
  open: (code: string, isLocality: boolean, featureName: string, latlng: L.LatLng) => void
}

interface MapComponentProps {
  visits?: any[]
  showHeatmap?: boolean
  showMarkers?: boolean
  // Mapa por línea
  lines?: MapLine[]
  selectedLineCode?: string | null
  onLineChange?: (code: string) => void
  canSeeAllLines?: boolean
  mapMode?: MapMode
  onMapModeChange?: (mode: MapMode) => void
  // Filtro del mapa (URL ?exec= en la vista por línea, ?zones= en la vista de zonas): ids de
  // Ejecutivos Comerciales o de zonas (kam_id). null = sin filtro; [] = ninguno marcado.
  filterIds?: string[] | null
  onFilterIdsChange?: (ids: string[] | null) => void
}

export default function MapComponent({
  visits: initialVisits = [],
  showHeatmap: initialShowHeatmap = false,
  showMarkers: initialShowMarkers = false,
  lines = [],
  selectedLineCode = null,
  onLineChange,
  canSeeAllLines = false,
  mapMode = 'line',
  onMapModeChange,
  filterIds = null,
  onFilterIdsChange
}: MapComponentProps) {
  const router = useRouter()
  const { can } = usePermissions()

  // Teléfono (hoja inferior, cabecera compacta) y dispositivo con cursor (tooltips al pasar el cursor)
  const isMobile = useMediaQuery(MOBILE_QUERY)
  const canHover = useMediaQuery(HOVER_QUERY)
  // Leaflet solo lee estas opciones al crear el mapa
  const [initialZoom] = useState(() => (matchesMediaQuery(MOBILE_QUERY) ? 5 : 6))
  // Canvas para territorios y visitas (las IPS van en su propio panel SVG, ver IPS_PANE). En táctil,
  // tolerancia amplia para acertar a los marcadores de visitas.
  const [vectorRenderer] = useState(() => L.canvas({ padding: 0.5, tolerance: matchesMediaQuery(HOVER_QUERY) ? 2 : 10 }))
  // Rayado "sin equipo": SVG (el patrón url(#...) no existe en canvas) en su propio panel
  const [hatchRenderer] = useState(() => L.svg({ padding: 0.5, pane: HATCH_PANE }))
  // Trama de puntos "sin acceso terrestre": SVG en un panel por encima del canvas de territorios
  const [noRoadRenderer] = useState(() => L.svg({ padding: 0.5, pane: NO_ROAD_PANE }))
  // Puntos de IPS: SVG en un panel por encima de los nombres de lugares (ver IPS_PANE)
  const [ipsRenderer] = useState(() => L.svg({ padding: 0.5, pane: IPS_PANE }))
  const mapRef = useRef<L.Map | null>(null)
  // Leyenda de escritorio plegada: al acercar a un racimo no se reserva su ancho
  const [legendCollapsed, setLegendCollapsed] = useState(false)

  const [unassignedTravelTimes, setUnassignedTravelTimes] = useState<Record<string, any[]>>({})
  const [hospitalTypeFilter, setHospitalTypeFilter] = useState<string>('all') // 'all', 'Publico', 'Privada', 'Mixta'
  const [visits, setVisits] = useState(initialVisits)
  const [showHeatmap, setShowHeatmap] = useState(initialShowHeatmap)
  const [showMarkers, setShowMarkers] = useState(initialShowMarkers)
  // Fase 3: bloque "IPS" de Filtros (quirófano, ortopedia, neurocirugía, columna, camas); solo oculta puntos
  const [ipsServiceFilter, setIpsServiceFilter] = useState<IpsServiceFilter>(EMPTY_IPS_FILTER)

  // Capas visibles (Filtros › Mostrar). Las visitas arrancan apagadas.
  const [showIps, setShowIps] = useState(true)
  const [showReach, setShowReach] = useState(true)
  const [visitsEnabled, setVisitsEnabled] = useState(false)
  const [sheetSnap, setSheetSnap] = useState<SheetSnap>('peek')
  // Cada toque en "Filtros" de la hoja inferior abre la pestaña de filtros
  const [filtersTabRequest, setFiltersTabRequest] = useState(0)
  // "Mostrar vacantes" elegido a mano, válido solo para el estado del filtro en que se eligió (con
  // filtro / sin filtro); si no, por defecto: sí sin filtro, no con filtro
  const [vacantPref, setVacantPref] = useState<{ filtered: boolean; value: boolean } | null>(null)
  const [activePopup, setActivePopup] = useState<ActivePopup | null>(null)
  const popupNonceRef = useRef(0)

  // Cargar datos desde el API
  const { data: mapData, isLoading, isError, error: mapDataError, refetch, isFetching } = useQuery({
    queryKey: ['map-data', selectedLineCode],
    queryFn: async () => {
      // Con línea elegida la respuesta incluye la cobertura de esa línea (coverage + executives)
      const url = selectedLineCode
        ? `/api/map/data?line=${encodeURIComponent(selectedLineCode)}`
        : '/api/map/data'
      const response = await fetch(url)
      if (!response.ok) {
        throw new MapDataError('Error al cargar datos del mapa', response.status)
      }
      return response.json()
    },
    // Al cambiar de línea se conserva el mapa anterior mientras llega la nueva cobertura; no al pasar de la vista de
    // zonas abierta sin línea a "Ejecutivos Comerciales" (lib/map-view.ts: sale "Cargando mapa...")
    placeholderData: previous => mapDataPlaceholder(previous, selectedLineCode),
    // Con sesión caducada (401) o sin acceso a la línea (403) no tiene sentido reintentar
    retry: (failureCount, error) =>
      !(error instanceof MapDataError && (error.status === 401 || error.status === 403)) && failureCount < 2
  })

  const isUnauthorized = mapDataError instanceof MapDataError && mapDataError.status === 401

  // Sesión caducada o inexistente: llevar al login
  useEffect(() => {
    if (isUnauthorized) {
      router.replace('/login')
    }
  }, [isUnauthorized, router])

  // Aviso no bloqueante si el proveedor del mapa base falla (se registra una sola vez)
  const [basemapError, setBasemapError] = useState(false)
  const basemapErrorLogged = useRef(false)
  const handleTileError = () => {
    if (basemapErrorLogged.current) return
    basemapErrorLogged.current = true
    console.error('No se pudo cargar el mapa base desde', BASEMAP_URL)
    setBasemapError(true)
  }

  // Colores de las zonas desde la base de datos (solo #RRGGBB válidos; si no, uno de respaldo)
  const kamColors = useMemo(() => {
    const colors: Record<string, string> = {}
    let backupIdx = 0
    ;(mapData?.kams || []).forEach((kam: any) => {
      if (isSafeColor(kam.color)) {
        colors[kam.id] = kam.color
      } else {
        colors[kam.id] = BACKUP_COLORS[backupIdx % BACKUP_COLORS.length]
        backupIdx++
      }
    })
    return colors
  }, [mapData])

  // Cargar tiempos de viaje REALES para hospitales sin asignar (una sola vez: no dependen de la línea)
  const unassignedTimesRequested = useRef(false)
  useEffect(() => {
    if (!mapData || mapData.unassignedHospitals.length === 0) return
    if (unassignedTimesRequested.current) return
    unassignedTimesRequested.current = true

    const fetchUnassignedTravelTimes = async () => {
      try {
        // Usar la API optimizada con la nueva tabla hospital_kam_distances
        const response = await fetch('/api/travel-times/unassigned-optimized')
        if (response.ok) {
          const data = await response.json()
          const timesMap: Record<string, any[]> = {}
          data.unassigned_hospitals?.forEach((hospital: any) => {
            if (hospital.travel_times && hospital.travel_times.length > 0) {
              timesMap[hospital.id] = hospital.travel_times
            }
          })
          setUnassignedTravelTimes(timesMap)
        } else {
          console.error('Failed to fetch travel times:', response.status, await response.text())
        }
      } catch (error) {
        console.error('Error fetching unassigned travel times:', error)
      }
    }

    fetchUnassignedTravelTimes()
  }, [mapData])

  // Polígonos de TODOS los municipios y localidades: una sola descarga por sesión (no dependen de la línea)
  const geoQueryOptions = {
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    retry: 1
  } as const
  const { data: municipiosGeo, isError: municipiosGeoError } = useQuery({
    queryKey: ['geo', 'municipios'],
    queryFn: async () => {
      const res = await fetch(GEO_MUNICIPIOS_URL)
      if (!res.ok) throw new Error(`Error ${res.status} al cargar ${GEO_MUNICIPIOS_URL}`)
      return res.json()
    },
    ...geoQueryOptions
  })
  const { data: localidadesGeo, isError: localidadesGeoError } = useQuery({
    queryKey: ['geo', 'localidades'],
    queryFn: async () => {
      const res = await fetch(GEO_LOCALIDADES_URL)
      if (!res.ok) throw new Error(`Error ${res.status} al cargar ${GEO_LOCALIDADES_URL}`)
      return res.json()
    },
    ...geoQueryOptions
  })
  // Los puntos se agregan cuando ya están los polígonos (las visitas comparten su canvas y deben quedar encima)
  const geoSettled = (!!municipiosGeo || municipiosGeoError) && (!!localidadesGeo || localidadesGeoError)

  // Detalle al acercar (dueño, 2026-10-29: los colores siguen las fronteras del DANE; lib/geo-detalle.ts): desde
  // DETALLE_ZOOM los departamentos que se ven se pintan con public/geo/detalle/<dd>.json; al alejar, vista de país
  const rectangulosDepto = useMemo(() => rectangulosPorDepto([
    ...(Array.isArray(municipiosGeo?.features) ? municipiosGeo.features : []),
    ...(Array.isArray(localidadesGeo?.features) ? localidadesGeo.features : [])
  ]), [municipiosGeo, localidadesGeo])
  const [deptosDetalle, setDeptosDetalle] = useState<readonly string[]>([])
  const onDeptosEnVista = useCallback((visibles: string[], zoom: number) => {
    setDeptosDetalle(antes => siguientesDeptos(antes, visibles, zoom))
  }, [])
  const armarLote = useCallback(
    (respuestas: Array<{ data?: any; isError?: boolean }>) => loteDetalle<any>(deptosDetalle, respuestas),
    [deptosDetalle]
  )
  const lote = useQueries({
    queries: deptosDetalle.map(depto => ({
      queryKey: ['geo', 'detalle', depto],
      queryFn: async () => {
        const res = await fetch(urlDetalle(depto))
        if (!res.ok) throw new Error(`Error ${res.status} al cargar ${urlDetalle(depto)}`)
        return res.json()
      },
      ...geoQueryOptions,
      // El detalle que deja de verse se libera a los 10 min; la vista de país queda toda la sesión
      gcTime: 10 * 60 * 1000
    })),
    combine: armarLote
  })
  // Por lotes, para no juntar los dos niveles en un borde: el detalle cambia cuando llegó el de todos los
  // departamentos que se ven (mientras tanto sigue el anterior); si alguno falla, vista de país
  const [detallePorDepto, setDetallePorDepto] = useState<Record<string, any[]>>({})
  useEffect(() => {
    setDetallePorDepto(anterior => detalleVigente(anterior, lote))
  }, [lote])
  // Departamentos pintados con detalle: entra en la clave de las capas que repiten la geometría
  const firmaDetalle = Object.keys(detallePorDepto).sort().join('.')
  // Una capa por departamento: el detalle de uno llega sin volver a crear los polígonos de los demás
  const municipiosPorDepto = useMemo(
    () => porDepto<any>(Array.isArray(municipiosGeo?.features) ? municipiosGeo.features : []),
    [municipiosGeo]
  )
  const capasMunicipios = useMemo(() => Object.keys(municipiosPorDepto).sort().map(depto => ({
    key: `geo-municipios-${depto}${detallePorDepto[depto] ? '-detalle' : ''}`,
    data: { type: 'FeatureCollection', features: detallePorDepto[depto] ?? municipiosPorDepto[depto] }
  })), [municipiosPorDepto, detallePorDepto])
  const municipiosVista = useMemo(() => municipiosGeo && {
    type: 'FeatureCollection',
    features: combinarDetalle<any>(Array.isArray(municipiosGeo.features) ? municipiosGeo.features : [], detallePorDepto)
  }, [municipiosGeo, detallePorDepto])
  const localidadesVista = useMemo(() => localidadesGeo && (detallePorDepto[DEPTO_LOCALIDADES]
    ? { type: 'FeatureCollection', features: detallePorDepto[DEPTO_LOCALIDADES] }
    : localidadesGeo
  ), [localidadesGeo, detallePorDepto])

  // Reparto de municipios sin IPS por tiempo real de carretera (municipality_zone). Mientras la tabla
  // no exista o no tenga filas, la respuesta se trata como vacía y esos municipios quedan 'pending'.
  const { data: municipalityCoverage = EMPTY_MUNICIPALITY_COVERAGE } = useQuery<MunicipalityCoverage>({
    // 'v2': desde el 2026-10-28 la respuesta trae { rows, localidades }; antes el caché guardaba solo las filas
    queryKey: ['municipality-coverage', 'v2'],
    queryFn: async () => {
      try {
        const res = await fetch('/api/municipality-coverage')
        if (!res.ok) {
          console.warn(`/api/municipality-coverage respondió ${res.status}; municipios sin IPS como pendientes`)
          return EMPTY_MUNICIPALITY_COVERAGE
        }
        const body = await res.json()
        return {
          rows: Array.isArray(body?.rows) ? body.rows : [],
          localidades: body?.localidades && typeof body.localidades === 'object' ? body.localidades : {},
        }
      } catch (error) {
        console.warn('No se pudo cargar /api/municipality-coverage:', error)
        return EMPTY_MUNICIPALITY_COVERAGE
      }
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false
  })

  const municipalityRows = municipalityCoverage.rows
  const localidadesPorCorredor = municipalityCoverage.localidades

  const municipalityByCode = useMemo(() => {
    const byCode: Record<string, MunicipalityZoneRow> = {}
    municipalityRows.forEach(r => {
      if (r && typeof r.code === 'string') byCode[r.code] = r
    })
    return byCode
  }, [municipalityRows])

  // Territorios con IPS (localidad en Bogotá, municipio en el resto) y su zona ganadora por mayoría de
  // CAMAS. Misma función pura que usa el motor de municipios (lib/territory-rules.ts): más camas,
  // luego más IPS, luego nombre de zona y kam_id (desempate determinista).
  const territoryAnalysis = useMemo(() => {
    const territoriesWithIps = new Set<string>()
    const vacantTerritories = new Set<string>()
    const territoryWinners: Record<string, string> = {}
    let bogotaWinner: string | null = null
    if (!mapData) return { territoriesWithIps, vacantTerritories, territoryWinners, bogotaWinner }

    // IPS sin zona por territorio; el territorio se marca vacante salvo que la mayoría de sus IPS esté asignada
    // (mayoriaAsignada, dueño 2026-10-28). Antes bastaba una sola IPS sin zona.
    const sinZona = new Map<string, { beds: number | null }[]>()
    mapData.unassignedHospitals.forEach((hospital: any) => {
      const territoryId = territoryIdOf(hospital)
      if (territoryId) sinZona.set(territoryId, [...(sinZona.get(territoryId) || []), { beds: hospital.beds ?? null }])
    })

    const zoneNames: Record<string, string> = {}
    ;(mapData.kams || []).forEach((k: any) => { zoneNames[k.id] = zoneDisplayName(k.name) })
    const votes: { kam_id: string; beds: number | null; territory: string | null }[] = []
    mapData.assignments.forEach((assignment: any) => {
      const kamId = assignment.kams?.id
      if (!kamId) return
      if (!zoneNames[kamId]) zoneNames[kamId] = zoneDisplayName(assignment.kams.name)
      const territory = territoryIdOf(assignment.hospitals || {})
      if (territory) territoriesWithIps.add(territory)
      votes.push({ kam_id: kamId, beds: assignment.hospitals?.beds ?? null, territory })
    })

    computeTerritoryWinners(votes, v => v.territory, kamId => zoneNames[kamId] ?? null)
      .forEach((winner, territory) => { territoryWinners[territory] = winner.kam_id })

    sinZona.forEach((ips, territory) => {
      if (!mayoriaAsignada(votes.filter(v => v.territory === territory), ips)) vacantTerritories.add(territory)
    })

    // Ganador global de Bogotá con la misma regla (todas sus localidades juntas): respaldo si
    // municipality_zone aún no tiene la fila 11001
    const bogotaOf = (v: { territory: string | null }) =>
      v.territory && v.territory.length === 7 && v.territory.startsWith('11') ? BOGOTA_CODE : null
    bogotaWinner = computeTerritoryWinners(votes, bogotaOf, kamId => zoneNames[kamId] ?? null).get(BOGOTA_CODE)?.kam_id ?? null

    return { territoriesWithIps, vacantTerritories, territoryWinners, bogotaWinner }
  }, [mapData])

  // Zonas por id y zona residente por localidad (kams.area_id de 7 dígitos)
  const kamIndex = useMemo(() => {
    const byId: Record<string, any> = {}
    const residentByArea: Record<string, string> = {}
    ;(mapData?.kams || []).forEach((k: any) => {
      byId[k.id] = k
      if (k.area_id && !residentByArea[k.area_id]) residentByArea[k.area_id] = k.id
    })
    return { byId, residentByArea }
  }, [mapData])

  // Nombre de departamento por código (sale de las IPS; solo para el encabezado de las tarjetas)
  const departmentNames = useMemo(() => {
    const names: Record<string, string> = {}
    ;(mapData?.hospitals || []).forEach((h: any) => {
      if (h.department_id && h.department_name && !names[h.department_id]) names[h.department_id] = h.department_name
    })
    return names
  }, [mapData])

  // Tipo de cada polígono: las IPS asignadas mandan (regla de siempre); sin IPS, municipality_zone.
  const resolveTerritory = useCallback((code: string, isLocality: boolean): ResolvedTerritory => {
    const { territoriesWithIps, vacantTerritories, territoryWinners } = territoryAnalysis
    const isVacant = vacantTerritories.has(code)
    if (territoriesWithIps.has(code)) return { kind: 'ips', kamId: territoryWinners[code], isVacant }
    if (isVacant) return { kind: 'vacant', isVacant }
    if (isLocality) {
      // Localidad sin IPS (zonaDeLocalidadSinIps): la celda del sector (corredor) de la localidad, 4 sectores desde el
      // 2026-10-28; si no está, la zona que vive en ella (territorio base); si no, hereda como alcance la zona que
      // gana Bogotá (fila 11001 de municipality_zone o, en su defecto, la misma regla de mayoría sobre todas las
      // localidades). No hay tiempos por carretera hacia localidades.
      const bogotaRow = municipalityByCode[BOGOTA_CODE]
      const fromRow = bogotaRow && (bogotaRow.kind === 'ips' || bogotaRow.kind === 'reach') ? bogotaRow.kam_id : null
      const zona = zonaDeLocalidadSinIps({
        residente: kamIndex.residentByArea[code],
        porCorredor: localidadesPorCorredor[code],
        ganadorBogota: fromRow && kamIndex.byId[fromRow] ? fromRow : territoryAnalysis.bogotaWinner,
        existe: kamId => !!kamIndex.byId[kamId],
      })
      if (!zona) return { kind: 'pending', isVacant }
      if (zona.fuente === 'corredor') return { kind: 'reach', kamId: zona.kam_id, isVacant, corredor: zona.corredor }
      if (zona.fuente === 'bogota') return { kind: 'reach', kamId: zona.kam_id, isVacant, bogotaInherited: true }
      return { kind: 'reach', kamId: zona.kam_id, isVacant }
    }
    const row = municipalityByCode[code]
    if (!row) return { kind: 'pending', isVacant }
    if ((row.kind === 'reach' || row.kind === 'ips') && row.kam_id) {
      // 'ips' sin IPS asignadas en el mapa = fila desactualizada: se muestra como alcance de esa zona
      return { kind: 'reach', kamId: row.kam_id, isVacant, row }
    }
    if (row.kind === 'out_of_reach' || row.kind === 'no_road') return { kind: row.kind, isVacant, row }
    return { kind: 'pending', isVacant, row }
  }, [territoryAnalysis, kamIndex, municipalityByCode, localidadesPorCorredor])

  // ---------- Datos derivados del modo por línea ----------
  const lineView = useMemo(() => {
    const coverage = mapData?.coverage
    if (!coverage || !Array.isArray(coverage.rows)) return null
    const rows: CoverageRow[] = coverage.rows
    const executives: CoverageExecutive[] = Array.isArray(mapData?.executives) ? mapData.executives : []

    const byKam: Record<string, CoverageRow> = {}
    const zoneNameById: Record<string, string> = {}
    rows.forEach(r => {
      byKam[r.kam_id] = r
      if (r.zone_name) zoneNameById[r.kam_id] = r.zone_name
    })
    ;(mapData?.kams || []).forEach((k: any) => {
      if (!zoneNameById[k.id]) zoneNameById[k.id] = k.name
    })

    // Orden de las zonas de cada Ejecutivo Comercial (alfabético por ciudad base): "zona 2 de 4" en la tarjeta y el
    // color de su chip. Desde el 2026-10-28 cada zona va con su propio color (kams.color), igual que en la
    // vista de Zonas, y no con un tono del color del Ejecutivo Comercial (decisión del dueño).
    const kamById: Record<string, any> = {}
    ;(mapData?.kams || []).forEach((k: any) => { kamById[k.id] = k })
    const baseCityOf = (kamId: string): string => {
      const row = byKam[kamId]
      return row?.base_city || kamById[kamId]?.base_city || zoneDisplayName(row?.zone_name || kamById[kamId]?.name) || ''
    }
    const zonesOfExecutive: Record<string, string[]> = {}
    rows.forEach(r => {
      if (r.kind !== 'vacant' && r.kind !== 'conflict' && r.executive) (zonesOfExecutive[r.executive.id] ||= []).push(r.kam_id)
    })
    const zoneOrder: Record<string, { index: number; total: number }> = {}
    Object.values(zonesOfExecutive).forEach(kamIds => {
      kamIds.sort((a, b) => baseCityOf(a).localeCompare(baseCityOf(b), 'es') || a.localeCompare(b))
      kamIds.forEach((kamId, index) => {
        zoneOrder[kamId] = { index, total: kamIds.length }
      })
    })

    // Chip de cada Ejecutivo Comercial en la leyenda: el color de la Zona donde es local; si no, el de la
    // primera de sus Zonas
    const executiveChipColor: Record<string, string> = {}
    const chipOf = (e: CoverageExecutive | null | undefined) => {
      if (!e || executiveChipColor[e.id]) return
      const zonas = (zonesOfExecutive[e.id] || []).map(kamId => ({ kamId, kind: byKam[kamId]?.kind ?? '' }))
      executiveChipColor[e.id] = safeColor(colorDeEjecutivoEnLinea(zonas, kamId => kamColors[kamId]), NO_COVERAGE_DATA_COLOR)
    }
    executives.forEach(chipOf)
    rows.forEach(r => chipOf(r.executive))

    // Conteos para la leyenda
    const zonesByExecutive: Record<string, number> = {}
    let vacant = 0
    let conflict = 0
    let noEquipment = 0
    rows.forEach(r => {
      if (r.kind === 'vacant') vacant++
      else if (r.kind === 'conflict') conflict++
      else if (r.executive) zonesByExecutive[r.executive.id] = (zonesByExecutive[r.executive.id] || 0) + 1
      if (!r.has_equipment) noEquipment++
    })

    return {
      line: coverage.line as { id: string; code: string; name: string; max_reach_minutes: number },
      rows,
      executives,
      executiveChipColor,
      byKam,
      zoneNameById,
      zoneOrder,
      counts: { zonesByExecutive, vacant, conflict, noEquipment }
    }
  }, [mapData, kamColors])

  // Modo por línea activo: hay cobertura cargada y no se eligió la vista "Zonas"
  const isLineMode = mapMode === 'line' && !!lineView

  // Vista de zonas para quien no ve todas las líneas (spec 2026-10-14): /api/map/data solo le trae, de los
  // Ejecutivos Comerciales que viven en cada zona, a los de SUS líneas. Los textos lo dicen para no dar a entender
  // que la zona no tiene a nadie. Con map:all-lines, los textos de siempre.
  const zoneExecutivesOnlyMine = !canSeeAllLines
  const zoneExecutiveLabel = zoneExecutivesOnlyMine ? 'Ejecutivo Comercial (tus líneas)' : 'Ejecutivo Comercial'
  // labeled: va debajo de zoneExecutiveLabel (tarjetas); si no, texto suelto (tooltips)
  const zoneExecutivesText = useCallback((executives: ZoneExecutive[] | null | undefined, labeled: boolean): string =>
    formatZoneExecutives(executives, zoneExecutivesOnlyMine ? (labeled ? 'ninguno' : 'sin Ejecutivo Comercial de tus líneas') : undefined),
    [zoneExecutivesOnlyMine])

  // Grises por Zona para "Sin cobertura" (autorizado por el dueño el 2026-10-23: "las zonas se van a ver grises,
  // pero vas a tener que manejar distintos tonos de grises"): la rampa de grisDeZona se calcula sobre las Zonas que
  // trae /api/map/data (activas con territorio), con su nombre y su color, y se convierte a #RRGGBB para el resto del
  // mapa. Lo usan el relleno, los puntos de IPS, la insignia hueca y la tarjeta de una Zona sin cobertura en la línea;
  // el borde pizarra y el "IPS sin Zona" no cambian (docs/mapa-estetica.md, "2026-10-23 · Grises por Zona").
  const zonasParaGris = useMemo(
    () => ((mapData?.kams || []) as Array<{ id: string; name?: string | null; color?: string | null }>)
      .map(k => ({ id: k.id, name: k.name ?? '', color: k.color ?? null })),
    [mapData]
  )
  const grisZona = useCallback((kamId: string): string => hslCssToHex(grisDeZona(kamId, zonasParaGris)), [zonasParaGris])
  // Una sola muestra para la leyenda ("Sin cobertura en esta línea" y el punto de IPS): el gris de la primera Zona sin
  // cobertura de la línea; pizarra si no hay ninguna
  const grisSinCoberturaMuestra = useMemo(() => {
    if (!isLineMode || !lineView) return VACANT_FILL_COLOR
    const primera = lineView.rows.find(r => r.kind === 'vacant')
    return primera ? grisZona(primera.kam_id) : VACANT_FILL_COLOR
  }, [isLineMode, lineView, grisZona])

  // Color de la zona en la línea: el de la Zona (como en la vista de Zonas) si alguien la cubre; sin cobertura,
  // el gris propio de la Zona; conflicto, ámbar (colorDeZonaEnLinea, dueño 2026-10-28)
  const zoneLineColor = useCallback((kamId: string | undefined): string => {
    if (!lineView || !kamId) return NO_COVERAGE_DATA_COLOR
    return colorDeZonaEnLinea(lineView.byKam[kamId], kamColors[kamId], () => grisZona(kamId))
  }, [lineView, kamColors, grisZona])

  // ---------- Color: una sola fuente de verdad ----------
  // El color de la Zona (kams.color) en las dos vistas (dueño, 2026-10-28); en la vista por línea mandan los estados
  // (zoneLineColor). Lo usan polígonos, puntos y pines. (El modo Regiones se quitó el 2026-10-14.)
  const colorForZone = useCallback((kamId: string | null | undefined): string => {
    if (!kamId) return NO_COVERAGE_DATA_COLOR
    if (isLineMode) return zoneLineColor(kamId)
    return kamColors[kamId] || NO_COVERAGE_DATA_COLOR
  }, [isLineMode, zoneLineColor, kamColors])

  // Grupo de la zona en la vista activa (persona en la vista por línea, Zona en la de zonas): elige la insignia de
  // muestra de la leyenda
  const groupKeyForZone = useCallback((kamId: string | null | undefined): string | null => {
    if (!kamId) return null
    if (isLineMode && lineView) {
      const row = lineView.byKam[kamId]
      if (!row) return null
      if (row.kind === 'vacant') return 'vacant'
      if (row.kind === 'conflict') return 'conflict'
      return row.executive?.id ?? null
    }
    return kamId
  }, [isLineMode, lineView])

  // ---------- "Ver solo": Ejecutivos Comerciales (vista por línea) o Zonas (vista de zonas) ----------
  // Único mecanismo desde el 2026-10-29 (docs/specs/2026-10-29-mapa-filtros-y-leyenda.md), en la lista de la leyenda:
  // fuera del filtro el territorio queda casi blanco (el color de su Zona al 8 %) y sus IPS, insignias y visitas no se
  // dibujan.
  const filterKind: GroupFilterConfig['kind'] | null = isLineMode ? 'executive' : mapMode === 'zones' ? 'zone' : null
  const activeFilter = useMemo<ReadonlySet<string> | null>(
    () => (filterKind && filterIds ? new Set(filterIds) : null),
    [filterKind, filterIds]
  )
  const filterIsActive = !!activeFilter
  const showVacant = vacantPref && vacantPref.filtered === filterIsActive ? vacantPref.value : !filterIsActive
  const changeShowVacant = useCallback((value: boolean) => setVacantPref({ filtered: filterIsActive, value }), [filterIsActive])

  // Zona visible con el filtro. Sin zona (IPS sin zona) y zonas vacantes en la línea: según "Mostrar
  // vacantes". Zonas en conflicto o sin datos de cobertura: solo sin filtro.
  const isZoneVisible = useCallback((kamId: string | null | undefined): boolean => {
    if (!kamId) return showVacant
    if (isLineMode && lineView) {
      const row = lineView.byKam[kamId]
      if (!row || row.kind === 'conflict') return !activeFilter
      if (row.kind === 'vacant' || !row.executive) return showVacant
      return !activeFilter || activeFilter.has(row.executive.id)
    }
    return !activeFilter || activeFilter.has(kamId)
  }, [isLineMode, lineView, activeFilter, showVacant])

  // ---------- Estilo de la capa completa de municipios y localidades ----------

  // Zona sin equipo en la línea elegida (solo aplica a polígonos con zona: IPS o alcance)
  const isNoEquipment = useCallback((t: ResolvedTerritory): boolean =>
    isLineMode && !!t.kamId && (t.kind === 'ips' || t.kind === 'reach') &&
    lineView?.byKam[t.kamId]?.has_equipment === false
  , [isLineMode, lineView])

  // Relleno del polígono según la vista: color de la zona (misma fuente que puntos e insignias) o el
  // color fijo de vacante / conflicto. Alcance = mismo color con menos opacidad. `vacant`: el polígono
  // lleva además el borde pizarra de vacante. Zona SIN COBERTURA en la línea (2026-10-23): gris propio de la
  // Zona con las opacidades de vacante; el territorio que solo tiene IPS sin zona sigue en pizarra.
  const territoryFill = useCallback((t: ResolvedTerritory): { color: string; opacity: number; vacant: boolean } => {
    const isReach = t.kind === 'reach'
    let state: 'zone' | 'vacant' | 'conflict' = 'zone'
    let vacantColor = VACANT_FILL_COLOR
    if (t.kind === 'vacant') {
      state = 'vacant'
    } else if (isLineMode && t.kamId) {
      const kind = lineView?.byKam[t.kamId]?.kind
      if (kind === 'vacant') {
        state = 'vacant'
        vacantColor = grisZona(t.kamId)
      } else if (kind === 'conflict') state = 'conflict'
    } else if (t.kind === 'ips' && t.isVacant) {
      // Vista de zonas: territorio cuya mayoría de IPS está sin zona (con mayoría asignada se pinta con su Zona)
      state = 'vacant'
    }
    if (state === 'vacant') return { color: vacantColor, opacity: isReach ? VACANT_REACH_FILL_OPACITY : VACANT_FILL_OPACITY, vacant: true }
    if (state === 'conflict') return { color: CONFLICT_FILL_COLOR, opacity: CONFLICT_FILL_OPACITY * (isReach ? REACH_OPACITY_RATIO : 1), vacant: false }
    return { color: t.kamId ? colorForZone(t.kamId) : NO_COVERAGE_DATA_COLOR, opacity: isReach ? REACH_FILL_OPACITY : IPS_FILL_OPACITY, vacant: false }
  }, [isLineMode, lineView, colorForZone, grisZona])

  // Fuera del filtro (solo polígonos con zona o vacantes): casi blanco, sin tooltip ni tarjeta
  const isFilteredOutTerritory = useCallback((t: ResolvedTerritory): boolean => {
    if (t.kind !== 'ips' && t.kind !== 'reach' && t.kind !== 'vacant') return false
    return !isZoneVisible(t.kamId)
  }, [isZoneVisible])

  // Estilo autorizado 2026-10-11: borde blanco fino en los polígonos con zona y pendientes (vacantes:
  // borde pizarra fino); relleno 0.55 con IPS / 0.22 de alcance (vacante 0.5 / 0.3). Todas las
  // variantes fijan dashArray para que setStyle no arrastre el anterior.
  const baseTerritoryStyle = useCallback((t: ResolvedTerritory): L.PathOptions => {
    const border = { color: TERRITORY_BORDER_COLOR, weight: TERRITORY_BORDER_WEIGHT, opacity: TERRITORY_BORDER_OPACITY, dashArray: undefined }
    switch (t.kind) {
      case 'ips':
      case 'vacant':
      case 'reach': {
        const fill = territoryFill(t)
        const edge = fill.vacant
          ? { color: VACANT_BORDER_COLOR, weight: VACANT_BORDER_WEIGHT, opacity: VACANT_BORDER_OPACITY, dashArray: undefined }
          : border
        // Sin equipo: el rayado lo pinta la capa SVG de debajo; aquí solo el borde
        return { ...edge, fillColor: fill.color, fillOpacity: isNoEquipment(t) ? 0 : fill.opacity }
      }
      case 'out_of_reach':
        return {
          fillColor: OUT_OF_REACH_FILL_COLOR,
          fillOpacity: OUT_OF_REACH_FILL_OPACITY,
          color: OUT_OF_REACH_BORDER_COLOR,
          weight: OUT_OF_REACH_BORDER_WEIGHT,
          opacity: 1,
          dashArray: OUT_OF_REACH_DASH
        }
      case 'no_road':
        // Relleno plano en el canvas; la trama de puntos va en la capa SVG de encima (si el patrón no
        // estuviera disponible, queda este relleno plano)
        return { ...border, fillColor: NO_ROAD_FILL_COLOR, fillOpacity: NO_ROAD_FILL_OPACITY }
      default:
        return { fillColor: PENDING_FILL_COLOR, fillOpacity: PENDING_FILL_OPACITY, color: PENDING_BORDER_COLOR, weight: TERRITORY_BORDER_WEIGHT, opacity: 1, dashArray: undefined }
    }
  }, [territoryFill, isNoEquipment])

  // Estilo en reposo: municipios de alcance ocultos o territorio fuera de "Ver solo" casi blanco
  const territoryRestStyle = useCallback((code: string, isLocality: boolean): L.PathOptions => {
    const t = resolveTerritory(code, isLocality)
    const base = baseTerritoryStyle(t)
    if (t.kind === 'reach' && !showReach) return { ...base, fillOpacity: 0, opacity: 0 }
    if (isFilteredOutTerritory(t)) return { ...base, fillOpacity: Math.min(base.fillOpacity ?? 0, DIMMED_FILL_OPACITY), opacity: 0.3 }
    return base
  }, [resolveTerritory, baseTerritoryStyle, showReach, isFilteredOutTerritory])

  // Hover (solo con cursor): relleno +0.15 y borde blanco de 1,5 px
  const territoryHoverStyle = useCallback((code: string, isLocality: boolean): L.PathOptions => {
    const rest = territoryRestStyle(code, isLocality)
    const t = resolveTerritory(code, isLocality)
    return {
      ...rest,
      fillOpacity: isNoEquipment(t) ? 0 : Math.min(1, (rest.fillOpacity ?? 0) + HOVER_FILL_BOOST),
      color: TERRITORY_BORDER_COLOR,
      weight: HOVER_BORDER_WEIGHT,
      opacity: 1
    }
  }, [territoryRestStyle, resolveTerritory, isNoEquipment])

  // style por feature: al cambiar de línea/vista/"Ver solo" solo cambia esta función y react-leaflet
  // llama a setStyle (los polígonos no se vuelven a crear)
  const municipiosStyle = useCallback((feature?: any) => territoryRestStyle(String(feature?.properties?.code ?? ''), false), [territoryRestStyle])
  const localidadesStyle = useCallback((feature?: any) => territoryRestStyle(String(feature?.properties?.code ?? ''), true), [territoryRestStyle])

  // Rayado "sin equipo": subconjunto pequeño en SVG (el patrón url(#...) no existe en canvas), sin eventos
  const noEquipmentOverlay = useMemo(() => {
    if (!isLineMode) return null
    const pick = (fc: any, isLocality: boolean) =>
      (Array.isArray(fc?.features) ? fc.features : []).filter((f: any) => {
        const code = String(f?.properties?.code ?? '')
        return isNoEquipment(resolveTerritory(code, isLocality))
      }).map((f: any) => ({ ...f, properties: { ...f.properties, isLocality } }))
    // Misma geometría que el relleno (con el detalle de lo que se ve)
    const features = [...pick(municipiosVista, false), ...pick(localidadesVista, true)]
    if (features.length === 0) return null
    const codes = features.map((f: any) => f.properties.code).join(',')
    let hash = 0
    for (let i = 0; i < codes.length; i++) hash = (hash * 31 + codes.charCodeAt(i)) | 0
    return { data: { type: 'FeatureCollection', features }, key: `${lineView?.line.code}-${features.length}-${hash}-${firmaDetalle}` }
  }, [isLineMode, municipiosVista, localidadesVista, firmaDetalle, isNoEquipment, resolveTerritory, lineView])

  // Solo el relleno rayado: el borde blanco lo dibuja el canvas de encima
  const noEquipmentOverlayStyle = useCallback((feature?: any): L.PathOptions => {
    const isLocality = !!feature?.properties?.isLocality
    const t = resolveTerritory(String(feature?.properties?.code ?? ''), isLocality)
    const color = territoryFill(t).color
    const hidden = t.kind === 'reach' && !showReach
    return {
      stroke: false,
      fillColor: `url(#${noEquipmentPatternId(safeColor(color))})`,
      fillOpacity: hidden ? 0 : isFilteredOutTerritory(t) ? DIMMED_FILL_OPACITY : (t.kind === 'reach' ? 0.35 : 0.85)
    }
  }, [resolveTerritory, territoryFill, showReach, isFilteredOutTerritory])

  // Trama de puntos de "sin acceso terrestre" (solo municipios; no dependen de la línea)
  const noRoadOverlay = useMemo(() => {
    const features = (Array.isArray(municipiosVista?.features) ? municipiosVista.features : []).filter((f: any) =>
      resolveTerritory(String(f?.properties?.code ?? ''), false).kind === 'no_road')
    if (features.length === 0) return null
    const codes = features.map((f: any) => String(f.properties?.code ?? '')).join(',')
    let hash = 0
    for (let i = 0; i < codes.length; i++) hash = (hash * 31 + codes.charCodeAt(i)) | 0
    return { data: { type: 'FeatureCollection', features }, key: `sin-acceso-${features.length}-${hash}-${firmaDetalle}` }
  }, [municipiosVista, firmaDetalle, resolveTerritory])

  // Conteos de la leyenda y municipios por zona (con IPS / de alcance) para la tarjeta de cada zona
  const territorySummary = useMemo(() => {
    const counts = { ips: 0, reach: 0, outOfReach: 0, noRoad: 0, pending: 0 }
    const byZone: Record<string, { ips: number; reach: number }> = {}
    const tally = (fc: any, isLocality: boolean) => {
      ;(Array.isArray(fc?.features) ? fc.features : []).forEach((f: any) => {
        const t = resolveTerritory(String(f?.properties?.code ?? ''), isLocality)
        if (t.kind === 'ips' || t.kind === 'vacant') counts.ips++
        else if (t.kind === 'reach') counts.reach++
        else if (t.kind === 'out_of_reach') counts.outOfReach++
        else if (t.kind === 'no_road') counts.noRoad++
        else counts.pending++
        if (t.kamId && (t.kind === 'ips' || t.kind === 'reach')) {
          const zone = (byZone[t.kamId] ||= { ips: 0, reach: 0 })
          if (t.kind === 'ips') zone.ips++
          else zone.reach++
        }
      })
    }
    tally(municipiosGeo, false)
    tally(localidadesGeo, true)
    const legend: TerritoryLegend = {
      ...counts,
      noMunicipalityData: municipalityRows.length === 0,
      geoError: municipiosGeoError || localidadesGeoError
    }
    return { legend, byZone }
  }, [municipiosGeo, localidadesGeo, resolveTerritory, municipalityRows, municipiosGeoError, localidadesGeoError])
  const territoryLegend = territorySummary.legend

  // Estadísticas por zona (tarjeta del pin y leyenda de la vista de zonas)
  const kamStats = useMemo(() => {
    if (!mapData) return [] as any[]
    return mapData.kams.map((kam: any) => {
      const assignments = mapData.assignments.filter((a: any) => a.kams.id === kam.id)
      const totalBeds = assignments.reduce((sum: number, a: any) => sum + (a.hospitals.beds || 0), 0)
      const municipalities = new Set(assignments.map((a: any) => a.hospitals.municipality_id))
      const avgTravelTime = assignments.length > 0
        ? Math.round(assignments.reduce((sum: number, a: any) => sum + (a.travel_time || 0), 0) / assignments.length)
        : 0
      const totalPopulation = Array.from(municipalities).reduce((sum: number, munId: any) => {
        return sum + (mapData.populationMap[munId] || 0)
      }, 0)
      return {
        ...kam,
        hospitalCount: assignments.length,
        totalBeds,
        municipalityCount: municipalities.size,
        avgTravelTime,
        totalPopulation
      }
    }) as any[]
  }, [mapData])

  const kamStatsById = useMemo(() => {
    const byId: Record<string, any> = {}
    kamStats.forEach(k => { byId[k.id] = k })
    return byId
  }, [kamStats])

  // Filtros de tipo de hospital y del bloque "IPS". El interruptor "Solo con Contratos" se quitó el 2026-10-24: los
  // contratos cargados a mano ya no viajan en /api/map/data (spec docs/specs/2026-10-24-mapa-giros-y-compras-12-meses.md).
  const filteredAssignments = useMemo(() => {
    if (!mapData) return [] as any[]
    return mapData.assignments.filter((a: any) => {
      if (!matchesIpsFilter(a.hospitals, ipsServiceFilter)) return false
      if (hospitalTypeFilter === 'all') return true
      if (hospitalTypeFilter === 'sin_tipo') return !a.hospitals.type
      return a.hospitals.type === hospitalTypeFilter
    }) as any[]
  }, [mapData, hospitalTypeFilter, ipsServiceFilter])

  const filteredUnassignedHospitals = useMemo(() => {
    if (!mapData) return [] as any[]
    return mapData.unassignedHospitals.filter((h: any) => {
      if (hospitalTypeFilter !== 'all') {
        const matchesType = h.type === hospitalTypeFilter || (hospitalTypeFilter === 'sin_tipo' && !h.type)
        if (!matchesType) return false
      }
      return matchesIpsFilter(h, ipsServiceFilter)
    }) as any[]
  }, [mapData, hospitalTypeFilter, ipsServiceFilter])

  const assignmentByHospital = useMemo(() => {
    const byId: Record<string, any> = {}
    ;(mapData?.assignments || []).forEach((a: any) => {
      if (a?.hospitals?.id) byId[a.hospitals.id] = a
    })
    return byId
  }, [mapData])

  const unassignedById = useMemo(() => {
    const byId: Record<string, any> = {}
    ;(mapData?.unassignedHospitals || []).forEach((h: any) => { byId[h.id] = h })
    return byId
  }, [mapData])

  // IPS por Ejecutivo Comercial en la línea (detalle de la leyenda)
  const ipsByExecutive = useMemo(() => {
    const counts: Record<string, number> = {}
    if (!lineView || !mapData) return counts
    mapData.assignments.forEach((a: any) => {
      const row = a.kams?.id ? lineView.byKam[a.kams.id] : undefined
      if (!row || row.kind === 'vacant' || row.kind === 'conflict' || !row.executive) return
      counts[row.executive.id] = (counts[row.executive.id] || 0) + 1
    })
    return counts
  }, [lineView, mapData])

  // ---------- Giros ADRES y compras SECOP de 12 meses de la tarjeta abierta ----------
  // Spec docs/specs/2026-10-24-mapa-giros-y-compras-12-meses.md (E4): no viajan en /api/map/data (≈1,1 MB que se vuelve
  // a pedir al cambiar de línea); se piden al abrir la tarjeta, como los tiempos de unassigned-optimized, solo si la
  // respuesta del mapa trae inteligenciaIncluida (intelligence:view) y se guardan 5 min por territorio o IPS. Un
  // municipio de alcance sin IPS (kind 'other') no pide nada: giros y compras se cuentan donde está la IPS.
  // Desde el 2026-10-25 (spec docs/specs/2026-10-25-secop-procesos-radar.md) también con procesosIncluidos
  // (secop:procesos): la misma llamada trae los procesos de SECOP II sin contrato y, sin intelligence:view, solo eso.
  const inteligenciaIncluida = mapData?.inteligenciaIncluida === true
  const procesosIncluidos = mapData?.procesosIncluidos === true
  const detalleIncluido = inteligenciaIncluida || procesosIncluidos
  const detalleTarget = useMemo((): { tipo: 'ips' | 'municipio' | 'localidad'; code: string } | null => {
    if (!activePopup) return null
    if (activePopup.kind === 'ips' || activePopup.kind === 'unassigned') return { tipo: 'ips', code: activePopup.id }
    if (activePopup.kind === 'territory') {
      const t = resolveTerritory(activePopup.code, activePopup.isLocality)
      if (t.kind !== 'ips' && t.kind !== 'vacant') return null
      return { tipo: activePopup.isLocality ? 'localidad' : 'municipio', code: activePopup.code }
    }
    return null
  }, [activePopup, resolveTerritory])
  const detalleQuery = useQuery<TerritorioDetalle | IpsDetalle>({
    queryKey: ['map-detalle', detalleTarget?.tipo ?? 'ninguno', detalleTarget?.code ?? ''],
    queryFn: async () => {
      if (!detalleTarget) throw new Error('Sin tarjeta abierta')
      const url = detalleTarget.tipo === 'ips'
        ? `/api/map/detalle/ips/${encodeURIComponent(detalleTarget.code)}`
        : `/api/map/detalle/territorio?tipo=${detalleTarget.tipo}&code=${encodeURIComponent(detalleTarget.code)}`
      const response = await fetch(url)
      if (!response.ok) throw new MapDataError('No se pudieron cargar los giros y compras', response.status)
      return response.json()
    },
    enabled: !!detalleTarget && detalleIncluido,
    staleTime: 5 * 60_000,
    // Un 4xx (sin permiso, IPS inexistente, código inválido) no se reintenta; un fallo de red, una vez
    retry: (failureCount, error) =>
      !(error instanceof MapDataError && error.status >= 400 && error.status < 500) && failureCount < 1
  })
  // Lo que recibe GirosComprasSection: sin intelligence:view ni secop:procesos no hay sección (sin_acceso) ni llamada
  const detalleProps = (modo: 'territorio' | 'ips'): GirosComprasProps => ({
    estado: !detalleIncluido ? 'sin_acceso' : detalleQuery.isError ? 'error' : detalleQuery.data ? 'listo' : 'cargando',
    // Antes de que llegue el dato: 'procesos' pinta "Cargando procesos…" y nunca giros ni compras
    alcance: inteligenciaIncluida ? 'completo' : 'procesos',
    data: detalleQuery.data ?? null,
    error: detalleQuery.error instanceof Error ? detalleQuery.error.message : null,
    onRetry: () => { void detalleQuery.refetch() },
    modo
  })

  // ---------- Tarjetas (popups) ----------

  const openPopup = useCallback((target: PopupTarget) => {
    popupNonceRef.current += 1
    setActivePopup({ ...target, nonce: popupNonceRef.current } as ActivePopup)
    // En móvil la hoja se recoge para que la tarjeta se vea completa
    setSheetSnap('peek')
  }, [])

  const closePopup = useCallback((nonce: number) => {
    setActivePopup(current => (current && current.nonce === nonce ? null : current))
  }, [])

  const selectIps = useCallback<HospitalSelectHandler>((id, position) => {
    openPopup({ kind: 'ips', id, position })
  }, [openPopup])

  const selectUnassigned = useCallback<HospitalSelectHandler>((id, position) => {
    openPopup({ kind: 'unassigned', id, position })
  }, [openPopup])

  // IPS elegida en el buscador: abre su tarjeta (asignada o sin zona)
  const openHospitalPopup = useCallback((id: string | null) => {
    if (!id) return
    const assignment = assignmentByHospital[id]
    if (assignment) {
      openPopup({ kind: 'ips', id, position: [Number(assignment.hospitals.lat), Number(assignment.hospitals.lng)] })
      return
    }
    const hospital = unassignedById[id]
    if (hospital) openPopup({ kind: 'unassigned', id, position: [Number(hospital.lat), Number(hospital.lng)] })
  }, [assignmentByHospital, unassignedById, openPopup])

  // ---------- Buscador del mapa (dueño, 2026-10-28; único desde el 2026-10-29) ----------
  // Municipios, departamentos y localidades de los polígonos que el mapa ya descargó, la ciudad de Bogotá y las IPS con
  // coordenadas (antes estaban en la pestaña "Buscar" de Filtros)
  const territoriosParaBuscar = useMemo<TerritorioBuscable[]>(() => territoriosBuscables(
    (municipiosGeo?.features || []).map((f: any) => f.properties || {}),
    (localidadesGeo?.features || []).map((f: any) => f.properties || {}),
    code => mapData?.municipalityNames?.[code],
    (mapData?.hospitals || [])
      .filter((h: any) => h.lat != null && h.lng != null)
      .map((h: any) => ({
        id: String(h.id),
        name: h.name,
        code: h.code,
        lat: Number(h.lat),
        lng: Number(h.lng),
        municipio: mapData?.municipalityNames?.[h.municipality_id] ?? h.municipality_name ?? null
      }))
  ), [municipiosGeo, localidadesGeo, mapData])

  // Va al resultado: una IPS, a su punto (zoom 15 como mínimo) con su tarjeta abierta; un territorio,
  // encuadrado con zoom moderado (hasta 9 un departamento, 11 un municipio o la ciudad, 13 una localidad) y dejando
  // libres el buscador y la leyenda (escritorio) o la hoja inferior (móvil)
  const irATerritorio = useCallback((territorio: TerritorioBuscable) => {
    const map = mapRef.current
    if (!map) return
    if (territorio.tipo === 'ips') {
      if (territorio.lat === undefined || territorio.lng === undefined) return
      const ipsId = territorio.ipsId ?? null
      // La tarjeta se abre al terminar el vuelo: así Leaflet la encuadra con la vista final, debajo del buscador
      map.once('moveend', () => openHospitalPopup(ipsId))
      map.flyTo([territorio.lat, territorio.lng], Math.max(map.getZoom(), 15), { duration: 0.8 })
      return
    }
    const rectangulo = rectanguloDeGeometrias(
      geometriasDeTerritorio(territorio.code, municipiosGeo?.features || [], localidadesGeo?.features || [])
    )
    if (!rectangulo) return
    const izquierda = !isMobile && !legendCollapsed ? LEGEND_INSET_PX : 0
    map.flyToBounds(rectangulo, {
      paddingTopLeft: [24 + izquierda, 72],
      paddingBottomRight: isMobile ? [24, SHEET_PEEK_PX + 24] : [72, 24],
      maxZoom: territorio.tipo === 'departamento' ? 9 : territorio.tipo === 'localidad' ? 13 : 11,
      duration: 0.8
    })
  }, [municipiosGeo, localidadesGeo, isMobile, legendCollapsed, openHospitalPopup])

  // ---------- Manejadores de los polígonos ----------
  // Estables (no se vuelven a registrar al cambiar de línea): leen el contexto vigente de esta referencia.
  // Con cursor: resaltado y tooltip corto al pasar; clic → tarjeta. En táctil: solo el toque → tarjeta.
  const territoryCtxRef = useRef<TerritoryContext | null>(null)

  const makeTerritoryHandlers = useCallback((isLocality: boolean) => {
    const featureOf = (e: any) => {
      const layer = e.layer || e.propagatedFrom
      const feature = layer?.feature
      if (!feature) return null
      return { layer, code: String(feature.properties?.code ?? ''), name: String(feature.properties?.name ?? '') }
    }
    return {
      // Comparten el canvas con las visitas, que deben quedar encima: cada capa de polígonos que entra (el detalle
      // llega después de ellas) se manda al fondo
      add: (e: any) => {
        if (!e.propagatedFrom) e.target?.bringToBack?.()
      },
      mouseover: (e: any) => {
        const ctx = territoryCtxRef.current
        const f = featureOf(e)
        if (!ctx || !f || !ctx.canHover || ctx.isHidden(f.code, isLocality)) return
        f.layer.setStyle(ctx.hover(f.code, isLocality))
        f.layer.unbindTooltip()
        f.layer
          .bindTooltip(ctx.tooltip(f.code, isLocality, f.name), { sticky: true, opacity: 1, direction: 'top', offset: [0, -10], className: 'opmap-tooltip' })
          .openTooltip(e.latlng)
      },
      mouseout: (e: any) => {
        const ctx = territoryCtxRef.current
        const f = featureOf(e)
        if (!ctx || !f) return
        f.layer.setStyle(ctx.rest(f.code, isLocality))
        f.layer.unbindTooltip()
      },
      click: (e: any) => {
        const ctx = territoryCtxRef.current
        const f = featureOf(e)
        if (!ctx || !f || ctx.isHidden(f.code, isLocality)) return
        f.layer.closeTooltip?.()
        ctx.open(f.code, isLocality, f.name, e.latlng)
      }
    }
  }, [])
  const municipiosHandlers = useMemo(() => makeTerritoryHandlers(false), [makeTerritoryHandlers])
  const localidadesHandlers = useMemo(() => makeTerritoryHandlers(true), [makeTerritoryHandlers])

  // ---------- Capas de puntos (memoizadas: cambiar de vista solo cambia colores) ----------

  // Filtro por Ejecutivo Comercial / zona: las IPS de los demás no se dibujan; las IPS sin zona solo
  // con "Mostrar vacantes"
  const visibleAssignments = useMemo(
    () => filteredAssignments.filter((a: any) => isZoneVisible(a.kams?.id)),
    [filteredAssignments, isZoneVisible]
  )
  const visibleUnassigned = useMemo(
    () => (showVacant ? filteredUnassignedHospitals : []),
    [showVacant, filteredUnassignedHospitals]
  )

  const ipsMarkers = useMemo(() => visibleAssignments
    .filter((a: any) => Number.isFinite(Number(a.hospitals?.lat)) && Number.isFinite(Number(a.hospitals?.lng)))
    .map((a: any) => {
      const hospital = a.hospitals
      const kamId = a.kams?.id
      return (
        <HospitalMarker
          key={hospital.id}
          id={hospital.id}
          lat={Number(hospital.lat)}
          lng={Number(hospital.lng)}
          name={hospital.name}
          beds={hospital.beds}
          color={colorForZone(kamId)}
          showTooltip={canHover}
          onSelect={selectIps}
        />
      )
    }), [visibleAssignments, colorForZone, canHover, selectIps])

  // IPS sin zona en la vista (incluye departamentos excluidos): punto gris pequeño con borde blanco
  const unassignedMarkers = useMemo(() => visibleUnassigned
    .filter((h: any) => Number.isFinite(Number(h.lat)) && Number.isFinite(Number(h.lng)))
    .map((hospital: any) => (
      <UnassignedHospitalMarker
        key={`unassigned-${hospital.id}`}
        id={hospital.id}
        lat={Number(hospital.lat)}
        lng={Number(hospital.lng)}
        name={hospital.name}
        showTooltip={canHover}
        onSelect={selectUnassigned}
      />
    )), [visibleUnassigned, canHover, selectUnassigned])

  // Insignias de zona: una por zona en su ciudad base, con las iniciales de la ciudad base sobre el
  // color de la vista (colorForZone). Las que se tocan en pantalla se agrupan en racimos (ZoneBadgeLayer).
  const badgeSize = isMobile ? 28 : 32
  const clusterSize = isMobile ? 30 : 34
  const badgeTextSize = isMobile ? 11 : 12

  // Las Zonas de Bogotá por sector llevan su sector (N, Oc, S, Or), no la localidad de su punto base
  const zoneInitials = useMemo(() => {
    const kams: any[] = mapData?.kams || []
    const sectorOf = (k: any) => bogotaSectorInitials(zoneDisplayName(k.name))
    const initials = uniqueCityInitials(
      kams.filter(k => !sectorOf(k)).map(k => ({ id: k.id, city: k.base_city || zoneDisplayName(k.name) || k.name || '' }))
    )
    kams.forEach(k => {
      const sector = sectorOf(k)
      if (sector) initials[k.id] = sector
    })
    return initials
  }, [mapData])

  const zoneBadgeItems = useMemo<ZoneBadgeItem[]>(() => kamStats
    .filter((kam: any) => Number.isFinite(Number(kam.lat)) && Number.isFinite(Number(kam.lng)) && kam.lat && kam.lng)
    // Solo las insignias del filtro: los racimos se recalculan con las visibles
    .filter((kam: any) => isZoneVisible(kam.id))
    .map((kam: any) => {
      const row = isLineMode && lineView ? lineView.byKam[kam.id] : undefined
      const hollow = isLineMode && row?.kind === 'vacant'
      const name = zoneDisplayName(kam.name) || kam.name
      let tooltipMeta: string
      if (isLineMode && lineView) {
        if (!row) tooltipMeta = 'Sin datos de cobertura'
        else if (row.kind === 'vacant') tooltipMeta = 'Sin cobertura en esta línea'
        else if (row.kind === 'conflict') tooltipMeta = `Conflicto: ${row.note || 'varios Ejecutivos Comerciales locales'}`
        else tooltipMeta = executiveName(row.executive) || 'Sin Ejecutivo Comercial'
      } else {
        tooltipMeta = zoneExecutivesText(kam.executives, false)
      }
      // Insignia hueca de una Zona sin cobertura: anillo y "—" en el gris propio de la Zona (2026-10-23)
      const color = hollow ? grisZona(kam.id) : colorForZone(kam.id)
      return {
        id: kam.id,
        lat: Number(kam.lat),
        lng: Number(kam.lng),
        color,
        text: zoneInitials[kam.id] || initialsOf(kam.base_city || name),
        hollow,
        shortName: bogotaSectorInitials(name) ? name : shortCityName(kam.base_city) || name,
        label: `Zona ${name}`,
        groupKey: groupKeyForZone(kam.id),
        tooltipTitle: `Zona ${name}`,
        tooltipMeta
      }
    }), [kamStats, isZoneVisible, isLineMode, lineView, colorForZone, grisZona, zoneInitials, groupKeyForZone, zoneExecutivesText])

  const selectZone = useCallback((id: string, position: L.LatLngTuple) => {
    openPopup({ kind: 'zone', id, position })
  }, [openPopup])

  // Racimo que ya no se separa al acercar (misma ubicación o zoom máximo): tarjeta con sus zonas
  const listCluster = useCallback((ids: string[], position: L.LatLngTuple) => {
    openPopup({ kind: 'cluster', ids, position })
  }, [openPopup])

  // Zonas (kam_id) cuyas visitas se ven con el filtro: las de las Ejecutivas Comerciales elegidas en la
  // línea (coverage.rows) o las zonas elegidas; null = todas. Se pide así a /api/visits/filtered y,
  // por si llega algo más, se filtra también aquí.
  const visitKamIds = useMemo<string[] | null>(() => {
    if (!activeFilter && showVacant) return null
    return (mapData?.kams || []).map((k: any) => String(k.id)).filter((id: string) => isZoneVisible(id))
  }, [activeFilter, showVacant, mapData, isZoneVisible])

  const shownVisits = useMemo(() => {
    const list: any[] = Array.isArray(visits) ? visits : []
    if (!visitKamIds) return list
    const allowed = new Set(visitKamIds)
    return list.filter((v: any) => allowed.has(v?.kam_id))
  }, [visits, visitKamIds])

  // Cambiar el filtro cierra la tarjeta abierta (podría ser de algo que ya no se ve)
  useEffect(() => {
    setActivePopup(null)
  }, [activeFilter, showVacant])

  // Marcadores individuales de visitas (solo desde zoom 10)
  const visitMarkers = useMemo(() => shownVisits.map((visit: any, index: number) => {
    const kam = kamIndex.byId[visit.kam_id]
    const kamColor = kam ? colorForZone(kam.id) : '#888888'
    const typeColor = visit.visit_type === 'Visita efectiva' ? '#2ECC71' :
      visit.visit_type === 'Visita extra' ? '#3498DB' : '#E74C3C'
    return (
      <CircleMarker
        key={`visit-${index}`}
        center={[visit.lat, visit.lng]}
        radius={6}
        pathOptions={{ fillColor: typeColor, color: kamColor, weight: 2, opacity: 1, fillOpacity: 0.8 }}
      >
        <Tooltip className="custom-tooltip">
          <div style={{ fontSize: '12px', minWidth: 'min(200px, 60vw)', maxWidth: 'min(350px, 86vw)', wordWrap: 'break-word', whiteSpace: 'normal' }}>
            <strong style={{ fontSize: '13px', color: kamColor, wordBreak: 'break-word', display: 'block' }}>
              {zoneDisplayName(visit.kam_name)}
            </strong>
            <div style={{ marginTop: '4px', borderTop: '1px solid #ddd', paddingTop: '4px' }}>
              <table style={{ width: '100%', borderSpacing: '0' }}>
                <tbody>
                  <tr>
                    <td style={{ paddingRight: '10px' }}><strong>Tipo:</strong></td>
                    <td style={{ color: typeColor }}>{visit.visit_type}</td>
                  </tr>
                  <tr>
                    <td><strong>Contacto:</strong></td>
                    <td>{visit.contact_type}</td>
                  </tr>
                  <tr>
                    <td><strong>Fecha:</strong></td>
                    <td>{new Date(`${String(visit.visit_date).slice(0, 10)}T12:00:00Z`).toLocaleDateString('es-CO', { timeZone: 'UTC' })}</td>
                  </tr>
                  {visit.hospital_name && (
                    <tr>
                      <td><strong>Hospital:</strong></td>
                      <td>{visit.hospital_name}</td>
                    </tr>
                  )}
                  {visit.observations && (
                    <tr>
                      <td colSpan={2}>
                        <div style={{ marginTop: '4px', fontSize: '11px', fontStyle: 'italic' }}>
                          {visit.observations}
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: '4px', fontSize: '10px', color: '#666' }}>
              Zona: {kam ? zoneDisplayName(kam.name) : visit.kam_id}
            </div>
          </div>
        </Tooltip>
      </CircleMarker>
    )
  }), [shownVisits, kamIndex, colorForZone])

  if (isUnauthorized) {
    return <div className="flex items-center justify-center h-full">Sesión expirada. Redirigiendo al inicio de sesión...</div>
  }

  if (isError && !mapData) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-gray-700 font-medium mb-3">No se pudo cargar el mapa</p>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm hover:bg-gray-700 disabled:opacity-50"
          >
            {isFetching ? 'Reintentando...' : 'Reintentar'}
          </button>
        </div>
      </div>
    )
  }

  if (isLoading || !mapData) {
    return <div className="flex items-center justify-center h-full">Cargando mapa...</div>
  }

  // ---------- Textos de territorios, IPS y zonas ----------

  const zoneLabelOf = (kamId: string | null | undefined) => {
    const k = kamId ? kamIndex.byId[kamId] : null
    return k ? (zoneDisplayName(k.name) || k.name) : ''
  }

  const territoryNameOf = (code: string, featureName: string) =>
    mapData.municipalityNames[code] || featureName || `Territorio ${code}`

  // Tooltip corto al pasar el cursor por un polígono. Todo valor dinámico pasa por escapeHtml.
  const territoryTooltipHtml = (code: string, isLocality: boolean, featureName: string): string => {
    const t = resolveTerritory(code, isLocality)
    const zone = zoneLabelOf(t.kamId)
    let meta: string
    if (t.kind === 'ips' || t.kind === 'vacant') {
      if (isLineMode && lineView && t.kamId) {
        meta = `Zona ${zone} · ${describeCoverage(lineView.byKam[t.kamId], lineView.zoneNameById)}`
      } else if (t.isVacant || !t.kamId) {
        meta = 'Zona sin Ejecutivo Comercial'
      } else {
        meta = `Zona ${zone} · ${zoneExecutivesText(kamIndex.byId[t.kamId]?.executives, false)}`
      }
    } else if (t.kind === 'reach') {
      const minutes = t.row?.travel_minutes
      const motivo = t.corredor ? ` (corredor ${corredorLabel(t.corredor) || t.corredor})` : t.bogotaInherited ? ' (gana Bogotá)' : ''
      meta = `De alcance · Zona ${zone || 'otra zona'}${motivo}${minutes !== null && minutes !== undefined ? ` · ${formatMinutes(minutes)}` : ''}`
    } else if (t.kind === 'out_of_reach') {
      meta = 'Fuera de alcance'
    } else if (t.kind === 'no_road') {
      meta = 'Sin acceso por carretera'
    } else {
      meta = isLocality ? 'Localidad sin IPS objetivo hoy' : 'Tiempo por carretera pendiente de calcular'
    }
    return `<div class="opmap-tooltip__title">${escapeHtml(territoryNameOf(code, featureName))}</div>` +
      `<div class="opmap-tooltip__meta">${escapeHtml(meta)}</div>` +
      '<div class="opmap-tooltip__hint">Clic para ver el detalle</div>'
  }

  // Contenido de la tarjeta de un territorio (mismos datos que el popup de siempre)
  const territoryInfo = (code: string, isLocality: boolean, featureName: string): TerritoryInfo => {
    const t = resolveTerritory(code, isLocality)
    const name = territoryNameOf(code, featureName)
    const deptCode = municipalityByCode[code]?.department_code || code.slice(0, 2)
    const deptName = isLocality ? 'Bogotá, D.C.' : (departmentNames[deptCode] || null)
    const population = mapData.populationMap[code] || 0

    if (t.kind !== 'ips' && t.kind !== 'vacant') {
      let title: string
      let detail: string | null = null
      if (t.kind === 'reach') {
        const kam = t.kamId ? kamIndex.byId[t.kamId] : null
        const zone = zoneLabelOf(t.kamId) || 'otra zona'
        if (t.corredor) {
          title = `Zona ${zone} · De alcance: localidad sin IPS hoy; va con la zona de su corredor de salida (${corredorLabel(t.corredor) || t.corredor})`
        } else if (t.bogotaInherited) {
          title = `Zona ${zone} · De alcance: localidad sin IPS hoy; se asigna a la zona que gana Bogotá`
        } else if (t.row && t.row.travel_minutes !== null && t.row.travel_minutes !== undefined) {
          title = `Zona ${zone} · Alcance: ${formatMinutes(t.row.travel_minutes)} por carretera desde ${kam?.base_city || zone}`
        } else {
          title = `Zona ${zone} · Territorio base de la zona`
        }
        detail = 'Sin IPS objetivo hoy'
      } else if (t.kind === 'out_of_reach') {
        const nearest = zoneLabelOf(t.row?.nearest_kam_id)
        title = nearest
          ? `Fuera de alcance (más cercana: ${nearest} a ${formatMinutes(t.row?.nearest_minutes)})`
          : 'Fuera de alcance'
        detail = 'No se asigna a ninguna zona: supera el tope de tiempo por carretera.'
      } else if (t.kind === 'no_road') {
        title = 'Sin acceso por carretera'
        detail = 'Google Maps no encontró ruta desde ninguna ciudad base candidata; no se asigna a ninguna zona.'
      } else {
        title = isLocality
          ? 'Localidad sin IPS objetivo hoy · sin zona asignada'
          : 'Tiempo por carretera pendiente de calcular'
      }
      let coverage: { label: string; text: string } | null = null
      if (t.kind === 'reach' && isLineMode && lineView && t.kamId) {
        const row = lineView.byKam[t.kamId]
        coverage = {
          label: `Ejecutivo Comercial (${lineView.line.name})`,
          text: `${describeCoverage(row, lineView.zoneNameById)}${row?.has_equipment === false ? ' · sin equipo' : ''}`
        }
      }
      // Sin IPS en OpMap no hay giros ni compras que contar: una línea fija, sin llamada (solo con intelligence:view)
      const sinIpsNota = inteligenciaIncluida
        ? textoSinIps(isLocality ? 'localidad' : 'municipio')
        : null
      return { kind: 'other', name, deptName, title, detail, coverage, population, sinIpsNota }
    }

    // ----- Territorio con IPS -----
    // Modo por línea: un territorio con zona se describe con la cobertura de esa zona en la línea.
    // Los territorios sin zona (solo IPS sin asignar) conservan el texto de vacante de siempre.
    const useLineStyle = isLineMode && !!t.kamId && !!lineView
    const lineRow: CoverageRow | undefined = useLineStyle && t.kamId ? lineView!.byKam[t.kamId] : undefined
    const noEquipment = isNoEquipment(t)
    const stats = mapData.territoryStats?.[code] || {
      totalHospitals: 0,
      totalBeds: 0,
      totalAmbulances: 0,
      totalSurgeries: 0
    }
    const territoryZone = t.kamId ? kamIndex.byId[t.kamId] : undefined
    const zoneLabel = zoneDisplayName(territoryZone?.name || stats.kamName) || t.kamId?.toUpperCase() || ''

    let status: { tone: 'zone' | 'vacant' | 'conflict'; title: string; lines: string[] }
    if (useLineStyle && lineView) {
      const kind = lineRow?.kind
      const lineZoneName = zoneDisplayName(lineRow?.zone_name || territoryZone?.name || '') || zoneLabel
      const baseCity = lineRow?.base_city || territoryZone?.base_city || ''
      status = {
        tone: kind === 'vacant' ? 'vacant' : kind === 'conflict' ? 'conflict' : 'zone',
        title: `Zona: ${lineZoneName}${baseCity ? ` (ciudad base ${baseCity})` : ''}`,
        lines: [
          `Línea: ${lineView.line.name}`,
          `En esta línea: ${describeCoverage(lineRow, lineView.zoneNameById)}`,
          ...(noEquipment ? ['Sin equipo: la línea no opera en esta zona'] : [])
        ]
      }
    } else if (t.isVacant) {
      status = { tone: 'vacant', title: 'Zona sin Ejecutivo Comercial', lines: [] }
    } else {
      status = {
        tone: 'zone',
        title: `Zona: ${zoneLabel}`,
        lines: [`${zoneExecutiveLabel}: ${zoneExecutivesText(territoryZone?.executives, true)}`]
      }
    }

    return {
      kind: 'ips',
      name,
      deptName,
      stats: {
        hospitals: Number(stats.totalHospitals || 0),
        beds: Number(stats.totalBeds || 0),
        ambulances: Number(stats.totalAmbulances || 0),
        surgeries: Number(stats.totalSurgeries || 0)
      },
      population,
      bedsPer1000: population > 0 ? Number(stats.totalBeds || 0) / population * 1000 : null,
      status
    }
  }

  territoryCtxRef.current = {
    canHover,
    isHidden: (code, isLocality) => {
      const t = resolveTerritory(code, isLocality)
      return (!showReach && t.kind === 'reach') || isFilteredOutTerritory(t)
    },
    tooltip: territoryTooltipHtml,
    rest: territoryRestStyle,
    hover: territoryHoverStyle,
    open: (code, isLocality, featureName, latlng) =>
      openPopup({ kind: 'territory', code, isLocality, name: featureName, position: [latlng.lat, latlng.lng] })
  }

  const hospitalLocation = (h: any) => h.locality_id
    ? `${h.locality_name || 'Localidad'} · Bogotá, D.C.`
    : `${h.municipality_name || mapData.municipalityNames[h.municipality_id] || h.municipality_id || ''}${h.department_name ? ` · ${h.department_name}` : ''}`

  const hospitalMeta = (h: any) => [
    `${Number(h.beds || 0).toLocaleString('es-CO')} camas`,
    `Nivel ${h.service_level || 'N/A'}`,
    h.type ? (HOSPITAL_TYPE_LABELS[h.type] || h.type) : null
  ].filter(Boolean).join(' · ')

  const fichaActions = (hospitalId: string): PopupAction[] =>
    can('hospitals:view') ? [{ label: 'Ver ficha →', href: `/hospitals/${hospitalId}` }] : []

  const lineExecutiveLabel = isLineMode && lineView ? `Ejecutivo Comercial (${lineView.line.name})` : zoneExecutiveLabel

  const buildIpsPopup = (hospitalId: string): IpsPopupData | null => {
    const assignment = assignmentByHospital[hospitalId]
    if (!assignment) return null
    const hospital = assignment.hospitals
    const kamId: string = assignment.kams?.id
    const row = isLineMode && lineView ? lineView.byKam[kamId] : undefined
    return {
      name: hospital.name,
      location: hospitalLocation(hospital),
      meta: hospitalMeta(hospital),
      zone: zoneDisplayName(assignment.kams?.name) || zoneLabelOf(kamId),
      executiveLabel: lineExecutiveLabel,
      executiveText: isLineMode && lineView
        ? describeCoverage(row, lineView.zoneNameById)
        : zoneExecutivesText(kamIndex.byId[kamId]?.executives, true),
      noEquipment: isLineMode && row?.has_equipment === false,
      travelTime: assignment.travel_time !== null && assignment.travel_time !== undefined
        ? formatTravelTimeFromSeconds(assignment.travel_time)
        : null,
      actions: fichaActions(hospital.id)
    }
  }

  const buildUnassignedPopup = (hospitalId: string): UnassignedPopupData | null => {
    const hospital = unassignedById[hospitalId]
    if (!hospital) return null
    // Los tiempos vienen en SEGUNDOS desde hospital_kam_distances; solo datos reales de Google Maps
    const travelTimes: any[] = unassignedTravelTimes[hospitalId] || []
    const nearest = travelTimes.slice(0, 3).map((tt: any) => {
      const hasTime = tt.travel_time !== null && tt.travel_time !== undefined
      const minutes = hasTime ? Math.round(tt.travel_time / 60) : 0
      const isOverLimit = hasTime && minutes > (tt.max_travel_time || 240)
      const isClose = hasTime && minutes > 240 && minutes <= 300 // 5 horas
      return {
        zone: zoneDisplayName(tt.kam_name),
        time: hasTime ? formatTravelTimeFromSeconds(tt.travel_time) : 'Sin calcular',
        tone: (!hasTime ? 'none' : isClose ? 'near' : isOverLimit ? 'over' : 'ok') as 'ok' | 'near' | 'over' | 'none'
      }
    })
    const first = travelTimes[0]
    const firstMinutes = first?.travel_time ? first.travel_time / 60 : 0
    const suggestion = firstMinutes > 240 && firstMinutes <= 300
      ? `La zona ${zoneDisplayName(first.kam_name)} está a solo ${formatTravelTimeFromSeconds(first.travel_time)}. Considere ajustar su límite de tiempo máximo de 4 a 5 horas.`
      : null
    return {
      name: hospital.name,
      location: hospitalLocation(hospital),
      meta: hospitalMeta(hospital),
      nearest,
      moreCount: Math.max(0, travelTimes.length - nearest.length),
      suggestion,
      actions: fichaActions(hospital.id)
    }
  }

  const buildZonePopup = (kamId: string): ZonePopupData | null => {
    const kam = kamStatsById[kamId]
    if (!kam) return null
    const row = isLineMode && lineView ? lineView.byKam[kamId] : undefined
    const hollow = isLineMode && row?.kind === 'vacant'
    // Ejecutivo Comercial con varias zonas en la línea: "zona 2 de 4" junto a su nombre
    const tone = row && row.executive && row.kind !== 'vacant' && row.kind !== 'conflict' ? lineView?.zoneOrder[kamId] : undefined
    const counts = territorySummary.byZone[kamId] || { ips: 0, reach: 0 }
    const actions: PopupAction[] = []
    // /kams es la lista general (no tiene vista por zona)
    if (can('kams:view')) actions.push({ label: 'Ver zonas →', href: '/kams' })
    if (isLineMode && can('lines:view')) {
      actions.push({ label: 'Ver territorio →', href: '/lines', variant: actions.length > 0 ? 'secondary' : 'primary' })
    }
    return {
      name: zoneDisplayName(kam.name) || kam.name,
      baseCity: kam.base_city || null,
      color: hollow ? grisZona(kamId) : colorForZone(kamId),
      hollow,
      executiveLabel: lineExecutiveLabel,
      executiveText: isLineMode && lineView
        ? `${describeCoverage(row, lineView.zoneNameById)}`
        : zoneExecutivesText(kam.executives, true),
      executivePerson: tone && row?.executive ? executiveName(row.executive) : null,
      executiveOrdinal: tone && tone.total > 1 ? `zona ${tone.index + 1} de ${tone.total}` : null,
      noEquipment: isLineMode && row?.has_equipment === false,
      ipsCount: kam.hospitalCount,
      beds: kam.totalBeds,
      municipalitiesWithIps: counts.ips,
      municipalitiesReach: counts.reach,
      population: kam.totalPopulation,
      actions
    }
  }

  const buildClusterPopup = (ids: string[]): ClusterPopupData | null => {
    const items = ids
      .map(id => zoneBadgeItems.find(z => z.id === id))
      .filter((z): z is ZoneBadgeItem => !!z)
      .sort((a, b) => a.shortName.localeCompare(b.shortName, 'es'))
      .map(z => ({
        id: z.id,
        name: zoneLabelOf(z.id) || z.shortName,
        meta: z.tooltipMeta || null,
        color: z.color,
        hollow: z.hollow,
        onSelect: () => selectZone(z.id, [z.lat, z.lng])
      }))
    return items.length > 0 ? { items } : null
  }

  const renderActivePopup = (): ReactNode => {
    if (!activePopup) return null
    let content: ReactNode = null
    let offset: L.PointTuple | undefined
    switch (activePopup.kind) {
      case 'ips': {
        const data = buildIpsPopup(activePopup.id)
        if (data) content = <IpsPopupCard data={data} detalle={detalleProps('ips')} />
        // Por debajo de zoom 6 los puntos son compactos (2,5 px): la punta de la tarjeta se ajusta
        const compact = (mapRef.current?.getZoom() ?? IPS_FULL_SIZE_ZOOM) < IPS_FULL_SIZE_ZOOM
        offset = [0, 7 - ipsRadius(assignmentByHospital[activePopup.id]?.hospitals?.beds, compact)]
        break
      }
      case 'unassigned': {
        const data = buildUnassignedPopup(activePopup.id)
        if (data) content = <UnassignedPopupCard data={data} detalle={detalleProps('ips')} />
        offset = [0, 2]
        break
      }
      case 'zone': {
        const data = buildZonePopup(activePopup.id)
        if (data) content = <ZonePopupCard data={data} />
        offset = [0, 7 - zoneBadgeHeight(badgeSize)]
        break
      }
      case 'cluster': {
        const data = buildClusterPopup(activePopup.ids)
        if (data) content = <ClusterPopupCard data={data} />
        offset = [0, 7 - zoneBadgeHeight(clusterSize)]
        break
      }
      case 'territory':
        content = (
          <TerritoryPopupCard
            info={territoryInfo(activePopup.code, activePopup.isLocality, activePopup.name)}
            detalle={detalleProps('territorio')}
          />
        )
        break
    }
    if (!content) return null
    return (
      <MapPopup
        key={activePopup.nonce}
        nonce={activePopup.nonce}
        position={activePopup.position}
        offset={offset}
        bottomPadding={isMobile ? SHEET_PEEK_PX + 12 : 12}
        onClose={closePopup}
      >
        {content}
      </MapPopup>
    )
  }

  // ---------- Leyenda ----------

  const selectedLineName = lines.find(l => l.code === selectedLineCode)?.name ?? null
  const viewLabel = isLineMode && lineView
    ? lineView.line.name
    : mapMode === 'zones'
      ? 'Vista de zonas'
      : (selectedLineName || 'Mapa')
  // ---------- Lista de la leyenda y "Ver solo" ----------
  // Vista por línea: Ejecutivos Comerciales de la línea con el chip de su Zona, iniciales y cuentas. Vista de zonas:
  // zonas con el color de la vista.
  let groupFilter: GroupFilterConfig | null = null
  let vacantHint = ''
  if (filterKind) {
    let options: GroupFilterOption[]
    if (filterKind === 'executive' && lineView) {
      options = lineView.executives.map(e => {
        const zoneCount = lineView.counts.zonesByExecutive[e.id] || 0
        const ipsCount = ipsByExecutive[e.id] || 0
        return {
          id: e.id,
          label: executiveName(e),
          detail: `${zoneCount} ${zoneCount === 1 ? 'zona' : 'zonas'} · ${ipsCount} IPS`,
          color: lineView.executiveChipColor[e.id] ?? NO_COVERAGE_DATA_COLOR,
          initials: initialsOf(e.full_name)
        }
      })
      const vacantZones = lineView.counts.vacant
      vacantHint = `${vacantZones} ${vacantZones === 1 ? 'zona' : 'zonas'} sin Ejecutivo Comercial en esta línea e IPS sin zona`
    } else {
      options = kamStats
        .map(kam => ({
          id: String(kam.id),
          label: zoneDisplayName(kam.name) || kam.name,
          detail: `${kam.hospitalCount} IPS`,
          color: safeColor(colorForZone(kam.id), NO_COVERAGE_DATA_COLOR),
          initials: zoneInitials[kam.id] || initialsOf(kam.base_city || zoneDisplayName(kam.name))
        }))
        .sort((a, b) => a.label.localeCompare(b.label, 'es'))
      const unzoned = mapData.unassignedHospitals.length
      vacantHint = `${unzoned} IPS sin zona`
    }
    groupFilter = {
      kind: filterKind,
      options,
      selected: activeFilter,
      onChange: ids => onFilterIdsChange?.(ids)
    }
  }
  // Marcados que existen en la vista (un enlace puede traer ids de otra línea)
  const filteredOptionIds = groupFilter && activeFilter ? selectedOptionIds(groupFilter) : null
  // "1 ejecutiva": va en el subtítulo de la leyenda de escritorio, donde está la lista
  const groupChipLabel = groupFilter && filteredOptionIds ? groupFilterChipLabel(groupFilter.kind, filteredOptionIds.length) : null
  // El bloque "IPS" (servicios/camas) oculta puntos: el botón de Filtros lo indica para que el mapa sin puntos se entienda
  const filterChipLabel = isIpsFilterActive(ipsServiceFilter) ? 'IPS filtradas' : null
  // Resumen de "Ver solo" para la pestaña Visitas
  const verSolo: VerSoloResumen | null = groupFilter
    ? { kind: groupFilter.kind, marcados: filteredOptionIds ? filteredOptionIds.length : null, total: groupFilter.options.length }
    : null

  let viewSubtitle = isLineMode && lineView
    ? `${lineView.executives.length} ${lineView.executives.length === 1 ? 'Ejecutivo Comercial' : 'Ejecutivos Comerciales'} · ${lineView.rows.length} zonas`
    : `${kamStats.length} zonas`
  if (groupFilter && filteredOptionIds) {
    const only = filteredOptionIds.length === 1 ? groupFilter.options.find(o => o.id === filteredOptionIds[0]) : null
    viewSubtitle = only
      ? `Ver solo: ${only.label}`
      : `Ver solo: ${filteredOptionIds.length} de ${groupFilter.options.length} ${groupFilter.kind === 'executive' ? 'Ejecutivos Comerciales' : 'Zonas'}`
  }

  // Vista del panel de Filtros (spec 2026-10-14, en Filtros desde el 2026-10-29): Ejecutivos Comerciales (vista por
  // línea) o Zonas (colores de kams.color), para todo el que ve el mapa. Sin líneas asignadas solo queda la vista de
  // zonas. Selector de línea con más de una línea; con una, su nombre.
  const vista: MapVistaConfig | null = onMapModeChange
    ? {
        por: mapMode === 'zones' ? 'zones' : 'executives',
        onPorChange: value => onMapModeChange(value === 'zones' ? 'zones' : 'line'),
        sinLineas: lines.length === 0,
        linea: lines.length > 1
          ? { value: selectedLineCode ?? '', options: lines.map(line => ({ value: line.code, label: line.name })), onChange: value => onLineChange?.(value) }
          : null,
        lineaNombre: isLineMode && lineView ? lineView.line.name : selectedLineName
      }
    : null

  const legendStates: LegendState[] = [
    { key: 'ips', label: 'Con IPS objetivo (visitar)', swatch: swatch(LEGEND_NEUTRAL_FILL, IPS_FILL_OPACITY), count: territoryLegend.ips },
    { key: 'reach', label: 'De alcance (sin IPS hoy)', swatch: swatch(LEGEND_NEUTRAL_FILL, REACH_FILL_OPACITY), count: territoryLegend.reach },
    isLineMode && lineView
      ? { key: 'vacant', label: 'Sin cobertura en esta línea (gris, un tono por Zona)', swatch: swatch(grisSinCoberturaMuestra, VACANT_FILL_OPACITY, VACANT_BORDER_COLOR), count: lineView.counts.vacant }
      : { key: 'vacant', label: 'IPS sin Zona', swatch: swatch(VACANT_FILL_COLOR, VACANT_FILL_OPACITY, VACANT_BORDER_COLOR) }
  ]
  if (isLineMode && lineView && lineView.counts.conflict > 0) {
    legendStates.push({ key: 'conflict', label: 'Zonas en conflicto', swatch: swatch(CONFLICT_FILL_COLOR, CONFLICT_FILL_OPACITY), count: lineView.counts.conflict })
  }
  if (isLineMode && lineView && lineView.counts.noEquipment > 0) {
    legendStates.push({ key: 'noequip', label: 'Zonas sin equipo (rayado)', swatch: NO_EQUIPMENT_SWATCH, count: lineView.counts.noEquipment })
  }
  legendStates.push(
    { key: 'out', label: 'Fuera de alcance', swatch: swatch(OUT_OF_REACH_FILL_COLOR, OUT_OF_REACH_FILL_OPACITY, OUT_OF_REACH_BORDER_COLOR, true), count: territoryLegend.outOfReach },
    { key: 'noroad', label: 'Sin acceso terrestre', swatch: NO_ROAD_SWATCH, count: territoryLegend.noRoad }
  )
  if (territoryLegend.pending > 0) {
    legendStates.push({ key: 'pending', label: 'Pendiente de calcular', swatch: swatch(PENDING_FILL_COLOR, PENDING_FILL_OPACITY, PENDING_BORDER_COLOR), count: territoryLegend.pending })
  }

  // Muestras de los marcadores en la leyenda: una zona real del primer grupo que se ve (mismo color
  // e iniciales que en el mapa), el punto de IPS de ese color, la IPS sin zona y el racimo neutro
  const firstVisibleGroup = filteredOptionIds?.[0] ?? groupFilter?.options[0]?.id
  const sampleZone = zoneBadgeItems.find(z => !z.hollow && z.groupKey === firstVisibleGroup) ??
    zoneBadgeItems.find(z => !z.hollow)
  const sampleColor = sampleZone?.color ?? LEGEND_NEUTRAL_FILL
  const legendMarkers = {
    ipsColor: sampleColor,
    unzonedIpsColor: IPS_UNZONED_COLOR,
    zoneColor: sampleColor,
    zoneTextColor: readableTextColor(sampleColor),
    zoneText: sampleZone?.text ?? 'Ba',
    clusterColor: CLUSTER_NEUTRAL_COLOR,
    clusterTextColor: readableTextColor(CLUSTER_NEUTRAL_COLOR),
    // Vista por línea con Zonas sin cobertura: sus IPS van en el gris de cada Zona, a tamaño normal; la leyenda
    // muestra el de la primera
    vacantIpsColor: isLineMode && lineView && lineView.counts.vacant > 0 ? grisSinCoberturaMuestra : null
  }

  const legendNotes: LegendNote[] = [
    { tone: 'info', text: 'Los municipios sin IPS se reparten por tiempo real de carretera (Google Maps); sin ruta por carretera no se asignan a ninguna zona.' }
  ]
  if (isLineMode && lineView && lineView.rows.length === 0) {
    legendNotes.push({ tone: 'warn', text: 'No hay cobertura calculada para esta línea. Recalcúlala desde Líneas.' })
  }
  if (territoryLegend.noMunicipalityData) {
    legendNotes.push({ tone: 'warn', text: 'Aún no hay tiempos por carretera de los municipios sin IPS: se muestran como pendientes.' })
  }
  if (territoryLegend.geoError) {
    legendNotes.push({ tone: 'error', text: 'No se pudieron cargar los límites de municipios. Recarga la página.' })
  }

  const legendProps = {
    grupo: groupFilter,
    states: legendStates,
    markers: legendMarkers,
    notes: legendNotes
  }

  // "Mostrar" del panel de Filtros
  const mostrar: MapMostrarConfig = {
    showIps,
    onShowIps: setShowIps,
    showReach,
    onShowReach: setShowReach,
    showVacant,
    onShowVacant: changeShowVacant,
    vacantHint
  }

  const controlsProps = {
    mapData,
    hospitalTypeFilter,
    setHospitalTypeFilter,
    // "Mostrando N IPS en el mapa": lo que queda en el mapa con todos los filtros
    filteredAssignments: visibleAssignments,
    filteredUnassignedHospitals: visibleUnassigned,
    onVisitsChange: setVisits,
    onShowHeatmapChange: setShowHeatmap,
    onShowMarkersChange: setShowMarkers,
    ipsServiceFilter,
    onIpsServiceFilterChange: setIpsServiceFilter,
    visitsEnabled,
    onVisitsEnabledChange: setVisitsEnabled,
    vista,
    verSolo,
    mostrar,
    visitKamIds,
    filterChipLabel,
    filtersTabRequest
  }

  return (
    <>
      {/* Escritorio: Filtros y visitas en el panel flotante de siempre */}
      {!isMobile && <MapControls variant="floating" {...controlsProps} />}

      {/* Patrones SVG que usan las capas SVG de Leaflet con fill url(#id): trama de puntos de "sin acceso
          terrestre" (siempre) y rayado de "sin equipo" (uno por color usado en la línea) */}
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
        <defs>
          <pattern id={NO_ROAD_PATTERN_ID} patternUnits="userSpaceOnUse" width="6" height="6">
            <circle cx="3" cy="3" r="0.9" fill={NO_ROAD_DOT_COLOR} fillOpacity="0.6" />
          </pattern>
          {isLineMode && lineView && Array.from(new Set([
              // El color con que se pinta cada zona de la línea (zoneLineColor: su color, su gris o el ámbar): una zona
              // sin equipo lleva el rayado de ese mismo color
              ...lineView.rows.map(r => safeColor(zoneLineColor(r.kam_id), NO_COVERAGE_DATA_COLOR)),
              VACANT_COLOR,
              VACANT_FILL_COLOR,
              CONFLICT_COLOR,
              NO_COVERAGE_DATA_COLOR
            ])).map(hex => (
              <pattern
                key={hex}
                id={noEquipmentPatternId(hex)}
                patternUnits="userSpaceOnUse"
                width="8"
                height="8"
                patternTransform="rotate(45)"
              >
                <rect width="8" height="8" fill={hex} fillOpacity="0.15" />
                <line x1="0" y1="0" x2="0" y2="8" stroke={hex} strokeWidth="3" strokeOpacity="0.75" />
              </pattern>
            ))}
        </defs>
      </svg>

      <div className={`opmap-map${isMobile ? ' opmap-map--mobile' : ''}`}>
        <MapContainer
          ref={mapRef}
          center={DEFAULT_CENTER}
          zoom={initialZoom}
          className="h-full w-full"
          preferCanvas={true}
          renderer={vectorRenderer}
          zoomControl={false}
          attributionControl={false}
        >
          <MapController />
          <TileLayer
            key={isMobile ? 'basemap-compact' : 'basemap-full'}
            attribution={isMobile ? COMPACT_ATTRIBUTION : BASEMAP_ATTRIBUTION}
            url={BASEMAP_URL}
            maxNativeZoom={BASEMAP_MAX_NATIVE_ZOOM}
            eventHandlers={{ tileerror: handleTileError }}
          />
          {/* Móvil: atribución corta y zoom pequeño abajo a la derecha, por encima de la hoja inferior */}
          <AttributionControl
            key={isMobile ? 'attribution-compact' : 'attribution-full'}
            position={isMobile ? 'bottomright' : 'bottomleft'}
            {...(isMobile ? { prefix: false as const } : {})}
          />
          <ZoomControl key={isMobile ? 'zoom-mobile' : 'zoom-desktop'} position={isMobile ? 'bottomright' : 'topright'} />

          {/* Todos los municipios (sin Bogotá) y las localidades, estilo por feature. Con IPS: color de la zona 0.55;
              sin IPS: alcance / fuera de alcance / sin carretera. Una capa por departamento: desde DETALLE_ZOOM la de
              cada departamento que se ve cambia a su detalle sin volver a crear las demás. */}
          {capasMunicipios.map(capa => (
            <GeoJSON
              key={capa.key}
              data={capa.data as any}
              style={municipiosStyle}
              eventHandlers={municipiosHandlers}
            />
          ))}
          {localidadesVista && (
            <GeoJSON
              key={detallePorDepto[DEPTO_LOCALIDADES] ? 'geo-localidades-detalle' : 'geo-localidades'}
              data={localidadesVista}
              style={localidadesStyle}
              eventHandlers={localidadesHandlers}
            />
          )}
          <DeptosEnVista rectangulos={rectangulosDepto} onChange={onDeptosEnVista} />
          {/* Rayado "sin equipo" de la línea (SVG, sin eventos), en un panel bajo el canvas de territorios */}
          <Pane name={HATCH_PANE} style={{ zIndex: 390 }}>
            {noEquipmentOverlay && (
              <GeoJSON
                key={noEquipmentOverlay.key}
                data={noEquipmentOverlay.data as any}
                style={noEquipmentOverlayStyle}
                interactive={false}
                {...({ renderer: hatchRenderer } as any)}
              />
            )}
          </Pane>
          {/* Trama de puntos de "sin acceso terrestre" (SVG, sin eventos), justo encima del canvas */}
          <Pane name={NO_ROAD_PANE} style={{ zIndex: 405, pointerEvents: 'none' }}>
            {noRoadOverlay && (
              <GeoJSON
                key={noRoadOverlay.key}
                data={noRoadOverlay.data as any}
                style={NO_ROAD_OVERLAY_STYLE}
                interactive={false}
                {...({ renderer: noRoadRenderer } as any)}
              />
            )}
          </Pane>
          {/* Nombres de lugares encima de los polígonos y debajo de las insignias; no recibe toques */}
          {LABELS_URL && <MapLabelsLayer pane={LABELS_PANE} zIndex={LABELS_PANE_Z} url={LABELS_URL} maxNativeZoom={LABELS_MAX_NATIVE_ZOOM} />}

          {/* Puntos de IPS encima de los territorios y de los nombres (en móvil desde zoom 5; compactos por
              debajo de 6). SVG en su panel; en táctil cada punto lleva un área de toque transparente. */}
          <Pane name={IPS_PANE} style={{ zIndex: IPS_PANE_Z, pointerEvents: 'none' }}>
            {geoSettled && showIps && (
              <IpsZoomLayer minZoom={isMobile ? MOBILE_IPS_MIN_ZOOM : 0} renderer={ipsRenderer} touch={!canHover}>
                {ipsMarkers}
                {unassignedMarkers}
              </IpsZoomLayer>
            )}
          </Pane>

          {/* Insignias de zona (ciudad base) con racimos cuando se tocan en pantalla */}
          <ZoneBadgeLayer
            zones={zoneBadgeItems}
            size={badgeSize}
            clusterSize={clusterSize}
            textSize={badgeTextSize}
            showTooltip={canHover}
            insetLeft={isMobile || legendCollapsed ? 0 : LEGEND_INSET_PX}
            insetBottom={isMobile ? SHEET_PEEK_PX : 0}
            onSelect={selectZone}
            onClusterList={listCluster}
          />

          {/* Mapa de calor de visitas: apagado por defecto; radio y desenfoque según el zoom */}
          {showHeatmap && shownVisits.length > 0 && (
            <VisitsHeatmapLayer visits={shownVisits} intensity={0.5} maxZoom={15} gradient={HEAT_GRADIENT} />
          )}

          {/* Marcadores individuales de visitas, solo desde zoom 10 */}
          {geoSettled && showMarkers && shownVisits.length > 0 && (
            <ZoomGate min={VISIT_MARKERS_MIN_ZOOM}>{visitMarkers}</ZoomGate>
          )}

          {renderActivePopup()}
        </MapContainer>

        {/* Buscador único (municipio, departamento, localidad o IPS): arriba a la derecha en escritorio; a lo ancho en el teléfono */}
        {territoriosParaBuscar.length > 0 && (
          <MapSearchBox
            territorios={territoriosParaBuscar}
            onSelect={irATerritorio}
            className={isMobile ? 'absolute left-3 right-3 top-3' : 'absolute right-14 top-3 w-[22rem]'}
          />
        )}
      </div>

      {/* Escritorio: leyenda flotante abajo a la izquierda */}
      {!isMobile && (
        <MapLegendCard title="Leyenda" subtitle={groupChipLabel ? `${viewLabel} · ${groupChipLabel}` : viewLabel} collapsed={legendCollapsed} onCollapsedChange={setLegendCollapsed}>
          <MapLegend {...legendProps} />
        </MapLegendCard>
      )}

      {/* Móvil: hoja inferior con la leyenda y, a altura completa, Filtros y visitas */}
      {isMobile && (
        <MapBottomSheet
          snap={sheetSnap}
          onSnapChange={setSheetSnap}
          title={viewLabel}
          subtitle={viewSubtitle}
          filterChip={filterChipLabel}
          onOpenFilters={() => setFiltersTabRequest(n => n + 1)}
          secondary={<MapControls variant="embedded" {...controlsProps} />}
        >
          <MapLegend {...legendProps} touch />
        </MapBottomSheet>
      )}

      {/* Aviso no bloqueante: el proveedor del mapa base no responde (territorios y marcadores siguen visibles) */}
      {basemapError && (
        <div
          role="status"
          className="absolute bottom-20 md:bottom-4 left-1/2 -translate-x-1/2 z-[1000] pointer-events-none rounded-md bg-white/95 border border-amber-300 px-3 py-1.5 text-xs text-amber-800 shadow"
        >
          No se pudo cargar el mapa base
        </div>
      )}
    </>
  )
}
