'use client'

import { useEffect } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet.heat'

// Extender tipos de Leaflet para incluir heatLayer
declare module 'leaflet' {
  function heatLayer(
    latlngs: Array<[number, number, number?]>,
    options?: any
  ): any
}

interface Visit {
  lat: number
  lng: number
  visit_type: string
  contact_type: string
  kam_name: string
}

interface VisitsHeatmapLayerProps {
  visits: Visit[]
  intensity?: number
  radius?: number
  blur?: number
  maxZoom?: number
  gradient?: Record<number, string>
}

export function VisitsHeatmapLayer({
  visits,
  intensity = 1,
  radius = 25,
  blur = 15,
  maxZoom = 18,
  gradient
}: VisitsHeatmapLayerProps) {
  const map = useMap()

  useEffect(() => {
    console.log('VisitsHeatmapLayer - Total visitas:', visits?.length)
    console.log('VisitsHeatmapLayer - Primeras 5 visitas:', visits?.slice(0, 5))
    
    if (!visits || visits.length === 0) {
      console.log('VisitsHeatmapLayer - No hay visitas para mostrar')
      return
    }

    // Convertir visitas a formato de heatmap
    // El tercer valor es la intensidad (peso) del punto
    const heatPoints: Array<[number, number, number]> = visits.map((visit) => {
      // Dar más peso a visitas efectivas
      let weight = 0.5
      if (visit.visit_type === 'Visita efectiva') {
        weight = 1.0
      } else if (visit.visit_type === 'Visita extra') {
        weight = 0.7
      }
      
      // Visitas presenciales tienen un poco más de peso
      if (visit.contact_type === 'Visita presencial') {
        weight *= 1.2
      }

      return [visit.lat, visit.lng, weight]
    })

    // Configuración del gradiente de colores
    const heatGradient = gradient || {
      0.0: 'blue',
      0.25: 'cyan',
      0.5: 'lime',
      0.75: 'yellow',
      1.0: 'red'
    }

    // Crear la capa de calor
    const heatLayer = (L as any).heatLayer(heatPoints, {
      radius,
      blur,
      maxZoom,
      max: intensity,
      gradient: heatGradient,
      minOpacity: 0.5
    })

    // Agregar la capa al mapa
    heatLayer.addTo(map)

    // Limpiar al desmontar
    return () => {
      map.removeLayer(heatLayer)
    }
  }, [map, visits, intensity, radius, blur, maxZoom, gradient])

  return null
}