'use client'

import { MapContainer, TileLayer, GeoJSON, CircleMarker, Marker, Tooltip } from 'react-leaflet'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { VisitsHeatmapLayer } from './VisitsHeatmapLayer'
import { formatTravelTimeFromSeconds, formatTravelTime } from '@/lib/format-utils'
import MapControls from './MapControls'
import MapController from './MapController'
import HospitalMarker from './HospitalMarker'
// NO usar estimaciones - solo datos reales de Google Maps

// Fix for default markers in Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// Font Awesome CDN for icons
if (typeof window !== 'undefined' && !document.querySelector('link[href*="fontawesome"]')) {
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.2.0/css/all.min.css'
  document.head.appendChild(link)
}

// Add CSS for custom KAM markers
if (typeof window !== 'undefined' && !document.querySelector('#custom-kam-marker-styles')) {
  const style = document.createElement('style')
  style.id = 'custom-kam-marker-styles'
  style.innerHTML = `
    .custom-kam-marker {
      cursor: pointer !important;
      pointer-events: auto !important;
    }
    .custom-kam-marker:hover {
      z-index: 10000 !important;
    }
  `
  document.head.appendChild(style)
}

// Colores de respaldo para KAMs sin color definido en la base de datos
const BACKUP_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57',
  '#FF9FF3', '#54A0FF', '#8B4513', '#1DD1A1', '#FF7675',
  '#A29BFE', '#FD79A8', '#FDCB6E', '#6C5CE7', '#00D2D3',
  '#2ECC71', '#E74C3C', '#3498DB', '#F39C12', '#9B59B6'
]

interface MapComponentProps {
  visits?: any[]
  showHeatmap?: boolean
  showMarkers?: boolean
}

export default function MapComponent({ visits: initialVisits = [], showHeatmap: initialShowHeatmap = false, showMarkers: initialShowMarkers = false }: MapComponentProps) {
  const router = useRouter()
  const [territoryGeoJsons, setTerritoryGeoJsons] = useState<any[]>([])
  const [kamColors, setKamColors] = useState<Record<string, string>>({})
  const [unassignedTravelTimes, setUnassignedTravelTimes] = useState<Record<string, any[]>>({})
  const [selectedHospitalId, setSelectedHospitalId] = useState<string | null>(null)
  const [hospitalTypeFilter, setHospitalTypeFilter] = useState<string>('all') // 'all', 'Publico', 'Privada', 'Mixta'
  const [visits, setVisits] = useState(initialVisits)
  const [showHeatmap, setShowHeatmap] = useState(initialShowHeatmap)
  const [showMarkers, setShowMarkers] = useState(initialShowMarkers)
  const [showContracts, setShowContracts] = useState(false)
  
  // Debug de visitas
  useEffect(() => {
    console.log('MapComponent - Visitas actualizadas:', {
      cantidad: visits?.length || 0,
      showHeatmap,
      primeras_3: visits?.slice(0, 3)
    })
  }, [visits, showHeatmap])
  const [mapCenter, setMapCenter] = useState<[number, number] | undefined>(undefined)
  const [mapZoom, setMapZoom] = useState<number | undefined>(undefined)
  
  // Cargar datos desde el API
  const { data: mapData, isLoading } = useQuery({
    queryKey: ['map-data'],
    queryFn: async () => {
      const response = await fetch('/api/map/data')
      if (!response.ok) {
        throw new Error('Error al cargar datos del mapa')
      }
      const data = await response.json()
      console.log('Map data received:', {
        kams: data.kams?.length || 0,
        assignments: data.assignments?.length || 0,
        hospitals: data.hospitals?.length || 0,
        unassignedHospitals: data.unassignedHospitals?.length || 0
      })
      return data
    }
  })

  // Asignar colores a KAMs desde la base de datos
  useEffect(() => {
    if (!mapData) return
    
    const colors: Record<string, string> = {}
    let backupIdx = 0
    
    mapData.kams.forEach((kam: any) => {
      // Usar el color del KAM desde la base de datos
      if (kam.color && kam.color.startsWith('#')) {
        colors[kam.id] = kam.color
      } else {
        // Usar color de respaldo si no tiene color definido
        colors[kam.id] = BACKUP_COLORS[backupIdx % BACKUP_COLORS.length]
        backupIdx++
      }
    })
    
    setKamColors(colors)
  }, [mapData])

  // Cargar tiempos de viaje REALES para hospitales sin asignar
  useEffect(() => {
    if (!mapData || mapData.unassignedHospitals.length === 0) return

    const fetchUnassignedTravelTimes = async () => {
      try {
        console.log('🚀 MapComponent: Iniciando carga de tiempos para hospitales sin asignar...')
        console.log('📊 MapComponent: Total hospitales sin asignar en mapData:', mapData.unassignedHospitals.length)
        
        // Usar la API optimizada con la nueva tabla hospital_kam_distances
        const response = await fetch('/api/travel-times/unassigned-optimized')
        if (response.ok) {
          const data = await response.json()
          const timesMap: Record<string, any[]> = {}
          
          console.log('✅ MapComponent: Respuesta recibida del API')
          console.log('📊 MapComponent: Hospitales con datos:', data.unassigned_hospitals?.length || 0)
          console.log('🔍 MapComponent: Debug info del API:', data.debug)
          
          let hospitalsWithTravelTimes = 0
          
          data.unassigned_hospitals?.forEach((hospital: any) => {
            if (hospital.travel_times && hospital.travel_times.length > 0) {
              timesMap[hospital.id] = hospital.travel_times
              hospitalsWithTravelTimes++
            }
          })
          
          console.log(`✨ MapComponent: ${hospitalsWithTravelTimes} hospitales tienen tiempos de viaje`)
          console.log('📝 MapComponent: Ejemplo de hospital con tiempos:', Object.keys(timesMap)[0], timesMap[Object.keys(timesMap)[0]]?.slice(0, 3))
          
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

  // Cargar GeoJSON de territorios con IPS
  useEffect(() => {
    if (!mapData) return

    // Analizar asignaciones para identificar territorios con IPS
    const kamTerritories: Record<string, Set<string>> = {}
    const territoriesWithIps = new Set<string>()
    const territoryBedCount: Record<string, Record<string, number>> = {} // Cuenta CAMAS por territorio (localidad o municipio) y KAM
    const vacantTerritories = new Set<string>()

    // Primero, identificar territorios con hospitales sin asignar (vacantes)
    mapData.unassignedHospitals.forEach((hospital: any) => {
      if (hospital.locality_id) {
        vacantTerritories.add(hospital.locality_id)
      } else if (hospital.municipality_id) {
        vacantTerritories.add(hospital.municipality_id)
      }
    })

    mapData.assignments.forEach((assignment: any) => {
      const hospital = assignment.hospitals
      const kamId = assignment.kams.id
      
      if (!kamTerritories[kamId]) {
        kamTerritories[kamId] = new Set()
      }

      // Registrar territorio
      const territoryId = hospital.locality_id || hospital.municipality_id
      if (territoryId) {
        territoriesWithIps.add(territoryId)
        kamTerritories[kamId].add(territoryId)
        
        // Contar CAMAS para mayoría en TODOS los territorios (localidades Y municipios)
        if (!territoryBedCount[territoryId]) {
          territoryBedCount[territoryId] = {}
        }
        // Sumar CAMAS del hospital
        const beds = hospital.beds || 0
        territoryBedCount[territoryId][kamId] = 
          (territoryBedCount[territoryId][kamId] || 0) + beds
      }
    })

    // Determinar ganadores para territorios compartidos
    const territoryWinners: Record<string, string> = {}
    
    // Para cada territorio con IPS, determinar el KAM ganador por mayoría de CAMAS
    territoriesWithIps.forEach(territoryId => {
      const bedCounts = territoryBedCount[territoryId]
      if (bedCounts) {
        // El ganador es el KAM con más CAMAS en ese territorio
        const winner = Object.entries(bedCounts)
          .sort(([,a], [,b]) => b - a)[0][0]
        territoryWinners[territoryId] = winner
        
        // Log para municipios con múltiples KAMs
        if (Object.keys(bedCounts).length > 1) {
          const totalBeds = Object.values(bedCounts).reduce((sum, beds) => sum + beds, 0)
          const winnerBeds = bedCounts[winner]
          const percentage = ((winnerBeds / totalBeds) * 100).toFixed(1)
          console.log(`Territorio ${territoryId}: Ganador KAM ${winner} con ${winnerBeds}/${totalBeds} camas (${percentage}%)`)
        }
      }
    })

    // Cargar GeoJSON para cada territorio
    const loadGeoJsons = async () => {
      // Combinar territorios asignados y vacantes
      const allTerritories = new Set([...territoriesWithIps, ...vacantTerritories])
      
      const geoJsonPromises = Array.from(allTerritories).map(async (territoryId) => {
        const type = territoryId.length === 7 ? 'localities' : 'municipalities'
        try {
          const response = await fetch(`/api/geojson/${type}/${territoryId}`)
          if (response.ok) {
            const geoJson = await response.json()
            const kamId = territoryWinners[territoryId]
            const isVacant = vacantTerritories.has(territoryId)
            return {
              territoryId,
              kamId,
              geoJson,
              type,
              isVacant
            }
          } else {
            console.warn(`Failed to load GeoJSON for ${territoryId}: ${response.status}`)
          }
        } catch (error) {
          console.error(`Error loading GeoJSON for ${territoryId}:`, error)
        }
        return null
      })

      const results = await Promise.all(geoJsonPromises)
      const validResults = results.filter(Boolean)
      console.log('Loaded GeoJSONs:', validResults.length)
      console.log('Medellín GeoJSONs:', validResults.filter(r => r?.kamId === 'medellin').length)
      setTerritoryGeoJsons(validResults)
    }

    loadGeoJsons()
  }, [mapData])

  if (isLoading || !mapData) {
    return <div className="flex items-center justify-center h-full">Cargando mapa...</div>
  }

  // Crear iconos personalizados para KAMs con el color del KAM
  const createKamIcon = (kamId: string) => {
    const color = kamColors[kamId] || '#888888'
    return L.divIcon({
      className: 'custom-kam-marker',
      html: `
        <div style="width: 42px; height: 52px; position: relative;">
          <div style="
            width: 36px;
            height: 36px;
            background-color: ${color};
            border: 3px solid #ffffff;
            border-radius: 50%;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto;
          ">
            <i class="fa fa-user" style="
              color: white;
              font-size: 18px;
              text-shadow: 1px 1px 1px rgba(0,0,0,0.5);
            "></i>
          </div>
          <div style="
            width: 0;
            height: 0;
            border-left: 8px solid transparent;
            border-right: 8px solid transparent;
            border-top: 10px solid ${color};
            margin: -3px auto 0 auto;
          "></div>
        </div>
      `,
      iconSize: [42, 52],
      iconAnchor: [21, 52],
      popupAnchor: [0, -52],
      tooltipAnchor: [0, -52]
    })
  }

  // Agrupar hospitales por KAM para estadísticas
  const kamStats = mapData.kams.map((kam: any) => {
    const assignments = mapData.assignments.filter((a: any) => a.kams.id === kam.id)
    
    // Calcular estadísticas
    const totalBeds = assignments.reduce((sum: number, a: any) => sum + (a.hospitals.beds || 0), 0)
    const municipalities = new Set(assignments.map((a: any) => a.hospitals.municipality_id))
    const avgTravelTime = assignments.length > 0 
      ? Math.round(assignments.reduce((sum: number, a: any) => sum + (a.travel_time || 0), 0) / assignments.length)
      : 0
    
    // Calcular población total
    const totalPopulation = Array.from(municipalities).reduce((sum, munId: any) => {
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
  })

  // Filtrar hospitales según el tipo seleccionado
  const filterHospitalsByType = (hospitals: any[]) => {
    if (hospitalTypeFilter === 'all') return hospitals
    return hospitals.filter(h => h.type === hospitalTypeFilter || (hospitalTypeFilter === 'sin_tipo' && !h.type))
  }

  const filteredAssignments = mapData.assignments.filter((a: any) => {
    if (hospitalTypeFilter === 'all') return true
    if (hospitalTypeFilter === 'sin_tipo') return !a.hospitals.type
    return a.hospitals.type === hospitalTypeFilter
  })

  const filteredUnassignedHospitals = filterHospitalsByType(mapData.unassignedHospitals)

  return (
    <>
      {/* Control unificado del mapa */}
      <MapControls
        mapData={mapData}
        hospitalTypeFilter={hospitalTypeFilter}
        setHospitalTypeFilter={setHospitalTypeFilter}
        filteredAssignments={filteredAssignments}
        filteredUnassignedHospitals={filteredUnassignedHospitals}
        onVisitsChange={setVisits}
        onShowHeatmapChange={setShowHeatmap}
        onShowMarkersChange={setShowMarkers}
        onShowContractsChange={setShowContracts}
        onHospitalSelect={setSelectedHospitalId}
        onMapNavigate={(lat: number, lng: number, zoom: number) => {
          setMapCenter([lat, lng])
          setMapZoom(zoom)
          // Limpiar después de un momento para permitir nuevas navegaciones
          setTimeout(() => {
            setMapCenter(undefined)
            setMapZoom(undefined)
          }, 100)
        }}
      />

      <MapContainer
        center={[4.5709, -74.2973]}
        zoom={6}
        className="h-full w-full"
        preferCanvas={true}
        zoomControl={false}
      >
        <MapController center={mapCenter} zoom={mapZoom} />
        <TileLayer
          attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />
        
        {/* Territorios con IPS - Primera capa */}
        {territoryGeoJsons.map((territory, idx) => {
          const isVacant = territory.isVacant
          const color = isVacant ? '#808080' : (kamColors[territory.kamId] || '#cccccc')
          const isLocality = territory.type === 'localities'
          
          // Obtener estadísticas pre-calculadas del territorio
          const stats = mapData.territoryStats?.[territory.territoryId] || {
            totalHospitals: 0,
            totalBeds: 0,
            totalAmbulances: 0,
            totalSurgeries: 0,
            totalContracts: 0,
            contractValue: 0,
            providers: []
          }
          
          const population = mapData.populationMap[territory.territoryId] || 0
          
          return (
            <GeoJSON
              key={`${territory.territoryId}-${idx}`}
              data={territory.geoJson}
              style={{
                fillColor: color,
                color: isVacant ? '#FF0000' : (isLocality ? '#000000' : '#333333'),
                weight: isVacant ? 1 : (isLocality ? 1.5 : 0.8),
                fillOpacity: isVacant ? 0.3 : (isLocality ? 0.5 : 0.4)
              }}
              eventHandlers={{
                mouseover: (e: any) => {
                  e.target.setStyle({
                    weight: isVacant ? 2 : (isLocality ? 2.5 : 1.5),
                    fillOpacity: isVacant ? 0.5 : (isLocality ? 0.7 : 0.6)
                  })
                  
                  // Crear y mostrar popup con las estadísticas
                  const popupContent = `
                    <div style="min-width: 300px; padding: 10px;">
                      <div style="font-size: 15px; font-weight: bold; margin-bottom: 10px; border-bottom: 2px solid #ddd; padding-bottom: 8px;">
                        ${mapData.municipalityNames[territory.territoryId] || `Territorio ${territory.territoryId}`}
                      </div>
                      
                      <!-- Estadísticas de hospitales -->
                      <div style="margin-bottom: 10px;">
                        <div style="font-size: 13px; font-weight: bold; margin-bottom: 5px; color: #666;">
                          📊 ESTADÍSTICAS HOSPITALARIAS
                        </div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px; font-size: 12px;">
                          <div style="display: flex; justify-content: space-between;">
                            <span>🏥 Hospitales:</span>
                            <strong>${stats.totalHospitals}</strong>
                          </div>
                          <div style="display: flex; justify-content: space-between;">
                            <span>🛏️ Camas:</span>
                            <strong>${stats.totalBeds.toLocaleString()}</strong>
                          </div>
                          <div style="display: flex; justify-content: space-between;">
                            <span>🚑 Ambulancias:</span>
                            <strong>${stats.totalAmbulances}</strong>
                          </div>
                          <div style="display: flex; justify-content: space-between;">
                            <span>🏥 Cirugías:</span>
                            <strong>${stats.totalSurgeries.toLocaleString()}</strong>
                          </div>
                        </div>
                      </div>
                      
                      ${stats.contractValue > 0 ? `
                      <!-- Información de contratos -->
                      <div style="margin-bottom: 10px; padding: 8px; background-color: #f0f9ff; border-radius: 6px;">
                        <div style="font-size: 13px; font-weight: bold; margin-bottom: 5px; color: #0369a1;">
                          💼 CONTRATOS ACTIVOS
                        </div>
                        <div style="font-size: 12px;">
                          <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
                            <span>Contratos:</span>
                            <strong>${stats.totalContracts}</strong>
                          </div>
                          <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
                            <span>Valor total:</span>
                            <strong style="color: #059669;">$${(stats.contractValue / 1000000).toFixed(1)}M</strong>
                          </div>
                          ${stats.providers && stats.providers.length > 0 ? `
                          <div style="margin-top: 5px; font-size: 11px; color: #64748b;">
                            <span>Proveedores: </span>
                            <span style="font-style: italic;">${stats.providers.slice(0, 3).join(', ')}</span>
                            ${stats.providers.length > 3 ? `<span> (+${stats.providers.length - 3} más)</span>` : ''}
                          </div>` : ''}
                        </div>
                      </div>` : ''}
                      
                      ${population > 0 ? `
                      <!-- Población y métricas -->
                      <div style="margin-bottom: 10px; font-size: 12px;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
                          <span>👥 Población 2025:</span>
                          <strong>${population.toLocaleString()}</strong>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
                          <span>📊 Camas/1000 hab:</span>
                          <strong style="color: ${stats.totalBeds / population * 1000 < 1.5 ? '#dc2626' : stats.totalBeds / population * 1000 < 2.5 ? '#f59e0b' : '#059669'};">
                            ${(stats.totalBeds / population * 1000).toFixed(2)}
                          </strong>
                        </div>
                      </div>` : ''}
                      
                      <!-- Estado del territorio -->
                      <div style="margin-top: 10px; padding: 8px; background-color: ${isVacant ? '#fef2f2' : '#1e293b'}; color: ${isVacant ? '#dc2626' : '#fff'}; text-align: center; border-radius: 6px; font-size: 13px; font-weight: bold;">
                        ${isVacant ? '⚠️ ZONA VACANTE - SIN KAM ASIGNADO' : `✓ KAM: ${stats.kamName || territory.kamId?.toUpperCase()}`}
                      </div>
                    </div>
                  `
                  
                  e.target.bindPopup(popupContent, {
                    maxWidth: 350,
                    minWidth: 300,
                    className: 'territory-popup',
                    autoPan: false
                  }).openPopup()
                },
                mouseout: (e: any) => {
                  e.target.setStyle({
                    weight: isVacant ? 1 : (isLocality ? 1.5 : 0.8),
                    fillOpacity: isVacant ? 0.3 : (isLocality ? 0.5 : 0.4)
                  })
                  e.target.closePopup()
                }
              }}
            >
            </GeoJSON>
          )
        })}
        
        {/* Puntos de IPS - Segunda capa (encima de territorios) */}
        {filteredAssignments.map((assignment: any) => {
          const hospital = assignment.hospitals
          const kam = assignment.kams
          
          return (
            <HospitalMarker
              key={hospital.id}
              hospital={hospital}
              kam={kam}
              kamColor={kamColors[kam.id]}
              assignment={assignment}
              contractValue={mapData.contractValuesByHospital[hospital.id]}
              contractProviders={mapData.contractProvidersByHospital[hospital.id]}
              isSelected={selectedHospitalId === hospital.id}
              showContracts={showContracts}
            />
          )
        })}
        
        {/* Hospitales sin asignar (zonas vacantes) */}
        {filteredUnassignedHospitals.map((hospital: any, index: number) => {
          const travelTimes = unassignedTravelTimes[hospital.id] || []
          
          // Log para el primer hospital sin asignar
          if (index === 0) {
            console.log('🏥 MapComponent Render - Hospital sin asignar:', hospital.name)
            console.log('📍 MapComponent Render - ID:', hospital.id)
            console.log('⏱️ MapComponent Render - Tiempos disponibles:', travelTimes.length)
            console.log('📊 MapComponent Render - Primeros 3 tiempos:', travelTimes.slice(0, 3))
          }
          
          // SOLO mostrar tiempos reales de Google Maps
          // NO estimar si no hay datos
          
          // const zoneInfo = getZoneInfo(hospital.municipality_name) // Removido - usar solo datos reales
          
          return (
            <CircleMarker
              key={`unassigned-${hospital.id}-${travelTimes.length}`}
              center={[hospital.lat, hospital.lng]}
              radius={5}
              pathOptions={{
                color: '#FF0000',
                weight: 1,
                fillColor: '#CCCCCC',
                fillOpacity: 0.7,
                className: 'hospital-marker'
              }}
              pane="markerPane"
              eventHandlers={{
                click: () => {
                  router.push(`/hospitals/${hospital.id}`)
                }
              }}
            >
              <Tooltip 
                sticky={false} 
                opacity={0.95}
                permanent={selectedHospitalId === hospital.id || (showContracts && mapData.contractValuesByHospital[hospital.id])}
                className="custom-tooltip"
              >
                <div style={{ 
                  fontSize: '12px', 
                  minWidth: '250px', 
                  maxWidth: '350px',
                  maxHeight: '400px',
                  overflowY: 'auto',
                  overflowX: 'hidden',
                  wordWrap: 'break-word',
                  whiteSpace: 'normal'
                }}>
                  <strong style={{ fontSize: '13px', color: '#FF0000' }}>⚠️ SIN COBERTURA</strong><br/>
                  <strong style={{ 
                    fontSize: '13px', 
                    wordBreak: 'break-word',
                    display: 'block',
                    marginBottom: '4px'
                  }}>{hospital.name}</strong>
                  <div style={{ marginTop: '4px' }}>
                    <strong>Código NIT:</strong> {hospital.code}<br/>
                    <strong>Ubicación:</strong> {hospital.municipality_name || mapData.municipalityNames[hospital.municipality_id] || hospital.municipality_id}{hospital.department_name ? `, ${hospital.department_name}` : ''}<br/>
                    <strong>Camas:</strong> {hospital.beds || 0}<br/>
                    <strong>Nivel:</strong> {hospital.service_level || 'N/A'}<br/>
                    {hospital.type && (
                      <>
                        <strong>Tipo:</strong> <span style={{ 
                          padding: '2px 6px', 
                          borderRadius: '4px', 
                          fontSize: '11px',
                          backgroundColor: hospital.type === 'Publico' ? '#DBEAFE' : 
                                         hospital.type === 'Privada' ? '#E9D5FF' : '#D1FAE5',
                          color: hospital.type === 'Publico' ? '#1E40AF' : 
                                hospital.type === 'Privada' ? '#6B21A8' : '#065F46'
                        }}>{hospital.type}</span><br/>
                      </>
                    )}
                    {showContracts && mapData.contractValuesByHospital[hospital.id] && (
                      <>
                        <strong style={{ color: '#2ECC71' }}>💰 Contratos:</strong> ${mapData.contractValuesByHospital[hospital.id].toLocaleString('es-CO')}<br/>
                      </>
                    )}
                    <div style={{ marginTop: '4px', paddingTop: '4px', borderTop: '1px solid #ddd' }}>
                      <strong>Distancia desde cada KAM:</strong><br/>
                      {travelTimes && travelTimes.length > 0 ? (
                        <div style={{ fontSize: '11px', marginTop: '4px' }}>
                          <table style={{ width: '100%', borderSpacing: '0 2px' }}>
                            <tbody>
                              {travelTimes.slice(0, 8).map((tt: any, idx: number) => {
                                const hasTime = tt.travel_time !== null && tt.travel_time !== undefined
                                // Los tiempos vienen en SEGUNDOS desde hospital_kam_distances
                                const timeStr = hasTime 
                                  ? formatTravelTimeFromSeconds(tt.travel_time) // Convertir segundos a formato legible
                                  : 'Sin calcular'
                                
                                const minutes = hasTime ? Math.round(tt.travel_time / 60) : 0
                                const isOverLimit = hasTime && minutes > (tt.max_travel_time || 240)
                                const isClose = hasTime && minutes > 240 && minutes <= 300 // 5 horas
                                
                                return (
                                  <tr key={idx}>
                                    <td style={{ 
                                      paddingRight: '10px',
                                      fontWeight: 'bold',
                                      color: !hasTime ? '#999' : (isClose ? '#FF6B00' : (isOverLimit ? '#CC0000' : '#333'))
                                    }}>
                                      {tt.kam_name}:
                                    </td>
                                    <td style={{ 
                                      textAlign: 'right',
                                      color: !hasTime ? '#999' : (isClose ? '#FF6B00' : (isOverLimit ? '#CC0000' : '#666'))
                                    }}>
                                      {timeStr} {isClose && '⚠️'}
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                          {travelTimes.length > 8 && (
                            <div style={{ marginTop: '4px', fontStyle: 'italic', color: '#999' }}>
                              ...y {travelTimes.length - 8} KAMs más
                            </div>
                          )}
                          <div style={{ marginTop: '4px', fontSize: '10px', color: '#666' }}>
                            <em>Tiempos reales de Google Maps</em>
                          </div>
                        </div>
                      ) : (
                        <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
                          <div style={{ padding: '4px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                            <strong>Hospital sin asignar</strong><br/>
                            <div style={{ marginTop: '4px', fontSize: '10px' }}>
                              No hay tiempos de viaje calculados para este hospital.<br/>
                              Ejecute un recálculo completo para incluirlo en el análisis.
                            </div>
                          </div>
                        </div>
                      )}
                      {travelTimes.length > 0 && travelTimes[0].travel_time && travelTimes[0].travel_time/60 > 240 && travelTimes[0].travel_time/60 <= 300 && (
                        <div style={{ marginTop: '6px', padding: '4px', backgroundColor: '#FFF3CD', border: '1px solid #FFE69C', borderRadius: '4px' }}>
                          <div style={{ fontSize: '11px', color: '#856404' }}>
                            💡 <strong>Sugerencia:</strong> {travelTimes[0].kam_name} está a solo {formatTravelTimeFromSeconds(travelTimes[0].travel_time)}.
                            Considere ajustar su límite de tiempo máximo de 4 a 5 horas.
                          </div>
                        </div>
                      )}
                      {/* Información de zona removida - usar solo datos reales */}
                    </div>
                  </div>
                </div>
              </Tooltip>
            </CircleMarker>
          )
        })}
        
        {/* Marcadores de KAMs */}
        {kamStats.filter((kam: any) => kam.lat && kam.lng).map((kam: any) => (
          <Marker
            key={kam.id}
            position={[kam.lat, kam.lng]}
            icon={createKamIcon(kam.id)}
            zIndexOffset={1000}
          >
            <Tooltip 
              sticky={true} 
              opacity={0.95}
              direction="top"
              offset={[0, -30]}
              permanent={false}
              interactive={false}
              className="custom-tooltip"
            >
              <div style={{ 
                fontSize: '12px', 
                minWidth: '200px',
                maxWidth: '350px',
                wordWrap: 'break-word',
                whiteSpace: 'normal'
              }}>
                <strong style={{ 
                  fontSize: '14px', 
                  color: kamColors[kam.id],
                  wordBreak: 'break-word',
                  display: 'block'
                }}>{kam.name}</strong>
                <div style={{ marginTop: '4px' }}>
                  <strong>Total IPS:</strong> {kam.hospitalCount}<br/>
                  <strong>Total Camas:</strong> {kam.totalBeds.toLocaleString()}<br/>
                  <strong>Municipios:</strong> {kam.municipalityCount}<br/>
                  <strong>Población:</strong> {kam.totalPopulation.toLocaleString()}<br/>
                  <strong>Base:</strong> {kam.area_id}
                </div>
              </div>
            </Tooltip>
          </Marker>
        ))}
        
        {/* Capa de mapa de calor de visitas - SOLO mostrar si hay visitas válidas */}
        {showHeatmap && visits && Array.isArray(visits) && visits.length > 0 ? (
          <VisitsHeatmapLayer 
            key={`heatmap-${showHeatmap}-${visits.length}`} // Clave única para forzar remontaje
            visits={visits}
            intensity={0.5}
            radius={15}
            blur={25}
            maxZoom={15}
            gradient={{
              0.0: 'blue',
              0.25: 'cyan',
              0.5: 'lime',
              0.75: 'yellow',
              0.85: 'orange',
              1.0: 'red'
            }}
          />
        ) : (
          showHeatmap && console.log('MapComponent - Heatmap solicitado pero sin visitas válidas:', {
            showHeatmap,
            visitsLength: visits?.length || 0,
            visitsIsArray: Array.isArray(visits)
          })
        )}
        
        {/* Marcadores individuales de visitas */}
        {showMarkers && visits && visits.length > 0 && visits.map((visit, index) => {
          // Buscar el KAM para obtener su color
          const kam = mapData.kams.find((k: any) => k.id === visit.kam_id)
          const kamColor = kam ? kamColors[kam.id] : '#888888'
          
          return (
            <CircleMarker
              key={`visit-${index}`}
              center={[visit.lat, visit.lng]}
              radius={6}
              pathOptions={{
                fillColor: visit.visit_type === 'Visita efectiva' ? '#2ECC71' :
                          visit.visit_type === 'Visita extra' ? '#3498DB' : '#E74C3C',
                color: kamColor,
                weight: 2,
                opacity: 1,
                fillOpacity: 0.8
              }}
            >
              <Tooltip className="custom-tooltip">
                <div style={{ 
                  fontSize: '12px', 
                  minWidth: '200px',
                  maxWidth: '350px',
                  wordWrap: 'break-word',
                  whiteSpace: 'normal'
                }}>
                  <strong style={{ 
                    fontSize: '13px', 
                    color: kamColor,
                    wordBreak: 'break-word',
                    display: 'block'
                  }}>
                    {visit.kam_name}
                  </strong>
                  <div style={{ marginTop: '4px', borderTop: '1px solid #ddd', paddingTop: '4px' }}>
                    <table style={{ width: '100%', borderSpacing: '0' }}>
                      <tbody>
                        <tr>
                          <td style={{ paddingRight: '10px' }}><strong>Tipo:</strong></td>
                          <td style={{ 
                            color: visit.visit_type === 'Visita efectiva' ? '#2ECC71' :
                                  visit.visit_type === 'Visita extra' ? '#3498DB' : '#E74C3C'
                          }}>
                            {visit.visit_type}
                          </td>
                        </tr>
                        <tr>
                          <td><strong>Contacto:</strong></td>
                          <td>{visit.contact_type}</td>
                        </tr>
                        <tr>
                          <td><strong>Fecha:</strong></td>
                          <td>{new Date(visit.visit_date).toLocaleDateString('es-CO')}</td>
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
                    KAM ID: {visit.kam_id}
                  </div>
                </div>
              </Tooltip>
            </CircleMarker>
          )
        })}
      </MapContainer>
      
      {/* Estilos CSS para el cursor */}
      <style jsx global>{`
        .hospital-marker {
          cursor: pointer !important;
        }
        .hospital-marker:hover {
          stroke-width: 2 !important;
          stroke-opacity: 1 !important;
        }
        .leaflet-tooltip {
          background: white !important;
          border: 1px solid #ddd !important;
          border-radius: 8px !important;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15) !important;
          padding: 0 !important;
        }
        .leaflet-tooltip-top:before {
          border-top-color: #ddd !important;
        }
      `}</style>
    </>
  )
}