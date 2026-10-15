'use client'

import { createContext, memo, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { CircleMarker, Tooltip, useMap, useMapEvent } from 'react-leaflet'
import type { LatLngTuple, PathOptions, Renderer } from 'leaflet'
import {
  IPS_POINT_BORDER_COLOR,
  IPS_POINT_BORDER_WEIGHT,
  IPS_POINT_FILL_OPACITY,
  IPS_UNZONED_COLOR
} from './mapStyles'

// Ejecutivo Comercial que vive en la zona (viene de /api/map/data, campo kams[].executives)
export interface ZoneExecutive {
  id: string
  full_name: string
  status: string
}

// Texto plano con los Ejecutivos Comerciales de una zona. Quien lo inserte en HTML crudo debe escaparlo.
// emptyText: lo que se dice si no hay ninguno (en la vista de zonas, quien no ve todas las líneas solo recibe a
// los de sus líneas: "sin ejecutivo local" daría a entender que la zona no tiene a nadie).
export const formatZoneExecutives = (executives?: ZoneExecutive[] | null, emptyText = 'sin ejecutivo local'): string => {
  const list = Array.isArray(executives) ? executives : []
  if (list.length === 0) return emptyText
  return list
    .map(e => (e.status === 'placeholder' ? `${e.full_name} (por contratar)` : e.full_name))
    .join(', ')
}

// Radio del punto según las camas: 4 px; desde 100 camas 5,5 px; desde 300 camas 7 px.
// Compacto (vista de país, zoom < 6): 2,5 px para que el mapa no abra saturado.
export const COMPACT_IPS_RADIUS = 2.5
export const ipsRadius = (beds: unknown, compact = false): number => {
  if (compact) return COMPACT_IPS_RADIUS
  const n = Number(beds) || 0
  if (n >= 300) return 7
  if (n >= 100) return 5.5
  return 4
}
export const UNZONED_IPS_RADIUS = 3.5

// Zoom desde el que los puntos tienen su tamaño normal
export const IPS_FULL_SIZE_ZOOM = 6

// Radio del área de toque transparente de cada punto en pantallas táctiles (el SVG no tiene la
// tolerancia del canvas)
export const IPS_TOUCH_RADIUS = 11

// Lo lee cada marcador: puntos compactos (zoom bajo), renderer SVG del panel de IPS y si hay que
// añadir el área de toque. Cambiar de zoom no recrea los marcadores.
interface IpsRenderOptions {
  compact: boolean
  renderer?: Renderer
  touch: boolean
}
const IpsRenderContext = createContext<IpsRenderOptions>({ compact: false, touch: false })

const TOUCH_TARGET_STYLE: PathOptions = { stroke: false, fill: true, fillColor: '#000000', fillOpacity: 0 }

/**
 * Capa de puntos de IPS dependiente del zoom: oculta sus hijos por debajo de `minZoom` (en móvil, 5)
 * y los dibuja compactos por debajo de IPS_FULL_SIZE_ZOOM. Solo este componente se vuelve a
 * renderizar al hacer zoom; los marcadores memoizados solo cambian de radio.
 */
export function IpsZoomLayer({ minZoom, renderer, touch = false, children }: { minZoom: number; renderer?: Renderer; touch?: boolean; children: ReactNode }) {
  const map = useMap()
  const [zoom, setZoom] = useState(() => map.getZoom())
  useMapEvent('zoomend', () => setZoom(map.getZoom()))
  const compact = zoom < IPS_FULL_SIZE_ZOOM
  const value = useMemo(() => ({ compact, renderer, touch }), [compact, renderer, touch])
  if (zoom < minZoom) return null
  return <IpsRenderContext.Provider value={value}>{children}</IpsRenderContext.Provider>
}

const isFiniteCoord = (lat: number, lng: number) => Number.isFinite(lat) && Number.isFinite(lng)

// Área de toque transparente (solo táctil): mismo manejador que el punto
function TouchTarget({ center, renderer, onClick }: { center: LatLngTuple; renderer?: Renderer; onClick: () => void }) {
  const eventHandlers = useMemo(() => ({ click: onClick }), [onClick])
  return (
    <CircleMarker
      center={center}
      radius={IPS_TOUCH_RADIUS}
      pathOptions={TOUCH_TARGET_STYLE}
      eventHandlers={eventHandlers}
      {...(renderer ? { renderer } : {})}
    />
  )
}

export type HospitalSelectHandler = (id: string, position: LatLngTuple) => void

interface HospitalMarkerProps {
  id: string
  lat: number
  lng: number
  name: string
  beds: unknown
  // Color de la vista activa (Ejecutivo Comercial en la línea o zona), ya validado
  color: string
  // Atenuado mientras se resalta otro Ejecutivo Comercial / zona en la leyenda
  dimmed?: boolean
  // Solo con cursor real: en táctil no hay hover y el toque abre directamente la tarjeta
  showTooltip: boolean
  onSelect: HospitalSelectHandler
}

const pointStyle = (fillColor: string, dimmed: boolean, compact: boolean): PathOptions => ({
  color: IPS_POINT_BORDER_COLOR,
  weight: compact ? 1 : IPS_POINT_BORDER_WEIGHT,
  opacity: dimmed ? 0.35 : 1,
  fillColor,
  fillOpacity: dimmed ? 0.25 : IPS_POINT_FILL_OPACITY
})

/**
 * Punto de IPS asignada: color de la vista, borde blanco, tamaño por camas. Tocar o hacer clic abre
 * la tarjeta de la IPS (en táctil, con un área de toque transparente más grande). Memoizado: cambiar
 * de línea solo cambia el color (setStyle), el marcador no se vuelve a crear.
 */
function HospitalMarkerBase({ id, lat, lng, name, beds, color, dimmed = false, showTooltip, onSelect }: HospitalMarkerProps) {
  const { compact, renderer, touch } = useContext(IpsRenderContext)
  const center = useMemo<LatLngTuple>(() => [lat, lng], [lat, lng])
  const pathOptions = useMemo(() => pointStyle(color, dimmed, compact), [color, dimmed, compact])
  const handleClick = useCallback(() => onSelect(id, center), [id, center, onSelect])
  const eventHandlers = useMemo(() => ({ click: handleClick }), [handleClick])

  // Coordenadas inválidas: no se dibuja (Leaflet lanzaría "Invalid LatLng object")
  if (!isFiniteCoord(lat, lng)) return null

  return (
    <>
      {touch && <TouchTarget center={center} renderer={renderer} onClick={handleClick} />}
      <CircleMarker
        center={center}
        radius={ipsRadius(beds, compact)}
        pathOptions={pathOptions}
        eventHandlers={eventHandlers}
        {...(renderer ? { renderer } : {})}
      >
        {showTooltip && (
          <Tooltip direction="top" offset={[0, -4]} opacity={1} className="opmap-tooltip">
            {name}
          </Tooltip>
        )}
      </CircleMarker>
    </>
  )
}

export default memo(HospitalMarkerBase)

interface UnassignedHospitalMarkerProps {
  id: string
  lat: number
  lng: number
  name: string
  dimmed?: boolean
  showTooltip: boolean
  onSelect: HospitalSelectHandler
}

/** IPS sin zona en la vista (incluye departamentos excluidos): punto gris pequeño con borde blanco. */
function UnassignedHospitalMarkerBase({ id, lat, lng, name, dimmed = false, showTooltip, onSelect }: UnassignedHospitalMarkerProps) {
  const { compact, renderer, touch } = useContext(IpsRenderContext)
  const center = useMemo<LatLngTuple>(() => [lat, lng], [lat, lng])
  const pathOptions = useMemo<PathOptions>(() => ({
    ...pointStyle(IPS_UNZONED_COLOR, dimmed, compact),
    weight: 1
  }), [dimmed, compact])
  const handleClick = useCallback(() => onSelect(id, center), [id, center, onSelect])
  const eventHandlers = useMemo(() => ({ click: handleClick }), [handleClick])

  if (!isFiniteCoord(lat, lng)) return null

  return (
    <>
      {touch && <TouchTarget center={center} renderer={renderer} onClick={handleClick} />}
      <CircleMarker
        center={center}
        radius={compact ? COMPACT_IPS_RADIUS : UNZONED_IPS_RADIUS}
        pathOptions={pathOptions}
        eventHandlers={eventHandlers}
        {...(renderer ? { renderer } : {})}
      >
        {showTooltip && (
          <Tooltip direction="top" offset={[0, -4]} opacity={1} className="opmap-tooltip">
            {name}
          </Tooltip>
        )}
      </CircleMarker>
    </>
  )
}

export const UnassignedHospitalMarker = memo(UnassignedHospitalMarkerBase)
