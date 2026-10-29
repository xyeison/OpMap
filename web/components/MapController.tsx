'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useMap, useMapEvent } from 'react-leaflet'
import { deptosEnVista, type Rectangulo } from '@/lib/geo-detalle'

interface MapControllerProps {
  center?: [number, number]
  zoom?: number
}

export default function MapController({ center, zoom }: MapControllerProps) {
  const map = useMap()

  useEffect(() => {
    if (center && zoom) {
      map.setView(center, zoom)
    }
  }, [center, zoom, map])

  // Guardar referencia global del mapa
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).mapInstance = map
    }
  }, [map])

  return null
}

/**
 * Muestra sus hijos solo desde un nivel de zoom (p. ej. puntos de IPS en móvil desde zoom 6,
 * marcadores de visitas desde zoom 10). Solo este componente se vuelve a renderizar al hacer zoom.
 */
export function ZoomGate({ min, children }: { min: number; children: ReactNode }) {
  const map = useMap()
  const [zoom, setZoom] = useState(() => map.getZoom())
  useMapEvent('zoomend', () => setZoom(map.getZoom()))
  return zoom >= min ? <>{children}</> : null
}

/**
 * Avisa, al terminar cada movimiento o zoom, qué departamentos se ven y el zoom (detalle de los polígonos al
 * acercar, lib/geo-detalle.ts). No dibuja nada.
 */
export function DeptosEnVista({ rectangulos, onChange }: {
  rectangulos: Record<string, Rectangulo[]>
  onChange: (deptos: string[], zoom: number) => void
}) {
  const map = useMap()
  const avisar = useCallback(() => {
    const b = map.getBounds()
    const zoom = map.getZoom()
    onChange(deptosEnVista([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()], zoom, rectangulos), zoom)
  }, [map, rectangulos, onChange])
  useEffect(() => { avisar() }, [avisar])
  useMapEvent('moveend', avisar)
  return null
}
