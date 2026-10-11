'use client'

import { useEffect, useRef } from 'react'
import { CircleMarker, Tooltip } from 'react-leaflet'
import { useRouter } from 'next/navigation'
import { formatTravelTimeFromSeconds } from '@/lib/format-utils'
import { zoneDisplayName } from '@/lib/zone-names'

// Ejecutivo Comercial que vive en la zona (viene de /api/map/data, campo kams[].executives)
export interface ZoneExecutive {
  id: string
  full_name: string
  status: string
}

// Texto plano con los Ejecutivos Comerciales de una zona. Quien lo inserte en HTML crudo debe escaparlo.
export const formatZoneExecutives = (executives?: ZoneExecutive[] | null): string => {
  const list = Array.isArray(executives) ? executives : []
  if (list.length === 0) return 'sin ejecutivo local'
  return list
    .map(e => (e.status === 'placeholder' ? `${e.full_name} (por contratar)` : e.full_name))
    .join(', ')
}

interface HospitalMarkerProps {
  hospital: any
  kam: any
  kamColor: string
  assignment: any
  contractValue?: number
  contractProviders?: string[]
  isSelected?: boolean
  executives?: ZoneExecutive[]
  // Mapa por línea: quién cubre la zona de esta IPS en la línea elegida (texto plano)
  lineInfo?: {
    lineName: string
    coverageText: string
    hasEquipment: boolean
  }
}

export default function HospitalMarker({ 
  hospital, 
  kam, 
  kamColor, 
  assignment, 
  contractValue,
  contractProviders,
  isSelected,
  executives,
  lineInfo
}: HospitalMarkerProps) {
  const markerRef = useRef<any>(null)
  const router = useRouter()
  
  useEffect(() => {
    if (isSelected && markerRef.current) {
      // Usar setTimeout para asegurar que el marcador esté renderizado
      setTimeout(() => {
        if (markerRef.current) {
          markerRef.current.openTooltip()
        }
      }, 100)
    } else if (!isSelected && markerRef.current) {
      // Cerrar el tooltip cuando se deselecciona
      markerRef.current.closeTooltip()
    }
  }, [isSelected])

  const serviceLevel = parseInt(hospital.service_level) || 1
  const radius = 3 + (serviceLevel * 1.0)
  
  return (
    <CircleMarker
      ref={markerRef}
      center={[hospital.lat, hospital.lng]}
      radius={radius}
      pathOptions={{
        color: '#222222',
        weight: 0.5,
        fillColor: kamColor,
        fillOpacity: 0.9,
        className: 'hospital-marker'
      }}
      pane="markerPane"
      eventHandlers={{
        click: () => {
          router.push(`/hospitals/${hospital.id}`)
        },
        add: (e: any) => {
          // Guardar referencia cuando el marcador se agrega al mapa
          if (isSelected) {
            setTimeout(() => {
              e.target.openTooltip()
            }, 100)
          }
        }
      }}
    >
      <Tooltip 
        sticky={false} 
        opacity={0.95}
        permanent={isSelected || false}
        direction="top"
        offset={[0, -10]}
        className="custom-tooltip"
      >
        <div style={{ 
          fontSize: '12px', 
          minWidth: '200px',
          maxWidth: '350px',
          maxHeight: '400px',
          overflowY: 'auto',
          overflowX: 'hidden',
          wordWrap: 'break-word',
          whiteSpace: 'normal'
        }}>
          <strong style={{ 
            fontSize: '13px', 
            wordBreak: 'break-word',
            display: 'block',
            marginBottom: '4px'
          }}>{hospital.name}</strong>
          <div style={{ marginTop: '4px' }}>
            <strong>Código NIT:</strong> {hospital.code}<br/>
            <strong>Ubicación:</strong> {hospital.locality_id ? 
              `${hospital.locality_name || 'Localidad'}, Bogotá` : 
              `${hospital.municipality_name || hospital.municipality_id}, ${hospital.department_name || ''}`}<br/>
            <strong>Camas:</strong> {hospital.beds || 0}<br/>
            <strong>Nivel:</strong> {hospital.service_level || 'N/A'}<br/>
            {hospital.type && (
              <>
                <strong>Tipo:</strong> <span style={{ 
                  padding: '2px 6px', 
                  borderRadius: '4px', 
                  fontSize: '11px',
                  backgroundColor: hospital.type === 'Publico' ? '#f5f5f5' : 
                                 hospital.type === 'Privada' ? '#000' : '#e5e5e5',
                  color: hospital.type === 'Publico' ? '#000' : 
                        hospital.type === 'Privada' ? '#fff' : '#333'
                }}>{hospital.type}</span><br/>
              </>
            )}
            <strong>Zona:</strong> {zoneDisplayName(kam.name)}<br/>
            {lineInfo ? (
              <>
                <strong>Línea:</strong> {lineInfo.lineName}<br/>
                <strong>Ejecutivo Comercial:</strong> {lineInfo.coverageText}<br/>
                {!lineInfo.hasEquipment && (
                  <>
                    <span style={{ color: '#92400e' }}>Sin equipo de la línea en esta zona</span><br/>
                  </>
                )}
              </>
            ) : (
              <>
                <strong>Ejecutivo Comercial:</strong> {formatZoneExecutives(executives)}<br/>
              </>
            )}
            {hospital.doctors && (
              <>
                <strong>Doctores:</strong><br/>
                <div style={{ marginLeft: '10px', fontSize: '11px', color: '#555' }}>
                  {hospital.doctors.split('\n').slice(0, 3).map((doctor: string, index: number) => (
                    <div key={index}>• {doctor.trim()}</div>
                  ))}
                  {hospital.doctors.split('\n').length > 3 && (
                    <div style={{ fontStyle: 'italic', color: '#888' }}>
                      ...y {hospital.doctors.split('\n').length - 3} más
                    </div>
                  )}
                </div>
              </>
            )}
            {contractValue && (
              <>
                <strong style={{ color: '#2ECC71' }}>💰 Contratos:</strong> ${contractValue.toLocaleString('es-CO')}<br/>
              </>
            )}
            {contractProviders && contractProviders.length > 0 && (
              <>
                <strong>Proveedores:</strong><br/>
                <div style={{ marginLeft: '10px', fontSize: '11px', color: '#555' }}>
                  {contractProviders.map((provider: string, index: number) => (
                    <div key={index}>• {provider}</div>
                  ))}
                </div>
              </>
            )}
            <strong>Tiempo de llegada:</strong> {formatTravelTimeFromSeconds(assignment.travel_time)}
          </div>
        </div>
      </Tooltip>
    </CircleMarker>
  )
}