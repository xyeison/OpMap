'use client'

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Marker, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import { zoneBadgeIcon, zoneClusterIcon, ZONE_BADGE_TAIL_PX } from './ZoneBadgeIcon'
import { colorDeRacimo } from './mapStyles'

// Insignias de zona con agrupación por colisión: a cada zoom se proyectan las zonas a píxeles y las
// que se tocan (distancia entre centros < diámetro + 6 px; en vertical se suma la punta) se dibujan
// como UNA insignia "racimo" con el número de zonas. Tocar un racimo acerca el mapa a sus zonas; si ya
// no se pueden separar (misma ubicación o zoom máximo), abre la lista de sus zonas. Ninguna zona se
// oculta sin estar representada en un racimo.

export interface ZoneBadgeItem {
  id: string
  lat: number
  lng: number
  // Color de la vista (colorForZone: el de la Zona en las dos vistas) y texto de la insignia (iniciales
  // de la ciudad base)
  color: string
  text: string
  hollow: boolean
  // Nombre corto para la lista del racimo ("Chapinero")
  shortName: string
  // Nombre accesible de la insignia ("Zona Chapinero")
  label: string
  // Grupo en la vista (Ejecutivo Comercial en la línea, la zona en la vista de Zonas): muestra de la leyenda
  groupKey: string | null
  tooltipTitle: string
  tooltipMeta?: string | null
}

interface ZoneBadgeLayerProps {
  zones: ZoneBadgeItem[]
  size: number
  clusterSize: number
  textSize: number
  showTooltip: boolean
  // Espacio tapado por la interfaz al acercar a un racimo: leyenda a la izquierda (escritorio) y hoja
  // inferior (móvil). Se suma al margen de 40 px para que las zonas del racimo queden a la vista.
  insetLeft?: number
  insetBottom?: number
  onSelect: (id: string, position: L.LatLngTuple) => void
  // Racimo que ya no se separa al acercar: lista de sus zonas (ids) en la posición del racimo
  onClusterList: (ids: string[], position: L.LatLngTuple) => void
}

const COLLISION_GAP_PX = 6
const CLUSTER_PADDING_PX = 40
const CLUSTER_MAX_ZOOM = 10

interface PixelGroup {
  ids: string[]
  x: number
  y: number
}

/**
 * Agrupación greedy por colisión. Empieza con una insignia por zona y fusiona el primer par que se
 * toque hasta que no quede ninguno; un racimo se ubica en el centroide de sus zonas y mide
 * `clusterSize`, así que tras cada fusión se vuelve a comprobar contra el resto.
 */
function groupByCollision(map: L.Map, zones: ZoneBadgeItem[], size: number, clusterSize: number): string[][] {
  let groups: PixelGroup[] = zones.map(z => {
    const p = map.latLngToContainerPoint([z.lat, z.lng])
    return { ids: [z.id], x: p.x, y: p.y }
  })
  const diameter = (g: PixelGroup) => (g.ids.length > 1 ? clusterSize : size)
  let merged = true
  while (merged && groups.length > 1) {
    merged = false
    for (let i = 0; i < groups.length && !merged; i++) {
      for (let j = i + 1; j < groups.length; j++) {
        const a = groups[i]
        const b = groups[j]
        // Elipse: en vertical también cuenta la punta bajo el círculo (las insignias se anclan en ella)
        const threshold = (diameter(a) + diameter(b)) / 2 + COLLISION_GAP_PX
        const thresholdY = threshold + ZONE_BADGE_TAIL_PX
        const dx = (a.x - b.x) / threshold
        const dy = (a.y - b.y) / thresholdY
        if (dx * dx + dy * dy < 1) {
          const n = a.ids.length + b.ids.length
          groups[i] = {
            ids: [...a.ids, ...b.ids],
            x: (a.x * a.ids.length + b.x * b.ids.length) / n,
            y: (a.y * a.ids.length + b.y * b.ids.length) / n
          }
          groups = groups.filter((_, k) => k !== j)
          merged = true
          break
        }
      }
    }
  }
  return groups.map(g => g.ids)
}

const groupsSignature = (groups: string[][]) => groups.map(ids => [...ids].sort().join(',')).sort().join('|')

// ---------- Insignia de una zona ----------

interface SingleBadgeProps {
  zone: ZoneBadgeItem
  size: number
  textSize: number
  showTooltip: boolean
  onSelect: (id: string, position: L.LatLngTuple) => void
}

const SingleBadge = memo(function SingleBadge({ zone, size, textSize, showTooltip, onSelect }: SingleBadgeProps) {
  const position = useMemo<L.LatLngTuple>(() => [zone.lat, zone.lng], [zone.lat, zone.lng])
  const icon = zoneBadgeIcon({ color: zone.color, size, text: zone.text, textSize, hollow: zone.hollow, label: zone.label })
  const eventHandlers = useMemo(() => ({ click: () => onSelect(zone.id, position) }), [onSelect, zone.id, position])
  return (
    <Marker position={position} icon={icon} zIndexOffset={1000} eventHandlers={eventHandlers}>
      {showTooltip && (
        <Tooltip direction="top" opacity={1} className="opmap-tooltip">
          <div className="opmap-tooltip__title">{zone.tooltipTitle}</div>
          {zone.tooltipMeta && <div className="opmap-tooltip__meta">{zone.tooltipMeta}</div>}
        </Tooltip>
      )}
    </Marker>
  )
})

// ---------- Racimo ----------

interface ClusterBadgeProps {
  members: ZoneBadgeItem[]
  size: number
  textSize: number
  showTooltip: boolean
  insetLeft: number
  insetBottom: number
  onClusterList: (ids: string[], position: L.LatLngTuple) => void
}

const ClusterBadge = memo(function ClusterBadge({ members, size, textSize, showTooltip, insetLeft, insetBottom, onClusterList }: ClusterBadgeProps) {
  const map = useMap()
  const position = useMemo<L.LatLngTuple>(() => [
    members.reduce((s, m) => s + m.lat, 0) / members.length,
    members.reduce((s, m) => s + m.lng, 0) / members.length
  ], [members])
  // Todas vacantes en la línea: racimo hueco pizarra (como sus insignias). Si no, el color de sus Zonas cuando
  // todas tienen el mismo; si no, neutro (colorDeRacimo, igual en las dos vistas desde el 2026-10-28)
  const allHollow = members.every(m => m.hollow)
  const color = colorDeRacimo(members)
  const names = useMemo(() => members.map(m => m.shortName).sort((a, b) => a.localeCompare(b, 'es')), [members])
  const label = `${members.length} zonas: ${names.join(', ')}`
  const icon = zoneClusterIcon({ color, size, count: members.length, textSize: textSize + 1, hollow: allHollow, label })

  const eventHandlers = useMemo(() => ({
    click: () => {
      const bounds = L.latLngBounds(members.map(m => [m.lat, m.lng] as L.LatLngTuple))
      const zoom = map.getZoom()
      // Misma ubicación o ya en el zoom máximo: acercar no las separa; se abre la lista de sus zonas
      const samePoint = bounds.getNorthEast().equals(bounds.getSouthWest())
      if (samePoint || zoom >= map.getMaxZoom()) {
        onClusterList(members.map(m => m.id), position)
        return
      }
      // Si ya se está muy cerca y siguen juntas, se acerca un poco más
      const maxZoom = zoom >= CLUSTER_MAX_ZOOM ? Math.min(map.getMaxZoom(), zoom + 3) : CLUSTER_MAX_ZOOM
      // Sin espacio suficiente (pantalla estrecha) se ignora la leyenda para no invertir el encuadre
      const mapSize = map.getSize()
      const left = mapSize.x - insetLeft > 3 * CLUSTER_PADDING_PX + 120 ? insetLeft : 0
      map.flyToBounds(bounds, {
        paddingTopLeft: [CLUSTER_PADDING_PX + left, CLUSTER_PADDING_PX],
        paddingBottomRight: [CLUSTER_PADDING_PX, CLUSTER_PADDING_PX + insetBottom],
        maxZoom
      })
    }
  }), [map, members, position, insetLeft, insetBottom, onClusterList])

  return (
    <Marker position={position} icon={icon} zIndexOffset={1200} eventHandlers={eventHandlers}>
      {showTooltip && (
        <Tooltip direction="top" opacity={1} className="opmap-tooltip">
          <div className="opmap-tooltip__title">{members.length} zonas</div>
          <div className="opmap-tooltip__meta">{names.join(', ')}</div>
          <div className="opmap-tooltip__hint">Clic para acercar</div>
        </Tooltip>
      )}
    </Marker>
  )
})

// ---------- Capa ----------

export default function ZoneBadgeLayer({
  zones,
  size,
  clusterSize,
  textSize,
  showTooltip,
  insetLeft = 0,
  insetBottom = 0,
  onSelect,
  onClusterList
}: ZoneBadgeLayerProps) {
  const map = useMap()
  const [groups, setGroups] = useState<string[][]>(() => groupByCollision(map, zones, size, clusterSize))
  const signatureRef = useRef(groupsSignature(groups))

  // Solo se vuelve a renderizar si cambia la agrupación (no en cada movimiento del mapa)
  const recompute = useCallback(() => {
    const next = groupByCollision(map, zones, size, clusterSize)
    const signature = groupsSignature(next)
    if (signature === signatureRef.current) return
    signatureRef.current = signature
    setGroups(next)
  }, [map, zones, size, clusterSize])

  useEffect(() => {
    recompute()
  }, [recompute])

  // Manejadores estables: react-leaflet vuelve a registrar los eventos si cambia el objeto
  const mapHandlers = useMemo(() => ({ zoomend: recompute, moveend: recompute, resize: recompute }), [recompute])
  useMapEvents(mapHandlers)

  // Miembros de cada grupo, memoizados por agrupación y datos: los racimos no se vuelven a renderizar
  // al abrir una tarjeta o al cambiar algo ajeno a sus zonas
  const groupMembers = useMemo(() => {
    const index: Record<string, ZoneBadgeItem> = {}
    zones.forEach(z => { index[z.id] = z })
    return groups.map(ids => ids.map(id => index[id]).filter((z): z is ZoneBadgeItem => !!z))
  }, [zones, groups])

  return (
    <>
      {groupMembers.map(members => {
        if (members.length === 0) return null
        if (members.length === 1) {
          return (
            <SingleBadge
              key={members[0].id}
              zone={members[0]}
              size={size}
              textSize={textSize}
              showTooltip={showTooltip}
              onSelect={onSelect}
            />
          )
        }
        return (
          <ClusterBadge
            key={`racimo-${members.map(m => m.id).sort().join('-')}`}
            members={members}
            size={clusterSize}
            textSize={textSize}
            showTooltip={showTooltip}
            insetLeft={insetLeft}
            insetBottom={insetBottom}
            onClusterList={onClusterList}
          />
        )
      })}
    </>
  )
}
