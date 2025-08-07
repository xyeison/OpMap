'use client'

import { useEffect } from 'react'
import { useMap } from 'react-leaflet'

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