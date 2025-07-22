'use client'

import { MapContainer, TileLayer, Polygon, CircleMarker, Marker, Popup, Tooltip } from 'react-leaflet'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useState } from 'react'

// Fix for default markers in Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

export default function MapComponent() {
  const [geoData, setGeoData] = useState<any>(null)
  
  // Cargar datos de KAMs y asignaciones
  const { data: kamData } = useQuery({
    queryKey: ['map-data'],
    queryFn: async () => {
      const [kamsResult, assignmentsResult, hospitalsResult] = await Promise.all([
        supabase.from('kams').select('*').eq('active', true),
        supabase.from('territory_assignments').select('*'),
        supabase.from('hospitals').select('*, assignments!inner(kam_id)').eq('active', true).limit(1000)
      ])
      
      return {
        kams: kamsResult.data || [],
        assignments: assignmentsResult.data || [],
        hospitals: hospitalsResult.data || []
      }
    }
  })

  // Cargar datos geográficos
  useEffect(() => {
    const loadGeoData = async () => {
      try {
        // En producción, estos archivos deberían estar en public/
        const response = await fetch('/colombia_departments.geojson')
        const data = await response.json()
        setGeoData(data)
      } catch (error) {
        console.error('Error loading geo data:', error)
      }
    }
    loadGeoData()
  }, [])

  if (!kamData || !geoData) {
    return <div className="flex items-center justify-center h-full">Cargando datos del mapa...</div>
  }

  // Crear mapa de colores por departamento
  const departmentColors: Record<string, string> = {}
  kamData.assignments.forEach((assignment: any) => {
    if (!departmentColors[assignment.department_id]) {
      departmentColors[assignment.department_id] = assignment.kam_color
    }
  })

  // Crear iconos personalizados para KAMs
  const createKamIcon = (color: string) => {
    return L.divIcon({
      className: 'kam-marker',
      html: `<div style="background-color: ${color}; width: 30px; height: 30px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);"></div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 15]
    })
  }

  return (
    <MapContainer
      center={[4.570868, -74.297333]}
      zoom={6}
      className="h-full w-full"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      
      {/* Departamentos coloreados */}
      {geoData.features.map((feature: any) => {
        const deptCode = feature.properties.DPTO_CCDGO
        const color = departmentColors[deptCode] || '#e0e0e0'
        
        return (
          <Polygon
            key={deptCode}
            positions={feature.geometry.coordinates[0].map((coord: number[]) => [coord[1], coord[0]])}
            pathOptions={{
              color: '#333',
              weight: 1,
              fillColor: color,
              fillOpacity: 0.7
            }}
          >
            <Tooltip>{feature.properties.DPTO_CNMBR}</Tooltip>
          </Polygon>
        )
      })}
      
      {/* Marcadores de hospitales */}
      {kamData.hospitals.map((hospital: any) => {
        const kam = kamData.kams.find((k: any) => k.id === hospital.assignments[0]?.kam_id)
        const color = kam?.color || '#666'
        
        return (
          <CircleMarker
            key={hospital.id}
            center={[hospital.lat, hospital.lng]}
            radius={5}
            pathOptions={{
              color: 'white',
              weight: 2,
              fillColor: color,
              fillOpacity: 0.8
            }}
          >
            <Popup>
              <div>
                <h3 className="font-bold">{hospital.name}</h3>
                <p className="text-sm">Código: {hospital.code}</p>
                <p className="text-sm">Camas: {hospital.beds || 'N/A'}</p>
                <p className="text-sm">KAM: {kam?.name || 'Sin asignar'}</p>
              </div>
            </Popup>
          </CircleMarker>
        )
      })}
      
      {/* Marcadores de KAMs */}
      {kamData.kams.map((kam: any) => (
        <Marker
          key={kam.id}
          position={[kam.lat, kam.lng]}
          icon={createKamIcon(kam.color)}
        >
          <Popup>
            <div>
              <h3 className="font-bold">{kam.name}</h3>
              <p className="text-sm">Área: {kam.area_id}</p>
              <p className="text-sm">Tiempo máx: {kam.max_travel_time} min</p>
              <p className="text-sm">Nivel 2: {kam.enable_level2 ? 'Sí' : 'No'}</p>
            </div>
          </Popup>
        </Marker>
      ))}
      
      {/* Leyenda */}
      <div className="absolute bottom-4 right-4 bg-white p-4 rounded shadow-lg z-[1000]">
        <h3 className="font-bold mb-2">Leyenda</h3>
        <div className="space-y-1">
          {kamData.kams.map((kam: any) => (
            <div key={kam.id} className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded"
                style={{ backgroundColor: kam.color }}
              />
              <span className="text-sm">{kam.name}</span>
            </div>
          ))}
        </div>
      </div>
    </MapContainer>
  )
}