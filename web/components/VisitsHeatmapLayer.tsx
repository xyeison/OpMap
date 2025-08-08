'use client'

import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'

// Declaración de tipos para leaflet.heat
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
  const heatmapLayerRef = useRef<any>(null)

  useEffect(() => {
    console.log('VisitsHeatmapLayer - Total visitas:', visits?.length)
    console.log('VisitsHeatmapLayer - Primeras 5 visitas:', visits?.slice(0, 5))
    
    // IMPORTANTE: Limpiar capa existente si hay una
    if (heatmapLayerRef.current) {
      try {
        console.log('VisitsHeatmapLayer - Removiendo capa anterior...', heatmapLayerRef.current)
        map.removeLayer(heatmapLayerRef.current)
        heatmapLayerRef.current = null
        console.log('VisitsHeatmapLayer - Capa de calor anterior removida exitosamente')
      } catch (error) {
        console.error('Error removiendo capa de calor anterior:', error)
        // Intentar forzar la limpieza
        try {
          map.eachLayer((layer: any) => {
            if (layer._heat) {
              map.removeLayer(layer)
              console.log('VisitsHeatmapLayer - Capa de calor removida por búsqueda')
            }
          })
        } catch (e) {
          console.error('Error en limpieza forzada:', e)
        }
      }
    }
    
    // Validación estricta: NO mostrar nada si no hay visitas válidas
    if (!visits || !Array.isArray(visits) || visits.length === 0) {
      console.log('VisitsHeatmapLayer - No hay visitas válidas para mostrar:', {
        hasVisits: !!visits,
        isArray: Array.isArray(visits),
        length: visits?.length || 0
      })
      return
    }

    // Cargar leaflet.heat dinámicamente
    const loadHeatmapLibrary = async () => {
      if (typeof window === 'undefined') return
      
      try {
        // Importar leaflet.heat
        await import('leaflet.heat')
        console.log('leaflet.heat cargado exitosamente')
      } catch (error) {
        console.error('Error cargando leaflet.heat:', error)
        return
      }
    }

    loadHeatmapLibrary().then(() => {
      if (!window.L || !window.L.heatLayer) {
        console.error('leaflet.heat no está disponible después de cargar')
        return
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
          // Dar peso más sutil a las visitas
          let weight = 0.3
          if (visit.visit_type === 'Visita efectiva') {
            weight = 0.6
          } else if (visit.visit_type === 'Visita extra') {
            weight = 0.4
          }
          
          // Visitas presenciales tienen un poco más de peso
          if (visit.contact_type === 'Visita presencial') {
            weight *= 1.1
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
        // LIMPIAR CUALQUIER CAPA DE CALOR EXISTENTE ANTES DE CREAR UNA NUEVA
        map.eachLayer((layer: any) => {
          if (layer._heat) {
            map.removeLayer(layer)
            console.log('VisitsHeatmapLayer - Limpiando capa de calor previa')
          }
        })
        
        // Crear la capa de calor usando window.L
        const newHeatLayer = window.L.heatLayer(heatPoints, {
          radius,
          blur,
          maxZoom,
          max: intensity,
          gradient: heatGradient,
          minOpacity: 0.5
        })

        // Agregar la capa al mapa
        newHeatLayer.addTo(map)
        console.log('VisitsHeatmapLayer - Nueva capa de calor agregada al mapa')
        heatmapLayerRef.current = newHeatLayer
      } catch (error) {
        console.error('Error creando capa de calor:', error)
      }
    })

    // CRÍTICO: Limpiar al desmontar el componente
    return () => {
      console.log('VisitsHeatmapLayer - Desmontando componente, limpiando capa...')
      if (heatmapLayerRef.current) {
        try {
          map.removeLayer(heatmapLayerRef.current)
          heatmapLayerRef.current = null
          console.log('VisitsHeatmapLayer - Capa de calor removida del mapa (cleanup en desmonte)')
        } catch (error) {
          console.error('Error removiendo capa de calor (cleanup):', error)
        }
      }
      // Limpieza adicional por si acaso
      try {
        map.eachLayer((layer: any) => {
          if (layer._heat) {
            map.removeLayer(layer)
            console.log('VisitsHeatmapLayer - Capa de calor adicional removida en cleanup')
          }
        })
      } catch (e) {
        console.error('Error en limpieza adicional:', e)
      }
    }
  }, [map, visits, intensity, radius, blur, maxZoom, gradient])

  return null
}