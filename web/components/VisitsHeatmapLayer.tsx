'use client'

import { useEffect } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'

// Importación dinámica de leaflet.heat para evitar problemas de SSR
let HeatLayer: any = null
if (typeof window !== 'undefined') {
  require('leaflet.heat')
  HeatLayer = (L as any).heatLayer
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

    // Verificar que HeatLayer esté disponible
    if (!HeatLayer) {
      console.error('leaflet.heat no está cargado correctamente')
      // Intentar cargar de nuevo
      if (typeof window !== 'undefined' && L) {
        try {
          require('leaflet.heat')
          HeatLayer = (L as any).heatLayer
        } catch (error) {
          console.error('Error cargando leaflet.heat:', error)
          return
        }
      }
      if (!HeatLayer) {
        console.error('No se pudo cargar leaflet.heat')
        return
      }
    }

    // Convertir visitas a formato de heatmap
    // El tercer valor es la intensidad (peso) del punto
    const heatPoints: Array<[number, number, number]> = visits
      .filter((visit) => {
        // Filtrar visitas con coordenadas inválidas
        const isValid = visit.lat && visit.lng && 
                       !isNaN(visit.lat) && !isNaN(visit.lng) &&
                       visit.lat >= -90 && visit.lat <= 90 &&
                       visit.lng >= -180 && visit.lng <= 180
        if (!isValid) {
          console.warn('Visita con coordenadas inválidas:', visit)
        }
        return isValid
      })
      .map((visit) => {
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

    console.log('VisitsHeatmapLayer - Puntos de calor generados:', heatPoints.length)
    console.log('VisitsHeatmapLayer - Primeros 5 puntos:', heatPoints.slice(0, 5))

    if (heatPoints.length === 0) {
      console.warn('VisitsHeatmapLayer - No hay puntos válidos para mostrar en el mapa de calor')
      return
    }

    // Configuración del gradiente de colores
    const heatGradient = gradient || {
      0.0: 'blue',
      0.25: 'cyan',
      0.5: 'lime',
      0.75: 'yellow',
      1.0: 'red'
    }

    try {
      // Crear la capa de calor
      const heatLayer = HeatLayer(heatPoints, {
        radius,
        blur,
        maxZoom,
        max: intensity,
        gradient: heatGradient,
        minOpacity: 0.5
      })

      // Agregar la capa al mapa
      heatLayer.addTo(map)
      console.log('VisitsHeatmapLayer - Capa de calor agregada al mapa')

      // Limpiar al desmontar
      return () => {
        try {
          map.removeLayer(heatLayer)
          console.log('VisitsHeatmapLayer - Capa de calor removida del mapa')
        } catch (error) {
          console.error('Error removiendo capa de calor:', error)
        }
      }
    } catch (error) {
      console.error('Error creando capa de calor:', error)
    }
  }, [map, visits, intensity, radius, blur, maxZoom, gradient])

  return null
}