'use client'

import { MapContainer, TileLayer, GeoJSON, CircleMarker, Marker, Tooltip } from 'react-leaflet'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useState } from 'react'
import { estimateTravelTime, getZoneInfo } from '@/utils/distance-estimator'

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

// Mapeo específico de colores por KAM (igual que en Python)
const KAM_COLOR_MAPPING: Record<string, string> = {
  'barranquilla': '#FF6B6B',  // Rojo coral
  'bucaramanga': '#4ECDC4',   // Turquesa
  'cali': '#45B7D1',          // Azul cielo
  'cartagena': '#96CEB4',     // Verde menta
  'cucuta': '#FECA57',        // Amarillo dorado
  'medellin': '#FF9FF3',      // Rosa
  'monteria': '#54A0FF',      // Azul brillante
  'neiva': '#8B4513',         // Marrón
  'pasto': '#1DD1A1',         // Verde esmeralda
  'pereira': '#FF7675',       // Rojo claro
  'sincelejo': '#A29BFE',     // Lavanda
  'chapinero': '#FD79A8',     // Rosa chicle
  'engativa': '#FDCB6E',      // Amarillo
  'sancristobal': '#6C5CE7',  // Púrpura
  'kennedy': '#00D2D3',       // Cian
  'valledupar': '#2ECC71'     // Verde
}

// Colores de respaldo para KAMs adicionales
const BACKUP_COLORS = [
  '#E74C3C', '#3498DB', '#2ECC71', '#F39C12', '#9B59B6',
  '#1ABC9C', '#34495E', '#E67E22', '#16A085', '#8E44AD'
]

export default function MapComponent() {
  const [territoryGeoJsons, setTerritoryGeoJsons] = useState<any[]>([])
  const [kamColors, setKamColors] = useState<Record<string, string>>({})
  const [unassignedTravelTimes, setUnassignedTravelTimes] = useState<Record<string, any[]>>({})
  
  // Cargar datos
  const { data: mapData, isLoading } = useQuery({
    queryKey: ['map-data'],
    queryFn: async () => {
      // Cargar todos los datos necesarios
      const [kamsResult, assignmentsResult, municipalitiesResult, hospitalsResult] = await Promise.all([
        supabase.from('kams').select('*').eq('active', true),
        supabase.from('assignments').select('*, hospitals!inner(*), kams!inner(*)'),
        supabase.from('municipalities').select('id, name, population_2025'),
        supabase.from('hospitals').select('*').eq('active', true)
      ])
      
      // Crear mapas de población y nombres por municipio
      const populationMap: Record<string, number> = {}
      const municipalityNames: Record<string, string> = {}
      municipalitiesResult.data?.forEach(m => {
        populationMap[m.id] = m.population_2025 || 0
        municipalityNames[m.id] = m.name
      })
      
      // Identificar hospitales sin asignar (zonas vacantes)
      const assignedHospitalIds = new Set(assignmentsResult.data?.map(a => a.hospitals.id) || [])
      const unassignedHospitals = hospitalsResult.data?.filter(h => !assignedHospitalIds.has(h.id)) || []
      
      return {
        kams: kamsResult.data || [],
        assignments: assignmentsResult.data || [],
        hospitals: hospitalsResult.data || [],
        unassignedHospitals,
        populationMap,
        municipalityNames
      }
    }
  })

  // Asignar colores a KAMs basado en su ID/nombre
  useEffect(() => {
    if (!mapData) return
    
    const colors: Record<string, string> = {}
    let backupIdx = 0
    
    mapData.kams.forEach((kam) => {
      // Usar el ID del KAM (que es como 'barranquilla', 'cali', etc.)
      if (KAM_COLOR_MAPPING[kam.id]) {
        colors[kam.id] = KAM_COLOR_MAPPING[kam.id]
      } else {
        // Usar color de respaldo si no está en el mapeo
        colors[kam.id] = BACKUP_COLORS[backupIdx % BACKUP_COLORS.length]
        backupIdx++
      }
    })
    
    setKamColors(colors)
  }, [mapData])

  // Cargar tiempos de viaje para hospitales sin asignar
  useEffect(() => {
    if (!mapData || mapData.unassignedHospitals.length === 0) return

    const fetchUnassignedTravelTimes = async () => {
      try {
        const response = await fetch('/api/travel-times/unassigned-v2')
        if (response.ok) {
          const data = await response.json()
          const timesMap: Record<string, any[]> = {}
          
          console.log('Loaded travel times for', data.total, 'unassigned hospitals')
          console.log('Debug info:', data.debug)
          
          data.unassigned_hospitals.forEach((hospital: any) => {
            timesMap[hospital.id] = hospital.travel_times
          })
          
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
    const localityIpsCount: Record<string, Record<string, number>> = {}
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
      if (hospital.locality_id) {
        territoriesWithIps.add(hospital.locality_id)
        kamTerritories[kamId].add(hospital.locality_id)
        
        // Contar para mayoría en localidades
        if (!localityIpsCount[hospital.locality_id]) {
          localityIpsCount[hospital.locality_id] = {}
        }
        localityIpsCount[hospital.locality_id][kamId] = 
          (localityIpsCount[hospital.locality_id][kamId] || 0) + 1
      } else if (hospital.municipality_id) {
        territoriesWithIps.add(hospital.municipality_id)
        kamTerritories[kamId].add(hospital.municipality_id)
      }
    })

    // Determinar ganadores para localidades compartidas
    const territoryWinners: Record<string, string> = {}
    
    // Para cada territorio, asignar al KAM correspondiente
    Object.entries(kamTerritories).forEach(([kamId, territories]) => {
      territories.forEach(territoryId => {
        // Si es una localidad con múltiples KAMs, usar mayoría
        if (territoryId.length === 7 && localityIpsCount[territoryId]) {
          const counts = localityIpsCount[territoryId]
          const winner = Object.entries(counts)
            .sort(([,a], [,b]) => b - a)[0][0]
          territoryWinners[territoryId] = winner
        } else {
          // Para municipios o localidades sin competencia
          territoryWinners[territoryId] = kamId
        }
      })
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
        <div style="text-align: center;">
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
      iconSize: [36, 46],
      iconAnchor: [18, 46]
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
    const totalPopulation = Array.from(municipalities).reduce((sum, munId) => {
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

  return (
    <>
      <MapContainer
        center={[4.5709, -74.2973]}
        zoom={6}
        className="h-full w-full"
        preferCanvas={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />
        
        {/* Territorios con IPS - Primera capa */}
        {territoryGeoJsons.map((territory, idx) => {
          const isVacant = territory.isVacant
          const color = isVacant ? '#808080' : (kamColors[territory.kamId] || '#cccccc')
          const isLocality = territory.type === 'localities'
          
          // Calcular estadísticas del territorio
          const territoryHospitals = isVacant 
            ? mapData.unassignedHospitals.filter((h: any) => 
                h.locality_id === territory.territoryId || h.municipality_id === territory.territoryId
              )
            : mapData.assignments.filter((a: any) => 
                a.hospitals.locality_id === territory.territoryId || 
                a.hospitals.municipality_id === territory.territoryId
              ).map((a: any) => a.hospitals)
          
          const totalBeds = territoryHospitals.reduce((sum: number, h: any) => sum + (h.beds || 0), 0)
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
            >
              <Tooltip sticky={false} opacity={0.95}>
                <div style={{ fontSize: '12px', minWidth: '250px' }}>
                  <strong style={{ fontSize: '14px', color: isVacant ? '#FF0000' : color }}>
                    {mapData.municipalityNames[territory.territoryId] || `Localidad ${territory.territoryId}`}
                  </strong>
                  <div style={{ fontSize: '11px', marginBottom: '4px' }}>
                    {isVacant ? '⚠️ ZONA VACANTE' : `Asignado a: ${territory.kamId?.toUpperCase()}`}
                  </div>
                  <div style={{ marginTop: '4px', borderTop: '1px solid #ddd', paddingTop: '4px' }}>
                    <table style={{ width: '100%', borderSpacing: '0' }}>
                      <tbody>
                        <tr>
                          <td><strong>Población:</strong></td>
                          <td style={{ textAlign: 'right' }}>{population.toLocaleString()}</td>
                        </tr>
                        <tr>
                          <td><strong>Hospitales:</strong></td>
                          <td style={{ textAlign: 'right' }}>{territoryHospitals.length}</td>
                        </tr>
                        <tr>
                          <td><strong>Total camas:</strong></td>
                          <td style={{ textAlign: 'right' }}>{totalBeds}</td>
                        </tr>
                        {population > 0 && (
                          <tr>
                            <td><strong>Camas/1000 hab:</strong></td>
                            <td style={{ textAlign: 'right' }}>
                              {(totalBeds / population * 1000).toFixed(2)}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                    {isVacant && (
                      <div style={{ marginTop: '4px', fontSize: '11px', color: '#FF0000' }}>
                        ⚠️ Sin cobertura de KAM
                      </div>
                    )}
                  </div>
                </div>
              </Tooltip>
            </GeoJSON>
          )
        })}
        
        {/* Puntos de IPS - Segunda capa (encima de territorios) */}
        {mapData.assignments.map((assignment: any) => {
          const hospital = assignment.hospitals
          const kam = assignment.kams
          const serviceLevel = parseInt(hospital.service_level) || 1
          const radius = 3 + (serviceLevel * 1.0)
          
          return (
            <CircleMarker
              key={hospital.id}
              center={[hospital.lat, hospital.lng]}
              radius={radius}
              pathOptions={{
                color: '#222222',
                weight: 0.5,
                fillColor: kamColors[kam.id],
                fillOpacity: 0.9
              }}
              pane="markerPane"
            >
              <Tooltip sticky={false} opacity={0.95}>
                <div style={{ fontSize: '12px', minWidth: '200px' }}>
                  <strong style={{ fontSize: '13px' }}>{hospital.name}</strong><br/>
                  <div style={{ marginTop: '4px' }}>
                    <strong>Código NIT:</strong> {hospital.code}<br/>
                    <strong>Ubicación:</strong> {hospital.locality_id ? 
                      `${hospital.locality_name || 'Localidad'}, Bogotá` : 
                      `${hospital.municipality_name || hospital.municipality_id}, ${hospital.department_name || ''}`}<br/>
                    <strong>Camas:</strong> {hospital.beds || 0}<br/>
                    <strong>Nivel:</strong> {hospital.service_level || 'N/A'}<br/>
                    <strong>KAM asignado:</strong> {kam.name}<br/>
                    <strong>Tiempo de llegada:</strong> {
                      assignment.travel_time === 0 || assignment.travel_time === null 
                        ? 'En territorio base' 
                        : (() => {
                            const hours = Math.floor(assignment.travel_time / 60)
                            const minutes = assignment.travel_time % 60
                            if (hours === 0) {
                              return `${minutes} minutos`
                            } else if (minutes === 0) {
                              return `${hours} hora${hours > 1 ? 's' : ''}`
                            } else {
                              return `${hours} hora${hours > 1 ? 's' : ''} y ${minutes} minutos`
                            }
                          })()
                    }
                  </div>
                </div>
              </Tooltip>
            </CircleMarker>
          )
        })}
        
        {/* Hospitales sin asignar (zonas vacantes) */}
        {mapData.unassignedHospitals.map((hospital: any) => {
          let travelTimes = unassignedTravelTimes[hospital.id] || []
          
          // Si no hay tiempos en caché, estimar basado en distancia
          if (travelTimes.length === 0 && mapData.kams) {
            travelTimes = mapData.kams.map((kam: any) => ({
              kam_id: kam.id,
              kam_name: kam.name,
              travel_time: estimateTravelTime(
                { lat: kam.lat, lng: kam.lng },
                { lat: hospital.lat, lng: hospital.lng }
              ),
              is_estimated: true
            }))
            .sort((a: any, b: any) => a.travel_time - b.travel_time)
            .slice(0, 5) // Solo mostrar los 5 más cercanos
          }
          
          const zoneInfo = getZoneInfo(hospital.municipality_name)
          
          return (
            <CircleMarker
              key={`unassigned-${hospital.id}`}
              center={[hospital.lat, hospital.lng]}
              radius={5}
              pathOptions={{
                color: '#FF0000',
                weight: 1,
                fillColor: '#CCCCCC',
                fillOpacity: 0.7
              }}
              pane="markerPane"
            >
              <Tooltip sticky={false} opacity={0.95}>
                <div style={{ fontSize: '12px', minWidth: '300px' }}>
                  <strong style={{ fontSize: '13px', color: '#FF0000' }}>⚠️ SIN COBERTURA</strong><br/>
                  <strong style={{ fontSize: '13px' }}>{hospital.name}</strong><br/>
                  <div style={{ marginTop: '4px' }}>
                    <strong>Código NIT:</strong> {hospital.code}<br/>
                    <strong>Ubicación:</strong> {hospital.municipality_name || mapData.municipalityNames[hospital.municipality_id] || hospital.municipality_id}<br/>
                    <strong>Camas:</strong> {hospital.beds || 0}<br/>
                    <strong>Nivel:</strong> {hospital.service_level || 'N/A'}<br/>
                    <div style={{ marginTop: '4px', paddingTop: '4px', borderTop: '1px solid #ddd' }}>
                      <strong>Distancia desde cada KAM:</strong><br/>
                      {travelTimes.length > 0 ? (
                        <div style={{ fontSize: '11px', marginTop: '4px' }}>
                          <table style={{ width: '100%', borderSpacing: '0 2px' }}>
                            <tbody>
                              {travelTimes.slice(0, 8).map((tt: any, idx: number) => {
                                const hours = Math.floor(tt.travel_time / 60)
                                const minutes = tt.travel_time % 60
                                const timeStr = hours === 0 
                                  ? `${minutes} min`
                                  : minutes === 0
                                    ? `${hours}h`
                                    : `${hours}h ${minutes}min`
                                
                                const isOverLimit = tt.travel_time > 240
                                const isClose = tt.travel_time > 240 && tt.travel_time <= 300 // 5 horas
                                
                                return (
                                  <tr key={idx}>
                                    <td style={{ 
                                      paddingRight: '10px',
                                      fontWeight: 'bold',
                                      color: isClose ? '#FF6B00' : (isOverLimit ? '#CC0000' : '#333')
                                    }}>
                                      {tt.kam_name}:
                                    </td>
                                    <td style={{ 
                                      textAlign: 'right',
                                      color: isClose ? '#FF6B00' : (isOverLimit ? '#CC0000' : '#666')
                                    }}>
                                      {timeStr} {isClose && '⚠️'} {tt.is_estimated && '*'}
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
                          {travelTimes.some((tt: any) => tt.is_estimated) && (
                            <div style={{ marginTop: '4px', fontSize: '10px', fontStyle: 'italic', color: '#999' }}>
                              * Tiempos estimados por distancia
                            </div>
                          )}
                        </div>
                      ) : (
                        <div style={{ fontSize: '11px', color: '#CC0000', marginTop: '4px' }}>
                          <strong>⚠️ Zona muy lejana</strong><br/>
                          <div style={{ marginTop: '4px', color: '#666' }}>
                            Todos los KAMs están a <strong>más de 4 horas</strong> de distancia.<br/>
                            <br/>
                            <strong>Ubicación:</strong> {hospital.municipality_name || 'Desconocida'}<br/>
                            {hospital.department_name && (
                              <>
                                <strong>Departamento:</strong> {hospital.department_name}<br/>
                              </>
                            )}
                            <br/>
                            <em style={{ fontSize: '10px' }}>
                              Esta zona requiere evaluación especial.<br/>
                              Considere contratar un KAM local o<br/>
                              establecer alianzas estratégicas.
                            </em>
                          </div>
                        </div>
                      )}
                      {travelTimes.length > 0 && travelTimes[0].travel_time > 240 && travelTimes[0].travel_time <= 300 && (
                        <div style={{ marginTop: '6px', padding: '4px', backgroundColor: '#FFF3CD', border: '1px solid #FFE69C', borderRadius: '4px' }}>
                          <div style={{ fontSize: '11px', color: '#856404' }}>
                            💡 <strong>Sugerencia:</strong> {travelTimes[0].kam_name} está a solo {Math.floor(travelTimes[0].travel_time / 60)}h {travelTimes[0].travel_time % 60}min.
                            Considere ajustar su límite de tiempo máximo de 4 a 5 horas.
                          </div>
                        </div>
                      )}
                      {zoneInfo && (
                        <div style={{ marginTop: '6px', padding: '4px', backgroundColor: '#E3F2FD', border: '1px solid #90CAF9', borderRadius: '4px' }}>
                          <div style={{ fontSize: '10px', color: '#1565C0' }}>
                            📍 <strong>Zona especial:</strong> {zoneInfo}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </Tooltip>
            </CircleMarker>
          )
        })}
        
        {/* Marcadores de KAMs */}
        {kamStats.map((kam: any) => (
          <Marker
            key={kam.id}
            position={[kam.lat, kam.lng]}
            icon={createKamIcon(kam.id)}
          >
            <Tooltip sticky={false}>
              <div style={{ fontSize: '12px', minWidth: '180px' }}>
                <strong style={{ fontSize: '14px', color: kamColors[kam.id] }}>{kam.name}</strong>
                <div style={{ marginTop: '4px', borderTop: '1px solid #ddd', paddingTop: '4px' }}>
                  <table style={{ width: '100%', borderSpacing: '0' }}>
                    <tbody>
                      <tr>
                        <td><strong>IPS:</strong></td>
                        <td style={{ textAlign: 'right' }}>{kam.hospitalCount}</td>
                      </tr>
                      <tr>
                        <td><strong>Municipios:</strong></td>
                        <td style={{ textAlign: 'right' }}>{kam.municipalityCount}</td>
                      </tr>
                      <tr>
                        <td><strong>Población:</strong></td>
                        <td style={{ textAlign: 'right' }}>{kam.totalPopulation.toLocaleString()}</td>
                      </tr>
                      <tr>
                        <td><strong>Total camas:</strong></td>
                        <td style={{ textAlign: 'right' }}>{kam.totalBeds.toLocaleString()}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div style={{ marginTop: '4px', fontSize: '11px', color: '#666' }}>
                  Base: {kam.area_id}
                </div>
              </div>
            </Tooltip>
          </Marker>
        ))}
      </MapContainer>
      
      {/* Leyenda */}
      <div style={{
        position: 'fixed',
        bottom: '30px',
        right: '10px',
        width: '260px',
        backgroundColor: 'rgba(255,255,255,0.95)',
        zIndex: 1000,
        border: '1px solid #ccc',
        borderRadius: '8px',
        padding: '12px',
        fontSize: '12px',
        boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
      }}>
        <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#333' }}>Convenciones</h4>
        <div style={{ marginBottom: '6px' }}>
          <i className="fa fa-user" style={{ color: '#000', fontSize: '14px' }}></i>{' '}
          <span style={{ verticalAlign: 'middle' }}>KAM (Key Account Manager)</span>
        </div>
        <div style={{ marginBottom: '6px' }}>
          <span style={{
            display: 'inline-block',
            width: '12px',
            height: '12px',
            backgroundColor: '#888',
            borderRadius: '50%',
            border: '1px solid #222',
            verticalAlign: 'middle'
          }}></span>{' '}
          <span style={{ verticalAlign: 'middle' }}>Institución Prestadora de Salud</span>
        </div>
        <div style={{ marginBottom: '6px' }}>
          <span style={{
            display: 'inline-block',
            width: '30px',
            height: '12px',
            backgroundColor: '#888',
            opacity: 0.4,
            border: '1px solid #333',
            verticalAlign: 'middle'
          }}></span>{' '}
          <span style={{ verticalAlign: 'middle' }}>Territorio asignado</span>
        </div>
        <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid #ddd', fontSize: '11px', color: '#666' }}>
          <i className="fa fa-info-circle"></i> Los colores identifican a cada KAM<br/>
          y su zona de cobertura asignada
        </div>
      </div>
    </>
  )
}