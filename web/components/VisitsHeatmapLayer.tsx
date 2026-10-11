'use client'

import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import 'leaflet'

// leaflet.heat se registra sobre el L global
declare global {
  interface Window {
    L: any
  }
}

interface Visit {
  lat: number
  lng: number
  visit_type: string
  contact_type: string
  kam_name?: string
}

interface VisitsHeatmapLayerProps {
  visits: Visit[]
  intensity?: number
  maxZoom?: number
  gradient?: Record<number, string>
}

const DEFAULT_GRADIENT: Record<number, string> = {
  0.0: 'blue',
  0.25: 'cyan',
  0.5: 'lime',
  0.75: 'yellow',
  1.0: 'red'
}

// Radio y desenfoque según el zoom: a escala país manchas pequeñas; en ciudad, más amplias
export function heatOptionsForZoom(zoom: number): { radius: number; blur: number } {
  if (zoom <= 7) return { radius: 8, blur: 12 }
  if (zoom <= 10) return { radius: 14, blur: 20 }
  return { radius: 22, blur: 28 }
}

// Coordenadas válidas (pueden llegar como texto desde la API)
const isValidVisit = (visit: Visit) => {
  const lat = Number(visit?.lat)
  const lng = Number(visit?.lng)
  return Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0 &&
    lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
}

// Peso sutil por tipo de visita; las presenciales pesan un poco más
const visitWeight = (visit: Visit) => {
  let weight = 0.3
  if (visit.visit_type === 'Visita efectiva') weight = 0.6
  else if (visit.visit_type === 'Visita extra') weight = 0.4
  if (visit.contact_type === 'Visita presencial') weight *= 1.1
  return weight
}

export function VisitsHeatmapLayer({
  visits,
  intensity = 1,
  maxZoom = 18,
  gradient = DEFAULT_GRADIENT
}: VisitsHeatmapLayerProps) {
  const map = useMap()
  const heatLayerRef = useRef<any>(null)

  // La capa se crea cuando cambian las visitas; el zoom solo ajusta radio y desenfoque
  useEffect(() => {
    const points: Array<[number, number, number]> = (Array.isArray(visits) ? visits : [])
      .filter(isValidVisit)
      .map(visit => [Number(visit.lat), Number(visit.lng), visitWeight(visit)])
    if (points.length === 0) return

    let cancelled = false
    import('leaflet.heat')
      .then(() => {
        if (cancelled) return
        if (!window.L?.heatLayer) {
          console.error('leaflet.heat no está disponible después de cargar')
          return
        }
        const layer = window.L.heatLayer(points, {
          ...heatOptionsForZoom(map.getZoom()),
          maxZoom,
          max: intensity,
          gradient,
          minOpacity: 0.5
        })
        layer.addTo(map)
        heatLayerRef.current = layer
      })
      .catch(error => console.error('Error cargando leaflet.heat:', error))

    return () => {
      cancelled = true
      if (heatLayerRef.current) {
        map.removeLayer(heatLayerRef.current)
        heatLayerRef.current = null
      }
    }
  }, [map, visits, intensity, maxZoom, gradient])

  useEffect(() => {
    const onZoomEnd = () => {
      heatLayerRef.current?.setOptions(heatOptionsForZoom(map.getZoom()))
    }
    map.on('zoomend', onZoomEnd)
    return () => {
      map.off('zoomend', onZoomEnd)
    }
  }, [map])

  return null
}
